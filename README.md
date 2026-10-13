# Helix Hold · Sightline Lab (0.6.1)

A 3D defense game in which placement is piloting. Fly into a useful line, anchor a weaker drone there, and return to the launch cradle to build the next.

## Play

- **Plan & launch is the default.** Take unlimited time before every wave. Fly, aim, anchor and recall, then press Enter or Launch wave when ready.
- **Auto waves** is optional in the observatory or Pause menu: 12 seconds before the first wave and 8 seconds between waves. The preference is remembered. Changing it does not interrupt a wave already in flight.
- Start with 60 scrap. Drones cost 20, 32, 44, …; the first two are funded.
- **Pierce:** a long narrow beam that damages every enemy it intersects.
- **Sweep:** a shorter, wider beam that damages only its nearest target.
- Coverage highlights show potential contact with shard-sized enemies using the combat hit test. Exposure time, Sweep obstruction and Wisp weaving still matter.
- Recall the most recent drone for its original purchase price. During setup, Survey lets you select any drone and **Reposition** it for free, preserving its type, paid value and contribution. Anchor commits; Cancel keeps the old placement.
- Survey pauses the simulation and shows the whole 3D arena.
- Flight School, Shear and Split Crown are featured; Orbital remains available as an archived study. Best surviving core integrity is saved locally by campaign arena ID. The optional test flight does not write campaign scores.

**Flight School** combines two Glass Needle waves with three Twin Ribbon waves. **Shear Lane** keeps its three-route geometry with a slower short dive. **Orbital Garden** explores two recognizable tilted rings and their inward exits. After clearing Shear or Orbital’s original five waves, choose **Continue to waves 6–8** to keep your fleet, scrap and core for three authored extra waves. Your five-wave score is recorded before continuing; the extension cannot overwrite it. Flight School stays five waves and the lab stays three.

Desktop: W/S thrust/reverse; A/D or left/right arrows yaw; mouse or up/down arrows aim; Space boost; F anchor; 1/2 drone mode; R recall; Shift fan; Q/E slide; Tab survey; Tab/Shift+Tab navigate Survey controls; Esc resume from Survey or pause flight; C cancel a move; Enter launch prepared wave. Click the sky to capture mouse aim. Keyboard aiming remains usable without pointer lock.

Touch: left stick aims, right stick flies forward/backward. Fan and Slide are toggles to leave both thumbs available. Anchor and Recall sit between the sticks. Survey pauses time.

Your hull does not collide with enemies or ribbons. Lasers use a finite cylindrical hit volume with each enemy's spherical collision radius. Barges and Shards stay on their routes; Wisps deliberately drift and have faint tethers to the ribbon. This is continuous damage, not projectile simulation; see `src/game/combat.ts`.

## Split Crown

Choose **Split Crown** for eight authored waves across two separated helix districts. A/B are the west crown and coil; C/D are their eastern counterparts. They first open in waves 1/2/3/5. Gate **E** is reserved for one final carrier in wave 8. Its distinct transfer visits useful defense neighborhoods in both crowns and the lower approaches. It stays visible as a dashed route before opening.

Stasis is available from setup, with the same 6m radius, half-speed effect, normal paid slot and no stacking. Sweep uses the regular 18 DPS here. The starting 60 scrap and eight slots are unchanged. Use free selected-drone repositioning between waves. Split Crown records its own eight-wave score; earlier campaign clears and optional continuations are unchanged.

**Show eight-wave gate plan** in the observatory or Survey reveals the full authored schedule, enemy counts and first arrival time after launch for each gate. Letters and route colors distinguish A–E. Two low crown platforms mark the districts without adding collision obstacles. The floating upper arches and their support lines were removed in v0.6.1 after screenshot feedback.

`npm run trial:crown` compares funded idealized defenses and an ordinary-input opening. Shared-line layouts finish with and without Stasis; one dedicated-line layout benefits from a late field and a free carrier-wave reposition. These establish feasibility and a useful tradeoff, not human difficulty or an optimal solution. Browser visuals remain unverified in this environment.

