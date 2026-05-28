/**
 * Health profile data access layer.
 * Stored in localStorage under HEALTH_PROFILE_KEY.
 * Source of truth for personalized recommendation API calls.
 */

import type { UserHealthProfile } from '@/lib/types';

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
}

export function clearHealthProfile(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HEALTH_PROFILE_KEY);
}
