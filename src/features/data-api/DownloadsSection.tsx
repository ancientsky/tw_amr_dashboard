import { useEffect, useMemo, useState } from 'react';
import { useMeta } from '../../app/providers/DataProvider';
import { REPO_URL } from '../../app/url';
import { Badge, ButtonLink, EmptyState, IconButton, Icon, Skeleton } from '../../components/ui';
import { fmtNumber } from '../../data/format';
import type { IngestionPdf } from '../../data/types';
import { useT } from '../../i18n';
import { API_BASE, formatBytes, type IndexDataset } from './api';
import { LOCAL_API, useApiCatalog } from './catalog';
import { useCopy } from './CodeBlock';
import s from './dataApi.module.css';

export const ZIP_URL = `${REPO_URL}/archive/refs/heads/main.zip`;
const REAL = new Set(['resistance', 'isolates']);

interface Item {
  id: string;
  dataset: string;
  records: number;
  provisional: boolean;
  jsonRel: string;
  csvRel: string;
  schemaRel: string;
  jsonAbs: string;
  yearMin?: number | null;
  yearMax?: number | null;
}

const sizeCache = new Map<string, Promise<number>>();

/** Total byte size of a same-origin file via a 1-byte Range request (falls back to Content-Length). */
function fileSize(url: string): Promise<number> {
  let p = sizeCache.get(url);
  if (!p) {
    p = fetch(url, { headers: { Range: 'bytes=0-0' } })
      .then(async (r) => {
        if (!r.ok) return 0;
        const cr = /\/(\d+)\s*$/.exec(r.headers.get('content-range') ?? '');
        if (r.status === 206 && cr) return Number(cr[1]);
        const len = Number(r.headers.get('content-length'));
        if (r.status === 200) await r.arrayBuffer(); // server ignored Range: consume instead of aborting
        return len > 0 ? len : 0;
      })
      .catch(() => 0);
    sizeCache.set(url, p);
  }
  return p;
}

