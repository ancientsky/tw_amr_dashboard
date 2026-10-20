/** Inline mini chart for an answer (line trend / vertical bars / horizontal bars) via the shared EChart. */
import type { EChartsOption } from 'echarts';
import { useMemo } from 'react';
import { EChart } from '../../../components/chart/EChart';
import { MUTED, withAlpha } from '../../../components/chart/palette';
import { useChartTheme } from '../../../components/chart/useChartTheme';
import { fmtNumber, fmtPct } from '../../../data/format';
import { useT } from '../../../i18n';
import type { MiniChartSpec } from '../engine/types';
import s from './chat.module.css';

export function MiniChart({ spec }: { spec: MiniChartSpec }) {
  const t = useT();
  const { palette, tokens, theme } = useChartTheme();
  const locale = t.locale;
  const fmt = (v: number | null | undefined) => (spec.unit === 'pct' ? fmtPct(v, locale) : fmtNumber(v, locale, { compact: true }));
  const fmtFull = (v: number | null | undefined) => (spec.unit === 'pct' ? fmtPct(v, locale) : fmtNumber(v, locale));
  const multi = spec.series.length > 1;

  const option = useMemo<EChartsOption>(() => {
    const axisFmt = (v: number) => (spec.unit === 'pct' ? `${v}%` : fmtNumber(v, locale, { compact: true }));
    const tooltip: EChartsOption['tooltip'] = {
      trigger: spec.kind === 'line' ? 'axis' : 'item',
      confine: true,
      valueFormatter: (v) => fmtFull(typeof v === 'number' ? v : null),
    };
    const legend: EChartsOption['legend'] = multi ? { top: 0, left: 0, itemGap: 10, textStyle: { fontSize: 11 } } : { show: false };
    if (spec.kind === 'line') {
      return {
        grid: { left: 4, right: 12, top: multi ? 30 : 12, bottom: 4, containLabel: true },
        tooltip,
        legend,
        xAxis: { type: 'category', data: spec.categories.map(String), boundaryGap: false, axisLabel: { fontSize: 10.5 } },
        yAxis: { type: 'value', axisLabel: { formatter: axisFmt, fontSize: 10.5 }, splitNumber: 3, scale: spec.unit === 'count' },
        series: spec.series.map((se, i) => ({
          type: 'line',
          name: se.name,
          data: se.data,
          connectNulls: true,
          showSymbol: spec.categories.length <= 8,
          symbolSize: 7,
          color: palette[i] ?? MUTED[theme],
          lineStyle: { width: 2 },
          endLabel: !multi ? { show: true, formatter: (p: { value: unknown }) => fmt(p.value as number), fontSize: 11, color: tokens.ink2 } : undefined,
        })),
      };
    }
    const horizontal = spec.kind === 'hbar';
    const cats = spec.categories.map(String);
    const valueAxis = { type: 'value' as const, axisLabel: { formatter: axisFmt, fontSize: 10.5 }, splitNumber: 3 };
    const catAxis = { type: 'category' as const, data: cats, inverse: horizontal, axisLabel: { fontSize: 10.5, width: horizontal ? 110 : 64, overflow: 'truncate' as const, interval: 0 } };
    return {
      grid: { left: 4, right: horizontal ? 48 : 8, top: multi ? 30 : 16, bottom: 4, containLabel: true },
      tooltip: { ...tooltip, trigger: multi ? 'axis' : 'item', axisPointer: { type: 'shadow' } },
      legend,
      xAxis: horizontal ? valueAxis : catAxis,
      yAxis: horizontal ? catAxis : valueAxis,
      series: spec.series.map((se, si) => ({
        type: 'bar',
        name: se.name,
        barMaxWidth: horizontal ? 14 : 28,
        barGap: '20%',
        data: se.data.map((v, i) => ({
          value: v,
          itemStyle: {
            color: multi ? palette[si] : spec.highlight === undefined || spec.highlight === i ? palette[0] : withAlpha(palette[0], 0.45),
            borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
          },
        })),
        label: { show: !multi, position: horizontal ? 'right' : 'top', formatter: (p: { value: unknown }) => fmt(p.value as number), fontSize: 10.5, color: tokens.ink2 },
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, palette, tokens, theme, locale]);

  const height = spec.kind === 'hbar' ? Math.max(150, spec.categories.length * 24 + (multi ? 44 : 24)) : 176;
  const summary = `${spec.title}: ${spec.categories
    .map((c, i) => `${c} ${spec.series.map((se) => `${multi ? `${se.name} ` : ''}${fmtFull(se.data[i])}`).join(', ')}`)
    .join('; ')}`;

  return (
    <figure className={s.chart}>
      <figcaption className={s.chartTitle}>{spec.title}</figcaption>
      <EChart option={option} ariaLabel={summary} height={height} />
      {spec.note && <p className={s.chartNote}>{spec.note}</p>}
      <table className="sr-only">
        <caption>{spec.title}</caption>
        <thead>
          <tr>
            <th scope="col">{t('common.year')}</th>
            {spec.series.map((se) => (
              <th key={se.name} scope="col">
                {se.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.categories.map((c, i) => (
            <tr key={String(c)}>
              <th scope="row">{c}</th>
              {spec.series.map((se) => (
                <td key={se.name}>{fmtFull(se.data[i])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default MiniChart;
