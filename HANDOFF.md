# Helix Hold 0.10.0: Tripwire, Drift Frontier and a green browser suite

Started from GitHub `77632a8` (v0.9.0) on branch `claude/weekend-pass`. Work by Claude (Anthropic), with source, simulation and browser checks run in a cloud container.

**Latest request:** Charlie said the core loop felt great from the start, but the challenge was easy. It was "hard" mainly because of the eight-drone cap, which he hit less than halfway through, with no good way to scale after that. The labs exist to explore weapon variety and harder levels. He asked for ideas (weapons, maps, modes), formatting, a fixed test suite, and help building out Frontier/Crown or more drone types.

- **Formatting:** Prettier across `src/` and `qa/` (`npm run format`). The built bundle differs only in JSX whitespace text nodes.
- **Browser suite fixed and executed:** stale `.lab-option` selector, and a thrust check that assumed a fast renderer. It now runs green in headless Chromium/SwiftShader against `vite preview` and adds Tripwire, Drift and touch-portrait checks. Run with `CHROMIUM_PATH=... npm run qa` while a preview server is up.
- **Tripwire (Frontier prototypes only, key 6):** a paid first post plus a free second post up to 32 m away. Every enemy entering the strand takes 26 damage once per crossing, with a wider release volume to re-arm. It rewards cutting *across* routes, the opposite geometry from Pierce. Recall-last undoes the free second post; selected recall removes and refunds the whole strand.
- **Drift Frontier (new lab entry, index 7):** Helix Frontier's coils, but from wave 4 an announced route swings around the prism between waves, with its approach re-formed to the same port. Drones stay put. The HUD and Survey report contact lost, the swung route gets the ribbon, and the gate plan forecasts swings. Twelve waves; waves 8–12 carry 2× escalation.
- Small fixes: phone-portrait Crown lesson text no longer overlaps the gate cards; the launch cradle no longer renders as a black hexagon over route A; roster messages corrected; QA-only `__helixDebug.clear()`.

Evidence: **112 deterministic checks** (prior 100 plus 8 Tripwire and 4 Drift; roster and visual assertions updated), geometry checks, the production build, and the browser suite (83 checks). An independent code review found one real defect, now fixed: Fan/Slide could sweep strands to farm bursts, so posts now ignore the lattice and Tripwire recall is setup-only. Drift trial (`npm run trial:drift`): an idle-pilot greedy fleet that re-flies broken lines finishes at 73/100/82 core across three seeds; the same purchases never repositioned fall in wave 8; the plain Frontier control finishes at 100. Hull alone is a cliff (2.5× late makes re-fly lose during wave 11). These are feasibility results, not human difficulty. Software rendering ran at about 4 fps, so frame rate on real GPUs is still unmeasured.

Read `docs/TRIPWIRE_DRIFT_0100.md` (rules, evidence, playtest questions) and `docs/DESIGN_DIRECTIONS.md` (ranked proposals for weapons, difficulty, maps and modes).

Next playtest: in Drift Frontier, is re-flying after a swing a fresh puzzle or a chore, and is 45° too large? Every swing currently wipes 70–100% of that coil's contact. Does Tripwire find strands that cut across coils, and is it worth its price? Do waves 8–12 feel achievable but challenging with real pilot fire?

---

## Previous v0.9.0 checkpoint

# Helix Hold 0.9.0 — spatial prototypes

Started from authenticated Sites `1c85f390b01b7d3e27278ada85ab9e0f3af76e12` and GitHub `a24e5b2ac3acd4a3734ddc6c9dd38d75348a979c`. Preserve the existing owner-private Site and public repository.

**Latest request:** Charlie explicitly approved building the route-expansion prototype and Relay Lab, prioritizing interesting coils and spatial development over detailed wave balance. This is not a new v0.8.1 playtest. His question about 64 enemies concerned our application pool, not a Three.js engine limit.

- **Helix Frontier:** optional nine-wave spatial test. Three coils open on waves 1/3/6 around a holographic protected box, with separate actual breach ports. West and east have opposing winding; North Vault winds around a horizontal axis. Old routes remain active. Newly opening routes have a toggleable ribbon (G/Survey). Current-wave versus later coverage, independent prices, no fleet cap and unlimited setup remain.
- **Relay Lab:** optional four-wave A/B test with one Lumen emitter (48 scrap, 8 DPS, 40% timed slow) and cheap Relays (16 + 8 per owned). One fixed redirection shares the source's 76m range budget. Enemies block output; a second receiver stops it. Shared trace/contact geometry drives preview, combat and live link visuals. Stasis/Pin remain for comparison; Halo is absent here. Lumen/Relay reposition and refund-based re-aiming are setup-only; new paid anchors remain possible during combat.
- Both experiments sit in a separate Lab menu and never write campaign scores. The original five arenas' authored schedules/settings, including Crown's eight-wave checkpoint and optional 9–12, stay unchanged. This is not endless mode and no broad balance retune accompanies it.
- Enemy storage and corresponding Three instance buffers now grow together beyond the old initial 64. Synthetic 80-enemy spawn and 200-slot allocation checks pass without delayed schedules or random-stream changes. This is not a practical frame-rate benchmark.

