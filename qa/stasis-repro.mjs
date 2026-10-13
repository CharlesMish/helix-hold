// Regression reproduction for the report that an all-Stasis fleet always shows zero.
// Exercises authored spawning and the same step(anchor) route as the UI. It does
// not prove browser rendering, pointer/keyboard delivery, or the deployed bundle.
import { build } from 'esbuild';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {} };
const root = new URL('../', import.meta.url).pathname;
const bundle = await build({
  stdin: { contents: 'export * from "./src/game/sim"; export * from "./src/game/paths"; export * from "./src/game/combat";', resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const neutral = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const dt = 1 / 60;
const rounded = n => +n.toFixed(3);

function moveShip(run, p) {
  Object.assign(run.ship, { ...p, yaw: -Math.PI / 2, pitch: 0, vx: 0, vy: 0, vz: 0, yawRate: 0, pitchRate: 0 });
  Object.assign(run, { aimx: 1, aimy: 0, aimz: 0, speed: 0 });
}

function trial(centers, wave = 0, funded = true) {
  const run = api.createRun(api.CARRIER_TEST_INDEX, 17);
  if (!funded) run.scrap = 1000; // Explicit diagnostic inventory for all eight slots.
  const before = run.scrap;
  const placement = [];
  for (const center of centers) {
    moveShip(run, center);
    run.droneMode = 'stasis'; // The Digit3/chooseMode UI assignment.
    const preview = api.getPlacementPreview(run);
    assert.equal(preview.status, null);
    api.step(run, { ...neutral(), anchor: true }, dt);
    const drone = run.drones.at(-1);
    assert.equal(drone?.mode, 'stasis');
    assert.deepEqual([drone.x, drone.y, drone.z], [preview.drone.x, preview.drone.y, preview.drone.z]);
    placement.push({ center: { x: rounded(drone.x), y: rounded(drone.y), z: rounded(drone.z) }, paid: drone.paid,
      coveredMetresByLane: run.paths.map((_, i) => rounded(preview.segments.filter(s => s.pathIndex === i).reduce((n, s) => n + s.metres, 0))) });
  }
  assert.equal(run.drones.length, centers.length);
  moveShip(run, { x: 50, y: 44, z: 0 }); // Pilot shoots away from the arena.
  // Waves are the original authored waves; selecting later waves here isolates
  // their field behavior, not progression/economic feasibility.
  run.waveIndex = wave - 1;
  api.nextWaveNow(run);
  let frame = 0, maxSlowed = 0, slowFrames = 0, hudPositiveSamples = 0, mismatchFrames = 0;
  let firstSlowedAt = null, slowedEnemySeconds = 0, maxAlive = 0;
  const firstEnemyProgress = [];
  while (run.phase === 'play' && run.rest === 0 && frame++ < 60 * 180) {
    api.step(run, neutral(), dt);
    run.fx.length = 0;
    const alive = run.enemies.filter(e => e.alive);
    const slowed = alive.filter(e => e.speedScale < 1).length; // Actual global HUD expression.
    const inFields = alive.filter(e => run.drones.some(d => api.insideStasis(d, e))).length; // Survey expression.
    // Newly spawned enemies are written after movement in the current frame.
    if (slowed !== inFields && alive.every(e => e.dist > 0)) mismatchFrames++;
    maxSlowed = Math.max(maxSlowed, slowed); maxAlive = Math.max(maxAlive, alive.length);
    if (slowed) { slowFrames++; firstSlowedAt ??= frame * dt; }
    slowedEnemySeconds += slowed * dt;
    if (frame % 6 === 0 && slowed) hudPositiveSamples++; // HUD paint runs at 10Hz.
    if ([180, 300, 480].includes(frame)) firstEnemyProgress.push({ at: frame * dt, firstDistance: rounded(run.enemies[0].dist) });
  }
  assert.ok(frame < 60 * 180, 'authored wave finishes');
  assert.equal(run.kills, 0, 'no damaging drones or pilot contact');
  assert.equal(mismatchFrames, 0, 'movement state and geometric field counter agree away from spawn frame');
  if (centers.length) assert.ok(maxSlowed > 0 && hudPositiveSamples > 0, 'anchored Stasis must become visible to the real HUD predicate');
  return { wave: wave + 1, inventory: funded ? 'normal paid opening' : 'diagnostic extra scrap', spent: before - run.scrap,
    placement, maxAlive, maxSlowed, hudPositiveSamples, firstSlowedAt: firstSlowedAt === null ? null : rounded(firstSlowedAt),
    secondsWithSlow: rounded(slowFrames * dt), slowedEnemySeconds: rounded(slowedEnemySeconds),
    firstEnemyProgress, duration: rounded(frame * dt), core: run.core };
}

const level = api.LEVELS[api.CARRIER_TEST_INDEX];
const firstLaneCenters = [.28, .66].map(t => level.paths[0].pointAt(level.paths[0].length * t));
const baseline = trial([]);
const allPaidStasis = trial(firstLaneCenters);
assert.equal(allPaidStasis.spent, 52, 'first two fields cost ordinary 20 + 32 scrap');
assert.ok(allPaidStasis.duration > baseline.duration + 2, 'authored wave is measurably delayed');
assert.ok(allPaidStasis.firstEnemyProgress.some((e, i) => e.firstDistance < baseline.firstEnemyProgress[i].firstDistance - 1), 'distance travelled falls behind matched baseline');

// Eight normally anchored fields, distributed across all three actual routes.
// Extra scrap is strictly diagnostic: no economy claim is made for this case.
const allEightCenters = [0, 1, 2].flatMap((lane, i) => (i === 0 ? [.15, .4, .68] : i === 1 ? [.18, .5, .76] : [.3, .64])
  .map(t => level.paths[lane].pointAt(level.paths[lane].length * t)));
const eightFieldWaves = [0, 1, 2].map(wave => trial(allEightCenters, wave, false));
console.log(JSON.stringify({ method: 'Fresh source, authored enemy groups, real paid step(anchor) opening, no direct enemy injection. Extra-scrap eight-slot diagnostic is separately labeled. Browser rendering and deployed artifact are not tested.', baseline, allPaidStasis, eightFieldWaves }, null, 2));
