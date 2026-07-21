/**
 * Curated static exercise database (phase B, expanded per
 * docs/roadmaps/REDESIGN_ROADMAP_2026-07.md decision #1) — 200+ exercises
 * curated in the spirit of free-exercise-db (public domain), with an
 * uneven-but-sensible per-muscle-part distribution instead of a fixed count.
 *
 * The 12 former RECOMMENDED_MENUS from app/workout/page.tsx live here as the
 * entries carrying `recommended` (defaults + coach tip); the rest form the
 * full picker. `nameJa` is the CANONICAL logging name — history and
 * personal_records are keyed by it (back-compat with all existing entries),
 * so it must never change once shipped. `nameEn` is display-only. The
 * original 60 entries' `id`/`nameJa` are unchanged from phase B; only
 * additive fields (`pattern`) were backfilled onto them.
 *
 * Equipment powers the environment-aware AI suggestions (home users without
 * a machine/cable stack shouldn't be told to do lat pulldowns).
 *
 * `pattern` tags the movement pattern (squat/hinge/push/pull/etc.) as
 * groundwork for a future deterministic workout-scoring engine (not built
 * yet — see roadmap §1). Optional in the type for permissiveness, but every
 * entry below carries one.
 */

import type { MusclePart } from '@/lib/types';

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'h-push'   // horizontal push (bench press, push-up)
  | 'v-push'   // vertical push (overhead press)
  | 'h-pull'   // horizontal pull (row)
  | 'v-pull'   // vertical pull (pulldown/pull-up)
  | 'lunge'
  | 'carry'
  | 'core'
  | 'isolation';

export interface ExerciseRecommendation {
  sets: number;
  reps: number;
  /** Starting suggestion in kg (0 = bodyweight). */
  defaultWeightKg: number;
  coachTipJa: string;
  coachTipEn: string;
}

/**
 * Static, no-third-party-API demo-media pointer (see
 * docs — no "WorkoutX API" exists; this repo already concluded static
 * assets/links beat a live-fetched GIF API, per OSS_RESEARCH_REPORT.md).
 *
 * 'local-gif'      — self-hosted asset under public/exercise-media/.
 * 'youtube-search' — no local asset yet; deep-link to a YouTube search so
 *                     the user still gets something useful. Never a
 *                     caller-controlled or remote-API host.
 */
export interface ExerciseVideo {
  type: 'local-gif' | 'youtube-search';
  /** Relative path (e.g. '/exercise-media/bench-press.gif') for
   *  'local-gif', or a full youtube.com/results?search_query=... URL for
   *  'youtube-search'. */
  url: string;
  /** Optional static poster frame (e.g. for reduced-motion / slow connections). */
  thumbnail?: string;
  title?: string;
}

export interface ExerciseDef {
  id: string;
  nameJa: string;
  nameEn: string;
  musclePart: MusclePart;
  equipment: Equipment;
  isCompound: boolean;
  /** Movement-pattern tag for the future deterministic scoring engine. */
  pattern?: MovementPattern;
  /** Present on the curated starter menus (former RECOMMENDED_MENUS). */
  recommended?: ExerciseRecommendation;
  /** Optional demo video/GIF pointer. Undefined is the common case. */
  video?: ExerciseVideo;
}

/** Deterministic YouTube-search URL for an exercise name — never hand-typed. */
export function youtubeSearchUrl(nameEn: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${nameEn} exercise form`)}`;
}

/** Builds a `video: { type: 'youtube-search', ... }` entry for a curated exercise. */
function ytVideo(nameEn: string): ExerciseVideo {
  return { type: 'youtube-search', url: youtubeSearchUrl(nameEn), title: nameEn };
}

