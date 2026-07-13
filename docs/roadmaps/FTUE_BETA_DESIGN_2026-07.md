# FTUE & Public Beta Experience Design — 2026-07-14

**Status**: Design (no code). Successor-refinement of
[REDESIGN_ROADMAP_2026-07.md](./REDESIGN_ROADMAP_2026-07.md); grounded in
[../research/COMPETITIVE_STUDY_2026-07.md](../research/COMPETITIVE_STUDY_2026-07.md)
and two same-day codebase audits (§1).

**Scope**: first-time user experience (FTUE), AI-trainer session flow, meal-scan
v2 UX, social-media landing, retention D1–D30, no-dark-pattern rules,
accessibility, research evaluation plan, and a consolidated P0/P1/P2 matrix.

**Locked decisions honored throughout** (from the 07-13 roadmap):
deterministic engine decides / LLM narrates only; training environment asked
every session (never a permanent Home/Gym profile); per-user daily AI quotas;
calibrated ±ranges on every AI-derived number.

**Priority note**: §11's matrix *refines, and where it conflicts supersedes,*
the 07-13 roadmap's P0 ordering. Two newly discovered bugs (consent-skip race
§1.2, recommendation_feedback pipeline gap §1.6) jump to the front of P0 —
they are research-ethics / research-validity issues, ahead of all feature work.

---

## 1. Ground truth: current-state audit (2026-07-14)

Two codebase explorations (first-run flow; workout/photo/engagement/research
surfaces). **Fact** unless labeled otherwise; file paths cited.

### 1.1 First-run flow — no onboarding exists

- **No onboarding, no profile wizard, no welcome/tutorial anywhere**
  (grep-confirmed across `app/`).
- Entry (`proxy.ts`, `app/login/page.tsx`): no-cookie visitor → `/login?next=…`.
  Guest = 1 click ("Continue without an account →", sets `dt-guest=1`).
  Google OAuth + magic link offered. Guests reach the app with zero data entry
  — good bones for guest-first FTUE.
- No profile setup path: sex/height/age/goal/activity live only in
  `app/settings/page.tsx`, reachable on mobile only via the dashboard gear
  (Settings is NOT in BottomNav). The 推奨値 button is gated on age being
  entered first.

### 1.2 🔴 Consent-skip race (P0, research ethics)

`app/consent/page.tsx` is a JA-only research-ethics wall (研究参加同意書),
but the proxy forces it **only for authed users who already have a `profiles`
row with `consented_at IS NULL`. Nothing inserts a profiles row on signup**,
so a brand-new OAuth user's first authed visit likely SKIPS consent entirely;
"後で決める" also bypasses silently. Minors→guest exit works (ADR-004).
This is a research-validity + ethics bug: data could enter study tables from
never-consented accounts. **Fix = insert profiles row at signup (trigger or
callback) + proxy treats missing-row as unconsented.**

### 1.3 Dashboard zero-data state — fake numbers

`app/page.tsx`: **hardcoded fake goals `{2000 kcal, 150P, 60F, 200C, 2000ml}`
rendered as real targets** ("残り 2,000 kcal") with no placeholder indication —
a direct trust killer for the "honest numbers / ±range" positioning.
TdeeCard returns `null` for guests AND zero-history users (renders nothing —
invisible instead of explaining itself). RecommendationCard guest state = login
prompt. Meal empty state = text-only. PwaInstallBanner + MigrationBanner stack
noise on the first screen (iOS banner fires 3 s after first load, JA-only).

### 1.4 Add-food & photo scan

`app/add/page.tsx`: default tab 写真; flow = dropzone → preview → "AIで解析" →
auto-fills FoodEntryForm (`source:'ai'`, one-shot green confidence banner) →
save. `analyze-food` IS `guardAiRoute`'d; prompt asks JSON-only single serving;
parse = regex first-`{...}` + `JSON.parse` (500 echoes raw text on miss).
**No dedicated result screen; no retry button; confidence is discarded on save**
(only `source:'ai'` persists). 4 MB/mime caps server-side.

