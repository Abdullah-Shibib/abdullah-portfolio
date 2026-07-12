'use client';

import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, CatmullRomCurve3, Color, Group, InstancedMesh, MathUtils, Object3D, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { seeded } from '@/lib/data';
import { WORLD } from '@/lib/world';
import { WIRE_SAGS } from './Room';

const dummy = new Object3D();
const tmpColor = new Color();
const scratchV = new Vector3();

/* Shared predator/prey blackboard — rabbits read the fox, the fox reads them. */
export const FOX_POS = new Vector3(999, 0, 999);
const RABBIT_POSITIONS: (Vector3 | undefined)[] = [];

/** The puddles from Room's terrain — deer drink here. */
const PUDDLES: [number, number][] = [[3.5, -8.2], [-9.5, -9.6]];

/** Herd blackboard — now and then the whole herd gathers at a puddle,
 *  drinks, then drifts off together. The lead deer runs the clock. */
const HERD = {
  gatherUntil: 0,
  nextGather: 70,
  spot: new Vector3(-9.5, 0, -9.6),
};

/** The fox den — tucked under the big bush on the far left flank. */
const DEN = new Vector3(-23.6, 0, -13.5);

const angleLerp = (a: number, b: number, k: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};

/* ------------------------------------------------------------------ */
/*  Deer — a small herd grazing by the old road.                       */
/* ------------------------------------------------------------------ */

type DeerMode = 'graze' | 'scan' | 'walk' | 'toWater' | 'drink' | 'retreat' | 'rest';

