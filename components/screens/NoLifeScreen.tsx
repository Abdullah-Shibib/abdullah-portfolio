'use client';

import { useMemo } from 'react';
import { seeded } from '@/lib/data';

const SYSTEMS = [
  { name: 'Gameplay Core', tech: 'Lua', status: 'ONLINE' },
  { name: 'Economy Engine', tech: 'C#', status: 'ONLINE' },
  { name: 'Stripe Billing', tech: 'Node.js', status: 'ONLINE' },
  { name: 'Auto-Restarts', tech: 'Automation', status: 'ARMED' },
  { name: 'Anti-Cheat', tech: 'C# / Lua', status: 'ONLINE' },
  { name: 'Staff Panel', tech: 'Node.js', status: 'ONLINE' },
];

const OPS_LOG = [
  'AUTOSCALE peak 112 players · stable',
  'STRIPE renewal batch · 100% success',
  'DEPLOY economy-rebalance v3.2 · zero downtime',
  'BACKUP nightly snapshot · verified',
  'MOD-TEAM shift handover · 6 staff online',
  'UPTIME 30-day window · 99.9%',
];

/** NOLIFE RP COMMAND — leadership & operations of a 100+ player FiveM city. */
export default function NoLifeScreen({ expanded = false }: { expanded?: boolean }) {
  const bars = useMemo(() => {
    const r = seeded(77);
    return Array.from({ length: 24 }, (_, i) => {
      const evening = Math.exp(-((i - 20) ** 2) / 28) + Math.exp(-((i - 14) ** 2) / 60) * 0.5;
      return 0.15 + evening * 0.75 + r() * 0.1;
    });
  }, []);

  return (
    <div className="screen h-full w-full">
      <div className="screen-header">
        <span className="screen-title">NOLIFE RP COMMAND</span>
        <span className="flex items-center gap-2 font-mono text-[10px] text-teal-300">
          <span className="live-dot" /> CITY ONLINE
        </span>
      </div>

      <div className="screen-body flex flex-col gap-2.5">
        <div className="scanline" />

        {/* headline metrics */}
        <div className="grid grid-cols-4 gap-2">
          {[
            ['112', 'peak players'],
            ['99.9%', '30d uptime'],
            ['$3.5k', 'MRR · Stripe'],
            ['6', 'staff team'],
          ].map(([v, l]) => (
            <div key={l} className="stat-tile !py-1.5">
              <div className="stat-value !text-sm">{v}</div>
              <div className="stat-label">{l}</div>
            </div>
          ))}
        </div>

        {/* 24h population curve */}
        <div className="rounded-lg border border-teal-400/10 bg-black/30 p-2">
          <div className="mb-1 flex justify-between font-mono text-[9px] text-slate-400">
            <span>PLAYER POPULATION · 24H</span>
            <span className="text-teal-300">cap 128</span>
          </div>
          <div className="flex h-12 items-end gap-[3px]">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-gradient-to-t from-teal-700/70 to-teal-300/90"
                style={{ height: `${h * 100}%`, animation: `rise 0.7s ease-out ${i * 30}ms backwards`, transformOrigin: 'bottom' }}
              />
            ))}
          </div>
        </div>

        {/* systems grid */}
        <div className={`grid gap-1.5 ${expanded ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {SYSTEMS.slice(0, expanded ? 6 : 4).map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded-md border border-teal-400/10 bg-teal-950/20 px-2 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-[10px] font-semibold text-slate-100">{s.name}</div>
                <div className="font-mono text-[8px] text-teal-300/70">{s.tech}</div>
              </div>
              <span className="ml-1 shrink-0 font-mono text-[8px] text-emerald-300">
                <span className="live-dot mr-1" />
                {s.status}
              </span>
            </div>
          ))}
        </div>

        {expanded && (
          <>
            {/* ops log */}
            <div className="rounded-lg border border-teal-400/10 bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-teal-200/70">
              {OPS_LOG.map((l, i) => (
                <div key={i} className="truncate">
                  <span className="text-teal-500/50">{'> '}</span>
                  {l}
                </div>
              ))}
            </div>

            {/* leadership summary */}
            <div className="grid grid-cols-1 gap-2 text-xs leading-relaxed text-slate-300 md:grid-cols-2">
              <div className="rounded-lg border border-teal-400/10 bg-black/20 p-3">
                <p className="mb-1 font-semibold text-teal-200">Leadership & Operations</p>
                Founded and ran a 100+ concurrent player FiveM GTA V city — recruited and managed the dev & moderation
                team, ran community operations, and owned every uptime and incident-response decision.
              </div>
              <div className="rounded-lg border border-teal-400/10 bg-black/20 p-3">
                <p className="mb-1 font-semibold text-teal-200">Backend & Revenue Systems</p>
                Built gameplay systems in Lua/C#, Node.js services, Stripe subscription billing with automated
                entitlements, and automation that pushed uptime to 99.9% while revenue reached $3.5k MRR.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
