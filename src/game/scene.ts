import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CORE, PATH_COLORS, type Kind } from "./paths";
import { beamContact, DRONE_SPECS, insideStasis, STASIS_RADIUS, type Beam } from "./combat";
import { BEAM_RANGE, MAX_DRONES, SHIP_DPS, SHIP_RADIUS, droneBeam, getFieldCoverage, getBeamCoverage, getLaneFirstWave, getLaneStatus, getPlacementPreview, type Run } from "./sim";

export type Projection = { x: number; y: number; visible: boolean; behind: boolean };
export type World = {
  sync: (run: Run, dt: number, elapsed: number) => void;
  resize: (w: number, h: number, dpr: number) => void;
  project: (x: number, y: number, z: number) => Projection;
  projectEdge: (x: number, y: number, z: number, padding?: number) => Projection & { angle: number };
  setOverview: (on: boolean) => void;
  dispose: () => void;
};

const PALETTE = { ice: 0x71e7ef, lavender: 0xb5a2ff, coral: 0xff826f, gold: 0xffcf7e, orchid: 0xff79be };
const KIND_COLOR = { shard: PALETTE.coral, barge: PALETTE.gold, wisp: PALETTE.orchid, carrier: 0xff7259 } as const;
const SPLIT_PATH_COLORS = [0x71e7ef, 0xb5a2ff, 0xffb277, 0x84d7ac, 0xff92a2] as const;
function pathColor(run: Run, index: number): number {
  if (run.level.presentation === "split-crown") return SPLIT_PATH_COLORS[index] ?? PALETTE.ice;
  return run.level.primaryPath === index ? 0xffb692 : PATH_COLORS[index] ?? PALETTE.ice;
}
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _up = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _color = new THREE.Color();
const _hot = new THREE.Color(0xfffaf0);
const _dummy = new THREE.Object3D();

function aimAlong(obj: THREE.Object3D, fx: number, fy: number, fz: number, roll = 0) {
  _z.set(fx, fy, fz).normalize();
  if (_z.lengthSq() < 1e-8) _z.set(0, 0, -1);
  _up.set(0, 1, 0);
  if (Math.abs(_z.dot(_up)) > 0.96) _up.set(0, 0, -1);
  _x.crossVectors(_up, _z).normalize();
  _y.crossVectors(_z, _x).normalize();
  if (roll !== 0) {
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const xx = _x.x, xy = _x.y, xz = _x.z;
    _x.set(xx * cr + _y.x * sr, xy * cr + _y.y * sr, xz * cr + _y.z * sr);
    _y.set(-xx * sr + _y.x * cr, -xy * sr + _y.y * cr, -xz * sr + _y.z * cr);
  }
  _m4.makeBasis(_x, _y, _z);
  obj.quaternion.setFromRotationMatrix(_m4);
}

function glowMaterial(hex: number, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color: hex, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, fog: false });
}

function buildShip() {
  const group = new THREE.Group();
  const pearl = new THREE.MeshStandardMaterial({ color: 0xe1e7f1, metalness: 0.45, roughness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x404967, metalness: 0.5, roughness: 0.4 });
  const ice = glowMaterial(PALETTE.ice);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.08, 6, 12), pearl);
  body.rotation.x = Math.PI / 2;
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), steel);
  cockpit.scale.set(0.75, 0.7, 1.5);
  cockpit.position.set(0, 0.2, 0.3);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.52, 12), ice);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.98;
  group.add(body, cockpit, nose);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.055, 0.42), pearl);
    wing.position.set(side * 0.56, 0, -0.25);
    wing.rotation.y = side * 0.4;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.42), ice);
    tip.position.set(side * 1, 0.02, -0.42);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.4, 8), steel);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * 0.42, -0.025, -0.75);
    group.add(wing, tip, engine);
  }
  const exhaust = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), ice);
  exhaust.position.z = -0.95;
  exhaust.name = "glow";
  group.add(exhaust);
  group.scale.setScalar(1.25);
  return group;
}

function buildDrone(ghost = false) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: ghost ? 0xc3b5ff : 0xc4c6e3, metalness: 0.45, roughness: 0.32, transparent: ghost, opacity: ghost ? 0.4 : 1 });
  const accent = glowMaterial(PALETTE.lavender, ghost ? 0.48 : 1);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 28), metal);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 6, 20), accent);
  inner.name = "iris";
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.09, 0.8, 8), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.2;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), accent);
  eye.position.z = 0.65;
  eye.name = "eye";
  group.add(ring, inner, barrel, eye);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.48), metal);
    const angle = (i / 3) * Math.PI * 2;
    fin.position.set(Math.sin(angle) * 0.65, Math.cos(angle) * 0.65, -0.16);
    fin.rotation.z = -angle;
    group.add(fin);
  }
  return group;
}

/** Boundary samples share the simulation's radius. Dashed outlines are only a proposal;
 * an anchored field has solid outlines and a faint skin, never a larger glow volume. */
export function buildStasisFieldVisual(preview = false) {
  const group = new THREE.Group();
  const options = { color: DRONE_SPECS.stasis.color, transparent: true, opacity: preview ? 0.62 : 0.3, depthWrite: false, fog: false };
  const boundary = preview
    ? new THREE.LineDashedMaterial({ ...options, dashSize: 0.55, gapSize: 0.4 })
    : new THREE.LineBasicMaterial(options);
  const points = Array.from({ length: 97 }, (_, i) => {
    const angle = i / 96 * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * STASIS_RADIUS, Math.sin(angle) * STASIS_RADIUS, 0);
  });
  const circle = new THREE.BufferGeometry().setFromPoints(points);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Line(circle, boundary);
    if (i === 1) ring.rotation.x = Math.PI / 2;
    if (i === 2) ring.rotation.y = Math.PI / 2;
    ring.computeLineDistances(); group.add(ring);
  }
  const skin = preview ? null : glowMaterial(DRONE_SPECS.stasis.color, 0.012);
  if (skin) group.add(new THREE.Mesh(new THREE.SphereGeometry(STASIS_RADIUS, 24, 16), skin));
  group.visible = false;
  return { group, boundary, skin };
}

type EnemyGeometry = { hull: THREE.BufferGeometry; accent: THREE.BufferGeometry };
type ColoredPart = [THREE.BufferGeometry, number];

/** Solid hull and luminous fittings both stay inside the kind's spherical hit volume.
 * Only soft halos and exhaust trails are decorative; they do not imply collision. */