### 1.5 Workout / plan split-brain

`app/workout/page.tsx` (623 ln): header already says "AIコーチ". Ghost-text
foundation EXISTS: `getLastSession` + `suggestWeight` (+2.5 kg at ≥12 reps),
PR pills, per-muscle recovery dots, live Epley 1RM, RestTimer. 12 hardcoded
menus. **Split-brain**: the prospective AI coach (CheckInWidget
mood/energy/sleep/soreness → `/api/suggest-workout`) lives on `/plan`, not
`/workout`; `/api/coach` (retrospective) is a second persona; no
cross-reference. `suggest-workout` is UNGUARDED (intentional guest access,
inline limiter only) and its output is `JSON.parse`d without schema.
Form analyzer (`/form`, MediaPipe squat, per-rep scoring) reachable only from
desktop SideNav — orphaned on mobile; results never feed logs/PRs.
Workout delete = immediate, no confirm/undo.

### 1.6 🔴 Research infrastructure gaps (P0, research validity)

- **`recommendation_feedback` — the study's core signal — is written to
  localStorage ONLY (dual-write deferred), while the researcher dashboard +
  export read the CLOUD table → the study data pipeline is broken end-to-end.**
- `study_cohort` column exists but there is NO assignment/randomization code
  (manual SQL only).
- **No questionnaire/survey surface at all** (no SUS/UEQ/Likert anywhere) —
  the XAI-acceptance study has no subjective instrument.
- IRB access log is write-only; failures silently swallowed (no alerting).
- `/research` dashboard is URL-only (no nav entry).
- Self-delete cascade works (verified 07-05).

### 1.7 Engagement & notifications

- Streak = consecutive days with a FOOD entry only (today-grace); workouts /
  water / weight don't count → under-credits workout-first users.
- Badges: streak3/7/30, water_goal, calorie_goal, workout_master (≥5/7 days),
  dynamic pr_achieved.
- Weekly report = **5 Gemini calls** (4 specialist agents + orchestrator;
  weekScore = cal 30 / protein 25 / workout 25 / water 10 / streak 10;
  422 under 2 days of data).
- **Notifications: ZERO** — no Notification API, no push; engagement is fully
  pull-based. Retention design must not assume push until the web-push P0 lands.
- Telemetry = 3 trends-view events, localStorage-only dead-end (cap 500).

### 1.8 Nav & i18n

- BottomNav = ホーム/ログ/追加/ワークアウト/プラン/体重 (6 tabs; no Settings, no
  Form). Desktop SideNav adds フォーム+設定. Conflicts with the roadmap's
  4-tab target.
- i18n: default ja; `<html lang>` DOES switch client-side post-hydration
  (LanguageProvider useEffect) — the 07-13 roadmap §6 item "fix `<html lang>`"
  is **stale**. Real gap: consent / TdeeCard / RecommendationCard / settings
  labels are JA-hardcoded → EN users hit mixed-language surfaces.
- PWA: manifest ok but `screenshots: []` (weak install sheet).

---

## 2. FTUE critical path & 12 drop-off points

Design principles: **value in <60 s**; guest-first (account creation is
re-pitched Day 2–3 as "protect your data" — data-gravity inverted); every
number honest (no fake defaults, ±ranges, 仮 labels until calibrated).

Critical path: SNS LP → PWA install → guest entry → (consent if authed) →
60-s onboarding → first AI meal scan → first workout → Day-2 weight log →
daily dashboard → Day-7 first week report.

