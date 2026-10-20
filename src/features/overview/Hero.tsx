import { motion } from 'framer-motion';
import { useMeta } from '../../app/providers/DataProvider';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { ButtonLink } from '../../components/ui/IconButton';
import { usePrefersReducedMotion } from '../../components/ui/usePrefersReducedMotion';
import { useDataset } from '../../data/load';
import { fmtNumber } from '../../data/format';
import { useT } from '../../i18n';
import { isolateTotals } from '../resistance/lib';
import { PetriCanvas } from './PetriCanvas';
import s from './overview.module.css';

/**
 * Hospitals reporting to the THAS AR module. Not carried in any dataset envelope, so it is
 * quoted from the 2024 annual report text (貳; data/source/transcribed/2024/notes_antibiogram.md:
 * "329 hospitals reported to AR 108–113", i.e. 2019–2024).
 */
export const REPORTING_HOSPITALS = { count: 329, from: 2019, to: 2024, reportYear: 2024 } as const;

export function Hero() {
  const t = useT();
  const reduced = usePrefersReducedMotion();
  const { meta } = useMeta();
  const iso = useDataset('isolates');
  const latestYear = meta?.latestYear;
  const totals = iso.data ? isolateTotals(iso.data.records, { scope: 'all', organism: 'TOTAL' }) : [];
  const total = latestYear ? totals.find((r) => r.year === latestYear) ?? totals.at(-1) : totals.at(-1);
  const firstYear = meta?.yearsAvailable?.[0];

  const fade = (d: number) => (reduced ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: d, ease: [0.22, 1, 0.36, 1] } });

  return (
    <section className={s.hero} aria-labelledby="ov-title">
      <PetriCanvas className={s.heroCanvas} />
      <div className={s.heroInner}>
        <div className={s.heroText}>
          <motion.span className="eyebrow" {...fade(0)}>
            {t('overview.hero.eyebrow', { from: firstYear ?? '—', to: latestYear ?? '—' })}
          </motion.span>
          <motion.h1 id="ov-title" className={s.heroTitle} {...fade(0.05)}>
            {t('overview.hero.title')
              .split('|')
              .map((part, i) => (
                <span key={i} className={s.titlePart}>
                  {part}
                </span>
              ))}
          </motion.h1>
          <motion.p className={s.heroThesis} {...fade(0.12)}>
            {t('overview.hero.thesis')}
          </motion.p>
          <motion.div className={s.ctaRow} {...fade(0.2)}>
            <ButtonLink variant="primary" icon="chart" href="#/resistance">
              {t('overview.hero.ctaResistance')}
            </ButtonLink>
            <ButtonLink icon="globe" href="#/international">
              {t('overview.hero.ctaInternational')}
            </ButtonLink>
            <ButtonLink variant="ghost" icon="code" href="#/data">
              {t('overview.hero.ctaData')}
            </ButtonLink>
          </motion.div>
        </div>
        <motion.dl className={s.heroStats} {...fade(0.28)}>
          <div className={s.stat}>
            <dt>{t('overview.hero.latestYear')}</dt>
            <dd>
              <AnimatedNumber value={latestYear} from={firstYear ?? 0} format={(v) => String(Math.round(v))} duration={1100} />
            </dd>
            <span className={s.statNote}>{t('overview.hero.latestYearNote', { from: firstYear ?? '—' })}</span>
          </div>
          <div className={s.stat}>
            <dt>{t('overview.hero.hospitals')}</dt>
            <dd>
              <AnimatedNumber value={REPORTING_HOSPITALS.count} format={(v) => fmtNumber(Math.round(v), t.locale)} duration={1200} />
            </dd>
            <span className={s.statNote}>{t('overview.hero.hospitalsNote', { from: REPORTING_HOSPITALS.from, to: REPORTING_HOSPITALS.to })}</span>
          </div>
          <div className={s.stat}>
            <dt>{t('overview.hero.isolates', { year: total?.year ?? '—' })}</dt>
            <dd>
              <AnimatedNumber value={total?.isolates} format={(v) => fmtNumber(Math.round(v), t.locale)} duration={1400} />
            </dd>
            <span className={s.statNote}>{t('overview.hero.isolatesNote')}</span>
          </div>
        </motion.dl>
      </div>
    </section>
  );
}
