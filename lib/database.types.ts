/**
 * Hand-crafted Supabase database types.
 *
 * These mirror the SQL schema in supabase/migrations/001_initial_schema.sql.
 *
 * IMPORTANT: Once the Supabase project is connected, replace this file with
 * the auto-generated version by running:
 *   npx supabase gen types typescript --project-id <project-id> > lib/database.types.ts
 *
 * Do NOT hand-edit after that point.
 */

// ── Enums ──────────────────────────────────────────────────────

export type MealTypeEnum     = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type WorkoutCatEnum   = 'strength' | 'cardio' | 'flexibility' | 'other';
export type MusclePartEnum   = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'abs';
export type BadgeTypeEnum    =
  | 'streak3' | 'streak7' | 'streak30'
  | 'water_goal' | 'calorie_goal'
  | 'workout_master' | 'pr_achieved';

// ── Row types (what Supabase SELECT returns) ───────────────────

export interface ProfileRow {
  id:              string;
  display_name:    string | null;
  avatar_url:      string | null;
  lang:            'ja' | 'en';
  goal_calories:   number;
  goal_protein_g:  number;
  goal_fat_g:      number;
  goal_carbs_g:    number;
  goal_water_ml:   number;
  goal_weight_kg:  number | null;
  migrated_at:     string | null;   // ISO — set after localStorage→Supabase migration
  created_at:      string;
  updated_at:      string;
}

export interface FoodLogRow {
  id:          string;
  user_id:     string;
  logged_date: string;              // YYYY-MM-DD
  meal_type:   MealTypeEnum;
  name:        string;
  calories:    number;
  protein_g:   number;
  fat_g:       number;
  carbs_g:     number;
  photo_url:   string | null;
  logged_at:   string;              // ISO (when the meal was eaten)
  created_at:  string;
}

export interface WorkoutLogRow {
  id:           string;
  user_id:      string;
  logged_date:  string;
  name:         string;
  category:     WorkoutCatEnum;
  muscle_part:  MusclePartEnum | null;
  sets:         number | null;
  reps:         number | null;
  weight_kg:    number | null;
  duration_min: number | null;
  notes:        string | null;
  logged_at:    string;
  created_at:   string;
}

export interface WeightLogRow {
  id:          string;
  user_id:     string;
  logged_date: string;
  weight_kg:   number;
  logged_at:   string;
  created_at:  string;
}

export interface WaterLogRow {
  id:          string;
  user_id:     string;
  logged_date: string;
  total_ml:    number;
  updated_at:  string;
}

export interface BadgeRow {
  id:          string;
  user_id:     string;
  type:        BadgeTypeEnum;
  name:        string;
  description: string;
  icon:        string;
  earned_at:   string;
  created_at:  string;
}

export interface PersonalRecordRow {
  id:             string;
  user_id:        string;
  exercise_name:  string;
  max_weight_kg:  number;
  achieved_date:  string;
  achieved_at:    string;
  created_at:     string;
}

export interface WeeklyReportRow {
  id:               string;
  user_id:          string;
  week_start:       string;          // YYYY-MM-DD (Monday)
  strengths:        string[];
  frictions:        string[];
  next_week_target: string;
  weight_delta:     number | null;
  avg_calories:     number | null;
  protein_pct:      number | null;
  workout_days:     number | null;
  hydration_score:  number | null;
  generated_at:     string;
}

// ── Insert types (what you pass to Supabase INSERT) ────────────

export type FoodLogInsert = Omit<FoodLogRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type WorkoutLogInsert = Omit<WorkoutLogRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type WeightLogInsert = Omit<WeightLogRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type WaterLogInsert = Omit<WaterLogRow, 'id'>;

export type BadgeInsert = Omit<BadgeRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type PersonalRecordInsert = Omit<PersonalRecordRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type WeeklyReportInsert = Omit<WeeklyReportRow, 'id'> & {
  id?: string;
};

export type ProfileUpdate = Partial<
  Pick<ProfileRow,
    | 'display_name'
    | 'avatar_url'
    | 'lang'
    | 'goal_calories'
    | 'goal_protein_g'
    | 'goal_fat_g'
    | 'goal_carbs_g'
    | 'goal_water_ml'
    | 'goal_weight_kg'
    | 'migrated_at'
  >
>;

// ── Database schema type (for createClient<Database>()) ────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row:    ProfileRow;
        Insert: Omit<ProfileRow, 'created_at' | 'updated_at' | 'lang' | 'goal_calories' | 'goal_protein_g' | 'goal_fat_g' | 'goal_carbs_g' | 'goal_water_ml'> & { id: string };
        Update: ProfileUpdate;
      };
      food_logs: {
        Row:    FoodLogRow;
        Insert: FoodLogInsert;
        Update: Partial<FoodLogInsert>;
      };
      workout_logs: {
        Row:    WorkoutLogRow;
        Insert: WorkoutLogInsert;
        Update: Partial<WorkoutLogInsert>;
      };
      weight_logs: {
        Row:    WeightLogRow;
        Insert: WeightLogInsert;
        Update: Partial<WeightLogInsert>;
      };
      water_logs: {
        Row:    WaterLogRow;
        Insert: WaterLogInsert;
        Update: Partial<WaterLogInsert>;
      };
      badges: {
        Row:    BadgeRow;
        Insert: BadgeInsert;
        Update: Partial<BadgeInsert>;
      };
      personal_records: {
        Row:    PersonalRecordRow;
        Insert: PersonalRecordInsert;
        Update: Partial<PersonalRecordInsert>;
      };
      weekly_reports: {
        Row:    WeeklyReportRow;
        Insert: WeeklyReportInsert;
        Update: Partial<WeeklyReportInsert>;
      };
    };
    Enums: {
      meal_type:        MealTypeEnum;
      workout_category: WorkoutCatEnum;
      muscle_part:      MusclePartEnum;
      badge_type:       BadgeTypeEnum;
    };
  };
};
