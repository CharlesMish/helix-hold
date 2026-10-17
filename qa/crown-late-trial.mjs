// Paired late-Crown tune: actual paid fleets, frozen placements, ordinary
// bounded pilot pursuit. This is deterministic simulation, not a human playtest.
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
const baselineSource = "e5c14b44a47af099d0686d81526a47a7a84d90b3 (Sites v0.8.0); GitHub 57e8ef4";
// Explicit old groups keep this comparison reproducible after the selected
// candidate becomes production. No runtime checkout or old scratch dependency.
const group = (kind, path, count, interval, delay, hpMul = 1) => ({
  kind,
  path,
  count,
  interval,
  delay,
  speedMul: 1,
  hpMul,
});
const baselineGroups = [
  [
    group("barge", 0, 6, 2.1, 1, 1.25),
    group("barge", 2, 6, 2.1, 10, 1.25),
    group("wisp", 1, 4, 1.3, 5),
    group("wisp", 3, 4, 1.3, 18),
  ],
  [
    group("barge", 1, 5, 2, 1, 1.4),
    group("barge", 3, 5, 2, 4, 1.4),
    group("wisp", 0, 6, 1.25, 6),
    group("wisp", 2, 6, 1.25, 9),
    group("shard", 1, 6, 1.05, 18),
  ],
  [
    group("barge", 0, 5, 2, 1, 1.6),
    group("barge", 2, 5, 2, 10, 1.6),
    group("shard", 3, 8, 1, 4),
    group("wisp", 1, 8, 1.2, 17),
  ],
  [
    group("carrier", 4, 1, 1, 1.5, 6),
    group("barge", 1, 5, 2.1, 5, 1.6),
    group("barge", 3, 5, 2.1, 14, 1.6),
    group("wisp", 0, 6, 1.2, 8),
    group("wisp", 2, 6, 1.2, 22),
    group("shard", 0, 6, 1, 30),
  ],
];
const tunedGroups = baselineGroups.map((groups, i) =>
  groups.map((g) => ({
    ...g,
    hpMul:
      g.kind === "carrier"
        ? 6.6
        : g.kind === "barge"
          ? [1.4, 1.6, 1.9, 1.9][i]
          : g.kind === "wisp"
            ? 1.1
            : [1.1, 1.15, 1.2, 1.2][i],
  })),
);
const overlapGroups = structuredClone(tunedGroups);
for (const g of overlapGroups[3]) {
  if (g.kind === "barge" && g.path === 3) g.delay = 12;
  if (g.kind === "wisp" && g.path === 2) g.delay = 18;
  if (g.kind === "shard" && g.path === 0) g.delay = 24;
}
const variants = [
  { name: "v0.8.0 baseline", groups: baselineGroups },
  { name: "A: modest hull progression", groups: tunedGroups },
  { name: "B: same hull, earlier final escorts", groups: overlapGroups },
];
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
const roleOptions = Object.fromEntries(
  ["pin", "sweep"].map((mode) => [
    mode,
    options.map((p) => {
      const coverage = getBeamCoverage(
        { paths: level.paths },
        { ...p, dx: p.f.x, dy: p.f.y, dz: p.f.z, ...DRONE_SPECS[mode] },
      );
      return {
        ...p,
        metres: level.paths.map((_, lane) =>
          coverage.segments.filter((s) => s.pathIndex === lane).reduce((sum, s) => sum + s.metres, 0),
        ),
      };
    }),
  ]),
);

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
  if (["pierce", "pin", "sweep"].includes(mode))
    return (mode === "pierce" ? options : roleOptions[mode])
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

function nextMode(run, fleet) {
  const slot = run.drones.length + 1;
  if (fleet === "Pierce reference") return "pierce";
  if (fleet === "Mixed reference")
    return (
      { 9: "stasis", 10: "halo", 11: "pin", 12: "halo", 13: "stasis", 14: "halo", 15: "pin", 16: "halo" }[
        slot
      ] ?? "pierce"
    );
  // An explicit diversified buying policy, not the unknown human composition.
  // Retain the proven opening, then buy the cheapest currently owned type.
  // Stop at four Stasis because their slow does not stack.
  if (slot <= 8) return "pierce";
  return ["pierce", "sweep", "halo", "pin", "stasis"]
    .filter((mode) => mode !== "stasis" || run.drones.filter((d) => d.mode === mode).length < 4)
    .sort((a, b) => getAnchorCost(run, a) - getAnchorCost(run, b))[0];
}

