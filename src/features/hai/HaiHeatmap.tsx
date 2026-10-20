import type { EChartsOption } from 'echarts';
import { useMemo, useRef, useState } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { mix, textOn } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { dimNamer, fmtNumber } from '../../data/format';
import { useDataset } from '../../data/load';
import { inYearRange, latestYear, type YearRange } from '../../data/select';
import type { IcuType, Level } from '../../data/types';
import { useT } from '../../i18n';
import { mean, sd, tipRow, tipTitle, envSourceLine } from '../international/kit/util';
import { useNarrow } from '../international/kit/hooks';
import { HEAT_METRICS, icuTypesFor } from './haiModel';

type Mode = 'raw' | 'z';

/** Diverging poles (cool = below average, warm = above) with a neutral midpoint. */
const DIVERGING = {
  light: ['#2f6fd0', '#e9ecea', '#c43a4d'],
  dark: ['#4f8ff0', '#26332c', '#ec5466'],
} as const;
const SEQ = { light: ['#eef5f1', '#0e7c5b'], dark: ['#15241c', '#00c97c'] } as const;

/** Heatmap ICU type × metric for the latest year (raw values coloured within column, or z-scores). */
export function HaiHeatmap({ level, icu, years, metric, link }: { level: Level; icu: IcuType; years?: YearRange; metric?: string; link?: string }) {
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const [mode, setMode] = useState<Mode>('raw');
  const { data: env, status } = useDataset('hai');
  const nameIcu = dimNamer(env?.dims?.icuTypes, t.locale);

  const model = useMemo(() => {
    if (!env) return null;
    const rows = env.records.filter((r) => r.level === level && inYearRange(r.year, years));
    const year = latestYear(rows);
    const cur = rows.filter((r) => r.year === year);
    const icus = icuTypesFor(cur, level);
    const metrics = HEAT_METRICS.filter((m) => cur.some((r) => r.metric === m));
    const val = new Map(cur.map((r) => [`${r.icu_type}|${r.metric}`, r.value]));
    const stats = new Map(
      metrics.map((m) => {
        const vs = icus.filter((i) => i !== 'all').map((i) => val.get(`${i}|${m}`)).filter((v): v is number => v !== undefined);
        return [m, { mean: mean(vs) ?? 0, sd: sd(vs) ?? 1, min: Math.min(...vs), max: Math.max(...vs) }];
      }),
    );
    return { year, icus, metrics, val, stats };
  }, [env, level, years]);

  const short = (m: string) => t(`hai.short.${m}`);
  const height = model ? Math.max(260, model.icus.length * (narrow ? 30 : 34) + 110) : 340;

  const option = useMemo<EChartsOption>(() => {
    if (!model) return {};
    const tok = ct.tokens;
    const data: Record<string, unknown>[] = [];
    model.icus.forEach((i, yi) =>
      model.metrics.forEach((m, xi) => {
        const v = model.val.get(`${i}|${m}`);
        if (v === undefined) return;
        const st = model.stats.get(m)!;
        const z = st.sd > 0 ? (v - st.mean) / st.sd : 0;
        if (mode === 'z') {
          data.push({ value: [xi, yi, Math.round(z * 100) / 100], raw: v, z });
        } else {
          const tt = st.max > st.min ? (v - st.min) / (st.max - st.min) : 0.5;
          const fill = mix(SEQ[ct.theme][0], SEQ[ct.theme][1], Math.max(0, Math.min(1, tt)));
          data.push({ value: [xi, yi, v], raw: v, z, itemStyle: { color: fill }, label: { color: textOn(fill) } });
        }
      }),
    );
    const dv = DIVERGING[ct.theme];
    return {
      grid: { left: 4, right: 12, top: mode === 'z' ? 46 : 12, bottom: 4, containLabel: true },
      tooltip: {
        confine: true,
        formatter: (p: unknown) => {
          const d = (p as { data: { value: number[]; raw: number; z: number } }).data;
          const m = model.metrics[d.value[0]];
          const i = model.icus[d.value[1]];
          return tipTitle(`${nameIcu(i)} · ${model.year}`) + tipRow(undefined, short(m), fmtNumber(d.raw, t.locale, { digits: m.endsWith('_util') ? 3 : 2 }), true) + tipRow(undefined, t('hai.heat.zLabel'), fmtNumber(d.z, t.locale, { digits: 2 }));
        },
      },
      visualMap:
        mode === 'z'
          ? { type: 'continuous', min: -2, max: 2, orient: 'horizontal', top: 0, right: 8, itemHeight: narrow ? 110 : 160, itemWidth: 10, calculable: false, text: ['+2σ', '−2σ'], inRange: { color: [...dv] }, textStyle: { color: tok.ink3, fontSize: 11 }, dimension: 2 }
          : undefined,
      xAxis: {
        type: 'category',
        data: model.metrics.map(short),
        position: 'top',
        axisLabel: {
          interval: 0,
          rotate: narrow ? 50 : 0,
          fontSize: narrow ? 10 : 11,
          fontWeight: 600,
          color: tok.ink2,
          formatter: (v: string, idx: number) => (model.metrics[idx] === metric ? `{b|${v}}` : v),
          rich: { b: { fontWeight: 750, color: tok.accent, fontSize: narrow ? 10 : 11 } },
        },
        axisLine: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: model.icus.map((i) => nameIcu(i)),
        inverse: true,
        axisLine: { show: false },
        axisLabel: { fontSize: 11, formatter: (v: string, idx: number) => (model.icus[idx] === icu ? `{b|${v}}` : v), rich: { b: { fontWeight: 750, color: tok.accent } } },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: !narrow || model.metrics.length <= 6,
            fontSize: 10.5,
            formatter: (p: { data: { value: number[]; raw: number } }) =>
              mode === 'z' ? fmtNumber(p.data.value[2], t.locale, { digits: 1 }) : fmtNumber(p.data.raw, t.locale, { digits: model.metrics[p.data.value[0]].endsWith('_util') ? 2 : 1 }),
          },
          itemStyle: { borderColor: tok.surface, borderWidth: 2, borderRadius: 4 },
          emphasis: { itemStyle: { borderColor: tok.ink, borderWidth: 1.5 } },
        },
      ],
    } as EChartsOption;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, ct, mode, narrow, nameIcu, icu, t, metric]);

  const tableRows = useMemo(
    () =>
      (model?.icus ?? []).map((i) => {
        const row: Record<string, string | number | null> = { [t('hai.icu')]: nameIcu(i) };
        for (const m of model!.metrics) row[short(m)] = model!.val.get(`${i}|${m}`) ?? null;
        return row;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, t, nameIcu],
  );

  const title = t('hai.heat.title', { year: model?.year ?? '—' });
  const subtitle = mode === 'z' ? t('hai.heat.subtitleZ', { level: t(`levels.${level}`) }) : t('hai.heat.subtitleRaw', { level: t(`levels.${level}`) });
  return (
    <ChartCard
      id="hai-heatmap"
      title={title}
      subtitle={subtitle}
      source={envSourceLine(env, t.locale)}
      dataset="hai"
      status={status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-hai-heatmap-${level}-${model?.year ?? ''}`}
      link={link}
      height={height}
      actions={
        <SegmentedControl<Mode>
          size="sm"
          label={t('hai.heat.modeLabel')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'raw', label: t('hai.heat.raw') },
            { value: 'z', label: t('hai.heat.z') },
          ]}
        />
      }
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${subtitle}`} />
    </ChartCard>
  );
}
