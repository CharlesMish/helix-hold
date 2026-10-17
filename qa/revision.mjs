// Setup revision and optional continuation checks. No browser or dev server.
// Run: node qa/revision.mjs
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
  step,
  tryAnchor,
  placementStatus,
  getPlacementPreview,
  droneBeam,
  beginReposition,
  cancelReposition,
  recallSelected,
  recallLast,
  anchorCost,
  beginContinuation,
  nextWaveNow,
  setWaveMode,
  MAX_DRONES,
  LEVELS,
  CARRIER_TEST_INDEX,
} = api;
const input = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
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
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
      writes.push([key, value]);
    },
  };
  return { data, writes };
}
storage();

// Seed the earned-scrap state of a long run, then buy every unit through the
// real placement API. The first and eighth units cost 20 and 104 respectively.
function fullFleet() {
  const run = createRun(1);
  run.scrap = 1_000;
  for (let i = 0; i < MAX_DRONES; i++) {
    Object.assign(run.ship, { x: -21 + i * 6, y: 20, z: 0 });
    run.droneMode = i === 0 ? "sweep" : "pierce";
    assert.equal(tryAnchor(run), null);
  }
  run.scrap = 0;
  return run;
}
const restPose = (d) => [d.bx, d.by, d.bz, d.fx, d.fy, d.fz];

test("A full fleet can move its original 20-scrap unit without the 84-scrap replacement tax", () => {
  const recalled = fullFleet();
  assert.equal(recalled.drones[0].paid, 20);
  assert.equal(recalled.drones.at(-1).paid, 104);
  const oldestId = recalled.drones[0].id;
  assert.equal(recallSelected(recalled, oldestId), null);
  assert.equal(recalled.scrap, 20, "selected recall returns the actual paid value");
  assert.equal(anchorCost(recalled.drones.length), 104);
  Object.assign(recalled.ship, { x: 20, y: 32, z: 10 });
  assert.match(placementStatus(recalled), /104/);

  const run = fullFleet(),
    drone = run.drones[0],
    nextId = run.nextDroneId;
  // A carried unit's historical damage setting and contribution survive editing.
  Object.assign(drone, { dps: 19.25, kills: 7, damage: 123.75 });
  const retained = {
    id: drone.id,
    mode: drone.mode,
    paid: drone.paid,
    dps: drone.dps,
    kills: drone.kills,
    damage: drone.damage,
  };
  assert.equal(beginReposition(run, drone.id), null);
  Object.assign(run.ship, { x: 20, y: 32, z: 10 });
  assert.equal(placementStatus(run), null, "full slots and zero scrap do not block an existing unit");
  assert.equal(tryAnchor(run), null);
  assert.strictEqual(run.drones[0], drone, "the same unit object is reused");
  assert.equal(run.drones.length, MAX_DRONES);
  assert.equal(run.scrap, 0);
  assert.equal(run.nextDroneId, nextId);
  assert.equal(run.repositionId, null);
  assert.equal(run.selectedDroneId, drone.id);
  for (const [key, value] of Object.entries(retained)) assert.equal(drone[key], value, key);
  assert.deepEqual([drone.bx, drone.by, drone.bz], [20, 32, 10]);
});

test("Cancelling a flown revision leaves the old unit, placement, value and contribution intact", () => {
  const run = fullFleet(),
    drone = run.drones[2];
  Object.assign(drone, { kills: 4, damage: 321.5 });
  const before = { ...drone },
    scrap = run.scrap;
  assert.equal(beginReposition(run, drone.id), null);
  Object.assign(run.ship, { x: 18, y: 32, z: 11 });
  Object.assign(run, { aimx: 1, aimy: 0, aimz: 0 });
  const preview = getPlacementPreview(run);
  assert.notDeepEqual(restPose(preview.drone), restPose(drone));
  assert.deepEqual(drone, before, "preview never mutates the retained placement");
  cancelReposition(run);
  assert.equal(run.repositionId, null);
  assert.strictEqual(run.drones[2], drone);
  assert.deepEqual(drone, before);
  assert.equal(run.scrap, scrap);
});