The coarse Frontier probe uses one seed, finite legal idealized Pierce poses, earned purchases and an idle pilot. New B contact changes from 0 to 19.94m with one added drone; new C from 4.99 to 28.46m. Earlier drones still deal damage. The growing fleet wins at 100 core with 12 units; a control frozen after wave 2 loses during wave 5. This supports new placement opportunities, not human difficulty or optimal balance. No wave/hull search was performed.

Validation: **100 deterministic checks**, separate solid/field geometry, source-derived route chart inspection, TypeScript and production build. Shared relay geometry, blockers, range conservation, slow expiry, setup refit, prototype score isolation, original arena settings and growing render buffers are covered. Approved browser control remains unavailable; no preview server or alternate browser was used. In-game contrast, link readability, HUD fit, frame rate and human flight comfort remain unverified.

Read `docs/PROTOTYPES_090.md`, `docs/FRONTIER_GEOMETRY.json`, `docs/FRONTIER_TRIAL.json` and `public/frontier-routes.svg`. Reproduce with `npm run test:prototypes`, `npm run diagram:frontier` and `npm run trial:frontier`. Older study outputs remain historical.

Next playtest: does opening B and C create a useful new-line decision while keeping earlier defenses valuable? Separately, can the player read and enjoy the Relay's planned/powered/blocked states and free setup re-aiming? Answer those before extending survival waves or adding multi-hop relays.

---

## Previous v0.8.1 checkpoint

# Helix Hold 0.8.1 — modest late-Crown pressure

Started from authenticated Sites `e5c14b44a47af099d0686d81526a47a7a84d90b3` and GitHub `57e8ef4e81d0f36fc51645720944bd393119187f`. Preserve the existing owner-private Site and public repository.

**New human playtest:** Charlie played v0.8.0, enjoyed it, had roughly 32 drones near the end, leaked a little while setting up early and then lost no further core. The carrier traveled much farther than before but died before completing the eastern return. He wants a modest late increase that keeps pace with fleet growth, while leaving the opening comfortable. Stasis felt more useful but its value is still uncertain. Exact fleet composition and poses are unknown. This supersedes the prior checkpoint's “not yet played” statement.

- Only optional Crown waves **9–12** are tuned: total enemy hull rises about **11.6%, 13.3%, 17.5%, 13.1%**. Barges take most of the added durability. Final carrier hull rises **2,916 → 3,207.6 (+10%)**; speed and 40-core breach remain.
- Final D Barges start at 12s instead of 14, C Wisps at 18 instead of 22, A Shards at 24 instead of 30. Counts, rewards and intervals stay fixed. More convoy work overlaps pursuit without additional scrap accelerating fleet growth.
- Wisps stay at 47.52 hull throughout the extension, preserving two isolated 24-damage Pin shots. A larger apparently modest multiplier would abruptly require three. No weapon, price, cap, role, geometry, control or presentation change accompanies this pass.
- Original waves 1–8 retain their exact schedule/text hash and normal score. Unlimited setup, coverage hover, placement by piloting, free selected reposition, actual-paid recall, uncapped Crown growth and Stasis remain.

The paired study runs baseline plus hull-only A plus selected B with identical earned fleets/poses/purchase waves: 19 Pierce, 25 mixed and 33 diversified units. All nine finish at 100 core; no forced optimizer loss. The 33-unit example is not a reconstruction of Charlie's fleet. In that case B raises integrated remaining hull by 12.6–21.6% across the late waves and escort presence during the carrier from 82.9 to 110.0 enemy-seconds. Most added overlap is the D convoy; C Wisps/A Shards still take no damage before carrier death in that formation. Carrier lifetime rises only 21.98 → 23.32s there, versus 19.25 → 25.37s for 19 Pierce. Do not oversell this as a dramatic boss difficulty change.

Validation: **75 deterministic checks**, solid/field geometry, nine paired funded simulations, independent source review and TypeScript/production build. First-eight outcomes, frozen legal paid plans, score preservation and effective-damage attribution are asserted in the study. Approved browser control remains unavailable; no preview server or browser was used. This pass does not establish new visual, performance or human-difficulty results.

Read `docs/CROWN_LATE_TUNE_081.md` and `docs/CROWN_LATE_TRIAL.json`; reproduce with `npm run study:crown-late`. Older JSON files remain historical. Next playtest: do waves 10–12 give a large fleet useful work during the chase, with a smooth increase rather than a sudden wall? Observe D while pursuing and capture fleet composition before further tuning.

