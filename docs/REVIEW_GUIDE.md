# Helix Hold — outside review guide

Repository: [CharlesMish/helix-hold](https://github.com/CharlesMish/helix-hold). Start from the current default branch and identify the commit you reviewed. Read the latest section of [HANDOFF.md](../HANDOFF.md), then [CROWN_LATE_TUNE_081.md](CROWN_LATE_TUNE_081.md), [DRONE_ROLES_080.md](DRONE_ROLES_080.md), [CROWN_GROWTH.md](CROWN_GROWTH.md) and [SPLIT_CROWN.md](SPLIT_CROWN.md). Current source is authoritative when older notes differ.

## Current state

Helix Hold is a React/TypeScript/Three.js spatial defense game. The player flies into position and anchors fixed firing drones, seeking useful lines through three-dimensional enemy routes. Flight School teaches the idea; Shear adds competing paths; Split Crown is the larger arena with an eight-wave checkpoint and four optional extra waves. Orbital remains an archived playable study, and the three-wave carrier/Stasis lab remains optional.

Version 0.6.1 removed the stray decorative crown arches identified in the user's screenshot. Version 0.6.2 addresses outside-review findings: portable historical geometry checks, Enter-to-end for field checks, portrait Survey layout, and a Crown readout separating this wave's coverage from later waves. Routes, collision, weapon stats and economy are unchanged. Read [the follow-up](REVIEW_FOLLOWUP_062.md) before repeating the earlier findings.

Version 0.7.0 responds to Charlie's confirmed Crown playtest: scrap-funded fleet growth removes Crown's cap, and optional waves 9–12 end with a stronger carrier. Original eight-wave schedules/routes, weapon values and rising purchase prices stay intact; larger fleets can make those waves easier. Other arenas retain eight slots. Renderer pools and coverage buffers grow with the fleet.

The user has confirmed Stasis now works in the live game. The earlier persistent-zero report was not reproduced or causally explained; a refresh was only a possibility. Do not describe that report as an active confirmed defect or claim a proven root-cause fix. Setup **Test Stasis fields**, per-field coverage, contact history and **Save field report** remain available to investigate a fresh reproduction.

Version 0.8.0 introduced the Crown roster experiment: Halo adds passive 5m-radius contact damage; Pin adds fixed-aim discrete shots with lingering slow. Crown prices each owned type independently. Distinct silhouettes, matching UI colors, exact field boundaries and brief Pin tracers clarify the roles. Stasis remains a passive sphere. That update followed design requests before the next playtest.

Version 0.8.1 follows Charlie’s actual v0.8 playtest: roughly 32 drones, minor early leaks, then no later core loss, with a much longer but still comfortable carrier chase. Only optional waves 9–12 gain modest hull and earlier final escort overlap. First eight waves, prices, counts, rewards, speeds and weapons remain unchanged. The final carrier now has 3,207.6 hull (+10%). Stasis and uncapped Crown growth remain; the exact human fleet is unknown.

## Run and inspect

Use a current supported Node.js installation and npm. The commands below are for an ordinary local checkout; the development server stays running until stopped.

```sh
npm ci
npm run dev
```

Run validation from another terminal:

```sh
npm test
npm run test:geometry
npm run build
npm run trial:crown
npm run study:crown-coverage
npm run study:crown-stasis
npm run study:crown-pilot
npm run trial:crown-growth
npm run trial:crown-roles
npm run study:drone-roles
npm run study:crown-late
```

`npm run build` includes TypeScript checking and produces the static `dist/` directory. `trial:crown` compares funded fleet strategies and prints detailed results; it is not a human playtest. Further studies are listed in `package.json`, including `study:sweep`, `study:stasis` and `test:stasis-repro`.

## Source map

| File | Review focus |
|---|---|
| `src/game/paths.ts` | Stable arena/path IDs, sampled 3D routes, gates, authored waves, arena flags |
| `src/game/sim.ts` | Fixed-step simulation, inputs, economy, placement/repositioning, enemies, fields, contribution accounting |
| `src/game/economy.ts` | Independent Crown role prices, shared legacy curve and exact purchase quotes |
| `src/game/combat.ts` | Beam specifications, hit geometry and actual-3D Stasis membership |
| `src/game/scene.ts` | Three.js world, enemies, gates, coverage, field boundaries, camera and decorative architecture |
| `src/game/HelixHold.tsx` | Menus, HUD, controls, Survey, diagnostics and launch flow |
| `src/game/GatePlan.tsx` | Authored gate/wave forecast presentation |
| `src/game/save.ts` | Stable-ID score persistence and legacy migration |
| `src/styles.css` | Layout, readability and responsive controls |
| `qa/` | Deterministic assertions, geometry checks, prepared browser checks and comparative simulation scripts |
| `docs/SPLIT_CROWN_TRIAL.json` | Recorded Crown placements, revisions and wave results |

## Preserve the successful core

- Placement is piloting: fly and aim, then anchor. Drones retain their firing direction; they do not acquire arbitrary targets by turning toward them.
- **Plan & launch** is the default and gives unlimited setup. Auto waves is an explicit option. Preserve the useful aiming/coverage hover and clear manual launch.
- Setup Reposition reuses the selected drone, preserving its mode, paid value and contribution. Cancel keeps the original placement. Selected Recall refunds actual paid value; moving a 20-scrap drone must not require buying a 104-scrap replacement at eight slots.
- Pierce's satisfying multi-lane role matters: 20 DPS, radius 1.45m, range 76m, all contacts. Normal Sweep is 18 DPS, radius 2.5m, range 38m, nearest target. Only the optional lab tests 22 DPS. Sticky targeting would change mechanics and previews, not merely fix a bug.
- Crown independent prices count only currently owned units of the requested type. Buying support must not raise damage-drone prices. Other arenas retain shared prices.
- Halo uses actual enemy centers inside a 5m sphere; Pin selects the nearest obstruction only when ready to fire. Preserve its discrete cadence, nonstacking timed slow, pool reset and effective-damage accounting.
- Stasis is a paid passive field, deals no damage, halves route travel speed inside a 6m sphere, and uses actual enemy coordinates. Overlaps apply the strongest effect only; a screen crossing is not a 3D intersection. Wisp drift can leave nominal route coverage.
- Preserve stable arena IDs and saved scores. Split Crown has its own campaign score; optional continuations do not overwrite the original five-wave or Crown eight-wave result.

## What the evidence establishes

Version 0.8.1 retains 75 deterministic checks, including eight new role, five economy and four presentation checks. Separate geometry checks cover enemy solids and field boundaries. The original 43 passed on Node 24, but the old whole-level hash was brittle across exponentiation implementations. The retained historical fixture is still checked against the original hashes; live computed geometry now uses tolerances while authored schedules/settings remain exact. [Provenance and reproduction](../qa/fixtures/README.md). Rerun checks against the reviewed commit. Passing assertions establish their tested invariants, not complete game correctness.

The retained historical Crown trial deliberately limits itself to eight drones; the retained JSON is historical and is not the current maximum-fleet result. Current scripts now use current price quotes; use the documented earlier commit for exact old outputs. Crown's ordinary-input opening uses automated steering, thrust and anchoring without teleporting or bonus currency: 6/6 kills, 100 core, 56 scrap. Longer trials use finite idealized placement candidates, normal earned purchases and a setup reposition. Shared-line fleets finish at 82 core with or without a late field; one dedicated fleet benefits from a late field. Those results establish feasible strategies and useful comparisons, not player win rates or optimal balance.

The original v0.7 funded twelve-wave trial uses 19 drones before the finale. An idle 19-Pierce fleet loses 40 core to the final carrier; the actively pursuing pilot clears at 100 core with 19 Pierce or 17 Pierce plus two paid fields. Idealized setup poses and automated perfect-state pursuit do not measure player difficulty. See `CROWN_GROWTH_TRIAL.json` and the current growth note for methods.

The historical v0.8.0 roster trial adds a paid 25-unit mixed fleet: 17 Pierce / 2 Stasis / 4 Halo / 2 Pin, finishing at 100 core with active pursuit. Both new damage roles contribute; separate fixed-budget local trials show useful limitations, including weak Halo-only coverage and Pin's poor crowded-convoy damage. No wave changes followed from that study alone. The later human feedback motivates v0.8.1; read the new late-tune note before interpreting historical figures. Its nine paired runs preserve exact earned placements for 19-, 25- and 33-drone examples. All still clear at 100 core. More hull and D-convoy overlap create a modest workload increase; the large mixed fleets gain only about 1–1.5s of carrier lifetime. Do not claim optimized formations became difficult or that 33 units reconstruct the user’s fleet.

Approved browser control was unavailable in the development environment. Charlie supplied Claude's automated Chromium/software-renderer observations of v0.6.1; those are external browser evidence, not human playtesting. Updated v0.6.2–v0.8.1 browser tests were not executed here. Growing-fleet performance remains unverified. They use state polling, include the field-check keyboard exit and narrow desktop/touch Survey layout, and retain Barge screenshots/pixel measurements as review evidence rather than an uncalibrated visibility threshold. Desktop/mobile HUD fit, contrast, depth reading and comfortable flight remain valuable review targets. Record browser/device, build, actions and observed state when reporting a visual or input defect.

## Useful review questions

1. Do combat, coverage previews and contribution statistics agree at range ends, thick-beam contacts, Fan/Slide transforms and reposition commits/cancels?
2. Does Stasis visibly earn a slot after active routes have damage coverage, and does the UI clearly distinguish the moving preview from anchored fields? Use measured contact and damage opportunities before changing strength.
3. Does Sweep have a useful wider/nearest-target role beside Pierce? Compare matched placements and enemy schedules; avoid attributing every missed contact to DPS.
4. Does Crown's staged A→AB→ABC→ABCD opening remain affordable with reasonable play? Does late E reuse useful upper/lower neighborhoods without making one core-heavy layout trivial?
5. Does adding a ninth or later Stasis feel worthwhile without dismantling a working defense? Does free reposition remain understandable and useful as the fleet grows?
6. Are the passive fields, pilot gun and discrete Pin shot distinguishable in flight, and do displayed type prices agree with purchases?
7. Does the stronger wave-12 carrier invite active pursuit across districts while escorts test the fleet? Distinguish a satisfying encounter from merely longer hull depletion.

Mirrors/relays, endless play, new armor/immunities and additional arena candidates are not implemented promises. Crown has an eight-wave checkpoint plus four optional waves; Shear and Orbital have five plus three. These are finite authored schedules, not an endless system.

## Brief for Claude, Grok or another reviewer

Review the current code and latest handoff critically. Separate reproducible defects from design hypotheses and taste. For each consequential finding, identify the relevant file/behavior, reproduction or measured evidence, expected versus actual result, and a small proposed correction. Keep source/simulation evidence separate from browser observations and human playability. Recommend one coherent next experiment with a question it could answer and a way to compare it with the current version; do not add every suggested feature at once.
