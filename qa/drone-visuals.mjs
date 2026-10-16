// Role geometry and presentation contracts using Three objects, without WebGL.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: 'export { buildDrone, setDroneVisualMode, buildStasisFieldVisual, setFieldVisualMode, showPilotBeam, showFieldVisual, syncPinTracer } from "./src/game/scene"; export { DRONE_SPECS } from "./src/game/combat"; export { Box3, Vector3, Mesh, CylinderGeometry, MeshBasicMaterial } from "three";', resolveDir: new URL('../', import.meta.url).pathname }, bundle: true, platform: 'node', format: 'esm', write: false });
const { buildDrone, setDroneVisualMode, buildStasisFieldVisual, setFieldVisualMode, showPilotBeam, showFieldVisual, syncPinTracer, DRONE_SPECS, Box3, Vector3, Mesh, CylinderGeometry, MeshBasicMaterial } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} differs from ${b}`);
function dispose(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
{
  for (const ghost of [false, true]) {
    const drone = buildDrone(ghost), sizes = {};
    for (const mode of ['pierce', 'sweep', 'stasis', 'halo', 'pin', 'lumen', 'relay', 'stasis', 'pierce']) {
      setDroneVisualMode(drone, mode);
      const roles = drone.children.filter(object => object.visible);
      assert.equal(roles.length, 1, 'slot reuse must never leave a previous role visible');
      assert.equal(roles[0].name, `role-${mode}`);
      assert.equal(roles[0].children.length, 2, 'only two merged meshes per visible drone');
      assert.equal(drone.userData.accent.color.getHex(), DRONE_SPECS[mode].color);
      const bounds = new Box3().setFromObject(roles[0]);
      sizes[mode] = bounds.getSize(new Vector3());
      if (mode === 'stasis' || mode === 'halo') {
        const center = bounds.getCenter(new Vector3());
        close(center.x, 0); close(center.y, 0); close(center.z, 0);
      }
    }
    assert.ok(sizes.pierce.z > sizes.pierce.x * 1.6, 'Pierce has a longitudinal fork');
    assert.ok(sizes.sweep.x > sizes.sweep.z * 2, 'Sweep has wide twin pods');
    close(sizes.stasis.x, sizes.stasis.y); close(sizes.stasis.y, sizes.stasis.z);
    assert.ok(sizes.pin.z > sizes.pin.x * 2, 'Pin has a long cannon');
    assert.ok(sizes.pin.y > sizes.pierce.y * 1.5, 'Pin sight rail separates its silhouette from Pierce');
    assert.ok(sizes.halo.y > sizes.stasis.y, 'Halo spines extend beyond the compact Stasis cage');
    dispose(drone);
  }
  console.log('✓ Anchored drones and ghosts retain seven role geometries with only two visible meshes');
}
{
  assert.equal(showFieldVisual('halo', null), true);
  assert.equal(showFieldVisual('stasis', null), true);
  assert.equal(showFieldVisual('halo', {}), false, 'harmless Stasis check does not imply Halo damage');
  assert.equal(showFieldVisual('stasis', {}), true);
  assert.equal(showFieldVisual('pin', null), false);
  for (const preview of [false, true]) {
    const field = buildStasisFieldVisual(preview);
    for (const mode of ['halo', 'stasis', 'halo']) {
      setFieldVisualMode(field, mode); field.group.updateMatrixWorld(true);
      assert.equal(field.boundary.type, preview ? 'LineDashedMaterial' : 'LineBasicMaterial');
      assert.equal(field.boundary.color.getHex(), DRONE_SPECS[mode].color);
      for (const object of field.group.children) {
        const vertices = object.geometry.attributes.position;
        for (let i = 0; i < vertices.count; i++) {
          const point = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld);
          close(point.length(), DRONE_SPECS[mode].radius);
        }
      }
    }
    dispose(field.group);
  }
  console.log('✓ Reused preview and anchored fields preserve exact 5m Halo and 6m Stasis world boundaries');
}
{
  const run = { phase: 'play', fieldCheck: null, rest: 1, waveIndex: -1, enemies: [] };
  assert.equal(showPilotBeam(run), false, 'empty setup must not suggest the passive ghost fires');
  assert.equal(showPilotBeam({ ...run, rest: 0, waveIndex: 0 }), true, 'combat pilot gun stays visible');
  assert.equal(showPilotBeam({ ...run, enemies: [{ alive: true }] }), true);
  assert.equal(showPilotBeam({ ...run, phase: 'title' }), false);
  assert.equal(showPilotBeam({ ...run, fieldCheck: {} }), false);
  assert.equal(showPilotBeam({ ...run, phase: 'pause', rest: 0, waveIndex: 0 }), true);
  console.log('✓ Empty setup hides the pilot gun without changing combat or paused combat presentation');
}
{
  const mesh = new Mesh(new CylinderGeometry(), new MeshBasicMaterial());
  const drone = { x: 3, y: 4, z: -7, shotFlash: 0.18, shotTarget: { x: 12, y: 9, z: 18 } };
  syncPinTracer(mesh, drone); mesh.updateMatrixWorld(true);
  assert.equal(mesh.visible, true);
  const end = mesh.localToWorld(new Vector3(0, 0, 1));
  close(end.x, drone.shotTarget.x); close(end.y, drone.shotTarget.y); close(end.z, drone.shotTarget.z);
  const frozen = mesh.matrixWorld.clone();
  syncPinTracer(mesh, drone); mesh.updateMatrixWorld(true);
  assert.deepEqual(mesh.matrixWorld.elements, frozen.elements, 'paused simulation preserves the impact tracer');
  syncPinTracer(mesh, { ...drone, shotFlash: 0 }); assert.equal(mesh.visible, false, 'no permanent Pin beam');
  syncPinTracer(mesh, { ...drone, shotTarget: null }); assert.equal(mesh.visible, false);
  syncPinTracer(mesh, drone, true); assert.equal(mesh.visible, false, 'field checks suppress firing visuals');
  dispose(mesh);
  console.log('✓ Pin tracer ends at the actual impact, holds during pause and disappears between shots');
}
console.log('\n4 drone presentation checks passed. No browser or visual verification performed.');
