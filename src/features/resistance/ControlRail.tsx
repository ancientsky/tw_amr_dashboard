import { useMemo } from 'react';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { RangeSlider } from '../../components/ui/RangeSlider';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select, type SelectOption } from '../../components/ui/Select';
import { Button } from '../../components/ui/IconButton';
import { antibioticsFor } from '../../data/select';
import type { Envelope, Level, OnsetSetting, ResistanceRecord, Specimen, WhoPriority } from '../../data/types';
import { useDataset } from '../../data/load';
import { useT } from '../../i18n';
import { ISOLATE_SCOPES, useOrganismNamer, useScopeName } from './IsolatesView';
import { PrecisionLegend, RailGroup, Switch } from './bits';
import { antibiogramYears, isTrendRow, LEVEL_KEYS, MDROS, orderAntibiotics, parseItem, pathogenStrata, SPECIMEN_KEYS, type AntibiogramIndex } from './lib';
import type { Names } from './model';
import { TREND_BOUNDS, type ExplorerState } from './useExplorerState';
import s from './resistance.module.css';

interface Props {
  state: ExplorerState;
  update: (p: Partial<Record<keyof ExplorerState, unknown>>) => void;
  env: Envelope<ResistanceRecord> | null;
  ab: AntibiogramIndex | null;
  names: Names;
}

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2 };

export function usePathogenOptions(env: Envelope<ResistanceRecord> | null, names: Names): SelectOption[] {
  const t = useT();
  return useMemo(() => {
    if (!env) return [];
    const present = new Set(env.records.filter((r) => !isTrendRow(r)).map((r) => r.pathogen));
    const dims = (env.dims?.pathogens ?? []).filter((d) => present.has(d.code));
    const gramOf = (g: unknown) => (String(g ?? '').startsWith('neg') || g === '-' ? 'neg' : 'pos');
    return [...dims]
      .sort((a, b) => {
        const ga = gramOf(a.meta?.gram);
        const gb = gramOf(b.meta?.gram);
        if (ga !== gb) return ga === 'neg' ? -1 : 1;
        const pa = PRIORITY_RANK[String(a.meta?.whoPriority)] ?? 3;
        const pb = PRIORITY_RANK[String(b.meta?.whoPriority)] ?? 3;
        return pa - pb || (a.order ?? 0) - (b.order ?? 0);
      })
      .map((d) => {
        const pr = d.meta?.whoPriority as WhoPriority | null | undefined;
        const g = gramOf(d.meta?.gram) === 'neg' ? 'G−' : 'G+';
        return { value: d.code, label: names.pathogen(d.code), hint: pr ? `${g} · ${t(`resistance.priority.${pr}`)}` : g };
      });
  }, [env, names, t]);
}

