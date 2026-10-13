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
  presentation?: "split-crown";
  primaryPath?: number;
  sweepDps?: number;
  hpMul: number;
  speedMul: number;
  paths: PathCurve[];
  waves: WaveSpec[];
  /** Authored extra waves, offered only after the ordinary arena clear is recorded. */
  continuation?: WaveSpec[];
};

export type Kind = "shard" | "barge" | "wisp" | "carrier";

export type WaveSpec = {
  chapter?: string;
  lesson?: string;
  groups: {
    kind: Kind;
    path: number;
    count: number;
    interval: number;
    delay: number;
    /** Local route pacing, multiplied by the arena and enemy-kind speeds. */
    speedMul?: number;
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
    { x: -20, y: 21, z: -10 }, { x: -12, y: 21, z: -12 },
    { x: 7, y: 20, z: -14 }, { x: 13, y: 17, z: -8 },
  ],
  [
    { x: 13, y: 17, z: -8 }, { x: 19, y: 14, z: -2 },
    { x: 15, y: 10, z: 14 }, { x: 3, y: 8, z: 15 },
  ],
  [
    { x: 3, y: 8, z: 15 }, { x: -9, y: 6, z: 16 },
    { x: -15, y: 5, z: 5 }, { x: -9, y: 4.8, z: -1 },
  ],
  [
    { x: -9, y: 4.8, z: -1 }, { x: -6, y: 4.7, z: -4 },
    { x: -1, y: 4.4, z: -3 }, CORE,
  ],
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
  rx: number; rz: number; height: number; tiltX: number; tiltZ: number; phase: number;
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
  const transfer = arcSample([[
    end,
    { x: end.x + tangent.x / length * 5, y: end.y + tangent.y / length * 5, z: end.z + tangent.z / length * 5 },
    { x: end.x * 0.15, y: 6.2, z: end.z * 0.15 },
    CORE,
  ]]);
  return (t) => t <= arcFraction
    ? ring(o.phase + t / arcFraction * sweep)
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
) => ({ kind, path, count, interval, delay, speedMul });

