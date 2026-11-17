// All sound is synthesized with WebAudio — no audio files. A tiny engine hum,
// a two-tone siren, a noise-burst gunshot, a thud, a chime, and a looping
// synthwave pad that plays a calm chord progression over the city.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.noiseBuffer = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // Reusable white-noise buffer for gunshots and crashes.
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Continuous engine voice, gain driven by speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();

    // Continuous two-tone siren voice, gain driven by police proximity.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 780;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  setEngine(speedRatio, driving) {
    if (!this.ctx) return;
    const target = driving ? 0.05 + speedRatio * 0.075 : 0.012;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + speedRatio * 165, this.ctx.currentTime, 0.1);
    this.engineFilter.frequency.setTargetAtTime(280 + speedRatio * 900, this.ctx.currentTime, 0.1);
  }

  setSiren(active, closeness) {
    if (!this.ctx) return;
    this.sirenOn = active;
    const target = active ? 0.02 + closeness * 0.05 : 0;
    this.sirenGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
    if (active) {
      const now = this.ctx.currentTime;
      const phase = Math.floor(now * 1.6) % 2 === 0 ? 780 : 1040;
      this.sirenOsc.frequency.setTargetAtTime(phase, now, 0.05);
    }
  }

  blip(freq, dur, type, vol, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 3000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  gunshot() {
    this.noiseBurst(0.14, 0.5, 4200);
    this.blip(160, 0.09, 'square', 0.22);
  }
  punch() {
    this.noiseBurst(0.09, 0.3, 500);
    this.blip(95, 0.1, 'sine', 0.35);
  }
  crash() {
    this.noiseBurst(0.3, 0.45, 900);
    this.blip(70, 0.25, 'sine', 0.3);
  }
  chime() {
    this.blip(660, 0.16, 'sine', 0.22);
    this.blip(880, 0.24, 'sine', 0.22, 0.12);
  }
  denied() {
    this.blip(180, 0.18, 'square', 0.15);
  }
  pickup() {
    this.blip(520, 0.1, 'triangle', 0.25);
    this.blip(780, 0.18, 'triangle', 0.25, 0.08);
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // Am – F – C – G, one soft pad chord per bar, plus a slow bass pulse.
    const chords = [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 261.63, 329.63],
      [196.0, 246.94, 293.66],
    ];
    const bass = [110, 87.31, 98, 98];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      const chord = chords[this.musicStep % chords.length];
      chord.forEach((freq) => this.blip(freq, 1.9, 'triangle', 0.045));
      this.blip(bass[this.musicStep % bass.length], 1.8, 'sine', 0.09);
      this.musicStep++;
    }, 1900);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
