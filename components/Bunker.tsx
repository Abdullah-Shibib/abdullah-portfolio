'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CatmullRomCurve3, Color, Group, InstancedMesh, MathUtils, Mesh, MeshBasicMaterial,
  Object3D, PointLight, Vector3,
} from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { useCommandCenter } from '@/lib/store';
import {
  playFlicker, playHatchClose, playHatchOpen, playLadderSteps, playSwitchClick,
  playWarningBeeps, startBunkerAmbience, stopBunkerAmbience,
} from '@/lib/audio';
import {
  CX, CZ, DetailSpot, FLOOR_Y, HATCH_POS, LADDER_X, LADDER_Z, ROOM_D, ROOM_H, ROOM_W,
} from '@/lib/bunker';
import {
  bunkerMap, concreteFloor, concreteWall, emergencyPoster, newspaperFront, stencilLabel,
} from '@/lib/bunkerTextures';
import { seeded } from '@/lib/data';

const dummy = new Object3D();

/* Room bounds, derived once from the shared contract. */
const X0 = CX - ROOM_W / 2;
const X1 = CX + ROOM_W / 2;
const Z0 = CZ - ROOM_D / 2;
const Z1 = CZ + ROOM_D / 2;
const CEIL_Y = FLOOR_Y + ROOM_H;

/* Palette — same muted world as upstairs. */
const OLIVE = { color: '#44522f', roughness: 0.9 };
const OLIVE2 = { color: '#4c5a34', roughness: 0.85, metalness: 0.15 };
const RUST = { color: '#7a4a2a', metalness: 0.3, roughness: 0.8 };
const STEEL = { color: '#3a3d3a', metalness: 0.6, roughness: 0.45 };
const STEEL_DARK = { color: '#2c2f2c', metalness: 0.6, roughness: 0.5 };
const CONCRETE = { color: '#6a6660', roughness: 1 };
const WOOD = { color: '#5a4a30', roughness: 0.9 };

const LENS_DIM = new Color('#38130d');
const LENS_HOT = new Color('#ff5238');
const BULB_WARM = new Color('#ffcf8a');
const FESTOON_WARM = new Color('#ffc070');

function useHoverCursor(label: string) {
  const setHint = useCommandCenter((s) => s.setHint);
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
      setHint(label);
    },
    onPointerOut: () => {
      document.body.style.cursor = 'auto';
      setHint(null);
    },
  };
}

