/** Weapon geometry lives here so combat and placement previews use the same hit test. */
export type DroneMode = "pierce" | "sweep" | "stasis";

export const STASIS_RADIUS = 6;
export const STASIS_SPEED_SCALE = 0.5;

export const DRONE_SPECS = {
  pierce: {
    label: "Pierce",
    dps: 20,
    radius: 1.45,
    range: 76,
    color: 0xb5a2ff,
    description: "Long, narrow beam. Hits every enemy in its line.",
    pierces: true,
  },
  stasis: {
    label: "Stasis", dps: 0, radius: STASIS_RADIUS, range: 0, color: 0xffbb79,
    description: "6m sphere. Slows enemies by 50%; no damage. Fields do not stack.", pierces: false,
  },
  sweep: {
    label: "Sweep",
    dps: 18,
    radius: 2.5,
    range: 38,
    color: 0x71e7ef,
    description: "Wide, short beam. Hits the nearest enemy in its line.",
    pierces: false,
  },
} as const;

export type Beam = {
  x: number;
  y: number;
  z: number;
  /** Unit forward vector; all callers construct this from normalized aim. */
  dx: number;
  dy: number;
  dz: number;
  range: number;
  radius: number;
  dps: number;
  pierces: boolean;
};

export type BeamTarget = { x: number; y: number; z: number; radius: number };

/**
 * Returns the enemy center's distance along a finite cylindrical beam, or null.
 * A target's own hull radius contributes to reach. The near/far limits apply to
 * its center, matching the original gunship rule (including the 0.4m muzzle gap).
 * This is a continuous laser, not a projectile or ship-body collision system.
 */
export function beamContact(beam: Beam, target: BeamTarget): number | null {
  const x = target.x - beam.x;
  const y = target.y - beam.y;
  const z = target.z - beam.z;
  const t = x * beam.dx + y * beam.dy + z * beam.dz;
  if (t < 0.4 || t > beam.range) return null;
  const ex = x - beam.dx * t;
  const ey = y - beam.dy * t;
  const ez = z - beam.dz * t;
  const reach = beam.radius + target.radius;
  return ex * ex + ey * ey + ez * ez <= reach * reach ? t : null;
}

/** Pierce keeps every contact; Sweep chooses the nearest along the firing line. */
export function selectBeamTargets<T extends BeamTarget>(beam: Beam, targets: readonly T[]): T[] {
  const hits: T[] = [];
  let nearest: T | undefined;
  let nearestDistance = Infinity;
  for (const target of targets) {
    const distance = beamContact(beam, target);
    if (distance === null) continue;
    if (beam.pierces) hits.push(target);
    else if (distance < nearestDistance) {
      nearest = target;
      nearestDistance = distance;
    }
  }
  if (nearest) hits.push(nearest);
  return hits;
}

/** Field membership follows the enemy center in world space, not its path or screen position. */
export function insideStasis(center: { x: number; y: number; z: number }, point: { x: number; y: number; z: number }): boolean {
  return (center.x - point.x) ** 2 + (center.y - point.y) ** 2 + (center.z - point.z) ** 2 <= STASIS_RADIUS ** 2;
}
