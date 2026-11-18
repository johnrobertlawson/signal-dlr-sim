# AGENTS.md — AI Agent Architecture & Context Guide (`signal-dlr-sim`)

> **Purpose**: High-density architectural, domain, and UI invariant reference for autonomous coding agents working on the **DLR SelTrac & IECC Signalling Simulator**. Read this first to minimize exploratory file reads.

---

## 1. Project Identity & Core Design Philosophy
- **Domain**: Realistic yet accessible UK train signalling and service control simulator for the **Docklands Light Railway (DLR)** across all 7 branches (45 stations + Poplar & Beckton Depots).
- **Aesthetic**: Hybrid **UK IECC / SimSig dark-mode schematic** (`#070b10` obsidian canvas, crisp orthogonal track circuits, 3-digit berth headcodes) combined with **Solari mechanical split-flap departure boards & telemetry counters** (`--dlr-teal: #00a4a7`, `--solari-amber: #f59e0b`).
- **Gameplay Balance**: Low-friction decision-making ("less faff on controls, more on thinking"). Automatic Route Setting (ARS) and SelTrac moving-block CBTC handle routine movement while the player (or Observe Co-Pilot) manages bottlenecks via:
  1. **Priority Action Inset** (1-click incident resolution & branch contingency plans `F1`–`F4`).
  2. **Manual NX (Entry-Exit) Interlocking Overrides** & **Signal Holds** (`Shift+Click` signal lamp).
  3. **PSA (Passenger Service Agent) 18 mph Manual Driving** when VOBC moving-block telemetry faults occur.
  4. **Live Unit Diversions / Short-Turns**, **Editable Interval Timetables**, **Special Event Exceptions**, and **Scoped Randomiser**.

---

## 2. File Map & Module Responsibilities
- [`index.html`](index.html): Complete DOM shell. Top telemetry bar (Solari counters, speed controls `0x`–`10x`, sector hotkeys `0`–`5`, modal triggers), `<canvas id="schematic-canvas">`, floating Priority Action Inset, Observe Co-Pilot HUD card, right sidebar (Solari Split-Flap Station Board, VOBC Unit Inspector, Event Log), native `<dialog closedby="any">` modals, and `[interestfor]` + `[popover="hint"]` terse info toggletips.
- [`src/types.ts`](src/types.ts): Core TypeScript interfaces (`Station`, `TrackNode`, `TrackEdge`, `ServiceTemplate`, `Train`, `ActiveIncident`, `ContingencyPlan`, `LogEntry`).
- [`src/dlrData.ts`](src/dlrData.ts):
  - `STATIONS` & `STATION_MAP`: All 45 stations + `PDP` (Poplar Depot) and `BDP` (Beckton Depot), with non-geographically wrapped eastern Beckton loop (`BKP` → `CYP` → `GAL` → `BCK`) and `WOO` (Woolwich Arsenal) positioned south/under the labelled River Thames ribbon (`y = 685`).
  - `buildNetworkGraph()`: Generates dual-track nodes (`<ST>_UP`, `<ST>_DN`), expanded grade-separated Delta chords (`DLT_W`, `DLT_SW`, `DLT_SE`, `POP_REV`, `CAW_MID` P3/P4 center turnback) including the **`DLT_BYP_UP` Westbound `CAW → WFE` Bypass Track** (`SOP-WIQ`: no platform at West India Quay for Bank-bound trains), the **Stratford International (`STI`) & Stratford Regional (`STR`) Olympic Complex** (`STI_HSH`, `STI_XOVR`, `STR_BAY` P4a/b high-level bays, `STR_MKT_JCT` Stratford Market crossover, `PML_REV` Olympic pocket), 3-road Poplar Depot stabling fan (`PDP_THROAT`, `PDP_S1..S3`), 4-road Beckton Depot stabling/wash/lathe fan (`BDP_W_LEAD`, `BDP_E_LEAD`, `BDP_R1..R4`, `BCK_REV`, `CUH_SID`), Bank Tail Headshunt Overrun Bore (`BNK_HSH`) + Royal Mint St Junction (`RMJ_UP`/`RMJ_DN`) + Tower Gateway Minories Single-Lead Throat (`TWG_THROAT`), and Woolwich Arsenal Sub-Surface Tail Siding (`WOO_HSH`).
  - `INITIAL_TEMPLATES` & `CONTINGENCY_PLANS`: Base interval schedules (`T_STI_WOO` calls at `STR` P16/P17 between `STI` and `SHS`) and 1-click branch override rules (`CP_SHORT_CAW`, `CP_DIVERT_TWG_BNK`, `CP_BECKTON_CUH`, `CP_AIRPORT_LCA`).
- [`src/simulation.ts`](src/simulation.ts):
  - `DLRSimulation`: Deterministic tick loop (`tick(dtRealSeconds)`), `loadShiftPreset()` defaulting to **`MON_0525`** (Monday 05:25:00 — 5 mins before the 05:30 first-train wave rolls out of Beckton & Poplar depot roads), plus `MON_0730`, `SAT_1300`, and `FRI_2355`.
  - Enforces **Underground SOP-UG1** (single train per deep tunnel bore on `isTunnel` edges), **SOP-UG2** (Bank tail headshunt overrun reversal via `BNK_HSH`), **SOP-TWG** (strict 2-car 60m lockout at Tower Gateway), **SOP-WIQ** (`filterWiqForWestboundBypass()` strips `WIQ` when running northbound `CAW → WFE` so Bank-bound trains bypass West India Quay via `DLT_BYP_UP`), smooth junction pass-through, and `stabilizeNetworkAll()` for 1-click AI emergency stabilization.
