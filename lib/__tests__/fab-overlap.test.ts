/**
 * ADR-008 P0-3: the feedback button must not overlap the add-meal FAB
 * (in components/BottomNav.tsx since ADR-011, shown on every tabbed page).
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
  const fab = mobileBox(classBlock('components/BottomNav.tsx', /href="\/add"\s*className="\s*lg:hidden\s*(fixed[^"]+)"/));
  const feedback = mobileBox(classBlock('components/FeedbackButton.tsx', /className="\s*(fixed[^"]+)"/));

  it('parses both boxes', () => {
    expect(fab.bottom - fab.top).toBe(56);
    expect(feedback.bottom - feedback.top).toBe(48);
  });

  it('bounding boxes do not intersect', () => {
    expect(intersects(fab, feedback)).toBe(false);
  });
});

describe('PWA install banner vs FAB + feedback button (390×844)', () => {
  // The banner spans the full width (left-4 right-4) and its height depends
  // on its text, so the only safe placement is entirely above the stack:
  // its bottom edge must sit higher than both buttons' top edges.
  const banner = classBlock('components/PwaInstallBanner.tsx', /aria-label="ホーム画面に追加"\s*className="\s*(fixed[^"]+)"/);
  const mobileBottomPx = (classes: string): number => {
    const t = classes.split(/\s+/).find((x) => x.startsWith('bottom-'));
    if (!t) throw new Error(`no mobile bottom- class: ${classes}`);
    return Number(t.slice('bottom-'.length)) * 4;
  };
  const fab = mobileBox(classBlock('components/BottomNav.tsx', /href="\/add"\s*className="\s*lg:hidden\s*(fixed[^"]+)"/));
  const feedback = mobileBox(classBlock('components/FeedbackButton.tsx', /className="\s*(fixed[^"]+)"/));

  it('banner bottom edge is above both buttons', () => {
    const bannerBottom = VH - mobileBottomPx(banner);
    expect(bannerBottom).toBeLessThanOrEqual(fab.top);
    expect(bannerBottom).toBeLessThanOrEqual(feedback.top);
  });
});

describe('safe-area insets (UX P0 slice 2)', () => {
  // viewportFit: cover + black-translucent → the installed PWA draws under
  // the home indicator. Every bottom-anchored fixed element must add the
  // inset; using one margin class keeps the gaps tested above unchanged.
  const css = readFileSync(resolve(__dirname, '../..', 'app/globals.css'), 'utf8');

  it('globals.css defines the env() utilities', () => {
    expect(css).toMatch(/\.mb-safe\s*\{\s*margin-bottom:\s*env\(safe-area-inset-bottom/);
    expect(css).toMatch(/\.pb-safe\s*\{\s*padding-bottom:\s*env\(safe-area-inset-bottom/);
    expect(css).toMatch(/padding-top:\s*env\(safe-area-inset-top/);
  });

  it('FAB, feedback button and install banner carry mb-safe; the tab bar pb-safe', () => {
    const fab = classBlock('components/BottomNav.tsx', /href="\/add"\s*className="\s*lg:hidden\s*(fixed[^"]+)"/);
    const feedback = classBlock('components/FeedbackButton.tsx', /className="\s*(fixed[^"]+)"/);
    const banner = classBlock('components/PwaInstallBanner.tsx', /aria-label="ホーム画面に追加"\s*className="\s*(fixed[^"]+)"/);
    const nav = classBlock('components/BottomNav.tsx', /<nav[\s\S]*?className="\s*lg:hidden\s*(fixed[^"]+)"/);
    for (const c of [fab, feedback, banner]) expect(c.split(/\s+/)).toContain('mb-safe');
    expect(nav.split(/\s+/)).toContain('pb-safe');
  });

  it('floating feedback button is desktop-only (mobile uses the inline one)', () => {
    const feedback = classBlock('components/FeedbackButton.tsx', /className="\s*(fixed[^"]+)"/);
    const tokens = feedback.split(/\s+/);
    expect(tokens).toContain('hidden');
    expect(tokens).toContain('lg:flex');
  });

  it('feedback button is not rendered on /add or /onboarding', () => {
    const src = readFileSync(resolve(__dirname, '../..', 'components/FeedbackButton.tsx'), 'utf8');
    expect(src).toMatch(/pathname === '\/add'/);
    expect(src).toMatch(/startsWith\('\/onboarding'\)/);
  });
});
