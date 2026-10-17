// Matched-pose weapon study. Synthetic single/group Wisp cases, not human win rates.
import { build } from "esbuild";
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
const { createRun, step, nextWaveNow, LEVELS } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
globalThis.localStorage = { getItem: () => null, setItem() {} };
const input = () => ({ thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 });
const variants = [
  ["Pierce", "pierce", 20],
  ["Sweep campaign", "sweep", 18],
  ["Sweep candidate", "sweep", 22],
];
const totals = variants.map(([name]) => ({ name, poses: 0, singleKills: 0, crowdKills: 0 }));
for (let levelIndex = 0; levelIndex < 3; levelIndex++) {
  const level = LEVELS[levelIndex];
  for (let pathIndex = 0; pathIndex < level.paths.length; pathIndex++) {
    const path = level.paths[pathIndex];
    for (const fraction of [0.15, 0.45, 0.75])
      for (const span of [8, 24])
        for (const offset of [0, 2.5]) {
          const a = path.pointAt(path.length * fraction),
            b = path.pointAt(Math.min(path.length, path.length * fraction + span));
          const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z),
            f = { x: (b.x - a.x) / len, y: (b.y - a.y) / len, z: (b.z - a.z) / len };
          const n = Math.hypot(f.x, f.z) || 1;
          const p = {
            x: a.x - f.x * 4 + (offset * f.z) / n,
            y: a.y - f.y * 4,
            z: a.z - f.z * 4 - (offset * f.x) / n,
          };
          for (let v = 0; v < variants.length; v++)
            for (const seed of [17, 31, 53, 97])
              for (const count of [1, 6]) {
                const [, mode, dps] = variants[v];
                const run = createRun(levelIndex, seed);
                Object.assign(run.ship, { x: 50, y: 44, z: 0, yaw: -Math.PI / 2, pitch: 0 }); // points out of arena; no pilot damage
                run.drones = [
                  {
                    id: 1,
                    mode,
                    dps,
                    paid: 20,
                    kills: 0,
                    damage: 0,
                    hit: false,
                    bx: p.x,
                    by: p.y,
                    bz: p.z,
                    fx: f.x,
                    fy: f.y,
                    fz: f.z,
                    x: p.x,
                    y: p.y,
                    z: p.z,
                    ax: f.x,
                    ay: f.y,
                    az: f.z,
                  },
                ];
                run.waves = [
                  { groups: [{ kind: "wisp", path: pathIndex, count, interval: 1.4, delay: 0, spawned: 0 }] },
                ];
                nextWaveNow(run);
                let frames = 0;
                while (run.phase === "play" && frames++ < 60 * 90) {
                  step(run, input(), 1 / 60);
                  run.fx.length = 0;
                }
                if (count === 1) {
                  totals[v].poses++;
                  totals[v].singleKills += run.kills;
                } else totals[v].crowdKills += run.kills;
              }
        }
  }
}
console.log(
  JSON.stringify(
    {
      method:
        "84 matched near-route poses × 4 seeds; 7 campaign routes; Wisp-only synthetic schedules; fixed drone; no pilot damage. Not authored-wave balance or player win rates.",
      results: totals.map((t) => ({
        weapon: t.name,
        runsPerCase: t.poses,
        isolatedKillPercent: +((100 * t.singleKills) / t.poses).toFixed(1),
        sixWispsMeanKills: +(t.crowdKills / t.poses).toFixed(2),
      })),
    },
    null,
    2,
  ),
);
