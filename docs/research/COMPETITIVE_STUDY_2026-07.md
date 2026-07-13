# Fitness App Reverse-Engineering Study (2026-07)

**Date:** 2026-07-13
**Status:** Final (analysis phase — no code)
**Companion:** [`docs/roadmaps/REDESIGN_ROADMAP_2026-07.md`](../roadmaps/REDESIGN_ROADMAP_2026-07.md) — the redesign + P0/P1/P2 roadmap derived from this study.

## Purpose & context

diet-tracker is both a consumer app and the Master's research vehicle (safe/explainable
recommender line: ADR-004 consent gate, age-band guardrails, senior protein floors).
Mission of this study: reverse-engineer the best fitness/nutrition/coaching apps, find
why they retain users, and produce a redesign + roadmap that (a) can outperform them
for real users and (b) yields publishable research.

Three decisions already locked (user, 2026-07 session):

1. **Exercise metadata** — seed from an open dataset.
2. **Workout generation** — deterministic selection engine + LLM narrative layer
   (LLM explains, never decides).
3. **AI cost control** — per-user daily quotas on Gemini routes.

Epistemic labels used throughout: **[F]** = fact (sourced), **[A]** = assumption,
**[H]** = hypothesis, **[O]** = opinion.

---

## 1. Competitor ranking (by threat / learn-from value)

| # | App | Category | Why ranked here | One-line lesson |
|---|-----|----------|-----------------|-----------------|
| 1 | **Hevy** | Workout logger | [F] Cheapest Pro ($2.99/mo), free tier syncs, shipped Hevy Trainer (algorithmic program gen, Feb 2026) + HevyGPT; overtook Strong in momentum | Low-friction logging + social feed + now closing the "no guidance" gap |
| 2 | **MacroFactor** | Nutrition | [F] Default r/fitness-adjacent recommendation for serious users; adaptive TDEE algorithm; no red-number shaming | Trust through algorithm transparency & data hygiene beats DB size |
| 3 | **Fitbod** | Adaptive workout gen | [F] The reference for equipment-aware, recovery-aware generation; needs 10–15 workouts before personalization feels good; long-term users rate 4–5★ | Adaptive novelty retains — but cold start & black-box are its soft belly |
| 4 | **MyFitnessPal** | Nutrition incumbent | [F] Degrading: late-2025 update broke core flows, paywall creep, downward Reddit sentiment ("use MFP and switch when you can") | Incumbent enshittification = user exodus we can catch |
| 5 | **Future** | Human coaching | [F] $199/mo human coach; proves accountability > content for retention | The retention ceiling is a *relationship*, not features |
| 6 | **Strong** | Workout logger | [O] Still the gold-standard set-logging UX (ghost text of last session, plate calc) but development stagnated; free tier caps 3 routines, charts paywalled | Perfect in-gym ergonomics; zero guidance |
| 7 | **Cal AI** (emerging) | AI photo nutrition | [F] Viral (150-influencer engine), then 3.2M-record breach (misconfigured Firebase), App Store removal for deceptive billing, photo model off 25–50% on real meals | AI-first + trust collapse = the cautionary tale AND the market opening |
| 8 | **Cronometer** | Nutrition (micros) | Verified DB, 84 micronutrients, lab-integration users | Data quality as brand; joyless UX limits mainstream reach |
| 9 | **Alpha Progression** | Hypertrophy | Deterministic progression engine with visible logic | Users *like* deterministic progression when it's legible |
| 10 | **Freeletics** | AI bodyweight coach | ~50M users, constraint-based generation, journeys | Scale via zero-equipment; adaptation is shallow/repetitive |
| 11 | **Boostcamp** | Programs | Free famous programs (5/3/1, GZCLP…), coach marketplace | Content-as-acquisition; logger UX is the weak layer |
| 12 | **Lose It!** | Nutrition consumer | Friendly, streaks, early photo logging (Snap It) | Emotional tone matters; depth is shallow |
| 13 | **Ladder** | Coaching | Team/cohort programs, coach personas | Cohort identity drives retention |
| 14 | **Yazio** | Nutrition EU | Recipes + fasting, cheap, strong EU/JP-adjacent localization | Localization is an underused moat (relevant for JP market) |
| 15 | **Nike Training Club** | Content | Free brand content, video classes | Content freshness ≠ personalization; low threat |
| 16 | **JEFIT** | Logger (legacy) | Huge exercise DB, dated ad-heavy UX | A big DB alone retains nobody |
| 17 | **Centr** | Celebrity content | Hemsworth brand | Content-led, low personalization; low threat |
| 18 | **Budy** (emerging, 2026) | AI-first all-in-one | [F] Unified context system (8 data categories), recalculates on gym↔home switch / missed session / injury; accessibility-first positioning | Closest public articulation of *our* environment-aware thesis — validates the direction, raises urgency |
| 19 | **SnapCalorie** | AI photo nutrition | [F] Photo-first; weakest accuracy in a six-app validation (±19.8% MAPE); billing complaints | Precision-first positioning fails if the numbers still aren't credible |

