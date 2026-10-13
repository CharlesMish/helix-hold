import { clamp, forwardOf, hypot3, type Vec3 } from "./math";
import { beamContact, DRONE_SPECS, insideStasis, STASIS_SPEED_SCALE, selectBeamTargets, type Beam, type DroneMode } from "./combat";
import {
  CORE,
  HANGAR,
  HANGAR_PITCH,
  HANGAR_YAW,
  LEVELS,
  type Kind,
  type LevelDef,
  type PathCurve,
} from "./paths";
import { recordWin, type SaveData } from "./save";

/**
 * Chase-cam gunship.
 * forward = (-sin(yaw) cos(pitch), sin(pitch), -cos(yaw) cos(pitch))
 * KeyA → steer +1 → yaw increases → nose left on the chase cam.
 * Do not flip this sign.
 */

export const MAX_DRONES = 8;
export const BEAM_RANGE = 76;
export const SHIP_DPS = 34;
export const SHIP_RADIUS = 2.05;
export const DRONE_DPS = DRONE_SPECS.pierce.dps;
export const DRONE_RADIUS = DRONE_SPECS.pierce.radius;
const ARENA_R = 52;
const YAW_RATE = 1.7;
const PITCH_RATE = 1.4;
const EXPAND_DIST = 5.4;
const FAN = 0.3;
const SHIFT_DIST = 7.2;

const KINDS: Record<
  Kind,
  { hp: number; speed: number; radius: number; reward: number; leak: number; amp: number }
> = {
  shard: { hp: 28, speed: 10.4, radius: 0.72, reward: 8, leak: 7, amp: 0 },
  barge: { hp: 96, speed: 6.0, radius: 1.25, reward: 18, leak: 14, amp: 0 },
  carrier: { hp: 450, speed: 4.2, radius: 2.2, reward: 60, leak: 40, amp: 0 },
  wisp: { hp: 40, speed: 8.2, radius: 0.64, reward: 12, leak: 9, amp: 2.25 },
};

export type Phase = "title" | "play" | "pause" | "win" | "lose";
export type WaveMode = "manual" | "auto";

export type InputState = {
  thrust: number;
  steer: number;
  pitch: number;
  boost: boolean;
  anchor: boolean;
  expand: boolean;
  shift: number;
};

export type Enemy = {
  alive: boolean;
  kind: Kind;
  pathIndex: number;
  dist: number;
  hp: number;
  maxHp: number;
  speed: number;
  /** Current field multiplier; speed itself always remains the unmodified base speed. */
  speedScale: number;
  /** Count an enemy once when any anchored field has actually slowed it. */
  stasisSeen: boolean;
  radius: number;
  reward: number;
  leak: number;
  amp: number;
  phase: number;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  hit: boolean;
};

export type Drone = {
  id: number;
  mode: DroneMode;
  /** Only the optional encounter overrides Sweep; campaign specs remain stable. */
  dps?: number;
  paid: number;
  kills: number;
  damage: number;
  hit: boolean;
  bx: number;
  by: number;
  bz: number;
  fx: number;
  fy: number;
  fz: number;
  x: number;
  y: number;
  z: number;
  ax: number;
  ay: number;
  az: number;
};

export type FxEvent =
  | { type: "hit"; x: number; y: number; z: number }
  | { type: "kill"; x: number; y: number; z: number }
  | { type: "anchor"; x: number; y: number; z: number }
  | { type: "leak" };

type Group = {
  kind: Kind;
  path: number;
  count: number;
  interval: number;
  delay: number;
  speedMul?: number;
  hpMul?: number;
  spawned: number;
};

type FieldCheckState = {
  enemies: Enemy[];
  stasisTouched: number;
  stasisExposure: number;
  randomState: number;
  hint: string;
  banner: string;
};

export type Run = {
  levelIndex: number;
  level: LevelDef;
  paths: PathCurve[];
  phase: Phase;
  ship: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    yaw: number;
    pitch: number;
    roll: number;
    yawRate: number;
    pitchRate: number;
  };
  aimx: number;
  aimy: number;
  aimz: number;
  speed: number;
  thrustVisual: number;
  drones: Drone[];
  droneMode: DroneMode;
  nextDroneId: number;
  selectedDroneId: number | null;
  repositionId: number | null;
  continued: boolean;
  fieldCheck: FieldCheckState | null;
  stasisTouched: number;
  stasisExposure: number;
  enemies: Enemy[];
  waves: { groups: Group[]; chapter?: string; lesson?: string }[];
  waveIndex: number;
  waveTime: number;
  waveMode: WaveMode;
  carrierOutcome: "pending" | "destroyed" | "breached";
  rest: number;
  scrap: number;
  core: number;
  kills: number;
  expand: number;
  shift: number;
  time: number;
  hint: string;
  banner: string;
  shipHitting: boolean;
  wasHitting: boolean;
  notedWisp: boolean;
  randomState: number;
  lastBreach: { pathIndex: number; at: number } | null;
  fx: FxEvent[];
  fxCooldown: number;
  anchorFlash: number;
  shake: number;
  levelId: string;
  onPhase?: (phase: Phase, run: Run) => void;
  save?: SaveData;
};

export function anchorCost(droneCount: number): number {
  return 20 + droneCount * 12;
}

