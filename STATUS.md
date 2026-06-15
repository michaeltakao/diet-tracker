# STATUS — diet-tracker

## Now
- **Workout logging UX** on `feat/workout-quick-log` (stacked on
  `enhance/usability`), **PR #8 open** (commits `2dc7c98` + `8d4e029`,
  2026-06-15). (1) Tap-to-log quick logger: muscle-part → exercise → inline
  ∓-stepper editor prefilled from last session (progressive overload).
  (2) Program-driven session logging: `/workout` surfaces the active program's
  session (today by default, any session selectable), tap a planned exercise →
  editor prefilled from the plan target, log → ✓ + `N/total` + 🎉 at completion.
  Pull model (localStorage), guest-safe, no new API, `/plan` unchanged.
  `SetEditor` extracted to module scope (reused by both surfaces);
  `lib/session-progress.ts` pure helpers + 10 tests. Build/lint/tsc green.
- UX/structural refactor pass shipped on `refactor/ux-structural-pass`
  (stacked on `feature/safe-explainable-recommender`), **PR #6 open**
  (commit `e05ebe8`, 2026-06-13). Additive/behaviour-invariant: local-date
  helpers + JST early-morning UTC fix, `safeParse` consolidation, shared
  `CARD`/chart-theme constants, regression tests (58→69). Build/lint/tsc green.
- Phase B (preference/feedback) of the safe-recommender roadmap on
  `feature/safe-explainable-recommender`: `lib/recommend-preference.ts`,
  feedback data layer, migration `005_recommendation_feedback.sql` + tests.

## Next
- Review/merge the stack bottom-up: **PR #5 → #6 → #7 → #8**. PR #8
  (`feat/workout-quick-log`) sits on top of `enhance/usability` (PR #7);
  it retargets to `main` (or rebases) once the lower branches land.
- Review/merge **PR #6**; after the feature branch lands, retarget (or rebase)
  the refactor onto `main` for independence from Phase B.
- Optional follow-up PR: deferred Track C dark-mode hover tokenization
  (`plan/page.tsx`), verified with a browser two-mode contrast pass.
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
- 2026-06-13 (`refactor/ux-structural-pass` @ `e05ebe8`): `npm test` **69 ✓**
  (58 prior + 11 new) · `npx tsc --noEmit` clean · `npm run lint` **exit 0,
  zero warnings** (the documented `plan/page.tsx` lint error did not trigger
  on the current eslint CLI config) · `npm run build` ✓ (21/21 pages). The
  working tree builds cleanly here — the 2026-06-11 "does not build mid-Phase-B"
  note below reflected uncommitted WIP that is no longer present.
- 2026-06-11: all 6 branches in-sync with `origin` (`git for-each-ref` — no
  ahead/behind, no missing upstreams).
- 2026-06-11: `npm test` 58 ✓ · lint ✓ · trivy (lockfile) clean · gitleaks
  history scan: 9 findings, all triaged false positives (placeholder JWT
  headers + `...` in `.env.local.example` / CI yml — no real credentials).
- 2026-06-11: `npm run build` ✓ at HEAD (isolated worktree). NOTE: the
  working tree itself does NOT build mid-Phase-B — WIP `lib/types.ts` changed
  under committed `lib/export.ts:145`; expected until Phase B lands.
