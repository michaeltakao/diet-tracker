/**
 * Study build flag (vault ADR-008 P0-10 / P0-11).
 *
 * The 6-month study ships the same code as `main`, built with
 * NEXT_PUBLIC_STUDY_BUILD=1. Next.js inlines the value at `next build`, so a
 * deployed bundle can never change mode at runtime. next.config.ts refuses a
 * Vercel production build without it.
 *
 * What the flag changes:
 *  - no guest entry point ("Continue without an account" / 「アカウントなしで
 *    試す」): guest data stays in localStorage and never reaches Supabase, so
 *    a participant who tapped it would be counted as dropped. proxy.ts also
 *    ignores an existing dt-guest cookie (it reads the env var itself, see
 *    the note there).
 *  - log rows are stamped study_build = true (lib/build-stamp.ts).
 *
 * Unset (local dev, previews) = the normal app, guest mode included.
 */
export const STUDY_BUILD = process.env.NEXT_PUBLIC_STUDY_BUILD === '1';
