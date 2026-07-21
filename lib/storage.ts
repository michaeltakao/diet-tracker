import { AppData, Badge, BadgeType, DailyGoals, FavoriteFood, FoodEntry, MealTemplate, PersonalRecord, RecommendationFeedback, SymptomEntry, VitalEntry, WeightEntry, WorkoutEntry } from './types';
import { activityDaysFrom, computeStreak, jstToday } from './streak';
import type { RankId } from './rank';

const STORAGE_KEY = 'diet-tracker-v1';

const RANK_IDS: readonly RankId[] = ['E', 'D', 'C', 'B', 'A', 'S'];
function isRankId(v: unknown): v is RankId {
  return typeof v === 'string' && (RANK_IDS as readonly string[]).includes(v);
}

export const DEFAULT_GOALS: DailyGoals = {
  calories: 2000,
  protein: 150,
  fat: 60,
  carbs: 200,
  water: 2000,
};

/**
 * True when goals are byte-for-byte the fabricated fresh-install defaults.
 * Accepted false-negative: a user who manually saves exactly
 * 2000/150/60/200/2000 is treated as "no real goals"; false-positive is
 * impossible for wizard completers (goalWeight is deliberately ignored).
 */
export function goalsEqualDefaults(g: DailyGoals): boolean {
  return (
    g.calories === DEFAULT_GOALS.calories &&
    g.protein === DEFAULT_GOALS.protein &&
    g.fat === DEFAULT_GOALS.fat &&
    g.carbs === DEFAULT_GOALS.carbs &&
    g.water === DEFAULT_GOALS.water
  );
}

