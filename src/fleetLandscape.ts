import { drawRailTraffic, drawRoadTraffic, drawRiverBoat } from './fleetSceneryTraffic';
import { drawSite, sectionSite } from './fleetLandmarks';
import type { TrackEdge, TrackNode } from './types';

type Point = [number, number, number];
export type LampColour = 'warm' | 'white' | 'red' | 'blue';
export type SceneryBrush = {
  lamp: (colour: LampColour, at: Point, size: number) => void;
  lightPool: (x: number, y: number, z: number, radiusX: number, radiusZ: number) => void;
  railLevel: (z: number) => number;
  face: (colour: string, ...points: Point[]) => void;
  side: (colour: string, x: number, y1: number, y2: number, z1: number, z2: number) => void;
  ground: (colour: string, x1: number, x2: number, y: number, z1: number, z2: number) => void;
};

// Use both ends of the section so scenery stays consistent in either direction.
export function landscape(here: TrackNode, next?: TrackNode, edge?: TrackEdge) {
  const ends = [here, next].flatMap(n => n ? [n.id.split('_')[0], n.stationId] : []);
  const has = (...codes: string[]) => codes.some(code => ends.includes(code));
  if (has('PDP','BDP')) return 'yard';
  if (has('LCA','KGV')) return 'airfield';
  if (has('CAW','WIQ','HER','SQY','DLT')) return 'towers';
  if (has('RVC','CUH','PRR','RAL','WSV','PDK','EIR')) return 'quays';
  if (has('PML')) return 'park';
  if (has('STI','SHS','ABB','STL','STR')) return 'cutting';
  if (has('MUD','ISG','BKP','CYP','GAL','ELV')) return 'park';
  if (edge?.isFlyover || has('TWG','LIM','SHA','DEP')) return 'viaduct';
  return 'terraces';
}

function roadSurface(z: number, x: number, { ground, lightPool }: SceneryBrush) {
  ground('#91918a',x-5,x+5,0,z,z+44);
  ground('#545e64',x-4.1,x+4.1,0.04,z,z+44);
  for (const k of [3,17,31]) ground('#d5cbb7',x-0.08,x+0.08,0.06,z+k,z+k+5);
  lightPool(x+2,0.07,z+7,2.8,5);
}

function streetLamp(z: number, x: number, { side, ground, lamp }: SceneryBrush) {
  side('#636d72',x+4.4,0,5.1,z+7,z+7.18);
  ground('#e0d8a8',x+3.3,x+4.6,5.1,z+7,z+7.4);
  lamp('warm',[x+3.5,5.06,z+7.2],1);
}

function railCorridor(z: number, {ground}: SceneryBrush) {
  ground('#746f67',-37,-28,0.12,z,z+44);
  for (const x of [-35,-31]) {
    for (const r of [-0.72,0.72]) ground('#bac1be',x+r-0.07,x+r+0.07,0.22,z,z+44);
  }
}

function railMast(z: number, {side,face}: SceneryBrush) {
  side('#7c8586',-37,0,6.6,z,z+0.35);
  face('#879390',[-37,6.1,z],[-29,6.1,z],[-29,6.5,z],[-37,6.5,z]);
  side('#58636a',-31,5.5,5.65,z,z+44);
}

