'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, CatmullRomCurve3, Color, DoubleSide, Group, InstancedMesh,
  Object3D, Points, Vector3,
} from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import { seeded } from '@/lib/data';
import { asphalt, brickFacade, cloudPuff, distantFacade, grassCard, leafCluster } from '@/lib/textures';
import DeskArea from './DeskArea';

/* Shared golden-hour sun direction (mirrored in Experience's <Sky>). */
export const SUN = [16, 6, -34] as const;

const dummy = new Object3D();
const tmpColor = new Color();

/** Soft contact shadow — grounds objects without a shadow pass. */
function Blob({ x, z, r, o = 0.35, sx = 1 }: { x: number; z: number; r: number; o?: number; sx?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, z]} scale={[sx, 1, 1]}>
      <circleGeometry args={[r, 20]} />
      <meshBasicMaterial color="#000000" transparent opacity={o} depthWrite={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Terrain — meadow, cracked asphalt, sidewalks, puddles, dirt.       */
/* ------------------------------------------------------------------ */

function Terrain() {
  const road = useMemo(() => asphalt(4), []);
  road.repeat.set(9, 1);

  return (
    <group>
      {/* meadow ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -10]}>
        <planeGeometry args={[170, 130]} />
        <meshStandardMaterial color="#3d422c" roughness={1} />
      </mesh>
      {/* uneven earth patches */}
      {[[-8, -6, 7, '#464e30'], [6, -14, 9, '#3a4430'], [-16, -18, 12, '#4a4a33'], [12, -4, 5, '#42502e'], [20, -16, 8, '#514c33']].map(
        ([x, z, s, col], i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, i * 1.7]} position={[x as number, -0.01, z as number]}>
            <circleGeometry args={[s as number, 20]} />
            <meshStandardMaterial color={col as string} roughness={1} />
          </mesh>
        ),
      )}

      {/* cracked asphalt street */}
      <mesh rotation={[-Math.PI / 2, 0, 0.06]} position={[0, 0, -9]}>
        <planeGeometry args={[90, 7.4]} />
        <meshStandardMaterial map={road} roughness={0.95} color="#b9b3a8" />
      </mesh>
      {/* faded broken lane line */}
      {[-30, -18, -6, 6, 18, 30].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0.06]} position={[x, 0.012, -9 + x * 0.06]}>
          <planeGeometry args={[2.2, 0.15]} />
          <meshStandardMaterial color="#8a8064" roughness={1} transparent opacity={0.55} />
        </mesh>
      ))}
      {/* dirt taking over a stretch of road */}
      <mesh rotation={[-Math.PI / 2, 0, 0.2]} position={[-12, 0.015, -8.6]}>
        <circleGeometry args={[3.4, 18]} />
        <meshStandardMaterial color="#57503a" roughness={1} />
      </mesh>

      {/* sidewalks with seams */}
      {[-5.1, -12.9].map((z, side) => (
        <group key={side}>
          <mesh rotation={[-Math.PI / 2, 0, 0.06]} position={[0, 0.03, z]}>
            <planeGeometry args={[90, 1.6]} />
            <meshStandardMaterial color="#6d685c" roughness={1} />
          </mesh>
          {Array.from({ length: 28 }, (_, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0.06]} position={[-42 + i * 3.1, 0.035, z + (-42 + i * 3.1) * 0.06]}>
              <planeGeometry args={[0.06, 1.6]} />
              <meshStandardMaterial color="#3c3830" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
      {/* tree roots heaving the sidewalk */}
      {[[-7, -5.2], [9, -12.6], [16, -5.4]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[k * 0.3 - 0.3, 0.03, (k % 2) * 0.2]} rotation={[0, k, Math.PI / 2]}>
              <cylinderGeometry args={[0.05 + k * 0.02, 0.07, 0.8, 6]} />
              <meshStandardMaterial color="#4a3b28" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}

      {/* puddles with live reflections */}
      {[[3.5, -8.2, 1.15], [-9.5, -9.6, 0.85]].map(([x, z, s], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]} scale={[1.4, 1, 1]}>
          <circleGeometry args={[s, 22]} />
          <MeshReflectorMaterial
            color="#8a8a80"
            roughness={0.25}
            blur={[200, 60]}
            resolution={256}
            mixBlur={0.8}
            mixStrength={0.9}
            mirror={0.6}
            depthScale={0.6}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.2}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Brick buildings with real facades, fire escapes, roof gear.        */
/* ------------------------------------------------------------------ */

function FireEscape({ w, floors, h }: { w: number; floors: number; h: number }) {
  const fh = h / floors;
  return (
    <group position={[w * 0.22, 0, 0.06]}>
      {Array.from({ length: floors - 1 }, (_, f) => {
        const y = fh * (f + 1);
        return (
          <group key={f} position={[0, y, 0]}>
            {/* platform */}
            <mesh position={[0, 0, 0.3]}>
              <boxGeometry args={[1.5, 0.05, 0.6]} />
              <meshStandardMaterial color="#2e2a26" metalness={0.6} roughness={0.6} />
            </mesh>
            {/* railing */}
            <mesh position={[0, 0.28, 0.58]}>
              <boxGeometry args={[1.5, 0.03, 0.03]} />
              <meshStandardMaterial color="#2e2a26" metalness={0.6} roughness={0.6} />
            </mesh>
            {[-0.7, -0.23, 0.23, 0.7].map((x) => (
              <mesh key={x} position={[x, 0.14, 0.58]}>
                <boxGeometry args={[0.025, 0.28, 0.025]} />
                <meshStandardMaterial color="#2e2a26" metalness={0.6} roughness={0.6} />
              </mesh>
            ))}
            {/* zig-zag stair */}
            <mesh position={[f % 2 ? -0.5 : 0.5, -fh / 2, 0.3]} rotation={[0, 0, f % 2 ? 0.9 : -0.9]}>
              <boxGeometry args={[0.08, fh * 1.15, 0.5]} />
              <meshStandardMaterial color="#332e29" metalness={0.5} roughness={0.7} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

interface BuildingProps {
  x: number; z: number; w: number; h: number; floors: number; cols: number;
  tone?: 0 | 1 | 2; decay?: number; rotY?: number; seed: number;
  fireEscape?: boolean; waterTower?: boolean; antenna?: boolean; sapling?: boolean;
  /** heavy structural damage: collapsed roof, rebar, missing corner, rubble */
  ruined?: boolean;
}

/** Structural damage kit for the most far-gone buildings. */
function StructuralDecay({ w, h, d, side }: { w: number; h: number; d: number; side: string }) {
  return (
    <group>
      {/* collapsed roof slab, fallen inward */}
      <mesh position={[-w * 0.12, h - w * 0.16, 0]} rotation={[0.12, 0.2, 0.5]}>
        <boxGeometry args={[w * 0.62, 0.16, d * 0.7]} />
        <meshStandardMaterial color={side} roughness={1} />
      </mesh>
      {/* missing top corner — dark interior void */}
      <mesh position={[w / 2 - w * 0.14, h - w * 0.12, 0]}>
        <boxGeometry args={[w * 0.3, w * 0.26, d + 0.06]} />
        <meshStandardMaterial color="#0c0b09" roughness={1} />
      </mesh>
      {/* exposed floor slabs visible through the missing corner */}
      {[0.3, 0.55, 0.8].map((f, i) => (
        <mesh key={`slab${i}`} position={[w / 2 - w * 0.14, h * f, 0]}>
          <boxGeometry args={[w * 0.3, 0.08, d * 0.9]} />
          <meshStandardMaterial color="#5a564c" roughness={1} />
        </mesh>
      ))}
      {[0.42, 0.68].map((f, i) => (
        <mesh key={`col${i}`} position={[w / 2 - w * 0.2, h * f + h * 0.12, d * 0.2]}>
          <cylinderGeometry args={[0.05, 0.05, h * 0.24, 6]} />
          <meshStandardMaterial color="#4a463e" roughness={1} />
        </mesh>
      ))}
      {/* exposed steel beams jutting from the break */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[w / 2 - w * 0.12 + i * 0.12, h - w * 0.02 + i * 0.05, d * 0.12 * (i - 1)]}
          rotation={[0.2 * (i - 1), 0, 0.7 + i * 0.25]}
        >
          <cylinderGeometry args={[0.022, 0.022, w * 0.34, 5]} />
          <meshStandardMaterial color="#3a2c20" metalness={0.6} roughness={0.6} />
        </mesh>
      ))}
      {/* broken balcony hanging by one anchor */}
      <group position={[-w * 0.3, h * 0.55, d / 2 + 0.14]} rotation={[0.4, 0, -0.3]}>
        <mesh>
          <boxGeometry args={[w * 0.26, 0.06, 0.4]} />
          <meshStandardMaterial color="#4c453c" roughness={1} />
        </mesh>
        <mesh position={[0, 0.14, 0.18]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[w * 0.26, 0.16, 0.03]} />
          <meshStandardMaterial color="#3c362e" metalness={0.4} roughness={0.8} />
        </mesh>
      </group>
      {/* rubble apron at the base */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          position={[w * (0.32 - i * 0.14), 0.1 + (i % 2) * 0.08, d / 2 + 0.3 + (i % 3) * 0.18]}
          rotation={[i, i * 1.7, 0]}
        >
          <boxGeometry args={[0.28 - i * 0.03, 0.2, 0.24]} />
          <meshStandardMaterial color={i % 2 ? side : '#55514a'} roughness={1} />
        </mesh>
      ))}
      {/* vines spilling out of the broken corner */}
      <mesh position={[w / 2 - w * 0.14, h - w * 0.26, d / 2 + 0.08]}>
        <boxGeometry args={[w * 0.24, w * 0.3, 0.1]} />
        <meshStandardMaterial color="#42502e" roughness={1} />
      </mesh>
    </group>
  );
}

function BrickBuilding({ x, z, w, h, floors, cols, tone = 0, decay = 0.5, rotY = 0, seed, fireEscape, waterTower, antenna, sapling, ruined }: BuildingProps) {
  const facade = useMemo(() => brickFacade({ seed, floors, cols, decay, tone }), [seed, floors, cols, decay, tone]);
  const side = ['#6a4a3a', '#7a6a50', '#5d5a50'][tone];
  const ivy = useMemo(() => leafCluster(seed + 40, 'ivy'), [seed]);
  const vineSway = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (vineSway.current) vineSway.current.rotation.x = Math.sin(clock.elapsedTime * 0.4 + seed) * 0.02;
  });
  const d = w * 0.85;

  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      {/* body — textured front, tinted brick sides */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial attach="material-0" color={side} roughness={1} />
        <meshStandardMaterial attach="material-1" color={side} roughness={1} />
        <meshStandardMaterial attach="material-2" color="#55504a" roughness={1} />
        <meshStandardMaterial attach="material-3" color="#3a362f" roughness={1} />
        <meshStandardMaterial attach="material-4" map={facade} roughness={0.95} />
        <meshStandardMaterial attach="material-5" color={side} roughness={1} />
      </mesh>
      {/* parapet */}
      <mesh position={[0, h + 0.12, 0]}>
        <boxGeometry args={[w + 0.16, 0.24, d + 0.16]} />
        <meshStandardMaterial color="#4c453c" roughness={1} />
      </mesh>
      {/* roof gutter pipe down one corner */}
      <mesh position={[-w / 2 + 0.12, h / 2, d / 2 + 0.05]}>
        <cylinderGeometry args={[0.04, 0.04, h, 6]} />
        <meshStandardMaterial color="#3c342c" metalness={0.4} roughness={0.7} />
      </mesh>

      {fireEscape && <FireEscape w={w} floors={floors} h={h} />}

      {/* rooftop equipment */}
      {waterTower && (
        <group position={[w * 0.2, h + 0.24, -d * 0.15]}>
          {[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, 0.55, lz]}>
              <cylinderGeometry args={[0.04, 0.05, 1.1, 6]} />
              <meshStandardMaterial color="#3a3028" roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.62, 0.55, 1.1, 12]} />
            <meshStandardMaterial color="#5c4632" roughness={0.95} />
          </mesh>
          <mesh position={[0, 2.25, 0]}>
            <coneGeometry args={[0.68, 0.5, 12]} />
            <meshStandardMaterial color="#463527" roughness={0.95} />
          </mesh>
        </group>
      )}
      <mesh position={[-w * 0.24, h + 0.45, d * 0.1]}>
        <boxGeometry args={[0.9, 0.5, 0.7]} />
        <meshStandardMaterial color="#565048" metalness={0.35} roughness={0.8} />
      </mesh>
      {antenna && (
        <group position={[w * 0.34, h + 0.24, d * 0.2]}>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.015, 0.03, 1.6, 5]} />
            <meshStandardMaterial color="#2e2a26" metalness={0.6} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.01, 0.01, 0.5, 4]} />
            <meshStandardMaterial color="#2e2a26" metalness={0.6} roughness={0.6} />
          </mesh>
        </group>
      )}
      {sapling && (
        <group position={[-w * 0.3, h + 0.24, -d * 0.2]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.03, 0.05, 0.6, 5]} />
            <meshStandardMaterial color="#4a3b2a" roughness={1} />
          </mesh>
          {[0, 1].map((k) => (
            <mesh key={k} position={[0, 0.75, 0]} rotation={[0, (k * Math.PI) / 2, 0]}>
              <planeGeometry args={[0.9, 0.8]} />
              <meshStandardMaterial map={ivy} transparent alphaTest={0.35} side={DoubleSide} roughness={1} />
            </mesh>
          ))}
        </group>
      )}

      {/* ivy drape over the facade + hanging vines */}
      <group ref={vineSway}>
        <mesh position={[-w * 0.18, h * 0.34, d / 2 + 0.06]}>
          <planeGeometry args={[w * 0.5, h * 0.66]} />
          <meshStandardMaterial map={ivy} transparent alphaTest={0.3} side={DoubleSide} roughness={1} opacity={0.95} />
        </mesh>
        <mesh position={[w * 0.3, h - h * 0.22, d / 2 + 0.07]}>
          <planeGeometry args={[w * 0.24, h * 0.44]} />
          <meshStandardMaterial map={ivy} transparent alphaTest={0.32} side={DoubleSide} roughness={1} />
        </mesh>
      </group>

      {ruined && <StructuralDecay w={w} h={h} d={d} side={side} />}

      <Blob x={0} z={d / 2 + 0.4} r={w * 0.55} o={0.3} />
    </group>
  );
}

