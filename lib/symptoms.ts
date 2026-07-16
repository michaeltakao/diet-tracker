/**
 * Pure symptom-log helpers: input bounds and shared vocabularies.
 *
 * Bounds mirror the SQL CHECKs in migration 014 (severity 1–10, duration
 * 1–10080 min = one week). Record + display only — nothing here interprets
 * or diagnoses.
 */

/** Common symptom names offered by the <datalist> autocomplete. */
export const COMMON_SYMPTOMS = ['頭痛', '発熱', '腹痛', '吐き気', 'めまい', '倦怠感'] as const;

/** Trigger chip vocabulary (kept TEXT in SQL for flexibility). */
export const SYMPTOM_TRIGGERS = ['食事', '運動', 'ストレス', '天候', '睡眠不足', '不明'] as const;

export const SEVERITY_MIN = 1;
export const SEVERITY_MAX = 10;
export const DURATION_MIN_MINUTES = 1;
export const DURATION_MAX_MINUTES = 10_080; // one week

export function isValidSeverity(severity: number): boolean {
  return Number.isInteger(severity) && severity >= SEVERITY_MIN && severity <= SEVERITY_MAX;
}

/** Duration is optional; undefined is valid, a provided value must be in bounds. */
export function isValidDuration(durationMin: number | undefined): boolean {
  if (durationMin === undefined) return true;
  return (
    Number.isInteger(durationMin) &&
    durationMin >= DURATION_MIN_MINUTES &&
    durationMin <= DURATION_MAX_MINUTES
  );
}

export interface SymptomInput {
  name: string;
  severity: number;
  durationMin?: number;
}

/** True when the minimal recordable shape is satisfied. */
export function isValidSymptomInput(input: SymptomInput): boolean {
  return (
    input.name.trim().length > 0 &&
    isValidSeverity(input.severity) &&
    isValidDuration(input.durationMin)
  );
}