/** Soft contact shadow — same trick the surface uses to ground props. */
function Blob({ x, z, r, o = 0.35, sx = 1 }: { x: number; z: number; r: number; o?: number; sx?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, z]} scale={[sx, 1, 1]}>
      <circleGeometry args={[r, 20]} />
      <meshBasicMaterial color="#000000" transparent opacity={o} depthWrite={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Fine print — readable only through the magnifying glass.           */
/* ------------------------------------------------------------------ */

export const BUNKER_DETAILS: DetailSpot[] = [
  {
    id: 'can-label',
    pos: [-5.85, -4.27, -2.55],
    title: 'CAN LABEL',
    lines: ['PORK & BEANS · PACKED 2027 · EXP 2032', 'someone re-inked the date by hand'],
    level: 'bunker',
  },
  {
    id: 'ration-stencil',
    pos: [-5.7, -4.78, -0.2],
    title: 'RATION CRATE',
    lines: ['MRE · MENU 12 · 24 MEALS', 'stamped CIVIL DEFENSE RESERVE', 'the tape has been cut and re-taped many times'],
    level: 'bunker',
  },
  {
    id: 'newspaper-front',
    pos: [-3.55, -4.32, -3.5],
    title: 'THE HERALD — FINAL EDITION',
    lines: ['GRID DOWN — CITY EVACUATES', 'authorities urge calm as the last trains leave', 'below the fold: a half-finished crossword'],
    level: 'bunker',
  },
  {
    id: 'wall-map',
    pos: [-6.16, -3.6, -1.5],
    title: 'REGIONAL MAP',
    lines: ['routes inked in red — the bridge crossing is circled twice', 'a pencil note beside it: "checkpoint gone. good."'],
    level: 'bunker',
  },
  {
    id: 'bench-note',
    pos: [-4.85, -4.32, -3.35],
    title: 'HANDWRITTEN NOTE',
    lines: ['day 847 — filters swapped, generator coil holding.', 'tell no one about the garden.'],
    level: 'bunker',
  },
  {
    id: 'first-aid',
    pos: [-5.89, -3.66, 0.1],
    title: 'FIRST AID KIT',
    lines: ['gauze, iodine, a suture kit still sealed', 'the aspirin bottle is down to three'],
    level: 'bunker',
  },
  {
    id: 'windup-clock',
    pos: [-3.35, -4.25, -3.62],
    title: 'WIND-UP CLOCK',
    lines: ["engraved: 'to A., for the long nights'", "it's still ticking"],
    level: 'bunker',
  },
];

/* ------------------------------------------------------------------ */
/*  Surface hatch — the way down, half-swallowed by the meadow.        */
/* ------------------------------------------------------------------ */

function SurfaceHatch() {
  const location = useCommandCenter((s) => s.location);
  const traveling = useCommandCenter((s) => s.traveling);
  const hover = useHoverCursor('EMERGENCY SHELTER — open the hatch and head below');

  const pivot = useRef<Group>(null);
  const wheel = useRef<Group>(null);
  const lens = useRef<MeshBasicMaterial>(null);
  const beam = useRef<PointLight>(null);
  const shaftLamp = useRef<MeshBasicMaterial>(null);
  const plateTex = useMemo(() => stencilLabel('SHELTER-07'), []);
  const shaftTex = useMemo(() => concreteWall(88), []);

  useFrame(({ clock }, dt) => {
    const open = location === 'bunker' || traveling;
    const target = open ? -1.95 : 0;
    if (pivot.current) {
      // heavy steel — eased swing, ~1.5 s to seat either way
      pivot.current.rotation.x = MathUtils.lerp(pivot.current.rotation.x, target, Math.min(1, dt * 2.1));
      if (wheel.current && Math.abs(pivot.current.rotation.x - target) > 0.03) {
        wheel.current.rotation.y += dt * 7;
      }
    }
    const pulse = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 9);
    // idle: a slow patient breath — enough to catch a curious eye from the desk
    const idle = 0.28 + 0.22 * Math.sin(clock.elapsedTime * 1.6);
    if (lens.current) lens.current.color.copy(LENS_DIM).lerp(LENS_HOT, traveling ? pulse : idle);
    if (beam.current) {
      // the actual light only exists while the beacon is doing its job
      beam.current.visible = traveling;
      beam.current.intensity = pulse * 1.4;
    }
    if (shaftLamp.current) shaftLamp.current.color.copy(LENS_DIM).lerp(LENS_HOT, traveling ? pulse : 0.18);
  });

  const sandbags: [number, number, number, number][] = [
    // x, z, yaw, tint index
    [-0.72, 0.42, 0.4, 0], [-0.6, 0.66, 1.2, 1], [0.55, 0.64, -0.5, 0],
    [0.74, 0.4, 0.9, 1], [0.1, 0.76, 0.2, 0],
  ];

  return (
    <group position={HATCH_POS}>
      <Blob x={0} z={0.05} r={0.95} o={0.3} />

      {/* everything clickable lives under this group */}
      <group
        {...hover}
        onClick={(e) => {
          e.stopPropagation();
          const s = useCommandCenter.getState();
          if (s.traveling) return;
          if (s.location === 'surface') {
            playHatchOpen();
            playWarningBeeps();
            s.travel('bunker');
          }
        }}
      >
        {/* the whole mound is the button — click anywhere near the hatch */}
        <mesh visible={false} position={[0, 0.55, 0]}>
          <boxGeometry args={[2.4, 1.5, 2.4]} />
        </mesh>

        {/* concrete collar — a ring of four weathered slabs */}
        {[[-0, -0.4625, 1.15, 0.225], [0, 0.4625, 1.15, 0.225]].map(([x, z, w, d], i) => (
          <mesh key={`ns${i}`} position={[x, 0.11, z]}>
            <boxGeometry args={[w, 0.22, d]} />
            <meshStandardMaterial {...CONCRETE} />
          </mesh>
        ))}
        {[-0.4625, 0.4625].map((x) => (
          <mesh key={`ew${x}`} position={[x, 0.11, 0]}>
            <boxGeometry args={[0.225, 0.22, 0.7]} />
            <meshStandardMaterial {...CONCRETE} />
          </mesh>
        ))}
        {/* chipped edge trim */}
        {[[-0.545, 0], [0.545, 0]].map(([x, z], i) => (
          <mesh key={`trimx${i}`} position={[x, 0.225, z]} rotation={[0, 0, i ? -0.02 : 0.02]}>
            <boxGeometry args={[0.05, 0.03, 1.1]} />
            <meshStandardMaterial color="#57534b" roughness={1} />
          </mesh>
        ))}
        {[[0, -0.545], [0, 0.545]].map(([x, z], i) => (
          <mesh key={`trimz${i}`} position={[x, 0.225, z]} rotation={[i ? 0.02 : -0.02, 0, 0]}>
            <boxGeometry args={[1.1, 0.03, 0.05]} />
            <meshStandardMaterial color="#57534b" roughness={1} />
          </mesh>
        ))}
        {/* hazard chevrons around the rim */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.sin(a) * 0.49, 0.226, Math.cos(a) * 0.49]}
              rotation={[-Math.PI / 2, 0, a + Math.PI / 4]}
            >
              <planeGeometry args={[0.09, 0.05]} />
              <meshStandardMaterial color={i % 2 ? '#8a7a3a' : '#33302a'} roughness={0.95} />
            </mesh>
          );
        })}
        {/* stenciled designation plate */}
        <mesh position={[0, 0.13, 0.578]}>
          <planeGeometry args={[0.36, 0.09]} />
          <meshStandardMaterial color="#4a4a44" metalness={0.5} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.13, 0.582]}>
          <planeGeometry args={[0.34, 0.085]} />
          <meshBasicMaterial map={plateTex} transparent toneMapped={false} />
        </mesh>

        {/* hinge lugs at the back edge */}
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} position={[x, 0.25, -0.44]}>
            <boxGeometry args={[0.06, 0.08, 0.1]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
        ))}

        {/* the lid, hinged at the back — swings up and over when open */}
        <group ref={pivot} position={[0, 0.26, -0.42]}>
          <group position={[0, 0, 0.42]}>
            <mesh>
              <cylinderGeometry args={[0.42, 0.42, 0.06, 24]} />
              <meshStandardMaterial {...OLIVE2} />
            </mesh>
            {/* worn steel rim where boots and years took the paint */}
            <mesh position={[0, 0.031, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.405, 0.012, 6, 28]} />
              <meshStandardMaterial color="#7a7466" metalness={0.7} roughness={0.4} />
            </mesh>
            {/* dark underside so the open lid doesn't flash daylight */}
            <mesh position={[0, -0.033, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.41, 24]} />
              <meshStandardMaterial color="#1c1e1a" roughness={0.9} />
            </mesh>
            {/* spoked wheel handle */}
            <group ref={wheel} position={[0, 0.06, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.16, 0.022, 8, 22]} />
                <meshStandardMaterial {...STEEL} />
              </mesh>
              {[0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => (
                <mesh key={a} rotation={[0, a, 0]}>
                  <boxGeometry args={[0.3, 0.018, 0.024]} />
                  <meshStandardMaterial {...STEEL} />
                </mesh>
              ))}
              <mesh>
                <cylinderGeometry args={[0.035, 0.04, 0.05, 10]} />
                <meshStandardMaterial {...STEEL_DARK} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* caged warning beacon on a stub post */}
      <group position={[0.74, 0, 0.3]}>
        <mesh position={[0, 0.21, 0]}>
          <cylinderGeometry args={[0.02, 0.026, 0.42, 8]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        <mesh position={[0, 0.44, 0]}>
          <sphereGeometry args={[0.038, 10, 10]} />
          <meshBasicMaterial ref={lens} color="#38130d" toneMapped={false} />
        </mesh>
        {[0, Math.PI / 2].map((a) => (
          <mesh key={a} position={[0, 0.44, 0]} rotation={[0, a, 0]}>
            <torusGeometry args={[0.052, 0.005, 5, 14]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
        ))}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.045, 0.052, 0.02, 10]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        <pointLight ref={beam} position={[0, 0.5, 0]} color="#ff5238" intensity={0.05} distance={3} decay={2} />
      </group>

      {/* sandbags and moss so the collar reads as part of the camp */}
      {sandbags.map(([x, z, ry, t], i) => (
        <mesh key={i} position={[x, 0.07, z]} rotation={[Math.PI / 2, 0, ry]}>
          <capsuleGeometry args={[0.08, 0.16, 4, 8]} />
          <meshStandardMaterial color={t ? '#6a5f42' : '#4c5a34'} roughness={1} />
        </mesh>
      ))}
      {[[-0.5, -0.45, 0.09], [0.42, -0.52, 0.07], [0.55, 0.18, 0.06]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, 0.222, z]} rotation={[-Math.PI / 2, 0, i]}>
          <circleGeometry args={[r, 10]} />
          <meshStandardMaterial color="#3d4a28" roughness={1} transparent opacity={0.85} />
        </mesh>
      ))}

      {/* ---- the shaft — concrete throat from the collar to the ceiling ---- */}
      <group>
        {[-0.42, 0.42].map((x) => (
          <mesh key={`sx${x}`} position={[x, -1.2, 0]}>
            <boxGeometry args={[0.14, 2.6, 0.84]} />
            <meshStandardMaterial map={shaftTex} color="#8a867e" roughness={1} />
          </mesh>
        ))}
        {[-0.42, 0.42].map((z) => (
          <mesh key={`sz${z}`} position={[0, -1.2, z]}>
            <boxGeometry args={[0.84, 2.6, 0.14]} />
            <meshStandardMaterial map={shaftTex} color="#8a867e" roughness={1} />
          </mesh>
        ))}
        {/* inner ribs every ~0.8 */}
        {[-0.55, -1.35, -2.15].map((y) => (
          <group key={y} position={[0, y, 0]}>
            {[-0.33, 0.33].map((x) => (
              <mesh key={`rx${x}`} position={[x, 0, 0]}>
                <boxGeometry args={[0.05, 0.06, 0.7]} />
                <meshStandardMaterial color="#57534b" roughness={1} />
              </mesh>
            ))}
            {[-0.33, 0.33].map((z) => (
              <mesh key={`rz${z}`} position={[0, 0, z]}>
                <boxGeometry args={[0.7, 0.06, 0.05]} />
                <meshStandardMaterial color="#57534b" roughness={1} />
              </mesh>
            ))}
          </group>
        ))}
        {/* red caged shaft light near the top — wakes up during travel */}
        <group position={[0.28, -0.4, 0.28]}>
          <mesh>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshBasicMaterial ref={shaftLamp} color="#38130d" toneMapped={false} />
          </mesh>
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <torusGeometry args={[0.045, 0.004, 5, 12]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
        </group>
        {/* darkness plug — the hole should read as black from above */}
        <mesh position={[0, -1.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.4, 20]} />
          <meshBasicMaterial color="#040404" />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Ladder — one straight run from the collar to the shelter floor.    */
/* ------------------------------------------------------------------ */

function Ladder() {
  const rungs = useRef<InstancedMesh>(null);
  const hover = useHoverCursor('LADDER — climb back to the surface');
  const COUNT = 18;

  useLayoutEffect(() => {
    const m = rungs.current;
    if (!m) return;
    for (let i = 0; i < COUNT; i++) {
      dummy.position.set(0, -0.2 - i * 0.28, 0);
      dummy.rotation.set(0, 0, Math.PI / 2);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group position={[LADDER_X, 0, LADDER_Z - 0.28]}>
      {/* rails */}
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, -2.58, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 5.3, 8]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
      <instancedMesh ref={rungs} args={[undefined, undefined, COUNT]}>
        <cylinderGeometry args={[0.015, 0.015, 0.34, 8]} />
        <meshStandardMaterial color="#4a4d48" metalness={0.6} roughness={0.5} />
      </instancedMesh>

      {/* generous return hitbox — the room-level stretch of the ladder */}
      <group
        {...hover}
        onClick={(e) => {
          e.stopPropagation();
          const s = useCommandCenter.getState();
          // if a monitor already claimed this click (or a panel is open /
          // opening), the screen wins — the ladder never steals a tap
          if (s.traveling || s.location !== 'bunker' || s.focused || s.transitioning) return;
          playLadderSteps(4, true);
          playHatchClose();
          s.travel('surface');
        }}
      >
        {/* a thin panel hugging the visible rails — sitting so close to the
            parked camera, anything deeper projects across half the screen
            and steals clicks meant for the AXIS monitor */}
        <mesh visible={false} position={[0, FLOOR_Y + 1.3, 0]}>
          <boxGeometry args={[0.44, 2.3, 0.1]} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell — slab, walls, ceiling with a hole for the shaft, I-beams.   */
/* ------------------------------------------------------------------ */

function Shell() {
  const wallTexA = useMemo(() => concreteWall(11), []);
  const wallTexB = useMemo(() => concreteWall(29), []);
  const floorTex = useMemo(() => concreteFloor(17), []);

  // ceiling hole framing the shaft throat
  const hx0 = LADDER_X - 0.5;
  const hx1 = LADDER_X + 0.5;
  const hz0 = LADDER_Z - 0.5;
  const hz1 = LADDER_Z + 0.5;

  return (
    <group>
      {/* floor slab */}
      <mesh position={[CX, FLOOR_Y - 0.09, CZ]}>
        <boxGeometry args={[ROOM_W + 0.4, 0.18, ROOM_D + 0.4]} />
        <meshStandardMaterial map={floorTex} color="#a29e96" roughness={1} />
      </mesh>
      {/* walls */}
      <mesh position={[X0 - 0.1, FLOOR_Y + ROOM_H / 2, CZ]}>
        <boxGeometry args={[0.2, ROOM_H, ROOM_D + 0.4]} />
        <meshStandardMaterial map={wallTexA} color="#a8a49c" roughness={1} />
      </mesh>
      <mesh position={[X1 + 0.1, FLOOR_Y + ROOM_H / 2, CZ]}>
        <boxGeometry args={[0.2, ROOM_H, ROOM_D + 0.4]} />
        <meshStandardMaterial map={wallTexB} color="#a8a49c" roughness={1} />
      </mesh>
      <mesh position={[CX, FLOOR_Y + ROOM_H / 2, Z0 - 0.1]}>
        <boxGeometry args={[ROOM_W + 0.4, ROOM_H, 0.2]} />
        <meshStandardMaterial map={wallTexB} color="#a8a49c" roughness={1} />
      </mesh>
      <mesh position={[CX, FLOOR_Y + ROOM_H / 2, Z1 + 0.1]}>
        <boxGeometry args={[ROOM_W + 0.4, ROOM_H, 0.2]} />
        <meshStandardMaterial map={wallTexA} color="#a8a49c" roughness={1} />
      </mesh>
      {/* ceiling — four pieces around the shaft opening */}
      <mesh position={[(X0 + hx0) / 2, CEIL_Y + 0.08, CZ]}>
        <boxGeometry args={[hx0 - X0, 0.16, ROOM_D + 0.4]} />
        <meshStandardMaterial color="#5d5953" roughness={1} />
      </mesh>
      <mesh position={[(hx1 + X1) / 2, CEIL_Y + 0.08, CZ]}>
        <boxGeometry args={[X1 - hx1, 0.16, ROOM_D + 0.4]} />
        <meshStandardMaterial color="#5d5953" roughness={1} />
      </mesh>
      <mesh position={[LADDER_X, CEIL_Y + 0.08, (Z0 + hz0) / 2]}>
        <boxGeometry args={[hx1 - hx0, 0.16, hz0 - Z0]} />
        <meshStandardMaterial color="#5d5953" roughness={1} />
      </mesh>
      <mesh position={[LADDER_X, CEIL_Y + 0.08, (hz1 + Z1) / 2]}>
        <boxGeometry args={[hx1 - hx0, 0.16, Z1 - hz1]} />
        <meshStandardMaterial color="#5d5953" roughness={1} />
      </mesh>
      {/* two exposed I-beam ribs */}
      {[-2.7, -0.3].map((z) => (
        <group key={z} position={[CX, 0, z]}>
          <mesh position={[0, CEIL_Y - 0.1, 0]}>
            <boxGeometry args={[ROOM_W, 0.16, 0.05]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
          <mesh position={[0, CEIL_Y - 0.02, 0]}>
            <boxGeometry args={[ROOM_W, 0.03, 0.2]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
          <mesh position={[0, CEIL_Y - 0.19, 0]}>
            <boxGeometry args={[ROOM_W, 0.03, 0.2]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  West wall — the pantry. Shelves, cans, water, rations, the map.    */
/* ------------------------------------------------------------------ */

function ShelfUnit({ z }: { z: number }) {
  const boards = [0.25, 0.85, 1.45, 2.0];
  return (
    <group position={[-6.02, FLOOR_Y, z]}>
      {[-0.72, 0.72].flatMap((dz) =>
        [-0.22, 0.22].map((dx) => (
          <mesh key={`${dx}${dz}`} position={[dx, 1.1, dz]}>
            <boxGeometry args={[0.05, 2.2, 0.05]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
        )),
      )}
      {boards.map((y) => (
        <mesh key={y} position={[0, y + 0.02, 0]}>
          <boxGeometry args={[0.5, 0.04, 1.5]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
    </group>
  );
}

function Supplies() {
  const cans = useRef<InstancedMesh>(null);
  const rationTex = useMemo(() => stencilLabel('MRE-12'), []);

  // cans on unit A (z around -2.8) — three stocked rows plus one hero can
  const canData = useMemo(() => {
    const r = seeded(507);
    const tints = ['#8a5a3a', '#6a7a4a', '#a89a6a', '#7a4a2a'].map((h) => new Color(h));
    const list: { p: [number, number, number]; c: Color }[] = [];
    [0.27, 0.87, 1.47].forEach((by, bi) => {
      const n = 13 - bi * 3;
      for (let i = 0; i < n; i++) {
        const back = r() > 0.45;
        list.push({
          p: [back ? -6.13 : -5.9, FLOOR_Y + by + 0.055, -3.45 + i * (1.3 / n) + r() * 0.05],
          c: tints[Math.floor(r() * tints.length)],
        });
      }
    });
    // the hero can — its label is a detail spot
    list.push({ p: [-5.85, -4.275, -2.55], c: tints[0] });
    return list;
  }, []);

  useLayoutEffect(() => {
    const m = cans.current;
    if (!m) return;
    canData.forEach(({ p, c }, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [canData]);

  return (
    <group>
      <ShelfUnit z={-2.8} />
      <ShelfUnit z={-0.2} />

      <instancedMesh ref={cans} args={[undefined, undefined, canData.length]}>
        <cylinderGeometry args={[0.045, 0.045, 0.11, 10]} />
        <meshStandardMaterial color="#d8d2c4" metalness={0.35} roughness={0.5} />
      </instancedMesh>

      {/* water bottles — unit B, middle board */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[-6.0, FLOOR_Y + 0.87 + 0.1, -0.75 + i * 0.24]}>
          <cylinderGeometry args={[0.04, 0.045, 0.2, 8]} />
          <meshStandardMaterial color="#5f7d8a" transparent opacity={0.55} roughness={0.25} metalness={0.1} />
        </mesh>
      ))}

      {/* ration boxes — unit B, bottom board */}
      {[[-0.55, 0], [-0.2, 0], [0.15, 0], [-0.38, 1]].map(([dz, up], i) => (
        <mesh key={i} position={[-6.0, FLOOR_Y + 0.27 + 0.13 + (up as number) * 0.26, -0.2 + (dz as number)]} rotation={[0, i * 0.06, 0]}>
          <boxGeometry args={[0.4, 0.26, 0.3]} />
          <meshStandardMaterial color="#8a7a58" roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[-5.795, FLOOR_Y + 0.42, -0.2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.26, 0.07]} />
        <meshBasicMaterial map={rationTex} transparent toneMapped={false} />
      </mesh>

      {/* battery pack — unit A, top board */}
      <mesh position={[-6.0, FLOOR_Y + 1.47 + 0.07, -3.25]}>
        <boxGeometry args={[0.24, 0.14, 0.18]} />
        <meshStandardMaterial color="#4a4438" roughness={0.9} />
      </mesh>
      <mesh position={[-5.87, FLOOR_Y + 1.47 + 0.08, -3.25]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.12, 0.05]} />
        <meshStandardMaterial color="#8a7a3a" roughness={0.95} />
      </mesh>

      {/* first aid kit — unit B, top board */}
      <group position={[-6.0, FLOOR_Y + 1.47 + 0.09, 0.1]}>
        <mesh>
          <boxGeometry args={[0.22, 0.13, 0.16]} />
          <meshStandardMaterial color="#c9c4bc" roughness={0.85} />
        </mesh>
        <mesh position={[0.111, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.026, 0.08]} />
          <meshStandardMaterial color="#8a2820" roughness={0.9} />
        </mesh>
        <mesh position={[0.111, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.08, 0.026]} />
          <meshStandardMaterial color="#8a2820" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

function MapWall() {
  const mapTex = useMemo(() => bunkerMap(), []);
  const posterTex = useMemo(() => emergencyPoster(), []);
  return (
    <group>
      {/* the map, pinned in the gap between the shelf units */}
      <mesh position={[-6.19, -3.6, -1.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.95, 0.72]} />
        <meshStandardMaterial map={mapTex} roughness={0.95} />
      </mesh>
      {[[-1.06, -3.28], [-1.94, -3.28], [-1.06, -3.92], [-1.94, -3.92]].map(([z, y], i) => (
        <mesh key={i} position={[-6.18, y, z]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshStandardMaterial color={i % 2 ? '#7a4a2a' : '#8a2820'} roughness={0.6} />
        </mesh>
      ))}
      {/* emergency-instructions poster — south wall, past the pegboard */}
      <mesh position={[-5.85, -3.55, -3.88]} rotation={[0, 0, 0.04]}>
        <planeGeometry args={[0.34, 0.5]} />
        <meshStandardMaterial map={posterTex} roughness={0.95} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  South wall — the workbench and everything that keeps this place    */
/*  running: radio, lantern, panel, pegboard, the note.                */
/* ------------------------------------------------------------------ */

function ShortwaveRadio() {
  const [on, setOn] = useState(false);
  const bars = useRef<Group>(null);
  const hover = useHoverCursor('Shortwave set — click for power');

  useFrame(({ clock }) => {
    const g = bars.current;
    if (!g) return;
    g.children.forEach((c, i) => {
      const target = on ? 0.4 + Math.abs(Math.sin(clock.elapsedTime * (3 + i * 1.7))) * 0.6 : 0.08;
      c.scale.y += (target - c.scale.y) * 0.2;
    });
  });

  return (
    <group
      position={[-4.2, -4.35, -3.6]}
      rotation={[0, 0.25, 0]}
      {...hover}
      onClick={(e) => {
        e.stopPropagation();
        playSwitchClick(!on);
        setOn((o) => !o);
      }}
    >
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[0.32, 0.14, 0.12]} />
        <meshStandardMaterial color="#33302a" metalness={0.4} roughness={0.7} />
      </mesh>
      <mesh position={[-0.12, 0.22, 0]} rotation={[0, 0, 0.35]}>
        <cylinderGeometry args={[0.004, 0.004, 0.18, 4]} />
        <meshStandardMaterial color="#1f1c18" metalness={0.7} roughness={0.5} />
      </mesh>
      {/* dials */}
      {[-0.06, 0.03].map((x) => (
        <mesh key={x} position={[x, 0.05, 0.063]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.012, 10]} />
          <meshStandardMaterial color="#1f1c18" roughness={0.5} />
        </mesh>
      ))}
      {/* power LED */}
      <mesh position={[0.12, 0.1, 0.063]}>
        <sphereGeometry args={[0.009, 8, 8]} />
        <meshBasicMaterial color={on ? '#b8c49a' : '#3a2f1c'} toneMapped={false} />
      </mesh>
      {/* EQ bars */}
      <group ref={bars} position={[-0.06, 0.1, 0.063]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[i * 0.024, 0, 0]} scale={[1, 0.08, 1]}>
            <boxGeometry args={[0.013, 0.06, 0.004]} />
            <meshBasicMaterial color="#8d9c6a" toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Workbench() {
  const newsTex = useMemo(() => newspaperFront(), []);
  return (
    <group>
      {/* heavy top on legs */}
      <mesh position={[-4.3, FLOOR_Y + 0.815, -3.55]}>
        <boxGeometry args={[2.2, 0.07, 0.62]} />
        <meshStandardMaterial {...WOOD} />
      </mesh>
      {[[-5.3, -3.8], [-5.3, -3.3], [-3.3, -3.8], [-3.3, -3.3]].map(([x, z], i) => (
        <mesh key={i} position={[x, FLOOR_Y + 0.39, z]}>
          <boxGeometry args={[0.07, 0.78, 0.07]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
      ))}
      <mesh position={[-4.3, FLOOR_Y + 0.18, -3.55]}>
        <boxGeometry args={[2.0, 0.04, 0.5]} />
        <meshStandardMaterial {...STEEL_DARK} />
      </mesh>

      {/* toolbox */}
      <group position={[-3.85, -4.35, -3.7]}>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[0.32, 0.14, 0.16]} />
          <meshStandardMaterial {...RUST} />
        </mesh>
        <mesh position={[0, 0.16, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.2, 6]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
      </group>

      <ShortwaveRadio />

      {/* lit desk lantern */}
      <group position={[-5.2, -4.35, -3.55]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.04, 10]} />
          <meshStandardMaterial {...OLIVE2} />
        </mesh>
        <mesh position={[0, 0.11, 0]}>
          <cylinderGeometry args={[0.04, 0.045, 0.14, 10]} />
          <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.055, 0.045, 0.04, 10]} />
          <meshStandardMaterial {...OLIVE2} />
        </mesh>
        <mesh position={[0, 0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.035, 0.006, 5, 12]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
      </group>

      {/* scattered tools — a wrench and a screwdriver */}
      <mesh position={[-4.55, -4.335, -3.4]} rotation={[0, 0.7, 0]}>
        <boxGeometry args={[0.2, 0.014, 0.03]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[-4.46, -4.335, -3.36]}>
        <boxGeometry args={[0.045, 0.016, 0.05]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[-3.95, -4.335, -3.42]} rotation={[Math.PI / 2, 0, 1.1]}>
        <cylinderGeometry args={[0.007, 0.007, 0.14, 6]} />
        <meshStandardMaterial color="#8a8578" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-3.89, -4.335, -3.45]} rotation={[Math.PI / 2, 0, 1.1]}>
        <cylinderGeometry args={[0.015, 0.015, 0.06, 6]} />
        <meshStandardMaterial {...RUST} />
      </mesh>

      {/* the handwritten note — day 847 */}
      <group position={[-4.85, -4.345, -3.35]} rotation={[0, -0.2, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.16, 0.2]} />
          <meshStandardMaterial color="#c4bca6" roughness={1} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, 0.001, -0.06 + i * 0.04]} rotation={[-Math.PI / 2, 0, 0.05]}>
            <planeGeometry args={[0.11, 0.005]} />
            <meshStandardMaterial color="#4a4438" roughness={1} />
          </mesh>
        ))}
      </group>

      {/* the last newspaper */}
      <mesh position={[-3.55, -4.343, -3.5]} rotation={[-Math.PI / 2, 0, 0.25]}>
        <planeGeometry args={[0.3, 0.4]} />
        <meshStandardMaterial map={newsTex} roughness={1} />
      </mesh>
    </group>
  );
}

function Pegboard() {
  return (
    <group>
      {/* squeezed left when AXIS claimed the center of the wall */}
      <mesh position={[-5.05, -3.5, -3.87]}>
        <planeGeometry args={[0.95, 0.85]} />
        <meshStandardMaterial color="#4f4a3e" roughness={0.95} />
      </mesh>
      {/* hanging tools — silhouettes on hooks */}
      {[[-5.4, -3.62, 0.3, 0.05], [-5.2, -3.66, 0.34, 0.04], [-5.0, -3.6, 0.22, 0.06], [-4.8, -3.64, 0.3, 0.05], [-4.64, -3.6, 0.26, 0.04]].map(([x, y, h, w], i) => (
        <group key={i} position={[x, y, -3.85]}>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.04, 6]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position={[0, -h / 2 + 0.04, 0]}>
            <boxGeometry args={[w, h, 0.025]} />
            <meshStandardMaterial color={i % 2 ? '#3a3d3a' : '#4a4438'} metalness={0.5} roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* two gas masks on hooks — filters pointed at the floor */}
      {[-5.32, -4.76].map((x, i) => (
        <group key={i} position={[x, -3.26, -3.82]} rotation={[0.15, i ? 0.2 : -0.15, 0]}>
          <mesh scale={[1, 1.25, 0.8]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color="#3f4636" roughness={0.85} />
          </mesh>
          {[-0.03, 0.03].map((dx) => (
            <mesh key={dx} position={[dx, 0.02, 0.055]}>
              <cylinderGeometry args={[0.018, 0.018, 0.015, 8]} />
              <meshStandardMaterial color="#23261f" metalness={0.3} roughness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, -0.09, 0.03]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.03, 0.06, 8]} />
            <meshStandardMaterial color="#2c2f2c" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ElectricalPanel() {
  const leds = useRef<(MeshBasicMaterial | null)[]>([]);
  const LED_TINTS = useMemo(() => ['#9ab86a', '#d9a04a', '#9ab86a', '#c46a4a'].map((c) => new Color(c)), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    leds.current.forEach((m, i) => {
      if (!m) return;
      const on = Math.sin(t * (1.4 + i * 0.9) + i * 2.3) > 0.2;
      m.color.copy(LED_TINTS[i]).multiplyScalar(on ? 1 : 0.08);
    });
  });

  return (
    // nudged toward the corner so the AXIS screen owns the wall center
    <group position={[-2.32, -3.7, -3.83]}>
      <mesh>
        <boxGeometry args={[0.5, 0.7, 0.12]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {/* door ajar on its left hinge */}
      <group position={[-0.25, 0, 0.06]} rotation={[0, -0.55, 0]}>
        <mesh position={[0.25, 0, 0.01]}>
          <boxGeometry args={[0.5, 0.68, 0.02]} />
          <meshStandardMaterial color="#44473f" metalness={0.55} roughness={0.5} />
        </mesh>
      </group>
      {/* breaker rows + status LEDs */}
      {[0.18, 0.04, -0.1].map((y) => (
        <mesh key={y} position={[-0.05, y, 0.062]}>
          <boxGeometry args={[0.24, 0.06, 0.02]} />
          <meshStandardMaterial color="#23261f" roughness={0.7} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0.16, 0.2 - i * 0.1, 0.065]}>
          <sphereGeometry args={[0.011, 8, 8]} />
          <meshBasicMaterial
            ref={(el) => {
              leds.current[i] = el;
            }}
            color="#3a2f1c"
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* conduit up the wall into the ceiling */}
      <mesh position={[0, 0.75, -0.03]}>
        <cylinderGeometry args={[0.022, 0.022, 0.85, 8]} />
        <meshStandardMaterial {...STEEL_DARK} />
      </mesh>
      <mesh position={[0, 0.36, -0.03]}>
        <boxGeometry args={[0.1, 0.06, 0.08]} />
        <meshStandardMaterial {...STEEL_DARK} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  East side — bunks, books, and the clock that keeps real time.      */
/* ------------------------------------------------------------------ */

function WindupClock() {
  const hourH = useRef<Group>(null);
  const minH = useRef<Group>(null);

  useFrame(() => {
    const d = new Date();
    const m = d.getMinutes() + d.getSeconds() / 60;
    const h = (d.getHours() % 12) + m / 60;
    if (hourH.current) hourH.current.rotation.z = -(h / 12) * Math.PI * 2;
    if (minH.current) minH.current.rotation.z = -(m / 60) * Math.PI * 2;
  });

  return (
    // on the workbench, face north into the room — where the lens can reach it
    <group position={[-3.35, FLOOR_Y + 0.93, -3.65]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.035, 16]} />
        <meshStandardMaterial color="#6a5a34" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.019]}>
        <circleGeometry args={[0.045, 16]} />
        <meshStandardMaterial color="#c9c4ae" roughness={0.9} />
      </mesh>
      {/* hands pivot at the face center */}
      <group ref={hourH} position={[0, 0, 0.022]}>
        <mesh position={[0, 0.014, 0]}>
          <boxGeometry args={[0.006, 0.028, 0.002]} />
          <meshStandardMaterial color="#2c2a24" roughness={0.8} />
        </mesh>
      </group>
      <group ref={minH} position={[0, 0, 0.024]}>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.004, 0.04, 0.002]} />
          <meshStandardMaterial color="#2c2a24" roughness={0.8} />
        </mesh>
      </group>
      {/* twin bells + little legs */}
      {[-0.028, 0.028].map((x) => (
        <mesh key={x} position={[x, 0.06, 0]}>
          <sphereGeometry args={[0.016, 8, 8]} />
          <meshStandardMaterial color="#6a5a34" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {[-0.035, 0.035].map((x) => (
        <mesh key={x} position={[x, -0.06, 0.008]} rotation={[0, 0, x > 0 ? -0.4 : 0.4]}>
          <cylinderGeometry args={[0.004, 0.004, 0.03, 6]} />
          <meshStandardMaterial color="#6a5a34" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function BunkArea() {
  const BOOKS: [number, number, string][] = [
    // z offset, height, spine tint
    [-1.1, 0.17, '#5a4a30'], [-1.06, 0.19, '#44522f'], [-1.02, 0.16, '#7a4a2a'],
    [-0.975, 0.2, '#3f4636'], [-0.93, 0.15, '#6a5f42'],
  ];
  return (
    <group>
      {/* steel bunk frame against the east wall */}
      {[[-0.82, -3.35], [-0.82, -1.55], [-0.16, -3.35], [-0.16, -1.55]].map(([x, z], i) => (
        <mesh key={i} position={[x, FLOOR_Y + 0.85, z]}>
          <cylinderGeometry args={[0.025, 0.025, 1.7, 8]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
      ))}
      {[0.4, 1.15].map((y) => (
        <group key={y}>
          <mesh position={[-0.49, FLOOR_Y + y, -2.45]}>
            <boxGeometry args={[0.72, 0.06, 1.85]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          {/* thin mattress pad */}
          <mesh position={[-0.49, FLOOR_Y + y + 0.06, -2.45]}>
            <boxGeometry args={[0.68, 0.06, 1.8]} />
            <meshStandardMaterial color="#6a6252" roughness={1} />
          </mesh>
          {/* olive sleeping bag */}
          <mesh position={[-0.49, FLOOR_Y + y + 0.14, -2.55]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.13, 1.15, 4, 10]} />
            <meshStandardMaterial color={y > 1 ? '#4c5a34' : '#44522f'} roughness={1} />
          </mesh>
          {/* folded blanket at the foot */}
          <mesh position={[-0.49, FLOOR_Y + y + 0.13, -1.68]}>
            <boxGeometry args={[0.34, 0.09, 0.3]} />
            <meshStandardMaterial color="#6a5f42" roughness={1} />
          </mesh>
        </group>
      ))}
      {/* short access ladder on the bunk frame */}
      {[0.55, 0.8, 1.05].map((y) => (
        <mesh key={y} position={[-0.85, FLOOR_Y + y, -2.0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
      ))}

      {/* backpack leaning on the frame */}
      <group position={[-0.75, FLOOR_Y + 0.22, -1.2]} rotation={[0.15, 0.5, -0.12]}>
        <mesh>
          <boxGeometry args={[0.28, 0.42, 0.18]} />
          <meshStandardMaterial color="#5a5340" roughness={1} />
        </mesh>
        <mesh position={[0, 0.18, 0.06]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.24, 0.12, 0.1]} />
          <meshStandardMaterial color="#4c4636" roughness={1} />
        </mesh>
      </group>

      {/* wall shelf — books and the clock */}
      <mesh position={[-0.26, -4.16, -0.9]}>
        <boxGeometry args={[0.28, 0.04, 0.55]} />
        <meshStandardMaterial {...WOOD} />
      </mesh>
      {BOOKS.map(([z, h, tint], i) => (
        <mesh key={i} position={[-0.26, -4.14 + h / 2, z]} rotation={[i === 4 ? 0.25 : 0, 0, 0]}>
          <boxGeometry args={[0.14, h, 0.035]} />
          <meshStandardMaterial color={tint} roughness={0.95} />
        </mesh>
      ))}
      <WindupClock />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  North wall — arrival side. Kit, crates, fuel, and the generator.   */
/* ------------------------------------------------------------------ */

function GeneratorUnit() {
  const body = useRef<Group>(null);
  const fly = useRef<Group>(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // it runs a little rough — tiny position jitter, never still
    if (body.current) body.current.position.set(Math.sin(t * 41) * 0.0016, Math.abs(Math.sin(t * 57)) * 0.0012, 0);
    if (fly.current) fly.current.rotation.x += dt * 6;
  });

  const cable = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-5.6, FLOOR_Y + 0.35, -1.5),
        new Vector3(-6.05, FLOOR_Y + 0.06, -2.3),
        new Vector3(-5.3, FLOOR_Y + 0.06, -3.7),
        new Vector3(-2.9, FLOOR_Y + 0.08, -3.78),
        new Vector3(-2.32, -4.15, -3.85),
      ]),
    [],
  );

  return (
    // parked against the west wall in the gap between the shelf units,
    // flywheel turning in plain view — clear of both shelves
    <group position={[-5.82, FLOOR_Y, -1.5]}>
      {/* skid frame */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.8, 0.1, 0.56]} />
        <meshStandardMaterial {...STEEL_DARK} />
      </mesh>
      <group ref={body}>
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[0.7, 0.55, 0.5]} />
          <meshStandardMaterial color="#4c5a34" metalness={0.3} roughness={0.75} />
        </mesh>
        {/* exhaust stub + fuel cap */}
        <mesh position={[-0.2, 0.72, -0.1]}>
          <cylinderGeometry args={[0.035, 0.035, 0.16, 8]} />
          <meshStandardMaterial color="#3a332a" roughness={0.9} />
        </mesh>
        <mesh position={[0.18, 0.68, 0.1]}>
          <cylinderGeometry args={[0.04, 0.04, 0.05, 8]} />
          <meshStandardMaterial {...RUST} />
        </mesh>
        {/* flywheel on the east face, always turning */}
        <group ref={fly} position={[0.37, 0.38, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.14, 0.14, 0.04, 14]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0.03, 0, 0]} rotation={[(i * Math.PI * 2) / 3, 0, 0]}>
              <boxGeometry args={[0.015, 0.05, 0.24]} />
              <meshStandardMaterial {...STEEL_DARK} />
            </mesh>
          ))}
        </group>
        {/* amber pilot light */}
        <mesh position={[-0.28, 0.5, 0.253]}>
          <sphereGeometry args={[0.016, 8, 8]} />
          <meshBasicMaterial color="#ffbf5a" toneMapped={false} />
        </mesh>
      </group>
      {/* feed cable snaking along the wall to the panel */}
      <group position={[5.82, -FLOOR_Y, 1.5]}>
        <mesh>
          <tubeGeometry args={[cable, 32, 0.018, 6]} />
          <meshStandardMaterial color="#1c1e1a" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

function NorthWallKit() {
  const ammoTex = useMemo(() => stencilLabel('AMMO', '#c9c4ae'), []);
  return (
    <group>
      {/* fire extinguisher on a wall bracket */}
      <group position={[-1.5, FLOOR_Y + 0.62, 0.76]}>
        <mesh position={[0, 0.05, 0.09]}>
          <boxGeometry args={[0.1, 0.06, 0.06]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 0.34, 12]} />
          <meshStandardMaterial color="#7a2018" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.02, 0.03, 0.06, 8]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        <mesh position={[0.05, 0.22, 0]} rotation={[0, 0, 1.1]}>
          <cylinderGeometry args={[0.008, 0.008, 0.08, 6]} />
          <meshStandardMaterial color="#1c1e1a" roughness={0.8} />
        </mesh>
      </group>

      {/* coat hooks + a jacket that still hangs the way he left it */}
      <group position={[-2.9, FLOOR_Y + 1.5, 0.85]}>
        <mesh>
          <boxGeometry args={[0.7, 0.06, 0.04]} />
          <meshStandardMaterial {...WOOD} />
        </mesh>
        {[-0.25, 0, 0.25].map((x) => (
          <mesh key={x} position={[x, -0.05, -0.03]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.08, 6]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        ))}
        <mesh position={[-0.25, -0.35, -0.04]} rotation={[0.05, 0, 0.04]}>
          <boxGeometry args={[0.34, 0.52, 0.08]} />
          <meshStandardMaterial color="#3f4636" roughness={1} />
        </mesh>
        <mesh position={[-0.25, -0.06, -0.04]}>
          <boxGeometry args={[0.12, 0.1, 0.09]} />
          <meshStandardMaterial color="#353b2e" roughness={1} />
        </mesh>
      </group>

      {/* stacked storage crates */}
      <group position={[-3.9, FLOOR_Y, 0.5]}>
        <mesh position={[0, 0.18, 0]}>
          <boxGeometry args={[0.52, 0.36, 0.46]} />
          <meshStandardMaterial {...WOOD} />
        </mesh>
        <mesh position={[0.04, 0.52, -0.02]} rotation={[0, 0.12, 0]}>
          <boxGeometry args={[0.48, 0.32, 0.42]} />
          <meshStandardMaterial color="#6a5f42" roughness={0.95} />
        </mesh>
        <mesh position={[0.5, 0.15, 0.06]} rotation={[0, -0.3, 0]}>
          <boxGeometry args={[0.4, 0.3, 0.36]} />
          <meshStandardMaterial {...WOOD} />
        </mesh>
      </group>

      {/* two olive AMMO boxes, long since demoted to rope-and-flashlight storage */}
      <group position={[-4.65, FLOOR_Y, 0.55]}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[0, 0.1 + i * 0.2, i * 0.02]} rotation={[0, i * 0.08, 0]}>
            <boxGeometry args={[0.44, 0.2, 0.22]} />
            <meshStandardMaterial {...OLIVE2} />
          </mesh>
        ))}
        <mesh position={[0, 0.31, 0.13]}>
          <planeGeometry args={[0.3, 0.075]} />
          <meshBasicMaterial map={ammoTex} transparent toneMapped={false} />
        </mesh>
        {/* rope coil + two flashlights on the lid */}
        <mesh position={[-0.08, 0.43, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.08, 0.028, 6, 14]} />
          <meshStandardMaterial color="#8a7a58" roughness={1} />
        </mesh>
        {[0.1, 0.16].map((x, i) => (
          <mesh key={i} position={[x, 0.42, i ? -0.05 : 0.04]} rotation={[Math.PI / 2, 0, 0.9 + i * 0.4]}>
            <cylinderGeometry args={[0.018, 0.022, 0.14, 8]} />
            <meshStandardMaterial color="#2e2a26" metalness={0.6} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* jerry cans, cross-stamped */}
      {[[-5.15, 0.6, 0], [-5.42, 0.62, 0.3], [-5.28, 0.58, -0.15]].map(([x, z, ry], i) => (
        <group key={i} position={[x, FLOOR_Y + 0.2, z]} rotation={[0, ry, 0]}>
          <mesh>
            <boxGeometry args={[0.28, 0.4, 0.14]} />
            <meshStandardMaterial {...OLIVE2} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[0.14, 0.04, 0.04]} />
            <meshStandardMaterial {...OLIVE2} />
          </mesh>
          {/* the pressed X on the face */}
          <mesh position={[0, 0, 0.072]} rotation={[0, 0, 0.78]}>
            <boxGeometry args={[0.22, 0.02, 0.004]} />
            <meshStandardMaterial color="#3d4a28" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.072]} rotation={[0, 0, -0.78]}>
            <boxGeometry args={[0.22, 0.02, 0.004]} />
            <meshStandardMaterial color="#3d4a28" roughness={0.9} />
          </mesh>
        </group>
      ))}

      <GeneratorUnit />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Ceiling kit — duct, axial fan, and the ventilation hum's source.   */
/* ------------------------------------------------------------------ */

function CeilingKit() {
  const fan = useRef<Group>(null);
  useFrame((_, dt) => {
    if (fan.current) fan.current.rotation.x += dt * 1.6;
  });
  return (
    <group>
      <mesh position={[CX, CEIL_Y - 0.28, 0.2]}>
        <boxGeometry args={[5.6, 0.32, 0.32]} />
        <meshStandardMaterial color="#565a54" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* hangers */}
      {[-5.2, -1.2].map((x) => (
        <mesh key={x} position={[x, CEIL_Y - 0.08, 0.2]}>
          <boxGeometry args={[0.03, 0.16, 0.03]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
      ))}
      {/* axial fan behind a grille at the east end */}
      <group position={[-0.38, CEIL_Y - 0.28, 0.2]}>
        <group ref={fan}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[(i * Math.PI * 2) / 3, 0, 0]} position={[0, 0, 0]}>
              <boxGeometry args={[0.02, 0.05, 0.24]} />
              <meshStandardMaterial color="#44473f" metalness={0.5} roughness={0.6} />
            </mesh>
          ))}
        </group>
        <mesh rotation={[0, Math.PI / 2, 0]} position={[0.06, 0, 0]}>
          <torusGeometry args={[0.13, 0.012, 6, 16]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        {[-0.07, 0, 0.07].map((y) => (
          <mesh key={y} position={[0.06, y, 0]}>
            <boxGeometry args={[0.01, 0.015, 0.26]} />
            <meshStandardMaterial {...STEEL_DARK} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Light — two warm drop lamps, a bench worklight, festoon bulbs,     */
/*  and the occasional electrical stumble.                             */
/* ------------------------------------------------------------------ */

const LAMPS: [number, number, number][] = [
  [-4.5, CEIL_Y - 0.5, -2.5],
  [-2.3, CEIL_Y - 0.5, -0.7],
];

function Lighting() {
  // point lights cost every lit fragment in the scene, even from six
  // meters underground — the rig only exists while someone is down here
  const location = useCommandCenter((s) => s.location);
  const traveling = useCommandCenter((s) => s.traveling);
  const lit = location === 'bunker' || traveling;
  const lights = useRef<(PointLight | null)[]>([]);
  const bulbs = useRef<(MeshBasicMaterial | null)[]>([]);
  const festoonMat = useRef<MeshBasicMaterial>(null);
  const festBulbs = useRef<InstancedMesh>(null);
  const flick = useRef({ next: 14, start: -10 });
  const BASE = [1.3, 1.05];

  const festoonPts = useMemo(() => {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      pts.push(new Vector3(X0 + 0.14, CEIL_Y - 0.22 - Math.sin(u * Math.PI) * 0.28, 0.4 - u * 3.8));
    }
    return pts;
  }, []);
  const festoonCurve = useMemo(() => new CatmullRomCurve3(festoonPts), [festoonPts]);

  useLayoutEffect(() => {
    const m = festBulbs.current;
    if (!m) return;
    festoonPts.forEach((p, i) => {
      dummy.position.set(p.x, p.y - 0.045, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [festoonPts]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = flick.current;
    if (t >= f.next) {
      f.start = t;
      f.next = t + 18 + Math.random() * 17;
      if (useCommandCenter.getState().location === 'bunker') playFlicker();
    }
    // two hard dips in quick succession, then business as usual
    const a = t - f.start;
    const dip = (a >= 0 && a < 0.12) || (a >= 0.2 && a < 0.32) ? 0.05 : 1;
    lights.current.forEach((l, i) => {
      if (l) l.intensity = BASE[i] * dip;
    });
    bulbs.current.forEach((m) => {
      if (m) m.color.copy(BULB_WARM).multiplyScalar(dip);
    });
    if (festoonMat.current) festoonMat.current.color.copy(FESTOON_WARM).multiplyScalar(dip);
  });

  return (
    <group visible={lit}>
      {LAMPS.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
            <meshStandardMaterial color="#1c1e1a" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <coneGeometry args={[0.14, 0.12, 12, 1, true]} />
            <meshStandardMaterial color="#3f4636" metalness={0.4} roughness={0.6} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshBasicMaterial
              ref={(el) => {
                bulbs.current[i] = el;
              }}
              color="#ffcf8a"
              toneMapped={false}
            />
          </mesh>
          <pointLight
            ref={(el) => {
              lights.current[i] = el;
            }}
            position={[0, -0.08, 0]}
            color="#ffb46a"
            intensity={BASE[i]}
            distance={6.5}
            decay={2}
          />
        </group>
      ))}

      {/* caged worklight over the bench's left end, clear of the AXIS screen */}
      <group position={[-4.95, FLOOR_Y + 1.95, -3.62]}>
        <mesh>
          <boxGeometry args={[0.16, 0.08, 0.1]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color="#ffdca8" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.05, 0]} rotation={[0, Math.PI / 4, 0]}>
          <torusGeometry args={[0.045, 0.004, 5, 10]} />
          <meshStandardMaterial {...STEEL_DARK} />
        </mesh>
        <pointLight position={[0, -0.12, 0.05]} color="#ffcf9a" intensity={0.7} distance={3} decay={2} />
      </group>

      {/* faint cool fill so the corners never go dead black */}
      <pointLight position={[-1.4, FLOOR_Y + 1.9, 0.1]} color="#5f6c78" intensity={0.35} distance={7.5} decay={2} />

      {/* festoon string along the west wall */}
      <mesh>
        <tubeGeometry args={[festoonCurve, 24, 0.006, 5]} />
        <meshStandardMaterial color="#1c1e1a" roughness={0.9} />
      </mesh>
      <instancedMesh ref={festBulbs} args={[undefined, undefined, festoonPts.length]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshBasicMaterial ref={festoonMat} color="#ffc070" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Assembly.                                                          */
/* ------------------------------------------------------------------ */

function BunkerInterior() {
  return (
    <group>
      <Shell />
      <Supplies />
      <MapWall />
      <Workbench />
      <Pegboard />
      <ElectricalPanel />
      <BunkArea />
      <NorthWallKit />
      <CeilingKit />
      <Lighting />
    </group>
  );
}

export default function Bunker() {
  const location = useCommandCenter((s) => s.location);

  // the shelter breathes — hum and vent wash whenever someone is down there
  useEffect(() => {
    if (location === 'bunker') startBunkerAmbience();
    return () => stopBunkerAmbience();
  }, [location]);

  return (
    <group>
      <SurfaceHatch />
      <Ladder />
      <BunkerInterior />
    </group>
  );
}
