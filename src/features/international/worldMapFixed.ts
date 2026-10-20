import * as echarts from 'echarts';
import { ensureWorldMap } from '../../components/chart/worldMap';

export const WORLD_MAP = 'world-twamr';

type Ring = number[][];
type Geometry = { type: string; coordinates: unknown };
type Feature = { type: string; id?: string; properties?: Record<string, unknown>; geometry: Geometry | null };

const crossesAntimeridian = (ring: Ring): boolean =>
  ring.some((p, i) => i > 0 && Math.abs(p[0] - ring[i - 1][0]) > 180);

/**
 * The shared 'world' map (world-atlas 110m) contains polygons that wrap the antimeridian
 * (Russia's Chukotka, Fiji) and Antarctica; ECharts draws them as hairline bands across the
 * whole map. Register a cleaned copy that drops those polygon parts and Antarctica.
 */
export async function ensureWorldMapFixed(): Promise<void> {
  if (echarts.getMap(WORLD_MAP)) return;
  await ensureWorldMap();
  const src = echarts.getMap('world') as unknown as {
    geoJSON?: { features: Feature[] };
    geoJson?: { features: Feature[] };
  } | null;
  const geo = src?.geoJSON ?? src?.geoJson;
  if (!geo) throw new Error('world map missing');
  const features = geo.features
    .filter((f) => f.properties?.name !== 'Antarctica')
    .map((f) => {
      const g = f.geometry;
      if (!g) return f;
      if (g.type === 'Polygon') {
        const rings = g.coordinates as Ring[];
        return crossesAntimeridian(rings[0]) ? { ...f, geometry: null } : f;
      }
      if (g.type === 'MultiPolygon') {
        const polys = (g.coordinates as Ring[][]).filter((p) => !crossesAntimeridian(p[0]));
        return { ...f, geometry: { type: 'MultiPolygon', coordinates: polys } };
      }
      return f;
    })
    .filter(
      (f) =>
        f.geometry && (f.geometry.type !== 'MultiPolygon' || (f.geometry.coordinates as unknown[]).length),
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  echarts.registerMap(WORLD_MAP, { type: 'FeatureCollection', features } as any);
}
