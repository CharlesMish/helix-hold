// Source-derived geometry checks and route chart. No browser or human playtest.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
const bundle = await build({
  stdin: {
    contents: 'export * from "./src/game/paths";',
    resolveDir: new URL("../", import.meta.url).pathname,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { LEVELS, FRONTIER_INDEX, RELAY_LAB_INDEX, PATH_COLORS } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const frontier = LEVELS[FRONTIER_INDEX],
  relay = LEVELS[RELAY_LAB_INDEX];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`✓ ${name}`);
}
const volume = frontier.protectedVolume;
const lo = Object.fromEntries(["x", "y", "z"].map((k) => [k, volume.center[k] - volume.size[k] / 2]));
const hi = Object.fromEntries(["x", "y", "z"].map((k) => [k, volume.center[k] + volume.size[k] / 2]));
function entry(a, b) {
  let enter = 0,
    leave = 1;
  for (const k of ["x", "y", "z"]) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-10) {
      if (a[k] < lo[k] || a[k] > hi[k]) return null;
      continue;
    }
    const s = (lo[k] - a[k]) / d,
      t = (hi[k] - a[k]) / d;
    enter = Math.max(enter, Math.min(s, t));
    leave = Math.min(leave, Math.max(s, t));
    if (enter > leave + 1e-10) return null;
  }
  return enter <= 1 + 1e-10 && leave >= 0 ? enter : null;
}
const winding = (points, angle) => {
  let total = 0,
    previous = angle(points[0]),
    sign = 0;
  for (const p of points.slice(1)) {
    const current = angle(p);
    let delta = current - previous;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    if (Math.abs(delta) > 1e-9) {
      sign ||= Math.sign(delta);
      assert.equal(Math.sign(delta), sign, "coil never reverses its winding");
    }
    total += delta;
    previous = current;
  }
  return total / (2 * Math.PI);
};
const turns = frontier.paths.map((p, i) =>
  winding(
    p.points.slice(0, 361),
    i === 0
      ? (q) => Math.atan2(q.z + 3, q.x + 27)
      : i === 1
        ? (q) => Math.atan2(q.z - 4, q.x - 27)
        : (q) => Math.atan2((q.y - 29) / 7, (q.x + 4) / 14),
  ),
);
const bounds = (points) => ({
  min: Object.fromEntries(["x", "y", "z"].map((k) => [k, Math.min(...points.map((p) => p[k]))])),
  max: Object.fromEntries(["x", "y", "z"].map((k) => [k, Math.max(...points.map((p) => p[k]))])),
  radial: Math.max(...points.map((p) => Math.hypot(p.x, p.z))),
});
const routeStats = frontier.paths.map((p, i) => ({
  id: p.id,
  length: p.length,
  windingTurns: turns[i],
  bounds: bounds(p.points),
  port: p.points.at(-1),
  maxSegment: Math.max(...p.points.slice(1).map((q, j) => distance(q, p.points[j]))),
}));
const nearPairs = [];
for (let a = 0; a < 3; a++)
  for (let b = a + 1; b < 3; b++) {
    let best = { distance: Infinity };
    // Coils only: exclude their port approaches when measuring spatial sharing.
    for (let i = 0; i <= 360; i++)
      for (let j = 0; j <= 360; j++) {
        const d = distance(frontier.paths[a].points[i], frontier.paths[b].points[j]);
        if (d < best.distance)
          best = {
            distance: d,
            pointA: frontier.paths[a].points[i],
            pointB: frontier.paths[b].points[j],
            sampleA: i,
            sampleB: j,
          };
      }
    nearPairs.push({ a, b, ...best });
  }
