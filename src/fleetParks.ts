import type { SceneryBrush } from './fleetLandscape';

// Each pocket is a handful of flat faces, placed once per scenery block.
// The strip closest to the track stays open so the path reads at cab height.
export function drawGreenway(z: number, x: number, variant: number, brush: SceneryBrush) {
  const { ground, face, side } = brush;
  const dir = Math.sign(x);
  const across = (offset: number) => x + dir * offset;
  ground('#899454', across(-1), across(16), 0.02, z, z + 44);
  ground('#c3b897', x, across(3.2), 0.06, z, z + 44);
  ground('#946c62', across(3.2), across(5.3), 0.07, z, z + 44);
  const mid = z + 22, cx = across(10);
  if (variant <= 3) {
    // Community allotment, planted rows and a glazed cold frame.
    for (const offset of [7, 10, 13]) {
      const bed = across(offset);
      ground('#775b47', bed-1, bed+1, 0.12, z+6, z+22);
      ground(variant % 2 ? '#ad6957' : '#889954', bed-0.4, bed+0.4, 0.24, z+7, z+21);
    }
    const end = z+36;
    for (const sign of [-1, 1]) {
      side('#92afa2',cx+sign*2,0,1.5,end-7,end);
      face(sign < 0 ? '#b9cbc2' : '#89a9a4',[cx+sign*2,1.5,end-7],[cx,2.8,end-7],
        [cx,2.8,end],[cx+sign*2,1.5,end]);
    }
    for (const endZ of [end-7,end]) {
      face('#a3bbb0',[cx-2,0,endZ],[cx+2,0,endZ],[cx+2,1.5,endZ],[cx,2.8,endZ],[cx-2,1.5,endZ]);
      face('#66827b',[cx-0.65,0,endZ],[cx+0.65,0,endZ],[cx+0.65,1.9,endZ],[cx-0.65,1.9,endZ]);
    }
  } else if (variant <= 7) {
    // Irregular waterline, reflections and three clumps of rushes.
    face('#629399',[cx-3,0.1,mid-13],[cx+3,0.1,mid-10],[cx+5,0.1,mid-3],
      [cx+4,0.1,mid+9],[cx,0.1,mid+14],[cx-4,0.1,mid+9],[cx-5,0.1,mid-4]);
    for (const dz of [-6, 0, 7]) {
      ground('#a6c5bc',cx-2,cx+1,0.12,mid+dz,mid+dz+0.28);
      const reed = cx+3.6;
      face('#777d44',[reed-0.6,0.12,mid+dz],[reed-1.1,1.8,mid+dz],[reed,0.7,mid+dz],
        [reed+0.4,2.2,mid+dz],[reed+0.6,0.12,mid+dz]);
    }
  } else {
    // A paved square with a stone fountain and a pair of timber benches.
    ground('#c0b5a4',cx-5,cx+5,0.1,mid-10,mid+10);
    ground('#8a8980',cx-2.5,cx+2.5,0.45,mid-2.5,mid+2.5);
    ground('#78afb4',cx-2.2,cx+2.2,0.48,mid-2.2,mid+2.2);
    face('#c5e2dc',[cx-1.5,0.5,mid],[cx-0.4,2.3,mid],[cx,3.4,mid],
      [cx+0.45,2.1,mid],[cx+1.6,0.5,mid],[cx,1.5,mid]);
    for (const dz of [-7, 6]) {
      ground('#8c684e',cx-1.5,cx+1.5,0.55,mid+dz,mid+dz+0.6);
      face('#ac8060',[cx-1.5,0.55,mid+dz],[cx+1.5,0.55,mid+dz],
        [cx+1.5,1.1,mid+dz],[cx-1.5,1.1,mid+dz]);
    }
  }
}

// A small flock wheels over one stretch of wetland. The orbit stays inside
// its block, so it never teleports as a train crosses a scenery boundary.
export function drawMarshBirds(z: number, seconds: number, { face }: SceneryBrush) {
  const turn = seconds*0.16+z;
  const x = 18+7*Math.cos(turn), at = z+22+9*Math.sin(turn);
  for (let i=0; i<5; i++) {
    const offset = i-2, cx = x+offset*1.35, cz = at+Math.abs(offset)*1.1;
    const y = 6.4+0.4*Math.sin(turn+i), tip = y+0.45*Math.sin(seconds*4+i);
    face('#61757b',[cx-0.85,tip,cz],[cx,y,cz+0.22],[cx+0.85,tip,cz],
      [cx+0.3,y+0.04,cz-0.22],[cx,y-0.15,cz],[cx-0.32,y+0.04,cz-0.22]);
  }
}
