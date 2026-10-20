import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { dimNamer, fmtNumber, fmtPct } from '../../data/format';
import { useDataset } from '../../data/load';
import { buildSeries, filterYears, type YearRange } from '../../data/select';
import type { Level } from '../../data/types';
import type { ChartParams } from '../../embed/charts/common';
import { useT } from '../../i18n';
import { LegendSwatch } from '../international/kit/Kit';
import { hashParam, tipRow, tipTitle, envSourceLine } from '../international/kit/util';
import { useNarrow } from '../international/kit/hooks';
import k from '../international/kit/kit.module.css';
import { AWARE_COLORS, AWARE_ORDER, amuRows, awareOf, classColor, classOrder, TOTAL } from './amuModel';

export type AmuMetric = 'DID' | 'share';

export interface AmuChartProps extends ChartParams {
  metric?: AmuMetric;
  /** selected class codes (empty/undefined = all) */
  classes?: string[];
  onClassesChange?: (v: string[]) => void;
}

export function parseAmuExtras(p: AmuChartProps): { level: Level; metric: AmuMetric; classes?: string[]; years?: YearRange } {
  const metric = (p.metric ?? (hashParam('metric') === 'share' ? 'share' : 'DID')) as AmuMetric;
  const cls = p.classes ?? hashParam('classes')?.split(',').filter(Boolean);
  return { level: p.level ?? 'all', metric, classes: cls && cls.length ? cls : undefined, years: p.years };
}

