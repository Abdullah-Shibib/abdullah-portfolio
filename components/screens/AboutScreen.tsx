'use client';

import { FiCpu, FiDatabase, FiLayers, FiServer, FiBox, FiZap } from 'react-icons/fi';
import { ABOUT, LANGUAGES } from '@/lib/data';

const FOCUS_ICONS = [FiServer, FiCpu, FiDatabase, FiLayers, FiBox, FiZap];

/** PERSONNEL FILE — the operator dossier, straight from the resume. */
export default function AboutScreen({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className="screen h-full w-full">
      <div className="screen-header">
        <span className="screen-title">PERSONNEL FILE</span>
        <span className="font-mono text-[10px] text-teal-400/70">CLEARANCE · FULL</span>
      </div>

      <div className={`screen-body panel-scroll flex flex-col gap-3 ${expanded ? '!overflow-y-auto' : ''}`}>
        <div className="scanline" />

        {/* ID block */}
        <div className="flex items-center gap-3">
          {/* stylized service photo placeholder */}
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-teal-400/25 bg-teal-950/40">
            <span className="font-display text-lg font-bold text-teal-300">AS</span>
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-[0.18em] text-slate-100">
              {ABOUT.callsign}
            </p>
            <p className="mt-0.5 font-mono text-[10px] leading-snug text-teal-300/80">
              {ABOUT.education.school} · {ABOUT.education.program}
            </p>
            <p className="font-mono text-[9px] text-slate-400">{ABOUT.education.detail}</p>
          </div>
        </div>

        {/* mission statement */}
        <p className="rounded-lg border border-teal-400/10 bg-black/30 p-2.5 text-[11px] leading-relaxed text-slate-300">
          {ABOUT.summary}
        </p>

        {/* deployment history */}
        <div className="flex min-h-0 flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Service record</span>
          {(expanded ? ABOUT.posts : ABOUT.posts.slice(0, 3)).map((p) => (
            <div key={p.role} className="rounded-lg border border-teal-400/15 bg-teal-950/20 px-2.5 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="truncate text-[11px] font-semibold text-slate-100">
                  {p.role} <span className="text-teal-300/90">· {p.org}</span>
                </span>
                <span className="shrink-0 font-mono text-[9px] text-teal-400/70">{p.period}</span>
              </div>
              {expanded && <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{p.brief}</p>}
            </div>
          ))}
        </div>

        {/* focus areas */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Focus areas</span>
          <div className={`mt-1.5 grid gap-1.5 ${expanded ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
            {ABOUT.focus.map((f, i) => {
              const Icon = FOCUS_ICONS[i % FOCUS_ICONS.length];
              return (
                <span
                  key={f}
                  className="flex items-center gap-1.5 rounded border border-teal-400/20 bg-black/30 px-2 py-1 font-mono text-[9px] leading-none text-teal-200/90"
                >
                  <Icon size={10} className="shrink-0 text-teal-400/80" />
                  {f}
                </span>
              );
            })}
          </div>
        </div>

        {/* language split (expanded only — keeps the mini screen breathable) */}
        {expanded && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Primary languages</span>
            <div className="mb-1.5 mt-1.5 flex h-2 overflow-hidden rounded-full">
              {LANGUAGES.map((l) => (
                <div key={l.label} style={{ width: `${l.pct}%`, background: l.color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {LANGUAGES.map((l) => (
                <span key={l.label} className="flex items-center gap-1 text-[9px] text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
                  {l.label} {l.pct}%
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
