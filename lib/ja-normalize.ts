/**
 * Canonicalise Japanese free text for substring matching (food names,
 * medication names, rule keywords).
 *
 * Steps, applied to BOTH sides of every comparison:
 *   1. NFKC — half-width kana → full-width, full-width ASCII → ASCII.
 *   2. Drop separators (whitespace, ・) so "グレープ・フルーツ" = "グレープフルーツ".
 *   3. Katakana → hiragana by code-point shift (U+30A1–U+30F6 − 0x60), so every
 *      katakana/hiragana pair (ササミ/ささみ, ワーファリン/わーふぁりん) matches.
 *   4. Lower-case.
 *
 * The long-vowel mark ー is kept: it is not a separator, and dropping it would
 * make short terms (ビール → びる) match more unrelated words.
 */
export function normalizeJaText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\s・]/gu, '')
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .toLowerCase();
}

/**
 * Bidirectional normalised medication match: a keyword matches when either
 * string contains the other ("ワーファリン錠1mg" ⊇ "ワーファリン", and a short
 * user entry like "ワルファリン" ⊆ a longer keyword). Medications that
 * normalise to '' are ignored — `kw.includes('')` would otherwise match
 * every rule.
 */
export function medicationMatches(keywords: readonly string[], medications: readonly string[]): boolean {
  const meds = medications.map(normalizeJaText).filter(m => m.length > 0);
  return keywords.some(raw => {
    const kw = normalizeJaText(raw);
    return meds.some(med => med.includes(kw) || kw.includes(med));
  });
}