function NearBuildings() {
  return (
    <group>
      <BrickBuilding x={-13.5} z={-16} w={6.5} h={12} floors={4} cols={4} tone={0} decay={0.55} rotY={0.12} seed={11} fireEscape waterTower />
      <BrickBuilding x={-21} z={-13} w={5.5} h={8.5} floors={3} cols={3} tone={1} decay={0.85} rotY={0.3} seed={12} antenna ruined />
      <BrickBuilding x={13} z={-17} w={7} h={14.5} floors={5} cols={4} tone={2} decay={0.45} rotY={-0.14} seed={13} fireEscape antenna sapling />
      <BrickBuilding x={21.5} z={-13.5} w={5} h={9.5} floors={3} cols={3} tone={0} decay={0.9} rotY={-0.32} seed={14} waterTower sapling ruined />
      <BrickBuilding x={-1.5} z={-27} w={9} h={16} floors={5} cols={5} tone={1} decay={0.5} seed={15} antenna waterTower />
      <BrickBuilding x={8.5} z={-25} w={6} h={11} floors={4} cols={3} tone={0} decay={0.6} rotY={-0.08} seed={16} sapling />
    </group>
  );
}

function FarSkyline() {
  const defs = useMemo(() => {
    const r = seeded(9);
    return Array.from({ length: 11 }, (_, i) => ({
      x: -46 + i * 9 + (r() - 0.5) * 4,
      z: -38 - r() * 12,
      w: 6 + r() * 5,
      h: 13 + r() * 21,
      floors: 8 + Math.floor(r() * 8),
      cols: 4 + Math.floor(r() * 3),
      seed: 60 + i,
    }));
  }, []);
  return (
    <group>
      {defs.map((d, i) => (
        <FarTower key={i} {...d} />
      ))}
      {/* plugs the bright sky gap right of the monitor wall */}
      <FarTower x={13.5} z={-44} w={8} h={30} floors={12} cols={5} seed={57} />
    </group>
  );
}

