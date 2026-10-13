# STATUS — diet-tracker

Entries before 2026-09, the pre-trim Next list (incl. completed items) and
older verification records live in `docs/logs/STATUS-archive-2026-07.md`.
Keep this file under 200 lines: Now (latest 3) / Next / Blockers / Key
decisions / Last verified (latest 2) — move older entries to the archive.

## Now
- **2026-10-13 CI, security and housekeeping round — merged + deployed
  (`main` `448aa58`):**
  - PR #14: `ci.yml` gains a 4th job (`test` → `npm test`); CI had run only
    typecheck / build / lint, so vitest did not gate `main`. `STATUS.md`
    trimmed 1094 → under 200 lines, the rest moved verbatim to the archive.
  - PR #15: `next` + `eslint-config-next` 16.2.6 → **16.3.8**, `vitest` +
    `@vitest/coverage-v8` → 4.1.11, `npm audit fix` (no `--force`). `npm
    audit` had been red on `main` since at least 09-28 with 18 findings
    (1 critical, 12 high); the critical was `next` itself, incl. proxy bypass
    under Turbopack (GHSA-6gpp-xcg3-4w24) and RCE in `next/og` /
    Image Optimization (GHSA-vcvr-r3jv-pc5j, GHSA-2xp9-vwfh-vxw4).
    Exploitability on this deployment was not tested. Production deps now
    audit clean.
  - PR #16: `proxy.ts` matcher excludes `/icon` and `/apple-icon` — both are
    extension-less, so anonymous visitors got 307 → `/login` instead of the
    image linked from every page's `<head>`.
  - PR #18: `runtime = 'edge'` removed from `app/icon.tsx` /
    `app/apple-icon.tsx` (deprecated in 16.3; both now prerender statically);
    `lib/__tests__/proxy-matcher.test.ts` pins the matcher (24 cases, via
    Next's `unstable_doesMiddlewareMatch` — experimental API).
  - PR #19: `security.yml`'s grep-based secret check was a silent no-op
    (`fatal: bad revision 'origin/main...HEAD'` on a shallow checkout,
    swallowed by `|| true`). Replaced by a `gitleaks` 8.30.1 job on the PR
    commit range: binary verified by sha256, config read from the base commit.
  - Closed stale PRs #3 (0 commits missing from `main`), #6 (2), #7 (4 own),
    #8 (3 own) — branches kept; whether the unmerged work was re-implemented
    on `main` later was not checked.
- **2026-10-02 Swap fix:** the session-start swap control toggled between two
  exercises (memoryless "first alternative not in plan"). Now `alternativesFor()`
  returns the full same-part pool and `nextSwapCandidate()` remembers swapped-out
  ids (wraps after a full cycle); the button disables when nothing is left.
  Verified: vitest 572/572, lint 0 errors (3 pre-existing warnings), build exit 0;
  regression test fails (2 distinct vs 6) with the memory removed. Pushed
  (`7785f98`, `main` = `origin/main` as of 10-13).
- **2026-09-18 Engine wired into session-start (`203ef69`):** `SessionStart`
  posts to `/api/generate-workout` instead of the plain-LLM
  `/api/suggest-workout`, so the deterministic engine picks exercises/sets/reps
  and the LLM only narrates. Flow chips became engine inputs (`sorenessAreas`,
  `energyLevel`) alongside 14 days of logged workouts as per-muscle recovery
  data; exercise swap re-runs the engine client-side (zero LLM calls). Same
  round: `researcher_access_log` write failures are now logged instead of
  swallowed (`4f18a02`).

## Next
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
  6. Create a real account → authed E2E: consent → recommend → export →
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
- Age gate: 18+ attestation via `/consent`, server-enforced in
  `app/api/consent/route.ts`; under-18 steered to on-device guest mode (ADR-004).
- **`npm audit` gate = production dependencies only** (`--omit=dev
  --audit-level=high`, 2026-10-13). The full-tree audit still runs with
  `continue-on-error`; revert to a full-tree gate once `braces` ships a fix.
- `next` is pinned exactly; 16.3.8 was chosen over 16.4.0 as the smallest
  jump clear of every advisory (2026-10-13).

## Last verified state
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
- 2026-07-17 (council fixes): `npm run lint` clean, `npx vitest run`
  **252/252** (+22), `npm run build` green. Dev :3199 anon probes → 401 both
  routes; served /sw.js contains the same-origin guard. NOT empirically
  exercised: the sent===0 rollback (needs live Supabase + forced send
  failure — same [🔒user] VAPID/auth blocker).
