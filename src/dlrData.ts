import { Station, TrackNode, TrackEdge, ServiceTemplate, ContingencyPlan } from './types';

export const STATIONS: Station[] = [
  // WEST BRANCH (Bank & Tower Gateway to Poplar / West India Quay)
  { id: 'BNK', code: 'BNK', name: 'Bank', branch: 'West', x: 140, y: 470, maxCars: 3, baseDemand: 10, interchange: ['Central', 'Northern', 'W&C'], hasTurnback: true, isTerminus: true, labelPos: 'top' },
  { id: 'TWG', code: 'TWG', name: 'Tower Gateway', branch: 'West', x: 180, y: 555, maxCars: 2, baseDemand: 7, interchange: ['District', 'Circle', 'C2C'], hasTurnback: true, isTerminus: true, labelPos: 'bottom' },
  { id: 'SHA', code: 'SHA', name: 'Shadwell', branch: 'West', x: 310, y: 500, maxCars: 3, baseDemand: 6, interchange: ['Overground'], hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'LIM', code: 'LIM', name: 'Limehouse', branch: 'West', x: 425, y: 500, maxCars: 3, baseDemand: 6, interchange: ['C2C'], hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'WFE', code: 'WFE', name: 'Westferry', branch: 'West', x: 545, y: 500, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'top' },

  // NORTH BRANCH (Stratford to Poplar)
  { id: 'STR', code: 'STR', name: 'Stratford', branch: 'North', x: 760, y: 110, maxCars: 3, baseDemand: 9, interchange: ['Central', 'Jubilee', 'Elizabeth', 'Overground'], hasTurnback: true, isTerminus: true, labelPos: 'top' },
  { id: 'PML', code: 'PML', name: 'Pudding Mill Lane', branch: 'North', x: 700, y: 185, maxCars: 3, baseDemand: 4, hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'BOW', code: 'BOW', name: 'Bow Church', branch: 'North', x: 700, y: 255, maxCars: 3, baseDemand: 5, interchange: ['District', 'H&C'], hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'DEV', code: 'DEV', name: 'Devons Road', branch: 'North', x: 700, y: 320, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'LAN', code: 'LAN', name: 'Langdon Park', branch: 'North', x: 700, y: 385, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'ALL', code: 'ALL', name: 'All Saints', branch: 'North', x: 700, y: 445, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'left' },

  // CENTRAL HUB (Poplar & Poplar Depot)
  { id: 'POP', code: 'POP', name: 'Poplar', branch: 'Central', x: 750, y: 500, maxCars: 3, baseDemand: 8, hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'PDP', code: 'PDP', name: 'Poplar Depot', branch: 'Central', x: 830, y: 435, maxCars: 3, baseDemand: 1, hasTurnback: true, isTerminus: true, labelPos: 'top' },
  { id: 'BLW', code: 'BLW', name: 'Blackwall', branch: 'Central', x: 900, y: 500, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'EIR', code: 'EIR', name: 'East India', branch: 'Central', x: 1015, y: 500, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'top' },

  // SOUTH BRANCH (Isle of Dogs & Lewisham)
  { id: 'WIQ', code: 'WIQ', name: 'West India Quay', branch: 'South', x: 640, y: 575, maxCars: 3, baseDemand: 6, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'CAW', code: 'CAW', name: 'Canary Wharf', branch: 'South', x: 640, y: 645, maxCars: 3, baseDemand: 10, interchange: ['Jubilee', 'Elizabeth'], hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'HER', code: 'HER', name: 'Heron Quays', branch: 'South', x: 640, y: 710, maxCars: 3, baseDemand: 7, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'SQY', code: 'SQY', name: 'South Quay', branch: 'South', x: 640, y: 765, maxCars: 3, baseDemand: 7, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'CRH', code: 'CRH', name: 'Crossharbour', branch: 'South', x: 640, y: 825, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'MUD', code: 'MUD', name: 'Mudchute', branch: 'South', x: 640, y: 880, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'ISG', code: 'ISG', name: 'Island Gardens', branch: 'South', x: 640, y: 935, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'CUT', code: 'CUT', name: 'Cutty Sark', branch: 'South', x: 640, y: 995, maxCars: 2, baseDemand: 8, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'GRE', code: 'GRE', name: 'Greenwich', branch: 'South', x: 640, y: 1055, maxCars: 3, baseDemand: 8, interchange: ['Southeastern', 'Thameslink'], hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'DEP', code: 'DEP', name: 'Deptford Bridge', branch: 'South', x: 640, y: 1110, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'ELV', code: 'ELV', name: 'Elverson Road', branch: 'South', x: 640, y: 1165, maxCars: 2, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'LEW', code: 'LEW', name: 'Lewisham', branch: 'South', x: 640, y: 1225, maxCars: 3, baseDemand: 9, interchange: ['Southeastern'], hasTurnback: true, isTerminus: true, labelPos: 'bottom' },

  // STRATFORD INTERNATIONAL BRANCH (Stratford Intl to Canning Town)
  { id: 'STI', code: 'STI', name: 'Stratford International', branch: 'StratfordIntl', x: 1020, y: 80, maxCars: 3, baseDemand: 8, interchange: ['HS1 Southeastern'], hasTurnback: true, isTerminus: true, labelPos: 'top' },
  { id: 'SHS', code: 'SHS', name: 'Stratford High Street', branch: 'StratfordIntl', x: 1060, y: 165, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'right' },
  { id: 'ABB', code: 'ABB', name: 'Abbey Road', branch: 'StratfordIntl', x: 1090, y: 245, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'right' },
  { id: 'WHM', code: 'WHM', name: 'West Ham', branch: 'StratfordIntl', x: 1120, y: 330, maxCars: 3, baseDemand: 7, interchange: ['Jubilee', 'District', 'C2C'], hasTurnback: false, isTerminus: false, labelPos: 'right' },
  { id: 'STL', code: 'STL', name: 'Star Lane', branch: 'StratfordIntl', x: 1145, y: 415, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'right' },

  // CANNING TOWN INTERCHANGE
  { id: 'CNT', code: 'CNT', name: 'Canning Town', branch: 'Central', x: 1175, y: 500, maxCars: 3, baseDemand: 9, interchange: ['Jubilee'], hasTurnback: true, isTerminus: false, labelPos: 'bottom' },

  // BECKTON BRANCH (Royal Victoria to Beckton + Beckton Depot)
  { id: 'RVC', code: 'RVC', name: 'Royal Victoria', branch: 'Beckton', x: 1320, y: 420, maxCars: 3, baseDemand: 6, interchange: ['IFS Cloud Cable Car'], hasTurnback: false, isTerminus: false, labelPos: 'top' },
  { id: 'CUH', code: 'CUH', name: 'Custom House (ExCeL)', branch: 'Beckton', x: 1455, y: 420, maxCars: 3, baseDemand: 9, interchange: ['Elizabeth'], hasTurnback: true, isTerminus: false, labelPos: 'bottom' },
  { id: 'PRR', code: 'PRR', name: 'Prince Regent', branch: 'Beckton', x: 1590, y: 420, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'RAL', code: 'RAL', name: 'Royal Albert', branch: 'Beckton', x: 1720, y: 420, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'BKP', code: 'BKP', name: 'Beckton Park', branch: 'Beckton', x: 1850, y: 420, maxCars: 3, baseDemand: 3, hasTurnback: false, isTerminus: false, labelPos: 'top' },
  { id: 'CYP', code: 'CYP', name: 'Cyprus', branch: 'Beckton', x: 1980, y: 420, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'GAL', code: 'GAL', name: 'Gallions Reach', branch: 'Beckton', x: 2110, y: 420, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'BCK', code: 'BCK', name: 'Beckton', branch: 'Beckton', x: 2240, y: 420, maxCars: 3, baseDemand: 7, hasTurnback: true, isTerminus: true, labelPos: 'bottom' },
  { id: 'BDP', code: 'BDP', name: 'Beckton Depot', branch: 'Beckton', x: 2150, y: 315, maxCars: 3, baseDemand: 1, hasTurnback: true, isTerminus: true, labelPos: 'top' },

  // WOOLWICH ARSENAL BRANCH (West Silvertown to Woolwich Arsenal)
  { id: 'WSV', code: 'WSV', name: 'West Silvertown', branch: 'Woolwich', x: 1330, y: 600, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'top' },
  { id: 'PDK', code: 'PDK', name: 'Pontoon Dock', branch: 'Woolwich', x: 1495, y: 600, maxCars: 3, baseDemand: 6, hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'LCA', code: 'LCA', name: 'London City Airport', branch: 'Woolwich', x: 1665, y: 600, maxCars: 3, baseDemand: 9, hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'KGV', code: 'KGV', name: 'King George V', branch: 'Woolwich', x: 1840, y: 600, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'bottom' },
  { id: 'WOO', code: 'WOO', name: 'Woolwich Arsenal', branch: 'Woolwich', x: 2015, y: 600, maxCars: 3, baseDemand: 9, interchange: ['Elizabeth', 'Southeastern'], hasTurnback: true, isTerminus: true, labelPos: 'top' },
];

