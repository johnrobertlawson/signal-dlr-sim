import { STATION_MAP } from './dlrData';
import { lineColour } from './fleetPlatform';
import { getPassingUnits } from './fleetTraffic';
import { drawFleetScene, type CameraShot } from './fleetScene';
import type { DLRSimBridge } from './telemetryDesk';
import type { DLRSimulation } from './simulation';
import type { Train } from './types';

type Feed = Pick<DLRSimBridge, 'sim' | 'schematic'>;

function chooseDirectorUnit(sim: DLRSimulation, previous?: Train) {
  const incidents = sim.incidents.filter(incident => !incident.resolved);
  // Rotate ties so several units affected by the same incident get screen time.
  const start = previous ? sim.trains.indexOf(previous) + 1 : 0;
  let best: Train | undefined;
  let bestScore = -1;
  for (let i = 0; i < sim.trains.length; i++) {
    const unit = sim.trains[(i + start) % sim.trains.length];
    const station = sim.nodeMap[unit.currentNodeId]?.stationId;
    const nextStation = unit.nextNodeId ? sim.nodeMap[unit.nextNodeId]?.stationId : undefined;
    let incidentScore = 0;
    for (const incident of incidents) {
      const local = (incident.stationId && [station, nextStation].includes(incident.stationId))
        || (incident.nodeId && [unit.currentNodeId, unit.nextNodeId].includes(incident.nodeId));
      if (incident.trainId === unit.id || local) {
        const severity = { CRITICAL: 3, WARNING: 2, ADVISORY: 1 }[incident.severity];
        incidentScore = Math.max(incidentScore, severity * 100 + (incident.trainId === unit.id ? 20 : 0));
      }
    }
    const crowd = Math.max(sim.stationCrowdMultiplier[station ?? ''] ?? 1, sim.stationCrowdMultiplier[nextStation ?? ''] ?? 1);
    const score = incidentScore + (unit.state === 'BROKEN_DOWN' ? 40 : 0) + crowd * 5 + unit.passengers / unit.maxCapacity;
    if (score > bestScore) {
      best = unit;
      bestScore = score;
    }
  }
  return best;
}

