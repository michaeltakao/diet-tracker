/**
 * Client-side photo downscaling (ADR-008 P0-2).
 *
 * A 12 MP phone photo read with `readAsDataURL` is ~4–8 MB of base64; it was
 * posted to the AI routes as-is and copied into localStorage, which filled
 * the ~5 MB quota after one or two meals (B3). Photos are now redrawn on a
 * canvas with the long edge capped at {@link MAX_EDGE_PX} and encoded as
 * JPEG at {@link JPEG_QUALITY}.
 */

export const MAX_EDGE_PX = 1280;
export const JPEG_QUALITY = 0.8;

export interface Size {
  width: number;
  height: number;
}

/**
 * Target size so the long edge is at most `maxEdge`, keeping the aspect
 * ratio. Images already within the limit are returned unchanged (never
 * upscaled). Both edges are at least 1 px.
 */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE_PX): Size {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const long = Math.max(width, height);
  if (long <= maxEdge) return { width, height };
  const scale = maxEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; size: Size; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation 'from-image' applies EXIF rotation (phone portraits).
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, size: { width: bmp.width, height: bmp.height }, close: () => bmp.close() };
    } catch {
      // Some engines reject the options object or the format: try <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      size: { width: img.naturalWidth, height: img.naturalHeight },
      close: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/**
 * Downscale an image file to a JPEG data URL (long edge ≤ 1280 px, q 0.8).
 *
 * Falls back to the original bytes as a data URL when the browser cannot
 * decode the file (e.g. HEIC outside Safari) — the AI route then gets the
 * original, as before this change. Nothing here writes to storage.
 */
export async function resizeImageFile(
  file: Blob,
  maxEdge = MAX_EDGE_PX,
  quality = JPEG_QUALITY,
): Promise<string> {
  let decoded: Awaited<ReturnType<typeof decode>>;
  try {
    decoded = await decode(file);
  } catch {
    return readAsDataUrl(file);
  }
  try {
    const target = fitWithin(decoded.size.width, decoded.size.height, maxEdge);
    // No intrinsic size (e.g. some SVGs): a 0×0 canvas encodes as 'data:,'.
    if (target.width === 0 || target.height === 0) return readAsDataUrl(file);
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return readAsDataUrl(file);
    // JPEG has no alpha: paint white first so transparent PNGs don't turn black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(decoded.source, 0, 0, target.width, target.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    decoded.close();
  }
}
