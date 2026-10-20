/** Loads the generated public/data datasets for engine tests (no TS JSON inference). */
import type { EngineData } from '../types';

const files = import.meta.glob('../../../../../public/data/{resistance,isolates,glass,kb,meta}.json', { eager: true, import: 'default' });

function pick(name: string): unknown {
  const key = Object.keys(files).find((k) => k.endsWith(`/${name}.json`));
  if (!key) throw new Error(`missing public/data/${name}.json`);
  return files[key];
}

export const DATA = {
  resistance: pick('resistance'),
  isolates: pick('isolates'),
  glass: pick('glass'),
  kb: pick('kb'),
  meta: pick('meta'),
} as EngineData;
