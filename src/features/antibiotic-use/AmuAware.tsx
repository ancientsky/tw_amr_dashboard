import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { fmtPct } from '../../data/format';
import { useDataset } from '../../data/load';
import { inYearRange } from '../../data/select';
import type { Level } from '../../data/types';
import { useT } from '../../i18n';
import { tipRow, tipTitle, envSourceLine } from '../international/kit/util';
import { useNarrow } from '../international/kit/hooks';
import { AWARE_COLORS, AWARE_ORDER, WHO_ACCESS_TARGET, awareByYear, levelsOf, share, type AwareKey } from './amuModel';
import { parseAmuExtras, type AmuChartProps } from './AmuStacked';

/** AWaRe share (100 % stacked bars) by year, one small multiple per hospital level. */
export function AmuAware(props: AmuChartProps) {
  const { compact, link, fixtureFallback } = props;
  const { level, years } = parseAmuExtras(props);
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status } = useDataset('antibiotic_use', { fixtureFallback });
  const dims = env?.dims?.classes;
  const levels = useMemo(() => levelsOf(env), [env]);

  const model = useMemo(() => {
    if (!env) return null;
    return levels.map((l) => ({ level: l, rows: awareByYear(env.records, dims, l).filter((s) => inYearRange(s.year, years)) }));
  }, [env, dims, levels, years]);

  const cols = narrow || compact ? 1 : 2;
  const panelH = compact ? 150 : narrow ? 170 : 190;
  const rowsN = Math.ceil((model?.length ?? 4) / cols);
  const height = rowsN * (panelH + 40) + 40;

  const option = useMemo<EChartsOption>(() => {
    if (!model) return {};
    const tok = ct.tokens;
    const keys: AwareKey[] = AWARE_ORDER.filter((a) => model.some((m) => m.rows.some((r) => r[a] > 0)));
    const grids: Record<string, unknown>[] = [];
    const xAxes: Record<string, unknown>[] = [];
    const yAxes: Record<string, unknown>[] = [];
    const titles: Record<string, unknown>[] = [];
    const series: Record<string, unknown>[] = [];
    model.forEach((m, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const leftPct = (c * 100) / cols;
      const top = 36 + r * (panelH + 40);
      grids.push({ left: `${leftPct + (c ? 3 : 0.5)}%`, width: `${100 / cols - 4}%`, top: top + 22, height: panelH - 22, containLabel: true });
      titles.push({ text: t(`levels.${m.level}`), left: `${leftPct + (c ? 3 : 0.5)}%`, top, textStyle: { fontSize: 12.5, fontWeight: 650, color: m.level === level ? tok.accent : tok.ink } });
      xAxes.push({ type: 'category', gridIndex: i, data: m.rows.map((x) => String(x.year)), axisLabel: { fontSize: 10.5 } });
      yAxes.push({ type: 'value', gridIndex: i, max: 100, splitNumber: 2, axisLabel: { formatter: '{value}%', fontSize: 10.5 } });
      keys.forEach((k, ki) => {
        series.push({
          type: 'bar',
          name: t(`amu.aware.${k}`),
          xAxisIndex: i,
          yAxisIndex: i,
          stack: `l${i}`,
          barMaxWidth: 22,
          data: m.rows.map((x) => Math.round(share(x, k) * 10) / 10),
          itemStyle: { color: AWARE_COLORS[ct.theme][k], borderColor: tok.surface, borderWidth: 1, borderRadius: ki === keys.length - 1 ? [3, 3, 0, 0] : 0 },
          emphasis: { focus: 'series' },
          markLine:
            ki === 0
              ? {
                  symbol: 'none',
                  silent: true,
                  lineStyle: { color: tok.ink, width: 1, type: 'solid', opacity: 0.6 },
                  label: { show: i === 0, formatter: t('amu.target.short'), position: 'insideEndTop', color: tok.ink2, fontSize: 10 },
                  data: [{ yAxis: WHO_ACCESS_TARGET }],
                }
              : undefined,
        });
      });
    });
    return {
      title: titles,
      legend: { top: 0, left: 0, data: keys.map((k) => t(`amu.aware.${k}`)) },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        formatter: (ps: unknown) => {
          const arr = ps as { axisIndex?: number; seriesName: string; value: number; color: string; name: string; xAxisIndex?: number }[];
          if (!arr.length) return '';
          return tipTitle(arr[0].name) + arr.map((p) => tipRow(p.color, p.seriesName, fmtPct(p.value, t.locale))).join('');
        },
      },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series,
    } as EChartsOption;
  }, [model, ct, cols, panelH, t, level]);

  const tableRows = useMemo(
    () =>
      (model ?? []).flatMap((m) =>
        m.rows.map((x) => ({
          [t('common.level')]: t(`levels.${m.level}`),
          [t('common.year')]: x.year,
          [`${t('amu.aware.Access')} %`]: Math.round(share(x, 'Access') * 10) / 10,
          [`${t('amu.aware.Watch')} %`]: Math.round(share(x, 'Watch') * 10) / 10,
          [`${t('amu.aware.Reserve')} %`]: Math.round(share(x, 'Reserve') * 10) / 10,
          [`${t('amu.aware.Unclassified')} %`]: Math.round(share(x, 'Unclassified') * 10) / 10,
          DID: Math.round(x.total * 10) / 10,
        })),
      ),
    [model, t],
  );

  const sel = model?.find((m) => m.level === level)?.rows;
  const lastSel = sel?.[sel.length - 1];
  const title = t('amu.awareBars.title');
  return (
    <ChartCard
      id="amu-aware"
      title={title}
      subtitle={t('amu.awareBars.subtitle')}
      source={envSourceLine(env, t.locale)}
      dataset="antibiotic_use"
      status={status}
      chartRef={ref}
      tableRows={tableRows}
      fileName="twamr-amu-aware-by-level"
      link={link}
      embed={{ chart: 'amu-aware', params: { level: level !== 'all' ? (level as Level) : null } }}
      keyNumber={lastSel ? { value: fmtPct(share(lastSel, 'Access'), t.locale), label: `${t('amu.aware.Access')} · ${t(`levels.${level}`)} · ${lastSel.year}` } : undefined}
      compact={compact}
      height={height}
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${t('amu.awareBars.subtitle')}`} />
    </ChartCard>
  );
}
