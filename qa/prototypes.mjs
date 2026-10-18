// Prototype integration contracts. These are source/simulation/Three allocation
// checks, not browser rendering, human playability or survival-balance evidence.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents:
      'export * from "./src/game/sim"; export * from "./src/game/paths"; export { traceRelay } from "./src/game/relay"; export { buildEnemyVisualPool, buildRelayTraceVisual } from "./src/game/scene"; export { Scene, CylinderGeometry, Texture, Matrix4, Vector3, Quaternion, Color } from "three";',
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
  FRONTIER_INDEX,
  RELAY_LAB_INDEX,
  createRun,
  getDroneLimit,
  availableDroneModes,
  getCoverageTiming,
  getPlacementPreview,
  getBeamCoverage,
  getLaneFirstWave,
  getLaneStatus,
  beginContinuation,
  beginWave,
  nextWaveNow,
  step,
} = api;
const prototypes = [FRONTIER_INDEX, RELAY_LAB_INDEX];
const neutral = () => ({
  thrust: 0,
  steer: 0,
  pitch: 0,
  boost: false,
  anchor: false,
  expand: false,
  shift: 0,
});
const dt = 1 / 60;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
let checks = 0;
function test(name, body) {
  body();
  checks++;
  console.log(`✓ ${name}`);
}
function advance(run, seconds) {
  for (let t = 0; t < seconds; t += dt) step(run, neutral(), dt);
}
function quietPilot(run) {
  Object.assign(run.ship, { x: 49, y: 43, z: 0, yaw: -Math.PI / 2, pitch: 0, vx: 0, vy: 0, vz: 0 });
  Object.assign(run, { aimx: 1, aimy: 0, aimz: 0 });
}
function finishWave(run) {
  for (const enemy of run.enemies) enemy.alive = false;
  for (const group of run.waves[run.waveIndex].groups) group.spawned = group.count;
  run.rest = 0;
  step(run, neutral(), dt);
}

test("The five existing arenas retain their authored schedules, continuation and roster/economy settings", () => {
  assert.deepEqual(
    LEVELS.slice(0, 5).map((l) => l.id),
    ["tutorial", "shear", "orbital", "carrier-test", "split-crown"],
  );
  // Recorded directly from the v0.8.1 source at 1c85f39, before prototype edits.
  // No computed path samples/lengths or camera angles enter this exact hash.
  const authored = LEVELS.slice(0, 5).map(
    ({
      id,
      hpMul,
      speedMul,
      waves,
      continuation,
      droneRoster,
      dronePricing,
      fleetGrowth,
      experiment,
      stasisAvailable,
      sweepDps,
      primaryPath,
    }) => ({
      id,
      hpMul,
      speedMul,
      waves,
      continuation,
      droneRoster,
      dronePricing,
      fleetGrowth,
      experiment,
      stasisAvailable,
      sweepDps,
      primaryPath,
    }),
  );
  assert.equal(
    createHash("sha256").update(JSON.stringify(authored)).digest("hex"),
    "75e202f0f67383e1f058894fc1c536a4053dc265b64a72c60057a96aae68fd0c",
  );
  assert.ok(LEVELS.slice(0, 5).every((l) => !l.prototype));
});

