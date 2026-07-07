'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MONITORS, monitorById } from '@/lib/data';
import { useCommandCenter } from '@/lib/store';
import { SCREENS } from './screens';

/* ------------------------------------------------------------------ */
/*  Boot sequence.                                                     */
/* ------------------------------------------------------------------ */

const BOOT_LINES = [
  'SOLAR ARRAY ........... 84% CHARGE',
  'SCAVENGED UPLINK ...... WEAK / STABLE',
  'DECRYPTING WORKSPACE .. OK',
  'MONITOR ARRAY ......... 7/7 ONLINE',
  'ACCESS GRANTED',
];

function BootScreen() {
  const setBooted = useCommandCenter((s) => s.setBooted);
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (line < BOOT_LINES.length) {
      const t = setTimeout(() => setLine(line + 1), line === BOOT_LINES.length - 1 ? 700 : 380);
      return () => clearTimeout(t);
    }
    const t = setTimeout(setBooted, 400);
    return () => clearTimeout(t);
  }, [line, setBooted]);

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center bg-void"
      exit={{ opacity: 0, transition: { duration: 1.2 } }}
    >
      <div className="w-80">
        <p className="font-display text-xs tracking-[0.5em] text-teal-300/60">ABDULLAH SHIBIB</p>
        <p className="neon-text mt-2 font-display text-2xl tracking-widest">COMMAND CENTER</p>
        <div className="mt-6 space-y-1.5 font-mono text-[11px] text-teal-300/80">
          {BOOT_LINES.slice(0, line).map((l, i) => (
            <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="text-teal-500/50">{'> '}</span>
              {l === 'ACCESS GRANTED' ? <span className="text-teal-300">{l}</span> : l}
            </motion.p>
          ))}
        </div>
        <div className="mt-6 h-px w-full overflow-hidden bg-teal-900/60">
          <motion.div
            className="h-full bg-teal-400"
            initial={{ width: '0%' }}
            animate={{ width: `${(line / BOOT_LINES.length) * 100}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Expanded monitor panel.                                            */
/* ------------------------------------------------------------------ */

function FocusPanel() {
  const focused = useCommandCenter((s) => s.focused);
  const panelOpen = useCommandCenter((s) => s.panelOpen);
  const focus = useCommandCenter((s) => s.focus);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return focus(null);
      const el = scrollRef.current;
      if (!el) return;
      const page = el.clientHeight * 0.85;
      const jumps: Record<string, number> = {
        ArrowDown: 80, ArrowUp: -80, PageDown: page, PageUp: -page,
      };
      if (e.key in jumps) {
        e.preventDefault();
        el.scrollBy({ top: jumps[e.key], behavior: 'smooth' });
      } else if (e.key === 'Home') {
        e.preventDefault();
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === 'End') {
        e.preventDefault();
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

  const def = focused ? monitorById(focused) : null;
  const Screen = focused ? SCREENS[focused] : null;

  return (
    <AnimatePresence>
      {def && Screen && panelOpen && (
        <motion.div
          key={def.id}
          className="fixed inset-0 z-50 grid place-items-center p-4 md:p-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          {/* dimmer — heavier for reading contrast */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => focus(null)} />

          <motion.div
            className="relative flex h-full max-h-[860px] w-full max-w-6xl flex-col"
            initial={{ scale: 0.9, y: 24 }}
            animate={{ scale: 1, y: 0, transition: { type: 'spring', stiffness: 150, damping: 20 } }}
            exit={{ scale: 0.94, y: 12 }}
          >
            <div className="mb-4 flex items-end justify-between px-1">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.4em] text-teal-400/80 md:text-sm">
                  {def.subtitle}
                </p>
                <h2 className="neon-text mt-1 font-display text-2xl tracking-[0.2em] md:text-4xl">
                  {def.title}
                </h2>
              </div>
              <button
                onClick={() => focus(null)}
                className="hud-chip !px-5 !py-2.5 !text-sm"
                aria-label="Return to the camp"
              >
                ✕ &nbsp;ESC
              </button>
            </div>

            <div ref={scrollRef} className="panel-scroll relative min-h-0 flex-1 overflow-y-auto scroll-smooth rounded-xl bg-[#0a100d] shadow-neon ring-1 ring-teal-200/20">
              {/* CRT power-on: line burst + flicker, then the UI fades in */}
              <motion.div
                className="pointer-events-none absolute inset-0 z-10 grid place-items-center overflow-hidden rounded-xl bg-black"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0, transitionEnd: { display: 'none' } }}
                transition={{ delay: 0.5, duration: 0.12 }}
              >
                <motion.div
                  className="h-[2px] w-full bg-teal-100"
                  style={{ boxShadow: '0 0 24px 4px rgba(150,230,212,0.9)' }}
                  initial={{ scaleX: 0.02, scaleY: 1, opacity: 0 }}
                  animate={{
                    scaleX: [0.02, 1, 1, 1],
                    scaleY: [1, 1, 70, 150],
                    opacity: [0, 1, 0.55, 0],
                  }}
                  transition={{ duration: 0.5, times: [0, 0.35, 0.75, 1] }}
                />
              </motion.div>

              <motion.div
                className="min-h-[420px] leading-relaxed"
                style={{ zoom: 1.55 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.42, duration: 0.3 }}
              >
                {/* zoom scales every screen's type & UI up for comfortable reading */}
                <Screen expanded />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  HUD chrome.                                                        */
/* ------------------------------------------------------------------ */

export default function HUD() {
  const { focused, focus, hint, booted, transitioning } = useCommandCenter();
  const [clock, setClock] = useState('--:--:--');

  // hidden dev flags: /?fast=1 skips the boot sequence, &focus=<id> jumps to a monitor
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('fast')) useCommandCenter.getState().setBooted();
    const target = params.get('focus');
    if (target && MONITORS.some((m) => m.id === target)) {
      useCommandCenter.getState().focus(target as (typeof MONITORS)[number]['id']);
    }
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <AnimatePresence>{!booted && <BootScreen />}</AnimatePresence>

      {/* top bar */}
      <motion.header
        className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between p-5"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: booted ? 1 : 0, y: booted ? 0 : -12 }}
        transition={{ delay: 0.6, duration: 0.8 }}
      >
        <div>
          <p className="font-display text-sm font-bold tracking-[0.35em] text-slate-100">
            ABDULLAH SHIBIB
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-[0.25em] text-teal-300/70">
            DATA ENGINEER · SOFTWARE ENGINEER · AI DEVELOPER
          </p>
        </div>
        <div className="hidden text-right font-mono text-[10px] leading-relaxed text-teal-300/60 md:block">
          <p>
            SYS <span className="text-teal-300">NOMINAL</span> · {clock}
          </p>
          <p>
            SECTOR: <span className="text-teal-200">{focused ? monitorById(focused).label.toUpperCase() : 'OVERVIEW'}</span>
          </p>
        </div>
      </motion.header>

      {/* bottom nav */}
      <motion.nav
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 p-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: booted ? 1 : 0, y: booted ? 0 : 12 }}
        transition={{ delay: 0.9, duration: 0.8 }}
      >
        <AnimatePresence>
          {hint && !focused && (
            <motion.p
              className="font-mono text-[11px] text-teal-200/80"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {hint}
            </motion.p>
          )}
          {!hint && !focused && booted && (
            <motion.p
              className="font-mono text-[11px] text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Click a monitor to jack in
            </motion.p>
          )}
        </AnimatePresence>

        <div className="pointer-events-auto flex max-w-full flex-wrap justify-center gap-2">
          {MONITORS.map((m) => (
            <button
              key={m.id}
              className="hud-chip"
              data-active={focused === m.id}
              disabled={transitioning}
              onClick={() => focus(focused === m.id ? null : m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </motion.nav>

      <FocusPanel />
    </>
  );
}
