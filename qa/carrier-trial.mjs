// Idealized, funded feasibility trial. Placements teleport during setup to reachable poses.
// This measures combat/budget feasibility, not human piloting difficulty or visual usability.
import { build } from "esbuild";
import assert from "node:assert/strict";
const bundle = await build({
  stdin: {
    contents:
      'export * from "./src/game/sim"; export * from "./src/game/paths"; export * from "./src/game/combat";',
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
  step,
  nextWaveNow,
  tryAnchor,
  anchorCost,
  getBeamCoverage,
  LEVELS,
  CARRIER_TEST_INDEX,
  DRONE_SPECS,
} = api;
globalThis.localStorage = { getItem: () => null, setItem() {} };
const input = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const level = LEVELS[CARRIER_TEST_INDEX];
function candidates(pathIndex) {
  const path = level.paths[pathIndex],
    out = [];
  for (let dist = 0; dist < path.length - 8; dist += 3) {
    for (const span of [12, 22, 35]) {
      const a = path.pointAt(dist),
        b = path.pointAt(Math.min(path.length, dist + span));
      const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z),
        f = { x: (b.x - a.x) / len, y: (b.y - a.y) / len, z: (b.z - a.z) / len };
      const center = { x: a.x - f.x * 4, y: a.y - f.y * 4, z: a.z - f.z * 4 };
      const pitch = Math.asin(f.y);
      if (center.y < 1.6 || center.y > 44 || Math.hypot(center.x, center.z) > 52 || Math.abs(pitch) > 1.05)
        continue;
      const beam = { ...center, dx: f.x, dy: f.y, dz: f.z, ...DRONE_SPECS.pierce };
      const coverage = getBeamCoverage({ paths: level.paths }, beam);
      out.push({
        ...center,
        f,
        score: coverage.segments.filter((s) => s.pathIndex === pathIndex).reduce((n, s) => n + s.metres, 0),
      });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
const options = [0, 1, 2].map(candidates);
function position(run, p, mode) {
  Object.assign(run.ship, {
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: Math.atan2(-p.f.x, -p.f.z),
    pitch: Math.asin(p.f.y),
    vx: 0,
    vy: 0,
    vz: 0,
    yawRate: 0,
    pitchRate: 0,
  });
  run.aimx = p.f.x;
  run.aimy = p.f.y;
  run.aimz = p.f.z;
  run.droneMode = mode;
  return tryAnchor(run);
}
function runTrial(useField) {
  const run = createRun(CARRIER_TEST_INDEX),
    placements = [];
  function buy(path) {
    if (run.scrap < anchorCost(run.drones.length)) return false;
    for (const p of options[path])
      if (!position(run, p, "pierce")) {
        placements.push({
          wave: run.waveIndex + 2,
          type: "pierce",
          path,
          coverage: +p.score.toFixed(1),
          position: [p.x, p.y, p.z].map((n) => +n.toFixed(2)),
        });
        return true;
      }
    return false;
  }
  buy(0);
  buy(2);
  const waveRecords = [];
  while (run.phase === "play" && run.waveIndex < 3) {
    if (run.rest > 0) {
      if (run.waveIndex === 0) {
        if (useField) {
          const err = position(run, { x: 11.3, y: 22.6, z: 6.4, f: { x: 0, y: 0, z: -1 } }, "stasis");
          assert.equal(err, null);
          placements.push({ wave: 2, type: "stasis", position: [11.3, 22.6, 6.4] });
        } else buy(1);
      }
      if (run.waveIndex === 1) {
        buy(2);
        buy(1);
      }
      nextWaveNow(run);
    }
    let seconds = 0;
    while (run.phase === "play" && run.rest === 0 && seconds < 180) {
      step(run, input(), 1 / 60);
      run.fx.length = 0;
      seconds += 1 / 60;
    }
    assert.ok(seconds < 180, "wave resolves");
    waveRecords.push({
      wave: run.waveIndex + 1,
      core: run.core,
      kills: run.kills,
      scrap: run.scrap,
      carrier: run.carrierOutcome,
      seconds: +seconds.toFixed(1),
    });
  }
  return {
    strategy: useField
      ? "two lines + Stasis + earned reinforcement"
      : "damage-only matched purchase schedule",
    phase: run.phase,
    core: run.core,
    kills: run.kills,
    carrier: run.carrierOutcome,
    drones: run.drones.length,
    placements,
    waves: waveRecords,
  };
}
const results = [runTrial(false), runTrial(true)];
console.log(
  JSON.stringify(
    {
      limitation:
        "Idealized reachable placements; real paid prices/rewards; idle hangar pilot; not a human playtest.",
      results,
    },
    null,
    2,
  ),
);
assert.ok(
  results.some((r) => r.phase === "win" && r.carrier === "destroyed"),
  "at least one funded arrangement intercepts the carrier and holds the core",
);
