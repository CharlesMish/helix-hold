# Split Crown: funded growth and the long flight · v0.7.0

Historical v0.7.0 snapshot. Current Crown has independent prices and two additional roles; see [v0.8.0 roles](DRONE_ROLES_080.md). Current trial scripts use current prices. Restore Sites `c2c3e4f338b5be806bd743353823a871cccc8889` or GitHub `20243280fd9eedb0d09068318cd2885350c7b78c` for exact reproduction of this version.

## Latest human feedback

Charlie confirms he played Split Crown before the v0.6.2 review corrections. The longer voice report was lost, but this replacement report is direct human playtest evidence: he enjoyed the lines and the map, reached eight drones early, could not add his intended ninth Stasis drone, and destroyed the carrier too near its entrance while pursuing it with the pilot. He wanted more room to build, a stronger later encounter, and possibly 10–12 waves. Do not let the older handoff's missing-transcript note override this report.

## Playable change

- **Split Crown alone has no fixed drone cap.** Each purchase still costs `20 + 12 × currently owned drones`. Start with 60 scrap; no bonus money or free support slots. Other arenas retain eight drones.
- **The original eight authored waves and all routes remain identical.** Crown's larger fleet can change their difficulty; unchanged schedules do not imply unchanged balance. Its eight-wave best-core record still saves at the checkpoint.
- After clearing wave 8, choose **Continue to waves 9–12**. Keep core, scrap, fleet and contributions. Continuation returns to unlimited manual setup, even if the earlier flight used Auto waves. It cannot replace the recorded eight-wave result, on either win or loss.
- The four extra waves shift heavy convoys between upper crowns and lower coils, with delayed escorts. Gate E rests during waves 9–11 and carries the reinforced final carrier in wave 12.
- Wave 8 retains its 486-hull carrier. **Wave 12 has 2,916 hull**, unchanged speed, cumulative damage and a 40-core breach cost. The setup lesson warns about its hull and escort pressure. This is a provisional encounter value for playtesting, not established balance.
- Setup **Survey → select drone → Reposition · free** retains that unit's identity, mode, paid value and contribution. Recall refunds its actual paid amount. A working line can stay while scrap buys the next field.
- The HUD shows Crown's owned count and next price. The gate plan previews the optional four waves; after opting in, Survey shows the actual twelve-wave schedule.
- Drone, beam, shell, target-ring and field visuals grow together. Coverage instance buffers grow as necessary, retaining the active aiming preview after established coverage. Released buffers are disposed.

No weapon tuning, extra drone type, relay, immunity, route rebuild or endless system is part of this pass. Placement by piloting, default manual setup, current-wave/later coverage and existing field diagnostics remain.

## Why scrap can replace the ceiling

Buying `n` drones without recalls costs `6n² + 14n` scrap. A perfect Crown run has enough cumulative money for eight drones after wave 4 and fifteen after wave 8. Fifteen costs 1,560; sixteen costs 1,760. The first eight waves provide 1,564 total including the initial 60. This explains why the old cap stopped growth halfway through the map.

The authored extension brings the perfect total budget to 3,020, enough for 21 units after the final rewards. The measured greedy fleets have **19 before the finale**; end-of-wave money is not available earlier. Those are earned-budget examples, not promised fleet sizes or a new cap.

## Authored extension

| Wave | Main pressure | Secondary pressure |
|---|---|---|
| 9 · Upper convoys | Six Barges on A, then six on C; 1.25× local hull | Four Wisps each on B and D, staggered |
| 10 · Lower clamp | Five Barges each on B and D; 1.4× local hull | Upper Wisps, then a late six-Shard B burst |
| 11 · Crown exchange | Five Barges each on A and C; 1.6× local hull | Lower-east Shards, then west-coil Wisps |
| 12 · The long pursuit | One 2,916-hull carrier on E | Lower Barges at 1.6× hull, staggered upper Wisps and late A Shards |

Only the specified new groups get extra hull. Existing speeds, enemy radii, reward values and ordinary waves retain their values. The actual schedule remains authoritative in `src/game/paths.ts`.

## Active-pilot evidence

The old eight-drone trial kept the pilot out of combat. A new study starts the pilot at one idealized legal E staging position, then uses ordinary bounded steering, pitch and thrust through `step()` to pursue the carrier. It makes no combat pose edits. Its immediate reaction and perfect state knowledge are not human play.

With the original 486-hull carrier, one existing shared-line eight-drone fleet plus this pilot destroys it **5.23 seconds after spawning, 12.6% along E**. This supports Charlie's report that the encounter can end too early. A pilot's continuous 34 DPS alone can remove 486 hull in about 14.3 seconds.

The full growth trial purchases every affordable unit at setup through normal paid APIs. It uses idealized finite pose search for anchors and the same bounded pursuit only on carrier waves. Seed 17; 60 Hz. With the final authored 2,916-hull carrier:

| Funded fleet before wave 12 | Pilot on carrier waves | Final carrier result | Final core |
|---|---|---|---|
| 19 Pierce | Idle | Breaches with about 352 hull remaining | 60 |
| 19 Pierce | Automated pursuit | Destroyed after 19.25s, 46.3% along E | 100 |
| 17 Pierce + 2 Stasis | Automated pursuit | Destroyed after 20.63s, 39.7% along E | 100 |

All three finish twelve waves and preserve their already recorded eight-wave 100-core score. The two fields are bought as the ninth and twelfth units, without replacing existing damage drones. Fewer route metres with Stasis is expected when it slows the target; route progress alone is not a measure of encounter value. This comparison does **not** establish that Stasis is required or superior.

A three-times-hull finale was rejected during exploration because a funded fleet plus pursuit still ended it around a quarter of the way along E. Six times the original hull takes the measured active encounter into the eastern crown. The retained final trial is the authored configuration, with no study-only hull override.

Reproduce:

```sh
npm run study:crown-pilot
npm run trial:crown-growth
```

Recorded outputs: `CROWN_PILOT_STUDY.json` (older eight-drone 1×/3×/4× comparisons), `CROWN_GROWTH_TRIAL.json` (the actual twelve-wave configuration), and `CROWN_GROWTH_HULL_COMPARISON.json` (5×/6×/8× finale candidates with identical fleet poses). Reproduce a candidate using `node qa/crown-growth-trial.mjs --final-hull=5`, `6` or `8`. These are deterministic feasibility cases, not win rates, optimal strategies, browser tests or human difficulty measurements. Precise greedy placements handled all escorts in these three runs, so later escort difficulty especially needs human feedback.

## Verification and next question

The deterministic suite now includes paid growth past eight, a paid ninth Stasis, other arenas' limits, free reposition/refund integrity in a twelve-unit fleet, exact preservation of the first eight authored Crown waves, cloned optional schedules, local hull isolation and score preservation through continuation win/loss. Actual Three object tests cover 24 visual slots and 4,101 coverage segments, including the last preview's transform and color and replaced buffer disposal. They do not execute WebGL.

The original constrained eight-drone Crown trial remains byte-for-byte reproducible as a historical comparison. It intentionally does not spend beyond eight; it no longer describes the maximum Crown fleet.

Approved browser control is unavailable in this managed Sites environment. No preview server or alternate browser was used. Live layout, contrast, performance with a growing fleet, and comfortable pursuit remain unverified. Prepared browser checks are separate from executed source/simulation checks.

**Next useful playtest:** does buying a ninth or later field feel like expanding a working defense, and does the wave-12 chase last long enough to use both districts without turning into a health sponge? Watch the side lanes while pursuing. That feedback should precede another drone type or more waves.
