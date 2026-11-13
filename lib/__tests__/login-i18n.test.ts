/** ADR-008 P0-8: /login text is Japanese by default (translations.ja). */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { translations } from '../i18n';

const JP = /[぀-ヿ一-鿿]/;
const PAGE = readFileSync(resolve(__dirname, '../../app/login/page.tsx'), 'utf8');
const usedKeys = [...new Set([...PAGE.matchAll(/\bt\.(login\w+)/g)].map((m) => m[1]))];

describe('/login localisation', () => {
  it('uses the login* keys', () => {
    expect(usedKeys.length).toBeGreaterThanOrEqual(15);
  });

  it.each(usedKeys)('%s has Japanese text in ja and a non-empty en string', (key) => {
    const ja = (translations.ja as Record<string, string>)[key];
    const en = (translations.en as Record<string, string>)[key];
    expect(en, `en.${key}`).toBeTruthy();
    // Brand-free keys must contain Japanese; 'loginOr' etc. included.
    expect(ja, `ja.${key}`).toMatch(JP);
  });

  it('page has no hard-coded English sentences left in JSX text', () => {
    // A JSX text node = text between > and < on its own; flag 3+ latin words.
    const jsxText = [...PAGE.matchAll(/>\s*([A-Za-z][A-Za-z ,.'’—-]{12,})\s*</g)].map((m) => m[1].trim());
    expect(jsxText.filter((s) => s !== 'Diet Tracker')).toEqual([]);
  });
});
