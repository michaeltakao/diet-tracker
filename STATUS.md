# STATUS — diet-tracker

Entries before 2026-09, the pre-trim Next list (incl. completed items) and
older verification records live in `docs/logs/STATUS-archive-2026-07.md`.
Keep this file under 200 lines: Now (latest 3) / Next / Blockers / Key
decisions / Last verified (latest 2) — move older entries to the archive.

## Now
- **2026-10-29 Status review + ADR-008 P0 started.** Product done and live
  (`main` `f8a3d37`); research has **no data yet** — waiting on the advisor's
  3 answers (none at 10-29), the [🔒user] setup items, and the ADR-008 P0
  bugs. `feat/trial-data-notice` pushed → **draft PR #21**. Branch
  `fix/study-p0` (stacked on it): `7209390` empty-storage `getAppData()`
  handed out shallow-copied defaults, so add*() mutated them and old rows
  reappeared after storage was cleared (deep copy + test); `a6c43db`
  **P0-1** — every stored `date` is the JST day, `addedAt` no longer 24 h
  early before 09:00 (`lib/format-date.ts` JST helpers; incl. 2 server routes).
  10-30: `fa76cef` **P0-5** (untouched body steppers never stored, B6;
  onboarding place/time seed the check-in, minutes 15/30/45/60+, B6b);
  `ba225e9` **P0-12** (目標体重 stepper, stored only when set; scope
  `'weight'`). Browser-verified at a pinned 01:11 JST — results in
  `~/大学院/研究室/app-analysis-2026-10/remeasure-2026-10-30/`.
- **2026-10-14 Six-month study prep (branch `feat/trial-data-notice`, pushed
  10-29, draft PR #21):** the trial data is now meant for research
  (vault `ADR-007`, supersedes `ADR-006`; status *proposed* until the advisor
  answers the three questions on slide 14).
  - In-app consent removed: `/consent`, `/api/consent`, the `proxy.ts`
    redirect and the `consent*` i18n keys. Consent is the signed paper form;
    `consented_at` is set by hand (`docs/trial/consent-roster.sql`).
  - Goals reach the server: `updateGoals` dual-writes `profiles.goal_*`;
    `goal_history` (migration `025`, **not applied to prod**) keeps the
    starting purpose and goal weight. 025 also freezes `consented_at` for
    user-scope writes.
  - Export only users with `consented_at` set; Gemini quota → readable 429
    in all 9 AI routes. Docs: `docs/SPEC.md`, `docs/trial/` (consent form,
    guide, `cohort-queries.sql` S0–S5b / W1–W5). Advisor slides:
    `~/大学院/研究室/research-plan-2026-10/` (14 pp, synthetic screenshots).

## Next
- **[auto] ADR-008 P0, in order** (branch `fix/study-p0`, target 11-12 =
  new verify-by): ~~P0-1~~ → ~~P0-5~~ → ~~P0-12~~ → P0-9 `study_start_at` →
  P0-10 guest mode off in the study build → P0-11 `build_sha` → P0-2, P0-4,
  P0-3, P0-8, P0-6, P0-13 (+ P0-7 alongside). Each: lint / build / vitest,
  then re-run the 10-15 browser measurement (header date = JST, 72.4 is the
  latest weight, FAB → /add). P1 flags wait for the advisor's Q1.
- **Six-month study, 10–30 family and acquaintances (plan 2026-10-14):**
  1. [🔒user] Show the slides to the advisor; settle ethics review, pilot vs
     plan revision, and the Gemini tier. **No URL goes out before that.**
  2. [🔒user] Gemini: the free tier's terms say not to submit personal or
     sensitive information and require users to be 18+
     (https://ai.google.dev/gemini-api/terms, read 10-14). Decide paid tier /
     strip conditions and medications from prompts / AI off, then update
     section 6 of the consent form to match.
  3. After approval to proceed: `/code-review` + merge PR #21, apply
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
- Backlog: recipes, micronutrient UI, weight SVG → recharts, AccountSection
  i18n; research ideas: adherence prediction, habit phenotyping, TDEE goals.

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
- **Duolingo phase 7 (hero gradient) = stay flat, no change** (2026-07-21):
  the `StreakHeader.tsx` flat `bg-fox` banner is intentional; older ad-hoc
  `bg-gradient-*` uses (e.g. workout hero) are style debt, not retrofit targets.
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
- **Day boundary = JST everywhere** (ADR-008 P0-1, 2026-10-29): use
  `lib/format-date.ts` helpers, never `toISOString().split('T')[0]`.
- **Goal baseline = earliest `goal_history` row**; a skipped onboarding goal
  step is not recorded as a goal (it would be a fabricated default).
- **`npm audit` gate = production dependencies only** (`--omit=dev
  --audit-level=high`, 2026-10-13). The full-tree audit still runs with
  `continue-on-error`; revert to a full-tree gate once `braces` ships a fix.
- `next` is pinned exactly; 16.3.8 was chosen over 16.4.0 as the smallest
  jump clear of every advisory (2026-10-13).

## Last verified state
- 2026-10-30: `fix/study-p0` (P0-12 + review fixes) — lint 0 errors (3 pre-existing
  warnings), `tsc` 0, vitest **646/646** (55 files), clean build. Browser
  (own headless Chrome 156 over CDP — the chrome-devtools MCP profile was
  locked; clock pinned to 01:11 JST, 390×844): header 10月30日, water key /
  weight / meal `date` 10-30, meal `addedAt` error 0 h (was 24 h);
  onboarding untouched → 0 weight rows, goal weight null; 60→70 / goal 65
  stored; ジム/30分 preselected on /workout. 10-29 secscan of #21: gitleaks
  clean, semgrep 11 pre-existing. NOT verified: FAB overlap (B2, P0-3 still
  open), any authed flow / server write, a real wall-clock 00–09 run.
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
