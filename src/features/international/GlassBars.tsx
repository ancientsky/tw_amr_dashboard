import type { EChartsOption } from 'echarts';
import { useMemo, useRef, useState } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { CATEGORICAL } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { dimNamer, fmtPct } from '../../data/format';
import { useDataset } from '../../data/load';
import { useT } from '../../i18n';
import type { GlassChartProps } from './GlassMap';
import { DEFAULT_INDICATOR, WHO_REGIONS, glassRows } from './glassModel';
import { hashParam, median, niceMax, tipRow, tipTitle, glassSourceLine } from './kit/util';
import { useNarrow } from './kit/hooks';

export type BarsView = 'countries' | 'regions';

/** WHO region → fixed categorical slot (colour follows the region, never its rank). */
export function regionColor(region: string, theme: 'light' | 'dark'): string {
  const i = (WHO_REGIONS as readonly string[]).indexOf(region);
  return CATEGORICAL[theme][i >= 0 ? i : 7];
}

interface Item {
  key: string;
  label: string;
  region: string;
  value: number;
  year?: number;
  n?: number;
  isTw: boolean;
}

/** Taiwan vs every country (or WHO-region medians) for one indicator: horizontal lollipop + median line. */
export function GlassBars({
  indicator,
  region,
  year,
  view,
  onViewChange,
  compact,
  link,
  fixtureFallback,
}: GlassChartProps & { view?: BarsView; onViewChange?: (v: BarsView) => void }) {
  const ind = indicator ?? hashParam('indicator') ?? DEFAULT_INDICATOR;
  const reg = region ?? hashParam('region') ?? 'all';
  const yr = year ?? hashParam('year') ?? 'latest';
  const [localView, setLocalView] = useState<BarsView>((hashParam('bars') as BarsView) === 'regions' ? 'regions' : 'countries');
  const mode = view ?? localView;
  const setMode = onViewChange ?? setLocalView;
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status } = useDataset('glass', { fixtureFallback });
  const nameC = dimNamer(env?.dims?.countries, t.locale);
  const nameI = dimNamer(env?.dims?.indicators, t.locale);
  const nameR = dimNamer(env?.dims?.whoRegions, t.locale);

  const model = useMemo(() => {
    if (!env) return null;
    const rows = glassRows(env.records, { indicator: ind, region: mode === 'regions' ? 'all' : reg, year: yr });
    const others = rows.filter((r) => r.iso3 !== 'TWN');
    const med = median(others.map((r) => r.resistant_pct));
    const tw = rows.find((r) => r.iso3 === 'TWN');
    let items: Item[];
    if (mode === 'regions') {
      items = WHO_REGIONS.map((rg) => {
        const vals = others.filter((r) => r.whoRegion === rg).map((r) => r.resistant_pct);
        return { key: rg, label: nameR(rg), region: rg, value: median(vals) ?? NaN, n: vals.length, isTw: false };
      }).filter((x) => Number.isFinite(x.value));
      if (tw) items.push({ key: 'TWN', label: nameC('TWN'), region: tw.whoRegion, value: tw.resistant_pct, year: tw.year, isTw: true });
    } else {
      items = rows.map((r) => ({ key: r.iso3, label: nameC(r.iso3), region: r.whoRegion, value: r.resistant_pct, year: r.year, isTw: r.iso3 === 'TWN' }));
    }
    items.sort((a, b) => b.value - a.value);
    const twRank = tw ? [...others, tw].sort((a, b) => b.resistant_pct - a.resistant_pct).findIndex((r) => r.iso3 === 'TWN') + 1 : undefined;
    return { items, med, tw, twRank, total: others.length + (tw ? 1 : 0) };
  }, [env, ind, reg, yr, mode, nameC, nameR]);

  const rowH = mode === 'regions' ? 36 : narrow ? 17 : 18;
  const height = compact ? 340 : Math.max(260, (model?.items.length ?? 10) * rowH + 72);

  const option = useMemo<EChartsOption>(() => {
    if (!model) return {};
    const tok = ct.tokens;
    const cats = model.items.map((x) => x.key);
    const labelOf = new Map(model.items.map((x) => [x.key, x]));
    const vmax = niceMax(Math.max(...model.items.map((x) => x.value), model.med ?? 0));
    const groups = mode === 'regions' ? [...WHO_REGIONS] : [...WHO_REGIONS];
    const series: Record<string, unknown>[] = [];
    for (const rg of groups) {
      const color = regionColor(rg, ct.theme);
      const vals = model.items.map((x) => (!x.isTw && x.region === rg ? x.value : '-'));
      if (!vals.some((v) => v !== '-')) continue;
      const name = nameR(rg);
      series.push({ type: 'bar', name, stack: 'lol', data: vals, barWidth: 3, itemStyle: { color, borderRadius: [0, 2, 2, 0] }, emphasis: { focus: 'series' } });
      series.push({
        type: 'scatter',
        name,
        data: model.items.map((x, i) => (!x.isTw && x.region === rg ? [x.value, i] : null)).filter(Boolean),
        symbolSize: mode === 'regions' ? 12 : 9,
        itemStyle: { color, borderColor: tok.surface, borderWidth: 2 },
        label: mode === 'regions' ? { show: true, position: 'right', formatter: (p: { value: number[] }) => fmtPct(p.value[0], t.locale), color: tok.ink2, fontSize: 11.5 } : undefined,
        emphasis: { focus: 'series' },
        z: 3,
      });
    }
    const twName = nameC('TWN');
    const twVals = model.items.map((x) => (x.isTw ? x.value : '-'));
    series.push({
      type: 'bar',
      name: twName,
      stack: 'lol',
      data: twVals,
      barWidth: 5,
      itemStyle: { color: tok.ink, borderRadius: [0, 3, 3, 0] },
      markLine:
        model.med !== undefined
          ? {
              symbol: 'none',
              silent: true,
              lineStyle: { color: tok.ink3, width: 1, type: 'solid' },
              label: { formatter: t('international.bars.median', { value: fmtPct(model.med, t.locale) }), color: tok.ink2, fontSize: 11, position: 'end' },
              data: [{ xAxis: model.med }],
            }
          : undefined,
    });
    series.push({
      type: 'scatter',
      name: twName,
      data: model.items.map((x, i) => (x.isTw ? [x.value, i] : null)).filter(Boolean),
      symbolSize: 14,
      itemStyle: { color: tok.ink, borderColor: tok.surface, borderWidth: 2, shadowBlur: ct.theme === 'dark' ? 14 : 0, shadowColor: tok.accent },
      label: { show: true, position: 'right', distance: 8, formatter: (p: { value: number[] }) => `${twName} ${fmtPct(p.value[0], t.locale)}`, color: tok.ink, fontWeight: 700, fontSize: 12 },
      z: 4,
    });
    return {
      grid: { left: 4, right: narrow ? 70 : 96, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, type: 'scroll', data: [twName, ...groups.map((g) => nameR(g))] },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        formatter: (ps: unknown) => {
          const arr = ps as { dataIndex: number }[];
          const it = model.items[arr[0]?.dataIndex ?? -1];
          if (!it) return '';
          const color = it.isTw ? tok.ink : regionColor(it.region, ct.theme);
          return (
            tipTitle(it.label) +
            tipRow(color, nameI(ind), fmtPct(it.value, t.locale), true) +
            (it.year ? tipRow(undefined, t('common.year'), String(it.year)) : '') +
            (it.n !== undefined ? tipRow(undefined, t('international.bars.nCountries'), String(it.n)) : '') +
            (!it.isTw && mode === 'countries' ? tipRow(undefined, t('international.region'), nameR(it.region)) : '')
          );
        },
      },
      xAxis: { type: 'value', min: 0, max: vmax, axisLabel: { formatter: '{value}%' } },
      yAxis: {
        type: 'category',
        data: cats,
        inverse: true,
        axisLabel: {
          interval: 0,
          fontSize: mode === 'regions' ? 12 : 11,
          formatter: (v: string) => {
            const it = labelOf.get(v);
            return it?.isTw ? `{tw|${it.label}}` : (it?.label ?? v);
          },
          rich: { tw: { fontWeight: 700, color: tok.ink, fontSize: 12 } },
        },
        axisLine: { show: false },
      },
      series,
    } as EChartsOption;
  }, [model, ct, mode, nameR, nameC, nameI, ind, t, narrow]);

  const title = t('international.bars.title', { indicator: nameI(ind) });
  const subtitle =
    model?.twRank && model.tw
      ? t('international.bars.subtitleRank', { rank: model.twRank, total: model.total, value: fmtPct(model.tw.resistant_pct, t.locale) })
      : t('international.bars.subtitle');
  const tableRows = useMemo(
    () =>
      (model?.items ?? []).map((x, i) => ({
        '#': i + 1,
        [mode === 'regions' ? t('international.region') : t('international.country')]: x.label,
        [t('common.resistantPct')]: x.value,
        ...(mode === 'regions' ? { [t('international.bars.nCountries')]: x.n ?? null } : { [t('common.year')]: x.year ?? null }),
      })),
    [model, mode, t],
  );

  return (
    <ChartCard
      id="glass-bars"
      title={title}
      subtitle={subtitle}
      source={glassSourceLine(env, t.locale, (n) => t('international.sourceMore', { n }))}
      dataset="glass"
      status={status === 'ready' && model && model.items.length === 0 ? 'empty' : status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-glass-bars-${ind}-${mode}`.toLowerCase()}
      link={link}
      embed={{ chart: 'glass-bars', params: { indicator: ind, bars: mode === 'regions' ? 'regions' : null } }}
      keyNumber={model?.twRank ? { value: `#${model.twRank}/${model.total}`, label: `${nameC('TWN')} · ${nameI(ind)}` } : undefined}
      compact={compact}
      height={height}
      actions={
        <SegmentedControl<BarsView>
          size="sm"
          label={t('international.bars.viewLabel')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'countries', label: t('international.bars.allCountries') },
            { value: 'regions', label: t('international.bars.regionMedians') },
          ]}
        />
      }
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${subtitle}`} />
    </ChartCard>
  );
}