// Observers intercept actual effective HP loss and terminal state before an
// enemy-pool entry can be reused. They do not alter values passed to simulation.
function observe(run) {
  const state = { wave: null, lastHit: null, hookedDrones: new Set() };
  for (const e of run.enemies) {
    let alive = e.alive,
      hp = e.hp,
      initializing = false,
      bornAt = 0,
      lastHitTime = -Infinity,
      record;
    Object.defineProperty(e, "hp", {
      enumerable: true,
      configurable: true,
      get: () => hp,
      set(value) {
        if (initializing) {
          initializing = false;
          bornAt = run.time;
          lastHitTime = -Infinity;
          record = {
            kind: e.kind,
            gate: String.fromCharCode(65 + e.pathIndex),
            hull: e.maxHp,
            spawnedAt: bornAt - state.wave.startedAt,
            damage: 0,
            droneDamage: 0,
            damageWhileCarrierAlive: 0,
            hitContactSeconds: 0,
            slowedSeconds: 0,
          };
          state.wave?.enemies.push(record);
          e.__trialRecord = record;
        } else if (alive && value < hp) {
          const damage = hp - Math.max(0, value);
          record.damage += damage;
          if (lastHitTime !== run.time) record.hitContactSeconds += dt;
          lastHitTime = run.time;
          if (
            record.kind !== "carrier" &&
            state.wave.enemies.some((other) => other.kind === "carrier" && !other.outcome)
          )
            record.damageWhileCarrierAlive += damage;
          state.wave.effectiveDamage += damage;
          state.lastHit = { record, damage };
        }
        hp = value;
      },
    });
    Object.defineProperty(e, "alive", {
      enumerable: true,
      configurable: true,
      get: () => alive,
      set(value) {
        if (!alive && value) initializing = true;
        if (alive && !value && record) {
          Object.assign(record, {
            outcome: hp <= 0 ? "destroyed" : "breached",
            resolvedAt: run.time - state.wave.startedAt,
            aliveSeconds: run.time - bornAt,
            routeFraction: Math.min(1, e.dist / run.paths[e.pathIndex].length),
            remainingHull: Math.max(0, hp),
          });
          state.wave[hp <= 0 ? "kills" : "breaches"]++;
        }
        alive = value;
      },
    });
  }
  state.hookNewDrones = () => {
    for (const d of run.drones) {
      if (state.hookedDrones.has(d.id)) continue;
      state.hookedDrones.add(d.id);
      let damage = d.damage;
      Object.defineProperty(d, "damage", {
        enumerable: true,
        configurable: true,
        get: () => damage,
        set(value) {
          if (value > damage && state.wave) {
            assert.ok(state.lastHit, "drone credit follows an effective HP reduction");
            assert.ok(Math.abs(value - damage - state.lastHit.damage) < 1e-6);
            state.lastHit.record.droneDamage += value - damage;
          }
          damage = value;
        },
      });
    }
  };
  return state;
}

