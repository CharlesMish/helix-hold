# Arena revision: a combined school and orbital routes

## Active arenas

The arena order is now:

| Index | Stable ID | Name | Waves |
|---|---|---|---:|
| 0 | `tutorial` | Flight School | 5 |
| 1 | `shear` | Shear Lane | 5 |
| 2 | `orbital` | Orbital Garden | 5 |

All arenas remain available for selection. Array positions are no longer score identities.

### Flight School

The old Glass Needle and Twin Ribbon introductions are combined into one shorter sequence. The first two waves and the main curling route are unchanged from the previous Glass Needle opening. They introduce a sustained firing line and then a durable barge. The next three waves activate a complementary lower coil, requiring the player to divide coverage between two routes.

The main curl remains 102.95 m long and begins at height 21 m. The lower coil is 66.51 m long and begins at height 15 m. Its entrance and much of its route lie below the original strong firing line, so the second lesson adds a spatial coverage problem. It does not simply repeat the opening on the same line.

`WaveSpec.chapter` identifies the first two waves as **Glass Needle** and the final three as **Twin Ribbon**. `WaveSpec.lesson` supplies concise wave-specific guidance. These are metadata for the interface, not a second source of wave logic. The five-wave sequence contains 38 enemies, compared with 81 across the previous separate four-wave Needle and five-wave Twin schedules.

### Shear Lane

The liked geometry and starting position are preserved: a compact dive, a medium coil, and a descending figure-eight. The wide loop passes through the same plan coordinates `(5, 0)` at heights 24 m and 14 m. It is a 10 m height separation, not a physical junction.

The compact dive was too urgent. Its geometry is unchanged; each scheduled shard group on that route now has `speedMul: 0.55`. This multiplier combines with the arena and enemy-kind speed only for that group. The other routes retain their previous speeds.

Measured full-route transit for a shard on the 43.89 m dive:

- Before: `43.89 / 10.4` = **4.22 seconds**.
- After: `43.89 / (10.4 × 0.55)` = **7.67 seconds**.

The simulation leaks an enemy slightly before the exact final sample, so observed spawn-to-breach time is about 0.06 seconds shorter after the change. This remains a compact route with a clear defensive role, while giving substantially more reaction time.

### Orbital Garden

The third arena uses a recognizable pair of opposing tilted ellipses around the core. Each route follows 324 degrees of its ellipse, then takes a cubic inward transfer to the core. Those inward sections make the route endings explicit; the enemies do not orbit forever or jump from a closed ring into the core.

The inner ellipse has horizontal radii 16 m and 12 m and tilts upward in one direction. The outer ellipse has radii 23 m and 18 m and tilts the other way. Their heights range roughly from 8 m to 29 m before the final inward approaches descend to the core. Five waves introduce the inner route first, then the outer, before combining them. There are only two gates.

The design hypothesis is that the familiar ring form should make repeated arcs and potential shared firing lines easier to recognize, while the opposing tilts preserve a reason to move and inspect in three dimensions. That hypothesis still needs player testing.

## Enemy roles

The pass retains the existing three enemy types:

| Type | Base health | Base speed | Role |
|---|---:|---:|---|
| Shard | 28 | 10.4 m/s | Fast, fragile; exposes gaps |
| Barge | 96 | 6.0 m/s | Slow, durable; needs sustained damage |
| Wisp | 40 | 8.2 m/s | Weaves away from the route centerline |

Arena health and speed multipliers still apply. Optional group speed multipliers provide local pacing where a route's length calls for it. Wisps do not exactly follow the highlighted ribbon; centerline coverage is a useful preview, not a guarantee against their whole motion envelope.

## Geometry measurements

Lengths are measured from the sampled curves used by the simulation. Transit times assume no weapon damage. They include the active arena multiplier and, for Shear's dive shards, the new group multiplier. Barge transit on the dive is omitted because barges are not scheduled there.

| Arena / route | Length | Shard transit | Barge transit |
|---|---:|---:|---:|
| Flight School / main | 102.95 m | 11.51 s | 19.95 s |
| Flight School / inner | 66.51 m | 7.44 s | 12.89 s |
| Shear Lane / dive | 43.89 m | 7.67 s | — |
| Shear Lane / main | 85.65 m | 8.24 s | 14.27 s |
| Shear Lane / shear | 144.62 m | 13.91 s | 24.10 s |
| Orbital Garden / inner orbit | 106.50 m | 10.89 s | 18.88 s |
| Orbital Garden / outer orbit | 151.19 m | 15.47 s | 26.81 s |

