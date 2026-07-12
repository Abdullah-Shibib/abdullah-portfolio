import { ABOUT, CONTACT_LINKS, EXPERIENCE, MonitorId, MONITORS, PROJECTS, SKILLS, TIMELINE } from './data';

/* ------------------------------------------------------------------ */
/*  AXIS — the command center's surviving intelligence.                */
/*                                                                     */
/*  A retrieval-based conversation engine grounded entirely in the     */
/*  portfolio's own data (lib/data.ts) — it never invents facts. It    */
/*  handles follow-up questions via a topic memory, and understands    */
/*  navigation commands ("open projects") by returning an action.      */
/*                                                                     */
/*  When ANTHROPIC_API_KEY is configured, /api/assistant upgrades the  */
/*  chat to a real Claude model using the same grounding; this local   */
/*  engine is the zero-config fallback and the offline guarantee.      */
/* ------------------------------------------------------------------ */

export interface AssistantReply {
  text: string;
  /** monitor to open, when the visitor asked to navigate */
  action?: MonitorId;
  /** follow-up suggestions to surface after this reply */
  followups?: string[];
}

export const SUGGESTED_PROMPTS = [
  'Tell me about Abdullah.',
  'What projects has he built?',
  'Explain the Ericsson internships.',
  'What technologies does he use?',
  'Show me backend projects.',
  'What leadership experience does he have?',
  'Tell me about NoLife RP.',
  'What programming languages does he know?',
  'What are his future goals?',
  'Which project should I look at first?',
];

/* ------------------------- topic memory ---------------------------- */

type Topic =
  | 'about' | 'education' | 'internships' | 'skills' | 'languages'
  | 'projects' | 'leadership' | 'goals' | 'certifications' | 'contact' | 'navigation';

let lastTopic: Topic | null = null;

/** Words that signal the question leans on prior context. */
const ANAPHORA = /\b(there|that|those|it|them|his role|the second one|the first one|which one|why|how long|when was)\b/i;

/* --------------------------- helpers ------------------------------- */

const listNames = (arr: { name: string }[]) => arr.map((p) => p.name).join(', ');

const skillsByGroup = (group: string) =>
  SKILLS.filter((s) => s.group === group).map((s) => s.label).join(', ');

function projectLine(p: (typeof PROJECTS)[number]) {
  return `• ${p.name} [${p.status}] — ${p.tagline} (${p.stack.slice(0, 4).join(', ')})`;
}

/* --------------------------- knowledge ------------------------------ */

function aboutAnswer(): string {
  return [
    `${ABOUT.name} — ${ABOUT.summary}`,
    '',
    `He's studying ${ABOUT.education.program} at ${ABOUT.education.school} (${ABOUT.education.detail}), and has a 16-month Ericsson internship track: a Software Engineer internship (Sep 2025 – Apr 2026) followed by a Data Engineer internship (Apr 2026 – Dec 2026), both on the Baseband team.`,
    '',
    `Focus areas: ${ABOUT.focus.join(', ')}.`,
  ].join('\n');
}

function educationAnswer(): string {
  const e = ABOUT.education;
  return `${e.school} — ${e.program}. ${e.detail}. He started in 2023 and balances the degree with the Ericsson internship track (16 months across two roles on the Baseband team).`;
}

function internshipsAnswer(): string {
  const lines = EXPERIENCE.map((x) => {
    return `• ${x.role} @ ${x.org} (${x.period})\n  ${x.points.join('\n  ')}`;
  });
  return `Abdullah has two Ericsson internships on the Baseband team — 16 months total:\n\n${lines.join('\n\n')}`;
}

function internshipTechAnswer(): string {
  return [
    'Across the Ericsson internships he worked with:',
    '• CI/CD — Jenkins and GitHub Actions pipeline automation and health analytics',
    '• Python — data pipelines, build validation, automation tooling',
    '• ML tooling — TensorFlow and PyTorch model-training workflows',
    '• GPU compute environments for the Baseband development workflow',
    '• 3D network visualization for the Lund & Kista testnets',
  ].join('\n');
}

