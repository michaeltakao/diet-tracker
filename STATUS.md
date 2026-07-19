# STATUS — diet-tracker

## Now
- **2026-07-19 COMPETITOR IMPORT PHASE C: month calendar, training charts,
  lipid/HbA1c vitals** — migration **017 in prod** (vital_logs +5 columns
  total_chol/ldl/hdl/triglycerides_mg_dl + hba1c_percent NUMERIC(3,1);
  kind_check + kind_shape CHECKs dropped+recreated for 4 kinds — constraint
  names verified live against prod first via pg_constraint query, existing
  BP/glucose rows passed the recreated XOR CHECK on ADD). `lib/calendar.ts`
  (monthGrid Mon-start weeks via lib/streak.ts shiftDate/weekStartOf,
  shiftMonth) + `lib/workout-analytics.ts` (volumeByBodyPart exact-from-
  setDetails-else-scalar-fallback, exerciseProgressSeries topWeight+est1RM
  via onerm, weightedExerciseNames). `components/MonthCalendar.tsx`: dots
  colored by CATEGORY_META.ring from the same per-category date-set
  derivation as dashboard-data.ts; day-tap jumps /log's weekly view to that
  week+day (verified -2w offset + correct selected-day header). `/log`
  gained a 3rd `month` tab (?view=month deep link); TrendsPanel gained a
  training section (VolumeByBodyPartChart week/month toggle bar +
  ExerciseProgressChart picker with topWeight/est1RM dual-line, both
  Recharts lazy) and lipid/HbA1c chart wiring (VitalsChart.tsx: LipidChart
  4-series connectNulls, Hba1cChart); TrendsPanel empty-state gate widened
  to include workout/vitals-only users (was food/weight-only, would have
  hidden the new sections). Vitals page: 4-way segmented control (🫀🩸🧈🅰️),
  bounds mirror the new SQL CHECKs (optional LDL/HDL/TG — lipid anchor is
  total cholesterol only), history rendering for both new kinds. Types:
  LipidPanelEntry + Hba1cEntry into the VitalEntry union; lib/data/vitals.ts
  mirror extended. i18n ja+en ×15. Verified: lint + **301 vitest** (11 new
  calendar/workout-analytics) + build; Chrome :3199 — lipid entry (TC210/
  LDL130/HDL55/TG95) + HbA1c 5.8 round-trip through localStorage and
  history display, month grid 35 cells w/ correct dot-per-category count,
  volume-by-part bars + est1RM progression line (87.3 for a seeded
  65kg×8 set, matches Epley by hand), week/month toggle. Same dev-SW
  stale-chunk gotcha as phases A/B; additionally hit a `.next` deleted
  out from under a still-running dev server → 500s (killed stale PID
  before restarting — general lesson: always confirm no listener on the
  port before `rm -rf .next`). Next: Phase D (manual steps, sleep
  bed/wake + weekly chart, 90-day weight forecast, migration 018).

- **2026-07-19 COMPETITOR IMPORT PHASE B: workout (exercise DB / per-set
  logging / env-aware AI)** — migration **016 in prod** (workout_logs
  .set_details JSONB + personal_records.est_1rm; JSONB kept over roadmap's
  workout_sets table to preserve the 1:1 dual-write mirror, ADR-007;
  database.types.ts regenerated). `lib/exercise-db.ts`: 60 static
  ExerciseDef (10×6 parts, ja+en, equipment 5-way, isCompound); the 12
  RECOMMENDED_MENUS moved in as `recommended` entries — workout page now
  derives its menus via a CoachMenu adapter (nameJa = canonical logging
  name, PR/history back-compat) + collapsible full-DB picker w/ equipment
  tags. `lib/workout-sets.ts`: summarizeSets (weight=top set, reps=AT top
  weight, volume, best1RM via onerm) + nextSetSuggestion (≥12reps→+2.5kg).
  Workout page per-set mode: toggle seeds rows from scalars, ±2.5 steppers
  (display unit), ghost placeholders from last session's setDetails,
  add/remove rows, live best-set 1RM; submit derives scalars via
  summarizeSets, persists setDetails + passes est1RM into checkAndUpdatePR
  (weight stays the sole PR/celebration trigger; est_1rm mirrored);
  completed list shows per-set breakdown + 総挙上量. suggest-workout route:
  validated environment/equipment fields → 【トレーニング環境】 prompt
  block. `lib/data/workout-prefs.ts` (localStorage-ONLY, documented) +
  CheckInWidget env/equipment picker (equipment shown for home), sent with
  fetchSuggestion. i18n ja+en ×17. Verified: lint + **290 vitest** (13 new)
  + build; Chrome :3199 — 60×10/65×8/65×6 → entry {weight:65, reps:8,
  sets:3, setDetails ✓}, PR {maxWeight:65, est1RM:82.3}, breakdown line +
  1510kg volume, PR toast; home+dumbbell prefs persisted → request body
  carried them → suggestion returned 「下半身と背中の自宅トレーニング」;
  old scalar entries render unchanged. Same dev-SW stale-chunk gotcha as
  phase A (unregister before verifying). Next: Phase C (month calendar,
  training charts, lipid/HbA1c vitals, migration 017).
- **2026-07-19 COMPETITOR IMPORT PHASE A: food logging (barcode / label OCR /
  AI nutritionist / sodium+fiber)** — lights up the dormant migration-009
  columns. New pure libs: `lib/off.ts` (OFF v2 normalize: `energy-kcal_100g`
  required, `sodium_100g` g→mg, `salt_100g`÷2.54 fallback, numeric-string
  coercion, brand/servingG) + `lib/micros.ts` (sumSodiumFiber lower-bound
  sums, 厚労省 targets 塩<7.5/6.5g・繊維≥21/18g, sex-unset→mean). Routes:
  `/api/product-lookup` (POST, guardAiRoute off-label w/ tokens=0 rows,
  SSRF-safe constant-URL OFF fetch, 5s timeout, 30/min+300/day),
  `/api/analyze-label` (analyze-food clone; transcribe-not-estimate prompt,
  basis per100g|perServing + servingG + salt→sodiumMg conversion),
  `/api/nutritionist` (exactly-3 suggestions on TODAY's actual meals,
  strict body validation, scope-guarded vs /api/recommend). UI:
  `BarcodeScanner` (native BarcodeDetector → dynamic-import `@zxing/browser`
  fallback — verified NOT in eager chunks), PhotoUpload `mode` prop +
  label result box, add-page refactor: **`applyBaseNutrition()` single
  prefill path** (AI photo/barcode/label) + `PortionBasis` per100g→amountG
  (servings×100g, servingUnit '100g') vs perServing→servings×servingG;
  submit carries source/sourceId/sodiumMg/fiberG through `scaleFood`;
  `prefilled` state keeps form visible for nameless labels. Dashboard:
  NutritionistCard (getRealGoals-gated) + sodium/fiber day row
  (with-data-only) + MealCard micros line. i18n ja+en ×19. Verified:
  lint + **277 vitest** (17 new off/micros) + build; Chrome MCP :3199 —
  OFF E2E (Nutella 200 normalized / 400 / 404), label canvas-image →
  exact transcription (1.27g salt→500mg), UI label flow prefill→2×
  scaling (exact from unrounded base)→entry {servings:2, servingUnit:
  '100g', amountG:200, source:'ai', sodiumMg:1000, fiberG:4.6}, day
  row+meal-line render, nutritionist 3 grounded suggestions (API+widget),
  429 at request 11. 403 gate not exercisable in dev (no APP_ACCESS_CODE)
  — guard identical to the 6 existing AI routes. **Gotcha: stale dev
  service worker on :3199 served old chunks (crash on new i18n keys) —
  unregister SW + clear caches when verifying; it's not Turbopack.**
  Next: Phase B (exercise DB, per-set logging, env-aware suggestions,
  migration 016).
