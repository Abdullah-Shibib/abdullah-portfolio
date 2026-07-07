'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, Shape, ShapeGeometry, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MONITORS, MonitorDef, MonitorId, monitorById } from '@/lib/data';
import { useCommandCenter } from '@/lib/store';
import { SCREENS } from './screens';

/** Pixels of DOM content per world unit — drei maps world = px * distanceFactor / 400. */
const PX_PER_UNIT = 280;
const DISTANCE_FACTOR = 400 / PX_PER_UNIT;

const FRAME = '#151210';
const EDGE_IDLE = new Color('#242a1c');
const EDGE_HOVER = new Color('#8d9c6a');
const BEZEL = 0.055;
const SCREEN_EDGE_PAD_PX = 14;

/* ------------------------------------------------------------------ */
/*  Pointer → monitor resolution.                                      */
/*                                                                     */
/*  The visible screens are DOM overlays, so monitor ownership follows */
/*  the pointer's projected screen-space position instead of 3D        */
/*  raycast order. The small pixel pad forgives edges without making   */
/*  neighboring screens steal fast clicks.                             */
/* ------------------------------------------------------------------ */

interface ScreenPoint {
  x: number;
  y: number;
}

function pointInPolygon(point: ScreenPoint, polygon: ScreenPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (crosses) {
      const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

function distanceToSegment(point: ScreenPoint, a: ScreenPoint, b: ScreenPoint) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const denom = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom));
  const dx = point.x - (a.x + abx * t);
  const dy = point.y - (a.y + aby * t);
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToPolygon(point: ScreenPoint, polygon: ScreenPoint[]) {
  if (pointInPolygon(point, polygon)) return 0;
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    best = Math.min(best, distanceToSegment(point, polygon[i], polygon[(i + 1) % polygon.length]));
  }
  return best;
}

function resolveScreenMonitorAt(clientX: number, clientY: number, camera: any, canvas: HTMLCanvasElement): MonitorId | null {
  const rect = canvas.getBoundingClientRect();
  const point = { x: clientX, y: clientY };
  let best: MonitorId | null = null;
  let bestScore = Infinity;

  for (const m of MONITORS) {
    const center = new Vector3(...m.position);
    const xAxis = new Vector3(Math.cos(m.yaw), 0, -Math.sin(m.yaw));
    const halfW = m.size[0] / 2 + BEZEL * 1.25;
    const halfH = m.size[1] / 2 + BEZEL * 1.25;
    const corners: ScreenPoint[] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sy]) => {
      const p = center.clone().addScaledVector(xAxis, sx * halfW);
      p.y += sy * halfH;
      p.project(camera);
      return {
        x: rect.left + (p.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-p.y * 0.5 + 0.5) * rect.height,
      };
    });

    const distance = distanceToPolygon(point, corners);
    if (distance > SCREEN_EDGE_PAD_PX) continue;

    const cx = corners.reduce((sum, p) => sum + p.x, 0) / corners.length;
    const cy = corners.reduce((sum, p) => sum + p.y, 0) / corners.length;
    const maxX = Math.max(...corners.map((p) => p.x));
    const minX = Math.min(...corners.map((p) => p.x));
    const maxY = Math.max(...corners.map((p) => p.y));
    const minY = Math.min(...corners.map((p) => p.y));
    const nw = Math.max(1, maxX - minX);
    const nh = Math.max(1, maxY - minY);
    const centerBias = ((point.x - cx) / nw) ** 2 + ((point.y - cy) / nh) ** 2;
    const score = distance * distance + centerBias;

    if (score < bestScore) {
      bestScore = score;
      best = m.id;
    }
  }

  return best;
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
}

