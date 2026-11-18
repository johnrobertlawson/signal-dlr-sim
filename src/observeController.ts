import { DLRSimulation } from './simulation';
import { SchematicCanvas } from './schematicCanvas';
import { STATION_MAP } from './dlrData';
import { soundEngine } from './audio';

export type ObserveFocus =
  | 'HELP_ME_FIX_IT'
  | 'BALANCED'
  | 'CRISIS_RECOVERY'
  | 'DLR_LORE_STATS'
  | 'TIMETABLE_MASTERY';
export type ObservePace = 'RELAXED' | 'NORMAL' | 'BRISK';

export interface ObserveCallout {
  title: string;
  tag: 'CONTROLLER LOGIC' | 'DLR REAL-WORLD FACT' | 'LIVE TELEMETRY' | 'SIGNALLING MOVE';
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
    title: 'Poplar – West India Quay Grade-Separated Delta',
    fact: 'I always keep an eye on the Delta triangle here. Three double-track viaducts weave over and under each other so Bank↔Lewisham, Stratford↔Canary Wharf, and Bank↔Woolwich services never cross on the flat.',
    stat: '3 Flying Junctions · Max 25 mph Curve Speed',
  },
  {
    stationId: 'TWG',
    title: 'Why Tower Gateway Is Strictly 2-Car Restricted',
    fact: 'Notice how our 3xx Beckton trains are 2-car sets? Tower Gateway sits on a tight brick viaduct right next to Fenchurch Street and cannot fit a 3-car train. If a 3-car set approaches, ARS blocks it from entering!',
    stat: 'Max Platform Length: 60m (2-Car B92/B07 Stock)',
  },
  {
    stationId: 'CUT',
    title: 'Cutty Sark & Selective Door Operation (SDO)',
    fact: 'Under the Thames at Cutty Sark, the underground cavern could only be excavated to 2-car length because of historic Greenwich building foundations above. 3-car trains stop here using SDO (front & rear doors stay locked), adding +6s to dwell times.',
    stat: 'Sub-Aqueous Bore · +6s Selective Door Dwell Penalty',
  },
  {
    stationId: 'CAW',
    title: 'Canary Wharf 3-Platform Turnback Design',
    fact: 'Canary Wharf has three tracks and six platform faces under its glass roof. During a Greenwich tunnel block, we use the center road crossover (Plan A) to reverse Lewisham trains without delaying Stratford services.',
    stat: 'Busiest DLR Hub · 6 Platform Faces (Dual-Side Boarding)',
  },
  {
    stationId: 'LCA',
    title: 'London City Airport Viaduct & Jet Blast Clearance',
    fact: 'Out on the Woolwich branch, the viaduct runs parallel to London City Airport’s short-takeoff runway. When a wave of Embraer jets lands, passenger inflows spike +65% within 4 minutes.',
    stat: 'Opened Dec 2005 · Direct Turnback Crossover West of Platform',
  },
  {
    stationId: 'BNK',
    title: 'Bank Deep-Level Headshunt & Steep Gradient',
    fact: 'DLR platforms at Bank sit deep beneath the Central and Northern lines. Trains dive down a steep 1-in-20 gradient from Shadwell and reverse in a single-bore tail-track overrun tunnel behind the station.',
    stat: '1-in-20 (5%) Gradient · Deep Tube Headshunt Reversal',
  },
  {
    stationId: 'CNT',
    title: 'Canning Town Stacked Double-Deck Viaduct',
    fact: 'Canning Town splits the eastern network into the Royal Docks (Beckton) and Silvertown (Woolwich Arsenal) branches using a stacked two-level flyover so eastbound and westbound departures never conflict.',
    stat: '4-Branch Eastern Throat · Jubilee Line Interchange',
  },
  {
    stationId: 'BDP',
    title: 'Beckton Depot vs. Poplar Depot Stock Allocation',
    fact: 'Beckton Depot is our heaviest maintenance yard (holding over 100 articulated cars), while Poplar Depot sits right beside the Control Centre for rapid peak-hour positioning runs (9xx headcodes).',
    stat: 'Fleet: 149× B92/B07 + New 54× B23 Walk-Through Trains',
  },
];

