// Deterministic simulation checks; no browser, WebGL, or dev server required.
// Run: node qa/simulation.mjs
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: 'export * from "./src/game/sim"; export * from "./src/game/combat"; export * from "./src/game/paths";',
    resolveDir: new URL("../", import.meta.url).pathname,
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const {
  createRun, step, tryAnchor, placementStatus, getPlacementPreview, recallLast,
  nextWaveNow, setWaveMode, getBeamCoverage, droneBeam, beamContact, selectBeamTargets,
  DRONE_SPECS, anchorCost, buildPath, LEVELS, CARRIER_TEST_INDEX, insideStasis, enemySpeedScale, getFieldCoverage,
} = api;
globalThis.localStorage = { getItem: () => null, setItem() {} };
const input = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
let checks = 0;
function test(name, fn) {
  fn();
  checks += 1;
  console.log(`✓ ${name}`);
}
const beam = (mode) => ({ x: 0, y: 8, z: 0, dx: 0, dy: 0, dz: -1, ...DRONE_SPECS[mode] });
const target = (z, x = 0) => ({ x, y: 8, z, radius: 0.72 });

test("Pierce hits every collinear foe; Sweep selects nearest regardless of array order", () => {
  const far = target(-20), close = target(-8), offLine = target(-12, 4);
  assert.deepEqual(selectBeamTargets(beam("pierce"), [far, offLine, close]), [far, close]);
  assert.deepEqual(selectBeamTargets(beam("sweep"), [far, offLine, close]), [close]);
});

test("Finite laser geometry respects muzzle, range, hull radius and mode widths", () => {
  assert.equal(beamContact(beam("pierce"), target(2)), null);
  assert.equal(beamContact(beam("pierce"), target(-0.39)), null);
  assert.equal(beamContact(beam("pierce"), target(-76.01)), null);
  assert.equal(beamContact(beam("pierce"), target(-10, 2.17)), 10);
  assert.equal(beamContact(beam("pierce"), target(-10, 2.18)), null);
  assert.equal(beamContact(beam("sweep"), target(-10, 3.2)), 10);
  assert.equal(beamContact(beam("sweep"), target(-39)), null);
});

function combatRun(mode) {
  const run = createRun(0);
  run.paths = [buildPath("test-line", (t) => ({ x: 0, y: 8, z: -50 * t }))];
  run.waves = [{ groups: [] }];
  run.waveIndex = 0;
  run.rest = 0;
  Object.assign(run.ship, { x: 40, y: 30, z: 30, yaw: 0, pitch: 0 });
  const d = {
    id: 1, mode, paid: 20, kills: 0, damage: 0, hit: false,
    bx: 0, by: 8, bz: 0, fx: 0, fy: 0, fz: -1,
    x: 0, y: 8, z: 0, ax: 0, ay: 0, az: -1,
  };
  run.drones.push(d);
  [20, 8].forEach((dist, i) => Object.assign(run.enemies[i], {
    ...target(-dist), alive: true, dist, speed: 0, amp: 0, hp: 100, maxHp: 100,
    pathIndex: 0, kind: "shard", reward: 8, leak: 7,
  }));
  return run;
}

test("Actual simulation applies Pierce damage to both targets and Sweep only to the nearer", () => {
  const pierce = combatRun("pierce"), sweep = combatRun("sweep");
  step(pierce, input(), 0.25);
  step(sweep, input(), 0.25);
  near(pierce.enemies[0].hp, 95);
  near(pierce.enemies[1].hp, 95);
  near(pierce.drones[0].damage, 10);
  near(sweep.enemies[0].hp, 100);
  near(sweep.enemies[1].hp, 95.5);
  assert.equal(pierce.drones[0].hit, true);
  assert.equal(sweep.enemies[0].hit, false);
});

test("Contribution counts effective damage and attributed kills; dead targets do not block Sweep", () => {
  const run = combatRun("sweep");
  run.enemies[1].hp = 1;
  const scrap = run.scrap;
  step(run, input(), 0.1);
  assert.equal(run.drones[0].kills, 1);
  near(run.drones[0].damage, 1);
  assert.equal(run.scrap, scrap + 8);
  step(run, input(), 0.1);
  near(run.enemies[0].hp, 98.2);
  near(run.drones[0].damage, 2.8);
});