// standard station lookup
export const STATION_MAP: Record<string, Station> = {};
for (const s of STATIONS) {
  STATION_MAP[s.id] = s;
}

// Generate dual-track schematic nodes (UP and DN tracks for each station + turnback/junction nodes)
export function buildNetworkGraph(): { nodes: TrackNode[]; edges: TrackEdge[] } {
  const nodes: TrackNode[] = [];
  const edges: TrackEdge[] = [];

  for (const st of STATIONS) {
    // Fix ID for Royal Albert
    const stId = st.id === ' Albert' ? 'RAL' : st.id;
    st.id = stId;
    STATION_MAP[stId] = st;

    const isVertical = st.branch === 'North' || st.branch === 'South' || st.branch === 'StratfordIntl';

    // Create UP (West/Northbound) and DN (East/Southbound) platform nodes
    const offset = 12;
    const upX = isVertical ? st.x - offset : st.x;
    const upY = isVertical ? st.y : st.y - offset;
    const dnX = isVertical ? st.x + offset : st.x;
    const dnY = isVertical ? st.y : st.y + offset;

    nodes.push({
      id: `${stId}_UP`,
      name: `${st.name} P1 (UP)`,
      stationId: stId,
      platform: '1',
      type: st.isTerminus && stId.includes('DP') ? 'depot' : 'platform',
      x: upX,
      y: upY,
      direction: 'UP',
      maxCars: st.maxCars,
      signalAspect: 'GREEN',
      signalHeld: false,
      hasSignal: st.hasTurnback || st.isTerminus || ['WFE', 'POP', 'CNT', 'WIQ', 'CAW', 'GRE', 'LCA', 'CUH'].includes(stId),
    });

    nodes.push({
      id: `${stId}_DN`,
      name: `${st.name} P2 (DN)`,
      stationId: stId,
      platform: '2',
      type: st.isTerminus && stId.includes('DP') ? 'depot' : 'platform',
      x: dnX,
      y: dnY,
      direction: 'DN',
      maxCars: st.maxCars,
      signalAspect: 'GREEN',
      signalHeld: false,
      hasSignal: st.hasTurnback || st.isTerminus || ['WFE', 'POP', 'CNT', 'WIQ', 'CAW', 'GRE', 'LCA', 'CUH'].includes(stId),
    });

    // If station has turnback or is terminus, add bidirectional crossover edges between UP and DN
    if (st.hasTurnback || st.isTerminus) {
      edges.push({
        id: `X_${stId}_DN_UP`,
        from: `${stId}_DN`,
        to: `${stId}_UP`,
        lengthMeters: 120,
        maxSpeedMph: 20,
        isCrossover: true,
      });
      edges.push({
        id: `X_${stId}_UP_DN`,
        from: `${stId}_UP`,
        to: `${stId}_DN`,
        lengthMeters: 120,
        maxSpeedMph: 20,
        isCrossover: true,
      });
    }
  }

  const connectStations = (fromSt: string, toSt: string, distMeters: number, maxSpeedMph = 40, isFlyover = false, isTunnel = false) => {
    // DN direction: fromSt -> toSt
    edges.push({
      id: `E_${fromSt}_${toSt}_DN`,
      from: `${fromSt}_DN`,
      to: `${toSt}_DN`,
      lengthMeters: distMeters,
      maxSpeedMph,
      isFlyover,
      isTunnel,
    });
    // UP direction: toSt -> fromSt
    edges.push({
      id: `E_${toSt}_${fromSt}_UP`,
      from: `${toSt}_UP`,
      to: `${fromSt}_UP`,
      lengthMeters: distMeters,
      maxSpeedMph,
      isFlyover,
      isTunnel,
    });
  };

  // 1. WEST BRANCH: Bank & Tower Gateway -> Shadwell -> Limehouse -> Westferry
  connectStations('BNK', 'SHA', 1450, 35, false, true); // Bank deep tube tunnel
  connectStations('TWG', 'SHA', 1100, 30);
  connectStations('SHA', 'LIM', 1050, 45);
  connectStations('LIM', 'WFE', 950, 45);

  // DELTA JUNCTION (Westferry <-> Poplar, Westferry <-> West India Quay, Poplar <-> West India Quay)
  connectStations('WFE', 'POP', 950, 35, true); // Westferry to Poplar flyover
  connectStations('WFE', 'WIQ', 650, 25, true); // Westferry to West India Quay curve
  // Poplar to West India Quay (North-South link: POP is North of WIQ)
  edges.push({
    id: `E_POP_WIQ_DN`,
    from: `POP_DN`,
    to: `WIQ_DN`,
    lengthMeters: 600,
    maxSpeedMph: 25,
    isFlyover: true,
  });
  edges.push({
    id: `E_WIQ_POP_UP`,
    from: `WIQ_UP`,
    to: `POP_UP`,
    lengthMeters: 600,
    maxSpeedMph: 25,
    isFlyover: true,
  });

  // 2. NORTH BRANCH: Stratford -> Pudding Mill Lane -> Bow Church -> Devons Rd -> Langdon Park -> All Saints -> Poplar
  connectStations('STR', 'PML', 950, 40);
  connectStations('PML', 'BOW', 850, 40);
  connectStations('BOW', 'DEV', 750, 35);
  connectStations('DEV', 'LAN', 700, 35);
  connectStations('LAN', 'ALL', 650, 35);
  connectStations('ALL', 'POP', 650, 25);

  // Poplar Depot connections to Poplar
  connectStations('PDP', 'POP', 450, 15);
  connectStations('POP', 'PDP', 450, 15);

  // 3. SOUTH BRANCH: West India Quay -> Canary Wharf -> ... -> Lewisham
  connectStations('WIQ', 'CAW', 450, 25);
  connectStations('CAW', 'HER', 450, 30);
  connectStations('HER', 'SQY', 550, 30);
  connectStations('SQY', 'CRH', 650, 35);
  connectStations('CRH', 'MUD', 650, 35);
  connectStations('MUD', 'ISG', 650, 35, false, true);
  connectStations('ISG', 'CUT', 950, 40, false, true); // Thames Foot Tunnel / Deep River Bore
  connectStations('CUT', 'GRE', 750, 35, false, true);
  connectStations('GRE', 'DEP', 750, 35);
  connectStations('DEP', 'ELV', 650, 35);
  connectStations('ELV', 'LEW', 650, 30);

  // 4. CENTRAL TRUNK: Poplar -> Blackwall -> East India -> Canning Town
  connectStations('POP', 'BLW', 950, 40);
  connectStations('BLW', 'EIR', 850, 40);
  connectStations('EIR', 'CNT', 1050, 40, true);

  // 5. STRATFORD INTERNATIONAL -> Canning Town
  connectStations('STI', 'SHS', 950, 45);
  connectStations('SHS', 'ABB', 750, 45);
  connectStations('ABB', 'WHM', 850, 45);
  connectStations('WHM', 'STL', 800, 40);
  connectStations('STL', 'CNT', 850, 35);

  // 6. BECKTON BRANCH: Canning Town -> Royal Victoria -> ... -> Beckton (+ Beckton Depot)
  connectStations('CNT', 'RVC', 950, 40, true);
  connectStations('RVC', 'CUH', 800, 40);
  connectStations('CUH', 'PRR', 750, 40);
  connectStations('PRR', 'RAL', 850, 45);
  connectStations('RAL', 'BKP', 800, 45);
  connectStations('BKP', 'CYP', 750, 45);
  connectStations('CYP', 'GAL', 850, 40);
  connectStations('GAL', 'BCK', 950, 30);
  // Beckton Depot connects to Gallions Reach and Beckton
  connectStations('GAL', 'BDP', 550, 15);
  connectStations('BDP', 'GAL', 550, 15);
  connectStations('BDP', 'BCK', 550, 15);

  // 7. WOOLWICH ARSENAL BRANCH: Canning Town -> West Silvertown -> ... -> Woolwich Arsenal
  connectStations('CNT', 'WSV', 1100, 45, true);
  connectStations('WSV', 'PDK', 850, 40);
  connectStations('PDK', 'LCA', 950, 40, true);
  connectStations('LCA', 'KGV', 1050, 45);
  connectStations('KGV', 'WOO', 1550, 50, false, true); // Thames Tunnel to Woolwich

  return { nodes, edges };
}

