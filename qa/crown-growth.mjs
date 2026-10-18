// Crown growth and continuation contracts, not a human difficulty or rendering test.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  LEVELS,
  SPLIT_CROWN_INDEX,
  MAX_DRONES,
  createRun,
  getDroneLimit,
  getAnchorCost,
  tryAnchor,
  beginReposition,
  recallSelected,
  beginContinuation,
  beginWave,
  nextWaveNow,
  step,
} = api;
const level = LEVELS[SPLIT_CROWN_INDEX];
const neutral = () => ({
  thrust: 0,
  steer: 0,
  pitch: 0,
  boost: false,
  anchor: false,
  expand: false,
  shift: 0,
});
let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`✓ ${name}`);
}
function storage() {
  const data = new Map(),
    writes = [];
  globalThis.localStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
      writes.push([k, v]);
    },
  };
  return { data, writes };
}
function quietPilot(run) {
  Object.assign(run.ship, { x: 49, y: 43, z: 0, yaw: -Math.PI / 2, pitch: 0, vx: 0, vy: 0, vz: 0 });
  run.aimx = 1;
  run.aimy = 0;
  run.aimz = 0;
}
function fundedFleet(index, count) {
  const run = createRun(index);
  run.scrap = 10_000; // Seeded purchase-contract state; the trial checks earned budgets.
  for (let i = 0; i < count; i++) {
    Object.assign(run.ship, { x: -40 + i * 5, y: 20, z: 12 });
    run.droneMode = i === 0 ? "sweep" : i === 8 ? "stasis" : "pierce";
    assert.equal(tryAnchor(run), null);
  }
  return run;
}
function finishWave(run) {
  // Exercise the real terminal transition from an already resolved wave.
  for (const enemy of run.enemies) enemy.alive = false;
  for (const group of run.waves[run.waveIndex].groups) group.spawned = group.count;
  run.rest = 0;
  step(run, neutral(), 1 / 60);
}
function crownClear() {
  const run = createRun(SPLIT_CROWN_INDEX);
  quietPilot(run);
  run.waveIndex = 7;
  run.core = 81;
  run.carrierOutcome = "destroyed";
  finishWave(run);
  assert.equal(run.phase, "win");
  return run;
}
function advance(run, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) step(run, neutral(), 1 / 60);
}

test("Crown buys past eight with per-type prices; other arenas retain their limit", () => {
  assert.equal(MAX_DRONES, 8);
  assert.equal(getDroneLimit(level), Infinity);
  const run = fundedFleet(SPLIT_CROWN_INDEX, 12);
  assert.equal(run.drones.length, 12);
  assert.equal(run.drones[8].mode, "stasis");
  assert.equal(run.drones[8].paid, 32);
  assert.deepEqual(
    run.drones.map((d) => d.paid),
    [24, 20, 32, 44, 56, 68, 80, 92, 32, 104, 116, 128],
  );
  assert.equal(run.scrap, 10_000 - 796);
  run.scrap = getAnchorCost(run) - 1;
  Object.assign(run.ship, { x: 35, y: 20, z: 12 });
  assert.match(tryAnchor(run), /Need 140 scrap/);
  for (const [index, other] of LEVELS.entries()) {
    if (index === SPLIT_CROWN_INDEX || other.prototype) continue;
    assert.equal(getDroneLimit(other), 8);
    const capped = fundedFleet(index, 8);
    Object.assign(capped.ship, { x: 5, y: 20, z: 12 });
    assert.equal(tryAnchor(capped), "Lattice is full");
  }
});

test("A larger fleet repositions its oldest unit for free and recalls its actual paid value", () => {
  const run = fundedFleet(SPLIT_CROWN_INDEX, 12),
    first = run.drones[0];
  first.kills = 7;
  first.damage = 123;
  const original = {
    id: first.id,
    mode: first.mode,
    paid: first.paid,
    kills: first.kills,
    damage: first.damage,
  };
  run.scrap = 0;
  assert.equal(beginReposition(run, first.id), null);
  run.ship.z += 8;
  assert.equal(tryAnchor(run), null);
  assert.equal(run.drones.length, 12);
  assert.equal(run.scrap, 0);
  assert.strictEqual(run.drones[0], first);
  assert.deepEqual(
    { id: first.id, mode: first.mode, paid: first.paid, kills: first.kills, damage: first.damage },
    original,
  );
  assert.equal(first.bz, 20);
  assert.equal(recallSelected(run, first.id), null);
  assert.equal(run.scrap, original.paid);
  assert.equal(run.drones.length, 11);
});

