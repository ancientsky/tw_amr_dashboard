import * as echarts from 'echarts';

let pending: Promise<void> | null = null;

/**
 * Lazily registers the 'world' map (world-atlas countries-110m → GeoJSON) with ECharts.
 * `await ensureWorldMap()` before rendering a series of type 'map' with map: 'world'.
 * Feature `name` is the Natural Earth country name; `id` is the ISO 3166-1 numeric code.
 */
export function ensureWorldMap(): Promise<void> {
  if (echarts.getMap('world')) return Promise.resolve();
  if (!pending) {
    pending = Promise.all([import('world-atlas/countries-110m.json'), import('topojson-client')]).then(([atlas, topo]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topology = (atlas as any).default ?? atlas;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const geo = topo.feature(topology, topology.objects.countries) as any;
      echarts.registerMap('world', geo);
    });
  }
  return pending;
}
