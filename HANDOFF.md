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
