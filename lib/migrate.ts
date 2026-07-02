/**
 * localStorage → Supabase one-way migration utility.
 *
 * Runs once per account on first authenticated login.
 * Migrates all historical data: food logs, workout logs, weight logs,
 * water logs, badges, personal records, and goal settings.
 *
 * Design properties:
 * - Idempotent   : safe to call multiple times (local flag + DB flag guard)
 * - Non-destructive : localStorage is never modified or cleared
 * - Fault-tolerant  : one bad record never aborts the migration
 * - Timeout-safe    : caller wraps in Promise.race (30 s recommended)
 *
 * STEP 7
 *
 * Telemetry log tags:
 *   [MIGRATION]          — progress info
 *   [MIGRATION_ERROR]    — per-table / per-record errors
 *   [MIGRATION_COMPLETE] — final summary
 *   [MIGRATION_SKIP]     — skipped with reason
 */

import { getAppData } from '@/lib/storage';
import { createClient } from '@/lib/supabase';
import type {
  FoodLogInsert,
  WorkoutLogInsert,
  WeightLogInsert,
  WaterLogInsert,
  BadgeInsert,
  PersonalRecordInsert,
  CheckinInsert,
  TrainingProgramInsert,
} from '@/lib/database.types';
import type { MealTypeEnum, WorkoutCatEnum, MusclePartEnum, BadgeTypeEnum, Json } from '@/lib/database.types';
import type { DailyCheckIn, TrainingProgram } from '@/lib/types';

function readCheckIns(): DailyCheckIn[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('diet-tracker-checkins');
    return raw ? Object.values(JSON.parse(raw) as Record<string, DailyCheckIn>) : [];
  } catch { return []; }
}

function readTrainingPrograms(): TrainingProgram[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('diet-tracker-training-plans');
    return raw ? (JSON.parse(raw) as TrainingProgram[]) : [];
  } catch { return []; }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MIGRATION_FLAG_KEY = 'diet-tracker-migration-v1';
const BATCH_SIZE = 50;

// ── Types (internal) ──────────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createClient>;

// ── Types (public) ────────────────────────────────────────────────────────────

export type MigrationStatus =
  | 'idle'
  | 'checking'
  | 'migrating'
  | 'success'
  | 'error'
  | 'skipped';

export interface MigrationResult {
  migrated: boolean;
  recordsMigrated: number;
  skippedReason?: string;
  summary?: MigrationSummary;
}

export interface MigrationSummary {
  foodLogs: number;
  workoutLogs: number;
  weightLogs: number;
  waterLogs: number;
  badges: number;
  checkins: number;
  trainingPrograms: number;
}

export interface LocalDataInfo {
  hasData: boolean;
  foodLogs: number;
  workoutLogs: number;
  weightLogs: number;
  waterLogs: number;
  badges: number;
  personalRecords: number;
}

export interface RemoteDataInfo {
  reachable: boolean;
  migratedAt: string | null;
}

// ── Validation helpers ────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_MEAL_TYPES  = new Set<string>(['breakfast', 'lunch', 'dinner', 'snack']);
const VALID_WORKOUT_CATS = new Set<string>(['strength', 'cardio', 'flexibility', 'other']);
const VALID_MUSCLE_PARTS = new Set<string>(['chest', 'back', 'legs', 'shoulders', 'arms', 'abs']);
const VALID_BADGE_TYPES  = new Set<string>([
  'streak3', 'streak7', 'streak30',
  'water_goal', 'calorie_goal',
  'workout_master', 'pr_achieved',
]);

function isValidDate(d: unknown): d is string {
  return typeof d === 'string' && DATE_RE.test(d);
}

function isValidIso(d: unknown): d is string {
  if (typeof d !== 'string') return false;
  return !isNaN(Date.parse(d));
}

/** Returns a valid UUID string. Generates a new one if input is not a valid UUID. */
function ensureUUID(id: unknown): string {
  if (typeof id === 'string' && UUID_RE.test(id)) return id;
  return crypto.randomUUID();
}

