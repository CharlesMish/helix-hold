# Outside-review follow-up — v0.6.2

Reviewed GitHub `91bacf0108543ad6bce002363bc5f5ef65b6dfeb` against its matching
Sites source `7a51eeea27b8e133356a69b2b7731dff9c107355`. Charlie supplied
Claude's executed source/browser review, Grok's source-only review, and a
390×844 portrait Survey screenshot. This pass independently checked source,
historical source, deterministic simulation and the screenshot. It did not
execute a browser: approved browser control is unavailable in the managed
Sites environment.

## Corrections

### Historical campaign test

The original 43 checks pass here on Node 24.19.0. The old campaign comparison
nonetheless has a real portability defect: it hashes computed floating-point
geometry as exact text. Switching the same Node/source to
`--no-use-std-math-pow` changes exactly the Flight School and Orbital hashes.
The largest coordinate/cumulative-distance difference is 1.42e-14 m. Retained
history shows `arcSample` is unchanged; the older authored levels did not drift.
Node 20–22 were not available for direct reproduction of Claude's environment.

The new reference was captured from pre-Crown Sites commit `aebe847` and
verified against all four original hashes. Those integrity checks remain.
Live IDs, schedules, multipliers and authored hangar positions are compared
exactly; every sampled coordinate, cumulative distance and path length uses
an absolute 1e-6 m tolerance. Derived hangar aim uses 1e-12 rad. Mutation
checks ensure actual route/schedule changes still fail with useful field-level
messages. See [fixture provenance](../qa/fixtures/README.md).

### Field-check exit

Enter now ends an active field check and restores setup without launching the
waiting wave. The button, flight hint and guide expose the shortcut. Under
pointer lock, a previously focused button cannot also receive native Enter or
Space activation behind the flight controls. Survey's normal keyboard button
navigation remains available.

### Portrait Survey

The supplied screenshot shows the independently positioned Survey card covering
the lower Crown gate row. Narrow portrait Survey now lays out the gate group
and the scrollable card in consecutive grid rows, with a 12 px gap. Wrapped gate
names contribute their actual height. The launch label stays on one line.
These are source-level corrections; the resulting desktop/touch appearance
still needs a permitted browser/device check.

### Crown coverage readout

The primary number and bar now reflect the upcoming wave during setup, or
pending/live routes during combat. Future-wave coverage is listed separately;
routes with no remaining traffic are labeled cleared. All hover segments stay
available, including E from the start. Flight School's existing lesson filter
is preserved. No weapon, field strength, economy, route or wave changes.

The same 1,454 candidate poses reproduce the misleading old ranking. Using the
actual placement preview, the highest-total line provides 67.313 m overall but
only 8.475 m on A; the highest-current line provides 22.932 m on A and 32.403 m
overall. A line with zero A contact can total 52.368 m. This establishes a
readout mismatch with the opening task, not human behavior or damage outcomes.
[Full measurements and muzzle-offset distinction](CROWN_COVERAGE_REVIEW.md).

### Prepared browser suite

State transitions and rendered HUD updates are polled rather than inferred
from 150–250 ms sleeps. Intentional observation windows for held controls and
paused/manual progression remain separate. Added regression paths cover
Enter-to-end under pointer lock and Crown gate/card separation in narrow
desktop and touch contexts.

The previous whole-screen gold-pixel threshold was never calibrated and mixed
occlusion with visibility. The suite now frames the Barge off-axis and retains
pixel measurements/screenshots as diagnostic evidence; geometric framing is
not described as proof of readable rendering. This revised suite is syntax
checked, **not executed here**. Claude's v0.6.1 browser results do not verify
these v0.6.2 changes.

## Stasis study: a corrected comparison

The original dedicated-fleet pair changed more than the seventh purchase:
its "second-to-last Pierce" refit moved unit 7 in the damage fleet and unit 6
in the field fleet. Thus the original loss-versus-win result could not isolate
the benefit of Stasis.

The new study holds the refitted unit and every other unit's pose fixed. Both
fleets buy their seventh unit before wave 6 for 92 scrap, using the normal
economy; no existing unit is recalled or replaced. Matched damage-only wins
with 37 core, versus 46 with the field. Both intercept the carrier. The field
records 23.65 enemy-seconds of actual 3D contact, including 2.867 seconds on
the carrier. This is one paid placement tradeoff, not a general balance verdict.
See [the method, opportunity cost and results](CROWN_STASIS_TRADEOFF.md).

## Validation and remaining question

- `npm test`: 51 checks (22 simulation, 9 revision, 6 field-check, 8 Crown,
  6 coverage) on Node 24.19.0.
- `npm run test:geometry`: all enemy solid bounds and both 6 m field boundaries.
- `node --no-use-std-math-pow qa/crown.mjs`: all 8 Crown checks.
- `npm run trial:crown`: original committed output unchanged; no balance change
  was hidden in the shared study harness refactor.
- `npm run study:crown-coverage` and `npm run study:crown-stasis`: retained
  deterministic measurements and comparison assertions.
- TypeScript, production build, browser-script syntax and whitespace checks.
- No post-change browser screenshots or human playtest claimed.

Next useful playtest: **Does the current/later split help you place the first
two anchors on A while still making the future carrier route worth planning
for?** The screenshot layout and Enter-to-end should be checked during that
same visit. Stasis strength, extra enemy types, relays and further arena changes
remain separate decisions.
