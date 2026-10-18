import { clamp, smoothstep, type Vec3 } from "./math";

export const CORE: Vec3 = { x: 0, y: 4.4, z: 0 };
export type Hangar = Vec3 & { yaw: number; pitch: number };

function lookingAt(position: Vec3, target: Vec3): Hangar {
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dz = target.z - position.z;
  return {
    ...position,
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.atan2(dy, Math.hypot(dx, dz)),
  };
}

// Legacy exports describe the first arena. During play use run.level.hangar.
const firstHangar = lookingAt({ x: -14, y: 24, z: 2 }, { x: -17, y: 21, z: -10.7 });
export const HANGAR: Vec3 = firstHangar;
export const HANGAR_YAW = firstHangar.yaw;
export const HANGAR_PITCH = firstHangar.pitch;

export type PathCurve = {
  id: string;
  points: Vec3[];
  cum: number[];
  length: number;
  pointAt: (dist: number) => {
    x: number;
    y: number;
    z: number;
    tx: number;
    ty: number;
    tz: number;
  };
};

export type LevelDef = {
  id: string;
  name: string;
  blurb: string;
  subtitle: string;
  briefing: string;
  hangar: Hangar;
  accent?: number;
  experiment?: boolean;
  archived?: boolean;
  /** Fields may be offered by a campaign arena without making it a lab experiment. */
  stasisAvailable?: boolean;
  /** Crown grows through earned scrap; other arenas retain their eight-drone limit. */
  fleetGrowth?: "scrap";
  /** The Crown experiment introduces distinct specialist roles and independent prices. */
  droneRoster?: "expanded";
  dronePricing?: "per-type";
  presentation?: "split-crown" | "protected-prism";
  /** Optional spatial experiments keep their own stable identities and records. */
  prototype?: "route-expansion" | "relay";
  /** Holographic defended enclosure; each route ends at its own breach port. */
  protectedVolume?: { center: Vec3; size: Vec3 };
  startingScrap?: number;
  primaryPath?: number;
  sweepDps?: number;
  hpMul: number;
  speedMul: number;
  paths: PathCurve[];
  waves: WaveSpec[];
  /** Authored extra waves, offered only after the ordinary arena clear is recorded. */
  continuation?: WaveSpec[];
  /** Drift prototypes rebuild a route after it swings by a cumulative angle (degrees). */
  driftPath?: (pathIndex: number, swingDegrees: number) => PathCurve;
};

export type Kind = "shard" | "barge" | "wisp" | "carrier";

export type WaveSpec = {
  chapter?: string;
  lesson?: string;
  /** Applied when this wave's setup begins: each listed route swings around the prism. */
  drift?: { path: number; degrees: number }[];
  groups: {
    kind: Kind;
    path: number;
    count: number;
    interval: number;
    delay: number;
    /** Local route pacing, multiplied by the arena and enemy-kind speeds. */
    speedMul?: number;
    /** Authored local hull multiplier; omitted groups keep the original arena hull. */
    hpMul?: number;
  }[];
};

function finishBlend(raw: (t: number) => Vec3): (t: number) => Vec3 {
  return (t) => {
    const p = raw(t);
    const k = smoothstep(0.86, 1, t);
    return {
      x: p.x + (CORE.x - p.x) * k,
      y: p.y + (CORE.y - p.y) * k,
      z: p.z + (CORE.z - p.z) * k,
    };
  };
}

function helixSample(o: {
  radius: number;
  turns: number;
  y0: number;
  y1: number;
  phase: number;
  bulge?: number;
  drift?: number;
}): (t: number) => Vec3 {
  return finishBlend((t) => {
    const theta = o.phase + t * o.turns * Math.PI * 2;
    const envelope = 1 - 0.82 * smoothstep(0.74, 0.98, t);
    const bulge = (o.bulge ?? 0) * Math.sin(t * Math.PI);
    const r = (o.radius + bulge) * envelope;
    const drift = (o.drift ?? 0) * Math.sin(t * Math.PI);
    return {
      x: Math.cos(theta) * r + drift,
      y: o.y0 + (o.y1 - o.y0) * t + (o.bulge ? Math.sin(t * Math.PI * 2) * 1.6 : 0),
      z: Math.sin(theta) * r,
    };
  });
}

/** Joined cubic arcs let the first arena teach a long firing line before its curl. */
function arcSample(arcs: [Vec3, Vec3, Vec3, Vec3][]): (t: number) => Vec3 {
  return (t) => {
    const u = clamp(t, 0, 1) * arcs.length;
    const i = Math.min(arcs.length - 1, Math.floor(u));
    const v = u - i;
    const w = 1 - v;
    const [a, b, c, d] = arcs[i]!;
    return {
      x: w ** 3 * a.x + 3 * w * w * v * b.x + 3 * w * v * v * c.x + v ** 3 * d.x,
      y: w ** 3 * a.y + 3 * w * w * v * b.y + 3 * w * v * v * c.y + v ** 3 * d.y,
      z: w ** 3 * a.z + 3 * w * w * v * b.z + 3 * w * v * v * c.z + v ** 3 * d.z,
    };
  };
}

const compactCurl = arcSample([
  [
    { x: -20, y: 21, z: -10 },
    { x: -12, y: 21, z: -12 },
    { x: 7, y: 20, z: -14 },
    { x: 13, y: 17, z: -8 },
  ],
  [
    { x: 13, y: 17, z: -8 },
    { x: 19, y: 14, z: -2 },
    { x: 15, y: 10, z: 14 },
    { x: 3, y: 8, z: 15 },
  ],
  [
    { x: 3, y: 8, z: 15 },
    { x: -9, y: 6, z: 16 },
    { x: -15, y: 5, z: 5 },
    { x: -9, y: 4.8, z: -1 },
  ],
  [{ x: -9, y: 4.8, z: -1 }, { x: -6, y: 4.7, z: -4 }, { x: -1, y: 4.4, z: -3 }, CORE],
]);

/** A descending figure-eight: crossings overlap in plan, but remain at different heights. */
const shearSample = finishBlend((t) => {
  const theta = -Math.PI / 2 + t * Math.PI * 2;
  return {
    x: 22 * Math.sin(theta) + 5,
    y: 29 - 20 * t,
    z: 12 * Math.sin(theta * 2),
  };
});

