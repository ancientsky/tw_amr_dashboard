import { useMeta } from '../../app/providers/DataProvider';
import { deepLink } from '../../app/url';
import { Section } from '../../components/layout/PageHeader';
import { Icon } from '../../components/ui/icons';
import { localized } from '../../data/format';
import { useT } from '../../i18n';
import { CoHoGapChart } from '../resistance/charts/CoHoGapChart';
import { AntibiogramGlance } from './AntibiogramGlance';
import { Headlines } from './Headlines';
import { Hero } from './Hero';
import { MdroPulse } from './MdroPulse';
import { PathogenLandscape } from './PathogenLandscape';
import { Reveal } from './Reveal';
import { RisingGrid } from './RisingGrid';
import s from './overview.module.css';

/** Route "/" — national snapshot: hero, MDRO pulse, headlines, trends, CO/HO gap, landscape, antibiogram. */
export default function OverviewPage() {
  const t = useT();
  return (
    <div className="container">
      <Hero />

      <Reveal className={s.block}>
        <MdroPulse />
      </Reveal>

      <Section
        title={t('overview.headlines.title')}
        aside={<span className={s.sectionAside}>{t('overview.headlines.aside')}</span>}
      >
        <Headlines />
      </Section>

      <Section title={t('overview.sections.trends')}>
        <Reveal>
          <RisingGrid />
        </Reveal>
      </Section>

      <Section title={t('overview.sections.burden')}>
        <div className={s.twoCol}>
          <Reveal>
            <CoHoGapChart eyebrow={t('overview.coho.eyebrow')} link={deepLink('/resistance', { overlay: '1', chart: 'resistance-co-ho' })} />
          </Reveal>
          <Reveal delay={0.06}>
            <PathogenLandscape />
          </Reveal>
        </div>
      </Section>

      <Section title={t('overview.sections.antibiogram')}>
        <Reveal>
          <AntibiogramGlance />
        </Reveal>
      </Section>

      <ProvisionalLine />
      <SourceFooter />
    </div>
  );
}

/** One-line pointer to the sections that still use provisional curated estimates. */
function ProvisionalLine() {
  const t = useT();
  const { meta } = useMeta();
  const prov = meta?.provisionalDatasets ?? [];
  if (meta && !prov.some((d) => ['antibiotic_use', 'hai', 'hai_pathogens', 'glass'].includes(d))) return null;
  return (
    <p className={s.provLine} role="note">
      <Icon name="info" size={16} />
      <span>
        {t('overview.provisional.lead')}{' '}
        <a href="#/antibiotic-use">{t('nav.antibioticUse')}</a> · <a href="#/hai">{t('nav.hai')}</a> · <a href="#/international">{t('nav.international')}</a>
      </span>
    </p>
  );
}

function SourceFooter() {
  const t = useT();
  const { meta } = useMeta();
  const reports = (meta?.sources ?? []).filter((x) => x.kind === 'annual-report' && x.id.startsWith('tw-cdc-amr')).sort((a, b) => a.year - b.year);
  const api = `${import.meta.env.BASE_URL}api/v1/index.json`;
  return (
    <footer className={s.sources}>
      <div>
        <h2 className={s.sourcesTitle}>{t('overview.sources.title')}</h2>
        <p className={s.sourcesBody}>{t('overview.sources.body')}</p>
      </div>
      <ul className={s.sourceList}>
        {reports.map((r) => (
          <li key={r.id}>
            <a href={r.url} target="_blank" rel="noreferrer" className={s.sourceItem}>
              <span className={s.sourceYear}>{r.year}</span>
              <span>
                <span className={s.sourceName}>{localized(r.title, t.locale)}</span>
                <span className={s.sourcePub}>{r.publisher}</span>
              </span>
              <Icon name="external" size={14} />
            </a>
          </li>
        ))}
      </ul>
      <div className={s.sourceLinks}>
        <a href="#/data" className={s.footLink}>
          <Icon name="download" size={16} /> {t('overview.sources.download')}
        </a>
        <a href={api} className={s.footLink}>
          <Icon name="code" size={16} /> {t('overview.sources.api')}
        </a>
        <a href="#/about" className={s.footLink}>
          <Icon name="info" size={16} /> {t('overview.sources.method')}
        </a>
      </div>
    </footer>
  );
}
