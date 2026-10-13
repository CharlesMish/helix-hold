# Crown Stasis tradeoff — 13 October 2026

The existing dedicated-fleet win/loss comparison overstates what we can attribute to Stasis. The original pair is reproducible, but its final setup moves **different drones**. When the refit is matched, both fleets defeat the carrier: the Stasis fleet finishes with **46 core**, versus **37 core** for Pierce.

This is a deterministic source simulation, not a browser check or human playtest. No weapons, economy, routes or wave schedules were changed.

## What the original comparison actually buys

Before wave 6, both fleets buy their **seventh** drone for **92 scrap**. One buys Pierce; the other buys Stasis at a useful field location. No previously owned drone is recalled or replaced. Each completes eight ordinary purchases for **496 total scrap**, funded by the normal 60-scrap start and enemy rewards.

The original wave-8 refit chooses the second-to-last Pierce. That is **unit 7** in the all-Pierce fleet, but **unit 6** in the fleet whose seventh drone is Stasis. Their final layouts therefore differ in units 6 and 7, including which old lane loses its dedicated beam. The historical result remains valid as a comparison of two complete strategies, but not as an isolated field effect.

The new control moves unit 6 in both fleets. Assertions verify identical purchase times/costs, identical refit unit and pose, and identical poses for every unit except 7 at **every wave start**. The field purchase still differs in both mode and suitable placement; this is a practical purchase choice, not a same-position weapon toggle.

## Results

| Measurement | Original Pierce / refit 7 | Matched Pierce / refit 6 | Stasis / refit 6 |
| --- | ---: | ---: | ---: |
| Final core | 0; lost | 37; won | 46; won |
| Total kills | 116 | 117 | 118 |
| Fleet effective damage | 7,029.547 | 7,035.213 | 7,042.747 |
| Unit 7 damage / kills | 914.59 / 10 | 563.31 / 14 | 0 / 0 |
| Carrier outcome | Breached | Destroyed | Destroyed |
| Carrier elapsed time to outcome | 41.483 s | 40.967 s | 42.183 s |
| Carrier terminal HP | 5.667 | 0 | 0 |
| Carrier actually slowed | 0 s | 0 s | 2.867 s |
| All enemies' actual field exposure | 0 enemy-s | 0 enemy-s | 23.650 enemy-s |

In the matched comparison, **the extra 9 core is already saved on wave 6**: Stasis prevents one breach there. Neither fleet loses further core in waves 7 or 8. Unit 7's 563.31 Pierce damage and 14 kills are real opportunity costs, but they are not irrecoverably lost fleet damage: other drones fire longer or secure those kills in the field fleet. Stasis itself deals zero damage.

The carrier starts with 486 HP. With the field, it travels 5.779 route-metres while actually slowed and is destroyed at route distance 164.304 m. The matched Pierce fleet destroys it at 165.178 m. The field extends its observed life by 1.217 s while moving its destruction slightly farther from the core. This does **not** establish that Stasis is required for the carrier, nor that longer survival is itself a benefit independent of location and outgoing damage.

## What the contact numbers mean

The field center is approximately `(-2.79, 4.92, -1.25)`, with the existing **6 m radius / 50% slow**. The study checks actual enemy-center 3D membership before each movement step at 60 Hz, including Wisp drift, using the same membership function as combat. Its independent sum reproduces the simulation's cumulative Stasis exposure within floating-point tolerance.

An **enemy-second** is one enemy spending one second in the field. Two enemies simultaneously inside for a second contribute two enemy-seconds. This is neither elapsed battle time nor nominal route coverage in metres.

For context, the same geographic sphere is also observed in the damage-only runs from the seventh purchase onward, without applying slowing. The matched Pierce carrier spends 1.650 s in that zone; the slowed carrier spends 2.867 s there. These are not expected to form an exact 2:1 ratio: damage and destruction alter when occupancy ends. A destroyed carrier has no measured time-to-core, so that field is `null` rather than an extrapolation.

The new terminal-HP measure includes the kill/leak frame. The historical trial's `carrierLowestObservedHp` samples only enemies still alive after a step and can consequently report a small positive value for a destroyed carrier.

## Reproduction and limits

```sh
node qa/crown-stasis-study.mjs > docs/CROWN_STASIS_TRADEOFF.json
node qa/crown-trial.mjs > /tmp/crown-trial.json
cmp docs/SPLIT_CROWN_TRIAL.json /tmp/crown-trial.json
```

The sibling study imports the existing trial's candidate generator and paid placement/refit implementation. The original trial remains executable normally; its complete 11-strategy JSON output was verified byte-for-byte unchanged after exposing shared helpers. The two original dedicated rows are also deep-compared to the committed evidence inside this study.

All runs use seed 17, 60 Hz steps, eight slots, normal costs, and a non-attacking pilot. Setup poses come from the existing idealized candidate search. There is no human control test, browser rendering check, multi-seed robustness study or claim of optimal strategy. Final earned scrap and core differ as outcomes, not supplied starting resources.

The useful next playtest question is smaller than “does Stasis win the boss fight?”: **Can the player identify a useful slowing location and understand the one-slot tradeoff before buying it?** The field check can show actual contact, but this study cannot establish whether its feedback makes that benefit perceptible. These measurements do not justify a damage or slow-strength change on their own.
