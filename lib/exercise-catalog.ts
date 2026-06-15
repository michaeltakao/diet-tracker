/**
 * Static exercise catalog for the tap-to-select workout logger.
 *
 * Names and coach tips are reused verbatim from the two existing assets so we do
 * not invent new exercise data:
 *   1. `RECOMMENDED_MENUS` (formerly inline in `app/workout/page.tsx`) — supplies
 *      the 12 menus that ship with localized coach tips.
 *   2. `lib/data/training-plan.ts` built-in program templates — supply the extra
 *      compound/accessory movements (no coach tips; `coachTip` stays undefined).
 *
 * NOTE on per-part counts: the combined source pool holds ~29 distinct names, so
 * the richer groups (back/legs/arms) reach 6–8 entries while sparser groups
 * (chest/shoulders/abs) carry fewer. We deliberately do NOT pad to a fixed 6–8
 * because that would require inventing exercises the app never defined.
 *
 * `defaultWeight` is in kilograms (canonical storage unit) and is used only as a
 * first-session fallback; once an exercise has history the UI prefills from the
 * last logged session instead. `defaultWeight === 0` marks a bodyweight movement.
 */

import type { MusclePart } from '@/lib/types';

/** A selectable exercise. Keyed by muscle part in {@link EXERCISES_BY_PART}. */
export interface ExerciseDef {
  /** Display name; also the identity used to match workout history. */
  name: string;
  /** First-session fallback load in kg. 0 = bodyweight. */
  defaultWeight: number;
  /** First-session fallback repetitions (≥ 1). */
  defaultReps: number;
  /** First-session fallback set count (≥ 1). */
  defaultSets: number;
  /** Optional Japanese coaching cue (present only for the 12 ported menus). */
  coachTip?: string;
  /** Optional English coaching cue. */
  coachTipEn?: string;
}

/**
 * Exercises grouped by muscle part, in catalog (display) order.
 *
 * Within each part, the first entries are the ported `RECOMMENDED_MENUS` (with
 * coach tips); the remainder come from the training-plan templates. At runtime
 * the chip list is re-sorted by recency (see `orderByRecency`), so this order is
 * only the tie-breaker for exercises the user has no history with.
 */
