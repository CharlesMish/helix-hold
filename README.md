# Helix Hold · Sightline Lab (0.10.1)

A 3D defense game in which placement is piloting. Fly into a useful line, anchor a weaker drone there, and return to the launch cradle to build the next.

## Play

- **Plan & launch is the default.** Take unlimited time before every wave. Fly, aim, anchor and recall, then press Enter or Launch wave when ready.
- **Auto waves** is optional in the observatory or Pause menu: 12 seconds before the first wave and 8 seconds between waves. The preference is remembered. Changing it does not interrupt a wave already in flight.
- Start with 60 scrap. Two opening Pierces cost 20 + 32. Crown and the new prototypes price each drone type independently; legacy arenas use the shared 20, 32, 44, … curve.
- **Pierce:** a long narrow beam that damages every enemy it intersects.
- **Sweep:** a shorter, wider beam that damages only its nearest target.
- **Stasis:** a passive 6m-radius slowing sphere, available in Crown and the optional labs/prototypes.
- **Halo (Crown):** a passive 5m-radius sphere dealing 18 DPS to every enemy inside.
- **Pin (Crown):** an aimed shot every 1.6s, hitting the nearest target for 24 damage plus a brief 35% slow.
- Coverage highlights show potential contact with shard-sized enemies using the combat hit test. In Split Crown and the new prototypes, the main number and bar count the upcoming wave's routes during setup, or routes with traffic still pending/alive during combat; future-wave coverage is listed separately. Hover still shows every route. Exposure time, Sweep obstruction and Wisp weaving still matter.
- Recall the most recent drone for its original purchase price. During setup, Survey lets you select any drone and **Reposition** it for free, preserving its type, paid value and contribution. Anchor commits; Cancel keeps the old placement.
- Survey pauses the simulation and shows the whole 3D arena.
- Flight School, Shear and Split Crown are featured; Orbital remains available as an archived study. Best surviving core integrity is saved locally by campaign arena ID. Optional test flights and prototypes do not write campaign scores.

**Flight School** combines two Glass Needle waves with three Twin Ribbon waves. **Shear Lane** keeps its three-route geometry with a slower short dive. **Orbital Garden** explores two recognizable tilted rings and their inward exits. After clearing Shear or Orbital’s original five waves, choose **Continue to waves 6–8** to keep your fleet, scrap and core for three authored extra waves. Your five-wave score is recorded before continuing; the extension cannot overwrite it. Flight School stays five waves and the Stasis/carrier lab stays three.

Desktop: W/S thrust/reverse; A/D or left/right arrows yaw; mouse or up/down arrows aim; Space boost; F anchor; 1/2 beam mode, 3 Stasis where offered, 4 Halo and 5 Pin where offered; 6 Lumen and 7 Relay in Relay Lab; G new-route ribbon; R recall; Shift fan; Q/E slide; Tab survey; Tab/Shift+Tab navigate Survey controls; Esc resume from Survey or pause flight; C cancel a move; Enter launch prepared wave, or end an active field check. Click the sky to capture mouse aim. Keyboard aiming remains usable without pointer lock.

Touch: left stick aims, right stick flies forward/backward. Fan and Slide are toggles to leave both thumbs available. Anchor and Recall sit between the sticks. Survey pauses time.

Your hull does not collide with enemies or ribbons. Lasers use a finite cylindrical hit volume with each enemy's spherical collision radius. Barges and Shards stay on their routes; Wisps deliberately drift and have faint tethers to the ribbon. Pierce/Sweep and Halo apply continuous damage; Pin applies discrete instantaneous shots, with no projectile flight-time simulation. See `src/game/combat.ts`.

## Split Crown

Choose **Split Crown** for eight authored waves across two separated helix districts. A/B are the west crown and coil; C/D are their eastern counterparts. They first open in waves 1/2/3/5. Gate **E** is reserved for one final carrier in wave 8. Its distinct transfer visits useful defense neighborhoods in both crowns and the lower approaches. It stays visible as a dashed route before opening.

