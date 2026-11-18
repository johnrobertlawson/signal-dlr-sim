import type { DLRSimulation } from './simulation';
import type { Train } from './types';
import { cameraAlignment, cameraTrains, type FixedCamera } from './fleetCctv';
import { drawEntrance } from './fleetEntrances';
import { crossingOn } from './fleetCrossing';
import { shedCentre } from './fleetDepot';
import { fleetAlignment } from './fleetAlignment';
import { landscape, drawLandscape, type LampColour } from './fleetLandscape';
import { passengerSprite, lineColour } from './fleetPlatform';
import { daylight, lampSprite } from './fleetLight';
import type { PassingUnit } from './fleetTraffic';
import { STATION_MAP } from './dlrData';

import { drawAirportTraffic } from './airportCamera';

const airportView = { currentNodeId: 'LCA_UP', nextNodeId: 'PDK_UP', currentEdgeId: 'E_LCA_PDK_UP',
  previousEdgeId: 'E_KGV_LCA_UP', nodePath: ['LCA_UP','PDK_UP','WSV_UP'], edgeProgress: 0 };

export type CameraShot = 'trackside' | 'front' | 'airport';
type Point = [number, number, number];

const width = 384;
const height = 216;
const fogPalette = new Map<string, string>();

function fogColour(base: string, mist: string, depth: number) {
  const band = Math.min(10, Math.max(0, Math.floor((depth - 20) / 14)));
  if (!band) return base;
  const key = base + mist + band;
  const cached = fogPalette.get(key);
  if (cached) return cached;
  const rgb = [1, 3, 5].map(i => {
    const a = parseInt(base.slice(i, i + 2), 16);
    const b = parseInt(mist.slice(i, i + 2), 16);
    return Math.round(a + (b - a) * band / 13);
  });
  const colour = 'rgb(' + rgb.join(',') + ')';
  fogPalette.set(key, colour);
  return colour;
}