test("Coverage brackets exactly the same shard-center samples that the combat helper hits", () => {
  const path = buildPath("crossing", (t) => ({ x: -5 + t * 10, y: 8, z: -10 }));
  for (const mode of ["pierce", "sweep"]) {
    const result = getBeamCoverage({ paths: [path] }, beam(mode));
    near(result.sampleRadius, 0.72);
    let expected = 0;
    const count = Math.ceil(path.length / 0.5), ds = path.length / count;
    for (let i = 0; i < count; i++) {
      const sample = path.pointAt((i + 0.5) * ds);
      if (beamContact(beam(mode), { ...sample, radius: result.sampleRadius }) !== null) expected += ds;
    }
    near(result.metres, expected);
    assert.ok(result.metres > 0);
    for (const segment of result.segments) {
      assert.equal(segment.pathIndex, 0);
      for (let i = 1; i < segment.points.length; i++) {
        const a = segment.points[i - 1], b = segment.points[i];
        const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, radius: 0.72 };
        assert.notEqual(beamContact(beam(mode), midpoint), null);
      }
    }
  }
});

test("Tutorial preview introduces lower-coil coverage with wave 3; open arenas retain every route", () => {
  const aimAlongRoute = (run, pathIndex) => {
    const p = run.paths[pathIndex].pointAt(10);
    Object.assign(run.ship, { x: p.x - p.tx * 6, y: p.y - p.ty * 6, z: p.z - p.tz * 6 });
    Object.assign(run, { aimx: p.tx, aimy: p.ty, aimz: p.tz });
  };
  const run = createRun(0);
  aimAlongRoute(run, 1);
  const initial = getPlacementPreview(run);
  const raw = getBeamCoverage(run, initial.beam);
  assert.equal(initial.status, null, "this is a legal placement, not a rejection artifact");
  assert.ok(raw.metres > 10, "the dormant lower coil physically intersects the beam");
  assert.ok(raw.segments.every((segment) => segment.pathIndex === 1));
  assert.equal(initial.metres, 0, "initial setup must not endorse a future-only line");
  assert.deepEqual(initial.segments, []);
  for (const waveIndex of [0, 1]) {
    run.waveIndex = waveIndex;
    run.rest = 0;
    assert.equal(getPlacementPreview(run).metres, 0, "both first lessons still use only the high curl");
  }
  run.rest = 8;
  const announced = getPlacementPreview(run);
  near(announced.metres, raw.metres);
  assert.deepEqual(announced.segments, raw.segments, "wave-3 setup announces the lower coil before launch");
  run.waveIndex = 2;
  run.rest = 0;
  near(getPlacementPreview(run).metres, raw.metres, 1e-8);
  for (const index of [1, 2]) {
    const openArena = createRun(index);
    aimAlongRoute(openArena, 1);
    const preview = getPlacementPreview(openArena);
    const full = getBeamCoverage(openArena, preview.beam);
    assert.ok(full.segments.some((segment) => segment.pathIndex === 1));
    near(preview.metres, full.metres);
    assert.deepEqual(preview.segments, full.segments, "open arenas show future routes from their first setup");
  }
});

test("Held fan/slide preview equals the first anchored frame; rest pose remains fixed", () => {
  const run = createRun(0);
  run.ship.x += 5;
  run.expand = 0.7;
  run.shift = -0.6;
  run.droneMode = "sweep";
  const preview = getPlacementPreview(run);
  assert.equal(preview.status, null);
  assert.equal(tryAnchor(run), null);
  assert.deepEqual(run.drones[0], preview.drone);
  assert.deepEqual(droneBeam(run.drones[0]), preview.beam);
  const base = [run.drones[0].bx, run.drones[0].by, run.drones[0].bz];
  step(run, input(), 0.1);
  assert.deepEqual([run.drones[0].bx, run.drones[0].by, run.drones[0].bz], base);
  assert.notEqual(run.drones[0].x, preview.drone.x);
});

