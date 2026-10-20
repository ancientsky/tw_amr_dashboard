import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { colorMap, LEVEL_ORDER } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { Kpi } from '../../components/ui/Kpi';
import { fmtNumber, fmtPct } from '../../data/format';
import { useDataset } from '../../data/load';
import { inYearRange, type YearRange } from '../../data/select';
import type { Level } from '../../data/types';
import { useT } from '../../i18n';
import { tipRow, tipTitle, envSourceLine } from '../international/kit/util';
import { AWARE_COLORS, CARB, WHO_ACCESS_TARGET, awareByYear, classValue, levelsOf, share, totalByYear } from './amuModel';
import s from './amu.module.css';

/** KPI row: total DID, AWaRe shares, carbapenem DID (latest year in range, selected level). */
export function AmuKpis({ level, years, link }: { level: Level; years?: YearRange; link?: string }) {
  const t = useT();
  const ct = useChartTheme();
  const { data: env, status } = useDataset('antibiotic_use');
  const dims = env?.dims?.classes;

  const m = useMemo(() => {
    if (!env) return null;
    const splits = awareByYear(env.records, dims, level).filter((x) => inYearRange(x.year, years));
    const totals = totalByYear(env.records, dims, level);
    if (!splits.length) return null;
    const cur = splits[splits.length - 1];
    const prev = splits.length > 1 ? splits[splits.length - 2] : undefined;
    const ys = splits.map((x) => x.year);
    const carb = ys.map((y) => classValue(env.records, level, CARB, y) ?? null);
    const tot = ys.map((y) => totals.get(y) ?? null);
    return { cur, prev, splits, carb, tot, ys };
  }, [env, dims, level, years]);

  const d = (a?: number | null, b?: number | null) => (a !== undefined && a !== null && b !== undefined && b !== null ? a - b : undefined);
  const vs = m?.prev ? t('kpi.vsPrev', { year: m.prev.year }) : undefined;
  const n = m?.tot.length ?? 0;

  const rows = m
    ? [
        { [t('amu.kpi.metric')]: t('amu.kpi.total'), [t('common.year')]: m.cur.year, [t('common.value')]: m.tot[n - 1] ?? null, Δ: d(m.tot[n - 1], m.tot[n - 2]) ?? null },
        { [t('amu.kpi.metric')]: t('amu.kpi.accessShare'), [t('common.year')]: m.cur.year, [t('common.value')]: Math.round(share(m.cur, 'Access') * 10) / 10, Δ: m.prev ? Math.round((share(m.cur, 'Access') - share(m.prev, 'Access')) * 10) / 10 : null },
        { [t('amu.kpi.metric')]: t('amu.kpi.watchShare'), [t('common.year')]: m.cur.year, [t('common.value')]: Math.round(share(m.cur, 'Watch') * 10) / 10, Δ: m.prev ? Math.round((share(m.cur, 'Watch') - share(m.prev, 'Watch')) * 10) / 10 : null },
        { [t('amu.kpi.metric')]: t('amu.kpi.reserveShare'), [t('common.year')]: m.cur.year, [t('common.value')]: Math.round(share(m.cur, 'Reserve') * 10) / 10, Δ: m.prev ? Math.round((share(m.cur, 'Reserve') - share(m.prev, 'Reserve')) * 10) / 10 : null },
        { [t('amu.kpi.metric')]: t('amu.kpi.carb'), [t('common.year')]: m.cur.year, [t('common.value')]: m.carb[n - 1] ?? null, Δ: d(m.carb[n - 1], m.carb[n - 2]) ?? null },
      ]
    : undefined;

  const sharesTrend = (k: 'Access' | 'Watch' | 'Reserve') => m?.splits.map((x) => share(x, k));

  return (
    <ChartCard
      id="amu-kpis"
      title={t('amu.kpi.title')}
      subtitle={t('amu.kpi.subtitle', { level: t(`levels.${level}`), year: m?.cur.year ?? '—' })}
      source={envSourceLine(env, t.locale)}
      dataset="antibiotic_use"
      status={status === 'ready' && !m ? 'empty' : status}
      tableRows={rows}
      fileName={`twamr-amu-kpis-${level}`}
      link={link}
      keyNumber={m ? { value: fmtPct(share(m.cur, 'Access'), t.locale), label: `${t('amu.kpi.accessShare')} · ${m.cur.year}` } : undefined}
      toolbar={{ fullscreen: false }}
      height={170}
    >
      {m && (
        <div className={s.kpiGrid}>
          <Kpi
            label={t('amu.kpi.total')}
            value={m.tot[n - 1]}
            format={(v) => fmtNumber(v, t.locale, { digits: 0 })}
            unit="DID"
            delta={d(m.tot[n - 1], m.tot[n - 2])}
            deltaLabel={vs}
            trend={m.tot}
            caption={t('amu.kpi.totalCaption')}
          />
          <Kpi
            label={t('amu.kpi.accessShare')}
            value={share(m.cur, 'Access')}
            format={(v) => fmtNumber(v, t.locale, { digits: 1 })}
            unit="%"
            delta={m.prev ? share(m.cur, 'Access') - share(m.prev, 'Access') : undefined}
            deltaUnit={t('kpi.pp')}
            deltaLabel={vs}
            goodDirection="up"
            trend={sharesTrend('Access')}
            accent={AWARE_COLORS[ct.theme].Access}
            caption={t('amu.kpi.targetCaption', { target: WHO_ACCESS_TARGET })}
          />
          <Kpi
            label={t('amu.kpi.watchShare')}
            value={share(m.cur, 'Watch')}
            format={(v) => fmtNumber(v, t.locale, { digits: 1 })}
            unit="%"
            delta={m.prev ? share(m.cur, 'Watch') - share(m.prev, 'Watch') : undefined}
            deltaUnit={t('kpi.pp')}
            deltaLabel={vs}
            trend={sharesTrend('Watch')}
            accent={AWARE_COLORS[ct.theme].Watch}
          />
          <Kpi
            label={t('amu.kpi.reserveShare')}
            value={share(m.cur, 'Reserve')}
            format={(v) => fmtNumber(v, t.locale, { digits: 1 })}
            unit="%"
            delta={m.prev ? share(m.cur, 'Reserve') - share(m.prev, 'Reserve') : undefined}
            deltaUnit={t('kpi.pp')}
            deltaLabel={vs}
            trend={sharesTrend('Reserve')}
            accent={AWARE_COLORS[ct.theme].Reserve}
          />
          <Kpi
            label={t('amu.kpi.carb')}
            value={m.carb[n - 1]}
            format={(v) => fmtNumber(v, t.locale, { digits: 1 })}
            unit="DID"
            delta={d(m.carb[n - 1], m.carb[n - 2])}
            deltaLabel={vs}
            trend={m.carb}
          />
        </div>
      )}
    </ChartCard>
  );
}

