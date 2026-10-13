# Split Crown coverage readout — v0.6.2 review

The opening readout previously summed every intersected route, including carrier
route E, which does not open until wave 8. That number described geometric reach
accurately, but could endorse a poor wave-1 defense. Claude's diagnosis reproduces.

The preview now keeps every Crown hover segment and total metre value, while
also reporting three disjoint amounts:

- **Now:** a gate is upcoming during setup, or still has pending groups / living
  enemies during combat. Delayed groups count before their first spawn.
- **Later:** the gate has no current traffic, but is scheduled in a later wave.
  This includes a previously opened gate that will return after a quiet wave.
- **Idle:** no current or future authored traffic remains on that route.

This follows the existing gate forecast, rather than treating a gate as useful
forever after its first opening. During the harmless field check, targets occupy
all routes, so all tested-route coverage is current. Flight School still hides
unannounced lessons. The change does not alter beam geometry, weapons, the
economy, enemy behavior, or route visibility.

## Bounded numerical comparison

Run `node qa/crown-coverage-study.mjs`. The retained output is
[`CROWN_COVERAGE_STUDY.json`](CROWN_COVERAGE_STUDY.json). It uses the same 1,454
idealized candidate poses as `qa/crown-trial.mjs`; all pass ordinary placement
validation in the opening setup. These are fixed candidate rankings, not human
choices, a damage simulation, or an optimality proof.

| Opening choice | Full hover | Useful now (Gate A) | Later waves |
| --- | ---: | ---: | ---: |
| Highest old total | 67.313 m | 8.475 m | 58.838 m |
| Highest current coverage | 32.403 m | 22.932 m | 9.471 m |
| Largest future-only line | 52.368 m | 0 m | 52.368 m |

Ranking by current coverage selects **14.457 m more Gate-A contact** in this
finite candidate set. Across the first ten ranked candidates, mean Gate-A
coverage increases from 13.510 m to 21.486 m. Neither figure measures kills or
predicts player success.

There is a small measurement distinction in the outside review: the original
trial scores candidate beams from their base; actual `getPlacementPreview`
advances the beam origin by the drone's 0.7 m muzzle offset. The study explicitly
retains both computations. Its separate legacy comparator reproduces the
review's 67.811 m total / 8.475 m A / 31.424 m E. The actual HUD calculation gives
67.313 m total / 8.475 m A / 30.925 m E for that same pose. This difference does
not change the finding or winning candidates.

## Verification and next playtest

`node qa/coverage.mjs` exercises six contracts: staged openings at waves
1/2/3/5/8; delayed groups and final live enemies; quiet gates that return later;
Fan/Slide and reposition for Pierce, Sweep and Stasis; tutorial announcements;
and field-check start/end restoration. Current/later/idle sums retain the full
hover total. No browser appearance or human usability is inferred from these
checks.

The useful human question is: **Does separating current and later coverage help
you place the first two damage drones on A, while still making E worth planning
for?** A before/after playtest record should capture per-gate coverage and the
first two funded anchors. The existing downloadable field report records route
metres for Stasis fields only, so it does not yet automate this damage-drone
comparison. This numerical study alone cannot establish that the new wording
changes a player's decisions.