export const EXERCISES_BY_PART: Record<MusclePart, ExerciseDef[]> = {
  chest: [
    { name: 'ベンチプレス', defaultWeight: 40, defaultReps: 10, defaultSets: 3,
      coachTip: '大胸筋をしっかりストレッチさせる意識で、バーを胸まで下ろしましょう！',
      coachTipEn: 'Focus on stretching your chest as you lower the bar — bring it all the way to your chest!' },
    { name: 'ダンベルフライ', defaultWeight: 10, defaultReps: 12, defaultSets: 3,
      coachTip: 'トップポジションで顎を引くと、大胸筋上部まで強く収縮します！',
      coachTipEn: 'Tuck your chin at the top to engage the upper chest for a stronger contraction.' },
    { name: 'インクラインダンベルプレス', defaultWeight: 20, defaultReps: 10, defaultSets: 3 },
    { name: 'インクラインプレス', defaultWeight: 45, defaultReps: 10, defaultSets: 3 },
  ],
  back: [
    { name: 'ラットプルダウン', defaultWeight: 35, defaultReps: 10, defaultSets: 3,
      coachTip: '胸を張り、バーを鎖骨に向かって引くことで背中に強烈に効きます。',
      coachTipEn: 'Puff your chest out and pull the bar toward your collarbone for maximum back engagement.' },
    { name: 'デッドリフト', defaultWeight: 60, defaultReps: 8, defaultSets: 3,
      coachTip: '背中を絶対に丸めないように！お腹に力を入れて体幹を固定しましょう。',
      coachTipEn: 'Never round your back! Brace your core hard to keep your spine neutral throughout.' },
    { name: 'ベントオーバーロウ', defaultWeight: 50, defaultReps: 8, defaultSets: 3 },
    { name: 'シーテッドロウ', defaultWeight: 50, defaultReps: 10, defaultSets: 3 },
    { name: 'フェイスプル', defaultWeight: 20, defaultReps: 12, defaultSets: 3 },
    { name: 'チンニング', defaultWeight: 0, defaultReps: 8, defaultSets: 3 },
  ],
  legs: [
    { name: 'バーベルスクワット', defaultWeight: 50, defaultReps: 8, defaultSets: 3,
      coachTip: 'お尻を後ろに引くように。膝が内側に入らないよう注意してください！',
      coachTipEn: 'Push your hips back and keep your knees tracking over your toes — never let them cave in.' },
    { name: 'レッグプレス', defaultWeight: 80, defaultReps: 12, defaultSets: 3,
      coachTip: '膝が90度になる位置まで深く下ろすと大腿四頭筋にしっかり効きます。',
      coachTipEn: 'Lower the platform until your knees reach 90° for full quad activation.' },
    { name: 'ルーマニアンデッドリフト', defaultWeight: 60, defaultReps: 10, defaultSets: 3 },
    { name: 'ブルガリアンスプリットスクワット', defaultWeight: 20, defaultReps: 10, defaultSets: 3 },
    { name: 'レッグエクステンション', defaultWeight: 35, defaultReps: 12, defaultSets: 3 },
    { name: 'レッグカール', defaultWeight: 30, defaultReps: 12, defaultSets: 3 },
    { name: 'カーフレイズ', defaultWeight: 40, defaultReps: 15, defaultSets: 4 },
    { name: 'グルートブリッジ', defaultWeight: 0, defaultReps: 15, defaultSets: 3 },
  ],
  shoulders: [
    { name: 'ショルダープレス', defaultWeight: 10, defaultReps: 12, defaultSets: 3,
      coachTip: '肩がすくまないように、耳から肩を離した状態で真上に押し上げます。',
      coachTipEn: 'Keep your shoulders down — press straight up with ears away from shoulders.' },
    { name: 'サイドレイズ', defaultWeight: 5, defaultReps: 15, defaultSets: 3,
      coachTip: '小指側を少し高くして、三角筋中部を意識して真横に上げましょう。',
      coachTipEn: 'Lead with your pinky slightly higher to isolate the lateral deltoid.' },
    { name: 'ダンベルプレス', defaultWeight: 16, defaultReps: 12, defaultSets: 3 },
  ],
  arms: [
    { name: 'アームカール', defaultWeight: 8, defaultReps: 12, defaultSets: 3,
      coachTip: '肘の位置をしっかりと固定し、反動を使わずに二頭筋の力だけで持ち上げて！',
      coachTipEn: 'Lock your elbows in place and curl using only your biceps — no swinging!' },
    { name: 'トライセプスプレスダウン', defaultWeight: 15, defaultReps: 12, defaultSets: 3,
      coachTip: '肘を体の横に固定したまま、前腕だけを動かして三頭筋を収縮させましょう。',
      coachTipEn: 'Keep elbows pinned to your sides and move only your forearms to fully squeeze the triceps.' },
    { name: 'バーベルカール', defaultWeight: 30, defaultReps: 10, defaultSets: 3 },
    { name: 'ハンマーカール', defaultWeight: 14, defaultReps: 12, defaultSets: 3 },
    { name: 'スカルクラッシャー', defaultWeight: 15, defaultReps: 12, defaultSets: 3 },
    { name: 'トライセップスEZ', defaultWeight: 20, defaultReps: 12, defaultSets: 3 },
  ],
  abs: [
    { name: 'クランチ', defaultWeight: 0, defaultReps: 15, defaultSets: 3,
      coachTip: 'おへそを覗き込むようにして、お腹を上から潰していく感覚が大切です。',
      coachTipEn: 'Curl up as if trying to see your navel — imagine crushing your abs from the top down.' },
    { name: 'プランク', defaultWeight: 0, defaultReps: 30, defaultSets: 3,
      coachTip: '腰が落ちないよう体を一直線に保ちながら、お腹に力を入れ続けましょう。',
      coachTipEn: "Keep your body in a straight line — don't let your hips drop, and squeeze your core continuously." },
  ],
};
