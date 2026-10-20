import { FONT_STACK, TOKENS, type ThemeName } from '../../styles/tokens';
import { drawLogoMark, roundRect } from '../brand/LogoMark';
import { loadImage, wrapText } from '../chart/exportImage';

export type CardFormat = 'square' | 'story';
export const CARD_SIZE: Record<CardFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

export interface ShareCardContent {
  siteName: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  keyValue?: string;
  keyLabel?: string;
  /** chart image (data URL) */
  chart?: string;
  source?: string;
  /** plain URL text (no QR code) */
  url: string;
  readMore?: string;
  chip?: string;
  theme: ThemeName;
}

/** Draw a branded Instagram card (1080×1080 or 1080×1920) onto `canvas`. */
export async function drawShareCard(canvas: HTMLCanvasElement, c: ShareCardContent, format: CardFormat): Promise<void> {
  await document.fonts?.ready;
  const { w: W, h: H } = CARD_SIZE[format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const k = TOKENS[c.theme];
  const dark = c.theme === 'dark';
  const story = format === 'story';
  const P = 80;

  // background
  ctx.fillStyle = dark ? '#070b0a' : '#f7f8f7';
  ctx.fillRect(0, 0, W, H);
  const g1 = ctx.createRadialGradient(W * 0.12, -H * 0.05, 0, W * 0.12, -H * 0.05, W * 1.1);
  g1.addColorStop(0, dark ? 'rgba(0,227,140,0.22)' : 'rgba(14,124,91,0.14)');
  g1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W, H * 0.15, 0, W, H * 0.15, W * 0.8);
  g2.addColorStop(0, dark ? 'rgba(73,199,255,0.12)' : 'rgba(31,111,235,0.08)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
  if (dark) {
    ctx.strokeStyle = 'rgba(0,227,140,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H * 0.45);
      ctx.stroke();
    }
    for (let y = 0; y < H * 0.45; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }
  }

  ctx.textBaseline = 'top';
  let y = story ? 140 : P;

  // brand row
  drawLogoMark(ctx, P, y - 4, 52, k.ink, k.accent);
  ctx.fillStyle = k.ink;
  ctx.font = `700 30px ${FONT_STACK}`;
  ctx.fillText(c.siteName, P + 68, y + 8);
  if (c.chip) {
    ctx.font = `650 22px ${FONT_STACK}`;
    const tw = ctx.measureText(c.chip).width + 32;
    ctx.fillStyle = dark ? 'rgba(242,193,78,0.16)' : 'rgba(242,169,59,0.2)';
    roundRect(ctx, W - P - tw, y + 2, tw, 40, 20);
    ctx.fill();
    ctx.fillStyle = k.warn;
    ctx.fillText(c.chip, W - P - tw + 16, y + 11);
  }
  y += story ? 120 : 92;

  // eyebrow
  if (c.eyebrow) {
    ctx.fillStyle = k.accent;
    ctx.font = `700 24px ${FONT_STACK}`;
    ctx.fillText(c.eyebrow.toUpperCase(), P, y);
    y += 44;
  }

  // title
  ctx.fillStyle = k.ink;
  const titleSize = story ? 68 : 56;
  ctx.font = `700 ${titleSize}px ${FONT_STACK}`;
  const tl = wrapText(ctx, c.title, W - P * 2, 3);
  tl.forEach((ln, i) => ctx.fillText(ln, P, y + i * titleSize * 1.18));
  y += tl.length * titleSize * 1.18 + 16;
  if (c.subtitle) {
    ctx.fillStyle = k.ink3;
    ctx.font = `450 28px ${FONT_STACK}`;
    const sl = wrapText(ctx, c.subtitle, W - P * 2, 2);
    sl.forEach((ln, i) => ctx.fillText(ln, P, y + i * 38));
    y += sl.length * 38 + 12;
  }

  // key number
  if (c.keyValue) {
    y += story ? 60 : 28;
    const numSize = story ? 220 : 150;
    ctx.font = `750 ${numSize}px ${FONT_STACK}`;
    ctx.fillStyle = dark ? '#00e38c' : k.accent;
    if (dark) {
      ctx.shadowColor = 'rgba(0,227,140,0.45)';
      ctx.shadowBlur = 40;
    }
    ctx.fillText(c.keyValue, P - 6, y);
    ctx.shadowBlur = 0;
    y += numSize * 1.02;
    if (c.keyLabel) {
      ctx.fillStyle = k.ink2;
      ctx.font = `550 30px ${FONT_STACK}`;
      const kl = wrapText(ctx, c.keyLabel, W - P * 2, 2);
      kl.forEach((ln, i) => ctx.fillText(ln, P, y + i * 40));
      y += kl.length * 40;
    }
  }

  // footer metrics
  const footerH = story ? 260 : 150;
  const chartTop = y + (story ? 70 : 36);
  const chartBottom = H - footerH;

  // chart panel
  if (c.chart && chartBottom - chartTop > 160) {
    const img = await loadImage(c.chart);
    const pw = W - P * 2;
    const ph = chartBottom - chartTop;
    ctx.save();
    ctx.fillStyle = dark ? 'rgba(14,21,18,0.92)' : '#ffffff';
    ctx.shadowColor = dark ? 'rgba(0,227,140,0.18)' : 'rgba(15,26,22,0.12)';
    ctx.shadowBlur = 40;
    roundRect(ctx, P, chartTop, pw, ph, 28);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = dark ? 'rgba(0,227,140,0.18)' : 'rgba(15,26,22,0.08)';
    ctx.lineWidth = 2;
    roundRect(ctx, P, chartTop, pw, ph, 28);
    ctx.stroke();
    const inner = 28;
    const scale = Math.min((pw - inner * 2) / img.width, (ph - inner * 2) / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    ctx.save();
    roundRect(ctx, P + 2, chartTop + 2, pw - 4, ph - 4, 26);
    ctx.clip();
    ctx.drawImage(img, P + (pw - iw) / 2, chartTop + (ph - ih) / 2, iw, ih);
    ctx.restore();
  }

  // footer
  let fy = H - footerH + (story ? 70 : 36);
  if (c.source) {
    ctx.fillStyle = k.ink3;
    ctx.font = `450 22px ${FONT_STACK}`;
    const sl = wrapText(ctx, c.source, W - P * 2, 2);
    sl.forEach((ln, i) => ctx.fillText(ln, P, fy + i * 30));
    fy += sl.length * 30 + 14;
  }
  ctx.fillStyle = k.ink;
  ctx.font = `600 24px ${FONT_STACK}`;
  const urlText = c.url.replace(/^https?:\/\//, '');
  const label = c.readMore ? `${c.readMore} ` : '';
  ctx.fillStyle = k.ink2;
  ctx.fillText(label, P, fy);
  const lw = ctx.measureText(label).width;
  ctx.fillStyle = dark ? '#00e38c' : k.accent;
  const ul = wrapText(ctx, urlText, W - P * 2 - lw, 1);
  ctx.fillText(ul[0] ?? '', P + lw, fy);
}
