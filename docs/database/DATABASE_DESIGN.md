# Database Design

> Platform: Supabase (PostgreSQL 15)
> Last updated: 2026-05-27
> Migration file: `supabase/migrations/001_initial_schema.sql`

## Entity Relationship Diagram

```
auth.users (Supabase managed)
    │ 1:1 (TRIGGER: on_auth_user_created)
    ▼
profiles ─────────────────────────────────────────────────────┐
    │ (id, lang, goals, migrated_at)                           │
    │                                                          │
    ├── food_logs ──────────── 1:N                            │
    │       (logged_date, meal_type, name, macros, photo_url)  │
    │                                                          │
    ├── workout_logs ─────────1:N                             │
    │       (logged_date, name, category, sets/reps/weight)    │
    │                                                          │
    ├── weight_logs ──────────1:N (UNIQUE per user+date)      │
    │       (logged_date, weight_kg)                           │
    │                                                          │
    ├── water_logs ───────────1:N (UNIQUE per user+date)      │
    │       (logged_date, total_ml)                            │
    │                                                          │
    ├── badges ───────────────1:N                             │
    │       (type ENUM, earned_at)                             │
    │                                                          │
    ├── personal_records ─────1:N (UNIQUE per user+exercise)  │
    │       (exercise_name, max_weight_kg, achieved_date)      │
    │                                                          │
    └── weekly_reports ───────1:N (UNIQUE per user+week_start)│
            (AI-generated, cached 24h)                         │
            (strengths[], frictions[], next_week_target)        │
```

## Table Inventory

| Table | Rows/User/Year | Primary Index | Notes |
|---|---|---|---|
| profiles | 1 | PK (id) | Goals denormalized here |
| food_logs | ~1,095 (3/day × 365) | (user_id, logged_date DESC) | photo_url: Storage URL |
| workout_logs | ~365–730 | (user_id, logged_date DESC) | muscle_part nullable |
| weight_logs | ~365 | (user_id, logged_date DESC) | UNIQUE per date |
| water_logs | ~365 | (user_id, logged_date DESC) | UNIQUE per date, UPSERT |
| badges | ~20 | (user_id, type) | Per-day badges repeat |
| personal_records | ~20–50 | (user_id) | UNIQUE per exercise |
| weekly_reports | ~52 | (user_id, week_start DESC) | 24h TTL in app logic |

## Migration Strategy

All schema changes must:
1. Create a new migration file: `supabase/migrations/NNN_description.sql`
2. Include rollback (DROP TABLE / DROP COLUMN) as a comment
3. Update `lib/database.types.ts` (or regenerate via `supabase gen types typescript`)
4. Update this document

## Rollback Template

```sql
-- To rollback 001_initial_schema.sql:
DROP TABLE IF EXISTS public.weekly_reports CASCADE;
DROP TABLE IF EXISTS public.personal_records CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;
DROP TABLE IF EXISTS public.water_logs CASCADE;
DROP TABLE IF EXISTS public.weight_logs CASCADE;
DROP TABLE IF EXISTS public.workout_logs CASCADE;
DROP TABLE IF EXISTS public.food_logs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS public.badge_type;
DROP TYPE IF EXISTS public.muscle_part;
DROP TYPE IF EXISTS public.workout_category;
DROP TYPE IF EXISTS public.meal_type;
DROP FUNCTION IF EXISTS public.handle_updated_at();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

## Query Performance Notes

**Common queries and their index coverage:**

```sql
-- Dashboard: today's food (covered by food_logs_user_date index)
SELECT * FROM food_logs WHERE user_id = $1 AND logged_date = TODAY;

-- Recent foods quick-add (covered by food_logs_user_logged index)
SELECT DISTINCT name, calories FROM food_logs
WHERE user_id = $1 ORDER BY MAX(logged_at) DESC LIMIT 5;

-- Weight trend chart (covered by weight_logs_user_date index)
SELECT * FROM weight_logs WHERE user_id = $1
ORDER BY logged_date DESC LIMIT 30;

-- PR check (covered by workout_logs_name_weight index)
SELECT MAX(weight_kg) FROM workout_logs
WHERE user_id = $1 AND name = $2;
```

## Planned Future Tables

| Table | Phase | Purpose |
|---|---|---|
| `body_measurements` | Phase C | Waist, chest, arm measurements |
| `sleep_logs` | Phase C | Hours + quality rating |
| `meal_plans` | Phase D | AI-generated weekly meal plans |
| `exercise_library` | Phase B | Reference database of 600+ exercises |
| `feedback_reports` | Phase E | User bug/feature reports |
| `triage_results` | Phase E | AI issue triage output |
