import { useMemo, useRef } from 'react';
import { ChartCard } from '../../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../../components/chart/EChart';
import { seriesColor } from '../../../components/chart/palette';
import { useChartTheme } from '../../../components/chart/useChartTheme';
import { fmtDelta, fmtPct } from '../../../data/format';
import type { ChartParams } from '../../../embed/charts/common';
import { useT } from '../../../i18n';
import { coHoGaps, isEstimate, MDROS } from '../lib';
import { resistanceSource, useResistanceModel } from '../model';
import { useNarrow } from '../useNarrow';
import { dumbbellOption, type DumbbellRow } from './dumbbell';

/** Slots shared with the trend chart's CO/HO overlay. */
export const CO_SLOT = 5;
export const HO_SLOT = 6;

export interface CoHoGapProps extends ChartParams {
  phenotypes?: readonly string[];
  eyebrow?: string;
}

const esc = (x: string) => x.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]!);

/**
 * Community-onset vs hospital-onset % non-susceptible for each MDRO (latest year), as a
 * dumbbell sorted by the gap. Embed id `resistance-co-ho`.
 */
export function CoHoGapChart({ level = 'all', years, compact, link, fixtureFallback, phenotypes = MDROS, eyebrow }: CoHoGapProps) {
  const t = useT();
  const ct = useChartTheme();
  const ref = useRef<EChartHandle>(null);
  const { env, status, isFixture, trend, names } = useResistanceModel(fixtureFallback);
  const year = years?.[1];
  const rows = useMemo(() => (trend ? coHoGaps(trend, level, year, phenotypes) : []), [trend, level, year, phenotypes]);
  const y = rows[0]?.year;
  const pp = t('kpi.pp');
  const ppShort = t('kpi.ppShort');
  const narrow = useNarrow();

  const option = useMemo(() => {
    const data: DumbbellRow[] = rows.map((r) => ({
      key: r.phenotype,
      label: r.phenotype,
      a: r.co,
      b: r.ho,
      note: narrow ? fmtDelta(r.gap, t.locale) : `${fmtDelta(r.gap, t.locale)} ${ppShort}`,
    }));
    return dumbbellOption({
      rows: data,
      colorA: seriesColor(CO_SLOT, ct.theme),
      colorB: seriesColor(HO_SLOT, ct.theme),
      nameA: t('settings.co'),
      nameB: t('settings.ho'),
      tokens: ct.tokens,
      fmt: (v) => fmtPct(v, t.locale),
      compact,
      narrow,
      labelWidth: 70,
      tooltip: (d) => {
        const g = rows.find((r) => r.phenotype === d.key)!;
        const est = isEstimate(g.co) || isEstimate(g.ho) ? `<div style="opacity:.6;font-size:11px">◦ ${esc(t('precision.chart_estimate'))}</div>` : '';
        return `<div style="font-weight:700">${esc(names.phenotype(g.phenotype))}</div>
          <div>${esc(t('settings.ho'))}: <b>${fmtPct(g.ho.value, t.locale)}</b></div>
          <div>${esc(t('settings.co'))}: <b>${fmtPct(g.co.value, t.locale)}</b></div>
          <div style="margin-top:4px">${esc(t('resistance.coho.gap'))}: <b>${fmtDelta(g.gap, t.locale)} ${esc(pp)}</b> · ×${Number.isFinite(g.ratio) ? g.ratio.toFixed(1) : '—'}</div>${est}`;
      },
    });
  }, [rows, ct.theme, ct.tokens, t, pp, ppShort, compact, names, narrow]);

  const top = rows[0];
  const title = t('resistance.coho.title');
  const subtitle = t('resistance.coho.subtitle', { year: y ?? '—', level: names.level(level) });
  const tableRows = useMemo(
    () =>
      rows.map((r) => ({
        [t('common.phenotype')]: r.phenotype,
        [t('common.year')]: String(r.year),
        [t('settings.co')]: r.co.value,
        [t('settings.ho')]: r.ho.value,
        [`${t('resistance.coho.gap')} (${pp})`]: r.gap,
        [t('resistance.coho.ratio')]: Number.isFinite(r.ratio) ? r.ratio : null,
      })),
    [rows, t, pp],
  );
  const height = Math.max(compact ? 260 : 300, rows.length * (compact ? 30 : 38) + 50);

  return (
    <ChartCard
      id="resistance-co-ho"
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      source={resistanceSource(env, t.locale)}
      dataset="resistance"
      isFixture={isFixture}
      precision={rows.flatMap((r) => [r.co, r.ho])}
      status={status === 'ready' && rows.length === 0 ? 'empty' : status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-co-vs-ho-${level}-${y ?? ''}`}
      link={link}
      embed={{ chart: 'resistance-co-ho', params: { level: level === 'all' ? undefined : level } }}
      keyNumber={top ? { value: `${fmtDelta(top.gap, t.locale)} ${pp}`, label: t('resistance.coho.keyLabel', { phenotype: top.phenotype, ho: fmtPct(top.ho.value, t.locale), co: fmtPct(top.co.value, t.locale), year: top.year }) } : undefined}
      compact={compact}
      height={height}
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${t('resistance.coho.aria')}`} />
    </ChartCard>
  );
}