/** Stacked area of inpatient DID by antibiotic class over time (absolute or 100 % share), legend grouped by AWaRe. */
export function AmuStacked(props: AmuChartProps) {
  const { compact, link, fixtureFallback, onClassesChange } = props;
  const { level, metric, classes, years } = parseAmuExtras(props);
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status } = useDataset('antibiotic_use', { fixtureFallback });
  const dims = env?.dims?.classes;
  const nameCls = dimNamer(dims, t.locale);
  const order = useMemo(() => classOrder(dims), [dims]);
  const selected = useMemo(() => (classes ? order.filter((c) => classes.includes(c)) : order), [classes, order]);

  const model = useMemo(() => {
    if (!env) return null;
    const rows = filterYears(amuRows(env.records, level), years).filter((r) => r.className !== TOTAL && selected.includes(r.className));
    const set = buildSeries(rows, (r) => r.className, (r) => r.value, { keyOrder: order });
    const sums = set.years.map((_, i) => set.series.reduce((a, s) => a + (s.data[i] ?? 0), 0));
    return { set, sums };
  }, [env, level, years, selected, order]);

  const height = compact ? 300 : narrow ? 340 : 400;

  const option = useMemo<EChartsOption>(() => {
    if (!model) return {};
    const tok = ct.tokens;
    const { set, sums } = model;
    const isShare = metric === 'share';
    return {
      grid: { left: 4, right: 16, top: 16, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        formatter: (ps: unknown) => {
          const arr = ps as { dataIndex: number; seriesName: string; value: number; color: string; seriesId: string }[];
          if (!arr.length) return '';
          const i = arr[0].dataIndex;
          const rows = [...arr].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 12);
          return (
            tipTitle(`${set.years[i]} · ${t(`levels.${level}`)}`) +
            tipRow(undefined, t('amu.stacked.sumSelected'), `${fmtNumber(sums[i], t.locale, { digits: 1 })} DID`, true) +
            rows.map((p) => tipRow(p.color, p.seriesName, isShare ? fmtPct(p.value, t.locale) : fmtNumber(p.value, t.locale, { digits: 1 }))).join('') +
            (arr.length > 12 ? tipRow(undefined, '…', '') : '')
          );
        },
      },
      xAxis: { type: 'category', data: set.years.map(String), boundaryGap: false },
      yAxis: {
        type: 'value',
        max: isShare ? 100 : undefined,
        axisLabel: { formatter: isShare ? '{value}%' : '{value}' },
        name: isShare ? undefined : 'DID',
        nameTextStyle: { align: 'left' },
      },
      series: set.series.map((s) => {
        const c = classColor(dims, s.key, ct.theme);
        return {
          id: s.key,
          name: nameCls(s.key),
          type: 'line',
          stack: 'amu',
          data: s.data.map((v, i) => (v === null ? null : isShare ? (sums[i] ? (v / sums[i]) * 100 : 0) : v)),
          showSymbol: false,
          symbolSize: 6,
          lineStyle: { width: 1, color: tok.surface },
          itemStyle: { color: c },
          areaStyle: { color: c, opacity: 0.95 },
          emphasis: { focus: 'series' },
        };
      }),
    } as EChartsOption;
  }, [model, ct, metric, dims, nameCls, t, level]);

  const tableRows = useMemo(() => {
    if (!model) return undefined;
    return model.set.years.map((y, i) => {
      const row: Record<string, string | number | null> = { [t('common.year')]: y };
      for (const s of model.set.series) row[nameCls(s.key)] = s.data[i];
      row[t('amu.stacked.sumSelected')] = Math.round(model.sums[i] * 10) / 10;
      return row;
    });
  }, [model, nameCls, t]);

  const last = model?.set.years.length ? model.set.years.length - 1 : -1;
  const title = metric === 'share' ? t('amu.stacked.titleShare') : t('amu.stacked.title');
  const subtitle = t('amu.stacked.subtitle', { level: t(`levels.${level}`), n: selected.length, total: order.length });

  const toggle = (code: string) => {
    if (!onClassesChange) return;
    const next = selected.includes(code) ? selected.filter((c) => c !== code) : order.filter((c) => selected.includes(c) || c === code);
    onClassesChange(next.length === order.length ? [] : next);
  };
  const soloGroup = (aware: string) => {
    if (!onClassesChange) return;
    const fam = order.filter((c) => awareOf(dims, c) === aware);
    const isSolo = selected.length === fam.length && fam.every((c) => selected.includes(c));
    onClassesChange(isSolo ? [] : fam);
  };

  return (
    <ChartCard
      id="amu-stacked"
      title={title}
      subtitle={subtitle}
      source={envSourceLine(env, t.locale)}
      dataset="antibiotic_use"
      status={status === 'ready' && model && model.set.series.length === 0 ? 'empty' : status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-amu-classes-${level}-${metric}`}
      link={link}
      embed={{ chart: 'amu-stacked', params: { level: level !== 'all' ? level : null, metric: metric !== 'DID' ? metric : null } }}
      keyNumber={model && last >= 0 ? { value: `${fmtNumber(model.sums[last], t.locale, { digits: 0 })} DID`, label: `${t(`levels.${level}`)} · ${model.set.years[last]}` } : undefined}
      compact={compact}
      height={height}
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${subtitle}`} />
      {!compact && (
        <div className={k.legendGroups}>
          {AWARE_ORDER.map((aw) => {
            const fam = order.filter((c) => awareOf(dims, c) === aw);
            if (!fam.length) return null;
            return (
              <div key={aw}>
                <div className={k.legendGroupTitle}>
                  <span className={k.swatch} style={{ background: AWARE_COLORS[ct.theme][aw] }} aria-hidden="true" />
                  {onClassesChange ? (
                    <button type="button" className={k.legendItem} style={{ fontWeight: 650, color: 'var(--ink)' }} onClick={() => soloGroup(aw)} title={t('amu.stacked.soloHint')}>
                      {t(`amu.aware.${aw}`)}
                    </button>
                  ) : (
                    t(`amu.aware.${aw}`)
                  )}
                </div>
                <div className={k.legendGroupItems}>
                  {fam.map((c) => (
                    <LegendSwatch
                      key={c}
                      color={classColor(dims, c, ct.theme)}
                      label={nameCls(c)}
                      muted={!selected.includes(c)}
                      pressed={selected.includes(c)}
                      onClick={onClassesChange ? () => toggle(c) : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}
