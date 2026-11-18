import { DLRSimulation } from './simulation';
import { SchematicCanvas } from './schematicCanvas';
import { STATION_MAP } from './dlrData';
import { soundEngine } from './audio';

export type ObserveFocus =
  | 'FULL_AUTOPILOT'
  | 'HELP_ME_FIX_IT'
  | 'BALANCED'
  | 'CRISIS_RECOVERY'
  | 'DLR_LORE_STATS'
  | 'TIMETABLE_MASTERY';
export type ObservePace = 'RELAXED' | 'NORMAL' | 'BRISK';
export type AutopilotRegime = 'BUSY PEAK WAVE' | 'ACTIVE RECOVERY' | 'SLACK WATCH';

export interface ObserveCallout {
  title: string;
  tag:
    | 'CONTROLLER LOGIC'
    | 'DLR REAL-WORLD FACT'
    | 'LIVE TELEMETRY'
    | 'SIGNALLING MOVE'
    | 'CONTROLLER PRO-TIP'
    | 'WATCHPOINT AUDIT';
  rationale: string;
  statHighlight: string;
  worldX: number;
  worldY: number;
  actionSummary?: string;
}

const DLR_LORE_FACTS: {
  stationId: string;
  title: string;
  fact: string;
  stat: string;
}[] = [
  {
    stationId: 'WIQ',
    title: 'Why Bank-Bound Trains Cannot Stop at West India Quay (SOP-WIQ)',
    fact: 'Notice that cyan dashed bypass track to the left of West India Quay? To eliminate flat-junction conflicts across the Delta, northbound trains from Canary Wharf towards Bank take a grade-separated dive-under bypass (DLT_BYP_UP) that physically has NO platform at West India Quay!',
    stat: '4 Tracks · 3 Platform Faces · Westbound CAW→WFE Bypass Skips WIQ',
  },
  {
    stationId: 'STI',
    title: 'Stratford International & Stratford Regional Dual-Level Complex',
    fact: 'Up north in the Olympic Complex, 5xx trains launch from the Stratford International HS1 box (STI), thread through the Low-Level through platforms (P16/P17) at Stratford Regional (STR), and pass Stratford Market Junction, while 4xx Lewisham services reverse in Stratford’s High-Level Bays (P4A/P4B).',
    stat: 'Dual-Level Olympic Hub · STI Tail Siding + STR P4A/B & P16/17',
  },
  {
    stationId: 'WOO',
    title: 'Woolwich Arsenal — 50 mph Sub-Aqueous Bore Under the Thames',
    fact: 'Between King George V on the north bank and Woolwich Arsenal on the south bank, trains dive through a 1.55 km twin-bore tunnel beneath the River Thames at 50 mph — the fastest section on the DLR, governed by SOP-UG1 (1 train per bore).',
    stat: '1.55 km Thames Tunnel · 50 mph Top Speed · Sub-Surface P3/P4 Box',
  },
  {
    stationId: 'TWG',
    title: 'Why Tower Gateway Is Strictly 2-Car Restricted (SOP-TWG)',
    fact: 'Notice how our 3xx Beckton trains are 2-car sets? Tower Gateway sits on a tight brick viaduct right next to Fenchurch Street and cannot fit a 3-car (90m) train. If a 3-car set approaches, Royal Mint St interlocking blocks it and diverts it to Shadwell!',
    stat: 'Max Platform Length: 60m (2-Car B92/B07 Stock)',
  },
  {
    stationId: 'CUT',
    title: 'Cutty Sark & Selective Door Operation (SDO)',
    fact: 'Under the Thames at Cutty Sark, the underground cavern could only be excavated to 2-car length because of historic Greenwich building foundations above. 3-car trains stop here using SDO (front & rear end doors stay locked), adding +6s to dwell times.',
    stat: 'Sub-Aqueous Bore · +6s Selective Door Dwell Penalty',
  },
  {
    stationId: 'CAW',
    title: 'Canary Wharf 3-Track, 6-Platform Megahub',
    fact: 'Canary Wharf has three tracks and six platform faces under its elliptical glass roof. During a Greenwich tunnel block, we use the center road (CAW_MID, Plan A) to reverse Lewisham trains without delaying Stratford services.',
    stat: 'Busiest DLR Hub · 6 Platform Faces (Dual-Side Spanish Solution)',
  },
  {
    stationId: 'LCA',
    title: 'London City Airport Viaduct & Jet Blast Protection',
    fact: 'Out on the Woolwich branch, the viaduct runs parallel to London City Airport’s steep-approach runway with acoustic and jet-blast screens. When a wave of regional jets lands, passenger inflows spike +65% within 4 minutes.',
    stat: 'Opened Dec 2005 · Direct Turnback Crossover West of Platform',
  },
  {
    stationId: 'BNK',
    title: 'Bank Deep-Level Headshunt & Why Original P86 Trains Left London',
    fact: 'When the deep-tube Bank extension opened in 1991, the original 1987 P86 DLR trains lacked underground fire-proof doors and had to be sold to Essen, Germany! Today, trains dive down a 1-in-20 gradient and reverse in a single-bore tail headshunt (BNK_HSH) under King William Street.',
    stat: '1-in-20 (5%) Gradient · 41m Deep Tube Headshunt Reversal',
  },
  {
    stationId: 'CYP',
    title: 'Fun Fact: Why Cyprus Station Dips Into a Steep Cutting',
    fact: 'Ever wonder why the Beckton branch suddenly dives into a deep cutting at Cyprus (CYP) while the rest of the line is on a viaduct? It was built below road level so tall-masted ships could sail over the railway into the Royal Albert Dock basin!',
    stat: 'Sub-Road Cutting · Royal Docks Loop Inflection Point',
  },
  {
    stationId: 'PML',
    title: 'Pudding Mill Lane — Rebuilt for Crossrail & Olympic Crowds',
    fact: 'The original single-track Pudding Mill Lane station stood right where the Elizabeth Line tunnel portal now emerges! In 2014, it was completely rebuilt on a new twin-track viaduct with an Olympic turnback pocket (PML_REV) for stadium events.',
    stat: 'Rebuilt 2014 · Queen Elizabeth Olympic Park & ABBA Arena Hub',
  },
  {
    stationId: 'ISG',
    title: 'Island Gardens — From Elevated Terminus to Underground Bore',
    fact: 'From 1987 to 1999, Island Gardens was an elevated terminus perched on the old Millwall Extension Railway viaduct overlooking Greenwich. To tunnel under the Thames to Lewisham, the station had to be demolished and rebuilt underground!',
    stat: 'Northern Portal of Greenwich Thames Bore · Turnback Crossover',
  },
  {
    stationId: 'CNT',
    title: 'Canning Town Stacked Double-Deck Viaduct',
    fact: 'Canning Town splits the eastern network into the Royal Docks (Beckton) and Silvertown (Woolwich Arsenal) branches using a stacked two-level flyover alongside the Lea Valley line so eastbound and westbound departures never conflict.',
    stat: '4-Branch Eastern Throat · Jubilee Line Interchange',
  },
  {
    stationId: 'BDP',
    title: 'Beckton Depot vs. Poplar Depot Stock Allocation',
    fact: 'Beckton Depot is our heaviest maintenance yard (holding over 100 articulated cars across 4 ladder roads with a wheel lathe and wash loop), while Poplar Depot sits right beside the Control Centre for rapid peak-hour positioning runs (9xx headcodes).',
    stat: 'Fleet: 149× B92/B07 + New 54× B23 Walk-Through Trains',
  },
];

