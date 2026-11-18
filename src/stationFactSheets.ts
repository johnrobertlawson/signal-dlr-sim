import { Station } from './types';
import { DLRSimulation } from './simulation';
import { STATION_MAP } from './dlrData';

export interface StationFactSheet {
  stationId: string;
  tagline: string;
  structureType: string;
  platformLayout: string;
  trackTopology: 'TERMINUS_HEADSHUNT' | 'THREE_TRACK_HUB' | 'FOUR_PLATFORM_JUNCTION' | 'TURNBACK_CROSSOVER' | 'SHORT_PLATFORM_SDO' | 'DEPOT_YARD' | 'PLAIN_DOUBLE';
  gotchas: string[];
  advantages: string[];
  disadvantages: string[];
  operationalNotes: string;
}

const CUSTOM_FACT_SHEETS: Record<string, Partial<StationFactSheet>> = {
  BNK: {
    tagline: 'Deep-Tube City Financial Terminus & Headshunt Bore',
    structureType: 'Subterranean Bored Tube Tunnels (41m below King William Street)',
    platformLayout: '2 Island Platforms (P9 & P10) with single-track tail headshunt overrun tunnel',
    trackTopology: 'TERMINUS_HEADSHUNT',
    gotchas: [
      'Single-bore headshunt behind platforms means only 1 train can reverse at a time; a stalled VOBC unit in the headshunt locks both platforms.',
      'Steep 1-in-20 (5%) approach gradient from Shadwell requires strict CBTC braking margins.',
    ],
    advantages: [
      'Highest financial commuter yield on the network (Direct connection to Central, Northern, Waterloo & City lines, and Monument).',
      'Cross-passage platform layout separates boarding and alighting surges cleanly.',
    ],
    disadvantages: [
      'Zero stabling capacity — every arriving train must clear back Eastbound within 90–120 seconds or queue backs up into Shadwell tunnel.',
      'Deep evacuation profile triggers immediate tunnel lockout (Plan B) if smoke sensors activate.',
    ],
    operationalNotes: 'During Bank tunnel blockades, immediately activate Plan B (TWG Divert) to divert 2-car sets into Tower Gateway and short-turn 3-car sets at Shadwell.',
  },
  TWG: {
    tagline: 'Historic Brick Viaduct Terminus — Strictly 2-Car Restricted',
    structureType: 'Elevated Victorian Brick Viaduct adjacent to Fenchurch Street',
    platformLayout: 'Single Central Island Track with Spanish-Solution dual-side platforms (Boarding one side, Alighting the other)',
    trackTopology: 'SHORT_PLATFORM_SDO',
    gotchas: [
      'STRICT 2-CAR (60m) LIMIT: 3-car trains physically foul the entry points and cannot enter Tower Gateway!',
      'Single terminal track means minimum 3.5-minute turnaround headway.',
    ],
    advantages: [
      'Spanish-solution doors on both sides of the train cut passenger exchange dwell times by 35%.',
      'Vital relief valve when the deep-level Bank bore is closed.',
    ],
    disadvantages: [
      'Cannot accept 3-car B07/B23 formations — limits Beckton-Tower Gateway route capacity.',
      'Single-track throat creates an immediate bottleneck if a train suffers a door fault.',
    ],
    operationalNotes: 'Keep 3xx Tower Gateway↔Beckton templates set to 2-Car stock unless diverting eastbound services to Bank.',
  },
  SHA: {
    tagline: 'Western Throat Split & Emergency Turnback Crossover',
    structureType: 'Elevated Concrete & Steel Viaduct (Single-span cable-stayed bridge)',
    platformLayout: 'Single Island Platform serving UP (Westbound) and DN (Eastbound) tracks with eastern scissor crossover',
    trackTopology: 'TURNBACK_CROSSOVER',
    gotchas: [
      'Converging westbound trains from Beckton, Woolwich, and Lewisham all merge here before splitting for Bank vs. Tower Gateway.',
      'Reversing a 3-car train on the eastern crossover temporarily fouls both main running lines.',
    ],
    advantages: [
      'Last 3-car capable turnback before the Bank tunnel dive and Tower Gateway 2-car limit.',
      'Direct London Overground (East London Line) interchange below.',
    ],
    disadvantages: [
      'Narrow island platform gets congested rapidly during Plan B short-turns.',
    ],
    operationalNotes: 'Primary turnback node for 3-car trains during Bank tunnel emergencies.',
  },
  WFE: {
    tagline: 'Western Gateway to the Poplar / West India Quay Delta Junction',
    structureType: 'Elevated Viaduct with Bifurcating Flying Junctions East of Platform',
    platformLayout: '2 Side Platforms with western turnback crossover and eastern grade-separated flyover split',
    trackTopology: 'TURNBACK_CROSSOVER',
    gotchas: [
      'Facing points immediately east of the platform split trains toward Poplar (Central/East) vs. West India Quay (Canary Wharf/Lewisham).',
      'An wrongly routed NX train here will end up on the wrong branch across the Delta.',
    ],
    advantages: [
      'Grade-separated flying junctions allow eastbound Poplar trains to pass over westbound Canary Wharf→Bank trains without conflict.',
    ],
    disadvantages: [
      '25 mph speed restriction on the tight southward curve onto the West India Quay viaduct.',
    ],
    operationalNotes: 'Watch the facing points at WFE_DN closely — a points detection loss here requires bi-directional Single Line Working (SLW).',
  },
  POP: {
    tagline: 'Network Nerve Centre, 4-Track Cross-Platform Hub & Depot Portal',
    structureType: 'At-Grade & Elevated 4-Track Hub adjacent to Poplar Operations & Control Centre',
    platformLayout: '2 Island Platforms (4 Platform Faces: P1–P4) with direct leads to Poplar Depot & Stratford North branch',
    trackTopology: 'FOUR_PLATFORM_JUNCTION',
    gotchas: [
      'Four branches (Westferry, Stratford North, Canary Wharf South, Canning Town East) plus Poplar Depot all converge at Poplar.',
      'ECS depot trains exiting Poplar Depot (PDP) at 15 mph can delay 40 mph Canning Town expresses if timed poorly.',
    ],
    advantages: [
      'Cross-platform interchange between Stratford↔Canary Wharf and Bank↔Woolwich/Beckton services.',
      'Immediate access to Poplar Depot for rapid PSA dispatch or defective unit swap-outs.',
    ],
    disadvantages: [
      'Complex interlocking throat; holding one junction signal RED can cascade across 3 branches within 2 minutes.',
    ],
    operationalNotes: 'Use Keyboard Shortcut [1:DELTA] to monitor Poplar, Westferry, and West India Quay together.',
  },
  CAW: {
    tagline: 'Flagship 3-Track, 6-Platform Financial Megahub',
    structureType: 'Covered Glass-Canopy Elevated Viaduct Station over Middle Dock',
    platformLayout: '3 Tracks flanked by 4 Platforms (6 Platform Faces) allowing Spanish-Solution dual-side boarding & center turnback',
    trackTopology: 'THREE_TRACK_HUB',
    gotchas: [
      'Busiest station on the DLR — banking peak surges can double platform dwell times if headways drop below 4 minutes.',
      '25 mph noise-abatement speed restriction through the station canopy.',
    ],
    advantages: [
      'Dedicated center turnback road allows Stratford or Bank trains to terminate and reverse (Plan A) without blocking through Lewisham services.',
      'Dual-side doors open simultaneously to handle 50,000+ daily passengers.',
    ],
    disadvantages: [
      'Closely spaced between West India Quay (450m north) and Heron Quays (450m south), leaving minimal CBTC buffer distance.',
    ],
    operationalNotes: 'Activate Plan A (CAW Turnback) whenever Mudchute, Cutty Sark, or the Greenwich bore is obstructed.',
  },
  CUT: {
    tagline: 'Sub-Aqueous Thames Foot-Tunnel Bore — 2-Car SDO Platform',
    structureType: 'Deep Underground Cut-and-Cover Box & Bored Tunnel (Maritime Greenwich World Heritage Site)',
    platformLayout: 'Single Narrow Island Platform (60m / 2-Car length) with Selective Door Operation (SDO) for 3-car units',
    trackTopology: 'SHORT_PLATFORM_SDO',
    gotchas: [
      'SHORT PLATFORM GOTCHA: Only 2-car length! 3-car trains must engage Selective Door Operation (keeping front & rear end doors locked), adding a +6s dwell time penalty on every stop.',
      'No turnback crossover — trains committed south of Island Gardens must continue through the Thames bore to Greenwich.',
    ],
    advantages: [
      'High leisure & tourist footfall for Cutty Sark clipper ship and Greenwich town centre.',
    ],
    disadvantages: [
      'Permanent +6s SDO dwell bottleneck on every 3-car Bank↔Lewisham and Stratford↔Lewisham service.',
      'Deep bore pump or fire alarms lock the entire cross-river section.',
    ],
    operationalNotes: 'If a train stalls at Cutty Sark, turn back southbound trains at Island Gardens (ISG) or Canary Wharf (Plan A) and northbound trains at Greenwich (GRE).',
  },
  ELV: {
    tagline: 'Ravensbourne Viaduct — 2-Car Selective Door Platform',
    structureType: 'At-Grade / Low Viaduct alongside Lewisham Brook',
    platformLayout: '2 Side Platforms constrained to 2-car length by road bridge abutments (SDO required for 3-car sets)',
    trackTopology: 'SHORT_PLATFORM_SDO',
    gotchas: [
      'Like Cutty Sark, Elverson Road platforms only accommodate 2 cars — 3-car trains incur a +6s SDO dwell penalty right before entering Lewisham terminus.',
    ],
    advantages: [
      'Low base passenger demand keeps normal dwell times short.',
    ],
    disadvantages: [
      'Sits immediately north of Lewisham’s busy scissor crossover throat; a slow SDO dwell here can hold a train waiting to exit Lewisham.',
    ],
    operationalNotes: 'Monitor headway spacing between Deptford Bridge, Elverson Road, and Lewisham during peak 3-car operations.',
  },
  LEW: {
    tagline: 'Southern Terminus & Southeastern Mainline Interchange',
    structureType: 'Low-Level Concrete Box beneath Lewisham National Rail Viaduct',
    platformLayout: 'Single Island Platform (P5 & P6) with high-capacity scissor crossover throat north of station',
    trackTopology: 'TERMINUS_HEADSHUNT',
    gotchas: [
      'Both Bank↔Lewisham (1xx) and Stratford↔Lewisham (4xx) streams terminate here — requiring crisp 2.5-minute alternating departures over the scissor crossover.',
    ],
    advantages: [
      'Full 3-car island platform with rapid cross-platform turnaround.',
      'Major South London commuter feed from Southeastern rail lines.',
    ],
    disadvantages: [
      'No stabling sidings beyond the buffer stops; a broken-down unit blocks 50% of terminal capacity immediately.',
    ],
    operationalNotes: 'If both platforms fill up during a peak delay, hold the approach signal at Elverson Road or short-turn every second unit at Greenwich (GRE).',
  },
  CNT: {
    tagline: 'Eastern 4-Branch Megajunction (Beckton, Woolwich, Stratford Intl & Poplar)',
    structureType: 'Multi-Level Stacked Viaduct & At-Grade Interchange alongside Jubilee Line',
    platformLayout: '2 Levels: Upper Double-Deck Viaduct (Poplar ↔ Beckton/Woolwich) & Lower Platforms (Stratford International ↔ Woolwich)',
    trackTopology: 'FOUR_PLATFORM_JUNCTION',
    gotchas: [
      'Four major routes merge and split here: Poplar trunk, Stratford International branch, Royal Docks (Beckton), and Silvertown (Woolwich Arsenal).',
      'Points failure at CNT_DN affects both Eastbound branches unless Single Line Working is used.',
    ],
    advantages: [
      'Stacked flying junction design separates Stratford Intl↔Woolwich from Bank/Tower Gateway↔Beckton flows.',
      'Turnback crossover allows instant relief shuttles to Custom House (ExCeL) or London City Airport.',
    ],
    disadvantages: [
      'Heavy Jubilee Line transfer waves can cause sudden platform crowding.',
    ],
    operationalNotes: 'Canning Town is the launchpad for both Plan C (Custom House ExCeL Shuttle) and Airport relief runs.',
  },
  CUH: {
    tagline: 'ExCeL London Exhibition Hub & Elizabeth Line Interchange',
    structureType: 'Elevated Viaduct & Mezzanine Footbridge linked to ExCeL Exhibition Centre',
    platformLayout: '2 Platforms + Turnback Siding / Crossover east of station for exhibition shuttles',
    trackTopology: 'TURNBACK_CROSSOVER',
    gotchas: [
      'Trade shows and conventions at ExCeL trigger sudden +55% to +85% passenger crowding spikes, extending dwell times by +20s.',
    ],
    advantages: [
      'Equipped with a dedicated turnback crossover (Plan C: CUH Shuttle) so Canning Town↔Custom House shuttles can reverse without running all the way to Beckton.',
    ],
    disadvantages: [
      '2-car Tower Gateway↔Beckton trains often reach 100% crush load here during ExCeL events unless supplemented by 3-car shuttles.',
    ],
    operationalNotes: 'When ExCeL crowd surges appear in the Priority Action Inset, inject the 3-car Canning Town↔Custom House shuttle.',
  },
  LCA: {
    tagline: 'London City Airport Viaduct & Thames Tunnel Approach Turnback',
    structureType: 'High-Level Concrete Viaduct parallel to London City Airport Runway',
    platformLayout: 'Single Covered Island Platform with western scissor crossover for Airport turnbacks',
    trackTopology: 'TURNBACK_CROSSOVER',
    gotchas: [
      'Wave arrivals of business jets and regional airliners cause sharp, unpredictable passenger surges with heavy luggage (slower boarding dwells).',
    ],
    advantages: [
      'Western scissor crossover allows Plan D (LCA Turnback) to terminate trains here whenever the sub-aqueous Woolwich Thames bore is blocked.',
    ],
    disadvantages: [
      'Long 1.55 km sub-aqueous tunnel section south from King George V to Woolwich Arsenal has no intermediate escape crossover.',
    ],
    operationalNotes: 'During Airshow events, inject the 7xx Stratford↔London City Airport 3-car charter template.',
  },
  WOO: {
    tagline: 'South-East Cross-River Terminus beneath Woolwich Town Centre',
    structureType: 'Underground Cut-and-Cover Station Box at the southern portal of the Thames Bore',
    platformLayout: '2 Island Platforms (P3 & P4) with northern scissor crossover inside the tunnel portal',
    trackTopology: 'TERMINUS_HEADSHUNT',
    gotchas: [
      'Approached via a 50 mph, 1.55 km under-river tunnel from King George V — the fastest and longest inter-station run on the DLR.',
    ],
    advantages: [
      'High-speed 50 mph tunnel run allows SelTrac ATO to recover up to 25 seconds of schedule delay on approach.',
      'Direct interchange with Elizabeth Line and Southeastern National Rail.',
    ],
    disadvantages: [
      'Any track circuit drop in the Thames bore isolates Woolwich Arsenal completely from the rest of the network.',
    ],
    operationalNotes: 'Use Plan D (LCA Turnback) if the King George V – Woolwich Arsenal tunnel bore locks at RED.',
  },
};

