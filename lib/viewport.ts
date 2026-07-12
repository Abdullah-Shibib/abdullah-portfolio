'use client';

import { create } from 'zustand';

/* ------------------------------------------------------------------ */
/*  Settled viewport state.                                            */
/*                                                                     */
/*  Mobile browsers report dimensions in several steps during an       */
/*  orientation change (iOS Safari can lag 300ms+ behind the rotate,   */
/*  Samsung Internet resizes twice as the URL bar collapses). Reading  */
/*  window.innerWidth at `orientationchange` time therefore lies.      */
/*                                                                     */
/*  This store samples the visual viewport until two consecutive       */
/*  readings agree, then publishes ONE settled update — so the camera  */
/*  rig, HUD, and panels each react exactly once per rotation instead  */
/*  of stuttering through every intermediate size.                     */
/* ------------------------------------------------------------------ */

export interface ViewportState {
  width: number;
  height: number;
  aspect: number;
  portrait: boolean;
  /** coarse pointer — phone or tablet */
  coarse: boolean;
  /** phone-ish: coarse pointer or narrow window */
  mobile: boolean;
  /** phone held sideways: coarse + landscape + short viewport */
  landscapePhone: boolean;
  /** bumps once per settled orientation flip — effect dependency hook */
  generation: number;
}

const isClient = typeof window !== 'undefined';

function sample(): Omit<ViewportState, 'generation'> {
  if (!isClient) {
    return { width: 1280, height: 800, aspect: 1.6, portrait: false, coarse: false, mobile: false, landscapePhone: false };
  }
  // visualViewport tracks the *visible* area (URL bars, keyboards) — the
  // honest number for layout; fall back to innerWidth for old browsers
  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  const height = Math.round(vv?.height ?? window.innerHeight);
  const portrait = height >= width;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
  const mobile = coarse || width < 700;
  return {
    width,
    height,
    aspect: width / Math.max(1, height),
    portrait,
    coarse,
    mobile,
    landscapePhone: coarse && !portrait && height < 560,
  };
}

/* The store must initialize IDENTICALLY on server and client — React
   hydrates against the server markup, and a client-side sample() here
   would flip landscape/mobile flags mid-hydration (React #418/#423).
   Real values arrive one microtask after mount via watchViewport(). */
const SSR_DEFAULTS: ViewportState = {
  width: 1280,
  height: 800,
  aspect: 1.6,
  portrait: false,
  coarse: false,
  mobile: false,
  landscapePhone: false,
  generation: 0,
};

export const useViewport = create<ViewportState>(() => SSR_DEFAULTS);

let watching = false;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

/** Re-sample until the browser stops changing its mind, then publish. */
function settle(attempt = 0) {
  const now = sample();
  const prev = useViewport.getState();
  const moved = now.width !== prev.width || now.height !== prev.height;

  if (moved) {
    const flipped = now.portrait !== prev.portrait;
    useViewport.setState({ ...now, generation: prev.generation + (flipped ? 1 : 0) });
  }

  // keep watching briefly — iOS settles late, Samsung resizes twice
  if (attempt < 12) {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => settle(attempt + 1), moved || attempt < 3 ? 100 : 250);
  }
}

/** Idempotent — call from any client component; listeners attach once. */
export function watchViewport() {
  if (!isClient || watching) return;
  watching = true;

  const kick = () => settle(0);
  window.addEventListener('resize', kick);
  window.addEventListener('orientationchange', kick);
  window.visualViewport?.addEventListener('resize', kick);
  // some Android browsers only report the final size after a repaint
  if (document.readyState === 'complete') kick();
  else window.addEventListener('load', kick, { once: true });
}
