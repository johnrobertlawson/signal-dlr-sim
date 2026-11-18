import type { DLRSimulation } from './simulation';
import type { TrackEdge, Train } from './types';

export interface FixedCamera {
  name: string;
  edge: string;
  fraction: number;
  offset: number;
  x: number;
  height: number;
  yaw: number;
  pitch: number;
  street?: boolean;
  night?: boolean;
}

const tower: FixedCamera = {name:'Tower Gateway · Minories entrance',edge:'E_TWG_UP_TWG_THROAT',fraction:0,offset:-43,x:32,height:3.4,yaw:-0.86,pitch:0.01,street:true};
const victoria: FixedCamera = {name:'Royal Victoria · lift concourse',edge:'E_RVC_CUH_DN',fraction:0,offset:-45,x:34,height:5,yaw:-0.74,pitch:0.01,street:true};
const wharf: FixedCamera = {name:'Canary Wharf · platform',edge:'E_CAW_HER_DN',fraction:0,offset:-50,x:-10,height:4.2,yaw:0.47,pitch:-0.09};
const workshop: FixedCamera = {name:'Beckton · heavy overhaul road',edge:'E_BDP_W_LEAD_BDP_R3',fraction:0.94,offset:-38,x:-9,height:4.8,yaw:0.29,pitch:-0.08};
const portal: FixedCamera = {name:'Greenwich · tunnel mouth',edge:'E_GRE_CUT_UP',fraction:0,offset:-22,x:-6,height:4.6,yaw:0.21,pitch:-0.08};
const delta: FixedCamera = {name:'Poplar · Delta junction',edge:'E_POP_WIQ_DN',fraction:0,offset:36,x:-17,height:8,yaw:2.48,pitch:-0.16};
const northChord: FixedCamera = {...delta,name:'Westferry · north flyover',edge:'E_WFE_POP_DN'};
const skyline: FixedCamera = {name:'West India Quay · skyline',edge:'E_WIQ_CAW_DN',fraction:0.54,offset:-33,x:-8,height:5,yaw:0.7,pitch:0.27,night:true};
const runway: FixedCamera = {name:'London City · runway approach',edge:'',fraction:0,offset:0,x:0,height:0,yaw:0,pitch:0};

// A patrol returns to every kind of site. Sample alternative exits and choose
// the busier of the junction feeds once per visit, keeping the mount fixed.
const cableway: FixedCamera = {name:'Royal Docks · cableway',edge:'E_RVC_CUH_DN',fraction:0.26,offset:-36,x:3,height:6,yaw:0.76,pitch:0.12};
const patrol = [[tower,victoria],[wharf],[delta,northChord],[workshop],[portal],[runway,cableway],[skyline]];
export function nextCctv(sim: DLRSimulation, visit: number) {
  const hour = sim.simTimeSeconds/3600%24;
  let group = patrol[visit % patrol.length];
  if (group[0].night && hour>=7 && hour<19) {
    visit++;
    group = patrol[visit % patrol.length];
  }
  let camera = group[Math.floor(visit/patrol.length)%group.length];
  if (group[0]===delta) {
    let best = -1;
    for (const candidate of group) {
      const edge = sim.edgeMap[candidate.edge];
      const count = sim.trains.filter(t=>t.currentEdgeId===edge.id || (edge.oppositeEdgeId && t.currentEdgeId===edge.oppositeEdgeId) ||
        t.currentNodeId===edge.from || t.nextNodeId===edge.from).length;
      if (count>best) { best=count; camera=candidate; }
    }
  }
  return {camera, visit};
}

export function cameraAlignment(edge: TrackEdge, fraction: number) {
  return {currentNodeId:edge.from,nextNodeId:edge.to,currentEdgeId:edge.id,previousEdgeId:undefined,
    nodePath:[edge.from,edge.to],edgeProgress:fraction};
}

export function cameraTrains(sim: DLRSimulation, edge: TrackEdge, eye: number) {
  const trains: {unit: Train; nose: number; x: number; direction: number}[] = [];
  const length = Math.max(120,edge.lengthMeters);
  const opposite = sim.edgeMap[edge.oppositeEdgeId ?? ''];
  for (const unit of sim.trains) {
    const road = sim.edgeMap[unit.currentEdgeId ?? ''];
    let nose: number, direction = 1;
    if (road === edge) nose = unit.edgeProgress*length;
    else if (opposite && road === opposite) { nose = (1-unit.edgeProgress)*length; direction=-1; }
    else if (unit.currentNodeId===edge.from && !unit.edgeProgress) nose=0;
    else if (unit.currentNodeId===edge.to && !unit.edgeProgress) nose=length;
    else if (road?.to===edge.from) nose=(unit.edgeProgress-1)*Math.max(120,road.lengthMeters);
    else if (road?.from===edge.to) nose=length+unit.edgeProgress*Math.max(120,road.lengthMeters);
    else continue;
    if (Math.abs(nose-eye)<=190+unit.cars*30) trains.push({unit,nose,x:direction===1 ? 0 : 4.8,direction});
  }
  return trains.sort((a,b)=>Math.abs(b.nose-eye)-Math.abs(a.nose-eye));
}
