# Replacing Orbital Garden: three spatial studies

Original design study: 2026-10-12. **Update: Split Crown is playable in v0.6, with a fifth carrier transfer added.** See [SPLIT_CROWN.md](SPLIT_CROWN.md) for the implemented geometry and trials. Counterweight and Braided Reach remain unimplemented concepts; the four-route sheet below records the original study. The source-generated [plan and elevation sheet](../public/arena-studies.svg) shows sampled candidate geometry at a common scale. The study changes no campaign, score, enemy, weapon or control code.

## Recommendation: Split Crown

Use Split Crown as the next larger arena to prototype. It has four gates in two offset helix districts, eight authored waves, and a progression from defending one district to dividing a fleet between both. Preserve the pleasure of finding a useful slice through several lanes: each district contains a deliberately close pair, while the gap between districts makes broad coverage and sustained local contact different investments.

The reason to replace Orbital's featured position is its role in the sequence, not a rule that two gates are inherently simple. Its two tilted rings can produce interesting lines, but its present introduction after three-gate Shear does not clearly promise a new problem. A larger arena should make the player revise a successful defense instead of merely waiting through more traffic on it. This revision moves Orbital into an archived ring-study entry while retaining its source, playability and stable `orbital` score identity. Any eventual replacement needs its own ID (`split-crown` is proposed). Do not assign an Orbital clear to the new arena.

Resolve Stasis's reported zero-occupant failure before using that mechanic to judge these designs. Every candidate must also be viable with existing damage drones; a particular field placement should not become an entry requirement.

## Three candidates

| Candidate | Routes and space | New defensive decision | Principal risk |
|---|---|---|---|
| **Split Crown** | Four gates; two pairs of opposite-handed coils centered 42m apart horizontally. 65m x-span; 31m z-span; gates at 27–37m height. | Exploit a shared chord within one district, make a shorter cross-district slice, or dedicate a long-contact line to each crown. Opening one district first makes an early two-drone defense affordable. | A strong inward/core line might still solve everything. The four late approaches must be evaluated before calling this a harder tier. |
| **Counterweight** | Three gates; a tall central coil pair and a broad low bypass on the east. 61m x-span; 44m z-span; highest gate 39m. | Decide how much defense stays high versus guarding the bypass and its distinct inward exit. The third gate changes the spatial problem instead of duplicating a central spiral. | The long routes may make this slower rather than more demanding. The bypass also partly recalls Orbital; it is the least radical alternative. |
| **Braided Reach** | Four gates; horizontal corkscrews travel in opposing diagonal corridors, then turn toward the core. About 72m x-span and 24m z-span. | Brief shared crossing opportunities compete with long, directional approaches. Upper and lower entrances have similar plan projections but different heights. | This produces the most projection ambiguity and the greatest risk of mistaking a screen crossing for a physical crossing. It should follow a proven readability pass. |

Split Crown is the most legible next step. It keeps recognizable helices while changing where the useful coverage lives. Counterweight is a good altitude-focused alternative. Braided Reach is a later study if horizontal helices prove interesting enough to justify more difficult depth reading.

## Split Crown in concrete terms

The west district is centered at `(x,z)=(-21,-4)` and the east at `(21,4)`. Each contains an outer crown of radius 11.5m and an inner coil of radius 8.5m. Opposite winding and different heights create local shared chords without making the routes identical. Explicit curved transfers connect each district to the existing core at `(0,4.4,0)`.

| Route | Gate `(x,y,z)` in metres | Height after helix | Sampled full length | Proposed role |
|---|---|---:|---:|---|
| A · West crown | `(-14.24,37,-13.30)` | 19m | 105.19m | First route; eventual carrier/main convoy route |
| B · West coil | `(-14.12,29,1.00)` | 12m | 78.95m | Lower local partner; faster arrival if speeds are equal |
| C · East crown | `(14.24,35,-5.30)` | 17m | 105.68m | First distant commitment; approximately matches A's travel length |
| D · East coil | `(14.12,27,9.00)` | 10m | 78.54m | Fourth route; changes which inward approaches need attention |

The sampled west pair comes within 3.00m near `(-22.3,23.3,-13.9)`; the east pair does so near `(22.3,21.3,-5.9)`. These are real 3D neighborhoods. Excluding the final 15m of every route, the nearest west/east route separation in the samples is 18.22m. Thus one 6m-radius field could cover both members of a local pair there, but could not bridge the two districts there. This leaves a readable local role for an optional field without depending on apparent crossings.

A 76m Pierce can still reach across much of this arena; we should preserve discoveries where a long line catches both districts. The 38m Sweep favors a local approach, although it can still reach portions of both districts from a central position. Range alone does not determine value: the key measurements are contact time, target crowding and whether a single origin can service every inward route. The map is not a uniform enlargement of Shear, and neither weapon receives a range increase to compensate.

All routes remain within the current flight cylinder. Split Crown's maximum sampled horizontal radius is 32.88m and its highest point is 37m, leaving room to fly around the paths under the 52m radius/44m height limits. That geometric clearance does not establish a comfortable camera or aim angle.

## Eight-wave progression to test

This is a wave-role plan, not a balanced spawn schedule. Keep unlimited setup and selected-drone repositioning. Announce an opening gate before launch; do not surprise the player with an unpreviewed route.

