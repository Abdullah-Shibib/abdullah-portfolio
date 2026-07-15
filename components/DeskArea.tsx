'use client';

import { useMemo, useRef, useState, useEffect, ReactNode } from 'react';
import {
  CatmullRomCurve3, Color, Group, InstancedMesh, MathUtils, Object3D, SpotLight, Vector3,
} from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { playSwitchClick } from '@/lib/audio';
import { useCommandCenter } from '@/lib/store';

const dummy = new Object3D();

/** Desk surface height & bounds for draggable props. */
const TOP = 0.8;
const BOUNDS = { x: [-1.15, 1.15] as const, z: [-1.28, -0.55] as const };

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

/* ------------------------------------------------------------------ */
/*  Draggable — pick up, drag on the desk plane, spring home on drop.  */
/* ------------------------------------------------------------------ */

interface DraggableProps {
  home: [number, number, number];
  label: string;
  children: ReactNode;
  onTap?: () => void;
}

function Draggable({ home, label, children, onTap }: DraggableProps) {
  const ref = useRef<Group>(null);
  const state = useRef({
    dragging: false,
    moved: false,
    pos: { x: home[0], z: home[2] },
    vel: { x: 0, z: 0 },
    target: { x: home[0], z: home[2] },
  });
  const hover = useHoverCursor(label);

  useEffect(() => {
    const up = () => {
      state.current.dragging = false;
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  useFrame((_, dt) => {
    const s = state.current;
    const k = Math.min(dt, 0.05);
    const dest = s.dragging ? s.target : { x: home[0], z: home[2] };
    // critically-damped-ish spring with a little overshoot
    s.vel.x += (dest.x - s.pos.x) * 60 * k - s.vel.x * 10 * k;
    s.vel.z += (dest.z - s.pos.z) * 60 * k - s.vel.z * 10 * k;
    s.pos.x += s.vel.x * k;
    s.pos.z += s.vel.z * k;
    if (ref.current) {
      ref.current.position.set(s.pos.x, home[1] + (s.dragging ? 0.03 : 0), s.pos.z);
      ref.current.rotation.z = MathUtils.clamp(-s.vel.x * 0.06, -0.2, 0.2);
    }
  });

  return (
    <>
      <group
        ref={ref}
        {...hover}
        onPointerDown={(e) => {
          e.stopPropagation();
          state.current.dragging = true;
          state.current.moved = false;
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!state.current.moved && onTap) onTap();
        }}
      >
        {children}
      </group>
      {/* drag surface — only participates while this object is held */}
      <mesh
        position={[0, TOP + 0.01, -0.9]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        onPointerMove={(e) => {
          const s = state.current;
          if (!s.dragging) return;
          e.stopPropagation();
          s.moved = true;
          s.target.x = MathUtils.clamp(e.point.x, BOUNDS.x[0], BOUNDS.x[1]);
          s.target.z = MathUtils.clamp(e.point.z, BOUNDS.z[0], BOUNDS.z[1]);
        }}
      >
        <planeGeometry args={[3.4, 1.4]} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Interactive props.                                                 */
/* ------------------------------------------------------------------ */

function Mug() {
  const spin = useRef(0);
  const inner = useRef<Group>(null);
  useFrame((_, dt) => {
    spin.current *= 1 - Math.min(dt * 1.6, 0.2);
    if (inner.current) inner.current.rotation.y += spin.current * dt;
  });
  return (
    <Draggable home={[0.55, TOP, -0.63]} label="Cold coffee — drag it around" onTap={() => (spin.current += 9)}>
      <group ref={inner}>
        <mesh position={[0, 0.045, 0]}>
          <cylinderGeometry args={[0.04, 0.035, 0.09, 14]} />
          <meshStandardMaterial color="#1e2220" roughness={0.35} />
        </mesh>
        <mesh position={[0.05, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.025, 0.007, 6, 12]} />
          <meshStandardMaterial color="#1e2220" roughness={0.35} />
        </mesh>
        {/* dried residue */}
        <mesh position={[0, 0.088, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.032, 12]} />
          <meshStandardMaterial color="#1a120c" roughness={1} />
        </mesh>
      </group>
    </Draggable>
  );
}

function Notebook() {
  const [open, setOpen] = useState(false);
  const cover = useRef<Group>(null);
  const hover = useHoverCursor('Field notebook — click to open');
  useFrame((_, dt) => {
    if (cover.current) {
      const target = open ? -2.6 : 0;
      cover.current.rotation.x += (target - cover.current.rotation.x) * Math.min(1, dt * 7);
    }
  });
  return (
    <group
      position={[-0.95, TOP, -0.72]}
      rotation={[0, 0.4, 0]}
      {...hover}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      {/* pages */}
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[0.22, 0.024, 0.3]} />
        <meshStandardMaterial color="#c9bfa8" roughness={1} />
      </mesh>
      {/* scribbles visible when open */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.04 + (i % 2) * 0.08, 0.0255, -0.08 + i * 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, 0.006]} />
          <meshStandardMaterial color="#4a4438" roughness={1} />
        </mesh>
      ))}
      {/* cover, hinged at the back edge */}
      <group ref={cover} position={[0, 0.026, -0.15]}>
        <mesh position={[0, 0.006, 0.15]}>
          <boxGeometry args={[0.23, 0.012, 0.31]} />
          <meshStandardMaterial color="#3c3226" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

function Flashlight() {
  const [on, setOn] = useState(false);
  const light = useRef<SpotLight>(null);
  useFrame((_, dt) => {
    if (light.current) light.current.intensity += ((on ? 6 : 0) - light.current.intensity) * Math.min(1, dt * 10);
  });
  return (
    <Draggable home={[-0.35, TOP + 0.02, -1.05]} label="Flashlight — click to switch on" onTap={() => setOn((o) => !o)}>
      <group rotation={[0, 0.9, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.022, 0.026, 0.16, 10]} />
          <meshStandardMaterial color="#2e2a26" metalness={0.6} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.03, 0.024, 0.03, 10]} />
          <meshStandardMaterial color="#241f1b" metalness={0.6} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.106, 0]}>
          <circleGeometry args={[0.026, 10]} />
          <meshStandardMaterial color={on ? '#fff2c9' : '#3a352c'} emissive={on ? '#ffdf9a' : '#000000'} emissiveIntensity={on ? 2.5 : 0} />
        </mesh>
        <spotLight ref={light} position={[0, 0.12, 0]} rotation={[0, 0, 0]} angle={0.5} penumbra={0.6} distance={5} color="#ffe3b0" intensity={0} decay={2} />
      </group>
    </Draggable>
  );
}