test("Prototype entry uses independent run state, explicit rosters and scrap-funded fleet growth", () => {
  assert.equal(LEVELS[FRONTIER_INDEX].id, "helix-frontier");
  assert.equal(LEVELS[RELAY_LAB_INDEX].id, "relay-lab");
  assert.deepEqual(availableDroneModes(LEVELS[FRONTIER_INDEX]), [
    "pierce",
    "sweep",
    "stasis",
    "halo",
    "pin",
    "tripwire",
  ]);
  assert.deepEqual(availableDroneModes(LEVELS[RELAY_LAB_INDEX]), [
    "pierce",
    "sweep",
    "stasis",
    "pin",
    "lumen",
    "relay",
  ]);
  for (const index of prototypes) {
    const level = LEVELS[index],
      authored = JSON.stringify(level.waves);
    const a = createRun(index),
      b = createRun(index);
    assert.equal(level.experiment, true);
    assert.equal(getDroneLimit(level), Infinity);
    assert.equal(level.dronePricing, "per-type");
    assert.equal(a.scrap, index === FRONTIER_INDEX ? 60 : 100);
    assert.equal(a.waves.length, index === FRONTIER_INDEX ? 9 : 4);
    assert.equal(a.routeGhost, true);
    a.waves[0].groups[0].spawned = 3;
    a.waves[0].groups[0].count = 99;
    a.scrap = 0;
    assert.equal(b.waves[0].groups[0].spawned, 0);
    assert.equal(b.waves[0].groups[0].count, level.waves[0].groups[0].count);
    assert.equal(JSON.stringify(level.waves), authored);
  }
});

test("Winning or losing either prototype cannot write campaign records or offer Crown continuation", () => {
  const saved = JSON.stringify({
    version: 2,
    bestByLevel: { tutorial: 92, shear: 80, orbital: -1, "split-crown": 98 },
    legacyBestByLevel: {},
  });
  const data = new Map([["helix-hold-v2", saved]]),
    writes = [];
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      writes.push([key, value]);
      data.set(key, value);
    },
  };
  for (const index of prototypes)
    for (const outcome of ["win", "lose"]) {
      const run = createRun(index);
      quietPilot(run);
      const authored = JSON.stringify(run.level.waves),
        transitions = [];
      run.onPhase = (phase) => transitions.push(phase);
      run.waveIndex = run.waves.length - 1;
      run.rest = 0;
      if (outcome === "win") finishWave(run);
      else {
        Object.assign(run.enemies[0], {
          alive: true,
          pathIndex: 0,
          dist: run.paths[0].length,
          speed: 0,
          leak: 100,
        });
        step(run, neutral(), dt);
      }
      assert.equal(run.phase, outcome);
      assert.deepEqual(transitions, [outcome]);
      assert.equal(run.save, undefined);
      assert.equal(beginContinuation(run), false);
      assert.equal(JSON.stringify(run.level.waves), authored);
      assert.equal(data.get("helix-hold-v2"), saved);
      assert.equal(writes.length, 0);
    }
});

test("Both prototypes begin with unlimited manual setup and preserve it between waves and through pause", () => {
  for (const index of prototypes) {
    const run = createRun(index);
    quietPilot(run);
    assert.equal(run.waveMode, "manual");
    advance(run, 60);
    assert.equal(run.waveIndex, -1);
    assert.equal(run.rest, 12);
    assert.equal(run.enemies.filter((e) => e.alive).length, 0);
    nextWaveNow(run);
    assert.equal(run.waveIndex, 0);
    finishWave(run);
    assert.equal(run.rest, 8);
    advance(run, 60);
    assert.equal(run.waveIndex, 0);
    assert.equal(run.rest, 8);
    run.phase = "pause";
    const before = JSON.stringify({
      time: run.time,
      waveTime: run.waveTime,
      ship: run.ship,
      waves: run.waves,
    });
    run.routeGhost = !run.routeGhost;
    step(run, { ...neutral(), thrust: 1, expand: true }, 1);
    assert.equal(
      JSON.stringify({ time: run.time, waveTime: run.waveTime, ship: run.ship, waves: run.waves }),
      before,
    );
  }
});

