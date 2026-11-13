# STATUS — diet-tracker

Entries before 2026-09, the pre-trim Next list (incl. completed items) and
older verification records live in `docs/logs/STATUS-archive-2026-07.md`.
Keep this file under 200 lines: Now (latest 3) / Next / Blockers / Key
decisions / Last verified (latest 2) — move older entries to the archive.

## Now
- **2026-11-13 security: Next 16.3.8 → 16.4.1 merged** (PR #23, `main`
  `20c1275`; GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r).
  Production `/` and `/login` return 200 after the deploy. `main` merged
  into `feat/trial-data-notice` (`559e8f5`, PR #21) and from there into
  `fix/study-p0` (`019d5bd`, PR #22) the same day; #21's `npm audit`
  check is green again. **Outbox run: still open** — the sign-in link now
  reaches localhost but was opened in another browser (PKCE); 0 rows.
- **2026-11-12 ADR-008 P0 code complete** (`fix/study-p0`, draft PR #22,
  pushed): P0-2 `0f8fbe6`, P0-4 `cc1baa1`, P0-3 `d809549` + `5100946`
  (install banner also covered the FAB — found in the browser check), P0-8
  `962d598`, P0-6 outbox + `028` `19fec03`, P0-7 `9e893ad`, docs + P0-13
  draft `30e9dd8`; review fixes `7d686f4` (outbox) + `c38166d`. Commit-level
  detail: vault ADR-008 Progress. Evidence:
  `~/大学院/研究室/app-analysis-2026-10/remeasure-2026-11-12/`.
  **11-12 later: `027` + `028` applied to prod (rows unchanged, no new
  advisor finding). `025` + `026` held — see Blockers.** Also: W6 query +
  time-zone / sync-health rules decided, weekly
  `.github/workflows/freeze-check.yml`.
- **2026-11-04 ADR-008 P0-9 / P0-10 / P0-11** (`fix/study-p0`): day 0, no
  guest mode in the study build, build stamp. Full entry: archive (11-12).

## Next
- **ADR-008 P0: all done in code** (P0-13 = draft only). Before merging
  #22: [🔒user] Vercel Production env `NEXT_PUBLIC_STUDY_BUILD=1` (else prod
  builds fail); signed-in outbox run (offline log → online → rows + one
  `client_sync_health` row; open the link in the requesting Chrome); **apply `025`
  → `026` right after #21 is live on production, not before**; then the
  freeze setup in `docs/trial/freeze-check.md` (`study-v1` tag, `study`
  branch) and the analysis-plan freeze
  (`docs/trial/analysis-plan-freeze.md`; 2 of 4 open items decided 11-12). P/F/C optional + `029` only after
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
  2. Supabase Auth → URL Configuration (read 11-13): Site URL is
     `…-febw.vercel.app`; Redirect URLs has both Vercel callbacks.
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
- **Migration `025` must not reach prod before PR #21 is deployed**
  (found 2026-11-12): `main`'s `/api/consent` writes `consented_at` with
  the user's own client and `proxy.ts` sends unconsented users to
  `/consent`; `025` freezes that column, so consent would return 500 and
  nobody could enter the app. `026` replaces `025`'s policy, so it waits too.
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
- 2026-11-13: `fix/study-p0` @ `019d5bd` (merge of `main` via
  `feat/trial-data-notice` `559e8f5`) — lint 0 errors (3 warnings), vitest
  **748/748** (66 files), study `next build` exit 0 (unsandboxed), `tsc` 0,
  `npm audit --omit=dev` 0 vulnerabilities; `next` 16.4.1,
  `eslint-config-next` 16.4.1, `sharp` 0.35.5, `fake-indexeddb` 6.2.8.
  `feat/trial-data-notice`: vitest 612/612, same lint / tsc / build / audit;
  PR #21 checks all pass (incl. `npm audit`). Prod `/` + `/login` 200 after
  #23. Later: Supabase Redirect URLs + `http://localhost:3000/**` (4
  entries, Site URL unchanged). NOT verified: outbox against Supabase,
  PR #22's Vercel previews (pending at push time), 025/026.
- 2026-11-12 (later): `fix/study-p0` — lint 0 errors (3 warnings), `tsc` 0,
  vitest **748/748**, study `next build` OK (unsandboxed). Prod Supabase:
  `list_migrations` ends 024, 027, 028; rows before = after (profiles 2,
  food 0, weight 1, workout 0); 8 `build_sha`/`study_build` columns;
  security advisors: nothing on `client_sync_health`. W6 ran on prod
  (with `created_at` standing in for `study_start_at`, which needs 026):
  2 rows, 0 reports. Freeze script vs prod: exit 2 (no `study-v1` tag);
  prod `/api/build-info` = 404 (ships with #22). `/sec` OK.
