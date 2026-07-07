'use client';

import { useMemo, useRef } from 'react';
import { CatmullRomCurve3, Group, InstancedMesh, MathUtils, Object3D, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { seeded } from '@/lib/data';
import { WIRE_SAGS } from './Room';

const dummy = new Object3D();

/* ------------------------------------------------------------------ */
/*  Deer — a small herd grazing by the old road.                       */
/* ------------------------------------------------------------------ */

function Deer({ position, facing, phase, buck = false }: { position: [number, number, number]; facing: number; phase: number; buck?: boolean }) {
  const head = useRef<Group>(null);
  const body = useRef<Group>(null);
  const root = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    // slow wander around the home patch — a deer never truly stands still
    if (root.current) {
      root.current.position.x = position[0] + Math.sin(t * 0.05) * 1.1 + Math.sin(t * 0.13) * 0.3;
      root.current.position.z = position[2] + Math.cos(t * 0.04) * 0.9;
      root.current.rotation.y = facing + Math.sin(t * 0.05) * 0.4;
    }
    // long graze (head down) with occasional alert look-up
    const cycle = (t * 0.08) % 1;
    const up = cycle > 0.72 && cycle < 0.86;
    if (head.current) {
      const target = up ? 0.35 : -0.72 + Math.sin(t * 1.7) * 0.06;
      head.current.rotation.z += (target - head.current.rotation.z) * 0.04;
      head.current.rotation.y = up ? Math.sin(t * 0.5) * 0.3 : 0;
    }
    if (body.current) body.current.position.y = 0.62 + Math.sin(t * 1.1) * 0.006; // breath
  });

  const hide = '#7a5c3d';
  const HIDE = { color: hide, roughness: 1 };

  return (
    <group ref={root} position={position} rotation={[0, facing, 0]} scale={0.9}>
      <group ref={body} position={[0, 0.62, 0]}>
        {/* body */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.16, 0.45, 5, 10]} />
          <meshStandardMaterial {...HIDE} />
        </mesh>
        {/* neck + head */}
        <group ref={head} position={[0.36, 0.1, 0]}>
          <mesh position={[0.1, 0.16, 0]} rotation={[0, 0, -0.7]}>
            <capsuleGeometry args={[0.055, 0.3, 4, 8]} />
            <meshStandardMaterial {...HIDE} />
          </mesh>
          <mesh position={[0.26, 0.3, 0]}>
            <boxGeometry args={[0.2, 0.09, 0.08]} />
            <meshStandardMaterial {...HIDE} />
          </mesh>
          {/* ears */}
          {[-0.045, 0.045].map((z) => (
            <mesh key={z} position={[0.18, 0.38, z]} rotation={[z * 8, 0, 0.3]}>
              <coneGeometry args={[0.025, 0.08, 5]} />
              <meshStandardMaterial {...HIDE} />
            </mesh>
          ))}
          {buck && [-0.03, 0.03].map((z) => (
            <group key={z} position={[0.16, 0.42, z]}>
              <mesh rotation={[z * 10, 0, 0.3]}>
                <cylinderGeometry args={[0.008, 0.012, 0.22, 5]} />
                <meshStandardMaterial color="#5c4a32" roughness={1} />
              </mesh>
              <mesh position={[-0.03, 0.08, z]} rotation={[0, 0, 1.1]}>
                <cylinderGeometry args={[0.006, 0.009, 0.12, 5]} />
                <meshStandardMaterial color="#5c4a32" roughness={1} />
              </mesh>
            </group>
          ))}
        </group>
        {/* tail */}
        <mesh position={[-0.4, 0.08, 0]} rotation={[0, 0, 0.6]}>
          <coneGeometry args={[0.035, 0.12, 5]} />
          <meshStandardMaterial color="#e8dcc8" roughness={1} />
        </mesh>
      </group>
      {/* legs */}
      {[[0.24, 0.09], [0.24, -0.09], [-0.24, 0.09], [-0.24, -0.09]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.28, z]}>
          <cylinderGeometry args={[0.022, 0.018, 0.56, 6]} />
          <meshStandardMaterial color="#6a4f34" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Rabbits — quick hops through the tall grass.                       */
/* ------------------------------------------------------------------ */