export function ControlRail({ state, update, env, ab, names }: Props) {
  const t = useT();
  const pathogenOptions = usePathogenOptions(env, names);
  const antibioticOptions = useMemo<SelectOption[]>(() => {
    if (!env) return [];
    const codes = orderAntibiotics(
      antibioticsFor(
        env.records.filter((r) => !isTrendRow(r)),
        state.pathogen,
      ),
      env.dims,
    );
    return codes.map((c) => ({ value: c, label: names.antibiotic(c), hint: c }));
  }, [env, state.pathogen, names]);

  const levelOpts = LEVEL_KEYS.map((l) => ({ value: l, label: t(`resistance.levelShort.${l}`), title: t(`levels.${l}`) }));
  const settingOpts = (['all', 'co', 'ho'] as OnsetSetting[]).map((v) => ({ value: v, label: t(`resistance.settingShort.${v}`), title: t(`settings.${v}`) }));
  const phenoOpts = MDROS.map((p) => ({ value: p, label: p, hint: names.pathogenShort(env?.dims?.phenotypes?.find((d) => d.code === p)?.meta?.pathogen as string) }));
  const abYears = ab ? antibiogramYears(ab) : [2022, 2023, 2024];
  const strata = useMemo(() => (env && state.view === 'pathogen' ? pathogenStrata(env.records, state.pathogen, undefined, env.dims) : null), [env, state.view, state.pathogen]);
  const specimenOpts = SPECIMEN_KEYS.filter((k) => k === 'all' || strata?.bySpecimen.has(k)).map((k) => ({ value: k, label: names.specimen(k) }));

  const iso = useDataset('isolates');
  const orgName = useOrganismNamer();
  const scopeName = useScopeName();
  const organismOptions = useMemo<SelectOption[]>(() => {
    const codes = (iso.data?.dims?.organisms ?? []).map((d) => d.code).filter((c) => c !== 'OTHER' && c !== 'TOTAL');
    return ['TOTAL', ...codes].map((c) => ({ value: c, label: orgName(c), hint: c === 'TOTAL' ? undefined : c }));
  }, [iso.data, orgName]);
  const scopeOpts = ISOLATE_SCOPES.map((sc) => ({ value: sc, label: scopeName(sc) }));

  const setPathogen = (p: string) => {
    const abx = env ? antibioticsFor(env.records.filter((r) => !isTrendRow(r)), p) : [];
    update({ pathogen: p, antibiotic: abx.includes(state.antibiotic) ? state.antibiotic : (abx.includes('MEM') ? 'MEM' : abx[0]) });
  };

  const pathogenSelect = (
    <RailGroup label={t('common.pathogen')}>
      <Select options={pathogenOptions} value={state.pathogen} onChange={setPathogen} label={t('common.pathogen')} className={s.full} />
    </RailGroup>
  );
  const antibioticSelect = (
    <RailGroup label={t('common.antibiotic')}>
      <Select options={antibioticOptions} value={state.antibiotic} onChange={(v) => update({ antibiotic: v })} label={t('common.antibiotic')} className={s.full} />
    </RailGroup>
  );
  const levelSeg = (
    <RailGroup label={t('common.level')}>
      <SegmentedControl options={levelOpts} value={state.level} onChange={(v: Level) => update({ level: v })} label={t('common.level')} size="sm" className={s.fullSeg} />
    </RailGroup>
  );
  const settingSeg = (
    <RailGroup label={t('common.setting')}>
      <SegmentedControl options={settingOpts} value={state.setting} onChange={(v: OnsetSetting) => update({ setting: v })} label={t('common.setting')} size="sm" className={s.fullSeg} />
    </RailGroup>
  );
  const yearsSlider = (
    <RailGroup label={t('common.years')}>
      <RangeSlider min={TREND_BOUNDS[0]} max={TREND_BOUNDS[1]} value={state.years} onChange={(v) => update({ years: v })} label={t('common.years')} showLabel={false} ticks={[2017, 2020, 2024]} />
    </RailGroup>
  );
  const abYear = state.year && abYears.includes(state.year) ? state.year : abYears[abYears.length - 1];

  return (
    <div className={s.rail}>
      {state.view === 'trend' && (
        <>
          <RailGroup label={t('common.phenotype')} aside={<span className={s.railHint}>{t('resistance.rail.maxN', { n: 4 })}</span>}>
            <MultiSelect
              options={phenoOpts}
              value={state.phenotypes}
              onChange={(v) => v.length && update({ phenotypes: MDROS.filter((p) => v.includes(p)) })}
              label={t('common.phenotype')}
              max={4}
              className={s.full}
            />
          </RailGroup>
          {state.phenotypes.length === 1 ? (
            <RailGroup label={t('resistance.rail.levels')}>
              <MultiSelect
                options={LEVEL_KEYS.map((l) => ({ value: l, label: t(`levels.${l}`) }))}
                value={state.levels}
                onChange={(v) => update({ levels: v })}
                label={t('resistance.rail.levels')}
                className={s.full}
              />
            </RailGroup>
          ) : (
            levelSeg
          )}
          {settingSeg}
          {state.phenotypes.length === 1 ? (
            <Switch checked={state.overlay} onChange={(v) => update({ overlay: v })} label={t('resistance.rail.overlay')} hint={t('resistance.rail.overlayHint')} />
          ) : (
            <Switch checked={state.norm} onChange={(v) => update({ norm: v })} label={t('resistance.rail.norm')} hint={t('resistance.rail.normHint')} />
          )}
          {yearsSlider}
          <div className={s.railDivider} />
          <p className={s.railNote}>{t('resistance.rail.drugLevel')}</p>
          {pathogenSelect}
          {antibioticSelect}
        </>
      )}
      {state.view === 'antibiogram' && (
        <>
          <RailGroup label={t('common.year')}>
            <SegmentedControl options={abYears.map((y) => ({ value: String(y), label: String(y) }))} value={String(abYear)} onChange={(v) => update({ year: Number(v) })} label={t('common.year')} size="sm" className={s.fullSeg} />
          </RailGroup>
          {state.cmp === 'none' && levelSeg}
          <RailGroup label={t('resistance.rail.compareLevels')}>
            <SegmentedControl
              options={[
                { value: 'none', label: t('resistance.rail.cmpNone') },
                { value: 'grid', label: t('resistance.rail.cmpGrid') },
                { value: 'diff', label: t('resistance.rail.cmpDiff') },
              ]}
              value={state.cmp}
              onChange={(v) => update({ cmp: v })}
              label={t('resistance.rail.compareLevels')}
              size="sm"
              className={s.fullSeg}
            />
          </RailGroup>
          <p className={s.railNote}>{t('resistance.rail.cellHint')}</p>
        </>
      )}
      {state.view === 'pathogen' && (
        <>
          {pathogenSelect}
          {antibioticSelect}
          {strata && strata.years.length > 1 && (
            <RailGroup label={t('common.year')}>
              <SegmentedControl
                options={strata.years.map((y) => ({ value: String(y), label: String(y) }))}
                value={String(state.year && strata.years.includes(state.year) ? state.year : strata.year)}
                onChange={(v) => update({ year: Number(v) })}
                label={t('common.year')}
                size="sm"
                className={s.fullSeg}
              />
            </RailGroup>
          )}
          {specimenOpts.length > 1 && (
            <RailGroup label={t('common.specimen')}>
              <Select options={specimenOpts} value={state.specimen} onChange={(v: Specimen) => update({ specimen: v })} label={t('common.specimen')} className={s.full} />
            </RailGroup>
          )}
          {levelSeg}
        </>
      )}
      {state.view === 'compare' && (
        <>
          <RailGroup label={t('resistance.compare.items')} aside={<span className={s.railHint}>{t('resistance.rail.maxN', { n: 4 })}</span>}>
            <ul className={s.chips}>
              {state.items.map((id) => {
                const it = parseItem(id);
                const label = it?.kind === 'pair' ? `${names.pathogenShort(it.pathogen)} × ${it.antibiotic}` : id;
                return (
                  <li key={id} className={s.chip}>
                    <span>{label}</span>
                    {state.items.length > 1 && (
                      <button type="button" aria-label={t('resistance.compare.remove', { item: label })} onClick={() => update({ items: state.items.filter((x) => x !== id) })}>
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </RailGroup>
          <RailGroup label={t('resistance.compare.addPhenotype')}>
            <Select
              options={[{ value: '', label: t('resistance.compare.choose') }, ...MDROS.filter((p) => !state.items.includes(p)).map((p) => ({ value: p, label: p, hint: names.phenotype(p).replace(/\s*[（(].*$/, '') }))]}
              value=""
              onChange={(v) => v && state.items.length < 4 && update({ items: [...state.items, v] })}
              label={t('resistance.compare.addPhenotype')}
              className={s.full}
            />
          </RailGroup>
          <RailGroup label={t('resistance.compare.addPair')}>
            <div className={s.stack}>
              <Select options={pathogenOptions} value={state.pathogen} onChange={setPathogen} label={t('common.pathogen')} className={s.full} />
              <Select options={antibioticOptions} value={state.antibiotic} onChange={(v) => update({ antibiotic: v })} label={t('common.antibiotic')} className={s.full} />
              <Button
                icon="check"
                disabled={state.items.length >= 4 || state.items.includes(`${state.pathogen}.${state.antibiotic}`)}
                onClick={() => update({ items: [...state.items, `${state.pathogen}.${state.antibiotic}`] })}
              >
                {t('resistance.compare.add')}
              </Button>
            </div>
          </RailGroup>
          {levelSeg}
          {settingSeg}
          <Switch checked={state.norm} onChange={(v) => update({ norm: v })} label={t('resistance.rail.norm')} hint={t('resistance.rail.normHint')} />
          {yearsSlider}
        </>
      )}
      {state.view === 'isolates' && (
        <>
          <RailGroup label={t('common.pathogen')}>
            <Select options={organismOptions} value={state.organism} onChange={(v) => update({ organism: v })} label={t('common.pathogen')} className={s.full} />
          </RailGroup>
          <RailGroup label={t('resistance.isolates.scope')}>
            <Select options={scopeOpts} value={state.scope} onChange={(v) => update({ scope: v })} label={t('resistance.isolates.scope')} className={s.full} />
          </RailGroup>
          {levelSeg}
          <p className={s.railNote}>{t('resistance.isolates.railNote')}</p>
        </>
      )}
      <div className={s.railDivider} />
      <PrecisionLegend />
    </div>
  );
}