Stasis is available from setup, with the same passive 6m radius, half-speed effect, paid purchase and no stacking. Sweep uses the regular 18 DPS here. Start with 60 scrap. **Crown has no fixed drone cap:** grow through independent per-type prices. Buying Stasis does not raise the next Pierce price. The new prototypes also grow without a cap; legacy arenas retain eight slots. Use free selected-drone repositioning between waves. Split Crown records its eight-wave score, then offers **Continue to waves 9–12** with your fleet, scrap and core. Four authored extra waves shift convoy pressure between crowns and coils, ending with a carrier of about 3,208 hull on E. Version 0.8.1 modestly reinforces these four optional waves and brings final escorts earlier into the pursuit; enemy counts, speeds and scrap rewards are unchanged. The original wave-eight carrier remains 486 hull. The extension cannot overwrite the recorded eight-wave score.

**Five distinct bodies:** Pierce fork, Sweep twin pods, Stasis cage, Halo spines and Pin cannon. Passive fields have no muzzle; the pilot beam is hidden during empty setup. Crown buttons show each role's price and owned count. See the [model roster](public/drone-roster.svg) and [current role/pricing study](docs/DRONE_ROLES_080.md). First prices are Pierce 20, Sweep 24, Stasis 32, Halo 44 and Pin 48; only purchases of that type raise its quote.

**Show 8-wave gate plan** in the observatory or Survey reveals the full authored schedule, enemy counts and first arrival time after launch for each gate. The optional waves 9–12 have a separate forecast; continued Survey shows all twelve. Letters and route colors distinguish A–E. Two low crown platforms mark the districts without adding collision obstacles. The floating upper arches and their support lines were removed in v0.6.1 after screenshot feedback.

`npm run trial:crown` retains the historical eight-drone comparisons and an ordinary-input opening. `npm run trial:crown-growth` tests normally funded larger fleets through twelve waves, including an automated pursuing pilot; `npm run study:crown-pilot` isolates the original short carrier encounter. The current [late-wave tune](docs/CROWN_LATE_TUNE_081.md) compares frozen paid fleets of 19, 25 and 33 drones; reproduce it with `npm run study:crown-late`. Earlier roster results are in [the v0.8 role study](docs/DRONE_ROLES_080.md); `npm run trial:crown-roles` includes the Halo/Pin fleet. [The original growth note](docs/CROWN_GROWTH.md) is a v0.7 historical snapshot, whose stored figures use the old shared prices. In the historical trial, shared-line layouts finish with and without Stasis; one dedicated-line layout benefits from a late field and a free carrier-wave reposition. These establish feasibility and a useful tradeoff, not human difficulty or an optimal solution. Browser visuals remain unverified in this environment.

## Tripwire and gentle Drift Frontier (0.10.1)

**Tripwire** (key 6, Frontier prototypes only) is a line you define by flying twice. Anchor a first post (36 scrap), then fly up to 32 m away and anchor the free second post. Entry deals 26 damage; the enemy must fully exit a wider release volume before another burst. The preview counts that same re-arm rule and labels nominal Shard crossings as estimates. Riding along the strand counts once, so cut across ribbons and coil turns. Recall last undoes the second post; selected recall removes the whole strand. Posts are fixed pylons: Fan and Slide do not move them, and they can be recalled only during setup.

**Drift Frontier** (LAB) keeps the coils within **±5° of their original positions**, with small announced steps between waves from wave 4. Each coil visits both sides and returns home; the largest step is 10°. Your drones stay put, so broad or central lines can survive while some narrow lines invite revision. The panel and Survey report contact before and after. The moved route gets the ribbon (G), and setup reposition is free. Twelve waves retain the original counts/timings, with the extra doubled hull removed from waves 8–12. This is a gentler first-play spatial experiment. [Current rules and evidence](docs/GENTLE_DRIFT_0101.md); [historical aggressive version](docs/TRIPWIRE_DRIFT_0100.md).

## Optional spatial prototypes

Under **LAB · OPTIONAL EXPERIMENTS**, choose **Helix Frontier** for three authored coils opening on waves 1/3/6 around a holographic protected box. West/east winding differs; the third coil winds horizontally. Each has a distinct breach port. Nine light waves test whether new routes call for new lines while older placements stay useful. The flight boundary is unchanged. This is a finite geometry prototype, not endless mode. Press **G**, or use Survey, to toggle the newly opening route's solid ribbon. [Route chart](public/frontier-routes.svg).

**Relay Lab** has four light A/B waves. Start with 100 scrap: a Pierce, one **Lumen** emitter (6; 48 scrap) and a **Relay** (7; 16 scrap) fit the opening budget. Lumen deals 8 DPS and a refreshed 40% slow lasting 2.4 seconds. Place the Relay's receiver on its line, then aim the outgoing leg. There is **one redirection sharing the original 76m range**, no splitting or extra reach. An upstream enemy cuts off output; a second receiver stops it. Planned links show potential coverage; powered links show the live path. Relays have no weapon of their own. Use free setup Reposition to redirect the same unit between waves; Lumen/Relay recall is also setup-only. Stasis and Pin remain for comparison.

