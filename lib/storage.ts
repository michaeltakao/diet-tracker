import { AppData, Badge, BadgeType, DailyGoals, FoodEntry, PersonalRecord, RecommendationFeedback, WeightEntry, WorkoutEntry } from './types';

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
  badges: [],
  personalRecords: {},
  recommendationFeedback: [],
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
      badges: parsed.badges ?? [],
      personalRecords: parsed.personalRecords ?? {},
      recommendationFeedback: parsed.recommendationFeedback ?? [],
    };
  } catch {
    return { ...DEFAULT_DATA, goals: { ...DEFAULT_GOALS } };
  }
}

export function saveAppData(data: AppData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Recommendation feedback (Phase B: preference signals) ──

/** All stored recommendation feedback events. */
export function getRecommendationFeedback(): RecommendationFeedback[] {
  return getAppData().recommendationFeedback;
}

/**
 * Record an accept/reject/favorite reaction. At most one event is kept per
 * (itemType, itemName): a new reaction replaces any prior one (latest wins).
 */
export function addRecommendationFeedback(feedback: RecommendationFeedback): void {
  const data = getAppData();
  data.recommendationFeedback = [
    ...data.recommendationFeedback.filter(
      (f) => !(f.itemType === feedback.itemType && f.itemName === feedback.itemName),
    ),
    feedback,
  ];
  saveAppData(data);
}

/** Clear all recommendation feedback (e.g. on reset / sign-out). */
export function clearRecommendationFeedback(): void {
  const data = getAppData();
  data.recommendationFeedback = [];
  saveAppData(data);
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

export function updateFoodEntry(updated: FoodEntry): void {
  const data = getAppData();
  const idx = data.foodEntries.findIndex((e) => e.id === updated.id);
  if (idx === -1) return;
  data.foodEntries[idx] = updated;
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

// ── Badges ───────────────────────────────────────────────
export function getBadges(): Badge[] {
  return getAppData().badges ?? [];
}

export function hasBadge(type: BadgeType, date?: string): boolean {
  const badges = getBadges();
  if (date) {
    return badges.some((b) => b.type === type && b.earnedAt.startsWith(date));
  }
  return badges.some((b) => b.type === type);
}

export function addBadge(badge: Badge): void {
  const data = getAppData();
  if (!data.badges) data.badges = [];
  data.badges.push(badge);
  saveAppData(data);
}

// ── Personal Records ─────────────────────────────────────
export function getPersonalRecord(exerciseName: string): PersonalRecord | undefined {
  const data = getAppData();
  return (data.personalRecords ?? {})[exerciseName];
}

/**
 * Returns true if this is a new PR for the exercise.
 * Only tracks exercises with weight > 0.
 */
export function checkAndUpdatePR(exerciseName: string, weight: number, date: string): boolean {
  if (weight <= 0) return false;
  const data = getAppData();
  if (!data.personalRecords) data.personalRecords = {};
  const existing = data.personalRecords[exerciseName];
  if (!existing || weight > existing.maxWeight) {
    data.personalRecords[exerciseName] = {
      exerciseName,
      maxWeight: weight,
      achievedAt: new Date().toISOString(),
      date,
    };
    saveAppData(data);
    return true;
  }
  return false;
}

/**
 * Check all badge conditions and award any newly earned badges.
 * Returns array of newly awarded badges.
 */
export function checkAndAwardBadges(today: string): Badge[] {
  const newBadges: Badge[] = [];
  const data = getAppData();
  const streak = getStreak();

  const award = (badge: Omit<Badge, 'id' | 'earnedAt'>, dateCheck?: string) => {
    if (hasBadge(badge.type, dateCheck)) return;
    const full: Badge = { ...badge, id: crypto.randomUUID(), earnedAt: new Date().toISOString() };
    addBadge(full);
    newBadges.push(full);
  };

  // Streak badges (once ever)
  if (streak >= 3) award({ type: 'streak3', name: '🔥 3日連続！', description: '3日間連続して食事を記録しました！', icon: '🔥' });
  if (streak >= 7) award({ type: 'streak7', name: '🏆 1週間継続！', description: '7日間連続して食事を記録しました！', icon: '🏆' });
  if (streak >= 30) award({ type: 'streak30', name: '💎 1ヶ月継続！', description: '30日間連続して食事を記録しました！', icon: '💎' });

  // Water goal (once per day)
  const water = data.waterByDate[today] ?? 0;
  const waterGoal = data.goals.water ?? 2000;
  if (water >= waterGoal) {
    award({ type: 'water_goal', name: '💧 水分目標達成！', description: '今日の水分目標をクリアしました！', icon: '💧' }, today);
  }

  // Calorie goal within 200kcal below (once per day)
  const todayCals = data.foodEntries
    .filter((e) => e.date === today)
    .reduce((s, e) => s + e.calories, 0);
  const calGoal = data.goals.calories;
  if (todayCals > 0 && todayCals <= calGoal && todayCals >= calGoal - 200) {
    award({ type: 'calorie_goal', name: '🎯 カロリー目標達成！', description: 'カロリー目標をぴったりクリアしました！', icon: '🎯' }, today);
  }

  // Workout master: 5+ unique workout days in last 7 days (once ever)
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const workoutDays = new Set(
    data.workoutEntries
      .filter((w) => w.date >= weekAgo.toISOString().split('T')[0])
      .map((w) => w.date)
  );
  if (workoutDays.size >= 5) {
    award({ type: 'workout_master', name: '🏋️ ワークアウトマスター！', description: '7日間で5日以上トレーニングしました！', icon: '🏋️' });
  }

  return newBadges;
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
