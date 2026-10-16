// Real paid placement/refund contracts for Crown's independent role prices.
// Seeded money isolates accounting; funded full-flight trials are separate.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: 'export * from "./src/game/sim"; export * from "./src/game/paths"; export * from "./src/game/economy";', resolveDir: new URL('../', import.meta.url).pathname }, bundle: true, platform: 'node', format: 'esm', write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { LEVELS, SPLIT_CROWN_INDEX, createRun, anchorCost, getAnchorCost, tryAnchor, beginReposition, recallSelected, recallLast } = api;
globalThis.localStorage = { getItem: () => null, setItem() {} };
let checks = 0;
function test(name, fn) { fn(); checks++; console.log(`✓ ${name}`); }
function anchor(run, mode, slot = run.drones.length) {
  // All positions are separated and within flight bounds. Placement remains paid.
  Object.assign(run.ship, { x: -36 + (slot % 12) * 6, y: 16 + Math.floor(slot / 12) * 6, z: 4 });
  run.droneMode = mode;
  const before = run.scrap, quote = getAnchorCost(run);
  assert.equal(tryAnchor(run), null);
  assert.equal(before - run.scrap, quote);
  assert.equal(run.drones.at(-1).paid, quote);
  return run.drones.at(-1);
}

test('Crown keeps the original two-Pierce opening and pure-Pierce purchase curve', () => {
  const run = createRun(SPLIT_CROWN_INDEX);
  assert.equal(run.scrap, 60);
  anchor(run, 'pierce'); anchor(run, 'pierce');
  assert.equal(run.scrap, 8);
  assert.equal(getAnchorCost(run), 44);
  run.scrap = 10_000;
  for (let i = 2; i < 12; i++) anchor(run, 'pierce');
  assert.deepEqual(run.drones.map(d => d.paid), Array.from({ length: 12 }, (_, i) => anchorCost(i)));
});

test('Each paid role raises only its own quote, including a ninth support unit', () => {
  const run = createRun(SPLIT_CROWN_INDEX); run.scrap = 10_000;
  for (let i = 0; i < 8; i++) anchor(run, 'pierce');
  const quotes = () => ['pierce', 'sweep', 'stasis', 'halo', 'pin'].map(mode => getAnchorCost(run, mode));
  assert.deepEqual(quotes(), [116, 24, 32, 44, 48]);
  const field = anchor(run, 'stasis');
  assert.equal(field.paid, 32); assert.equal(run.drones.length, 9);
  assert.deepEqual(quotes(), [116, 24, 52, 44, 48]);
  anchor(run, 'halo'); assert.deepEqual(quotes(), [116, 24, 52, 64, 48]);
  anchor(run, 'pin'); assert.deepEqual(quotes(), [116, 24, 52, 64, 72]);
  anchor(run, 'sweep'); assert.deepEqual(quotes(), [116, 36, 52, 64, 72]);
  assert.equal(run.scrap, 10_000 - 644);
});

test('Existing arenas retain shared prices and cannot inherit Crown discounts', () => {
  for (const [index, level] of LEVELS.entries()) {
    if (index === SPLIT_CROWN_INDEX || level.prototype) continue;
    assert.notEqual(level.dronePricing, 'per-type');
    const run = createRun(index); run.scrap = 100;
    anchor(run, 'pierce'); anchor(run, 'sweep');
    assert.deepEqual(run.drones.map(d => d.paid), [20, 32]);
    for (const mode of ['pierce', 'sweep', 'stasis', 'halo', 'pin']) assert.equal(getAnchorCost(run, mode), 44);
  }
});

test('Reposition preserves a paid support unit and Recall refunds that actual amount', () => {
  const run = createRun(SPLIT_CROWN_INDEX); run.scrap = 1000;
  const first = anchor(run, 'pierce');
  const oldField = anchor(run, 'stasis'), field = anchor(run, 'stasis');
  field.kills = 3; field.damage = 12;
  const identity = { id: field.id, mode: field.mode, paid: field.paid, kills: field.kills, damage: field.damage };
  assert.equal(identity.paid, 52);
  assert.equal(recallSelected(run, oldField.id), null);
  // Its full original 52-scrap purchase remains attached even after the cheaper
  // older field is gone and the count/next quote have changed.
  const before = run.scrap;
  assert.equal(beginReposition(run, field.id), null);
  run.ship.z += 8;
  assert.equal(tryAnchor(run), null);
  assert.equal(run.scrap, before);
  assert.strictEqual(run.drones.find(d => d.id === field.id), field);
  assert.deepEqual({ id: field.id, mode: field.mode, paid: field.paid, kills: field.kills, damage: field.damage }, identity);
  assert.equal(recallSelected(run, field.id), null);
  assert.equal(run.scrap, before + 52);
  assert.equal(getAnchorCost(run, 'stasis'), 32);
  assert.equal(recallSelected(run, first.id), null);
  assert.equal(run.scrap, 1000);
});

test('Last-in refunds and selected recalls cannot create scrap through repricing', () => {
  const run = createRun(SPLIT_CROWN_INDEX); run.scrap = 1000;
  const modes = ['pierce', 'halo', 'pin', 'stasis', 'halo', 'sweep', 'pin'];
  for (const mode of modes) anchor(run, mode);
  const paid = run.drones.reduce((sum, drone) => sum + drone.paid, 0);
  assert.equal(run.scrap + paid, 1000);
  assert.equal(recallSelected(run, run.drones[1].id), null);
  const replacement = anchor(run, 'halo', 8);
  assert.equal(replacement.paid, 64);
  while (run.drones.length) assert.equal(recallLast(run), null);
  assert.equal(run.scrap, 1000);
});

console.log(`${checks} economy checks passed.`);