- **2026-07-17 DESIGN PHASE 5: v0 dashboard integration (gamification
  layer)** — user's v0-generated Duolingo dashboard
  (`~/Downloads/duolingo-healthcare-dashboard`) translated onto our
  tokens/components with real-data adapters; all 13 existing dashboard
  blocks stay. New: fox token family in globals.css (`--fox` #ff9600 /
  `--fox-dark` / `--fox-soft` (theme-flips) / `--fox-text` #4a2800 — white
  on fox is 2.18:1 AA ✗, so banner text = dark brown, phase-4 precedent);
  `lib/dashboard-data.ts` adapter (pure `computeCategoryStats` — per-category
  meal/exercise/vital/symptom date-Sets reusing lib/streak week math, binary
  `todayPct` = logged/4; thin `getDashboardStats()` = streak + badgeCount
  (v0 gems) + repairAvailable 0/1 (v0 hearts) + weekly challenge);
  `components/dashboard/` StreakHeader (fox banner + stats pill; streak=0 →
  motivational copy; replaces the small header streak pill) / ProgressRing
  (4-segment binary SVG ring, 240px, real % in role="img" aria) /
  CategoryBadges (2×2 weekly n/7 tiles, ⭐ at WEEKLY_GOAL_DAYS=5, mini
  ProgressBar variants extended `fox|info|danger`; ProgressBar `bg-[#ff9600]`
  → `bg-fox`) + shared category-meta; WeeklyChallengeCard gains あとN日 chip
  (weekEnd − jstToday). i18n ja+en ×16 keys. **Discarded v0 files** (deps
  forbidden / superseded): ui/button, lib/utils(cn), layout, globals.css,
  package.json, public assets, mock dashboard-data + its 3 mock challenges
  (no data source). Verified: lint + **260 vitest** (8 new pure-math:
  JST Sun→Mon boundary, binary today, week counting) + build green;
  Chrome MCP on :3199 — ring aria 75% + segments [fill×3, track-only×1],
  banner computed #ff9600/#4a2800, captions 4/7·2/7·2/7·1/7日 vs seeded
  localStorage, streak=0 branch, light+dark screenshots; console clean of
  new-component issues (BadgeShelf key warning is pre-existing). Next:
  phase 6 (confetti/bounce animations), hero-card gradient decision,
  remaining off-grid sweep.
- **2026-07-17 DESIGN PHASE 4: Duolingo-style Button/Card/ProgressBar** —
  new `components/ui/Button.tsx` (primary/secondary/outline/ghost ×
  lg/md/sm; `href` renders next/link; Duolingo press mechanics = hard
  `0 4px 0` bottom edge → `translate-y-[2px]` + 2px edge on :active) and
  `components/ui/ProgressBar.tsx` (token track, brand/warning fill, optional
  gamified white overlay label — real value always via aria-value*).
  **Contrast corrections vs the pasted spec** (its math was wrong): primary
  fill = `--brand-strong` #378700 (white 4.54:1 AA ✓; spec's #46A302 is
  3.23:1 ✗), secondary fill = new constant `--info-strong` #2b70c9 (white
  4.93:1 ✓; dark-mode `--info` flips to macaw #1cb0f6 = 2.45:1, decor only —
  hence the new theme-constant token). `CARD_CLASS` → rounded-2xl (24px) +
  border-2; repo-wide `rounded-3xl`→`rounded-2xl` sweep (36 uses, 19 files)
  so every card sits on 24px; light `--shadow-card` → tight `0 2px 8px
  rgb(0 0 0 / 0.08)` (border carries the edge now). Swap-ins: dashboard
  goal-CTA, settings 保存, NudgeBanner CTA, PushPermissionCard,
  PushSettingsRow, WeeklyChallengeCard bar (stray `to-teal-500` killed).
  M PLUS Rounded 1c added via next/font (400/700/800, preload:false,
  unicode-range chunked) between Nunito and Hiragino → Windows gets rounded
  JP. Verified: lint + 252 vitest + build green; Chrome computed-style check
  (fill #378700, edge #225400, 16px radius, press rules compiled, bar
  aria 0/5 + h-6 + brand-500 fill) + light/dark screenshots. Next: phase 5
  dashboard relayout + remaining CTA/off-grid sweep
  (docs/design/SPACING_AUDIT_2026-07.md has post-phase-4 counts).
- **2026-07-17 DESIGN PHASE 3: 8px-grid spacing/radius tokens** — the pasted
  phase-3 spec was Tailwind-v3-shaped (tailwind.config.js spacing remap);
  repo is **v4** and a literal remap would silently re-mean 227 spacing
  usages + delete `rounded-2xl/3xl` (183 uses) + kill 369 fractional
  utilities → user chose the v4-native adaptation via AskUserQuestion.
  Shipped: `--space-1…8` tokens (4/8/12/16/24/32/48/64) in :root; radius
  scale snapped on-grid via @theme overrides (`rounded` 4→8, md 6→8, lg
  8→12, xl 12→16, **2xl 16→24, 3xl 24→32** — the rounder Duolingo look,
  intentional global visual change), `--radius-field` 14→16;
  `docs/design/SPACING_AUDIT_2026-07.md` = off-grid inventory (0.5×93,
  1.5×170, 2.5×82, 3.5×24, *-5×42…) with normalize-to mapping — phases 4/5
  burn it down file-by-file as components are redesigned. Verified: lint +
  252 vitest + build green; browser probe of computed radii (8/12/16/24/32)
  + --space-* live; screenshot eyeballed, no layout breakage.