---

## Previous v0.8.0 checkpoint

# Helix Hold 0.8.0 — distinct drone roles and independent Crown prices

Started from authenticated Sites `c2c3e4f338b5be806bd743353823a871cccc8889` and GitHub `20243280fd9eedb0d09068318cd2885350c7b78c`. Preserve the existing owner-private Site and public repository.

**Latest request is design feedback, not a v0.7 playtest:** Charlie has not yet played the uncapped twelve-wave update. He wants buying a support type to stop raising every other type's price, clearer drone identities, a passive damage volume, and a distinct shot that applies an effect. His description of Stasis as shooting does not match its actual passive mechanics. The old shared gun silhouette and visible setup pilot beam could contribute to that reading; this is a source-based hypothesis, not a reproduced diagnosis.

- Crown alone gains **Halo** and **Pin**, alongside Pierce/Sweep/Stasis. Halo is a passive actual-3D 5m-radius sphere, 18 DPS to every enemy center inside. Pin is a fixed aimed 60m/radius1.1m line: nearest obstruction takes 24 damage every 1.6s and 35% slow for 2.4s. It is an instantaneous discrete shot with a brief tracer. Slow refreshes without stacking; Stasis's 50% slow takes precedence. No poison, global targeting, bounce or relay was added.
- Crown prices count owned units of that type: Pierce `20+12n`, Sweep `24+12n`, Stasis `32+20n`, Halo `44+20n`, Pin `48+24n`. A ninth Stasis after eight Pierces costs 32 and leaves the next Pierce at 116. Two-Pierce opening and all-Pierce curve remain identical. Other arenas retain existing rosters and shared pricing. Free Reposition and actual-paid refunds remain, including shot state and contribution.
- Five production silhouettes: fork, twin pods, round cage, radial spines, cannon+sight. Passive units have no muzzle. UI and world colors agree. Empty setup hides the pilot beam; combat is unchanged. Exact 5m/6m field boundaries and impact-local Pin tracer/slow marker accompany the shared geometry-based previews.
- Buttons 1–5 show own-type quote/count. Selection refreshes price, affordability and preview together. Portrait Crown has a 3+2 roster with a bounded scrolling placement panel. Stasis diagnostics are explicitly Stasis-only; Halo/Pin attacks are held, Halo field visuals are hidden in that check, and Pin slow does not inflate Stasis counters.
- No authored waves, geometry, existing beam stats or carrier hull were retuned. The uncapped fleet, eight-wave score checkpoint, optional 9–12, default manual setup and active aiming highlight remain. Current trial scripts use current quotes; older JSON stays historical and is reproduced at its documented source commit.

Validation: **75 deterministic checks** (prior 58 + 8 role + 5 economy + 4 presentation), solid/field geometry, TypeScript/production build, browser-script syntax and independent source review. Allocations now exercise 40 visual slots and 4,101 coverage segments. The actual model roster was CPU-projected, rasterized and visually inspected as a diagram; this is not an in-game screenshot. Approved browser control remains unavailable, so no preview server or browser was used. Live contrast, distant recognition, touch layout and large-fleet performance remain unverified.

Nineteen local diagnostic cases use real Crown curves, fixed budgets and an idle pilot. Halo-only crossing/core defense is weak; adding Stasis improves local contact, but beam alternatives remain competitive. Pin helps isolated targets and loses to Pierce in a tight convoy. The funded twelve-wave mixed case reaches the finale with 17 Pierce / 2 Stasis / 4 Halo / 2 Pin, finishes at 100 core with automated pursuit, and intercepts the carrier after 22.70s / 38.1% of E. Both new roles contribute; the chase is longer than the 19-Pierce active control at 19.25s. Idealized placement, one seed and perfect-state pursuit are not human balance measurements. These cases did not justify increasing old waves.

Read `docs/DRONE_ROLES_080.md`, `docs/DRONE_ROLE_STUDY.json` and `docs/CROWN_ROLES_TRIAL.json`. Run `npm run study:drone-roles` and `npm run trial:crown-roles`. `public/drone-roster.svg` is regenerated by `npm run diagram:drones` from actual meshes.

Next playtest: does a cheap first specialist feel worth adding without dismantling the fleet, and are passive fields distinguishable from Pin and the pilot gun? Try a Halo/Stasis bottleneck and a Pin line separately. Pin's 48-scrap entry price and Halo's compact coverage remain the main value questions; test them before extending the roster again.

---

## Previous v0.7.0 checkpoint

# Helix Hold 0.7.0 — Crown growth and the long flight

Started from authenticated Sites `85595089c74a52204a63551731d5ddbf2027ac18` and GitHub `3a0d5120cc379696d18282d68721fa22e6c3f2ad`. Keep the same owner-private Site and public source repository.