function Radio() {
  const [on, setOn] = useState(false);
  const bars = useRef<Group>(null);
  const hover = useHoverCursor('Shortwave radio — click for power');
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
      position={[1.02, TOP, -0.85]}
      rotation={[0, -0.5, 0]}
      {...hover}
      onClick={(e) => {
        e.stopPropagation();
        setOn((o) => !o);
      }}
    >
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.24, 0.1, 0.09]} />
        <meshStandardMaterial color="#33302a" metalness={0.4} roughness={0.7} />
      </mesh>
      <mesh position={[-0.09, 0.16, 0]} rotation={[0, 0, 0.4]}>
        <cylinderGeometry args={[0.004, 0.004, 0.14, 4]} />
        <meshStandardMaterial color="#1f1c18" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh position={[0.08, 0.07, 0.048]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshBasicMaterial color={on ? '#b8c49a' : '#3a2f1c'} toneMapped={false} />
      </mesh>
      {/* EQ bars */}
      <group ref={bars} position={[-0.05, 0.05, 0.048]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[i * 0.022, 0, 0]} scale={[1, 0.08, 1]}>
            <boxGeometry args={[0.012, 0.05, 0.004]} />
            <meshBasicMaterial color="#8d9c6a" toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Keyboard() {
  const keys = useMemo(() => {
    const arr: [number, number][] = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) arr.push([c, r]);
    return arr;
  }, []);
  const ref = useRef<InstancedMesh>(null);
  const press = useRef<{ i: number; t: number } | null>(null);
  const hover = useHoverCursor('Mechanical keyboard — click a key');

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    keys.forEach(([c, r], i) => {
      let dy = 0;
      if (press.current?.i === i) {
        const age = clock.elapsedTime - press.current.t;
        if (age < 0.28) dy = -Math.sin((age / 0.28) * Math.PI) * 0.006;
        else press.current = null;
      }
      dummy.position.set((c - 6.5) * 0.032, 0.008 + dy, (r - 2) * 0.032);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group
      position={[0, TOP + 0.01, -0.69]}
      {...hover}
      onClick={(e) => {
        e.stopPropagation();
        // t stamped with scene time by KeyClockFix on the next frame
        press.current = { i: Math.floor(Math.random() * keys.length), t: -1 };
      }}
    >
      <mesh>
        <boxGeometry args={[0.5, 0.015, 0.18]} />
        <meshStandardMaterial color="#150f0c" roughness={0.6} metalness={0.5} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, keys.length]}>
        <boxGeometry args={[0.026, 0.008, 0.026]} />
        <meshStandardMaterial color="#241a15" roughness={0.5} emissive="#1c2214" emissiveIntensity={0.7} />
      </instancedMesh>
      <KeyClockFix press={press} />
    </group>
  );
}

/** Stamps the real scene time onto a fresh key press. */
function KeyClockFix({ press }: { press: React.MutableRefObject<{ i: number; t: number } | null> }) {
  useFrame(({ clock }) => {
    if (press.current && press.current.t === -1) press.current.t = clock.elapsedTime;
  });
  return null;
}

