import type { EChartsOption } from 'echarts';
import { useMemo, useRef, useState } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { MUTED, seriesColor } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { dimNamer, fmtNumber } from '../../data/format';
import { useDataset } from '../../data/load';
import { inYearRange, yearsOf } from '../../data/select';
import type { IcuType } from '../../data/types';
import type { ChartParams } from '../../embed/charts/common';
import { useT } from '../../i18n';
import k from '../international/kit/kit.module.css';
import { hashParam, niceMax, tipRow, tipTitle, envSourceLine } from '../international/kit/util';
import { useNarrow } from '../international/kit/hooks';
import { TREND_METRICS, haiSeries, icuTypesFor, unitKey, type TrendMetric } from './haiModel';

export interface HaiChartProps extends ChartParams {
  icu?: IcuType;
  metric?: string;
  site?: string;
}

/** Small multiples: one panel per ICU type for the chosen metric, with the all-ICU line as muted reference. */
export function HaiTrend({
  level: lvl,
  icu: icuProp,
  metric: metricProp,
  years,
  compact,
  link,
  fixtureFallback,
}: HaiChartProps) {
  const level = lvl ?? 'all';
  const metricRaw = metricProp ?? hashParam('metric') ?? 'clabsi';
  const metric: TrendMetric = (TREND_METRICS as readonly string[]).includes(metricRaw)
    ? (metricRaw as TrendMetric)
    : 'clabsi';
  const icu = (icuProp ?? hashParam('icu') ?? 'all') as IcuType;
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const [shared, setShared] = useState(true);
  const { data: env, status } = useDataset('hai', { fixtureFallback });
  const nameIcu = dimNamer(env?.dims?.icuTypes, t.locale);
  const nameM = dimNamer(env?.dims?.metrics, t.locale);
  const nameU = dimNamer(env?.dims?.units, t.locale);

  const model = useMemo(() => {
    if (!env) return null;
    const types = icuTypesFor(env.records, level);
    const panels = types.filter((x) => x !== 'all' || types.length === 1);
    const rows = env.records.filter(
      (r) => r.level === level && r.metric === metric && inYearRange(r.year, years),
    );
    const ys = yearsOf(rows);
    const val = (it: IcuType) => {
      const m = new Map(haiSeries(rows, level, it, metric).map((r) => [r.year, r.value]));
      return ys.map((y) => m.get(y) ?? null);
    };
    const ref = val('all');
    const data = panels.map((p) => ({ icu: p, values: val(p) }));
    const max = Math.max(
      0,
      ...data.flatMap((d) => d.values.filter((v): v is number => v !== null)),
      ...ref.filter((v): v is number => v !== null),
    );
    return { ys, data, ref, max };
  }, [env, level, metric, years]);

  const cols = compact ? 2 : narrow ? 2 : 3;
  const panelH = compact ? 110 : narrow ? 120 : 140;
  const gapY = 46;
  const n = model?.data.length ?? 1;
  const rowsN = Math.ceil(n / cols);
  // phones: the 2-item legend can wrap to two lines (long metric names in zh/ja)
  const head = narrow ? 58 : 34;
  const height = rowsN * (panelH + gapY) + head;

  const option = useMemo<EChartsOption>(() => {
    if (!model) return {};
    const tok = ct.tokens;
    const main = seriesColor(0, ct.theme);
    const grids: Record<string, unknown>[] = [];
    const xAxes: Record<string, unknown>[] = [];
    const yAxes: Record<string, unknown>[] = [];
    const titles: Record<string, unknown>[] = [];
    const series: Record<string, unknown>[] = [];
    const w = 100 / cols;
    const sharedMax = niceMax(model.max, 1000);
    model.data.forEach((d, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const top = head + r * (panelH + gapY);
      const left = `${c * w + 1}%`;
      const focus = d.icu === icu;
      // leave room on the right for the end label
      grids.push({ left, width: `${w - (narrow ? 10 : 7)}%`, top: top + 30, height: panelH - 30, containLabel: true });
      titles.push({
        text: nameIcu(d.icu),
        left,
        top,
        textStyle: { fontSize: 12, fontWeight: focus ? 750 : 600, color: focus ? tok.accent : tok.ink, width: narrow || compact ? 132 : 230, overflow: 'truncate' },
      });
      xAxes.push({
        type: 'category',
        gridIndex: i,
        data: model.ys.map(String),
        boundaryGap: false,
        axisLabel: { fontSize: 10, interval: 'auto' },
      });
      yAxes.push({
        type: 'value',
        gridIndex: i,
        min: 0,
        max: shared ? sharedMax : undefined,
        splitNumber: 2,
        axisLabel: { fontSize: 10, formatter: (v: number) => fmtNumber(v, t.locale) },
      });
      if (d.icu !== 'all')
        series.push({
          type: 'line',
          name: nameIcu('all'),
          xAxisIndex: i,
          yAxisIndex: i,
          data: model.ref,
          showSymbol: false,
          lineStyle: { color: MUTED[ct.theme], width: 1.5 },
          itemStyle: { color: MUTED[ct.theme] },
          silent: true,
          z: 1,
        });
      series.push({
        type: 'line',
        name: nameM(metric),
        xAxisIndex: i,
        yAxisIndex: i,
        data: d.values,
        showSymbol: false,
        symbolSize: 6,
        lineStyle: { color: main, width: focus ? 2.75 : 2 },
        itemStyle: { color: main, borderColor: tok.surface, borderWidth: 2 },
        areaStyle: focus ? { color: main, opacity: 0.1 } : undefined,
        endLabel: {
          show: true,
          formatter: (p: { value: number }) => fmtNumber(p.value, t.locale, { digits: 1 }),
          color: tok.ink2,
          fontSize: 10.5,
          distance: 4,
        },
        z: 2,
      });
    });
    return {
      title: titles,
      legend: { top: 0, left: 0, data: [nameM(metric), nameIcu('all')] },
      tooltip: {
        trigger: 'axis',
        confine: true,
        formatter: (ps: unknown) => {
          const arr = ps as {
            axisIndex: number;
            seriesName: string;
            value: number;
            color: string;
            name: string;
            xAxisIndex?: number;
            componentIndex: number;
          }[];
          if (!arr.length) return '';
          const first = arr[0] as unknown as { axisIndex?: number; xAxisIndex?: number; seriesIndex: number };
          const s = series[first.seriesIndex] as { xAxisIndex: number };
          const d = model.data[s?.xAxisIndex ?? 0];
          return (
            tipTitle(`${d ? nameIcu(d.icu) : ''} · ${arr[0].name}`) +
            arr
              .map((p) => tipRow(p.color, p.seriesName, fmtNumber(p.value, t.locale, { digits: 2 })))
              .join('')
          );
        },
      },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series,
    } as EChartsOption;
  }, [model, ct, cols, panelH, head, narrow, compact, shared, icu, nameIcu, nameM, metric, t]);

  const tableRows = useMemo(() => {
    if (!model) return undefined;
    return model.ys.map((y, i) => {
      const row: Record<string, string | number | null> = { [t('common.year')]: y };
      for (const d of model.data) row[nameIcu(d.icu)] = d.values[i];
      if (!model.data.some((d) => d.icu === 'all')) row[nameIcu('all')] = model.ref[i];
      return row;
    });
  }, [model, t, nameIcu]);

  const title = t('hai.trend.title', { metric: nameM(metric) });
  const subtitle = t('hai.trend.subtitle', {
    level: t(`levels.${level}`),
    unit: nameU(unitKey(env, metric)),
  });
  return (
    <ChartCard
      id="hai-trend"
      title={title}
      subtitle={subtitle}
      source={envSourceLine(env, t.locale)}
      dataset="hai"
      status={status === 'ready' && model && !model.data.length ? 'empty' : status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-hai-trend-${metric}-${level}`}
      link={link}
      embed={{
        chart: 'hai-trend',
        params: { metric, level: level !== 'all' ? level : null, icu: icu !== 'all' ? icu : null },
      }}
      compact={compact}
      height={height}
      actions={
        <div className={k.scrollX}>
          <SegmentedControl<'shared' | 'free'>
            size="sm"
            label={t('hai.trend.yLabel')}
            value={shared ? 'shared' : 'free'}
            onChange={(v) => setShared(v === 'shared')}
            options={[
              { value: 'shared', label: t('hai.trend.sharedY') },
              { value: 'free', label: t('hai.trend.freeY') },
            ]}
          />
        </div>
      }
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${subtitle}`} />
    </ChartCard>
  );
}
