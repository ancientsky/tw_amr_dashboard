import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { WARD_ORDER, colorMap } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { useDataset } from '../../data/load';
import { dimNamer, fmtPct } from '../../data/format';
import { latestValue, resistanceTrend, seriesToRows } from '../../data/select';
import type { ResistanceRecord } from '../../data/types';
import { useT } from '../../i18n';
import { phenotypeFor, sourceLine, type ChartParams } from './common';

/** % resistant over time for one pathogen × antibiotic, one line per ward (all / ICU / non-ICU). */
export function ResistanceTrend({ pathogen = 'KPN', antibiotic = 'MEM', level = 'all', ward, setting = 'all', years, compact, link, fixtureFallback }: ChartParams) {
  const t = useT();
  const ct = useChartTheme();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status, isFixture } = useDataset('resistance', { fixtureFallback });

  const model = useMemo(() => {
    if (!env) return null;
    const set = resistanceTrend(env.records, { pathogen, antibiotic, level, setting, specimen: 'all', years }, 'ward', { keyOrder: [...WARD_ORDER] });
    const recs = env.records.filter(
      (r: ResistanceRecord) => r.pathogen === pathogen && r.antibiotic === antibiotic && r.level === level && (r.setting ?? 'all') === setting && r.specimen === 'all',
    );
    const pheno = phenotypeFor(env, pathogen, antibiotic);
    const kpiWard = ward ?? 'icu';
    const kv = latestValue(recs, (r) => r.ward === kpiWard) ?? latestValue(recs, (r) => r.ward === 'all');
    return { set, recs, pheno, kv, kpiWard };
  }, [env, pathogen, antibiotic, level, setting, years, ward]);

  const nameP = dimNamer(env?.dims?.pathogens, t.locale);
  const nameA = dimNamer(env?.dims?.antibiotics, t.locale);
  const namePh = dimNamer(env?.dims?.phenotypes, t.locale);
  const wardLabel = (w: string) => t(`wards.${w}`);

  const title = model?.pheno
    ? t('charts.resistanceTrend.title', { phenotype: namePh(model.pheno) })
    : t('charts.resistanceTrend.titleGeneric', { pathogen: nameP(pathogen), antibiotic: nameA(antibiotic) });
  const subtitle = t('charts.resistanceTrend.subtitle', { level: t(`levels.${level}`) });

  const option = useMemo<EChartsOption>(() => {
    if (!model) return {};
    const color = colorMap([...WARD_ORDER], ct.theme);
    const { set } = model;
    const emphasis = ward && ward !== 'all' ? ward : undefined;
    return {
      grid: { left: 4, right: compact ? 56 : 72, top: 40, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, data: set.series.map((s) => wardLabel(s.key)) },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => fmtPct(v as number, t.locale),
        order: 'valueDesc',
      },
      xAxis: { type: 'category', data: set.years.map(String), boundaryGap: false },
      yAxis: { type: 'value', min: 0, max: (v: { max: number }) => Math.min(100, Math.ceil((v.max + 5) / 10) * 10), axisLabel: { formatter: '{value}%' } },
      series: set.series.map((s) => {
        const c = color(s.key);
        const dim = emphasis && s.key !== emphasis;
        return {
          name: wardLabel(s.key),
          type: 'line',
          data: s.data,
          connectNulls: false,
          showSymbol: false,
          symbolSize: 8,
          lineStyle: { width: 2, color: c, opacity: dim ? 0.45 : 1 },
          itemStyle: { color: c, borderColor: ct.tokens.surface, borderWidth: 2 },
          areaStyle: s.key === (emphasis ?? 'icu') ? { color: c, opacity: 0.08 } : undefined,
          endLabel: {
            show: set.series.length <= 4,
            formatter: (p: { value: unknown }) => fmtPct(Number(p.value), t.locale),
            color: ct.tokens.ink2,
            fontSize: 11.5,
            fontWeight: 600,
            distance: 6,
          },
          emphasis: { focus: 'series' },
        };
      }),
    } as EChartsOption;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, ct.theme, ct.tokens, t, compact, ward]);

  const tableRows = useMemo(() => (model ? seriesToRows(model.set, wardLabel) : undefined), [model, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const empty = status === 'ready' && model && model.set.series.length === 0;

  return (
    <ChartCard
      id="resistance-trend"
      title={title}
      subtitle={subtitle}
      source={sourceLine(env, t.locale)}
      provisional={env?.provisional}
      precision={model?.recs}
      isFixture={isFixture}
      status={empty ? 'empty' : status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-${pathogen}-${antibiotic}-${level}`.toLowerCase()}
      link={link}
      embed={{ chart: 'resistance-trend', params: { pathogen, antibiotic, level, ward } }}
      keyNumber={model?.kv ? { value: fmtPct(model.kv.value, t.locale), label: `${wardLabel(model.kpiWard)} · ${model.kv.year}` } : undefined}
      compact={compact}
      height={compact ? 260 : 340}
    >
      <EChart ref={ref} option={option} height={compact ? 260 : 340} ariaLabel={`${title}. ${t('charts.resistanceTrend.aria')}`} />
    </ChartCard>
  );
}
