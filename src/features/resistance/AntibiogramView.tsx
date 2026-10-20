import { useMemo } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { mix, RESISTANCE_STOPS, resistanceColor, resistanceRamp, seriesColor } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { Select } from '../../components/ui/Select';
import { fmtDelta, fmtNumber, fmtPct } from '../../data/format';
import type { Level } from '../../data/types';
import { useT } from '../../i18n';
import { HeatGrid, HeatLegend, type HeatCell } from './HeatGrid';
import { antibiogramMatrix, antibiogramYears, classOf, classRuns, LEVEL_KEYS, mean, orderAntibiotics, type AbMatrix, type AntibiogramIndex } from './lib';
import { resistanceSource, useResistanceModel, type Names } from './model';
import type { ColSort, ExplorerState, RowSort } from './useExplorerState';
import s from './resistance.module.css';

type Update = (p: Partial<Record<keyof ExplorerState, unknown>>) => void;

function sortRows(codes: string[], how: RowSort, names: Names, meanOf: (p: string) => number | null, locale: string): string[] {
  if (how === 'name') return [...codes].sort((a, b) => names.pathogen(a).localeCompare(names.pathogen(b), locale));
  if (how === 'mean') return [...codes].sort((a, b) => (meanOf(b) ?? -1) - (meanOf(a) ?? -1));
  return codes;
}
function sortCols(codes: string[], how: ColSort, meanOf: (a: string) => number | null): string[] {
  if (how === 'name') return [...codes].sort();
  if (how === 'mean') return [...codes].sort((a, b) => (meanOf(b) ?? -1) - (meanOf(a) ?? -1));
  return codes;
}

/** Union matrix axes across several levels so small multiples align. */
function unionAxes(ab: AntibiogramIndex, year: number, levels: readonly Level[], dims: Parameters<typeof antibiogramMatrix>[3]) {
  const ms = levels.map((l) => antibiogramMatrix(ab, year, l, dims));
  const ps = new Set(ms.flatMap((m) => m.pathogens));
  const as = new Set(ms.flatMap((m) => m.antibiotics));
  const allP = antibiogramMatrix(ab, year, 'all', dims).pathogens;
  const pathogens = [...allP.filter((p) => ps.has(p)), ...[...ps].filter((p) => !allP.includes(p))];
  return { ms, pathogens, antibiotics: orderAntibiotics([...as], dims) };
}

