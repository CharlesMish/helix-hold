# Design directions (Claude, after v0.10.0)

These are ideas for new weapons, difficulty, maps and modes, ranked by how well each keeps the part Charlie says felt great: **placement is piloting**. Tripwire and Drift Frontier are already built (see [TRIPWIRE_DRIFT_0100.md](TRIPWIRE_DRIFT_0100.md)). Everything else here is a proposal, not an implementation.

## Why the game gets easy

1. **Coverage is permanent.** Routes never change and drones never move, so a solved route stays solved for the rest of the run.
2. **Pierce scales with density.** A Pierce line damages every enemy in it, so convoys make each drone stronger, and income scales with kills. Every study in `docs/` keeps finding Pierce competitive or best.
3. **Hull is a blunt lever.** The Drift trial shows a cliff: 2.0× late hull finishes at 73–100 core, while 2.5× loses during wave 11. Crown 9–12 added hull, and the playtest still lost no core after the early waves.

The hardest constraint so far was the old eight-drone cap. It is gone, and nothing replaced it as the source of decisions.

## Difficulty levers, best fit first

1. **Change the placement problem.** Routes that open (Helix Frontier), swing (Drift Frontier, built), or *retire*. Retirement is an untested variant: a coil goes quiet after N waves, so its drones are worth moving. Each change asks for the core verb again.
2. **Enemies that care about geometry,** not just hull:
   - **Bulwark.** A frontal shield: beams hitting it head-on (beam direction against its travel) deal ¼ damage. Lines fired from behind or across work normally. Beam *direction* starts to matter, not only beam position. It is cheap to add: a dot product in `damageEnemy`.
   - **Splitter.** On death it breaks into 2–3 Shards that continue from that point, so coverage after a kill point matters.
   - **Blink.** Jumps forward X m along its route every few seconds, so long lines must cover both sides of a jump.
   - **Prism hull.** Stops Pierce at its body (non-piercing armor), shielding the enemies behind it, so you need crossing angles.
3. **Opt-in modifiers and medals.** The player chooses the challenge: front shields on, Drift on, −25% scrap, faster enemies, short auto setup, no anchoring mid-wave. Medals per arena could include *core 100*, *under par scrap*, *under par drones* and *no repositions*. Building it is cheap, and "achievable and challenging" stops being one tuning target.
4. **Economy.** Make wave-clear income flat and kill rewards smaller, so the fleet grows slower than traffic. Workable, but invisible to the player.
5. **Raw hull.** Last resort; see the cliff above.

## New lines (weapons), best fit first

| Idea | Rule | Why it is a different *line* |
|---|---|---|
| **Tripwire** *(built)* | Strand between two flown posts; burst per crossing | Rewards cutting across routes; speed-independent |
| **Lens** | Passive sphere; any of *your* beams passing through it deals +50% | Rewards making your own lines intersect at one point, so the geometry of your fleet matters, not just enemy routes |
| **Lance** | Single target; damage ramps 6 → 40 DPS while it holds the same target, then resets | Anti-heavy: rewards long along-ribbon lines against Barges and the carrier, where Pierce is mediocre |
| **Fork** | Beam that splits into a fixed 3-ray fan 20 m out | The aim decision becomes "where does the split land" |
| **Marker** | A Pin variant: marked enemies take +35% from all sources for 3 s | Rewards places where many of your lines cross |

On the existing roster: **Relay** pairs the most interesting mechanic (bend a line) with the weakest payload (8 DPS, single target). Test one bounce on a *Pierce* before judging the idea. **Halo and Stasis** are both "fly to a sphere"; if playtests show Halo is rarely chosen, merge or drop it rather than adding more spheres.

## Maps

- **Split Crown** is a good campaign spine: two districts, staged openings, a carrier that tours both.
- **Frontier/Drift** is the late-game and escalation spine: routes that open and move.
- Untried shapes worth sketching:
  - **Braid.** Two routes winding around each other as a double helix. Shared Pierce slices plus many crossings for Tripwire.
  - **Fork-and-merge.** A route that splits and rejoins; pairs naturally with Splitter enemies.
  - **Precession.** Orbital Garden's tilted rings, with their tilt advancing each wave. Drift's idea on a ring map.
  - **Tower.** A tall vertical stack where the ±60° pitch limit matters and vertical strands shine.

## Modes

- **Expedition (endless-ish).** Generate a new coil every few waves and retire the oldest; optional Drift; score is waves held. The enemy pools already grow, and the swing validator in `qa/drift.mjs` is the start of a route-legality check for a generator.
- **Par puzzles.** Fixed scrap, one authored wave, place to hold it. These showcase line-finding and double as tutorials.
- **Daily seed** of Expedition once it exists.

## Suggested order

1. Playtest Tripwire and Drift Frontier (questions in the v0.10 note).
2. Add opt-in modifiers and medals. Cheap, and they serve players who want a challenge without retuning anything.
3. Add one geometry enemy, Bulwark, and see whether beam direction becomes a decision.
4. Then decide whether to make Expedition the long-term late game.