export function buildEnemyGeometries(): Record<Kind, EnemyGeometry> {
  const pearl = 0xcdd3e2, shell = 0x98a7be, slate = 0x53647d;
  function merge(parts: ColoredPart[]) {
    const geometries = parts.map(([source, hex]) => {
      const geometry = source.index ? source.toNonIndexed() : source;
      if (geometry !== source) source.dispose();
      geometry.deleteAttribute("uv");
      const color = new THREE.Color(hex), colors = new Float32Array(geometry.attributes.position!.count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      return geometry;
    });
    const geometry = mergeGeometries(geometries, false)!;
    geometries.forEach((part) => part.dispose());
    geometry.computeBoundingSphere();
    return geometry;
  }
  function ellipsoid(x: number, y: number, z: number, segments = 12) {
    return new THREE.SphereGeometry(1, segments, 8).scale(x, y, z);
  }
  const shardHull: ColoredPart[] = [
    [ellipsoid(0.17, 0.15, 0.63), pearl],
    [ellipsoid(0.11, 0.1, 0.3).translate(0, 0.12, 0.12), slate],
  ];
  for (const side of [-1, 1]) {
    shardHull.push([new THREE.TetrahedronGeometry(0.36).scale(1, 0.18, 0.76).rotateY(side * 0.25).translate(side * 0.27, 0, -0.16), shell]);
  }
  const shardAccent: ColoredPart[] = [
    [ellipsoid(0.105, 0.065, 0.28).translate(0, 0.166, 0.13), 0xffffff],
    [new THREE.TorusGeometry(0.17, 0.019, 5, 18).translate(0, 0, -0.35), 0xffffff],
    [ellipsoid(0.075, 0.075, 0.07).translate(0, 0, -0.61), 0xffffff],
  ];

  const bargeHull: ColoredPart[] = [[ellipsoid(0.52, 0.49, 1.08), slate]];
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    // Rounded armor leaves surround a dark central seed; no box corners extend past the hit sphere.
    const armor = ellipsoid(0.28, 0.17, 0.88).translate(0, 0.44, 0).rotateZ(angle);
    bargeHull.push([armor, i % 2 ? shell : pearl]);
  }
  const bargeAccent: ColoredPart[] = [
    [new THREE.TorusGeometry(0.605, 0.04, 5, 30), 0xffffff],
    [new THREE.TorusGeometry(0.485, 0.035, 5, 28).translate(0, 0, -0.56), 0xffffff],
    [ellipsoid(0.13, 0.13, 0.1).translate(0, 0, 1.09), 0xffffff],
    [ellipsoid(0.14, 0.14, 0.055).translate(0, 0, -1.075), 0xffffff],
  ];

  const wispHull: ColoredPart[] = [[ellipsoid(0.14, 0.14, 0.32), pearl]];
  for (let i = 0; i < 3; i++) {
    const petal = ellipsoid(0.095, 0.22, 0.28).translate(0, 0.24, -0.045).rotateZ(i * Math.PI * 2 / 3);
    wispHull.push([petal, i === 1 ? shell : pearl]);
  }
  const wispAccent: ColoredPart[] = [
    [new THREE.TorusGeometry(0.49, 0.017, 5, 36).rotateX(0.42), 0xffffff],
    [new THREE.TorusGeometry(0.32, 0.011, 5, 28).rotateY(-0.65), 0xffffff],
    [ellipsoid(0.105, 0.105, 0.09).translate(0, 0, 0.33), 0xffffff],
  ];
  const barge = { hull: merge(bargeHull), accent: merge(bargeAccent) };
  return {
    carrier: { hull: barge.hull.clone().scale(1.7, 1.7, 1.7), accent: barge.accent.clone().scale(1.7, 1.7, 1.7) },
    shard: { hull: merge(shardHull), accent: merge(shardAccent) },
    barge,
    wisp: { hull: merge(wispHull).scale(1.2, 1.2, 1.2), accent: merge(wispAccent).scale(1.2, 1.2, 1.2) },
  };
}

type Spark = { life: number; max: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number; g: number; b: number };
type Gate = { root: THREE.Group; ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>; iris: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>; halo: THREE.Sprite; label?: THREE.Sprite; labelTexture?: THREE.CanvasTexture };

/** Non-interactive landmarks sit below the flight floor or outside each coil.
 * Their dim, broken outlines remain subordinate to the actual route ribbons. */
export function buildSplitCrownArchitecture() {
  const group = new THREE.Group();
  for (const [x, z, color] of [[-21, -4, 0x7198af], [21, 4, 0xa894bd]] as const) {
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(12.4, 13.1, 0.8, 64), new THREE.MeshStandardMaterial({ color: 0x19253a, metalness: 0.4, roughness: 0.7 }));
    platform.position.set(x, -1.35, z); group.add(platform);
    for (let sector = 0; sector < 8; sector++) {
      const start = sector * Math.PI / 4 + 0.07;
      const arc = new THREE.Mesh(new THREE.TorusGeometry(12.5, 0.025, 4, 18, Math.PI / 4 - 0.14), glowMaterial(color, 0.22));
      arc.rotation.x = Math.PI / 2; arc.rotation.z = start;
      arc.position.set(x, -0.89, z); group.add(arc);
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, sector % 2 ? 0.65 : 1.15), glowMaterial(color, 0.22));
      tick.position.set(x + Math.cos(start) * 11.5, -0.89, z + Math.sin(start) * 11.5); tick.rotation.y = Math.PI / 2 - start; group.add(tick);
    }

  }
  return group;
}

