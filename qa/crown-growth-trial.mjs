// Funded longer-flight feasibility. Idealized setup pose search; no browser or
// human playtest. Active carrier pursuit alone uses ordinary bounded inputs.
import assert from "node:assert/strict";
import { api, options, setPose } from "./crown-trial.mjs";

const {
  LEVELS,
  createRun,
  step,
  nextWaveNow,
  tryAnchor,
  getAnchorCost,
  beginContinuation,
  getFieldCoverage,
  getBeamCoverage,
  DRONE_SPECS,
  beamContact,
  SHIP_DPS,
  SHIP_RADIUS,
  BEAM_RANGE,
} = api;
const index = LEVELS.findIndex((l) => l.id === "split-crown"),
  level = LEVELS[index],
  dt = 1 / 60;
assert.equal(level.continuation?.length, 4, "requires authored optional Crown extension");
// Optional study-only override is applied after placements, keeping the
// candidate fleet identical when comparing finale hulls. Omit for real data.
const hullOverride =
  Number(process.argv.find((arg) => arg.startsWith("--final-hull="))?.split("=")[1]) || null;
const roleStudy = process.argv.includes("--roles");
const round = (n) => +n.toFixed(3);
const neutral = () => ({
  thrust: 0,
  steer: 0,
  pitch: 0,
  boost: false,
  anchor: false,
  expand: false,
  shift: 0,
});
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const angleError = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const samples = level.paths.map((path) => {
  const count = Math.ceil(path.length / 1.25);
  return Array.from({ length: count }, (_, i) => path.pointAt(((i + 0.5) * path.length) / count));
});
const beamFor = (d) => ({ x: d.x, y: d.y, z: d.z, dx: d.ax, dy: d.ay, dz: d.az, ...DRONE_SPECS[d.mode] });
const pinOptions = roleStudy
  ? options.map((p) => {
      const coverage = getBeamCoverage(
        { paths: level.paths },
        { ...p, dx: p.f.x, dy: p.f.y, dz: p.f.z, ...DRONE_SPECS.pin },
      );
      return {
        ...p,
        metres: level.paths.map((_, lane) =>
          coverage.segments.filter((s) => s.pathIndex === lane).reduce((sum, s) => sum + s.metres, 0),
        ),
      };
    })
  : [];

