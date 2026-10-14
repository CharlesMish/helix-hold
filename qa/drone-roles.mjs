// Focused contracts for the expanded Crown roster; no browser or WebGL needed.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: 'export * from "./src/game/sim"; export * from "./src/game/combat"; export * from "./src/game/paths";', resolveDir: new URL('../', import.meta.url).pathname }, bundle: true, platform: 'node', format: 'esm', write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { createRun, step, LEVELS, buildPath, availableDroneModes, isModeAvailable, tryAnchor, getPlacementPreview,
  getDroneCoverage, getFieldCoverage, droneBeam, beamContact, insideSphere, enemySpeedScale,
  startFieldCheck, endFieldCheck, getStasisReport, beginReposition, recallSelected, nextWaveNow,
  PIN_DAMAGE, PIN_INTERVAL, PIN_SLOW_DURATION, PIN_SPEED_SCALE, DRONE_SPECS } = api;
globalThis.localStorage = { getItem: () => null, setItem() {} };
const crown = LEVELS.findIndex(l => l.id === 'split-crown');
const input = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
let checks = 0;
function test(name, check) { check(); checks++; console.log(`✓ ${name}`); }
function drone(mode, x = 0, y = 8, z = 0) {
  return { id: 1, mode, paid: 44, damage: 0, kills: 0, hit: false, shotCooldown: 0, shotFlash: 0, shotTarget: null,
    bx: x, by: y, bz: z, fx: 0, fy: 0, fz: -1, x, y, z, ax: 0, ay: 0, az: -1 };
}
function fixture(mode) {
  const run = createRun(crown, 17);
  run.paths = [buildPath('straight', t => ({ x: 0, y: 8, z: -80 * t }))];
  run.waves = [{ groups: [] }]; run.waveIndex = 0; run.rest = 0;
  Object.assign(run.ship, { x: 49, y: 43, z: 0, yaw: -Math.PI / 2, pitch: 0 });
  run.drones = [drone(mode)];
  return run;
}
function enemy(run, slot, dist, options = {}) {
  const e = run.enemies[slot], p = run.paths[options.pathIndex ?? 0].pointAt(dist);
  Object.assign(e, { alive: true, kind: 'shard', pathIndex: 0, dist, hp: 100, maxHp: 100, speed: 0,
    speedScale: 1, pinSlowRemaining: 0, stasisSeen: false, amp: 0, radius: .72, reward: 8, leak: 7, ...p, ...options });
  return e;
}

test('Only the expanded Crown roster permits Halo and Pin purchases', () => {
  assert.deepEqual(availableDroneModes(LEVELS[crown]), ['pierce', 'sweep', 'stasis', 'halo', 'pin']);
  for (let i = 0; i < LEVELS.length; i++) if (i !== crown) {
    for (const mode of ['halo', 'pin']) {
      assert.equal(isModeAvailable(LEVELS[i], mode), false);
      const run = createRun(i); run.droneMode = mode; run.scrap = 10000;
      Object.assign(run.ship, { x: 12, y: 8, z: 0 });
      assert.equal(tryAnchor(run), 'Halo and Pin are available in Split Crown');
    }
  }
});

test('Halo damages every actual 3D center in its sphere and ignores aim and hull reach', () => {
  const run = fixture('halo');
  run.paths = [buildPath('cross', t => ({ x: -20 + 40 * t, y: 8, z: 0 })),
    buildPath('high', t => ({ x: -20 + 40 * t, y: 13.01, z: 0 }))];
  const left = enemy(run, 0, 15), right = enemy(run, 1, 25);
  const outside = enemy(run, 2, 25.1, { radius: 2.2 });
  const high = enemy(run, 3, 20, { pathIndex: 1 });
  run.drones[0].fx = 1; run.drones[0].fz = 0;
  step(run, input(), .25);
  near(left.hp, 95.5); near(right.hp, 95.5);
  near(outside.hp, 100); near(high.hp, 100);
  near(run.drones[0].damage, 9);
  assert.equal(insideSphere(run.drones[0], high, 5), false);
});

test('Projected Halo preview and anchored route coverage share the radius and Fan/Slide pose', () => {
  const run = createRun(crown); run.scrap = 10000; run.droneMode = 'halo';
  Object.assign(run.ship, { x: -20, y: 23, z: -12 });
  run.expand = .6; run.shift = -.4;
  const preview = getPlacementPreview(run);
  assert.equal(preview.status, null);
  assert.deepEqual(getDroneCoverage(run, preview.drone).segments, getFieldCoverage(run, preview.drone, 5).segments);
  assert.equal(tryAnchor(run), null);
  const d = run.drones[0];
  assert.deepEqual(getDroneCoverage(run, d).segments, preview.segments);
  for (const segment of preview.segments) for (let i = 1; i < segment.points.length; i++) {
    const a = segment.points[i - 1], b = segment.points[i];
    assert.equal(insideSphere(d, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }, 5), true);
  }
  assert.ok(preview.metres > 0);
});

