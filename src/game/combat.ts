/** Weapon geometry lives here so combat and placement previews use the same hit test. */
export type DroneMode = "pierce" | "sweep" | "stasis" | "halo" | "pin" | "lumen" | "relay";

export const STASIS_RADIUS = 6;
export const STASIS_SPEED_SCALE = 0.5;
export const HALO_RADIUS = 5;
export const PIN_DAMAGE = 24;
export const PIN_INTERVAL = 1.6;
export const PIN_SLOW_DURATION = 2.4;
export const PIN_SPEED_SCALE = 0.65;
export const PIN_FLASH_DURATION = 0.18;
export const LUMEN_SLOW_DURATION = 2.4;
export const LUMEN_SPEED_SCALE = 0.6;
export const RELAY_RADIUS = 1;

export const DRONE_SPECS = {
  lumen: {
    label: "Lumen", dps: 8, radius: 1.1, range: 76, color: 0xa4ecff,
    description: "One emitter. Fixed light slows the nearest enemy 40% for 2.4s and deals 8 DPS. One Relay can turn its remaining range.", pierces: false,
  },
  relay: {
    label: "Relay", dps: 0, radius: RELAY_RADIUS, range: 0, color: 0xf1bdff,
    description: "No weapon. Receives Lumen light and redirects it along your aim. One turn; shared range. Re-aim free during setup.", pierces: false,
  },
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
  halo: {
    label: "Halo", dps: 18, radius: HALO_RADIUS, range: 0, color: 0xff789d,
    description: "Passive 5m sphere. Deals 18 damage per second to every enemy inside; no aiming needed.", pierces: true,
  },
  pin: {
    label: "Pin", dps: PIN_DAMAGE / PIN_INTERVAL, radius: 1.1, range: 60, color: 0x9fdc87,
    description: "Fixed line. Every 1.6s, hits the nearest target for 24 damage and slows it 35% for 2.4s.", pierces: false,
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

/** Pierce keeps every contact; Sweep and Pin choose the nearest along the firing line. */
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

/** Field membership follows the enemy center in world space, not hull radius or screen position. */
export function insideSphere(center: { x: number; y: number; z: number }, point: { x: number; y: number; z: number }, radius: number): boolean {
  return (center.x - point.x) ** 2 + (center.y - point.y) ** 2 + (center.z - point.z) ** 2 <= radius ** 2;
}

export function insideStasis(center: { x: number; y: number; z: number }, point: { x: number; y: number; z: number }): boolean {
  return insideSphere(center, point, STASIS_RADIUS);
}
