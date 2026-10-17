// Contracts for one-turn Lumen relays and growable enemy storage. No browser required.
import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({
  stdin: {
    contents:
      'export * from "./src/game/sim"; export * from "./src/game/combat"; export * from "./src/game/paths"; export { traceRelay } from "./src/game/relay";',
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
  createRun,
  LEVELS,
  buildPath,
  traceRelay,
  droneBeam,
  getRelayTraces,
  getPlacementPreview,
  getDroneCoverage,
  getBeamCoverage,
  step,
  tryAnchor,
  beginReposition,
  recallSelected,
  recallLast,
  getAnchorCost,
  enemySpeedScale,
  startFieldCheck,
  endFieldCheck,
  nextWaveNow,
  DRONE_SPECS,
  getCoverageTiming,
  availableDroneModes,
} = api;
globalThis.localStorage = { getItem: () => null, setItem() {} };
const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} differs from ${b}`);
const input = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const labIndex = LEVELS.findIndex((l) => l.prototype === "relay");
const crownIndex = LEVELS.findIndex((l) => l.id === "split-crown");
const drone = (mode, id, x, y = 8, z = 0, fx = 1, fy = 0, fz = 0) => ({
  id,
  mode,
  paid: 48,
  damage: 0,
  kills: 0,
  hit: false,
  shotCooldown: 0,
  shotFlash: 0,
  shotTarget: null,
  bx: x,
  by: y,
  bz: z,
  x,
  y,
  z,
  fx,
  fy,
  fz,
  ax: fx,
  ay: fy,
  az: fz,
});
const receiver = (id, x, y = 8, z = 0, ax = 0, ay = 0, az = 1) => ({ id, x, y, z, ax, ay, az, radius: 1 });
const sourceBeam = () => droneBeam(drone("lumen", 1, 0));
const target = (x, y = 8, z = 0) => ({ x, y, z, radius: 0.72 });
function fixture() {
  const r = createRun(labIndex >= 0 ? labIndex : crownIndex, 71);
  r.level = {
    ...r.level,
    prototype: "relay",
    experiment: true,
    dronePricing: "per-type",
    fleetGrowth: "scrap",
    stasisAvailable: true,
  };
  r.paths = [buildPath("line", (t) => ({ x: 80 * t, y: 8, z: 0 }))];
  r.waves = [{ groups: [] }];
  r.waveIndex = 0;
  r.rest = 0;
  Object.assign(r.ship, { x: 0, y: 43, z: 49, yaw: 0, pitch: 0 });
  r.drones = [drone("lumen", 1, 0), drone("relay", 2, 20, 8, 0, 0, 0, 1)];
  r.nextDroneId = 3;
  return r;
}
function enemy(r, index, dist, options = {}) {
  const e = r.enemies[index];
  Object.assign(e, {
    alive: true,
    kind: "shard",
    pathIndex: 0,
    dist,
    hp: 100,
    maxHp: 100,
    speed: 0,
    speedScale: 1,
    pinSlowRemaining: 0,
    lumenSlowRemaining: 0,
    stasisSeen: false,
    amp: 0,
    radius: 0.72,
    reward: 8,
    leak: 7,
    ...r.paths[options.pathIndex ?? 0].pointAt(dist),
    ...options,
  });
  return e;
}
let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`✓ ${name}`);
}

test("One turn consumes a shared range budget and keeps the same finite-cylinder boundaries", () => {
  const beam = sourceBeam(),
    relay = receiver(2, 20);
  const trace = traceRelay(1, beam, [relay]);
  assert.equal(trace.relayId, 2);
  assert.equal(trace.segments.length, 2);
  const [first, second] = trace.segments.map((s) => s.beam);
  near(first.range, 19.3);
  near(second.range, 56);
  near(first.range + 0.7 + second.range, 76);
  near(second.x, 20);
  near(second.z, 0.7);
  assert.equal(traceRelay(1, beam, [relay], [target(20, 8, 56.71)]).target, null);
  assert.notEqual(traceRelay(1, beam, [relay], [target(20, 8, 56.7)]).target, null);
  assert.equal(traceRelay(1, beam, [receiver(3, 20, 10.101)]).relayId, null);
  assert.equal(traceRelay(1, beam, [receiver(3, 20, 10.099)]).relayId, 3);
});

test("Enemies interrupt power before a relay, win exact ties, and do not block after the turn", () => {
  const beam = sourceBeam(),
    relay = receiver(2, 20),
    before = target(10),
    after = target(25),
    turned = target(20, 8, 10);
  const blocked = traceRelay(1, beam, [relay], [turned, before]);
  assert.equal(blocked.target, before);
  assert.equal(blocked.relayId, null);
  assert.equal(blocked.segments.length, 1);
  near(blocked.segments[0].beam.range, 9.3);
  const tied = target(20);
  assert.equal(traceRelay(1, beam, [relay], [tied]).target, tied);
  assert.equal(traceRelay(1, beam, [relay], [after, turned]).target, turned);
  assert.equal(traceRelay(1, beam, [receiver(9, 20), receiver(2, 20)]).relayId, 2);
});

test("Second receivers stop output; no chain, loop, split, or independent relay beam exists", () => {
  const r = fixture(),
    trace = traceRelay(1, sourceBeam(), [receiver(2, 20), receiver(3, 20, 8, 10)]);
  assert.equal(trace.segments.length, 2);
  assert.equal(trace.stop, "relay");
  assert.equal(trace.blockedRelayId, 3);
  near(trace.segments[1].beam.range, 9.3);
  r.drones = [r.drones[1]];
  assert.deepEqual(getRelayTraces(r), []);
  assert.equal(getDroneCoverage(r, r.drones[0]).metres, 0);
  r.droneMode = "relay";
  r.repositionId = 2;
  Object.assign(r.ship, { x: 20, y: 8, z: 0 });
  r.aimx = 0;
  r.aimy = 0;
  r.aimz = 1;
  assert.deepEqual(getPlacementPreview(r).relayTraces, []);
});

test("Potential coverage is the union of powered segments, never the imaginary line behind a relay", () => {
  const r = fixture(),
    source = r.drones[0],
    relay = r.drones[1];
  let coverage = getDroneCoverage(r, source);
  assert.ok(coverage.metres < 23, `incoming line should end at 20m, got ${coverage.metres}`);
  relay.fx = -1;
  relay.fz = 0;
  relay.ax = -1;
  relay.az = 0;
  const traces = getRelayTraces(r),
    parts = traces[0].segments.map((s) => getBeamCoverage(r, s.beam).metres);
  coverage = getDroneCoverage(r, source);
  assert.ok(coverage.metres < parts[0] + parts[1] - 10, "overlap must not count the same route twice");
  assert.deepEqual(getDroneCoverage(r, relay), coverage);
});

test("Reposition preview replaces the old receiver, shares Fan/Slide projection, and preserves exact paid identity", () => {
  const r = fixture();
  r.rest = 8;
  r.scrap = 100;
  const d = r.drones[1];
  d.paid = 16;
  d.damage = 0;
  assert.equal(beginReposition(r, d.id), null);
  Object.assign(r.ship, { x: 20, y: 8, z: 0 });
  r.aimx = 0;
  r.aimy = 0;
  r.aimz = -1;
  r.expand = 0.4;
  r.shift = -0.3;
  const preview = getPlacementPreview(r),
    balance = r.scrap;
  assert.equal(preview.relayTraces.length, 1);
  assert.equal(tryAnchor(r), null);
  assert.equal(r.drones.length, 2);
  assert.equal(r.drones[1], d);
  assert.equal(d.paid, 16);
  assert.equal(r.scrap, balance);
  assert.deepEqual(getRelayTraces(r), preview.relayTraces);
  assert.deepEqual(getDroneCoverage(r, d).segments, preview.segments);
  assert.equal(recallSelected(r, d.id), null);
  assert.equal(r.scrap, balance + 16);
});

test("Lumen credits one target to the emitter, refreshes a non-stacking slow, and hides during field checks", () => {
  const r = fixture();
  r.paths = [buildPath("output", (t) => ({ x: 20, y: 8, z: t * 70 }))];
  const e = enemy(r, 0, 8),
    farther = enemy(r, 1, 16);
  step(r, input(), 0.25);
  near(e.hp, 98);
  near(farther.hp, 100);
  near(r.drones[0].damage, 2);
  near(r.drones[1].damage, 0);
  near(e.lumenSlowRemaining, 2.4);
  near(e.speedScale, 0.6);
  assert.equal(r.stasisTouched, 0);
  step(r, input(), 0.25);
  near(e.lumenSlowRemaining, 2.4);
  e.hp = 1;
  const scrap = r.scrap;
  step(r, input(), 0.25);
  assert.equal(r.kills, 1);
  assert.equal(r.scrap, scrap + 8);
  near(r.drones[0].damage, 5);
  assert.equal(r.drones[0].kills, 1);
  assert.equal(r.drones[1].kills, 0);
  farther.alive = false;
  r.rest = 8;
  r.drones.push(drone("stasis", 3, 20, 8, 8));
  assert.equal(startFieldCheck(r), null);
  const damage = r.drones[0].damage;
  assert.deepEqual(getRelayTraces(r), []);
  assert.deepEqual(getRelayTraces(r, true), []);
  step(r, input(), 0.5);
  near(r.drones[0].damage, damage);
  endFieldCheck(r);
});

test("Lumen, Pin, and Stasis use strongest-only slowing with accurate independent expiry", () => {
  const r = fixture(),
    e = enemy(r, 0, 8, { speed: 4, pinSlowRemaining: 0.2, lumenSlowRemaining: 0.1 });
  r.drones = [];
  near(enemySpeedScale(r, e), 0.6);
  const start = e.dist;
  step(r, input(), 0.3);
  near(e.dist - start, 4 * (0.1 * 0.6 + 0.1 * 0.65 + 0.1));
  near(e.lumenSlowRemaining, 0);
  near(e.pinSlowRemaining, 0);
  r.drones = [drone("stasis", 1, e.x, e.y, e.z), drone("stasis", 2, e.x, e.y, e.z)];
  e.lumenSlowRemaining = 2.4;
  e.pinSlowRemaining = 2.4;
  near(enemySpeedScale(r, e), 0.5);
});

test("Relay Lab alone offers one Lumen and independent affordable relays; reposition cannot trip its scarcity", () => {
  assert.ok(labIndex >= 0, "Relay Lab must be authored");
  assert.deepEqual(availableDroneModes(LEVELS[labIndex]), [
    "pierce",
    "sweep",
    "stasis",
    "pin",
    "lumen",
    "relay",
  ]);
  for (const level of LEVELS.filter((l) => l.prototype !== "relay")) {
    assert.equal(availableDroneModes(level).includes("lumen"), false);
    assert.equal(availableDroneModes(level).includes("relay"), false);
  }
  const r = createRun(labIndex);
  assert.equal(r.scrap, 100);
  assert.equal(r.routeGhost, true);
  r.droneMode = "lumen";
  Object.assign(r.ship, { x: 12, y: 8, z: 0 });
  assert.equal(getAnchorCost(r), 48);
  assert.equal(tryAnchor(r), null);
  Object.assign(r.ship, { x: 18, y: 8, z: 0 });
  r.scrap = 1000;
  assert.equal(tryAnchor(r), "Relay Lab supports one Lumen emitter");
  assert.equal(getAnchorCost(r, "relay"), 16);
  assert.equal(getAnchorCost(r, "pierce"), 20);
  r.rest = 0;
  assert.equal(recallLast(r), "Recall Lumen/Relay during setup");
  assert.equal(r.drones.length, 1);
  r.drones.push(drone("relay", 2, 20));
  assert.equal(recallLast(r), "Recall Lumen/Relay during setup");
  r.drones.pop();
  r.rest = 8;
  const d = r.drones[0];
  assert.equal(beginReposition(r, d.id), null);
  Object.assign(r.ship, { x: 16, y: 8, z: 3 });
  const balance = r.scrap;
  assert.equal(tryAnchor(r), null);
  assert.equal(r.scrap, balance);
  assert.equal(r.drones.length, 1);
});

test("Spawn 65 is on schedule, pool growth preserves RNG, and reused slots clear all timed effects", () => {
  const make = () => {
    const r = createRun(labIndex, 91);
    r.waves = [{ groups: [{ kind: "wisp", path: 0, count: 65, interval: 0, delay: 0, spawned: 0 }] }];
    r.drones = [];
    Object.assign(r.ship, { x: 0, y: 43, z: 49, yaw: 0, pitch: 0 });
    return r;
  };
  const grown = make(),
    preallocated = make();
  for (let i = 64; i < 128; i++) preallocated.enemies.push({ ...preallocated.enemies[0] });
  grown.enemies[0].pinSlowRemaining = 1;
  grown.enemies[0].lumenSlowRemaining = 2;
  nextWaveNow(grown);
  nextWaveNow(preallocated);
  step(grown, input(), 0.01);
  step(preallocated, input(), 0.01);
  assert.equal(grown.enemies.length, 128);
  assert.equal(grown.enemies.filter((e) => e.alive).length, 65);
  assert.equal(grown.waves[0].groups[0].spawned, 65);
  assert.equal(grown.randomState, preallocated.randomState);
  assert.deepEqual(grown.enemies, preallocated.enemies);
  near(grown.enemies[0].lumenSlowRemaining, 0);
  near(grown.enemies[0].pinSlowRemaining, 0);
});

test("Breach feedback uses the actual port and coverage timing distinguishes quiet and future lanes", () => {
  const r = fixture();
  r.drones = [];
  r.paths = [
    buildPath("portA", (t) => ({ x: 10 + t * 10, y: 8, z: 0 })),
    buildPath("portB", (t) => ({ x: 10 + t * 10, y: 14, z: 0 })),
  ];
  const e = enemy(r, 0, 9.8);
  step(r, input(), 0.01);
  const leak = r.fx.find((f) => f.type === "leak");
  assert.ok(leak);
  near(leak.x, 20);
  near(leak.y, 8);
  near(leak.z, 0);
  assert.match(r.hint, /Gate A breached/);
  r.waveIndex = -1;
  r.rest = 8;
  r.waves = [
    { groups: [{ path: 0, count: 1, spawned: 0 }] },
    { groups: [{ path: 1, count: 1, spawned: 0 }] },
  ];
  const timing = getCoverageTiming(r, {
    segments: [
      { pathIndex: 0, metres: 3, points: [] },
      { pathIndex: 1, metres: 4, points: [] },
    ],
    metres: 7,
    sampleRadius: 0.72,
  });
  assert.deepEqual(timing, { nowMetres: 3, laterMetres: 4, idleMetres: 0 });
});

console.log(`${checks} relay and pool checks passed.`);
