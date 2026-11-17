// NEON HARBOR — synthesized WebAudio: engine, siren, pickup, punch, jingle. No files.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // engine hum
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    // siren (two-tone via LFO on frequency)
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 800;
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.frequency.value = 0.8;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 300;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  setEngine(speed01) {
    if (!this.ctx) return;
    this.engineOsc.frequency.value = 50 + speed01 * 160;
    this.engineGain.gain.value = 0.02 + speed01 * 0.05;
  }

  sirenStart() { if (this.ctx) this.sirenGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.2); }
  sirenStop() { if (this.ctx) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); }

  blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  pickup() { this.blip(880, 0.12); setTimeout(() => this.blip(1320, 0.15), 70); }
  punch() { this.blip(140, 0.12, 'square', 0.25); }
  crash() { this.blip(70, 0.25, 'sawtooth', 0.3); }

  jingle() {
    if (!this.ctx) return;
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.22), i * 110));
  }
}
