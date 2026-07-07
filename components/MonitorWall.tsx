'use client';

import { useRef, useState } from 'react';
import { Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MONITORS, MonitorDef } from '@/lib/data';
import { useCommandCenter } from '@/lib/store';
import { SCREENS } from './screens';

/** Pixels of DOM content per world unit — drei maps world = px * distanceFactor / 400. */
const PX_PER_UNIT = 280;
const DISTANCE_FACTOR = 400 / PX_PER_UNIT;

const FRAME = '#160f0b';
const EDGE_IDLE = new Color('#16302a');
const EDGE_HOVER = new Color('#4ea89a');

/** Clip-on light bar — each monitor keeps its own on/off state. */
function LightBar({ w, h, initiallyOn = false }: { w: number; h: number; initiallyOn?: boolean }) {
  const [on, setOn] = useState(initiallyOn);
  const setHint = useCommandCenter((s) => s.setHint);
  const light = useRef<any>(null);
  const strip = useRef<any>(null);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 5);
    if (light.current) light.current.intensity += ((on ? 2.4 : 0) - light.current.intensity) * k;
    if (strip.current) strip.current.emissiveIntensity += ((on ? 1.6 : 0.05) - strip.current.emissiveIntensity) * k;
  });

  const y = h / 2 + 0.1;
  return (
    <group
      position={[0, y, 0.03]}
      onClick={(e) => {
        e.stopPropagation();
        setOn((o) => !o);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        setHint('Light bar — click to toggle');
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
        setHint(null);
      }}
    >
      {/* mount clip + body */}
      <mesh position={[0, -0.035, -0.03]}>
        <boxGeometry args={[0.09, 0.07, 0.05]} />
        <meshStandardMaterial color="#0e0c0a" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, Math.min(w * 0.62, 1.6), 10, 1, false, 0, Math.PI * 2]} />
        <meshStandardMaterial color="#141210" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* glowing diffuser facing down at the desk */}
      <mesh position={[0, -0.02, 0.02]} rotation={[Math.PI / 2 - 0.6, 0, 0]}>
        <planeGeometry args={[Math.min(w * 0.6, 1.55), 0.035]} />
        <meshStandardMaterial ref={strip} color="#0c0f0d" emissive="#d9ffee" emissiveIntensity={0.05} />
      </mesh>
      {/* warm-white task light with real falloff */}
      <pointLight ref={light} position={[0, -0.08, 0.35]} intensity={0} distance={4.5} decay={2} color="#e8f0e4" />
    </group>
  );
}

function Monitor({ def }: { def: MonitorDef }) {
  const { focus, focused, setHint, transitioning } = useCommandCenter();
  const [hovered, setHovered] = useState(false);
  const edgeRef = useRef<Mesh>(null);
  const tiltRef = useRef<Group>(null);

  const [w, h] = def.size;
  const bezel = 0.055;
  const Screen = SCREENS[def.id];
  const isFocused = focused === def.id;

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 6);
    const mat = edgeRef.current?.material as MeshStandardMaterial | undefined;
    if (mat) {
      const target = hovered || isFocused ? EDGE_HOVER : EDGE_IDLE;
      mat.emissive.lerp(target, k);
      const targetIntensity = hovered ? 0.5 : isFocused ? 0.15 : 0.22;
      mat.emissiveIntensity += (targetIntensity - mat.emissiveIntensity) * k;
    }
    // lean toward the visitor on hover
    const g = tiltRef.current;
    if (g) {
      g.rotation.x += ((hovered ? -0.045 : 0) - g.rotation.x) * k;
      g.rotation.y += ((hovered ? -def.yaw * 0.22 : 0) - g.rotation.y) * k;
      const s = hovered ? 1.02 : 1;
      g.scale.x += (s - g.scale.x) * k;
      g.scale.y += (s - g.scale.y) * k;
      g.scale.z += (s - g.scale.z) * k;
    }
  });

  return (
    <group position={def.position} rotation={[0, def.yaw, 0]}>
      <group ref={tiltRef}>
      {/* wall mount */}
      <mesh position={[0, 0, -0.09]}>
        <boxGeometry args={[0.3, 0.3, 0.12]} />
        <meshStandardMaterial color="#0c0705" roughness={0.9} />
      </mesh>

      {/* frame body */}
      <mesh position={[0, 0, -0.025]}>
        <boxGeometry args={[w + bezel * 2, h + bezel * 2, 0.05]} />
        <meshStandardMaterial color={FRAME} roughness={0.55} metalness={0.6} />
      </mesh>

      {/* glowing edge trim — tucked behind the frame face so only the rim shows */}
      <mesh ref={edgeRef} position={[0, 0, -0.02]}>
        <boxGeometry args={[w + bezel * 2.6, h + bezel * 2.6, 0.012]} />
        <meshStandardMaterial color="#120a06" emissive={EDGE_IDLE} emissiveIntensity={0.5} roughness={0.4} />
      </mesh>

      {/* emissive backing — feeds bloom + lights the room */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#090502" emissive="#132a24" emissiveIntensity={0.55} roughness={1} />
      </mesh>

      {/* clip-on light bar (independent per monitor) */}
      <LightBar w={w} h={h} initiallyOn={def.id === 'network'} />

      {/* power LED */}
      <mesh position={[w / 2 - 0.04, -h / 2 - bezel * 1.1, 0.02]}>
        <sphereGeometry args={[0.011, 8, 8]} />
        <meshBasicMaterial color="#7ad9c6" />
      </mesh>

      {/* razor-sharp DOM screen */}
      <Html
        transform
        distanceFactor={DISTANCE_FACTOR}
        position={[0, 0, 0.012]}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            width: Math.round(w * PX_PER_UNIT),
            height: Math.round(h * PX_PER_UNIT),
          }}
        >
          <Screen />
        </div>
      </Html>

      </group>

      {/* interaction hitbox — 65% larger than the visible frame */}
      <mesh
        position={[0, 0, 0.03]}
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          if (!transitioning) focus(isFocused ? null : def.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          setHint(`Open ${def.label} — ${def.subtitle}`);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          setHint(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <planeGeometry args={[(w + bezel * 2) * 1.65, (h + bezel * 2) * 1.65]} />
      </mesh>
    </group>
  );
}

export default function MonitorWall() {
  return (
    <group>
      {MONITORS.map((m) => (
        <Monitor key={m.id} def={m} />
      ))}
      {/* screen glow spilling onto the camp at dusk */}
      <pointLight position={[0, 2.5, -2.6]} intensity={7} distance={9} color="#6ec4b4" decay={2} />
      <pointLight position={[-4.2, 2.4, -2.4]} intensity={3} distance={6} color="#5ec4b0" decay={2} />
      <pointLight position={[4.2, 2.4, -2.4]} intensity={3} distance={6} color="#5ec4b0" decay={2} />
    </group>
  );
}
