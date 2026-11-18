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

import { Airport, dayAt } from './airport';
import { demandFactor, entriesPerSecond } from './platformDemand';

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
  // Default: Monday 05:25:00 (5 minutes before the 05:30:00 first train wave rolls out of Beckton & Poplar Depots!)
  public shiftPreset: 'MON_0525' | 'MON_0730' | 'SAT_1300' | 'FRI_2355' = 'MON_0525';
  public simDayName: string = 'MON';
  public simTimeSeconds: number = 5 * 3600 + 25 * 60; // 05:25:00 Monday Cold Start
  public timeScale: number = 1; // 0 = Pause, 0.5 = Slow, 1 = Normal, 4 = Fast, 10 = Ultra
  public arsEnabled: boolean = true;
  public showCbtcOverlays: boolean = true;
  public singleLineWorkingActive: boolean = true; // Bi-directional SLW around blocked tracks
  public undergroundSopActive: boolean = true; // SOP-UG1 (Single train per deep bore) & SOP-TWG (Strict 2-car 60m lockout)

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

  public airport = new Airport('MON', this.simTimeSeconds);
  private waiting: Record<string, number> = {};
  private forAirport: Record<string, number> = {};
  private loadingShift = false;

  public platformWaiting(node: string) {
    return Math.floor(this.waiting[node] ?? 0) + Math.floor(this.forAirport[node] ?? 0);
  }

  private growQueues(from: number, to: number) {
    const factor = demandFactor(dayAt(this.simDayName, to), to) * (to - from);
    for (const st of this.stations) {
      const influx = entriesPerSecond(st.id) * factor * this.stationCrowdMultiplier[st.id];
      // Single-ended branches collect their departing passengers on the outward road.
      const upShare = ['WOO', 'LEW', 'BCK'].includes(st.id) ? 1
        : ['BNK', 'TWG', 'STI'].includes(st.id) ? 0 : 0.5;
      this.waiting[st.id + '_UP'] += influx * upShare;
      this.waiting[st.id + '_DN'] += influx * (1 - upShare);
    }
    const flow = this.airport.railFlows(from, to);
    this.waiting.LCA_UP += flow.arrivals * 0.8;
    this.waiting.LCA_DN += flow.arrivals * 0.2;
    this.forAirport.CNT_DN += flow.departures * 0.8;
    this.forAirport.WOO_UP += flow.departures * 0.2;
  }

  private boardWaiting(train: Train, node: string) {
    const space = train.maxCapacity - train.passengers;
    const airport = train.routeQueue.includes('LCA') ? Math.min(space, Math.floor(this.forAirport[node] ?? 0)) : 0;
    if (airport) this.forAirport[node] -= airport;
    train.airportPassengers = (train.airportPassengers ?? 0) + airport;
    const local = Math.min(space - airport, Math.floor(this.waiting[node] ?? 0));
    if (local) this.waiting[node] -= local;
    const boarded = local + airport;
    train.passengers += boarded;
    this.totalPassengersCarried += boarded;
    const station = this.nodeMap[node].stationId!;
    this.stationFootfall[station] = (this.stationFootfall[station] ?? 0) + boarded;
    return boarded;
  }

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
      this.stationFootfall[st.id] = Math.floor(st.baseDemand * 90 + Math.random() * 45);
      this.stationCrowdMultiplier[st.id] = 1.0;
    }

    this.loadShiftPreset('MON_0525');
  }

  public formatSimTime(sec = this.simTimeSeconds): string {
    const totalSec = Math.floor(sec) % 86400;
    const hh = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const mm = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const ss = Math.floor(totalSec % 60).toString().padStart(2, '0');
    return `${dayAt(this.simDayName, sec)} ${hh}:${mm}:${ss}`;
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

  // Dijkstra shortest path between two TrackNodes, considering train car length, SOP-TWG, & multi-road depot stabling
  public findNodePath(startNodeId: string, targetStationOrNodeId: string, cars: 2 | 3, allowSLW = true): string[] {
    const occupiedNodes = new Set(this.trains.map((t) => t.currentNodeId));

    // Support both station IDs (e.g. 'BDP', 'PDP', 'CAW', 'BNK') and direct road/siding node IDs (e.g. 'BDP_R1', 'CAW_MID', 'BNK_HSH')
    let targetCandidates: string[] = [];
    if (this.nodeMap[targetStationOrNodeId]) {
      targetCandidates = [targetStationOrNodeId];
    } else {
      const stationNodes = this.nodes
        .filter((n) => n.stationId === targetStationOrNodeId)
        .map((n) => n.id);
      // Prefer unoccupied platform/siding/depot roads so multiple trains can stable or reverse simultaneously!
      const freeStationNodes = stationNodes.filter((id) => !occupiedNodes.has(id));
      targetCandidates =
        freeStationNodes.length > 0
          ? freeStationNodes
          : [`${targetStationOrNodeId}_DN`, `${targetStationOrNodeId}_UP`, ...stationNodes];
    }

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
          cost += 360; // Prefer staying on main running line unless turning back, stabling, or SLW diverting
        }
        if (occupiedNodes.has(edge.to) && targetCandidates.includes(edge.to)) {
          cost += 1200; // Prefer unoccupied stabling/turnback road at target station/depot
        }
        if (nextNode.trackBlocked) {
          cost += 50000; // Avoid blocked tracks if alternate SLW track exists
        }
        // SOP-TWG: Platform car length restriction check at Tower Gateway & Minories Throat (strictly 2-car 60m max!)
        if ((nextNode.stationId === 'TWG' || nextNode.maxCars === 2) && nextNode.stationId === 'TWG' && cars > 2) {
          cost += 100000; // 3-car trains physically foul Minories points and cannot enter Tower Gateway
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

  // Switch between Operating Shift Time Presets (Default: MON 05:25 — 5m before 05:30 First Train!)
  public loadShiftPreset(preset: 'MON_0525' | 'MON_0730' | 'SAT_1300' | 'FRI_2355') {
    this.loadingShift = true;
    this.shiftPreset = preset;
    this.trains = [];
    this.incidents = [];
    this.manualRoutes = {};

    for (const n of this.nodes) {
      n.trackBlocked = false;
      n.pointsFailed = false;
      n.signalHeld = false;
      n.signalAspect = 'GREEN';
    }
    for (const c of this.contingencies) {
      c.active = false;
    }
    for (const st of this.stations) {
      this.stationCrowdMultiplier[st.id] = 1.0;
    }

    if (preset === 'MON_0525') {
      // Monday 05:25:00 — 5 minutes before the 05:30:00 first train wave!
      this.simDayName = 'MON';
      this.simTimeSeconds = 5 * 3600 + 25 * 60; // 05:25:00
      this.totalArrivals = 4;
      this.onTimeArrivals = 4;
      this.totalPassengersCarried = 620;
      for (const st of this.stations) {
        this.stationFootfall[st.id] = Math.floor(st.baseDemand * 22);
      }

      // Seed stabled units across Beckton Depot Roads 1-4, Poplar Depot Roads 1-3, Bank Headshunt, and Termini
      const tplBnkLew = this.templates[0];
      const tplBnkWoo = this.templates[1];
      const tplTwgBck = this.templates[2];
      const tplStrLew = this.templates[3];
      const tplStiWoo = this.templates[4];
      const tplEcs = this.templates[5];

      const spawnStabled = (
        tpl: ServiceTemplate,
        startNode: string,
        route: string[],
        dwellSec: number,
        reason?: string
      ) => {
        const tr = this.spawnTrainFromRoute(tpl, startNode, route, route[route.length - 1], reason);
        if (tr) {
          tr.dwellRemaining = dwellSec;
          tr.delaySeconds = 0;
          tr.passengers = tpl.isECS ? 0 : Math.floor(25 + Math.random() * 65);
        }
        return tr;
      };

      // 4 Units Stabled in Beckton Depot Multi-Road Fan (BDP_R1, BDP_R2, BDP_R3, BDP_R4) rolling out for 05:30 service
      spawnStabled(tplEcs, 'BDP_R1', ['BDP', 'GAL', 'CYP', 'BKP', 'RAL', 'PRR', 'CUH', 'RVC', 'CNT', 'EIR', 'BLW', 'POP', 'WIQ', 'CAW'], 8, '05:25 Pre-Dawn ECS Roll-Out from Beckton Rd 1');
      spawnStabled(tplTwgBck, 'BDP_R2', ['BDP', 'GAL', 'CYP', 'BKP', 'RAL', 'PRR', 'CUH', 'RVC', 'CNT', 'EIR', 'BLW', 'POP', 'WFE', 'LIM', 'SHA', 'TWG'], 22, '2-Car Starter Unit Launching from Beckton Rd 2');
      spawnStabled(tplBnkLew, 'BDP_R3', ['BDP', 'GAL', 'BCK'], 38, 'Positioning from Beckton Rd 3 to Beckton P1');
      spawnStabled(tplEcs, 'BDP_R4', ['BDP', 'GAL', 'CYP', 'BKP', 'RAL', 'PRR', 'CUH', 'RVC', 'CNT'], 55, 'Beckton Rd 4 Wash Loop → Canning Town Starter');

      // 3 Units Stabled in Poplar Depot Multi-Road Fan (PDP_S1, PDP_S2, PDP_S3)
      spawnStabled(tplBnkWoo, 'PDP_S1', ['PDP', 'POP', 'BLW', 'EIR', 'CNT', 'WSV', 'PDK', 'LCA', 'KGV', 'WOO'], 10, 'Poplar Rd 1 Starter → Woolwich Arsenal');
      spawnStabled(tplStrLew, 'PDP_S2', ['PDP', 'POP', 'WIQ', 'CAW', 'HER', 'SQY', 'CRH', 'MUD', 'ISG', 'CUT', 'GRE', 'DEP', 'ELV', 'LEW'], 26, 'Poplar Rd 2 Starter → Canary Wharf & Lewisham');
      spawnStabled(tplBnkLew, 'PDP_S3', ['PDP', 'POP', 'WFE', 'LIM', 'SHA', 'BNK'], 45, 'Poplar Rd 3 Starter → Bank Deep-Tube Bore');

      // Early-bird units warming up in Bank Tail Headshunt, Canary Wharf Center Road, Tower Gateway, Stratford & Stratford Intl
      spawnStabled(tplBnkLew, 'BNK_HSH', ['BNK', 'SHA', 'LIM', 'WFE', 'WIQ', 'CAW', 'HER', 'SQY', 'CRH', 'MUD', 'ISG', 'CUT', 'GRE', 'DEP', 'ELV', 'LEW'], 12, 'Reversing out of Bank Tail Headshunt Overrun (SOP-UG1)');
      spawnStabled(tplTwgBck, 'TWG_UP', ['TWG', 'SHA', 'LIM', 'WFE', 'POP', 'BLW', 'EIR', 'CNT', 'RVC', 'CUH', 'PRR', 'RAL', 'BKP', 'CYP', 'GAL', 'BCK'], 18, 'First 05:30 2-Car Departure Ready at Tower Gateway');
      spawnStabled(tplStrLew, 'STR_BAY', ['STR', 'PML', 'BOW', 'DEV', 'LAN', 'ALL', 'POP', 'WIQ', 'CAW', 'HER', 'SQY', 'CRH', 'MUD', 'ISG', 'CUT', 'GRE', 'DEP', 'ELV', 'LEW'], 15, 'Launching from Stratford High-Level Bay P4A/P4B');
      spawnStabled(tplBnkLew, 'CAW_MID', ['CAW', 'WFE', 'LIM', 'SHA', 'BNK'], 14, 'Stabled on Canary Wharf P3/P4 Center Road — Bypasses WIQ (SOP-WIQ)');
      spawnStabled(tplStiWoo, 'STI_HSH', ['STI', 'STR', 'SHS', 'ABB', 'WHM', 'STL', 'CNT', 'WSV', 'PDK', 'LCA', 'KGV', 'WOO'], 22, 'Launching from Stratford International Olympic Siding via Stratford P17');

      // Schedule regular interval spawns to begin at 05:30:00 (300s from 05:25:00)
      for (const tpl of this.templates) {
        const intervalSec = Math.max(90, tpl.intervalMins * 60);
        this.lastSpawnFwd[tpl.id] = 5 * 3600 + 30 * 60 - intervalSec;
        this.lastSpawnRev[tpl.id] = 5 * 3600 + 30 * 60 - intervalSec + 45;
      }

      // Seed Monday 05:25 Pre-Service Incidents (Royal Mint St Underground Portal Check + Depot Roll-Out)
      const pdpTrain = this.trains.find((t) => t.currentNodeId === 'PDP_S3') || this.trains[0];
      if (pdpTrain) {
        pdpTrain.state = 'BROKEN_DOWN';
        pdpTrain.breakdownReason = 'Cold-Start VOBC Inductive Loop Handshake Pending — Awaiting PSA';
      }

      this.incidents = [
        {
          id: 'INC_MON_0525_1',
          title: '05:25 Cold Start — VOBC Loop Handshake Fault on Poplar Depot Rd 3',
          description:
            'Starter Unit on Poplar Depot Road 3 (PDP_S3) failed its automated 05:25 pre-departure VOBC loop test prior to the 05:30 first-train launch. Dispatch a PSA to manual-shunt onto the Poplar trunk.',
          severity: 'CRITICAL',
          stationId: 'PDP',
          nodeId: 'PDP_S3',
          trainId: pdpTrain?.id,
          timestamp: this.simTimeSeconds - 15,
          resolved: false,
          actions: [
            {
              id: 'ACT_MON_PSA',
              label: 'Dispatch PSA to Manual-Launch Unit (18 mph)',
              description: 'Authorises PSA to drive unit out of Poplar Depot Rd 3 onto Poplar P1/P2',
              effectType: 'DISPATCH_PSA',
              targetId: pdpTrain?.id,
            },
            {
              id: 'ACT_MON_ECS',
              label: 'Dispatch Spare ECS Unit from Beckton Depot',
              description: 'Launches an extra 9xx positioning unit from Beckton Depot to cover the diagram',
              effectType: 'BOOST_SERVICE',
              targetId: 'ECS_TRANSFER',
            },
          ],
        },
        {
          id: 'INC_MON_0525_2',
          title: 'SOP-UG1 Pre-Service Check — Royal Mint St / Bank Bore Portal',
          description:
            'Overnight points heater check at Royal Mint Street Junction (RMJ_UP) ahead of the 05:30 Bank deep-bore launch. Confirm bore clearance or divert early 2-car sets into Tower Gateway.',
          severity: 'WARNING',
          stationId: 'BNK',
          nodeId: 'RMJ_UP',
          timestamp: this.simTimeSeconds - 10,
          resolved: false,
          actions: [
            {
              id: 'ACT_MON_CLR_RMJ',
              label: 'Confirm Bank 1:20 Bore Clear (Release SOP-UG1)',
              description: 'Completes Royal Mint St points check and clears Bank P9/P10 approach',
              effectType: 'CLEAR_FAULT',
              targetId: 'RMJ_UP',
            },
            {
              id: 'ACT_MON_PLAN_B',
              label: 'Engage Plan B: Divert 2C to Tower Gateway / 3C to Shadwell',
              description: 'Routes 2-car sets into TWG (60m max) and reverses 3-car sets at SHA crossover',
              effectType: 'ACTIVATE_CONTINGENCY',
              contingencyId: 'CP_DIVERT_TWG_BNK',
            },
          ],
        },
      ];

      this.addLog(
        'TIMETABLE',
        'SHIFT LOADED: Monday 05:25:00 Cold Start (5 mins before 05:30 First Train). 12 units stabled across Beckton Rd 1–4, Poplar Rd 1–3, & Bank Headshunt.'
      );
    } else if (preset === 'MON_0730') {
      this.simDayName = 'MON';
      this.simTimeSeconds = 7 * 3600 + 30 * 60; // 07:30:00
      this.totalArrivals = 42;
      this.onTimeArrivals = 40;
      this.totalPassengersCarried = 14820;
      for (const st of this.stations) {
        this.stationFootfall[st.id] = Math.floor(st.baseDemand * 180 + Math.random() * 90);
      }
      this.seedInitialTrains();
      this.seedInitialIncidents();
      this.addLog('TIMETABLE', 'SHIFT LOADED: Monday 07:30:00 Morning Rush Hour Peak (Full 7-Branch Fleet).');
    } else if (preset === 'SAT_1300') {
      this.simDayName = 'SAT';
      this.simTimeSeconds = 13 * 3600; // 13:00:00
      this.totalArrivals = 68;
      this.onTimeArrivals = 64;
      this.totalPassengersCarried = 24900;
      this.seedInitialTrains();
      this.stationCrowdMultiplier['CUH'] = 1.85;
      this.stationCrowdMultiplier['LCA'] = 1.75;
      this.stationCrowdMultiplier['CUT'] = 1.65;
      this.incidents = [
        {
          id: 'INC_SAT_1',
          title: 'Weekend ExCeL Trade Fair + Cutty Sark Tourist Surge',
          description:
            'Massive leisure crowds at Custom House (CUH), Cutty Sark (CUT 2-car SDO platform), and London City Airport (LCA). Dwell times +40%.',
          severity: 'WARNING',
          stationId: 'CUH',
          nodeId: 'CUH_DN',
          timestamp: this.simTimeSeconds - 30,
          resolved: false,
          actions: [
            {
              id: 'ACT_SAT_SHUTTLE',
              label: 'Inject Canning Town ↔ Custom House ExCeL Shuttle',
              description: 'Uses Custom House ExCeL Siding (CUH_SID) to run 4-min turnbacks',
              effectType: 'BOOST_SERVICE',
              targetId: 'EXCEL_CUH',
            },
            {
              id: 'ACT_SAT_AIR',
              label: 'Inject Stratford ↔ City Airport Charter (7xx)',
              description: 'Adds direct 3-car airport charter service',
              effectType: 'BOOST_SERVICE',
              targetId: 'AIRSHOW',
            },
          ],
        },
      ];
      this.addLog('TIMETABLE', 'SHIFT LOADED: Saturday 13:00:00 ExCeL Exhibition & Cutty Sark SDO Surge.');
    } else if (preset === 'FRI_2355') {
      this.simDayName = 'FRI';
      this.simTimeSeconds = 23 * 3600 + 55 * 60; // 23:55:00
      this.totalArrivals = 140;
      this.onTimeArrivals = 134;
      this.totalPassengersCarried = 52400;
      this.seedInitialTrains();
      // Divert several late-night units back to Beckton & Poplar Depot stabling roads
      if (this.trains[0]) this.rerouteTrainToDestination(this.trains[0], 'BDP_R1');
      if (this.trains[1]) this.rerouteTrainToDestination(this.trains[1], 'PDP_S1');
      this.incidents = [
        {
          id: 'INC_FRI_1',
          title: '23:55 Late-Night Depot Run-In & Engineering Possession',
          description:
            'Last passenger trains are clearing Bank and Canary Wharf prior to 00:30 engineering possession. Route terminating stock into Beckton Depot (BDP Rd 1–4) and Poplar Depot (PDP Rd 1–3).',
          severity: 'WARNING',
          stationId: 'BDP',
          nodeId: 'BDP_R1',
          timestamp: this.simTimeSeconds - 20,
          resolved: false,
          actions: [
            {
              id: 'ACT_FRI_ECS',
              label: 'Dispatch Final ECS Sweep (Poplar Depot → Beckton Depot)',
              description: 'Transfers remaining stock into Beckton stabling roads',
              effectType: 'BOOST_SERVICE',
              targetId: 'ECS_TRANSFER',
            },
            {
              id: 'ACT_FRI_CLR',
              label: 'Acknowledge Night Possession Handover',
              description: 'Confirms engineering possession schedule',
              effectType: 'CLEAR_FAULT',
              targetId: 'BDP_R1',
            },
          ],
        },
      ];
      this.addLog('TIMETABLE', 'SHIFT LOADED: Friday 23:55:00 Late-Night Shutdown & Multi-Road Depot Stabling Run-In.');
    }

    this.airport = new Airport(this.simDayName, this.simTimeSeconds);
    this.forAirport = { CNT_DN: 0, WOO_UP: 0 };
    for (const st of this.stations) {
      this.waiting[st.id + '_UP'] = this.waiting[st.id + '_DN'] = 0;
    }
    this.growQueues(this.simTimeSeconds - 180, this.simTimeSeconds);
    this.loadingShift = false;
    this.onStateChange?.();
  }

  private seedInitialTrains() {
    // Spawn 15 initial trains distributed across all 7 branches + depot/center sidings
    const initialPlacements: {
      templateIndex: number;
      reverse: boolean;
      startStationIdx: number;
      overrideStartNode?: string;
    }[] = [
      { templateIndex: 0, reverse: false, startStationIdx: 2 }, // LIM -> LEW
      { templateIndex: 0, reverse: false, startStationIdx: 7 }, // HER -> LEW
      { templateIndex: 0, reverse: true, startStationIdx: 12 }, // GRE -> BNK
      { templateIndex: 0, reverse: true, startStationIdx: 5, overrideStartNode: 'CAW_MID' }, // CAW P3/P4 -> BNK
      { templateIndex: 1, reverse: false, startStationIdx: 4 }, // POP -> WOO
      { templateIndex: 1, reverse: true, startStationIdx: 10 }, // LCA -> BNK
      { templateIndex: 2, reverse: false, startStationIdx: 0 }, // TWG -> BCK (2-car)
      { templateIndex: 2, reverse: false, startStationIdx: 9 }, // CUH -> BCK (2-car)
      { templateIndex: 2, reverse: true, startStationIdx: 13 }, // CYP -> TWG (2-car)
      { templateIndex: 3, reverse: false, startStationIdx: 2 }, // BOW -> LEW
      { templateIndex: 3, reverse: true, startStationIdx: 9 },  // CRH -> STR
      { templateIndex: 4, reverse: false, startStationIdx: 1 }, // SHS -> WOO
      { templateIndex: 4, reverse: true, startStationIdx: 7 },  // WSV -> STI
      { templateIndex: 5, reverse: false, startStationIdx: 0, overrideStartNode: 'BDP_R2' }, // BDP Rd 2 -> CAW (ECS)
      { templateIndex: 1, reverse: false, startStationIdx: 4, overrideStartNode: 'PDP_S1' }, // PDP Rd 1 -> WOO
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
      const startNodeId = p.overrideStartNode || `${startSt}_${dirSuffix}`;

      this.spawnTrainFromRoute(tpl, startNodeId, remainingStations, destSt);
    });

    // Initialize spawn timers
    for (const tpl of this.templates) {
      this.lastSpawnFwd[tpl.id] = this.simTimeSeconds;
      this.lastSpawnRev[tpl.id] = this.simTimeSeconds - (tpl.intervalMins * 30);
    }
  }

  // Enforce SOP-WIQ: Northbound/Westbound trains from Canary Wharf (CAW) to Westferry (WFE) / Bank (BNK)
  // use the grade-separated Westbound Dive-Under Bypass Track (DLT_BYP_UP) which physically has NO platform at West India Quay (WIQ).
  private filterWiqForWestboundBypass(stations: string[], startNodeId?: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < stations.length; i++) {
      const curr = stations[i];
      const prev = i > 0 ? stations[i - 1] : startNodeId ? this.nodeMap[startNodeId]?.stationId : undefined;
      const next = i < stations.length - 1 ? stations[i + 1] : undefined;
      if (curr === 'WIQ' && prev === 'CAW' && next === 'WFE') {
        continue; // Skip WIQ on Northbound/Westbound CAW -> WFE -> BNK runs (SOP-WIQ)
      }
      out.push(curr);
    }
    return out;
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

    const effectiveStations = this.filterWiqForWestboundBypass(routeStations, startNodeId);

    const prefix = tpl.codePrefix || '1';
    const num = this.serviceCounter[prefix] || 101;
    this.serviceCounter[prefix] = num + 1;
    if (this.serviceCounter[prefix] % 100 > 98) {
      this.serviceCounter[prefix] = parseInt(prefix, 10) * 100 + 1;
    }

    const serviceNumber = `${num}`;
    const destCode = destSt;
    const headcode = `${serviceNumber} ${destCode}`;
    const nodePath = this.buildFullNodePathForStations(startNodeId, effectiveStations, tpl.cars);
    const nextNodeId = nodePath.length > 1 ? nodePath[1] : null;
    const firstEdge = nextNodeId ? this.findEdge(startNodeId, nextNodeId) : null;

    const maxCap = tpl.cars === 3 ? 780 : 520;
    const initPax = tpl.isECS || !this.loadingShift ? 0 : Math.floor(85 + Math.random() * 240);

    const train: Train = {
      id: `TR_${serviceNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      headcode,
      serviceNumber,
      destCode,
      originCode: effectiveStations[0],
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
      routeQueue: [...effectiveStations.slice(1)],
      nodePath,
      delaySeconds: Math.floor(Math.random() * 25),
      dwellRemaining: 8,
      passengers: initPax,
      maxCapacity: maxCap,
      color: tpl.color,
      breakdownReason: customReason,
    };

    if (!this.loadingShift && !train.isECS && nextNodeId && this.nodeMap[startNodeId]?.type === 'platform') {
      this.boardWaiting(train, startNodeId);
    }
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
    const before = Math.floor(this.simTimeSeconds);
    this.simTimeSeconds += dtSim;
    const now = Math.floor(this.simTimeSeconds);
    if (now > before) {
      this.airport.advance(now);
      this.growQueues(before, now);
    }

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
        const stations = this.applyActiveContingenciesToRoute([...tpl.routeStations], tpl.cars);
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
          const revStations = this.applyActiveContingenciesToRoute([...tpl.routeStations].reverse(), tpl.cars);
          if (revStations.length >= 2) {
            const startNode = `${revStations[0]}_UP`;
            this.spawnTrainFromRoute(tpl, startNode, revStations, revStations[revStations.length - 1]);
          }
        }
      }
    }
  }

  private applyActiveContingenciesToRoute(route: string[], cars: 2 | 3 = 3): string[] {
    let mod = [...route];

    // Plan A: Short-turn Lewisham trains at Canary Wharf P3/P4 Center Road
    const planA = this.contingencies.find((c) => c.id === 'CP_SHORT_CAW' && c.active);
    if (planA && mod[mod.length - 1] === 'LEW' && mod.includes('CAW')) {
      const idx = mod.indexOf('CAW');
      mod = mod.slice(0, idx + 1);
    }

    // Plan B (SOP-UG2 & SOP-TWG): Divert 2-car Bank trains to Tower Gateway; short-turn 3-car sets at Shadwell
    const planB = this.contingencies.find((c) => c.id === 'CP_DIVERT_TWG_BNK' && c.active);
    if (planB && mod[mod.length - 1] === 'BNK') {
      if (cars === 2) {
        mod[mod.length - 1] = 'TWG';
      } else if (mod.includes('SHA')) {
        const idx = mod.indexOf('SHA');
        mod = mod.slice(0, idx + 1);
      }
    }

    // Plan C: Short-turn Beckton trains at Custom House ExCeL Siding
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

    // SOP-WIQ: Filter out WIQ when running Northbound/Westbound from Canary Wharf (CAW) to Westferry (WFE) / Bank (BNK)
    return this.filterWiqForWestboundBypass(mod);
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

    // 2. Dwelling at station platform or stabling road
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

      // Check CBTC safe braking distance ahead & SOP-UG1 single-train-per-bore rule
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
      const prevSpeed = train.speedMph;
      train.previousEdgeId = edge.id;
      train.currentNodeId = train.nextNodeId;
      train.nodePath.shift();
      train.edgeProgress = 0;

      const arrivedNode = this.nodeMap[train.currentNodeId];
      const isPassThroughJunction = arrivedNode?.type === 'junction';
      const arrivedStId = arrivedNode?.stationId;

      const scheduledCall = arrivedStId === train.routeQueue[0];
      if (!isPassThroughJunction && arrivedStId && scheduledCall) {
        train.routeQueue.shift();
      }

      // Check if a manual NX route was locked from this node
      if (train.nodePath.length > 1) {
        const manualTarget = this.manualRoutes[train.currentNodeId];
        if (manualTarget) {
          const newTarget = this.nodeMap[manualTarget]?.stationId || manualTarget;
          this.rerouteTrainToDestination(train, newTarget);
          delete this.manualRoutes[train.currentNodeId];
        }
      }

      // If this is a flying/interlocking junction node (e.g. DLT_BYP_UP, RMJ, STI_XOVR, STR_MKT_JCT),
      // roll smoothly through at curve speed without stopping unless held at signal or block ahead occupied!
      if (isPassThroughJunction && train.nodePath.length > 1) {
        const nextId = train.nodePath[1];
        const ne = this.findEdge(train.currentNodeId, nextId);
        train.nextNodeId = nextId;
        train.currentEdgeId = ne ? ne.id : null;

        if (!arrivedNode?.signalHeld && !this.isBlockAheadOccupied(train, nextId) && ne) {
          train.speedMph = Math.min(prevSpeed, ne.maxSpeedMph);
          train.edgeProgress = 0.01;
          train.state = train.psaMode ? 'PSA_RECOVERY' : 'MOVING';
        } else {
          train.speedMph = 0;
          train.state = arrivedNode?.signalHeld ? 'HELD_AT_SIGNAL' : 'CBTC_BRAKING';
        }
        return;
      }

      train.speedMph = 0;

      if (arrivedStId) {
        const st = STATION_MAP[arrivedStId];
        const crowdMult = this.stationCrowdMultiplier[arrivedStId] || 1.0;

        // Check platform length alert (3-car train at 2-car platform like Cutty Sark / Elverson Rd)
        const selectiveDoorPenalty = train.cars === 3 && st && st.maxCars === 2 ? 6 : 0;

        let exchanged = 0;
        if (!train.isECS && st && arrivedNode?.type === 'platform' && (scheduledCall || train.nodePath.length <= 1)) {
          const terminal = train.nodePath.length <= 1 || !train.routeQueue.length;
          const airport = train.airportPassengers ?? 0;
          const throughAirport = !terminal && train.routeQueue.includes('LCA') ? airport : 0;
          const local = train.passengers - airport;
          const alighted = terminal ? train.passengers : Math.floor(local * (0.18 + Math.random() * 0.25)) + airport - throughAirport;
          train.airportPassengers = throughAirport;
          train.passengers -= alighted;
          this.stationFootfall[arrivedStId] += alighted;
          exchanged = alighted + (terminal ? 0 : this.boardWaiting(train, arrivedNode.id));
        }

        const baseDwell = train.isECS ? 4
          : Math.round(13 * crowdMult + exchanged / (train.cars * 2.5)) + selectiveDoorPenalty;
        train.dwellRemaining = baseDwell;
        train.state = train.nodePath.length <= 1 ? 'TURNBACK' : 'DWELLING';

        if (crowdMult > 1.35) {
          train.delaySeconds += 5;
        } else if (train.delaySeconds > 3) {
          train.delaySeconds = Math.max(0, train.delaySeconds - 3);
        }

        // Update nextNodeId pointer
        if (train.nodePath.length > 1) {
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

    const nextEdge = this.findEdge(train.currentNodeId, targetNodeId);

    for (const other of this.trains) {
      if (other.id === train.id) continue;
      // Another train is dwelling or stopped at targetNodeId
      if (other.currentNodeId === targetNodeId && other.edgeProgress < 0.45) {
        return true;
      }
      // SOP-UG1: Deep-tube & sub-aqueous river bores allow only 1 train per tunnel bore between portals!
      if (this.undergroundSopActive && nextEdge?.isTunnel && other.currentEdgeId === nextEdge.id) {
        return true;
      }
      // Another train is on the exact same edge right in front of us (< 38% ahead)
      if (other.currentNodeId === train.currentNodeId && other.nextNodeId === targetNodeId && other.edgeProgress < 0.42) {
        return true;
      }
    }
    return false;
  }

  private computeCbtcSpeedLimit(train: Train, edge: TrackEdge): number {
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

    // SOP-UG2: If a train terminates at Bank (BNK_UP) and the Bank Tail Headshunt Overrun Bore (BNK_HSH) is free,
    // reverse it via BNK_HSH -> BNK_DN -> return working if fleet size is reasonable!
    const tpl = this.templates.find((t) => t.id === train.templateId);
    if (
      train.currentNodeId === 'BNK_UP' &&
      tpl &&
      !train.isECS &&
      this.trains.length <= 16 &&
      !this.trains.some((o) => o.currentNodeId === 'BNK_HSH')
    ) {
      const returnDest = tpl.destId === 'BNK' ? tpl.originId : tpl.destId;
      const returnStations = this.applyActiveContingenciesToRoute([...tpl.routeStations], train.cars);
      const revPath = ['BNK_UP', 'BNK_HSH', ...this.buildFullNodePathForStations('BNK_HSH', returnStations, train.cars).slice(1)];
      if (revPath.length > 2) {
        train.nodePath = revPath;
        train.nextNodeId = revPath[1];
        train.currentEdgeId = this.findEdge('BNK_UP', revPath[1])?.id || null;
        train.routeQueue = returnStations.slice(1);
        train.originCode = 'BNK';
        train.destCode = returnDest;
        train.headcode = `${train.serviceNumber} ${returnDest}`;
        train.dwellRemaining = 10;
        train.delaySeconds = Math.max(0, train.delaySeconds - 20);
        train.state = 'TURNBACK';
        return;
      }
    }

    // If train arrived at a dedicated depot stabling road (BDP_R1..R4 or PDP_S1..S3), let it stable briefly then cycle back out
    const currNode = this.nodeMap[train.currentNodeId];
    if (currNode?.type === 'depot' && this.trains.length <= 15 && tpl) {
      const outDest = currNode.stationId === 'BDP' ? 'CAW' : 'BNK';
      const newPath = this.findNodePath(train.currentNodeId, outDest, train.cars, true);
      if (newPath.length > 2) {
        train.nodePath = newPath;
        train.nextNodeId = newPath[1];
        train.currentEdgeId = this.findEdge(train.currentNodeId, newPath[1])?.id || null;
        train.destCode = outDest;
        train.headcode = `${train.serviceNumber} ${outDest}`;
        train.dwellRemaining = 28;
        train.state = 'TURNBACK';
        return;
      }
    }

    const idx = this.trains.findIndex((t) => t.id === train.id);
    if (idx !== -1) {
      this.trains.splice(idx, 1);
    }
  }

  // Player Action: Set NX Entry-Exit Route between two nodes (supports station platforms, Delta chords, and depot roads!)
  public setManualNXRoute(entryNodeId: string, exitNodeId: string): { ok: boolean; msg: string } {
    const entryNode = this.nodeMap[entryNodeId];
    const exitNode = this.nodeMap[exitNodeId];
    if (!entryNode || !exitNode) {
      return { ok: false, msg: 'Invalid NX entry/exit signal selection.' };
    }

    const affectedTrain = this.trains.find(
      (t) => t.currentNodeId === entryNodeId || t.nextNodeId === entryNodeId
    );
    const checkCars: 2 | 3 = affectedTrain ? affectedTrain.cars : 2;

    // SOP-TWG check on manual NX route to Tower Gateway
    if (exitNode.stationId === 'TWG' && affectedTrain && affectedTrain.cars === 3) {
      soundEngine.playIncidentAlert(false);
      const rejectMsg = `SOP-TWG REJECT: Unit ${affectedTrain.headcode} is a 3-Car (90m) set and cannot enter Tower Gateway (60m 2-Car max). Auto-diverting to Shadwell (SHA) crossover!`;
      this.addLog('NX', rejectMsg);
      this.rerouteTrainToDestination(affectedTrain, 'SHA');
      return { ok: false, msg: rejectMsg };
    }

    const path = this.findNodePath(entryNodeId, exitNodeId, checkCars, true);
    if (path.length < 2) {
      return { ok: false, msg: `No valid interlocked route found from ${entryNode.name} to ${exitNode.name}.` };
    }

    this.manualRoutes[entryNodeId] = exitNodeId;
    entryNode.signalHeld = false;

    if (affectedTrain) {
      this.rerouteTrainToDestination(affectedTrain, exitNodeId);
    }

    soundEngine.playRelayClick(true);
    const msg = `NX Interlocking: Route locked ${entryNode.roadLabel || entryNode.id} → ${exitNode.roadLabel || exitNode.id} (${path.length - 1} blocks).`;
    this.addLog('NX', msg);
    this.onStateChange?.();
    return { ok: true, msg };
  }

  // Reroute an active train to a new destination station OR specific depot/turnback road (e.g. 'CAW_MID', 'BDP_R1', 'PDP_S2')
  public rerouteTrainToDestination(train: Train, newDestStationOrNodeId: string) {
    let targetId = newDestStationOrNodeId;
    const targetNodeObj = this.nodeMap[targetId];
    const resolvedStationId = targetNodeObj?.stationId || targetId;

    // Enforce SOP-TWG: 3-Car (90m) trains are physically locked out of Tower Gateway (60m 2-Car max)
    if (resolvedStationId === 'TWG' && train.cars === 3) {
      soundEngine.playIncidentAlert(false);
      this.addLog(
        'ARS',
        `SOP-TWG INTERLOCKING LOCKOUT: 3-Car Unit ${train.headcode} rejected at Royal Mint St for Tower Gateway (60m max) — short-turning at Shadwell (SHA) instead!`
      );
      targetId = 'SHA';
    }

    const startNode = train.edgeProgress > 0.1 && train.nextNodeId ? train.nextNodeId : train.currentNodeId;
    const newPath = this.findNodePath(startNode, targetId, train.cars, true);
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

    const finalStCode = this.nodeMap[newPath[newPath.length - 1]]?.stationId || targetId;
    train.routeQueue = stationSeq.slice(1);
    const oldDest = train.destCode;
    train.destCode = finalStCode;
    train.headcode = `${train.serviceNumber} ${finalStCode}`;
    train.diverted = true;

    const roadNote = this.nodeMap[targetId]?.roadLabel ? ` (${this.nodeMap[targetId].roadLabel})` : '';
    soundEngine.playSplitFlap(5);
    this.addLog('ARS', `Service ${train.serviceNumber} diverted from ${oldDest} to ${finalStCode}${roadNote}.`);
    this.rareRoutesCompleted.unshift({
      headcode: train.headcode,
      routeDesc: `${train.originCode} → ${finalStCode}${roadNote} (Live Control Diversion)`,
      timeStr: this.formatSimTime().slice(-8, -3),
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

  // "HELP ME! FIX IT!" — AI Chief Controller One-Sweep Emergency Stabilization
  public stabilizeNetworkAll(): { fixedCount: number; summary: string } {
    let fixedCount = 0;
    const actionsLog: string[] = [];

    // 1. Resolve all active blocking incidents using their primary recovery action
    const unresolved = this.incidents.filter((i) => !i.resolved);
    for (const inc of unresolved) {
      const act = inc.actions[0];
      if (act) {
        this.executeIncidentAction(inc.id, act.id);
        actionsLog.push(act.label);
      } else {
        inc.resolved = true;
      }
      fixedCount++;
    }

    // 2. Dispatch PSA to any remaining broken-down VOBC trains
    for (const tr of this.trains) {
      if (tr.state === 'BROKEN_DOWN') {
        this.dispatchPsaToTrain(tr.id);
        actionsLog.push(`PSA → ${tr.headcode}`);
        fixedCount++;
      }
    }

    // 3. Clear any lingering track blocks, points failures, or forgotten manual signal holds
    for (const n of this.nodes) {
      if (n.trackBlocked || n.pointsFailed || n.signalHeld) {
        n.trackBlocked = false;
        n.pointsFailed = false;
        n.signalHeld = false;
        fixedCount++;
      }
    }

    // 4. Short-turn heavily delayed trains (>95s) at the nearest intermediate turnback or Canary Wharf P3/P4
    for (const tr of this.trains) {
      if (tr.delaySeconds > 95 && !tr.diverted) {
        const turnSt = tr.routeQueue.slice(0, -1).find((stId) => STATION_MAP[stId]?.hasTurnback);
        if (turnSt) {
          this.rerouteTrainToDestination(tr, turnSt === 'CAW' ? 'CAW_MID' : turnSt);
          tr.delaySeconds = Math.max(15, Math.round(tr.delaySeconds * 0.35));
          actionsLog.push(`Short-turned ${tr.serviceNumber} → ${turnSt}`);
          fixedCount++;
        }
      }
    }

    // 5. Normalise station crowd surges
    for (const stId in this.stationCrowdMultiplier) {
      if (this.stationCrowdMultiplier[stId] > 1.2) {
        this.stationCrowdMultiplier[stId] = 1.0;
        fixedCount++;
      }
    }

    soundEngine.playSplitFlap(8);
    const summary =
      fixedCount > 0
        ? `AI Chief Controller resolved ${fixedCount} active issue(s): ${actionsLog.slice(0, 3).join(' · ') || 'Cleared all locks & delays'}.`
        : 'All 7 DLR branches are already clear and running smoothly — standing by on active watch.';
    this.addLog('ARS', `🆘 HELP ME! FIX IT! ENGAGED: ${summary}`);
    this.onStateChange?.();
    return { fixedCount, summary };
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
          this.rerouteTrainToDestination(t, 'CAW_MID');
        } else if (plan.id === 'CP_DIVERT_TWG_BNK' && t.destCode === 'BNK') {
          this.rerouteTrainToDestination(t, t.cars === 2 ? 'TWG' : 'SHA');
        } else if (plan.id === 'CP_BECKTON_CUH' && t.destCode === 'BCK' && t.routeQueue.includes('CUH')) {
          this.rerouteTrainToDestination(t, 'CUH_SID');
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
        { id: 'LCA', event: 'London City Airport Terminal Exit Surge', boost: 'LCA' },
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
