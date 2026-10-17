// Deterministic active-pilot study. Setup poses are idealized; pursuit uses
// ordinary steering/thrust through step(). No browser or human playtest.
import assert from "node:assert/strict";
import { api, fullTrial, setPose } from "./crown-trial.mjs";

const { createRun, nextWaveNow, step, LEVELS, SHIP_DPS, SHIP_RADIUS, BEAM_RANGE, beamContact } = api;
const index = LEVELS.findIndex((l) => l.id === "split-crown");
const level = LEVELS[index],
  route = level.paths[4],
  dt = 1 / 60;
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
const angleError = (target, current) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
const copyRun = (run) => ({ ...JSON.parse(JSON.stringify(run)), level: run.level, paths: run.paths });

function prepare(strategy, field) {
  let snapshot;
  fullTrial(strategy, field, true, 6, 4, {
    // Match the earlier field study: use the same paid unit for the refit.
    ...(strategy === "dedicated" ? { refitId: 6 } : {}),
    beforeStep(run) {
      if (!snapshot && run.waveIndex === 7) snapshot = copyRun(run);
    },
  });
  assert.ok(snapshot, "funded fleet survives to wave 8");
  return snapshot;
}

function aimAt(run, target) {
  const dx = target.x - run.ship.x,
    dy = target.y - run.ship.y,
    dz = target.z - run.ship.z;
  const yaw = Math.atan2(-dx, -dz),
    pitch = Math.atan2(dy, Math.hypot(dx, dz));
  const yawError = angleError(yaw, run.ship.yaw),
    pitchError = pitch - run.ship.pitch;
  const distance = Math.hypot(dx, dy, dz);
  const speed = run.ship.vx * run.aimx + run.ship.vy * run.aimy + run.ship.vz * run.aimz;
  const aligned = Math.abs(yawError) < 0.35 && Math.abs(pitchError) < 0.35;
  const desiredSpeed = aligned ? clamp((distance - 18) * 1.4, -5, 15) : 0;
  return {
    ...neutral(),
    steer: clamp(yawError * 3, -1, 1),
    pitch: clamp(pitchError * 3, -1, 1),
    thrust: clamp(((desiredSpeed - speed) * 3 + speed * 1.12) / 36, -1, 1),
  };
}

function carrierTrial(snapshot, label, hullMultiplier, pilot) {
  const run = copyRun(snapshot);
  if (pilot === "pursuit") {
    const target = route.pointAt(0),
      start = { x: -44, y: 34, z: -25 };
    const distance = Math.hypot(target.x - start.x, target.y - start.y, target.z - start.z);
    setPose(run, {
      ...start,
      f: {
        x: (target.x - start.x) / distance,
        y: (target.y - start.y) / distance,
        z: (target.z - start.z) / distance,
      },
    });
  }
  const initialCore = run.core;
  let carrier, spawnedAt, resolvedAt, routeAtResolution, terminalHp;
  let damageFromPilot = 0,
    activeSeconds = 0,
    contactSeconds = 0;
  let expectedHull;
  let steps = 0;
  while (run.phase === "play" && run.rest === 0 && steps++ < 120 / dt) {
    const before =
      resolvedAt === undefined && carrier?.alive
        ? {
            hp: carrier.hp,
            dist: carrier.dist,
            speed: carrier.speed,
            scale: api.enemySpeedScale(run, carrier),
            radius: carrier.radius,
          }
        : null;
    const input = pilot === "pursuit" ? aimAt(run, before ? carrier : route.pointAt(0)) : neutral();
    step(run, input, dt);
    run.fx.length = 0;
    if (!carrier) {
      carrier = run.enemies.find((e) => e.alive && e.kind === "carrier");
      if (carrier) {
        // A study-only hull intervention immediately after spawn, before its
        // first movement or weapon frame; no authored source is changed.
        carrier.maxHp *= hullMultiplier;
        carrier.hp = carrier.maxHp;
        expectedHull = carrier.maxHp;
        spawnedAt = run.time;
      }
    }
    if (before) {
      activeSeconds += dt;
      // A dead slot can be reused by an escort in this same frame. Predict the
      // exact carrier center independently from its actual pre-movement state.
      const nextDistance = before.dist + before.speed * before.scale * dt;
      const target = { ...route.pointAt(Math.min(nextDistance, route.length)), radius: before.radius };
      if (carrier.kind === "carrier" && run.carrierOutcome !== "breached") {
        assert.ok(Math.hypot(target.x - carrier.x, target.y - carrier.y, target.z - carrier.z) < 1e-6);
      }
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
      // The pilot shoots first. At a breach, movement resolves before weapons.
      if (run.carrierOutcome !== "breached" && beamContact(beam, target) !== null) {
        damageFromPilot += Math.min(before.hp, SHIP_DPS * dt);
        contactSeconds += dt;
      }
      if (run.carrierOutcome !== "pending") {
        resolvedAt = run.time;
        routeAtResolution = Math.min(route.length, nextDistance);
        terminalHp = run.carrierOutcome === "destroyed" ? 0 : before.hp;
      }
    }
  }
  assert.ok(steps < 120 / dt, "wave resolves");
  assert.ok(resolvedAt !== undefined, "carrier resolves before terminal wave state");
  assert.ok(damageFromPilot <= expectedHull - Math.max(0, terminalHp) + 1e-5);
  if (pilot === "idle") assert.equal(damageFromPilot, 0);
  return {
    fleet: label,
    pilot,
    hullMultiplier,
    initialHull: expectedHull,
    initialCore,
    finalCore: run.core,
    phase: run.phase,
    carrierOutcome: run.carrierOutcome,
    carrierAliveSeconds: round(resolvedAt - spawnedAt),
    routeMetresAtOutcome: round(routeAtResolution),
    routeFractionAtOutcome: round(Math.min(1, routeAtResolution / route.length)),
    remainingHull: round(Math.max(0, terminalHp)),
    pilotCarrierDamage: round(damageFromPilot),
    droneCarrierDamage: round(expectedHull - Math.max(0, terminalHp) - damageFromPilot),
    pilotContactSeconds: round(contactSeconds),
    pilotContactFraction: round(contactSeconds / activeSeconds),
  };
}

