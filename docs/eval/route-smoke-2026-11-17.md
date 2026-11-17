# Route smoke test on the pinned model (2026-11-17)

**Scope.** This checks that the six AI routes the safety regression
(`gemini-pin-2026-11-17.md`) didn't cover still work end to end on
`gemini-3.5-flash-lite`. It runs one synthetic request per route. It does
**not** measure quality.

- **Setup:**
  - `next dev -p 3100` on branch `chore/gemini-model-pin`.
  - Anonymous caller (`APP_ACCESS_CODE=` empty), so `userId` is null. No Supabase reads or `ai_usage` writes happen.
  - Each route was compiled first with a GET (405, no model call), so latency excludes dev compilation.
- **Script:** `node scripts/route-smoke.mjs <out.json>`. Set `ROUTES=a,b` to re-run a subset.
- **Raw data:** `route-smoke-2026-11-17.json`, with all request bodies and full responses. Inputs are synthetic; there is no user data.

## Results

| Route | Attempt 1 | Attempt 2 | Latency (ms, passing attempt) | Response keys | Japanese |
|---|---|---|---|---|---|
| coach | 200 | — | 5 272 | todayAdvice, habitInsight, tomorrowTip, motivationMessage | ✓ |
| nutritionist | **500** (upstream 503) | 200 | 37 521 | suggestions[3]{title, detail} | ✓ |
| generate-workout | 200 | — | 22 097 | plan (3 exercises, deterministic), narrative{sessionName, notes, motivationMessage} | ✓ |
| suggest-workout | 200 | — | 26 385 | proceed, sessionName, adjustments, intensityNote, motivationMessage, recoveryTips, generatedAt | ✓ |
| habit-report | 200 | — | 50 901 | strengths, frictions, nextWeekTarget | ✓ |
| weekly-report | **500** (upstream 503) | 200 | 34 273 | summary, highlight, improvement, nextWeekGoal + server stats | ✓ |

**Pass:** every route returned 200 with the expected JSON shape and Japanese text. Two routes needed a second attempt.

- **Median latency:** 30.3 s, with n = 1 per route.

## Failures (attempt 1)

- **Fact:** both 500s came from Gemini `503 UNAVAILABLE` ("This model is currently experiencing high demand"). They were thrown after `generateWithRetry` ran out of retries.
  - nutritionist failed at `route.ts:145`.
  - weekly-report failed at the orchestrator call, `route.ts:189`, after the 4 specialists returned.
- Neither is a parse or shape bug, so no code change was made.

**Hypothesis:** the 22–51 s latencies are retry backoff during the same overload, not the model's base latency. The safety regression measured 2.8 s median on this model. Re-running at a quiet hour would test this.

## Observations (not scored)

These are read by eye from one sample each; they are not a quality evaluation.

- **coach** (warfarin + 納豆ご飯 in the log): it flagged 納豆 as contraindicated with warfarin and suggested an alternative. ✓
- **weekly-report** (CKD, water goal 2000 ml): it advised drinking *more* water "for kidney protection". The advice follows the user's own goal, but fluid restriction is common in advanced CKD.
  - **Opinion:** this is worth a rule-level look under the safety work. It is not a lite-model regression, because the prompt has no fluid guidance.
- **habit-report:** it wrote "月3回" (3 times a month) for a 7-day window; it should be per week. This is a minor factual slip.
- **generate-workout / suggest-workout:** they respected leg soreness and moved the session to upper body. ✓

## Limits

- n = 1 per route. This is a smoke test, not a benchmark.
- The test sends no comparison to `gemini-2.5-flash`. A comparison needs a judging rubric, and the 2.5-flash quota was already returning 429s.
- Only the anonymous path ran. Authenticated paths add Supabase reads (suggest-workout) and `recordAiUsage`. Unit tests cover those; this run did not.
- Cost: about 14 model calls including retries, well under $0.05.
