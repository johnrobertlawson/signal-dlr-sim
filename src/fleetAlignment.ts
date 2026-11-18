import type { DLRSimulation } from './simulation';
import type { TrackEdge, TrackNode, Train } from './types';
import { getEdgePolyline } from './trackGeometry';

type Position = { x: number; y: number };
// Scenic rail heights in metres above the local street datum. Shared node
// heights keep platforms level and neighbouring approaches joined.
const railHeights: Record<string, number> = {
  BNK: -11, TWG: 7, SHA: 7, LIM: 8, WFE: 9, POP: 6, BLW: 7, EIR: 9, CNT: 10,
  WIQ: 10, CAW: 7, HER: 9, SQY: 11, CRH: 7, MUD: 2, ISG: -5, CUT: -9,
  GRE: 1, DEP: 8, ELV: 2, LEW: 1, STI: -3, STR: 1, STR_BAY: 7, PML: 8,
  SHS: -2, ABB: 0, WHM: 1, STL: 2, RVC: 8, CUH: 3, PRR: 3,
  RAL: 6, WSV: 11, PDK: 13, LCA: 7, KGV: 2, WOO: -9, PDP: 1, BDP: 1,
  BOW: 5, DEV: 2, LAN: 3, ALL: 6, BKP: 2, CYP: 1, GAL: 5, BCK: 2,
  DLT_BYP_UP: 4,
};
function railHeight(node: TrackNode) {
  return railHeights[node.id] ?? railHeights[node.stationId ?? node.id.split('_')[0]] ?? 3;
}

type Section = Position & { start: number; end: number; dx: number; dy: number };
export type TrackPose = Position & { elevation: number; dx: number; dy: number };

function alignment(sim: DLRSimulation, edges: TrackEdge[], origin: Position, startDistance = 0, standingHeight = 0) {
  const sections: Section[] = [];
  const grades: { start: number; length: number; from: number; to: number; crest: number }[] = [];
  let { x, y } = origin;
  let end = startDistance;
  for (const edge of edges) {
    const from = railHeight(sim.nodeMap[edge.from]), to = railHeight(sim.nodeMap[edge.to]);
    const diveUnder = edge.from === 'DLT_BYP_UP' || edge.to === 'DLT_BYP_UP';
    const crest = edge.isTunnel ? -2.5 : diveUnder ? -1.2 : edge.isFlyover ? 3 : 0;
    grades.push({ start: end, length: Math.max(120, edge.lengthMeters), from, to, crest });
    const points = getEdgePolyline(sim.nodeMap[edge.from], sim.nodeMap[edge.to], edge);
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    const total = lengths.reduce((a, b) => a + b, 0);
    for (const [i, size] of lengths.entries()) {
      if (size < 0.001) continue;
      const dx = (points[i+1].x - points[i].x) / size;
      const dy = (points[i+1].y - points[i].y) / size;
      const metres = size / total * Math.max(120, edge.lengthMeters);
      sections.push({ x, y, start: end, end: end + metres, dx, dy });
      x += dx * metres;
      y += dy * metres;
      end += metres;
    }
  }
  if (!sections.length) sections.push({ ...origin, start: 0, end: Infinity, dx: 1, dy: 0 });
  function raw(distance: number) {
    const s = sections.find(segment => distance <= segment.end) ?? sections[sections.length-1];
    return { x: s.x + s.dx*(distance-s.start), y: s.y + s.dy*(distance-s.start) };
  }
  // Average the polyline across a short distance. At each corner this gives
  // a quadratic arc with the same tangent as the straight track at both ends.
  const radius = edges.some(edge => edge.isCrossover) ? 12 : 34;
  const corners = sections.slice(1).map((s,i) => ({
    at: s.start, dx: s.dx-sections[i].dx, dy: s.dy-sections[i].dy,
  })).filter(c => Math.abs(c.dx)+Math.abs(c.dy) > 0.001);
  const cache = new Map<number, TrackPose>();
  function at(distance: number): TrackPose {
    const previous = cache.get(distance);
    if (previous) return previous;
    // Sample either side of a schematic corner to round it into a running curve.
    const before = raw(distance-radius), center = raw(distance), after = raw(distance+radius);
    for (const c of corners) {
      const remaining = radius - Math.abs(distance-c.at);
      if (remaining <= 0) continue;
      const offset = remaining*remaining/(4*radius);
      center.x += c.dx*offset;
      center.y += c.dy*offset;
    }
    const dx = after.x-before.x, dy = after.y-before.y;
    const norm = Math.hypot(dx, dy);
    const g = grades.find(segment => distance < segment.start + segment.length) ?? grades[grades.length-1];
    let elevation = standingHeight;
    if (g) {
      const t = Math.min(1, Math.max(0, (distance-g.start)/g.length));
      const rise = t*t*(3-2*t);
      elevation = g.from + (g.to-g.from)*rise + g.crest*16*t*t*(1-t)*(1-t);
    }
    const pose = { ...center, elevation,
      dx: norm > 0.01 ? dx/norm : sections[0].dx, dy: norm > 0.01 ? dy/norm : sections[0].dy };
    cache.set(distance, pose);
    return pose;
  }
  return { at, curved: corners.length > 0, graded: grades.some(g => g.from !== g.to || g.crest !== 0) };
}

export function fleetAlignment(sim: DLRSimulation, unit: Pick<Train, 'currentEdgeId' | 'previousEdgeId' | 'currentNodeId' | 'nodePath' | 'edgeProgress'>) {
  const edge = sim.edgeMap[unit.currentEdgeId ?? ''];
  const route = edge ? [edge] : [];
  const length = edge ? Math.max(120, edge.lengthMeters) : 0;
  const next = edge && sim.adjacency[edge.to]?.find(e => e.to === unit.nodePath[2]);
  if (next && next.to !== edge.from) route.push(next);
  const previous = sim.edgeMap[unit.previousEdgeId ?? ''];
  let startDistance = 0;
  if (edge && previous?.to === edge.from && previous.from !== edge.to) {
    route.unshift(previous);
    startDistance = -Math.max(120, previous.lengthMeters);
  }
  const main = alignment(sim, route, { x: 0, y: 0 }, startDistance, railHeight(sim.nodeMap[unit.currentNodeId]));
  const branches = [];
  if (edge && !edge.isTunnel) {
    for (const [nodeId, distance, chosen] of [[edge.from, 0, edge], [edge.to, length, next]] as const) {
      if (Math.abs(unit.edgeProgress * length - distance) > 215) continue;
      for (const road of sim.adjacency[nodeId] ?? []) {
        if (road === chosen || road.to === edge.from || road.isTunnel || road.isCrossover) continue;
        const branch = alignment(sim, [road], main.at(distance));
        branches.push({ edge: road, path: branch, length: Math.min(170, road.lengthMeters) });
      }
    }
  }
  return { main, branches };
}