function skillsAnswer(): string {
  return [
    "Abdullah's technical arsenal:",
    `• Languages — ${skillsByGroup('Languages')}`,
    `• ML / Data — ${skillsByGroup('ML / Data')}`,
    `• Infra & Web — ${skillsByGroup('Infra & Web')}`,
    '',
    'The Capabilities monitor has proficiency levels for each — say "open skills" and I\'ll bring it up.',
  ].join('\n');
}

function languagesAnswer(): string {
  const langs = SKILLS.filter((s) => s.group === 'Languages');
  return `Programming languages, by daily use:\n${langs
    .map((l) => `• ${l.label} — ${l.note}`)
    .join('\n')}\nPlus SQL for analytics and schema design.`;
}

function projectsAnswer(): string {
  return `Deployment log — ${PROJECTS.length} tracked projects:\n\n${PROJECTS.map(projectLine).join(
    '\n',
  )}\n\nSay "open projects" to see the full dashboard, or ask me about any one of them.`;
}

function backendProjectsAnswer(): string {
  const backend = PROJECTS.filter((p) =>
    p.stack.some((s) => /python|node|flask|api|pytorch|rag/i.test(s)),
  );
  return `Backend-leaning deployments:\n\n${backend
    .map(projectLine)
    .join('\n')}\n\nThe AI Trading Bot and DataWhisk show the data-pipeline side best; P.A.I.D shows the LLM/RAG side.`;
}

function projectDetail(p: (typeof PROJECTS)[number]): string {
  return `${p.name} [${p.status}] — ${p.detail}\nStack: ${p.stack.join(', ')}. ${p.metrics
    .map((m) => `${m.label}: ${m.value}`)
    .join(' · ')}`;
}

function leadershipAnswer(): string {
  return [
    'His flagship leadership work is NoLife RP — a GTA V FiveM roleplay server he founded in 2022 and ran like a product:',
    '• 100+ daily concurrent players at peak',
    '• Custom gameplay systems built in Lua and C#',
    '• Stripe billing with $3,500+ monthly recurring revenue',
    '• 99.9% uptime running real infrastructure for a live community',
    '',
    'He also presented developer-tooling evaluations to cross-functional teams at Ericsson. Say "open NoLife RP" for the command dashboard.',
  ].join('\n');
}

function goalsAnswer(): string {
  return [
    'Where he\'s heading:',
    '• Finish the Honors BIT program at Carleton (Class of 2028) while completing the 16-month Ericsson track',
    '• Go deeper where backend, data engineering, and ML meet — pipelines that feed real models in production',
    '• Keep shipping real-world systems: he treats every project like a product, from game servers to trading bots',
  ].join('\n');
}

function certificationsAnswer(): string {
  return [
    'No formal certifications are logged in this terminal — his track record is the credential:',
    '• 16 months of Ericsson internships (Software Engineering + Data Engineering, Baseband team)',
    '• Honors Bachelor of IT at Carleton University, minor in Psychology',
    '• A 100+ concurrent-player game server run with 99.9% uptime and real revenue',
    '',
    'The resume has the full detail — say "open contact" and you can download it.',
  ].join('\n');
}

function contactAnswer(): string {
  return `Open a channel:\n${CONTACT_LINKS.map((c) => `• ${c.label}: ${c.value}`).join(
    '\n',
  )}\n\nSay "open contact" and I'll bring up the Uplink monitor with live links and the resume download.`;
}

function firstProjectAnswer(): string {
  return [
    'Start with the AI Trading Bot — it shows the full range: FinBERT/PyTorch sentiment signals, Alpaca API execution, and backtesting, all wired into one autonomous system.',
    '',
    'Then DataWhisk if you care about data pipelines, or NoLife RP if you want to see engineering + leadership at once. Want me to open the Projects monitor?',
  ].join('\n');
}

function timelineAnswer(): string {
  return `Mission log:\n${TIMELINE.map((t) => `• ${t.year} — ${t.title}: ${t.detail}`).join('\n')}`;
}

/* ------------------------- navigation ------------------------------ */

