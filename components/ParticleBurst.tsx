'use client';

import { useEffect, useRef } from 'react';

interface ParticleBurstProps {
  colors?: string[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
}

const DEFAULT_COLORS = ['#00bfff', '#7fd8ff', '#ff4fd8', '#ffd447', '#e8f6ff'];
const PARTICLE_COUNT = 60;
const LIFETIME_MS = 2000;

/**
 * Canvas + requestAnimationFrame particle burst (deliberately NOT the CSS
 * keyframe/DOM-node approach BadgeCelebration's confetti uses — the rAF loop
 * suits per-frame velocity/alpha mutation better than a fixed CSS animation
 * timeline, and this was the explicit implementation request).
 *
 * Canvas drawing is not a CSS `animation`/`transition`, so it does NOT
 * automatically inherit the global `prefers-reduced-motion` rule in
 * app/globals.css (that rule only neutralizes animation-duration/
 * transition-duration). Reduced-motion is checked explicitly here instead:
 * when set, the burst is skipped and a single static, non-animated ring is
 * drawn in its place.
 */
export default function ParticleBurst({ colors = DEFAULT_COLORS }: ParticleBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      // Static fallback: one non-animated ring, no burst, no rAF loop.
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 48, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
      };
    });

    let rafId: number;
    let cancelled = false;
    const start = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / LIFETIME_MS);

      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04; // slight gravity drift
        p.alpha = 1 - t;

        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- colors is read once at mount for the particle palette; changing it mid-burst is not a supported use case
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
