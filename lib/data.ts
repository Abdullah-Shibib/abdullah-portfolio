import { Vector3 } from 'three';

/* ------------------------------------------------------------------ */
/*  The monitor wall — every interactive screen in the command center. */
/* ------------------------------------------------------------------ */

export type MonitorId =
  | 'network'
  | 'github'
  | 'ml'
  | 'projects'
  | 'timeline'
  | 'skills'
  | 'contact';

export interface MonitorDef {
  id: MonitorId;
  label: string;
  title: string;
  subtitle: string;
  /** World-space center of the screen */
  position: [number, number, number];
  /** Yaw of the screen (radians, 0 = facing +z) */
  yaw: number;
  /** World-space width / height of the visible screen */
  size: [number, number];
  /** Camera distance from the screen when focused */
  viewDistance: number;
}

export const MONITORS: MonitorDef[] = [
  {
    id: 'network',
    label: 'Network',
    title: 'GLOBAL TELEMETRY',
    subtitle: 'Distributed infrastructure telemetry — demo data',
    position: [0, 2.5, -4.2],
    yaw: 0,
    size: [3.8, 2.05],
    viewDistance: 3.1,
  },
  {
    id: 'github',
    label: 'GitHub',
    title: 'CI/CD & PIPELINES',
    subtitle: 'Commits, automation & repository health',
    position: [-2.84, 2.5, -4.08],
    yaw: 0.21,
    size: [1.22, 2.05],
    viewDistance: 2.5,
  },
  {
    id: 'skills',
    label: 'Skills',
    title: 'CAPABILITIES',
    subtitle: 'Technical arsenal & proficiency levels',
    position: [2.84, 2.5, -4.08],
    yaw: -0.21,
    size: [1.22, 2.05],
    viewDistance: 2.5,
  },
  {
    id: 'ml',
    label: 'NoLife RP',
    title: 'NOLIFE RP COMMAND',
    subtitle: 'Leadership — FiveM server development & operations',
    position: [-4.62, 3.02, -3.68],
    yaw: 0.48,
    size: [1.7, 1.0],
    viewDistance: 2.1,
  },
  {
    id: 'timeline',
    label: 'Timeline',
    title: 'MISSION LOG',
    subtitle: 'Education, internships & milestones',
    position: [-4.62, 1.9, -3.68],
    yaw: 0.48,
    size: [1.7, 1.0],
    viewDistance: 2.1,
  },
  {
    id: 'projects',
    label: 'Projects',
    title: 'DEPLOYMENTS',
    subtitle: 'Shipped products & live systems',
    position: [4.62, 3.02, -3.68],
    yaw: -0.48,
    size: [1.7, 1.0],
    viewDistance: 2.1,
  },
  {
    id: 'contact',
    label: 'Contact',
    title: 'UPLINK',
    subtitle: 'Open a secure channel',
    position: [4.62, 1.9, -3.68],
    yaw: -0.48,
    size: [1.7, 1.0],
    viewDistance: 2.1,
  },
];

export const monitorById = (id: MonitorId) =>
  MONITORS.find((m) => m.id === id) as MonitorDef;

/** Outward normal of a monitor (unit vector pointing into the room). */
export const monitorNormal = (m: MonitorDef) =>
  new Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));

/** Camera pose when a monitor is focused. */
export const monitorCamera = (m: MonitorDef) => {
  const n = monitorNormal(m).multiplyScalar(m.viewDistance);
  return {
    position: new Vector3(...m.position).add(n),
    target: new Vector3(...m.position),
  };
};

export const DEFAULT_CAMERA = {
  position: new Vector3(0, 1.9, 3.9),
  target: new Vector3(0, 2.15, -4),
};

/* ------------------------------------------------------------------ */
/*  Experience.                                                        */
/* ------------------------------------------------------------------ */

export interface Experience {
  id: string;
  role: string;
  org: string;
  period: string;
  points: string[];
}

