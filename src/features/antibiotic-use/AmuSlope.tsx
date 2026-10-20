import type { EChartsOption } from 'echarts';
import { useMemo, useRef, useState } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { colorMap, LEVEL_ORDER } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { fmtPct } from '../../data/format';
import { useDataset } from '../../data/load';
import { inYearRange, type YearRange } from '../../data/select';
import type { Level } from '../../data/types';
import { useT } from '../../i18n';
import { tipRow, tipTitle, envSourceLine } from '../international/kit/util';
import { useNarrow } from '../international/kit/hooks';
import { WHO_ACCESS_TARGET, awareByYear, levelsOf, share } from './amuModel';

type Group = 'Access' | 'Watch' | 'Reserve';

/** Slope chart: AWaRe share in the first vs last year of the range, one line per hospital level. */
export function AmuSlope({ level, years, link }: { level: Level; years?: YearRange; link?: string }) {
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const [group, setGroup] = useState<Group>('Access');
  const { data: env, status } = useDataset('antibiotic_use');
  const dims = env?.dims?.classes;
  const levels = useMemo(() => levelsOf(env), [env]);

  const model = useMemo(() => {
    if (!env) return null;
    const lines = levels
      .map((l) => {
        const sp = awareByYear(env.records, dims, l).filter((x) => inYearRange(x.year, years));
        if (sp.length < 2) return null;
        const a = sp[0];
        const b = sp[sp.length - 1];
        return { level: l, from: a.year, to: b.year, a: share(a, group), b: share(b, group) };
      })
      .filter((x): x is { level: Level; from: number; to: number; a: number; b: number } => Boolean(x));
    return lines;
  }, [env, dims, levels, years, group]);

  const height = 360;
  const option = useMemo<EChartsOption>(() => {
    if (!model?.length) return {};
    const tok = ct.tokens;
    const color = colorMap([...LEVEL_ORDER], ct.theme);
    const from = model[0].from;
    const to = model[0].to;
    const vals = model.flatMap((m) => [m.a, m.b]);
    const lo = Math.max(0, Math.floor((Math.min(...vals, group === 'Access' ? WHO_ACCESS_TARGET : 100) - 5) / 5) * 5);
    const hi = Math.min(100, Math.ceil((Math.max(...vals, group === 'Access' ? WHO_ACCESS_TARGET : 0) + 5) / 5) * 5);
    return {
      grid: { left: narrow ? 8 : 24, right: narrow ? 110 : 150, top: 30, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const pp = p as { seriesIndex: number };
          const m = model[pp.seriesIndex];
          if (!m) return '';
          return tipTitle(t(`levels.${m.level}`)) + tipRow(color(m.level), String(m.from), fmtPct(m.a, t.locale)) + tipRow(color(m.level), String(m.to), fmtPct(m.b, t.locale), true);
        },
      },
      xAxis: { type: 'category', data: [String(from), String(to)], boundaryGap: false, axisLabel: { fontWeight: 650, color: tok.ink2 }, axisLine: { show: false } },
      yAxis: { type: 'value', min: lo, max: hi, axisLabel: { formatter: '{value}%' } },
      series: model.map((m, i) => {
        const c = color(m.level);
        const focus = m.level === level;
        return {
          type: 'line',
          name: t(`levels.${m.level}`),
          data: [Math.round(m.a * 10) / 10, Math.round(m.b * 10) / 10],
          symbol: 'circle',
          symbolSize: focus ? 10 : 8,
          lineStyle: { color: c, width: focus ? 3 : 2, opacity: focus || level === 'all' ? 1 : 0.6 },
          itemStyle: { color: c, borderColor: tok.surface, borderWidth: 2 },
          endLabel: {
            show: true,
            formatter: () => `${fmtPct(m.b, t.locale)}  ${t(`levels.${m.level}`)}`,
            color: tok.ink2,
            fontSize: 11,
            fontWeight: focus ? 700 : 500,
            distance: 8,
          },
          labelLayout: { moveOverlap: 'shiftY' },
          markLine:
            i === 0 && group === 'Access'
              ? {
                  symbol: 'none',
                  silent: true,
                  lineStyle: { color: tok.ink3, width: 1, type: 'solid' },
                  label: { formatter: t('amu.target.short'), position: 'insideStartTop', color: tok.ink2, fontSize: 10.5 },
                  data: [{ yAxis: WHO_ACCESS_TARGET }],
                }
              : undefined,
          emphasis: { focus: 'series' },
        };
      }),
    } as EChartsOption;
  }, [model, ct, t, level, group, narrow]);

  const title = t('amu.slope.title', { group: t(`amu.aware.${group}`) });
  const span = model?.[0] ? `${model[0].from}→${model[0].to}` : '';
  return (
    <ChartCard
      id="amu-slope"
      title={title}
      subtitle={t('amu.slope.subtitle', { span })}
      source={envSourceLine(env, t.locale)}
      dataset="antibiotic_use"
      status={status === 'ready' && !model?.length ? 'empty' : status}
      chartRef={ref}
      tableRows={(model ?? []).map((m) => ({
        [t('common.level')]: t(`levels.${m.level}`),
        [String(m.from)]: Math.round(m.a * 10) / 10,
        [String(m.to)]: Math.round(m.b * 10) / 10,
        Δ: Math.round((m.b - m.a) * 10) / 10,
      }))}
      fileName={`twamr-amu-slope-${group.toLowerCase()}`}
      link={link}
      height={height}
      actions={
        <SegmentedControl<Group>
          size="sm"
          label={t('amu.slope.groupLabel')}
          value={group}
          onChange={setGroup}
          options={(['Access', 'Watch', 'Reserve'] as Group[]).map((g) => ({ value: g, label: t(`amu.aware.${g}`) }))}
        />
      }
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${t('amu.slope.subtitle', { span })}`} />
    </ChartCard>
  );
}
