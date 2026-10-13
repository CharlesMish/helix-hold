// Bounded, deterministic source simulation; no browser or human playtest.
// Reuses the original trial's exact candidate search and paid placement APIs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { api, fullTrial } from './crown-trial.mjs';

const round = n => +n.toFixed(3);
const sum = xs => xs.reduce((a, b) => a + b, 0);
const reference = JSON.parse(await readFile(new URL('../docs/SPLIT_CROWN_TRIAL.json', import.meta.url), 'utf8'));
const baseline = withField => reference.results.find(r => r.strategy === 'dedicated' && r.withField === withField && r.refit && r.carrierRoute === 5 && (!withField || r.fieldSlot === 7));
const fleetPose = d => ({ id: d.id, mode: d.mode, paid: d.paid, position: [d.x, d.y, d.z], aim: [d.ax, d.ay, d.az] });

function measure(label, withField, refitId, referenceCenter = null) {
  let fieldCenter = referenceCenter, carrierRef, spawnAt, resolvedAt, minimumHp = Infinity;
  let aliveSeconds = 0, carrierFieldSeconds = 0, carrierZoneSeconds = 0;
  let enemyFieldSeconds = 0, enemyZoneSeconds = 0, carrierFieldMetres = 0;
  let pilotContactFrames = 0, finalFleet, carrierInitialHp, finalRun;
  const waveStarts = [];
  const result = fullTrial('dedicated', withField, true, 6, 4, {
    ...(refitId === undefined ? {} : { refitId }),
    beforeStep(run, dt) {
      finalRun = run;
      const fields = run.drones.filter(d => d.mode === 'stasis');
      const selectedSlotBought = run.drones.some(d => d.id === 7);
      if (fields.length && !fieldCenter) fieldCenter = { x: fields[0].x, y: fields[0].y, z: fields[0].z };
      if (!waveStarts.some(w => w.wave === run.waveIndex + 1)) {
        waveStarts.push({ wave: run.waveIndex + 1, core: run.core, scrap: run.scrap, fleet: run.drones.map(fleetPose) });
        if (run.waveIndex === 7) finalFleet = run.drones.map(fleetPose);
      }
      for (const enemy of run.enemies.filter(e => e.alive)) {
        // Sample the actual drifting enemy center at the same pre-movement
        // point used by moveEnemies. This is seconds, not nominal route metres.
        const inField = fields.some(field => api.insideStasis(field, enemy));
        const inZone = selectedSlotBought && fieldCenter && api.insideStasis(fieldCenter, enemy);
        if (inField) enemyFieldSeconds += dt;
        if (inZone) enemyZoneSeconds += dt;
        if (enemy.kind === 'carrier') {
          assert.equal(enemy.pathIndex, 4, 'measured carrier stays on Gate E');
          carrierRef = enemy;
          aliveSeconds += dt;
          minimumHp = Math.min(minimumHp, enemy.hp);
          if (inField) {
            carrierFieldSeconds += dt;
            carrierFieldMetres += enemy.speed * api.enemySpeedScale(run, enemy) * dt;
          }
          if (inZone) carrierZoneSeconds += dt;
        }
      }
    },
    afterStep(run) {
      if (run.shipHitting) pilotContactFrames++;
      const carrier = run.enemies.find(e => e.alive && e.kind === 'carrier');
      if (carrier && spawnAt === undefined) {
        carrierRef = carrier;
        spawnAt = run.time;
        carrierInitialHp = carrier.hp;
      }
      if (carrier) minimumHp = Math.min(minimumHp, carrier.hp);
      if (run.carrierOutcome !== 'pending' && resolvedAt === undefined) {
        assert.ok(carrierRef, 'carrier is observed before resolving');
        assert.equal(carrierRef.kind, 'carrier', 'carrier pool entry was not reused before observation');
        resolvedAt = run.time;
        minimumHp = Math.min(minimumHp, carrierRef.hp);
      }
    },
  });
  assert.equal(pilotContactFrames, 0, 'pilot supplies no extra damage');
  assert.ok(Math.abs(enemyFieldSeconds - finalRun.stasisExposure) < 1e-7, 'independent actual-center samples reproduce simulation exposure');
  assert.ok(Math.abs(aliveSeconds - (resolvedAt - spawnAt)) < 1e-7, 'carrier observed duration matches spawn-to-resolution clock');
  assert.equal(sum(result.contributions.map(d => d.paid)), 496, 'both eight-slot fleets spend the same normal costs');
  const selected = result.contributions.find(d => d.slot === 7);
  return {
    label, result, waveStarts,
    summary: {
      phase: result.phase, finalCore: result.core, finalScrap: result.scrap,
      kills: result.kills, totalEffectiveDamage: round(sum(finalRun.drones.map(d => d.damage))),
      paidScrap: sum(result.contributions.map(d => d.paid)), refitUnit: result.revisions[0].id,
      slot7: selected,
      actualFieldEnemySeconds: round(enemyFieldSeconds),
      referenceZoneEnemySeconds: round(enemyZoneSeconds),
      carrier: {
        outcome: finalRun.carrierOutcome, initialHp: round(carrierInitialHp),
        elapsedToOutcomeSeconds: round(resolvedAt - spawnAt),
        timeToCoreSeconds: finalRun.carrierOutcome === 'breached' ? round(resolvedAt - spawnAt) : null,
        lowestHpIncludingTerminalFrame: round(minimumHp),
        effectiveDamage: round(carrierInitialHp - Math.max(0, carrierRef.hp)),
        actualFieldSeconds: round(carrierFieldSeconds),
        distanceTravelledWhileSlowedMetres: round(carrierFieldMetres),
        referenceZoneSeconds: round(carrierZoneSeconds),
        routeDistanceAtOutcomeMetres: round(carrierRef.dist),
      },
      pilotContactFrames,
    },
    fieldCenter, finalFleet,
  };
}

