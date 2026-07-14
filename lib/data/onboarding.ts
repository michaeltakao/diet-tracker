/**
 * Onboarding completion record (FTUE D4–D5).
 *
 * localStorage-only: the record is per-device UX state, not study data.
 * The `dt-onboarded` cookie is what proxy.ts reads to gate the forced
 * redirect to /onboarding — cookie and record are set together.
 *
 * Fan-out of individual answers (health profile, weight entry, goals) is
 * done by the wizard page through the existing stores; this module only
 * owns the completion record + cookie.
 */

import type { ExperienceLevel, FitnessGoal } from '@/lib/types';

export type TrainingEnvironment = 'home' | 'gym' | 'outside';

export interface OnboardingAnswers {
  fitnessGoal:      FitnessGoal;
  birthYear:        number | null;
  sex:              'male' | 'female' | null;
  heightCm:         number | null;
  weightKg:         number | null;
  experience:       ExperienceLevel;
  environment:      TrainingEnvironment;
  availableMinutes: number;
  /** Wizard steps the user skipped — their answers are explicit defaults. */
  defaultedSteps:   string[];
}

export interface OnboardingRecord {
  completedAt: string;   // ISO timestamp
  skipped:     boolean;  // true = "あとで" (whole wizard skipped, all defaults)
  answers:     OnboardingAnswers;
}

const ONBOARDING_KEY = 'diet-tracker-onboarding';
const ONBOARDED_COOKIE = 'dt-onboarded';

/** Explicit defaults shown on the skip path (D4: defaults are never silent). */
export const DEFAULT_ANSWERS: OnboardingAnswers = {
  fitnessGoal:      'maintenance',
  birthYear:        null,
  sex:              null,
  heightCm:         null,
  weightKg:         null,
  experience:       'beginner',
  environment:      'home',
  availableMinutes: 20,
  defaultedSteps:   ['goal', 'body', 'experience', 'environment'],
};

export function getOnboardingRecord(): OnboardingRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    return raw ? (JSON.parse(raw) as OnboardingRecord) : null;
  } catch {
    return null;
  }
}

function setOnboardedCookie(): void {
  // Same idiom as dt-guest (login/consent pages). Per-device by design.
  document.cookie = `${ONBOARDED_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
}

function saveRecord(record: OnboardingRecord): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(record));
  setOnboardedCookie();
}

/** Record wizard completion and unlock the proxy gate. */
export function completeOnboarding(answers: OnboardingAnswers): void {
  saveRecord({ completedAt: new Date().toISOString(), skipped: false, answers });
}

/** "あとで" — skip the whole wizard; defaults are recorded as explicit. */
export function skipOnboarding(): void {
  saveRecord({
    completedAt: new Date().toISOString(),
    skipped: true,
    answers: { ...DEFAULT_ANSWERS },
  });
}
