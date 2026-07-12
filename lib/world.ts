'use client';

import { Color, Vector3 } from 'three';
import { create } from 'zustand';

/* ------------------------------------------------------------------ */
/*  The living world — one mutable singleton advanced once per frame.  */
/*                                                                     */
/*  Everything environmental reads from WORLD inside useFrame: sun &   */
/*  moon position, light colors, fog, wind, cloud cover, mist, star    */
/*  visibility, lightning. No React state in the hot path — the        */
/*  singleton mutates and subscribers sample it, so a full day/night   */
/*  cycle with weather costs a handful of scalar ops per frame.        */
/* ------------------------------------------------------------------ */

export type WeatherKind = 'clear' | 'partly' | 'overcast' | 'mist' | 'fogbank' | 'storm';

/** One full day in seconds — long enough to feel ambient, short enough
 *  that a visitor exploring for a few minutes sees dusk fall. */
const CYCLE = 420;

/** Where the day starts for a fresh visitor: dramatic golden hour,
 *  matching the portfolio's signature look. */
const START_T = 0.71;

interface WeatherParams {
  cloud: number;      // 0..1 cloud cover
  mist: number;       // 0..1 ground fog
  sunMul: number;     // sunlight multiplier
  wind: number;       // base wind strength
  turbidity: number;  // sky haze
  lightning: boolean; // distant strikes allowed
}

const WEATHER: Record<WeatherKind, WeatherParams> = {
  clear:    { cloud: 0.12, mist: 0.06, sunMul: 1.0,  wind: 0.18, turbidity: 8,  lightning: false },
  partly:   { cloud: 0.42, mist: 0.1,  sunMul: 0.85, wind: 0.3,  turbidity: 10, lightning: false },
  overcast: { cloud: 0.88, mist: 0.16, sunMul: 0.45, wind: 0.34, turbidity: 16, lightning: false },
  mist:     { cloud: 0.28, mist: 0.72, sunMul: 0.6,  wind: 0.09, turbidity: 12, lightning: false },
  fogbank:  { cloud: 0.2,  mist: 1.0,  sunMul: 0.5,  wind: 0.05, turbidity: 14, lightning: false },
  storm:    { cloud: 1.0,  mist: 0.22, sunMul: 0.32, wind: 0.55, turbidity: 20, lightning: true },
};

export interface World {
  /** day phase 0..1 — 0 = midnight, 0.5 = noon */
  t: number;
  /** sun elevation -1..1 (0 = horizon) */
  elev: number;
  /** 0 night … 1 full day (smooth) */
  dayness: number;
  /** 1 when the sun sits low and warm — sunrise/sunset drama */
  golden: number;
  /** 0 day … 1 deep night */
  night: number;
  /** 1 around dusk & dawn — the firefly window */
  dusk: number;

  weather: WeatherKind;
  /** blended weather params (eased toward the active state) */
  cloud: number;
  mist: number;
  sunMul: number;
  turbidity: number;

  /** wind 0..1 — slow procedural drift + gust spikes */
  wind: number;
  /** fast gust component layered on top of wind */
  gust: number;

  /** 0..1 momentary flash envelope for distant lightning */
  lightning: number;
  /** world x the current strike came from — lights lean that way */
  lightningX: number;

  sunPos: Vector3;
  moonPos: Vector3;
  sunColor: Color;
  fogColor: Color;
  fogNear: number;
  fogFar: number;
  sunIntensity: number;
  moonIntensity: number;
  hemiIntensity: number;
  ambientIntensity: number;
  starOpacity: number;
  exposure: number;
}

export const WORLD: World = {
  t: START_T,
  elev: 0,
  dayness: 1,
  golden: 1,
  night: 0,
  dusk: 0,
  weather: 'clear',
  cloud: WEATHER.clear.cloud,
  mist: WEATHER.clear.mist,
  sunMul: 1,
  turbidity: 8,
  wind: 0.2,
  gust: 0,
  lightning: 0,
  lightningX: -30,
  sunPos: new Vector3(16, 6, -34),
  moonPos: new Vector3(-16, 20, -34),
  sunColor: new Color('#ffd9a0'),
  fogColor: new Color('#b3ac9a'),
  fogNear: 22,
  fogFar: 80,
  sunIntensity: 1.35,
  moonIntensity: 0,
  hemiIntensity: 0.38,
  ambientIntensity: 0.12,
  starOpacity: 0,
  exposure: 0.76,
};