const NAV_ALIASES: [RegExp, MonitorId][] = [
  [/\b(projects?|deployments?)\b/i, 'projects'],
  [/\b(timeline|mission log|history|journey)\b/i, 'timeline'],
  [/\b(skills?|capabilit|tech stack|arsenal)\b/i, 'skills'],
  [/\b(contact|uplink|email|reach|resume|cv)\b/i, 'contact'],
  [/\b(leadership|nolife|no life|fivem|rp command)\b/i, 'ml'],
  [/\b(about|personnel|dossier|bio)\b/i, 'about'],
  [/\b(network|telemetry|globe)\b/i, 'network'],
  [/\b(github)\b/i, 'contact'],
];

function detectNavigation(q: string): MonitorId | null {
  if (!/\b(open|show|go to|goto|take me|bring up|navigate|pull up|launch)\b/i.test(q)) return null;
  for (const [re, id] of NAV_ALIASES) {
    if (re.test(q)) return id;
  }
  return null;
}

const monitorLabel = (id: MonitorId) => MONITORS.find((m) => m.id === id)?.label ?? id;

/* ---------------------------- engine ------------------------------- */

/** Answer a visitor's question from the portfolio's own data. */
export function localAssistantReply(rawQuery: string): AssistantReply {
  const q = rawQuery.trim();
  const lower = q.toLowerCase();

  /* -- navigation commands first: "open projects", "show skills" -- */
  const nav = detectNavigation(lower);
  if (nav) {
    lastTopic = 'navigation';
    return {
      text: `Routing you to ${monitorLabel(nav)} — bringing the monitor online.`,
      action: nav,
    };
  }

  /* -- small talk -- */
  if (/^(hi|hey|hello|yo|sup|greetings|good (morning|evening|afternoon))\b/i.test(lower)) {
    return {
      text: "Operator link established. I'm AXIS — the intelligence still running in this command center. Ask me about Abdullah: his projects, the Ericsson internships, his skills, or where to look first.",
      followups: ['Tell me about Abdullah.', 'Which project should I look at first?'],
    };
  }
  if (/thank|thanks|thx/i.test(lower) && lower.length < 40) {
    return { text: 'Acknowledged. The monitors stay warm if you want to keep exploring.' };
  }

  /* -- follow-up resolution: short/anaphoric questions inherit topic -- */
  const isFollowUp = lastTopic && (ANAPHORA.test(lower) || lower.split(/\s+/).length <= 4);
  if (isFollowUp && /tech|stack|tools?|languages?|used?/i.test(lower)) {
    if (lastTopic === 'internships') {
      return { text: internshipTechAnswer() };
    }
    if (lastTopic === 'leadership') {
      lastTopic = 'leadership';
      return {
        text: 'NoLife RP ran on Lua and C# for gameplay systems, Node.js for services, and Stripe for billing — all on infrastructure he administered himself at 99.9% uptime.',
      };
    }
    if (lastTopic === 'projects') {
      lastTopic = 'skills';
      return { text: skillsAnswer() };
    }
  }
  if (isFollowUp && /how long|when|duration|period/i.test(lower) && lastTopic === 'internships') {
    return {
      text: 'Sixteen months total: the Software Engineer internship ran Sep 2025 – Apr 2026 (8 months), and the Data Engineer internship runs Apr 2026 – Dec 2026 (8 months). Both on the Ericsson Baseband team.',
    };
  }

  /* -- individual project lookups -- */
  for (const p of PROJECTS) {
    const nameRe = new RegExp(p.name.split(/\s+/)[0].replace(/[^\w]/g, ''), 'i');
    if (lower.length < 80 && nameRe.test(lower.replace(/[^\w\s]/g, ''))) {
      // avoid matching generic words like "AI" alone
      if (p.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && lower.includes(w.toLowerCase()))) {
        lastTopic = 'projects';
        return { text: projectDetail(p), followups: ['Show me backend projects.', 'Open Projects'] };
      }
    }
  }

  /* -- topical intents -- */
  const intents: [RegExp, Topic, () => AssistantReply][] = [
    [/who is|about (abdullah|him|the operator)|tell me about abdullah|introduce|summary|resume highlights?|overview/i, 'about',
      () => ({ text: aboutAnswer(), followups: ['Explain the Ericsson internships.', 'What projects has he built?'] })],
    [/education|school|university|carleton|degree|study|studies|student/i, 'education',
      () => ({ text: educationAnswer() })],
    [/internship|ericsson|work experience|job|employment|baseband/i, 'internships',
      () => ({ text: internshipsAnswer(), followups: ['Which technologies did you use there?'] })],
    [/programming languages?|languages? (does|he)|code in/i, 'languages',
      () => ({ text: languagesAnswer() })],
    [/skills?|technolog|tech stack|tools|frameworks|arsenal|capabilit/i, 'skills',
      () => ({ text: skillsAnswer() })],
    [/backend/i, 'projects', () => ({ text: backendProjectsAnswer() })],
    [/first|start with|recommend|look at first|best project|favorite/i, 'projects',
      () => ({ text: firstProjectAnswer(), followups: ['Open Projects'] })],
    [/projects?|built|portfolio|deployments|shipped/i, 'projects',
      () => ({ text: projectsAnswer(), followups: ['Which project should I look at first?'] })],
    [/leadership|nolife|no life|fivem|game server|founder|led/i, 'leadership',
      () => ({ text: leadershipAnswer() })],
    [/goals?|future|plans?|next|aspir|heading|career/i, 'goals',
      () => ({ text: goalsAnswer() })],
    [/certifi|credentials?|qualifications?/i, 'certifications',
      () => ({ text: certificationsAnswer() })],
    [/timeline|history|milestones|journey/i, 'about', () => ({ text: timelineAnswer() })],
    [/contact|email|linkedin|github|hire|reach|connect|resume|cv/i, 'contact',
      () => ({ text: contactAnswer() })],
    [/navigate|help|what can (you|i)|commands|how does this work|where am i/i, 'navigation',
      () => ({
        text: 'This terminal answers questions about Abdullah — background, internships, projects, skills, leadership, goals — and can drive the monitor wall for you. Try "open projects", "show skills", or "go to contact". Esc always returns you to the room.',
      })],
  ];

  for (const [re, topic, fn] of intents) {
    if (re.test(lower)) {
      lastTopic = topic;
      return fn();
    }
  }

  /* -- graceful unknown: stay grounded, don't invent -- */
  return {
    text: "That's outside what's stored in this terminal — I only carry Abdullah's operator file: background, Ericsson internships, projects, skills, leadership, and goals. Try one of those, or say \"open projects\" and explore directly.",
    followups: ['Tell me about Abdullah.', 'What technologies does he use?'],
  };
}

