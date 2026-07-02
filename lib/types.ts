/** Where a food entry's nutrition values came from. */
export type FoodSource = 'manual' | 'ai' | 'db' | 'barcode';

export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  // kcal/P/F/C are always the FINAL consumed values (already portion-scaled),
  // so TDEE, reports and streaks never need to know about servings.
  calories: number;
  protein: number; // grams
  fat: number;     // grams
  carbs: number;   // grams
  photoDataUrl?: string; // base64 — localStorage legacy, kept for backward compat
  photo_url?: string;    // Supabase Storage URL — replaces photoDataUrl post-migration
  addedAt: string; // ISO
  // ── Portion metadata (v2 logging; all optional for back-compat) ──
  servings?: number;      // e.g. 1.5 — multiplier applied to the base portion
  servingUnit?: string;   // e.g. '人前', '個', '100g'
  amountG?: number;       // absolute grams when known
  source?: FoodSource;    // provenance of the nutrition values
  sourceId?: string;      // food-db id / barcode EAN when source is 'db'/'barcode'
  sodiumMg?: number;      // future: medication-rules already reason about sodium
  fiberG?: number;
}

/** A food the user explicitly favorited (♡) — Phase B preference signal. */
export interface FavoriteFood {
  id: string;
  name: string;
  calories: number; // per base portion
  protein: number;
  fat: number;
  carbs: number;
  macroHighlight: string; // derived, feeds foodFeatures() vocabulary
  sourceId?: string;
  createdAt: string; // ISO
}

export interface MealTemplateItem {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** A saved meal ("save this meal" → one-tap re-log). */
export interface MealTemplate {
  id: string;
  name: string;
  mealType: FoodEntry['mealType'];
  items: MealTemplateItem[];
  createdAt: string; // ISO
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
  coachTipEn?: string;
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
  recommendationFeedback: RecommendationFeedback[]; // Phase B: preference signals
  favoriteFoods: FavoriteFood[];   // ♡ foods (Phase B signal + quick-add pills)
  mealTemplates: MealTemplate[];   // saved meals for one-tap re-log
}

// ── Health Profile (stored in localStorage + profiles table) ──

export type FitnessGoal =
  | 'weight_loss'
  | 'muscle_gain'
  | 'maintenance'
  | 'endurance'
  | 'flexibility';

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extra_active';

export interface UserHealthProfile {
  age:                 number | null;
  healthConditions:    string[];   // e.g. ['糖尿病', '高血圧']
  dietaryRestrictions: string[];   // e.g. ['ベジタリアン', 'グルテンフリー']
  medications:         string[];   // e.g. ['メトホルミン', 'ワーファリン']
  fitnessGoal:         FitnessGoal;
  activityLevel:       ActivityLevel;
}

export interface MedLogEntry {
  date:      string;    // YYYY-MM-DD
  takenMeds: string[];  // medication names taken today
}

// ── XAI Explanation ───────────────────────────────────────────

/**
 * A single factor contributing to an item's affinity score.
 * Computed client-side by lib/recommend-explain.ts — not stored server-side.
 */
export interface ExplanationFactor {
  label:     string;
  weight:    number;
  direction: 'positive' | 'negative';
}

// ── Personalized Recommendations (LLM output) ─────────────────

/**
 * A deterministic safety annotation attached to a recommendation, derived
 * from the static condition/medication rules — NOT from the LLM. `info` and
 * `caution` notes annotate; `contraindicated` notes cause the item to be
 * dropped before it ever reaches the user.
 */
export type SafetySeverity = 'contraindicated' | 'caution' | 'info';

export interface SafetyNote {
  severity: SafetySeverity;
  message:  string;
  source:   'condition' | 'medication';
  ref:      string;   // the triggering condition/medication, e.g. 'ワーファリン'
}

export interface RecommendedFood {
  name:           string;
  reason:         string;
  calories:       number;
  macroHighlight: string;        // e.g. "高タンパク・低脂質"
  macroFit?:      string;        // e.g. "残りタンパク質28gを補える" — content-based fit explanation
  safetyNotes?:   SafetyNote[];  // deterministic caution flags (contraindicated items are removed, not flagged)
}

export interface RecommendedExercise {
  name:     string;
  category: string;          // strength | cardio | flexibility | other
  duration: string;          // e.g. "30分"
  reason:   string;
}

export interface Recommendation {
  foods:            RecommendedFood[];
  exercises:        RecommendedExercise[];
  warnings:         string[];            // deterministically guaranteed: static rules merged with LLM warnings
  adjustedMacros:   DailyGoals | null;   // clamped to condition caps (e.g. CKD protein ≤ 0.8 g/kg)
  macroCapsApplied?: string[];           // human-readable record of any caps applied during clamping
  generatedAt:      string;              // ISO
}

// ── Recommendation feedback (Phase B: preference model) ───────

/** Explicit user reaction to a recommended item. */
export type FeedbackKind = 'accept' | 'reject' | 'favorite';

/**
 * A single accept/reject/♡ event on a recommended food or exercise. Used by
 * `lib/recommend-preference.ts` to learn a content-based affinity model and
 * re-rank future (safety-filtered) recommendations. At most one event is kept per
 * (itemType, itemName) — latest wins.
 */
export interface RecommendationFeedback {
  id:              string;              // uid
  itemType:        'food' | 'exercise';
  itemName:        string;
  kind:            FeedbackKind;
  macroHighlight?: string;              // food only — for macro content features
  category?:       string;              // exercise only — for category content features
  createdAt:       string;              // ISO timestamp
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

// ── Daily Check-in ────────────────────────────────────────────────────────

export interface DailyCheckIn {
  date:          string;                    // YYYY-MM-DD
  mood:          1 | 2 | 3 | 4 | 5;        // 気分 (1=最悪 … 5=最高)
  energy:        1 | 2 | 3 | 4 | 5;        // 体力 (1=消耗 … 5=絶好調)
  sleepHours:    number;                    // 睡眠時間
  sorenessAreas: MusclePart[];             // 筋肉痛部位
  notes?:        string;
}

export interface WorkoutSuggestion {
  proceed:           'full' | 'reduced' | 'alternative' | 'rest';
  sessionName:       string;
  adjustments:       string[];    // 種目ごとの調整メモ
  intensityNote:     string;      // 例: "今日は80%強度で"
  motivationMessage: string;
  recoveryTips:      string[];
  generatedAt:       string;      // ISO
}

// ── Training Plan ─────────────────────────────────────────────────────────

export interface PlannedExercise {
  id:            string;
  name:          string;
  musclePart:    MusclePart;
  sets:          number;
  repsMin:       number;
  repsMax:       number;
  targetWeight?: number;   // kg (optional starting suggestion)
  notes?:        string;
}

export interface TrainingSession {
  id:        string;
  name:      string;        // e.g. "Push Day", "Lower A"
  exercises: PlannedExercise[];
}

export interface TrainingProgram {
  id:           string;
  name:         string;
  description:  string;
  sessions:     TrainingSession[];
  /** dayOfWeek (0=Sun…6=Sat) → session id. Empty string = rest day. */
  weekSchedule: Record<number, string>;
  isActive:     boolean;
  createdAt:    string;
}
