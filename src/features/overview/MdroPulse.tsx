import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartCard } from '../../components/chart/ChartCard';
import { resistanceColor, textOn } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { Kpi } from '../../components/ui/Kpi';
import { fmtPct } from '../../data/format';
import { useT } from '../../i18n';
import { alignPoints, GRAM_NEG_MDROS, GRAM_POS_MDROS, isEstimate, MDROS, summarize, trendPoints, yearSpan } from '../resistance/lib';
import { resistanceSource, useResistanceModel } from '../resistance/model';
import s from './overview.module.css';

/** embed ids whose "Open in TW-AMR Watch" link targets this card */
const EMBED_ALIASES = ['kpi-strip'];

/** Heat band label for a % value (shown in the tile's colour chip). */
function band(v: number): 'low' | 'moderate' | 'high' | 'veryHigh' {
  return v < 10 ? 'low' : v < 25 ? 'moderate' : v < 50 ? 'high' : 'veryHigh';
}

export function MdroPulse() {
  const t = useT();
  const ct = useChartTheme();
  const nav = useNavigate();
  const { env, trend, names, status, isFixture } = useResistanceModel();

  const tiles = useMemo(() => {
    if (!trend) return [];
    return MDROS.map((ph) => {
      const pts = trendPoints(trend, ph, 'all', 'all');
      const sm = summarize(pts);
      const years = pts.length ? yearSpan(pts[0].year, pts[pts.length - 1].year) : [];
      return { ph, pts, sm, spark: alignPoints(pts, years).map((p) => p?.value ?? null) };
    }).filter((x) => x.sm);
  }, [trend]);

  const year = tiles[0]?.sm?.last.year;
  const rows = tiles.map((x) => ({
    [t('common.phenotype')]: x.ph,
    [t('common.year')]: String(x.sm!.last.year),
    [t('common.resistantPct')]: x.sm!.last.value,
    [`Δ (${t('kpi.pp')})`]: x.sm!.delta ?? null,
    ...Object.fromEntries(x.pts.map((p) => [String(p.year), p.value])),
  }));
  const title = t('overview.pulse.title');
  const crab = tiles.find((x) => x.ph === 'CRAB');

  const tile = (x: (typeof tiles)[number]) => {
    const v = x.sm!.last.value;
    const fill = resistanceColor(v, ct.theme);
    const shortName = names.phenotype(x.ph).replace(/\s*[（(][^）)]*[）)]\s*$/, '');
    return (
      <Kpi
        key={x.ph}
        className={s.pulseTile}
        label={<span className={s.pulseCode}>{x.ph}</span>}
        caption={shortName}
        value={v}
        format={(n) => n.toFixed(1)}
        unit="%"
        delta={x.sm!.delta}
        deltaUnit={t('kpi.pp')}
        deltaLabel={x.sm!.prev ? t('kpi.vsPrev', { year: x.sm!.prev.year }) : undefined}
        goodDirection="down"
        trend={x.spark}
        accent={fill}
        badge={
          <span className={s.heatChip} style={{ background: fill, color: textOn(fill) }} title={isEstimate(x.sm!.last) ? t('precision.chart_estimateHint') : undefined}>
            {t(`overview.pulse.band.${band(v)}`)}
            {isEstimate(x.sm!.last) ? ' ◦' : ''}
          </span>
        }
        onClick={() => nav(`/resistance?phenotype=${encodeURIComponent(x.ph)}`)}
      />
    );
  };

  return (
    <ChartCard
      id="overview-pulse"
      aliases={EMBED_ALIASES}
      eyebrow={t('overview.pulse.eyebrow')}
      title={title}
      subtitle={t('overview.pulse.subtitle', { year: year ?? '—', from: tiles[0]?.sm?.first.year ?? '—' })}
      source={resistanceSource(env, t.locale)}
      dataset="resistance"
      isFixture={isFixture}
      precision={tiles.map((x) => x.sm!.last)}
      status={status === 'ready' && tiles.length === 0 ? 'empty' : status}
      tableRows={rows}
      fileName={`twamr-mdro-pulse-${year ?? ''}`}
      keyNumber={crab ? { value: fmtPct(crab.sm!.last.value, t.locale), label: `CRAB · ${crab.sm!.last.year}` } : undefined}
      embed={{ chart: 'kpi-strip' }}
      height={360}
      toolbar={{ fullscreen: false }}
    >
      <div className={s.pulseGroups}>
        <div>
          <h3 className={s.pulseGroupTitle}>{t('overview.pulse.gramNeg')}</h3>
          <div className={s.pulseGrid}>{tiles.filter((x) => GRAM_NEG_MDROS.includes(x.ph)).map(tile)}</div>
        </div>
        <div>
          <h3 className={s.pulseGroupTitle}>{t('overview.pulse.gramPos')}</h3>
          <div className={s.pulseGrid}>{tiles.filter((x) => GRAM_POS_MDROS.includes(x.ph)).map(tile)}</div>
        </div>
      </div>
    </ChartCard>
  );
}