function Mouse() {
  const nudge = useRef(0);
  const g = useRef<Group>(null);
  useFrame(({ clock }, dt) => {
    nudge.current *= 1 - Math.min(dt * 4, 0.3);
    if (g.current) g.current.position.x = 0.34 + Math.sin(clock.elapsedTime * 14) * nudge.current;
  });
  const hover = useHoverCursor('Mouse');
  return (
    <group
      ref={g}
      position={[0.34, TOP, -0.68]}
      {...hover}
      onClick={(e) => {
        e.stopPropagation();
        nudge.current = 0.012;
      }}
    >
      <mesh position={[0, 0.014, 0]} scale={[1, 0.55, 1.5]}>
        <sphereGeometry args={[0.028, 10, 8]} />
        <meshStandardMaterial color="#1c1712" roughness={0.5} />
      </mesh>
    </group>
  );
}

function UsbDrive({ home, tint }: { home: [number, number, number]; tint: string }) {
  const spin = useRef(0);
  const g = useRef<Group>(null);
  useFrame((_, dt) => {
    spin.current *= 1 - Math.min(dt * 1.4, 0.2);
    if (g.current) g.current.rotation.y += spin.current * dt;
  });
  const hover = useHoverCursor('USB drive — click to spin');
  return (
    <group
      ref={g}
      position={home}
      {...hover}
      onClick={(e) => {
        e.stopPropagation();
        spin.current += 14;
      }}
    >
      <mesh position={[0, 0.008, 0]}>
        <boxGeometry args={[0.05, 0.014, 0.018]} />
        <meshStandardMaterial color={tint} roughness={0.6} />
      </mesh>
      <mesh position={[0.028, 0.008, 0]}>
        <boxGeometry args={[0.014, 0.01, 0.014]} />
        <meshStandardMaterial color="#8a8578" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Paper({ home, ry, tint }: { home: [number, number, number]; ry: number; tint: string }) {
  return (
    <Draggable home={home} label="Loose notes — drag them">
      <mesh rotation={[-Math.PI / 2, 0, ry]} position={[0, 0.002, 0]}>
        <planeGeometry args={[0.2, 0.28]} />
        <meshStandardMaterial color={tint} roughness={1} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, ry]} position={[Math.sin(ry) * 0.01, 0.0025, -0.08 + i * 0.04]}>
          <planeGeometry args={[0.13, 0.005]} />
          <meshStandardMaterial color="#55503f" roughness={1} />
        </mesh>
      ))}
    </Draggable>
  );
}

/* ------------------------------------------------------------------ */
/*  The rig — clean tempered-glass tower, still breathing under dust.  */
/* ------------------------------------------------------------------ */

