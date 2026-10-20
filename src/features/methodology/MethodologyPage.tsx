import { motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMeta } from '../../app/providers/DataProvider';
import { REPO_URL } from '../../app/url';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge, ButtonLink, Icon, IconButton, usePrefersReducedMotion } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { fmtNumber } from '../../data/format';
import { useDataset } from '../../data/load';
import type { IngestionPdf } from '../../data/types';
import { useT } from '../../i18n';
import { copyText } from '../../lib/download';
import { GlossaryBrowser } from './GlossaryBrowser';
import s from './methodology.module.css';

const SECTIONS = [
  'purpose',
  'sources',
  'produced',
  'definitions',
  'provisional',
  'glossary',
  'changelog',
  'credits',
  'accessibility',
  'privacy',
] as const;
type SectionId = (typeof SECTIONS)[number];
const sid = (k: SectionId) => `about-${k}`;

const README_ADD = `${REPO_URL}#adding-reports`;
const TCDC_URL = 'https://www.cdc.gov.tw/Category/MPage/4G8HuDdUN1k4xaBJhbPzKQ';

function Block({ id, n, children }: { id: SectionId; n: number; children: ReactNode }) {
  const t = useT();
  return (
    <section id={sid(id)} className={s.block} aria-labelledby={`${sid(id)}-h`}>
      <header className={s.blockHead}>
        <span className={s.blockNum} aria-hidden="true">
          {String(n).padStart(2, '0')}
        </span>
        <h2 id={`${sid(id)}-h`} className={s.blockTitle}>
          {t(`about.toc.${id}`)}
        </h2>
      </header>
      {children}
    </section>
  );
}

function pdfInfo(p: IngestionPdf | string) {
  if (typeof p === 'string')
    return { file: p } as { file: string; year?: number; sha?: string; bytes?: number };
  return {
    file: (p.file ?? p.name ?? '') as string,
    year: (p.reportYear ?? p.year) as number | undefined,
    sha: p.sha256,
    bytes: p.bytes as number | undefined,
  };
}

