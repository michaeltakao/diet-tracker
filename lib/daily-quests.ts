/**
 * Solo Leveling daily quests — pure evaluation logic. Same shape as
 * checkAndAwardBadges() in lib/storage.ts: given today's data, determine
 * which conditions are met; the dual-write caller (lib/data/quests.ts)
 * decides what's newly-completed vs already-recorded and persists it.
 *
 * Five quest types: four base quests (one per any-log activity axis —
 * meal/workout/water/weight, mirroring the badge system's streak axes) plus
 * an all_complete bonus for finishing all four base quests in the same day.
 */

import type { AppData } from './types';

export type QuestType = 'meal' | 'workout' | 'water' | 'weight' | 'all_complete';

export interface Quest {
  type: QuestType;
  xp: number;
  completed: boolean;
}

export const QUEST_XP: Record<QuestType, number> = {
  meal: 10,
  workout: 20,
  water: 5,
  weight: 15,
  all_complete: 50,
};

type QuestData = Pick<AppData, 'foodEntries' | 'workoutEntries' | 'weightEntries' | 'waterByDate' | 'goals'>;

/**
 * Compute quest completion state for `today` from the given data snapshot.
 * Pure — no localStorage/Supabase reads. `opts.goalsAreReal` gates the water
 * quest the same way checkAndAwardBadges() gates water_goal/calorie_goal:
 * fabricated fresh-install goals (2000ml default) must never award a
 * "goal met" quest.
 */
export function generateDailyQuests(
  data: QuestData,
  today: string,
  opts?: { goalsAreReal?: boolean },
): Quest[] {
  const goalsAreReal = opts?.goalsAreReal ?? true;

  const mealDone = data.foodEntries.some((e) => e.date === today);
  const workoutDone = data.workoutEntries.some((e) => e.date === today);
  const weightDone = data.weightEntries.some((e) => e.date === today);

  const waterMl = data.waterByDate[today] ?? 0;
  const waterGoal = data.goals.water ?? 2000;
  const waterDone = goalsAreReal && waterMl >= waterGoal;

  const allComplete = mealDone && workoutDone && weightDone && waterDone;

  return [
    { type: 'meal',     xp: QUEST_XP.meal,     completed: mealDone },
    { type: 'workout',  xp: QUEST_XP.workout,  completed: workoutDone },
    { type: 'water',    xp: QUEST_XP.water,    completed: waterDone },
    { type: 'weight',   xp: QUEST_XP.weight,   completed: weightDone },
    { type: 'all_complete', xp: QUEST_XP.all_complete, completed: allComplete },
  ];
}

/**
 * Given today's full quest state and the set of quest types already
 * recorded as completed (from prior evaluations today), return only the
 * quests that are newly completed right now. Idempotent — calling twice in
 * the same day with the same `alreadyCompleted` set (updated after each
 * call, same convention as checkAndAwardBadges' hasBadge() gate) never
 * double-returns a quest.
 */
export function evaluateDailyQuests(
  data: AppData,
  today: string,
  alreadyCompleted: Set<QuestType>,
  opts?: { goalsAreReal?: boolean },
): Quest[] {
  const all = generateDailyQuests(data, today, opts);
  return all.filter((q) => q.completed && !alreadyCompleted.has(q.type));
}