/** Only arenas authored for scrap-funded growth omit the ordinary fleet limit. */
export function getDroneLimit(level: LevelDef): number {
  return level.fleetGrowth === "scrap" ? Infinity : MAX_DRONES;
}

export function hasStasis(level: LevelDef): boolean {
  return !!(level.stasisAvailable || level.experiment);
}

/** First authored opening, in the same 1-based numbering shown to the player. */
export function getLaneFirstWave(run: Run, index: number): number {
  return run.waves.findIndex(w => w.groups.some(g => g.path === index && g.count > 0)) + 1;
}

export type LaneStatus = "dormant" | "upcoming" | "active" | "cleared";
/** Gate forecast and live occupancy share one source for the HUD and scene. */
export function getLaneStatus(run: Run, index: number): LaneStatus {
  if (run.enemies.some(e => e.alive && e.pathIndex === index)) return "active";
  const pending = run.rest > 0 || run.waveIndex < 0;
  const wave = run.waves[run.waveIndex + (pending ? 1 : 0)];
  if (wave?.groups.some(g => g.path === index && g.spawned < g.count)) return pending ? "upcoming" : "active";
  const first = getLaneFirstWave(run, index);
  return first > 0 && first > run.waveIndex + (pending ? 2 : 1) ? "dormant" : "cleared";
}

/** Per-run random stream: repeated inputs and seed produce the same wisp motion. */
function random(run: Run): number {
  run.randomState = (Math.imul(run.randomState, 1664525) + 1013904223) >>> 0;
  return run.randomState / 4294967296;
}

function hangarOf(run: Pick<Run, "level">) {
  return run.level.hangar ?? { ...HANGAR, yaw: HANGAR_YAW, pitch: HANGAR_PITCH };
}

function emptyEnemy(): Enemy {
  return {
    alive: false,
    kind: "shard",
    pathIndex: 0,
    dist: 0,
    hp: 1,
    maxHp: 1,
    speed: 1,
    speedScale: 1,
    stasisSeen: false,
    radius: 1,
    reward: 0,
    leak: 0,
    amp: 0,
    phase: 0,
    x: 0,
    y: 0,
    z: 0,
    tx: 0,
    ty: 0,
    tz: 1,
    hit: false,
  };
}

function setPhase(run: Run, phase: Phase) {
  if (run.phase === phase) return;
  run.phase = phase;
  if (phase === "win" && !run.level.experiment && !run.continued) run.save = recordWin(run.level.id, run.core);
  run.onPhase?.(phase, run);
}

function placeEnemy(run: Run, e: Enemy) {
  const path = run.paths[e.pathIndex] ?? run.paths[0]!;
  const pose = path.pointAt(e.dist);
  let ox = 0;
  let oy = 0;
  let oz = 0;
  if (e.amp > 0) {
    let nx = pose.tz;
    let ny = 0;
    let nz = -pose.tx;
    let nl = Math.hypot(nx, ny, nz);
    if (nl < 0.2) {
      nx = 1;
      ny = 0;
      nz = 0;
      nl = 1;
    }
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const bx = pose.ty * nz - pose.tz * ny;
    const by = pose.tz * nx - pose.tx * nz;
    const bz = pose.tx * ny - pose.ty * nx;
    const theta = run.time * 1.8 + e.phase;
    const s = Math.sin(theta) * e.amp;
    const c = Math.cos(theta * 0.72) * e.amp * 0.45;
    ox = nx * s + bx * c;
    oy = ny * s + by * c;
    oz = nz * s + bz * c;
  }
  e.x = pose.x + ox;
  e.y = pose.y + oy;
  e.z = pose.z + oz;
  e.tx = pose.tx;
  e.ty = pose.ty;
  e.tz = pose.tz;
}

function spawnEnemy(run: Run, kind: Kind, pathIndex: number, speedMul = 1, hpMul = 1): boolean {
  const slot = run.enemies.find((e) => !e.alive);
  if (!slot) return false;
  const spec = KINDS[kind];
  slot.alive = true;
  slot.kind = kind;
  slot.pathIndex = pathIndex;
  slot.dist = 0;
  slot.maxHp = spec.hp * run.level.hpMul * hpMul;
  slot.hp = slot.maxHp;
  slot.speed = spec.speed * run.level.speedMul * speedMul;
  slot.speedScale = 1;
  slot.stasisSeen = false;
  slot.radius = spec.radius;
  slot.reward = spec.reward;
  slot.leak = spec.leak;
  slot.amp = spec.amp;
  slot.phase = random(run) * Math.PI * 2;
  slot.hit = false;
  if (kind === "wisp" && !run.notedWisp) {
    run.notedWisp = true;
    run.hint = "Wisps weave off the ribbon. A wide Sweep beam can catch their drift.";
  }
  placeEnemy(run, slot);
  slot.speedScale = enemySpeedScale(run, slot);
  noteStasisContact(run, slot);
  return true;
}

