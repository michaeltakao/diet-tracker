/**
 * Biomechanical angle utilities.
 *
 * Keypoint coordinate system matches MediaPipe BlazePose:
 *   x, y ∈ [0, 1] (normalized), z ∈ [-1, 1] (depth, relative to hip)
 *
 * Robotics note: all functions use the same vector math as
 * Denavit-Hartenberg joint angle extraction for serial manipulators.
 */

export interface Keypoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/**
 * Angle at joint B, formed by rays B→A and B→C.
 * Returns degrees in [0, 180].
 */
export function angleBetween(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  return Math.degrees(Math.acos(Math.clamp(dot / (magBA * magBC), -1, 1)));
}

/**
 * Angle of a line segment relative to vertical (degrees).
 * 0° = perfectly vertical, 90° = horizontal.
 * Used for trunk lean and shin angle.
 */
export function angleFromVertical(top: Keypoint, bottom: Keypoint): number {
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  const rad = Math.atan2(Math.abs(dx), Math.abs(dy));
  return Math.degrees(rad);
}

/**
 * Whether a keypoint is visible enough to trust (visibility > threshold).
 */
export function isVisible(kp: Keypoint, threshold = 0.5): boolean {
  return (kp.visibility ?? 1) >= threshold;
}

/**
 * All keypoints required for a given exercise are sufficiently visible.
 */
export function allVisible(kps: Keypoint[], threshold = 0.5): boolean {
  return kps.every(kp => isVisible(kp, threshold));
}

// Extend Math with helpers (avoids repeated boilerplate)
declare global {
  interface Math {
    degrees(radians: number): number;
    clamp(value: number, min: number, max: number): number;
  }
}

Math.degrees = (r: number) => (r * 180) / Math.PI;
Math.clamp   = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
