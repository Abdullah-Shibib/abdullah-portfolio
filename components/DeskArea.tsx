'use client';

import { useMemo, useRef, useState, useEffect, ReactNode } from 'react';
import { Color, Group, InstancedMesh, MathUtils, Object3D, SpotLight } from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
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
          <meshStandardMaterial color="#1a2422" roughness={0.35} />
        </mesh>
        <mesh position={[0.05, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.025, 0.007, 6, 12]} />
          <meshStandardMaterial color="#1a2422" roughness={0.35} />
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
        <meshBasicMaterial color={on ? '#7ad9c6' : '#3a2f1c'} toneMapped={false} />
      </mesh>
      {/* EQ bars */}
      <group ref={bars} position={[-0.05, 0.05, 0.048]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[i * 0.022, 0, 0]} scale={[1, 0.08, 1]}>
            <boxGeometry args={[0.012, 0.05, 0.004]} />
            <meshBasicMaterial color="#4ea89a" toneMapped={false} />
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
        <meshStandardMaterial color="#241a15" roughness={0.5} emissive="#10241e" emissiveIntensity={0.7} />
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
/*  The rig — dusty RGB tower still breathing.                         */
/* ------------------------------------------------------------------ */

function PcTower() {
  const fans = useRef<Group>(null);
  const [boost, setBoost] = useState(0);
  const hue = useRef(new Color());
  const rings = useRef<any[]>([]);
  const hover = useHoverCursor('The rig — click to rev the fans');

  useFrame(({ clock }, dt) => {
    if (fans.current) fans.current.children.forEach((f, i) => (f.rotation.z += dt * (2.2 + boost * 14 + i)));
    setBoost((b) => Math.max(0, b - dt * 0.5));
    const t = clock.elapsedTime * 0.12;
    rings.current.forEach((m, i) => {
      if (m) m.emissive.copy(hue.current.setHSL((t + i * 0.18) % 1, 0.45, 0.32));
    });
  });

  return (
    <group
      position={[2.12, 0, -0.78]}
      rotation={[0, -0.28, 0]}
      {...hover}
      onClick={(e) => {
        e.stopPropagation();
        setBoost(1);
      }}
    >
      {/* case */}
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[0.24, 0.52, 0.48]} />
        <meshStandardMaterial color="#17130f" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* smoked glass side */}
      <mesh position={[0.125, 0.26, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.44, 0.48]} />
        <meshStandardMaterial color="#0a0908" metalness={0.9} roughness={0.15} transparent opacity={0.85} />
      </mesh>
      {/* RGB fan rings behind the glass */}
      <group ref={fans}>
        {[0.42, 0.26, 0.1].map((y, i) => (
          <group key={i} position={[0.12, y, -0.12]} rotation={[0, Math.PI / 2, 0]}>
            <mesh>
              <torusGeometry args={[0.055, 0.008, 8, 20]} />
              <meshStandardMaterial
                ref={(el) => {
                  rings.current[i] = el;
                }}
                color="#0d0b09"
                emissiveIntensity={0.85}
                roughness={0.6}
              />
            </mesh>
            {[0, 1, 2, 3].map((b) => (
              <mesh key={b} rotation={[0, 0, (b * Math.PI) / 2]} position={[0.02, 0.02, 0]}>
                <boxGeometry args={[0.05, 0.012, 0.004]} />
                <meshStandardMaterial color="#1c1814" roughness={0.8} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* dust on top + power LED */}
      <mesh position={[0, 0.525, 0]}>
        <boxGeometry args={[0.23, 0.006, 0.46]} />
        <meshStandardMaterial color="#57503f" roughness={1} transparent opacity={0.5} />
      </mesh>
      <mesh position={[-0.08, 0.5, 0.242]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshBasicMaterial color="#7ad9c6" toneMapped={false} />
      </mesh>
      {/* cable runs: power drop, DisplayPort toward the rig, ethernet along the floor */}
      <mesh position={[-0.16, 0.45, -0.2]} rotation={[0.5, 0.2, 1.15]}>
        <cylinderGeometry args={[0.011, 0.011, 0.55, 6]} />
        <meshStandardMaterial color="#141210" roughness={0.8} />
      </mesh>
      <mesh position={[-0.3, 0.7, 0.02]} rotation={[0.15, 0, 1.0]}>
        <cylinderGeometry args={[0.009, 0.009, 0.6, 6]} />
        <meshStandardMaterial color="#101418" roughness={0.8} />
      </mesh>
      <mesh position={[-0.45, 0.02, 0.28]} rotation={[Math.PI / 2, 0, 0.5]}>
        <cylinderGeometry args={[0.008, 0.008, 0.9, 6]} />
        <meshStandardMaterial color="#16201a" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.42, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Chair — pushed back, empty, waiting.                               */
/* ------------------------------------------------------------------ */

function EmptyChair() {
  const FABRIC = { color: '#191b1a', roughness: 0.85 };
  const METAL = { color: '#2c2e2c', metalness: 0.75, roughness: 0.35 };
  return (
    <group position={[0.25, 0, 0.35]} rotation={[0, 0.7, 0]}>
      {/* contoured seat pan */}
      <mesh position={[0, 0.46, 0.02]} scale={[1, 0.3, 1]}>
        <sphereGeometry args={[0.27, 14, 10]} />
        <meshStandardMaterial {...FABRIC} />
      </mesh>
      {/* worn patch where someone sat for years */}
      <mesh position={[0, 0.545, 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.8, 1]}>
        <circleGeometry args={[0.13, 14]} />
        <meshStandardMaterial color="#242928" roughness={1} />
      </mesh>
      {/* curved mesh backrest shell */}
      <mesh position={[0, 0.92, -0.24]} rotation={[0.06, Math.PI, 0]} scale={[1, 1, 0.45]}>
        <cylinderGeometry args={[0.26, 0.23, 0.72, 14, 1, true, -Math.PI / 2.4, Math.PI / 1.2]} />
        <meshStandardMaterial color="#202422" roughness={0.9} side={2} transparent opacity={0.92} />
      </mesh>
      {/* backrest frame rails */}
      {[-0.24, 0.24].map((x) => (
        <mesh key={x} position={[x, 0.92, -0.27]} rotation={[0.06, 0, x > 0 ? -0.08 : 0.08]}>
          <cylinderGeometry args={[0.014, 0.016, 0.74, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
      {/* lumbar support bar */}
      <mesh position={[0, 0.72, -0.235]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.025, 0.4, 4, 8]} />
        <meshStandardMaterial color="#15211d" roughness={0.8} />
      </mesh>
      {/* headrest on stalk */}
      <mesh position={[0, 1.34, -0.28]}>
        <cylinderGeometry args={[0.012, 0.012, 0.12, 6]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[0, 1.44, -0.27]} rotation={[-0.2, 0, 0]} scale={[1, 0.62, 0.5]}>
        <sphereGeometry args={[0.16, 12, 9]} />
        <meshStandardMaterial {...FABRIC} />
      </mesh>
      {/* armrests */}
      {[-0.3, 0.3].map((x) => (
        <group key={x} position={[x, 0.5, 0.02]}>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.035, 0.2, 0.05]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
          <mesh position={[0, 0.215, 0.03]}>
            <boxGeometry args={[0.07, 0.03, 0.24]} />
            <meshStandardMaterial color="#101312" roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* gas lift + tilt lever */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.028, 0.038, 0.34, 10]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[0.1, 0.4, 0.06]} rotation={[0, 0.4, Math.PI / 2]}>
        <capsuleGeometry args={[0.008, 0.1, 4, 6]} />
        <meshStandardMaterial color="#0e100f" roughness={0.6} />
      </mesh>
      {/* 5-star base with caster wheels */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[0, 0.075, 0.2]} rotation={[0.12, 0, 0]}>
              <boxGeometry args={[0.045, 0.035, 0.36]} />
              <meshStandardMaterial {...METAL} />
            </mesh>
            <mesh position={[0, 0.045, 0.36]}>
              <boxGeometry args={[0.03, 0.05, 0.04]} />
              <meshStandardMaterial color="#101110" roughness={0.5} />
            </mesh>
            <mesh position={[0.012, 0.032, 0.37]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.026, 0.012, 6, 12]} />
              <meshStandardMaterial color="#181a19" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
      {/* dust film settled on the seat */}
      <mesh position={[0, 0.548, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.24, 16]} />
        <meshStandardMaterial color="#4c463a" roughness={1} transparent opacity={0.18} />
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
          <meshStandardMaterial ref={screen} color="#050607" emissive="#3a5c50" emissiveIntensity={0} roughness={0.3} />
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
          <meshStandardMaterial color="#24403a" roughness={1} />
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
          <meshBasicMaterial color="#6ec4b4" toneMapped={false} />
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
              <meshStandardMaterial color="#18110c" roughness={0.6} emissive="#0e2a24" emissiveIntensity={0.6} />
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
      <UsbDrive home={[0.82, TOP, -0.6]} tint="#3a4a5c" />
      <UsbDrive home={[0.87, TOP, -0.66]} tint="#5c3a3a" />
      <Paper home={[-0.15, TOP + 0.002, -1.02]} ry={0.25} tint="#b8b09a" />
      <Paper home={[0.12, TOP + 0.004, -1.06]} ry={-0.4} tint="#c4bca6" />
      <Phone />
      <IdBadge />

      <PcTower />
      <EmptyChair />
    </group>
  );
}