const CONTROLLER_PRO_TIPS: {
  stationId: string;
  nodeId?: string;
  title: string;
  tip: string;
  stat: string;
}[] = [
  {
    stationId: 'POP',
    nodeId: 'PDP_S1',
    title: 'Pro-Tip: Routing Trains Directly Into Individual Depot Roads',
    tip: 'Want to stable or turn a train off the main line? Click any train pill to open the Unit Inspector, then use the DIVERT dropdown’s "Depot Stabling Roads & Turnback Pockets" group to route it straight into PDP Rd 1–3, BDP Rd 1–4, or CAW Center Road!',
    stat: 'Shortcut: Click Train → Select Road in DIVERT Dropdown',
  },
  {
    stationId: 'CAW',
    nodeId: 'CAW_MID',
    title: 'Pro-Tip: Setting Manual White NX Interlocking Routes',
    tip: 'While Automatic Route Setting (ARS) handles routine traffic, you can override any junction like a real IECC signaller: click an Entry signal lamp first, then click the destination Exit signal lamp to lock a SimSig-style white route across the points.',
    stat: 'Click Entry Signal → Click Exit Signal · [ESC] to Cancel',
  },
  {
    stationId: 'WFE',
    title: 'Pro-Tip: Regulating Junction Bunches with Shift+Click Signal Holds',
    tip: 'If two trains approach Westferry or Poplar neck-and-neck, Shift+Click one platform’s signal lamp to hold it at RED for 10–15 seconds. Spacing their departure prevents moving-block braking ripples across the Delta!',
    stat: 'Shift+Click Signal Lamp = Toggle Manual RED Hold',
  },
  {
    stationId: 'SHA',
    title: 'Pro-Tip: Pre-Emptive Short-Turning Saves Network PPM %',
    tip: 'Because PPM measures arrivals within 120s of schedule, letting a +110s delayed train crawl all the way to its terminus ruins its return working too. Press [Key R] with a late train selected to short-turn it early at the nearest crossover!',
    stat: 'Hotkey [R] = Short-Turn Selected Train at Next Crossover',
  },
  {
    stationId: 'CUH',
    nodeId: 'CUH_SID',
    title: 'Pro-Tip: Dual-Monitor Deep Telemetry Desk [Key M]',
    tip: 'Have a second screen or want to nerd out on full-fleet block occupancy tables? Press [Key M] (or click 🖥️ 2ND MONITOR DESK) to pop out the 4-Quadrant Telemetry Desk while expanding this window into a 100% full-screen Track Schematic Wall!',
    stat: 'Hotkey [M] = Pop Out 2nd Monitor Desk / Full-Screen Map Wall',
  },
  {
    stationId: 'ELV',
    title: 'Pro-Tip: Watch the 2-Car SDO Pinch Point at Elverson Road',
    tip: 'Elverson Road (60m platform) sits just one block north of Lewisham terminus. Every 3-car train pauses an extra +6s here for Selective Door Operation (SDO)—so keep Lewisham’s scissor crossover clear to avoid stacking queues back to Greenwich.',
    stat: '60m Platform · +6s SDO Penalty Right Before Lewisham Throat',
  },
];

const WATCHPOINT_AUDITS: {
  stationId: string;
  nodeId?: string;
  title: string;
  checkType: 'BORE_UG1' | 'WIQ_BYPASS' | 'RMJ_SPLIT' | 'OLYMPIC_ARCH' | 'DEPOT_LADDERS' | 'CAW_TURNBACK';
}[] = [
  {
    stationId: 'WOO',
    title: 'Watchpoint Audit: Sub-Aqueous Tunnel Bores (SOP-UG1)',
    checkType: 'BORE_UG1',
  },
  {
    stationId: 'WIQ',
    nodeId: 'DLT_BYP_UP',
    title: 'Watchpoint Audit: West India Quay & Westbound Bypass (SOP-WIQ)',
    checkType: 'WIQ_BYPASS',
  },
  {
    stationId: 'SHA',
    nodeId: 'RMJ_UP',
    title: 'Watchpoint Audit: Royal Mint St Split & Tower Gateway 2C Throat',
    checkType: 'RMJ_SPLIT',
  },
  {
    stationId: 'STR',
    title: 'Watchpoint Audit: Stratford Olympic Arch (P4A/B Bays vs P16/17)',
    checkType: 'OLYMPIC_ARCH',
  },
  {
    stationId: 'BDP',
    title: 'Watchpoint Audit: Beckton & Poplar Multi-Road Depot Ladders',
    checkType: 'DEPOT_LADDERS',
  },
  {
    stationId: 'CAW',
    nodeId: 'CAW_MID',
    title: 'Watchpoint Audit: Canary Wharf 3-Track Hub & Isle of Dogs Spine',
    checkType: 'CAW_TURNBACK',
  },
];

