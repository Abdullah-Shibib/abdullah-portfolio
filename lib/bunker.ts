import { Vector3 } from 'three';

/** A tiny secret only readable through the magnifying glass. */
export interface DetailSpot {
  id: string;
  /** world position of the fine print */
  pos: [number, number, number];
  title: string;
  lines: string[];
  level: 'surface' | 'bunker';
}

/**
 * Shared geometry contract for the survival bunker.
 * Bunker.tsx builds the world from these; CameraRig.tsx flies them.
 */

/** Where the hatch collar sits on the surface — left flank of the desk,
 *  far enough into frame that a curious visitor spots it from the room view. */
export const HATCH_POS: [number, number, number] = [-2.55, 0, -0.6];

/** Bunker floor level (world y). Ceiling is FLOOR_Y + ROOM_H. */
export const FLOOR_Y = -5.2;
export const ROOM_H = 2.7;

/** Interior footprint, centered roughly under the hatch.
 *  x: CX ± W/2, z: CZ ± D/2. The ladder drops from the hatch, which sits
 *  near the room's north-east corner so the space opens away from it. */
export const CX = -3.2;
export const CZ = -1.5;
export const ROOM_W = 6.2;
export const ROOM_D = 4.8;

/** The ladder runs from the hatch straight down to the floor. */
export const LADDER_X = HATCH_POS[0];
export const LADDER_Z = HATCH_POS[2];

/** Parked camera pose while inside — a standing view from beside the
 *  ladder, looking across the shelter. */
export const BUNKER_CAMERA = {
  position: new Vector3(-1.2, FLOOR_Y + 1.6, -0.55),
  target: new Vector3(-4.6, FLOOR_Y + 1.05, -2.7),
};

/** Descent path — camera waypoints from the room view down the shaft.
 *  Each leg is [position, target, duration s]. Ascent plays it backwards. */
export const DESCENT: { pos: [number, number, number]; tgt: [number, number, number]; dur: number }[] = [
  // step to the open hatch, looking down into it
  { pos: [HATCH_POS[0], 1.7, HATCH_POS[2] + 1.15], tgt: [HATCH_POS[0], -0.4, HATCH_POS[2]], dur: 1.15 },
  // drop into the shaft throat — darkness swallows the view
  { pos: [HATCH_POS[0], -0.85, HATCH_POS[2]], tgt: [HATCH_POS[0], -2.6, HATCH_POS[2] - 0.08], dur: 1.0 },
  // sliding down the ladder, shaft walls all around
  { pos: [HATCH_POS[0], -3.3, HATCH_POS[2]], tgt: [HATCH_POS[0], -5.0, HATCH_POS[2] - 0.25], dur: 0.9 },
  // land and turn into the room
  { pos: [BUNKER_CAMERA.position.x, BUNKER_CAMERA.position.y, BUNKER_CAMERA.position.z],
    tgt: [BUNKER_CAMERA.target.x, BUNKER_CAMERA.target.y, BUNKER_CAMERA.target.z], dur: 1.35 },
];
