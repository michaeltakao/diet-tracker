-- =============================================================================
-- DRAFT — NOT A MIGRATION YET. Do not apply. (vault ADR-008 P0-13)
-- =============================================================================
-- Kept outside supabase/migrations/ on purpose so no tool applies it.
--
-- Only needed if P/F/C become optional on manual food entry (ADR-008 P1,
-- waiting on the advisor). food_logs.protein_g / fat_g / carbs_g are
-- NOT NULL DEFAULT 0 (001_initial_schema.sql), so a kcal-only meal would be
-- stored as "0 g protein" — a fake zero, indistinguishable from a real one.
--
-- Chosen shape: an explicit flag rather than making the three columns
-- nullable, because (a) old rows stay valid without a backfill decision,
-- (b) every existing query keeps working, (c) the analysis can filter on one
-- column. NULL = written before this column existed (treat P/F/C as entered,
-- which was mandatory then).
--
-- To adopt: move to supabase/migrations/029_food_macros_entered.sql, set
-- macros_entered in lib/data/food.ts foodRow() (false when the user left
-- P/F/C empty), add a unit test "kcal-only meal → macros_entered = false",
-- and update docs/trial/data-dictionary.md. Apply to prod only after asking.
-- =============================================================================

ALTER TABLE public.food_logs
  ADD COLUMN macros_entered BOOLEAN NULL;

COMMENT ON COLUMN public.food_logs.macros_entered IS
  'False = user entered kcal only; protein_g/fat_g/carbs_g are 0 placeholders, not measurements. NULL = pre-029 row (P/F/C were mandatory).';
