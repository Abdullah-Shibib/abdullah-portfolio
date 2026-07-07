'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { DEFAULT_CAMERA, monitorById, monitorCamera } from '@/lib/data';
import { useCommandCenter } from '@/lib/store';

/**
 * Cinematic camera: GSAP flights between the room view and each monitor,
 * with idle breathing and gentle mouse parallax layered on top.
 */
export default function CameraRig() {
  const camera = useThree((s) => s.camera);
  const focused = useCommandCenter((s) => s.focused);
  const booted = useCommandCenter((s) => s.booted);
  const { setTransitioning, setPanelOpen } = useCommandCenter.getState();

  // GSAP animates these; useFrame composes them with breathing + parallax.
  const base = useMemo(
    () => ({
      pos: DEFAULT_CAMERA.position.clone().add(new Vector3(0, 0.35, 3.5)), // pre-boot dolly start
      target: DEFAULT_CAMERA.target.clone(),
      /** parallax weight — reduced when zoomed into a monitor */
      parallax: 1,
    }),
    [],
  );
  const mouse = useRef({ x: 0, y: 0 });
  const look = useMemo(() => new Vector3(), []);

  /* Slow entry dolly once the boot screen clears. */
  useEffect(() => {
    if (!booted) return;
    if (window.location.search.includes('fast')) {
      base.pos.copy(DEFAULT_CAMERA.position);
      return;
    }
    gsap.to(base.pos, {
      x: DEFAULT_CAMERA.position.x,
      y: DEFAULT_CAMERA.position.y,
      z: DEFAULT_CAMERA.position.z,
      duration: 3.2,
      ease: 'power2.inOut',
    });
  }, [booted, base]);

  /* Fly to the focused monitor / back to the room. */
  useEffect(() => {
    const dest = focused
      ? monitorCamera(monitorById(focused))
      : { position: DEFAULT_CAMERA.position, target: DEFAULT_CAMERA.target };

    setTransitioning(true);
    const instant = window.location.search.includes('fast'); // dev flag: skip cinematics
    const tl = gsap.timeline({
      defaults: { duration: instant ? 0.05 : 1.5, ease: 'power3.inOut' },
      onComplete: () => {
        setTransitioning(false);
        if (focused) setPanelOpen(true);
      },
    });
    tl.to(base.pos, { x: dest.position.x, y: dest.position.y, z: dest.position.z }, 0);
    tl.to(base.target, { x: dest.target.x, y: dest.target.y, z: dest.target.z }, 0);
    tl.to(base, { parallax: focused ? 0.16 : 1 }, 0);
    return () => {
      tl.kill();
    };
  }, [focused, base, setTransitioning, setPanelOpen]);

  /* Mouse parallax source. */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  /* Priority -1: update the camera BEFORE drei's <Html transform> computes
     its CSS matrices, so DOM screens never lag a frame behind the WebGL. */
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = base.parallax;

    // idle breathing + parallax composed over the GSAP base pose
    camera.position.set(
      base.pos.x + mouse.current.x * 0.32 * p + Math.sin(t * 0.32) * 0.05 * p,
      base.pos.y - mouse.current.y * 0.2 * p + Math.sin(t * 0.55) * 0.035 * p,
      base.pos.z,
    );
    look.set(
      base.target.x + mouse.current.x * 0.14 * p,
      base.target.y - mouse.current.y * 0.1 * p,
      base.target.z,
    );
    camera.lookAt(look);
    // refresh matrixWorldInverse now so <Html transform> screens (priority 0)
    // project with this frame's camera, not last frame's
    camera.updateMatrixWorld();
  }, -1);

  return null;
}
