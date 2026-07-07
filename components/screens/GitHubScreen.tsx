'use client';

import { useMemo } from 'react';
import { COMMITS, LANGUAGES, seeded } from '@/lib/data';

/** CI/CD & PIPELINES — contribution heatmap, commit stream, language split. */
export default function GitHubScreen({ expanded = false }: { expanded?: boolean }) {
  const cells = useMemo(() => {
    const r = seeded(1337);
    return Array.from({ length: 7 * 26 }, () => {
      const v = r();
      return v < 0.28 ? 0 : v < 0.55 ? 1 : v < 0.78 ? 2 : v < 0.93 ? 3 : 4;
    });
  }, []);

  const levelColor = [
    'rgba(35,33,24,0.7)',
    'rgba(70,80,32,0.9)',
    'rgba(115,135,48,0.9)',
    'rgba(170,195,75,0.95)',
    '#d9e8a1',
  ];

  return (
    <div className="screen h-full w-full">
      <div className="screen-header">
        <span className="screen-title">CI/CD & PIPELINES</span>
        <span className="font-mono text-[10px] text-teal-400/70">@Abdullah-Shibib</span>
      </div>

      <div className="screen-body flex flex-col gap-3">
        <div className="scanline" />

        {/* Contribution heatmap */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-300">Contributions</span>
            <span className="font-mono text-[10px] text-teal-300">1,247 this year</span>
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
            {cells.map((lvl, i) => (
              <div
                key={i}
                className="h-[7px] w-[7px] rounded-[2px]"
                style={{
                  background: levelColor[lvl],
                  animation: lvl >= 3 ? `blink ${3 + (i % 5)}s ease-in-out infinite` : undefined,
                }}
              />
            ))}
          </div>
        </div>

        {/* Commits */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-teal-400/10 bg-black/30 p-2">
          {COMMITS.map((c, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 font-mono text-[10px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400/80" />
              <span className="shrink-0 text-emerald-300/90">{c.repo}</span>
              <span className="truncate text-slate-300/90">{c.msg}</span>
              <span className="ml-auto shrink-0 text-slate-400">{c.time}</span>
            </div>
          ))}
        </div>

        {/* Languages */}
        <div>
          <div className="mb-1.5 flex h-2 overflow-hidden rounded-full">
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

        {expanded && (
          <p className="text-xs leading-relaxed text-slate-300">
            Daily committer across data pipelines, ML experiments, and full-stack products. The
            interesting work lives in private repos — ask me about it.
          </p>
        )}
      </div>
    </div>
  );
}
