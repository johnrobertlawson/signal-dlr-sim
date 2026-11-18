import { DLRSimulation } from './simulation';
import { Station, TrackNode, Train } from './types';
import { STATION_MAP } from './dlrData';

export class SchematicCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: DLRSimulation;

  // Camera Pan & Zoom state
  public camX: number = -120;
  public camY: number = -180;
  public zoom: number = 0.78;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;

  // Interactive selections
  public hoveredStation: Station | null = null;
  public selectedStation: Station | null = null;
  public selectedTrain: Train | null = null;
  public nxEntryNodeId: string | null = null;
  public observeBeacon: { x: number; y: number; label: string } | null = null;
  private beaconPulsePhase: number = 0;

  public onSelectStation?: (st: Station) => void;
  public onOpenStationFactSheet?: (st: Station) => void;
  public onSelectTrain?: (tr: Train) => void;
  public onStatusFeedback?: (msg: string) => void;
  public onHoverInfo?: (info: { html: string; x: number; y: number } | null) => void;

  constructor(canvas: HTMLCanvasElement, sim: DLRSimulation) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.sim = sim;

    this.setupListeners();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  public handleResize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  public jumpToSector(sector: 'CORE' | 'WEST' | 'SOUTH' | 'EAST' | 'NORTH' | 'FULL') {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = rect ? rect.width : 1200;
    const h = rect ? rect.height : 800;

    if (sector === 'FULL') {
      this.zoom = Math.min(w / 2060, h / 1340) * 0.94;
      this.camX = w / 2 - 1030 * this.zoom;
      this.camY = h / 2 - 630 * this.zoom;
    } else if (sector === 'CORE') {
      // Expanded Westferry - Poplar - West India Quay Delta, Canary Wharf P3/P4 & Poplar Depot Fan
      this.zoom = 1.04;
      this.camX = w / 2 - 760 * this.zoom;
      this.camY = h / 2 - 515 * this.zoom;
    } else if (sector === 'WEST') {
      // Bank Headshunt, Tower Gateway 2C Throat, Royal Mint St Junction, Shadwell, Limehouse, Westferry
      this.zoom = 1.15;
      this.camX = w / 2 - 320 * this.zoom;
      this.camY = h / 2 - 500 * this.zoom;
    } else if (sector === 'SOUTH') {
      // Canary Wharf down to Greenwich & Lewisham
      this.zoom = 0.95;
      this.camX = w / 2 - 690 * this.zoom;
      this.camY = h / 2 - 960 * this.zoom;
    } else if (sector === 'EAST') {
      // Canning Town, ExCeL, Wrapped Beckton & Multi-Road Beckton Depot, City Airport, Woolwich
      this.zoom = 0.88;
      this.camX = w / 2 - 1630 * this.zoom;
      this.camY = h / 2 - 360 * this.zoom;
    } else if (sector === 'NORTH') {
      // Stratford, Stratford International & Poplar Depot Fan
      this.zoom = 1.0;
      this.camX = w / 2 - 930 * this.zoom;
      this.camY = h / 2 - 270 * this.zoom;
    }
  }

  public focusCoordinates(worldX: number, worldY: number, targetZoom = 1.15) {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = rect ? rect.width : 1200;
    const h = rect ? rect.height : 800;
    this.zoom = targetZoom;
    this.camX = w / 2 - worldX * this.zoom;
    this.camY = h / 2 - worldY * this.zoom;
  }

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.camX) / this.zoom,
      y: (sy - this.camY) / this.zoom,
    };
  }

  private setupListeners() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.dragStartX = e.clientX - this.camX;
      this.dragStartY = e.clientY - this.camY;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this.isDragging) {
        this.camX = e.clientX - this.dragStartX;
        this.camY = e.clientY - this.dragStartY;
        this.onHoverInfo?.(null);
        return;
      }

      // Only evaluate hover if pointer is inside canvas bounds
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) {
        this.hoveredStation = null;
        this.onHoverInfo?.(null);
        return;
      }

      const world = this.screenToWorld(sx, sy);

      // 1. Check train berth pill hover
      for (const t of this.sim.trains) {
        const pos = this.getTrainWorldCoords(t);
        if (Math.abs(world.x - pos.x) < 33 && Math.abs(world.y - pos.y) < 13) {
          this.hoveredStation = null;
          this.canvas.style.cursor = 'pointer';
          const destSt = STATION_MAP[t.destCode]?.name || t.destCode;
          const delayTxt = t.delaySeconds > 15 ? `+${Math.round(t.delaySeconds)}s late` : 'On time';
          const paxTxt = t.isECS ? 'ECS Empty' : `${t.passengers}/${t.maxCapacity} pax`;
          this.onHoverInfo?.({
            x: sx,
            y: sy,
            html: `<strong>🚆 ${t.headcode} → ${destSt}</strong> · ${t.cars}-Car · ${Math.round(t.speedMph)} mph · ${paxTxt} · <span style="color:${t.delaySeconds > 60 ? '#FCA5A5' : '#6EE7B7'}">${delayTxt}</span> · <em>Click to inspect / PSA / divert</em>`,
          });
          return;
        }
      }

      // 2. Check signal lamp hover
      for (const node of this.sim.nodes) {
        if (!node.hasSignal) continue;
        const sigPos = this.getSignalLampCoords(node);
        if (Math.hypot(world.x - sigPos.x, world.y - sigPos.y) < 11) {
          this.hoveredStation = null;
          this.canvas.style.cursor = 'pointer';
          const stateStr = node.signalHeld
            ? 'HELD RED (Manual Hold)'
            : node.pointsFailed
            ? 'POINTS FAULT (Locked Red)'
            : `${node.signalAspect} (SelTrac Auto)`;
          this.onHoverInfo?.({
            x: sx,
            y: sy,
            html: `<strong>🚦 Signal ${node.id}</strong> (${node.name}) · <span>${stateStr}</span> · <em>Click for NX Route · Shift+Click to Hold RED</em>`,
          });
          return;
        }
      }

      // 3. Check station hover
      let foundSt: Station | null = null;
      for (const st of this.sim.stations) {
        const dx = world.x - st.x;
        const dy = world.y - st.y;
        if (Math.hypot(dx, dy) < 28) {
          foundSt = st;
          break;
        }
      }
      this.hoveredStation = foundSt;
      this.canvas.style.cursor = foundSt ? 'pointer' : this.nxEntryNodeId ? 'crosshair' : 'grab';

      if (foundSt) {
        const deps = this.sim.getStationDepartures(foundSt.id);
        const nextStr = deps[0]
          ? `Next: ${deps[0].headcode} (${deps[0].etaMins === 0 ? 'DUE' : `${deps[0].etaMins}m`})`
          : 'No trains due';
        const turnStr = foundSt.hasTurnback ? 'Turnback Crossover' : 'Through Station';
        const crowd = (this.sim.stationCrowdMultiplier[foundSt.id] || 1) > 1.3 ? ' · ⚠ Crowd Surge' : '';
        this.onHoverInfo?.({
          x: sx,
          y: sy,
          html: `<strong>🚉 ${foundSt.code} · ${foundSt.name}</strong> · Max ${foundSt.maxCars}-Car · ${turnStr}${crowd} · <span style="color:#FBBF24">${nextStr}</span> · <em>Click: Board · Dbl-Click: Fact Sheet</em>`,
        });
      } else {
        this.onHoverInfo?.(null);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);

      // 1. Check if user clicked on an active train pill
      for (const t of this.sim.trains) {
        const pos = this.getTrainWorldCoords(t);
        if (Math.abs(world.x - pos.x) < 26 && Math.abs(world.y - pos.y) < 12) {
          this.selectedTrain = t;
          this.onSelectTrain?.(t);
          return;
        }
      }

      // 2. Check if user clicked on a signal lamp (for NX route setting or Hold/Release)
      for (const node of this.sim.nodes) {
        if (!node.hasSignal) continue;
        const sigPos = this.getSignalLampCoords(node);
        if (Math.hypot(world.x - sigPos.x, world.y - sigPos.y) < 11) {
          if (e.shiftKey) {
            // Shift+Click toggles Signal Hold (RED / AUTO)
            this.sim.toggleSignalHold(node.id);
            this.onStatusFeedback?.(`Signal ${node.id}: ${node.signalHeld ? 'HELD AT RED' : 'AUTO RELEASED'}`);
            return;
          }

          if (!this.nxEntryNodeId) {
            this.nxEntryNodeId = node.id;
            this.onStatusFeedback?.(`NX ENTRY SELECTED: ${node.name} — Click destination EXIT signal to lock route (or Shift+Click to hold RED)`);
          } else if (this.nxEntryNodeId === node.id) {
            // Clicking same signal again toggles hold or cancels NX
            this.sim.toggleSignalHold(node.id);
            this.nxEntryNodeId = null;
          } else {
            const res = this.sim.setManualNXRoute(this.nxEntryNodeId, node.id);
            this.onStatusFeedback?.(res.msg);
            this.nxEntryNodeId = null;
          }
          return;
        }
      }

      // 3. Check if user clicked on a station
      for (const st of this.sim.stations) {
        if (Math.hypot(world.x - st.x, world.y - st.y) < 28) {
          const alreadySelected = this.selectedStation?.id === st.id;
          this.selectedStation = st;
          this.onSelectStation?.(st);
          if (alreadySelected) {
            this.onOpenStationFactSheet?.(st);
          }
          return;
        }
      }
    });

    this.canvas.addEventListener('dblclick', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.screenToWorld(sx, sy);

      for (const st of this.sim.stations) {
        if (Math.hypot(world.x - st.x, world.y - st.y) < 28) {
          this.selectedStation = st;
          this.onOpenStationFactSheet?.(st);
          return;
        }
      }
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const worldBefore = this.screenToWorld(sx, sy);

        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        this.zoom = Math.max(0.38, Math.min(2.4, this.zoom * factor));

        this.camX = sx - worldBefore.x * this.zoom;
        this.camY = sy - worldBefore.y * this.zoom;
      },
      { passive: false }
    );
  }

  private getSignalLampCoords(node: TrackNode): { x: number; y: number } {
    const offset = node.direction === 'DN' ? 16 : -16;
    return { x: node.x + offset, y: node.y - 8 };
  }

  public getTrainWorldCoords(t: Train): { x: number; y: number; angle: number } {
    const n1 = this.sim.nodeMap[t.currentNodeId];
    const n2 = t.nextNodeId ? this.sim.nodeMap[t.nextNodeId] : null;
    if (!n1) return { x: 500, y: 500, angle: 0 };
    if (!n2 || t.edgeProgress <= 0.01) {
      return { x: n1.x, y: n1.y, angle: 0 };
    }
    const x = n1.x + (n2.x - n1.x) * t.edgeProgress;
    const y = n1.y + (n2.y - n1.y) * t.edgeProgress;
    const angle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
    return { x, y, angle };
  }

  public render() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = rect ? rect.width : this.canvas.width;
    const h = rect ? rect.height : this.canvas.height;

    const ctx = this.ctx;
    // Deep IECC / SelTrac obsidian background
    ctx.fillStyle = '#070B10';
    ctx.fillRect(0, 0, w, h);

    // Subtle schematic grid
    this.drawGrid(w, h);

    ctx.save();
    ctx.translate(this.camX, this.camY);
    ctx.scale(this.zoom, this.zoom);

    // 1. Draw River Thames schematic ribbon & Geographical Zone Watermarks
    this.drawThamesAndZones();

    // 2. Draw all Track Edges (plain line, flyovers, tunnels, crossovers)
    this.drawTracks();

    // 3. Draw CBTC Moving-Block Braking Footprints (when toggled ON)
    if (this.sim.showCbtcOverlays) {
      this.drawCbtcFootprints();
    }

    // 4. Draw Stations, Platform Berths, and Signal Lamps
    this.drawStationsAndSignals();

    // 5. Draw Active Trains with authentic DLR Berth Headcodes
    this.drawTrains();

    // 6. Draw Observe Co-Pilot Spotlight Beacon (if Observe mode is active)
    if (this.observeBeacon) {
      this.drawObserveBeacon();
    }

    ctx.restore();
  }

  private drawObserveBeacon() {
    if (!this.observeBeacon) return;
    const ctx = this.ctx;
    this.beaconPulsePhase = (this.beaconPulsePhase + 0.06) % (Math.PI * 2);
    const pulseR = 26 + Math.sin(this.beaconPulsePhase) * 8;

    ctx.save();
    ctx.translate(this.observeBeacon.x, this.observeBeacon.y);

    // Outer pulsing cyan/gold target ring
    ctx.beginPath();
    ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner glow ring
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Floating tag pill above target
    const tagText = `👁 CO-PILOT FOCUS`;
    ctx.font = '800 10px "JetBrains Mono", monospace';
    const tw = ctx.measureText(tagText).width + 14;
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-tw / 2, -46, tw, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FBBF24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, 0, -37);

    ctx.restore();
  }

  private drawGrid(w: number, h: number) {
    const ctx = this.ctx;
    const step = 48 * this.zoom;
    if (step < 16) return;

    ctx.strokeStyle = 'rgba(0, 164, 167, 0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startX = ((this.camX % step) + step) % step;
    const startY = ((this.camY % step) + step) % step;

    for (let x = startX; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = startY; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  private drawThamesAndZones() {
    const ctx = this.ctx;

    // River Thames stylized schematic band between Island Gardens (980) and Cutty Sark (1040), and King George V (600) to Woolwich
    ctx.save();
    ctx.strokeStyle = 'rgba(14, 116, 144, 0.16)';
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(100, 1010);
    ctx.lineTo(540, 1010);
    ctx.lineTo(790, 1010);
    ctx.lineTo(1080, 740);
    ctx.lineTo(1750, 680);
    ctx.lineTo(2080, 680);
    ctx.stroke();

    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText('RIVER THAMES (GREENWICH SUB-AQUEOUS BORE · SOP-UG1)', 310, 1015);
    ctx.fillText('RIVER THAMES (WOOLWICH ARSENAL BORE · SOP-UG1)', 1520, 695);

    // Helper for Engineering / Depot / SOP Enclosure Boxes
    const drawEnclosureBox = (
      x: number,
      y: number,
      w: number,
      h: number,
      title: string,
      subtitle: string,
      borderColor = 'rgba(0, 164, 167, 0.32)',
      bgColor = 'rgba(15, 23, 42, 0.38)'
    ) => {
      ctx.save();
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 7);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '800 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(title, x + 10, y + 15);

      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(subtitle, x + 10, y + 28);
      ctx.restore();
    };

    // 1. Bank Deep-Tube Bore & Tail Headshunt SOP Box
    drawEnclosureBox(
      42,
      368,
      268,
      105,
      'BANK DEEP-TUBE COMPLEX (SOP-UG1 / UG2)',
      '1:20 Dive · 1 Train/Bore · Single Tail Headshunt (BNK_HSH)',
      'rgba(56, 189, 248, 0.35)'
    );

    // 2. Tower Gateway Viaduct & Minories 2-Car Lockout Box
    drawEnclosureBox(
      95,
      532,
      215,
      86,
      'TOWER GATEWAY (SOP-TWG: 2-CAR 60m MAX)',
      'Spanish-Solution Dual Platforms · 3-Car Sets Locked Out',
      'rgba(245, 158, 11, 0.42)'
    );

    // 3. Expanded Grade-Separated Westferry – Poplar – West India Quay Delta Box
    drawEnclosureBox(
      535,
      448,
      385,
      195,
      'POPLAR – WESTFERRY – WIQ FLYING DELTA',
      '3 Grade-Separated Chords · 25 mph Curves · POP Turnback Pocket',
      'rgba(0, 164, 167, 0.38)'
    );

    // 4. Expanded Poplar Depot & Workshop Multi-Road Fan
    drawEnclosureBox(
      828,
      272,
      258,
      162,
      'POPLAR DEPOT & WORKSITE FAN (PDP)',
      '3 Stabling & Lifting Roads (PDP_S1–S3) + Reception Throat',
      'rgba(168, 85, 247, 0.38)'
    );

    // 5. Expanded Beckton Depot & Terminus Multi-Road Complex (Wrapped Upper-East)
    drawEnclosureBox(
      1435,
      36,
      535,
      218,
      'BECKTON DEPOT (BDP) & GALLIONS REACH COMPLEX',
      '4 Stabling/Lathe/Wash Roads (BDP_R1–R4) · East & West Ladders · BCK Tail Siding',
      'rgba(16, 185, 129, 0.38)'
    );

    // Sector header labels on schematic
    ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.font = '800 17px "JetBrains Mono", monospace';
    ctx.fillText('CITY & ROYAL MINT ST WEST THROAT', 65, 350);
    ctx.fillText('OLYMPIC & STRATFORD NORTH', 620, 52);
    ctx.fillText('ISLE OF DOGS & LEWISHAM SOUTH', 440, 1255);
    ctx.fillText('ROYAL DOCKS, EXCEL & BECKTON LOOP', 1340, 382);
    ctx.fillText('LONDON CITY AIRPORT & WOOLWICH', 1350, 660);
    ctx.restore();
  }

  private drawTracks() {
    const ctx = this.ctx;

    // Identify occupied edges
    const occupiedEdgeIds = new Set<string>();
    for (const t of this.sim.trains) {
      if (t.currentEdgeId) occupiedEdgeIds.add(t.currentEdgeId);
    }

    for (const edge of this.sim.edges) {
      const n1 = this.sim.nodeMap[edge.from];
      const n2 = this.sim.nodeMap[edge.to];
      if (!n1 || !n2) continue;

      const isOccupied = occupiedEdgeIds.has(edge.id);
      const isManualRoute = this.sim.manualRoutes[edge.from] === edge.to;
      const isBlocked = n1.trackBlocked || n2.trackBlocked;

      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);

      if (edge.isCrossover) {
        ctx.strokeStyle = isManualRoute ? '#38BDF8' : 'rgba(148, 163, 184, 0.32)';
        ctx.lineWidth = isManualRoute ? 3 : 1.7;
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash(edge.isTunnel ? [7, 5] : []);
        if (isBlocked) {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 4;
        } else if (isOccupied) {
          ctx.strokeStyle = '#EF4444'; // SimSig Red Track Circuit Occupied
          ctx.lineWidth = 4.2;
        } else if (isManualRoute) {
          ctx.strokeStyle = '#F8FAFC'; // SimSig White Locked Route
          ctx.lineWidth = 4.0;
        } else if (edge.isFlyover) {
          ctx.strokeStyle = '#2E4760'; // Highlighted grade-separated Delta / Flyover viaduct
          ctx.lineWidth = 3.5;
        } else {
          ctx.strokeStyle = '#263547'; // Normal Unoccupied Steel Track
          ctx.lineWidth = 3.2;
        }
      }

      ctx.stroke();
      ctx.setLineDash([]);

      // Optional inline edge label for tunnels/chords
      if (edge.edgeLabel) {
        const mx = (n1.x + n2.x) / 2;
        const my = (n1.y + n2.y) / 2;
        ctx.save();
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
        ctx.textAlign = 'center';
        ctx.fillText(edge.edgeLabel, mx, my - 7);
        ctx.restore();
      }
    }
  }

  private drawCbtcFootprints() {
    const ctx = this.ctx;
    for (const t of this.sim.trains) {
      if (t.state === 'BROKEN_DOWN') continue;
      const n1 = this.sim.nodeMap[t.currentNodeId];
      const n2 = t.nextNodeId ? this.sim.nodeMap[t.nextNodeId] : null;
      if (!n1 || !n2) continue;

      const startX = n1.x + (n2.x - n1.x) * t.edgeProgress;
      const startY = n1.y + (n2.y - n1.y) * t.edgeProgress;
      const endProg = Math.min(1.0, t.edgeProgress + 0.38);
      const endX = n1.x + (n2.x - n1.x) * endProg;
      const endY = n1.y + (n2.y - n1.y) * endProg;

      ctx.save();
      ctx.strokeStyle = t.psaMode ? 'rgba(245, 158, 11, 0.55)' : 'rgba(16, 185, 129, 0.48)';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawStationsAndSignals() {
    const ctx = this.ctx;

    // Draw platform nodes, depot stabling berths, Delta junctions & signals
    for (const node of this.sim.nodes) {
      if (node.type === 'depot' || node.type === 'siding') {
        // Draw distinct stabling / turnback berth rectangle
        ctx.save();
        ctx.fillStyle = '#0F1B29';
        ctx.strokeStyle = node.type === 'depot' ? '#A855F7' : '#22D3EE';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(node.x - 16, node.y - 6, 32, 12, 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = node.trackBlocked ? '#EF4444' : '#475569';
        ctx.fillRect(node.x - 4, node.y - 4, 8, 8);
      }

      // Draw crisp technical label for broken-out depot roads, Delta chords, and headshunts
      if (node.roadLabel) {
        ctx.save();
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillStyle =
          node.type === 'depot'
            ? '#E9D5FF'
            : node.type === 'siding'
            ? '#67E8F9'
            : '#FDE68A';
        ctx.textAlign = 'center';
        ctx.fillText(node.roadLabel, node.x, node.y - 11);
        ctx.restore();
      }

      if (node.hasSignal) {
        const sigPos = this.getSignalLampCoords(node);
        const isNxSelected = this.nxEntryNodeId === node.id;

        ctx.beginPath();
        ctx.arc(sigPos.x, sigPos.y, isNxSelected ? 6.5 : 4.5, 0, Math.PI * 2);
        if (node.signalAspect === 'RED') {
          ctx.fillStyle = '#EF4444';
        } else if (node.signalAspect === 'AMBER') {
          ctx.fillStyle = '#F59E0B';
        } else {
          ctx.fillStyle = '#10B981';
        }
        ctx.fill();

        if (isNxSelected || node.signalHeld) {
          ctx.strokeStyle = isNxSelected ? '#38BDF8' : '#FCA5A5';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // Draw station labels and badges
    for (const st of this.sim.stations) {
      const isSelected = this.selectedStation?.id === st.id;
      const isHovered = this.hoveredStation?.id === st.id;
      const crowdMult = this.sim.stationCrowdMultiplier[st.id] || 1.0;
      const hasIncident = this.sim.incidents.some((inc) => !inc.resolved && inc.stationId === st.id);

      // Station outer ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(st.x, st.y, isSelected || isHovered ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = hasIncident ? '#EF4444' : crowdMult > 1.3 ? '#F59E0B' : '#00A4A7';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isSelected ? '#FFFFFF' : '#0F172A';
      ctx.stroke();

      // Label placement
      let lx = st.x;
      let ly = st.y - 22;
      ctx.textAlign = 'center';

      if (st.labelPos === 'bottom') {
        ly = st.y + 30;
      } else if (st.labelPos === 'left') {
        lx = st.x - 24;
        ly = st.y + 4;
        ctx.textAlign = 'right';
      } else if (st.labelPos === 'right') {
        lx = st.x + 24;
        ly = st.y + 4;
        ctx.textAlign = 'left';
      }

      // Station Code Pill + Name
      ctx.font = isSelected || isHovered ? '700 13px "JetBrains Mono", monospace' : '600 12px "JetBrains Mono", monospace';
      ctx.fillStyle = isSelected ? '#38BDF8' : hasIncident ? '#FCA5A5' : '#E2E8F0';
      const carTag = st.maxCars === 2 ? ' [2C]' : '';
      ctx.fillText(`${st.code} · ${st.name}${carTag}`, lx, ly);

      if (crowdMult > 1.3) {
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FBBF24';
        ctx.fillText('▲ CROWD SURGE', lx, ly + 14);
      }
      ctx.restore();
    }
  }

  private drawTrains() {
    const ctx = this.ctx;

    for (const t of this.sim.trains) {
      const pos = this.getTrainWorldCoords(t);
      const isSelected = this.selectedTrain?.id === t.id;
      const isBroken = t.state === 'BROKEN_DOWN';

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Berth pill dimensions (enlarged for crisp readability)
      const pw = 66;
      const ph = 22;

      // Glowing border for broken down or selected trains
      ctx.fillStyle = isBroken ? '#7F1D1D' : t.psaMode ? '#78350F' : '#0F172A';
      ctx.strokeStyle = isSelected
        ? '#FFFFFF'
        : isBroken
        ? '#EF4444'
        : t.psaMode
        ? '#F59E0B'
        : t.color;
      ctx.lineWidth = isSelected || isBroken ? 2.6 : 1.8;

      ctx.beginPath();
      ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 4);
      ctx.fill();
      ctx.stroke();

      // Left color stripe (2-car vs 3-car indicator bar)
      ctx.fillStyle = t.color;
      ctx.fillRect(-pw / 2 + 2, -ph / 2 + 2, 4.5, ph - 4);

      // Headcode text (e.g. "104 LEW")
      ctx.font = '700 11.5px "JetBrains Mono", monospace';
      ctx.fillStyle = isBroken ? '#FCA5A5' : t.psaMode ? '#FDE68A' : '#F8FAFC';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.headcode, 2, 0);

      // Car count or PSA badge above berth
      if (t.psaMode || isBroken || t.cars === 2) {
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.fillStyle = isBroken ? '#EF4444' : t.psaMode ? '#F59E0B' : '#38BDF8';
        const tag = isBroken ? '⚠ FAULT' : t.psaMode ? 'PSA 18M' : '2-CAR';
        ctx.fillText(tag, 0, -16);
      }

      ctx.restore();
    }
  }
}
