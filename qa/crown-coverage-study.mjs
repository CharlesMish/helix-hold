// Bounded HUD-readout comparison; no browser or claim about player decisions.
// Exact candidate poses are shared with the committed Crown feasibility study.
import assert from "node:assert/strict";
import { api, options, setPose } from "./crown-trial.mjs";
const { createRun, LEVELS, getPlacementPreview } = api;
const index = LEVELS.findIndex((l) => l.id === "split-crown");
const run = createRun(index, 17);
const round = (n) => +n.toFixed(3);
const sum = (values) => values.reduce((n, v) => n + v, 0);
const measure = (p, candidate) => {
  setPose(run, p);
  const preview = getPlacementPreview(run);
  const byLane = run.paths.map((_, lane) =>
    sum(preview.segments.filter((s) => s.pathIndex === lane).map((s) => s.metres)),
  );
  assert.ok(Math.abs(preview.nowMetres - byLane[0]) < 1e-8, "wave 1 ranks only Gate A");
  assert.ok(
    Math.abs(preview.nowMetres + preview.laterMetres + preview.idleMetres - preview.metres) < 1e-8,
    "readout partitions total hover",
  );
  return {
    candidate,
    pose: { x: p.x, y: p.y, z: p.z, f: p.f },
    eligible: preview.status === null,
    total: preview.metres,
    now: preview.nowMetres,
    later: preview.laterMetres,
    idle: preview.idleMetres,
    byLane,
  };
};
const rows = options.map(measure);
const eligible = rows.filter((r) => r.eligible);
const rank = (rows, key) => [...rows].sort((a, b) => b[key] - a[key] || a.candidate - b.candidate);
const compact = (row) => ({
  candidate: row.candidate,
  position: [row.pose.x, row.pose.y, row.pose.z].map(round),
  aim: [row.pose.f.x, row.pose.f.y, row.pose.f.z].map(round),
  totalMetres: round(row.total),
  nowMetres: round(row.now),
  laterMetres: round(row.later),
  idleMetres: round(row.idle),
  metresByGate: row.byLane.map(round),
});
const oldTop = rank(eligible, "total")[0],
  newTop = rank(eligible, "now")[0];
assert.ok(
  newTop.now > oldTop.now,
  "now-first ranking finds more actual opening coverage in the same finite candidates",
);
const allFuture = eligible.filter((r) => r.now < 1e-8);
assert.ok(allFuture.length > 0);
const strongestFuture = rank(allFuture, "total")[0];
const rankSummary = (key, n) => {
  const top = rank(eligible, key).slice(0, n);
  return {
    candidates: top.length,
    meanGateAMetres: round(sum(top.map((r) => r.now)) / top.length),
    zeroGateACandidates: top.filter((r) => r.now < 1e-8).length,
  };
};
// The original trial scores candidate beams from their base, before the actual
// drone muzzle advances 0.7m. Retain this separate comparator to reproduce the
// review's values without presenting them as exact HUD readings.
const legacy = options.map((p, candidate) => ({
  candidate,
  total: sum(p.metres),
  now: p.metres[0],
  byLane: p.metres,
}));
const legacyCompact = (row) => ({
  candidate: row.candidate,
  totalMetres: round(row.total),
  gateAMetres: round(row.now),
  metresByGate: row.byLane.map(round),
});
console.log(
  JSON.stringify(
    {
      method:
        "Identical finite candidate poses from crown-trial; opening setup with ordinary 60 scrap, no fleet or Fan/Slide. Actual preview uses the droneBeam 0.7m muzzle offset. No enemies or human choices simulated.",
      limitation:
        "Candidate rankings demonstrate what each number rewards, not difficulty, damage, first-two-anchor performance, or observed player preference. Idealized poses are not a claim that players will find them.",
      semantics: {
        now: "Current upcoming/pending/occupied gates, consistent with the gate HUD.",
        later: "Coverage on a noncurrent route with authored traffic in a later wave.",
        idle: "Coverage without current or remaining authored traffic. All geometric hover segments are retained.",
      },
      candidateCount: options.length,
      eligibleCandidateCount: eligible.length,
      rejectedCandidateCount: rows.length - eligible.length,
      actualPreview: {
        totalRankWinner: compact(oldTop),
        nowRankWinner: compact(newTop),
        strongestZeroNowLine: compact(strongestFuture),
        gateAGainMetres: round(newTop.now - oldTop.now),
        gateAGainRatio: round(newTop.now / oldTop.now),
        topTen: { totalRanking: rankSummary("total", 10), nowRanking: rankSummary("now", 10) },
      },
      legacyTrialCandidateGeometry: {
        explanation: "Base-origin approximation used by existing trial; distinct from actual HUD muzzle.",
        totalRankWinner: legacyCompact(rank(legacy, "total")[0]),
        gateARankWinner: legacyCompact(rank(legacy, "now")[0]),
        strongestZeroGateALine: legacyCompact(
          rank(
            legacy.filter((r) => r.now < 1e-8),
            "total",
          )[0],
        ),
      },
    },
    null,
    2,
  ),
);
