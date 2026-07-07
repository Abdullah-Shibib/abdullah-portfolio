'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import HUD from '@/components/HUD';

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

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const centerPortraitView = () => {
      const portrait = window.innerHeight > window.innerWidth;
      const mobileWidthOrTouch = window.innerWidth < 700 || window.matchMedia?.('(pointer: coarse)').matches;
      const portraitTouch = portrait && mobileWidthOrTouch;
      if (!portraitTouch) {
        scroller.scrollLeft = 0;
        return;
      }
      scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
    };

    const id = window.setTimeout(centerPortraitView, 80);
    window.addEventListener('orientationchange', centerPortraitView);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('orientationchange', centerPortraitView);
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