export class ObserveController {
  private sim: DLRSimulation;
  private schematic: SchematicCanvas;

  public active: boolean = false;
  public focus: ObserveFocus = 'BALANCED';
  public pace: ObservePace = 'NORMAL';
  public currentCallout: ObserveCallout | null = null;
  public actionsTakenCount: number = 0;

  private stepTimerSeconds: number = 0;
  private loreIndex: number = 0;
  private savedTimeScale: number = 1;

  public onUpdateUI?: () => void;

  constructor(sim: DLRSimulation, schematic: SchematicCanvas) {
    this.sim = sim;
    this.schematic = schematic;
  }

  // 50% slower pace intervals so the user has ample time to read & follow every Co-Pilot move
  public getStepInterval(): number {
    if (this.pace === 'RELAXED') return 14.3;
    if (this.pace === 'BRISK') return 6.8;
    return 10.2;
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

  // Dedicated "Help Me! Fix It!" mode where the AI takes charge and fixes what needs fixing (never injects new faults)
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
      this.currentCallout = {
        title: `🆘 Help Me! Fix It! — Network Stabilised (${res.fixedCount} Fixed)`,
        tag: 'CONTROLLER LOGIC',
        rationale: `${res.summary} I have switched my focus to pure "Help Me! Fix It!" mode: I will actively watch all 7 branches, dispatch PSAs, and regulate headways without injecting any surprise disruptions.`,
        statHighlight: `All Active Blocks Cleared · Network PPM: ${metrics.ppm}% · Active Fleet: ${metrics.activeTrainCount}`,
        worldX: 810,
        worldY: 500,
      };
      this.schematic.focusCoordinates(810, 500, 1.05);
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

      // Pan camera to the incident location
      let wx = 810;
      let wy = 500;
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

      this.schematic.focusCoordinates(wx, wy, 1.18);

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
      this.schematic.focusCoordinates(pos.x, pos.y, 1.22);
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
      this.schematic.focusCoordinates(sig.x, sig.y, 1.2);

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
      this.schematic.focusCoordinates(pos.x, pos.y, 1.22);

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

    // 3. PRIORITY C: Only inject a demonstration disruption if focus is CRISIS_RECOVERY (or occasionally in BALANCED) — NEVER in HELP_ME_FIX_IT!
    if (
      (this.focus === 'CRISIS_RECOVERY' || (this.focus === 'BALANCED' && Math.random() < 0.25)) &&
      unresolved.length === 0 &&
      brokenTrains.length === 0
    ) {
      this.sim.triggerScopedDisruption('ALL');
      const newInc = this.sim.incidents.find((i) => !i.resolved);
      if (newInc) {
        let wx = 750;
        let wy = 500;
        if (newInc.stationId && STATION_MAP[newInc.stationId]) {
          wx = STATION_MAP[newInc.stationId].x;
          wy = STATION_MAP[newInc.stationId].y;
        } else if (newInc.nodeId && this.sim.nodeMap[newInc.nodeId]) {
          wx = this.sim.nodeMap[newInc.nodeId].x;
          wy = this.sim.nodeMap[newInc.nodeId].y;
        }
        this.schematic.focusCoordinates(wx, wy, 1.15);

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

    // 4. PRIORITY D: If focus is TIMETABLE_MASTERY (or occasionally in BALANCED), adjust or inject a high-demand charter/shuttle or turn off an unneeded contingency plan
    const activePlans = this.sim.contingencies.filter((c) => c.active);
    if (activePlans.length > 0 && unresolved.length === 0) {
      const plan = activePlans[0];
      this.sim.toggleContingencyPlan(plan.id);
      this.actionsTakenCount++;

      this.currentCallout = {
        title: `Standing Down ${plan.shortCode} — Restoring Through Service`,
        tag: 'CONTROLLER LOGIC',
        rationale: `Now that the blockage on ${plan.affectedBranch} is clear, keeping ${plan.shortCode} active would starve the outer stations of trains. I am cancelling the short-turn rule so full end-to-end routing resumes.`,
        statHighlight: `Restored Normal ARS Timetable on ${plan.affectedBranch}`,
        worldX: 720,
        worldY: 560,
        actionSummary: `Cancelled ${plan.shortCode}`,
      };
      this.onUpdateUI?.();
      return;
    }

    if (this.focus === 'TIMETABLE_MASTERY' && this.sim.templates.length < 9 && Math.random() < 0.55) {
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
        this.schematic.focusCoordinates(st.x, st.y, 1.12);
      }

      this.currentCallout = {
        title: pick.title,
        tag: 'CONTROLLER LOGIC',
        rationale: pick.why,
        statHighlight: `Active Fleet: ${this.sim.trains.length} Trains · Dynamic Headway Balanced`,
        worldX: st ? st.x : 750,
        worldY: st ? st.y : 500,
        actionSummary: `Injected ${pick.key} Timetable Exception`,
      };
      this.onUpdateUI?.();
      return;
    }

    // 5. DEFAULT / LORE & TELEMETRY TOUR: Highlight a real-world DLR engineering quirk or live busy train with rich data popup
    if (Math.random() < 0.45 && this.sim.trains.length > 0) {
      // Pick the most loaded train on the network
      const busiestTrain = [...this.sim.trains].sort((a, b) => b.passengers - a.passengers)[0];
      const pos = this.schematic.getTrainWorldCoords(busiestTrain);
      this.schematic.selectedTrain = busiestTrain;
      this.schematic.focusCoordinates(pos.x, pos.y, 1.2);
      const currNode = this.sim.nodeMap[busiestTrain.currentNodeId];
      const loadPct = Math.round((busiestTrain.passengers / busiestTrain.maxCapacity) * 100);

      this.currentCallout = {
        title: `Live Train Audit: Unit ${busiestTrain.headcode} (${loadPct}% Capacity)`,
        tag: 'LIVE TELEMETRY',
        rationale: `Look at Unit ${busiestTrain.headcode} near ${
          currNode?.name || busiestTrain.currentNodeId
        }. That green bar projecting ahead of its nose is its SelTrac CBTC "Safe Braking Footprint" — the exact distance it needs to stop if the moving block ahead shrinks. Because there are no fixed trackside colour-light signals on plain line, trains can safely tailgate within 150m at 35 mph.`,
        statHighlight: `Load: ${busiestTrain.passengers}/${busiestTrain.maxCapacity} pax (${busiestTrain.cars}-Car) · Speed: ${Math.round(
          busiestTrain.speedMph
        )} mph`,
        worldX: pos.x,
        worldY: pos.y,
      };
      this.onUpdateUI?.();
      return;
    }

    // Otherwise tour the next DLR Lore & Engineering hotspot
    const item = DLR_LORE_FACTS[this.loreIndex % DLR_LORE_FACTS.length];
    this.loreIndex++;
    const st = STATION_MAP[item.stationId];
    const wx = st ? st.x : 750;
    const wy = st ? st.y : 500;
    if (st) {
      this.schematic.selectedStation = st;
      this.schematic.focusCoordinates(wx, wy, 1.18);
    }
    const footfall = (this.sim.stationFootfall[item.stationId] || 0).toLocaleString();

    this.currentCallout = {
      title: item.title,
      tag: 'DLR REAL-WORLD FACT',
      rationale: item.fact,
      statHighlight: `${item.stat} · Today's Footfall: ${footfall} pax`,
      worldX: wx,
      worldY: wy,
    };
    this.onUpdateUI?.();
  }
}