function Monitor({ def, hovered }: MonitorProps) {
  const { focused, power } = useCommandCenter();
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

    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  The wall.                                                          */
/* ------------------------------------------------------------------ */

export default function MonitorWall() {
  const [hoveredId, setHoveredId] = useState<MonitorId | null>(null);
  const power = useCommandCenter((s) => s.power);
  const setHint = useCommandCenter((s) => s.setHint);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const lights = useRef<(any | null)[]>([]);
  const hoveredIdRef = useRef<MonitorId | null>(null);
  const pendingTap = useRef<{ id: MonitorId; x: number; y: number; pointerId: number } | null>(null);

  useEffect(() => {
    const canvas = gl.domElement;

    const applyHover = (id: MonitorId | null) => {
      if (hoveredIdRef.current === id) return;
      hoveredIdRef.current = id;
      setHoveredId(id);
    };

    const clearHover = () => {
      applyHover(null);
      setHint(null);
      document.body.style.cursor = 'auto';
    };

    const resolvePointer = (event: MouseEvent) =>
      resolveScreenMonitorAt(event.clientX, event.clientY, camera, canvas);

    const handleMove = (event: MouseEvent | PointerEvent) => {
      if ('pointerType' in event && event.pointerType === 'touch') return;

      const state = useCommandCenter.getState();
      if (state.focused || state.panelOpen) {
        clearHover();
        return;
      }

      const id = resolvePointer(event);
      applyHover(id);
      if (!id) {
        setHint(null);
        document.body.style.cursor = 'auto';
        return;
      }

      const target = monitorById(id);
      setHint(power ? `Open ${target.label} — ${target.subtitle}` : 'MAIN POWER OFFLINE — hit the red switch on the desk');
      document.body.style.cursor = 'pointer';
    };

    const interactiveTarget = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      return target?.closest('a,button,input,textarea,select,[role="button"]');
    };

    const handleDown = (event: PointerEvent) => {
      const state = useCommandCenter.getState();
      if (state.focused || state.panelOpen || interactiveTarget(event)) {
        pendingTap.current = null;
        return;
      }

      const id = resolvePointer(event);
      pendingTap.current = id ? { id, x: event.clientX, y: event.clientY, pointerId: event.pointerId } : null;
    };

    const handleUp = (event: PointerEvent) => {
      const tap = pendingTap.current;
      pendingTap.current = null;
      if (!tap || tap.pointerId !== event.pointerId || interactiveTarget(event)) return;

      const moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y);
      if (moved > 12) return;

      const id = resolvePointer(event);
      if (!id || id !== tap.id) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const state = useCommandCenter.getState();
      state.focus(state.focused === id ? null : id);
    };

    const handleCancel = () => {
      pendingTap.current = null;
    };

    window.addEventListener('pointermove', handleMove, { capture: true });
    window.addEventListener('mousemove', handleMove, { capture: true });
    window.addEventListener('pointerdown', handleDown, { capture: true });
    window.addEventListener('pointerup', handleUp, { capture: true });
    window.addEventListener('pointercancel', handleCancel, { capture: true });
    window.addEventListener('blur', clearHover);
    return () => {
      window.removeEventListener('pointermove', handleMove, { capture: true });
      window.removeEventListener('mousemove', handleMove, { capture: true });
      window.removeEventListener('pointerdown', handleDown, { capture: true });
      window.removeEventListener('pointerup', handleUp, { capture: true });
      window.removeEventListener('pointercancel', handleCancel, { capture: true });
      window.removeEventListener('blur', clearHover);
      clearHover();
    };
  }, [camera, gl, power, setHint]);

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
        <Monitor key={m.id} def={m} hovered={hoveredId === m.id} />
      ))}
      {/* screen glow spilling onto the camp at dusk */}
      <pointLight ref={(el) => { lights.current[0] = el; }} position={[0, 2.5, -2.6]} intensity={7} distance={9} color="#9aa878" decay={2} />
      <pointLight ref={(el) => { lights.current[1] = el; }} position={[-4.2, 2.4, -2.4]} intensity={3} distance={6} color="#8fa268" decay={2} />
      <pointLight ref={(el) => { lights.current[2] = el; }} position={[4.2, 2.4, -2.4]} intensity={3} distance={6} color="#8fa268" decay={2} />
    </group>
  );
}
