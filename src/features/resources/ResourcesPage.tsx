import { motion } from 'framer-motion';
import { useMemo, type CSSProperties } from 'react';
import { useHashQuery } from '../../app/hooks/useHashQuery';
import { REPO_URL } from '../../app/url';
import { PageHeader, Section } from '../../components/layout/PageHeader';
import {
  DataTable,
  EmptyState,
  Icon,
  SegmentedControl,
  Skeleton,
  usePrefersReducedMotion,
  type Column,
  type Row,
} from '../../components/ui';
import { fmtNumber } from '../../data/format';
import { useDataset } from '../../data/load';
import type { LinkCategory, LinkRecord } from '../../data/types';
import { useT } from '../../i18n';
import { hueFor, monogram } from './monogram';
import s from './resources.module.css';

const FEATURED = [
  'who-glass-dashboard',
  'ecdc-surveillance-atlas',
  'cdc-arpsp',
  'tw-thas-portal',
  'japan-janis',
  'korea-kdca-karms',
];
const CATEGORIES: LinkCategory[] = ['amr', 'amu', 'hai', 'one-health', 'data-portal', 'guideline'];
const REGIONS = ['taiwan', 'global', 'western-pacific', 'europe', 'americas', 'south-east-asia', 'africa'];
const ISSUE_URL = `${REPO_URL}/issues/new?title=${encodeURIComponent('Broken link: ')}`;
const ISSUES_URL = `${REPO_URL}/issues`;

type View = 'cards' | 'table';

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function Monogram({ org, large }: { org: string; large?: boolean }) {
  const m = monogram(org);
  return (
    <span
      className={[s.mono, large ? s.monoLg : '', m.length > 3 ? s.monoSm : ''].join(' ')}
      style={{ '--hue': hueFor(org) } as CSSProperties}
      aria-hidden="true"
    >
      {m}
    </span>
  );
}

function LinkCard({
  r,
  variant = 'default',
  index = 0,
}: {
  r: LinkRecord;
  variant?: 'default' | 'featured' | 'compact';
  index?: number;
}) {
  const t = useT();
  const reduced = usePrefersReducedMotion();
  const name = t.tl(r.name);
  return (
    <motion.li
      className={[
        s.card,
        variant === 'featured' ? s.cardFeatured : '',
        variant === 'compact' ? s.cardCompact : '',
      ].join(' ')}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduced ? 0 : Math.min(index, 8) * 0.03, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={s.cardTop}>
        <Monogram org={r.org} large={variant === 'featured'} />
        <div className={s.cardTitles}>
          <h3 className={s.cardName}>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className={s.cardLink}>
              {name}
              <span className="sr-only"> ({t('resources.opensNew')})</span>
            </a>
          </h3>
          <div className={s.cardOrg}>{r.org}</div>
        </div>
        <Icon name="external" size={16} className={s.ext} />
      </div>
      {variant !== 'compact' && <p className={s.cardDesc}>{t.tl(r.description)}</p>}
      <div className={s.cardMeta}>
        <span className={[s.pill, s[`cat_${r.category.replace('-', '_')}`]].join(' ')}>
          {t(`resources.cat.${r.category}`)}
        </span>
        <span className={s.pillRegion}>{t(`resources.region.${r.region}`)}</span>
        <span className={s.host}>{host(r.url)}</span>
      </div>
      {variant === 'default' && r.tags.length > 0 && (
        <ul className={s.tags} aria-label={t('resources.tags')}>
          {r.tags.slice(0, 4).map((tg) => (
            <li key={tg}>#{tg}</li>
          ))}
        </ul>
      )}
    </motion.li>
  );
}

