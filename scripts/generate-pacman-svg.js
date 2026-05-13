#!/usr/bin/env node
// Generates dist/pacman-dark.svg and dist/pacman-light.svg
// Requires Node 18+ (uses native fetch). No npm dependencies.

const fs = require('fs');
const path = require('path');

const USERNAME = process.env.GITHUB_USERNAME || process.argv[2];
const TOKEN    = process.env.GITHUB_TOKEN;

if (!USERNAME) {
  console.error('Set GITHUB_USERNAME env var or pass username as first argument');
  process.exit(1);
}
if (!TOKEN) {
  console.error('Set GITHUB_TOKEN env var');
  process.exit(1);
}

// ── Grid constants (must match page.jsx) ─────────────────────────────────────
const COLS   = 53;
const ROWS   = 7;
const CELL   = 12;
const GAP    = 2;
const STEP   = CELL + GAP;   // 14 px
const PAC_R  = 7;
const PAD_L  = 24;
const PAD_T  = 32;
const SVG_W  = PAD_L + COLS * STEP + 24;
const SVG_H  = PAD_T + ROWS * STEP + 20;
const SPEED  = 80;            // px per second (0.5× preset)

const GHOST_COLORS = ['', '#6edff6', '#FFB8FF', '#FFB852', '#FF0000'];
const MONTHS       = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function cellCX(col) { return PAD_L + col * STEP + CELL / 2; }
function cellCY(row) { return PAD_T + row * STEP + CELL / 2; }
function f(n, d = 2) { return Number(n).toFixed(d); }

// ── GitHub GraphQL ────────────────────────────────────────────────────────────
async function fetchContributions() {
  const query = `query($login:String!){
    user(login:$login){
      contributionsCollection{
        contributionCalendar{
          weeks{ contributionDays{ contributionCount date } }
        }
      }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'pacman-contributions-action',
    },
    body: JSON.stringify({ query, variables: { login: USERNAME } }),
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

// ── Nearest-neighbour traversal → waypoints + eat times ──────────────────────
function computeTraversal(grid) {
  const remaining = new Map();
  for (let col = 0; col < COLS; col++)
    for (let row = 0; row < ROWS; row++)
      if (grid[col][row] > 0) remaining.set(`${col},${row}`, { col, row });

  if (remaining.size === 0) return { waypoints: [], ghostEatTimes: new Map(), totalTime: 0 };

  const tps = STEP / SPEED;  // seconds per cell step
  const waypoints = [{ col: 0, row: 0, time: 0 }];
  const ghostEatTimes = new Map();
  let cur = { col: 0, row: 0 };
  let t   = 0;

  if (remaining.has('0,0')) { ghostEatTimes.set('0,0', 0); remaining.delete('0,0'); }

  while (remaining.size > 0) {
    // Pick nearest (deterministic: lowest col then row on tie for reproducible SVG)
    let best = null, bestDist = Infinity;
    for (const [, cell] of remaining) {
      const d = Math.abs(cell.col - cur.col) + Math.abs(cell.row - cur.row);
      if (d < bestDist || (d === bestDist && (cell.col < best.col || (cell.col === best.col && cell.row < best.row)))) {
        bestDist = d; best = cell;
      }
    }

    // Walk horizontally then vertically (horizontal-first avoids serpentine backtracking)
    let { col, row } = cur;
    while (col !== best.col) {
      col += col < best.col ? 1 : -1;
      t   += tps;
      waypoints.push({ col, row, time: t });
    }
    while (row !== best.row) {
      row += row < best.row ? 1 : -1;
      t   += tps;
      waypoints.push({ col, row, time: t });
    }

    ghostEatTimes.set(`${best.col},${best.row}`, t);
    remaining.delete(`${best.col},${best.row}`);
    cur = best;
  }

  return { waypoints, ghostEatTimes, totalTime: t };
}

// ── SVG generator ─────────────────────────────────────────────────────────────
function generateSVG(grid, weeks, traversal, isDark) {
  const { waypoints, ghostEatTimes, totalTime } = traversal;

  const bg        = isDark ? '#0d1117' : '#ffffff';
  const emptyFill = isDark ? '#161b22' : '#ebedf0';
  const textColor = isDark ? '#8b949e' : '#57606a';
  const suffix    = isDark ? 'dk' : 'lt';

  if (waypoints.length < 2) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}">
  <rect width="${SVG_W}" height="${SVG_H}" fill="${bg}" rx="6"/>
  <text x="12" y="30" font-size="11" fill="${textColor}" font-family="system-ui">No contributions this year</text>
</svg>`;
  }

  const dur = f(totalTime, 2);
  const n   = waypoints.length - 1;

  // animateMotion path + keyPoints/keyTimes for constant speed
  const motionD  = waypoints.map((w, i) => `${i === 0 ? 'M' : 'L'}${f(cellCX(w.col))},${f(cellCY(w.row))}`).join(' ');
  const keyPoints = waypoints.map((_, i) => f(i / n, 5)).join(';');
  const keyTimes  = waypoints.map(w  => f(w.time / totalTime, 5)).join(';');

  // Month labels
  let lastMonth = -1;
  const monthTags = weeks.slice(0, COLS).map((week, col) => {
    if (!week.contributionDays[0]) return '';
    const mo = new Date(week.contributionDays[0].date).getMonth();
    if (mo === lastMonth) return '';
    lastMonth = mo;
    return `<text x="${PAD_L + col * STEP}" y="14" font-size="9" fill="${textColor}" font-family="system-ui,sans-serif">${MONTHS[mo]}</text>`;
  }).join('');

  // Day labels
  const DAY_LABELS = ['Sun','','Tue','','Thu','','Sat'];
  const dayTags = DAY_LABELS.map((lbl, row) => lbl
    ? `<text x="${PAD_L - 4}" y="${f(PAD_T + row * STEP + CELL * 0.8)}" font-size="7" fill="${textColor}" font-family="system-ui" text-anchor="end">${lbl}</text>`
    : ''
  ).join('');

  // Cells + ghosts
  const cellParts = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const level = grid[col][row];
      const x  = PAD_L + col * STEP;
      const y  = PAD_T + row * STEP;
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;

      // Background tile (always drawn)
      cellParts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${emptyFill}"/>`);

      if (level > 0) {
        const key     = `${col},${row}`;
        const eatTime = ghostEatTimes.get(key) ?? totalTime;
        const eatFrac = Math.min(Math.max(eatTime / totalTime, 0.001), 0.999);
        const eps     = Math.min(0.001, eatFrac / 2, (1 - eatFrac) / 2);
        const color   = GHOST_COLORS[level];
        const s       = PAC_R * 2 - 1;   // 13 px
        const gx      = cx - s / 2;
        const gy      = cy - s / 2;

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
        const animKV = `1;1;0;0`;

        cellParts.push(`<g>
  <path d="${gPath}" fill="${color}" opacity="0.92"/>
  <ellipse cx="${f(cx - s*0.18)}" cy="${f(gy + s*0.37)}" rx="1.3" ry="1.4" fill="white"/>
  <ellipse cx="${f(cx + s*0.18)}" cy="${f(gy + s*0.37)}" rx="1.3" ry="1.4" fill="white"/>
  <circle cx="${f(cx - s*0.12)}" cy="${f(gy + s*0.42)}" r="0.6" fill="#111"/>
  <circle cx="${f(cx + s*0.24)}" cy="${f(gy + s*0.42)}" r="0.6" fill="#111"/>
  <animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" calcMode="linear" keyTimes="${animKT}" values="${animKV}"/>
</g>`);
      }
    }
  }

  // Pac-Man shape centered at (0,0) facing right
  const mRad     = (30 * Math.PI) / 180;
  const px1      =  f(PAC_R * Math.cos(mRad));
  const py1      =  f(-PAC_R * Math.sin(mRad));
  const py2      =  f( PAC_R * Math.sin(mRad));
  const openPath   = `M0,0 L${px1},${py1} A${PAC_R},${PAC_R} 0 1,1 ${px1},${py2} Z`;
  const closedPath = `M0,0 L${PAC_R},0.01 A${PAC_R},${PAC_R} 0 1,1 ${PAC_R},-0.01 Z`;

  const eyeX = f(PAC_R * 0.32);
  const eyeY = f(-PAC_R * 0.58);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
