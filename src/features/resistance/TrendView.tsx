import type { EChartsOption } from 'echarts';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { colorMap, LEVEL_ORDER, seriesColor, withAlpha } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { DataTable } from '../../components/ui/DataTable';
import { fmtDelta, fmtPct } from '../../data/format';
import type { YearRange } from '../../data/select';
import { ResistanceTrend } from '../../embed/charts/ResistanceTrend';
import { useT, type TFunction } from '../../i18n';
import { Narrative } from './bits';
import { CoHoGapChart, CO_SLOT, HO_SLOT } from './charts/CoHoGapChart';
import { alignPoints, indexSeries, inRange, isEstimate, summarize, trendPoints, yearSpan, type Point, type TrendIndex } from './lib';
import { resistanceSource, useResistanceModel, type Names } from './model';
import { TREND_BOUNDS, type ExplorerState } from './useExplorerState';
import { useNarrow } from './useNarrow';
import s from './resistance.module.css';

interface Line {
  key: string;
  name: string;
  color: string;
  points: (Point | null)[];
  values: (number | null)[];
  emphasis?: boolean;
  dashed?: boolean;
}

const esc = (x: string) => x.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]!);

/** Narrative auto-summary for one series (first, peak, latest, change). */
export function narrate(t: TFunction, name: string, pts: readonly Point[]): string | null {
  const sm = summarize(pts);
  if (!sm || pts.length < 2) return null;
  const v = {
    name,
    first: fmtPct(sm.first.value, t.locale),
    firstYear: sm.first.year,
    peak: fmtPct(sm.peak.value, t.locale),
    peakYear: sm.peak.year,
    latest: fmtPct(sm.last.value, t.locale),
    latestYear: sm.last.year,
    change: fmtDelta(sm.change, t.locale),
    fromPeak: fmtDelta(sm.fromPeak, t.locale),
  };
  if (sm.peak.year === sm.last.year) return t('resistance.trend.narrativeRising', v);
  if (sm.peak.year === sm.first.year) return t('resistance.trend.narrativeFalling', v);
  return t('resistance.trend.narrativePeak', v);
}

export function TrendView({ state, update, link }: { state: ExplorerState; update: (p: Partial<Record<keyof ExplorerState, unknown>>) => void; link: (extra?: Record<string, string | null>) => string }) {
  const t = useT();
  const { env, trend, names, status, isFixture } = useResistanceModel();
  const multi = state.phenotypes.length > 1;
  return (
    <div className={s.viewStack}>
      {trend && <PhenotypeTrendCard state={state} update={update} trend={trend} names={names} multi={multi} env={env} status={status} isFixture={isFixture} link={link} />}
      {!trend && <ChartCard title={t('resistance.trend.title', { phenotype: state.phenotypes[0] })} status={status} />}
      <CoHoGapChart level={state.level} years={state.years} link={link({ chart: 'resistance-co-ho' })} />
      <ResistanceTrend pathogen={state.pathogen} antibiotic={state.antibiotic} level={state.level === 'all' ? undefined : state.level} link={link({ view: null, chart: 'resistance-trend' })} />
    </div>
  );
}

