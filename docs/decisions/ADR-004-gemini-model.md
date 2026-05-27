# ADR-004: Google Gemini 2.5 Flash as Primary AI Model

**Status:** Accepted
**Date:** 2026-05-27
**Author:** Engineering Team

## Context

The application requires AI for three use cases:
1. **Meal photo analysis** — identify food items and estimate macros from a photo
2. **Daily coaching** — personalized advice based on today's nutrition + workout data
3. **Weekly habit report** — 7-day behavioral pattern analysis with structured output

## Options Considered

| Model | Multimodal | Structured Output | Speed | Cost/1M tokens | Score |
|---|---|---|---|---|---|
| **Gemini 2.5 Flash** | ✅ | ✅ `responseSchema` | Fast | ~$0.10 input | **9/10** |
| Gemini 2.5 Pro | ✅ | ✅ | Slower | ~$1.25 input | 7/10 |
| GPT-4o | ✅ | ✅ | Fast | ~$2.50 input | 6/10 |
| GPT-4o-mini | ✅ | ✅ | Very fast | ~$0.15 input | 7/10 |
| Claude 3.5 Sonnet | ✅ | ✅ | Fast | ~$3.00 input | 6/10 |

## Decision

**Gemini 2.5 Flash** for all three use cases.

Reasons:
1. **Multimodal:** Photo analysis requires vision capability — Flash supports it natively
2. **`responseSchema`:** Eliminates JSON parsing fragility (current `raw.match(/\{...\}/)` hack)
3. **Cost:** ~10x cheaper than GPT-4o for the same quality on structured tasks
4. **Existing SDK:** `@google/genai` already in the project
5. **Speed:** Low latency matters for the coaching widget (user waits in-app)

## Consequences

### Positive
- Single SDK, single API key
- `responseSchema` parameter removes the need for regex JSON extraction
- Competitive quality for nutrition/fitness domain

### Negative
- Single vendor dependency — if Google changes pricing or deprecates, requires migration
- `gemini-2.5-flash` model ID may change — pin to specific version when stable
- Photo analysis macro estimates are approximate (~15% error margin)

## Technical Debt Items

1. **Migrate from regex JSON parsing to `responseSchema`** — current `raw.match(/\{[\s\S]*\}/)` is fragile
2. **Add `temperature` and `maxOutputTokens` config** — currently using defaults
3. **Token usage logging** — no visibility into per-request cost

## Future Consideration

If Gemini 2.5 Pro quality is needed for weekly reports (more reasoning), switch only that route to Pro while keeping Flash for real-time coaching.
