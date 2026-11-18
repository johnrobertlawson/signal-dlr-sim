import { DLRSimulation } from './simulation';
import { SchematicCanvas, SectorId } from './schematicCanvas';
import { STATION_MAP } from './dlrData';
import { Station, Train } from './types';
import { soundEngine } from './audio';
import { ObserveController, ObserveFocus, ObservePace } from './observeController';
import { getStationFactSheet, renderStationMicroSchematicSVG } from './stationFactSheets';
import { mountSecondMonitorDesk } from './telemetryDesk';

const sim = new DLRSimulation();
const canvasEl = document.getElementById('schematic-canvas') as HTMLCanvasElement;
const schematic = new SchematicCanvas(canvasEl, sim);
const observe = new ObserveController(sim, schematic);

// Default selected station: Canary Wharf (CAW)
schematic.selectedStation = STATION_MAP['CAW'];

// DOM Elements
const simClockFlap = document.getElementById('sim-clock-flap')!;
const ppmFlap = document.getElementById('ppm-flap')!;
const unitsFlap = document.getElementById('units-flap')!;
const nxStatusText = document.getElementById('nx-status-text')!;

const activeIncidentsContainer = document.getElementById('active-incidents-container')!;
const contingencyPlansList = document.getElementById('contingency-plans-list')!;

const selectedStationTitle = document.getElementById('selected-station-title')!;
const selectedStationBadges = document.getElementById('selected-station-badges')!;
const stationSplitFlapRows = document.getElementById('station-split-flap-rows')!;

const selectedTrainTitle = document.getElementById('selected-train-title')!;
const selectedTrainState = document.getElementById('selected-train-state')!;
const trainInspectorBody = document.getElementById('train-inspector-body')!;

const telemetryLogList = document.getElementById('telemetry-log-list')!;
const dynamicHotkeyBar = document.getElementById('dynamic-hotkey-bar')!;
const canvasTerseTooltip = document.getElementById('canvas-terse-tooltip')!;

const timetableDialog = document.getElementById('timetable-dialog') as HTMLDialogElement;
const indexDialog = document.getElementById('index-dialog') as HTMLDialogElement;
const stationFactsheetDialog = document.getElementById('station-factsheet-dialog') as HTMLDialogElement;
const factsheetStationSelect = document.getElementById('factsheet-station-Hopper') as HTMLSelectElement;

// Observe Co-Pilot & Shift Preset DOM Elements
const shiftPresetSelect = document.getElementById('shift-preset-select') as HTMLSelectElement;
const toggleObserveBtn = document.getElementById('toggle-observe-btn')!;
const observeHudCard = document.getElementById('observe-hud-card')!;
const observeCalloutTitle = document.getElementById('observe-callout-title')!;
const observeCalloutTag = document.getElementById('observe-callout-tag')!;
const observeCalloutRationale = document.getElementById('observe-callout-rationale')!;
const observeCalloutStat = document.getElementById('observe-callout-stat')!;
const observeFocusSelect = document.getElementById('observe-focus-select') as HTMLSelectElement;
const observePaceSelect = document.getElementById('observe-pace-select') as HTMLSelectElement;
const observeCountdownProgress = document.getElementById('observe-countdown-progress') as HTMLProgressElement;
const observeCountdownLabel = document.getElementById('observe-countdown-label')!;

// Wire Toggletip / Interest-Triggered Tooltips ARIA & Fallbacks (per modern-web-guidance interest-triggered-tooltips)
const ownedInterestTriggers = new Set<HTMLElement>();