**Newest human playtest:** Charlie confirms he played Split Crown before the v0.6.2 corrections. He enjoyed it, hit eight drones early, wanted to add a ninth Stasis without dismantling his defense, and destroyed the carrier too near E's entrance while actively pursuing it. He suggested scrap-funded growth and 10–12 waves. The previous checkpoint's missing-transcript note is superseded by this direct replacement report.

- Crown alone grows without a fixed drone cap; ordinary `20 + 12 × owned` purchase prices and 60 starting scrap remain. Perfect earnings fund eight after wave 4 and fifteen after wave 8. Other arenas retain eight. Free setup Reposition and actual-paid Recall remain; the UI explains these alongside the next purchase price.
- The first eight Crown authored waves are protected by an exact schedule hash from the starting source. Routes and weapon values stay unchanged. Larger fleets can make these waves easier. Wave 8 remains a 486-hull carrier checkpoint and writes its normal score.
- After that win, the player may keep the fleet, core and scrap for four authored waves 9–12. Upper/lower convoy pressure changes by wave; E rests until the final carrier. Continuation returns to unlimited manual setup, can start only once and cannot overwrite the eight-wave record after win or loss.
- The optional wave-12 carrier has 2,916 hull, normal cumulative damage, unchanged speed and a 40-core breach. New Barge groups have local hull multipliers. No immunities, contact resets, weapon changes or forced Stasis. The gate plan exposes the optional schedule and the setup lesson warns about the stronger carrier.
- Drone/beam/shell/ring/field visuals and coverage buffers grow with demand. The active preview is retained beyond the old 4,096-instance coverage capacity. Superseded instance buffers are disposed.

The active-pilot study explains the short original encounter: one historical shared-line eight-drone fleet plus ordinary-input automated pursuit kills the carrier at 5.23s / 12.6% of E. The actual growth trial reaches 13 drones at the eight-wave checkpoint and 19 before wave 12 with earned scrap. A 19-Pierce idle fleet finishes at 60 core after the final carrier breaches with about 352 hull; active pursuit finishes at 100 core, intercepting at 19.25s / 46.3% of E. A 17-Pierce/two-paid-Stasis active case finishes at 100 core, 20.63s / 39.7%. Both reach the east crown. Setup poses are idealized; pursuit has perfect state knowledge and 100% contact in these cases. These are feasibility measurements, not human balance or win rates.

Validation: **58 deterministic checks** (the prior 51 plus five growth/continuation and two actual Three allocation checks), enemy/field geometry, unchanged byte-for-byte historical eight-drone Crown trial, bounded pilot and funded twelve-wave studies, browser-script syntax, TypeScript and production build. Rendering tests exercise 24 visual slots and 4,101 highlight segments without WebGL. Approved browser control remains unavailable; no preview or alternate browser was used. UI appearance, practical large-fleet performance and human pursuit difficulty remain unverified.

Start with `docs/CROWN_GROWTH.md`. Reproduce `npm run study:crown-pilot` and `npm run trial:crown-growth`; recorded outputs include `CROWN_PILOT_STUDY.json`, `CROWN_GROWTH_TRIAL.json` and the fixed-fleet 5×/6×/8× hull comparison. Earlier eight-drone trial outputs remain historical comparisons, not the new maximum fleet.

Next playtest: does purchasing a ninth or later field feel like extending a working defense, and does the final chase use both districts without feeling like a health sponge? Check side-lane pressure while pursuing. Keep the experiment focused before adding relays, another drone type or further waves.

---

## Previous v0.6.2 checkpoint

# Helix Hold 0.6.2 — outside-review corrections

Authenticated the matching v0.6.1 sources: GitHub `91bacf0108543ad6bce002363bc5f5ef65b6dfeb` and Sites `7a51eeea27b8e133356a69b2b7731dff9c107355`. Preserve the same private Site and public source repository. Charlie supplied Claude's executed review, Grok's source-only review and a portrait Survey screenshot. No later completed Split Crown playtest transcript was found; earlier Stasis feedback remains available.

- Fixed a real portability flaw in the historical test, not changed campaign geometry. Node 24's alternate exponentiation implementation changes exactly the reported two hashes by at most 1.42e-14 m. The historical fixture retains all original integrity hashes; authored settings compare exactly and geometry within 1e-6 m. Node 20–22 were not directly available.
- Enter ends the active field check without launching. Pointer lock cannot also activate an old focused button. The shortcut is visible in the HUD and guide.
- Portrait Survey and gate cards now share grid flow; D/E are above the scrolling card. Compact launch labels stay on one line. No post-change browser verification is claimed.
- Crown's main coverage number/bar now track this wave's pending/live routes, with future coverage separate. Every hover segment stays available. A finite 1,454-pose comparison improves top-ranked Gate-A contact from 8.475 to 22.932 m; this is not a player outcome or damage result.
- Browser QA now polls state/HUD and has prepared keyboard-exit/portrait desktop+touch assertions. Barge gold pixels/screenshots are diagnostic evidence, not an uncalibrated visibility pass. Revised browser suite was not run here.
- Corrected the interpretation of the original Stasis trial: its fleets refitted different units. With the same refit, both win (37 core Pierce, 46 Stasis). No weapon/economy/geometry tuning was made.

