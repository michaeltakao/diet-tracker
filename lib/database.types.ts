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
export type FitnessGoalEnum  =
  | 'weight_loss' | 'muscle_gain' | 'maintenance' | 'endurance' | 'flexibility';
export type ActivityLevelEnum =
  | 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';

// ── Row types (what Supabase SELECT returns) ───────────────────

export type ProfileRole = 'participant' | 'researcher';

export type ProfileRow = {
  id:              string;
  display_name:    string | null;
  avatar_url:      string | null;
  lang:            'ja' | 'en';
  goal_calories:   number;
  goal_protein_g:  number;
  goal_fat_g:      number;
  goal_carbs_g:    number;
  goal_water_ml:   number;
  goal_weight_kg:       number | null;
  migrated_at:          string | null;
  age:                  number | null;
  health_conditions:    string[];
  dietary_restrictions: string[];
  medications:          string[];
  fitness_goal:         FitnessGoalEnum;
  activity_level:       ActivityLevelEnum;
  // migration 007
  role:             ProfileRole;
  consented_at:     string | null;
  study_cohort:     string | null;
  created_at:       string;
  updated_at:       string;
}

// migration 005
export type RecommendationFeedbackRow = {
  id:             string;
  user_id:        string;
  client_id:      string;
  item_type:      'food' | 'exercise';
  item_name:      string;
  kind:           'accept' | 'reject' | 'favorite';
  macro_highlight: string | null;
  category:       string | null;
  created_at:     string;
}

export type RecommendationFeedbackInsert = Omit<RecommendationFeedbackRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

// migration 006
export type TdeeEstimateRow = {
  id:           string;
  user_id:      string;
  estimated_at: string;   // YYYY-MM-DD
  tdee_kcal:    number;
  window_days:  number;
  r_squared:    number | null;
  data_points:  number;
  created_at:   string;
}

export type TdeeEstimateInsert = Omit<TdeeEstimateRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type FoodLogRow = {
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

export type WorkoutLogRow = {
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

export type WeightLogRow = {
  id:          string;
  user_id:     string;
  logged_date: string;
  weight_kg:   number;
  logged_at:   string;
  created_at:  string;
}

export type WaterLogRow = {
  id:          string;
  user_id:     string;
  logged_date: string;
  total_ml:    number;
  updated_at:  string;
}

export type BadgeRow = {
  id:          string;
  user_id:     string;
  type:        BadgeTypeEnum;
  name:        string;
  description: string;
  icon:        string;
  earned_at:   string;
  created_at:  string;
}

export type PersonalRecordRow = {
  id:             string;
  user_id:        string;
  exercise_name:  string;
  max_weight_kg:  number;
  achieved_date:  string;
  achieved_at:    string;
  created_at:     string;
}

export type CheckinRow = {
  id:             string;
  user_id:        string;
  logged_date:    string;    // YYYY-MM-DD
  mood:           number;    // 1-5
  energy:         number;    // 1-5
  sleep_hours:    number;
  soreness_areas: string[];
  notes:          string | null;
  created_at:     string;
}

export type TrainingProgramRow = {
  id:         string;
  user_id:    string;
  client_id:  string;        // matches TrainingProgram.id in localStorage
  data:       unknown;       // JSONB — full TrainingProgram object
  is_active:  boolean;
  created_at: string;
  updated_at: string;
}

export type WeeklyReportRow = {
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

// water_logs.updated_at has DEFAULT NOW() — optional on insert
export type WaterLogInsert = Omit<WaterLogRow, 'id' | 'updated_at'> & {
  id?:         string;
  updated_at?: string;
};

export type BadgeInsert = Omit<BadgeRow, 'id' | 'created_at'> & {
  id?:         string;
  created_at?: string;
};

// personal_records.achieved_at has DEFAULT NOW() — optional on insert
export type PersonalRecordInsert = Omit<PersonalRecordRow, 'id' | 'created_at' | 'achieved_at'> & {
  id?:          string;
  created_at?:  string;
  achieved_at?: string;
};

export type WeeklyReportInsert = Omit<WeeklyReportRow, 'id'> & {
  id?: string;
};

export type CheckinInsert = Omit<CheckinRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type TrainingProgramInsert = Omit<TrainingProgramRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
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
    | 'age'
    | 'health_conditions'
    | 'dietary_restrictions'
    | 'medications'
    | 'fitness_goal'
    | 'activity_level'
    | 'consented_at'
    | 'study_cohort'
  >
>;

// ── Database schema type (for createClient<Database>()) ────────
//
// Each table MUST include `Relationships: []` to satisfy the `GenericTable`
// constraint in @supabase/supabase-js, otherwise table Insert types resolve
// to `never` and all write operations fail at the type level.
//
// The schema MUST include `Views: {}` and `Functions: {}` to satisfy
// the `GenericSchema` constraint.
//
// Once the real Supabase project is connected, replace this entire file with:
//   npx supabase gen types typescript --project-id <id> > lib/database.types.ts

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row:           ProfileRow;
        Insert:        Omit<ProfileRow, 'created_at' | 'updated_at' | 'lang' | 'goal_calories' | 'goal_protein_g' | 'goal_fat_g' | 'goal_carbs_g' | 'goal_water_ml'> & { id: string };
        Update:        ProfileUpdate;
        Relationships: [];
      };
      food_logs: {
        Row:           FoodLogRow;
        Insert:        FoodLogInsert;
        Update:        Partial<FoodLogInsert>;
        Relationships: [];
      };
      workout_logs: {
        Row:           WorkoutLogRow;
        Insert:        WorkoutLogInsert;
        Update:        Partial<WorkoutLogInsert>;
        Relationships: [];
      };
      weight_logs: {
        Row:           WeightLogRow;
        Insert:        WeightLogInsert;
        Update:        Partial<WeightLogInsert>;
        Relationships: [];
      };
      water_logs: {
        Row:           WaterLogRow;
        Insert:        WaterLogInsert;
        Update:        Partial<WaterLogInsert>;
        Relationships: [];
      };
      badges: {
        Row:           BadgeRow;
        Insert:        BadgeInsert;
        Update:        Partial<BadgeInsert>;
        Relationships: [];
      };
      personal_records: {
        Row:           PersonalRecordRow;
        Insert:        PersonalRecordInsert;
        Update:        Partial<PersonalRecordInsert>;
        Relationships: [];
      };
      weekly_reports: {
        Row:           WeeklyReportRow;
        Insert:        WeeklyReportInsert;
        Update:        Partial<WeeklyReportInsert>;
        Relationships: [];
      };
      checkins: {
        Row:           CheckinRow;
        Insert:        CheckinInsert;
        Update:        Partial<CheckinInsert>;
        Relationships: [];
      };
      training_programs: {
        Row:           TrainingProgramRow;
        Insert:        TrainingProgramInsert;
        Update:        Partial<TrainingProgramInsert>;
        Relationships: [];
      };
      recommendation_feedback: {
        Row:           RecommendationFeedbackRow;
        Insert:        RecommendationFeedbackInsert;
        Update:        Partial<RecommendationFeedbackInsert>;
        Relationships: [];
      };
      tdee_estimates: {
        Row:           TdeeEstimateRow;
        Insert:        TdeeEstimateInsert;
        Update:        Partial<TdeeEstimateInsert>;
        Relationships: [];
      };
    };
    Views:     Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      meal_type:        MealTypeEnum;
      workout_category: WorkoutCatEnum;
      muscle_part:      MusclePartEnum;
      badge_type:       BadgeTypeEnum;
    };
  };
};