// The camera uses metres along the active track. The low-resolution framebuffer
// and flat-shaded faces keep several open displays inexpensive.
export function drawFleetScene(ctx: CanvasRenderingContext2D, sim: DLRSimulation, subject: Train | undefined, shot: CameraShot, passing: PassingUnit[], fixed?: FixedCamera) {
  const mountEdge = fixed ? sim.edgeMap[fixed.edge] : undefined;
  const unit = fixed && mountEdge ? cameraAlignment(mountEdge,fixed.fraction) : subject ?? airportView;
  const here = sim.nodeMap[unit.currentNodeId];
  const next = unit.nextNodeId ? sim.nodeMap[unit.nextNodeId] : undefined;
  const edge = unit.currentEdgeId ? sim.edgeMap[unit.currentEdgeId] : undefined;
  const length = Math.max(120, edge?.lengthMeters ?? 120);
  const travel = unit.edgeProgress * length;
  const nearest = unit.edgeProgress > 0.5 && next ? next : here;
  const station = STATION_MAP[nearest.stationId ?? nearest.id.split('_')[0]];
  const code = station?.code ?? nearest.id.split('_')[0];
  const terrain = landscape(here, next, edge);
  const depot = terrain === 'yard', towers = terrain === 'towers';
  const tunnel = (edge?.isTunnel && unit.edgeProgress > 0.015 && unit.edgeProgress < 0.985)
    || ['BNK', 'WOO', 'CUT'].includes(code);
  const hour = sim.simTimeSeconds / 3600 % 24;
  const twilight = hour < 7 || hour > 18;
  const light = daylight(sim.simTimeSeconds);
  const mist = tunnel ? '#393e49' : light.mist;
  const cab = shot === 'front';
  const parallel = Boolean(edge?.oppositeEdgeId) && !tunnel;
  // A changing fog colour would otherwise grow this lookup table every minute.
  if (fogPalette.size > 4096) fogPalette.clear();
  // Successive fixed trackside positions give each unit room to approach and pass.
  const cameraZ = fixed ? travel+fixed.offset : shot === 'airport' ? -55 : cab ? travel : Math.floor((travel + 14) / 72) * 72 + 6;
  const route = fleetAlignment(sim, unit);
  let path = route.main;
  const eye = path.at(cameraZ);
  const atPlatform = (here.type === 'platform' && cameraZ < 85) || (next?.type === 'platform' && length-cameraZ < 85);
  const streetShot = !fixed && shot === 'trackside' && !tunnel && !depot && !atPlatform && eye.elevation >= 4.5;
  const cameraX = fixed ? fixed.x : shot === 'airport' ? 11 : cab ? 0 : streetShot ? -21 : -14;
  const cameraY = fixed ? fixed.height-(fixed.street ? eye.elevation : 0) : shot === 'airport' ? 13 : cab ? 2.5 : streetShot ? 2.4-eye.elevation : 3.4;
  const yaw = fixed ? fixed.yaw : shot === 'airport' ? 0.23 : cab ? 0 : Math.atan2(-cameraX, travel - 13 - cameraZ);
  const lens = cab ? 192 : 166;
  // A nearly level cab horizon shows the grade ahead. A street camera pans
  // upward to keep an elevated train in shot and its piers in the foreground.
  const aim = path.at(travel-13).elevation + 1.7 - (eye.elevation + cameraY);
  const pitch = fixed ? fixed.pitch : cab ? 0.35*(path.at(cameraZ+10).elevation-eye.elevation)/10
    : streetShot ? aim/Math.hypot(cameraX, travel-13-cameraZ) : 0;
  const horizon = Math.round(90 + lens*pitch);
  let modelX = 0, modelZ = 0, modelDirection = 1;
  let atStreetLevel = false, sceneryDirection = 1;
  let sun: { x: number; y: number; visible: boolean } | undefined;
  const eyeX = eye.x - eye.dy * cameraX, eyeY = eye.y + eye.dx * cameraX;
  const heading = Math.atan2(eye.dy, eye.dx) + yaw;
  const forwardX = Math.cos(heading), forwardY = Math.sin(heading);
  const toCamera = ([x, y, z]: Point): Point => {
    const pose = path.at(modelZ + z * modelDirection);
    const across = x * sceneryDirection + modelX;
    const dx = pose.x - pose.dy * across - eyeX;
    const dy = pose.y + pose.dx * across - eyeY;
    return [-dx*forwardY + dy*forwardX, y + (atStreetLevel ? 0 : pose.elevation) - eye.elevation - cameraY, dx*forwardX + dy*forwardY];
  };
  // Clip faces crossing the camera plane before perspective division.
  function face(colour: string, ...points: Point[]) {
    const verts = points.map(toCamera);
    const visible: Point[] = [];
    let a = verts[verts.length - 1];
    for (const b of verts) {
      if ((a[2] >= 0.6) !== (b[2] >= 0.6)) {
        const f = (0.6 - a[2]) / (b[2] - a[2]);
        visible.push([a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), 0.6]);
      }
      if (b[2] >= 0.6) visible.push(b);
      a = b;
    }
    if (visible.length < 3) return;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity, nearest = Infinity;
    for (const p of visible) {
      nearest = Math.min(nearest,p[2]);
      p[0] = Math.round(width/2+lens*p[0]/p[2]);
      p[1] = Math.round(horizon-lens*p[1]/p[2]);
      left = Math.min(left,p[0]); right = Math.max(right,p[0]);
      top = Math.min(top,p[1]); bottom = Math.max(bottom,p[1]);
    }
    if (right < 0 || left > width || bottom < 0 || top > height) return;
    const lit = tunnel || colour === '#fff2bf' || colour === '#fb5346' || colour === '#f5d99a' || colour === '#e0d8a8'
      ? colour : light.surface(colour);
    const shade = colour === '#edd3a0' && (tunnel || light.lamps > 0.2) ? '#edd3a0' : lit;
    ctx.fillStyle = fogColour(shade, mist, nearest);
    ctx.beginPath();
    for (const [x,y] of visible) ctx.lineTo(x,y);
    ctx.closePath();
    if (sun?.visible && sun.x >= left && sun.x <= right && sun.y >= top && sun.y <= bottom && ctx.isPointInPath(sun.x,sun.y)) sun.visible = false;
    ctx.fill();
  }
  function ground(colour: string, x1: number, x2: number, y: number, z1: number, z2: number) {
    for (let z = z1; z < z2;) {
      const end = path.curved ? Math.min(z+12,z2) : path.graded && !atStreetLevel ? Math.min(z+24,z2) : z2;
      face(colour, [x1,y,z], [x2,y,z], [x2,y,end], [x1,y,end]);
      z = end;
    }
  }
  function side(colour: string, x: number, y1: number, y2: number, z1: number, z2: number) {
    for (let z = z1; z < z2;) {
      const end = path.curved ? Math.min(z+12,z2) : path.graded && !atStreetLevel ? Math.min(z+24,z2) : z2;
      face(colour, [x,y1,z], [x,y2,z], [x,y2,end], [x,y1,end]);
      z = end;
    }
  }

  function lamp(colour: LampColour, at: Point, size: number, intensity = tunnel ? 1 : light.lamps) {
    if (intensity < 0.035) return;
    const [x,y,d] = toCamera(at);
    if (d < 1 || d > 165) return;
    const sx = width/2+lens*x/d, sy = horizon-lens*y/d;
    const radius = Math.min(15, Math.max(1.4, size*lens/d));
    if (sx < -radius || sx > width+radius || sy < -radius || sy > height+radius) return;
    ctx.globalAlpha = intensity;
    ctx.drawImage(lampSprite(colour),sx-radius,sy-radius,radius*2,radius*2);
    ctx.globalAlpha = 1;
  }

  function lightPool(x: number, y: number, z: number, rx: number, rz: number) {
    if (light.lamps < 0.05) return;
    ctx.globalAlpha = light.lamps*0.23;
    face('#f5d99a',[x-rx,y,z],[x-rx*0.6,y,z-rz],[x+rx*0.6,y,z-rz],
      [x+rx,y,z],[x+rx*0.6,y,z+rz],[x-rx*0.6,y,z+rz]);
    ctx.globalAlpha = 1;
  }

  // A platform plate faces the camera, like a billboard in an early 3D game.
  // Size and clipping still come from its position alongside the actual stop.
  function nameboard(name: string, at: Point, plateWidth: number, services?: string[]) {
    const [x, y, z] = toCamera(at);
    if (z < 1.5 || z > 95) return;
    const scale = lens / z;
    const w = Math.round(plateWidth * scale), h = Math.max(3, Math.round(scale * 0.83));
    const left = Math.round(width / 2 + scale * x - w/2), top = Math.round(horizon - scale*y);
    if (left > width || left+w < 0) return;
    ctx.fillStyle = fogColour('#152f4d', mist, z);
    ctx.fillRect(left, top, w, h);
    ctx.fillStyle = '#38c5b0';
    ctx.fillRect(left, top, w, Math.max(1, Math.round(h/6)));
    ctx.fillStyle = '#f4f0dd';
    ctx.font = 'bold ' + Math.max(3, Math.round(h*0.74)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, left+w/2, top+h*0.62, w-2);
    if (services?.length && w > 8) {
      const row = Math.max(2, Math.round(h*0.75));
      ctx.font = 'bold ' + Math.max(3, Math.floor(row*0.85)) + 'px sans-serif';
      ctx.textAlign = 'left';
      services.forEach((label,i) => {
        const y = top+h+i*row;
        ctx.fillStyle = '#192b40'; ctx.fillRect(left,y,w,row);
        ctx.fillStyle = lineColour(label); ctx.fillRect(left+1,y+1,Math.max(1,w*0.07),Math.max(1,row-2));
        ctx.fillStyle = '#f5f1dc'; ctx.fillText(label,left+w*0.12,y+row/2,w*0.85);
      });
    }
  }

  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 10);
  sky.addColorStop(0, light.top);
  sky.addColorStop(0.83, light.low);
  sky.addColorStop(1, light.mist);
  ctx.fillStyle = tunnel ? '#252935' : sky;
  ctx.fillRect(0, 0, width, height);
  const from = here.stationId ?? here.id.split('_')[0], to = next?.stationId ?? next?.id.split('_')[0] ?? from;
  const reverse = from === to ? here.id > (next?.id ?? here.id) : from > to;
  const section = (reverse ? [to,from] : [from,to]).join('-');
  const seed = [...section].reduce((n, c) => n + c.charCodeAt(0), 0);
  if (!tunnel) {
    // Bearing follows the schematic. A low sun only enters the window when
    // the camera faces it. Silhouettes and clouds share the same sky rotation.
    const bearing = heading;
    const azimuth = light.sunBearing - bearing;
    if (light.sunHeight > -0.04 && Math.cos(azimuth) > 0.1) {
      const x = width/2 + lens * Math.tan(azimuth);
      const y = horizon - light.sunHeight * 140;
      if (x > -60 && x < width+60 && y > -55) {
        sun = { x, y, visible: x > 4 && x < width-4 && y > 4 && y < horizon };
        const glow = ctx.createRadialGradient(x, y, 3, x, y, 55);
        glow.addColorStop(0, '#ffdc96bc'); glow.addColorStop(1, '#ffd18d00');
        ctx.fillStyle = glow; ctx.fillRect(x-55, y-55, 110, 110);
        ctx.fillStyle = '#fff1c3'; ctx.beginPath(); ctx.arc(Math.round(x),Math.round(y),5,0,2*Math.PI); ctx.fill();
      }
    }
    if (light.lamps > 0.25) {
      ctx.globalAlpha = light.lamps * 0.7;
      ctx.fillStyle = '#cad3dc';
      for (let i = 0; i < 23; i++) {
        const x = ((i*113-Math.round(heading*55))%width+width)%width;
        ctx.fillRect(x, 4+(i*43)%55, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = light.mist;
    ctx.globalAlpha = 0.50;
    for (let i = 0; i < 7; i++) {
      const x = ((i*83-Math.round(bearing*40)) % 504 + 504) % 504 - 60;
      const y = 19 + (i*31)%47;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+18,y-2); ctx.lineTo(x+39,y-3);
      ctx.lineTo(x+58,y); ctx.lineTo(x+46,y+1); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const offset = Math.round(heading * 87 + cameraZ * 0.035);
    ctx.fillStyle = light.surface('#a5b5b7');
    const quietSky = terrain === 'airfield' || terrain === 'park';
    for (let i = -1; i < 32; i++) {
      const key = i + Math.floor(offset/26);
      const y = horizon-4-Math.abs(Math.round(Math.sin(key*9.3+seed)*(quietSky ? 7 : 16)));
      const left = i*13-Math.floor((offset%26)/2);
      ctx.fillRect(left,y,11,horizon-y);
      if (sun && sun.x>=left && sun.x<=left+11 && sun.y>=y) sun.visible = false;
    }
    for (let i = -1; i < 22; i++) {
      const k = i + Math.floor(offset / 21);
      const n = Math.abs(Math.sin(k * 17.71 + seed) * Math.cos(k * 1.37));
      const x = i * 21 - ((offset % 21 + 21) % 21);
      if ((quietSky || depot) && Math.abs(k+seed)%4 === 0) continue;
      const h = Math.round(3 + n * (towers ? 38 : quietSky ? 10 : depot ? 13 : 23));
      const w = 10 + Math.abs(k*7+seed)%11;
      ctx.fillStyle = light.surface('#879da4');
      ctx.fillRect(x, horizon - h, w, h + 2);
      if (sun && sun.x>=x && sun.x<=x+w && sun.y>=horizon-h) sun.visible = false;
      ctx.fillStyle = light.surface('#647884');
      ctx.fillRect(x + w-4, horizon - h + 2, 4, h);
      ctx.fillStyle = twilight ? '#d8bb92' : light.surface('#a5bac1');
      for (let row = 0; row*5+4 < h; row++) {
        for (let col = 1; col < w-4; col+=4) {
          if ((col+row*7+k)%3) ctx.fillRect(x+col,horizon-h+4+row*5,2,1);
        }
      }
    }
  }
  ctx.fillStyle = tunnel ? '#34373d' : light.surface(terrain === 'park' ? '#65805d' : '#647067');
  ctx.fillRect(0, horizon, width, height-horizon);
  function entrances() {
    atStreetLevel = true;
    const brush = {face,ground,side,lamp,lightPool,railLevel:(z: number)=>path.at(z).elevation,sign:nameboard};
    for (const [node,z] of [[here,0],[next,length]] as const) {
      if (node?.type === 'platform' && node.stationId && Math.abs(cameraZ-z)<185) {
        drawEntrance(node.stationId,z,cameraX,brush);
      }
    }
    atStreetLevel = false;
  }
  const start = cameraZ - 160, end = cameraZ + 220;
  let movingScenery = false;
  if (!tunnel) {
    // Draw streets in a canonical direction at the local ground datum. The
    // train, its platforms and the running rails use the graded alignment.
    atStreetLevel = true;
    modelDirection = sceneryDirection = reverse ? -1 : 1;
    modelZ = reverse ? length : 0;
    const railLevel = (z: number) => path.at(modelZ + modelDirection*z).elevation;
    const sceneryZ = reverse ? length-cameraZ : cameraZ;
    const brush = {face,ground,side,lamp,lightPool,railLevel};
    const shed = depot ? shedCentre(here.id, next?.id, length, reverse) : undefined;
    movingScenery = drawLandscape(terrain,sceneryZ,seed,section,length,sim.simTimeSeconds,brush,shed,crossingOn(edge));
    if (terrain === 'airfield') {
      drawAirportTraffic(sim.airport, sim.simTimeSeconds, section, length, brush);
      movingScenery = true;
    }
    atStreetLevel = false;
    modelZ = 0;
    modelDirection = sceneryDirection = 1;
    if (cameraX < 10) entrances();
    if (edge?.isTunnel && (here.stationId==='GRE' || next?.stationId==='GRE')) {
      const at = here.stationId==='GRE' ? 22 : length-22;
      // Retaining headwall, concrete arch ring and the unlit bore beyond.
      face('#8b8076',[-7,-0.4,at],[8,-0.4,at],[8,6.6,at],[-7,6.6,at]);
      for (const [r,colour] of [[3.25,'#bcb5a2'],[2.78,'#222b33']] as const) {
        const arch: Point[] = [[-r,-0.3,at],[r,-0.3,at]];
        for (let i=0;i<=8;i++) arch.push([r*Math.cos(i*Math.PI/8),2.7+r*Math.sin(i*Math.PI/8),at]);
        face(colour,...arch);
      }
      lamp('warm',[3.6,3.5,at],0.75,0.85);
    }
    for (let z=Math.floor(start/36)*36; z<end; z+=36) {
      const level = path.at(z).elevation;
      if (!edge?.isFlyover && level > 0.7 && level < 4.5 && !depot && terrain !== 'cutting') {
        const farLevel = path.at(z+36).elevation;
        for (const sign of [-1,1]) {
          const lip = sign < 0 ? -2.6 : parallel ? 7.5 : 2.6;
          face(sign < 0 ? '#768660' : '#819069',[lip,-0.32,z],[lip,-0.32,z+36],
            [lip+sign*Math.max(0,farLevel)*1.4,-farLevel,z+36],[lip+sign*level*1.4,-level,z]);
        }
        continue;
      }
      if (level < 3.5) continue;
      face('#93958d',[-1,-level,z],[0.8,-level,z],[1.8,-0.5,z],[-1.9,-0.5,z]);
      side('#747f80',-1,-level,-0.65,z,z+1.2);
    }
  }
  for (const branch of route.branches) {
    path = branch.path;
    if (path.at(branch.length/2).elevation >= 3.5) {
      ground('#69777b',-2,2,-0.95,0,branch.length);
      for (const x of [-2,2]) side('#909997',x,-0.95,-0.12,0,branch.length);
      for (let z=16;z<branch.length;z+=32) {
        const footing = -path.at(z).elevation;
        face('#88918e',[-0.7,footing,z],[0.7,footing,z],[1.5,-0.95,z],[-1.5,-0.95,z]);
      }
    }
    ground('#6b695f',-1.35,1.35,-0.18,0,branch.length);
    for (let z = 0; z < branch.length; z += 1.6) ground('#514f4a',-1.1,1.1,-0.08,z,z+0.22);
    for (const x of [-0.72,0.72]) ground('#c5c2b7',x-0.05,x+0.05,0.06,0,branch.length);
  }
  path = route.main;
  if (tunnel) {
    for (const x of [cab ? -2.7 : -16, 2.7]) {
      side('#383b47', x, 0, 7, start, end);
      for (let z = Math.floor(start/9)*9; z < end; z += 9) {
        side('#676775', x, 0, 7, z, z+0.2);
        side('#f5d99a', x, 3.5, 3.7, z+1, z+3);
        lamp('warm',[x,3.6,z+2],0.8);
      }
    }
    ground('#22232c', cab ? -2.7 : -16, 2.7, 7, start, end);
  }
  const roads = parallel ? [0, 4.8] : [0];
  const right = parallel ? 7.5 : 2.6;
  ground(tunnel ? '#44454a' : '#5f6563', -2.55, right, -0.29, start, end);
  // From the street the concrete soffit hides the rails on top of the deck.
  if (streetShot) ground('#677172', -2.55, right, -1.32, start, end);
  for (const x of streetShot ? [] : roads) {
    const slab = tunnel || edge?.isFlyover;
    const bed = slab ? '#6c6e6d' : light.stone;
    ground(bed, x-1.34, x+1.34, -0.17, start, end);
    for (const sign of [-1, 1]) {
      const lip = x + sign * 1.34, foot = x + sign * 1.92;
      for (let z = start; z < end; z += 12) {
        const far = Math.min(end,z+12);
        face(sign < 0 ? '#656466' : '#55585a', [foot,-0.29,z], [lip,-0.17,z], [lip,-0.17,far], [foot,-0.29,far]);
      }
    }
    // Close sleepers are individually visible. Far ties merge into the trackbed.
    const low = Math.max(start,cameraZ-(cab ? 1 : 65)), high = cameraZ+88;
    for (let k = Math.floor(low/0.68); k <= high/0.68; k++) {
      const z = k * 0.68;
      ground(slab ? '#515557' : '#514d4b', x-1.12,x+1.12,-0.065,z,z+0.21);
      if (!slab && Math.abs(z-cameraZ)<32) {
        const grain = ((k*37%19)+19)%19 / 19;
        ground('#a39782',x-1.75+grain*0.5,x-1.67+grain*0.5,-0.14,z,z+0.10);
        ground('#585451',x+0.13+grain*0.48,x+0.23+grain*0.48,-0.15,z+0.33,z+0.41);
      }
    }
    for (const rail of [x-0.72,x+0.72]) {
      side('#634d41',rail-0.04,-0.07,0.06,start,end);
      ground('#c2c4be',rail-0.04,rail+0.04,0.065,start,end);
    }
    ground('#a6a8a1',x+1.20,x+1.32,0.12,start,end);
  }
  if (!tunnel) {
    for (let block=Math.floor(start/35)*35; block<end; block+=35) {
      if (!edge?.isFlyover && path.at(block+17.5).elevation<3.5) continue;
      for (const x of [-2.6,right]) {
        side('#87918f',x,-1.35,0.14,block,block+35);
        side('#b0b8b1',x,0.74,0.84,block,block+35);
        for (let z=block; z<block+35; z+=7) side('#899491',x,0.1,0.75,z,z+0.12);
      }
    }
  }
  for (const [node, stopZ] of [[here, 0], [next, length]] as const) {
    if (!node || node.type !== 'platform' || Math.abs(stopZ - travel) > 150) continue;
    const stationLength = (STATION_MAP[node.stationId ?? '']?.maxCars ?? 3) * 30;
    const high = stopZ + 5, low = high - stationLength;
    // The near platform puts the spectator at platform level as the unit passes.
    ground('#99958e', -18, -1.78, 0.86, low, high);
    ground('#e1be78', -1.99, -1.86, 0.88, low, high);
    for (let z = low; z < high; z += 4) ground('#787771', -18, -2.0, 0.87, z, z+0.035);
    modelX = parallel ? 4.8 : 0;
    ground('#b0ada2', 1.7, 3.22, 0.9, low, high);
    side('#73787c', 1.7, 0, 0.9, low, high);
    ground('#edd084', 1.77, 1.87, 0.92, low, high);
    for (let z = low+3; z < high; z += 12) side('#407579', 3, 0.9, 3.7, z, z+0.2);
    ground('#60868a', 1.78, 3.45, 3.7, low+2, high-4);
    side('#31575f', 1.78, 3.55, 3.72, low+2, high-4);
    const stop = STATION_MAP[node.stationId ?? ''];
    const stationName = stop?.name ?? node.name;
    for (const z of [low+9, stopZ+2]) {
      side('#38515a', 3, 0.9, 2.9, z, z+0.18);
      nameboard(stationName, [3, 3.1, z], Math.min(6, 2+stationName.length*0.18));
    }
    // Benches, platform lights and waiting passengers give the stop a sense of scale.
    for (const z of [low+19, low+43]) {
      side('#266266', 2.55, 1.25, 1.42, z, z+2.4);
      side('#437e81', 2.83, 1.42, 1.83, z, z+2.4);
      for (const base of [z+0.2, z+2]) side('#34464c', 2.65, 0.9, 1.25, base, base+0.12);
    }
    for (const z of [low+2, high-1]) {
      side('#51616a', 2.8, 0.9, 4.7, z, z+0.17);
      ground('#e0d8a8', 2.45, 3.1, 4.7, z-0.5, z+0.65);
      lamp('warm',[2.75,4.7,z],1.1);
    }
    // Positions are tied to the platform, including while the train approaches
    // from an edge whose nearer station still has a different name.
    const platformSeed = [...node.id].reduce((n,c) => (n*31+c.charCodeAt(0)) >>> 0, 0);
    const otherRoad = node.stationId + (node.direction === 'UP' ? '_DN' : '_UP');
    const figures = (id: string) => Math.min(90, Math.ceil(sim.platformWaiting(id) / 3));
    const nearCount = figures(node.id);
    const count = nearCount + (parallel ? figures(otherRoad) : 0);
    const people = Array.from({length:count}, (_,i) => {
      const z = i === 0 ? high-1.1 : high-2-((platformSeed%11+i*17)%(stationLength-4));
      const sprite = passengerSprite((platformSeed%12+i)%12);
      const lateral = i < nearCount ? -2.1-modelX-(i%5)*0.32 : 2.1+(i%4)*0.24;
      const [x,y,d] = toCamera([lateral,0.9,z]);
      return {x,y,d,sprite,i};
    }).sort((a,b) => b.d-a.d);
    ctx.imageSmoothingEnabled = false;
    for (const {x,y,d,sprite,i} of people) {
      if (d < 1 || d > 95) continue;
      const h = Math.max(2,Math.round((1.58+0.08*(i%4))*lens/d));
      const w = Math.max(1,Math.round(h*0.48));
      ctx.drawImage(sprite,Math.round(width/2+lens*x/d-w/2),Math.round(horizon-lens*y/d)-h,w,h);
    }
    // A taller totem remains visible above the roof from the opposite platform.
    side('#32555e', 3.1, 0.9, 4.9, stopZ+1, stopZ+1.22);
    nameboard(stationName, [3.1, 5.2, stopZ+1], stop?.interchange ? 5.8 : Math.min(6, 2+stationName.length*0.18), stop?.interchange);
    modelX = 0;
  }
  function drawTrain(train: Train, origin: number, trackX: number, direction: number) {
    sceneryDirection = cameraX > trackX ? -1 : 1;
    modelX = trackX;
    modelZ = origin;
    modelDirection = direction;
    const localCameraZ = (cameraZ - origin) * direction;
    const absoluteEyeHeight = eye.elevation+cameraY;
    // Detail the visible side of each articulated car and its raked cab end.
    const cars = Array.from({length: train.cars * 2}, (_, i) => -i * 15);
    cars.sort((a,b) => Math.abs(b-7.5-localCameraZ)-Math.abs(a-7.5-localCameraZ));
    for (const nose of cars) {
      const tail = nose-14.65;
      side('#28343e', -1.12, 0.17, 0.65, tail+1, nose-1);
      for (const z of [tail+2, nose-3.5]) {
        side('#1e2830', -1.23, 0.10, 0.62, z, z+1.6);
      }
      side('#d9d6bd', -1.34, 0.6, 3.18, tail+0.4, nose-0.55);
      face('#be353d', [-1.34,.6,nose-.55], [-1.34,3.18,nose-.55], [-1.34,.6,nose]);
      face('#be353d', [-1.34,.6,tail], [-1.34,3.18,tail+.4], [-1.34,.6,tail+.4]);
      if (nose < 0) side('#353b45', -1.14, 0.8, 2.95, nose-0.1, nose+0.9);
      side('#ca363d', -1.35, 0.62, 1.16, tail+0.4, nose-0.55);
      side('#00858d', -1.35, 1.16, 1.43, tail+0.4, nose-0.55);
      for (let z = tail+1; z < nose-1.6; z += 2.1) {
        side('#203a49', -1.36, 1.62, 2.87, z, z+1.65);
        if (tunnel || light.lamps > 0.2) {
          side('#edd3a0',-1.37,1.76,2.75,z+0.08,z+1.58);
          side('#4c5c62',-1.38,1.76,2.12,z+0.2,z+0.68);
        } else side('#678b96', -1.37, 2.51, 2.84, z+0.08, z+1.58);
      }
      for (const z of [tail+4.7, tail+10.5]) {
        side('#ba3840', -1.38, 0.68, 2.99, z, z+1.45);
        side('#274251', -1.39, 1.69, 2.76, z+0.14, z+1.31);
        side('#582d39', -1.40, 0.68, 2.99, z+0.69, z+0.75);
      }
      if (absoluteEyeHeight > path.at(origin+(nose-7)*direction).elevation+3.18) {
        ground('#abb6b3', -1.34, 1.34, 3.18, tail+0.4, nose-0.55);
      }
      const frontFacing = localCameraZ >= nose;
      if (frontFacing || localCameraZ <= tail) {
        const z = frontFacing ? nose : tail, inset = frontFacing ? -0.55 : 0.4;
        if ((frontFacing && nose !== 0) || (!frontFacing && nose !== -(train.cars*2-1)*15)) {
          face('#37454a', [-1.25,.6,z],[1.25,.6,z],[1.25,3,z],[-1.25,3,z]);
          continue;
        }
        face('#b83239', [-1.34,.6,z],[1.34,.6,z],[1.34,3.18,z+inset],[-1.34,3.18,z+inset]);
        face('#233947', [-1.18,1.59,z+inset*0.36],[1.18,1.59,z+inset*0.36],[1.1,2.92,z+inset],[-1.1,2.92,z+inset]);
        if (frontFacing) {
          face('#15262c', [-.85,2.62,z+inset], [.85,2.62,z+inset], [.85,2.9,z+inset], [-.85,2.9,z+inset]);
          const [x,y,d] = toCamera([0,2.79,z+inset]);
          if (d > 1) {
            ctx.font = 'bold ' + Math.max(2,Math.round(0.28*lens/d)) + 'px monospace';
            ctx.fillStyle = '#f4bc6e';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(train.headcode, width/2+lens*x/d, horizon-lens*y/d, 1.7*lens/d);
          }
        }
        for (const x of [-1,0.72]) {
          face(frontFacing ? '#fff2bf' : '#fb5346',[x,1.11,z],[x+.28,1.11,z],[x+.28,1.29,z],[x,1.29,z]);
          lamp(frontFacing ? 'white' : 'red',[x+0.14,1.2,z],0.95,tunnel ? 1 : 0.3+0.7*light.lamps);
        }
      }
    }
  }
  if (fixed && mountEdge) {
    for (const branch of route.branches) {
      path = branch.path;
      for (const train of sim.trains) {
        if (train.currentEdgeId !== branch.edge.id) continue;
        const nose = train.edgeProgress*Math.max(120,branch.edge.lengthMeters);
        if (nose <= branch.length+train.cars*30) drawTrain(train,nose,0,1);
      }
    }
    path = route.main;
    for (const other of cameraTrains(sim,mountEdge,cameraZ)) {
      if (!route.branches.some(branch => branch.edge.id === other.unit.currentEdgeId)) {
        drawTrain(other.unit,other.nose,other.x,other.direction);
      }
    }
  } else if (!cab && subject) drawTrain(subject, travel, 0, 1);
  else for (const other of passing) drawTrain(other.unit, other.nose, 4.8, -1);
  if (cameraX >= 10 && !tunnel) {
    modelX = modelZ = 0;
    modelDirection = sceneryDirection = 1;
    entrances();
  }
  if (sun?.visible) {
    // Internal lens reflections sit on the line from the sun to the optical centre.
    const dx = width/2-sun.x, dy = height/2-sun.y;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(lampSprite('warm'),sun.x-25,sun.y-8,50,16);
    for (const [offset,radius,colour] of [[0.48,3,'#ffd59e'],[1.24,6,'#81bfbb'],[1.66,10,'#d4a781']] as const) {
      const x = sun.x+dx*offset, y = sun.y+dy*offset;
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = colour;
      ctx.beginPath();
      for (let k=0; k<6; k++) ctx.lineTo(x+radius*Math.cos(k*Math.PI/3),y+radius*Math.sin(k*Math.PI/3));
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  if (cab) {
    ctx.fillStyle = '#24343c';
    ctx.fillRect(0, 0, width, 5);
    faceWindowFrame(ctx);
  }
  return movingScenery;
}

function faceWindowFrame(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#24343c';
  ctx.beginPath();
  ctx.moveTo(0,0); ctx.lineTo(12,0); ctx.lineTo(5,190); ctx.lineTo(0,199); ctx.fill();
  ctx.beginPath(); ctx.moveTo(384,0); ctx.lineTo(372,0); ctx.lineTo(379,190); ctx.lineTo(384,199); ctx.fill();
  ctx.fillStyle = '#394952'; ctx.fillRect(0, 202, 384, 14);
  ctx.fillStyle = '#607077'; ctx.fillRect(0, 201, 384, 2);
}