Validation: 51 deterministic checks, solid/field geometry, the 8 Crown checks under alternate exponentiation, unchanged original Crown trial output, two bounded studies, TypeScript/build and browser-script syntax. See `docs/REVIEW_FOLLOWUP_062.md`, `docs/CROWN_COVERAGE_REVIEW.md`, `docs/CROWN_STASIS_TRADEOFF.md` and `qa/fixtures/README.md` for evidence and limits. Approved browser control is still unavailable in this managed environment.

Next playtest: does this-wave/later coverage guide the first two anchors onto A without losing the pleasure of planning a shared slice for later? Check portrait Survey and Enter-to-end during that visit. Avoid further stat changes until that feedback.

---

## Previous v0.6.1 checkpoint

# Helix Hold 0.6.1 — decorative cleanup and GitHub source

Charlie’s screenshot identifies the detached shallow arches above Split Crown. They were six decorative crown facets at heights 39–41m plus six faint dashed supports. Removed that loop from `buildSplitCrownArchitecture`; retained both floor platforms and their segmented rings/ticks. Routes, gate labels, collision, fields, coverage previews, waves and balance are unchanged.

Current source is being imported into the existing `CharlesMish/helix-hold` public GitHub repository, which was verified empty. The existing playable Site remains private. The public source includes game code, assets, tests and design notes; private Sites hosting identity and generated output are excluded. `docs/REVIEW_GUIDE.md` is the starting point for outside review. Earlier source SHAs in this history belong to the separate Sites repository.

Validation: screenshot-to-source identification; existing 43 deterministic checks, solid/field geometry and build/typecheck. No new gameplay tests were added for removing decorative meshes. Approved browser control remains unavailable, so a post-change game screenshot is not claimed.

---

## Previous v0.6.0 checkpoint

# Helix Hold 0.6.0 — Split Crown playable

Latest playtest: Charlie confirms Stasis now works in the live game; the earlier persistent zero no longer appears. Cause remains unestablished (refresh is only a possibility), so retain the check/report tools without continuing to describe an active reproduced failure. Charlie approved the Split Crown direction and suggested a fifth late carrier route that makes use of both districts.

Opened latest Site source at `aebe847e4388e2135f1b9039369c82d64787bfea`. Preserve the existing owner-private project and audience.

## What changed

- **Split Crown** is a new stable `split-crown` campaign entry, appended after existing indices. Eight authored waves, 124 enemies, four ordinary gates opening on waves 1/2/3/5, and a fifth carrier gate E only on wave 8. Its 167.59m transfer passes through real neighborhoods of both upper/lower pairs; the carrier has the existing 486 hull and 40-core breach cost. No immunity, contact-reset armor or required slow.
- Stasis is enabled independently of `experiment`, so Crown has ordinary campaign scores and the existing half-speed/6m field. Sweep remains 18 DPS here; only the three-wave lab uses 22. Starting scrap 60, eight slots, costs and free selected setup reposition remain unchanged.
- Gate letters A–E, distinct route colors, opening-wave labels, and shared dormant/upcoming/active/cleared forecasts. E remains a faint dashed path until its final-wave setup. The full authored gate plan is available in title/Survey, with counts and first spawn times measured from launch. Potential coverage explicitly includes dormant routes.
- New restrained crown architecture marks west/east districts. All solid landmarks stay below the flight floor. Split-specific portrait title framing and camera-distance-adjusted title/Survey fog keep the distant arena from vanishing into the old fog window. Flight fog and older arenas are unchanged.
- Crown has its own saved score after wave 8. Existing tutorial, Shear, Orbital archive, lab and optional three-wave continuations retain their geometry, schedules, identities and results. Featured progression now goes Flight School → Shear → Split Crown, with the lab still optional.

## Validation and meaning

43 deterministic checks pass (22 simulation, 9 revision, 6 field-check, 6 Crown), plus solid enemy/field geometry. Crown checks include old authored-source hashes and independent score persistence. The ordinary-input opening uses automated steering/thrust/anchor, no teleporting or bonus scrap; it clears 6/6 at 100 core, ends with 56 scrap and has zero pilot-hit frames.

Eleven deterministic longer trial cases use finite idealized candidate placements, normal earned purchases, up to eight slots and one setup reposition. Shared-line fleets finish at 82 core with and without a late field. One dedicated-line fleet narrowly leaks the carrier without a field and wins at 46 core with a seventh-slot field. One free final-wave reposition cuts that fleet's E-carrier remaining hull from about 207.7 to 5.7. The carrier on A instead reaches core with about 91.7 hull for the same fleet; this supports E reusing previous defenses. One sampled core-heavy strategy fails, but no optimality claim follows. Early third-slot Stasis can be a poor trade before covering the active gates.

