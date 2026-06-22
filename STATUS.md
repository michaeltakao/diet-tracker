# STATUS — diet-tracker

## Now
- `feature/research-platform` branched from `feature/safe-explainable-recommender`,
  committed `bef03c4` and pushed 2026-06-22. All P0 features implemented:
  - XAI "なぜこれ？" drawer per recommendation item
  - Adaptive TDEE engine (14-day OLS regression) + dashboard card
  - Consent/enrollment flow (/consent page + proxy redirect)
  - Researcher dashboard (/research, role-gated)
  - Researcher data export API (/api/research/export, JSON + CSV)
  - DB migrations 006 (tdee_estimates) + 007 (profiles: role/consented_at)

## Next
- Apply migrations 006+007 to Supabase project via MCP or dashboard.
- Set `profiles.role = 'researcher'` for researcher accounts in Supabase.
- Write unit tests: lib/tdee.test.ts + lib/recommend-explain.test.ts.
- P1 features: adherence prediction, habit phenotyping, TDEE-triggered goal adaptation.
- Merge feature/research-platform → main after field-study setup.

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