function Deer({ position, facing, phase, buck = false, lead = false }: { position: [number, number, number]; facing: number; phase: number; buck?: boolean; lead?: boolean }) {
  const head = useRef<Group>(null);
  const body = useRef<Group>(null);
  const root = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const st = useRef({
    pos: new Vector3(position[0], 0, position[2]),
    heading: facing,
    mode: 'graze' as DeerMode,
    until: phase % 3,
    decision: Math.floor(phase * 13),
    target: new Vector3(position[0], 0, position[2]),
    restK: 0, // 0 standing … 1 bedded down
  });

  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    const s = st.current;
    const t = clock.elapsedTime;
    const step = Math.min(dt, 0.1);
    const night = WORLD.night;

    // the lead deer runs the herd clock: gather at the puddle, then move off
    if (lead && t > HERD.nextGather && night < 0.5) {
      HERD.spot.set(PUDDLES[1][0], 0, PUDDLES[1][1]);
      HERD.gatherUntil = t + 26;
      HERD.nextGather = t + 160 + Math.random() * 220;
    }
    const gathering = t < HERD.gatherUntil;
    if (gathering && s.mode !== 'toWater' && s.mode !== 'drink') {
      s.mode = 'toWater';
      // fan out around the water's edge instead of stacking on one point
      s.target.set(HERD.spot.x + Math.cos(phase * 2.1) * 1.35, 0, HERD.spot.z + Math.sin(phase * 2.1) * 1.1);
      s.until = t + 20;
    }

    /* -- decide -- */
    if (t > s.until && s.mode !== 'toWater' && s.mode !== 'drink') {
      s.decision++;
      const r = seeded(1009 + Math.floor(phase * 100) * 31 + s.decision * 17);
      const roll = r();
      if (night > 0.7) {
        // bedded down after dark, with the occasional watchful look around
        if (roll < 0.75) {
          s.mode = 'rest';
          s.until = t + 14 + r() * 22;
        } else {
          s.mode = 'scan';
          s.until = t + 2 + r() * 2;
        }
      } else if (roll < 0.42) {
        s.mode = 'graze';
        s.until = t + 4 + r() * 6;
      } else if (roll < 0.62) {
        s.mode = 'scan'; // pause, listen, look around
        s.until = t + 1.8 + r() * 2.6;
      } else if (roll < 0.87) {
        s.mode = 'walk';
        s.target.set(position[0] + (r() - 0.5) * 6.5, 0, position[2] + (r() - 0.5) * 4.5);
        s.until = t + 10;
      } else if (roll < 0.94) {
        // wander to the nearest puddle for a solo drink
        const p = Math.hypot(PUDDLES[0][0] - s.pos.x, PUDDLES[0][1] - s.pos.z) <
          Math.hypot(PUDDLES[1][0] - s.pos.x, PUDDLES[1][1] - s.pos.z) ? PUDDLES[0] : PUDDLES[1];
        s.mode = 'toWater';
        s.target.set(p[0] + (r() - 0.5) * 1.4, 0, p[1] + (r() - 0.5) * 1.0);
        s.until = t + 18;
      } else {
        // melt deeper into the vegetation for a while
        s.mode = 'retreat';
        s.target.set(position[0] + (r() - 0.5) * 3, 0, Math.min(-12.5, position[2] - 3 - r() * 2.5));
        s.until = t + 14;
      }
    }

    /* -- act -- */
    let speed = 0;
    let headTarget = -0.1;
    if (s.mode === 'graze') {
      speed = 0.05; // nose-down drift through the grass
      s.heading += Math.sin(t * 0.11 + phase) * step * 0.25;
      headTarget = -0.72 + Math.sin(t * 1.7 + phase) * 0.06;
    } else if (s.mode === 'scan') {
      headTarget = 0.35;
    } else if (s.mode === 'rest') {
      headTarget = 0.05 + Math.sin(t * 0.4 + phase) * 0.08;
    } else if (s.mode === 'drink') {
      headTarget = -0.95;
      if (t > s.until) {
        s.mode = gathering ? 'scan' : 'walk';
        if (!gathering) s.target.set(position[0] + Math.sin(phase) * 2, 0, position[2] + Math.cos(phase) * 2);
        s.until = t + (gathering ? 2 : 8);
      }
    } else {
      // walk / toWater / retreat — steer toward the target
      const want = Math.atan2(s.target.x - s.pos.x, s.target.z - s.pos.z);
      s.heading = angleLerp(s.heading, want, Math.min(1, step * 1.6));
      speed = s.mode === 'toWater' ? 0.62 : 0.45;
      headTarget = -0.05;
      if (s.pos.distanceTo(s.target) < 0.35 || t > s.until) {
        if (s.mode === 'toWater') {
          s.mode = 'drink';
          s.until = t + 5 + (phase % 1) * 4;
        } else {
          s.mode = 'graze';
          s.until = t + 3 + (phase % 1) * 4;
        }
      }
    }

    s.pos.x += Math.sin(s.heading) * speed * step;
    s.pos.z += Math.cos(s.heading) * speed * step;

    // bed down / stand up smoothly
    s.restK += ((s.mode === 'rest' ? 1 : 0) - s.restK) * Math.min(1, step * 1.2);

    const bob = speed > 0.2 ? Math.abs(Math.sin(t * 6.5 + phase)) * 0.02 : 0;
    g.position.set(s.pos.x, bob - s.restK * 0.3, s.pos.z);
    g.rotation.y = s.heading;

    if (head.current) {
      head.current.rotation.z += (headTarget - head.current.rotation.z) * Math.min(1, step * 3.5);
      const lookAround = s.mode === 'scan' || s.mode === 'rest' ? Math.sin(t * 0.5 + phase) * 0.4 : 0;
      head.current.rotation.y += (lookAround - head.current.rotation.y) * Math.min(1, step * 2.5);
    }
    if (body.current) body.current.position.y = 0.62 + Math.sin(t * 1.1 + phase) * 0.006; // breath
    if (tail.current) tail.current.rotation.x = (t * 0.31 + phase) % 1 < 0.08 ? Math.sin(t * 30) * 0.5 : 0; // flick
  });

  const hide = '#7a5c3d';
  const HIDE = { color: hide, roughness: 1 };

  return (
    <group ref={root} position={position} rotation={[0, facing, 0]} scale={1.35}>
      <group ref={body} position={[0, 0.62, 0]}>
        {/* body */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.17, 0.52, 10, 18]} />
          <meshStandardMaterial {...HIDE} />
        </mesh>
        {/* neck + head */}
        <group ref={head} position={[0.36, 0.1, 0]}>
          <mesh position={[0.1, 0.16, 0]} rotation={[0, 0, -0.7]}>
            <capsuleGeometry args={[0.06, 0.32, 8, 14]} />
            <meshStandardMaterial {...HIDE} />
          </mesh>
          <mesh position={[0.26, 0.3, 0]} scale={[1.45, 0.75, 0.65]}>
            <sphereGeometry args={[0.075, 16, 12]} />
            <meshStandardMaterial {...HIDE} />
          </mesh>
          <mesh position={[0.35, 0.28, 0]} scale={[1.25, 0.6, 0.5]}>
            <sphereGeometry args={[0.045, 12, 8]} />
            <meshStandardMaterial color="#5f432c" roughness={1} />
          </mesh>
          {[-0.042, 0.042].map((z) => (
            <mesh key={`eye${z}`} position={[0.31, 0.325, z]}>
              <sphereGeometry args={[0.008, 8, 6]} />
              <meshBasicMaterial color="#100b06" />
            </mesh>
          ))}
          {/* ears */}
          {[-0.045, 0.045].map((z) => (
            <mesh key={z} position={[0.18, 0.38, z]} rotation={[z * 8, 0, 0.3]}>
              <coneGeometry args={[0.026, 0.09, 8]} />
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
        <group ref={tail} position={[-0.4, 0.08, 0]}>
          <mesh rotation={[0, 0, 0.6]}>
            <coneGeometry args={[0.035, 0.12, 8]} />
            <meshStandardMaterial color="#e8dcc8" roughness={1} />
          </mesh>
        </group>
      </group>
      {/* legs */}
      {[[0.24, 0.09], [0.24, -0.09], [-0.24, 0.09], [-0.24, -0.09]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.28, z]}>
          <cylinderGeometry args={[0.022, 0.017, 0.56, 8]} />
          <meshStandardMaterial color="#6a4f34" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Rabbits — graze, freeze, hop, and bolt when the fox closes in.     */
/* ------------------------------------------------------------------ */

type RabbitMode = 'graze' | 'hop' | 'freeze' | 'flee';

function Rabbit({ home, radius, phase, idx }: { home: [number, number, number]; radius: number; phase: number; idx: number }) {
  const ref = useRef<Group>(null);
  const ears = useRef<Group>(null);
  const st = useRef({
    pos: new Vector3(home[0], 0, home[2]),
    heading: phase,
    mode: 'graze' as RabbitMode,
    until: phase % 2,
    decision: Math.floor(phase * 7),
  });

  useEffect(() => {
    RABBIT_POSITIONS[idx] = st.current.pos;
    return () => {
      RABBIT_POSITIONS[idx] = undefined;
    };
  }, [idx]);

  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const s = st.current;
    const t = clock.elapsedTime;
    const foxDist = s.pos.distanceTo(FOX_POS);

    // predator override — bolt directly away, with a little panic jitter
    if (foxDist < 3.4 && s.mode !== 'flee') {
      s.mode = 'flee';
      s.until = t;
    }

    let y = 0;
    if (s.mode === 'flee') {
      const away = Math.atan2(s.pos.x - FOX_POS.x, s.pos.z - FOX_POS.z);
      s.heading = angleLerp(s.heading, away + Math.sin(t * 7 + phase) * 0.5, Math.min(1, dt * 7));
      const hop = (t * 3.4 + phase) % 1;
      y = hop < 0.55 ? Math.sin((hop / 0.55) * Math.PI) * 0.17 : 0;
      const speed = 2.4;
      s.pos.x += Math.sin(s.heading) * speed * dt;
      s.pos.z += Math.cos(s.heading) * speed * dt;
      if (foxDist > 7) {
        s.mode = 'freeze'; // stop, look back, catch breath
        s.until = t + 1.4;
      }
    } else {
      if (t > s.until) {
        s.decision++;
        const r = seeded(idx * 131 + s.decision * 17);
        const roll = r();
        const distHome = Math.hypot(home[0] - s.pos.x, home[2] - s.pos.z);
        if (s.mode !== 'hop' && roll < 0.5) {
          s.mode = 'hop';
          // drift back toward the warren when it has strayed
          s.heading =
            distHome > radius
              ? Math.atan2(home[0] - s.pos.x, home[2] - s.pos.z) + (r() - 0.5) * 0.8
              : r() * Math.PI * 2;
          s.until = t + 0.9 + r() * 1.4;
        } else if (roll < 0.82) {
          s.mode = 'graze';
          s.until = t + 1.6 + r() * 3.4;
        } else {
          s.mode = 'freeze';
          s.until = t + 0.8 + r() * 1.6;
        }
      }
      if (s.mode === 'hop') {
        const hop = (t * 2.1 + phase) % 1;
        y = hop < 0.5 ? Math.sin((hop / 0.5) * Math.PI) * 0.12 : 0;
        const speed = 0.85;
        s.pos.x += Math.sin(s.heading) * speed * dt;
        s.pos.z += Math.cos(s.heading) * speed * dt;
      } else if (s.mode === 'graze') {
        y = -0.015 + Math.sin(t * 2.6 + phase) * 0.008; // nose in the grass
      }
    }

    g.position.set(s.pos.x, y, s.pos.z);
    g.rotation.y = s.heading;
    // pitch into the hop, sit level otherwise
    g.rotation.x += (((s.mode === 'hop' || s.mode === 'flee') && y > 0 ? -0.25 : 0) - g.rotation.x) * Math.min(1, dt * 8);
    // ears snap upright when alert
    if (ears.current) {
      const alert = s.mode === 'freeze' || s.mode === 'flee' ? 0 : -0.4;
      ears.current.rotation.x += (alert - ears.current.rotation.x) * Math.min(1, dt * 9);
    }
  });

  return (
    <group ref={ref} scale={1.35}>
      <mesh position={[0, 0.09, 0]} scale={[0.9, 0.72, 1.25]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshStandardMaterial color="#8a7a62" roughness={1} />
      </mesh>
      <mesh position={[0, 0.16, 0.09]} scale={[0.95, 0.8, 1.05]}>
        <sphereGeometry args={[0.06, 14, 10]} />
        <meshStandardMaterial color="#8a7a62" roughness={1} />
      </mesh>
      {[-0.026, 0.026].map((x) => (
        <mesh key={`reye${x}`} position={[x, 0.18, 0.145]}>
          <sphereGeometry args={[0.006, 8, 6]} />
          <meshBasicMaterial color="#120d09" />
        </mesh>
      ))}
      <mesh position={[0, 0.145, 0.158]} scale={[1, 0.65, 0.5]}>
        <sphereGeometry args={[0.013, 8, 6]} />
        <meshStandardMaterial color="#e8dcc8" roughness={1} />
      </mesh>
      <group ref={ears}>
        {[-0.025, 0.025].map((x) => (
          <mesh key={x} position={[x, 0.24, 0.06]} rotation={[-0.15, 0, 0]}>
            <capsuleGeometry args={[0.013, 0.085, 5, 10]} />
            <meshStandardMaterial color="#8a7a62" roughness={1} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.1, -0.09]}>
        <sphereGeometry args={[0.032, 10, 8]} />
        <meshStandardMaterial color="#e8dcc8" roughness={1} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Fox — patrols, sniffs, chases rabbits, melts into the brush.       */
/* ------------------------------------------------------------------ */

type FoxMode = 'patrol' | 'sniff' | 'chase' | 'hide' | 'toDen' | 'denRest';

/** Bushes it can vanish into (mirrors Room's bush spots). */
const FOX_COVER: [number, number][] = [[-9.4, -7.4], [11.2, -6.6], [2.2, -13.6], [17.8, -9.8]];

function Fox() {
  const ref = useRef<Group>(null);
  const head = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const path = useMemo(
    () =>
      new CatmullRomCurve3(
        [
          new Vector3(-13, 0, -6.5), new Vector3(-6, 0, -9.5), new Vector3(2, 0, -6),
          new Vector3(9, 0, -8.5), new Vector3(14, 0, -6.5), new Vector3(7, 0, -11.5),
          new Vector3(-3, 0, -12), new Vector3(-10, 0, -10.5),
        ],
        true,
      ),
    [],
  );
  const st = useRef({
    mode: 'patrol' as FoxMode,
    u: 0,
    until: 0,
    decision: 0,
    pos: new Vector3(-13, 0, -6.5),
    heading: 0,
    speed: 0,
    sink: 0,
    cover: new Vector3(),
    prey: -1,
  });
  const pathPoint = useMemo(() => new Vector3(), []);

  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const s = st.current;
    const t = clock.elapsedTime;

    let wantSpeed = 0.55;
    let target: Vector3 | null = null;

    // spot prey — only while working the route; hunts harder in the dark
    if (s.mode === 'patrol' && t > s.until) {
      let best = -1;
      let bestD = 4.2 + WORLD.night * 2.2;
      RABBIT_POSITIONS.forEach((p, i) => {
        if (!p) return;
        const d = s.pos.distanceTo(p);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best >= 0) {
        s.mode = 'chase';
        s.prey = best;
        s.until = t + 5;
      }
    }

    if (s.mode === 'chase') {
      const prey = RABBIT_POSITIONS[s.prey];
      if (!prey || t > s.until || s.pos.distanceTo(prey) < 0.35) {
        // lost it — nose the ground where it vanished, then move on
        s.mode = 'sniff';
        s.until = t + 2.4;
      } else {
        target = prey;
        wantSpeed = 2.1;
      }
    } else if (s.mode === 'sniff') {
      wantSpeed = 0.06;
      s.sink = Math.max(0, s.sink - dt * 0.9); // uncurl if it was resting
      if (head.current) head.current.rotation.x += (0.55 - head.current.rotation.x) * Math.min(1, dt * 5);
      if (t > s.until) {
        s.mode = 'patrol';
        s.until = t + 4;
        // re-enter the loop at the closest point so it never teleports
        let bestU = s.u;
        let bestD = Infinity;
        for (let i = 0; i < 24; i++) {
          const u = i / 24;
          path.getPointAt(u, pathPoint);
          const d = pathPoint.distanceTo(s.pos);
          if (d < bestD) {
            bestD = d;
            bestU = u;
          }
        }
        s.u = bestU;
      }
    } else if (s.mode === 'hide') {
      target = s.cover;
      wantSpeed = 1.1;
      const near = s.pos.distanceTo(s.cover) < 0.5;
      if (near) {
        wantSpeed = 0;
        s.sink = Math.min(1, s.sink + dt * 1.4); // slip beneath the brush
      }
      if (t > s.until) {
        s.sink = Math.max(0, s.sink - dt * 1.2);
        if (s.sink === 0) {
          s.mode = 'patrol';
          s.until = t + 6;
        }
      }
    } else if (s.mode === 'toDen') {
      target = DEN;
      wantSpeed = 0.95;
      if (s.pos.distanceTo(DEN) < 0.45) {
        s.mode = 'denRest';
        s.until = t + 16 + Math.random() * 24;
      }
    } else if (s.mode === 'denRest') {
      // curled up at the entrance — breathing, ears up, tail wrapped
      wantSpeed = 0;
      s.sink = Math.min(0.45, s.sink + dt * 0.8); // settle low against the dirt
      if (head.current) head.current.rotation.x += (0.15 - head.current.rotation.x) * Math.min(1, dt * 2);
      if (t > s.until) {
        // emerge: stretch, sniff the morning air, then work the route again
        s.mode = 'sniff';
        s.until = t + 2.2;
      }
    } else {
      // patrol — variable pace so the lap never feels looped
      if (head.current) head.current.rotation.x += (0 - head.current.rotation.x) * Math.min(1, dt * 4);
      const pace = 0.011 + Math.sin(t * 0.13) * 0.004 + Math.sin(t * 0.041) * 0.003;
      s.u = (s.u + dt * pace) % 1;
      path.getPointAt(s.u, pathPoint);
      target = pathPoint;
      wantSpeed = 0.9;
      if (t > s.until) {
        s.decision++;
        const r = seeded(977 + s.decision * 29);
        const roll = r();
        // a fox is crepuscular — bright midday sends it back to the den
        if (WORLD.dayness > 0.85 && WORLD.golden < 0.2 && roll < 0.3) {
          s.mode = 'toDen';
          s.until = t + 30;
        } else if (roll < 0.3) {
          s.mode = 'sniff';
          s.until = t + 1.6 + r() * 2;
        } else if (roll < 0.42) {
          s.mode = 'hide';
          let ci = 0;
          let cd = Infinity;
          FOX_COVER.forEach(([x, z], i) => {
            const d = Math.hypot(x - s.pos.x, z - s.pos.z);
            if (d < cd) {
              cd = d;
              ci = i;
            }
          });
          s.cover.set(FOX_COVER[ci][0], 0, FOX_COVER[ci][1]);
          s.until = t + 4 + r() * 4;
        } else {
          s.until = t + 5 + r() * 7;
        }
      }
    }

    // steer + move
    if (target) {
      const want = Math.atan2(target.x - s.pos.x, target.z - s.pos.z);
      s.heading = angleLerp(s.heading, want, Math.min(1, dt * (s.mode === 'chase' ? 6 : 3)));
    }
    s.speed += (wantSpeed - s.speed) * Math.min(1, dt * 3);
    s.pos.x += Math.sin(s.heading) * s.speed * dt;
    s.pos.z += Math.cos(s.heading) * s.speed * dt;

    FOX_POS.copy(s.pos);
    const trot = Math.abs(Math.sin(t * (4 + s.speed * 3))) * 0.022 * Math.min(1, s.speed);
    g.position.set(s.pos.x, trot - s.sink * 0.42, s.pos.z);
    g.rotation.y = s.heading;
    const sc = 1.2 * (1 - s.sink * 0.35);
    g.scale.setScalar(sc);
    if (tail.current) {
      tail.current.rotation.y = Math.sin(t * 2.3) * 0.25 + Math.sin(t * 5.1) * 0.1 * s.speed;
    }
  });

  return (
    <group ref={ref} scale={1.2}>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.9, 1.18]}>
        <capsuleGeometry args={[0.105, 0.42, 8, 16]} />
        <meshStandardMaterial color="#a3663a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.25, 0.08]} rotation={[Math.PI / 2, 0, 0]} scale={[0.55, 0.35, 0.95]}>
        <sphereGeometry args={[0.12, 14, 10]} />
        <meshStandardMaterial color="#efe0c9" roughness={1} />
      </mesh>
      <group ref={head} position={[0, 0.4, 0.24]}>
        <mesh position={[0, 0, 0.03]}>
          <coneGeometry args={[0.075, 0.19, 12]} />
          <meshStandardMaterial color="#a3663a" roughness={1} />
        </mesh>
        <mesh position={[0, -0.012, 0.1]} scale={[0.75, 0.45, 1.0]}>
          <sphereGeometry args={[0.04, 12, 8]} />
          <meshStandardMaterial color="#efe0c9" roughness={1} />
        </mesh>
        <mesh position={[0, -0.012, 0.145]} scale={[0.9, 0.6, 0.6]}>
          <sphereGeometry args={[0.014, 8, 6]} />
          <meshBasicMaterial color="#130b08" />
        </mesh>
        {[-0.032, 0.032].map((x) => (
          <mesh key={`feye${x}`} position={[x, 0.025, 0.075]}>
            <sphereGeometry args={[0.006, 8, 6]} />
            <meshBasicMaterial color="#140d08" />
          </mesh>
        ))}
        {[-0.035, 0.035].map((x) => (
          <mesh key={x} position={[x, 0.1, -0.02]}>
            <coneGeometry args={[0.022, 0.065, 8]} />
            <meshStandardMaterial color="#8a512c" roughness={1} />
          </mesh>
        ))}
      </group>
      <group ref={tail} position={[0, 0.32, -0.28]}>
        <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2.3, 0, 0]}>
          <capsuleGeometry args={[0.055, 0.24, 8, 14]} />
          <meshStandardMaterial color="#b3763f" roughness={1} />
        </mesh>
        <mesh position={[0, 0.03, -0.26]}>
          <sphereGeometry args={[0.05, 12, 8]} />
          <meshStandardMaterial color="#e8dcc8" roughness={1} />
        </mesh>
      </group>
      {[[0.06, 0.12], [-0.06, 0.12], [0.06, -0.12], [-0.06, -0.12]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.12, z]}>
          <cylinderGeometry args={[0.016, 0.013, 0.24, 8]} />
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
    g.visible = WORLD.night < 0.6; // songbirds roost after dark
    if (!g.visible) return;
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
    <group ref={ref} scale={0.85}>
      <mesh>
        <sphereGeometry args={[0.05, 12, 9]} />
        <meshStandardMaterial color="#6a5c48" roughness={1} />
      </mesh>
      <mesh position={[0.045, 0.035, 0]}>
        <sphereGeometry args={[0.032, 10, 8]} />
        <meshStandardMaterial color="#5c4c3a" roughness={1} />
      </mesh>
      <mesh position={[-0.07, 0.01, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.02, 0.09, 8]} />
        <meshStandardMaterial color="#5c4c3a" roughness={1} />
      </mesh>
    </group>
  );
}

