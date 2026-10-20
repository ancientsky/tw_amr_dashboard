/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' → fall back to src/data/fixtures when public/data/*.json is missing (prod) */
  readonly VITE_FIXTURE_FALLBACK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'world-atlas/countries-110m.json' {
  import type { Topology } from 'topojson-specification';
  const value: Topology;
  export default value;
}
