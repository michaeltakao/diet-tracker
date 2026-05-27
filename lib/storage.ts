import { AppData, DailyGoals, FoodEntry, WorkoutEntry } from './types';

const STORAGE_KEY = 'diet-tracker-v1';

const DEFAULT_GOALS: DailyGoals = {
  calories: 2000,
  protein: 150,
  fat: 60,
  carbs: 200,
};

const DEFAULT_DATA: AppData = {
  foodEntries: [],
  workoutEntries: [],
  goals: DEFAULT_GOALS,
};

export function getAppData(): AppData {
  if (typeof window === 'undefined') return DEFAULT_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATA, goals: { ...DEFAULT_GOALS } };
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      foodEntries: parsed.foodEntries ?? [],
      workoutEntries: parsed.workoutEntries ?? [],
      goals: parsed.goals ?? { ...DEFAULT_GOALS },
    };
  } catch {
    return { ...DEFAULT_DATA, goals: { ...DEFAULT_GOALS } };
  }
}

export function saveAppData(data: AppData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function addFoodEntry(entry: FoodEntry): void {
  const data = getAppData();
  data.foodEntries.push(entry);
  saveAppData(data);
}

export function removeFoodEntry(id: string): void {
  const data = getAppData();
  data.foodEntries = data.foodEntries.filter((e) => e.id !== id);
  saveAppData(data);
}

export function addWorkoutEntry(entry: WorkoutEntry): void {
  const data = getAppData();
  data.workoutEntries.push(entry);
  saveAppData(data);
}

export function removeWorkoutEntry(id: string): void {
  const data = getAppData();
  data.workoutEntries = data.workoutEntries.filter((e) => e.id !== id);
  saveAppData(data);
}

export function getEntriesForDate(date: string): FoodEntry[] {
  const data = getAppData();
  return data.foodEntries.filter((e) => e.date === date);
}

export function getWorkoutsForDate(date: string): WorkoutEntry[] {
  const data = getAppData();
  return data.workoutEntries.filter((e) => e.date === date);
}

export function updateGoals(goals: DailyGoals): void {
  const data = getAppData();
  data.goals = goals;
  saveAppData(data);
}
