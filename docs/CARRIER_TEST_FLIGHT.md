# Carrier Test Flight · v0.4 design record

**Current v0.5 update:** Stasis now slows travel by50% in this lab, with dashed preview/solid active fields, per-lane preview lengths and actual slowed-enemy brackets. The original three-wave schedule is unchanged. Sweep22 remains unchanged. Measurements below document v0.4’s30% candidate; current diagnosis is in STASIS_STUDY.md. Free selected setup repositioning is now implemented; see EXTENDED_DEFENSE.md.

2026-10-12. An optional three-wave experiment on existing Shear geometry. Select **Stasis + carrier**, then **Enter test flight**. Normal campaigns, local best scores, unlimited manual setup, piloting placement and Pierce stats remain intact.

## Question

Can a local slowing field make a useful trade against another damage drone, while a durable enemy rewards dedicated long-contact lines alongside broad multi-lane coverage? This is a first playable comparison, not an endless mode or a proof of final balance.

## Rules

| Element | Experiment behavior |
|---|---|
| Stasis | 6m radius, 30% slower travel, no damage |
| Membership | Actual enemy center inside the 3D sphere, including Wisp displacement |
| Overlap | Strongest-only; identical fields never compound |
| Cost | Same escalating 20, 32, 44, … scrap; consumes one of eight slots |
| Placement | Fly to center and anchor; Fan/Slide transform it with other drones |
| Preview | Amber nominal route coverage and three sphere rings; drifting Wisps may leave the field |
| Carrier | 486 hull, 4.2m/s, radius 2.2m, 60 scrap reward, 40-core breach |
| Carrier route | Wide Shear figure-eight, marked in the lane HUD and warm-tinted in the scene |
| Armor | Ordinary cumulative damage, no immunities or contact reset |
| Sweep | 22 DPS here only, radius 2.5m, range 38m, current nearest-target rule |
| Pierce | Unchanged: 20 DPS, radius 1.45m, range 76m, all contacts |
| Records | Encounter outcome only; no campaign score writes |

Field movement is evaluated at the existing fixed 60Hz simulation step; crossing a field boundary is quantized by at most one movement step. No arbitrary core exclusion is used. Centerline preview samples at no more than 0.5m spacing. Stasis tests actual centers with the same sphere predicate, not screen coordinates or hull overlap.

## Three waves

1. Establish: six slowed-route Shards on the short dive. Fund the first two lines and learn the space.
2. Crossings: six Shards and three Wisps on the wide loop; two Barges on the middle coil. Compare a field with a third damage line.
3. Carrier: one carrier on the wide loop, six dive Shards, two middle-coil Barges and three middle-coil Wisps. Earlier earned scrap funds reinforcement.

The dive retains its 0.55 group speed multiplier. A real near-crossing between the middle coil and wide loop lies around `(11.3,22.6,6.4)`. The familiar wide-loop self-crossing has 10m vertical separation: a 6m field centered on one branch does not reach the other branch. A sphere between branches may legitimately reach both if both actual centers are within its radius.

Core survival remains the encounter win condition. Carrier intercepted/breached is explicitly reported; a carrier breach is not silently equated with interception.

## Sweep study

Run `npm run study:sweep`. Same 84 near-route positions/orientations across seven campaign routes, four fixed seeds, one isolated Wisp or six Wisps at 1.4s intervals. Fixed drone and no pilot damage; each variant has 336 runs per case. These synthetic schedules include combinations outside authored waves and are not player win rates.

| Weapon | Isolated Wisp kill rate | Mean kills of six Wisps |
|---|---:|---:|
| Pierce 20 DPS | 12.5% | 0.84 |
| Campaign Sweep 18 DPS | 29.2% | 0.48 |
| Candidate Sweep 22 DPS | 51.2% | 0.95 |

Sweep's width already helps with isolated drifting targets; its obstruction rule costs effectiveness in crowds. The 22-DPS result justifies a bounded trial, not a global replacement for Pierce. Target selection remains nearest on every step. Sticky selection would be a separate mechanic and preview change.

## Funded feasibility

Run `npm run trial:carrier`. Placements teleport during setup to reachable poses; currency and rewards are real, no grants or stat changes. The pilot idles at the hangar and can fire normally. Both layouts use five drones: two opening Pierce lines, either a third Pierce or a Stasis field before wave two, then two earned Pierce reinforcements before the carrier wave.

| Layout | Final core | Kills | Carrier | Carrier-wave duration |
|---|---:|---:|---|---:|
| Damage only | 100% | 29 | Intercepted | 14.7s |
| One Stasis + damage lines | 100% | 29 | Intercepted | 15.1s |

Both ended with 188 scrap. This establishes attainable combat/budget feasibility at selected poses, not how easily a player can find/fly those placements or whether Stasis is stronger. The current trial does not establish an advantage for Stasis.

## Readability and checks

Established beams are thinner/dimmer during hits, and broad beam shells/established route highlights are limited to setup, Survey and Fan/Slide. Active placement coverage stays prominent. Existing contact-local feedback remains. Enemy fittings stay colored during hits; slightly tinted hulls and stronger pink Wisp accents separate enemies from the lavender lattice.

- `npm test`: 22 deterministic simulation checks, including pacing/controls, beam contact, contribution accounting, economy/refunds, field geometry/movement/overlap/preview, carrier damage/breach and campaign isolation.
- `npm run test:geometry`: every solid hull/accent vertex lies inside its collision sphere, including the new carrier.
- TypeScript and production build are checked during publication.
- Browser smoke coverage was extended, but **not run**. Approved browser control is unavailable in this managed Sites environment. No alternative browser or preview server was launched. HUD fit, field visibility, contrast during combat and human piloting still need an in-game check.

Next playtest: does Stasis feel worth sacrificing a damage-drone slot when placed at a useful real crossing? Secondary observations: can you distinguish enemies through a busy lattice, and does the trial Sweep earn a role catching strays?

## Deferred

Mirror/relay and endless are not implemented. Before any longer continuation, selected setup-only Reposition must reuse the same unit, mode and paid value. At eight slots, selling the first 20-scrap drone then replacing it costs 104 and silently taxes movement by 84. Selected Recall must refund its actual paid amount. Any optional three-wave continuation should happen after recording victory and use authored variation, not unbounded speed/health escalation.

A later relay study should use one bounce with remaining range/DPS conserved, no splitting, loops or double damage, and explicit broken-link preview when Fan/Slide moves the geometry.