Typecheck and production build are part of publication. Approved browser control is unavailable; no preview server or alternate browser was used. Mathematical camera/fog checks cover desktop and portrait with all routes/labels fitting, but final UI layout, visual contrast and human flight difficulty remain unverified. Prepared browser checks are not claimed as executed. The route diagram was rasterized and inspected independently.

Details: `docs/SPLIT_CROWN.md`, `docs/SPLIT_CROWN_TRIAL.json`, `public/split-crown-routes.svg`. Reproduce comparisons with `npm run trial:crown`.

## Next useful playtest

Does a useful shared line keep earning its slot after the eastern gates open, while a free local reposition helps where the defense is weak? By wave 8, does E feel like a test of the fleet you built, and does a late Stasis field visibly help without feeling mandatory? Judge the longer map before adding more drone types, a larger radius, endless play or blanket stat scaling.

---

## Previous v0.5.1 checkpoint

# Helix Hold 0.5.1 — unresolved live Stasis report

Charlie reports an entire Stasis fleet still showing zero while apparently covering the lanes. **The persistent-zero report has not been reproduced or explained. Do not claim it is fixed.** Latest source was opened at `0cb742ef9f1b6967b2d3c7980b68c17f76bf9a69` before this pass.

## Evidence and response

- Real `step(anchor)` placements with normal 20+32 scrap purchases on the active first route register up to six slowed enemies and 178 positive HUD samples at 10Hz; first enemy distance at 5s is15.11m versus24.02m without fields. Eight normally anchored fields across all routes (explicit extra-scrap diagnostic) register contacts on all three authored waves. This is source/simulation evidence, not a reproduction of Charlie's live browser state.
- Found and corrected one real first-spawn-frame mismatch: speedScale now initializes from actual membership. It cannot explain sustained zero.
- Decorative route motes previously moved independently even during setup/pause. They now move only on title, remain stationary/dim in setup/Survey, and are hidden during combat and field checks. This removes a potential source of confusion without assuming it was the cause.
- New **Test placed fields** during setup sends harmless blue targets through all actual routes using the same movement/membership calculation. They loop; weapons, wave timers, damage, scrap and score writes are held. Only anchored fields are shown, not a moving preview. End check returns to setup and restores actual contact history.
- Live counter now retains unique affected-enemy count and total enemy-seconds of field contact after enemies leave. Zero current contacts also reports nearest real-enemy distance. Survey shows per-lane coverage of the selected anchored field.
- **Save field report** downloads local JSON with visible build label0.5.1, phase/wave, field and enemy positions, expected/actual slowdown and nearest distances. No upload or external telemetry. If zero persists, this captured state is the next missing evidence.
- Stasis remains half-speed/6m; no further strength or range change. Campaign weapons remain unchanged.

## Arena direction

Orbital is moved out of the featured list to an archive button; its stable ID, routes, scores and continuation remain intact. Main progression skips it. Three measured concepts are in docs/ARENA_CANDIDATES.md and public/arena-studies.svg, linked from the observatory. Split Crown is recommended: four gates across two helix districts. **Concepts only, no replacement arena implemented.**

## Verification

37 deterministic checks (22 simulation,9 revision,6 field-check), geometry checks and source reproduction pass; production build/typecheck during publication. Browser smoke tests are prepared but not executed because approved browser control remains unavailable. Runtime input/DOM/visual behavior is still a material verification limit. The standalone SVG/PNG concept sheet was rendered and inspected separately; that is not game visual QA.

---

## Previous v0.5 checkpoint

# Helix Hold 0.5 — visible Stasis and extended defense

Latest feedback: Charlie enjoys the core game, finds Stasis too subtle to earn a damage-drone slot, and wants more room to develop a defense after five waves. Source opened fresh at `d069096e5b54f0d6ccc7d353df5a85ce533cd6b9` before this revision. Preserve existing owner-private Site identity/audience.

## Current revision