// Two planes and a roof read as a city block at framebuffer resolution.
function building(x: number, z: number, h: number, length: number, n: number, cameraZ: number, brush: SceneryBrush) {
  const {side, face, ground} = brush;
  const outer = x + Math.sign(x)*9, end = cameraZ > z+length/2 ? z+length : z;
  side(['#a58a79','#92776e','#a29780'][n%3],x,0,h,z,z+length);
  face('#756e6b',[x,0,end],[outer,0,end],[outer,h,end],[x,h,end]);
  ground('#798484',Math.min(x,outer),Math.max(x,outer),h,z,z+length);
  if (h<10 && n%2) {
    const ridge = (x+outer)/2;
    face('#686667',[x,h,z],[ridge,h+2,z],[ridge,h+2,z+length],[x,h,z+length]);
    face('#84716b',[x,h,end],[ridge,h+2,end],[outer,h,end]);
    side('#917a6c',ridge,h+1.7,h+3.1,z+3,z+4.2);
  }
  const distant = Math.abs(z+length/2-cameraZ)>115;
  for (let y=1.6; y<h-0.5; y+=3.5) {
    if (distant) {
      side('#6a777d',x,y,y+0.65,z+1,z+length-1);
      continue;
    }
    for (let bay=2; bay<length-2; bay+=4.8) {
      const lit = (Math.floor(bay+y)+n)%4===0;
      side(lit ? '#edd3a0' : '#526777',x,y,y+1.35,z+bay,z+bay+2.0);
    }
  }
}

