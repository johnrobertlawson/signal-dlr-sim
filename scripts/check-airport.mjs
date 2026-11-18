// Run the real simulation in Vite's module loader, with no browser or running game required.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { DLRSimulation } = await vite.ssrLoadModule('/src/simulation.ts');
  const { Airport } = await vite.ssrLoadModule('/src/airport.ts');
  const sim = new DLRSimulation();
  sim.loadShiftPreset('MON_0730');
  const now = sim.simTimeSeconds;
  const airport = sim.airport;
  const scheduled = new Airport('MON', now);
  assert.equal(airport.movement(now).inbound, true);
  assert.equal(airport.delayBank(now), true);
  assert.equal(airport.delayBank(now), false);
  const held = airport.flights.filter(f => f.expected > f.scheduled);
  assert.ok(held.length >= 4);
  assert.ok(held.every((f,i) => !i || f.expected >= held[i-1].expected+90));
  const delayed = held.find(f => f.inbound);
  assert.equal(airport.movement(delayed.scheduled), undefined);
  assert.equal(airport.movement(delayed.expected), delayed);
  const start = delayed.expected + 240, end = start + 240;
  assert.ok(airport.railFlows(start,end).arrivals >= delayed.railPassengers);
  assert.ok(airport.railFlows(start,end+240).arrivals > scheduled.railFlows(start,end+240).arrivals);
  const sunday = new Airport('SAT', 13*3600);
  assert.equal(sunday.movement(13*3600), undefined);
  assert.ok(sunday.board(13*3600).every(f => f.scheduled >= 86400+12.5*3600));
  sunday.advance(86400);
  assert.equal(new Set(sunday.flights.map(f => f.scheduled)).size,sunday.flights.length);

  const queue = id => sim.platformWaiting(id);
  assert.ok(queue('BNK_DN') > queue('BKP_DN'));
  sim.timeScale = 0;
  const initial = queue('LCA_UP');
  sim.tick(100);
  assert.equal(queue('LCA_UP'), initial);
  sim.timeScale = 1;
  sim.trains = [];
  sim.templates.forEach(t => { t.active = false; });
  sim.tick(60);
  assert.ok(queue('LCA_UP') > initial);
  const t = sim.spawnTrainFromRoute(sim.templates[1],'KGV_UP',['KGV','LCA','PDK'],'PDK');
  t.passengers = t.maxCapacity;
  t.airportPassengers = 0;
  t.state = 'MOVING';
  t.edgeProgress = 1;
  const local = queue('LCA_UP'), carried = sim.totalPassengersCarried;
  sim.tick(0.01);
  assert.equal(t.currentNodeId, 'LCA_UP');
  assert.ok(t.passengers <= t.maxCapacity);
  assert.equal(local-queue('LCA_UP'), sim.totalPassengersCarried-carried);
  assert.ok(local > queue('LCA_UP'));
  sim.loadShiftPreset('MON_0730');
  assert.equal(queue('LCA_UP'),initial);
  assert.ok(sim.airport.flights.every(f => f.expected === f.scheduled));
  console.log('Passed flight retiming, recovery transfers, weekend closure, platform demand, boarding, pause and shift reset.');
} finally {
  await vite.close();
}
