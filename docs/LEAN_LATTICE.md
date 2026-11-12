# Lean Lattice · v0.10.0

Charlie's question after v0.9.0: Helix Hold is the most playable of his tower-defense attempts, but after a few arenas it is not clear where it goes next, or whether it is the right angle beyond what tower defense has already done. This note is an outside read of that question, the measurements behind it, and one small playable experiment, **Three Lines**, that tests the proposed direction.

Nothing here is a human playtest. Policies are scripted; the browser was driven headlessly.

## The read in one paragraph

The part of Helix Hold that no other tower defense has is the line: flying into a sightline that threads curved routes in 3D and leaving it there. Since v0.6 the game has grown along the ordinary tower-defense axis instead: more drone types, a boss, more waves, an uncapped fleet. Each step diluted the line. With twenty drones no single line matters, Fan/Slide would break more than it fixes, and the pilot's gun is a rounding error. The repository's own studies kept reporting the same thing from the other side: Stasis, Halo and Pin each lose to another Pierce. The proposal is to go the other way: a small lattice that cannot hold everything, so that the three things only this game has (choosing lines, flexing them live, flying the gap) decide the result.

## What was measured

`npm run study:tension` (recorded in `TENSION_STUDY.json`).

**1. Pressure peaks in the first three waves, then declines as the fleet grows.** A greedy all-Pierce buyer with the pilot parked, Split Crown, seed 17. "Deepest" is how far along its route the worst enemy of the wave got before dying; 1.00 is a breach.

| Wave | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Fleet | 2 | 3 | 4 | 6 | 8 | 9 | 11 | 13 | 15 | 16 | 18 |
| Deepest | 0.77 | 0.88 | 0.99 | 0.89 | 0.72 | 0.72 | 0.78 | 0.66 | 0.62 | 0.59 | 0.63 |

The same earnings buy 13 Pierces by wave 8. Seven, frozen, clear all eight waves at 100 core without the pilot firing a shot. Charlie's own v0.8 report matches: about 32 drones, a little leaked early, nothing after.

**2. On the existing arenas, what the player does during a wave does not change the result.** Six play styles, five seeds, core kept (L4 = lost during wave 4):

| Play style | Shear Lane | Three Lines |
|---|---|---|
| Never fly, never move a drone | 58 58 58 58 58 | L3 L3 L3 L3 L3 |
| Re-place every line each setup; never fly | 100 ×5 | L4 L4 L4 L4 L4 |
| Fly casually; drones stay where first placed | 100 ×5 | L4 L4 L4 L4 L4 |
| Fly casually; Fan/Slide live; no re-placing | 100 ×5 | 31 50 50 42 29 |
| Fly casually; re-place each setup | 100 ×5 | 79 79 86 44 58 |
| Fly sharply; Fan/Slide live; re-place each setup | 100 ×5 | 100 79 93 100 58 |

On Shear every style that does anything at all finishes untouched, so the game cannot tell them apart. With three drones the same styles spread from an early loss to a clean hold, and no single skill is enough.

**3. The live skills are already worth several drones; nothing asks for them.** On Shear, a pilot that simply points at the front-runner clears at 100 core with three drones and survives with one. A myopic Fan/Slide policy with no pilot at all lifts a three-drone fleet from losing in wave 5 to finishing on 63 core. Both were found by crude scripts.

**4. Hull is a blunt knob on a static fleet.** Scaling one wave while the earned, untouched fleet meets it:

| Hull × | 1 | 1.2 | 1.4 | 1.6 | 1.8 | 2 | 2.2 | 2.6 |
|---|---|---|---|---|---|---|---|---|
| Shear wave 4, core lost | 0 | 0 | 0 | 42 | 42 | 42 | 42 | 42 |
| Crown wave 6, core lost | 0 | 0 | 0 | 0 | 0 | 0 | 56 | 100 |

There is 40–100% headroom before anything leaks, and then a whole convoy leaks together, because every enemy in a group rides the same rail through the same exposure. That is why the v0.8.1 tune (about +12–18% hull on waves 9–12) changed so little, and why more hull alone will arrive as a wall rather than as pressure. Variation between enemies has to come from something that moves: the pilot, or the lattice.

## The experiment: Three Lines

Lab → **Three Lines**. Shear's routes, six waves, three drones funded before wave 1 and none sold after. Pierce and Sweep only. From wave 2 every wave uses at least two lanes and the later ones overlap all three, so a resting three-line lattice cannot hold them. What is left to the player:

- **Between waves:** free Reposition, as before. Each setup is a fresh three-line problem against the announced lanes.
- **During a wave:** Fan (Shift) and Slide (Q/E) move all three lines together; release to return. The lattice panel shows its state and coverage redraws while it moves.
- **Always:** the pilot's own gun, which with three drones is about a third of the firepower.

Core kept is the score. A best is saved in `labBestByLevel`, apart from campaign records. Hull is one number (`hpMul: 1.5` on the arena, about 1.4× Shear); lower it if a first flight is punishing.

Once the three drones are placed, the next-anchor panel and its phantom preview are replaced by a small lattice card. Other arenas are unchanged, including their preview at a full cap.

## What to look for

1. Did you move drones between waves because you wanted to, not because the lesson said so?
2. Did you reach for Fan or Slide mid-wave, and could you tell what it would do before you pressed it?
3. Did a loss feel like yours (a line, a late slide, the wrong lane flown) or like arithmetic?
4. After finishing, did you want another go at the score?

## What each answer would mean

**If it lands:** the direction is small fleets and authored lane choreography, with difficulty coming from which lanes overlap and when, not from hull. Natural next steps, one at a time: a lean version of Split Crown's west pair; a par per arena from this study's solver; enemies that care about a line's direction (a bulwark that shadows whatever is behind it along the beam) so that crossing lines and tangent lines stop being interchangeable. Crown's roster and uncapped growth would stay as the relaxed mode they already are.

**If it is fiddly or frantic:** the live verbs are not carrying it, and the honest reading is that the good part of Helix Hold is the setup toy, finding lines with the coverage hover. That is a spatial puzzle, and the next experiment should drop the waves' real-time half: fixed budgets, a pass/fail replay, par scores, many small sculptures. The solver in `qa/tension-study.mjs` already computes the par.

**If it is merely fine:** stop extending Helix Hold. Nine revisions of content have not moved it, and the measurements say more content will not.

## Limits

- Scripted policies use idealized setup poses and perfect state knowledge. "Casual" holds a target for 1.5s and steers at half gain; it is not a model of a person. Human difficulty of Three Lines is unknown and its tuning is a first guess.
- The Fan/Slide policy is myopic and sometimes hurts a well-placed lattice; treat its numbers as a floor.
- One arena, one hull setting. No claim that three is the right number.
- Browser: v0.10.0 was opened in headless Chrome with a software renderer at 1280×800 and 390×844. The lab entry, cap, lattice card, Fan/Slide state and wave launch were observed there with no page errors. Frame rate, feel and touch comfort were not assessed.
- Existing arenas, schedules, prices, weapons and scores are unchanged. `hasStasis` now honors an explicit `stasisAvailable: false`; no existing arena sets it.

## Reproduce

```sh
npm test                 # 106 checks; the last six are qa/lean.mjs
npm run study:tension    # rewrites docs/TENSION_STUDY.json
```
