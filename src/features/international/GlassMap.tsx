import type { EChartsOption } from 'echarts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { resistanceColor, resistanceRamp } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { usePrefersReducedMotion } from '../../components/ui/usePrefersReducedMotion';
import { dimNamer, fmtPct } from '../../data/format';
import { useDataset } from '../../data/load';
import type { GlassRecord } from '../../data/types';
import type { ChartParams } from '../../embed/charts/common';
import { useT } from '../../i18n';
import { WORLD_MAP, ensureWorldMapFixed } from './worldMapFixed';
import {
  DEFAULT_INDICATOR,
  GLASS_DASHBOARD_URL,
  NE_NAME,
  REGION_VIEW,
  TAIWAN_COORD,
  glassRows,
  ISO_BY_NE,
} from './glassModel';
import {
  esc,
  hashParam,
  niceMax,
  sourceTitles,
  tipNote,
  tipRow,
  tipTitle,
  glassSourceLine,
} from './kit/util';
import { useNarrow } from './kit/hooks';
import k from './kit/kit.module.css';

export interface GlassChartProps extends ChartParams {
  indicator?: string;
  region?: string;
  /** 'latest' | data year */
  year?: string;
  /** comparison set (ISO3) — outlined on the map */
  countries?: string[];
  onCountryClick?: (iso3: string) => void;
}