test("Reposition preview under held Fan/Slide is exactly the committed beam and pose", () => {
  const run = fullFleet(),
    drone = run.drones[0];
  assert.equal(beginReposition(run, drone.id), null);
  Object.assign(run.ship, { x: 20, y: 31, z: 12 });
  Object.assign(run, { aimx: 0, aimy: 0.6, aimz: -0.8, expand: 0.7, shift: -0.6 });
  const preview = getPlacementPreview(run);
  assert.equal(preview.status, null);
  assert.notEqual(preview.drone.x, preview.drone.bx, "the modifiers affect the proposed pose");
  assert.equal(tryAnchor(run), null);
  assert.strictEqual(run.drones[0], drone);
  assert.deepEqual(drone, preview.drone);
  assert.deepEqual(droneBeam(drone), preview.beam);
  assert.equal(run.scrap, 0);
});

test("Placement ignores only the unit being moved, while another drone still blocks it", () => {
  const run = fullFleet(),
    drone = run.drones[0],
    other = run.drones[1];
  assert.equal(beginReposition(run, drone.id), null);
  assert.equal(placementStatus(run), null, "starting on one's own base is legal");
  Object.assign(run.ship, { x: other.bx, y: other.by, z: other.bz });
  assert.match(placementStatus(run), /another drone/);
  const before = { ...drone };
  assert.match(tryAnchor(run), /another drone/);
  assert.deepEqual(drone, before);
  assert.equal(run.repositionId, drone.id, "a rejected placement keeps the edit open");
  assert.equal(run.scrap, 0);
});

test("Selected editing and recall require setup; paused setup can select but cannot anchor", () => {
  const run = fullFleet(),
    drone = run.drones[0];
  nextWaveNow(run);
  const before = {
    scrap: run.scrap,
    count: run.drones.length,
    pose: restPose(drone),
    selected: run.selectedDroneId,
  };
  assert.match(beginReposition(run, drone.id), /setup/);
  assert.match(recallSelected(run, drone.id), /setup/);
  assert.deepEqual(
    { scrap: run.scrap, count: run.drones.length, pose: restPose(drone), selected: run.selectedDroneId },
    before,
  );
  run.rest = 8;
  run.phase = "pause";
  assert.equal(beginReposition(run, drone.id), null);
  assert.match(tryAnchor(run), /Resume/);
  run.phase = "play";
  assert.equal(tryAnchor(run), null);
  run.phase = "pause";
  const paid = run.drones[3].paid;
  assert.equal(recallSelected(run, run.drones[3].id), null);
  assert.equal(run.scrap, paid);
});

test("An open revision holds automatic setup and blocks explicit launch and last-in recall", () => {
  const run = fullFleet(),
    drone = run.drones[0];
  setWaveMode(run, "auto");
  assert.equal(beginReposition(run, drone.id), null);
  const held = run.rest;
  for (let i = 0; i < 600; i++) step(run, input(), 1 / 60);
  assert.equal(run.rest, held);
  assert.equal(run.waveIndex, -1);
  assert.ok(run.waves.every((w) => w.groups.every((g) => g.spawned === 0)));
  nextWaveNow(run);
  assert.equal(run.waveIndex, -1);
  assert.match(recallLast(run), /Finish or cancel/);
  setWaveMode(run, "manual");
  nextWaveNow(run);
  assert.equal(run.waveIndex, -1);
  setWaveMode(run, "auto");
  step(run, input(), 30);
  assert.equal(run.waveIndex, -1);
  cancelReposition(run);
  assert.equal(run.rest, 8, "cancellation grants a full setup interval");
  step(run, input(), 7.9);
  assert.equal(run.waveIndex, -1);
  step(run, input(), 0.2);
  assert.equal(run.waveIndex, 0);
});

// Complete an authored campaign through the same final-wave state transition
// used in play; movement/combat balancing is covered by the separate trial.
function campaignVictory(index = 1) {
  const run = createRun(index);
  run.ship.x += 5;
  assert.equal(tryAnchor(run), null);
  run.scrap = 417;
  run.core = 81;
  run.kills = 55;
  run.waveMode = "auto";
  run.waveIndex = run.waves.length - 1;
  run.rest = 0;
  for (const wave of run.waves) for (const group of wave.groups) group.spawned = group.count;
  step(run, input(), 0);
  assert.equal(run.phase, "win");
  return run;
}

