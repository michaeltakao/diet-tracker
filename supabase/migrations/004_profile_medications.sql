-- =============================================================================
-- Diet Tracker — Profile: medications field
-- =============================================================================
-- Run AFTER 003_checkins_training_programs.sql
--
-- Adds medications[] column to profiles for personalized LLM safety checks.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS medications TEXT[] NOT NULL DEFAULT '{}';
