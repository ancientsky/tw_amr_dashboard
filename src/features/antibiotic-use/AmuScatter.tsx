import type { EChartsOption } from 'echarts';
import { useMemo, useRef, useState } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { colorMap, LEVEL_ORDER } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { Badge } from '../../components/ui/Badge';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { fmtNumber, fmtPct } from '../../data/format';
import { useDataset } from '../../data/load';
import { dedupeRecords, inYearRange, type YearRange } from '../../data/select';
import type { Level, ResistanceRecord } from '../../data/types';
import { sourceLine } from '../../embed/charts/common';
import { useT } from '../../i18n';
import { joinSources, tipRow, tipTitle, envSourceLine } from '../international/kit/util';
import { useNarrow } from '../international/kit/hooks';
import k from '../international/kit/kit.module.css';
import { CARB, FQ, classValue, levelsOf } from './amuModel';

type Pair = 'crkp' | 'crab' | 'fq';

const PAIRS: Record<Pair, { cls: string; pick: (r: ResistanceRecord) => boolean }> = {
  crkp: { cls: CARB, pick: (r) => r.phenotype === 'CRKP' },
  crab: { cls: CARB, pick: (r) => r.phenotype === 'CRAB' },
  // E. coli × ciprofloxacin antibiogram (non-susceptible = 100 − %S), all specimens
  fq: { cls: FQ, pick: (r) => !r.phenotype && r.pathogen === 'ECO' && r.antibiotic === 'CIP' },
};

interface Pt {
  level: Level;
  year: number;
  x: number;
  y: number;
  precision?: string;
}

