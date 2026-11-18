import type { Airport } from './airport';
import type { SceneryBrush } from './fleetLandscape';

// Both airport sections are measured towards Pontoon Dock. Keep one runway coordinate
// across the station boundary so cameras on different trains see the same movement.
export function drawAirportTraffic(airport: Airport, seconds: number, section: string, length: number, brush: SceneryBrush) {
  if (section !== 'LCA-PDK' && section !== 'KGV-LCA') return;
  const station = section === 'KGV-LCA' ? length : 0;
  const { face, lamp } = brush;
  const flight = airport.movement(seconds);
  if (flight) {
    const t = seconds - flight.expected;
    const z = station + 33 + t * 13;
    const h = 1.8 + Math.max(0, flight.inbound ? -t : t) * 1.55;
    const x = 33;
    face('#a6b4bb', [x,h,z+3],[x-12,h-0.3,z-5],[x-11,h,z-7],[x,h+0.6,z-1],[x+11,h,z-7],[x+12,h-0.3,z-5]);
    face('#e7e9df', [x,h+0.8,z+12],[x-1.5,h+2,z+8],[x-1.6,h+2,z-7],[x,h+1.2,z-12],
      [x+1.6,h+2,z-7],[x+1.5,h+2,z+8]);
    face('#becbd0',[x-1.5,h+2,z+8],[x,h+0.8,z+12],[x,h-0.3,z+7],[x,h-0.2,z-9],[x-1.6,h+2,z-7]);
    face('#b44641',[x,h+1,z-6],[x,h+6,z-10],[x,h+6,z-12],[x,h+1,z-11]);
    lamp('red',[x-12,h,z-5],0.8);
    lamp('white',[x,h+1,z+11],1);
  }
  // An occasional helicopter crosses the Royal Docks independently of the airline timetable.
  const hour = seconds % 86400 / 3600;
  const pass = seconds % 1380 - 790;
  if (hour < 7 || hour >= 20 || Math.abs(pass) > 30) return;
  const x = 64 - pass * 6, z = station + 75 + pass * 2, h = 27;
  face('#566e78',[x-4,h,z],[x-2,h+2,z],[x+1,h+2,z],[x+3,h+0.4,z],[x+2,h-1,z],[x-2,h-1,z]);
  face('#bf8a43',[x+2,h,z],[x+8,h+1.1,z],[x+8,h+2.8,z],[x+7,h+1.7,z],[x+2,h+0.8,z]);
  const angle = seconds * 12;
  const dx = 6 * Math.cos(angle), dz = 6 * Math.sin(angle);
  face('#47535c',[x-dx,h+2.6,z-dz],[x+dx,h+2.6,z+dz],[x+dx+0.4,h+2.6,z+dz-0.5],[x-dx+0.4,h+2.6,z-dz-0.5]);
}
