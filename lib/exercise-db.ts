/**
 * Curated static exercise database (phase B) — 10 exercises per muscle part.
 *
 * The 12 former RECOMMENDED_MENUS from app/workout/page.tsx live here as the
 * entries carrying `recommended` (defaults + coach tip); the rest form the
 * full picker. `nameJa` is the CANONICAL logging name — history and
 * personal_records are keyed by it (back-compat with all existing entries),
 * so it must never change once shipped. `nameEn` is display-only.
 *
 * Equipment powers the environment-aware AI suggestions (home users without
 * a machine/cable stack shouldn't be told to do lat pulldowns).
 */

import type { MusclePart } from '@/lib/types';

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';

export interface ExerciseRecommendation {
  sets: number;
  reps: number;
  /** Starting suggestion in kg (0 = bodyweight). */
  defaultWeightKg: number;
  coachTipJa: string;
  coachTipEn: string;
}

export interface ExerciseDef {
  id: string;
  nameJa: string;
  nameEn: string;
  musclePart: MusclePart;
  equipment: Equipment;
  isCompound: boolean;
  /** Present on the curated starter menus (former RECOMMENDED_MENUS). */
  recommended?: ExerciseRecommendation;
}

export const EXERCISE_DB: readonly ExerciseDef[] = [
  // ── Chest ────────────────────────────────────────────────────────────────
  { id: 'bench-press', nameJa: 'ベンチプレス', nameEn: 'Bench Press', musclePart: 'chest', equipment: 'barbell', isCompound: true,
    recommended: { sets: 3, reps: 10, defaultWeightKg: 40,
      coachTipJa: '大胸筋をしっかりストレッチさせる意識で、バーを胸まで下ろしましょう！',
      coachTipEn: 'Focus on stretching your chest as you lower the bar — bring it all the way to your chest!' } },
  { id: 'dumbbell-fly', nameJa: 'ダンベルフライ', nameEn: 'Dumbbell Fly', musclePart: 'chest', equipment: 'dumbbell', isCompound: false,
    recommended: { sets: 3, reps: 12, defaultWeightKg: 10,
      coachTipJa: 'トップポジションで顎を引くと、大胸筋上部まで強く収縮します！',
      coachTipEn: 'Tuck your chin at the top to engage the upper chest for a stronger contraction.' } },
  { id: 'incline-dumbbell-press', nameJa: 'インクラインダンベルプレス', nameEn: 'Incline Dumbbell Press', musclePart: 'chest', equipment: 'dumbbell', isCompound: true },
  { id: 'incline-bench-press', nameJa: 'インクラインベンチプレス', nameEn: 'Incline Bench Press', musclePart: 'chest', equipment: 'barbell', isCompound: true },
  { id: 'chest-press-machine', nameJa: 'チェストプレス', nameEn: 'Chest Press Machine', musclePart: 'chest', equipment: 'machine', isCompound: true },
  { id: 'pec-deck', nameJa: 'ペックデック', nameEn: 'Pec Deck Fly', musclePart: 'chest', equipment: 'machine', isCompound: false },
  { id: 'cable-crossover', nameJa: 'ケーブルクロスオーバー', nameEn: 'Cable Crossover', musclePart: 'chest', equipment: 'cable', isCompound: false },
  { id: 'push-up', nameJa: '腕立て伏せ', nameEn: 'Push-Up', musclePart: 'chest', equipment: 'bodyweight', isCompound: true },
  { id: 'dips', nameJa: 'ディップス', nameEn: 'Dips', musclePart: 'chest', equipment: 'bodyweight', isCompound: true },
  { id: 'dumbbell-pullover', nameJa: 'ダンベルプルオーバー', nameEn: 'Dumbbell Pullover', musclePart: 'chest', equipment: 'dumbbell', isCompound: false },

  // ── Back ─────────────────────────────────────────────────────────────────
  { id: 'lat-pulldown', nameJa: 'ラットプルダウン', nameEn: 'Lat Pulldown', musclePart: 'back', equipment: 'machine', isCompound: true,
    recommended: { sets: 3, reps: 10, defaultWeightKg: 35,
      coachTipJa: '胸を張り、バーを鎖骨に向かって引くことで背中に強烈に効きます。',
      coachTipEn: 'Puff your chest out and pull the bar toward your collarbone for maximum back engagement.' } },
  { id: 'deadlift', nameJa: 'デッドリフト', nameEn: 'Deadlift', musclePart: 'back', equipment: 'barbell', isCompound: true,
    recommended: { sets: 3, reps: 8, defaultWeightKg: 60,
      coachTipJa: '背中を絶対に丸めないように！お腹に力を入れて体幹を固定しましょう。',
      coachTipEn: 'Never round your back! Brace your core hard to keep your spine neutral throughout.' } },
  { id: 'bent-over-row', nameJa: 'ベントオーバーロウ', nameEn: 'Bent-Over Row', musclePart: 'back', equipment: 'barbell', isCompound: true },
  { id: 'one-arm-dumbbell-row', nameJa: 'ワンハンドロウ', nameEn: 'One-Arm Dumbbell Row', musclePart: 'back', equipment: 'dumbbell', isCompound: true },
  { id: 'pull-up', nameJa: '懸垂', nameEn: 'Pull-Up', musclePart: 'back', equipment: 'bodyweight', isCompound: true },
  { id: 'seated-cable-row', nameJa: 'シーテッドロウ', nameEn: 'Seated Cable Row', musclePart: 'back', equipment: 'cable', isCompound: true },
  { id: 't-bar-row', nameJa: 'Tバーロウ', nameEn: 'T-Bar Row', musclePart: 'back', equipment: 'barbell', isCompound: true },
  { id: 'back-extension', nameJa: 'バックエクステンション', nameEn: 'Back Extension', musclePart: 'back', equipment: 'bodyweight', isCompound: false },
  { id: 'dumbbell-shrug', nameJa: 'ダンベルシュラッグ', nameEn: 'Dumbbell Shrug', musclePart: 'back', equipment: 'dumbbell', isCompound: false },
  { id: 'straight-arm-pulldown', nameJa: 'ストレートアームプルダウン', nameEn: 'Straight-Arm Pulldown', musclePart: 'back', equipment: 'cable', isCompound: false },

  // ── Legs ─────────────────────────────────────────────────────────────────
  { id: 'barbell-squat', nameJa: 'バーベルスクワット', nameEn: 'Barbell Squat', musclePart: 'legs', equipment: 'barbell', isCompound: true,
    recommended: { sets: 3, reps: 8, defaultWeightKg: 50,
      coachTipJa: 'お尻を後ろに引くように。膝が内側に入らないよう注意してください！',
      coachTipEn: 'Push your hips back and keep your knees tracking over your toes — never let them cave in.' } },
  { id: 'leg-press', nameJa: 'レッグプレス', nameEn: 'Leg Press', musclePart: 'legs', equipment: 'machine', isCompound: true,
    recommended: { sets: 3, reps: 12, defaultWeightKg: 80,
      coachTipJa: '膝が90度になる位置まで深く下ろすと大腿四頭筋にしっかり効きます。',
      coachTipEn: 'Lower the platform until your knees reach 90° for full quad activation.' } },
  { id: 'lunge', nameJa: 'ランジ', nameEn: 'Lunge', musclePart: 'legs', equipment: 'dumbbell', isCompound: true },
  { id: 'leg-extension', nameJa: 'レッグエクステンション', nameEn: 'Leg Extension', musclePart: 'legs', equipment: 'machine', isCompound: false },
  { id: 'leg-curl', nameJa: 'レッグカール', nameEn: 'Leg Curl', musclePart: 'legs', equipment: 'machine', isCompound: false },
  { id: 'romanian-deadlift', nameJa: 'ルーマニアンデッドリフト', nameEn: 'Romanian Deadlift', musclePart: 'legs', equipment: 'barbell', isCompound: true },
  { id: 'bulgarian-split-squat', nameJa: 'ブルガリアンスクワット', nameEn: 'Bulgarian Split Squat', musclePart: 'legs', equipment: 'dumbbell', isCompound: true },
  { id: 'goblet-squat', nameJa: 'ゴブレットスクワット', nameEn: 'Goblet Squat', musclePart: 'legs', equipment: 'dumbbell', isCompound: true },
  { id: 'hip-thrust', nameJa: 'ヒップスラスト', nameEn: 'Hip Thrust', musclePart: 'legs', equipment: 'barbell', isCompound: true },
  { id: 'calf-raise', nameJa: 'カーフレイズ', nameEn: 'Calf Raise', musclePart: 'legs', equipment: 'bodyweight', isCompound: false },

  // ── Shoulders ────────────────────────────────────────────────────────────
  { id: 'shoulder-press', nameJa: 'ショルダープレス', nameEn: 'Shoulder Press', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: true,
    recommended: { sets: 3, reps: 12, defaultWeightKg: 10,
      coachTipJa: '肩がすくまないように、耳から肩を離した状態で真上に押し上げます。',
      coachTipEn: 'Keep your shoulders down — press straight up with ears away from shoulders.' } },
  { id: 'side-raise', nameJa: 'サイドレイズ', nameEn: 'Lateral Raise', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: false,
    recommended: { sets: 3, reps: 15, defaultWeightKg: 5,
      coachTipJa: '小指側を少し高くして、三角筋中部を意識して真横に上げましょう。',
      coachTipEn: 'Lead with your pinky slightly higher to isolate the lateral deltoid.' } },
  { id: 'overhead-press', nameJa: 'オーバーヘッドプレス', nameEn: 'Overhead Press', musclePart: 'shoulders', equipment: 'barbell', isCompound: true },
  { id: 'front-raise', nameJa: 'フロントレイズ', nameEn: 'Front Raise', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: false },
  { id: 'rear-delt-fly', nameJa: 'リアデルトフライ', nameEn: 'Rear Delt Fly', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: false },
  { id: 'upright-row', nameJa: 'アップライトロウ', nameEn: 'Upright Row', musclePart: 'shoulders', equipment: 'barbell', isCompound: true },
  { id: 'face-pull', nameJa: 'フェイスプル', nameEn: 'Face Pull', musclePart: 'shoulders', equipment: 'cable', isCompound: false },
  { id: 'arnold-press', nameJa: 'アーノルドプレス', nameEn: 'Arnold Press', musclePart: 'shoulders', equipment: 'dumbbell', isCompound: true },
  { id: 'machine-shoulder-press', nameJa: 'マシンショルダープレス', nameEn: 'Machine Shoulder Press', musclePart: 'shoulders', equipment: 'machine', isCompound: true },
  { id: 'pike-push-up', nameJa: 'パイクプッシュアップ', nameEn: 'Pike Push-Up', musclePart: 'shoulders', equipment: 'bodyweight', isCompound: true },

  // ── Arms ─────────────────────────────────────────────────────────────────
  { id: 'arm-curl', nameJa: 'アームカール', nameEn: 'Biceps Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false,
    recommended: { sets: 3, reps: 12, defaultWeightKg: 8,
      coachTipJa: '肘の位置をしっかりと固定し、反動を使わずに二頭筋の力だけで持ち上げて！',
      coachTipEn: 'Lock your elbows in place and curl using only your biceps — no swinging!' } },
  { id: 'triceps-pressdown', nameJa: 'トライセプスプレスダウン', nameEn: 'Triceps Pressdown', musclePart: 'arms', equipment: 'cable', isCompound: false,
    recommended: { sets: 3, reps: 12, defaultWeightKg: 15,
      coachTipJa: '肘を体の横に固定したまま、前腕だけを動かして三頭筋を収縮させましょう。',
      coachTipEn: 'Keep elbows pinned to your sides and move only your forearms to fully squeeze the triceps.' } },
  { id: 'barbell-curl', nameJa: 'バーベルカール', nameEn: 'Barbell Curl', musclePart: 'arms', equipment: 'barbell', isCompound: false },
  { id: 'hammer-curl', nameJa: 'ハンマーカール', nameEn: 'Hammer Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false },
  { id: 'incline-dumbbell-curl', nameJa: 'インクラインダンベルカール', nameEn: 'Incline Dumbbell Curl', musclePart: 'arms', equipment: 'dumbbell', isCompound: false },
  { id: 'skull-crusher', nameJa: 'スカルクラッシャー', nameEn: 'Skull Crusher', musclePart: 'arms', equipment: 'barbell', isCompound: false },
  { id: 'overhead-triceps-extension', nameJa: 'オーバーヘッドエクステンション', nameEn: 'Overhead Triceps Extension', musclePart: 'arms', equipment: 'dumbbell', isCompound: false },
  { id: 'cable-curl', nameJa: 'ケーブルカール', nameEn: 'Cable Curl', musclePart: 'arms', equipment: 'cable', isCompound: false },
  { id: 'close-grip-bench-press', nameJa: 'ナローベンチプレス', nameEn: 'Close-Grip Bench Press', musclePart: 'arms', equipment: 'barbell', isCompound: true },
  { id: 'triceps-kickback', nameJa: 'キックバック', nameEn: 'Triceps Kickback', musclePart: 'arms', equipment: 'dumbbell', isCompound: false },

  // ── Abs ──────────────────────────────────────────────────────────────────
  { id: 'crunch', nameJa: 'クランチ', nameEn: 'Crunch', musclePart: 'abs', equipment: 'bodyweight', isCompound: false,
    recommended: { sets: 3, reps: 15, defaultWeightKg: 0,
      coachTipJa: 'おへそを覗き込むようにして、お腹を上から潰していく感覚が大切です。',
      coachTipEn: 'Curl up as if trying to see your navel — imagine crushing your abs from the top down.' } },
  { id: 'plank', nameJa: 'プランク', nameEn: 'Plank', musclePart: 'abs', equipment: 'bodyweight', isCompound: false,
    recommended: { sets: 3, reps: 30, defaultWeightKg: 0,
      coachTipJa: '腰が落ちないよう体を一直線に保ちながら、お腹に力を入れ続けましょう。',
      coachTipEn: 'Keep your body in a straight line — don\'t let your hips drop, and squeeze your core continuously.' } },
  { id: 'leg-raise', nameJa: 'レッグレイズ', nameEn: 'Leg Raise', musclePart: 'abs', equipment: 'bodyweight', isCompound: false },
  { id: 'russian-twist', nameJa: 'ロシアンツイスト', nameEn: 'Russian Twist', musclePart: 'abs', equipment: 'bodyweight', isCompound: false },
  { id: 'ab-roller', nameJa: 'アブローラー', nameEn: 'Ab Wheel Rollout', musclePart: 'abs', equipment: 'bodyweight', isCompound: true },
  { id: 'hanging-leg-raise', nameJa: 'ハンギングレッグレイズ', nameEn: 'Hanging Leg Raise', musclePart: 'abs', equipment: 'bodyweight', isCompound: false },
  { id: 'cable-crunch', nameJa: 'ケーブルクランチ', nameEn: 'Cable Crunch', musclePart: 'abs', equipment: 'cable', isCompound: false },
  { id: 'bicycle-crunch', nameJa: 'バイシクルクランチ', nameEn: 'Bicycle Crunch', musclePart: 'abs', equipment: 'bodyweight', isCompound: false },
  { id: 'side-plank', nameJa: 'サイドプランク', nameEn: 'Side Plank', musclePart: 'abs', equipment: 'bodyweight', isCompound: false },
  { id: 'mountain-climber', nameJa: 'マウンテンクライマー', nameEn: 'Mountain Climber', musclePart: 'abs', equipment: 'bodyweight', isCompound: true },
] as const;

/** All exercises, optionally filtered to one muscle part. */
export function getExercises(part?: MusclePart): ExerciseDef[] {
  return part ? EXERCISE_DB.filter((e) => e.musclePart === part) : [...EXERCISE_DB];
}

/** Lookup by stable id; undefined when unknown. */
export function findExercise(id: string): ExerciseDef | undefined {
  return EXERCISE_DB.find((e) => e.id === id);
}
