'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, Plane, Ray, Shape, ShapeGeometry, Vector3 } from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MONITORS, MonitorDef, MonitorId } from '@/lib/data';
import { useCommandCenter } from '@/lib/store';
import { SCREENS } from './screens';

/** Pixels of DOM content per world unit — drei maps world = px * distanceFactor / 400. */
const PX_PER_UNIT = 280;
const DISTANCE_FACTOR = 400 / PX_PER_UNIT;

/** Hitboxes extend this much beyond the visible frame (1.8 ≈ +80%). */
const HIT_SCALE = 1.8;

const FRAME = '#151210';
const EDGE_IDLE = new Color('#242a1c');
const EDGE_HOVER = new Color('#8d9c6a');
const BEZEL = 0.055;

/* ------------------------------------------------------------------ */
/*  Pointer → monitor resolution.                                      */
/*                                                                     */
/*  Hitboxes are big enough to overlap, so raw raycast order can hand  */
/*  a click to the wrong neighbor. Every hitbox therefore funnels its  */
/*  events through one resolver: intersect the pointer ray with each   */
/*  monitor's plane and pick the monitor whose visible rectangle is    */
/*  closest. Inside a screen that distance is 0 — the intended monitor */
/*  always wins, and gap clicks go to the nearest screen.              */
/* ------------------------------------------------------------------ */

interface MonitorFrame {
  id: MonitorId;
  origin: Vector3;
  xAxis: Vector3; // monitor-local right
  plane: Plane;
  halfW: number;
  halfH: number;
}

const FRAMES: MonitorFrame[] = MONITORS.map((m) => ({
  id: m.id,
  origin: new Vector3(...m.position),
  xAxis: new Vector3(Math.cos(m.yaw), 0, -Math.sin(m.yaw)),
  plane: new Plane().setFromNormalAndCoplanarPoint(
    new Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw)),
    new Vector3(...m.position),
  ),
  halfW: m.size[0] / 2 + BEZEL,
  halfH: m.size[1] / 2 + BEZEL,
}));

const tmp = new Vector3();
const tmpHit = new Vector3();

function screenDistance(point: Vector3, f: MonitorFrame) {
  tmp.copy(point).sub(f.origin);
  const dx = Math.max(0, Math.abs(tmp.dot(f.xAxis)) - f.halfW);
  const dy = Math.max(0, Math.abs(tmp.y) - f.halfH);
  return dx * dx + dy * dy;
}

function resolveMonitorFromPoint(point: Vector3): MonitorId {
  let best: MonitorId = FRAMES[0].id;
  let bestScore = Infinity;
  for (const f of FRAMES) {
    const score = screenDistance(point, f);
    if (score < bestScore) {
      bestScore = score;
      best = f.id;
    }
  }
  return best;
}

function resolveMonitor(ray: Ray, fallbackPoint: Vector3): MonitorId {
  let best: MonitorId | null = null;
  let bestScore = Infinity;

  for (const f of FRAMES) {
    const hit = ray.intersectPlane(f.plane, tmpHit);
    if (!hit) continue;
    const score = screenDistance(tmpHit, f) + ray.origin.distanceTo(tmpHit) * 0.0001;
    if (score < bestScore) {
      bestScore = score;
      best = f.id;
    }
  }

  return best ?? resolveMonitorFromPoint(fallbackPoint);
}

/* ------------------------------------------------------------------ */
/*  CRT power cycle for the in-world DOM screens.                      */
/* ------------------------------------------------------------------ */

