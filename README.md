# Diet Tracker

A mobile-first diet, workout, and vitals tracker built as a Master's research
vehicle for a safe, personalized recommender system (University of Aizu,
Software Engineering Lab). Logs Protein/Fat/Carbs + Calories, workouts,
weight, water, vitals, and symptoms, with AI-powered photo-based meal
analysis and an AI nutritionist/workout suggester.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript (strict)
- Tailwind CSS
- Supabase (Postgres + Auth + Storage) — Row Level Security on every
  user-scoped table (`auth.uid() = user_id`)
- Google Gemini — meal photo analysis, AI nutritionist, workout suggestions
- Recharts (donut chart, trends)
- Vitest (unit tests), ESLint

## Auth

Three paths, chosen on `/login`:

- **Google OAuth** — PKCE flow via Supabase Auth (`/auth/callback` exchanges
  the code and repairs the `profiles` row if the DB trigger missed it).
- **Magic link (email)** — passwordless; no password-based signup exists in
  this app.
- **Guest mode** — no signup, no server account. Data stays in
  `localStorage` on-device only. Default path for anyone who declines
  research participation or is under 18 (see Consent below).

## Research Consent

This app doubles as a research-participation vehicle. Adults (18+) who sign
in are shown `/consent` and must explicitly attest their age and agree
before any personal data is collected server-side (`app/api/consent/route.ts`
enforces this server-side, not just in the UI). Users under 18, or anyone who
declines, are steered to guest mode, where nothing leaves the device. See
`ADR-004` in the research vault for the full design rationale.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` (gitignored, never commit it) with:
   ```bash
   # Supabase (Project Settings → API)
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server-only; gates data
                                                    # export, self-delete,
                                                    # push-subscribe upsert

   # Gemini (photo analysis, AI nutritionist, workout suggestions)
   GEMINI_API_KEY=<gemini-api-key>

   # App-wide access gate for AI-backed routes
   APP_ACCESS_CODE=<shared-access-code>

   # Web Push (VAPID key pair — generate with `npx web-push generate-vapid-keys`)
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid-public-key>
   VAPID_PUBLIC_KEY=<vapid-public-key>
   VAPID_PRIVATE_KEY=<vapid-private-key>
   VAPID_SUBJECT=mailto:you@example.com

   # Vercel Cron auth for the scheduled push-send job
   CRON_SECRET=<random-secret>

   # Optional: allow unauthenticated/local access without Supabase auth
   # (dev convenience — do not enable in a public production deployment)
   ALLOW_ANONYMOUS=false
   ```

   You'll also need, in the Supabase dashboard (not env vars):
   - Auth → Providers → Google enabled with a valid Client ID/Secret
   - Auth → URL Configuration → Site URL / Redirect URLs set to your deployed
     origin (e.g. `https://your-app.vercel.app` and
     `https://your-app.vercel.app/auth/callback`)
   - The matching OAuth client in Google Cloud Console with the Supabase
     project's own callback URL
     (`https://<project-ref>.supabase.co/auth/v1/callback`) registered

3. Apply the SQL migrations in `supabase/migrations/` to your Supabase
   project (via the Supabase SQL editor or CLI).

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Commands

```bash
npm run dev      # development server
npm run build    # production build
npm run lint     # ESLint
npx vitest run   # unit tests
```

## Features

- **Today's Summary** — calorie progress bar, PFC donut chart, macro bars,
  meal list grouped by type
- **Weekly Log** — 7-day week view with date selector, per-day calorie
  overview, streaks and a weekly repair ticket for missed days
- **Add Meal** — Photo tab (Gemini vision analysis) or Manual tab for direct
  entry
- **Workout Log** — strength, cardio, flexibility, and other exercise
  logging, plus an AI workout suggester
- **Vitals & Symptoms** — logging for the research/health-tracking use case
- **Goals Settings** — configurable daily calorie and macro targets
- **Web Push** — daily reminders via a service worker + VAPID, sent by a
  Vercel Cron job
- **Research tools** — consent flow, CSV/JSON data export, self-delete
  (APPI-style right to erasure)
