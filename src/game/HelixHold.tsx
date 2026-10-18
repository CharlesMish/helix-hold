import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpRight, Crosshair, Pause, Play, RotateCcw, Scan, Volume2, VolumeX, X } from "lucide-react";
import { createAudio, type AudioBus } from "./audio";
import { LEVELS, CARRIER_TEST_INDEX, DRIFT_INDEX, FRONTIER_INDEX, RELAY_LAB_INDEX } from "./paths";
import { GatePlan } from "./GatePlan";
import { freshSave, loadSave, type SaveData } from "./save";
import { createWorld, type World } from "./scene";
import {
  availableDroneModes,
  getAnchorCost,
  getDroneCoverage,
  beginContinuation,
  beginReposition,
  cancelReposition,
  createRun,
  endFieldCheck,
  getDroneLimit,
  getLaneFirstWave,
  getLaneStatus,
  getRelayTraces,
  getPlacementPreview,
  getStasisReport,
  hasStasis,
  nextWaveNow,
  recallLast,
  recallSelected,
  setWaveMode,
  startFieldCheck,
  step,
  type WaveMode,
  type InputState,
  type Phase,
  type Run,
} from "./sim";
import {
  DRONE_SPECS,
  HALO_RADIUS,
  PIN_DAMAGE,
  PIN_INTERVAL,
  PIN_SLOW_DURATION,
  PIN_SPEED_SCALE,
  TRIPWIRE_DAMAGE,
  TRIPWIRE_MAX_SPAN,
  insideStasis,
  STASIS_RADIUS,
  STASIS_SPEED_SCALE,
  type DroneMode,
} from "./combat";
import { clamp, forwardOf } from "./math";

type Stick = { x: number; y: number; pointer: number | null };
const BUILD_LABEL = "0.10.0";
const MODE_KEYS: Record<DroneMode, number> = {
  pierce: 1,
  sweep: 2,
  stasis: 3,
  halo: 4,
  pin: 5,
  lumen: 6,
  relay: 7,
  // Tripwire shares key 6 with Lumen; the two never appear in the same roster.
  tripwire: 6,
};
const MODE_ROLES: Record<DroneMode, string> = {
  pierce: "Piercing beam",
  sweep: "Wide beam",
  stasis: "Passive slow field",
  halo: "Passive damage field",
  pin: "Aimed slow dart",
  lumen: "Slowing light beam",
  relay: "Fixed beam redirector",
  tripwire: "Crossing strand",
};
const isFieldMode = (mode: DroneMode) => mode === "stasis" || mode === "halo";
const initialQuotes: Record<DroneMode, number> = {
  pierce: 20,
  sweep: 24,
  stasis: 32,
  halo: 44,
  pin: 48,
  lumen: 48,
  relay: 16,
  tripwire: 36,
};
const emptyOwned: Record<DroneMode, number> = {
  pierce: 0,
  sweep: 0,
  stasis: 0,
  halo: 0,
  pin: 0,
  lumen: 0,
  relay: 0,
  tripwire: 0,
};
// A strand is one purchase across two posts: count paid posts, not both ends.
const ownedByMode = (r: Run) =>
  Object.fromEntries(
    Object.keys(emptyOwned).map((mode) => [
      mode,
      r.drones.filter((d) => d.mode === mode && (mode !== "tripwire" || d.paid > 0)).length,
    ]),
  ) as Record<DroneMode, number>;
const quotesByMode = (r: Run) =>
  Object.fromEntries(
    Object.keys(emptyOwned).map((mode) => [mode, getAnchorCost(r, mode as DroneMode)]),
  ) as Record<DroneMode, number>;
const fieldSlowedNow = (r: Run) =>
  r.enemies.filter((e) => e.alive && r.drones.some((d) => d.mode === "stasis" && insideStasis(d, e))).length;
type FleetItem = {
  id: number;
  mode: DroneMode;
  paid: number;
  kills: number;
  damage: number;
  slowed: number;
  coverage: number[];
  relayStatus: string;
  partnerId: number | null;
};
const slowPercent = Math.round((1 - STASIS_SPEED_SCALE) * 100);
type Hud = {
  core: number;
  scrap: number;
  drones: number;
  kills: number;
  droneKills: number;
  droneDamage: number;
  mode: DroneMode;
  waveMode: WaveMode;
  cost: number;
  quotes: Record<DroneMode, number>;
  owned: Record<DroneMode, number>;
  coverage: number;
  nowCoverage: number;
  laterCoverage: number;
  idleCoverage: number;
  status: string | null;
  rest: number;
  wave: number;
  total: number;
  speed: number;
  altitude: number;
  hint: string;
  hitting: boolean;
  fan: boolean;
  shift: number;
  lanes: {
    name: string;
    count: number;
    eta: number;
    next: string;
    incoming: boolean;
    opensAt: number;
    status: string;
  }[];
  edges: { x: number; y: number; angle: number; label: string; urgent: boolean; visible: boolean }[];
  breach: boolean;
  lastDrone: string;
  slowed: number;
  carrier: string;
  fleet: FleetItem[];
  selectedDrone: number | null;
  moving: number | null;
  continued: boolean;
  fieldRoutes: { name: string; metres: number }[];
  checking: boolean;
  touched: number;
  exposure: number;
  nearestField: number | null;
  routeGhost: boolean;
  relayPreview: string;
  relayNetwork: string;
  recallSetupOnly: boolean;
  nowCrossings: number;
  laterCrossings: number;
  /** Tripwire: span of the strand this anchor would complete, or null for an open first post. */
  wireSpan: number | null;
  wireAnchorId: number | null;
  /** Drift swings applied for this setup, with the fleet's contact on that route before/after. */
  drift: { path: number; degrees: number; before: number; after: number }[];
};
const emptyHud: Hud = {
  core: 100,
  scrap: 60,
  drones: 0,
  kills: 0,
  droneKills: 0,
  droneDamage: 0,
  mode: "pierce",
  waveMode: "manual",
  cost: 20,
  quotes: initialQuotes,
  owned: emptyOwned,
  coverage: 0,
  nowCoverage: 0,
  laterCoverage: 0,
  idleCoverage: 0,
  status: null,
  rest: 12,
  wave: -1,
  total: 4,
  speed: 0,
  altitude: 0,
  hint: "",
  hitting: false,
  fan: false,
  shift: 0,
  lanes: [],
  edges: [],
  breach: false,
  lastDrone: "",
  slowed: 0,
  carrier: "",
  fleet: [],
  selectedDrone: null,
  moving: null,
  continued: false,
  fieldRoutes: [],
  checking: false,
  touched: 0,
  exposure: 0,
  nearestField: null,
  routeGhost: true,
  relayPreview: "",
  relayNetwork: "",
  recallSetupOnly: false,
  nowCrossings: 0,
  laterCrossings: 0,
  wireSpan: null,
  wireAnchorId: null,
  drift: [],
};
const kindLabel = { shard: "Shards", barge: "Barges", wisp: "Wisps", carrier: "Carrier" };

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      setSteer: (v: number) => void;
    };
    __helixDebug?: {
      snap: () => unknown;
      enemies: () => { kind: string; x: number; y: number; z: number; path: number }[];
      pause: (on: boolean) => void;
      place: (x: number, y: number, z: number, yaw: number, pitch: number) => void;
      scrap: (n: number) => void;
      anchor: () => void;
      mode: (mode: DroneMode) => void;
      recall: () => void;
      next: () => void;
      /** QA only: launch the waiting wave and resolve it immediately, as if every enemy were stopped. */
      clear: () => void;
    };
  }
}