const originalField = measure('Original dedicated: seventh purchase is Stasis, refit unit 6', true);
const originalPierce = measure('Original dedicated: seventh purchase is Pierce, refit unit 7', false, undefined, originalField.fieldCenter);
const matchedPierce = measure('Matched refit: seventh purchase is Pierce, refit unit 6', false, 6, originalField.fieldCenter);
assert.deepEqual(originalField.result, baseline(true), 'original field trial reproduces committed evidence exactly');
assert.deepEqual(originalPierce.result, baseline(false), 'original Pierce trial reproduces committed evidence exactly');

// Match costs, buy times, seed, wave schedule, all other placed unit poses,
// and the specific refitted unit. The only fleet difference is slot 7's
// purchased mode/pose. Different earned scrap/core are measured outcomes.
for (let i = 0; i < originalField.waveStarts.length; i++) {
  const a = originalField.waveStarts[i], b = matchedPierce.waveStarts[i];
  assert.deepEqual(a.fleet.filter(d => d.id !== 7), b.fleet.filter(d => d.id !== 7), `wave ${i + 1} non-test units match exactly`);
}
assert.deepEqual(originalField.result.placements.map(p => [p.beforeWave, p.slot, p.paid]), matchedPierce.result.placements.map(p => [p.beforeWave, p.slot, p.paid]));
assert.deepEqual(originalField.result.revisions, matchedPierce.result.revisions, 'same unit, paid value, and refit coverage');
const fleetDifferences = (a, b) => a.finalFleet.filter((d, i) => JSON.stringify(d) !== JSON.stringify(b.finalFleet[i])).map(d => d.id);
assert.deepEqual(fleetDifferences(originalField, matchedPierce), [7]);
assert.deepEqual(fleetDifferences(originalField, originalPierce), [6, 7]);

console.log(JSON.stringify({
  question: 'What is the cost and benefit of buying a 92-scrap Stasis drone instead of a seventh Pierce in the existing dedicated Crown layout?',
  method: {
    seed: 17, timestepSeconds: 1 / 60, initialScrap: 60, totalPurchaseCost: 496,
    purchasedSlot: 7, purchaseBeforeWave: 6, selectedSlotCost: 92,
    fieldRadiusMetres: api.STASIS_RADIUS, fieldSpeedScale: api.STASIS_SPEED_SCALE,
    fieldCenter: originalField.fieldCenter,
    actualContact: 'Actual enemy-center 3D membership sampled before movement at 60 Hz, independently checked against cumulative simulation Stasis exposure. Enemy-seconds sums concurrent enemies; it is not elapsed time or route length.',
    referenceZone: 'Same stationary 6m sphere observed from the seventh purchase onward, including damage-only runs. This is a counterfactual geographic zone, not applied slowing.',
    terminalHp: 'Includes kill/leak frame, unlike the older alive-only lowest-HP statistic. No time-to-core is reported for a carrier killed before arrival.',
    limitation: 'One deterministic seed and idealized setup pose search through ordinary paid placement/refit APIs. No browser rendering, user-interface comprehension, human difficulty, optimality or general balance claim. Slot 7 mode and suitable placement differ together.',
  },
  confound: 'Original pair changes slot 7 purchase AND the wave-8 refitted unit: the second-to-last Pierce is unit 7 without Stasis and unit 6 with Stasis. This is not a pure field effect and no owned drone is recalled/replaced.',
  checks: { originalRowsExactlyReproduced: 2, matchedNonTestFleetEveryWave: true, matchedPurchaseTimingAndCosts: true, matchedRefitUnitAndPose: true, actualContactMatchesSimulation: true },
  originalComparisonDifferingFinalUnitIds: fleetDifferences(originalField, originalPierce),
  matchedComparisonDifferingFinalUnitIds: fleetDifferences(originalField, matchedPierce),
  results: [originalPierce, originalField, matchedPierce].map(r => ({ label: r.label, ...r.summary, waves: r.result.waves, contributions: r.result.contributions, finalFleet: r.finalFleet })),
}, null, 2));