test("Frontier forecast and coverage distinguish its wave 1/3/6 openings without deleting future geometry", () => {
  const allLanes = {
    segments: [0, 1, 2].map((pathIndex) => ({ pathIndex, points: [], metres: 2 ** pathIndex })),
    metres: 7,
    sampleRadius: 0.72,
  };
  const run = createRun(FRONTIER_INDEX);
  assert.deepEqual(
    run.paths.map((_, i) => getLaneFirstWave(run, i)),
    [1, 3, 6],
  );
  const p = run.paths[2].pointAt(15);
  Object.assign(run.ship, { x: p.x - p.tx * 6, y: p.y - p.ty * 6, z: p.z - p.tz * 6 });
  Object.assign(run, { aimx: p.tx, aimy: p.ty, aimz: p.tz });
  let segments;
  for (const [wave, expected] of [
    [1, 1],
    [3, 3],
    [6, 7],
  ]) {
    run.waveIndex = wave - 2;
    run.rest = 8;
    assert.deepEqual(getCoverageTiming(run, allLanes), {
      nowMetres: expected,
      laterMetres: 7 - expected,
      idleMetres: 0,
    });
    assert.equal(getLaneStatus(run, 2), wave < 6 ? "dormant" : "upcoming");
    const preview = getPlacementPreview(run),
      raw = getBeamCoverage(run, preview.beam);
    assert.ok(
      preview.segments.some((s) => s.pathIndex === 2),
      "future North Vault contact remains previewable",
    );
    assert.deepEqual(preview.segments, raw.segments);
    if (segments)
      assert.deepEqual(preview.segments, segments, "forecast changes classification, not geometric coverage");
    segments = preview.segments;
    near(preview.nowMetres + preview.laterMetres + preview.idleMetres, preview.metres);
  }
  const relay = createRun(RELAY_LAB_INDEX);
  relay.waveIndex = 0;
  relay.rest = 8; // Wave 2 sends B only, while A returns later.
  assert.deepEqual(
    getCoverageTiming(relay, { ...allLanes, segments: allLanes.segments.slice(0, 2), metres: 3 }),
    { nowMetres: 2, laterMetres: 1, idleMetres: 0 },
  );
});

test("Leaks resolve at each actual prism port, with one core charge and a matching effect location", () => {
  for (const index of prototypes) {
    for (const pathIndex of LEVELS[index].paths.keys()) {
      const run = createRun(index);
      quietPilot(run);
      const path = run.paths[pathIndex],
        port = path.pointAt(path.length);
      beginWave(run, 0);
      for (const group of run.waves[0].groups) group.spawned = group.count;
      Object.assign(run.enemies[0], { alive: true, pathIndex, dist: path.length - 0.3, speed: 0, leak: 7 });
      step(run, neutral(), dt);
      assert.equal(run.core, 93);
      assert.equal(run.enemies[0].alive, false);
      assert.deepEqual(
        run.fx.filter((fx) => fx.type === "leak"),
        [{ type: "leak", x: port.x, y: port.y, z: port.z }],
      );
      assert.equal(run.lastBreach.pathIndex, pathIndex);
      assert.ok(
        Math.hypot(port.x, port.y - 4.4, port.z) > 1,
        "the prism port is not the old shared core point",
      );
    }
  }
});