const CHEST_EXERCISES: readonly ExerciseDef[] = [
  { id: 'bench-press', nameJa: 'ベンチプレス', nameEn: 'Bench Press', musclePart: 'chest', equipment: 'barbell', isCompound: true, pattern: 'h-push',
    recommended: { sets: 3, reps: 10, defaultWeightKg: 40,
      coachTipJa: '大胸筋をしっかりストレッチさせる意識で、バーを胸まで下ろしましょう！',
      coachTipEn: 'Focus on stretching your chest as you lower the bar — bring it all the way to your chest!' },
    video: ytVideo('Bench Press') },
  { id: 'dumbbell-fly', nameJa: 'ダンベルフライ', nameEn: 'Dumbbell Fly', musclePart: 'chest', equipment: 'dumbbell', isCompound: false, pattern: 'isolation',
    recommended: { sets: 3, reps: 12, defaultWeightKg: 10,
      coachTipJa: 'トップポジションで顎を引くと、大胸筋上部まで強く収縮します！',
      coachTipEn: 'Tuck your chin at the top to engage the upper chest for a stronger contraction.' },
    video: ytVideo('Dumbbell Fly') },
  { id: 'incline-dumbbell-press', nameJa: 'インクラインダンベルプレス', nameEn: 'Incline Dumbbell Press', musclePart: 'chest', equipment: 'dumbbell', isCompound: true, pattern: 'h-push' },
  { id: 'incline-bench-press', nameJa: 'インクラインベンチプレス', nameEn: 'Incline Bench Press', musclePart: 'chest', equipment: 'barbell', isCompound: true, pattern: 'h-push' },
  { id: 'chest-press-machine', nameJa: 'チェストプレス', nameEn: 'Chest Press Machine', musclePart: 'chest', equipment: 'machine', isCompound: true, pattern: 'h-push' },
  { id: 'pec-deck', nameJa: 'ペックデック', nameEn: 'Pec Deck Fly', musclePart: 'chest', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'cable-crossover', nameJa: 'ケーブルクロスオーバー', nameEn: 'Cable Crossover', musclePart: 'chest', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'push-up', nameJa: '腕立て伏せ', nameEn: 'Push-Up', musclePart: 'chest', equipment: 'bodyweight', isCompound: true, pattern: 'h-push',
    video: ytVideo('Push-Up') },
  { id: 'dips', nameJa: 'ディップス', nameEn: 'Dips', musclePart: 'chest', equipment: 'bodyweight', isCompound: true, pattern: 'h-push' },
  { id: 'dumbbell-pullover', nameJa: 'ダンベルプルオーバー', nameEn: 'Dumbbell Pullover', musclePart: 'chest', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  // ── new ──────────────────────────────────────────────────────────────────
  { id: 'decline-bench-press', nameJa: 'デクラインベンチプレス', nameEn: 'Decline Bench Press', musclePart: 'chest', equipment: 'barbell', isCompound: true, pattern: 'h-push' },
  { id: 'decline-dumbbell-press', nameJa: 'デクラインダンベルプレス', nameEn: 'Decline Dumbbell Press', musclePart: 'chest', equipment: 'dumbbell', isCompound: true, pattern: 'h-push' },
  { id: 'incline-cable-fly', nameJa: 'インクラインケーブルフライ', nameEn: 'Incline Cable Fly', musclePart: 'chest', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'decline-cable-fly', nameJa: 'デクラインケーブルフライ', nameEn: 'Decline Cable Fly', musclePart: 'chest', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'low-cable-fly', nameJa: 'ローケーブルフライ', nameEn: 'Low-to-High Cable Fly', musclePart: 'chest', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'smith-machine-bench-press', nameJa: 'スミスマシンベンチプレス', nameEn: 'Smith Machine Bench Press', musclePart: 'chest', equipment: 'machine', isCompound: true, pattern: 'h-push' },
  { id: 'incline-chest-press-machine', nameJa: 'インクラインチェストプレスマシン', nameEn: 'Incline Chest Press Machine', musclePart: 'chest', equipment: 'machine', isCompound: true, pattern: 'h-push' },
  { id: 'single-arm-dumbbell-press', nameJa: 'シングルアームダンベルプレス', nameEn: 'Single-Arm Dumbbell Press', musclePart: 'chest', equipment: 'dumbbell', isCompound: true, pattern: 'h-push' },
  { id: 'floor-press', nameJa: 'フロアプレス', nameEn: 'Floor Press', musclePart: 'chest', equipment: 'barbell', isCompound: true, pattern: 'h-push' },
  { id: 'svend-press', nameJa: 'スベンドプレス', nameEn: 'Svend Press', musclePart: 'chest', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'squeeze-press', nameJa: 'スクイーズプレス', nameEn: 'Dumbbell Squeeze Press', musclePart: 'chest', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'incline-push-up', nameJa: 'インクラインプッシュアップ', nameEn: 'Incline Push-Up', musclePart: 'chest', equipment: 'bodyweight', isCompound: true, pattern: 'h-push' },
  { id: 'decline-push-up', nameJa: 'デクラインプッシュアップ', nameEn: 'Decline Push-Up', musclePart: 'chest', equipment: 'bodyweight', isCompound: true, pattern: 'h-push' },
  { id: 'wide-push-up', nameJa: 'ワイドプッシュアップ', nameEn: 'Wide-Grip Push-Up', musclePart: 'chest', equipment: 'bodyweight', isCompound: true, pattern: 'h-push' },
  { id: 'diamond-push-up', nameJa: 'ダイヤモンドプッシュアップ', nameEn: 'Diamond Push-Up', musclePart: 'chest', equipment: 'bodyweight', isCompound: true, pattern: 'h-push' },
  { id: 'ring-dips', nameJa: 'リングディップス', nameEn: 'Ring Dips', musclePart: 'chest', equipment: 'bodyweight', isCompound: true, pattern: 'h-push' },
  { id: 'chest-dip-weighted', nameJa: 'ウェイテッドディップス', nameEn: 'Weighted Chest Dips', musclePart: 'chest', equipment: 'bodyweight', isCompound: true, pattern: 'h-push' },
  { id: 'landmine-press', nameJa: 'ランドマインプレス', nameEn: 'Landmine Press', musclePart: 'chest', equipment: 'barbell', isCompound: true, pattern: 'h-push' },
  { id: 'guillotine-press', nameJa: 'ギロチンプレス', nameEn: 'Guillotine Press', musclePart: 'chest', equipment: 'barbell', isCompound: true, pattern: 'h-push' },
  { id: 'plate-pinch-press', nameJa: 'プレートピンチプレス', nameEn: 'Plate Pinch Press', musclePart: 'chest', equipment: 'bodyweight', isCompound: false, pattern: 'isolation' },
  { id: 'chest-press-band', nameJa: 'チェストプレス（自重）', nameEn: 'Standing Chest Press', musclePart: 'chest', equipment: 'bodyweight', isCompound: true, pattern: 'h-push' },
] as const;

const BACK_EXERCISES: readonly ExerciseDef[] = [
  { id: 'lat-pulldown', nameJa: 'ラットプルダウン', nameEn: 'Lat Pulldown', musclePart: 'back', equipment: 'machine', isCompound: true, pattern: 'v-pull',
    recommended: { sets: 3, reps: 10, defaultWeightKg: 35,
      coachTipJa: '胸を張り、バーを鎖骨に向かって引くことで背中に強烈に効きます。',
      coachTipEn: 'Puff your chest out and pull the bar toward your collarbone for maximum back engagement.' },
    video: ytVideo('Lat Pulldown') },
  { id: 'deadlift', nameJa: 'デッドリフト', nameEn: 'Deadlift', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'hinge',
    recommended: { sets: 3, reps: 8, defaultWeightKg: 60,
      coachTipJa: '背中を絶対に丸めないように！お腹に力を入れて体幹を固定しましょう。',
      coachTipEn: 'Never round your back! Brace your core hard to keep your spine neutral throughout.' },
    video: ytVideo('Deadlift') },
  { id: 'bent-over-row', nameJa: 'ベントオーバーロウ', nameEn: 'Bent-Over Row', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'h-pull' },
  { id: 'one-arm-dumbbell-row', nameJa: 'ワンハンドロウ', nameEn: 'One-Arm Dumbbell Row', musclePart: 'back', equipment: 'dumbbell', isCompound: true, pattern: 'h-pull' },
  { id: 'pull-up', nameJa: '懸垂', nameEn: 'Pull-Up', musclePart: 'back', equipment: 'bodyweight', isCompound: true, pattern: 'v-pull',
    video: ytVideo('Pull-Up') },
  { id: 'seated-cable-row', nameJa: 'シーテッドロウ', nameEn: 'Seated Cable Row', musclePart: 'back', equipment: 'cable', isCompound: true, pattern: 'h-pull' },
  { id: 't-bar-row', nameJa: 'Tバーロウ', nameEn: 'T-Bar Row', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'h-pull' },
  { id: 'back-extension', nameJa: 'バックエクステンション', nameEn: 'Back Extension', musclePart: 'back', equipment: 'bodyweight', isCompound: false, pattern: 'hinge' },
  { id: 'dumbbell-shrug', nameJa: 'ダンベルシュラッグ', nameEn: 'Dumbbell Shrug', musclePart: 'back', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'straight-arm-pulldown', nameJa: 'ストレートアームプルダウン', nameEn: 'Straight-Arm Pulldown', musclePart: 'back', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  // ── new ──────────────────────────────────────────────────────────────────
  { id: 'sumo-deadlift', nameJa: 'スモウデッドリフト', nameEn: 'Sumo Deadlift', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'hinge' },
  { id: 'trap-bar-deadlift', nameJa: 'トラップバーデッドリフト', nameEn: 'Trap Bar Deadlift', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'hinge' },
  { id: 'rack-pull', nameJa: 'ラックプル', nameEn: 'Rack Pull', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'hinge' },
  { id: 'chin-up', nameJa: 'チンニング', nameEn: 'Chin-Up', musclePart: 'back', equipment: 'bodyweight', isCompound: true, pattern: 'v-pull' },
  { id: 'wide-grip-pull-up', nameJa: 'ワイドグリップ懸垂', nameEn: 'Wide-Grip Pull-Up', musclePart: 'back', equipment: 'bodyweight', isCompound: true, pattern: 'v-pull' },
  { id: 'assisted-pull-up', nameJa: 'アシステッドプルアップ', nameEn: 'Assisted Pull-Up Machine', musclePart: 'back', equipment: 'machine', isCompound: true, pattern: 'v-pull' },
  { id: 'v-bar-pulldown', nameJa: 'Vバープルダウン', nameEn: 'V-Bar Lat Pulldown', musclePart: 'back', equipment: 'machine', isCompound: true, pattern: 'v-pull' },
  { id: 'reverse-grip-pulldown', nameJa: 'リバースグリッププルダウン', nameEn: 'Reverse-Grip Lat Pulldown', musclePart: 'back', equipment: 'machine', isCompound: true, pattern: 'v-pull' },
  { id: 'single-arm-lat-pulldown', nameJa: 'シングルアームラットプルダウン', nameEn: 'Single-Arm Lat Pulldown', musclePart: 'back', equipment: 'cable', isCompound: true, pattern: 'v-pull' },
  { id: 'chest-supported-row', nameJa: 'チェストサポートロウ', nameEn: 'Chest-Supported Row', musclePart: 'back', equipment: 'machine', isCompound: true, pattern: 'h-pull' },
  { id: 'machine-row', nameJa: 'マシンロウ', nameEn: 'Machine Row', musclePart: 'back', equipment: 'machine', isCompound: true, pattern: 'h-pull' },
  { id: 'cable-row-wide-grip', nameJa: 'ワイドグリップケーブルロウ', nameEn: 'Wide-Grip Cable Row', musclePart: 'back', equipment: 'cable', isCompound: true, pattern: 'h-pull' },
  { id: 'pendlay-row', nameJa: 'ペンドレイロウ', nameEn: 'Pendlay Row', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'h-pull' },
  { id: 'yates-row', nameJa: 'イエーツロウ', nameEn: 'Yates Row', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'h-pull' },
  { id: 'meadows-row', nameJa: 'メドウズロウ', nameEn: 'Meadows Row', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'h-pull' },
  { id: 'inverted-row', nameJa: 'インバーテッドロウ', nameEn: 'Inverted Row', musclePart: 'back', equipment: 'bodyweight', isCompound: true, pattern: 'h-pull' },
  { id: 'renegade-row', nameJa: 'レネゲードロウ', nameEn: 'Renegade Row', musclePart: 'back', equipment: 'dumbbell', isCompound: true, pattern: 'h-pull' },
  { id: 'good-morning', nameJa: 'グッドモーニング', nameEn: 'Good Morning', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'hinge' },
  { id: 'hyperextension', nameJa: 'ハイパーエクステンション', nameEn: 'Hyperextension', musclePart: 'back', equipment: 'bodyweight', isCompound: false, pattern: 'hinge' },
  { id: 'barbell-shrug', nameJa: 'バーベルシュラッグ', nameEn: 'Barbell Shrug', musclePart: 'back', equipment: 'barbell', isCompound: false, pattern: 'isolation' },
  { id: 'cable-shrug', nameJa: 'ケーブルシュラッグ', nameEn: 'Cable Shrug', musclePart: 'back', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'superman', nameJa: 'スーパーマン', nameEn: 'Superman', musclePart: 'back', equipment: 'bodyweight', isCompound: false, pattern: 'hinge' },
  { id: 'reverse-fly-machine', nameJa: 'リバースフライマシン', nameEn: 'Reverse Fly Machine', musclePart: 'back', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'seal-row', nameJa: 'シールロウ', nameEn: 'Seal Row', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'h-pull' },
  { id: 'kroc-row', nameJa: 'クロックロウ', nameEn: 'Kroc Row', musclePart: 'back', equipment: 'dumbbell', isCompound: true, pattern: 'h-pull' },
  { id: 'landmine-row', nameJa: 'ランドマインロウ', nameEn: 'Landmine Row', musclePart: 'back', equipment: 'barbell', isCompound: true, pattern: 'h-pull' },
  { id: 'farmers-carry', nameJa: "ファーマーズキャリー", nameEn: "Farmer's Carry", musclePart: 'back', equipment: 'dumbbell', isCompound: true, pattern: 'carry' },
  { id: 'suitcase-carry', nameJa: 'スーツケースキャリー', nameEn: 'Suitcase Carry', musclePart: 'back', equipment: 'dumbbell', isCompound: true, pattern: 'carry' },
] as const;

const LEGS_EXERCISES: readonly ExerciseDef[] = [
  { id: 'barbell-squat', nameJa: 'バーベルスクワット', nameEn: 'Barbell Squat', musclePart: 'legs', equipment: 'barbell', isCompound: true, pattern: 'squat',
    recommended: { sets: 3, reps: 8, defaultWeightKg: 50,
      coachTipJa: 'お尻を後ろに引くように。膝が内側に入らないよう注意してください！',
      coachTipEn: 'Push your hips back and keep your knees tracking over your toes — never let them cave in.' },
    video: ytVideo('Barbell Squat') },
  { id: 'leg-press', nameJa: 'レッグプレス', nameEn: 'Leg Press', musclePart: 'legs', equipment: 'machine', isCompound: true, pattern: 'squat',
    recommended: { sets: 3, reps: 12, defaultWeightKg: 80,
      coachTipJa: '膝が90度になる位置まで深く下ろすと大腿四頭筋にしっかり効きます。',
      coachTipEn: 'Lower the platform until your knees reach 90° for full quad activation.' },
    video: ytVideo('Leg Press') },
  { id: 'lunge', nameJa: 'ランジ', nameEn: 'Lunge', musclePart: 'legs', equipment: 'dumbbell', isCompound: true, pattern: 'lunge' },
  { id: 'leg-extension', nameJa: 'レッグエクステンション', nameEn: 'Leg Extension', musclePart: 'legs', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'leg-curl', nameJa: 'レッグカール', nameEn: 'Leg Curl', musclePart: 'legs', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'romanian-deadlift', nameJa: 'ルーマニアンデッドリフト', nameEn: 'Romanian Deadlift', musclePart: 'legs', equipment: 'barbell', isCompound: true, pattern: 'hinge' },
  { id: 'bulgarian-split-squat', nameJa: 'ブルガリアンスクワット', nameEn: 'Bulgarian Split Squat', musclePart: 'legs', equipment: 'dumbbell', isCompound: true, pattern: 'lunge' },
  { id: 'goblet-squat', nameJa: 'ゴブレットスクワット', nameEn: 'Goblet Squat', musclePart: 'legs', equipment: 'dumbbell', isCompound: true, pattern: 'squat' },
  { id: 'hip-thrust', nameJa: 'ヒップスラスト', nameEn: 'Hip Thrust', musclePart: 'legs', equipment: 'barbell', isCompound: true, pattern: 'hinge' },
  { id: 'calf-raise', nameJa: 'カーフレイズ', nameEn: 'Calf Raise', musclePart: 'legs', equipment: 'bodyweight', isCompound: false, pattern: 'isolation' },
  // ── new ──────────────────────────────────────────────────────────────────
  { id: 'front-squat', nameJa: 'フロントスクワット', nameEn: 'Front Squat', musclePart: 'legs', equipment: 'barbell', isCompound: true, pattern: 'squat' },
  { id: 'hack-squat', nameJa: 'ハックスクワット', nameEn: 'Hack Squat', musclePart: 'legs', equipment: 'machine', isCompound: true, pattern: 'squat' },
  { id: 'smith-machine-squat', nameJa: 'スミスマシンスクワット', nameEn: 'Smith Machine Squat', musclePart: 'legs', equipment: 'machine', isCompound: true, pattern: 'squat' },
  { id: 'box-squat', nameJa: 'ボックススクワット', nameEn: 'Box Squat', musclePart: 'legs', equipment: 'barbell', isCompound: true, pattern: 'squat' },
  { id: 'overhead-squat', nameJa: 'オーバーヘッドスクワット', nameEn: 'Overhead Squat', musclePart: 'legs', equipment: 'barbell', isCompound: true, pattern: 'squat' },
  { id: 'pistol-squat', nameJa: 'ピストルスクワット', nameEn: 'Pistol Squat', musclePart: 'legs', equipment: 'bodyweight', isCompound: true, pattern: 'squat' },
  { id: 'sumo-squat', nameJa: 'スモウスクワット', nameEn: 'Sumo Squat', musclePart: 'legs', equipment: 'dumbbell', isCompound: true, pattern: 'squat' },
  { id: 'jump-squat', nameJa: 'ジャンプスクワット', nameEn: 'Jump Squat', musclePart: 'legs', equipment: 'bodyweight', isCompound: true, pattern: 'squat' },
  { id: 'sissy-squat', nameJa: 'シシースクワット', nameEn: 'Sissy Squat', musclePart: 'legs', equipment: 'bodyweight', isCompound: false, pattern: 'isolation' },
  { id: 'walking-lunge', nameJa: 'ウォーキングランジ', nameEn: 'Walking Lunge', musclePart: 'legs', equipment: 'dumbbell', isCompound: true, pattern: 'lunge' },
  { id: 'reverse-lunge', nameJa: 'リバースランジ', nameEn: 'Reverse Lunge', musclePart: 'legs', equipment: 'dumbbell', isCompound: true, pattern: 'lunge' },
  { id: 'lateral-lunge', nameJa: 'サイドランジ', nameEn: 'Lateral Lunge', musclePart: 'legs', equipment: 'dumbbell', isCompound: true, pattern: 'lunge' },
  { id: 'curtsy-lunge', nameJa: 'カーツィランジ', nameEn: 'Curtsy Lunge', musclePart: 'legs', equipment: 'dumbbell', isCompound: true, pattern: 'lunge' },
  { id: 'step-up', nameJa: 'ステップアップ', nameEn: 'Step-Up', musclePart: 'legs', equipment: 'dumbbell', isCompound: true, pattern: 'lunge' },
  { id: 'stiff-leg-deadlift', nameJa: 'スティッフレッグデッドリフト', nameEn: 'Stiff-Leg Deadlift', musclePart: 'legs', equipment: 'barbell', isCompound: true, pattern: 'hinge' },
  { id: 'single-leg-rdl', nameJa: 'シングルレッグRDL', nameEn: 'Single-Leg Romanian Deadlift', musclePart: 'legs', equipment: 'dumbbell', isCompound: true, pattern: 'hinge' },
  { id: 'glute-bridge', nameJa: 'グルートブリッジ', nameEn: 'Glute Bridge', musclePart: 'legs', equipment: 'bodyweight', isCompound: false, pattern: 'hinge' },
  { id: 'cable-hip-thrust', nameJa: 'ケーブルヒップスラスト', nameEn: 'Cable Hip Thrust', musclePart: 'legs', equipment: 'cable', isCompound: true, pattern: 'hinge' },
  { id: 'seated-leg-curl', nameJa: 'シーテッドレッグカール', nameEn: 'Seated Leg Curl', musclePart: 'legs', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'nordic-hamstring-curl', nameJa: 'ノルディックハムストリングカール', nameEn: 'Nordic Hamstring Curl', musclePart: 'legs', equipment: 'bodyweight', isCompound: false, pattern: 'isolation' },
  { id: 'adductor-machine', nameJa: 'アダクターマシン', nameEn: 'Hip Adductor Machine', musclePart: 'legs', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'abductor-machine', nameJa: 'アブダクターマシン', nameEn: 'Hip Abductor Machine', musclePart: 'legs', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'cable-kickback', nameJa: 'ケーブルキックバック', nameEn: 'Cable Glute Kickback', musclePart: 'legs', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'donkey-kick', nameJa: 'ドンキーキック', nameEn: 'Donkey Kick', musclePart: 'legs', equipment: 'bodyweight', isCompound: false, pattern: 'isolation' },
  { id: 'fire-hydrant', nameJa: 'ファイヤーハイドラント', nameEn: 'Fire Hydrant', musclePart: 'legs', equipment: 'bodyweight', isCompound: false, pattern: 'isolation' },
  { id: 'seated-calf-raise', nameJa: 'シーテッドカーフレイズ', nameEn: 'Seated Calf Raise', musclePart: 'legs', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'standing-calf-raise', nameJa: 'スタンディングカーフレイズ', nameEn: 'Standing Calf Raise Machine', musclePart: 'legs', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'leg-press-calf-raise', nameJa: 'レッグプレスカーフレイズ', nameEn: 'Leg Press Calf Raise', musclePart: 'legs', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'single-leg-calf-raise', nameJa: 'シングルレッグカーフレイズ', nameEn: 'Single-Leg Calf Raise', musclePart: 'legs', equipment: 'bodyweight', isCompound: false, pattern: 'isolation' },
  { id: 'wall-sit', nameJa: 'ウォールシット', nameEn: 'Wall Sit', musclePart: 'legs', equipment: 'bodyweight', isCompound: false, pattern: 'isolation' },
  { id: 'zercher-squat', nameJa: 'ザーチャースクワット', nameEn: 'Zercher Squat', musclePart: 'legs', equipment: 'barbell', isCompound: true, pattern: 'squat' },
  { id: 'belt-squat', nameJa: 'ベルトスクワット', nameEn: 'Belt Squat', musclePart: 'legs', equipment: 'machine', isCompound: true, pattern: 'squat' },
] as const;

const SHOULDERS_EXERCISES: readonly ExerciseDef[] = [
  { id: 'shoulder-press', nameJa: 'ショルダープレス', nameEn: 'Shoulder Press', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: true, pattern: 'v-push',
    recommended: { sets: 3, reps: 12, defaultWeightKg: 10,
      coachTipJa: '肩がすくまないように、耳から肩を離した状態で真上に押し上げます。',
      coachTipEn: 'Keep your shoulders down — press straight up with ears away from shoulders.' },
    video: ytVideo('Shoulder Press') },
  { id: 'side-raise', nameJa: 'サイドレイズ', nameEn: 'Lateral Raise', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: false, pattern: 'isolation',
    recommended: { sets: 3, reps: 15, defaultWeightKg: 5,
      coachTipJa: '小指側を少し高くして、三角筋中部を意識して真横に上げましょう。',
      coachTipEn: 'Lead with your pinky slightly higher to isolate the lateral deltoid.' },
    video: ytVideo('Lateral Raise') },
  { id: 'overhead-press', nameJa: 'オーバーヘッドプレス', nameEn: 'Overhead Press', musclePart: 'shoulders', equipment: 'barbell', isCompound: true, pattern: 'v-push',
    video: ytVideo('Overhead Press') },
  { id: 'front-raise', nameJa: 'フロントレイズ', nameEn: 'Front Raise', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'rear-delt-fly', nameJa: 'リアデルトフライ', nameEn: 'Rear Delt Fly', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'upright-row', nameJa: 'アップライトロウ', nameEn: 'Upright Row', musclePart: 'shoulders', equipment: 'barbell', isCompound: true, pattern: 'v-pull' },
  { id: 'face-pull', nameJa: 'フェイスプル', nameEn: 'Face Pull', musclePart: 'shoulders', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'arnold-press', nameJa: 'アーノルドプレス', nameEn: 'Arnold Press', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: true, pattern: 'v-push' },
  { id: 'machine-shoulder-press', nameJa: 'マシンショルダープレス', nameEn: 'Machine Shoulder Press', musclePart: 'shoulders', equipment: 'machine', isCompound: true, pattern: 'v-push' },
  { id: 'pike-push-up', nameJa: 'パイクプッシュアップ', nameEn: 'Pike Push-Up', musclePart: 'shoulders', equipment: 'bodyweight', isCompound: true, pattern: 'v-push' },
  // ── new ──────────────────────────────────────────────────────────────────
  { id: 'push-press', nameJa: 'プッシュプレス', nameEn: 'Push Press', musclePart: 'shoulders', equipment: 'barbell', isCompound: true, pattern: 'v-push' },
  { id: 'seated-dumbbell-press', nameJa: 'シーテッドダンベルプレス', nameEn: 'Seated Dumbbell Press', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: true, pattern: 'v-push' },
  { id: 'behind-neck-press', nameJa: 'ビハインドネックプレス', nameEn: 'Behind-the-Neck Press', musclePart: 'shoulders', equipment: 'barbell', isCompound: true, pattern: 'v-push' },
  { id: 'landmine-shoulder-press', nameJa: 'ランドマインショルダープレス', nameEn: 'Landmine Shoulder Press', musclePart: 'shoulders', equipment: 'barbell', isCompound: true, pattern: 'v-push' },
  { id: 'cable-lateral-raise', nameJa: 'ケーブルサイドレイズ', nameEn: 'Cable Lateral Raise', musclePart: 'shoulders', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'machine-lateral-raise', nameJa: 'マシンサイドレイズ', nameEn: 'Machine Lateral Raise', musclePart: 'shoulders', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'leaning-lateral-raise', nameJa: 'リーニングサイドレイズ', nameEn: 'Leaning Cable Lateral Raise', musclePart: 'shoulders', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'cable-front-raise', nameJa: 'ケーブルフロントレイズ', nameEn: 'Cable Front Raise', musclePart: 'shoulders', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'plate-front-raise', nameJa: 'プレートフロントレイズ', nameEn: 'Plate Front Raise', musclePart: 'shoulders', equipment: 'bodyweight', isCompound: false, pattern: 'isolation' },
  { id: 'cable-rear-delt-fly', nameJa: 'ケーブルリアデルトフライ', nameEn: 'Cable Rear Delt Fly', musclePart: 'shoulders', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'reverse-pec-deck', nameJa: 'リバースペックデック', nameEn: 'Reverse Pec Deck', musclePart: 'shoulders', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'bent-over-rear-delt-raise', nameJa: 'ベントオーバーリアレイズ', nameEn: 'Bent-Over Rear Delt Raise', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'cable-upright-row', nameJa: 'ケーブルアップライトロウ', nameEn: 'Cable Upright Row', musclePart: 'shoulders', equipment: 'cable', isCompound: true, pattern: 'v-pull' },
  { id: 'dumbbell-upright-row', nameJa: 'ダンベルアップライトロウ', nameEn: 'Dumbbell Upright Row', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: true, pattern: 'v-pull' },
  { id: 'cuban-press', nameJa: 'キューバンプレス', nameEn: 'Cuban Press', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'external-rotation', nameJa: 'エクスターナルローテーション', nameEn: 'Cable External Rotation', musclePart: 'shoulders', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'internal-rotation', nameJa: 'インターナルローテーション', nameEn: 'Cable Internal Rotation', musclePart: 'shoulders', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'y-raise', nameJa: 'Yレイズ', nameEn: 'Y-Raise', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'handstand-push-up', nameJa: 'ハンドスタンドプッシュアップ', nameEn: 'Handstand Push-Up', musclePart: 'shoulders', equipment: 'bodyweight', isCompound: true, pattern: 'v-push' },
  { id: 'z-press', nameJa: 'Zプレス', nameEn: 'Z Press', musclePart: 'shoulders', equipment: 'barbell', isCompound: true, pattern: 'v-push' },
  { id: 'lu-raise', nameJa: 'ルーレイズ', nameEn: 'Lu Raise', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'overhead-carry', nameJa: 'オーバーヘッドキャリー', nameEn: "Waiter's Carry", musclePart: 'shoulders', equipment: 'dumbbell', isCompound: true, pattern: 'carry' },
] as const;

const ARMS_EXERCISES: readonly ExerciseDef[] = [
  { id: 'arm-curl', nameJa: 'アームカール', nameEn: 'Biceps Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation',
    recommended: { sets: 3, reps: 12, defaultWeightKg: 8,
      coachTipJa: '肘の位置をしっかりと固定し、反動を使わずに二頭筋の力だけで持ち上げて！',
      coachTipEn: 'Lock your elbows in place and curl using only your biceps — no swinging!' },
    video: ytVideo('Biceps Curl') },
  { id: 'triceps-pressdown', nameJa: 'トライセプスプレスダウン', nameEn: 'Triceps Pressdown', musclePart: 'arms', equipment: 'cable', isCompound: false, pattern: 'isolation',
    recommended: { sets: 3, reps: 12, defaultWeightKg: 15,
      coachTipJa: '肘を体の横に固定したまま、前腕だけを動かして三頭筋を収縮させましょう。',
      coachTipEn: 'Keep elbows pinned to your sides and move only your forearms to fully squeeze the triceps.' },
    video: ytVideo('Triceps Pressdown') },
  { id: 'barbell-curl', nameJa: 'バーベルカール', nameEn: 'Barbell Curl', musclePart: 'arms', equipment: 'barbell', isCompound: false, pattern: 'isolation' },
  { id: 'hammer-curl', nameJa: 'ハンマーカール', nameEn: 'Hammer Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'incline-dumbbell-curl', nameJa: 'インクラインダンベルカール', nameEn: 'Incline Dumbbell Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'skull-crusher', nameJa: 'スカルクラッシャー', nameEn: 'Skull Crusher', musclePart: 'arms', equipment: 'barbell', isCompound: false, pattern: 'isolation' },
  { id: 'overhead-triceps-extension', nameJa: 'オーバーヘッドエクステンション', nameEn: 'Overhead Triceps Extension', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'cable-curl', nameJa: 'ケーブルカール', nameEn: 'Cable Curl', musclePart: 'arms', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'close-grip-bench-press', nameJa: 'ナローベンチプレス', nameEn: 'Close-Grip Bench Press', musclePart: 'arms', equipment: 'barbell', isCompound: true, pattern: 'h-push' },
  { id: 'triceps-kickback', nameJa: 'キックバック', nameEn: 'Triceps Kickback', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  // ── new ──────────────────────────────────────────────────────────────────
  { id: 'ez-bar-curl', nameJa: 'EZバーカール', nameEn: 'EZ-Bar Curl', musclePart: 'arms', equipment: 'barbell', isCompound: false, pattern: 'isolation' },
  { id: 'preacher-curl', nameJa: 'プリーチャーカール', nameEn: 'Preacher Curl', musclePart: 'arms', equipment: 'barbell', isCompound: false, pattern: 'isolation' },
  { id: 'machine-preacher-curl', nameJa: 'マシンプリーチャーカール', nameEn: 'Machine Preacher Curl', musclePart: 'arms', equipment: 'machine', isCompound: false, pattern: 'isolation' },
  { id: 'concentration-curl', nameJa: 'コンセントレーションカール', nameEn: 'Concentration Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'spider-curl', nameJa: 'スパイダーカール', nameEn: 'Spider Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'drag-curl', nameJa: 'ドラッグカール', nameEn: 'Drag Curl', musclePart: 'arms', equipment: 'barbell', isCompound: false, pattern: 'isolation' },
  { id: 'zottman-curl', nameJa: 'ゾットマンカール', nameEn: 'Zottman Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'reverse-curl', nameJa: 'リバースカール', nameEn: 'Reverse Curl', musclePart: 'arms', equipment: 'barbell', isCompound: false, pattern: 'isolation' },
  { id: 'cross-body-hammer-curl', nameJa: 'クロスボディハンマーカール', nameEn: 'Cross-Body Hammer Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'rope-hammer-curl', nameJa: 'ロープハンマーカール', nameEn: 'Rope Hammer Curl', musclePart: 'arms', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'seated-dumbbell-curl', nameJa: 'シーテッドダンベルカール', nameEn: 'Seated Dumbbell Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'triceps-rope-pressdown', nameJa: 'ローププレスダウン', nameEn: 'Triceps Rope Pressdown', musclePart: 'arms', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'overhead-cable-extension', nameJa: 'オーバーヘッドケーブルエクステンション', nameEn: 'Overhead Cable Triceps Extension', musclePart: 'arms', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'lying-triceps-extension', nameJa: 'ライイングトライセプスエクステンション', nameEn: 'Lying Triceps Extension', musclePart: 'arms', equipment: 'barbell', isCompound: false, pattern: 'isolation' },
  { id: 'dumbbell-skull-crusher', nameJa: 'ダンベルスカルクラッシャー', nameEn: 'Dumbbell Skull Crusher', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'single-arm-triceps-extension', nameJa: 'シングルアームトライセプスエクステンション', nameEn: 'Single-Arm Overhead Triceps Extension', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'bench-dip', nameJa: 'ベンチディップス', nameEn: 'Bench Dip', musclePart: 'arms', equipment: 'bodyweight', isCompound: true, pattern: 'h-push' },
  { id: 'diamond-push-up-triceps', nameJa: 'トライセプスプッシュアップ', nameEn: 'Triceps Push-Up', musclePart: 'arms', equipment: 'bodyweight', isCompound: true, pattern: 'h-push' },
  { id: 'jm-press', nameJa: 'JMプレス', nameEn: 'JM Press', musclePart: 'arms', equipment: 'barbell', isCompound: true, pattern: 'h-push' },
  { id: 'reverse-grip-triceps-pressdown', nameJa: 'リバースグリッププレスダウン', nameEn: 'Reverse-Grip Triceps Pressdown', musclePart: 'arms', equipment: 'cable', isCompound: false, pattern: 'isolation' },
  { id: 'wrist-curl', nameJa: 'リストカール', nameEn: 'Wrist Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'reverse-wrist-curl', nameJa: 'リバースリストカール', nameEn: 'Reverse Wrist Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'farmers-carry-forearm', nameJa: 'ファーマーズウォーク', nameEn: "Farmer's Walk (Forearm Focus)", musclePart: 'arms', equipment: 'dumbbell', isCompound: true, pattern: 'carry' },
  { id: 'plate-curl', nameJa: 'プレートカール', nameEn: 'Plate Curl', musclePart: 'arms', equipment: 'bodyweight', isCompound: false, pattern: 'isolation' },
  { id: '21s-curl', nameJa: '21カール', nameEn: '21s Bicep Curl', musclePart: 'arms', equipment: 'barbell', isCompound: false, pattern: 'isolation' },
  { id: 'waiter-curl', nameJa: 'ウェイターカール', nameEn: 'Waiter Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'incline-triceps-extension', nameJa: 'インクライントライセプスエクステンション', nameEn: 'Incline Triceps Extension', musclePart: 'arms', equipment: 'dumbbell', isCompound: false, pattern: 'isolation' },
  { id: 'machine-biceps-curl', nameJa: 'マシンバイセップスカール', nameEn: 'Machine Biceps Curl', musclePart: 'arms', equipment: 'machine', isCompound: false, pattern: 'isolation' },
] as const;

const ABS_EXERCISES: readonly ExerciseDef[] = [
  { id: 'crunch', nameJa: 'クランチ', nameEn: 'Crunch', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core',
    recommended: { sets: 3, reps: 15, defaultWeightKg: 0,
      coachTipJa: 'おへそを覗き込むようにして、お腹を上から潰していく感覚が大切です。',
      coachTipEn: 'Curl up as if trying to see your navel — imagine crushing your abs from the top down.' },
    video: ytVideo('Crunch') },
  { id: 'plank', nameJa: 'プランク', nameEn: 'Plank', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core',
    recommended: { sets: 3, reps: 30, defaultWeightKg: 0,
      coachTipJa: '腰が落ちないよう体を一直線に保ちながら、お腹に力を入れ続けましょう。',
      coachTipEn: 'Keep your body in a straight line — don\'t let your hips drop, and squeeze your core continuously.' },
    video: ytVideo('Plank') },
  { id: 'leg-raise', nameJa: 'レッグレイズ', nameEn: 'Leg Raise', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'russian-twist', nameJa: 'ロシアンツイスト', nameEn: 'Russian Twist', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'ab-roller', nameJa: 'アブローラー', nameEn: 'Ab Wheel Rollout', musclePart: 'abs', equipment: 'bodyweight', isCompound: true, pattern: 'core' },
  { id: 'hanging-leg-raise', nameJa: 'ハンギングレッグレイズ', nameEn: 'Hanging Leg Raise', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'cable-crunch', nameJa: 'ケーブルクランチ', nameEn: 'Cable Crunch', musclePart: 'abs', equipment: 'cable', isCompound: false, pattern: 'core' },
  { id: 'bicycle-crunch', nameJa: 'バイシクルクランチ', nameEn: 'Bicycle Crunch', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'side-plank', nameJa: 'サイドプランク', nameEn: 'Side Plank', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'mountain-climber', nameJa: 'マウンテンクライマー', nameEn: 'Mountain Climber', musclePart: 'abs', equipment: 'bodyweight', isCompound: true, pattern: 'core' },
  // ── new ──────────────────────────────────────────────────────────────────
  { id: 'hanging-knee-raise', nameJa: 'ハンギングニーレイズ', nameEn: 'Hanging Knee Raise', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'captains-chair-leg-raise', nameJa: 'キャプテンズチェアレッグレイズ', nameEn: "Captain's Chair Leg Raise", musclePart: 'abs', equipment: 'machine', isCompound: false, pattern: 'core' },
  { id: 'reverse-crunch', nameJa: 'リバースクランチ', nameEn: 'Reverse Crunch', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'v-up', nameJa: 'Vアップ', nameEn: 'V-Up', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'flutter-kick', nameJa: 'フラッターキック', nameEn: 'Flutter Kick', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'scissor-kick', nameJa: 'シザーキック', nameEn: 'Scissor Kick', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'toe-touch', nameJa: 'トゥタッチ', nameEn: 'Toe Touch', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'dead-bug', nameJa: 'デッドバグ', nameEn: 'Dead Bug', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'bird-dog', nameJa: 'バードドッグ', nameEn: 'Bird Dog', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'hollow-body-hold', nameJa: 'ホローボディホールド', nameEn: 'Hollow Body Hold', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'weighted-plank', nameJa: 'ウェイテッドプランク', nameEn: 'Weighted Plank', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'side-plank-rotation', nameJa: 'サイドプランクローテーション', nameEn: 'Side Plank Rotation', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'landmine-twist', nameJa: 'ランドマインツイスト', nameEn: 'Landmine Twist', musclePart: 'abs', equipment: 'barbell', isCompound: false, pattern: 'core' },
  { id: 'cable-woodchopper', nameJa: 'ケーブルウッドチョッパー', nameEn: 'Cable Woodchopper', musclePart: 'abs', equipment: 'cable', isCompound: false, pattern: 'core' },
  { id: 'pallof-press', nameJa: 'パロフプレス', nameEn: 'Pallof Press', musclePart: 'abs', equipment: 'cable', isCompound: false, pattern: 'core' },
  { id: 'sit-up', nameJa: 'シットアップ', nameEn: 'Sit-Up', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'weighted-sit-up', nameJa: 'ウェイテッドシットアップ', nameEn: 'Weighted Sit-Up', musclePart: 'abs', equipment: 'bodyweight', isCompound: false, pattern: 'core' },
  { id: 'machine-crunch', nameJa: 'マシンクランチ', nameEn: 'Machine Crunch', musclePart: 'abs', equipment: 'machine', isCompound: false, pattern: 'core' },
] as const;

export const EXERCISE_DB: readonly ExerciseDef[] = [
  ...CHEST_EXERCISES,
  ...BACK_EXERCISES,
  ...LEGS_EXERCISES,
  ...SHOULDERS_EXERCISES,
  ...ARMS_EXERCISES,
  ...ABS_EXERCISES,
] as const;

/** All exercises, optionally filtered to one muscle part. */
export function getExercises(part?: MusclePart): ExerciseDef[] {
  return part ? EXERCISE_DB.filter((e) => e.musclePart === part) : [...EXERCISE_DB];
}

/** Lookup by stable id; undefined when unknown. */
export function findExercise(id: string): ExerciseDef | undefined {
  return EXERCISE_DB.find((e) => e.id === id);
}