function FarTower({ x, z, w, h, floors, cols, seed }: { x: number; z: number; w: number; h: number; floors: number; cols: number; seed: number }) {
  const tex = useMemo(() => distantFacade(seed, floors, cols), [seed, floors, cols]);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, w * 0.8]} />
        <meshStandardMaterial attach="material-0" color="#5f5b52" roughness={1} />
        <meshStandardMaterial attach="material-1" color="#524e46" roughness={1} />
        <meshStandardMaterial attach="material-2" color="#575349" roughness={1} />
        <meshStandardMaterial attach="material-3" color="#3f3c35" roughness={1} />
        <meshStandardMaterial attach="material-4" map={tex} roughness={1} />
        <meshStandardMaterial attach="material-5" color="#575349" roughness={1} />
      </mesh>
      {/* jagged broken crown on some */}
      {seed % 3 === 0 && (
        <mesh position={[w * 0.15, h + w * 0.1, 0]} rotation={[0.1, 0.4, 0.3]}>
          <boxGeometry args={[w * 0.6, w * 0.4, w * 0.5]} />
          <meshStandardMaterial color="#575349" roughness={1} />
        </mesh>
      )}
      {seed % 2 === 0 && (
        <mesh position={[-w * 0.2, h + 0.9, 0]}>
          <cylinderGeometry args={[0.03, 0.05, 1.8, 4]} />
          <meshStandardMaterial color="#4a463e" roughness={0.8} />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Utility poles + sagging wires. Crows perch at the sag points.      */
/* ------------------------------------------------------------------ */

export const POLES: [number, number][] = [[-16, -11.5], [-6, -12.2], [4, -12.6], [14, -12.2]];
export const WIRE_SAGS: [number, number, number][] = [[-11, 4.05, -11.85], [-1, 4.0, -12.4], [9, 4.05, -12.4]];

function UtilityLines() {
  const wires = useMemo(() => {
    const curves: CatmullRomCurve3[] = [];
    for (let i = 0; i < POLES.length - 1; i++) {
      const [x1, z1] = POLES[i];
      const [x2, z2] = POLES[i + 1];
      for (const dy of [0, -0.35]) {
        curves.push(
          new CatmullRomCurve3([
            new Vector3(x1, 4.55 + dy, z1),
            new Vector3((x1 + x2) / 2, 4.05 + dy, (z1 + z2) / 2),
            new Vector3(x2, 4.55 + dy, z2),
          ]),
        );
      }
    }
    return curves;
  }, []);

  return (
    <group>
      {POLES.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.4, 0]}>
            <cylinderGeometry args={[0.08, 0.11, 4.8, 7]} />
            <meshStandardMaterial color="#4a3d2e" roughness={1} />
          </mesh>
          <mesh position={[0, 4.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.12, 1.5, 0.09]} />
            <meshStandardMaterial color="#42362a" roughness={1} />
          </mesh>
          {/* creeper wrapping the pole */}
          <mesh position={[0.03, 1.3, 0.03]}>
            <cylinderGeometry args={[0.11, 0.13, 2.6, 6]} />
            <meshStandardMaterial color="#44522f" roughness={1} />
          </mesh>
          <Blob x={0} z={0} r={0.35} o={0.3} />
        </group>
      ))}
      {wires.map((c, i) => (
        <mesh key={i}>
          <tubeGeometry args={[c, 16, 0.011, 4]} />
          <meshStandardMaterial color="#181614" roughness={0.8} />
        </mesh>
      ))}
      {/* snapped wire dangling from the last pole */}
      <mesh position={[14, 3.4, -12.2]} rotation={[0.3, 0, 0.5]}>
        <cylinderGeometry args={[0.01, 0.01, 2.4, 4]} />
        <meshStandardMaterial color="#181614" roughness={0.8} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Vegetation — grass cards, ferns, bushes, trees with leaf canopies. */
/* ------------------------------------------------------------------ */

