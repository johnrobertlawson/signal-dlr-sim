import {
  Station,
  TrackNode,
  TrackEdge,
  ServiceTemplate,
  Train,
  ActiveIncident,
  ContingencyPlan,
  LogEntry,
} from './types';
import { STATIONS, STATION_MAP, buildNetworkGraph, INITIAL_TEMPLATES, CONTINGENCY_PLANS } from './dlrData';
import { soundEngine } from './audio';

export class DLRSimulation {
  public stations: Station[] = STATIONS;
  public nodes: TrackNode[] = [];
  public nodeMap: Record<string, TrackNode> = {};
  public edges: TrackEdge[] = [];
  public edgeMap: Record<string, TrackEdge> = {};
  public adjacency: Record<string, TrackEdge[]> = {};

  public templates: ServiceTemplate[] = JSON.parse(JSON.stringify(INITIAL_TEMPLATES));
  public contingencies: ContingencyPlan[] = JSON.parse(JSON.stringify(CONTINGENCY_PLANS));
  public trains: Train[] = [];
  public incidents: ActiveIncident[] = [];
  public logs: LogEntry[] = [];

  // Time & Simulation Speed
  public simTimeSeconds: number = 7 * 3600 + 30 * 60; // 07:30:00 morning peak start
  public timeScale: number = 1; // 0 = Pause, 0.5 = Slow, 1 = Normal, 4 = Fast, 10 = Ultra
  public arsEnabled: boolean = true;
  public showCbtcOverlays: boolean = true;
  public singleLineWorkingActive: boolean = true; // Bi-directional SLW around blocked tracks

  // Telemetry & Analytics
  public totalArrivals: number = 42;
  public onTimeArrivals: number = 40;
  public totalPassengersCarried: number = 14820;
  public stationFootfall: Record<string, number> = {};
  public rareRoutesCompleted: { headcode: string; routeDesc: string; timeStr: string }[] = [
    { headcode: '902 CAW', routeDesc: 'Beckton Depot → Canary Wharf P3 (ECS Positioning)', timeStr: '07:14' },
    { headcode: '714 LCA', routeDesc: 'Stratford → London City Airport (Farnborough Airshow Charter)', timeStr: '07:22' },
  ];

  // Track last spawn time per template (and reverse direction)
  private lastSpawnFwd: Record<string, number> = {};
  private lastSpawnRev: Record<string, number> = {};
  private serviceCounter: Record<string, number> = {
    '1': 101,
    '2': 201,
    '3': 301,
    '4': 401,
    '5': 501,
    '6': 601,
    '7': 701,
    '9': 901,
  };

  // Manual NX Route Lock overrides (fromNodeId -> toNodeId)
  public manualRoutes: Record<string, string> = {};

  // Dynamic crowd multipliers per station (e.g., ExCeL show, Airport surge, Canary Wharf convention)
  public stationCrowdMultiplier: Record<string, number> = {};

  public onStateChange?: () => void;

  constructor() {
    const graph = buildNetworkGraph();
    this.nodes = graph.nodes;
    this.edges = graph.edges;

    for (const n of this.nodes) {
      this.nodeMap[n.id] = n;
    }
    for (const e of this.edges) {
      this.edgeMap[e.id] = e;
      if (!this.adjacency[e.from]) this.adjacency[e.from] = [];
      this.adjacency[e.from].push(e);
    }

    for (const st of this.stations) {
      this.stationFootfall[st.id] = Math.floor(st.baseDemand * 180 + Math.random() * 90);
      this.stationCrowdMultiplier[st.id] = 1.0;
    }

    this.seedInitialTrains();
    this.seedInitialIncidents();
    this.addLog('ARS', 'SelTrac CBTC Moving-Block Supervision & ARS initialised across all 7 DLR branches.');
  }

