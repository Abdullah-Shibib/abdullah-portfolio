'use client';

import {
  SiPython, SiCplusplus, SiTypescript, SiSharp, SiLua, SiPostgresql,
  SiPytorch, SiTensorflow, SiReact, SiNextdotjs, SiNodedotjs, SiDocker,
  SiJenkins,
} from 'react-icons/si';
import { FaAws } from 'react-icons/fa';
import { SKILLS } from '@/lib/data';
import type { IconType } from 'react-icons';

const ICONS: Record<string, IconType> = {
  python: SiPython, cpp: SiCplusplus, js: SiTypescript, csharp: SiSharp,
  lua: SiLua, sql: SiPostgresql, pytorch: SiPytorch, tf: SiTensorflow,
  react: SiReact, next: SiNextdotjs, node: SiNodedotjs, docker: SiDocker,
  aws: FaAws, jenkins: SiJenkins,
};

/** CAPABILITIES — rotating tech icons + proficiency meters. */
export default function SkillsScreen({ expanded = false }: { expanded?: boolean }) {
  const groups = ['Languages', 'ML / Data', 'Infra & Web'] as const;
  const list = expanded ? SKILLS : SKILLS.filter((s) => s.level >= 78);

  if (!expanded) {
    return (
      <div className="screen h-full w-full">
        <div className="screen-header">
          <span className="screen-title">CAPABILITIES</span>
        </div>
        <div className="screen-body grid grid-cols-2 content-start gap-2">
          <div className="scanline" />
          {list.map((s, i) => {
            const Icon = ICONS[s.id];
            return (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border border-teal-400/10 bg-teal-950/20 p-2">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center text-teal-300"
                  style={{ animation: `spin-slow ${10 + i * 2}s linear infinite` }}
                >
                  {Icon && <Icon size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium text-slate-200">{s.label}</div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-300"
                      style={{ width: `${s.level}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="screen h-full w-full">
      <div className="screen-header">
        <span className="screen-title">CAPABILITIES</span>
        <span className="font-mono text-[10px] text-teal-400/70">{SKILLS.length} systems armed</span>
      </div>
      <div className="screen-body grid grid-cols-1 gap-4 overflow-y-auto md:grid-cols-3">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-2 font-display text-[10px] tracking-[0.3em] text-teal-300">{g.toUpperCase()}</p>
            <div className="space-y-2">
              {SKILLS.filter((s) => s.group === g).map((s, i) => {
                const Icon = ICONS[s.id];
                return (
                  <div key={s.id} className="rounded-lg border border-teal-400/10 bg-teal-950/20 p-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center text-teal-300"
                        style={{ animation: `spin-slow ${12 + i * 3}s linear infinite` }}
                      >
                        {Icon && <Icon size={20} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-semibold text-slate-100">{s.label}</span>
                          <span className="font-mono text-[10px] text-teal-300">{s.level}%</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-300"
                            style={{ width: `${s.level}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-snug text-slate-300">{s.note}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