function clampPositive(n: unknown): number {
  const v = Number(n);
  return isNaN(v) ? 0 : Math.max(0, v);
}

// ── Row builders (return null = skip this record) ─────────────────────────────

function buildFoodRow(raw: unknown, userId: string): FoodLogInsert | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  if (!isValidDate(e['date'])) {
    console.warn('[MIGRATION_ERROR] food: invalid date — skipping', e['id']);
    return null;
  }
  if (!VALID_MEAL_TYPES.has(String(e['mealType'] ?? ''))) {
    console.warn('[MIGRATION_ERROR] food: invalid mealType — skipping', e['id']);
    return null;
  }
  const name = String(e['name'] ?? '').trim();
  if (name.length === 0) {
    console.warn('[MIGRATION_ERROR] food: empty name — skipping', e['id']);
    return null;
  }

  // Skip base64 photo data — cannot migrate to Storage in bulk
  const photoUrl = typeof e['photo_url'] === 'string' && !e['photo_url'].startsWith('data:')
    ? e['photo_url']
    : null;

  return {
    id:          ensureUUID(e['id']),
    user_id:     userId,
    logged_date: e['date'] as string,
    meal_type:   e['mealType'] as MealTypeEnum,
    name:        name.slice(0, 500),
    calories:    Math.round(clampPositive(e['calories'])),
    protein_g:   Number(clampPositive(e['protein']).toFixed(1)),
    fat_g:       Number(clampPositive(e['fat']).toFixed(1)),
    carbs_g:     Number(clampPositive(e['carbs']).toFixed(1)),
    photo_url:   photoUrl,
    logged_at:   isValidIso(e['addedAt']) ? e['addedAt'] as string : new Date().toISOString(),
  };
}

function buildWorkoutRow(raw: unknown, userId: string): WorkoutLogInsert | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  if (!isValidDate(e['date'])) {
    console.warn('[MIGRATION_ERROR] workout: invalid date — skipping', e['id']);
    return null;
  }
  if (!VALID_WORKOUT_CATS.has(String(e['category'] ?? ''))) {
    console.warn('[MIGRATION_ERROR] workout: invalid category — skipping', e['id']);
    return null;
  }
  const name = String(e['name'] ?? '').trim();
  if (name.length === 0) {
    console.warn('[MIGRATION_ERROR] workout: empty name — skipping', e['id']);
    return null;
  }

  const musclePart = VALID_MUSCLE_PARTS.has(String(e['musclePart'] ?? ''))
    ? (e['musclePart'] as MusclePartEnum)
    : null;

  return {
    id:           ensureUUID(e['id']),
    user_id:      userId,
    logged_date:  e['date'] as string,
    name:         name.slice(0, 500),
    category:     e['category'] as WorkoutCatEnum,
    muscle_part:  musclePart,
    sets:         e['sets']     != null ? Math.max(1, Math.round(Number(e['sets'])))     : null,
    reps:         e['reps']     != null ? Math.max(1, Math.round(Number(e['reps'])))     : null,
    weight_kg:    e['weight']   != null ? Math.max(0, Number(Number(e['weight']).toFixed(2)))   : null,
    duration_min: e['duration'] != null ? Math.max(1, Math.round(Number(e['duration']))) : null,
    notes:        typeof e['notes'] === 'string' ? e['notes'].slice(0, 1000) : null,
    logged_at:    isValidIso(e['addedAt']) ? e['addedAt'] as string : new Date().toISOString(),
  };
}

function buildWeightRow(raw: unknown, userId: string): WeightLogInsert | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  if (!isValidDate(e['date'])) {
    console.warn('[MIGRATION_ERROR] weight: invalid date — skipping', e['id']);
    return null;
  }
  const weight_kg = Number(Number(e['weight']).toFixed(2));
  if (isNaN(weight_kg) || weight_kg <= 0 || weight_kg >= 700) {
    console.warn('[MIGRATION_ERROR] weight: invalid weight — skipping', e['id']);
    return null;
  }

  return {
    id:          ensureUUID(e['id']),
    user_id:     userId,
    logged_date: e['date'] as string,
    weight_kg,
    logged_at:   isValidIso(e['addedAt']) ? e['addedAt'] as string : new Date().toISOString(),
  };
}