function Rabbit({ center, radius, phase }: { center: [number, number, number]; radius: number; phase: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.35 + phase;
    const hop = (t * 2.2) % 1;
    const hopping = hop < 0.35;
    const angle = Math.floor(t * 2.2) * 0.5 + phase; // advance heading per hop
    const dist = (Math.floor(t * 2.2) % 8) / 8;
    g.position.set(
      center[0] + Math.cos(angle) * radius * dist,
      hopping ? Math.sin((hop / 0.35) * Math.PI) * 0.14 : 0,
      center[2] + Math.sin(angle) * radius * dist,
    );
    g.rotation.y = -angle;
  });
  return (
    <group ref={ref} scale={0.8}>
      <mesh position={[0, 0.09, 0]}>
        <sphereGeometry args={[0.09, 8, 7]} />
        <meshStandardMaterial color="#8a7a62" roughness={1} />
      </mesh>
      <mesh position={[0.07, 0.16, 0]}>
        <sphereGeometry args={[0.055, 8, 7]} />
        <meshStandardMaterial color="#8a7a62" roughness={1} />
      </mesh>
      {[-0.025, 0.025].map((z) => (
        <mesh key={z} position={[0.06, 0.24, z]} rotation={[0, 0, -0.15]}>
          <capsuleGeometry args={[0.012, 0.07, 3, 6]} />
          <meshStandardMaterial color="#8a7a62" roughness={1} />
        </mesh>
      ))}
      <mesh position={[-0.09, 0.1, 0]}>
        <sphereGeometry args={[0.03, 6, 5]} />
        <meshStandardMaterial color="#e8dcc8" roughness={1} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Fox — a lone wanderer crossing the overgrown street.               */
/* ------------------------------------------------------------------ */

function Fox() {
  const ref = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const path = useMemo(
    () =>
      new CatmullRomCurve3(
        [
          new Vector3(-14, 0, -7), new Vector3(-6, 0, -10.5), new Vector3(4, 0, -7.5),
          new Vector3(12, 0, -11), new Vector3(18, 0, -8), new Vector3(6, 0, -13),
          new Vector3(-8, 0, -13.5),
        ],
        true,
      ),
    [],
  );
  const pos = useMemo(() => new Vector3(), []);
  const ahead = useMemo(() => new Vector3(), []);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = (clock.elapsedTime * 0.008) % 1;
    path.getPointAt(t, pos);
    path.getPointAt((t + 0.004) % 1, ahead);
    g.position.set(pos.x, Math.abs(Math.sin(clock.elapsedTime * 5.5)) * 0.02, pos.z);
    g.lookAt(ahead.x, 0, ahead.z);
    if (tail.current) tail.current.rotation.y = Math.sin(clock.elapsedTime * 2.3) * 0.25;
  });

  return (
    <group ref={ref} scale={0.75}>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.1, 0.34, 4, 8]} />
        <meshStandardMaterial color="#a3663a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.4, 0.26]}>
        <coneGeometry args={[0.07, 0.18, 6]} />
        <meshStandardMaterial color="#a3663a" roughness={1} />
      </mesh>
      {[-0.035, 0.035].map((x) => (
        <mesh key={x} position={[x, 0.5, 0.22]}>
          <coneGeometry args={[0.02, 0.06, 4]} />
          <meshStandardMaterial color="#8a512c" roughness={1} />
        </mesh>
      ))}
      <group ref={tail} position={[0, 0.32, -0.28]}>
        <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2.3, 0, 0]}>
          <capsuleGeometry args={[0.05, 0.2, 4, 8]} />
          <meshStandardMaterial color="#b3763f" roughness={1} />
        </mesh>
        <mesh position={[0, 0.03, -0.26]}>
          <sphereGeometry args={[0.045, 6, 5]} />
          <meshStandardMaterial color="#e8dcc8" roughness={1} />
        </mesh>
      </group>
      {[[0.06, 0.12], [-0.06, 0.12], [0.06, -0.12], [-0.06, -0.12]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.12, z]}>
          <cylinderGeometry args={[0.016, 0.014, 0.24, 5]} />
          <meshStandardMaterial color="#5c3a22" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Birds.                                                             */
/* ------------------------------------------------------------------ */

