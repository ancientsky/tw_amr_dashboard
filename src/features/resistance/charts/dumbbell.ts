import type { EChartsOption } from 'echarts';
import type { ThemeTokens } from '../../../styles/tokens';
import { isEstimate, type Point } from '../lib';

export interface DumbbellRow {
  key: string;
  label: string;
  a: Point;
  b: Point;
  mid?: Point;
  /** text drawn in the right-hand column (e.g. "+18.0 pp") */
  note?: string;
  /** connector colour override */
  stroke?: string;
}

export interface DumbbellSpec {
  rows: DumbbellRow[];
  colorA: string;
  colorB: string;
  colorMid?: string;
  nameA: string;
  nameB: string;
  nameMid?: string;
  tokens: ThemeTokens;
  fmt: (v: number) => string;
  tooltip: (row: DumbbellRow) => string;
  /** axis max (default auto nice) */
  max?: number;
  /** draw an arrowhead at b */
  arrow?: boolean;
  compact?: boolean;
  /** right column width (px) for notes */
  noteWidth?: number;
  labelWidth?: number;
}

/**
 * Dumbbell / arrow chart: one row per category, two (or three) markers on a shared % axis
 * joined by a connector. Hollow markers = chart-read estimates. Values labelled at the
 * outer ends; an optional note column on the right carries the gap.
 */
export function dumbbellOption(spec: DumbbellSpec): EChartsOption {
  const { rows, tokens: k, fmt } = spec;
  const all = rows.flatMap((r) => [r.a.value, r.b.value, r.mid?.value ?? 0]);
  const max = spec.max ?? Math.min(100, Math.max(10, Math.ceil((Math.max(0, ...all) + 6) / 10) * 10));
  const noteW = spec.noteWidth ?? (rows.some((r) => r.note) ? 76 : 16);
  const dot = (p: Point, color: string, size: number) => ({
    value: [p.value, 0],
    symbolSize: size,
    itemStyle: isEstimate(p) ? { color: k.surface, borderColor: color, borderWidth: 2.25 } : { color, borderColor: k.surface, borderWidth: 2 },
  });
  const pts = (pick: (r: DumbbellRow) => Point | undefined, color: string, size: number, side: 'outer' | 'none') =>
    rows
      .map((r, i) => {
        const p = pick(r);
        if (!p) return null;
        const d = dot(p, color, size);
        const other = pick === spec_a ? r.b : r.a;
        const left = side === 'outer' && p.value <= other.value;
        return {
          ...d,
          value: [p.value, i],
          label:
            side === 'outer'
              ? { show: true, position: left ? 'left' : 'right', distance: 8, formatter: fmt(p.value), color: k.ink2, fontSize: spec.compact ? 11 : 12, fontWeight: 600 }
              : { show: false },
        };
      })
      .filter(Boolean);
  // identity function refs so pts() can tell which end it is drawing
  function spec_a(r: DumbbellRow) {
    return r.a;
  }
  function spec_b(r: DumbbellRow) {
    return r.b;
  }

  return {
    grid: { left: 4, right: noteW, top: 30, bottom: 4, containLabel: true },
    legend: {
      top: 0,
      left: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      data: [spec.nameA, ...(spec.nameMid ? [spec.nameMid] : []), spec.nameB],
    },
    tooltip: {
      trigger: 'item',
      formatter: (p: unknown) => {
        const i = ((p as { value: [number, number] }).value ?? [0, 0])[1];
        const r = rows[i];
        return r ? spec.tooltip(r) : '';
      },
    },
    xAxis: { type: 'value', min: 0, max, axisLabel: { formatter: '{value}%' }, splitNumber: 5 },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((r) => r.label),
      axisLine: { show: false },
      axisLabel: { color: k.ink2, fontWeight: 600, fontSize: spec.compact ? 11.5 : 12.5, width: spec.labelWidth ?? 150, overflow: 'truncate' },
      splitLine: { show: true, lineStyle: { color: k.grid } },
    },
    series: [
      {
        type: 'custom',
        name: 'connector',
        silent: true,
        z: 1,
        data: rows.map((r, i) => [r.a.value, r.b.value, i]),
        renderItem: (params: unknown, api: unknown) => {
          const a = api as { value: (d: number) => number; coord: (v: number[]) => number[] };
          const cs = (params as { coordSys: { x: number; y: number; width: number; height: number } }).coordSys;
          const i = a.value(2);
          const r = rows[i];
          const p0 = a.coord([a.value(0), i]);
          const p1 = a.coord([a.value(1), i]);
          const stroke = r?.stroke ?? k.ink3;
          const children: unknown[] = [
            { type: 'line', shape: { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1] }, style: { stroke, lineWidth: 3, opacity: 0.5, lineCap: 'round' } },
          ];
          if (spec.arrow && Math.abs(p1[0] - p0[0]) > 12) {
            const dir = p1[0] > p0[0] ? 1 : -1;
            const tip = p1[0] - dir * 8;
            children.push({
              type: 'polygon',
              shape: { points: [[tip, p1[1]], [tip - dir * 6, p1[1] - 4.5], [tip - dir * 6, p1[1] + 4.5]] },
              style: { fill: stroke, opacity: 0.85 },
            });
          }
          if (r?.note) {
            children.push({
              type: 'text',
              x: cs.x + cs.width + 10,
              y: p0[1],
              style: { text: r.note, fill: k.ink, font: `650 ${spec.compact ? 11.5 : 12.5}px Inter Variable, system-ui, sans-serif`, verticalAlign: 'middle', align: 'left' },
            });
          }
          return { type: 'group', children };
        },
      },
      ...(spec.nameMid
        ? [{ type: 'scatter' as const, name: spec.nameMid, z: 2, itemStyle: { color: spec.colorMid }, data: pts((r) => r.mid, spec.colorMid ?? k.ink3, 7, 'none') }]
        : []),
      { type: 'scatter', name: spec.nameA, z: 3, itemStyle: { color: spec.colorA }, data: pts(spec_a, spec.colorA, 12, 'outer') },
      { type: 'scatter', name: spec.nameB, z: 4, itemStyle: { color: spec.colorB }, data: pts(spec_b, spec.colorB, 12, 'outer') },
    ],
  } as EChartsOption;
}
