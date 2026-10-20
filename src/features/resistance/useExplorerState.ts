import { useCallback, useMemo } from 'react';
import { useHashQuery } from '../../app/hooks/useHashQuery';
import type { QueryPatch } from '../../app/url';
import { formatYearRange, parseYearRange, type YearRange } from '../../data/select';
import type { IsolateScope, Level, OnsetSetting, Specimen } from '../../data/types';
import { LEVEL_KEYS, MDROS, PATHOGEN_TO_ISOLATE, PHENOTYPE_PAIR, SETTING_KEYS, SPECIMEN_KEYS, parseItem, parseList } from './lib';

export const VIEWS = ['trend', 'antibiogram', 'pathogen', 'compare', 'isolates'] as const;
const SCOPE_KEYS = ['all', 'blood', 'urine', 'sputum', 'pus', 'stool', 'co', 'ho'] as const;
export type View = (typeof VIEWS)[number];
export type CompareLevels = 'none' | 'grid' | 'diff';
export type RowSort = 'order' | 'name' | 'mean';
export type ColSort = 'class' | 'name' | 'mean';

export const TREND_BOUNDS: YearRange = [2017, 2024];
export const DEFAULT_ITEMS = ['CRAB', 'CRKP', 'ECO.CRO'];

export interface ExplorerState {
  view: View;
  /** 1 phenotype = level lines; 2–4 = compare-phenotypes mode */
  phenotypes: string[];
  pathogen: string;
  antibiotic: string;
  level: Level;
  setting: OnsetSetting;
  specimen: Specimen;
  years: YearRange;
  levels: Level[];
  norm: boolean;
  /** antibiogram / pathogen view data year (undefined = latest) */
  year?: number;
  /** national CO/HO overlay on the trend chart */
  overlay: boolean;
  cmp: CompareLevels;
  sort: RowSort;
  csort: ColSort;
  /** compare view items: phenotype codes or PATHOGEN.ANTIBIOTIC pairs */
  items: string[];
  /** isolates view: isolates.json organism code (TOTAL = all organisms) and scope */
  organism: string;
  scope: IsolateScope;
}

const pick = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T =>
  v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/** All explorer state lives in the hash query (deep-linkable, shareable). */
export function useExplorerState() {
  const q = useHashQuery();
  const { get, set } = q;

  const state = useMemo<ExplorerState>(() => {
    const phenos = parseList(get('phenotype'))
      .map((x) => x.toUpperCase())
      .filter((x) => (MDROS as readonly string[]).includes(x))
      .slice(0, 4);
    const levels = parseList(get('levels')).filter((x): x is Level => (LEVEL_KEYS as readonly string[]).includes(x));
    const yr = Number(get('year'));
    const items = parseList(get('items'))
      .map((x) => parseItem(x)?.id)
      .filter((x): x is string => !!x)
      .slice(0, 4);
    const view = pick(get('view'), VIEWS, 'trend');
    const phenotypes = phenos.length ? [...new Set(phenos)] : ['CRAB'];
    // Drug-level pair defaults to the selected phenotype's defining pair (CRAB → ABA × MEM) on the
    // trend view, or whenever a phenotype is named in the URL — unless pathogen/antibiotic are explicit.
    const pair = view === 'trend' || phenos.length ? PHENOTYPE_PAIR[phenotypes[0]] : undefined;
    const rawPathogen = get('pathogen');
    const rawAntibiotic = get('antibiotic');
    const pathogen = (rawPathogen ?? pair?.pathogen ?? 'KPN').toUpperCase();
    const antibiotic = (rawAntibiotic ?? (rawPathogen && rawPathogen.toUpperCase() !== pair?.pathogen ? 'MEM' : pair?.antibiotic) ?? 'MEM').toUpperCase();
    return {
      view,
      phenotypes,
      pathogen,
      antibiotic,
      level: pick(get('level'), LEVEL_KEYS, 'all'),
      setting: pick(get('setting'), SETTING_KEYS, 'all'),
      specimen: pick(get('specimen'), SPECIMEN_KEYS, 'all'),
      years: parseYearRange(get('years')) ?? TREND_BOUNDS,
      levels: levels.length ? LEVEL_KEYS.filter((l) => levels.includes(l)) : [...LEVEL_KEYS],
      norm: get('norm') === '1' || get('norm') === 'true',
      year: Number.isFinite(yr) && yr > 2000 ? yr : undefined,
      overlay: get('overlay') === '1',
      cmp: pick(get('cmp'), ['none', 'grid', 'diff'] as const, 'none'),
      sort: pick(get('sort'), ['order', 'name', 'mean'] as const, 'order'),
      csort: pick(get('csort'), ['class', 'name', 'mean'] as const, 'class'),
      items: items.length ? [...new Set(items)] : DEFAULT_ITEMS,
      organism: (get('organism') ?? (rawPathogen ? (PATHOGEN_TO_ISOLATE[pathogen] ?? pathogen) : 'TOTAL')).toUpperCase(),
      scope: pick(get('scope'), SCOPE_KEYS, 'all'),
    };
  }, [get]);

  /** Merge-patch the URL; defaults are dropped to keep links short. */
  const update = useCallback(
    (patch: Partial<Record<keyof ExplorerState, unknown>>) => {
      const out: QueryPatch = {};
      for (const [k, v] of Object.entries(patch)) {
        switch (k as keyof ExplorerState) {
          case 'phenotypes': {
            const list = v as string[];
            out.phenotype = list.length === 1 && list[0] === 'CRAB' ? null : list.join(',');
            break;
          }
          case 'levels': {
            const list = v as Level[];
            out.levels = list.length === LEVEL_KEYS.length || list.length === 0 ? null : list.join(',');
            break;
          }
          case 'items': {
            const list = v as string[];
            out.items = list.join(',') === DEFAULT_ITEMS.join(',') ? null : list.join(',');
            break;
          }
          case 'years': {
            const r = v as YearRange;
            out.years = r[0] === TREND_BOUNDS[0] && r[1] === TREND_BOUNDS[1] ? null : formatYearRange(r);
            break;
          }
          case 'norm':
          case 'overlay':
            out[k] = v ? '1' : null;
            break;
          case 'view':
            out.view = v === 'trend' ? null : (v as string);
            break;
          case 'level':
          case 'setting':
          case 'specimen':
          case 'scope':
            out[k] = v === 'all' ? null : (v as string);
            break;
          case 'organism':
            out.organism = v === 'TOTAL' ? null : (v as string);
            break;
          case 'cmp':
            out.cmp = v === 'none' ? null : (v as string);
            break;
          case 'sort':
            out.sort = v === 'order' ? null : (v as string);
            break;
          case 'csort':
            out.csort = v === 'class' ? null : (v as string);
            break;
          default:
            out[k] = (v as string | number | undefined) ?? null;
        }
      }
      set(out);
    },
    [set],
  );

  return { state, update, link: q.link, query: q };
}