export class ObserveController {
  private sim: DLRSimulation;
  private schematic: SchematicCanvas;

  public active: boolean = false;
  public focus: ObserveFocus = 'FULL_AUTOPILOT';
  public pace: ObservePace = 'NORMAL';
  public currentCallout: ObserveCallout | null = null;
  public actionsTakenCount: number = 0;

  private stepTimerSeconds: number = 0;
  private quietBeatCounter: number = 0;
  private slackBeatsSinceWave: number = 0;
  private autopilotBusyCycleCount: number = 0;
  private autopilotIsBusyWave: boolean = false;
  private loreIndex: number = 0;
  private tipIndex: number = 0;
  private watchpointIndex: number = 0;
  private lastSpotlightTrainId: string = '';
  private savedTimeScale: number = 1;

  public onUpdateUI?: () => void;

  constructor(sim: DLRSimulation, schematic: SchematicCanvas) {
    this.sim = sim;
    this.schematic = schematic;
  }

  public getStepInterval(): number {
    if (this.pace === 'RELAXED') return 22.0;
    if (this.pace === 'BRISK') return 10.0;
    return 16.0;
  }

  public getRemainingSeconds(): number {
    return Math.max(0, this.getStepInterval() - this.stepTimerSeconds);
  }

  public getRemainingPercentage(): number {
    const interval = this.getStepInterval();
    if (interval <= 0) return 100;
    return Math.max(0, Math.min(100, Math.round(((interval - this.stepTimerSeconds) / interval) * 100)));
  }

  public toggle(enable?: boolean) {
    const nextState = enable !== undefined ? enable : !this.active;
    if (nextState === this.active) return;
    this.active = nextState;

    if (this.active) {
      this.savedTimeScale = this.sim.timeScale;
      if (this.sim.timeScale === 0 || this.sim.timeScale > 4) {
        this.sim.timeScale = 1;
      }
      this.stepTimerSeconds = 0;
      soundEngine.playSplitFlap(6);
      this.sim.addLog('ARS', 'MASTER CONTROLLER CO-PILOT: Observe Mode engaged — explaining decisions live.');
      this.executeNextControllerStep();
    } else {
      this.currentCallout = null;
      soundEngine.playRelayClick(false);
      this.sim.addLog('ARS', 'MASTER CONTROLLER CO-PILOT: You have taken back the wheel.');
    }

    this.onUpdateUI?.();
  }

  public getAutopilotRegime(): AutopilotRegime {
    const hasOpenIncidents = this.sim.incidents.some((i) => !i.resolved);
    const hasBrokenTrain = this.sim.trains.some((t) => t.state === 'BROKEN_DOWN');
    if (hasOpenIncidents || hasBrokenTrain) return 'ACTIVE RECOVERY';
    if (this.autopilotIsBusyWave) return 'BUSY PEAK WAVE';
    return 'SLACK WATCH';
  }

  public engageFullAutopilot() {
    this.focus = 'FULL_AUTOPILOT';
    this.slackBeatsSinceWave = 0;
    if (!this.active) {
      this.active = true;
    }
    if (this.sim.timeScale === 0) {
      this.sim.timeScale = 1;
    }
    this.stepTimerSeconds = 0;
    soundEngine.playSplitFlap(6);
    this.sim.addLog('ARS', 'FULL AUTO-PILOT ENGAGED: Autonomous Sit-Back Shift Watch cycling Busy Waves & Slack Tours.');
    this.executeNextControllerStep();
  }

  public engageHelpMeFixIt(fixAllImmediately = false) {
    this.focus = 'HELP_ME_FIX_IT';
    if (!this.active) {
      this.active = true;
      if (this.sim.timeScale === 0 || this.sim.timeScale > 4) {
        this.sim.timeScale = 1;
      }
    }
    this.stepTimerSeconds = 0;

    if (fixAllImmediately) {
      const res = this.sim.stabilizeNetworkAll();
      const metrics = this.sim.getPerformanceMetrics();
      const pop = STATION_MAP['POP'] || { x: 1220, y: 840 };
      this.currentCallout = {
        title: `🆘 Help Me! Fix It! — Network Stabilised (${res.fixedCount} Fixed)`,
        tag: 'CONTROLLER LOGIC',
        rationale: `${res.summary} I have switched my focus to pure "Help Me! Fix It!" mode: I will actively watch all 7 branches, audit choke points, dispatch PSAs, and share controller tips & facts between incidents without injecting any surprise faults.`,
        statHighlight: `All Active Blocks Cleared · Network PPM: ${metrics.ppm}% · Active Fleet: ${metrics.activeTrainCount}`,
        worldX: pop.x,
        worldY: pop.y,
      };
      this.schematic.focusCoordinates(pop.x, pop.y, 0.92);
      this.onUpdateUI?.();
      return;
    }

    this.executeNextControllerStep();
  }

  public tick(dtRealSeconds: number) {
    if (!this.active) return;
    this.stepTimerSeconds += dtRealSeconds;
    if (this.stepTimerSeconds >= this.getStepInterval()) {
      this.stepTimerSeconds = 0;
      this.executeNextControllerStep();
    }
  }

  public forceNextStep() {
    if (!this.active) return;
    this.stepTimerSeconds = 0;
    this.executeNextControllerStep();
  }