export function getStationFactSheet(st: Station): StationFactSheet {
  const custom = CUSTOM_FACT_SHEETS[st.id] || {};
  const isDepot = st.id === 'PDP' || st.id === 'BDP';
  const isShort = st.maxCars === 2;

  const defaultTopology: StationFactSheet['trackTopology'] = isDepot
    ? 'DEPOT_YARD'
    : st.isTerminus
    ? 'TERMINUS_HEADSHUNT'
    : isShort
    ? 'SHORT_PLATFORM_SDO'
    : st.hasTurnback
    ? 'TURNBACK_CROSSOVER'
    : 'PLAIN_DOUBLE';

  return {
    stationId: st.id,
    tagline:
      custom.tagline ||
      `${st.branch} Branch ${st.isTerminus ? 'Terminus' : st.hasTurnback ? 'Turnback & Regulation Station' : 'Through Viaduct Station'}`,
    structureType:
      custom.structureType ||
      (isDepot
        ? 'At-Grade Maintenance & Stabling Yard with 15 mph Entry/Exit Leads'
        : 'Elevated DLR Concrete Viaduct with Automated SelTrac Inductive Loop Track'),
    platformLayout:
      custom.platformLayout ||
      `2 Platforms (P1 UP / P2 DN) · Max ${st.maxCars}-Car Formation (${st.maxCars === 3 ? '90m' : '60m'})${
        st.hasTurnback ? ' + Interlocked Scissor/Turnback Crossover' : ''
      }`,
    trackTopology: custom.trackTopology || defaultTopology,
    gotchas: custom.gotchas || [
      isShort
        ? '2-Car (60m) platform length restriction! 3-car units incur a +6s Selective Door Operation (SDO) dwell penalty.'
        : st.hasTurnback
        ? 'Reversing a train across the turnback crossover briefly occupies both UP and DN running lines (20 mph crossover limit).'
        : 'No turnback crossover at this station — trains cannot reverse here during a downstream line blockage.',
      `Base passenger demand is ${st.baseDemand}/10; monitor CBTC headway spacing during peak waves.`,
    ],
    advantages: custom.advantages || [
      st.hasTurnback
        ? 'Equipped with an interlocked crossover — can be selected as a live DIVERT / short-turn destination for any delayed train.'
        : 'Straight 40–45 mph plain-line alignment allows SelTrac moving-block ATO to recover minor schedule delays.',
      st.interchange && st.interchange.length > 0
        ? `Multi-modal interchange with ${st.interchange.join(', ')}.`
        : 'Clean through-platform sightlines for rapid 14–18s automated door cycles.',
    ],
    disadvantages: custom.disadvantages || [
      !st.hasTurnback
        ? 'Lack of points/crossovers means a broken-down VOBC train here blocks the running line until a PSA drives it forward at 18 mph.'
        : 'Junction points require periodic lock detection; vulnerable to points failures during heavy service.',
    ],
    operationalNotes:
      custom.operationalNotes ||
      (st.hasTurnback
        ? `Click any signal lamp at ${st.code} to set a manual white NX route across the crossover, or select ${st.code} in the Unit Inspector's DIVERT dropdown.`
        : `Plain-line SelTrac CBTC station. Hover the train berth or platform to monitor live dwell countdowns.`),
  };
}