function GrassField() {
  const texLush = useMemo(() => grassCard(3, 'lush'), []);
  const texMixed = useMemo(() => grassCard(7, 'mixed'), []);
  const texDead = useMemo(() => grassCard(13, 'dead'), []);

  const clumps = useMemo(() => {
    const r = seeded(77);
    const arr: { x: number; z: number; s: number; rot: number; tint: number; kind: number; sway: number; phase: number }[] = [];
    for (let i = 0; i < 1400; i++) {
      let x = 0, z = 0;
      do {
        x = (r() - 0.5) * 50;
        z = -18 + r() * 23.5;
      } while (Math.abs(x) < 3.4 && z > -5.4 && z < 2.2);
      arr.push({
        x, z,
        s: 0.45 + r() * r() * 1.15,
        rot: r() * Math.PI,
        tint: 0.7 + r() * 0.55,
        kind: r() < 0.14 ? 2 : r() < 0.55 ? 1 : 0,
        sway: r() < 0.18 ? 0.5 + r() * 0.8 : 0,
        phase: r() * Math.PI * 2,
      });
    }
    // thicker growth hugging the building foundations
    const bases: [number, number][] = [[-13.5, -13.2], [-21, -10.6], [13, -14], [21.5, -11.4], [-1.5, -23.2], [8.5, -22.4]];
    for (const [bx, bz] of bases) {
      for (let i = 0; i < 14; i++) {
        arr.push({
          x: bx + (r() - 0.5) * 6,
          z: bz + r() * 1.6,
          s: 0.5 + r() * 1.0,
          rot: r() * Math.PI,
          tint: 0.7 + r() * 0.5,
          kind: r() < 0.3 ? 2 : r() < 0.6 ? 1 : 0,
          sway: 0,
          phase: 0,
        });
      }
    }
    return arr;
  }, []);

  const groupsByKind = useMemo(
    () => [0, 1, 2].map((k) => clumps.filter((c) => c.kind === k)),
    [clumps],
  );
  const refs = [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)];
  const refsB = [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)];

  useLayoutEffect(() => {
    groupsByKind.forEach((list, k) => {
      for (const mesh of [refs[k].current, refsB[k].current]) {
        if (!mesh) continue;
        list.forEach((cl, i) => {
          dummy.position.set(cl.x, cl.s * 0.5, cl.z);
          dummy.rotation.set(0, cl.rot + (mesh === refsB[k].current ? Math.PI / 2 : 0), 0);
          dummy.scale.set(cl.s * 1.4, cl.s, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, tmpColor.setScalar(cl.tint));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsByKind]);

  // wind: re-pose only the swaying subset
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    groupsByKind.forEach((list, k) => {
      const meshes = [refs[k].current, refsB[k].current];
      list.forEach((cl, i) => {
        if (!cl.sway) return;
        meshes.forEach((mesh, mi) => {
          if (!mesh) return;
          dummy.position.set(cl.x, cl.s * 0.5, cl.z);
          dummy.rotation.set(0, cl.rot + (mi ? Math.PI / 2 : 0), Math.sin(t * cl.sway + cl.phase) * 0.09);
          dummy.scale.set(cl.s * 1.4, cl.s, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        });
      });
      meshes.forEach((m) => m && (m.instanceMatrix.needsUpdate = true));
    });
  });

  const textures = [texLush, texMixed, texDead];
  return (
    <group>
      {[0, 1, 2].map((k) => (
        <group key={k}>
          <instancedMesh ref={refs[k]} args={[undefined, undefined, groupsByKind[k].length]} frustumCulled={false}>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial map={textures[k]} transparent alphaTest={0.4} side={DoubleSide} roughness={1} />
          </instancedMesh>
          <instancedMesh ref={refsB[k]} args={[undefined, undefined, groupsByKind[k].length]} frustumCulled={false}>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial map={textures[k]} transparent alphaTest={0.4} side={DoubleSide} roughness={1} />
          </instancedMesh>
        </group>
      ))}
    </group>
  );
}

function Ferns() {
  const tex = useMemo(() => leafCluster(21, 'fern'), []);
  const spots: [number, number, number][] = [
    [-12.2, -14.2, 1.1], [-14.6, -13.6, 0.8], [12.2, -15.2, 1.0], [20.4, -12.2, 0.9],
    [-20.2, -11.6, 1.2], [-2.6, -25.2, 1.3], [7.4, -23.4, 1.0],
  ];
  return (
    <group>
      {spots.map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]}>
          {[0, 1].map((k) => (
            <mesh key={k} position={[0, s * 0.42, 0]} rotation={[0, (k * Math.PI) / 2 + i, 0]}>
              <planeGeometry args={[s * 1.5, s]} />
              <meshStandardMaterial map={tex} transparent alphaTest={0.35} side={DoubleSide} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Bushes() {
  const tex = useMemo(() => leafCluster(33, 'canopy'), []);
  const spots: [number, number, number][] = [
    [-9.4, -7.4, 1.2], [11.2, -6.6, 1.4], [-17, -9, 1.6], [17.8, -9.8, 1.3], [2.2, -13.6, 1.5], [-24, -14, 1.8],
  ];
  return (
    <group>
      {spots.map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, s * 0.4, 0]} rotation={[0, (k * Math.PI) / 3 + i * 1.3, 0]}>
              <planeGeometry args={[s * 1.6, s]} />
              <meshStandardMaterial map={tex} transparent alphaTest={0.4} side={DoubleSide} roughness={1} />
            </mesh>
          ))}
          <Blob x={0} z={0} r={s * 0.7} o={0.28} />
        </group>
      ))}
    </group>
  );
}

function Tree({ position, scale = 1, seed }: { position: [number, number, number]; scale?: number; seed: number }) {
  const tex = useMemo(() => leafCluster(seed, 'canopy'), [seed]);
  const foliage = useRef<Group>(null);
  const phase = seed * 1.7;
  useFrame(({ clock }) => {
    if (foliage.current) {
      foliage.current.rotation.z = Math.sin(clock.elapsedTime * 0.5 + phase) * 0.02;
      foliage.current.rotation.x = Math.cos(clock.elapsedTime * 0.37 + phase) * 0.014;
    }
  });
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.09, 0.17, 2.2, 7]} />
        <meshStandardMaterial color="#463726" roughness={1} />
      </mesh>
      {/* main limbs */}
      <mesh position={[0.25, 2.05, 0.1]} rotation={[0.2, 0, -0.7]}>
        <cylinderGeometry args={[0.04, 0.07, 0.9, 5]} />
        <meshStandardMaterial color="#463726" roughness={1} />
      </mesh>
      <mesh position={[-0.22, 2.1, -0.08]} rotation={[-0.15, 0, 0.65]}>
        <cylinderGeometry args={[0.035, 0.06, 0.8, 5]} />
        <meshStandardMaterial color="#3f3222" roughness={1} />
      </mesh>
      <group ref={foliage} position={[0, 2.6, 0]}>
        {[0, 1, 2, 3, 4].map((k) => (
          <mesh
            key={k}
            position={[Math.sin(k * 2.4 + seed) * 0.5, (k % 3) * 0.35 - 0.2, Math.cos(k * 2.4 + seed) * 0.4]}
            rotation={[0, (k * Math.PI) / 2.5 + seed, (k % 2) * 0.2 - 0.1]}
          >
            <planeGeometry args={[2.2, 1.7]} />
            <meshStandardMaterial map={tex} transparent alphaTest={0.38} side={DoubleSide} roughness={1} />
          </mesh>
        ))}
      </group>
      <Blob x={0} z={0} r={1.1} o={0.3} />
    </group>
  );
}

