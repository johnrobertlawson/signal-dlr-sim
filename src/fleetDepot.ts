import type { SceneryBrush } from './fleetLandscape';

const coveredRoads = new Set(['PDP_S3', 'BDP_R3', 'BDP_R4']);

// The portal stays a fixed distance from the workshop berth in both directions,
// including when a unit has no active edge while stabled inside.
export function shedCentre(from: string, to: string | undefined, length: number, reverse: boolean) {
  if (coveredRoads.has(from)) return reverse ? length : 0;
  if (to && coveredRoads.has(to)) return reverse ? 0 : length;
  return undefined;
}

export function drawDepotBlock(z: number, centre: number | undefined, brush: SceneryBrush) {
  const { ground, face, side, lamp } = brush;
  const end = z+44;
  ground('#777971',-23,20,0.35,z,end);
  for (const x of [-17,-11,-5.5,10.5,16]) {
    ground('#585d5e',x-1.6,x+1.6,0.62,z,end);
    for (const r of [-0.72,0.72]) ground('#b8bdba',x+r-0.09,x+r+0.09,0.82,z,end);
  }
  if (centre === undefined) return;
  const lo = Math.max(z,centre-84), hi = Math.min(end,centre+84);
  if (lo >= hi) return;
  ground('#92948d',-3.4,-1.55,0.82,lo,hi);
  ground('#e3b957',-2,-1.8,0.84,lo,hi);
  // Two sloping roof planes, clerestory glazing and repeating steel portals.
  for (const sign of [-1,1]) {
    const wall = sign*21;
    side('#596873',wall,0,7.2,lo,hi);
    side('#9fb9bf',wall,4.4,6.5,lo,hi);
    face('#63737b',[wall,7.2,lo],[0,10,lo],[0,10,hi],[wall,7.2,hi]);
    for (let at=centre-84; at<hi; at+=12) {
      if (at < lo) continue;
      face('#38505a',[wall,0,at],[wall-sign*0.5,0,at],[wall-sign*0.5,7.2,at],[wall,7.2,at]);
      face('#344b56',[wall,6.7,at],[0,9.45,at],[0,10,at],[wall,7.2,at]);
      ground('#e0d8a8',sign*6-0.22,sign*6+0.22,8.35,at+0.3,at+3.5);
      if (sign === 1) {
        // Tall ochre lifting jacks along the service aisle.
        side('#d19a45',8.6,0.8,3.0,at+3,at+3.8);
        ground('#e7b754',8,9.1,2.7,at+3,at+4);
      }
    }
  }
  const beam = centre;
  if (beam >= lo && beam < hi) {
    face('#d5a14f',[-20,5.9,beam],[20,5.9,beam],[20,6.9,beam],[-20,6.9,beam]);
    face('#48565a',[7,4.9,beam],[8.5,4.9,beam],[8.5,6,beam],[7,6,beam]);
    lamp('warm',[8,5.1,beam],0.8);
  }
}
