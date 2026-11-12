// Tension study: where does the pressure go as a fleet grows, and does anything the
// player does during a wave change the result?
// Source-level only; no browser or human playtest. Idealized legal setup poses go
// through the ordinary paid APIs; pilots use ordinary bounded step() inputs.
//
//   Part 1 · slack and depth, per arena, for a greedy all-Pierce buyer:
//     slack - the smallest frozen fleet that still wins, beside the fleet earned;
//     depth - how far along its route the deepest enemy of each wave gets
//             (1.0 is a breach). A defense under pressure kills late.
//   Part 2 · skill spread: the same six play styles on ordinary Shear and on the
//     three-drone lean arena. If every style scores the same, play is not being asked.
//   Part 3 · hull headroom: how much one wave's hull can grow before an untouched
//     earned fleet leaks at all, and how the loss arrives when it does.
// Run: node qa/tension-study.mjs [--json]
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

const bundle = await build({ stdin: { contents: 'export * from "./src/game/sim"; export * from "./src/game/paths"; export * from "./src/game/combat";', resolveDir: new URL('../', import.meta.url).pathname }, bundle: true, platform: 'node', format: 'esm', write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { createRun, step, nextWaveNow, tryAnchor, getAnchorCost, recallSelected, getBeamCoverage, beamContact, beginContinuation, getDroneLimit, LEVELS, DRONE_SPECS } = api;
globalThis.localStorage = { getItem: () => null, setItem() {} };

const dt = 1 / 60;
const round = (n, p = 2) => +n.toFixed(p);
const neutral = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const HULL = { shard: 28, wisp: 40, barge: 96, carrier: 450 };

/** Candidate Pierce poses: secants of every route plus cross-route chords. */
function candidatesFor(level) {
  const valid = p => p.y >= 1.6 && p.y <= 44 && Math.hypot(p.x, p.z) <= 52 && Math.abs(Math.asin(p.f.y)) <= 1.05;
  const options = [];
  const pose = (a, b, reverse) => {
    const len = d3(a, b); if (len < 1) return;
    const f = { x: (b.x - a.x) / len, y: (b.y - a.y) / len, z: (b.z - a.z) / len };
    if (reverse) { for (const k of ['x', 'y', 'z']) f[k] *= -1; [a, b] = [b, a]; }
    const p = { x: a.x - f.x * 4, y: a.y - f.y * 4, z: a.z - f.z * 4, f };
    if (!valid(p)) return;
    const coverage = getBeamCoverage({ paths: level.paths }, { ...p, dx: f.x, dy: f.y, dz: f.z, ...DRONE_SPECS.pierce });
    p.metres = level.paths.map((_, lane) => coverage.segments.filter(s => s.pathIndex === lane).reduce((n, s) => n + s.metres, 0));
    options.push(p);
  };
  for (const path of level.paths) for (let d = 0; d < path.length - 7; d += 3)
    for (const span of [8, 14, 22, 34, 50]) for (const reverse of [false, true])
      pose(path.pointAt(d), path.pointAt(Math.min(path.length, d + span)), reverse);
  for (let a = 0; a < level.paths.length; a++) for (let b = a + 1; b < level.paths.length; b++)
    for (const da of [.1, .25, .4, .55, .7, .85, .95]) for (const db of [.1, .25, .4, .55, .7, .85, .95]) for (const reverse of [false, true])
      pose(level.paths[a].pointAt(level.paths[a].length * da), level.paths[b].pointAt(level.paths[b].length * db), reverse);
  return options;
}

function setPose(run, p) {
  Object.assign(run.ship, { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(-p.f.x, -p.f.z), pitch: Math.asin(p.f.y), vx: 0, vy: 0, vz: 0, yawRate: 0, pitchRate: 0 });
  Object.assign(run, { aimx: p.f.x, aimy: p.f.y, aimz: p.f.z, speed: 0, droneMode: 'pierce' });
}
/** Park the pilot high on the boundary, aimed outward: its gun touches nothing. */
function parkPilot(run) { setPose(run, { x: 51, y: 43.5, z: 0, f: { x: 1, y: 0, z: 0 } }); }

const angleError = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
/** Ordinary bounded inputs: turn toward the enemy nearest its breach and hold ~16m.
 * 'active' re-picks its target every step, leads it and steers crisply: perfect
 * state knowledge, an upper bound on attentive piloting. 'casual' keeps a target
 * for 1.5s before looking again, does not lead, and steers at half the gain: a
 * rough stand-in for a person who is also watching the lattice. Neither is a human. */
function pilotInput(run, memo, style) {
  const casual = style === 'casual';
  memo.look = (memo.look ?? 0) - dt;
  if (!casual || memo.look <= 0 || !memo.target?.alive) {
    let target = null, worst = -1;
    for (const e of run.enemies) {
      if (!e.alive) continue;
      const frac = e.dist / run.paths[e.pathIndex].length;
      if (frac > worst) { worst = frac; target = e; }
    }
    memo.target = target; memo.look = 1.5;
  }
  const target = memo.target;
  if (!target) return neutral();
  const lead = casual ? 0 : 0.35 * target.speed * target.speedScale;
  const tx = target.x + target.tx * lead, ty = target.y + target.ty * lead, tz = target.z + target.tz * lead;
  const dx = tx - run.ship.x, dy = ty - run.ship.y, dz = tz - run.ship.z;
  const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
  const ye = angleError(yaw, run.ship.yaw), pe = pitch - run.ship.pitch;
  const speed = run.ship.vx * run.aimx + run.ship.vy * run.aimy + run.ship.vz * run.aimz;
  const desired = Math.abs(ye) < .35 && Math.abs(pe) < .35 ? clamp((Math.hypot(dx, dy, dz) - 16) * 1.4, -5, 15) : 0;
  const gain = casual ? 1.5 : 3;
  return { ...neutral(), steer: clamp(ye * gain, -1, 1), pitch: clamp(pe * gain, -1, 1), thrust: clamp(((desired - speed) * 3 + speed * 1.12) / 36, -1, 1) };
}

// Mirrors projectDrone in src/game/sim.ts (EXPAND_DIST, FAN, SHIFT_DIST). Study-only.
const CORE = { x: 0, z: 0 };
function projected(d, expand, shift) {
  let rx = d.bx - CORE.x, rz = d.bz - CORE.z, rl = Math.hypot(rx, rz);
  if (rl < 0.35) { rx = 1; rz = 0; rl = 1; }
  rx /= rl; rz /= rl;
  const ax = d.fx + rx * Math.sin(0.3) * expand + shift * Math.sin(0.18), ay = d.fy, az = d.fz + rz * Math.sin(0.3) * expand;
  const al = Math.hypot(ax, ay, az) || 1;
  const dir = { x: ax / al, y: ay / al, z: az / al };
  const x = d.bx + rx * 5.4 * expand + 7.2 * shift, y = d.by, z = d.bz + rz * 5.4 * expand;
  return { x: x + dir.x * 0.7, y: y + dir.y * 0.7, z: z + dir.z * 0.7, dx: dir.x, dy: dir.y, dz: dir.z, ...DRONE_SPECS.pierce };
}
const POSES = [[0, 0], [1, 0], [0, -1], [0, 1], [1, -1], [1, 1]];
/** Pick the Fan/Slide pose that puts the most urgent hull under fixed beams right now.
 * Greedy and myopic, held for at least 0.6s: a lower bound on what flexing offers. */
function flexPose(run, memo) {
  if (memo.hold > 0) { memo.hold -= dt; return memo.pose; }
  const alive = run.enemies.filter(e => e.alive);
  let best = memo.pose ?? POSES[0], bestScore = -1;
  for (const pose of POSES) {
    let score = 0;
    for (const d of run.drones) {
      const beam = projected(d, pose[0], pose[1]);
      for (const e of alive) if (beamContact(beam, e) !== null) score += 1 + 2 * (e.dist / run.paths[e.pathIndex].length);
    }
    if (pose === memo.pose) score *= 1.15; // hysteresis: moving costs ~0.3s of contact
    if (score > bestScore) { bestScore = score; best = pose; }
  }
  if (best !== memo.pose) { memo.pose = best; memo.hold = 0.6; memo.switches = (memo.switches ?? 0) + 1; }
  return best;
}

/** Hull arriving on each lane in the coming wave, used to weight placements. */
function demand(run) {
  const wave = run.waves[run.waveIndex + 1];
  return run.paths.map((_, lane) => (wave?.groups ?? []).filter(g => g.path === lane)
    .reduce((n, g) => n + g.count * HULL[g.kind] * (g.hpMul ?? 1), 0));
}
/** Existing contact metres on each lane, for diminishing returns. */
function supplied(run) {
  return run.paths.map((_, lane) => run.drones.reduce((n, d) => {
    const cover = getBeamCoverage({ paths: run.paths }, { x: d.x, y: d.y, z: d.z, dx: d.ax, dy: d.ay, dz: d.az, ...DRONE_SPECS.pierce });
    return n + cover.segments.filter(s => s.pathIndex === lane).reduce((m, s) => m + s.metres, 0);
  }, 0));
}

export function trial(levelId, { cap = Infinity, continuation = false, seed = 17, pilot = 'parked', lattice = 'rest', refit = false, onlyWave = null, scaleWave = null, hpScale = 1 } = {}) {
  const memo = { pose: POSES[0], hold: 0, switches: 0 };
  const index = LEVELS.findIndex(l => l.id === levelId), level = LEVELS[index];
  const options = trial.cache[levelId] ??= candidatesFor(level);
  const run = createRun(index, seed);
  const limit = Math.min(cap, getDroneLimit(level));
  const waves = [];
  // Study-only isolation of one authored wave, optionally with scaled hull.
  if (onlyWave !== null) run.waveIndex = onlyWave - 1;
  // scaleWave leaves earlier waves alone, so the fleet arriving at it is the earned one.
  const scaled = onlyWave ?? scaleWave;
  if (scaled !== null) for (const g of run.waves[scaled].groups) g.hpMul = (g.hpMul ?? 1) * hpScale;
  let affordable = 0; // fleet size an unconstrained buyer would hold at the end
  const buy = () => {
    if (run.drones.length >= limit || run.scrap < getAnchorCost(run, 'pierce')) return false;
    const need = demand(run), have = supplied(run);
    const total = need.reduce((a, b) => a + b, 0) || 1;
    const ranked = options.map(p => ({ p, score: p.metres.reduce((n, m, lane) => n + m * (need[lane] / total) / (1 + have[lane] / 14), 0) }))
      .sort((a, b) => b.score - a.score);
    for (const { p } of ranked.slice(0, 60)) { setPose(run, p); if (tryAnchor(run) === null) return true; }
    return false;
  };
  const playWave = () => {
    const before = { core: run.core, kills: run.kills };
    const seen = new Map(); // enemy slot -> deepest fraction this life
    const finished = [];
    let dealt = 0, hull = 0;
    const wave = run.waves[run.waveIndex + 1];
    for (const g of wave.groups) hull += g.count * HULL[g.kind] * level.hpMul * (g.hpMul ?? 1);
    nextWaveNow(run);
    const index = run.waveIndex;
    let guard = 0;
    while (run.phase === 'play' && run.rest <= 0 && run.waveIndex === index && guard++ < 60 * 400) {
      if (pilot === 'parked') parkPilot(run);
      const damageBefore = run.drones.reduce((n, d) => n + d.damage, 0);
      const input = pilot === 'parked' ? neutral() : pilotInput(run, memo, pilot);
      if (lattice === 'flex') { const pose = flexPose(run, memo); input.expand = pose[0] === 1; input.shift = pose[1]; }
      step(run, input, dt);
      dealt += run.drones.reduce((n, d) => n + d.damage, 0) - damageBefore;
      run.enemies.forEach((e, slot) => {
        if (e.alive) seen.set(slot, Math.max(seen.get(slot) ?? 0, e.dist / run.paths[e.pathIndex].length));
        else if (seen.has(slot)) { finished.push(seen.get(slot)); seen.delete(slot); }
      });
    }
    for (const v of seen.values()) finished.push(v);
    const leaked = before.core - run.core;
    waves.push({ wave: index + 1, fleet: run.drones.length, scrapAfter: run.scrap, coreLost: leaked,
      deepest: round(leaked > 0 ? 1 : Math.max(0, ...finished)), meanDepth: round(finished.reduce((a, b) => a + b, 0) / (finished.length || 1)),
      hull: round(hull, 0), droneDamage: round(dealt, 0) });
  };
  while (run.phase === 'play') {
    if (run.rest > 0) {
      // Free setup revision: return every drone at its paid price and re-place the
      // whole lattice for the coming wave. Equivalent to free Reposition of each.
      if (refit) for (const d of [...run.drones]) recallSelected(run, d.id);
      while (buy()) {}
      // What an uncapped buyer could hold from the same income (prices only rise).
      let scrap = run.scrap, owned = run.drones.length;
      while (scrap >= 20 + 12 * owned) { scrap -= 20 + 12 * owned; owned++; }
      affordable = owned;
      playWave();
      if (onlyWave !== null) break;
    } else break;
    if (run.phase === 'win' && continuation && beginContinuation(run)) continue;
  }
  return { level: levelId, pilot, lattice, refit, switches: memo.switches, cap: Number.isFinite(cap) ? cap : null, outcome: run.phase, core: run.core, kills: run.kills,
    fleet: run.drones.length, affordableFleet: Math.max(affordable, run.drones.length), wavesPlayed: waves.length, waves };
}
trial.cache = {};

/** Smallest frozen all-Pierce fleet under this policy that still wins, and at 100 core. */
export function slack(levelId, opts = {}) {
  const free = trial(levelId, opts);
  let survive = null, flawless = null;
  for (let cap = 1; cap <= Math.min(free.fleet, 24); cap++) {
    const r = trial(levelId, { ...opts, cap });
    if (r.outcome === 'win' && survive === null) survive = cap;
    if (r.outcome === 'win' && r.core === 100) { flawless = cap; break; }
  }
  return { level: levelId, unconstrained: free, minToSurvive: survive, minFlawless: flawless };
}

const POLICIES = [
  ['parked', 'rest', false, 'Never fly, never move a drone'],
  ['parked', 'rest', true, 'Re-place every line each setup; never fly'],
  ['casual', 'rest', false, 'Fly casually; drones stay where first placed'],
  ['casual', 'flex', false, 'Fly casually; Fan/Slide live; no re-placing'],
  ['casual', 'rest', true, 'Fly casually; re-place each setup'],
  ['active', 'flex', true, 'Fly sharply; Fan/Slide live; re-place each setup'],
];
const SEEDS = [17, 3, 99, 2024, 7];
const outcome = r => r.outcome === 'win' ? String(r.core) : `L${r.wavesPlayed}`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const slackRows = [], skillRows = [];
  console.log('PART 1 · Slack and depth. Greedy all-Pierce buyer, seed 17. "deepest" is how far along');
  console.log('its route the worst enemy of each wave got before dying (1.00 = breach).');
  for (const [id, base] of [['tutorial', {}], ['shear', {}], ['split-crown', {}], ['split-crown', { continuation: true }], ['helix-frontier', {}]]) for (const pilot of ['parked', 'active']) {
    const s = slack(id, { ...base, pilot }), u = s.unconstrained;
    slackRows.push({ level: id, continuation: !!base.continuation, pilot, outcome: u.outcome, core: u.core, fleet: u.fleet,
      minToSurvive: s.minToSurvive, minFlawless: s.minFlawless, waves: u.waves });
    console.log(`\n${id}${base.continuation ? ' + continuation' : ''} · ${pilot} pilot: ${u.outcome} at ${u.core} core, fleet ${u.fleet}`);
    console.log(`  smallest frozen fleet that survives ${s.minToSurvive ?? '—'} · clears at 100 core ${s.minFlawless ?? '—'}`);
    console.log(`  deepest by wave: ${u.waves.map(w => w.deepest.toFixed(2)).join(' ')}`);
  }
  console.log('\nPART 2 · Does what the player does change the result? Core kept across five seeds');
  console.log('(L4 = lost during wave 4). Same policies, ordinary Shear versus Three Lines.');
  for (const id of ['shear', 'lean-shear']) {
    console.log(`\n${id}`);
    for (const [pilot, lattice, refit, label] of POLICIES) {
      const results = SEEDS.map(seed => outcome(trial(id, { pilot, lattice, refit, seed })));
      skillRows.push({ level: id, pilot, lattice, refit, label, seeds: SEEDS, results });
      console.log(`  ${label.padEnd(50)} ${results.map(r => r.padStart(4)).join(' ')}`);
    }
  }
  console.log('\nPART 3 · Hull headroom. One wave is scaled while the same earned, untouched fleet');
  console.log('meets it (pilot parked). Core lost in that wave at each hull scale.');
  const SCALES = [1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.6, 3];
  const headroomRows = [];
  console.log(`  ${'hull ×'.padEnd(22)} ${SCALES.map(n => String(n).padStart(4)).join(' ')}`);
  for (const [id, wave] of [['shear', 3], ['shear', 4], ['split-crown', 5], ['split-crown', 6]]) {
    const lost = SCALES.map(hpScale => trial(id, { scaleWave: wave, hpScale }).waves[wave]?.coreLost ?? null);
    headroomRows.push({ level: id, wave: wave + 1, scales: SCALES, coreLost: lost });
    console.log(`  ${`${id} wave ${wave + 1}`.padEnd(22)} ${lost.map(n => String(n ?? '—').padStart(4)).join(' ')}`);
  }
  // One row per line keeps the record readable in a diff.
  const rows = list => `[\n${list.map(row => `  ${JSON.stringify(row)}`).join(',\n')}\n ]`;
  if (process.argv.includes('--json')) writeFileSync(new URL('../docs/TENSION_STUDY.json', import.meta.url),
    `{\n "note": "Source-level policies only; not human play. See docs/LEAN_LATTICE.md.",\n "slack": ${rows(slackRows)},\n "skill": ${rows(skillRows)},\n "headroom": ${rows(headroomRows)}\n}\n`);
}
