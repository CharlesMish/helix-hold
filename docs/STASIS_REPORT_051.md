# Stasis persistent-zero report — v0.5.1

**Latest playtest, October 12 (v0.5.1):** Charlie confirms Stasis works and no longer reports a persistent zero. Whether a refresh or another change explains the earlier session remains unknown. Further balance evaluation moves to the longer Split Crown arena in v0.6; retain the diagnostics. The investigation below is the historical checkpoint.

Charlie reports an entire Stasis fleet showing zero slowed enemies even while apparently covering the routes. This is an unresolved live report, not a settled balance issue. Do not describe v0.5.1 as fixing its cause.

## Evidence

The latest Site source was opened at `0cb742ef9f1b6967b2d3c7980b68c17f76bf9a69`. In source reproduction, normal paid 20+32-scrap placements through the actual anchor input slowed the authored opening enemies: up to six simultaneously, with 178 positive HUD samples at 10Hz. At five seconds the first enemy had travelled 15.11m, compared with 24.02m without fields. The all-Stasis eight-drone diagnostic also registered contacts on every authored wave; that case explicitly uses extra scrap and is not an economy trial. Reproduce with `npm run test:stasis-repro`.

These tests exercise simulation, placement and HUD source calculations. They do not reproduce Charlie's browser, actual placements, input history, rendered scene or loaded build. Approved browser control is unavailable in this environment; no substitute browser or preview server was used.

One real mismatch was found: newly spawned enemies initially reported full speed until their first movement update, even when inside a field. Spawn now initializes speed scale from actual membership. This one-frame correction cannot explain a persistent zero.

## Changes in this revision

- **Test placed fields**, available during setup after anchoring a Stasis drone, sends one harmless blue target around each actual route. They loop and use the real movement/field-membership calculation. Weapons, damage, wave timers, economy and scores are held. Only anchored fields are shown; the ship's unanchored preview is hidden. End check restores the setup, enemy pool, random stream and actual contact history. Flying and lattice adjustment remain available.
- The HUD shows the current slowed count, unique enemies affected during the flight/check and total field contact in enemy-seconds. A current zero also reports the nearest real enemy's distance from a placed field, or that no targets are present. An enemy passing through two overlapping fields does not accumulate contact twice.
- Survey shows route coverage for the selected anchored field, broken down by lane. This is nominal route length inside the field, not distance from the drone to the route and not a guarantee about a drifting Wisp.
- Decorative route markers no longer travel during gameplay. Setup and Survey keep them stationary and dim; combat and field checks hide them. Title-screen route motion remains.
- **Save field report** pauses play and downloads `helix-hold-field-report.json`. It includes the visible build label, phase/wave state, current and resting field centers, enemy centers, actual and expected speed scales, containing field IDs, nearest distances and contact totals. It performs no upload or external telemetry.

Stasis remains a 6m-radius sphere that reduces route travel to half speed, deals no damage, consumes a normal paid drone slot and does not stack. Campaign weapons and the lab's existing Sweep candidate remain unchanged.

## Next reproduction

1. Confirm the observatory shows **0.5.1**, enter the Stasis test flight and anchor a field. One field is enough; a full fleet is unnecessary.
2. During setup choose **Test placed fields**. Blue targets move along all three routes; amber brackets and a positive current count should appear while their centers are in an anchored sphere. The cumulative count remains positive after a target leaves.
3. If visible contact still reports zero, use **Save field report** while the target appears inside and attach the downloaded JSON. Capture the paused scene too if convenient. The report can distinguish a speed/membership mismatch from placement, stale-build, HUD or projection issues without guessing which occurred.
4. End the check to return to setup. No scrap, core, wave progress or score is consumed by the check.

The field check is diagnostic, not evidence that Stasis earns its slot. Return to that balance question only after the live effect is observable and understood.

## Validation

The six new deterministic field-check cases cover entry requirements, pause, harmless looping, immutable economy/wave state, blocked fleet mutations and launch, countdown preservation, restoration, JSON state agreement, lattice movement and correct first-spawn state. Existing 31 checks remain included in `npm test`. Geometry checks cover enemy bounds and the exact 6m field boundaries. Browser smoke tests are prepared but were not executed; DOM behavior, download interaction, layout and final in-game appearance remain unverified visually.

## Arena work

Orbital Garden remains playable through an archive entry, with its original ID, scores and continuation. Featured progression skips it. See [ARENA_CANDIDATES.md](ARENA_CANDIDATES.md) and the [plan/elevation sheet](../public/arena-studies.svg) for three measured alternatives. Split Crown is recommended for a later playable prototype; none of those routes are implemented in this revision.