export function drawLandscape(kind: ReturnType<typeof landscape>, cameraZ: number, seed: number,
  section: string, length: number, seconds: number, brush: SceneryBrush) {
  const { ground, face, side, railLevel, lamp } = brush;
  const site = sectionSite(section,length);
  const waterWidth = section === 'CNT-EIR' ? 70 : section === 'DEP-GRE' ? 29 : 0;
  // The creek lies below the road bridge deck at the local street datum.
  const waterLevel = section === 'DEP-GRE' ? -5.5 : -1.4;
  const road = ['terraces','viaduct','towers','cutting'].includes(kind);
  const waterMid = length * 0.5;
  const otherRail = /(?:LIM|PML|STR|WHM|LEW)/.test(section);
  const low = Math.floor((cameraZ-220)/44), high = Math.ceil((cameraZ+220)/44);
  const blocks = Array.from({length: high-low+1}, (_, i) => low+i)
    .sort((a,b) => Math.abs(b*44+22-cameraZ)-Math.abs(a*44+22-cameraZ));
  // Lay the continuous surfaces first. A moving vehicle can straddle a
  // scenery-block boundary without the next piece of road covering its wheels.
  for (const i of blocks) {
    const z = i*44;
    let riverBlock = false;
    if (waterWidth) {
      const a = Math.max(z,waterMid-waterWidth/2), b = Math.min(z+44,waterMid+waterWidth/2);
      riverBlock = b>a;
      if (riverBlock) {
        ground('#517c86',-280,280,waterLevel,a,b);
        for (const x of [-64,-31,17,50]) ground('#94adb0',x+i%11,x+i%11+8,waterLevel+0.05,a+(b-a)*0.53,a+(b-a)*0.53+0.3);
      }
    }
    if (road && !riverBlock) roadSurface(z,18,brush);
    if (otherRail) railCorridor(z,brush);
  }
  for (const i of blocks) {
    const z = i*44, n = Math.abs(i*13+seed)%11;
    if (waterWidth && z < waterMid+waterWidth/2 && z+44 > waterMid-waterWidth/2) {
      const a = Math.max(z,waterMid-waterWidth/2), b = Math.min(z+44,waterMid+waterWidth/2);
      if (a<=waterMid && b>waterMid) drawRiverBoat(waterMid,cameraZ,seconds,seed,waterLevel,brush);
      for (const bank of [waterMid-waterWidth/2,waterMid+waterWidth/2]) {
        if (bank>=z && bank<z+44) face('#777e73',[-280,waterLevel,bank],[280,waterLevel,bank],[280,0.7,bank],[-280,0.7,bank]);
      }
      for (const x of [-2.4,2.4]) side('#8e9793',x,waterLevel,railLevel((a+b)/2)-0.5,(a+b)/2,(a+b)/2+1.3);
      if (road) {
        // Draw the road deck over the boat when their paths intersect.
        roadSurface(z,18,brush);
        for (const x of [13,23]) side('#82918d',x,-0.45,0.55,a,b);
        drawRoadTraffic(z,18,cameraZ,seconds,seed,brush);
        streetLamp(z,18,brush);
      }
      continue;
    }
    if (kind === 'quays') building(-94-n,z+3,9+n,37,n,cameraZ,brush);
    if (kind === 'terraces' || kind === 'viaduct') {
      building(-43-n,z+1,5+n,20+n,n,cameraZ,brush);
    }
    if (otherRail) {
      drawRailTraffic(z,cameraZ,seconds,seed,brush);
      railMast(z,brush);
    }
    if (road) {
      building(49+n,z+2,8+n*1.3,24+n,n,cameraZ,brush);
      drawRoadTraffic(z,18,cameraZ,seconds,seed,brush);
      streetLamp(z,18,brush);
    } else if (kind === 'yard' || kind === 'airfield') {
      building(-48-n,z+3,5+n*0.5,33,n,cameraZ,brush);
    } else if (kind === 'park' && n%3===0) {
      building(50+n,z,5+n*0.6,17,n,cameraZ,brush);
    }
    if (site && Math.floor(site.z/44)===i) drawSite(site,cameraZ,brush);
    if (kind === 'airfield') {
      ground('#454e55', 16, 49, -0.75, z, z+44);
      ground('#d1cec0', 32, 32.35, -0.72, z, z+11);
      ground('#f1c96e', 15, 15.4, -0.7, z, z+1.2);
      lamp('blue',[16,-0.58,z+1],0.8);
      lamp('warm',[47,-0.58,z+1],0.7);
      // A parked regional jet on the apron, with swept wings and a coloured fin.
      // Repetition is spaced beyond the normal sight distance.
      if (i%4 === 1) {
        const x = 37;
        face('#cdd1c8',[x,0.7,z-9],[x,2.5,z-6],[x,2.7,z+7],[x,1.6,z+10],[x,0.8,z+8]);
        face('#d7dacf',[x,2.1,z+6],[x,6.8,z+10],[x,6.8,z+11.6],[x,1.9,z+10]);
        face('#ab554e',[x-0.02,4.4,z+9],[x-0.02,6.8,z+10],[x-0.02,6.8,z+11.6],[x-0.02,4.4,z+11]);
        face('#b7c2c2',[x,1.6,z-2],[x-9,1.4,z+4],[x-9,1.4,z+5.2],[x,1.6,z+2]);
        side('#556a78',x-0.03,1.8,2.1,z-6,z+3.2);
      }
      if (i%4 === 0) {
        side('#959c9e', 55, -1, 13, z, z+3.3);
        face('#51616d', [52,13,z-2],[60,13,z-2],[59,17,z-1],[53,17,z-1]);
        ground('#b3b7b6', 52,60,17,z-2,z+5);
      }
    } else if (kind === 'park') {
      for (const x of [-18-n, 16+n]) {
        side('#64564b', x, -1, 3.4, z,z+0.65);
        face('#49634f',[x-3,2,z],[x-4,4,z+1],[x-1,7+n*0.19,z+2],[x+2,6,z+1],[x+3,2,z]);
        face('#708256',[x-1,7+n*0.19,z+2],[x+3,5,z+3],[x+4,2,z+3],[x+1,2,z+1]);
      }
    } else if (kind === 'quays') {
      ground('#58818b', -85,-8,-1.6,z,z+44);
      ground('#98afb0',-34-n,-23-n,-1.59,z+8,z+8.3);
      side('#8a8376', -8,-2,0.6,z,z+44);
      if (i%2 === 0) {
        side('#717878',-8,0.5,5,z+6,z+6.25);
        lamp('warm',[-8,5,z+6],1);
        brush.lightPool(-10,-1.57,z+6,1,3.4);
        brush.lightPool(-12.8,-1.57,z+6,0.45,1.6);
      }
      if (i%3 === 0) {
        side('#af795c',-23,-1.6,13,z,z+0.9);
        face('#9e6b50',[-23,12,z],[-23,13,z],[-38,19,z+6],[-38,18,z+6]);
        face('#666569',[-38,18,z+6],[-37.8,18,z+6],[-37.8,6,z+6],[-38,6,z+6]);
      }
    } else if (kind === 'cutting') {
      for (const x of [-10,12]) {
        side('#9b8276',x,-5,4.2,z,z+44);
        side('#c5b2a0',x,4.1,4.5,z,z+44);
        side('#736963',x*0.99,-5,4,z+2,z+2.8);
      }
      if (i%4 === 0 && railLevel(z) < 3) {
        const deck = Math.max(6.1,railLevel(z)+6.1);
        ground('#566067',-13,15,deck,z,z+5);
        side('#98a2a1',-12,deck,deck+1.1,z,z+5);
        face('#747c77',[-12,deck,z],[15,deck,z],[15,deck+1.1,z],[-12,deck+1.1,z]);
      }
    } else if (kind === 'yard') {
      if (i%2===0) {
        brush.lightPool(-23,0,z,4,8);
        side('#7a8385',-20,0,12,z,z+0.4);
        side('#b7bcaf',-20,11.5,12.2,z-2,z+2);
        lamp('white',[-20,11.8,z],1.6);
      }
      for (const x of [-8,-12,-16]) {
        ground('#716e65',x-1.4,x+1.4,-0.19,z,z+44);
        for (const r of [-0.72,0.72]) ground('#9da3a0',x+r-0.05,x+r+0.05,0,z,z+44);
      }
    } else if (kind === 'towers') {
      const x = -26-n, h = 19+n*2.5;
      side('#698796',x,-3,h,z,z+17);
      face('#486573',[x,-3,z],[x-11,-3,z],[x-11,h,z],[x,h,z]);
      for (let floor = 2; floor < h; floor += 3) side('#afc0c3',x+0.1,floor,floor+0.25,z,z+17);
      ground('#b0b7b6',x-11,x,h,z,z+17);
    } else if (kind === 'viaduct') {
      ground('#686d72',-27,-8,-0.25,z,z+44);
      // Raised brickwork opposite the running line. The curved openings look
      // through to street level, even when the rail deck fills the foreground.
      side('#ae8874',-18,1.2,2.2,z,z+44);
      side('#c8b299',-18,2.1,2.4,z,z+44);
      for (let arch = 0; arch < 2; arch++) {
        const base = z + arch*22;
        side('#906d60',-18,-5,1.3,base,base+3);
        for (let k = 0; k < 6; k++) {
          const a = Math.PI*k/6, b = Math.PI*(k+1)/6;
          const za = base+12.5-9.5*Math.cos(a), zb = base+12.5-9.5*Math.cos(b);
          face('#a17d69',[-18,-2.6+3.6*Math.sin(a),za],[-18,1.3,za],[-18,1.3,zb],[-18,-2.6+3.6*Math.sin(b),zb]);
        }
      }
      ground('#bdb7a6',-15,-14.8,-0.23,z+3,z+9);
    }
    if (kind === 'yard') {
      // Corrugated depot sheds, roller doors and illuminated lintels.
      const x = 17+n*0.3;
      building(x,z+3,6,28,n,cameraZ,brush);
      for (const k of [5,15,25]) {
        side('#475760',x,0.2,4.6,z+k,z+k+4.2);
        lamp('warm',[x,4.8,z+k+2],0.65);
      }
    } else if (kind === 'quays' && !(site?.kind === 'hall' && Math.abs(z+22-site.z)<75)) {
      building(33+n,z+3,7+n*0.7,28,n,cameraZ,brush);
    } else if (kind === 'towers' || kind === 'terraces' || kind === 'viaduct') {
      building(29+n*0.4,z+3,4+n*0.6,18,n,cameraZ,brush);
    }
  }
  return road || otherRail || (waterWidth > 0 && Math.abs(cameraZ-waterMid) < 260);
}