/* React-facing snapshot — updated only when the label actually changes,
   so the HUD can show "WX: STORM FRONT · DUSK" without frame churn. */
export type DayPhase = 'dawn' | 'day' | 'golden hour' | 'dusk' | 'night';
export const useWorldMeta = create<{ weather: WeatherKind; phase: DayPhase }>(() => ({
  weather: 'clear',
  phase: 'golden hour',
}));

/* ---------------------------- helpers ----------------------------- */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// palette (preallocated — no per-frame GC)
const SUN_NOON = new Color('#fff3dd');
const SUN_GOLD = new Color('#ffcf8a');
const SUN_SET = new Color('#ff9a58');
const FOG_DAY = new Color('#b3ac9a');
const FOG_GOLD = new Color('#c7a583');
const FOG_NIGHT = new Color('#11151d');
const FOG_OVERCAST = new Color('#8f948c');
const FOG_MISTY = new Color('#a5a89a');
const tmpA = new Color();
const tmpB = new Color();

/* --------------------------- schedulers --------------------------- */

let weatherLeft = 50 + Math.random() * 60;
let strikeIn = 6 + Math.random() * 10;
let gustTarget = 0;
let gustLeft = 0;
let started = false;

function pickWeather(prev: WeatherKind, t: number): WeatherKind {
  // dawn strongly favors mist; otherwise a natural, mostly-pleasant mix
  const dawn = t > 0.2 && t < 0.34;
  const pool: [WeatherKind, number][] = [
    ['clear', 0.3],
    ['partly', 0.24],
    ['overcast', 0.13],
    ['mist', dawn ? 0.32 : 0.07],
    ['fogbank', 0.06],
    ['storm', 0.12],
  ];
  const total = pool.reduce((s, [k, w]) => s + (k === prev ? 0 : w), 0);
  let roll = Math.random() * total;
  for (const [k, w] of pool) {
    if (k === prev) continue;
    roll -= w;
    if (roll <= 0) return k;
  }
  return 'clear';
}

/** Dev overrides: /?tod=0.9 pins the time of day, &wx=storm pins weather. */
function applyDevOverrides() {
  if (typeof window === 'undefined') return;
  const p = new URLSearchParams(window.location.search);
  const tod = parseFloat(p.get('tod') ?? '');
  if (!Number.isNaN(tod)) {
    WORLD.t = clamp01(tod);
    pinnedTime = true;
  }
  const wx = p.get('wx') as WeatherKind | null;
  if (wx && wx in WEATHER) {
    WORLD.weather = wx;
    pinnedWeather = true;
  }
}
let pinnedTime = false;
let pinnedWeather = false;

/* ---------------------------- advance ------------------------------ */

