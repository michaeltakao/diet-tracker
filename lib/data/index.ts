/**
 * Barrel export for the data access layer.
 *
 * Import all data functions from here:
 *   import { getFoodEntriesForDate, addFoodEntry } from '@/lib/data';
 *
 * This keeps import paths stable as the underlying implementation
 * moves from localStorage → Supabase in STEP 6.
 */

export * from './food';
export * from './workout';
export * from './weight';
export * from './water';
export * from './badges';
export * from './profile';
// Compatibility shim: getAppData() for pages needing full AppData snapshot
// STEP 7 change: replace with Supabase read after migration
export * from './app';
export * from './health-profile';
export * from './recommendation-feedback';
export * from './favorites';
export * from './meal-templates';
export * from './weekly-challenge';
export * from './vitals';
export * from './symptoms';
export * from './workout-prefs';