test("The optional four waves retain all five routes and reserve E for the later carrier", () => {
  assert.equal(level.waves.length, 8);
  assert.equal(level.continuation.length, 4);
  // Recorded from Sites source 85595089 before adding the long flight. This
  // guards exact authored schedules/text without hashing sampled floats.
  assert.equal(
    createHash("sha256").update(JSON.stringify(level.waves)).digest("hex"),
    "b21f410ef882a562e410405d2200eaf838c9875b69974263cd7cb8e21f66dc11",
  );
  const firstEight = JSON.stringify(level.waves),
    authoredExtra = JSON.stringify(level.continuation);
  const run = crownClear();
  run.scrap = 300;
  const before = { core: run.core, scrap: run.scrap, kills: run.kills, ship: JSON.stringify(run.ship) };
  assert.equal(beginContinuation(run), true);
  assert.equal(run.waves.length, 12);
  assert.equal(run.waveIndex, 7);
  assert.equal(run.carrierOutcome, "pending");
  assert.equal(run.phase, "play");
  assert.equal(run.waveMode, "manual");
  assert.equal(run.rest, 8);
  assert.deepEqual(
    { core: run.core, scrap: run.scrap, kills: run.kills, ship: JSON.stringify(run.ship) },
    before,
  );
  assert.match(run.hint, /8-wave victory recorded.*wave 9/);
  assert.equal(beginContinuation(run), false);
  assert.equal(JSON.stringify(level.waves), firstEight);
  assert.equal(JSON.stringify(level.continuation), authoredExtra);
  assert.ok(run.waves.slice(8, 11).every((w) => w.groups.every((g) => g.path !== 4)));
  const finalCarriers = run.waves[11].groups.filter((g) => g.kind === "carrier");
  assert.equal(finalCarriers.length, 1);
  assert.equal(finalCarriers[0].path, 4);
  assert.equal(finalCarriers[0].count, 1);
  assert.ok(run.waves[11].groups.filter((g) => g.path === 4).every((g) => g.kind === "carrier"));
  advance(run, 2);
  assert.equal(run.waveIndex, 7);
  assert.equal(run.rest, 8);
  nextWaveNow(run);
  assert.equal(run.waveIndex, 8);
  assert.equal(createRun(SPLIT_CROWN_INDEX).waves.length, 8);
});

test("Authored reinforcement hull applies only to its group and the second carrier resets stale outcome", () => {
  const run = crownClear();
  beginContinuation(run);
  quietPilot(run);
  nextWaveNow(run);
  advance(run, 5.1);
  const barge = run.enemies.find((e) => e.alive && e.kind === "barge");
  const wisp = run.enemies.find((e) => e.alive && e.kind === "wisp");
  assert.ok(barge && wisp);
  assert.ok(Math.abs(barge.maxHp - 96 * 1.08 * 1.4) < 1e-9);
  assert.ok(
    Math.abs(wisp.maxHp - 40 * 1.08 * 1.1) < 1e-9,
    "escorts use their own modest reinforcement, not the Barge multiplier",
  );
  for (const e of run.enemies) e.alive = false;
  run.carrierOutcome = "destroyed";
  beginWave(run, 11);
  assert.equal(run.carrierOutcome, "pending");
  advance(run, 1.6);
  const carrier = run.enemies.find((e) => e.alive && e.kind === "carrier");
  const scale = level.continuation[3].groups.find((g) => g.kind === "carrier").hpMul;
  assert.ok(carrier);
  assert.ok(Math.abs(carrier.maxHp - 486 * scale) < 1e-9);
  assert.ok(carrier.maxHp >= 1458);
  const regular = createRun(SPLIT_CROWN_INDEX);
  quietPilot(regular);
  beginWave(regular, 7);
  advance(regular, 1.6);
  assert.ok(Math.abs(regular.enemies.find((e) => e.alive && e.kind === "carrier").maxHp - 486) < 1e-9);
  assert.ok(
    // Prototype arenas (e.g. Drift Frontier) author their own escalation; campaigns and the lab may not.
    LEVELS.filter((l) => !l.prototype).every((l) =>
      l.waves.every((w) => w.groups.every((g) => g.hpMul === undefined)),
    ),
    "normal campaigns and lab retain their authored hull",
  );
});

test("Winning or losing the twelve-wave flight leaves the ordinary eight-wave record intact", () => {
  for (const outcome of ["win", "lose"]) {
    const store = storage(),
      run = crownClear();
    assert.equal(store.writes.length, 1);
    const saved = store.data.get("helix-hold-v2"),
      save = run.save;
    assert.equal(JSON.parse(saved).bestByLevel["split-crown"], 81);
    assert.equal(beginContinuation(run), true);
    run.waveIndex = 11;
    run.rest = 0;
    for (const group of run.waves[11].groups) group.spawned = group.count;
    if (outcome === "lose")
      Object.assign(run.enemies[0], {
        alive: true,
        kind: "shard",
        pathIndex: 0,
        dist: run.paths[0].length,
        speed: 0,
        leak: 100,
      });
    else run.core = 99;
    step(run, neutral(), 1 / 60);
    assert.equal(run.phase, outcome);
    assert.equal(run.waveIndex, 11);
    assert.equal(store.writes.length, 1);
    assert.equal(store.data.get("helix-hold-v2"), saved);
    assert.strictEqual(run.save, save);
    assert.equal(beginContinuation(run), false);
  }
});

console.log(`\n${checks} Crown growth and long-flight checks passed.`);
