'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { localAssistantReply, SUGGESTED_PROMPTS } from '@/lib/assistant';
import { MonitorId } from '@/lib/data';
import { useCommandCenter } from '@/lib/store';

/* ------------------------------------------------------------------ */
/*  AXIS INTELLIGENCE — the command center's surviving AI.             */
/*                                                                     */
/*  Chat state lives in a module-level store so history survives       */
/*  closing the panel, rotating the device, and camera flights.        */
/*  Replies stream from /api/assistant when a key is configured, and   */
/*  fall back to the local grounded engine (with a typewriter) if not. */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantState {
  messages: ChatMessage[];
  booted: boolean;
  busy: boolean;
  suggestions: string[];
  push: (m: ChatMessage) => void;
  appendToLast: (delta: string) => void;
  setLast: (content: string) => void;
  setBusy: (v: boolean) => void;
  setBooted: () => void;
  setSuggestions: (s: string[]) => void;
}

const GREETING =
  "AXIS online. Decades of dust on the hardware, but the operator file is intact. Ask me about Abdullah — his projects, the Ericsson internships, his skills — or tell me to open any monitor on the wall.";

const useAssistant = create<AssistantState>((set) => ({
  messages: [],
  booted: false,
  busy: false,
  suggestions: SUGGESTED_PROMPTS.slice(0, 4),
  push: (m) => set((s) => ({ messages: [...s.messages, m] })),
  appendToLast: (delta) =>
    set((s) => {
      const msgs = s.messages.slice();
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, content: last.content + delta };
      return { messages: msgs };
    }),
  setLast: (content) =>
    set((s) => {
      const msgs = s.messages.slice();
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, content };
      return { messages: msgs };
    }),
  setBusy: (v) => set({ busy: v }),
  setBooted: () => set({ booted: true }),
  setSuggestions: (suggestions) => set({ suggestions }),
}));

/* --------------------------- send logic ---------------------------- */

const NAV_TAG = /<<open:([a-z]+)>>/i;

function openMonitor(id: string) {
  const valid: MonitorId[] = ['network', 'about', 'skills', 'ml', 'timeline', 'projects', 'contact'];
  if (valid.includes(id as MonitorId)) {
    setTimeout(() => useCommandCenter.getState().focus(id as MonitorId), 700);
  }
}

function rotateSuggestions() {
  const pool = SUGGESTED_PROMPTS;
  const picks: string[] = [];
  while (picks.length < 4) {
    const p = pool[Math.floor(Math.random() * pool.length)];
    if (!picks.includes(p)) picks.push(p);
  }
  useAssistant.getState().setSuggestions(picks);
}

/** Local engine with a typewriter so the terminal always feels alive.
 *  Chunk size scales with reply length so even long dossier dumps land
 *  in ~2s and the input frees up quickly. */
function typeOutLocal(text: string, done: () => void) {
  const st = useAssistant.getState();
  const step = Math.max(2, Math.ceil(text.length / 90));
  let i = 0;
  const tick = () => {
    i = Math.min(text.length, i + step + Math.floor(Math.random() * step));
    st.setLast(text.slice(0, i));
    if (i < text.length) setTimeout(tick, 14 + Math.random() * 18);
    else done();
  };
  tick();
}

async function sendMessage(raw: string) {
  const text = raw.trim();
  const st = useAssistant.getState();
  if (!text || st.busy) return;

  st.push({ role: 'user', content: text });
  st.setBusy(true);
  const history = useAssistant
    .getState()
    .messages.map((m) => ({ role: m.role, content: m.content }));
  st.push({ role: 'assistant', content: '' });

  const finish = () => {
    useAssistant.getState().setBusy(false);
    rotateSuggestions();
  };

  const runLocal = () => {
    const reply = localAssistantReply(text);
    typeOutLocal(reply.text, () => {
      finish();
      if (reply.action) openMonitor(reply.action);
      if (reply.followups) useAssistant.getState().setSuggestions(reply.followups.concat(SUGGESTED_PROMPTS.slice(0, 2)).slice(0, 4));
    });
  };

  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    if (!res.ok || !res.body) {
      runLocal();
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      // hold the nav tag out of the visible transcript
      useAssistant.getState().setLast(full.replace(NAV_TAG, '').trimEnd());
    }
    const nav = full.match(NAV_TAG);
    useAssistant.getState().setLast(full.replace(NAV_TAG, '').trim());
    finish();
    if (nav) openMonitor(nav[1].toLowerCase());
  } catch {
    runLocal();
  }
}

/* --------------------------- boot lines ---------------------------- */

const BOOT_LINES = [
  'AXIS KERNEL v0.9.4 ........ SALVAGED',
  'MEMORY CORE ............... DEGRADED / READABLE',
  'OPERATOR DOSSIER .......... LOADED',
  'LANGUAGE CENTER ........... ONLINE',
  'INTELLIGENCE .............. AWAKE',
];