function Trees() {
  const spots: [number, number, number, number][] = [
    [-7.5, -6.5, 1.5, 41], [8.5, -7, 1.2, 42], [-13, -11.5, 2.0, 43], [15.5, -11, 1.7, 44],
    [-19.5, -8, 1.4, 45], [23, -9, 1.6, 46], [-5, -14, 2.3, 47], [5.5, -15.5, 1.9, 48],
    [-26, -18, 2.5, 49], [27, -19, 2.2, 50], [10, -3.2, 0.9, 51], [-11, -3.6, 0.85, 52],
  ];
  return (
    <group>
      {spots.map(([x, z, s, seed]) => (
        <Tree key={seed} position={[x, 0, z]} scale={s} seed={seed} />
      ))}
    </group>
  );
}

/** Dark blurred forest mass filling gaps before the skyline. */
function TreeLine() {
  const tex = useMemo(() => leafCluster(88, 'canopy'), []);
  const blobs = useMemo(() => {
    const r = seeded(23);
    return Array.from({ length: 30 }, (_, i) => ({
      x: -44 + i * 3 + (r() - 0.5) * 2.4,
      z: -29 - r() * 6,
      s: 3 + r() * 3.4,
      rot: r() * Math.PI,
    }));
  }, []);
  return (
    <group>
      {blobs.map((b, i) => (
        <mesh key={i} position={[b.x, b.s * 0.42, b.z]} rotation={[0, b.rot, 0]}>
          <planeGeometry args={[b.s * 1.7, b.s]} />
          <meshStandardMaterial map={tex} transparent alphaTest={0.35} side={DoubleSide} roughness={1} color="#5c6650" />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Abandoned props — checkpoint remnants, vehicles, street furniture. */
/* ------------------------------------------------------------------ */

function RustedCar({ position, rotation = 0, tone }: { position: [number, number, number]; rotation?: number; tone: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0.02]}>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[1.7, 0.42, 0.78]} />
        <meshStandardMaterial color={tone} roughness={0.9} metalness={0.25} />
      </mesh>
      <mesh position={[-0.1, 0.62, 0]}>
        <boxGeometry args={[0.9, 0.34, 0.72]} />
        <meshStandardMaterial color="#1d1b15" roughness={1} />
      </mesh>
      <mesh position={[-0.1, 0.6, 0]} scale={[1.04, 0.9, 1.06]}>
        <boxGeometry args={[0.9, 0.3, 0.68]} />
        <meshStandardMaterial color={tone} roughness={0.9} metalness={0.25} transparent opacity={0.0} />
      </mesh>
      {[[-0.55, 0.3], [0.55, 0.3], [-0.55, -0.3], [0.55, -0.3]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.13, z]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.7]}>
          <torusGeometry args={[0.13, 0.055, 6, 12]} />
          <meshStandardMaterial color="#22201a" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0.55, 0.55, 0]} rotation={[-0.06, 0, 0.1]}>
        <boxGeometry args={[0.65, 0.06, 0.7]} />
        <meshStandardMaterial color="#4c5a34" roughness={1} />
      </mesh>
      <mesh position={[-0.1, 0.81, 0.1]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.5, 0.05, 0.4]} />
        <meshStandardMaterial color="#42502e" roughness={1} />
      </mesh>
      <Blob x={0} z={0} r={1} sx={1.6} o={0.4} />
    </group>
  );
}

function MilitaryTruck() {
  const olive = '#4a4a32';
  return (
    <group position={[-16.5, 0, -8.6]} rotation={[0, 0.42, 0.015]}>
      {/* chassis + cab */}
      <mesh position={[0, 0.62, 0]}>
        <boxGeometry args={[3.4, 0.34, 1.3]} />
        <meshStandardMaterial color="#3a3a28" roughness={0.95} metalness={0.2} />
      </mesh>
      <mesh position={[1.3, 1.05, 0]}>
        <boxGeometry args={[0.9, 0.7, 1.24]} />
        <meshStandardMaterial color={olive} roughness={0.95} metalness={0.2} />
      </mesh>
      <mesh position={[1.28, 1.14, 0]} scale={[0.9, 0.55, 1.02]}>
        <boxGeometry args={[0.9, 0.7, 1.24]} />
        <meshStandardMaterial color="#14140f" roughness={1} />
      </mesh>
      <mesh position={[1.95, 0.72, 0]}>
        <boxGeometry args={[0.45, 0.5, 1.2]} />
        <meshStandardMaterial color={olive} roughness={0.95} />
      </mesh>
      {/* canvas cargo cover, sagging */}
      <mesh position={[-0.55, 1.22, 0]}>
        <boxGeometry args={[2.1, 0.85, 1.26]} />
        <meshStandardMaterial color="#55543a" roughness={1} />
      </mesh>
      <mesh position={[-0.55, 1.68, 0]} rotation={[0, 0, 0.02]}>
        <cylinderGeometry args={[0.64, 0.64, 2.1, 8, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#4c4b34" roughness={1} />
      </mesh>
      {/* wheels */}
      {[[-1.35, 0.62], [-0.35, 0.62], [1.45, 0.62], [-1.35, -0.62], [-0.35, -0.62], [1.45, -0.62]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.3, z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.24, 0.11, 7, 14]} />
          <meshStandardMaterial color="#1c1a16" roughness={1} />
        </mesh>
      ))}
      {/* moss + vines consuming it */}
      <mesh position={[-0.4, 1.9, 0.2]} rotation={[0.1, 0.3, 0]}>
        <boxGeometry args={[1.4, 0.08, 0.9]} />
        <meshStandardMaterial color="#48562f" roughness={1} />
      </mesh>
      <mesh position={[1.3, 1.5, 0.4]} rotation={[0.3, 0, 0.2]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color="#42502e" roughness={1} />
      </mesh>
      <Blob x={0} z={0} r={1.9} sx={1.8} o={0.42} />
    </group>
  );
}

