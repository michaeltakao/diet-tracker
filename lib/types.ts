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

export interface WorkoutEntry {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  category: 'strength' | 'cardio' | 'flexibility' | 'other';
  sets?: number;
  reps?: number;
  weight?: number; // kg
  duration?: number; // minutes
  notes?: string;
  addedAt: string;
}

export interface DailyGoals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface AppData {
  foodEntries: FoodEntry[];
  workoutEntries: WorkoutEntry[];
  goals: DailyGoals;
}
