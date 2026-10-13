// Renderer allocation checks using actual Three objects, without WebGL or a browser.
// Protects drones beyond eight and the active coverage preview beyond the old buffer cap.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: 'export { buildDroneVisualPool, buildCoverageVisual } from "./src/game/scene"; export { Scene, CylinderGeometry, Matrix4, Vector3, Quaternion, Color } from "three";', resolveDir: new URL('../', import.meta.url).pathname }, bundle: true, platform: 'node', format: 'esm', write: false });
const { buildDroneVisualPool, buildCoverageVisual, Scene, CylinderGeometry, Matrix4, Vector3, Quaternion, Color } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} differs from ${b}`);
function disposeScene(scene) {
  const geometries = new Set(), materials = new Set();
  scene.traverse(object => {
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
}
{
  const scene = new Scene(), geometry = new CylinderGeometry();
  const pool = buildDroneVisualPool(scene, geometry);
  const first = { drone: pool.drones[0], beam: pool.beams[1], shell: pool.droneShells[0], ring: pool.targetRings[0], field: pool.fields[0] };
  const pilot = pool.beams[0];
  for (const size of [9, 24]) {
    pool.ensure(size);
    assert.equal(pool.drones.length, size);
    assert.equal(pool.beams.length, size + 1);
    assert.equal(pool.droneShells.length, size);
    assert.equal(pool.targetRings.length, size);
    assert.equal(pool.fields.length, size);
    assert.equal(scene.children.length, size * 5 + 1);
    for (let i = 0; i < size; i++) {
      for (const object of [pool.drones[i], pool.beams[i + 1], pool.droneShells[i], pool.targetRings[i], pool.fields[i].group]) {
        assert.equal(object.parent, scene); assert.equal(object.visible, false);
      }
      assert.equal(pool.beams[i + 1].geometry, geometry);
      assert.equal(pool.droneShells[i].geometry, geometry);
    }
  }
  pool.ensure(8);
  assert.equal(pool.drones.length, 24, 'reuse retained slots after a smaller fleet loads');
  assert.equal(pool.beams[0], pilot, 'growing the fleet never takes the pilot beam');
  assert.deepEqual({ drone: pool.drones[0], beam: pool.beams[1], shell: pool.droneShells[0], ring: pool.targetRings[0], field: pool.fields[0] }, first, 'existing visual identity survives growth');
  disposeScene(scene);
  console.log('✓ All visual slots grow beyond eight together and preserve existing drone and pilot identities');
}
{
  const scene = new Scene(), coverage = buildCoverageVisual(scene), old = coverage.mesh;
  let disposed = 0, geometryDisposed = 0, materialDisposed = 0;
  old.addEventListener('dispose', () => disposed++);
  old.geometry.addEventListener('dispose', () => geometryDisposed++);
  old.material.addEventListener('dispose', () => materialDisposed++);
  const established = { segments: [{ pathIndex: 0, metres: 4100, points: Array.from({ length: 4101 }, (_, i) => ({ x: i, y: 0, z: 0 })) }], color: 0xb5a2ff, width: 0.85 };
  const preview = { segments: [{ pathIndex: 1, metres: 2, points: [{ x: 20, y: 30, z: 7 }, { x: 20, y: 32, z: 7 }] }], color: 0xffcf7e, width: 2.2 };
  coverage.sync([established, preview]);
  const mesh = coverage.mesh;
  assert.equal(mesh.count, 4101, 'established highlights cannot truncate the appended preview');
  assert.ok(mesh.instanceMatrix.count >= 4101); assert.equal(mesh.parent, scene); assert.equal(old.parent, null);
  assert.equal(scene.children.length, 1); assert.equal(disposed, 1, 'replaced instance buffers are explicitly disposed');
  assert.equal(mesh.geometry, old.geometry); assert.equal(mesh.material, old.material);
  assert.equal(geometryDisposed, 0); assert.equal(materialDisposed, 0);
  const matrix = new Matrix4(), position = new Vector3(), scale = new Vector3(), rotation = new Quaternion(), color = new Color();
  mesh.getMatrixAt(4100, matrix); matrix.decompose(position, rotation, scale);
  near(position.x, 20); near(position.y, 31); near(position.z, 7);
  near(scale.x, 2.2); near(scale.y, 2.2); near(scale.z, 2);
  mesh.getColorAt(4100, color); assert.equal(color.getHex(), preview.color, 'last preview retains its own color');
  coverage.sync([preview]);
  assert.equal(coverage.mesh, mesh); assert.equal(mesh.count, 1, 'shrinking the visible batch leaves no stale highlights');
  coverage.sync([]); assert.equal(mesh.count, 0);
  disposeScene(scene);
  assert.equal(geometryDisposed, 1); assert.equal(materialDisposed, 1);
  console.log('✓ Coverage grows past 4096, retains the active preview and releases superseded instance buffers');
}
console.log('\n2 renderer allocation checks passed. No browser or visual verification performed.');
