/**
 * Tiny procedural sound engine — no audio files, everything is synthesized
 * with WebAudio on demand. The context is created lazily on the first call,
 * which always happens inside a user gesture (a click), so autoplay policy
 * never blocks us. Every helper is safe to call on the server (no-ops).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Seconds of white noise as a reusable buffer. */
function noiseBuffer(a: AudioContext, seconds = 2) {
  const buf = a.createBuffer(1, a.sampleRate * seconds, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

interface NoiseOpts {
  dur: number;
  type: BiquadFilterType;
  freq: number;
  q?: number;
  gain: number;
  attack?: number;
  freqEnd?: number;
  when?: number;
}

/** Filtered noise burst with an attack/decay envelope. */
function noise(o: NoiseOpts) {
  const a = ac();
  if (!a || !master) return;
  const t0 = a.currentTime + (o.when ?? 0);
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, Math.max(1, o.dur + 0.1));
  const f = a.createBiquadFilter();
  f.type = o.type;
  f.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + o.dur);
  f.Q.value = o.q ?? 1;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + (o.attack ?? 0.02));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + o.dur + 0.1);
}

interface ToneOpts {
  freq: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  freqEnd?: number;
  when?: number;
  attack?: number;
}

function tone(o: ToneOpts) {
  const a = ac();
  if (!a || !master) return;
  const t0 = a.currentTime + (o.when ?? 0);
  const osc = a.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t0 + o.dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

/* ------------------------------------------------------------------ */
/*  One-shots.                                                         */
/* ------------------------------------------------------------------ */

/** Heavy steel unlatching — deep thud + metallic ring. */
export function playMetalClunk(when = 0) {
  tone({ freq: 68, freqEnd: 34, dur: 0.28, gain: 0.5, type: 'sine', when });
  tone({ freq: 415, freqEnd: 380, dur: 0.5, gain: 0.05, type: 'triangle', when: when + 0.015 });
  noise({ dur: 0.12, type: 'bandpass', freq: 1800, q: 1.4, gain: 0.18, when });
}

/** Hydraulic hatch swing — long pressurized hiss + servo groan. */
export function playHatchOpen() {
  playMetalClunk();
  // pressure release
  noise({ dur: 1.9, type: 'bandpass', freq: 2600, freqEnd: 900, q: 0.8, gain: 0.12, attack: 0.25 });
  // servo whine sinking as the lid comes over
  tone({ freq: 190, freqEnd: 82, dur: 1.7, gain: 0.045, type: 'sawtooth', when: 0.15, attack: 0.3 });
  // final seat
  playMetalClunk(1.85);
}

/** The lid coming back down — hiss first, thud last. */
export function playHatchClose() {
  noise({ dur: 1.4, type: 'bandpass', freq: 1400, freqEnd: 2400, q: 0.8, gain: 0.1, attack: 0.2 });
  tone({ freq: 90, freqEnd: 170, dur: 1.2, gain: 0.04, type: 'sawtooth', attack: 0.25 });
  playMetalClunk(1.3);
}

/** Two short warning beeps — the hatch's caution beacon. */
export function playWarningBeeps() {
  [0, 0.45].forEach((w) => tone({ freq: 660, dur: 0.16, gain: 0.06, type: 'square', when: w }));
}

/** Boots on ladder rungs, descending or climbing. */
export function playLadderSteps(count = 4, climbing = false) {
  for (let i = 0; i < count; i++) {
    const w = i * 0.32;
    tone({ freq: climbing ? 120 + i * 8 : 140 - i * 8, dur: 0.09, gain: 0.12, type: 'triangle', when: w });
    noise({ dur: 0.05, type: 'highpass', freq: 3000, gain: 0.04, when: w });
  }
}

/** Small industrial toggle — for switches and light bars. */
export function playSwitchClick(on = true) {
  tone({ freq: on ? 1200 : 800, dur: 0.03, gain: 0.1, type: 'square' });
  noise({ dur: 0.04, type: 'highpass', freq: 4000, gain: 0.08 });
}

/* ------------------------------------------------------------------ */
/*  Bunker ambience loop — generator hum + ventilation wash.           */
/* ------------------------------------------------------------------ */

let ambience: { stop: () => void } | null = null;

export function startBunkerAmbience() {
  const a = ac();
  if (!a || !master || ambience) return;

  const bus = a.createGain();
  bus.gain.setValueAtTime(0.0001, a.currentTime);
  bus.gain.exponentialRampToValueAtTime(1, a.currentTime + 2.5);
  bus.connect(master);

  // generator: low saw through a tight lowpass, gently wobbled
  const hum = a.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.value = 55;
  const humLp = a.createBiquadFilter();
  humLp.type = 'lowpass';
  humLp.frequency.value = 130;
  const humG = a.createGain();
  humG.gain.value = 0.05;
  const lfo = a.createOscillator();
  lfo.frequency.value = 0.7;
  const lfoG = a.createGain();
  lfoG.gain.value = 0.012;
  lfo.connect(lfoG).connect(humG.gain);
  hum.connect(humLp).connect(humG).connect(bus);

  // second partial gives the hum a mechanical edge
  const hum2 = a.createOscillator();
  hum2.type = 'triangle';
  hum2.frequency.value = 110.5; // slightly detuned against the 2nd harmonic
  const hum2G = a.createGain();
  hum2G.gain.value = 0.014;
  hum2.connect(hum2G).connect(bus);

  // ventilation: endless soft noise wash
  const vent = a.createBufferSource();
  vent.buffer = noiseBuffer(a, 4);
  vent.loop = true;
  const ventLp = a.createBiquadFilter();
  ventLp.type = 'lowpass';
  ventLp.frequency.value = 420;
  const ventG = a.createGain();
  ventG.gain.value = 0.02;
  vent.connect(ventLp).connect(ventG).connect(bus);

  hum.start();
  hum2.start();
  lfo.start();
  vent.start();

  ambience = {
    stop: () => {
      const t = a.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      setTimeout(() => {
        [hum, hum2, lfo, vent].forEach((n) => {
          try { n.stop(); } catch {}
        });
        bus.disconnect();
      }, 1400);
      ambience = null;
    },
  };
}

export function stopBunkerAmbience() {
  ambience?.stop();
}

/** Brief electrical crackle — pairs with a light flicker. */
export function playFlicker() {
  noise({ dur: 0.09, type: 'highpass', freq: 2500, gain: 0.05 });
  noise({ dur: 0.05, type: 'highpass', freq: 4000, gain: 0.04, when: 0.12 });
}