function leakEnemy(run: Run, e: Enemy) {
  if (e.kind === "carrier") run.carrierOutcome = "breached";
  e.alive = false;
  run.core = Math.max(0, run.core - e.leak);
  run.shake = Math.min(1, run.shake + 0.55);
  run.fx.push({ type: "leak" });
  run.lastBreach = { pathIndex: e.pathIndex, at: run.time };
  const laneName = run.level.presentation === "split-crown" ? `Gate ${String.fromCharCode(65 + e.pathIndex)}` : `Lane ${e.pathIndex + 1}`;
  run.hint = `${laneName} breached. Catch enemies before they reach the core.`;
  if (run.core <= 0) {
    run.core = 0;
    run.banner = "Gate lost";
    setPhase(run, "lose");
  }
}

function killEnemy(run: Run, e: Enemy) {
  if (e.kind === "carrier") run.carrierOutcome = "destroyed";
  e.alive = false;
  run.scrap += e.reward;
  run.kills += 1;
  run.fx.push({ type: "kill", x: e.x, y: e.y, z: e.z });
}

/** Rest coordinates stay fixed; fan/slide only change the projected pose. */
function projectDrone(d: Drone, expand: number, shift: number): Drone {
  let rx = d.bx - CORE.x;
  let rz = d.bz - CORE.z;
  let rl = Math.hypot(rx, rz);
  if (rl < 0.35) {
    rx = 1;
    rz = 0;
    rl = 1;
  }
  rx /= rl;
  rz /= rl;
  d.x = d.bx + rx * EXPAND_DIST * expand + SHIFT_DIST * shift;
  d.y = d.by;
  d.z = d.bz + rz * EXPAND_DIST * expand;
  const ax = d.fx + rx * Math.sin(FAN) * expand + shift * Math.sin(0.18);
  const ay = d.fy;
  const az = d.fz + rz * Math.sin(FAN) * expand;
  const al = Math.hypot(ax, ay, az) || 1;
  d.ax = ax / al;
  d.ay = ay / al;
  d.az = az / al;
  return d;
}

function updateLattice(run: Run) {
  for (const d of run.drones) projectDrone(d, run.expand, run.shift);
}

export function droneBeam(d: Drone): Beam {
  const spec = DRONE_SPECS[d.mode];
  return {
    x: d.x + d.ax * 0.7,
    y: d.y + d.ay * 0.7,
    z: d.z + d.az * 0.7,
    dx: d.ax, dy: d.ay, dz: d.az,
    dps: d.dps ?? spec.dps, radius: spec.radius, range: spec.range, pierces: spec.pierces,
  };
}

export type CoverageSegment = { pathIndex: number; points: Vec3[]; metres: number };
export type BeamCoverage = { segments: CoverageSegment[]; metres: number; sampleRadius: number };
export type CoverageTiming = { nowMetres: number; laterMetres: number; idleMetres: number };
export type PlacementPreview = BeamCoverage & CoverageTiming & { drone: Drone; beam: Beam; status: string | null };

/** Keep all highlighted geometry, but distinguish useful traffic from future plans.
 * Now follows the gate HUD: the next setup wave, or pending/live combat traffic.
 * A previously opened gate can be quiet now and return later. Cleared routes with
 * no further authored traffic are idle, never advertised as a future opening.
 */
export function getCoverageTiming(run: Run, coverage: BeamCoverage): CoverageTiming {
  const upcoming = run.rest > 0 || run.waveIndex < 0;
  const waveIndex = run.waveIndex + (upcoming ? 1 : 0);
  const laterLanes = new Set(run.waves.slice(waveIndex + 1).flatMap(w => w.groups.filter(g => g.count > 0).map(g => g.path)));
  const timing: CoverageTiming = { nowMetres: 0, laterMetres: 0, idleMetres: 0 };
  const status = run.paths.map((_, index) => getLaneStatus(run, index));
  for (const segment of coverage.segments) {
    const lane = status[segment.pathIndex];
    if (lane === "active" || lane === "upcoming") timing.nowMetres += segment.metres;
    else if (laterLanes.has(segment.pathIndex)) timing.laterMetres += segment.metres;
    else timing.idleMetres += segment.metres;
  }
  return timing;
}

/**
 * Potential coverage for ordinary shard centers, sampled at <=0.5m intervals.
 * Sweep still stops at the nearest living enemy. Wisps move off this centerline.
 * Midpoint classification gives each highlighted segment a real combat contact;
 * the displayed endpoints bracket that sample (at most 0.25m each side).
 */
export function getBeamCoverage(run: Pick<Run, "paths">, beam: Beam): BeamCoverage {
  const segments: CoverageSegment[] = [];
  const sampleRadius = KINDS.shard.radius;
  let metres = 0;
  run.paths.forEach((path, pathIndex) => {
    const count = Math.max(1, Math.ceil(path.length / 0.5));
    const step = path.length / count;
    let segment: CoverageSegment | undefined;
    for (let i = 0; i < count; i++) {
      const midpoint = path.pointAt((i + 0.5) * step);
      if (beamContact(beam, { ...midpoint, radius: sampleRadius }) !== null) {
        if (!segment) {
          segment = { pathIndex, points: [path.pointAt(i * step)], metres: 0 };
          segments.push(segment);
        }
        segment.points.push(path.pointAt((i + 1) * step));
        segment.metres += step;
        metres += step;
      } else segment = undefined;
    }
  });
  return { segments, metres, sampleRadius };
}

