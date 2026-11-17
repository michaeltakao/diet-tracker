# Radical critique — diet-tracker (2026-11-17)

Author: dt-critic (`.claude/agents/dt-critic.md`), run in-session.
Decision record: vault `decisions/ADR-011-diet-tracker-core-loop-cut-and-thesis-rescope.md`.
Implementation: branch `refactor/core-loop` (cut from `fix/study-p0` @ `dc99005`).
Measurements: `~/大学院/研究室/app-analysis-2026-10/core-loop-2026-11-17/{before,after}/`
(`scripts/measure-core-loop.mjs`, 390×844, guest mode, headless Chrome).

Labels: **F** = Fact (verified, with reference) · **A** = Assumption ·
**H** = Hypothesis (with a test) · **O** = Opinion.

---

## 0. Verdict

**O.** diet-tracker was an "everything app" with no user. It had 16 screens, 9 Gemini features, a full
game layer and a doctor-report generator. Over the same months, production collected **0 food rows and
1 weight row**, and nobody has signed in since 07-22 (**F**, vault ADR-008 progress note, 11-13). The
thesis claimed a contribution the planned study never measured. The fix was to cut down to the core
loop, *log → see progress → come back*, plus the one artifact the thesis rests on, the safe
recommender, and to re-scope the thesis so that the artifact is what gets measured.

---

## 1. Product

### 1.1 Scope without a user

- **F.** Before the cut: 35,721 non-test LOC in `app/ components/ lib/`, 16 pages, 21 API routes, 9 of
  them backed by Gemini, 75 components, and 28 migrations (30 tables written). Measured at `dc99005`.
- **F.** Roughly 15k LOC sat outside the study outcomes (food, weight and workout logs):
  gamification (37 files, 6 tables), workout tooling (generator, check-in, programs, per-set and 1RM
  analytics), health logs (vitals, symptoms, meds, doctor report), form/pose and four extra AI cards.
  Every module was deleted in commits `3be0bf6`, `e21b6df`, `7dfee00`, `f923530`, `dcfd034`,
  `0530942` and `d859f48`.
- **O.** No user was named for any of these features. Taken together, the rank/XP/quest layer, the
  doctor report and the AI program generator target three different people: a gamer, a patient and a
  lifter.

### 1.2 The home screen buried the loop

- **F (before).** The calorie card was at **y = 1029 px**, about 1.2 screens down, and the meal list
  at **y = 3552 px**, about 4.2 screens down, with **16 cards** above the meal list. Rank, XP and
  quests came first (`before/dashboard-full.png`).
- **F (after).** The calorie card is at **y = 110**, the meal list at **y = 250** and the weight input
  at **y = 453**. All three sit inside the first viewport, with 1 card above the meal list
  (`after/dashboard-viewport.png`).
- **F.** The sticky calorie bar hid on `/` but not on `/dashboard`, so home showed the remaining kcal
  twice (`components/CalorieContextBar.tsx:9`). Fixed in `e5cb3fa`.

### 1.3 Friction

| Metric (390×844, from /dashboard) | Before | After |
|---|---|---|
| Taps to log a meal (manual) | **8** (FAB, manual tab, name, kcal, **P, F, C**, save) | **4** (FAB, name, kcal, save) |
| Taps to log a weight | 3 (tab, open form, save; field autofocused) | **2** (field, save — on the home screen) |
| y of calorie card / meal list (px) | 1029 / 3552 | 110 / 250 |
| Cards above meal list | 16 | 1 |
| Page height (px) | 3859 | 1034 |
| Console errors (7 routes) | `/research` 401 ×2 (guest, expected) | same |

- **F.** P/F/C were *required* on manual entry (`app/add/page.tsx:185-196` at `dc99005`). That is
  3 extra taps and number lookups per meal. They are now optional, all-or-nothing, and flagged by
  `food_logs.macros_entered` (migration 029, `b941c05`).
- **F.** `/add` opened on the photo tab, which waits on Gemini. It now opens on manual entry.
- **F.** Onboarding had 4 steps. Two of them (experience, environment) fed only the deleted workout
  generator, so it now has 2 (`dcfd034`).
- **H.** Fewer taps per log raise days-with-a-log per week. Test: compare S1 retention with the
  2026-07 family trial (n small, descriptive only), or randomize the old vs new home screen in a
  later study.

### 1.4 What was kept and why