function Checkpoint() {
  return (
    <group position={[7.5, 0, -7.2]} rotation={[0, -0.2, 0]}>
      {/* sandbag emplacement */}
      {[0, 1, 2].map((row) =>
        Array.from({ length: 5 - row }, (_, i) => (
          <mesh key={`${row}-${i}`} position={[i * 0.42 + row * 0.2 - 0.9, 0.12 + row * 0.2, 0]} rotation={[Math.PI / 2, 0, (i % 2) * 0.2]}>
            <capsuleGeometry args={[0.11, 0.24, 4, 8]} />
            <meshStandardMaterial color={row % 2 ? '#8a7a5c' : '#7d6e52'} roughness={1} />
          </mesh>
        )),
      )}
      {/* supply crates */}
      <mesh position={[1.3, 0.22, 0.3]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.5, 0.44, 0.5]} />
        <meshStandardMaterial color="#5c4c34" roughness={1} />
      </mesh>
      <mesh position={[1.6, 0.16, -0.25]} rotation={[0, -0.2, 0.05]}>
        <boxGeometry args={[0.44, 0.32, 0.44]} />
        <meshStandardMaterial color="#6a5a40" roughness={1} />
      </mesh>
      {/* medical container */}
      <mesh position={[1.05, 0.55, 0.32]} rotation={[0, 0.3, -0.06]}>
        <boxGeometry args={[0.36, 0.24, 0.3]} />
        <meshStandardMaterial color="#8a8578" roughness={0.9} />
      </mesh>
      <mesh position={[1.05, 0.56, 0.475]} rotation={[0, 0.3, 0]}>
        <planeGeometry args={[0.14, 0.14]} />
        <meshStandardMaterial color="#8a4038" roughness={0.9} />
      </mesh>
      {/* faded warning sign, leaning */}
      <group position={[-1.7, 0, 0.4]} rotation={[0.08, 0.3, 0.14]}>
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.03, 0.04, 1.3, 6]} />
          <meshStandardMaterial color="#4c463c" metalness={0.4} roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.25, 0.02]}>
          <boxGeometry args={[0.7, 0.5, 0.03]} />
          <meshStandardMaterial color="#8a7a4a" roughness={0.95} />
        </mesh>
        <mesh position={[0, 1.25, 0.04]}>
          <planeGeometry args={[0.6, 0.12]} />
          <meshStandardMaterial color="#6a3a30" roughness={1} />
        </mesh>
      </group>
      {/* abandoned backpack */}
      <mesh position={[0.5, 0.16, 0.55]} rotation={[0.3, 0.8, 0.2]}>
        <boxGeometry args={[0.26, 0.34, 0.16]} />
        <meshStandardMaterial color="#4c5040" roughness={1} />
      </mesh>
      <Blob x={0} z={0} r={1.5} sx={1.6} o={0.32} />
    </group>
  );
}

/** Rubble & debris scattered across the asphalt. */
function RoadDebris() {
  const COUNT = 42;
  const ref = useRef<InstancedMesh>(null);
  const rocks = useMemo(() => {
    const r = seeded(53);
    return Array.from({ length: COUNT }, () => ({
      x: (r() - 0.5) * 42, z: -12.4 + r() * 6.6, s: 0.05 + r() * 0.16,
      ry: r() * Math.PI, tone: 0.75 + r() * 0.5,
    }));
  }, []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    rocks.forEach((k, i) => {
      dummy.position.set(k.x, k.s * 0.4, k.z);
      dummy.rotation.set(k.ry, k.ry * 2, 0);
      dummy.scale.set(k.s * 1.4, k.s, k.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tmpColor.set('#5c584e').multiplyScalar(k.tone));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [rocks]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
}

/** Heavily rusted pickup, collapsed on flat tires, one door gone. */
function RustedPickup() {
  return (
    <group position={[-6.2, 0, -11.8]} rotation={[0, 2.6, 0.025]}>
      {/* body dropped low on dead suspension */}
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[2.3, 0.34, 0.95]} />
        <meshStandardMaterial color="#6e4a30" roughness={0.95} metalness={0.2} />
      </mesh>
      {/* cab with hollow windows */}
      <mesh position={[0.45, 0.66, 0]}>
        <boxGeometry args={[0.85, 0.4, 0.9]} />
        <meshStandardMaterial color="#654428" roughness={0.95} metalness={0.2} />
      </mesh>
      <mesh position={[0.45, 0.68, 0]} scale={[0.9, 0.75, 1.03]}>
        <boxGeometry args={[0.85, 0.4, 0.9]} />
        <meshStandardMaterial color="#141210" roughness={1} />
      </mesh>
      {/* missing driver door — dark opening */}
      <mesh position={[0.45, 0.45, 0.48]}>
        <planeGeometry args={[0.6, 0.42]} />
        <meshStandardMaterial color="#0e0c0a" roughness={1} />
      </mesh>
      {/* open truck bed with dirt + weeds inside */}
      <mesh position={[-0.65, 0.53, 0]}>
        <boxGeometry args={[1.0, 0.05, 0.86]} />
        <meshStandardMaterial color="#3c3226" roughness={1} />
      </mesh>
      <mesh position={[-0.6, 0.62, 0.1]}>
        <sphereGeometry args={[0.22, 7, 6]} />
        <meshStandardMaterial color="#44522f" roughness={1} />
      </mesh>
      {/* rust streak panels */}
      <mesh position={[0.2, 0.34, 0.478]}>
        <planeGeometry args={[0.7, 0.28]} />
        <meshStandardMaterial color="#7a4218" roughness={1} />
      </mesh>
      {/* flat perished tires */}
      {[[0.75, 0.5], [-0.75, 0.5], [0.75, -0.5], [-0.75, -0.5]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.12, z]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]}>
          <torusGeometry args={[0.17, 0.075, 6, 12]} />
          <meshStandardMaterial color="#1c1a16" roughness={1} />
        </mesh>
      ))}
      {/* vines wrapping the cab */}
      <mesh position={[0.6, 0.75, 0.2]} rotation={[0.3, 0.5, 0.2]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color="#42502e" roughness={1} />
      </mesh>
      <mesh position={[0, 0.55, -0.42]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[1.4, 0.05, 0.3]} />
        <meshStandardMaterial color="#4c5a34" roughness={1} />
      </mesh>
      <Blob x={0} z={0} r={1.25} sx={1.8} o={0.42} />
    </group>
  );
}

function StreetClutter() {
  return (
    <group>
      {/* concrete barriers half-buried in growth */}
      {[[-3.2, -6.3, 0.25], [-1.4, -6.4, -0.1], [18.5, -11.6, 0.4]].map(([x, z, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, (i % 2) * 0.04]}>
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.18, 0.42, 0.64, 4]} />
            <meshStandardMaterial color="#726d60" roughness={1} />
          </mesh>
          <mesh position={[0.1, 0.2, 0.2]} rotation={[0, i, 0]}>
            <sphereGeometry args={[0.3, 6, 5]} />
            <meshStandardMaterial color="#4c5a34" roughness={1} />
          </mesh>
        </group>
      ))}
      {/* fallen traffic light across the sidewalk */}
      <group position={[10.8, 0, -5.6]} rotation={[0, 0.5, Math.PI / 2 - 0.06]}>
        <mesh position={[0, 1.7, 0]}>
          <cylinderGeometry args={[0.06, 0.08, 3.4, 7]} />
          <meshStandardMaterial color="#3c3a32" metalness={0.4} roughness={0.8} />
        </mesh>
        <mesh position={[0, 3.5, 0]}>
          <boxGeometry args={[0.24, 0.62, 0.2]} />
          <meshStandardMaterial color="#33312a" roughness={0.9} />
        </mesh>
        {[0.18, 0, -0.18].map((dy, i) => (
          <mesh key={i} position={[0, 3.5 + dy, 0.11]}>
            <circleGeometry args={[0.055, 10]} />
            <meshStandardMaterial color={['#4a2620', '#4a3d1d', '#22321c'][i]} roughness={0.6} />
          </mesh>
        ))}
      </group>
      {/* rusted shopping cart on its side */}
      <group position={[-10.6, 0.16, -6.1]} rotation={[0, 1.1, Math.PI / 2.2]}>
        <mesh>
          <boxGeometry args={[0.55, 0.4, 0.4]} />
          <meshStandardMaterial color="#5a4838" metalness={0.5} roughness={0.7} wireframe />
        </mesh>
        {[[-0.2, -0.28], [0.2, -0.28]].map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.05, 0.015, 5, 8]} />
            <meshStandardMaterial color="#3a3028" roughness={0.8} />
          </mesh>
        ))}
      </group>
      <RustedCar position={[-13.5, 0, -9.4]} rotation={0.55} tone="#6e5136" />
      <RustedCar position={[16.8, 0, -8.2]} rotation={-2.7} tone="#5a5f63" />
      <RustedCar position={[3.2, 0, -11.9]} rotation={2.9} tone="#71463a" />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Sky life — drifting clouds and low mist.                           */
