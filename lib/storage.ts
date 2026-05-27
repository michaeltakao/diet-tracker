import { AppData, DailyGoals, FoodEntry, WeightEntry, WorkoutEntry } from './types';

const STORAGE_KEY = 'diet-tracker-v1';

const DEFAULT_GOALS: DailyGoals = {
  calories: 2000,
  protein: 150,
  fat: 60,
  carbs: 200,
  water: 2000,
};

const DEFAULT_DATA: AppData = {
  foodEntries: [],
  workoutEntries: [],
  weightEntries: [],
  goals: DEFAULT_GOALS,
  waterByDate: {},
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
      weightEntries: parsed.weightEntries ?? [],
      goals: { ...DEFAULT_GOALS, ...(parsed.goals ?? {}) },
      waterByDate: parsed.waterByDate ?? {},
    };
  } catch {
    return { ...DEFAULT_DATA, goals: { ...DEFAULT_GOALS } };
  }
}

export function saveAppData(data: AppData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Food ────────────────────────────────────────────────
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

export function getEntriesForDate(date: string): FoodEntry[] {
  const data = getAppData();
  return data.foodEntries.filter((e) => e.date === date);
}

/** Returns up to `limit` most recently added unique food names */
export function getRecentFoods(limit = 5): FoodEntry[] {
  const data = getAppData();
  const seen = new Set<string>();
  const recent: FoodEntry[] = [];
  const sorted = [...data.foodEntries].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  );
  for (const entry of sorted) {
    if (!seen.has(entry.name)) {
      seen.add(entry.name);
      recent.push(entry);
    }
    if (recent.length >= limit) break;
  }
  return recent;
}

// ── Workout ─────────────────────────────────────────────
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

export function getWorkoutsForDate(date: string): WorkoutEntry[] {
  const data = getAppData();
  return data.workoutEntries.filter((e) => e.date === date);
}

// ── Weight ───────────────────────────────────────────────
export function addWeightEntry(entry: WeightEntry): void {
  const data = getAppData();
  // Replace if same date already exists
  data.weightEntries = data.weightEntries.filter((e) => e.date !== entry.date);
  data.weightEntries.push(entry);
  data.weightEntries.sort((a, b) => a.date.localeCompare(b.date));
  saveAppData(data);
}

export function removeWeightEntry(id: string): void {
  const data = getAppData();
  data.weightEntries = data.weightEntries.filter((e) => e.id !== id);
  saveAppData(data);
}

export function getWeightEntries(days = 30): WeightEntry[] {
  const data = getAppData();
  return data.weightEntries.slice(-days);
}

export function getLatestWeight(): WeightEntry | undefined {
  const data = getAppData();
  return data.weightEntries.at(-1);
}

// ── Water ────────────────────────────────────────────────
export function getWaterForDate(date: string): number {
  const data = getAppData();
  return data.waterByDate[date] ?? 0;
}

export function addWater(date: string, ml: number): void {
  const data = getAppData();
  data.waterByDate[date] = (data.waterByDate[date] ?? 0) + ml;
  saveAppData(data);
}

export function setWater(date: string, ml: number): void {
  const data = getAppData();
  data.waterByDate[date] = Math.max(0, ml);
  saveAppData(data);
}

// ── Goals ────────────────────────────────────────────────
export function updateGoals(goals: DailyGoals): void {
  const data = getAppData();
  data.goals = goals;
  saveAppData(data);
}

// ── Streak ───────────────────────────────────────────────
export function getStreak(): number {
  const data = getAppData();
  const logged = new Set(data.foodEntries.map((e) => e.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (logged.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}
