# Beta Testing Protocol — diet-tracker

Status: draft, 2026-07-21. Companion to `FTUE_BETA_DESIGN_2026-07.md` (the
UX/engineering roadmap) — this document covers the *human* process around
running the beta: who, how many, what's measured, what's out of scope.

## 1. Purpose & IRB framing

diet-tracker is the Master's research vehicle for Prof. Hamada's lab
(University of Aizu, Software Engineering Lab) — a safe recommender system
for diet/fitness logging with an AI coaching layer. The beta is the first
cohort of real (non-developer) users, run under the same consent framework
already implemented in `/consent` (`app/consent/page.tsx` + `app/api/consent/
route.ts`): 18+ attestation, explicit consent timestamp, and — as of this
round — automatic 50/50 cohort assignment (`lib/cohort.ts`) recorded
alongside consent.

**This document does not re-derive or restate the consent/data-handling
language** — `/consent`'s existing copy is the canonical source. If the beta
protocol requires anything beyond what `/consent` already discloses (e.g. a
specific IRB protocol number, a named human-subjects office, a fixed
retention period), that is a **[user-provided]** gap called out explicitly
below, not invented here.

**Fact** (verified by reading the code, 2026-07-21): `recommendation_feedback`/
`sus_responses`/`beta_feedback` writes are all RLS owner-only, and
`/api/research/export` + `/api/research/participants` both use
`createServiceSupabase()` (bypasses RLS) for bulk researcher access.
**Correction made during this round**: `/api/research/export`'s
`SUPPORTED_TABLES` allowlist (`app/api/research/export/route.ts`) was
initially found to be hardcoded to only `food_logs` / `weight_logs` /
`workout_logs` / `recommendation_feedback` — `sus_responses` and
`beta_feedback` were not exportable through that route despite otherwise
matching its RLS/service-role pattern. This has been fixed as part of this
round (both tables added to the allowlist, type union, single-table export
path, and the full multi-table JSON export payload) — verified via
`npm run lint` + `npx vitest run` + `npm run build` all green afterward.
**Remaining gap, not fixed this round**: `/api/research/participants`
(the researcher dashboard summary endpoint) does not surface a SUS score or
`beta_feedback` count per participant — it was not broken, it simply
predates these two data sources. A follow-up enhancement, not a blocker for
opening the beta, since `/api/research/export` now covers the raw data.

**[user-provided, not yet specified]**: the formal IRB protocol number/
approval reference for this beta round, if this University of Aizu study
requires one beyond the existing consent flow. Do not assume none is needed —
confirm with the advisor before recruiting.

## 2. Recruitment

**Hypothesis, not a decision**: a beta cohort of **15–30 participants** is
proposed as a starting range. Rationale: SUS (`lib/sus.ts`) is a 10-item
instrument with published guidance suggesting a *minimum* of ~12-15
respondents for a stable score estimate, and this study also needs enough
participants in *each* of the two auto-assigned cohorts (`control` /
`xai_treatment`, `lib/cohort.ts` — 50/50 coin flip) for the balance check in
§12 of the FTUE roadmap ("balance checked after first 20 users") to be
meaningful. This is not a power calculation for the eventual XAI A/B (that
behavioral study is explicitly P1/P2-scoped, not this round) — it is sized
only for "does the beta produce usable SUS + qualitative signal."

**[user-provided, not yet specified]**: actual recruitment channels (lab
mailing list? university-wide? social?). This document intentionally does
not fabricate a channel list — fill in before recruiting starts.

## 3. Session structure

Maps onto the existing D0/D7/D14/D30 retention journey already defined in
`FTUE_BETA_DESIGN_2026-07.md` §3/§7 — this beta does not introduce a
different cadence, it instruments the one that already exists.

- **D0 — onboarding session.** Run as an in-person or screen-share session
  with **3 naive (non-lab) users**, per the FTUE roadmap §12 checklist item
  "60-s onboarding: stopwatch test with 3 naive users (target median <90 s
  real-world)." This is the *first* beta-gate item to run, before wider
  recruitment — if median time-to-first-log exceeds 90s, that is a blocking
  finding, not a beta-launch footnote. Record: wall-clock time from app-open
  to first successful log, any point of confusion (verbatim), whether the
  4-chip onboarding wizard (`app/onboarding/`) was completed without help.
- **D7.** No required synchronous session. Passive: does the weekly report
  fire, does the streak/repair-ticket UX read as intended. Optional
  async check-in (message, not a meeting) if D0 surfaced concerns.
