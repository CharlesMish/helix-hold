export type Vec3 = { x: number; y: number; z: number };

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function hypot3(x: number, y: number, z: number): number {
  return Math.hypot(x, y, z);
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** yaw 0 faces world −Z. +yaw turns the nose toward −X (left on a chase cam). */
export function forwardOf(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cp,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cp,
  };
}
