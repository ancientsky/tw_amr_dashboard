import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { MUTED, seriesColor, withAlpha } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { Badge } from '../../components/ui/Badge';
import { useDataset } from '../../data/load';
import { fmtDelta, fmtNumber, fmtPct } from '../../data/format';
import type { IsolateScope, Specimen, WhoPriority } from '../../data/types';
import { useT } from '../../i18n';
import { dumbbellOption, type DumbbellRow } from './charts/dumbbell';
import { PathogenBarsChart } from './charts/PathogenBarsChart';
import { antibiogramYears, isolateTotals, orderAntibiotics, PATHOGEN_TO_ISOLATE, pathogenStrata, SPECIMEN_SLOT, toPoint, yearSpan } from './lib';
import { resistanceSource, useResistanceModel } from './model';
import type { ExplorerState } from './useExplorerState';
import s from './resistance.module.css';

type Update = (p: Partial<Record<keyof ExplorerState, unknown>>) => void;
const esc = (x: string) => x.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]!);
const SPECIMEN_SCOPES: IsolateScope[] = ['blood', 'urine', 'sputum', 'pus', 'stool'];

export function PathogenView({ state, update, link }: { state: ExplorerState; update: Update; link: (extra?: Record<string, string | null>) => string }) {
  const t = useT();
  const { env, names } = useResistanceModel();
  const dim = env?.dims?.pathogens?.find((d) => d.code === state.pathogen);
  const pr = dim?.meta?.whoPriority as WhoPriority | null | undefined;
  const strata = useMemo(() => (env ? pathogenStrata(env.records, state.pathogen, state.year, env.dims) : null), [env, state.pathogen, state.year]);
  const hasSpecimen = (strata?.bySpecimen.size ?? 0) > 1;
  const gram = String(dim?.meta?.gram ?? '').startsWith('neg') ? 'G−' : 'G+';

  return (
    <div className={s.viewStack}>
      <div className={s.pathogenHead}>
        <h2 className={s.pathogenName}>{names.pathogen(state.pathogen)}</h2>
        <div className={s.badgeRow}>
          <Badge>{gram}</Badge>
          {pr && <Badge tone={pr === 'critical' ? 'danger' : pr === 'high' ? 'warn' : 'info'}>{t('resistance.pathogen.who', { p: t(`resistance.priority.${pr}`) })}</Badge>}
          {typeof dim?.meta?.keyPhenotype === 'string' && <Badge tone="accent">{dim.meta.keyPhenotype as string}</Badge>}
        </div>
      </div>
      <PathogenBarsChart
        pathogen={state.pathogen}
        mode="setting"
        year={state.year}
        highlight={state.antibiotic}
        onSelectAntibiotic={(a) => update({ antibiotic: a })}
        link={link({ chart: 'resistance-pathogen-bars' })}
      />
      {hasSpecimen && (
        <PathogenBarsChart
          pathogen={state.pathogen}
          mode="specimen"
          year={state.year}
          specimen={state.specimen}
          highlight={state.antibiotic}
          onSelectAntibiotic={(a) => update({ antibiotic: a })}
          link={link({ chart: 'resistance-pathogen-specimen' })}
        />
      )}
      <div className={s.twoCol}>
        <SlopeCard state={state} link={link} />
        <IsolatesCard pathogen={state.pathogen} link={link} />
      </div>
    </div>
  );
}

