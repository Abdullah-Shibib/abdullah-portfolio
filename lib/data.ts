import { Vector3 } from 'three';

/* ------------------------------------------------------------------ */
/*  The monitor wall — every interactive screen in the command center. */
/* ------------------------------------------------------------------ */

export type MonitorId =
  | 'network'
  | 'about'
  | 'ml'
  | 'projects'
  | 'timeline'
  | 'skills'
  | 'contact'
  | 'assistant';

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
    id: 'about',
    label: 'About',
    title: 'PERSONNEL FILE',
    subtitle: 'Operator dossier — background & focus areas',
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
  {
    id: 'assistant',
    label: 'AI Assistant',
    title: 'AXIS INTELLIGENCE',
    subtitle: "The command center's surviving AI — ask it anything",
    position: [-6.42, 2.42, -3.26],
    yaw: 0.72,
    size: [1.6, 1.05],
    viewDistance: 2.15,
  },
];

export const monitorById = (id: MonitorId) =>
  MONITORS.find((m) => m.id === id) as MonitorDef;

/** Outward normal of a monitor (unit vector pointing into the room). */
export const monitorNormal = (m: MonitorDef) =>
  new Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));

/** Camera pose when a monitor is focused. Narrow viewports (phones in
 *  portrait) pull the camera back so the whole screen stays in frame. */