function buildWaterRow(date: string, totalMl: unknown, userId: string): WaterLogInsert | null {
  if (!isValidDate(date)) {
    console.warn('[MIGRATION_ERROR] water: invalid date — skipping', date);
    return null;
  }
  const total_ml = Math.max(0, Math.round(Number(totalMl) || 0));
  return { user_id: userId, logged_date: date, total_ml };
}

function buildBadgeRow(raw: unknown, userId: string): BadgeInsert | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;

  if (!VALID_BADGE_TYPES.has(String(b['type'] ?? ''))) {
    console.warn('[MIGRATION_ERROR] badge: invalid type — skipping', b['type']);
    return null;
  }
  const name        = String(b['name']        ?? '').trim();
  const description = String(b['description'] ?? '').trim();
  const icon        = String(b['icon']        ?? '').trim();
  if (!name || !description || !icon) {
    console.warn('[MIGRATION_ERROR] badge: missing required fields — skipping', b['id']);
    return null;
  }

  return {
    id:          ensureUUID(b['id']),
    user_id:     userId,
    type:        b['type'] as BadgeTypeEnum,
    name,
    description,
    icon,
    earned_at:   isValidIso(b['earnedAt']) ? b['earnedAt'] as string : new Date().toISOString(),
  };
}

function buildPRRow(raw: unknown, userId: string): PersonalRecordInsert | null {
  if (!raw || typeof raw !== 'object') return null;
  const pr = raw as Record<string, unknown>;

  const exercise_name = String(pr['exerciseName'] ?? '').trim();
  if (!exercise_name) {
    console.warn('[MIGRATION_ERROR] pr: empty exercise name — skipping');
    return null;
  }
  if (!isValidDate(pr['date'])) {
    console.warn('[MIGRATION_ERROR] pr: invalid date — skipping', exercise_name);
    return null;
  }
  const max_weight_kg = Number(Number(pr['maxWeight']).toFixed(2));
  if (isNaN(max_weight_kg) || max_weight_kg <= 0) {
    console.warn('[MIGRATION_ERROR] pr: invalid weight — skipping', exercise_name);
    return null;
  }

  return {
    user_id:       userId,
    exercise_name: exercise_name.slice(0, 500),
    max_weight_kg,
    achieved_date: pr['date'] as string,
    achieved_at:   isValidIso(pr['achievedAt']) ? pr['achievedAt'] as string : new Date().toISOString(),
  };
}

// ── Per-table upsert functions ─────────────────────────────────────────────────
// Each handles its own batching. Returns count of rows successfully upserted.

async function upsertFoodLogs(
  supabase: SupabaseClient,
  rows: FoodLogInsert[],
): Promise<number> {
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('food_logs').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.warn(`[MIGRATION_ERROR] food_logs batch ${i}:`, error.message);
    } else {
      count += chunk.length;
      console.info(`[MIGRATION] food_logs: ${count}/${rows.length}`);
    }
  }
  return count;
}

async function upsertWorkoutLogs(
  supabase: SupabaseClient,
  rows: WorkoutLogInsert[],
): Promise<number> {
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('workout_logs').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.warn(`[MIGRATION_ERROR] workout_logs batch ${i}:`, error.message);
    } else {
      count += chunk.length;
      console.info(`[MIGRATION] workout_logs: ${count}/${rows.length}`);
    }
  }
  return count;
}

async function upsertWeightLogs(
  supabase: SupabaseClient,
  rows: WeightLogInsert[],
): Promise<number> {
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('weight_logs')
      .upsert(chunk, { onConflict: 'user_id,logged_date' });
    if (error) {
      console.warn(`[MIGRATION_ERROR] weight_logs batch ${i}:`, error.message);
    } else {
      count += chunk.length;
      console.info(`[MIGRATION] weight_logs: ${count}/${rows.length}`);
    }
  }
  return count;
}

