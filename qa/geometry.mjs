// Pure geometry audit: imports constructors, never creates WebGL or a browser.
import { build } from 'esbuild';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{contents:'export { buildEnemyGeometries, buildStasisFieldVisual } from "./src/game/scene"; export { STASIS_RADIUS } from "./src/game/combat";',resolveDir:new URL('../',import.meta.url).pathname},bundle:true,platform:'node',format:'esm',write:false});
const {buildEnemyGeometries,buildStasisFieldVisual,STASIS_RADIUS}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const radius={shard:.72,barge:1.25,wisp:.64,carrier:2.2};
for(const [kind,parts] of Object.entries(buildEnemyGeometries())){
 let max=0;
 for(const geometry of Object.values(parts)){
  const a=geometry.attributes.position;
  for(let i=0;i<a.count;i++)max=Math.max(max,Math.hypot(a.getX(i),a.getY(i),a.getZ(i)));
  geometry.dispose();
 }
 assert.ok(max<=radius[kind],`${kind}: model ${max} exceeds collider ${radius[kind]}`);
 console.log(`${kind}: maximum solid radius ${max.toFixed(4)}m <= ${radius[kind]}m`);
}
for(const preview of [true,false]){
 const field=buildStasisFieldVisual(preview);
 field.group.updateMatrixWorld(true);
 assert.equal(field.boundary.type,preview?'LineDashedMaterial':'LineBasicMaterial');
 assert.equal(field.skin===null,preview,'Only anchored fields may have a filled skin');
 for(const object of field.group.children){
  const a=object.geometry.attributes.position;
  for(let i=0;i<a.count;i++){
   const radius=Math.hypot(a.getX(i),a.getY(i),a.getZ(i));
   assert.ok(Math.abs(radius-STASIS_RADIUS)<0.00001,`Field boundary ${radius} differs from collision radius ${STASIS_RADIUS}`);
  }
 }
 const geometries=new Set(field.group.children.map(object=>object.geometry));
 for(const geometry of geometries)geometry.dispose();
 field.boundary.dispose();field.skin?.dispose();
 console.log(`${preview?'Preview':'Anchored'} Stasis: every boundary vertex lies at actual ${STASIS_RADIUS}m radius`);
}