/** Exploratory ecological scatter: class DID (x) vs resistance % (y), per level, with year trails. */
export function AmuScatter({ years, link }: { years?: YearRange; link?: string }) {
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const [pair, setPair] = useState<Pair>('crkp');
  const amu = useDataset('antibiotic_use');
  const res = useDataset('resistance');
  const status =
    amu.status === 'ready' && res.status === 'ready'
      ? 'ready'
      : amu.status === 'error' || res.status === 'error'
        ? 'error'
        : 'loading';

  const model = useMemo(() => {
    if (!amu.data || !res.data) return null;
    const cfg = PAIRS[pair];
    const levels = levelsOf(amu.data);
    const rrows = res.data.records.filter(
      (r) =>
        cfg.pick(r) &&
        r.ward === 'all' &&
        (r.setting ?? 'all') === 'all' &&
        r.specimen === 'all' &&
        inYearRange(r.year, years),
    );
    const best = dedupeRecords(rrows, (r) => `${r.level}|${r.year}`);
    const pts: Pt[] = [];
    for (const r of best) {
      if (!levels.includes(r.level)) continue;
      const x = classValue(amu.data.records, r.level, cfg.cls, r.year);
      if (x === undefined) continue;
      pts.push({ level: r.level, year: r.year, x, y: r.resistant_pct, precision: r.precision });
    }
    pts.sort((a, b) => a.year - b.year);
    return { pts, levels };
  }, [amu.data, res.data, pair, years]);

  const height = narrow ? 340 : 380;
  const option = useMemo<EChartsOption>(() => {
    if (!model) return {};
    const tok = ct.tokens;
    const color = colorMap([...LEVEL_ORDER], ct.theme);
    const xs = model.pts.map((p) => p.x);
    const ys = model.pts.map((p) => p.y);
    const pad = (a: number, b: number) => Math.max(1, (b - a) * 0.12);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    const xr = x1 - x0;
    const xStep = xr > 60 ? 20 : xr > 25 ? 10 : 5;
    return {
      grid: { left: 8, right: 28, top: 64, bottom: 30, containLabel: true },
      legend: { top: 0, left: 0, data: model.levels.map((l) => t(`levels.${l}`)) },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const d = (p as { data: { pt: Pt } }).data?.pt;
          if (!d) return '';
          return (
            tipTitle(`${t(`levels.${d.level}`)} · ${d.year}`) +
            tipRow(
              color(d.level),
              t(`amu.scatter.x.${pair}`),
              `${fmtNumber(d.x, t.locale, { digits: 1 })} DID`,
            ) +
            tipRow(color(d.level), t(`amu.scatter.y.${pair}`), fmtPct(d.y, t.locale), true)
          );
        },
      },
      xAxis: {
        type: 'value',
        name: t(`amu.scatter.x.${pair}`),
        nameLocation: 'middle',
        nameGap: 28,
        min: Math.floor((x0 - pad(x0, x1)) / xStep) * xStep,
        max: Math.ceil((x1 + pad(x0, x1)) / xStep) * xStep,
        interval: xStep,
        splitLine: { show: true },
      },
      yAxis: {
        type: 'value',
        name: t(`amu.scatter.y.${pair}`),
        nameTextStyle: { align: 'left' },
        nameGap: 14,
        min: Math.max(0, Math.floor((y0 - pad(y0, y1)) / 5) * 5),
        max: Math.min(100, Math.ceil((y1 + pad(y0, y1)) / 5) * 5),
        axisLabel: { formatter: '{value}%' },
      },
      series: model.levels.map((l) => {
        const c = color(l);
        const pts = model.pts.filter((p) => p.level === l);
        return {
          type: 'line',
          name: t(`levels.${l}`),
          data: pts.map((p, i) => ({
            value: [p.x, p.y],
            pt: p,
            symbolSize: i === pts.length - 1 ? 11 : 7,
            label:
              i === 0 || i === pts.length - 1
                ? {
                    show: true,
                    formatter: String(p.year),
                    position: i === 0 ? 'left' : 'right',
                    color: tok.ink3,
                    fontSize: 10.5,
                  }
                : undefined,
          })),
          showSymbol: true,
          symbol: 'circle',
          lineStyle: { color: c, width: 1.5, opacity: 0.55 },
          itemStyle: { color: c, borderColor: tok.surface, borderWidth: 2 },
          emphasis: { focus: 'series', lineStyle: { width: 2.5, opacity: 1 } },
          labelLayout: { hideOverlap: true },
        };
      }),
    } as EChartsOption;
  }, [model, ct, t, pair]);

  const title = t('amu.scatter.title');
  return (
    <ChartCard
      id="amu-scatter"
      title={title}
      subtitle={t('amu.scatter.subtitle')}
      source={joinSources(sourceLine(res.data, t.locale), envSourceLine(amu.data, t.locale))}
      dataset="antibiotic_use"
      precision={(model?.pts ?? []).map((p) => ({ precision: p.precision as ResistanceRecord['precision'] }))}
      badges={<Badge tone="info">{t('amu.scatter.exploratory')}</Badge>}
      status={status === 'ready' && model && !model.pts.length ? 'empty' : status}
      chartRef={ref}
      tableRows={(model?.pts ?? []).map((p) => ({
        [t('common.level')]: t(`levels.${p.level}`),
        [t('common.year')]: p.year,
        [t(`amu.scatter.x.${pair}`)]: p.x,
        [t(`amu.scatter.y.${pair}`)]: p.y,
      }))}
      fileName={`twamr-amu-vs-resistance-${pair}`}
      link={link}
      height={height}
      actions={
        <div className={k.scrollX}>
          <SegmentedControl<Pair>
            size="sm"
            label={t('amu.scatter.pairLabel')}
            value={pair}
            onChange={setPair}
            options={(['crkp', 'crab', 'fq'] as Pair[]).map((p) => ({
              value: p,
              label: t(`amu.scatter.pairs.${p}`),
            }))}
          />
        </div>
      }
    >
      <EChart
        ref={ref}
        option={option}
        height={height}
        ariaLabel={`${title}. ${t('amu.scatter.subtitle')}`}
      />
      <div className={k.chartNote}>
        <span>{t('amu.scatter.caveat')}</span>
      </div>
    </ChartCard>
  );
}