function mountCamera(root: HTMLElement, getFeed: () => Feed | undefined, wall: boolean) {
  root.classList.add('fleet-camera');
  root.classList.toggle('fleet-wall', wall);
  root.innerHTML = `
    <div class="fleet-frame">
      <canvas width="384" height="216" aria-label="Live low-poly railway camera"></canvas>
      <div class="fleet-empty"></div>
      <div class="fleet-osd"><b></b><span></span><strong></strong></div>
    </div>
    <div class="fleet-connections" hidden></div>
    <div class="fleet-controls">
      ${wall ? '<label>Feed <select class="fleet-source"><option value="follow">Follow selection</option><option value="pin">Pin current unit</option><option value="tour">Fleet tour</option><option value="director">Incident director</option><option value="airport">LCY runway camera</option></select></label>' : ''}
      <label>Camera <select class="fleet-shot"><option value="auto">Alternating</option><option value="trackside">Trackside</option><option value="front">Front window</option></select></label>
      <button type="button" class="fleet-info" aria-pressed="true">Readout</button>
      <button type="button" class="fleet-expand">${wall ? 'Full screen' : 'Pop out ↗'}</button>
    </div>`;
  const canvas = root.querySelector('canvas')!;
  const ctx = canvas.getContext('2d', {alpha: false});
  const empty = root.querySelector<HTMLElement>('.fleet-empty')!;
  const osd = root.querySelector<HTMLElement>('.fleet-osd')!;
  const [headcode, location, speed] = Array.from(osd.children);
  const shotSelect = root.querySelector<HTMLSelectElement>('.fleet-shot')!;
  const source = root.querySelector<HTMLSelectElement>('.fleet-source');
  const pinOption = source?.querySelector<HTMLOptionElement>('[value="pin"]');
  const connections = root.querySelector<HTMLElement>('.fleet-connections')!;
  let displayedStop: string | undefined;
  const info = root.querySelector<HTMLButtonElement>('.fleet-info')!;
  info.onclick = () => {
    osd.hidden = !osd.hidden;
    info.setAttribute('aria-pressed', String(!osd.hidden));
  };
  const expand = root.querySelector<HTMLButtonElement>('.fleet-expand')!;
  if (wall) {
    expand.hidden = !document.fullscreenEnabled;
    expand.onclick = () => { void (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen()).catch(() => {}); };
    document.addEventListener('fullscreenchange', () => {
      expand.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
    });
  } else {
    expand.onclick = () => document.getElementById('open-fleet-camera')?.click();
  }

  let current: Train | undefined;
  let pinned: Train | undefined;
  let dwellUntil = 0;
  let shotStart = 0;
  let oldFrame = '';
  let movingScenery = false;
  let lastSceneryTime = -1;
  let inView = true;
  if (!wall) new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }).observe(canvas);
  if (source) source.onchange = () => {
    if (source.value === 'pin') pinned = current;
    dwellUntil = 0;
  };

  function refresh(now: number) {
    const feed = getFeed();
    const sim = feed?.sim;
    const fleet = sim?.trains ?? [];
    let subject = feed?.schematic.selectedTrain ?? undefined;
    if (source?.value === 'pin') subject = pinned;
    if (sim && (source?.value === 'director' || source?.value === 'tour')) {
      subject = current;
      if (!current || !fleet.includes(current) || now >= dwellUntil) {
        const index = current ? fleet.indexOf(current) : -1;
        subject = source.value === 'director' ? chooseDirectorUnit(sim, current) : fleet[(index+1) % fleet.length];
        dwellUntil = now + 20000;
      }
    }
    const runway = source?.value === 'airport';
    if (runway) subject = undefined;
    shotSelect.disabled = runway;
    if (subject && !fleet.includes(subject)) subject = undefined;
    if (subject !== current) {
      current = subject;
      shotStart = now;
      oldFrame = '';
    }
    if (pinOption) pinOption.disabled = !current && source?.value !== 'pin';
    root.hidden = !wall && !current;
    const ready = Boolean((current || runway) && sim && ctx);
    canvas.hidden = !ready;
    empty.hidden = ready;
    if (!ready) connections.hidden = true;
    osd.style.visibility = ready ? '' : 'hidden';
    if (runway && sim && ctx) {
      connections.hidden = true;
      headcode.textContent = 'LCY';
      location.textContent = 'Runway camera';
      speed.textContent = sim.formatSimTime();
      if (!document.hidden && (oldFrame !== 'runway' || sim.simTimeSeconds !== lastSceneryTime)) {
        drawFleetScene(ctx, sim, undefined, 'airport', []);
        oldFrame = 'runway';
        lastSceneryTime = sim.simTimeSeconds;
      }
      return;
    }
    if (!sim || !current || !ctx) {
      const message = !ctx ? 'Camera display unavailable.' : !sim ? 'Signal lost · Open Fleet Camera from the main simulator.'
        : !fleet.length ? 'Fleet standby · Waiting for a unit to enter service.'
        : source?.value === 'pin' ? 'Pinned unit left service · Choose another feed.'
        : 'Select a train on the map, or choose Fleet tour.';
      if (empty.textContent !== message) empty.textContent = message;
      return;
    }
    if (!inView || document.hidden) return;
    const shot: CameraShot = shotSelect.value === 'auto'
      ? (Math.floor((now-shotStart)/9000) % 2 ? 'front' : 'trackside')
      : shotSelect.value as CameraShot;
    const here = sim.nodeMap[current.currentNodeId], next = sim.nodeMap[current.nextNodeId ?? ''];
    const near = current.edgeProgress > 0.5 && next ? next : here;
    const name = near?.name ?? current.currentNodeId;
    const length = Math.max(120, sim.edgeMap[current.currentEdgeId ?? '']?.lengthMeters ?? 120);
    const platform = near?.type === 'platform' && length * (near === here ? current.edgeProgress : 1-current.edgeProgress) < 95
      ? STATION_MAP[near.stationId ?? ''] : undefined;
    connections.hidden = osd.hidden || !platform?.interchange?.length;
    if (platform?.id !== displayedStop) {
      displayedStop = platform?.id;
      connections.replaceChildren();
      if (platform?.interchange?.length) {
        const title = document.createElement('b');
        title.textContent = 'Change at ' + platform.name;
        connections.append(title);
        for (const service of platform.interchange) {
          const item = document.createElement('span');
          item.style.borderColor = lineColour(service);
          item.textContent = service;
          connections.append(item);
        }
      }
    }
    const passing = shot === 'front' ? getPassingUnits(sim, current) : [];
    const traffic = passing.map(({ unit, nose }) => [unit.id, unit.headcode, nose].join(':')).join(',');
    const queues = [here, next].map(n => n?.stationId ? [sim.platformWaiting(n.stationId+'_UP'), sim.platformWaiting(n.stationId+'_DN')].join('/') : '');
    const frame = [queues, traffic, current.headcode, shot, current.currentNodeId, current.currentEdgeId, current.previousEdgeId, current.nodePath[2], current.edgeProgress, Math.floor(sim.simTimeSeconds/60)].join('|');
    if (frame !== oldFrame || (movingScenery && sim.simTimeSeconds !== lastSceneryTime)) {
      movingScenery = drawFleetScene(ctx, sim, current, shot, passing);
      lastSceneryTime = sim.simTimeSeconds;
      oldFrame = frame;
    }
    if (headcode.textContent !== current.headcode) headcode.textContent = current.headcode;
    if (location.textContent !== name) location.textContent = name;
    const mph = Math.round(current.speedMph) + ' mph';
    if (speed.textContent !== mph) speed.textContent = mph;
  }
  // Polling also handles disappeared pins and a closed or reloaded main window.
  refresh(performance.now());
  const timer = window.setInterval(() => { if (!document.hidden) refresh(performance.now()); }, 67);
  window.addEventListener('pagehide', (e) => { if (!e.persisted) clearInterval(timer); });
  return () => refresh(performance.now());
}

export function mountInspectorCamera(feed: Feed, feedback: HTMLElement) {
  const root = document.getElementById('inspector-fleet-camera')!;
  let popup: Window | null = null;
  document.getElementById('open-fleet-camera')!.onclick = () => {
    if (popup && !popup.closed) { popup.focus(); return; }
    const url = new URL(window.location.href);
    url.search = '?mode=fleet';
    popup = window.open(url, 'dlr_fleet_camera', 'popup,width=1000,height=650');
    if (!popup) feedback.textContent = 'Allow pop-up windows for this simulator to open the fleet camera.';
  };
  return mountCamera(root, () => feed, false);
}

export function mountFleetWall() {
  document.title = 'DLR · Fleet Camera';
  const root = document.createElement('main');
  root.setAttribute('aria-label', 'Third monitor fleet camera');
  document.body.replaceChildren(root);
  mountCamera(root, () => {
    try { return window.opener?.closed ? undefined : (window.opener as Window | null)?.__dlrSimBridge; }
    catch { return undefined; }
  }, true);
}