/** Most of a tilted ellipse, followed by a visible inward transfer to the core. */
function orbitalSample(o: {
  rx: number;
  rz: number;
  height: number;
  tiltX: number;
  tiltZ: number;
  phase: number;
}): (t: number) => Vec3 {
  const arcFraction = 0.82;
  const sweep = Math.PI * 1.8;
  const ring = (theta: number): Vec3 => ({
    x: o.rx * Math.cos(theta),
    y: o.height + o.tiltX * Math.cos(theta) + o.tiltZ * Math.sin(theta),
    z: o.rz * Math.sin(theta),
  });
  const thetaEnd = o.phase + sweep;
  const end = ring(thetaEnd);
  const tangent = {
    x: -o.rx * Math.sin(thetaEnd),
    y: -o.tiltX * Math.sin(thetaEnd) + o.tiltZ * Math.cos(thetaEnd),
    z: o.rz * Math.cos(thetaEnd),
  };
  const length = Math.hypot(tangent.x, tangent.y, tangent.z);
  const transfer = arcSample([
    [
      end,
      {
        x: end.x + (tangent.x / length) * 5,
        y: end.y + (tangent.y / length) * 5,
        z: end.z + (tangent.z / length) * 5,
      },
      { x: end.x * 0.15, y: 6.2, z: end.z * 0.15 },
      CORE,
    ],
  ]);
  return (t) =>
    t <= arcFraction
      ? ring(o.phase + (t / arcFraction) * sweep)
      : transfer((t - arcFraction) / (1 - arcFraction));
}

export function buildPath(id: string, sample: (t: number) => Vec3, n = 160): PathCurve {
  const points: Vec3[] = [];
  const cum: number[] = [];
  let length = 0;
  let prev = sample(0);
  points.push(prev);
  cum.push(0);
  for (let i = 1; i <= n; i++) {
    const p = sample(i / n);
    length += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    points.push(p);
    cum.push(length);
    prev = p;
  }
  return {
    id,
    points,
    cum,
    length,
    pointAt(dist) {
      const d = clamp(dist, 0, length);
      let lo = 0;
      let hi = cum.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid]! <= d) lo = mid;
        else hi = mid;
      }
      const span = cum[hi]! - cum[lo]! || 1;
      const t = (d - cum[lo]!) / span;
      const a = points[lo]!;
      const b = points[hi]!;
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const tz = b.z - a.z;
      const L = Math.hypot(tx, ty, tz) || 1;
      return {
        x: a.x + tx * t,
        y: a.y + ty * t,
        z: a.z + tz * t,
        tx: tx / L,
        ty: ty / L,
        tz: tz / L,
      };
    },
  };
}

const g = (
  kind: Kind,
  path: number,
  count: number,
  interval: number,
  delay: number,
  speedMul = 1,
  hpMul?: number,
) => ({ kind, path, count, interval, delay, speedMul, ...(hpMul === undefined ? {} : { hpMul }) });