/** Bullet chart: Access share per hospital level vs the WHO 2030 target (≥70 % Access). */
export function AmuTarget({ level, years, link }: { level: Level; years?: YearRange; link?: string }) {
  const t = useT();
  const ct = useChartTheme();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status } = useDataset('antibiotic_use');
  const dims = env?.dims?.classes;
  const levels = useMemo(() => levelsOf(env), [env]);

  const items = useMemo(() => {
    if (!env) return [];
    return levels
      .map((l) => {
        const sp = awareByYear(env.records, dims, l).filter((x) => inYearRange(x.year, years));
        const cur = sp[sp.length - 1];
        return cur ? { level: l, year: cur.year, access: share(cur, 'Access') } : null;
      })
      .filter((x): x is { level: Level; year: number; access: number } => Boolean(x));
  }, [env, dims, levels, years]);

  const height = items.length * 46 + 70;
  const option = useMemo<EChartsOption>(() => {
    const tok = ct.tokens;
    const color = colorMap([...LEVEL_ORDER], ct.theme);
    const cats = items.map((x) => t(`levels.${x.level}`));
    const accessC = AWARE_COLORS[ct.theme].Access;
    return {
      grid: { left: 4, right: 56, top: 26, bottom: 6, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (ps: unknown) => {
          const p = (ps as { dataIndex: number }[])[0];
          const it = items[p?.dataIndex ?? -1];
          if (!it) return '';
          return (
            tipTitle(`${t(`levels.${it.level}`)} · ${it.year}`) +
            tipRow(accessC, t('amu.kpi.accessShare'), fmtPct(it.access, t.locale), true) +
            tipRow(undefined, t('amu.target.gap'), `${fmtNumber(it.access - WHO_ACCESS_TARGET, t.locale, { digits: 1 })} ${t('kpi.pp')}`)
          );
        },
      },
      xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      yAxis: {
        type: 'category',
        data: cats,
        inverse: true,
        axisLine: { show: false },
        axisLabel: { color: tok.ink2, fontWeight: 600, formatter: (v: string, i: number) => (items[i]?.level === level ? `{b|${v}}` : v), rich: { b: { fontWeight: 700, color: tok.ink } } },
      },
      series: [
        {
          type: 'bar',
          data: items.map(() => 100),
          barWidth: 16,
          barGap: '-100%',
          silent: true,
          itemStyle: { color: tok.surface2, borderRadius: 4 },
          tooltip: { show: false },
        },
        {
          type: 'bar',
          name: t('amu.kpi.accessShare'),
          data: items.map((x) => ({ value: Math.round(x.access * 10) / 10, itemStyle: { color: accessC, opacity: x.level === level ? 1 : 0.7 } })),
          barWidth: 8,
          itemStyle: { borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', formatter: (p: { value: number }) => fmtPct(p.value, t.locale), color: tok.ink2, fontSize: 11.5, fontWeight: 600 },
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { color: tok.ink, width: 2, type: 'solid' },
            label: { formatter: t('amu.target.line', { target: WHO_ACCESS_TARGET }), color: tok.ink, fontWeight: 650, fontSize: 11, position: 'end' },
            data: [{ xAxis: WHO_ACCESS_TARGET }],
          },
        },
      ],
      color: [color('all')],
    } as EChartsOption;
  }, [items, ct, t, level]);

  const title = t('amu.target.title');
  return (
    <ChartCard
      id="amu-target"
      title={title}
      subtitle={t('amu.target.subtitle', { target: WHO_ACCESS_TARGET })}
      source={envSourceLine(env, t.locale)}
      dataset="antibiotic_use"
      status={status === 'ready' && !items.length ? 'empty' : status}
      chartRef={ref}
      tableRows={items.map((x) => ({ [t('common.level')]: t(`levels.${x.level}`), [t('common.year')]: x.year, [t('amu.kpi.accessShare')]: Math.round(x.access * 10) / 10, [t('amu.target.gap')]: Math.round((x.access - WHO_ACCESS_TARGET) * 10) / 10 }))}
      fileName="twamr-amu-who-access-target"
      link={link}
      height={height}
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${t('amu.target.subtitle', { target: WHO_ACCESS_TARGET })}`} />
    </ChartCard>
  );
}