Both prototypes use independent per-type prices and uncapped scrap-funded growth, retain unlimited manual setup, and leave campaign records intact. Existing Crown waves are unchanged. The former 64-enemy limit was an initial pool in our code, not a Three.js limit; simulation and render buffers now grow together. An 80-enemy spawn check and 200-slot allocation check are not frame-rate benchmarks.

See [prototype rules, measured geometry and limits](docs/PROTOTYPES_090.md). `npm run trial:frontier` runs one coarse funded placement policy, not a balance optimizer or human playtest.

## Optional Carrier Test Flight

Select **Stasis + carrier** in the observatory, then **Enter test flight**. Three waves use Shear’s existing geometry. Press **3** (or choose Stasis) to anchor a paid, slot-consuming sphere: 6m radius (12m across), 50% slow, no damage, no stacking. Actual enemy centers must enter the sphere in 3D. Dashed outlines show the moving preview; solid boundaries belong to anchored fields. Amber brackets mark slowed enemies. The preview readout measures route length inside the sphere, broken down by lane, not distance to enemies. Fan and Slide move it with the lattice.

The final wave sends a 486-hull carrier down the marked wide figure-eight with side-lane escorts. Damage accumulates normally; a breach costs 40 core. Sweep tries 22 DPS here only; campaign Sweep remains 18 DPS and always targets its nearest obstruction. Pierce is unchanged.

Established beams are quieter during combat; Survey, setup and lattice adjustment reveal their volumes and coverage. The active placement highlight stays prominent. Enemy fittings retain their identifying color during hits.

## Checking a field

Charlie confirms the v0.5.1 live field effect works. The earlier persistent-zero session has no established cause; diagnostics remain available. With at least one anchored Stasis drone, choose **Test Stasis fields** during setup. Harmless blue targets loop along every real route; amber brackets mean actually slowed. There is no damage, weapon fire, wave advance or economy change. Only anchored Stasis field boundaries and coverage are shown; all attacks and Lumen effects are held. **End check** or **Enter** during flight returns to the original setup without launching its wave.

The field counter retains how many enemies have ever been affected in this flight (or check), alongside current slowed count. **Save field report** downloads game coordinates, build and membership/speed state for diagnosis. It sends nothing externally. Survey lists each selected anchored field's route coverage.

The observatory links the implemented Split Crown route chart and the earlier three-arena concept sheet. Counterweight and Braided Reach remain studies.

## Development

```sh
npm ci
npm run dev
npm run build
npm test
```

`npm run format` applies Prettier. `npm run trial:drift` reproduces `docs/DRIFT_GENTLE_TRIAL.json`. `npm test` runs 114 deterministic simulation, revision, field-check, Split Crown, coverage, growth and renderer-allocation checks, including manual/automatic pacing, paid per-type growth, discrete shot cadence, actual-3D fields, slow expiry, hit geometry and real-input opening trials. The historical campaign guard compares authored settings exactly and geometry with a 1e-6 m tolerance; see [fixture provenance](qa/fixtures/README.md). `npm run test:geometry` checks solid enemy bounds and exact field boundary radius; `npm run trial:carrier` runs funded encounter feasibility trials; `npm run study:sweep` compares matched synthetic Wisp cases. `npm run study:stasis` compares field strengths and local value; `npm run trial:continuation` checks funded eight-wave feasibility. `npm run study:crown-coverage` compares old total versus current-wave coverage rankings; `npm run study:crown-stasis` examines the paid late-slot tradeoff with matched refits. `npm run qa` is a browser suite for a separately running preview, subject to the environment's browser policy (see `qa/check.mjs`). It is not run by the build.

### Verification for this revision (0.10.1)

- 114 deterministic checks pass, including the real-route Tripwire re-arm regression and bounded, two-sided Drift schedule. Separate geometry and production build checks pass.
- The current funded trial clears with both re-fly and never-move policies at 100 core across three seeds; re-fly moves one drone. Earlier results below are historical, not current difficulty measurements.
- Browser control is unavailable here. Updated checks are prepared but not executed; Claude's previous browser observations below apply to 0.10.0.

