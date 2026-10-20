import { useMemo } from 'react';
import { useHashQuery, useQueryParam } from '../../app/hooks/useHashQuery';
import { PageHeader, Section } from '../../components/layout/PageHeader';
import { RangeSlider } from '../../components/ui/RangeSlider';
import { Select } from '../../components/ui/Select';
import { dimNamer } from '../../data/format';
import { useDataset } from '../../data/load';
import { extentYears } from '../../data/select';
import type { IcuType, Level } from '../../data/types';
import { useT } from '../../i18n';
import { FilterBar, Notice } from '../international/kit/Kit';
import { useYearRangeParam } from '../international/kit/hooks';
import k from '../international/kit/kit.module.css';
import { HaiBump, HaiShare } from './HaiBump';
import { HaiHeatmap } from './HaiHeatmap';
import { HaiKpis } from './HaiKpis';
import { HaiLinks } from './HaiLinks';
import { HaiMethodology, TNIS_URL } from './HaiMethodology';
import { HaiTrend } from './HaiTrend';
import { HaiUtil } from './HaiUtil';
import {
  ICU_ORDER,
  LEVELS_HAI,
  SITES,
  TREND_METRICS,
  icuTypesFor,
  type Site,
  type TrendMetric,
} from './haiModel';

/** Route "/hai" — healthcare-associated infections in ICUs (provisional model data). */
export default function HaiPage() {
  const t = useT();
  const q = useHashQuery();
  const { data: env } = useDataset('hai');
  const bounds = useMemo(() => (env ? extentYears(env.records) : undefined), [env]);
  const nameIcu = dimNamer(env?.dims?.icuTypes, t.locale);
  const nameM = dimNamer(env?.dims?.metrics, t.locale);

  const [level, setLevel] = useQueryParam<Level>('level', 'all', LEVELS_HAI);
  const icus = useMemo(() => (env ? icuTypesFor(env.records, level) : ICU_ORDER), [env, level]);
  const [icuRaw, setIcu] = useQueryParam<IcuType>('icu', 'all', ICU_ORDER);
  const icu: IcuType = icus.includes(icuRaw) ? icuRaw : 'all';
  const [metric, setMetric] = useQueryParam<TrendMetric>('metric', 'clabsi', TREND_METRICS);
  const [site, setSite] = useQueryParam<Site>('site', 'bsi', SITES);
  const [years, setYears] = useYearRangeParam('years', bounds);
  const link = (chart: string) => q.link({ chart });

  return (
    <div className={`container ${k.page}`}>
      <PageHeader
        eyebrow={t('pages.hai.eyebrow')}
        title={t('pages.hai.title')}
        subtitle={t('pages.hai.subtitle')}
        aside={<HaiMethodology />}
      />
      <Notice
        title={t('hai.notice.title')}
        links={[{ href: TNIS_URL, label: t('hai.notice.cdcLink'), external: true }]}
      >
        <p>{t('hai.notice.body')}</p>
        <p>
          {t('hai.notice.how')} <code>raw/</code>
        </p>
      </Notice>

      <FilterBar label={t('hai.filters')}>
        <Select
          showLabel
          label={t('common.level')}
          value={level}
          onChange={setLevel}
          options={LEVELS_HAI.map((l) => ({ value: l, label: t(`levels.${l}`) }))}
        />
        <Select
          showLabel
          label={t('hai.icu')}
          value={icu}
          onChange={setIcu}
          options={icus.map((i) => ({ value: i, label: nameIcu(i) }))}
        />
        <Select
          showLabel
          label={t('hai.metric')}
          value={metric}
          onChange={setMetric}
          options={TREND_METRICS.map((m) => ({ value: m, label: nameM(m) }))}
        />
        {bounds && years && (
          <RangeSlider
            className={k.filterGrow}
            label={t('common.years')}
            min={bounds[0]}
            max={bounds[1]}
            value={years}
            onChange={setYears}
          />
        )}
      </FilterBar>

      <div className={k.stack}>
        <HaiKpis level={level} icu={icu} years={years} link={link('hai-kpis')} />
        <div className={`${k.grid2} ${k.grid2wide}`}>
          <HaiTrend level={level} icu={icu} metric={metric} years={years} link={link('hai-trend')} />
          <div className={k.stack}>
            <HaiUtil level={level} icu={icu} years={years} link={link('hai-util')} />
            <HaiHeatmap level={level} icu={icu} metric={metric} years={years} link={link('hai-heatmap')} />
          </div>
        </div>
      </div>

      <Section title={t('hai.sectionPathogens')}>
        {level === 'district' && (
          <p className={k.hint} style={{ marginBottom: 12 }}>
            {t('hai.districtFallback')}
          </p>
        )}
        <div className={`${k.grid2} ${k.grid2wide}`}>
          <HaiBump level={level} site={site} onSiteChange={setSite} years={years} link={link('hai-bump')} />
          <HaiShare level={level} years={years} link={link('hai-share')} />
        </div>
      </Section>

      <Section title={t('hai.links.title')} aside={<span className={k.hint}>{t('hai.links.hint')}</span>}>
        <HaiLinks level={level} />
      </Section>
    </div>
  );
}
