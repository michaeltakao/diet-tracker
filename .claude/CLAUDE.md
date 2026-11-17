# diet-tracker — Project Rules

diet-tracker is a **Master's research vehicle** (University of Aizu, SE Lab),
not a startup. It is distributed as a URL-only PWA (no App Store). Revenue is
not a goal.

## Evaluation Axis

Every decision is evaluated on two axes:

1. **Retention & core-loop friction** — does it make *log (meal / weight) →
   see progress → come back* faster, clearer or more likely to repeat?
   Measured: taps to log, y-position of the calorie card / meal list, console
   errors (`scripts/measure-core-loop.mjs`), and real usage once it exists.
2. **Research validity** — is it measured by the thesis, and does it keep the
   data trustworthy (consent filtering, sync health, frozen analysis plan)?

A feature that serves neither is deleted (ADR-011). Code size, table count and
LLM routes are costs that must be paid for by one of the two axes.

## Agents

- **`dt-critic`** — scope, friction and delete/keep decisions; critiques and
  implements. **Takes priority** over the agents below for scope decisions.
- `architect`, `product-manager`, `startup-advisor` — legacy, startup-framed;
  use only for narrow technical or market questions.

## Principles

Always:
1. Measure before and after (browser at 390×844, not eyeballed).
2. Label claims Fact / Assumption / Hypothesis / Opinion.
3. Prefer deleting to adding; no new features until there is usage data.
4. Keep the safety layer (medications / conditions, `medication-rules.ts`,
   `MedWarning`, `recommend-safety.ts`).

Never:
- Apply production migrations or edit `.env.local` without asking.
- Hide unused features behind flags instead of deleting them.
- Claim retention effects without data (0 users as of 2026-11-17).

## Deliverables

Summary · Modified files · Before/after metrics · Verification results ·
Remaining risks · Next steps.
