import { DLRSimulation } from './simulation';
import { Station, TrackEdge, TrackNode, Train } from './types';
import { STATION_MAP } from './dlrData';

export type SectorId = 'CORE' | 'WEST' | 'SOUTH' | 'EAST' | 'NORTH' | 'FULL' | 'WOOLWICH';

export class SchematicCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: DLRSimulation;

  // Camera Pan & Zoom state
  public camX: number = -60;
  public camY: number = -120;
  public zoom: number = 0.72;
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

  // Compute the unobstructed canvas viewport rectangle (accounting for the left Priority Action Inset when expanded)
  private getViewportBounds(): {
    cx: number;
    cy: number;
    w: number;
    h: number;
    openW: number;
    openH: number;
  } {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = rect ? rect.width : 1200;
    const h = rect ? rect.height : 800;

    const insetEl = document.getElementById('action-inset-panel');
    const isCollapsed = insetEl?.classList.contains('collapsed') ?? false;
    const insetWidth = insetEl && !isCollapsed ? insetEl.getBoundingClientRect().width + 20 : 16;

    const leftPad = w > 640 ? insetWidth : 16;
    const rightPad = 18;
    const topPad = 56;
    const bottomPad = 88;

    const openW = Math.max(320, w - leftPad - rightPad);
    const openH = Math.max(260, h - topPad - bottomPad);
    const cx = leftPad + openW * 0.5;
    const cy = topPad + openH * 0.5;

    return { cx, cy, w, h, openW, openH };
  }

  private fitWorldBounds(minX: number, minY: number, maxX: number, maxY: number, maxZoom = 1.15) {
    const { cx, cy, openW, openH } = this.getViewportBounds();
    const worldW = Math.max(100, maxX - minX);
    const worldH = Math.max(100, maxY - minY);
    this.zoom = Math.max(0.24, Math.min(maxZoom, Math.min(openW / worldW, openH / worldH) * 0.94));
    const worldCenterX = (minX + maxX) * 0.5;
    const worldCenterY = (minY + maxY) * 0.5;
    this.camX = cx - worldCenterX * this.zoom;
    this.camY = cy - worldCenterY * this.zoom;
  }

  public jumpToSector(sector: SectorId) {
    if (sector === 'FULL') {
      // Fit entire 7-branch 3180x2120 schematic network
      this.fitWorldBounds(20, -10, 3100, 2110, 0.92);
    } else if (sector === 'CORE') {
      // Westferry - Poplar - West India Quay 4-Track Bypass Delta, Canary Wharf P3/P4 & 3-Road Poplar Depot
      this.fitWorldBounds(730, 475, 1650, 1220, 1.02);
    } else if (sector === 'WEST') {
      // Bank Headshunt, Tower Gateway 2C Throat, Royal Mint St Junction, Shadwell, Limehouse, Westferry
      this.fitWorldBounds(25, 640, 895, 1020, 1.12);
    } else if (sector === 'SOUTH') {
      // West India Quay & Canary Wharf down across Greenwich Thames Bore to Cutty Sark & Lewisham
      this.fitWorldBounds(760, 1000, 1280, 2110, 0.92);
    } else if (sector === 'EAST') {
      // Canning Town, ExCeL, Royal Docks Loop, Beckton & 4-Road Beckton Depot
      this.fitWorldBounds(1840, 30, 3100, 890, 0.88);
    } else if (sector === 'NORTH') {
      // Stratford International (STI) & Stratford Regional (STR) Olympic Arch, North Spine, Lea Valley Spine & Poplar Depot
      this.fitWorldBounds(820, -15, 1890, 775, 0.94);
    } else if (sector === 'WOOLWICH') {
      // Canning Town, London City Airport, King George V, River Thames Sub-Aqueous Bore & Woolwich Arsenal Sub-Surface Box
      this.fitWorldBounds(1840, 800, 3060, 1340, 1.02);
    }
  }

  public focusCoordinates(worldX: number, worldY: number, targetZoom = 1.05) {
    const { cx, cy } = this.getViewportBounds();
    this.zoom = targetZoom;
    this.camX = cx - worldX * this.zoom;
    this.camY = cy - worldY * this.zoom;
  }

  public zoomBy(factor: number) {
    const { cx, cy } = this.getViewportBounds();
    const worldBefore = this.screenToWorld(cx, cy);
    this.zoom = Math.max(0.22, Math.min(2.4, this.zoom * factor));
    this.camX = cx - worldBefore.x * this.zoom;
    this.camY = cy - worldBefore.y * this.zoom;
  }

  public panBy(dxScreen: number, dyScreen: number) {
    this.camX += dxScreen;
    this.camY += dyScreen;
  }

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.camX) / this.zoom,
      y: (sy - this.camY) / this.zoom,
    };
  }

  // Compute a crisp Beck/IECC 0° / 45° / 90° chamfered polyline between two nodes (eliminating arbitrary diagonal spiderwebs!)
  public getEdgePolyline(n1: TrackNode, n2: TrackNode, edge?: TrackEdge): { x: number; y: number }[] {
    const x1 = n1.x;
    const y1 = n1.y;
    const x2 = n2.x;
    const y2 = n2.y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // Pure horizontal, pure vertical, short station crossover, or already ~45°
    if (adx < 6 || ady < 6 || Math.abs(adx - ady) < 8 || (edge?.isCrossover && adx + ady < 90)) {
      return [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ];
    }

    // Symmetric 45° chamfered polyline: straight -> 45° diagonal -> straight
    if (adx > ady) {
      const straight = adx - ady;
      const p1 = { x: x1 + Math.sign(dx) * (straight * 0.5), y: y1 };
      const p2 = { x: x2 - Math.sign(dx) * (straight * 0.5), y: y2 };
      return [{ x: x1, y: y1 }, p1, p2, { x: x2, y: y2 }];
    } else {
      const straight = ady - adx;
      const p1 = { x: x1, y: y1 + Math.sign(dy) * (straight * 0.5) };
      const p2 = { x: x2, y: y2 - Math.sign(dy) * (straight * 0.5) };
      return [{ x: x1, y: y1 }, p1, p2, { x: x2, y: y2 }];
    }
  }

  private interpolatePolyline(
    pts: { x: number; y: number }[],
    progress: number
  ): { x: number; y: number; angle: number } {
    if (pts.length === 0) return { x: 0, y: 0, angle: 0 };
    if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, angle: 0 };

    const t = Math.max(0, Math.min(1, progress));
    let totalLen = 0;
    const segLens: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      segLens.push(len);
      totalLen += len;
    }

    if (totalLen <= 0.001) {
      return { x: pts[0].x, y: pts[0].y, angle: 0 };
    }

    const targetDist = t * totalLen;
    let accum = 0;
    for (let i = 0; i < segLens.length; i++) {
      const sl = segLens[i];
      if (accum + sl >= targetDist || i === segLens.length - 1) {
        const localT = sl > 0.001 ? (targetDist - accum) / sl : 0;
        const pA = pts[i];
        const pB = pts[i + 1];
        return {
          x: pA.x + (pB.x - pA.x) * localT,
          y: pA.y + (pB.y - pA.y) * localT,
          angle: Math.atan2(pB.y - pA.y, pB.x - pA.x),
        };
      }
      accum += sl;
    }

    const last = pts[pts.length - 1];
    return { x: last.x, y: last.y, angle: 0 };
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

      // 3. Check special road / junction berth hover (e.g. DLT_BYP_UP, STI_HSH, STR_BAY, BDP_R1..4)
      for (const node of this.sim.nodes) {
        if (!node.roadLabel) continue;
        if (Math.hypot(world.x - node.x, world.y - node.y) < 22) {
          this.hoveredStation = null;
          this.canvas.style.cursor = 'pointer';
          const extraNote =
            node.id === 'DLT_BYP_UP'
              ? ' · <span style="color:#FBBF24">SOP-WIQ: Westbound CAW→WFE/BNK trains bypass West India Quay here (No Platform)</span>'
              : '';
          this.onHoverInfo?.({
            x: sx,
            y: sy,
            html: `<strong>🛤️ ${node.roadLabel}</strong> · ${node.name}${extraNote}`,
          });
          return;
        }
      }

      // 4. Check station hover
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
        const turnStr =
          foundSt.id === 'WIQ'
            ? '4-Track Delta (Bank-bound UP bypasses WIQ)'
            : foundSt.hasTurnback
            ? 'Turnback Crossover'
            : 'Through Station';
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
        if (Math.abs(world.x - pos.x) < 28 && Math.abs(world.y - pos.y) < 12) {
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
            this.sim.toggleSignalHold(node.id);
            this.onStatusFeedback?.(`Signal ${node.id}: ${node.signalHeld ? 'HELD AT RED' : 'AUTO RELEASED'}`);
            return;
          }

          if (!this.nxEntryNodeId) {
            this.nxEntryNodeId = node.id;
            this.onStatusFeedback?.(`NX ENTRY SELECTED: ${node.name} — Click destination EXIT signal to lock route (or Shift+Click to hold RED)`);
          } else if (this.nxEntryNodeId === node.id) {
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
        if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.4 && Math.abs(e.deltaX) > 2) {
          this.camX -= e.deltaX;
          this.camY -= e.deltaY;
          return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const worldBefore = this.screenToWorld(sx, sy);

        const factor = e.deltaY < 0 ? 1.11 : 0.9;
        this.zoom = Math.max(0.22, Math.min(2.4, this.zoom * factor));

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
    if (!n1) return { x: 1040, y: 840, angle: 0 };
    if (!n2 || t.edgeProgress <= 0.01) {
      return { x: n1.x, y: n1.y, angle: 0 };
    }
    const edge = t.currentEdgeId ? this.sim.edgeMap[t.currentEdgeId] : undefined;
    const pts = this.getEdgePolyline(n1, n2, edge);
    return this.interpolatePolyline(pts, t.edgeProgress);
  }

  public render() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = rect ? rect.width : this.canvas.width;
    const h = rect ? rect.height : this.canvas.height;

    const ctx = this.ctx;
    ctx.fillStyle = '#070B10';
    ctx.fillRect(0, 0, w, h);

    this.drawGrid(w, h);

    ctx.save();
    ctx.translate(this.camX, this.camY);
    ctx.scale(this.zoom, this.zoom);

    // 1. Draw River Thames schematic ribbon & Engineering/SOP Enclosure Boxes
    this.drawThamesAndZones();

    // 2. Draw all Track Edges (0° / 45° / 90° IECC polylines, WIQ bypass, tunnels, crossovers)
    this.drawTracks();

    // 3. Draw CBTC Moving-Block Braking Footprints (when toggled ON)
    if (this.sim.showCbtcOverlays) {
      this.drawCbtcFootprints();
    }

    // 4. Draw Stations, Platform Berths, Road Pill Tags, and Signal Lamps
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

    ctx.beginPath();
    ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

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
    const step = 56 * this.zoom;
    if (step < 14) return;

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

    ctx.save();
    // Stylized River Thames Ribbon (Orthogonal + 45° Chamfer):
    // - Crosses South Spine between Island Gardens (y=1585) and Cutty Sark (y=1715) at y=1650
    // - Rises at 45° to y=1120 in the East Sector, passing directly between King George V (y=980, North Bank)
    //   and Woolwich Arsenal (y=1260, UNDER/South of the labelled River Thames!)
    const traceThamesPath = () => {
      ctx.beginPath();
      ctx.moveTo(200, 1650);
      ctx.lineTo(1320, 1650);
      ctx.lineTo(1850, 1120);
      ctx.lineTo(3120, 1120);
    };

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
    ctx.lineWidth = 46;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    traceThamesPath();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(8, 47, 73, 0.86)';
    ctx.lineWidth = 36;
    traceThamesPath();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([12, 10]);
    traceThamesPath();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.fillText('🌊 RIVER THAMES — GREENWICH SUB-AQUEOUS BORE (SOP-UG1)', 340, 1654);
    ctx.fillText('🌊 RIVER THAMES — WOOLWICH SUB-AQUEOUS BORE (50 MPH · SOP-UG1)', 1960, 1124);

    // Helper for Engineering / Depot / SOP Enclosure Boxes
    const drawEnclosureBox = (
      x: number,
      y: number,
      w: number,
      h: number,
      title: string,
      subtitle: string,
      borderColor = 'rgba(0, 164, 167, 0.34)',
      bgColor = 'rgba(15, 23, 42, 0.42)',
      titleColor = '#38BDF8'
    ) => {
      ctx.save();
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 7);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillStyle = titleColor;
      ctx.fillText(title, x + 12, y + 17);

      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(subtitle, x + 12, y + 31);
      ctx.restore();
    };

    // 1. Bank Deep-Tube Bore & Tail Headshunt SOP Box
    drawEnclosureBox(
      32,
      650,
      290,
      125,
      'BANK DEEP-TUBE COMPLEX (SOP-UG1 / UG2)',
      '1:20 Dive · 1 Train/Bore · Single Tail Headshunt (BNK_HSH)',
      'rgba(56, 189, 248, 0.38)',
      'rgba(15, 23, 42, 0.42)',
      '#38BDF8'
    );

    // 2. Tower Gateway Viaduct & Minories 2-Car Lockout Box
    drawEnclosureBox(
      115,
      892,
      290,
      105,
      'TOWER GATEWAY (SOP-TWG: 2-CAR 60m MAX)',
      'Spanish-Solution Dual Platforms · 3-Car Sets Locked Out',
      'rgba(245, 158, 11, 0.45)',
      'rgba(28, 22, 14, 0.42)',
      '#FBBF24'
    );

    // 3. Clean Geometric Westferry – Poplar – West India Quay Delta & CAW->WFE Bypass Box
    drawEnclosureBox(
      750,
      770,
      685,
      315,
      'POPLAR – WESTFERRY – WIQ DELTA & BYPASS (SOP-WIQ)',
      'Westbound CAW→WFE Track Bypasses WIQ (No Platform) · 3 Grade-Separated Chords · POP Turnback Pocket',
      'rgba(0, 164, 167, 0.42)',
      'rgba(12, 24, 34, 0.42)',
      '#22D3EE'
    );

    // 4. Stratford International (STI) & Stratford Regional (STR) Orthogonal Olympic Arch Box
    drawEnclosureBox(
      920,
      -5,
      940,
      235,
      'STRATFORD INTL (STI) & STRATFORD REGIONAL (STR) OLYMPIC COMPLEX',
      'STI Olympic Tail Siding · STR Central Hub · West Fork to P4A/B Bays (Bow/Poplar) · East Fork to Market X-Over (Lea Valley)',
      'rgba(16, 185, 129, 0.42)',
      'rgba(12, 26, 24, 0.42)',
      '#34D399'
    );

    // 5. Clean 3-Road Horizontal Poplar Depot & Worksite Fork
    drawEnclosureBox(
      1150,
      480,
      485,
      230,
      'POPLAR DEPOT & WORKSITE FAN (PDP)',
      '3 Parallel Horizontal Stabling & Lifting Roads (PDP_S1–S3) + Vertical Reception Lead',
      'rgba(168, 85, 247, 0.4)',
      'rgba(23, 15, 36, 0.4)',
      '#C084FC'
    );

    // 6. Clean 4-Road Horizontal Beckton Depot & Terminus Complex
    drawEnclosureBox(
      2095,
      45,
      985,
      385,
      'BECKTON DEPOT (BDP) & GALLIONS REACH COMPLEX',
      '4 Parallel Stabling/Lathe/Wash Roads (BDP_R1–R4) · Vertical East & West Ladders · BCK Tail Siding',
      'rgba(16, 185, 129, 0.4)',
      'rgba(12, 26, 24, 0.4)',
      '#34D399'
    );

    // 7. Woolwich Arsenal Sub-Surface Box (Under / South of the Labelled River Thames!)
    drawEnclosureBox(
      2660,
      1185,
      365,
      125,
      'WOOLWICH ARSENAL SUB-SURFACE BOX (SOP-UG1 · SOUTH BANK)',
      '50 mph Under-River Thames Bore from KGV · P3/P4 Island Box · WOO Tail Siding',
      'rgba(56, 189, 248, 0.42)',
      'rgba(12, 23, 38, 0.45)',
      '#38BDF8'
    );

    // Sector header watermarks on schematic
    ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.font = '800 17px "JetBrains Mono", monospace';
    ctx.fillText('CITY & ROYAL MINT ST WEST THROAT', 45, 625);
    ctx.fillText('ISLE OF DOGS & LEWISHAM SOUTH', 720, 2055);
    ctx.fillText('ROYAL DOCKS, EXCEL & BECKTON LOOP', 2060, 640);
    ctx.fillText('LONDON CITY AIRPORT & NORTH WOOLWICH', 2060, 925);
    ctx.restore();
  }

  private drawTracks() {
    const ctx = this.ctx;

    const occupiedEdgeIds = new Set<string>();
    for (const t of this.sim.trains) {
      if (t.currentEdgeId) occupiedEdgeIds.add(t.currentEdgeId);
    }

    const wiqBypassEdgeIds = new Set([
      'E_CAW_BYP_UP',
      'E_CAWMID_BYP_UP',
      'E_BYP_WFE_UP',
    ]);

    for (const edge of this.sim.edges) {
      const n1 = this.sim.nodeMap[edge.from];
      const n2 = this.sim.nodeMap[edge.to];
      if (!n1 || !n2) continue;

      const isOccupied = occupiedEdgeIds.has(edge.id);
      const isManualRoute = this.sim.manualRoutes[edge.from] === edge.to;
      const isBlocked = n1.trackBlocked || n2.trackBlocked;
      const isWiqBypass = wiqBypassEdgeIds.has(edge.id);

      // For station UP<->DN turnback crossovers, draw a clean 45° IECC scissor symbol instead of a perpendicular bar
      if (
        edge.isCrossover &&
        n1.stationId &&
        n1.stationId === n2.stationId &&
        n1.type === 'platform' &&
        n2.type === 'platform'
      ) {
        // Only draw once per station pair (when from = _DN) unless manually locked
        if (edge.from.endsWith('_UP') && !isManualRoute) continue;
        const cx = (n1.x + n2.x) * 0.5;
        const cy = (n1.y + n2.y) * 0.5;
        const isVert = Math.abs(n1.x - n2.x) > Math.abs(n1.y - n2.y);
        const dx = isVert ? Math.abs(n2.x - n1.x) * 0.5 : 12;
        const dy = isVert ? 12 : Math.abs(n2.y - n1.y) * 0.5;

        ctx.save();
        ctx.strokeStyle = isManualRoute ? '#38BDF8' : 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = isManualRoute ? 2.6 : 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(cx - dx, cy - dy);
        ctx.lineTo(cx + dx, cy + dy);
        ctx.moveTo(cx - dx, cy + dy);
        ctx.lineTo(cx + dx, cy - dy);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      const pts = this.getEdgePolyline(n1, n2, edge);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }

      if (edge.isCrossover) {
        ctx.strokeStyle = isManualRoute ? '#38BDF8' : 'rgba(148, 163, 184, 0.34)';
        ctx.lineWidth = isManualRoute ? 3 : 1.8;
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash(edge.isTunnel ? [8, 5] : isWiqBypass ? [9, 3] : []);
        if (isBlocked) {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 4;
        } else if (isOccupied) {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 4.2;
        } else if (isManualRoute) {
          ctx.strokeStyle = '#F8FAFC';
          ctx.lineWidth = 4.0;
        } else if (isWiqBypass) {
          ctx.strokeStyle = '#0891B2';
          ctx.lineWidth = 3.8;
        } else if (edge.isFlyover) {
          ctx.strokeStyle = '#2E4760';
          ctx.lineWidth = 3.5;
        } else {
          ctx.strokeStyle = '#263547';
          ctx.lineWidth = 3.2;
        }
      }

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.setLineDash([]);

      // Pill-backed inline edge label for tunnels/bypass/chords
      if (edge.edgeLabel) {
        const mid = this.interpolatePolyline(pts, 0.5);
        let mx = mid.x;
        let my = mid.y - 14;

        if (edge.id === 'E_KGV_WOO_DN') {
          mx += 125;
          my -= 4;
        } else if (edge.id === 'E_ISG_CUT_DN') {
          mx += 130;
          my += 14;
        } else if (edge.id === 'E_CAW_BYP_UP') {
          mx -= 65;
          my += 20;
        } else if (edge.id === 'E_WFE_WIQ_DN') {
          mx -= 55;
          my -= 6;
        } else if (edge.id === 'E_STI_STR_DN') {
          mx += 95;
          my += 12;
        } else if (edge.id === 'E_BNK_RMJ_DN') {
          my -= 12;
        } else if (edge.id === 'E_TWG_THROAT_RMJ_DN') {
          my += 28;
        }

        ctx.save();
        ctx.font = '700 8.8px "JetBrains Mono", monospace';
        const tw = ctx.measureText(edge.edgeLabel).width + 12;
        ctx.fillStyle = 'rgba(7, 11, 16, 0.9)';
        ctx.strokeStyle = isWiqBypass ? 'rgba(34, 211, 238, 0.45)' : 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mx - tw / 2, my - 7.5, tw, 15, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isWiqBypass ? '#67E8F9' : '#CBD5E1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(edge.edgeLabel, mx, my);
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

      const edge = t.currentEdgeId ? this.sim.edgeMap[t.currentEdgeId] : undefined;
      const pts = this.getEdgePolyline(n1, n2, edge);
      const pStart = this.interpolatePolyline(pts, t.edgeProgress);
      const pMid = this.interpolatePolyline(pts, Math.min(1.0, t.edgeProgress + 0.19));
      const pEnd = this.interpolatePolyline(pts, Math.min(1.0, t.edgeProgress + 0.38));

      ctx.save();
      ctx.strokeStyle = t.psaMode ? 'rgba(245, 158, 11, 0.55)' : 'rgba(16, 185, 129, 0.48)';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pMid.x, pMid.y);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawStationsAndSignals() {
    const ctx = this.ctx;

    // 1. Draw platform nodes, depot stabling berths, Delta junctions & signals
    for (const node of this.sim.nodes) {
      if (node.type === 'depot' || node.type === 'siding') {
        ctx.save();
        ctx.fillStyle = '#0F1B29';
        ctx.strokeStyle = node.type === 'depot' ? '#A855F7' : '#22D3EE';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(node.x - 18, node.y - 6, 36, 12, 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (node.id === 'DLT_BYP_UP') {
        ctx.save();
        ctx.fillStyle = '#083344';
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(node.x - 14, node.y - 6, 28, 12, 3);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = node.trackBlocked ? '#EF4444' : '#475569';
        ctx.fillRect(node.x - 4, node.y - 4, 8, 8);
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

    // 2. Draw crisp pill-backed labels for broken-out depot roads, Delta chords, bypass & headshunts
    for (const node of this.sim.nodes) {
      if (!node.roadLabel) continue;
      ctx.save();
      ctx.font = '700 9px "JetBrains Mono", monospace';
      const tw = ctx.measureText(node.roadLabel).width + 12;

      let rx = node.x;
      let ry = node.y - 16;
      if (node.id === 'CAW_MID') {
        rx = node.x + 96;
        ry = node.y;
      } else if (node.id === 'DLT_BYP_UP') {
        rx = node.x - 24;
        ry = node.y - 17;
      } else if (node.id === 'PDP_THROAT') {
        rx = node.x - 36;
        ry = node.y - 16;
      } else if (node.id === 'BDP_W_LEAD' || node.id === 'BDP_E_LEAD') {
        ry = node.y + 18;
      }

      ctx.fillStyle = 'rgba(8, 13, 21, 0.92)';
      ctx.strokeStyle =
        node.type === 'depot'
          ? 'rgba(168, 85, 247, 0.5)'
          : node.type === 'siding'
          ? 'rgba(34, 211, 238, 0.45)'
          : 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(rx - tw / 2, ry - 7.5, tw, 15, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle =
        node.type === 'depot'
          ? '#E9D5FF'
          : node.type === 'siding'
          ? '#67E8F9'
          : '#FDE68A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.roadLabel, rx, ry);
      ctx.restore();
    }

    // 3. Draw station rings, labels, and badges
    for (const st of this.sim.stations) {
      const isSelected = this.selectedStation?.id === st.id;
      const isHovered = this.hoveredStation?.id === st.id;
      const crowdMult = this.sim.stationCrowdMultiplier[st.id] || 1.0;
      const hasIncident = this.sim.incidents.some((inc) => !inc.resolved && inc.stationId === st.id);

      ctx.save();
      ctx.beginPath();
      ctx.arc(st.x, st.y, isSelected || isHovered ? 9 : 6.5, 0, Math.PI * 2);
      ctx.fillStyle = hasIncident ? '#EF4444' : crowdMult > 1.3 ? '#F59E0B' : '#00A4A7';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isSelected ? '#FFFFFF' : '#0F172A';
      ctx.stroke();

      let lx = st.x;
      let ly = st.y - 24;
      ctx.textAlign = 'center';

      if (st.labelPos === 'bottom') {
        ly = st.y + 32;
      } else if (st.labelPos === 'left') {
        lx = st.x - 28;
        ly = st.y + 4;
        ctx.textAlign = 'right';
      } else if (st.labelPos === 'right') {
        lx = st.x + 28;
        ly = st.y + 4;
        ctx.textAlign = 'left';
      }

      ctx.font = isSelected || isHovered ? '700 13px "JetBrains Mono", monospace' : '600 12px "JetBrains Mono", monospace';
      ctx.fillStyle = isSelected ? '#38BDF8' : hasIncident ? '#FCA5A5' : '#E2E8F0';
      const carTag = st.maxCars === 2 ? ' [2C]' : st.id === 'WIQ' ? ' [NO BNK UP]' : '';
      ctx.fillText(`${st.code} · ${st.name}${carTag}`, lx, ly);

      if (crowdMult > 1.3) {
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
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

      const pw = 66;
      const ph = 22;

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

      ctx.fillStyle = t.color;
      ctx.fillRect(-pw / 2 + 2, -ph / 2 + 2, 4.5, ph - 4);

      ctx.font = '700 11.5px "JetBrains Mono", monospace';
      ctx.fillStyle = isBroken ? '#FCA5A5' : t.psaMode ? '#FDE68A' : '#F8FAFC';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.headcode, 2, 0);

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