  private executeNextControllerStep() {
    const unresolved = this.sim.incidents.filter((i) => !i.resolved);
    const brokenTrains = this.sim.trains.filter((t) => t.state === 'BROKEN_DOWN');
    const heldSignals = this.sim.nodes.filter((n) => n.signalHeld);
    const heavyDelayedTrains = this.sim.trains.filter(
      (t) => t.delaySeconds > 85 && !t.diverted && t.state !== 'BROKEN_DOWN'
    );

    // 1. PRIORITY A: Resolve an active blocking incident or stalled VOBC train
    if (unresolved.length > 0 && (this.focus !== 'DLR_LORE_STATS' || Math.random() < 0.6)) {
      const inc = unresolved[0];
      const act = inc.actions[0];

      let wx = 1220;
      let wy = 840;
      if (inc.stationId && STATION_MAP[inc.stationId]) {
        const st = STATION_MAP[inc.stationId];
        wx = st.x;
        wy = st.y;
        this.schematic.selectedStation = st;
      } else if (inc.nodeId && this.sim.nodeMap[inc.nodeId]) {
        const n = this.sim.nodeMap[inc.nodeId];
        wx = n.x;
        wy = n.y;
        if (n.stationId && STATION_MAP[n.stationId]) {
          this.schematic.selectedStation = STATION_MAP[n.stationId];
        }
      }
      if (inc.trainId) {
        const tr = this.sim.trains.find((t) => t.id === inc.trainId);
        if (tr) {
          const pos = this.schematic.getTrainWorldCoords(tr);
          wx = pos.x;
          wy = pos.y;
          this.schematic.selectedTrain = tr;
        }
      }

      this.schematic.focusCoordinates(wx, wy, 1.05);

      let rationale = `We have a ${inc.severity.toLowerCase()} bottleneck: "${inc.title}". `;
      if (act?.effectType === 'DISPATCH_PSA') {
        rationale +=
          'In SelTrac CBTC, when a train loses VOBC moving-block comms, its failsafe brakes lock on. I am keying in the onboard Passenger Service Agent (PSA) to drive manually at 18 mph to clear the section.';
      } else if (act?.effectType === 'ACTIVATE_CONTINGENCY') {
        rationale +=
          'Rather than letting 6 trains stack up behind a fouled section, I am activating our branch turnback contingency plan so approaching services reverse early at the crossover.';
      } else if (act?.effectType === 'BOOST_SERVICE') {
        rationale +=
          'Platform dwell times are ballooning from crowd pressure. I am slotting an immediate 3-car relief shuttle into the timetable headway to drain the platform.';
      } else {
        rationale +=
          'I am dispatching field response staff to clear the interlock latch and restore normal SelTrac automatic supervision.';
      }

      if (act) {
        this.sim.executeIncidentAction(inc.id, act.id);
        this.actionsTakenCount++;
      }

      const metrics = this.sim.getPerformanceMetrics();
      this.currentCallout = {
        title: `🆘 Fixing: ${inc.title}`,
        tag: 'CONTROLLER LOGIC',
        rationale,
        statHighlight: `Action: ${act ? act.label : 'Cleared'} · Network PPM: ${metrics.ppm}%`,
        worldX: wx,
        worldY: wy,
        actionSummary: act?.label,
      };

      this.onUpdateUI?.();
      return;
    }

    // 1b. If any train is still BROKEN_DOWN without an open incident, dispatch a PSA immediately
    if (brokenTrains.length > 0 && this.focus !== 'DLR_LORE_STATS') {
      const tr = brokenTrains[0];
      const pos = this.schematic.getTrainWorldCoords(tr);
      this.schematic.selectedTrain = tr;
      this.schematic.focusCoordinates(pos.x, pos.y, 1.1);
      this.sim.dispatchPsaToTrain(tr.id);
      this.actionsTakenCount++;

      this.currentCallout = {
        title: `Recovering Stalled Unit ${tr.headcode} via PSA Key-In`,
        tag: 'CONTROLLER LOGIC',
        rationale: `Unit ${tr.headcode} was sitting stalled with a VOBC brake drop-out. I have dispatched the onboard PSA to manual-drive at 18 mph so the queue behind it can clear.`,
        statHighlight: `PSA 18 mph Recovery Active · Cleared Block at ${tr.currentNodeId}`,
        worldX: pos.x,
        worldY: pos.y,
        actionSummary: `PSA → ${tr.headcode}`,
      };
      this.onUpdateUI?.();
      return;
    }

    // 1c. In HELP_ME_FIX_IT mode, release any forgotten manual red signal holds that are delaying traffic
    if (this.focus === 'HELP_ME_FIX_IT' && heldSignals.length > 0) {
      const sig = heldSignals[0];
      this.sim.toggleSignalHold(sig.id);
      this.actionsTakenCount++;
      this.schematic.focusCoordinates(sig.x, sig.y, 1.08);

      this.currentCallout = {
        title: `Releasing Held Signal ${sig.id} (${sig.name})`,
        tag: 'SIGNALLING MOVE',
        rationale: `Signal ${sig.id} was manually held at RED, holding up approaching services. I have released it back to SelTrac automatic moving-block supervision.`,
        statHighlight: `Restored Green Aspect at ${sig.id}`,
        worldX: sig.x,
        worldY: sig.y,
        actionSummary: `Released ${sig.id}`,
      };
      this.onUpdateUI?.();
      return;
    }

    // 2. PRIORITY B: If a train is heavily delayed (>85s), short-turn or regulate it
    if (heavyDelayedTrains.length > 0 && this.focus !== 'DLR_LORE_STATS') {
      const tr = heavyDelayedTrains[0];
      const pos = this.schematic.getTrainWorldCoords(tr);
      this.schematic.selectedTrain = tr;
      this.schematic.focusCoordinates(pos.x, pos.y, 1.1);

      const intermediateTurnback = tr.routeQueue
        .slice(0, -1)
        .find((stId) => STATION_MAP[stId]?.hasTurnback);

      if (intermediateTurnback) {
        const oldDestName = STATION_MAP[tr.destCode]?.name || tr.destCode;
        const newDestName = STATION_MAP[intermediateTurnback]?.name || intermediateTurnback;
        this.sim.rerouteTrainToDestination(
          tr,
          intermediateTurnback === 'CAW' ? 'CAW_MID' : intermediateTurnback
        );
        this.actionsTakenCount++;

        this.currentCallout = {
          title: `Short-Turning Late Unit ${tr.serviceNumber} at ${newDestName}`,
          tag: 'SIGNALLING MOVE',
          rationale: `Unit ${tr.serviceNumber} (bound for ${oldDestName}) is running +${Math.round(
            tr.delaySeconds
          )}s late and bunching the headway behind it. A classic UK controller move is to short-turn it at ${newDestName}'s turnback road so it re-enters the return working on time.`,
          statHighlight: `Saved ~${Math.round(tr.delaySeconds * 0.7)}s Turnaround Delay · Load: ${tr.passengers} pax`,
          worldX: pos.x,
          worldY: pos.y,
          actionSummary: `Diverted ${tr.serviceNumber} → ${intermediateTurnback}`,
        };
        this.onUpdateUI?.();
        return;
      }
    }

    // 3. PRIORITY C: Busy vs Slack Regime Orchestration
    //    - In FULL_AUTOPILOT, alternate smoothly between Slack Watch spells (5-mode tours) and periodic Busy Waves / realistic incidents
    //    - NEVER inject faults in HELP_ME_FIX_IT!
    if (this.focus === 'FULL_AUTOPILOT' && unresolved.length === 0 && brokenTrains.length === 0) {
      this.slackBeatsSinceWave++;

      // Transition from Busy Wave back into peaceful Slack Watch after lingering crowd surges / extra shuttles settle
      if (this.autopilotIsBusyWave && this.slackBeatsSinceWave >= 4) {
        this.autopilotIsBusyWave = false;
        this.slackBeatsSinceWave = 0;
        for (const st of this.sim.stations) {
          this.sim.stationCrowdMultiplier[st.id] = 1.0;
        }
        // Reset base headways gently to balanced daytime cruise
        for (const tpl of this.sim.templates) {
          if (!tpl.isException && tpl.intervalMins < 5) {
            tpl.intervalMins = 6;
          }
        }
        const pop = STATION_MAP['POP'] || { x: 1220, y: 840 };
        this.schematic.focusCoordinates(pop.x, pop.y, 0.88);
        this.currentCallout = {
          title: 'Slack Period Transition — Inter-Peak Headway Cruise',
          tag: 'CONTROLLER LOGIC',
          rationale:
            'Station inflows have normalised after that peak wave. I am relaxing timetable headways back to steady off-peak cruise so trains recover margin at termini while we tour live branch telemetry.',
          statHighlight: `Regime: SLACK WATCH · Network PPM: ${this.sim.getPerformanceMetrics().ppm}% · Fleet: ${this.sim.trains.length}`,
          worldX: pop.x,
          worldY: pop.y,
          actionSummary: 'Entered Slack Cruise',
        };
        this.onUpdateUI?.();
        return;
      }

      // Trigger a fresh Busy Wave every 6 slack beats so there's an authentic ebb & flow while sitting back
      if (!this.autopilotIsBusyWave && this.slackBeatsSinceWave >= 6) {
        this.autopilotIsBusyWave = true;
        this.slackBeatsSinceWave = 0;
        this.autopilotBusyCycleCount++;

        const waveMode = this.autopilotBusyCycleCount % 3;
        if (waveMode === 1 && this.sim.templates.length < 9) {
          // Commuter / Airport Surge + Extra Shuttle
          const surgeKey = this.autopilotBusyCycleCount % 2 === 1 ? 'BANKING_CAW' : 'EXCEL_CUH';
          this.sim.stationCrowdMultiplier['CAW'] = 1.45;
          this.sim.stationCrowdMultiplier['LCA'] = 1.5;
          this.sim.injectSpecialExceptionService(surgeKey);
          const hubId = surgeKey === 'BANKING_CAW' ? 'CAW' : 'CUH';
          const st = STATION_MAP[hubId];
          if (st) {
            this.schematic.selectedStation = st;
            this.schematic.focusCoordinates(st.x, st.y, 1.0);
          }
          this.currentCallout = {
            title: `Busy Wave Incoming: ${surgeKey === 'BANKING_CAW' ? 'Canary Wharf Banking Surge' : 'ExCeL & Airport Wave'}`,
            tag: 'LIVE TELEMETRY',
            rationale:
              'Passenger inflows are picking up across the eastern & central hubs. I have automatically slotted a relief shuttle and raised peak monitoring—watch the Piano Roll and Health Overwatch track the demand wave.',
            statHighlight: `Regime: BUSY PEAK WAVE · Crowd Inflow 1.5× · Active Fleet: ${this.sim.trains.length}`,
            worldX: st ? st.x : 1220,
            worldY: st ? st.y : 840,
            actionSummary: `Launched ${surgeKey} Peak Wave`,
          };
          this.onUpdateUI?.();
          return;
        } else {
          // Realistic operational disruption for the Co-Pilot to diagnose and clear cleanly on the next beat!
          this.sim.triggerScopedDisruption('ALL');
          const newInc = this.sim.incidents.find((i) => !i.resolved);
          if (newInc) {
            let wx = 1220;
            let wy = 840;
            if (newInc.stationId && STATION_MAP[newInc.stationId]) {
              wx = STATION_MAP[newInc.stationId].x;
              wy = STATION_MAP[newInc.stationId].y;
            } else if (newInc.nodeId && this.sim.nodeMap[newInc.nodeId]) {
              wx = this.sim.nodeMap[newInc.nodeId].x;
              wy = this.sim.nodeMap[newInc.nodeId].y;
            }
            this.schematic.focusCoordinates(wx, wy, 1.04);
            this.currentCallout = {
              title: `Auto-Pilot Busy Event: ${newInc.title}`,
              tag: 'LIVE TELEMETRY',
              rationale: `A live disruption just developed at ${
                newInc.stationId || newInc.nodeId || 'junction'
              }. Notice how adjacent branches shift to Amber/Red on the Health Overwatch Map—on my next 16s beat I will step in and resolve it automatically.`,
              statHighlight: `Regime: ACTIVE RECOVERY · Severity: ${newInc.severity}`,
              worldX: wx,
              worldY: wy,
            };
            this.onUpdateUI?.();
            return;
          }
        }
      }
    }

    if (
      (this.focus === 'CRISIS_RECOVERY' || (this.focus === 'BALANCED' && Math.random() < 0.18)) &&
      unresolved.length === 0 &&
      brokenTrains.length === 0
    ) {
      this.sim.triggerScopedDisruption('ALL');
      const newInc = this.sim.incidents.find((i) => !i.resolved);
      if (newInc) {
        let wx = 1220;
        let wy = 840;
        if (newInc.stationId && STATION_MAP[newInc.stationId]) {
          wx = STATION_MAP[newInc.stationId].x;
          wy = STATION_MAP[newInc.stationId].y;
        } else if (newInc.nodeId && this.sim.nodeMap[newInc.nodeId]) {
          wx = this.sim.nodeMap[newInc.nodeId].x;
          wy = this.sim.nodeMap[newInc.nodeId].y;
        }
        this.schematic.focusCoordinates(wx, wy, 1.05);

        this.currentCallout = {
          title: `Live Fault Detected: ${newInc.title}`,
          tag: 'LIVE TELEMETRY',
          rationale: `Hold on — SelTrac just raised an alarm at ${
            newInc.stationId || newInc.nodeId || 'junction'
          }. Watch how the red occupied track blocks propagate behind it. On my next beat, I will show you how to isolate and recover this cleanly.`,
          statHighlight: `Severity: ${newInc.severity} · Evaluating Turnback & PSA Options`,
          worldX: wx,
          worldY: wy,
        };
        this.onUpdateUI?.();
        return;
      }
    }

    // 4. PRIORITY D: Stand down unneeded contingency plans when clear, or inject peak boosters in TIMETABLE_MASTERY
    const activePlans = this.sim.contingencies.filter((c) => c.active);
    if (activePlans.length > 0 && unresolved.length === 0) {
      const plan = activePlans[0];
      this.sim.toggleContingencyPlan(plan.id);
      this.actionsTakenCount++;
      const pop = STATION_MAP['POP'] || { x: 1220, y: 840 };

      this.currentCallout = {
        title: `Standing Down ${plan.shortCode} — Restoring Through Service`,
        tag: 'CONTROLLER LOGIC',
        rationale: `Now that the blockage on ${plan.affectedBranch} is clear, keeping ${plan.shortCode} active would starve the outer stations of trains. I am cancelling the short-turn rule so full end-to-end routing resumes.`,
        statHighlight: `Restored Normal ARS Timetable on ${plan.affectedBranch}`,
        worldX: pop.x,
        worldY: pop.y,
        actionSummary: `Cancelled ${plan.shortCode}`,
      };
      this.onUpdateUI?.();
      return;
    }

    if (this.focus === 'TIMETABLE_MASTERY' && this.sim.templates.length < 9 && Math.random() < 0.45) {
      const presets = [
        {
          key: 'BANKING_CAW',
          stId: 'CAW',
          title: 'Proactive Peak Boost: Canary Wharf Banking Shuttle',
          why: 'I am checking station footfall telemetry: Canary Wharf and Bank are our highest-demand interchanges. Inserting a 3-car Bank↔Canary Wharf P3 turnback shuttle (6xx series) absorbs the city commuter wave without clogging the single-bore Cutty Sark tunnel.',
        },
        {
          key: 'AIRSHOW',
          stId: 'LCA',
          title: 'Slotting Stratford ↔ City Airport Charter (7xx)',
          why: 'Stratford to London City Airport via Canning Town avoids the busy Westferry Delta entirely. Adding this 7xx service gives eastern passengers a direct airport link.',
        },
        {
          key: 'ECS_TRANSFER',
          stId: 'PDP',
          title: 'Positioning Empty Coaching Stock (9xx ECS)',
          why: 'Real DLR controllers constantly balance stock between Poplar Depot and Beckton Depot. Notice how this 9xx ECS run skips passenger dwell times (4s technical stop only) to thread cleanly between revenue trains.',
        },
      ];
      const pick = presets[this.actionsTakenCount % presets.length];
      this.sim.injectSpecialExceptionService(pick.key);
      this.actionsTakenCount++;
      const st = STATION_MAP[pick.stId];
      if (st) {
        this.schematic.selectedStation = st;
        this.schematic.focusCoordinates(st.x, st.y, 1.02);
      }

      this.currentCallout = {
        title: pick.title,
        tag: 'CONTROLLER LOGIC',
        rationale: pick.why,
        statHighlight: `Active Fleet: ${this.sim.trains.length} Trains · Dynamic Headway Balanced`,
        worldX: st ? st.x : 1220,
        worldY: st ? st.y : 840,
        actionSummary: `Injected ${pick.key} Timetable Exception`,
      };
      this.onUpdateUI?.();
      return;
    }

    // ============================================================================
    // 5. QUIET-PERIOD DISCOVERY & WATCH ROTATION (Flits smoothly between 5 distinct modes!)
    //    0: Live Watchpoint Audit (Choke Points, Tunnels, Bypass, Depots)
    //    1: DLR Engineering Fun Fact & Real-World Lore
    //    2: Diverse Live Train Unit Spotlight (Turnbacks, 2C Stock, ECS, Expresses)
    //    3: Controller Pro-Tip (NX Routes, Signal Holds, Dual-Monitor Desk, SDO)
    //    4: Network Footfall & Headway Pulse (Busiest vs Quietest Station Audit)
    // ============================================================================
    const slot = this.quietBeatCounter % 5;
    this.quietBeatCounter++;

    if (slot === 0) {
      this.runWatchpointAuditStep();
    } else if (slot === 1) {
      this.runLoreFactStep();
    } else if (slot === 2) {
      this.runDiverseTrainSpotlightStep();
    } else if (slot === 3) {
      this.runControllerProTipStep();
    } else {
      this.runNetworkFootfallPulseStep();
    }

    this.onUpdateUI?.();
  }

