# DLR SelTrac & IECC Signalling Simulator (`signal-dlr-sim`)

An interactive UK train signalling, timetable, and service control workstation for the **Docklands Light Railway (DLR)** across all 7 branches and 45 stations (+ Poplar & Beckton multi-road depots). Blends a crisp **UK IECC / SimSig orthogonal schematic** (`3180 × 2120` Beck-inspired `0° / 45° / 90°` grid) and **SelTrac CBTC moving-block physics** with **Solari mechanical split-flap departure boards** and WebAudio telemetry.

---

## Install the desktop game

Download the installer for your computer from the [latest release](https://github.com/johnrobertlawson/signal-dlr-sim/releases/latest). The game and its local server are bundled. A graphical browser displays the simulator.

- **Mac, Intel or Apple silicon (macOS 13+)** — Open the universal `.pkg`. Launch **DLR Signalling Sim** from Applications and drag it to the Dock to keep it there. The local-build installer is unsigned. macOS may require approval in **System Settings → Privacy & Security**.
- **Ubuntu Desktop** — Open the `.deb` in a package installer. Choose `amd64` for Intel/AMD or `arm64` for ARM. The package manager installs missing browser and desktop-launch dependencies. Launch **DLR Signalling Sim** from Show Applications. The command-line installation equivalent is `sudo apt install ./dlr-signalling-sim_1.3.0_amd64.deb` from the downloads folder.
- Both installers open a dedicated window with a compatible Chromium browser, or a tab in the system browser. Closing the final game window releases the local server. Source checkout and Node.js are only needed for development.

### Cameras and map labels

Open **3rd Monitor Camera** and choose **CCTV patrol** from the **Feed** menu. The view changes every 12 seconds, even before the first train enters service. Watch the Minories entrance, a Royal Docks lift concourse, platforms, a maintenance road, the Greenwich tunnel mouth, and the busier Delta approach. The patrol also visits the airport and cableway, with a skyline channel after dark. Moving camera feeds aim for 30 fps and adapt to rendering cost.

The signalling map opens with routine labels tucked away. Hover a station or depot berth for details, use **Labels** for the engineering overlay, or open **Map key & shortcuts**. The second monitor highlights degraded stations and shows details when you point at a station, train, or corridor indicator.

### Watch London City Airport

Choose **Monday 07:30** and click **✈ LCY** on the map toolbar. An inbound flight is approaching as the shift starts. The station board shows simulated arrivals and departures, the runway camera and directional DLR queues. Choose **LCY runway camera** on the third-monitor feed to keep it visible while controlling the rest of the network. Front-window and trackside cameras also catch aircraft along the airport branch, with occasional helicopter overflights.

**Delay flight bank 15 min** holds several upcoming flights. When services resume, arriving passengers reach the station four to eight simulated minutes after landing. Passengers travelling to the terminal join airport-serving trains at Canning Town and Woolwich Arsenal before scheduled departures. The flight numbers, passenger splits and timings are gameplay assumptions. Operating windows follow [LCY’s published hours](https://www.londoncityairport.com/corporate/environment/noise-management-and-monitoring/airport-operating-hours). The game also links to the [official live flight board](https://www.londoncityairport.com/flight-info/departures-arrivals).

Across the network, queues grow with simulated time, station demand and disruptions. Boarding draws from each queue up to the train’s available capacity and passenger exchange affects dwell. The relative station weights use TfL’s 2019 DLR annualised entries and exits. [London Assembly, question 2022/0209, DLR table](https://gla.moderngov.co.uk/documents/b24191/Appendix%203a%20-%20Written%20Answers%20-%20Attachments%20Thursday%2020-Jan-2022%2010.00%20London%20Assembly%20Mayors%20Qu.pdf?T=9)

## Key Features

### Signalling, Physics & Network Realism
- **Full 7-Branch Schematic Network (`3180 × 2120` Canvas)**:
  - **Stratford Olympic Inverted-T Arch (`5:STR/STI`)**: Stratford International (`STI` + `STI_HSH` tail siding) dropping through Stratford Regional Low-Level (`P16/P17`), splitting west to Stratford High-Level Bays (`STR_BAY` `P4A/P4B`) down the Bow/Poplar spine and east via Stratford Market Crossover (`STR_MKT_JCT`) down the Lea Valley spine.
  - **West India Quay 4-Track Asymmetric Delta (`SOP-WIQ`)**: Grade-separated Westbound Dive-Under Bypass (`DLT_BYP_UP`, cyan dashed track) automatically routes Bank-bound (`CAW → WFE`) trains around West India Quay with no platform stop while Stratford ↔ Lewisham and southbound Bank → Lewisham services call normally.
  - **River Thames Sub-Aqueous Bores (`SOP-UG1`)**: Strict 1-train-per-bore protection across the **Bank `1:20` Bore**, **Greenwich Bore** (`ISG ↔ CUT` with **+6s Selective Door Operation (SDO)** at 60m `CUT`/`ELV`), and the **50 mph Woolwich Bore** diving from `KGV` on the North Bank under the labelled Thames (`y = 1120`) to South Bank sub-surface `WOO` (`y = 1260`).
  - **Tower Gateway 60m Lockout (`SOP-TWG`)**: Physical 2-car (`60m`) interlocking lockout at Minories Throat (`TWG_THROAT`) auto-diverting 3-car (`90m`) trains to Shadwell (`SHA`).
  - **Multi-Road Depots**: Non-overlapping 3-road **Poplar Depot** (`PDP_S1..S3`) and 4-road **Beckton Depot** (`BDP_R1..R4`) ladders supporting `05:25` Monday cold-start roll-outs and live `DIVERT` road routing.
- **Hybrid SelTrac CBTC & NX Interlocking**: Automatic Route Setting (ARS) + green safe-braking footprints (`Key B`), paired with manual Entry-Exit (NX) white route locking (`Click Entry → Click Exit`) and signal holds (`Shift+Click` signal lamp).

### Control Modes & Dual-Monitor Command Desk
- **Full Auto-Pilot Sit-Back Mode (`Key A` / `Key O` / `ON LAUNCH` switch / `?mode=autopilot`)**:
  - Autonomous Poplar SMC Chief Controller Co-Pilot with **16.0s** normal dwell (`22.0s` Relaxed / `10.0s` Brisk).
  - Resolves cold-start checks & VOBC faults via **18 mph PSA manual recovery**, short-turns late stock, and cycles organically between **`BUSY PEAK WAVE`** surges and **`SLACK WATCH`** 5-mode tours (Watchpoint Audits, DLR Real-World Engineering Lore, Diverse Train Spotlights, Controller Pro-Tips, and Footfall Pulses).
- **2nd Monitor Overwatch Wall & Deep Telemetry Desk (`Key M` / `🖥️ 2ND MONITOR DESK` / `?mode=desk`)**:
  - Expands Monitor 1 into a **100% full-bleed Track Schematic Wall** while opening a live 60fps second window with:
    - **Dual-Panel "Second Screen" Hero Overwatch Wall** (expandable to full height via `⛶ EXPAND DUAL SCREEN`):
      - **Panel A — Whole-Network Health Schematic**: Live colour- and symbol-coded (`✓ / ▲ / ⚠ / ⛔`) zoom-out of all 7 branches and 45 stations with 7 corridor health scores and click-to-focus.
      - **Panel B — Live Scrolling Piano-Roll Sequencer**: Real-time scrolling timeline across `-1.5m` through **`▼ NOW`** to `+6M` / `+10M` / `+15M` showing upcoming station calls, sub-aqueous bores, `WIQ` bypasses, 60m SDO stops, turnbacks, wave spawns, and faults.
    - **4-Deck Telemetry Workbench**: Live full-fleet CBTC/VOBC matrix table, Solari split-flap + SVG micro-schematic Station Inspector, active incidents/contingencies (`F1`–`F4`)/timetable editor, and footfall/SOP quick-reference analytics.
- **Zoomed-In Station Fact Sheets (`Key S` or Double-Click Station)**: Custom live SVG micro-interlocking diagrams (including the 4-track `WIQ` Bypass schematic) plus Gotchas, Advantages, and Bottlenecks.

---

## Quick Start

### Browser Dev / Preview
```bash
npm install
npm run dev       # Starts Vite dev server at http://127.0.0.1:5173
```
Optional query routes:
- `http://127.0.0.1:5173/?mode=autopilot` — Launch directly into **Full Auto-Pilot Sit-Back Mode** from session start.
- `http://127.0.0.1:5173/?mode=desk` — Open the **2nd Monitor Overwatch Wall & Deep Telemetry Desk** standalone.

### Source-checkout macOS Dock launcher
A pre-built macOS bundle (`DLR Signalling Sim.app`) starts Vite, opens a dedicated chromeless desktop window, and shuts down the background server automatically when the window closes. The Dock launcher verifies each new server before opening its window. It starts on 127.0.0.1 at port 5173 and picks a free port if that one is occupied. For the current address, open `~/Library/Logs/DLR Signalling Sim/launcher.log` in Finder. The latest Ready entry gives the URL. Append `/__dlr/status` to the origin for the running app’s identity and session ID. A Closed entry means the last window has disconnected and the Dock icon can start a fresh session.

To rebuild the launcher:
```bash
npm run build:mac-app
```

### Build desktop installers

Run `npm ci` and `npm run package:desktop` from the project root with Python 3 and Go installed. macOS uses its packaging tools to build a universal installer. Debian/Ubuntu uses `dpkg-deb` to build both Linux architectures. Files are versioned from `package.json` and written to `release/`.

### Production Build Check
```bash
npm run build     # Runs strict tsc typecheck + Vite production bundle into dist/
```

---

## Keyboard Shortcuts
- `Space` — Pause / Resume simulation
- `[` / `]` — Decrease / Increase simulation speed (`0.5×`, `1×`, `4×`, `10×`)
- `0`–`6` — Unobstructed sector camera presets (`0:ALL`, `1:DELTA/WIQ`, `2:WEST`, `3:SOUTH`, `4:BECKTON`, `5:STR/STI`, `6:WOO`)
- `← ↑ ↓ →` — Pan schematic (`+`/`-` zoom)
- `A` / `O` — Engage Full Auto-Pilot (`A`) or toggle Observe Co-Pilot (`O`); `N` skips to next Co-Pilot beat
- `M` — Toggle 2nd Monitor Overwatch Desk & Monitor 1 Map Wall
- `S` — Open zoomed-in Station Fact Sheet & SVG Micro-Schematic
- `B` — Toggle CBTC braking footprints · `T` — Timetables & Events · `I` — Performance Index · `D` — Trigger Disruption
- `F1`–`F4` — Toggle 1-click branch contingency plans (`CAW`, `TWG/BNK`, `CUH`, `LCA`)
- With a Train Selected: `P` Dispatch PSA · `R` Short-Turn · `F` Center Camera · `Esc` Deselect