/* ------------------------------------------------------------------ */

function Clouds() {
  const tex = useMemo(() => cloudPuff(5), []);
  const tex2 = useMemo(() => cloudPuff(9), []);
  const refs = useRef<(Group | null)[]>([]);
  const defs = useMemo(() => {
    const r = seeded(15);
    return Array.from({ length: 6 }, (_, i) => ({
      x0: -60 + r() * 120, y: 24 + r() * 14, z: -55 - r() * 25, s: 16 + r() * 18, speed: 0.12 + r() * 0.18, alt: i % 2,
    }));
  }, []);

  useFrame(({ clock }) => {
    defs.forEach((d, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.x = ((d.x0 + clock.elapsedTime * d.speed + 90) % 180) - 90;
    });
  });

  return (
    <group>
      {defs.map((d, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[d.x0, d.y, d.z]}
        >
          <mesh>
            <planeGeometry args={[d.s, d.s * 0.4]} />
            <meshBasicMaterial map={d.alt ? tex : tex2} transparent depthWrite={false} opacity={0.38} />
          </mesh>
        </group>
      ))}
      {/* low drifting mist between the ruins */}
      {[[-14, 1.1, -24, 26], [12, 0.8, -30, 30]].map(([x, y, z, s], i) => (
        <MistPlane key={i} x={x} y={y} z={z} s={s} tex={i ? tex : tex2} phase={i * 3} />
      ))}
    </group>
  );
}

