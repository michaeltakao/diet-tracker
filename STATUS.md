# STATUS — diet-tracker

Entries before 2026-09, the pre-trim Next list (incl. completed items) and
older verification records live in `docs/logs/STATUS-archive-2026-07.md`.
Keep this file under 200 lines: Now (latest 3) / Next / Blockers / Key
decisions / Last verified (latest 2) — move older entries to the archive.

## Now
- **2026-10-14 Six-month study prep (branch `feat/trial-data-notice`, local
  commits only, not pushed):** the trial data is now meant for research
  (vault `ADR-007`, supersedes `ADR-006`; status *proposed* until the advisor
  answers the three questions on slide 14).
  - In-app consent removed: `/consent`, `/api/consent`, the `proxy.ts`
    redirect and the `consent*` i18n keys. Consent is the signed paper form;
    `consented_at` is set by hand (`docs/trial/consent-roster.sql`).
  - Goals reach the server: `updateGoals` dual-writes `profiles.goal_*`;
    `goal_history` (migration `025`, **not applied to prod**) keeps the
    starting purpose and goal weight. 025 also freezes `consented_at` for
    user-scope writes.
  - `/api/research/export` now exports only users with `consented_at` set
    (it had no consent filter; the removed gate used to make that moot).
  - Gemini quota errors return 429 with a readable ja/en message in all 9 AI
    routes (was a generic 500).
  - Docs: `docs/SPEC.md` (current spec), `docs/trial/` consent form,
    participant guide, `cohort-queries.sql` rewritten to the fixed 6-month
    definitions (S0–S5b, W1–W5).
  - Slides for the advisor: `~/大学院/研究室/research-plan-2026-10/`
    (`index.html`, `slides.pdf`, 14 pages, screenshots are synthetic data).
- **2026-10-13 CI, security and housekeeping round — merged + deployed
  (`main` `448aa58`):** PRs #14–#19: vitest now gates CI; `next` 16.2.6 →
  16.3.8 (cleared 1 critical + 12 high audit findings); proxy matcher
  excludes `/icon` and `/apple-icon`; gitleaks PR scan replaces a no-op
  secret grep; stale PRs #3/#6/#7/#8 closed (branches kept). Full entry in
  the archive.

## Next
- **Six-month study, 10–30 family and acquaintances (plan 2026-10-14):**
  1. [🔒user] Show the slides to the advisor; settle ethics review, pilot vs
     plan revision, and the Gemini tier. **No URL goes out before that.**
  2. [🔒user] Gemini: the free tier's terms say not to submit personal or
     sensitive information and require users to be 18+
     (https://ai.google.dev/gemini-api/terms, read 10-14). Decide paid tier /
     strip conditions and medications from prompts / AI off, then update
     section 6 of the consent form to match.
  3. After approval to proceed: review + push + PR for this branch, apply
     migration `025` to prod (ask first), public-login items 1–4 + 6 below.
  4. [🔒user] Print the consent form, fill the contact lines, collect
     signatures, hand the guide only to signers, mark `consented_at`
     (`consent-roster.sql`), then disable new sign-ups in Supabase.
  5. Weekly: `cohort-queries.sql` W1–W5. Kill: <5 people with 3+ active days
     in the first 4 weeks (W1); <5 still active at month 3 (S1).
- **[🔒user] Public login — blocks every real user's sign-in** (do in one
  sitting; unblocks authed E2E, push and export checks at once):
  1. Vercel env (Production): add `SUPABASE_SERVICE_ROLE_KEY` (export,
     participant self-delete, push-subscribe upsert) and confirm
     `GEMINI_API_KEY` is current. `APP_ACCESS_CODE` already set.
  2. Supabase dashboard → Auth → URL Configuration: add
     `https://diet-tracker-two-blue.vercel.app` to Site URL / Redirect URLs.
  3. Supabase dashboard → Auth → Providers: Google is DISABLED
     (`external.google=false`) — enable it, or hide the login button.
  4. Google Cloud Console → Credentials → OAuth client: Authorized redirect
     URIs must include `https://<project-ref>.supabase.co/auth/v1/callback`.
  5. Supabase dashboard → Auth → Rate Limits / Attack Protection: review
     defaults, enable CAPTCHA (Turnstile/hCaptcha). No app-code limiter exists
     for `/login`, magic-link or OAuth initiation.
  6. Create a real account → authed E2E: goal save (`profiles.goal_*` +
     one `goal_history` row) → recommend → export →
     self-delete (the `auth.admin.deleteUser` leg is untested; cascade +
     fail-safe were SQL-verified 07-05).
  7. Set researcher role for your own account (`researcher_access_log` flow).