test("Opening budget funds two drones; recall refunds each paid price and never reuses ids", () => {
  const run = createRun(0);
  assert.equal(run.scrap, 60);
  assert.ok(placementStatus(run));
  run.ship.x += 5;
  assert.equal(tryAnchor(run), null);
  assert.equal(run.scrap, 40);
  const firstId = run.drones[0].id;
  run.ship.x -= 5;
  assert.equal(tryAnchor(run), null);
  assert.equal(run.scrap, 8);
  assert.equal(run.drones[1].paid, 32);
  assert.equal(anchorCost(2), 44);
  assert.equal(recallLast(run), null);
  assert.equal(run.scrap, 40);
  assert.equal(recallLast(run), null);
  assert.equal(run.scrap, 60);
  assert.equal(run.expand, 0);
  assert.equal(run.shift, 0);
  assert.ok(recallLast(run));
  assert.equal(run.scrap, 60);
  run.ship.x += 5;
  assert.equal(tryAnchor(run), null);
  assert.ok(run.drones[0].id > firstId);
});

test("Every arena starts and returns to its own hangar with consistent aim", () => {
  LEVELS.forEach((level, index) => {
    const run = createRun(index);
    for (const key of ["x", "y", "z", "yaw", "pitch"]) near(run.ship[key], level.hangar[key]);
    run.ship.x += 5;
    assert.equal(tryAnchor(run), null);
    for (const key of ["x", "y", "z", "yaw", "pitch"]) near(run.ship[key], level.hangar[key]);
    near(Math.hypot(run.aimx, run.aimy, run.aimz), 1);
  });
});

test("Manual preparation waits indefinitely while flying and anchoring remain live", () => {
  const run = createRun(0);
  assert.equal(run.waveMode, "manual");
  assert.equal(run.waveIndex, -1);
  const start = { x: run.ship.x, y: run.ship.y, z: run.ship.z };
  for (let i = 0; i < 60; i++) step(run, { ...input(), thrust: 1 }, 1 / 60);
  assert.notEqual(run.ship.z, start.z);
  step(run, { ...input(), anchor: true }, 1 / 60);
  assert.equal(run.drones.length, 1);
  assert.equal(run.scrap, 40);
  for (let i = 0; i < 180 * 60; i++) step(run, input(), 1 / 60);
  assert.equal(run.waveIndex, -1);
  assert.equal(run.rest, 12);
  assert.equal(run.waveTime, 0);
  assert.equal(run.enemies.some((e) => e.alive), false);
  assert.ok(run.waves.every(w => w.groups.every(g => g.spawned === 0)));
  nextWaveNow(run);
  nextWaveNow(run);
  assert.equal(run.waveIndex, 0, "repeated launch presses cannot skip a wave");
  assert.equal(run.rest, 0);
  step(run, input(), 0.8);
  assert.ok(run.waves[0].groups.some(g => g.spawned > 0));
});

function betweenWaves() {
  const run = combatRun("pierce");
  run.waves = [
    { groups: [{ kind: "shard", path: 0, count: 1, interval: 1, delay: 0, spawned: 1 }] },
    { groups: [{ kind: "shard", path: 0, count: 1, interval: 1, delay: 0, spawned: 0 }] },
  ];
  run.enemies.forEach(e => { e.alive = false; });
  step(run, input(), 1 / 60);
  return run;
}

test("Manual interwave preparation stays open until the next explicit launch", () => {
  const run = betweenWaves();
  assert.equal(run.rest, 8);
  const waveTime = run.waveTime;
  for (let i = 0; i < 120 * 60; i++) step(run, input(), 1 / 60);
  assert.equal(run.rest, 8);
  assert.equal(run.waveIndex, 0);
  assert.equal(run.waveTime, waveTime);
  assert.equal(run.waves[1].groups[0].spawned, 0);
  nextWaveNow(run);
  nextWaveNow(run);
  assert.equal(run.waveIndex, 1);
  assert.equal(run.rest, 0);
  step(run, input(), 1 / 60);
  assert.equal(run.waves[1].groups[0].spawned, 1);
});

