# Retained campaign reference

`pre-crown-v051.json` preserves the four pre-Crown levels from Sites source commit
`aebe847e4388e2135f1b9039369c82d64787bfea` (v0.5.1), using that commit's
`src/game/paths.ts` and `src/game/math.ts`. It was captured under Node 24.19.0.
Every serialized level matched the original v0.6 Crown SHA256 before capture.
`../authored-baseline.mjs` verifies those same four hashes on the retained data
each time it is imported. This fixture is not a snapshot regenerated from the
current implementation.

The historical source audit found that `arcSample` has not changed since the
first retained Sites commit. Between v0.5.1 and v0.6.1, the old-level source is
byte-identical apart from three TypeScript-only LevelDef fields; the Crown
helpers and fifth level are appended afterward. No old geometry repair was
needed.

## Why the live output is compared with tolerances

The former test hashed all binary64 geometry values, so it rejected harmless
differences in exponentiation implementations. The following controlled test
used the same current source and Node 24.19.0, changing only V8's math mode:

| Level | Default `--use-std-math-pow` | `--no-use-std-math-pow` | Largest geometry difference |
| --- | --- | --- | --- |
| Flight School | Original hash `cf1c02d5…` | `dd73b1eaed5dc98de8eb6464a4a856d56560281c0a70b91e351e7bc4b1047c64` | 3.55e-15 m |
| Shear Lane | Original hash | Identical | 0 m |
| Orbital Garden | Original hash `c4a0609e…` | `a4eb0ab020fe05ae0f98c44a65f99476d038bbb16b8eff31fc950e470f121322` | 1.42e-14 m |
| Carrier Test Flight | Original hash | Identical | 0 m |

These are exactly the two old levels whose paths use cubic `** 3` evaluation. This reproduces
the reported failure pattern and isolates a real portability cause. Node
20/21/22 were not installed in this environment, so their specific outputs were
not independently checked here.

The replacement guard compares IDs, route order/sample counts, wave schedules
(including text and continuation), multipliers and authored hangar xyz exactly.
It compares every sampled xyz, cumulative distance and total route length to the
retained reference with an absolute **1e-6 m** tolerance. Derived hangar yaw/pitch
use **1e-12 rad** because `lookingAt` calls `atan2` and `hypot`.

Mutation checks prove that both small-but-real geometry changes and even much
smaller authored schedule/position changes still fail. Non-finite values and
missing samples also fail. The check reports the differing field/index rather
than an opaque whole-level SHA mismatch.

On Node 24.19.0, both of these pass:

```sh
node qa/crown.mjs
node --no-use-std-math-pow qa/crown.mjs
```

Do not overwrite the fixture to make a changed level pass. An intentional
campaign change requires a separately reviewed contract update; preserve this
historical reference and its provenance.