export const LEVELS: LevelDef[] = [
  {
    id: "tutorial",
    name: "Flight School",
    blurb: "Two short lessons: hold one curling lane, then divide your defense between two.",
    subtitle: "Glass Needle → Twin Ribbon · 5 waves",
    briefing:
      "The first two waves follow the high curl. Then a lower coil opens: leave your first line working and build a second. Aim along a ribbon for sustained coverage.",
    hangar: firstHangar,
    accent: 0x2ee6c7,
    hpMul: 0.9,
    speedMul: 0.86,
    paths: [
      buildPath("main", compactCurl, 240),
      buildPath("inner", helixSample({ radius: 10.6, turns: 1.02, y0: 15, y1: 6, phase: 3.65 }), 200),
    ],
    waves: [
      {
        chapter: "Glass Needle",
        lesson: "Find a long line along the high curl. Anchor a drone to keep it firing.",
        groups: [g("shard", 0, 5, 2.1, 0.65)],
      },
      {
        chapter: "Glass Needle",
        lesson: "Barges need sustained fire. Reinforce a useful angle or improve a short crossing.",
        groups: [g("shard", 0, 6, 1.5, 0.65), g("barge", 0, 1, 3.4, 3.8)],
      },
      {
        chapter: "Twin Ribbon",
        lesson: "The lower coil is open. Keep your first line and add coverage for the second gate.",
        groups: [g("shard", 1, 4, 2, 0.65), g("barge", 0, 2, 3.5, 2.5)],
      },
      {
        chapter: "Twin Ribbon",
        lesson: "Wisps weave off the ribbon. Compare a wider Sweep with an overlapping Pierce line.",
        groups: [g("wisp", 1, 3, 1.8, 0.65), g("shard", 0, 5, 1.5, 1.5), g("barge", 1, 1, 3.5, 4)],
      },
      {
        chapter: "Twin Ribbon",
        lesson: "Hold both gates. Recall a weak placement or fan the lattice to cover a gap.",
        groups: [g("shard", 1, 5, 1.5, 0.65), g("barge", 0, 3, 3, 1.5), g("wisp", 0, 3, 1.6, 2.5)],
      },
    ],
  },
  {
    id: "shear",
    name: "Shear Lane",
    blurb: "A dive, a coil, and a crossing loop. Different heights demand different lines.",
    subtitle: "Three gates · 5 + 3 optional waves",
    briefing:
      "The compact dive now gives you time to react. The wide figure-eight crosses itself at different heights: fan or slide your lattice between the lanes, and leave room for weaving wisps.",
    hangar: lookingAt({ x: 13, y: 23, z: 14 }, { x: 3, y: 19.5, z: 6 }),
    accent: 0xb6a3ff,
    hpMul: 1.08,
    speedMul: 1,
    paths: [
      buildPath("dive", helixSample({ radius: 7.2, turns: 0.92, y0: 20, y1: 6, phase: 0.95 })),
      buildPath("main", helixSample({ radius: 13, turns: 1.05, y0: 26, y1: 7, phase: -0.85 })),
      buildPath("shear", shearSample, 240),
    ],
    waves: [
      {
        lesson: "Establish a line on the compact dive before the other gates open.",
        groups: [g("shard", 0, 6, 1.45, 0.65, 0.55)],
      },
      {
        lesson: "Watch the heights: the wide loop crosses above itself.",
        groups: [g("barge", 1, 3, 2.9, 0.65), g("wisp", 2, 4, 1.7, 1.3)],
      },
      { groups: [g("shard", 0, 6, 1.2, 0.65, 0.55), g("barge", 2, 3, 2.7, 1.5)] },
      { groups: [g("wisp", 2, 6, 1.4, 0.65), g("shard", 0, 5, 1.15, 1.1, 0.55), g("barge", 1, 3, 2.7, 2)] },
      {
        groups: [
          g("shard", 0, 7, 1, 0.65, 0.55),
          g("wisp", 2, 5, 1.3, 1.1),
          g("barge", 2, 3, 2.5, 1.8),
          g("barge", 1, 2, 2.9, 3.2),
        ],
      },
    ],
    continuation: [
      {
        chapter: "06 · Changing lanes",
        lesson:
          "Wisps take the middle coil while Shards circle the wide loop. A delayed dive burst arrives after both gates are busy.",
        groups: [g("wisp", 1, 6, 1.3, 0.65), g("shard", 2, 6, 1.1, 1.2), g("shard", 0, 6, 1.15, 7.5, 0.55)],
      },
      {
        chapter: "07 · Heavy descent",
        lesson:
          "Barges now use the compact dive as well as the middle coil. Give these short approaches sustained fire; wide-loop Wisps are the diversion.",
        groups: [g("barge", 0, 4, 2.1, 0.65, 0.55), g("barge", 1, 4, 2.1, 2.5), g("wisp", 2, 7, 1.25, 0.8)],
      },
      {
        chapter: "08 · Three-way hold",
        lesson:
          "The wide convoy comes first. Dive traffic follows, then a second push takes the middle coil. Hold broad coverage without abandoning the short route.",
        groups: [
          g("barge", 2, 4, 2, 0.65),
          g("wisp", 2, 5, 1.25, 1.4),
          g("shard", 0, 8, 1.1, 5.5, 0.55),
          g("shard", 1, 7, 1.1, 9),
          g("barge", 1, 3, 2.3, 10.5),
        ],
      },
    ],
  },
  {
    id: "orbital",
    archived: true,
    name: "Orbital Garden",
    blurb: "Two tilted rings orbit the core. Find shared lines, then cover their inward exits.",
    subtitle: "Two tilted rings · 5 + 3 optional waves",
    briefing:
      "Enemies travel most of an ellipse before turning inward to the core. The rings tilt in opposite directions: align a beam through useful stretches, or guard their inward approaches.",
    hangar: lookingAt({ x: -3, y: 22, z: 23 }, { x: -7.5, y: 17.6, z: 10.2 }),
    accent: 0x87bfff,
    hpMul: 1.06,
    speedMul: 0.94,
    paths: [
      buildPath(
        "inner-orbit",
        orbitalSample({ rx: 16, rz: 12, height: 16, tiltX: 6, tiltZ: 5, phase: 2 }),
        220,
      ),
      buildPath(
        "outer-orbit",
        orbitalSample({ rx: 23, rz: 18, height: 19, tiltX: -10, tiltZ: 2, phase: 2.55 }),
        240,
      ),
    ],
    waves: [
      {
        lesson: "Follow the inner ring to its inward exit. A beam can cover more than one arc.",
        groups: [g("shard", 0, 6, 1.8, 0.65)],
      },
      {
        lesson: "The outer ring is active. Its tilt changes which lines can reach both routes.",
        groups: [g("barge", 1, 2, 3.2, 0.65), g("wisp", 0, 3, 1.9, 2)],
      },
      { groups: [g("shard", 1, 5, 1.6, 0.65), g("barge", 0, 2, 3.2, 2)] },
      { groups: [g("wisp", 1, 5, 1.6, 0.65), g("shard", 0, 5, 1.4, 1.5), g("barge", 1, 2, 3, 3)] },
      {
        groups: [
          g("shard", 0, 6, 1.25, 0.65),
          g("wisp", 1, 5, 1.5, 1.3),
          g("barge", 0, 2, 2.8, 2.2),
          g("barge", 1, 2, 3, 3.5),
        ],
      },
    ],
    continuation: [
      {
        chapter: "06 · Ring exchange",
        lesson:
          "The inner gate opens first, then the outer answers. Drifting escorts follow each burst: check both inward exits before committing the lattice.",
        groups: [
          g("shard", 0, 6, 1.1, 0.65),
          g("wisp", 0, 4, 1.6, 3.5),
          g("shard", 1, 6, 1.1, 6.5),
          g("wisp", 1, 4, 1.6, 9.5),
        ],
      },
      {
        chapter: "07 · Twin convoys",
        lesson:
          "Armored convoys travel both rings together. Wide-loop Wisps test the edge of your coverage while Barges need long contact on the inward approaches.",
        groups: [g("barge", 1, 5, 2.2, 0.65), g("barge", 0, 5, 2.2, 2.5), g("wisp", 1, 8, 1.25, 3)],
      },
      {
        chapter: "08 · Crossing orbits",
        lesson:
          "Both gates send mixed traffic, then late Wisps follow the convoys. Keep the shared lines working and use a dedicated line where an inward exit is exposed.",
        groups: [
          g("shard", 0, 8, 1.05, 0.65),
          g("shard", 1, 8, 1.05, 2.5),
          g("barge", 0, 4, 2, 3),
          g("barge", 1, 4, 2, 4.5),
          g("wisp", 0, 3, 1.4, 10.5),
          g("wisp", 1, 3, 1.4, 12),
        ],
      },
    ],
  },
];

export const PATH_COLORS = [0x71d9e8, 0x9aaedc, 0x92c6d6];

