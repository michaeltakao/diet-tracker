-- =============================================================================
-- 029 — food_logs.macros_entered (vault ADR-008 P0-13, adopted by ADR-011)
-- =============================================================================
-- NOT YET APPLIED TO PRODUCTION. Apply (after asking) BEFORE any build of
-- refactor/core-loop reaches production: the app now sends macros_entered,
-- and until the column exists the outbox keeps every food row queued
-- (PGRST204 = schema error, not permanent) and stops the flush.
--
-- P/F/C became optional on manual food entry in ADR-011. food_logs.protein_g / fat_g / carbs_g are
-- NOT NULL DEFAULT 0 (001_initial_schema.sql), so a kcal-only meal would be
-- stored as "0 g protein" — a fake zero, indistinguishable from a real one.
--
-- Chosen shape: an explicit flag rather than making the three columns
-- nullable, because (a) old rows stay valid without a backfill decision,
-- (b) every existing query keeps working, (c) the analysis can filter on one
-- column. NULL = written before this column existed (treat P/F/C as entered,
-- which was mandatory then).
--
-- App side: lib/data/food.ts foodRow() sends macros_entered = false when any
-- of P/F/C was left empty (all-or-nothing), true otherwise; legacy local
-- entries without the flag are sent as true (P/F/C were mandatory then).
-- =============================================================================

ALTER TABLE public.food_logs
  ADD COLUMN macros_entered BOOLEAN NULL;

COMMENT ON COLUMN public.food_logs.macros_entered IS
  'False = user entered kcal only; protein_g/fat_g/carbs_g are 0 placeholders, not measurements. NULL = pre-029 row (P/F/C were mandatory).';
