import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { NextResponse } from 'next/server';

/** Always re-scan the folder so new repos appear without a rebuild. */
export const dynamic = 'force-dynamic';

const PROJECTS_DIR =
  process.env.GITHUB_PROJECTS_DIR || join(homedir(), 'OneDrive', 'Desktop', 'GitHub Projects');

const EXT_TECH: Record<string, string> = {
  '.py': 'Python', '.ts': 'TypeScript', '.tsx': 'React', '.jsx': 'React',
  '.js': 'JavaScript', '.html': 'HTML', '.css': 'CSS', '.ipynb': 'Jupyter',
  '.lua': 'Lua', '.cs': 'C#', '.cpp': 'C++', '.sql': 'SQL', '.java': 'Java',
};

const README_TECH: [RegExp, string][] = [
  [/pytorch|torch/i, 'PyTorch'], [/tensorflow/i, 'TensorFlow'], [/\bbert|transformer/i, 'Transformers'],
  [/react/i, 'React'], [/next\.?js/i, 'Next.js'], [/flask/i, 'Flask'], [/django/i, 'Django'],
  [/opencv/i, 'OpenCV'], [/pandas/i, 'Pandas'], [/numpy/i, 'NumPy'], [/docker/i, 'Docker'],
  [/aws|amazon web/i, 'AWS'], [/alpaca/i, 'Alpaca API'], [/pygame/i, 'Pygame'],
  [/sentiment/i, 'NLP'], [/machine learning|\bml\b/i, 'ML'], [/api\b/i, 'REST API'],
  [/node\.?js|express/i, 'Node.js'], [/mysql|postgres|sqlite/i, 'SQL'],
];

function walkExtensions(dir: string, depth: number, out: Set<string>) {
  if (depth < 0) return;
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    if (e === '.git' || e === 'node_modules') continue;
    const p = join(dir, e);
    try {
      if (statSync(p).isDirectory()) {
        walkExtensions(p, depth - 1, out);
      } else {
        const dot = e.lastIndexOf('.');
        if (dot >= 0) {
          const tech = EXT_TECH[e.slice(dot).toLowerCase()];
          if (tech) out.add(tech);
        }
        if (e === 'package.json') out.add('Node.js');
        if (e === 'requirements.txt') out.add('Python');
      }
    } catch {
      /* unreadable entry — skip */
    }
  }
}

function parseReadme(dir: string): { description: string; text: string } {
  for (const name of ['README.md', 'readme.md', 'Readme.md']) {
    const p = join(dir, name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf-8');
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('!') || t.startsWith('[![')) continue;
      if (/^https?:\/\//.test(t)) continue;
      if (t.length < 25) continue; // skip credit lines / stubs
      const clean = t.replace(/[*_`]/g, '');
      return { description: clean.length > 220 ? `${clean.slice(0, 217)}…` : clean, text };
    }
    return { description: '', text };
  }
  return { description: '', text: '' };
}

function gitRemote(dir: string): string | null {
  try {
    const cfg = readFileSync(join(dir, '.git', 'config'), 'utf-8');
    const m = cfg.match(/url\s*=\s*(\S+)/);
    if (!m) return null;
    return m[1].replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
  } catch {
    return null;
  }
}

export async function GET() {
  let dirs: string[] = [];
  try {
    dirs = readdirSync(PROJECTS_DIR).filter((d) => {
      try {
        return statSync(join(PROJECTS_DIR, d)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return NextResponse.json({ projects: [], error: `Projects folder not found: ${PROJECTS_DIR}` }, { status: 200 });
  }

  const projects = dirs.map((folder) => {
    const dir = join(PROJECTS_DIR, folder);
    const { description, text } = parseReadme(dir);
    const tech = new Set<string>();
    walkExtensions(dir, 2, tech);
    for (const [re, label] of README_TECH) if (re.test(text)) tech.add(label);

    return {
      id: folder,
      name: folder.replace(/-+$/, '').replace(/-/g, ' '),
      description: description || 'See the repository for details.',
      tech: Array.from(tech).slice(0, 6),
      link: gitRemote(dir) || `https://github.com/Abdullah-Shibib/${folder}`,
    };
  });

  return NextResponse.json({ projects });
}
