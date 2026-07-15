# STATUS — diet-tracker

## Now
- **2026-07-15 P0 #4a DONE: remove fake default goals from the dashboard** —
  `app/page.tsx` no longer renders the fabricated 2000/150/60/200/2000 as real
  targets. `goals` state is now `DailyGoals | null` (null = "no real goals");
  `loadData()` shows goals only when real — `(onboarding record exists && not
  skipped) || goals differ from the fresh-install defaults` (module-level
  `goalsEqualDefaults`, a hand-kept mirror of the unexported `DEFAULT_GOALS` in
  `lib/storage.ts`). Un-onboarded / skip-path devices now get a 🎯
  「目標を設定してください」empty-state card (CTA → `/onboarding`, secondary
  link → `/settings`) instead of fake numbers. `goalsReady` gates first paint so
  neither fake numbers nor the empty card flash before the client-only load.
  WaterTracker stays visible in both states (`goals?.water ?? 2000` = universal
  hydration guideline, not a fabricated nutrition target); header/streak/
  RecommendationCard/TdeeCard/meals/badges/FAB unchanged. 4 i18n keys added
  (ja+en) in `lib/i18n.ts` (second file in the commit — hardcoding JP would
  regress the English UI). Accepted false-negative: a user who manually saves
  exactly 2000/150/60/200/2000 sees the empty state; false-positive impossible
  for wizard completers. Verified: lint + 165 tests + build green; dev E2E both
  states (skip → 🎯 card, no fake targets, meals+water intact; wizard-completed
  → real 2,450 kcal / 2,150 remaining, empty card gone).
  **STILL open (P0 #4b, NOT fixed here — dashboard-only per ticket):** the
  fabricated defaults are still consumed by `app/log/page.tsx:159,184`,
  `components/TrendsPanel.tsx:80,91`, `components/RecommendationCard.tsx:181`,
  `components/WeeklyReportCard.tsx:81-84`, `app/plan/page.tsx:567`, and the badge
  engine (`lib/storage.ts:305,314`) — some send them to AI routes.
- **2026-07-15 SECURITY AUDIT (post-P0 #3, report-only)** —
  `docs/reviews/SECURITY_AUDIT_2026-07-15.md` (gitignored, not committed).
  No P0. P1: (1) AI routes leak upstream `Error.message` + echo raw Gemini
  output on parse failure (reflected injectable channel); (2) `research/export`
  query params unvalidated + IRB audit-log insert is fire-and-forget (PII can be
  read un-logged); (3) prompt-injection via verbatim user free-text (bounded:
  single-user, food output post-filtered but suggest-workout/coach free-text is
  not) — overlaps roadmap P0 #8 (zod + responseSchema). P2: **open-redirect
  guard in `auth/callback:86` is bypassable** (`//evil.com` passes
  `startsWith('/')` → `new URL` resolves off-origin; correction to the prior
  "positive" — phishing-grade only, PKCE means no token leak), no runtime input
  validation, unbounded arrays, shared access code in localStorage, no CSP/
  security headers. Answered user Q: non-AI routes do NOT need guardAiRoute
  (they're authed + session-derived id filters, no RLS-only route found).
- **2026-07-15 P0 #3 DONE: suggest-workout guard + durable ai_usage daily quota** —
  `app/api/suggest-workout/route.ts` now goes through `guardAiRoute` (was the
  only AI route with inline auth; its 429 also gains the missing `Retry-After`).
  New durable per-user **JST-day** quota layer in `lib/api-guard.ts` backed by
  Supabase `ai_usage` (migration **011 applied to prod**): guard checks
  per-route `DAILY_QUOTAS` (analyze-food 100 / coach 200 / recommend 100 /
  suggest-workout 50 / weekly-report 20 / habit-report 20) + `GLOBAL_DAILY_QUOTA`
  400, **fail-closed** (quota-check DB error → 503, never a free pass); all 6
  AI routes charge via `recordAiUsage` (RPC `increment_ai_usage`,
  SECURITY DEFINER, auth.uid()-scoped, anon revoked) **only after a successful
  Gemini call** — failed requests never consume quota; recorder is best-effort
  (undercount over user-facing failure). Guests = authed-only quota by design
  (FK to profiles), still behind APP_ACCESS_CODE + in-memory limiter.
  Verified: lint + 165 tests + build green; prod SQL sanity (RLS on, grants
  correct); RPC upsert arithmetic live-tested in prod inside a rolled-back
  txn (2 calls → calls=2, est_tokens summed, JST date); dev guest E2E 200 +
  11th request → 429 `retry-after: 8`. NOT exercised: authed 429 in prod
  (needs a real session — [🔒user] E2E item).
- **2026-07-14 P0 #1 FIXED: consent-skip race** — three-layer fix: `proxy.ts`
  consent guard now **fails closed** (missing `profiles` row or query error →
  `/consent`, never inside the app unconsented); `app/auth/callback/route.ts`
  best-effort repairs a missing profiles row after code exchange (service-role
  upsert mirroring the `handle_new_user()` trigger, `ignoreDuplicates`, never
  breaks login); `app/api/consent/route.ts` detects a zero-row update and
  recovers via service-role upsert (or 500s honestly — never reports consent
  it didn't persist). lint + 165 tests + build green.
- **2026-07-14 P0 #2 FIXED: recommendation_feedback dual-write** —
  `lib/data/recommendation-feedback.ts` no longer re-exports the
  localStorage-only writer: `addRecommendationFeedback` now writes
  localStorage synchronously then upserts to the Supabase
  `recommendation_feedback` table when authenticated (fire-and-forget,
  `onConflict: user_id,item_type,item_name` = migration 005 UNIQUE key,
  latest-wins mirroring the local dedup); `lib/data/favorites.ts` now
  routes its `kind: 'favorite'` event through the wrapper instead of
  `@/lib/storage`, so ♡ feedback reaches the cloud too. Study pipeline
  (dashboard/export read the cloud table) unbroken going forward.
  `clearRecommendationFeedback` stays local-only (cloud history = research
  data). lint + 165 tests + build green.
- **2026-07-14 FTUE ONBOARDING WIZARD shipped (D4–D5)** — new `app/onboarding/`
  4-chip wizard (goal / body birth-year+sex+height+weight / experience /
  today's environment), every step skippable with an explicit labeled default;
  result screen = deterministic TDEE (Mifflin-St Jeor when body confirmed,
  食事摂取基準 EER sex-averaged otherwise) + kcal/PFC targets each with a
  1-line WHY, all badged 仮, CTA → first workout. Persistence via lib/data:
  goal+experience → health profile always; age/sex/height + weight entry ONLY
  when body step confirmed (defaults are never logged as measurements); goals
  → `updateGoals` (kills fake dashboard defaults on this device).
  `experience?` = new localStorage-only `UserHealthProfile` field (no DB
  column). Forced redirect in `proxy.ts` via `dt-onboarded` cookie (1y,
  per-device; consent still wins for authed users; guests gated too).
  New: `lib/data/onboarding.ts` (record+cookie),
  `components/onboarding/ChipGroup.tsx`. Browser-verified 3 paths on dev
  :3210 (complete → numbers exact vs Mifflin/EER tables + dashboard shows
  real targets; あとで skip → defaults recorded, nothing fabricated; body-skip
  → sex-averaged 2275 kcal + 仮 note, no weight entry). NOTE: redirect gate
  inactive in local dev (placeholder Supabase env → proxy pass-through);
  active in prod.
- **2026-07-14 FTUE & PUBLIC-BETA EXPERIENCE DESIGN landed (docs-only)** —
  `docs/roadmaps/FTUE_BETA_DESIGN_2026-07.md`: FTUE critical path + 12
  drop-off countermeasures, journey map D0–D30, session-start AI-trainer flow
  (CheckInWidget merged from /plan), meal-scan v2 result card + ≤3-tap
  correction + failure fallbacks, social LP + notification copy, retention
  D1–D30 (streak redefined = any-log day + weekly repair ticket),
  no-dark-pattern checklist, accessibility 5-pack, research evaluation plan
  (SUS @D14 / UEQ-S @D30), beta checklist, and a consolidated P0/P1/P2 that
  **supersedes the 07-13 roadmap's P0 ordering**. Two 🔴 bugs found in the
  audits, documented NOT fixed:
  1. **Consent-skip race** — nothing inserts a `profiles` row on signup, and
     the proxy only forces `/consent` for users WITH a row where
     `consented_at IS NULL` → fresh OAuth users likely skip the research
     consent wall entirely (ethics/validity, P0 #1).
  2. **recommendation_feedback pipeline broken end-to-end** — the study's
     core signal is localStorage-only (dual-write deferred) while the
     researcher dashboard + export read the CLOUD table (P0 #2).
- **2026-07-13 COMPETITIVE STUDY + REDESIGN ROADMAP landed (docs-only)** —
  reverse-engineering of 19 fitness/nutrition apps + gap analysis + 3-pillar
  redesign: `docs/research/COMPETITIVE_STUDY_2026-07.md` (ranking, retention
  mechanics, UX analysis, 4 publication opportunities) and
  `docs/roadmaps/REDESIGN_ROADMAP_2026-07.md` (environment-aware deterministic
  workout engine + LLM narrative design, photo workflow v2, P0/P1/P2, migrations
  011+ schema, API/UI changes). Locked decisions: exercise DB seeded from
  free-exercise-db (public domain); deterministic engine decides / LLM only
  explains; per-user daily AI quotas. No code yet.
- **2026-07-12 MULTI-GENERATION ROUND merged (PR #13, main `9af9ef1`)** — app now
  supports every generation 12+ per 日本人の食事摂取基準（2025年版）:
  `lib/nutrition-standards.ts` (EER/protein-RDA/%E tables, source-cited,
  cross-checked ×2), minor (12–17) calorie floor + growth warning + TdeeCard
  deficit-preset filter, senior (65+) protein floor 1.0 g/kg (**CKD cap wins** —
  tested), profile +sex/+height_cm (migration 010 **applied to prod**),
  settings 推奨値 button + 性別/身長 inputs, **18+ consent attestation gate**
  (client+server, `adult_confirmed_at`; minors → guest mode — vault `ADR-004`),
  large-text mode (112.5%). 165 tests. Browser-smoked personas 15/70.
- **Gotcha (Turbopack)**: editing `app/globals.css` while the dev server is down
  can leave a stale persistent-cache compile that survives restart + hard reload;
  `rm -rf .next` fixes it.
- **2026-07-05 PRODUCTION DEPLOYED** — https://diet-tracker-two-blue.vercel.app
  (Vercel project `diet-tracker`, team michaeltakaos-projects; deploys via
  `npx vercel deploy --prod --yes`).
- **2026-07-05 CRITICAL FIX `28d3d44`**: auth-lock deadlock — ProfileContext's async
  `onAuthStateChange` callback awaited `fetchProfile()` while auth-js held its
  navigator.locks mutex → lock held for the page's lifetime → **every Supabase
  dual-write silently degraded to localStorage-only**. Found live in the prod smoke
  test (this is why the dual-write tables had zero rows). Deployed prod needs this
  commit (redeploy if Vercel didn't auto-deploy).
- 2026-07-05 review-fix round `a7b9574` (pre-merge, on the stack): servings scale from
  immutable base (round-trip exact), AI-fill resets servings, validate() rejects
  non-finite/negative/oversized, favorites upsert `onConflict: user_id,name`,
  self-delete returns 500 on auth-cleanup failure, trends same-day dedupe (+test),
  migration 009 policies rerun-safe. Cross-vendor review: Copilot/GPT (gpt-5.4-mini)
  + Claude; **Gemini CLI leg DOWN** (IneligibleTierError → Antigravity migration,
  [🔒user]). Record: `docs/reviews/code-review-2026-07-05.md` (gitignored).
- 2026-07-03 competitor round's 4 stacked PRs (#9–#12) **merged to main 07-05**
  (merge order #9→#12, branches deleted).
- **2026-07-05 prod smoke test PASSED** (local dev vs prod Supabase, throwaway SQL
  user, Chrome DevTools): consent flow → `consented_at` set; food log at 1.5×
  servings → `food_logs` row with `servings=1.50, source='manual'`; ♡ favorite →
  `favorite_foods` row (`macro_highlight=高タンパク`); template → `meal_templates`
  row; **cascade erasure verified** — deleting `profiles` zeroed food_logs /
  favorite_foods / meal_templates / recommendation_feedback / tdee_estimates;
  auth user purged. Self-delete route fails SAFE without service key (500, UI
  error, localStorage kept).
- Guest mode fixed for production (`dt-guest` cookie, `b19e69b`): the login page's
  "Continue without an account" link was dead UI when Supabase is configured —
  proxy.ts redirected everything to /login. Found in post-deploy smoke E2E.
- Billing-audit A1 now on main (`6c476e1`): pr-review/issue-route workflows are
  `workflow_dispatch`-only.

## Next
- **[auto] Beta P0** (per `docs/roadmaps/FTUE_BETA_DESIGN_2026-07.md` §11 —
  refines/supersedes the 07-13 roadmap's P0 ordering): 1) ~~🔴 consent-skip race
  fix~~ **DONE 07-14** (`e7852dc`); 2) ~~🔴 `recommendation_feedback` dual-write
  to Supabase~~ **DONE 07-14**; 3) ~~`suggest-workout` behind
  `guardAiRoute` + durable `ai_usage` per-user daily quotas~~ **DONE 07-15**
  (migration 011 in prod); 4) kill fake
  default goals + ~~60-s 4-chip onboarding~~ **wizard DONE 07-14** (fake-default
  rework of `app/page.tsx` still open); 5) empty states → single next-action
  CTAs; 6) streak redefinition (any-log day) + weekly repair ticket; 7) web
  push; 8) Gemini `responseSchema` migration ×6; 9) session-start flow
  (env/time/equipment/energy; CheckInWidget merged /plan → /workout); 10)
  cohort auto-assignment + SUS surface. Enablers carried from the 07-13
  roadmap: exercise DB seed (free-exercise-db → ~120–150 curated, +pattern/JP
  names); `workout_sessions`+`workout_sets` per-set schema; environment-aware
  deterministic generation v1; ghost-text set-logging ergonomics.
- **[🔒user] to finish production**:
  1. Vercel env (Production): add `SUPABASE_SERVICE_ROLE_KEY` (enables export +
     participant self-delete) and confirm `GEMINI_API_KEY` value is current
     (photo AI). `APP_ACCESS_CODE` already set.
  2. Supabase dashboard → Auth → URL Configuration: add
     `https://diet-tracker-two-blue.vercel.app` to Site URL / Redirect URLs
     (Google OAuth + magic link won't round-trip until then).
  3. Create a real account → authed full E2E: consent → recommend → export.
  4. Set researcher role for your own account (researcher_access_log flow).
- **[🔒user] Supabase dashboard → Auth → Providers: Google is DISABLED**
  (`external.google=false`) — the login page's Google button cannot work against
  this project until enabled (or hide the button).
- **[🔒user] Gemini CLI ineligible** (IneligibleTierError) — migrate to Antigravity
  or council loses its preferred cross-vendor reviewer (Copilot/GPT still works).
- **[🔒user] local `.env.local` has placeholder NEXT_PUBLIC_SUPABASE_* values and
  no usable `SUPABASE_SERVICE_ROLE_KEY`** — local dev runs guest-mode-only until
  filled (smoke test worked around it via shell env; service-key routes untestable).
- W4 self-delete: cascade + fail-safe verified 07-05 (see Now); full route E2E
  (auth.admin.deleteUser leg) still needs `SUPABASE_SERVICE_ROLE_KEY` in env.
- ~~Authed dual-write spot-check~~ **DONE 07-05** (SQL evidence, see Now). Note:
  STEP-7 bulk migration rows leave `servings`/`source` NULL — backfill or accept.
- Review follow-ups (from 07-05 cross-vendor round, non-blocking): no Supabase→local
  hydration path (second device sees empty app — biggest sign-in value gap);
  MealCard edit coerces empty fields to 0 (pre-existing); favorites quick-add
  ignores the servings stepper (UX).
- Backlog (explicit cut list from the round): W1b bundled JP food DB (MEXT 成分表 —
  demoted per kill criteria; **revived *scoped* as P1 in the 07-13 roadmap**: top ~500
  washoku + pg_trgm, grounds photo v2 numbers), W1c barcode/OFF (spike
  ≥50% hit-rate on 10 pantry items first; unchanged, still gates barcode), telemetry Supabase dual-write (needs migration
  + consent gating), recipes, full micronutrient UI, weight-page SVG → recharts,
  AccountSection full i18n retrofit.
- P1 research features: adherence prediction, habit phenotyping, TDEE-triggered goal adaptation.
- Stale open PRs #3/#6/#7/#8 predate the stack and have diverged from main —
  close or rebase decision pending (only #8's CI hardening was salvaged, via `6c476e1`).

## Blockers
- Authed E2E blocked on [🔒user] items 1–2 above.

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

## Last verified state
- 2026-07-12: main (`9af9ef1`, post PR #13 merge) — `npm run lint` clean,
  `npx vitest run` **165/165**, `npm run build` green. Migration **010 applied**
  to prod (`chkkpucuiyjdeqgyyszt`), `database.types.ts` in sync. Browser smoke
  (dev :3210, SW unregistered): age-70 推奨値 → 2350/60/65/338 exact; age-15 →
  2850 EER fill, consent blocked without 18+ checkbox, guest exit sets
  `dt-guest=1`; large-text 16→18px, persists, no overflow (dashboard, /log,
  BottomNav). Prod redeploy pending (Vercel auto-deploy from main, or
  `npx vercel deploy --prod --yes`).
- 2026-07-05: main (`28d3d44`) — `npm run lint` clean, `npx vitest run` **135/135**,
  `npm run build` green. Prod smoke test vs `chkkpucuiyjdeqgyyszt`: dual-write rows
  (food/favorite/template incl. migration-009 columns) + cascade erasure + auth-user
  purge all SQL-verified; throwaway user destroyed.
- 2026-07-05: main (`b19e69b`) — `npm run lint` clean, `npx vitest run` **135/135**,
  `npm run build` green. Production smoke E2E on
  https://diet-tracker-two-blue.vercel.app (Chrome DevTools): /login renders,
  guest link → dashboard/log/add/consent all render (screenshots verified),
  anonymous POST `/api/recommend` → **403 "Access code required"** (gate live),
  no-cookie `/` → 307 `/login?next=%2F`. Vercel Production env:
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` added (public
  values via Supabase MCP); `APP_ACCESS_CODE`, `GEMINI_API_KEY` pre-existing.
- 2026-07-03: migrations **006/007 confirmed live**, **008 + 009 applied** to prod
  (`chkkpucuiyjdeqgyyszt`) and verified; `database.types.ts` regenerated.
- 2026-06-11: trivy (lockfile) clean · gitleaks history scan: 9 findings, all triaged
  false positives.
