# Diet Tracker 🥗

A mobile-first diet & fitness tracker: log daily Protein/Fat/Carbs + Calories,
water, weight, and workouts, with AI-powered meal photo analysis and
personalized recommendations via Google Gemini. Works fully offline in guest
mode (localStorage); cloud sync and accounts are optional via Supabase.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Configure environment variables — copy and edit:
   ```bash
   cp .env.local.example .env.local
   ```
   With **no** configuration the app runs fully in guest mode; only the AI
   features and cloud sync are disabled. See [Environment variables](#environment-variables).

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

All optional. Place them in `.env.local` (gitignored — never commit it).

| Variable | Required for | Notes |
|---|---|---|
| `GEMINI_API_KEY` | AI features | Meal photo analysis, recommendations, coach, weekly/habit reports, workout suggestions. Get one at [Google AI Studio](https://aistudio.google.com/apikey). Without it the AI routes return a clean error; the rest of the app works. |
| `NEXT_PUBLIC_SUPABASE_URL` | Cloud sync / login | Safe to expose to the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cloud sync / login | Safe to expose to the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin / migration | **Server-only** — never prefix with `NEXT_PUBLIC` or expose client-side. |
| `APP_ACCESS_CODE` | Public deployment (AI cost control) | Shared code; anonymous callers must send a matching `x-access-code` header (the UI prompts once). See `lib/api-guard.ts`. |
| `ALLOW_ANONYMOUS` | Public deployment (AI cost control) | Set to `"true"` to allow open anonymous AI access. In production the AI routes otherwise fail closed for anonymous callers. Unused in development. |

## Features

- **Dashboard** — remaining-calorie hero, progress bar, PFC donut, macro bars,
  water tracker, streak, earned badges, and meals grouped by type
- **Add meal** — AI photo analysis (Gemini vision) or manual entry; recent foods
- **Daily log** — 7-day week view with date selector and per-day overview
- **Workouts** — strength / cardio / flexibility logging, 1RM, personal records
- **Training plans** — built-in templates (PPL, Upper/Lower, full-body) + daily check-in
- **Weight** — trend chart and goal tracking
- **Medications** — daily med check-in with food/nutrition interaction warnings
- **AI coaching** — personalized food/exercise recommendations (safety-filtered),
  weekly and habit reports
- **Settings** — health profile, calorie/macro goals, data export/import, units (kg/lbs), JA/EN
- **PWA** — installable, offline-capable

## Tech stack

- Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4
- Google Gemini (`@google/genai`, `gemini-2.5-flash`) for vision + recommendations
- Recharts (charts) · zod (API input validation)
- Supabase (optional accounts + cloud sync); localStorage-first persistence
- Vitest (unit tests)
