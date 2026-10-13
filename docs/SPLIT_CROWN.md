# Split Crown — two districts and a carrier transfer

Split Crown is a new eight-wave campaign arena with stable ID `split-crown`. It is appended after the existing Carrier Test Flight, so the older level indices and score identities remain intact. It uses `presentation: "split-crown"` and independently enables `stasisAvailable: true`; it is not a lab experiment. Campaign Sweep remains 18 DPS, Pierce remains 20 DPS, and the existing player weapon, costs and eight-slot fleet limit remain applicable. Plan & launch retains unlimited setup; Auto waves remains an explicit alternative.

The four regular gates form two spatially separated helix districts. A fifth, clearly announced route E is reserved for the final carrier. This makes a larger arena without simply enlarging every spiral or asking the player to fund five defenses at once.

The accompanying [route plan and elevation](../public/split-crown-routes.svg) is generated from the implemented sampled paths. It is a geometric reference, not a screenshot or a balance result.

## Route identities and geometry

| Letter | Stable path ID | Gate `(x,y,z)` | Length | Role |
|---|---|---|---:|---|
| A | `west-crown` | `(-14.24,37,-13.30)` | 105.19m | Upper west helix; first route and a useful sustained line |
| B | `west-coil` | `(-14.12,29,1.00)` | 78.95m | Lower west partner; local shared coverage |
| C | `east-crown` | `(14.24,35,-5.30)` | 105.68m | Upper east commitment across the divide |
| D | `east-coil` | `(14.12,27,9.00)` | 78.54m | Lower east partner and late regular gate |
| E | `crown-transfer` | `(-37,34,-20)` | 167.59m | Final carrier visits both districts before turning through lower approaches |

West and east helix centers are `(-21,-4)` and `(21,4)` in x/z. Each contains an 11.5m outer crown and an 8.5m inner coil with opposite winding. A/C descend from 37/35m to 19/17m before their inward transfers; B/D descend from 29/27m to 12/10m. Separate curved transfers terminate at the existing core `(0,4.4,0)`.

The main four routes span 65m horizontally. Including E, the sampled x-range is −37m to33.02m, z-range −20m to15.50m, maximum horizontal radius 42.06m, and height range 4.4–37m. These fit the unchanged flight limits of radius 52m and height 1.6–44m. This leaves piloting room around the routes, though a numerical clearance does not establish camera comfort or a useful firing angle.

A–D use analytic offset helices joined to cubic inward transfers. Transfer handles align with the helix's analytic outgoing tangent; their speed with respect to the construction parameter need not match, because enemies traverse the sampled paths by distance. E uses a cubic interpolating chain with a shared tangent at every internal waypoint. Its nine segments are sampled at 80 intervals each; A–D use 480 total intervals and include the helix/transfer join exactly.

## Why route E is included

E enters from outside the west district, travels through a west shared neighborhood, crosses to the east shared neighborhood, loops through the lower east approach, returns through the lower west approach and reaches the core. It is a broad transfer, not a fifth copy of the same helix.

Its geometry is designed to reward some of the fleet the player already built. These are measured 3D relationships, not overlaps inferred from a plan view:

| Defense neighborhood | Sphere center | A or C route inside 6m | B or D route inside 6m | E route inside 6m |
|---|---|---:|---:|---:|
| West | `(-22.3,23.25,-13.92)` | 12.4m | 10.8m | 12.0m |
| East | `(22.3,21.25,-5.92)` | 12.4m | 10.8m | 12.0m |

Field lengths are sampled at 0.2m spacing and rounded to 0.1m; they are potential coverage of the nominal route centers. Wisp drift and actual drone placement still matter. The west field does not cover the east district, or vice versa.

Excluding the last 15m of each path, E's nearest sampled distances to A/B/C/D are 0.44/1.32/1.03/0.08m. This gives both upper and lower regular routes useful contact opportunities before the common core approach. It does not mean a beam aimed at any point of a district is guaranteed to hit E.

The single carrier is the existing ordinary cumulative-health enemy: 450 base hull ×1.08 arena multiplier = 486 hull, 4.2m/s ×0.96 =4.032m/s, and 40 core damage on breach. Its unimpeded full-route travel is 41.57 seconds. There are no weapon immunities, contact-reset armor, new collision rules or mandatory Stasis interaction. E has no other scheduled enemies and opens only in wave 8. Briefing and the first-wave lesson announce that role from the start.

## Eight authored waves