async function upsertWaterLogs(
  supabase: SupabaseClient,
  rows: WaterLogInsert[],
): Promise<number> {
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('water_logs')
      .upsert(chunk, { onConflict: 'user_id,logged_date' });
    if (error) {
      console.warn(`[MIGRATION_ERROR] water_logs batch ${i}:`, error.message);
    } else {
      count += chunk.length;
      console.info(`[MIGRATION] water_logs: ${count}/${rows.length}`);
    }
  }
  return count;
}

async function upsertBadges(
  supabase: SupabaseClient,
  rows: BadgeInsert[],
): Promise<number> {
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('badges').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.warn(`[MIGRATION_ERROR] badges batch ${i}:`, error.message);
    } else {
      count += chunk.length;
      console.info(`[MIGRATION] badges: ${count}/${rows.length}`);
    }
  }
  return count;
}

async function upsertPersonalRecords(
  supabase: SupabaseClient,
  rows: PersonalRecordInsert[],
): Promise<number> {
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('personal_records')
      .upsert(chunk, { onConflict: 'user_id,exercise_name' });
    if (error) {
      console.warn(`[MIGRATION_ERROR] personal_records batch ${i}:`, error.message);
    } else {
      count += chunk.length;
      console.info(`[MIGRATION] personal_records: ${count}/${rows.length}`);
    }
  }
  return count;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read localStorage and return a summary of what data is present.
 * Does NOT modify any storage.
 */
export function detectLocalData(): LocalDataInfo {
  if (typeof window === 'undefined') {
    return {
      hasData: false,
      foodLogs: 0, workoutLogs: 0, weightLogs: 0,
      waterLogs: 0, badges: 0, personalRecords: 0,
    };
  }
  try {
    const data = getAppData();
    const waterLogs = Object.keys(data.waterByDate ?? {}).length;
    const personalRecords = Object.keys(data.personalRecords ?? {}).length;
    const info: LocalDataInfo = {
      foodLogs:       data.foodEntries?.length   ?? 0,
      workoutLogs:    data.workoutEntries?.length ?? 0,
      weightLogs:     data.weightEntries?.length  ?? 0,
      waterLogs,
      badges:         data.badges?.length         ?? 0,
      personalRecords,
      hasData: false,
    };
    info.hasData =
      info.foodLogs    > 0 ||
      info.workoutLogs > 0 ||
      info.weightLogs  > 0 ||
      info.waterLogs   > 0 ||
      info.badges      > 0 ||
      info.personalRecords > 0;
    return info;
  } catch {
    return {
      hasData: false,
      foodLogs: 0, workoutLogs: 0, weightLogs: 0,
      waterLogs: 0, badges: 0, personalRecords: 0,
    };
  }
}

/**
 * Query Supabase to check the user's migration status.
 * Returns `reachable: false` on network error.
 */
export async function detectRemoteData(
  supabase: SupabaseClient,
  userId: string,
): Promise<RemoteDataInfo> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('migrated_at')
      .eq('id', userId)
      .single();
    if (error) {
      console.warn('[MIGRATION] detectRemoteData error:', error.message);
      return { reachable: false, migratedAt: null };
    }
    return {
      reachable: true,
      migratedAt: (data as { migrated_at: string | null } | null)?.migrated_at ?? null,
    };
  } catch {
    return { reachable: false, migratedAt: null };
  }
}

/**
 * Returns the localStorage migration flag status.
 * 'complete'     — local flag is set; skip migration.
 * 'not-started'  — no local flag found.
 */
export function getMigrationStatus(): 'complete' | 'not-started' {
  if (typeof window === 'undefined') return 'not-started';
  return localStorage.getItem(MIGRATION_FLAG_KEY) === 'true' ? 'complete' : 'not-started';
}

/**
 * Determine whether migration should run.
 *
 * Returns false (skip) when:
 * 1. localStorage flag is set (already migrated on this device)
 * 2. profiles.migrated_at is set in the DB (already migrated on another device)
 * 3. No local data exists (nothing to migrate)
 * 4. Supabase is unreachable (defer — try next login)
 */
