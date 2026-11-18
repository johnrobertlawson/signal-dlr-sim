import type { TrackEdge, TrackNode } from './types';

// Compute a crisp Beck/IECC 0° / 45° / 90° chamfered polyline between two nodes (eliminating arbitrary diagonal spiderwebs!)
export function getEdgePolyline(n1: TrackNode, n2: TrackNode, edge?: TrackEdge): { x: number; y: number }[] {
  const x1 = n1.x;
  const y1 = n1.y;
  const x2 = n2.x;
  const y2 = n2.y;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  // Pure horizontal, pure vertical, short station crossover, or already ~45°
  if (adx < 6 || ady < 6 || Math.abs(adx - ady) < 8 || (edge?.isCrossover && adx + ady < 90)) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
  }

  // Symmetric 45° chamfered polyline: straight -> 45° diagonal -> straight
  if (adx > ady) {
    const straight = adx - ady;
    const p1 = { x: x1 + Math.sign(dx) * (straight * 0.5), y: y1 };
    const p2 = { x: x2 - Math.sign(dx) * (straight * 0.5), y: y2 };
    return [{ x: x1, y: y1 }, p1, p2, { x: x2, y: y2 }];
  } else {
    const straight = ady - adx;
    const p1 = { x: x1, y: y1 + Math.sign(dy) * (straight * 0.5) };
    const p2 = { x: x2, y: y2 - Math.sign(dy) * (straight * 0.5) };
    return [{ x: x1, y: y1 }, p1, p2, { x: x2, y: y2 }];
  }
}
