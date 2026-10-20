import type { EChartsOption } from 'echarts';
import { useMemo, useRef, useState } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { CATEGORICAL, MUTED, withAlpha } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { dimNamer, fmtPct, fmtNumber } from '../../data/format';
import { useDataset } from '../../data/load';
import type { Envelope, GlassRecord } from '../../data/types';
import { useT } from '../../i18n';
import { glassRows, indicatorCodes, percentileRank } from './glassModel';
import { tipRow, tipTitle, glassSourceLine } from './kit/util';
import { useNarrow } from './kit/hooks';
import { LegendSwatch } from './kit/Kit';
import k from './kit/kit.module.css';

type Scale = 'abs' | 'rank';

/** Short axis label per indicator: the phenotype code (MRSA, CRKP …). */
export function indicatorShort(env: Envelope<GlassRecord> | null | undefined, code: string): string {
  const d = env?.dims?.indicators?.find((x) => x.code === code);
  return (d?.meta?.phenotype as string | undefined) ?? code.replace(/_BLOOD$/, '');
}

/** Comparison colours: Taiwan = ink, selected countries = categorical slots 1…5 in selection order. */
export function compareColors(
  countries: readonly string[],
  theme: 'light' | 'dark',
  ink: string,
): (iso: string) => string {
  return (iso) => {
    if (iso === 'TWN') return ink;
    const i = countries.filter((c) => c !== 'TWN').indexOf(iso);
    return i >= 0 && i < 5 ? CATEGORICAL[theme][i + 1] : MUTED[theme];
  };
}

function useGlassMatrix(env: Envelope<GlassRecord> | null) {
  return useMemo(() => {
    if (!env) return null;
    const codes = indicatorCodes(env);
    const rows = glassRows(env.records, {});
    const by = new Map(rows.map((r) => [`${r.iso3}|${r.indicator}`, r]));
    const valuesFor = (ind: string) => rows.filter((r) => r.indicator === ind).map((r) => r.resistant_pct);
    return { codes, rows, by, valuesFor };
  }, [env]);
}