test('Pin fires nearest-obstruction pulses on cadence without continuous damage or idle bursts', () => {
  const run = fixture('pin'), far = enemy(run, 0, 20), close = enemy(run, 1, 8), d = run.drones[0];
  step(run, input(), .1);
  near(close.hp, 100 - PIN_DAMAGE); near(far.hp, 100);
  near(close.pinSlowRemaining, PIN_SLOW_DURATION);
  near(d.shotCooldown, PIN_INTERVAL); assert.ok(d.shotFlash > 0);
  assert.deepEqual(d.shotTarget, { x: close.x, y: close.y, z: close.z });
  for (let i = 0; i < 15; i++) step(run, input(), .1);
  near(close.hp, 76);
  step(run, input(), .1); near(close.hp, 52);
  near(close.pinSlowRemaining, PIN_SLOW_DURATION); // refreshed duration, not added or compounded
  close.alive = false; far.alive = false;
  step(run, input(), 12);
  const returning = enemy(run, 2, 10, { hp: 1000, maxHp: 1000 });
  step(run, input(), .1); near(returning.hp, 1000 - PIN_DAMAGE);
  step(run, input(), .1); near(returning.hp, 1000 - PIN_DAMAGE);
  // Its preview uses the exact same finite-cylinder geometry as the shot.
  const beam = droneBeam(d);
  assert.notEqual(beamContact(beam, returning), null);
  assert.equal(beamContact(beam, { ...returning, z: -61 }), null);
  assert.equal(beamContact(beam, { ...returning, z: 1 }), null);
});

test('Pin slow lingers and refreshes, expires proportionately, and never compounds with Stasis', () => {
  const run = fixture('pin'), e = enemy(run, 0, 8, { speed: 4 });
  step(run, input(), .1); near(e.speedScale, PIN_SPEED_SCALE);
  assert.equal(run.stasisTouched, 0); near(run.stasisExposure, 0);
  assert.equal(getStasisReport(run, 'test').contact.slowedNow, 0);
  // Turn the Pin away so the timer can expire without refreshing.
  run.drones[0].fz = 1;
  e.pinSlowRemaining = .1;
  const start = e.dist;
  step(run, input(), .25);
  near(e.dist - start, 4 * (.1 * .65 + .15));
  near(e.pinSlowRemaining, 0); near(e.speedScale, 1);
  const field = drone('stasis', e.x, e.y, e.z); field.id = 2;
  run.drones.push(field, { ...field, id: 3 });
  e.pinSlowRemaining = 2.4;
  near(enemySpeedScale(run, e), .5);
  step(run, input(), .1);
  near(e.speedScale, .5); assert.equal(run.stasisTouched, 1); near(run.stasisExposure, .1);
});

test('New damage modes cap contribution and award each kill and reward once', () => {
  for (const mode of ['halo', 'pin']) {
    const run = fixture(mode), target = enemy(run, 0, 3, { hp: 1 });
    run.drones.push({ ...drone(mode), id: 2 });
    const scrap = run.scrap;
    step(run, input(), .25);
    assert.equal(target.alive, false); assert.equal(run.kills, 1); assert.equal(run.scrap, scrap + 8);
    near(run.drones.reduce((n, d) => n + d.damage, 0), 1);
    assert.equal(run.drones.reduce((n, d) => n + d.kills, 0), 1);
  }
});

test('Pause and field checks freeze shots and contributions; pooled spawns clear Pin slow', () => {
  const run = fixture('pin'), e = enemy(run, 0, 8), d = run.drones[0];
  step(run, input(), .1); run.phase = 'pause';
  const before = JSON.stringify({ d, e });
  step(run, input(), 3); assert.equal(JSON.stringify({ d, e }), before);
  run.phase = 'play'; run.rest = 8; e.alive = false;
  run.drones.push({ ...drone('stasis', 0, 8, -10), id: 2 });
  assert.equal(startFieldCheck(run), null);
  const original = JSON.stringify(d);
  for (let i = 0; i < 100; i++) step(run, input(), .05);
  assert.equal(JSON.stringify(d), original);
  endFieldCheck(run);
  e.pinSlowRemaining = 2.4;
  run.waves = [{ groups: [{ kind: 'shard', path: 0, count: 1, interval: 1, delay: 0, spawned: 0 }] }];
  run.waveIndex = -1; run.rest = 8; run.drones = [];
  nextWaveNow(run); step(run, input(), .01);
  assert.equal(e.alive, true); near(e.pinSlowRemaining, 0); near(e.speedScale, 1);
});

test('Reposition preserves a Pin unit, its paid value, cadence and contribution; recall refunds that value', () => {
  const run = createRun(crown); run.scrap = 200; run.droneMode = 'pin';
  Object.assign(run.ship, { x: 12, y: 8, z: 0 });
  assert.equal(tryAnchor(run), null);
  const d = run.drones[0];
  d.damage = 24; d.kills = 1; d.shotCooldown = .7;
  const balance = run.scrap, paid = d.paid, id = d.id;
  assert.equal(beginReposition(run, id), null);
  Object.assign(run.ship, { x: 16, y: 8, z: 2 });
  assert.equal(tryAnchor(run), null);
  assert.equal(run.drones[0], d); assert.equal(d.mode, 'pin');
  near(d.shotCooldown, .7); near(d.damage, 24); assert.equal(d.kills, 1);
  assert.equal(d.paid, paid); assert.equal(run.scrap, balance);
  assert.equal(recallSelected(run, id), null); assert.equal(run.scrap, balance + paid);
});

console.log(`${checks} drone-role checks passed.`);
