import type { ComponentType } from 'react';
import { KpiStrip } from './charts/KpiStrip';
import { ResistanceHeatmap } from './charts/ResistanceHeatmap';
import { ResistanceTrend } from './charts/ResistanceTrend';
import type { ChartParams } from './charts/common';
import { GlassMap } from '../features/international/GlassMap';
import { GlassBars } from '../features/international/GlassBars';
import { AmuStacked } from '../features/antibiotic-use/AmuStacked';
import { AmuAware } from '../features/antibiotic-use/AmuAware';
import { HaiTrend } from '../features/hai/HaiTrend';
import { HaiBump } from '../features/hai/HaiBump';
import { PathogenBarsChart } from '../features/resistance/charts/PathogenBarsChart';
import { CoHoGapChart } from '../features/resistance/charts/CoHoGapChart';

/**
 * Embeddable chart registry: `chart` id → component (+ the app route it deep-links to).
 * Shared file — append only. Each component renders its own ChartCard and accepts ChartParams.
 */
export interface EmbedChartDef {
  id: string;
  /** route in the main app that hosts this chart (used for "Open in TW-AMR Watch") */
  route: string;
  /** fixed params for that route (e.g. the explorer view hosting the chart) */
  routeParams?: Record<string, string>;
  /** query params this chart understands (documented in docs/EMBED.md) */
  params: (keyof ChartParams)[];
  Component: ComponentType<ChartParams>;
}

export const EMBED_REGISTRY: Record<string, EmbedChartDef> = {
  'resistance-trend': {
    id: 'resistance-trend',
    route: '/resistance',
    params: ['pathogen', 'antibiotic', 'level', 'ward', 'setting', 'years'],
    Component: ResistanceTrend,
  },
  'resistance-heatmap': {
    id: 'resistance-heatmap',
    route: '/resistance',
    routeParams: { view: 'antibiogram' },
    params: ['level', 'ward', 'setting'],
    Component: ResistanceHeatmap,
  },
  'kpi-strip': {
    id: 'kpi-strip',
    route: '/',
    params: ['level', 'ward', 'setting'],
    Component: KpiStrip,
  },
};

export function registerEmbedChart(def: EmbedChartDef): void {
  EMBED_REGISTRY[def.id] = def;
}

export const EMBED_IDS = (): string[] => Object.keys(EMBED_REGISTRY);

/* ---- international / antibiotic-use / HAI (feature agent: international+amu+hai) ----
 * Extra params (indicator, region, year, bars, metric, classes, icu, site) are read by the
 * components from the embed hash; they are listed here so "Open in TW-AMR Watch" keeps them. */
const extraParams = (...keys: string[]) => keys as unknown as (keyof ChartParams)[];
registerEmbedChart({ id: 'glass-map', route: '/international', params: extraParams('indicator', 'region', 'year'), Component: GlassMap });
registerEmbedChart({ id: 'glass-bars', route: '/international', params: extraParams('indicator', 'region', 'year', 'bars'), Component: GlassBars });
registerEmbedChart({ id: 'amu-stacked', route: '/antibiotic-use', params: extraParams('level', 'metric', 'classes', 'years'), Component: AmuStacked });
registerEmbedChart({ id: 'amu-aware', route: '/antibiotic-use', params: extraParams('level', 'years'), Component: AmuAware });
registerEmbedChart({ id: 'hai-trend', route: '/hai', params: extraParams('level', 'icu', 'metric', 'years'), Component: HaiTrend });
registerEmbedChart({ id: 'hai-bump', route: '/hai', params: extraParams('level', 'site', 'years'), Component: HaiBump });

/* ---- resistance explorer / overview (feature agent: overview+resistance) ----
 * resistance-pathogen-bars: % non-susceptible per antibiotic by onset (all/CO/HO) for one pathogen (years=YYYY picks the data year).
 * resistance-co-ho: community- vs hospital-onset % for the nine MDROs (level, years=YYYY). */
registerEmbedChart({ id: 'resistance-pathogen-bars', route: '/resistance', routeParams: { view: 'pathogen' }, params: ['pathogen', 'years'], Component: PathogenBarsChart });
registerEmbedChart({ id: 'resistance-co-ho', route: '/resistance', params: ['level', 'years'], Component: CoHoGapChart });
