import { create } from 'zustand';
import { MonitorId } from './data';

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

  focus: (id: MonitorId | null) => void;
  setTransitioning: (v: boolean) => void;
  setPanelOpen: (v: boolean) => void;
  setHint: (h: string | null) => void;
  setBooted: () => void;
  togglePower: () => void;
}

export const useCommandCenter = create<CommandCenterState>((set, get) => ({
  focused: null,
  transitioning: false,
  panelOpen: false,
  hint: null,
  booted: false,
  power: true,

  focus: (id) => {
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
}));
