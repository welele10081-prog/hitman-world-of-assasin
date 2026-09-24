// Fully synthesized audio (WebAudio): SFX, ambience, generative piano and tension music.
export class Audio {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.8;
    this.pianoTimer = 0;
    this.clinkTimer = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    // shared noise
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._ambience();
    this._music();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  _noiseSrc(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  _ambience() {
    const ctx = this.ctx;
    // party murmur
    const murmur = this._noiseSrc(true);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 0.7;
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'peaking';
    bp2.frequency.value = 900;
    bp2.gain.value = 6;
    this.murmurGain = ctx.createGain();
    this.murmurGain.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.37;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);
    lfo.start();
    murmur.connect(bp);
    bp.connect(bp2);
    bp2.connect(this.murmurGain);
    this.murmurGain.connect(this.master);
    murmur.start();
    // lake waves
    const waves = this._noiseSrc(true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    this.waveGain = ctx.createGain();
    this.waveGain.gain.value = 0;
    const wlfo = ctx.createOscillator();
    wlfo.frequency.value = 0.12;
    const wlfoGain = ctx.createGain();
    wlfoGain.gain.value = 0.04;
    wlfo.connect(wlfoGain);
    wlfoGain.connect(this.waveGain.gain);
    wlfo.start();
    waves.connect(lp);
    lp.connect(this.waveGain);
    this.waveGain.connect(this.master);
    waves.start();
  }

  _music() {
    const ctx = this.ctx;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    lp.Q.value = 2;
    this.musicFilter = lp;
    lp.connect(this.musicGain);
    this.musicGain.connect(this.master);
    this.voices = [];
    const freqs = [55, 82.41, 110, 130.81];
    for (const f of freqs) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0.12;
        o.connect(g);
        g.connect(lp);
        o.start();
        this.voices.push(o);
      }
    }
    this.chordIndex = 0;
    this.chordTimer = 0;
    // pulse for combat
    this.pulse = ctx.createOscillator();
    this.pulse.frequency.value = 2.2;
    this.pulseGain = ctx.createGain();
    this.pulseGain.gain.value = 0;
    this.pulse.connect(this.pulseGain);
    this.pulseGain.connect(this.musicGain.gain);
    this.pulse.start();
  }

  _envGain(t0, attack, decay, peak) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    return g;
  }

  _spatial(pos, vol) {
    const cam = this.game.cameraRig?.camera;
    if (!pos || !cam) return { gain: vol, pan: 0 };
    const dx = pos.x - cam.position.x;
    const dz = pos.z - cam.position.z;
    const d = Math.hypot(dx, dz);
    const att = Math.pow(Math.max(0, 1 - d / 45), 1.6);
    const yaw = this.game.cameraRig.yaw;
    const rightX = -Math.cos(yaw);
    const rightZ = Math.sin(yaw);
    const pan = d > 0.1 ? Math.max(-1, Math.min(1, ((dx * rightX + dz * rightZ) / d) * 0.8)) : 0;
    return { gain: vol * att, pan };
  }

  play(name, pos = null, vol = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const { gain, pan } = this._spatial(pos, vol);
    if (gain < 0.005) return;
    const out = ctx.createGain();
    out.gain.value = gain;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner);
    panner.connect(this.sfx);
    const t = ctx.currentTime;
    const noise = (dur, type, freq, q, peak, attack = 0.002) => {
      const s = this._noiseSrc();
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = this._envGain(t, attack, dur, peak);
      s.connect(f);
      f.connect(g);
      g.connect(out);
      s.start(t, Math.random());
      s.stop(t + dur + attack + 0.05);
      return f;
    };
    const tone = (type, f0, f1, dur, peak, delay = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + delay);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + delay + dur);
      const g = this._envGain(t + delay, 0.004, dur, peak);
      o.connect(g);
      g.connect(out);
      o.start(t + delay);
      o.stop(t + delay + dur + 0.05);
    };
    switch (name) {
      case 'shotSilenced':
        noise(0.09, 'bandpass', 1400, 1.2, 0.5);
        tone('sine', 160, 50, 0.12, 0.5);
        tone('square', 2400, 1800, 0.02, 0.08);
        break;
      case 'shot':
        noise(0.35, 'lowpass', 2600, 0.7, 1.0);
        tone('sine', 110, 35, 0.3, 0.9);
        break;
      case 'door':
        tone('sine', 190, 120, 0.3, 0.12);
        noise(0.05, 'bandpass', 900, 2, 0.15);
        break;
      case 'punch':
        noise(0.06, 'lowpass', 700, 1, 0.6);
        tone('sine', 110, 50, 0.12, 0.6);
        break;
      case 'bodyfall':
        noise(0.18, 'lowpass', 380, 1, 0.7);
        tone('sine', 70, 35, 0.2, 0.5);
        break;
      case 'coin':
        tone('sine', 2600, 2500, 0.18, 0.18);
        tone('sine', 3400, 3300, 0.12, 0.1, 0.02);
        tone('sine', 2600, 2500, 0.1, 0.1, 0.16);
        tone('sine', 2600, 2500, 0.06, 0.06, 0.27);
        break;
      case 'clank':
        tone('square', 520, 380, 0.12, 0.12);
        noise(0.12, 'highpass', 2500, 1, 0.3);
        break;
      case 'glass':
        noise(0.45, 'highpass', 3200, 0.8, 0.6);
        for (let i = 0; i < 5; i++) tone('sine', 3000 + Math.random() * 3000, 2500, 0.15, 0.06, Math.random() * 0.2);
        break;
      case 'splash':
        noise(0.9, 'lowpass', 1400, 0.6, 0.8, 0.04);
        noise(0.4, 'bandpass', 3000, 1, 0.3, 0.02);
        break;
      case 'throw':
        noise(0.2, 'bandpass', 900, 3, 0.2, 0.05);
        break;
      case 'hit':
        tone('sine', 150, 60, 0.2, 0.7);
        noise(0.1, 'lowpass', 900, 1, 0.4);
        break;
      case 'pickup':
        tone('sine', 880, 1320, 0.1, 0.15);
        break;
      case 'ui':
        tone('sine', 660, 660, 0.06, 0.08);
        break;
      case 'notice':
        tone('sine', 520, 780, 0.25, 0.08);
        break;
      case 'spotted':
        tone('sawtooth', 220, 210, 0.6, 0.18);
        tone('sawtooth', 233, 225, 0.6, 0.18);
        tone('sawtooth', 110, 105, 0.8, 0.2);
        break;
      case 'objective':
        tone('sine', 523, 523, 0.5, 0.14);
        tone('sine', 659, 659, 0.5, 0.12, 0.12);
        tone('sine', 784, 784, 0.7, 0.12, 0.24);
        break;
      case 'target':
        tone('sine', 196, 196, 1.2, 0.2);
        tone('sine', 293, 293, 1.2, 0.15, 0.05);
        tone('sine', 392, 392, 1.6, 0.12, 0.1);
        break;
      case 'piano': {
        const f = vol;
        out.gain.value = 1;
        const { gain: g2 } = this._spatial(pos, 0.1);
        out.gain.value = g2;
        tone('triangle', f, f, 1.6, 0.5);
        tone('sine', f * 2, f * 2, 1.0, 0.18);
        break;
      }
      case 'clink':
        tone('sine', 3800 + Math.random() * 800, 3600, 0.12, 0.05);
        break;
      default:
        break;
    }
  }

  update(dt) {
    if (!this.ctx) return;
    const game = this.game;
    const p = game.player?.pos;
    if (!p) return;
    // murmur near the party areas
    const party = [{ x: 1, z: -4 }, { x: 1, z: 11 }, { x: -14, z: -8 }];
    let near = 99;
    for (const q of party) near = Math.min(near, Math.hypot(p.x - q.x, p.z - q.z));
    const m = Math.max(0, 1 - near / 28) * 0.05;
    this.murmurGain.gain.setTargetAtTime(m, this.ctx.currentTime, 0.5);
    const lake = Math.max(0, 1 - Math.max(0, 26 - p.z) / 35) * 0.09;
    this.waveGain.gain.setTargetAtTime(0.02 + lake, this.ctx.currentTime, 0.5);

    // generative piano from the grand hall
    const pianist = game.npcs.find((n) => n.def.key === 'pianist');
    if (pianist && !pianist.isDown && pianist.state === 'routine') {
      this.pianoTimer -= dt;
      if (this.pianoTimer <= 0) {
        const scale = [261.6, 293.7, 311.1, 349.2, 392, 415.3, 466.2, 523.3];
        this.pianoTimer = 0.35 + Math.random() * 0.5;
        const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 0.5 : 1);
        this.play('piano', pianist.pos, f);
        if (Math.random() < 0.3) this.play('piano', pianist.pos, f * 0.75);
      }
    }
    this.clinkTimer -= dt;
    if (this.clinkTimer <= 0) {
      this.clinkTimer = 0.8 + Math.random() * 2.5;
      if (near < 14) this.play('clink', { x: p.x + (Math.random() - 0.5) * 8, z: p.z + (Math.random() - 0.5) * 8 }, 0.5);
    }

    // tension music follows the alert level
    const lvl = game.alert.level;
    const target = lvl === 'combat' ? 0.11 : lvl === 'search' ? 0.08 : game.player.trespassing ? 0.06 : 0.04;
    this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 1.2);
    this.pulseGain.gain.setTargetAtTime(lvl === 'combat' ? 0.05 : 0, this.ctx.currentTime, 0.4);
    this.musicFilter.frequency.setTargetAtTime(lvl === 'combat' ? 1400 : lvl === 'search' ? 900 : 480, this.ctx.currentTime, 1);
    this.chordTimer -= dt;
    if (this.chordTimer <= 0) {
      this.chordTimer = 9;
      const chords = [
        [55, 82.41, 110, 130.81],
        [49, 73.42, 98, 123.47],
        [43.65, 65.41, 87.31, 110],
        [51.91, 77.78, 103.83, 123.47],
      ];
      this.chordIndex = (this.chordIndex + 1) % chords.length;
      const ch = chords[this.chordIndex];
      this.voices.forEach((o, i) => o.frequency.setTargetAtTime(ch[Math.floor(i / 2)], this.ctx.currentTime, 2));
    }
  }
}