| Wave | First new gate | Schedule purpose | Enemies |
|---|---|---|---:|
| 1 · West crown | A | Six Shards establish a sustained opening line. | 6 |
| 2 · A local pair | B | Lower Shards and one upper Barge test shared versus dedicated lines. | 10 |
| 3 · Across the divide | C | The first eastern Shards arrive while west Barges/Wisps keep existing defense relevant. | 11 |
| 4 · Twin convoys | — | Offset upper convoys reward contact time rather than a brief crossing alone. | 14 |
| 5 · The lower east | D | New lower eastern traffic opens the fourth approach. | 17 |
| 6 · Low pressure | — | Barges move to both lower coils; upper escorts challenge overcommitment. | 19 |
| 7 · Crown exchange | — | Upper convoys followed by lower escorts prepare the complete fleet. | 22 |
| 8 · The crown carrier | E | One carrier reuses both neighborhoods while delayed escorts pressure all four regular gates. | 25 |

There are 124 enemies in total. The final carrier spawns at 1.5 seconds; final regular escorts continue spawning through 27.2 seconds. This gives the carrier encounter an overlapping defense problem instead of leaving it alone for its entire long crossing. Regular base arena multipliers are 1.08 health and 0.96 speed throughout; later waves change composition, route and timing rather than silently increasing every enemy's stats.

## Opening economy

The initial 60 scrap buys the first two drones for 20+32, leaving 8. Six opening Shard kills would earn 48, giving 56 before the third drone's 44-scrap price. Wave 2 introduces B locally; the remote C gate waits until wave 3 and D until wave 5. This creates an opportunity to build toward the far district with earned scrap.

This arithmetic is a schedule constraint, not an assumption that the player achieves a perfect opening. Source/simulation trials must test actual placements and ordinary flight inputs. Repositioning during setup should preserve the selected unit and its paid value. An already affordable slot must not become a new purchase merely because a route opens elsewhere.

## Validation and limits

Geometry checks cover finite samples, strictly positive cumulative-distance increments, flight bounds and exact core endpoints for all five paths. The sampled turn between the segments immediately adjacent to a constructed join is at most 2.88 degrees; this bounds polyline joining artifacts but is not a curvature or camera-quality guarantee. The diagram is independently rasterized for layout inspection.

Campaign progression, saved scores, Stasis availability and feasible fleet arrangements are integration responsibilities and are checked separately from these path calculations. Gameplay comparisons should retain the normal economy and distinguish a useful broad line from a perfect placement discovered by an optimizer. In particular, compare:

- one local line per district plus a shared slice;
- a fleet concentrated on the common core approaches;
- a strong damage-only fleet versus replacing one unit with Stasis;
- a useful setup reposition before D opens and again before E opens.

If a central fleet solves every wave trivially, the first revision should change the relevant geometry or authored pressure before adding blanket health inflation. If Stasis loses the comparison, that is not itself a reason to force a Stasis-only enemy. The goal is a distinct spatial problem that remains fun with the already successful Pierce coverage mechanic.


## Funded simulation comparison

Reproduce with `npm run trial:crown`; [recorded measurements](SPLIT_CROWN_TRIAL.json) retain each funded placement, revision and wave result.

The ordinary-input opening trial flies and anchors two Pierce drones without teleporting, bonus currency or stat overrides. It clears all six opening Shards at 100 core and finishes with 56 scrap, validating the first reinforcement opportunity. The longer fleet trials use idealized placement candidates during setup and the normal earned economy; they establish feasibility and comparative behavior, not ease of discovery by a player.

In the corrected eight-wave comparison, a shared-line fleet completes at 82 core and intercepts the carrier with or without a late Stasis drone. A dedicated-line arrangement narrowly leaks the carrier without a field; a late field changes that arrangement to a 46-core win. Spending the third slot on Stasis early can instead leave a regular route underdefended. The field is an optional reinforcement after the active gates have damage coverage, not a required opening purchase.

The fifth route adds useful contact for existing defenses. In a controlled dedicated-fleet route comparison, the carrier reaches the core with about 5.7 hull remaining on E versus 91.7 on the original upper route A; the successful shared-line fleet wins either case. A single free setup reposition aimed toward E reduces the dedicated fleet's carrier leak from about 207.7 to 5.7 hull. These results support keeping E and the repositioning interaction, while stopping short of declaring it the universally strongest or hardest route.

One tested core-heavy placement strategy fails, but this is not proof that all optimized core defenses must fail. The harness compares a finite set of placements. Source checks and simulation checks do not validate mobile HUD fit, world readability or comfortable piloting. Approved browser control is unavailable in this environment; no browser gameplay verification is claimed. The route diagram was rasterized and visually inspected separately.