export const LEVELS: LevelDef[] = [
  {
    id: "tutorial",
    name: "Flight School",
    blurb: "Two short lessons: hold one curling lane, then divide your defense between two.",
    subtitle: "Glass Needle → Twin Ribbon · 5 waves",
    briefing: "The first two waves follow the high curl. Then a lower coil opens: leave your first line working and build a second. Aim along a ribbon for sustained coverage.",
    hangar: firstHangar,
    accent: 0x2ee6c7,
    hpMul: 0.9,
    speedMul: 0.86,
    paths: [
      buildPath("main", compactCurl, 240),
      buildPath("inner", helixSample({ radius: 10.6, turns: 1.02, y0: 15, y1: 6, phase: 3.65 }), 200),
    ],
    waves: [
      { chapter: "Glass Needle", lesson: "Find a long line along the high curl. Anchor a drone to keep it firing.", groups: [g("shard", 0, 5, 2.1, 0.65)] },
      { chapter: "Glass Needle", lesson: "Barges need sustained fire. Reinforce a useful angle or improve a short crossing.", groups: [g("shard", 0, 6, 1.5, 0.65), g("barge", 0, 1, 3.4, 3.8)] },
      { chapter: "Twin Ribbon", lesson: "The lower coil is open. Keep your first line and add coverage for the second gate.", groups: [g("shard", 1, 4, 2, 0.65), g("barge", 0, 2, 3.5, 2.5)] },
      { chapter: "Twin Ribbon", lesson: "Wisps weave off the ribbon. Compare a wider Sweep with an overlapping Pierce line.", groups: [g("wisp", 1, 3, 1.8, 0.65), g("shard", 0, 5, 1.5, 1.5), g("barge", 1, 1, 3.5, 4)] },
      { chapter: "Twin Ribbon", lesson: "Hold both gates. Recall a weak placement or fan the lattice to cover a gap.", groups: [g("shard", 1, 5, 1.5, 0.65), g("barge", 0, 3, 3, 1.5), g("wisp", 0, 3, 1.6, 2.5)] },
    ],
  },
  {
    id: "shear",
    name: "Shear Lane",
    blurb: "A dive, a coil, and a crossing loop. Different heights demand different lines.",
    subtitle: "Three gates · 5 + 3 optional waves",
    briefing: "The compact dive now gives you time to react. The wide figure-eight crosses itself at different heights: fan or slide your lattice between the lanes, and leave room for weaving wisps.",
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
      { lesson: "Establish a line on the compact dive before the other gates open.", groups: [g("shard", 0, 6, 1.45, 0.65, 0.55)] },
      { lesson: "Watch the heights: the wide loop crosses above itself.", groups: [g("barge", 1, 3, 2.9, 0.65), g("wisp", 2, 4, 1.7, 1.3)] },
      { groups: [g("shard", 0, 6, 1.2, 0.65, 0.55), g("barge", 2, 3, 2.7, 1.5)] },
      { groups: [g("wisp", 2, 6, 1.4, 0.65), g("shard", 0, 5, 1.15, 1.1, 0.55), g("barge", 1, 3, 2.7, 2)] },
      { groups: [g("shard", 0, 7, 1, 0.65, 0.55), g("wisp", 2, 5, 1.3, 1.1), g("barge", 2, 3, 2.5, 1.8), g("barge", 1, 2, 2.9, 3.2)] },
    ],
    continuation: [
      { chapter: "06 · Changing lanes", lesson: "Wisps take the middle coil while Shards circle the wide loop. A delayed dive burst arrives after both gates are busy.", groups: [g("wisp", 1, 6, 1.3, 0.65), g("shard", 2, 6, 1.1, 1.2), g("shard", 0, 6, 1.15, 7.5, 0.55)] },
      { chapter: "07 · Heavy descent", lesson: "Barges now use the compact dive as well as the middle coil. Give these short approaches sustained fire; wide-loop Wisps are the diversion.", groups: [g("barge", 0, 4, 2.1, 0.65, 0.55), g("barge", 1, 4, 2.1, 2.5), g("wisp", 2, 7, 1.25, 0.8)] },
      { chapter: "08 · Three-way hold", lesson: "The wide convoy comes first. Dive traffic follows, then a second push takes the middle coil. Hold broad coverage without abandoning the short route.", groups: [g("barge", 2, 4, 2, 0.65), g("wisp", 2, 5, 1.25, 1.4), g("shard", 0, 8, 1.1, 5.5, 0.55), g("shard", 1, 7, 1.1, 9), g("barge", 1, 3, 2.3, 10.5)] },
    ],
  },
  {
    id: "orbital",
    archived: true,
    name: "Orbital Garden",
    blurb: "Two tilted rings orbit the core. Find shared lines, then cover their inward exits.",
    subtitle: "Two tilted rings · 5 + 3 optional waves",
    briefing: "Enemies travel most of an ellipse before turning inward to the core. The rings tilt in opposite directions: align a beam through useful stretches, or guard their inward approaches.",
    hangar: lookingAt({ x: -3, y: 22, z: 23 }, { x: -7.5, y: 17.6, z: 10.2 }),
    accent: 0x87bfff,
    hpMul: 1.06,
    speedMul: 0.94,
    paths: [
      buildPath("inner-orbit", orbitalSample({ rx: 16, rz: 12, height: 16, tiltX: 6, tiltZ: 5, phase: 2 }), 220),
      buildPath("outer-orbit", orbitalSample({ rx: 23, rz: 18, height: 19, tiltX: -10, tiltZ: 2, phase: 2.55 }), 240),
    ],
    waves: [
      { lesson: "Follow the inner ring to its inward exit. A beam can cover more than one arc.", groups: [g("shard", 0, 6, 1.8, 0.65)] },
      { lesson: "The outer ring is active. Its tilt changes which lines can reach both routes.", groups: [g("barge", 1, 2, 3.2, 0.65), g("wisp", 0, 3, 1.9, 2)] },
      { groups: [g("shard", 1, 5, 1.6, 0.65), g("barge", 0, 2, 3.2, 2)] },
      { groups: [g("wisp", 1, 5, 1.6, 0.65), g("shard", 0, 5, 1.4, 1.5), g("barge", 1, 2, 3, 3)] },
      { groups: [g("shard", 0, 6, 1.25, 0.65), g("wisp", 1, 5, 1.5, 1.3), g("barge", 0, 2, 2.8, 2.2), g("barge", 1, 2, 3, 3.5)] },
    ],
    continuation: [
      { chapter: "06 · Ring exchange", lesson: "The inner gate opens first, then the outer answers. Drifting escorts follow each burst: check both inward exits before committing the lattice.", groups: [g("shard", 0, 6, 1.1, 0.65), g("wisp", 0, 4, 1.6, 3.5), g("shard", 1, 6, 1.1, 6.5), g("wisp", 1, 4, 1.6, 9.5)] },
      { chapter: "07 · Twin convoys", lesson: "Armored convoys travel both rings together. Wide-loop Wisps test the edge of your coverage while Barges need long contact on the inward approaches.", groups: [g("barge", 1, 5, 2.2, 0.65), g("barge", 0, 5, 2.2, 2.5), g("wisp", 1, 8, 1.25, 3)] },
      { chapter: "08 · Crossing orbits", lesson: "Both gates send mixed traffic, then late Wisps follow the convoys. Keep the shared lines working and use a dedicated line where an inward exit is exposed.", groups: [g("shard", 0, 8, 1.05, 0.65), g("shard", 1, 8, 1.05, 2.5), g("barge", 0, 4, 2, 3), g("barge", 1, 4, 2, 4.5), g("wisp", 0, 3, 1.4, 10.5), g("wisp", 1, 3, 1.4, 12)] },
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
  id: "carrier-test", name: "Carrier Test Flight", experiment: true, primaryPath: 2, sweepDps: 22,
  subtitle: "Stasis + carrier · 3 waves · optional",
  blurb: "Build a lattice, slow a real crossing, then hold the carrier route.",
  briefing: "A three-wave experiment on Shear. Stasis slows foes to half speed inside a 6m-radius sphere for no damage; overlapping fields do not stack. Sweep tries 22 DPS here. The final carrier follows the wide figure-eight; a breach costs 40 core. Campaign records stay separate.",
  waves: [
    { chapter: "01 · Establish", lesson: "Start with damage: two drones are funded. The dive opens first. The carrier will use the wide figure-eight in wave 3.", groups: [g("shard", 0, 6, 1.65, 0.8, 0.55)] },
    { chapter: "02 · Crossings", lesson: "Try Stasis where routes meet in 3D. Its amber highlight marks time gained, not damage. Keep enough firing lines to stop these escorts.", groups: [g("shard", 2, 6, 1.6, 0.8), g("barge", 1, 2, 3.5, 2), g("wisp", 2, 3, 1.9, 4)] },
    { chapter: "03 · Carrier approach", lesson: "Carrier inbound on the wide figure-eight: 486 hull, 40 core on breach. Hold a long firing line there while escorts use the dive and middle coil.", groups: [g("carrier", 2, 1, 1, 1.5), g("shard", 0, 6, 1.8, 2.5, 0.55), g("barge", 1, 2, 3.5, 4), g("wisp", 1, 3, 2, 6)] },
  ],
});


