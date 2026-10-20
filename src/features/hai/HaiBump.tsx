import type { EChartsOption } from 'echarts';
import { useMemo, useRef, useState } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { MUTED, textOn } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { dimNamer, fmtPct } from '../../data/format';
import { useDataset } from '../../data/load';
import { inYearRange, latestYear, yearsOf } from '../../data/select';
import { useT } from '../../i18n';
import { hashParam, tipRow, tipTitle, envSourceLine } from '../international/kit/util';
import { useNarrow } from '../international/kit/hooks';
import { LegendSwatch } from '../international/kit/Kit';
import k from '../international/kit/kit.module.css';
import { SITES, organismColors, organismShort, pathogenLevel, type Site } from './haiModel';
import type { HaiChartProps } from './HaiTrend';

/** Bump chart: pathogen rank (top 10) by year for one infection site; hover highlights an organism. */
export function HaiBump({
  level: lvl,
  site: siteProp,
  onSiteChange,
  years,
  compact,
  link,
  fixtureFallback,
}: HaiChartProps & { onSiteChange?: (s: Site) => void }) {
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const initial = (siteProp ?? hashParam('site') ?? 'bsi') as Site;
  const [localSite, setLocalSite] = useState<Site>(
    (SITES as readonly string[]).includes(initial) ? initial : 'bsi',
  );
  const site = siteProp && (SITES as readonly string[]).includes(siteProp) ? (siteProp as Site) : localSite;
  const setSite = onSiteChange ?? setLocalSite;
  const { data: env, status } = useDataset('hai_pathogens', { fixtureFallback });
  const level = pathogenLevel(env, lvl ?? 'all');
  const nameP = dimNamer(env?.dims?.pathogens, t.locale);
  const nameS = dimNamer(env?.dims?.sites, t.locale);
  const color = useMemo(() => organismColors(env, ct.theme), [env, ct.theme]);
  const short = (c: string) => organismShort(env, c, nameP(c));

  const model = useMemo(() => {
    if (!env) return null;
    const rows = env.records.filter(
      (r) => r.level === level && r.site === site && inYearRange(r.year, years) && r.rank <= 10,
    );
    const ys = yearsOf(rows);
    const orgs = [...new Set(rows.map((r) => r.pathogen))];
    const last = latestYear(rows);
    const lastRank = new Map(rows.filter((r) => r.year === last).map((r) => [r.pathogen, r.rank]));
    orgs.sort((a, b) => (lastRank.get(a) ?? 99) - (lastRank.get(b) ?? 99));
    const at = new Map(rows.map((r) => [`${r.pathogen}|${r.year}`, r]));
    return { ys, orgs, at, last };
  }, [env, level, site, years]);

  const height = compact ? 340 : narrow ? 380 : 420;
  const option = useMemo<EChartsOption>(() => {
    if (!model) return {};
    const tok = ct.tokens;
    return {
      grid: { left: 8, right: narrow ? 92 : 128, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (p: unknown) => {
          const pp = p as {
            seriesName: string;
            data: { org: string; year: number; pct: number; rank: number };
          };
          const d = pp.data;
          if (!d) return '';
          return (
            tipTitle(`${nameP(d.org)}`) +
            tipRow(color(d.org), `${d.year} · ${t('hai.bump.rank')}`, `#${d.rank}`, true) +
            tipRow(undefined, t('hai.bump.share'), fmtPct(d.pct, t.locale))
          );
        },
      },
      xAxis: {
        type: 'category',
        data: model.ys.map(String),
        boundaryGap: false,
        axisLine: { show: false },
        splitLine: { show: true, lineStyle: { color: tok.grid } },
      },
      yAxis: {
        type: 'value',
        inverse: true,
        min: 1,
        max: 10,
        interval: 1,
        axisLabel: { formatter: '#{value}' },
        splitLine: { show: false },
      },
      series: model.orgs.map((o) => {
        const c = color(o);
        const muted = c === MUTED[ct.theme];
        return {
          type: 'line',
          name: short(o),
          data: model.ys.map((y) => {
            const r = model.at.get(`${o}|${y}`);
            return r ? { value: r.rank, org: o, year: y, pct: r.pct, rank: r.rank } : null;
          }),
          connectNulls: false,
          smooth: 0.25,
          symbol: 'circle',
          symbolSize: 9,
          showSymbol: true,
          lineStyle: { color: c, width: muted ? 2 : 3 },
          itemStyle: { color: c, borderColor: tok.surface, borderWidth: 2 },
          endLabel: {
            show: model.at.has(`${o}|${model.last}`),
            formatter: short(o),
            color: tok.ink2,
            fontSize: 11,
            fontWeight: 600,
            distance: 8,
          },
          emphasis: {
            focus: 'series',
            lineStyle: { width: 4.5 },
            endLabel: { color: tok.ink, fontWeight: 750 },
          },
          blur: { lineStyle: { opacity: 0.12 }, itemStyle: { opacity: 0.12 }, endLabel: { opacity: 0.3 } },
          z: muted ? 1 : 2,
        };
      }),
    } as EChartsOption;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, ct, color, nameP, t, narrow]);

  const tableRows = useMemo(() => {
    if (!model) return undefined;
    return model.orgs.map((o) => {
      const row: Record<string, string | number | null> = { [t('hai.bump.organism')]: nameP(o) };
      for (const y of model.ys) row[String(y)] = model.at.get(`${o}|${y}`)?.rank ?? null;
      return row;
    });
  }, [model, t, nameP]);

  const csvRows = useMemo(
    () =>
      model
        ? [...model.at.values()].map((r) => ({
            year: r.year,
            site: r.site,
            level: r.level,
            rank: r.rank,
            pathogen: r.pathogen,
            name: nameP(r.pathogen),
            pct: r.pct,
          }))
        : undefined,
    [model, nameP],
  );

  const top = model?.orgs[0];
  const title = t('hai.bump.title', { site: nameS(site) });
  const subtitle = t('hai.bump.subtitle', { level: t(`levels.${level}`) });
  return (
    <ChartCard
      id="hai-bump"
      title={title}
      subtitle={subtitle}
      source={envSourceLine(env, t.locale)}
      dataset="hai_pathogens"
      status={status === 'ready' && model && !model.orgs.length ? 'empty' : status}
      chartRef={ref}
      tableRows={tableRows}
      csvRows={csvRows}
      fileName={`twamr-hai-pathogen-rank-${site}-${level}`}
      link={link}
      embed={{ chart: 'hai-bump', params: { site, level: level !== 'all' ? level : null } }}
      keyNumber={
        top && model?.last ? { value: short(top), label: `#1 · ${nameS(site)} · ${model.last}` } : undefined
      }
      compact={compact}
      height={height}
      actions={
        <div className={k.scrollX}>
          <SegmentedControl<Site>
            size="sm"
            label={t('hai.bump.siteLabel')}
            value={site}
            onChange={setSite}
            options={SITES.map((s) => ({ value: s, label: t(`hai.sites.${s}`) }))}
          />
        </div>
      }
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${subtitle}`} />
    </ChartCard>
  );
}

/** 100 % stacked bar per infection site for the latest year: top-10 organisms + "Other". */
export function HaiShare({ level: lvl, years, link }: HaiChartProps) {
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status } = useDataset('hai_pathogens');
  const level = pathogenLevel(env, lvl ?? 'all');
  const nameP = dimNamer(env?.dims?.pathogens, t.locale);
  const color = useMemo(() => organismColors(env, ct.theme), [env, ct.theme]);
  const short = (c: string) => organismShort(env, c, nameP(c));

  const model = useMemo(() => {
    if (!env) return null;
    const rows = env.records.filter((r) => r.level === level && inYearRange(r.year, years));
    const year = latestYear(rows);
    const cur = rows.filter((r) => r.year === year);
    const sites = SITES.filter((s) => cur.some((r) => r.site === s));
    const totals = new Map<string, number>();
    for (const r of cur) totals.set(r.pathogen, (totals.get(r.pathogen) ?? 0) + r.pct);
    const orgs = [...totals.keys()].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
    const at = new Map(cur.map((r) => [`${r.site}|${r.pathogen}`, r.pct]));
    const other = sites.map((s) =>
      Math.max(0, 100 - cur.filter((r) => r.site === s).reduce((a, r) => a + r.pct, 0)),
    );
    return { year, sites, orgs, at, other };
  }, [env, level, years]);

  const height = narrow ? 240 : 220;
  const option = useMemo<EChartsOption>(() => {
    if (!model) return {};
    const tok = ct.tokens;
    const otherName = t('hai.share.other');
    const mk = (name: string, data: number[], c: string) => ({
      type: 'bar',
      name,
      stack: 'share',
      data: data.map((v) => Math.round(v * 10) / 10),
      barWidth: narrow ? 26 : 30,
      itemStyle: { color: c, borderColor: tok.surface, borderWidth: 1.5 },
      label: {
        show: true,
        formatter: (p: { value: number; seriesName: string }) =>
          !narrow && p.value >= 12 ? p.seriesName : '',
        fontSize: 10,
        color: textOn(c),
        overflow: 'truncate',
      },
      emphasis: { focus: 'series' },
    });
    return {
      grid: { left: 4, right: 12, top: 8, bottom: 4, containLabel: true },
      legend: { show: false, data: [...model.orgs.map(short), otherName] },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        formatter: (ps: unknown) => {
          const arr = (ps as { seriesName: string; value: number; color: string; name: string }[])
            .filter((p) => p.value > 0)
            .sort((a, b) => b.value - a.value);
          return (
            tipTitle(`${arr[0]?.name ?? ''} · ${model.year}`) +
            arr.map((p) => tipRow(p.color, p.seriesName, fmtPct(p.value, t.locale))).join('')
          );
        },
      },
      xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
      yAxis: {
        type: 'category',
        data: model.sites.map((s) => t(`hai.sites.${s}`)),
        inverse: true,
        axisLine: { show: false },
      },
      series: [
        ...model.orgs.map((o) =>
          mk(
            short(o),
            model.sites.map((s) => model.at.get(`${s}|${o}`) ?? 0),
            color(o),
          ),
        ),
        {
          ...mk(otherName, model.other, ct.theme === 'dark' ? '#2a3a32' : '#d7ddd9'),
          label: { show: false },
        },
      ],
    } as EChartsOption;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, ct, t, narrow, color]);

  const tableRows = useMemo(
    () =>
      (model?.orgs ?? []).map((o) => {
        const row: Record<string, string | number | null> = { [t('hai.bump.organism')]: nameP(o) };
        for (const s of model!.sites) row[t(`hai.sites.${s}`)] = model!.at.get(`${s}|${o}`) ?? null;
        return row;
      }),
    [model, t, nameP],
  );

  const title = t('hai.share.title', { year: model?.year ?? '—' });
  const subtitle = t('hai.share.subtitle', { level: t(`levels.${level}`) });
  return (
    <ChartCard
      id="hai-share"
      title={title}
      subtitle={subtitle}
      source={envSourceLine(env, t.locale)}
      dataset="hai_pathogens"
      status={status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-hai-pathogen-share-${level}-${model?.year ?? ''}`}
      link={link}
      height={height}
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${subtitle}`} />
      <div className={k.legend} style={{ padding: '6px 4px 0' }}>
        {(model?.orgs ?? []).map((o) => (
          <LegendSwatch key={o} color={color(o)} label={short(o)} />
        ))}
        <LegendSwatch color={ct.theme === 'dark' ? '#2a3a32' : '#d7ddd9'} label={t('hai.share.other')} />
      </div>
    </ChartCard>
  );
}
