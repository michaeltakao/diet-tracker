# Spacing audit — 8px grid (design phase 3, 2026-07-17)

Phase 3 of the Duolingo-inspired design migration introduced the 8px grid at
the **token level** (`--space-1…8`, radius scale snapped in `app/globals.css`)
without touching Tailwind's numeric spacing engine — v4 utilities are
4px-per-unit, so even steps are already grid-compliant and remapping the
scale would have silently changed 227 usages and broken 183 `rounded-2xl/3xl`.

## Grid definition

| Token | px | Grid |
|---|---|---|
| `--space-1` | 4 | ½ (minimum) |
| `--space-2` | 8 | 1 |
| `--space-3` | 12 | 1.5 |
| `--space-4` | 16 | 2 |
| `--space-5` | 24 | 3 |
| `--space-6` | 32 | 4 |
| `--space-7` | 48 | 6 |
| `--space-8` | 64 | 8 |

Radius scale (Tailwind override, applies immediately):
`rounded` 8 / `sm` 4 / `md` 8 / `lg` 12 / `xl` 16 / `2xl` 24 / `3xl` 32,
`--radius-field` 16 (was 14), `--radius-card` 24.

## Off-grid usage inventory (to normalize in phases 4–5)

Counted across `app/` + `components/` (`*.tsx`), 2026-07-17. These are NOT
mechanically swept — each is a visual decision that belongs to the component
redesign (phase 4) and dashboard relayout (phase 5), where every touched
component gets its spacing normalized as it is restyled.

| Utility | px | Count | Normalize to |
|---|---|---|---|
| `*-0.5` | 2 | 93 | `*-1` (4px) or remove |
| `*-1.5` | 6 | 170 | `*-2` (8px), `*-1` where tight |
| `*-2.5` | 10 | 82 | `*-2` (8px) or `*-3` (12px) |
| `*-3.5` | 14 | 24 | `*-4` (16px) |
| `*-5` | 20 | 42 | `*-4` (16px) or `*-6` (24px) |
| `*-9` | 36 | 1 | `*-8` (32px) or `*-10` (40→48 case-by-case) |
| `*-10` | 40 | 10 | keep (5 grid) or `*-12` (48px) |

Already grid-compliant (no action): all even steps ≤4px-unit scale
(`*-1/2/3/4/6/8/12/16/20/24/28/56` etc.), `rounded-full`, w/h sizing
utilities (element sizing is out of the grid's scope — the grid governs
whitespace).

## Rules going forward

1. New code uses grid steps only: 4, 8, 12, 16, 24, 32, 48, 64.
2. Custom offsets / arbitrary values reference `var(--space-N)`.
3. Phase 4/5 component work normalizes the table above file-by-file;
   this document is the checklist (update counts as they reach zero).