- Stasis radius was already correctly 6m in rendering and simulation. The brighter moving preview and unclear total-route-length readout could mislead. Now preview is dashed/unfilled, placed fields solid, actual occupants brighten their field and get amber brackets. UI states radius6m/across12m, labels preview route length and breaks it down by lane. Live slowed count remains visible even with a damage mode selected.
- Half-speed Stasis (50% slow) is the next lab-only candidate. Cost, slots, radius, no damage and strongest-only actual3D membership are unchanged. Wisp travel along the route is slowed; its existing weave remains time-driven. Campaign Sweep18 and lab Sweep22 remain untouched, as does Pierce.
- Shear and Orbital offer three authored waves after the existing five-wave win has been recorded. Continue retains fleet, scrap and core, begins manual setup, and cannot overwrite campaign scores. Tutorial5/lab3 remain unchanged. No global map enlargement or endless escalation.
- Setup Survey now selects any existing drone. Reposition reuses the unit, preserving mode, paid value, DPS and contribution, including at eight slots. It starts the pilot at that unit's resting position/aim; fly and Anchor to commit, or Cancel to preserve its old placement. Fan/Slide reset on pickup and remain available during placement. Automatic/explicit launches wait during a move. Selected Recall refunds actual paid value; old last-in Recall remains.
- Survey Tab/Shift+Tab navigates its buttons; Esc or Resume exits. Selection is marked cyan during setup.

## Evidence and limits

31 deterministic simulation/revision checks pass. Geometry verifies solid enemy bounds and both preview/anchored field boundary vertices at exactly6m. Browser tests have been updated but not executed: approved browser control is absent, so no preview server or alternative browser was used. Final contrast, HUD fit and human playability still need visual testing. Build/typecheck are run for publication.

The strength study explains why30% felt weak: about0.49s extra travel on a normal Shard's full12m chord. Half-speed is more noticeable, but still loses to another well-placed Pierce in the sampled dedicated-line comparisons. This is a candidate, not settled balance. Details: docs/STASIS_STUDY.md.

Funded idealized five-drone layouts finish both eight-wave arenas at100core/113kills. Three earned reinforcements also succeed. These optimized placements establish feasibility, not a harder tier or player difficulty. Original campaign waves, paths and multipliers are preserved. Details: docs/EXTENDED_DEFENSE.md.

## Next observation

Can the user now tell exactly which enemies the anchored field is slowing, and does half speed earn the slot? Do three further authored waves provide enough time with the fleet, or do optimized defenses need a new spatial problem? Keep relay, larger arena and alternative attack shapes as separate studies. Do not add every idea together.

---

## Previous v0.4 checkpoint

# Helix Hold 0.4 — optional carrier test flight

Current review: 2026-10-12. Opened latest remote source at `6b20f06e1148df56dd7aaa5a67afafc3b6b0f634` before editing. Keep the existing Site identity and owner-private audience.

## Current changes

- Readability: quieter established beams; full beam volumes and established coverage shown during setup, Survey or Fan/Slide. Active placement coverage remains prominent. Enemy fittings retain color when hit, Wisps use pink, and hulls receive a slight kind tint. Existing contact effects remain.
- Separate optional `carrier-test` encounter uses Shear geometry over three waves, with a durable carrier on route 2 (wide figure-eight) and ordinary escorts. It never writes campaign clears or scores. Normal campaign waves and stats are unchanged.
- Stasis is experiment-only: paid normal escalating drone cost, one of eight slots, radius 6m, speed ×0.7, no damage, strongest-only overlap. Membership uses actual enemy xyz, including Wisp drift. It moves with Fan/Slide and preserves ordinary last-in refund behavior. No core exclusion.
- Sweep is 22 DPS only in this experiment; normal Sweep remains 18. Radius, range, nearest-target selection and Pierce remain unchanged. No sticky targeting.
- Carrier is ordinary cumulative health: 450 base ×1.08 = 486 hull, 4.2m/s, collision radius 2.2, reward 60, breach 40. Carrier outcome is explicitly shown even if the core survives a breach.
- Unlimited manual setup remains the default. Existing flight, aim, anchor and recall inputs remain.

## Validation and limits

Twenty-two deterministic simulation checks pass, including true-3D field boundaries, non-stacking, entering/leaving, no field damage, fan/slide placement agreement, refunds, carrier damage/breach and campaign-score isolation. Solid model bounds pass for all four kinds. Production build is checked during publication.

Two funded five-drone idealized layouts finish with 100% core, 29 kills and carrier intercepted, one with Stasis and one damage-only. These use setup teleports to reachable poses and an idle hangar pilot, not ordinary player piloting. Matched synthetic Wisp trials support testing 22-DPS Sweep but do not establish a global balance change. Details and reproducible commands: `docs/CARRIER_TEST_FLIGHT.md`.

The browser suite has an optional-flight smoke test but was not executed: the managed Sites environment lacks approved browser control. No alternative browser or preview server was launched. Readability, HUD layout and human flight difficulty remain unverified visually.

## Next useful observation

Does placing Stasis near a useful real crossing feel worth its scrap and damage-drone slot, while dedicated long-contact lines remain rewarding? Also check whether enemy type colors remain readable during a busy wave and whether Sweep feels useful against strays.

## Deferred requirements

