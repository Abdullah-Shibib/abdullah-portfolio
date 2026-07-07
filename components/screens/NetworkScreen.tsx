'use client';

import { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Network data — real cities pinned to real coordinates.             */
/* ------------------------------------------------------------------ */

interface NodeDef {
  id: string; city: string; country: string;
  lat: number; lon: number;
  latency: string; uptime: string; services: number;
  hub?: boolean;
}

const NODES: NodeDef[] = [
  { id: 'sto', city: 'Stockholm', country: 'Sweden', lat: 59.3, lon: 18.1, latency: '4ms', uptime: '99.99%', services: 14, hub: true },
  { id: 'lun', city: 'Lund', country: 'Sweden', lat: 55.7, lon: 13.2, latency: '2ms', uptime: '99.99%', services: 22, hub: true },
  { id: 'fra', city: 'Frankfurt', country: 'Germany', lat: 50.1, lon: 8.7, latency: '11ms', uptime: '99.98%', services: 9 },
  { id: 'lon', city: 'London', country: 'UK', lat: 51.5, lon: -0.1, latency: '14ms', uptime: '99.97%', services: 8 },
  { id: 'tor', city: 'Toronto', country: 'Canada', lat: 43.7, lon: -79.4, latency: '48ms', uptime: '99.95%', services: 6 },
  { id: 'nyc', city: 'New York', country: 'USA', lat: 40.7, lon: -74.0, latency: '42ms', uptime: '99.96%', services: 7 },
  { id: 'dxb', city: 'Dubai', country: 'UAE', lat: 25.2, lon: 55.3, latency: '58ms', uptime: '99.93%', services: 4 },
  { id: 'sin', city: 'Singapore', country: 'Singapore', lat: 1.35, lon: 103.8, latency: '82ms', uptime: '99.94%', services: 5 },
  { id: 'tok', city: 'Tokyo', country: 'Japan', lat: 35.7, lon: 139.7, latency: '96ms', uptime: '99.92%', services: 5 },
  { id: 'sao', city: 'São Paulo', country: 'Brazil', lat: -23.5, lon: -46.6, latency: '104ms', uptime: '99.90%', services: 3 },
  { id: 'syd', city: 'Sydney', country: 'Australia', lat: -33.9, lon: 151.2, latency: '118ms', uptime: '99.91%', services: 3 },
];

const LINKS: [string, string][] = [
  ['lun', 'sto'], ['lun', 'fra'], ['lun', 'lon'], ['sto', 'nyc'], ['lun', 'dxb'],
  ['fra', 'sin'], ['lon', 'tor'], ['sin', 'tok'], ['nyc', 'sao'], ['sin', 'syd'], ['sto', 'tok'],
];

type Vec3 = [number, number, number];

const toVec = (lat: number, lon: number): Vec3 => {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  return [Math.cos(φ) * Math.sin(λ), Math.sin(φ), Math.cos(φ) * Math.cos(λ)];
};

/** Rotate around Y (spin), then X (tilt). */
const orient = (v: Vec3, spin: number, tilt: number): Vec3 => {
  const [x, y, z] = v;
  const x1 = x * Math.cos(spin) + z * Math.sin(spin);
  const z1 = -x * Math.sin(spin) + z * Math.cos(spin);
  const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt);
  const z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
  return [x1, y2, z2];
};

const slerp = (a: Vec3, b: Vec3, t: number): Vec3 => {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const ω = Math.acos(dot);
  if (ω < 1e-4) return a;
  const sA = Math.sin((1 - t) * ω) / Math.sin(ω);
  const sB = Math.sin(t * ω) / Math.sin(ω);
  // arc lift keeps long-haul cables slightly above the surface
  const lift = 1 + Math.sin(t * Math.PI) * 0.06 * (ω / Math.PI + 0.4);
  return [
    (a[0] * sA + b[0] * sB) * lift,
    (a[1] * sA + b[1] * sB) * lift,
    (a[2] * sA + b[2] * sB) * lift,
  ];
};

const NODE_VECS = Object.fromEntries(NODES.map((n) => [n.id, toVec(n.lat, n.lon)])) as Record<string, Vec3>;

/* ------------------------------------------------------------------ */
/*  Interactive orthographic globe.                                    */
/* ------------------------------------------------------------------ */

