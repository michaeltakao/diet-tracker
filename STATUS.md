# STATUS — diet-tracker

## Now
- **2026-07-03 competitor-informed design & system round** complete; 4 stacked PRs open:
  - #9 `fix/design-tokens` (W3): undefined `var(--bg)` bug fix, `--ai/--ai-soft` tokens,
    gray/slate + semantic-accent sweep, `components/ui/` primitives (Card / ConfirmDialog /
    Toast), native `confirm()/prompt()` removed, a11y text sizes. **Base of the stack.**
  - #10 `feat/self-delete-ui` (W4): APPI/GDPR data-erasure UI wired to
    `/api/participant/self-delete` (typed confirmation; server-first, local clear after).
  - #11 `feat/trends` (W2): 週間/トレンド toggle on /log (`?view=trends`), `lib/trends.ts`
    (26 tests), recharts panels via next/dynamic, guest on-device TDEE, `lib/telemetry.ts`
    local event buffer (Phase C surface).
  - `feat/food-logging` (W1a): portion scaling (`lib/food-scaling.ts`), ♡ favorites wired
    into Phase B (`W_FAVORITE` via derived macroHighlight, vocabulary-overlap tested),
    meal templates, FoodEntryForm extraction + servings stepper, migration 009.
- Merge order: #9 → retarget #10/#11/W1a to main → merge.

## Next
- Review + merge the 4 PRs (stack base first).
- W4 manual test with a throwaway account (needs prod auth session).
- Authed dual-write spot-check in Supabase after first real logins (tables are empty).
- Backlog (explicit cut list from the round): W1b bundled JP food DB (MEXT 成分表 —
  demoted per kill criteria; needs real-data curation session), W1c barcode/OFF (spike
  ≥50% hit-rate on 10 pantry items first), telemetry Supabase dual-write (needs migration
  + consent gating), recipes, full micronutrient UI, weight-page SVG → recharts,
  AccountSection full i18n retrofit.
- P1 research features: adherence prediction, habit phenotyping, TDEE-triggered goal adaptation.

## Blockers
- None.

## Key decisions
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
- 2026-07-03: migrations **006/007 confirmed live**, **008 + 009 applied** to prod
  (`chkkpucuiyjdeqgyyszt`) and verified (role-freeze policy, researcher_access_log,
  favorite_foods/meal_templates RLS + FK CASCADE); `database.types.ts` regenerated.
  `feature/research-platform` merged → `main` (`f61128b`) and pushed.
- 2026-07-03: on `feat/food-logging` (tip of the stack) — `npm run lint` clean,
  `npx vitest run` **134/134**, `npm run build` green, `tsc --noEmit` clean.
  Manual Chrome verification (guest seed data): trends charts dark+light+ja+en,
  servings stepper rescale, ♡ → Phase B event, template save → one-tap re-log.
- 2026-06-11: trivy (lockfile) clean · gitleaks history scan: 9 findings, all triaged
  false positives.
