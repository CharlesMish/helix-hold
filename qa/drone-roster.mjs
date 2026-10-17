// CPU projections of actual drone meshes. This is a diagram, never browser QA.
import { writeFile } from "node:fs/promises";
import { build } from "esbuild";
const bundle = await build({
  stdin: {
    contents:
      'export { buildDrone, setDroneVisualMode } from "./src/game/scene"; export { DRONE_SPECS } from "./src/game/combat"; export { OrthographicCamera, Vector3, Color } from "three";',
    resolveDir: new URL("../", import.meta.url).pathname,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { buildDrone, setDroneVisualMode, DRONE_SPECS, OrthographicCamera, Vector3, Color } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const light = new Vector3(-0.6, 0.8, 0.9).normalize();
function projectDrone(mode, x, y, scale, front = false) {
  const group = buildDrone();
  setDroneVisualMode(group, mode);
  group.updateMatrixWorld(true);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
  camera.position.set(front ? 0 : 5, front ? 0 : 3.2, 7);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const triangles = [];
  const role = group.children.find((child) => child.visible);
  for (const mesh of role.children) {
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 3) {
      const points = [0, 1, 2].map((offset) =>
        new Vector3().fromBufferAttribute(positions, i + offset).applyMatrix4(mesh.matrixWorld),
      );
      const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
      const middle = points[0]
        .clone()
        .add(points[1])
        .add(points[2])
        .multiplyScalar(1 / 3);
      if (normal.dot(camera.position.clone().sub(middle)) <= 0) continue;
      const color = mesh.material.color.clone();
      if (!mesh.material.isMeshBasicMaterial)
        color.multiplyScalar(0.48 + Math.max(0, normal.dot(light)) * 0.52);
      const screen = points.map((point) => point.project(camera));
      triangles.push({
        depth: middle.applyMatrix4(camera.matrixWorldInverse).z,
        points: screen
          .map((point) => `${(x + point.x * scale).toFixed(2)},${(y - point.y * scale).toFixed(2)}`)
          .join(" "),
        fill: "#" + color.getHexString(),
      });
    }
  }
  triangles.sort((a, b) => a.depth - b.depth);
  const geometries = new Set(),
    materials = new Set();
  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  return triangles
    .map(
      (triangle) =>
        `<polygon points="${triangle.points}" fill="${triangle.fill}" stroke="${triangle.fill}" stroke-width="0.3" stroke-linejoin="round"/>`,
    )
    .join("");
}
const modes = ["pierce", "sweep", "stasis", "halo", "pin"];
const notes = {
  pierce: ["AIMED · CONTINUOUS", "Long fork", "Every enemy in the line"],
  sweep: ["AIMED · CONTINUOUS", "Wide twin pods", "Nearest enemy in the line"],
  stasis: ["PASSIVE · NO SHOT", "Round cage", "6m radius · slows 50%"],
  halo: ["PASSIVE · NO SHOT", "Radial spines", "5m radius · contact damage"],
  pin: ["AIMED · DISCRETE SHOT", "Cannon + raised sight", "Nearest hit · damage + slow"],
};
const cards = modes
  .map((mode, i) => {
    const left = 36 + i * 268,
      middle = left + 126;
    const color = "#" + new Color(DRONE_SPECS[mode].color).getHexString();
    return `<rect x="${left}" y="125" width="252" height="447" rx="18" fill="#141f32" stroke="#2e3d56"/>
<text x="${left + 20}" y="162" fill="${color}" font-size="24" font-weight="700">${DRONE_SPECS[mode].label}</text>
<text x="${left + 20}" y="188" fill="#adbacd" font-size="11" letter-spacing="0.7">${notes[mode][0]}</text>
${projectDrone(mode, middle, 292, 82)}
<line x1="${left + 20}" x2="${left + 232}" y1="392" y2="392" stroke="#2e3d56"/>
${projectDrone(mode, left + 64, 447, 33, true)}
<text x="${left + 108}" y="440" fill="#d1dbeb" font-size="13">Front view</text>
<text x="${left + 108}" y="460" fill="#8193ac" font-size="11">Same mesh</text>
<text x="${left + 20}" y="519" fill="#e0e9f7" font-size="15">${notes[mode][1]}</text>
<text x="${left + 20}" y="544" fill="#adbacd" font-size="12">${notes[mode][2]}</text>`;
  })
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 664" width="1400" height="664" role="img" aria-labelledby="title desc"><title id="title">Helix Hold drone role silhouettes</title><desc id="desc">Actual production mesh projections for Pierce, Sweep, Stasis, Halo and Pin. Passive fields have radial bodies with no forward barrel.</desc><rect width="1400" height="664" fill="#0b1322"/><g font-family="DejaVu Sans, sans-serif"><text x="36" y="58" fill="#eef4ff" font-size="29" font-weight="700">One fleet. Five readable roles.</text><text x="36" y="91" fill="#a5b6cf" font-size="15">Actual drone geometry · oblique and front projections · equal scale across roles</text>${cards}<text x="36" y="613" fill="#b4c4da" font-size="14">Passive fields surround their drone. Pin flashes only when a shot hits. Pierce and Sweep keep their aimed beams.</text><text x="36" y="639" fill="#8093ae" font-size="12">CPU geometry illustration, not a browser screenshot or proof of in-game readability. Halo and Pin are the Crown workshop experiment.</text></g></svg>`;
await writeFile(new URL("../public/drone-roster.svg", import.meta.url), svg);
console.log("Wrote public/drone-roster.svg from production Three geometry (CPU projection only).");