  private runWatchpointAuditStep() {
    const wp = WATCHPOINT_AUDITS[this.watchpointIndex % WATCHPOINT_AUDITS.length];
    this.watchpointIndex++;

    const st = STATION_MAP[wp.stationId];
    const node = wp.nodeId ? this.sim.nodeMap[wp.nodeId] : undefined;
    const wx = node ? node.x : st ? st.x : 1220;
    const wy = node ? node.y : st ? st.y : 840;

    if (st) {
      this.schematic.selectedStation = st;
    }
    this.schematic.focusCoordinates(wx, wy, 0.98);

    let rationale = '';
    let stat = '';

    if (wp.checkType === 'BORE_UG1') {
      const tunnelTrains = this.sim.trains.filter((t) => {
        const edge = t.currentEdgeId ? this.sim.edgeMap[t.currentEdgeId] : undefined;
        return edge?.isTunnel;
      });
      const sample = tunnelTrains[0];
      rationale = sample
        ? `During quieter spells, I always check our three sub-aqueous/deep tunnel bores (Bank 1:20 dive, Greenwich foot-tunnel bore, and Woolwich 50 mph bore). Right now Unit ${sample.headcode} is inside a tunnel section at ${Math.round(sample.speedMph)} mph—SOP-UG1 holds the portal behind it until it clears into the platform.`
        : `All three deep tunnel bores (Bank, Greenwich, and the 50 mph Woolwich Thames bore) are currently clear between portals. Under SOP-UG1, SelTrac automatically enforces a strict 1-train-per-bore fire-safety headway here.`;
      stat = `Active Trains in Deep Bores: ${tunnelTrains.length} · SOP-UG1 Interlocking Active`;
    } else if (wp.checkType === 'WIQ_BYPASS') {
      const bypTrain = this.sim.trains.find(
        (t) => t.currentNodeId === 'DLT_BYP_UP' || t.nextNodeId === 'DLT_BYP_UP'
      );
      rationale = bypTrain
        ? `Watch Unit ${bypTrain.headcode} curving along the cyan dashed CAW→WFE Bypass Track (DLT_BYP_UP) to the left of West India Quay! Because northbound Bank trains use this grade-separated dive-under to avoid crossing Poplar trains on the flat, they skip West India Quay completely.`
        : `Good time to monitor the West India Quay Delta: southbound trains from Bank and Stratford stop at WIQ Platforms 1–3, and northbound Stratford trains stop at P4, while Bank-bound trains curve left along the platformless CAW→WFE Bypass (DLT_BYP_UP).`;
      stat = `SOP-WIQ Active · 4-Track Asymmetric Delta Alignment`;
    } else if (wp.checkType === 'RMJ_SPLIT') {
      const twoCarUnits = this.sim.trains.filter((t) => t.cars === 2).length;
      rationale = `Royal Mint Street Junction (RMJ) is our western throat gatekeeper: it sends 3-car 1xx/2xx trains down the steep 1:20 bore into Bank (P9/P10) and filters 2-car 3xx sets onto the brick viaduct into Tower Gateway (60m max).`;
      stat = `Active 2-Car Units: ${twoCarUnits} · SOP-TWG 60m Lockout Armed`;
    } else if (wp.checkType === 'OLYMPIC_ARCH') {
      const strDeps = this.sim.getStationDepartures('STR');
      rationale = `Checking the Stratford Olympic Arch: 5xx trains from Stratford International (STI) drop vertically through Stratford Regional P16/P17 and turn east via Stratford Market Crossover (STR_MKT_JCT), while 4xx Lewisham services reverse in the P4A/P4B High-Level Bays (STR_BAY) on the west fork.`;
      stat = `Upcoming Stratford Departures: ${strDeps.length} · Dual-Spine Separation`;
    } else if (wp.checkType === 'DEPOT_LADDERS') {
      const depotTrains = this.sim.trains.filter((t) => {
        const n = this.sim.nodeMap[t.currentNodeId];
        return n?.type === 'depot' || t.isECS;
      });
      rationale = `Monitoring our multi-road depot ladders: Beckton Depot (BDP Rd 1–4) and Poplar Depot (PDP Rd 1–3) feed positioning stock onto the network via 15 mph reception leads. Keeping the depot throats clear ensures 9xx ECS runs never clip revenue headways.`;
      stat = `ECS / Depot-Stabled Units: ${depotTrains.length} · 7 Independent Depot Roads`;
    } else {
      const cawDeps = this.sim.getStationDepartures('CAW');
      rationale = `Canary Wharf (CAW) is the heartbeat of the South spine. Notice the center turnback road (CAW_MID) nestled between the UP and DN tracks—it lets us reverse Banking Summit shuttles or Plan A short-turns without delaying through Lewisham trains.`;
      stat = `Canary Wharf Queue: ${cawDeps.length} Due · 6 Platform Faces`;
    }

    this.currentCallout = {
      title: wp.title,
      tag: 'WATCHPOINT AUDIT',
      rationale,
      statHighlight: stat,
      worldX: wx,
      worldY: wy,
    };
  }