/** Sample nominal route centers; Wisps are tested at their actual drifting centers in combat. */
export function getFieldCoverage(run: Pick<Run, "paths">, center: Vec3): BeamCoverage {
  const segments: CoverageSegment[] = [];
  let metres = 0;
  run.paths.forEach((path, pathIndex) => {
    const count = Math.ceil(path.length / 0.5), ds = path.length / count;
    let segment: CoverageSegment | undefined;
    for (let i = 0; i < count; i++) {
      if (insideStasis(center, path.pointAt((i + 0.5) * ds))) {
        if (!segment) { segment = { pathIndex, points: [path.pointAt(i * ds)], metres: 0 }; segments.push(segment); }
        segment.points.push(path.pointAt((i + 1) * ds)); segment.metres += ds; metres += ds;
      } else segment = undefined;
    }
  });
  return { segments, metres, sampleRadius: 0 };
}
export function enemySpeedScale(run: Pick<Run, "drones">, point: Vec3): number {
  return run.drones.some(d => d.mode === "stasis" && insideStasis(d, point)) ? STASIS_SPEED_SCALE : 1;
}

function noteStasisContact(run: Run, enemy: Enemy): void {
  if (enemy.speedScale >= 1 || enemy.stasisSeen) return;
  enemy.stasisSeen = true;
  run.stasisTouched += 1;
}

/** A local, opt-in check uses the same enemies and movement as combat, with
 * combat/economy disabled. Its contacts never enter the actual run's totals. */
export function startFieldCheck(run: Run): string | null {
  if (!hasStasis(run.level)) return "Field check is available in Carrier Test Flight and Split Crown";
  if (run.fieldCheck) return "Field check is already running";
  if ((run.phase !== "play" && run.phase !== "pause") || run.rest <= 0 || run.enemies.some(e => e.alive)) return "Field check is available during setup";
  if (run.repositionId !== null) return "Finish or cancel repositioning before checking fields";
  if (!run.drones.some(d => d.mode === "stasis")) return "Anchor a Stasis drone before checking fields";
  run.fieldCheck = {
    enemies: run.enemies.map(e => ({ ...e })), stasisTouched: run.stasisTouched,
    stasisExposure: run.stasisExposure, randomState: run.randomState,
    hint: run.hint, banner: run.banner,
  };
  run.stasisTouched = 0; run.stasisExposure = 0;
  for (const enemy of run.enemies) enemy.alive = false;
  for (let pathIndex = 0; pathIndex < run.paths.length; pathIndex++) spawnEnemy(run, "barge", pathIndex);
  run.shipHitting = false;
  for (const drone of run.drones) drone.hit = false;
  run.banner = "Field check · harmless targets";
  run.hint = "One harmless target follows each route. Amber brackets mean slowed; end the check to resume setup.";
  return null;
}

export function endFieldCheck(run: Run): void {
  const saved = run.fieldCheck;
  if (!saved) return;
  run.enemies.forEach((enemy, index) => Object.assign(enemy, saved.enemies[index] ?? emptyEnemy()));
  run.stasisTouched = saved.stasisTouched; run.stasisExposure = saved.stasisExposure;
  run.randomState = saved.randomState; run.hint = saved.hint; run.banner = saved.banner;
  run.fieldCheck = null;
}

/** Capture the actual state rather than inferring contact from screen overlap. */
export function getStasisReport(run: Run, build: string) {
  const center = (p: Vec3) => ({ x: p.x, y: p.y, z: p.z });
  const fields = run.drones.filter(d => d.mode === "stasis");
  const alive = run.enemies.filter(e => e.alive);
  return {
    build, level: run.levelId, phase: run.phase, wave: run.waveIndex + 1,
    mode: run.droneMode, waveMode: run.waveMode, rest: run.rest,
    fieldCheck: !!run.fieldCheck, time: run.time, waveTime: run.waveTime,
    ship: center(run.ship), lattice: { fan: run.expand, slide: run.shift },
    drones: run.drones.map(d => ({ id: d.id, mode: d.mode, paid: d.paid,
      center: center(d), restCenter: { x: d.bx, y: d.by, z: d.bz },
      coveredMetresByLane: d.mode === "stasis" ? run.paths.map((path, i) => ({ lane: i + 1, route: path.id,
        metres: getFieldCoverage(run, d).segments.filter(s => s.pathIndex === i).reduce((n, s) => n + s.metres, 0) })) : [],
    })),
    enemies: alive.map(e => ({ kind: e.kind, lane: e.pathIndex + 1, center: center(e), distanceAlongRoute: e.dist,
      baseSpeed: e.speed, actualScale: e.speedScale, expectedScale: enemySpeedScale(run, e), effectiveSpeed: e.speed * e.speedScale,
      nearestFieldDistance: fields.length ? Math.min(...fields.map(d => Math.hypot(d.x - e.x, d.y - e.y, d.z - e.z))) : null,
      insideFieldIds: fields.filter(d => insideStasis(d, e)).map(d => d.id), stasisSeen: e.stasisSeen,
    })),
    contact: { alive: alive.length, slowedNow: alive.filter(e => e.speedScale < 1).length,
      geometricallyInsideNow: alive.filter(e => fields.some(d => insideStasis(d, e))).length,
      touched: run.stasisTouched, enemySeconds: run.stasisExposure },
  };
}

