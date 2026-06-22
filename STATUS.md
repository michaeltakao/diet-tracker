# STATUS — diet-tracker

## Now
- `feature/research-platform` fully verified and pushed (`35b2ee3`, 2026-06-22).
  P0 complete:
  - XAI "なぜこれ？" drawer per recommendation item
  - Adaptive TDEE engine (14-day OLS regression) + dashboard card
  - Consent/enrollment flow (/consent page + proxy redirect)
  - Researcher dashboard (/research, role-gated)
  - Researcher data export API (/api/research/export, JSON + CSV)
  - DB migrations 006 (tdee_estimates) + 007 (profiles: role/consented_at)
  - lib/__tests__/tdee.test.ts (16 tests) + lib/__tests__/recommend-explain.test.ts (12 tests)
  - database.types.ts regenerated from live Supabase schema

## Next
- Apply migrations 006+007 to Supabase project via MCP or dashboard (not yet applied).
- Set `profiles.role = 'researcher'` for researcher accounts in Supabase.
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
- 2026-06-22: `feature/research-platform` @ `35b2ee3` — `npm run build` ✓,
  `npm test` 86/86 ✓. All P0 routes compile and appear in build manifest.
- 2026-06-11: trivy (lockfile) clean · gitleaks history scan: 9 findings,
  all triaged false positives.