- [`src/schematicCanvas.ts`](src/schematicCanvas.ts):
  - `SchematicCanvas`: HTML5 2D canvas renderer with pan/zoom, `fitWorldBounds()` unobstructed viewport camera framing (`0`–`6` sector presets), 7 engineering/SOP enclosure boxes, pill-backed `roadLabel` and `edgeLabel` badges, CBTC safe-braking footprints, 66×22px train headcode pills, and instant terse hover hit-testing.
- [`src/observeController.ts`](src/observeController.ts):
  - `ObserveController`: Autonomous "Chief Controller Co-Pilot" & **"Help Me! Fix It!" (`HELP_ME_FIX_IT`)** mode (`Key O`). Steps at 50% slower pace (`RELAXED` 14.3s, `NORMAL` 10.2s, `BRISK` 6.8s) with a live `<progress>` countdown indicator, resolving faults, short-turning late trains, and explaining operational logic without injecting faults when in `HELP_ME_FIX_IT` mode.
- [`src/stationFactSheets.ts`](src/stationFactSheets.ts):
  - `getStationFactSheet()` & `renderStationMicroSchematicSVG()`: Generates zoomed-in engineering fact sheets (`Key S` or double-click station) with live SVG micro-interlocking diagrams (including the 4-track West India Quay `CAW→WFE` Bypass diagram, 3-track Canary Wharf center road, 60m SDO overhang zones, scissor crossovers, and live train berths) plus 3-column Gotchas, Advantages, and Disadvantages.
- [`src/telemetryDesk.ts`](src/telemetryDesk.ts):
  - `mountSecondMonitorDesk()`: 4-Quadrant Second-Monitor Deep Telemetry & Engineering Command Desk (`/?mode=desk`, launched via `🖥️ 2ND MONITOR DESK` or `Key M`). Shares live 60fps state with Monitor 1 via `window.opener.__dlrSimBridge` while expanding Monitor 1 into a 100% full-bleed Track Schematic Wall (`.dual-monitor-map-only`).
- [`src/audio.ts`](src/audio.ts):
  - `soundEngine`: Zero-dependency WebAudio synthesizer for Solari mechanical split-flap clatter (`playSplitFlap`), IECC relay clicks (`playRelayClick`), and two-tone SelTrac fault chimes (`playIncidentAlert`).
- [`src/main.ts`](src/main.ts):
  - App bootstrap, diff-cached UI renderers, context-sensitive bottom keyboard shortcut bar (`renderDynamicHotkeyBar`), native `<dialog>` and `[interestfor]` accessibility wiring.

---

## 3. Critical UI & Simulation Invariants (Do Not Break)
1. **Split-Flap Diff Caching (`renderStationBoard` in `src/main.ts`)**:
   - Never replace `stationSplitFlapRows.innerHTML` unconditionally on the 0.45s UI refresh timer — doing so re-triggers `@keyframes flapClatter` and causes constant visual flashing. Always compare `newSigs[idx] !== lastStationBoardRowSigs[idx]` and only apply `.animate-flap` to rows whose signature actually changed.
2. **In-Place Train Inspector Updates (`renderTrainInspector` in `src/main.ts`)**:
   - When the same train remains selected across ticks (`lastInspectedTrainId === tr.id`), update `#insp-loc-val`, `#insp-spd-val`, `#insp-pax-val`, and `#insp-var-val` via `.textContent` instead of rebuilding `trainInspectorBody.innerHTML`, so the user's open `<select id="inspector-divert-select">` dropdown is never reset mid-click.
3. **2-Car vs. 3-Car Platform Rules**:
   - `TWG` (Tower Gateway) has a hard physical limit of `2` cars (`cost += 100000` for 3-car trains in `findNodePath`).
   - `CUT` (Cutty Sark) and `ELV` (Elverson Road) have `maxCars: 2` (`60m`), which permits 3-car trains to pass through using Selective Door Operation (SDO) with a `+6s` dwell penalty (`selectiveDoorPenalty`).
4. **Modern Web Standards Compliance**:
   - **Dialogs**: All modals use native `<dialog closedby="any">` opened with `.showModal()`, styled with `dialog:modal { overscroll-behavior: contain; }` and `dialog::backdrop { overflow: hidden; overscroll-behavior: contain; }`, plus the pointer-bounding-box fallback for browsers without native `closedBy`.
   - **Toggletips (`"i"` buttons)**: Use `interestfor="<id>" popovertarget="<id>" popovertargetaction="show"` pointing to `<div id="<id>" popover="hint" class="terse-tip">`. Whenever dynamic HTML containing `[interestfor]` is injected, call `wireInterestTooltips(container)`.

---

## 4. Build & Development Commands
```bash
npm install
npm run dev      # Starts Vite dev server on http://127.0.0.1:5173
npm run build    # Runs strict tsc typecheck + Vite production bundle into dist/
```
