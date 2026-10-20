import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { seriesColor } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { useDataset } from '../../data/load';
import { dimNamer, fmtNumber } from '../../data/format';
import type { IsolateScope } from '../../data/types';
import { useT } from '../../i18n';
import { isolateTotals, yearSpan } from './lib';
import { resistanceSource } from './model';
import { IsolatesCard } from './PathogenView';
import type { ExplorerState } from './useExplorerState';
import s from './resistance.module.css';

type Update = (p: Partial<Record<keyof ExplorerState, unknown>>) => void;
type LinkFn = (extra?: Record<string, string | null>) => string;

export const ISOLATE_SCOPES: readonly IsolateScope[] = ['all', 'blood', 'urine', 'sputum', 'pus', 'stool', 'co', 'ho'];
const SPECIMEN_GROUP: IsolateScope[] = ['all', 'blood', 'urine', 'sputum', 'pus', 'stool'];
const ONSET_GROUP: IsolateScope[] = ['all', 'co', 'ho'];

/** Localized label of an isolates scope (specimen or onset). */
export function useScopeName() {
  const t = useT();
  return (sc: string) => (sc === 'co' || sc === 'ho' ? t(`settings.${sc}`) : t(`specimens.${sc}`));
}

/** Localized organism namer over isolates.json dims (TOTAL = all organisms). */
export function useOrganismNamer() {
  const t = useT();
  const iso = useDataset('isolates');
  return useMemo(() => {
    const n = dimNamer(iso.data?.dims?.organisms, t.locale);
    return (code: string) => (code === 'TOTAL' ? t('resistance.isolates.allOrganisms') : n(code));
  }, [iso.data, t]);
}

/**
 * Explorer view "isolates" (deep link target of the chatbot's isolate-count answers):
 * isolate counts over time by scope for one organism, the top-10 organisms for the latest
 * year, and the specimen breakdown card from the pathogen view.
 */
export function IsolatesView({ state, update, link }: { state: ExplorerState; update: Update; link: LinkFn }) {
  const orgName = useOrganismNamer();
  return (
    <div className={s.viewStack}>
      <IsolatesScopeTrend state={state} link={link} />
      <IsolatesTop state={state} update={update} link={link} />
      <IsolatesCard pathogen={state.organism} label={orgName(state.organism)} link={link} />
    </div>
  );
}

