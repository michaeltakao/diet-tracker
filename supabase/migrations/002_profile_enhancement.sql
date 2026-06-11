-- =============================================================================
-- Diet Tracker — Profile Enhancement: Personalized Health Fields
-- =============================================================================
-- Run AFTER 001_initial_schema.sql
-- Adds age, health_conditions, dietary_restrictions, fitness_goal, activity_level
-- to the profiles table for personalized LLM-based recommendations.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age                  SMALLINT
    CHECK (age > 0 AND age < 150),

  ADD COLUMN IF NOT EXISTS health_conditions    TEXT[]
    NOT NULL DEFAULT '{}',

  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[]
    NOT NULL DEFAULT '{}',

  ADD COLUMN IF NOT EXISTS fitness_goal         TEXT
    NOT NULL DEFAULT 'maintenance'
    CHECK (fitness_goal IN (
      'weight_loss', 'muscle_gain', 'maintenance', 'endurance', 'flexibility'
    )),

  ADD COLUMN IF NOT EXISTS activity_level       TEXT
    NOT NULL DEFAULT 'moderately_active'
    CHECK (activity_level IN (
      'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'
    ));

-- ProfileUpdate already covers these via the trigger; no new RLS policies needed.
-- The existing "profiles: users update own row" policy covers all column updates.