test("An 80-enemy due burst grows past 64 immediately without changing spawn order, timers or randomness", () => {
  function burst(preallocate) {
    const run = createRun(FRONTIER_INDEX, 12345);
    quietPilot(run);
    if (preallocate) while (run.enemies.length < 128) run.enemies.push({ ...run.enemies[0] });
    run.waves = [{ groups: [{ kind: "wisp", path: 0, count: 80, interval: 0, delay: 0, spawned: 0 }] }];
    beginWave(run, 0);
    step(run, neutral(), dt);
    return run;
  }
  const grown = burst(false),
    roomy = burst(true);
  assert.ok(grown.enemies.length >= 80);
  assert.equal(grown.enemies.filter((e) => e.alive).length, 80);
  assert.equal(grown.waves[0].groups[0].spawned, 80, "capacity does not postpone authored due spawns");
  assert.equal(grown.waveTime, roomy.waveTime);
  assert.equal(grown.randomState, roomy.randomState, "allocating slots consumes no random numbers");
  assert.deepEqual(grown.enemies, roomy.enemies);
  assert.ok(
    grown.enemies
      .filter((e) => e.alive)
      .every(
        (e) => e.dist === 0 && e.pinSlowRemaining === 0 && e.lumenSlowRemaining === 0 && e.speedScale === 1,
      ),
  );

  // Reuse a slot in the newly allocated half after giving it every stale combat
  // status. Other earlier slots stay alive, ensuring this exact slot is chosen.
  const recycled = grown.enemies[70];
  Object.assign(recycled, {
    alive: false,
    kind: "carrier",
    pathIndex: 2,
    hp: -1,
    maxHp: 999,
    speed: 999,
    speedScale: 0.1,
    stasisSeen: true,
    pinSlowRemaining: 20,
    lumenSlowRemaining: 30,
    hit: true,
    radius: 999,
    reward: 999,
    leak: 999,
    amp: 999,
    x: 999,
    y: 999,
    z: 999,
  });
  grown.waves[0].groups.push({ kind: "barge", path: 1, count: 1, interval: 1, delay: 0, spawned: 0 });
  step(grown, neutral(), dt);
  assert.strictEqual(grown.enemies[70], recycled);
  assert.equal(recycled.alive, true);
  assert.equal(recycled.kind, "barge");
  assert.equal(recycled.pathIndex, 1);
  assert.equal(recycled.hp, 96);
  assert.equal(recycled.maxHp, 96);
  assert.equal(recycled.speed, 6 * grown.level.speedMul);
  assert.equal(recycled.dist, 0);
  assert.equal(recycled.speedScale, 1);
  assert.equal(recycled.stasisSeen, false);
  assert.equal(recycled.pinSlowRemaining, 0);
  assert.equal(recycled.lumenSlowRemaining, 0);
  assert.equal(recycled.hit, false);
  assert.equal(recycled.radius, 1.25);
  assert.equal(recycled.reward, 18);
  assert.equal(recycled.leak, 14);
  assert.equal(recycled.amp, 0);
  const origin = grown.paths[1].pointAt(0);
  for (const key of ["x", "y", "z", "tx", "ty", "tz"]) assert.equal(recycled[key], origin[key]);
});

test("All enemy render buffers grow past 64 together and release superseded GPU objects without disposing shared assets", () => {
  const { Scene, CylinderGeometry, Texture, Matrix4, Vector3, Quaternion, Color, buildEnemyVisualPool } = api;
  const scene = new Scene(),
    beam = new CylinderGeometry(),
    texture = new Texture();
  const pool = buildEnemyVisualPool(scene, beam, texture);
  const renderSlots = () => [
    ...Object.values(pool.meshes),
    ...Object.values(pool.accentMeshes),
    pool.enemyHalos,
    pool.enemyTrails,
    pool.slowBrackets,
    pool.wispFootprints,
  ];
  const childCount = scene.children.length;
  const sharedGeometries = new Set(renderSlots().map((m) => m.geometry)),
    sharedMaterials = new Set(renderSlots().map((m) => m.material));
  let geometryDisposals = 0,
    materialDisposals = 0;
  sharedGeometries.forEach((g) => g.addEventListener("dispose", () => geometryDisposals++));
  sharedMaterials.forEach((m) => m.addEventListener("dispose", () => materialDisposals++));
  const tethers = pool.wispTethers;
  for (const needed of [80, 200]) {
    const previous = renderSlots(),
      oldTetherGeometry = pool.wispTetherGeo;
    let retired = 0,
      retiredTether = 0;
    previous.forEach((mesh) => mesh.addEventListener("dispose", () => retired++));
    oldTetherGeometry.addEventListener("dispose", () => retiredTether++);
    pool.ensure(needed);
    assert.ok(pool.capacity >= needed);
    assert.equal(scene.children.length, childCount);
    assert.equal(retired, previous.length);
    assert.equal(retiredTether, 1);
    previous.forEach((mesh) => assert.equal(mesh.parent, null));
    for (const mesh of renderSlots()) {
      assert.equal(mesh.parent, scene);
      assert.equal(mesh.frustumCulled, false);
      assert.ok(mesh.instanceMatrix.count >= needed);
      assert.equal(mesh.count, 0, "fresh buffers wait for the next sync, never display stale instances");
      const matrix = new Matrix4().makeTranslation(needed, 20, -5);
      mesh.setMatrixAt(needed - 1, matrix);
      mesh.setColorAt(needed - 1, new Color(0xff826f));
      const actual = new Matrix4(),
        position = new Vector3();
      mesh.getMatrixAt(needed - 1, actual);
      actual.decompose(position, new Quaternion(), new Vector3());
      assert.equal(position.x, needed);
      assert.ok(mesh.instanceColor.count >= needed);
    }
    assert.equal(pool.wispTethers, tethers);
    assert.equal(tethers.geometry, pool.wispTetherGeo);
    assert.ok(pool.wispTetherPos.length >= needed * 6);
    assert.equal(pool.wispTetherGeo.attributes.position.array, pool.wispTetherPos);
    assert.equal(geometryDisposals, 0);
    assert.equal(materialDisposals, 0);
  }
  const retained = renderSlots();
  pool.ensure(1);
  assert.deepEqual(renderSlots(), retained, "smaller populations reuse the grown pool");
  for (const mesh of retained) mesh.dispose();
  sharedGeometries.forEach((g) => g.dispose());
  sharedMaterials.forEach((m) => m.dispose());
  pool.wispTetherGeo.dispose();
  tethers.material.dispose();
  texture.dispose();
  assert.equal(geometryDisposals, sharedGeometries.size);
  assert.equal(materialDisposals, sharedMaterials.size);
});

