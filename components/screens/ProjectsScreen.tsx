'use client';

import { useEffect, useState } from 'react';
import { FiGithub, FiExternalLink } from 'react-icons/fi';
import { PROJECTS } from '@/lib/data';

interface RepoProject {
  id: string;
  name: string;
  description: string;
  tech: string[];
  link: string;
}

let cache: RepoProject[] | null = null;

const FALLBACK: RepoProject[] = PROJECTS.map((p) => ({
  id: p.id, name: p.name, description: p.tagline, tech: p.stack,
  link: `https://github.com/Abdullah-Shibib/${p.id}`,
}));

/** DEPLOYMENTS — cards generated live from the local "GitHub Projects" folder. */
export default function ProjectsScreen({ expanded = false }: { expanded?: boolean }) {
  const [projects, setProjects] = useState<RepoProject[] | null>(cache);

  // cache only seeds the first paint — every mount re-scans the folder so
  // added/removed repos show up without a reload
  useEffect(() => {
    let alive = true;
    fetch('/api/projects', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const list: RepoProject[] = data.projects?.length ? data.projects : FALLBACK;
        cache = list;
        setProjects(list);
      })
      .catch(() => alive && setProjects((p) => p ?? FALLBACK));
    return () => {
      alive = false;
    };
  }, []);

  const list = projects ? (expanded ? projects : projects.slice(0, 2)) : null;

  return (
    <div className="screen h-full w-full">
      <div className="screen-header">
        <span className="screen-title">DEPLOYMENTS</span>
        <span className="font-mono text-[10px] text-teal-400/70">
          {projects ? `${projects.length} repos · synced` : 'scanning…'}
        </span>
      </div>

      <div
        className={`screen-body panel-scroll ${
          expanded
            ? 'grid grid-cols-1 content-start gap-3 !overflow-y-auto scroll-smooth md:grid-cols-2'
            : 'flex flex-col gap-2 overflow-hidden'
        }`}
      >
        <div className="scanline" />

        {!list &&
          Array.from({ length: expanded ? 6 : 3 }, (_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-teal-400/10 bg-teal-950/20"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}

        {list?.map((p, i) => (
          <a
            key={p.id}
            href={p.link}
            target="_blank"
            rel="noreferrer"
            className={`group block shrink-0 rounded-lg border border-teal-400/15 bg-teal-950/20 p-3 transition
              duration-200 hover:-translate-y-0.5 hover:border-teal-300/50 hover:bg-teal-400/10 hover:shadow-neon
              ${expanded ? '' : 'pointer-events-none'}`}
            style={expanded ? { animation: `rise 0.5s ease-out ${i * 70}ms backwards`, transformOrigin: 'bottom' } : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <FiGithub className="shrink-0 text-teal-300/80" size={14} />
                {p.name}
              </span>
              {expanded && (
                <FiExternalLink className="shrink-0 text-teal-500/50 transition group-hover:text-teal-300" size={13} />
              )}
            </div>
            <p className={`mt-1 text-[11px] leading-relaxed text-slate-300 ${expanded ? '' : 'line-clamp-2'}`}>
              {p.description}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.tech.map((s) => (
                <span
                  key={s}
                  className="whitespace-nowrap rounded border border-teal-400/20 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] leading-none text-teal-300/80"
                >
                  {s}
                </span>
              ))}
            </div>
          </a>
        ))}

        {list && !expanded && projects && projects.length > list.length && (
          <div className="shrink-0 rounded-md border border-teal-400/15 bg-black/30 px-2 py-1 text-center font-mono text-[9px] text-teal-300/70">
            + {projects.length - list.length} more — open to browse all
          </div>
        )}

        {expanded && (
          <p className="text-[11px] text-slate-400 md:col-span-2">
            This list is generated live from the local{' '}
            <span className="font-mono text-teal-300/80">GitHub Projects</span> folder — drop a new repo in and it
            appears here automatically.
          </p>
        )}
      </div>
    </div>
  );
}