test("Automatic progression counts down; opting in grants a fresh full setup window", () => {
  const initial = createRun(0);
  setWaveMode(initial, "auto");
  assert.equal(initial.rest, 12);
  for (let i = 0; i < 119; i++) step(initial, input(), 0.1);
  assert.equal(initial.waveIndex, -1);
  assert.ok(initial.rest > 0 && initial.rest < 0.11);
  setWaveMode(initial, "manual");
  const heldRest = initial.rest;
  step(initial, input(), 30);
  assert.equal(initial.rest, heldRest);
  setWaveMode(initial, "auto");
  assert.equal(initial.rest, 12);
  step(initial, input(), 1);
  setWaveMode(initial, "auto");
  assert.equal(initial.rest, 11, "repeatedly applying the same preference does not restart the timer");
  step(initial, input(), 11.01);
  assert.equal(initial.waveIndex, 0);
  assert.equal(initial.rest, 0);
  setWaveMode(initial, "manual");
  setWaveMode(initial, "auto");
  assert.equal(initial.rest, 0, "changing mode during a wave never creates a setup break");
  const between = betweenWaves();
  setWaveMode(between, "auto");
  step(between, input(), 7.9);
  setWaveMode(between, "manual");
  step(between, input(), 120);
  assert.equal(between.waveIndex, 0);
  setWaveMode(between, "auto");
  assert.equal(between.rest, 8);
  step(between, input(), 7.9);
  assert.equal(between.waveIndex, 0);
  step(between, input(), 0.2);
  assert.equal(between.waveIndex, 1);
});

test("Paused simulation freezes manual and automatic progression and rejects launch", () => {
  for (const mode of ["manual", "auto"]) {
    const run = createRun(0);
    setWaveMode(run, mode);
    run.phase = "pause";
    const before = JSON.stringify(run);
    step(run, { ...input(), thrust: 1, anchor: true, expand: true }, 2);
    nextWaveNow(run);
    assert.equal(JSON.stringify(run), before);
  }
});

test("Group speed multipliers affect only their own spawned enemies", () => {
  const run = createRun(0);
  run.waves = [{ groups: [
    { kind: "shard", path: 0, count: 1, interval: 1, delay: 0, spawned: 0 },
    { kind: "shard", path: 0, count: 1, interval: 1, delay: 0, spawned: 0, speedMul: 0.55 },
  ] }];
  nextWaveNow(run);
  step(run, input(), 1 / 60);
  const spawned = run.enemies.filter(e => e.alive);
  assert.equal(spawned.length, 2);
  near(spawned[0].speed, 10.4 * run.level.speedMul);
  near(spawned[1].speed, 10.4 * run.level.speedMul * 0.55);
  near(spawned[0].maxHp, spawned[1].maxHp);
});

test("Last wave resolves to win; leaks resolve to lose with lane attribution", () => {
  const win = combatRun("pierce");
  win.waves = [{ groups: [{ kind: "shard", path: 0, count: 1, interval: 1, delay: 0, spawned: 1 }] }];
  win.enemies.forEach((e) => { e.alive = false; });
  step(win, input(), 0.1);
  assert.equal(win.phase, "win");
  const lose = combatRun("pierce");
  lose.core = 1;
  lose.enemies[0].dist = lose.paths[0].length;
  step(lose, input(), 0.1);
  assert.equal(lose.phase, "lose");
  assert.equal(lose.lastBreach.pathIndex, 0);
  assert.equal(lose.lastBreach.at, lose.time);
});

test("Wisp phases are repeatable per seed and differ across seeds", () => {
  const spawn = (seed) => {
    const run = createRun(0, seed);
    run.waves = [{ groups: [{ kind: "wisp", path: 0, count: 1, interval: 1, delay: 0, spawned: 0 }] }];
    nextWaveNow(run);
    step(run, input(), 0.01);
    return run.enemies.find((e) => e.alive).phase;
  };
  assert.equal(spawn(1234), spawn(1234));
  assert.notEqual(spawn(1234), spawn(1235));
});

