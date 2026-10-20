import { useEffect, useRef } from 'react';
import { resistanceRamp } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { usePrefersReducedMotion } from '../../components/ui/usePrefersReducedMotion';

interface Particle {
  r: number; // orbit radius (0–1 of dish)
  a: number; // angle
  w: number; // angular speed
  size: number;
  color: string;
  wobble: number;
  phase: number;
}

/**
 * Decorative "petri dish": concentric agar rings with colonies drifting in slow orbits,
 * coloured along the resistance ramp. Canvas, DPR-capped, pauses off-screen / hidden tab,
 * and renders a single static frame under prefers-reduced-motion.
 */
export function PetriCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme, tokens } = useChartTheme();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dark = theme === 'dark';
    const ramp = resistanceRamp(7, theme);
    // deterministic pseudo-random so the static frame is stable
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const particles: Particle[] = Array.from({ length: 64 }, () => {
      const r = Math.sqrt(rnd()) * 0.92;
      // more resistant colonies cluster near the rim (hospital-onset "pressure" metaphor)
      const ci = Math.min(ramp.length - 1, Math.floor((r * 0.7 + rnd() * 0.45) * ramp.length));
      return { r, a: rnd() * Math.PI * 2, w: (0.02 + rnd() * 0.05) * (rnd() > 0.5 ? 1 : -1), size: 1.4 + rnd() * 3.2, color: ramp[ci], wobble: 0.01 + rnd() * 0.02, phase: rnd() * Math.PI * 2 };
    });

    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const b = canvas.getBoundingClientRect();
      w = b.width;
      h = b.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);
      const narrow = w < 700;
      // phones: a smaller dish tucked into the top-right corner, away from the text
      const R = narrow ? w * 0.42 : Math.min(h * 0.62, w * 0.36);
      const cx = narrow ? w * 0.92 : w * 0.8;
      const cy = narrow ? R * 0.55 : h * 0.5;
      // agar wash
      const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.05);
      g.addColorStop(0, dark ? 'rgba(0,227,140,0.07)' : 'rgba(14,124,91,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2);
      ctx.fill();
      // rings (dish rim + inhibition-zone style rings)
      ctx.lineWidth = 1;
      for (let i = 1; i <= 6; i++) {
        const rr = (R * i) / 6;
        ctx.strokeStyle = dark ? `rgba(216,243,230,${i === 6 ? 0.16 : 0.05})` : `rgba(15,26,22,${i === 6 ? 0.12 : 0.045})`;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      // colonies
      const t = time / 1000;
      for (const p of particles) {
        const a = p.a + p.w * t;
        const rr = (p.r + Math.sin(t * p.wobble * 20 + p.phase) * 0.012) * R;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (dark) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
        }
        ctx.globalAlpha = (dark ? 0.85 : 0.7) * (narrow ? 0.55 : 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
      // tiny ink highlight on the rim
      ctx.strokeStyle = tokens.accent;
      ctx.globalAlpha = dark ? 0.35 : 0.25;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const s0 = (t * 0.05) % (Math.PI * 2);
      ctx.arc(cx, cy, R, s0, s0 + 0.9);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    let visible = true;
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (reduced) draw(0);
      else if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else cancelAnimationFrame(raf);
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0);
    });
    ro.observe(canvas);
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : start());
    document.addEventListener('visibilitychange', onVis);
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [theme, tokens.accent, reduced]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
