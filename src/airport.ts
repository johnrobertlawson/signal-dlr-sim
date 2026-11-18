// Fictional operating day. Times are absolute simulator seconds, including across midnight.
const DAY = 86400;
const routes = ['Edinburgh', 'Amsterdam', 'Dublin', 'Zurich', 'Glasgow', 'Frankfurt', 'Belfast', 'Luxembourg'];
export interface Flight {
  number: string;
  city: string;
  inbound: boolean;
  scheduled: number;
  expected: number;
  open: number;
  close: number;
  railPassengers: number;
}
export const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
export function dayAt(startDay: string, time: number) {
  return dayNames[(dayNames.indexOf(startDay) + Math.floor(time / DAY)) % 7];
}

export class Airport {
  flights: Flight[] = [];
  private day = -1;
  constructor(private startDay: string, now: number) { this.advance(now); }

  advance(now: number) {
    const today = Math.floor(now / DAY);
    if (today === this.day) return;
    this.flights = this.flights.filter(f => f.scheduled >= today * DAY - 3600);
    for (let d = Math.max(today, this.day < 0 ? today : this.day + 2); d <= today + 1; d++) {
      const day = dayAt(this.startDay, d * DAY);
      const first = d * DAY + (day === 'SUN' ? 12.5 : 6.5) * 3600;
      const close = d * DAY + (day === 'SAT' ? 13 : 22.5) * 3600;
      let slot = 0;
      for (let scheduled = first + 10; scheduled < close - 1800; scheduled += 300, slot++) {
        const route = (Math.floor(slot / 2) + (slot % 2) * 3 + d) % routes.length;
        this.flights.push({ number: 'LC' + (200 + slot), city: routes[route], inbound: slot % 2 === 0,
          scheduled, expected: scheduled, open: first, close, railPassengers: 38 + (slot * 13 % 44) });
      }
    }
    this.day = today;
  }

  // A shared runway hold retimes the bank, then releases one aircraft every 90 seconds.
  private pending(now: number) {
    return this.flights.filter(f => f.expected > now + 45 && Number.isFinite(f.expected) && f.scheduled < (this.day + 1) * DAY);
  }

  canDelay(now: number) {
    const first = this.pending(now)[0];
    return !!first && first.expected - now <= 1800 && first.expected === first.scheduled;
  }

  delayBank(now: number) {
    if (!this.canDelay(now)) return false;
    const pending = this.pending(now);
    let nextSlot = pending[0].expected + 15 * 60;
    for (const flight of pending) {
      if (flight.expected >= nextSlot) break;
      flight.expected = nextSlot >= flight.close ? Infinity : nextSlot;
      nextSlot += 90;
    }
    return true;
  }

  movement(now: number) {
    // Landing/takeoff occurs in the middle of a 70-second camera pass.
    return this.flights.find(f => Math.abs(now - f.expected) <= 35 && now >= f.open && now < f.close);
  }

  railFlows(from: number, to: number) {
    let arrivals = 0, departures = 0;
    for (const f of this.flights) {
      if (!Number.isFinite(f.expected)) continue;
      // Baggage reclaim and the walk to the DLR spread each arriving group over four minutes.
      const start = f.inbound ? f.expected + 240 : f.scheduled - 75 * 60;
      const duration = f.inbound ? 240 : 30 * 60;
      const overlap = Math.min(to, start + duration) - Math.max(from, start);
      if (overlap > 0) {
        const passengers = f.railPassengers * overlap / duration;
        if (f.inbound) arrivals += passengers;
        else departures += passengers;
      }
    }
    return { arrivals, departures };
  }

  board(now: number) {
    const visible = this.flights.filter(f => (Number.isFinite(f.expected) ? f.expected : f.scheduled) >= now - 120);
    return [true, false].flatMap(inbound => visible.filter(f => f.inbound === inbound).slice(0, 3));
  }
}
