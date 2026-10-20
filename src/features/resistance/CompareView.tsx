import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { colorMap, LEVEL_ORDER, seriesColor, withAlpha } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { fmtPct } from '../../data/format';
import type { Level } from '../../data/types';
import { useT } from '../../i18n';
import { Narrative } from './bits';
import { abKey, alignPoints, antibiogramYears, indexSeries, isEstimate, parseItem, toPoint, trendPoints, yearSpan, type AntibiogramIndex, type CompareItem, type Point, type TrendIndex } from './lib';
import { resistanceSource, useResistanceModel, type Names } from './model';
import { narrate } from './TrendView';
import type { ExplorerState } from './useExplorerState';
import s from './resistance.module.css';

const esc = (x: string) => x.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]!);

function itemPoints(it: CompareItem, level: Level, setting: ExplorerState['setting'], trend: TrendIndex, ab: AntibiogramIndex): Point[] {
  if (it.kind === 'pheno') return trendPoints(trend, it.phenotype, level, setting);
  return antibiogramYears(ab)
    .map((y) => ab.get(abKey(y, level, it.pathogen, it.antibiotic)))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map(toPoint);
}

export function itemLabel(it: CompareItem, names: Names): string {
  return it.kind === 'pheno' ? it.phenotype : `${names.pathogenShort(it.pathogen)} × ${it.antibiotic}`;
}

