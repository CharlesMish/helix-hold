// Split Crown quantitative feasibility study. No browser, renderer or dev server.
// Full runs use idealized in-bounds setup poses through ordinary paid placement
// APIs. The separate opening flies through step(input) without pose teleports.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: 'export * from "./src/game/sim"; export * from "./src/game/paths"; export * from "./src/game/combat";', resolveDir: new URL('../', import.meta.url).pathname }, bundle: true, platform: 'node', format: 'esm', write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { createRun, step, nextWaveNow, tryAnchor, beginReposition, anchorCost, getBeamCoverage, getFieldCoverage, beamContact, LEVELS, DRONE_SPECS } = api;
globalThis.localStorage = { getItem: () => null, setItem() {} };
const index = LEVELS.findIndex(l => l.id === 'split-crown');
assert.ok(index >= 0, 'Split Crown must exist');
const level = LEVELS[index], dt = 1 / 60;
const round = n => +n.toFixed(2);
const neutral = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const valid = p => p.y >= 1.6 && p.y <= 44 && Math.hypot(p.x, p.z) <= 52 && Math.abs(Math.asin(p.f.y)) <= 1.05;
const samples = level.paths.map(path => { const n = Math.ceil(path.length / 1.25); return Array.from({ length: n }, (_, i) => path.pointAt((i + .5) * path.length / n)); });
const lateRouteWave = level.waves.findIndex(w => w.groups.some(g => g.path === 4));
function pose(a, b, reverse = false) {
  const len = d3(a, b); if (len < 1) return null;
  const f = { x: (b.x - a.x) / len, y: (b.y - a.y) / len, z: (b.z - a.z) / len };
  if (reverse) { for (const k of ['x', 'y', 'z']) f[k] *= -1; [a, b] = [b, a]; }
  const p = { x: a.x - f.x * 4, y: a.y - f.y * 4, z: a.z - f.z * 4, f };
  if (!valid(p)) return null;
  const beam = { ...p, dx: f.x, dy: f.y, dz: f.z, ...DRONE_SPECS.pierce };
  const coverage = getBeamCoverage({ paths: level.paths }, beam);
  p.metres = level.paths.map((_, lane) => coverage.segments.filter(s => s.pathIndex === lane).reduce((sum, s) => sum + s.metres, 0));
  p.beam = beam;
  return p;
}
const options = [];
for (const path of level.paths) {
  for (let d = 0; d < path.length - 7; d += 4) {
    for (const span of [10, 20, 34, 50]) for (const reverse of [false, true]) {
      const p = pose(path.pointAt(d), path.pointAt(Math.min(path.length, d + span)), reverse);
      if (p) options.push(p);
    }
  }
}
// Cross-lane chords include both districts, not only each route's own secants.
for (let a = 0; a < level.paths.length; a++) for (let b = a + 1; b < level.paths.length; b++) {
  for (const da of [.15, .35, .55, .75, .9]) for (const db of [.15, .35, .55, .75, .9]) for (const reverse of [false, true]) {
    const p = pose(level.paths[a].pointAt(level.paths[a].length * da), level.paths[b].pointAt(level.paths[b].length * db), reverse);
    if (p) options.push(p);
  }
}
// Central fleet candidates sit around the low approach zone and aim outward.
const coreOptions = [];
for (let theta = 0; theta < Math.PI * 2; theta += Math.PI / 10) for (const y of [3, 7, 11]) {
  const c = { x: Math.cos(theta) * 7, y, z: Math.sin(theta) * 7 };
  for (const path of level.paths) for (const t of [.55, .72, .88, .97]) {
    const target = path.pointAt(path.length * t), len = d3(c, target);
    if (len < 1) continue;
    const f = { x: (target.x - c.x) / len, y: (target.y - c.y) / len, z: (target.z - c.z) / len };
    const p = pose({ x: c.x + f.x * 4, y: c.y + f.y * 4, z: c.z + f.z * 4 }, target);
    if (p) coreOptions.push(p);
  }
}
const openingOptions = options.filter(p => p.x < -5).sort((a, b) => b.metres[0] - a.metres[0]);
function setPose(run, p, mode = 'pierce') {
  Object.assign(run.ship, { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(-p.f.x, -p.f.z), pitch: Math.asin(p.f.y), vx: 0, vy: 0, vz: 0, yawRate: 0, pitchRate: 0 });
  Object.assign(run, { aimx: p.f.x, aimy: p.f.y, aimz: p.f.z, speed: 0, droneMode: mode });
}
function quietPilot(run) {
  setPose(run, { x: 49, y: 43, z: 0, f: { x: 1, y: 0, z: 0 } });
}
function ranked(run, strategy, lane) {
  const source = strategy === 'core-heavy' ? coreOptions : options;
  const lanes = new Set(run.waves.slice(0, Math.min(run.waves.length, run.waveIndex + 2)).flatMap(w => w.groups.map(g => g.path)));
  lanes.add(lane);
  const counts = level.paths.map((_, j) => run.drones.filter(d => d.mode !== 'stasis').reduce((sum, d) => {
    const f = { x: d.ax, y: d.ay, z: d.az }, beam = { x: d.x, y: d.y, z: d.z, dx: f.x, dy: f.y, dz: f.z, ...DRONE_SPECS.pierce };
    return sum + samples[j].filter(q => beamContact(beam, { ...q, radius: .82 }) !== null).length * level.paths[j].length / samples[j].length;
  }, 0));
  return source.map(p => ({ p, score: strategy === 'dedicated' ? p.metres[lane]
    : p.metres.reduce((sum, m, j) => sum + (lanes.has(j) ? m / (1 + counts[j] / 18) : m * .05), 0) + p.metres.filter((m, j) => lanes.has(j) && m >= 3).length * 3 }))
    .sort((a, b) => b.score - a.score).map(o => o.p);
}
function fieldOptions(run) {
  const beams = run.drones.filter(d => d.mode !== 'stasis').map(d => ({ x: d.x, y: d.y, z: d.z, dx: d.ax, dy: d.ay, dz: d.az, ...DRONE_SPECS.pierce }));
  const centers = samples.flatMap((points, lane) => points.filter((_, i) => i % 3 === 0).map(p => ({ ...p, lane })));
  return centers.map(p => {
    const coverage = getFieldCoverage({ paths: level.paths }, p);
    const score = samples.reduce((sum, points, lane) => sum + points.filter(q => d3(p, q) <= 6).reduce((n, q) => n + beams.filter(b => beamContact(b, { ...q, radius: .82 }) !== null).length, 0) * level.paths[lane].length / points.length, 0);
    return { ...p, f: { x: 0, y: 0, z: -1 }, score, metres: level.paths.map((_, lane) => coverage.segments.filter(s => s.pathIndex === lane).reduce((n, s) => n + s.metres, 0)) };
  }).sort((a, b) => b.score - a.score);
}
const purchaseLanes = [0, 0, 1, 2, 2, 3, 1, 3];
function fullTrial(strategy, withField, refit = true, fieldSlot = 6, carrierRoute = 4) {
  const run = createRun(index, 17), placements = [], waves = [], revisions = [];
  function buy() {
    const slot = run.drones.length;
    if (slot >= 8 || run.scrap < anchorCost(slot)) return false;
    const lane = Math.min(level.paths.length - 1, purchaseLanes[slot]);
    const field = withField && slot === fieldSlot;
    const candidates = field ? fieldOptions(run) : slot < 2 ? openingOptions : ranked(run, strategy, lane);
    for (const p of candidates) {
      setPose(run, p, field ? 'stasis' : 'pierce');
      if (tryAnchor(run) !== null) continue;
      placements.push({ beforeWave: run.waveIndex + 2, slot: slot + 1, mode: field ? 'stasis' : 'pierce', lane: lane + 1, paid: run.drones.at(-1).paid, position: [p.x, p.y, p.z].map(round), coverageMetres: p.metres.map(round) });
      return true;
    }
    return false;
  }
  while (run.phase === 'play') {
    if (run.rest > 0) {
      const target = Math.min(8, run.waveIndex + 3);
      while (run.drones.length < target && buy()) {}
      // One explicit setup adjustment when the late route is announced. This is
      // a separate measured choice: paid value, mode and resource balance persist.
      if (refit && run.waveIndex + 1 === lateRouteWave && level.paths.length > 4 && run.drones.length >= 5) {
        const moving = run.drones.filter(d => d.mode === 'pierce').at(-2);
        const retained = { paid: moving.paid, scrap: run.scrap, id: moving.id, mode: moving.mode };
        assert.equal(beginReposition(run, moving.id), null);
        const list = ranked(run, strategy === 'core-heavy' ? strategy : 'dedicated', 4);
        let moved = false;
        for (const p of list) {
          setPose(run, p, moving.mode);
          if (tryAnchor(run) !== null) continue;
          moved = true; revisions.push({ beforeWave: lateRouteWave + 1, id: moving.id, paid: moving.paid, oldMode: retained.mode, coverageMetres: p.metres.map(round) }); break;
        }
        assert.ok(moved, 'announced late route permits a setup reposition');
        assert.equal(run.scrap, retained.scrap); assert.equal(moving.paid, retained.paid); assert.equal(moving.id, retained.id); assert.equal(moving.mode, retained.mode);
      }
      quietPilot(run);
      if (run.waveIndex + 1 === lateRouteWave && carrierRoute !== 4) {
        for (const group of run.waves[lateRouteWave].groups) if (group.kind === "carrier" && group.path === 4) group.path = carrierRoute;
      }
      nextWaveNow(run);
    }
    const before = { kills: run.kills, core: run.core, touched: run.stasisTouched, contact: run.stasisExposure };
    let seconds = 0, maxAlive = 0, maxSlowed = 0, carrierMinHp = null, carrierSeen = false;
    while (run.phase === 'play' && run.rest === 0 && seconds < 240) {
      step(run, neutral(), dt); run.fx.length = 0; seconds += dt;
      const alive = run.enemies.filter(e => e.alive);
      maxAlive = Math.max(maxAlive, alive.length); maxSlowed = Math.max(maxSlowed, alive.filter(e => e.speedScale < 1).length);
      for (const e of alive.filter(e => e.kind === 'carrier')) { carrierSeen = true; carrierMinHp = Math.min(carrierMinHp ?? Infinity, e.hp); }
    }
    assert.ok(seconds < 240, 'authored wave resolves under fixed enemy pool');
    assert.ok(run.scrap >= 0 && run.drones.length <= 8, 'ordinary economy and slot cap');
    waves.push({ wave: run.waveIndex + 1, core: run.core, coreLost: before.core - run.core, kills: run.kills - before.kills, scrap: run.scrap, drones: run.drones.length, seconds: round(seconds), maxAlive, maxSlowed, affected: run.stasisTouched - before.touched, fieldEnemySeconds: round(run.stasisExposure - before.contact), carrier: carrierSeen ? run.carrierOutcome : null, carrierLowestObservedHp: carrierMinHp === null ? null : round(carrierMinHp) });
  }
  return { strategy, withField, fieldActuallyPurchased: run.drones.some(d => d.mode === 'stasis'), fieldSlot: withField ? fieldSlot + 1 : null, carrierRoute: carrierRoute + 1, refit, phase: run.phase, core: run.core, kills: run.kills, scrap: run.scrap, totalCombatSeconds: round(waves.reduce((n, w) => n + w.seconds, 0)), placements, revisions, waves, contributions: run.drones.map(d => ({ slot: d.id, mode: d.mode, paid: d.paid, kills: d.kills, damage: round(d.damage) })) };
}
function angleError(target, current) { return Math.atan2(Math.sin(target - current), Math.cos(target - current)); }
function steerTo(run, yaw, pitch, thrust = 0) {
  step(run, { ...neutral(), steer: clamp(angleError(yaw, run.ship.yaw) * 2, -1, 1), pitch: clamp((pitch - run.ship.pitch) * 2, -1, 1), thrust }, dt);
  run.fx.length = 0;
}
function flyAndAnchor(run, target) {
  let seconds = 0;
  while (seconds < 90) {
    const distance = d3(run.ship, target);
    const yaw = Math.atan2(run.ship.x - target.x, run.ship.z - target.z);
    const pitch = Math.atan2(target.y - run.ship.y, Math.hypot(target.x - run.ship.x, target.z - run.ship.z));
    const aligned = Math.abs(angleError(yaw, run.ship.yaw)) < .3 && Math.abs(pitch - run.ship.pitch) < .3;
    const speed = run.ship.vx * run.aimx + run.ship.vy * run.aimy + run.ship.vz * run.aimz;
    const desired = distance > .4 && aligned ? Math.min(16, distance * 1.5) : 0;
    steerTo(run, yaw, pitch, clamp(((desired - speed) * 3 + speed * 1.12) / 36, -1, 1));
    seconds += dt;
    if (distance < .5 && run.speed < .4) break;
  }
  assert.ok(seconds < 90, 'automatic steering reaches opening pose through actual inputs');
  const yaw = Math.atan2(-target.f.x, -target.f.z), pitch = Math.asin(target.f.y);
  for (let i = 0; i < 300; i++) { steerTo(run, yaw, pitch, 0); seconds += dt; }
  const before = run.drones.length;
  step(run, { ...neutral(), anchor: true }, dt);
  assert.equal(run.drones.length, before + 1, run.hint);
  return { flightSeconds: round(seconds), placementErrorMetres: round(d3(run.drones.at(-1), target)), paid: run.drones.at(-1).paid, actualPosition: [run.drones.at(-1).x, run.drones.at(-1).y, run.drones.at(-1).z].map(round) };
}
function realInputOpening() {
  const run = createRun(index, 17), flights = [], openingRest = run.rest;
  for (let slot = 0; slot < 2; slot++) {
    const target = openingOptions.find(p => run.drones.every(d => d3(p, { x: d.bx, y: d.by, z: d.bz }) > 3));
    assert.ok(target);
    flights.push(flyAndAnchor(run, target));
  }
  assert.equal(run.waveIndex, -1); assert.equal(run.rest, openingRest); assert.equal(run.scrap, 8);
  // Aim above both districts while remaining at the actual post-anchor hangar.
  for (let i = 0; i < 360; i++) steerTo(run, 0, 1.0);
  nextWaveNow(run);
  let seconds = 0, pilotContactFrames = 0;
  while (run.phase === 'play' && run.rest === 0 && seconds < 180) {
    step(run, neutral(), dt); seconds += dt; run.fx.length = 0;
    if (run.shipHitting) pilotContactFrames++;
  }
  assert.ok(seconds < 180);
  return { method: 'Automated steering/thrust and step(anchor), zero pose assignments or bonus resources; not a human control-usability test.', flights, core: run.core, kills: run.kills, scrap: run.scrap, canAffordThird: run.scrap >= anchorCost(run.drones.length), seconds: round(seconds), pilotContactFrames };
}
const opening = realInputOpening();
const results = [];
for (const strategy of ['dedicated', 'cross-lane', 'core-heavy']) for (const field of [false, true]) results.push(fullTrial(strategy, field));
// Keep a fixed-layout comparator so a free revision is not silently credited as
// inherent carrier coverage of the opening defense.
results.push(fullTrial('dedicated', false, false));
// Explicit misuse comparator: buying a field before covering the second gate.
results.push(fullTrial('dedicated', true, true, 2));
// Same funded fleets/refits, same final escorts, carrier follows A instead of E.
for (const strategy of ['dedicated', 'cross-lane', 'core-heavy']) results.push(fullTrial(strategy, false, true, 6, 0));
for (const strategy of ['dedicated', 'cross-lane', 'core-heavy']) {
  const e = results.find(r => r.strategy === strategy && !r.withField && r.refit && r.carrierRoute === 5);
  const a = results.find(r => r.strategy === strategy && !r.withField && r.refit && r.carrierRoute === 1);
  assert.deepEqual(a.placements, e.placements, 'carrier route comparison retains every funded placement');
  assert.deepEqual(a.revisions, e.revisions, 'carrier route comparison retains the same setup refit');
}
console.log(JSON.stringify({ limitation: 'Idealized setup pose search and paid placement/reposition APIs, deterministic seed17, ordinary60scrap and8slots, pilot not attacking. One actual-input opening is separate. This is feasibility/comparison evidence, not human difficulty, browser rendering, or optimal play.', candidateCount: options.length, opening, results }, null, 2));
assert.ok(opening.canAffordThird, 'real-input two-line opening earns the ordinary third drone');
assert.ok(results.some(r => !r.withField && r.phase === 'win'), 'a normally funded damage-only fleet can complete all eight waves');