function PcTower() {
  const fans = useRef<Group>(null);
  const boost = useRef(0);
  const hue = useRef(new Color());
  const rings = useRef<any[]>([]);
  const power = useCommandCenter((s) => s.power);
  const hover = useHoverCursor('The rig — click to rev the fans');

  useFrame(({ clock }, dt) => {
    const alive = power ? 1 : 0.12;
    if (fans.current) fans.current.children.forEach((f, i) => (f.rotation.z += dt * (2.2 + boost.current * 14 + i) * alive));
    boost.current = Math.max(0, boost.current - dt * 0.5);
    const t = clock.elapsedTime * 0.12;
    rings.current.forEach((m, i) => {
      if (!m) return;
      if (power) m.emissive.copy(hue.current.setHSL((t + i * 0.18) % 1, 0.28, 0.3));
      else m.emissive.lerp(hue.current.set('#000000'), Math.min(1, dt * 3));
    });
  });

  const CASE = { color: '#171614', metalness: 0.55, roughness: 0.45 };

  return (
    <group
      position={[2.12, 0, -0.78]}
      rotation={[0, -0.28, 0]}
      {...hover}
      onClick={(e) => {
        e.stopPropagation();
        boost.current = 1;
      }}
    >
      {/* main chassis — clean rectangular tower */}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.24, 0.52, 0.48]} />
        <meshStandardMaterial {...CASE} />
      </mesh>
      {/* brushed top panel with recessed IO strip */}
      <mesh position={[0, 0.542, 0]}>
        <boxGeometry args={[0.235, 0.008, 0.475]} />
        <meshStandardMaterial color="#1d1c19" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.547, 0.16]}>
        <boxGeometry args={[0.12, 0.002, 0.06]} />
        <meshStandardMaterial color="#0d0c0a" roughness={0.8} />
      </mesh>
      {/* full tempered-glass side, slightly inset in a thin frame */}
      <mesh position={[0.123, 0.28, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.44, 0.46]} />
        <meshPhysicalMaterial color="#0a0a09" metalness={0.4} roughness={0.08} transparent opacity={0.72} />
      </mesh>
      {[-0.225, 0.225].map((z) => (
        <mesh key={z} position={[0.124, 0.28, z]}>
          <boxGeometry args={[0.006, 0.5, 0.03]} />
          <meshStandardMaterial color="#111009" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {/* front mesh intake panel */}
      <mesh position={[0, 0.28, 0.242]}>
        <planeGeometry args={[0.22, 0.5]} />
        <meshStandardMaterial color="#100f0d" metalness={0.4} roughness={0.85} />
      </mesh>
      {/* PSU shroud behind the glass */}
      <mesh position={[0.1, 0.09, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.46, 0.1, 0.04]} />
        <meshStandardMaterial color="#131210" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* RGB fan rings behind the glass */}
      <group ref={fans}>
        {[0.44, 0.3, 0.16].map((y, i) => (
          <group key={i} position={[0.11, y, -0.14]} rotation={[0, Math.PI / 2, 0]}>
            <mesh>
              <torusGeometry args={[0.05, 0.007, 8, 20]} />
              <meshStandardMaterial
                ref={(el) => {
                  rings.current[i] = el;
                }}
                color="#0d0c0b"
                emissiveIntensity={0.85}
                roughness={0.6}
              />
            </mesh>
            {[0, 1, 2, 3].map((b) => (
              <mesh key={b} rotation={[0, 0, (b * Math.PI) / 2]} position={[0.018, 0.018, 0]}>
                <boxGeometry args={[0.045, 0.011, 0.004]} />
                <meshStandardMaterial color="#1c1814" roughness={0.8} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* low feet rails */}
      {[-0.18, 0.18].map((z) => (
        <mesh key={z} position={[0, 0.012, z]}>
          <boxGeometry args={[0.22, 0.025, 0.05]} />
          <meshStandardMaterial color="#0c0b0a" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      {/* dust film on top + power LED */}
      <mesh position={[0, 0.548, -0.05]} rotation={[-Math.PI / 2, 0, 0.2]}>
        <circleGeometry args={[0.11, 12]} />
        <meshStandardMaterial color="#57503f" roughness={1} transparent opacity={0.4} />
      </mesh>
      <mesh position={[-0.08, 0.5, 0.243]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshBasicMaterial color={power ? '#b8c49a' : '#33291f'} toneMapped={false} />
      </mesh>
      {/* single tidy power cable dropping straight down the back corner */}
      <mesh position={[-0.09, 0.18, -0.245]}>
        <cylinderGeometry args={[0.01, 0.01, 0.36, 6]} />
        <meshStandardMaterial color="#141210" roughness={0.8} />
      </mesh>
      <mesh position={[-0.25, 0.015, -0.1]} rotation={[Math.PI / 2, 0, 1.2]}>
        <cylinderGeometry args={[0.009, 0.009, 0.5, 6]} />
        <meshStandardMaterial color="#141210" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.42, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Chair — a proper TITAN-class gaming chair, dusted over.            */
/* ------------------------------------------------------------------ */

function GamingChair() {
  const LEATHER = { color: '#1d1e1c', roughness: 0.62, metalness: 0.05 };
  const LEATHER_DARK = { color: '#161715', roughness: 0.68, metalness: 0.05 };
  const STITCH = { color: '#5f6a4a', roughness: 0.9 };
  const METAL = { color: '#3a3d3a', metalness: 0.85, roughness: 0.3 };
  const PLASTIC = { color: '#121311', roughness: 0.55 };
  const recline = -0.13;

  return (
    <group position={[0.25, 0, 0.35]} rotation={[0, 0.7, 0]}>
      {/* ---- seat base ---- */}
      {/* wide flat seat pan with a soft cushion crown */}
      <mesh position={[0, 0.47, 0.01]}>
        <boxGeometry args={[0.5, 0.09, 0.5]} />
        <meshStandardMaterial {...LEATHER} />
      </mesh>
      <mesh position={[0, 0.515, 0.01]} scale={[1, 0.28, 1]}>
        <sphereGeometry args={[0.24, 14, 10]} />
        <meshStandardMaterial {...LEATHER} />
      </mesh>
      {/* raised side bolsters */}
      {[-0.235, 0.235].map((x) => (
        <mesh key={x} position={[x, 0.51, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.045, 0.36, 4, 8]} />
          <meshStandardMaterial {...LEATHER_DARK} />
        </mesh>
      ))}
      {/* seat stitching — two long seams */}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.5165, 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.006, 0.42]} />
          <meshStandardMaterial {...STITCH} />
        </mesh>
      ))}
      {/* worn patch + dust film where someone sat for years */}
      <mesh position={[0, 0.558, 0.03]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.85, 1]}>
        <circleGeometry args={[0.12, 14]} />
        <meshStandardMaterial color="#2b2d29" roughness={1} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.561, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 16]} />
        <meshStandardMaterial color="#4c463a" roughness={1} transparent opacity={0.16} />
      </mesh>

      {/* ---- backrest, slightly reclined ---- */}
      <group position={[0, 0.52, -0.24]} rotation={[recline, 0, 0]}>
        {/* main back panel */}
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[0.5, 0.82, 0.09]} />
          <meshStandardMaterial {...LEATHER} />
        </mesh>
        {/* center cushion channel */}
        <mesh position={[0, 0.42, 0.048]}>
          <boxGeometry args={[0.24, 0.76, 0.012]} />
          <meshStandardMaterial {...LEATHER_DARK} />
        </mesh>
        {/* vertical stitch seams framing the channel */}
        {[-0.125, 0.125].map((x) => (
          <mesh key={x} position={[x, 0.42, 0.056]}>
            <planeGeometry args={[0.006, 0.74]} />
            <meshStandardMaterial {...STITCH} />
          </mesh>
        ))}
        {/* horizontal stitch bars */}
        {[0.14, 0.42, 0.66].map((y) => (
          <mesh key={y} position={[0, y, 0.056]}>
            <planeGeometry args={[0.23, 0.006]} />
            <meshStandardMaterial {...STITCH} />
          </mesh>
        ))}
        {/* side wings */}
        {[-0.26, 0.26].map((x) => (
          <mesh key={x} position={[x, 0.62, 0.02]} rotation={[0, x > 0 ? -0.35 : 0.35, 0]}>
            <boxGeometry args={[0.09, 0.42, 0.07]} />
            <meshStandardMaterial {...LEATHER_DARK} />
          </mesh>
        ))}
        {/* integrated lumbar bulge */}
        <mesh position={[0, 0.2, 0.055]} scale={[1, 0.55, 0.3]}>
          <sphereGeometry args={[0.18, 12, 9]} />
          <meshStandardMaterial {...LEATHER} />
        </mesh>
        {/* headrest pillow strapped to the top */}
        <mesh position={[0, 0.78, 0.06]} rotation={[0.12, 0, 0]} scale={[1, 0.55, 0.42]}>
          <sphereGeometry args={[0.17, 12, 9]} />
          <meshStandardMaterial {...LEATHER_DARK} />
        </mesh>
        <mesh position={[0, 0.87, 0.015]}>
          <boxGeometry args={[0.09, 0.03, 0.11]} />
          <meshStandardMaterial color="#101110" roughness={0.8} />
        </mesh>
        {/* embroidered top badge */}
        <mesh position={[0, 0.72, 0.057]}>
          <planeGeometry args={[0.1, 0.035]} />
          <meshStandardMaterial color="#48523a" roughness={0.9} />
        </mesh>
        {/* recline hinges joining seat and back */}
        {[-0.25, 0.25].map((x) => (
          <mesh key={x} position={[x, 0.02, 0.03]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.03, 12]} />
            <meshStandardMaterial {...PLASTIC} />
          </mesh>
        ))}
        {/* dust settled along the top edge */}
        <mesh position={[0, 0.845, 0.028]} rotation={[-Math.PI / 2 + recline, 0, 0]}>
          <planeGeometry args={[0.42, 0.06]} />
          <meshStandardMaterial color="#4c463a" roughness={1} transparent opacity={0.22} />
        </mesh>
      </group>

      {/* ---- 4D armrests ---- */}
      {[-0.31, 0.31].map((x) => (
        <group key={x} position={[x, 0.47, 0.05]}>
          {/* height post */}
          <mesh position={[0, 0.09, 0]}>
            <boxGeometry args={[0.04, 0.18, 0.055]} />
            <meshStandardMaterial {...PLASTIC} />
          </mesh>
          {/* adjustment collar */}
          <mesh position={[0, 0.155, 0]}>
            <boxGeometry args={[0.05, 0.025, 0.065]} />
            <meshStandardMaterial color="#1c1e1b" metalness={0.4} roughness={0.5} />
          </mesh>
          {/* padded top */}
          <mesh position={[0, 0.2, 0.02]}>
            <boxGeometry args={[0.085, 0.028, 0.26]} />
            <meshStandardMaterial color="#141513" roughness={0.6} />
          </mesh>
          {/* mount arm into the seat pan */}
          <mesh position={[x > 0 ? -0.035 : 0.035, 0.0, 0]} rotation={[0, 0, x > 0 ? 0.5 : -0.5]}>
            <boxGeometry args={[0.03, 0.12, 0.05]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
        </group>
      ))}

      {/* ---- mechanism, gas lift, base ---- */}
      <mesh position={[0, 0.41, 0]}>
        <boxGeometry args={[0.26, 0.05, 0.3]} />
        <meshStandardMaterial {...PLASTIC} />
      </mesh>
      {/* tilt lever */}
      <mesh position={[0.16, 0.42, 0.1]} rotation={[0, 0.3, Math.PI / 2]}>
        <capsuleGeometry args={[0.009, 0.09, 4, 6]} />
        <meshStandardMaterial color="#0e100f" roughness={0.6} />
      </mesh>
      {/* two-stage gas lift with boot */}
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.18, 12]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[0, 0.19, 0]}>
        <cylinderGeometry args={[0.034, 0.042, 0.16, 12]} />
        <meshStandardMaterial color="#181a18" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* 5-star aluminum base with casters */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        return (
          <group key={i} rotation={[0, a, 0]}>
            {/* tapered arm, slight downward sweep */}
            <mesh position={[0, 0.085, 0.17]} rotation={[0.22, 0, 0]}>
              <boxGeometry args={[0.05, 0.032, 0.34]} />
              <meshStandardMaterial {...METAL} />
            </mesh>
            {/* caster fork + wheel */}
            <mesh position={[0, 0.05, 0.33]}>
              <boxGeometry args={[0.028, 0.05, 0.035]} />
              <meshStandardMaterial {...PLASTIC} />
            </mesh>
            <mesh position={[0.014, 0.032, 0.34]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.028, 0.013, 6, 14]} />
              <meshStandardMaterial color="#181a19" roughness={0.55} />
            </mesh>
          </group>
        );
      })}
      {/* soft shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <circleGeometry args={[0.42, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.32} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Emergency power switch — kills the whole monitor wall.             */
/* ------------------------------------------------------------------ */

function EmergencySwitch() {
  const { power, togglePower, setHint } = useCommandCenter();
  const button = useRef<Group>(null);
  const pressT = useRef(-10);

  useFrame(({ clock }) => {
    // chunky press: sink fast, rise slow
    const age = clock.elapsedTime - pressT.current;
    const sink = age < 0.12 ? age / 0.12 : age < 0.5 ? 1 - (age - 0.12) / 0.38 : 0;
    if (button.current) button.current.position.y = 0.055 - sink * 0.02;
  });

  return (
    <group
      position={[-0.68, TOP, -0.6]}
      rotation={[0, 0.32, 0]}
      onClick={(e) => {
        e.stopPropagation();
        pressT.current = -1; // stamped with scene time by SwitchClock next frame
        togglePower();
        setHint(power ? 'EMERGENCY POWER - bring the monitors back online' : 'EMERGENCY POWER - slam it to kill the wall');
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        setHint(power ? 'EMERGENCY POWER - slam it to kill the wall' : 'EMERGENCY POWER - bring the monitors back online');
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
        setHint(null);
      }}
    >
      <SwitchClock pressT={pressT} />
      {/* generous touch/click volume around the switch housing */}
      <mesh visible={false} position={[0, 0.075, 0]}>
        <boxGeometry args={[0.46, 0.2, 0.46]} />
      </mesh>
      {/* heavy base plate bolted to the desk */}
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[0.2, 0.024, 0.2]} />
        <meshStandardMaterial color="#2e3230" metalness={0.7} roughness={0.4} />
      </mesh>
      {[-0.082, 0.082].flatMap((x) =>
        [-0.082, 0.082].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.026, z]}>
            <cylinderGeometry args={[0.008, 0.008, 0.006, 6]} />
            <meshStandardMaterial color="#1a1c1a" metalness={0.8} roughness={0.3} />
          </mesh>
        )),
      )}
      {/* hazard chevrons around the rim */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.sin(i * Math.PI / 2) * 0.09, 0.0245, Math.cos(i * Math.PI / 2) * 0.09]} rotation={[-Math.PI / 2, 0, i * Math.PI / 2 + Math.PI / 4]}>
          <planeGeometry args={[0.05, 0.014]} />
          <meshStandardMaterial color="#8a7a3a" roughness={0.9} />
        </mesh>
      ))}
      {/* raised housing collar */}
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.075, 0.085, 0.045, 12]} />
        <meshStandardMaterial color="#242826" metalness={0.65} roughness={0.45} />
      </mesh>
      {/* protective side guards */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.075, 0.07, 0]} rotation={[0, 0, s * -0.25]}>
          <boxGeometry args={[0.012, 0.075, 0.13]} />
          <meshStandardMaterial color="#2e3230" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {/* the big red mushroom button */}
      <group ref={button} position={[0, 0.055, 0]}>
        <mesh position={[0, 0.018, 0]}>
          <cylinderGeometry args={[0.052, 0.056, 0.036, 16]} />
          <meshStandardMaterial color="#7a2018" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.04, 0]} scale={[1, 0.45, 1]}>
          <sphereGeometry args={[0.052, 16, 10]} />
          <meshStandardMaterial color="#8a2820" roughness={0.42} />
        </mesh>
        {/* worn paint ring */}
        <mesh position={[0, 0.037, 0]}>
          <torusGeometry args={[0.05, 0.004, 6, 20]} />
          <meshStandardMaterial color="#5a1a14" roughness={0.7} />
        </mesh>
      </group>
      {/* status lamp — green while the wall is live */}
      <mesh position={[0.088, 0.032, 0.06]}>
        <sphereGeometry args={[0.009, 8, 8]} />
        <meshBasicMaterial color={power ? '#9ab86a' : '#3a2a20'} toneMapped={false} />
      </mesh>
      {/* stenciled label plate */}
      <mesh position={[0, 0.026, 0.098]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[0.13, 0.028]} />
        <meshStandardMaterial color="#c9c4ae" roughness={0.95} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Light-bar master switch — one industrial toggle for every bar.     */