/** World choropleth of % resistant (bloodstream isolates) with a pulsing Taiwan marker + callout. */
export function GlassMap({
  indicator,
  region,
  year,
  countries = [],
  onCountryClick,
  compact,
  link,
  fixtureFallback,
}: GlassChartProps) {
  const ind = indicator ?? hashParam('indicator') ?? DEFAULT_INDICATOR;
  const reg = region ?? hashParam('region') ?? 'all';
  const yr = year ?? hashParam('year') ?? 'latest';
  const t = useT();
  const ct = useChartTheme();
  const reduced = usePrefersReducedMotion();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status } = useDataset('glass', { fixtureFallback });
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let alive = true;
    ensureWorldMapFixed().then(
      () => alive && setMapReady(true),
      () => alive && setMapError(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  const nameC = dimNamer(env?.dims?.countries, t.locale);
  const nameI = dimNamer(env?.dims?.indicators, t.locale);
  const nameR = dimNamer(env?.dims?.whoRegions, t.locale);
  const srcs = useMemo(() => sourceTitles(env, t.locale), [env, t.locale]);

  const rows = useMemo(
    () => (env ? glassRows(env.records, { indicator: ind, region: reg, year: yr }) : []),
    [env, ind, reg, yr],
  );
  const tw = rows.find((r) => r.iso3 === 'TWN');
  const vmax = useMemo(() => niceMax(Math.max(0, ...rows.map((r) => r.resistant_pct))), [rows]);
  const height = compact ? 300 : narrow ? 300 : 480;

  const option = useMemo<EChartsOption>(() => {
    if (!mapReady || !env) return {};
    const tok = ct.tokens;
    const view = REGION_VIEW[reg] ?? REGION_VIEW.all;
    const sel = new Set(countries);
    const byIso = new Map(rows.map((r) => [r.iso3, r]));
    const shown = rows.filter((r) => NE_NAME[r.iso3]);
    const data = shown.map((r) => ({ name: NE_NAME[r.iso3], value: r.resistant_pct }));
    const regions = shown.map((r) => {
      const outline = sel.has(r.iso3) || r.iso3 === 'TWN';
      return {
        name: NE_NAME[r.iso3],
        itemStyle: outline ? { borderColor: tok.ink, borderWidth: 1.4 } : undefined,
        emphasis: {
          itemStyle: {
            areaColor: resistanceColor((r.resistant_pct / vmax) * 100, ct.theme),
            borderColor: tok.ink,
            borderWidth: 1.6,
          },
          label: { show: false },
        },
      };
    });
    const label = tw ? `${nameC('TWN')}  ${fmtPct(tw.resistant_pct, t.locale)} · ${tw.year}` : nameC('TWN');
    const marker = {
      name: nameC('TWN'),
      value: [...TAIWAN_COORD, tw?.resistant_pct ?? 0],
    };
    const markerSeries = {
      type: reduced ? 'scatter' : 'effectScatter',
      coordinateSystem: 'geo',
      geoIndex: 0,
      data: [marker],
      symbolSize: narrow ? 9 : 11,
      zlevel: 2,
      rippleEffect: { brushType: 'stroke', scale: 3.2, period: 3.2 },
      showEffectOn: 'render',
      itemStyle: {
        color: tok.ink,
        borderColor: tok.surface,
        borderWidth: 2,
        shadowBlur: ct.theme === 'dark' ? 12 : 0,
        shadowColor: tok.accent,
      },
      label: {
        show: true,
        formatter: label,
        position: narrow ? 'left' : 'right',
        distance: 14,
        color: tok.ink,
        fontWeight: 650,
        fontSize: narrow ? 11 : 12.5,
        backgroundColor: tok.surface,
        borderColor: tok.ink,
        borderWidth: 1,
        borderRadius: 6,
        padding: [5, 8],
      },
      labelLine: { show: true },
      tooltip: { show: true },
      silent: false,
    };
    return {
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: unknown) => {
          const pp = p as { name: string; seriesType?: string };
          const iso =
            ISO_BY_NE[pp.name] ??
            (pp.seriesType === 'effectScatter' || pp.seriesType === 'scatter' ? 'TWN' : undefined);
          const r = iso ? byIso.get(iso) : undefined;
          if (!r) return `${tipTitle(pp.name)}${tipNote(t('international.map.noData'))}`;
          const src = srcs.get(r.source);
          return (
            tipTitle(nameC(r.iso3)) +
            tipRow(undefined, nameI(r.indicator), fmtPct(r.resistant_pct, t.locale), true) +
            tipRow(undefined, t('common.year'), String(r.year)) +
            tipRow(undefined, t('international.region'), nameR(r.whoRegion)) +
            tipNote(`${t('common.source')}: ${src ? src.publisher : r.source}`) +
            (r.iso3 !== 'TWN' && onCountryClick ? tipNote(esc(t('international.map.clickHint'))) : '')
          );
        },
      },
      visualMap: {
        type: 'continuous',
        min: 0,
        max: vmax,
        calculable: false,
        orient: 'horizontal',
        left: 8,
        bottom: 6,
        itemWidth: 10,
        itemHeight: narrow ? 120 : 180,
        text: [fmtPct(vmax, t.locale, 0), '0%'],
        textGap: 8,
        inRange: { color: resistanceRamp(7, ct.theme) },
        outOfRange: { color: tok.surface2 },
        seriesIndex: 0,
        textStyle: { color: tok.ink3, fontSize: 11 },
      },
      geo: {
        map: WORLD_MAP,
        roam: false,
        center: view.center,
        zoom: view.zoom,
        itemStyle: { areaColor: tok.surface2, borderColor: tok.axis, borderWidth: 0.5 },
        emphasis: { itemStyle: { areaColor: tok.surface2 }, label: { show: false } },
        select: { disabled: true },
        tooltip: { show: true },
        regions: [...regions],
      },
      series: [
        {
          type: 'map',
          geoIndex: 0,
          data,
        },
        markerSeries,
      ],
    } as EChartsOption;
  }, [
    mapReady,
    env,
    ct,
    reg,
    countries,
    rows,
    tw,
    nameC,
    nameI,
    nameR,
    t,
    reduced,
    narrow,
    srcs,
    vmax,
    onCountryClick,
  ]);

  const onEvents = useMemo(
    () => ({
      click: (p: unknown) => {
        const pp = p as { name?: string };
        const iso = pp.name ? ISO_BY_NE[pp.name] : undefined;
        if (iso && iso !== 'TWN' && onCountryClick) onCountryClick(iso);
      },
    }),
    [onCountryClick],
  );

  const title = t('international.map.title', { indicator: nameI(ind) });
  const subtitle = t('international.map.subtitle', {
    region: reg === 'all' ? t('international.allRegions') : nameR(reg),
    year: yr === 'latest' ? t('international.latestAvailable') : yr,
  });
  const tableRows = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.resistant_pct - a.resistant_pct)
        .map((r: GlassRecord) => ({
          [t('international.country')]: nameC(r.iso3),
          ISO3: r.iso3,
          [t('international.region')]: nameR(r.whoRegion),
          [t('common.year')]: r.year,
          [t('common.resistantPct')]: r.resistant_pct,
          [t('common.source')]: srcs.get(r.source)?.publisher ?? r.source,
        })),
    [rows, t, nameC, nameR, srcs],
  );

  return (
    <ChartCard
      id="glass-map"
      title={title}
      subtitle={subtitle}
      source={glassSourceLine(env, t.locale, (n) => t('international.sourceMore', { n }))}
      dataset="glass"
      status={mapError ? 'error' : status === 'ready' && rows.length === 0 ? 'empty' : status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-glass-map-${ind}`.toLowerCase()}
      link={link}
      embed={{ chart: 'glass-map', params: { indicator: ind, region: reg !== 'all' ? reg : null } }}
      keyNumber={
        tw
          ? { value: fmtPct(tw.resistant_pct, t.locale), label: `${nameC('TWN')} · ${nameI(ind)}` }
          : undefined
      }
      compact={compact}
      height={height}
      footer={
        compact ? undefined : (
          <a className={k.hint} href={GLASS_DASHBOARD_URL} target="_blank" rel="noreferrer">
            {t('international.glassDashboard')} ↗
          </a>
        )
      }
    >
      <EChart
        ref={ref}
        option={option}
        height={height}
        onEvents={onEvents}
        loading={!mapReady}
        ariaLabel={`${title}. ${t('international.map.aria')}`}
      />
      <div className={k.chartNote}>
        <span>{t('international.map.legend')}</span>
        <span>
          <span
            className={k.swatch}
            style={{
              display: 'inline-block',
              verticalAlign: 'middle',
              marginRight: 6,
              background: ct.tokens.surface2,
              border: `1px solid ${ct.tokens.axis}`,
            }}
          />
          {t('international.map.noDataLegend')}
        </span>
        {onCountryClick && <span>{t('international.map.clickHint')}</span>}
      </div>
    </ChartCard>
  );
}
