# STATUS — diet-tracker

## Now
- Phase B (preference/feedback) of the safe-recommender roadmap, in progress on
  `feature/safe-explainable-recommender`: `lib/recommend-preference.ts`,
  feedback data layer, migration `005_recommendation_feedback.sql` + tests
  (8 uncommitted files as of 2026-06-11).

## Next
- Finish Phase B; commit + push with tests.
- Phase C: telemetry/retention layer (field-study instrumentation).
- Land the `feature/step6-dual-write` → `feature/step7-migration` storage
  sequence; then `feature/personalized-recommendations`.

## Blockers
- None.

## Key decisions
- Phase A safety layer wired into `/api/recommend` (`lib/recommend-safety.ts`,
  19 tests) — commit `84ba7dd`, 2026-06-03.
- Semantic token design system + WCAG-AA (use tokens, not `gray-*`).
- Pre-existing `plan/page.tsx` lint error left as-is (documented, not ours).
- Repo is the Master's research vehicle — see vault `ADR-001`.
- `postcss` overridden to `^8.5.10` (CVE-2026-41305, MEDIUM) — same fix as
  price-commons.
- CI workflows hardened against script injection (`cac19bf`, 2026-06-12):
  `issue-route.yml` github-script steps take LLM classifier outputs via `env:`
  (they derive from attacker-controlled issue text and ran with `issues: write`);
  `pr-review.yml` checkout uses `persist-credentials: false` and `base_ref` via
  env. Found during Layer-3 mega-prompt triage — see vault `ADR-003`.

## Last verified state
- 2026-06-11: all 6 branches in-sync with `origin` (`git for-each-ref` — no
  ahead/behind, no missing upstreams).
- 2026-06-11: `npm test` 58 ✓ · lint ✓ · trivy (lockfile) clean · gitleaks
  history scan: 9 findings, all triaged false positives (placeholder JWT
  headers + `...` in `.env.local.example` / CI yml — no real credentials).
- 2026-06-11: `npm run build` ✓ at HEAD (isolated worktree). NOTE: the
  working tree itself does NOT build mid-Phase-B — WIP `lib/types.ts` changed
  under committed `lib/export.ts:145`; expected until Phase B lands.
