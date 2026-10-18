# v0.10.0: Tripwire and Drift Frontier

Charlie's framing for this pass: the core flight-and-placement loop felt great from the start, but the challenge was easy. Early on it was "hard" only because of the eight-drone cap, and once that was lifted, nothing scaled well. He asked for ideas on new line types and late-game difficulty, plus the formatting and browser-suite fixes. Both features below are opt-in prototypes in the LAB menu. Campaign arenas, prices, schedules and scores are unchanged.

## Tripwire: a line defined by two flights

| | |
|---|---|
| Where | Helix Frontier and Drift Frontier only, key **6** (Lumen's key, never in the same roster) |
| Price | 36 scrap for the first post, +18 per strand owned. The second post that completes a strand is free. Independent of other prices. |
| Span | 3–32 m between the two posts' rest positions |
| Damage | 26 to every enemy, **once per crossing**. Speed does not matter. |
| Re-arm | An enemy must clear a release volume 0.6 m wider and longer than the strand before it can be hit again |
| Hit test | The shared finite cylinder (`beamContact`), radius 0.6 m, from post A to post B. Combat, preview and route highlights use the same strand. |

**Why this shape.** Every existing line rewards contact *time*. Pierce is best laid along a ribbon. Tripwire inverts that: riding along the strand counts once, so the best strands cut *across* routes. Vertical strands through stacked coil turns, a strand across converging port approaches, and a strand across a weave lane all fit. Posts ignore aim and can be anywhere, including straight up and down, which the pilot's ±60° pitch limit never allows for an aimed beam. It is strongest against fast Shards and weaving Wisps (Wisps can re-cross) and weak against slow Barges, so it complements Pierce rather than replacing it.

**Rules.**
- Anchoring in Tripwire mode with an open post completes that strand. Otherwise it places a new paid first post.
- **Recall last** on a free second post refunds nothing and reopens the first post. Selected recall in Survey removes **both posts** and refunds the strand's price, so a leftover open post can never become a free strand.
- Reposition moves one post. The strand re-forms from its partner and must respect the span. Fan/Slide move strands with the lattice.
- Damage and kills belong to the paid post (the strand's owner). The HUD shows crossings ("2×") instead of metres, split into this wave and later waves.

**Evidence.** `qa/tripwire.mjs` has 7 checks: roster and pricing, span limits, crossing counts on synthetic routes (straight through = 1, zig-zag = 3, along the strand = 1), preview crossings, recall/reposition rules, and Fan/Slide projection. In the browser, a vertical 22.5 m strand at the West Spindle's end angle crosses both passes of its 1.2 turns and alone killed all six wave-1 Shards. That is a single setup, not a balance claim.

## Drift Frontier: the problem moves, not just the hull

The late game was easy because coverage is permanent. Once a route is covered it stays covered, and earned scrap adds Pierces faster than authored hull grows. Raising hull alone (as in Crown 9–12) adds hit points, not decisions. Drift attacks the permanence instead.

- Same three coils, ports and prism as Helix Frontier. Openings on waves 1, 3 and 6.
- From wave 4, an announced route **swings around the prism's vertical axis** before launch. Its coil body rotates and its approach re-forms to the **same breach port**. Drones never move, so lines on that coil lose contact.
- Swings happen only between waves, when nothing is alive. Each route stays inside its measured legal range (A −90°…+70°, B −50°…+100°, C ±120°), and all three coils are home again for wave 12.
- The placement panel and Survey show each swing with your contact on that route before and after. The swung route gets the ribbon (G), and the gate plan forecasts every swing.
- Twelve waves. Waves 8–12 carry twice their listed escalation (level hull 1.15×).

| Setup | Swing |
|---|---|
| Wave 4 | A +45° (south) |
| Wave 5 | B +45° (north) |
| Wave 7 | C −45° (east, toward B) |
| Wave 8 | A −90° (past home, into the north) |
| Wave 9 | B +30° |
| Wave 10 | C +90° (west) |
| Wave 11 | A +45°, B −75° (both home) |
| Wave 12 | C −45° (home) |

A rotation about a coil's *own* axis was tried first and rejected. A helix is screw-symmetric, so spinning it only shifts its two ends, and most lines survive. Swinging the coil around the prism moves the whole body.

### Funded trial (`npm run trial:drift` → `docs/DRIFT_TRIAL.json`)

The method matches the Frontier trial: finite legal idealized Pierce poses, rebuilt from the *current* routes each setup, plus greedy pressure-weighted purchases with earned scrap. The pilot is idle and parked out of play. **Re-fly** repositions (free) every drone with under 4 m of contact on this wave's routes. **Never-move** buys identically but never repositions.

| Seed | Re-fly | Never-move |
|---|---|---|
| 17 | win, 73 core, 17 drones, 24 repositions | loses during wave 8 |
| 29 | win, 100 core | loses during wave 8 |
| 41 | win, 82 core | loses during wave 8 |
| Helix Frontier, never-move | n/a | win, 100 core (control: no swings) |

A swing removes most of a coil's contact for the fleet that was built there. In seed 17: A +45° took 55 m to 8 m, B +45° took 45 m to 0, A −90° took 81 m to 3 m, and C +90° took 104 m to 4 m. The re-fly fleet moved about 2.7 drones per swing setup and 9 at the double swing before wave 11.

**Tuning note.** A hull sweep showed a cliff. With waves 8–12 at 2.0×, re-fly finishes at 73–100. At 2.5×, it loses during wave 11. A uniform 1.6× instead kills the never-move fleet on wave 4 by over-hardening the opening. Hull is a blunt instrument; the swings carry the meaningful difficulty.

**Limits.** Seeds change only Wisp phase. Pierce only (no Tripwire, Stasis, Halo or Pin in the policy), no active pilot fire (a human adds a 34 DPS beam), and idealized poses that a human will not find instantly. This establishes that the arena is finishable and that re-flying matters. It says nothing about human difficulty or fun.

## Smaller fixes in this pass

- Prettier formatting (`npm run format`, `format:check`). The built bundle differs only in JSX whitespace text nodes.
- Browser suite fixed (stale lab selector, a thrust check that assumed a fast renderer) and executed in headless Chromium/SwiftShader for the first time since v0.6. It now also covers Tripwire, Drift and the touch-portrait lesson text.
- Phone portrait (Split Crown): the lesson text no longer overlaps the second row of gate cards.
- The launch cradle pad no longer renders as an opaque black hexagon over route A from the opening camera.
- Placement messages no longer claim Stasis is only in Carrier Test Flight and Split Crown.
- QA-only `__helixDebug.clear()` resolves the current wave instantly, for reaching late setups in browser checks.

## Playtest questions

1. **Tripwire:** do two-post placements feel like piloting, or like admin? Do you find strands that cut across coils, or default to laying them along ribbons? Is 26 per crossing worth 36 scrap next to a 20-scrap Pierce?
2. **Drift:** is re-flying after a swing a fresh small puzzle or a chore? Is 45° too large? Every swing currently wipes 70–100% of that coil's contact. Smaller swings (20–30°) would keep some lines alive and make "which ones still work?" the question. The double swing before wave 11 is the stress case.
3. **Late game:** with your real play (pilot fire, imperfect poses, mixed roster), do waves 8–12 feel achievable and challenging, or like a wall? Note core lost per wave.

Answer these before tuning hull further or adding endless play.
