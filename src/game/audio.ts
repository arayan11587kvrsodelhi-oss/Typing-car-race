type Sfx =
  | "key"
  | "error"
  | "word"
  | "sentence"
  | "perfect"
  | "nitro"
  | "nitroReady"
  | "combo"
  | "countdown"
  | "go"
  | "finish"
  | "dnf"
  | "overtake"
  | "overtaken"
  | "click"
  | "buy"
  | "denied";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private engineNodes: { osc1: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; wind: GainNode } | null = null;
  private lastKey = 0;
  muted = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterType: BiquadFilterType, f0: number, f1?: number, when = 0, q = 1) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  play(s: Sfx, value = 0) {
    if (!this.ctx || this.muted) return;
    switch (s) {
      case "key": {
        const now = performance.now();
        if (now - this.lastKey < 18) return;
        this.lastKey = now;
        this.noise(0.03, 0.18, "bandpass", 2600 + Math.random() * 1200, undefined, 0, 1.4);
        break;
      }
      case "error":
        this.tone(150, 0.2, "sawtooth", 0.12, 0, 80);
        this.noise(0.18, 0.2, "lowpass", 900, 200);
        break;
      case "word":
        this.tone(880, 0.07, "sine", 0.07);
        this.tone(1320, 0.1, "sine", 0.06, 0.05);
        break;
      case "sentence":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, "triangle", 0.09, i * 0.06));
        break;
      case "perfect":
        [659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.16, "triangle", 0.1, i * 0.06));
        this.noise(0.5, 0.08, "highpass", 4000, 8000, 0.1);
        break;
      case "nitroReady":
        this.tone(660, 0.1, "square", 0.05);
        this.tone(990, 0.18, "square", 0.05, 0.1);
        break;
      case "nitro":
        this.noise(0.9, 0.35, "bandpass", 200, 3200, 0, 0.8);
        this.tone(55, 0.35, "sine", 0.35, 0, 30);
        this.tone(220, 0.6, "sawtooth", 0.08, 0, 880);
        break;
      case "combo": {
        const base = 520 + value * 140;
        this.tone(base, 0.08, "square", 0.05);
        this.tone(base * 1.5, 0.14, "square", 0.05, 0.07);
        break;
      }
      case "countdown":
        this.tone(440, 0.14, "square", 0.08);
        break;
      case "go":
        this.tone(880, 0.45, "square", 0.1);
        this.noise(0.5, 0.15, "lowpass", 600, 100);
        break;
      case "finish":
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.1, i * 0.09));
        this.noise(1.2, 0.1, "highpass", 3000, 6000, 0.3);
        break;
      case "dnf":
        [440, 392, 330, 262].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.07, i * 0.18));
        break;
      case "overtake":
        this.noise(0.35, 0.22, "bandpass", 1800, 300, 0, 1.2);
        this.tone(660, 0.12, "sine", 0.06, 0.05, 990);
        break;
      case "overtaken":
        this.noise(0.3, 0.14, "bandpass", 400, 1500, 0, 1.2);
        break;
      case "click":
        this.tone(1400, 0.035, "sine", 0.06);
        break;
      case "buy":
        this.tone(1200, 0.08, "sine", 0.08);
        this.tone(1800, 0.14, "sine", 0.08, 0.07);
        break;
      case "denied":
        this.tone(200, 0.12, "square", 0.05);
        this.tone(160, 0.16, "square", 0.05, 0.1);
        break;
    }
  }

  startEngine() {
    if (!this.ctx || !this.master || this.engineNodes || !this.noiseBuf) return;
    const c = this.ctx;
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    osc1.type = "sawtooth";
    osc2.type = "square";
    osc1.frequency.value = 45;
    osc2.frequency.value = 22;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    filter.Q.value = 2;
    const gain = c.createGain();
    gain.gain.value = 0;
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(this.master);
    osc1.start();
    osc2.start();
    // wind noise
    const wsrc = c.createBufferSource();
    wsrc.buffer = this.noiseBuf;
    wsrc.loop = true;
    const wf = c.createBiquadFilter();
    wf.type = "bandpass";
    wf.frequency.value = 700;
    wf.Q.value = 0.6;
    const wind = c.createGain();
    wind.gain.value = 0;
    wsrc.connect(wf).connect(wind).connect(this.master);
    wsrc.start();
    this.engineNodes = { osc1, osc2, filter, gain, wind };
  }

  setEngine(speedFactor: number, nitro: boolean, idle: boolean) {
    if (!this.engineNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const sf = Math.min(1.4, speedFactor);
    const f = (idle ? 38 : 42) + sf * 115 + (nitro ? 35 : 0);
    this.engineNodes.osc1.frequency.setTargetAtTime(f, t, 0.08);
    this.engineNodes.osc2.frequency.setTargetAtTime(f / 2, t, 0.08);
    this.engineNodes.filter.frequency.setTargetAtTime(350 + sf * 1900, t, 0.1);
    this.engineNodes.gain.gain.setTargetAtTime(idle ? 0.035 : 0.04 + sf * 0.055, t, 0.1);
    this.engineNodes.wind.gain.setTargetAtTime(sf * sf * 0.09, t, 0.15);
  }

  stopEngine() {
    if (!this.engineNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.engineNodes;
    n.gain.gain.setTargetAtTime(0, t, 0.08);
    n.wind.gain.setTargetAtTime(0, t, 0.08);
    setTimeout(() => {
      try {
        n.osc1.stop();
        n.osc2.stop();
      } catch {
        /* already stopped */
      }
    }, 400);
    this.engineNodes = null;
  }
}

export const audio = new AudioEngine();
