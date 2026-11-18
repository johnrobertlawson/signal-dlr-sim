import { FleetFrameBudget } from './fleetFrameBudget';
import type { DLRSimulation } from './simulation';
import { drawFleetScene } from './fleetScene';

export function mountAirportBoard(sim: DLRSimulation) {
  const panel = document.querySelector<HTMLElement>('#lcy-board')!;
  const canvas = panel.querySelector('canvas')!;
  const budget = new FleetFrameBudget();
  let inView = false;
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }).observe(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  const rows = panel.querySelector('tbody')!;
  const transfers = panel.querySelector('#lcy-transfer-count')!;
  const delay = panel.querySelector<HTMLButtonElement>('#lcy-delay')!;
  let signature = '', lastFrame = -Infinity, lastTime = -1;
  delay.onclick = () => {
    if (sim.airport.delayBank(sim.simTimeSeconds)) {
      sim.addLog('INCIDENT', 'LCY runway hold. Flights will resume at reduced spacing. Expect a wave of DLR passengers after baggage reclaim.');
      refresh('LCA');
    }
  };
  const clock = (t: number) => sim.formatSimTime(t).slice(-8,-3);
  function refresh(station: string) {
    panel.hidden = station !== 'LCA';
    if (panel.hidden) return;
    const now = sim.simTimeSeconds;
    const flights = sim.airport.board(now);
    const html = flights.map(f => {
      let status = 'On time';
      if (!Number.isFinite(f.expected)) status = 'Cancelled';
      else if (now >= f.expected) status = f.inbound ? 'Landed' : 'Departed';
      else if (f.expected > f.scheduled) status = 'Est ' + clock(f.expected);
      else if (f.expected - now < 60) status = f.inbound ? 'Approach' : 'Takeoff';
      const due = (Math.floor(f.scheduled/86400) > Math.floor(now/86400) ? sim.formatSimTime(f.scheduled).slice(0,4) : '') + clock(f.scheduled);
      return '<tr><td>'+f.number+'</td><td>'+(f.inbound ? 'From ' : 'To ')+f.city+'</td><td>'+due+'</td><td>'+status+'</td></tr>';
    }).join('');
    if (html !== signature) { rows.innerHTML = html; signature = html; }
    transfers.textContent = sim.platformWaiting('LCA_UP') + ' waiting towards Canning Town · ' + sim.platformWaiting('LCA_DN') + ' towards Woolwich';
    delay.disabled = !sim.airport.canDelay(now);
  }
  return { refresh, draw(now: number) {
    if (panel.hidden || !inView || document.hidden || !ctx || now-lastFrame < budget.intervalMs - 0.5 || sim.simTimeSeconds === lastTime) return;
    const start = performance.now();
    drawFleetScene(ctx, sim, undefined, 'airport', []);
    budget.record(start);
    lastFrame = now;
    lastTime = sim.simTimeSeconds;
  } };
}