function Globe({ interactive }: { interactive: boolean }) {
  const [, force] = useState(0);
  const [hovered, setHovered] = useState<NodeDef | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const rot = useRef({ spin: -0.35, tilt: 0.42, vel: 0.0016, zoom: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const r = rot.current;
      if (!drag.current) {
        r.spin += r.vel * dt * 0.06;
        // inertia decays back to a gentle cruise
        const cruise = 0.0016;
        r.vel += (Math.sign(r.vel || 1) * cruise - r.vel) * 0.012;
      }
      force((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const W = 520;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2 + 4;
  const { spin, tilt, zoom } = rot.current;
  const R = 118 * zoom;
  const t = performance.now() / 1000;

  const project = (v: Vec3) => {
    const [x, y, z] = orient(v, spin, tilt);
    return { sx: cx + x * R, sy: cy - y * R, z };
  };

  // arc paths, split at the horizon
  const arcs = LINKS.map(([a, b], i) => {
    const va = NODE_VECS[a];
    const vb = NODE_VECS[b];
    const active = selected === a || selected === b;
    let d = '';
    let pen = false;
    for (let s = 0; s <= 36; s++) {
      const p = project(slerp(va, vb, s / 36));
      if (p.z > -0.05) {
        d += `${pen ? 'L' : 'M'}${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`;
        pen = true;
      } else {
        pen = false;
      }
    }
    // packet position
    const pk = (t * 0.14 + i * 0.37) % 1;
    const pp = project(slerp(va, vb, pk));
    return { d, active, dim: selected !== null && !active, packet: pp, key: `${a}-${b}` };
  });

  const nodes = NODES.map((n) => ({ ...n, p: project(NODE_VECS[n.id]) }));

  /* pointer handlers */
  const onDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!interactive || !drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    rot.current.spin += dx * 0.006;
    rot.current.tilt = Math.max(-1.2, Math.min(1.2, rot.current.tilt + dy * 0.004));
    rot.current.vel = dx * 0.0009; // hand off velocity for inertia
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => {
    drag.current = null;
  };

  /* native non-passive wheel listener so zoom doesn't scroll the panel */
  useEffect(() => {
    if (!interactive) return;
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      rot.current.zoom = Math.max(0.75, Math.min(1.35, rot.current.zoom - e.deltaY * 0.0008));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [interactive]);

  return (
    <div
      ref={boxRef}
      className={`relative h-full w-full ${interactive ? (drag.current ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full select-none" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="gAtmo" cx="50%" cy="45%">
            <stop offset="62%" stopColor="rgba(141,156,106,0)" />
            <stop offset="86%" stopColor="rgba(141,156,106,0.10)" />
            <stop offset="97%" stopColor="rgba(154,168,120,0.22)" />
            <stop offset="100%" stopColor="rgba(154,168,120,0)" />
          </radialGradient>
          <radialGradient id="gSurf" cx="42%" cy="36%">
            <stop offset="0%" stopColor="rgba(90,80,44,0.55)" />
            <stop offset="60%" stopColor="rgba(38,34,20,0.85)" />
            <stop offset="100%" stopColor="rgba(16,14,9,0.95)" />
          </radialGradient>
        </defs>

        {/* atmosphere halo */}
        <circle cx={cx} cy={cy} r={R * 1.22} fill="url(#gAtmo)" />
        {/* body */}
        <circle cx={cx} cy={cy} r={R} fill="url(#gSurf)" stroke="rgba(154,168,120,0.35)" strokeWidth="1" />

        {/* graticule — projected parallels & meridians */}
        {[-60, -30, 0, 30, 60].map((lat) => {
          let d = '';
          let pen = false;
          for (let s = 0; s <= 48; s++) {
            const p = project(toVec(lat, (s / 48) * 360 - 180));
            if (p.z > 0) {
              d += `${pen ? 'L' : 'M'}${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`;
              pen = true;
            } else pen = false;
          }
          return <path key={`la${lat}`} d={d} fill="none" stroke="rgba(154,168,120,0.14)" strokeWidth="0.7" />;
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const lon = i * 30 - 180;
          let d = '';
          let pen = false;
          for (let s = 0; s <= 36; s++) {
            const p = project(toVec((s / 36) * 180 - 90, lon));
            if (p.z > 0) {
              d += `${pen ? 'L' : 'M'}${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`;
              pen = true;
            } else pen = false;
          }
          return <path key={`lo${lon}`} d={d} fill="none" stroke="rgba(154,168,120,0.10)" strokeWidth="0.7" />;
        })}

        {/* cables */}
        {arcs.map((a) => (
          <g key={a.key} opacity={a.dim ? 0.15 : 1}>
            <path
              d={a.d}
              fill="none"
              stroke={a.active ? 'rgba(214,220,180,0.95)' : 'rgba(154,168,120,0.45)'}
              strokeWidth={a.active ? 1.6 : 1}
              className="dash-flow"
            />
            {a.packet.z > 0 && (
              <circle cx={a.packet.sx} cy={a.packet.sy} r={a.active ? 2.6 : 1.8} fill={a.active ? '#dde3c2' : '#9aa878'} />
            )}
          </g>
        ))}

        {/* nodes — always ON the sphere */}
        {nodes.map((n) => {
          const front = n.p.z > 0.02;
          const pulse = 1 + Math.sin(t * 2.2 + n.lon) * 0.25;
          const dim = selected !== null && selected !== n.id && !LINKS.some(([a, b]) => (a === selected && b === n.id) || (b === selected && a === n.id));
          return (
            <g
              key={n.id}
              opacity={front ? (dim ? 0.25 : 1) : 0.12}
              style={{ cursor: interactive && front ? 'pointer' : undefined }}
              onPointerEnter={() => interactive && front && setHovered(n)}
              onPointerLeave={() => interactive && setHovered((h) => (h?.id === n.id ? null : h))}
              onClick={(e) => {
                if (!interactive || !front) return;
                e.stopPropagation();
                setSelected((s) => (s === n.id ? null : n.id));
              }}
            >
              {front && (n.hub || selected === n.id) && (
                <circle cx={n.p.sx} cy={n.p.sy} r={7 * pulse} fill="none" stroke="rgba(214,220,180,0.4)" strokeWidth="1" />
              )}
              <circle cx={n.p.sx} cy={n.p.sy} r={(n.hub ? 3.4 : 2.3) * (front ? pulse : 1)} fill={n.hub ? '#c6cfa4' : '#9aa878'} />
              {/* generous invisible hit area */}
              {interactive && front && <circle cx={n.p.sx} cy={n.p.sy} r={11} fill="transparent" />}
            </g>
          );
        })}
      </svg>

      {/* hover tooltip */}
      {interactive && hovered && (
        <div
          className="pointer-events-none absolute z-10 w-40 rounded-lg border border-teal-300/40 bg-black/85 p-2 font-mono text-[10px] leading-relaxed text-teal-100 shadow-neon"
          style={{
            left: `${((project(NODE_VECS[hovered.id]).sx / W) * 100).toFixed(1)}%`,
            top: `${((project(NODE_VECS[hovered.id]).sy / H) * 100).toFixed(1)}%`,
            transform: 'translate(12px, -50%)',
          }}
        >
          <div className="font-semibold text-teal-300">
            {hovered.city} · {hovered.country}
          </div>
          <div>latency&nbsp;&nbsp;{hovered.latency}</div>
          <div>uptime&nbsp;&nbsp;&nbsp;{hovered.uptime}</div>
          <div>services&nbsp;&nbsp;{hovered.services} healthy</div>
        </div>
      )}

      {interactive && (
        <div className="pointer-events-none absolute bottom-1.5 left-2 font-mono text-[9px] text-teal-500/60">
          drag to rotate · scroll to zoom · click a node to trace routes
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  GLOBAL TELEMETRY screen.                                           */
/* ------------------------------------------------------------------ */

export default function NetworkScreen({ expanded = false }: { expanded?: boolean }) {
  const logs = [
    'DEPLOY api-gateway v2.4.1 · OK',
    'PIPELINE etl-nightly · HEALTHY',
    'BUILD #1247 · PASS · 4m12s',
    'REGION eu-north · NOMINAL',
    'AUTOSCALE compute pool +2 nodes',
    'SLO p99 latency · WITHIN BUDGET',
  ];

  return (
    <div className="screen h-full w-full">
      <div className="screen-header">
        <span className="screen-title">GLOBAL TELEMETRY</span>
        <span className="flex items-center gap-2 font-mono text-[10px] text-teal-300">
          <span className="live-dot" /> LIVE
        </span>
      </div>

      <div className={`screen-body ${expanded ? 'flex flex-col gap-3 overflow-y-auto md:flex-row md:overflow-hidden' : 'flex gap-3'}`}>
        <div className="scanline" />

        <div className={`relative min-w-0 flex-1 ${expanded ? 'h-[300px] min-h-[260px] md:h-[430px]' : ''}`}>
          <Globe interactive={expanded} />
        </div>

        <div className={`flex ${expanded ? 'w-full md:w-64' : 'w-44'} shrink-0 flex-col gap-2`}>
          <div className="grid grid-cols-2 gap-2">
            <div className="stat-tile">
              <div className="stat-value">{NODES.length}</div>
              <div className="stat-label">Nodes up</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">11ms</div>
              <div className="stat-label">Avg latency</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value text-teal-300">99.99%</div>
              <div className="stat-label">Uptime</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">96</div>
              <div className="stat-label">Deploys / wk</div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-teal-400/10 bg-black/40 p-2 font-mono text-[9px] leading-relaxed text-teal-300/70">
            {logs.map((l, i) => (
              <div key={i} className="truncate" style={{ opacity: 1 - i * 0.12 }}>
                <span className="text-teal-500/60">{'> '}</span>
                {l}
              </div>
            ))}
          </div>

          {expanded && (
            <p className="text-xs leading-relaxed text-slate-300">
              A fictional-but-faithful ops view of the kind of distributed pipelines and build health I work on daily
              — every region, node, and metric here is demo data.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