/** Offset helix followed by a tangent-aligned transfer to the existing core. */
function crownHelix(o: {
  cx: number; cz: number; radius: number; y0: number; y1: number;
  turns: number; endAngle: number; transfer: Vec3;
}): (t: number) => Vec3 {
  const helix = (t: number): Vec3 => {
    const a = o.endAngle + (t - 1) * o.turns * Math.PI * 2;
    return { x: o.cx + o.radius * Math.cos(a), y: o.y0 + (o.y1 - o.y0) * t, z: o.cz + o.radius * Math.sin(a) };
  };
  const end = helix(1);
  const tangent = {
    x: -o.radius * Math.sin(o.endAngle) * o.turns * Math.PI * 2,
    y: o.y1 - o.y0,
    z: o.radius * Math.cos(o.endAngle) * o.turns * Math.PI * 2,
  };
  const length = Math.hypot(tangent.x, tangent.y, tangent.z);
  const transfer = arcSample([[
    end,
    { x: end.x + tangent.x / length * 5, y: end.y + tangent.y / length * 5, z: end.z + tangent.z / length * 5 },
    o.transfer,
    CORE,
  ]]);
  // An exact sample at the join keeps the two pieces connected in the polyline.
  return (t) => t <= 0.75 ? helix(t / 0.75) : transfer((t - 0.75) / 0.25);
}

