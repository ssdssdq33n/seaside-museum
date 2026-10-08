// ---------------------------------------------------------------------------
//  Procedural ambient soundscape (Web Audio) — gentle ocean waves + a soft
//  warm pad. No audio files; synthesised so it works offline. Must be started
//  from a user gesture (the "Bước vào" button).
// ---------------------------------------------------------------------------

export class Ambient {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.started = false;
  }

  _buildOcean() {
    const ctx = this.ctx;
    // brown-ish noise buffer (looping)
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    lp.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.value = 0.22;

    // slow "wave swell" LFO on the gain
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.14;
    lfo.connect(lfoGain).connect(gain.gain);

    src.connect(lp).connect(gain).connect(this.master);
    src.start();
    lfo.start();
  }

  _buildPad() {
    const ctx = this.ctx;
    // soft, airy chord (A2 / E3 / C#4 / A4) — calm, major
    const freqs = [110, 164.81, 277.18, 440];
    const pad = ctx.createGain();
    pad.gain.value = 0.05;
    pad.connect(this.master);

    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 4;
      const g = ctx.createGain();
      g.gain.value = 0.25 / (i + 1);
      // gentle tremolo, each voice a little different
      const trem = ctx.createOscillator();
      trem.frequency.value = 0.05 + i * 0.013;
      const tremG = ctx.createGain();
      tremG.gain.value = 0.12;
      trem.connect(tremG).connect(g.gain);
      o.connect(g).connect(pad);
      o.start();
      trem.start();
    });
  }

  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(this.ctx.destination);
    this._buildOcean();
    this._buildPad();
    this.started = true;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.linearRampToValueAtTime(this.enabled ? 0.9 : 0, t + 0.4);
      if (this.ctx.state === "suspended" && this.enabled) this.ctx.resume();
    }
    return this.enabled;
  }
}