/** Advance the world by dt seconds. Call exactly once per frame. */
export function advanceWorld(dt: number, elapsed: number) {
  if (!started) {
    started = true;
    applyDevOverrides();
  }
  const w = WORLD;
  const step = Math.min(dt, 0.1); // rotation hiccups shouldn't jump the clock

  /* -- time of day -- */
  if (!pinnedTime) w.t = (w.t + step / CYCLE) % 1;
  const elev = Math.sin((w.t - 0.25) * Math.PI * 2); // -1..1, 0 at 6am/6pm
  w.elev = elev;
  w.dayness = smooth(-0.06, 0.22, elev);
  w.night = 1 - smooth(-0.16, 0.0, elev);
  w.golden = smooth(-0.04, 0.04, elev) * (1 - smooth(0.16, 0.36, elev));
  w.dusk = smooth(-0.22, -0.03, elev) * (1 - smooth(0.02, 0.14, elev));

  /* -- sun & moon tracks (kept behind the skyline like the original) -- */
  const az = (w.t - 0.5) * Math.PI * 1.5; // east → west across the back sky
  w.sunPos.set(Math.sin(az) * 24, elev * 26, -34 + Math.abs(Math.sin(az)) * -6);
  const mAz = az + Math.PI;
  const mElev = -elev;
  w.moonPos.set(Math.sin(mAz) * 24, Math.max(mElev * 24, 3), -36);

  /* -- weather state machine -- */
  if (!pinnedWeather) {
    weatherLeft -= step;
    if (weatherLeft <= 0) {
      w.weather = pickWeather(w.weather, w.t);
      weatherLeft = 45 + Math.random() * 75;
    }
  }
  const target = WEATHER[w.weather];
  const wk = Math.min(1, step / 7); // ~7s crossfades — weather rolls in, never pops
  w.cloud += (target.cloud - w.cloud) * wk;
  w.mist += (target.mist - w.mist) * wk;
  w.sunMul += (target.sunMul - w.sunMul) * wk;
  w.turbidity += (target.turbidity - w.turbidity) * wk;

  /* -- wind: layered slow sines + occasional gust envelopes -- */
  const drift =
    Math.sin(elapsed * 0.11 + 1.7) * 0.4 +
    Math.sin(elapsed * 0.043 + 0.6) * 0.35 +
    Math.sin(elapsed * 0.017) * 0.25;
  gustLeft -= step;
  if (gustLeft <= 0) {
    // most "gusts" are lulls; real gusts arrive every 15-40s
    gustTarget = Math.random() < 0.3 ? 0.5 + Math.random() * 0.5 : 0;
    gustLeft = gustTarget > 0 ? 2.5 + Math.random() * 3 : 8 + Math.random() * 20;
  }
  w.gust += (gustTarget - w.gust) * Math.min(1, step * 1.2);
  w.wind = clamp01(target.wind + drift * 0.18 + w.gust * 0.6);

  /* -- distant lightning (storm fronts only, cinematic, no rain) -- */
  if (target.lightning) {
    strikeIn -= step;
    if (strikeIn <= 0) {
      w.lightning = 1;
      w.lightningX = (Math.random() - 0.5) * 70;
      // occasional double strike, then a long cinematic pause
      strikeIn = Math.random() < 0.3 ? 0.25 + Math.random() * 0.3 : 9 + Math.random() * 22;
    }
  }
  w.lightning *= Math.exp(-step * 7); // sharp attack, fast decay
  if (w.lightning < 0.001) w.lightning = 0;

  /* -- lighting rig values -- */
  const clearSky = 1 - w.cloud * 0.85;
  w.sunIntensity = (0.05 + w.dayness * 1.35) * w.sunMul * (1 + w.golden * 0.25);
  tmpA.copy(SUN_NOON).lerp(SUN_GOLD, clamp01(w.golden + (1 - w.dayness) * 0.4));
  w.sunColor.copy(tmpA).lerp(SUN_SET, w.golden * 0.55);
  w.moonIntensity = w.night * 0.34 * (0.35 + clearSky * 0.65);
  w.hemiIntensity = 0.1 + w.dayness * 0.3;
  w.ambientIntensity = 0.045 + w.dayness * 0.085;
  w.starOpacity = w.night * clearSky;
  w.exposure = lerp(lerp(0.62, 0.76, w.dayness), 0.7, w.cloud * 0.4);

  /* -- fog -- */
  tmpA.copy(FOG_DAY).lerp(FOG_GOLD, w.golden);
  tmpA.lerp(FOG_NIGHT, w.night);
  tmpB.copy(FOG_OVERCAST).lerp(FOG_MISTY, w.mist);
  w.fogColor.copy(tmpA).lerp(tmpB, Math.max(w.cloud * 0.5, w.mist * 0.6) * w.dayness);
  w.fogNear = lerp(lerp(22, 9, w.mist), 16, w.night * 0.5);
  w.fogFar = lerp(lerp(80, 42, w.mist), 64, w.night * 0.5);

  /* -- publish coarse labels for the HUD (only on change) -- */
  const phase: DayPhase =
    w.night > 0.65 ? 'night'
    : w.dayness > 0.75 ? (w.golden > 0.3 ? 'golden hour' : 'day')
    : w.golden > 0.25 ? 'golden hour'
    : w.t < 0.5 ? 'dawn' : 'dusk';
  const meta = useWorldMeta.getState();
  if (meta.weather !== w.weather || meta.phase !== phase) {
    useWorldMeta.setState({ weather: w.weather, phase });
  }
}
