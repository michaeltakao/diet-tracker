'use client';

import { useEffect } from 'react';

const TEXT_SCALE_KEY = 'diet-tracker:text-scale';
const LARGE_CLASS = 'text-scale-large';

export type TextScale = 'standard' | 'large';

export function getTextScale(): TextScale {
  if (typeof window === 'undefined') return 'standard';
  try {
    return localStorage.getItem(TEXT_SCALE_KEY) === 'large' ? 'large' : 'standard';
  } catch {
    return 'standard';
  }
}

export function setTextScale(scale: TextScale): void {
  try {
    localStorage.setItem(TEXT_SCALE_KEY, scale);
  } catch {
    // localStorage unavailable (private mode / quota) — still apply visually
  }
  document.documentElement.classList.toggle(LARGE_CLASS, scale === 'large');
}

/**
 * Applies the saved text-scale class to <html> on mount.
 * Hydration-safe: SSR renders standard scale; the class is added client-side
 * only (same pattern as the speed-mode localStorage read in app/add/page.tsx).
 */
export default function TextScaleInit() {
  useEffect(() => {
    document.documentElement.classList.toggle(LARGE_CLASS, getTextScale() === 'large');
  }, []);
  return null;
}