function wireInterestTooltips(root: ParentNode = document) {
  const triggers = root.querySelectorAll<HTMLElement>('[interestfor]');
  triggers.forEach((trigger) => {
    const targetId = trigger.getAttribute('interestfor');
    if (!targetId) return;
    const hint = document.getElementById(targetId);
    if (!hint || hint.getAttribute('popover') !== 'hint') return;

    const hintText = (hint.textContent || '').replace(/\s+/g, ' ').trim();
    const triggerName = (
      trigger.getAttribute('aria-label') ||
      trigger.textContent ||
      trigger.getAttribute('title') ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();

    if (hintText === triggerName) return;
    if (!hint.hasAttribute('role')) {
      hint.setAttribute('role', 'tooltip');
    }

    if (!triggerName) {
      if (!trigger.hasAttribute('aria-labelledby')) {
        trigger.setAttribute('aria-labelledby', targetId);
      }
    } else if (
      trigger.getAttribute('popovertarget') === targetId ||
      trigger.getAttribute('commandfor') === targetId
    ) {
      if (!trigger.hasAttribute('aria-expanded')) {
        const isOpen = hint.matches(':popover-open, .\\:popover-open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        ownedInterestTriggers.add(trigger);
      }
    } else if (!trigger.hasAttribute('aria-describedby')) {
      trigger.setAttribute('aria-describedby', targetId);
    }
  });
}

// Sync aria-expanded from popover toggle events in capture phase
document.addEventListener(
  'toggle',
  (e) => {
    const pop = e.target as HTMLElement;
    if (!pop || !pop.id) return;
    const isOpen = (e as ToggleEvent).newState === 'open';
    ownedInterestTriggers.forEach((trig) => {
      if (trig.getAttribute('interestfor') === pop.id) {
        trig.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
    });
  },
  true
);

// Fallback for browsers where popover="hint" defaults to "manual": switch toggletips to "auto" on beforetoggle
const probe = document.createElement('div');
probe.setAttribute('popover', 'hint');
if (probe.popover !== 'hint') {
  document.addEventListener(
    'beforetoggle',
    (e) => {
      const target = e.target as HTMLElement;
      const newState = (e as ToggleEvent).newState;
      const isToggletip =
        target.getAttribute('popover') === 'hint' &&
        target.id &&
        document.querySelector(`[popovertarget="${CSS.escape(target.id)}"]`);
      if (newState === 'open' && isToggletip) {
        target.setAttribute('popover', 'auto');
      }
    },
    true
  );
}

wireInterestTooltips();

// Conditionally load Popover & Interest Invokers polyfills only when native support is missing
if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
  import('@oddbird/popover-polyfill');
}
if (!('interestForElement' in HTMLButtonElement.prototype)) {
  import('interestfor');
}

// State cache to prevent constant DOM re-creation / flashing on Split-Flap board and Train Inspector
let lastStationBoardStationId: string = '';
let lastStationBoardRowSigs: string[] = [];
let lastInspectedTrainId: string = '';

// Update Dynamic Context-Sensitive Keyboard Shortcuts Bar at the bottom
function renderDynamicHotkeyBar() {
  if (!dynamicHotkeyBar) return;

  if (timetableDialog.open || indexDialog.open || stationFactsheetDialog.open) {
    dynamicHotkeyBar.innerHTML = `
      <span class="hk-badge"><kbd>ESC</kbd> Close Modal Window</span>
      <span class="hk-badge">Click Backdrop Outside Dialog to Dismiss</span>
    `;
    return;
  }

  if (observe.active) {
    dynamicHotkeyBar.innerHTML = `
      <span class="hk-badge" style="color:#E9D5FF;"><strong>👁 OBSERVE CO-PILOT ACTIVE:</strong></span>
      <span class="hk-badge"><kbd>N</kbd> Next Co-Pilot Insight / Action Now</span>
      <span class="hk-badge"><kbd>O</kbd> Take Back the Wheel</span>
      <span class="hk-badge"><kbd>D</kbd> Throw a Disruption at Co-Pilot</span>
      <span class="hk-badge"><kbd>SPACE</kbd> ${sim.timeScale === 0 ? 'Resume' : 'Pause'}</span>
    `;
    return;
  }

  if (schematic.nxEntryNodeId) {
    const entryNode = sim.nodeMap[schematic.nxEntryNodeId];
    dynamicHotkeyBar.innerHTML = `
      <span class="hk-badge" style="color:#38BDF8;"><strong>NX ENTRY: ${entryNode?.name || schematic.nxEntryNodeId}</strong></span>
      <span class="hk-badge"><kbd>CLICK EXIT SIGNAL</kbd> Lock White Interlocked Route</span>
      <span class="hk-badge"><kbd>ESC</kbd> Cancel NX Selection</span>
      <span class="hk-badge"><kbd>H</kbd> Hold/Release Entry Signal RED</span>
    `;
    return;
  }

  if (schematic.selectedTrain && sim.trains.some((t) => t.id === schematic.selectedTrain?.id)) {
    const tr = schematic.selectedTrain;
    dynamicHotkeyBar.innerHTML = `
      <span class="hk-badge" style="color:#FBBF24;"><strong>UNIT ${tr.headcode}:</strong></span>
      <span class="hk-badge"><kbd>P</kbd> Dispatch PSA (18 mph Manual)</span>
      <span class="hk-badge"><kbd>R</kbd> Short-Turn / Reverse at Nearest Turnback</span>
      <span class="hk-badge"><kbd>F</kbd> Center Camera on Train</span>
      <span class="hk-badge"><kbd>ESC</kbd> Deselect Train</span>
      <span class="hk-badge"><kbd>SPACE</kbd> ${sim.timeScale === 0 ? 'Resume' : 'Pause'}</span>
    `;
    return;
  }

  // Default Workstation Hotkeys
  dynamicHotkeyBar.innerHTML = `
    <span class="hk-badge"><kbd>SPACE</kbd> ${sim.timeScale === 0 ? 'Resume' : 'Pause'}</span>
    <span class="hk-badge"><kbd>[</kbd> <kbd>]</kbd> Speed</span>
    <span class="hk-badge"><kbd>0</kbd>–<kbd>6</kbd> Sectors</span>
    <span class="hk-badge"><kbd>←↑↓→</kbd> Pan</span>
    <span class="hk-badge"><kbd>S</kbd> Fact Sheet</span>
    <span class="hk-badge"><kbd>O</kbd> Co-Pilot</span>
    <span class="hk-badge"><kbd>F1</kbd>–<kbd>F4</kbd> Plans</span>
    <span class="hk-badge"><kbd>B</kbd> CBTC</span>
    <span class="hk-badge"><kbd>T</kbd> Timetables</span>
    <span class="hk-badge"><kbd>I</kbd> Index</span>
    <span class="hk-badge"><kbd>D</kbd> +Disrupt</span>
  `;
}

// Render Observe Co-Pilot Floating Narrative HUD & Beacon
function renderObserveHUD() {
  toggleObserveBtn.classList.toggle('active', observe.active);
  toggleObserveBtn.textContent = observe.active ? '👁 OBSERVE CO-PILOT: ON' : '👁 OBSERVE CO-PILOT: OFF';

  if (!observe.active) {
    observeHudCard.hidden = true;
    schematic.observeBeacon = null;
    return;
  }

  observeHudCard.hidden = false;
  if (observeFocusSelect && observeFocusSelect.value !== observe.focus) {
    observeFocusSelect.value = observe.focus;
  }
  if (observeCountdownProgress) {
    observeCountdownProgress.value = observe.getRemainingPercentage();
  }
  if (observeCountdownLabel) {
    observeCountdownLabel.textContent = `Next focus in ${observe.getRemainingSeconds().toFixed(1)}s`;
  }
  // Sync speed button highlight
  document.querySelectorAll<HTMLButtonElement>('.speed-btn[data-speed]').forEach((b) => {
    b.classList.toggle('active', parseFloat(b.dataset.speed || '1') === sim.timeScale);
  });

  if (observe.currentCallout) {
    const c = observe.currentCallout;
    observeCalloutTitle.textContent = c.title;
    observeCalloutTag.textContent = c.tag;
    observeCalloutRationale.textContent = c.rationale;
    observeCalloutStat.textContent = c.statHighlight;
    schematic.observeBeacon = {
      x: c.worldX,
      y: c.worldY,
      label: c.tag,
    };
  }
}

observe.onUpdateUI = () => {
  renderObserveHUD();
  refreshAllUI();
};

// Fallback for browsers without native <dialog closedby="any"> support (per modern-web-guidance)
if (!('closedBy' in HTMLDialogElement.prototype)) {
  const outside = (e: PointerEvent, dialog: HTMLDialogElement) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[closedby="any"]')) {
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => {
      pressedOutside = outside(e, dialog);
    });
    dialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && outside(e, dialog)) dialog.close();
    });
  }
}

