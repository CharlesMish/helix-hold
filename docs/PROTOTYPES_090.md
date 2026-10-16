# v0.9.0 — Helix Frontier and Relay Lab

Charlie approved playable prototypes with priority on interesting coils and spatial decisions, explicitly asking not to spend this pass on precise wave balance. This is design authorization, not a new v0.8.1 playtest. Started from authenticated Sites `1c85f390b01b7d3e27278ada85ab9e0f3af76e12` and GitHub `a24e5b2ac3acd4a3734ddc6c9dd38d75348a979c`.

The existing five arenas retain their authored geometry, schedules, rosters, prices and scores. Crown still has its eight-wave checkpoint plus four optional continuation waves. Both additions are opt-in entries under **LAB · OPTIONAL EXPERIMENTS**, with no campaign score or continuation. They preserve fixed aim, piloted placement, independent per-type pricing, uncapped scrap-funded growth, free setup Reposition and default unlimited Plan & launch.

## Helix Frontier: geometry before endurance

Nine light authored waves defend a holographic rectangular volume, centered at `(0,10,0)`, size `16 × 16 × 12m`. Each route ends at its own actual port rather than converging at the old core point. Leaks and their feedback use that endpoint. The box is a readable objective, not a physical obstacle or beam blocker.

| Gate | Opens | Shape | Length | Arrival port |
|---|---:|---|---:|---|
| A · West Spindle | 1 | Descending vertical coil, +1.2 turns | 97.96m | `(-8,8,-3)` |
| B · East Return | 3 | Opposite winding, −1.25 turns | 94.21m | `(8,12,2)` |
| C · North Vault | 6 | Horizontal-axis coil, +1.15 turns | 98.36m | `(0,16,-6)` |

Older routes remain in use. A/B's coils are separated by at least 33.58m; A/C have a closer 9.13m neighborhood, B/C 14.12m. Those measurements exclude final approach tails. This gives an early resource split and a later opportunity to reuse some lines. No route enters the protected volume before its final port. All sampled paths remain comfortably within the existing flight envelope; the arena is spread out within it, not a larger physical flight boundary.

Newly opening routes get an optional solid ribbon during their setup. **G**, or the Survey button, toggles it. It is not a permanent thick ribbon over the whole arena. Main coverage counts this wave; later coverage remains separate. Routes, gate labels and ports share cyan/purple/orange colors. The generated [route chart](../public/frontier-routes.svg) contains oblique, plan and elevation views from the actual path data.

Starts with 60 scrap and the Crown roster: Pierce, Sweep, Stasis, Halo, Pin. No new carrier or immunity. Waves have at most 18 enemies, ordinary hull and 0.9 speed multiplier. These are a modest finite test schedule, **not endless mode**. Opening more routes indefinitely would still need authored space, pacing and performance work.

### Coarse feasibility probe

`npm run trial:frontier` reproduces `FRONTIER_TRIAL.json`: one seed, 428 finite legal candidate poses, greedy current-wave Pierce coverage, ordinary earned purchases, no combat reposition, no bonus scrap and an idle pilot. A second control uses the same policy but stops purchasing after wave 2. No wave or hull values were searched.

| Opening | Existing fleet contact on new route | After one paid addition | Existing drones' damage that wave |
|---|---:|---:|---:|
| B · wave 3 | 0m | 19.94m | 140 |
| C · wave 6 | 4.99m | 28.46m | 285.33 |

The growing example finishes nine waves at 100 core with 12 Pierces and 1,032 spent scrap. The frozen three-drone control loses during wave 5. This establishes an affordable response to the new gaps and continuing work for old placements. It does **not** establish human difficulty, optimality or late survival balance. Contact metres are summed per drone, not unique route coverage. Actual peak live count in this probe is 15.

## Relay Lab: one slowing-light connection

Four light waves on Frontier A/B: A, B, both, then two convoys. Starts with 100 scrap, enough for Pierce + Lumen + Relay (84). Stasis and Pin stay available for comparison; Halo is absent. This isolates the connection mechanic without also introducing a third route.

| Unit | First cost / own-type increase | Contract |
|---|---|---|
| Lumen · key 6 | 48 / one emitter maximum | Fixed 76m line, radius 1.1m, 8 DPS; terminal enemy gets 40% slow for 2.4s |
| Relay · key 7 | 16 / +8 per owned Relay | No attack; receiver redirects Lumen along the Relay's anchored aim |

Lumen is light with a slowing effect; no projectile travel time or elemental immunity is implied. It hits only one terminal enemy at a time. Its lingering slow refreshes, never stacks. Stasis's 50% slow takes precedence, then Lumen's 40%, then Pin's 35%; timer expiry is integrated within the movement step.