function proposedDrone(run: Run): Drone {
  const moving = run.drones.find(d => d.id === run.repositionId);
  return projectDrone({
    id: run.nextDroneId,
    mode: run.droneMode,
    dps: run.droneMode === "sweep" ? run.level.sweepDps ?? DRONE_SPECS.sweep.dps : DRONE_SPECS[run.droneMode].dps,
    paid: anchorCost(run.drones.length),
    kills: 0, damage: 0, hit: false,
    ...moving,
    bx: run.ship.x, by: run.ship.y, bz: run.ship.z,
    fx: run.aimx, fy: run.aimy, fz: run.aimz,
    x: run.ship.x, y: run.ship.y, z: run.ship.z,
    ax: run.aimx, ay: run.aimy, az: run.aimz,
  }, run.expand, run.shift);
}

export function getPlacementPreview(run: Run): PlacementPreview {
  const drone = proposedDrone(run);
  const beam = droneBeam(drone);
  let coverage = drone.mode === "stasis" ? getFieldCoverage(run, drone) : getBeamCoverage(run, beam);
  if (run.level.id === "tutorial") {
    // Match the scene's route announcements: introduce the next route during
    // setup, then retain it. A dormant lesson must not look like useful coverage.
    const pending = run.rest > 0 || run.waveIndex < 0;
    const announced = new Set<number>();
    for (const wave of run.waves.slice(0, Math.max(0, run.waveIndex + (pending ? 2 : 1)))) {
      for (const group of wave.groups) announced.add(group.path);
    }
    const segments = coverage.segments.filter((segment) => announced.has(segment.pathIndex));
    coverage = { ...coverage, segments, metres: segments.reduce((sum, segment) => sum + segment.metres, 0) };
  }
  return { ...coverage, ...getCoverageTiming(run, coverage), drone, beam, status: placementStatus(run) };
}

function weapons(run: Run, dt: number) {
  for (const e of run.enemies) e.hit = false;
  for (const d of run.drones) d.hit = false;
  run.shipHitting = false;
  if (run.phase !== "play") return;
  const shooters: { beam: Beam; drone?: Drone }[] = [{
    beam: {
      x: run.ship.x + run.aimx * 1.15,
      y: run.ship.y + run.aimy * 1.15,
      z: run.ship.z + run.aimz * 1.15,
      dx: run.aimx, dy: run.aimy, dz: run.aimz,
      dps: SHIP_DPS, radius: SHIP_RADIUS, range: BEAM_RANGE, pierces: true,
    },
  }];
  for (const drone of run.drones) if (drone.mode !== "stasis") shooters.push({ beam: droneBeam(drone), drone });
  for (const shooter of shooters) {
    const { beam, drone } = shooter;
    const hits = selectBeamTargets(beam, run.enemies.filter((e) => e.alive));
    for (const e of hits) {
      const damage = Math.min(e.hp, beam.dps * dt);
      e.hp -= damage;
      e.hit = true;
      if (drone) {
        drone.hit = true;
        drone.damage += damage;
      } else run.shipHitting = true;
      if (run.fxCooldown <= 0) {
        run.fx.push({ type: "hit", x: e.x, y: e.y, z: e.z });
        run.fxCooldown = 0.07;
      }
      if (e.hp <= 0) {
        if (drone) drone.kills += 1;
        killEnemy(run, e);
      }
    }
  }
  run.fxCooldown = Math.max(0, run.fxCooldown - dt);
}

function updateWaves(run: Run, dt: number) {
  if (run.phase !== "play") return;
  if (run.fieldCheck) return;
  if (run.rest > 0) {
    if (run.repositionId !== null) { run.banner = "Repositioning · setup held"; return; }
    // Preparation is live flight. Manual mode waits for an intentional launch;
    // the positive rest value remains a waiting sentinel rather than ticking.
    if (run.waveMode === "manual") {
      run.banner = run.waveIndex < 0 ? "Prepare · launch when ready" : "Lane clear · launch when ready";
      return;
    }
    run.rest -= dt;
    run.banner = `${run.waveIndex < 0 ? "Prepare" : "Lane clear"}  ${Math.max(0, Math.ceil(run.rest))}`;
    if (run.rest <= 0) beginWave(run, run.waveIndex + 1);
    return;
  }
  const wave = run.waves[run.waveIndex];
  if (!wave) return;
  run.waveTime += dt;
  for (const g of wave.groups) {
    while (g.spawned < g.count && run.waveTime >= g.delay + g.spawned * g.interval) {
      if (!spawnEnemy(run, g.kind, g.path, g.speedMul, g.hpMul)) break;
      g.spawned += 1;
    }
  }
  const spawning = wave.groups.some((g) => g.spawned < g.count);
  const alive = run.enemies.some((e) => e.alive);
  const started = wave.groups.some((g) => g.spawned > 0);
  if (!spawning && !alive && started) {
    if (run.waveIndex >= run.waves.length - 1) {
      run.banner = "Spiral held";
      setPhase(run, "win");
    } else {
      run.rest = 8;
      run.banner = run.waveMode === "manual" ? "Lane clear · launch when ready" : "Lane clear  8";
      const cost = anchorCost(run.drones.length);
      const placement = run.scrap >= cost && run.drones.length < getDroneLimit(run.level)
        ? `Next drone costs ${cost} scrap. ` : "Adjust your defense. ";
      run.hint = placement + (run.waveMode === "manual"
        ? "Take your time, then launch the next wave."
        : "The next wave launches in 8 seconds.");
    }
  }
}

