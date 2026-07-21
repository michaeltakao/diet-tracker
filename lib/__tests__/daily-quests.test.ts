/**
 * lib/daily-quests.ts pure-logic tests. No localStorage, no clock — `today`
 * is passed explicitly (same pattern as lib/streak.ts's pure suite); JST-day
 * boundary correctness is the caller's responsibility (jstToday()), already
 * covered by lib/__tests__/streak.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { generateDailyQuests, evaluateDailyQuests, QUEST_XP, type QuestType } from '../daily-quests';
import type { AppData, FoodEntry, WorkoutEntry, WeightEntry } from '../types';

const TODAY = '2026-07-20';
const YESTERDAY = '2026-07-19';

function food(date: string): FoodEntry {
  return { id: crypto.randomUUID(), date, mealType: 'breakfast', name: 'x', calories: 100, protein: 1, fat: 1, carbs: 1, addedAt: new Date().toISOString() };
}
function workout(date: string): WorkoutEntry {
  return { id: crypto.randomUUID(), date, name: 'x', category: 'strength', weight: 10, reps: 5, sets: 3, addedAt: new Date().toISOString() };
}
function weight(date: string): WeightEntry {
  return { id: crypto.randomUUID(), date, weight: 70, addedAt: new Date().toISOString() };
}

function baseData(overrides: Partial<Pick<AppData, 'foodEntries' | 'workoutEntries' | 'weightEntries' | 'waterByDate' | 'goals'>> = {}) {
  return {
    foodEntries: [],
    workoutEntries: [],
    weightEntries: [],
    waterByDate: {},
    goals: { calories: 2000, protein: 150, fat: 60, carbs: 200, water: 2000 },
    ...overrides,
  };
}

describe('generateDailyQuests', () => {
  it('all quests incomplete when there is no activity today', () => {
    const quests = generateDailyQuests(baseData(), TODAY);
    expect(quests.every((q) => !q.completed)).toBe(true);
  });

  it('meal quest completes independently on a food entry dated today', () => {
    const quests = generateDailyQuests(baseData({ foodEntries: [food(TODAY)] }), TODAY);
    const meal = quests.find((q) => q.type === 'meal')!;
    expect(meal.completed).toBe(true);
    expect(quests.filter((q) => q.type !== 'meal' && q.type !== 'all_complete').every((q) => !q.completed)).toBe(true);
  });

  it('workout quest completes independently on a workout entry dated today', () => {
    const quests = generateDailyQuests(baseData({ workoutEntries: [workout(TODAY)] }), TODAY);
    expect(quests.find((q) => q.type === 'workout')!.completed).toBe(true);
  });

  it('weight quest completes independently on a weight entry dated today', () => {
    const quests = generateDailyQuests(baseData({ weightEntries: [weight(TODAY)] }), TODAY);
    expect(quests.find((q) => q.type === 'weight')!.completed).toBe(true);
  });

  it('water quest completes when today\'s water meets the goal', () => {
    const quests = generateDailyQuests(baseData({ waterByDate: { [TODAY]: 2000 } }), TODAY);
    expect(quests.find((q) => q.type === 'water')!.completed).toBe(true);
  });

  it('water quest stays incomplete below goal', () => {
    const quests = generateDailyQuests(baseData({ waterByDate: { [TODAY]: 1999 } }), TODAY);
    expect(quests.find((q) => q.type === 'water')!.completed).toBe(false);
  });

  it('water quest is gated off by goalsAreReal:false even if the fabricated default is met', () => {
    const quests = generateDailyQuests(
      baseData({ waterByDate: { [TODAY]: 2000 } }),
      TODAY,
      { goalsAreReal: false },
    );
    expect(quests.find((q) => q.type === 'water')!.completed).toBe(false);
  });

  it('entries dated yesterday do not count toward today\'s quests', () => {
    const quests = generateDailyQuests(
      baseData({ foodEntries: [food(YESTERDAY)], workoutEntries: [workout(YESTERDAY)], weightEntries: [weight(YESTERDAY)] }),
      TODAY,
    );
    expect(quests.filter((q) => q.type !== 'all_complete').every((q) => !q.completed)).toBe(true);
  });

  it('all_complete fires only when all 4 base quests are done the same day', () => {
    const data = baseData({
      foodEntries: [food(TODAY)],
      workoutEntries: [workout(TODAY)],
      weightEntries: [weight(TODAY)],
      waterByDate: { [TODAY]: 2000 },
    });
    const quests = generateDailyQuests(data, TODAY);
    expect(quests.find((q) => q.type === 'all_complete')!.completed).toBe(true);
  });

  it('all_complete does NOT fire when only 3 of 4 base quests are done', () => {
    const data = baseData({
      foodEntries: [food(TODAY)],
      workoutEntries: [workout(TODAY)],
      weightEntries: [weight(TODAY)],
      // water missing
    });
    const quests = generateDailyQuests(data, TODAY);
    expect(quests.find((q) => q.type === 'all_complete')!.completed).toBe(false);
  });

  it('quest XP values match QUEST_XP', () => {
    const quests = generateDailyQuests(baseData(), TODAY);
    for (const q of quests) {
      expect(q.xp).toBe(QUEST_XP[q.type]);
    }
  });
});

describe('evaluateDailyQuests', () => {
  const fullAppData = (over: Partial<AppData> = {}): AppData => ({
    foodEntries: [], workoutEntries: [], weightEntries: [],
    goals: { calories: 2000, protein: 150, fat: 60, carbs: 200, water: 2000 },
    waterByDate: {}, badges: [], personalRecords: {}, recommendationFeedback: [],
    favoriteFoods: [], mealTemplates: [], streakState: { longest: 0, repairedDates: [] },
    vitalEntries: [], symptomEntries: [], xp: 0, highestRank: 'E',
    ...over,
  });

  it('returns only newly-completed quests, excluding ones already in alreadyCompleted', () => {
    const data = fullAppData({ foodEntries: [food(TODAY)], workoutEntries: [workout(TODAY)] });
    const already = new Set<QuestType>(['meal']);
    const newly = evaluateDailyQuests(data, TODAY, already);
    expect(newly.map((q) => q.type)).toEqual(['workout']);
  });

  it('is idempotent: calling twice with the same alreadyCompleted set never double-returns', () => {
    const data = fullAppData({ foodEntries: [food(TODAY)] });
    const already = new Set<QuestType>(['meal']);
    const newly = evaluateDailyQuests(data, TODAY, already);
    expect(newly).toEqual([]);
  });

  it('returns empty array when nothing is newly completed', () => {
    const data = fullAppData();
    const newly = evaluateDailyQuests(data, TODAY, new Set());
    expect(newly).toEqual([]);
  });

  it('all_complete can be newly-returned alongside the 4th base quest in the same call', () => {
    const data = fullAppData({
      foodEntries: [food(TODAY)],
      workoutEntries: [workout(TODAY)],
      weightEntries: [weight(TODAY)],
      waterByDate: { [TODAY]: 2000 },
    });
    // meal/workout/water already recorded from earlier today; weight is the
    // just-logged 4th quest, so both 'weight' and 'all_complete' should be
    // newly-returned in this single evaluation.
    const already = new Set<QuestType>(['meal', 'workout', 'water']);
    const newly = evaluateDailyQuests(data, TODAY, already).map((q) => q.type).sort();
    expect(newly).toEqual(['all_complete', 'weight']);
  });
});
