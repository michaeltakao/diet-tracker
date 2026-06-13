/**
 * Runtime request schemas for the AI API routes.
 *
 * The handlers previously did `await request.json() as XRequest` — a
 * compile-time cast with no runtime check — so a malformed body dereferenced
 * `undefined` deep in prompt construction and surfaced as a 500 carrying the
 * raw exception text. These zod schemas mirror the existing request interfaces
 * so well-formed client payloads (already type-checked against the same shapes)
 * pass unchanged, while malformed bodies are rejected with a 400 before any
 * field access.
 *
 * Array elements are intentionally loose (`objectArray`) and objects use
 * `.loose()`: the goal is to stop the missing-top-level-field crash, not
 * to re-validate every nested field the client already types — this keeps the
 * false-rejection risk on valid payloads negligible.
 *
 * Secure-by-default input validation (zod) per the project security guidance.
 * Routes that already validate their input by hand (`analyze-food`,
 * `suggest-workout`) are intentionally not covered here.
 */
import { z } from 'zod';

/** An array of arbitrary objects — guards `.map`/`.length`/`.filter` on a
 *  non-array without constraining element contents. */
const objectArray = z.array(z.object({}).loose());
const stringArray = z.array(z.string());
/** A number that may be explicitly null (`number | null` in the interfaces). */
const nullableNumber = z.number().nullable();

const HealthProfile = z
  .object({
    age: nullableNumber.optional(),
    healthConditions: stringArray,
    dietaryRestrictions: stringArray,
    medications: stringArray,
    fitnessGoal: z.string(),
    activityLevel: z.string(),
  })
  .loose();

const Goals = z
  .object({
    calories: z.number(),
    protein: z.number(),
    fat: z.number(),
    carbs: z.number(),
  })
  .loose();

/** POST /api/recommend */
export const RecommendSchema = z
  .object({
    profile: HealthProfile,
    goals: Goals,
    today: z.string(),
    todayCalories: z.number(),
    todayProtein: z.number(),
    todayFat: z.number(),
    todayCarbs: z.number(),
    waterConsumed: z.number(),
    recentFoodLog: objectArray,
    recentWorkoutLog: objectArray,
    streak: z.number(),
    weightKg: nullableNumber.optional(),
  })
  .loose();

/** POST /api/coach */
export const CoachSchema = z
  .object({
    today: z.string(),
    todayCalories: z.number(),
    todayProtein: z.number(),
    todayFat: z.number(),
    todayCarbs: z.number(),
    calorieGoal: z.number(),
    proteinGoal: z.number(),
    fatGoal: z.number(),
    carbsGoal: z.number(),
    waterConsumed: z.number(),
    waterGoal: z.number(),
    todayWorkouts: objectArray,
    recentFoodLog: objectArray,
    recentWorkoutLog: objectArray,
    streak: z.number(),
    healthConditions: stringArray.optional(),
    medications: stringArray.optional(),
  })
  .loose();

/** POST /api/habit-report */
export const HabitSchema = z
  .object({
    daysWithData: z.number(),
    totalDays: z.number(),
    avgDailyCalories: z.number(),
    calorieGoal: z.number(),
    lateNightEatingDays: z.number(),
    noBreakfastDays: z.number(),
    avgBreakfastHour: nullableNumber,
    workoutDays: z.number(),
    missedPostWorkoutDays: z.number(),
    streak: z.number(),
    dailySummary: objectArray,
  })
  .loose();

/** POST /api/weekly-report */
export const WeeklyReportSchema = z
  .object({
    startDate: z.string(),
    endDate: z.string(),
    calorieGoal: z.number(),
    proteinGoal: z.number(),
    fatGoal: z.number(),
    carbsGoal: z.number(),
    waterGoal: z.number(),
    dailyNutrition: objectArray,
    workoutDays: z.number(),
    totalWorkouts: z.number(),
    weightStart: nullableNumber,
    weightEnd: nullableNumber,
    streak: z.number(),
    healthConditions: stringArray.optional(),
    medications: stringArray.optional(),
  })
  .loose();