/** Perched songbirds; one takes a short loop flight now and then. */
function PerchedBird({ perch, phase, flies = false }: { perch: [number, number, number]; phase: number; flies?: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime + phase;
    const cycle = (t * 0.02) % 1; // ~50s period
    if (flies && cycle < 0.14) {
      const p = cycle / 0.14;
      const arc = Math.sin(p * Math.PI);
      g.position.set(
        perch[0] + Math.sin(p * Math.PI * 2) * 2.2,
        perch[1] + arc * 1.6,
        perch[2] - Math.sin(p * Math.PI) * 2.4,
      );
      g.rotation.y = p * Math.PI * 2;
      g.rotation.z = Math.sin(t * 30) * 0.4; // flutter
    } else {
      g.position.set(perch[0], perch[1] + Math.abs(Math.sin(t * 3)) * 0.008, perch[2]);
      g.rotation.set(0, Math.sin(t * 0.4) * 0.6, 0);
    }
  });
  return (
    <group ref={ref} scale={0.6}>
      <mesh>
        <sphereGeometry args={[0.05, 7, 6]} />
        <meshStandardMaterial color="#6a5c48" roughness={1} />
      </mesh>
      <mesh position={[0.045, 0.035, 0]}>
        <sphereGeometry args={[0.032, 6, 5]} />
        <meshStandardMaterial color="#5c4c3a" roughness={1} />
      </mesh>
      <mesh position={[-0.07, 0.01, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.02, 0.09, 4]} />
        <meshStandardMaterial color="#5c4c3a" roughness={1} />
      </mesh>
    </group>
  );
}

/** Crows drifting between the ruins on closed loops. */
function Crow({ offset, loop }: { offset: number; loop: Vector3[] }) {
  const ref = useRef<Group>(null);
  const wingL = useRef<Group>(null);
  const wingR = useRef<Group>(null);
  const path = useMemo(() => new CatmullRomCurve3(loop, true), [loop]);
  const pos = useMemo(() => new Vector3(), []);
  const ahead = useMemo(() => new Vector3(), []);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = (clock.elapsedTime * 0.014 + offset) % 1;
    path.getPointAt(t, pos);
    path.getPointAt((t + 0.01) % 1, ahead);
    g.position.copy(pos);
    g.lookAt(ahead);
    const flap = Math.sin(clock.elapsedTime * 7 + offset * 20) * 0.7;
    if (wingL.current) wingL.current.rotation.z = flap;
    if (wingR.current) wingR.current.rotation.z = -flap;
  });

  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.035, 0.14, 4, 6]} />
        <meshStandardMaterial color="#1c1a17" roughness={1} />
      </mesh>
      <group ref={wingL} position={[0.02, 0, 0]}>
        <mesh position={[0.14, 0, 0]}>
          <planeGeometry args={[0.28, 0.1]} />
          <meshStandardMaterial color="#22201c" roughness={1} side={2} />
        </mesh>
      </group>
      <group ref={wingR} position={[-0.02, 0, 0]}>
        <mesh position={[-0.14, 0, 0]}>
          <planeGeometry args={[0.28, 0.1]} />
          <meshStandardMaterial color="#22201c" roughness={1} side={2} />
        </mesh>
      </group>
    </group>
  );
}

