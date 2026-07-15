import { CanvasTexture, SRGBColorSpace } from 'three';
import { seeded } from './data';

/** Bunker-side canvas textures — deterministic (seeded) and client-only,
 *  same conventions as lib/textures.ts. Canvases stay ≤512px. */

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d') as CanvasRenderingContext2D] as const;
}

function toTexture(c: HTMLCanvasElement) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------------ */
/*  Poured concrete wall — form-tie dots, pour lines, water stains.    */
/* ------------------------------------------------------------------ */

export function concreteWall(seed: number) {
  const W = 512;
  const H = 256;
  const [c, g] = makeCanvas(W, H);
  const r = seeded(seed);

  g.fillStyle = 'rgb(106,102,96)';
  g.fillRect(0, 0, W, H);

  // mottled aggregate tone
  for (let i = 0; i < 900; i++) {
    const v = 90 + r() * 34;
    g.fillStyle = `rgba(${v},${v * 0.98},${v * 0.92},0.25)`;
    g.fillRect(r() * W, r() * H, 3 + r() * 9, 2 + r() * 7);
  }

  // horizontal pour seams — the wall went up one lift at a time
  for (let y = 52; y < H; y += 52 + r() * 20) {
    g.fillStyle = 'rgba(52,48,44,0.4)';
    g.fillRect(0, y, W, 2);
    g.fillStyle = 'rgba(150,146,138,0.25)';
    g.fillRect(0, y + 2, W, 1);
  }

  // form-tie dots on a rough grid
  for (let x = 48; x < W; x += 96) {
    for (let y = 40; y < H; y += 78) {
      const dx = x + (r() - 0.5) * 8;
      const dy = y + (r() - 0.5) * 8;
      g.fillStyle = 'rgba(58,54,48,0.85)';
      g.beginPath();
      g.arc(dx, dy, 4.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(38,34,30,0.9)';
      g.beginPath();
      g.arc(dx, dy, 2.2, 0, Math.PI * 2);
      g.fill();
      // rust weep under some ties
      if (r() < 0.4) {
        const grd = g.createLinearGradient(0, dy, 0, dy + 26);
        grd.addColorStop(0, 'rgba(122,74,42,0.4)');
        grd.addColorStop(1, 'rgba(122,74,42,0)');
        g.fillStyle = grd;
        g.fillRect(dx - 2, dy, 4, 26);
      }
    }
  }

  // water stains bleeding down from the ceiling line
  for (let i = 0; i < 6; i++) {
    const x = r() * W;
    const len = H * (0.3 + r() * 0.5);
    const grd = g.createLinearGradient(0, 0, 0, len);
    grd.addColorStop(0, 'rgba(44,42,38,0.35)');
    grd.addColorStop(1, 'rgba(44,42,38,0)');
    g.fillStyle = grd;
    g.fillRect(x, 0, 6 + r() * 18, len);
  }
  for (let i = 0; i < 4; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 18 + r() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(30,30,26,0.25)');
    grd.addColorStop(1, 'rgba(30,30,26,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // hairline cracks
  g.strokeStyle = 'rgba(40,36,32,0.5)';
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    let x = r() * W;
    let y = r() * H * 0.5;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 7; s++) {
      x += (r() - 0.5) * 30;
      y += 8 + r() * 20;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // grime pooled at floor level
  const ao = g.createLinearGradient(0, H - 50, 0, H);
  ao.addColorStop(0, 'rgba(24,22,18,0)');
  ao.addColorStop(1, 'rgba(24,22,18,0.5)');
  g.fillStyle = ao;
  g.fillRect(0, H - 50, W, 50);

  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/*  Concrete floor slab — stains, hairline cracks, expansion joints.   */
/* ------------------------------------------------------------------ */

export function concreteFloor(seed: number) {
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  const r = seeded(seed);

  g.fillStyle = 'rgb(96,92,86)';
  g.fillRect(0, 0, S, S);

  // aggregate speckle
  for (let i = 0; i < 2600; i++) {
    const v = 76 + r() * 44;
    g.fillStyle = `rgba(${v},${v * 0.97},${v * 0.9},0.4)`;
    g.fillRect(r() * S, r() * S, 2, 2);
  }

  // expansion joints quartering the slab
  g.strokeStyle = 'rgba(48,44,40,0.7)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.stroke();
  g.beginPath(); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();

  // oil and boot-traffic stains
  for (let i = 0; i < 8; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 20 + r() * 60;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(${30 + r() * 14},${28 + r() * 12},24,${0.2 + r() * 0.2})`);
    grd.addColorStop(1, 'rgba(30,28,24,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // hairline cracks wandering out of the joints
  g.strokeStyle = 'rgba(42,38,34,0.55)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    let x = r() * S;
    let y = r() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (r() - 0.5) * 44;
      y += (r() - 0.5) * 44;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // darker AO ring toward the walls
  const ao = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.72);
  ao.addColorStop(0, 'rgba(20,18,16,0)');
  ao.addColorStop(1, 'rgba(20,18,16,0.4)');
  g.fillStyle = ao;
  g.fillRect(0, 0, S, S);

  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/*  Wall map — routes inked in red, the bridge circled twice.          */
/* ------------------------------------------------------------------ */

export function bunkerMap() {
  const W = 512;
  const H = 384;
  const [c, g] = makeCanvas(W, H);
  const r = seeded(23);

  // aged paper
  const paper = g.createLinearGradient(0, 0, W, H);
  paper.addColorStop(0, 'rgb(201,191,164)');
  paper.addColorStop(1, 'rgb(178,166,138)');
  g.fillStyle = paper;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 10; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 16 + r() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(140,120,80,0.14)');
    grd.addColorStop(1, 'rgba(140,120,80,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // fold creases
  g.strokeStyle = 'rgba(110,98,72,0.5)';
  g.lineWidth = 2;
  [W / 3, (2 * W) / 3].forEach((x) => {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  });
  g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();

  // survey grid
  g.strokeStyle = 'rgba(96,104,110,0.3)';
  g.lineWidth = 1;
  for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

  // terrain — wooded patches
  for (let i = 0; i < 7; i++) {
    g.fillStyle = 'rgba(96,110,70,0.3)';
    g.beginPath();
    g.ellipse(r() * W, r() * H, 24 + r() * 50, 18 + r() * 36, r() * 3, 0, Math.PI * 2);
    g.fill();
  }

  // the river, top to bottom
  const river: [number, number][] = [];
  let rx = W * 0.62;
  for (let y = -10; y <= H + 10; y += 24) {
    rx += (r() - 0.5) * 30;
    river.push([rx, y]);
  }
  g.strokeStyle = 'rgba(88,110,124,0.8)';
  g.lineWidth = 9;
  g.beginPath();
  river.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();

  // roads
  g.strokeStyle = 'rgba(72,66,58,0.75)';
  g.lineWidth = 3;
  [[0, H * 0.3, W, H * 0.42], [W * 0.2, 0, W * 0.32, H], [0, H * 0.78, W, H * 0.62]].forEach(([x0, y0, x1, y1]) => {
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  });

  // towns
  g.fillStyle = 'rgba(56,52,46,0.9)';
  [[W * 0.24, H * 0.32], [W * 0.5, H * 0.66], [W * 0.82, H * 0.26], [W * 0.14, H * 0.74]].forEach(([x, y]) => {
    g.fillRect(x - 4, y - 4, 8, 8);
  });

  // the route, inked in red by hand — crosses the river at the bridge
  const bx = W * 0.6;
  const by = H * 0.4;
  g.strokeStyle = 'rgba(150,36,28,0.9)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(W * 0.12, H * 0.82);
  g.quadraticCurveTo(W * 0.3, H * 0.6, bx - 40, by + 24);
  g.lineTo(bx, by);
  g.lineTo(bx + 60, by - 30);
  g.quadraticCurveTo(W * 0.82, H * 0.2, W * 0.9, H * 0.12);
  g.stroke();
  // second, fainter fallback route
  g.strokeStyle = 'rgba(150,36,28,0.45)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(W * 0.12, H * 0.82);
  g.quadraticCurveTo(W * 0.42, H * 0.9, W * 0.7, H * 0.7);
  g.stroke();

  // the bridge crossing, circled twice
  g.strokeStyle = 'rgba(150,36,28,0.85)';
  g.lineWidth = 2.5;
  g.beginPath(); g.ellipse(bx, by, 22, 15, 0.2, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.ellipse(bx + 2, by - 1, 27, 19, -0.15, 0, Math.PI * 2); g.stroke();

  // red X marks — places not to go back to
  g.lineWidth = 3;
  [[W * 0.24, H * 0.32], [W * 0.82, H * 0.26]].forEach(([x, y]) => {
    g.beginPath(); g.moveTo(x - 7, y - 7); g.lineTo(x + 7, y + 7); g.stroke();
    g.beginPath(); g.moveTo(x + 7, y - 7); g.lineTo(x - 7, y + 7); g.stroke();
  });

  // legend box
  g.fillStyle = 'rgba(201,191,164,0.9)';
  g.fillRect(W - 128, H - 74, 116, 62);
  g.strokeStyle = 'rgba(72,66,58,0.8)';
  g.lineWidth = 2;
  g.strokeRect(W - 128, H - 74, 116, 62);
  g.fillStyle = 'rgb(64,58,50)';
  g.font = 'bold 12px monospace';
  g.fillText('SECTOR 7', W - 118, H - 56);
  g.strokeStyle = 'rgba(150,36,28,0.9)';
  g.beginPath(); g.moveTo(W - 118, H - 42); g.lineTo(W - 86, H - 42); g.stroke();
  g.font = '10px monospace';
  g.fillText('route', W - 80, H - 38);
  g.fillText('scale 1:50k', W - 118, H - 22);

  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/*  Newspaper front page — the last edition anyone printed.            */
/* ------------------------------------------------------------------ */

export function newspaperFront() {
  const W = 384;
  const H = 512;
  const [c, g] = makeCanvas(W, H);
  const r = seeded(7);

  g.fillStyle = 'rgb(214,208,190)';
  g.fillRect(0, 0, W, H);
  // yellowed blotches
  for (let i = 0; i < 8; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 20 + r() * 50;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(170,150,104,0.16)');
    grd.addColorStop(1, 'rgba(170,150,104,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  const ink = 'rgb(46,42,38)';
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.font = 'bold 42px Georgia, serif';
  g.fillText('THE HERALD', W / 2, 52);
  g.font = '12px Georgia, serif';
  g.fillText('TUESDAY · FINAL EDITION · 1 CREDIT', W / 2, 72);
  g.fillRect(16, 82, W - 32, 3);
  g.fillRect(16, 88, W - 32, 1);

  // the headline
  g.font = 'bold 44px Georgia, serif';
  g.fillText('GRID DOWN —', W / 2, 136);
  g.fillText('CITY EVACUATES', W / 2, 182);
  g.font = 'italic 15px Georgia, serif';
  g.fillText('authorities urge calm as the last trains leave the yards', W / 2, 208);
  g.fillRect(16, 220, W - 32, 1);

  // halftone photo — a crowd on a platform, more or less
  g.fillStyle = 'rgb(150,144,132)';
  g.fillRect(20, 232, 168, 118);
  for (let i = 0; i < 60; i++) {
    const v = 60 + r() * 90;
    g.fillStyle = `rgba(${v},${v},${v * 0.94},0.7)`;
    g.fillRect(22 + r() * 160, 236 + r() * 108, 4 + r() * 14, 4 + r() * 12);
  }
  g.fillStyle = ink;
  g.font = '10px Georgia, serif';
  g.textAlign = 'left';
  g.fillText('Central Station, 05:40 — staff photo', 20, 362);

  // body columns — greeked text
  g.strokeStyle = 'rgba(70,64,56,0.8)';
  g.lineWidth = 2;
  const cols: [number, number, number][] = [
    [200, 236, 168], // beside the photo
    [20, 380, 168],
    [200, 380, 168],
  ];
  cols.forEach(([x, y0, w]) => {
    for (let y = y0; y < H - 24; y += 9) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w * (0.55 + r() * 0.45), y);
      g.stroke();
    }
  });

  // below the fold: the crossword nobody finished
  g.strokeStyle = 'rgba(70,64,56,0.7)';
  g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(322, 440 + i * 12); g.lineTo(370, 440 + i * 12); g.stroke();
    g.beginPath(); g.moveTo(322 + i * 12, 440); g.lineTo(322 + i * 12, 488); g.stroke();
  }
  g.fillStyle = 'rgba(46,42,38,0.85)';
  [[322, 440], [346, 452], [334, 476]].forEach(([x, y]) => g.fillRect(x, y, 12, 12));

  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/*  Emergency-instructions poster — civil defense boilerplate.         */
/* ------------------------------------------------------------------ */

export function emergencyPoster() {
  const W = 256;
  const H = 384;
  const [c, g] = makeCanvas(W, H);
  const r = seeded(41);

  g.fillStyle = 'rgb(168,154,92)';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgb(52,48,40)';
  g.lineWidth = 6;
  g.strokeRect(8, 8, W - 16, H - 16);

  // header band
  g.fillStyle = 'rgb(52,48,40)';
  g.fillRect(8, 8, W - 16, 54);
  g.fillStyle = 'rgb(202,192,150)';
  g.textAlign = 'center';
  g.font = 'bold 24px monospace';
  g.fillText('CIVIL DEFENSE', W / 2, 34);
  g.font = 'bold 14px monospace';
  g.fillText('SHELTER PROCEDURES', W / 2, 54);

  // warning triangle
  g.strokeStyle = 'rgb(52,48,40)';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(W / 2, 84);
  g.lineTo(W / 2 - 34, 140);
  g.lineTo(W / 2 + 34, 140);
  g.closePath();
  g.stroke();
  g.fillStyle = 'rgb(52,48,40)';
  g.font = 'bold 36px monospace';
  g.fillText('!', W / 2, 134);

  // numbered instruction rows — the words hardly matter anymore
  g.textAlign = 'left';
  for (let i = 0; i < 6; i++) {
    const y = 172 + i * 32;
    g.fillStyle = 'rgb(52,48,40)';
    g.font = 'bold 16px monospace';
    g.fillText(`${i + 1}.`, 22, y + 6);
    g.strokeStyle = 'rgba(60,54,44,0.85)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(46, y); g.lineTo(46 + (W - 76) * (0.6 + r() * 0.4), y); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(46, y + 10); g.lineTo(46 + (W - 76) * (0.3 + r() * 0.4), y + 10); g.stroke();
  }
  g.font = 'bold 11px monospace';
  g.textAlign = 'center';
  g.fillText('REMAIN CALM · REMAIN BELOW', W / 2, H - 22);

  // sun-faded corner
  const fade = g.createRadialGradient(W, 0, 0, W, 0, 180);
  fade.addColorStop(0, 'rgba(220,210,170,0.4)');
  fade.addColorStop(1, 'rgba(220,210,170,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, W, H);

  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/*  Stencil label — spray-through lettering for crates and plates.     */
/* ------------------------------------------------------------------ */

export function stencilLabel(text: string, color = '#c9c4ae') {
  const W = 256;
  const H = 64;
  const [c, g] = makeCanvas(W, H);
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  const r = seeded(h || 1);

  g.fillStyle = color;
  g.textAlign = 'center';
  g.font = 'bold 34px "Courier New", monospace';
  g.fillText(text.toUpperCase(), W / 2, 44);

  // stencil bridges + chipped paint
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
  }
  for (let x = 20; x < W - 20; x += 24 + r() * 16) {
    g.fillRect(x, 12, 2, 40);
  }
  g.globalCompositeOperation = 'source-over';

  return toTexture(c);
}
