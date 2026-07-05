# STATUS — diet-tracker

## Now
- **2026-07-05 PRODUCTION DEPLOYED** — https://diet-tracker-two-blue.vercel.app
  (Vercel project `diet-tracker`, team michaeltakaos-projects; deploys via
  `npx vercel deploy --prod --yes`).
- 2026-07-03 competitor round's 4 stacked PRs (#9–#12) all **merged to main** 07-02.
- Guest mode fixed for production (`dt-guest` cookie, `b19e69b`): the login page's
  "Continue without an account" link was dead UI when Supabase is configured —
  proxy.ts redirected everything to /login. Found in post-deploy smoke E2E.
- Billing-audit A1 now on main (`6c476e1`): pr-review/issue-route workflows are
  `workflow_dispatch`-only.

## Next
- **[🔒user] to finish production**:
  1. Vercel env (Production): add `SUPABASE_SERVICE_ROLE_KEY` (enables export +
     participant self-delete) and confirm `GEMINI_API_KEY` value is current
     (photo AI). `APP_ACCESS_CODE` already set.
  2. Supabase dashboard → Auth → URL Configuration: add
     `https://diet-tracker-two-blue.vercel.app` to Site URL / Redirect URLs
     (Google OAuth + magic link won't round-trip until then).
  3. Create a real account → authed full E2E: consent → recommend → export.
  4. Set researcher role for your own account (researcher_access_log flow).
- W4 manual test with a throwaway account (needs prod auth session, after 2–3).
- Authed dual-write spot-check in Supabase after first real logins.
- Backlog (explicit cut list from the round): W1b bundled JP food DB (MEXT 成分表 —
  demoted per kill criteria; needs real-data curation session), W1c barcode/OFF (spike
  ≥50% hit-rate on 10 pantry items first), telemetry Supabase dual-write (needs migration
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
- Repo is the Master's research vehicle — see vault `ADR-001`.
- `postcss` overridden to `^8.5.10` (CVE-2026-41305, MEDIUM).
- CI workflows hardened against script injection (`cac19bf`, 2026-06-12) — see vault `ADR-003`.

## Last verified state
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
