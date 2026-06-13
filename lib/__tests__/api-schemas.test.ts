import { describe, expect, it } from 'vitest';
import {
  RecommendSchema,
  CoachSchema,
  HabitSchema,
  WeeklyReportSchema,
} from '../api-schemas';

// Representative *valid* payloads — these mirror what the typed client actually
// sends. The point of these tests is to prove the new runtime validation does
// NOT reject well-formed requests (the regression risk), while still rejecting
// the malformed shapes that previously crashed the handlers with a 500.

const validProfile = {
  age: 30,
  healthConditions: [] as string[],
  dietaryRestrictions: [] as string[],
  medications: [] as string[],
  fitnessGoal: 'maintenance',
  activityLevel: 'moderately_active',
};
const validGoals = { calories: 2000, protein: 150, fat: 60, carbs: 200, water: 2000 };

describe('RecommendSchema', () => {
  const valid = {
    profile: validProfile,
    goals: validGoals,
    today: '2026-06-14',
    todayCalories: 500,
    todayProtein: 30,
    todayFat: 10,
    todayCarbs: 60,
    waterConsumed: 500,
    recentFoodLog: [{ date: '2026-06-13', name: 'ご飯', calories: 200, mealType: 'lunch' }],
    recentWorkoutLog: [],
    streak: 3,
  };

  it('accepts a well-formed payload (weightKg optional, extra keys allowed)', () => {
    expect(RecommendSchema.safeParse(valid).success).toBe(true);
    expect(RecommendSchema.safeParse({ ...valid, weightKg: 70 }).success).toBe(true);
    expect(RecommendSchema.safeParse({ ...valid, weightKg: null }).success).toBe(true);
    expect(RecommendSchema.safeParse({ ...valid, extra: 'ignored' }).success).toBe(true);
  });

  it('rejects the empty profile/goals shape that previously 500-crashed', () => {
    expect(RecommendSchema.safeParse({ profile: {}, goals: {} }).success).toBe(false);
  });

  it('rejects a profile missing the arrays the route dereferences', () => {
    const badProfile = { ...valid, profile: { fitnessGoal: 'x', activityLevel: 'y' } };
    expect(RecommendSchema.safeParse(badProfile).success).toBe(false);
  });

  it('rejects wrong types and missing top-level arrays', () => {
    expect(RecommendSchema.safeParse({ ...valid, recentFoodLog: undefined }).success).toBe(false);
    expect(RecommendSchema.safeParse({ ...valid, todayCalories: '500' }).success).toBe(false);
  });
});

describe('CoachSchema', () => {
  const valid = {
    today: '2026-06-14',
    todayCalories: 500, todayProtein: 30, todayFat: 10, todayCarbs: 60,
    calorieGoal: 2000, proteinGoal: 150, fatGoal: 60, carbsGoal: 200,
    waterConsumed: 500, waterGoal: 2000,
    todayWorkouts: [],
    recentFoodLog: [],
    recentWorkoutLog: [],
    streak: 0,
  };

  it('accepts a well-formed payload with optional health fields omitted', () => {
    expect(CoachSchema.safeParse(valid).success).toBe(true);
    expect(CoachSchema.safeParse({ ...valid, healthConditions: ['高血圧'], medications: [] }).success).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(CoachSchema.safeParse({}).success).toBe(false);
  });
});

describe('HabitSchema', () => {
  const valid = {
    daysWithData: 7, totalDays: 7, avgDailyCalories: 1800, calorieGoal: 2000,
    lateNightEatingDays: 1, noBreakfastDays: 0, avgBreakfastHour: 8,
    workoutDays: 3, missedPostWorkoutDays: 0, streak: 5,
    dailySummary: [{ date: '2026-06-13', mealCount: 3 }],
  };

  it('accepts a well-formed payload (avgBreakfastHour may be null)', () => {
    expect(HabitSchema.safeParse(valid).success).toBe(true);
    expect(HabitSchema.safeParse({ ...valid, avgBreakfastHour: null }).success).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(HabitSchema.safeParse({}).success).toBe(false);
  });
});

describe('WeeklyReportSchema', () => {
  const valid = {
    startDate: '2026-06-08', endDate: '2026-06-14',
    calorieGoal: 2000, proteinGoal: 150, fatGoal: 60, carbsGoal: 200, waterGoal: 2000,
    dailyNutrition: [{ date: '2026-06-08', calories: 1900 }],
    workoutDays: 4, totalWorkouts: 6,
    weightStart: 70, weightEnd: null,
    streak: 7,
  };

  it('accepts a well-formed payload (weight bounds nullable, health optional)', () => {
    expect(WeeklyReportSchema.safeParse(valid).success).toBe(true);
    expect(WeeklyReportSchema.safeParse({ ...valid, weightStart: null }).success).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(WeeklyReportSchema.safeParse({}).success).toBe(false);
  });
});
