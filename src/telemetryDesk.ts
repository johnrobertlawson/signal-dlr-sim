import { DLRSimulation } from './simulation';
import { SchematicCanvas } from './schematicCanvas';
import { ObserveController } from './observeController';
import { STATION_MAP } from './dlrData';
import { Station, TrackEdge, TrackNode, Train } from './types';
import { getStationFactSheet, renderStationMicroSchematicSVG } from './stationFactSheets';
import { soundEngine } from './audio';

export interface DLRSimBridge {
  sim: DLRSimulation;
  schematic: SchematicCanvas;
  observe: ObserveController;
  focusStationOnMainMap: (stationId: string) => void;
  focusTrainOnMainMap: (trainId: string) => void;
  onDeskClosed: () => void;
}

declare global {
  interface Window {
    __dlrSimBridge?: DLRSimBridge;
  }
}

type HealthTier = 'OPTIMAL' | 'ELEVATED' | 'DELAYED' | 'CRITICAL';

interface StationHealthInfo {
  tier: HealthTier;
  score: number;
  color: string;
  symbol: string;
  reason: string;
}

interface PianoNote {
  startSec: number;
  endSec: number;
  label: string;
  subLabel?: string;
  kind: 'STATION' | 'TUNNEL_BYPASS' | 'TURNBACK' | 'SDO' | 'PSA_DELAY' | 'FAULT';
  stationId?: string;
}

const HEALTH_PALETTE: Record<HealthTier, { color: string; bg: string; symbol: string; label: string }> = {
  OPTIMAL: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)', symbol: '✓', label: 'OPTIMAL' },
  ELEVATED: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.16)', symbol: '▲', label: 'ELEVATED' },
  DELAYED: { color: '#F97316', bg: 'rgba(249, 115, 22, 0.18)', symbol: '⚠', label: 'DELAYED' },
  CRITICAL: { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.22)', symbol: '⛔', label: 'BLOCKED' },
};