// Render Priority Action Inset (Active Blocking Incidents + 1-Click Contingency Plans)
function renderActionInset() {
  const unresolved = sim.incidents.filter((i) => !i.resolved);

  if (unresolved.length === 0) {
    activeIncidentsContainer.innerHTML = `
      <div class="incident-card" style="border-left-color: #10B981;">
        <div class="incident-top">
          <span class="incident-title" style="color: #10B981;">✓ ALL LINES OPERATING NORMALLY</span>
        </div>
        <p class="incident-desc" style="margin-bottom:0;">
          SelTrac moving-block supervision active across all 45 stations. Click <strong>⚡ +DISRUPTION</strong> above to test a new breakdown, points failure, or crowd surge.
        </p>
      </div>
    `;
  } else {
    activeIncidentsContainer.innerHTML = unresolved
      .map(
        (inc) => `
      <div class="incident-card ${inc.severity === 'WARNING' ? 'warning' : ''}">
        <div class="incident-top">
          <span class="incident-title">${inc.title}</span>
          ${
            inc.stationId || inc.nodeId
              ? `<button type="button" class="locate-btn" data-locate-st="${inc.stationId || ''}" data-locate-node="${inc.nodeId || ''}">LOCATE</button>`
              : ''
          }
        </div>
        <p class="incident-desc">${inc.description}</p>
        <div class="incident-btn-list">
          ${inc.actions
            .map(
              (act) => `
            <button type="button" class="resolve-action-btn" data-inc-id="${inc.id}" data-act-id="${act.id}" title="${act.description}">
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

  // Bind Locate & Action buttons
  activeIncidentsContainer.querySelectorAll<HTMLButtonElement>('.locate-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stId = btn.dataset.locateSt;
      const nodeId = btn.dataset.locateNode;
      if (stId && STATION_MAP[stId]) {
        const st = STATION_MAP[stId];
        schematic.focusCoordinates(st.x, st.y, 1.25);
        schematic.selectedStation = st;
        renderStationBoard();
      } else if (nodeId && sim.nodeMap[nodeId]) {
        const n = sim.nodeMap[nodeId];
        schematic.focusCoordinates(n.x, n.y, 1.25);
      }
    });
  });

  activeIncidentsContainer.querySelectorAll<HTMLButtonElement>('.resolve-action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const incId = btn.dataset.incId!;
      const actId = btn.dataset.actId!;
      sim.executeIncidentAction(incId, actId);
    });
  });

  // Render 1-Click Contingency Plans with terse "i" toggletips
  contingencyPlansList.innerHTML = sim.contingencies
    .map(
      (cp) => `
    <div style="position:relative; display:flex; align-items:stretch;">
      <button type="button" class="cp-btn ${cp.active ? 'active' : ''}" style="flex:1; padding-right:24px;" data-cp-id="${cp.id}">
        <strong>${cp.active ? '● ' : '○ '}${cp.shortCode}</strong>
        <span>${cp.effectSummary}</span>
      </button>
      <button type="button" class="info-chip" style="position:absolute; top:6px; right:6px;" interestfor="tip-${cp.id}" popovertarget="tip-${cp.id}" popovertargetaction="show" aria-label="About ${cp.shortCode}">i</button>
      <div id="tip-${cp.id}" popover="hint" class="terse-tip">
        <strong>${cp.shortCode}</strong> · ${cp.description}
      </div>
    </div>
  `
    )
    .join('');

  wireInterestTooltips(contingencyPlansList);

  contingencyPlansList.querySelectorAll<HTMLButtonElement>('.cp-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cpId = btn.dataset.cpId!;
      sim.toggleContingencyPlan(cpId);
    });
  });
}