  public formatSimTime(sec = this.simTimeSeconds): string {
    const totalSec = Math.floor(sec) % 86400;
    const hh = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const mm = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const ss = Math.floor(totalSec % 60).toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  public addLog(category: LogEntry['category'], message: string) {
    this.logs.unshift({
      id: `LOG_${Date.now()}_${Math.random()}`,
      simTimeStr: this.formatSimTime(),
      category,
      message,
    });
    if (this.logs.length > 60) {
      this.logs.pop();
    }
  }

  // Dijkstra shortest path between two TrackNodes, considering train car length & blocked tracks
  public findNodePath(startNodeId: string, targetStationId: string, cars: 2 | 3, allowSLW = true): string[] {
    const targetCandidates = [`${targetStationId}_DN`, `${targetStationId}_UP`];
    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const visited = new Set<string>();

    for (const n of this.nodes) {
      dist[n.id] = Infinity;
      prev[n.id] = null;
    }
    dist[startNodeId] = 0;

    while (true) {
      let u: string | null = null;
      let bestDist = Infinity;
      for (const id in dist) {
        if (!visited.has(id) && dist[id] < bestDist) {
          bestDist = dist[id];
          u = id;
        }
      }
      if (!u || bestDist === Infinity) break;
      if (targetCandidates.includes(u) && u !== startNodeId) {
        // Reconstruct path
        const path: string[] = [];
        let curr: string | null = u;
        while (curr) {
          path.unshift(curr);
          curr = prev[curr];
        }
        return path;
      }

      visited.add(u);

      // Check outgoing edges
      const outgoing = this.adjacency[u] || [];
      for (const edge of outgoing) {
        const nextNode = this.nodeMap[edge.to];
        if (!nextNode) continue;

        // If node is blocked or points failed, heavily penalize or skip
        if (nextNode.trackBlocked) {
          if (!allowSLW) continue;
        }
        if (nextNode.pointsFailed && edge.isCrossover) continue;

        // Check manual NX lock at u
        let cost = edge.lengthMeters;
        if (this.manualRoutes[u] && this.manualRoutes[u] === edge.to) {
          cost *= 0.1; // Prioritise player's explicit NX route
        }
        if (edge.isCrossover) {
          cost += 400; // Prefer staying on main running line unless turning back or SLW diverting
        }
        if (nextNode.trackBlocked) {
          cost += 50000; // Avoid blocked tracks if alternate SLW track exists
        }
        // Platform car length restriction check at terminus (e.g. Tower Gateway is 2-car max!)
        if (nextNode.stationId === 'TWG' && cars > 2) {
          cost += 100000; // 3-car trains cannot enter Tower Gateway
        }

        const alt = dist[u] + cost;
        if (alt < dist[edge.to]) {
          dist[edge.to] = alt;
          prev[edge.to] = u;
        }
      }
    }

    return [startNodeId];
  }

  private buildFullNodePathForStations(startNodeId: string, stationIds: string[], cars: 2 | 3): string[] {
    const fullPath: string[] = [startNodeId];
    let currNode = startNodeId;

    for (const stId of stationIds) {
      if (this.nodeMap[currNode]?.stationId === stId) continue;
      const segment = this.findNodePath(currNode, stId, cars, this.singleLineWorkingActive);
      if (segment.length > 1) {
        for (let i = 1; i < segment.length; i++) {
          fullPath.push(segment[i]);
        }
        currNode = segment[segment.length - 1];
      }
    }
    return fullPath;
  }

  private seedInitialTrains() {
    // Spawn 14 initial trains distributed smoothly across all 7 branches
    const initialPlacements: {
      templateIndex: number;
      reverse: boolean;
      startStationIdx: number;
    }[] = [
      { templateIndex: 0, reverse: false, startStationIdx: 2 }, // LIM -> LEW
      { templateIndex: 0, reverse: false, startStationIdx: 7 }, // HER -> LEW
      { templateIndex: 0, reverse: true, startStationIdx: 12 }, // GRE -> BNK
      { templateIndex: 0, reverse: true, startStationIdx: 5 },  // CAW -> BNK
      { templateIndex: 1, reverse: false, startStationIdx: 4 }, // POP -> WOO
      { templateIndex: 1, reverse: true, startStationIdx: 10 }, // LCA -> BNK
      { templateIndex: 2, reverse: false, startStationIdx: 0 }, // TWG -> BCK
      { templateIndex: 2, reverse: false, startStationIdx: 9 }, // CUH -> BCK
      { templateIndex: 2, reverse: true, startStationIdx: 13 }, // CYP -> TWG
      { templateIndex: 3, reverse: false, startStationIdx: 2 }, // BOW -> LEW
      { templateIndex: 3, reverse: true, startStationIdx: 9 },  // CRH -> STR
      { templateIndex: 4, reverse: false, startStationIdx: 1 }, // SHS -> WOO
      { templateIndex: 4, reverse: true, startStationIdx: 7 },  // WSV -> STI
      { templateIndex: 5, reverse: false, startStationIdx: 1 }, // GAL -> CAW (ECS)
    ];

    initialPlacements.forEach((p) => {
      const tpl = this.templates[p.templateIndex];
      if (!tpl) return;
      const stations = p.reverse ? [...tpl.routeStations].reverse() : [...tpl.routeStations];
      const remainingStations = stations.slice(p.startStationIdx);
      if (remainingStations.length < 2) return;

      const startSt = remainingStations[0];
      const destSt = remainingStations[remainingStations.length - 1];
      const dirSuffix = p.reverse ? 'UP' : 'DN';
      const startNodeId = `${startSt}_${dirSuffix}`;

      this.spawnTrainFromRoute(tpl, startNodeId, remainingStations, destSt);
    });

    // Initialize spawn timers
    for (const tpl of this.templates) {
      this.lastSpawnFwd[tpl.id] = this.simTimeSeconds;
      this.lastSpawnRev[tpl.id] = this.simTimeSeconds - (tpl.intervalMins * 30);
    }
  }

  public spawnTrainFromRoute(
    tpl: ServiceTemplate,
    startNodeId: string,
    routeStations: string[],
    destSt: string,
    customReason?: string
  ): Train | null {
    // Check if another train is already sitting at startNodeId
    const occupied = this.trains.some((t) => t.currentNodeId === startNodeId && t.edgeProgress < 0.35);
    if (occupied) return null;

    const prefix = tpl.codePrefix || '1';
    const num = this.serviceCounter[prefix] || 101;
    this.serviceCounter[prefix] = num + 1;
    if (this.serviceCounter[prefix] % 100 > 98) {
      this.serviceCounter[prefix] = parseInt(prefix, 10) * 100 + 1;
    }

    const serviceNumber = `${num}`;
    const destCode = destSt;
    const headcode = `${serviceNumber} ${destCode}`;
    const nodePath = this.buildFullNodePathForStations(startNodeId, routeStations, tpl.cars);
    const nextNodeId = nodePath.length > 1 ? nodePath[1] : null;
    const firstEdge = nextNodeId ? this.findEdge(startNodeId, nextNodeId) : null;

    const maxCap = tpl.cars === 3 ? 780 : 520;
    const initPax = tpl.isECS ? 0 : Math.floor(85 + Math.random() * 240);

    const train: Train = {
      id: `TR_${serviceNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      headcode,
      serviceNumber,
      destCode,
      originCode: routeStations[0],
      templateId: tpl.id,
      cars: tpl.cars,
      isECS: !!tpl.isECS,
      psaMode: false,
      state: 'DWELLING',
      currentNodeId: startNodeId,
      nextNodeId,
      currentEdgeId: firstEdge ? firstEdge.id : null,
      edgeProgress: 0,
      speedMph: 0,
      targetSpeedMph: firstEdge ? firstEdge.maxSpeedMph : 35,
      routeQueue: [...routeStations.slice(1)],
      nodePath,
      delaySeconds: Math.floor(Math.random() * 25),
      dwellRemaining: 8,
      passengers: initPax,
      maxCapacity: maxCap,
      color: tpl.color,
      breakdownReason: customReason,
    };

    this.trains.push(train);
    return train;
  }

  private findEdge(fromId: string, toId: string): TrackEdge | null {
    const list = this.adjacency[fromId] || [];
    return list.find((e) => e.to === toId) || null;
  }

  private seedInitialIncidents() {
    // Seed 2 realistic active scenarios in the Action Inset so the user immediately has engaging decisions to make
    const cawTrain = this.trains.find((t) => t.destCode === 'LEW') || this.trains[0];

    this.incidents = [
      {
        id: 'INC_SEED_1',
        title: 'SelTrac VOBC Loss of Comms — Mudchute (MUD)',
        description:
          'Train 102 LEW has lost automated moving-block telemetry approaching Mudchute Platform 2. Automatic driving is inhibited; queue building through Canary Wharf.',
        severity: 'CRITICAL',
        stationId: 'MUD',
        nodeId: 'MUD_DN',
        trainId: cawTrain?.id,
        timestamp: this.simTimeSeconds - 45,
        resolved: false,
        actions: [
          {
            id: 'ACT_PSA_1',
            label: 'Dispatch PSA to Manual-Drive (18 mph)',
            description: 'Unlocks front control desk for Passenger Service Agent recovery to Island Gardens/Lewisham',
            effectType: 'DISPATCH_PSA',
            targetId: cawTrain?.id,
          },
          {
            id: 'ACT_CP_CAW',
            label: 'Activate Plan A: Short-Turn at Canary Wharf',
            description: 'Reverses following Lewisham services at Canary Wharf P2/P3 crossover to clear Isle of Dogs backlog',
            effectType: 'ACTIVATE_CONTINGENCY',
            contingencyId: 'CP_SHORT_CAW',
          },
        ],
      },
      {
        id: 'INC_SEED_2',
        title: 'London City Airport Charter Surge + ExCeL Keynote',
        description:
          'Heavy passenger inflows reported at London City Airport (LCA) and Custom House (CUH). Platform dwell times increasing by +45% on Eastbound branches.',
        severity: 'WARNING',
        stationId: 'LCA',
        nodeId: 'LCA_UP',
        timestamp: this.simTimeSeconds - 20,
        resolved: false,
        actions: [
          {
            id: 'ACT_BOOST_LCA',
            label: 'Insert 3-Car Airport Relief Shuttle (CNT ↔ LCA)',
            description: 'Dispatches an immediate 3-car B23 relief unit from Canning Town to London City Airport',
            effectType: 'BOOST_SERVICE',
            targetId: 'LCA',
          },
          {
            id: 'ACT_CLEAR_SURGE',
            label: 'Deploy Platform Crowd Control PSAs',
            description: 'Station staff assist door closing at LCA & CUH, normalising dwell times',
            effectType: 'CLEAR_FAULT',
            targetId: 'LCA',
          },
        ],
      },
    ];

    // Put the first Lewisham train into BROKEN_DOWN state to match INC_SEED_1
    if (cawTrain) {
      cawTrain.state = 'BROKEN_DOWN';
      cawTrain.speedMph = 0;
      cawTrain.breakdownReason = 'VOBC Telemetry Fault — Awaiting PSA Key-In';
    }
    this.stationCrowdMultiplier['LCA'] = 1.65;
    this.stationCrowdMultiplier['CUH'] = 1.55;
  }

  // Main simulation tick (dt in real seconds)
  public tick(dtRealSeconds: number) {
    if (this.timeScale <= 0) return;
    const dtSim = dtRealSeconds * this.timeScale;
    this.simTimeSeconds += dtSim;

    // 1. Check automatic timetable spawning
    this.updateTimetableSpawns();

    // 2. Update signal aspects based on track occupation & CBTC moving blocks
    this.updateSignalAspects();

    // 3. Move and regulate trains
    for (let i = this.trains.length - 1; i >= 0; i--) {
      const train = this.trains[i];
      this.updateTrain(train, dtSim);
    }
  }

  private updateTimetableSpawns() {
    for (const tpl of this.templates) {
      if (!tpl.active) continue;
      const intervalSec = Math.max(90, tpl.intervalMins * 60);

      // Forward spawn
      const lastFwd = this.lastSpawnFwd[tpl.id] || 0;
      if (this.simTimeSeconds - lastFwd >= intervalSec) {
        this.lastSpawnFwd[tpl.id] = this.simTimeSeconds;
        const stations = this.applyActiveContingenciesToRoute([...tpl.routeStations]);
        if (stations.length >= 2) {
          const startNode = `${stations[0]}_DN`;
          this.spawnTrainFromRoute(tpl, startNode, stations, stations[stations.length - 1]);
        }
      }

      // Reverse spawn (unless one-way ECS positioning)
      if (!tpl.isECS) {
        const lastRev = this.lastSpawnRev[tpl.id] || 0;
        if (this.simTimeSeconds - lastRev >= intervalSec) {
          this.lastSpawnRev[tpl.id] = this.simTimeSeconds;
          const revStations = this.applyActiveContingenciesToRoute([...tpl.routeStations].reverse());
          if (revStations.length >= 2) {
            const startNode = `${revStations[0]}_UP`;
            this.spawnTrainFromRoute(tpl, startNode, revStations, revStations[revStations.length - 1]);
          }
        }
      }
    }
  }

  private applyActiveContingenciesToRoute(route: string[]): string[] {
    let mod = [...route];

    // Plan A: Short-turn Lewisham trains at Canary Wharf
    const planA = this.contingencies.find((c) => c.id === 'CP_SHORT_CAW' && c.active);
    if (planA && mod[mod.length - 1] === 'LEW' && mod.includes('CAW')) {
      const idx = mod.indexOf('CAW');
      mod = mod.slice(0, idx + 1);
    }

    // Plan B: Divert Bank trains to Tower Gateway / Shadwell
    const planB = this.contingencies.find((c) => c.id === 'CP_DIVERT_TWG_BNK' && c.active);
    if (planB && mod[mod.length - 1] === 'BNK') {
      mod[mod.length - 1] = 'TWG';
    }

    // Plan C: Short-turn Beckton trains at Custom House
    const planC = this.contingencies.find((c) => c.id === 'CP_BECKTON_CUH' && c.active);
    if (planC && mod[mod.length - 1] === 'BCK' && mod.includes('CUH')) {
      const idx = mod.indexOf('CUH');
      mod = mod.slice(0, idx + 1);
    }

    // Plan D: Short-turn Woolwich trains at London City Airport
    const planD = this.contingencies.find((c) => c.id === 'CP_AIRPORT_LCA' && c.active);
    if (planD && mod[mod.length - 1] === 'WOO' && mod.includes('LCA')) {
      const idx = mod.indexOf('LCA');
      mod = mod.slice(0, idx + 1);
    }

    return mod;
  }

  private updateSignalAspects() {
    const occupiedNodes = new Set<string>();
    for (const t of this.trains) {
      occupiedNodes.add(t.currentNodeId);
      if (t.edgeProgress > 0.55 && t.nextNodeId) {
        occupiedNodes.add(t.nextNodeId);
      }
    }

    for (const node of this.nodes) {
      if (node.signalHeld || node.trackBlocked || node.pointsFailed) {
        node.signalAspect = 'RED';
      } else if (occupiedNodes.has(node.id)) {
        node.signalAspect = 'RED';
      } else {
        // Check if any immediate downstream node is occupied
        const out = this.adjacency[node.id] || [];
        const downstreamOccupied = out.some((e) => occupiedNodes.has(e.to));
        node.signalAspect = downstreamOccupied ? 'AMBER' : 'GREEN';
      }
    }
  }

  private updateTrain(train: Train, dtSim: number) {
    // 1. Broken down train
    if (train.state === 'BROKEN_DOWN') {
      train.speedMph = 0;
      train.delaySeconds += dtSim;
      return;
    }

    const currNode = this.nodeMap[train.currentNodeId];

    // 2. Dwelling at station platform
    if (train.state === 'DWELLING' || train.state === 'TURNBACK') {
      train.speedMph = 0;
      train.dwellRemaining -= dtSim;
      if (train.dwellRemaining > 0) {
        return;
      }

      // Ready to depart! Check signal & next node
      if (currNode && currNode.signalHeld) {
        train.state = 'HELD_AT_SIGNAL';
        train.delaySeconds += dtSim;
        return;
      }

      // Check if we reached final destination
      if (train.nodePath.length <= 1) {
        this.completeTrainJourney(train);
        return;
      }

      const nextNodeId = train.nodePath[1];
      const nextEdge = this.findEdge(train.currentNodeId, nextNodeId);
      if (!nextEdge) {
        this.completeTrainJourney(train);
        return;
      }

      // Check CBTC safe braking distance ahead (is another train too close on nextEdge or at nextNode?)
      if (this.isBlockAheadOccupied(train, nextNodeId)) {
        train.state = 'CBTC_BRAKING';
        train.delaySeconds += dtSim;
        return;
      }

      train.nextNodeId = nextNodeId;
      train.currentEdgeId = nextEdge.id;
      train.edgeProgress = 0.01;
      train.state = train.psaMode ? 'PSA_RECOVERY' : 'MOVING';
    }

    // 3. Held at red signal or CBTC braking
    if (train.state === 'HELD_AT_SIGNAL' || train.state === 'CBTC_BRAKING') {
      train.speedMph = 0;
      train.delaySeconds += dtSim;
      if (currNode && !currNode.signalHeld && train.nextNodeId && !this.isBlockAheadOccupied(train, train.nextNodeId)) {
        train.state = train.psaMode ? 'PSA_RECOVERY' : 'MOVING';
      } else {
        return;
      }
    }

    // 4. Moving along current edge
    const edge = train.currentEdgeId ? this.edgeMap[train.currentEdgeId] : null;
    if (!edge || !train.nextNodeId) {
      this.completeTrainJourney(train);
      return;
    }

    // Check CBTC moving-block distance to preceding train on the same edge or next node
    const cbtcLimit = this.computeCbtcSpeedLimit(train, edge);
    const maxAllowed = train.psaMode ? Math.min(18, edge.maxSpeedMph) : Math.min(cbtcLimit, edge.maxSpeedMph);
    train.targetSpeedMph = maxAllowed;

    // Smooth acceleration/deceleration
    if (train.speedMph < train.targetSpeedMph) {
      train.speedMph = Math.min(train.targetSpeedMph, train.speedMph + 12 * dtSim);
    } else if (train.speedMph > train.targetSpeedMph) {
      train.speedMph = Math.max(train.targetSpeedMph, train.speedMph - 18 * dtSim);
    }

    if (train.speedMph <= 0.5) {
      train.delaySeconds += dtSim * 0.8;
    }

    const speedMetersPerSec = train.speedMph * 0.44704;
    const distCovered = speedMetersPerSec * dtSim;
    const progressDelta = distCovered / Math.max(120, edge.lengthMeters);
    train.edgeProgress += progressDelta;

    // Arrived at next node!
    if (train.edgeProgress >= 1.0) {
      train.currentNodeId = train.nextNodeId;
      train.nodePath.shift();
      train.edgeProgress = 0;
      train.speedMph = 0;

      const arrivedNode = this.nodeMap[train.currentNodeId];
      const arrivedStId = arrivedNode?.stationId;

      if (arrivedStId && train.routeQueue[0] === arrivedStId) {
        train.routeQueue.shift();
      }

      if (arrivedStId) {
        const st = STATION_MAP[arrivedStId];
        const crowdMult = this.stationCrowdMultiplier[arrivedStId] || 1.0;

        // Check platform length alert (3-car train at 2-car platform like Cutty Sark / Elverson Rd / Tower Gateway)
        const selectiveDoorPenalty = train.cars === 3 && st && st.maxCars === 2 ? 6 : 0;

        if (!train.isECS && st) {
          const alighting = Math.floor(train.passengers * (0.18 + Math.random() * 0.25));
          const boarding = Math.floor(st.baseDemand * 11 * crowdMult * (0.7 + Math.random() * 0.6));
          train.passengers = Math.min(train.maxCapacity, Math.max(0, train.passengers - alighting + boarding));
          this.totalPassengersCarried += boarding;
          this.stationFootfall[arrivedStId] = (this.stationFootfall[arrivedStId] || 0) + boarding + alighting;
        }

        // Base dwell 14s + crowd effect + SDO penalty
        const baseDwell = train.isECS ? 4 : Math.round((13 + (st ? st.baseDemand * 0.8 : 4)) * crowdMult) + selectiveDoorPenalty;
        train.dwellRemaining = baseDwell;
        train.state = train.nodePath.length <= 1 ? 'TURNBACK' : 'DWELLING';

        if (crowdMult > 1.35) {
          train.delaySeconds += 5;
        } else if (train.delaySeconds > 3) {
          //SelTrac ATO recovers small delays on plain line
          train.delaySeconds = Math.max(0, train.delaySeconds - 3);
        }

        // Update nextNodeId pointer
        if (train.nodePath.length > 1) {
          // Check if player set a manual NX override from this node
          const manualTarget = this.manualRoutes[train.currentNodeId];
          if (manualTarget && this.nodeMap[manualTarget]?.stationId) {
            const newStId = this.nodeMap[manualTarget].stationId!;
            this.rerouteTrainToDestination(train, newStId);
            delete this.manualRoutes[train.currentNodeId]; // Consume one-shot NX route or keep? Consume & log!
          }
          train.nextNodeId = train.nodePath[1];
          const ne = this.findEdge(train.currentNodeId, train.nextNodeId);
          train.currentEdgeId = ne ? ne.id : null;
        } else {
          train.nextNodeId = null;
          train.currentEdgeId = null;
        }
      }
    }
  }

  private isBlockAheadOccupied(train: Train, targetNodeId: string): boolean {
    const targetNode = this.nodeMap[targetNodeId];
    if (targetNode && (targetNode.trackBlocked || targetNode.pointsFailed)) {
      return true;
    }

    for (const other of this.trains) {
      if (other.id === train.id) continue;
      // Another train is dwelling or stopped at targetNodeId
      if (other.currentNodeId === targetNodeId && other.edgeProgress < 0.45) {
        return true;
      }
      // Another train is on the exact same edge right in front of us (< 35% ahead)
      if (other.currentNodeId === train.currentNodeId && other.nextNodeId === targetNodeId && other.edgeProgress < 0.42) {
        return true;
      }
    }
    return false;
  }

  private computeCbtcSpeedLimit(train: Train, edge: TrackEdge): number {
    // Moving-block check: if preceding train is on same edge or sitting at destination node
    for (const other of this.trains) {
      if (other.id === train.id) continue;
      if (other.currentEdgeId === edge.id && other.edgeProgress > train.edgeProgress) {
        const gap = other.edgeProgress - train.edgeProgress;
        if (gap < 0.28) return 0; // Moving-block red wall
        if (gap < 0.55) return 15; // Moving-block caution
      }
      if (other.currentNodeId === train.nextNodeId && other.edgeProgress < 0.35) {
        if (train.edgeProgress > 0.72) return 0; // Hold safely behind platform berth
        if (train.edgeProgress > 0.45) return 15; // Approach aspect
      }
    }
    return edge.maxSpeedMph;
  }

  private completeTrainJourney(train: Train) {
    this.totalArrivals++;
    if (train.delaySeconds <= 120) {
      this.onTimeArrivals++;
    }

    // Remove completed train (or turn it back automatically via template cycle)
    const idx = this.trains.findIndex((t) => t.id === train.id);
    if (idx !== -1) {
      this.trains.splice(idx, 1);
    }
  }

  // Player Action: Set NX Entry-Exit Route between two nodes
  public setManualNXRoute(entryNodeId: string, exitNodeId: string): { ok: boolean; msg: string } {
    const entryNode = this.nodeMap[entryNodeId];
    const exitNode = this.nodeMap[exitNodeId];
    if (!entryNode || !exitNode || !exitNode.stationId) {
      return { ok: false, msg: 'Invalid NX entry/exit signal selection.' };
    }

    const path = this.findNodePath(entryNodeId, exitNode.stationId, 3, true);
    if (path.length < 2) {
      return { ok: false, msg: `No valid interlocked route found from ${entryNode.name} to ${exitNode.name}.` };
    }

    this.manualRoutes[entryNodeId] = exitNodeId;
    entryNode.signalHeld = false;

    // Also immediately apply to any train currently at or approaching entryNodeId
    const affectedTrain = this.trains.find(
      (t) => t.currentNodeId === entryNodeId || t.nextNodeId === entryNodeId
    );
    if (affectedTrain && exitNode.stationId) {
      this.rerouteTrainToDestination(affectedTrain, exitNode.stationId);
    }

    soundEngine.playRelayClick(true);
    const msg = `NX Interlocking: Route locked ${entryNode.stationId} → ${exitNode.stationId} (${path.length - 1} blocks).`;
    this.addLog('NX', msg);
    this.onStateChange?.();
    return { ok: true, msg };
  }

  // Reroute an active train to a new destination or short-turn station
  public rerouteTrainToDestination(train: Train, newDestStationId: string) {
    const startNode = train.edgeProgress > 0.1 && train.nextNodeId ? train.nextNodeId : train.currentNodeId;
    const newPath = this.findNodePath(startNode, newDestStationId, train.cars, true);
    if (newPath.length < 1) return;

    if (train.edgeProgress > 0.1 && train.nextNodeId) {
      train.nodePath = [train.currentNodeId, ...newPath];
    } else {
      train.nodePath = newPath;
      train.nextNodeId = newPath.length > 1 ? newPath[1] : null;
      const edge = train.nextNodeId ? this.findEdge(train.currentNodeId, train.nextNodeId) : null;
      train.currentEdgeId = edge ? edge.id : null;
    }

    const stationSeq: string[] = [];
    for (const nid of train.nodePath) {
      const stId = this.nodeMap[nid]?.stationId;
      if (stId && stationSeq[stationSeq.length - 1] !== stId) {
        stationSeq.push(stId);
      }
    }

    train.routeQueue = stationSeq.slice(1);
    const oldDest = train.destCode;
    train.destCode = newDestStationId;
    train.headcode = `${train.serviceNumber} ${newDestStationId}`;
    train.diverted = true;

    soundEngine.playSplitFlap(5);
    this.addLog('ARS', `Service ${train.serviceNumber} diverted from ${oldDest} to ${newDestStationId}.`);
    this.rareRoutesCompleted.unshift({
      headcode: train.headcode,
      routeDesc: `${train.originCode} → ${newDestStationId} (Live Control Diversion)`,
      timeStr: this.formatSimTime().slice(0, 5),
    });
    if (this.rareRoutesCompleted.length > 8) this.rareRoutesCompleted.pop();
    this.onStateChange?.();
  }

  // Toggle a signal hold (Red / Auto)
  public toggleSignalHold(nodeId: string) {
    const node = this.nodeMap[nodeId];
    if (!node) return;
    node.signalHeld = !node.signalHeld;
    soundEngine.playRelayClick(!node.signalHeld);
    this.addLog('NX', `Signal at ${node.name} ${node.signalHeld ? 'HELD AT DANGER (RED)' : 'RELEASED TO SELTRAC AUTO'}.`);
    this.onStateChange?.();
  }

  // Dispatch PSA to a train for manual driving / recovery
  public dispatchPsaToTrain(trainId: string) {
    const train = this.trains.find((t) => t.id === trainId);
    if (!train) return;
    train.psaMode = true;
    train.state = 'PSA_RECOVERY';
    train.breakdownReason = 'PSA Manual Control Active (Max 18 mph)';
    soundEngine.playRelayClick(true);
    this.addLog('PSA', `PSA boarded ${train.headcode} at ${this.nodeMap[train.currentNodeId]?.name || train.currentNodeId} — Manual control engaged.`);

    // Resolve any matching incident
    for (const inc of this.incidents) {
      if (inc.trainId === trainId && !inc.resolved) {
        inc.resolved = true;
      }
    }
    this.onStateChange?.();
  }

  // Toggle Contingency Plan
  public toggleContingencyPlan(planId: string) {
    const plan = this.contingencies.find((c) => c.id === planId);
    if (!plan) return;
    plan.active = !plan.active;
    soundEngine.playSplitFlap(7);
    this.addLog(
      'ARS',
      `${plan.shortCode}: ${plan.active ? 'ACTIVATED' : 'CANCELLED'} (${plan.effectSummary}).`
    );

    // Immediately apply to active trains if activated
    if (plan.active) {
      for (const t of this.trains) {
        if (plan.id === 'CP_SHORT_CAW' && t.destCode === 'LEW' && t.routeQueue.includes('CAW')) {
          this.rerouteTrainToDestination(t, 'CAW');
        } else if (plan.id === 'CP_DIVERT_TWG_BNK' && t.destCode === 'BNK' && t.cars === 2) {
          this.rerouteTrainToDestination(t, 'TWG');
        } else if (plan.id === 'CP_BECKTON_CUH' && t.destCode === 'BCK' && t.routeQueue.includes('CUH')) {
          this.rerouteTrainToDestination(t, 'CUH');
        } else if (plan.id === 'CP_AIRPORT_LCA' && t.destCode === 'WOO' && t.routeQueue.includes('LCA')) {
          this.rerouteTrainToDestination(t, 'LCA');
        }
      }
    }
    this.onStateChange?.();
  }

  // Execute an Incident Action from the Action Inset
  public executeIncidentAction(incidentId: string, actionId: string) {
    const inc = this.incidents.find((i) => i.id === incidentId);
    if (!inc) return;
    const act = inc.actions.find((a) => a.id === actionId);
    if (!act) return;

    if (act.effectType === 'DISPATCH_PSA' && act.targetId) {
      this.dispatchPsaToTrain(act.targetId);
    } else if (act.effectType === 'ACTIVATE_CONTINGENCY' && act.contingencyId) {
      const plan = this.contingencies.find((c) => c.id === act.contingencyId);
      if (plan && !plan.active) {
        this.toggleContingencyPlan(plan.id);
      }
    } else if (act.effectType === 'CLEAR_FAULT') {
      if (inc.nodeId && this.nodeMap[inc.nodeId]) {
        this.nodeMap[inc.nodeId].trackBlocked = false;
        this.nodeMap[inc.nodeId].pointsFailed = false;
      }
      if (inc.stationId) {
        this.stationCrowdMultiplier[inc.stationId] = 1.0;
      }
      if (inc.trainId) {
        const tr = this.trains.find((t) => t.id === inc.trainId);
        if (tr) {
          tr.state = 'MOVING';
          tr.breakdownReason = undefined;
        }
      }
      this.addLog('INCIDENT', `Resolved & cleared: ${inc.title}.`);
    } else if (act.effectType === 'BOOST_SERVICE' && act.targetId) {
      // Spawn an immediate relief special train
      this.injectSpecialExceptionService(act.targetId);
    }

    inc.resolved = true;
    soundEngine.playRelayClick(true);
    this.onStateChange?.();
  }

  public injectSpecialExceptionService(presetType: string) {
    soundEngine.playSplitFlap(8);
    if (presetType === 'LCA' || presetType === 'AIRSHOW') {
      const specialTpl: ServiceTemplate = {
        id: `T_SPEC_LCA_${Date.now()}`,
        name: 'Stratford ↔ London City Airport (Airshow Relief)',
        codePrefix: '7',
        originId: 'STR',
        destId: 'LCA',
        routeStations: ['STR', 'PML', 'BOW', 'DEV', 'LAN', 'ALL', 'POP', 'BLW', 'EIR', 'CNT', 'WSV', 'PDK', 'LCA'],
        intervalMins: 5,
        cars: 3,
        isException: true,
        exceptionReason: 'City Airport Airshow Surge Relief',
        active: true,
        color: '#EC4899',
      };
      this.templates.unshift(specialTpl);
      this.spawnTrainFromRoute(specialTpl, 'CNT_DN', ['CNT', 'WSV', 'PDK', 'LCA'], 'LCA');
      this.rareRoutesCompleted.unshift({
        headcode: '701 LCA',
        routeDesc: 'Stratford → London City Airport (Airshow Charter Extra)',
        timeStr: this.formatSimTime().slice(0, 5),
      });
      this.addLog('TIMETABLE', 'Timetable Exception Injected: 7xx Stratford ↔ London City Airport Airshow Relief.');
    } else if (presetType === 'BANKING_CAW') {
      const specialTpl: ServiceTemplate = {
        id: `T_SPEC_CAW_${Date.now()}`,
        name: 'Bank ↔ Canary Wharf Express Shuttle (Banking Summit)',
        codePrefix: '6',
        originId: 'BNK',
        destId: 'CAW',
        routeStations: ['BNK', 'SHA', 'LIM', 'WFE', 'WIQ', 'CAW'],
        intervalMins: 3,
        cars: 3,
        isException: true,
        exceptionReason: 'Canary Wharf Banking Convention Peak',
        active: true,
        color: '#22D3EE',
      };
      this.templates.unshift(specialTpl);
      this.spawnTrainFromRoute(specialTpl, 'BNK_DN', specialTpl.routeStations, 'CAW');
      this.rareRoutesCompleted.unshift({
        headcode: '601 CAW',
        routeDesc: 'Bank → Canary Wharf P3 Turnback (Banking Convention Extra)',
        timeStr: this.formatSimTime().slice(0, 5),
      });
      this.addLog('TIMETABLE', 'Timetable Exception Injected: 6xx Bank ↔ Canary Wharf 3-min Summit Shuttle.');
    } else if (presetType === 'EXCEL_CUH') {
      const specialTpl: ServiceTemplate = {
        id: `T_SPEC_CUH_${Date.now()}`,
        name: 'Canning Town ↔ Custom House (ExCeL Trade Fair Shuttle)',
        codePrefix: '6',
        originId: 'CNT',
        destId: 'CUH',
        routeStations: ['CNT', 'RVC', 'CUH'],
        intervalMins: 4,
        cars: 3,
        isException: true,
        exceptionReason: 'ExCeL London Exhibition Surge',
        active: true,
        color: '#F43F5E',
      };
      this.templates.unshift(specialTpl);
      this.spawnTrainFromRoute(specialTpl, 'CNT_DN', specialTpl.routeStations, 'CUH');
      this.rareRoutesCompleted.unshift({
        headcode: '604 CUH',
        routeDesc: 'Canning Town → Custom House Turnback (ExCeL Exhibition)',
        timeStr: this.formatSimTime().slice(0, 5),
      });
      this.addLog('TIMETABLE', 'Timetable Exception Injected: Canning Town ↔ Custom House ExCeL Shuttle.');
    } else if (presetType === 'ECS_TRANSFER') {
      const specialTpl: ServiceTemplate = {
        id: `T_SPEC_ECS_${Date.now()}`,
        name: 'Poplar Depot → Beckton Depot (Stock Transfer ECS)',
        codePrefix: '9',
        originId: 'PDP',
        destId: 'BDP',
        routeStations: ['PDP', 'POP', 'BLW', 'EIR', 'CNT', 'RVC', 'CUH', 'PRR', 'RAL', 'BKP', 'CYP', 'GAL', 'BDP'],
        intervalMins: 15,
        cars: 3,
        isECS: true,
        isException: true,
        exceptionReason: 'Non-Passenger Depot Positioning Run',
        active: true,
        color: '#94A3B8',
      };
      this.templates.unshift(specialTpl);
      this.spawnTrainFromRoute(specialTpl, 'PDP_DN', specialTpl.routeStations, 'BDP');
      this.rareRoutesCompleted.unshift({
        headcode: '908 BDP',
        routeDesc: 'Poplar Depot → Beckton Depot (Empty Coaching Stock)',
        timeStr: this.formatSimTime().slice(0, 5),
      });
      this.addLog('TIMETABLE', 'ECS Positioning Dispatched: 9xx Poplar Depot → Beckton Depot.');
    }
    this.onStateChange?.();
  }

  // Trigger a new random or scoped disruption event
  public triggerScopedDisruption(scope: 'ALL' | 'VOBC_BREAKDOWN' | 'POINTS_FAILURE' | 'CROWD_SURGE' | 'TUNNEL_BLOCK') {
    const types = ['VOBC_BREAKDOWN', 'POINTS_FAILURE', 'CROWD_SURGE', 'TUNNEL_BLOCK'] as const;
    const chosen = scope === 'ALL' ? types[Math.floor(Math.random() * types.length)] : scope;

    soundEngine.playIncidentAlert(chosen !== 'CROWD_SURGE');

    if (chosen === 'VOBC_BREAKDOWN') {
      const movingTrains = this.trains.filter((t) => t.state !== 'BROKEN_DOWN');
      const target = movingTrains[Math.floor(Math.random() * movingTrains.length)] || this.trains[0];
      if (!target) return;

      target.state = 'BROKEN_DOWN';
      target.speedMph = 0;
      target.breakdownReason = 'SelTrac Brake Loop Timeout — Awaiting PSA';
      const stName = this.nodeMap[target.currentNodeId]?.name || target.currentNodeId;

      this.incidents.unshift({
        id: `INC_${Date.now()}`,
        title: `Train ${target.headcode} Brake Loop Fault at ${stName}`,
        description: `Unit ${target.serviceNumber} suffered an emergency brake drop-out at ${stName}. Automatic recovery failed; requires PSA manual key-in.`,
        severity: 'CRITICAL',
        nodeId: target.currentNodeId,
        trainId: target.id,
        timestamp: this.simTimeSeconds,
        resolved: false,
        actions: [
          {
            id: `ACT_PSA_${Date.now()}`,
            label: `Dispatch PSA to ${target.headcode} (18 mph Manual)`,
            description: 'Authorises PSA to drive unit manually under caution to next turnback',
            effectType: 'DISPATCH_PSA',
            targetId: target.id,
          },
          {
            id: `ACT_CLR_${Date.now()}`,
            label: 'Remote VOBC Warm-Reset from Control Centre',
            description: 'Attempts remote SelTrac telemetry re-initialisation',
            effectType: 'CLEAR_FAULT',
            targetId: target.id,
          },
        ],
      });
      this.addLog('INCIDENT', `ALERT: ${target.headcode} stalled with VOBC brake fault at ${stName}.`);
    } else if (chosen === 'POINTS_FAILURE') {
      const keyJunctions = ['WFE_DN', 'POP_DN', 'CNT_DN', 'CAW_DN', 'CUH_DN', 'LCA_DN'];
      const jId = keyJunctions[Math.floor(Math.random() * keyJunctions.length)];
      const node = this.nodeMap[jId];
      if (!node) return;
      node.pointsFailed = true;
      node.trackBlocked = true;

      const planId = jId.startsWith('CAW')
        ? 'CP_SHORT_CAW'
        : jId.startsWith('CUH')
        ? 'CP_BECKTON_CUH'
        : jId.startsWith('LCA')
        ? 'CP_AIRPORT_LCA'
        : 'CP_DIVERT_TWG_BNK';

      this.incidents.unshift({
        id: `INC_${Date.now()}`,
        title: `Points Detection Loss at ${node.name}`,
        description: `Facing points at ${node.name} failed to lock in normal position. Track circuit locked RED; bi-directional Single Line Working (SLW) available via parallel road.`,
        severity: 'CRITICAL',
        nodeId: jId,
        stationId: node.stationId,
        timestamp: this.simTimeSeconds,
        resolved: false,
        actions: [
          {
            id: `ACT_CP_${Date.now()}`,
            label: 'Activate Branch Turnback Contingency Plan',
            description: 'Automatically short-turns approaching services away from the fouled points',
            effectType: 'ACTIVATE_CONTINGENCY',
            contingencyId: planId,
          },
          {
            id: `ACT_FIX_${Date.now()}`,
            label: 'Dispatch Track Response Team (Hand-Crank & Clip)',
            description: 'Clips and padlocks points for safe passage, restoring green aspect',
            effectType: 'CLEAR_FAULT',
            targetId: jId,
          },
        ],
      });
      this.addLog('INCIDENT', `ALERT: Points failure at ${node.name}. Bi-directional SLW routing armed.`);
    } else if (chosen === 'CROWD_SURGE') {
      const hubs = [
        { id: 'CAW', event: 'Canary Wharf Financial Summit Let-Out', boost: 'BANKING_CAW' },
        { id: 'CUH', event: 'ExCeL London Convention Hall Exit Surge', boost: 'EXCEL_CUH' },
        { id: 'LCA', event: 'London City Airport Wide-Body Arrival Wave', boost: 'LCA' },
      ];
      const pick = hubs[Math.floor(Math.random() * hubs.length)];
      this.stationCrowdMultiplier[pick.id] = 1.85;

      this.incidents.unshift({
        id: `INC_${Date.now()}`,
        title: `Severe Platform Crowding — ${STATION_MAP[pick.id]?.name}`,
        description: `${pick.event}. Platform occupancy at 92%; door obstruction sensors holding trains for +25s per stop.`,
        severity: 'WARNING',
        stationId: pick.id,
        timestamp: this.simTimeSeconds,
        resolved: false,
        actions: [
          {
            id: `ACT_RELIEF_${Date.now()}`,
            label: `Inject 3-Car Relief Shuttle to ${pick.id}`,
            description: 'Inserts high-capacity 3-car shuttle service into the live timetable',
            effectType: 'BOOST_SERVICE',
            targetId: pick.boost,
          },
          {
            id: `ACT_CROWD_${Date.now()}`,
            label: 'Station Control: One-Way Gate Regulation',
            description: 'Metering ticket hall gates to restore normal platform dwell times',
            effectType: 'CLEAR_FAULT',
            targetId: pick.id,
          },
        ],
      });
      this.addLog('INCIDENT', `CROWD WARNING: ${pick.event} causing extended dwells at ${pick.id}.`);
    } else {
      // TUNNEL_BLOCK (Greenwich or Woolwich or Bank bore)
      const bores = [
        { nodeId: 'CUT_DN', title: 'Greenwich Foot-Tunnel Bore Pump Alarm', planId: 'CP_SHORT_CAW' },
        { nodeId: 'SHA_UP', title: 'Bank Deep-Tube Bore Smoke Detector Activation', planId: 'CP_DIVERT_TWG_BNK' },
        { nodeId: 'KGV_DN', title: 'Woolwich Thames Tunnel Track Circuit Drop', planId: 'CP_AIRPORT_LCA' },
      ];
      const pick = bores[Math.floor(Math.random() * bores.length)];
      const node = this.nodeMap[pick.nodeId];
      if (node) node.trackBlocked = true;

      this.incidents.unshift({
        id: `INC_${Date.now()}`,
        title: pick.title,
        description: `Safety interlocking has locked ${node?.name || pick.nodeId} at RED. Approaching services will queue unless turned back at the nearest crossover.`,
        severity: 'CRITICAL',
        nodeId: pick.nodeId,
        stationId: node?.stationId,
        timestamp: this.simTimeSeconds,
        resolved: false,
        actions: [
          {
            id: `ACT_PLAN_${Date.now()}`,
            label: 'Engage Emergency Turnback Contingency Plan',
            description: 'Short-turns affected branch trains at the preceding crossover station',
            effectType: 'ACTIVATE_CONTINGENCY',
            contingencyId: pick.planId,
          },
          {
            id: `ACT_RESET_${Date.now()}`,
            label: 'Confirm Bore Clear & Reset Interlocking',
            description: 'PSA tunnel inspection complete — releases track lock',
            effectType: 'CLEAR_FAULT',
            targetId: pick.nodeId,
          },
        ],
      });
      this.addLog('INCIDENT', `TUNNEL BLOCK: ${pick.title} — ${pick.nodeId} locked RED.`);
    }

    this.onStateChange?.();
  }

  // Get upcoming departures for a station (for the Solari Split-Flap Station Inspector)
  public getStationDepartures(stationId: string): {
    headcode: string;
    destName: string;
    platform: string;
    etaMins: number;
    cars: 2 | 3;
    status: string;
    isECS: boolean;
  }[] {
    const results: {
      headcode: string;
      destName: string;
      platform: string;
      etaMins: number;
      cars: 2 | 3;
      status: string;
      isECS: boolean;
    }[] = [];

    for (const t of this.trains) {
      const currSt = this.nodeMap[t.currentNodeId]?.stationId;
      if (currSt === stationId) {
        const destName = STATION_MAP[t.destCode]?.name || t.destCode;
        results.push({
          headcode: t.headcode,
          destName: t.isECS ? 'DO NOT BOARD (ECS)' : destName,
          platform: this.nodeMap[t.currentNodeId]?.platform || '1',
          etaMins: 0,
          cars: t.cars,
          status: t.state === 'BROKEN_DOWN' ? 'DELAYED' : 'AT PLATFORM',
          isECS: t.isECS,
        });
        continue;
      }

      const idx = t.routeQueue.indexOf(stationId);
      if (idx !== -1) {
        const etaMins = Math.max(1, Math.round((idx + 1) * 1.4 - t.edgeProgress));
        const destName = STATION_MAP[t.destCode]?.name || t.destCode;
        // Determine platform from nodePath
        const matchNode = t.nodePath.find((nid) => this.nodeMap[nid]?.stationId === stationId);
        const plat = matchNode ? this.nodeMap[matchNode]?.platform || '1' : '1';

        results.push({
          headcode: t.headcode,
          destName: t.isECS ? 'EMPTY STOCK' : destName,
          platform: plat,
          etaMins,
          cars: t.cars,
          status: t.delaySeconds > 90 ? `LATE +${Math.round(t.delaySeconds / 60)}M` : t.psaMode ? 'PSA MANUAL' : 'ON TIME',
          isECS: t.isECS,
        });
      }
    }

    results.sort((a, b) => a.etaMins - b.etaMins);
    return results.slice(0, 5);
  }

  // Compute overall DLR Performance Index (PPM % and Service Health)
  public getPerformanceMetrics() {
    const activeDelays = this.trains.reduce((acc, t) => acc + t.delaySeconds, 0);
    const avgDelaySec = this.trains.length > 0 ? Math.round(activeDelays / this.trains.length) : 0;
    const ppm = Math.max(
      62,
      Math.min(100, Math.round((this.onTimeArrivals / Math.max(1, this.totalArrivals)) * 100 - avgDelaySec * 0.12))
    );

    const sortedStations = [...this.stations]
      .filter((s) => !s.id.includes('DP'))
      .map((s) => ({
        station: s,
        footfall: this.stationFootfall[s.id] || 0,
        crowdMult: this.stationCrowdMultiplier[s.id] || 1.0,
      }))
      .sort((a, b) => b.footfall - a.footfall);

    return {
      ppm,
      avgDelaySec,
      activeTrainCount: this.trains.length,
      brokenCount: this.trains.filter((t) => t.state === 'BROKEN_DOWN').length,
      psaCount: this.trains.filter((t) => t.psaMode).length,
      busiestStations: sortedStations.slice(0, 5),
      quietestStations: sortedStations.slice(-4).reverse(),
    };
  }
}