export function CompareView({ state, link }: { state: ExplorerState; link: (extra?: Record<string, string | null>) => string }) {
  const t = useT();
  const ct = useChartTheme();
  const lineRef = useRef<EChartHandle>(null);
  const bulletRef = useRef<EChartHandle>(null);
  const { env, trend, ab, names, status, isFixture } = useResistanceModel();
  const items = useMemo(() => state.items.map(parseItem).filter((x): x is CompareItem => !!x), [state.items]);
  const range = state.years;
  const years = useMemo(() => yearSpan(range[0], range[1]), [range]);

  const series = useMemo(() => {
    if (!trend || !ab) return [];
    return items.map((it, i) => {
      const pts = itemPoints(it, state.level, state.setting, trend, ab).filter((p) => p.year >= range[0] && p.year <= range[1]);
      const aligned = alignPoints(pts, years);
      const raw = aligned.map((p) => p?.value ?? null);
      return { it, label: itemLabel(it, names), color: seriesColor(i, ct.theme), pts, aligned, values: state.norm ? indexSeries(raw) : raw };
    });
  }, [items, trend, ab, state.level, state.setting, state.norm, range, years, names, ct.theme]);

  const lineOption = useMemo<EChartsOption>(() => {
    const k = ct.tokens;
    const vals = series.flatMap((x) => x.values).filter((v): v is number => v !== null);
    return {
      grid: { left: 4, right: 24, top: 44, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, data: series.map((x) => x.label) },
      tooltip: {
        trigger: 'axis',
        formatter: (raw: unknown) => {
          const arr = (Array.isArray(raw) ? raw : [raw]) as { seriesIndex: number; dataIndex: number; value: number | null }[];
          const yr = years[arr[0]?.dataIndex ?? 0];
          const rows = arr
            .filter((p) => p.value !== null && p.value !== undefined)
            .map((p) => {
              const x = series[p.seriesIndex];
              const pt = x?.aligned[p.dataIndex];
              const v = state.norm ? `${Number(p.value).toFixed(0)} <span style="opacity:.6">(${fmtPct(pt?.value, t.locale)})</span>` : fmtPct(Number(p.value), t.locale);
              return `<div style="display:flex;justify-content:space-between;gap:16px"><span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${x?.color};margin-right:6px"></span>${esc(x?.label ?? '')}</span><b>${v}</b></div>`;
            });
          return `<div style="font-weight:700;margin-bottom:4px">${yr}</div>${rows.join('')}`;
        },
      },
      xAxis: { type: 'category', data: years.map(String), boundaryGap: false },
      yAxis: state.norm
        ? { type: 'value', min: Math.max(0, Math.floor((Math.min(100, ...vals) - 10) / 10) * 10), name: t('resistance.trend.indexAxis') }
        : { type: 'value', min: 0, max: Math.min(100, Math.max(10, Math.ceil((Math.max(0, ...vals) + 4) / 10) * 10)), axisLabel: { formatter: '{value}%' } },
      series: series.map((x) => ({
        name: x.label,
        type: 'line',
        connectNulls: true,
        showSymbol: true,
        lineStyle: { width: 2, color: x.color, type: x.it.kind === 'pair' ? 'solid' : 'solid' },
        itemStyle: { color: x.color },
        endLabel: { show: series.length <= 4, formatter: x.label, color: k.ink2, fontSize: 11.5, fontWeight: 600, distance: 6 },
        data: x.values.map((v, i) =>
          v === null
            ? null
            : {
                value: v,
                symbolSize: 8,
                itemStyle: isEstimate(x.aligned[i]) ? { color: k.surface, borderColor: x.color, borderWidth: 2 } : { color: x.color, borderColor: k.surface, borderWidth: 2 },
              },
        ),
      })),
    } as EChartsOption;
  }, [series, years, ct.tokens, state.norm, t]);

  // Level-by-level bullet: national bar + markers per hospital level, latest year per item.
  const bullet = useMemo(() => {
    if (!trend || !ab) return [];
    return items.map((it) => {
      const lv = (l: Level) => {
        const pts = itemPoints(it, l, it.kind === 'pheno' ? state.setting : 'all', trend, ab);
        return pts[pts.length - 1];
      };
      const nat = lv('all');
      const year = nat?.year;
      const byLevel = (['medical_center', 'regional', 'district'] as Level[]).map((l) => {
        const p = lv(l);
        return p && p.year === year ? p : undefined;
      });
      return { it, label: itemLabel(it, names), nat, year, byLevel };
    });
  }, [items, trend, ab, state.setting, names]);

  const bulletOption = useMemo<EChartsOption>(() => {
    const k = ct.tokens;
    const lc = colorMap([...LEVEL_ORDER], ct.theme);
    const lvls: Level[] = ['medical_center', 'regional', 'district'];
    return {
      grid: { left: 4, right: 24, top: 36, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, data: [names.level('all'), ...lvls.map((l) => names.level(l))] },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const arr = raw as { dataIndex: number }[];
          const b = bullet[arr[0]?.dataIndex ?? 0];
          if (!b) return '';
          const line = (name: string, p?: Point) => (p ? `<div style="display:flex;justify-content:space-between;gap:16px"><span>${esc(name)}</span><b>${fmtPct(p.value, t.locale)}</b></div>` : '');
          return `<div style="font-weight:700">${esc(b.label)} · ${b.year ?? ''}</div>${line(names.level('all'), b.nat)}${lvls.map((l, i) => line(names.level(l), b.byLevel[i])).join('')}`;
        },
      },
      xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      yAxis: { type: 'category', inverse: true, data: bullet.map((b) => `${b.label}${b.year ? ` (${b.year})` : ''}`), axisLine: { show: false }, axisLabel: { color: k.ink2, fontWeight: 600 } },
      series: [
        {
          name: names.level('all'),
          type: 'bar',
          barWidth: 14,
          data: bullet.map((b) => b.nat?.value ?? null),
          itemStyle: { color: withAlpha(lc('all'), 0.35), borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'insideRight', formatter: (p: { value: number }) => fmtPct(p.value, t.locale), color: k.ink, fontWeight: 650, fontSize: 11.5 },
        },
        ...lvls.map((l, i) => ({
          name: names.level(l),
          type: 'scatter',
          symbol: 'rect',
          symbolSize: [4, 22],
          z: 4,
          data: bullet.map((b) => b.byLevel[i]?.value ?? null),
          itemStyle: { color: lc(l), borderColor: k.surface, borderWidth: 1 },
        })),
      ],
    } as EChartsOption;
  }, [bullet, ct.tokens, ct.theme, names, t]);

  const tableRows = useMemo(
    () =>
      years.map((y, i) => {
        const row: Record<string, string | number | null> = { [t('common.year')]: String(y) };
        for (const x of series) row[x.label] = x.values[i];
        return row;
      }),
    [years, series, t],
  );
  const bulletRows = bullet.map((b) => ({
    [t('resistance.compare.item')]: b.label,
    [t('common.year')]: b.year ? String(b.year) : '',
    [names.level('all')]: b.nat?.value ?? null,
    [names.level('medical_center')]: b.byLevel[0]?.value ?? null,
    [names.level('regional')]: b.byLevel[1]?.value ?? null,
    [names.level('district')]: b.byLevel[2]?.value ?? null,
  }));
  const sentences = series.map((x) => narrate(t, `${x.label} (${names.level(state.level)})`, x.pts)).filter((x): x is string => !!x);
  const hasPair = items.some((i) => i.kind === 'pair');
  const title = t('resistance.compare.title');
  const source = resistanceSource(env, t.locale);
  const allPts = series.flatMap((x) => x.pts);
  const bh = Math.max(200, bullet.length * 52 + 60);

  return (
    <div className={s.viewStack}>
      <ChartCard
        id="resistance-compare"
        title={title}
        subtitle={t(state.norm ? 'resistance.compare.subtitleNorm' : 'resistance.compare.subtitle', { level: names.level(state.level), setting: names.setting(state.setting), from: range[0], to: range[1] })}
        source={source}
        dataset="resistance"
        isFixture={isFixture}
        precision={allPts}
        status={status === 'ready' && allPts.length === 0 ? 'empty' : status}
        chartRef={lineRef}
        tableRows={tableRows}
        fileName={`twamr-compare-${state.items.join('-')}`.toLowerCase()}
        link={link({ chart: 'resistance-compare' })}
        height={380}
        footer={hasPair ? <span className={s.cardFootNote}>{t('resistance.compare.pairNote')}</span> : undefined}
      >
        <EChart ref={lineRef} option={lineOption} height={380} ariaLabel={`${title}. ${t('resistance.compare.aria')}`} />
      </ChartCard>
      {sentences.length > 0 && (
        <Narrative>
          <h3 className={s.narrativeTitle}>{t('resistance.trend.summary')}</h3>
          <ul>
            {sentences.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Narrative>
      )}
      <ChartCard
        id="resistance-compare-levels"
        title={t('resistance.compare.bulletTitle')}
        subtitle={t('resistance.compare.bulletSubtitle', { setting: names.setting(state.setting) })}
        source={source}
        dataset="resistance"
        isFixture={isFixture}
        precision={bullet.flatMap((b) => [b.nat, ...b.byLevel].filter((p): p is Point => !!p))}
        status={status}
        chartRef={bulletRef}
        tableRows={bulletRows}
        fileName={`twamr-compare-levels-${state.items.join('-')}`.toLowerCase()}
        link={link({ chart: 'resistance-compare-levels' })}
        height={bh}
      >
        <EChart ref={bulletRef} option={bulletOption} height={bh} ariaLabel={`${t('resistance.compare.bulletTitle')}. ${t('resistance.compare.bulletAria')}`} />
      </ChartCard>
    </div>
  );
}