function hasRelayOutput(trace: ReturnType<typeof getRelayTraces>[number] | undefined) {
  return !!trace?.segments.some((segment) => segment.stage === "outgoing" && segment.beam.range > 0.4);
}
function relayState(r: Run, id: number) {
  if (r.fieldCheck) return "Relay power paused during the Stasis-only check";
  const planned = getRelayTraces(r).find((t) => t.relayId === id);
  if (!planned) return "Unlinked · put the receiver on a Lumen line";
  const live = getRelayTraces(r, true).find((t) => t.sourceId === planned.sourceId);
  if (live?.relayId !== id) return "Blocked before receiver · outgoing beam off";
  if (!hasRelayOutput(live)) return "Receiver linked · no usable output range";
  const output = planned.segments.find((s) => s.stage === "outgoing");
  return `Linked to #${planned.sourceId} · ${output?.beam.range.toFixed(1) ?? "0"}m output`;
}
function relayPreviewCopy(ghost: ReturnType<typeof getPlacementPreview>) {
  if (ghost.drone.mode !== "relay" && ghost.drone.mode !== "lumen") return "";
  const trace = ghost.relayTraces?.find((t) =>
    ghost.drone.mode === "relay" ? t.relayId === ghost.drone.id : t.sourceId === ghost.drone.id,
  );
  if (!trace)
    return ghost.drone.mode === "relay"
      ? "Unlinked preview · put this receiver on a Lumen beam, then aim its output."
      : "Direct line · no Relay receiver connected.";
  if (trace.relayId === null) return "Direct line · no Relay receiver connected.";
  if (!hasRelayOutput(trace))
    return "Receiver reached, but no usable output range. Place it closer to Lumen.";
  const output = trace.segments.find((s) => s.stage === "outgoing");
  return `Planned link · ${output?.beam.range.toFixed(1) ?? "0"}m output remaining. Enemies before the receiver can cut its power.`;
}
function relayNetworkCopy(r: Run) {
  if (r.level.prototype !== "relay") return "";
  const planned = getRelayTraces(r).filter((t) => t.relayId !== null),
    live = getRelayTraces(r, true);
  const powered = planned.filter((t) =>
    live.some((l) => l.sourceId === t.sourceId && l.relayId === t.relayId && hasRelayOutput(l)),
  ).length;
  const blocked = planned.some(
    (t) => !live.some((l) => l.sourceId === t.sourceId && l.relayId === t.relayId),
  );
  if (r.fieldCheck) return "Relay power paused during the Stasis-only field check";
  return planned.length
    ? `${powered} of ${planned.length} planned links powered${powered < planned.length ? (blocked ? " · incoming line blocked" : " · no usable output range") : ""}`
    : "No linked Relay · a direct Lumen line still works";
}
function OrbitMark({ small = false }: { small?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={small ? "orbit-mark small" : "orbit-mark"}
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="23" rx="24" ry="10" transform="rotate(-25 32 23)" />
      <ellipse cx="32" cy="39" rx="18" ry="8" transform="rotate(-25 32 39)" />
      <path d="M12 31C-1 7 62 7 53 29C48 43 12 37 21 51C24 55 35 55 37 50" />
      <circle cx="37" cy="50" r="3" />
    </svg>
  );
}
function ArenaGlyph({ index }: { index: number }) {
  const level = LEVELS[index]!;
  return (
    <svg viewBox="-35 -35 70 70" aria-hidden="true">
      {level.paths.map((p, i) => (
        <polyline
          key={i}
          points={p.points.map((v) => `${v.x * 0.8},${v.z * 0.35 - v.y * 0.8 + 14}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity={1 - i * 0.2}
        />
      ))}
      <circle r="2" cy="12" fill="currentColor" />
    </svg>
  );
}

export function HelixHold() {
  const rootRef = useRef<HTMLDivElement>(null),
    canvasRef = useRef<HTMLCanvasElement>(null),
    reticleRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<Run | null>(null),
    worldRef = useRef<World | null>(null),
    audioRef = useRef<AudioBus | null>(null);
  const keys = useRef(new Set<string>()),
    mouse = useRef({ yaw: 0, pitch: 0 }),
    anchorEdge = useRef(false);
  const left = useRef<Stick>({ x: 0, y: 0, pointer: null }),
    right = useRef<Stick>({ x: 0, y: 0, pointer: null });
  const leftKnob = useRef<HTMLDivElement>(null),
    rightKnob = useRef<HTMLDivElement>(null);
  const touchRef = useRef(false),
    fanRef = useRef(false),
    shiftRef = useRef(0),
    boostRef = useRef(false),
    surveyRef = useRef(false);
  const qa = useRef({ on: false, frozen: false, codes: new Set<string>(), steer: null as number | null });
  const actions = useRef({ pause: () => {}, resume: () => {}, survey: () => {}, title: () => {} });
  const [phase, setPhase] = useState<Phase>("title"),
    [selected, setSelected] = useState(0),
    [touch, setTouch] = useState(false),
    [survey, setSurvey] = useState(false);
  const [hud, setHud] = useState<Hud>(emptyHud),
    [save, setSave] = useState<SaveData>(freshSave);
  const [bootError, setBootError] = useState<string | null>(null),
    [locked, setLocked] = useState(false),
    [help, setHelp] = useState(false),
    [muted, setMuted] = useState(false);
  const [pacing, setPacing] = useState<WaveMode>("manual");
  const mutedRef = useRef(false),
    lastHud = useRef(0),
    helpOpenRef = useRef(false),
    helpCardRef = useRef<HTMLElement>(null),
    surveyCardRef = useRef<HTMLElement>(null);
  helpOpenRef.current = help;
  const [debrief, setDebrief] = useState<{
    core: number;
    kills: number;
    droneKills: number;
    drones: number;
    level: number;
    carrier: string;
    continued: boolean;
  } | null>(null);

  function clearControls() {
    keys.current.clear();
    mouse.current = { yaw: 0, pitch: 0 };
    anchorEdge.current = false;
    fanRef.current = false;
    shiftRef.current = 0;
    boostRef.current = false;
    left.current = { x: 0, y: 0, pointer: null };
    right.current = { x: 0, y: 0, pointer: null };
    for (const ref of [leftKnob, rightKnob]) if (ref.current) ref.current.style.transform = "translate(0,0)";
  }
  function releaseMouse() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }
  function grabMouse() {
    if (!touchRef.current && canvasRef.current?.requestPointerLock) {
      try {
        const p = canvasRef.current.requestPointerLock();
        p?.catch(() => {});
      } catch {
        /* Keyboard aim remains available. */
      }
    }
  }
  function resetOverview() {
    surveyRef.current = false;
    setSurvey(false);
    worldRef.current?.setOverview(false);
  }
  function pause() {
    const r = runRef.current;
    if (r?.phase !== "play") return;
    r.phase = "pause";
    clearControls();
    resetOverview();
    setPhase("pause");
    releaseMouse();
  }
  function resume() {
    const r = runRef.current;
    if (r?.phase !== "pause") return;
    clearControls();
    resetOverview();
    r.phase = "play";
    setPhase("play");
    if (!mutedRef.current) audioRef.current?.resume();
    grabMouse();
  }
  function toggleSurvey() {
    const r = runRef.current;
    if (!r) return;
    if (surveyRef.current) {
      resume();
      return;
    }
    if (r.phase !== "play") return;
    clearControls();
    r.phase = "pause";
    surveyRef.current = true;
    setSurvey(true);
    setPhase("pause");
    worldRef.current?.setOverview(true);
    releaseMouse();
  }
  function toTitle() {
    clearControls();
    resetOverview();
    releaseMouse();
    const r = createRun(selected);
    r.phase = "title";
    runRef.current = r;
    setPhase("title");
    setDebrief(null);
    setHelp(false);
  }
  actions.current = { pause, resume, survey: toggleSurvey, title: toTitle };
  function choosePacing(mode: WaveMode) {
    if (runRef.current?.fieldCheck) return;
    setPacing(mode);
    const r = runRef.current;
    if (r) setWaveMode(r, mode);
    try {
      localStorage.setItem("helix-hold-pacing", mode);
    } catch {
      /* Session preference still works. */
    }
  }
  function chooseMode(mode: DroneMode) {
    const r = runRef.current;
    if (!r || r.fieldCheck || r.repositionId !== null || !availableDroneModes(r.level).includes(mode)) return;
    r.droneMode = mode;
    const ghost = getPlacementPreview(r);
    lastHud.current = 0;
    // Quotes, affordability and preview text change together, even before the next frame.
    setHud((h) => ({
      ...h,
      mode,
      scrap: r.scrap,
      drones: r.drones.length,
      cost: getAnchorCost(r, mode),
      quotes: quotesByMode(r),
      owned: ownedByMode(r),
      status: ghost.status,
      relayPreview: relayPreviewCopy(ghost),
      nowCrossings: ghost.nowCrossings,
      laterCrossings: ghost.laterCrossings,
      wireSpan: ghost.wire?.span ?? null,
      wireAnchorId: ghost.wire?.anchorId ?? null,
      coverage: ghost.metres,
      nowCoverage: ghost.nowMetres,
      laterCoverage: ghost.laterMetres,
      idleCoverage: ghost.idleMetres,
      fieldRoutes: r.paths.map((path, i) => ({
        name: path.id.replace(/-/g, " "),
        metres: ghost.segments.filter((seg) => seg.pathIndex === i).reduce((n, seg) => n + seg.metres, 0),
      })),
    }));
  }
  function recall() {
    const r = runRef.current;
    if (r?.phase !== "play") return;
    const err = recallLast(r);
    if (err) r.hint = err;
    if (!r.drones.length) {
      fanRef.current = false;
      shiftRef.current = 0;
    }
  }
  function startWave() {
    const r = runRef.current;
    if (r) nextWaveNow(r);
  }
  function requestAnchor() {
    if (runRef.current?.phase === "play") anchorEdge.current = true;
  }
  function launch(index: number) {
    clearControls();
    resetOverview();
    setHelp(false);
    qa.current.frozen = false;
    qa.current.on = false;
    qa.current.steer = null;
    qa.current.codes.clear();
    const r = createRun(index);
    setWaveMode(r, pacing);
    r.onPhase = (p, current) => {
      setPhase(p);
      if (p === "win" || p === "lose") {
        clearControls();
        setDebrief({
          core: Math.ceil(current.core),
          kills: current.kills,
          droneKills: current.drones.reduce((n, d) => n + d.kills, 0),
          drones: current.drones.length,
          level: current.levelIndex,
          carrier: current.carrierOutcome,
          continued: current.continued,
        });
        if (current.save) setSave(current.save);
        releaseMouse();
      }
    };
    runRef.current = r;
    setSelected(index);
    setPhase("play");
    setDebrief(null);
    setHud({
      ...emptyHud,
      scrap: r.scrap,
      routeGhost: r.routeGhost,
      waveMode: r.waveMode,
      total: r.waves.length,
      altitude: r.ship.y,
      quotes: quotesByMode(r),
      cost: getAnchorCost(r),
    });
    if (!mutedRef.current) audioRef.current?.resume();
    grabMouse();
  }
  function continueFlight() {
    const r = runRef.current;
    if (!r) return;
    clearControls();
    resetOverview();
    if (!beginContinuation(r)) return;
    setPacing("manual");
    setPhase("play");
    setDebrief(null);
    lastHud.current = 0;
    if (!mutedRef.current) audioRef.current?.resume();
    grabMouse();
  }
  function selectFleet(id: number) {
    const r = runRef.current;
    if (r) r.selectedDroneId = id;
    lastHud.current = 0;
  }
  function moveSelected() {
    const r = runRef.current;
    if (!r || r.selectedDroneId === null) return;
    clearControls();
    const err = beginReposition(r, r.selectedDroneId);
    if (err) {
      r.hint = err;
      return;
    }
    resume();
    lastHud.current = 0;
  }
  function cancelMove() {
    const r = runRef.current;
    if (r) cancelReposition(r);
    lastHud.current = 0;
  }
  function sellSelected() {
    const r = runRef.current;
    if (!r || r.selectedDroneId === null) return;
    const err = recallSelected(r, r.selectedDroneId);
    if (err) r.hint = err;
    lastHud.current = 0;
  }
  function checkFields() {
    const r = runRef.current;
    if (!r) return;
    clearControls();
    const err = startFieldCheck(r);
    if (err) {
      r.hint = err;
      return;
    }
    if (r.phase === "pause") resume();
    lastHud.current = 0;
  }
  function toggleRouteGhost() {
    const r = runRef.current;
    if (!r || r.rest <= 0) return;
    r.routeGhost = !r.routeGhost;
    setHud((h) => ({ ...h, routeGhost: r.routeGhost }));
    lastHud.current = 0;
  }
  function stopFieldCheck() {
    const r = runRef.current;
    if (r) endFieldCheck(r);
    lastHud.current = 0;
  }
  function saveFieldReport() {
    const r = runRef.current;
    if (!r) return;
    if (r.phase === "play") pause();
    const report = getStasisReport(r, BUILD_LABEL);
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "helix-hold-field-report.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function preview(index: number) {
    setSelected(index);
    const r = createRun(index);
    r.phase = "title";
    runRef.current = r;
  }
  function toggleMute() {
    const m = !mutedRef.current;
    mutedRef.current = m;
    setMuted(m);
    audioRef.current?.setMuted(m);
    if (!m) audioRef.current?.resume();
  }

  useEffect(() => {
    if (survey) surveyCardRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [survey]);
  useEffect(() => {
    if (!help) return;
    const before = document.activeElement as HTMLElement | null;
    helpCardRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, [help]);
  useEffect(() => {
    setSave(loadSave());
    try {
      const stored = localStorage.getItem("helix-hold-pacing");
      if (stored === "auto") setPacing("auto");
    } catch {
      /* Default to deliberate launch. */
    }
    const t = matchMedia("(pointer: coarse)").matches;
    setTouch(t);
    touchRef.current = t;
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current,
      root = rootRef.current;
    if (!canvas || !root) return;
    let world: World;
    try {
      world = createWorld(canvas);
      worldRef.current = world;
    } catch (e) {
      setBootError(e instanceof Error ? e.message : "Could not start the 3D view.");
      return;
    }
    const audio = createAudio();
    audioRef.current = audio;
    const initial = createRun(0);
    initial.phase = "title";
    runRef.current = initial;
    let raf = 0,
      last = performance.now(),
      acc = 0,
      elapsed = 0,
      wasLocked = false;
    const resize = () =>
      world.resize(
        root.clientWidth,
        root.clientHeight,
        Math.min(devicePixelRatio || 1, root.clientWidth < 760 ? 1.35 : 1.75),
      );
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    const readInput = (): InputState => {
      const down = (code: string) => (qa.current.on ? qa.current.codes.has(code) : keys.current.has(code));
      return {
        thrust: clamp(
          (down("KeyW") ? 1 : 0) - (down("KeyS") ? 1 : 0) + (qa.current.on ? 0 : right.current.y),
          -1,
          1,
        ),
        steer: clamp(
          qa.current.steer ??
            (down("KeyA") || down("ArrowLeft") ? 1 : 0) -
              (down("KeyD") || down("ArrowRight") ? 1 : 0) -
              (qa.current.on ? 0 : left.current.x),
          -1,
          1,
        ),
        pitch: clamp(
          (down("ArrowUp") ? 1 : 0) - (down("ArrowDown") ? 1 : 0) + (qa.current.on ? 0 : left.current.y),
          -1,
          1,
        ),
        boost: down("Space") || boostRef.current,
        anchor: anchorEdge.current,
        expand: down("ShiftLeft") || down("ShiftRight") || fanRef.current,
        shift: clamp((down("KeyE") ? 1 : 0) - (down("KeyQ") ? 1 : 0) + shiftRef.current, -1, 1),
      };
    };
    const paint = (r: Run, now: number) => {
      const reticle = reticleRef.current;
      if (reticle) {
        const p = world.project(r.ship.x + r.aimx * 32, r.ship.y + r.aimy * 32, r.ship.z + r.aimz * 32);
        reticle.dataset.on = r.phase === "play" && p.visible ? "1" : "0";
        reticle.dataset.hot = r.shipHitting ? "1" : "0";
        reticle.style.transform = `translate(${p.x}px,${p.y}px)`;
      }
      if (now - lastHud.current < 100) return;
      lastHud.current = now;
      const ghost = getPlacementPreview(r);
      const next = r.waves[r.rest > 0 ? r.waveIndex + 1 : r.waveIndex];
      const lanes = r.paths.map((path, i) => {
        const enemies = r.enemies.filter((e) => e.alive && e.pathIndex === i);
        const groups = next?.groups.filter((g) => g.path === i && g.spawned < g.count) ?? [];
        return {
          name: path.id,
          count: enemies.length,
          eta: enemies.length ? Math.min(...enemies.map((e) => (path.length - e.dist) / e.speed)) : Infinity,
          next: groups.map((g) => `${g.count - g.spawned} ${kindLabel[g.kind]}`).join(" · "),
          incoming: groups.length > 0,
          opensAt: getLaneFirstWave(r, i),
          status: getLaneStatus(r, i),
        };
      });
      const edges = r.paths.flatMap((path, i) => {
        const enemies = r.enemies.filter((e) => e.alive && e.pathIndex === i).sort((a, b) => b.dist - a.dist);
        const target = enemies[0] ?? (lanes[i]?.incoming ? path.points[0] : null);
        if (!target) return [];
        const p = world.projectEdge(target.x, target.y, target.z, touchRef.current ? 52 : 74);
        return [
          {
            ...p,
            label: enemies.length ? `${enemies.length} · ${path.id}` : `${path.id} gate`,
            urgent: (lanes[i]?.eta ?? Infinity) < 6,
            visible: !p.visible,
          },
        ];
      });
      const lastDrone = r.drones.at(-1),
        carrier = r.enemies.find((e) => e.alive && e.kind === "carrier");
      setHud({
        core: r.core,
        scrap: r.scrap,
        drones: r.drones.length,
        kills: r.kills,
        droneKills: r.drones.reduce((n, d) => n + d.kills, 0),
        droneDamage: r.drones.reduce((n, d) => n + d.damage, 0),
        mode: ghost.drone.mode,
        waveMode: r.waveMode,
        cost: r.repositionId === null ? getAnchorCost(r, ghost.drone.mode) : 0,
        quotes: quotesByMode(r),
        owned: ownedByMode(r),
        fleet: r.drones.map((d) => {
          const segments = isFieldMode(d.mode) ? getDroneCoverage(r, d).segments : [];
          return {
            id: d.id,
            mode: d.mode,
            paid: d.paid,
            kills: d.kills,
            damage: d.damage,
            slowed: d.mode === "stasis" ? r.enemies.filter((e) => e.alive && insideStasis(d, e)).length : 0,
            relayStatus: d.mode === "relay" ? relayState(r, d.id) : "",
            partnerId: d.partnerId ?? null,
            coverage: isFieldMode(d.mode)
              ? r.paths.map((_, i) =>
                  segments.filter((seg) => seg.pathIndex === i).reduce((n, seg) => n + seg.metres, 0),
                )
              : [],
          };
        }),
        selectedDrone: r.selectedDroneId,
        moving: r.repositionId,
        continued: r.continued,
        routeGhost: r.routeGhost,
        relayPreview: relayPreviewCopy(ghost),
        relayNetwork: relayNetworkCopy(r),
        nowCrossings: ghost.nowCrossings,
        laterCrossings: ghost.laterCrossings,
        wireSpan: ghost.wire?.span ?? null,
        wireAnchorId: ghost.wire?.anchorId ?? null,
        drift: r.rest > 0 ? (r.lastDrift ?? []) : [],
        recallSetupOnly:
          !!lastDrone &&
          (lastDrone.mode === "relay" || lastDrone.mode === "lumen" || lastDrone.mode === "tripwire") &&
          r.rest <= 0,
        checking: !!r.fieldCheck,
        touched: r.stasisTouched,
        exposure: r.stasisExposure,
        nearestField:
          r.enemies.some((e) => e.alive) && r.drones.some((d) => d.mode === "stasis")
            ? Math.min(
                ...r.enemies
                  .filter((e) => e.alive)
                  .flatMap((e) =>
                    r.drones
                      .filter((d) => d.mode === "stasis")
                      .map((d) => Math.hypot(e.x - d.x, e.y - d.y, e.z - d.z)),
                  ),
              )
            : null,
        fieldRoutes: r.paths.map((path, i) => ({
          name: path.id.replace(/-/g, " "),
          metres: ghost.segments.filter((seg) => seg.pathIndex === i).reduce((n, seg) => n + seg.metres, 0),
        })),
        coverage: ghost.metres,
        nowCoverage: ghost.nowMetres,
        laterCoverage: ghost.laterMetres,
        idleCoverage: ghost.idleMetres,
        status: ghost.status,
        rest: r.rest,
        wave: r.waveIndex,
        total: r.waves.length,
        speed: r.speed,
        altitude: r.ship.y,
        hint: r.hint,
        hitting: r.shipHitting,
        fan: r.expand > 0.15,
        shift: r.shift,
        lanes,
        edges,
        slowed: fieldSlowedNow(r),
        carrier: carrier
          ? `Carrier · ${Math.ceil((carrier.hp / carrier.maxHp) * 100)}% hull`
          : r.carrierOutcome === "destroyed"
            ? "Carrier intercepted"
            : r.carrierOutcome === "breached"
              ? "Carrier breached · −40 core"
              : "",
        breach: !!r.lastBreach && r.time - r.lastBreach.at < 1.2,
        lastDrone: lastDrone
          ? lastDrone.mode === "tripwire" && lastDrone.paid === 0
            ? `Tripwire second post · recall reopens post #${lastDrone.partnerId}`
            : `${DRONE_SPECS[lastDrone.mode].label} · ${lastDrone.mode === "stasis" ? "slowing field" : lastDrone.mode === "relay" ? "beam redirector" : `${lastDrone.kills} kills`} · refund ${lastDrone.paid}`
          : "",
      });
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      const r = runRef.current;
      if (r) {
        if (r.phase === "play" && !qa.current.frozen) {
          r.ship.yaw += mouse.current.yaw;
          r.ship.pitch = clamp(r.ship.pitch + mouse.current.pitch, -1.05, 1.05);
          mouse.current = { yaw: 0, pitch: 0 };
          acc += dt;
          let n = 0;
          while (acc >= 1 / 60 && n < 5) {
            const input = readInput();
            anchorEdge.current = false;
            step(r, input, 1 / 60);
            acc -= 1 / 60;
            n++;
          }
          if (r.shipHitting && !r.wasHitting) audio.acquire();
          r.wasHitting = r.shipHitting;
          for (const fx of r.fx) {
            if (fx.type === "kill") audio.kill();
            else if (fx.type === "hit") audio.hit();
            else if (fx.type === "anchor") audio.anchor();
            else audio.leak();
          }
        } else {
          acc = 0;
          mouse.current = { yaw: 0, pitch: 0 };
        }
        audio.setEngine(Math.min(1, r.speed / 26), r.phase === "play");
        world.sync(r, dt, elapsed);
        paint(r, now);
      }
      raf = requestAnimationFrame(frame);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (helpOpenRef.current) {
        if (e.code === "Escape") {
          e.preventDefault();
          setHelp(false);
        }
        if (e.code === "Tab") {
          const buttons = helpCardRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
          if (buttons?.length) {
            const first = buttons[0]!,
              last = buttons[buttons.length - 1]!;
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
        return;
      }
      if (surveyRef.current && e.code === "Tab") {
        e.preventDefault();
        const buttons = surveyCardRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (buttons?.length) {
          const items = Array.from(buttons),
            index = items.indexOf(document.activeElement as HTMLButtonElement);
          items[(index + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
        }
        return;
      }
      const r = runRef.current,
        gameActive = r?.phase === "play" || surveyRef.current;
      const target = e.target as HTMLElement | null;
      // Pointer lock can retain focus on the button that started flight. Its native
      // Enter/Space action must not run behind the active flight controls.
      const pointerLocked = document.pointerLockElement === canvas;
      if (
        !pointerLocked &&
        target?.closest("button,input,select,textarea") &&
        ["Space", "Enter"].includes(e.code)
      )
        return;
      if (
        gameActive &&
        (["Tab", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code) ||
          (pointerLocked && e.code === "Enter"))
      )
        e.preventDefault();
      if (e.repeat) return;
      if (e.code === "Escape") {
        if (r?.phase === "play") actions.current.pause();
        else if (surveyRef.current) actions.current.resume();
        return;
      }
      if (e.code === "Tab" && gameActive) {
        actions.current.survey();
        return;
      }
      if (e.code === "KeyG" && gameActive && r?.level.prototype === "route-expansion" && r.rest > 0) {
        toggleRouteGhost();
        return;
      }
      if (r?.phase !== "play") return;
      keys.current.add(e.code);
      if (e.code === "KeyF") anchorEdge.current = true;
      if (e.code === "KeyR") recall();
      const modeKey = availableDroneModes(r.level).find((mode) => e.code === `Digit${MODE_KEYS[mode]}`);
      if (modeKey) chooseMode(modeKey);
      if (e.code === "KeyC") cancelReposition(r);

      if (e.code === "Enter") {
        e.preventDefault();
        if (r.fieldCheck) {
          endFieldCheck(r);
          lastHud.current = 0;
        } else nextWaveNow(r);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const onMouse = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas && runRef.current?.phase === "play") {
        mouse.current.yaw -= e.movementX * 0.0021;
        mouse.current.pitch -= e.movementY * 0.0018;
      }
    };
    const onLock = () => {
      const on = document.pointerLockElement === canvas;
      setLocked(on);
      if (!on && wasLocked && runRef.current?.phase === "play") actions.current.pause();
      wasLocked = on;
    };
    const onBlur = () => {
      clearControls();
      if (runRef.current?.phase === "play") actions.current.pause();
    };
    const onHidden = () => {
      if (document.hidden) onBlur();
    };
    const onCanvasClick = () => {
      if (runRef.current?.phase === "play") grabMouse();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onHidden);
    document.addEventListener("pointerlockchange", onLock);
    canvas.addEventListener("click", onCanvasClick);
    const qaEnabled = import.meta.env.DEV || new URLSearchParams(location.search).has("qa");
    if (qaEnabled) {
      window.__controlsTest = {
        getYaw: () => runRef.current?.ship.yaw ?? 0,
        getSpeed: () => runRef.current?.speed ?? 0,
        setKeys: (codes) => {
          qa.current.codes = new Set(codes);
          qa.current.on = codes.length > 0 || qa.current.steer !== null;
        },
        setSteer: (v) => {
          qa.current.steer = v;
          qa.current.on = true;
        },
      };
      window.__helixDebug = {
        snap: () => {
          const r = runRef.current;
          return r
            ? {
                phase: r.phase,
                scrap: r.scrap,
                core: r.core,
                drones: r.drones.length,
                alive: r.enemies.filter((e) => e.alive).length,
                hitting: r.shipHitting,
                banner: r.banner,
                hint: r.hint,
                mode: r.droneMode,
                nextCost: getAnchorCost(r),
                quotes: quotesByMode(r),
                owned: ownedByMode(r),
                waveMode: r.waveMode,
                waveIndex: r.waveIndex,
                rest: r.rest,
                repositionId: r.repositionId,
                selectedDroneId: r.selectedDroneId,
                continued: r.continued,
                checking: !!r.fieldCheck,
                stasisTouched: r.stasisTouched,
                carrierOutcome: r.carrierOutcome,
                slowed: fieldSlowedNow(r),
                coverage: getPlacementPreview(r).metres,
              }
            : null;
        },
        enemies: () =>
          (runRef.current?.enemies ?? [])
            .filter((e) => e.alive)
            .map((e) => ({ kind: e.kind, x: e.x, y: e.y, z: e.z, path: e.pathIndex })),
        pause: (on) => {
          qa.current.frozen = on;
        },
        place: (x, y, z, yaw, pitch) => {
          const r = runRef.current;
          if (!r) return;
          Object.assign(r.ship, { x, y, z, yaw, pitch, vx: 0, vy: 0, vz: 0, yawRate: 0, pitchRate: 0 });
          const f = forwardOf(yaw, pitch);
          r.aimx = f.x;
          r.aimy = f.y;
          r.aimz = f.z;
          r.speed = 0;
        },
        scrap: (n) => {
          if (runRef.current) runRef.current.scrap += n;
        },
        anchor: () => {
          anchorEdge.current = true;
        },
        mode: chooseMode,
        recall,
        next: () => {
          if (runRef.current) nextWaveNow(runRef.current);
        },
        clear: () => {
          const r = runRef.current;
          if (!r || r.phase !== "play" || r.fieldCheck || r.repositionId !== null) return;
          if (r.rest > 0) nextWaveNow(r);
          const wave = r.waves[r.waveIndex];
          if (!wave) return;
          for (const g of wave.groups) g.spawned = g.count;
          for (const e of r.enemies) e.alive = false;
        },
      };
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onHidden);
      document.removeEventListener("pointerlockchange", onLock);
      canvas.removeEventListener("click", onCanvasClick);
      world.dispose();
      audio.dispose();
      worldRef.current = null;
      if (qaEnabled) {
        delete window.__controlsTest;
        delete window.__helixDebug;
      }
    };
  }, []);

  function bindStick(
    stick: { current: Stick },
    knob: { current: HTMLDivElement | null },
    e: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (stick.current.pointer !== null) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    stick.current.pointer = e.pointerId;
    const apply = (x: number, y: number) => {
      const rect = el.getBoundingClientRect(),
        radius = rect.width / 2;
      let dx = (x - rect.left - radius) / radius,
        dy = -(y - rect.top - radius) / radius;
      const length = Math.hypot(dx, dy);
      if (length > 1) {
        dx /= length;
        dy /= length;
      }
      stick.current.x = Math.abs(dx) < 0.08 ? 0 : dx;
      stick.current.y = Math.abs(dy) < 0.08 ? 0 : dy;
      if (knob.current)
        knob.current.style.transform = `translate(${dx * radius * 0.48}px,${-dy * radius * 0.48}px)`;
    };
    apply(e.clientX, e.clientY);
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== stick.current.pointer) return;
      stick.current = { x: 0, y: 0, pointer: null };
      if (knob.current) knob.current.style.transform = "translate(0,0)";
    };
    el.onpointermove = (ev) => {
      if (ev.pointerId === stick.current.pointer) apply(ev.clientX, ev.clientY);
    };
    el.onpointerup = end;
    el.onpointercancel = end;
    el.onlostpointercapture = end;
  }
  const level = LEVELS[selected]!,
    playing = phase === "play",
    active = playing || survey;
  const crown = level.presentation === "split-crown",
    prototype = !!level.prototype,
    frontier = level.prototype === "route-expansion",
    drifting = !!level.driftPath,
    relayLab = level.prototype === "relay",
    staged = crown || !!level.prototype,
    stasisAvailable = hasStasis(level),
    modes = availableDroneModes(level),
    expanded = modes.includes("halo"),
    perType = level.dronePricing === "per-type";
  const previewField = isFieldMode(hud.mode);
  const wireMode = hud.mode === "tripwire",
    wireOpenPost = hud.fleet.find((d) => d.mode === "tripwire" && d.partnerId === null),
    wireCompleting = wireMode && hud.moving === null && !!wireOpenPost;
  const modeDescription =
    hud.mode === "stasis"
      ? `Passive sphere · ${STASIS_RADIUS}m radius / ${STASIS_RADIUS * 2}m across · ${slowPercent}% slow · no shots`
      : hud.mode === "halo"
        ? `Passive sphere · ${HALO_RADIUS}m radius / ${HALO_RADIUS * 2}m across · ${DRONE_SPECS.halo.dps} DPS to every enemy inside`
        : hud.mode === "pin"
          ? `Aimed dart · ${DRONE_SPECS.pin.range}m · ${PIN_DAMAGE} damage / ${PIN_INTERVAL}s · ${Math.round((1 - PIN_SPEED_SCALE) * 100)}% slow for ${PIN_SLOW_DURATION}s`
          : hud.mode === "lumen"
            ? "Slowing light · 76m shared range · 8 DPS · 40% slow for 2.4s · one emitter"
            : hud.mode === "relay"
              ? "Receives Lumen and redirects along your aim · one turn · no weapon of its own"
              : hud.mode === "tripwire"
                ? `Two posts · strand up to ${TRIPWIRE_MAX_SPAN}m · ${TRIPWIRE_DAMAGE} damage to every enemy, once per crossing · aim doesn’t matter`
                : hud.mode === "pierce"
                  ? "Long, narrow · hits every foe in line"
                  : `Short, wide · nearest foe${selected === CARRIER_TEST_INDEX ? " · 22 DPS trial" : ""}`;
  const droneLimit = getDroneLimit(level),
    scrapGrowth = !Number.isFinite(droneLimit);
  const baseWaveCount = level.waves.length,
    extraWaveCount = level.continuation?.length ?? 0;
  const canContinue = phase === "win" && extraWaveCount > 0 && !debrief?.continued;
  const carrierName = debrief?.continued ? "Final carrier" : "Carrier";
  const carrierSummary =
    debrief?.carrier === "destroyed"
      ? `${carrierName} intercepted.`
      : debrief?.carrier === "breached"
        ? `${carrierName} breached for 40 core.`
        : `${carrierName} not reached.`;
  const debriefCopy = prototype
    ? (drifting
        ? "Coils that move. Did re-flying broken lines after each swing feel like a fresh puzzle, or like chores? Did Tripwire earn a place?"
        : frontier
          ? "Three coils, three breach ports. Did each opening ask for a new line while keeping your older drones useful?"
          : "Did redirecting one Lumen beam create a useful line? Try changing the receiver’s aim or compare it with Stasis.") +
      " This prototype does not record a campaign score."
    : debrief?.continued
      ? `${baseWaveCount}-wave campaign result already recorded. This extended defense is a separate challenge.${crown ? ` ${carrierSummary}` : ""}`
      : level.experiment
        ? `${carrierSummary} Try a different field or a longer dedicated line. Campaign records are separate.`
        : canContinue
          ? `${crown ? `${carrierSummary} ` : ""}${baseWaveCount}-wave victory recorded. Keep this fleet, remaining core and scrap for ${extraWaveCount} optional waves${crown ? ", ending with a stronger carrier" : ""}, or finish here.`
          : crown
            ? `${carrierSummary} ${phase === "win" ? `${baseWaveCount}-wave result recorded for Split Crown.` : "Try keeping a shared line while reinforcing one local approach."}`
            : phase === "win"
              ? "Your angles held the core. Try another geometry or improve its integrity."
              : "Try a longer contact with the ribbon, or let a Sweep catch the foes your Pierce misses.";
  const laneLabel = (i: number) => (staged ? String.fromCharCode(65 + i) : String(i + 1));
  const coverageNow = staged ? hud.nowCoverage : hud.coverage;
  const wavePlan = runRef.current?.waves[hud.rest > 0 ? hud.wave + 1 : hud.wave];
  const driftNote = hud.drift.length
    ? hud.drift
        .map(
          (d) =>
            `Gate ${laneLabel(d.path)} swung ${Math.abs(d.degrees)}° · your contact ${d.before.toFixed(0)} → ${d.after.toFixed(0)} m`,
        )
        .join(" · ")
    : "";
  const newRouteSetup =
    frontier && hud.rest > 0 && (hud.lanes.some((l) => l.opensAt === hud.wave + 2) || hud.drift.length > 0);
  const nextCampaign = LEVELS.findIndex(
    (candidate, i) => i > selected && !candidate.archived && !candidate.experiment && !candidate.prototype,
  );
  const nextArena = prototype
    ? -1
    : nextCampaign >= 0
      ? nextCampaign
      : level.experiment
        ? -1
        : CARRIER_TEST_INDEX;
  const selectedUnit = hud.fleet.find((d) => d.id === hud.selectedDrone),
    fields = hud.fleet.filter((d) => d.mode === "stasis");
  const cannotBuy =
    hud.checking ||
    (hud.moving === null &&
      (hud.drones >= droneLimit || hud.scrap < hud.cost || (hud.mode === "lumen" && hud.owned.lumen >= 1)));
  const pacingControls = (
    <div className="pacing-control">
      <span className="eyebrow">WAVE PACING</span>
      <div className="pacing-options" role="group" aria-label="Wave pacing">
        <button
          aria-pressed={pacing === "manual"}
          disabled={hud.checking}
          onClick={() => choosePacing("manual")}
        >
          Plan & launch
        </button>
        <button aria-pressed={pacing === "auto"} disabled={hud.checking} onClick={() => choosePacing("auto")}>
          Auto waves
        </button>
      </div>
      <p>
        {pacing === "manual"
          ? "Take your time between waves. Launch when ready."
          : "12s to prepare, then 8s between waves. Change in Pause."}
      </p>
    </div>
  );
  const modeButtons = (
    <div
      className="mode-buttons"
      data-count={modes.length}
      aria-label="Drone type"
      data-moving={hud.moving !== null}
    >
      {modes.map((mode) => (
        <button
          key={mode}
          data-mode={mode}
          className={hud.mode === mode ? "selected" : ""}
          aria-pressed={hud.mode === mode}
          disabled={hud.moving !== null}
          onClick={() => chooseMode(mode)}
          title={MODE_ROLES[mode]}
        >
          <span className="mode-name">
            <span className={`beam-icon ${mode}`} aria-hidden="true" />
            {DRONE_SPECS[mode].label}
            <kbd>{MODE_KEYS[mode]}</kbd>
          </span>
          <small>
            {hud.moving !== null && hud.mode === mode
              ? "Move · free"
              : mode === "lumen" && hud.owned.lumen >= 1
                ? "1 / 1 placed"
                : mode === "tripwire" && hud.quotes.tripwire === 0
                  ? "Second post · free"
                  : `${hud.quotes[mode]} scrap · ${hud.owned[mode]} ${mode === "tripwire" ? "strands" : "owned"}`}
          </small>
        </button>
      ))}
    </div>
  );
  return (
    <div
      ref={rootRef}
      className="game-root"
      data-phase={phase}
      data-touch={touch ? "1" : "0"}
      data-survey={survey ? "1" : "0"}
      data-arena={level.id}
      data-prototype={level.prototype ?? "none"}
      onTouchStart={() => {
        touchRef.current = true;
        setTouch(true);
      }}
    >
      <canvas ref={canvasRef} className="view" aria-label="Helix Hold 3D flight arena" />
      <div className="vignette" />
      <div className={`breach-flash ${hud.breach && playing ? "on" : ""}`} />
      <div ref={reticleRef} className="reticle" data-on="0">
        <i />
      </div>
      <div className="brand">
        <OrbitMark small />
        <span>
          HELIX HOLD<small>SIGHTLINE LAB · {BUILD_LABEL}</small>
        </span>
      </div>
      <div className="utility">
        <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} title={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        {playing && (
          <>
            <button onClick={toggleSurvey} aria-label="Survey arena" title="Survey · Tab">
              <Scan size={18} />
            </button>
            <button onClick={pause} aria-label="Pause">
              <Pause size={18} />
            </button>
          </>
        )}
        {survey && (
          <button onClick={resume} aria-label="Resume flight">
            <Play size={18} />
          </button>
        )}
      </div>
      {active && (
        <>
          <header className="flight-hud">
            <div className="core-read">
              <span className="eyebrow">CORE INTEGRITY</span>
              <strong>
                {Math.ceil(hud.core)}
                <small>%</small>
              </strong>
              <div className="core-track">
                <i style={{ width: `${hud.core}%` }} data-low={hud.core < 36} />
              </div>
            </div>
            <div className="resource">
              <span className="eyebrow">SCRAP</span>
              <strong>{hud.scrap}</strong>
            </div>
            <div className="resource">
              <span className="eyebrow">DRONES</span>
              <strong>
                {hud.drones}
                {!scrapGrowth && <small>/{droneLimit}</small>}
              </strong>
              {scrapGrowth && (
                <span className="fleet-cost">
                  {hud.moving !== null ? "Move · free" : `Next · ${hud.cost} scrap`}
                </span>
              )}
            </div>
          </header>
          <div className="wave-read" data-ready={hud.rest > 0} data-checking={hud.checking}>
            <span className="eyebrow">
              {hud.checking
                ? "STASIS CHECK · WAVES HELD"
                : hud.rest > 0
                  ? `${level.name} · ${hud.waveMode === "manual" ? "MANUAL" : "AUTO"}`
                  : level.name}
            </span>
            <b>
              {hud.checking
                ? "Stasis field check"
                : hud.rest > 0
                  ? hud.waveMode === "manual"
                    ? "Setup · no time limit"
                    : hud.moving !== null
                      ? "Setup · move in progress"
                      : "Setup countdown"
                  : `Wave ${hud.wave + 1} / ${hud.total}`}
            </b>
            {hud.checking ? (
              <button className="launch-wave" onClick={stopFieldCheck}>
                End check · back to setup{!touch && <kbd>Enter</kbd>}
              </button>
            ) : hud.rest > 0 ? (
              <button className="launch-wave" onClick={startWave} disabled={survey || hud.moving !== null}>
                <span className={hud.moving !== null ? undefined : "launch-label"}>
                  {hud.moving !== null
                    ? "Finish move first"
                    : hud.waveMode === "manual"
                      ? `Launch wave ${hud.wave + 2}`
                      : `Launch now · ${Math.max(0, Math.ceil(hud.rest))}s`}
                </span>
                <Play size={12} />
                {!touch && <kbd>Enter</kbd>}
              </button>
            ) : (
              <span>{hud.carrier || `${hud.lanes.reduce((n, l) => n + l.count, 0)} threats in flight`}</span>
            )}
          </div>
          <aside className="lane-intel" data-count={hud.lanes.length}>
            {hud.lanes.map((l, i) => (
              <div className={`lane ${l.eta < 6 ? "danger" : ""}`} data-status={l.status} key={l.name}>
                <span className="lane-number">{staged ? laneLabel(i) : `0${i + 1}`}</span>
                <div>
                  <b>
                    {staged && <span className="mobile-gate-letter">{laneLabel(i)} · </span>}
                    {l.name.replace(/-/g, " ")}
                    {level.primaryPath === i && <em className="carrier-tag"> CARRIER</em>}
                  </b>
                  <small>
                    {hud.checking
                      ? "Harmless check target"
                      : l.count
                        ? `${l.count} inbound · ~${Math.ceil(l.eta)}s to core`
                        : l.incoming
                          ? l.next
                          : l.status === "dormant"
                            ? `Opens wave ${l.opensAt}`
                            : "Lane clear"}
                  </small>
                </div>
                <i className={l.count ? "live" : l.incoming ? "waiting" : ""} />
              </div>
            ))}
          </aside>
          {!survey &&
            hud.edges
              .filter((e) => e.visible)
              .map((e, i) => (
                <div
                  className={`edge-cue ${e.urgent ? "danger" : ""}`}
                  key={i}
                  style={{ left: e.x, top: e.y }}
                >
                  <i style={{ transform: `rotate(${e.angle}rad)` }}>➤</i>
                  <span>{e.label}</span>
                </div>
              ))}
          {survey ? (
            <section
              ref={surveyCardRef}
              className="survey-card panel"
              role="dialog"
              aria-label="Tactical Survey"
            >
              <span className="eyebrow">TACTICAL SURVEY · TIME PAUSED</span>
              <h2>
                {frontier
                  ? "Read the three approaches."
                  : relayLab
                    ? "Read the light connection."
                    : "Read the whole spiral."}
              </h2>
              <p>
                {hud.checking
                  ? "Blue targets loop along the real routes. Amber brackets show actual slowing. Weapons, waves and core damage are held."
                  : hud.rest > 0 && wavePlan?.lesson
                    ? wavePlan.lesson
                    : "Coral, gold and pink mark threats. Bright lines belong to your drones. Find where one beam can follow a long stretch of ribbon."}
              </p>
              {staged && (
                <GatePlan
                  level={level}
                  waves={runRef.current?.waves}
                  wave={hud.rest > 0 ? hud.wave + 2 : hud.wave + 1}
                />
              )}
              {scrapGrowth && (
                <p className="fleet-growth-note">
                  No drone cap here. Each type has its own rising price; buying Stasis leaves other types’
                  prices unchanged. Reposition any existing drone for free during setup.
                </p>
              )}
              {driftNote && (
                <p className="drift-note">
                  <b>Drift</b>
                  {driftNote}. Select a drone that lost its line and reposition it for free.
                </p>
              )}
              {newRouteSetup && (
                <button
                  className="route-ghost-toggle"
                  aria-pressed={hud.routeGhost}
                  onClick={toggleRouteGhost}
                >
                  {drifting ? "Moved/new route ribbon" : "New-route ribbon"} · {hud.routeGhost ? "on" : "off"}
                  {!touch && <kbd>G</kbd>}
                </button>
              )}
              {relayLab && <p className="relay-network">{hud.relayNetwork}</p>}
              <div className="survey-stats">
                <span>{hud.kills} intercepted</span>
                <span>{hud.droneKills} by current drones</span>
              </div>
              {hud.fleet.length > 0 && (
                <div className="fleet-manager">
                  <span className="eyebrow">
                    {hud.checking
                      ? "STASIS CHECK · END TO EDIT"
                      : hud.rest > 0
                        ? "SETUP FLEET · SELECT A DRONE"
                        : "FLEET · REVISE BETWEEN WAVES"}
                  </span>
                  <div className="fleet-list">
                    {hud.fleet.map((d) => (
                      <button
                        key={d.id}
                        aria-pressed={d.id === hud.selectedDrone}
                        onClick={() => selectFleet(d.id)}
                      >
                        <b>
                          <span className={`beam-icon ${d.mode}`} aria-hidden="true" />#{d.id}{" "}
                          {DRONE_SPECS[d.mode].label}
                        </b>
                        <span className="fleet-role">{MODE_ROLES[d.mode]}</span>
                        <small>
                          {d.mode === "stasis"
                            ? `${d.slowed} slowed now`
                            : d.mode === "relay"
                              ? d.relayStatus
                              : d.mode === "tripwire" && d.partnerId === null
                                ? "Open post · place its second end"
                                : d.mode === "tripwire" && d.paid === 0
                                  ? `Second post of strand #${d.partnerId}`
                                  : `${d.kills} kills · ${Math.round(d.damage)} damage`}{" "}
                          · paid {d.paid}
                        </small>
                      </button>
                    ))}
                  </div>
                  {selectedUnit && (
                    <>
                      <p className="fleet-selection">
                        {hud.rest > 0
                          ? `Drone #${selectedUnit.id} is marked in cyan.`
                          : `Drone #${selectedUnit.id} selected.`}{" "}
                        Reposition keeps its type and purchase value.
                        {selectedUnit.mode === "relay" &&
                          " Fly and re-aim the receiver between waves; its output follows your fixed aim."}
                        {selectedUnit.mode === "tripwire" &&
                          " Moving one post re-strings the strand from its partner. Recall removes both posts."}
                      </p>
                      {isFieldMode(selectedUnit.mode) && (
                        <div className="anchored-coverage">
                          <span>Route length inside this anchored field</span>
                          <div className="field-routes">
                            {selectedUnit.coverage.map((metres, i) => (
                              <span key={i} data-covered={metres > 0.1}>
                                {staged ? `Gate ${laneLabel(i)}` : `Lane ${i + 1}`}
                                <b>{metres.toFixed(1)}m</b>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="fleet-actions">
                        <button onClick={moveSelected} disabled={hud.rest <= 0 || hud.checking}>
                          Reposition · free
                        </button>
                        <button onClick={sellSelected} disabled={hud.rest <= 0 || hud.checking}>
                          Recall · +
                          {selectedUnit.mode === "tripwire"
                            ? selectedUnit.paid +
                              (hud.fleet.find((d) => d.id === selectedUnit.partnerId)?.paid ?? 0)
                            : selectedUnit.paid}{" "}
                          scrap
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {fields.length > 0 && (
                <div className="field-actions">
                  {hud.checking ? (
                    <button onClick={stopFieldCheck}>End Stasis check</button>
                  ) : (
                    hud.rest > 0 &&
                    hud.moving === null && <button onClick={checkFields}>Test Stasis fields</button>
                  )}
                  <button onClick={saveFieldReport}>Save field report</button>
                </div>
              )}
              <button className="primary" onClick={resume}>
                <Play size={16} />
                Resume flight<kbd>Esc</kbd>
              </button>
            </section>
          ) : (
            <>
              <div className="flight-note">
                <span className="telemetry">
                  {hud.speed.toFixed(0)} m/s <i /> ALT {hud.altitude.toFixed(0)} <i />{" "}
                  {hud.fan
                    ? "LATTICE FANNED"
                    : Math.abs(hud.shift) > 0.2
                      ? "LATTICE SLIDING"
                      : "LATTICE RESTING"}
                </span>
                {hud.checking ? (
                  <p className="lesson-note">
                    <b>Checking Stasis fields</b>Blue targets cannot hurt the core. Follow them; amber
                    brackets mean slowed.{" "}
                    {touch
                      ? "End the check to return to setup."
                      : "Press Enter to end the check and return to setup."}
                  </p>
                ) : hud.rest > 0 && wavePlan?.lesson ? (
                  <p className="lesson-note">
                    <b>{wavePlan.chapter}</b>
                    {wavePlan.lesson}
                  </p>
                ) : (
                  <p>{hud.hint}</p>
                )}
                {!touch && !locked && (
                  <button onClick={grabMouse}>Click the sky for mouse aim · arrows also aim</button>
                )}
              </div>
              <section className="placement panel" data-mode={hud.mode}>
                {relayLab && hud.owned.lumen > 0 && !hud.checking && (
                  <p className="relay-network">{hud.relayNetwork}</p>
                )}
                {fields.length > 0 && (
                  <div className="field-state" data-active={hud.slowed > 0}>
                    <b>{hud.slowed} slowed by Stasis now</b>
                    <span>
                      {hud.touched} enemies affected {hud.checking ? "in this check" : "this flight"} ·{" "}
                      {hud.exposure.toFixed(1)}s total field contact
                    </span>
                    {hud.slowed === 0 && (
                      <span>
                        {hud.nearestField === null
                          ? "No live enemies right now."
                          : `Closest enemy: ${hud.nearestField.toFixed(1)}m · field radius ${STASIS_RADIUS}m`}
                      </span>
                    )}
                  </div>
                )}
                {hud.checking ? (
                  <div className="field-check-note">
                    <span className="eyebrow">STASIS FIELDS ONLY</span>
                    <p>
                      Blue targets loop through every route. Amber spheres are your anchored Stasis fields;
                      amber brackets mean slowed. All damage is off, including Halo and Pin. Your wave is
                      waiting.
                    </p>
                  </div>
                ) : (
                  <>
                    {" "}
                    <div className="placement-heading">
                      <span className="eyebrow">
                        {hud.moving !== null
                          ? `REPOSITION DRONE #${hud.moving}`
                          : previewField
                            ? "FIELD PREVIEW · NOT YET ANCHORED"
                            : wireMode
                              ? wireCompleting
                                ? `SECOND POST · STRAND FROM #${wireOpenPost?.id}`
                                : "FIRST POST · STRAND STARTS HERE"
                              : "AIM THE NEXT ANCHOR"}
                      </span>
                      <span>
                        {hud.moving !== null
                          ? "No scrap cost"
                          : previewField
                            ? "Dashed outline"
                            : hud.drones
                              ? `${hud.droneKills} drone kills`
                              : relayLab
                                ? "Build a light connection"
                                : "Two drones to begin"}
                      </span>
                    </div>
                    {driftNote && hud.moving === null && (
                      <p className="drift-note">
                        <b>Drift</b>
                        {driftNote}
                      </p>
                    )}
                    {modeButtons}
                    <p className="pilot-weapon-note">
                      {hud.moving !== null ? "Moving existing drone" : "Next drone type"} · your pilot gun
                      stays the same
                    </p>
                    <div className="beam-description">{modeDescription}</div>
                    {hud.relayPreview && <p className="relay-preview">{hud.relayPreview}</p>}
                    {newRouteSetup && (
                      <button
                        className="route-ghost-toggle"
                        aria-pressed={hud.routeGhost}
                        onClick={toggleRouteGhost}
                      >
                        {drifting ? "Moved/new route ribbon" : "New-route ribbon"} ·{" "}
                        {hud.routeGhost ? "on" : "off"}
                        <span>{drifting ? "Swung or opening routes" : "Opening routes only"}</span>
                        {!touch && <kbd>G</kbd>}
                      </button>
                    )}
                    <div
                      className="coverage-read"
                      data-good={wireMode ? hud.nowCrossings > 0 : coverageNow > 1}
                    >
                      <span>
                        {wireMode
                          ? hud.wireSpan === null
                            ? "Strand · place the second post next"
                            : `Crossings ${hud.rest > 0 ? "this wave" : "still active"} · ${hud.wireSpan.toFixed(1)}m strand`
                          : hud.mode === "relay" || hud.mode === "lumen"
                            ? hud.rest > 0
                              ? "Connected beam · this wave"
                              : "Connected beam · active routes"
                            : staged
                              ? hud.rest > 0
                                ? "Coverage this wave"
                                : "Coverage still active"
                              : previewField
                                ? "Route length in preview"
                                : "Potential coverage"}
                      </span>
                      <b>
                        {wireMode
                          ? hud.wireSpan === null
                            ? "—"
                            : `${hud.nowCrossings}×`
                          : staged
                            ? `${coverageNow.toFixed(1)} m`
                            : coverageNow < 0.5
                              ? "No contact"
                              : `${coverageNow.toFixed(1)} m`}
                      </b>
                    </div>
                    {staged && (
                      <div className="coverage-timing">
                        <span>
                          {wireMode
                            ? `Later waves · +${hud.laterCrossings} crossings`
                            : `Later waves · +${hud.laterCoverage.toFixed(1)} m`}
                        </span>
                        {hud.idleCoverage > 0.05 && <span>{hud.idleCoverage.toFixed(1)} m cleared</span>}
                      </div>
                    )}
                    {previewField && (
                      <div className="field-routes">
                        {hud.fieldRoutes.map((p, i) => (
                          <span key={p.name} data-covered={p.metres > 0.1}>
                            {staged ? `Gate ${laneLabel(i)}` : `Lane ${i + 1}`}
                            <b>{p.metres.toFixed(1)}m</b>
                          </span>
                        ))}
                      </div>
                    )}
                    {staged && (
                      <span className="coverage-scope">
                        {hud.mode === "relay" || hud.mode === "lumen"
                          ? "Total connected line, not added coverage. "
                          : ""}
                        Hover includes future routes.
                        {hud.idleCoverage > 0.05 && " Cleared routes remain highlighted."}
                      </span>
                    )}
                    <div className="coverage-track">
                      <i
                        style={{
                          width: `${Math.min(100, wireMode ? (hud.nowCrossings / 4) * 100 : (coverageNow / 30) * 100)}%`,
                        }}
                      />
                    </div>
                    <button
                      className="primary anchor"
                      data-anchor
                      onClick={requestAnchor}
                      disabled={cannotBuy}
                    >
                      <Crosshair size={17} />
                      <span>
                        {hud.moving !== null
                          ? "Place moved drone"
                          : wireMode
                            ? wireCompleting
                              ? "Complete strand"
                              : "Anchor first post"
                            : "Anchor drone"}
                      </span>
                      <strong>
                        {hud.moving !== null || hud.cost === 0 ? "Free" : hud.cost}
                        {hud.moving === null && hud.cost > 0 && <small> scrap</small>}
                      </strong>
                      <kbd>F</kbd>
                    </button>
                    <p className="placement-status">
                      {hud.status ??
                        (hud.moving !== null
                          ? "Fly and aim; anchor to commit. Cancel keeps the old placement."
                          : hud.mode === "stasis"
                            ? "Passive field centered on the drone. No shot or damage; strongest slow only."
                            : hud.mode === "halo"
                              ? "Passive damage centered on the drone. Aim does not change its sphere."
                              : wireMode
                                ? hud.wireSpan === null
                                  ? `Posts ignore aim. Anchor here, then fly up to ${TRIPWIRE_MAX_SPAN}m away for the free second post.`
                                  : hud.nowCrossings > 0
                                    ? "Every enemy crossing this strand takes a burst. Cut across routes, not along them."
                                    : "No crossing with this wave yet. Stretch the strand across a ribbon."
                                : hud.mode === "relay"
                                  ? "The receiver must intersect a Lumen line. Reposition in Survey to change its fixed output aim."
                                  : hud.mode === "lumen"
                                    ? "Enemies or receivers stop the light. One Relay can redirect the remaining range; slow never stacks."
                                    : hud.mode === "pin"
                                      ? "Aim a narrow line. Darts stop at the nearest foe; slow continues after contact."
                                      : coverageNow < 0.5
                                        ? staged && hud.coverage >= 0.5
                                          ? "No contact with this wave. Other routes remain highlighted."
                                          : "Aim across the ribbon before anchoring."
                                        : "Anchor here; return to the launch cradle.")}
                    </p>
                    {hud.moving !== null ? (
                      <button className="cancel-move" onClick={cancelMove}>
                        Cancel move · keep original<kbd>C</kbd>
                      </button>
                    ) : (
                      <button
                        className="recall"
                        disabled={!hud.drones || hud.checking || hud.recallSetupOnly}
                        onClick={recall}
                        title={
                          hud.recallSetupOnly
                            ? "Lumen, Relay and Tripwire posts can be recalled during setup only"
                            : hud.lastDrone
                        }
                      >
                        <RotateCcw size={12} />
                        Recall last · full refund<kbd>R</kbd>
                      </button>
                    )}
                    {hud.rest > 0 && hud.drones > 0 && hud.moving === null && !hud.checking && (
                      <button className="manage-fleet" onClick={toggleSurvey}>
                        Select / reposition a drone <kbd>Tab</kbd>
                      </button>
                    )}
                  </>
                )}
                {fields.length > 0 && (
                  <div className="field-actions">
                    {hud.checking ? (
                      <button onClick={stopFieldCheck}>End Stasis check</button>
                    ) : (
                      hud.rest > 0 &&
                      hud.moving === null && <button onClick={checkFields}>Test Stasis fields</button>
                    )}
                    <button onClick={saveFieldReport}>Save field report</button>
                  </div>
                )}
              </section>
              <div className="desktop-keys">
                <span>
                  <kbd>W S</kbd>Fly
                </span>
                <span>
                  <kbd>Shift</kbd>Fan
                </span>
                <span>
                  <kbd>Q E</kbd>Slide
                </span>
                <span>
                  <kbd>Tab</kbd>Survey
                </span>
              </div>
              {touch && (
                <div className="touch-controls">
                  <div className="touch-toolrow">
                    <button
                      className={hud.fan ? "on" : ""}
                      onClick={() => {
                        fanRef.current = !fanRef.current;
                      }}
                    >
                      Fan {hud.fan ? "on" : "off"}
                    </button>
                    <button
                      className={hud.shift < -0.2 ? "on" : ""}
                      onClick={() => {
                        shiftRef.current = shiftRef.current === -1 ? 0 : -1;
                      }}
                    >
                      Slide ‹
                    </button>
                    <button
                      className={hud.shift > 0.2 ? "on" : ""}
                      onClick={() => {
                        shiftRef.current = shiftRef.current === 1 ? 0 : 1;
                      }}
                    >
                      Slide ›
                    </button>
                  </div>
                  <div
                    className="stick-pad"
                    aria-label="Aim"
                    onPointerDown={(e) => bindStick(left, leftKnob, e)}
                  >
                    <span>AIM</span>
                    <div ref={leftKnob} className="stick-knob" />
                  </div>
                  <div className="touch-middle">
                    <button className="touch-anchor" data-anchor onClick={requestAnchor} disabled={cannotBuy}>
                      {hud.moving !== null ? "Place" : "Anchor"}{" "}
                      <b>{hud.moving !== null ? "Free" : hud.cost}</b>
                    </button>
                    {hud.moving !== null ? (
                      <button onClick={cancelMove}>Cancel move</button>
                    ) : (
                      <button onClick={recall} disabled={!hud.drones || hud.checking || hud.recallSetupOnly}>
                        Recall last
                      </button>
                    )}
                  </div>
                  <div
                    className="stick-pad"
                    aria-label="Fly forward or reverse"
                    onPointerDown={(e) => bindStick(right, rightKnob, e)}
                  >
                    <span>FLY</span>
                    <div ref={rightKnob} className="stick-knob" />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      {phase === "title" && (
        <>
          <div className="arena-caption">
            <span className="eyebrow">
              {prototype
                ? "SPATIAL PROTOTYPE"
                : level.experiment
                  ? "OPTIONAL TEST FLIGHT"
                  : level.archived
                    ? "ARCHIVED ARENA"
                    : `${String(LEVELS.filter((l) => !l.experiment && !l.prototype && !l.archived).indexOf(level) + 1).padStart(2, "0")} / ORBITAL DEFENSE STUDY`}
            </span>
            <h2>{level.name}</h2>
            <p>{level.subtitle}</p>
          </div>
          <main className="brief panel">
            <span className="eyebrow">PILOT. POSITION. PERSIST.</span>
            <h1>
              Helix<span>Hold.</span>
            </h1>
            <p className="intro">Every flight leaves a defense.</p>
            <p className="deck">
              Fly into an angle. Anchor a drone on your sightline. Return to the cradle and build the next.
            </p>
            <div className="arena-list">
              {LEVELS.map((l, i) => ({ l, i }))
                .filter(({ l }) => !l.experiment && !l.prototype && !l.archived)
                .map(({ l, i }, displayIndex) => (
                  <button
                    key={l.id}
                    className={`arena-option ${selected === i ? "selected" : ""}`}
                    onClick={() => preview(i)}
                  >
                    <ArenaGlyph index={i} />
                    <span>
                      <b>{l.name}</b>
                      <small>{l.subtitle}</small>
                    </span>
                    <span className="arena-index">
                      {(save.bestByLevel[l.id] ?? -1) >= 0
                        ? `${save.bestByLevel[l.id]}%`
                        : `0${displayIndex + 1}`}
                    </span>
                  </button>
                ))}
            </div>
            <section className="experiment-list" aria-label="Optional experiments">
              <span className="eyebrow">LAB · OPTIONAL EXPERIMENTS</span>
              {[
                {
                  index: FRONTIER_INDEX,
                  label: "Helix Frontier",
                  note: "Three coils · 9-wave spatial prototype",
                },
                {
                  index: DRIFT_INDEX,
                  label: "Drift Frontier",
                  note: "Coils swing between waves · 12-wave late game",
                },
                { index: RELAY_LAB_INDEX, label: "Relay Lab", note: "Slowing light · one fixed redirection" },
                { index: CARRIER_TEST_INDEX, label: "Stasis + carrier", note: "Short field comparison" },
              ].map((lab) => (
                <button
                  key={lab.index}
                  className={`lab-option ${selected === lab.index ? "selected" : ""}`}
                  onClick={() => preview(lab.index)}
                >
                  <span>
                    <b>{lab.label}</b>
                    <small>{lab.note}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </section>
            <div className="arena-archive">
              {LEVELS.map((l, i) => ({ l, i }))
                .filter(({ l }) => l.archived)
                .map(({ l, i }) => (
                  <button key={l.id} className={selected === i ? "selected" : ""} onClick={() => preview(i)}>
                    Archived study · {l.name}
                  </button>
                ))}
              {frontier && (
                <a href="./frontier-routes.svg" target="_blank" rel="noreferrer">
                  Frontier route chart ↗
                </a>
              )}
              {crown && (
                <a href="./split-crown-routes.svg" target="_blank" rel="noreferrer">
                  Split Crown route chart ↗
                </a>
              )}
              <a href="./arena-studies.svg" target="_blank" rel="noreferrer">
                Arena design studies ↗
              </a>
            </div>
            <p className="arena-briefing">{level.briefing}</p>
            {scrapGrowth && (
              <p className="fleet-growth-note">
                Build as scrap allows · no drone cap. Each type has its own rising price. A Stasis purchase
                leaves Pierce’s price unchanged. Setup repositioning is free.
              </p>
            )}
            {staged && <GatePlan level={level} />} {pacingControls}
            <button className="primary start" onClick={() => launch(selected)} disabled={!!bootError}>
              {prototype ? "Enter prototype" : level.experiment ? "Enter test flight" : "Enter the spiral"}
              <ArrowUpRight size={21} />
            </button>
            <div className="start-note">
              <span>
                {level.startingScrap ?? 60} scrap · {relayLab ? "try Lumen + Relay" : "two early drones"}
              </span>
              <button onClick={() => setHelp(true)}>Flight guide ↗</button>
            </div>
            {bootError && <p className="error">{bootError}</p>}
          </main>
          <div className="title-footer">
            <span>FLIGHT SCHOOL. SHEAR. SPLIT CROWN.</span>
            <span>Orbital remains available in the archive</span>
          </div>
        </>
      )}
      {phase === "pause" && !survey && (
        <section className="pause-card panel">
          <span className="eyebrow">FLIGHT ON HOLD</span>
          <h2>A moment to think.</h2>
          <p>
            {hud.checking
              ? "Your Stasis field check is paused."
              : "Your drones and the incoming wave are paused."}
          </p>
          {pacingControls}
          <p className="pacing-paused-note">A wave already in flight continues when you resume.</p>
          <button className="primary" onClick={resume}>
            <Play size={18} />
            Resume flight
          </button>
          <button className="secondary" onClick={() => setHelp(true)}>
            Flight guide
          </button>
          {fields.length > 0 && (
            <button className="secondary" onClick={saveFieldReport}>
              Save field report
            </button>
          )}
          <button className="text-button" onClick={toTitle}>
            Back to the observatory
          </button>
        </section>
      )}
      {(phase === "win" || phase === "lose") && (
        <section className="debrief panel">
          <span className="eyebrow">
            {level.name} · {prototype ? "PROTOTYPE DEBRIEF" : "FLIGHT RECORD"}
          </span>
          <h2>
            {prototype && phase === "win"
              ? "Prototype complete."
              : phase === "win"
                ? `${debrief?.continued ? baseWaveCount + extraWaveCount : baseWaveCount} waves held.`
                : "A line got through."}
          </h2>
          <p>{debriefCopy}</p>
          <div className="result-grid">
            <div>
              <strong>{debrief?.core}%</strong>
              <span>core remaining</span>
            </div>
            <div>
              <strong>{debrief?.kills}</strong>
              <span>intercepted</span>
            </div>
            <div>
              <strong>{debrief?.droneKills}</strong>
              <span>by current drones</span>
            </div>
          </div>
          {canContinue && (
            <button className="primary continue-flight" onClick={continueFlight}>
              Continue to waves {baseWaveCount + 1}–{baseWaveCount + extraWaveCount}
              <ArrowUpRight size={16} />
            </button>
          )}
          <button className={canContinue ? "secondary" : "primary"} onClick={() => launch(selected)}>
            Fly this arena again
            <RotateCcw size={16} />
          </button>
          {phase === "win" && nextArena >= 0 && (
            <button className="secondary" onClick={() => launch(nextArena)}>
              {nextArena === CARRIER_TEST_INDEX ? "Try optional test flight" : "Explore the next arena"}
              <ArrowUpRight size={17} />
            </button>
          )}
          <button className="text-button" onClick={toTitle}>
            Back to the observatory
          </button>
        </section>
      )}
      {help && (
        <div className="help-backdrop">
          <section
            ref={helpCardRef}
            className="help-card panel"
            role="dialog"
            aria-modal="true"
            aria-label="Flight guide"
          >
            <button className="close" onClick={() => setHelp(false)} aria-label="Close flight guide">
              <X size={20} />
            </button>
            <span className="eyebrow">FLIGHT GUIDE</span>
            <h2>Build with your flight.</h2>
            <ol>
              <li>
                <b>Take your time.</b> Plan & launch leaves setup open until you send the wave. Fly, place,
                and revise freely. Auto waves is optional.
              </li>
              <li>
                <b>Find a line.</b> Your ship fires automatically. Selecting a drone type changes your next
                anchor, not your pilot gun.
              </li>
              <li>
                <b>Leave a drone.</b> Anchor when the coverage highlight looks useful. A beam or dart holds
                your aim; a passive field holds your position. You return to the cradle.
              </li>
              <li>
                <b>Adjust the defense.</b> Fan or slide the drones together. During setup, open Survey to
                select any drone. Reposition it for free, or recall it for its actual paid price. Moving
                reuses the same drone; Anchor commits and Cancel keeps its old placement.
              </li>
            </ol>
            <div className="guide-beams">
              <div>
                <span className="beam-icon pierce" />
                <b>Pierce</b>
                <p>Long and narrow. Damages every foe in its line.</p>
              </div>
              <div>
                <span className="beam-icon sweep" />
                <b>Sweep</b>
                <p>Short and wide. Damages only its nearest foe.</p>
              </div>
            </div>
            <p className="fine-print">
              The ribbon highlight shows potential contact for Shards. Wisps weave outside it; their faint
              tethers point back to the ribbon. Barges stay on the route. Another enemy can block Sweep or
              Pin. Field highlights test actual 3D distance, not overlap on screen. A highlight is coverage,
              not a guaranteed kill.
            </p>
            {stasisAvailable && (
              <p className="lab-guide">
                Stasis (3) is a passive sphere centered on its drone: 6m radius (12m across), half speed for
                enemies inside. It never fires a shot. Your separate pilot gun continues firing when you
                select Stasis. The dashed sphere follows your ship as a preview; solid spheres belong to
                placed drones. Amber brackets identify enemies actually slowed. During setup, Test Stasis
                fields sends harmless blue targets through every route. It tests only Stasis; all damage,
                including Halo and Pin, is held. End check{!touch && " (Enter)"} returns to setup. Save field
                report downloads the exact game state if an effect looks wrong. It deals no damage and{" "}
                {perType
                  ? "has its own price: 32 scrap, then +20 for each Stasis already owned. It does not raise other types’ prices. There is no drone cap in this arena."
                  : "uses a paid drone slot."}{" "}
                Slows use the strongest effect, never multiply; fan and slide move fields with the lattice.
                The metre readout sums route length inside the preview, not distance to enemies. Amber route
                highlights show nominal route coverage; drifting Wisps may leave the field.{" "}
                {selected === CARRIER_TEST_INDEX
                  ? "Sweep tries 22 DPS in this test flight only. The carrier follows the wide Shear route."
                  : crown
                    ? `Split Crown uses standard 18 DPS Sweep. Gate E carries the wave-${baseWaveCount} carrier and, if you continue, the stronger wave-${baseWaveCount + extraWaveCount} carrier. Its transfer visits both crowns.`
                    : "This prototype uses the standard 18 DPS Sweep."}
                {!prototype && " A carrier breach costs 40 core."}
              </p>
            )}
            {modes.includes("pin") && (
              <div className="guide-beams guide-extra">
                {expanded && (
                  <div>
                    <span className="beam-icon halo" />
                    <b>Halo · 4</b>
                    <p>
                      Passive damage field: {HALO_RADIUS}m radius ({HALO_RADIUS * 2}m across),{" "}
                      {DRONE_SPECS.halo.dps} damage per second to every enemy center inside. No aim, shots or
                      slowing. Fly onto a useful route crossing before anchoring.
                    </p>
                  </div>
                )}
                <div>
                  <span className="beam-icon pin" />
                  <b>Pin · 5</b>
                  <p>
                    Aim a fixed {DRONE_SPECS.pin.range}m line, {DRONE_SPECS.pin.radius}m radius. Every{" "}
                    {PIN_INTERVAL}s it hits the nearest enemy along the line for {PIN_DAMAGE} damage and{" "}
                    {Math.round((1 - PIN_SPEED_SCALE) * 100)}% slow lasting {PIN_SLOW_DURATION}s. Targets must
                    cross this line; the drone never turns to chase them.
                  </p>
                </div>
              </div>
            )}
            {relayLab && (
              <p className="lab-guide">
                One Lumen emitter sends slowing light along its fixed aim. A Relay receives that line and
                turns its remaining range along the aim you chose when anchoring it. There is one redirection
                per beam, no splitting or extra range. An enemy before the receiver cuts off its outgoing
                light; another receiver stops the output. Fan and Slide can break or restore links. Planned
                connections show possible coverage, not guaranteed power. Reposition the Relay for free during
                setup to change its direction. Stasis and Pin remain available for comparison. This lab has no
                campaign score.
              </p>
            )}
            {modes.includes("tripwire") && (
              <div className="guide-beams guide-extra">
                <div>
                  <span className="beam-icon tripwire" />
                  <b>Tripwire · 6</b>
                  <p>
                    Anchor a first post anywhere, then fly up to {TRIPWIRE_MAX_SPAN}m away and anchor the free
                    second post. Every enemy that crosses the strand between them takes {TRIPWIRE_DAMAGE}{" "}
                    damage, once per crossing, however fast it moves. Riding along the strand counts once, so
                    cut across ribbons and coil turns instead of following them. Posts ignore aim.
                  </p>
                </div>
              </div>
            )}
            {drifting && (
              <p className="lab-guide">
                Drift Frontier uses the same coils, but from wave 4 an announced coil swings around the prism
                before each wave. Your drones never move by themselves: lines on a swung coil lose contact.
                The placement panel and Survey show each swing with your contact before and after; the moved
                route gets a ribbon (G). Reposition is free during setup. Waves 8–12 are deliberately heavy.
              </p>
            )}
            {frontier && !drifting && (
              <p className="lab-guide">
                Helix Frontier opens A on wave 1, B on wave 3 and C on wave 6. Each coil ends at its own
                breach port on the protected prism. The new-route ribbon highlights only the route opening in
                the next setup. Toggle it with G or in Survey. Nine light waves test the geometry; this is not
                yet endless survival and does not record a campaign score.
              </p>
            )}
            {perType && (
              <p className="pricing-guide">
                Each type prices independently from the number currently owned: Pierce 20 + 12, Sweep 24 + 12,
                Stasis 32 + 20,{" "}
                {relayLab
                  ? "Pin 48 + 24, Lumen 48 (one emitter), Relay 16 + 8"
                  : frontier
                    ? "Halo 44 + 20, Pin 48 + 24, Tripwire 36 + 18 per strand"
                    : "Halo 44 + 20, Pin 48 + 24"}{" "}
                scrap. The first number is its starting price; the second is the increase for each owned unit
                of that type. Every button shows your actual next price. Reposition is free and preserves the
                unit’s mode; Recall refunds its actual paid amount.
              </p>
            )}
            <div className="enemy-guide">
              <span>
                <i className="shard" />
                Shards<small>Quick & fragile</small>
              </span>
              <span>
                <i className="barge" />
                Barges<small>Armored · on the ribbon</small>
              </span>
              <span>
                <i className="wisp" />
                Wisps<small>Pink · tethered drift</small>
              </span>
            </div>
            <div className="guide-controls">
              {touch ? (
                <p>
                  Left stick aims; right stick flies forward or backward. Fan and Slide toggle so both thumbs
                  stay free. Survey pauses time.
                </p>
              ) : (
                <>
                  <p>
                    <kbd>W / S</kbd>Thrust / reverse <kbd>Mouse / arrows</kbd>Aim
                  </p>
                  <p>
                    <kbd>A / D</kbd>Turn <kbd>Space</kbd>Boost <kbd>F</kbd>Anchor
                  </p>
                  <p>
                    <kbd>
                      {relayLab
                        ? "1–3 / 5–7"
                        : modes.includes("tripwire")
                          ? "1–6"
                          : expanded
                            ? "1–5"
                            : stasisAvailable
                              ? "1–3"
                              : "1 / 2"}
                    </kbd>
                    Next drone <kbd>R</kbd>Recall last <kbd>Shift</kbd>Fan
                  </p>
                  <p>
                    <kbd>Q / E</kbd>Slide <kbd>Tab</kbd>Survey <kbd>Esc</kbd>Pause <kbd>Enter</kbd>Launch wave
                    / end field check
                  </p>
                </>
              )}
            </div>
            <button className="primary" onClick={() => setHelp(false)}>
              Ready to fly
              <ArrowUpRight size={17} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