/* ------------------------------------------------------------------ */

function LightBarSwitch() {
  const lightBarsOn = useCommandCenter((s) => s.lightBarsOn);
  const { toggleLightBars, setHint } = useCommandCenter.getState();
  const power = useCommandCenter((s) => s.power);
  const lever = useRef<Group>(null);

  useFrame((_, dt) => {
    if (lever.current) {
      const target = lightBarsOn ? -0.55 : 0.55;
      lever.current.rotation.x += (target - lever.current.rotation.x) * Math.min(1, dt * 14);
    }
  });

  return (
    <group
      position={[-1.12, TOP, -0.48]}
      rotation={[0, 0.42, 0]}
      scale={1.7}
      onClick={(e) => {
        e.stopPropagation();
        playSwitchClick(!lightBarsOn);
        toggleLightBars();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        setHint(lightBarsOn ? 'LIGHT BARS — master switch · all off' : 'LIGHT BARS — master switch · all on');
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
        setHint(null);
      }}
    >
      {/* generous hitbox */}
      <mesh visible={false} position={[0, 0.05, 0]}>
        <boxGeometry args={[0.24, 0.14, 0.24]} />
      </mesh>
      {/* wall-box style housing screwed to the desk */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.1, 0.06, 0.14]} />
        <meshStandardMaterial color="#2e3230" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* rounded switch collar */}
      <mesh position={[0, 0.062, 0]}>
        <cylinderGeometry args={[0.028, 0.034, 0.012, 10]} />
        <meshStandardMaterial color="#1c1e1c" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* the toggle lever */}
      <group ref={lever} position={[0, 0.065, 0]}>
        <mesh position={[0, 0.024, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.007, 0.01, 0.05, 8]} />
          <meshStandardMaterial color="#8a8578" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.052, 0]}>
          <sphereGeometry args={[0.011, 8, 8]} />
          <meshStandardMaterial color="#7a2018" roughness={0.5} />
        </mesh>
      </group>
      {/* status LED + stencil plate */}
      <mesh position={[0.032, 0.062, 0.05]}>
        <sphereGeometry args={[0.006, 8, 8]} />
        <meshBasicMaterial color={lightBarsOn && power ? '#eef2dc' : '#3a3428'} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.035, 0.072]} rotation={[-0.2, 0, 0]}>
        <planeGeometry args={[0.08, 0.02]} />
        <meshStandardMaterial color="#c9c4ae" roughness={0.95} />
      </mesh>
      {/* thin flex conduit sneaking off the desk toward the wall trunk */}
      <mesh position={[-0.02, 0.012, -0.16]} rotation={[Math.PI / 2, 0, 0.15]}>
        <cylinderGeometry args={[0.006, 0.006, 0.22, 6]} />
        <meshStandardMaterial color="#141512" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Stamps the press time with the scene clock (same trick as the keyboard). */
