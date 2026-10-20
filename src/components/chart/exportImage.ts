import type { ECharts } from 'echarts';
import { toPng } from 'html-to-image';
import { FONT_STACK, TOKENS, type ThemeName } from '../../styles/tokens';
import { drawLogoMark } from '../brand/LogoMark';

export interface BrandedImageOptions {
  /** source image (data URL) — usually the chart */
  image: string;
  title: string;
  subtitle?: string;
  source?: string;
  theme: ThemeName;
  siteName: string;
  url: string;
  /** chip text rendered next to the title (e.g. "Provisional") */
  chip?: string;
}

export interface RenderedImage {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

/** ECharts → PNG data URL at 2× with the theme background baked in. */
export function chartDataUrl(chart: ECharts, theme: ThemeName, pixelRatio = 2): string {
  return chart.getDataURL({ type: 'png', pixelRatio, backgroundColor: TOKENS[theme].surface, excludeComponents: ['toolbox', 'dataZoom'] });
}

/** Any DOM node → PNG data URL (html-to-image). Elements with data-export="hide" are skipped. */
export async function nodeDataUrl(node: HTMLElement, theme: ThemeName, pixelRatio = 2): Promise<string> {
  await document.fonts?.ready;
  return toPng(node, {
    pixelRatio,
    backgroundColor: TOKENS[theme].surface,
    cacheBust: true,
    filter: (n) => !(n instanceof HTMLElement && n.dataset.export === 'hide'),
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

const CJK = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/;

/** Word-wrap that also breaks between CJK characters. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3): string[] {
  const tokens: string[] = [];
  let buf = '';
  for (const ch of text) {
    if (CJK.test(ch)) {
      if (buf) tokens.push(buf);
      tokens.push(ch);
      buf = '';
    } else if (ch === ' ') {
      tokens.push(buf + ' ');
      buf = '';
    } else buf += ch;
  }
  if (buf) tokens.push(buf);
  const lines: string[] = [];
  let line = '';
  for (const tk of tokens) {
    const test = line + tk;
    if (ctx.measureText(test.trimEnd()).width > maxWidth && line) {
      lines.push(line.trimEnd());
      line = tk.trimStart();
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line.trimEnd());
  if (lines.length === maxLines && tokens.join('').length > lines.join('').length + 2) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}

function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

/**
 * Composite the chart image onto a branded canvas:
 * title + subtitle header · chart · footer with source line, site watermark and URL.
 */
export async function composeBrandedPng(o: BrandedImageOptions): Promise<RenderedImage> {
  await document.fonts?.ready;
  const k = TOKENS[o.theme];
  const img = await loadImage(o.image);
  const S = 2; // output scale (chart image is already 2×)
  const pad = 32 * S;
  const W = Math.max(img.width + pad * 2, 720 * S);
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `650 ${22 * S}px ${FONT_STACK}`;
  const titleLines = wrapText(measure, o.title, W - pad * 2 - (o.chip ? 120 * S : 0), 2);
  measure.font = `400 ${14 * S}px ${FONT_STACK}`;
  const subLines = o.subtitle ? wrapText(measure, o.subtitle, W - pad * 2, 2) : [];
  const headerH = pad + titleLines.length * 30 * S + (subLines.length ? 8 * S + subLines.length * 20 * S : 0) + 20 * S;
  measure.font = `400 ${12 * S}px ${FONT_STACK}`;
  const srcLines = o.source ? wrapText(measure, o.source, W - pad * 2 - 260 * S, 2) : [];
  const footerH = 24 * S + Math.max(2, srcLines.length) * 18 * S + pad * 0.75;
  const H = headerH + img.height + footerH;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  // background
  ctx.fillStyle = k.surface;
  ctx.fillRect(0, 0, W, H);
  if (o.theme === 'dark') {
    const g = ctx.createRadialGradient(W * 0.1, 0, 0, W * 0.1, 0, W * 0.8);
    g.addColorStop(0, 'rgba(0,227,140,0.10)');
    g.addColorStop(1, 'rgba(0,227,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // accent hairline
  const hl = ctx.createLinearGradient(0, 0, W, 0);
  hl.addColorStop(0, k.accent);
  hl.addColorStop(0.6, 'rgba(0,0,0,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, W, 3 * S);

  // header
  let y = pad;
  ctx.textBaseline = 'top';
  ctx.fillStyle = k.ink;
  ctx.font = `650 ${22 * S}px ${FONT_STACK}`;
  titleLines.forEach((ln, i) => ctx.fillText(ln, pad, y + i * 30 * S));
  if (o.chip) {
    const tw = ctx.measureText(titleLines[0]).width;
    ctx.font = `600 ${11 * S}px ${FONT_STACK}`;
    const cw = ctx.measureText(o.chip).width + 18 * S;
    const cx = pad + tw + 12 * S;
    ctx.fillStyle = o.theme === 'dark' ? 'rgba(242,193,78,0.14)' : 'rgba(242,169,59,0.18)';
    ctx.beginPath();
    ctx.roundRect?.(cx, y + 3 * S, cw, 22 * S, 11 * S);
    ctx.fill();
    ctx.fillStyle = k.warn;
    ctx.fillText(o.chip, cx + 9 * S, y + 8 * S);
  }
  y += titleLines.length * 30 * S;
  if (subLines.length) {
    y += 8 * S;
    ctx.fillStyle = k.ink3;
    ctx.font = `400 ${14 * S}px ${FONT_STACK}`;
    subLines.forEach((ln, i) => ctx.fillText(ln, pad, y + i * 20 * S));
  }

  // chart
  ctx.drawImage(img, (W - img.width) / 2, headerH);

  // footer
  const fy = headerH + img.height + 16 * S;
  ctx.strokeStyle = k.line;
  ctx.lineWidth = 1 * S;
  ctx.beginPath();
  ctx.moveTo(pad, fy);
  ctx.lineTo(W - pad, fy);
  ctx.stroke();
  ctx.fillStyle = k.ink3;
  ctx.font = `400 ${12 * S}px ${FONT_STACK}`;
  srcLines.forEach((ln, i) => ctx.fillText(ln, pad, fy + 12 * S + i * 18 * S));
  // watermark (right)
  ctx.textAlign = 'right';
  ctx.fillStyle = k.ink;
  ctx.font = `650 ${13 * S}px ${FONT_STACK}`;
  ctx.fillText(o.siteName, W - pad, fy + 12 * S);
  ctx.fillStyle = k.ink3;
  ctx.font = `400 ${11 * S}px ${FONT_STACK}`;
  ctx.fillText(o.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W - pad, fy + 30 * S);
  ctx.textAlign = 'left';
  const nameW = (() => {
    ctx.font = `650 ${13 * S}px ${FONT_STACK}`;
    return ctx.measureText(o.siteName).width;
  })();
  drawLogoMark(ctx, W - pad - nameW - 26 * S, fy + 9 * S, 20 * S, k.ink, k.accent);

  const dataUrl = c.toDataURL('image/png');
  const blob = await canvasToBlob(c);
  return { dataUrl, blob, width: W, height: H };
}