**Emerging AI-first pattern [F/O]:** 2025–26 wave = LLM conversational coach + photo
logging + adaptive programming (Budy, HevyGPT, Cal AI, SensAI/Vora-type chat loggers).
Nobody combines **explainability + safety guardrails + calibrated honesty about
uncertainty**. That is our open lane, and it doubles as the research contribution.

---

## 2. Why users stay for months (retention mechanics distilled)

Synthesis across App Store reviews, Reddit threads, and product teardowns [O unless marked]:

1. **Data gravity** — years of workout/nutrition history = switching cost. Strong/Hevy
   users cite "my history is here." → *Implication: import tools attack competitors'
   moat; export builds trust.*
2. **The ghost of past self** — Strong/Hevy show last session's weight×reps inline
   while logging. Beating it is a per-set micro-goal. Single strongest logger-UX pattern.
3. **Low-friction logging is THE nutrition retention driver** — every MFP complaint
   thread is friction (search noise, ads, taps). MacroFactor's 2–4-tap logging and
   Cal AI's 2-tap photo flow won users on this alone.
4. **Adaptive novelty** — Fitbod's "fresh workout every day" [F: long-term users 4–5★
   after the 10–15-workout learning period].
5. **Accountability relationships** — Future's human coach at $199/mo retains via
   someone-is-watching [F]; Ladder via cohort identity.
6. **Streaks & loss aversion** — Lose It!/MFP streaks; works but brittle (one missed
   day → churn spike) [H: soften with "recoverable streaks"].
7. **Trust in the numbers** — MacroFactor grew on algorithmic credibility; Cal AI
   collapsed on fake precision + breach. Honesty about uncertainty is a *feature*.

---

## 3. UX deep analysis (cross-app)

**Taps-to-log (core loop cost):**

| Flow | Best-in-class | Taps/time | Notes |
|---|---|---|---|
| Log one set | Strong/Hevy | ~2–3 taps (~5 s) | Ghost text pre-fills last values; +2.5 kg stepper |
| Log a known food | MacroFactor | 2–4 taps | Favorites/recents-first search, quick-add |
| Log a meal by photo | Cal AI | 2 taps + wait | Speed is why it went viral despite accuracy issues |
| Start "today's workout" | Fitbod | 1 tap | Generation removes the planning decision entirely |

**Screen hierarchy pattern (winners):** 3–4 bottom tabs max — Today/Log (default),
History/Progress, Plan/Coach, Profile. Losers (JEFIT, MFP) bury the core loop under
feeds/ads/upsells.

**Cognitive load:** red-number "over budget" shaming (MFP) → guilt → churn; MacroFactor
deliberately neutral ("data, not judgment") [F: stated design philosophy]. Beginners
need *defaults, not choices*: Fitbod's empty state generates immediately; Strong's
blank screen is beginner-hostile.