export default function ResourcesPage() {
  const t = useT();
  const q = useHashQuery();
  const { status, data, error } = useDataset('links');

  const query = q.get('q') ?? '';
  const cat = (q.get('cat') as LinkCategory | null) ?? 'all';
  const region = q.get('region') ?? 'all';
  const view: View = q.get('view') === 'table' ? 'table' : 'cards';

  const records = useMemo(() => data?.records ?? [], [data]);

  const match = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (r: LinkRecord) => {
      if (!needle) return true;
      const hay = [r.name[t.locale], r.name.en, r.description[t.locale], r.org, r.tags.join(' ')]
        .join(' ')
        .toLowerCase();
      return needle.split(/\s+/).every((w) => hay.includes(w));
    };
  }, [query, t.locale]);

  const filtered = useMemo(
    () =>
      records.filter(
        (r) => match(r) && (cat === 'all' || r.category === cat) && (region === 'all' || r.region === region),
      ),
    [records, match, cat, region],
  );

  // faceted counts: each facet counts records that pass the *other* filters
  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of records)
      if (match(r) && (region === 'all' || r.region === region))
        m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [records, match, region]);
  const regionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of records)
      if (match(r) && (cat === 'all' || r.category === cat)) m.set(r.region, (m.get(r.region) ?? 0) + 1);
    return m;
  }, [records, match, cat]);
  const catTotal = [...catCounts.values()].reduce((a, b) => a + b, 0);
  const regionTotal = [...regionCounts.values()].reduce((a, b) => a + b, 0);

  const featured = useMemo(
    () => FEATURED.map((id) => records.find((r) => r.id === id)).filter((r): r is LinkRecord => Boolean(r)),
    [records],
  );
  const taiwan = useMemo(() => records.filter((r) => r.region === 'taiwan'), [records]);
  const filtering = Boolean(query.trim()) || cat !== 'all' || region !== 'all';

  const rows = useMemo<Row[]>(
    () =>
      filtered.map((r) => ({
        name: t.tl(r.name),
        org: r.org,
        category: t(`resources.cat.${r.category}`),
        region: t(`resources.region.${r.region}`),
        domain: host(r.url),
        url: r.url,
      })),
    [filtered, t],
  );
  const columns: Column[] = [
    {
      key: 'name',
      label: t('resources.col.name'),
      format: (v, row) => (
        <a href={String(row.url)} target="_blank" rel="noopener noreferrer" className={s.tableLink}>
          {v}
          <Icon name="external" size={12} />
        </a>
      ),
    },
    { key: 'org', label: t('resources.col.org') },
    { key: 'category', label: t('resources.col.category') },
    { key: 'region', label: t('resources.col.region') },
    { key: 'domain', label: t('resources.col.domain') },
  ];

  const reset = () => q.set({ q: null, cat: null, region: null });

  return (
    <div className="container">
      <PageHeader
        eyebrow={t('pages.resources.eyebrow')}
        title={t('pages.resources.title')}
        subtitle={t('pages.resources.subtitle')}
      />

      <p className={s.disclaimer}>
        <Icon name="info" size={16} />
        <span>
          {t('resources.disclaimer')}{' '}
          <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer">
            {t('resources.report')}
          </a>
          {' · '}
          <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </span>
      </p>

      {status === 'loading' && (
        <div className={s.grid} aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={170} radius={16} />
          ))}
        </div>
      )}
      {(status === 'error' || status === 'empty') && (
        <EmptyState
          icon="alert"
          title={status === 'error' ? t('common.error') : t('common.empty')}
          body={status === 'error' ? (error?.message ?? t('common.errorBody')) : t('common.emptyBody')}
        />
      )}

      {status === 'ready' && (
        <>
          {!filtering && featured.length > 0 && (
            <Section title={t('resources.featured')} id="featured">
              <ul className={s.featuredGrid}>
                {featured.map((r, i) => (
                  <LinkCard key={r.id} r={r} variant="featured" index={i} />
                ))}
              </ul>
            </Section>
          )}

          {!filtering && taiwan.length > 0 && (
            <Section title={t('resources.taiwan')} id="taiwan">
              <p className={s.sectionLead}>{t('resources.taiwanLead')}</p>
              <ul className={s.grid}>
                {taiwan.map((r, i) => (
                  <LinkCard key={r.id} r={r} variant="compact" index={i} />
                ))}
              </ul>
            </Section>
          )}

          <Section title={t('resources.all')} id="directory">
            <div className={s.toolbar}>
              <div className={s.searchRow}>
                <label className={s.search}>
                  <Icon name="search" size={18} />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => q.set({ q: e.target.value })}
                    placeholder={t('resources.searchPlaceholder')}
                    aria-label={t('resources.search')}
                    className={s.searchInput}
                  />
                </label>
                <SegmentedControl<View>
                  label={t('resources.view')}
                  value={view}
                  onChange={(v) => q.set({ view: v === 'cards' ? null : v })}
                  options={[
                    { value: 'cards', label: t('resources.viewCards') },
                    { value: 'table', label: t('resources.viewTable') },
                  ]}
                />
              </div>

              <div className={s.chipGroup} role="group" aria-label={t('resources.category')}>
                <span className={s.chipLabel}>{t('resources.category')}</span>
                <div className={s.chips}>
                  <button
                    type="button"
                    className={s.chip}
                    aria-pressed={cat === 'all'}
                    onClick={() => q.set({ cat: null })}
                  >
                    {t('common.all')} <span className={s.count}>{fmtNumber(catTotal, t.locale)}</span>
                  </button>
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={s.chip}
                      aria-pressed={cat === c}
                      disabled={!catCounts.get(c) && cat !== c}
                      onClick={() => q.set({ cat: cat === c ? null : c })}
                    >
                      {t(`resources.cat.${c}`)} <span className={s.count}>{catCounts.get(c) ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={s.chipGroup} role="group" aria-label={t('resources.regionLabel')}>
                <span className={s.chipLabel}>{t('resources.regionLabel')}</span>
                <div className={s.chips}>
                  <button
                    type="button"
                    className={s.chip}
                    aria-pressed={region === 'all'}
                    onClick={() => q.set({ region: null })}
                  >
                    {t('common.all')} <span className={s.count}>{fmtNumber(regionTotal, t.locale)}</span>
                  </button>
                  {REGIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={s.chip}
                      aria-pressed={region === c}
                      disabled={!regionCounts.get(c) && region !== c}
                      onClick={() => q.set({ region: region === c ? null : c })}
                    >
                      {t(`resources.region.${c}`)} <span className={s.count}>{regionCounts.get(c) ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={s.resultBar} aria-live="polite">
                <span>{t('resources.showing', { n: filtered.length, total: records.length })}</span>
                {filtering && (
                  <button type="button" className={s.clear} onClick={reset}>
                    {t('actions.reset')}
                  </button>
                )}
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon="search"
                title={t('resources.noMatch')}
                body={t('resources.noMatchBody')}
                action={
                  <button type="button" className={s.clear} onClick={reset}>
                    {t('actions.reset')}
                  </button>
                }
              />
            ) : view === 'cards' ? (
              <ul className={s.grid}>
                {filtered.map((r, i) => (
                  <LinkCard key={r.id} r={r} index={i} />
                ))}
              </ul>
            ) : (
              <DataTable
                rows={rows}
                columns={columns}
                caption={t('resources.tableCaption')}
                csvName="tw-amr-watch-resources"
                maxHeight={640}
              />
            )}
          </Section>
        </>
      )}
    </div>
  );
}
