// Aim for 30 fps while keeping the measured drawing time near or below a
// tenth of one main thread per visible camera. Smooth out individual GC pauses.
export class FleetFrameBudget {
  private meanDrawMs = 2;
  get intervalMs() { return Math.max(1000 / 30, this.meanDrawMs * 10); }

  record(start: number) {
    this.meanDrawMs += (performance.now() - start - this.meanDrawMs) * 0.15;
  }
}
