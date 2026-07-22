'use client';

import { useEffect } from 'react';

const TEXT_SCALE_KEY = 'diet-tracker:text-scale';
const LARGE_CLASS = 'text-scale-large';
const XLARGE_CLASS = 'text-scale-xlarge';
const SCALE_CLASSES = [LARGE_CLASS, XLARGE_CLASS];

export type TextScale = 'standard' | 'large' | 'xlarge';

export function getTextScale(): TextScale {
  if (typeof window === 'undefined') return 'standard';
  try {
    const v = localStorage.getItem(TEXT_SCALE_KEY);
    return v === 'large' || v === 'xlarge' ? v : 'standard';
  } catch {
    return 'standard';
  }
}

function applyTextScaleClass(scale: TextScale): void {
  document.documentElement.classList.remove(...SCALE_CLASSES);
  if (scale === 'large') document.documentElement.classList.add(LARGE_CLASS);
  if (scale === 'xlarge') document.documentElement.classList.add(XLARGE_CLASS);
}

export function setTextScale(scale: TextScale): void {
  try {
    localStorage.setItem(TEXT_SCALE_KEY, scale);
  } catch {
    // localStorage unavailable (private mode / quota) — still apply visually
  }
  applyTextScaleClass(scale);
}

/**
 * Applies the saved text-scale class to <html> on mount.
 * Hydration-safe: SSR renders standard scale; the class is added client-side
 * only (same pattern as the speed-mode localStorage read in app/add/page.tsx).
 */
export default function TextScaleInit() {
  useEffect(() => {
    applyTextScaleClass(getTextScale());
  }, []);
  return null;
}
