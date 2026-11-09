/** ADR-008 P0-2: photos are downscaled before preview/upload. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fitWithin, resizeImageFile, MAX_EDGE_PX, JPEG_QUALITY } from '../image-resize';

describe('fitWithin', () => {
  it('12 MP landscape (4000×3000) → 1280×960', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 });
  });
  it('12 MP portrait (3024×4032) → long edge 1280, ratio kept', () => {
    const r = fitWithin(3024, 4032);
    expect(r.height).toBe(1280);
    expect(r.width).toBe(960);
  });
  it('never upscales a small image', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1280, 720)).toEqual({ width: 1280, height: 720 });
  });
  it('extreme panorama keeps ≥ 1 px edges', () => {
    expect(fitWithin(100000, 10)).toEqual({ width: 1280, height: 1 });
  });
  it('invalid sizes → 0×0', () => {
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(Number.NaN, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe('resizeImageFile', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws a 12 MP bitmap at 1280×960 and encodes JPEG q0.8', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close })));
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillStyle: '', fillRect: vi.fn(), drawImage }),
      toDataURL: vi.fn((type: string, q: number) => `data:${type};base64,AAAA#${q}`),
    };
    vi.stubGlobal('document', { createElement: () => canvas });

    const out = await resizeImageFile(new Blob(['x']));
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(960);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1280, 960);
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', JPEG_QUALITY);
    expect(out.startsWith('data:image/jpeg')).toBe(true);
    expect(close).toHaveBeenCalled();
    expect(MAX_EDGE_PX).toBe(1280);
  });
});