| # | Stage | Drop-off risk | Countermeasure |
|---|---|---|---|
| D1 | Install (PWA via SNS LP) | "not in the app store" confusion | LP video of ホーム画面に追加 (per-OS) |
| D2 | Entry | login wall | guest-first: `dt-guest` as the PRIMARY button; account creation deferred until after the value moment |
| D3 | Consent 18+ | legalese feel, abandonment | plain-language summary first, full text below; "30秒で終わります" expectation set |
| D4 | Onboarding | too many inputs | 60 s total, **4 chip questions only** (goal / birth+sex+height+weight / experience / today's environment); all chips, skippable with explicit defaults |
| D5 | Post-onboarding numbers | "so what?" | immediately generate TDEE + target + first workout, each with a 1-line WHY from the safety engine |
| D6 | First AI meal scan | no meal at hand | offer: schedule a lunch reminder OR run a sample-photo demo scan |
| D7 | First scan result | mistrust of AI guess | candidate chips + ±range + worded confidence; correction ≤3 taps (§5) |
| D8 | First workout | unreadable exercise names | GIF + "why for you" line + swap button on every exercise |
| D9 | First workout length | too long, quits mid-session | first session forced to 15–20 min / 4 exercises; completion above all |
| D10 | Day-2 weight log (morning push) | "why weigh daily?" | teach weekly-average framing (daily water noise) up front, at the moment of first ask |
| D11 | Daily dashboard | empty cards = dead app feeling | every zero-data card morphs into a single next-action CTA (§3.2) |
| D12 | Day 7 / broken streak | despair, uninstall | recoverable streaks: 1 weekly repair ticket, **visible from day 1**; Day-7 "first week report" affirms partial streaks |

**Day-7 first week report** contents: days logged, first PR, first TDEE
estimate with confidence wording, and exactly ONE suggestion for next week.

Additional FTUE fixes from the audit (fold into the same work): kill fake
default goals (§1.3), consent-race fix (§1.2), Settings reachable from
mobile, banner noise deferred until after the value moment, TdeeCard becomes
a "why nothing yet + what to do" progress card instead of `null`.

---

## 3. Journey map: install → D7 → D30

### 3.1 Timeline

| Day | Moment | What the app does | What the AI says (LLM narrates, engine decides) |
|---|---|---|---|
| 0 | LP → install → guest | UTM-personalized LP (§6), 60-s onboarding, first scan or demo | 1-line WHY for TDEE/target/first workout |
| 0 | first log | streak lit; mechanics disclosed incl. repair ticket; goals carry 仮 badge | "tomorrow: one morning weigh-in" (single next action) |
| 1 | morning push (post web-push) | env question or weigh-in nudge | weekly-average framing for weight |
| 2–3 | account re-pitch | "protect your data" framing (data gravity inverted) | — |
| 3 | 3/4 days logged | streak3 badge; first TDEE revealed labeled 信頼度低 | "代謝の輪郭が見え始めた（誤差大）" |
| 7 | first week report (always fires) | days logged, first PR, TDEE + confidence, ONE suggestion; partial streaks affirmed ("5/7日は立派") | TDEE→goal adjustment PROPOSAL (2,000→1,850), approval-only, never auto |
| 14 | decay check (rule: ≤1 log in last 4 days) | auto-apply repair ticket; propose goal shrink ("今週は1日1記録だけ") without calling it failure; SUS survey card (§10) | "間が空くのは普通。水だけ記録？" |
| 30 | monthly report | streak30 + monthly heatmap (non-shaming palette); TDEE confidence high → formal goal adoption + next-4-week plan (approval-gated); UEQ-S card | narrates the journey 仮の数字 → 2,150±80 |

### 3.2 Empty states → CTAs (D11 expanded)

- Dashboard: never show fake 2,000 kcal → "あなたの目標をまだ知りません" +
  60-sec setup CTA.
- Meal list: single verb-button "📷 最初の1枚を撮ってみる".
- TdeeCard `null` → progress framing "あと3日分の記録で代謝が見えます（いま1/3日）".
- Trends: ghost sample graph "1週間後ここにあなたの線が引かれます".

---

## 4. AI personal trainer: session-start flow

No permanent Home/Gym setting. Profile stores only **equipment presets** per
location. **Merge `/plan`'s CheckInWidget into this flow** (energy/soreness
questions already exist — reuse, don't rebuild); retire the `/plan` vs
`/workout` split-brain (§1.5).

Every session:

1. **「今日はどこ？」** chips: Home / Gym / Hotel Gym / Outdoor / **Rest Day**;
   default pre-selected from history + weekday. Rest Day → affirmed as a
   correct choice, stretch/walk suggestion, **streak preserved**, flow ends.
2. **Time** chips: 15 / 30 / 45 / 60+.
3. **Equipment preset** for that location shown, chip-editable, remembered.
4. **Energy** 3-way 😫🙂🔥.
5. Optional **soreness/injury body-map** tap.
6. **Deterministic engine** (no LLM): exclude by equipment + contraindication +
   pain report → per-muscle recovery from recent logs → prioritize deficient
   movement patterns → energy low = −1 volume/intensity step, high = +1
   challenge set → trim lowest-priority exercises to fit time → superset
   antagonists if time-tight.
7. **LLM renders the WHY** from the actual score components (template-grounded;
   cannot contradict the engine): 「昨日は脚の日だったので、今日は自宅の
   ダンベルでできる上半身メニューにしました…」.
8. **In-session**: per-exercise why-badge + swap button. Swap re-runs the
   engine (same movement pattern, no LLM call — free and instant).

Existing assets to keep: ghost-text last-session prefill, `suggestWeight`
progression, PR pills, recovery dots, Epley 1RM, RestTimer (§1.5).

---

## 5. Meal-scan v2 UX

### 5.1 Result card (new dedicated screen — currently auto-fills a form, §1.4)

- **Candidate chips**: top-1 + 2 alternates.
- **Portion** S/M/L + reference hint (e.g. 茶碗1杯).
- Numbers **ALWAYS as ±range**: "≈650 ± 120 kcal", P/F/C likewise.
- **Confidence in words**, 3 levels (not %).
- Persistent **violet AI-provenance badge** (existing `--ai` token family).
- **Persist confidence + range into the log entry** (currently discarded).

### 5.2 Correction ≤3 taps

- Chip switch → food-DB recompute, **no LLM call**.
- "どれでもない" → 1-line text through the same structured pipeline.
- Corrections feed an **anonymous consented dataset** (accuracy flywheel +
  research; separate explicit consent, §10).

### 5.3 Failure fallbacks (no dead-end screens)

1. **Mixed dishes** (鍋/カレー/定食トレー): "multiple dishes" split-proposal
   chips per plate, OR single log with 2× widened range + low confidence.
2. **Bad lighting/blur**: honest low confidence + retake prompt with a framing
   hint; **retake does NOT consume quota**.
3. **Packaged/コンビニ food**: refuse photo guessing; route to barcode (free)
   or product-name text.

Common rules: manual-entry exit always ≤1 tap; low-confidence logs enter a
**「確認待ち」list** for later 1-tap fix; add a retry button on API failure
(currently absent); never echo raw server errors.

---

## 6. Social landing & notifications

### 6.1 IG/TikTok landing (P1 — deliberately held until FTUE is fixed, §11)

- **UTM-personalized LP**: the creative that brought the user IS the first
  screen (scan-ad → "撮ってみて"; workout-ad → environment chip).
- No registration wall: 「今すぐ試す（登録不要）」 = guest mode as primary CTA.
- 10-sec autoplay demo of a scan result **WITH the ±range** on the LP; trust
  line 「数字は言い切りません」 = anti-Cal-AI positioning stated pre-install.

### 6.2 Share / achievement moments (P1)

- First-scan / first-PR / week-1 vertical (9:16) share cards.
- **Health numbers OFF by default** in the shared image (dish + estimate only);
  sharing always opt-in.
- Confetti reserved for firsts + PRs only.

### 6.3 Notification copy (post web-push P0)

- Morning: environment question. Lunch: first-scan nudge (once ever).
- Evening: 「1つだけ記録？」 — max 1/day, only if nothing logged.
- Streak-protection: eve-only, repair-first framing.
- **Banned**: guilt copy, multi-sends, buried opt-out.
- Until web-push lands, D1–D7 retention leans on in-app moments + PWA install
  + email-less patterns (Fact: zero notification infra today, §1.7).

---

## 7. Retention D1–D30 & streak redefinition

**Streak redefined = any-log day** (food OR workout OR weight OR water) — the
current food-only rule under-credits workout-first users (§1.7). Rest Day
logged = streak kept. **1 weekly repair ticket**, visible from day 1.

| Checkpoint | Trigger | Intervention (exactly ONE next action) |
|---|---|---|
| D1 | first log | streak lit + mechanics disclosed incl. repair ticket; goals stay 仮-badged; AI: tomorrow = one morning weigh-in |
| D3 | 3/4 days logged | streak3 badge; first TDEE revealed, labeled 信頼度低; AI: "代謝の輪郭が見え始めた（誤差大）" |
| D7 | always fires | weekly report affirms partial streaks; TDEE→goal adjustment PROPOSAL (approval-only, never auto); ONE suggestion |
| D14 | decay: ≤1 log in last 4 days (rule-based until adherence-prediction P1) | auto-apply repair ticket; propose goal shrink without failure framing; AI: "間が空くのは普通。水だけ記録？" |
| D30 | monthly | streak30 + heatmap (non-shaming palette); TDEE confidence high → formal goal adoption + next-4-week plan (approval-gated); AI narrates 仮の数字 → 2,150±80 |

Principles: every intervention = exactly ONE next action; compare only to the
user's past self; no social comparison anywhere.

### 7.1 No-dark-pattern checklist

1. **No loss-threat framing** (❌「ストリークが消えます」 ⭕「あと1記録で継続」);
   the repair option is always shown first.
2. All goal / notification / sharing changes are **explicit-approval**; "No"
   costs the same taps and has the same visual weight as "Yes".
3. Notification-off, data-wipe, account-delete each **≤3 taps**, zero
   guilt-trip interstitials (keep the existing APPI/GDPR self-delete cascade).

---

## 8. Accessibility 5-pack

1. **Jargon-free exercise naming** — 「もも裏を鍛える種目（RDL）」pattern +
   GIF + easier-variation button everywhere.
2. **Large-text 130% tier** (beyond the existing 112.5%) + reflow tests;
   ≥44 px touch targets; steppers over keyboards; button alternatives to all
   gestures.
3. **Non-judgmental design** — kill red 「オーバー⚠️」; weight-hide toggle;
   no BMI badges; past-self comparison only.
4. **Machine-first mode** for gym novices + Home as the default first
   environment (lowest-intimidation path).
5. **i18n completion** of JA-hardcoded surfaces (consent / TdeeCard /
   RecommendationCard / settings) + aria + WCAG-AA on all new surfaces.
   (Note: `<html lang>` already switches client-side — roadmap §6 item stale.)

---

## 9–10. Research evaluation plan

### 9. Anonymous consented metrics (event-level; no free text/images — the
correction dataset is under separate explicit consent)