test("Relay visuals keep possible output distinct from powered output when an upstream enemy cuts the link", () => {
  const { Scene, CylinderGeometry, traceRelay, buildRelayTraceVisual } = api;
  const scene = new Scene(),
    geometry = new CylinderGeometry();
  const beam = { x: 0, y: 10, z: 0, dx: 1, dy: 0, dz: 0, radius: 1.1, range: 76, dps: 8, pierces: false };
  const receiver = { id: 2, x: 20, y: 10, z: 0, ax: 0, ay: 0, az: 1, radius: 1 };
  const planned = traceRelay(1, beam, [receiver]);
  const blocked = traceRelay(1, beam, [receiver], [{ x: 10, y: 10, z: 0, radius: 0.72 }]);
  const visual = buildRelayTraceVisual(scene, geometry);
  visual.sync([planned], [planned], true);
  assert.equal(visual.group.children.length, 2);
  for (const segment of visual.group.children) assert.equal(segment.children[1].visible, true);
  visual.sync([planned], [blocked], true);
  const [incoming, outgoing] = visual.group.children;
  assert.equal(incoming.children[1].visible, true);
  assert.equal(incoming.children[1].scale.z, 10, "live incoming light stops at the enemy");
  assert.equal(outgoing.visible, true, "planned redirection remains discoverable");
  assert.equal(outgoing.children[0].visible, true);
  assert.equal(
    outgoing.children[1].visible,
    false,
    "outgoing light does not appear powered through the blocker",
  );
  near(outgoing.children[2].scale.z, planned.segments[1].beam.range);
  const preview = buildRelayTraceVisual(scene, geometry, true);
  preview.sync([planned]);
  for (const [i, segment] of preview.group.children.entries()) {
    const expected = planned.segments[i].beam;
    assert.equal(segment.children[1].visible, false, "an unbought proposal never masquerades as live power");
    assert.equal(segment.children[2].visible, true);
    near(segment.children[2].scale.x, expected.radius);
    near(segment.children[2].scale.z, expected.range);
    near(segment.children[3].position.z, expected.range);
  }
  visual.sync([]);
  preview.sync([]);
  assert.ok(
    [...visual.group.children, ...preview.group.children].every((segment) => !segment.visible),
    "obsolete output segments disappear when links are removed",
  );
  const geometries = new Set(),
    materials = new Set();
  scene.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
});

console.log(`\n${checks} prototype integration checks passed. No browser or human playtest performed.`);
