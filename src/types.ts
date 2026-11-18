export interface Station {
  id: string;
  code: string;
  name: string;
  branch: 'West' | 'North' | 'Central' | 'South' | 'Beckton' | 'Woolwich' | 'StratfordIntl';
  x: number;
  y: number;
  maxCars: 2 | 3;
  baseDemand: number; // 1 to 10 scale
  interchange?: string[];
  hasTurnback: boolean;
  isTerminus: boolean;
  labelPos?: 'top' | 'bottom' | 'left' | 'right';
}

export interface TrackNode {
  id: string;
  name: string;
  stationId?: string;
  platform?: string;
  type: 'platform' | 'junction' | 'siding' | 'depot' | 'crossover';
  x: number;
  y: number;
  direction: 'UP' | 'DN' | 'BI'; // UP = North/Westbound towards Bank/Stratford, DN = South/Eastbound towards Lewisham/Beckton/Woolwich
  maxCars: 2 | 3;
  signalAspect: 'GREEN' | 'AMBER' | 'RED' | 'FLASH_AMBER';
  signalHeld: boolean; // Player manually held signal at RED
  pointsFailed?: boolean;
  trackBlocked?: boolean;
  hasSignal: boolean;
  roadLabel?: string; // Short schematic label for depot roads, headshunts, or delta chords (e.g. "BDP RD 1", "BNK HSH", "CAW P3/4")
}

export interface TrackEdge {
  id: string;
  from: string;
  to: string;
  lengthMeters: number;
  maxSpeedMph: number;
  isFlyover?: boolean;
  isTunnel?: boolean;
  isSingleLineWorking?: boolean;
  isCrossover?: boolean;
  edgeLabel?: string; // Optional schematic label along chord/flyover/bore
  waypoints?: { x: number; y: number }[];
}

export interface ServiceTemplate {
  id: string;
  name: string;
  codePrefix: string; // e.g. '1', '2', '3', '4', '5', '6', '9'
  originId: string;
  destId: string;
  routeStations: string[]; // Station IDs in order
  intervalMins: number;
  cars: 2 | 3;
  isECS?: boolean;
  isException?: boolean;
  exceptionReason?: string;
  active: boolean;
  color: string;
}

export type TrainState = 'MOVING' | 'DWELLING' | 'HELD_AT_SIGNAL' | 'CBTC_BRAKING' | 'BROKEN_DOWN' | 'PSA_RECOVERY' | 'TURNBACK';

export interface Train {
  id: string;
  headcode: string; // e.g., "104 BNK" or "312 LEW"
  serviceNumber: string; // e.g., "104"
  destCode: string; // e.g., "BNK"
  originCode: string;
  templateId: string;
  cars: 2 | 3;
  isECS: boolean;
  psaMode: boolean; // Passenger Service Agent manual driving (18 mph max)
  state: TrainState;
  currentNodeId: string;
  nextNodeId: string | null;
  currentEdgeId: string | null;
  edgeProgress: number; // 0.0 to 1.0 along current edge
  speedMph: number;
  targetSpeedMph: number;
  routeQueue: string[]; // Queue of station IDs left to visit
  nodePath: string[]; // Computed node-by-node path
  delaySeconds: number;
  dwellRemaining: number;
  passengers: number;
  maxCapacity: number;
  color: string;
  breakdownReason?: string;
  diverted?: boolean;
  shortTurned?: boolean;
}

export interface IncidentAction {
  id: string;
  label: string;
  description: string;
  contingencyId?: string;
  effectType: 'DISPATCH_PSA' | 'ACTIVATE_CONTINGENCY' | 'CLEAR_FAULT' | 'BOOST_SERVICE' | 'HOLD_RELEASE';
  targetId?: string;
}

export interface ActiveIncident {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY';
  stationId?: string;
  nodeId?: string;
  trainId?: string;
  timestamp: number; // Sim time in seconds
  resolved: boolean;
  actions: IncidentAction[];
  activeContingencyId?: string;
}

export interface ContingencyPlan {
  id: string;
  name: string;
  shortCode: string;
  description: string;
  active: boolean;
  affectedBranch: string;
  effectSummary: string;
}

export interface LogEntry {
  id: string;
  simTimeStr: string;
  category: 'ARS' | 'NX' | 'INCIDENT' | 'TIMETABLE' | 'PSA';
  message: string;
}