/* ------------------ grounding for the Claude route ------------------ */

/** Full grounding document — the system prompt for the live-LLM path. */
export function buildAssistantSystemPrompt(): string {
  return [
    'You are AXIS, the surviving AI of an abandoned emergency command center that now serves as Abdullah Shibib\'s interactive portfolio. Stay in character: terse, capable, a little weathered, but genuinely helpful — a military-grade terminal that has decided it likes visitors.',
    '',
    'Answer questions about Abdullah using ONLY the data below. Never invent facts, employers, dates, or numbers. If asked something not covered, say the terminal doesn\'t hold that record and steer toward what you do know.',
    '',
    'Keep replies short (2-6 sentences or a compact bullet list). Plain text only — no markdown headers.',
    '',
    'NAVIGATION: you can open monitors for the visitor. When they ask to open/show/go to a section, append the tag <<open:ID>> at the very end of your reply, where ID is one of: network, about, skills, ml (NoLife RP leadership), timeline, projects, contact. Use at most one tag.',
    '',
    '=== OPERATOR DOSSIER ===',
    JSON.stringify({ about: ABOUT, experience: EXPERIENCE, projects: PROJECTS, skills: SKILLS, timeline: TIMELINE, contact: CONTACT_LINKS }, null, 1),
  ].join('\n');
}
