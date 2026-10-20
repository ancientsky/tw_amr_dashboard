import type { Dim, Envelope, GlassIndicator, GlassRecord } from '../../data/types';

/** ISO3 → Natural Earth country name used by world-atlas countries-110m (ECharts map feature `name`). */
export const NE_NAME: Record<string, string> = {
  ARG: 'Argentina', AUS: 'Australia', BGD: 'Bangladesh', BRA: 'Brazil', CAN: 'Canada', CHL: 'Chile', CHN: 'China',
  DEU: 'Germany', EGY: 'Egypt', ESP: 'Spain', ETH: 'Ethiopia', FRA: 'France', GBR: 'United Kingdom', GRC: 'Greece',
  IDN: 'Indonesia', IND: 'India', IRN: 'Iran', ITA: 'Italy', JOR: 'Jordan', JPN: 'Japan', KEN: 'Kenya', KOR: 'South Korea',
  MEX: 'Mexico', MYS: 'Malaysia', NGA: 'Nigeria', NLD: 'Netherlands', NOR: 'Norway', NPL: 'Nepal', NZL: 'New Zealand',
  PAK: 'Pakistan', PHL: 'Philippines', POL: 'Poland', ROU: 'Romania', SAU: 'Saudi Arabia', SWE: 'Sweden', THA: 'Thailand',
  TUR: 'Turkey', TWN: 'Taiwan', UGA: 'Uganda', USA: 'United States of America', VNM: 'Vietnam', ZAF: 'South Africa',
};
export const ISO_BY_NE: Record<string, string> = Object.fromEntries(Object.entries(NE_NAME).map(([k, v]) => [v, k]));

/** Taiwan marker position (lon, lat). */
export const TAIWAN_COORD: [number, number] = [120.97, 23.7];

/** Map viewport per WHO region filter (geo center + zoom). */
export const REGION_VIEW: Record<string, { center: [number, number]; zoom: number }> = {
  all: { center: [12, 18], zoom: 1.12 },
  AFR: { center: [20, 2], zoom: 2.6 },
  AMR: { center: [-80, 12], zoom: 1.7 },
  SEAR: { center: [95, 15], zoom: 3.2 },
  EUR: { center: [30, 52], zoom: 2.4 },
  EMR: { center: [48, 26], zoom: 3.2 },
  WPR: { center: [132, 8], zoom: 2.0 },
};

export const WHO_REGIONS = ['AFR', 'AMR', 'SEAR', 'EUR', 'EMR', 'WPR'] as const;
export const DEFAULT_INDICATOR: GlassIndicator = 'CR_KPN_BLOOD';
export const DEFAULT_COUNTRIES = ['JPN', 'KOR', 'USA', 'GBR'];
export const MAX_COMPARE = 5;
export const GLASS_DASHBOARD_URL = 'https://worldhealthorg.shinyapps.io/glass-dashboard/';
export const GLASS_REPORT_URL = 'https://www.who.int/publications/i/item/9789240062702';
export const GLASS_CSV = 'data/curated/glass.csv';

export interface TwnDerivation {
  available?: boolean;
  tier?: string;
  pathogen?: string;
  antibiotic?: string;
  phenotype?: string | null;
  specimen?: string;
  level?: string;
  setting?: string;
  year?: number;
  precision?: string;
  reportYear?: number;
  measure?: string;
  fallback?: boolean;
}

export interface GlassMeta {
  comparability?: {
    TWN?: Record<string, TwnDerivation>;
    tiers?: Record<string, string>;
    caveats?: string[];
  };
}

/** `meta` block of glass.json (not part of the generic Envelope type). */
export function glassMeta(env: Envelope<GlassRecord> | null | undefined): GlassMeta {
  return ((env as unknown as { meta?: GlassMeta })?.meta ?? {}) as GlassMeta;
}

export function indicatorCodes(env: Envelope<GlassRecord> | null | undefined): GlassIndicator[] {
  const dims = env?.dims?.indicators ?? [];
  return [...dims].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((d) => d.code as GlassIndicator);
}

export function regionOf(env: Envelope<GlassRecord> | null | undefined, iso3: string): string | undefined {
  const d = env?.dims?.countries?.find((c: Dim) => c.code === iso3);
  return (d?.meta?.whoRegion as string | undefined) ?? env?.records.find((r) => r.iso3 === iso3)?.whoRegion;
}

/**
 * Records for one indicator, filtered by WHO region and data year.
 * `year` = 'latest' keeps each country's latest available year; a year keeps only that
 * data year. Taiwan is always kept (it is the reference) when `keepTaiwan`.
 */
export function glassRows(
  records: readonly GlassRecord[],
  opts: { indicator?: string; region?: string; year?: string; keepTaiwan?: boolean },
): GlassRecord[] {
  const { indicator, region = 'all', year = 'latest', keepTaiwan = true } = opts;
  const best = new Map<string, GlassRecord>();
  for (const r of records) {
    if (indicator && r.indicator !== indicator) continue;
    const isTw = r.iso3 === 'TWN';
    if (!(isTw && keepTaiwan)) {
      if (region !== 'all' && r.whoRegion !== region) continue;
      if (year !== 'latest' && String(r.year) !== year) continue;
    }
    const k = `${r.iso3}|${r.indicator}`;
    const cur = best.get(k);
    if (!cur || r.year > cur.year) best.set(k, r);
  }
  return [...best.values()];
}

/** Percentile rank (0–100) of `v` among `values` (share of values ≤ v, mid-rank for ties). */
export function percentileRank(v: number, values: readonly number[]): number {
  if (!values.length) return 0;
  let below = 0;
  let equal = 0;
  for (const x of values) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return ((below + equal / 2) / values.length) * 100;
}
