import { useMemo } from 'react';
import { useHashQuery, useQueryParam } from '../../app/hooks/useHashQuery';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { PageHeader, Section } from '../../components/layout/PageHeader';
import { Field } from '../../components/ui/Field';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { RangeSlider } from '../../components/ui/RangeSlider';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select } from '../../components/ui/Select';
import { dimNamer } from '../../data/format';
import { useDataset } from '../../data/load';
import { extentYears } from '../../data/select';
import type { Level } from '../../data/types';
import { useT } from '../../i18n';
import { FilterBar, Notice } from '../international/kit/Kit';
import { useListParam, useYearRangeParam } from '../international/kit/hooks';
import k from '../international/kit/kit.module.css';
import { AmuAware } from './AmuAware';
import { AmuKpis, AmuTarget } from './AmuKpis';
import { AmuMethodology, TW_CDC_URL } from './AmuMethodology';
import { AmuScatter } from './AmuScatter';
import { AmuSlope } from './AmuSlope';
import { AmuStacked, type AmuMetric } from './AmuStacked';
import { AmuTreemap } from './AmuTreemap';
import { classColor, classOrder, levelsOf } from './amuModel';

const NO_CLASSES: string[] = [];

/** Route "/antibiotic-use" — inpatient antibiotic consumption (provisional model data). */
export default function AntibioticUsePage() {
  const t = useT();
  const q = useHashQuery();
  const ct = useChartTheme();
  const { data: env } = useDataset('antibiotic_use');
  const dims = env?.dims?.classes;
  const levels = useMemo(() => levelsOf(env), [env]);
  const order = useMemo(() => classOrder(dims), [dims]);
  const bounds = useMemo(() => (env ? extentYears(env.records) : undefined), [env]);
  const nameCls = dimNamer(dims, t.locale);

  const [level, setLevel] = useQueryParam<Level>(
    'level',
    'all',
    levels.length ? levels : ['all', 'medical_center', 'regional', 'district'],
  );
  const [metric, setMetric] = useQueryParam<AmuMetric>('metric', 'DID', ['DID', 'share']);
  const [classes, setClasses] = useListParam('classes', env ? order : undefined, NO_CLASSES);
  const [years, setYears] = useYearRangeParam('years', bounds);
  const link = (chart: string) => q.link({ chart });

  return (
    <div className={`container ${k.page}`}>
      <PageHeader
        eyebrow={t('pages.antibioticUse.eyebrow')}
        title={t('pages.antibioticUse.title')}
        subtitle={t('pages.antibioticUse.subtitle')}
        aside={<AmuMethodology />}
      />
      <Notice
        title={t('amu.notice.title')}
        links={[{ href: TW_CDC_URL, label: t('amu.notice.cdcLink'), external: true }]}
      >
        <p>{t('amu.notice.body')}</p>
        <p>
          {t('amu.notice.how')} <code>raw/</code>
        </p>
      </Notice>

      <FilterBar label={t('amu.filters')}>
        <Select
          showLabel
          label={t('common.level')}
          value={level}
          onChange={setLevel}
          options={levels.map((l) => ({ value: l, label: t(`levels.${l}`) }))}
        />
        <Field label={t('amu.metricLabel')}>
          <SegmentedControl<AmuMetric>
            label={t('amu.metricLabel')}
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'DID', label: t('amu.metric.DID') },
              { value: 'share', label: t('amu.metric.share') },
            ]}
          />
        </Field>
        <MultiSelect
          showLabel
          label={t('amu.classesLabel')}
          value={classes}
          onChange={(v) => setClasses(v.length === order.length ? [] : order.filter((c) => v.includes(c)))}
          minWidth={200}
          options={order.map((c) => ({ value: c, label: nameCls(c), color: classColor(dims, c, ct.theme) }))}
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
        <AmuKpis level={level} years={years} link={link('amu-kpis')} />
        <AmuStacked
          level={level}
          metric={metric}
          classes={classes.length ? classes : undefined}
          years={years}
          onClassesChange={setClasses}
          link={link('amu-stacked')}
        />
        <div className={k.grid2}>
          <AmuAware level={level} years={years} link={link('amu-aware')} />
          <div className={k.stack}>
            <AmuTarget level={level} years={years} link={link('amu-target')} />
            <AmuSlope level={level} years={years} link={link('amu-slope')} />
          </div>
        </div>
      </div>
      <Section title={t('amu.sectionDeeper')}>
        <div className={k.grid2}>
          <AmuTreemap level={level} years={years} link={link('amu-treemap')} />
          <AmuScatter years={years} link={link('amu-scatter')} />
        </div>
      </Section>
    </div>
  );
}
