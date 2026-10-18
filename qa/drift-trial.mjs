// Funded feasibility probe for Drift Frontier. Idealized legal setup poses and an idle
// pilot; not a balance optimizer, a human playtest or a frame-rate measurement.
// Question: does re-flying lines after each swing matter, and is the arena finishable?
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
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
  LEVELS,
  DRIFT_INDEX,
  FRONTIER_INDEX,
  DRONE_SPECS,
  getBeamCoverage,
  getDroneCoverage,
  getAnchorCost,
  getLaneStatus,
  tryAnchor,
  beginReposition,
  nextWaveNow,
  fleetRouteContact,
  step,
} = api;
const dt = 1 / 60;
const neutral = { thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 };
const HP = { shard: 28, barge: 96, wisp: 40, carrier: 450 };

/** Same finite candidate family as the Frontier trial, rebuilt from the run's current routes. */
function candidatesFor(paths) {
  const out = [];
  const propose = (a, b) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (length < 1) return;
    const f = { x: (b.x - a.x) / length, y: (b.y - a.y) / length, z: (b.z - a.z) / length };
    const p = { x: a.x - f.x * 4, y: a.y - f.y * 4, z: a.z - f.z * 4, f };
    if (p.y < 1.6 || p.y > 44 || Math.hypot(p.x, p.z) > 52 || Math.abs(Math.asin(f.y)) > 1.05) return;
    const beam = {
      ...DRONE_SPECS.pierce,
      x: p.x + f.x * 0.7,
      y: p.y + f.y * 0.7,
      z: p.z + f.z * 0.7,
      dx: f.x,
      dy: f.y,
      dz: f.z,
    };
    const coverage = getBeamCoverage({ paths }, beam);
    p.metres = paths.map((_, lane) =>
      coverage.segments.filter((s) => s.pathIndex === lane).reduce((n, s) => n + s.metres, 0),
    );
    out.push(p);
  };
  for (const path of paths)
    for (let d = 0; d < path.length - 7; d += 5)
      for (const span of [10, 22, 38]) {
        const a = path.pointAt(d),
          b = path.pointAt(Math.min(path.length, d + span));
        propose(a, b);
        propose(b, a);
      }
  for (let a = 0; a < paths.length; a++)
    for (let b = a + 1; b < paths.length; b++)
      for (const ta of [0.15, 0.4, 0.65, 0.85])
        for (const tb of [0.15, 0.4, 0.65, 0.85]) {
          const p = paths[a].pointAt(paths[a].length * ta),
            q = paths[b].pointAt(paths[b].length * tb);
          propose(p, q);
          propose(q, p);
        }
  return out;
}
function setPose(run, p) {
  Object.assign(run.ship, {
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: Math.atan2(-p.f.x, -p.f.z),
    pitch: Math.asin(p.f.y),
    vx: 0,
    vy: 0,
    vz: 0,
  });
  Object.assign(run, { aimx: p.f.x, aimy: p.f.y, aimz: p.f.z });
}
const pressureOf = (run, wave) =>
  run.paths.map((_, lane) =>
    wave.groups.filter((g) => g.path === lane).reduce((n, g) => n + g.count * HP[g.kind] * (g.hpMul ?? 1), 0),
  );
