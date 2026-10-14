# Crown late-wave tune · v0.8.1

Charlie has now played v0.8.0. He enjoyed it, reported roughly 32 drones near the end, a couple of early leaks while setting up, then no further losses. The final carrier traveled much farther than the earlier boss but died before returning from the eastern crown. He asked for a modest late-game increase while keeping the enjoyable fleet growth and opening. Exact composition, placements and wave-by-wave purchases are unknown. Stasis felt more useful, although its value remains a playtest question.

This tune starts from Sites `e5c14b44a47af099d0686d81526a47a7a84d90b3` / GitHub `57e8ef4e81d0f36fc51645720944bd393119187f`. It changes only the optional Crown waves 9–12 and the final warning. Original waves 1–8, routes, speeds, enemy counts, rewards, prices, weapons, unlimited setup, free reposition and score persistence remain intact. Crown stays uncapped; Stasis stays available.

## Selected changes

Multipliers below apply before Crown's unchanged 1.08 level hull factor.

| Wave | Barge multiplier | Wisp multiplier | Shard multiplier | Total enemy hull, old → new |
|---|---|---|---|---|
| 9 | 1.25 → 1.4 | 1 → 1.1 | — | 1,900.800 → 2,121.984 (+11.64%) |
| 10 | 1.4 → 1.6 | 1 → 1.1 | 1 → 1.15 | 2,151.360 → 2,437.776 (+13.31%) |
| 11 | 1.6 → 1.9 | 1 → 1.1 | 1 → 1.2 | 2,246.400 → 2,640.384 (+17.54%) |
| 12 | 1.6 → 1.9 | 1 → 1.1 | 1 → 1.2 | 5,274.720 → 5,965.488 (+13.10%) |

The final carrier multiplier rises from 6 to 6.6: **2,916 → 3,207.6 hull (+10%)**. Its warning says “about 3208”; its speed, route and 40-core breach stay unchanged. The wave-eight carrier is still 486 hull.

Three final groups move earlier, with their spacing retained:

| Wave-12 group | First spawn after launch, old → new |
|---|---|
| D Barges | 14 → 12s |
| C Wisps | 22 → 18s |
| A Shards | 30 → 24s |

This brings more escort work into the pursuit and reduces the separate cleanup tail. Adding enemies would also add scrap, potentially accelerating the same fleet growth we are trying to keep pace with. Retaining convoy intervals avoids increasing the density advantage of all-contact weapons.

**Pin breakpoint:** new Wisps have 47.52 hull, so two isolated 24-damage Pin shots still kill. Applying the later 1.15/1.2 multiplier to Wisps would require three shots, a 50% increase in shot count. That would be an unexpectedly large change for a modest tune to a newly introduced role.

## Paired evidence

Run `npm run study:crown-late`; the recorded output is [CROWN_LATE_TRIAL.json](CROWN_LATE_TRIAL.json). The script stores explicit v0.8.0 group data so the baseline remains reproducible after publication. It compares exactly two candidates: A uses the new hull only; B uses that same hull plus the three earlier groups. **B is selected.**

Each baseline fleet is bought from earned scrap through ordinary placement/pricing APIs. The two replays freeze its exact poses, types, purchase waves and costs. The pilot is idle in non-carrier waves and uses bounded ordinary steering, pitch and thrust during carrier waves. Setup uses idealized candidate poses; pursuit has perfect state knowledge. Seed 17 and a 1/60s step are fixed. This is simulation evidence, not a reconstruction of Charlie's fleet or a human difficulty test.

| Final fleet | Paid scrap | Carrier alive, baseline → B | Fraction of E traveled, baseline → B |
|---|---:|---:|---:|
| 19 Pierce | 2,432 | 19.25 → 25.37s | 46.3 → 61.0% |
| 17 Pierce / 2 Stasis / 4 Halo / 2 Pin | 2,472 | 22.70 → 23.77s | 38.1 → 39.8% |
| 10 Pierce / 10 Sweep / 4 Stasis / 5 Halo / 4 Pin | 2,524 | 21.98 → 23.32s | 36.7 → 38.9% |

The 33-drone case keeps eight opening Pierces, then buys the cheapest available next type, stopping at four Stasis. It is a feasible larger fleet, not an assertion that these are the user's units or that this policy is optimal. All nine runs finish at 100 core. The added hull extends the mixed-fleet carrier chase by only about 1–1.5s; do not describe it as a dramatic boss change.

For the 33-drone fleet, integrated remaining living hull over time increases 12.6%, 13.8%, 20.0% and 21.6% in waves 9–12. This measures extra damage work and time in the arena, not subjective pressure. Final escort presence while the carrier lives rises from 82.9 to 110.0 enemy-seconds; actual escort damage during that time rises from 1,653 to 2,255. Earlier D Barges provide most of the useful overlap. C Wisps and A Shards still receive no damage before the carrier dies in this layout, despite entering earlier. Their earlier start mainly shortens cleanup here. B ends about six seconds sooner than A without materially changing its carrier result.

The trial asserts identical first-eight outcomes, identical A/B outcomes through wave 11, legal frozen paid purchases, unchanged recorded campaign scores and reconciled effective damage credit. It does not force optimized formations to leak as a success criterion. Historical v0.7/v0.8 JSON is retained as historical evidence; current older trial scripts will naturally produce different late results against the tuned source.

## Verification and next playtest

All 75 deterministic checks, enemy/field geometry and TypeScript/production build pass. Independent source review found the production groups match B and the change stays within continuation data. Approved browser control is unavailable in this managed environment, so no preview server or browser was used. No new visual or large-fleet performance verification is claimed.

Next question: **does the larger fleet have useful work during waves 10–12 and the carrier chase, while the difficulty still rises gently?** Watch the D convoy during pursuit. A smooth increase matters more than forcing a particular core loss or making the carrier complete a prescribed fraction of E. Record the next fleet composition before another tuning pass; do not compensate for an unknown formation by broadly weakening specialist roles.
