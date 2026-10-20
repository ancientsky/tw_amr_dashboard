/**
 * JS mirror of the colour tokens in tokens.css, for canvas/ECharts code that cannot
 * read CSS variables for the *other* theme. Keep in sync with tokens.css.
 */
export type ThemeName = 'light' | 'dark';

export interface ThemeTokens {
  paper: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  accent: string;
  accent2: string;
  danger: string;
  warn: string;
  grid: string;
  axis: string;
  label: string;
  tooltipBg: string;
  tooltipBorder: string;
}

export const TOKENS: Record<ThemeName, ThemeTokens> = {
  light: {
    paper: '#f7f8f7',
    surface: '#ffffff',
    surface2: '#f1f4f2',
    ink: '#0f1a16',
    ink2: '#3a4a43',
    ink3: '#5a6b64',
    line: 'rgba(15,26,22,0.09)',
    accent: '#0e7c5b',
    accent2: '#1f6feb',
    danger: '#c6373c',
    warn: '#9a6a00',
    grid: '#e6ebe8',
    axis: '#c5cec9',
    label: '#5a6b64',
    tooltipBg: 'rgba(255,255,255,0.9)',
    tooltipBorder: 'rgba(15,26,22,0.1)',
  },
  dark: {
    paper: '#070b0a',
    surface: '#0e1512',
    surface2: '#132019',
    ink: '#d8f3e6',
    ink2: '#a5c4b6',
    ink3: '#7d9a8d',
    line: 'rgba(216,243,230,0.08)',
    accent: '#00e38c',
    accent2: '#49c7ff',
    danger: '#ff5c5c',
    warn: '#f2c14e',
    grid: '#1b2a22',
    axis: '#2c4136',
    label: '#8eab9e',
    tooltipBg: 'rgba(10,18,14,0.82)',
    tooltipBorder: 'rgba(0,227,140,0.22)',
  },
};

export const FONT_STACK =
  "'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', 'Hiragino Sans', 'Noto Sans JP', sans-serif";