<defs>
  <radialGradient id="pg${suffix}" cx="40%" cy="35%" r="65%">
    <stop offset="0%" stop-color="#FFE55C"/>
    <stop offset="100%" stop-color="#FFA500"/>
  </radialGradient>
</defs>
<rect width="${SVG_W}" height="${SVG_H}" fill="${bg}" rx="6"/>
${monthTags}
${dayTags}
${cellParts.join('\n')}
<path id="mp${suffix}" d="${motionD}" fill="none" stroke="none" visibility="hidden"/>
<g>
  <path fill="url(#pg${suffix})">
    <animate attributeName="d" values="${openPath};${closedPath};${openPath}" dur="0.25s" repeatCount="indefinite" calcMode="linear"/>
  </path>
  <circle cx="${eyeX}" cy="${eyeY}" r="2" fill="#1a1200"/>
  <circle cx="${f(PAC_R * 0.42)}" cy="${f(-PAC_R * 0.68)}" r="0.8" fill="white" opacity="0.6"/>
  <animateMotion dur="${dur}s" repeatCount="indefinite" calcMode="linear" rotate="auto" keyPoints="${keyPoints}" keyTimes="${keyTimes}">
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

  const { waypoints, totalTime } = traversal;
  console.log(`Traversal: ${waypoints.length} waypoints | ${totalTime.toFixed(1)}s total`);

  const distDir = path.join(process.cwd(), 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, 'pacman-dark.svg'),  generateSVG(grid, weeks, traversal, true));
  fs.writeFileSync(path.join(distDir, 'pacman-light.svg'), generateSVG(grid, weeks, traversal, false));

  console.log('✓ dist/pacman-dark.svg');
  console.log('✓ dist/pacman-light.svg');
}

main().catch(err => { console.error(err.message); process.exit(1); });