test("Stasis uses true 3D center distance, a closed 6m boundary, and strongest-only slowing", () => {
  const center = { x: 5, y: 24, z: 0 };
  assert.equal(insideStasis(center, { x: 5, y: 18, z: 0 }), true);
  assert.equal(insideStasis(center, { x: 5, y: 17.999, z: 0 }), false);
  // Shear's two projected crossings occupy different heights.
  assert.equal(insideStasis(center, { x: 5, y: 14, z: 0 }), false);
  const field = { ...center, mode: "stasis" };
  assert.equal(enemySpeedScale({ drones: [field] }, center), 0.5);
  assert.equal(enemySpeedScale({ drones: [field, field, field] }, center), 0.5);
  assert.equal(enemySpeedScale({ drones: [{ ...field, mode: "pierce" }] }, center), 1);
  assert.equal(enemySpeedScale({ drones: [field] }, { ...center, x: 11.001 }), 1);
});

test("Stasis slows actual motion, deals zero damage, and restores speed outside the sphere", () => {
  const run = combatRun("stasis");
  run.enemies[0].alive = false;
  Object.assign(run.enemies[1], { dist: 2, speed: 10, x: 0, y: 8, z: -2 });
  step(run, input(), 0.1);
  near(run.enemies[1].dist, 2.5);
  near(run.enemies[1].speed, 10);
  near(run.enemies[1].hp, 100);
  near(run.drones[0].damage, 0);
  assert.equal(run.drones[0].hit, false);
  Object.assign(run.enemies[1], { dist: 7, z: -7 });
  step(run, input(), 0.1);
  near(run.enemies[1].dist, 8);
  near(run.enemies[1].speedScale, 1);
  // Membership uses the drifted center, not nominal ribbon proximity.
  Object.assign(run.enemies[1], { dist: 2, x: 7, z: -2 });
  step(run, input(), 0.1);
  near(run.enemies[1].dist, 3);
});

test("Field preview matches membership and follows the same fan/slide pose as placement", () => {
  const path = buildPath("field-line", t => ({ x: -10 + 20*t, y: 8, z: 0 }));
  const result = getFieldCoverage({ paths: [path] }, { x: 0, y: 8, z: 0 });
  near(result.metres, 12);
  assert.equal(result.sampleRadius, 0);
  const run = createRun(CARRIER_TEST_INDEX);
  run.ship.x += 5; run.droneMode = "stasis"; run.expand = 0.7; run.shift = -0.6;
  const preview = getPlacementPreview(run);
  assert.equal(tryAnchor(run), null);
  assert.deepEqual(run.drones[0], preview.drone);
  assert.deepEqual(getFieldCoverage(run, run.drones[0]), { segments: preview.segments, metres: preview.metres, sampleRadius: preview.sampleRadius });
  assert.equal(run.scrap, 40);
  assert.equal(recallLast(run), null);
  assert.equal(run.scrap, 60);
});

test("Existing campaign weapons stay unchanged; Stasis is enabled per arena and lab alone tries 22-DPS Sweep", () => {
  assert.deepEqual(LEVELS.slice(0,3).map(l => l.id), ["tutorial", "shear", "orbital"]);
  assert.deepEqual(LEVELS.slice(0,3).map(l => l.waves.length), [5,5,5]);
  for (let index = 0; index < LEVELS.length; index++) {
    const run = createRun(index); run.ship.x += 5; run.droneMode = "stasis";
    assert.equal(placementStatus(run) === null, index === CARRIER_TEST_INDEX || run.level.id === "split-crown");
    run.droneMode = "sweep"; assert.equal(tryAnchor(run), null);
    assert.equal(droneBeam(run.drones[0]).dps, index === CARRIER_TEST_INDEX ? 22 : 18);
    assert.equal(droneBeam(run.drones[0]).pierces, false);
  }
  assert.equal(DRONE_SPECS.pierce.dps, 20);
});

