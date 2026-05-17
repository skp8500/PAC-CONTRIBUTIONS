#!/usr/bin/env node
// Generates dist/pacman-dark.svg and dist/pacman-light.svg
// Requires Node 18+ (native fetch). No npm dependencies.

const fs = require('fs');
const path = require('path');

const USERNAME = process.env.GITHUB_USERNAME || process.argv[2];
const TOKEN    = process.env.GITHUB_TOKEN;

if (!USERNAME) { console.error('Set GITHUB_USERNAME env var or pass username as arg'); process.exit(1); }
if (!TOKEN)    { console.error('Set GITHUB_TOKEN env var'); process.exit(1); }

// ── Constants (mirrors page.jsx exactly) ─────────────────────────────────────
const COLS      = 53;
const ROWS      = 7;
const CELL      = 12;
const GAP       = 2;
const STEP      = CELL + GAP;   // 14 px
const PAC_R     = 7;
const PAC_PIXEL = 1.35;
const PAD_L     = 38;           // wide left pad for day labels
const PAD_T     = 32;
const SVG_W     = PAD_L + COLS * STEP + 20;
const SVG_H     = PAD_T + ROWS * STEP + 16;
const SPEED     = 80;           // px/s (0.5× preset)

const GHOST_COLORS = ['', '#6edff6', '#FFB8FF', '#FFB852', '#FF0000'];
const MONTHS       = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Pixel-art Pac-Man frames (13 cols × 13 rows, mouth opens to the right)
const PACMAN_PATTERNS = {
  open: [
    '0000111110000',
    '0011111111100',
    '0111111111110',
    '1111111111111',
    '1111111100000',
    '1111110000000',
    '1111000000000',
    '1111110000000',
    '1111111100000',
    '1111111111111',
    '0111111111110',
    '0011111111100',
    '0000111110000',
  ],
  half: [
    '0000111110000',
    '0011111111100',
    '0111111111110',
    '1111111111111',
    '1111111111111',
    '1111111000000',
    '1111110000000',
    '1111111000000',
    '1111111111111',
    '1111111111111',
    '0111111111110',
    '0011111111100',
    '0000111110000',
  ],
  closed: [
    '0000111110000',
    '0011111111100',
    '0111111111110',
    '1111111111111',
    '1111111111111',
    '1111111111111',
    '1111111111111',
    '1111111111111',
    '1111111111111',
    '1111111111111',
    '0111111111110',
    '0011111111100',
    '0000111110000',
  ],
};

function cellCX(col) { return PAD_L + col * STEP + CELL / 2; }
function cellCY(row) { return PAD_T + row * STEP + CELL / 2; }
function f(n, d = 2)  { return Number(n).toFixed(d); }
function getSegmentRotation(from, to) {
  if (to.col > from.col) return 0;
  if (to.col < from.col) return 180;
  if (to.row > from.row) return 90;
  if (to.row < from.row) return 270;
  return 0;
}

// ── Render a pixel-art frame as SVG rects centred at (0,0) ───────────────────
function renderPacFrame(pattern) {
  const h   = pattern.length;
  const w   = pattern[0].length;
  const ox  = -(w * PAC_PIXEL) / 2;
  const oy  = -(h * PAC_PIXEL) / 2;
  const out = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (pattern[r][c] === '1') {
        out.push(`<rect x="${f(ox + c * PAC_PIXEL)}" y="${f(oy + r * PAC_PIXEL)}" width="${PAC_PIXEL}" height="${PAC_PIXEL}" fill="#ffea00"/>`);
      }
    }
  }
  return out.join('');
}

