// Stasis diagnosis: same paid layouts, actual 3D field, and in-memory strength variants.
// Does not alter gameplay source. Idealized setup placements are not a human playtest.
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url).pathname;
globalThis.localStorage = { getItem: () => null, setItem() {} };
const input = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const center = { x: 11.3, y: 22.6, z: 6.4 };
async function loadApi(scale) {
  const bundle = await build({
    stdin: { contents: 'export * from "./src/game/sim"; export * from "./src/game/paths"; export * from "./src/game/combat";', resolveDir: root },
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'study-only-field-strength', setup(b) {
      b.onLoad({ filter: /\/combat\.ts$/ }, async ({ path }) => {
        const contents = await readFile(path, 'utf8');
        assert.match(contents, /export const STASIS_SPEED_SCALE = [\d.]+;/);
        return { contents: contents.replace(/export const STASIS_SPEED_SCALE = [\d.]+;/, `export const STASIS_SPEED_SCALE = ${scale};`), loader: 'ts' };
      });
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
function candidates(api, level, pathIndex) {
  const path = level.paths[pathIndex], out = [];
  for (let dist = 0; dist < path.length - 8; dist += 3) for (const span of [12, 22, 35]) {
    const a = path.pointAt(dist), b = path.pointAt(Math.min(path.length, dist + span));
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const f = { x: (b.x - a.x) / len, y: (b.y - a.y) / len, z: (b.z - a.z) / len };
    const p = { x: a.x - f.x * 4, y: a.y - f.y * 4, z: a.z - f.z * 4 };
    if (p.y < 1.6 || p.y > 44 || Math.hypot(p.x, p.z) > 52 || Math.abs(Math.asin(f.y)) > 1.05) continue;
    const coverage = api.getBeamCoverage({ paths: level.paths }, { ...p, dx: f.x, dy: f.y, dz: f.z, ...api.DRONE_SPECS.pierce });
    out.push({ ...p, f, score: coverage.segments.filter(s => s.pathIndex === pathIndex).reduce((n, s) => n + s.metres, 0) });
  }
  return out.sort((a, b) => b.score - a.score);
}
function position(api, run, p, mode) {
  Object.assign(run.ship, { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(-p.f.x, -p.f.z), pitch: Math.asin(p.f.y), vx: 0, vy: 0, vz: 0, yawRate: 0, pitchRate: 0 });
  Object.assign(run, { aimx: p.f.x, aimy: p.f.y, aimz: p.f.z, droneMode: mode });
  return api.tryAnchor(run);
}
function fundedTrial(api, useField) {
  const run = api.createRun(api.CARRIER_TEST_INDEX), level = run.level;
  run.waves = run.waves.slice(0, 3); // Original encounter only; optional continuation is a separate question.
  const options = [0, 1, 2].map(p => candidates(api, level, p));
  function buy(path) {
    if (run.scrap < api.anchorCost(run.drones.length)) return false;
    for (const p of options[path]) if (!position(api, run, p, 'pierce')) return true;
    return false;
  }
  assert.ok(buy(0)); assert.ok(buy(2));
  const waves = [];
  while (run.phase === 'play' && run.waveIndex < 3) {
    if (run.rest > 0) {
      if (run.waveIndex === 0) {
        if (useField) assert.equal(position(api, run, { ...center, f: { x: 0, y: 0, z: -1 } }, 'stasis'), null);
        else assert.ok(buy(1));
      }
      if (run.waveIndex === 1) { assert.ok(buy(2)); assert.ok(buy(1)); }
      api.nextWaveNow(run);
    }
    let frames = 0, slowedEnemySeconds = 0, carrierSlowedSeconds = 0, carrierMaxDist = 0;
    let previousAlive = run.enemies.map(e => e.alive), lifeIds = run.enemies.map(() => 0), nextId = 1;
    const slowedIds = new Set();
    while (run.phase === 'play' && run.rest === 0 && frames++ < 60 * 180) {
      api.step(run, input(), 1 / 60); run.fx.length = 0;
      run.enemies.forEach((e, i) => {
        if (e.alive && !previousAlive[i]) lifeIds[i] = nextId++;
        if (e.alive && e.speedScale < 1) {
          slowedEnemySeconds += 1 / 60; slowedIds.add(lifeIds[i]);
          if (e.kind === 'carrier') carrierSlowedSeconds += 1 / 60;
        }
        if (e.kind === 'carrier') carrierMaxDist = Math.max(carrierMaxDist, e.dist);
      });
      previousAlive = run.enemies.map(e => e.alive);
    }
    assert.ok(frames < 60 * 180);
    waves.push({ wave: run.waveIndex + 1, seconds: +(frames / 60).toFixed(2), core: run.core, kills: run.kills,
      slowedEnemies: slowedIds.size, slowedEnemySeconds: +slowedEnemySeconds.toFixed(2),
      carrierSlowedSeconds: +carrierSlowedSeconds.toFixed(2), carrierMaxDist: +carrierMaxDist.toFixed(2) });
  }
  return { phase: run.phase, carrier: run.carrierOutcome, scrap: run.scrap, waves };
}
function concentratedTrial(api, damageCount, useField) {
  const run = api.createRun(api.CARRIER_TEST_INDEX), level = run.level;
  run.waves = [{ groups: [{ kind: 'carrier', path: 2, count: 1, interval: 1, delay: 0, spawned: 0 }] }];
  Object.assign(run.ship, { x: 50, y: 44, z: 0, yaw: -Math.PI / 2, pitch: 0 }); // no pilot damage
  const options = candidates(api, level, 2).map(p => {
    const beam = { ...p, dx: p.f.x, dy: p.f.y, dz: p.f.z, ...api.DRONE_SPECS.pierce };
    let shared = 0;
    const path = level.paths[2], ds = .1;
    for (let d = 0; d < path.length; d += ds) {
      const e = { ...path.pointAt(d), radius: 2.2 };
      if (api.insideStasis(center, e) && api.beamContact(beam, e) !== null) shared += ds;
    }
    return { ...p, shared };
  }).sort((a, b) => b.shared - a.shared || b.score - a.score);
  const selected = [];
  for (const p of options) {
    if (Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z) < 2.2) continue;
    if (selected.some(q => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < 2.2)) continue;
    selected.push(p);
    if (selected.length === damageCount + (useField ? 0 : 1)) break;
  }
  // Fixed artificial inventory, not an economic/wave feasibility claim; drone locations obey spacing.
  for (const p of selected) run.drones.push({ id: run.drones.length + 1, mode: 'pierce', paid: 20, kills: 0, damage: 0, hit: false,
    bx: p.x, by: p.y, bz: p.z, x: p.x, y: p.y, z: p.z, fx: p.f.x, fy: p.f.y, fz: p.f.z, ax: p.f.x, ay: p.f.y, az: p.f.z });
  if (useField) run.drones.push({ id: run.drones.length + 1, mode: 'stasis', paid: 20, kills: 0, damage: 0, hit: false,
    bx: center.x, by: center.y, bz: center.z, ...center, fx: 0, fy: 0, fz: -1, ax: 0, ay: 0, az: -1 });
  api.nextWaveNow(run);
  let frames = 0, slowed = 0, maxDist = 0;
  while (run.phase === 'play' && frames++ < 60 * 180) {
    api.step(run, input(), 1 / 60); run.fx.length = 0;
    const e = run.enemies.find(e => e.kind === 'carrier');
    if (e) { maxDist = Math.max(maxDist, e.dist); if (e.alive && e.speedScale < 1) slowed += 1 / 60; }
  }
  assert.ok(frames < 60 * 180);
  return { basePierceDrones: damageCount, alternative: useField ? 'one field' : 'one extra Pierce',
    sharedFieldMetresPerLine: selected.map(p => +p.shared.toFixed(1)), carrier: run.carrierOutcome,
    damage: +run.drones.reduce((n, d) => n + d.damage, 0).toFixed(1), maxDist: +maxDist.toFixed(2), slowedSeconds: +slowed.toFixed(2) };
}
const results = [];
const concentrated = [];
for (const scale of [.7, .6, .5]) {
  const api = await loadApi(scale);
  const coverage = api.getFieldCoverage({ paths: api.LEVELS[api.CARRIER_TEST_INDEX].paths }, center);
  if (!results.length) results.push({ variant: 'damage-only', ...fundedTrial(api, false) });
  results.push({ variant: `${Math.round((1 - scale) * 100)}% slow`,
    coveredMetres: coverage.segments.map(s => ({ path: s.pathIndex, metres: +s.metres.toFixed(2) })), ...fundedTrial(api, true) });
  for (const damageCount of [1, 2, 3]) {
    if (scale === .7) concentrated.push({ variant: 'damage-only', ...concentratedTrial(api, damageCount, false) });
    if (scale !== .6) concentrated.push({ variant: `${Math.round((1 - scale) * 100)}% slow`, ...concentratedTrial(api, damageCount, true) });
  }
}
const timing = [ ['Shard', 10.4], ['Dive Shard', 10.4 * .55], ['Barge', 6], ['Carrier', 4.2] ].map(([kind, speed]) => ({
  kind, baseSeconds: +(12 / speed).toFixed(3),
  ...Object.fromEntries([.7, .6, .5].map(s => [`extraSecondsAt${Math.round((1 - s) * 100)}Percent`, +(12 / speed * (1 / s - 1)).toFixed(3)])),
}));
console.log(JSON.stringify({ method: 'Original three-wave encounter. Paid reachable idealized layouts, idle hangar pilot; no human/visual playtest. Slowed time is sampled at 60Hz and excludes the death frame. Strength changes are in-memory only.', fieldCenter: center, fullTwelveMetreChordTiming: timing, results,
  concentratedMethod: 'Single carrier on real wide-loop route, no pilot damage, 1–3 lines selected for maximum shared field contact. Compare same-slot extra Pierce vs field. Artificial fixed inventory; not a funded-wave feasibility test.', concentrated }, null, 2));
