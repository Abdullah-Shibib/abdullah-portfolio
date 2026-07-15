'use client';

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Preload } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';

import CameraRig from './CameraRig';
import Environment3D from './Environment3D';
import Room from './Room';
import Wildlife from './Wildlife';
import MonitorWall from './MonitorWall';
import Bunker from './Bunker';
import { useCommandCenter } from '@/lib/store';

// re-exported for existing importers; lives in lib/touch to avoid import cycles
import { IS_TOUCH } from '@/lib/touch';
export { IS_TOUCH };

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
    return IS_TOUCH ? [1, 1] : [1, Math.min(max, 2)];
  }, []);

  return (
    <Canvas
      className="!absolute inset-0 h-full w-full"
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 2.25, 7.4], fov: 45, near: 0.1, far: 160 }}
      shadows={false}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 0.76;
      }}
    >
      {/* atmospheric haze — color & depth driven per-frame by lib/world */}
      <fog attach="fog" args={['#b3ac9a', 22, 80]} />

      <Suspense fallback={null}>
        {/* dynamic sky, stars, moon, weather & distant lightning */}
        <Environment3D />
        <Room />
        <Wildlife />
        <MonitorWall />
        <Bunker />
        <Preload all />
      </Suspense>

      <CameraRig />

      {!IS_TOUCH && (
        <EffectComposer multisampling={0}>
          <FocusDOF />
          <Bloom intensity={0.22} luminanceThreshold={0.85} luminanceSmoothing={0.75} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.62} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