test("Carrier damage is cumulative, breaches cost 40, and experiment outcomes never write campaign scores", () => {
  const writes = [];
  globalThis.localStorage = { getItem: () => null, setItem: (...args) => writes.push(args) };
  const run = combatRun("pierce");
  run.level = LEVELS[CARRIER_TEST_INDEX];
  run.enemies[0].alive = false;
  Object.assign(run.enemies[1], { kind: "carrier", hp: 3, maxHp: 486, leak: 40 });
  step(run, input(), 0.1); near(run.enemies[1].hp, 1);
  step(run, input(), 0.1);
  assert.equal(run.carrierOutcome, "destroyed");
  // Supply a completed schedule so the ordinary completion path runs.
  run.waves = [{ groups: [{ kind:"carrier", path:0, count:1, spawned:1, delay:0, interval:1 }] }];
  step(run, input(), 0.1);
  assert.equal(run.phase, "win"); assert.equal(run.save, undefined); assert.equal(writes.length, 0);
  const breached = combatRun("pierce"); breached.level = LEVELS[CARRIER_TEST_INDEX];
  breached.enemies[0].alive = false;
  Object.assign(breached.enemies[1], { kind: "carrier", dist: 50, leak: 40 });
  step(breached, input(), 0.1);
  assert.equal(breached.core, 60); assert.equal(breached.carrierOutcome, "breached");
  globalThis.localStorage = { getItem: () => null, setItem() {} };
});

test("The first two tutorial waves are achievable through ordinary controls, with a reward for longer lines", () => {
  const hold = (run, seconds, controls = {}) => {
    for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
      step(run, { ...input(), ...controls }, 1 / 60);
      run.fx.length = 0;
    }
  };
  const flyAndAnchor = (run, mode, thrust, rightTurn, raiseAim) => {
    run.droneMode = mode;
    hold(run, thrust, { thrust: 1 });
    hold(run, rightTurn, { steer: -1 });
    hold(run, raiseAim, { pitch: 1 });
    hold(run, 0.5);
    const coverage = getPlacementPreview(run).metres;
    assert.equal(tryAnchor(run), null);
    return coverage;
  };
  const finish = (run) => {
    for (let frame = 0; frame < 240 * 60 && run.phase === "play"; frame++) {
      if (run.rest > 0) {
        if (run.waveIndex >= 1) break;
        nextWaveNow(run);
      }
      step(run, input(), 1 / 60);
      run.fx.length = 0;
    }
    return { phase: run.phase, core: run.core, kills: run.kills, seconds: Number(run.time.toFixed(1)), clearedWaves: run.rest > 0 ? run.waveIndex + 1 : 0 };
  };
  const idle = createRun(0);
  const crossing = createRun(0);
  const crossingCoverage = [
    flyAndAnchor(crossing, "pierce", 0.6, 0, 0),
    flyAndAnchor(crossing, "sweep", 0.35, 0, 0),
  ];
  const along = createRun(0);
  const alongCoverage = [
    flyAndAnchor(along, "pierce", 0.6, 1, 0.1),
    flyAndAnchor(along, "sweep", 0.45, 0.85, 0.1),
  ];
  assert.equal(along.scrap, 8);
  assert.equal(along.waveIndex, -1, "both drones are placed before the player chooses to launch");
  const idleResult = finish(idle), crossingResult = finish(crossing), alongResult = finish(along);
  assert.equal(idleResult.kills, 0, "the unassisted hangar should not clear either wave's enemies");
  assert.equal(crossingResult.clearedWaves, 2, "imperfect early placements leave room for a beginner");
  assert.equal(alongResult.clearedWaves, 2);
  assert.ok(alongResult.core >= 90, "two accessible placements plus the idle pilot can hold the introductory waves");
  assert.ok(crossingResult.core > idleResult.core);
  assert.ok(alongResult.core > crossingResult.core, "longer coverage should have a visible payoff");
  assert.ok(alongCoverage[0] > crossingCoverage[0]);
  console.log(`  Idle: ${JSON.stringify(idleResult)}`);
  console.log(`  Across ribbon (${crossingCoverage.map(n => n.toFixed(1)).join(" / ")}m): ${JSON.stringify(crossingResult)}`);
  console.log(`  Along ribbon (${alongCoverage.map(n => n.toFixed(1)).join(" / ")}m): ${JSON.stringify(alongResult)}`);
});

console.log(`\n${checks} simulation checks passed.`);