// Render Solari Split-Flap Station Departure Board (diff-updated so rows only flip when their text actually changes!)
function renderStationBoard(forceFlipAll = false) {
  const st: Station = schematic.selectedStation || STATION_MAP['CAW'];
  selectedStationTitle.textContent = `${st.code} · ${st.name}`;
  const crowdMult = sim.stationCrowdMultiplier[st.id] || 1.0;
  selectedStationBadges.textContent = `${st.maxCars}-CAR MAX · ${st.hasTurnback ? 'TURNBACK' : 'THROUGH'}${
    crowdMult > 1.3 ? ' · HIGH CROWD' : ''
  }`;

  const stationChanged = lastStationBoardStationId !== st.id || forceFlipAll;
  lastStationBoardStationId = st.id;

  const deps = sim.getStationDepartures(st.id);
  if (deps.length === 0) {
    const emptySig = 'EMPTY';
    if (lastStationBoardRowSigs.join('|') !== emptySig) {
      lastStationBoardRowSigs = [emptySig];
      stationSplitFlapRows.innerHTML = `
        <div class="flap-row animate-flap">
          <span class="flap-plat">--</span>
          <span class="flap-dest">NO SCHEDULED SERVICES</span>
          <span class="flap-cars">--</span>
          <span class="flap-eta">--</span>
        </div>
      `;
    }
    return;
  }

  const newSigs = deps.map((d) => `${d.platform}:${d.headcode}:${d.destName}:${d.cars}:${d.etaMins}:${d.status}`);

  // If the number of rows changed or station changed, rebuild rows cleanly
  const existingRows = stationSplitFlapRows.querySelectorAll<HTMLElement>('.flap-row');
  if (stationChanged || existingRows.length !== deps.length) {
    lastStationBoardRowSigs = newSigs;
    stationSplitFlapRows.innerHTML = deps
      .map(
        (d) => `
      <div class="flap-row ${stationChanged ? 'animate-flap' : ''}">
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
    return;
  }

  // Otherwise, update each row in-place and ONLY trigger .animate-flap on rows whose signature changed!
  deps.forEach((d, idx) => {
    if (newSigs[idx] !== lastStationBoardRowSigs[idx]) {
      const rowEl = existingRows[idx];
      if (!rowEl) return;
      rowEl.innerHTML = `
        <span class="flap-plat">P${d.platform}</span>
        <span class="flap-dest">${d.headcode} ${d.destName.toUpperCase()}</span>
        <span class="flap-cars">${d.cars}CAR</span>
        <span class="flap-eta ${d.status.includes('DELAY') || d.status.includes('LATE') ? 'delayed' : ''}">
          ${d.etaMins === 0 ? 'DUE' : `${d.etaMins} MIN`}
        </span>
      `;
      rowEl.classList.remove('animate-flap');
      // Trigger reflow so only this changed row flips once
      void rowEl.offsetWidth;
      rowEl.classList.add('animate-flap');
    }
  });

  lastStationBoardRowSigs = newSigs;
}

// Render Selected Train Unit Inspector (preserves <select> dropdown focus during live telemetry ticks)
function renderTrainInspector(forceRebuild = false) {
  const tr = schematic.selectedTrain;
  if (!tr || !sim.trains.some((t) => t.id === tr.id)) {
    if (lastInspectedTrainId !== '') {
      lastInspectedTrainId = '';
      selectedTrainTitle.textContent = 'Select a Train Berth';
      selectedTrainState.textContent = 'STANDBY';
      trainInspectorBody.innerHTML = `
        <p class="muted-hint">
          Click any train berth pill on the schematic to inspect live SelTrac telemetry, dispatch a PSA for 18 mph manual recovery, or divert to an alternate terminus.
        </p>
      `;
      renderDynamicHotkeyBar();
    }
    return;
  }

  const currNode = sim.nodeMap[tr.currentNodeId];
  selectedTrainTitle.textContent = `Unit ${tr.headcode} (${tr.cars}-Car B23)`;
  selectedTrainState.textContent = tr.state;

  // If same train is already mounted in the inspector and not forced, update telemetry values in-place without destroying dropdown!
  if (!forceRebuild && lastInspectedTrainId === tr.id && document.getElementById('insp-loc-val')) {
    document.getElementById('insp-loc-val')!.textContent = currNode?.name || tr.currentNodeId;
    document.getElementById('insp-spd-val')!.textContent = `${Math.round(tr.speedMph)} / ${tr.targetSpeedMph} mph`;
    document.getElementById('insp-pax-val')!.textContent = tr.isECS
      ? 'ECS (EMPTY)'
      : `${tr.passengers} / ${tr.maxCapacity}`;
    const varEl = document.getElementById('insp-var-val')!;
    varEl.textContent = tr.delaySeconds > 10 ? `+${Math.round(tr.delaySeconds)}s late` : 'ON TIME';
    varEl.style.color = tr.delaySeconds > 60 ? '#EF4444' : '#10B981';

    const psaBtn = document.getElementById('inspector-psa-btn');
    if (psaBtn) {
      psaBtn.textContent = tr.psaMode
        ? '✓ PSA Manual Driving Engaged (18 mph)'
        : '👨‍✈️ Dispatch PSA for Manual Drive [Key P]';
    }
    return;
  }

  lastInspectedTrainId = tr.id;
  renderDynamicHotkeyBar();

  const stationTurnbackOptions = sim.stations
    .filter((s) => s.hasTurnback || s.isTerminus)
    .map(
      (s) =>
        `<option value="${s.id}" ${s.id === tr.destCode ? 'selected' : ''}>${s.code} — ${s.name} (${s.maxCars}C max)</option>`
    )
    .join('');

  const specialRoadOptions = sim.nodes
    .filter((n) => n.roadLabel && (n.type === 'depot' || n.type === 'siding'))
    .map(
      (n) =>
        `<option value="${n.id}" ${n.id === tr.currentNodeId ? 'selected' : ''}>↳ ${n.roadLabel} (${n.name})</option>`
    )
    .join('');

  const turnbackOptions = `
    <optgroup label="Termini &amp; Turnback Stations">${stationTurnbackOptions}</optgroup>
    <optgroup label="Depot Stabling Roads &amp; Turnback Pockets">${specialRoadOptions}</optgroup>
  `;

  trainInspectorBody.innerHTML = `
    <div class="inspector-grid">
      <div class="inspector-stat">
        <span>LOCATION / BERTH</span>
        <strong id="insp-loc-val">${currNode?.name || tr.currentNodeId}</strong>
      </div>
      <div class="inspector-stat">
        <span>SPEED / TARGET</span>
        <strong id="insp-spd-val">${Math.round(tr.speedMph)} / ${tr.targetSpeedMph} mph</strong>
      </div>
      <div class="inspector-stat">
        <span>PASSENGER LOAD</span>
        <strong id="insp-pax-val">${tr.isECS ? 'ECS (EMPTY)' : `${tr.passengers} / ${tr.maxCapacity}`}</strong>
      </div>
      <div class="inspector-stat">
        <span>SCHEDULE VARIANCE</span>
        <strong id="insp-var-val" style="color: ${tr.delaySeconds > 60 ? '#EF4444' : '#10B981'};">
          ${tr.delaySeconds > 10 ? `+${Math.round(tr.delaySeconds)}s late` : 'ON TIME'}
        </strong>
      </div>
    </div>
    ${
      tr.breakdownReason
        ? `<div class="incident-card" style="padding:0.4rem 0.55rem; margin-top:0.2rem;">
             <strong style="font-family:var(--font-mono); font-size:0.74rem; color:#FCA5A5;">${tr.breakdownReason}</strong>
           </div>`
        : ''
    }
    <div class="inspector-actions">
      <button type="button" id="inspector-psa-btn" class="resolve-action-btn">
        ${tr.psaMode ? '✓ PSA Manual Driving Engaged (18 mph)' : '👨‍✈️ Dispatch PSA for Manual Drive [Key P]'}
      </button>
      <div class="divert-row">
        <select id="inspector-divert-select" aria-label="Select New Destination">
          ${turnbackOptions}
        </select>
        <button type="button" id="inspector-divert-btn" class="speed-btn active">DIVERT</button>
      </div>
    </div>
  `;

  document.getElementById('inspector-psa-btn')?.addEventListener('click', () => {
    sim.dispatchPsaToTrain(tr.id);
    renderTrainInspector(true);
  });

  document.getElementById('inspector-divert-btn')?.addEventListener('click', () => {
    const sel = document.getElementById('inspector-divert-select') as HTMLSelectElement;
    if (sel && sel.value) {
      sim.rerouteTrainToDestination(tr, sel.value);
      renderTrainInspector(true);
    }
  });
}

// Render Event Telemetry Log
function renderTelemetryLog() {
  telemetryLogList.innerHTML = sim.logs
    .slice(0, 22)
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

// Render Timetable Templates inside Modal 1
function renderTimetableModal() {
  const listEl = document.getElementById('timetable-templates-list')!;
  listEl.innerHTML = sim.templates
    .map(
      (tpl) => `
    <div class="tpl-row" style="border-left-color: ${tpl.color};">
      <div class="tpl-info">
        <strong>${tpl.codePrefix}xx · ${tpl.name}</strong>
        <span>${tpl.isECS ? 'Empty Coaching Stock' : `${tpl.routeStations.length} stations`} ${
          tpl.exceptionReason ? `· ★ ${tpl.exceptionReason}` : ''
        }</span>
      </div>
      <div class="tpl-controls">
        <label style="font-size:0.65rem; color:#94A3B8;">Every</label>
        <input type="number" min="2" max="20" value="${tpl.intervalMins}" data-tpl-interval="${tpl.id}" style="width:48px;" />
        <span style="font-size:0.65rem; color:#94A3B8;">m</span>
        <select data-tpl-cars="${tpl.id}" aria-label="Car formation">
          <option value="2" ${tpl.cars === 2 ? 'selected' : ''}>2-Car</option>
          <option value="3" ${tpl.cars === 3 ? 'selected' : ''}>3-Car</option>
        </select>
        <button type="button" class="speed-btn ${tpl.active ? 'active' : ''}" data-tpl-toggle="${tpl.id}">
          ${tpl.active ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  `
    )
    .join('');

  listEl.querySelectorAll<HTMLInputElement>('input[data-tpl-interval]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const id = inp.dataset.tplInterval!;
      const tpl = sim.templates.find((t) => t.id === id);
      if (tpl) {
        tpl.intervalMins = Math.max(2, Math.min(20, parseInt(inp.value, 10) || 5));
        soundEngine.playSplitFlap(4);
        sim.addLog('TIMETABLE', `Updated ${tpl.name} headway to every ${tpl.intervalMins} mins.`);
      }
    });
  });

  listEl.querySelectorAll<HTMLSelectElement>('select[data-tpl-cars]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const id = sel.dataset.tplCars!;
      const tpl = sim.templates.find((t) => t.id === id);
      if (tpl) {
        tpl.cars = sel.value === '2' ? 2 : 3;
        soundEngine.playRelayClick(true);
        sim.addLog('TIMETABLE', `Changed ${tpl.name} stock allocation to ${tpl.cars}-car units.`);
      }
    });
  });

  listEl.querySelectorAll<HTMLButtonElement>('button[data-tpl-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tplToggle!;
      const tpl = sim.templates.find((t) => t.id === id);
      if (tpl) {
        tpl.active = !tpl.active;
        soundEngine.playRelayClick(tpl.active);
        renderTimetableModal();
      }
    });
  });
}

// Render Split-Flap Performance Index inside Modal 2
function renderPerformanceIndexModal() {
  const container = document.getElementById('performance-index-content')!;
  const metrics = sim.getPerformanceMetrics();

  container.innerHTML = `
    <div class="index-card">
      <h3>SOLARI NETWORK PERFORMANCE INDEX</h3>
      <div class="kpi-strip">
        <div class="kpi-box">
          <span>DLR PPM %</span>
          <strong>${metrics.ppm}%</strong>
        </div>
        <div class="kpi-box">
          <span>AVG VARIANCE</span>
          <strong style="color: ${metrics.avgDelaySec > 45 ? '#F59E0B' : '#10B981'};">+${metrics.avgDelaySec}s</strong>
        </div>
        <div class="kpi-box">
          <span>PAX CARRIED</span>
          <strong>${sim.totalPassengersCarried.toLocaleString()}</strong>
        </div>
      </div>
      <div class="kpi-strip">
        <div class="kpi-box">
          <span>ACTIVE TRAINS</span>
          <strong>${metrics.activeTrainCount}</strong>
        </div>
        <div class="kpi-box">
          <span>PSA MANUAL</span>
          <strong style="color:#FBBF24;">${metrics.psaCount}</strong>
        </div>
        <div class="kpi-box">
          <span>VOBC FAULTS</span>
          <strong style="color:${metrics.brokenCount > 0 ? '#EF4444' : '#94A3B8'};">${metrics.brokenCount}</strong>
        </div>
      </div>
      <p style="font-size:0.7rem; color:#94A3B8; line-height:1.4;">
        The DLR Operational Performance Index tracks Public Performance Measure (arrivals within 120 seconds of schedule), dynamic platform crowding across interchanges, and rare/diverted stock workings.
      </p>
    </div>

    <div class="index-card">
      <h3>RARE ROUTES, CHARTERS &amp; DIVERSION LOG</h3>
      <div class="split-flap-board">
        ${sim.rareRoutesCompleted
          .map(
            (r) => `
          <div class="flap-row" style="grid-template-columns: 74px 1fr 48px;">
            <span class="flap-dest">${r.headcode}</span>
            <span style="color:#E2E8F0; font-size:0.64rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.routeDesc}</span>
            <span class="flap-eta">${r.timeStr}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <div class="index-card">
      <h3>BUSIEST INTERCHANGE STATIONS (FOOTFALL)</h3>
      <div class="split-flap-board">
        ${metrics.busiestStations
          .map(
            (item, idx) => `
          <div class="flap-row" style="grid-template-columns: 28px 1fr 70px 75px;">
            <span class="flap-plat">#${idx + 1}</span>
            <span class="flap-dest">${item.station.code} · ${item.station.name.toUpperCase()}</span>
            <span class="flap-cars">${item.crowdMult > 1.3 ? '▲ SURGE' : 'NORMAL'}</span>
            <span class="flap-eta">${item.footfall.toLocaleString()}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <div class="index-card">
      <h3>LEAST BUSY / QUIETEST STATIONS</h3>
      <div class="split-flap-board">
        ${metrics.quietestStations
          .map(
            (item, idx) => `
          <div class="flap-row" style="grid-template-columns: 28px 1fr 60px 75px;">
            <span class="flap-plat">#${idx + 1}</span>
            <span class="flap-dest" style="color:#38BDF8;">${item.station.code} · ${item.station.name.toUpperCase()}</span>
            <span class="flap-cars">${item.station.maxCars}C MAX</span>
            <span class="flap-eta">${item.footfall.toLocaleString()}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

// Refresh all UI panels
function refreshAllUI() {
  const metrics = sim.getPerformanceMetrics();
  simClockFlap.textContent = sim.formatSimTime();
  ppmFlap.textContent = `${metrics.ppm.toFixed(1)}%`;
  unitsFlap.textContent = `${metrics.activeTrainCount}`;

  renderActionInset();
  renderStationBoard();
  renderTrainInspector();
  renderTelemetryLog();
  renderDynamicHotkeyBar();
  if (indexDialog.open) {
    renderPerformanceIndexModal();
  }
  if (stationFactsheetDialog.open && schematic.selectedStation) {
    renderStationFactSheetModal(schematic.selectedStation);
  }
}

// Render Zoomed-In Station Fact Sheet Modal (Micro-Schematic SVG, Gotchas, Advantages, Disadvantages, Platforms)
function renderStationFactSheetModal(st: Station) {
  const sheet = getStationFactSheet(st);
  const titleEl = document.getElementById('factsheet-dialog-title')!;
  const eyebrowEl = document.getElementById('factsheet-eyebrow')!;
  const contentEl = document.getElementById('station-factsheet-content')!;

  eyebrowEl.textContent = `DLR STATION ENGINEERING & SIGNALLING FACT SHEET · ${st.branch.toUpperCase()} BRANCH`;
  titleEl.textContent = `${st.code} · ${st.name}`;

  // Populate station hopper dropdown once or sync value
  if (factsheetStationSelect.options.length === 0) {
    factsheetStationSelect.innerHTML = sim.stations
      .map((s) => `<option value="${s.id}">${s.code} — ${s.name} (${s.branch})</option>`)
      .join('');
  }
  factsheetStationSelect.value = st.id;

  const footfall = (sim.stationFootfall[st.id] || 0).toLocaleString();
  const crowdMult = sim.stationCrowdMultiplier[st.id] || 1.0;
  const svgDiagram = renderStationMicroSchematicSVG(st, sheet, sim);
  const upNode = sim.nodeMap[`${st.id}_UP`];
  const dnNode = sim.nodeMap[`${st.id}_DN`];

  contentEl.innerHTML = `
    <div class="factsheet-tagline-bar">
      <h3>${sheet.tagline}</h3>
      <div class="factsheet-meta-pills">
        <span class="fs-pill ${st.maxCars === 2 ? 'amber' : ''}">MAX ${st.maxCars}-CAR (${st.maxCars === 2 ? '60m SDO' : '90m FULL'})</span>
        <span class="fs-pill">${st.hasTurnback ? '✓ TURNBACK CROSSOVER' : 'PLAIN LINE (NO TURNBACK)'}</span>
        <span class="fs-pill">FOOTFALL: ${footfall} PAX</span>
        ${crowdMult > 1.3 ? `<span class="fs-pill amber">▲ CROWD SURGE (${Math.round(crowdMult * 100)}%)</span>` : ''}
      </div>
    </div>

    <!-- Zoomed-In Station Micro-Schematic SVG -->
    <div class="micro-schematic-box">
      ${svgDiagram}
    </div>

    <!-- Civil Structure & Platform Configuration -->
    <div class="factsheet-specs-row">
      <div class="fs-spec-box">
        <span>CIVIL ENGINEERING &amp; STRUCTURE</span>
        <strong>${sheet.structureType}</strong>
      </div>
      <div class="fs-spec-box">
        <span>PLATFORM &amp; INTERCHANGE LAYOUT</span>
        <strong>${sheet.platformLayout}${
          st.interchange && st.interchange.length > 0 ? ` · Interchange: ${st.interchange.join(', ')}` : ''
        }</strong>
      </div>
    </div>

    <!-- 3-Column Gotchas, Advantages & Disadvantages -->
    <div class="factsheet-trio-grid">
      <div class="fs-col-card gotchas">
        <h4>⚠️ SIGNALLING GOTCHAS &amp; QUIRKS</h4>
        <ul>
          ${sheet.gotchas.map((g) => `<li>${g}</li>`).join('')}
        </ul>
      </div>

      <div class="fs-col-card advantages">
        <h4>✅ OPERATIONAL ADVANTAGES</h4>
        <ul>
          ${sheet.advantages.map((a) => `<li>${a}</li>`).join('')}
        </ul>
      </div>

      <div class="fs-col-card disadvantages">
        <h4>🔻 BOTTLENECKS &amp; DISADVANTAGES</h4>
        <ul>
          ${sheet.disadvantages.map((d) => `<li>${d}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- Controller Tip & Quick Signal Controls -->
    <div class="factsheet-ops-footer">
      <div>
        <strong style="color:#38BDF8; font-family:var(--font-mono);">CHIEF CONTROLLER TIP:</strong> ${sheet.operationalNotes}
      </div>
      <div style="display:flex; gap:0.4rem; flex-shrink:0;">
        <button type="button" id="fs-hold-up-btn" class="speed-btn ${upNode?.signalHeld ? 'active' : ''}">
          ${upNode?.signalHeld ? '🔓 RELEASE P1 (UP)' : '🛑 HOLD P1 (UP) RED'}
        </button>
        <button type="button" id="fs-hold-dn-btn" class="speed-btn ${dnNode?.signalHeld ? 'active' : ''}">
          ${dnNode?.signalHeld ? '🔓 RELEASE P2 (DN)' : '🛑 HOLD P2 (DN) RED'}
        </button>
      </div>
    </div>
  `;

  document.getElementById('fs-hold-up-btn')?.addEventListener('click', () => {
    sim.toggleSignalHold(`${st.id}_UP`);
    renderStationFactSheetModal(st);
  });

  document.getElementById('fs-hold-dn-btn')?.addEventListener('click', () => {
    sim.toggleSignalHold(`${st.id}_DN`);
    renderStationFactSheetModal(st);
  });
}

function openStationFactSheet(st?: Station) {
  const target = st || schematic.selectedStation || STATION_MAP['CAW'];
  schematic.selectedStation = target;
  renderStationBoard(true);
  renderStationFactSheetModal(target);
  if (!stationFactsheetDialog.open) {
    stationFactsheetDialog.showModal();
  }
  soundEngine.playSplitFlap(6);
  renderDynamicHotkeyBar();
}

sim.onStateChange = () => {
  refreshAllUI();
};

schematic.onSelectStation = (st: Station) => {
  soundEngine.playSplitFlap(4);
  renderStationBoard(true);
  renderDynamicHotkeyBar();
};

schematic.onOpenStationFactSheet = (st: Station) => {
  openStationFactSheet(st);
};

schematic.onSelectTrain = (tr: Train) => {
  soundEngine.playRelayClick(true);
  renderTrainInspector(true);
  renderDynamicHotkeyBar();
};

schematic.onStatusFeedback = (msg: string) => {
  nxStatusText.textContent = msg;
  renderDynamicHotkeyBar();
};

schematic.onHoverInfo = (info) => {
  if (!info) {
    canvasTerseTooltip.hidden = true;
    return;
  }
  canvasTerseTooltip.innerHTML = info.html;
  canvasTerseTooltip.hidden = false;
  // Clamp position inside canvas container so it never clips off-screen
  const parentRect = canvasEl.parentElement?.getBoundingClientRect();
  const maxW = parentRect ? parentRect.width - 390 : 800;
  const clampedX = Math.max(12, Math.min(info.x, maxW));
  const clampedY = Math.max(48, info.y);
  canvasTerseTooltip.style.left = `${clampedX}px`;
  canvasTerseTooltip.style.top = `${clampedY}px`;
};

// Wire Top Bar Buttons
document.querySelectorAll<HTMLButtonElement>('.speed-btn[data-speed]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const sp = parseFloat(btn.dataset.speed || '1');
    sim.timeScale = sp;
    document.querySelectorAll('.speed-btn[data-speed]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    soundEngine.playRelayClick(sp > 0);
    renderDynamicHotkeyBar();
  });
});

function activateSectorView(sec: SectorId) {
  schematic.jumpToSector(sec);
  document.querySelectorAll<HTMLButtonElement>('.sector-btn[data-sector]').forEach((b) => {
    b.classList.toggle('active', b.dataset.sector === sec);
  });
  soundEngine.playRelayClick(false);
}

document.querySelectorAll<HTMLButtonElement>('.sector-btn[data-sector]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const sec = btn.dataset.sector as SectorId;
    activateSectorView(sec);
  });
});

// Wire On-Canvas Navigation & Complex Switcher Toolbar
document.querySelectorAll<HTMLButtonElement>('.nav-chip-btn[data-jump-sector]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const sec = btn.dataset.jumpSector as SectorId;
    activateSectorView(sec);
  });
});

document.getElementById('canvas-zoom-in-btn')?.addEventListener('click', () => {
  schematic.zoomBy(1.18);
  soundEngine.playRelayClick(true);
});

document.getElementById('canvas-zoom-out-btn')?.addEventListener('click', () => {
  schematic.zoomBy(0.84);
  soundEngine.playRelayClick(false);
});

const canvasStationJumpSelect = document.getElementById('canvas-station-jump-select') as HTMLSelectElement | null;
if (canvasStationJumpSelect) {
  canvasStationJumpSelect.innerHTML =
    `<option value="">📍 Jump to Station / Complex…</option>` +
    sim.stations
      .map((s) => `<option value="${s.id}">${s.code} · ${s.name} (${s.branch})</option>`)
      .join('');
  canvasStationJumpSelect.addEventListener('change', () => {
    const stId = canvasStationJumpSelect.value;
    if (!stId || !STATION_MAP[stId]) return;
    const st = STATION_MAP[stId];
    schematic.selectedStation = st;
    schematic.focusCoordinates(st.x, st.y, 1.18);
    renderStationBoard(true);
    soundEngine.playSplitFlap(4);
    canvasStationJumpSelect.value = '';
  });
}

// Keyboard shortcuts (Dynamic context-aware shortcuts + global controls)
const SPEED_STEPS = [0, 0.5, 1, 4, 10];
function setSimSpeed(newSpeed: number) {
  sim.timeScale = newSpeed;
  document.querySelectorAll<HTMLButtonElement>('.speed-btn[data-speed]').forEach((b) => {
    b.classList.toggle('active', parseFloat(b.dataset.speed || '1') === sim.timeScale);
  });
  soundEngine.playRelayClick(newSpeed > 0);
  renderDynamicHotkeyBar();
}

window.addEventListener('keydown', (e) => {
  // Ignore shortcuts if typing in an input or select
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  if (timetableDialog.open || indexDialog.open || stationFactsheetDialog.open) {
    setTimeout(() => renderDynamicHotkeyBar(), 20);
    return;
  }

  const key = e.key.toLowerCase();

  if (e.code === 'Space') {
    e.preventDefault();
    setSimSpeed(sim.timeScale === 0 ? 1 : 0);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    schematic.panBy(0, 75);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    schematic.panBy(0, -75);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    schematic.panBy(75, 0);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    schematic.panBy(-75, 0);
  } else if (e.key === '[') {
    const idx = SPEED_STEPS.indexOf(sim.timeScale);
    if (idx > 0) setSimSpeed(SPEED_STEPS[idx - 1]);
  } else if (e.key === ']') {
    const idx = SPEED_STEPS.indexOf(sim.timeScale);
    if (idx !== -1 && idx < SPEED_STEPS.length - 1) setSimSpeed(SPEED_STEPS[idx + 1]);
  } else if (e.key === '-' || e.key === '_') {
    schematic.zoomBy(0.86);
  } else if (e.key === '=' || e.key === '+') {
    schematic.zoomBy(1.16);
  } else if (['0', '1', '2', '3', '4', '5', '6'].includes(e.key)) {
    const map: Record<string, SectorId> = {
      '0': 'FULL',
      '1': 'CORE',
      '2': 'WEST',
      '3': 'SOUTH',
      '4': 'EAST',
      '5': 'NORTH',
      '6': 'WOOLWICH',
    };
    const sec = map[e.key];
    activateSectorView(sec);
  } else if (e.key === 'Escape') {
    if (schematic.nxEntryNodeId) {
      schematic.nxEntryNodeId = null;
      nxStatusText.textContent = 'NX Entry Selection Cancelled · ARS Auto-Routing Active';
    } else if (schematic.selectedTrain) {
      schematic.selectedTrain = null;
      renderTrainInspector(true);
    }
    renderDynamicHotkeyBar();
  } else if (key === 'p' && schematic.selectedTrain) {
    sim.dispatchPsaToTrain(schematic.selectedTrain.id);
    renderTrainInspector(true);
  } else if (key === 'f' && schematic.selectedTrain) {
    const pos = schematic.getTrainWorldCoords(schematic.selectedTrain);
    schematic.focusCoordinates(pos.x, pos.y, 1.3);
  } else if (key === 'r' && schematic.selectedTrain) {
    // Short-turn selected train at nearest turnback station in its route queue (or Canary Wharf / Custom House / Shadwell fallback)
    const tr = schematic.selectedTrain;
    const nextTurnback =
      tr.routeQueue.find((stId) => STATION_MAP[stId]?.hasTurnback || STATION_MAP[stId]?.isTerminus) || 'CAW';
    sim.rerouteTrainToDestination(tr, nextTurnback);
    renderTrainInspector(true);
  } else if (key === 'h' && schematic.nxEntryNodeId) {
    sim.toggleSignalHold(schematic.nxEntryNodeId);
    schematic.nxEntryNodeId = null;
    renderDynamicHotkeyBar();
  } else if (key === 'b') {
    document.getElementById('toggle-cbtc-btn')?.click();
  } else if (key === 't') {
    document.getElementById('open-timetable-btn')?.click();
    renderDynamicHotkeyBar();
  } else if (key === 'i') {
    document.getElementById('open-index-btn')?.click();
    renderDynamicHotkeyBar();
  } else if (key === 'd') {
    sim.triggerScopedDisruption('ALL');
  } else if (key === 'o') {
    observe.toggle();
  } else if (key === 'm') {
    popoutDeskBtn?.click();
  } else if (key === 's') {
    openStationFactSheet();
  } else if (key === 'n' && observe.active) {
    observe.forceNextStep();
  } else if (e.key === 'F1') {
    e.preventDefault();
    sim.toggleContingencyPlan('CP_SHORT_CAW');
  } else if (e.key === 'F2') {
    e.preventDefault();
    sim.toggleContingencyPlan('CP_DIVERT_TWG_BNK');
  } else if (e.key === 'F3') {
    e.preventDefault();
    sim.toggleContingencyPlan('CP_BECKTON_CUH');
  } else if (e.key === 'F4') {
    e.preventDefault();
    sim.toggleContingencyPlan('CP_AIRPORT_LCA');
  }
});

// Toggle CBTC Moving-Block Footprints
const toggleCbtcBtn = document.getElementById('toggle-cbtc-btn')!;
toggleCbtcBtn.addEventListener('click', () => {
  sim.showCbtcOverlays = !sim.showCbtcOverlays;
  toggleCbtcBtn.classList.toggle('active', sim.showCbtcOverlays);
  toggleCbtcBtn.textContent = `CBTC BLOCKS: ${sim.showCbtcOverlays ? 'ON' : 'OFF'}`;
  soundEngine.playRelayClick(sim.showCbtcOverlays);
});

// Wire Shift Preset Selector (Default: MON 05:25 Cold Start)
shiftPresetSelect?.addEventListener('change', () => {
  const preset = shiftPresetSelect.value as 'MON_0525' | 'MON_0730' | 'SAT_1300' | 'FRI_2355';
  sim.loadShiftPreset(preset);
  soundEngine.playSplitFlap(7);
  refreshAllUI();
});

// Toggle Observe Co-Pilot Mode & On-the-Fly Controls
toggleObserveBtn.addEventListener('click', () => {
  observe.toggle();
});

document.getElementById('help-me-fix-it-btn')?.addEventListener('click', () => {
  observe.engageHelpMeFixIt(true);
});

document.getElementById('observe-fix-all-btn')?.addEventListener('click', () => {
  observe.engageHelpMeFixIt(true);
});

document.getElementById('observe-take-wheel-btn')?.addEventListener('click', () => {
  observe.toggle(false);
});

document.getElementById('observe-next-step-btn')?.addEventListener('click', () => {
  observe.forceNextStep();
});

observeFocusSelect?.addEventListener('change', () => {
  observe.focus = observeFocusSelect.value as ObserveFocus;
  observe.forceNextStep();
});

observePaceSelect?.addEventListener('change', () => {
  observe.pace = observePaceSelect.value as ObservePace;
});

// Toggle Audio
const toggleAudioBtn = document.getElementById('toggle-audio-btn')!;
toggleAudioBtn.addEventListener('click', () => {
  soundEngine.enabled = !soundEngine.enabled;
  toggleAudioBtn.textContent = soundEngine.enabled ? '🔊' : '🔇';
});

// Trigger Random Disruption & Collapse/Expand Action Inset
document.getElementById('random-disruption-btn')?.addEventListener('click', () => {
  sim.triggerScopedDisruption('ALL');
});

const actionInsetPanel = document.getElementById('action-inset-panel');
const toggleInsetCollapseBtn = document.getElementById('toggle-inset-collapse-btn');
toggleInsetCollapseBtn?.addEventListener('click', () => {
  if (!actionInsetPanel) return;
  const isCollapsed = actionInsetPanel.classList.toggle('collapsed');
  toggleInsetCollapseBtn.textContent = isCollapsed ? '▸' : '▾';
  soundEngine.playRelayClick(!isCollapsed);
});

// Modal 1: Timetable & Scenario Generator
document.getElementById('open-timetable-btn')?.addEventListener('click', () => {
  renderTimetableModal();
  timetableDialog.showModal();
  soundEngine.playSplitFlap(5);
});

document.getElementById('close-timetable-btn')?.addEventListener('click', () => {
  timetableDialog.close();
});
timetableDialog.addEventListener('close', () => renderDynamicHotkeyBar());

document.querySelectorAll<HTMLButtonElement>('.exception-preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const ex = btn.dataset.exception!;
    sim.injectSpecialExceptionService(ex);
    renderTimetableModal();
  });
});