/** A loose flock crossing high overhead every so often. */
function Flock({ y = 17, z = -24, speed = 0.016, size = 1 }: { y?: number; z?: number; speed?: number; size?: number }) {
  const COUNT = 13;
  const ref = useRef<InstancedMesh>(null);
  const offsets = useMemo(() => {
    const r = seeded(19);
    return Array.from({ length: COUNT }, () => ({
      dx: (r() - 0.5) * 5, dy: (r() - 0.5) * 1.6, dz: (r() - 0.5) * 3, p: r() * Math.PI * 2,
    }));
  }, []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    const k = ((t * speed) % 1); // slow crossing
    const x = MathUtils.lerp(-45, 45, k);
    const visible = k > 0.02 && k < 0.98;
    mesh.visible = visible;
    offsets.forEach((o, i) => {
      const flap = 0.5 + Math.abs(Math.sin(t * 6 + o.p)) * 0.8;
      dummy.position.set(x + o.dx, y + o.dy + Math.sin(t * 0.8 + o.p) * 0.5, z + o.dz);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.scale.set(size, flap * size, size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.5, 0.16]} />
      <meshStandardMaterial color="#26231e" roughness={1} side={2} />
    </instancedMesh>
  );
}

/** Crow sitting on a power line — occasional wing stretch, then stillness. */
function WireCrow({ sag, phase }: { sag: [number, number, number]; phase: number }) {
  const ref = useRef<Group>(null);
  const wing = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    if (ref.current) {
      ref.current.position.set(sag[0], sag[1] + 0.02 + Math.sin(t * 2.2) * 0.004, sag[2]);
      ref.current.rotation.y = Math.sin(t * 0.3) * 0.5;
    }
    if (wing.current) {
      const stretch = (t * 0.05) % 1 < 0.06 ? Math.sin(((t * 0.05) % 1) / 0.06 * Math.PI) : 0;
      wing.current.rotation.z = stretch * 0.9;
    }
  });
  return (
    <group ref={ref} scale={0.7}>
      <mesh rotation={[Math.PI / 2.4, 0, 0]}>
        <capsuleGeometry args={[0.035, 0.11, 4, 6]} />
        <meshStandardMaterial color="#1a1815" roughness={1} />
      </mesh>
      <mesh position={[0, 0.07, 0.05]}>
        <sphereGeometry args={[0.028, 6, 5]} />
        <meshStandardMaterial color="#1a1815" roughness={1} />
      </mesh>
      <mesh position={[0, 0.02, -0.1]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.05, 0.01, 0.1]} />
        <meshStandardMaterial color="#1f1c18" roughness={1} />
      </mesh>
      <group ref={wing} position={[0.03, 0.03, 0]}>
        <mesh position={[0.06, 0, 0]} rotation={[0, 0, -0.2]}>
          <planeGeometry args={[0.12, 0.06]} />
          <meshStandardMaterial color="#22201c" roughness={1} side={2} />
        </mesh>
      </group>
    </group>
  );
}

/** Pigeons shuffling along a rooftop parapet. */
function Pigeon({ base, phase }: { base: [number, number, number]; phase: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.3 + phase;
    const step = Math.floor(t) % 6;
    const p = MathUtils.smoothstep(t % 1, 0, 0.3);
    const x0 = Math.sin(step * 2.1 + phase) * 0.5;
    const x1 = Math.sin((step + 1) * 2.1 + phase) * 0.5;
    g.position.set(base[0] + MathUtils.lerp(x0, x1, p), base[1] + Math.abs(Math.sin(t * 12)) * 0.008 * (p < 1 ? 1 : 0), base[2]);
    g.rotation.y = x1 > x0 ? 0.4 : -2.6;
  });
  return (
    <group ref={ref} scale={0.55}>
      <mesh rotation={[Math.PI / 2.6, 0, 0]}>
        <capsuleGeometry args={[0.045, 0.09, 4, 7]} />
        <meshStandardMaterial color="#6e6d70" roughness={1} />
      </mesh>
      <mesh position={[0, 0.08, 0.055]}>
        <sphereGeometry args={[0.03, 6, 5]} />
        <meshStandardMaterial color="#4c4a52" roughness={1} />
      </mesh>
      <mesh position={[0, 0.01, -0.09]} rotation={[0.6, 0, 0]}>
        <boxGeometry args={[0.05, 0.012, 0.09]} />
        <meshStandardMaterial color="#5a585c" roughness={1} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Small fliers & the squirrel.                                       */
/* ------------------------------------------------------------------ */

function Butterfly({ center, phase, tint }: { center: [number, number, number]; phase: number; tint: string }) {
  const ref = useRef<Group>(null);
  const wingL = useRef<Group>(null);
  const wingR = useRef<Group>(null);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.5 + phase;
    g.position.set(
      center[0] + Math.sin(t * 0.9) * 1.4 + Math.sin(t * 2.3) * 0.3,
      center[1] + 0.25 + Math.sin(t * 1.7) * 0.25,
      center[2] + Math.cos(t * 0.7) * 1.1,
    );
    g.rotation.y = t;
    const flap = Math.sin(clock.elapsedTime * 16 + phase) * 1.0;
    if (wingL.current) wingL.current.rotation.y = flap;
    if (wingR.current) wingR.current.rotation.y = -flap;
  });

  return (
    <group ref={ref} scale={0.5}>
      <group ref={wingL}>
        <mesh position={[0.05, 0, 0]}>
          <planeGeometry args={[0.1, 0.08]} />
          <meshStandardMaterial color={tint} roughness={1} side={2} />
        </mesh>
      </group>
      <group ref={wingR}>
        <mesh position={[-0.05, 0, 0]}>
          <planeGeometry args={[0.1, 0.08]} />
          <meshStandardMaterial color={tint} roughness={1} side={2} />
        </mesh>
      </group>
    </group>
  );
}

