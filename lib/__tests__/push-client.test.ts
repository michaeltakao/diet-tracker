import { describe, it, expect } from 'vitest';
import { urlBase64ToUint8Array } from '../push-client';

/** base64url-encode a byte array (test-side reference implementation). */
function toBase64Url(bytes: number[]): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

describe('urlBase64ToUint8Array', () => {
  it('decodes an unpadded string (length % 4 === 0)', () => {
    const bytes = [1, 2, 3]; // "AQID"
    expect([...urlBase64ToUint8Array(toBase64Url(bytes))]).toEqual(bytes);
  });

  it('restores stripped padding (length % 4 === 2 → "==")', () => {
    const bytes = [255]; // "_w" after stripping "=="
    const encoded = toBase64Url(bytes);
    expect(encoded.length % 4).toBe(2);
    expect([...urlBase64ToUint8Array(encoded)]).toEqual(bytes);
  });

  it('restores stripped padding (length % 4 === 3 → "=")', () => {
    const bytes = [255, 254]; // "__4" after stripping "="
    const encoded = toBase64Url(bytes);
    expect(encoded.length % 4).toBe(3);
    expect([...urlBase64ToUint8Array(encoded)]).toEqual(bytes);
  });

  it('maps URL-safe chars (- _) back to (+ /)', () => {
    // 0xfb 0xef 0xff → base64 "++//" → base64url "--__"
    expect([...urlBase64ToUint8Array('--__')]).toEqual([0xfb, 0xef, 0xff]);
  });

  it('round-trips a realistic 65-byte P-256 public key', () => {
    const bytes = Array.from({ length: 65 }, (_, i) => (i * 37 + 4) % 256);
    expect([...urlBase64ToUint8Array(toBase64Url(bytes))]).toEqual(bytes);
  });
});
