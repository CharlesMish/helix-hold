# Extended defense · v0.5

Charlie's next playtest asked for more time with a working fleet beyond the existing five-wave arenas, and clearer evidence that Stasis is worth buying. This pass adds bounded continuation and the setup controls it needs. The companion field study is in `STASIS_STUDY.md`.

## Playing the continuation

Clear Shear Lane or Orbital Garden's ordinary five waves, then choose **Continue to waves 6–8**. The existing five-wave victory is recorded first. The continuation preserves current core, drones, paid values, scrap and contributions, adds three fresh wave schedules, and starts with unlimited manual setup. It cannot rewrite the saved campaign result on either victory or defeat, and it cannot be started twice.

Flight School remains five waves; the separately listed Carrier Test Flight remains three. Stasis remains exclusive to that lab. Campaign Sweep stays 18 DPS, lab Sweep 22 DPS, and Pierce remains unchanged.

| Arena | Wave 6 | Wave 7 | Wave 8 |
|---|---|---|---|
| Shear | Middle-coil Wisps, wide-loop Shards, delayed dive burst | Barges on the compact dive and middle coil, wide-loop diversion | Wide convoy, later dive traffic, then middle-coil push |
| Orbital | Alternating gate bursts with drifting escorts | Two armored convoys with outer-ring Wisps | Mixed traffic through both inward exits, followed by late Wisps |

The original five waves and all route samples are preserved. No health/speed inflation or global scaling of arena geometry was used; Shear's dive keeps its local 0.55 speed multiplier, including its newly introduced Barges. The purpose is more authored time with the fleet and varied route pressure. It is not described as endless play.

## Revising the fleet

During setup, open **Survey**, choose a drone, then choose **Reposition · free**. The selected unit gets a cyan marker. The pilot starts from its resting position and aim; fly to revise the placement. Anchor/F commits the new pose and returns to the hangar. Cancel/C keeps the old unit and its stored placement.

Reposition preserves the same object, ID, mode, DPS, purchase value, kills and damage. It does not remove a slot or charge scrap, so it works with eight drones and zero scrap. This avoids the old economy trap: recalling an original 20-scrap unit at eight slots and replacing it costs 104, taxing movement by 84.

Selected **Recall** returns exactly that unit's paid amount. The familiar last-in Recall/R still works outside an active move. Selected recall and reposition require setup; active-wave Survey is read-only. Fan/Slide are reset when beginning a move and can be used again while placing. Automatic setup countdown is held while a move is open; explicit launch is blocked until commit/cancel. Automatic pacing receives a fresh eight-second setup window afterward.

Tab enters Survey from flight. Within Survey, Tab/Shift+Tab navigate controls; Escape or Resume returns to flight. Touch uses the same visible selection and action buttons.

## Stasis changes

The radius was already correct in v0.4. The prior prospective field was filled and brighter than placed fields, and the metre count did not explain that it summed route length. v0.5 separates these:

- Dashed, unfilled outline: moving placement preview.
- Solid boundary and faint fill: anchored field.
- Amber brackets: enemies actually slowed.
- Live slowed count stays visible while another drone mode is selected.
- Preview explicitly says 6m radius / 12m across and lists covered route length for each lane.

Stasis now tries half-speed travel in the lab. It keeps normal scrap costs, one drone slot, no damage, actual 3D center membership and strongest-only overlap. Wisp travel along the route is slowed; its existing time-driven weaving behavior is retained. The candidate is supported by a contact-time study, not claimed as final balance.

## Verification

`npm test` runs 22 existing simulation checks plus nine revision checks. The latter verify paid-unit reuse at full capacity, cancellation, placement collisions, Fan/Slide preview agreement, setup restrictions, launch/countdown guards, continuation state retention, fresh groups and score isolation.

`npm run test:geometry` checks enemy solids against collision spheres and verifies the dashed/solid field boundaries use the exact 6m radius. TypeScript and production build are checked before publication. Browser smoke tests include field labels and Survey repositioning, but remain **unexecuted**: this managed environment has no approved browser-control capability. No preview server or alternate browser was used.

`npm run trial:continuation` uses reachable but idealized setup placement teleports, actual earned scrap and an idle hangar pilot. Both Shear and Orbital finish eight waves with 100% core and 113 kills using five optimized Pierce drones. Buying three earned reinforcements also succeeds. Original campaign records are written once at wave five; continuation does not overwrite them.

This demonstrates feasibility. Because the optimized five-drone layouts already clear the additions, it does not prove the player needs to expand their fleet or solve a harder strategic tier. Human flight difficulty, visual clarity, mobile layout and encounter feel remain for playtesting.

## What to study next

First check whether the field is now unmistakably active and worth its slot, and whether three extra authored waves give enough time to enjoy a developed defense. If strong lines solve these too early, the next useful experiment is one deliberately larger arena with separated approaches and a new placement problem. Uniformly enlarging every map would change flight time, beam reach and shared coverage together, making the result harder to interpret. Relay and timed attack-plane ideas remain separate studies rather than additions to this pass.
