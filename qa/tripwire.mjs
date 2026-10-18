// Contracts for the Tripwire strand prototype. No browser required.
import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({
  stdin: {
    contents:
      'export * from "./src/game/sim"; export * from "./src/game/combat"; export * from "./src/game/paths";',
    resolveDir: new URL("../", import.meta.url).pathname,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const api = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const {
  createRun,
  LEVELS,
  buildPath,
  step,
  tryAnchor,
  recallLast,
  recallSelected,
  beginReposition,
  cancelReposition,
  getAnchorCost,
  getStrands,
  getPlacementPreview,
  getDroneCoverage,
  getBeamCoverage,
  wireBeam,
  nextWaveNow,
  availableDroneModes,
  TRIPWIRE_DAMAGE,
  TRIPWIRE_MAX_SPAN,
} = api;

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
};
const idle = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const frontierIndex = LEVELS.findIndex((l) => l.id === "helix-frontier");
const place = (run, x, y, z, aim = { x: 0, y: 1, z: 0 }) => {
  Object.assign(run.ship, { x, y, z, vx: 0, vy: 0, vz: 0 });
  run.aimx = aim.x;
  run.aimy = aim.y;
  run.aimz = aim.z;
  return tryAnchor(run);
};
const frontier = () => {
  const run = createRun(frontierIndex);
  run.droneMode = "tripwire";
  run.scrap = 500;
  return run;
};
const polyline = (points) =>
  buildPath(
    "test",
    (t) => {
      const u = t * (points.length - 1),
        i = Math.min(points.length - 2, Math.floor(u)),
        v = u - i;
      const a = points[i],
        b = points[i + 1];
      return { x: a.x + (b.x - a.x) * v, y: a.y + (b.y - a.y) * v, z: a.z + (b.z - a.z) * v };
    },
    400,
  );
// One sturdy Shard on a custom route, with the pilot parked far away aiming at the sky.
const crossingRun = (points, strand, input = () => idle()) => {
  const run = frontier();
  run.level = { ...run.level, hpMul: 100, speedMul: 1 };
  run.paths = [polyline(points)];
  run.waves = [{ groups: [{ kind: "shard", path: 0, count: 1, interval: 1, delay: 0, spawned: 0 }] }];
  assert.equal(place(run, ...strand[0]), null);
  assert.equal(place(run, ...strand[1]), null);
  Object.assign(run.ship, { x: 45, y: 43, z: 0 });
  run.aimx = 0;
  run.aimy = 1;
  run.aimz = 0;
  nextWaveNow(run);
  for (let i = 0; i < 60 * 30 && run.phase === "play" && run.rest <= 0; i++) step(run, input(i), 1 / 60);
  const owner = run.drones.find((d) => d.mode === "tripwire" && d.paid > 0);
  return Math.round(owner.damage / TRIPWIRE_DAMAGE);
};

test("Tripwire is offered only in the Frontier prototypes, with one price per strand", () => {
  for (const level of LEVELS) {
    const offered = availableDroneModes(level).includes("tripwire");
    assert.equal(offered, level.prototype === "route-expansion", level.id);
  }
  const run = frontier();
  assert.equal(getAnchorCost(run), 36);
  assert.equal(place(run, -10, 20, 0), null);
  assert.equal(run.drones[0].paid, 36);
  assert.equal(run.drones[0].partnerId, null);
  assert.equal(getAnchorCost(run), 0, "the open post makes the next anchor free");
  assert.equal(place(run, 10, 20, 0), null);
  assert.equal(run.drones[1].paid, 0);
  assert.equal(run.drones[0].partnerId, run.drones[1].id);
  assert.equal(run.drones[1].partnerId, run.drones[0].id);
  assert.equal(getAnchorCost(run), 54, "a second strand costs base + increment");
  assert.equal(getAnchorCost(run, "pierce"), 20, "strands never raise other prices");
  assert.equal(run.scrap, 500 - 36);
});

test("Strand span is limited to 3–32 m between rest positions", () => {
  const run = frontier();
  assert.equal(place(run, -10, 20, 0), null);
  assert.match(place(run, -10 + TRIPWIRE_MAX_SPAN + 1, 20, 0), /Strand too long/);
  assert.match(place(run, -8.6, 20, 0.6), /Too close|Strand too short/);
  assert.match(place(run, -7.5, 20, 0), /Strand too short/);
  assert.equal(place(run, -10 + TRIPWIRE_MAX_SPAN - 0.5, 20, 0), null);
  assert.equal(getStrands(run.drones).length, 1);
});

test("Each crossing deals one burst; lying along a route is still a single crossing", () => {
  const strand = [
    [-10, 20, 0],
    [10, 20, 0],
  ];
  // Straight through: one crossing.
  assert.equal(
    crossingRun(
      [
        { x: 0, y: 20, z: -30 },
        { x: 0, y: 20, z: 30 },
      ],
      strand,
    ),
    1,
  );
  // Zig-zag across the strand three times: three bursts.
  assert.equal(
    crossingRun(
      [
        { x: 0, y: 20, z: -20 },
        { x: 0, y: 20, z: 10 },
        { x: 4, y: 20, z: -10 },
        { x: 4, y: 20, z: 25 },
      ],
      strand,
    ),
    3,
  );
  // Travelling along the full strand keeps contact: exactly one burst, unlike a Pierce line.
  assert.equal(
    crossingRun(
      [
        { x: -30, y: 20, z: 0 },
        { x: 30, y: 20, z: 0 },
      ],
      strand,
    ),
    1,
  );
});

test("Preview reports crossings: none for an open first post, route crossings for the strand", () => {
  const run = frontier();
  Object.assign(run.ship, { x: -16, y: 36, z: -3 });
  let preview = getPlacementPreview(run);
  assert.equal(preview.wire, null);
  assert.equal(preview.nowCrossings + preview.laterCrossings, 0);
  assert.equal(place(run, -16, 36, -3), null);
  // A vertical strand at the West Spindle's end angle crosses both passes of its 1.2 turns.
  Object.assign(run.ship, { x: -16, y: 13.5, z: -3 });
  preview = getPlacementPreview(run);
  assert.ok(preview.wire && Math.abs(preview.wire.span - 22.5) < 1e-9);
  const west = preview.segments.filter((s) => s.pathIndex === 0).length;
  assert.equal(west, 2, `vertical strand crossings on A: ${west}`);
  assert.equal(preview.nowCrossings, west, "A is the current route in setup for wave 1");
  assert.equal(place(run, -16, 13.5, -3), null);
  const owner = run.drones[0];
  assert.deepEqual(
    getDroneCoverage(run, owner).segments.length,
    getBeamCoverage(run, getStrands(run.drones)[0].beam).segments.length,
  );
  assert.equal(getDroneCoverage(run, run.drones[1]).segments.length, 0, "the second post owns nothing");
});

test("Recall last reopens a free second post; selected recall removes and refunds the whole strand", () => {
  const run = frontier();
  place(run, -10, 20, 0);
  place(run, 10, 20, 0);
  assert.equal(recallLast(run), null);
  assert.equal(run.drones.length, 1);
  assert.equal(run.drones[0].partnerId, null);
  assert.equal(run.scrap, 464, "second post refunds nothing");
  assert.equal(getAnchorCost(run), 0);
  place(run, 10, 22, 0);
  const [a, b] = run.drones;
  assert.equal(recallSelected(run, b.id), null, "selecting either post removes the strand");
  assert.equal(run.drones.length, 0);
  assert.equal(run.scrap, 500);
  assert.equal(getAnchorCost(run), 36, "no free strand can be rebuilt from a leftover post");
  place(run, -10, 20, 0);
  place(run, 10, 20, 0);
  assert.equal(recallSelected(run, run.drones[0].id), null);
  assert.equal(run.drones.length, 0);
  assert.equal(run.scrap, 500);
  assert.ok(a.id !== undefined);
});

test("Reposition moves one post, keeps the pair and price, and respects the span", () => {
  const run = frontier();
  place(run, -10, 20, 0);
  place(run, 10, 20, 0);
  const [a, b] = run.drones;
  assert.equal(beginReposition(run, b.id), null);
  run.phase = "play";
  assert.match(place(run, 30, 20, 0), /Strand too long/);
  Object.assign(run.ship, { x: 10, y: 28, z: 0 });
  const preview = getPlacementPreview(run);
  assert.equal(preview.wire.anchorId, a.id);
  assert.equal(place(run, 10, 28, 0), null);
  assert.equal(run.drones.length, 2);
  assert.equal(b.partnerId, a.id);
  assert.equal(b.paid, 0);
  assert.equal(a.paid, 36);
  assert.ok(Math.abs(getStrands(run.drones)[0].beam.range - 0.4 - Math.hypot(20, 8)) < 1e-9);
  assert.equal(beginReposition(run, a.id), null);
  cancelReposition(run);
  assert.equal(getStrands(run.drones).length, 1);
});

test("Fan and Slide never move posts, so sweeping a strand cannot farm bursts", () => {
  const run = frontier();
  place(run, -10, 20, 4);
  place(run, 10, 20, 4);
  for (let i = 0; i < 60; i++) step(run, { ...idle(), expand: true, shift: 1 }, 1 / 60);
  const [a, b] = run.drones;
  assert.ok(run.expand > 0.9 && run.shift > 0.9, "the lattice was fully fanned and slid");
  for (const post of [a, b]) assert.deepEqual([post.x, post.y, post.z], [post.bx, post.by, post.bz]);
  const strand = getStrands(run.drones)[0].beam;
  const expected = wireBeam({ x: a.bx, y: a.by, z: a.bz }, { x: b.bx, y: b.by, z: b.bz });
  for (const key of ["x", "y", "z", "dx", "dy", "dz", "range"])
    assert.ok(Math.abs(expected[key] - strand[key]) < 1e-12);
  // Review regression: an enemy riding along the strand while Fan and Slide are toggled every
  // 0.2 s previously took ~11 bursts. It must take exactly one.
  const along = [
    { x: -30, y: 20, z: 0 },
    { x: 30, y: 20, z: 0 },
  ];
  const toggling = (i) => ({
    ...idle(),
    expand: Math.floor(i / 12) % 2 === 0,
    shift: Math.floor(i / 12) % 2 ? 1 : -1,
  });
  assert.equal(
    crossingRun(
      along,
      [
        [-10, 20, 0],
        [10, 20, 0],
      ],
      toggling,
    ),
    1,
  );
});

test("Tripwire posts can be recalled only during setup", () => {
  const run = frontier();
  place(run, -10, 20, 0);
  place(run, 10, 20, 0);
  nextWaveNow(run);
  assert.match(recallLast(run), /during setup/);
  assert.equal(run.drones.length, 2);
});

console.log(`\n${passed} tripwire checks passed.`);