export function createWorld(canvas: HTMLCanvasElement): World {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x101629, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const scene = new THREE.Scene();
  const sceneFog = new THREE.Fog(0x19263d, 95, 235);
  scene.fog = sceneFog;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
  scene.add(new THREE.HemisphereLight(0xc4dcff, 0x27324c, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(-20, 45, 30);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbca9ff, 1.3);
  rim.position.set(18, 10, -20);
  scene.add(rim);
  const coreLight = new THREE.PointLight(PALETTE.ice, 20, 30, 2);
  coreLight.position.set(CORE.x, CORE.y, CORE.z);
  scene.add(coreLight);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(280, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vPosition; void main(){float h=normalize(vPosition).y; vec3 bottom=vec3(.075,.12,.19);vec3 top=vec3(.018,.026,.075);vec3 c=mix(bottom,top,smoothstep(-.3,.7,h));float haze=pow(max(0.,1.-abs(h-.03)),18.);c+=vec3(.036,.045,.063)*haze;gl_FragColor=vec4(c,1.);}`,
  }));
  scene.add(sky);
  const starPos = new Float32Array(400 * 3);
  let seed = 827;
  function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  for (let i = 0; i < 400; i++) {
    const radius = 140 + random() * 110, angle = random() * Math.PI * 2, height = random() * 1.6 - 0.5;
    starPos[i * 3] = Math.cos(angle) * Math.sqrt(1 - height * height / 2) * radius;
    starPos[i * 3 + 1] = height * radius;
    starPos[i * 3 + 2] = Math.sin(angle) * Math.sqrt(1 - height * height / 2) * radius;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xa6b6d8, size: 0.34, transparent: true, opacity: 0.7, fog: false })));

  // A restrained observatory deck, vertical graduations, and orbital arcs give the helix a scale.
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(46, 44, 1, 96), new THREE.MeshStandardMaterial({ color: 0x172237, metalness: 0.38, roughness: 0.72 }));
  deck.position.y = -2.5;
  scene.add(deck);
  const grid = new THREE.PolarGridHelper(44, 12, 6, 96, 0x3a526a, 0x283c54);
  grid.position.y = -1.96;
  scene.add(grid);
  for (const radius of [8, 25, 43.8]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius > 40 ? 0.08 : 0.026, 6, 120), glowMaterial(0x638699, radius > 40 ? 0.6 : 0.32));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.94;
    scene.add(ring);
  }
  const architecture = new THREE.Group();
  for (let p = 0; p < 6; p++) {
    const angle = (p / 6) * Math.PI * 2, x = Math.cos(angle) * 34, z = Math.sin(angle) * 34;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.12, 38, 5), glowMaterial(0x67849e, 0.25));
    pillar.position.set(x, 17, z);
    architecture.add(pillar);
    for (let h = 0; h <= 36; h += 4) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(h % 12 === 0 ? 0.8 : 0.32, 0.035, 0.05), glowMaterial(0x90b5c9, h % 12 === 0 ? 0.42 : 0.24));
      tick.position.set(x, h, z);
      tick.rotation.y = -angle;
      architecture.add(tick);
    }
  }
  scene.add(architecture);
  const splitArchitecture = buildSplitCrownArchitecture();
  splitArchitecture.visible = false; scene.add(splitArchitecture);

  // One tiny generated radial texture, shared by halos and exhaust, keeps silhouettes visible.
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  const ctx = glowCanvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,.8)");
  gradient.addColorStop(0.2, "rgba(255,255,255,.5)");
  gradient.addColorStop(0.55, "rgba(255,255,255,.12)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const makeHalo = (hex: number, opacity: number) => new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: hex, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));

  const ship = buildShip(); scene.add(ship);
  const drones = Array.from({ length: MAX_DRONES }, () => { const drone = buildDrone(); drone.visible = false; drone.userData.relocating = false; scene.add(drone); return drone; });
  const droneMaterialDefaults = new WeakMap<THREE.Material, { transparent: boolean; opacity: number; depthWrite: boolean }>();
  const ghost = buildDrone(true); ghost.visible = false; scene.add(ghost);
  const selectedDroneRing = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.032, 6, 40), glowMaterial(PALETTE.ice, 0.84));
  selectedDroneRing.visible = false; scene.add(selectedDroneRing);

  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  beamGeo.translate(0, 0.5, 0); beamGeo.rotateX(Math.PI / 2);
  const beams = Array.from({ length: MAX_DRONES + 1 }, () => {
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    beam.frustumCulled = false; beam.visible = false; scene.add(beam); return beam;
  });
  const droneShells = Array.from({ length: MAX_DRONES }, () => {
    const shell = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: PALETTE.lavender, transparent: true, opacity: 0.012, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    shell.visible = false; shell.frustumCulled = false; scene.add(shell); return shell;
  });
  const targetRings = Array.from({ length: MAX_DRONES }, () => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.024, 5, 36), glowMaterial(PALETTE.ice, 0.75));
    ring.visible = false; scene.add(ring); return ring;
  });
  // The proposed drone's true finite cylinder is a translucent shell with sparse depth hoops.
  const previewVolume = new THREE.Group();
  const volumeMat = new THREE.MeshBasicMaterial({ color: PALETTE.lavender, transparent: true, opacity: 0.026, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const volume = new THREE.Mesh(beamGeo, volumeMat); volume.frustumCulled = false; previewVolume.add(volume);
  const hoops = Array.from({ length: 5 }, (_, i) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(1, 0.009, 4, 36), glowMaterial(PALETTE.lavender, i === 0 || i === 4 ? 0.25 : 0.11));
    previewVolume.add(hoop); return hoop;
  });
  previewVolume.visible = false; scene.add(previewVolume);

  const fields = Array.from({ length: MAX_DRONES }, () => buildStasisFieldVisual());
  const fieldPreview = buildStasisFieldVisual(true);
  for (const field of [...fields, fieldPreview]) scene.add(field.group);

  const COVERAGE_MAX = 4096;
  const coverageGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 5, 1, true);
  coverageGeo.rotateX(Math.PI / 2);
  const coverage = new THREE.InstancedMesh(coverageGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), COVERAGE_MAX);
  coverage.count = 0; coverage.frustumCulled = false; coverage.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(coverage);
  let coverageClock = 1;

  const enemyGeometry = buildEnemyGeometries();
  const hullMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.42, roughness: 0.34, emissive: 0x536b91, emissiveIntensity: 0.2, fog: false });
  const accentMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, fog: false });
  const meshes = {
    carrier: new THREE.InstancedMesh(enemyGeometry.carrier.hull, hullMaterial, 64),
    shard: new THREE.InstancedMesh(enemyGeometry.shard.hull, hullMaterial, 64),
    barge: new THREE.InstancedMesh(enemyGeometry.barge.hull, hullMaterial, 64),
    wisp: new THREE.InstancedMesh(enemyGeometry.wisp.hull, hullMaterial, 64),
  };
  const accentMeshes = {
    carrier: new THREE.InstancedMesh(enemyGeometry.carrier.accent, accentMaterial, 64),
    shard: new THREE.InstancedMesh(enemyGeometry.shard.accent, accentMaterial, 64),
    barge: new THREE.InstancedMesh(enemyGeometry.barge.accent, accentMaterial, 64),
    wisp: new THREE.InstancedMesh(enemyGeometry.wisp.accent, accentMaterial, 64),
  };
  const enemyHalos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, map: glowTexture, transparent: true, opacity: 0.36, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 192);
  const enemyTrails = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 192);
  // Small screen-facing corner brackets encode actual slow state without recoloring the hull.
  const bracketParts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    bracketParts.push(new THREE.PlaneGeometry(0.38, 0.045).translate(sx * 0.88, sy * 1.05, 0));
    bracketParts.push(new THREE.PlaneGeometry(0.045, 0.38).translate(sx * 1.05, sy * 0.88, 0));
  }
  const slowBracketGeometry = mergeGeometries(bracketParts)!;
  bracketParts.forEach(part => part.dispose());
  const slowBrackets = new THREE.InstancedMesh(slowBracketGeometry, glowMaterial(DRONE_SPECS.stasis.color, 0.92), 256);
  const wispTetherPos = new Float32Array(64 * 6);
  const wispTetherGeo = new THREE.BufferGeometry();
  wispTetherGeo.setAttribute("position", new THREE.BufferAttribute(wispTetherPos, 3).setUsage(THREE.DynamicDrawUsage));
  wispTetherGeo.setDrawRange(0, 0);
  const wispTethers = new THREE.LineSegments(wispTetherGeo, new THREE.LineBasicMaterial({ color: PALETTE.orchid, transparent: true, opacity: 0.24, depthWrite: false, fog: false }));
  wispTethers.frustumCulled = false; scene.add(wispTethers);
  const wispFootprints = new THREE.InstancedMesh(new THREE.TorusGeometry(0.12, 0.009, 4, 16), glowMaterial(PALETTE.orchid, 0.45), 64);
  for (const mesh of [...Object.values(meshes), ...Object.values(accentMeshes), enemyHalos, enemyTrails, slowBrackets, wispFootprints]) {
    // Dynamic populations may be empty on their first frame. Never cache their initial empty bounds.
    mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh);
  }

  const SPARK_N = 180;
  const sparkPos = new Float32Array(SPARK_N * 3), sparkCol = new Float32Array(SPARK_N * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3)); sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
  const sparkPoints = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.29, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sparkPoints.frustumCulled = false; scene.add(sparkPoints);
  const sparks: Spark[] = Array.from({ length: SPARK_N }, () => ({ life: 0, max: 1, x: 0, y: -500, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 }));
  const pathRoot = new THREE.Group(), portalRoot = new THREE.Group();
  scene.add(pathRoot, portalRoot);
  const pathMats: { tube: THREE.MeshBasicMaterial; line: THREE.LineBasicMaterial; dormant?: THREE.LineDashedMaterial }[] = [];
  const gates: Gate[] = [];
  let builtId = "", moteMesh: THREE.InstancedMesh | null = null;
  const dock = new THREE.Group();
  const dockRing = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.045, 8, 48), glowMaterial(PALETTE.ice, 0.8));
  dockRing.rotation.x = Math.PI / 2;
  const dockPad = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 1.6, 0.45, 6), new THREE.MeshStandardMaterial({ color: 0x384965, metalness: 0.55, roughness: 0.38 }));
  dockPad.position.y = -0.35;
  const dockInner = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.022, 6, 40), glowMaterial(PALETTE.ice, 0.5));
  dockInner.rotation.x = Math.PI / 2; dockInner.position.y = 0.03;
  dock.add(dockRing, dockPad, dockInner); scene.add(dock);

  const core = new THREE.Group(); core.position.set(CORE.x, CORE.y, CORE.z); scene.add(core);
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xf1f7fd, emissive: PALETTE.ice, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.25 });
  const coreOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.82, 1), coreMat); core.add(coreOrb);
  const coreRings = Array.from({ length: 3 }, (_, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7 + i * 0.35, 0.038, 6, 48), glowMaterial(i === 1 ? PALETTE.lavender : PALETTE.ice, 0.85));
    ring.rotation.set(i * Math.PI / 3, i * Math.PI / 4, 0); core.add(ring); return ring;
  });
  const coreHalo = makeHalo(PALETTE.ice, 0.55); coreHalo.scale.set(8, 8, 1); core.add(coreHalo);
  const coreColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.28, 7, 8, 1, true), new THREE.MeshBasicMaterial({ color: PALETTE.ice, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false }));
  coreColumn.position.set(CORE.x, 1, CORE.z); scene.add(coreColumn);
  let breachFlash = 0;
  const camPos = new THREE.Vector3(0, 24, 60), look = new THREE.Vector3(0, 13, 0);
  const surveyCenter = new THREE.Vector3(0, 16, 0), surveyPosition = new THREE.Vector3(40, 50, 65);
  const lastShip = new THREE.Vector3();
  let prevPhase = "", previousAnchorFlash = 0, overview = false, wasOverview = false, cssW = 1, cssH = 1;

  function burst(x: number, y: number, z: number, n: number, hex: number, speed: number) {
    _color.setHex(hex);
    for (const spark of sparks) {
      if (n <= 0) break;
      if (spark.life > 0) continue;
      spark.life = spark.max = 0.25 + random() * 0.28;
      spark.x = x; spark.y = y; spark.z = z;
      spark.vx = (random() - 0.5) * speed; spark.vy = (random() - 0.5) * speed; spark.vz = (random() - 0.5) * speed;
      spark.r = _color.r; spark.g = _color.g; spark.b = _color.b; n--;
    }
  }
  function clearGroup(group: THREE.Group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((mat) => mat.dispose());
        else mesh.material?.dispose();
      });
    }
  }
  function rebuild(run: Run) {
    for (const gate of gates) gate.labelTexture?.dispose();
    clearGroup(pathRoot); clearGroup(portalRoot); pathMats.length = 0; gates.length = 0;
    const splitCrown = run.level.presentation === "split-crown";
    splitArchitecture.visible = splitCrown; architecture.visible = !splitCrown;
    if (moteMesh) { scene.remove(moteMesh); moteMesh.geometry.dispose(); (moteMesh.material as THREE.Material).dispose(); }
    moteMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.14, 0.45, 3), glowMaterial(0xa4e0eb, 0.5), Math.max(1, run.paths.length * 12));
    moteMesh.geometry.rotateX(Math.PI / 2); moteMesh.frustumCulled = false; scene.add(moteMesh);
    const bounds = new THREE.Box3();
    for (let index = 0; index < run.paths.length; index++) {
      const path = run.paths[index]!, color = pathColor(run, index);
      const points = path.points.map((p) => { const point = new THREE.Vector3(p.x, p.y, p.z); bounds.expandByPoint(point); return point; });
      // Use the simulation's actual polyline, not a smoothed spline that departs from the hit path.
      const tube = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.43 });
      const dormant = splitCrown && index === run.level.primaryPath
        ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.18, dashSize: 0.7, gapSize: 0.9, depthWrite: false }) : undefined;
      pathMats.push({ tube, line, dormant });
      const curve = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(points[i - 1]!, points[i]!));
      pathRoot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 2, 0.13, 5, false), tube));
      pathRoot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), line));
      if (dormant) {
        const futureRoute = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), dormant);
        futureRoute.computeLineDistances(); pathRoot.add(futureRoute);
      }
      const entry = path.pointAt(0);
      const gate = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.055, 8, 48), glowMaterial(color, 0.75));
      const iris = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.025, 6, 40), glowMaterial(PALETTE.coral, 0.25));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.13, 6, 36, Math.PI * 1.72), new THREE.MeshStandardMaterial({ color: 0x6a7595, metalness: 0.5, roughness: 0.4 }));
      const halo = makeHalo(color, 0.2); halo.scale.set(6.5, 6.5, 1);
      gate.add(ring, iris, rim, halo);
      gate.position.set(entry.x, entry.y, entry.z); aimAlong(gate, entry.tx, entry.ty, entry.tz);
      const view: Gate = { root: gate, ring, iris, halo };
      if (splitCrown) {
        const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "rgba(16,22,41,0.9)"; context.beginPath(); context.roundRect(9, 5, 110, 118, 18); context.fill();
        context.strokeStyle = `#${color.toString(16).padStart(6, "0")}`; context.lineWidth = 3; context.stroke();
        context.fillStyle = "#e4edf5"; context.textAlign = "center"; context.font = "600 65px sans-serif"; context.fillText(String.fromCharCode(65 + index), 64, 77);
        context.fillStyle = "#b3c2d8"; context.font = "18px monospace"; context.fillText(`WAVE ${getLaneFirstWave(run, index)}`, 64, 106);
        view.labelTexture = new THREE.CanvasTexture(canvas); view.labelTexture.colorSpace = THREE.SRGBColorSpace;
        view.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: view.labelTexture, transparent: true, depthWrite: false, fog: false }));
        view.label.position.set(entry.x, entry.y + 4, entry.z); view.label.scale.set(3.3, 3.3, 1);
        portalRoot.add(view.label);
      }
      portalRoot.add(gate); gates.push(view);
      const stem = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(entry.x, -1.9, entry.z), new THREE.Vector3(entry.x, entry.y - 2.4, entry.z)]), new THREE.LineDashedMaterial({ color: 0x90b5c9, transparent: true, opacity: 0.22, dashSize: 0.25, gapSize: 0.8 }));
      stem.computeLineDistances(); portalRoot.add(stem);
    }
    bounds.expandByPoint(new THREE.Vector3(CORE.x, CORE.y, CORE.z));
    const home = run.level.hangar;
    dock.position.set(home.x, home.y - 1.1, home.z);
    bounds.expandByPoint(new THREE.Vector3(home.x, home.y, home.z));
    bounds.getCenter(surveyCenter);
    const size = bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z, 25);
    surveyPosition.copy(surveyCenter).add(new THREE.Vector3(span * 1.15, span * 0.82, span * 1.32));
    builtId = run.levelId; coverageClock = 1;
  }
  function placeBeam(mesh: THREE.Mesh, beam: Beam, color: number, hit: boolean, run: Run, index?: number) {
    let length = beam.range;
    let nearest: Run["enemies"][number] | undefined;
    if (!beam.pierces) {
      for (const enemy of run.enemies) {
        if (!enemy.alive) continue;
        const contact = beamContact(beam, enemy);
        if (contact !== null && contact < length) { length = contact; nearest = enemy; }
      }
    }
    mesh.visible = true; mesh.position.set(beam.x, beam.y, beam.z);
    mesh.scale.set(hit ? 0.045 : 0.023, hit ? 0.045 : 0.023, length);
    aimAlong(mesh, beam.dx, beam.dy, beam.dz);
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.color.setHex(color); material.opacity = hit ? 0.55 : 0.22;
    if (index !== undefined) {
      const shell = droneShells[index]!, ring = targetRings[index]!;
      shell.visible = overview || run.rest > 0 || run.expand > 0.05 || Math.abs(run.shift) > 0.05; shell.position.copy(mesh.position); shell.quaternion.copy(mesh.quaternion);
      shell.scale.set(beam.radius, beam.radius, length);
      shell.material.color.setHex(color); shell.material.opacity = hit ? 0.032 : 0.012;
      // Rings mark a living nearest victim; the route highlight remains potential coverage.
      ring.visible = !!nearest;
      if (nearest) { ring.position.set(nearest.x, nearest.y, nearest.z); ring.quaternion.copy(camera.quaternion); ring.scale.setScalar(nearest.radius + 0.4); ring.material.color.setHex(color); }
    }
  }
  function syncCoverage(run: Run, preview: ReturnType<typeof getPlacementPreview>) {
    let count = 0;
    function add(segments: ReturnType<typeof getBeamCoverage>["segments"], hex: number, width: number) {
      _color.setHex(hex);
      for (const segment of segments) {
        for (let i = 1; i < segment.points.length && count < COVERAGE_MAX; i++) {
          const a = segment.points[i - 1]!, b = segment.points[i]!;
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, length = Math.hypot(dx, dy, dz);
          if (length < 0.001) continue;
          _dummy.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
          aimAlong(_dummy, dx, dy, dz);
          _dummy.scale.set(width, width, length); _dummy.updateMatrix();
          coverage.setMatrixAt(count, _dummy.matrix); coverage.setColorAt(count, _color); count++;
        }
      }
    }
    if (overview || run.rest > 0 || run.expand > 0.05 || Math.abs(run.shift) > 0.05) {
      for (const drone of run.drones.filter(d => !run.fieldCheck || d.mode === "stasis")) add((drone.mode === "stasis" ? getFieldCoverage(run, drone) : getBeamCoverage(run, droneBeam(drone))).segments, DRONE_SPECS[drone.mode].color, 0.85);
    }
    if (run.phase !== "title" && !overview && !run.fieldCheck) add(preview.segments, DRONE_SPECS[run.droneMode].color, 2.2);
    coverage.count = count; coverage.instanceMatrix.needsUpdate = true;
    if (coverage.instanceColor) coverage.instanceColor.needsUpdate = true;
  }
  function updateCamera(run: Run, dt: number, elapsed: number) {
    if (overview) {
      camPos.copy(surveyPosition); look.copy(surveyCenter);
      // Portrait needs more distance to fit the same arena width.
      if (camera.aspect < 1) camPos.sub(look).multiplyScalar(1 / camera.aspect).add(look);
      camera.fov = 52;
    } else if (run.phase === "title") {
      const angle = elapsed * (reduce ? 0.012 : 0.035), radius = surveyPosition.distanceTo(surveyCenter) * 0.83;
      camPos.set(surveyCenter.x + Math.sin(angle + 0.4) * radius, surveyCenter.y + radius * 0.36, surveyCenter.z + Math.cos(angle + 0.4) * radius);
      look.copy(surveyCenter); camera.fov = 55;
      if (run.level.presentation === "split-crown" && camera.aspect < 1) camPos.sub(look).multiplyScalar(1 / camera.aspect).add(look);
    } else {
      const follow = 10.8;
      _v.set(run.ship.x - run.aimx * follow, run.ship.y - run.aimy * follow + 2.65, run.ship.z - run.aimz * follow);
      _v2.set(run.ship.x + run.aimx * 8, run.ship.y + run.aimy * 8 + 0.45, run.ship.z + run.aimz * 8);
      const teleported = (lastShip.x - run.ship.x) ** 2 + (lastShip.y - run.ship.y) ** 2 + (lastShip.z - run.ship.z) ** 2 > 144;
      const anchored = run.anchorFlash > previousAnchorFlash + 0.05;
      if (prevPhase === "title" || !prevPhase || (prevPhase !== "play" && run.phase === "play") || wasOverview || teleported || anchored) { camPos.copy(_v); look.copy(_v2); }
      const frame = Math.max(dt, 0.001);
      camPos.lerp(_v, 1 - Math.exp(-6 * frame)); look.lerp(_v2, 1 - Math.exp(-9 * frame));
      camera.fov = 60 + Math.min(run.speed, 28) * 0.15;
    }
    // Overview moves back to fit the wider arena, especially in portrait.
    // Move its fog window too so distant routes and landmarks stay legible.
    const fogShift = run.level.presentation === "split-crown" && (overview || run.phase === "title")
      ? Math.max(0, camPos.distanceTo(look) - 135) : 0;
    sceneFog.near = 95 + fogShift; sceneFog.far = 235 + fogShift;
    camera.position.copy(camPos);
    if (!reduce && !overview && run.shake > 0) { camera.position.x += (random() - 0.5) * run.shake * 0.22; camera.position.y += (random() - 0.5) * run.shake * 0.18; }
    camera.up.set(0, 1, 0); camera.lookAt(look); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    lastShip.set(run.ship.x, run.ship.y, run.ship.z); wasOverview = overview; previousAnchorFlash = run.anchorFlash;
  }
  function syncEnemies(run: Run, elapsed: number) {
    const counts = { shard: 0, barge: 0, wisp: 0, carrier: 0 }; let total = 0, wispCount = 0, slowCount = 0;
    for (const enemy of run.enemies) {
      if (!enemy.alive || counts[enemy.kind] >= 64) continue;
      const index = counts[enemy.kind]++;
      _dummy.position.set(enemy.x, enemy.y, enemy.z);
      aimAlong(_dummy, enemy.tx, enemy.ty, enemy.tz, enemy.kind === "wisp" && !reduce ? elapsed * 0.55 : 0);
      // No render-only size changes: the model's measured radius matches its collision envelope.
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix(); meshes[enemy.kind].setMatrixAt(index, _dummy.matrix); accentMeshes[enemy.kind].setMatrixAt(index, _dummy.matrix);
      // Check targets use a cool accent; amber brackets still mean real field contact.
      const enemyColor = run.fieldCheck ? PALETTE.ice : KIND_COLOR[enemy.kind];
      _color.setHex(enemyColor).lerp(_hot, enemy.hit ? 0.72 : 0.62);
      meshes[enemy.kind].setColorAt(index, _color);
      _color.setHex(enemyColor);
      if (enemy.hit) _color.multiplyScalar(1.2);
      accentMeshes[enemy.kind].setColorAt(index, _color);
      _dummy.quaternion.copy(camera.quaternion);
      if (enemy.speedScale < 1) {
        _dummy.scale.setScalar(enemy.radius + 0.3); _dummy.updateMatrix();
        slowBrackets.setMatrixAt(slowCount++, _dummy.matrix);
      }
      const haloSize = enemy.kind === "carrier" ? 6 : enemy.kind === "barge" ? 3.8 : enemy.kind === "wisp" ? 2.8 : 2.5;
      _dummy.scale.set(haloSize, haloSize, 1); _dummy.updateMatrix(); enemyHalos.setMatrixAt(total, _dummy.matrix); enemyHalos.setColorAt(total, _color);
      const aft = enemy.kind === "carrier" ? 1.85 : enemy.kind === "barge" ? 1.05 : enemy.kind === "shard" ? 0.61 : 0.38;
      _dummy.position.set(enemy.x - enemy.tx * aft, enemy.y - enemy.ty * aft, enemy.z - enemy.tz * aft);
      aimAlong(_dummy, -enemy.tx, -enemy.ty, -enemy.tz);
      _dummy.scale.set(enemy.kind === "barge" ? 0.055 : 0.032, enemy.kind === "barge" ? 0.055 : 0.032, enemy.kind === "barge" ? 1.3 : 0.9);
      _dummy.updateMatrix(); enemyTrails.setMatrixAt(total, _dummy.matrix); enemyTrails.setColorAt(total, _color); total++;
      if (enemy.kind === "wisp") {
        // Only Wisps deliberately orbit off the route. This filament shows their own nominal path point,
        // not a targeting beam or a new route; the solid hull still sits at the exact simulated center.
        const nominal = run.paths[enemy.pathIndex]!.pointAt(enemy.dist), base = wispCount * 6;
        wispTetherPos[base] = nominal.x; wispTetherPos[base + 1] = nominal.y; wispTetherPos[base + 2] = nominal.z;
        wispTetherPos[base + 3] = enemy.x; wispTetherPos[base + 4] = enemy.y; wispTetherPos[base + 5] = enemy.z;
        _dummy.position.set(nominal.x, nominal.y, nominal.z); _dummy.quaternion.copy(camera.quaternion); _dummy.scale.setScalar(1); _dummy.updateMatrix();
        wispFootprints.setMatrixAt(wispCount++, _dummy.matrix);
      }
    }
    for (const kind of ["shard", "barge", "wisp", "carrier"] as const) {
      for (const mesh of [meshes[kind], accentMeshes[kind]]) { mesh.count = counts[kind]; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    }
    for (const mesh of [enemyHalos, enemyTrails]) { mesh.count = total; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    slowBrackets.count = slowCount; slowBrackets.instanceMatrix.needsUpdate = true;
    wispTetherGeo.setDrawRange(0, wispCount * 2); wispTetherGeo.attributes.position!.needsUpdate = true;
    wispFootprints.count = wispCount; wispFootprints.instanceMatrix.needsUpdate = true;
  }
  function project(x: number, y: number, z: number): Projection {
    _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    const behind = _v.z >= 0;
    _v.set(x, y, z).project(camera);
    return { x: (_v.x * 0.5 + 0.5) * cssW, y: (-_v.y * 0.5 + 0.5) * cssH, visible: !behind && _v.z >= -1 && _v.z <= 1 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1, behind };
  }

  return {
    resize(w, h, dpr) { cssW = Math.max(1, w); cssH = Math.max(1, h); camera.aspect = cssW / cssH; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(dpr, 2)); renderer.setSize(cssW, cssH, false); },
    setOverview(on) { overview = on; coverageClock = 1; },
    project,
    projectEdge(x, y, z, padding = 40) {
      const point = project(x, y, z);
      let dx = point.x - cssW / 2, dy = point.y - cssH / 2;
      if (point.behind) { dx = -dx; dy = -dy; }
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) + Math.abs(dy) < 0.01) { dx = 0; dy = -1; }
      const halfW = Math.max(1, cssW / 2 - padding), halfH = Math.max(1, cssH / 2 - padding);
      const scale = Math.min(halfW / Math.max(Math.abs(dx), 0.0001), halfH / Math.max(Math.abs(dy), 0.0001));
      return { ...point, x: point.visible ? point.x : cssW / 2 + dx * scale, y: point.visible ? point.y : cssH / 2 + dy * scale, angle: Math.atan2(dy, dx) };
    },
    sync(run, dt, elapsed) {
      if (builtId !== run.levelId) rebuild(run);
      updateCamera(run, dt, elapsed);
      const preview = getPlacementPreview(run);
      aimAlong(ship, run.aimx, run.aimy, run.aimz, run.ship.roll); ship.position.set(run.ship.x, run.ship.y, run.ship.z);
      ship.getObjectByName("glow")?.scale.set(1, 1, 0.8 + Math.max(0, run.thrustVisual) * 2);
      const playerBeam: Beam = { x: run.ship.x + run.aimx * 1.15, y: run.ship.y + run.aimy * 1.15, z: run.ship.z + run.aimz * 1.15, dx: run.aimx, dy: run.aimy, dz: run.aimz, range: BEAM_RANGE, radius: SHIP_RADIUS, dps: SHIP_DPS, pierces: true };
      placeBeam(beams[0]!, playerBeam, 0xf5f8e8, run.shipHitting, run);
      beams[0]!.visible = run.phase !== "title" && !run.fieldCheck;
      const selectedDrone = run.drones.find(drone => drone.id === run.selectedDroneId);
      selectedDroneRing.visible = !!selectedDrone && (run.rest > 0 || run.waveIndex < 0) && run.phase !== "title";
      if (selectedDrone) {
        selectedDroneRing.position.set(selectedDrone.x, selectedDrone.y, selectedDrone.z);
        selectedDroneRing.quaternion.copy(camera.quaternion);
      }
      for (let i = 0; i < drones.length; i++) {
        const drone = run.drones[i], mesh = drones[i]!, beam = beams[i + 1]!;
        const field = fields[i]!;
        const relocating = !!drone && run.repositionId === drone.id;
        const fieldOccupied = !!drone && drone.mode === "stasis" && run.enemies.some(enemy => enemy.alive && insideStasis(drone, enemy));
        field.group.visible = !!drone && drone.mode === "stasis";
        if (drone?.mode === "stasis") {
          field.group.position.set(drone.x, drone.y, drone.z);
          field.boundary.opacity = relocating ? 0.14 : fieldOccupied ? 0.58 : 0.3;
          field.skin!.opacity = relocating ? 0.005 : fieldOccupied ? 0.022 : 0.012;
        }
        if (!drone) { mesh.visible = false; beam.visible = false; droneShells[i]!.visible = false; targetRings[i]!.visible = false; continue; }
        const color = DRONE_SPECS[drone.mode].color;
        mesh.visible = true; mesh.position.set(drone.x, drone.y, drone.z); aimAlong(mesh, drone.ax, drone.ay, drone.az);
        if (mesh.userData.relocating !== relocating) {
          mesh.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) {
              let original = droneMaterialDefaults.get(material);
              if (!original) {
                original = { transparent: material.transparent, opacity: material.opacity, depthWrite: material.depthWrite };
                droneMaterialDefaults.set(material, original);
              }
              const transparent = relocating || original.transparent;
              if (material.transparent !== transparent) material.needsUpdate = true;
              material.transparent = transparent; material.opacity = original.opacity * (relocating ? 0.3 : 1);
              material.depthWrite = relocating ? false : original.depthWrite;
            }
          });
          mesh.userData.relocating = relocating;
        }
        const iris = mesh.getObjectByName("iris") as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
        iris.material.color.setHex(color); iris.rotation.z = elapsed * (reduce ? 0 : 0.3);
        iris.scale.setScalar(drone.mode === "sweep" ? 1.25 : 1);
        mesh.getObjectByName("eye")?.scale.setScalar(fieldOccupied || drone.hit ? 1.6 : 1);
        if (drone.mode === "stasis") { beam.visible = false; droneShells[i]!.visible = false; targetRings[i]!.visible = false; }
        else if (run.fieldCheck) { beam.visible = false; droneShells[i]!.visible = false; targetRings[i]!.visible = false; }
        else placeBeam(beam, droneBeam(drone), color, drone.hit, run, i);
      }
      const showPreview = run.phase === "play" && !overview && !run.fieldCheck;
      const previewColor = DRONE_SPECS[run.droneMode].color;
      ghost.visible = showPreview; previewVolume.visible = showPreview && run.droneMode !== "stasis";
      fieldPreview.group.visible = showPreview && run.droneMode === "stasis";
      fieldPreview.group.position.set(preview.drone.x, preview.drone.y, preview.drone.z);
      if (showPreview) {
        ghost.position.set(preview.drone.x, preview.drone.y, preview.drone.z); aimAlong(ghost, preview.drone.ax, preview.drone.ay, preview.drone.az);
        const iris = ghost.getObjectByName("iris") as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>; iris.material.color.setHex(previewColor);
        previewVolume.position.set(preview.beam.x, preview.beam.y, preview.beam.z); aimAlong(previewVolume, preview.beam.dx, preview.beam.dy, preview.beam.dz);
        volume.scale.set(preview.beam.radius, preview.beam.radius, preview.beam.range); volumeMat.color.setHex(previewColor);
        hoops.forEach((hoop, i) => { hoop.position.z = i * preview.beam.range / 4; hoop.scale.setScalar(preview.beam.radius); hoop.material.color.setHex(previewColor); });
      }
      coverageClock += dt;
      if (coverageClock >= 0.08 || run.phase === "pause") { syncCoverage(run, preview); coverageClock = 0; }
      const pending = run.rest > 0 || run.waveIndex < 0;
      const manualWaiting = pending && run.waveMode === "manual";
      const wave = run.waves[pending ? run.waveIndex + 1 : run.waveIndex];
      const announcedPaths = new Set<number>();
      for (const knownWave of run.waves.slice(0, Math.max(0, run.waveIndex + (pending ? 2 : 1)))) {
        for (const group of knownWave.groups) announcedPaths.add(group.path);
      }
      const routeKnown = (index: number) => run.phase === "title" || announcedPaths.has(index) || run.enemies.some((enemy) => enemy.alive && enemy.pathIndex === index);
      gates.forEach((gate, index) => {
        let countdown = Infinity, selected = false;
        for (const group of wave?.groups ?? []) {
          if (group.path !== index || group.spawned >= group.count) continue;
          selected = true;
          const until = pending ? Math.max(0, run.rest) + group.delay : Math.max(0, group.delay + group.spawned * group.interval - run.waveTime);
          countdown = Math.min(countdown, until);
        }
        const imminent = !manualWaiting && run.phase !== "title" && countdown < 3.5;
        const pulse = reduce ? 0.75 : 0.65 + Math.sin(elapsed * 6) * 0.25;
        const laneStatus = getLaneStatus(run, index);
        const splitCrown = run.level.presentation === "split-crown";
        gate.ring.material.opacity = splitCrown ? imminent ? 0.95 : laneStatus === "active" ? 0.86 : laneStatus === "upcoming" ? 0.72 : laneStatus === "cleared" ? 0.3 : 0.17
          : imminent ? 0.95 : selected ? 0.78 : routeKnown(index) ? 0.4 : 0.12;
        gate.iris.material.color.setHex(imminent ? PALETTE.coral : pathColor(run, index));
        gate.iris.material.opacity = splitCrown ? imminent ? pulse : laneStatus === "active" ? 0.55 : laneStatus === "upcoming" ? 0.4 : 0.08
          : imminent ? pulse : selected ? 0.48 : routeKnown(index) ? 0.2 : 0.06;
        gate.iris.scale.setScalar(imminent ? 0.85 + pulse * 0.13 : 1);
        gate.halo.material.opacity = splitCrown ? imminent ? 0.36 : laneStatus === "active" ? 0.2 : laneStatus === "upcoming" ? 0.12 : 0.025
          : imminent ? 0.42 : selected ? 0.2 : routeKnown(index) ? 0.11 : 0.025;
        if (gate.label) gate.label.material.opacity = laneStatus === "dormant" ? 0.6 : laneStatus === "cleared" ? 0.65 : 1;
        if (!reduce) gate.root.children[2]!.rotation.z = elapsed * 0.12;
      });
      pathMats.forEach((materials, index) => {
        if (run.level.presentation === "split-crown") {
          const status = getLaneStatus(run, index);
          const waiting = status === "dormant";
          // The late carrier approach stays discoverable as a true-path dashed
          // line until its first wave is forecast, then joins the solid ribbons.
          const pendingPrimary = !!materials.dormant && run.waveIndex + (pending ? 2 : 1) < getLaneFirstWave(run, index);
          if (materials.dormant) materials.dormant.opacity = pendingPrimary ? overview ? 0.24 : 0.16 : 0;
          materials.tube.opacity = pendingPrimary ? 0 : waiting ? 0.02 : overview ? 0.15 : 0.075;
          materials.line.opacity = pendingPrimary ? 0 : waiting ? overview ? 0.28 : 0.18 : status === "cleared" ? 0.29 : overview ? 0.65 : 0.46;
          return;
        }
        const announced = routeKnown(index);
        materials.tube.opacity = announced ? overview ? 0.17 : 0.09 : 0.025;
        materials.line.opacity = announced ? overview ? 0.62 : 0.43 : 0.13;
      });
      if (moteMesh) {
        // These are route-direction markers, never enemies. Motion is decorative
        // on the title only; live waves and field checks must show actual targets.
        const title = run.phase === "title";
        moteMesh.visible = !run.fieldCheck && (title || overview || ((run.phase === "play" || run.phase === "pause") && pending));
        (moteMesh.material as THREE.MeshBasicMaterial).opacity = title ? 0.5 : 0.18;
        const travel = title && !reduce ? elapsed * 4 : 0;
        let index = 0;
        for (let pathIndex = 0; moteMesh.visible && pathIndex < run.paths.length; pathIndex++) {
          if (!routeKnown(pathIndex)) continue;
          const path = run.paths[pathIndex]!;
          for (let n = 0; n < 12; n++) {
            const pose = path.pointAt((travel + (n / 12) * path.length) % path.length);
            _dummy.position.set(pose.x, pose.y, pose.z); aimAlong(_dummy, pose.tx, pose.ty, pose.tz); _dummy.scale.setScalar(1); _dummy.updateMatrix(); moteMesh.setMatrixAt(index++, _dummy.matrix);
          }
        }
        moteMesh.count = index; moteMesh.instanceMatrix.needsUpdate = true;
      }
      syncEnemies(run, elapsed);
      for (const fx of run.fx) {
        if (fx.type === "hit") burst(fx.x, fx.y, fx.z, 3, 0xfff3d7, 3);
        else if (fx.type === "kill") burst(fx.x, fx.y, fx.z, 10, PALETTE.coral, 7);
        else if (fx.type === "anchor") burst(fx.x, fx.y, fx.z, 14, PALETTE.lavender, 6);
        else if (fx.type === "leak") { breachFlash = 1; burst(CORE.x, CORE.y, CORE.z, 18, PALETTE.coral, 8); }
      }
      run.fx.length = 0;
      breachFlash = Math.max(0, breachFlash - dt * 1.5);
      coreMat.emissive.setHex(breachFlash > 0 ? PALETTE.coral : PALETTE.ice);
      coreMat.emissiveIntensity = 0.9 + breachFlash * 2;
      coreHalo.material.color.setHex(breachFlash > 0 ? PALETTE.coral : PALETTE.ice);
      coreHalo.scale.setScalar(8 + breachFlash * 5);
      coreLight.intensity = 18 + breachFlash * 30; coreLight.color.setHex(breachFlash > 0 ? PALETTE.coral : PALETTE.ice);
      coreRings.forEach((ring, i) => { if (!reduce) ring.rotation.z += dt * (i % 2 ? -0.17 : 0.13); ring.material.color.setHex(breachFlash > 0 ? PALETTE.coral : i === 1 ? PALETTE.lavender : PALETTE.ice); });
      for (let i = 0; i < sparks.length; i++) {
        const spark = sparks[i]!;
        spark.life = Math.max(0, spark.life - dt);
        if (spark.life > 0) {
          spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.z += spark.vz * dt;
          const fade = spark.life / spark.max;
          sparkPos[i * 3] = spark.x; sparkPos[i * 3 + 1] = spark.y; sparkPos[i * 3 + 2] = spark.z;
          sparkCol[i * 3] = spark.r * fade; sparkCol[i * 3 + 1] = spark.g * fade; sparkCol[i * 3 + 2] = spark.b * fade;
        } else { sparkPos[i * 3 + 1] = -500; sparkCol[i * 3] = sparkCol[i * 3 + 1] = sparkCol[i * 3 + 2] = 0; }
      }
      sparkGeo.attributes.position!.needsUpdate = true; sparkGeo.attributes.color!.needsUpdate = true;
      prevPhase = run.phase; renderer.render(scene, camera);
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse((obj) => { const mesh = obj as THREE.Mesh; if (mesh.geometry) geometries.add(mesh.geometry); if (Array.isArray(mesh.material)) mesh.material.forEach((mat) => materials.add(mat)); else if (mesh.material) materials.add(mesh.material); });
      geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
      for (const gate of gates) gate.labelTexture?.dispose();
      glowTexture.dispose(); renderer.dispose();
    },
  };
}