export function AntibiogramView({ state, update, link }: { state: ExplorerState; update: Update; link: (extra?: Record<string, string | null>) => string }) {
  const t = useT();
  const ct = useChartTheme();
  const { env, ab, names, status, isFixture } = useResistanceModel();
  const years = useMemo(() => (ab ? antibiogramYears(ab) : []), [ab]);
  const year = state.year && years.includes(state.year) ? state.year : years[years.length - 1];
  const dims = env?.dims;
  const narrowCells = typeof window !== 'undefined' && window.innerWidth < 640;
  const cellSize = narrowCells ? 26 : 30;

  const levels: Level[] = state.cmp === 'grid' ? [...LEVEL_KEYS] : state.cmp === 'diff' ? ['medical_center', 'district'] : [state.level];
  const axes = useMemo(() => (ab && year ? unionAxes(ab, year, levels, dims) : null), [ab, year, levels.join(','), dims]); // eslint-disable-line react-hooks/exhaustive-deps

  // value accessors
  const valueOf = useMemo(() => {
    if (!axes) return () => null as number | null;
    if (state.cmp === 'diff') {
      const [mc, dh] = axes.ms;
      return (p: string, a: string): number | null => {
        const x = mc.get(p, a);
        const y = dh.get(p, a);
        return x && y ? Math.round((x.resistant_pct - y.resistant_pct) * 10) / 10 : null;
      };
    }
    const m = axes.ms[0];
    return (p: string, a: string): number | null => m.get(p, a)?.resistant_pct ?? null;
  }, [axes, state.cmp]);

  const sorted = useMemo(() => {
    if (!axes) return { rows: [] as string[], cols: [] as string[] };
    let ps = axes.pathogens;
    let as = axes.antibiotics;
    if (state.cmp === 'diff') {
      ps = ps.filter((p) => as.some((a) => valueOf(p, a) !== null));
      as = as.filter((a) => ps.some((p) => valueOf(p, a) !== null));
    }
    const rowMean = (p: string) => mean(as.map((a) => valueOf(p, a)));
    const colMean = (a: string) => mean(ps.map((p) => valueOf(p, a)));
    return { rows: sortRows(ps, state.sort, names, rowMean, t.locale), cols: sortCols(as, state.csort, colMean) };
  }, [axes, state.cmp, state.sort, state.csort, valueOf, names, t.locale]);

  const groups = useMemo(
    () => (state.csort === 'class' ? classRuns(sorted.cols, dims).map((r) => ({ label: names.antibioticClass(r.cls), span: r.span })) : undefined),
    [state.csort, sorted.cols, dims, names],
  );

  const diffColor = useMemo(() => {
    const neutral = ct.theme === 'dark' ? '#2b3b33' : '#e4e9e6';
    const neg = seriesColor(1, ct.theme);
    const pos = RESISTANCE_STOPS[ct.theme][2];
    return (d: number) => (d < 0 ? mix(neutral, neg, Math.min(1, -d / 30)) : mix(neutral, pos, Math.min(1, d / 30)));
  }, [ct.theme]);
  const heatColor = useMemo(() => (v: number) => resistanceColor(v, ct.theme), [ct.theme]);

  const rowsMeta = sorted.rows.map((p) => ({ code: p, label: names.pathogenShort(p), title: names.pathogen(p), italic: t.locale === 'en' && !/spp\.|^Group|complex|^NTS|Entero/.test(names.pathogenShort(p)) }));
  const colsMeta = sorted.cols.map((a) => ({ code: a, label: a, title: `${names.antibiotic(a)} · ${names.antibioticClass(classOf(dims, a))}` }));

  const open = (p: string, a: string) => update({ view: 'pathogen', pathogen: p, antibiotic: a, year });

  const tip = (m: AbMatrix) => (p: string, a: string) => {
    const r = m.get(p, a);
    return (
      <>
        <div className={s.tipValue}>{fmtPct(r?.resistant_pct, t.locale)}</div>
        <div>
          <i>{names.pathogen(p)}</i> × {names.antibioticLong(a)}
        </div>
        <div className={s.tipMuted}>
          {names.antibioticClass(classOf(dims, a))} · {t('common.isolates')}: {fmtNumber(r?.isolates, t.locale)}
        </div>
        <div className={s.tipMuted}>{t('resistance.antibiogram.clickHint')}</div>
      </>
    );
  };
  const diffTip = (p: string, a: string, c: HeatCell) => {
    const [mc, dh] = axes!.ms;
    return (
      <>
        <div className={s.tipValue}>
          {fmtDelta(c.value, t.locale)} {t('kpi.pp')}
        </div>
        <div>
          <i>{names.pathogen(p)}</i> × {names.antibioticLong(a)}
        </div>
        <div className={s.tipMuted}>
          {names.level('medical_center')}: {fmtPct(mc.get(p, a)?.resistant_pct, t.locale)} (n={fmtNumber(mc.get(p, a)?.isolates, t.locale)})
        </div>
        <div className={s.tipMuted}>
          {names.level('district')}: {fmtPct(dh.get(p, a)?.resistant_pct, t.locale)} (n={fmtNumber(dh.get(p, a)?.isolates, t.locale)})
        </div>
      </>
    );
  };

  const pivotRows = (m: AbMatrix | ((p: string, a: string) => number | null)) =>
    sorted.rows.map((p) => {
      const row: Record<string, string | number | null> = { [t('common.pathogen')]: names.pathogen(p), code: p };
      for (const a of sorted.cols) row[a] = typeof m === 'function' ? m(p, a) : (m.get(p, a)?.resistant_pct ?? null);
      return row;
    });

  const sortActions = (
    <div className={s.cardControls}>
      <Select
        label={t('resistance.antibiogram.sortRows')}
        showLabel
        value={state.sort}
        onChange={(v) => update({ sort: v })}
        options={[
          { value: 'order', label: t('resistance.antibiogram.sortOrder') },
          { value: 'name', label: t('resistance.antibiogram.sortName') },
          { value: 'mean', label: t('resistance.antibiogram.sortMean') },
        ]}
      />
      <Select
        label={t('resistance.antibiogram.sortCols')}
        showLabel
        value={state.csort}
        onChange={(v) => update({ csort: v })}
        options={[
          { value: 'class', label: t('resistance.antibiogram.sortClass') },
          { value: 'name', label: t('resistance.antibiogram.sortName') },
          { value: 'mean', label: t('resistance.antibiogram.sortMean') },
        ]}
      />
    </div>
  );
  const legend = <HeatLegend title={t('resistance.antibiogram.legend')} stops={resistanceRamp(9, ct.theme)} labels={['0%', '25%', '50%', '75%', '100%']} />;
  const source = resistanceSource(env, t.locale);
  const common = { source, dataset: 'resistance' as const, isFixture, precision: 'table' as const, height: 480 };
  const empty = status === 'ready' && sorted.rows.length === 0;

  if (state.cmp === 'diff' && axes) {
    const title = t('resistance.antibiogram.diffTitle');
    return (
      <div className={s.viewStack}>
        <ChartCard
          id="resistance-antibiogram-diff"
          title={title}
          subtitle={t('resistance.antibiogram.diffSubtitle', { year: year ?? '—' })}
          {...common}
          status={empty ? 'empty' : status}
          actions={sortActions}
          tableRows={pivotRows(valueOf)}
          fileName={`twamr-antibiogram-diff-mc-district-${year}`}
          link={link({ chart: 'resistance-antibiogram-diff' })}
        >
          <HeatGrid
            rows={rowsMeta}
            cols={colsMeta}
            groups={groups}
            cell={(p, a) => {
              const v = valueOf(p, a);
              return v === null ? undefined : { value: v, display: v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v))}` };
            }}
            color={diffColor}
            tooltip={diffTip}
            onCellClick={open}
            caption={title}
            cellSize={cellSize}
          />
          <HeatLegend
            title={t('resistance.antibiogram.diffLegend')}
            stops={[diffColor(-30), diffColor(-15), diffColor(0), diffColor(15), diffColor(30)]}
            labels={['−30', '−15', '0', '+15', '+30']}
          />
        </ChartCard>
      </div>
    );
  }

  if (state.cmp === 'grid' && axes) {
    return (
      <div className={s.viewStack}>
        {axes.ms.map((m, i) => {
          const lv = LEVEL_KEYS[i];
          const title = t('resistance.antibiogram.levelTitle', { level: names.level(lv) });
          return (
            <ChartCard
              key={lv}
              id={`resistance-antibiogram-${lv}`}
              title={title}
              subtitle={t('resistance.antibiogram.subtitle', { year: year ?? '—', level: names.level(lv) })}
              {...common}
              compact
              status={empty ? 'empty' : status}
              actions={i === 0 ? sortActions : undefined}
              tableRows={pivotRows(m)}
              fileName={`twamr-antibiogram-${lv}-${year}`}
              link={link({ chart: `resistance-antibiogram-${lv}` })}
              embed={{ chart: 'resistance-heatmap', params: { level: lv === 'all' ? undefined : lv } }}
            >
              <HeatGrid
                rows={rowsMeta}
                cols={colsMeta}
                groups={i === 0 ? groups : undefined}
                cell={(p, a) => {
                  const r = m.get(p, a);
                  return r ? { value: r.resistant_pct } : undefined;
                }}
                color={heatColor}
                tooltip={tip(m)}
                onCellClick={open}
                caption={title}
                cellSize={24}
              />
              {i === axes.ms.length - 1 && legend}
            </ChartCard>
          );
        })}
      </div>
    );
  }

  const m = axes?.ms[0];
  const title = t('resistance.antibiogram.title');
  return (
    <div className={s.viewStack}>
      <ChartCard
        id="resistance-antibiogram"
        title={title}
        subtitle={t('resistance.antibiogram.subtitle', { year: year ?? '—', level: names.level(state.level) })}
        {...common}
        status={!m ? status : empty ? 'empty' : status}
        actions={sortActions}
        tableRows={m ? pivotRows(m) : undefined}
        fileName={`twamr-antibiogram-${state.level}-${year}`}
        link={link({ chart: 'resistance-antibiogram' })}
        embed={{ chart: 'resistance-heatmap', params: { level: state.level === 'all' ? undefined : state.level } }}
      >
        {m && (
          <>
            <HeatGrid
              rows={rowsMeta}
              cols={colsMeta}
              groups={groups}
              cell={(p, a) => {
                const r = m.get(p, a);
                return r ? { value: r.resistant_pct } : undefined;
              }}
              color={heatColor}
              tooltip={tip(m)}
              onCellClick={open}
              caption={title}
              cellSize={cellSize}
            />
            {legend}
            <p className={s.footNote}>{t('resistance.antibiogram.note')}</p>
          </>
        )}
      </ChartCard>
    </div>
  );
}
