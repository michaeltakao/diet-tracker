export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  calories: number;
  protein: number; // grams
  fat: number;     // grams
  carbs: number;   // grams
  photoDataUrl?: string; // base64
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
