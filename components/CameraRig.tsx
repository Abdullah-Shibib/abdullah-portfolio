'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { DEFAULT_CAMERA, monitorById, monitorCamera } from '@/lib/data';
import { BUNKER_CAMERA, DESCENT, FLOOR_Y, HATCH_POS } from '@/lib/bunker';
import { useCommandCenter } from '@/lib/store';
import { useViewport } from '@/lib/viewport';

/** Room view compensation for narrow (portrait) viewports: pull back so the
 *  whole monitor wall still fits in frame. */
function roomCamera(aspect: number) {
  const widen = Math.min(1.85, Math.max(1, 1.12 / Math.max(aspect, 0.55)));
  return {
    position: new Vector3(
      DEFAULT_CAMERA.position.x,
      DEFAULT_CAMERA.position.y + (widen - 1) * 0.25,
      DEFAULT_CAMERA.position.z + (widen - 1) * 3.6,
    ),
    target: DEFAULT_CAMERA.target.clone(),
  };
}

/** Canvas aspect, published only after resizing goes quiet — so an
 *  orientation flip triggers ONE clean reframe instead of a flight
 *  restarted on every intermediate size the browser reports. */
function useSettledAspect() {
  const size = useThree((s) => s.size);
  const [aspect, setAspect] = useState(() => size.width / Math.max(1, size.height));
  useEffect(() => {
    const next = size.width / Math.max(1, size.height);
    const id = setTimeout(() => {
      setAspect((a) => (Math.abs(a - next) > 0.002 ? next : a));
    }, 120);
    return () => clearTimeout(id);
  }, [size]);
  return aspect;
}

/**
 * Cinematic camera: GSAP flights between the room view and each monitor,
 * with idle breathing and gentle mouse parallax layered on top.
 */