/** Optional lab encounter. Regular arena identities and schedules above remain unchanged. */
const shear = LEVELS[1]!;
export const CARRIER_TEST_INDEX = LEVELS.length;
LEVELS.push({
  ...shear,
  continuation: undefined,
  id: "carrier-test",
  name: "Carrier Test Flight",
  experiment: true,
  primaryPath: 2,
  sweepDps: 22,
  subtitle: "Stasis + carrier · 3 waves · optional",
  blurb: "Build a lattice, slow a real crossing, then hold the carrier route.",
  briefing:
    "A three-wave experiment on Shear. Stasis slows foes to half speed inside a 6m-radius sphere for no damage; overlapping fields do not stack. Sweep tries 22 DPS here. The final carrier follows the wide figure-eight; a breach costs 40 core. Campaign records stay separate.",
  waves: [
    {
      chapter: "01 · Establish",
      lesson:
        "Start with damage: two drones are funded. The dive opens first. The carrier will use the wide figure-eight in wave 3.",
      groups: [g("shard", 0, 6, 1.65, 0.8, 0.55)],
    },
    {
      chapter: "02 · Crossings",
      lesson:
        "Try Stasis where routes meet in 3D. Its amber highlight marks time gained, not damage. Keep enough firing lines to stop these escorts.",
      groups: [g("shard", 2, 6, 1.6, 0.8), g("barge", 1, 2, 3.5, 2), g("wisp", 2, 3, 1.9, 4)],
    },
    {
      chapter: "03 · Carrier approach",
      lesson:
        "Carrier inbound on the wide figure-eight: 486 hull, 40 core on breach. Hold a long firing line there while escorts use the dive and middle coil.",
      groups: [
        g("carrier", 2, 1, 1, 1.5),
        g("shard", 0, 6, 1.8, 2.5, 0.55),
        g("barge", 1, 2, 3.5, 4),
        g("wisp", 1, 3, 2, 6),
      ],
    },
  ],
});

/** Offset helix followed by a tangent-aligned transfer to the existing core. */
function crownHelix(o: {
  cx: number;
  cz: number;
  radius: number;
  y0: number;
  y1: number;
  turns: number;
  endAngle: number;
  transfer: Vec3;
}): (t: number) => Vec3 {
  const helix = (t: number): Vec3 => {
    const a = o.endAngle + (t - 1) * o.turns * Math.PI * 2;
    return {
      x: o.cx + o.radius * Math.cos(a),
      y: o.y0 + (o.y1 - o.y0) * t,
      z: o.cz + o.radius * Math.sin(a),
    };
  };
  const end = helix(1);
  const tangent = {
    x: -o.radius * Math.sin(o.endAngle) * o.turns * Math.PI * 2,
    y: o.y1 - o.y0,
    z: o.radius * Math.cos(o.endAngle) * o.turns * Math.PI * 2,
  };
  const length = Math.hypot(tangent.x, tangent.y, tangent.z);
  const transfer = arcSample([
    [
      end,
      {
        x: end.x + (tangent.x / length) * 5,
        y: end.y + (tangent.y / length) * 5,
        z: end.z + (tangent.z / length) * 5,
      },
      o.transfer,
      CORE,
    ],
  ]);
  // An exact sample at the join keeps the two pieces connected in the polyline.
  return (t) => (t <= 0.75 ? helix(t / 0.75) : transfer((t - 0.75) / 0.25));
}

/** Cubic interpolating chain with one shared tangent per join (C1 in segment time). */
function crownTransfer(points: Vec3[]): (t: number) => Vec3 {
  const tangents = points.map((p, i): Vec3 => {
    const before = points[Math.max(0, i - 1)]!;
    const after = points[Math.min(points.length - 1, i + 1)]!;
    const scale = i === 0 || i === points.length - 1 ? 1 : 0.5;
    return {
      x: (after.x - before.x) * scale,
      y: (after.y - before.y) * scale,
      z: (after.z - before.z) * scale,
    };
  });
  const arcs: [Vec3, Vec3, Vec3, Vec3][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const ta = tangents[i]!;
    const tb = tangents[i + 1]!;
    arcs.push([
      a,
      { x: a.x + ta.x / 3, y: a.y + ta.y / 3, z: a.z + ta.z / 3 },
      { x: b.x - tb.x / 3, y: b.y - tb.y / 3, z: b.z - tb.z / 3 },
      b,
    ]);
  }
  return arcSample(arcs);
}