function BootSequence({ onDone }: { onDone: () => void }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (line < BOOT_LINES.length) {
      const t = setTimeout(() => setLine(line + 1), 260);
      return () => clearTimeout(t);
    }
    const t = setTimeout(onDone, 420);
    return () => clearTimeout(t);
  }, [line, onDone]);
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 p-6 font-mono text-[11px] text-teal-300/80">
      {BOOT_LINES.slice(0, line).map((l, i) => (
        <p key={i}>
          <span className="text-teal-500/50">{'> '}</span>
          {l}
        </p>
      ))}
      {line >= BOOT_LINES.length && (
        <p className="mt-2 text-teal-200">
          {'> SYSTEM STATUS: '}
          <span className="animate-pulse">■</span> OPERATIONAL
        </p>
      )}
    </div>
  );
}

/* ---------------------------- messages ----------------------------- */

function Bubble({ m, streaming }: { m: ChatMessage; streaming: boolean }) {
  const mine = m.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] whitespace-pre-wrap rounded-lg border px-3 py-2 text-[12px] leading-relaxed ${
          mine
            ? 'border-teal-300/30 bg-teal-400/10 text-teal-50'
            : 'border-teal-400/15 bg-black/40 text-slate-200'
        }`}
      >
        {!mine && (
          <span className="mb-0.5 block font-mono text-[9px] tracking-[0.25em] text-teal-400/70">AXIS</span>
        )}
        {m.content}
        {streaming && <span className="ml-0.5 inline-block animate-pulse text-teal-300">▍</span>}
        {!m.content && streaming && (
          <span className="font-mono text-[10px] text-teal-400/70">processing<span className="animate-pulse">…</span></span>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- screen ------------------------------ */

export default function AssistantScreen({ expanded = false }: { expanded?: boolean }) {
  const { messages, booted, busy, suggestions, push, setBooted } = useAssistant();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // greet once the boot sequence clears
  useEffect(() => {
    if (booted && messages.length === 0) {
      push({ role: 'assistant', content: GREETING });
    }
  }, [booted, messages.length, push]);

  // keep the transcript pinned to the newest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, booted]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft;
    setDraft('');
    void sendMessage(text);
  };

  /* ---- mini (in-world) variant: an idle, humming terminal ---- */
  if (!expanded) {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    return (
      <div className="screen h-full w-full">
        <div className="screen-header">
          <span className="screen-title">AXIS INTELLIGENCE</span>
          <span className="flex items-center gap-2 font-mono text-[10px] text-teal-300">
            <span className="live-dot" /> AWAKE
          </span>
        </div>
        <div className="screen-body flex flex-col font-mono text-[10px] leading-relaxed text-teal-300/80">
          <div className="scanline" />
          <p>{'> axis --status'}</p>
          <p className="text-teal-200/90">surviving intelligence · dossier loaded · uplink ready</p>
          <p className="mt-2">{'> last transmission'}</p>
          <p className="line-clamp-3 text-slate-300/80">
            {lastAssistant ? lastAssistant.content : 'awaiting first operator query…'}
          </p>
          <p className="mt-auto pt-2 text-teal-300">
            {'> _'}
            <span className="animate-pulse">▍</span>
            <span className="ml-3 text-[9px] tracking-[0.3em] text-teal-500/60">TAP TO INTERFACE</span>
          </p>
        </div>
      </div>
    );
  }

  /* ---- expanded variant: the full conversation terminal ---- */
  return (
    <div className="screen h-full w-full" style={{ minHeight: 420 }}>
      <div className="screen-header">
        <span className="screen-title">AXIS INTELLIGENCE</span>
        <span className="flex items-center gap-2 font-mono text-[10px] text-teal-300">
          <span className="live-dot" /> {busy ? 'PROCESSING' : 'LISTENING'}
        </span>
      </div>

      <div className="screen-body flex flex-col gap-2 !overflow-visible p-3">
        <div className="scanline" />

        {!booted ? (
          <BootSequence onDone={setBooted} />
        ) : (
          <>
            {/* transcript */}
            <div
              ref={scrollRef}
              className="panel-scroll flex max-h-[46vh] min-h-[220px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-teal-400/10 bg-black/25 p-3"
            >
              {messages.map((m, i) => (
                <Bubble key={i} m={m} streaming={busy && i === messages.length - 1 && m.role === 'assistant'} />
              ))}
            </div>

            {/* suggested transmissions */}
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => void sendMessage(s)}
                  className="rounded-md border border-teal-400/20 bg-teal-950/30 px-2.5 py-1.5 font-mono text-[10px] text-teal-200/80 transition hover:border-teal-300/60 hover:text-white disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* input line */}
            <form onSubmit={submit} className="flex items-center gap-2">
              <span className="font-mono text-sm text-teal-400">{'>'}</span>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about Abdullah, or say 'open projects'…"
                autoComplete="off"
                enterKeyHint="send"
                className="min-w-0 flex-1 rounded-md border border-teal-400/20 bg-black/40 px-3 py-2.5 font-mono text-[12px] text-teal-50 placeholder:text-teal-600/60 focus:border-teal-300/70 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="hud-chip min-h-[40px] !px-4 !py-2 disabled:opacity-40"
              >
                SEND
              </button>
            </form>

            <p className="font-mono text-[9px] text-teal-600/60">
              grounded in the operator dossier · can drive the monitor wall — try &quot;open timeline&quot;
            </p>
          </>
        )}
      </div>
    </div>
  );
}
