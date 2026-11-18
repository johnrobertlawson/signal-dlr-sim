import type { SceneryBrush } from './fleetLandscape';

// All positions use the same section coordinates as the rails, roads and water.
// An infinite stream avoids respawning a vehicle at the edge of a moving camera.
function firstInBlock(start: number, offset: number, spacing: number) {
  const index = Math.ceil((start-offset)/spacing);
  return { index, position: offset + index*spacing };
}

export function drawRoadTraffic(start: number, roadX: number, cameraZ: number, seconds: number, seed: number, brush: SceneryBrush) {
  const {side, ground, face, lamp} = brush;
  // Far lane first. Vehicles in a lane share a speed and keep their spacing.
  for (const direction of [-1,1]) {
    const spacing = direction > 0 ? 82 : 107;
    const offset = direction*(seconds*(direction > 0 ? 8.5 : 10) + seed*5);
    const {index, position: z} = firstInBlock(start,offset,spacing);
    if (z >= start+44) continue;
    const bus = (index+seed)%5 === 0;
    const x = roadX-direction*1.95, halfWidth = bus ? 1.22 : 0.9;
    const nearSide = x-halfWidth, farSide = x+halfWidth;
    const halfLength = bus ? 5.1 : 2.1;
    const lo = z-halfLength, hi = z+halfLength, top = bus ? 4.15 : 1.52;
    const colour = bus ? '#c24b42' : ['#648aa0','#a8a69a','#a16a55','#5d7771'][Math.abs(index)%4];
    side('#353b42',nearSide,0.16,0.53,lo+0.3,hi-0.3);
    side(colour,nearSide,0.43,bus ? top : 0.97,lo,hi);
    const roofLo = bus ? lo : lo+0.68, roofHi = bus ? hi : hi-0.68;
    side('#536d79',nearSide,0.98,top-0.16,roofLo+0.15,roofHi-0.15);
    if (bus) {
      side(colour,nearSide,1.8,2.47,lo,hi);
      for (let p=lo+2; p<hi; p+=2.0) side(colour,nearSide,1,top-0.12,p,p+0.16);
    }
    ground(bus ? '#bc8a78' : colour,nearSide,farSide,top,roofLo,roofHi);
    const end = cameraZ < z ? lo : hi, roofEnd = cameraZ < z ? roofLo : roofHi;
    face(colour,[nearSide,0.4,end],[farSide,0.4,end],[farSide,bus ? top : 0.97,end],[nearSide,bus ? top : 0.97,end]);
    face('#425f6a',[nearSide+0.12,1,end],[farSide-0.12,1,end],
      [farSide-0.12,bus ? 1.84 : top,roofEnd],[nearSide+0.12,bus ? 1.84 : top,roofEnd]);
    if (bus) face('#475f68',[nearSide+0.12,2.5,end],[farSide-0.12,2.5,end],[farSide-0.12,3.8,end],[nearSide+0.12,3.8,end]);
    const approaching = (end-z)*direction > 0;
    for (const lightX of [nearSide+0.2,farSide-0.2]) lamp(approaching ? 'white' : 'red',[lightX,0.68,end],0.45);
  }
}

export function drawRailTraffic(start: number, cameraZ: number, seconds: number, seed: number, brush: SceneryBrush) {
  const {side, face, ground, lamp} = brush;
  for (const direction of [-1,1]) {
    const x = direction < 0 ? -35 : -31;
    const consist = direction < 0 ? 3 : 4, spacing = direction < 0 ? 750 : 920;
    const leading = seed*(direction < 0 ? 7 : 3) + seconds*direction*(direction < 0 ? 17 : 20);
    // Paint individual coaches in their own scenery block, far end first.
    const cars: {index: number; z: number}[] = [];
    for (let index=0; index<consist; index++) {
      const {position: z} = firstInBlock(start,leading-direction*index*19.8,spacing);
      if (z < start+44) cars.push({index,z});
    }
    cars.sort((a,b)=>Math.abs(b.z-cameraZ)-Math.abs(a.z-cameraZ));
    for (const {index,z} of cars) {
      const lo=z-9.6, hi=z+9.6, wall=x+1.4;
      const stripe = direction < 0 ? '#397f95' : '#765688';
      side('#3d4950',x+1.15,0.3,1.0,lo+1,hi-1);
      side('#d4d4c7',wall,0.87,3.75,lo,hi);
      side(stripe,wall,0.95,1.40,lo,hi);
      for (let bay=lo+1; bay<hi-2; bay+=3.5) side('#526c7c',wall,1.97,3.04,bay,bay+2.55);
      for (const door of [lo+4.1,hi-5.5]) side(stripe,wall,1.32,3.4,door,door+1.45);
      ground('#8e9fa2',x-1.4,wall,3.75,lo,hi);
      const end = cameraZ > z ? hi : lo;
      const nose = (end-z)*direction > 0;
      const cab = nose ? index===0 : index===consist-1;
      face(cab ? '#d9b55c' : '#66737a',[x-1.4,0.88,end],[wall,0.88,end],[wall,3.75,end],[x-1.4,3.75,end]);
      if (cab) {
        face('#354e5b',[x-1.2,2.03,end],[x+1.2,2.03,end],[x+1.08,3.29,end],[x-1.08,3.29,end]);
        for (const dx of [-0.96,0.96]) lamp(nose ? 'white' : 'red',[x+dx,1.45,end],0.8);
      }
    }
  }
}

export function drawRiverBoat(z: number, cameraZ: number, seconds: number, seed: number, water: number, brush: SceneryBrush) {
  const {face,ground,lamp} = brush;
  // Opposing runs turn beyond the view, in the open reach at either end.
  const distance = (seconds*2.8+seed*3)%960;
  const direction = distance<480 ? 1 : -1;
  const x = distance<480 ? distance-240 : 720-distance;
  const stern=x-direction*6, bow=x+direction*8;
  const near = z+(cameraZ<z ? -2.1 : 2.1);
  for (const sign of [-1,1]) {
    const outer=z+sign*2;
    face('#9eb8b8',[stern,water+0.07,outer],[stern-direction*9,water+0.07,outer+sign*2.2],
      [stern-direction*8,water+0.07,outer+sign*1.5]);
  }
  face('#4a626d',[stern,water+0.12,near],[x+direction*5,water+0.12,near],[bow,water+1.45,z],[x+direction*5,water+1.45,near],[stern,water+1.45,near]);
  face('#c5c3ac',[stern,water+1.45,z-2.1],[x+direction*5,water+1.45,z-2.1],[bow,water+1.45,z],[x+direction*5,water+1.45,z+2.1],[stern,water+1.45,z+2.1]);
  face('#d3cebb',[x-2,water+1.46,near],[x+2,water+1.46,near],[x+2,water+3.25,near],[x-2,water+3.25,near]);
  face('#496675',[x-1.7,water+2.05,near],[x+1.7,water+2.05,near],[x+1.7,water+2.97,near],[x-1.7,water+2.97,near]);
  ground('#e0d2b7',x-2.35,x+2.35,water+3.3,z-2.15,z+2.15);
  lamp('warm',[x,water+3.4,z],0.55);
}
