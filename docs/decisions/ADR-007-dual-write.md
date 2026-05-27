# ADR-007: Dual-Write Strategy for localStorage → Supabase Migration

**Status:** Proposed (implementation: STEP 6)
**Date:** 2026-05-27
**Author:** Engineering Team

## Context

Existing users have data in localStorage. A hard cutover to Supabase would:
1. Lose all existing user data if migration fails
2. Break the app for users without internet (no offline support)
3. Create a disruptive one-time migration experience

## Decision

**Dual-write strategy with graceful degradation:**

```typescript
// lib/data/food.ts (STEP 6 implementation)
export async function addFoodEntry(entry: FoodEntry): Promise<void> {
  // 1. Always write to localStorage (offline fallback)
  _addToLocalStorage(entry);

  // 2. If authenticated, also write to Supabase
  const user = await getCurrentUser();
  if (user) {
    const supabase = createClient();
    await supabase.from('food_logs').insert(toSupabaseRow(entry, user.id));
  }
}
```

## Four Phases

### Phase 1 — Read localStorage (current, STEP 0–4)
- All reads and writes go to localStorage
- Supabase client exists but is unused

### Phase 2 — Dual-write (STEP 6)
- Authenticated: write to both localStorage AND Supabase
- Unauthenticated: write to localStorage only
- Read: prefer Supabase when authenticated, fallback to localStorage

### Phase 3 — Migration (STEP 7)
- On first login: migrate all localStorage data to Supabase
- Run `migrateLocalStorageToSupabase()` once (flag: `profiles.migrated_at IS NOT NULL`)
- localStorage becomes a cache, Supabase is source of truth

### Phase 4 — Supabase primary (post-migration)
- Read: always from Supabase
- localStorage: offline-only cache (populated by Service Worker sync)
- localStorage cleared except for offline queue

## Conflict Resolution

If a record exists in both stores with the same `id`:
- **Supabase wins** — it is the source of truth
- localStorage version is overwritten on next read

## Rollback Plan

If Supabase migration fails:
1. `profiles.migrated_at` remains NULL
2. App falls back to localStorage reads
3. User data is safe (not deleted from localStorage until Phase 4)

## Consequences

### Positive
- Zero data loss risk
- Offline still works throughout migration
- Users don't notice the migration

### Negative
- Temporary dual-write overhead (two writes per operation)
- localStorage and Supabase can temporarily diverge
- Added complexity in `lib/data/*`
