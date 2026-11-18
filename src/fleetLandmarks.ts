import type { SceneryBrush } from './fleetLandscape';

// Positions use metres along a section, measured from the alphabetically first
// station in either direction. Each silhouette occupies one site on that section.
type Site = 'wharf' | 'stadium' | 'hall' | 'cable';
const sites: Record<string, { kind: Site; fraction: number; x: number }> = {
  'CAW-WIQ': { kind: 'wharf', fraction: 0.46, x: -48 },
  'PML-STR': { kind: 'stadium', fraction: 0.52, x: -71 },
  'CUH-PRR': { kind: 'hall', fraction: 0.44, x: 49 },
  'CUH-RVC': { kind: 'cable', fraction: 0.74, x: -42 },
};

export function sectionSite(section: string, length: number) {
  const site = sites[section];
  return site && { ...site, z: length * site.fraction };
}

export function drawSite(site: NonNullable<ReturnType<typeof sectionSite>>, cameraZ: number, brush: SceneryBrush) {
  const { face, ground, side, lamp } = brush;
  const { x, z, kind } = site;
  if (kind === 'wharf') {
    // One Canada Square's stepped shoulders and pyramid roof.
    const near = cameraZ > z ? z+12 : z-12;
    side('#75929c',x+10,0,52,z-12,z+12);
    face('#5a7687',[x-10,0,near],[x+10,0,near],[x+10,52,near],[x-10,52,near]);
    for (let y=4; y<52; y+=4) {
      side('#b3c1bb',x+10,y,y+0.5,z-12,z+12);
      face('#95a8ad',[x-10,y,near],[x+10,y,near],[x+10,y+0.5,near],[x-10,y+0.5,near]);
    }
    face('#a2b2b7',[x+10,52,z-12],[x+10,52,z+12],[x,65,z]);
    face('#d2d3c5',[x-10,52,near],[x+10,52,near],[x,65,z]);
    // After dark a tiny train appears in the office lights below the pyramid.
    for (const [row,windows] of ['1110111','1010101','1111111','0100010'].entries()) {
      for (let col=0;col<windows.length;col++) {
        if (windows[col]==='1') lamp('warm',[x+10.1,49-row*1.6,z-6+col*1.9],0.53);
      }
    }
    lamp('red',[x,65,z],0.7);
  } else if (kind === 'stadium') {
    // Faceted bowl, white roof rim and raking floodlight pylons.
    const ring = Array.from({length: 12}, (_,i) => {
      const a = i * Math.PI/6;
      return { dx: Math.cos(a), dz: Math.sin(a) };
    });
    const rim = ring.map(p => [x+34*p.dx,13,z+49*p.dz] as [number,number,number]);
    for (let i=0; i<12; i++) {
      const j = (i+1)%12, a = ring[i], b = ring[j];
      if (a.dx+b.dx < 0) continue;
      face(i%2 ? '#788893' : '#697b85',[x+27*a.dx,1,z+42*a.dz],[x+27*b.dx,1,z+42*b.dz],rim[j],rim[i]);
    }
    face('#c8ccc6',...rim);
    face('#6b7c80',...ring.map(p => [x+23*p.dx,13.2,z+35*p.dz] as [number,number,number]));
    for (const i of [0,2,4,6,8,10]) {
      const [rx,y,rz] = rim[i];
      face('#a8b6b7',[rx-1,y,rz],[rx+1,y,rz],[rx+3,21,rz+1],[rx+2,21,rz+1]);
      side('#e0d8a8',rx+2,20.5,22,rz-2,rz+3);
      lamp('white',[rx+2,21.5,rz],1.1);
    }
  } else if (kind === 'hall') {
    side('#a6b6b7',x,0,11,z-54,z+54);
    side('#536f7d',x,4.5,8,z-54,z+54);
    ground('#d2d1c5',x,x+28,11,z-54,z+54);
    for (let k=-48; k<=48; k+=12) {
      face('#d4d7cc',[x-3,0,z+k],[x-2,0,z+k],[x+1,13,z+k+4],[x,13,z+k+4]);
      face('#93a4aa',[x,11,z+k],[x+28,11,z+k],[x+22,15,z+k+4],[x+3,15,z+k+4]);
      lamp('warm',[x-0.3,4,z+k],0.5);
    }
  } else {
    // Royal Docks cableway mast, suspended rope and gondolas.
    for (const foot of [-5,5]) face('#b9bfbb',[x+foot-0.7,0,z],[x+foot+0.7,0,z],[x+1,30,z],[x-1,30,z]);
    for (let k=-3; k<3; k++) {
      const a=x+k*12, b=a+12, h=30-Math.abs(k)*1.4, h2=30-Math.abs(k+1)*1.4;
      face('#46545b',[a,h,z+k*12],[b,h2,z+(k+1)*12],[b,h2+0.3,z+(k+1)*12],[a,h+0.3,z+k*12]);
      if (k%2===0) {
        side('#64747a',a,h-1.4,h,z+k*12,z+k*12+0.3);
        side('#ac4946',a,h-3.4,h-1.4,z+k*12-1.2,z+k*12+1.2);
        side('#384e5b',a+0.1,h-2.6,h-1.6,z+k*12-1,z+k*12+1);
      }
    }
    lamp('red',[x,30.4,z],0.65);
  }
}
