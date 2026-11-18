import type { LampColour } from './fleetLandscape';

// A repeatable day/night cycle for the shift clock. Times are art-directed for
// the simulator's dawn start; there is no calendar date or weather feed.
const stops = [
  { hour: 0, top: '#101a34', low: '#43536c', mist: '#3b4b60', stone: '#3b4148' },
  { hour: 4.5, top: '#252c50', low: '#655f79', mist: '#54576d', stone: '#484650' },
  { hour: 5.5, top: '#565477', low: '#ffaf70', mist: '#c39782', stone: '#7b695e' },
  { hour: 7.5, top: '#7094b2', low: '#ffda99', mist: '#bcada0', stone: '#897b69' },
  { hour: 11, top: '#669dbb', low: '#dce9e6', mist: '#afc6c9', stone: '#797b76' },
  { hour: 15, top: '#669dbb', low: '#dce9e6', mist: '#afc6c9', stone: '#797b76' },
  { hour: 17.5, top: '#7684a3', low: '#ffd38a', mist: '#c5ad97', stone: '#8a7969' },
  { hour: 18.75, top: '#615477', low: '#fc9a68', mist: '#ba8e88', stone: '#7d6561' },
  { hour: 20.5, top: '#252c50', low: '#6d697f', mist: '#5c5b70', stone: '#504c58' },
  { hour: 22, top: '#101a34', low: '#43536c', mist: '#3b4b60', stone: '#3b4148' },
  { hour: 24, top: '#101a34', low: '#43536c', mist: '#3b4b60', stone: '#3b4148' },
];

function mix(a: string, b: string, t: number) {
  let rgb = '#';
  for (const i of [1, 3, 5]) {
    const av = parseInt(a.slice(i,i+2),16), bv = parseInt(b.slice(i,i+2),16);
    rgb += Math.round(av+(bv-av)*t).toString(16).padStart(2,'0');
  }
  return rgb;
}

let lastMinute = -1;
let cached: ReturnType<typeof makeLight>;

export function daylight(seconds: number) {
  const minute = ((Math.floor(seconds/60) % 1440) + 1440) % 1440;
  if (minute !== lastMinute) {
    cached = makeLight(minute/60);
    lastMinute = minute;
  }
  return cached;
}

function makeLight(hour: number) {
  const index = stops.findIndex(s => s.hour > hour);
  const a = stops[index-1], b = stops[index];
  const t = (hour-a.hour) / (b.hour-a.hour);
  const phase = (hour-12.1)*2*Math.PI/24;
  const sunHeight = (Math.cos(phase)+0.22)/1.22;
  const exposure = Math.max(0, Math.min(1, (sunHeight+0.16)*2));
  const warmth = Math.max(0, 1-Math.abs(sunHeight-0.13)*3.6);
  const shades = new Map<string,string>();
  function surface(base: string) {
    const cached = shades.get(base);
    if (cached) return cached;
    const warm = mix(base, '#ffc181', warmth*0.22);
    const result = mix(warm, '#0d1930', (1-exposure)*0.78);
    shades.set(base, result);
    return result;
  }
  return {
    surface, lamps: 1-exposure,
    top: mix(a.top,b.top,t), low: mix(a.low,b.low,t),
    mist: mix(a.mist,b.mist,t), stone: mix(a.stone,b.stone,t),
    sunHeight, sunBearing: (hour-6)*2*Math.PI/24,
  };
}


const lampSprites = new Map<LampColour, HTMLCanvasElement>();
const lampTints = { warm: '255,199,114', white: '210,238,255', red: '255,80,56', blue: '98,173,255' };

export function lampSprite(colour: LampColour) {
  let sprite = lampSprites.get(colour);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  const ctx = sprite.getContext('2d')!;
  const tint = lampTints[colour], glow = ctx.createRadialGradient(16,16,0,16,16,16);
  glow.addColorStop(0,'#fff7de');
  glow.addColorStop(0.12,'rgba('+tint+',0.92)');
  glow.addColorStop(0.36,'rgba('+tint+',0.27)');
  glow.addColorStop(1,'rgba('+tint+',0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0,0,32,32);
  ctx.fillStyle = 'rgba('+tint+',0.28)';
  ctx.fillRect(3,15.5,26,1);
  lampSprites.set(colour,sprite);
  return sprite;
}