### Previous verification (0.10.0)

- 112 deterministic checks pass, including Tripwire pricing, span, crossing counts, recall and reposition rules, and Drift's legal swings, determinism and drone permanence.
- Browser suite **executed**: headless Chromium with SwiftShader against `vite preview`, all 83 checks passing, including new Tripwire, Drift and touch-portrait assertions. Software rendering ran at about 4 fps, so real-GPU frame rate and human flight comfort remain unmeasured.
- Drift trial: re-fly fleets finish at 73–100 core across three seeds; never-move fleets fall during wave 8.

### Verification for 0.9.0

- 100 deterministic checks pass, including relay contact/range/slow rules, prototype score isolation, original arena settings and enemy-pool growth. Seven drone models are exercised for correct slot reuse; existing fleet and coverage allocation checks remain.
- Separate geometry checks cover enemy solids and field boundaries. Frontier paths stay within the flight envelope and reach their distinct ports without earlier box entry. The source-derived route chart was rasterized and inspected.
- One coarse funded Frontier policy finishes at 100 core with 12 Pierces; a control frozen after wave 2 loses during wave 5. New B/C openings create measurable coverage gaps, addressed with earned purchases while old defenses still contribute. This is feasibility evidence, not human difficulty or perfect balance.
- TypeScript and production build checked as part of publication.
- Browser suite and final in-game appearance: **not executed for this revision**. The managed Sites environment lacks the required browser-control capability. Source and mathematical checks do not establish frame rate, comfortable flight, visual clarity or responsive HUD fit.

The v0.6.2 review follow-up also adds Enter-to-end for the desktop field check, separates portrait Survey from the gate rows, and prepares browser assertions that poll actual state instead of assuming a fast renderer. See [review findings and limits](docs/REVIEW_FOLLOWUP_062.md).

## Source map

- `src/game/sim.ts`: pure-step flight, waves, drones, economy and seeded enemy motion.
- `src/game/combat.ts`: weapon specs, finite cylinder contact and nearest/all target selection.
- `src/game/relay.ts`: shared one-turn receiver trace, blockers and range budget.
- `src/game/paths.ts`: arena geometry, elevated starts, lessons and schedules.
- `src/game/scene.ts`: Three.js observatory, enemy models, coverage, camera and survey.
- `src/game/HelixHold.tsx`: input, lifecycle, responsive HUD, guide and controls.
- `src/game/save.ts`: arena-ID records and legacy migration.
- `qa/simulation.mjs`: source-bundled simulation checks.
- `docs/PROTOTYPES_090.md`: new optional geometry/relay experiments, precise rules and validation limits.
- `docs/CROWN_LATE_TUNE_081.md`: preserved late-wave tune, paired funded evidence and playtest question.
- `docs/DRONE_ROLES_080.md`: roles, independent Crown pricing and the historical v0.8.0 studies.
- `docs/CROWN_GROWTH.md`: original v0.7 funded growth and active-pilot evidence.
- `docs/SPLIT_CROWN.md`: original eight-wave arena, fifth route, measured contacts and historical defense trials.
- `qa/crown-trial.mjs`: funded matched defenses and ordinary-input opening.
- `docs/STASIS_REPORT_051.md`: historical live report, subsequent confirmation and diagnostic workflow.
- `docs/ARENA_CANDIDATES.md`: three measured replacement designs.
- `docs/STASIS_STUDY.md`: field diagnosis, quantified value and future geometry ideas.
- `docs/EXTENDED_DEFENSE.md`: v0.5 controls, continuation and checks.
- `docs/CARRIER_TEST_FLIGHT.md`: v0.4 experiment, measurements and deferred work.
- `docs/ARENA_NOTES.md`: geometry, timings, migration and open balance questions.
- `docs/ENEMY_REVIEW.md`: path alignment and model bounds.

`dist/` is a static build with relative asset URLs. The source is published at https://github.com/CharlesMish/helix-hold for local development and outside review. Start with [docs/REVIEW_GUIDE.md](docs/REVIEW_GUIDE.md).

The existing playable Site is hosted separately and remains private. GitHub pushes do not automatically deploy it. Its `.openai/hosting.json` belongs to the private Sites checkout and is intentionally excluded from this GitHub import; preserve that identity when working in the Sites checkout. Earlier handoff commit IDs refer to that separate source history, not GitHub commits. No hosting account or secret is needed to run the game locally.
