import { create } from 'zustand';
import { MonitorId, monitorById } from './data';

export type Location = 'surface' | 'bunker';

interface CommandCenterState {
  /** Monitor the camera is flying to / parked at (null = room view) */
  focused: MonitorId | null;
  /** true while GSAP is flying the camera */
  transitioning: boolean;
  /** true once the camera has arrived and the DOM panel should expand */
  panelOpen: boolean;
  /** short hover hint shown in the HUD footer */
  hint: string | null;
  /** intro boot sequence finished */
  booted: boolean;
  /** master power — the desk emergency switch controls every monitor */
  power: boolean;

  /** which level the visitor is on */
  location: Location;
  /** true while the camera is riding the hatch shaft between levels */
  traveling: boolean;
  /** master light-bar state + a version stamp so bars can follow the switch
   *  yet still be toggled individually afterwards */
  lightBarsOn: boolean;
  lightBarsN: number;

  focus: (id: MonitorId | null) => void;
  setTransitioning: (v: boolean) => void;
  setPanelOpen: (v: boolean) => void;
  setHint: (h: string | null) => void;
  setBooted: () => void;
  togglePower: () => void;
  travel: (to: Location) => void;
  setTraveling: (v: boolean) => void;
  toggleLightBars: () => void;
}

export const useCommandCenter = create<CommandCenterState>((set, get) => ({
  focused: null,
  transitioning: false,
  panelOpen: false,
  hint: null,
  booted: false,
  power: true,
  location: 'surface',
  traveling: false,
  lightBarsOn: false,
  lightBarsN: 0,

  focus: (id) => {
    // each monitor lives on one level — no jacking in through the floor
    if (id && (monitorById(id).level ?? 'surface') !== get().location) return;
    // dead monitors can't be jacked into — the switch must come back on first
    if (id && !get().power) {
      set({ hint: 'MAIN POWER OFFLINE — hit the red switch on the desk' });
      return;
    }
    set({ focused: id, panelOpen: false, hint: null });
  },
  setTransitioning: (v) => set({ transitioning: v }),
  setPanelOpen: (v) => set({ panelOpen: v }),
  setHint: (h) => set({ hint: h }),
  setBooted: () => set({ booted: true }),
  togglePower: () => {
    const next = !get().power;
    // killing the power while zoomed in kicks you back to the room
    set(next ? { power: next } : { power: next, focused: null, panelOpen: false });
  },
  travel: (to) => {
    const s = get();
    if (s.traveling || s.location === to) return;
    // close any panel before riding the hatch
    set({ location: to, traveling: true, focused: null, panelOpen: false, hint: null });
  },
  setTraveling: (v) => set({ traveling: v }),
  toggleLightBars: () => set({ lightBarsOn: !get().lightBarsOn, lightBarsN: get().lightBarsN + 1 }),
}));

// headless QA hook — lets the test harness read state without pixel-guessing
if (typeof window !== 'undefined') {
  (window as unknown as { __cc: typeof useCommandCenter }).__cc = useCommandCenter;
}