### Exact connection rules

- One redirection per source. An enemy before the receiver blocks output. A second receiver stops output; it does not chain, split or loop. Extra relays are alternative positions to connect by setup re-aiming, not a many-hop network.
- Incoming and outgoing legs share **one 76m axial range budget and one 8-DPS attack**. Reaching the receiver consumes the incoming projected distance, and its 0.7m output muzzle offset also consumes range. There is no free range extension. The original 0.4m contact gap applies to both legs. This intentionally bounds the first experiment more tightly than the provisional “extra fixed length per mirror” proposal.
- Receiver radius is 1m. `traceRelay` uses the same finite-cylinder-plus-target-radius contact function as combat; Lumen's 1.1m radius means receiver centers can be up to 2.1m laterally from the axis. This is a receiver volume, not a mathematically reflected face. Output follows the player's fixed aim.
- Blockers are ordered by their projected center distance, consistently with existing Sweep/Pin. Enemies win exact ties; receiver ties use ascending ID. Scenery and ordinary drones do not become new solid obstructions.
- Planned traces omit enemies and show possible coverage. Live traces include enemies and truncate at actual blockers. Dashed planned links can remain visible while live output is blocked. The HUD distinguishes planned and powered connections; an unlinked Relay has no imaginary weapon line.
- Coverage unions connected segments so a shared route piece is not counted twice. Candidate and reposition previews use the proposed position in the same network as combat. Fan/Slide use the projected live lattice and can break links.
- Damage and kills belong to Lumen, never the Relay. One source cannot damage the same enemy twice through two legs.
- Reposition remains free during setup and keeps ID, mode, paid amount and contribution. Lumen/Relay last-in Recall is setup-only too, closing the refund/rebuy route to free mid-wave re-aiming. Ordinary damage drones retain their existing recall behavior. New paid anchors remain possible during combat.
- Stasis field checks suppress all damage and Lumen effects. Lumen slowing never inflates Stasis's diagnostic counters.

### First flight

Place a Pierce to provide basic defense. Select Lumen (6), aim a useful fixed line and anchor. Select Relay (7), fly its receiver onto that line until the preview reports a connection, then aim the outgoing leg through a route and anchor. The second-wave B-only setup is a chance to use Survey → select Relay → Reposition and redirect the existing purchase. Compare a direct Lumen line or a paid Stasis field if the relay feels like unnecessary work.

## The former 64-enemy ceiling

This game uses **Three.js**, not Babylon. Sixty-four was an initial application pool size in simulation and render buffers, not an engine ceiling. Simulation now grows the enemy pool without deferring scheduled spawns; all related body/accent/trail/field-marker/Wisp buffers grow together and release superseded instance allocations. Growth does not consume random numbers, so old schedules retain their seeded behavior.

A synthetic 80-enemy due burst checks spawning beyond 64; actual Three object capacity checks grow buffers to accommodate 200 slots. It is not a WebGL frame-rate benchmark or a promise that arbitrarily large crowds are cheap. New authored prototypes do not stress large crowds. Route retirement remains a possible later design choice, not a workaround required for this old constant.

## Validation and limits

`npm test` contains 100 deterministic checks: the previous 75 plus 6 Frontier geometry, 10 relay mechanics and 9 integration checks. Existing presentation tests also exercise Lumen/Relay model reuse. Tests protect the original five authored arena settings, scores, manual setup, independent quotes/refunds, relay blockers/range/ties/slow expiry, planned/live visuals and growing enemy buffers. `npm run test:geometry` separately checks enemy solids and field boundaries. TypeScript and production build are release gates.

`FRONTIER_GEOMETRY.json` and the SVG are regenerated with `npm run diagram:frontier`; `FRONTIER_TRIAL.json` with `npm run trial:frontier`. The chart was rasterized and visually inspected, but it is a source-derived diagram, **not a game screenshot**.

Approved browser control was unavailable. No preview server or alternate browser was used. In-game contrast, link legibility while flying, desktop/touch HUD fit, practical frame rate and human placement comfort remain unverified. No survival or relay balance claim should be inferred from passing simulation assertions.

## Next useful questions

1. Frontier: when B and then C open, do you want a new line in a new place, while still caring about the old fleet? Is North Vault's horizontal winding legible in flight?
2. Relay Lab: can you tell whether the receiver is linked and why its output is blocked? Is re-aiming it between A/B waves satisfying enough to justify the extra placement?
3. Only after those answers: extend route progression or revise the relay's range/scarcity. Do not tune nine light waves into a long-survival claim or change Crown balance to compensate for an untested prototype.
