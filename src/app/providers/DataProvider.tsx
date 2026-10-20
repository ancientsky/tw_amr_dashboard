import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useDataset, type DatasetStatus } from '../../data/load';
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
 * Per-dataset provisional flag, read from that dataset's own envelope (not a global flag).
 * Returns undefined while loading / when the dataset is unavailable.
 */
export function useDatasetProvisional(name: Exclude<DatasetName, 'meta'>): boolean | undefined {
  const { data } = useDataset(name);
  return data ? Boolean((data as { provisional?: boolean }).provisional) : undefined;
}
