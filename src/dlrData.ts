import { Station, TrackNode, TrackEdge, ServiceTemplate, ContingencyPlan } from './types';

// Interchange and signed walking distances follow https://content.tfl.gov.uk/dlr-route-map.pdf (March 2026).
// Expanded 3180 x 2120 Pure Orthogonal + 45-Degree IECC Signalling Schematic Layout (Zero Spiderwebs)
export const STATIONS: Station[] = [
  // 1. WEST BRANCH (Bank Deep-Tube Bore & Tower Gateway 2-Car Viaduct -> Royal Mint St -> Shadwell -> Limehouse -> Westferry)
  { id: 'BNK', code: 'BNK', name: 'Bank', branch: 'West', x: 230, y: 730, maxCars: 3, baseDemand: 10, interchange: ['Central', 'Northern', 'Waterloo & City', 'Circle via Monument', 'District via Monument', 'National Rail · Cannon Street 125 m'], hasTurnback: true, isTerminus: true, labelPos: 'top' },
  { id: 'TWG', code: 'TWG', name: 'Tower Gateway', branch: 'West', x: 210, y: 950, maxCars: 2, baseDemand: 7, interchange: ['Circle · Tower Hill 150 m', 'District · Tower Hill 150 m', 'National Rail · Fenchurch Street 100 m', 'Metropolitan · Aldgate 450 m', 'River services · Tower Pier 500 m'], hasTurnback: true, isTerminus: true, labelPos: 'bottom' },
  { id: 'SHA', code: 'SHA', name: 'Shadwell', branch: 'West', x: 540, y: 840, maxCars: 3, baseDemand: 6, interchange: ['Windrush line · 60 m'], hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'LIM', code: 'LIM', name: 'Limehouse', branch: 'West', x: 680, y: 840, maxCars: 3, baseDemand: 6, interchange: ['National Rail · c2c'], hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'WFE', code: 'WFE', name: 'Westferry', branch: 'West', x: 820, y: 840, maxCars: 3, baseDemand: 6, interchange: ['River services · Canary Wharf Pier 500 m'], hasTurnback: true, isTerminus: false, labelPos: 'top' },

  // 2. STRATFORD INTERNATIONAL (STI) & STRATFORD REGIONAL (STR) OLYMPIC ARCH + NORTH SPINE (x = 1040)
  // STI sits at the top-center (x = 1380, y = 75), dropping straight down to STR (x = 1380, y = 185),
  // which forks cleanly West to the x = 1040 Bow/Poplar Spine and East to the x = 1760 Lea Valley/Canning Town Spine!
  { id: 'STI', code: 'STI', name: 'Stratford International', branch: 'StratfordIntl', x: 1380, y: 75, maxCars: 3, baseDemand: 8, interchange: ['National Rail · Southeastern high speed'], hasTurnback: true, isTerminus: true, labelPos: 'top' },
  { id: 'STR', code: 'STR', name: 'Stratford', branch: 'North', x: 1380, y: 185, maxCars: 3, baseDemand: 10, interchange: ['Central', 'Jubilee', 'Elizabeth line', 'Mildmay line', 'National Rail'], hasTurnback: true, isTerminus: true, labelPos: 'bottom' },
  { id: 'PML', code: 'PML', name: 'Pudding Mill Lane', branch: 'North', x: 1040, y: 310, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'right' },
  { id: 'BOW', code: 'BOW', name: 'Bow Church', branch: 'North', x: 1040, y: 420, maxCars: 3, baseDemand: 5, interchange: ['District · Bow Road 300 m', 'Hammersmith & City · Bow Road 300 m'], hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'DEV', code: 'DEV', name: 'Devons Road', branch: 'North', x: 1040, y: 530, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'LAN', code: 'LAN', name: 'Langdon Park', branch: 'North', x: 1040, y: 635, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'ALL', code: 'ALL', name: 'All Saints', branch: 'North', x: 1040, y: 740, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'left' },

  // 3. LEA VALLEY SPINE (Vertical Axis x = 1760: Stratford High St -> Abbey Road -> West Ham -> Star Lane -> Canning Town)
  { id: 'SHS', code: 'SHS', name: 'Stratford High Street', branch: 'StratfordIntl', x: 1760, y: 310, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'right' },
  { id: 'ABB', code: 'ABB', name: 'Abbey Road', branch: 'StratfordIntl', x: 1760, y: 425, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'right' },
  { id: 'WHM', code: 'WHM', name: 'West Ham', branch: 'StratfordIntl', x: 1760, y: 540, maxCars: 3, baseDemand: 7, interchange: ['District', 'Hammersmith & City', 'Jubilee', 'National Rail · c2c'], hasTurnback: false, isTerminus: false, labelPos: 'right' },
  { id: 'STL', code: 'STL', name: 'Star Lane', branch: 'StratfordIntl', x: 1760, y: 655, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'right' },

  // 4. CENTRAL HORIZONTAL TRUNK (y = 840) & POPLAR 3-ROAD DEPOT YARD (x = 1220..1540, y = 540..680)
  { id: 'POP', code: 'POP', name: 'Poplar', branch: 'Central', x: 1220, y: 840, maxCars: 3, baseDemand: 8, interchange: ['Elizabeth line · Canary Wharf 400 m'], hasTurnback: true, isTerminus: false, labelPos: 'bottom' },
  { id: 'PDP', code: 'PDP', name: 'Poplar Depot', branch: 'Central', x: 1350, y: 610, maxCars: 3, baseDemand: 1, hasTurnback: true, isTerminus: true, labelPos: 'top' },
  { id: 'BLW', code: 'BLW', name: 'Blackwall', branch: 'Central', x: 1500, y: 840, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'EIR', code: 'EIR', name: 'East India', branch: 'Central', x: 1680, y: 840, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'CNT', code: 'CNT', name: 'Canning Town', branch: 'Central', x: 1900, y: 840, maxCars: 3, baseDemand: 9, interchange: ['Jubilee'], hasTurnback: true, isTerminus: false, labelPos: 'bottom' },

  // 5. SOUTH SPINE (Vertical Axis x = 1040: West India Quay -> Canary Wharf -> Isle of Dogs -> Thames -> Cutty Sark -> Lewisham)
  { id: 'WIQ', code: 'WIQ', name: 'West India Quay', branch: 'South', x: 1040, y: 1040, maxCars: 3, baseDemand: 6, interchange: ['Elizabeth line · Canary Wharf 150 m'], hasTurnback: false, isTerminus: false, labelPos: 'right' },
  { id: 'CAW', code: 'CAW', name: 'Canary Wharf', branch: 'South', x: 1040, y: 1150, maxCars: 3, baseDemand: 10, interchange: ['Jubilee · 225 m', 'Elizabeth line · 225 m', 'River services · Canary Wharf Pier 500 m'], hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'HER', code: 'HER', name: 'Heron Quays', branch: 'South', x: 1040, y: 1245, maxCars: 3, baseDemand: 7, interchange: ['Jubilee · Canary Wharf 100 m'], hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'SQY', code: 'SQY', name: 'South Quay', branch: 'South', x: 1040, y: 1330, maxCars: 3, baseDemand: 7, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'CRH', code: 'CRH', name: 'Crossharbour', branch: 'South', x: 1040, y: 1415, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'MUD', code: 'MUD', name: 'Mudchute', branch: 'South', x: 1040, y: 1500, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'ISG', code: 'ISG', name: 'Island Gardens', branch: 'South', x: 1040, y: 1585, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'left' },
  // --- RIVER THAMES GREENWICH SUB-AQUEOUS BORE (y = 1650) ---
  { id: 'CUT', code: 'CUT', name: 'Cutty Sark', branch: 'South', x: 1040, y: 1715, maxCars: 2, baseDemand: 8, interchange: ['River services · Greenwich Pier 300 m'], hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'GRE', code: 'GRE', name: 'Greenwich', branch: 'South', x: 1040, y: 1800, maxCars: 3, baseDemand: 8, interchange: ['National Rail · Southeastern / Thameslink'], hasTurnback: true, isTerminus: false, labelPos: 'left' },
  { id: 'DEP', code: 'DEP', name: 'Deptford Bridge', branch: 'South', x: 1040, y: 1885, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'ELV', code: 'ELV', name: 'Elverson Road', branch: 'South', x: 1040, y: 1970, maxCars: 2, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'left' },
  { id: 'LEW', code: 'LEW', name: 'Lewisham', branch: 'South', x: 1040, y: 2055, maxCars: 3, baseDemand: 9, interchange: ['National Rail · Southeastern'], hasTurnback: true, isTerminus: true, labelPos: 'bottom' },

  // 6. BECKTON BRANCH (Lower Deck y = 700 -> Cyprus Loop x = 2980 -> Upper Deck y = 380 -> Beckton 4-Road Depot y = 115..215)
  { id: 'RVC', code: 'RVC', name: 'Royal Victoria', branch: 'Beckton', x: 2080, y: 700, maxCars: 3, baseDemand: 6, interchange: ['London Cable Car · Royal Docks 250 m'], hasTurnback: false, isTerminus: false, labelPos: 'top' },
  { id: 'CUH', code: 'CUH', name: 'Custom House (ExCeL)', branch: 'Beckton', x: 2260, y: 700, maxCars: 3, baseDemand: 9, interchange: ['Elizabeth line'], hasTurnback: true, isTerminus: false, labelPos: 'bottom' },
  { id: 'PRR', code: 'PRR', name: 'Prince Regent', branch: 'Beckton', x: 2480, y: 700, maxCars: 3, baseDemand: 6, hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'RAL', code: 'RAL', name: 'Royal Albert', branch: 'Beckton', x: 2660, y: 700, maxCars: 3, baseDemand: 4, hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'BKP', code: 'BKP', name: 'Beckton Park', branch: 'Beckton', x: 2840, y: 700, maxCars: 3, baseDemand: 3, hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'CYP', code: 'CYP', name: 'Cyprus', branch: 'Beckton', x: 2980, y: 540, maxCars: 3, baseDemand: 5, hasTurnback: false, isTerminus: false, labelPos: 'right' },
  { id: 'GAL', code: 'GAL', name: 'Gallions Reach', branch: 'Beckton', x: 2800, y: 380, maxCars: 3, baseDemand: 5, hasTurnback: true, isTerminus: false, labelPos: 'bottom' },
  { id: 'BCK', code: 'BCK', name: 'Beckton', branch: 'Beckton', x: 2400, y: 380, maxCars: 3, baseDemand: 7, hasTurnback: true, isTerminus: true, labelPos: 'bottom' },
  { id: 'BDP', code: 'BDP', name: 'Beckton Depot', branch: 'Beckton', x: 2600, y: 215, maxCars: 3, baseDemand: 1, hasTurnback: true, isTerminus: true, labelPos: 'bottom' },

  // 7. WOOLWICH ARSENAL BRANCH (North Bank y = 980 -> UNDER River Thames y = 1120 -> Sub-Surface Woolwich Arsenal y = 1260)
  { id: 'WSV', code: 'WSV', name: 'West Silvertown', branch: 'Woolwich', x: 2080, y: 980, maxCars: 3, baseDemand: 5, interchange: ['River services · Royal Wharf Pier 650 m'], hasTurnback: false, isTerminus: false, labelPos: 'top' },
  { id: 'PDK', code: 'PDK', name: 'Pontoon Dock', branch: 'Woolwich', x: 2260, y: 980, maxCars: 3, baseDemand: 6, interchange: ['River services · Royal Wharf Pier 750 m'], hasTurnback: false, isTerminus: false, labelPos: 'bottom' },
  { id: 'LCA', code: 'LCA', name: 'London City Airport', branch: 'Woolwich', x: 2460, y: 980, maxCars: 3, baseDemand: 9, interchange: ['London City Airport'], hasTurnback: true, isTerminus: false, labelPos: 'top' },
  { id: 'KGV', code: 'KGV', name: 'King George V', branch: 'Woolwich', x: 2660, y: 980, maxCars: 3, baseDemand: 5, interchange: ['Woolwich Ferry · North Pier 600 m'], hasTurnback: true, isTerminus: false, labelPos: 'top' },
  // --- RIVER THAMES WOOLWICH SUB-AQUEOUS BORE (y = 1120) ---
  { id: 'WOO', code: 'WOO', name: 'Woolwich Arsenal', branch: 'Woolwich', x: 2780, y: 1260, maxCars: 3, baseDemand: 9, interchange: ['National Rail · Southeastern / Thameslink', 'Elizabeth line · Woolwich 250 m', 'River services · Royal Arsenal Woolwich Pier 650 m'], hasTurnback: true, isTerminus: true, labelPos: 'bottom' },
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

    const offset = stId === 'CAW' ? 24 : 14;
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
  // 1. WEST SECTOR: BANK DEEP-TUBE HEADSHUNT & TOWER GATEWAY 2-CAR VIADUCT THROAT
  // ============================================================================
  addSpecialNode(
    'BNK_HSH',
    'Bank Tail Headshunt Overrun Bore',
    'BNK',
    'siding',
    95,
    730,
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
    320,
    950,
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
    420,
    826,
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
    420,
    854,
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

  // Tower Gateway (via Minories Single-Lead Throat) <-> Royal Mint St (SOP-TWG)
  edges.push({
    id: 'E_TWG_THROAT_RMJ_DN',
    from: 'TWG_THROAT',
    to: 'RMJ_DN',
    lengthMeters: 680,
    maxSpeedMph: 25,
    edgeLabel: 'TWG 2-CAR VIADUCT (SOP-TWG)',
  });
  edges.push({
    id: 'E_RMJ_TWG_THROAT',
    from: 'RMJ_UP',
    to: 'TWG_THROAT',
    lengthMeters: 680,
    maxSpeedMph: 25,
  });

  // Royal Mint St <-> Shadwell <-> Limehouse <-> Westferry
  edges.push({ id: 'E_RMJ_SHA_DN', from: 'RMJ_DN', to: 'SHA_DN', lengthMeters: 320, maxSpeedMph: 35 });
  edges.push({ id: 'E_SHA_RMJ_UP', from: 'SHA_UP', to: 'RMJ_UP', lengthMeters: 320, maxSpeedMph: 35 });
  connectStations('SHA', 'LIM', 1050, 45);
  connectStations('LIM', 'WFE', 950, 45);

  // ============================================================================
  // 2. CLEAN GEOMETRIC DELTA & WEST INDIA QUAY (WIQ) 4-TRACK BYPASS (SOP-WIQ)
  // ============================================================================
  // Top side of Delta: Direct Horizontal Flying Viaduct WFE <-> POP (y = 840)
  connectStations('WFE', 'POP', 950, 35, true, false, 'DELTA NORTH FLYOVER (35 MPH)');

  // East side of Delta: Poplar <-> West India Quay (Both directions call at WIQ!)
  connectStations('POP', 'WIQ', 600, 25, true);

  // West side of Delta:
  // - Southbound WFE_DN -> WIQ_DN calls at West India Quay P2
  edges.push({
    id: 'E_WFE_WIQ_DN',
    from: 'WFE_DN',
    to: 'WIQ_DN',
    lengthMeters: 620,
    maxSpeedMph: 25,
    isFlyover: true,
    edgeLabel: 'WFE→WIQ DN CHORD',
  });

  // - Northbound/Westbound CAW_UP & CAW_MID -> DLT_BYP_UP -> WFE_UP bypasses West India Quay completely (SOP-WIQ)!
  addSpecialNode(
    'DLT_BYP_UP',
    'Canary Wharf → Westferry Dive-Under Bypass Track (No Platform at WIQ)',
    'WFE',
    'junction',
    860,
    1040,
    'UP',
    'CAW→WFE BYPASS (NO WIQ STOP)',
    3,
    'BYP'
  );
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
    id: 'E_BYP_WFE_UP',
    from: 'DLT_BYP_UP',
    to: 'WFE_UP',
    lengthMeters: 520,
    maxSpeedMph: 30,
    isFlyover: true,
  });

  // Poplar Center Turnback & Stabling Pocket (between Poplar & Blackwall at y = 840)
  addSpecialNode(
    'POP_REV',
    'Poplar East Turnback & Stabling Pocket',
    'POP',
    'siding',
    1360,
    840,
    'BI',
    'POP TURNBACK POCKET',
    3,
    'R'
  );
  addBiLink('POP_DN', 'POP_REV', 180, 20, true);
  addBiLink('POP_REV', 'POP_UP', 180, 20, true);

  // Canary Wharf Center Turnback & Stabling Road (P3/P4 Center Track between UP and DN)
  addSpecialNode(
    'CAW_MID',
    'Canary Wharf P3/P4 Center Turnback Road',
    'CAW',
    'siding',
    1040,
    1150,
    'BI',
    'CAW P3/P4 CENTER RD',
    3,
    '3'
  );
  addBiLink('CAW_DN', 'CAW_MID', 110, 20, true);
  addBiLink('CAW_MID', 'CAW_UP', 110, 20, true);

  // ============================================================================
  // 3. POPLAR DEPOT (PDP) CLEAN 3-ROAD HORIZONTAL STABLING FORK (ZERO SPIDERWEBS)
  // ============================================================================
  addSpecialNode(
    'PDP_THROAT',
    'Poplar Depot Reception & Wash Lead',
    'PDP',
    'junction',
    1220,
    610,
    'BI',
    'PDP RECEPTION LEAD',
    3,
    'T'
  );
  addSpecialNode(
    'PDP_S1',
    'Poplar Depot Road 1 (West Stabling Berth)',
    'PDP',
    'depot',
    1520,
    550,
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
    1520,
    610,
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
    1520,
    670,
    'BI',
    'PDP RD 3 (WORKSHOP)',
    3,
    'R3'
  );

  // Clean orthogonal/45° depot tree: POP <-> PDP_THROAT <-> PDP <-> PDP_S1 / S2 / S3
  addBiLink('POP_UP', 'PDP_THROAT', 240, 15, false);
  addBiLink('POP_DN', 'PDP_THROAT', 240, 15, true);
  addBiLink('PDP_THROAT', 'PDP_UP', 180, 15, false);
  addBiLink('PDP_THROAT', 'PDP_DN', 180, 15, false);
  addBiLink('PDP_UP', 'PDP_S1', 160, 12, false);
  addBiLink('PDP_UP', 'PDP_S2', 160, 12, false);
  addBiLink('PDP_DN', 'PDP_S3', 160, 12, false);

  // ============================================================================
  // 4. STRATFORD INTL (STI) & STRATFORD REGIONAL (STR) ORTHOGONAL ARCH + NORTH SPINES
  // ============================================================================
  // 4a. Stratford International Tail Buffer Siding (Horizontal West of STI at y = 75)
  addSpecialNode(
    'STI_HSH',
    'Stratford International Olympic Tail Siding & Buffer',
    'STI',
    'siding',
    1210,
    75,
    'BI',
    'STI OLYMPIC SIDING',
    3,
    'S'
  );
  addBiLink('STI_UP', 'STI_HSH', 130, 15, true);
  addBiLink('STI_DN', 'STI_HSH', 130, 15, true);

  // Vertical connection STI (1380, 75) <-> STR (1380, 185)
  connectStations('STI', 'STR', 680, 40, false, false, 'OLYMPIC PARK CUTTING');

  // 4b. West Fork of Stratford Arch: STR (1380, 185) -> STR_BAY (1040, 185) -> North Spine (x = 1040)
  addSpecialNode(
    'STR_BAY',
    'Stratford High-Level Terminal Bays (P4A / P4B)',
    'STR',
    'siding',
    1040,
    185,
    'BI',
    'STR P4A/B BAY TURNBACK',
    3,
    '4A'
  );
  addBiLink('STR_UP', 'STR_BAY', 220, 25, false);
  addBiLink('STR_DN', 'STR_BAY', 220, 25, false);
  addBiLink('STR_BAY', 'PML_DN', 380, 35, false);
  addBiLink('PML_UP', 'STR_BAY', 380, 35, false);

  // 4c. Pudding Mill Lane Olympic Turnback Pocket (Left of PML at x = 890, y = 310)
  addSpecialNode(
    'PML_REV',
    'Pudding Mill Lane Olympic Turnback Pocket Siding',
    'PML',
    'siding',
    890,
    310,
    'BI',
    'PML OLYMPIC POCKET',
    3,
    '3'
  );
  addBiLink('PML_UP', 'PML_REV', 150, 20, true);
  addBiLink('PML_REV', 'PML_DN', 150, 20, true);

  // Connect North Spine stations cleanly down x = 1040
  connectStations('PML', 'BOW', 850, 40);
  connectStations('BOW', 'DEV', 750, 35);
  connectStations('DEV', 'LAN', 700, 35);
  connectStations('LAN', 'ALL', 650, 35);
  connectStations('ALL', 'POP', 650, 25);

  // 4d. East Fork of Stratford Arch: STR (1380, 185) -> STR_MKT_JCT (1760, 185) -> Lea Valley Spine (x = 1760)
  addSpecialNode(
    'STR_MKT_JCT',
    'Stratford Low-Level P16/P17 & Market Crossover',
    'STR',
    'junction',
    1760,
    185,
    'BI',
    'STR MARKET X-OVER',
    3,
    'M'
  );
  addBiLink('STR_DN', 'STR_MKT_JCT', 240, 35, false);
  addBiLink('STR_MKT_JCT', 'STR_UP', 240, 35, false);
  addBiLink('STR_MKT_JCT', 'SHS_DN', 380, 40, false);
  addBiLink('SHS_UP', 'STR_MKT_JCT', 380, 40, false);

  // Connect Lea Valley Spine stations cleanly down x = 1760 to Canning Town
  connectStations('SHS', 'ABB', 750, 45);
  connectStations('ABB', 'WHM', 850, 45);
  connectStations('WHM', 'STL', 800, 40);
  connectStations('STL', 'CNT', 850, 35);

  // ============================================================================
  // 5. SOUTH SPINE (x = 1040: WIQ -> CAW -> GREENWICH THAMES BORE -> LEWISHAM)
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
  // 6. CENTRAL TRUNK (POP -> BLW -> EIR -> CNT)
  // ============================================================================
  connectStations('POP', 'BLW', 950, 40);
  connectStations('BLW', 'EIR', 850, 40);
  connectStations('EIR', 'CNT', 1050, 40, true);

  // ============================================================================
  // 7. BECKTON LOOP & CLEAN 4-ROAD BECKTON DEPOT LADDER (ZERO SPIDERWEBS)
  // ============================================================================
  connectStations('CNT', 'RVC', 950, 40, true);
  connectStations('RVC', 'CUH', 800, 40);

  // Custom House ExCeL Center Turnback Pocket Siding
  addSpecialNode(
    'CUH_SID',
    'Custom House ExCeL Turnback Siding',
    'CUH',
    'siding',
    2370,
    700,
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
    2240,
    380,
    'BI',
    'BCK TAIL SIDING',
    3,
    'S'
  );
  addBiLink('BCK_UP', 'BCK_REV', 140, 15, true);
  addBiLink('BCK_DN', 'BCK_REV', 140, 15, true);

  // Beckton Depot East & West Vertical Ladders + 4 Parallel Horizontal Stabling Roads
  addSpecialNode(
    'BDP_W_LEAD',
    'Beckton Depot West Reception Ladder (to Beckton)',
    'BDP',
    'junction',
    2400,
    215,
    'BI',
    'BDP WEST LADDER',
    3,
    'W'
  );
  addSpecialNode(
    'BDP_E_LEAD',
    'Beckton Depot East Reception Ladder (to Gallions Reach)',
    'BDP',
    'junction',
    2800,
    215,
    'BI',
    'BDP EAST LADDER',
    3,
    'E'
  );
  addSpecialNode(
    'BDP_R1',
    'Beckton Depot Road 1 — North Stabling Fan (3 Trains)',
    'BDP',
    'depot',
    2210,
    115,
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
    2210,
    165,
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
    2210,
    215,
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
    2965,
    215,
    'BI',
    'BDP RD 4 (WASH & REV LOOP)',
    3,
    'R4'
  );

  // Clean orthogonal/45° depot tree (Zero crossing lines!)
  addBiLink('BCK_UP', 'BDP_W_LEAD', 240, 15, false);
  addBiLink('BCK_DN', 'BDP_W_LEAD', 240, 15, true);
  addBiLink('GAL_UP', 'BDP_E_LEAD', 240, 15, false);
  addBiLink('GAL_DN', 'BDP_E_LEAD', 240, 15, true);
  addBiLink('BDP_W_LEAD', 'BDP_UP', 180, 15, false);
  addBiLink('BDP_W_LEAD', 'BDP_DN', 180, 15, false);
  addBiLink('BDP_E_LEAD', 'BDP_UP', 180, 15, false);
  addBiLink('BDP_E_LEAD', 'BDP_DN', 180, 15, false);
  addBiLink('BDP_W_LEAD', 'BDP_R1', 210, 12, false);
  addBiLink('BDP_W_LEAD', 'BDP_R2', 210, 12, false);
  addBiLink('BDP_W_LEAD', 'BDP_R3', 210, 12, false);
  addBiLink('BDP_E_LEAD', 'BDP_R4', 210, 15, false);

  // ============================================================================
  // 8. WOOLWICH ARSENAL BRANCH (Diving UNDER the Labelled River Thames from KGV to WOO!)
  // ============================================================================
  connectStations('CNT', 'WSV', 1100, 45, true);
  connectStations('WSV', 'PDK', 850, 40);
  connectStations('PDK', 'LCA', 950, 40, true);
  connectStations('LCA', 'KGV', 1050, 45);
  connectStations('KGV', 'WOO', 1550, 50, false, true, 'WOOLWICH THAMES BORE (50 MPH · SOP-UG1)');

  addSpecialNode(
    'WOO_HSH',
    'Woolwich Arsenal Sub-Surface Tail Siding & Buffers',
    'WOO',
    'siding',
    2935,
    1260,
    'BI',
    'WOO TAIL SIDING',
    3,
    'S'
  );
  addBiLink('WOO_UP', 'WOO_HSH', 135, 15, true);
  addBiLink('WOO_DN', 'WOO_HSH', 135, 15, true);

  // Pair actual parallel roads by both endpoints. A siding or a flyover crossing
  // the schematic shares neither the same pair of roads nor the same sightline.
  const links = new Map(edges.map(edge => [edge.from + '>' + edge.to, edge]));
  for (const edge of edges) {
    if (edge.isCrossover) continue;
    const suffix = edge.from.endsWith('_UP') ? '_UP' : '_DN';
    if (!edge.from.endsWith(suffix) || !edge.to.endsWith(suffix)) continue;
    const other = suffix === '_UP' ? '_DN' : '_UP';
    const from = edge.to.slice(0, -3) + other;
    const to = edge.from.slice(0, -3) + other;
    const paired = links.get(from + '>' + to);
    if (paired && !paired.isCrossover) edge.oppositeEdgeId = paired.id;
  }
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