export const EXPERIENCE: Experience[] = [
  {
    id: 'data-intern',
    role: 'Data Engineer Intern',
    org: 'Ericsson — Baseband',
    period: 'Apr 2026 — Dec 2026 · 8 months',
    points: [
      'Built and maintained data pipelines feeding L1 test analytics.',
      'Automated Jenkins CI/CD health reporting across baseband test suites.',
      'Investigated flaky vs. genuinely failing tests to raise suite reliability.',
    ],
  },
  {
    id: 'swe-intern',
    role: 'Software Engineer Intern',
    org: 'Ericsson — Baseband',
    period: 'Sep 2025 — Apr 2026 · 8 months',
    points: [
      'Shipped internal tooling for the baseband development workflow.',
      'Contributed to a 3D network deployment viewer for the Lund testnet.',
      'Presented developer-tooling evaluations to a cross-functional team.',
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Projects.                                                          */
/* ------------------------------------------------------------------ */

export interface Project {
  id: string;
  name: string;
  status: 'LIVE' | 'SHIPPED' | 'ACTIVE';
  tagline: string;
  detail: string;
  stack: string[];
  metrics: { label: string; value: string }[];
}

export const PROJECTS: Project[] = [
  {
    id: 'datawhisk',
    name: 'DataWhisk',
    status: 'LIVE',
    tagline: 'AI sentiment analytics for local bakeries',
    detail:
      'End-to-end platform ingesting customer reviews, classifying sentiment with a fine-tuned transformer, and surfacing actionable trends on a live dashboard.',
    stack: ['Python', 'PyTorch', 'Next.js', 'PostgreSQL', 'AWS'],
    metrics: [
      { label: 'Model accuracy', value: '94.2%' },
      { label: 'Reviews processed', value: '38k+' },
      { label: 'Latency', value: '<80ms' },
    ],
  },
  {
    id: 'fivem',
    name: 'FiveM RP City',
    status: 'ACTIVE',
    tagline: 'Founded & scaled a 100+ player game server',
    detail:
      'Built custom gameplay systems, economy, and payment flows in Lua/C#; grew a live community past 100 concurrent players with 99.9% uptime.',
    stack: ['Lua', 'C#', 'Node.js', 'MySQL', 'Docker'],
    metrics: [
      { label: 'Concurrent players', value: '100+' },
      { label: 'Uptime', value: '99.9%' },
      { label: 'MRR', value: '$3,500' },
    ],
  },
  {
    id: 'testnet-viewer',
    name: 'Testnet 3D Viewer',
    status: 'SHIPPED',
    tagline: '3D network deployment viewer @ Ericsson',
    detail:
      'Interactive Three.js visualization of the Lund baseband testnet — nodes, links, and live deployment states for the whole team.',
    stack: ['TypeScript', 'Three.js', 'React', 'REST'],
    metrics: [
      { label: 'Nodes rendered', value: '400+' },
      { label: 'Team adoption', value: '100%' },
      { label: 'FPS', value: '60' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Skills.                                                            */
/* ------------------------------------------------------------------ */

export interface Skill {
  id: string;
  label: string;
  level: number; // 0..100
  group: 'Languages' | 'ML / Data' | 'Infra & Web';
  note: string;
}

export const SKILLS: Skill[] = [
  { id: 'python', label: 'Python', level: 95, group: 'Languages', note: 'Pipelines, ML, automation — daily driver.' },
  { id: 'cpp', label: 'C++', level: 80, group: 'Languages', note: 'Baseband & performance-critical code.' },
  { id: 'js', label: 'TypeScript', level: 88, group: 'Languages', note: 'Full-stack apps and this very site.' },
  { id: 'csharp', label: 'C#', level: 72, group: 'Languages', note: 'Tooling and game-server plugins.' },
  { id: 'lua', label: 'Lua', level: 78, group: 'Languages', note: 'FiveM gameplay scripting.' },
  { id: 'sql', label: 'SQL', level: 85, group: 'ML / Data', note: 'Analytics queries & schema design.' },
  { id: 'pytorch', label: 'PyTorch', level: 82, group: 'ML / Data', note: 'Training + fine-tuning models.' },
  { id: 'tf', label: 'TensorFlow', level: 70, group: 'ML / Data', note: 'Production model serving.' },
  { id: 'react', label: 'React', level: 87, group: 'Infra & Web', note: 'Interactive UIs, R3F experiences.' },
  { id: 'next', label: 'Next.js', level: 84, group: 'Infra & Web', note: 'App-router products like this one.' },
  { id: 'node', label: 'Node.js', level: 80, group: 'Infra & Web', note: 'APIs, bots, payment flows.' },
  { id: 'docker', label: 'Docker', level: 76, group: 'Infra & Web', note: 'Reproducible CI/CD environments.' },
  { id: 'aws', label: 'AWS', level: 70, group: 'Infra & Web', note: 'Deployments, storage, queues.' },
  { id: 'jenkins', label: 'Jenkins', level: 82, group: 'Infra & Web', note: 'CI/CD health analytics at Ericsson.' },
];

/* ------------------------------------------------------------------ */
/*  Timeline.                                                          */
/* ------------------------------------------------------------------ */

export interface Epoch {
  year: string;
  title: string;
  kind: 'Education' | 'Internship' | 'Project' | 'Leadership';
  detail: string;
}

export const TIMELINE: Epoch[] = [
  { year: '2022', title: 'NoLife RP Founded', kind: 'Leadership', detail: 'Founded and led a FiveM GTA V roleplay server — grew past 100 concurrent players.' },
  { year: '2023', title: 'Carleton University', kind: 'Education', detail: 'Information Technology — 2023 to present.' },
  { year: 'Sep 2025', title: 'Ericsson SWE Intern', kind: 'Internship', detail: 'Sep 2025 – Apr 2026 (8 months) — internal developer tooling on the Baseband team.' },
  { year: 'Apr 2026', title: 'Ericsson Data Intern', kind: 'Internship', detail: 'Apr 2026 – Dec 2026 (8 months) — CI/CD analytics and L1 test-suite health.' },
];

export const KIND_COLORS: Record<Epoch['kind'], string> = {
  Education: '#8ae0d0',
  Internship: '#4ea89a',
  Project: '#6aa88a',
  Leadership: '#7ad9c6',
};

/* ------------------------------------------------------------------ */
/*  GitHub feed (representative).                                      */
/* ------------------------------------------------------------------ */

export const COMMITS = [
  { repo: 'datawhisk', msg: 'feat: streaming sentiment pipeline', time: '2h' },
  { repo: 'ci-health', msg: 'fix: dedupe flaky-test detector alerts', time: '9h' },
  { repo: 'portfolio', msg: 'feat: command-center monitor wall', time: '1d' },
  { repo: 'testnet-3d', msg: 'perf: instanced node meshes (60fps)', time: '2d' },
  { repo: 'fivem-core', msg: 'feat: dynamic economy rebalancing', time: '4d' },
  { repo: 'datawhisk', msg: 'chore: bump torch, retrain baseline', time: '5d' },
];

export const LANGUAGES = [
  { label: 'Python', pct: 38, color: '#4ea89a' },
  { label: 'TypeScript', pct: 26, color: '#8ae0d0' },
  { label: 'C++', pct: 16, color: '#6aa88a' },
  { label: 'Lua', pct: 12, color: '#5ec4b0' },
  { label: 'Other', pct: 8, color: '#57534e' },
];

/* ------------------------------------------------------------------ */
/*  Contact links.                                                     */
/* ------------------------------------------------------------------ */

export const CONTACT_LINKS = [
  { id: 'email', label: 'Email', value: 'abdullahshibib@yahoo.com', href: 'mailto:abdullahshibib@yahoo.com' },
  { id: 'github', label: 'GitHub', value: 'github.com/Abdullah-Shibib', href: 'https://github.com/Abdullah-Shibib' },
  { id: 'linkedin', label: 'LinkedIn', value: 'linkedin.com/in/abdullah-shibib', href: 'https://www.linkedin.com/in/abdullah-shibib-5875a1297/' },
  { id: 'resume', label: 'Resume', value: 'resume.pdf', href: '/resume.pdf' },
];

/* ------------------------------------------------------------------ */
/*  Deterministic pseudo-random (stable across renders & hydration).   */
/* ------------------------------------------------------------------ */

export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
