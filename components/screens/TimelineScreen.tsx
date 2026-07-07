'use client';

import { KIND_COLORS, TIMELINE, EXPERIENCE } from '@/lib/data';

/** MISSION LOG — animated roadmap of education, internships & milestones. */
export default function TimelineScreen({ expanded = false }: { expanded?: boolean }) {
  const items = expanded ? TIMELINE : TIMELINE.slice(-4);

  return (
    <div className="screen h-full w-full">
      <div className="screen-header">
        <span className="screen-title">MISSION LOG</span>
        <span className="font-mono text-[10px] text-teal-400/70">2021 — 2026</span>
      </div>

      <div className={`screen-body ${expanded ? 'flex gap-6' : ''}`}>
        <div className="scanline" />

        <div className="relative flex-1 pl-4">
          {/* spine */}
          <div className="absolute bottom-1 left-[5px] top-1 w-px bg-gradient-to-b from-teal-400/60 via-teal-400/25 to-transparent" />
          {items.map((e, i) => (
            <div key={e.year} className="relative mb-2.5 last:mb-0">
              <span
                className="absolute -left-[15px] top-1 h-2 w-2 rounded-full"
                style={{
                  background: KIND_COLORS[e.kind],
                  boxShadow: `0 0 8px ${KIND_COLORS[e.kind]}`,
                  animation: i === items.length - 1 ? 'blink 2s ease-in-out infinite' : undefined,
                }}
              />
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-teal-300">{e.year}</span>
                <span className="text-[11px] font-semibold text-slate-100">{e.title}</span>
                <span
                  className="rounded px-1 py-px font-mono text-[8px] uppercase tracking-wider"
                  style={{ color: KIND_COLORS[e.kind], border: `1px solid ${KIND_COLORS[e.kind]}44` }}
                >
                  {e.kind}
                </span>
              </div>
              {(expanded || i >= items.length - 2) && (
                <p className="mt-0.5 text-[10px] leading-snug text-slate-300">{e.detail}</p>
              )}
            </div>
          ))}
        </div>

        {expanded && (
          <div className="w-80 space-y-3">
            <p className="font-display text-[10px] tracking-[0.3em] text-teal-300">FIELD EXPERIENCE</p>
            {EXPERIENCE.map((x) => (
              <div key={x.id} className="rounded-lg border border-teal-400/15 bg-teal-950/20 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-slate-100">{x.role}</span>
                  <span className="font-mono text-[10px] text-slate-400">{x.period}</span>
                </div>
                <p className="text-[11px] text-teal-300/80">{x.org}</p>
                <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-slate-300">
                  {x.points.map((p, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-teal-500">▸</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
