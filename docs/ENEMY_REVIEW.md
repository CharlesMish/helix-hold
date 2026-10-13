# Enemy appearance and path alignment review

## Findings

The square Barges did not drift away from their assigned route. `placeEnemy` evaluates `path.pointAt(enemy.dist)` and adds no offset for either Barges or Shards (`amp = 0`). The rendered model was centered on that same position. A check of 2,100 simulated enemy positions across the seven current routes found zero center offset for both kinds.

Their visible geometry was larger than their combat spheres, however. In the previous renderer, a Barge's box body reached 1.476 m from its center and its outline reached 1.510 m, beyond the 1.25 m hit radius. Its rotating box corners and broad glow could therefore make the visible edges appear displaced from a thin route. The Shard and Wisp models also extended beyond their hit spheres.

Wisps deliberately move outside the ribbon. Their 2.25 m lateral oscillation combines with a second oscillation of up to 1.0125 m in a perpendicular direction. The combined theoretical limit is approximately 2.467 m; the sampled maximum was 2.456 m. Their hit test follows their actual displaced center.

## Rendering revision

| Kind | New form | Collision radius | Maximum solid-model radius |
| --- | --- | ---: | ---: |
| Shard | Pearl dart, slate cockpit, faceted wings, coral fittings | 0.720 m | 0.680 m |
| Barge | Rounded armored seedpod, pale overlapping plates, gold bands | 1.250 m | 1.190 m |
| Wisp | Three pale petals, slender orchid orbital rings | 0.640 m | 0.602 m |

Both hull vertices and luminous physical fittings remain inside the listed collision radius. No additional per-instance scaling expands the hulls. Soft halos and thin exhaust are decorative and remain translucent. Six instanced hull/accent draws preserve the existing enemy rendering structure; the new materials share the ship and drones' pearl, slate and restrained luminous accents.

Each Wisp now has a faint orchid filament back to its nominal point on the ribbon, with a small ring at that point. This makes intentional drift legible without changing its motion or hit test. The filament is not a targeting beam.

Beam coverage behavior is unchanged: its route highlight estimates contact for Shard-sized targets. Actual damage still evaluates each enemy's simulated center and radius. The beam's near and far limits use the enemy center, while the lateral test includes its hull radius.

## Gates and route introduction

Manual preparation has no imminent-spawn pulse or false countdown animation. The next wave's selected gates remain steadily lit until launch. Active spawning and automatic countdowns retain imminent-spawn pulses. Routes that no announced wave has used are faint, and their decorative flow markers stay dormant. In Flight School, dormant routes also stay outside the placement coverage preview until introduced. The two open arenas retain full-route coverage previews.

## Verification

- TypeScript check passes.
- Every vertex of every new solid hull and accent geometry was measured against its collision sphere.
- 2,100 simulated samples covered all current routes and all three enemy kinds; Shard and Barge center offsets were exactly zero, and Wisp offsets stayed within the expected oscillation bound.
- Dynamic enemy, tether, trail and halo meshes retain safe bounds handling when initially empty.
- Browser appearance has not been inspected in this environment. These checks verify geometry and simulation agreement, not final aesthetic judgment.

## v0.4 readability follow-up (2026-10-12)

The supplied paused-frame description is treated as a contrast problem, not evidence of a new disappearance bug. Established combat beams are thinner and dimmer, and their full translucent volumes/route coverage appear only in setup, Survey or lattice adjustment. Active placement coverage is preserved. Existing local contact effects remain while hit accents keep their kind color instead of becoming mostly white. Hull tint and wider fittings help distinguish coral Shards, gold Barges and pink Wisps.

A coral carrier reuses the Barge form at 1.7× geometry size with a separately sized collision sphere. `npm run test:geometry` measures solid hull/accent vertices: Shard 0.6800 ≤ 0.72m; Barge 1.1900 ≤ 1.25m; Wisp 0.6084 ≤ 0.64m; carrier 2.0230 ≤ 2.2m. All dynamic enemy meshes retain safe empty-population bounds behavior. Decorative halos are not collision geometry.

These are source/geometry-verified changes. Browser appearance and final contrast still require an in-game review.

## v0.5 Stasis feedback

Dashed, unfilled sphere rings distinguish a proposed field from solid anchored fields. Actual occupancy brightens anchored boundaries; actual slowed enemies get small amber brackets without replacing kind colors. Both boundaries are tested at6m radius. These marks report the simulation’s state, not projected screen containment. A cyan marker identifies a selected setup drone; relocating its old visual dims until commit/cancel. Browser contrast remains unverified.
