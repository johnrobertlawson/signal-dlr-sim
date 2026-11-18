import { Station, TrackNode, TrackEdge, ServiceTemplate, ContingencyPlan } from './types';

export const STATIONS: Station[] = [
  // 1. WEST BRANCH (Bank Deep-Tube Bore & Tower Gateway 2-Car Viaduct -> Royal Mint St -> Shadwell -> Limehouse -> Westferry)
  { id: 'BNK', code: 'BNK', name: 'Bank', branch: 'West', x: 165, y: 430, maxCars: 3, baseDemand: 10, interchange: ['Central', 'Northern', 'W&C'], hasTurnback: true, isTerminus: true, labelPos: 'top' },
  { id: 'TWG', code: 'TWG', name: 'Tower Gateway', branch: 'West', x: 175, y: 575, maxCars: 2, baseDemand: 7, interchange: ['District', 'Circle', 'C2C'], hasTurnback: true, isTerminus: true, labelPos: 'bottom' },
  { id: 'SHA', code: 'SHA', name: 'Shadwell', branch: 'West', x: 355, y: 500, maxCars: 3, baseDemand: 6, interchange: ['Overground'], hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'LIM', code: 'LIM', name: 'Limehouse', branch: 'West', x: 450, y: 500, maxCars: 3, baseDemand: 6, interchange: ['C2C'], hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'WFE', code: 'WFE', name: 'Westferry', branch: 'West', x: 545, y: 500, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'top' },

  // 2. STRATFORD INTERNATIONAL & STRATFORD REGIONAL OLYMPIC COMPLEX + NORTH BRANCH (to Poplar)
  { id: 'STI', code: 'STI', name: 'Stratford International', branch: 'StratfordIntl', x: 945, y: 62, maxCars: 3, baseDemand: 8, interchange: ['HS1 Southeastern'], hasTurnback: true, isTerminus: true, labelPos: 'top' },
  { id: 'STR', code: 'STR', name: 'Stratford', branch: 'North', x: 845, y: 134, maxCars: 3, baseDemand: 10, interchange: ['Central', 'Jubilee', 'Elizabeth', 'Overground'], hasTurnback: true, isTerminus: true, labelPos: 'bottom' },
  { id: 'PML', code: 'PML', name: 'Pudding Mill Lane', branch: 'North', x: 740, y: 204, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'right' },
  { id: 'BOW', code: 'BOW', name: 'Bow Church', branch: 'North', x: 740, y: 264, maxCars: 3, baseDemand: 5, interchange: ['District', 'H&C'], hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'DEV', code: 'DEV', name: 'Devons Road', branch: 'North', x: 740, y: 320, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'LAN', code: 'LAN', name: 'Langdon Park', branch: 'North', x: 740, y: 376, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'ALL', code: 'ALL', name: 'All Saints', branch: 'North', x: 740, y: 432, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'left' },

  // 3. STRATFORD INTERNATIONAL -> LEA VALLEY -> CANNING TOWN BRANCH (via Stratford Regional P16/P17)
  { id: 'SHS', code: 'SHS', name: 'Stratford High Street', branch: 'StratfordIntl', x: 1105, y: 198, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'right' },
  { id: 'ABB', code: 'ABB', name: 'Abbey Road', branch: 'StratfordIntl', x: 1135, y: 270, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'right' },
  { id: 'WHM', code: 'WHM', name: 'West Ham', branch: 'StratfordIntl', x: 1165, y: 342, maxCars: 3, baseDemand: 7, interchange: ['Jubilee', 'District', 'C2C'], hasTurnback: false, isTerminus: false, labelPos: 'right' },
  { id: 'STL', code: 'STL', name: 'Star Lane', branch: 'StratfordIntl', x: 1192, y: 416, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'right' },

  // 4. CENTRAL HUB & EXPANDED DELTA + POPLAR MULTI-ROAD DEPOT
  { id: 'POP', code: 'POP', name: 'Poplar', branch: 'Central', x: 810, y: 500, maxCars: 3, baseDemand: 8, hasTurnback: true, isTerminus: false, labelPos: 'bottom' },
  { id: 'PDP', code: 'PDP', name: 'Poplar Depot', branch: 'Central', x: 915, y: 352, maxCars: 3, baseDemand: 1, hasTurnback: true, isTerminus: true, labelPos: 'top' },
  { id: 'BLW', code: 'BLW', name: 'Blackwall', branch: 'Central', x: 965, y: 500, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'EIR', code: 'EIR', name: 'East India', branch: 'Central', x: 1085, y: 500, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'top' },

  // 5. SOUTH BRANCH (West India Quay Asymmetric 4-Track Delta -> Canary Wharf 3-Road Hub -> Isle of Dogs -> Thames -> Lewisham)
  { id: 'WIQ', code: 'WIQ', name: 'West India Quay', branch: 'South', x: 705, y: 615, maxCars: 3, baseDemand: 6, hasTurnback: false, isTerminus: false, labelPos: 'right' },
  { id: 'CAW', code: 'CAW', name: 'Canary Wharf', branch: 'South', x: 705, y: 685, maxCars: 3, baseDemand: 10, interchange: ['Jubilee', 'Elizabeth'], hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'HER', code: 'HER', name: 'Heron Quays', branch: 'South', x: 705, y: 745, maxCars: 3, baseDemand: 7, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'SQY', code: 'SQY', name: 'South Quay', branch: 'South', x: 705, y: 795, maxCars: 3, baseDemand: 7, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'CRH', code: 'CRH', name: 'Crossharbour', branch: 'South', x: 705, y: 845, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'MUD', code: 'MUD', name: 'Mudchute', branch: 'South', x: 705, y: 895, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'ISG', code: 'ISG', name: 'Island Gardens', branch: 'South', x: 705, y: 945, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'left' },
  // --- RIVER THAMES GREENWICH SUB-AQUEOUS BORE (y = 987) ---
  { id: 'CUT', code: 'CUT', name: 'Cutty Sark', branch: 'South', x: 705, y: 1030, maxCars: 2, baseDemand: 8, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'GRE', code: 'GRE', name: 'Greenwich', branch: 'South', x: 705, y: 1085, maxCars: 3, baseDemand: 8, interchange: ['Southeastern', 'Thameslink'], hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'DEP', code: 'DEP', name: 'Deptford Bridge', branch: 'South', x: 705, y: 1135, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'ELV', code: 'ELV', name: 'Elverson Road', branch: 'South', x: 705, y: 1185, maxCars: 2, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'LEW', code: 'LEW', name: 'Lewisham', branch: 'South', x: 705, y: 1240, maxCars: 3, baseDemand: 9, interchange: ['Southeastern'], hasTurnback: true, isTerminus: true, labelPos: 'bottom' },

  // 6. CANNING TOWN STACKED INTERCHANGE
  { id: 'CNT', code: 'CNT', name: 'Canning Town', branch: 'Central', x: 1215, y: 500, maxCars: 3, baseDemand: 9, interchange: ['Jubilee'], hasTurnback: true, isTerminus: false, labelPos: 'bottom' },

  // 7. BECKTON BRANCH (Wrapped Non-Geographically Upward after Beckton Park for Expanded Beckton Depot & Stabling Complex)
  { id: 'RVC', code: 'RVC', name: 'Royal Victoria', branch: 'Beckton', x: 1350, y: 430, maxCars: 3, baseDemand: 6, interchange: ['IFS Cloud Cable Car'], hasTurnback: false, isTerminus: false, labelPos: 'top' },
  { id: 'CUH', code: 'CUH', name: 'Custom House (ExCeL)', branch: 'Beckton', x: 1485, y: 430, maxCars: 3, baseDemand: 9, interchange: ['Elizabeth'], hasTurnback: true, isTerminus: false, labelPos: 'bottom' },
  { id: 'PRR', code: 'PRR', name: 'Prince Regent', branch: 'Beckton', x: 1625, y: 430, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'RAL', code: 'RAL', name: 'Royal Albert', branch: 'Beckton', x: 1760, y: 430, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'BKP', code: 'BKP', name: 'Beckton Park', branch: 'Beckton', x: 1895, y: 430, maxCars: 3, baseDemand: 3, hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'CYP', code: 'CYP', name: 'Cyprus', branch: 'Beckton', x: 1965, y: 315, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'right' },
  { id: 'GAL', code: 'GAL', name: 'Gallions Reach', branch: 'Beckton', x: 1855, y: 220, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'bottom' },
  { id: 'BCK', code: 'BCK', name: 'Beckton', branch: 'Beckton', x: 1585, y: 220, maxCars: 3, baseDemand: 7, hasTurnback: true, isTerminus: true, labelPos: 'bottom' },
  { id: 'BDP', code: 'BDP', name: 'Beckton Depot', branch: 'Beckton', x: 1720, y: 115, maxCars: 3, baseDemand: 1, hasTurnback: true, isTerminus: true, labelPos: 'top' },

  // 8. WOOLWICH ARSENAL BRANCH (North Bank: WSV -> PDK -> LCA -> KGV, then UNDER the Labelled River Thames to WOO!)
  { id: 'WSV', code: 'WSV', name: 'West Silvertown', branch: 'Woolwich', x: 1355, y: 575, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'top' },
  { id: 'PDK', code: 'PDK', name: 'Pontoon Dock', branch: 'Woolwich', x: 1495, y: 575, maxCars: 3, baseDemand: 6, hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'LCA', code: 'LCA', name: 'London City Airport', branch: 'Woolwich', x: 1645, y: 575, maxCars: 3, baseDemand: 9, hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'KGV', code: 'KGV', name: 'King George V', branch: 'Woolwich', x: 1795, y: 575, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'top' },
  // --- RIVER THAMES WOOLWICH SUB-AQUEOUS BORE (y = 685) ---
  { id: 'WOO', code: 'WOO', name: 'Woolwich Arsenal', branch: 'Woolwich', x: 1855, y: 795, maxCars: 3, baseDemand: 9, interchange: ['Elizabeth', 'Southeastern'], hasTurnback: true, isTerminus: true, labelPos: 'bottom' },
];

