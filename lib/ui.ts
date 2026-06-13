/**
 * Shared presentational class strings.
 *
 * Centralises Tailwind utility combinations that were duplicated across the
 * card surfaces so styling has a single source of truth. These are plain
 * strings (not components) to keep call sites unchanged apart from the import —
 * compose extra utilities with a template literal, e.g. `` `${CARD} p-4` ``.
 */

/** Base surface card: background, rounding, elevation, and hairline border. */
export const CARD = 'bg-card rounded-3xl shadow-card border border-line';
