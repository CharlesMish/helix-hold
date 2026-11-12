// Lean Lattice ("Three Lines") contract checks. No browser, WebGL or dev server.
// The policy checks at the end protect the experiment's premise: a small fleet
// makes what the player does matter. They use study policies, not human play.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: 'export * from "./src/game/sim"; export * from "./src/game/paths"; export * from "./src/game/save";', resolveDir: new URL('../', import.meta.url).pathname }, bundle: true, platform: 'node', format: 'esm', write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { LEVELS, LEAN_INDEX, createRun, tryAnchor, getDroneLimit, availableDroneModes, getAnchorCost, recordWin, recordLabResult, loadSave } = api;
const { trial } = await import('./tension-study.mjs');

function storage() {
  const data = new Map();
  globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  return data;
}
storage();
let checks = 0;
function test(name, fn) { fn(); checks += 1; console.log(`✓ ${name}`); }
const lean = LEVELS[LEAN_INDEX], shear = LEVELS.find(l => l.id === 'shear');
const place = (run, x) => { Object.assign(run.ship, { x, y: 20, z: 12, vx: 0, vy: 0, vz: 0 }); return tryAnchor(run); };

test('Three Lines funds exactly three drones up front and sells no fourth', () => {
  assert.equal(lean.id, 'lean-shear');
  assert.equal(getDroneLimit(lean), 3);
  const run = createRun(LEAN_INDEX);
  assert.equal(run.scrap, 96);
  assert.deepEqual([0, 1, 2].map(i => { const cost = getAnchorCost(run); assert.equal(place(run, -6 + i * 6), null); return cost; }), [20, 32, 44]);
  assert.equal(run.scrap, 0);
  run.scrap = 10_000;
  assert.equal(place(run, 18), 'Lattice is full');
  assert.equal(run.drones.length, 3);
});

test('Its roster is Pierce and Sweep only; other experiments keep their fields', () => {
  assert.deepEqual(availableDroneModes(lean), ['pierce', 'sweep']);
  assert.ok(availableDroneModes(LEVELS.find(l => l.id === 'carrier-test')).includes('stasis'));
  assert.ok(availableDroneModes(LEVELS.find(l => l.id === 'helix-frontier')).includes('stasis'));
  assert.ok(!availableDroneModes(shear).includes('stasis'));
});

test('It borrows Shear geometry without changing Shear', () => {
  assert.equal(lean.paths, shear.paths);
  assert.equal(shear.fleetCap, undefined);
  assert.equal(getDroneLimit(shear), 8);
  assert.equal(shear.hpMul, 1.08);
  assert.equal(shear.waves.length, 5);
  assert.equal(shear.continuation.length, 3);
  assert.equal(lean.continuation, undefined);
  assert.equal(lean.waves.length, 6);
  assert.ok(lean.waves.every(w => w.chapter && w.lesson));
  // From wave 2 on, every wave uses at least two lanes: the premise of the schedule.
  assert.ok(lean.waves.slice(1).every(w => new Set(w.groups.map(g => g.path)).size >= 2));
});

test('A lean result is saved apart from campaign scores and survives later campaign wins', () => {
  const data = storage();
  recordWin('shear', 83);
  const before = JSON.stringify(loadSave().bestByLevel);
  let save = recordLabResult('lean-shear', 64);
  assert.equal(save.labBestByLevel['lean-shear'], 64);
  assert.equal(JSON.stringify(save.bestByLevel), before);
  save = recordLabResult('lean-shear', 41);
  assert.equal(save.labBestByLevel['lean-shear'], 64, 'a weaker flight keeps the best');
  assert.deepEqual(recordLabResult('helix-frontier', 100).labBestByLevel, { 'lean-shear': 64 }, 'other prototypes still record nothing');
  assert.equal(recordWin('split-crown', 90).labBestByLevel['lean-shear'], 64);
  assert.equal(loadSave().bestByLevel.shear, 83);
  assert.equal(data.size, 1);
  storage();
});

test('Premise: on Three Lines an untouched lattice loses, and flying plus re-placing wins', () => {
  storage();
  const untouched = trial('lean-shear', { pilot: 'parked' });
  const planner = trial('lean-shear', { pilot: 'parked', refit: true });
  const flyer = trial('lean-shear', { pilot: 'casual' });
  const both = trial('lean-shear', { pilot: 'casual', refit: true });
  assert.equal(untouched.outcome, 'lose');
  assert.equal(planner.outcome, 'lose', 'planning alone is not enough');
  assert.equal(flyer.outcome, 'lose', 'flying alone is not enough');
  assert.equal(both.outcome, 'win');
  assert.ok(both.core < 100, 'the reference pilot still takes damage: headroom remains');
});

test('Contrast: the same play styles all finish ordinary Shear untouched', () => {
  storage();
  for (const opts of [{ pilot: 'parked', refit: true }, { pilot: 'casual' }, { pilot: 'casual', refit: true }]) {
    const r = trial('shear', opts);
    assert.equal(r.outcome, 'win');
    assert.equal(r.core, 100);
  }
});

console.log(`\n${checks} lean-lattice checks passed. Study policies only; no browser or human playtest performed.`);
