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
      className="fixed inset-0 z-[60] grid place-items-center bg-void px-6"
      exit={{ opacity: 0, transition: { duration: 1.2 } }}
    >
      <div className="w-80 max-w-full">
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

/** Reading zoom for the expanded screen — scales down with the viewport so
 *  phones get a native-feeling panel instead of a cropped desktop one. */
function usePanelZoom() {
  const compute = () =>
    typeof window === 'undefined' ? 1.55 : Math.min(1.55, Math.max(1, window.innerWidth / 860));
  const [zoom, setZoom] = useState(compute);
  // re-check on every render (React bails out when unchanged) — some mobile
  // browsers settle their viewport after mount without firing resize
  useEffect(() => setZoom(compute()));
  useEffect(() => {
    const onResize = () => setZoom(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return zoom;
}

function useIsMobilePanel() {
  const compute = () =>
    typeof window !== 'undefined' &&
    (window.innerWidth < 700 || window.matchMedia?.('(pointer: coarse)').matches);
  const [mobile, setMobile] = useState(compute);

  useEffect(() => {
    const onResize = () => setMobile(compute());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return mobile;
}

function FocusPanel() {
  const focused = useCommandCenter((s) => s.focused);
  const panelOpen = useCommandCenter((s) => s.panelOpen);
  const focus = useCommandCenter((s) => s.focus);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoom = usePanelZoom();
  const mobilePanel = useIsMobilePanel();

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
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: mobilePanel ? 0.14 : 0.25 } }}
        >
          {/* dimmer — heavier for reading contrast */}
          <div className="absolute inset-0 bg-black/70 md:backdrop-blur-md" onClick={() => focus(null)} />

          <motion.div
            className="relative flex h-full max-h-[860px] w-full max-w-6xl flex-col"
            initial={{ scale: mobilePanel ? 0.98 : 0.9, y: mobilePanel ? 8 : 24 }}
            animate={{
              scale: 1,
              y: 0,
              transition: { type: 'spring', stiffness: mobilePanel ? 220 : 150, damping: mobilePanel ? 28 : 20 },
            }}
            exit={{ scale: mobilePanel ? 0.98 : 0.94, y: mobilePanel ? 6 : 12 }}
          >
            <div className="mb-2 flex items-end justify-between gap-2 px-1 md:mb-4">
              <div className="min-w-0">
                <p className="truncate font-mono text-[10px] uppercase tracking-[0.3em] text-teal-400/80 sm:text-xs md:text-sm md:tracking-[0.4em]">
                  {def.subtitle}
                </p>
                <h2 className="neon-text mt-1 truncate font-display text-lg tracking-[0.2em] sm:text-2xl md:text-4xl">
                  {def.title}
                </h2>
              </div>
              <button
                onClick={() => focus(null)}
                className="hud-chip shrink-0 !px-4 !py-2.5 !text-sm"
                aria-label="Return to the camp"
              >
                ✕ <span className="hidden sm:inline">&nbsp;ESC</span>
              </button>
            </div>

            <div ref={scrollRef} className="panel-scroll relative min-h-0 flex-1 overflow-y-auto scroll-smooth rounded-xl bg-[#0d0f0a] shadow-neon ring-1 ring-teal-200/20">
              {/* CRT power-on: line burst + flicker, then the UI fades in */}
              {!mobilePanel && (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-10 grid place-items-center overflow-hidden rounded-xl bg-black"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0, transitionEnd: { display: 'none' } }}
                  transition={{ delay: 0.5, duration: 0.12 }}
                >
                  <motion.div
                    className="h-[2px] w-full bg-teal-100"
                    style={{ boxShadow: '0 0 24px 4px rgba(212, 218, 180, 0.9)' }}
                    initial={{ scaleX: 0.02, scaleY: 1, opacity: 0 }}
                    animate={{
                      scaleX: [0.02, 1, 1, 1],
                      scaleY: [1, 1, 70, 150],
                      opacity: [0, 1, 0.55, 0],
                    }}
                    transition={{ duration: 0.5, times: [0, 0.35, 0.75, 1] }}
                  />
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: mobilePanel ? 0.04 : 0.42, duration: mobilePanel ? 0.14 : 0.3 }}
              >
                {/* zoom scales every screen's type & UI up for comfortable
                    reading — on a plain div so framer-motion never touches it */}
                <div className="min-h-[420px] leading-relaxed" style={{ zoom }}>
                  <Screen expanded />
                </div>
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
  const { focused, focus, hint, booted, power } = useCommandCenter();
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
        className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:p-5"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: booted ? 1 : 0, y: booted ? 0 : -12 }}
        transition={{ delay: 0.6, duration: 0.8 }}
      >
        <div>
          <p className="font-display text-xs font-bold tracking-[0.3em] text-slate-100 md:text-sm md:tracking-[0.35em]">
            ABDULLAH SHIBIB
          </p>
          <p className="mt-1 font-mono text-[9px] tracking-[0.2em] text-teal-300/70 md:text-[10px] md:tracking-[0.25em]">
            DATA ENGINEER · SOFTWARE ENGINEER · AI DEVELOPER
          </p>
        </div>
        <div className="hidden text-right font-mono text-[10px] leading-relaxed text-teal-300/60 md:block">
          <p>
            SYS{' '}
            {power ? (
              <span className="text-teal-300">NOMINAL</span>
            ) : (
              <span className="text-ember">PWR OFFLINE</span>
            )}{' '}
            · {clock}
          </p>
          <p>
            SECTOR: <span className="text-teal-200">{focused ? monitorById(focused).label.toUpperCase() : 'OVERVIEW'}</span>
          </p>
        </div>
      </motion.header>

      {/* bottom nav */}
      <motion.nav
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: booted ? 1 : 0, y: booted ? 0 : 12 }}
        transition={{ delay: 0.9, duration: 0.8 }}
      >
        <AnimatePresence>
          {hint && !focused && (
            <motion.p
              className="px-4 text-center font-mono text-[11px] text-teal-200/80"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {hint}
            </motion.p>
          )}
          {!hint && !focused && booted && (
            <motion.p
              className="px-4 text-center font-mono text-[11px] text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {power ? 'Tap a monitor to jack in' : 'Power is out — hit the red switch on the desk'}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="pointer-events-auto flex max-w-full gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] md:flex-wrap md:justify-center md:overflow-visible">
          {MONITORS.map((m) => (
            <button
              key={m.id}
              className="hud-chip shrink-0"
              data-active={focused === m.id}
              disabled={!power}
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
