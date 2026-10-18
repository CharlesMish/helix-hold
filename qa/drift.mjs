// Contracts for the Drift Frontier prototype: routes that swing between waves. No browser.
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
  DRIFT_INDEX,
  FRONTIER_INDEX,
  RELAY_LAB_INDEX,
  frontierDriftPath,
  step,
  tryAnchor,
  nextWaveNow,
  fleetRouteContact,
  availableDroneModes,
} = api;

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
};
const idle = { thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 };
/** Resolve the running wave instantly: everything spawned, nothing alive, one step to clear. */
function clearWave(run) {
  nextWaveNow(run);
  for (const g of run.waves[run.waveIndex].groups) g.spawned = g.count;
  for (const e of run.enemies) e.alive = false;
  step(run, idle, 1 / 60);
}
const level = LEVELS[DRIFT_INDEX];
const lo = { x: -8, y: 2, z: -6 },
  hi = { x: 8, y: 18, z: 6 };
function entersPrism(a, b) {
  let enter = 0,
    leave = 1;
  for (const k of ["x", "y", "z"]) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-10) {
      if (a[k] < lo[k] || a[k] > hi[k]) return false;
      continue;
    }
    const s = (lo[k] - a[k]) / d,
      t = (hi[k] - a[k]) / d;
    enter = Math.max(enter, Math.min(s, t));
    leave = Math.min(leave, Math.max(s, t));
    if (enter > leave + 1e-10) return false;
  }
  return enter <= 1 + 1e-10 && leave >= 0;
}

test("Drift Frontier is a separate prototype appended after the existing arenas", () => {
  assert.equal(FRONTIER_INDEX, 5);
  assert.equal(RELAY_LAB_INDEX, 6);
  assert.equal(DRIFT_INDEX, 7);
  assert.equal(level.id, "drift-frontier");
  assert.equal(level.prototype, "route-expansion");
  assert.equal(level.experiment, true, "prototype results never write campaign records");
  assert.equal(level.waves.length, 12);
  assert.ok(availableDroneModes(level).includes("tripwire"));
  assert.equal(LEVELS[FRONTIER_INDEX].driftPath, undefined, "plain Helix Frontier never drifts");
});

test("Every authored cumulative swing keeps each route legal and its port fixed", () => {
  const swing = [0, 0, 0];
  const seen = new Set();
  for (const wave of level.waves) {
    for (const d of wave.drift ?? []) swing[d.path] += d.degrees;
    for (let p = 0; p < 3; p++) {
      const key = `${p}:${swing[p]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const path = frontierDriftPath(p, swing[p]);
      assert.deepEqual(path.points.at(-1), LEVELS[FRONTIER_INDEX].paths[p].points.at(-1), "same breach port");
      for (let i = 0; i < path.points.length; i++) {
        const q = path.points[i];
        assert.ok(q.y >= 4 && q.y <= 40 && Math.hypot(q.x, q.z) <= 44, `${key} stays in flying margin`);
        if (i && i < path.points.length - 1)
          assert.ok(!entersPrism(path.points[i - 1], q), `${key} enters the prism early at ${i}`);
      }
    }
  }
  assert.deepEqual(swing, [0, 0, 0], "every coil ends the twelve waves back at home");
  assert.ok(seen.size >= 8, "the schedule visits several distinct placements");
});

test("Swings apply between waves only, rebuild the listed route, and never move drones", () => {
  const run = createRun(DRIFT_INDEX);
  run.scrap = 400;
  run.droneMode = "pierce";
  Object.assign(run.ship, { x: -12.74, y: 12.64, z: 0.66 });
  // A 22.5 m line along the West Spindle's lower turn, from a Frontier pose search.
  const yaw = 0.665,
    pitch = 0.276;
  run.aimx = -Math.sin(yaw) * Math.cos(pitch);
  run.aimy = Math.sin(pitch);
  run.aimz = -Math.cos(yaw) * Math.cos(pitch);
  assert.equal(tryAnchor(run), null);
  const drone = { ...run.drones[0] };
  const original = run.paths;
  for (let w = 1; w <= 2; w++) clearWave(run);
  assert.equal(run.pathRevision, 0, "no swing before wave 4");
  clearWave(run); // wave 3 clears → wave 4 setup swings A by 45°
  assert.equal(run.pathRevision, 1);
  assert.deepEqual(run.pathSwing, [45, 0, 0]);
  assert.notEqual(run.paths[0], original[0]);
  assert.equal(run.paths[1], original[1], "unlisted routes keep their exact objects");
  assert.equal(level.paths[0], original[0], "the level's own routes are never mutated");
  for (const key of ["bx", "by", "bz", "fx", "fy", "fz"]) assert.equal(run.drones[0][key], drone[key]);
  const [report] = run.lastDrift;
  assert.equal(report.path, 0);
  assert.equal(report.degrees, 45);
  assert.ok(report.before > 10, `line had real contact before (${report.before.toFixed(1)} m)`);
  assert.ok(report.after < report.before, "the swing cost this line contact");
  assert.ok(Math.abs(report.after - fleetRouteContact(run)[0]) < 1e-9);
  assert.match(run.hint, /Gate A swung 45°/);
});

test("Drift is deterministic and returns each coil to its original object when home", () => {
  const a = createRun(DRIFT_INDEX),
    b = createRun(DRIFT_INDEX);
  for (let w = 0; w < 11; w++) {
    clearWave(a);
    clearWave(b);
    assert.deepEqual(a.pathSwing, b.pathSwing);
    for (let p = 0; p < 3; p++) assert.deepEqual(a.paths[p].points.at(200), b.paths[p].points.at(200));
  }
  assert.equal(a.waveIndex, 10);
  assert.deepEqual(a.pathSwing, [0, 0, 0], "wave 12 setup: all coils home");
  for (let p = 0; p < 3; p++) assert.equal(a.paths[p], level.paths[p]);
  const plain = createRun(FRONTIER_INDEX);
  for (let w = 0; w < 8; w++) clearWave(plain);
  assert.equal(plain.pathRevision, 0);
  assert.equal(plain.lastDrift, null);
});

console.log(`\n${passed} drift checks passed.`);
