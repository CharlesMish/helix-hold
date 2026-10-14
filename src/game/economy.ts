import type { DroneMode } from "./combat";

/** Crown's role experiment prices only count currently owned units of that type. */
export const DRONE_PRICES = {
  pierce: { base: 20, increment: 12 },
  sweep: { base: 24, increment: 12 },
  stasis: { base: 32, increment: 20 },
  halo: { base: 44, increment: 20 },
  pin: { base: 48, increment: 24 },
} as const satisfies Record<DroneMode, { base: number; increment: number }>;

type PricingFleet = {
  level: { dronePricing?: "per-type" };
  drones: readonly { mode: DroneMode }[];
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
  const owned = run.drones.filter(drone => drone.mode === mode).length;
  return price.base + price.increment * owned;
}
