import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../../components/chart/EChart';
import { seriesColor } from '../../../components/chart/palette';
import { useChartTheme } from '../../../components/chart/useChartTheme';
import { fmtNumber, fmtPct } from '../../../data/format';
import type { OnsetSetting, Specimen } from '../../../data/types';
import type { ChartParams } from '../../../embed/charts/common';
import { useT } from '../../../i18n';
import { pathogenStrata, SPECIMEN_KEYS, type Point } from '../lib';
import { resistanceSource, useResistanceModel } from '../model';
import { CO_SLOT, HO_SLOT } from './CoHoGapChart';

export interface PathogenBarsProps extends ChartParams {
  mode?: 'setting' | 'specimen';
  year?: number;
  /** restrict the specimen chart to all vs this specimen */
  specimen?: Specimen;
  /** emphasised antibiotic row */
  highlight?: string;
  onSelectAntibiotic?: (code: string) => void;
}

const SETTING_SLOT: Record<OnsetSetting, number> = { all: 0, co: CO_SLOT, ho: HO_SLOT };
const esc = (x: string) => x.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]!);

/**
 * % non-susceptible per antibiotic for one pathogen, grouped by onset setting (all/CO/HO)
 * or by specimen, latest year, with CI whiskers where the report prints them.
 * Embed id `resistance-pathogen-bars` (setting mode).
 */
