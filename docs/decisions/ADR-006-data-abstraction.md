# ADR-006: Data Access Abstraction Layer (lib/data/*)

**Status:** Accepted
**Date:** 2026-05-27
**Author:** Engineering Team

## Context

All 7 page components imported from `lib/storage.ts` directly:

```typescript
// Before ADR-006 — every page had this pattern
import { addFoodEntry, getEntriesForDate } from '@/lib/storage';
```

This meant switching from localStorage to Supabase would require modifying every page component — violating the open/closed principle and creating significant migration risk.

## Decision

Introduce `lib/data/*` as a stable interface layer.

```
Pages → lib/data/* → (localStorage | Supabase)
                            ↑
                  switch happens here only
```

## Structure

```
lib/data/
  food.ts      — food CRUD
  workout.ts   — workout CRUD + PR tracking
  weight.ts    — weight CRUD
  water.ts     — water CRUD
  badges.ts    — badge read/write
  profile.ts   — goals read/write
  index.ts     — barrel export
```

## Migration Contract

Each file in `lib/data/*` has a documented contract:

```typescript
// Current implementation delegates to lib/storage.ts
// STEP 6: add Supabase path with auth check
export function getFoodEntriesForDate(date: string): FoodEntry[] {
  return _getByDate(date);  // ← changes to Supabase query in STEP 6
}
```

Pages import from `@/lib/data` — they never change during migration.

## Consequences

### Positive
- STEP 6 migration touches only `lib/data/*` (7 files) — not 7 page files
- Clean separation of concerns
- Testable independently of UI

### Negative
- Additional indirection (one extra call level)
- Must maintain consistency between `lib/data/*` and `lib/storage.ts` signatures

## Rule

**No page component may import from `lib/storage.ts` directly after this ADR.**
All data access must go through `lib/data/*`.