document.getElementById('trigger-scoped-random-btn')?.addEventListener('click', () => {
  const sel = document.getElementById('randomiser-scope-select') as HTMLSelectElement;
  const scope = (sel?.value || 'ALL') as 'ALL' | 'VOBC_BREAKDOWN' | 'POINTS_FAILURE' | 'CROWD_SURGE' | 'TUNNEL_BLOCK';
  sim.triggerScopedDisruption(scope);
  timetableDialog.close();
});

// Modal 2: Performance Index
document.getElementById('open-index-btn')?.addEventListener('click', () => {
  renderPerformanceIndexModal();
  indexDialog.showModal();
  soundEngine.playSplitFlap(8);
  renderDynamicHotkeyBar();
});

document.getElementById('close-index-btn')?.addEventListener('click', () => {
  indexDialog.close();
});
indexDialog.addEventListener('close', () => renderDynamicHotkeyBar());

// Modal 3: Zoomed-In Station Fact Sheet
document.getElementById('open-station-factsheet-btn')?.addEventListener('click', () => {
  openStationFactSheet();
});

document.getElementById('close-factsheet-btn')?.addEventListener('click', () => {
  stationFactsheetDialog.close();
});
stationFactsheetDialog.addEventListener('close', () => renderDynamicHotkeyBar());