- **D14.** SUS card should appear (`components/SusSurveyCard.tsx`,
  `lib/sus-gate.ts` — gated on `consented_at + 14 days`, skippable, ≤1
  re-show per the FTUE checklist). No separate session needed; the card
  itself is the instrument. Cross-check: did it actually render for
  everyone who reached D14 (§12 gate item).
- **D30.** Wrap-up point for this beta round. Optional short qualitative
  exit conversation per participant if `beta_feedback` submissions (`/api/
  feedback`, Workstream 6) were sparse — the goal is to not rely solely on
  spontaneous feedback-button use for qualitative signal from every
  participant.

## 4. Metrics

**Quantitative** (via `/research` dashboard + CSV/JSON export,
`app/api/research/export/route.ts` — already service-role gated,
researcher-role only):
- Streak distribution, repair-ticket usage (existing `weekly_challenges`/
  `checkins` data, unchanged by this round).
- SUS score distribution (`sus_responses.total_score`, computed server-side
  by `lib/sus.ts`'s `scoreSus()` — never trust a client-submitted total,
  already enforced in `app/api/sus/route.ts`).
- `beta_feedback` submission rate (volume over time, not a research metric
  per se — an operational health signal for "is anyone actually hitting
  friction and telling us").
- Cohort balance: `SELECT study_cohort, count(*) FROM profiles GROUP BY
  study_cohort` — manual SQL for this round (§12 gate item "balance checked
  after first 20 users"); automating this check is explicitly out of scope
  per the implementation plan for this round.

**Qualitative**:
- `beta_feedback.message` free text (new table this round).
- D0 session notes (see §3) — these live outside the app (session notebook/
  doc), not in a table; do not conflate with `beta_feedback`.

## 5. Timeline

**[user-provided, not yet specified]** — recruitment start date, registration
window, D30 completion target, and the analysis/write-up date all depend on
lab scheduling and are not fabricated here. Once set, this section should
record: recruitment-open → registration-close → last-D30-expected →
analysis-start, each as an absolute date (not "week 3").

## 6. Data handling

Governed entirely by the existing `/consent` page's disclosure — this
protocol does not define a separate or additional data-handling policy.
Relevant existing mechanisms, for reference only (not new commitments):
- Self-delete cascades (`app/api/participant/self-delete/route.ts`) —
  **exception**: `beta_feedback.user_id` is `ON DELETE SET NULL`, not
  `CASCADE` (`supabase/migrations/019_sus_responses.sql`) — a participant's
  feedback message text outlives their account deletion, intentionally, for
  research/product continuity. This is a deviation from the cascade-everything
  pattern used elsewhere and should be disclosed in the consent copy if it
  is not already covered by its general data-retention language — **flagged
  for advisor/IRB review, not resolved by this document.**
- Owner-only RLS on `sus_responses`/`beta_feedback` (participants can only
  ever read their own rows through the normal app; bulk research access is
  service-role only, logged via `researcher_access_log` for the existing
  tables — **not yet verified whether `sus_responses`/`beta_feedback` reads
  are covered by that same access-logging path; check before the beta opens,
  do not assume parity.**

## 7. §12 beta-gate checklist — status mapping

Cross-referencing `FTUE_BETA_DESIGN_2026-07.md` §12 as of 2026-07-21. Status
values are: **Done** (verified this round or a prior round, with evidence),
**Done this round** (Workstreams 1-6 of the 2026-07-21 implementation),
**Not verified** (genuinely unknown — not assumed pass or fail), **Out of
scope** (explicitly deferred, e.g. to P1).

| §12 item | Status | Note |
|---|---|---|
| Consent flow verified for ALL entry paths | **Not verified** | `/api/consent` code-reviewed this round (cohort assignment added); the "ALL entry paths" (OAuth/magic-link/guest→account) E2E walk itself was not re-run this round. |
| `recommendation_feedback` dual-write SQL-verified | **Done** | Per STATUS.md 2026-07-14 P0 round (prior to this round's scope). |
| Cohort auto-assignment randomizes on first consent; balance checked after 20 users | **Done this round** (assignment) / **Not verified** (balance check — no users yet) | `lib/cohort.ts` + `app/api/consent/route.ts`, migration 019 applied to prod. Balance check is a manual-SQL operational step to run once ~20 beta users have consented, not something verifiable pre-launch. |
| SUS card renders at D14 in a seeded-clock test; skippable; ≤1 re-show | **Done this round** | `lib/sus-gate.ts` unit-tested (day-13/14/15 boundaries, dismiss/reappear, already-submitted, unconsented); `components/SusSurveyCard.tsx` wired on `/log`. Real-browser seeded-clock walk not performed this round — unit coverage only. |
| 60-s onboarding stopwatch test, 3 naive users | **Not verified** | This is a §3 D0 protocol activity, not a code change — must be run once real participants are recruited; do not mark done from code alone. |
| No fake numbers anywhere pre-calibration | **Out of scope this round** | Addressed in the 2026-07-16 beta-P0 round (fake-goals removal) per STATUS.md; not touched by Workstreams 1-6. |
| Web-push opt-in + all 4 notification types; max 1/day; opt-out ≤3 taps | **Done this round** (infra) | Workstream 1 completed the missing half: Vercel env vars set, `push-send-cron` smoke-tested 503→200 in production. Real end-user opt-in flow across all 4 notification kinds not walked this round. |
| Streak: any-log counts; Rest Day preserves; repair ticket applies + disclosed at D1 | **Done** (prior round) / **Extended this round** | Streak redefinition per 2026-07-15 STATUS.md; this round's Workstream 2 adds an explicit Rest Day flow to `/workout` with "streak continues" copy shown at the point of choosing Rest Day (not specifically D1 — that disclosure timing was not re-verified). |
| Photo failure paths (blur/packaged/mixed-dish) | **Out of scope this round** | Not touched by Workstreams 1-6; P1 per the roadmap's §11 matrix. |
| AI quotas enforced; quota-hit UX has manual-entry exit | **Done** (prior round) | Per 2026-07-15 STATUS.md (P0 #3). Not touched this round. |
| IRB access-log failures alert (not silently swallowed) | **Fails today (verified)** | `app/api/research/export/route.ts:90` and `app/api/research/participants/route.ts:60` both do `(svc as any).from('researcher_access_log').insert(logEntry).then(() => {})` — no `.catch()`, no alerting, and the export/participants response proceeds regardless of whether the audit-log insert succeeded. This is a genuine gap against the checklist item, confirmed by reading the code on 2026-07-21, not a "todo" left unconfirmed. Not fixed by this round (out of Workstreams 1-6 scope) — recommend addressing before beta open given it's an explicit P0 beta-gate item. |
| Accessibility: WCAG-AA, 130% large-text reflow, ≥44px targets | **Not verified** | Not audited this round for the new surfaces (`SessionStart`, `SusSurveyCard`, `FeedbackButton`). Recommend a pass before beta open, especially on `SessionStart`'s chip grids and `SusSurveyCard`'s 10×5 Likert grid. |
| i18n: no mixed-language surface on the EN path | **Partially covered this round** | All new i18n keys (session-start, SUS, feedback) added in ja+en in the same commit per this round's own discipline; the SUS **ja translation is the author's own rendering, not a validated academic Japanese SUS translation** — flagged in the code (`lib/sus.ts`/`lib/i18n.ts` comments) and here for advisor review before relying on it for publication-quality data. |
| Self-delete cascade re-verified post-schema-changes | **Not verified** | Migration 019 adds `beta_feedback` with `ON DELETE SET NULL` (intentionally not CASCADE, see §6) and `sus_responses` with CASCADE (matches the existing pattern). The cascade path was not re-run end-to-end this round. |
| lint/vitest/build green, prod smoke before invite links | **Done this round** | `npm run lint` (0 errors), `npx vitest run` (370/370), `npm run build` all green after Workstreams 1-6 combined. Prod smoke limited to the `push-send-cron` endpoint (Workstream 1); a full prod smoke walk of the new `/workout` session-start flow and `/api/sus`/`/api/feedback` was not performed as part of this document. |

## 8. Open items requiring advisor/IRB input before beta opens

1. IRB protocol number/reference (§1).
2. Recruitment channels and target N confirmation (§2) — 15-30 is a proposal,
   not a decision.
3. Timeline dates (§5).
4. `beta_feedback.user_id ON DELETE SET NULL` disclosure adequacy (§6).
5. `researcher_access_log` write failures are currently silent
   (`.insert(...).then(() => {})`, no `.catch()`, in both `/api/research/
   export` and `/api/research/participants`) — a verified gap against the
   §12 IRB-alerting checklist item, not fixed this round (§7 table).
6. SUS Japanese translation validation (§7, i18n row).
