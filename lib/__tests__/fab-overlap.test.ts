/**
 * ADR-008 P0-3: the feedback button must not overlap the dashboard FAB.
 *
 * Node test env has no layout engine, so the mobile (< lg) boxes are
 * computed from the Tailwind classes in the source (1 unit = 0.25 rem =
 * 4 px) at a 390×844 viewport. The browser check (elementFromPoint on the
 * FAB centre → the /add link) is in the ADR-008 re-measurement.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VW = 390;
const VH = 844;

interface Box { left: number; top: number; right: number; bottom: number }

function mobileBox(classes: string): Box {
  const tokens = classes.split(/\s+/).filter((t) => t && !t.includes(':'));
  const num = (prefix: string): number | undefined => {
    const t = tokens.find((x) => x.startsWith(prefix));
    return t ? Number(t.slice(prefix.length)) * 4 : undefined;
  };
  const bottom = num('bottom-');
  const right = num('right-');
  const size = num('size-') ?? num('w-');
  const height = num('size-') ?? num('h-');
  if (bottom == null || right == null || size == null || height == null) {
    throw new Error(`unparsed position classes: ${classes}`);
  }
  return { left: VW - right - size, right: VW - right, bottom: VH - bottom, top: VH - bottom - height };
}

function classBlock(file: string, marker: RegExp): string {
  const src = readFileSync(resolve(__dirname, '../..', file), 'utf8');
  const m = src.match(marker);
  if (!m) throw new Error(`marker not found in ${file}`);
  return m[1];
}

const intersects = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe('feedback button vs dashboard FAB (390×844)', () => {
  const fab = mobileBox(classBlock('app/dashboard/page.tsx', /href="\/add"\s*className="\s*(fixed[^"]+)"/));
  const feedback = mobileBox(classBlock('components/FeedbackButton.tsx', /className="\s*(fixed[^"]+)"/));

  it('parses both boxes', () => {
    expect(fab.bottom - fab.top).toBe(56);
    expect(feedback.bottom - feedback.top).toBe(48);
  });

  it('bounding boxes do not intersect', () => {
    expect(intersects(fab, feedback)).toBe(false);
  });
});
