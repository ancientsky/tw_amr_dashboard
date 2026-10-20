import { useCallback, useMemo } from 'react';
import { useHashQuery, useQueryParam } from '../../app/hooks/useHashQuery';
import { PageHeader, Section } from '../../components/layout/PageHeader';
import { ButtonLink } from '../../components/ui/IconButton';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../components/ui/Toast';
import { dimNamer } from '../../data/format';
import { useDataset } from '../../data/load';
import { useT } from '../../i18n';
import { Comparability } from './Comparability';
import { GlassBars, type BarsView } from './GlassBars';
import { GlassMap } from './GlassMap';
import { GlassRadar, GlassStrip, compareColors } from './GlassProfile';
import { DEFAULT_COUNTRIES, DEFAULT_INDICATOR, GLASS_CSV, GLASS_DASHBOARD_URL, GLASS_REPORT_URL, MAX_COMPARE, WHO_REGIONS, indicatorCodes } from './glassModel';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { FilterBar, Notice } from './kit/Kit';
import { useListParam } from './kit/hooks';
import k from './kit/kit.module.css';

/** Route "/international" — Taiwan vs WHO GLASS countries (bloodstream isolates). */
export default function InternationalPage() {
  const t = useT();
  const q = useHashQuery();
  const toast = useToast();
  const ct = useChartTheme();
  const { data: env } = useDataset('glass');
  const indicators = useMemo(() => indicatorCodes(env), [env]);
  const countryCodes = useMemo(() => (env?.dims?.countries ?? []).map((c) => c.code).filter((c) => c !== 'TWN'), [env]);
  const years = useMemo(() => [...new Set((env?.records ?? []).filter((r) => r.iso3 !== 'TWN').map((r) => String(r.year)))].sort(), [env]);

  const [indicator, setIndicator] = useQueryParam<string>('indicator', DEFAULT_INDICATOR, indicators.length ? indicators : undefined);
  const [region, setRegion] = useQueryParam<string>('region', 'all', ['all', ...WHO_REGIONS]);
  const [year, setYear] = useQueryParam<string>('year', 'latest', years.length ? ['latest', ...years] : undefined);
  const [bars, setBars] = useQueryParam<BarsView>('bars', 'countries', ['countries', 'regions']);
  const [countries, setCountries] = useListParam('countries', env ? countryCodes : undefined, DEFAULT_COUNTRIES);
  const compare = countries.slice(0, MAX_COMPARE);

  const nameC = dimNamer(env?.dims?.countries, t.locale);
  const nameI = dimNamer(env?.dims?.indicators, t.locale);
  const nameR = dimNamer(env?.dims?.whoRegions, t.locale);
  const color = compareColors(compare, ct.theme, ct.tokens.ink);

  const addCountry = useCallback(
    (iso: string) => {
      if (compare.includes(iso)) {
        toast(t('international.toast.already', { country: nameC(iso) }), 'check');
        return;
      }
      const next = compare.length >= MAX_COMPARE ? [...compare.slice(1), iso] : [...compare, iso];
      setCountries(next);
      toast(t('international.toast.added', { country: nameC(iso) }), 'check');
    },
    [compare, setCountries, toast, t, nameC],
  );

  const link = (chart: string) => q.link({ chart });

  return (
    <div className={`container ${k.page}`}>
      <PageHeader
        eyebrow={t('pages.international.eyebrow')}
        title={t('pages.international.title')}
        subtitle={t('pages.international.subtitle')}
        aside={
          <ButtonLink href={GLASS_DASHBOARD_URL} target="_blank" rel="noreferrer" icon="external">
            {t('international.glassDashboard')}
          </ButtonLink>
        }
      />
      <Notice
        title={t('international.notice.title')}
        links={[
          { href: GLASS_DASHBOARD_URL, label: t('international.glassDashboard'), external: true },
          { href: GLASS_REPORT_URL, label: t('international.glassReport'), external: true },
          { href: '#comparability', label: t('international.notice.compLink') },
        ]}
      >
        <p>{t('international.notice.body')}</p>
        <p>
          {t('international.notice.update')} <code>{GLASS_CSV}</code>
        </p>
      </Notice>

      <FilterBar label={t('international.filters')}>
        <Select
          className={k.filterGrow}
          showLabel
          label={t('international.indicator')}
          value={indicator}
          onChange={setIndicator}
          options={indicators.map((c) => ({ value: c, label: nameI(c) }))}
        />
        <Select
          showLabel
          label={t('international.region')}
          value={region}
          onChange={setRegion}
          options={[{ value: 'all', label: t('international.allRegions') }, ...WHO_REGIONS.map((r) => ({ value: r, label: nameR(r) }))]}
        />
        <Select
          showLabel
          label={t('international.dataYear')}
          value={year}
          onChange={setYear}
          options={[{ value: 'latest', label: t('international.latestAvailable') }, ...years.map((y) => ({ value: y, label: y }))]}
        />
        <MultiSelect
          showLabel
          label={t('international.compareWith', { n: MAX_COMPARE })}
          value={compare}
          onChange={(v) => setCountries(v.slice(0, MAX_COMPARE))}
          max={MAX_COMPARE}
          minWidth={200}
          options={[...countryCodes]
            .sort((a, b) => nameC(a).localeCompare(nameC(b), t.locale))
            .map((c) => ({ value: c, label: nameC(c), color: compare.includes(c) ? color(c) : undefined }))}
        />
      </FilterBar>

      <div className={k.stack}>
        <GlassMap indicator={indicator} region={region} year={year} countries={compare} onCountryClick={addCountry} link={link('glass-map')} />
        <div className={`${k.grid2} ${k.grid2narrow}`}>
          <GlassBars indicator={indicator} region={region} year={year} view={bars} onViewChange={setBars} link={link('glass-bars')} />
          <div className={k.stack}>
            <GlassRadar countries={compare} link={link('glass-radar')} />
            <GlassStrip countries={compare} onCountryClick={addCountry} link={link('glass-strip')} />
          </div>
        </div>
      </div>

      <Section id="comparability" title={t('international.comp.section')}>
        <Comparability link={link('glass-methods')} />
      </Section>
    </div>
  );
}
