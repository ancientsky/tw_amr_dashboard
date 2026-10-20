import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Section, PageHeader } from '../../components/layout/PageHeader';
import { Icon, type IconName } from '../../components/ui';
import { usePrefersReducedMotion } from '../../components/ui';
import { useT } from '../../i18n';
import { ApiExplorer } from './ApiExplorer';
import { CitationBox } from './CitationBox';
import { DownloadsSection } from './DownloadsSection';
import { EmbedBuilder } from './EmbedBuilder';
import { ApiFacts } from './ApiFacts';
import s from './dataApi.module.css';

const SECTIONS: { id: string; key: 'downloads' | 'api' | 'embed' | 'cite'; icon: IconName }[] = [
  { id: 'data-downloads', key: 'downloads', icon: 'download' },
  { id: 'data-api', key: 'api', icon: 'code' },
  { id: 'data-embed', key: 'embed', icon: 'chart' },
  { id: 'data-cite', key: 'cite', icon: 'copy' },
];

/** Route "/data" — downloads, API explorer, embed builder, citation. */
export default function DataApiPage() {
  const t = useT();
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: '-90px 0px -60% 0px' },
    );
    SECTIONS.forEach((x) => {
      const el = document.getElementById(x.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setActive(id);
  };

  return (
    <div className="container">
      <PageHeader
        eyebrow={t('pages.data.eyebrow')}
        title={t('pages.data.title')}
        subtitle={t('pages.data.subtitle')}
      />

      <nav className={s.jump} aria-label={t('data.nav.label')}>
        {SECTIONS.map((x) => (
          <button
            key={x.id}
            type="button"
            className={[s.jumpBtn, active === x.id ? s.jumpActive : ''].join(' ')}
            aria-current={active === x.id ? 'true' : undefined}
            onClick={() => go(x.id)}
          >
            <Icon name={x.icon} size={16} />
            {t(`data.nav.${x.key}`)}
          </button>
        ))}
      </nav>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <Section id="data-downloads" title={t('data.dl.title')}>
          <p className={s.sectionLead}>{t('data.dl.lead')}</p>
          <DownloadsSection />
        </Section>
        <Section id="data-api" title={t('data.api.title')}>
          <p className={s.sectionLead}>{t('data.api.lead')}</p>
          <ApiFacts />
          <ApiExplorer />
        </Section>
        <Section id="data-embed" title={t('data.embed.title')}>
          <p className={s.sectionLead}>{t('data.embed.lead')}</p>
          <EmbedBuilder />
        </Section>
        <Section id="data-cite" title={t('data.cite.title')}>
          <p className={s.sectionLead}>{t('data.cite.lead')}</p>
          <CitationBox />
        </Section>
      </motion.div>
    </div>
  );
}
