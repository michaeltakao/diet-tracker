/**
 * Safe JSON parsing helpers.
 *
 * Pure utilities (no data access, no side effects), so they may be imported
 * from any layer — including `lib/data/*`, which ADR-006 otherwise keeps away
 * from `@/lib/storage`. This centralises the `try { JSON.parse } catch { … }`
 * boilerplate that was previously copy-pasted across the persistence helpers.
 */

/**
 * Parse a JSON string, returning `fallback` instead of throwing.
 *
 * Returns `fallback` when `raw` is `null`/empty or when `JSON.parse` throws on
 * malformed input; otherwise returns the parsed value.
 *
 * @typeParam T - Expected shape of the parsed value. No runtime validation is
 *   performed — the cast is structural only, matching the call sites this
 *   replaces (which likewise trusted the persisted shape).
 * @param raw - Raw string, e.g. from `localStorage.getItem` (may be `null`).
 * @param fallback - Value returned when `raw` is absent or unparseable.
 * @returns The parsed value, or `fallback`.
 */
export function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