/** New campaign identity: older array positions and scores remain unchanged. */
export const SPLIT_CROWN_INDEX = LEVELS.length;
LEVELS.push({
  id: "split-crown",
  name: "Split Crown",
  subtitle: "Two crowns · 4 gates + carrier route · 8 + 4 optional waves",
  blurb:
    "Build across two distant helix districts. A final carrier visits both crowns: keep shared slices working while you hold dedicated lines.",
  briefing:
    "Start on the west crown, then build toward the east as four gates open. Grow your fleet with earned scrap, without a drone cap. Route E carries the wave-eight carrier. Record that clear, then choose four more waves and a stronger carrier on E. Plan & launch gives unlimited setup; reposition drones for free between waves.",
  hangar: lookingAt({ x: -9, y: 28, z: -20 }, { x: -14.24097, y: 37, z: -13.3037 }),
  accent: 0xe8c58b,
  stasisAvailable: true,
  fleetGrowth: "scrap",
  droneRoster: "expanded",
  dronePricing: "per-type",
  presentation: "split-crown",
  primaryPath: 4,
  hpMul: 1.08,
  speedMul: 0.96,
  paths: [
    buildPath(
      "west-crown",
      crownHelix({
        cx: -21,
        cz: -4,
        radius: 11.5,
        y0: 37,
        y1: 19,
        turns: 1.15,
        endAngle: 0,
        transfer: { x: -4, y: 8, z: -10 },
      }),
      480,
    ),
    buildPath(
      "west-coil",
      crownHelix({
        cx: -21,
        cz: -4,
        radius: 8.5,
        y0: 29,
        y1: 12,
        turns: -1.1,
        endAngle: 0,
        transfer: { x: -9, y: 6, z: 4 },
      }),
      480,
    ),
    buildPath(
      "east-crown",
      crownHelix({
        cx: 21,
        cz: 4,
        radius: 11.5,
        y0: 35,
        y1: 17,
        turns: -1.15,
        endAngle: Math.PI,
        transfer: { x: 4, y: 8, z: 10 },
      }),
      480,
    ),
    buildPath(
      "east-coil",
      crownHelix({
        cx: 21,
        cz: 4,
        radius: 8.5,
        y0: 27,
        y1: 10,
        turns: 1.1,
        endAngle: Math.PI,
        transfer: { x: 9, y: 6, z: -4 },
      }),
      480,
    ),
    buildPath(
      "crown-transfer",
      crownTransfer([
        { x: -37, y: 34, z: -20 },
        { x: -22.3, y: 23.25, z: -13.92 },
        { x: -2, y: 26, z: -13 },
        { x: 22.3, y: 21.25, z: -5.92 },
        { x: 33, y: 16, z: 11 },
        { x: 20, y: 10, z: 13 },
        { x: 0, y: 11, z: 12 },
        { x: -17, y: 10, z: 4 },
        { x: -13, y: 7, z: -5 },
        CORE,
      ]),
      720,
    ),
  ],
  waves: [
    {
      chapter: "01 · West crown",
      lesson:
        "Begin with a long line on A. Two damage drones are funded. Carrier route E is visible now but will not open until wave 8.",
      groups: [g("shard", 0, 6, 1.8, 1)],
    },
    {
      chapter: "02 · A local pair",
      lesson:
        "B opens below A. Find a shared chord through the west pair, or give each route its own sustained line.",
      groups: [g("shard", 1, 5, 1.65, 1), g("shard", 0, 4, 1.5, 3), g("barge", 0, 1, 3, 5)],
    },
    {
      chapter: "03 · Across the divide",
      lesson:
        "C opens in the east. Use earned scrap or reposition a redundant west drone. One Stasis field cannot bridge both distant districts.",
      groups: [g("shard", 2, 6, 1.5, 1), g("barge", 0, 2, 2.8, 3), g("wisp", 1, 3, 1.8, 6)],
    },
    {
      chapter: "04 · Twin convoys",
      lesson:
        "Barges travel both crowns. A short shared slice may need a dedicated line beside it; watch Sweep's nearest target during crowded contact.",
      groups: [
        g("barge", 0, 3, 2.5, 1),
        g("barge", 2, 3, 2.5, 5),
        g("shard", 1, 5, 1.35, 3),
        g("wisp", 2, 3, 1.65, 9),
      ],
    },
    {
      chapter: "05 · The lower east",
      lesson:
        "D completes the east pair. Keep coverage high while adding a lower approach; setup repositioning preserves each drone and its paid value.",
      groups: [
        g("shard", 3, 6, 1.35, 1),
        g("wisp", 0, 4, 1.5, 3),
        g("barge", 2, 3, 2.5, 5),
        g("shard", 1, 4, 1.3, 10),
      ],
    },
    {
      chapter: "06 · Low pressure",
      lesson:
        "Heavy traffic moves to the lower coils. Compare a useful local Stasis field with the damage line that would occupy its slot.",
      groups: [
        g("barge", 1, 4, 2.25, 1),
        g("barge", 3, 4, 2.25, 4),
        g("wisp", 0, 5, 1.4, 6),
        g("shard", 2, 6, 1.2, 10),
      ],
    },
    {
      chapter: "07 · Crown exchange",
      lesson:
        "Convoys split between the crowns while lower escorts arrive later. Prepare a final line for E: the carrier will visit both districts next wave.",
      groups: [
        g("barge", 0, 3, 2.2, 1),
        g("barge", 2, 3, 2.2, 4),
        g("wisp", 1, 6, 1.3, 6),
        g("shard", 3, 6, 1.2, 10),
        g("shard", 0, 4, 1.2, 15),
      ],
    },
    {
      chapter: "08 · The crown carrier",
      lesson:
        "Carrier inbound on E: 486 hull, 40 core on breach. It crosses both local defense neighborhoods before turning through the lower approaches. Escorts keep all four gates relevant.",
      groups: [
        g("carrier", 4, 1, 1, 1.5),
        g("barge", 0, 4, 2.3, 3),
        g("shard", 1, 7, 1.2, 6),
        g("wisp", 2, 5, 1.4, 9),
        g("barge", 3, 4, 2.2, 14),
        g("wisp", 0, 4, 1.4, 23),
      ],
    },
  ],
  continuation: [
    {
      chapter: "09 · Upper convoys",
      lesson:
        "The west crown sends a heavy convoy, then the east answers. Lower-coil Wisps arrive between them. Reinforce with earned scrap or move a redundant line for free; E rests this wave.",
      groups: [
        g("barge", 0, 6, 2.1, 1, 1, 1.4),
        g("barge", 2, 6, 2.1, 10, 1, 1.4),
        g("wisp", 1, 4, 1.3, 5, 1, 1.1),
        g("wisp", 3, 4, 1.3, 18, 1, 1.1),
      ],
    },
    {
      chapter: "10 · Lower clamp",
      lesson:
        "The heavier convoys move to B and D. Upper Wisps split your attention, then a late Shard burst follows B. Long lower contact matters more than covering every gate once.",
      groups: [
        g("barge", 1, 5, 2, 1, 1, 1.6),
        g("barge", 3, 5, 2, 4, 1, 1.6),
        g("wisp", 0, 6, 1.25, 6, 1, 1.1),
        g("wisp", 2, 6, 1.25, 9, 1, 1.1),
        g("shard", 1, 6, 1.05, 18, 1, 1.15),
      ],
    },
    {
      chapter: "11 · Crown exchange",
      lesson:
        "A west convoy overlaps a lower-east burst; the eastern convoy and west-coil Wisps follow. Watch both districts before committing your pilot to a chase. E's stronger carrier comes next.",
      groups: [
        g("barge", 0, 5, 2, 1, 1, 1.9),
        g("barge", 2, 5, 2, 10, 1, 1.9),
        g("shard", 3, 8, 1, 4, 1, 1.2),
        g("wisp", 1, 8, 1.2, 17, 1, 1.1),
      ],
    },
    {
      chapter: "12 · The long pursuit",
      lesson:
        "A reinforced carrier takes E: about 3208 hull, 40 core on breach. Lower convoys and upper escorts overlap the pursuit. Keep both districts covered while chasing; your eight-wave result is already recorded.",
      groups: [
        g("carrier", 4, 1, 1, 1.5, 1, 6.6),
        g("barge", 1, 5, 2.1, 5, 1, 1.9),
        g("barge", 3, 5, 2.1, 12, 1, 1.9),
        g("wisp", 0, 6, 1.2, 8, 1, 1.1),
        g("wisp", 2, 6, 1.2, 18, 1, 1.1),
        g("shard", 0, 6, 1, 24, 1, 1.2),
      ],
    },
  ],
});