/**
 * A small flock working a rooftop: circle above the building, glide down to
 * the parapet, sit a while, then burst off in all directions and regroup.
 */
function RoofFlock({ center, roofY, count = 5, phase = 0 }: { center: [number, number]; roofY: number; count?: number; phase?: number }) {
  const birds = useRef<(Group | null)[]>([]);
  const wings = useRef<(Group | null)[][]>([]);
  const st = useRef({
    mode: 'circle' as 'circle' | 'perch' | 'burst',
    until: 6 + phase,
    decision: Math.floor(phase * 3),
  });
  const offsets = useMemo(() => {
    const r = seeded(311 + Math.floor(phase * 100));
    return Array.from({ length: count }, (_, i) => ({
      a: (i / count) * Math.PI * 2,
      r: 2.2 + r() * 1.6,
      h: r() * 1.4,
      slot: (i - count / 2) * 0.7 + (r() - 0.5) * 0.3,
      burst: r() * Math.PI * 2,
      p: r() * Math.PI * 2,
    }));
  }, [count, phase]);
  const pos = useRef(offsets.map((o) => new Vector3(center[0] + Math.cos(o.a) * o.r, roofY + 3, center[1] + Math.sin(o.a) * o.r)));
  const tmpV = useMemo(() => new Vector3(), []);

  const flockRoot = useRef<Group>(null);
  useFrame(({ clock }, dt) => {
    if (flockRoot.current) {
      flockRoot.current.visible = WORLD.night < 0.55; // flocks settle in at dark
      if (!flockRoot.current.visible) return;
    }
    const s = st.current;
    const t = clock.elapsedTime + phase;

    if (t > s.until) {
      s.decision++;
      const r = seeded(577 + Math.floor(phase * 100) + s.decision * 13);
      if (s.mode === 'circle') {
        // mostly keep circling; sometimes settle on the parapet
        if (r() < 0.45) {
          s.mode = 'perch';
          s.until = t + 8 + r() * 8;
        } else {
          s.until = t + 10 + r() * 14;
        }
      } else if (s.mode === 'perch') {
        s.mode = 'burst'; // something spooks them
        s.until = t + 2.2;
      } else {
        s.mode = 'circle';
        s.until = t + 12 + r() * 16;
      }
    }

    offsets.forEach((o, i) => {
      const g = birds.current[i];
      if (!g) return;
      const p = pos.current[i];
      if (s.mode === 'circle') {
        const a = o.a + t * (0.35 + o.h * 0.08);
        tmpV.set(
          center[0] + Math.cos(a) * (o.r + Math.sin(t * 0.3 + o.p) * 0.6),
          roofY + 2.2 + o.h + Math.sin(t * 0.7 + o.p) * 0.5,
          center[1] + Math.sin(a) * (o.r + Math.cos(t * 0.23 + o.p) * 0.5),
        );
        p.lerp(tmpV, Math.min(1, dt * 1.8));
      } else if (s.mode === 'perch') {
        tmpV.set(center[0] + o.slot, roofY + 0.06, center[1] - 1.2);
        p.lerp(tmpV, Math.min(1, dt * 2.2));
      } else {
        // burst — scatter out and up, hard
        tmpV.set(
          center[0] + Math.cos(o.burst) * 9,
          roofY + 5 + o.h * 2,
          center[1] + Math.sin(o.burst) * 9,
        );
        p.lerp(tmpV, Math.min(1, dt * 1.4));
      }
      // face travel direction
      const prev = g.position;
      const dir = tmpV.subVectors(p, prev);
      if (dir.lengthSq() > 0.00001) g.rotation.y = Math.atan2(dir.x, dir.z);
      g.position.copy(p);
      const moving = s.mode !== 'perch';
      const flap = moving ? Math.sin(t * (8 + o.h * 3) + o.p) * 0.75 : Math.sin(t * 2 + o.p) * 0.06;
      const w = wings.current[i];
      if (w) {
        if (w[0]) w[0].rotation.z = flap;
        if (w[1]) w[1].rotation.z = -flap;
      }
    });
  });

  return (
    <group ref={flockRoot}>
      {offsets.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            birds.current[i] = el;
          }}
          scale={1.05}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.035, 0.13, 7, 10]} />
            <meshStandardMaterial color="#1c1a17" roughness={1} />
          </mesh>
          <group
            ref={(el) => {
              (wings.current[i] ??= [])[0] = el;
            }}
            position={[0.02, 0, 0]}
          >
            <mesh position={[0.13, 0, 0]}>
              <planeGeometry args={[0.26, 0.09]} />
              <meshStandardMaterial color="#22201c" roughness={1} side={2} />
            </mesh>
          </group>
          <group
            ref={(el) => {
              (wings.current[i] ??= [])[1] = el;
            }}
            position={[-0.02, 0, 0]}
          >
            <mesh position={[-0.13, 0, 0]}>
              <planeGeometry args={[0.26, 0.09]} />
              <meshStandardMaterial color="#22201c" roughness={1} side={2} />
            </mesh>
          </group>
        </group>
      ))}
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
    g.visible = WORLD.night < 0.55; // crows head to roost at dark
    if (!g.visible) return;
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
    <group ref={ref} scale={1.25}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.035, 0.14, 7, 10]} />
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
    const visible = k > 0.02 && k < 0.98 && WORLD.night < 0.5;
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
      ref.current.visible = WORLD.night < 0.6;
      if (!ref.current.visible) return;
      ref.current.position.set(sag[0], sag[1] + 0.02 + Math.sin(t * 2.2) * 0.004, sag[2]);
      ref.current.rotation.y = Math.sin(t * 0.3) * 0.5;
    }
    if (wing.current) {
      const stretch = (t * 0.05) % 1 < 0.06 ? Math.sin(((t * 0.05) % 1) / 0.06 * Math.PI) : 0;
      wing.current.rotation.z = stretch * 0.9;
    }
  });
  return (
    <group ref={ref} scale={1.0}>
      <mesh rotation={[Math.PI / 2.4, 0, 0]}>
        <capsuleGeometry args={[0.035, 0.11, 7, 10]} />
        <meshStandardMaterial color="#1a1815" roughness={1} />
      </mesh>
      <mesh position={[0, 0.07, 0.05]}>
        <sphereGeometry args={[0.028, 10, 8]} />
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
    g.visible = WORLD.night < 0.6; // pigeons roost too
    if (!g.visible) return;
    const t = clock.elapsedTime * 0.3 + phase;
    const step = Math.floor(t) % 6;
    const p = MathUtils.smoothstep(t % 1, 0, 0.3);
    const x0 = Math.sin(step * 2.1 + phase) * 0.5;
    const x1 = Math.sin((step + 1) * 2.1 + phase) * 0.5;
    g.position.set(base[0] + MathUtils.lerp(x0, x1, p), base[1] + Math.abs(Math.sin(t * 12)) * 0.008 * (p < 1 ? 1 : 0), base[2]);
    g.rotation.y = x1 > x0 ? 0.4 : -2.6;
  });
  return (
    <group ref={ref} scale={0.82}>
      <mesh rotation={[Math.PI / 2.6, 0, 0]}>
        <capsuleGeometry args={[0.045, 0.09, 7, 10]} />
        <meshStandardMaterial color="#6e6d70" roughness={1} />
      </mesh>
      <mesh position={[0, 0.08, 0.055]}>
        <sphereGeometry args={[0.03, 10, 8]} />
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

type BflyMode = 'fly' | 'descend' | 'rest';

function Butterfly({ center, phase, tint }: { center: [number, number, number]; phase: number; tint: string }) {
  const ref = useRef<Group>(null);
  const wingL = useRef<Group>(null);
  const wingR = useRef<Group>(null);
  const st = useRef({
    mode: 'fly' as BflyMode,
    pos: new Vector3(center[0], center[1] + 0.3, center[2]),
    target: new Vector3(center[0] + 0.5, center[1] + 0.4, center[2]),
    until: phase % 3,
    decision: Math.floor(phase * 11),
  });

  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    // butterflies are strictly a daytime sight
    const day = WORLD.dayness;
    g.visible = day > 0.05;
    if (!g.visible) return;

    const s = st.current;
    const t = clock.elapsedTime;
    const step = Math.min(dt, 0.1);

    // a passing fox startles a resting butterfly straight back into the air
    if (s.mode !== 'fly' && s.pos.distanceTo(FOX_POS) < 1.7) {
      s.mode = 'fly';
      s.target.set(center[0], center[1] + 0.7, center[2]);
      s.until = t + 2.5;
    }

    if (s.mode === 'fly') {
      if (t > s.until || s.pos.distanceTo(s.target) < 0.15) {
        s.decision++;
        const r = seeded(4111 + Math.floor(phase * 100) * 41 + s.decision * 13);
        if (r() < 0.28) {
          // pick a blade of grass and drop toward it
          s.mode = 'descend';
          s.target.set(center[0] + (r() - 0.5) * 2.4, 0.07 + r() * 0.1, center[2] + (r() - 0.5) * 1.8);
          s.until = t + 6;
        } else {
          s.target.set(center[0] + (r() - 0.5) * 3.2, center[1] + 0.15 + r() * 0.55, center[2] + (r() - 0.5) * 2.4);
          s.until = t + 1.6 + r() * 2.6;
        }
      }
    } else if (s.mode === 'descend') {
      if (s.pos.distanceTo(s.target) < 0.05 || t > s.until) {
        s.mode = 'rest';
        s.until = t + 2 + (phase % 1) * 5; // sit, wings slowly fanning
      }
    } else if (t > s.until) {
      s.mode = 'fly';
      s.target.set(center[0] + Math.sin(phase + t) * 1.4, center[1] + 0.5, center[2] + Math.cos(phase + t) * 1.2);
      s.until = t + 2 + (phase % 1) * 2;
    }

    // move — flutter hard in the air, settle gently on approach
    const speed = s.mode === 'fly' ? 0.55 : s.mode === 'descend' ? 0.3 : 0;
    if (speed > 0) {
      const dir = scratchV.subVectors(s.target, s.pos);
      const d = dir.length();
      if (d > 0.001) s.pos.addScaledVector(dir.normalize(), Math.min(d, speed * step));
      // erratic flutter offsets while airborne
      if (s.mode === 'fly') {
        s.pos.x += Math.sin(t * 5.1 + phase) * step * 0.18;
        s.pos.y += Math.sin(t * 7.3 + phase * 2) * step * 0.14;
        s.pos.z += Math.cos(t * 4.3 + phase) * step * 0.15;
      }
      g.rotation.y = Math.atan2(s.target.x - s.pos.x, s.target.z - s.pos.z);
    }
    g.position.copy(s.pos);

    // wingbeats: frantic in flight, a slow fan at rest
    const flap =
      s.mode === 'rest'
        ? Math.sin(t * 2.2 + phase) * 0.35 + 0.75 // mostly closed, breathing open
        : Math.sin(t * 16 + phase) * 1.0;
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
    g.visible = WORLD.dayness > 0.05; // dragonflies hunt by daylight
    if (!g.visible) return;
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
        <meshStandardMaterial color="#3a5a3c" roughness={0.6} />
      </mesh>
      {[[-0.05, 0.02], [0.05, 0.02], [-0.05, -0.02], [0.05, -0.02]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.01, z]} rotation={[0, i < 2 ? 0.3 : -0.3, 0]}>
          <planeGeometry args={[0.11, 0.025]} />
          <meshStandardMaterial color="#c9d9c9" transparent opacity={0.45} roughness={0.4} side={2} />
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
    g.visible = WORLD.night < 0.7; // squirrels turn in early
    if (!g.visible) return;
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
      g.position.set(p.x, Math.max(0.005, 0.035 - sink), p.z);
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
    // raccoons work the dusk-to-dawn shift
    g.visible = WORLD.night > 0.15 || WORLD.dusk > 0.25;
    if (!g.visible) return;
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
/*  Fireflies — dusk & night only, gathering near grass and bushes.    */
/* ------------------------------------------------------------------ */

function Fireflies() {
  const COUNT =
    typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 1)
      ? 42
      : 72;
  const ref = useRef<InstancedMesh>(null);
  const flies = useMemo(() => {
    const r = seeded(1379);
    // cluster around the bushes and thick grass, a few roaming the meadow
    const hubs: [number, number][] = [
      [-9.4, -7.4], [11.2, -6.6], [-17, -9], [17.8, -9.8], [2.2, -13.6], [-24, -14], [5.5, -5], [-4.5, -4.6],
    ];
    return Array.from({ length: COUNT }, (_, i) => {
      const hub = hubs[i % hubs.length];
      return {
        x: hub[0] + (r() - 0.5) * 3.4,
        z: hub[1] + (r() - 0.5) * 2.6,
        y: 0.15 + r() * 0.75,
        p1: r() * Math.PI * 2,
        p2: r() * Math.PI * 2,
        f1: 0.3 + r() * 0.5,
        f2: 0.2 + r() * 0.4,
        blink: 0.5 + r() * 1.1,       // pulse frequency
        session: 0.03 + r() * 0.05,   // slow on/off "spawn" cycle
        sPhase: r() * Math.PI * 2,
      };
    });
  }, [COUNT]);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    // the firefly window: they rise at dusk, own the night, vanish by day
    const window_ = Math.max(WORLD.dusk, WORLD.night * 0.95);
    mesh.visible = window_ > 0.03;
    if (!mesh.visible) return;

    const t = clock.elapsedTime;
    flies.forEach((f, i) => {
      // organic drift — three incommensurate periods, never a visible loop
      const x = f.x + Math.sin(t * f.f1 + f.p1) * 0.7 + Math.sin(t * 0.13 + f.p2) * 0.5;
      const y = f.y + Math.sin(t * f.f2 + f.p2) * 0.28 + Math.sin(t * 1.7 + f.p1) * 0.05;
      const z = f.z + Math.cos(t * f.f1 * 0.8 + f.p2) * 0.6;
      // individual appears/disappears on its own slow cycle
      const session = MathUtils.smoothstep(Math.sin(t * f.session + f.sPhase), 0.0, 0.35);
      // soft pulsing glow, biased dark (fireflies flash, they don't strobe)
      const pulse = Math.max(0, Math.sin(t * f.blink + f.p1)) ** 3;
      const glow = session * (0.15 + pulse * 0.85) * window_;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(glow > 0.01 ? 1 : 0.001);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tmpColor.set('#d8f59a').multiplyScalar(glow * 2.2));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <sphereGeometry args={[0.016, 6, 5]} />
      <meshBasicMaterial color="#d8f59a" toneMapped={false} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Owl — a rare nighttime discovery on the rooftops.                  */
/* ------------------------------------------------------------------ */

const OWL_PERCHES: [number, number, number][] = [
  [-13.2, 12.36, -13.9],  // left tower parapet
  [13.2, 14.86, -14.7],   // right tower parapet
  [4, 4.68, -12.6],       // utility pole crossarm
];

type OwlMode = 'hidden' | 'perch' | 'fly';

function Owl() {
  const ref = useRef<Group>(null);
  const head = useRef<Group>(null);
  const wingL = useRef<Group>(null);
  const wingR = useRef<Group>(null);
  const st = useRef({
    mode: 'hidden' as OwlMode,
    until: 12,
    perch: 0,
    from: new Vector3(),
    to: new Vector3(),
    t0: 0,
    dur: 5,
    headYaw: 0,
    nextHead: 0,
  });

  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const s = st.current;
    const t = clock.elapsedTime;
    const night = WORLD.night;

    // strictly nocturnal — daylight sends it away mid-whatever
    if (night < 0.35) {
      g.visible = false;
      s.mode = 'hidden';
      s.until = t + 15;
      return;
    }

    if (s.mode === 'hidden') {
      g.visible = false;
      if (t > s.until) {
        // appear on a random perch — a discovery, not a fixture
        s.perch = Math.floor(Math.random() * OWL_PERCHES.length);
        const p = OWL_PERCHES[s.perch];
        g.position.set(p[0], p[1], p[2]);
        s.mode = 'perch';
        s.until = t + 14 + Math.random() * 22;
        s.nextHead = t + 1;
        g.visible = true;
      }
      return;
    }

    g.visible = true;

    if (s.mode === 'perch') {
      // owl stillness: frozen, then the head snaps to a new bearing
      if (t > s.nextHead) {
        s.headYaw = (Math.random() - 0.5) * 2.4;
        s.nextHead = t + 1.4 + Math.random() * 3.2;
      }
      if (head.current) {
        head.current.rotation.y += (s.headYaw - head.current.rotation.y) * Math.min(1, dt * 10);
      }
      // breathing
      g.scale.setScalar(1 + Math.sin(t * 1.3) * 0.012);
      if (wingL.current) wingL.current.rotation.z = 0.08;
      if (wingR.current) wingR.current.rotation.z = -0.08;

      if (t > s.until) {
        const r = Math.random();
        if (r < 0.45) {
          // glide to a different rooftop
          const next = (s.perch + 1 + Math.floor(Math.random() * (OWL_PERCHES.length - 1))) % OWL_PERCHES.length;
          s.from.copy(g.position);
          const p = OWL_PERCHES[next];
          s.to.set(p[0], p[1], p[2]);
          s.perch = next;
          s.mode = 'fly';
          s.t0 = t;
          s.dur = 4 + s.from.distanceTo(s.to) * 0.12;
        } else {
          // melt back into the darkness for a long while
          s.from.copy(g.position);
          s.to.set(g.position.x * 1.6, g.position.y + 6, -46);
          s.mode = 'fly';
          s.t0 = t;
          s.dur = 5;
          s.until = -1; // flag: vanish at the end of this flight
        }
      }
      return;
    }

    // fly — a silent arcing glide
    const p = Math.min(1, (t - s.t0) / s.dur);
    const ease = p * p * (3 - 2 * p);
    scratchV.lerpVectors(s.from, s.to, ease);
    scratchV.y += Math.sin(p * Math.PI) * 2.2; // arc up between roofs
    const dirX = s.to.x - s.from.x;
    const dirZ = s.to.z - s.from.z;
    g.position.copy(scratchV);
    g.rotation.y = Math.atan2(dirX, dirZ);
    // slow, deep wingbeats with long glides between
    const beat = Math.sin(t * 4.5) * Math.max(0, Math.sin(p * Math.PI * 3)) * 0.9;
    if (wingL.current) wingL.current.rotation.z = 0.15 + beat;
    if (wingR.current) wingR.current.rotation.z = -0.15 - beat;
    if (head.current) head.current.rotation.y *= 0.9;

    if (p >= 1) {
      if (s.until === -1) {
        s.mode = 'hidden';
        s.until = t + 25 + Math.random() * 45; // long absences make sightings special
      } else {
        s.mode = 'perch';
        s.until = t + 12 + Math.random() * 20;
        s.nextHead = t + 0.8;
      }
    }
  });

  return (
    <group ref={ref} visible={false} scale={1.15}>
      {/* body */}
      <mesh position={[0, 0.11, 0]} scale={[0.95, 1.25, 0.9]}>
        <sphereGeometry args={[0.085, 12, 10]} />
        <meshStandardMaterial color="#6b5942" roughness={1} />
      </mesh>
      {/* breast speckle */}
      <mesh position={[0, 0.09, 0.055]} scale={[0.7, 1.0, 0.5]}>
        <sphereGeometry args={[0.06, 10, 8]} />
        <meshStandardMaterial color="#8f7c5f" roughness={1} />
      </mesh>
      <group ref={head} position={[0, 0.24, 0]}>
        <mesh>
          <sphereGeometry args={[0.062, 12, 10]} />
          <meshStandardMaterial color="#75634a" roughness={1} />
        </mesh>
        {/* ear tufts */}
        {[-0.035, 0.035].map((x) => (
          <mesh key={x} position={[x, 0.055, 0]} rotation={[0, 0, x * 6]}>
            <coneGeometry args={[0.014, 0.045, 6]} />
            <meshStandardMaterial color="#5c4c38" roughness={1} />
          </mesh>
        ))}
        {/* facial disc + eyes that catch the monitor glow */}
        <mesh position={[0, 0.005, 0.045]} scale={[1.15, 1, 0.5]}>
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshStandardMaterial color="#9a8666" roughness={1} />
        </mesh>
        {[-0.022, 0.022].map((x) => (
          <mesh key={`oeye${x}`} position={[x, 0.012, 0.062]}>
            <sphereGeometry args={[0.011, 8, 6]} />
            <meshBasicMaterial color="#e8c46a" toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, -0.012, 0.066]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[0.008, 0.022, 5]} />
          <meshStandardMaterial color="#3a2e20" roughness={1} />
        </mesh>
      </group>
      {/* folded wings */}
      <group ref={wingL} position={[0.07, 0.13, -0.01]}>
        <mesh rotation={[0, 0, -0.25]} scale={[0.5, 1.1, 0.8]}>
          <sphereGeometry args={[0.06, 8, 7]} />
          <meshStandardMaterial color="#5c4c38" roughness={1} />
        </mesh>
      </group>
      <group ref={wingR} position={[-0.07, 0.13, -0.01]}>
        <mesh rotation={[0, 0, 0.25]} scale={[0.5, 1.1, 0.8]}>
          <sphereGeometry args={[0.06, 8, 7]} />
          <meshStandardMaterial color="#5c4c38" roughness={1} />
        </mesh>
      </group>
      {/* talons gripping the parapet */}
      {[-0.028, 0.028].map((x) => (
        <mesh key={x} position={[x, 0.015, 0.01]}>
          <cylinderGeometry args={[0.008, 0.006, 0.03, 5]} />
          <meshStandardMaterial color="#3a3226" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Fox den — half-hidden under the far-left brush.                    */
/* ------------------------------------------------------------------ */

function FoxDen() {
  return (
    <group position={[DEN.x, 0, DEN.z]}>
      {/* excavated dirt mound */}
      <mesh position={[0, 0.07, 0.35]} scale={[1.5, 0.5, 1.1]}>
        <sphereGeometry args={[0.55, 10, 8]} />
        <meshStandardMaterial color="#4a3d2b" roughness={1} />
      </mesh>
      {/* the dark entrance tunnel */}
      <mesh position={[0, 0.16, 0.72]} rotation={[0.5, 0, 0]}>
        <circleGeometry args={[0.24, 12]} />
        <meshBasicMaterial color="#070604" />
      </mesh>
      <mesh position={[0, 0.28, 0.55]} rotation={[0.35, 0, 0.1]} scale={[1.25, 0.55, 1]}>
        <torusGeometry args={[0.26, 0.07, 6, 10, Math.PI]} />
        <meshStandardMaterial color="#57462f" roughness={1} />
      </mesh>
      {/* fallen debris concealing it */}
      <mesh position={[-0.55, 0.14, 0.3]} rotation={[0.1, 0.7, 0.05]}>
        <cylinderGeometry args={[0.05, 0.07, 1.3, 6]} />
        <meshStandardMaterial color="#4a3b28" roughness={1} />
      </mesh>
      <mesh position={[0.5, 0.1, 0.55]} rotation={[0.2, -0.4, 0.6]}>
        <cylinderGeometry args={[0.035, 0.05, 0.8, 5]} />
        <meshStandardMaterial color="#3f3222" roughness={1} />
      </mesh>
      {/* scratched-out earth in front */}
      <mesh position={[0, 0.015, 0.95]} rotation={[-Math.PI / 2, 0, 0.4]}>
        <circleGeometry args={[0.5, 10]} />
        <meshStandardMaterial color="#57503a" roughness={1} />
      </mesh>
      {/* a few scattered bones from past hunts — subtle storytelling */}
      {[[0.28, 1.05, 0.9], [-0.2, 1.15, 2.2]].map(([x, z, ry], i) => (
        <mesh key={i} position={[x, 0.03, z]} rotation={[0, ry, 0]}>
          <capsuleGeometry args={[0.012, 0.09, 4, 6]} />
          <meshStandardMaterial color="#c9bda5" roughness={1} />
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
      {/* herd grazing beside the old road — the buck leads them to water */}
      <Deer position={[-9.5, 0, -8.5]} facing={0.5} phase={0} buck lead />
      <Deer position={[-11.5, 0, -10]} facing={-0.4} phase={3.2} />
      <Deer position={[-8, 0, -11]} facing={1.1} phase={6.1} />
      <Deer position={[-13, 0, -8]} facing={0.2} phase={9.4} />
      <Deer position={[-6.5, 0, -9.6]} facing={-0.8} phase={12.7} />

      {/* rabbits working the meadow */}
      <Rabbit idx={0} home={[5.5, 0, -5]} radius={2.2} phase={0} />
      <Rabbit idx={1} home={[9.5, 0, -6.5]} radius={1.8} phase={2.4} />
      <Rabbit idx={2} home={[-4.5, 0, -4.6]} radius={2.0} phase={5.1} />
      <Rabbit idx={3} home={[1.5, 0, -6.8]} radius={1.6} phase={7.7} />
      <Rabbit idx={4} home={[12.5, 0, -8]} radius={2.0} phase={10.3} />

      {/* fox on patrol — occasionally goes hunting */}
      <Fox />

      {/* birds on the broken streetlights & scaffold */}
      <PerchedBird perch={[-5.68, 3.72, -8]} phase={0} flies />
      <PerchedBird perch={[-6.45, 3.5, -8]} phase={4} />
      <PerchedBird perch={[8.32, 3.68, -10]} phase={7} flies />
      <PerchedBird perch={[2.7, 4.62, -4.4]} phase={11} />

      {/* flocks circling the ruined towers, landing and spooking off */}
      <RoofFlock center={[-13.5, -16]} roofY={12.3} count={5} phase={0} />
      <RoofFlock center={[13, -17]} roofY={14.8} count={4} phase={7.3} />

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

      {/* small fliers over the tall grass */}
      <Butterfly center={[4.5, 0.2, -3.6]} phase={0} tint="#d9c987" />
      <Butterfly center={[-6, 0.2, -5]} phase={2.1} tint="#d9e8dd" />
      <Butterfly center={[8, 0.25, -6]} phase={4.4} tint="#c9a98a" />
      <Butterfly center={[-9.5, 0.2, -6.5]} phase={6.8} tint="#e8d56a" />
      <Butterfly center={[1.5, 0.2, -6.2]} phase={9.2} tint="#d9c987" />
      <Dragonfly center={[3, 0.4, -4.8]} phase={0.3} />
      <Dragonfly center={[-4, 0.5, -6.4]} phase={1.9} />

      {/* squirrel working the rusted car + tree */}
      <Squirrel />

      {/* ground-level wanderers */}
      <Snake />
      <Raccoon />

      {/* the hidden den the fox retreats to at midday */}
      <FoxDen />

      {/* dusk & night life */}
      <Fireflies />
      <Owl />
    </group>
  );
}
