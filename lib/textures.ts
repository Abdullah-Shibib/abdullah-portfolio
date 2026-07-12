import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { seeded } from './data';

/** All generators are deterministic (seeded) and client-only. */

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d') as CanvasRenderingContext2D] as const;
}

function toTexture(c: HTMLCanvasElement, repeat = false) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------------ */
/*  Brick facade with real windows: lit depth, broken panes, boards.   */
/* ------------------------------------------------------------------ */

export interface FacadeOpts {
  seed: number;
  floors: number;
  cols: number;
  /** 0..1 how ruined the building is */
  decay?: number;
  /** base brick hue: 0 red-brick, 1 tan, 2 gray */
  tone?: 0 | 1 | 2;
}

export function brickFacade({ seed, floors, cols, decay = 0.5, tone = 0 }: FacadeOpts) {
  const W = 512;
  const H = Math.max(256, floors * 96);
  const [c, g] = makeCanvas(W, H);
  const r = seeded(seed);

  const bases: [number, number, number][] = [
    [122, 78, 60], // red brick
    [150, 128, 96], // tan
    [110, 106, 98], // gray block
  ];
  const [br, bg, bb] = bases[tone];

  // base wall + per-brick tint noise
  g.fillStyle = `rgb(${br},${bg},${bb})`;
  g.fillRect(0, 0, W, H);
  const bh = 10;
  const bw = 26;
  for (let y = 0; y < H; y += bh) {
    const off = (y / bh) % 2 ? bw / 2 : 0;
    for (let x = -bw; x < W; x += bw) {
      const v = (r() - 0.5) * 26;
      g.fillStyle = `rgba(${br + v},${bg + v * 0.9},${bb + v * 0.8},0.55)`;
      g.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
    }
  }
  // mortar lines
  g.strokeStyle = 'rgba(60,50,44,0.5)';
  g.lineWidth = 1;
  for (let y = 0; y < H; y += bh) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }

  // grime streaks from top
  for (let i = 0; i < 14; i++) {
    const x = r() * W;
    const grd = g.createLinearGradient(0, 0, 0, H * (0.3 + r() * 0.7));
    grd.addColorStop(0, 'rgba(30,26,22,0.35)');
    grd.addColorStop(1, 'rgba(30,26,22,0)');
    g.fillStyle = grd;
    g.fillRect(x, 0, 4 + r() * 14, H);
  }

  // windows
  const mx = W / cols;
  const my = H / floors;
  const winW = mx * 0.52;
  const winH = my * 0.6;
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const x = col * mx + (mx - winW) / 2;
      const y = f * my + (my - winH) / 2;
      const state = r();
      // ledge + lintel
      g.fillStyle = 'rgba(70,62,54,0.9)';
      g.fillRect(x - 4, y + winH, winW + 8, 4);
      g.fillRect(x - 3, y - 3, winW + 6, 3);
      // frame
      g.fillStyle = 'rgb(38,34,30)';
      g.fillRect(x - 2, y - 2, winW + 4, winH + 4);

      if (state < decay * 0.45) {
        // broken — black interior, jagged remnant shards
        g.fillStyle = 'rgb(8,8,9)';
        g.fillRect(x, y, winW, winH);
        g.fillStyle = 'rgba(140,155,160,0.5)';
        for (let s = 0; s < 4; s++) {
          const sx = x + r() * winW;
          const sy = y + (r() > 0.5 ? 0 : winH - 6);
          g.beginPath();
          g.moveTo(sx, sy);
          g.lineTo(sx + 4 + r() * 6, sy + (sy > y ? -1 : 1) * (4 + r() * 8));
          g.lineTo(sx + 8 + r() * 6, sy);
          g.fill();
        }
      } else if (state < decay * 0.6) {
        // boarded up
        g.fillStyle = 'rgb(92,72,48)';
        g.fillRect(x, y, winW, winH);
        g.strokeStyle = 'rgba(55,42,28,0.9)';
        g.lineWidth = 2;
        for (let p = 1; p < 4; p++) {
          g.beginPath(); g.moveTo(x, y + (winH / 4) * p); g.lineTo(x + winW, y + (winH / 4) * p); g.stroke();
        }
      } else {
        // intact glass — sky gradient + specular streak, dark interior below
        const grd = g.createLinearGradient(x, y, x + winW * 0.4, y + winH);
        grd.addColorStop(0, 'rgb(150,160,158)');
        grd.addColorStop(0.45, 'rgb(72,82,88)');
        grd.addColorStop(1, 'rgb(18,20,24)');
        g.fillStyle = grd;
        g.fillRect(x, y, winW, winH);
        g.fillStyle = 'rgba(235,240,235,0.28)';
        g.beginPath();
        g.moveTo(x + winW * 0.15, y);
        g.lineTo(x + winW * 0.4, y);
        g.lineTo(x + winW * 0.05, y + winH);
        g.lineTo(x, y + winH * 0.8);
        g.fill();
        // mullion
        g.strokeStyle = 'rgba(30,28,26,0.9)';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(x + winW / 2, y); g.lineTo(x + winW / 2, y + winH); g.stroke();
        g.beginPath(); g.moveTo(x, y + winH / 2); g.lineTo(x + winW, y + winH / 2); g.stroke();
      }
      // moss on the ledge
      if (r() < 0.55) {
        g.fillStyle = `rgba(${70 + r() * 30},${88 + r() * 30},${44},0.8)`;
        for (let m = 0; m < 5; m++) g.fillRect(x - 4 + r() * (winW + 8), y + winH + 1, 3 + r() * 5, 3);
      }
    }
  }

  // rust streaks bleeding down from window ledges & fittings
  for (let i = 0; i < 6 + decay * 6; i++) {
    const x = r() * W;
    const y0 = r() * H * 0.7;
    const len = 30 + r() * 90;
    const grd = g.createLinearGradient(0, y0, 0, y0 + len);
    grd.addColorStop(0, `rgba(${120 + r() * 40},${58 + r() * 20},${24},0.45)`);
    grd.addColorStop(1, 'rgba(90,44,18,0)');
    g.fillStyle = grd;
    g.fillRect(x, y0, 3 + r() * 6, len);
  }

  // water damage blotches
  for (let i = 0; i < 4 + decay * 4; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 20 + r() * 46;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(26,26,22,0.32)');
    grd.addColorStop(1, 'rgba(26,26,22,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // collapsed brickwork bites along the top edge
  g.fillStyle = 'rgb(10,10,9)';
  let bx = r() * W * 0.3;
  while (bx < W) {
    if (r() < 0.4 + decay * 0.3) {
      const bwid = 14 + r() * 40;
      const bdep = 6 + r() * (14 + decay * 20);
      g.beginPath();
      g.moveTo(bx, 0);
      g.lineTo(bx + bwid, 0);
      g.lineTo(bx + bwid * 0.7, bdep);
      g.lineTo(bx + bwid * 0.3, bdep * (0.5 + r() * 0.8));
      g.closePath();
      g.fill();
    }
    bx += 30 + r() * 60;
  }

  // structural cracks
  g.strokeStyle = 'rgba(24,20,18,0.55)';
  g.lineWidth = 1.6;
  for (let i = 0; i < 4 + decay * 5; i++) {
    let x = r() * W;
    let y = r() * H * 0.4;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 9; s++) {
      x += (r() - 0.5) * 26;
      y += 12 + r() * 22;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // ivy creeping up from the base + through cracks
  for (let i = 0; i < 5 + decay * 6; i++) {
    const x0 = r() * W;
    const climb = H * (0.15 + r() * 0.4);
    for (let l = 0; l < climb / 6; l++) {
      const y = H - l * 6 - r() * 5;
      const x = x0 + Math.sin(l * 0.4 + seed) * 14 + (r() - 0.5) * 10;
      g.fillStyle = `rgba(${52 + r() * 30},${78 + r() * 34},${34 + r() * 16},${0.85 - (l * 6) / climb / 2})`;
      g.beginPath();
      g.ellipse(x, y, 3 + r() * 4, 2.5 + r() * 3, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  // base grime + AO
  const ao = g.createLinearGradient(0, H - 90, 0, H);
  ao.addColorStop(0, 'rgba(20,20,16,0)');
  ao.addColorStop(1, 'rgba(18,18,14,0.6)');
  g.fillStyle = ao;
  g.fillRect(0, H - 90, W, 90);
  const top = g.createLinearGradient(0, 0, 0, 60);
  top.addColorStop(0, 'rgba(15,14,12,0.45)');
  top.addColorStop(1, 'rgba(15,14,12,0)');
  g.fillStyle = top;
  g.fillRect(0, 0, W, 60);

  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/*  Distant facade — simpler, hazier, still real windows.              */
/* ------------------------------------------------------------------ */

export function distantFacade(seed: number, floors: number, cols: number) {
  const W = 256;
  const H = Math.max(192, floors * 40);
  const [c, g] = makeCanvas(W, H);
  const r = seeded(seed);
  const v = 58 + r() * 20;
  g.fillStyle = `rgb(${v},${v * 0.97},${v * 0.9})`;
  g.fillRect(0, 0, W, H);
  const mx = W / cols;
  const my = H / floors;
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const x = col * mx + mx * 0.24;
      const y = f * my + my * 0.2;
      const s = r();
      g.fillStyle =
        s < 0.25 ? 'rgb(12,12,13)' : s < 0.5 ? 'rgb(40,46,50)' : `rgb(${88 + r() * 40},${96 + r() * 38},${94 + r() * 30})`;
      g.fillRect(x, y, mx * 0.5, my * 0.58);
    }
  }
  // vertical grime
  for (let i = 0; i < 8; i++) {
    g.fillStyle = 'rgba(40,38,32,0.25)';
    g.fillRect(r() * W, 0, 3 + r() * 8, H);
  }
  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/*  Cracked asphalt.                                                   */
/* ------------------------------------------------------------------ */

export function asphalt(seed: number) {
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  const r = seeded(seed);
  g.fillStyle = 'rgb(58,56,52)';
  g.fillRect(0, 0, S, S);
  // aggregate noise
  for (let i = 0; i < 5200; i++) {
    const v = 40 + r() * 44;
    g.fillStyle = `rgba(${v},${v},${v * 0.94},0.5)`;
    g.fillRect(r() * S, r() * S, 2, 2);
  }
  // patches / repairs
  for (let i = 0; i < 6; i++) {
    g.fillStyle = `rgba(${34 + r() * 14},${34 + r() * 12},${32 + r() * 10},0.6)`;
    g.beginPath();
    g.ellipse(r() * S, r() * S, 30 + r() * 70, 20 + r() * 50, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // cracks with grass pushing through
  for (let i = 0; i < 12; i++) {
    let x = r() * S;
    let y = r() * S;
    g.strokeStyle = 'rgba(16,15,13,0.85)';
    g.lineWidth = 1.5 + r() * 2;
    g.beginPath();
    g.moveTo(x, y);
    const segs = 6 + r() * 8;
    for (let s = 0; s < segs; s++) {
      x += (r() - 0.5) * 60;
      y += (r() - 0.5) * 60;
      g.lineTo(x, y);
    }
    g.stroke();
    // green growth along the crack
    for (let gpt = 0; gpt < 8; gpt++) {
      g.fillStyle = `rgba(${58 + r() * 30},${82 + r() * 30},${36},0.8)`;
      g.beginPath();
      g.ellipse(x + (r() - 0.5) * 80, y + (r() - 0.5) * 80, 2 + r() * 5, 2 + r() * 4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  return toTexture(c, true);
}

/* ------------------------------------------------------------------ */
/*  Grass card — a tuft of blades, alpha-tested.                       */
/* ------------------------------------------------------------------ */

export function grassCard(seed: number, kind: 'lush' | 'mixed' | 'dead') {
  const W = 128;
  const H = 128;
  const [c, g] = makeCanvas(W, H);
  const r = seeded(seed);
  const blades = 13 + Math.floor(r() * 8);
  for (let i = 0; i < blades; i++) {
    const x0 = 8 + r() * (W - 16);
    const h = H * (0.35 + r() * 0.6);
    const lean = (r() - 0.5) * 40;
    const w = 1.6 + r() * 2.4;
    let col: string;
    if (kind === 'dead' || (kind === 'mixed' && r() < 0.3)) {
      col = `rgb(${140 + r() * 40},${120 + r() * 30},${60 + r() * 20})`;
    } else {
      col = `rgb(${52 + r() * 40},${92 + r() * 46},${34 + r() * 22})`;
    }
    g.strokeStyle = col;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x0, H);
    g.quadraticCurveTo(x0 + lean * 0.3, H - h * 0.6, x0 + lean, H - h);
    g.stroke();
    // blade tip highlight
    g.strokeStyle = 'rgba(210,220,150,0.25)';
    g.lineWidth = w * 0.5;
    g.beginPath();
    g.moveTo(x0 + lean * 0.55, H - h * 0.75);
    g.quadraticCurveTo(x0 + lean * 0.8, H - h * 0.9, x0 + lean, H - h);
    g.stroke();
  }
  // wiry weed stalks with seed heads (no flowers — this world is past blooming)
  if (kind !== 'dead') {
    for (let i = 0; i < 3; i++) {
      const x0 = 14 + r() * (W - 28);
      const h = H * (0.6 + r() * 0.35);
      const lean = (r() - 0.5) * 26;
      g.strokeStyle = `rgb(${96 + r() * 30},${104 + r() * 26},${60})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x0, H);
      g.quadraticCurveTo(x0 + lean * 0.4, H - h * 0.6, x0 + lean, H - h);
      g.stroke();
      g.fillStyle = `rgba(${140 + r() * 30},${130 + r() * 24},${86},0.9)`;
      g.beginPath();
      g.ellipse(x0 + lean, H - h, 2, 4 + r() * 3, lean * 0.02, 0, Math.PI * 2);
      g.fill();
    }
  }
  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/*  Leaf cluster — for trees, bushes, ivy sheets, ferns.               */
/* ------------------------------------------------------------------ */

export function leafCluster(seed: number, kind: 'canopy' | 'ivy' | 'fern') {
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  const r = seeded(seed);
  if (kind === 'fern') {
    // arching fronds
    for (let f = 0; f < 7; f++) {
      const a = -Math.PI / 2 + (f - 3) * 0.3 + (r() - 0.5) * 0.2;
      const len = S * (0.35 + r() * 0.2);
      const cx = S / 2;
      const cy = S * 0.95;
      g.strokeStyle = `rgb(${40 + r() * 20},${70 + r() * 26},${30})`;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, cy);
      const ex = cx + Math.cos(a) * len;
      const ey = cy + Math.sin(a) * len;
      g.quadraticCurveTo(cx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.7 - 14, ex, ey);
      g.stroke();
      // leaflets
      for (let l = 0.15; l < 1; l += 0.09) {
        const lx = cx + Math.cos(a) * len * l;
        const ly = cy + Math.sin(a) * len * l - 10 * l;
        const size = (1 - l) * 12 + 3;
        g.fillStyle = `rgba(${44 + r() * 26},${76 + r() * 30},${32},0.9)`;
        g.beginPath();
        g.ellipse(lx, ly, size, size * 0.4, a + Math.PI / 2, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else {
    const n = kind === 'canopy' ? 260 : 200;
    for (let i = 0; i < n; i++) {
      // cluster toward center for canopy, toward top edge for ivy drape
      const cx = S / 2 + (r() + r() - 1) * S * 0.34;
      const cy = kind === 'canopy' ? S / 2 + (r() + r() - 1) * S * 0.3 : r() * r() * S * 0.9;
      const gr = 60 + r() * 60;
      g.fillStyle = `rgba(${gr * 0.55 + r() * 18},${gr},${gr * 0.42},${0.75 + r() * 0.25})`;
      g.beginPath();
      g.ellipse(cx, cy, 4 + r() * 7, 3 + r() * 5, r() * 3.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/*  Soft cloud puff.                                                   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Moon disc — cratered face with a soft atmospheric halo.            */
/* ------------------------------------------------------------------ */

export function moonDisc() {
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  const r = seeded(97);
  const cx = S / 2;
  // halo
  const halo = g.createRadialGradient(cx, cx, S * 0.18, cx, cx, S * 0.5);
  halo.addColorStop(0, 'rgba(214,224,238,0.5)');
  halo.addColorStop(1, 'rgba(214,224,238,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, S, S);
  // disc
  const disc = g.createRadialGradient(cx - 14, cx - 14, 4, cx, cx, S * 0.22);
  disc.addColorStop(0, '#f2f5f8');
  disc.addColorStop(0.8, '#ccd6e2');
  disc.addColorStop(1, '#aab6c6');
  g.fillStyle = disc;
  g.beginPath();
  g.arc(cx, cx, S * 0.22, 0, Math.PI * 2);
  g.fill();
  // maria + craters
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * S * 0.16;
    const rad = 3 + r() * 12;
    g.fillStyle = `rgba(120,134,152,${0.1 + r() * 0.16})`;
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cx + Math.sin(a) * d, rad, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c);
}

export function cloudPuff(seed: number) {
  const W = 512;
  const H = 256;
  const [c, g] = makeCanvas(W, H);
  const r = seeded(seed);
  for (let i = 0; i < 20; i++) {
    const x = W * 0.25 + r() * W * 0.5;
    const y = H * 0.35 + r() * H * 0.3;
    const rad = 22 + r() * 46;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(255,246,232,${0.05 + r() * 0.05})`);
    grd.addColorStop(1, 'rgba(255,246,232,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // elliptical fade mask — guarantees soft edges, never a hard plane border
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.55, 'rgba(0,0,0,0.75)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.save();
  g.translate(W / 2, H / 2);
  g.scale(1, H / W);
  g.translate(-W / 2, -H / 2);
  g.fillStyle = mask;
  g.fillRect(-W, -H, W * 3, H * 3);
  g.restore();
  g.globalCompositeOperation = 'source-over';
  return toTexture(c);
}