function MistPlane({ x, y, z, s, tex, phase }: { x: number; y: number; z: number; s: number; tex: any; phase: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.x = x + Math.sin(clock.elapsedTime * 0.05 + phase) * 3;
    }
  });
  return (
    <group ref={ref} position={[x, y, z]}>
      <mesh>
        <planeGeometry args={[s, s * 0.16]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.5} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Atmosphere particles + god rays.                                   */
/* ------------------------------------------------------------------ */

function Pollen() {
  const ref = useRef<Points>(null);
  const { positions, speeds } = useMemo(() => {
    const r = seeded(11);
    const n = 300;
    const pos = new Float32Array(n * 3);
    const spd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (r() - 0.5) * 26;
      pos[i * 3 + 1] = 0.2 + r() * 7;
      pos[i * 3 + 2] = -16 + r() * 20;
      spd[i] = 0.1 + r() * 0.3;
    }
    return { positions: pos, speeds: spd };
  }, []);

  useFrame(({ clock }, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const arr = pts.geometry.attributes.position.array as Float32Array;
    const t = clock.elapsedTime;
    for (let i = 0; i < speeds.length; i++) {
      arr[i * 3] += Math.sin(t * 0.4 + i * 1.3) * dt * 0.12;
      arr[i * 3 + 1] += Math.sin(t * 0.25 + i) * dt * speeds[i];
      arr[i * 3 + 2] += Math.cos(t * 0.3 + i * 0.7) * dt * 0.08;
      if (arr[i * 3 + 1] < 0.1) arr[i * 3 + 1] = 6.5;
      if (arr[i * 3 + 1] > 7.5) arr[i * 3 + 1] = 0.3;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.018} color="#ffe3a1" transparent opacity={0.45}
        sizeAttenuation blending={AdditiveBlending} depthWrite={false}
      />
    </points>
  );
}

function FallingLeaves() {
  const COUNT = 26;
  const ref = useRef<InstancedMesh>(null);
  const data = useMemo(() => {
    const r = seeded(66);
    return Array.from({ length: COUNT }, () => ({
      x: (r() - 0.5) * 20, z: -12 + r() * 14, y0: 2 + r() * 5,
      fall: 0.25 + r() * 0.3, sway: 0.5 + r(), phase: r() * Math.PI * 2,
    }));
  }, []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    data.forEach((l, i) => {
      const cycle = (t * l.fall + l.phase) % 7;
      dummy.position.set(
        l.x + Math.sin(t * l.sway + l.phase) * 0.8,
        Math.max(0.05, l.y0 - cycle),
        l.z + Math.cos(t * l.sway * 0.7 + l.phase) * 0.5,
      );
      dummy.rotation.set(t * l.sway + l.phase, t * 0.9 + l.phase, t * 0.6);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.09, 0.07]} />
      <meshStandardMaterial color="#8a7a3a" roughness={1} side={DoubleSide} />
    </instancedMesh>
  );
}

/** Thin smoke column rising from somewhere deep in the city. */
function DistantSmoke() {
  const tex = useMemo(() => cloudPuff(27), []);
  const refs = useRef<(Group | null)[]>([]);
  const N = 7;
  useFrame(({ clock }) => {
    for (let i = 0; i < N; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const cycle = (clock.elapsedTime * 0.35 + i * 1.7) % 12;
      g.position.set(23 + Math.sin(cycle * 0.5 + i) * 1.2 + cycle * 0.25, 6 + cycle, -34);
      g.scale.setScalar(0.6 + cycle * 0.22);
      const m = (g.children[0] as any)?.material;
      if (m) m.opacity = Math.max(0, 0.3 - cycle * 0.026);
    }
  });
  return (
    <group>
      {Array.from({ length: N }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <mesh>
            <planeGeometry args={[4, 3]} />
            <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.25} color="#57534c" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Leaves gusting low across the old street. */
function GustLeaves() {
  const COUNT = 16;
  const ref = useRef<InstancedMesh>(null);
  const data = useMemo(() => {
    const r = seeded(91);
    return Array.from({ length: COUNT }, () => ({
      z: -11 + r() * 4.5, speed: 1.6 + r() * 2.4, phase: r() * 60, bounce: 1.2 + r() * 2.5,
    }));
  }, []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    data.forEach((l, i) => {
      const x = (((t * l.speed + l.phase) % 44) + 44) % 44 - 22;
      dummy.position.set(x, 0.06 + Math.abs(Math.sin(t * l.bounce + l.phase)) * 0.25, l.z);
      dummy.rotation.set(t * 3 + l.phase, t * 2, t * 2.4);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.08, 0.06]} />
      <meshStandardMaterial color="#7a6a34" roughness={1} side={DoubleSide} />
    </instancedMesh>
  );
}

/** Soft volumetric shafts slanting in from the low sun. */
function GodRays() {
  const rays: [number, number, number, number][] = [
    [-4, -8, 0.5, 1], [3, -11, 0.42, 1.4], [9, -6, 0.55, 0.8], [-11, -13, 0.46, 1.2],
  ];
  return (
    <group>
      {rays.map(([x, z, tilt, s], i) => (
        <mesh key={i} position={[x, 5.5, z]} rotation={[0, 0, tilt]}>
          <coneGeometry args={[2.4 * s, 11, 12, 1, true]} />
          <meshBasicMaterial
            color="#ffdf9a" transparent opacity={0.03}
            blending={AdditiveBlending} depthWrite={false} side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  The survivor camp (desk, rig, scaffold, generator, holo globe).    */
/* ------------------------------------------------------------------ */

function Scaffold() {
  const ivy = useMemo(() => leafCluster(71, 'ivy'), []);
  const poles = [-5.4, -2.7, 0, 2.7, 5.4];
  return (
    <group>
      {poles.map((x) => (
        <group key={x} position={[x, 0, -4.42]}>
          <mesh position={[0, 2.4, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 4.8, 8]} />
            <meshStandardMaterial color="#4f4438" metalness={0.5} roughness={0.7} />
          </mesh>
          <mesh position={[0.05, 1.4, 0.04]} rotation={[0, 0, 0.1]}>
            <cylinderGeometry args={[0.075, 0.085, 2.6, 6]} />
            <meshStandardMaterial color="#44522f" roughness={1} />
          </mesh>
          <Blob x={x === 0 ? 0.01 : 0} z={0} r={0.3} o={0.3} />
        </group>
      ))}
      {[0.7, 4.35].map((y) => (
        <mesh key={y} position={[0, y, -4.42]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 11.6, 8]} />
          <meshStandardMaterial color="#4f4438" metalness={0.5} roughness={0.7} />
        </mesh>
      ))}
      {/* ivy drapes over the top beam */}
      {[-4.2, -1.5, 1.1, 3.8].map((x, i) => (
        <mesh key={i} position={[x, 4.0, -4.36]} rotation={[0.12, 0, 0]}>
          <planeGeometry args={[1.1 + (i % 2) * 0.5, 1.3]} />
          <meshStandardMaterial map={ivy} transparent alphaTest={0.3} side={DoubleSide} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Generator() {
  const light = useRef<any>(null);
  useFrame(({ clock }) => {
    if (light.current)
      light.current.material.color.setScalar(Math.sin(clock.elapsedTime * 2.2) > 0 ? 1 : 0.15);
  });
  return (
    <group position={[2.6, 0, -2.2]}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.8, 0.6, 0.55]} />
        <meshStandardMaterial color="#5a4a30" metalness={0.4} roughness={0.8} />
      </mesh>
      <mesh position={[0.2, 0.66, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.16, 8]} />
        <meshStandardMaterial color="#3a332a" roughness={0.9} />
      </mesh>
      <mesh ref={light} position={[-0.28, 0.45, 0.29]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </mesh>
      <mesh position={[-0.2, 0.62, -0.1]}>
        <boxGeometry args={[0.34, 0.05, 0.3]} />
        <meshStandardMaterial color="#4c5a34" roughness={1} />
      </mesh>
      <Blob x={0} z={0} r={0.6} o={0.35} />
    </group>
  );
}

function HoloGlobe() {
  const ref = useRef<Group>(null);
  const pts = useMemo(() => {
    const r = seeded(31);
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const theta = Math.acos(2 * r() - 1);
      const phi = r() * Math.PI * 2;
      pos[i * 3] = 0.22 * Math.sin(theta) * Math.cos(phi);
      pos[i * 3 + 1] = 0.22 * Math.cos(theta);
      pos[i * 3 + 2] = 0.22 * Math.sin(theta) * Math.sin(phi);
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.25;
      ref.current.position.y = 1.35 + Math.sin(clock.elapsedTime * 0.8) * 0.02;
    }
  });

  return (
    <group position={[-1.55, 0, -0.75]}>
      <group ref={ref} position={[0, 1.35, 0]}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[pts, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.012} color="#9ac46a" transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
        </points>
        <mesh rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[0.3, 0.0022, 8, 48]} />
          <meshBasicMaterial color="#7a9a4a" transparent opacity={0.6} toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[0, 0.795, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.03, 16]} />
        <meshStandardMaterial color="#19110d" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.08, 0]}>
        <coneGeometry args={[0.2, 0.52, 16, 1, true]} />
        <meshBasicMaterial color="#7d360d" transparent opacity={0.07} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Streetlight({ position, bend = 0.5 }: { position: [number, number, number]; bend?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 3.4, 8]} />
        <meshStandardMaterial color="#4a463c" metalness={0.4} roughness={0.8} />
      </mesh>
      <mesh position={[0.4, 3.45, 0]} rotation={[0, 0, -bend]}>
        <cylinderGeometry args={[0.04, 0.05, 1.1, 8]} />
        <meshStandardMaterial color="#4a463c" metalness={0.4} roughness={0.8} />
      </mesh>
      <mesh position={[0.85, 3.6, 0]} rotation={[0, 0, -1.2]}>
        <boxGeometry args={[0.34, 0.1, 0.16]} />
        <meshStandardMaterial color="#3c382f" roughness={0.9} />
      </mesh>
      <mesh position={[0.02, 0.9, 0.03]}>
        <cylinderGeometry args={[0.07, 0.08, 1.8, 6]} />
        <meshStandardMaterial color="#44522f" roughness={1} />
      </mesh>
      <Blob x={0} z={0} r={0.32} o={0.3} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Assembly.                                                          */
/* ------------------------------------------------------------------ */

export default function Room() {
  return (
    <group>
      <Terrain />
      <TreeLine />
      <FarSkyline />
      <NearBuildings />
      <UtilityLines />
      <StreetClutter />
      <RoadDebris />
      <RustedPickup />
      <MilitaryTruck />
      <Checkpoint />
      <Trees />
      <GrassField />
      <Ferns />
      <Bushes />
      <Clouds />
      <Pollen />
      <FallingLeaves />
      <GustLeaves />
      <DistantSmoke />
      <GodRays />

      <Scaffold />
      <DeskArea />
      <HoloGlobe />
      <Generator />
      <Streetlight position={[-6.5, 0, -8]} />
      <Streetlight position={[7.5, 0, -10]} bend={0.65} />

      {/* golden-hour lighting */}
      <directionalLight position={[SUN[0], SUN[1] + 4, SUN[2]]} intensity={1.35} color="#ffd9a0" />
      <directionalLight position={[-10, 8, 14]} intensity={0.22} color="#9ab0c9" />
      <hemisphereLight args={['#a8a488', '#2b3222', 0.38]} />
      <ambientLight intensity={0.12} color="#c9b890" />
      <pointLight position={[0, 1.3, -0.7]} intensity={1.4} distance={3.5} color="#ffd28a" decay={2} />
    </group>
  );
}