// ── GitHub GraphQL ────────────────────────────────────────────────────────────
async function fetchContributions() {
  // Rolling last 52 weeks — matches what GitHub's heatmap shows
  const to   = new Date();
  const from = new Date(to.getTime() - 52 * 7 * 24 * 60 * 60 * 1000);

  const query = `query($login:String!, $from:DateTime!, $to:DateTime!){
    user(login:$login){
      contributionsCollection(from:$from, to:$to){
        contributionCalendar{
          weeks{ contributionDays{ contributionCount date } }
        }
      }
    }
  }`;
  const res  = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'pacman-contributions-action',
    },
    body: JSON.stringify({ query, variables: { login: USERNAME, from: from.toISOString(), to: to.toISOString() } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

// ── Build 53×7 level grid ─────────────────────────────────────────────────────
function buildGrid(weeks) {
  const grid = Array.from({ length: COLS }, () => Array(ROWS).fill(0));
  weeks.slice(0, COLS).forEach((week, col) => {
    week.contributionDays.forEach((day, row) => {
      const c = day.contributionCount;
      if (c > 0) grid[col][row] = c >= 30 ? 4 : c >= 10 ? 3 : c >= 3 ? 2 : 1;
    });
  });
  return grid;
}

// ── Nearest-neighbour traversal ───────────────────────────────────────────────
function computeTraversal(grid) {
  const remaining = new Map();
  for (let col = 0; col < COLS; col++)
    for (let row = 0; row < ROWS; row++)
      if (grid[col][row] > 0) remaining.set(`${col},${row}`, { col, row });

  if (remaining.size === 0) return { waypoints: [], ghostEatTimes: new Map(), totalTime: 0 };

  const tps      = STEP / SPEED;
  const waypoints = [{ col: 0, row: 0, time: 0 }];
  const ghostEatTimes = new Map();
  let cur = { col: 0, row: 0 };
  let t   = 0;

  if (remaining.has('0,0')) { ghostEatTimes.set('0,0', 0); remaining.delete('0,0'); }

  while (remaining.size > 0) {
    let best = null, bestDist = Infinity;
    for (const [, cell] of remaining) {
      const d = Math.abs(cell.col - cur.col) + Math.abs(cell.row - cur.row);
      if (d < bestDist || (d === bestDist && (cell.col < best.col || (cell.col === best.col && cell.row < best.row)))) {
        bestDist = d; best = cell;
      }
    }
    let { col, row } = cur;
    while (col !== best.col) { col += col < best.col ? 1 : -1; t += tps; waypoints.push({ col, row, time: t }); }
    while (row !== best.row) { row += row < best.row ? 1 : -1; t += tps; waypoints.push({ col, row, time: t }); }

    ghostEatTimes.set(`${best.col},${best.row}`, t);
    remaining.delete(`${best.col},${best.row}`);
    cur = best;
  }

  return { waypoints, ghostEatTimes, totalTime: t };
}

// ── SVG generator ─────────────────────────────────────────────────────────────
function generateSVG(grid, weeks, traversal, isDark) {
  const { waypoints, ghostEatTimes, totalTime } = traversal;

  const bg        = isDark ? '#0d1117' : '#f6f8fa';
  const emptyFill = isDark ? '#161b22' : '#ebedf0';
  const textColor = isDark ? '#8b949e' : '#57606a';
  const suffix    = isDark ? 'dk' : 'lt';

  if (waypoints.length < 2) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}">
  <rect width="${SVG_W}" height="${SVG_H}" fill="${bg}" rx="6"/>
  <text x="12" y="30" font-size="11" fill="${textColor}" font-family="system-ui">No contributions this year</text>
</svg>`;
  }

  const dur  = f(totalTime, 2);
  const n    = waypoints.length - 1;

  // animateMotion path + keyPoints / keyTimes (constant speed — each step is STEP px)
  const motionD   = waypoints.map((w, i) => `${i === 0 ? 'M' : 'L'}${f(cellCX(w.col))},${f(cellCY(w.row))}`).join(' ');
  const keyPoints = waypoints.map((_, i) => f(i / n, 5)).join(';');
  const keyTimes  = waypoints.map(w  => f(w.time / totalTime, 5)).join(';');
  const rotationValues = waypoints.map((waypoint, index) => {
    const next = waypoints[index + 1] ?? waypoint;
    return String(getSegmentRotation(waypoint, next));
  }).join(';');

  // Month labels (y=18, matching page.jsx)
  let lastMonth = -1;
  const monthTags = weeks.slice(0, COLS).map((week, col) => {
    if (!week.contributionDays[0]) return '';
    const mo = new Date(week.contributionDays[0].date).getMonth();
    if (mo === lastMonth) return '';
    lastMonth = mo;
    return `<text x="${PAD_L + col * STEP}" y="18" font-size="9" fill="${textColor}" font-family="monospace">${MONTHS[mo]}</text>`;
  }).join('');

  // Day labels — Mon / Wed / Fri only, at x=2, matching page.jsx [1,3,5].map
  const dayTags = [1, 3, 5].map(row => {
    const y = PAD_T + row * STEP + CELL - 1;
    return `<text x="2" y="${y}" font-size="8" fill="${textColor}" font-family="monospace">${DAY_LABELS[row].slice(0, 3)}</text>`;
  }).join('');

  // Grid cells + ghosts
  const cellParts = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const level = grid[col][row];
      const x  = PAD_L + col * STEP;
      const y  = PAD_T + row * STEP;
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;

      cellParts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${emptyFill}" opacity="${level === 0 ? 0.9 : 0.15}"/>`);

      if (level > 0) {
        const key      = `${col},${row}`;
        const eatTime  = ghostEatTimes.get(key) ?? totalTime;
        const eatFrac  = Math.min(Math.max(eatTime / totalTime, 0.001), 0.999);
        const eps      = Math.min(0.001, eatFrac / 2, (1 - eatFrac) / 2);
        const color    = GHOST_COLORS[level];
        const s        = PAC_R * 2 - 1;   // 13 px, matching SmallGhost
        const gx       = cx - s / 2;
        const gy       = cy - s / 2;

        const gPath = [
          `M${f(gx+0.7)},${f(gy+s)}`,
          `L${f(gx+0.7)},${f(gy+s*0.44)}`,
          `Q${f(gx+0.7)},${f(gy)} ${f(cx)},${f(gy)}`,
          `Q${f(gx+s-0.7)},${f(gy)} ${f(gx+s-0.7)},${f(gy+s*0.44)}`,
          `L${f(gx+s-0.7)},${f(gy+s)}`,
          `L${f(gx+s*0.82)},${f(gy+s*0.76)}`,
          `L${f(gx+s*0.64)},${f(gy+s)}`,
          `L${f(cx)},${f(gy+s*0.76)}`,
          `L${f(gx+s*0.36)},${f(gy+s)}`,
          `L${f(gx+s*0.18)},${f(gy+s*0.76)} Z`,
        ].join(' ');

        const animKT = `0;${f(eatFrac - eps, 5)};${f(eatFrac + eps, 5)};1`;

        cellParts.push(`<g>
  <path d="${gPath}" fill="${color}" opacity="0.92"/>
  <ellipse cx="${f(cx - s*0.18)}" cy="${f(gy + s*0.37)}" rx="1.3" ry="1.4" fill="white"/>
  <ellipse cx="${f(cx + s*0.18)}" cy="${f(gy + s*0.37)}" rx="1.3" ry="1.4" fill="white"/>
  <circle cx="${f(cx - s*0.12)}" cy="${f(gy + s*0.42)}" r="0.6" fill="#111"/>
  <circle cx="${f(cx + s*0.24)}" cy="${f(gy + s*0.42)}" r="0.6" fill="#111"/>
  <animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" calcMode="linear" keyTimes="${animKT}" values="1;1;0;0"/>
</g>`);
      }
    }
  }

  // Pac-Man pixel art — three frames, each centred at (0,0)
  // CSS cycles visibility: open → half → closed → open …
  const ox    = f(-(13 * PAC_PIXEL) / 2);
  const oy_n  = -(13 * PAC_PIXEL) / 2;  // numeric for eye calc
  const eyeX  = f(oy_n + PAC_PIXEL * 4.25);   // reuse oy_n as ox_n (symmetric)
  const eyeY  = f(oy_n + PAC_PIXEL * 3.2);
  const eyeW  = f(PAC_PIXEL * 1.5);
  const glintX = f(oy_n + PAC_PIXEL * 4.7);
  const glintY = f(oy_n + PAC_PIXEL * 3.55);
  const glintS = f(PAC_PIXEL * 0.5);

  // Eye uses ox_n (same value since width = height = 13*PAC_PIXEL)
  const ox_n = -(13 * PAC_PIXEL) / 2;
  const eyeXc  = f(ox_n + PAC_PIXEL * 4.25);
  const eyeYc  = f(oy_n + PAC_PIXEL * 3.2);
  const glintXc = f(ox_n + PAC_PIXEL * 4.7);
  const glintYc = f(oy_n + PAC_PIXEL * 3.55);

  const frameOpen   = renderPacFrame(PACMAN_PATTERNS.open);
  const frameHalf   = renderPacFrame(PACMAN_PATTERNS.half);
  const frameClosed = renderPacFrame(PACMAN_PATTERNS.closed);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