**Empty/error states:** best pattern = first-run produces value in <60 s (Fitbod: pick
equipment → get workout). Worst = empty dashboards demanding a week of data before
showing anything.

**Accessibility [O]:** broadly poor across the category; Budy explicitly markets
accessibility-first. Our existing large-text mode + WCAG-AA token work is already
differentiated — extend it, market it.

**Beginner friendliness gap [O]:** loggers assume exercise knowledge (what is "RDL"?);
generators are black boxes ("why lunges today?"). Nobody explains. Explainability
closes the beginner gap AND is the paper.

---

## 4. AI photo-nutrition field reality

[F] Photo calorie estimation has ~27% MAPE across nutrients in a 2025 *Nutrients*
study (114 real meals); Cal AI underestimates real meals 25–50%; SnapCalorie ±19.8%
MAPE. **Nobody is honest about this in-product.** Cal AI shipped false precision →
viral growth → trust collapse (breach + billing scandal compounded it).

Redesigned workflow: see [roadmap §"Photo workflow v2"](../roadmaps/REDESIGN_ROADMAP_2026-07.md#2-ai-nutrition--photo-workflow-v2).

**Differentiation:** honesty (calibrated intervals) + Japanese-food coverage
[O: every US-built photo model is weakest on washoku — a local eval set is both a
product moat and paper material].

---

## 5. Gap analysis vs diet-tracker (audit 2026-07-13)

Audit basis [F]: full codebase audit 2026-07-13 (STATUS.md 2026-07-12 = source of
truth). Stack: Next.js 16 App Router, Supabase (RLS, migrations 001–010), Gemini 2.5
Flash everywhere, prod on Vercel.

### Where we are BETTER than every competitor

| Capability | Detail | Why it matters |
|---|---|---|
| **Clinical safety engine** | Deterministic guardrails: 7 age bands from 食事摂取基準2025, minor EER calorie floor, senior 1.0 g/kg protein floor with CKD 0.8 g/kg cap winning, warfarin×納豆 / statin×grapefruit drug-food rules, prompt-injection AND output re-screening (`lib/recommend-safety.ts`) | No commercial app has this. It's the thesis line AND a consumer trust story |
| **Research ethics infra** | Consent gate + 18+ attestation, researcher role frozen via RLS, IRB access log, APPI/GDPR self-delete | Publication-grade data collection nobody else can do |
| **On-device form analysis** | MediaPipe squat analyzer, Kalman-smoothed angles, per-rep scoring, zero server cost | Only Peloton-class products attempt this |
| **Adaptive TDEE** | Regression-based estimates + history (rivals MacroFactor's core concept) | Parity with the best nutrition algorithm on the market |
| **Accessibility** | Semantic token system tuned WCAG-AA, large-text mode, aria coverage | Category-wide weakness; Budy validates this as positioning |
| **JP localization** | Full ja/en (509 keys), JP clinical grounding | Yazio aside, US apps are weak on washoku/Japanese guidelines |

### Where we are EQUAL

Streaks + badges + PR tracking; progress charts (recharts trends, TDEE history); rest
timer / Epley 1RM / kg-lbs; program builder + check-in-driven AI workout suggestion;
meal templates + favorites (≈ MacroFactor quick-add); photo meal AI (exists, but see
weaknesses).

### Where we are WORSE (ranked by severity)

| # | Gap | Best-in-class | Our state [F] |
|---|---|---|---|
| 1 | **No food DB / text search / barcode** | MFP (14M foods), MacroFactor verified DB | Manual, photo, or recents only; `'db'`/`'barcode'` are dead enum values |
| 2 | **Exercise DB = 12 hardcoded exercises** | free-exercise-db-class 800+, Fitbod equipment-aware | `RECOMMENDED_MENUS` in workout page, 2/muscle group, no equipment/pattern metadata |
| 3 | **No per-set logging model** | Strong/Hevy ghost-text set rows | `workout_logs` is flat (sets×reps×weight aggregate) — blocks real progression tracking |
| 4 | **No notifications at all** | Everyone (reminders, streak-protection) | PWA SW is cache-only; zero push/reminders |
| 5 | **No environment/equipment model** | Fitbod profiles (manual, black-box) | None — the exact opening for our headline feature |
| 6 | **Photo AI generates numbers directly** | (Nobody does this right — open lane) | LLM outputs kcal/PFC free-form, regex-parsed, no portion estimation, no ±range shown |
| 7 | **AI cost exposure** | n/a | `suggest-workout` route ungated (no `guardAiRoute`); in-memory per-instance limiter; **no per-user daily quota**; ×3 retry amplification; weekly-report = 5 Gemini calls/request |
| 8 | Social/monetization | Hevy feed, all premium tiers | None (acceptable: research vehicle, not commercial — [O] keep social out of scope) |

---

## 6. Research contributions & publication opportunities

| # | Contribution | Novelty claim | Evaluation | Venue [O] |
|---|---|---|---|---|
| 1 | **Environment-aware explainable workout recommender** | Session-level environment adaptation via movement-pattern abstraction + faithfulness-by-construction explanations (LLM verbalizes only the deterministic engine's actual score components) | Within-user A/B: explanation vs none → adherence/acceptance rate; explanation-faithfulness audit (can't contradict by construction, verify empirically); vs Fitbod-style black box | RecSys (health), IUI, UMAP |
| 2 | **Safety-constrained nutrition recommendation** (largely BUILT) | Deterministic clinical guardrails (食事摂取基準 age bands, CKD-dominant clamps, drug×food gating) wrapping an LLM recommender, defense-in-depth | Red-team eval: contraindicated-output rate with/without gate; case coverage vs guideline corpus | JMIR mHealth, CHI health |
| 3 | **Calibrated-uncertainty photo meal estimation + correction flywheel** | Confidence-calibrated intervals in-product (field baseline: 26.9% MAPE hidden from users); washoku eval set; corrections as supervision | MAPE + calibration (ECE) vs Cal-AI-style point estimates; user-trust survey | IMWUT, ACM MM food-computing workshop, JMIR |
| 4 | **Adherence prediction + nudge timing** | Chronotype/habit-phenotype features from passive logging telemetry → churn-risk → intervention timing | AUC vs logistic baseline; prospective nudge RCT within consented cohort | IMWUT, PervasiveHealth |

Related-work anchors: NutriRAG (Frontiers AI 2026), MOPI-HFRS (arXiv:2412.08847),
RS4Good (arXiv:2411.16645). Ethics: consent/IRB infra already in place [F] — a real
moat for contributions 2–4.

---

## Sources

- Hevy vs Strong 2026 (free tiers, Hevy Trainer Feb 2026, $2.99 Pro): prpath.app, sensai.fit, setgraph.app comparisons
- MFP decline / MacroFactor switch threads: trackerbenchmark.com Reddit meta-review, hootfitness.com
- Fitbod cold start & long-term ratings: indiehackers.com 2026 review
- Budy launch (unified context, accessibility-first): insider.fitt.co press release
- free-exercise-db (public domain, 800+, JSON schema): github.com/yuhonas/free-exercise-db; wger CC-BY-SA: github.com/wger-project/wger
- Photo-calorie accuracy: askvora.com Cal AI review (breach, billing, 25–50% underestimation), calorietrackerlab.com SnapCalorie (±19.8% MAPE), 2025 Nutrients study (26.9% MAPE, 114 meals)
- Academic anchors: NutriRAG (Frontiers in AI, 2026), MOPI-HFRS (arXiv:2412.08847), RS4Good survey (arXiv:2411.16645)
