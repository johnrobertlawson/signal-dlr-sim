import type { DLRSimulation } from './simulation';
import type { TrackEdge, Train } from './types';

export interface PassingUnit {
  unit: Train;
  // Position of the approaching cab in metres from the start of the viewer's edge.
  nose: number;
}

function continuesAhead(sim: DLRSimulation, first: TrackEdge, second: TrackEdge) {
  const a = sim.nodeMap[first.from], b = sim.nodeMap[first.to];
  const c = sim.nodeMap[second.from], d = sim.nodeMap[second.to];
  const dx = b.x - a.x, dy = b.y - a.y, ex = d.x - c.x, ey = d.y - c.y;
  return dx * ex + dy * ey > 0.90 * Math.hypot(dx, dy) * Math.hypot(ex, ey);
}

export function getPassingUnits(sim: DLRSimulation, viewer: Train): PassingUnit[] {
  const edge = sim.edgeMap[viewer.currentEdgeId ?? ''];
  if (!edge?.oppositeEdgeId || edge.isTunnel) return [];

  const length = Math.max(120, edge.lengthMeters);
  const eye = viewer.edgeProgress * length;
  const opposite = sim.edgeMap[edge.oppositeEdgeId];
  const sections = [{ edge: opposite, start: 0, length }];
  const next = sim.adjacency[edge.to]?.find(link => link.to === viewer.nodePath[2]);
  if (length - eye < 220 && next?.oppositeEdgeId && !next.isTunnel && continuesAhead(sim, edge, next)) {
    sections.push({ edge: sim.edgeMap[next.oppositeEdgeId], start: length, length: Math.max(120, next.lengthMeters) });
  }

  const visible: PassingUnit[] = [];
  for (const unit of sim.trains) {
    if (unit === viewer) continue;
    let nose: number | undefined;
    const road = sim.edgeMap[unit.currentEdgeId ?? ''];
    for (const section of sections) {
      if (road === section.edge) {
        nose = section.start + section.length * (1 - unit.edgeProgress);
        break;
      }
      // A dwelling or terminating unit may already have a new route (or no route).
      if (unit.edgeProgress === 0 && unit.currentNodeId === section.edge.from) nose = section.start + section.length;
      if (unit.edgeProgress === 0 && unit.currentNodeId === section.edge.to) nose = section.start;
    }
    // Keep the rear cars in view after the opposing cab crosses our starting berth.
    if (nose === undefined && road?.oppositeEdgeId && !road.isTunnel &&
        road.from === opposite.to && continuesAhead(sim, opposite, road)) {
      nose = -unit.edgeProgress * Math.max(120, road.lengthMeters);
    }
    if (nose !== undefined && nose - eye <= 220 && nose + unit.cars * 30 > eye) visible.push({ unit, nose });
  }
  return visible.sort((a, b) => b.nose - a.nose);
}
