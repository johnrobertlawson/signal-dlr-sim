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
  - `STATIONS` & `STATION_MAP`: All 45 stations + `PDP` (Poplar Depot) and `BDP` (Beckton Depot) with schematic `(x, y)` coordinates, `maxCars` (`2` or `3`), `baseDemand`, `hasTurnback`, `isTerminus`, and `labelPos`.
  - `buildNetworkGraph()`: Generates dual-track nodes (`<ST>_UP` for Platform 1 West/Northbound, `<ST>_DN` for Platform 2 East/Southbound), bidirectional `20 mph` turnback crossovers (`X_<ST>_DN_UP` / `X_<ST>_UP_DN`), grade-separated Delta junctions (`WFE`–`POP`–`WIQ`), and sub-aqueous Thames bores (`ISG`–`CUT`–`GRE` and `KGV`–`WOO`).
  - `INITIAL_TEMPLATES`: Base interval schedules (`1xx` BNK↔LEW, `2xx` BNK↔WOO, `3xx` TWG↔BCK 2-car, `4xx` STR↔LEW, `5xx` STI↔WOO, `9xx` BDP→CAW ECS).
  - `CONTINGENCY_PLANS`: 1-click branch override rules (`CP_SHORT_CAW`, `CP_DIVERT_TWG_BNK`, `CP_BECKTON_CUH`, `CP_AIRPORT_LCA`).
- [`src/simulation.ts`](src/simulation.ts):
  - `DLRSimulation`: Deterministic tick loop (`tick(dtRealSeconds)`), Dijkstra pathfinder (`findNodePath`) respecting blocked tracks, points failures, manual NX locks, bi-directional Single Line Working (SLW), and the strict 2-car platform lockout at Tower Gateway (`TWG`).
  - Moving-block CBTC braking (`computeCbtcSpeedLimit`, `isBlockAheadOccupied`), Selective Door Operation (`+6s` dwell penalty when a 3-car train stops at a 2-car platform like `CUT` or `ELV`), and dynamic passenger crowding (`stationCrowdMultiplier`).
- [`src/schematicCanvas.ts`](src/schematicCanvas.ts):
  - `SchematicCanvas`: HTML5 2D canvas renderer with pan/zoom, sector camera presets (`jumpToSector`, `focusCoordinates`), CBTC green/amber safe-braking footprints, 66×22px train headcode pills, signal aspect lamps, pulsing Observe Co-Pilot beacon, and instant terse hover hit-testing (`onHoverInfo`).
- [`src/observeController.ts`](src/observeController.ts):
  - `ObserveController`: Autonomous "Chief Controller Co-Pilot" mode (`Key O`). Steps at configurable pace (`RELAXED` 9.5s, `NORMAL` 6.8s, `BRISK` 4.5s) and focus (`BALANCED`, `CRISIS_RECOVERY`, `DLR_LORE_STATS`, `TIMETABLE_MASTERY`), panning the camera, resolving faults, short-turning late trains (>95s delay), and displaying first-person rationale + real-world DLR engineering facts.
- [`src/stationFactSheets.ts`](src/stationFactSheets.ts):
  - `getStationFactSheet()` & `renderStationMicroSchematicSVG()`: Generates zoomed-in engineering fact sheets (`Key S` or double-click station) with live SVG micro-interlocking diagrams (showing 3-track Canary Wharf center road, 60m SDO overhang zones, scissor crossovers, and live train berths) plus 3-column Gotchas, Advantages, and Disadvantages.
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