- **Meal AI**: top-1/top-3 acceptance, correction rate + kcal delta, ECE
  (calibration), retake rate, time-to-log.
- **Workout**: completion rate, swap rate, why-badge taps,
  accept/modify/reject, Rest-Day rate.
- **Recommendations**: accept/reject/♡ — **requires the dual-write fix (§1.6)**.
- **Retention**: D1/7/30, streak distribution, repair-ticket use, notification
  opt-in/CTR.
- **Usage**: photo:manual ratio, tab reach, quota hits.

### 10. Subjective instruments

- **SUS @ Day 14**, delivered as a card in the weekly report (2 min,
  skippable, never interrupts logging, max 1 re-show).
- **UEQ-S @ Day 30** in the monthly report + at exit survey.
- P2: Hoffman Explanation Satisfaction Scale for the XAI A/B (paper #1).

Prerequisites (all P0, §11): recommendation_feedback dual-write, cohort
auto-assignment (replacing manual SQL), an in-app questionnaire surface,
consent-race fix, IRB-log failure alerting.

---

## 11. Consolidated P0/P1/P2 matrix

Refines — and where it conflicts, **supersedes** — the 07-13 roadmap's P0
ordering. P0 criteria: research-ethics/validity, first-run trust, or technical
prerequisite. Explicit change vs 07-13: **consent-skip race fix and
recommendation_feedback dual-write jump to the front**, ahead of the
suggest-workout guard that previously led.

### P0

1. 🔴 Consent-skip race fix — profiles row inserted on signup; missing row
   treated as unconsented (§1.2).
2. 🔴 `recommendation_feedback` dual-write to Supabase (§1.6).
3. `suggest-workout` behind `guardAiRoute` + durable per-user `ai_usage`
   quotas (carried from 07-13).
4. Kill fake default goals + 60-s 4-chip onboarding (§2 D4–D5).
5. Empty states → single next-action CTAs (§3.2).
6. Streak redefinition (any-log) + weekly repair ticket (§7).
7. Web push (notification infra is zero today, §1.7).
8. Gemini `responseSchema` migration ×6 call sites (carried from 07-13).
9. Session-start flow: env/time/equipment/energy — CheckInWidget merged from
   `/plan` into `/workout` (§4).
10. Cohort auto-assignment + SUS questionnaire surface (§10).

### P1

Photo v2 result card (chips + ±range + confidence persistence + retry);
LLM narrative why-badges (template-grounded); approval-gated adaptive goals;
failure-case fallbacks (mixed-dish split / retake / barcode); accessibility
pack (§8); 9:16 share cards; UTM-personalized LPs; JP food DB ~500 washoku
(pg_trgm); D14 decay rule + monthly heatmap; UEQ-S + IRB-log failure
alerting; form-analyzer mobile entry + link results into logs/PRs.

### P2

Per-user τ; bandit affinity; washoku eval set + calibration study; XAI
satisfaction A/B (Hoffman scale); chronotype nudges; wearables; voice
logging; additional form analyzers.

**Deliberate call**: social-acquisition items (LP, share cards) held at P1 —
do not scale inflow before the first-run experience is fixed.

---

## 12. Beta testing checklist

Gate for opening the public beta (all P0 above, plus):

- [ ] Consent flow verified for ALL entry paths (fresh OAuth, magic link,
      guest→account migration) — no skip path remains.
- [ ] recommendation_feedback rows land in Supabase from a real session
      (SQL-verified, like the 07-05 smoke test).
- [ ] Cohort auto-assignment randomizes on first consented session; balance
      checked after first 20 users.
- [ ] SUS card renders at D14 in a seeded-clock test; skippable; ≤1 re-show.
- [ ] 60-s onboarding: stopwatch test with 3 naive users (target median <90 s
      real-world).
- [ ] No fake numbers anywhere pre-calibration (audit every card for 仮 badge
      or honest empty state).
- [ ] Web-push opt-in flow + all 4 notification types fire correctly; max
      1/day verified; opt-out ≤3 taps.
- [ ] Streak: any-log day counts; Rest Day preserves; repair ticket applies
      and is disclosed at D1.
- [ ] Photo failure paths: blur → retake (no quota burn); packaged →
      barcode/text route; mixed dish → split chips. No dead ends.
- [ ] AI quotas enforced per user per day; quota-hit UX has a manual-entry
      exit.
- [ ] IRB access-log failures alert (not silently swallowed).
- [ ] Accessibility: WCAG-AA pass on new surfaces; 130% large-text reflow;
      ≥44 px targets.
- [ ] i18n: no mixed-language surface on the EN path.
- [ ] Self-delete cascade re-verified post-schema-changes.
- [ ] `npm run lint` clean, vitest green, `npm run build` green, prod smoke on
      Vercel before invite links go out.
