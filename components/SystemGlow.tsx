/**
 * Rank-scaled ambient glow wrapper. E-rank has no glow; glow radius and
 * opacity scale up through S-rank. Pure CSS (radial-gradient), no canvas —
 * distinct from ParticleBurst (Phase 4), which is the celebratory one-shot
 * effect.
 */

import type { RankId } from '@/lib/rank';

interface SystemGlowProps {
  rank: RankId;
  children: React.ReactNode;
}

const GLOW_INTENSITY: Record<RankId, { opacity: number; blur: number }> = {
  E: { opacity: 0,    blur: 0 },
  D: { opacity: 0.12, blur: 24 },
  C: { opacity: 0.18, blur: 32 },
  B: { opacity: 0.26, blur: 40 },
  A: { opacity: 0.34, blur: 52 },
  S: { opacity: 0.45, blur: 64 },
};

export default function SystemGlow({ rank, children }: SystemGlowProps) {
  const { opacity, blur } = GLOW_INTENSITY[rank];

  return (
    <div className="relative">
      {opacity > 0 && (
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle at 50% 50%, var(--sys-primary-glow) 0%, transparent 70%)`,
            opacity,
            filter: `blur(${blur}px)`,
          }}
        />
      )}
      {children}
    </div>
  );
}