factsheetStationSelect?.addEventListener('change', () => {
  const st = STATION_MAP[factsheetStationSelect.value];
  if (st) {
    schematic.selectedStation = st;
    schematic.focusCoordinates(st.x, st.y, 1.18);
    renderStationBoard(true);
    renderStationFactSheetModal(st);
    soundEngine.playSplitFlap(5);
  }
});

// Dual-Monitor Pop-Out Telemetry Desk & 100% Full-Screen Map Wall Mode
let deskPopupWin: Window | null = null;
const appRootEl = document.getElementById('app')!;
const popoutDeskBtn = document.getElementById('popout-desk-btn') as HTMLButtonElement | null;

function setMapWallMode(enabled: boolean) {
  appRootEl.classList.toggle('dual-monitor-map-only', enabled);
  if (actionInsetPanel && toggleInsetCollapseBtn) {
    actionInsetPanel.classList.toggle('collapsed', enabled);
    toggleInsetCollapseBtn.textContent = enabled ? '▸' : '▾';
  }
  if (popoutDeskBtn) {
    popoutDeskBtn.classList.toggle('active', enabled);
    popoutDeskBtn.textContent = enabled ? '📥 DOCK SIDEBAR [M]' : '🖥️ 2ND MONITOR DESK';
  }
  setTimeout(() => {
    schematic.handleResize();
    const activeSecBtn = document.querySelector<HTMLButtonElement>('.sector-btn.active');
    const sec = (activeSecBtn?.dataset.sector || 'CORE') as SectorId;
    schematic.jumpToSector(sec);
  }, 40);
}

