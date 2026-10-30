/**
 * Onboarding body step: which answers are real (ADR-008 P0-5).
 *
 * The steppers start on display defaults (25 y, 165 cm, 60 kg). Pressing 次へ
 * without touching them used to count as "confirmed", so the 60 kg default
 * was logged as today's weight (bug B6, measured 2026-10-15). A value is now
 * *provided* only when the user changed it in this wizard (touched) or it was
 * pre-filled from data they entered before; anything else is missing (null),
 * never a number. Defaults still feed the 仮 targets, but are never stored as
 * the participant's data.
 *
 * Pure module: no React, no storage.
 */

export type BodyField = 'birthYear' | 'sex' | 'heightCm' | 'weightKg';

export interface BodyValues {
  birthYear: number;
  sex: 'male' | 'female' | 'unset';
  heightCm: number;
  weightKg: number;
}

export interface BodyResolution {
  /** Profile fields to write; absent keys keep the stored value. */
  profile: { age?: number; sex?: 'male' | 'female' | null; heightCm?: number };
  /** Weight to log today — only a weight the user set in this wizard. */
  weightToLog: number | null;
  /** Onboarding record answers; null = not provided (not a default). */
  answers: {
    birthYear: number | null;
    sex: 'male' | 'female' | null;
    heightCm: number | null;
    weightKg: number | null;
  };
  /** Birth year, height and weight are all real → targets use real data. */
  complete: boolean;
}

/**
 * Decide what the body step may persist.
 *
 * @param values      Current stepper/chip values (may be display defaults).
 * @param touched     Fields the user changed in this wizard.
 * @param prefilled   Fields loaded from the user's earlier profile / weight log.
 * @param skipped     True when the user pressed スキップ on the body step.
 * @param currentYear Calendar year for the age approximation (year precision).
 */
export function resolveBody(
  values: BodyValues,
  touched: ReadonlySet<BodyField>,
  prefilled: ReadonlySet<BodyField>,
  skipped: boolean,
  currentYear: number,
): BodyResolution {
  if (skipped) {
    return {
      profile: {},
      weightToLog: null,
      answers: { birthYear: null, sex: null, heightCm: null, weightKg: null },
      complete: false,
    };
  }
  const provided = (f: BodyField) => touched.has(f) || prefilled.has(f);
  const sex = values.sex === 'unset' ? null : values.sex;

  const profile: BodyResolution['profile'] = {};
  if (touched.has('birthYear')) profile.age = currentYear - values.birthYear;
  if (touched.has('sex')) profile.sex = sex;
  if (touched.has('heightCm')) profile.heightCm = values.heightCm;

  return {
    profile,
    weightToLog: touched.has('weightKg') ? values.weightKg : null,
    answers: {
      birthYear: provided('birthYear') ? values.birthYear : null,
      sex: provided('sex') ? sex : null,
      heightCm: provided('heightCm') ? values.heightCm : null,
      weightKg: provided('weightKg') ? values.weightKg : null,
    },
    complete: provided('birthYear') && provided('heightCm') && provided('weightKg'),
  };
}