- Meal logging (recent/favourites one-tap, manual, photo, barcode), weight, workout days and the
  calorie goal. These are the core loop and the study outcomes (`docs/trial/cohort-queries.sql`
  `act` = food, weight, workout).
- **Safety layer:** medication and condition inputs in settings, `lib/medication-rules.ts`,
  `MedWarning`, `lib/recommend-safety.ts`.
- `RecommendationCard`, the thesis artifact; water as one small row; push reminders; outbox/sync;
  research, SUS and feedback; export and self-delete.
- **A.** Removing gamification costs little retention. There is no evidence either way: 0 users.

---

## 2. Research

### 2.1 The contribution is not measured

- **F.** The submitted plan's gap statement is "few systems integrate … medication- and
  condition-safety constraints" (`~/大学院/研究室/提出資料/research-plan_m5301061_source.html`).
  The artifact for it is `lib/recommend-safety.ts` (screen → clamp → filter, 31 tests).
- **F.** The study's analysis never reads recommender output. `cohort-queries.sql` contains 0
  references to recommendations or `recommendation_feedback`.
- **O.** As designed, the thesis would report retention of a logging app, and the recommender would
  be a decoration.

### 2.2 The design cannot answer the question

- **F.** The submitted plan promised random assignment to an app group vs a no-app control, with
  ethics approval, among training-room users (same file). The current design (vault ADR-007) is a
  single group of 10–30 family members and acquaintances with no hypotheses.
- **F.** Ethics review has not started, and the advisor's Q1–Q3 are open (STATUS.md, 11-13).
- **O.** n ≤ 30, no control group and a convenience sample allow descriptive retention numbers only.
  That is not enough for a Master's contribution about a *recommender*.
- See `~/大学院/研究室/thesis-pivot-2026-11/` for 4 re-scoped candidates. The recommendation
  (**O**) is an offline safety benchmark of the LLM recommender, with and without the rule gate.

### 2.3 A metric the cut affects

- **F.** S5 in `cohort-queries.sql` (lines 503–529) reads `training_programs` for `planned_per_week`
  and adherence. With `/plan` deleted, these columns will be NULL for new participants. S5's primary
  values (workout days/week, month 1 vs month 6) are unaffected. Recorded in
  `docs/trial/data-dictionary.md`; to be decided at the analysis-plan freeze. The table is
  deliberately **not** in drop draft 030.

---

## 3. Process

- **F.** Months of hardening went into the data pipeline: outbox, sync health, build stamp, freeze
  checks and JST fixes (ADR-008 P0-1…P0-13). Meanwhile the app had no user and the thesis question
  was unvalidated.
- **O.** The order was inverted. Validating the question and recruiting are cheaper than
  engineering, so they should come before it. ADR-008's "hide via flags" kept every feature's
  maintenance cost; ADR-011 deletes instead, and git history is the undo.
- **F.** `.claude/CLAUDE.md` told agents to judge work on revenue, "NOT academic novelty". It now
  uses retention/friction plus research validity (`e28489b`).

---

## 4. Cost after the cut

| | Before (`dc99005`) | After (`e5cb3fa`) |
|---|---|---|
| Non-test LOC (app/components/lib) | 35,721 | **20,202** (−43%) |
| Pages | 16 | 9 |
| API routes | 21 | 13 |
| Gemini-backed routes | 9 | **3** (analyze-food, analyze-label, recommend) |
| Tables the app writes | 30 | 17 |
| Components | 75 | 35 |
| i18n lines | 1,439 | 635 |
| vitest files / tests | 66 / 748 | 41 / 473 |

All counts were taken with the same commands at both commits (see the ADR-011 progress note).

---

## 5. Open items (owner)

1. [🔒user] Apply migration **029** to production **before** this branch reaches production. Until
   then the outbox keeps food rows queued and stops the flush (PGRST204 is non-permanent), which also
   holds back weight rows.
2. [🔒user] Draft **030** (drop 13 tables): run the row-count step, export any rows, then approve.
3. [🔒user, advisor] Thesis direction (`thesis-pivot-2026-11/`); S5 adherence columns (§2.3).
4. Next.js 16.4.1 has a moderate advisory (GHSA-mfr8-8qww-v76h, fixed in 16.4.6). The app does not
   use `'use cache'` or `unstable_cache` (grep, 11-17). Upgrade it in a separate PR, as with #23.
5. **No new features until there is usage data** (dt-critic guardrail).
