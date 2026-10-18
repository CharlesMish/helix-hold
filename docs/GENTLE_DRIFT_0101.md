# v0.10.1 — gentler drift around home

Charlie approved the crossing-readout fix, clearer stationary posts and a kinder first Drift playthrough. His intent is small changes that preserve useful lines, including movement in both directions around the original route. This pass keeps the mechanic simple: authored between-wave rotations around the prism, without adding breathing radii, translation or motion during combat.

## Changes

Tripwire's nominal Shard crossing count now uses the same entry and wider-release state transition as combat. A gap in the highlighted contact alone does not re-arm a strand. Visual highlights remain separate contact stretches; the HUD says **Est. crossings**. Sampling is at most 0.1m along the route; this is still an estimate for nominal Shards, not a guarantee for different hull radii, Wisp drift or every combat timestep.

The regression uses legal posts at `(-12.736198,10.708485,-0.175361)` and `(-25.954119,18.340916,-11.540086)` on the actual West Spindle, span 19.03m. The old HUD reported 2× while a normal Shard received one 26-damage burst. The corrected count is 1× and both highlight stretches remain. A full-exit zigzag control still reports three crossings. No attack/economy values changed.

The mode description, placement hint and flight guide say **fixed posts ignore Fan/Slide**. The general guide now names the exception. Reposition during setup moves one post; Recall behavior and refunds are unchanged.

## Drift schedule

Offsets below are relative to each original route, not cumulative one-way travel. Each coil visits both sides and returns to exactly the original path object. The largest step is 10° across home. Ports remain fixed, drones stay put and only between-wave setup changes geometry.

| Setup | Change | Resulting offset from home |
|---|---|---|
| 4 | A +5° | A +5° |
| 5 | B +5° | B +5° |
| 7 | C −5° | C −5° |
| 8 | A −10° | A −5° |
| 9 | B −10° | B −5° |
| 10 | C +10° | C +5° |
| 11 | A +5°, B +5° | A and B home |
| 12 | C −5° | C home |

At the coils' roughly 27m distance from the prism, a 5° rotation moves their centers about 2.4m sideways. This can affect a narrow line without sending a whole coil to a different district. Individual grazing placements can still lose contact; the goal is retaining useful portions of the fleet, not guaranteeing every drone remains effective. This schedule visits both sides but is not a time-weighted zero-mean oscillation.

Removed the extra 2× hull layer on Drift waves 8–12. Their authored group escalation remains (for example final Barges use 1.8× group hull, plus the unchanged level multiplier 1.15). Counts, timings, speed, rewards and waves 1–7 are untouched. Wave-7 total hull is 992.68 and wave 8 is now 1,256.72: about 1.27×, rather than 2.53×. No Crown or ordinary Frontier schedule changes.

## Evidence

`npm run trial:drift` reproduces `DRIFT_GENTLE_TRIAL.json`. The same finite idealized placement policy from Claude's study buys with earned scrap and uses an idle pilot. Seeds 17, 29 and 41 only vary Wisp phase. Re-fly repositions units under 4m of current-route contact; never-move uses the same purchasing algorithm but does not reposition. These are adaptive policies, not frozen identical fleets.

All six Drift runs finish at 100 core with 17 drones. Re-fly makes one reposition across the run, compared with 24 in the old aggressive trial. Both policies succeeding is acceptable for this first spatial playthrough; it is not evidence of demanding survival balance.

For the seed-17 re-fly fleet, contact on the affected route before → after each change:

| Setup / gate | Before | After | Retained |
|---|---:|---:|---:|
| 4 / A | 54.98m | 39.88m | 73% |
| 5 / B | 41.37m | 23.94m | 58% |
| 7 / C | 27.96m | 25.44m | 91% |
| 8 / A | 61.81m | 43.93m | 71% |
| 9 / B | 91.75m | 48.89m | 53% |
| 10 / C | 76.31m | 56.50m | 74% |
| 11 / A | 82.36m | 85.47m | 104% |
| 11 / B | 75.34m | 97.20m | 129% |
| 12 / C | 95.49m | 105.85m | 111% |

These are summed contact metres across that fleet, not unique coverage or damage. They show meaningful changes with partial retention and recovery near home. The old aggressive `DRIFT_TRIAL.json` remains historical and unchanged. No amplitude/balance search was used to force a desired win rate.

Validation: 114 deterministic checks (prior 112 + one Tripwire regression and one gentle-drift contract), separate solid/field geometry, TypeScript and production build. Drift geometry checks cover all authored offsets, flight bounds, fixed ports and no early prism entry. The retained ordinary-arena checks protect schedules and scores. Browser assertions now expect the 5° first swing, but approved browser control is unavailable here; no browser, screenshots or frame-rate claims for this revision. Claude's 83 browser checks remain evidence for v0.10.0 only.

First playtest: does the small shift invite you to inspect and improve a few lines, while broad lines survive and regain contact when the coil returns? If nothing feels consequential, adjust the spatial excursion or encounter after that feedback. If it feels like upkeep, reduce frequency before adding more transformation types.
