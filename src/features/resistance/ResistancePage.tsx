import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Drawer } from '../../components/ui/Modal';
import { Button } from '../../components/ui/IconButton';
import { Tabs } from '../../components/ui/Tabs';
import { usePrefersReducedMotion } from '../../components/ui/usePrefersReducedMotion';
import { useT } from '../../i18n';
import { AntibiogramView } from './AntibiogramView';
import { CompareView } from './CompareView';
import { ControlRail } from './ControlRail';
import { Methodology } from './Methodology';
import { useResistanceModel } from './model';
import { PathogenView } from './PathogenView';
import { TrendView } from './TrendView';
import { useExplorerState, VIEWS, type View } from './useExplorerState';
import s from './resistance.module.css';

/** Route "/resistance" — URL-driven resistance explorer (trend · antibiogram · pathogen · compare). */
export default function ResistancePage() {
  const t = useT();
  const reduced = usePrefersReducedMotion();
  const { state, update, link } = useExplorerState();
  const { env, ab, names } = useResistanceModel();
  const [drawer, setDrawer] = useState(false);
  const idBase = 'rx';

  const rail = <ControlRail state={state} update={update} env={env} ab={ab} names={names} />;
  const summary = summaryChips(state, t, names);

  return (
    <div className="container">
      <PageHeader eyebrow={t('pages.resistance.eyebrow')} title={t('pages.resistance.title')} subtitle={t('resistance.page.subtitle')} />
      <div className={s.tabsRow}>
        <Tabs
          items={VIEWS.map((v) => ({ value: v, label: t(`resistance.views.${v}`) }))}
          value={state.view}
          onChange={(v: View) => update({ view: v })}
          label={t('resistance.views.label')}
          idBase={idBase}
          className={s.tabs}
        />
        <Button icon="menu" className={s.filterBtn} onClick={() => setDrawer(true)} aria-haspopup="dialog">
          {t('resistance.rail.filters')}
        </Button>
      </div>
      <p className={s.viewIntro}>{t(`resistance.views.${state.view}Intro`)}</p>
      <div className={s.mobileSummary} aria-hidden="true">
        {summary.map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      <div className={s.layout}>
        <aside className={s.railCol} aria-label={t('resistance.rail.label')}>
          {rail}
        </aside>
        <div className={s.main} role="tabpanel" id={`${idBase}-panel-${state.view}`} aria-labelledby={`${idBase}-tab-${state.view}`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={state.view}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
              exit={reduced ? { opacity: 1 } : { opacity: 0, y: -6, transition: { duration: 0.14 } }}
            >
              {state.view === 'trend' && <TrendView state={state} update={update} link={link} />}
              {state.view === 'antibiogram' && <AntibiogramView state={state} update={update} link={link} />}
              {state.view === 'pathogen' && <PathogenView state={state} update={update} link={link} />}
              {state.view === 'compare' && <CompareView state={state} link={link} />}
            </motion.div>
          </AnimatePresence>
          <Methodology />
        </div>
      </div>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={t('resistance.rail.filters')} side="left" width={340}>
        {rail}
      </Drawer>
    </div>
  );
}

function summaryChips(state: ReturnType<typeof useExplorerState>['state'], t: ReturnType<typeof useT>, names: ReturnType<typeof useResistanceModel>['names']): string[] {
  switch (state.view) {
    case 'trend':
      return [state.phenotypes.join(' · '), names.setting(state.setting), `${state.years[0]}–${state.years[1]}`];
    case 'antibiogram':
      return [String(state.year ?? t('resistance.common.latest')), names.level(state.level)];
    case 'pathogen':
      return [names.pathogenShort(state.pathogen), state.antibiotic, names.level(state.level)];
    default:
      return [state.items.join(' · '), names.level(state.level)];
  }
}
