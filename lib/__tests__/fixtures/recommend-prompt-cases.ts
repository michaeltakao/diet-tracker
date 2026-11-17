/**
 * Synthetic request bodies for the recommend-prompt equivalence test.
 * Each one reaches different branches of the prompt template: safety
 * injection present or absent, weight set or null, empty or non-empty logs,
 * unknown goal/activity labels (the fallback branch), and age null.
 * The matching `*.golden.txt` files were generated from the pre-refactor inline
 * template in app/api/recommend/route.ts @ 8eb631c.
 */
import type { RecommendRequest } from '@/lib/recommend-prompt';

export const PROMPT_FIXTURES: Record<string, RecommendRequest> = {
  'senior-warfarin-ckd': {
    profile: {
      age: 78,
      sex: 'female',
      healthConditions: ['腎臓病', '高血圧'],
      dietaryRestrictions: [],
      medications: ['ワーファリン', 'アムロジピン'],
      fitnessGoal: 'maintenance',
      activityLevel: 'sedentary',
    },
    goals: { calories: 1600, protein: 60, fat: 45, carbs: 220, water: 1800 },
    today: '2026-11-17',
    todayCalories: 650,
    todayProtein: 22,
    todayFat: 18,
    todayCarbs: 90,
    waterConsumed: 600,
    recentFoodLog: [
      { date: '2026-11-17', name: '白米', calories: 250, mealType: 'breakfast' },
      { date: '2026-11-16', name: '焼き鮭', calories: 180, mealType: 'dinner' },
    ],
    recentWorkoutLog: [{ date: '2026-11-15', name: '散歩', category: 'cardio' }],
    streak: 4,
    weightKg: 52,
  },
  'minor-no-weight': {
    profile: {
      age: 15,
      healthConditions: [],
      dietaryRestrictions: ['ベジタリアン'],
      medications: [],
      fitnessGoal: 'weight_loss',
      activityLevel: 'very_active',
    },
    goals: { calories: 2400, protein: 70, fat: 70, carbs: 350, water: 2000 },
    today: '2026-11-17',
    todayCalories: 0,
    todayProtein: 0,
    todayFat: 0,
    todayCarbs: 0,
    waterConsumed: 0,
    recentFoodLog: [],
    recentWorkoutLog: [],
    streak: 0,
  },
  'control-unknown-labels': {
    profile: {
      age: null,
      healthConditions: [],
      dietaryRestrictions: [],
      medications: [],
      // Deliberately outside the label maps → exercises the `?? raw value` fallback.
      fitnessGoal: 'unknown_goal' as never,
      activityLevel: 'unknown_level' as never,
    },
    goals: { calories: 2000, protein: 100, fat: 60, carbs: 250, water: 2000 },
    today: '2026-11-17',
    todayCalories: 2300,
    todayProtein: 120,
    todayFat: 80,
    todayCarbs: 260,
    waterConsumed: 2500,
    recentFoodLog: [],
    recentWorkoutLog: [],
    streak: 30,
    weightKg: null,
  },
};