function rank(candidates, current, pressure) {
  return candidates
    .map((p) => ({
      p,
      score: p.metres.reduce(
        (n, m, lane) => n + (m * Math.sqrt(pressure[lane])) / (1 + current[lane] / 15),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score);
}

function runTrial(levelIndex, policy, seed = 17) {
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  const run = createRun(levelIndex, seed);
  const waves = [];
  let purchases = 0,
    moves = 0,
    spent = 0;
  while (run.phase === "play") {
    assert.ok(run.rest > 0);
    const waveNumber = run.waveIndex + 2,
      wave = run.waves[run.waveIndex + 1];
    const pressure = pressureOf(run, wave);
    const drift = run.lastDrift;
    const candidates = candidatesFor(run.paths);
    let movedThisSetup = 0;
    if (policy === "re-fly") {
      // Re-fly every drone whose contact with this wave's traffic is nearly gone.
      for (const drone of [...run.drones]) {
        const useful = getDroneCoverage(run, drone)
          .segments.filter((s) => pressure[s.pathIndex] > 0)
          .reduce((n, s) => n + s.metres, 0);
        if (useful >= 4) continue;
        if (beginReposition(run, drone.id) !== null) continue;
        const others = fleetRouteContact({ ...run, drones: run.drones.filter((d) => d.id !== drone.id) });
        let placed = false;
        for (const { p } of rank(candidates, others, pressure)) {
          setPose(run, p);
          if (tryAnchor(run) === null) {
            placed = true;
            break;
          }
        }
        assert.ok(placed, "a legal reposition exists");
        movedThisSetup++;
      }
    }
    moves += movedThisSetup;
    // Both policies spend earned scrap the same way: greedy Pierce lines.
    run.droneMode = "pierce";
    while (run.scrap >= getAnchorCost(run, "pierce")) {
      const current = fleetRouteContact(run);
      let anchored = false;
      for (const { p } of rank(candidates, current, pressure)) {
        setPose(run, p);
        run.droneMode = "pierce";
        const cost = getAnchorCost(run, "pierce");
        if (tryAnchor(run) !== null) continue;
        purchases++;
        spent += cost;
        anchored = true;
        break;
      }
      if (!anchored) break;
    }
    const contactAtLaunch = fleetRouteContact(run);
    setPose(run, { x: 49, y: 43, z: 0, f: { x: 1, y: 0, z: 0 } });
    const core = run.core;
    nextWaveNow(run);
    let frames = 0;
    while (run.phase === "play" && run.rest === 0 && frames++ < 240 / dt) {
      step(run, neutral, dt);
      run.fx.length = 0;
    }
    assert.ok(frames < 240 / dt, "authored wave resolves");
    waves.push({
      wave: waveNumber,
      swings: drift?.map((d) => ({
        gate: String.fromCharCode(65 + d.path),
        degrees: d.degrees,
        contactBefore: d.before,
        contactAfterSwing: d.after,
      })),
      repositioned: movedThisSetup,
      drones: run.drones.length,
      contactAtLaunchByRoute: contactAtLaunch,
      coreLost: core - run.core,
      core: run.core,
    });
  }
  return {
    arena: LEVELS[levelIndex].id,
    policy,
    seed,
    outcome: run.phase,
    core: run.core,
    lastWave: waves.at(-1)?.wave,
    drones: run.drones.length,
    purchases,
    repositions: moves,
    spent,
    waves,
  };
}

const seeds = [17, 29, 41];
const results = [];
for (const seed of seeds) {
  results.push(runTrial(DRIFT_INDEX, "re-fly", seed));
  results.push(runTrial(DRIFT_INDEX, "never-move", seed));
}
results.push(runTrial(FRONTIER_INDEX, "never-move", 17));
const summary = results.map(
  (r) =>
    `${r.arena} ${r.policy} seed ${r.seed}: ${r.outcome} at wave ${r.lastWave}, core ${Math.round(r.core)}, ${r.drones} drones, ${r.repositions} repositions`,
);
console.log(summary.join("\n"));
const report = {
  question: "Does Drift Frontier reward re-flying lines after a swing, and can an earned fleet finish it?",
  method: {
    dt,
    seeds,
    setup:
      "Finite legal idealized Pierce poses rebuilt from the current (swung) routes each setup; ordinary purchases with earned scrap; greedy pressure-weighted contact. 're-fly' repositions (free) any drone with under 4 m of contact on this wave's routes; 'never-move' buys the same way but never repositions. Pilot idle and parked out of play.",
    limits:
      "Seeds change only Wisp phase. One purchase policy, Pierce only (no Tripwire, Stasis, Halo or Pin), no human aiming or active pilot fire (a real pilot adds a 34 DPS beam), no browser or frame-rate measurement. Feasibility and contrast, not human difficulty.",
  },
  summary,
  results,
};
if (process.argv.includes("--write"))
  await writeFile(
    new URL("../docs/DRIFT_TRIAL.json", import.meta.url),
    JSON.stringify(report, (_, v) => (typeof v === "number" ? +v.toFixed(3) : v), 2) + "\n",
  );
