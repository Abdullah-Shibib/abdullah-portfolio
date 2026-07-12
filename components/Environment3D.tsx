'use client';

import { useMemo, useRef } from 'react';
import { AdditiveBlending, Fog, Points, Sprite } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { seeded } from '@/lib/data';
import { moonDisc } from '@/lib/textures';
import { advanceWorld, WORLD } from '@/lib/world';

/* ------------------------------------------------------------------ */
/*  Environment3D — advances the world clock and renders everything    */
/*  celestial: dynamic sky, stars, moon, distant lightning. Also owns  */
/*  the scene fog and tone-mapping exposure so day/night transitions   */
/*  stay perfectly in sync with the light rig in Room.                 */
/* ------------------------------------------------------------------ */

function StarField() {
  const ref = useRef<Points>(null);
  const { positions, twinkle } = useMemo(() => {
    const r = seeded(19);
    const n = 900;
    const pos = new Float32Array(n * 3);
    const tw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // upper dome, biased away from straight overhead so stars sit
      // above the skyline where the camera actually looks
      const az = r() * Math.PI * 2;
      const el = 0.06 + r() * r() * 1.35; // radians above horizon
      const R = 120;
      pos[i * 3] = Math.cos(el) * Math.sin(az) * R;
      pos[i * 3 + 1] = Math.sin(el) * R;
      pos[i * 3 + 2] = Math.cos(el) * Math.cos(az) * R;
      tw[i] = r();
    }
    return { positions: pos, twinkle: tw };
  }, []);

  useFrame(({ clock }) => {
    const pts = ref.current;
    if (!pts) return;
    const m = pts.material as any;
    // subtle global twinkle ride on top of the night fade
    m.opacity = WORLD.starOpacity * (0.75 + Math.sin(clock.elapsedTime * 0.8) * 0.08);
    pts.visible = WORLD.starOpacity > 0.02;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.5}
        color="#dfe6f2"
        transparent
        opacity={0}
        sizeAttenuation
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function Moon() {
  const spriteRef = useRef<Sprite>(null);
  const lightRef = useRef<any>(null);
  const tex = useMemo(() => moonDisc(), []);

  useFrame(() => {
    const s = spriteRef.current;
    const vis = WORLD.night * (1 - WORLD.cloud * 0.75);
    if (s) {
      s.position.copy(WORLD.moonPos);
      (s.material as any).opacity = vis;
      s.visible = vis > 0.02;
    }
    const l = lightRef.current;
    if (l) {
      l.position.copy(WORLD.moonPos);
      l.intensity = WORLD.moonIntensity;
    }
  });

  return (
    <group>
      <sprite ref={spriteRef} scale={[7, 7, 1]}>
        <spriteMaterial map={tex} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </sprite>
      {/* cool moonlight — takes over when the sun dies */}
      <directionalLight ref={lightRef} intensity={0} color="#a9bedd" />
    </group>
  );
}

/** Far-off strikes behind the skyline — a flash, not a storm overhead. */
function DistantLightning() {
  const glow = useRef<any>(null);
  const wash = useRef<any>(null);

  useFrame(() => {
    const f = WORLD.lightning;
    if (glow.current) {
      glow.current.position.set(WORLD.lightningX, 10, -52);
      glow.current.intensity = f * 90;
      glow.current.visible = f > 0.005;
    }
    if (wash.current) {
      wash.current.position.set(WORLD.lightningX, 26, -60);
      wash.current.intensity = f * 1.6;
      wash.current.visible = f > 0.005;
    }
  });

  return (
    <group>
      {/* the strike core lighting nearby clouds & towers */}
      <pointLight ref={glow} intensity={0} distance={70} decay={1.6} color="#dbe4ff" />
      {/* broad directional wash so the whole skyline blinks toward it */}
      <directionalLight ref={wash} intensity={0} color="#c7d3f5" />
    </group>
  );
}

export default function Environment3D() {
  const skyRef = useRef<any>(null);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);

  /* Priority -2: the world clock ticks BEFORE the camera rig (-1) and
     before every other useFrame that samples WORLD this frame. */
  useFrame(({ clock }, dt) => {
    advanceWorld(dt, clock.elapsedTime);

    // sky shader tracks the sun + weather haze
    const sky = skyRef.current;
    if (sky?.material?.uniforms) {
      const u = sky.material.uniforms;
      u.sunPosition.value.copy(WORLD.sunPos);
      u.turbidity.value = WORLD.turbidity;
      u.rayleigh.value = 0.25 + WORLD.dayness * 3.5 + WORLD.golden * 0.6;
      u.mieCoefficient.value = 0.005 + WORLD.golden * 0.006 + WORLD.cloud * 0.008;
      u.mieDirectionalG.value = 0.85;
    }

    // fog + exposure ride the same clock
    const fog = scene.fog as Fog | null;
    if (fog) {
      fog.color.copy(WORLD.fogColor);
      fog.near = WORLD.fogNear;
      fog.far = WORLD.fogFar;
    }
    gl.toneMappingExposure = WORLD.exposure + WORLD.lightning * 0.05;
  }, -2);

  return (
    <group>
      <Sky
        ref={skyRef}
        distance={4000}
        sunPosition={[16, 6, -34]}
        turbidity={10}
        rayleigh={3.8}
        mieCoefficient={0.006}
        mieDirectionalG={0.85}
      />
      <StarField />
      <Moon />
      <DistantLightning />
    </group>
  );
}
