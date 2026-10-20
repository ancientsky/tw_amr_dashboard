import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { resistanceColor, resistanceRamp, textOn } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { useDataset } from '../../data/load';
import { dimNamer, fmtNumber, fmtPct } from '../../data/format';
import { pivotPathogenAntibiotic } from '../../data/select';
import { useT } from '../../i18n';
import { sourceLine, type ChartParams } from './common';

/** Pathogen × antibiotic % resistant matrix for the latest year (semantic heat scale with legend). */
export function ResistanceHeatmap({ level = 'all', ward = 'all', setting = 'all', compact, link, fixtureFallback }: ChartParams) {
  const t = useT();
  const ct = useChartTheme();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status, isFixture } = useDataset('resistance', { fixtureFallback });
  const pv = useMemo(() => (env ? pivotPathogenAntibiotic(env.records, { level, ward, setting, dims: env.dims }) : null), [env, level, ward, setting]);
  const nameP = dimNamer(env?.dims?.pathogens, t.locale);
  const nameA = dimNamer(env?.dims?.antibiotics, t.locale);

  const title = t('charts.resistanceHeatmap.title');
  const subtitle = t('charts.resistanceHeatmap.subtitle', { level: `${t(`levels.${level}`)} · ${t(`wards.${ward}`)}`, year: pv?.year ?? '—' });

  const option = useMemo<EChartsOption>(() => {
    if (!pv) return {};
    const data = pv.cells.map((c) => [pv.antibiotics.indexOf(c.antibiotic), pv.pathogens.indexOf(c.pathogen), c.value, c.isolates]);
    return {
      grid: { left: 4, right: 12, top: 8, bottom: 64, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const v = (p as { value: [number, number, number, number | null] }).value;
          const esc = (x: string) => x.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]!);
          return `<div style="font-weight:700;font-size:15px">${fmtPct(v[2], t.locale)}</div>
            <div style="opacity:.8">${esc(nameP(pv.pathogens[v[1]]))} × ${esc(nameA(pv.antibiotics[v[0]]))}</div>
            ${v[3] ? `<div style="opacity:.6;font-size:11.5px">${esc(t('common.isolates'))}: ${fmtNumber(v[3], t.locale)}</div>` : ''}`;
        },
      },
      xAxis: {
        type: 'category',
        data: pv.antibiotics.map((a) => a),
        position: 'top',
        axisLine: { show: false },
        axisLabel: { interval: 0, fontWeight: 600, color: ct.tokens.ink2 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: pv.pathogens.map((p) => nameP(p)),
        inverse: true,
        axisLine: { show: false },
        axisLabel: { fontStyle: t.locale === 'en' ? 'italic' : 'normal', color: ct.tokens.ink2 },
        splitLine: { show: false },
      },
      visualMap: {
        type: 'continuous',
        min: 0,
        max: 100,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        itemWidth: 12,
        itemHeight: 220,
        text: ['100%', '0%'],
        inRange: { color: resistanceRamp(9, ct.theme) },
        textStyle: { color: ct.tokens.ink3, fontSize: 11 },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: true,
            fontSize: compact ? 10.5 : 11.5,
            fontWeight: 600,
            formatter: (p: unknown) => {
              const v = (p as { value: number[] }).value[2];
              return v >= 10 ? Math.round(v).toString() : v.toFixed(1);
            },
          },
          itemStyle: { borderColor: ct.tokens.surface, borderWidth: 2, borderRadius: 4 },
          emphasis: { itemStyle: { borderColor: ct.tokens.ink, borderWidth: 1.5 } },
        },
      ],
    } as EChartsOption;
  }, [pv, ct.theme, ct.tokens, t, compact, nameP, nameA]);

  // Apply per-cell label colours (textOn) after base option is built.
  const finalOption = useMemo<EChartsOption>(() => {
    if (!pv) return option;
    const series = (option.series as Array<Record<string, unknown>> | undefined)?.[0];
    if (!series) return option;
    const data = (series.data as number[][]).map((d) => ({
      value: d,
      label: { color: textOn(resistanceColor(d[2], ct.theme)) },
    }));
    return { ...option, series: [{ ...series, data }] } as EChartsOption;
  }, [option, pv, ct.theme]);

  const height = pv ? Math.max(260, pv.pathogens.length * (compact ? 30 : 40) + 120) : 340;
  const tableRows = useMemo(
    () =>
      pv?.pathogens.map((p, i) => {
        const row: Record<string, string | number | null> = { [t('common.pathogen')]: nameP(p) };
        pv.antibiotics.forEach((a, j) => (row[a] = pv.matrix[i][j]));
        return row;
      }),
    [pv, t, nameP],
  );

  return (
    <ChartCard
      id="resistance-heatmap"
      title={title}
      subtitle={subtitle}
      source={sourceLine(env, t.locale)}
      provisional={env?.provisional}
      precision={pv?.cells}
      isFixture={isFixture}
      status={status === 'ready' && pv && pv.cells.length === 0 ? 'empty' : status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-heatmap-${level}-${ward}-${pv?.year ?? ''}`}
      link={link}
      embed={{ chart: 'resistance-heatmap', params: { level, ward } }}
      compact={compact}
      height={height}
    >
      <EChart ref={ref} option={finalOption} height={height} ariaLabel={`${title}. ${t('charts.resistanceHeatmap.aria')}`} />
    </ChartCard>
  );
}