The source geometry uses 160–240 intervals per path. Existing Needle and Shear curves were retained, and the two new orbital routes use 220 and 240 intervals. All sampled coordinates are finite, distance arrays strictly increase, and every route ends at the existing core `(0, 4.4, 0)`. All samples remain inside the flight bounds: radius below 52 m and height between 1.6 m and 44 m.

The camera framing check used Three.js projection math, not browser screenshots: chase distance 10.8 m, camera lift 2.65 m, look-ahead 8 m plus 0.45 m lift, 60-degree vertical field of view. Every opening gate projects inside both a 1280×800 view and a 390×844 portrait view. Portrait normalized coordinates are:

- Flight School: `(-0.463, 0.012)`.
- Shear Lane: `(0.134, 0.023)`.
- Orbital Garden: `(0.084, 0.019)`.

The visible clip square runs from -1 to +1 in each axis. These calculations verify opening framing. They do not establish contrast, HUD clearance, visual recognition, or comfort on a phone.

## Save migration

The old save format associated scores with array positions. That would incorrectly assign a prior Twin score to Shear after reordering and a prior Needle score to the new tutorial.

The new `helix-hold-v2` record has:

```ts
{
  version: 2,
  bestByLevel: Record<string, number>,
  legacyBestByLevel: Record<string, { name: string; bestCore: number }>
}
```

Current scores use `tutorial`, `shear`, and `orbital`. Migrating an old `helix-hold-v1` record:

1. Archives all three original values under named `needle`, `twin`, and `shear` records.
2. Copies the existing Shear score into the current `shear` record because its arena identity is retained.
3. Leaves `tutorial` and `orbital` unplayed (`-1`), regardless of previous Needle/Twin results.
4. Writes the new v2 record and leaves the original v1 key untouched.

`recordWin` accepts a level ID rather than an index. Records remain monotonic: a lower later score does not replace a higher one. The legacy archive remains unchanged when current scores improve. All arenas are available, so an old numeric unlock position does not gate the reordered list.

Checked migration example: old scores `[82, 91, 73]` become current `{ tutorial: -1, shear: 73, orbital: -1 }`, with the original three scores retained in named legacy records. Additional assertions covered reload round trips, monotonic wins, malformed-v2 fallback to a valid v1 record, and unavailable browser storage.

## Evidence limits and follow-up

The statements above come from source inspection, geometry calculations, and deterministic automated checks. They are not human playtest results.

Prior positioned trials on the old single-lane Needle found that a precise entry-tangent Pierce could nearly clear that arena alone, while a transverse line could kill no enemies without pilot support. That result motivated keeping the useful opening lesson but adding a second, lower route in the latter half of Flight School. The old whole-arena result does not establish the balance of the revised five-wave tutorial.

Preparation and inter-wave waits are now controlled by the player by default. Old fixed-duration arena estimates are therefore no longer presented as current session lengths. Optional automatic wave timing is a separate simulation/UI setting.

Useful player observations for the next pass:

1. Does the first lesson provide enough time to establish a useful line without dragging?
2. Does the lower gate's opening clearly explain why a second line is useful?
3. Does the revised Shear dive feel readable at 7.67 seconds while keeping its short-route identity?
4. Are the orbital ring exits easy to follow toward the core?
5. Do the opposing ring tilts create useful firing choices, or simply add visual overlap?

## v0.4 optional encounter

The normal three-arena campaign above is unchanged. Array index 3, stable ID `carrier-test`, is a separate optional three-wave encounter using the exact Shear paths/hangar. Its primary carrier route is the wide figure-eight (path 2); it does not establish boss routes for the campaign or write campaign records. See `CARRIER_TEST_FLIGHT.md` for schedule, parameters and validation.

The middle coil and wide loop have a real near-crossing around `(11.3, 22.6, 6.4)`, useful for experimenting with a local Stasis field. This is distinct from the famous self-crossing with 10m vertical separation. Field membership always uses actual 3D distance; a screen crossing alone has no effect.

## v0.5 continuation

Shear and Orbital now offer waves6–8 after recording the original five-wave victory. The base schedules, path samples, HP/speed multipliers and weapon stats are preserved. The continuation retains resources and drones and starts with unlimited manual setup; no new campaign score is written on its win or loss. See EXTENDED_DEFENSE.md for authored wave roles and feasibility limits. Flight School remains5waves and Carrier Test Flight remains3.
