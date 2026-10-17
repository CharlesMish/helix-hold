// Bounded source-simulation study. Idealized setup poses, real Crown paths,
// ordinary paid placement, no pilot attacks, and no browser/human balance claim.
import assert from "node:assert/strict";
import { api, options, setPose } from "./crown-trial.mjs";

const {
  LEVELS,
  CORE,
  createRun,
  step,
  nextWaveNow,
  tryAnchor,
  getAnchorCost,
  DRONE_SPECS,
  beamContact,
  insideSphere,
} = api;
const levelIndex = LEVELS.findIndex((l) => l.id === "split-crown");
const level = LEVELS[levelIndex],
  dt = 1 / 60;
const round = (n) => +n.toFixed(3);
const neutral = { thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const pose = (p) => ({ x: p.x, y: p.y, z: p.z, f: p.f ?? { x: 0, y: 0, z: -1 } });
const valid = (p) => p.y >= 1.6 && p.y <= 44 && Math.hypot(p.x, p.z) <= 52;
const samples = level.paths.map((path) => {
  const n = Math.ceil(path.length / 0.5);
  return Array.from({ length: n }, (_, i) => ({
    ...path.pointAt(((i + 0.5) * path.length) / n),
    metres: path.length / n,
  }));
});
const coverage = (p, radius) =>
  samples.map((points) => points.reduce((sum, q) => sum + (insideSphere(p, q, radius) ? q.metres : 0), 0));
const briefPose = (p) => ({ position: [p.x, p.y, p.z].map(round), aim: [p.f.x, p.f.y, p.f.z].map(round) });

// Use a finite search, not hand-picked winning positions. One west-district
// field site maximizes local A+B route metres while staying away from the core.
const westCandidates = samples
  .slice(0, 2)
  .flatMap((points) => points.filter((_, i) => i % 4 === 0))
  .filter((p) => p.x < -9 && p.y > 9 && valid(p))
  .map((p) => ({ ...pose(p), coverage: coverage(p, DRONE_SPECS.halo.radius) }));
westCandidates.sort((a, b) => b.coverage[0] + b.coverage[1] - (a.coverage[0] + a.coverage[1]));
const west = westCandidates[0];
assert.ok(west);

function nearField(center, radius, excluded = []) {
  const choices = [];
  for (const r of [0, 2.3, 3.3, 4.6])
    for (const y of [-1.5, 0, 1.5]) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
        const p = pose({
          x: center.x + Math.cos(angle) * r,
          y: center.y + y,
          z: center.z + Math.sin(angle) * r,
        });
        if (!valid(p) || excluded.some((q) => distance(p, q) < Math.sqrt(4.8) + 0.01)) continue;
        const metres = coverage(p, radius);
        // At the west site score A/B only. At the core score four ordinary routes.
        const lanes = center === west ? [0, 1] : [0, 1, 2, 3];
        const score = lanes.reduce((n, lane) => n + metres[lane], 0);
        choices.push({ ...p, metres, score });
      }
    }
  return choices.sort((a, b) => b.score - a.score)[0];
}

