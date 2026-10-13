// Live field diagnosis uses actual anchored drones, route positions and the real
// movement loop. This checks simulation integrity, not browser visuals.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

let writes = 0;
globalThis.localStorage = { getItem: () => null, setItem() { writes++; } };
const bundle = await build({
  stdin: { contents: 'export * from "./src/game/sim"; export * from "./src/game/paths"; export * from "./src/game/combat";', resolveDir: new URL('../', import.meta.url).pathname },
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const neutral = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const dt = 1 / 60;
let checks = 0;
function test(name, body) { body(); checks++; console.log(`✓ ${name}`); }

function place(run, p, mode = 'stasis') {
  Object.assign(run.ship, { x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0 });
  run.droneMode = mode;
  assert.equal(api.tryAnchor(run), null);
}
function prepared() {
  const run = api.createRun(api.CARRIER_TEST_INDEX, 17);
  place(run, run.paths[0].pointAt(run.paths[0].length * .28));
  place(run, run.paths[1].pointAt(run.paths[1].length * .18));
  return run;
}
function immutableState(run) {
  return JSON.stringify({ core: run.core, scrap: run.scrap, kills: run.kills, nextDroneId: run.nextDroneId,
    rest: run.rest, time: run.time, waveTime: run.waveTime, waveIndex: run.waveIndex, waves: run.waves,
    waveMode: run.waveMode, save: run.save, carrierOutcome: run.carrierOutcome, lastBreach: run.lastBreach,
    paidFleet: run.drones.map(d => ({ id: d.id, mode: d.mode, paid: d.paid, damage: d.damage, kills: d.kills, bx: d.bx, by: d.by, bz: d.bz })) });
}

test('Field check requires setup in the lab with a placed Stasis drone', () => {
  assert.match(api.startFieldCheck(api.createRun(0)), /Carrier/);
  const none = api.createRun(api.CARRIER_TEST_INDEX);
  assert.match(api.startFieldCheck(none), /Anchor/);
  const playing = prepared(); api.nextWaveNow(playing);
  assert.match(api.startFieldCheck(playing), /setup/);
  const moving = prepared(); api.beginReposition(moving, moving.drones[0].id);
  assert.match(api.startFieldCheck(moving), /repositioning/);
  const paused = prepared(); paused.phase = 'pause';
  assert.equal(api.startFieldCheck(paused), null);
  assert.equal(paused.phase, 'pause');
  assert.match(api.startFieldCheck(paused), /already/);
  const positions = paused.enemies.map(e => e.dist);
  api.step(paused, neutral(), 2);
  assert.deepEqual(paused.enemies.map(e => e.dist), positions, 'Survey really pauses check targets');
});

test('Check targets loop on all real routes and cannot damage core, spend scrap, earn kills or advance timers', () => {
  const run = prepared(); api.setWaveMode(run, 'auto');
  run.rest = 3.25;
  const before = immutableState(run), storageBefore = writes;
  assert.equal(api.startFieldCheck(run), null);
  assert.deepEqual(run.enemies.filter(e => e.alive).map(e => [e.kind, e.pathIndex]), [['barge', 0], ['barge', 1], ['barge', 2]]);
  let contacts = 0, wraps = 0;
  for (let frame = 0; frame < 7200; frame++) {
    const previous = run.enemies.map(e => e.dist);
    api.step(run, { ...neutral(), thrust: frame < 60 ? 1 : 0 }, dt);
    run.enemies.forEach((e, i) => { if (e.alive && e.dist < previous[i]) wraps++; });
    contacts = Math.max(contacts, run.enemies.filter(e => e.alive && e.speedScale < 1).length);
  }
  assert.ok(wraps >= 6, 'targets loop rather than leaking');
  assert.ok(contacts > 0 && run.stasisTouched > 0 && run.stasisExposure > 0);
  assert.ok(run.stasisTouched <= 3, 'the same looping check target counts once');
  assert.equal(run.enemies.filter(e => e.alive).length, 3);
  assert.ok(run.enemies.filter(e => e.alive).every(e => e.hp === e.maxHp), 'automatic pilot gun cannot damage probes');
  assert.equal(run.anchorFlash, 0, 'anchor visual decays during the check');
  assert.equal(run.shake, 0, 'camera shake does not remain throughout the check');
  assert.equal(immutableState(run), before);
  assert.equal(writes, storageBefore);
});

test('Check blocks all fleet mutations and both launch APIs without losing the auto countdown', () => {
  const run = prepared(); api.setWaveMode(run, 'auto'); run.rest = 2.75;
  assert.equal(api.startFieldCheck(run), null);
  const fleet = JSON.stringify(run.drones), scrap = run.scrap;
  for (const result of [api.tryAnchor(run), api.recallLast(run), api.recallSelected(run, 1), api.beginReposition(run, 1)]) assert.match(result, /End the field check/);
  api.nextWaveNow(run); api.beginWave(run, 0); api.setWaveMode(run, 'manual');
  assert.equal(run.waveIndex, -1); assert.equal(run.waveMode, 'auto'); assert.equal(run.rest, 2.75);
  assert.equal(run.scrap, scrap); assert.equal(JSON.stringify(run.drones), fleet);
  api.endFieldCheck(run);
  api.step(run, neutral(), 2.5);
  assert.equal(run.waveIndex, -1); assert.equal(run.rest, .25);
  api.step(run, neutral(), .3);
  assert.equal(run.waveIndex, 0);
});

test('Ending a check restores actual history, enemy pool, random stream and messages but keeps the flown ship', () => {
  const run = prepared();
  run.stasisTouched = 7; run.stasisExposure = 9.25; run.hint = 'Keep this setup'; run.banner = 'Prior banner';
  const pool = JSON.stringify(run.enemies), random = run.randomState;
  assert.equal(api.startFieldCheck(run), null);
  assert.equal(run.stasisTouched, 0); assert.equal(run.stasisExposure, 0);
  for (let frame = 0; frame < 1200; frame++) api.step(run, { ...neutral(), thrust: frame < 60 ? 1 : 0 }, dt);
  assert.ok(run.stasisTouched > 0);
  const ship = { ...run.ship };
  api.endFieldCheck(run);
  assert.equal(run.fieldCheck, null); assert.equal(run.stasisTouched, 7); assert.equal(run.stasisExposure, 9.25);
  assert.equal(run.randomState, random); assert.equal(run.hint, 'Keep this setup'); assert.equal(run.banner, 'Prior banner');
  assert.equal(JSON.stringify(run.enemies), pool); assert.deepEqual(run.ship, ship);
  api.endFieldCheck(run);
  assert.equal(run.stasisTouched, 7, 'ending twice is harmless');
});

test('Copied field report matches the real movement state, actual 3D distance and projected positions', () => {
  const run = prepared(); assert.equal(api.startFieldCheck(run), null);
  let observedSlow = false;
  for (let frame = 0; frame < 1500; frame++) {
    api.step(run, { ...neutral(), expand: frame > 700, shift: frame > 1000 ? .5 : 0 }, dt);
    if (frame % 6 !== 0) continue;
    const report = api.getStasisReport(run, 'diagnostic-test');
    assert.equal(JSON.parse(JSON.stringify(report)).build, 'diagnostic-test');
    assert.equal(report.contact.slowedNow, report.contact.geometricallyInsideNow);
    observedSlow ||= report.contact.slowedNow > 0;
    report.enemies.forEach((enemy, index) => {
      assert.equal(enemy.expectedScale, enemy.actualScale);
      assert.equal(enemy.effectiveSpeed, enemy.baseSpeed * enemy.actualScale);
      const actual = run.enemies.filter(e => e.alive)[index];
      const distance = Math.min(...run.drones.map(d => Math.hypot(d.x - actual.x, d.y - actual.y, d.z - actual.z)));
      assert.equal(enemy.nearestFieldDistance, distance);
      assert.equal(enemy.insideFieldIds.length > 0, distance <= api.STASIS_RADIUS);
    });
    report.drones.forEach((drone, index) => {
      const actual = run.drones[index];
      assert.deepEqual(drone.center, { x: actual.x, y: actual.y, z: actual.z });
      assert.deepEqual(drone.restCenter, { x: actual.bx, y: actual.by, z: actual.bz });
      assert.ok(Math.abs(drone.coveredMetresByLane.reduce((n, lane) => n + lane.metres, 0) - api.getFieldCoverage(run, actual).metres) < 1e-9);
    });
  }
  assert.ok(observedSlow);
  const empty = api.getStasisReport(api.createRun(api.CARRIER_TEST_INDEX), 'empty');
  assert.equal(empty.contact.slowedNow, 0); assert.deepEqual(empty.drones, []);
});

test('Authored enemies spawn with correct field state and reused slots create new contact history', () => {
  const run = api.createRun(api.CARRIER_TEST_INDEX);
  place(run, run.paths[0].pointAt(0));
  Object.assign(run.ship, { x: 50, y: 44, z: 0, yaw: -Math.PI / 2, pitch: 0 });
  api.nextWaveNow(run);
  let frame = 0;
  while (!run.enemies.some(e => e.alive) && frame++ < 120) api.step(run, neutral(), dt);
  const first = run.enemies.find(e => e.alive);
  assert.equal(first.dist, 0); assert.equal(first.speedScale, api.STASIS_SPEED_SCALE);
  assert.equal(first.stasisSeen, true); assert.equal(run.stasisTouched, 1);
  assert.equal(run.stasisExposure, 0, 'spawn alone has no elapsed movement');
  const report = api.getStasisReport(run, 'spawn');
  assert.equal(report.contact.slowedNow, report.contact.geometricallyInsideNow);
  first.alive = false; // Force pool reuse while the remaining authored group waits.
  while (!run.enemies.some(e => e.alive) && frame++ < 300) api.step(run, neutral(), dt);
  assert.strictEqual(run.enemies.find(e => e.alive), first);
  assert.equal(run.stasisTouched, 2, 'new life in the same pooled slot counts again');
});

console.log(`\n${checks} field-check diagnostics passed.`);
