import * as echarts from 'echarts';
import type { ECharts, EChartsOption, SetOptionOpts } from 'echarts';
import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react';
import { usePrefersReducedMotion } from '../ui/usePrefersReducedMotion';
import { useChartTheme } from './useChartTheme';
import s from './chart.module.css';

export interface EChartHandle {
  /** live ECharts instance (undefined before mount) — used for PNG export */
  getInstance(): ECharts | undefined;
  /** the chart container element */
  getElement(): HTMLDivElement | null;
}

export interface EChartProps {
  option: EChartsOption;
  /** accessible description of the chart (required) */
  ariaLabel: string;
  /** total height incl. axis labels (px or CSS length). Default 340. */
  height?: number | string;
  loading?: boolean;
  /** replace instead of merge on option change (default true — options are built whole) */
  notMerge?: boolean;
  lazyUpdate?: boolean;
  renderer?: 'canvas' | 'svg';
  /** ECharts event handlers, e.g. { click: (p) => … } */
  onEvents?: Record<string, (params: unknown) => void>;
  onReady?: (chart: ECharts) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * The one ECharts wrapper (§2). Theme-aware (re-inits on theme switch), resizes with
 * ResizeObserver, disables animation under prefers-reduced-motion, exposes getInstance().
 */
export const EChart = forwardRef<EChartHandle, EChartProps>(function EChart(
  { option, ariaLabel, height = 340, loading, notMerge = true, lazyUpdate, renderer = 'canvas', onEvents, onReady, className, style },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<ECharts>();
  const { name } = useChartTheme();
  const reduced = usePrefersReducedMotion();
  const optRef = useRef(option);
  optRef.current = option;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useImperativeHandle(ref, () => ({ getInstance: () => inst.current, getElement: () => el.current }), []);

  // (re)create on theme / renderer change
  useEffect(() => {
    if (!el.current) return;
    const chart = echarts.init(el.current, name, { renderer, locale: 'EN' });
    inst.current = chart;
    chart.setOption(withMotion(optRef.current, reduced), { notMerge: true });
    readyRef.current?.(chart);
    const ro = new ResizeObserver(() => {
      if (!chart.isDisposed()) chart.resize();
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      inst.current = undefined;
    };
  }, [name, renderer, reduced]);

  // option updates
  useEffect(() => {
    const chart = inst.current;
    if (!chart || chart.isDisposed()) return;
    const opts: SetOptionOpts = { notMerge, lazyUpdate };
    chart.setOption(withMotion(option, reduced), opts);
  }, [option, notMerge, lazyUpdate, reduced]);

  // events
  useEffect(() => {
    const chart = inst.current;
    if (!chart || chart.isDisposed() || !onEvents) return;
    const entries = Object.entries(onEvents);
    for (const [ev, fn] of entries) chart.on(ev, fn as (p: unknown) => void);
    return () => {
      // on theme change the init effect's cleanup has already disposed this instance
      if (chart.isDisposed()) return;
      for (const [ev, fn] of entries) chart.off(ev, fn as (p: unknown) => void);
    };
  }, [onEvents, name]);

  useEffect(() => {
    const chart = inst.current;
    if (!chart || chart.isDisposed()) return;
    if (loading) chart.showLoading('default', { text: '', color: 'var(--accent)', maskColor: 'rgba(0,0,0,0)', spinnerRadius: 12, lineWidth: 2 });
    else chart.hideLoading();
  }, [loading, name]);

  return (
    <div
      ref={el}
      role="img"
      aria-label={ariaLabel}
      className={[s.echart, className].filter(Boolean).join(' ')}
      style={{ height, ...style }}
      data-chart-root=""
      data-echarts-theme={name}
    />
  );
});

function withMotion(option: EChartsOption, reduced: boolean): EChartsOption {
  return reduced ? { ...option, animation: false } : option;
}