function lineCandidates(mode, lanes, area = null, excluded = []) {
  return options
    .filter(
      (p) =>
        (!area || distance(p, area) < 12) && excluded.every((q) => distance(p, q) >= Math.sqrt(4.8) + 0.01),
    )
    .map((p) => {
      const beam = { ...p, dx: p.f.x, dy: p.f.y, dz: p.f.z, ...DRONE_SPECS[mode] };
      const score = lanes.reduce(
        (n, lane) =>
          n +
          samples[lane].reduce(
            (s, q) => s + (beamContact(beam, { ...q, radius: 0.82 }) !== null ? q.metres : 0),
            0,
          ),
        0,
      );
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score);
}

function test(label, groups, fleet, budget) {
  const run = createRun(levelIndex, 17);
  // Explicit diagnostic allocations, not a claim the campaign earns this fleet.
  // Extra core keeps every scheduled target observable after multiple breaches.
  run.scrap = budget;
  run.core = 1000;
  run.waves = [{ chapter: "Role diagnostic", groups: groups.map((g) => ({ ...g, spawned: 0 })) }];
  const placements = [];
  for (const entry of fleet) {
    const cost = getAnchorCost(run, entry.mode);
    setPose(run, entry.p, entry.mode);
    assert.equal(tryAnchor(run), null, `${label}: legal paid placement for ${entry.mode}`);
    assert.equal(run.drones.at(-1).paid, cost);
    placements.push({ mode: entry.mode, paid: cost, ...briefPose(entry.p) });
  }
  const spent = budget - run.scrap;
  assert.ok(spent <= budget);
  setPose(run, { x: 49, y: 43, z: 0, f: { x: 1, y: 0, z: 0 } });
  nextWaveNow(run);
  let seconds = 0,
    pilotContactFrames = 0,
    pinShots = 0,
    pinSlowedEnemySeconds = 0;
  let haloEnemySeconds = 0,
    simultaneousHaloTargets = 0;
  const perLane = level.paths.map(() => ({ killed: 0, leaked: 0, appliedDamage: 0, slowSeconds: 0 }));
  // Observe pool entries synchronously: a kill and fresh spawn can reuse one
  // object in the same step, so before/after snapshots would misattribute it.
  for (const enemy of run.enemies) {
    let alive = enemy.alive,
      hp = enemy.hp;
    Object.defineProperty(enemy, "hp", {
      enumerable: true,
      configurable: true,
      get: () => hp,
      set(value) {
        if (alive && value < hp && value < enemy.maxHp)
          perLane[enemy.pathIndex].appliedDamage += hp - Math.max(0, value);
        hp = value;
      },
    });
    Object.defineProperty(enemy, "alive", {
      enumerable: true,
      configurable: true,
      get: () => alive,
      set(value) {
        if (alive && !value) perLane[enemy.pathIndex][hp <= 0 ? "killed" : "leaked"]++;
        alive = value;
      },
    });
  }
  while (run.phase === "play" && seconds < 180) {
    const cooldowns = run.drones.map((d) => d.shotCooldown);
    const halos = run.drones.filter((d) => d.mode === "halo");
    for (const e of run.enemies.filter((e) => e.alive)) {
      const fieldHits = halos.filter((d) => insideSphere(d, e, DRONE_SPECS.halo.radius)).length;
      if (fieldHits) haloEnemySeconds += dt;
      if (e.pinSlowRemaining > 0) pinSlowedEnemySeconds += dt;
      if (e.speedScale < 1) perLane[e.pathIndex].slowSeconds += dt;
    }
    for (const halo of halos)
      simultaneousHaloTargets = Math.max(
        simultaneousHaloTargets,
        run.enemies.filter((e) => e.alive && insideSphere(halo, e, DRONE_SPECS.halo.radius)).length,
      );
    step(run, neutral, dt);
    seconds += dt;
    run.fx.length = 0;
    if (run.shipHitting) pilotContactFrames++;
    run.drones.forEach((d, i) => {
      if (d.mode === "pin" && d.shotCooldown > cooldowns[i] + 1e-6) pinShots++;
    });
  }
  assert.ok(seconds < 180, "finite scheduled diagnostic resolves");
  assert.equal(pilotContactFrames, 0, "pilot supplies no damage");
  const totalTargets = groups.reduce((sum, g) => sum + g.count, 0);
  assert.equal(
    perLane.reduce((sum, lane) => sum + lane.killed + lane.leaked, 0),
    totalTargets,
    "all targets resolved and counted",
  );
  const effectiveDamage = run.drones.reduce((sum, d) => sum + d.damage, 0);
  assert.ok(
    Math.abs(effectiveDamage - perLane.reduce((sum, lane) => sum + lane.appliedDamage, 0)) < 1e-6,
    "independent HP accounting matches drone contribution",
  );
  return {
    label,
    budget,
    spent,
    unspentAtStart: budget - spent,
    placements,
    kills: run.kills,
    breaches: totalTargets - run.kills,
    coreDamage: 1000 - run.core,
    effectiveDamage: round(effectiveDamage),
    elapsedSeconds: round(seconds),
    pinShots,
    pinSlowedEnemySeconds: round(pinSlowedEnemySeconds),
    stasisEnemySeconds: round(run.stasisExposure),
    haloEnemySeconds: round(haloEnemySeconds),
    simultaneousHaloTargets,
    contributions: run.drones.map((d) => ({
      mode: d.mode,
      paid: d.paid,
      damage: round(d.damage),
      kills: d.kills,
    })),
    perLane: perLane.map((lane, i) => ({
      gate: String.fromCharCode(65 + i),
      ...lane,
      appliedDamage: round(lane.appliedDamage),
      slowSeconds: round(lane.slowSeconds),
    })),
    pilotContactFrames,
  };
}

const group = (kind, path, count, interval = 1.2, delay = 1, hpMul = 1) => ({
  kind,
  path,
  count,
  interval,
  delay,
  hpMul,
});
const localGroups = [group("shard", 0, 6, 0.9), group("barge", 1, 4, 1.4, 2)];
const pair = nearField(west, DRONE_SPECS.stasis.radius, [west]);
const nearbyBeam = lineCandidates("pierce", [0, 1], west, [west])[0];
assert.ok(pair && nearbyBeam);
const localFleet = [
  ["One Halo; saves scrap", [{ mode: "halo", p: west }]],
  [
    "Halo + Stasis",
    [
      { mode: "halo", p: west },
      { mode: "stasis", p: pair },
    ],
  ],
  [
    "Halo + Pierce",
    [
      { mode: "halo", p: west },
      { mode: "pierce", p: nearbyBeam },
    ],
  ],
  [
    "Two Pierce + Sweep",
    (() => {
      const fleet = [];
      for (const mode of ["pierce", "pierce", "sweep"])
        fleet.push({
          mode,
          p: lineCandidates(
            mode,
            [0, 1],
            west,
            fleet.map((d) => d.p),
          )[0],
        });
      return fleet;
    })(),
  ],
];
const fieldResults = localFleet.map(([label, fleet]) => test(label, localGroups, fleet, 76));

// Same physical aimed line for the three role-only observations. These single
// weapons have different prices; the 96-scrap fleets below are the budget test.
const aimed = lineCandidates("pin", [0])[0];
const aimedGroups = [
  ["isolated barge", [group("barge", 0, 1)]],
  ["isolated Wisp", [group("wisp", 0, 1)]],
  ["tight barge convoy", [group("barge", 0, 6, 0.7)]],
];
const aimedResults = aimedGroups.flatMap(([label, groups]) =>
  ["pierce", "sweep", "pin"].map((mode) => test(`${mode}: ${label}`, groups, [{ mode, p: aimed }], 96)),
);
const budgetFleets = [
  ["Three Pierce", ["pierce", "pierce", "pierce"]],
  ["Two Sweep + Pierce", ["sweep", "sweep", "pierce"]],
  ["Pin + Pierce + Sweep", ["pin", "pierce", "sweep"]],
];
const aimedBudgetResults = budgetFleets.flatMap(([label, modes]) => {
  const fleet = [];
  for (const mode of modes)
    fleet.push({
      mode,
      p: lineCandidates(
        mode,
        [0],
        null,
        fleet.map((d) => d.p),
      )[0],
    });
  return [test(`${label}: convoy budget`, aimedGroups[2][1], fleet, 96)];
});

// Deliberately test clustering around the shared destination, not just good
// district placement. Four actual side routes, finite mixed traffic, no carrier.
const coreCenter = { ...CORE, y: Math.max(1.6, CORE.y) };
const coreGroups = [0, 1, 2, 3].flatMap((lane) => [
  group("shard", lane, 3, 1.1),
  group("barge", lane, 2, 1.6, 4),
  group("wisp", lane, 2, 1.3, 7),
]);
const coreResults = [
  ["Three core Halo", ["halo", "halo", "halo"]],
  ["Two core Halo + Stasis + two Pierce", ["halo", "halo", "stasis", "pierce", "pierce"]],
  ["Four approach Pierce + Pin", ["pierce", "pierce", "pierce", "pierce", "pin"]],
].map(([label, modes]) => {
  const fleet = [];
  for (const mode of modes) {
    const p = ["halo", "stasis"].includes(mode)
      ? nearField(
          coreCenter,
          DRONE_SPECS[mode].radius,
          fleet.map((d) => d.p),
        )
      : lineCandidates(
          mode,
          [0, 1, 2, 3],
          coreCenter,
          fleet.map((d) => d.p),
        )[0];
    assert.ok(p, `${label}: valid distinct pose`);
    fleet.push({ mode, p });
  }
  return test(label, coreGroups, fleet, 200);
});

console.log(
  JSON.stringify(
    {
      question:
        "Do the two new roles produce distinct local-contact and aimed-support outcomes, and is core-only Halo clustering obviously dominant in a bounded Crown case?",
      method: {
        seed: 17,
        timestepSeconds: dt,
        paths: "Unchanged Split Crown world-space curves and actual drifting enemy centers",
        setup:
          "Finite idealized pose search; all purchases go through ordinary tryAnchor and current per-type prices, minimum separation and availability checks. No combat repositioning.",
        budgets:
          "Fixed diagnostic allocations of 76, 96 and 200 scrap, not earned campaign fleets; unused initial scrap is reported. Single-weapon rows establish behavior and are not equal-cost balance comparisons.",
        groups: {
          local: localGroups,
          aimed: aimedGroups.map(([label, groups]) => ({ label, groups })),
          core: coreGroups,
        },
        scoring:
          "Diagnostic core is 1000 to observe every target after breaches; report core damage, not a campaign win or survival claim. Drone damage credit independently checked against actual HP reductions.",
        contactMeasures:
          "Halo enemy-seconds count each living enemy once when inside any Halo, not once per overlapping Halo. Pin slow enemy-seconds count the active timer; stronger Stasis can take precedence. Neither measure is nominal route metres. The pilot remains outside all contacts.",
        limitations:
          "One seed, selected formations and finite pose search. No UI, browser rendering, human difficulty, performance, optimality, or general balance verdict. Long-run earned-scrap viability is a separate study. Nominal placement scores are approximations; all reported combat outcomes use actual step().",
        specs: DRONE_SPECS,
      },
      sites: {
        west: { ...briefPose(west), haloNominalMetresByGate: west.coverage.map(round) },
        stasisPartner: briefPose(pair),
        aimed: briefPose(aimed),
        coreCenter,
      },
      fieldResults,
      aimedResults,
      aimedBudgetResults,
      coreResults,
      conclusions: {
        halo: "At the selected west crossing, one Halo deals partial damage but kills none of the ten fresh targets. Buying Stasis beside it raises kills to six; Halo plus cheaper Pierce also kills six, and two Pierce plus Sweep clears all ten within the same 76-scrap allocation. This supports Halo as supplemental contact damage and demonstrates useful Stasis synergy without showing that the pair dominates good aimed lines.",
        pin: "On the same physical line, Pin and Sweep catch the isolated drifting Wisp that Pierce misses. Pin applies the most damage to the isolated barge and delays it 2.1 seconds, but does not kill it. Pierce deals far more total damage to the six-barge convoy. All three 96-scrap allocations clear that convoy, with the Pin mixture taking longest. Keep Pin explicitly single-target support; its 48-scrap entry price remains a playtest question.",
        core: "Three core-clustered Halo kill 7/28. A same-spend mixed Halo/Stasis/Pierce group kills 20/28; the 200-scrap aimed group kills 17/28. Core field synergy is useful in this finite formation, but pure Halo clustering is not dominant. No exclusion zone or general wave increase is justified by this evidence.",
        provisionalDecision:
          "Retain the proposed stats for the small Crown role experiment and check paid campaign viability separately. The playtest should ask whether the visible field/shot feedback makes these supplemental roles understandable, and whether buying one feels worthwhile beside a good Pierce or Sweep line. Do not infer human balance or optimal fleet composition from this search.",
      },
    },
    null,
    2,
  ),
);
