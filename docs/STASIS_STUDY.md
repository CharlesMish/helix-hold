# Stasis follow-up · 2026-10-13

Charlie's v0.4 playtest found the regular combat fun, Sweep strong, and Stasis too subtle to justify a damage slot. Treat that as useful design evidence, not a failure to place it correctly.

## What the sphere means

The v0.4 renderer and simulation both use `STASIS_RADIUS = 6` and the drone's actual projected position after Fan/Slide. The field is a **6m-radius / 12m-diameter sphere**, not a large illustration around a smaller invisible effect. A route can appear inside its screen silhouette while actually passing behind it. No radius or center mismatch was found in source; browser visual verification was unavailable.

“Route inside field: 12.1m” means about 12.1m **along the route**, not distance to the route. The highlight samples nominal route centers; drifting Wisps are slowed only while their actual centers are inside. A highlighted centerline does not promise permanent containment of their drift. The preview sphere also follows the pilot while Stasis is selected, even after a different field has been anchored: proposed and active fields must be distinguishable.

The studied real crossing at `(11.3, 22.6, 6.4)` covers roughly 11.95m of the middle coil and 11.97m of the wide loop, and **none of the dive**. A screen-space impression of all three lanes sharing this sphere is misleading. The other wide-loop self-crossing has 10m vertical separation; a sphere centered on either branch correctly misses the other.

## Why 30% can feel unrewarding

Thirty-percent slower travel increases residence time by 42.9%, not 30%. That sounds substantial, but the affected span is short. For a straight, central 12m chord:

| Enemy | Time without field | Extra time at 30% slow | Extra time at 50% slow |
|---|---:|---:|---:|
| Normal Shard, 10.4m/s | 1.15s | 0.49s | 1.15s |
| Dive Shard, 5.72m/s | 2.10s | 0.90s | 2.10s |
| Barge, 6m/s | 2.00s | 0.86s | 2.00s |
| Carrier, 4.2m/s | 2.86s | 1.22s | 2.86s |

Curvature, off-center intersections, Wisp drift and deaths before exiting change these times. Slowing an enemy outside weapon contact adds travel time but no direct damage. Killing it before the field adds nothing.

For equal shared contact and a target that survives it, 30% slow adds the equivalent of 0.429 times the existing overlapping DPS. It needs more than 46.7 existing DPS to exceed a further 20-DPS Pierce's damage **over that same affected interval**. Half speed doubles contact time, so that threshold becomes 20 existing DPS. A real added Pierce can also damage enemies outside the sphere, so these are local comparisons, not whole-map balance predictions. Extra time for piloting/reaction and altered spawn spacing are separate benefits.

## Reproducible simulations

Run `node qa/stasis-study.mjs`. It bundles explicit 30%, 40% and 50% variants in memory and never edits gameplay source. The baseline does not depend on the current shipped slow value.

The first comparison repeats v0.4's funded, idealized placement sequence. All four configurations—damage only and three field strengths—finish the original three waves with 100 core and 29 kills. At 30%, the field actually slows 3 of 11 wave-two enemies and 6 of 12 wave-three enemies. The carrier spends about 4.07s slowed and dies at route distance 52.00m. At 50% it dies at 47.39m; damage only kills it at 55.16m. This shows a real effect, but the solved layout cannot demonstrate a meaningful outcome advantage.

A second test sends a single 486-hull carrier down the actual wide-loop route, with no pilot damage. It uses distinct, legally spaced line positions selected for full field contact. Inventories are artificial; this is a contact comparison, not a paid campaign test. Each row compares the same number of occupied slots:

| Existing Pierce lines | Add another Pierce | Add 30% field | Add 50% field |
|---|---|---|---|
| 1 | Breach; 448 damage | Breach; 256 damage | Breach; 289 damage |
| 2 | Kill at 48.51m | Kill at 58.65m | Kill at 51.80m |
| 3 | Kill at 41.65m | Kill at 45.53m | Kill at 43.54m |

The dedicated lines have substantial contact outside the field. Even 50% does not automatically outperform another damage drone. These selected deterministic cases establish behavior and a plausible experiment boundary; they do not establish a universal best strategy, difficulty rating or human usability result.

## Recommendation

Try **half-speed Stasis in the optional lab only**, retaining radius, cost, slot use, no damage, actual 3D membership and strongest-only overlap. “Half speed” is immediately understandable and doubles fully overlapping exposure. Pair it with explicit active-field feedback and per-lane route coverage so players can tell whether a placement is working. Leave campaign Sweep at 18 DPS and the lab's current Sweep trial at 22; this playtest is evidence against another unmeasured boost.

The next question is whether a field at a defended real crossing visibly changes a near-breach into an interception, while another damage line remains a useful alternative. Do not enlarge every field or lengthen every map to manufacture that answer.

## Later geometry studies

- **One-bounce relay:** gives piloted placement a second direction to solve; preserve remaining range/DPS and show broken links. It needs a dedicated interface study before implementation.
- **Oriented pulse plane:** a thin, finite disk rather than a sphere rewards finding a genuine shared slice through helical lanes. A visible pulse could exchange continuous coverage for timing, but should be compared against existing Pierce rather than added as another generic damage shape.
- **Burst lens:** an aimed finite beam with charge/release timing could reward lining up a carrier and crossing escorts. The design question is whether timing creates a new decision beyond simply choosing the longest Pierce line.

These are discussion candidates, not additions to this pass. Larger arenas and longer authored progression are more immediately responsive to the request for room to develop a defense.