/** Radar: Taiwan vs up to 5 countries across all 10 indicators (absolute % or percentile rank). */
export function GlassRadar({
  countries,
  compact,
  link,
}: {
  countries: string[];
  compact?: boolean;
  link?: string;
}) {
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const [scale, setScale] = useState<Scale>('abs');
  const { data: env, status } = useDataset('glass');
  const m = useGlassMatrix(env);
  const nameC = dimNamer(env?.dims?.countries, t.locale);
  const nameI = dimNamer(env?.dims?.indicators, t.locale);
  const set = useMemo(() => ['TWN', ...countries.filter((c) => c !== 'TWN')], [countries]);
  const color = compareColors(set, ct.theme, ct.tokens.ink);
  const height = narrow ? 380 : 440;

  const valueOf = (iso: string, ind: string): number | null => {
    const r = m?.by.get(`${iso}|${ind}`);
    if (!r) return null;
    return scale === 'abs' ? r.resistant_pct : Math.round(percentileRank(r.resistant_pct, m!.valuesFor(ind)));
  };

  const option = useMemo<EChartsOption>(() => {
    if (!m) return {};
    const tok = ct.tokens;
    return {
      legend: { bottom: 0, left: 'center', type: 'scroll', data: set.map((c) => nameC(c)) },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: unknown) => {
          const pp = p as { name: string; data: { iso: string } };
          const iso = pp.data.iso;
          return (
            tipTitle(nameC(iso)) +
            m.codes
              .map((c) => {
                const r = m.by.get(`${iso}|${c}`);
                const v = valueOf(iso, c);
                const txt =
                  v === null
                    ? '—'
                    : scale === 'abs'
                      ? fmtPct(v, t.locale)
                      : `P${fmtNumber(v, t.locale)}${r ? ` (${fmtPct(r.resistant_pct, t.locale)})` : ''}`;
                return tipRow(undefined, indicatorShort(env, c), txt);
              })
              .join('')
          );
        },
      },
      radar: {
        center: ['50%', '48%'],
        radius: narrow ? '52%' : '66%',
        indicator: m.codes.map((c) => ({ name: indicatorShort(env, c), max: 100, min: 0 })),
        axisName: { color: tok.ink2, fontSize: narrow ? 10.5 : 11.5, fontWeight: 600 },
        // 20% rings: 25-point rings trip ECharts' "ticks may be not readable" (alignTicks) warning
        splitNumber: 5,
        splitLine: { lineStyle: { color: tok.grid } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: tok.grid } },
        axisLabel: { show: false },
      },
      series: [
        {
          type: 'radar',
          symbol: 'circle',
          symbolSize: 5,
          data: set.map((iso) => {
            const c = color(iso);
            const isTw = iso === 'TWN';
            return {
              iso,
              name: nameC(iso),
              value: m.codes.map((ind) => valueOf(iso, ind) ?? '-'),
              lineStyle: { color: c, width: isTw ? 2.5 : 1.75 },
              itemStyle: { color: c, borderColor: tok.surface, borderWidth: 1 },
              areaStyle: { color: withAlpha(c.startsWith('#') ? c : '#888888', isTw ? 0.14 : 0.04) },
              z: isTw ? 3 : 2,
            };
          }),
          emphasis: { focus: 'self', lineStyle: { width: 3 } },
        },
      ],
    } as EChartsOption;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, ct, set, scale, t, narrow, env]);

  const tableRows = useMemo(
    () =>
      (m?.codes ?? []).map((ind) => {
        const row: Record<string, string | number | null> = { [t('international.indicator')]: nameI(ind) };
        for (const iso of set) row[nameC(iso)] = valueOf(iso, ind);
        return row;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, set, scale, t],
  );

  const title = t('international.radar.title');
  return (
    <ChartCard
      id="glass-radar"
      title={title}
      subtitle={
        scale === 'abs' ? t('international.radar.subtitleAbs') : t('international.radar.subtitleRank')
      }
      source={glassSourceLine(env, t.locale, (n) => t('international.sourceMore', { n }))}
      dataset="glass"
      status={status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-glass-radar-${set.join('-')}`.toLowerCase()}
      link={link}
      compact={compact}
      height={height}
      actions={
        <div className={k.scrollX}>
          <SegmentedControl<Scale>
            size="sm"
            label={t('international.radar.scaleLabel')}
            value={scale}
            onChange={setScale}
            options={[
              { value: 'abs', label: t('international.radar.abs') },
              { value: 'rank', label: t('international.radar.rank') },
            ]}
          />
        </div>
      }
    >
      <EChart
        ref={ref}
        option={option}
        height={height}
        ariaLabel={`${title}. ${t('international.radar.aria')}`}
      />
    </ChartCard>
  );
}

/** Strip plot: every country as a dot per indicator; Taiwan and the comparison set highlighted. */
export function GlassStrip({
  countries,
  onCountryClick,
  link,
}: {
  countries: string[];
  onCountryClick?: (iso: string) => void;
  link?: string;
}) {
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status } = useDataset('glass');
  const m = useGlassMatrix(env);
  const nameC = dimNamer(env?.dims?.countries, t.locale);
  const nameI = dimNamer(env?.dims?.indicators, t.locale);
  const set = useMemo(() => ['TWN', ...countries.filter((c) => c !== 'TWN')], [countries]);
  const color = compareColors(set, ct.theme, ct.tokens.ink);
  const height = 440;

  const option = useMemo<EChartsOption>(() => {
    if (!m) return {};
    const tok = ct.tokens;
    const cats = m.codes.map((c) => indicatorShort(env, c));
    const ci = new Map(m.codes.map((c, i) => [c, i]));
    const others = m.rows.filter((r) => !set.includes(r.iso3));
    const point = (r: GlassRecord) => ({
      value: [r.resistant_pct, ci.get(r.indicator)!],
      iso: r.iso3,
      ind: r.indicator,
      year: r.year,
    });
    return {
      grid: { left: 4, right: 16, top: 16, bottom: 8, containLabel: true },
      legend: { show: false, data: [t('international.strip.others'), ...set.map((c) => nameC(c))] },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: unknown) => {
          const d = (p as { data: { iso: string; ind: string; value: number[]; year: number } }).data;
          return (
            tipTitle(nameC(d.iso)) +
            tipRow(undefined, nameI(d.ind), fmtPct(d.value[0], t.locale), true) +
            tipRow(undefined, t('common.year'), String(d.year))
          );
        },
      },
      xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      yAxis: {
        type: 'category',
        data: cats,
        inverse: true,
        axisLabel: { fontWeight: 600, interval: 0 },
        splitLine: { show: true, lineStyle: { color: tok.grid } },
      },
      series: [
        {
          type: 'scatter',
          name: t('international.strip.others'),
          data: others.map(point),
          symbolSize: 7,
          itemStyle: { color: withAlpha(MUTED[ct.theme], ct.theme === 'dark' ? 0.9 : 0.75), borderWidth: 0 },
          emphasis: { scale: 1.6 },
          cursor: onCountryClick ? 'pointer' : 'default',
        },
        ...set
          .slice()
          .reverse()
          .map((iso) => ({
            type: 'scatter',
            name: nameC(iso),
            data: m.rows.filter((r) => r.iso3 === iso).map(point),
            symbolSize: iso === 'TWN' ? 15 : 11,
            itemStyle: { color: color(iso), borderColor: tok.surface, borderWidth: 2 },
            z: iso === 'TWN' ? 5 : 4,
            label:
              iso === 'TWN' && !narrow
                ? {
                    show: true,
                    position: 'top',
                    distance: 4,
                    formatter: (p: { value: number[] }) => fmtPct(p.value[0], t.locale, 0),
                    color: tok.ink,
                    fontSize: 10.5,
                    fontWeight: 650,
                  }
                : undefined,
          })),
      ],
    } as EChartsOption;
  }, [m, ct, set, t, nameC, nameI, env, color, narrow, onCountryClick]);

  const onEvents = useMemo(
    () => ({
      click: (p: unknown) => {
        const d = (p as { data?: { iso?: string } }).data;
        if (d?.iso && d.iso !== 'TWN') onCountryClick?.(d.iso);
      },
    }),
    [onCountryClick],
  );

  const tableRows = useMemo(
    () =>
      (m?.codes ?? []).map((ind) => {
        const vals = m!.valuesFor(ind);
        const tw = m!.by.get(`TWN|${ind}`);
        return {
          [t('international.indicator')]: nameI(ind),
          [nameC('TWN')]: tw?.resistant_pct ?? null,
          [t('international.strip.min')]: vals.length ? Math.min(...vals) : null,
          [t('international.strip.max')]: vals.length ? Math.max(...vals) : null,
          [t('international.strip.pct')]: tw ? Math.round(percentileRank(tw.resistant_pct, vals)) : null,
          [t('international.strip.n')]: vals.length,
        };
      }),
    [m, t, nameI, nameC],
  );

  const title = t('international.strip.title');
  return (
    <ChartCard
      id="glass-strip"
      title={title}
      subtitle={t('international.strip.subtitle')}
      source={glassSourceLine(env, t.locale, (n) => t('international.sourceMore', { n }))}
      dataset="glass"
      status={status}
      chartRef={ref}
      tableRows={tableRows}
      fileName="twamr-glass-taiwan-position"
      link={link}
      height={height}
    >
      <div className={k.legend} style={{ padding: '0 4px 4px' }}>
        <LegendSwatch color={MUTED[ct.theme]} label={t('international.strip.others')} />
        {set.map((c) => (
          <LegendSwatch key={c} color={color(c)} label={nameC(c)} />
        ))}
      </div>
      <EChart
        ref={ref}
        option={option}
        height={height}
        onEvents={onEvents}
        ariaLabel={`${title}. ${t('international.strip.subtitle')}`}
      />
    </ChartCard>
  );
}
