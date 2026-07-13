# Diet-Tracker Redesign & Roadmap (2026-07)

**Date:** 2026-07-13
**Status:** Approved plan (analysis phase — no code yet)
**Basis:** [`docs/research/COMPETITIVE_STUDY_2026-07.md`](../research/COMPETITIVE_STUDY_2026-07.md)
(competitor ranking, retention mechanics, gap analysis, research contributions).

Locked decisions (user, 2026-07 session):

1. **Exercise metadata** — seed from an open dataset (free-exercise-db).
2. **Workout generation** — deterministic selection engine + LLM narrative layer
   (LLM explains, never decides).
3. **AI cost control** — per-user daily quotas on Gemini routes.

Epistemic labels: **[F]** = fact (sourced), **[A]** = assumption, **[H]** = hypothesis,
**[O]** = opinion.

---

## Three pillars

1. **Frictionless core loops** (attacks gaps #1–#3): per-set logging with ghost text;
   recents-first food entry; photo → confirm-chips → logged in ≤3 interactions.
2. **Environment-aware deterministic workout engine + LLM narrative** (design §1 below;
   attacks gaps #2/#5, is the research headline, honors decisions #1/#2).
3. **Trustworthy AI** (attacks gaps #6/#7): structured output everywhere, DB-grounded
   numbers, calibrated ±ranges with provenance badges, per-user daily quotas
   (decision #3). Positioning: the anti-Cal-AI.

---

## 1. Environment-aware workout system (core design)

**Problem with the field:** every app permanently classifies users as "home" or "gym"
(profile-level), or requires manual gym-profile switching (Fitbod's equipment profiles
are the best attempt but are still manual, black-box, and cold-start-heavy). Real users
train at home today, gym tomorrow, hotel next week.

**Design (honors decision #2: deterministic engine + LLM narrative):**

- **Exercise DB (decision #1):** seed **free-exercise-db** [F: public domain/Unlicense,
  800+ exercises, JSON fields: `force, level, mechanic, equipment, primaryMuscles,
  secondaryMuscles, instructions, images`]. Curate to ~120–150 high-quality movements;
  add Japanese names + common mistakes + substitution links. wger (CC-BY-SA) as
  secondary cross-check — attribution + share-alike, so prefer the public-domain
  source for the app tables.
- **Movement-pattern abstraction:** tag every exercise with pattern ∈ {squat, hinge,
  h-push, v-push, h-pull, v-pull, lunge, carry, core, isolation-X}. Programs are
  written in *patterns*; the engine instantiates a concrete exercise per session given
  the environment. This is the key trick — the program survives any equipment change.
- **Session-level environment context:** at session start, one chip question:
  "Where are you? 🏠 home / 🏋️ gym / 🧳 travel / custom". Each maps to an equipment
  set (user-editable; travel = bodyweight+bands default). Default is predicted from
  history + weekday. *Never* stored as a permanent user type.
- **Scoring function (deterministic):** for candidate exercise e in session s:

  ```
  S(e|s) = w_r·recovery(muscles(e)) + w_p·patternNeed(e) + w_v·weeklyVolumeDeficit(e)
         + w_n·novelty(e) + w_u·userAffinity(e)
         − ∞·(equipment unavailable ∨ contraindicated)
  ```

  - recovery: per-muscle fatigue with exponential decay, τ ≈ 48–72 h [A: standard
    heuristic; cite recovery literature in the paper].
  - Progressive overload: double progression (reps to top of range → +load) +
    plateau/deload triggers after N stalled sessions.
  - Time-boxing: greedy knapsack on estimated per-exercise minutes; auto-superset
    antagonists when budget is tight.
  - Complexity: O(n·m), n≈150 exercises, m≈8 slots — trivially real-time, fully
    unit-testable, zero LLM cost.
- **LLM narrative layer (Gemini, quota-gated per decision #3):** renders the *why* —
  "Bench press today because your chest volume is 40% below target and you last
  trained it Tuesday." Template-grounded from the engine's actual score components →
  the explanation can never contradict the decision (faithfulness by construction;
  this is the publishable property).
- **Alternatives considered [O]:** (a) full-LLM generation — rejected: cost, safety,
  unverifiable, per decision #2; (b) RL/bandit adaptation — deferred to research
  track (P2), needs telemetry volume first.
- **Limitations [stated]:** heuristic recovery model is population-level, not
  individualized (P2: fit τ per user); affinity cold-starts at neutral.

---

## 2. AI nutrition / photo workflow v2

**Field reality [F]:** ~27% MAPE across nutrients (2025 *Nutrients* study, 114 real
meals); Cal AI underestimates 25–50%; SnapCalorie ±19.8% MAPE. Nobody is honest about
this in-product — calibrated honesty is the opening.

Redesigned workflow (photo → log in ≤3 interactions):

1. Photo → Gemini with **structured output**:
   `[{dish, portion_estimate, confidence, alternates[]}]` — never free-text numbers.
2. **Confirm/correct chips**: user taps the right dish candidate + portion (S/M/L or
   reference-object hint "vs your fist"). Corrections are stored → supervised
   fine-tuning/eval dataset = **data flywheel + research dataset**.
3. Nutrition numbers come from the **food DB lookup** of the confirmed dish, not from
   the LLM (LLM classifies; DB quantifies). Calibrated ±range shown, e.g.
   "≈520 ± 90 kcal", with an "AI-estimated" provenance badge that persists in the log.
4. Text-describe fallback ("2 onigiri and miso soup") through the same structured
   pipeline; barcode stays free forever [O: MFP's paywalled barcode is their
   most-hated move — free barcode is cheap marketing].
5. Cost containment (decision #3): per-user daily photo-AI quota, image-hash response
   cache, downscale before upload, hard route-level gating (fix the ungated route
   found in the audit).

---

## 3. Roadmap

### P0 — Safety + foundations (~2–3 weeks equiv.)

| Item | Notes |
|---|---|
| Gate `suggest-workout` with `guardAiRoute` | Bug-level fix; 1 line + test |
| **Per-user daily AI quotas** | New `ai_usage` table (durable, cross-instance — fixes in-memory limiter too); enforced inside `guardAiRoute`; per-route daily caps + global user cap; 429 with reset time. Decision #3 |
| Gemini `responseSchema` migration (all 6 call sites) | Kills regex parsing; ADR-004 debt #1; prereq for photo v2 |
| **Exercise DB seed** | free-exercise-db (public domain) → curate ~120–150; add `pattern`, JP names, common mistakes, substitution links. Decision #1 |
| `workout_sessions` + `workout_sets` schema | Per-set model; keep `workout_logs` read-compatible |
| **Environment-aware generation v1** | Session-start environment chip → equipment set → deterministic scoring engine (§1), time-boxed; zero LLM cost |
| Set-logging ergonomics | Ghost text (extend existing last-session recall), ±2.5 kg steppers, auto rest-timer on set save |

### P1 — Retention + explainability (~4–8 weeks equiv.)

| Item | Notes |
|---|---|
| **LLM narrative explanations** | Template-grounded in engine score components; quota-gated; the faithfulness-by-construction paper feature |
| **Photo workflow v2** (§2) | Structured candidates + portion chips + correction capture + ±range + provenance badge; image-hash cache |
| Minimal JP food DB | Revive W1b *scoped*: top ~500 washoku/常食 from MEXT 成分表 + pg_trgm search; photo v2 grounds numbers in it. Barcode = OpenFoodFacts spike (W1c gate: ≥50% JP hit rate) |
| Web-push notifications | Meal/workout reminders, streak-protection nudge ("log anything to keep your 12-day streak"), weekly-report-ready |
| Recoverable streaks | Soften loss-aversion cliff [H: reduces churn spike after first missed day] |
| Muscle-volume heatmap + pattern-balance viz | Fitbod's stickiest visualization, driven by our new per-set data |
| **Adherence prediction v1** | Features from logging telemetry + habit-report; logistic baseline → churn-risk score → nudge timing. STATUS.md P1 research item |

### P2 — Research depth + expansion

Per-user recovery constant fitting (replace population τ); bandit-based exercise
affinity; habit phenotyping / chronotype-aware reminder timing; form analyzer →
bench/deadlift; washoku photo-estimation eval set + calibration study; wearable import
(Health Connect/HealthKit via PWA limits — spike first); social/cohort features
**explicitly deferred** [O: negative ROI for a research vehicle].

---

## 4. Database changes (Supabase migrations 011+)

- `exercises` — slug, name_ja/en, pattern, primary/secondary_muscles[], equipment[],
  level, mechanic, force, instructions_ja/en, common_mistakes_ja/en, media_url,
  source+license (attribution row for dataset provenance).
- `user_equipment_profiles` — user_id, label (home/gym/travel/custom), equipment[],
  is_default; RLS owner.
- `workout_sessions` — user_id, started_at, environment_profile_id, duration_min,
  engine_version.
- `workout_sets` — session_id, exercise_id, set_number, reps, weight_kg,
  rpe (nullable), is_pr.
- `ai_usage` — user_id, usage_date, route, calls, est_tokens;
  UNIQUE(user_id, usage_date, route); the quota + cost-visibility table (also closes
  ADR-004 "no token logging" debt).
- `generated_workouts` — engine inputs/outputs JSONB + explanation shown
  (reproducibility + audit for the paper).
- `foods` (P1) — per-100 g values, source='MEXT2023', pg_trgm index on name_ja.
- `photo_corrections` (P1) — image_hash, ai_candidates JSONB, user_choice, portion;
  consent-gated research dataset.

## 5. API changes

- Fix: `suggest-workout` → `guardAiRoute` (P0). All AI routes: quota check + token
  accounting via extended `guardAiRoute`.
- New: `POST /api/workout/generate` (deterministic, **no LLM**),
  `POST /api/workout/explain` (LLM narrative, quota-gated),
  `GET /api/exercises?equipment=&pattern=&q=`, `PUT /api/equipment-profiles`,
  `GET/POST /api/push-subscription` (P1), `GET /api/foods/search` (P1).
- Changed: `analyze-food` v2 → responseSchema structured candidates + portion +
  confidence; image-hash response cache; numbers resolved against `foods` when
  available.

## 6. UI redesign

- Keep 4-tab pattern: **Today / Log / Train / Trends** (+Settings). Today's top card =
  "your session today" (1-tap start, Fitbod pattern).
- Train: session-first flow — environment chip → generated session → per-set rows with
  ghost text → auto rest timer → session summary with PRs.
- Add-food: photo tab shows candidate chips + portion S/M/L + "≈520 ± 90 kcal" + AI
  badge (reuse `--ai` violet token family for ALL AI-provenance surfaces — consistent
  trust signal).
- First-run empty state: equipment chips → instant first workout (<60 s to value).
- Fix `<html lang>` not switching with language toggle (a11y).

## 7. Verification plan (when implementation starts)

Per phase: `npm run lint && npm run build`, existing 165-test suite green + new unit
tests (scoring engine is pure-function testable — property tests for equipment
feasibility, recovery monotonicity, time-budget respect); quota tests (429 on cap,
reset at date rollover); manual E2E: generate session in each environment profile;
photo v2 on a 20-item washoku set vs weighed ground truth before any accuracy claim.
