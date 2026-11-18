// Synthesized WebAudio Sound Engine for DLR IECC / SelTrac & Split-Flap Mechanical Clatter
class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Mechanical Solari Split-Flap clatter (burst of crisp low-pass filtered clicks)
  public playSplitFlap(flaps = 6) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < flaps; i++) {
      const t = now + i * (0.032 + Math.random() * 0.015);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190 + Math.random() * 120, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.022);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.024);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.025);
    }
  }

  // Crisp relay / button click for NX route setting
  public playRelayClick(high = false) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(high ? 880 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(high ? 1320 : 280, now + 0.045);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  // SelTrac Incident / Advisory Chime (Two-tone UK IECC / DLR control room alert)
  public playIncidentAlert(critical = false) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = critical ? [784, 587, 784] : [523.25, 659.25];
    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const t = now + idx * 0.14;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = critical ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.135);
    });
  }
}

export const soundEngine = new SoundEngine();
