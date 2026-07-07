'use client';

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Preload, Sky } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';

import CameraRig from './CameraRig';
import Room, { SUN } from './Room';
import Wildlife from './Wildlife';
import MonitorWall from './MonitorWall';
import { useCommandCenter } from '@/lib/store';

/** Coarse-pointer (phone/tablet) detection — client-only bundle, safe to read. */
export const IS_TOUCH =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 1);

/** DOF that eases deeper while a monitor is focused, softening the room. */
function FocusDOF() {
  const ref = useRef<any>(null);
  const focused = useCommandCenter((s) => s.focused);
  useFrame((_, dt) => {
    const e = ref.current;
    if (!e) return;
    const k = Math.min(1, dt * 2.5);
    const want = focused ? 3.4 : 1.2;
    e.bokehScale += (want - e.bokehScale) * k;
    const m = e.circleOfConfusionMaterial;
    if (m) {
      m.focusDistance += ((focused ? 0.03 : 0.05) - m.focusDistance) * k;
      m.focalLength += ((focused ? 0.014 : 0.022) - m.focalLength) * k;
    }
  });
  return <DepthOfField ref={ref} focusDistance={0.05} focalLength={0.022} bokehScale={1.2} />;
}

export default function Experience() {
  // phones: lower pixel budget, same scene — the effects hide the difference
  const dpr = useMemo<[number, number]>(() => {
    const max = typeof window === 'undefined' ? 2 : window.devicePixelRatio;
    return [1, Math.min(max, IS_TOUCH ? 1.5 : 2)];
  }, []);

  return (
    <Canvas
      className="!fixed inset-0"
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 2.25, 7.4], fov: 45, near: 0.1, far: 160 }}
      shadows={false}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 0.76;
      }}
    >
      {/* warm haze — atmospheric perspective over the ruins */}
      <fog attach="fog" args={['#b3ac9a', 22, 80]} />

      <Suspense fallback={null}>
        {/* golden-hour sky, sun low behind the skyline */}
        <Sky
          distance={4000}
          sunPosition={[SUN[0], SUN[1], SUN[2]]}
          turbidity={10}
          rayleigh={3.8}
          mieCoefficient={0.006}
          mieDirectionalG={0.85}
        />
        <Room />
        <Wildlife />
        <MonitorWall />
        <Preload all />
      </Suspense>

      <CameraRig />

      <EffectComposer multisampling={0}>
        <FocusDOF />
        <Bloom intensity={0.22} luminanceThreshold={0.85} luminanceSmoothing={0.75} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.62} />
      </EffectComposer>
    </Canvas>
  );
}