/** A coil joins one box-face port, without funneling through the old central core.
 * The transfer starts along the coil tangent. Its last control point stays outside
 * the port face, so the route reaches the protected volume only at its endpoint.
 */
/** Rotate about the protected prism's vertical axis. Zero swing returns the input object. */
function swingAboutPrism(p: Vec3, swing: number): Vec3 {
  if (swing === 0) return p;
  const c = Math.cos(swing),
    s = Math.sin(swing);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

function frontierCoil(
  o: {
    center: Vec3;
    rx: number;
    rz: number;
    drop: number;
    turns: number;
    endAngle: number;
    port: Vec3;
    approach: Vec3;
  },
  /** Drift: the coil body swings around the prism; its approach re-forms to the fixed port. */
  swing = 0,
): (t: number) => Vec3 {
  const coil = (u: number): Vec3 => {
    const angle = o.endAngle + (u - 1) * o.turns * Math.PI * 2;
    return swingAboutPrism(
      {
        x: o.center.x + o.rx * Math.cos(angle),
        y: o.center.y - o.drop * u,
        z: o.center.z + o.rz * Math.sin(angle),
      },
      swing,
    );
  };
  const end = coil(1);
  const tangent = swingAboutPrism(
    {
      x: -o.rx * Math.sin(o.endAngle) * o.turns * Math.PI * 2,
      y: -o.drop,
      z: o.rz * Math.cos(o.endAngle) * o.turns * Math.PI * 2,
    },
    swing,
  );
  const length = Math.hypot(tangent.x, tangent.y, tangent.z);
  const transfer = arcSample([
    [
      end,
      {
        x: end.x + (tangent.x / length) * 5,
        y: end.y + (tangent.y / length) * 5,
        z: end.z + (tangent.z / length) * 5,
      },
      o.approach,
      o.port,
    ],
  ]);
  return (t) => (t <= 0.75 ? coil(t / 0.75) : transfer((t - 0.75) / 0.25));
}

/** The third coil winds around a horizontal axis. Its near-west quarter can borrow
 * existing coverage, while its northern entrance and roofward exit need new lines.
 */
function frontierCrossCoil(t: number): Vec3 {
  return frontierCrossCoilSwung(0)(t);
}

function frontierCrossCoilSwung(swing: number): (t: number) => Vec3 {
  const coil = (u: number): Vec3 => {
    const angle = (u - 1) * 1.15 * Math.PI * 2;
    return swingAboutPrism(
      { x: -4 + 14 * Math.cos(angle), y: 29 + 7 * Math.sin(angle), z: -30 + 20 * u },
      swing,
    );
  };
  const end = coil(1);
  const length = Math.hypot(7 * 1.15 * Math.PI * 2, 20);
  const lead = swingAboutPrism(
    { x: 0, y: ((7 * 1.15 * Math.PI * 2) / length) * 5, z: (20 / length) * 5 },
    swing,
  );
  const transfer = arcSample([
    [
      end,
      swing === 0
        ? { x: end.x, y: end.y + ((7 * 1.15 * Math.PI * 2) / length) * 5, z: end.z + (20 / length) * 5 }
        : { x: end.x + lead.x, y: end.y + lead.y, z: end.z + lead.z },
      { x: 0, y: 18, z: -11 },
      { x: 0, y: 16, z: -6 },
    ],
  ]);
  return (t) => (t <= 0.75 ? coil(t / 0.75) : transfer((t - 0.75) / 0.25));
}

const frontierVolume = { center: { x: 0, y: 10, z: 0 }, size: { x: 16, y: 16, z: 12 } };
const frontierHangar = lookingAt({ x: -13, y: 31, z: -24 }, { x: -24, y: 32, z: -11 });
const westSpindle = {
  center: { x: -27, y: 36, z: -3 },
  rx: 11,
  rz: 11,
  drop: 22,
  turns: 1.2,
  endAngle: 0,
  port: { x: -8, y: 8, z: -3 },
  approach: { x: -13, y: 8, z: -3 },
};
const eastReturn = {
  center: { x: 27, y: 39, z: 4 },
  rx: 10,
  rz: 10,
  drop: 22,
  turns: -1.25,
  endAngle: Math.PI,
  port: { x: 8, y: 12, z: 2 },
  approach: { x: 13, y: 12, z: 2 },
};
const frontierPaths = [
  buildPath("west-spindle", frontierCoil(westSpindle), 480),
  buildPath("east-return", frontierCoil(eastReturn), 480),
  buildPath("north-vault", frontierCrossCoil, 480),
];
/** The same three routes after a cumulative swing around the prism (degrees). */
export function frontierDriftPath(pathIndex: number, swingDegrees: number): PathCurve {
  if (swingDegrees === 0) return frontierPaths[pathIndex]!;
  const swing = (swingDegrees * Math.PI) / 180;
  const id = frontierPaths[pathIndex]!.id;
  if (pathIndex === 0) return buildPath(id, frontierCoil(westSpindle, swing), 480);
  if (pathIndex === 1) return buildPath(id, frontierCoil(eastReturn, swing), 480);
  return buildPath(id, frontierCrossCoilSwung(swing), 480);
}

/** A finite first study of route expansion, not a claim of endless balance. */
export const FRONTIER_INDEX = LEVELS.length;
LEVELS.push({
  id: "helix-frontier",
  name: "Helix Frontier",
  experiment: true,
  prototype: "route-expansion",
  subtitle: "Three frontiers · 9-wave spatial prototype",
  blurb:
    "Defend separate ports of a protected prism. Two opposite spindles give way to a high crosswise coil: keep old lines useful while finding the next gap.",
  briefing:
    "A opens in the west; B opens across the prism in wave 3; the horizontal North Vault C opens in wave 6. All opened routes remain in use. The holographic enclosure marks separate breach ports, not a solid wall. This nine-wave prototype studies the space before survival balance. Unlimited setup, independent prices and free setup reposition remain available.",
  hangar: frontierHangar,
  accent: 0x91c8a8,
  stasisAvailable: true,
  fleetGrowth: "scrap",
  droneRoster: "expanded",
  dronePricing: "per-type",
  presentation: "protected-prism",
  protectedVolume: frontierVolume,
  startingScrap: 60,
  hpMul: 1,
  speedMul: 0.9,
  paths: frontierPaths,
  waves: [
    {
      chapter: "01 · West spindle",
      lesson:
        "Only A is open. Begin with a long line on its descending coil; its breach port is on the west face of the prism.",
      groups: [g("shard", 0, 6, 1.8, 1)],
    },
    {
      chapter: "02 · Hold the west",
      lesson:
        "Keep a useful west line. B opens on the opposite side next wave: save room to extend your defense.",
      groups: [g("shard", 0, 7, 1.5, 1), g("barge", 0, 2, 3, 4)],
    },
    {
      chapter: "03 · East return",
      lesson:
        "B opens higher on the opposite side. The west still needs its defense; build a new eastern line or move a redundant drone during setup.",
      groups: [g("shard", 1, 6, 1.6, 1), g("shard", 0, 5, 1.7, 4)],
    },
    {
      chapter: "04 · Opposite winding",
      lesson:
        "The east winds the other way. Compare a broad slice across both districts with dedicated contact on each coil.",
      groups: [g("barge", 0, 3, 2.7, 1), g("shard", 1, 7, 1.5, 3), g("wisp", 0, 3, 1.9, 7)],
    },
    {
      chapter: "05 · Two ports",
      lesson:
        "Both ports need coverage. The high horizontal North Vault opens next: inspect where its western arc passes near your existing lines.",
      groups: [g("barge", 1, 3, 2.5, 1), g("shard", 0, 7, 1.4, 3), g("wisp", 1, 4, 1.7, 7)],
    },
    {
      chapter: "06 · North vault",
      lesson:
        "C opens around a horizontal axis above the north face. Part of it can borrow west coverage, but its entrance and roofward approach need a new line.",
      groups: [g("shard", 2, 7, 1.6, 1), g("barge", 0, 2, 2.8, 3), g("shard", 1, 5, 1.5, 6)],
    },
    {
      chapter: "07 · Three frontiers",
      lesson:
        "Keep the older defenses working. Follow the North Vault through its full turn: a screen crossing does not guarantee contact at the same height.",
      groups: [
        g("barge", 2, 3, 2.5, 1),
        g("shard", 0, 6, 1.4, 3),
        g("wisp", 1, 4, 1.6, 5),
        g("shard", 2, 4, 1.4, 9),
      ],
    },
    {
      chapter: "08 · Western weight",
      lesson:
        "The west convoy is heavier while both newer routes send escorts. Reposition only the lines you can spare; each port remains independent.",
      groups: [g("barge", 0, 4, 2.2, 1), g("shard", 1, 6, 1.4, 3), g("wisp", 2, 5, 1.6, 5)],
    },
    {
      chapter: "09 · All ports held",
      lesson:
        "The final trial shifts the convoy to the North Vault. Hold all three ports. This is the end of the authored spatial prototype, not an endless difficulty ramp.",
      groups: [
        g("barge", 2, 4, 2.3, 1),
        g("barge", 1, 3, 2.5, 3),
        g("shard", 0, 7, 1.4, 5),
        g("wisp", 1, 4, 1.6, 9),
      ],
    },
  ],
});

export const RELAY_LAB_INDEX = LEVELS.length;
LEVELS.push({
  id: "relay-lab",
  name: "Relay Lab",
  experiment: true,
  prototype: "relay",
  subtitle: "Slowing light + one turn · 4-wave experiment",
  blurb:
    "One slowing-light emitter and an aimed relay turn a fixed line. Find a clear incoming connection, then redirect its remaining reach between the two coils.",
  briefing:
    "Place one Lumen emitter, then fly into its line and aim a Relay. It redirects the remaining beam range once, along the direction you chose. An earlier enemy can block the connection. Reposition or re-aim individual drones freely during setup; Fan and Slide can move a live link apart. Stasis and Pin remain available for comparison. This is a separate four-wave lab, not a Crown balance change.",
  hangar: frontierHangar,
  accent: 0xc9b8ff,
  stasisAvailable: true,
  fleetGrowth: "scrap",
  droneRoster: "expanded",
  dronePricing: "per-type",
  presentation: "protected-prism",
  protectedVolume: frontierVolume,
  startingScrap: 100,
  hpMul: 0.9,
  speedMul: 0.8,
  paths: frontierPaths.slice(0, 2),
  waves: [
    {
      chapter: "01 · Incoming light",
      lesson:
        "A is open. Start with damage coverage, then place a slowing-light emitter and one aimed relay. Check that the incoming beam really reaches the receiver.",
      groups: [g("shard", 0, 5, 2.2, 1)],
    },
    {
      chapter: "02 · Redirect east",
      lesson:
        "Only B sends traffic this wave. Try a free setup reposition to turn a relay toward the east, keeping its incoming connection clear.",
      groups: [g("shard", 1, 6, 2, 1), g("barge", 1, 1, 3, 5)],
    },
    {
      chapter: "03 · Shared attention",
      lesson:
        "Both gates send escorts. A target before the relay can block its outgoing light: compare the potential line with the powered segment.",
      groups: [g("shard", 0, 5, 1.8, 1), g("shard", 1, 5, 1.8, 3), g("wisp", 1, 2, 2.2, 8)],
    },
    {
      chapter: "04 · Two convoys",
      lesson:
        "Choose which convoy needs the redirected slow. Other weapons still supply the damage; Stasis remains a passive comparison.",
      groups: [g("barge", 0, 3, 2.8, 1), g("barge", 1, 3, 2.8, 4), g("shard", 0, 4, 1.8, 7)],
    },
  ],
});

/**
 * Drift Frontier: the same three coils, but between waves an authored route swings
 * around the prism. Lines on a moved coil lose contact; free setup repositioning is the
 * answer. Difficulty comes from a changing placement problem, not only from hull.
 * Swings stay inside each route's measured legal range (no early prism entry, in bounds).
 */
export const DRIFT_INDEX = LEVELS.length;
LEVELS.push({
  id: "drift-frontier",
  name: "Drift Frontier",
  experiment: true,
  prototype: "route-expansion",
  subtitle: "Coils that move · 12-wave late-game prototype",
  blurb:
    "Helix Frontier's three coils, but they swing around the prism between waves. Re-fly the lines a swing breaks while the waves grow heavier.",
  briefing:
    "A opens first, B on wave 3, C on wave 6. From wave 4 an announced coil swings around the prism before each wave; your drones stay put, so lines on that coil lose contact. Survey shows each swing and your lost contact; reposition is free during setup. Twelve escalating waves end with all three convoys. Tripwire (6) is available. No campaign score is recorded.",
  hangar: frontierHangar,
  accent: 0xe6b86a,
  stasisAvailable: true,
  fleetGrowth: "scrap",
  droneRoster: "expanded",
  dronePricing: "per-type",
  presentation: "protected-prism",
  protectedVolume: frontierVolume,
  startingScrap: 60,
  // Tuned with qa/drift-trial.mjs: waves 8–12 carry twice their listed escalation.
  hpMul: 1.15,
  speedMul: 0.9,
  paths: frontierPaths,
  driftPath: frontierDriftPath,
  waves: [
    {
      chapter: "01 · West spindle",
      lesson: "Only A is open. Build a first line; from wave 4 coils will start to swing between waves.",
      groups: [g("shard", 0, 7, 1.6, 1)],
    },
    {
      chapter: "02 · Hold the west",
      lesson: "Barges join A. B opens next wave on the far side of the prism.",
      groups: [g("shard", 0, 8, 1.4, 1), g("barge", 0, 2, 3, 4)],
    },
    {
      chapter: "03 · East return",
      lesson: "B opens. Extend east; the west keeps its traffic.",
      groups: [g("shard", 1, 7, 1.5, 1), g("shard", 0, 6, 1.5, 4), g("wisp", 0, 2, 1.8, 8)],
    },
    {
      chapter: "04 · First swing",
      lesson:
        "A swung 45° south around the prism. Check which west lines still touch it and re-fly the rest.",
      drift: [{ path: 0, degrees: 45 }],
      groups: [g("barge", 0, 3, 2.6, 1), g("shard", 1, 8, 1.4, 3), g("wisp", 0, 3, 1.8, 7)],
    },
    {
      chapter: "05 · East swings north",
      lesson: "B swung 45° north. A stays where it moved. Two coils out of their first places.",
      drift: [{ path: 1, degrees: 45 }],
      groups: [g("barge", 1, 3, 2.5, 1), g("shard", 0, 8, 1.3, 3), g("wisp", 1, 4, 1.7, 7)],
    },
    {
      chapter: "06 · North vault",
      lesson: "C opens above the north face. No swing this wave: build its first line.",
      groups: [g("shard", 2, 8, 1.5, 1), g("barge", 0, 3, 2.6, 3), g("shard", 1, 6, 1.4, 6)],
    },
    {
      chapter: "07 · The vault slides east",
      lesson: "C swung 45° east toward B. Some eastern lines may now reach it.",
      drift: [{ path: 2, degrees: -45 }],
      groups: [
        g("barge", 2, 3, 2.4, 1),
        g("shard", 0, 7, 1.3, 3, 1, 1.2),
        g("wisp", 1, 5, 1.6, 5),
        g("shard", 2, 5, 1.3, 9),
      ],
    },
    {
      chapter: "08 · West swings north",
      lesson: "A swung 90° the other way, past home and into the north. Heavier west convoy.",
      drift: [{ path: 0, degrees: -90 }],
      groups: [
        g("barge", 0, 5, 2.2, 1, 1, 2.6),
        g("shard", 1, 8, 1.3, 3, 1, 2.4),
        g("wisp", 2, 5, 1.5, 6, 1, 2),
      ],
    },
    {
      chapter: "09 · East swings farther",
      lesson: "B swung another 30° north. Barges on B and C.",
      drift: [{ path: 1, degrees: 30 }],
      groups: [
        g("barge", 1, 4, 2.2, 1, 1, 2.8),
        g("barge", 2, 3, 2.4, 4, 1, 2.6),
        g("shard", 0, 9, 1.2, 6, 1, 2.4),
        g("wisp", 1, 4, 1.5, 10, 1, 2),
      ],
    },
    {
      chapter: "10 · Vault swings west",
      lesson: "C swung 90° west. Fast Wisps on A: a Tripwire across them pays per crossing.",
      drift: [{ path: 2, degrees: 90 }],
      groups: [
        g("barge", 2, 5, 2.1, 1, 1, 3),
        g("wisp", 0, 7, 1.3, 3, 1, 2.4),
        g("shard", 1, 10, 1.1, 6, 1, 2.6),
      ],
    },
    {
      chapter: "11 · Twin return",
      lesson:
        "A and B both swing back to their first places. Old lines may work again; heavy convoys on both.",
      drift: [
        { path: 0, degrees: 45 },
        { path: 1, degrees: -75 },
      ],
      groups: [
        g("barge", 0, 5, 2, 1, 1, 3.2),
        g("barge", 1, 5, 2, 3, 1, 3.2),
        g("shard", 2, 10, 1.1, 5, 1, 2.6),
        g("wisp", 0, 6, 1.3, 9, 1, 2.4),
      ],
    },
    {
      chapter: "12 · Every frontier",
      lesson: "C swings home. All three convoys at once, then late bursts. Hold every port.",
      drift: [{ path: 2, degrees: -45 }],
      groups: [
        g("barge", 0, 6, 2, 1, 1, 3.6),
        g("barge", 1, 6, 2, 2, 1, 3.6),
        g("barge", 2, 6, 2, 3, 1, 3.6),
        g("shard", 0, 8, 1, 12, 1, 2.8),
        g("shard", 1, 8, 1, 14, 1, 2.8),
        g("wisp", 2, 8, 1.2, 16, 1, 2.6),
      ],
    },
  ],
});
