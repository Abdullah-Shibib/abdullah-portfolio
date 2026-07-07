'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload, Sky } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';

import CameraRig from './CameraRig';
import Room, { SUN } from './Room';
import Wildlife from './Wildlife';
import MonitorWall from './MonitorWall';

export default function Experience() {
  return (
    <Canvas
      className="!fixed inset-0"
      dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 2, 2)]}
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
        {/* slight DOF keeps the rig crisp while the ruins soften with distance */}
        <DepthOfField focusDistance={0.05} focalLength={0.022} bokehScale={1.2} />
        <Bloom intensity={0.22} luminanceThreshold={0.85} luminanceSmoothing={0.75} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.62} />
      </EffectComposer>
    </Canvas>
  );
}
