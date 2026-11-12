# STATUS — diet-tracker

Entries before 2026-09, the pre-trim Next list (incl. completed items) and
older verification records live in `docs/logs/STATUS-archive-2026-07.md`.
Keep this file under 200 lines: Now (latest 3) / Next / Blockers / Key
decisions / Last verified (latest 2) — move older entries to the archive.

## Now
- **2026-11-12 ADR-008 P0 code complete** (`fix/study-p0`, draft PR #22,
  pushed): P0-2 `0f8fbe6`, P0-4 `cc1baa1`, P0-3 `d809549` + `5100946`
  (install banner also covered the FAB — found in the browser check), P0-8
  `962d598`, P0-6 outbox + `028` `19fec03`, P0-7 `9e893ad`, docs + P0-13
  draft `30e9dd8`; review fixes `7d686f4` (outbox) + `c38166d`. Commit-level
  detail: vault ADR-008 Progress. Evidence:
  `~/大学院/研究室/app-analysis-2026-10/remeasure-2026-11-12/`.
  **026 / 027 / 028 not applied to prod; outbox not run against a server.**
- **2026-11-04 ADR-008 P0-9 / P0-10 / P0-11** (`fix/study-p0`, draft PR #22).
  **P0-9**: migration `026` adds `profiles.study_start_at` (researcher-only,
  frozen like `consented_at`); `cohort-queries.sql` day 0 = its JST date,
  participants need both columns, purpose / goal weight = value in effect
  at day 0; `consent-roster.sql` R2 sets both (R2b moves day 0). **P0-10**:
  `NEXT_PUBLIC_STUDY_BUILD=1` hides the guest links and `proxy.ts` ignores
  `dt-guest`. **P0-11**: migration `027` stamps food/weight/workout rows
  with `build_sha` + `study_build` (unstamped retry if 027 is missing);
  `/api/build-info`; `scripts/check-study-freeze.mjs` + weekly procedure
  `docs/trial/freeze-check.md`; Vercel production build fails without the
  flag. **026 / 027 not applied to prod.**
- **2026-10-29** Status review; ADR-008 P0 started (P0-1 JST dates `a6c43db`,
  P0-5 `fa76cef`, P0-12 `ba225e9`, storage deep-copy `7209390`; draft PR
  #21). Full entry in the archive (moved 11-12).

## Next
- **ADR-008 P0: all done in code** (P0-13 = draft only). Before merging
  #22: [🔒user] Vercel Production env `NEXT_PUBLIC_STUDY_BUILD=1` (else prod
  builds fail); apply 026 + 027 + 028 (ask first); signed-in end-to-end run
  of the outbox (log offline → back online → row in Supabase, one
  `client_sync_health` row); then the freeze setup in
  `docs/trial/freeze-check.md` and the analysis-plan freeze
  (`docs/trial/analysis-plan-freeze.md`). P/F/C optional + `029` only after
  the advisor's answer. Deferred review items: copy-yesterday still does one
  getUser() per copied entry; AI routes still take anonymous callers
  (`lib/api-guard.ts`). P1 flags wait for the advisor's Q1.
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
- **Study day 0 = `profiles.study_start_at`** (ADR-008 P0-9, 2026-11-04), set
  by hand with `consented_at`; analysis uses log rows dated on/after it.
  **Goal baseline = the `goal_history` row in effect at day 0** (latest
  on/before day 0, else first after; goal weight only up to day 13); a
  skipped onboarding goal step is not recorded as a goal.
- **Study build = `NEXT_PUBLIC_STUDY_BUILD=1`** (ADR-008 P0-10/11): no guest
  mode, rows stamped; production builds without it fail. Freeze = git tag
  `study-v1` + weekly `scripts/check-study-freeze.mjs`.
- **`npm audit` gate = production dependencies only** (`--omit=dev
  --audit-level=high`, 2026-10-13). The full-tree audit still runs with
  `continue-on-error`; revert to a full-tree gate once `braces` ships a fix.
- `next` is pinned exactly; 16.3.8 was chosen over 16.4.0 as the smallest
  jump clear of every advisory (2026-10-13).

## Last verified state
- 2026-11-12: `fix/study-p0` @ `c38166d` — lint 0 errors (3 pre-existing
  warnings), `tsc` 0, vitest **748/748** (66 files), `next build` OK
  (unsandboxed). Browser (headless Chrome 156 over CDP, fresh profile,
  `GEMINI_API_KEY= next dev`, guest, clock 01:00 JST, 390×844): header
  11月12日; 72.4 → 最新 72.4; FAB centre → /add with the feedback button
  and the install banner (forced `beforeinstallprompt`) shown — before
  `5100946` the banner covered it; storage full → toast, nothing stored;
  4000×3000 noise JPEG 12.2 MB → 1280×960 preview ≈404 KB; no key → one
  /api/generate-workout (200) + plan; /login Japanese. `/code-review medium`
  10 findings: 9 fixed, 1 partly (copy-yesterday). NOT verified: outbox
  against Supabase (needs sign-in + 028), migrations on prod, Vercel.
- 2026-11-04: `fix/study-p0` (P0-9/10/11) — lint 0 errors (3 pre-existing
  warnings), `tsc` 0, vitest **666/666** (58 files). Study build: `next build`
  OK; production without the flag → build error; headless Chrome: no guest
  links on `/` `/login` (normal build shows them); `/api/build-info` returns
  the sha. Freeze script vs stub: exit codes 0/1/1/2/2/2 as specified. pglite
  001–027, 6 synthetic users: own `study_start_at` change denied; carry-over
  w0 = 78 (not trial 80), trial goal weight kept; pre-day-0 rows excluded;
  unset day 0 flagged by R3/W5; 14/14 queries run. `/code-review medium` 9
  findings (6 fixed, 3 deferred); `/sec` OK. NOT verified: authed flows /
  real Supabase writes, 026/027 on prod, Vercel settings.
