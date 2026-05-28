/**
 * Health profile data access layer.
 * Stored in localStorage under HEALTH_PROFILE_KEY.
 * Dual-writes to Supabase profiles table when authenticated.
 */

import type { UserHealthProfile } from '@/lib/types';
import { getWriteContext } from './_write';

const HEALTH_PROFILE_KEY = 'diet-tracker-health-profile';

export const DEFAULT_HEALTH_PROFILE: UserHealthProfile = {
  age:                 null,
  healthConditions:    [],
  dietaryRestrictions: [],
  fitnessGoal:         'maintenance',
  activityLevel:       'moderately_active',
};

export function getHealthProfile(): UserHealthProfile {
  if (typeof window === 'undefined') return { ...DEFAULT_HEALTH_PROFILE };
  try {
    const raw = localStorage.getItem(HEALTH_PROFILE_KEY);
    if (!raw) return { ...DEFAULT_HEALTH_PROFILE };
    return { ...DEFAULT_HEALTH_PROFILE, ...JSON.parse(raw) } as UserHealthProfile;
  } catch {
    return { ...DEFAULT_HEALTH_PROFILE };
  }
}

export function updateHealthProfile(profile: UserHealthProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HEALTH_PROFILE_KEY, JSON.stringify(profile));

  // Dual-write to Supabase profiles table (fire-and-forget)
  void (async () => {
    const ctx = await getWriteContext();
    if (!ctx) return;
    const { error } = await ctx.supabase.from('profiles').update({
      age:                  profile.age,
      health_conditions:    profile.healthConditions,
      dietary_restrictions: profile.dietaryRestrictions,
      fitness_goal:         profile.fitnessGoal,
      activity_level:       profile.activityLevel,
    }).eq('id', ctx.userId);
    if (error) console.warn('[health-profile] Supabase update failed:', error.message);
  })();
}

export function clearHealthProfile(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HEALTH_PROFILE_KEY);
}
