import type { DroneMode } from "./combat";

/** Crown's role experiment prices only count currently owned units of that type. */
export const DRONE_PRICES = {
  pierce: { base: 20, increment: 12 },
  sweep: { base: 24, increment: 12 },
  stasis: { base: 32, increment: 20 },
  halo: { base: 44, increment: 20 },
  pin: { base: 48, increment: 24 },
  lumen: { base: 48, increment: 24 },
  relay: { base: 16, increment: 8 },
  /** One price buys a whole strand: the first post is paid, the second completes it free. */
  tripwire: { base: 36, increment: 18 },
} as const satisfies Record<DroneMode, { base: number; increment: number }>;

type PricingFleet = {
  level: { dronePricing?: "per-type" };
  drones: readonly { mode: DroneMode; partnerId?: number | null; paid?: number }[];
  droneMode: DroneMode;
};

/** Original shared purchase curve, retained for other arenas and historical studies. */
export function anchorCost(droneCount: number): number {
  return 20 + droneCount * 12;
}

/** Quote a new purchase. Reposition and Recall retain the existing unit's paid value. */
export function getAnchorCost(run: PricingFleet, mode: DroneMode = run.droneMode): number {
  if (run.level.dronePricing !== "per-type") return anchorCost(run.drones.length);
  const price = DRONE_PRICES[mode];
  if (mode === "tripwire") {
    // An open first post means the next Tripwire anchor completes that strand for free.
    const posts = run.drones.filter((drone) => drone.mode === "tripwire");
    if (posts.some((drone) => (drone.partnerId ?? null) === null)) return 0;
    return price.base + price.increment * posts.filter((drone) => (drone.paid ?? 0) > 0).length;
  }
  const owned = run.drones.filter((drone) => drone.mode === mode).length;
  return price.base + price.increment * owned;
}