function PhenotypeTrendCard({
  state,
  update,
  trend,
  names,
  multi,
  env,
  status,
  isFixture,
  link,
}: {
  state: ExplorerState;
  update: (p: Partial<Record<keyof ExplorerState, unknown>>) => void;
  trend: TrendIndex;
  names: Names;
  multi: boolean;
  env: ReturnType<typeof useResistanceModel>['env'];
  status: ReturnType<typeof useResistanceModel>['status'];
  isFixture: boolean;
  link: (extra?: Record<string, string | null>) => string;
}) {
  const t = useT();
  const ct = useChartTheme();
  const ref = useRef<EChartHandle>(null);
  const years = useMemo(() => yearSpan(TREND_BOUNDS[0], TREND_BOUNDS[1]), []);
  const range = state.years;
  const ph = state.phenotypes[0];
  const norm = multi && state.norm;
  const narrow = useNarrow();

  const lines = useMemo<Line[]>(() => {
    const levelColor = colorMap([...LEVEL_ORDER], ct.theme);
    if (!multi) {
      const out: Line[] = state.levels.map((lv) => {
        const pts = alignPoints(trendPoints(trend, ph, lv, state.setting), years);
        return { key: lv, name: names.level(lv), color: levelColor(lv), points: pts, values: pts.map((p) => p?.value ?? null), emphasis: lv === 'all' };
      });
      if (state.overlay && state.setting === 'all') {
        for (const st of ['co', 'ho'] as const) {
          const pts = alignPoints(trendPoints(trend, ph, 'all', st), years);
          out.push({ key: st, name: names.setting(st), color: seriesColor(st === 'co' ? CO_SLOT : HO_SLOT, ct.theme), points: pts, values: pts.map((p) => p?.value ?? null), dashed: true });
        }
      }
      return out;
    }
    return state.phenotypes.map((p, i) => {
      const pts = alignPoints(trendPoints(trend, p, state.level, state.setting), years);
      const inR = pts.map((x) => (x && x.year >= range[0] && x.year <= range[1] ? x.value : null));
      const values = norm ? indexSeries(inR) : pts.map((x) => x?.value ?? null);
      return { key: p, name: p, color: seriesColor(i, ct.theme), points: pts, values, emphasis: false };
    });
  }, [multi, state.levels, state.setting, state.overlay, state.phenotypes, state.level, trend, ph, years, names, ct.theme, norm, range]);

  const startIdx = Math.max(0, years.indexOf(range[0]));
  const endIdx = Math.max(startIdx, years.indexOf(range[1]) < 0 ? years.length - 1 : years.indexOf(range[1]));

  const option = useMemo<EChartsOption>(() => {
    const k = ct.tokens;
    const visible = lines.flatMap((l) => l.values.slice(startIdx, endIdx + 1)).filter((v): v is number => v !== null);
    const vmax = Math.max(0, ...visible);
    const vmin = Math.min(...visible, 100);
    const yMax = norm ? undefined : Math.min(100, Math.max(10, Math.ceil((vmax + 4) / 10) * 10));
    const ciLine = lines.find((l) => l.emphasis);
    const ciSeries =
      ciLine && ciLine.points.some((p) => p?.ci)
        ? [
            { name: '__ci_lo', type: 'line', stack: '__ci', data: ciLine.points.map((p) => p?.ci?.[0] ?? null), lineStyle: { opacity: 0 }, symbol: 'none', silent: true },
            {
              name: '__ci_hi',
              type: 'line',
              stack: '__ci',
              data: ciLine.points.map((p) => (p?.ci ? p.ci[1] - p.ci[0] : null)),
              lineStyle: { opacity: 0 },
              symbol: 'none',
              areaStyle: { color: withAlpha(ciLine.color, 0.16) },
              silent: true,
            },
          ]
        : [];
    return {
      grid: { left: 4, right: 20, top: narrow || lines.length <= 4 ? 44 : 66, bottom: 52, containLabel: true },
      legend: { top: 0, left: 0, type: narrow ? 'scroll' : 'plain', data: lines.map((l) => l.name) },
      tooltip: {
        trigger: 'axis',
        formatter: (raw: unknown) => {
          const arr = (Array.isArray(raw) ? raw : [raw]) as { seriesName: string; dataIndex: number; color: string; value: number | null }[];
          const rows = arr
            .filter((p) => !p.seriesName.startsWith('__') && p.value !== null && p.value !== undefined)
            .sort((a, b) => Number(b.value) - Number(a.value))
            .map((p) => {
              const line = lines.find((l) => l.name === p.seriesName);
              const pt = line?.points[p.dataIndex];
              const val = norm ? `${Number(p.value).toFixed(0)}` : fmtPct(Number(p.value), t.locale);
              const ci = pt?.ci ? ` <span style="opacity:.6">(${fmtPct(pt.ci[0], t.locale)}–${fmtPct(pt.ci[1], t.locale)})</span>` : '';
              const mk = isEstimate(pt) ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:2px solid ${line?.color};margin-right:6px"></span>` : `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${line?.color};margin-right:6px"></span>`;
              return `<div style="display:flex;justify-content:space-between;gap:16px"><span>${mk}${esc(p.seriesName)}</span><b>${val}</b>${ci}</div>`;
            });
          const yr = years[arr[0]?.dataIndex ?? 0];
          return `<div style="font-weight:700;margin-bottom:4px">${yr}</div>${rows.join('')}<div style="opacity:.55;font-size:11px;margin-top:4px">◦ ${esc(t('precision.chart_estimate'))}</div>`;
        },
      },
      xAxis: { type: 'category', data: years.map(String), boundaryGap: false },
      yAxis: norm
        ? { type: 'value', min: Math.max(0, Math.floor((vmin - 10) / 10) * 10), axisLabel: { formatter: '{value}' } }
        : { type: 'value', min: 0, max: yMax, axisLabel: { formatter: '{value}%' } },
      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 0,
          startValue: startIdx,
          endValue: endIdx,
          height: 22,
          bottom: 6,
          brushSelect: false,
          labelFormatter: (_v: number, s: string) => s,
          showDetail: true,
          minValueSpan: 1,
        },
      ],
      series: [
        ...ciSeries,
        ...lines.map((l) => ({
          name: l.name,
          type: 'line',
          data: l.values.map((v, i) => {
            const pt = l.points[i];
            if (v === null) return null;
            return {
              value: v,
              symbol: 'circle',
              symbolSize: l.emphasis ? 9 : 7,
              itemStyle: isEstimate(pt) ? { color: k.surface, borderColor: l.color, borderWidth: 2 } : { color: l.color, borderColor: k.surface, borderWidth: 2 },
            };
          }),
          showSymbol: true,
          connectNulls: false,
          z: l.emphasis ? 5 : 3,
          lineStyle: { width: l.emphasis ? 3 : 2, color: l.color, type: l.dashed ? 'dashed' : 'solid', opacity: l.dashed ? 0.9 : 1 },
          itemStyle: { color: l.color },
          areaStyle: l.emphasis ? { color: withAlpha(l.color, 0.08) } : undefined,
          emphasis: { focus: 'series' },
        })),
      ],
    } as EChartsOption;
  }, [ct.tokens, lines, years, startIdx, endIdx, norm, t, narrow]);

  // Year brush → URL (debounced)
  const timer = useRef<number>();
  const rangeRef = useRef<YearRange>(range);
  rangeRef.current = range;
  const onEvents = useMemo(
    () => ({
      datazoom: () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          const inst = ref.current?.getInstance();
          const dz = (inst?.getOption() as { dataZoom?: { startValue?: number; endValue?: number }[] } | undefined)?.dataZoom?.[0];
          if (!dz || dz.startValue === undefined || dz.endValue === undefined) return;
          const next: YearRange = [years[Math.round(dz.startValue)] ?? years[0], years[Math.round(dz.endValue)] ?? years[years.length - 1]];
          if (next[0] !== rangeRef.current[0] || next[1] !== rangeRef.current[1]) update({ years: next });
        }, 220);
      },
    }),
    [years, update],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tableRows = useMemo(
    () =>
      years
        .map((y, i) => {
          if (y < range[0] || y > range[1]) return null;
          const row: Record<string, string | number | null> = { [t('common.year')]: String(y) };
          for (const l of lines) row[l.name] = l.values[i];
          return row;
        })
        .filter((r): r is Record<string, string | number | null> => r !== null),
    [years, range, lines, t],
  );

  const narrativeLines = useCallback(() => {
    const out: string[] = [];
    const list = multi ? lines : lines.filter((l) => !l.dashed);
    for (const l of list) {
      const pts = inRange(
        l.points.filter((p): p is Point => p !== null),
        range,
      );
      const label = multi ? `${l.name} (${names.level(state.level)})` : `${ph} · ${l.name}`;
      const n = narrate(t, label, pts);
      if (n) out.push(n);
      if (!multi && out.length >= 1 && l.key === 'all') break;
    }
    if (!multi && lines.filter((l) => !l.dashed && l.key !== 'all').length >= 2) {
      const yi = years.indexOf(range[1]);
      const ranked = lines
        .filter((l) => !l.dashed && l.key !== 'all' && l.values[yi] !== null)
        .sort((a, b) => (b.values[yi] ?? 0) - (a.values[yi] ?? 0));
      if (ranked.length >= 2) {
        out.push(
          t('resistance.trend.narrativeLevels', {
            year: range[1],
            high: ranked[0].name,
            highV: fmtPct(ranked[0].values[yi], t.locale),
            low: ranked[ranked.length - 1].name,
            lowV: fmtPct(ranked[ranked.length - 1].values[yi], t.locale),
          }),
        );
      }
    }
    if (!multi && state.setting === 'all') {
      const co = trendPoints(trend, ph, 'all', 'co').find((p) => p.year === range[1]);
      const ho = trendPoints(trend, ph, 'all', 'ho').find((p) => p.year === range[1]);
      if (co && ho) out.push(t('resistance.trend.narrativeCoHo', { phenotype: ph, year: range[1], ho: fmtPct(ho.value, t.locale), co: fmtPct(co.value, t.locale), ratio: (ho.value / Math.max(0.1, co.value)).toFixed(1) }));
    }
    return out;
  }, [multi, lines, range, names, state.level, state.setting, ph, t, years, trend]);

  const title = multi ? t('resistance.trend.compareTitle', { list: state.phenotypes.join(' · ') }) : t('resistance.trend.title', { phenotype: names.phenotype(ph) });
  const subtitle = multi
    ? t(norm ? 'resistance.trend.compareSubtitleNorm' : 'resistance.trend.compareSubtitle', { level: names.level(state.level), setting: names.setting(state.setting), from: range[0] })
    : t('resistance.trend.subtitle', { setting: names.setting(state.setting), from: range[0], to: range[1] });
  const usedPoints = lines.flatMap((l) => l.points.filter((p): p is Point => !!p && p.year >= range[0] && p.year <= range[1]));
  const nat = !multi ? lines.find((l) => l.key === 'all') : undefined;
  const natLast = nat ? [...nat.points].reverse().find((p) => p && p.year <= range[1]) : undefined;
  const sentences = narrativeLines();

  return (
    <>
      <ChartCard
        id="resistance-phenotype-trend"
        title={title}
        subtitle={subtitle}
        source={resistanceSource(env, t.locale)}
        dataset="resistance"
        isFixture={isFixture}
        precision={usedPoints}
        status={status === 'ready' && usedPoints.length === 0 ? 'empty' : status}
        chartRef={ref}
        tableRows={tableRows}
        fileName={`twamr-trend-${state.phenotypes.join('-')}-${state.setting}`.toLowerCase()}
        link={link({ chart: 'resistance-phenotype-trend' })}
        embed={
          !multi
            ? {
                chart: 'resistance-trend',
                params: {
                  pathogen: env?.dims?.phenotypes?.find((d) => d.code === ph)?.meta?.pathogen as string,
                  antibiotic: env?.dims?.phenotypes?.find((d) => d.code === ph)?.meta?.antibiotic as string,
                  setting: state.setting === 'all' ? undefined : state.setting,
                },
              }
            : undefined
        }
        keyNumber={natLast ? { value: fmtPct(natLast.value, t.locale), label: `${ph} · ${names.level('all')} · ${natLast.year}` } : undefined}
        height={420}
      >
        <EChart ref={ref} option={option} height={420} onEvents={onEvents} ariaLabel={`${title}. ${t('resistance.trend.aria')}`} />
      </ChartCard>
      {sentences.length > 0 && (
        <Narrative>
          <h3 className={s.narrativeTitle}>{t('resistance.trend.summary')}</h3>
          <ul>
            {sentences.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Narrative>
      )}
      <div className={s.tableCard}>
        <DataTable rows={tableRows} caption={title} csvName={`twamr-trend-${state.phenotypes.join('-')}`.toLowerCase()} maxHeight={420} />
      </div>
    </>
  );
}
