# Crown drone roles and independent prices · v0.8.0

Charlie has not yet played v0.7.0. This is a requested design experiment informed by his earlier play and new ideas, not a claim of new playtest evidence. It starts from Sites `c2c3e4f338b5be806bd743353823a871cccc8889` and GitHub `20243280fd9eedb0d09068318cd2885350c7b78c`.

## What to try

Split Crown now has five distinct drone roles. Fly into position and anchor as before. **1–5** select the next drone; touch buttons show the same choices. Selecting a drone does not change the pilot's own gun.

| Key | Drone | Effect | Placement question |
|---|---|---|---|
| 1 | Pierce | Existing 20 DPS, 76m beam; all contacts | Can one narrow line serve several lanes? |
| 2 | Sweep | Existing 18 DPS, 38m wider beam; nearest obstruction | Can a wide local line catch drifting or isolated targets? |
| 3 | Stasis | Passive 6m-radius sphere, 50% slow, no damage | Where can extra contact time help nearby damage drones? |
| 4 | Halo | Passive 5m-radius sphere, 18 DPS to every enemy center inside | Where do several real routes spend time inside one small volume? |
| 5 | Pin | Fixed 60m line; nearest target takes 24 damage every 1.6s, plus 35% slow for 2.4s | Can a long aimed line land a distinct hit and extend allies' contact? |

Halo and Pin are offered in Crown only. Earlier arena rosters remain intact. Default unlimited setup, the uncapped Crown fleet, free selected Reposition, eight-wave checkpoint and optional waves 9–12 remain. No authored wave, carrier hull, route, core damage or existing beam stat was changed in this pass.

Halo uses actual three-dimensional enemy-center distance. A projected crossing outside its sphere does nothing. Its 5m radius means 10m across; Stasis is 12m across. Overlapping Halos each deal their own damage. Pin uses the same finite-cylinder contact and nearest-obstruction rule as the existing aiming system, evaluated at the instant of each shot. It is an instantaneous shot with a short impact tracer, not a simulated traveling projectile or a map-wide homing sniper.

Pin slow persists after the target leaves the line. Further hits refresh its duration; they do not multiply it. Stasis's stronger 50% slow wins while the target is inside a field. A ready Pin fires once when a target arrives; waiting does not bank a burst. The pilot still fires automatically during combat.

## Independent price curves

In Crown, `n` means **currently owned drones of that type**:

| Type | First purchase | Increase per owned unit |
|---|---:|---:|
| Pierce | 20 | 12 |
| Sweep | 24 | 12 |
| Stasis | 32 | 20 |
| Halo | 44 | 20 |
| Pin | 48 | 24 |

Eight Pierces make the next Pierce cost 116. Buying a first Stasis for 32 leaves that Pierce quote at 116; the next Stasis becomes 52. Two opening Pierces still cost 20 + 32, and an all-Pierce fleet retains its original economy. Other arenas keep their shared `20 + 12 × total owned` curve.

The mode buttons display each quote and owned count. Reposition stays free and preserves type, original paid value, damage, kills and shot state. Recall refunds exactly what that drone cost, including after cheaper older units have been removed. Independent prices intentionally make diverse fleets more affordable; they do not establish that every mixed fleet is stronger.

## Visual identity and the Stasis misunderstanding

Source inspection confirms that Stasis was already passive. Its common gun-shaped body and the pilot beam visible during placement could suggest otherwise; this is a plausible explanation, not a reproduced account of Charlie's earlier session.

Drone bodies now differ in shape as well as color: Pierce has a narrow fork, Sweep broad twin pods, Stasis a round three-axis cage, Halo radial spines, and Pin a long cannon with a raised sight. Passive bodies have no muzzle and do not imply an aiming direction. The moving ghost uses the selected body. UI colors follow the world models.