export function PathogenBarsChart({ pathogen = 'KPN', mode = 'setting', year, years, specimen = 'all', highlight, onSelectAntibiotic, compact, link, fixtureFallback }: PathogenBarsProps) {
  const t = useT();
  const ct = useChartTheme();
  const ref = useRef<EChartHandle>(null);
  const { env, status, isFixture, names } = useResistanceModel(fixtureFallback);
  const wantYear = year ?? years?.[1];
  const ps = useMemo(() => (env ? pathogenStrata(env.records, pathogen, wantYear, env.dims) : null), [env, pathogen, wantYear]);

  const strata = useMemo(() => {
    if (!ps) return [] as { key: string; name: string; color: string; points: Map<string, Point> }[];
    if (mode === 'setting') {
      return (['all', 'co', 'ho'] as OnsetSetting[])
        .filter((k) => ps.bySetting.get(k)?.size)
        .map((k) => ({ key: k, name: names.setting(k), color: seriesColor(SETTING_SLOT[k], ct.theme), points: ps.bySetting.get(k)! }));
    }
    return SPECIMEN_KEYS.filter((k) => ps.bySpecimen.get(k)?.size && (specimen === 'all' || k === 'all' || k === specimen)).map((k) => ({
      key: k,
      name: names.specimen(k),
      color: seriesColor(SPECIMEN_KEYS.indexOf(k), ct.theme),
      points: ps.bySpecimen.get(k)!,
    }));
  }, [ps, mode, names, ct.theme, specimen]);

  const antibiotics = useMemo(() => (ps ? ps.antibiotics.filter((a) => strata.some((s) => s.points.has(a))) : []), [ps, strata]);
  const n = strata.length;
  const barH = compact ? 7 : 9;
  const rowH = Math.max(26, n * (barH + 3) + 12);
  const height = Math.max(220, antibiotics.length * rowH + 70);

  const option = useMemo<EChartsOption>(() => {
    const k = ct.tokens;
    return {
      grid: { left: 4, right: 24, top: 34, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, data: strata.map((s) => s.name) },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const { seriesIndex, value } = p as { seriesIndex: number; value: number[] };
          const s = strata[seriesIndex];
          const a = antibiotics[value[0]];
          const pt = s?.points.get(a);
          if (!s || !pt) return '';
          return `<div style="font-weight:700">${esc(names.antibioticLong(a))}</div>
            <div>${esc(s.name)}: <b>${fmtPct(pt.value, t.locale)}</b></div>
            ${pt.ci ? `<div style="opacity:.75">${esc(t('resistance.common.ci'))}: ${fmtPct(pt.ci[0], t.locale)} – ${fmtPct(pt.ci[1], t.locale)}</div>` : ''}
            ${pt.isolates ? `<div style="opacity:.75">${esc(t('common.isolates'))}: ${fmtNumber(pt.isolates, t.locale)}</div>` : ''}
            <div style="opacity:.6;font-size:11px">${esc(t(`precision.${pt.precision}`))}</div>`;
        },
      },
      xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      yAxis: {
        type: 'category',
        inverse: true,
        data: antibiotics.map((a) => names.antibiotic(a)),
        axisLine: { show: false },
        axisLabel: {
          width: compact ? 110 : 150,
          overflow: 'truncate',
          color: k.ink2,
          formatter: (v: string, i: number) => (antibiotics[i] === highlight ? `{hl|${v}}` : v),
          rich: { hl: { fontWeight: 750, color: k.ink } },
        },
        splitLine: { show: false },
      },
      series: strata.map((s, si) => ({
        type: 'custom',
        name: s.name,
        itemStyle: { color: s.color },
        encode: { x: 1, y: 0 },
        data: antibiotics
          .map((a, ai) => {
            const pt = s.points.get(a);
            return pt ? [ai, pt.value, pt.ci?.[0] ?? -1, pt.ci?.[1] ?? -1] : null;
          })
          .filter(Boolean) as number[][],
        renderItem: (_params: unknown, api: unknown) => {
          const a = api as { value: (d: number) => number; coord: (v: number[]) => number[]; size: (v: number[]) => number[] };
          const cat = a.value(0);
          const v = a.value(1);
          const lo = a.value(2);
          const hi = a.value(3);
          const base = a.coord([0, cat]);
          const end = a.coord([v, cat]);
          const off = (si - (n - 1) / 2) * (barH + 3);
          const y = base[1] + off - barH / 2;
          const w = Math.max(1, end[0] - base[0]);
          const dim = highlight && antibiotics[cat] !== highlight;
          const children: unknown[] = [
            {
              type: 'rect',
              shape: { x: base[0], y, width: w, height: barH, r: [0, Math.min(4, barH / 2), Math.min(4, barH / 2), 0] },
              style: { fill: s.color, opacity: dim ? 0.45 : 1 },
            },
          ];
          if (lo >= 0 && hi >= 0) {
            const x0 = a.coord([lo, cat])[0];
            const x1 = a.coord([hi, cat])[0];
            const cy = y + barH / 2;
            const st = { stroke: k.ink, lineWidth: 1.25, opacity: dim ? 0.35 : 0.8 };
            children.push(
              { type: 'line', shape: { x1: x0, y1: cy, x2: x1, y2: cy }, style: st },
              { type: 'line', shape: { x1: x0, y1: cy - 3, x2: x0, y2: cy + 3 }, style: st },
              { type: 'line', shape: { x1: x1, y1: cy - 3, x2: x1, y2: cy + 3 }, style: st },
            );
          }
          return { type: 'group', children };
        },
      })),
    } as EChartsOption;
  }, [ct.tokens, strata, antibiotics, names, t, compact, highlight, n, barH]);

  const onEvents = useMemo(
    () =>
      onSelectAntibiotic
        ? {
            click: (p: unknown) => {
              const v = (p as { value?: number[] }).value;
              if (v && antibiotics[v[0]]) onSelectAntibiotic(antibiotics[v[0]]);
            },
          }
        : undefined,
    [onSelectAntibiotic, antibiotics],
  );

  const tableRows = useMemo(
    () =>
      antibiotics.map((a) => {
        const row: Record<string, string | number | null> = { [t('common.antibiotic')]: names.antibiotic(a), code: a };
        for (const s of strata) {
          const pt = s.points.get(a);
          row[s.name] = pt?.value ?? null;
          if (strata.some((x) => [...x.points.values()].some((q) => q.ci))) {
            row[`${s.name} CI−`] = pt?.ci?.[0] ?? null;
            row[`${s.name} CI+`] = pt?.ci?.[1] ?? null;
          }
        }
        return row;
      }),
    [antibiotics, strata, names, t],
  );

  const pName = names.pathogen(pathogen);
  const title = mode === 'setting' ? t('resistance.pathogen.bySettingTitle', { pathogen: pName }) : t('resistance.pathogen.bySpecimenTitle', { pathogen: pName });
  const subtitle = t('resistance.pathogen.barsSubtitle', { year: ps?.year ?? '—' });
  const allPoints = strata.flatMap((s) => [...s.points.values()]);

  return (
    <ChartCard
      id={mode === 'setting' ? 'resistance-pathogen-bars' : 'resistance-pathogen-specimen'}
      title={title}
      subtitle={subtitle}
      source={resistanceSource(env, t.locale)}
      dataset="resistance"
      isFixture={isFixture}
      precision={allPoints}
      status={status === 'ready' && antibiotics.length === 0 ? 'empty' : status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-${pathogen}-${mode}-${ps?.year ?? ''}`.toLowerCase()}
      link={link && mode === 'setting' && !link.includes('view=') ? `${link}${link.includes('?') ? '&' : '?'}view=pathogen` : link}
      embed={mode === 'setting' ? { chart: 'resistance-pathogen-bars', params: { pathogen } } : undefined}
      compact={compact}
      height={height}
    >
      <EChart ref={ref} option={option} height={height} onEvents={onEvents} ariaLabel={`${title}. ${t('resistance.pathogen.barsAria')}`} />
    </ChartCard>
  );
}