function IsolatesScopeTrend({ state, link }: { state: ExplorerState; link: LinkFn }) {
  const t = useT();
  const ct = useChartTheme();
  const ref = useRef<EChartHandle>(null);
  const iso = useDataset('isolates');
  const scopeName = useScopeName();
  const orgName = useOrganismNamer();
  const group = state.level !== 'all' || state.scope === 'co' || state.scope === 'ho' ? ONSET_GROUP : SPECIMEN_GROUP;

  const model = useMemo(() => {
    const recs = iso.data?.records ?? [];
    const lines = group
      .map((sc) => ({ scope: sc, rows: isolateTotals(recs, { scope: sc, level: state.level, organism: state.organism }) }))
      .filter((l) => l.rows.length > 0);
    const ys = lines.flatMap((l) => l.rows.map((r) => r.year));
    const years = ys.length ? yearSpan(Math.min(...ys), Math.max(...ys)) : [];
    const series = lines.map((l) => {
      const m = new Map(l.rows.map((r) => [r.year, r.isolates]));
      return { scope: l.scope, data: years.map((y) => m.get(y) ?? null) };
    });
    return { years, series, records: lines.flatMap((l) => l.rows) };
  }, [iso.data, group, state.level, state.organism]);

  const option = useMemo<EChartsOption>(() => {
    const k = ct.tokens;
    return {
      grid: { left: 4, right: 16, top: 44, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, type: 'scroll' },
      tooltip: { trigger: 'axis', valueFormatter: (v) => fmtNumber(v as number, t.locale), order: 'valueDesc' },
      xAxis: { type: 'category', data: model.years.map(String), boundaryGap: false },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => fmtNumber(v, t.locale, { compact: true }) } },
      series: model.series.map((x, i) => {
        const hi = x.scope === state.scope;
        const color = x.scope === 'all' ? k.ink2 : seriesColor(i, ct.theme);
        return {
          name: scopeName(x.scope),
          type: 'line',
          data: x.data,
          symbol: 'circle',
          symbolSize: hi ? 9 : 6,
          showSymbol: true,
          connectNulls: false,
          z: hi ? 5 : 3,
          lineStyle: { width: hi ? 3 : 2, color, opacity: state.scope === 'all' || hi ? 1 : 0.55 },
          itemStyle: { color, borderColor: k.surface, borderWidth: 2 },
          emphasis: { focus: 'series' },
        };
      }),
    } as EChartsOption;
  }, [model, ct.tokens, ct.theme, state.scope, scopeName, t]);

  const tableRows = useMemo(
    () =>
      model.years.map((y, i) => {
        const row: Record<string, string | number | null> = { [t('common.year')]: String(y) };
        for (const x of model.series) row[scopeName(x.scope)] = x.data[i];
        return row;
      }),
    [model, t, scopeName],
  );
  const title = t('resistance.isolates.trendTitle', { organism: orgName(state.organism) });
  const sel = model.series.find((x) => x.scope === state.scope) ?? model.series[0];
  const lastIdx = sel ? sel.data.length - 1 : -1;
  const last = sel && lastIdx >= 0 ? sel.data[lastIdx] : null;
  return (
    <ChartCard
      id="resistance-isolates-trend"
      title={title}
      subtitle={t('resistance.isolates.trendSubtitle', { level: t(`levels.${state.level}`), group: t(group === ONSET_GROUP ? 'resistance.isolates.byOnset' : 'resistance.isolates.bySpecimen') })}
      source={resistanceSource(iso.data, t.locale)}
      dataset="isolates"
      precision={model.records}
      status={iso.status === 'ready' && model.years.length === 0 ? 'empty' : iso.status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-isolates-${state.organism}-${state.level}`.toLowerCase()}
      link={link({ chart: 'resistance-isolates-trend' })}
      keyNumber={last !== null && sel ? { value: fmtNumber(last, t.locale), label: `${orgName(state.organism)} · ${scopeName(sel.scope)} · ${model.years[lastIdx]}` } : undefined}
      height={360}
    >
      <EChart ref={ref} option={option} height={360} ariaLabel={`${title}. ${t('resistance.isolates.trendAria')}`} />
    </ChartCard>
  );
}

function IsolatesTop({ state, update, link }: { state: ExplorerState; update: Update; link: LinkFn }) {
  const t = useT();
  const ct = useChartTheme();
  const ref = useRef<EChartHandle>(null);
  const iso = useDataset('isolates');
  const scopeName = useScopeName();
  const orgName = useOrganismNamer();

  const model = useMemo(() => {
    const all = isolateTotals(iso.data?.records ?? [], { scope: state.scope, level: state.level }).filter((r) => r.organism !== 'TOTAL' && r.organism !== 'OTHER');
    const years = [...new Set(all.map((r) => r.year))].sort((a, b) => a - b);
    const year = state.year && years.includes(state.year) ? state.year : years[years.length - 1];
    const rows = all
      .filter((r) => r.year === year)
      .sort((a, b) => b.isolates - a.isolates)
      .slice(0, 10);
    return { year, rows };
  }, [iso.data, state.scope, state.level, state.year]);

  const option = useMemo<EChartsOption>(() => {
    const k = ct.tokens;
    const accent = seriesColor(0, ct.theme);
    return {
      grid: { left: 4, right: 56, top: 8, bottom: 4, containLabel: true },
      tooltip: { trigger: 'item', valueFormatter: (v) => fmtNumber(v as number, t.locale) },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => fmtNumber(v, t.locale, { compact: true }) } },
      yAxis: { type: 'category', inverse: true, data: model.rows.map((r) => orgName(r.organism)), axisLabel: { width: 130, overflow: 'truncate' } },
      series: [
        {
          type: 'bar',
          name: t('common.isolates'),
          barMaxWidth: 22,
          cursor: 'pointer',
          data: model.rows.map((r) => ({
            value: r.isolates,
            itemStyle: { color: r.organism === state.organism ? accent : k.ink3, borderRadius: [0, 4, 4, 0] },
          })),
          label: { show: true, position: 'right', formatter: (p: { value: unknown }) => fmtNumber(Number(p.value), t.locale, { compact: true }), color: k.ink2, fontSize: 11 },
        },
      ],
    } as EChartsOption;
  }, [model, ct.tokens, ct.theme, state.organism, orgName, t]);

  const onEvents = useMemo(
    () => ({
      click: (p: unknown) => {
        const i = (p as { dataIndex?: number }).dataIndex;
        const r = i !== undefined ? model.rows[i] : undefined;
        if (r) update({ organism: r.organism });
      },
    }),
    [model, update],
  );

  const tableRows = useMemo(() => model.rows.map((r, i) => ({ '#': i + 1, [t('common.pathogen')]: orgName(r.organism), [t('common.isolates')]: r.isolates })), [model, orgName, t]);
  const title = t('resistance.isolates.topTitle', { year: model.year ?? '—' });
  const height = Math.max(240, model.rows.length * 30 + 30);
  return (
    <ChartCard
      id="resistance-isolates-top"
      title={title}
      subtitle={t('resistance.isolates.topSubtitle', { scope: scopeName(state.scope), level: t(`levels.${state.level}`) })}
      source={resistanceSource(iso.data, t.locale)}
      dataset="isolates"
      precision={model.rows}
      status={iso.status === 'ready' && model.rows.length === 0 ? 'empty' : iso.status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-isolates-top-${state.scope}-${state.level}-${model.year ?? ''}`.toLowerCase()}
      link={link({ chart: 'resistance-isolates-top' })}
      height={height}
    >
      <EChart ref={ref} option={option} height={height} onEvents={onEvents} ariaLabel={`${title}. ${t('resistance.isolates.topAria')}`} />
    </ChartCard>
  );
}