The pilot beam is hidden during empty setup; its combat behavior is unchanged. Stasis and Halo show their actual sphere boundaries. Pin shows a brief tracer ending at the actual hit location and a distinct marker while its slow remains. Established damage beams stay restrained and the active coverage highlight remains available.

The harmless diagnostic is explicitly a **Stasis field check**. Halo/Pin damage is held, and Halo boundaries and coverage are hidden during that check. Existing field contact counts do not credit Pin's separate slow.

`public/drone-roster.svg` is a CPU projection of the actual model meshes, regenerated with `node qa/drone-roster.mjs`. It is a geometry guide, not a screenshot of the game or proof of in-game readability.

## Bounded balance evidence

The paid twelve-wave trial uses seed 17, finite idealized setup positions and ordinary earned purchases. On carrier waves, the active pilot follows the target through bounded steering/thrust inputs; it has perfect state information and is not a human playtest.

| Fleet before the final wave | Final core | Final carrier alive | Route progress at interception |
|---|---:|---:|---:|
| 19 Pierce + active pilot | 100 | 19.25s | 46.3% |
| 19 Pierce + 2 Stasis + active pilot | 100 | 20.35s | 39.4% |
| 17 Pierce + 2 Stasis + 4 Halo + 2 Pin + active pilot | 100 | 22.70s | 38.1% |

The four Halos account for about 1,789 damage and 20 kills across their flight; the two Pins account for about 1,304 damage and 24 kills. Both new roles contribute. These fleets spend different totals under actual prices; this is funded feasibility, not an equal-cost superiority comparison. Smaller route progress with slow is expected and does not itself mean a shorter encounter.

An independent local-role study uses fixed 76/96/200-scrap budgets, paid placement, an idle pilot and actual Crown route sections. At one west A/B/E near-crossing, Halo alone kills 0/10, Halo + Stasis kills 6/10, and two Pierce + Sweep clears 10/10 within the same 76-scrap allowance. Halo is contact support, not a complete solo defense. In one tight six-Barge convoy, Pierce does substantially more damage than Pin; the single-target shot does not inherit Pierce's multi-lane/all-contact strength. Three core-clustered Halos kill only 7/28 in the measured mixed traffic, while a mixed field/beam setup does better. No arbitrary core exclusion is justified by these cases.

The finite trials do not justify increasing every old wave's health or speed. Keep the authored schedules while players learn the new choices. Pin's relative cost and Halo's local coverage are provisional; neither is claimed to be optimally balanced. The cheapest theoretical mix could fund 33 units before wave 12 and 36 after final rewards, but those are budget ceilings, not demonstrated winning or usable fleets.

Reproduce:

```sh
npm test
npm run test:geometry
npm run study:drone-roles
npm run trial:crown-roles
```

Current records are `DRONE_ROLE_STUDY.json` and `CROWN_ROLES_TRIAL.json`. Earlier `SPLIT_CROWN_TRIAL.json`, `CROWN_GROWTH_TRIAL.json` and pilot/hull studies remain historical records at their documented versions. Current scripts use current prices; restore the recorded earlier commit for exact historical reproduction.

## Verification limits and next playtest

Checks cover actual-3D field membership, preview/combat agreement under Fan/Slide, discrete shot cadence and obstruction, lingering slow/expiry/pool reset, capped damage/kill accounting, field-check isolation, paid quotes/refunds and free moves. Actual Three-object tests cover all five silhouettes, exact sphere boundaries, impact-tracer endpoints, 40 drone slots and retention of the active coverage preview beyond the old buffer capacity.

Approved browser control is unavailable here. No preview server, browser run or human playtest is claimed. Larger-fleet performance, the five-button touch layout, visual contrast and comfortable recognition from flight remain unverified.

The next useful question is whether choosing a cheaper first specialist and placing its distinct shape feels understandable and worthwhile beside an established Pierce fleet. Test a Halo/Stasis bottleneck and a Pin line separately before judging a fleet containing everything. Then check whether the twelve-wave carrier still rewards active piloting.