function Dragonfly({ center, phase }: { center: [number, number, number]; phase: number }) {
  const ref = useRef<Group>(null);
  const rand = useMemo(() => {
    // deterministic waypoint per dart segment
    return (n: number, axis: number) => {
      const r = seeded(Math.floor(n) * 17 + axis * 7 + phase * 100);
      return r() - 0.5;
    };
  }, [phase]);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.7 + phase;
    const seg = t / 1.4;
    const p = MathUtils.smoothstep(seg % 1, 0, 0.35); // quick dart then hover
    const x0 = rand(seg, 0) * 3, x1 = rand(seg + 1, 0) * 3;
    const y0 = rand(seg, 1) * 0.8, y1 = rand(seg + 1, 1) * 0.8;
    const z0 = rand(seg, 2) * 2, z1 = rand(seg + 1, 2) * 2;
    g.position.set(
      center[0] + MathUtils.lerp(x0, x1, p),
      center[1] + 0.6 + MathUtils.lerp(y0, y1, p) + Math.sin(clock.elapsedTime * 9) * 0.02,
      center[2] + MathUtils.lerp(z0, z1, p),
    );
    g.rotation.y = Math.atan2(x1 - x0, z1 - z0);
  });

  return (
    <group ref={ref} scale={0.6}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.014, 0.16, 5]} />
        <meshStandardMaterial color="#3a5a5c" roughness={0.6} />
      </mesh>
      {[[-0.05, 0.02], [0.05, 0.02], [-0.05, -0.02], [0.05, -0.02]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.01, z]} rotation={[0, i < 2 ? 0.3 : -0.3, 0]}>
          <planeGeometry args={[0.11, 0.025]} />
          <meshStandardMaterial color="#c9d9d9" transparent opacity={0.45} roughness={0.4} side={2} />
        </mesh>
      ))}
    </group>
  );
}

function Squirrel() {
  const ref = useRef<Group>(null);
  // waypoints: car roof → ground → tree base → up the trunk
  const points = useMemo(
    () => [
      new Vector3(-16, 0.9, -13.6), new Vector3(-15, 0.05, -12.8), new Vector3(-13.6, 0.05, -12.2),
      new Vector3(-13, 1.4, -12), new Vector3(-13.3, 0.05, -12.4), new Vector3(-15.4, 0.05, -13.2),
    ],
    [],
  );

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.45;
    const seg = Math.floor(t) % points.length;
    const next = (seg + 1) % points.length;
    const p = MathUtils.smoothstep(t % 1, 0, 0.4); // dart, then pause
    g.position.lerpVectors(points[seg], points[next], p);
    g.position.y += Math.abs(Math.sin(clock.elapsedTime * 14)) * 0.015 * (p < 1 ? 1 : 0);
    const dir = new Vector3().subVectors(points[next], points[seg]);
    g.rotation.y = Math.atan2(dir.x, dir.z);
  });

  return (
    <group ref={ref} scale={0.55}>
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2.5, 0, 0]}>
        <capsuleGeometry args={[0.045, 0.1, 4, 6]} />
        <meshStandardMaterial color="#7a4f30" roughness={1} />
      </mesh>
      <mesh position={[0, 0.12, 0.08]}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshStandardMaterial color="#7a4f30" roughness={1} />
      </mesh>
      <mesh position={[0, 0.14, -0.1]} rotation={[-0.9, 0, 0]}>
        <capsuleGeometry args={[0.035, 0.12, 4, 6]} />
        <meshStandardMaterial color="#8a5c38" roughness={1} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Snake — slithers between grass patches, vanishing into cover.      */
/* ------------------------------------------------------------------ */