function runTrial(fleet, variant, frozenPlan) {
  const run = createRun(index, 17),
    placements = [],
    waves = [];
  run.level = {
    ...level,
    continuation: variant.groups.map((groups, i) => ({ ...level.continuation[i], groups })),
  };
  const observer = observe(run);
  const saved = new Map();
  let scoreWrites = 0,
    campaignRecord;
  globalThis.localStorage = {
    getItem: (k) => saved.get(k) ?? null,
    setItem(k, v) {
      saved.set(k, v);
      scoreWrites++;
    },
  };
  while (run.phase === "play") {
    assert.ok(run.rest > 0);
    const waveNumber = run.waveIndex + 2;
    if (frozenPlan) {
      for (const entry of frozenPlan.filter((p) => p.beforeWave === waveNumber)) {
        setPose(run, entry.pose, entry.mode);
        assert.equal(getAnchorCost(run), entry.paid, "paired purchase uses identical actual price");
        assert.equal(tryAnchor(run), null, "paired fleet remains earned, affordable and legal");
        placements.push(entry);
      }
    } else {
      while (true) {
        const mode = nextMode(run, fleet);
        run.droneMode = mode;
        if (run.scrap < getAnchorCost(run)) break;
        let placed = false;
        for (const p of candidates(run, mode)) {
          setPose(run, p, mode);
          if (tryAnchor(run) !== null) continue;
          placements.push({
            beforeWave: waveNumber,
            slot: run.drones.length,
            mode,
            paid: run.drones.at(-1).paid,
            pose: { x: p.x, y: p.y, z: p.z, f: { ...p.f } },
          });
          placed = true;
          break;
        }
        if (!placed) break;
      }
    }
    observer.hookNewDrones();
    const carrierWave = run.waves[run.waveIndex + 1].groups.some((g) => g.kind === "carrier");
    if (carrierWave) {
      const start = { x: -44, y: 34, z: -25 },
        target = level.paths[4].pointAt(0),
        d = distance(start, target);
      setPose(run, {
        ...start,
        f: { x: (target.x - start.x) / d, y: (target.y - start.y) / d, z: (target.z - start.z) / d },
      });
    } else setPose(run, { x: 49, y: 43, z: 0, f: { x: 1, y: 0, z: 0 } });
    const initialCore = run.core,
      initialDamage = run.drones.reduce((n, d) => n + d.damage, 0);
    const initialExposure = run.stasisExposure;
    const wave = {
      wave: waveNumber,
      startedAt: run.time,
      drones: run.drones.length,
      enemies: [],
      kills: 0,
      breaches: 0,
      effectiveDamage: 0,
      hullSeconds: 0,
      enemySeconds: 0,
      escortSecondsDuringCarrier: 0,
      maxAlive: 0,
      maxLiveHull: 0,
      slowedEnemySeconds: 0,
      pilotAttackingSeconds: 0,
    };
    observer.wave = wave;
    nextWaveNow(run);
    let seconds = 0;
    while (run.phase === "play" && run.rest === 0 && seconds < 180) {
      const alive = run.enemies.filter((e) => e.alive);
      const carrierAlive = alive.some((e) => e.kind === "carrier");
      wave.enemySeconds += alive.length * dt;
      wave.hullSeconds += alive.reduce((n, e) => n + e.hp, 0) * dt;
      wave.maxAlive = Math.max(wave.maxAlive, alive.length);
      wave.maxLiveHull = Math.max(
        wave.maxLiveHull,
        alive.reduce((n, e) => n + e.hp, 0),
      );
      if (carrierAlive)
        wave.escortSecondsDuringCarrier += alive.filter((e) => e.kind !== "carrier").length * dt;
      for (const e of alive) {
        if (e.speedScale < 1) {
          wave.slowedEnemySeconds += dt;
          e.__trialRecord.slowedSeconds += dt;
        }
      }
      step(run, carrierWave ? pilotInput(run) : neutral(), dt);
      run.fx.length = 0;
      seconds += dt;
      if (run.shipHitting) wave.pilotAttackingSeconds += dt;
    }
    assert.ok(seconds < 180, "wave resolves");
    assert.equal(
      wave.kills + wave.breaches,
      run.waves[run.waveIndex].groups.reduce((n, g) => n + g.count, 0),
    );
    const droneDamage = run.drones.reduce((n, d) => n + d.damage, 0) - initialDamage;
    assert.ok(
      Math.abs(droneDamage - wave.enemies.reduce((n, e) => n + e.droneDamage, 0)) < 1e-6,
      "per-enemy attribution equals actual contribution",
    );
    Object.assign(wave, {
      core: run.core,
      coreLost: initialCore - run.core,
      scrap: run.scrap,
      seconds,
      droneDamage,
      pilotDamage: wave.effectiveDamage - droneDamage,
      stasisEnemySeconds: run.stasisExposure - initialExposure,
      damagedEnemyFrameSeconds: wave.enemies.reduce((n, e) => n + e.hitContactSeconds, 0),
      escortMeanRouteAtOutcome:
        wave.enemies.filter((e) => e.kind !== "carrier").reduce((n, e) => n + e.routeFraction, 0) /
        wave.enemies.filter((e) => e.kind !== "carrier").length,
    });
    const carrier = wave.enemies.find((e) => e.kind === "carrier");
    wave.carrier = carrier ? { ...carrier, pilotDamage: carrier.damage - carrier.droneDamage } : null;
    wave.escortGroups = run.waves[run.waveIndex].groups
      .filter((g) => g.kind !== "carrier")
      .map((g) => {
        const gate = String.fromCharCode(65 + g.path);
        const enemies = wave.enemies.filter((e) => e.kind === g.kind && e.gate === gate);
        return {
          kind: g.kind,
          gate,
          scheduledDelay: g.delay,
          count: g.count,
          firstResolvedAt: Math.min(...enemies.map((e) => e.resolvedAt)),
          lastResolvedAt: Math.max(...enemies.map((e) => e.resolvedAt)),
          spawnedWhileCarrierAlive: carrier
            ? enemies.filter((e) => e.spawnedAt >= carrier.spawnedAt && e.spawnedAt < carrier.resolvedAt)
                .length
            : 0,
          killedWhileCarrierAlive: carrier
            ? enemies.filter(
                (e) =>
                  e.outcome === "destroyed" &&
                  e.resolvedAt >= carrier.spawnedAt &&
                  e.resolvedAt < carrier.resolvedAt,
              ).length
            : 0,
          effectiveDamage: enemies.reduce((n, e) => n + e.damage, 0),
          damageWhileCarrierAlive: enemies.reduce((n, e) => n + e.damageWhileCarrierAlive, 0),
          slowedEnemySeconds: enemies.reduce((n, e) => n + e.slowedSeconds, 0),
          damagedEnemyFrameSeconds: enemies.reduce((n, e) => n + e.hitContactSeconds, 0),
          meanRouteAtOutcome: enemies.reduce((n, e) => n + e.routeFraction, 0) / enemies.length,
        };
      });
    waves.push(wave);
    if (run.phase === "win" && !run.continued) {
      assert.equal(scoreWrites, 1);
      campaignRecord = saved.get("helix-hold-v2");
      assert.equal(beginContinuation(run), true);
    }
  }
  assert.equal(scoreWrites, 1);
  assert.equal(saved.get("helix-hold-v2"), campaignRecord);
  if (frozenPlan)
    assert.deepEqual(placements, frozenPlan, "all paired placements, modes and purchase times are identical");
  return {
    fleet,
    variant: variant.name,
    phase: run.phase,
    core: run.core,
    scrap: run.scrap,
    composition: Object.fromEntries(
      Object.keys(DRONE_SPECS).map((mode) => [mode, run.drones.filter((d) => d.mode === mode).length]),
    ),
    totalPaid: run.drones.reduce((n, d) => n + d.paid, 0),
    placements,
    waves,
    contributions: run.drones.map((d) => ({ mode: d.mode, paid: d.paid, damage: d.damage, kills: d.kills })),
  };
}

