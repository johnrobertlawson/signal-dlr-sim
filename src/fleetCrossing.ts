import type { SceneryBrush } from './fleetLandscape';
import type { TrackEdge } from './types';

// Scenic crossing decks on the Delta and Stratford approaches. Heights are
// relative to the running rails so a changing approach grade retains clearance.
export function crossingOn(edge: TrackEdge | undefined) {
  if (!edge) return;
  const nodes = [edge.from, edge.to];
  if (nodes.includes('DLT_BYP_UP') || nodes.includes('STR_MKT_JCT')) return 'above';
  if (nodes.includes('STR_BAY') || (edge.isFlyover && nodes.some(id => /^(WFE|POP|WIQ)_/.test(id)))) return 'below';
}

export function drawCrossing(z: number, above: boolean, cutting: boolean, brush: SceneryBrush) {
  const {face, railLevel} = brush;
  const deck = above ? railLevel(z)+7.4 : Math.max(0.6,railLevel(z)-7.4);
  // Oblique crossing. The piers and girders share the same street datum as
  // the lower line. Leave a clear span over the running tracks.
  const span = (colour: string, a: number, b: number, ya: number, yb: number, x1=-56, x2=56) =>
    face(colour,[x1,ya,z+x1*0.42+a],[x2,ya,z+x2*0.42+a],[x2,yb,z+x2*0.42+b],[x1,yb,z+x1*0.42+b]);
  const foot = cutting ? 4.5 : 0;
  for (const x of cutting ? [-10,12] : [-36,-10,12,36]) {
    const at = z+x*0.42;
    face('#8f968e',[x-0.65,foot,at],[x+0.65,foot,at],[x+1.65,deck-0.8,at],[x-1.65,deck-0.8,at]);
  }
  span('#555f62',-3,3,deck-0.85,deck-0.85);
  span('#787e7d',-3,3,deck,deck);
  for (const offset of [-1.85,-0.42,0.42,1.85]) span('#c4c7bd',offset,offset+0.12,deck+0.08,deck+0.08);
  for (const lip of [-3,3]) {
    span('#5d777a',lip,lip,deck-0.9,deck+0.35);
    span('#afbbb1',lip,lip,deck+0.8,deck+0.93);
  }
}