function SwitchClock({ pressT }: { pressT: React.MutableRefObject<number> }) {
  useFrame(({ clock }) => {
    if (pressT.current === -1) pressT.current = clock.elapsedTime;
  });
  return null;
}

/** Conduit from the switch, over the desk edge and up to the monitor wall. */
function SwitchWiring() {
  const curves = useMemo(() => {
    const trunk = new CatmullRomCurve3([
      new Vector3(-0.68, TOP + 0.01, -0.66),
      new Vector3(-0.75, TOP - 0.02, -1.1),
      new Vector3(-0.8, 0.4, -1.35),
      new Vector3(-0.6, 0.08, -2.4),
      new Vector3(-0.2, 0.06, -3.6),
      new Vector3(0, 0.5, -4.35),
    ]);
    const branchL = new CatmullRomCurve3([
      new Vector3(0, 0.5, -4.35),
      new Vector3(-1.6, 1.2, -4.3),
      new Vector3(-2.84, 1.6, -4.15),
      new Vector3(-4.4, 2.0, -3.8),
    ]);
    const branchC = new CatmullRomCurve3([
      new Vector3(0, 0.5, -4.35),
      new Vector3(0, 1.4, -4.32),
      new Vector3(0, 2.2, -4.3),
    ]);
    const branchR = new CatmullRomCurve3([
      new Vector3(0, 0.5, -4.35),
      new Vector3(1.6, 1.2, -4.3),
      new Vector3(2.84, 1.6, -4.15),
      new Vector3(4.4, 2.0, -3.8),
    ]);
    return [trunk, branchL, branchC, branchR];
  }, []);
  return (
    <group>
      {curves.map((c, i) => (
        <mesh key={i}>
          <tubeGeometry args={[c, 24, i === 0 ? 0.014 : 0.009, 5]} />
          <meshStandardMaterial color={i === 0 ? '#1c1e1a' : '#141512'} roughness={0.8} />
        </mesh>
      ))}
      {/* junction box at the scaffold base */}
      <mesh position={[0, 0.5, -4.38]}>
        <boxGeometry args={[0.12, 0.16, 0.06]} />
        <meshStandardMaterial color="#2e3230" metalness={0.6} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Dead phone, face-up in the dust. */
function Phone() {
  const [woke, setWoke] = useState(false);
  const screen = useRef<any>(null);
  useFrame((_, dt) => {
    if (screen.current) screen.current.emissiveIntensity += ((woke ? 0.9 : 0) - screen.current.emissiveIntensity) * Math.min(1, dt * 4);
  });
  useEffect(() => {
    if (!woke) return;
    const t = setTimeout(() => setWoke(false), 2600);
    return () => clearTimeout(t);
  }, [woke]);
  return (
    <Draggable home={[-0.72, TOP, -1.0]} label="A phone — 1% battery" onTap={() => setWoke(true)}>
      <group rotation={[0, -0.5, 0]}>
        <mesh position={[0, 0.006, 0]}>
          <boxGeometry args={[0.075, 0.012, 0.15]} />
          <meshStandardMaterial color="#0c0d0e" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.0125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.066, 0.14]} />
          <meshStandardMaterial ref={screen} color="#050607" emissive="#4a5540" emissiveIntensity={0} roughness={0.3} />
        </mesh>
      </group>
    </Draggable>
  );
}