const results = [];
for (const fleet of ["Pierce reference", "Mixed reference", "Diversified purchase policy"]) {
  const baseline = runTrial(fleet, variants[0]);
  results.push(baseline);
  const paired = variants.slice(1).map((variant) => runTrial(fleet, variant, baseline.placements));
  for (const candidate of paired)
    assert.deepEqual(
      candidate.waves.slice(0, 8),
      baseline.waves.slice(0, 8),
      "opening eight waves unchanged in paired replay",
    );
  assert.deepEqual(
    paired[0].waves.slice(0, 11),
    paired[1].waves.slice(0, 11),
    "A/B differ only in the final wave",
  );
  results.push(...paired);
}
// Retain per-group aggregates and the carrier record; individual escort
// trajectories are reproducible by the script and need not inflate the report.
const rounded = JSON.parse(
  JSON.stringify(results, (key, value) =>
    key === "enemies" ? undefined : typeof value === "number" ? round(value) : value,
  ),
);
console.log(
  JSON.stringify(
    {
      question:
        "Does a modest, continuation-only tune raise actual late-wave contact and overlap pressure for funded large fleets without changing the early game or forcing an optimizer loss?",
      baselineSource,
      method: {
        seed: 17,
        stepSeconds: dt,
        setup:
          "Idealized finite candidate poses. Every drone is bought through ordinary tryAnchor using earned scrap and per-type prices. No bonus resources, recalls, repositions or combat pose edits.",
        pairing:
          "Generate each baseline paid placement plan once, then freeze exact poses, types and purchase waves for both candidate replays. Assert identical prices, legal affordable purchases and unchanged recorded campaign score. No adaptive candidate fleet re-optimization.",
        pilot:
          "Idle in waves1–7 and9–11; ordinary bounded steering/pitch/thrust pursuit in8 and12 from one legal idealized staging position. Perfect state knowledge and immediate reactions; no human skill claim.",
        policies:
          "Pierce and mixed references retain the previous growth-trial policies. Diversified policy keeps eight opening Pierce, then buys the cheapest next type with a maximum four Stasis; this is an earned larger fleet example, not a reconstruction of the unknown human32-drone layout.",
        measures:
          "Actual HP reductions and terminal states are observed synchronously before pool reuse. Drone damage attribution is independently reconciled with contribution totals. Hull-seconds integrate remaining living HP over time. Route fractions and enemy-seconds include actual world-space slow behavior. Hit-contact seconds count frames with actual HP loss times dt, including terminal hits; they describe activity across all weapons, not continuous Pin projectiles or nominal route coverage.",
        pinBreakpoint:
          "Wisps remain at1.1 hull (47.52HP) in all continuation waves, below two24-damage Pin shots. Raising them to1.15 or1.2 would require three isolated Pin shots, a disproportionate50% shot-count increase; Shards retain the modest later progression.",
        limitations:
          "One seed and three deliberately strong finite-search policies. Not optimal play, win rates, browser rendering, larger-fleet performance, human difficulty or evidence that every fleet should leak. More hull may increase useful contact without adding breaches.",
      },
      variants,
      checks: {
        frozenPaidPlacements: true,
        campaignRecordUnchanged: true,
        damageAccountingReconciled: true,
        openingEightWavesIdentical: true,
        candidatesDifferOnlyOnFinalSchedule: true,
      },
      results: rounded,
    },
    null,
    2,
  ),
);
