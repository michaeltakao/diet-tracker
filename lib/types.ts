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

export interface AppData {
  foodEntries: FoodEntry[];
  workoutEntries: WorkoutEntry[];
  weightEntries: WeightEntry[];
  goals: DailyGoals;
  waterByDate: Record<string, number>; // date -> ml consumed
}