/** ID badge on a lanyard, tossed on the desk. */
function IdBadge() {
  return (
    <Draggable home={[0.18, TOP, -1.12]} label="ID badge — SHIBIB, A. / ENGINEERING">
      <group rotation={[0, 0.9, 0]}>
        <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.09, 0.13]} />
          <meshStandardMaterial color="#c9cfc6" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.005, -0.03]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.07, 0.05]} />
          <meshStandardMaterial color="#5a6a66" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.0055, 0.028]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.07, 0.008]} />
          <meshStandardMaterial color="#2c3230" roughness={0.9} />
        </mesh>
        {/* lanyard strap snaking off */}
        <mesh position={[0.08, 0.003, 0.1]} rotation={[-Math.PI / 2, 0, 0.8]}>
          <planeGeometry args={[0.02, 0.24]} />
          <meshStandardMaterial color="#2c3a2a" roughness={1} />
        </mesh>
      </group>
    </Draggable>
  );
}

/* ------------------------------------------------------------------ */
/*  Assembly.                                                          */
/* ------------------------------------------------------------------ */

export default function DeskArea() {
  return (
    <group>
      {/* desk slabs */}
      <group position={[0, 0, -0.85]}>
        <mesh position={[0, 0.78, 0]}>
          <boxGeometry args={[1.9, 0.04, 0.75]} />
          <meshStandardMaterial color="#1b1410" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[-1.28, 0.78, 0.18]} rotation={[0, 0.42, 0]}>
          <boxGeometry args={[1.0, 0.04, 0.75]} />
          <meshStandardMaterial color="#1b1410" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[1.28, 0.78, 0.18]} rotation={[0, -0.42, 0]}>
          <boxGeometry args={[1.0, 0.04, 0.75]} />
          <meshStandardMaterial color="#1b1410" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.75, 0.37]}>
          <boxGeometry args={[1.85, 0.012, 0.012]} />
          <meshBasicMaterial color="#9aa878" toneMapped={false} />
        </mesh>
        {[-1.6, -0.85, 0.85, 1.6].map((x) => (
          <mesh key={x} position={[x, 0.38, Math.abs(x) > 1 ? 0.15 : 0]}>
            <boxGeometry args={[0.05, 0.76, 0.05]} />
            <meshStandardMaterial color="#150f0c" metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
        {/* dust film across the desk */}
        <mesh position={[0.4, 0.803, 0.12]} rotation={[-Math.PI / 2, 0, 0.3]}>
          <circleGeometry args={[0.3, 14]} />
          <meshStandardMaterial color="#4c463a" roughness={1} transparent opacity={0.22} />
        </mesh>
        {/* headphones on the stand */}
        <group position={[-0.62, 0.8, 0.2]}>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.012, 0.02, 0.18, 8]} />
            <meshStandardMaterial color="#1c1410" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.19, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055, 0.012, 8, 18, Math.PI]} />
            <meshStandardMaterial color="#18110c" roughness={0.6} />
          </mesh>
          {[-0.055, 0.055].map((x) => (
            <mesh key={x} position={[x, 0.16, 0]}>
              <sphereGeometry args={[0.025, 10, 10]} />
              <meshStandardMaterial color="#18110c" roughness={0.6} emissive="#232a18" emissiveIntensity={0.6} />
            </mesh>
          ))}
        </group>
        {/* sticky notes */}
        {[[-0.28, -0.28, '#d9c26a', 0.3], [0.72, -0.3, '#a8c48a', -0.2], [-0.5, -0.05, '#d9a08a', 0.1]].map(([x, z, c, r], i) => (
          <mesh key={i} position={[x as number, 0.802, z as number]} rotation={[-Math.PI / 2, 0, r as number]}>
            <planeGeometry args={[0.07, 0.07]} />
            <meshStandardMaterial color={c as string} roughness={1} />
          </mesh>
        ))}
      </group>

      {/* interactive props (world coordinates) */}
      <Keyboard />
      <Mouse />
      <Mug />
      <Notebook />
      <Flashlight />
      <Radio />
      <UsbDrive home={[0.82, TOP, -0.6]} tint="#3a4a3c" />
      <UsbDrive home={[0.87, TOP, -0.66]} tint="#5c3a3a" />
      <Paper home={[-0.15, TOP + 0.002, -1.02]} ry={0.25} tint="#b8b09a" />
      <Paper home={[0.12, TOP + 0.004, -1.06]} ry={-0.4} tint="#c4bca6" />
      <Phone />
      <IdBadge />

      <EmergencySwitch />
      <LightBarSwitch />
      <SwitchWiring />
      <PcTower />
      <GamingChair />
    </group>
  );
}