function moveEnemies(run: Run, dt: number) {
  for (const e of run.enemies) {
    if (!e.alive) continue;
    const path = run.paths[e.pathIndex] ?? run.paths[0]!;
    e.speedScale = enemySpeedScale(run, e);
    noteStasisContact(run, e);
    if (e.speedScale < 1) run.stasisExposure += dt;
    e.dist += e.speed * e.speedScale * dt;
    if (e.dist >= path.length - 0.35) {
      if (run.fieldCheck) {
        e.dist %= Math.max(0.01, path.length - 0.35);
        placeEnemy(run, e);
        e.speedScale = enemySpeedScale(run, e);
        noteStasisContact(run, e);
        continue;
      }
      leakEnemy(run, e);
      if (run.phase !== "play") return;
      continue;
    }
    placeEnemy(run, e);
    e.speedScale = enemySpeedScale(run, e);
    noteStasisContact(run, e);
  }
}

/** Returns a player-facing reason if this resting placement cannot be bought. */
export function placementStatus(run: Run): string | null {
  if (run.fieldCheck) return "End the field check before anchoring";
  if (run.phase !== "play") return "Resume flight to anchor";
  if (run.droneMode === "stasis" && !hasStasis(run.level)) return "Stasis is available in Carrier Test Flight and Split Crown";
  const moving = run.drones.find(d => d.id === run.repositionId);
  if (run.repositionId !== null && (!moving || run.rest <= 0)) return "Reposition only during setup";
  if (!moving) {
    if (run.drones.length >= getDroneLimit(run.level)) return "Lattice is full";
    const cost = anchorCost(run.drones.length);
    if (run.scrap < cost) return `Need ${cost} scrap to anchor`;
  }
  const hangar = hangarOf(run);
  const dx = run.ship.x - hangar.x;
  const dy = run.ship.y - hangar.y;
  const dz = run.ship.z - hangar.z;
  if (dx * dx + dy * dy + dz * dz < 9) return "Fly 3m from the hangar to anchor";
  for (const d of run.drones) {
    if (d.id === run.repositionId) continue;
    const ddx = d.bx - run.ship.x;
    const ddy = d.by - run.ship.y;
    const ddz = d.bz - run.ship.z;
    if (ddx * ddx + ddy * ddy + ddz * ddz < 4.8) return "Too close to another drone";
  }
  return null;
}

export function tryAnchor(run: Run): string | null {
  const status = placementStatus(run);
  if (status) return status;
  const drone = proposedDrone(run);
  const moving = run.drones.find(d => d.id === run.repositionId);
  if (moving) Object.assign(moving, drone);
  else {
    run.drones.push(drone);
    run.nextDroneId += 1;
    run.scrap -= drone.paid;
  }
  run.repositionId = null;
  run.selectedDroneId = drone.id;
  if (moving && run.waveMode === "auto") run.rest = 8;
  run.fx.push({ type: "anchor", x: drone.x, y: drone.y, z: drone.z });
  run.anchorFlash = 0.35;
  run.shake = Math.min(1, run.shake + 0.28);
  const ship = run.ship;
  const hangar = hangarOf(run);
  ship.x = hangar.x;
  ship.y = hangar.y;
  ship.z = hangar.z;
  ship.vx = 0;
  ship.vy = 0;
  ship.vz = 0;
  ship.yaw = hangar.yaw;
  ship.pitch = hangar.pitch;
  ship.roll = 0;
  ship.yawRate = 0;
  ship.pitchRate = 0;
  run.speed = 0;
  run.thrustVisual = 0;
  const f = forwardOf(ship.yaw, ship.pitch);
  run.aimx = f.x;
  run.aimy = f.y;
  run.aimz = f.z;
  run.hint = moving ? `Drone ${drone.id} repositioned at no cost. Back at the hangar.` : `${DRONE_SPECS[drone.mode].label} anchored. Survey during setup to select and reposition any drone.`;
  return null;
}

/** Last-in recall is a full refund of what that particular drone actually cost. */
export function recallLast(run: Run): string | null {
  if (run.fieldCheck) return "End the field check before recalling drones";
  if (run.phase !== "play") return "Resume flight to recall";
  if (run.repositionId !== null) return "Finish or cancel repositioning first";
  const drone = run.drones.pop();
  if (!drone) return "No drone to recall";
  run.scrap += drone.paid;
  if (run.selectedDroneId === drone.id) run.selectedDroneId = null;
  if (!run.drones.length) {
    run.expand = 0;
    run.shift = 0;
  }
  run.hint = `${DRONE_SPECS[drone.mode].label} recalled · ${drone.paid} scrap returned. Try a new line.`;
  return null;
}