/** Sizes of the given files, filled in as they arrive (absent when the server does not say). */
function useSizes(urls: string[]): Record<string, number> {
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const key = urls.join('|');
  useEffect(() => {
    let alive = true;
    const list = key ? key.split('|') : [];
    list.forEach((u) => {
      fileSize(u).then((n) => {
        if (alive && n > 0) setSizes((m) => ({ ...m, [u]: n }));
      });
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return sizes;
}

function rawPdfUrl(file: string): string {
  return `${REPO_URL}/raw/main/${file.split('/').map(encodeURIComponent).join('/')}`;
}

function pdfInfo(p: IngestionPdf | string): { file: string; year?: number; sha?: string; bytes?: number } {
  if (typeof p === 'string') return { file: p };
  const file = (p.file ?? p.name ?? '') as string;
  return {
    file,
    year: (p.reportYear ?? p.year) as number | undefined,
    sha: p.sha256,
    bytes: p.bytes as number | undefined,
  };
}

export function DownloadsSection() {
  const t = useT();
  const { meta } = useMeta();
  const { status, catalog, retry } = useApiCatalog();
  const copy = useCopy();

  const items = useMemo<Item[]>(() => {
    const years = new Map(
      (
        meta?.records as { dataset: string; yearMin?: number | null; yearMax?: number | null }[] | undefined
      )?.map((r) => [r.dataset, r]) ?? [],
    );
    const prov = new Set(meta?.provisionalDatasets ?? catalog.index?.provisionalDatasets ?? []);
    if (catalog.index) {
      return catalog.index.datasets.map((d: IndexDataset) => {
        const file = (u: string) => u.replace(catalog.index!.baseUrl, '');
        return {
          id: d.id,
          dataset: d.dataset,
          records: d.records,
          provisional: d.provisional,
          jsonRel: `${LOCAL_API}${file(d.json)}`,
          csvRel: `${LOCAL_API}${file(d.csv)}`,
          schemaRel: `${LOCAL_API}${file(d.schema)}`,
          jsonAbs: d.json,
          yearMin: years.get(d.dataset)?.yearMin,
          yearMax: years.get(d.dataset)?.yearMax,
        };
      });
    }
    const recs = (meta?.records ?? []) as {
      dataset: string;
      records: number;
      provisional: boolean;
      yearMin?: number | null;
      yearMax?: number | null;
    }[];
    return recs.map((r) => {
      const id = r.dataset.replace(/_/g, '-');
      return {
        id,
        dataset: r.dataset,
        records: r.records,
        provisional: r.provisional || prov.has(r.dataset),
        jsonRel: `${LOCAL_API}/${id}.json`,
        csvRel: `${LOCAL_API}/${id}.csv`,
        schemaRel: `${LOCAL_API}/schema/${r.dataset}.schema.json`,
        jsonAbs: `${API_BASE}/${id}.json`,
        yearMin: r.yearMin,
        yearMax: r.yearMax,
      };
    });
  }, [catalog.index, meta]);

  const sizes = useSizes(useMemo(() => items.flatMap((i) => [i.jsonRel, i.csvRel]), [items]));
  const pdfs = (meta?.ingestion?.pdfs ?? []).map(pdfInfo).filter((p) => p.file);

  return (
    <div className={s.stack}>
      {status === 'loading' && items.length === 0 ? (
        <div className={s.dlGrid} aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={188} radius={16} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="alert"
          title={t('common.error')}
          body={t('common.errorBody')}
          action={
            <button type="button" className={s.linkBtn} onClick={retry}>
              {t('actions.retry')}
            </button>
          }
        />
      ) : (
        <ul className={s.dlGrid}>
          {items.map((d) => {
            const kind = d.provisional ? 'provisional' : REAL.has(d.dataset) ? 'real' : 'content';
            const jsonSize = sizes[d.jsonRel];
            const csvSize = sizes[d.csvRel];
            const years =
              d.yearMin && d.yearMax
                ? d.yearMin === d.yearMax
                  ? `${d.yearMin}`
                  : `${d.yearMin}–${d.yearMax}`
                : null;
            return (
              <li key={d.id} className={[s.dlCard, kind === 'provisional' ? s.dlProv : ''].join(' ')}>
                <div className={s.dlHead}>
                  <h3 className={s.dlName}>{t(`data.ds.${d.dataset}.name`)}</h3>
                  <Badge
                    tone={kind === 'real' ? 'accent' : kind === 'provisional' ? 'warn' : 'neutral'}
                    dot={kind !== 'content'}
                    title={t(`data.dl.kind.${kind}Hint`)}
                  >
                    {t(`data.dl.kind.${kind}`)}
                  </Badge>
                </div>
                <p className={s.dlDesc}>{t(`data.ds.${d.dataset}.desc`)}</p>
                <dl className={s.dlStats}>
                  <div>
                    <dt>{t('data.dl.records')}</dt>
                    <dd>{fmtNumber(d.records, t.locale)}</dd>
                  </div>
                  {years && (
                    <div>
                      <dt>{t('data.dl.years')}</dt>
                      <dd>{years}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{t('data.dl.size')}</dt>
                    <dd>
                      {jsonSize || csvSize
                        ? [
                            jsonSize && `JSON ${formatBytes(jsonSize, t.locale)}`,
                            csvSize && `CSV ${formatBytes(csvSize, t.locale)}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : '—'}
                    </dd>
                  </div>
                </dl>
                <div className={s.dlActions}>
                  <ButtonLink
                    href={d.jsonRel}
                    download
                    icon="download"
                    variant="primary"
                    aria-label={`${t('data.dl.json')} — ${t(`data.ds.${d.dataset}.name`)}`}
                  >
                    JSON
                  </ButtonLink>
                  <ButtonLink
                    href={d.csvRel}
                    download
                    icon="file-csv"
                    aria-label={`${t('data.dl.csv')} — ${t(`data.ds.${d.dataset}.name`)}`}
                  >
                    CSV
                  </ButtonLink>
                  <ButtonLink
                    href={d.schemaRel}
                    target="_blank"
                    rel="noopener"
                    icon="code"
                    aria-label={`${t('data.dl.schema')} — ${t(`data.ds.${d.dataset}.name`)}`}
                  >
                    {t('data.dl.schema')}
                  </ButtonLink>
                  <IconButton
                    icon="link"
                    label={t('data.dl.copyUrl')}
                    variant="outline"
                    onClick={() => copy(d.jsonAbs)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={s.twoCol}>
        <div className={s.panel}>
          <h3 className={s.panelTitle}>
            <Icon name="download" size={18} /> {t('data.dl.everything.title')}
          </h3>
          <p className={s.prose}>{t('data.dl.everything.body')}</p>
          <div className={s.row}>
            <ButtonLink href={ZIP_URL} icon="download" variant="primary" rel="noopener">
              {t('data.dl.everything.zip')}
            </ButtonLink>
            <ButtonLink href={REPO_URL} target="_blank" rel="noopener" icon="external">
              {t('data.dl.everything.repo')}
            </ButtonLink>
          </div>
        </div>
        <div className={s.panel}>
          <h3 className={s.panelTitle}>
            <Icon name="table" size={18} /> {t('data.dl.pdfs.title')}
          </h3>
          <p className={s.prose}>{t('data.dl.pdfs.body')}</p>
          <ul className={s.pdfList}>
            {pdfs.map((p) => (
              <li key={p.file} className={s.pdfItem}>
                <a href={rawPdfUrl(p.file)} target="_blank" rel="noopener" className={s.pdfLink}>
                  <Icon name="external" size={14} />
                  <span>{t('data.dl.pdfs.edition', { year: p.year ?? '' })}</span>
                </a>
                <span className={s.pdfMeta}>
                  {p.bytes ? formatBytes(p.bytes, t.locale) : ''}
                  {p.sha ? ` · sha256 ${p.sha.slice(0, 10)}…` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
