/**
 * TW-AMR Watch logo mark: a petri-dish ring with a rising bar chart inside.
 * Uses currentColor for the ring and the accent token for the bars.
 */
export function LogoMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <circle cx="16" cy="16" r="13.25" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
      <circle cx="16" cy="16" r="9.6" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.35" />
      <rect x="9.4" y="16.5" width="3.2" height="6" rx="1.2" fill="var(--accent)" opacity="0.55" />
      <rect x="14.4" y="12.5" width="3.2" height="10" rx="1.2" fill="var(--accent)" opacity="0.8" />
      <rect x="19.4" y="8.5" width="3.2" height="14" rx="1.2" fill="var(--accent)" />
    </svg>
  );
}

/** Canvas version of the mark (for PNG exports / share cards). */
export function drawLogoMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, ring: string, accent: string) {
  const k = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = ring;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(16, 16, 13.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.strokeStyle = accent;
  ctx.beginPath();
  ctx.arc(16, 16, 9.6, 0, Math.PI * 2);
  ctx.stroke();
  const bars: [number, number, number, number][] = [
    [9.4, 16.5, 6, 0.55],
    [14.4, 12.5, 10, 0.8],
    [19.4, 8.5, 14, 1],
  ];
  ctx.fillStyle = accent;
  for (const [bx, by, h, a] of bars) {
    ctx.globalAlpha = a;
    roundRect(ctx, bx, by, 3.2, h, 1.2);
    ctx.fill();
  }
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