export default function CameraRig() {
  const camera = useThree((s) => s.camera);
  const focused = useCommandCenter((s) => s.focused);
  const booted = useCommandCenter((s) => s.booted);
  const location = useCommandCenter((s) => s.location);
  const { setTransitioning, setPanelOpen } = useCommandCenter.getState();
  const aspect = useSettledAspect();
  const mobile = useViewport((s) => s.mobile);

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
  const touch = useRef(false);

  /* Slow entry dolly once the boot screen clears. */
  useEffect(() => {
    if (!booted) return;
    const room = roomCamera(aspect);
    if (window.location.search.includes('fast')) {
      base.pos.copy(room.position);
      return;
    }
    gsap.killTweensOf(base.pos);
    gsap.to(base.pos, {
      x: room.position.x,
      y: room.position.y,
      z: room.position.z,
      duration: mobile ? 0.9 : 2.6,
      ease: 'sine.inOut',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, base, mobile]);

  /* Ride the hatch shaft between the surface and the shelter.
     A multi-leg GSAP timeline walks the camera through the shaft
     waypoints — no cuts, no loading, the world stays live throughout. */
  // starts at 'surface' regardless of store state, so a dev-flag load
  // straight into the bunker still plays the descent (and clears traveling)
  const prevLocation = useRef<'surface' | 'bunker'>('surface');
  useEffect(() => {
    const from = prevLocation.current;
    if (location === from) return;
    prevLocation.current = location;
    const down = location === 'bunker';
    const { setTraveling } = useCommandCenter.getState();

    setTransitioning(true);
    gsap.killTweensOf([base.pos, base.target, base]);
    const tl = gsap.timeline({
      onComplete: () => {
        setTraveling(false);
        setTransitioning(false);
      },
    });

    const room = roomCamera(aspect);
    const legs = down
      ? DESCENT
      : [
          // climbing: face up the ladder, rise through the shaft, step out
          { pos: [HATCH_POS[0], FLOOR_Y + 1.5, HATCH_POS[2] + 0.6], tgt: [HATCH_POS[0], FLOOR_Y + 2.7, HATCH_POS[2]], dur: 0.95 },
          { pos: [HATCH_POS[0], -2.8, HATCH_POS[2]], tgt: [HATCH_POS[0], -0.4, HATCH_POS[2]], dur: 1.0 },
          { pos: [HATCH_POS[0], 0.7, HATCH_POS[2] + 0.25], tgt: [HATCH_POS[0], 2.0, HATCH_POS[2] + 1.4], dur: 0.85 },
          { pos: [room.position.x, room.position.y, room.position.z], tgt: [room.target.x, room.target.y, room.target.z], dur: 1.35 },
        ];

    // one continuous spline through the waypoints instead of leg-by-leg
    // tweens — no velocity kinks, a single long ease across the whole ride
    const posCurve = new CatmullRomCurve3(
      [base.pos.clone(), ...legs.map((l) => new Vector3(l.pos[0], l.pos[1], l.pos[2]))],
      false,
      'centripetal',
    );
    const tgtCurve = new CatmullRomCurve3(
      [base.target.clone(), ...legs.map((l) => new Vector3(l.tgt[0], l.tgt[1], l.tgt[2]))],
      false,
      'centripetal',
    );
    const ride = { t: 0 };
    const dur = down ? 5.4 : 4.8;
    // descending, the hatch gets a beat to swing open before the camera commits
    const delay = down ? 0.9 : 0.15;
    tl.to(
      ride,
      {
        t: 1,
        duration: dur,
        ease: 'sine.inOut',
        onUpdate: () => {
          posCurve.getPointAt(ride.t, base.pos);
          tgtCurve.getPointAt(ride.t, base.target);
        },
      },
      delay,
    );
    // parallax: tight in the shaft, generous once parked (looking around a room)
    tl.to(base, { parallax: 0.25, duration: 0.8, ease: 'sine.inOut' }, 0);
    tl.to(base, { parallax: down ? 0.85 : 1, duration: 1.2, ease: 'sine.inOut' }, delay + dur - 1.2);

    return () => {
      // StrictMode kills the first run mid-flight — revert so the
      // re-run sees the location change and restarts the ride
      if (tl.progress() < 1) prevLocation.current = from;
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  /* Fly to the focused monitor / back to the room.
     Re-runs when the SETTLED aspect changes, so an orientation flip
     reframes exactly once — preserving focus state, never resetting it. */
  useEffect(() => {
    if (!booted) return;
    // the travel timeline owns the camera while riding the shaft
    const s = useCommandCenter.getState();
    if (s.traveling) return;
    // unfocusing parks at whichever level the visitor is on
    const parked = s.location === 'bunker'
      ? { position: BUNKER_CAMERA.position.clone(), target: BUNKER_CAMERA.target.clone() }
      : roomCamera(aspect);
    const dest = focused ? monitorCamera(monitorById(focused), aspect) : parked;

    setTransitioning(true);
    const instant = window.location.search.includes('fast'); // dev flag: skip cinematics
    if (focused && mobile) setPanelOpen(true);
    const duration = instant ? 0.05 : mobile ? (focused ? 0.34 : 0.5) : 1.15;
    gsap.killTweensOf([base.pos, base.target, base]);
    const tl = gsap.timeline({
      defaults: { duration, ease: 'sine.inOut', overwrite: true },
      onComplete: () => {
        setTransitioning(false);
        if (focused && !mobile) setPanelOpen(true);
      },
    });
    tl.to(base.pos, { x: dest.position.x, y: dest.position.y, z: dest.position.z }, 0);
    tl.to(base.target, { x: dest.target.x, y: dest.target.y, z: dest.target.z }, 0);
    tl.to(base, { parallax: focused ? 0.16 : 1 }, 0);
    return () => {
      tl.kill();
    };
  }, [focused, base, aspect, booted, mobile, setTransitioning, setPanelOpen]);

  /* Mouse parallax source — skipped for touch pointers so phones don't
     lurch on every tap. */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        touch.current = true;
        return;
      }
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