test("Both optional identities use independent prism ports and preserve campaign indices", () => {
  assert.equal(frontier.id, "helix-frontier");
  assert.equal(relay.id, "relay-lab");
  assert.equal(frontier.prototype, "route-expansion");
  assert.equal(relay.prototype, "relay");
  assert.equal(FRONTIER_INDEX, 5);
  assert.equal(RELAY_LAB_INDEX, 6);
  assert.equal(frontier.experiment, true);
  assert.equal(relay.experiment, true);
  assert.deepEqual(
    routeStats.map((p) => p.port),
    [
      { x: -8, y: 8, z: -3 },
      { x: 8, y: 12, z: 2 },
      { x: 0, y: 16, z: -6 },
    ],
  );
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 3; b++) assert.ok(distance(routeStats[a].port, routeStats[b].port) > 8);
});
test("Every segment is finite, traversable and leaves room inside the existing flight bounds", () => {
  for (const p of frontier.paths) {
    assert.ok(p.length > 70 && p.length < 160);
    for (let i = 0; i < p.points.length; i++) {
      const q = p.points[i];
      assert.ok([q.x, q.y, q.z, p.cum[i]].every(Number.isFinite));
      assert.ok(q.y >= 4 && q.y <= 40 && Math.hypot(q.x, q.z) <= 44, `${p.id} leaves flying margin`);
      if (i) {
        assert.ok(p.cum[i] > p.cum[i - 1]);
        assert.ok(distance(q, p.points[i - 1]) < 0.6);
      }
      const at = p.pointAt(p.cum[i]);
      assert.ok(Math.abs(Math.hypot(at.tx, at.ty, at.tz) - 1) < 1e-9);
    }
    const join = p.points[360],
      before = p.points[359],
      after = p.points[361];
    const cosine =
      ((join.x - before.x) * (after.x - join.x) +
        (join.y - before.y) * (after.y - join.y) +
        (join.z - before.z) * (after.z - join.z)) /
      (distance(join, before) * distance(after, join));
    assert.ok(cosine > 0.98, `${p.id} tangent-aligned transfer`);
  }
  for (const l of [frontier, relay]) {
    assert.ok(Math.hypot(l.hangar.x, l.hangar.z) < 44);
    assert.ok(l.hangar.y < 40 && Math.abs(l.hangar.pitch) < 1.05);
  }
});
test("No route enters or crosses the protected volume before its final port", () => {
  for (const p of frontier.paths)
    for (let i = 1; i < p.points.length; i++) {
      const e = entry(p.points[i - 1], p.points[i]);
      if (i === p.points.length - 1)
        assert.ok(e !== null && Math.abs(e - 1) < 1e-8, `${p.id} arrives exactly at face`);
      else assert.equal(e, null, `${p.id} intersects prism before endpoint at segment ${i}`);
    }
});
test("Two opposite vertical spindles and a horizontal vault keep coherent authored winding", () => {
  assert.ok(Math.abs(turns[0] - 1.2) < 1e-10);
  assert.ok(Math.abs(turns[1] + 1.25) < 1e-10);
  assert.ok(Math.abs(turns[2] - 1.15) < 1e-10);
  for (const i of [0, 1])
    for (let j = 1; j <= 360; j++)
      assert.ok(frontier.paths[i].points[j].y < frontier.paths[i].points[j - 1].y);
  for (let j = 1; j <= 360; j++) assert.ok(frontier.paths[2].points[j].z > frontier.paths[2].points[j - 1].z);
});
test("The second coil is separate; the third borrows a true 3D west neighborhood while opening distant space", () => {
  assert.ok(nearPairs.find((p) => p.a === 0 && p.b === 1).distance > 30);
  const westVault = nearPairs.find((p) => p.a === 0 && p.b === 2);
  assert.ok(
    westVault.distance < 12 && westVault.distance > 2,
    "a shared 6m field is locally possible without coincident routes",
  );
  const cStart = frontier.paths[2].points[0];
  assert.ok(
    Math.min(...frontier.paths[0].points.map((p) => distance(p, cStart))) > 25,
    "new entrance is not a west crossing",
  );
});
test("Nine-wave route study opens 1/3/6, retains old routes, and the relay lab isolates A then B", () => {
  assert.equal(frontier.waves.length, 9);
  assert.equal(relay.waves.length, 4);
  for (let path = 0; path < 3; path++) {
    const first = frontier.waves.findIndex((w) => w.groups.some((g) => g.path === path));
    assert.equal(first, [0, 2, 5][path]);
    for (const w of frontier.waves.slice(first)) assert.ok(w.groups.some((g) => g.path === path));
  }
  assert.deepEqual(
    relay.waves.slice(0, 2).map((w) => [...new Set(w.groups.map((g) => g.path))]),
    [[0], [1]],
  );
  assert.equal(relay.paths[0], frontier.paths[0]);
  assert.equal(relay.paths[1], frontier.paths[1]);
  for (const l of [frontier, relay])
    for (const w of l.waves) {
      assert.ok(
        w.groups.reduce((n, g) => n + g.count, 0) < 32,
        "light authored study is below historical live pool capacity even if all spawn at once",
      );
      for (const g of w.groups)
        assert.ok(g.path >= 0 && g.path < l.paths.length && g.count > 0 && g.interval > 0 && g.delay >= 0);
    }
});
const report = {
  source: "src/game/paths.ts",
  evidence: "Source-derived sampled route geometry; no browser or human playtest.",
  protectedVolume: volume,
  routes: routeStats,
  nearestCoilPairs: nearPairs,
  firstOpenWaves: [1, 3, 6],
  maxEnemiesPerWave: Math.max(...frontier.waves.map((w) => w.groups.reduce((n, g) => n + g.count, 0))),
  checks,
};
if (process.argv.includes("--write")) {
  await writeFile(
    new URL("../docs/FRONTIER_GEOMETRY.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
  );
  const colors = ["#71e7ef", "#b5a2ff", "#ffb277"]; // Protected-prism palette in scene.ts.
  const escape = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const boxes = [];
  for (const x of [lo.x, hi.x])
    for (const y of [lo.y, hi.y]) for (const z of [lo.z, hi.z]) boxes.push({ x, y, z });
  const edges = [];
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++)
      if (["x", "y", "z"].filter((k) => boxes[i][k] !== boxes[j][k]).length === 1)
        edges.push([boxes[i], boxes[j]]);
  const points = frontier.paths.flatMap((p) => p.points).concat(boxes);
  function panel(x, y, w, h, title, project, axes) {
    const all = points.map(project),
      minX = Math.min(...all.map((p) => p[0])),
      maxX = Math.max(...all.map((p) => p[0])),
      minY = Math.min(...all.map((p) => p[1])),
      maxY = Math.max(...all.map((p) => p[1]));
    const scale = Math.min((w - 80) / (maxX - minX), (h - 110) / (maxY - minY));
    const map = (q) => {
      const p = project(q);
      return [
        x + w / 2 + (p[0] - (minX + maxX) / 2) * scale,
        y + 57 + (h - 80) / 2 + (p[1] - (minY + maxY) / 2) * scale,
      ];
    };
    const pair = (q) =>
      map(q)
        .map((v) => v.toFixed(2))
        .join(",");
    let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#101c28" stroke="#2a3b49"/><text x="${x + 22}" y="${y + 30}" fill="#e9f1f3" font-size="17" font-weight="600">${title}</text><text x="${x + 22}" y="${y + 51}" fill="#8196a5" font-size="12">${axes}</text>`;
    for (const edge of edges)
      out += `<polyline points="${edge.map(pair).join(" ")}" fill="none" stroke="#527568" stroke-width="1.4" stroke-dasharray="4 4"/>`;
    for (const [i, p] of frontier.paths.entries()) {
      out += `<polyline points="${p.points.map(pair).join(" ")}" fill="none" stroke="${colors[i]}" stroke-width="${w > 600 ? 2.5 : 1.8}" stroke-linejoin="round"/>`;
      const [sx, sy] = map(p.points[0]),
        [ex, ey] = map(p.points.at(-1));
      out += `<circle cx="${sx}" cy="${sy}" r="5" fill="#101c28" stroke="${colors[i]}" stroke-width="2"/><text x="${sx + 8}" y="${sy - 7}" fill="${colors[i]}" font-size="14" font-weight="700">${"ABC"[i]}</text><rect x="${ex - 3.3}" y="${ey - 3.3}" width="6.6" height="6.6" fill="${colors[i]}"/>`;
      for (const f of [0.22, 0.52, 0.8]) {
        const a = p.pointAt(p.length * f),
          b = p.pointAt(p.length * f + 0.35);
        const [ax, ay] = map(a),
          [bx, by] = map(b),
          angle = Math.atan2(by - ay, bx - ax);
        out += `<path d="M ${ax - 5 * Math.cos(angle - 0.5)} ${ay - 5 * Math.sin(angle - 0.5)} L ${ax} ${ay} L ${ax - 5 * Math.cos(angle + 0.5)} ${ay - 5 * Math.sin(angle + 0.5)}" fill="none" stroke="${colors[i]}" stroke-width="2"/>`;
      }
    }
    return out;
  }
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="990" viewBox="0 0 1400 990"><rect width="1400" height="990" fill="#08121c"/><g font-family="system-ui, sans-serif"><text x="36" y="48" fill="#f0f4ed" font-size="30" font-weight="700">HELIX FRONTIER</text><text x="36" y="77" fill="#a3b4c0" font-size="15">Three authored coils / separate breach ports / source geometry, not a rendered playtest</text>`;
  svg += panel(
    30,
    104,
    815,
    660,
    "Oblique route chart",
    (p) => [0.8 * p.x - 0.6 * p.z, 0.26 * p.x + 0.35 * p.z - 0.9 * p.y],
    "Circles: entry gates   /   squares: breach ports   /   dotted: protected prism",
  );
  svg += panel(
    865,
    104,
    505,
    320,
    "Plan · looking down",
    (p) => [p.x, p.z],
    "West ← X → East   /   North is up",
  );
  svg += panel(
    865,
    444,
    505,
    320,
    "Elevation · looking north",
    (p) => [p.x, -p.y],
    "Horizontal: X   /   Vertical: height",
  );
  const names = ["A · West Spindle", "B · East Return", "C · North Vault"];
  const notes = [
    "1.20 turns · descends 36 → 14 m",
    "−1.25 turns · descends 39 → 17 m",
    "1.15 turns · horizontal axis · 22–36 m high",
  ];
  for (let i = 0; i < 3; i++) {
    const x = 30 + i * 452;
    svg += `<rect x="${x}" y="786" width="436" height="132" rx="12" fill="#101c28" stroke="#2a3b49"/><text x="${x + 20}" y="816" fill="${colors[i]}" font-size="18" font-weight="650">${names[i]} · wave ${[1, 3, 6][i]}</text><text x="${x + 20}" y="844" fill="#cad7dc" font-size="14">${notes[i]}</text><text x="${x + 20}" y="868" fill="#cad7dc" font-size="14">${routeStats[i].length.toFixed(1)} m route · independent ${["west", "east", "north"][i]} port</text><text x="${x + 20}" y="893" fill="#8ea3b0" font-size="13">${["Establish a useful long line.", "Extend while the west keeps working.", "Borrow a western slice; cover a new entrance."][i]}</text>`;
  }
  svg += `<text x="36" y="950" fill="#8ea3b0" font-size="13">${escape(`Minimum coil separation: A–B ${nearPairs[0].distance.toFixed(1)} m; A–C ${nearPairs[1].distance.toFixed(1)} m; B–C ${nearPairs[2].distance.toFixed(1)} m. No route enters the enclosure before its port.`)}</text><text x="36" y="972" fill="#6f8797" font-size="12">Nine light authored waves test spatial expansion. All opened routes remain active. Relay Lab reuses A and B separately.</text></g></svg>`;
  await writeFile(new URL("../public/frontier-routes.svg", import.meta.url), svg);
  console.log("Wrote docs/FRONTIER_GEOMETRY.json and public/frontier-routes.svg.");
}
console.log(`\n${checks} Frontier geometry checks passed.`);
console.log(
  JSON.stringify({
    lengths: routeStats.map((p) => Number(p.length.toFixed(2))),
    coilSeparation: nearPairs.map((p) => Number(p.distance.toFixed(2))),
    maxEnemiesPerWave: report.maxEnemiesPerWave,
  }),
);