/** Setup revision reuses the exact paid unit; the old placement survives cancellation. */
export function beginReposition(run: Run, id: number): string | null {
  if (run.fieldCheck) return "End the field check before repositioning";
  if ((run.phase !== "play" && run.phase !== "pause") || run.rest <= 0) return "Reposition only during setup";
  const drone = run.drones.find(d => d.id === id);
  if (!drone) return "Select a drone first";
  run.selectedDroneId = id;
  run.repositionId = id;
  run.droneMode = drone.mode;
  run.expand = 0; run.shift = 0; updateLattice(run);
  Object.assign(run.ship, { x: drone.bx, y: drone.by, z: drone.bz, yaw: Math.atan2(-drone.fx, -drone.fz), pitch: Math.asin(clamp(drone.fy, -1, 1)), vx: 0, vy: 0, vz: 0, yawRate: 0, pitchRate: 0, roll: 0 });
  run.aimx = drone.fx; run.aimy = drone.fy; run.aimz = drone.fz;
  run.speed = 0; run.thrustVisual = 0;
  run.rest = 8;
  run.hint = `Moving drone ${id}. Fly and aim, then anchor at no cost; cancel keeps its old position.`;
  return null;
}

export function cancelReposition(run: Run): void {
  if (run.repositionId === null) return;
  run.repositionId = null;
  if (run.rest > 0 && run.waveMode === "auto") run.rest = 8;
  run.hint = "Move cancelled. The drone remains at its original position.";
}

export function recallSelected(run: Run, id: number): string | null {
  if (run.fieldCheck) return "End the field check before recalling drones";
  if ((run.phase !== "play" && run.phase !== "pause") || run.rest <= 0) return "Selected recall is available during setup";
  const index = run.drones.findIndex(d => d.id === id);
  if (index < 0) return "Select a drone first";
  if (run.repositionId === id) cancelReposition(run);
  const [drone] = run.drones.splice(index, 1);
  run.scrap += drone!.paid;
  if (run.selectedDroneId === id) run.selectedDroneId = null;
  if (!run.drones.length) { run.expand = 0; run.shift = 0; }
  run.hint = `Drone ${id} recalled · ${drone!.paid} scrap returned.`;
  return null;
}

/** The ordinary campaign result is already recorded; continuation cannot overwrite it. */
export function beginContinuation(run: Run): boolean {
  const extra = run.level.continuation;
  if (run.phase !== "win" || run.continued || !extra?.length || run.waveIndex !== run.level.waves.length - 1) return false;
  run.waves.push(...extra.map(w => ({ ...w, groups: w.groups.map(g => ({ ...g, spawned: 0 })) })));
  run.continued = true;
  run.carrierOutcome = "pending";
  run.waveMode = "manual";
  run.rest = 8;
  run.banner = "Extended defense · launch when ready";
  run.hint = `${run.level.waves.length}-wave victory recorded. Keep your fleet and scrap; revise your lines before wave ${run.level.waves.length + 1}.`;
  setPhase(run, "play");
  return true;
}

export function nextWaveNow(run: Run): void {
  if (run.fieldCheck) { run.hint = "End the field check before launching"; return; }
  if (run.phase !== "play" || run.rest <= 0) return;
  if (run.repositionId !== null) { run.hint = "Finish or cancel repositioning before launching"; return; }
  beginWave(run, run.waveIndex + 1);
}

/** Enabling automatic progress always grants a fresh setup window. */
export function setWaveMode(run: Run, mode: WaveMode): void {
  if (run.fieldCheck) { run.hint = "End the field check before changing wave pacing"; return; }
  if (run.waveMode === mode) return;
  run.waveMode = mode;
  if (run.rest <= 0) return;
  if (mode === "auto") {
    run.rest = run.waveIndex < 0 ? 12 : 8;
    run.banner = `${run.waveIndex < 0 ? "Prepare" : "Lane clear"}  ${run.rest}`;
    run.hint = `Automatic waves on. You have ${run.rest} seconds to prepare.`;
  } else {
    run.banner = run.waveIndex < 0 ? "Prepare · launch when ready" : "Lane clear · launch when ready";
    run.hint = "Take your time to fly and position drones. Launch the next wave when you're ready.";
  }
}

