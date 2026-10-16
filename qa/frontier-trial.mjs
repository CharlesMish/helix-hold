// Small funded geometry-feasibility probe. Idealized legal setup positions and
// an idle pilot; this is not wave optimization, a human playtest or endless play.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: 'export * from "./src/game/sim"; export * from "./src/game/paths"; export * from "./src/game/combat";', resolveDir: new URL('../', import.meta.url).pathname }, bundle: true, platform: 'node', format: 'esm', write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { createRun, FRONTIER_INDEX, LEVELS, DRONE_SPECS, getBeamCoverage, getDroneCoverage, getAnchorCost, tryAnchor, nextWaveNow, step } = api;
const level = LEVELS[FRONTIER_INDEX], dt = 1 / 60;
const neutral = { thrust: 0, steer: 0, pitch: 0, boost: false, anchor: false, expand: false, shift: 0 };
const candidates = [];
function propose(a, b) {
  const length = Math.hypot(b.x-a.x, b.y-a.y, b.z-a.z);
  if (length < 1) return;
  const f = { x:(b.x-a.x)/length, y:(b.y-a.y)/length, z:(b.z-a.z)/length };
  const p = { x:a.x-f.x*4, y:a.y-f.y*4, z:a.z-f.z*4, f };
  if (p.y<1.6 || p.y>44 || Math.hypot(p.x,p.z)>52 || Math.abs(Math.asin(f.y))>1.05) return;
  const beam = { ...DRONE_SPECS.pierce, x:p.x+f.x*.7, y:p.y+f.y*.7, z:p.z+f.z*.7, dx:f.x, dy:f.y, dz:f.z };
  const coverage = getBeamCoverage({ paths:level.paths }, beam);
  p.metres = level.paths.map((_, lane) => coverage.segments.filter(s=>s.pathIndex===lane).reduce((n,s)=>n+s.metres,0));
  candidates.push(p);
}
for (const path of level.paths) {
  for (let d=0; d<path.length-7; d+=5) for (const span of [10,22,38]) {
    const a=path.pointAt(d), b=path.pointAt(Math.min(path.length,d+span));
    propose(a,b); propose(b,a);
  }
}
for (let a=0;a<level.paths.length;a++) for(let b=a+1;b<level.paths.length;b++) {
  for(const ta of [.15,.4,.65,.85]) for(const tb of [.15,.4,.65,.85]) {
    const p=level.paths[a].pointAt(level.paths[a].length*ta), q=level.paths[b].pointAt(level.paths[b].length*tb);
    propose(p,q); propose(q,p);
  }
}
function setPose(run,p) {
  Object.assign(run.ship,{x:p.x,y:p.y,z:p.z,yaw:Math.atan2(-p.f.x,-p.f.z),pitch:Math.asin(p.f.y),vx:0,vy:0,vz:0});
  Object.assign(run,{aimx:p.f.x,aimy:p.f.y,aimz:p.f.z,droneMode:'pierce'});
}
function coverage(run) {
  const totals=level.paths.map(()=>0);
  for(const d of run.drones) for(const s of getDroneCoverage(run,d).segments) totals[s.pathIndex]+=s.metres;
  return totals; // summed drone contact; deliberately not unique route length
}
function runTrial(policy) {
  let writes=0;
  globalThis.localStorage={getItem:()=>null,setItem(){writes++;}};
  const run=createRun(FRONTIER_INDEX,17), waves=[], purchases=[], openings=[];
  while(run.phase==='play') {
    assert.ok(run.rest>0);
    const waveNumber=run.waveIndex+2, wave=run.waves[run.waveIndex+1];
    const before=coverage(run), initialDroneDamage=run.drones.map(d=>d.damage);
    const newLane=waveNumber===3?1:waveNumber===6?2:null;
    if(policy==='grow' || waveNumber<=2) {
      while(run.scrap>=getAnchorCost(run,'pierce')) {
        const current=coverage(run);
        const pressure=level.paths.map((_,lane)=>wave.groups.filter(g=>g.path===lane).reduce((n,g)=>n+g.count*({shard:28,barge:96,wisp:40,carrier:450}[g.kind]),0));
        const ranked=candidates.map(p=>({p,score:p.metres.reduce((n,m,lane)=>n+m*Math.sqrt(pressure[lane])/(1+current[lane]/15),0)})).sort((a,b)=>b.score-a.score);
        let anchored=false;
        for(const {p} of ranked) {
          setPose(run,p);
          if(tryAnchor(run)!==null) continue;
          purchases.push({beforeWave:waveNumber,id:run.drones.at(-1).id,paid:run.drones.at(-1).paid,pose:p});
          anchored=true;break;
        }
        if(!anchored) break;
      }
    }
    if(newLane!==null) openings.push({wave:waveNumber,gate:String.fromCharCode(65+newLane),priorFleetMetres:before[newLane],afterPurchaseMetres:coverage(run)[newLane],priorFleetSize:initialDroneDamage.length,newFleetSize:run.drones.length});
    setPose(run,{x:49,y:43,z:0,f:{x:1,y:0,z:0}});
    const core=run.core,kills=run.kills;
    nextWaveNow(run);
    let frames=0,peakAlive=0;
    while(run.phase==='play'&&run.rest===0&&frames++<180/dt) {
      step(run,neutral,dt);run.fx.length=0;
      peakAlive=Math.max(peakAlive,run.enemies.filter(e=>e.alive).length);
    }
    assert.ok(frames<180/dt,'authored wave resolves');
    waves.push({wave:waveNumber,core:run.core,coreLost:core-run.core,kills:run.kills-kills,scrap:run.scrap,drones:run.drones.length,seconds:frames*dt,peakAlive,
      olderDroneDamage:initialDroneDamage.reduce((n,value,i)=>n+run.drones[i].damage-value,0),totalContactMetresByRoute:coverage(run)});
  }
  assert.equal(writes,0,'prototype cannot write campaign records');
  return {policy,phase:run.phase,core:run.core,kills:run.kills,spent:purchases.reduce((n,p)=>n+p.paid,0),purchases,waves,openings};
}
console.log(JSON.stringify({
  question:'Do the authored route openings create new coverage gaps while old paid drones remain useful?',
  method:{seed:17,dt,candidates:candidates.length,setup:'Finite legal idealized Pierce poses; ordinary purchases with earned scrap. Greedy current-wave contact selection. No combat pose changes, no bonus resources, no repositions. Pilot deliberately idle.',
    comparisons:'One growing fleet and the same policy frozen after wave2. Coarse feasibility only; no search over wave schedules or hull values.',
    limits:'One seed, one purchase policy, no human aiming, no browser or performance measurement. Summed contact metres may count a route more than once when multiple drones cover it; it is not unique coverage.'},
  results:[runTrial('grow'),runTrial('freeze-after-wave2')],
},(_,value)=>typeof value==='number'?+value.toFixed(4):value,2));