function fmtMb(n: number | undefined, locale: string) {
  return n ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n / 1048576)} MB` : '—';
}

export default function MethodologyPage() {
  const t = useT();
  const toast = useToast();
  const reduced = usePrefersReducedMotion();
  const { meta } = useMeta();
  const isolates = useDataset('isolates');
  const resistance = useDataset('resistance');
  const [active, setActive] = useState<SectionId>('purpose');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id.replace('about-', '') as SectionId);
      },
      { rootMargin: '-90px 0px -65% 0px' },
    );
    SECTIONS.forEach((k) => {
      const el = document.getElementById(sid(k));
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  const go = (k: SectionId) => {
    document
      .getElementById(sid(k))
      ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setActive(k);
  };

  const pdfs = useMemo(
    () =>
      (meta?.ingestion?.pdfs ?? [])
        .map(pdfInfo)
        .filter((p) => p.file)
        .sort((a, b) => (a.year ?? 0) - (b.year ?? 0)),
    [meta],
  );
  const years = meta?.yearsAvailable ?? [];
  const yMin = years.length ? Math.min(...years) : 2017;
  const yMax = meta?.latestYear ?? (years.length ? Math.max(...years) : 2024);

  const totals = useMemo(() => {
    const rec = isolates.data?.records ?? [];
    const pick = (y: number) =>
      rec.find(
        (r) =>
          r.organism === 'TOTAL' &&
          r.scope === 'all' &&
          (r.level ?? 'all') === 'all' &&
          !r.subset &&
          r.year === y,
      )?.isolates;
    return { first: pick(yMin), last: pick(yMax) };
  }, [isolates.data, yMin, yMax]);

  const precision = (resistance.data as { meta?: { precisionSummary?: Record<string, number> } } | null)?.meta
    ?.precisionSummary;
  const provisional = meta?.provisionalDatasets ?? ['antibiotic_use', 'hai', 'hai_pathogens', 'glass'];

  const copy = async (text: string) => {
    if (await copyText(text)) toast(t('actions.copied'));
  };

  const rawPdf = (file: string) =>
    `${REPO_URL}/raw/main/${file.split('/').map(encodeURIComponent).join('/')}`;

  return (
    <div className="container">
      <PageHeader
        eyebrow={t('pages.about.eyebrow')}
        title={t('pages.about.title')}
        subtitle={t('pages.about.subtitle')}
      />

      <div className={s.layout}>
        <nav className={s.toc} aria-label={t('about.nav.label')}>
          <ol className={s.tocList}>
            {SECTIONS.map((k, i) => (
              <li key={k}>
                <button
                  type="button"
                  className={[s.tocBtn, active === k ? s.tocActive : ''].join(' ')}
                  aria-current={active === k ? 'true' : undefined}
                  onClick={() => go(k)}
                >
                  <span className={s.tocNum}>{String(i + 1).padStart(2, '0')}</span>
                  <span>{t(`about.toc.${k}`)}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <motion.div
          className={s.content}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* 1 purpose */}
          <Block id="purpose" n={1}>
            <p className={s.lead}>{t('about.purpose.lead')}</p>
            <p className={s.prose}>{t('about.purpose.body')}</p>
            <h3 className={s.h3}>{t('about.purpose.audienceTitle')}</h3>
            <ul className={s.chipsRow}>
              {(['ic', 'micro', 'id', 'epi'] as const).map((k) => (
                <li key={k} className={s.audience}>
                  <strong>{t(`about.purpose.audience.${k}.t`)}</strong>
                  <span>{t(`about.purpose.audience.${k}.d`)}</span>
                </li>
              ))}
            </ul>
            <p className={s.callout}>
              <Icon name="info" size={16} />
              <span>{t('about.purpose.notice')}</span>
            </p>
          </Block>

          {/* 2 sources */}
          <Block id="sources" n={2}>
            <p className={s.prose}>{t('about.sources.lead')}</p>
            <ul className={s.stats}>
              <li className={s.stat}>
                <span className={s.statLabel}>{t('about.sources.hospitals')}</span>
                <span className={s.statValue}>
                  134 <span className={s.arrow}>→</span> 329
                </span>
                <span className={s.statNote}>
                  {t('about.sources.hospitalsNote', { from: yMin, to: yMax })}
                </span>
              </li>
              <li className={s.stat}>
                <span className={s.statLabel}>{t('about.sources.dataYears')}</span>
                <span className={s.statValue}>
                  {yMin}–{yMax}
                </span>
                <span className={s.statNote}>
                  {t('about.sources.dataYearsNote', { n: pdfs.length || 3 })}
                </span>
              </li>
              <li className={s.stat}>
                <span className={s.statLabel}>{t('about.sources.isolates')}</span>
                <span className={s.statValue}>
                  {totals.first ? fmtNumber(totals.first, t.locale, { compact: true }) : '—'}{' '}
                  <span className={s.arrow}>→</span>{' '}
                  {totals.last ? fmtNumber(totals.last, t.locale, { compact: true }) : '—'}
                </span>
                <span className={s.statNote}>
                  {t('about.sources.isolatesNote', { from: yMin, to: yMax })}
                </span>
              </li>
            </ul>

            <ul className={s.editions}>
              {pdfs.map((p) => (
                <li key={p.file} className={s.edition}>
                  <div className={s.editionHead}>
                    <h3 className={s.h3}>{t('about.sources.edition', { year: p.year ?? '' })}</h3>
                    <Badge tone="accent" dot>
                      {t('about.sources.ingested')}
                    </Badge>
                  </div>
                  <p className={s.editionTitle}>
                    {t.tl(meta?.sources.find((x) => x.id === `tw-cdc-amr-${p.year}`)?.title)}
                  </p>
                  <dl className={s.kv}>
                    <div>
                      <dt>{t('about.sources.coverage')}</dt>
                      <dd>{p.year ? `${p.year - 5}–${p.year}` : '—'}</dd>
                    </div>
                    <div>
                      <dt>{t('about.sources.size')}</dt>
                      <dd>{fmtMb(p.bytes, t.locale)}</dd>
                    </div>
                    <div className={s.kvWide}>
                      <dt>SHA-256</dt>
                      <dd className={s.hash}>
                        <code>{p.sha ?? '—'}</code>
                        {p.sha && (
                          <IconButton
                            icon="copy"
                            label={t('actions.copy')}
                            size="sm"
                            onClick={() => copy(p.sha!)}
                          />
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className={s.editionLinks}>
                    <ButtonLink href={rawPdf(p.file)} target="_blank" rel="noopener" icon="external">
                      PDF
                    </ButtonLink>
                    <ButtonLink href={TCDC_URL} target="_blank" rel="noopener" icon="external">
                      Taiwan CDC
                    </ButtonLink>
                  </div>
                </li>
              ))}
            </ul>
            <p className={s.fine}>{t('about.sources.verify')}</p>
          </Block>

          {/* 3 produced */}
          <Block id="produced" n={3}>
            <p className={s.prose}>{t('about.produced.lead')}</p>
            <ul className={s.methods}>
              {(['table', 'text', 'chart'] as const).map((k) => {
                const count = precision?.[k === 'chart' ? 'chart_estimate' : k];
                return (
                  <li key={k} className={[s.method, s[`m_${k}`]].join(' ')}>
                    <div className={s.methodHead}>
                      <Badge tone={k === 'chart' ? 'warn' : 'accent'}>{t(`about.produced.${k}.badge`)}</Badge>
                      {count !== undefined && (
                        <span className={s.methodCount}>
                          {t('about.produced.values', { n: fmtNumber(count, t.locale) })}
                        </span>
                      )}
                    </div>
                    <h3 className={s.h3}>{t(`about.produced.${k}.t`)}</h3>
                    <p className={s.methodBody}>{t(`about.produced.${k}.d`)}</p>
                    <div className={s.methodErr}>{t(`about.produced.${k}.err`)}</div>
                  </li>
                );
              })}
            </ul>
            <h3 className={s.h3}>{t('about.produced.dedupTitle')}</h3>
            <div className={s.dedup} role="img" aria-label={t('about.produced.dedupAria')}>
              <span className={s.dedupStep}>{t('about.produced.dedup1')}</span>
              <span className={s.dedupGt} aria-hidden="true">
                &gt;
              </span>
              <span className={s.dedupStep}>{t('about.produced.dedup2')}</span>
              <span className={s.dedupGt} aria-hidden="true">
                &gt;
              </span>
              <span className={s.dedupStep}>{t('about.produced.dedup3')}</span>
              <span className={s.dedupThen}>{t('about.produced.dedupThen')}</span>
            </div>
            <p className={s.prose}>{t('about.produced.dedupBody')}</p>
            <p className={s.prose}>{t('about.produced.mapping')}</p>
          </Block>

          {/* 4 definitions */}
          <Block id="definitions" n={4}>
            <dl className={s.defs}>
              {(['nonsus', 'onset', 'levels', 'suppress', 'first', 'precision'] as const).map((k) => (
                <div key={k} className={s.def}>
                  <dt>{t(`about.defs.${k}.t`)}</dt>
                  <dd>{t(`about.defs.${k}.d`)}</dd>
                </div>
              ))}
            </dl>
          </Block>

          {/* 5 provisional */}
          <Block id="provisional" n={5}>
            <p className={s.prose}>{t('about.prov.lead')}</p>
            <ul className={s.provList}>
              {provisional.map((d) => (
                <li key={d}>
                  <Badge tone="warn" dot>
                    {t('provisional.chip')}
                  </Badge>
                  <span>{t(`data.ds.${d}.name`)}</span>
                </li>
              ))}
            </ul>
            <p className={s.prose}>{t('about.prov.why')}</p>
            <h3 className={s.h3}>{t('about.prov.howTitle')}</h3>
            <ol className={s.steps}>
              {(['s1', 's2', 's3'] as const).map((k) => (
                <li key={k}>{t(`about.prov.${k}`)}</li>
              ))}
            </ol>
            <div className={s.row}>
              <ButtonLink href={README_ADD} target="_blank" rel="noopener" icon="external" variant="primary">
                {t('about.prov.readme')}
              </ButtonLink>
            </div>
          </Block>

          {/* 6 glossary */}
          <Block id="glossary" n={6}>
            <p className={s.prose}>{t('about.glossary.lead')}</p>
            <GlossaryBrowser />
          </Block>

          {/* 7 changelog */}
          <Block id="changelog" n={7}>
            <ol className={s.changelog}>
              <li>
                <div className={s.clHead}>
                  <strong>v0.1.0</strong>
                  <span className={s.clDate}>2026-10-20</span>
                  <Badge tone="info">{t('about.changelog.first')}</Badge>
                </div>
                <ul className={s.bullets}>
                  {(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const).map((k) => (
                    <li key={k}>{t(`about.changelog.v01.${k}`)}</li>
                  ))}
                </ul>
              </li>
            </ol>
          </Block>

          {/* 8 credits */}
          <Block id="credits" n={8}>
            <p className={s.prose}>{t('about.credits.body')}</p>
            <ul className={s.bullets}>
              {(['data', 'who', 'oss'] as const).map((k) => (
                <li key={k}>{t(`about.credits.${k}`)}</li>
              ))}
            </ul>
            <h3 className={s.h3}>{t('about.credits.contactTitle')}</h3>
            <p className={s.prose}>{t('about.credits.contactBody')}</p>
            <div className={s.row}>
              <ButtonLink
                href={`${REPO_URL}/issues`}
                target="_blank"
                rel="noopener"
                icon="external"
                variant="primary"
              >
                {t('about.credits.issues')}
              </ButtonLink>
              <ButtonLink href={REPO_URL} target="_blank" rel="noopener" icon="code">
                {t('footer.github')}
              </ButtonLink>
              <Link className={s.inlineLink} to="/data">
                {t('about.credits.citeLink')}
              </Link>
            </div>
          </Block>

          {/* 9 accessibility */}
          <Block id="accessibility" n={9}>
            <p className={s.prose}>{t('about.access.lead')}</p>
            <ul className={s.bullets}>
              {(['kbd', 'sr', 'contrast', 'motion', 'lang'] as const).map((k) => (
                <li key={k}>{t(`about.access.${k}`)}</li>
              ))}
            </ul>
            <p className={s.prose}>{t('about.access.limits')}</p>
          </Block>

          {/* 10 privacy */}
          <Block id="privacy" n={10}>
            <p className={s.prose}>{t('about.privacy.lead')}</p>
            <ul className={s.bullets}>
              {(['none', 'local', 'key', 'external', 'host'] as const).map((k) => (
                <li key={k}>{t(`about.privacy.${k}`)}</li>
              ))}
            </ul>
          </Block>
        </motion.div>
      </div>
    </div>
  );
}