export const STATION_MAP: Record<string, Station> = {};
for (const s of STATIONS) {
  STATION_MAP[s.id] = s;
}

export function buildNetworkGraph(): { nodes: TrackNode[]; edges: TrackEdge[] } {
  const nodes: TrackNode[] = [];
  const edges: TrackEdge[] = [];

  for (const st of STATIONS) {
    const stId = st.id === ' Albert' ? 'RAL' : st.id;
    st.id = stId;
    STATION_MAP[stId] = st;

    const isVertical =
      (st.branch === 'North' && stId !== 'STR') ||
      st.branch === 'South' ||
      (st.branch === 'StratfordIntl' && stId !== 'STI') ||
      stId === 'CYP';

    const offset = stId === 'CAW' ? 20 : 12;
    const upX = isVertical ? st.x - offset : st.x;
    const upY = isVertical ? st.y : st.y - offset;
    const dnX = isVertical ? st.x + offset : st.x;
    const dnY = isVertical ? st.y : st.y + offset;

    const upPlatLabel =
      stId === 'BNK'
        ? 'P9 (UP)'
        : stId === 'TWG'
        ? 'North Face (2C)'
        : stId === 'STR'
        ? 'P16 / P4A (UP)'
        : stId === 'WIQ'
        ? 'P4 (UP to POP/STR Only)'
        : stId === 'WOO'
        ? 'P3 (Sub-Surface UP)'
        : 'P1 (UP)';

    const dnPlatLabel =
      stId === 'BNK'
        ? 'P10 (DN)'
        : stId === 'TWG'
        ? 'South Face (2C)'
        : stId === 'STR'
        ? 'P17 / P4B (DN)'
        : stId === 'WIQ'
        ? 'P1–P3 (DN to CAW)'
        : stId === 'WOO'
        ? 'P4 (Sub-Surface DN)'
        : 'P2 (DN)';

    nodes.push({
      id: `${stId}_UP`,
      name: `${st.name} ${upPlatLabel}`,
      stationId: stId,
      platform: stId === 'BNK' ? '9' : stId === 'STR' ? '16' : stId === 'WIQ' ? '4' : stId === 'WOO' ? '3' : '1',
      type: st.isTerminus && stId.includes('DP') ? 'depot' : 'platform',
      x: upX,
      y: upY,
      direction: 'UP',
      maxCars: st.maxCars,
      signalAspect: 'GREEN',
      signalHeld: false,
      hasSignal:
        st.hasTurnback ||
        st.isTerminus ||
        ['WFE', 'POP', 'CNT', 'WIQ', 'CAW', 'GRE', 'LCA', 'CUH', 'GAL', 'STR', 'STI'].includes(stId),
    });

    nodes.push({
      id: `${stId}_DN`,
      name: `${st.name} ${dnPlatLabel}`,
      stationId: stId,
      platform: stId === 'BNK' ? '10' : stId === 'STR' ? '17' : stId === 'WIQ' ? '2' : stId === 'WOO' ? '4' : '2',
      type: st.isTerminus && stId.includes('DP') ? 'depot' : 'platform',
      x: dnX,
      y: dnY,
      direction: 'DN',
      maxCars: st.maxCars,
      signalAspect: 'GREEN',
      signalHeld: false,
      hasSignal:
        st.hasTurnback ||
        st.isTerminus ||
        ['WFE', 'POP', 'CNT', 'WIQ', 'CAW', 'GRE', 'LCA', 'CUH', 'GAL', 'STR', 'STI'].includes(stId),
    });

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

  // Helper to add a custom siding / junction / depot road node
  const addSpecialNode = (
    id: string,
    name: string,
    stationId: string | undefined,
    type: TrackNode['type'],
    x: number,
    y: number,
    direction: TrackNode['direction'],
    roadLabel: string,
    maxCars: 2 | 3 = 3,
    platform = 'S'
  ) => {
    nodes.push({
      id,
      name,
      stationId,
      platform,
      type,
      x,
      y,
      direction,
      maxCars,
      signalAspect: 'GREEN',
      signalHeld: false,
      hasSignal: true,
      roadLabel,
    });
  };

  const addBiLink = (
    a: string,
    b: string,
    lengthMeters: number,
    maxSpeedMph = 15,
    isCrossover = false,
    edgeLabel?: string
  ) => {
    edges.push({
      id: `E_${a}_${b}`,
      from: a,
      to: b,
      lengthMeters,
      maxSpeedMph,
      isCrossover,
      edgeLabel,
    });
    edges.push({
      id: `E_${b}_${a}`,
      from: b,
      to: a,
      lengthMeters,
      maxSpeedMph,
      isCrossover,
    });
  };

  const connectStations = (
    fromSt: string,
    toSt: string,
    distMeters: number,
    maxSpeedMph = 40,
    isFlyover = false,
    isTunnel = false,
    edgeLabel?: string
  ) => {
    edges.push({
      id: `E_${fromSt}_${toSt}_DN`,
      from: `${fromSt}_DN`,
      to: `${toSt}_DN`,
      lengthMeters: distMeters,
      maxSpeedMph,
      isFlyover,
      isTunnel,
      edgeLabel,
    });
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

  // ============================================================================
  // 1. DETAILED BANK DEEP-TUBE HEADSHUNT & TOWER GATEWAY 2-CAR VIADUCT THROAT
  // ============================================================================
  addSpecialNode(
    'BNK_HSH',
    'Bank Tail Headshunt Overrun Bore',
    'BNK',
    'siding',
    78,
    430,
    'BI',
    'BNK HEADSHUNT',
    3,
    'HSH'
  );
  addBiLink('BNK_UP', 'BNK_HSH', 140, 15, true);
  addBiLink('BNK_DN', 'BNK_HSH', 140, 15, true);

  addSpecialNode(
    'TWG_THROAT',
    'Tower Gateway Minories Single-Lead Throat (2-Car Max)',
    'TWG',
    'junction',
    248,
    575,
    'BI',
    'MINORIES 2C THROAT',
    2,
    'T'
  );
  addBiLink('TWG_UP', 'TWG_THROAT', 120, 15, false);
  addBiLink('TWG_DN', 'TWG_THROAT', 120, 15, true);

  addSpecialNode(
    'RMJ_UP',
    'Royal Mint St Junction (UP)',
    'SHA',
    'junction',
    278,
    488,
    'UP',
    'ROYAL MINT ST JCT',
    3,
    'J1'
  );
  addSpecialNode(
    'RMJ_DN',
    'Royal Mint St Junction (DN)',
    'SHA',
    'junction',
    278,
    512,
    'DN',
    '',
    3,
    'J2'
  );
  addBiLink('RMJ_UP', 'RMJ_DN', 90, 20, true);

  // Bank <-> Royal Mint St (Deep 1-in-20 Bored Tube Tunnels, SOP-UG1)
  edges.push({
    id: 'E_BNK_RMJ_DN',
    from: 'BNK_DN',
    to: 'RMJ_DN',
    lengthMeters: 1150,
    maxSpeedMph: 35,
    isTunnel: true,
    edgeLabel: '1:20 BANK BORE (SOP-UG1)',
  });
  edges.push({
    id: 'E_RMJ_BNK_UP',
    from: 'RMJ_UP',
    to: 'BNK_UP',
    lengthMeters: 1150,
    maxSpeedMph: 35,
    isTunnel: true,
  });

  // Tower Gateway <-> Royal Mint St (2-Car Brick Viaduct Curve, SOP-TWG)
  edges.push({
    id: 'E_TWG_RMJ_DN',
    from: 'TWG_DN',
    to: 'RMJ_DN',
    lengthMeters: 780,
    maxSpeedMph: 25,
    edgeLabel: 'TWG 2-CAR VIADUCT (SOP-TWG)',
  });
  edges.push({
    id: 'E_TWG_THROAT_RMJ_DN',
    from: 'TWG_THROAT',
    to: 'RMJ_DN',
    lengthMeters: 660,
    maxSpeedMph: 25,
  });
  edges.push({
    id: 'E_RMJ_TWG_UP',
    from: 'RMJ_UP',
    to: 'TWG_UP',
    lengthMeters: 780,
    maxSpeedMph: 25,
  });
  edges.push({
    id: 'E_RMJ_TWG_THROAT',
    from: 'RMJ_UP',
    to: 'TWG_THROAT',
    lengthMeters: 660,
    maxSpeedMph: 25,
  });

  // Royal Mint St <-> Shadwell <-> Limehouse <-> Westferry
  edges.push({ id: 'E_RMJ_SHA_DN', from: 'RMJ_DN', to: 'SHA_DN', lengthMeters: 320, maxSpeedMph: 35 });
  edges.push({ id: 'E_SHA_RMJ_UP', from: 'SHA_UP', to: 'RMJ_UP', lengthMeters: 320, maxSpeedMph: 35 });
  connectStations('SHA', 'LIM', 1050, 45);
  connectStations('LIM', 'WFE', 950, 45);

  // ============================================================================
  // 2. WEST INDIA QUAY (WIQ) ASYMMETRIC 4-TRACK DELTA & CAW->WFE BYPASS (SOP-WIQ)
  // ============================================================================
  // Real-world DLR alignment:
  // - Southbound WFE -> WIQ -> CAW stops at WIQ (Platform 2)
  // - Southbound POP -> WIQ -> CAW stops at WIQ (Platform 1/2)
  // - Northbound CAW -> WIQ -> POP stops at WIQ (Platform 4)
  // - Northbound/Westbound CAW -> WFE (towards Bank) uses the grade-separated Westbound Dive-Under Bypass Chord (DLT_BYP_UP)
  //   which has NO PLATFORM at West India Quay!
  addSpecialNode(
    'DLT_W_UP',
    'Delta West Flying Chord (UP to WFE)',
    'WFE',
    'junction',
    668,
    478,
    'UP',
    'WFE↔POP FLYOVER',
    3
  );
  addSpecialNode(
    'DLT_W_DN',
    'Delta West Flying Chord (DN to POP)',
    'POP',
    'junction',
    668,
    504,
    'DN',
    '',
    3
  );
  // Southbound Viaduct Curve (WFE_DN -> WIQ_DN)
  addSpecialNode(
    'DLT_SW_DN',
    'Delta South-West Viaduct Curve (WFE→WIQ DN)',
    'WIQ',
    'junction',
    642,
    558,
    'DN',
    'WFE→WIQ DN CHORD',
    3
  );
  // Westbound Dive-Under / Viaduct Bypass Chord (CAW_UP -> DLT_BYP_UP -> DLT_SW_UP -> WFE_UP) — Bypasses WIQ!
  addSpecialNode(
    'DLT_BYP_UP',
    'Canary Wharf → Westferry Dive-Under Bypass Track (No Platform at WIQ)',
    'WFE',
    'junction',
    605,
    615,
    'UP',
    'CAW→WFE BYPASS (NO WIQ STOP)',
    3,
    'BYP'
  );
  addSpecialNode(
    'DLT_SW_UP',
    'Delta Westbound Flyover Lead (Bypass → WFE UP)',
    'WFE',
    'junction',
    585,
    555,
    'UP',
    '',
    3
  );
  // Delta East Dive-Under Curve (Poplar <-> West India Quay)
  addSpecialNode(
    'DLT_SE_UP',
    'Delta East Curve (WIQ P4 → POP UP)',
    'POP',
    'junction',
    745,
    558,
    'UP',
    'POP↔WIQ CHORD',
    3
  );
  addSpecialNode(
    'DLT_SE_DN',
    'Delta East Curve (POP → WIQ DN)',
    'WIQ',
    'junction',
    775,
    558,
    'DN',
    '',
    3
  );

  // Wire Westferry <-> Poplar via Delta West Flying Chord
  edges.push({ id: 'E_WFE_DLTW_DN', from: 'WFE_DN', to: 'DLT_W_DN', lengthMeters: 450, maxSpeedMph: 35, isFlyover: true });
  edges.push({ id: 'E_DLTW_POP_DN', from: 'DLT_W_DN', to: 'POP_DN', lengthMeters: 500, maxSpeedMph: 35, isFlyover: true });
  edges.push({ id: 'E_POP_DLTW_UP', from: 'POP_UP', to: 'DLT_W_UP', lengthMeters: 500, maxSpeedMph: 35, isFlyover: true });
  edges.push({ id: 'E_DLTW_WFE_UP', from: 'DLT_W_UP', to: 'WFE_UP', lengthMeters: 450, maxSpeedMph: 35, isFlyover: true });
  addBiLink('DLT_W_UP', 'DLT_W_DN', 90, 20, true);

  // Wire Southbound WFE_DN -> DLT_SW_DN -> WIQ_DN (Southbound Bank->Lewisham trains DO stop at WIQ!)
  edges.push({ id: 'E_WFE_DLTSW_DN', from: 'WFE_DN', to: 'DLT_SW_DN', lengthMeters: 310, maxSpeedMph: 25, isFlyover: true });
  edges.push({ id: 'E_DLTSW_WIQ_DN', from: 'DLT_SW_DN', to: 'WIQ_DN', lengthMeters: 310, maxSpeedMph: 25, isFlyover: true });

  // Wire Northbound/Westbound CAW_UP & CAW_MID -> DLT_BYP_UP -> DLT_SW_UP -> WFE_UP (Bypasses WIQ completely!)
  edges.push({
    id: 'E_CAW_BYP_UP',
    from: 'CAW_UP',
    to: 'DLT_BYP_UP',
    lengthMeters: 420,
    maxSpeedMph: 30,
    isFlyover: true,
    edgeLabel: 'SOP-WIQ: BYPASSES WIQ',
  });
  edges.push({
    id: 'E_CAWMID_BYP_UP',
    from: 'CAW_MID',
    to: 'DLT_BYP_UP',
    lengthMeters: 420,
    maxSpeedMph: 25,
    isFlyover: true,
  });
  edges.push({
    id: 'E_BYP_DLTSW_UP',
    from: 'DLT_BYP_UP',
    to: 'DLT_SW_UP',
    lengthMeters: 260,
    maxSpeedMph: 30,
    isFlyover: true,
  });
  edges.push({
    id: 'E_DLTSW_WFE_UP',
    from: 'DLT_SW_UP',
    to: 'WFE_UP',
    lengthMeters: 280,
    maxSpeedMph: 30,
    isFlyover: true,
  });

  // Wire Poplar <-> West India Quay via Delta East Dive-Under (Stratford/Poplar trains stop at WIQ in both directions)
  edges.push({ id: 'E_POP_DLTSE_DN', from: 'POP_DN', to: 'DLT_SE_DN', lengthMeters: 300, maxSpeedMph: 25, isFlyover: true });
  edges.push({ id: 'E_DLTSE_WIQ_DN', from: 'DLT_SE_DN', to: 'WIQ_DN', lengthMeters: 300, maxSpeedMph: 25, isFlyover: true });
  edges.push({ id: 'E_WIQ_DLTSE_UP', from: 'WIQ_UP', to: 'DLT_SE_UP', lengthMeters: 300, maxSpeedMph: 25, isFlyover: true });
  edges.push({ id: 'E_DLTSE_POP_UP', from: 'DLT_SE_UP', to: 'POP_UP', lengthMeters: 300, maxSpeedMph: 25, isFlyover: true });
  addBiLink('DLT_SE_UP', 'DLT_SE_DN', 95, 18, true);

  // Poplar East Reversing & Stabling Pocket (between Poplar & Blackwall)
  addSpecialNode(
    'POP_REV',
    'Poplar East Turnback & Stabling Pocket',
    'POP',
    'siding',
    888,
    500,
    'BI',
    'POP TURNBACK POCKET',
    3,
    'R'
  );
  addBiLink('POP_DN', 'POP_REV', 180, 20, true);
  addBiLink('POP_REV', 'POP_UP', 180, 20, true);
  addBiLink('POP_REV', 'BLW_DN', 250, 25, true);

  // Canary Wharf Center Turnback & Stabling Road (P3/P4 Center Track between UP and DN)
  addSpecialNode(
    'CAW_MID',
    'Canary Wharf P3/P4 Center Turnback Road',
    'CAW',
    'siding',
    705,
    685,
    'BI',
    'CAW P3/P4 CENTER RD',
    3,
    '3'
  );
  addBiLink('WIQ_DN', 'CAW_MID', 420, 25, true);
  addBiLink('CAW_MID', 'WIQ_UP', 420, 25, true);
  addBiLink('CAW_DN', 'CAW_MID', 110, 20, true);
  addBiLink('CAW_MID', 'CAW_UP', 110, 20, true);
  addBiLink('CAW_MID', 'HER_DN', 420, 25, true);

  // ============================================================================
  // 3. POPLAR DEPOT (PDP) MULTI-ROAD STABLING & MAINTENANCE FAN
  // ============================================================================
  addSpecialNode(
    'PDP_THROAT',
    'Poplar Depot Reception & Wash Lead',
    'PDP',
    'junction',
    855,
    418,
    'BI',
    'PDP RECEPTION THROAT',
    3,
    'T'
  );
  addSpecialNode(
    'PDP_S1',
    'Poplar Depot Road 1 (West Stabling Berth)',
    'PDP',
    'depot',
    1005,
    315,
    'BI',
    'PDP RD 1 (STABLING A)',
    3,
    'R1'
  );
  addSpecialNode(
    'PDP_S2',
    'Poplar Depot Road 2 (Center Stabling Berth)',
    'PDP',
    'depot',
    1005,
    352,
    'BI',
    'PDP RD 2 (STABLING B)',
    3,
    'R2'
  );
  addSpecialNode(
    'PDP_S3',
    'Poplar Depot Road 3 (Lifting & Heavy Shop)',
    'PDP',
    'depot',
    1005,
    389,
    'BI',
    'PDP RD 3 (WORKSHOP)',
    3,
    'R3'
  );

  addBiLink('POP_UP', 'PDP_THROAT', 260, 15, true);
  addBiLink('POP_DN', 'PDP_THROAT', 260, 15, true);
  addBiLink('BLW_UP', 'PDP_THROAT', 310, 15, true);
  addBiLink('PDP_THROAT', 'PDP_UP', 200, 15, false);
  addBiLink('PDP_THROAT', 'PDP_DN', 200, 15, false);
  addBiLink('PDP_UP', 'PDP_S1', 160, 12, false);
  addBiLink('PDP_UP', 'PDP_S2', 160, 12, false);
  addBiLink('PDP_DN', 'PDP_S2', 160, 12, false);
  addBiLink('PDP_DN', 'PDP_S3', 160, 12, false);
  connectStations('PDP', 'POP', 450, 15);
  connectStations('POP', 'PDP', 450, 15);

  // ============================================================================
  // 4. STRATFORD INTERNATIONAL (STI) & STRATFORD REGIONAL (STR) OLYMPIC COMPLEX
  // ============================================================================
  // 4a. Stratford International Tail Buffer / Overrun Siding & Olympic Approach Scissor Throat
  addSpecialNode(
    'STI_HSH',
    'Stratford International Olympic Tail Siding & Buffer',
    'STI',
    'siding',
    830,
    62,
    'BI',
    'STI OLYMPIC SIDING',
    3,
    'S'
  );
  addBiLink('STI_UP', 'STI_HSH', 130, 15, true);
  addBiLink('STI_DN', 'STI_HSH', 130, 15, true);

  addSpecialNode(
    'STI_XOVR',
    'Stratford International Approach Scissor Throat (HS1 Box)',
    'STI',
    'junction',
    1042,
    62,
    'BI',
    'STI SCISSOR THROAT',
    3,
    'J'
  );
  addBiLink('STI_UP', 'STI_XOVR', 140, 25, false);
  addBiLink('STI_DN', 'STI_XOVR', 140, 25, true);

  // 4b. Stratford Regional High-Level Terminal Bay Turnback (P4A/P4B for Bow/Poplar/Lewisham route)
  addSpecialNode(
    'STR_BAY',
    'Stratford High-Level Terminal Bays (P4A / P4B)',
    'STR',
    'siding',
    740,
    134,
    'BI',
    'STR P4A/B BAY TURNBACK',
    3,
    '4A'
  );
  addBiLink('STR_UP', 'STR_BAY', 140, 20, true);
  addBiLink('STR_DN', 'STR_BAY', 140, 20, true);
  addBiLink('STR_BAY', 'PML_DN', 420, 30, false);
  addBiLink('PML_UP', 'STR_BAY', 420, 30, false);

  // 4c. Stratford Market Junction & Crossover (splits Stratford Regional P16/P17 to Stratford High St vs Bow/PML link)
  addSpecialNode(
    'STR_MKT_JCT',
    'Stratford Market Crossover & Lea Valley Junction',
    'STR',
    'junction',
    985,
    142,
    'BI',
    'STR MARKET X-OVER',
    3,
    'M'
  );
  addBiLink('STI_XOVR', 'STR_DN', 420, 35, false);
  addBiLink('STR_UP', 'STI_XOVR', 420, 35, false);
  connectStations('STI', 'STR', 680, 40, false, false, 'OLYMPIC PARK CUTTING');

  addBiLink('STR_DN', 'STR_MKT_JCT', 220, 30, false);
  addBiLink('STR_MKT_JCT', 'STR_UP', 220, 30, true);
  addBiLink('STR_MKT_JCT', 'SHS_DN', 380, 35, false);
  addBiLink('SHS_UP', 'STR_MKT_JCT', 380, 35, false);
  connectStations('STR', 'SHS', 620, 40);

  // 4d. Pudding Mill Lane Olympic Turnback Pocket (rebuilt 2014 twin-track viaduct + siding)
  addSpecialNode(
    'PML_REV',
    'Pudding Mill Lane Olympic Turnback Pocket Siding',
    'PML',
    'siding',
    642,
    204,
    'BI',
    'PML OLYMPIC POCKET',
    3,
    '3'
  );
  addBiLink('PML_DN', 'PML_REV', 150, 20, true);
  addBiLink('PML_REV', 'PML_UP', 150, 20, true);

  // North Branch (Stratford -> Pudding Mill Lane -> Bow Church -> All Saints -> Poplar)
  connectStations('STR', 'PML', 750, 40);
  connectStations('PML', 'BOW', 850, 40);
  connectStations('BOW', 'DEV', 750, 35);
  connectStations('DEV', 'LAN', 700, 35);
  connectStations('LAN', 'ALL', 650, 35);
  connectStations('ALL', 'POP', 650, 25);

  // ============================================================================
  // 5. SOUTH BRANCH (WEST INDIA QUAY -> CANARY WHARF -> GREENWICH THAMES BORE -> LEWISHAM)
  // ============================================================================
  connectStations('WIQ', 'CAW', 450, 25);
  connectStations('CAW', 'HER', 450, 30);
  connectStations('HER', 'SQY', 550, 30);
  connectStations('SQY', 'CRH', 650, 35);
  connectStations('CRH', 'MUD', 650, 35);
  connectStations('MUD', 'ISG', 650, 35, false, true);
  connectStations('ISG', 'CUT', 950, 40, false, true, 'GREENWICH THAMES BORE (SOP-UG1)');
  connectStations('CUT', 'GRE', 750, 35, false, true);
  connectStations('GRE', 'DEP', 750, 35);
  connectStations('DEP', 'ELV', 650, 35);
  connectStations('ELV', 'LEW', 650, 30);

  // ============================================================================
  // 6. CENTRAL TRUNK & STRATFORD INTL / LEA VALLEY -> CANNING TOWN
  // ============================================================================
  connectStations('POP', 'BLW', 950, 40);
  connectStations('BLW', 'EIR', 850, 40);
  connectStations('EIR', 'CNT', 1050, 40, true);

  connectStations('SHS', 'ABB', 750, 45);
  connectStations('ABB', 'WHM', 850, 45);
  connectStations('WHM', 'STL', 800, 40);
  connectStations('STL', 'CNT', 850, 35);

  // ============================================================================
  // 7. BECKTON BRANCH + EXPANDED MULTI-ROAD BECKTON DEPOT (NON-GEOGRAPHIC WRAP)
  // ============================================================================
  connectStations('CNT', 'RVC', 950, 40, true);
  connectStations('RVC', 'CUH', 800, 40);

  // Custom House ExCeL Turnback Pocket Siding
  addSpecialNode(
    'CUH_SID',
    'Custom House ExCeL Turnback Siding',
    'CUH',
    'siding',
    1555,
    430,
    'BI',
    'CUH EXCEL SIDING',
    3,
    '3'
  );
  addBiLink('CUH_DN', 'CUH_SID', 150, 20, true);
  addBiLink('CUH_SID', 'CUH_UP', 150, 20, true);

  connectStations('CUH', 'PRR', 750, 40);
  connectStations('PRR', 'RAL', 850, 45);
  connectStations('RAL', 'BKP', 800, 45);
  connectStations('BKP', 'CYP', 750, 40, false, false, 'ROYAL DOCKS LOOP');
  connectStations('CYP', 'GAL', 850, 40);
  connectStations('GAL', 'BCK', 950, 30);

  // Beckton Tail Reversing & Stabling Headshunt (West of Beckton Terminus)
  addSpecialNode(
    'BCK_REV',
    'Beckton Terminus Reversing Siding',
    'BCK',
    'siding',
    1475,
    220,
    'BI',
    'BCK TAIL SIDING',
    3,
    'S'
  );
  addBiLink('BCK_UP', 'BCK_REV', 140, 15, true);
  addBiLink('BCK_DN', 'BCK_REV', 140, 15, true);

  // Beckton Depot East & West Reception Ladders + 4 Stabling/Maintenance Roads
  addSpecialNode(
    'BDP_E_LEAD',
    'Beckton Depot East Reception Ladder (to Gallions Reach)',
    'BDP',
    'junction',
    1810,
    155,
    'BI',
    'BDP EAST LADDER',
    3,
    'E'
  );
  addSpecialNode(
    'BDP_W_LEAD',
    'Beckton Depot West Reception Ladder (to Beckton)',
    'BDP',
    'junction',
    1630,
    155,
    'BI',
    'BDP WEST LADDER',
    3,
    'W'
  );
  addSpecialNode(
    'BDP_R1',
    'Beckton Depot Road 1 — North Stabling Fan (3 Trains)',
    'BDP',
    'depot',
    1530,
    68,
    'BI',
    'BDP RD 1 (NORTH STABLING)',
    3,
    'R1'
  );
  addSpecialNode(
    'BDP_R2',
    'Beckton Depot Road 2 — Peak Readiness Siding',
    'BDP',
    'depot',
    1530,
    98,
    'BI',
    'BDP RD 2 (PEAK READY)',
    3,
    'R2'
  );
  addSpecialNode(
    'BDP_R3',
    'Beckton Depot Road 3 — Heavy Overhaul & Wheel Lathe',
    'BDP',
    'depot',
    1530,
    128,
    'BI',
    'BDP RD 3 (WHEEL LATHE)',
    3,
    'R3'
  );
  addSpecialNode(
    'BDP_R4',
    'Beckton Depot Road 4 — East Reversing & Wash Loop',
    'BDP',
    'depot',
    1895,
    98,
    'BI',
    'BDP RD 4 (WASH & REV LOOP)',
    3,
    'R4'
  );

  // Connect Gallions Reach & Beckton to Beckton Depot Ladders and 4 Stabling Roads
  addBiLink('GAL_UP', 'BDP_E_LEAD', 280, 15, true);
  addBiLink('GAL_DN', 'BDP_E_LEAD', 280, 15, true);
  addBiLink('BCK_UP', 'BDP_W_LEAD', 280, 15, true);
  addBiLink('BCK_DN', 'BDP_W_LEAD', 280, 15, true);
  addBiLink('BDP_E_LEAD', 'BDP_UP', 200, 15, false);
  addBiLink('BDP_E_LEAD', 'BDP_DN', 200, 15, false);
  addBiLink('BDP_W_LEAD', 'BDP_UP', 200, 15, false);
  addBiLink('BDP_W_LEAD', 'BDP_DN', 200, 15, false);
  addBiLink('BDP_E_LEAD', 'BDP_R4', 190, 15, false);
  addBiLink('BDP_UP', 'BDP_R4', 210, 15, false);
  addBiLink('BDP_UP', 'BDP_R1', 210, 12, false);
  addBiLink('BDP_UP', 'BDP_R2', 210, 12, false);
  addBiLink('BDP_DN', 'BDP_R2', 210, 12, false);
  addBiLink('BDP_DN', 'BDP_R3', 210, 12, false);
  addBiLink('BDP_W_LEAD', 'BDP_R3', 190, 12, false);

  connectStations('GAL', 'BDP', 520, 15);
  connectStations('BDP', 'GAL', 520, 15);
  connectStations('BDP', 'BCK', 520, 15);

  // ============================================================================
  // 8. WOOLWICH ARSENAL BRANCH (Diving UNDER the Labelled River Thames from KGV to WOO!)
  // ============================================================================
  connectStations('CNT', 'WSV', 1100, 45, true);
  connectStations('WSV', 'PDK', 850, 40);
  connectStations('PDK', 'LCA', 950, 40, true);
  connectStations('LCA', 'KGV', 1050, 45);
  connectStations('KGV', 'WOO', 1550, 50, false, true, 'WOOLWICH THAMES BORE (50 MPH · SOP-UG1)');

  // Woolwich Arsenal Sub-Surface Tail Buffer & Overrun Siding (South of the River Thames)
  addSpecialNode(
    'WOO_HSH',
    'Woolwich Arsenal Sub-Surface Tail Siding & Buffers',
    'WOO',
    'siding',
    1962,
    795,
    'BI',
    'WOO TAIL SIDING',
    3,
    'S'
  );
  addBiLink('WOO_UP', 'WOO_HSH', 135, 15, true);
  addBiLink('WOO_DN', 'WOO_HSH', 135, 15, true);

  return { nodes, edges };
}

export const INITIAL_TEMPLATES: ServiceTemplate[] = [
  {
    id: 'T_BNK_LEW',
    name: 'Bank ↔ Lewisham (Southbound calls WIQ; Northbound bypasses WIQ)',
    codePrefix: '1',
    originId: 'BNK',
    destId: 'LEW',
    routeStations: ['BNK', 'SHA', 'LIM', 'WFE', 'WIQ', 'CAW', 'HER', 'SQY', 'CRH', 'MUD', 'ISG', 'CUT', 'GRE', 'DEP', 'ELV', 'LEW'],
    intervalMins: 4,
    cars: 3,
    active: true,
    color: '#00A4A7',
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
    color: '#38BDF8',
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
    color: '#F59E0B',
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
    color: '#A855F7',
  },
  {
    id: 'T_STI_WOO',
    name: 'Stratford International ↔ Woolwich Arsenal (via Stratford P16/P17)',
    codePrefix: '5',
    originId: 'STI',
    destId: 'WOO',
    routeStations: ['STI', 'STR', 'SHS', 'ABB', 'WHM', 'STL', 'CNT', 'WSV', 'PDK', 'LCA', 'KGV', 'WOO'],
    intervalMins: 6,
    cars: 3,
    active: true,
    color: '#10B981',
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
    color: '#94A3B8',
  },
];

export const CONTINGENCY_PLANS: ContingencyPlan[] = [
  {
    id: 'CP_SHORT_CAW',
    name: 'Short-Turn Lewisham Services at Canary Wharf',
    shortCode: 'PLAN A: CAW TURNBACK',
    description: 'Terminates southbound Bank/Stratford services at Canary Wharf P3/P4 Center Turnback Road when the Greenwich bore or Mudchute section is obstructed.',
    active: false,
    affectedBranch: 'South (Isle of Dogs / Lewisham)',
    effectSummary: 'Reroutes LEW trains to reverse at CAW P3/P4',
  },
  {
    id: 'CP_DIVERT_TWG_BNK',
    name: 'Bank Underground SOP-UG2 Lockout — Divert 2C to TWG / 3C to SHA',
    shortCode: 'PLAN B: TWG / SHA DIVERT',
    description: 'Enforces Underground Evacuation SOP: diverts 2-car westbound services into Tower Gateway (60m limit) and short-turns 3-car sets at Shadwell crossover.',
    active: false,
    affectedBranch: 'West (Bank Deep-Tube Bore / Tower Gateway)',
    effectSummary: '2-Car → TWG · 3-Car → SHA Turnback',
  },
  {
    id: 'CP_BECKTON_CUH',
    name: 'Short-Turn Beckton Branch at Custom House (ExCeL)',
    shortCode: 'PLAN C: CUH SHUTTLE',
    description: 'Reverses Eastbound Beckton services in the Custom House ExCeL Turnback Pocket (CUH_SID) to maintain high frequency.',
    active: false,
    affectedBranch: 'Beckton (Custom House – Beckton)',
    effectSummary: 'Reverses BCK trains at CUH Siding',
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
