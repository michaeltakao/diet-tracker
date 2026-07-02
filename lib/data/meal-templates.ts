/**
 * Meal templates data access layer ("save this meal" → one-tap re-log).
 *
 * Read:  localStorage always. Write: localStorage first, then Supabase when
 * authenticated (fire-and-forget) — same pattern as lib/data/food.ts.
 */

import {
  getMealTemplates as _get,
  addMealTemplate as _add,
  removeMealTemplate as _remove,
} from '@/lib/storage';
import { getWriteContext } from './_write';
import type { MealTemplate } from '@/lib/types';
import type { Json, MealTypeEnum } from '@/lib/database.types';

export function getMealTemplates(): MealTemplate[] {
  return _get();
}

export async function saveMealTemplate(tmpl: MealTemplate): Promise<void> {
  _add(tmpl);

  const ctx = await getWriteContext();
  if (!ctx) return;
  const { error } = await ctx.supabase.from('meal_templates').upsert({
    id: tmpl.id,
    user_id: ctx.userId,
    name: tmpl.name,
    meal_type: tmpl.mealType as MealTypeEnum,
    items: tmpl.items as unknown as Json,
    created_at: tmpl.createdAt,
  }, { onConflict: 'id' });
  if (error) console.warn('[data/meal-templates] Supabase upsert failed:', error.message);
}

export async function deleteMealTemplate(id: string): Promise<void> {
  _remove(id);

  const ctx = await getWriteContext();
  if (!ctx) return;
  const { error } = await ctx.supabase
    .from('meal_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.userId);
  if (error) console.warn('[data/meal-templates] Supabase delete failed:', error.message);
}