const DEFAULT_DATA: AppData = {
  foodEntries: [],
  workoutEntries: [],
  weightEntries: [],
  goals: DEFAULT_GOALS,
  waterByDate: {},
  badges: [],
  personalRecords: {},
  recommendationFeedback: [],
  favoriteFoods: [],
  mealTemplates: [],
  streakState: { longest: 0, repairedDates: [] },
  vitalEntries: [],
  symptomEntries: [],
  xp: 0,
  highestRank: 'E',
  earnedTitles: [],
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
      favoriteFoods: parsed.favoriteFoods ?? [],
      mealTemplates: parsed.mealTemplates ?? [],
      streakState: {
        longest: parsed.streakState?.longest ?? 0,
        repairedDates: parsed.streakState?.repairedDates ?? [],
      },
      vitalEntries: parsed.vitalEntries ?? [],
      symptomEntries: parsed.symptomEntries ?? [],
      xp: typeof parsed.xp === 'number' && parsed.xp >= 0 ? parsed.xp : 0,
      highestRank: isRankId(parsed.highestRank) ? parsed.highestRank : 'E',
      earnedTitles: Array.isArray(parsed.earnedTitles) ? parsed.earnedTitles : [],
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

// ── Favorite foods (Phase B signal + quick-add) ──────────
export function getFavoriteFoods(): FavoriteFood[] {
  return getAppData().favoriteFoods;
}

export function addFavoriteFood(fav: FavoriteFood): void {
  const data = getAppData();
  // one favorite per food name — replace any prior entry
  data.favoriteFoods = [
    ...data.favoriteFoods.filter((f) => f.name !== fav.name),
    fav,
  ];
  saveAppData(data);
}

export function removeFavoriteFood(name: string): void {
  const data = getAppData();
  data.favoriteFoods = data.favoriteFoods.filter((f) => f.name !== name);
  saveAppData(data);
}

// ── Meal templates ────────────────────────────────────────
export function getMealTemplates(): MealTemplate[] {
  return getAppData().mealTemplates;
}

export function addMealTemplate(tmpl: MealTemplate): void {
  const data = getAppData();
  data.mealTemplates.push(tmpl);
  saveAppData(data);
}

export function removeMealTemplate(id: string): void {
  const data = getAppData();
  data.mealTemplates = data.mealTemplates.filter((t) => t.id !== id);
  saveAppData(data);
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

// ── Vitals (per-measurement rows — record only, never interpreted) ──
export function addVitalEntry(entry: VitalEntry): void {
  const data = getAppData();
  data.vitalEntries.push(entry);
  saveAppData(data);
}

export function removeVitalEntry(id: string): void {
  const data = getAppData();
  data.vitalEntries = data.vitalEntries.filter((e) => e.id !== id);
  saveAppData(data);
}

export function getAllVitalEntries(): VitalEntry[] {
  return getAppData().vitalEntries;
}

export function getVitalEntriesForDate(date: string): VitalEntry[] {
  return getAppData().vitalEntries.filter((e) => e.date === date);
}

// ── Symptoms (per-event rows — record + display only, never diagnostic) ──
export function addSymptomEntry(entry: SymptomEntry): void {
  const data = getAppData();
  data.symptomEntries.push(entry);
  saveAppData(data);
}

export function removeSymptomEntry(id: string): void {
  const data = getAppData();
  data.symptomEntries = data.symptomEntries.filter((e) => e.id !== id);
  saveAppData(data);
}

export function getAllSymptomEntries(): SymptomEntry[] {
  return getAppData().symptomEntries;
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
 * Only tracks exercises with weight > 0. Weight remains the sole PR
 * criterion (and celebration trigger); est1RM is recorded alongside when
 * the session provided one (per-set logging, phase B).
 */
export function checkAndUpdatePR(
  exerciseName: string,
  weight: number,
  date: string,
  est1RM?: number,
): boolean {
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
      ...(est1RM != null && est1RM > 0 ? { est1RM } : {}),
    };
    saveAppData(data);
    return true;
  }
  return false;
}

/**
 * Check all badge conditions and award any newly earned badges.
 * Returns array of newly awarded badges.
 *
 * `opts.goalsAreReal === false` skips the goal-dependent badges
 * (water_goal, calorie_goal) so fabricated fresh-install defaults never
 * award a "goal achieved" badge.
 */
export function checkAndAwardBadges(today: string, opts?: { goalsAreReal?: boolean }): Badge[] {
  const goalsAreReal = opts?.goalsAreReal ?? true;
  const newBadges: Badge[] = [];
  const data = getAppData();
  const streak = getStreak();

  const award = (badge: Omit<Badge, 'id' | 'earnedAt'>, dateCheck?: string) => {
    if (hasBadge(badge.type, dateCheck)) return;
    const full: Badge = { ...badge, id: crypto.randomUUID(), earnedAt: new Date().toISOString() };
    addBadge(full);
    newBadges.push(full);
  };

  // First-log badges (once ever)
  if (data.foodEntries.length > 0) {
    award({ type: 'first_food', name: '🥇 はじめての食事記録！', description: '最初の食事を記録しました！', icon: '🥇' });
  }
  if (data.workoutEntries.length > 0) {
    award({ type: 'first_workout', name: '💪 はじめてのトレーニング！', description: '最初のワークアウトを記録しました！', icon: '💪' });
  }

  // Streak badges (once ever) — any-log streak: food OR workout OR weight OR water
  if (streak >= 3) award({ type: 'streak3', name: '🔥 3日連続！', description: '3日間連続して記録しました！', icon: '🔥' });
  if (streak >= 7) award({ type: 'streak7', name: '🏆 1週間継続！', description: '7日間連続して記録しました！', icon: '🏆' });
  if (streak >= 30) award({ type: 'streak30', name: '💎 1ヶ月継続！', description: '30日間連続して記録しました！', icon: '💎' });

  // Water goal (once per day) — only against real, user-set goals
  if (goalsAreReal) {
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
  }

  // Workout master: 5+ unique workout days in last 7 days (once ever)
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6); // inclusive 7-day window: today + preceding 6 days
  const workoutDays = new Set(
    data.workoutEntries
      .filter((w) => w.date >= weekAgo.toISOString().split('T')[0])
      .map((w) => w.date)
  );
  if (workoutDays.size >= 5) {
    award({ type: 'workout_master', name: '🏋️ ワークアウトマスター！', description: '7日間で5日以上トレーニングしました！', icon: '🏋️' });
  }

  // Vitals week: 5+ unique vital-log days in last 7 days (once ever)
  const vitalDays = new Set(
    data.vitalEntries
      .filter((v) => v.date >= weekAgo.toISOString().split('T')[0])
      .map((v) => v.date)
  );
  if (vitalDays.size >= 5) {
    award({ type: 'vitals_week', name: '🩺 バイタル記録週間！', description: '7日間で5日以上バイタルを記録しました！', icon: '🩺' });
  }

  return newBadges;
}

// ── Streak (any-log, JST boundary, weekly repair ticket) ─
// Pure math lives in lib/streak.ts; this section wires it to AppData and
// persists the side effects (longest-ever, consumed repair tickets).

export interface StreakSummary {
  current: number;
  longest: number;
  /** True when this ISO week's repair ticket has not been consumed. */
  repairAvailable: boolean;
}

/** Union of activity days (food / workout / weight / water>0) — JST keys. */
export function getActivityDays(): Set<string> {
  return activityDaysFrom(getAppData());
}

function refreshStreak(): StreakSummary {
  const data = getAppData();
  const result = computeStreak(activityDaysFrom(data), data.streakState, jstToday());
  const changed =
    result.longest !== data.streakState.longest ||
    result.repairedDates.join(',') !== data.streakState.repairedDates.join(',');
  if (changed) {
    data.streakState = { longest: result.longest, repairedDates: result.repairedDates };
    saveAppData(data);
  }
  return {
    current: result.current,
    longest: result.longest,
    repairAvailable: result.repairAvailable,
  };
}

/**
 * Current consecutive-day streak. Counts "any-log" days (food OR workout OR
 * weight OR water) on JST day boundaries; today is always grace. May consume
 * this week's repair ticket (persisted) when exactly one gap day is bridged.
 */
export function getStreak(): number {
  return refreshStreak().current;
}

/** Streak + longest + repair-ticket availability, for richer UI. */
export function getStreakState(): StreakSummary {
  return refreshStreak();
}
