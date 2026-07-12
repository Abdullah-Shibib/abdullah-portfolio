'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import HUD from '@/components/HUD';
import { useViewport, watchViewport } from '@/lib/viewport';

/* The whole Three.js bundle is code-split out of the first paint. */
const Experience = dynamic(() => import('@/components/Experience'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-void">
      <div className="text-center">
        <p className="font-display text-sm tracking-[0.5em] text-teal-300/70">
          INITIALIZING
        </p>
        <p className="mt-3 font-display text-2xl neon-text">COMMAND CENTER</p>
        <div className="mx-auto mt-6 h-px w-48 overflow-hidden bg-teal-900">
          <div className="h-full w-1/3 animate-pulse bg-teal-400" />
        </div>
      </div>
    </div>
  ),
});

export default function Page() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  /* Keep the pan-x world centered in portrait; pin it home in landscape.
     Driven by the settled viewport store, so it runs once per rotation
     with the browser's FINAL dimensions — not the mid-rotation ones. */
  useEffect(() => {
    watchViewport();
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const center = () => {
      const { portrait, mobile } = useViewport.getState();
      if (portrait && mobile) {
        scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
      } else {
        scroller.scrollLeft = 0;
      }
    };

    const id = window.setTimeout(center, 80);
    const unsub = useViewport.subscribe((s, prev) => {
      if (s.generation !== prev.generation || s.width !== prev.width) center();
    });
    return () => {
      window.clearTimeout(id);
      unsub();
    };
  }, []);

  /* Kill browser gestures that fight the experience: iOS pinch zoom
     (gesturestart is Safari-only and ignores user-scalable=no) and
     rubber-band overscroll while panning the world. */
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', prevent);
    document.addEventListener('gesturechange', prevent);
    return () => {
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('gesturechange', prevent);
    };
  }, []);

  return (
    <main className="atmosphere fixed inset-0">
      <div ref={scrollerRef} className="scene-scroll">
        <div className="scene-stage">
          <Experience />
        </div>
      </div>
      <HUD />
    </main>
  );
}