- **[🔒user] Web Push VAPID keys** — `npx web-push generate-vapid-keys`, then
  add to `.env.local` AND Vercel (Production + Preview):
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PUBLIC_KEY` (same value),
  `VAPID_PRIVATE_KEY` (server-only), `VAPID_SUBJECT=mailto:<contact email>`.
  Code fail-closes without them (503 / UI hidden). Then E2E: enable on
  dashboard card → row in `push_subscriptions` → evening nudge → OS
  notification → click focuses dashboard → same-day repeat is deduped →
  settings disable → row gone.
- **[🔒user] local `.env.local` has placeholder `NEXT_PUBLIC_SUPABASE_*` and no
  usable `SUPABASE_SERVICE_ROLE_KEY`** — local dev is guest-mode-only and
  `proxy.ts` bypasses the auth guard entirely until filled.
- **[🔒user] SUS Japanese translation is unvalidated** — `SusSurveyCard`'s 10
  items are a working translation, not back-translated; scores are not
  comparable to published SUS norms. Needs advisor/expert review before any
  score is reported as SUS in the thesis.
- **[🔒user] Gemini CLI ineligible** (IneligibleTierError, noted 07-05) —
  re-check; council loses its preferred cross-vendor reviewer otherwise.
- **[🔒user] PR #2** (STEP 7 localStorage → Supabase migration utility,
  last updated 06-11) is the only open PR — close or keep. Branches of the
  closed #6/#7/#8 are kept (see Now); delete once their work is confirmed
  superseded.
- **[auto] Supabase → local hydration** — no read-back path exists, so a
  second device sees an empty app (biggest sign-in value gap). Food / workout /
  weight first, vitals / symptoms second. Architecture change: ADR +
  `reviewer` pass before implementing; reuse the merge rules in
  `lib/export.ts`, do not invent new ones.
- **[auto] Observability** — one Playwright guest-mode E2E in CI; telemetry
  Supabase dual-write (needs its own migration + consent gating); error
  monitoring (dependency → `/sec`). Hold new features until usage is measurable.
- **[auto] Web Push server cron** — Vercel Cron + `CRON_SECRET` route so
  nudges fire without the app being open; the client-triggered send mostly
  mirrors in-app banners.
- **[auto] JP food text search** — MEXT 成分表, top ~500 washoku + `pg_trgm`;
  also grounds photo-AI v2 numbers.
- **[auto] Dev-only `npm audit` highs**: 5 remain on `braces`
  (GHSA-vfj7-8cjw-p6xm) via `eslint-config-next`; no patched release yet.
  When one ships, update and restore the full-tree audit gate.
- **[auto] Health-log follow-ups**: symptom↔meal correlation analysis; CSV
  import for old symptom-memo-app data.
- **[auto] Small fixes**: MealCard edit coerces empty fields to 0; favorites
  quick-add ignores the servings stepper; STEP-7 bulk-migration rows leave
  `servings`/`source` NULL (backfill or accept).
- Backlog: recipes, full micronutrient UI, weight-page SVG → recharts,
  AccountSection full i18n retrofit.
- P1 research features: adherence prediction, habit phenotyping,
  TDEE-triggered goal adaptation.

## Blockers
- Authed E2E blocked on the [🔒user] public-login items 1–4 above.

## Key decisions
- Guest mode in production = explicit per-device opt-in via `dt-guest=1` cookie
  (set client-side by the login page; honored by proxy.ts auth guard). AI routes
  still gated by `APP_ACCESS_CODE` in `lib/api-guard.ts` (2026-07-05).
- Phase A safety layer wired into `/api/recommend` (`lib/recommend-safety.ts`, 19 tests)
  — commit `84ba7dd`, 2026-06-03.
- Semantic token design system + WCAG-AA (use tokens, not `gray-*`); AI features use the
  `--ai` violet family (2026-07-03).
- `FoodEntry` kcal/P/F/C are always FINAL consumed values; portion metadata is separate
  columns — TDEE/reports/streaks unaffected (migration 009 design).
- Favorites double as the Phase B `W_FAVORITE` signal: `deriveMacroHighlight` emits
  `・`-joined tokens in the exact `foodFeatures()` vocabulary (unit-tested overlap).
- Telemetry lives on its own localStorage key, never in AppData; server-side collection
  deferred until it has its own migration + consent gating.
- **Never call `supabase.*` inside an `onAuthStateChange` callback** — auth-js holds
  its navigator.locks mutex while awaiting the callback; defer via `setTimeout`
  (`28d3d44`, 2026-07-05). Symptom of violation: dual-writes silently stop.
- Repo is the Master's research vehicle — see vault `ADR-001`.
- `postcss` overridden to `^8.5.10` (CVE-2026-41305, MEDIUM).
- CI workflows hardened against script injection (`cac19bf`, 2026-06-12) — see vault `ADR-003`.
- **Duolingo redesign phase 7 (hero-card gradient) resolved as: stay flat, no
  code change** (2026-07-21). `StreakHeader.tsx`'s fox banner already uses a
  flat `bg-fox` fill + hard-edge `shadow-[0_4px_0_var(--fox-dark)]`, matching
  phase 4's flat-fill principle (`Button.tsx`/`ProgressBar.tsx`) — this is
  intentional, not an oversight, and should not be "fixed" into a gradient by
  a future session. The ad-hoc `bg-gradient-to-br`/`bg-gradient-to-r` usages
  elsewhere (e.g. `app/workout/page.tsx:361` hero header, several buttons/
  pills) predate phase 4 and are explicitly NOT retrofit targets for this
  round — they're pre-existing style debt, not part of the phase 6/7 scope.
- **Deploy scope = 家族・知人限定** (user-confirmed 2026-08-09), superseding the
  07-24 "general public" framing; the research-disclosure footer stays off
  `app/page.tsx` for that reason. Re-decide before any wider opening.
- `/api/suggest-workout` + `WorkoutSuggestionCard` are caller-less since
  2026-09-18 but retained on purpose — adjusting an already-scheduled session
  is a separate job from generation.
- **No age gate in code** (18+ attestation removed 2026-07-22, `5f20d39`).
  Under-18 participation is handled on the paper form (guardian signature)
  and is subject to the ethics review and Google's API terms.
- **Study data is for research; consent is paper-only** (vault `ADR-007`,
  2026-10-14, supersedes `ADR-006`). Signing in does not imply consent:
  every analysis and export must filter on `consented_at IS NOT NULL`.
  Study queries read food / weight / workout rows, goal history, the active
  plan and AI call counts — never vitals, symptoms, conditions or medications.
- **Goal baseline = earliest `goal_history` row**; a skipped onboarding goal
  step is not recorded as a goal (it would be a fabricated default).
- **`npm audit` gate = production dependencies only** (`--omit=dev
  --audit-level=high`, 2026-10-13). The full-tree audit still runs with
  `continue-on-error`; revert to a full-tree gate once `braces` ships a fix.
- `next` is pinned exactly; 16.3.8 was chosen over 16.4.0 as the smallest
  jump clear of every advisory (2026-10-13).

## Last verified state
- 2026-10-14: `feat/trial-data-notice` (local) — `npm run lint` 0 errors
  (3 pre-existing warnings), vitest **612/612** (51 files), clean
  `npm run build` exit 0, `tsc --noEmit` exit 0. Local prod build :3199
  (placeholder Supabase env, so the proxy is bypassed): `/consent` → 404,
  POST `/api/consent` → 404, `/dashboard` `/settings` `/onboarding` → 200.
  Migrations 001–025 applied to an in-memory Postgres (pglite, stubbed
  `auth` / `storage`): all 14 queries in `cohort-queries.sql` ran on 7
  synthetic users and matched hand-computed values (KM 0.833 / 0.625,
  attainment 0.67 / 1.10, unconsented user excluded); RLS: own
  `goal_history` insert OK, other user's insert / own `consented_at` /
  `role` change denied, update + delete of history rows affect 0 rows,
  a backdated `recorded_at` is overwritten by the server, profile delete
  cascades. `/code-review medium` run: 10 findings, 8 fixed, 2 documented
  (no `goal_history` backfill; SUS day-14 counts from the signature date). NOT verified: any authed flow against real
  Supabase (the goal dual-write, the export consent filter, the 429 message
  as rendered in each client), 025 on prod, the queries on prod.
- 2026-10-13: `main` (`448aa58`, deployed) — CI green: TypeScript / Build /
  ESLint / Vitest (**596/596**, 50 files) / npm audit; `gitleaks` ran on
  PR #19 (1 commit scanned, no leaks) and is skipped on push by design. Local
  at `99e5c8b` on Next.js 16.3.8: `tsc --noEmit` exit 0, `npm run lint`
  0 errors (3 pre-existing warnings), clean `npm run build` exit 0, vitest
  596/596 on Node v26.0.0 and v22.23.3. Prod
  (https://diet-tracker-two-blue.vercel.app, anonymous curl):
  `/`, `/login`, `/manifest.webmanifest`, `/sw.js`, `/robots.txt` → 200;
  `/icon`, `/apple-icon` → 200 `image/png` (byte-identical to the local
  build, both opened and checked by eye at `99e5c8b`); `/dashboard` → 307
  `/login?next=%2Fdashboard`; `dt-guest=1` on `/dashboard` → 307
  `/onboarding`; anonymous POST `/api/recommend` → 403. NOT verified: any
  authed flow, image optimization, a gitleaks finding failing CI.