window.__dlrSimBridge = {
  sim,
  schematic,
  observe,
  focusStationOnMainMap: (stationId: string) => {
    const st = STATION_MAP[stationId];
    if (!st) return;
    schematic.selectedStation = st;
    schematic.focusCoordinates(st.x, st.y, 1.15);
    renderStationBoard(true);
    soundEngine.playSplitFlap(4);
  },
  focusTrainOnMainMap: (trainId: string) => {
    const tr = sim.trains.find((t) => t.id === trainId);
    if (!tr) return;
    schematic.selectedTrain = tr;
    const pos = schematic.getTrainWorldCoords(tr);
    schematic.focusCoordinates(pos.x, pos.y, 1.22);
    renderTrainInspector(true);
    soundEngine.playRelayClick(true);
  },
  onDeskClosed: () => {
    deskPopupWin = null;
    setMapWallMode(false);
  },
};

popoutDeskBtn?.addEventListener('click', () => {
  const isCurrentlyWall = appRootEl.classList.contains('dual-monitor-map-only');
  if (isCurrentlyWall) {
    if (deskPopupWin && !deskPopupWin.closed) {
      deskPopupWin.close();
    }
    deskPopupWin = null;
    setMapWallMode(false);
    soundEngine.playRelayClick(false);
    return;
  }

  const url = `${window.location.origin}${window.location.pathname}?mode=desk`;
  deskPopupWin = window.open(url, 'dlr_telemetry_desk', 'popup,width=1440,height=920');
  setMapWallMode(true);
  soundEngine.playSplitFlap(6);
  nxStatusText.textContent = '2ND MONITOR TELEMETRY DESK ACTIVE · Monitor 1 Expanded to 100% Schematic Wall (Click 📥 DOCK SIDEBAR to restore)';
});