/** Cubic interpolating chain with one shared tangent per join (C1 in segment time). */
function crownTransfer(points: Vec3[]): (t: number) => Vec3 {
  const tangents = points.map((p, i): Vec3 => {
    const before = points[Math.max(0, i - 1)]!;
    const after = points[Math.min(points.length - 1, i + 1)]!;
    const scale = i === 0 || i === points.length - 1 ? 1 : 0.5;
    return { x: (after.x - before.x) * scale, y: (after.y - before.y) * scale, z: (after.z - before.z) * scale };
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
  subtitle: "Two crowns · 4 gates + carrier route · 8 waves",
  blurb: "Build across two distant helix districts. A final carrier visits both crowns: keep shared slices working while you hold dedicated lines.",
  briefing: "Start on the west crown, then build toward the east as four gates open. Stasis is available alongside Pierce and Sweep. Route E is reserved for the final carrier: it visits both crowns and their lower approaches. Eight waves. Plan & launch gives unlimited setup; reposition drones for free between waves.",
  hangar: lookingAt({ x: -9, y: 28, z: -20 }, { x: -14.24097, y: 37, z: -13.3037 }),
  accent: 0xe8c58b,
  stasisAvailable: true,
  presentation: "split-crown",
  primaryPath: 4,
  hpMul: 1.08,
  speedMul: 0.96,
  paths: [
    buildPath("west-crown", crownHelix({ cx: -21, cz: -4, radius: 11.5, y0: 37, y1: 19, turns: 1.15, endAngle: 0, transfer: { x: -4, y: 8, z: -10 } }), 480),
    buildPath("west-coil", crownHelix({ cx: -21, cz: -4, radius: 8.5, y0: 29, y1: 12, turns: -1.1, endAngle: 0, transfer: { x: -9, y: 6, z: 4 } }), 480),
    buildPath("east-crown", crownHelix({ cx: 21, cz: 4, radius: 11.5, y0: 35, y1: 17, turns: -1.15, endAngle: Math.PI, transfer: { x: 4, y: 8, z: 10 } }), 480),
    buildPath("east-coil", crownHelix({ cx: 21, cz: 4, radius: 8.5, y0: 27, y1: 10, turns: 1.1, endAngle: Math.PI, transfer: { x: 9, y: 6, z: -4 } }), 480),
    buildPath("crown-transfer", crownTransfer([
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
    ]), 720),
  ],
  waves: [
    { chapter: "01 · West crown", lesson: "Begin with a long line on A. Two damage drones are funded. Carrier route E is visible now but will not open until wave 8.", groups: [g("shard", 0, 6, 1.8, 1)] },
    { chapter: "02 · A local pair", lesson: "B opens below A. Find a shared chord through the west pair, or give each route its own sustained line.", groups: [g("shard", 1, 5, 1.65, 1), g("shard", 0, 4, 1.5, 3), g("barge", 0, 1, 3, 5)] },
    { chapter: "03 · Across the divide", lesson: "C opens in the east. Use earned scrap or reposition a redundant west drone. One Stasis field cannot bridge both distant districts.", groups: [g("shard", 2, 6, 1.5, 1), g("barge", 0, 2, 2.8, 3), g("wisp", 1, 3, 1.8, 6)] },
    { chapter: "04 · Twin convoys", lesson: "Barges travel both crowns. A short shared slice may need a dedicated line beside it; watch Sweep's nearest target during crowded contact.", groups: [g("barge", 0, 3, 2.5, 1), g("barge", 2, 3, 2.5, 5), g("shard", 1, 5, 1.35, 3), g("wisp", 2, 3, 1.65, 9)] },
    { chapter: "05 · The lower east", lesson: "D completes the east pair. Keep coverage high while adding a lower approach; setup repositioning preserves each drone and its paid value.", groups: [g("shard", 3, 6, 1.35, 1), g("wisp", 0, 4, 1.5, 3), g("barge", 2, 3, 2.5, 5), g("shard", 1, 4, 1.3, 10)] },
    { chapter: "06 · Low pressure", lesson: "Heavy traffic moves to the lower coils. Compare a useful local Stasis field with the damage line that would occupy its slot.", groups: [g("barge", 1, 4, 2.25, 1), g("barge", 3, 4, 2.25, 4), g("wisp", 0, 5, 1.4, 6), g("shard", 2, 6, 1.2, 10)] },
    { chapter: "07 · Crown exchange", lesson: "Convoys split between the crowns while lower escorts arrive later. Prepare a final line for E: the carrier will visit both districts next wave.", groups: [g("barge", 0, 3, 2.2, 1), g("barge", 2, 3, 2.2, 4), g("wisp", 1, 6, 1.3, 6), g("shard", 3, 6, 1.2, 10), g("shard", 0, 4, 1.2, 15)] },
    { chapter: "08 · The crown carrier", lesson: "Carrier inbound on E: 486 hull, 40 core on breach. It crosses both local defense neighborhoods before turning through the lower approaches. Escorts keep all four gates relevant.", groups: [g("carrier", 4, 1, 1, 1.5), g("barge", 0, 4, 2.3, 3), g("shard", 1, 7, 1.2, 6), g("wisp", 2, 5, 1.4, 9), g("barge", 3, 4, 2.2, 14), g("wisp", 0, 4, 1.4, 23)] },
  ],
});