export function mountSecondMonitorDesk(
  fallbackSim: DLRSimulation,
  fallbackSchematic: SchematicCanvas,
  fallbackObserve: ObserveController
) {
  const getBridge = (): {
    sim: DLRSimulation;
    schematic: SchematicCanvas;
    observe: ObserveController;
    focusStation: (stId: string) => void;
    focusTrain: (trId: string) => void;
  } => {
    const activeOpener = (window.opener as Window | null)?.__dlrSimBridge;
    if (activeOpener) {
      return {
        sim: activeOpener.sim,
        schematic: activeOpener.schematic,
        observe: activeOpener.observe,
        focusStation: activeOpener.focusStationOnMainMap,
        focusTrain: activeOpener.focusTrainOnMainMap,
      };
    }
    return {
      sim: fallbackSim,
      schematic: fallbackSchematic,
      observe: fallbackObserve,
      focusStation: (stId: string) => {
        const st = STATION_MAP[stId];
        if (st) fallbackSchematic.selectedStation = st;
      },
      focusTrain: (trId: string) => {
        const tr = fallbackSim.trains.find((t) => t.id === trId);
        if (tr) fallbackSchematic.selectedTrain = tr;
      },
    };
  };

  document.title = 'DLR SMC — 2nd Monitor Dual-Screen Overwatch, Piano Roll & Telemetry Desk';

  const appEl = document.getElementById('app')!;
  appEl.innerHTML = `
    <div class="desk-shell" id="desk-root-shell">
      <!-- TOP TELEMETRY & COMMAND RIBBON -->
      <header class="top-bar desk-top-bar">
        <div class="brand-cluster">
          <div class="dlr-roundel" aria-hidden="true">
            <span class="roundel-circle"></span>
            <span class="roundel-bar">DLR</span>
          </div>
          <div class="brand-titles">
            <h1>2ND MONITOR OVERWATCH WALL &amp; DEEP TELEMETRY DESK</h1>
            <p class="subtitle" id="desk-sync-subtitle">DUAL-SCREEN HERO OVERWATCH (NETWORK HEALTH + PIANO ROLL) + 4-DECK TELEMETRY</p>
          </div>
        </div>

        <div class="split-flap-telemetry">
          <div class="flap-group">
            <span class="flap-label">CONTROL CLOCK</span>
            <div id="desk-clock-flap" class="flap-display">MON 05:25:00</div>
          </div>
          <div class="flap-group">
            <span class="flap-label">PPM INDEX</span>
            <div id="desk-ppm-flap" class="flap-display teal-text">100.0%</div>
          </div>
          <div class="flap-group">
            <span class="flap-label">ACTIVE FLEET</span>
            <div id="desk-units-flap" class="flap-display">12</div>
          </div>
          <div class="flap-group">
            <span class="flap-label">MEAN SPEED</span>
            <div id="desk-speed-flap" class="flap-display teal-text">0.0 MPH</div>
          </div>
          <div class="flap-group">
            <span class="flap-label">PAX CARRIED</span>
            <div id="desk-pax-flap" class="flap-display">620</div>
          </div>
        </div>

        <div class="speed-cluster" role="group" aria-label="Simulation Speed Controls">
          <button type="button" class="speed-btn desk-spd-btn" data-speed="0">⏸ PAUSE</button>
          <button type="button" class="speed-btn desk-spd-btn" data-speed="0.5">0.5×</button>
          <button type="button" class="speed-btn desk-spd-btn active" data-speed="1">1×</button>
          <button type="button" class="speed-btn desk-spd-btn" data-speed="4">4×</button>
          <button type="button" class="speed-btn desk-spd-btn" data-speed="10">10×</button>
        </div>

        <div class="utility-cluster">
          <button type="button" id="desk-autopilot-btn" class="util-btn observe-toggle-btn" title="Toggle Full Auto-Pilot Sit-Back Mode across Monitor 1 & Monitor 2">
            🛋️ AUTO-PILOT: OFF
          </button>
          <button type="button" id="desk-toggle-hero-size-btn" class="util-btn desk-popout-btn" title="Toggle Dual-Screen Overwatch between 58% Split View and 90% Full-Screen Wall">
            ⛶ EXPAND DUAL SCREEN
          </button>
          <button type="button" id="desk-fix-all-btn" class="mini-action-btn rescue-btn">🆘 HELP! FIX IT</button>
          <button type="button" id="desk-disrupt-btn" class="mini-action-btn">⚡ +DISRUPT</button>
          <button type="button" id="desk-dock-back-btn" class="util-btn accent-btn" title="Close this 2nd monitor window and restore the sidebar on Monitor 1">
            📥 DOCK BACK
          </button>
        </div>
      </header>

      <!-- =========================================================================
           "SECOND SCREEN" DUAL-PANEL HERO OVERWATCH WALL (LARGE SCREEN SHARE)
           Left Panel: Whole-Network Schematic Zoom-Out Colour-Coded by Health
           Right Panel: Live Scrolling Piano-Roll Stock Movements & Events Sequencer
           ========================================================================= -->
      <section class="desk-hero-dual-wall" id="desk-hero-dual-wall" aria-label="Dual-Screen Network Health & Stock Piano Roll Overwatch">
        <!-- LEFT HERO PANEL: WHOLE-NETWORK HEALTH SCHEMATIC ZOOM-OUT -->
        <article class="desk-hero-panel health-map-panel">
          <div class="hero-panel-header">
            <div>
              <span class="eyebrow">SECOND-SCREEN PANEL A · WHOLE-NETWORK HEALTH SCHEMATIC OVERWATCH</span>
              <h3>All 7 Branches &amp; 45 Stations Colour-Coded by Live Operational Health</h3>
            </div>
            <div class="health-legend-pills" role="list" aria-label="Network Health Legend">
              <span class="health-pill optimal" role="listitem">✓ OPTIMAL</span>
              <span class="health-pill elevated" role="listitem">▲ ELEVATED / PSA</span>
              <span class="health-pill delayed" role="listitem">⚠ DELAYED / HELD</span>
              <span class="health-pill critical" role="listitem">⛔ BLOCKED / FAULT</span>
            </div>
          </div>

          <!-- 7-Corridor Health Ribbon -->
          <div id="desk-branch-health-strip" class="branch-health-strip" aria-label="Branch Corridor Health Scores"></div>

          <!-- Full-Network Zoomed-Out Health Canvas -->
          <div class="hero-canvas-stage" id="health-map-stage">
            <canvas id="desk-health-map-canvas" aria-label="Zoomed-out DLR Network Schematic Colour-Coded by Health"></canvas>
            <div id="desk-health-hover-hud" class="hero-canvas-hud">
              Click any station or train on the Health Map to inspect &amp; pan Monitor 1
            </div>
          </div>
        </article>

        <!-- RIGHT HERO PANEL: LIVE SCROLLING PIANO-ROLL STOCK MOVEMENTS & EVENTS -->
        <article class="desk-hero-panel piano-roll-panel">
          <div class="hero-panel-header">
            <div>
              <span class="eyebrow">SECOND-SCREEN PANEL B · LIVE SCROLLING PIANO-ROLL SEQUENCER</span>
              <h3>Upcoming Stock Movements, Bore Dives, SDO Stops, Turnbacks &amp; Events</h3>
            </div>
            <div class="piano-roll-controls">
              <label class="sr-only" for="piano-filter-select">Filter Piano Roll Lanes</label>
              <select id="piano-filter-select" class="piano-ctrl-select" title="Filter Stock Lanes">
                <option value="ALL" selected>All Active Stock &amp; Events</option>
                <option value="CORE_WEST">Bank / TWG / Lewisham (1xx–3xx)</option>
                <option value="NORTH_EAST">Stratford / STI / Beckton / Woolwich (4xx–9xx)</option>
                <option value="ATTENTION">Delayed / PSA / Incidents Only</option>
              </select>
              <div class="piano-horizon-group" role="group" aria-label="Piano Roll Time Horizon">
                <button type="button" class="piano-hz-btn" data-horizon="360">6M</button>
                <button type="button" class="piano-hz-btn active" data-horizon="600">10M</button>
                <button type="button" class="piano-hz-btn" data-horizon="900">15M</button>
              </div>
            </div>
          </div>

          <!-- Piano Roll Note Type Legend Bar -->
          <div class="piano-note-legend">
            <span class="p-note-chip stn">▬ Station Call</span>
            <span class="p-note-chip bore">≈ Sub-Aqueous Bore / WIQ Bypass</span>
            <span class="p-note-chip sdo">▲ 60m SDO (+6s)</span>
            <span class="p-note-chip turn">⇄ Terminus / Pocket Turnback</span>
            <span class="p-note-chip fault">⛔ Fault / 👨‍✈️ PSA 18mph</span>
            <span class="p-note-chip evt">◆ Timetable Wave / Event</span>
          </div>

          <!-- Scrolling Piano-Roll Canvas -->
          <div class="hero-canvas-stage" id="piano-roll-stage">
            <canvas id="desk-piano-roll-canvas" aria-label="Scrolling Piano-Roll Timeline of Upcoming DLR Train Movements and Events"></canvas>
            <div id="desk-piano-hover-hud" class="hero-canvas-hud">
              Scroll wheel to pan unit lanes · Click any train lane or note bar to focus on Monitor 1
            </div>
          </div>
        </article>
      </section>

      <!-- =========================================================================
           LOWER 4-DECK DEEP TELEMETRY & ENGINEERING DASHBOARD GRID
           ========================================================================= -->
      <main class="desk-grid">
        <!-- QUADRANT 1: LIVE FULL-FLEET CBTC & VOBC TELEMETRY TABLE -->
        <section class="desk-card desk-q-fleet" aria-labelledby="fleet-table-caption">
          <div class="card-header">
            <div>
              <span class="eyebrow">SELTRAC MOVING-BLOCK &amp; VOBC LIVE FLEET MATRIX</span>
              <h3>Active DLR Train Units, Block Occupancy &amp; Headway Telemetry</h3>
            </div>
            <span id="desk-fleet-summary-badge" class="station-meta-badge">12 UNITS ACTIVE</span>
          </div>

          <div tabindex="0" role="region" aria-labelledby="fleet-table-caption" class="table-wrapper desk-table-wrapper">
            <table class="fleet-telemetry-table">
              <caption id="fleet-table-caption" class="sr-only">Live DLR Fleet Telemetry, Block Locations, Passenger Loads, and Control Actions</caption>
              <thead>
                <tr>
                  <th scope="col">HEADCODE</th>
                  <th scope="col">STOCK</th>
                  <th scope="col">CURRENT BLOCK / BERTH</th>
                  <th scope="col">NEXT TARGET</th>
                  <th scope="col">VOBC STATE</th>
                  <th scope="col">SPEED</th>
                  <th scope="col">PAX LOAD</th>
                  <th scope="col">VARIANCE</th>
                  <th scope="col">INTERVENTION</th>
                </tr>
              </thead>
              <tbody id="desk-fleet-tbody"></tbody>
            </table>
          </div>
        </section>

        <!-- QUADRANT 2: SELECTED STATION SPLIT-FLAP BOARD + DEEP ENGINEERING FACT SHEET & MICRO-SCHEMATIC -->
        <section class="desk-card desk-q-station">
          <div class="card-header">
            <div>
              <span class="eyebrow">LIVE STATION INSPECTOR · SOLARI BOARD &amp; MICRO-INTERLOCKING</span>
              <h3 id="desk-station-title">CAW · Canary Wharf</h3>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <select id="desk-station-select" class="factsheet-station-select" aria-label="Select Station to Inspect"></select>
              <button type="button" id="desk-focus-station-btn" class="locate-btn" title="Pan Monitor 1 Camera to this Station">🎯 MAP</button>
            </div>
          </div>

          <div class="desk-station-split">
            <div id="desk-station-flap-rows" class="split-flap-board"></div>
            <div id="desk-station-factsheet-box" class="desk-factsheet-scroll"></div>
          </div>
        </section>

        <!-- QUADRANT 3: PRIORITY INCIDENTS, CONTINGENCY PLANS (F1-F4) & LIVE TIMETABLE / EXCEPTION EDITOR -->
        <section class="desk-card desk-q-ops">
          <div class="card-header">
            <div>
              <span class="eyebrow">ACTIVE BOTTLENECKS, CONTINGENCY PLANS &amp; TIMETABLE MATRIX</span>
              <h3>Disruption Recovery, ARS Overrides &amp; Headway Editor</h3>
            </div>
            <span id="desk-incidents-badge" class="station-meta-badge">LIVE OPS</span>
          </div>

          <div class="desk-ops-columns">
            <div class="desk-ops-col">
              <h4 class="desk-subhead">1. Active Blocking Incidents &amp; 1-Click Plans (F1–F4)</h4>
              <div id="desk-incidents-list" class="desk-incidents-list"></div>
              <div id="desk-contingency-grid" class="contingency-grid" style="margin-top:0.5rem;"></div>
            </div>

            <div class="desk-ops-col">
              <h4 class="desk-subhead">2. Live Service Interval Templates &amp; Event Exceptions</h4>
              <div id="desk-templates-list" class="templates-list"></div>
              <div class="desk-exception-strip">
                <button type="button" class="nav-chip-btn desk-ex-btn" data-ex="AIRSHOW">+✈️ Airshow 7xx</button>
                <button type="button" class="nav-chip-btn desk-ex-btn" data-ex="BANKING_CAW">+🏦 CAW Shuttle 6xx</button>
                <button type="button" class="nav-chip-btn desk-ex-btn" data-ex="EXCEL_CUH">+🏛️ ExCeL Shuttle</button>
                <button type="button" class="nav-chip-btn desk-ex-btn" data-ex="ECS_TRANSFER">+🛠️ ECS Depot Run</button>
              </div>
            </div>
          </div>
        </section>

        <!-- QUADRANT 4: NETWORK ANALYTICS, SOP REFERENCE MATRIX, FOOTFALL & LIVE IECC EVENT STREAM -->
        <section class="desk-card desk-q-analytics">
          <div class="card-header">
            <div>
              <span class="eyebrow">NETWORK ANALYTICS, SOP RULES &amp; IECC EVENT TELEMETRY</span>
              <h3>Station Footfall Leaders, Rare Working Log &amp; SOP Interlocking Rules</h3>
            </div>
            <span class="station-meta-badge">SOP-UG1 · TWG · WIQ</span>
          </div>

          <div class="desk-analytics-columns">
            <div class="desk-ops-col">
              <h4 class="desk-subhead">Busiest vs. Quietest Stations &amp; Rare Routes</h4>
              <div id="desk-footfall-boards" class="desk-footfall-stack"></div>

              <h4 class="desk-subhead" style="margin-top:0.55rem;">DLR Interlocking SOP Quick-Reference</h4>
              <div class="sop-ref-grid">
                <div class="sop-chip"><strong>SOP-UG1 (Deep Bores)</strong><span>Max 1 train per tunnel bore in Bank 1:20 dive, Greenwich bore &amp; 50mph Woolwich bore.</span></div>
                <div class="sop-chip"><strong>SOP-UG2 (Bank Headshunt)</strong><span>Bank arrivals reverse via single-bore tail headshunt (BNK_HSH); Plan B splits 2C→TWG / 3C→SHA.</span></div>
                <div class="sop-chip"><strong>SOP-TWG (2-Car 60m Max)</strong><span>Tower Gateway &amp; Minories throat physically lock out 3-car (90m) trains and divert them to Shadwell.</span></div>
                <div class="sop-chip"><strong>SOP-WIQ (CAW→WFE Bypass)</strong><span>Northbound Canary Wharf→Bank trains use the platformless west bypass (DLT_BYP_UP) and skip WIQ.</span></div>
              </div>
            </div>

            <div class="desk-ops-col">
              <h4 class="desk-subhead">Live IECC / SelTrac Signalling Event Stream</h4>
              <div id="desk-log-list" class="telemetry-log-list desk-log-scroll"></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;

  const rootShell = document.getElementById('desk-root-shell')!;
  const syncSubtitle = document.getElementById('desk-sync-subtitle')!;
  const deskAutopilotBtn = document.getElementById('desk-autopilot-btn') as HTMLButtonElement;
  const toggleHeroSizeBtn = document.getElementById('desk-toggle-hero-size-btn')!;
  const clockFlap = document.getElementById('desk-clock-flap')!;
  const ppmFlap = document.getElementById('desk-ppm-flap')!;
  const unitsFlap = document.getElementById('desk-units-flap')!;
  const speedFlap = document.getElementById('desk-speed-flap')!;
  const paxFlap = document.getElementById('desk-pax-flap')!;
  const branchHealthStrip = document.getElementById('desk-branch-health-strip')!;
  const healthMapCanvas = document.getElementById('desk-health-map-canvas') as HTMLCanvasElement;
  const healthHoverHud = document.getElementById('desk-health-hover-hud')!;
  const pianoRollCanvas = document.getElementById('desk-piano-roll-canvas') as HTMLCanvasElement;
  const pianoHoverHud = document.getElementById('desk-piano-hover-hud')!;
  const pianoFilterSelect = document.getElementById('piano-filter-select') as HTMLSelectElement;
  const fleetBadge = document.getElementById('desk-fleet-summary-badge')!;
  const fleetTbody = document.getElementById('desk-fleet-tbody')!;
  const stationTitle = document.getElementById('desk-station-title')!;
  const stationSelect = document.getElementById('desk-station-select') as HTMLSelectElement;
  const stationFlapRows = document.getElementById('desk-station-flap-rows')!;
  const stationFactsheetBox = document.getElementById('desk-station-factsheet-box')!;
  const incidentsList = document.getElementById('desk-incidents-list')!;
  const contingencyGrid = document.getElementById('desk-contingency-grid')!;
  const templatesList = document.getElementById('desk-templates-list')!;
  const footfallBoards = document.getElementById('desk-footfall-boards')!;
  const logList = document.getElementById('desk-log-list')!;

  const healthCtx = healthMapCanvas.getContext('2d')!;
  const pianoCtx = pianoRollCanvas.getContext('2d')!;

  let pianoHorizonSec = 600; // Default 10 minutes ahead
  let pianoFilterMode: string = 'ALL';
  let pianoScrollOffsetRows = 0;
  let lastStationId = '';
  let lastFlapSigs: string[] = [];
  let lastTemplateCount = -1;
  let lastIncidentSig = '';

  // Resize helper for the two high-DPI hero canvases
  function resizeHeroCanvases() {
    const dpr = window.devicePixelRatio || 1;
    const hRect = healthMapCanvas.parentElement?.getBoundingClientRect();
    if (hRect && hRect.width > 10 && hRect.height > 10) {
      healthMapCanvas.width = Math.floor(hRect.width * dpr);
      healthMapCanvas.height = Math.floor(hRect.height * dpr);
      healthCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const pRect = pianoRollCanvas.parentElement?.getBoundingClientRect();
    if (pRect && pRect.width > 10 && pRect.height > 10) {
      pianoRollCanvas.width = Math.floor(pRect.width * dpr);
      pianoRollCanvas.height = Math.floor(pRect.height * dpr);
      pianoCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  window.addEventListener('resize', resizeHeroCanvases);
  setTimeout(resizeHeroCanvases, 30);

  toggleHeroSizeBtn.addEventListener('click', () => {
    const isExpanded = rootShell.classList.toggle('hero-wall-expanded');
    toggleHeroSizeBtn.classList.toggle('active', isExpanded);
    toggleHeroSizeBtn.textContent = isExpanded ? '🗗 SPLIT VIEW (58% / 42%)' : '⛶ EXPAND DUAL SCREEN';
    soundEngine.playRelayClick(isExpanded);
    setTimeout(resizeHeroCanvases, 20);
  });

  pianoFilterSelect.addEventListener('change', () => {
    pianoFilterMode = pianoFilterSelect.value;
    pianoScrollOffsetRows = 0;
  });

  document.querySelectorAll<HTMLButtonElement>('.piano-hz-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      pianoHorizonSec = parseInt(btn.dataset.horizon || '600', 10);
      document.querySelectorAll<HTMLButtonElement>('.piano-hz-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      soundEngine.playRelayClick(true);
    });
  });

  // Populate station selector
  const initBridge = getBridge();
  stationSelect.innerHTML = initBridge.sim.stations
    .map((s) => `<option value="${s.id}">${s.code} — ${s.name} (${s.branch})</option>`)
    .join('');

  stationSelect.addEventListener('change', () => {
    const b = getBridge();
    const st = STATION_MAP[stationSelect.value];
    if (st) {
      b.schematic.selectedStation = st;
      lastStationId = '';
      renderDeskStationInspector(true);
    }
  });

  document.getElementById('desk-focus-station-btn')?.addEventListener('click', () => {
    const b = getBridge();
    const st = b.schematic.selectedStation || STATION_MAP['CAW'];
    b.focusStation(st.id);
  });

  document.querySelectorAll<HTMLButtonElement>('.desk-spd-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const b = getBridge();
      b.sim.timeScale = parseFloat(btn.dataset.speed || '1');
      soundEngine.playRelayClick(b.sim.timeScale > 0);
      renderDeskAll(true);
    });
  });

  deskAutopilotBtn.addEventListener('click', () => {
    const b = getBridge();
    if (b.observe.active) {
      b.observe.toggle(false);
    } else {
      b.observe.engageFullAutopilot();
    }
    renderDeskAll(true);
  });

  document.getElementById('desk-fix-all-btn')?.addEventListener('click', () => {
    const b = getBridge();
    b.observe.engageHelpMeFixIt(true);
    renderDeskAll(true);
  });

  document.getElementById('desk-disrupt-btn')?.addEventListener('click', () => {
    const b = getBridge();
    b.sim.triggerScopedDisruption('ALL');
    renderDeskAll(true);
  });

  document.getElementById('desk-dock-back-btn')?.addEventListener('click', () => {
    (window.opener as Window | null)?.__dlrSimBridge?.onDeskClosed();
    window.close();
  });

  document.querySelectorAll<HTMLButtonElement>('.desk-ex-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const b = getBridge();
      b.sim.injectSpecialExceptionService(btn.dataset.ex!);
      lastTemplateCount = -1;
      renderDeskAll(true);
    });
  });

  // Event delegation for Fleet Telemetry Table action buttons
  fleetTbody.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-fleet-act]');
    if (!target) return;
    const b = getBridge();
    const trId = target.dataset.trId!;
    const act = target.dataset.fleetAct!;
    const tr = b.sim.trains.find((t) => t.id === trId);
    if (!tr) return;

    if (act === 'FOCUS') {
      b.focusTrain(tr.id);
    } else if (act === 'PSA') {
      b.sim.dispatchPsaToTrain(tr.id);
    } else if (act === 'TURN') {
      const nextTurn =
        tr.routeQueue.find((stId) => STATION_MAP[stId]?.hasTurnback || STATION_MAP[stId]?.isTerminus) || 'CAW';
      b.sim.rerouteTrainToDestination(tr, nextTurn === 'CAW' ? 'CAW_MID' : nextTurn);
    }
    renderDeskAll(true);
  });

  // ============================================================================
  // HEALTH EVALUATION ENGINE (Station, Edge & Branch Health Computation)
  // ============================================================================
  function computeStationHealthMap(sim: DLRSimulation): Record<string, StationHealthInfo> {
    const map: Record<string, StationHealthInfo> = {};
    const unresolved = sim.incidents.filter((i) => !i.resolved);

    for (const st of sim.stations) {
      let score = 100;
      let reason = 'Clear Headways · On Schedule';

      // Check active unresolved incidents affecting this station
      const stInc = unresolved.find(
        (inc) => inc.stationId === st.id || (inc.nodeId && inc.nodeId.startsWith(st.id))
      );
      if (stInc) {
        score -= stInc.severity === 'CRITICAL' ? 68 : 42;
        reason = `INCIDENT: ${stInc.title}`;
      }

      // Check stalled or delayed trains at or heading into this station
      const nearbyTrains = sim.trains.filter((t) => {
        const cn = sim.nodeMap[t.currentNodeId];
        const nn = t.nextNodeId ? sim.nodeMap[t.nextNodeId] : undefined;
        return cn?.stationId === st.id || nn?.stationId === st.id;
      });

      for (const tr of nearbyTrains) {
        if (tr.state === 'BROKEN_DOWN') {
          score -= 60;
          reason = `STALLED UNIT ${tr.headcode} (VOBC Fault)`;
        } else if (tr.delaySeconds > 75) {
          score -= 36;
          if (score > 45) reason = `Unit ${tr.headcode} running +${Math.round(tr.delaySeconds)}s late`;
        } else if (tr.psaMode || tr.delaySeconds > 30) {
          score -= 18;
          if (score > 70) reason = tr.psaMode ? `Unit ${tr.headcode} on PSA 18mph manual` : `Minor headway drift (+${Math.round(tr.delaySeconds)}s)`;
        }
      }

      // Check held red signals at this station
      const stNodes = sim.nodes.filter((n) => n.stationId === st.id);
      if (stNodes.some((n) => n.signalHeld)) {
        score -= 35;
        if (score > 45) reason = 'Manual Signal Hold (RED) Active';
      }
      if (stNodes.some((n) => n.pointsFailed)) {
        score -= 65;
        reason = 'Points Interlocking Failure';
      }

      // Check passenger crowd surge
      const crowdMult = sim.stationCrowdMultiplier[st.id] || 1.0;
      if (crowdMult > 1.35) {
        score -= 22;
        if (score > 65) reason = `Crowd Surge (${crowdMult.toFixed(1)}× inflow)`;
      }

      score = Math.max(8, Math.min(100, Math.round(score)));
      const tier: HealthTier =
        score < 45 ? 'CRITICAL' : score < 70 ? 'DELAYED' : score < 88 ? 'ELEVATED' : 'OPTIMAL';

      map[st.id] = {
        tier,
        score,
        color: HEALTH_PALETTE[tier].color,
        symbol: HEALTH_PALETTE[tier].symbol,
        reason,
      };
    }

    return map;
  }

  // Compute health transform for the zoomed-out Whole-Network Health Canvas
  function getHealthMapTransform(w: number, h: number) {
    const minX = 10;
    const maxX = 3110;
    const minY = -20;
    const maxY = 2110;
    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const padX = 24;
    const padY = 22;
    const availW = Math.max(120, w - padX * 2);
    const availH = Math.max(120, h - padY * 2);
    const scale = Math.min(availW / worldW, availH / worldH);
    const offsetX = padX + (availW - worldW * scale) * 0.5 - minX * scale;
    const offsetY = padY + (availH - worldH * scale) * 0.5 - minY * scale;
    return { scale, offsetX, offsetY };
  }

  let healthStationHitBoxes: { st: Station; sx: number; sy: number; r: number; info: StationHealthInfo }[] = [];
  let healthTrainHitBoxes: { tr: Train; sx: number; sy: number }[] = [];

  function drawWholeNetworkHealthCanvas(pulseSec: number) {
    const b = getBridge();
    const sim = b.sim;
    const rect = healthMapCanvas.parentElement?.getBoundingClientRect();
    if (!rect || rect.width < 20 || rect.height < 20) return;
    const w = rect.width;
    const h = rect.height;

    const healthMap = computeStationHealthMap(sim);
    const { scale, offsetX, offsetY } = getHealthMapTransform(w, h);
    const toScreen = (wx: number, wy: number) => ({
      x: offsetX + wx * scale,
      y: offsetY + wy * scale,
    });

    healthCtx.clearRect(0, 0, w, h);

    // 1. Subtle technical grid background
    healthCtx.fillStyle = '#060a10';
    healthCtx.fillRect(0, 0, w, h);

    healthCtx.strokeStyle = 'rgba(30, 48, 72, 0.28)';
    healthCtx.lineWidth = 1;
    const gridStep = 40;
    for (let gx = 0; gx < w; gx += gridStep) {
      healthCtx.beginPath();
      healthCtx.moveTo(gx, 0);
      healthCtx.lineTo(gx, h);
      healthCtx.stroke();
    }
    for (let gy = 0; gy < h; gy += gridStep) {
      healthCtx.beginPath();
      healthCtx.moveTo(0, gy);
      healthCtx.lineTo(w, gy);
      healthCtx.stroke();
    }

    // 2. River Thames Geographical Context Ribbons (Greenwich Bore & Woolwich Bore)
    const thamesWoolwichL = toScreen(2220, 1120);
    const thamesWoolwichR = toScreen(3040, 1120);
    healthCtx.strokeStyle = 'rgba(14, 116, 144, 0.35)';
    healthCtx.lineWidth = Math.max(8, 28 * scale);
    healthCtx.lineCap = 'round';
    healthCtx.beginPath();
    healthCtx.moveTo(thamesWoolwichL.x, thamesWoolwichL.y);
    healthCtx.lineTo(thamesWoolwichR.x, thamesWoolwichR.y);
    healthCtx.stroke();

    const thamesGreenwichL = toScreen(860, 1690);
    const thamesGreenwichR = toScreen(1240, 1690);
    healthCtx.beginPath();
    healthCtx.moveTo(thamesGreenwichL.x, thamesGreenwichL.y);
    healthCtx.lineTo(thamesGreenwichR.x, thamesGreenwichR.y);
    healthCtx.stroke();

    healthCtx.fillStyle = '#38bdf8';
    healthCtx.font = '700 9px monospace';
    healthCtx.textAlign = 'center';
    healthCtx.fillText('🌊 THAMES (WOOLWICH BORE)', (thamesWoolwichL.x + thamesWoolwichR.x) * 0.5, thamesWoolwichL.y + 3);
    healthCtx.fillText('🌊 THAMES (CUTTY SARK)', (thamesGreenwichL.x + thamesGreenwichR.x) * 0.5, thamesGreenwichL.y + 3);

    // 3. Draw All Network Edges Colour-Coded by Health
    for (const edge of sim.edges) {
      const n1 = sim.nodeMap[edge.from];
      const n2 = sim.nodeMap[edge.to];
      if (!n1 || !n2) continue;

      const h1 = n1.stationId ? healthMap[n1.stationId] : undefined;
      const h2 = n2.stationId ? healthMap[n2.stationId] : undefined;
      const worstScore = Math.min(h1 ? h1.score : 100, h2 ? h2.score : 100);
      const tier: HealthTier =
        n1.trackBlocked || n2.trackBlocked || n1.pointsFailed || n2.pointsFailed || worstScore < 45
          ? 'CRITICAL'
          : worstScore < 70
          ? 'DELAYED'
          : worstScore < 88
          ? 'ELEVATED'
          : 'OPTIMAL';

      const pts = b.schematic.getEdgePolyline(n1, n2, edge);
      healthCtx.beginPath();
      pts.forEach((p, idx) => {
        const sp = toScreen(p.x, p.y);
        if (idx === 0) healthCtx.moveTo(sp.x, sp.y);
        else healthCtx.lineTo(sp.x, sp.y);
      });

      if (tier === 'CRITICAL') {
        const pulseAlpha = 0.45 + 0.45 * Math.sin(pulseSec * 7);
        healthCtx.strokeStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
        healthCtx.lineWidth = edge.isCrossover ? 2.5 : 5.5;
        healthCtx.stroke();
      }

      healthCtx.strokeStyle = HEALTH_PALETTE[tier].color;
      healthCtx.globalAlpha = edge.isCrossover ? 0.55 : 0.88;
      healthCtx.lineWidth = edge.isCrossover ? 1.1 : tier === 'OPTIMAL' ? 2.0 : 2.8;
      healthCtx.stroke();
      healthCtx.globalAlpha = 1.0;
    }

    // 4. Draw All 45 Stations + 2 Depots with Health Color & Non-Color Badges
    healthStationHitBoxes = [];
    const selectedStId = b.schematic.selectedStation?.id || 'CAW';

    for (const st of sim.stations) {
      const info = healthMap[st.id] || {
        tier: 'OPTIMAL',
        score: 100,
        color: '#10B981',
        symbol: '✓',
        reason: 'Optimal',
      };
      const sp = toScreen(st.x, st.y);
      const isMajor = st.isTerminus || st.hasTurnback || st.id === 'WIQ' || st.id === 'POP' || st.id === 'CNT';
      const r = isMajor ? 5.2 : 3.8;

      healthStationHitBoxes.push({ st, sx: sp.x, sy: sp.y, r: Math.max(10, r + 5), info });

      // Pulsing halo if degraded or selected
      if (info.tier === 'CRITICAL' || info.tier === 'DELAYED') {
        const haloR = r + 4 + 2.5 * Math.sin(pulseSec * 6);
        healthCtx.fillStyle = info.tier === 'CRITICAL' ? 'rgba(239, 68, 68, 0.34)' : 'rgba(249, 115, 22, 0.28)';
        healthCtx.beginPath();
        healthCtx.arc(sp.x, sp.y, haloR, 0, Math.PI * 2);
        healthCtx.fill();
      }

      if (st.id === selectedStId) {
        healthCtx.strokeStyle = '#22D3EE';
        healthCtx.lineWidth = 2;
        healthCtx.beginPath();
        healthCtx.arc(sp.x, sp.y, r + 5, 0, Math.PI * 2);
        healthCtx.stroke();
      }

      // Station node circle
      healthCtx.fillStyle = '#08101a';
      healthCtx.strokeStyle = info.color;
      healthCtx.lineWidth = isMajor ? 2.2 : 1.7;
      healthCtx.beginPath();
      healthCtx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
      healthCtx.fill();
      healthCtx.stroke();

      // Station 3-letter code pill for key stations or degraded stations
      if (isMajor || info.tier !== 'OPTIMAL' || scale > 0.23) {
        const lbl = info.tier !== 'OPTIMAL' ? `${info.symbol}${st.code}` : st.code;
        healthCtx.font = isMajor || info.tier !== 'OPTIMAL' ? '700 8.5px monospace' : '600 7.5px monospace';
        const tw = healthCtx.measureText(lbl).width + 5;
        const lx = sp.x;
        const ly = sp.y - r - 6;

        healthCtx.fillStyle = 'rgba(7, 12, 20, 0.88)';
        healthCtx.fillRect(lx - tw * 0.5, ly - 5.5, tw, 10);
        healthCtx.fillStyle = info.tier === 'OPTIMAL' ? '#E2E8F0' : info.color;
        healthCtx.textAlign = 'center';
        healthCtx.textBaseline = 'middle';
        healthCtx.fillText(lbl, lx, ly);
      }
    }

    // 5. Draw Live Active Train Units with Health Color
    healthTrainHitBoxes = [];
    for (const tr of sim.trains) {
      const wPos = b.schematic.getTrainWorldCoords(tr);
      const sp = toScreen(wPos.x, wPos.y);
      healthTrainHitBoxes.push({ tr, sx: sp.x, sy: sp.y });

      const trColor =
        tr.state === 'BROKEN_DOWN'
          ? '#EF4444'
          : tr.delaySeconds > 60
          ? '#F97316'
          : tr.psaMode || tr.delaySeconds > 25
          ? '#F59E0B'
          : '#22D3EE';

      healthCtx.fillStyle = trColor;
      healthCtx.strokeStyle = '#04080e';
      healthCtx.lineWidth = 1.2;
      healthCtx.beginPath();
      healthCtx.roundRect(sp.x - 10, sp.y - 4.5, 20, 9, 3);
      healthCtx.fill();
      healthCtx.stroke();

      healthCtx.fillStyle = '#04080e';
      healthCtx.font = '800 7px monospace';
      healthCtx.textAlign = 'center';
      healthCtx.textBaseline = 'middle';
      healthCtx.fillText(tr.serviceNumber, sp.x, sp.y + 0.5);
    }
  }

  // Render the 7-Branch Corridor Health Ribbon above the Health Map Canvas
  function renderBranchHealthRibbon() {
    const b = getBridge();
    const healthMap = computeStationHealthMap(b.sim);
    const branches: { key: string; label: string; filter: (s: Station) => boolean }[] = [
      { key: 'WEST', label: '1:WEST/BNK/TWG', filter: (s) => s.branch === 'West' },
      { key: 'CENTRAL', label: '2:CENTRAL/DELTA', filter: (s) => s.branch === 'Central' && s.id !== 'PDP' },
      { key: 'SOUTH', label: '3:SOUTH/LEW', filter: (s) => s.branch === 'South' },
      { key: 'NORTH', label: '4:NORTH/STR', filter: (s) => s.branch === 'North' },
      { key: 'STI', label: '5:STI/OLYMPIC', filter: (s) => s.branch === 'StratfordIntl' },
      { key: 'BCK', label: '6:BECKTON', filter: (s) => s.branch === 'Beckton' && s.id !== 'BDP' },
      { key: 'WOO', label: '7:WOOLWICH', filter: (s) => s.branch === 'Woolwich' },
    ];

    branchHealthStrip.innerHTML = branches
      .map((br) => {
        const sts = b.sim.stations.filter(br.filter);
        const avgScore =
          sts.length > 0
            ? Math.round(sts.reduce((acc, s) => acc + (healthMap[s.id]?.score ?? 100), 0) / sts.length)
            : 100;
        const minScore = sts.length > 0 ? Math.min(...sts.map((s) => healthMap[s.id]?.score ?? 100)) : 100;
        const effectiveScore = Math.round(minScore * 0.65 + avgScore * 0.35);
        const tier: HealthTier =
          effectiveScore < 45
            ? 'CRITICAL'
            : effectiveScore < 70
            ? 'DELAYED'
            : effectiveScore < 88
            ? 'ELEVATED'
            : 'OPTIMAL';
        const pal = HEALTH_PALETTE[tier];
        return `
          <div class="branch-health-chip" style="border-left-color:${pal.color}; background:${pal.bg};">
            <span class="bh-name">${br.label}</span>
            <strong class="bh-score" style="color:${pal.color};">${pal.symbol} ${effectiveScore}%</strong>
          </div>
        `;
      })
      .join('');
  }

  // Click & Hover interactions on the Whole-Network Health Map Canvas
  healthMapCanvas.addEventListener('mousemove', (e) => {
    const rect = healthMapCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const hitTrain = healthTrainHitBoxes.find((h) => Math.hypot(mx - h.sx, my - h.sy) < 11);
    if (hitTrain) {
      healthMapCanvas.style.cursor = 'pointer';
      const tr = hitTrain.tr;
      const destName = STATION_MAP[tr.destCode]?.name || tr.destCode;
      healthHoverHud.innerHTML = `<strong>🚆 UNIT ${tr.headcode} → ${destName}</strong> · ${tr.cars}-Car · ${Math.round(
        tr.speedMph
      )} mph · ${tr.delaySeconds > 15 ? `+${Math.round(tr.delaySeconds)}s late` : 'On Time'} · <em>Click to focus on Monitor 1</em>`;
      return;
    }

    const hitSt = healthStationHitBoxes.find((h) => Math.hypot(mx - h.sx, my - h.sy) < h.r);
    if (hitSt) {
      healthMapCanvas.style.cursor = 'pointer';
      healthHoverHud.innerHTML = `<strong style="color:${hitSt.info.color}">${hitSt.info.symbol} ${hitSt.st.code} · ${hitSt.st.name}</strong> · Health: <strong>${hitSt.info.score}% (${hitSt.info.tier})</strong> — ${hitSt.info.reason} · <em>Click to inspect &amp; pan Monitor 1</em>`;
      return;
    }

    healthMapCanvas.style.cursor = 'default';
  });

  healthMapCanvas.addEventListener('click', (e) => {
    const rect = healthMapCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const b = getBridge();

    const hitTrain = healthTrainHitBoxes.find((h) => Math.hypot(mx - h.sx, my - h.sy) < 12);
    if (hitTrain) {
      b.focusTrain(hitTrain.tr.id);
      soundEngine.playRelayClick(true);
      renderDeskAll(true);
      return;
    }

    const hitSt = healthStationHitBoxes.find((h) => Math.hypot(mx - h.sx, my - h.sy) < h.r + 2);
    if (hitSt) {
      b.schematic.selectedStation = hitSt.st;
      b.focusStation(hitSt.st.id);
      lastStationId = '';
      soundEngine.playRelayClick(true);
      renderDeskAll(true);
    }
  });

  // ============================================================================
  // PIANO-ROLL SEQUENCER ENGINE (Upcoming Stock Movements, Bore Dives & Events)
  // ============================================================================
  function buildTrainPianoNotes(sim: DLRSimulation, tr: Train, nowSec: number, horizonSec: number): PianoNote[] {
    const notes: PianoNote[] = [];
    const currNode = sim.nodeMap[tr.currentNodeId];
    const currStId = currNode?.stationId;

    // 1. Current / immediate state note around NOW playhead
    if (tr.state === 'BROKEN_DOWN') {
      notes.push({
        startSec: nowSec - 45,
        endSec: nowSec + Math.min(horizonSec, 300),
        label: `⛔ VOBC STALL @ ${currStId || tr.currentNodeId}`,
        kind: 'FAULT',
        stationId: currStId,
      });
      return notes;
    }

    let cursorSec = nowSec;

    if (tr.state === 'DWELLING' || tr.state === 'TURNBACK') {
      const remDwell = Math.max(8, tr.dwellRemaining || 14);
      const isTurn = tr.state === 'TURNBACK' || tr.currentNodeId.includes('HSH') || tr.currentNodeId.includes('REV') || tr.currentNodeId === 'CAW_MID';
      const sdo = tr.cars === 3 && (currStId === 'CUT' || currStId === 'ELV');
      notes.push({
        startSec: nowSec - 12,
        endSec: nowSec + remDwell,
        label: isTurn ? `⇄ TURN ${currStId || tr.currentNodeId}` : sdo ? `▲ ${currStId} SDO` : `▬ ${currStId || tr.currentNodeId}`,
        kind: isTurn ? 'TURNBACK' : sdo ? 'SDO' : 'STATION',
        stationId: currStId,
      });
      cursorSec = nowSec + remDwell;
    } else {
      // Currently moving on an edge
      const activeEdge = tr.currentEdgeId ? sim.edgeMap[tr.currentEdgeId] : undefined;
      const remTransit = Math.max(10, Math.round((1 - (tr.edgeProgress || 0)) * 28));
      const isSpecialTransit =
        activeEdge?.isTunnel || tr.currentNodeId === 'DLT_BYP_UP' || tr.nextNodeId === 'DLT_BYP_UP';
      notes.push({
        startSec: nowSec - 16,
        endSec: nowSec + remTransit,
        label: tr.psaMode
          ? `👨‍✈️ PSA 18mph`
          : isSpecialTransit
          ? `≈ ${tr.nextNodeId === 'DLT_BYP_UP' ? 'WIQ BYP' : 'BORE'}`
          : `→ ${currStId || tr.destCode}`,
        kind: tr.psaMode ? 'PSA_DELAY' : isSpecialTransit ? 'TUNNEL_BYPASS' : 'STATION',
        stationId: currStId,
      });
      cursorSec = nowSec + remTransit;
    }

    // 2. Project upcoming station stops, tunnel bores, WIQ bypass, SDO & turnback along routeQueue + return leg!
    const tpl = sim.templates.find((t) => t.id === tr.templateId);
    const fullStopPattern = tpl ? [...tpl.routeStations] : [tr.originCode, tr.destCode];
    const upcomingStops: string[] = [...tr.routeQueue];

    // Append return leg after turnback so the piano roll is always richly populated across the whole horizon!
    if (upcomingStops.length > 0) {
      const lastStop = upcomingStops[upcomingStops.length - 1];
      const reversed = [...fullStopPattern].reverse();
      if (reversed[0] === lastStop) {
        upcomingStops.push(...reversed.slice(1));
      } else {
        upcomingStops.push(...fullStopPattern.filter((s) => s !== lastStop));
      }
    }

    let prevStId = currStId || tr.originCode;
    for (let i = 0; i < upcomingStops.length; i++) {
      if (cursorSec > nowSec + horizonSec) break;
      const stId = upcomingStops[i];
      const st = STATION_MAP[stId];

      // Check if transit between prevStId and stId crosses a deep tunnel bore or WIQ Westbound Bypass
      const isThamesBore =
        (prevStId === 'KGV' && stId === 'WOO') ||
        (prevStId === 'WOO' && stId === 'KGV') ||
        (prevStId === 'ISG' && stId === 'CUT') ||
        (prevStId === 'CUT' && stId === 'ISG') ||
        (prevStId === 'SHA' && stId === 'BNK') ||
        (prevStId === 'BNK' && stId === 'SHA');
      const isWiqBypass = prevStId === 'CAW' && stId === 'WFE';

      const transitDuration = tr.psaMode ? 48 : isThamesBore ? 36 : 26;
      if (isThamesBore || isWiqBypass) {
        notes.push({
          startSec: cursorSec + 2,
          endSec: cursorSec + transitDuration - 2,
          label: isWiqBypass ? '≈ WIQ BYP' : `≈ ${stId} BORE`,
          kind: 'TUNNEL_BYPASS',
          stationId: stId,
        });
      }
      cursorSec += transitDuration;
      if (cursorSec > nowSec + horizonSec) break;

      const isTurnbackStop =
        i === tr.routeQueue.length - 1 ||
        st?.isTerminus ||
        stId === 'BNK' ||
        stId === 'TWG' ||
        stId === 'LEW' ||
        stId === 'BCK' ||
        stId === 'WOO' ||
        stId === 'STI';
      const isSdoStop = tr.cars === 3 && (stId === 'CUT' || stId === 'ELV');
      const dwellDuration = isTurnbackStop ? 32 : isSdoStop ? 24 : tr.isECS ? 10 : 18;

      notes.push({
        startSec: cursorSec,
        endSec: cursorSec + dwellDuration,
        label: isTurnbackStop
          ? `⇄ ${st?.code || stId} TURN`
          : isSdoStop
          ? `▲ ${st?.code || stId} SDO`
          : `▬ ${st?.code || stId}`,
        kind: isTurnbackStop ? 'TURNBACK' : isSdoStop ? 'SDO' : tr.psaMode ? 'PSA_DELAY' : 'STATION',
        stationId: stId,
      });

      cursorSec += dwellDuration;
      prevStId = stId;
    }

    return notes;
  }

  let pianoRowHitBoxes: { trId?: string; stId?: string; y1: number; y2: number }[] = [];

  function drawPianoRollCanvas(pulseSec: number) {
    const b = getBridge();
    const sim = b.sim;
    const rect = pianoRollCanvas.parentElement?.getBoundingClientRect();
    if (!rect || rect.width < 20 || rect.height < 20) return;
    const w = rect.width;
    const h = rect.height;

    pianoCtx.clearRect(0, 0, w, h);
    pianoCtx.fillStyle = '#070b12';
    pianoCtx.fillRect(0, 0, w, h);

    const keyColW = 166;
    const rulerH = 26;
    const gridW = Math.max(100, w - keyColW);
    const nowSec = sim.simTimeSeconds;
    const pastWindowSec = 90; // Show 1.5 mins of immediate history to left of NOW playhead
    const totalWindowSec = pastWindowSec + pianoHorizonSec;
    const startWindowSec = nowSec - pastWindowSec;

    const timeToX = (tSec: number) => keyColW + ((tSec - startWindowSec) / totalWindowSec) * gridW;
    const playheadX = timeToX(nowSec);

    // Filter trains according to user dropdown
    const filteredTrains = sim.trains.filter((t) => {
      if (pianoFilterMode === 'CORE_WEST') {
        return t.serviceNumber.startsWith('1') || t.serviceNumber.startsWith('2') || t.serviceNumber.startsWith('3') || t.serviceNumber.startsWith('6');
      }
      if (pianoFilterMode === 'NORTH_EAST') {
        return t.serviceNumber.startsWith('4') || t.serviceNumber.startsWith('5') || t.serviceNumber.startsWith('7') || t.serviceNumber.startsWith('9');
      }
      if (pianoFilterMode === 'ATTENTION') {
        return t.state === 'BROKEN_DOWN' || t.psaMode || t.delaySeconds > 25 || t.diverted;
      }
      return true;
    });

    const rowH = 26;
    const eventsRowH = 28;
    const availRowsH = Math.max(60, h - rulerH - eventsRowH);
    const maxVisibleTrainRows = Math.max(3, Math.floor(availRowsH / rowH));
    if (pianoScrollOffsetRows > Math.max(0, filteredTrains.length - maxVisibleTrainRows)) {
      pianoScrollOffsetRows = Math.max(0, filteredTrains.length - maxVisibleTrainRows);
    }
    const visibleTrains = filteredTrains.slice(pianoScrollOffsetRows, pianoScrollOffsetRows + maxVisibleTrainRows);

    // 1. Draw Vertical Time Measure & Beat Lines
    const firstTickSec = Math.ceil(startWindowSec / 60) * 60;
    for (let t = firstTickSec; t <= nowSec + pianoHorizonSec; t += 60) {
      const tx = timeToX(t);
      if (tx < keyColW || tx > w) continue;
      const isMajor = Math.round(t / 60) % 2 === 0;
      pianoCtx.strokeStyle = isMajor ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 48, 72, 0.35)';
      pianoCtx.lineWidth = isMajor ? 1.2 : 1;
      pianoCtx.beginPath();
      pianoCtx.moveTo(tx, rulerH);
      pianoCtx.lineTo(tx, h);
      pianoCtx.stroke();
    }

    // 2. Top Time Ruler Bar
    pianoCtx.fillStyle = '#0d1624';
    pianoCtx.fillRect(0, 0, w, rulerH);
    pianoCtx.strokeStyle = '#253952';
    pianoCtx.lineWidth = 1;
    pianoCtx.beginPath();
    pianoCtx.moveTo(0, rulerH);
    pianoCtx.lineTo(w, rulerH);
    pianoCtx.stroke();

    pianoCtx.fillStyle = '#94a3b8';
    pianoCtx.font = '800 9.5px monospace';
    pianoCtx.textAlign = 'left';
    pianoCtx.textBaseline = 'middle';
    pianoCtx.fillText('🎹 STOCK / DIAGRAM KEY', 8, rulerH * 0.5);

    const labelStepSec = pianoHorizonSec >= 600 ? 120 : 60;
    for (let t = firstTickSec; t <= nowSec + pianoHorizonSec; t += 60) {
      const tx = timeToX(t);
      if (tx < keyColW + 24 || tx > w - 24) continue;
      const relMin = Math.round((t - nowSec) / 60);
      if (relMin !== 0 && Math.abs(t - firstTickSec) % labelStepSec !== 0) continue;
      const clockPart = sim.formatSimTime(t).split(' ')[1]?.slice(0, 5) || '';
      const lbl = relMin === 0 ? '▼ NOW' : relMin > 0 ? `+${relMin}m (${clockPart})` : `${relMin}m`;
      pianoCtx.fillStyle = relMin === 0 ? '#22d3ee' : '#94a3b8';
      pianoCtx.font = '700 8.5px monospace';
      pianoCtx.textAlign = 'center';
      pianoCtx.fillText(lbl, tx, rulerH * 0.5);
    }

    // 3. Row 0: ⚡ NETWORK EVENTS, CONTINGENCIES & SCHEDULED WAVE SPAWNS LANE
    const evtY = rulerH;
    pianoCtx.fillStyle = '#111a2b';
    pianoCtx.fillRect(0, evtY, w, eventsRowH);
    pianoCtx.fillStyle = '#0b121e';
    pianoCtx.fillRect(0, evtY, keyColW, eventsRowH);
    pianoCtx.strokeStyle = '#263a54';
    pianoCtx.beginPath();
    pianoCtx.moveTo(0, evtY + eventsRowH);
    pianoCtx.lineTo(w, evtY + eventsRowH);
    pianoCtx.stroke();

    pianoCtx.fillStyle = '#fbbf24';
    pianoCtx.font = '800 9px monospace';
    pianoCtx.textAlign = 'left';
    pianoCtx.fillText('⚡ EVENTS & WAVE SPAWNS', 8, evtY + eventsRowH * 0.5);

    // Plot active incidents on Events lane
    const unresolved = sim.incidents.filter((i) => !i.resolved);
    unresolved.forEach((inc, idx) => {
      const ix1 = Math.max(keyColW + 4, playheadX - 25 + idx * 95);
      const ix2 = Math.min(w - 6, ix1 + 88);
      if (ix2 > ix1) {
        pianoCtx.fillStyle = 'rgba(239, 68, 68, 0.88)';
        pianoCtx.beginPath();
        pianoCtx.roundRect(ix1, evtY + 4, ix2 - ix1, eventsRowH - 8, 3);
        pianoCtx.fill();
        pianoCtx.fillStyle = '#ffffff';
        pianoCtx.font = '800 8px monospace';
        pianoCtx.textAlign = 'center';
        pianoCtx.fillText(`⛔ ${inc.stationId || 'FAULT'}`, (ix1 + ix2) * 0.5, evtY + eventsRowH * 0.5);
      }
    });

    // Plot upcoming template wave spawns across the horizon
    sim.templates
      .filter((t) => t.active)
      .forEach((tpl, tIdx) => {
        const intervalSec = Math.max(120, tpl.intervalMins * 60);
        const phaseOffset = (tIdx * 47) % intervalSec;
        const firstWave = Math.ceil((nowSec - phaseOffset) / intervalSec) * intervalSec + phaseOffset;
        for (let waveSec = firstWave; waveSec <= nowSec + pianoHorizonSec; waveSec += intervalSec) {
          const wx = timeToX(waveSec);
          if (wx < playheadX + 8 || wx > w - 32) continue;
          pianoCtx.fillStyle = '#1e293b';
          pianoCtx.strokeStyle = tpl.color;
          pianoCtx.lineWidth = 1.4;
          pianoCtx.beginPath();
          pianoCtx.roundRect(wx - 26, evtY + 5, 52, eventsRowH - 10, 3);
          pianoCtx.fill();
          pianoCtx.stroke();

          pianoCtx.fillStyle = '#f8fafc';
          pianoCtx.font = '700 7.5px monospace';
          pianoCtx.textAlign = 'center';
          pianoCtx.fillText(`◆ +${tpl.codePrefix}xx`, wx, evtY + eventsRowH * 0.5);
        }
      });

    // 4. Draw Stock Unit Lanes (Piano Keys + Scrolling Note Bars)
    pianoRowHitBoxes = [];
    const noteStyleMap: Record<PianoNote['kind'], { fill: string; border: string; text: string }> = {
      STATION: { fill: 'rgba(14, 165, 233, 0.30)', border: '#38bdf8', text: '#f0f9ff' },
      TUNNEL_BYPASS: { fill: 'rgba(99, 102, 241, 0.34)', border: '#818cf8', text: '#e0e7ff' },
      SDO: { fill: 'rgba(245, 158, 11, 0.36)', border: '#fbbf24', text: '#fef3c7' },
      TURNBACK: { fill: 'rgba(168, 85, 247, 0.38)', border: '#c084fc', text: '#faf5ff' },
      PSA_DELAY: { fill: 'rgba(249, 115, 22, 0.40)', border: '#fb923c', text: '#ffedd5' },
      FAULT: { fill: 'rgba(239, 68, 68, 0.55)', border: '#f87171', text: '#ffffff' },
    };

    visibleTrains.forEach((tr, rowIdx) => {
      const ry = rulerH + eventsRowH + rowIdx * rowH;
      const isSelected = b.schematic.selectedTrain?.id === tr.id;
      pianoRowHitBoxes.push({ trId: tr.id, y1: ry, y2: ry + rowH });

      // Lane background stripe
      pianoCtx.fillStyle = isSelected
        ? 'rgba(34, 211, 238, 0.12)'
        : rowIdx % 2 === 0
        ? 'rgba(11, 18, 29, 0.75)'
        : 'rgba(15, 24, 38, 0.75)';
      pianoCtx.fillRect(keyColW, ry, gridW, rowH);

      // Connective baseline across the train's timeline lane
      pianoCtx.strokeStyle = 'rgba(51, 78, 111, 0.45)';
      pianoCtx.lineWidth = 1;
      pianoCtx.beginPath();
      pianoCtx.moveTo(keyColW, ry + rowH * 0.5);
      pianoCtx.lineTo(w, ry + rowH * 0.5);
      pianoCtx.stroke();

      // Render Piano Roll Note Bars for this train
      const notes = buildTrainPianoNotes(sim, tr, nowSec, pianoHorizonSec);
      for (const note of notes) {
        const nx1 = Math.max(keyColW + 2, timeToX(note.startSec));
        const nx2 = Math.min(w - 2, timeToX(note.endSec));
        const nw = nx2 - nx1;
        if (nw < 3) continue;

        const st = noteStyleMap[note.kind];
        pianoCtx.fillStyle = st.fill;
        pianoCtx.strokeStyle = st.border;
        pianoCtx.lineWidth = 1.2;
        pianoCtx.beginPath();
        pianoCtx.roundRect(nx1, ry + 3.5, nw, rowH - 7, 3);
        pianoCtx.fill();
        pianoCtx.stroke();

        if (nw > 26) {
          pianoCtx.save();
          pianoCtx.beginPath();
          pianoCtx.rect(nx1 + 2, ry + 3.5, nw - 4, rowH - 7);
          pianoCtx.clip();
          pianoCtx.fillStyle = st.text;
          pianoCtx.font = '700 8px monospace';
          pianoCtx.textAlign = 'left';
          pianoCtx.textBaseline = 'middle';
          pianoCtx.fillText(note.label, nx1 + 4, ry + rowH * 0.5 + 0.5);
          pianoCtx.restore();
        }
      }

      // Draw Left Tactile Piano Key Header for this train unit
      pianoCtx.fillStyle = isSelected ? '#162c3d' : rowIdx % 2 === 0 ? '#0c1420' : '#101a29';
      pianoCtx.fillRect(0, ry, keyColW, rowH);

      // Branch colour tab on left edge of piano key
      pianoCtx.fillStyle = tr.color;
      pianoCtx.fillRect(0, ry + 1, 5, rowH - 2);

      // Key separator line
      pianoCtx.strokeStyle = '#1e2f46';
      pianoCtx.lineWidth = 1;
      pianoCtx.beginPath();
      pianoCtx.moveTo(0, ry + rowH);
      pianoCtx.lineTo(w, ry + rowH);
      pianoCtx.stroke();

      // Piano Key text: Headcode + Car count + Speed/Status
      pianoCtx.fillStyle = '#f8fafc';
      pianoCtx.font = '800 9.5px monospace';
      pianoCtx.textAlign = 'left';
      pianoCtx.textBaseline = 'middle';
      pianoCtx.fillText(`${tr.headcode}`, 10, ry + rowH * 0.5);

      const statusBadge =
        tr.state === 'BROKEN_DOWN'
          ? '⛔FLT'
          : tr.psaMode
          ? '👨‍✈️PSA'
          : tr.delaySeconds > 35
          ? `+${Math.round(tr.delaySeconds)}s`
          : `${Math.round(tr.speedMph)}mph`;
      const statusCol =
        tr.state === 'BROKEN_DOWN'
          ? '#ef4444'
          : tr.psaMode || tr.delaySeconds > 35
          ? '#fbbf24'
          : '#34d399';

      pianoCtx.fillStyle = '#94a3b8';
      pianoCtx.font = '700 8px monospace';
      pianoCtx.fillText(`${tr.cars}C`, 68, ry + rowH * 0.5);

      pianoCtx.fillStyle = statusCol;
      pianoCtx.textAlign = 'right';
      pianoCtx.fillText(statusBadge, keyColW - 7, ry + rowH * 0.5);
    });

    // Piano Key column right border
    pianoCtx.strokeStyle = '#334e6f';
    pianoCtx.lineWidth = 1.5;
    pianoCtx.beginPath();
    pianoCtx.moveTo(keyColW, 0);
    pianoCtx.lineTo(keyColW, h);
    pianoCtx.stroke();

    // 5. Glowing NOW Playhead Laser Line
    const playheadPulse = 0.75 + 0.25 * Math.sin(pulseSec * 5);
    pianoCtx.strokeStyle = `rgba(34, 211, 238, ${playheadPulse})`;
    pianoCtx.lineWidth = 2;
    pianoCtx.beginPath();
    pianoCtx.moveTo(playheadX, rulerH);
    pianoCtx.lineTo(playheadX, h);
    pianoCtx.stroke();

    // Playhead cap triangle
    pianoCtx.fillStyle = '#22d3ee';
    pianoCtx.beginPath();
    pianoCtx.moveTo(playheadX - 5, rulerH);
    pianoCtx.lineTo(playheadX + 5, rulerH);
    pianoCtx.lineTo(playheadX, rulerH + 7);
    pianoCtx.closePath();
    pianoCtx.fill();
  }

  // Wheel scroll & click on Piano Roll Canvas
  pianoRollCanvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      pianoScrollOffsetRows = Math.max(0, pianoScrollOffsetRows + delta);
    },
    { passive: false }
  );

  pianoRollCanvas.addEventListener('mousemove', (e) => {
    const rect = pianoRollCanvas.getBoundingClientRect();
    const my = e.clientY - rect.top;
    const hit = pianoRowHitBoxes.find((r) => my >= r.y1 && my <= r.y2);
    if (hit && hit.trId) {
      pianoRollCanvas.style.cursor = 'pointer';
      const b = getBridge();
      const tr = b.sim.trains.find((t) => t.id === hit.trId);
      if (tr) {
        const destName = STATION_MAP[tr.destCode]?.name || tr.destCode;
        const nextStops = tr.routeQueue.slice(0, 5).join(' → ') || 'Terminus Turnback';
        pianoHoverHud.innerHTML = `<strong>🎹 LANE ${tr.headcode} (${tr.cars}-Car → ${destName})</strong> · Upcoming Sequence: <strong>${nextStops}</strong> · <em>Click lane to focus on Monitor 1</em>`;
      }
    } else {
      pianoRollCanvas.style.cursor = 'default';
    }
  });

  pianoRollCanvas.addEventListener('click', (e) => {
    const rect = pianoRollCanvas.getBoundingClientRect();
    const my = e.clientY - rect.top;
    const hit = pianoRowHitBoxes.find((r) => my >= r.y1 && my <= r.y2);
    if (hit && hit.trId) {
      const b = getBridge();
      b.focusTrain(hit.trId);
      soundEngine.playRelayClick(true);
      renderDeskAll(true);
    }
  });

  // ============================================================================
  // LOWER 4-DECK TELEMETRY RENDERERS
  // ============================================================================
  function renderDeskStationInspector(force = false) {
    const b = getBridge();
    const st: Station = b.schematic.selectedStation || STATION_MAP['CAW'];
    stationTitle.textContent = `${st.code} · ${st.name} (${st.branch} Branch)`;
    if (stationSelect.value !== st.id) {
      stationSelect.value = st.id;
    }

    // 1. Diff-cached Split-Flap rows
    const deps = b.sim.getStationDepartures(st.id);
    const newSigs = deps.map((d) => `${d.platform}:${d.headcode}:${d.destName}:${d.cars}:${d.etaMins}:${d.status}`);
    if (force || lastStationId !== st.id || newSigs.join('|') !== lastFlapSigs.join('|')) {
      lastFlapSigs = newSigs;
      if (deps.length === 0) {
        stationFlapRows.innerHTML = `
          <div class="flap-row">
            <span class="flap-plat">--</span>
            <span class="flap-dest">NO SCHEDULED SERVICES</span>
            <span class="flap-cars">--</span>
            <span class="flap-eta">--</span>
          </div>
        `;
      } else {
        stationFlapRows.innerHTML = deps
          .map(
            (d) => `
          <div class="flap-row ${lastStationId !== st.id ? 'animate-flap' : ''}">
            <span class="flap-plat">P${d.platform}</span>
            <span class="flap-dest">${d.headcode} ${d.destName.toUpperCase()}</span>
            <span class="flap-cars">${d.cars}CAR</span>
            <span class="flap-eta ${d.status.includes('DELAY') || d.status.includes('LATE') ? 'delayed' : ''}">
              ${d.etaMins === 0 ? 'DUE' : `${d.etaMins} MIN`}
            </span>
          </div>
        `
          )
          .join('');
      }
    }

    // 2. Station Engineering Fact Sheet & Live SVG Micro-Schematic
    const sheet = getStationFactSheet(st);
    const svgDiagram = renderStationMicroSchematicSVG(st, sheet, b.sim);
    const upNode = b.sim.nodeMap[`${st.id}_UP`];
    const dnNode = b.sim.nodeMap[`${st.id}_DN`];
    const footfall = (b.sim.stationFootfall[st.id] || 0).toLocaleString();

    stationFactsheetBox.innerHTML = `
      <div class="micro-schematic-box" style="margin-bottom:0.5rem;">
        ${svgDiagram}
      </div>
      <div class="desk-fs-meta-row">
        <span><strong>Layout:</strong> ${sheet.platformLayout}</span>
        <span><strong>Footfall:</strong> ${footfall} pax</span>
        <div style="display:flex; gap:0.35rem; margin-inline-start:auto;">
          <button type="button" id="desk-hold-up-btn" class="nav-chip-btn ${upNode?.signalHeld ? 'active' : ''}">
            ${upNode?.signalHeld ? '🔓 Release UP' : '🛑 Hold UP Red'}
          </button>
          <button type="button" id="desk-hold-dn-btn" class="nav-chip-btn ${dnNode?.signalHeld ? 'active' : ''}">
            ${dnNode?.signalHeld ? '🔓 Release DN' : '🛑 Hold DN Red'}
          </button>
        </div>
      </div>
      <div class="factsheet-trio-grid" style="margin-top:0.45rem;">
        <div class="fs-col-card gotchas">
          <h4>⚠️ GOTCHAS</h4>
          <ul>${sheet.gotchas.map((g) => `<li>${g}</li>`).join('')}</ul>
        </div>
        <div class="fs-col-card advantages">
          <h4>✅ ADVANTAGES</h4>
          <ul>${sheet.advantages.map((a) => `<li>${a}</li>`).join('')}</ul>
        </div>
        <div class="fs-col-card disadvantages">
          <h4>🔻 BOTTLENECKS</h4>
          <ul>${sheet.disadvantages.map((d) => `<li>${d}</li>`).join('')}</ul>
        </div>
      </div>
    `;

    document.getElementById('desk-hold-up-btn')?.addEventListener('click', () => {
      b.sim.toggleSignalHold(`${st.id}_UP`);
      renderDeskStationInspector(true);
    });
    document.getElementById('desk-hold-dn-btn')?.addEventListener('click', () => {
      b.sim.toggleSignalHold(`${st.id}_DN`);
      renderDeskStationInspector(true);
    });

    lastStationId = st.id;
  }

  function renderDeskOps(force = false) {
    const b = getBridge();
    const unresolved = b.sim.incidents.filter((i) => !i.resolved);
    const incSig =
      unresolved.map((i) => i.id).join(',') +
      '|' +
      b.sim.contingencies.map((c) => `${c.id}:${c.active}`).join(',');

    if (force || incSig !== lastIncidentSig) {
      lastIncidentSig = incSig;
      if (unresolved.length === 0) {
        incidentsList.innerHTML = `
          <div class="incident-card" style="border-left-color:#10B981; padding:0.45rem 0.6rem;">
            <strong style="color:#10B981; font-family:var(--font-mono); font-size:0.76rem;">✓ ALL 7 DLR BRANCHES OPERATING NORMALLY</strong>
          </div>
        `;
      } else {
        incidentsList.innerHTML = unresolved
          .map(
            (inc) => `
          <div class="incident-card ${inc.severity === 'WARNING' ? 'warning' : ''}" style="padding:0.45rem 0.6rem;">
            <div class="incident-top">
              <span class="incident-title">${inc.title}</span>
              ${
                inc.stationId
                  ? `<button type="button" class="locate-btn" data-desk-loc="${inc.stationId}">MAP</button>`
                  : ''
              }
            </div>
            <p class="incident-desc" style="margin-bottom:0.35rem;">${inc.description}</p>
            <div class="incident-btn-list">
              ${inc.actions
                .map(
                  (act) => `
                <button type="button" class="resolve-action-btn" data-desk-inc="${inc.id}" data-desk-act="${act.id}">
                  ▸ ${act.label}
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        `
          )
          .join('');
      }

      incidentsList.querySelectorAll<HTMLButtonElement>('button[data-desk-loc]').forEach((btn) => {
        btn.addEventListener('click', () => b.focusStation(btn.dataset.deskLoc!));
      });
      incidentsList.querySelectorAll<HTMLButtonElement>('button[data-desk-inc]').forEach((btn) => {
        btn.addEventListener('click', () => {
          b.sim.executeIncidentAction(btn.dataset.deskInc!, btn.dataset.deskAct!);
          renderDeskAll(true);
        });
      });

      contingencyGrid.innerHTML = b.sim.contingencies
        .map(
          (cp) => `
        <button type="button" class="cp-btn ${cp.active ? 'active' : ''}" data-desk-cp="${cp.id}">
          <strong>${cp.active ? '● ' : '○ '}${cp.shortCode}</strong>
          <span>${cp.effectSummary}</span>
        </button>
      `
        )
        .join('');

      contingencyGrid.querySelectorAll<HTMLButtonElement>('button[data-desk-cp]').forEach((btn) => {
        btn.addEventListener('click', () => {
          b.sim.toggleContingencyPlan(btn.dataset.deskCp!);
          renderDeskAll(true);
        });
      });
    }

    if (force || b.sim.templates.length !== lastTemplateCount) {
      lastTemplateCount = b.sim.templates.length;
      templatesList.innerHTML = b.sim.templates
        .map(
          (tpl) => `
        <div class="tpl-row" style="border-left-color:${tpl.color}; padding:0.35rem 0.5rem;">
          <div class="tpl-info">
            <strong>${tpl.codePrefix}xx · ${tpl.name}</strong>
          </div>
          <div class="tpl-controls">
            <input type="number" min="2" max="20" value="${tpl.intervalMins}" data-desk-int="${tpl.id}" style="width:44px;" aria-label="Interval minutes" />
            <span style="font-size:0.65rem; color:#94A3B8;">m</span>
            <select data-desk-cars="${tpl.id}" aria-label="Cars">
              <option value="2" ${tpl.cars === 2 ? 'selected' : ''}>2C</option>
              <option value="3" ${tpl.cars === 3 ? 'selected' : ''}>3C</option>
            </select>
            <button type="button" class="speed-btn ${tpl.active ? 'active' : ''}" data-desk-tog="${tpl.id}">
              ${tpl.active ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      `
        )
        .join('');

      templatesList.querySelectorAll<HTMLInputElement>('input[data-desk-int]').forEach((inp) => {
        inp.addEventListener('change', () => {
          const tpl = b.sim.templates.find((t) => t.id === inp.dataset.deskInt);
          if (tpl) tpl.intervalMins = Math.max(2, Math.min(20, parseInt(inp.value, 10) || 5));
        });
      });
      templatesList.querySelectorAll<HTMLSelectElement>('select[data-desk-cars]').forEach((sel) => {
        sel.addEventListener('change', () => {
          const tpl = b.sim.templates.find((t) => t.id === sel.dataset.deskCars);
          if (tpl) tpl.cars = sel.value === '2' ? 2 : 3;
        });
      });
      templatesList.querySelectorAll<HTMLButtonElement>('button[data-desk-tog]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tpl = b.sim.templates.find((t) => t.id === btn.dataset.deskTog);
          if (tpl) {
            tpl.active = !tpl.active;
            renderDeskOps(true);
          }
        });
      });
    }
  }

  function renderDeskAll(force = false) {
    const b = getBridge();
    const metrics = b.sim.getPerformanceMetrics();

    clockFlap.textContent = b.sim.formatSimTime();
    ppmFlap.textContent = `${metrics.ppm.toFixed(1)}%`;
    unitsFlap.textContent = `${metrics.activeTrainCount}`;
    paxFlap.textContent = b.sim.totalPassengersCarried.toLocaleString();

    const meanSpeed =
      b.sim.trains.length > 0
        ? (b.sim.trains.reduce((acc, t) => acc + t.speedMph, 0) / b.sim.trains.length).toFixed(1)
        : '0.0';
    speedFlap.textContent = `${meanSpeed} MPH`;
    fleetBadge.textContent = `${b.sim.trains.length} UNITS · ${metrics.psaCount} PSA · ${metrics.brokenCount} FAULTS`;

    document.querySelectorAll<HTMLButtonElement>('.desk-spd-btn').forEach((btn) => {
      btn.classList.toggle('active', parseFloat(btn.dataset.speed || '1') === b.sim.timeScale);
    });

    deskAutopilotBtn.classList.toggle('active', b.observe.active);
    deskAutopilotBtn.textContent = b.observe.active
      ? `🛋️ AUTO-PILOT: ${b.observe.getAutopilotRegime()}`
      : '🛋️ AUTO-PILOT: OFF';
    syncSubtitle.textContent = b.observe.active && b.observe.currentCallout
      ? `AUTO-PILOT [${b.observe.getAutopilotRegime()}] · ${b.observe.currentCallout.title} (${b.observe.getRemainingSeconds().toFixed(0)}s)`
      : 'DUAL-SCREEN HERO OVERWATCH (NETWORK HEALTH + PIANO ROLL) + 4-DECK TELEMETRY';

    renderBranchHealthRibbon();

    // Render Full-Fleet CBTC Telemetry Table
    fleetTbody.innerHTML = b.sim.trains
      .map((t) => {
        const currNode = b.sim.nodeMap[t.currentNodeId];
        const nextNode = t.nextNodeId ? b.sim.nodeMap[t.nextNodeId] : null;
        const loadPct = Math.round((t.passengers / t.maxCapacity) * 100);
        const stateColor =
          t.state === 'BROKEN_DOWN'
            ? '#EF4444'
            : t.psaMode
            ? '#F59E0B'
            : t.state === 'MOVING'
            ? '#10B981'
            : '#38BDF8';
        return `
        <tr>
          <th scope="row" style="border-left: 3px solid ${t.color};">${t.headcode}</th>
          <td>${t.cars}-Car ${t.isECS ? 'ECS' : 'B23'}</td>
          <td>${currNode?.roadLabel || currNode?.name || t.currentNodeId}</td>
          <td>${nextNode?.roadLabel || nextNode?.name || 'Terminus'}</td>
          <td><span style="color:${stateColor}; font-weight:700;">${t.state}</span></td>
          <td>${Math.round(t.speedMph)} / ${t.targetSpeedMph} mph</td>
          <td>${t.isECS ? 'EMPTY' : `${t.passengers}/${t.maxCapacity} (${loadPct}%)`}</td>
          <td style="color:${t.delaySeconds > 60 ? '#EF4444' : '#10B981'}; font-weight:700;">
            ${t.delaySeconds > 10 ? `+${Math.round(t.delaySeconds)}s` : 'ON TIME'}
          </td>
          <td>
            <div class="fleet-act-cell">
              <button type="button" class="locate-btn" data-fleet-act="FOCUS" data-tr-id="${t.id}" title="Pan Monitor 1 Camera to this Train">🎯 MAP</button>
              <button type="button" class="locate-btn" data-fleet-act="PSA" data-tr-id="${t.id}" title="Dispatch PSA for 18 mph Manual Recovery">👨‍✈️ PSA</button>
              <button type="button" class="locate-btn" data-fleet-act="TURN" data-tr-id="${t.id}" title="Short-Turn at Nearest Crossover">↪ TURN</button>
            </div>
          </td>
        </tr>
      `;
      })
      .join('');

    renderDeskStationInspector(force);
    renderDeskOps(force);

    // Render Busiest/Quietest Footfall & Rare Routes
    footfallBoards.innerHTML = `
      <div class="split-flap-board">
        ${metrics.busiestStations
          .slice(0, 4)
          .map(
            (item, idx) => `
          <div class="flap-row" style="grid-template-columns: 28px 1fr 64px 72px; padding:0.28rem 0.45rem;">
            <span class="flap-plat">#${idx + 1}</span>
            <span class="flap-dest">${item.station.code} · ${item.station.name.toUpperCase()}</span>
            <span class="flap-cars">${item.crowdMult > 1.3 ? '▲ SURGE' : 'PEAK'}</span>
            <span class="flap-eta">${item.footfall.toLocaleString()}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    logList.innerHTML = b.sim.logs
      .slice(0, 18)
      .map(
        (l) => `
      <div class="log-item ${l.category}">
        <span class="log-time">[${l.simTimeStr}]</span>
        <strong>${l.category}:</strong> ${l.message}
      </div>
    `
      )
      .join('');
  }

  renderDeskAll(true);

  let lastTime = performance.now();
  let accum = 0;
  function deskLoop(now: number) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    // Only tick fallbackSim if not tethered to opener window
    if (!(window.opener as Window | null)?.__dlrSimBridge) {
      fallbackSim.tick(dt);
    }

    // Draw both 60fps Dual-Screen Hero Canvases (Whole-Network Health Map + Scrolling Piano Roll)
    const pulseSec = now / 1000;
    drawWholeNetworkHealthCanvas(pulseSec);
    drawPianoRollCanvas(pulseSec);

    accum += dt;
    if (accum >= 0.4) {
      accum = 0;
      renderDeskAll(false);
    }
    requestAnimationFrame(deskLoop);
  }
  requestAnimationFrame(deskLoop);
}
