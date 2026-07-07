'use client';

import { FiMail, FiGithub, FiLinkedin, FiFileText } from 'react-icons/fi';
import { CONTACT_LINKS } from '@/lib/data';
import type { IconType } from 'react-icons';

const ICONS: Record<string, IconType> = {
  email: FiMail,
  github: FiGithub,
  linkedin: FiLinkedin,
  resume: FiFileText,
};

/** UPLINK — secure channel to Abdullah. */
export default function ContactScreen({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className="screen h-full w-full">
      <div className="screen-header">
        <span className="screen-title">UPLINK</span>
        <span className="flex items-center gap-2 font-mono text-[10px] text-teal-300">
          <span className="live-dot" /> CHANNEL OPEN
        </span>
      </div>

      <div className="screen-body flex flex-col gap-2">
        <div className="scanline" />

        {expanded && (
          <div className="mb-2">
            <p className="text-lg font-semibold text-slate-100">Abdullah Shibib</p>
            <p className="text-xs text-slate-300">
              Data Engineer · Software Engineer · AI Developer — open to interesting missions.
            </p>
          </div>
        )}

        <div className={`grid gap-2 ${expanded ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          {CONTACT_LINKS.map((l) => {
            const Icon = ICONS[l.id];
            return (
              <a
                key={l.id}
                href={l.href}
                target={l.id === 'email' ? undefined : '_blank'}
                rel="noreferrer"
                className={`group flex items-center gap-2.5 rounded-lg border border-teal-400/15 bg-teal-950/20
                  px-3 py-2 transition hover:border-teal-300/60 hover:bg-teal-400/10
                  ${expanded ? '' : 'pointer-events-none'}`}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-teal-400/20 text-teal-300">
                  {Icon && <Icon size={14} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-slate-100">{l.label}</span>
                  <span className="block truncate font-mono text-[9px] text-teal-300/70">{l.value}</span>
                </span>
                <span className="ml-auto font-mono text-[10px] text-teal-500/50 transition group-hover:text-teal-300">
                  →
                </span>
              </a>
            );
          })}
        </div>

        <div className="mt-auto rounded-lg border border-teal-400/10 bg-black/30 p-2 font-mono text-[9px] leading-relaxed text-teal-300/60">
          <div>{'> handshake .......... OK'}</div>
          <div>{'> encryption ......... AES-256'}</div>
          <div>
            {'> status ............. '}
            <span className="text-teal-300">READY FOR TRANSMISSION</span>
          </div>
        </div>
      </div>
    </div>
  );
}
