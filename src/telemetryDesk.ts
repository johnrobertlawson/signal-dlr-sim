import { DLRSimulation } from './simulation';
import { SchematicCanvas } from './schematicCanvas';
import { ObserveController } from './observeController';
import { STATION_MAP } from './dlrData';
import { Station } from './types';
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

export function mountSecondMonitorDesk(fallbackSim: DLRSimulation, fallbackSchematic: SchematicCanvas, fallbackObserve: ObserveController) {
  const openerBridge = (window.opener as Window | null)?.__dlrSimBridge;
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

  document.title = 'DLR SMC — 2nd Monitor Deep Telemetry, Split-Flap & Engineering Desk';

  const appEl = document.getElementById('app')!;
  appEl.innerHTML = `
    <div class="desk-shell">
      <!-- TOP TELEMETRY & COMMAND RIBBON -->
      <header class="top-bar desk-top-bar">
        <div class="brand-cluster">
          <div class="dlr-roundel" aria-hidden="true">
            <span class="roundel-circle"></span>
            <span class="roundel-bar">DLR</span>
          </div>
          <div class="brand-titles">
            <h1>2ND MONITOR DEEP TELEMETRY &amp; ENGINEERING DESK</h1>
            <p class="subtitle" id="desk-sync-subtitle">LIVE 60FPS LINK TO MONITOR 1 SCHEMATIC WALL · SELTRAC CBTC ANALYTICS</p>
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
          <button type="button" id="desk-fix-all-btn" class="mini-action-btn rescue-btn">🆘 HELP! FIX IT</button>
          <button type="button" id="desk-disrupt-btn" class="mini-action-btn">⚡ +DISRUPT</button>
          <button type="button" id="desk-dock-back-btn" class="util-btn accent-btn" title="Close this 2nd monitor window and restore the sidebar on Monitor 1">
            📥 DOCK BACK TO MAIN WINDOW
          </button>
        </div>
      </header>

      <!-- 4-QUADRANT NERD DATA & ENGINEERING DASHBOARD GRID -->
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

  const clockFlap = document.getElementById('desk-clock-flap')!;
  const ppmFlap = document.getElementById('desk-ppm-flap')!;
  const unitsFlap = document.getElementById('desk-units-flap')!;
  const speedFlap = document.getElementById('desk-speed-flap')!;
  const paxFlap = document.getElementById('desk-pax-flap')!;
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

  // Populate station selector
  const initBridge = getBridge();
  stationSelect.innerHTML = initBridge.sim.stations
    .map((s) => `<option value="${s.id}">${s.code} — ${s.name} (${s.branch})</option>`)
    .join('');

  let lastStationId = '';
  let lastFlapSigs: string[] = [];
  let lastTemplateCount = -1;
  let lastIncidentSig = '';

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

  window.addEventListener('beforeunload', () => {
    (window.opener as Window | null)?.__dlrSimBridge?.onDeskClosed();
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

    accum += dt;
    if (accum >= 0.4) {
      accum = 0;
      renderDeskAll(false);
    }
    requestAnimationFrame(deskLoop);
  }
  requestAnimationFrame(deskLoop);
}