export const monitorCamera = (m: MonitorDef, aspect = 16 / 9) => {
  const widen = Math.min(2.4, Math.max(1, 1.45 / Math.max(aspect, 0.4)));
  const n = monitorNormal(m).multiplyScalar(m.viewDistance * widen);
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
    id: 'AI-Trading-Bot',
    name: 'AI Trading Bot',
    status: 'ACTIVE',
    tagline: 'Automated trading strategy powered by sentiment analysis and market backtesting.',
    detail:
      'Python trading bot using FinBERT/PyTorch sentiment signals, Alpaca API execution, Lumibot strategy logic, and YahooDataBacktesting.',
    stack: ['Python', 'PyTorch', 'FinBERT', 'Alpaca API', 'Lumibot', 'NLP'],
    metrics: [
      { label: 'Signal source', value: 'FinBERT' },
      { label: 'Broker API', value: 'Alpaca' },
      { label: 'Backtests', value: 'Yahoo data' },
    ],
  },
  {
    id: 'Aim-Training-Simulator',
    name: 'Aim Training Simulator',
    status: 'SHIPPED',
    tagline: 'Pygame aim trainer with moving targets, power-ups, scoring, and login flow.',
    detail:
      'Python game that spawns randomized targets and power-ups while tracking hit rate, lives, elapsed time, and player performance.',
    stack: ['Python', 'Pygame'],
    metrics: [
      { label: 'Target types', value: '3+' },
      { label: 'Power-ups', value: '3' },
      { label: 'Runtime', value: 'Pygame' },
    ],
  },
  {
    id: 'DataWhisk',
    name: 'DataWhisk',
    status: 'LIVE',
    tagline: 'Google review scraping and transformer sentiment analytics for business insights.',
    detail:
      'Playwright scraper plus Python NLP pipeline for sentiment analysis, aspect extraction, keyword mining, and customer-feedback visualization.',
    stack: ['Python', 'Playwright', 'PyTorch', 'Pandas', 'Node.js', 'NLP'],
    metrics: [
      { label: 'Source', value: 'Google Reviews' },
      { label: 'Analysis', value: 'BERT NLP' },
      { label: 'Outputs', value: 'Insights' },
    ],
  },
  {
    id: 'Ecommerce-Website',
    name: 'Ecommerce Website',
    status: 'SHIPPED',
    tagline: 'Responsive computer-hardware storefront with product sliders and catalog UI.',
    detail:
      'Front-end storefront for PC hardware with navigation, featured products, product details, gallery content, and responsive layout.',
    stack: ['HTML', 'CSS', 'JavaScript'],
    metrics: [
      { label: 'Category', value: 'Hardware' },
      { label: 'UI', value: 'Responsive' },
      { label: 'Stack', value: 'Vanilla JS' },
    ],
  },
  {
    id: 'Ligalytics-app-',
    name: 'Ligalytics App',
    status: 'ACTIVE',
    tagline: 'Legal analytics web app contribution from the GitHub Projects workspace.',
    detail:
      'Collaborative legal analytics app with Abdullah contributing front-end implementation and interface work.',
    stack: ['Front-end', 'Web App'],
    metrics: [
      { label: 'Role', value: 'Front-end' },
      { label: 'Type', value: 'Legal tech' },
      { label: 'Repo', value: 'GitHub' },
    ],
  },
  {
    id: 'Motion-detection-security-system',
    name: 'Motion Detection Security System',
    status: 'SHIPPED',
    tagline: 'Python/OpenCV camera security app with motion detection and recording controls.',
    detail:
      'Desktop security system that monitors a camera feed, detects motion, records video, and exposes controls through a user interface.',
    stack: ['Python', 'OpenCV', 'Tkinter'],
    metrics: [
      { label: 'Input', value: 'Camera' },
      { label: 'Detection', value: 'Motion' },
      { label: 'Output', value: 'Recordings' },
    ],
  },
  {
    id: 'Personal-AI-Doctor-P.A.I.D',
    name: 'Personal AI Doctor P.A.I.D',
    status: 'SHIPPED',
    tagline: 'Flask web app using RAG and LLMs to respond to symptom-based medical prompts.',
    detail:
      'Web application that combines a Flask backend, HTML/CSS/JavaScript UI, RAG workflow, and LLM responses for symptom-driven diagnosis demos.',
    stack: ['Python', 'Flask', 'RAG', 'LLM', 'HTML', 'JavaScript'],
    metrics: [
      { label: 'Backend', value: 'Flask' },
      { label: 'AI flow', value: 'RAG' },
      { label: 'Interface', value: 'Web' },
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
  Education: '#c6cfa4',
  Internship: '#8d9c6a',
  Project: '#75855c',
  Leadership: '#aeb98c',
};

/* ------------------------------------------------------------------ */
/*  About Me — the operator dossier (sourced from the resume).         */
/* ------------------------------------------------------------------ */

export const ABOUT = {
  name: 'Abdullah Shibib',
  callsign: 'OPERATOR — SHIBIB, A.',
  summary:
    'Software engineer who builds real-world systems — from a 16-month Ericsson internship track to a 100+ player game server run like a product. Happiest where backend, data, and interactive experiences meet.',
  education: {
    school: 'Carleton University',
    program: 'Honors Bachelor of Information Technology · IRM',
    detail: 'Minor in Psychology — Ottawa, ON · Class of 2028',
  },
  posts: [
    {
      role: 'Data Engineer Intern',
      org: 'Ericsson',
      period: 'Apr 2026 — Dec 2026',
      brief: 'ML model training workflows (TensorFlow/PyTorch), optimized Python data pipelines, and 3D telecom network visualizations for Lund & Kista.',
    },
    {
      role: 'Software Engineer Intern',
      org: 'Ericsson',
      period: 'Sep 2025 — Apr 2026',
      brief: 'CI/CD pipelines with GitHub Actions & Jenkins, GPU compute environments, and Python automation for build validation.',
    },
    {
      role: 'Server Developer — Founder',
      org: 'NoLife RP',
      period: 'Leadership',
      brief: 'Led a GTA V FiveM server with 100+ daily concurrent players — custom gameplay systems, Stripe billing ($3,500+ MRR), 99.9% uptime.',
    },
  ],
  focus: [
    'Backend Development',
    'Machine Learning',
    'Data Engineering',
    'Full-Stack Development',
    'Interactive 3D Experiences',
    'Real-World Applications',
  ],
};

export const LANGUAGES = [
  { label: 'Python', pct: 38, color: '#8d9c6a' },
  { label: 'TypeScript', pct: 26, color: '#c6cfa4' },
  { label: 'C++', pct: 16, color: '#75855c' },
  { label: 'Lua', pct: 12, color: '#a4b07e' },
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
