import type { ComponentType } from 'react';
import { KpiStrip } from './charts/KpiStrip';
import { ResistanceHeatmap } from './charts/ResistanceHeatmap';
import { ResistanceTrend } from './charts/ResistanceTrend';
import type { ChartParams } from './charts/common';

/**
 * Embeddable chart registry: `chart` id → component (+ the app route it deep-links to).
 * Shared file — append only. Each component renders its own ChartCard and accepts ChartParams.
 */
export interface EmbedChartDef {
  id: string;
  /** route in the main app that hosts this chart (used for "Open in TW-AMR Watch") */
  route: string;
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
