// Split Crown contract checks: authored geometry, gate forecasts and saved identity.
// The companion crown-trial.mjs measures normally funded combat feasibility.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { assertAuthoredBaseline, historical, GEOMETRY_TOLERANCE } from './authored-baseline.mjs';
const bundle = await build({ stdin: { contents: 'export * from "./src/game/sim"; export * from "./src/game/paths"; export * from "./src/game/save";', resolveDir: new URL('../', import.meta.url).pathname }, bundle: true, platform: 'node', format: 'esm', write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { LEVELS, CORE, createRun, step, nextWaveNow, getLaneStatus, getLaneFirstWave, hasStasis, tryAnchor, anchorCost, MAX_DRONES, beginContinuation, loadSave, recordWin } = api;
const index = LEVELS.findIndex(l => l.id === 'split-crown');
assert.ok(index >= 0, 'Split Crown has its own stable identity');
const level = LEVELS[index];
const neutral = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
let checks = 0;
function test(name, fn) { fn(); checks++; console.log(`✓ ${name}`); }
function storage(initial = {}) {
  const data = new Map(Object.entries(initial)); const writes = [];
  globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); writes.push([k, v]); } };
  return { data, writes };
}
storage();
test('Existing authored settings stay exact and computed geometry stays within 1 micrometre of the retained pre-Crown baseline', () => {
  for (const reference of historical.levels) assertAuthoredBaseline(LEVELS.find(l => l.id === reference.id), reference);
});
test('The historical geometry guard accepts sub-tolerance arithmetic noise but rejects changed routes and non-finite samples', () => {
  const reference = historical.levels[0];
  const harmless = structuredClone(reference);
  harmless.paths[0].points[12].x += GEOMETRY_TOLERANCE / 10;
  harmless.paths[0].cum[12] += GEOMETRY_TOLERANCE / 10;
  harmless.paths[0].length += GEOMETRY_TOLERANCE / 10;
  harmless.hangar.yaw += 1e-14;
  assert.doesNotThrow(() => assertAuthoredBaseline(harmless, reference));
  const mutations = [
    l => { l.paths[0].points[12].x += GEOMETRY_TOLERANCE * 2; },
    l => { l.paths[0].cum[12] += GEOMETRY_TOLERANCE * 2; },
    l => { l.paths[0].length += GEOMETRY_TOLERANCE * 2; },
    l => { l.paths[0].points[12].y = NaN; },
    l => { l.paths[0].cum[12] = Infinity; },
    l => { l.paths[0].points.pop(); },
    l => { l.paths[0].cum.pop(); },
    l => { l.hangar.pitch += 1e-6; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(reference); mutate(changed);
    assert.throws(() => assertAuthoredBaseline(changed, reference), assert.AssertionError);
  }
});
test('Geometry tolerance never permits changes to authored IDs, multipliers, hangar positions or wave schedules', () => {
  const reference = historical.levels.find(l => l.id === 'shear');
  const mutations = [
    l => { l.id += '-changed'; },
    l => { l.paths[0].id += '-changed'; },
    l => { l.hpMul += 1e-10; },
    l => { l.speedMul += 1e-10; },
    l => { l.hangar.x += 1e-10; },
    l => { l.waves[0].lesson += ' changed'; },
    l => { l.waves[0].groups[0].count++; },
    l => { l.waves[0].groups[0].path++; },
    l => { l.waves[0].groups[0].kind = 'barge'; },
    l => { l.waves[0].groups[0].interval += 1e-10; },
    l => { l.waves[0].groups[0].delay += 1e-10; },
    l => { l.waves[0].groups[0].speedMul += 1e-10; },
    l => { l.continuation[0].groups[0].count++; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(reference); mutate(changed);
    assert.throws(() => assertAuthoredBaseline(changed, reference), /exact authored settings and schedules/);
  }
});
test('Five finite, traversable routes stay within the existing flight cylinder and join the real core', () => {
  assert.equal(new Set(LEVELS.map(l => l.id)).size, LEVELS.length);
  assert.equal(level.paths.length, 5); assert.equal(level.waves.length, 8);
  assert.ok(level.hangar.y > 1.6 && level.hangar.y < 44 && Math.hypot(level.hangar.x, level.hangar.z) < 52);
  assert.ok(Math.abs(level.hangar.pitch) <= 1.05, 'initial aim is within the pilot pitch limit');
  for (const path of level.paths) {
    assert.ok(path.length > 50 && path.length < 240);
    assert.ok(dist(path.pointAt(path.length), CORE) < 1e-8);
    for (let i = 0; i < path.points.length; i++) {
      const p = path.points[i];
      assert.ok([p.x, p.y, p.z, path.cum[i]].every(Number.isFinite));
      assert.ok(p.y >= 1.6 && p.y <= 44 && Math.hypot(p.x, p.z) <= 52, `${path.id} flight bounds`);
      if (i) assert.ok(path.cum[i] > path.cum[i - 1], `${path.id} positive segments`);
      const q = path.pointAt(path.cum[i]); assert.ok(Math.abs(Math.hypot(q.tx, q.ty, q.tz) - 1) < 1e-8);
    }
  }
});
test('The four regular gates open gradually; the fifth gate carries only the late boss with an authored warning', () => {
  const run = createRun(index);
  assert.deepEqual(level.waves[0].groups.map(g => g.path), [0]);
  const first = level.paths.map((_, i) => getLaneFirstWave(run, i));
  assert.equal(first[0], 1); assert.ok(first[1] >= 2); assert.ok(first[2] >= 3); assert.ok(first[3] >= 4); assert.ok(first[4] >= 7);
  for (const [i, wave] of level.waves.entries()) {
    assert.ok(wave.groups.length > 0);
    for (const group of wave.groups) {
      assert.ok(Number.isInteger(group.path) && group.path >= 0 && group.path < level.paths.length);
      assert.ok(Number.isInteger(group.count) && group.count > 0 && group.interval > 0 && group.delay >= 0);
      if (group.path === 4) { assert.equal(group.kind, 'carrier'); assert.ok(i >= 6); }
    }
  }
  const bossWave = level.waves[first[4] - 1];
  assert.match(`${bossWave.chapter} ${bossWave.lesson}`, /carrier|boss|procession/i);
  assert.ok(bossWave.groups.some(g => g.path !== 4), 'ordinary gates remain relevant during the carrier');
});
test('Setup forecasts, delayed live groups, occupied gates and cleared routes agree with the authored wave', () => {
  const run = createRun(index);
  assert.deepEqual(run.paths.map((_, i) => getLaneStatus(run, i)), ['upcoming', 'dormant', 'dormant', 'dormant', 'dormant']);
  const held = run.rest;
  for (let i = 0; i < 600; i++) step(run, neutral(), 1 / 60);
  assert.equal(run.rest, held); assert.equal(run.waveIndex, -1); assert.ok(run.enemies.every(e => !e.alive));
  for (let wave = 0; wave < run.waves.length; wave++) {
    // This state setup isolates forecast semantics, not economic/combat feasibility.
    run.waveIndex = wave - 1; run.rest = 8;
    run.enemies.forEach(e => { e.alive = false; });
    for (const [lane] of run.paths.entries()) {
      const expected = run.waves[wave].groups.some(g => g.path === lane && g.count > 0);
      if (expected) assert.equal(getLaneStatus(run, lane), 'upcoming', `wave${wave + 1}/lane${lane + 1}`);
    }
    nextWaveNow(run);
    assert.equal(run.waveIndex, wave);
    for (const [lane] of run.paths.entries()) {
      const groups = run.waves[wave].groups.filter(g => g.path === lane);
      if (!groups.length) continue;
      assert.equal(getLaneStatus(run, lane), 'active', 'a delayed group keeps its gate live before spawning');
      groups.forEach(g => { g.spawned = g.count; });
      assert.equal(getLaneStatus(run, lane), 'cleared', 'no pending group or live enemy');
      Object.assign(run.enemies[0], { alive: true, pathIndex: lane });
      assert.equal(getLaneStatus(run, lane), 'active', 'the gate remains active until its final enemy leaves');
      run.enemies[0].alive = false;
    }
  }
});
test('Stasis is available as an ordinary paid slot without raising the starting budget or campaign damage', () => {
  const run = createRun(index);
  assert.equal(run.scrap, 60); assert.equal(MAX_DRONES, 8); assert.equal(run.waveMode, 'manual');
  assert.equal(run.level.experiment, undefined); assert.equal(run.level.sweepDps, undefined); assert.ok(hasStasis(run.level));
  Object.assign(run.ship, { x: -22.3, y: 23.3, z: -13.9 }); run.droneMode = 'stasis';
  assert.equal(tryAnchor(run), null); assert.equal(run.drones[0].paid, 20); assert.equal(run.scrap, 40);
  Object.assign(run.ship, { x: 22.3, y: 21.3, z: -5.9 }); run.droneMode = 'pierce';
  assert.equal(tryAnchor(run), null); assert.equal(run.drones[1].paid, 32); assert.equal(run.scrap, 8);
  assert.equal(anchorCost(run.drones.length), 44);
  assert.equal(beginContinuation(run), false, 'the eight-wave arena is its own campaign, not an appended old clear');
});
test('A Crown clear writes its own score and preserves Orbital, Shear and tutorial identities', () => {
  const initial = { version: 2, bestByLevel: { tutorial: 97, shear: 71, orbital: 83 }, legacyBestByLevel: {} };
  const store = storage({ 'helix-hold-v2': JSON.stringify(initial) });
  const run = createRun(index); run.waveIndex = run.waves.length - 1; run.rest = 0; run.core = 64;
  for (const wave of run.waves) for (const group of wave.groups) group.spawned = group.count;
  step(run, neutral(), 0);
  assert.equal(run.phase, 'win'); assert.equal(store.writes.length, 1);
  const saved = loadSave();
  assert.equal(saved.bestByLevel['split-crown'], 64);
  for (const id of ['tutorial', 'shear', 'orbital']) assert.equal(saved.bestByLevel[id], initial.bestByLevel[id]);
  recordWin('split-crown', 30); assert.equal(loadSave().bestByLevel['split-crown'], 64);
  recordWin('split-crown', 91); assert.equal(loadSave().bestByLevel['split-crown'], 91);
});
console.log(`\n${checks} Crown contract checks passed.`);