function candidates(run, mode) {
  const next = run.waves[run.waveIndex + 1];
  const beams = run.drones.filter((d) => ["pierce", "sweep", "pin"].includes(d.mode)).map(beamFor);
  const coverage = level.paths.map((_, i) =>
    beams.reduce(
      (n, beam) =>
        n +
        (samples[i].filter((p) => beamContact(beam, { ...p, radius: 0.82 }) !== null).length *
          level.paths[i].length) /
          samples[i].length,
      0,
    ),
  );
  const pressure = level.paths.map((_, i) =>
    next.groups
      .filter((g) => g.path === i)
      .reduce(
        (n, g) => n + g.count * { shard: 28, wisp: 40, barge: 96, carrier: 450 }[g.kind] * (g.hpMul ?? 1),
        0,
      ),
  );
  const weights = pressure.map((p) => Math.sqrt(p));
  if (mode === "pierce" || mode === "pin")
    return (mode === "pin" ? pinOptions : options)
      .map((p) => ({
        p,
        score: p.metres.reduce(
          (n, metres, i) => n + (metres * (weights[i] || 1)) / (1 + coverage[i] / 18),
          0,
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .map((e) => e.p);
  if (mode === "halo") {
    const halos = run.drones.filter((d) => d.mode === "halo");
    return samples
      .flatMap((points) => points.filter((_, i) => i % 3 === 0))
      .filter((p) => halos.every((halo) => distance(p, halo) >= 6))
      .map((p) => {
        const segments = getFieldCoverage(run, p, DRONE_SPECS.halo.radius).segments;
        const metres = level.paths.map((_, i) =>
          segments.filter((s) => s.pathIndex === i).reduce((n, s) => n + s.metres, 0),
        );
        return {
          ...p,
          f: { x: 0, y: 0, z: -1 },
          metres,
          score: metres.reduce((n, m, i) => n + (m * (weights[i] || 1)) / (1 + coverage[i] / 18), 0),
        };
      })
      .sort((a, b) => b.score - a.score);
  }
  const fields = run.drones.filter((d) => d.mode === "stasis");
  return samples
    .flatMap((points) => points.filter((_, i) => i % 3 === 0))
    .filter((p) => fields.every((field) => distance(p, field) >= 10))
    .map((p) => {
      const segments = getFieldCoverage(run, p).segments;
      return {
        ...p,
        f: { x: 0, y: 0, z: -1 },
        metres: level.paths.map((_, i) =>
          segments.filter((s) => s.pathIndex === i).reduce((n, s) => n + s.metres, 0),
        ),
        score: samples.reduce(
          (sum, points, lane) =>
            sum +
            ((points
              .filter((q) => distance(p, q) <= 6)
              .reduce(
                (n, q) =>
                  n + beams.filter((beam) => beamContact(beam, { ...q, radius: 0.82 }) !== null).length,
                0,
              ) *
              level.paths[lane].length) /
              points.length) *
              (weights[lane] || 1),
          0,
        ),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function pilotInput(run) {
  const target = run.enemies.find((e) => e.alive && e.kind === "carrier") ?? run.paths[4].pointAt(0);
  const dx = target.x - run.ship.x,
    dy = target.y - run.ship.y,
    dz = target.z - run.ship.z;
  const yaw = Math.atan2(-dx, -dz),
    pitch = Math.atan2(dy, Math.hypot(dx, dz));
  const ye = angleError(yaw, run.ship.yaw),
    pe = pitch - run.ship.pitch;
  const speed = run.ship.vx * run.aimx + run.ship.vy * run.aimy + run.ship.vz * run.aimz;
  const desired =
    Math.abs(ye) < 0.35 && Math.abs(pe) < 0.35 ? clamp((Math.hypot(dx, dy, dz) - 18) * 1.4, -5, 15) : 0;
  return {
    ...neutral(),
    steer: clamp(ye * 3, -1, 1),
    pitch: clamp(pe * 3, -1, 1),
    thrust: clamp(((desired - speed) * 3 + speed * 1.12) / 36, -1, 1),
  };
}

function trial(activePilot, twoFields, mixedRoles = false) {
  const run = createRun(index, 17),
    placements = [],
    waves = [];
  let campaign,
    scoreWrites = 0,
    campaignRecord;
  const saved = new Map();
  globalThis.localStorage = {
    getItem: (k) => saved.get(k) ?? null,
    setItem(k, v) {
      saved.set(k, v);
      scoreWrites++;
    },
  };
  while (run.phase === "play") {
    if (run.rest > 0) {
      while (true) {
        const slot = run.drones.length + 1;
        const mode = mixedRoles
          ? ({
              9: "stasis",
              10: "halo",
              11: "pin",
              12: "halo",
              13: "stasis",
              14: "halo",
              15: "pin",
              16: "halo",
            }[slot] ?? "pierce")
          : twoFields && [9, 12].includes(slot)
            ? "stasis"
            : "pierce";
        run.droneMode = mode;
        if (run.scrap < getAnchorCost(run)) break;
        let placed = false;
        for (const p of candidates(run, mode)) {
          setPose(run, p, mode);
          if (tryAnchor(run) !== null) continue;
          placements.push({
            beforeWave: run.waveIndex + 2,
            slot,
            mode,
            paid: run.drones.at(-1).paid,
            position: [p.x, p.y, p.z].map(round),
            coverageMetres: p.metres.map(round),
          });
          placed = true;
          break;
        }
        if (!placed) break;
      }
      const nextCarrier = run.waves[run.waveIndex + 1].groups.some((g) => g.kind === "carrier");
      if (hullOverride && run.waveIndex + 1 === 11) {
        for (const g of run.waves[11].groups) if (g.kind === "carrier") g.hpMul = hullOverride;
      }
      if (activePilot && nextCarrier) {
        const start = { x: -44, y: 34, z: -25 },
          target = level.paths[4].pointAt(0),
          d = distance(start, target);
        setPose(run, {
          ...start,
          f: { x: (target.x - start.x) / d, y: (target.y - start.y) / d, z: (target.z - start.z) / d },
        });
      } else setPose(run, { x: 49, y: 43, z: 0, f: { x: 1, y: 0, z: 0 } });
      nextWaveNow(run);
    }
    const initialCore = run.core,
      initialKills = run.kills;
    const carrierWave = run.waves[run.waveIndex].groups.some((g) => g.kind === "carrier");
    let seconds = 0,
      maxAlive = 0,
      carrier,
      carrierStart,
      carrierOutcome;
    let pilotCarrierDamage = 0,
      pilotContactSeconds = 0;
    while (run.phase === "play" && run.rest === 0 && seconds < 180) {
      const before =
        carrier && !carrierOutcome
          ? {
              dist: carrier.dist,
              hp: carrier.hp,
              speed: carrier.speed,
              radius: carrier.radius,
              scale: api.enemySpeedScale(run, carrier),
            }
          : null;
      step(run, activePilot && carrierWave ? pilotInput(run) : neutral(), dt);
      run.fx.length = 0;
      seconds += dt;
      maxAlive = Math.max(maxAlive, run.enemies.filter((e) => e.alive).length);
      if (!carrier) {
        carrier = run.enemies.find((e) => e.alive && e.kind === "carrier");
        if (carrier) carrierStart = { time: run.time, hull: carrier.maxHp };
      }
      if (before && run.carrierOutcome !== "breached") {
        const target = {
          ...run.paths[4].pointAt(before.dist + before.speed * before.scale * dt),
          radius: before.radius,
        };
        const beam = {
          x: run.ship.x + run.aimx * 1.15,
          y: run.ship.y + run.aimy * 1.15,
          z: run.ship.z + run.aimz * 1.15,
          dx: run.aimx,
          dy: run.aimy,
          dz: run.aimz,
          range: BEAM_RANGE,
          radius: SHIP_RADIUS,
        };
        if (beamContact(beam, target) !== null) {
          // Pilot is the first shooter, so this is its effective carrier damage.
          pilotCarrierDamage += Math.min(before.hp, SHIP_DPS * dt);
          pilotContactSeconds += dt;
        }
      }
      if (before && run.carrierOutcome !== "pending") {
        const remainingHull = run.carrierOutcome === "destroyed" ? 0 : before.hp;
        assert.ok(pilotCarrierDamage <= carrierStart.hull - remainingHull + 1e-6);
        if (!activePilot) assert.equal(pilotCarrierDamage, 0);
        carrierOutcome = {
          outcome: run.carrierOutcome,
          hull: carrierStart.hull,
          aliveSeconds: round(run.time - carrierStart.time),
          routeFractionAtOutcome: round(
            Math.min(1, (before.dist + before.speed * before.scale * dt) / run.paths[4].length),
          ),
          remainingHull: round(remainingHull),
          pilotCarrierDamage: round(pilotCarrierDamage),
          droneCarrierDamage: round(carrierStart.hull - remainingHull - pilotCarrierDamage),
          pilotContactSeconds: round(pilotContactSeconds),
          pilotContactFraction: round(pilotContactSeconds / (run.time - carrierStart.time)),
        };
      }
    }
    assert.ok(seconds < 180, "wave resolves");
    assert.ok(run.scrap >= 0);
    waves.push({
      wave: run.waveIndex + 1,
      core: run.core,
      coreLost: initialCore - run.core,
      kills: run.kills - initialKills,
      scrap: run.scrap,
      drones: run.drones.length,
      fields: run.drones.filter((d) => d.mode === "stasis").length,
      maxAlive,
      seconds: round(seconds),
      carrier: carrierOutcome ?? null,
    });
    if (run.phase === "win" && !run.continued) {
      assert.equal(scoreWrites, 1, "campaign score saved before continuation");
      campaignRecord = saved.get("helix-hold-v2");
      campaign = { core: run.core, scrap: run.scrap, drones: run.drones.length };
      assert.equal(beginContinuation(run), true);
      assert.equal(run.waves.length, 12);
    }
  }
  assert.equal(scoreWrites, campaign ? 1 : 0, "extension leaves original score intact");
  if (campaign) assert.equal(saved.get("helix-hold-v2"), campaignRecord);
  return {
    activePilot,
    twoFields,
    mixedRoles,
    phase: run.phase,
    core: run.core,
    scrap: run.scrap,
    contributions: run.drones.map((d) => ({
      id: d.id,
      mode: d.mode,
      paid: d.paid,
      kills: d.kills,
      damage: round(d.damage),
    })),
    totalPaid: run.drones.reduce((n, d) => n + d.paid, 0),
    campaign,
    waves,
    placements,
  };
}

const results = [trial(false, false), trial(true, false), trial(true, true)];
if (roleStudy) results.push(trial(true, true, true));
console.log(
  JSON.stringify(
    {
      studyOnlyFinalCarrierHullMultiplier: hullOverride,
      method:
        "Seed17, 60Hz deterministic simulation using current Crown per-type prices. Greedy route-contact pose search through ordinary paid placement, every affordable purchase at setup, no bonus scrap or recalls. Active pilot uses bounded steering/thrust pursuit only on carrier waves, from one idealized legal E staging pose; idle otherwise. Two-field comparator buys fields in slots9/12 and selects nonoverlapping centers for damage overlap. Optional --roles comparator adds four Halo, two Pin and two Stasis after its initial eight Pierce, then resumes Pierce purchases. Halo centers maximize 5m sphere route coverage; Pin lines use its own finite-cylinder coverage as a placement proxy, not a prediction of nearest-target shot damage. Setup placements are instantaneous idealized poses. Not human difficulty, browser QA or optimal play.",
      checks: {
        campaignRecordedBeforeExtension: true,
        continuationDoesNotOverwriteScore: true,
        nonnegativeScrap: true,
      },
      results,
    },
    null,
    2,
  ),
);
assert.ok(
  results.some((r) => r.phase === "win" && r.waves.length === 12),
  "at least one funded twelve-wave completion",
);
