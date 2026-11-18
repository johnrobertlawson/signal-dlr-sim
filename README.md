# DLR SelTrac & IECC Signalling Simulator (`signal-dlr-sim`)

An interactive UK train signalling and service control workstation for the **Docklands Light Railway (DLR)** across all 7 branches and 45 stations (+ Poplar & Beckton Depots). Combines an authentic dark-mode **IECC / SimSig schematic** and **SelTrac CBTC moving-block physics** with a mechanical **Solari Split-Flap** departure board & telemetry aesthetic.

## Key Features
- **Full 7-Branch DLR Network**: Bank, Tower Gateway, Stratford, Lewisham, Beckton, Woolwich Arsenal, and Stratford International, including the grade-separated Westferry–Poplar–West India Quay Delta and sub-aqueous Thames bores.
- **Hybrid SelTrac CBTC & NX Interlocking**: Automatic Route Setting (ARS) and visual moving-block braking footprints (`Key B`) on plain line, with manual Entry-Exit (NX) route locking and signal holds (`Shift+Click`) at junctions and crossovers.
- **Priority Action Inset & 1-Click Contingency Plans (`F1`–`F4`)**: Dispatch Passenger Service Agents (PSAs) for 18 mph manual fault recovery, short-turn branches at Canary Wharf, Custom House, or London City Airport, and manage dynamic crowd surges.
- **Observe Co-Pilot Mode (`Key O`)**: Hand the wheel to an autonomous Chief Controller who pans across the network, resolves disruptions, short-turns late trains, and explains operational logic and real-world DLR engineering facts at your chosen pace and focus.
- **Zoomed-In Station Fact Sheets (`Key S` or Double-Click Station)**: Detailed SVG micro-interlocking diagrams, civil structure specs, platform lengths (60m 2-car SDO vs. 90m 3-car), signalling gotchas, advantages, and bottlenecks for every station.
- **Editable Timetables, Special Event Exceptions & Scoped Randomiser (`Key T`)**: Adjust headways and 2-car/3-car formations, inject Airshow/ExCeL/Banking Summit shuttles or 9xx ECS depot transfers, and trigger scoped disruptions.
- **Terse `"i"` Toggletips & Context-Sensitive Hotkey Bar**: Hover or click any `i` icon or schematic object for one-line operational telemetry.

## Quick Start
```bash
npm install
npm run dev
```