export async function needsMigration(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  // 1. Local flag (cheapest — no network)
  if (getMigrationStatus() === 'complete') {
    console.info('[MIGRATION_SKIP] local flag set');
    return false;
  }

  // 2. Remote flag
  const remote = await detectRemoteData(supabase, userId);
  if (!remote.reachable) {
    console.info('[MIGRATION_SKIP] Supabase unreachable — deferring');
    return false;
  }
  if (remote.migratedAt !== null) {
    // Sync local flag so we skip the DB check next time
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    console.info('[MIGRATION_SKIP] already migrated (DB flag):', remote.migratedAt);
    return false;
  }

  // 3. Local data check
  const local = detectLocalData();
  if (!local.hasData) {
    console.info('[MIGRATION_SKIP] no local data to migrate');
    return false;
  }

  console.info('[MIGRATION] migration required — local data found:', local);
  return true;
}

/**
 * Set the migration-complete flags in both localStorage and Supabase profiles.
 * Called after `executeMigration` succeeds.
 */
export async function markMigrationComplete(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  // 1. Set localStorage flag first (synchronous, immediate)
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

  // 2. Set DB flag
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({ migrated_at: now })
    .eq('id', userId);

  if (error) {
    console.warn('[MIGRATION_ERROR] markMigrationComplete DB update failed:', error.message);
    // localStorage flag is set — migration won't re-run even if DB update fails
  } else {
    console.info('[MIGRATION] DB migrated_at flag set:', now);
  }
}

/**
 * Execute the full migration.
 *
 * Reads ALL localStorage data, validates each record, and upserts to Supabase.
 * A single bad record is logged and skipped — never aborts the migration.
 * Does NOT set migration flags — call `markMigrationComplete` after.
 *
 * Wrap in a 30-second timeout:
 *   await Promise.race([executeMigration(sb, uid), timeoutPromise]);
 */