export const INITIAL_TEMPLATES: ServiceTemplate[] = [
  {
    id: 'T_BNK_LEW',
    name: 'Bank ↔ Lewisham',
    codePrefix: '1',
    originId: 'BNK',
    destId: 'LEW',
    routeStations: ['BNK', 'SHA', 'LIM', 'WFE', 'WIQ', 'CAW', 'HER', 'SQY', 'CRH', 'MUD', 'ISG', 'CUT', 'GRE', 'DEP', 'ELV', 'LEW'],
    intervalMins: 4,
    cars: 3,
    active: true,
    color: '#00A4A7', // DLR Teal
  },
  {
    id: 'T_BNK_WOO',
    name: 'Bank ↔ Woolwich Arsenal',
    codePrefix: '2',
    originId: 'BNK',
    destId: 'WOO',
    routeStations: ['BNK', 'SHA', 'LIM', 'WFE', 'POP', 'BLW', 'EIR', 'CNT', 'WSV', 'PDK', 'LCA', 'KGV', 'WOO'],
    intervalMins: 6,
    cars: 3,
    active: true,
    color: '#38BDF8', // Sky Blue
  },
  {
    id: 'T_TWG_BCK',
    name: 'Tower Gateway ↔ Beckton',
    codePrefix: '3',
    originId: 'TWG',
    destId: 'BCK',
    routeStations: ['TWG', 'SHA', 'LIM', 'WFE', 'POP', 'BLW', 'EIR', 'CNT', 'RVC', 'CUH', 'PRR', 'RAL', 'BKP', 'CYP', 'GAL', 'BCK'],
    intervalMins: 6,
    cars: 2, // Tower Gateway is 2-car restricted!
    active: true,
    color: '#F59E0B', // Amber Gold
  },
  {
    id: 'T_STR_CAW_LEW',
    name: 'Stratford ↔ Canary Wharf / Lewisham',
    codePrefix: '4',
    originId: 'STR',
    destId: 'LEW',
    routeStations: ['STR', 'PML', 'BOW', 'DEV', 'LAN', 'ALL', 'POP', 'WIQ', 'CAW', 'HER', 'SQY', 'CRH', 'MUD', 'ISG', 'CUT', 'GRE', 'DEP', 'ELV', 'LEW'],
    intervalMins: 5,
    cars: 3,
    active: true,
    color: '#A855F7', // Purple
  },
  {
    id: 'T_STI_WOO',
    name: 'Stratford International ↔ Woolwich Arsenal',
    codePrefix: '5',
    originId: 'STI',
    destId: 'WOO',
    routeStations: ['STI', 'SHS', 'ABB', 'WHM', 'STL', 'CNT', 'WSV', 'PDK', 'LCA', 'KGV', 'WOO'],
    intervalMins: 6,
    cars: 3,
    active: true,
    color: '#10B981', // Emerald
  },
  {
    id: 'T_ECS_DEPOT',
    name: 'Beckton Depot → Poplar / Canary Wharf (ECS)',
    codePrefix: '9',
    originId: 'BDP',
    destId: 'CAW',
    routeStations: ['BDP', 'GAL', 'CYP', 'BKP', 'RAL', 'PRR', 'CUH', 'RVC', 'CNT', 'EIR', 'BLW', 'POP', 'WIQ', 'CAW'],
    intervalMins: 14,
    cars: 3,
    isECS: true,
    active: true,
    color: '#94A3B8', // Slate ECS
  },
];

