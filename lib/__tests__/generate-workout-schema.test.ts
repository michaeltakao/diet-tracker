/**
 * Structural tests for /api/generate-workout, matching this repo's
 * no-vi.mock-Supabase idiom (see nudge-fanout.test.ts) — the route handler
 * itself needs a live Next.js request/Supabase runtime that nothing else in
 * lib/__tests__ mocks, so what's tested here is the load-bearing safety
 * property called out in the plan: the LLM's structured-output schema must
 * NOT contain an exercise list, sets, reps, or rest field, so it cannot
 * smuggle a different plan into the response than what selectExercises()
 * deterministically chose. Quota/rate-limit wiring is checked directly
 * against lib/rate-limit.ts, which the route imports its config from.
 */
import { describe, it, expect } from 'vitest';
import { NARRATION_SCHEMA } from '@/app/api/generate-workout/route';
import { RATE_LIMITS, DAILY_QUOTAS } from '@/lib/rate-limit';
import { selectExercises } from '@/lib/workout-generator';

const FORBIDDEN_KEYS = ['exercise', 'exercises', 'sets', 'reps', 'restSec', 'rest', 'plan'];

describe('generate-workout narration schema (LLM cannot override the deterministic plan)', () => {
  it('has no exercise-list, sets, reps, or rest field', () => {
    const props = Object.keys((NARRATION_SCHEMA as { properties?: Record<string, unknown> }).properties ?? {});
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(props, `schema must not expose "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('only exposes narration text fields', () => {
    const props = Object.keys((NARRATION_SCHEMA as { properties?: Record<string, unknown> }).properties ?? {});
    expect(props.sort()).toEqual(['motivationMessage', 'notes', 'sessionName'].sort());
  });

  it('requires all three narration fields', () => {
    const required = (NARRATION_SCHEMA as { required?: string[] }).required ?? [];
    expect(required.sort()).toEqual(['motivationMessage', 'notes', 'sessionName'].sort());
  });
});

describe('generate-workout quota wiring', () => {
  it('has a rate-limit config', () => {
    expect(RATE_LIMITS['generate-workout']).toBeDefined();
    expect(RATE_LIMITS['generate-workout'].maxRequests).toBeGreaterThan(0);
  });

  it('has a daily quota, comparable to suggest-workout (a similar one-call-per-use feature)', () => {
    expect(DAILY_QUOTAS['generate-workout']).toBeDefined();
    expect(DAILY_QUOTAS['generate-workout']).toBeGreaterThan(0);
  });
});

describe('generate-workout end-to-end plan shape (no network)', () => {
  it('selectExercises output is JSON-serializable and matches the documented GeneratedPlan shape', () => {
    const plan = selectExercises({
      goal: 'hypertrophy',
      availableEquipment: ['dumbbell'],
      timeAvailableMin: 30,
    });
    const roundTripped = JSON.parse(JSON.stringify(plan));
    expect(roundTripped.exercises).toBeInstanceOf(Array);
    expect(typeof roundTripped.estimatedDurationMin).toBe('number');
    for (const g of roundTripped.exercises) {
      expect(g.exercise).toBeDefined();
      expect(typeof g.sets).toBe('number');
      expect(typeof g.reps).toBe('string');
      expect(typeof g.restSec).toBe('number');
    }
  });
});
