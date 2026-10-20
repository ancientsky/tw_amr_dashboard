import * as echarts from 'echarts';
import { useTheme } from '../../app/providers/ThemeProvider';
import { FONT_STACK, TOKENS, type ThemeName } from '../../styles/tokens';
import { CATEGORICAL, RESISTANCE_STOPS } from './palette';

export const CHART_ANIMATION_MS = 900;

/** Build an ECharts theme object from design tokens. */
export function buildEChartsTheme(name: ThemeName): Record<string, unknown> {
  const k = TOKENS[name];
  const axis = {
    axisLine: { show: true, lineStyle: { color: k.axis, width: 1 } },
    axisTick: { show: false, lineStyle: { color: k.axis } },
    axisLabel: { color: k.label, fontSize: 11.5, fontFamily: FONT_STACK, hideOverlap: true },
    splitLine: { show: true, lineStyle: { color: k.grid, width: 1, type: 'solid' } },
    splitArea: { show: false },
    nameTextStyle: { color: k.label, fontSize: 11.5, fontFamily: FONT_STACK },
  };
  return {
    color: [...CATEGORICAL[name]],
    backgroundColor: 'transparent',
    textStyle: { fontFamily: FONT_STACK, color: k.ink2 },
    title: {
      textStyle: { color: k.ink, fontWeight: 650, fontSize: 15, fontFamily: FONT_STACK },
      subtextStyle: { color: k.ink3, fontSize: 12, fontFamily: FONT_STACK },
    },
    legend: {
      textStyle: { color: k.ink2, fontSize: 12, fontFamily: FONT_STACK },
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 4,
      itemGap: 16,
      pageTextStyle: { color: k.ink3 },
      pageIconColor: k.accent,
      pageIconInactiveColor: k.axis,
      inactiveColor: k.axis,
    },
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    categoryAxis: { ...axis, splitLine: { show: false }, axisTick: { show: false } },
    valueAxis: { ...axis, axisLine: { show: false } },
    timeAxis: axis,
    logAxis: axis,
    line: {
      symbol: 'circle',
      symbolSize: 8,
      showSymbol: false,
      smooth: false,
      lineStyle: { width: 2, cap: 'round', join: 'round' },
      itemStyle: { borderWidth: 2, borderColor: k.surface },
      emphasis: { focus: 'series', lineStyle: { width: 2.5 } },
    },
    bar: {
      barMaxWidth: 24,
      itemStyle: { borderRadius: [4, 4, 0, 0], borderColor: k.surface, borderWidth: 0 },
    },
    scatter: { symbolSize: 10, itemStyle: { borderColor: k.surface, borderWidth: 2 } },
    heatmap: { itemStyle: { borderColor: k.surface, borderWidth: 2, borderRadius: 4 } },
    tooltip: {
      backgroundColor: k.tooltipBg,
      borderColor: k.tooltipBorder,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: k.ink, fontSize: 12.5, fontFamily: FONT_STACK },
      extraCssText: `backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); border-radius: 10px; box-shadow: ${
        name === 'dark'
          ? '0 12px 32px -10px rgba(0,0,0,.7), 0 0 20px -6px rgba(0,227,140,.25)'
          : '0 10px 30px -10px rgba(15,26,22,.25)'
      };`,
      axisPointer: {
        type: 'line',
        lineStyle: { color: k.ink3, width: 1, type: 'solid' },
        crossStyle: { color: k.ink3 },
        label: { backgroundColor: k.surface2, color: k.ink },
        shadowStyle: { color: name === 'dark' ? 'rgba(0,227,140,0.06)' : 'rgba(14,124,91,0.06)' },
      },
    },
    visualMap: {
      inRange: { color: [...RESISTANCE_STOPS[name]] },
      textStyle: { color: k.ink3, fontFamily: FONT_STACK },
    },
    dataZoom: {
      borderColor: k.axis,
      fillerColor: name === 'dark' ? 'rgba(0,227,140,0.12)' : 'rgba(14,124,91,0.1)',
      handleStyle: { color: k.surface, borderColor: k.accent },
      textStyle: { color: k.ink3 },
      dataBackground: { lineStyle: { color: k.axis }, areaStyle: { color: k.grid } },
    },
    markLine: { lineStyle: { color: k.ink3 }, label: { color: k.ink2 } },
    geo: {
      itemStyle: { areaColor: k.surface2, borderColor: k.axis },
      emphasis: { itemStyle: { areaColor: k.grid }, label: { color: k.ink } },
    },
    map: {
      itemStyle: { areaColor: k.surface2, borderColor: k.axis, borderWidth: 0.5 },
      emphasis: { itemStyle: { areaColor: k.grid }, label: { color: k.ink } },
    },
    animationDuration: CHART_ANIMATION_MS,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 500,
    animationEasingUpdate: 'cubicOut',
  };
}

let registered = false;
export function registerChartThemes(): void {
  if (registered) return;
  echarts.registerTheme('twamr-light', buildEChartsTheme('light'));
  echarts.registerTheme('twamr-dark', buildEChartsTheme('dark'));
  registered = true;
}

export interface ChartTheme {
  /** 'twamr-light' | 'twamr-dark' — pass to echarts.init */
  name: 'twamr-light' | 'twamr-dark';
  theme: ThemeName;
  tokens: (typeof TOKENS)[ThemeName];
  palette: readonly string[];
}

/** Registers both ECharts themes (once) and returns the active one. */
export function useChartTheme(): ChartTheme {
  registerChartThemes();
  const { theme } = useTheme();
  return {
    name: theme === 'dark' ? 'twamr-dark' : 'twamr-light',
    theme,
    tokens: TOKENS[theme],
    palette: CATEGORICAL[theme],
  };
}