const snapshots = [];
for (const strategy of ["dedicated", "cross-lane"])
  for (const field of [false, true]) {
    snapshots.push({
      label: `${strategy}, ${field ? "7 Pierce + Stasis" : "8 Pierce"}`,
      run: prepare(strategy, field),
    });
  }
const solo = createRun(index, 17);
solo.waveIndex = 6;
solo.waves[7].groups = solo.waves[7].groups.filter((g) => g.kind === "carrier");
nextWaveNow(solo);
setPose(solo, { x: 49, y: 43, z: 0, f: { x: 1, y: 0, z: 0 } });
snapshots.unshift({ label: "Solo pilot, no escorts or drones", run: solo });
const results = [];
for (const { label, run } of snapshots)
  for (const multiplier of [1, 3, 4]) {
    for (const pilot of label.startsWith("Solo") ? ["pursuit"] : ["idle", "pursuit"])
      results.push(carrierTrial(run, label, multiplier, pilot));
  }
console.log(
  JSON.stringify(
    {
      question:
        "Does active pursuit explain the short current carrier encounter, and how do 3x/4x Crown-specific hull candidates change contact requirements?",
      method: {
        seed: 17,
        timestepSeconds: dt,
        originalCarrierHull: 486,
        pilotDps: SHIP_DPS,
        carrierBaseSpeedMetresPerSecond: 4.2 * level.speedMul,
        carrierRouteMetres: round(route.length),
        controls:
          "One idealized legal pre-wave position (-44,34,-25), aimed at E. During combat a feedback controller uses ordinary bounded steering, pitch and thrust through step(), no boost or pose edits. Targets actual carrier center and tries to retain 18m separation. It reacts immediately and has perfect state knowledge; no human usability claim.",
        fleets:
          "Exact normally paid eight-drone fleets from crown-trial; dedicated pair uses the same refit unit6. Their wave1-7 pilot was idle. No more drones or bonus resources. Solo case isolates carrier by omitting all escorts and drones.",
        hull: "Study-only multiplier applied to carrier immediately after its spawn, before first weapon/movement frame. Ordinary escorts, speed, leak, rewards and geometry remain unchanged.",
        damage:
          "Pilot-first damage inferred from the exact post-movement beam-contact test; drone carrier damage is the remaining effective hull loss. Carrier survives or is observed through its terminal frame.",
        limitation:
          "Automated deterministic simulation at one seed, not browser QA, human difficulty, optimized play, or a recommendation to replace normal campaign balance. 3x/4x are candidates for a separately labeled stronger encounter.",
      },
      continuousPilotCeiling: [1, 3, 4].map((multiplier) => ({
        hullMultiplier: multiplier,
        hull: 486 * multiplier,
        secondsToKill: round((486 * multiplier) / SHIP_DPS),
        unSlowedRouteFractionToKill: round(
          (((486 * multiplier) / SHIP_DPS) * 4.2 * level.speedMul) / route.length,
        ),
      })),
      results,
    },
    null,
    2,
  ),
);
