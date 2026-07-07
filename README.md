# Abdullah Shibib — Command Center Portfolio

A cinematic 3D portfolio built with **Next.js + TypeScript + React Three Fiber**.

Decades after the collapse, nature has reclaimed the city. In a golden-hour meadow of
ruins — ivy-covered towers, a collapsed highway overpass, grazing deer, a slithering
snake — an abandoned emergency command center still quietly hums. An empty, dust-filmed
chair sits pushed back from a scaffold wall of seven live monitors; a dusty PC tower's
RGB fans cycle in the dark. Click any monitor (or use the nav chips) and the camera
flies in with a CRT power-on flicker; the screen expands into a full, crisp DOM panel.
Press `Esc` to fade smoothly back into the room.

The desk itself is interactive — drag the coffee mug or loose papers and they spring
back with real inertia, click the notebook to flip it open, switch on the flashlight
or the radio, spin a USB drive, wake a dead phone for a few seconds.

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

Everything content-related (links, skills, timeline, projects fallback) lives in
`lib/data.ts`. The **Projects** monitor scans a local `GitHub Projects` folder
live via an API route — see [Dynamic projects](#dynamic-projects) below.

Dev flags: `/?fast=1` skips the boot intro; `&focus=<monitor-id>` deep-links a monitor
(e.g. `network`, `github`, `ml`, `projects`, `timeline`, `skills`, `contact`).

## The monitors

| Monitor | Shows |
| --- | --- |
| **Global Telemetry** | An interactive orthographic globe — drag to rotate with inertia, scroll to zoom, hover a node for city/latency/uptime, click to trace its routes. Fictional-but-technically-believable distributed-systems telemetry (deploys, build health, SLOs) — not real employer data. |
| **CI/CD & Pipelines** | A live-generated GitHub contribution heatmap, recent commits, and language split. |
| **Capabilities** | Rotating tech icons with proficiency bars. |
| **NoLife RP Command** | Leadership dashboard for a 100+ concurrent-player FiveM server — population curve, systems status, Stripe/ops metrics. |
| **Mission Log** | Career timeline: education, internships, and leadership milestones. |
| **Deployments** | Project cards generated live from a local folder (see below). |
| **Uplink** | Contact links + resume download. |

## Dynamic projects

`app/api/projects/route.ts` scans a `GitHub Projects` folder on disk on every
request — no hardcoded project cards. For each subfolder it:

- reads `README.md` for a one-line description,
- reads `.git/config` for the real GitHub remote URL,
- infers the tech stack from file extensions and README keywords.

Drop a new cloned repo into that folder and it appears on the next request, styling
and animation included. Set `GITHUB_PROJECTS_DIR` to point elsewhere; it falls back
to `~/OneDrive/Desktop/GitHub Projects` otherwise, and to a static list in
`lib/data.ts` if the folder isn't found.

## Architecture

```
app/
  api/projects/   Route handler that scans the GitHub Projects folder live
  layout.tsx      Fonts (Inter, Orbitron, JetBrains Mono) + global CSS
components/
  Experience      <Canvas>, Sky, fog, postprocessing (DOF, bloom, vignette)
  CameraRig       GSAP flights to monitors, idle breathing, mouse parallax
  Room            Ruined skyline, brick facades, highway overpass, vegetation,
                  atmosphere (pollen, leaves, smoke, god rays), the survivor camp
  Wildlife        Deer, rabbits, fox, raccoon, snake, birds, butterflies, dragonflies
                  — all procedural motion, no baked animation loops
  DeskArea        Draggable desk props, the PC tower, the empty ergonomic chair
  MonitorWall     7 monitors — frames are meshes, screens are drei <Html transform>,
                  each with an independently-toggleable clip-on light bar
  HUD             DOM overlay: boot sequence, nav, hints, expanded panels
  screens/        One dashboard per monitor — pure SVG/CSS, mini + expanded variants
lib/
  data.ts         Content, monitor layout, camera math, seeded PRNG
  textures.ts     Procedural canvas textures — brick facades, asphalt, grass, foliage
  store.ts        Zustand state (focused monitor, transitions, hints)
```

## Text sharpness

No text is ever rasterized into the WebGL canvas. In-world screens are DOM elements
projected into 3D via drei's `<Html transform>` (world size = px × distanceFactor / 400),
and expanded panels are plain DOM — so type stays crystal clear at every zoom level.
The camera rig updates at `useFrame` priority −1 and refreshes `matrixWorldInverse` so
DOM screens never lag a frame behind the WebGL during camera flights.

## Performance choices

- The entire Three.js bundle is code-split behind `next/dynamic` (`ssr: false`).
- Instanced meshes (frustum-culling disabled) for grass, foliage, and debris — dense
  vegetation stays fully rendered instead of popping in and out at the edges.
- Procedural canvas textures (`lib/textures.ts`) replace downloaded assets for brick
  facades, asphalt, and foliage — deterministic per seed, no network requests.
- `MeshReflectorMaterial` for the ground puddles; capped `dpr`, `antialias: false`
  (bloom + vignette hide the aliasing).
- Seeded PRNG (`lib/data.ts#seeded`) keeps every "random" dashboard and vegetation
  layout stable across re-renders.
- `prefers-reduced-motion` respected for all DOM animation.