## Optional Carrier Test Flight

Select **Stasis + carrier** in the observatory, then **Enter test flight**. Three waves use Shear’s existing geometry. Press **3** (or choose Stasis) to anchor a paid, slot-consuming sphere: 6m radius (12m across), 50% slow, no damage, no stacking. Actual enemy centers must enter the sphere in 3D. Dashed outlines show the moving preview; solid boundaries belong to anchored fields. Amber brackets mark slowed enemies. The preview readout measures route length inside the sphere, broken down by lane, not distance to enemies. Fan and Slide move it with the lattice.

The final wave sends a 486-hull carrier down the marked wide figure-eight with side-lane escorts. Damage accumulates normally; a breach costs 40 core. Sweep tries 22 DPS here only; campaign Sweep remains 18 DPS and always targets its nearest obstruction. Pierce is unchanged.

Established beams are quieter during combat; Survey, setup and lattice adjustment reveal their volumes and coverage. The active placement highlight stays prominent. Enemy fittings retain their identifying color during hits.

## Checking a field

Charlie confirms the v0.5.1 live field effect works. The earlier persistent-zero session has no established cause; diagnostics remain available. With at least one anchored Stasis drone, choose **Test placed fields** during setup. Harmless blue targets loop along every real route; amber brackets mean actually slowed. There is no damage, weapon fire, wave advance or economy change. Only placed fields are shown. **End check** returns to the original setup.

The field counter retains how many enemies have ever been affected in this flight (or check), alongside current slowed count. **Save field report** downloads game coordinates, build and membership/speed state for diagnosis. It sends nothing externally. Survey lists each selected anchored field's route coverage.

The observatory links the implemented Split Crown route chart and the earlier three-arena concept sheet. Counterweight and Braided Reach remain studies.

## Development

```sh
npm ci
npm run dev
npm run build
npm test
```

`npm test` runs 43 deterministic simulation, revision, field-check and Split Crown checks, including manual/automatic pacing, paused launch, group-specific speeds, hit geometry and real-input opening trials. `npm run test:geometry` checks solid enemy bounds and exact field boundary radius; `npm run trial:carrier` runs funded encounter feasibility trials; `npm run study:sweep` compares matched synthetic Wisp cases. `npm run study:stasis` compares field strengths and local value; `npm run trial:continuation` checks funded eight-wave feasibility. `npm run qa` is a browser suite for a separately running preview, subject to the environment's browser policy (see `qa/check.mjs`). It is not run by the build.

### Verification for this revision

- TypeScript and production build checked as part of publication.
- All 43 simulation, revision, field-check and Split Crown checks pass.
- Geometry calculations place every opening gate inside desktop and 390×844 portrait camera views.
- Enemy solid vertices fit their collision spheres; sampled Barge/Shard centers remain exactly on their paths.
- Score migration preserves Shear across reordering and archives original Needle/Twin records.
- Funded idealized layouts establish carrier and eight-wave feasibility. Optimized five-drone layouts also clear the extensions without reinforcement: the added waves provide authored variation, not a proven harder strategic tier. These are not human playtests.
- Browser suite and final appearance: **not executed for this revision**. The managed Sites environment lacks the required browser-control capability. Source and mathematical checks do not replace visual or human playtesting.

## Source map

- `src/game/sim.ts`: pure-step flight, waves, drones, economy and seeded enemy motion.
- `src/game/combat.ts`: weapon specs, finite cylinder contact and nearest/all target selection.
- `src/game/paths.ts`: arena geometry, elevated starts, lessons and schedules.
- `src/game/scene.ts`: Three.js observatory, enemy models, coverage, camera and survey.
- `src/game/HelixHold.tsx`: input, lifecycle, responsive HUD, guide and controls.
- `src/game/save.ts`: arena-ID records and legacy migration.
- `qa/simulation.mjs`: source-bundled simulation checks.
- `docs/SPLIT_CROWN.md`: eight-wave arena, fifth route, measured contacts and funded defense trials.
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