  private runLoreFactStep() {
    const item = DLR_LORE_FACTS[this.loreIndex % DLR_LORE_FACTS.length];
    this.loreIndex++;
    const st = STATION_MAP[item.stationId];
    const wx = st ? st.x : 1220;
    const wy = st ? st.y : 840;
    if (st) {
      this.schematic.selectedStation = st;
      this.schematic.focusCoordinates(wx, wy, 1.04);
    }
    const footfall = (this.sim.stationFootfall[item.stationId] || 0).toLocaleString();

    this.currentCallout = {
      title: item.title,
      tag: 'DLR REAL-WORLD FACT',
      rationale: item.fact,
      statHighlight: `${item.stat} · Station Footfall: ${footfall} pax`,
      worldX: wx,
      worldY: wy,
    };
  }

  private runControllerProTipStep() {
    const tip = CONTROLLER_PRO_TIPS[this.tipIndex % CONTROLLER_PRO_TIPS.length];
    this.tipIndex++;
    const st = STATION_MAP[tip.stationId];
    const node = tip.nodeId ? this.sim.nodeMap[tip.nodeId] : undefined;
    const wx = node ? node.x : st ? st.x : 1220;
    const wy = node ? node.y : st ? st.y : 840;

    if (st) {
      this.schematic.selectedStation = st;
    }
    this.schematic.focusCoordinates(wx, wy, 1.04);

    this.currentCallout = {
      title: tip.title,
      tag: 'CONTROLLER PRO-TIP',
      rationale: tip.tip,
      statHighlight: tip.stat,
      worldX: wx,
      worldY: wy,
    };
  }