| Wave | Active pressure | What it should ask the player to do |
|---|---|---|
| 1 | A only; small Shard group | Find a satisfying sustained line before committing the second drone. |
| 2 | A and B | Discover the local pair and distinguish a shared slice from two sustained lines. |
| 3 | C introduced | Spend earned scrap on a distant district, or reposition a redundant line. |
| 4 | Alternating A/C convoys with B escorts | Decide whether central cross-coverage is earning enough contact. |
| 5 | D introduced; lower-route pressure | Cover a new low approach without abandoning both crowns. |
| 6 | All four gates, staggered bursts | Make existing coverage work across different arrival times; no blanket speed increase. |
| 7 | Durable carrier on A, escorts on C/D | Reward one dedicated long-contact line while the rest of the fleet covers elsewhere. |
| 8 | Two separated convoys and a delayed lower-route push | Test the complete defense and make last setup adjustments matter. |

Starting 60 scrap still buys the first two drones for 20+32, leaving 8. Six defeated opening Shards at the present 8-scrap reward would bring that to 56, enough for the third drone's 44-scrap cost before another district opens. This is an economic schedule constraint, not proof that the opening is winnable: an ordinary-flight trial must show that reasonable opening placements can earn that money. Do not start all four gates before the fleet can respond. No extra starting budget, ninth slot, mandatory slow, immunity or contact-reset armor is proposed.

## Candidate geometry recipe

The figure uses fixed analytic routes, sampled into polylines. It can be reproduced without an image model or a renderer. These are study coordinates, not new `LEVELS` entries.

For each local helix, use `theta = endAngle + (t-1) * turns * 2π`, `x = cx + r*cos(theta)`, `z = cz + r*sin(theta)`, and linear `y` from `y0` to `y1`, with `0 ≤ t ≤ 1`. Sample 400 intervals. Append a 160-interval cubic Bézier to the core: first control point 5m along the helix's outgoing unit tangent; second control point as listed below; final point is the core. The study estimates the tangent from samples at 1 and 0.9999. Position and tangent direction join; curvature continuity is not claimed.

| Candidate / route | `(cx,cz)` | Radius | `y0 → y1` | Signed turns | End angle | Transfer second control `(x,y,z)` |
|---|---|---:|---|---:|---:|---|
| Split / A | `(-21,-4)` | 11.5 | `37 → 19` | 1.15 | 0 | `(-4,8,-10)` |
| Split / B | `(-21,-4)` | 8.5 | `29 → 12` | -1.10 | 0 | `(-9,6,4)` |
| Split / C | `(21,4)` | 11.5 | `35 → 17` | -1.15 | π | `(4,8,10)` |
| Split / D | `(21,4)` | 8.5 | `27 → 10` | 1.10 | π | `(9,6,-4)` |
| Counterweight / A | `(-9,0)` | 15 | `39 → 14` | 1.35 | π/2 | `(-12,7,4)` |
| Counterweight / B | `(-9,0)` | 10.5 | `35 → 9` | -1.25 | -π/2 | `(-3,6,-10)` |

Counterweight C uses `theta=1.65πt`, with `x=9+28cos(theta)`, `y=17+4sin(theta)`, `z=22sin(theta)`. Its transfer's second control is `(12,8,-7)`.

Braided Reach uses a linearly interpolated centerline `L(t)` from S to E. Let N be the horizontal unit perpendicular to `(E-S)` and `theta = phase + turns*2πt`. Add `4.5cos(theta)N` and a vertical offset `4.5sin(theta)` to L. Append the same tangent-preserving cubic transfer. Its four configurations are:

| Route | S | E | Turns / phase | Transfer second control |
|---|---|---|---|---|
| A | `(-34,33,-16)` | `(15,15,8)` | `1.15 / 0` | `(6,7,8)` |
| B | `(-34,23,16)` | `(15,10,-8)` | `-1.15 / π` | `(7,6,-8)` |
| C | `(34,35,16)` | `(-15,17,-8)` | `-1.15 / 0` | `(-6,8,-8)` |
| D | `(34,25,-16)` | `(-15,12,8)` | `1.15 / π` | `(-7,6,8)` |

## What is checked, and what remains

Numerical checks cover all candidate samples staying finite and inside the existing flight bounds, terminating at the existing core, measured route lengths and the quoted sampled distances. The SVG was rasterized and inspected for layout; this is a diagram inspection, not browser gameplay verification. Counterweight's routes measure 153.85/103.73/164.55m; Braided Reach's measure 89.51/86.02/88.22/85.39m.

Before adopting Split Crown:

1. Prototype it under a new stable ID and keep the existing maps intact during comparison. Use one proposed hangar near `(-9,28,-20)`, looking at route A's gate; verify actual camera framing and fly-to-place comfort rather than merely checking an in-bounds coordinate.
2. Run an ordinary-flight two-drone opening with real economy. Confirm the distant-gate introduction is affordable without assuming a perfect clear.
3. Compare matched defenses: local dedicated lines, discovered shared slices, and a central/core-heavy layout. If the core-heavy layout trivially solves every wave, change the inbound geometry or authored pressure before increasing every enemy's health.
4. Evaluate a fleet adjustment between waves 3 and 5. The value of more space should show up in a useful decision about placement, not just longer travel through empty air.
5. Playtest whether a player can explain why their successful line works. If they can only read overlaps from one camera angle, improve height cues or route separation before adding more gates.

The first design question is: **does defending two connected helix districts make it rewarding to keep a shared coverage line while moving a second drone to solve a local weakness?**
