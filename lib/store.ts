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

  focus: (id: MonitorId | null) => void;
  setTransitioning: (v: boolean) => void;
  setPanelOpen: (v: boolean) => void;
  setHint: (h: string | null) => void;
  setBooted: () => void;
}

export const useCommandCenter = create<CommandCenterState>((set) => ({
  focused: null,
  transitioning: false,
  panelOpen: false,
  hint: null,
  booted: false,

  focus: (id) => set({ focused: id, panelOpen: false, hint: null }),
  setTransitioning: (v) => set({ transitioning: v }),
  setPanelOpen: (v) => set({ panelOpen: v }),
  setHint: (h) => set({ hint: h }),
  setBooted: () => set({ booted: true }),
}));