export const CONTINGENCY_PLANS: ContingencyPlan[] = [
  {
    id: 'CP_SHORT_CAW',
    name: 'Short-Turn Lewisham Services at Canary Wharf',
    shortCode: 'PLAN A: CAW TURNBACK',
    description: 'Terminates southbound Bank/Stratford services at Canary Wharf Platform 2/3 when the Greenwich foot-tunnel bore or Mudchute section is obstructed.',
    active: false,
    affectedBranch: 'South (Isle of Dogs / Lewisham)',
    effectSummary: 'Reroutes LEW trains to reverse at CAW',
  },
  {
    id: 'CP_DIVERT_TWG_BNK',
    name: 'Divert Westbound Services Away from Bank to Tower Gateway',
    shortCode: 'PLAN B: TWG DIVERT',
    description: 'Diverts 2-car westbound services into Tower Gateway and short-turns 3-car sets at Shadwell/Westferry during Bank tunnel emergencies.',
    active: false,
    affectedBranch: 'West (Bank / Shadwell)',
    effectSummary: 'Diverts Westbound trains to TWG / SHA',
  },
  {
    id: 'CP_BECKTON_CUH',
    name: 'Short-Turn Beckton Branch at Custom House (ExCeL)',
    shortCode: 'PLAN C: CUH SHUTTLE',
    description: 'Reverses Eastbound Beckton services at Custom House turnback siding to maintain high frequency for ExCeL Exhibition crowds.',
    active: false,
    affectedBranch: 'Beckton (Custom House – Beckton)',
    effectSummary: 'Reverses BCK trains at CUH siding',
  },
  {
    id: 'CP_AIRPORT_LCA',
    name: 'Woolwich Tunnel Blockade — Turnback at London City Airport',
    shortCode: 'PLAN D: LCA TURNBACK',
    description: 'Reverses Woolwich Arsenal services at London City Airport crossover when King George V or the Woolwich Thames tunnel is blocked.',
    active: false,
    affectedBranch: 'Woolwich (City Airport – Woolwich)',
    effectSummary: 'Terminates WOO trains at LCA',
  },
];