test("The original five-wave campaigns offer one three-wave continuation; tutorial and lab remain bounded", () => {
  assert.equal(LEVELS[0].continuation, undefined);
  assert.equal(LEVELS[CARRIER_TEST_INDEX].continuation, undefined);
  for (const index of [1, 2]) {
    assert.equal(LEVELS[index].waves.length, 5);
    assert.equal(LEVELS[index].continuation.length, 3);
    const run = createRun(index);
    assert.equal(beginContinuation(run), false);
    run.phase = "win";
    run.waveIndex = 3;
    assert.equal(beginContinuation(run), false, "an earlier victory-shaped state is insufficient");
    run.waveIndex = 4;
    run.phase = "lose";
    assert.equal(beginContinuation(run), false);
  }
  assert.equal(beginContinuation(campaignVictory(0)), false);
  assert.equal(beginContinuation(campaignVictory(CARRIER_TEST_INDEX)), false);
});

test("Continuation retains resources and fleet, clones fresh schedules and waits for manual launch", () => {
  storage();
  for (const index of [1, 2]) {
    const run = campaignVictory(index),
      fleet = run.drones,
      drone = run.drones[0],
      save = run.save;
    const originalWaves = [...run.waves];
    const before = { scrap: run.scrap, core: run.core, kills: run.kills, nextId: run.nextDroneId };
    assert.equal(beginContinuation(run), true);
    assert.equal(run.phase, "play");
    assert.equal(run.continued, true);
    assert.equal(run.waves.length, 8);
    assert.equal(run.waveIndex, 4);
    assert.equal(run.waveMode, "manual");
    assert.equal(run.rest, 8);
    assert.strictEqual(run.drones, fleet);
    assert.strictEqual(run.drones[0], drone);
    assert.strictEqual(run.save, save);
    assert.deepEqual({ scrap: run.scrap, core: run.core, kills: run.kills, nextId: run.nextDroneId }, before);
    originalWaves.forEach((wave, i) => assert.strictEqual(run.waves[i], wave));
    run.waves.slice(5).forEach((wave, i) => {
      const source = run.level.continuation[i];
      assert.notStrictEqual(wave, source);
      assert.notStrictEqual(wave.groups, source.groups);
      wave.groups.forEach((group, j) => {
        assert.notStrictEqual(group, source.groups[j]);
        assert.equal(group.spawned, 0);
        const { spawned, ...schedule } = group;
        assert.deepEqual(schedule, source.groups[j]);
      });
    });
    step(run, input(), 120);
    assert.equal(run.waveIndex, 4);
    assert.equal(run.rest, 8);
    assert.ok(run.waves.slice(5).every((w) => w.groups.every((g) => g.spawned === 0)));
    nextWaveNow(run);
    assert.equal(run.waveIndex, 5);
    assert.equal(run.rest, 0);
    step(run, input(), 0.7);
    assert.ok(run.waves[5].groups.some((g) => g.spawned > 0));
    assert.ok(run.level.continuation.every((w) => w.groups.every((g) => g.spawned === undefined)));
    assert.equal(beginContinuation(run), false);
    assert.equal(run.waves.length, 8);
    assert.equal(createRun(index).waves.length, 5, "another run starts with the original campaign");
  }
});

test("Winning or losing an extension cannot rewrite the recorded five-wave campaign result", () => {
  for (const outcome of ["win", "lose"]) {
    const store = storage(),
      run = campaignVictory(1);
    assert.equal(store.writes.length, 1);
    const saved = store.data.get("helix-hold-v2"),
      recorded = run.save;
    assert.equal(JSON.parse(saved).bestByLevel.shear, 81);
    assert.equal(beginContinuation(run), true);
    run.waveIndex = 7;
    run.rest = 0;
    for (const wave of run.waves) for (const group of wave.groups) group.spawned = group.count;
    if (outcome === "lose") {
      Object.assign(run.enemies[0], {
        alive: true,
        pathIndex: 0,
        dist: run.paths[0].length,
        speed: 0,
        leak: 100,
      });
    } else run.core = 99; // Even a better extension result must not replace the campaign record.
    step(run, input(), 0.01);
    assert.equal(run.phase, outcome);
    assert.equal(store.writes.length, 1);
    assert.equal(store.data.get("helix-hold-v2"), saved);
    assert.strictEqual(run.save, recorded);
    assert.equal(beginContinuation(run), false);
    assert.equal(run.waves.length, 8);
  }
});

console.log(`\n${checks} revision and continuation checks passed.`);