Do not add endless or mirrors on top of this encounter. Before longer play, selected setup-only Reposition must reuse the existing unit and preserve mode/paid value. At eight slots, recalling the original 20-scrap drone and buying the 104-scrap replacement taxes a move by 84; this must not masquerade as repositioning. Selected Recall must refund actual paid value. A later continuation should be optional after recording victory and have authored variation. Relay study: one bounce, conserved remaining range/DPS, no splitting/loops/double damage, broken-link previews during Fan/Slide.

---

## Previous v0.3 checkpoint

# Helix Hold 0.3 — deliberate setup

## Intent preserved

Placement is piloting. The player's ship is stronger than each drone; useful weaker lines are affordable early. A drone does not auto-aim or follow enemies. Fan/slide transform the anchored lattice and relax to stored positions when released. The user particularly enjoys the coverage hover and Shear Lane's spatial challenge.

## This revision

- Manual wave launch is the default, with unlimited initial/interwave flight and placement. Enter and the visible Launch wave button send one wave. Active waves cannot be skipped.
- Optional Auto waves is available in the title/Pause menus and remembered locally. It gives 12 seconds initially and 8 seconds between waves; switching into auto during setup grants the full window. Pausing freezes both modes.
- Flight School combines two Glass Needle waves and three Twin Ribbon waves. Its lower coil remains dim until wave-three preparation. Tutorial coverage previews only announced routes, so an unintroduced route cannot produce misleading positive feedback.
- Shear Lane geometry is unchanged. Dive shards use a local 0.55 speed multiplier: 7.67 seconds over the whole route instead of 4.22. Other lanes retain their speeds.
- Orbital Garden adds two opposing tilted ellipses with explicit inward exits to the core, over five waves.
- Enemies now use pearl/slate darts, armored seedpods and Wisp petals with colored fittings. All solid model geometry fits its collision sphere. Only Wisps drift; faint tethers point back to their nominal ribbon position.
- ID-based save migration preserves Shear scores after reordering, archives original Needle/Twin scores, and retains the original v1 key. No old score is assigned to a different new arena.

Economy, beam stats and combat geometry are unchanged: starting 60 scrap; drone prices 20 + 12 × count; Pierce 20 DPS / radius 1.45 / range 76 / all contacts; Sweep 18 DPS / radius 2.5 / range 38 / nearest; player 34 DPS / radius 2.05 / range 76 / all contacts. Recall refunds the last drone's paid price. Coverage samples the same combat hit geometry with Shard radius 0.72; it is potential contact, not guaranteed damage.

## Evidence and limits

Simulation checks cover collision, contribution accounting, placement transforms, refunds, manual waits, automatic-mode transitions, pause safety and local speed modifiers. Source geometry checks cover every path endpoint and opening camera framing at 1280×800 and 390×844. Save migration and renderer solid bounds were separately checked.

The unchanged first two tutorial waves were tested with ordinary flight inputs and no teleport, extra currency or stat overrides: idle pilot 9% core / 0 kills; two short crossing lines 86% / 11 kills; two longer aligned lines 100% / 12 kills. This is an opening comparison only.

Full-arena feasibility trials used **idealized placement teleports during unlimited setup**, to reachable points, with real earned currency and an idle pilot. All three arenas could finish at 100% core: Flight School 38 kills, Shear 53 kills, Orbital 45 kills. These results bound feasibility; they do not establish human difficulty or prove that a player can easily find those lines. After the tutorial's first two waves, the successful opening had 114 scrap before buying the 44-scrap lower-coil drone.

For Shear's opening, an ordinary-input maneuver (short forward flight, small left turn, coast, anchor) produced a Pierce that killed all 6 shards at the new speed and none at the old speed, with the same placement. Pilot fire was removed from that comparison. The idle hangar pilot also clears the slower first wave by itself, but loses without drones by wave 3. This forgiving first wave is intentional for now; avoid tightening it before another user playtest.

**The browser suite has been updated but not run for 0.3.** The managed Sites environment lacks its required control-browser skill; no server or alternate browser was launched. Geometry/source checks are not visual QA. The previous unmodified upload's screenshots do not validate these visuals.

## Next useful observations

1. Can the user linger over coverage before intentionally launching?
2. Does wave-three setup make the tutorial's lower gate obvious?
3. Is Shear's short dive now readable without losing its character?
4. Do the refined bodies remain recognizable and easy to see against the observatory?
5. Do Wisp tethers clarify drift without looking like targeting beams?
6. Do Orbital Garden's tilted rings create satisfying shared lines?
7. On phone, check title scrolling, top launch button and two-thumb controls in portrait/landscape.

## Invariants

- Keep simulation separate from rendering; combat and coverage use the same contact test.
- Keep dynamic instanced populations safe when initially empty (currently frustumCulled=false).
- A increases yaw and turns left under the chase camera.
- Fixed 60 Hz steps and per-run seeded randomness remain.
- Scores use stable IDs (`tutorial`, `shear`, `orbital`), never list positions.
- Preserve the existing Site identity and current private audience.