export async function executeMigration(
  supabase: SupabaseClient,
  userId: string,
): Promise<MigrationResult> {
  const start = Date.now();
  const summary: MigrationSummary = {
    foodLogs: 0, workoutLogs: 0, weightLogs: 0, waterLogs: 0, badges: 0,
    checkins: 0, trainingPrograms: 0,
  };

  console.info('[MIGRATION] starting migration for user:', userId);

  const appData = getAppData();

  // ── 1. Food logs ────────────────────────────────────────────────────────────
  {
    const rows = (appData.foodEntries ?? [])
      .map(e => buildFoodRow(e, userId))
      .filter((r): r is FoodLogInsert => r !== null);
    console.info(`[MIGRATION] food_logs: ${rows.length} valid records`);
    summary.foodLogs = await upsertFoodLogs(supabase, rows);
  }

  // ── 2. Workout logs ─────────────────────────────────────────────────────────
  {
    const rows = (appData.workoutEntries ?? [])
      .map(e => buildWorkoutRow(e, userId))
      .filter((r): r is WorkoutLogInsert => r !== null);
    console.info(`[MIGRATION] workout_logs: ${rows.length} valid records`);
    summary.workoutLogs = await upsertWorkoutLogs(supabase, rows);
  }

  // ── 3. Weight logs ──────────────────────────────────────────────────────────
  {
    const rows = (appData.weightEntries ?? [])
      .map(e => buildWeightRow(e, userId))
      .filter((r): r is WeightLogInsert => r !== null);
    console.info(`[MIGRATION] weight_logs: ${rows.length} valid records`);
    summary.weightLogs = await upsertWeightLogs(supabase, rows);
  }

  // ── 4. Water logs ───────────────────────────────────────────────────────────
  {
    const rows = Object.entries(appData.waterByDate ?? {})
      .map(([date, ml]) => buildWaterRow(date, ml, userId))
      .filter((r): r is WaterLogInsert => r !== null);
    console.info(`[MIGRATION] water_logs: ${rows.length} valid records`);
    summary.waterLogs = await upsertWaterLogs(supabase, rows);
  }

  // ── 5. Badges ───────────────────────────────────────────────────────────────
  {
    const rows = (appData.badges ?? [])
      .map(b => buildBadgeRow(b, userId))
      .filter((r): r is BadgeInsert => r !== null);
    console.info(`[MIGRATION] badges: ${rows.length} valid records`);
    summary.badges = await upsertBadges(supabase, rows);
  }

  // ── 6. Personal records ─────────────────────────────────────────────────────
  {
    const rows = Object.values(appData.personalRecords ?? {})
      .map(pr => buildPRRow(pr, userId))
      .filter((r): r is PersonalRecordInsert => r !== null);
    console.info(`[MIGRATION] personal_records: ${rows.length} valid records`);
    // Not in MigrationSummary (interface contract), tracked internally
    await upsertPersonalRecords(supabase, rows);
  }

  // ── 7. Check-ins ────────────────────────────────────────────────────────────
  {
    const checkIns = readCheckIns();
    const rows: CheckinInsert[] = checkIns
      .filter(c => c.mood >= 1 && c.mood <= 5 && c.energy >= 1 && c.energy <= 5)
      .map(c => ({
        user_id:        userId,
        logged_date:    c.date,
        mood:           c.mood,
        energy:         c.energy,
        sleep_hours:    c.sleepHours,
        soreness_areas: c.sorenessAreas ?? [],
        notes:          c.notes ?? null,
      }));
    console.info(`[MIGRATION] checkins: ${rows.length} valid records`);
    let count = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('checkins')
        .upsert(chunk, { onConflict: 'user_id,logged_date' });
      if (error) console.warn(`[MIGRATION_ERROR] checkins batch ${i}:`, error.message);
      else count += chunk.length;
    }
    summary.checkins = count;
  }

  // ── 8. Training programs ─────────────────────────────────────────────────────
  {
    const programs = readTrainingPrograms();
    const rows: TrainingProgramInsert[] = programs.map(p => ({
      user_id:   userId,
      client_id: p.id,
      data:      p as unknown as Json,
      is_active: p.isActive,
    }));
    console.info(`[MIGRATION] training_programs: ${rows.length} valid records`);
    let count = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('training_programs')
        .upsert(chunk, { onConflict: 'user_id,client_id' });
      if (error) console.warn(`[MIGRATION_ERROR] training_programs batch ${i}:`, error.message);
      else count += chunk.length;
    }
    summary.trainingPrograms = count;
  }

  // ── 9. Goals → profiles UPDATE ──────────────────────────────────────────────
  {
    const goals = appData.goals;
    if (goals) {
      const { error } = await supabase
        .from('profiles')
        .update({
          goal_calories:  Math.max(1, Math.round(Number(goals.calories) || 2000)),
          goal_protein_g: Math.max(0, Number(Number(goals.protein || 150).toFixed(1))),
          goal_fat_g:     Math.max(0, Number(Number(goals.fat     || 60 ).toFixed(1))),
          goal_carbs_g:   Math.max(0, Number(Number(goals.carbs   || 200).toFixed(1))),
          goal_water_ml:  Math.max(1, Math.round(Number(goals.water || 2000))),
          goal_weight_kg: goals.goalWeight != null
            ? Math.max(0, Number(Number(goals.goalWeight).toFixed(1)))
            : null,
        })
        .eq('id', userId);
      if (error) {
        console.warn('[MIGRATION_ERROR] goals update failed:', error.message);
      } else {
        console.info('[MIGRATION] goals migrated to profiles');
      }
    }
  }

  const totalRecords =
    summary.foodLogs +
    summary.workoutLogs +
    summary.weightLogs +
    summary.waterLogs +
    summary.badges +
    summary.checkins +
    summary.trainingPrograms;

  const duration = Date.now() - start;

  console.info('[MIGRATION_COMPLETE]', {
    userId,
    duration,
    ...summary,
    totalRecords,
  });

  return { migrated: true, recordsMigrated: totalRecords, summary };
}