/** 3-year antibiogram change per antibiotic (2022 → 2024) as arrows. */
function SlopeCard({ state, link }: { state: ExplorerState; link: (extra?: Record<string, string | null>) => string }) {
  const t = useT();
  const ct = useChartTheme();
  const ref = useRef<EChartHandle>(null);
  const { env, ab, names, status, isFixture } = useResistanceModel();
  const years = useMemo(() => (ab ? antibiogramYears(ab) : []), [ab]);
  const y0 = years[0];
  const y1 = years[years.length - 1];
  const ym = years.length > 2 ? years[1] : undefined;

  const rows = useMemo<DumbbellRow[]>(() => {
    if (!ab || !env || y0 === undefined || y1 === undefined || y0 === y1) return [];
    const codes = orderAntibiotics(
      [...new Set([...ab.values()].filter((r) => r.pathogen === state.pathogen && r.level === state.level).map((r) => r.antibiotic))],
      env.dims,
    );
    const get = (y: number, a: string) => ab.get(`${y}|${state.level}|${state.pathogen}|${a}`);
    return codes
      .map((a) => {
        const r0 = get(y0, a);
        const r1 = get(y1, a);
        if (!r0 || !r1) return null;
        const rm = ym !== undefined ? get(ym, a) : undefined;
        const d = Math.round((r1.resistant_pct - r0.resistant_pct) * 10) / 10;
        const stroke = d >= 2 ? ct.tokens.danger : d <= -2 ? ct.tokens.accent : ct.tokens.ink3;
        return { key: a, label: a === state.antibiotic ? `▸ ${a}` : a, a: toPoint(r0), b: toPoint(r1), mid: rm ? toPoint(rm) : undefined, note: `${fmtDelta(d, t.locale)}`, stroke } as DumbbellRow;
      })
      .filter((x): x is DumbbellRow => x !== null);
  }, [ab, env, y0, y1, ym, state.pathogen, state.level, state.antibiotic, ct.tokens, t.locale]);

  const option = useMemo(
    () =>
      dumbbellOption({
        rows,
        colorA: MUTED[ct.theme],
        colorMid: withAlpha(seriesColor(0, ct.theme), 0.6),
        colorB: seriesColor(0, ct.theme),
        nameA: String(y0 ?? ''),
        nameMid: ym !== undefined ? String(ym) : undefined,
        nameB: String(y1 ?? ''),
        tokens: ct.tokens,
        fmt: (v) => fmtPct(v, t.locale, 0),
        arrow: true,
        max: 100,
        noteWidth: 56,
        labelWidth: 60,
        compact: true,
        tooltip: (r) =>
          `<div style="font-weight:700">${esc(names.antibioticLong(r.key))}</div>
           <div>${y0}: <b>${fmtPct(r.a.value, t.locale)}</b> (n=${fmtNumber(r.a.isolates, t.locale)})</div>
           ${r.mid ? `<div>${ym}: <b>${fmtPct(r.mid.value, t.locale)}</b> (n=${fmtNumber(r.mid.isolates, t.locale)})</div>` : ''}
           <div>${y1}: <b>${fmtPct(r.b.value, t.locale)}</b> (n=${fmtNumber(r.b.isolates, t.locale)})</div>
           <div style="margin-top:4px">Δ ${esc(r.note ?? '')} ${esc(t('kpi.pp'))}</div>`,
      }),
    [rows, ct.theme, ct.tokens, y0, y1, ym, t, names],
  );
  // Only the end labels for the 2024 marker would collide on short arrows — keep labels off and rely on the note column + tooltip.
  const cleanOption = useMemo<EChartsOption>(() => {
    const series = (option.series as Record<string, unknown>[]).map((x) => (x.type === 'scatter' ? { ...x, data: (x.data as Record<string, unknown>[]).map((d) => ({ ...d, label: { show: false } })) } : x));
    return { ...option, series } as EChartsOption;
  }, [option]);

  const height = Math.max(240, rows.length * 26 + 60);
  const title = t('resistance.pathogen.slopeTitle', { from: y0 ?? '', to: y1 ?? '' });
  const tableRows = rows.map((r) => ({
    [t('common.antibiotic')]: names.antibiotic(r.key),
    code: r.key,
    [String(y0)]: r.a.value,
    ...(ym !== undefined ? { [String(ym)]: r.mid?.value ?? null } : {}),
    [String(y1)]: r.b.value,
    [`Δ (${t('kpi.pp')})`]: Math.round((r.b.value - r.a.value) * 10) / 10,
  }));
  const riser = [...rows].sort((a, b) => b.b.value - b.a.value - (a.b.value - a.a.value))[0];

  return (
    <ChartCard
      id="resistance-pathogen-slope"
      title={title}
      subtitle={t('resistance.pathogen.slopeSubtitle', { pathogen: names.pathogen(state.pathogen), level: names.level(state.level) })}
      source={resistanceSource(env, t.locale)}
      dataset="resistance"
      isFixture={isFixture}
      precision="table"
      status={status === 'ready' && rows.length === 0 ? 'empty' : status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-${state.pathogen}-antibiogram-${y0}-${y1}`.toLowerCase()}
      link={link({ chart: 'resistance-pathogen-slope' })}
      keyNumber={riser ? { value: `${fmtDelta(riser.b.value - riser.a.value, t.locale)} ${t('kpi.pp')}`, label: `${names.pathogenShort(state.pathogen)} × ${riser.key}, ${y0}→${y1}` } : undefined}
      height={height}
    >
      <EChart ref={ref} option={cleanOption} height={height} ariaLabel={`${title}. ${t('resistance.pathogen.slopeAria')}`} />
    </ChartCard>
  );
}

/** Isolate counts over time: specimen breakdown (stacked) with the all-specimen total. */
function IsolatesCard({ pathogen, link }: { pathogen: string; link: (extra?: Record<string, string | null>) => string }) {
  const t = useT();
  const ct = useChartTheme();
  const ref = useRef<EChartHandle>(null);
  const iso = useDataset('isolates');
  const { names } = useResistanceModel();
  const org = PATHOGEN_TO_ISOLATE[pathogen] ?? pathogen;
  const model = useMemo(() => {
    const recs = iso.data?.records ?? [];
    const total = isolateTotals(recs, { scope: 'all', organism: org });
    const years = total.length ? yearSpan(total[0].year, total[total.length - 1].year) : [];
    const byScope = SPECIMEN_SCOPES.map((sc) => {
      const rows = isolateTotals(recs, { scope: sc, organism: org });
      const m = new Map(rows.map((r) => [r.year, r.isolates]));
      return { scope: sc, data: years.map((y) => m.get(y) ?? null) };
    }).filter((x) => x.data.some((v) => v !== null));
    const tm = new Map(total.map((r) => [r.year, r.isolates]));
    const totalData = years.map((y) => tm.get(y) ?? null);
    const other = years.map((_, i) => {
      const tot = totalData[i];
      if (tot === null || byScope.some((b) => b.data[i] === null)) return null;
      return Math.max(0, tot - byScope.reduce((a, b) => a + (b.data[i] ?? 0), 0));
    });
    return { years, byScope, totalData, other, precision: total };
  }, [iso.data, org]);

  const option = useMemo<EChartsOption>(() => {
    const k = ct.tokens;
    const stackable = model.byScope.length > 0 && model.other.some((v) => v !== null);
    return {
      grid: { left: 4, right: 16, top: 56, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0 },
      tooltip: { trigger: 'axis', valueFormatter: (v) => fmtNumber(v as number, t.locale) },
      xAxis: { type: 'category', data: model.years.map(String), boundaryGap: stackable },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => fmtNumber(v, t.locale, { compact: true }) } },
      series: [
        ...(stackable
          ? [
              ...model.byScope.map((b) => ({
                name: names.specimen(b.scope),
                type: 'bar',
                stack: 'spec',
                data: b.data,
                barMaxWidth: 28,
                itemStyle: { color: seriesColor(SPECIMEN_SLOT[b.scope as Specimen], ct.theme), borderColor: k.surface, borderWidth: 1, borderRadius: 0 },
              })),
              {
                name: t('resistance.pathogen.otherSpecimens'),
                type: 'bar',
                stack: 'spec',
                data: model.other,
                barMaxWidth: 28,
                itemStyle: { color: MUTED[ct.theme], borderColor: k.surface, borderWidth: 1, borderRadius: [4, 4, 0, 0] },
              },
            ]
          : []),
        {
          name: names.specimen('all'),
          type: 'line',
          data: model.totalData,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: true,
          z: 5,
          lineStyle: { width: 2, color: k.ink2 },
          itemStyle: { color: k.ink2, borderColor: k.surface, borderWidth: 2 },
        },
      ],
    } as EChartsOption;
  }, [model, ct.tokens, ct.theme, names, t]);

  const tableRows = model.years.map((y, i) => {
    const row: Record<string, string | number | null> = { [t('common.year')]: String(y), [names.specimen('all')]: model.totalData[i] };
    for (const b of model.byScope) row[names.specimen(b.scope)] = b.data[i];
    return row;
  });
  const title = t('resistance.pathogen.isolatesTitle', { pathogen: names.pathogenShort(pathogen) });
  const last = model.totalData[model.totalData.length - 1];
  return (
    <ChartCard
      id="resistance-pathogen-isolates"
      title={title}
      subtitle={t('resistance.pathogen.isolatesSubtitle')}
      source={resistanceSource(iso.data, t.locale)}
      dataset="isolates"
      precision={model.precision}
      status={iso.status === 'ready' && model.years.length === 0 ? 'empty' : iso.status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-${pathogen}-isolates`.toLowerCase()}
      link={link({ chart: 'resistance-pathogen-isolates' })}
      keyNumber={last ? { value: fmtNumber(last, t.locale), label: `${names.pathogenShort(pathogen)} · ${model.years[model.years.length - 1]}` } : undefined}
      height={340}
    >
      <EChart ref={ref} option={option} height={340} ariaLabel={`${title}. ${t('resistance.pathogen.isolatesAria')}`} />
    </ChartCard>
  );
}