function Snake() {
  const SEGS = 11;
  const refs = useRef<(Group | null)[]>([]);
  const state = useRef({
    pos: new Vector3(5, 0, -6),
    target: new Vector3(8, 0, -7),
    trail: Array.from({ length: SEGS }, () => new Vector3(5, 0, -6)),
    nextPick: 0,
    hide: 0,
  });

  const pickTarget = (t: number) => {
    const s = state.current;
    // deterministic-ish wander: hash the pick counter
    const r = seeded(Math.floor(t * 13) + 7);
    s.target.set(2 + r() * 12, 0, -12 + r() * 8);
    s.nextPick = t + 7 + r() * 8;
    s.hide = r() < 0.35 ? t + 3 : 0; // sometimes dive under the grass mid-journey
  };

  useFrame(({ clock }, dt) => {
    const s = state.current;
    const t = clock.elapsedTime;
    if (t > s.nextPick) pickTarget(t);
    // head advances toward target with a slither wiggle
    const dir = new Vector3().subVectors(s.target, s.pos);
    const dist = dir.length();
    if (dist > 0.1) {
      dir.normalize();
      const side = new Vector3(-dir.z, 0, dir.x);
      s.pos.addScaledVector(dir, dt * 0.5);
      s.pos.addScaledVector(side, Math.sin(t * 4.2) * dt * 0.35);
    }
    // trail follows with fixed spacing
    s.trail[0].copy(s.pos);
    for (let i = 1; i < SEGS; i++) {
      const prev = s.trail[i - 1];
      const cur = s.trail[i];
      const d = new Vector3().subVectors(prev, cur);
      const len = d.length();
      const gap = 0.09;
      if (len > gap) cur.addScaledVector(d.normalize(), len - gap);
    }
    // submerged phase — slips beneath the vegetation
    const sink = s.hide && t > s.hide && t < s.hide + 4 ? Math.sin(((t - s.hide) / 4) * Math.PI) * 0.09 : 0;
    s.trail.forEach((p, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.set(p.x, Math.max(0.005, 0.035 - sink) , p.z);
      g.visible = sink < 0.075;
    });
  });

  return (
    <group>
      {Array.from({ length: SEGS }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <mesh>
            <sphereGeometry args={[0.038 * (i === 0 ? 1.15 : 1 - i * 0.045), 7, 6]} />
            <meshStandardMaterial color={i % 2 ? '#3c4230' : '#2e3426'} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Raccoon — waddles the sidewalk at its own pace.                    */
/* ------------------------------------------------------------------ */

function Raccoon() {
  const ref = useRef<Group>(null);
  const path = useMemo(
    () =>
      new CatmullRomCurve3(
        [
          new Vector3(12, 0, -5.2), new Vector3(6, 0, -5.0), new Vector3(-1, 0, -5.4),
          new Vector3(-8, 0, -5.1), new Vector3(-13, 0, -6.5), new Vector3(-6, 0, -7.8),
          new Vector3(4, 0, -7.2),
        ],
        true,
      ),
    [],
  );
  const pos = useMemo(() => new Vector3(), []);
  const ahead = useMemo(() => new Vector3(), []);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    // waddle with pauses: eased progress
    const raw = clock.elapsedTime * 0.006;
    const t = (raw + Math.sin(raw * 20) * 0.004) % 1;
    path.getPointAt(t, pos);
    path.getPointAt((t + 0.005) % 1, ahead);
    g.position.set(pos.x, Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.015, pos.z);
    g.lookAt(ahead.x, 0, ahead.z);
    g.rotation.z = Math.sin(clock.elapsedTime * 6) * 0.06; // waddle roll
  });

  return (
    <group ref={ref} scale={0.6}>
      <mesh position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.11, 0.22, 4, 8]} />
        <meshStandardMaterial color="#4c4a46" roughness={1} />
      </mesh>
      <mesh position={[0, 0.22, 0.2]}>
        <sphereGeometry args={[0.075, 8, 7]} />
        <meshStandardMaterial color="#55534e" roughness={1} />
      </mesh>
      {/* bandit mask */}
      <mesh position={[0, 0.225, 0.26]}>
        <boxGeometry args={[0.11, 0.035, 0.04]} />
        <meshStandardMaterial color="#161512" roughness={1} />
      </mesh>
      {[-0.04, 0.04].map((x) => (
        <mesh key={x} position={[x, 0.29, 0.2]}>
          <coneGeometry args={[0.022, 0.045, 4]} />
          <meshStandardMaterial color="#3a3835" roughness={1} />
        </mesh>
      ))}
      {/* ringed tail */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.16 + i * 0.02, -0.24 - i * 0.07]} rotation={[0.5, 0, 0]}>
          <sphereGeometry args={[0.05 - i * 0.008, 6, 5]} />
          <meshStandardMaterial color={i % 2 ? '#1c1a17' : '#55534e'} roughness={1} />
        </mesh>
      ))}
      {[[0.07, 0.12], [-0.07, 0.12], [0.07, -0.12], [-0.07, -0.12]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.06, z]}>
          <cylinderGeometry args={[0.018, 0.016, 0.12, 5]} />
          <meshStandardMaterial color="#2c2a26" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Assembly.                                                          */
