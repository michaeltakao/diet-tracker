/**
 * Auto-generated Supabase database types.
 * Generated 2026-07-03 via the Supabase MCP `generate_typescript_types` (project chkkpucuiyjdeqgyyszt).
 * DO NOT hand-edit the Database type below — regenerate with:
 *   npx supabase gen types typescript --project-id chkkpucuiyjdeqgyyszt > lib/database.types.ts
 *
 * Named aliases at the bottom of this file provide backward-compatible exports
 * for existing imports across the codebase.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          created_at: string
          description: string
          earned_at: string
          icon: string
          id: string
          name: string
          type: Database["public"]["Enums"]["badge_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          earned_at?: string
          icon: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["badge_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          earned_at?: string
          icon?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["badge_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          created_at: string
          energy: number
          id: string
          logged_date: string
          mood: number
          notes: string | null
          sleep_hours: number
          soreness_areas: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          energy: number
          id?: string
          logged_date: string
          mood: number
          notes?: string | null
          sleep_hours: number
          soreness_areas?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          energy?: number
          id?: string
          logged_date?: string
          mood?: number
          notes?: string | null
          sleep_hours?: number
          soreness_areas?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_foods: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          fat_g: number
          id: string
          macro_highlight: string
          name: string
          protein_g: number
          source_id: string | null
          user_id: string
        }
        Insert: {
          calories: number
          carbs_g: number
          created_at?: string
          fat_g: number
          id?: string
          macro_highlight?: string
          name: string
          protein_g: number
          source_id?: string | null
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          id?: string
          macro_highlight?: string
          name?: string
          protein_g?: number
          source_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_foods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_logs: {
        Row: {
          amount_g: number | null
          calories: number
          carbs_g: number
          created_at: string
          fat_g: number
          fiber_g: number | null
          id: string
          logged_at: string
          logged_date: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          photo_url: string | null
          protein_g: number
          serving_unit: string | null
          servings: number | null
          sodium_mg: number | null
          source: string | null
          source_id: string | null
          user_id: string
        }
        Insert: {
          amount_g?: number | null
          calories: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number | null
          id?: string
          logged_at?: string
          logged_date: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          photo_url?: string | null
          protein_g?: number
          serving_unit?: string | null
          servings?: number | null
          sodium_mg?: number | null
          source?: string | null
          source_id?: string | null
          user_id: string
        }
        Update: {
          amount_g?: number | null
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number | null
          id?: string
          logged_at?: string
          logged_date?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          name?: string
          photo_url?: string | null
          protein_g?: number
          serving_unit?: string | null
          servings?: number | null
          sodium_mg?: number | null
          source?: string | null
          source_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_templates: {
        Row: {
          created_at: string
          id: string
          items: Json
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          meal_type?: Database["public"]["Enums"]["meal_type"]
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_records: {
        Row: {
          achieved_at: string
          achieved_date: string
          created_at: string
          exercise_name: string
          id: string
          max_weight_kg: number
          user_id: string
        }
        Insert: {
          achieved_at?: string
          achieved_date: string
          created_at?: string
          exercise_name: string
          id?: string
          max_weight_kg: number
          user_id: string
        }
        Update: {
          achieved_at?: string
          achieved_date?: string
          created_at?: string
          exercise_name?: string
          id?: string
          max_weight_kg?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string
          age: number | null
          avatar_url: string | null
          consented_at: string | null
          created_at: string
          dietary_restrictions: string[]
          display_name: string | null
          fitness_goal: string
          goal_calories: number
          goal_carbs_g: number
          goal_fat_g: number
          goal_protein_g: number
          goal_water_ml: number
          goal_weight_kg: number | null
          health_conditions: string[]
          id: string
          lang: string
          medications: string[]
          migrated_at: string | null
          role: string
          study_cohort: string | null
          updated_at: string
        }
        Insert: {
          activity_level?: string
          age?: number | null
          avatar_url?: string | null
          consented_at?: string | null
          created_at?: string
          dietary_restrictions?: string[]
          display_name?: string | null
          fitness_goal?: string
          goal_calories?: number
          goal_carbs_g?: number
          goal_fat_g?: number
          goal_protein_g?: number
          goal_water_ml?: number
          goal_weight_kg?: number | null
          health_conditions?: string[]
          id: string
          lang?: string
          medications?: string[]
          migrated_at?: string | null
          role?: string
          study_cohort?: string | null
          updated_at?: string
        }
        Update: {
          activity_level?: string
          age?: number | null
          avatar_url?: string | null
          consented_at?: string | null
          created_at?: string
          dietary_restrictions?: string[]
          display_name?: string | null
          fitness_goal?: string
          goal_calories?: number
          goal_carbs_g?: number
          goal_fat_g?: number
          goal_protein_g?: number
          goal_water_ml?: number
          goal_weight_kg?: number | null
          health_conditions?: string[]
          id?: string
          lang?: string
          medications?: string[]
          migrated_at?: string | null
          role?: string
          study_cohort?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recommendation_feedback: {
        Row: {
          category: string | null
          client_id: string
          created_at: string
          id: string
          item_name: string
          item_type: string
          kind: string
          macro_highlight: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          client_id: string
          created_at?: string
          id?: string
          item_name: string
          item_type: string
          kind: string
          macro_highlight?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          client_id?: string
          created_at?: string
          id?: string
          item_name?: string
          item_type?: string
          kind?: string
          macro_highlight?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      researcher_access_log: {
        Row: {
          accessed_at: string
          endpoint: string
          filter_user_id: string | null
          id: string
          researcher_id: string
          table_name: string | null
        }
        Insert: {
          accessed_at?: string
          endpoint: string
          filter_user_id?: string | null
          id?: string
          researcher_id: string
          table_name?: string | null
        }
        Update: {
          accessed_at?: string
          endpoint?: string
          filter_user_id?: string | null
          id?: string
          researcher_id?: string
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "researcher_access_log_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tdee_estimates: {
        Row: {
          created_at: string
          data_points: number
          estimated_at: string
          id: string
          r_squared: number | null
          tdee_kcal: number
          user_id: string
          window_days: number
        }
        Insert: {
          created_at?: string
          data_points: number
          estimated_at: string
          id?: string
          r_squared?: number | null
          tdee_kcal: number
          user_id: string
          window_days?: number
        }
        Update: {
          created_at?: string
          data_points?: number
          estimated_at?: string
          id?: string
          r_squared?: number | null
          tdee_kcal?: number
          user_id?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "tdee_estimates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          client_id: string
          created_at: string
          data: Json
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          data: Json
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          data?: Json
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_logs: {
        Row: {
          id: string
          logged_date: string
          total_ml: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          logged_date: string
          total_ml?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          logged_date?: string
          total_ml?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          avg_calories: number | null
          frictions: string[]
          generated_at: string
          hydration_score: number | null
          id: string
          next_week_target: string
          protein_pct: number | null
          strengths: string[]
          user_id: string
          week_start: string
          weight_delta: number | null
          workout_days: number | null
        }
        Insert: {
          avg_calories?: number | null
          frictions?: string[]
          generated_at?: string
          hydration_score?: number | null
          id?: string
          next_week_target?: string
          protein_pct?: number | null
          strengths?: string[]
          user_id: string
          week_start: string
          weight_delta?: number | null
          workout_days?: number | null
        }
        Update: {
          avg_calories?: number | null
          frictions?: string[]
          generated_at?: string
          hydration_score?: number | null
          id?: string
          next_week_target?: string
          protein_pct?: number | null
          strengths?: string[]
          user_id?: string
          week_start?: string
          weight_delta?: number | null
          workout_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_logs: {
        Row: {
          created_at: string
          id: string
          logged_at: string
          logged_date: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          logged_date: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          logged_date?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          category: Database["public"]["Enums"]["workout_category"]
          created_at: string
          duration_min: number | null
          id: string
          logged_at: string
          logged_date: string
          muscle_part: Database["public"]["Enums"]["muscle_part"] | null
          name: string
          notes: string | null
          reps: number | null
          sets: number | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["workout_category"]
          created_at?: string
          duration_min?: number | null
          id?: string
          logged_at?: string
          logged_date: string
          muscle_part?: Database["public"]["Enums"]["muscle_part"] | null
          name: string
          notes?: string | null
          reps?: number | null
          sets?: number | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["workout_category"]
          created_at?: string
          duration_min?: number | null
          id?: string
          logged_at?: string
          logged_date?: string
          muscle_part?: Database["public"]["Enums"]["muscle_part"] | null
          name?: string
          notes?: string | null
          reps?: number | null
          sets?: number | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      badge_type:
        | "streak3"
        | "streak7"
        | "streak30"
        | "water_goal"
        | "calorie_goal"
        | "workout_master"
        | "pr_achieved"
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
      muscle_part: "chest" | "back" | "legs" | "shoulders" | "arms" | "abs"
      workout_category: "strength" | "cardio" | "flexibility" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ── Backward-compatible named type aliases ──────────────────────────────────
// Existing codebase imports these by name; keep them in sync with the
// generated Database type above.

export type MealTypeEnum      = Database["public"]["Enums"]["meal_type"]
export type WorkoutCatEnum    = Database["public"]["Enums"]["workout_category"]
export type MusclePartEnum    = Database["public"]["Enums"]["muscle_part"]
export type BadgeTypeEnum     = Database["public"]["Enums"]["badge_type"]
export type FitnessGoalEnum   = "weight_loss" | "muscle_gain" | "maintenance" | "endurance" | "flexibility"
export type ActivityLevelEnum = "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active"
export type ProfileRole       = "participant" | "researcher"

export type ProfileRow           = Database["public"]["Tables"]["profiles"]["Row"]
export type FoodLogRow           = Database["public"]["Tables"]["food_logs"]["Row"]
export type WorkoutLogRow        = Database["public"]["Tables"]["workout_logs"]["Row"]
export type WeightLogRow         = Database["public"]["Tables"]["weight_logs"]["Row"]
export type WaterLogRow          = Database["public"]["Tables"]["water_logs"]["Row"]
export type BadgeRow             = Database["public"]["Tables"]["badges"]["Row"]
export type PersonalRecordRow    = Database["public"]["Tables"]["personal_records"]["Row"]
export type CheckinRow           = Database["public"]["Tables"]["checkins"]["Row"]
export type TrainingProgramRow   = Database["public"]["Tables"]["training_programs"]["Row"]
export type WeeklyReportRow      = Database["public"]["Tables"]["weekly_reports"]["Row"]
export type TdeeEstimateRow      = Database["public"]["Tables"]["tdee_estimates"]["Row"]
export type RecommendationFeedbackRow = Database["public"]["Tables"]["recommendation_feedback"]["Row"]
export type FavoriteFoodRow      = Database["public"]["Tables"]["favorite_foods"]["Row"]
export type MealTemplateRow      = Database["public"]["Tables"]["meal_templates"]["Row"]

export type FoodLogInsert           = Database["public"]["Tables"]["food_logs"]["Insert"]
export type WorkoutLogInsert        = Database["public"]["Tables"]["workout_logs"]["Insert"]
export type WeightLogInsert         = Database["public"]["Tables"]["weight_logs"]["Insert"]
export type WaterLogInsert          = Database["public"]["Tables"]["water_logs"]["Insert"]
export type BadgeInsert             = Database["public"]["Tables"]["badges"]["Insert"]
export type PersonalRecordInsert    = Database["public"]["Tables"]["personal_records"]["Insert"]
export type CheckinInsert           = Database["public"]["Tables"]["checkins"]["Insert"]
export type TrainingProgramInsert   = Database["public"]["Tables"]["training_programs"]["Insert"]
export type WeeklyReportInsert      = Database["public"]["Tables"]["weekly_reports"]["Insert"]
export type TdeeEstimateInsert      = Database["public"]["Tables"]["tdee_estimates"]["Insert"]
export type RecommendationFeedbackInsert = Database["public"]["Tables"]["recommendation_feedback"]["Insert"]
export type FavoriteFoodInsert      = Database["public"]["Tables"]["favorite_foods"]["Insert"]
export type MealTemplateInsert      = Database["public"]["Tables"]["meal_templates"]["Insert"]

export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]

// Migration 008 table — now part of the generated Database type above.
export type ResearcherAccessLogInsert =
  Database["public"]["Tables"]["researcher_access_log"]["Insert"]
