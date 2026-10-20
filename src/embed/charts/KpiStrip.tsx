import { useMemo } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { seriesColor } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { Kpi } from '../../components/ui/Kpi';
import { useDataset } from '../../data/load';
import { dimNamer, fmtPct } from '../../data/format';
import { buildSeries, dedupeRecords, latestValue, sliceResistance } from '../../data/select';
import { useT } from '../../i18n';
import { phenotypeFor, sourceLine, type ChartParams } from './common';
import s from './charts.module.css';

/** Headline phenotypes shown in the strip (pathogen, antibiotic). */
export const KPI_INDICATORS: readonly [string, string][] = [
  ['SAU', 'OXA'],
  ['KPN', 'MEM'],
  ['ABA', 'MEM'],
  ['EFM', 'VAN'],
];

/** Four stat tiles: latest % resistant for MRSA / CRKP / CRAB / VRE with Δ vs previous year + sparkline. */
export function KpiStrip({ level = 'all', ward = 'all', setting = 'all', compact, link, fixtureFallback }: ChartParams) {
  const t = useT();
  const ct = useChartTheme();
  const { data: env, status, isFixture } = useDataset('resistance', { fixtureFallback });
  const namePh = dimNamer(env?.dims?.phenotypes, t.locale);
  const nameP = dimNamer(env?.dims?.pathogens, t.locale);

  const items = useMemo(() => {
    if (!env) return [];
    return KPI_INDICATORS.map(([p, a], i) => {
      const recs = sliceResistance(env.records, { pathogen: p, antibiotic: a, level, ward, setting });
      const lv = latestValue(recs, () => true);
      const trend = buildSeries(recs, () => 'x', (r) => r.resistant_pct).series[0]?.data ?? [];
      const pheno = phenotypeFor(env, p, a);
      return { p, a, i, lv, trend, recs, code: pheno ?? `${p}·${a}`, label: pheno ? namePh(pheno) : `${nameP(p)} × ${a}` };
    }).filter((x) => x.lv);
  }, [env, level, ward, setting, namePh, nameP]);

  const year = items[0]?.lv?.year;
  const title = t('charts.kpiStrip.title');
  const subtitle = t('charts.kpiStrip.subtitle', { year: year ?? '—', ward: `${t(`levels.${level}`)}${ward !== 'all' ? ` · ${t(`wards.${ward}`)}` : ''}` });
  const rows = items.map((x) => ({
    [t('common.phenotype')]: x.label,
    [t('common.year')]: x.lv!.year,
    [t('common.resistantPct')]: x.lv!.value,
    Δ: x.lv!.delta ?? null,
  }));

  return (
    <ChartCard
      id="kpi-strip"
      title={title}
      subtitle={subtitle}
      source={sourceLine(env, t.locale)}
      provisional={env?.provisional}
      precision={items.flatMap((x) => dedupeRecords(x.recs.filter((r) => r.year === x.lv!.year)))}
      isFixture={isFixture}
      status={status === 'ready' && items.length === 0 ? 'empty' : status}
      tableRows={rows}
      fileName={`twamr-kpi-${level}-${ward}-${year ?? ''}`}
      link={link}
      embed={{ chart: 'kpi-strip', params: { level, ward } }}
      keyNumber={items[0]?.lv ? { value: fmtPct(items[0].lv.value, t.locale), label: `${items[0].label} · ${items[0].lv.year}` } : undefined}
      compact={compact}
      height={compact ? 150 : 180}
      toolbar={{ fullscreen: false }}
    >
      <div className={s.kpiGrid}>
        {items.map((x) => (
          <Kpi
            key={`${x.p}-${x.a}`}
            label={x.code}
            caption={x.label}
            value={x.lv!.value}
            format={(v) => v.toFixed(1)}
            unit="%"
            delta={x.lv!.delta}
            deltaUnit={t('kpi.pp')}
            deltaLabel={x.lv!.prevYear ? t('kpi.vsPrev', { year: x.lv!.prevYear }) : undefined}
            goodDirection="down"
            trend={x.trend}
            accent={seriesColor(x.i, ct.theme)}
          />
        ))}
      </div>
    </ChartCard>
  );
}