/* ------------------------------------------------------------------ */

export default function Wildlife() {
  const crowLoopA = useMemo(
    () => [
      new Vector3(-20, 10, -28), new Vector3(-6, 13, -34), new Vector3(8, 11, -30),
      new Vector3(2, 15, -38), new Vector3(-12, 12, -36),
    ],
    [],
  );
  const crowLoopB = useMemo(
    () => [
      new Vector3(18, 9, -26), new Vector3(28, 12, -32), new Vector3(12, 14, -36), new Vector3(22, 10, -40),
    ],
    [],
  );

  return (
    <group>
      {/* herd grazing left of the old road */}
      <Deer position={[-10.5, 0, -10]} facing={0.5} phase={0} buck />
      <Deer position={[-12.5, 0, -11.5]} facing={-0.4} phase={3.2} />
      <Deer position={[-9, 0, -12.3]} facing={1.1} phase={6.1} />
      <Deer position={[-13.8, 0, -9.2]} facing={0.2} phase={9.4} />

      {/* rabbits in the meadow */}
      <Rabbit center={[6, 0, -5.5]} radius={1.6} phase={0} />
      <Rabbit center={[10, 0, -7]} radius={1.2} phase={2.4} />
      <Rabbit center={[-5, 0, -4.6]} radius={1.4} phase={5.1} />

      {/* fox on patrol */}
      <Fox />

      {/* birds on the broken streetlights & scaffold */}
      <PerchedBird perch={[-5.68, 3.72, -8]} phase={0} flies />
      <PerchedBird perch={[-6.45, 3.5, -8]} phase={4} />
      <PerchedBird perch={[8.32, 3.68, -10]} phase={7} flies />
      <PerchedBird perch={[2.7, 4.62, -4.4]} phase={11} />

      {/* crows between the ruins + perched on the power lines */}
      <Crow offset={0} loop={crowLoopA} />
      <Crow offset={0.4} loop={crowLoopA} />
      <Crow offset={0.2} loop={crowLoopB} />
      <WireCrow sag={WIRE_SAGS[0]} phase={0} />
      <WireCrow sag={WIRE_SAGS[2]} phase={5.3} />

      {/* pigeons on the rooftop parapets */}
      <Pigeon base={[-13.2, 12.28, -13.9]} phase={0} />
      <Pigeon base={[-14.1, 12.28, -13.9]} phase={2.7} />
      <Pigeon base={[13.4, 14.78, -14.6]} phase={5.1} />

      {/* flocks crossing at altitude — one low, one far above the skyline */}
      <Flock />
      <Flock y={30} z={-40} speed={0.009} size={0.6} />

      {/* small fliers among the wildflowers */}
      <Butterfly center={[4.5, 0.2, -3.6]} phase={0} tint="#e8b558" />
      <Butterfly center={[-6, 0.2, -5]} phase={2.1} tint="#d9e8ee" />
      <Butterfly center={[8, 0.25, -6]} phase={4.4} tint="#c9909a" />
      <Butterfly center={[-9.5, 0.2, -6.5]} phase={6.8} tint="#e8d56a" />
      <Butterfly center={[1.5, 0.2, -6.2]} phase={9.2} tint="#e8b558" />
      <Dragonfly center={[3, 0.4, -4.8]} phase={0.3} />
      <Dragonfly center={[-4, 0.5, -6.4]} phase={1.9} />

      {/* squirrel working the rusted car + tree */}
      <Squirrel />

      {/* ground-level wanderers */}
      <Snake />
      <Raccoon />
    </group>
  );
}
