import type { SceneryBrush } from './fleetLandscape';

type Point = [number, number, number];
type EntranceBrush = SceneryBrush & { sign: (name: string, point: Point, width: number) => void };

// Street datum is zero. The stairs reach the actual height of the platform.
export function drawEntrance(code: string, stop: number, cameraX: number, brush: EntranceBrush) {
  if (!['TWG','RVC','WSV','PDK'].includes(code)) return;
  const {face, side, ground, lamp, sign} = brush;
  const z = stop-19, landing = brush.railLevel(stop)+0.9;
  const tower = code === 'TWG', red = code === 'RVC';
  const skin = red ? '#af5547' : '#919b9d';
  ground('#6a7073',8,44,0.08,z-36,z+43);
  ground('#a59b8c',8,23,0.10,z-24,z+16);
  for (let i=0;i<6;i++) ground('#c4c2b6',24+i*1.6,24.8+i*1.6,0.12,z-14,z-11);

  // A covered incline links the public doors to the elevated landing.
  for (const x of [10,15]) {
    face('#45646c',[x,0.4,z-7],[x,1.5,z-7],[x,landing+1.1,z+13],[x,landing-0.35,z+13]);
  }
  face('#747b7e',[10,0.48,z-7],[15,0.48,z-7],[15,landing,z+13],[10,landing,z+13]);
  for (let i=0;i<13;i++) {
    const at = z-7+i*1.5, y = 0.5+(landing-0.5)*i*1.5/20;
    ground('#bcc0b9',10,15,y,at,at+0.32);
  }
  ground('#808b8e',7,15,landing,z+12,z+16);

  if (tower) {
    // Minories: a faceted glazed drum, ribbed cupola and concrete parking decks.
    const cx = 15, cz = z-10;
    for (let floor=0;floor<4;floor++) {
      const y = floor*3.1;
      side('#5b6064',24,y,y+2.75,z+18,z+49);
      side('#aa9b8e',24,y+2.1,y+3.1,z+18,z+49);
      side('#676c70',36,y,y+2.75,z+18,z+49);
      ground('#969995',24,36,y+3.1,z+18,z+49);
      face('#887c74',[24,y,z+18],[36,y,z+18],[36,y+3.1,z+18],[24,y+3.1,z+18]);
      for (const bay of [22,30,38,46]) side('#99918a',24,y,y+2.15,z+bay,z+bay+0.55);
    }
    const rim = (i: number,r: number,h: number): Point => [cx+r*Math.cos(i*Math.PI/6),h,cz+r*Math.sin(i*Math.PI/6)];
    // Far panels first from the observer's side of the entrance.
    const brushSide = Math.sign(cameraX-cx);
    const order = Array.from({length:12},(_,i)=>i).sort((a,b)=>brushDepth(a)-brushDepth(b));
    function brushDepth(i: number) { return Math.cos((i+0.5)*Math.PI/6)*brushSide; }
    function panel(i: number) {
      face(i%2 ? '#6d9398' : '#54777e',rim(i,5.8,0.3),rim(i+1,5.8,0.3),rim(i+1,5.8,4.3),rim(i,5.8,4.3));
      face('#335960',rim(i,5.86,2.9),rim(i+1,5.86,2.9),rim(i+1,5.86,3.16),rim(i,5.86,3.16));
      face('#305865',rim(i,6.05,4.05),rim(i+1,6.05,4.05),rim(i+1,6.05,4.42),rim(i,6.05,4.42));
      face('#d2c8ab',rim(i,5.85,0.25),rim(i+0.15,5.85,0.25),rim(i+0.15,5.85,4.4),rim(i,5.85,4.4));
      face(i%2 ? '#749597' : '#87a5a1',rim(i,6.3,4.4),rim(i+1,6.3,4.4),rim(i+1,4.4,6.8),rim(i,4.4,6.8));
      face('#b0beb1',rim(i,4.4,6.8),rim(i+1,4.4,6.8),[cx,8.3,cz]);
    }
    for (const i of order) panel(i);
    // The covered escalator climbs away from the drum in a glazed barrel.
    for (let rib=0;rib<6;rib++) {
      const at=z-6+rib*3, floor=0.5+(landing-0.5)*(at-z+7)/20;
      side('#366d77',15,floor+0.3,floor+2.75,at,at+0.24);
      face('#7caaad',[10,floor+2.65,at],[12.5,floor+3.55,at],
        [12.5,floor+3.55+0.15*landing,at+3],[10,floor+2.65+0.15*landing,at+3]);
      face('#9bbaae',[12.5,floor+3.55,at],[15,floor+2.65,at],
        [15,floor+2.65+0.15*landing,at+3],[12.5,floor+3.55+0.15*landing,at+3]);
    }
    face('#354a52',[cx+2.4,0.25,cz-5.4],[cx+5,0.25,cz-3.2],[cx+5,3.0,cz-3.2],[cx+2.4,3.0,cz-5.4]);
    face('#398e91',[cx+1.7,3.05,cz-6],[cx+5.5,3.05,cz-3.1],[cx+5.5,3.65,cz-3.1],[cx+1.7,3.65,cz-6]);
    sign('Tower Gateway',[cx+2.6,4.0,cz-5.9],6.4);
    lamp('warm',[cx,3.3,cz-5.8],0.9);
  } else {
    // Royal Victoria's brick-red lift bay and the silver Royal Docks towers.
    const top = landing+3.7, x = 16;
    side(skin,x,0,top,z-8,z-1);
    face(skin,[x-5,0,z-8],[x,0,z-8],[x,top,z-8],[x-5,top,z-8]);
    side('#536f78',x+0.02,3.7,top-0.9,z-7.5,z-1.5);
    for (let y=4.8;y<top;y+=2.2) side('#bec8c6',x+0.05,y,y+0.16,z-8,z-1);
    ground('#aeb9b9',x-5,x+0.6,top,z-8.4,z-0.6);
    side('#278785',x+0.12,0.1,3.1,z-6.5,z-2.5);
    side('#a6afac',x+0.14,0.1,2.65,z-6.1,z-2.9);
    side('#535c60',x+0.18,0.1,2.65,z-4.53,z-4.47);
    ground('#417f83',x,x+4.3,3.25,z-9,z);
    sign(code === 'RVC' ? 'Royal Victoria' : code === 'WSV' ? 'West Silvertown' : 'Pontoon Dock',[x+3.9,3.45,z-4.5],6);
    lamp('white',[x+2,3.1,z-4.5],1);
  }
}
