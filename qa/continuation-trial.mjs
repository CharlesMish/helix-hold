// Funded, idealized feasibility for the authored three-wave continuation.
// Setup placements teleport to reachable poses. This is not a human or visual playtest.
import { build } from "esbuild";
import assert from "node:assert/strict";

const bundle = await build({
  stdin: {
    contents: 'export * from "./src/game/sim"; export * from "./src/game/paths"; export * from "./src/game/combat";',
    resolveDir: new URL("../", import.meta.url).pathname,
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const {
  createRun, step, nextWaveNow, beginContinuation, tryAnchor,
  anchorCost, getBeamCoverage, LEVELS, DRONE_SPECS,
} = api;
assert.equal(typeof beginContinuation, "function", "continuation must use the real transition API");
assert.deepEqual(LEVELS.slice(0,4).map(level => level.waves.length), [5, 5, 5, 3]);
assert.deepEqual(LEVELS.map(level => level.continuation?.length ?? 0), [0, 3, 3, 0]);

const input = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });

function candidates(level, pathIndex) {
  const path = level.paths[pathIndex];
  const poses = [];
  for (let distance = 0; distance < path.length - 8; distance += 3) {
    for (const span of [12, 22, 35]) {
      const a = path.pointAt(distance), b = path.pointAt(Math.min(path.length, distance + span));
      const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      const f = { x: (b.x - a.x) / length, y: (b.y - a.y) / length, z: (b.z - a.z) / length };
      const center = { x: a.x - f.x * 4, y: a.y - f.y * 4, z: a.z - f.z * 4 };
      if (center.y < 1.6 || center.y > 44 || Math.hypot(center.x, center.z) > 52 || Math.abs(Math.asin(f.y)) > 1.05) continue;
      const beam = { ...center, dx: f.x, dy: f.y, dz: f.z, ...DRONE_SPECS.pierce };
      const coverage = getBeamCoverage({ paths: level.paths }, beam);
      const score = coverage.segments.filter(segment => segment.pathIndex === pathIndex).reduce((sum, segment) => sum + segment.metres, 0);
      poses.push({ ...center, f, score });
    }
  }
  return poses.sort((a, b) => b.score - a.score);
}

function trial(levelIndex, reinforce, options) {
  const storage = new Map();
  let scoreWrites = 0;
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); scoreWrites += 1; },
  };
  const run = createRun(levelIndex);
  const placements = [], waves = [];
  const order = run.level.id === "shear" ? [0, 2, 1, 2, 1, 0, 1, 2] : [0, 1, 0, 1, 0, 1, 0, 1];
  function buy() {
    if (run.drones.length >= 8 || run.scrap < anchorCost(run.drones.length)) return false;
    const path = order[run.drones.length];
    for (const pose of options[path]) {
      Object.assign(run.ship, {
        x: pose.x, y: pose.y, z: pose.z,
        yaw: Math.atan2(-pose.f.x, -pose.f.z), pitch: Math.asin(pose.f.y),
        vx: 0, vy: 0, vz: 0, yawRate: 0, pitchRate: 0,
      });
      run.aimx = pose.f.x; run.aimy = pose.f.y; run.aimz = pose.f.z;
      run.droneMode = "pierce";
      const error = tryAnchor(run);
      if (error === null) {
        placements.push({
          beforeWave: run.waveIndex + 2, path,
          position: [pose.x, pose.y, pose.z].map(value => +value.toFixed(2)),
          routeCoverage: +pose.score.toFixed(1), paid: run.drones.at(-1).paid,
        });
        return true;
      }
    }
    return false;
  }

  assert.ok(buy()); assert.ok(buy());
  let campaign;
  while (run.phase === "play") {
    if (run.rest > 0) {
      const targetDrones = run.waveIndex < 4 ? Math.min(5, run.waveIndex + 3)
        : reinforce ? Math.min(8, run.waveIndex + 2) : 5;
      while (run.drones.length < targetDrones && buy()) {}
      nextWaveNow(run);
    }
    let seconds = 0;
    while (run.phase === "play" && run.rest === 0 && seconds < 180) {
      step(run, input(), 1 / 60);
      run.fx.length = 0;
      seconds += 1 / 60;
    }
    assert.ok(seconds < 180, "each wave resolves without increasing the enemy pool or granting resources");
    assert.ok(run.scrap >= 0 && run.drones.length <= 8);
    waves.push({ wave: run.waveIndex + 1, core: run.core, kills: run.kills, scrap: run.scrap, drones: run.drones.length, seconds: +seconds.toFixed(1) });

    if (run.phase === "win" && run.waveIndex === 4) {
      campaign = { core: run.core, kills: run.kills, scrap: run.scrap, scoreWrites };
      const snapshot = {
        core: run.core, scrap: run.scrap, drones: JSON.stringify(run.drones),
        ship: JSON.stringify(run.ship), score: storage.get("helix-hold-v2"),
      };
      assert.equal(scoreWrites, 1, "five-wave clear is already recorded before accepting continuation");
      assert.equal(beginContinuation(run), true);
      assert.equal(run.waves.length, 8);
      assert.equal(run.waveMode, "manual");
      assert.equal(run.rest, 8);
      assert.equal(run.core, snapshot.core);
      assert.equal(run.scrap, snapshot.scrap);
      assert.equal(JSON.stringify(run.drones), snapshot.drones);
      assert.equal(JSON.stringify(run.ship), snapshot.ship);
      assert.equal(storage.get("helix-hold-v2"), snapshot.score);
      assert.equal(scoreWrites, 1);
      assert.equal(beginContinuation(run), false, "cannot append a second continuation");
      step(run, input(), 30);
      assert.equal(run.rest, 8, "the continuation waits indefinitely for manual launch");
      assert.equal(run.waveIndex, 4);
    }
  }
  assert.equal(scoreWrites, campaign ? 1 : 0, "extra waves do not overwrite the normal campaign score");
  return { arena: run.level.name, strategy: reinforce ? "add earned reinforcement up to eight" : "keep five-drone lattice", phase: run.phase, core: run.core, campaign, placements, waves };
}

const results = [];
for (const levelIndex of [1, 2]) {
  const level = LEVELS[levelIndex];
  const options = level.paths.map((_, pathIndex) => candidates(level, pathIndex));
  for (const reinforce of [false, true]) results.push(trial(levelIndex, reinforce, options));
}
console.log(JSON.stringify({
  limitation: "Idealized reachable setup placements, ordinary paid prices and earned scrap, idle hangar pilot. No reposition, fan or slide. Not human difficulty or visual QA.",
  results,
}, null, 2));
for (const level of LEVELS.filter(level => level.continuation)) {
  assert.ok(results.some(result => result.arena === level.name && result.phase === "win" && result.waves.length === 8), `${level.name} has a funded eight-wave completion`);
}
