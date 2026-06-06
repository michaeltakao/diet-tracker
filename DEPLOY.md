# Deploying Diet Tracker (Vercel)

This app is a Next.js 16 (App Router) PWA. It runs in **guest mode** by default —
all data lives in the browser's `localStorage`, no database required. The AI
features (food-photo analysis, recommendations, coach, habit/weekly reports) work
for anonymous users and are rate-limited by client IP. An optional shared
**access code** protects a public deployment from anonymous abuse of your paid
Gemini key.

> Want real login + multi-device cloud sync? See [Optional: Supabase](#optional-supabase-login--sync).

## Prerequisites

- The repo pushed to GitHub (done: branch `feature/safe-explainable-recommender`).
- A **Gemini API key** — https://aistudio.google.com/apikey
- A free **Vercel** account — https://vercel.com (sign in with GitHub).

## Environment variables

| Variable | Required? | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | **Yes** | All AI routes. Server-side only — do **not** prefix with `NEXT_PUBLIC_`. |
| `APP_ACCESS_CODE` | **One of these two** in production | Shared secret. When set, anonymous AI calls must send a matching `x-access-code` header (the app prompts once and stores it). Logged-in users bypass it. |
| `ALLOW_ANONYMOUS` | **One of these two** in production | Set to `true` for fully open guest access (rate-limited by IP only). Use only for throwaway/private URLs. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Optional | Enable login + cloud sync. Omit to stay in guest mode. |

> **Fail-closed default:** in production the AI routes reject anonymous callers
> (HTTP 503) unless `APP_ACCESS_CODE` or `ALLOW_ANONYMOUS=true` is set — so you
> can't accidentally ship an open, paid endpoint. Local `next dev` is unaffected.
> Prefer `APP_ACCESS_CODE` for any URL that might be shared.

## Option A — Vercel dashboard (recommended)

1. https://vercel.com/new → **Import** the `diet-tracker` GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Leave build/output defaults.
3. **Production branch**: set to `feature/safe-explainable-recommender` (or merge
   PR #5 into `main` first and deploy `main`).
4. **Environment Variables** → add:
   - `GEMINI_API_KEY` = your key
   - `APP_ACCESS_CODE` = a long random string (recommended) **or** `ALLOW_ANONYMOUS=true`
     (required in production — without one of them the AI routes return 503)
5. **Deploy**. You get an HTTPS URL like `https://diet-tracker-xxxx.vercel.app`.

## Option B — Vercel CLI

```bash
npm i -g vercel            # once
cd ~/diet-tracker
vercel login               # interactive — run via `! vercel login` in this session
vercel link                # link to a Vercel project
vercel env add GEMINI_API_KEY production       # paste the key when prompted
vercel env add APP_ACCESS_CODE production       # optional but recommended
vercel --prod              # build + deploy
```

## First run on your phone

1. Open the HTTPS URL in mobile Safari/Chrome.
2. If `APP_ACCESS_CODE` is set, the first AI action prompts for the code — enter it once.
3. **Install the PWA**: Share → "Add to Home Screen" (iOS) / install icon (Android).
   The app launches standalone, with its own icon and offline shell (service worker).

## Security notes

- **Guest + public = exposure of your Gemini quota.** Mitigations in place:
  per-IP rate limits (`lib/rate-limit.ts`, e.g. 10 photo analyses/min) and the
  optional `APP_ACCESS_CODE` gate. Set the access code for any shared/public URL.
- `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only — never exposed
  to the browser (no `NEXT_PUBLIC_` prefix).
- Never commit real secrets. `.env.local` is gitignored; `.env.local.example`
  documents the variables.

## Optional: Supabase (login + sync)

1. Create a free project at https://supabase.com.
2. In the SQL Editor, run, in order:
   `supabase/migrations/001_initial_schema.sql` → `002` → `003` → `004`.
3. Authentication → enable Email (magic link) and/or Google OAuth; add your
   Vercel URL to the allowed redirect URLs (`<url>/auth/callback`).
4. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` to Vercel env, then redeploy.
5. On first login the app migrates existing `localStorage` data into Supabase.

## Verify before deploying

```bash
npm run lint    # 0 problems
npm run test    # all pass
npm run build   # succeeds
```
