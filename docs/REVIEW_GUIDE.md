# Helix Hold — outside review guide

Repository: [CharlesMish/helix-hold](https://github.com/CharlesMish/helix-hold). Start from the current default branch and identify the commit you reviewed. Read the latest section of [HANDOFF.md](../HANDOFF.md), then [SPLIT_CROWN.md](SPLIT_CROWN.md). Current source is authoritative when older notes differ.

## Current state

Helix Hold is a React/TypeScript/Three.js spatial defense game. The player flies into position and anchors fixed firing drones, seeking useful lines through three-dimensional enemy routes. Flight School teaches the idea; Shear adds competing paths; Split Crown is the larger eight-wave arena. Orbital remains an archived playable study, and the three-wave carrier/Stasis lab remains optional.

Version 0.6.1 removed the stray decorative crown arches identified in the user's screenshot. Version 0.6.2 addresses outside-review findings: portable historical geometry checks, Enter-to-end for field checks, portrait Survey layout, and a Crown readout separating this wave's coverage from later waves. Routes, collision, weapon stats and economy are unchanged. Read [the follow-up](REVIEW_FOLLOWUP_062.md) before repeating the earlier findings.

The user has confirmed Stasis now works in the live game. The earlier persistent-zero report was not reproduced or causally explained; a refresh was only a possibility. Do not describe that report as an active confirmed defect or claim a proven root-cause fix. Setup **Test placed fields**, per-field coverage, contact history and **Save field report** remain available to investigate a fresh reproduction.

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
```

`npm run build` includes TypeScript checking and produces the static `dist/` directory. `trial:crown` compares funded fleet strategies and prints detailed results; it is not a human playtest. Further studies are listed in `package.json`, including `study:sweep`, `study:stasis` and `test:stasis-repro`.

## Source map

| File | Review focus |
|---|---|
| `src/game/paths.ts` | Stable arena/path IDs, sampled 3D routes, gates, authored waves, arena flags |
| `src/game/sim.ts` | Fixed-step simulation, inputs, economy, placement/repositioning, enemies, fields, contribution accounting |
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
- Stasis occupies a paid slot, deals no damage, halves route travel speed inside a 6m sphere, and uses actual enemy coordinates. Overlaps apply the strongest effect only; a screen crossing is not a 3D intersection. Wisp drift can leave nominal route coverage.
- Preserve stable arena IDs and saved scores. Split Crown has its own campaign score; optional continuations do not overwrite the original five-wave result.

## What the evidence establishes

Version 0.6.2 has 51 deterministic checks: 22 simulation, 9 revision, 6 field-check, 8 Crown and 6 coverage, plus enemy/field geometry checks. The original 43 passed on Node 24, but the old whole-level hash was brittle across exponentiation implementations. The retained historical fixture is still checked against the original hashes; live computed geometry now uses tolerances while authored schedules/settings remain exact. [Provenance and reproduction](../qa/fixtures/README.md). Rerun checks against the reviewed commit. Passing assertions establish their tested invariants, not complete game correctness.

Crown's ordinary-input opening uses automated steering, thrust and anchoring without teleporting or bonus currency: 6/6 kills, 100 core, 56 scrap. Longer trials use finite idealized placement candidates, normal earned purchases and a setup reposition. Shared-line fleets finish at 82 core with or without a late field; one dedicated fleet benefits from a late field. Those results establish feasible strategies and useful comparisons, not player win rates or optimal balance.

Approved browser control was unavailable in the development environment. Charlie supplied Claude's automated Chromium/software-renderer observations of v0.6.1; those are external browser evidence, not human playtesting. Updated v0.6.2 browser tests were not executed here. They use state polling, include the field-check keyboard exit and narrow desktop/touch Survey layout, and retain Barge screenshots/pixel measurements as review evidence rather than an uncalibrated visibility threshold. Desktop/mobile HUD fit, contrast, depth reading and comfortable flight remain valuable review targets. Record browser/device, build, actions and observed state when reporting a visual or input defect.

## Useful review questions

1. Do combat, coverage previews and contribution statistics agree at range ends, thick-beam contacts, Fan/Slide transforms and reposition commits/cancels?
2. Does Stasis visibly earn a slot after active routes have damage coverage, and does the UI clearly distinguish the moving preview from anchored fields? Use measured contact and damage opportunities before changing strength.
3. Does Sweep have a useful wider/nearest-target role beside Pierce? Compare matched placements and enemy schedules; avoid attributing every missed contact to DPS.
4. Does Crown's staged A→AB→ABC→ABCD opening remain affordable with reasonable play? Does late E reuse useful upper/lower neighborhoods without making one core-heavy layout trivial?
5. Does a free reposition solve a meaningful new spatial problem as gates open? Distinguish a discovered shared slice from an optimizer's precise line.

Mirrors/relays, endless play, new armor/immunities and additional arena candidates are not implemented promises. Eight authored Crown waves and optional three-wave continuations exist; they are not an endless system.

## Brief for Claude, Grok or another reviewer

Review the current code and latest handoff critically. Separate reproducible defects from design hypotheses and taste. For each consequential finding, identify the relevant file/behavior, reproduction or measured evidence, expected versus actual result, and a small proposed correction. Keep source/simulation evidence separate from browser observations and human playability. Recommend one coherent next experiment with a question it could answer and a way to compare it with the current version; do not add every suggested feature at once.
