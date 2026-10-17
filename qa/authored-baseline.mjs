// Exact authored settings; tolerant, independently retained computed geometry.
// Do not replace the historical fixture with current output when this fails.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const GEOMETRY_TOLERANCE = 1e-6; // metres, absolute (one micrometre)
const AIM_TOLERANCE = 1e-12; // radians; lookingAt uses atan2/hypot
export const historical = JSON.parse(
  readFileSync(new URL("./fixtures/pre-crown-v051.json", import.meta.url), "utf8"),
);
const originalHashes = {
  tutorial: "cf1c02d50eac48aa2797ab9c33971524d8f6bf10a40b7644ade7a69de8a283e5",
  shear: "d4a790629082c4013911fb6942b7d2b4cc20cff982d7289728637bae1d1ba90a",
  orbital: "c4a0609eb7641d6c957cbba7aaa1f3651df461352f1732158a69d9ca31dffae1",
  "carrier-test": "1834042c317a40f3dc2430b384f3bc682b8a8597f08eadf086adca737f31ca8a",
};

// These are the original pre-Crown hashes, now used only on retained data.
// JSON parse/stringify does not recalculate any floating-point geometry.
assert.equal(historical.sourceCommit, "aebe847e4388e2135f1b9039369c82d64787bfea");
assert.deepEqual(
  historical.levels.map((l) => l.id),
  Object.keys(originalHashes),
);
for (const level of historical.levels) {
  assert.equal(
    createHash("sha256").update(JSON.stringify(level)).digest("hex"),
    originalHashes[level.id],
    `${level.id}: historical fixture integrity`,
  );
}

function authored(level) {
  return {
    id: level.id,
    hpMul: level.hpMul,
    speedMul: level.speedMul,
    hangar: { x: level.hangar.x, y: level.hangar.y, z: level.hangar.z },
    waves: level.waves,
    continuation: level.continuation,
    paths: level.paths.map((p) => ({ id: p.id, points: p.points.length, cum: p.cum.length })),
  };
}

function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label}: finite geometry required`);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} differs from historical ${expected} by ${Math.abs(actual - expected)} (limit ${tolerance})`,
  );
}

export function assertAuthoredBaseline(level, reference) {
  assert.ok(level, `Missing historical level ${reference.id}`);
  // Runtime rounding must never excuse a schedule, ID, multiplier or authored
  // hangar-position edit. Direct equality also gives a useful field-level diff.
  assert.deepEqual(
    authored(level),
    authored(reference),
    `${reference.id}: exact authored settings and schedules`,
  );
  for (const axis of ["yaw", "pitch"])
    close(level.hangar[axis], reference.hangar[axis], AIM_TOLERANCE, `${reference.id}.hangar.${axis}`);
  for (const [i, path] of level.paths.entries()) {
    const expected = reference.paths[i];
    const label = `${reference.id}.${path.id}`;
    for (const [j, point] of path.points.entries()) {
      for (const axis of ["x", "y", "z"])
        close(point[axis], expected.points[j][axis], GEOMETRY_TOLERANCE, `${label}.points[${j}].${axis}`);
      close(path.cum[j], expected.cum[j], GEOMETRY_TOLERANCE, `${label}.cum[${j}]`);
    }
    close(path.length, expected.length, GEOMETRY_TOLERANCE, `${label}.length`);
  }
}
