# STATUS — diet-tracker

## Now
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
- **[auto] Redesign P0** (per `docs/roadmaps/REDESIGN_ROADMAP_2026-07.md`): gate
  `suggest-workout` with `guardAiRoute` (bug-level); durable per-user daily AI
  quotas (`ai_usage` table, enforced in `guardAiRoute`); Gemini `responseSchema`
  migration ×6 call sites; exercise DB seed (free-exercise-db → ~120–150 curated,
  +pattern/JP names); `workout_sessions`+`workout_sets` per-set schema;
  environment-aware deterministic generation v1; ghost-text set-logging ergonomics.
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
