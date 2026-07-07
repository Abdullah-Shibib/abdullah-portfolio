'use client';

import dynamic from 'next/dynamic';
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
  return (
    <main className="atmosphere fixed inset-0">
      <Experience />
      <HUD />
    </main>
  );
}