  private runDiverseTrainSpotlightStep() {
    if (this.sim.trains.length === 0) {
      this.runLoreFactStep();
      return;
    }

    // Filter out the last spotlighted train so we always jump to a fresh unit!
    const candidates = this.sim.trains.filter((t) => t.id !== this.lastSpotlightTrainId);
    const pool = candidates.length > 0 ? candidates : this.sim.trains;

    // Prefer interesting states: TURNBACK in a headshunt, 2-car TWG unit, ECS unit, fast 50mph runner, or busy unit
    const picked =
      pool.find((t) => t.state === 'TURNBACK' || t.currentNodeId.includes('HSH') || t.currentNodeId === 'CAW_MID') ||
      pool.find((t) => t.cars === 2 && t.speedMph > 10) ||
      pool.find((t) => t.isECS) ||
      pool.sort((a, b) => b.speedMph - a.speedMph)[0];

    this.lastSpotlightTrainId = picked.id;
    const pos = this.schematic.getTrainWorldCoords(picked);
    this.schematic.selectedTrain = picked;
    this.schematic.focusCoordinates(pos.x, pos.y, 1.08);

    const currNode = this.sim.nodeMap[picked.currentNodeId];
    const destSt = STATION_MAP[picked.destCode]?.name || picked.destCode;
    const loadPct = Math.round((picked.passengers / picked.maxCapacity) * 100);

    let angleNote = '';
    if (picked.isECS) {
      angleNote = `Unit ${picked.headcode} is a non-passenger Empty Coaching Stock (ECS) positioning working bound for ${destSt}. Notice how it only pauses 4 seconds at platforms so it can thread between passenger services without slowing the line.`;
    } else if (picked.cars === 2) {
      angleNote = `Unit ${picked.headcode} is a 2-car (60m) set working the Tower Gateway ↔ Beckton diagram. Because it is 60m long, it is cleared to enter Tower Gateway's Minories throat (SOP-TWG) and never incurs the +6s SDO penalty at short platforms.`;
    } else if (picked.state === 'TURNBACK') {
      angleNote = `Unit ${picked.headcode} is currently executing an automated SelTrac turnback at ${currNode?.roadLabel || currNode?.name || picked.currentNodeId}, reversing its VOBC direction token for the return working to ${destSt}.`;
    } else {
      angleNote = `Tracking Unit ${picked.headcode} (${picked.cars}-Car B23) at ${currNode?.roadLabel || currNode?.name || picked.currentNodeId} heading for ${destSt}. That green bar ahead of its nose is its live SelTrac moving-block safe braking footprint.`;
    }

    this.currentCallout = {
      title: `Live Unit Spotlight: ${picked.headcode} → ${destSt} (${picked.state})`,
      tag: 'LIVE TELEMETRY',
      rationale: angleNote,
      statHighlight: `${picked.isECS ? 'ECS Empty Stock' : `Load: ${picked.passengers}/${picked.maxCapacity} pax (${loadPct}%)`} · Speed: ${Math.round(picked.speedMph)}/${picked.targetSpeedMph} mph`,
      worldX: pos.x,
      worldY: pos.y,
    };
  }

