// Coverage timing changes the readout, never the highlighted or combat geometry.
import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({
  stdin: {
    contents: 'export * from "./src/game/sim"; export * from "./src/game/paths";',
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
  getPlacementPreview,
  getCoverageTiming,
  getBeamCoverage,
  getFieldCoverage,
  droneBeam,
  nextWaveNow,
  tryAnchor,
  beginReposition,
  startFieldCheck,
  endFieldCheck,
} = api;
globalThis.localStorage = { getItem: () => null, setItem() {} };
const index = LEVELS.findIndex((l) => l.id === "split-crown");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const measured = (segments) => ({
  segments,
  metres: segments.reduce((sum, s) => sum + s.metres, 0),
  sampleRadius: 0.72,
});
const allLanes = measured(
  Array.from({ length: 5 }, (_, pathIndex) => ({ pathIndex, points: [], metres: 2 ** pathIndex })),
);
let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`✓ ${name}`);
}
function aimAtRoute(run, lane) {
  const p = run.paths[lane].pointAt(15);
  Object.assign(run.ship, { x: p.x - p.tx * 6, y: p.y - p.ty * 6, z: p.z - p.tz * 6 });
  Object.assign(run, { aimx: p.tx, aimy: p.ty, aimz: p.tz });
}

test("Crown setup separates opening waves 1/2/3/5/8 without deleting future hover segments", () => {
  for (const [wave, expected] of [
    [1, 1],
    [2, 3],
    [3, 7],
    [5, 15],
    [8, 31],
  ]) {
    const run = createRun(index);
    run.waveIndex = wave - 2;
    run.rest = 8;
    assert.deepEqual(getCoverageTiming(run, allLanes), {
      nowMetres: expected,
      laterMetres: 31 - expected,
      idleMetres: 0,
    });
    aimAtRoute(run, 4);
    const preview = getPlacementPreview(run),
      raw = getBeamCoverage(run, preview.beam);
    assert.ok(
      preview.segments.some((s) => s.pathIndex === 4),
      "carrier preview remains available from wave 1",
    );
    assert.deepEqual(preview.segments, raw.segments);
    near(preview.metres, raw.metres);
    near(preview.nowMetres + preview.laterMetres + preview.idleMetres, preview.metres);
    if (wave === 1)
      near(
        preview.nowMetres,
        preview.segments.filter((s) => s.pathIndex === 0).reduce((sum, s) => sum + s.metres, 0),
      );
    if (wave === 8) {
      near(preview.laterMetres, 0);
      near(preview.nowMetres, preview.metres);
    }
  }
});

test("Delayed groups and living last enemies keep coverage current; cleared final routes become idle", () => {
  const run = createRun(index);
  run.waveIndex = 6;
  run.rest = 8;
  nextWaveNow(run);
  assert.deepEqual(getCoverageTiming(run, allLanes), { nowMetres: 31, laterMetres: 0, idleMetres: 0 });
  for (const g of run.waves[7].groups) g.spawned = g.count;
  Object.assign(run.enemies[0], { alive: true, pathIndex: 4 });
  assert.deepEqual(getCoverageTiming(run, allLanes), { nowMetres: 16, laterMetres: 0, idleMetres: 15 });
  run.enemies[0].alive = false;
  assert.deepEqual(getCoverageTiming(run, allLanes), { nowMetres: 0, laterMetres: 0, idleMetres: 31 });
});

test("A previously opened but temporarily quiet gate is later only when it will return", () => {
  const run = createRun(index);
  // Minimal authored schedule isolates a state absent from current Crown setup.
  const group = (path) => ({ kind: "shard", path, count: 1, spawned: 0, interval: 1, delay: 0 });
  run.waves = [{ groups: [group(0), group(1)] }, { groups: [group(1)] }, { groups: [group(0)] }];
  run.waveIndex = 0;
  run.rest = 8;
  assert.deepEqual(getCoverageTiming(run, allLanes), { nowMetres: 2, laterMetres: 1, idleMetres: 28 });
  run.waveIndex = 1;
  assert.deepEqual(getCoverageTiming(run, allLanes), { nowMetres: 1, laterMetres: 0, idleMetres: 30 });
});

test("Pierce, Sweep and Stasis timing sums use the same Fan/Slide and retained-unit projection as combat", () => {
  for (const mode of ["pierce", "sweep", "stasis"]) {
    const run = createRun(index);
    Object.assign(run.ship, { x: -22.3, y: 23.3, z: -13.9 });
    Object.assign(run, { droneMode: mode, aimx: 0.6, aimy: 0, aimz: -0.8, expand: 0.7, shift: -0.6 });
    const preview = getPlacementPreview(run);
    const raw = mode === "stasis" ? getFieldCoverage(run, preview.drone) : getBeamCoverage(run, preview.beam);
    assert.deepEqual(preview.segments, raw.segments);
    near(preview.nowMetres + preview.laterMetres + preview.idleMetres, raw.metres);
    assert.equal(tryAnchor(run), null);
    const retained = run.drones[0];
    assert.deepEqual(droneBeam(retained), preview.beam);
    assert.deepEqual(retained, preview.drone);
    assert.equal(beginReposition(run, retained.id), null);
    Object.assign(run.ship, { x: 20, y: 22, z: -10 });
    const moved = getPlacementPreview(run);
    const movedRaw =
      mode === "stasis" ? getFieldCoverage(run, moved.drone) : getBeamCoverage(run, moved.beam);
    assert.deepEqual(moved.segments, movedRaw.segments);
    near(moved.nowMetres + moved.laterMetres + moved.idleMetres, movedRaw.metres);
    assert.equal(tryAnchor(run), null);
    assert.deepEqual(retained, moved.drone);
    assert.equal(retained.paid, { pierce: 20, sweep: 24, stasis: 32 }[mode]);
  }
});

test("Tutorial hidden lessons remain hidden while the next announced lesson gains current coverage", () => {
  const run = createRun(0);
  aimAtRoute(run, 1);
  const raw = getBeamCoverage(run, getPlacementPreview(run).beam);
  assert.ok(raw.segments.some((s) => s.pathIndex === 1));
  const first = getPlacementPreview(run);
  assert.ok(first.segments.every((s) => s.pathIndex === 0));
  near(first.laterMetres, 0);
  near(first.nowMetres, first.metres);
  run.waveIndex = 1;
  run.rest = 8;
  const third = getPlacementPreview(run);
  assert.deepEqual(third.segments, raw.segments);
  near(third.nowMetres, third.metres);
});

test("Harmless field check targets mark all routes current without changing the restored setup forecast", () => {
  const run = createRun(index);
  run.droneMode = "stasis";
  Object.assign(run.ship, { x: -22.3, y: 23.3, z: -13.9 });
  assert.equal(tryAnchor(run), null);
  const before = getCoverageTiming(run, allLanes);
  assert.equal(startFieldCheck(run), null);
  assert.deepEqual(getCoverageTiming(run, allLanes), { nowMetres: 31, laterMetres: 0, idleMetres: 0 });
  endFieldCheck(run);
  assert.deepEqual(getCoverageTiming(run, allLanes), before);
});
console.log(`\n${checks} coverage timing checks passed.`);