// Render an enlarged SVG Micro-Schematic of the station's exact track, platform, signal, and crossover layout
export function renderStationMicroSchematicSVG(st: Station, sheet: StationFactSheet, sim: DLRSimulation): string {
  const upNode = sim.nodeMap[`${st.id}_UP`];
  const dnNode = sim.nodeMap[`${st.id}_DN`];
  const upSigColor = upNode?.signalAspect === 'RED' ? '#EF4444' : upNode?.signalAspect === 'AMBER' ? '#F59E0B' : '#10B981';
  const dnSigColor = dnNode?.signalAspect === 'RED' ? '#EF4444' : dnNode?.signalAspect === 'AMBER' ? '#F59E0B' : '#10B981';

  // Find any trains currently at or approaching this station
  const trainsHere = sim.trains.filter(
    (t) => t.currentNodeId === `${st.id}_UP` || t.currentNodeId === `${st.id}_DN` || t.nextNodeId === `${st.id}_UP` || t.nextNodeId === `${st.id}_DN`
  );
  const upTrain = trainsHere.find((t) => t.currentNodeId.endsWith('_UP') || t.nextNodeId?.endsWith('_UP'));
  const dnTrain = trainsHere.find((t) => t.currentNodeId.endsWith('_DN') || t.nextNodeId?.endsWith('_DN'));

  const isThreeTrack = sheet.trackTopology === 'THREE_TRACK_HUB';
  const isTerminus = sheet.trackTopology === 'TERMINUS_HEADSHUNT';
  const hasCrossover = st.hasTurnback || st.isTerminus || isThreeTrack;
  const isShort = st.maxCars === 2;

  return `
  <svg viewBox="0 0 680 185" class="micro-schematic-svg" role="img" aria-label="Detailed track schematic for ${st.name}">
    <defs>
      <pattern id="microGrid" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(0, 164, 167, 0.08)" stroke-width="1"/>
      </pattern>
    </defs>

    <!-- Background Grid -->
    <rect width="680" height="185" rx="6" fill="#070C12" />
    <rect width="680" height="185" rx="6" fill="url(#microGrid)" />

    <!-- Top Diagram Banner -->
    <text x="16" y="22" fill="#94A3B8" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">
      MICRO-INTERLOCKING DIAGRAM · ${st.code} (${st.branch.toUpperCase()} SECTOR) · MAX ${st.maxCars}-CAR (${isShort ? '60m SDO' : '90m FULL'})
    </text>

    <!-- UP Track (Platform 1 - West/Northbound) -->
    <line x1="35" y1="68" x2="${isTerminus && st.id === 'BNK' ? '615' : '645'}" y2="68" stroke="${upTrain ? '#EF4444' : '#334155'}" stroke-width="4.5" />
    <text x="42" y="55" fill="#38BDF8" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">← UP LINE (P1)</text>

    <!-- DN Track (Platform 2 - East/Southbound) -->
    <line x1="35" y1="132" x2="645" y2="132" stroke="${dnTrain ? '#EF4444' : '#334155'}" stroke-width="4.5" />
    <text x="42" y="152" fill="#38BDF8" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">DN LINE (P2) →</text>

    ${
      isThreeTrack
        ? `<!-- Center Turnback Road P2/P3 (Canary Wharf style) -->
           <line x1="120" y1="100" x2="560" y2="100" stroke="#00A4A7" stroke-width="3.5" stroke-dasharray="6,4" />
           <line x1="120" y1="100" x2="80" y2="68" stroke="#475569" stroke-width="2.5" />
           <line x1="120" y1="100" x2="80" y2="132" stroke="#475569" stroke-width="2.5" />
           <line x1="560" y1="100" x2="600" y2="68" stroke="#475569" stroke-width="2.5" />
           <line x1="560" y1="100" x2="600" y2="132" stroke="#475569" stroke-width="2.5" />
           <text x="340" y="95" text-anchor="middle" fill="#22D3EE" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700">CENTER TURNBACK ROAD (PLAN A)</text>`
        : ''
    }

    ${
      hasCrossover
        ? `<!-- Interlocked Scissor / Turnback Crossover -->
           <line x1="115" y1="68" x2="175" y2="132" stroke="#64748B" stroke-width="2.5" stroke-dasharray="5,4" />
           <line x1="115" y1="132" x2="175" y2="68" stroke="#64748B" stroke-width="2.5" stroke-dasharray="5,4" />
           <text x="145" y="104" text-anchor="middle" fill="#FBBF24" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700">20 MPH X-OVER</text>`
        : `<!-- Plain Line Notice -->
           <text x="135" y="104" text-anchor="middle" fill="#64748B" font-family="JetBrains Mono, monospace" font-size="9">NO CROSSOVER (PLAIN LINE)</text>`
    }

    ${
      isTerminus
        ? `<!-- Terminus Buffer Stops / Overrun Headshunt -->
           <rect x="635" y="56" width="8" height="24" fill="#EF4444" rx="2" />
           <rect x="635" y="120" width="8" height="24" fill="#EF4444" rx="2" />
           <text x="625" y="103" text-anchor="end" fill="#FCA5A5" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700">TERMINUS BUFFERS / HEADSHUNT</text>`
        : ''
    }

    <!-- Platform 1 Structure Box -->
    <rect x="235" y="42" width="${isShort ? '160' : '230'}" height="18" rx="3" fill="#1E293B" stroke="${isShort ? '#F59E0B' : '#00A4A7'}" stroke-width="1.8" />
    <text x="${isShort ? '315' : '350'}" y="54" text-anchor="middle" fill="#F8FAFC" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">
      PLATFORM 1 (${isShort ? '60m · 2-CAR MAX' : '90m · 3-CAR'})
    </text>

    <!-- Platform 2 Structure Box -->
    <rect x="235" y="140" width="${isShort ? '160' : '230'}" height="18" rx="3" fill="#1E293B" stroke="${isShort ? '#F59E0B' : '#00A4A7'}" stroke-width="1.8" />
    <text x="${isShort ? '315' : '350'}" y="152" text-anchor="middle" fill="#F8FAFC" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">
      PLATFORM 2 (${isShort ? '60m · 2-CAR MAX' : '90m · 3-CAR'})
    </text>

    ${
      isShort
        ? `<!-- SDO Overhang Warning Zone for 3rd Car -->
           <rect x="398" y="42" width="68" height="18" rx="2" fill="rgba(239, 68, 68, 0.18)" stroke="#EF4444" stroke-dasharray="3,3" />
           <text x="432" y="54" text-anchor="middle" fill="#FCA5A5" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700">3RD CAR SDO</text>
           <rect x="398" y="140" width="68" height="18" rx="2" fill="rgba(239, 68, 68, 0.18)" stroke="#EF4444" stroke-dasharray="3,3" />
           <text x="432" y="152" text-anchor="middle" fill="#FCA5A5" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700">LOCKED (+6s)</text>`
        : ''
    }

    <!-- Signal Aspect Lamps -->
    <circle cx="215" cy="58" r="6" fill="${upSigColor}" stroke="#0F172A" stroke-width="1.5" />
    <text x="215" y="45" text-anchor="middle" fill="#94A3B8" font-family="JetBrains Mono, monospace" font-size="8.5">${st.code}_UP</text>

    <circle cx="488" cy="142" r="6" fill="${dnSigColor}" stroke="#0F172A" stroke-width="1.5" />
    <text x="488" y="166" text-anchor="middle" fill="#94A3B8" font-family="JetBrains Mono, monospace" font-size="8.5">${st.code}_DN</text>

    <!-- Live Train Berths if present -->
    ${
      upTrain
        ? `<g transform="translate(310, 68)">
             <rect x="-36" y="-10" width="72" height="20" rx="4" fill="#0F172A" stroke="${upTrain.color}" stroke-width="2" />
             <text x="0" y="4" text-anchor="middle" fill="#FFFFFF" font-family="JetBrains Mono, monospace" font-size="10" font-weight="800">${upTrain.headcode}</text>
           </g>`
        : ''
    }
    ${
      dnTrain
        ? `<g transform="translate(310, 132)">
             <rect x="-36" y="-10" width="72" height="20" rx="4" fill="#0F172A" stroke="${dnTrain.color}" stroke-width="2" />
             <text x="0" y="4" text-anchor="middle" fill="#FFFFFF" font-family="JetBrains Mono, monospace" font-size="10" font-weight="800">${dnTrain.headcode}</text>
           </g>`
        : ''
    }
  </svg>
  `;
}