function PoweredScreen({ children }: { children: ReactNode }) {
  const power = useCommandCenter((s) => s.power);
  const [phase, setPhase] = useState<'on' | 'dying' | 'off' | 'booting'>(power ? 'on' : 'off');
  const prev = useRef(power);

  useEffect(() => {
    if (prev.current === power) return;
    prev.current = power;
    if (!power) {
      setPhase('dying');
      const t = setTimeout(() => setPhase('off'), 460);
      return () => clearTimeout(t);
    }
    setPhase('booting');
    const t = setTimeout(() => setPhase('on'), 640);
    return () => clearTimeout(t);
  }, [power]);

  if (phase === 'off') {
    return (
      <div className="grid h-full w-full place-items-center rounded-[10px] border border-white/5 bg-black">
        <div className="nosignal text-center">
          <p className="font-mono text-[11px] tracking-[0.5em] text-neutral-600">NO SIGNAL</p>
          <p className="mt-1 font-mono text-[8px] tracking-[0.3em] text-neutral-700">CHECK POWER SUPPLY</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black" style={{ borderRadius: 10 }}>
      <div className={`h-full w-full ${phase === 'dying' ? 'crt-off' : phase === 'booting' ? 'crt-on' : ''}`}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Clip-on light bar — each monitor keeps its own on/off state.       */
/* ------------------------------------------------------------------ */

function LightBar({ w, h, initiallyOn = false }: { w: number; h: number; initiallyOn?: boolean }) {
  const [on, setOn] = useState(initiallyOn);
  const power = useCommandCenter((s) => s.power);
  const setHint = useCommandCenter((s) => s.setHint);
  const light = useRef<any>(null);
  const strip = useRef<any>(null);
  const lit = on && power;

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 5);
    if (light.current) light.current.intensity += ((lit ? 2.4 : 0) - light.current.intensity) * k;
    if (strip.current) strip.current.emissiveIntensity += ((lit ? 1.6 : 0.05) - strip.current.emissiveIntensity) * k;
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
        setHint(power ? 'Light bar — click to toggle' : 'Light bar — dead without main power');
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
        <meshStandardMaterial ref={strip} color="#0e0f0c" emissive="#eef2dc" emissiveIntensity={0.05} />
      </mesh>
      {/* warm-white task light with real falloff */}
      <pointLight ref={light} position={[0, -0.08, 0.35]} intensity={0} distance={4.5} decay={2} color="#eef0dc" />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  A monitor.                                                         */
/* ------------------------------------------------------------------ */

interface MonitorProps {
  def: MonitorDef;
  hovered: boolean;
  onHover: (id: MonitorId | null) => void;
}

function Monitor({ def, hovered, onHover }: MonitorProps) {
  const { focus, focused, setHint, power } = useCommandCenter();
  const edgeRef = useRef<Mesh>(null);
  const ringMat = useRef<MeshBasicMaterial>(null);
  const backingRef = useRef<MeshStandardMaterial>(null);
  const ledRef = useRef<any>(null);
  const tiltRef = useRef<Group>(null);

  const [w, h] = def.size;
  const Screen = SCREENS[def.id];
  const isFocused = focused === def.id;

  // rectangular halo — a flat frame (outer rect minus inner rect) hugging the bezel
  const outlineGeo = useMemo(() => {
    const ow = w / 2 + BEZEL * 2.6;
    const oh = h / 2 + BEZEL * 2.6;
    const iw = w / 2 + BEZEL * 1.4;
    const ih = h / 2 + BEZEL * 1.4;
    const shape = new Shape();
    shape.moveTo(-ow, -oh); shape.lineTo(ow, -oh); shape.lineTo(ow, oh); shape.lineTo(-ow, oh); shape.closePath();
    const hole = new Path();
    hole.moveTo(-iw, -ih); hole.lineTo(-iw, ih); hole.lineTo(iw, ih); hole.lineTo(iw, -ih); hole.closePath();
    shape.holes.push(hole);
    return new ShapeGeometry(shape);
  }, [w, h]);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 8);
    const mat = edgeRef.current?.material as MeshStandardMaterial | undefined;
    if (mat) {
      const target = hovered || isFocused ? EDGE_HOVER : EDGE_IDLE;
      mat.emissive.lerp(target, k);
      const targetIntensity = !power ? 0.04 : hovered ? 0.85 : isFocused ? 0.2 : 0.22;
      mat.emissiveIntensity += (targetIntensity - mat.emissiveIntensity) * k;
    }
    // hover outline halo — quick fade, reads as "this one is selected"
    if (ringMat.current) {
      const target = hovered && power && !isFocused ? 0.85 : 0;
      ringMat.current.opacity += (target - ringMat.current.opacity) * Math.min(1, dt * 12);
    }
    // screen glow dies with the master power
    if (backingRef.current) {
      backingRef.current.emissiveIntensity += ((power ? 0.55 : 0.02) - backingRef.current.emissiveIntensity) * k;
    }
    if (ledRef.current) ledRef.current.color.set(power ? '#b8c49a' : '#4a2620');
    // lean toward the visitor on hover
    const g = tiltRef.current;
    if (g) {
      const hov = hovered && power;
      g.rotation.x += ((hov ? -0.045 : 0) - g.rotation.x) * k;
      g.rotation.y += ((hov ? -def.yaw * 0.22 : 0) - g.rotation.y) * k;
      const s = hov ? 1.02 : 1;
      g.scale.x += (s - g.scale.x) * k;
      g.scale.y += (s - g.scale.y) * k;
      g.scale.z += (s - g.scale.z) * k;
    }
  });

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = resolveMonitor(e.ray, e.point);
    onHover(id);
    if (id === def.id) {
      setHint(power ? `Open ${def.label} — ${def.subtitle}` : 'MAIN POWER OFFLINE — hit the red switch on the desk');
      document.body.style.cursor = 'pointer';
    }
  };

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
          <boxGeometry args={[w + BEZEL * 2, h + BEZEL * 2, 0.05]} />
          <meshStandardMaterial color={FRAME} roughness={0.55} metalness={0.6} />
        </mesh>

        {/* glowing edge trim — tucked behind the frame face so only the rim shows */}
        <mesh ref={edgeRef} position={[0, 0, -0.02]}>
          <boxGeometry args={[w + BEZEL * 2.6, h + BEZEL * 2.6, 0.012]} />
          <meshStandardMaterial color="#14120a" emissive={EDGE_IDLE} emissiveIntensity={0.5} roughness={0.4} />
        </mesh>

        {/* hover outline — a bright rectangular halo just off the bezel */}
        <mesh position={[0, 0, 0.015]} geometry={outlineGeo}>
          <meshBasicMaterial ref={ringMat} color="#b6c290" transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>

        {/* emissive backing — feeds bloom + lights the room */}
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial ref={backingRef} color="#0a0902" emissive="#232a18" emissiveIntensity={0.55} roughness={1} />
        </mesh>

        {/* clip-on light bar (independent per monitor) */}
        <LightBar w={w} h={h} initiallyOn={def.id === 'network'} />

        {/* power LED */}
        <mesh position={[w / 2 - 0.04, -h / 2 - BEZEL * 1.1, 0.02]}>
          <sphereGeometry args={[0.011, 8, 8]} />
          <meshBasicMaterial ref={ledRef} color="#b8c49a" />
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
            <PoweredScreen>
              <Screen />
            </PoweredScreen>
          </div>
        </Html>
      </group>

      {/* oversized interaction hitbox — thin slab flush with the screen so the
          frame, bezel and surrounding air all catch the pointer, while props
          mounted in front (light bar) still win their own raycasts */}
      <mesh
        position={[0, 0, 0]}
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          const id = resolveMonitor(e.ray, e.point);
          focus(focused === id ? null : id);
        }}
        onPointerMove={handleMove}
        onPointerOver={handleMove}
        onPointerOut={() => {
          // overlapping neighbor hitboxes fire out-of-order; only the monitor
          // that currently owns the hover may clear it
          if (hovered) {
            onHover(null);
            setHint(null);
            document.body.style.cursor = 'auto';
          }
        }}
      >
        <boxGeometry args={[(w + BEZEL * 2) * HIT_SCALE, (h + BEZEL * 2) * HIT_SCALE, 0.06]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  The wall.                                                          */
/* ------------------------------------------------------------------ */

export default function MonitorWall() {
  const [hoveredId, setHoveredId] = useState<MonitorId | null>(null);
  const power = useCommandCenter((s) => s.power);
  const lights = useRef<(any | null)[]>([]);

  // hover state lives at wall level: overlapping hitboxes all agree on the
  // resolved monitor, so exactly one shows feedback at a time
  const onHover = useMemo(() => (id: MonitorId | null) => setHoveredId(id), []);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 4);
    const targets = power ? [7, 3, 3] : [0, 0, 0];
    lights.current.forEach((l, i) => {
      if (l) l.intensity += (targets[i] - l.intensity) * k;
    });
  });

  return (
    <group>
      {MONITORS.map((m) => (
        <Monitor key={m.id} def={m} hovered={hoveredId === m.id} onHover={onHover} />
      ))}
      {/* screen glow spilling onto the camp at dusk */}
      <pointLight ref={(el) => { lights.current[0] = el; }} position={[0, 2.5, -2.6]} intensity={7} distance={9} color="#9aa878" decay={2} />
      <pointLight ref={(el) => { lights.current[1] = el; }} position={[-4.2, 2.4, -2.4]} intensity={3} distance={6} color="#8fa268" decay={2} />
      <pointLight ref={(el) => { lights.current[2] = el; }} position={[4.2, 2.4, -2.4]} intensity={3} distance={6} color="#8fa268" decay={2} />
    </group>
  );
}