// If this window was opened with ?mode=desk, mount the 4-Quadrant Second-Monitor Data Dashboard!
const isDeskWindow = new URLSearchParams(window.location.search).get('mode') === 'desk';
if (isDeskWindow) {
  mountSecondMonitorDesk(sim, schematic, observe);
} else {
  // Initial camera position on Poplar / Westferry / Canary Wharf Delta & UI render
  setTimeout(() => {
    schematic.handleResize();
    schematic.jumpToSector('CORE');
    refreshAllUI();
  }, 60);
}

// Main Animation & Simulation Loop (Main Window only)
let lastFrameTime = performance.now();
let uiRefreshAccumulator = 0;

function animate(now: number) {
  if (isDeskWindow) return;
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  sim.tick(dt);
  observe.tick(dt);
  schematic.render();

  if (observe.active && observeCountdownProgress && observeCountdownLabel) {
    observeCountdownProgress.value = observe.getRemainingPercentage();
    observeCountdownLabel.textContent = `Next focus in ${observe.getRemainingSeconds().toFixed(1)}s`;
  }

  uiRefreshAccumulator += dt;
  if (uiRefreshAccumulator >= 0.45) {
    uiRefreshAccumulator = 0;
    simClockFlap.textContent = sim.formatSimTime();
    const metrics = sim.getPerformanceMetrics();
    ppmFlap.textContent = `${metrics.ppm.toFixed(1)}%`;
    unitsFlap.textContent = `${metrics.activeTrainCount}`;
    renderStationBoard();
    if (schematic.selectedTrain) {
      renderTrainInspector();
    }
  }

  requestAnimationFrame(animate);
}

if (!isDeskWindow) {
  requestAnimationFrame(animate);
}
