export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  calories: number;
  protein: number; // grams
  fat: number;     // grams
  carbs: number;   // grams
  photoDataUrl?: string; // base64 — localStorage legacy, kept for backward compat
  photo_url?: string;    // Supabase Storage URL — replaces photoDataUrl post-migration
  addedAt: string; // ISO
}

export type MusclePart = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'abs';

export interface WorkoutEntry {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  category: 'strength' | 'cardio' | 'flexibility' | 'other';
  musclePart?: MusclePart;
  sets?: number;
  reps?: number;
  weight?: number; // kg
  duration?: number; // minutes
  notes?: string;
  addedAt: string;
}

export interface CoachMenu {
  id: string;
  name: string;
  musclePart: MusclePart;
  defaultWeight: number;
  defaultReps: number;
  defaultSets: number;
  coachTip: string;
}

export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number; // kg
  addedAt: string;
}

export interface DailyGoals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  water: number;    // ml per day, default 2000
  goalWeight?: number; // kg target
}

export type BadgeType =
  | 'streak3' | 'streak7' | 'streak30'
  | 'water_goal' | 'calorie_goal'
  | 'workout_master' | 'pr_achieved';

export interface Badge {
  id: string;
  type: BadgeType;
  name: string;
  description: string;
  icon: string;
  earnedAt: string; // ISO
}

export interface PersonalRecord {
  exerciseName: string;
  maxWeight: number;
  achievedAt: string; // ISO
  date: string; // YYYY-MM-DD
}

export interface AppData {
  foodEntries: FoodEntry[];
  workoutEntries: WorkoutEntry[];
  weightEntries: WeightEntry[];
  goals: DailyGoals;
  waterByDate: Record<string, number>; // date -> ml consumed
  badges: Badge[];
  personalRecords: Record<string, PersonalRecord>; // exercise name -> best PR
}

// ── Weekly Report (AI-generated, cached in DB) ────────────────

export type ReportAssessment = 'excellent' | 'good' | 'neutral' | 'warning';

export interface ReportSection {
  summary: string;
  assessment: ReportAssessment;
}

export interface WeeklyReport {
  weekStart:          string;          // YYYY-MM-DD (Monday)
  weightDelta:        number | null;   // kg change (negative = loss)
  avgCalories:        number;
  calorieGoal:        number;
  calorieAdherence:   number;          // % of days within ±200 kcal
  avgProtein:         number;
  proteinGoal:        number;
  proteinAdherence:   number;          // % of days hitting protein goal
  workoutDays:        number;
  hydrationScore:     number;          // % of days hitting water goal
  strengths:          string[];
  frictions:          string[];
  nextWeekTarget:     string;
  motivationMessage:  string;
  generatedAt:        string;          // ISO timestamp
}

// ── Daily Aggregation (server-side only, never stored) ────────

export interface DailyStat {
  date:             string;
  hasData:          boolean;
  totalCalories:    number;
  totalProtein:     number;
  calorieHit:       boolean;
  proteinHit:       boolean;
  waterHit:         boolean;
  workoutCount:     number;
  lateNightMeals:   number;  // meals after 21:00
  noBreakfast:      boolean;
  earliestMealHour: number | null;
  latestMealHour:   number | null;
}

// ── Analytics ─────────────────────────────────────────────────

export interface AdherenceScore {
  total:      number;  // 0-100 composite
  calorie:    number;  // sub-score contribution
  protein:    number;
  workout:    number;
  hydration:  number;
}

export interface WeightTrend {
  slope:              number;   // kg/day (negative = losing)
  predictedIn30Days:  number;   // kg
  projectedGoalDate:  string | null;  // YYYY-MM-DD or null
}

export interface WeeklyAverage {
  weekStart:    string;
  avgCalories:  number;
  avgProtein:   number;
  workoutDays:  number;
  avgWater:     number;
}