- **2026-07-17 DESIGN PHASE 2: Nunito typography** — `app/layout.tsx` swaps
  Inter → Nunito via next/font (self-hosted, **variable axis 200–1000** per
  next/font docs recommendation instead of enumerating static 400–900 —
  covers the same weights in one smaller file), `--font-nunito` on `<html>`;
  `--font-sans` = Nunito → **rounded JP system fallbacks first** (Hiragino
  Maru Gothic ProN, then Hiragino Sans/Noto Sans JP/Yu Gothic) so Japanese
  text keeps the soft feel (Nunito has no JP glyphs). Palette-phase
  stragglers fixed in the same commit: viewport themeColor #22c55e/#16a34a →
  #58cc02/#131f24, manifest theme/background → #58cc02/#f7f7f7, icon +
  apple-icon gradients → feather ramp. Verified: lint + 252 vitest + build
  green; browser check — computed h1 font = Nunito + Maru Gothic chain,
  variable font `Nunito 200 1000 loaded` in document.fonts, screenshot
  eyeballed (rounded latin/digits, JP in maru-gothic). Dev-SW stale-CSS
  gotcha hit again — unregister SW before browser-verifying.
- **2026-07-17 DESIGN PHASE 1: Duolingo-inspired color palette** (user-driven
  6-phase design migration; phases 2–6 = Nunito font / 8px spacing / component
  redesign / vertical-card dashboard / confetti+bounce animations, each its
  own commit). Token-level swap in `app/globals.css`: brand ramp → feather
  green (#58cc02, 50–900), neutral polar surfaces + eel-gray text (was
  slate/blue-cast), semantic accents re-hued (info #2b70c9 humpback / danger
  #e02b2b cardinal-dark / warning bee-tint soft / --ai #8549ba purple), dark
  mode → deep blue-green night surfaces (#131f24/#202f36) with brighter
  accents (#79d633/#1cb0f6/#ce82ff). `--brand-strong` now = brand-700
  (#378700, the only ramp step with AA white text). **WCAG-AA held**: all 17
  text-bearing token pairs computed ≥4.5:1 (script in commit message era —
  fg 11.0 / muted 7.2 / faint 5.0 / semantics 4.5–5.7 light, 4.6–12.8 dark).
  Sweep: 92 hardcoded `emerald-*` → `brand-*` (17 files, repo token rule),
  `green-*` in plan/settings → brand, brand+teal mixed gradients unified to
  brand ramp (page/workout/weight), 15 emerald rgba shadows → rgb(88 204 2).
  Report/vitals teal accent family left intact (phase-4 decision). Verified:
  lint + 252 vitest + build green; browser light+dark screenshots on dev
  :3199 (SW-unregister needed — dev SW served stale CSS, known gotcha).
  **⚠️ trade-dress note**: palette is "Duolingo-inspired", not a 1:1 clone;
  flagged to user that full trade-dress cloning is a legal risk for a public
  beta — raw #58CC02 fills keep dark/white text decisions to phase 4.
- **2026-07-17 COUNCIL REVIEW FIXES (#1/#2/#5)** — post-`93740eb` council run
  (Claude-only; **Gemini/Copilot legs returned empty** — known [🔒user]
  blocker: Gemini CLI IneligibleTierError, Copilot account has no GPT model)
  found 2 Medium + 1 Low, all fixed: **#1** endpoint validation is now an
  **allowlist** of real push services (new `lib/push-endpoint.ts`:
  googleapis / mozilla autopush / mozaws / notify.windows / push.apple;
  closes arbitrary-public-host SSRF beacon AND the DNS-rebinding hypothesis;
  22 adversarial vectors unit-tested incl. decimal/hex loopback + suffix
  spoofs); **#2** push-send no longer burns the JST day on total delivery
  failure — subs-select moved BEFORE the dedupe insert (subscription-less
  call never inserts) and `counts.sent === 0` best-effort deletes the dedupe
  row (accepted trade-off: tiny double-send window under concurrency beats
  losing a day to one FCM blip); **#5** sw.js `notificationclick` gains a
  same-origin guard (off-origin/unparseable URL → '/') so the SW is
  independently safe, not transitively via server payload construction.
  Council also confirmed clean: RLS/policies, 401-first, push-phishing
  structural guard, service-role scoping, JST boundary (15:00Z roll).
  252/252 vitest (+22), lint+build green, anon probes still 401.
- **2026-07-17 P0 #7 SECOND HALF DONE: Web Push notifications (frontend + API)**
  — nudges now reach opted-in users with the app closed. Migration **015
  applied to prod**: `push_subscriptions` (endpoint UNIQUE, RLS owner policy)
  + `push_send_log` (PK `(user_id, sent_date)` = atomic max-1-nudge/JST-day —
  server-enforced, the localStorage marker is courtesy only). New
  `lib/push-send.ts` (DI core: `buildNudgePayload` from NUDGE_TEMPLATES +
  translations — payload 100% server-built, client controls only two enums =
  push-phishing guard; `sendPushNotifications` never throws, 404/410 →
  subscription self-heal delete, logs endpoint host only). `public/sw.js`
  +`push`/`notificationclick` handlers (focus-or-open same-origin). New
  `lib/push-client.ts` (subscribe/unsubscribe/`maybeSendSelfPush`; unsupported
  detect hides everything on plain iOS Safari). API: `POST/DELETE
  /api/push-subscribe` (401-first — never 403 so httpClient's access-code
  prompt can't fire; endpoint validated https/public-host/length = SSRF
  hygiene; **service-role upsert ON CONFLICT (endpoint)** so shared-device
  account switches rebind the row — user_id always session-derived; DELETE =
  RLS client, idempotent) + `POST /api/push-send` (env fail-closed 503 →
  enum-validate 400 → in-memory 10/min 429 → `push_send_log` insert-first
  23505 = already-sent-today → RLS-select own subs → lazy `setVapidDetails`
  → fan out). UI: `PushPermissionCard` on dashboard (authed + supported +
  permission=default only; explicit opt-in, sticky dismissal) +
  `PushSettingsRow` in /settings (permanent re-entry: on/off/denied/iOS-note
  states); `NudgeBanner` fires `maybeSendSelfPush` when a nudge is decided
  (client-triggered send-to-self validates the pipeline E2E until a server
  cron exists). Deps: `web-push` + `@types/web-push` (npm audit: the 2
  moderates are pre-existing @google/genai→protobufjs + eslint→js-yaml, not
  from web-push). i18n +10 keys ja/en. 17 new vitest (DI + vi.fn, repo idiom —
  no vi.mock). **Future server cron design**: `vercel.json` crons +
  CRON_SECRET-gated service-role route reusing `sendPushNotifications` +
  `push_send_log`; iOS requires Home-Screen install (unsupported-detect
  already handles it).
- **2026-07-16 BETA-P0 COMPLETION + HEALTH-LOG ROUND DONE (7 workstreams, 6
  commits `f4fed70…`)** — Beta P0 #4b/#5/#8 closed, #7 in-app half done
  (web-push send/SW/permissions still open) + vitals + symptom log + doctor
  report:
  1. **P0 #4b fake-default goals killed everywhere** (`f4fed70`) — single source
     of truth: `lib/storage.ts` exports `DEFAULT_GOALS` + `goalsEqualDefaults()`;
     `lib/data/profile.ts#getRealGoals()` = (onboarded && !skipped) || 
     customized, else null. ALL consumers fixed (log page, TrendsPanel
     adherence/macros, RecommendationCard, WeeklyReportCard, workout AI coach —
     missed by the ticket, CalorieContextBar, ProfileContext 3rd mirror).
     **No fabricated goals ever reach an LLM**: every AI surface gates behind a
     🎯 set-goals CTA. Badge engine takes `{goalsAreReal}` — water/calorie-goal
     badges can't fire off defaults (wrapper in `lib/data/badges.ts` passes it).
     Residual (intended): WaterTracker 2000ml = generic hydration heuristic.
  2. **P0 #5 empty-state CTAs** (same commit) — dashboard/log 「📷 最初の1枚」→
     /add; workout timeline → scroll+focus entry form; weight → open quick-form;
     TdeeCard insufficient-data now shows k/7-day progress bar instead of
     `return null`ing (MIN_DATA_POINTS=7 from lib/tdee, not FTUE doc's 3).
  3. **P0 #7 streak nudges** (`e309275`) — pure `lib/notifications.ts`
     `decideNudge()` (date/hour injected): streak-at-risk (JST≥18時, no log
     today, streak≥1, repair-first copy) > decay (≤1 activity day in last 4,
     ≥3 lifetime days guard); max 1/day, dismissal (JST day in
     `diet-tracker-nudge-dismissed`) silences all until tomorrow. In-app
     `NudgeBanner` on dashboard only — **no push/SW/permissions** (that's the
     remaining #7-web-push follow-up). Templates keyed for future server reuse.
  4. **P0 #8 Gemini responseSchema ×6 + raw-echo kill** (`f55c00f`) —
     `lib/gemini.ts` gains `jsonConfig(schema)` + `parseGeminiJson<T>` /
     `GeminiParseError` (fence-strip belt; withRetry stays transport-only).
     All 6 AI routes constrain decoding via `responseSchema` (suggest-workout
     merges into existing config; weekly-report = orchestrator only,
     specialists stay free-prose; recommend keeps `filterRecommendation` —
     schema ≠ safety). Every failure response is generic — no `{error, raw}`
     echo, no `error.message` internals (audit P1 #1 closed; consent route's
     DB error.message leak fixed as drive-by). NOT live-tested against real
     Gemini (needs authed session + key) — schema-mode output quality
     spot-check = [🔒user] follow-up.
  5. **Vitals** (`b59b41d`, migration **013 applied to prod** + SQL-verified:
     enum value, RLS, XOR CHECK + bounds CHECK both reject) — `vital_logs`
     per-measurement rows (BP 50–300/30–200, glucose 20–600 + context enum;
     wide plausibility only, **record-never-interpret** everywhere: no
     thresholds/colors/verdicts in UI or charts); `checkins` +sleep_quality/
     stress_level 1–5. New /vitals page (toggle forms, date-grouped neutral
     history, disclaimer), SideNav entry + /weight header link, check-in
     widget 2 optional 1–5 pickers, Trends BP/glucose/wellness charts
     (next/dynamic, render only with data). vitals_week 🩺 badge (5 days in
     rolling 7, mirrors workout_master).
  6. **Symptom log** (`6fdb58b`, migration **014 applied to prod** +
     SQL-verified: severity/duration CHECKs fire, RLS on) — `symptom_logs`
     per-event rows; `trigger_tag` (not `trigger`); related_meal/workout ids =
     **plain UUIDs, no FKs** (client-generated ids + guest mode) with names
     **denormalized at link time** so reports survive deletion. /symptoms page
     (datalist autocomplete common+past names, onset datetime-local, severity
     1–10 slider w/ neutral display, trigger chips, today's meal/workout link
     pickers), dashboard 最近の症状 widget (last 5), `lib/symptoms.ts` pure
     validation.
  7. **Doctor report** (this commit) — pure `lib/report.ts`
     `buildHealthReport(data, checkIns, range)` (symptom rows+counts, per-
     logged-day meal averages, workout sessions/categories/minutes, vitals
     min/median/max — summary stats only, weight series+delta, sleep/stress/
     water averages). `/report` page: 期間 selector (1週/2週/1ヶ月/custom JST),
     section include-chips, print-CSS A4 (`visibility` trick prints exactly
     `#print-report`, `break-inside: avoid`, `@page A4`) → `window.print()` =
     PDF保存. **Zero new packages** (no jspdf/@react-pdf). Header = 期間+作成日+
     匿名 only (no PII). CSS-bar severity timeline (no recharts in print path).
  **Streak semantics widened twice (intended)**: an activity day is now food OR
  workout OR weight OR water>0 OR **vitals OR symptom** (any-log); nudge/decay/
  weekly-challenge/badges inherit automatically. Verified: lint clean,
  **213/213 vitest** (+29 this round), build green (33 routes), browser E2E on
  dev :3000 (fresh-install dashboard = 🎯 CTA + no fabricated numbers +
  ContextBar absent; streak-at-risk banner fires at seeded 20:30 JST w/ streak
  + dismiss persists day-key; BP+glucose same-day entry → grouped history +
  vitals-only day ticks streak 3 + challenge 3/5; check-in sleepQuality=4/
  stressLevel=2 round-trip; symptom w/ trigger+severity → history + dashboard
  widget; report 2週間 all sections + section-toggle hides + empty range →
  honest no-data ×6 + print rules audited in CSSOM).
  **Deferred follow-ups**: symptom↔meal correlation analysis; CSV import for
  old-app symptom data; web-push sending (P0 #7 second half); live Gemini
  schema-mode spot-check.
- **2026-07-15 ENGAGEMENT ROUND DONE (Beta P0 #6 + extras)** — any-log streak +
  weekly repair ticket + first-log badges + fixed weekly challenge.
  **Streak redefined**: `getStreak()` now counts *any-log* days (food OR workout
  OR weight OR water>0) on **JST** day boundaries (was food-only, UTC); pure
  math in new `lib/streak.ts` (walk + ISO-week keys + look-ahead ticket
  consumption), wired in `lib/storage.ts`. One gap-day per ISO week is bridged
  by a repair ticket (bridged day does NOT count — honest logged-day count);
  consumed tickets persist in new `AppData.streakState.repairedDates`
  (**deviation from the plan's `lastRepairWeek: string|null`** — a week key
  alone can't keep bridging the same gap on recompute; dates are required for
  recompute stability, unit-tested). `streakState` also tracks `longest`
  (device-local only — server persistence of longest = documented follow-up);
  export/import merges it (max longest, union repairs). New `getStreakState()`
  (current/longest/repairAvailable) re-exported via `lib/data/badges.ts`;
  dashboard flame pill gets a 最長 tooltip. **Behavior change**: `streak3/7/30`
  badges now trigger off the any-log streak (workout-only users can earn them —
  intended per redefinition); descriptions reworded, verified live.
  **First-log badges**: `first_food` 🥇 / `first_workout` 💪 (once ever, existing
  award/hasBadge idempotence, dual-write flows automatically). **Weekly
  challenge (fixed)**: "log 5 distinct any-log days this JST Mon–Sun week" —
  derived live from entries (no client-side progress storage → no drift) in new
  `lib/data/weekly-challenge.ts`; best-effort dual-write upsert to new
  `weekly_challenges` table (**migration 012 applied to prod** + SQL-verified:
  enum +first_food/first_workout, RLS on, owner policy, UNIQUE(user_id,
  week_start); first-completion timestamp preserved across syncs);
  `database.types.ts` hand-extended (sanctioned). New
  `components/WeeklyChallengeCard.tsx` (CalorieBar-style token bar, aria
  progressbar, done state, renders in BOTH goal states per P0 #4a pattern) on
  the dashboard; i18n ja+en keys added. Verified: lint clean, **184/184 vitest**
  (19 new: ISO-week/JST/leap edges, repair semantics incl. recompute stability +
  no-waste look-ahead + cross-week tickets, storage integration), build green;
  browser E2E on dev :3000 (4 seeded scenarios: mixed-type streak=4 & challenge
  3/5; gap bridged → 2日 + repairedDates persisted; double-gap breaks → 1日, no
  ticket wasted, longest=9 tooltip preserved; 5 activity days → 5/5 100% bar +
  達成 state; badges no-dup across reloads). No reminders/notifications (no push
  infra yet — P0 #7), no selectable challenges, no dark patterns (generous
  ticket, no fake urgency).
- **2026-07-15 P0 #4a DONE: remove fake default goals from the dashboard** —
  `app/page.tsx` no longer renders the fabricated 2000/150/60/200/2000 as real
  targets. `goals` state is now `DailyGoals | null` (null = "no real goals");
  `loadData()` shows goals only when real — `(onboarding record exists && not
  skipped) || goals differ from the fresh-install defaults` (module-level
  `goalsEqualDefaults`, a hand-kept mirror of the unexported `DEFAULT_GOALS` in
  `lib/storage.ts`). Un-onboarded / skip-path devices now get a 🎯
  「目標を設定してください」empty-state card (CTA → `/onboarding`, secondary
  link → `/settings`) instead of fake numbers. `goalsReady` gates first paint so
  neither fake numbers nor the empty card flash before the client-only load.
  WaterTracker stays visible in both states (`goals?.water ?? 2000` = universal
  hydration guideline, not a fabricated nutrition target); header/streak/
  RecommendationCard/TdeeCard/meals/badges/FAB unchanged. 4 i18n keys added
  (ja+en) in `lib/i18n.ts` (second file in the commit — hardcoding JP would
  regress the English UI). Accepted false-negative: a user who manually saves
  exactly 2000/150/60/200/2000 sees the empty state; false-positive impossible
  for wizard completers. Verified: lint + 165 tests + build green; dev E2E both
  states (skip → 🎯 card, no fake targets, meals+water intact; wizard-completed
  → real 2,450 kcal / 2,150 remaining, empty card gone).
  **STILL open (P0 #4b, NOT fixed here — dashboard-only per ticket):** the
  fabricated defaults are still consumed by `app/log/page.tsx:159,184`,
  `components/TrendsPanel.tsx:80,91`, `components/RecommendationCard.tsx:181`,
  `components/WeeklyReportCard.tsx:81-84`, `app/plan/page.tsx:567`, and the badge
  engine (`lib/storage.ts:305,314`) — some send them to AI routes.
- **2026-07-15 SECURITY AUDIT (post-P0 #3, report-only)** —
  `docs/reviews/SECURITY_AUDIT_2026-07-15.md` (gitignored, not committed).
  No P0. P1: (1) AI routes leak upstream `Error.message` + echo raw Gemini
  output on parse failure (reflected injectable channel); (2) `research/export`
  query params unvalidated + IRB audit-log insert is fire-and-forget (PII can be
  read un-logged); (3) prompt-injection via verbatim user free-text (bounded:
  single-user, food output post-filtered but suggest-workout/coach free-text is
  not) — overlaps roadmap P0 #8 (zod + responseSchema). P2: **open-redirect
  guard in `auth/callback:86` is bypassable** (`//evil.com` passes
  `startsWith('/')` → `new URL` resolves off-origin; correction to the prior
  "positive" — phishing-grade only, PKCE means no token leak), no runtime input
  validation, unbounded arrays, shared access code in localStorage, no CSP/
  security headers. Answered user Q: non-AI routes do NOT need guardAiRoute
  (they're authed + session-derived id filters, no RLS-only route found).
- **2026-07-15 P0 #3 DONE: suggest-workout guard + durable ai_usage daily quota** —
  `app/api/suggest-workout/route.ts` now goes through `guardAiRoute` (was the
  only AI route with inline auth; its 429 also gains the missing `Retry-After`).
  New durable per-user **JST-day** quota layer in `lib/api-guard.ts` backed by
  Supabase `ai_usage` (migration **011 applied to prod**): guard checks
  per-route `DAILY_QUOTAS` (analyze-food 100 / coach 200 / recommend 100 /
  suggest-workout 50 / weekly-report 20 / habit-report 20) + `GLOBAL_DAILY_QUOTA`
  400, **fail-closed** (quota-check DB error → 503, never a free pass); all 6
  AI routes charge via `recordAiUsage` (RPC `increment_ai_usage`,
  SECURITY DEFINER, auth.uid()-scoped, anon revoked) **only after a successful
  Gemini call** — failed requests never consume quota; recorder is best-effort
  (undercount over user-facing failure). Guests = authed-only quota by design
  (FK to profiles), still behind APP_ACCESS_CODE + in-memory limiter.
  Verified: lint + 165 tests + build green; prod SQL sanity (RLS on, grants
  correct); RPC upsert arithmetic live-tested in prod inside a rolled-back
  txn (2 calls → calls=2, est_tokens summed, JST date); dev guest E2E 200 +
  11th request → 429 `retry-after: 8`. NOT exercised: authed 429 in prod
  (needs a real session — [🔒user] E2E item).
- **2026-07-14 P0 #1 FIXED: consent-skip race** — three-layer fix: `proxy.ts`
  consent guard now **fails closed** (missing `profiles` row or query error →
  `/consent`, never inside the app unconsented); `app/auth/callback/route.ts`
  best-effort repairs a missing profiles row after code exchange (service-role
  upsert mirroring the `handle_new_user()` trigger, `ignoreDuplicates`, never
  breaks login); `app/api/consent/route.ts` detects a zero-row update and
  recovers via service-role upsert (or 500s honestly — never reports consent
  it didn't persist). lint + 165 tests + build green.
- **2026-07-14 P0 #2 FIXED: recommendation_feedback dual-write** —
  `lib/data/recommendation-feedback.ts` no longer re-exports the
  localStorage-only writer: `addRecommendationFeedback` now writes
  localStorage synchronously then upserts to the Supabase
  `recommendation_feedback` table when authenticated (fire-and-forget,
  `onConflict: user_id,item_type,item_name` = migration 005 UNIQUE key,
  latest-wins mirroring the local dedup); `lib/data/favorites.ts` now
  routes its `kind: 'favorite'` event through the wrapper instead of
  `@/lib/storage`, so ♡ feedback reaches the cloud too. Study pipeline
  (dashboard/export read the cloud table) unbroken going forward.
  `clearRecommendationFeedback` stays local-only (cloud history = research
  data). lint + 165 tests + build green.
- **2026-07-14 FTUE ONBOARDING WIZARD shipped (D4–D5)** — new `app/onboarding/`
  4-chip wizard (goal / body birth-year+sex+height+weight / experience /
  today's environment), every step skippable with an explicit labeled default;
  result screen = deterministic TDEE (Mifflin-St Jeor when body confirmed,
  食事摂取基準 EER sex-averaged otherwise) + kcal/PFC targets each with a
  1-line WHY, all badged 仮, CTA → first workout. Persistence via lib/data:
  goal+experience → health profile always; age/sex/height + weight entry ONLY
  when body step confirmed (defaults are never logged as measurements); goals
  → `updateGoals` (kills fake dashboard defaults on this device).
  `experience?` = new localStorage-only `UserHealthProfile` field (no DB
  column). Forced redirect in `proxy.ts` via `dt-onboarded` cookie (1y,
  per-device; consent still wins for authed users; guests gated too).
  New: `lib/data/onboarding.ts` (record+cookie),
  `components/onboarding/ChipGroup.tsx`. Browser-verified 3 paths on dev
  :3210 (complete → numbers exact vs Mifflin/EER tables + dashboard shows
  real targets; あとで skip → defaults recorded, nothing fabricated; body-skip
  → sex-averaged 2275 kcal + 仮 note, no weight entry). NOTE: redirect gate
  inactive in local dev (placeholder Supabase env → proxy pass-through);
  active in prod.
- **2026-07-14 FTUE & PUBLIC-BETA EXPERIENCE DESIGN landed (docs-only)** —
  `docs/roadmaps/FTUE_BETA_DESIGN_2026-07.md`: FTUE critical path + 12
  drop-off countermeasures, journey map D0–D30, session-start AI-trainer flow
  (CheckInWidget merged from /plan), meal-scan v2 result card + ≤3-tap
  correction + failure fallbacks, social LP + notification copy, retention
  D1–D30 (streak redefined = any-log day + weekly repair ticket),
  no-dark-pattern checklist, accessibility 5-pack, research evaluation plan
  (SUS @D14 / UEQ-S @D30), beta checklist, and a consolidated P0/P1/P2 that
  **supersedes the 07-13 roadmap's P0 ordering**. Two 🔴 bugs found in the
  audits, documented NOT fixed:
  1. **Consent-skip race** — nothing inserts a `profiles` row on signup, and
     the proxy only forces `/consent` for users WITH a row where
     `consented_at IS NULL` → fresh OAuth users likely skip the research
     consent wall entirely (ethics/validity, P0 #1).
  2. **recommendation_feedback pipeline broken end-to-end** — the study's
     core signal is localStorage-only (dual-write deferred) while the
     researcher dashboard + export read the CLOUD table (P0 #2).
- **2026-07-13 COMPETITIVE STUDY + REDESIGN ROADMAP landed (docs-only)** —
  reverse-engineering of 19 fitness/nutrition apps + gap analysis + 3-pillar
  redesign: `docs/research/COMPETITIVE_STUDY_2026-07.md` (ranking, retention
  mechanics, UX analysis, 4 publication opportunities) and
  `docs/roadmaps/REDESIGN_ROADMAP_2026-07.md` (environment-aware deterministic
  workout engine + LLM narrative design, photo workflow v2, P0/P1/P2, migrations
  011+ schema, API/UI changes). Locked decisions: exercise DB seeded from
  free-exercise-db (public domain); deterministic engine decides / LLM only
  explains; per-user daily AI quotas. No code yet.
- **2026-07-12 MULTI-GENERATION ROUND merged (PR #13, main `9af9ef1`)** — app now
  supports every generation 12+ per 日本人の食事摂取基準（2025年版）:
  `lib/nutrition-standards.ts` (EER/protein-RDA/%E tables, source-cited,
  cross-checked ×2), minor (12–17) calorie floor + growth warning + TdeeCard
  deficit-preset filter, senior (65+) protein floor 1.0 g/kg (**CKD cap wins** —
  tested), profile +sex/+height_cm (migration 010 **applied to prod**),
  settings 推奨値 button + 性別/身長 inputs, **18+ consent attestation gate**
  (client+server, `adult_confirmed_at`; minors → guest mode — vault `ADR-004`),
  large-text mode (112.5%). 165 tests. Browser-smoked personas 15/70.
- **Gotcha (Turbopack)**: editing `app/globals.css` while the dev server is down
  can leave a stale persistent-cache compile that survives restart + hard reload;
  `rm -rf .next` fixes it.
- **2026-07-05 PRODUCTION DEPLOYED** — https://diet-tracker-two-blue.vercel.app
  (Vercel project `diet-tracker`, team michaeltakaos-projects; deploys via
  `npx vercel deploy --prod --yes`).
- **2026-07-05 CRITICAL FIX `28d3d44`**: auth-lock deadlock — ProfileContext's async
  `onAuthStateChange` callback awaited `fetchProfile()` while auth-js held its
  navigator.locks mutex → lock held for the page's lifetime → **every Supabase
  dual-write silently degraded to localStorage-only**. Found live in the prod smoke
  test (this is why the dual-write tables had zero rows). Deployed prod needs this
  commit (redeploy if Vercel didn't auto-deploy).
- 2026-07-05 review-fix round `a7b9574` (pre-merge, on the stack): servings scale from
  immutable base (round-trip exact), AI-fill resets servings, validate() rejects
  non-finite/negative/oversized, favorites upsert `onConflict: user_id,name`,
  self-delete returns 500 on auth-cleanup failure, trends same-day dedupe (+test),
  migration 009 policies rerun-safe. Cross-vendor review: Copilot/GPT (gpt-5.4-mini)
  + Claude; **Gemini CLI leg DOWN** (IneligibleTierError → Antigravity migration,
  [🔒user]). Record: `docs/reviews/code-review-2026-07-05.md` (gitignored).
- 2026-07-03 competitor round's 4 stacked PRs (#9–#12) **merged to main 07-05**
  (merge order #9→#12, branches deleted).
- **2026-07-05 prod smoke test PASSED** (local dev vs prod Supabase, throwaway SQL
  user, Chrome DevTools): consent flow → `consented_at` set; food log at 1.5×
  servings → `food_logs` row with `servings=1.50, source='manual'`; ♡ favorite →
  `favorite_foods` row (`macro_highlight=高タンパク`); template → `meal_templates`
  row; **cascade erasure verified** — deleting `profiles` zeroed food_logs /
  favorite_foods / meal_templates / recommendation_feedback / tdee_estimates;
  auth user purged. Self-delete route fails SAFE without service key (500, UI
  error, localStorage kept).
- Guest mode fixed for production (`dt-guest` cookie, `b19e69b`): the login page's
  "Continue without an account" link was dead UI when Supabase is configured —
  proxy.ts redirected everything to /login. Found in post-deploy smoke E2E.
- Billing-audit A1 now on main (`6c476e1`): pr-review/issue-route workflows are
  `workflow_dispatch`-only.

## Next
- **[auto] Beta P0** (per `docs/roadmaps/FTUE_BETA_DESIGN_2026-07.md` §11 —
  refines/supersedes the 07-13 roadmap's P0 ordering): 1) ~~🔴 consent-skip race
  fix~~ **DONE 07-14** (`e7852dc`); 2) ~~🔴 `recommendation_feedback` dual-write
  to Supabase~~ **DONE 07-14**; 3) ~~`suggest-workout` behind
  `guardAiRoute` + durable `ai_usage` per-user daily quotas~~ **DONE 07-15**
  (migration 011 in prod); 4) ~~kill fake default goals~~ **DONE: #4a 07-14
  wizard + dashboard, #4b 07-16 all consumers + AI gating** (`f4fed70`);
  5) ~~empty states → single next-action CTAs~~ **DONE 07-16**; 6) ~~streak
  redefinition (any-log day) + weekly repair ticket~~ **DONE 07-15** (+
  first-log badges + weekly challenge; migration 012 in prod); 7) ~~web push~~ —
  **trigger module + templates + in-app banner DONE 07-16** (`e309275`);
  **push sending/SW/permissions DONE 07-17** (migration 015 in prod; VAPID
  keys = [🔒user], server cron deferred by design); 8) ~~Gemini `responseSchema`
  migration ×6~~ **DONE 07-16** (`f55c00f`; live schema-mode spot-check =
  [🔒user]); 9) session-start flow (env/time/equipment/energy; CheckInWidget
  merged /plan → /workout); 10) cohort auto-assignment + SUS surface. Enablers
  carried from the 07-13 roadmap: exercise DB seed (free-exercise-db →
  ~120–150 curated, +pattern/JP names); `workout_sessions`+`workout_sets`
  per-set schema; environment-aware deterministic generation v1; ghost-text
  set-logging ergonomics.
- **[auto] Health-log follow-ups (07-16 round)**: symptom↔meal correlation
  analysis; CSV import for old symptom-memo-app data; Supabase→local hydration
  for vitals/symptoms (same gap as food — second device sees empty logs).
- **[🔒user] Web Push VAPID keys (07-17)** — run `npx web-push
  generate-vapid-keys` locally, then add to `.env.local` AND Vercel
  (Production + Preview): `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PUBLIC_KEY`
  (same value), `VAPID_PRIVATE_KEY` (server-only, never NEXT_PUBLIC),
  `VAPID_SUBJECT=mailto:<contact email>`. All code fail-closes without them
  (503 / UI hidden). Then post-keys E2E: enable on dashboard card → row in
  `push_subscriptions` → evening nudge → OS notification → click focuses
  dashboard → same-day repeat = already-sent-today → settings disable → row
  gone.
- **[auto] Web Push server cron** (design in Now 07-17): Vercel Cron +
  CRON_SECRET route so nudges fire without the user opening the app — the
  actual point of push; the current client-triggered send mostly mirrors
  in-app banners.
- **[🔒user] to finish production**:
  1. Vercel env (Production): add `SUPABASE_SERVICE_ROLE_KEY` (enables export +
     participant self-delete + **push-subscribe upsert**) and confirm
     `GEMINI_API_KEY` value is current (photo AI). `APP_ACCESS_CODE` already
     set.
  2. Supabase dashboard → Auth → URL Configuration: add
     `https://diet-tracker-two-blue.vercel.app` to Site URL / Redirect URLs
     (Google OAuth + magic link won't round-trip until then).
  3. Create a real account → authed full E2E: consent → recommend → export.
  4. Set researcher role for your own account (researcher_access_log flow).
- **[🔒user] Supabase dashboard → Auth → Providers: Google is DISABLED**
  (`external.google=false`) — the login page's Google button cannot work against
  this project until enabled (or hide the button).
- **[🔒user] Gemini CLI ineligible** (IneligibleTierError) — migrate to Antigravity
  or council loses its preferred cross-vendor reviewer (Copilot/GPT still works).
- **[🔒user] local `.env.local` has placeholder NEXT_PUBLIC_SUPABASE_* values and
  no usable `SUPABASE_SERVICE_ROLE_KEY`** — local dev runs guest-mode-only until
  filled (smoke test worked around it via shell env; service-key routes untestable).
- W4 self-delete: cascade + fail-safe verified 07-05 (see Now); full route E2E
  (auth.admin.deleteUser leg) still needs `SUPABASE_SERVICE_ROLE_KEY` in env.
- ~~Authed dual-write spot-check~~ **DONE 07-05** (SQL evidence, see Now). Note:
  STEP-7 bulk migration rows leave `servings`/`source` NULL — backfill or accept.
- Review follow-ups (from 07-05 cross-vendor round, non-blocking): no Supabase→local
  hydration path (second device sees empty app — biggest sign-in value gap);
  MealCard edit coerces empty fields to 0 (pre-existing); favorites quick-add
  ignores the servings stepper (UX).
- Backlog (explicit cut list from the round): W1b bundled JP food DB (MEXT 成分表 —
  demoted per kill criteria; **revived *scoped* as P1 in the 07-13 roadmap**: top ~500
  washoku + pg_trgm, grounds photo v2 numbers), W1c barcode/OFF (spike
  ≥50% hit-rate on 10 pantry items first; unchanged, still gates barcode), telemetry Supabase dual-write (needs migration
  + consent gating), recipes, full micronutrient UI, weight-page SVG → recharts,
  AccountSection full i18n retrofit.
- P1 research features: adherence prediction, habit phenotyping, TDEE-triggered goal adaptation.
- Stale open PRs #3/#6/#7/#8 predate the stack and have diverged from main —
  close or rebase decision pending (only #8's CI hardening was salvaged, via `6c476e1`).

## Blockers
- Authed E2E blocked on [🔒user] items 1–2 above.

## Key decisions
- Guest mode in production = explicit per-device opt-in via `dt-guest=1` cookie
  (set client-side by the login page; honored by proxy.ts auth guard). AI routes
  still gated by `APP_ACCESS_CODE` in `lib/api-guard.ts` (2026-07-05).
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
- **Never call `supabase.*` inside an `onAuthStateChange` callback** — auth-js holds
  its navigator.locks mutex while awaiting the callback; defer via `setTimeout`
  (`28d3d44`, 2026-07-05). Symptom of violation: dual-writes silently stop.
- Repo is the Master's research vehicle — see vault `ADR-001`.
- `postcss` overridden to `^8.5.10` (CVE-2026-41305, MEDIUM).
- CI workflows hardened against script injection (`cac19bf`, 2026-06-12) — see vault `ADR-003`.

## Last verified state
- 2026-07-17 (council fixes): `npm run lint` clean, `npx vitest run`
  **252/252** (+22), `npm run build` green. Dev :3199 anon probes → 401 both
  routes; served /sw.js contains the same-origin guard. NOT empirically
  exercised: the sent===0 rollback (needs live Supabase + forced send
  failure — same [🔒user] VAPID/auth blocker).
- 2026-07-17 (web-push round): `npm run lint` clean, `npx vitest run`
  **230/230** (+17), `npm run build` green (35 routes, +2 push API).
  Migration **015 applied** to prod (`chkkpucuiyjdeqgyyszt`),
  `database.types.ts` regenerated (MCP). Pre-keys fail-closed verified on dev
  :3199: anon POST push-send/push-subscribe + DELETE all → **401** (never 403);
  dashboard card + settings row hidden (guest, no VAPID env); served /sw.js
  contains push+notificationclick handlers; console clean. NOT verified
  (blocked on [🔒user] VAPID keys + authed session): authed 503, real
  subscribe→OS-notification E2E, already-sent-today dedupe live, Vercel
  preview.
- 2026-07-16 (beta-P0 completion + health-log round): `npm run lint` clean,
  `npx vitest run` **213/213**, `npm run build` green (33 routes). Migrations
  **013 + 014 applied** to prod (`chkkpucuiyjdeqgyyszt`) with negative-case SQL
  sanity (XOR/bounds/severity/duration CHECKs all reject; RLS on both tables;
  badge_type 10 values). Dev :3000 browser E2E: 8 scenario checks pass (see
  Now). NOT verified live: Gemini schema-mode output quality (needs authed
  session + GEMINI_API_KEY), authed dual-write rows for vital_logs/
  symptom_logs (guest-mode E2E only — same [🔒user] auth blocker as before).
- 2026-07-15 (engagement round): `npm run lint` clean, `npx vitest run`
  **184/184**, `npm run build` green. Migration **012 applied** to prod
  (`chkkpucuiyjdeqgyyszt`) + SQL sanity (badge_type 9 values, weekly_challenges
  RLS+policy+indexes). Dev-server browser E2E: 4 seeded streak/challenge/badge
  scenarios all pass (see Now).
- 2026-07-12: main (`9af9ef1`, post PR #13 merge) — `npm run lint` clean,
  `npx vitest run` **165/165**, `npm run build` green. Migration **010 applied**
  to prod (`chkkpucuiyjdeqgyyszt`), `database.types.ts` in sync. Browser smoke
  (dev :3210, SW unregistered): age-70 推奨値 → 2350/60/65/338 exact; age-15 →
  2850 EER fill, consent blocked without 18+ checkbox, guest exit sets
  `dt-guest=1`; large-text 16→18px, persists, no overflow (dashboard, /log,
  BottomNav). Prod redeploy pending (Vercel auto-deploy from main, or
  `npx vercel deploy --prod --yes`).
- 2026-07-05: main (`28d3d44`) — `npm run lint` clean, `npx vitest run` **135/135**,
  `npm run build` green. Prod smoke test vs `chkkpucuiyjdeqgyyszt`: dual-write rows
  (food/favorite/template incl. migration-009 columns) + cascade erasure + auth-user
  purge all SQL-verified; throwaway user destroyed.
- 2026-07-05: main (`b19e69b`) — `npm run lint` clean, `npx vitest run` **135/135**,
  `npm run build` green. Production smoke E2E on
  https://diet-tracker-two-blue.vercel.app (Chrome DevTools): /login renders,
  guest link → dashboard/log/add/consent all render (screenshots verified),
  anonymous POST `/api/recommend` → **403 "Access code required"** (gate live),
  no-cookie `/` → 307 `/login?next=%2F`. Vercel Production env:
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` added (public
  values via Supabase MCP); `APP_ACCESS_CODE`, `GEMINI_API_KEY` pre-existing.
- 2026-07-03: migrations **006/007 confirmed live**, **008 + 009 applied** to prod
  (`chkkpucuiyjdeqgyyszt`) and verified; `database.types.ts` regenerated.
- 2026-06-11: trivy (lockfile) clean · gitleaks history scan: 9 findings, all triaged
  false positives.