<style>
  @keyframes pf-open   { 0%{opacity:1} 33%{opacity:1} 34%{opacity:0} 100%{opacity:0} }
  @keyframes pf-half   { 0%{opacity:0} 33%{opacity:0} 34%{opacity:1} 67%{opacity:1} 68%{opacity:0} 100%{opacity:0} }
  @keyframes pf-closed { 0%{opacity:0} 67%{opacity:0} 68%{opacity:1} 100%{opacity:1} }
  .pf0,.pf1,.pf2{animation-duration:0.25s;animation-iteration-count:infinite;animation-timing-function:steps(1,end)}
  .pf0{animation-name:pf-open}
  .pf1{animation-name:pf-half}
  .pf2{animation-name:pf-closed}
</style>
<rect width="${SVG_W}" height="${SVG_H}" fill="${bg}" rx="6"/>
${monthTags}
${dayTags}
${cellParts.join('\n')}
<path id="mp${suffix}" d="${motionD}" fill="none" stroke="none" visibility="hidden"/>
<g>
  <g>
    <g class="pf0" shape-rendering="crispEdges">${frameOpen}</g>
    <g class="pf1" shape-rendering="crispEdges">${frameHalf}</g>
    <g class="pf2" shape-rendering="crispEdges">${frameClosed}</g>
    <rect x="${eyeXc}" y="${eyeYc}" width="${eyeW}" height="${eyeW}" fill="#111"/>
    <rect x="${glintXc}" y="${glintYc}" width="${glintS}" height="${glintS}" fill="white" opacity="0.75"/>
    <animateTransform attributeName="transform" type="rotate" additive="sum" calcMode="discrete" keyTimes="${keyTimes}" values="${rotationValues}" dur="${dur}s" repeatCount="indefinite"/>
  </g>
  <animateMotion dur="${dur}s" repeatCount="indefinite" calcMode="linear" keyPoints="${keyPoints}" keyTimes="${keyTimes}">
    <mpath href="#mp${suffix}"/>
  </animateMotion>
</g>
</svg>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Fetching contributions for @${USERNAME}…`);
  const weeks     = await fetchContributions();
  const grid      = buildGrid(weeks);
  const traversal = computeTraversal(grid);
  console.log(`Traversal: ${traversal.waypoints.length} waypoints | ${traversal.totalTime.toFixed(1)}s`);

  const distDir = path.join(process.cwd(), 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, 'pacman-dark.svg'),  generateSVG(grid, weeks, traversal, true));
  fs.writeFileSync(path.join(distDir, 'pacman-light.svg'), generateSVG(grid, weeks, traversal, false));
  console.log('✓ dist/pacman-dark.svg');
  console.log('✓ dist/pacman-light.svg');
}

main().catch(err => { console.error(err.message); process.exit(1); });