  private runNetworkFootfallPulseStep() {
    const metrics = this.sim.getPerformanceMetrics();
    const pickBusiest = this.quietBeatCounter % 2 === 0;
    const item = pickBusiest
      ? metrics.busiestStations[this.quietBeatCounter % Math.max(1, metrics.busiestStations.length)]
      : metrics.quietestStations[this.quietBeatCounter % Math.max(1, metrics.quietestStations.length)];

    if (!item) {
      this.runLoreFactStep();
      return;
    }

    const st = item.station;
    this.schematic.selectedStation = st;
    this.schematic.focusCoordinates(st.x, st.y, 1.04);

    const rationale = pickBusiest
      ? `Scanning our station footfall boards: ${st.name} (${st.code}) is one of today's highest-volume hubs with ${item.footfall.toLocaleString()} passenger movements. Keeping headways even through ${st.code} prevents platform dwell creep.`
      : `Contrasting our quietest stops: ${st.name} (${st.code}) has seen just ${item.footfall.toLocaleString()} passengers so far today. Short 13–14s dwells at quieter viaduct stops allow SelTrac ATO to claw back minor schedule delays.`;

    this.currentCallout = {
      title: `${pickBusiest ? 'High-Demand Hub Pulse' : 'Quiet Viaduct Station Check'}: ${st.code} · ${st.name}`,
      tag: 'LIVE TELEMETRY',
      rationale,
      statHighlight: `Footfall: ${item.footfall.toLocaleString()} pax · Network PPM: ${metrics.ppm}% · Active Fleet: ${metrics.activeTrainCount}`,
      worldX: st.x,
      worldY: st.y,
    };
  }
}
