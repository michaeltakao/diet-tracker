'use client';

/**
 * Public landing page (app/page.tsx) — anonymous marketing entry point.
 *
 * Route split (2026-07-31): the dashboard that used to live at `/` moved to
 * `/dashboard`; this file is now the page a stranger actually lands on.
 * proxy.ts renders this for unauthenticated, non-guest visitors and redirects
 * everyone else (authenticated users, opted-in guests) straight to
 * `/dashboard` — see the `isRootPage` handling there.
 *
 * IMPORTANT: shipping this page does not make the app publicly usable.
 * Supabase env (SUPABASE_SERVICE_ROLE_KEY), the Google OAuth provider,
 * redirect URLs, and rate limiting/CAPTCHA are still `[🔒user]` gated —
 * see STATUS.md. This page is "ready the moment those switches are
 * flipped," not "public today."
 *
 * 'use client' (not a server component) because copy goes through
 * useLanguage(), which is a localStorage-backed client context — the same
 * reason /login and /onboarding are all client components.
 */

import Link from 'next/link';
import { Dumbbell, Trophy, Utensils, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/contexts/LanguageContext';

const FEATURE_ICONS = [Dumbbell, Trophy, Utensils, Sparkles] as const;

export default function LandingPage() {
  const { t } = useLanguage();

  const features = [
    { title: t.landingFeatureWorkoutTitle, body: t.landingFeatureWorkoutBody },
    { title: t.landingFeatureRankTitle, body: t.landingFeatureRankBody },
    { title: t.landingFeatureNutritionTitle, body: t.landingFeatureNutritionBody },
    { title: t.landingFeatureCoachingTitle, body: t.landingFeatureCoachingBody },
  ];

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto px-4 lg:px-6 pb-16 bg-[var(--background)] min-h-screen">

      {/* ── Hero ─────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center pt-16 pb-10">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-elevated mb-5">
          <Dumbbell className="w-8 h-8 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-black text-fg tracking-tight leading-tight mb-3">
          {t.landingHeroHeadline}
        </h1>
        <p className="text-sm text-muted max-w-sm mb-8">
          {t.landingHeroSubhead}
        </p>
        <Button href="/login" size="lg" className="w-full max-w-xs mb-3">
          {t.landingHeroCta}
        </Button>
        <GuestLink label={t.landingGuestCta} />
      </div>

      {/* ── Feature highlights ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
        {features.map(({ title, body }, i) => {
          const Icon = FEATURE_ICONS[i];
          return (
            <Card key={title} className="p-4">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-3">
                <Icon className="w-4.5 h-4.5 text-brand-strong" aria-hidden="true" />
              </div>
              <h2 className="text-sm font-bold text-fg mb-1">{title}</h2>
              <p className="text-xs text-faint leading-relaxed">{body}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Secondary CTA — same guest-cookie pattern as /login's "Continue without an
 * account" link (app/login/page.tsx). Split into its own component only to
 * keep the click handler colocated with the link it belongs to; the whole
 * page is already a client component so this doesn't change the render mode.
 */
function GuestLink({ label }: { label: string }) {
  return (
    <Link
      href="/dashboard"
      prefetch={false}
      onClick={() => {
        // prefetch={false} so the RSC payload is never fetched (and cached
        // as a pre-cookie redirect) before the cookie exists.
        document.cookie = 'dt-guest=1; path=/; max-age=31536000; samesite=lax';
      }}
      className="text-sm text-faint hover:text-fg transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      {label}
    </Link>
  );
}
