# Deployment runbook — multi-user with accounts + cloud sync

This turns diet-tracker from local-only (guest mode) into a **deployed app that
users open from their phones, register, and have their data persisted** to a
shared backend.

The app code already supports this — Supabase auth, per-user Row-Level Security,
and a dual-write data layer that migrates a guest's local data into their
account on first login. You only need to (1) create a Supabase project, (2) set
keys, (3) deploy. **Auth method: email magic link** (passwordless; no Google
setup required).

Free tiers are sufficient to start (Supabase free + Vercel Hobby).

> You do the account/console steps below; I (Claude) handle code/config and can
> verify locally once you paste the keys into `.env.local`.

---

## Part A — Supabase (database + auth)

### A1. Create the project
1. Go to <https://supabase.com> → sign in → **New project**.
2. Name it `diet-tracker`, set a strong **database password** (save it), pick a
   **region close to your users** (e.g. *Northeast Asia (Tokyo)* for Japan).
3. Wait ~2 min for provisioning.

### A2. Create the schema (one paste)
1. Left sidebar → **SQL Editor** → **New query**.
2. Open `supabase/setup.sql` from this repo, copy its entire contents, paste,
   and click **Run**. (This is migrations `001`–`005` combined: 11 tables, RLS
   on every table, and the `meal-photos` storage bucket.)
3. Verify: **Table Editor** should now list `profiles`, `food_logs`,
   `workout_logs`, `weight_logs`, `water_logs`, `badges`, `personal_records`,
   `weekly_reports`, `checkins`, `training_programs`, `recommendation_feedback`.

### A3. Configure auth (magic link)
1. **Authentication → Providers → Email**: ensure it is **enabled** (default).
   Magic link works out of the box with Supabase's built-in email.
2. **Authentication → URL Configuration**:
   - **Site URL**: for now `http://localhost:3000` (update to your Vercel URL in C4).
   - **Redirect URLs** (allow-list) — add:
     - `http://localhost:3000/auth/callback`
     - *(after deploy)* `https://<your-app>.vercel.app/auth/callback`
     - *(optional, Vercel preview builds)* `https://*-<your-team>.vercel.app/auth/callback`
   The app sends users to `${origin}/auth/callback`, and Supabase only honors
   redirect targets on this allow-list — so prod logins break until the prod URL
   is added here.

   > **Email rate limits:** Supabase's built-in email is capped (~a few per
   > hour) — fine for testing. For real usage, add custom SMTP under
   > **Authentication → Emails → SMTP Settings** (e.g. Resend/SendGrid).

### A4. Copy the keys
**Project Settings → API**:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
  ⚠️ Server-only secret. Never prefix it `NEXT_PUBLIC_`; never expose it client-side.

---

## Part B — Test locally first

1. Create `.env.local` in the repo root (gitignored — never commit it):
   ```bash
   cp .env.local.example .env.local   # if the example exists; otherwise create it
   ```
   Fill in:
   ```
   GEMINI_API_KEY=<your existing Gemini key>
   NEXT_PUBLIC_SUPABASE_URL=<A4 Project URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<A4 anon key>
   SUPABASE_SERVICE_ROLE_KEY=<A4 service_role key>
   ```
2. `npm run dev` → open <http://localhost:3000>.
3. Log in: go to **/login** → enter your email → click the magic link in your
   inbox → you land back signed in. Any data you logged as a guest migrates into
   your account automatically (`lib/migrate.ts`).
4. Verify persistence: add a meal, then in Supabase **Table Editor → food_logs**
   confirm the row exists with your `user_id`.

---

## Part C — Deploy to Vercel (so phones can reach it)

> **Heads-up:** this repo's `.vercel/repo.json` shows it was previously linked to
> a Vercel project named **`diet-tracker`** (`prj_HkDoy97pzQsZp5vQIlQjUbt9LeSV`).
> Check your Vercel dashboard — if that project exists, **reuse it** (skip C1).

### C1. Create / import the project
1. <https://vercel.com> → **Add New… → Project** → import the GitHub repo
   `michaeltakao/diet-tracker`.
2. Framework preset: **Next.js** (auto-detected). Build settings: defaults.

### C2. Set environment variables (Project → Settings → Environment Variables)
Add all four for **Production** (and **Preview** if you want preview deploys):
| Name | Value |
|---|---|
| `GEMINI_API_KEY` | your Gemini key |
| `NEXT_PUBLIC_SUPABASE_URL` | A4 Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | A4 anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | A4 service_role key |

*(Optional public-deployment AI cost controls — see `lib/api-guard.ts`:
`APP_ACCESS_CODE` and/or `ALLOW_ANONYMOUS`. In production the AI routes fail
closed for anonymous callers unless one is set.)*

### C3. Deploy
Trigger a deploy (push to the branch, or **Deployments → Redeploy**). Note the
production URL, e.g. `https://diet-tracker-xxxx.vercel.app`.

### C4. Point Supabase at the production URL
Back in **Supabase → Authentication → URL Configuration**:
- Set **Site URL** to your Vercel production URL.
- Add `https://<your-app>.vercel.app/auth/callback` to **Redirect URLs**.

(Without this, magic-link logins on the deployed site will fail to redirect.)

---

## Part D — Verify on phones
1. Open the Vercel URL on your phone.
2. **/login** → enter email → tap the magic link → signed in.
3. Add a meal / weight. Open the same account on a **second device or browser** →
   the data is there. ✔ Multi-user, per-account, persisted.

---

## How it works (for reference)
- **Isolation:** every table has RLS `auth.uid() = user_id`, so the shared
  database physically prevents one user from reading another's rows.
- **Offline-first:** writes hit localStorage immediately, then sync to Supabase
  when authenticated (`lib/data/_write.ts`); the app still works offline / as a
  guest.
- **Guest → account:** first login migrates existing local data once
  (`lib/migrate.ts`, idempotent).
- **Secrets:** only `NEXT_PUBLIC_*` values reach the browser; the service-role
  key is server-only.

## Production hardening checklist (later)
- [ ] Custom SMTP for auth emails (lift the built-in rate limit).
- [ ] `APP_ACCESS_CODE` or `ALLOW_ANONYMOUS` decision for the AI routes.
- [ ] Confirm Supabase free-tier limits fit expected usage (rows, storage, MAUs).
- [ ] Consider a custom domain in Vercel (and add its `/auth/callback` to Supabase).
