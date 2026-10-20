import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useDataset, useOptionalDataset, type DatasetStatus } from '../../data/load';
import type { DatasetName, MetaData } from '../../data/types';

interface DataCtx {
  meta: MetaData | null;
  status: DatasetStatus;
  isFixture: boolean;
}

const Ctx = createContext<DataCtx>({ meta: null, status: 'loading', isFixture: false });

/** Preloads meta.json once for the whole app (latest year, sources, build info). */
export function DataProvider({ children, fixtureFallback }: { children: ReactNode; fixtureFallback?: boolean }) {
  const { data, status, isFixture } = useDataset('meta', { fixtureFallback });
  const value = useMemo(() => ({ meta: data, status, isFixture }), [data, status, isFixture]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMeta(): DataCtx {
  return useContext(Ctx);
}

/**
 * Per-dataset provisional flag (not a global flag). Uses meta.provisionalDatasets when the
 * pipeline provides it (no extra fetch); otherwise reads that dataset's own envelope.
 * Returns undefined while unknown.
 */
export function useDatasetProvisional(name: Exclude<DatasetName, 'meta'> | null | undefined): boolean | undefined {
  const { meta, status } = useMeta();
  const list = meta?.provisionalDatasets;
  const needEnvelope = Boolean(name) && !list && status !== 'loading';
  const { data } = useOptionalDataset(needEnvelope ? name : null);
  if (!name) return undefined;
  if (list) return list.includes(name);
  return data ? Boolean((data as { provisional?: boolean }).provisional) : undefined;
}