function integrateShip(run: Run, input: InputState, dt: number) {
  const ship = run.ship;
  const yawTarget = input.steer * YAW_RATE;
  const pitchTarget = input.pitch * PITCH_RATE;
  const kYaw = 1 - Math.exp(-14 * dt);
  const kPitch = 1 - Math.exp(-12 * dt);
  ship.yawRate += (yawTarget - ship.yawRate) * kYaw;
  ship.pitchRate += (pitchTarget - ship.pitchRate) * kPitch;
  ship.yaw += ship.yawRate * dt;
  ship.pitch = clamp(ship.pitch + ship.pitchRate * dt, -1.05, 1.05);
  const rollTarget = clamp(-ship.yawRate / YAW_RATE, -1, 1) * 0.55;
  ship.roll += (rollTarget - ship.roll) * (1 - Math.exp(-8 * dt));

  const f = forwardOf(ship.yaw, ship.pitch);
  run.aimx = f.x;
  run.aimy = f.y;
  run.aimz = f.z;

  const accel = input.boost ? 54 : 36;
  const thrust = clamp(input.thrust, -1, 1);
  run.thrustVisual = thrust * (input.boost ? 1.4 : 1);
  ship.vx += f.x * accel * thrust * dt;
  ship.vy += f.y * accel * thrust * dt;
  ship.vz += f.z * accel * thrust * dt;

  const forwardSpeed = ship.vx * f.x + ship.vy * f.y + ship.vz * f.z;
  const lx = ship.vx - f.x * forwardSpeed;
  const ly = ship.vy - f.y * forwardSpeed;
  const lz = ship.vz - f.z * forwardSpeed;
  const fwdDamp = Math.exp(-1.12 * dt);
  const latDamp = Math.exp(-7.2 * dt);
  ship.vx = f.x * forwardSpeed * fwdDamp + lx * latDamp;
  ship.vy = f.y * forwardSpeed * fwdDamp + ly * latDamp;
  ship.vz = f.z * forwardSpeed * fwdDamp + lz * latDamp;

  const speed = hypot3(ship.vx, ship.vy, ship.vz);
  const max = input.boost ? 34 : 26;
  if (speed > max) {
    const s = max / speed;
    ship.vx *= s;
    ship.vy *= s;
    ship.vz *= s;
  }
  run.speed = hypot3(ship.vx, ship.vy, ship.vz);

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  ship.z += ship.vz * dt;

  const r = Math.hypot(ship.x, ship.z);
  if (r > ARENA_R) {
    const k = ARENA_R / r;
    ship.x *= k;
    ship.z *= k;
    const nx = ship.x / ARENA_R;
    const nz = ship.z / ARENA_R;
    const outward = ship.vx * nx + ship.vz * nz;
    if (outward > 0) {
      ship.vx -= nx * outward;
      ship.vz -= nz * outward;
    }
  }
  if (ship.y < 1.6) {
    ship.y = 1.6;
    if (ship.vy < 0) ship.vy = 0;
  }
  if (ship.y > 44) {
    ship.y = 44;
    if (ship.vy > 0) ship.vy = 0;
  }
}

export function step(run: Run, input: InputState, dt: number) {
  if (run.phase !== "play") return;
  if (!run.fieldCheck) run.time += dt;
  run.anchorFlash = Math.max(0, run.anchorFlash - dt);
  run.shake = Math.max(0, run.shake - dt * 1.4);
  integrateShip(run, input, dt);

  const eTarget = input.expand ? 1 : 0;
  const sTarget = clamp(input.shift, -1, 1);
  const blend = 1 - Math.exp(-7 * dt);
  run.expand += (eTarget - run.expand) * blend;
  run.shift += (sTarget - run.shift) * blend;
  updateLattice(run);

  if (input.anchor) {
    input.anchor = false;
    const err = tryAnchor(run);
    if (err) run.hint = err;
  }

  moveEnemies(run, dt);
  if (run.fieldCheck) return;
  if (run.phase !== "play") return;
  weapons(run, dt);
  updateWaves(run, dt);
}

export function createRun(levelIndex: number, seed = 0x48454c49): Run {
  const level = LEVELS[clamp(levelIndex, 0, LEVELS.length - 1)] ?? LEVELS[0]!;
  const hangar = hangarOf({ level });
  const f = forwardOf(hangar.yaw, hangar.pitch);
  const enemies: Enemy[] = [];
  for (let i = 0; i < 64; i++) enemies.push(emptyEnemy());
  const waves = level.waves.map((w) => ({
    ...w,
    groups: w.groups.map((g) => ({ ...g, spawned: 0 })),
  }));
  const run: Run = {
    levelIndex: LEVELS.indexOf(level),
    level,
    paths: level.paths,
    phase: "play",
    ship: {
      x: hangar.x,
      y: hangar.y,
      z: hangar.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: hangar.yaw,
      pitch: hangar.pitch,
      roll: 0,
      yawRate: 0,
      pitchRate: 0,
    },
    aimx: f.x,
    aimy: f.y,
    aimz: f.z,
    speed: 0,
    thrustVisual: 0,
    drones: [],
    droneMode: "pierce",
    nextDroneId: 1,
    selectedDroneId: null,
    repositionId: null,
    continued: false,
    fieldCheck: null,
    stasisTouched: 0,
    stasisExposure: 0,
    enemies,
    waves,
    waveIndex: -1,
    waveTime: 0,
    waveMode: "manual",
    carrierOutcome: "pending",
    rest: 12,
    scrap: 60,
    core: 100,
    kills: 0,
    expand: 0,
    shift: 0,
    time: 0,
    hint: "Your first two drones are funded. Fly, line up and anchor; launch the first wave when ready.",
    banner: "Prepare · launch when ready",
    shipHitting: false,
    wasHitting: false,
    notedWisp: false,
    randomState: (seed + LEVELS.indexOf(level)) >>> 0,
    lastBreach: null,
    fx: [],
    fxCooldown: 0,
    anchorFlash: 0,
    shake: 0,
    levelId: level.id,
  };
  return run;
}

export function beginWave(run: Run, index: number) {
  if (run.fieldCheck) { run.hint = "End the field check before launching"; return; }
  run.waveIndex = index;
  run.waveTime = 0;
  run.rest = 0;
  if (run.waves[index]?.groups.some(g => g.kind === "carrier" && g.count > 0)) run.carrierOutcome = "pending";
  run.banner = `Wave ${index + 1} / ${run.waves.length}`;
  run.hint = run.waves[index]?.lesson ?? "Wave launched. Your drones hold their lines while you fly.";
}
