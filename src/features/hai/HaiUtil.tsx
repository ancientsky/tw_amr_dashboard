import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { seriesColor } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { dimNamer, fmtNumber } from '../../data/format';
import { useDataset } from '../../data/load';
import { buildSeries, filterYears, seriesToRows, type YearRange } from '../../data/select';
import type { IcuType, Level } from '../../data/types';
import { useT } from '../../i18n';
import { envSourceLine } from '../international/kit/util';
import { UTIL_METRICS } from './haiModel';

/** Device utilisation ratios (device-days / patient-days) over time for the selected level & ICU. */
export function HaiUtil({
  level,
  icu,
  years,
  link,
}: {
  level: Level;
  icu: IcuType;
  years?: YearRange;
  link?: string;
}) {
  const t = useT();
  const ct = useChartTheme();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status } = useDataset('hai');
  const nameM = dimNamer(env?.dims?.metrics, t.locale);
  const nameIcu = dimNamer(env?.dims?.icuTypes, t.locale);

  const set = useMemo(() => {
    if (!env) return null;
    const rows = filterYears(env.records, years).filter(
      (r) =>
        r.level === level && r.icu_type === icu && (UTIL_METRICS as readonly string[]).includes(r.metric),
    );
    return buildSeries(
      rows,
      (r) => r.metric,
      (r) => r.value,
      { keyOrder: [...UTIL_METRICS] },
    );
  }, [env, level, icu, years]);

  const height = 300;
  const option = useMemo<EChartsOption>(() => {
    if (!set) return {};
    const tok = ct.tokens;
    return {
      grid: { left: 4, right: 56, top: 58, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, data: set.series.map((s) => nameM(s.key)) },
      tooltip: { trigger: 'axis', valueFormatter: (v) => fmtNumber(v as number, t.locale, { digits: 3 }) },
      xAxis: { type: 'category', data: set.years.map(String), boundaryGap: false },
      yAxis: {
        type: 'value',
        min: 0,
        max: (v: { max: number }) => Math.min(1, Math.ceil((v.max + 0.05) * 10) / 10),
        axisLabel: { formatter: (v: number) => fmtNumber(v, t.locale, { digits: 1 }) },
      },
      series: set.series.map((s, i) => {
        const c = seriesColor(i + 1, ct.theme);
        return {
          type: 'line',
          name: nameM(s.key),
          data: s.data,
          showSymbol: false,
          lineStyle: { color: c, width: 2 },
          itemStyle: { color: c, borderColor: tok.surface, borderWidth: 2 },
          endLabel: {
            show: true,
            formatter: (p: { value: number }) => fmtNumber(p.value, t.locale, { digits: 2 }),
            color: tok.ink2,
            fontSize: 11,
            distance: 6,
          },
          labelLayout: { moveOverlap: 'shiftY' },
          emphasis: { focus: 'series' },
        };
      }),
    } as EChartsOption;
  }, [set, ct, nameM, t]);

  const title = t('hai.util.title');
  const subtitle = t('hai.util.subtitle', { level: t(`levels.${level}`), icu: nameIcu(icu) });
  return (
    <ChartCard
      id="hai-util"
      title={title}
      subtitle={subtitle}
      source={envSourceLine(env, t.locale)}
      dataset="hai"
      status={status === 'ready' && set && !set.series.length ? 'empty' : status}
      chartRef={ref}
      tableRows={set ? seriesToRows(set, nameM) : undefined}
      fileName={`twamr-hai-utilisation-${level}-${icu}`}
      link={link}
      height={height}
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${subtitle}`} />
    </ChartCard>
  );
}
