"use client";

import { useEffect, useRef, useState, useTransition } from "react";

const COLS = 53;
const ROWS = 7;
const CELL = 12;
const GAP = 2;
const STEP = CELL + GAP;
const PAC_R = 7;
const PAD_L = 38;
const PAD_T = 32;
const SVG_W = PAD_L + COLS * STEP + 20;
const SVG_H = PAD_T + ROWS * STEP + 16;
const SPEED_PRESETS = { quarter: 40, half: 80, threequarter: 120, full: 160 };

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DARK_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const LIGHT_COLORS = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
const EMPTY_DATA = Array.from({ length: COLS * ROWS }, () => ({
  date: "2000-01-01",
  count: 0,
  level: 0,
}));

const cellCX = (col) => PAD_L + col * STEP + CELL / 2;
const cellCY = (row) => PAD_T + row * STEP + CELL / 2;
const cellKey = (col, row) => `${col},${row}`;
const DIRS = [
  [1, 0, "right"],
  [-1, 0, "left"],
  [0, 1, "down"],
  [0, -1, "up"],
];
const PAC_PIXEL = 1.35;
const EAT_EFFECT_DURATION = 380;
const PACMAN_PATTERNS = {
  open: [
    "0000111110000",
    "0011111111100",
    "0111111111110",
    "1111111111111",
    "1111111100000",
    "1111110000000",
    "1111000000000",
    "1111110000000",
    "1111111100000",
    "1111111111111",
    "0111111111110",
    "0011111111100",
    "0000111110000",
  ],
  half: [
    "0000111110000",
    "0011111111100",
    "0111111111110",
    "1111111111111",
    "1111111111111",
    "1111111000000",
    "1111110000000",
    "1111111000000",
    "1111111111111",
    "1111111111111",
    "0111111111110",
    "0011111111100",
    "0000111110000",
  ],
  closed: [
    "0000111110000",
    "0011111111100",
    "0111111111110",
    "1111111111111",
    "1111111111111",
    "1111111111111",
    "1111111111111",
    "1111111111111",
    "1111111111111",
    "1111111111111",
    "0111111111110",
    "0011111111100",
    "0000111110000",
  ],
};

function aStar(startCol, startRow, goalCol, goalRow) {
  const h = (c, r) => Math.abs(c - goalCol) + Math.abs(r - goalRow);
  const key = (c, r) => c * 100 + r;
  const open = [];
  const gScore = new Map();
  const parent = new Map();
  const dirMap = new Map();
  const sk = key(startCol, startRow);

  gScore.set(sk, 0);
  open.push({ c: startCol, r: startRow, f: h(startCol, startRow) });

  let iterations = 0;
  const maxIterations = COLS * ROWS * 8;

  while (open.length > 0 && iterations++ < maxIterations) {
    open.sort((a, b) => a.f - b.f);
    const { c, r } = open.shift();
    const ck = key(c, r);

    if (c === goalCol && r === goalRow) {
      const path = [];
      let cur = ck;

      while (parent.has(cur)) {
        const pc = Math.floor(cur / 100);
        const pr = cur % 100;
        path.unshift({ col: pc, row: pr, dir: dirMap.get(cur) });
        cur = parent.get(cur);
      }

      return path;
    }

    for (const [dc, dr, dir] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;

      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) {
        continue;
      }

      const nk = key(nc, nr);
      const ng = (gScore.get(ck) ?? Infinity) + 1;

      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        parent.set(nk, ck);
        dirMap.set(nk, dir);
        open.push({ c: nc, r: nr, f: ng + h(nc, nr) });
      }
    }
  }

  return [];
}

function toPixelPath(nodes) {
  return nodes.map((node) => ({
    x: cellCX(node.col),
    y: cellCY(node.row),
    col: node.col,
    row: node.row,
    dir: node.dir,
  }));
}

function getContributionAt(contributions, col, row) {
  return contributions[col * ROWS + row] || { date: "2000-01-01", count: 0, level: 0 };
}

function getTargetCells(contributions) {
  const targets = new Set();

  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const contribution = getContributionAt(contributions, col, row);

      if (contribution.level > 0) {
        targets.add(cellKey(col, row));
      }
    }
  }

  return targets;
}


const GHOST_COLORS = { 1: "#6edff6", 2: "#FFB8FF", 3: "#FFB852", 4: "#FF0000" };

function SmallGhost({ cx, cy, level }) {
  const color = GHOST_COLORS[Math.min(Math.max(level, 1), 4)];
  const s = PAC_R * 2 - 1;
  const x = cx - s / 2;
  const y = cy - s / 2;
  return (
    <g>
      <path
        d={`M${x+0.7},${y+s} L${x+0.7},${y+s*0.44}
           Q${x+0.7},${y} ${cx},${y}
           Q${x+s-0.7},${y} ${x+s-0.7},${y+s*0.44}
           L${x+s-0.7},${y+s} L${x+s*0.82},${y+s*0.76}
           L${x+s*0.64},${y+s} L${cx},${y+s*0.76}
           L${x+s*0.36},${y+s} L${x+s*0.18},${y+s*0.76} Z`}
        fill={color}
        opacity={0.92}
      />
      <ellipse cx={cx - s * 0.18} cy={y + s * 0.37} rx="1.3" ry="1.4" fill="white" />
      <ellipse cx={cx + s * 0.18} cy={y + s * 0.37} rx="1.3" ry="1.4" fill="white" />
      <circle cx={cx - s * 0.12} cy={y + s * 0.42} r="0.6" fill="#111" />
      <circle cx={cx + s * 0.24} cy={y + s * 0.42} r="0.6" fill="#111" />
    </g>
  );
}

function Ghost({ x, y, color }) {
  const size = 14;
  return (
    <g transform={`translate(${x - size / 2}, ${y - size / 2})`}>
      <path
        d={`M0.8,${size} L0.8,${size*0.44} Q0.8,0 ${size/2},0 Q${size-0.8},0 ${size-0.8},${size*0.44}
            L${size-0.8},${size} L${size*0.83},${size*0.76} L${size*0.67},${size}
            L${size*0.5},${size*0.76} L${size*0.33},${size} L${size*0.17},${size*0.76} Z`}
        fill={color}
      />
      <ellipse cx={size*0.32} cy={size*0.38} rx="2.9" ry="3.1" fill="white" />
      <ellipse cx={size*0.68} cy={size*0.38} rx="2.9" ry="3.1" fill="white" />
      <circle cx={size*0.38} cy={size*0.44} r="1.4" fill="#111" />
      <circle cx={size*0.74} cy={size*0.44} r="1.4" fill="#111" />
      <circle cx={size*0.32} cy={size*0.3} r="0.7" fill="white" opacity="0.5" />
      <circle cx={size*0.68} cy={size*0.3} r="0.7" fill="white" opacity="0.5" />
    </g>
  );
}

function EatenGhostEffect({ x, y, progress }) {
  const driftX = progress * 5;
  const driftY = progress * -4;
  const opacity = 1 - progress;

  return (
    <g transform={`translate(${x + driftX}, ${y + driftY})`} opacity={opacity}>
      <ellipse cx="-2.8" cy="-1.3" rx="2.1" ry="2.4" fill="white" />
      <ellipse cx="2.8" cy="-1.3" rx="2.1" ry="2.4" fill="white" />
      <circle cx="-1.9" cy="-0.6" r="0.95" fill="#111" />
      <circle cx="3.7" cy="-0.6" r="0.95" fill="#111" />
      <text x="8" y="2" fill="#7dd3fc" fontSize="5" fontFamily="'Press Start 2P'">
        200
      </text>
    </g>
  );
}

function PacMan({ x, y, dir, mouth }) {
  const rotate = { right: 0, left: 180, down: 90, up: 270 }[dir] ?? 0;
  const frame = mouth > 26 ? "open" : mouth > 12 ? "half" : "closed";
  const pattern = PACMAN_PATTERNS[frame];
  const width = pattern[0].length;
  const height = pattern.length;
  const offsetX = x - (width * PAC_PIXEL) / 2;
  const offsetY = y - (height * PAC_PIXEL) / 2;

  return (
    <g transform={`rotate(${rotate},${x},${y})`}>
      <g shapeRendering="crispEdges">
        {pattern.flatMap((row, rowIndex) =>
          row.split("").map((cell, colIndex) =>
            cell === "1" ? (
              <rect
                key={`${rowIndex}-${colIndex}`}
                x={offsetX + colIndex * PAC_PIXEL}
                y={offsetY + rowIndex * PAC_PIXEL}
                width={PAC_PIXEL}
                height={PAC_PIXEL}
                fill="#ffea00"
              />
            ) : null,
          ),
        )}
        <rect x={offsetX + PAC_PIXEL * 4.25} y={offsetY + PAC_PIXEL * 3.2} width={PAC_PIXEL * 1.5} height={PAC_PIXEL * 1.5} fill="#111" />
        <rect x={offsetX + PAC_PIXEL * 4.7} y={offsetY + PAC_PIXEL * 3.55} width={PAC_PIXEL * 0.5} height={PAC_PIXEL * 0.5} fill="white" opacity="0.75" />
      </g>
    </g>
  );
}


export default function HomePage() {
  const [username, setUsername] = useState("skp8500");
  const [inputValue, setInputValue] = useState("skp8500");
  const [theme, setTheme] = useState("dark");
  const [copied, setCopied] = useState("");
  const [apiState, setApiState] = useState({
    source: "svg",
    cached: false,
    generatedAt: null,
    totalContributions: 0,
  });
  const [contributions, setContributions] = useState(EMPTY_DATA);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const [pacPos, setPacPos] = useState({ x: cellCX(0), y: cellCY(0) });
  const [pacDir, setPacDir] = useState("right");
  const [mouth, setMouth] = useState(35);
  const [eaten, setEaten] = useState({});
  const [score, setScore] = useState(0);
  const [remaining, setRemaining] = useState(COLS * ROWS);
  const [trail, setTrail] = useState([]);
  const [gameSpeed, setGameSpeed] = useState("half");
  const [eatEffects, setEatEffects] = useState([]);
  const [origin, setOrigin] = useState("https://YOUR-DEPLOYED-URL");

  const eatenRef = useRef({});
  const scoreRef = useRef(0);
  const mouthRef = useRef(35);
  const mouthDirectionRef = useRef(-1);
  const lastTimestampRef = useRef(null);
  const frameRef = useRef(null);
  const pacCellRef = useRef({ col: 0, row: 0 });
  const segmentRef = useRef([]);
  const segmentIndexRef = useRef(0);
  const segmentProgressRef = useRef(0);
  const remainingCellsRef = useRef(null);
  const historyRef = useRef([]);
  const totalTargetsRef = useRef(0);
  const currentTargetRef = useRef(null);
  const pacDirRef = useRef("right");
  const speedRef = useRef(SPEED_PRESETS.half);
  const animateRef = useRef(null);

  function pickNearestTarget(fromCol, fromRow) {
    const remaining = [...remainingCellsRef.current];
    if (remaining.length === 0) return null;

    let nearestDist = Infinity;
    const candidates = [];

    for (const key of remaining) {
      const [col, row] = key.split(",").map(Number);
      const dist = Math.abs(col - fromCol) + Math.abs(row - fromRow);

      if (dist < nearestDist) {
        nearestDist = dist;
        candidates.length = 0;
        candidates.push({ col, row });
      } else if (dist === nearestDist) {
        candidates.push({ col, row });
      }
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function buildPathToTarget(fromCol, fromRow) {
    const target = pickNearestTarget(fromCol, fromRow);
    if (!target) return null;
    currentTargetRef.current = target;

    const startNode = { x: cellCX(fromCol), y: cellCY(fromRow), col: fromCol, row: fromRow, dir: pacDirRef.current };

    if (target.col === fromCol && target.row === fromRow) {
      return [startNode];
    }

    const nodes = aStar(fromCol, fromRow, target.col, target.row);
    return nodes.length > 0 ? [startNode, ...toPixelPath(nodes)] : null;
  }

  function resetAnimation() {
    cancelAnimationFrame(frameRef.current);
    eatenRef.current = {};
    scoreRef.current = 0;
    mouthRef.current = 35;
    mouthDirectionRef.current = -1;
    lastTimestampRef.current = null;
    pacCellRef.current = { col: 0, row: 0 };
    segmentRef.current = [];
    segmentIndexRef.current = 0;
    segmentProgressRef.current = 0;
    historyRef.current = [];
    remainingCellsRef.current = getTargetCells(contributions);
    totalTargetsRef.current = remainingCellsRef.current.size;
    currentTargetRef.current = null;
    pacDirRef.current = "right";

    setEaten({});
    setScore(0);
    setRemaining(totalTargetsRef.current);
    setTrail([]);
    setEatEffects([]);
    setPacPos({ x: cellCX(0), y: cellCY(0) });
    setPacDir("right");

    const startingContribution = getContributionAt(contributions, 0, 0);

    if (startingContribution.level > 0 && remainingCellsRef.current.has(cellKey(0, 0))) {
      eatenRef.current = { [cellKey(0, 0)]: true };
      remainingCellsRef.current.delete(cellKey(0, 0));
      scoreRef.current = startingContribution.level + 1;

      setEaten({ ...eatenRef.current });
      setScore(scoreRef.current);
      setRemaining(remainingCellsRef.current.size);
    }

    const firstSegment = buildPathToTarget(0, 0);

    if (firstSegment && firstSegment.length > 0) {
      segmentRef.current = firstSegment;
      segmentIndexRef.current = 0;
    }

    if (animateRef.current) {
      frameRef.current = requestAnimationFrame(animateRef.current);
    }
  }

  useEffect(() => {
    speedRef.current = SPEED_PRESETS[gameSpeed] ?? SPEED_PRESETS.half;
  }, [gameSpeed]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    resetAnimation();

    function animate(timestamp) {
      if (!lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
      }

      const deltaSeconds = Math.min((timestamp - lastTimestampRef.current) / 1000, 0.05);
      lastTimestampRef.current = timestamp;

      if (segmentRef.current.length === 0) {
        const { col, row } = pacCellRef.current;
        const nextSegment = buildPathToTarget(col, row);

        if (!nextSegment) {
          resetAnimation();
          return;
        }

        segmentRef.current = nextSegment;
        segmentIndexRef.current = 0;
        segmentProgressRef.current = 0;
      }

      const seg = segmentRef.current;
      let idx = segmentIndexRef.current;
      let progress = segmentProgressRef.current;
      let totalDist = speedRef.current * deltaSeconds;

      while (totalDist > 0 && idx < seg.length - 1) {
        const A = seg[idx];
        const B = seg[idx + 1];
        const stepDist = Math.hypot(B.x - A.x, B.y - A.y);

        if (stepDist === 0) { idx += 1; continue; }

        const leftInStep = stepDist * (1 - progress);

        if (totalDist >= leftInStep) {
          totalDist -= leftInStep;
          idx += 1;
          progress = 0;
        } else {
          progress += totalDist / stepDist;
          totalDist = 0;
        }
      }

      segmentIndexRef.current = idx;
      segmentProgressRef.current = progress;

      let visualX, visualY;
      let currentDir = seg[idx].dir;

      if (idx < seg.length - 1) {
        const A = seg[idx];
        const B = seg[idx + 1];
        visualX = A.x + (B.x - A.x) * progress;
        visualY = A.y + (B.y - A.y) * progress;
        currentDir = seg[idx + 1].dir;
      } else {
        visualX = seg[idx].x;
        visualY = seg[idx].y;
      }

      pacCellRef.current = { col: seg[idx].col, row: seg[idx].row };

      const currentCellKey = cellKey(seg[idx].col, seg[idx].row);
      const contribution = getContributionAt(contributions, seg[idx].col, seg[idx].row);

      if (contribution.level > 0 && !eatenRef.current[currentCellKey]) {
        eatenRef.current = { ...eatenRef.current, [currentCellKey]: true };
        remainingCellsRef.current.delete(currentCellKey);
        scoreRef.current += contribution.level + 1;
        setEaten({ ...eatenRef.current });
        setScore(scoreRef.current);
        setRemaining(remainingCellsRef.current.size);
        setEatEffects((previous) => [
          ...previous.filter((effect) => timestamp - effect.createdAt < EAT_EFFECT_DURATION),
          {
            id: `${currentCellKey}-${timestamp}`,
            x: cellCX(seg[idx].col),
            y: cellCY(seg[idx].row),
            createdAt: timestamp,
          },
        ]);
      }

      if (idx >= seg.length - 1) {
        const nextSegment = buildPathToTarget(seg[idx].col, seg[idx].row);

        if (!nextSegment) {
          resetAnimation();
          return;
        }

        segmentRef.current = nextSegment;
        segmentIndexRef.current = 0;
        segmentProgressRef.current = 0;
      }

      // Mouth: open into a bigger V-shaped bite only right before Pac-Man reaches a ghost.
      const distToTarget = currentTargetRef.current
        ? Math.abs(seg[idx].col - currentTargetRef.current.col) + Math.abs(seg[idx].row - currentTargetRef.current.row)
        : 99;
      const nextNode = seg[Math.min(idx + 1, seg.length - 1)];
      const isApproachingTarget =
        currentTargetRef.current &&
        nextNode &&
        nextNode.col === currentTargetRef.current.col &&
        nextNode.row === currentTargetRef.current.row &&
        progress > 0.45;

      if (distToTarget === 0 || isApproachingTarget) {
        mouthRef.current = 42;
      } else {
        mouthRef.current += mouthDirectionRef.current * deltaSeconds * 480;
        if (mouthRef.current <= 5) { mouthRef.current = 5; mouthDirectionRef.current = 1; }
        if (mouthRef.current >= 38) { mouthRef.current = 38; mouthDirectionRef.current = -1; }
      }

      setMouth(mouthRef.current);
      setPacPos({ x: visualX, y: visualY });
      setPacDir(currentDir);
      pacDirRef.current = currentDir;

      historyRef.current.push({ x: visualX, y: visualY, timestamp });
      if (historyRef.current.length > 200) historyRef.current.shift();

      const recentTrail = historyRef.current.slice(-14).map((point, index, collection) => ({
        x: point.x,
        y: point.y,
        age: collection.length - 1 - index,
      }));

      setTrail(recentTrail);
      setEatEffects((previous) =>
        previous.filter((effect) => timestamp - effect.createdAt < EAT_EFFECT_DURATION),
      );
      frameRef.current = requestAnimationFrame(animate);
    }

    animateRef.current = animate;
    frameRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameRef.current);
  }, [contributions]);

  useEffect(() => {
    async function loadContributions() {
      setErrorMessage("");

      try {
        const response = await fetch(`/api/contributions/${encodeURIComponent(username)}`, {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load contributions.");
        }

        startTransition(() => {
          setContributions(Array.isArray(payload.contributions) ? payload.contributions : EMPTY_DATA);
          setApiState({
            source: payload.source || "svg",
            cached: Boolean(payload.cached),
            generatedAt: payload.generatedAt || null,
            totalContributions: Number(payload.totalContributions) || 0,
          });
        });
      } catch (error) {
        startTransition(() => {
          setContributions(EMPTY_DATA);
          setApiState({
            source: "unavailable",
            cached: false,
            generatedAt: null,
            totalContributions: 0,
          });
          setErrorMessage(error.message || "Failed to load contributions.");
        });
      }
    }

    loadContributions();
  }, [username]);

  const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
  const background = theme === "dark" ? "#0d1117" : "#f6f8fa";
  const textColor = theme === "dark" ? "#8b949e" : "#57606a";
  const borderColor = theme === "dark" ? "#21262d" : "#d0d7de";
  const appBackground = theme === "dark" ? "#050810" : "#f0f6fc";
  const cardBackground = theme === "dark" ? "#0d1117" : "#fff";
  const totalCells = totalTargetsRef.current || getTargetCells(contributions).size;
  const eatenCount = Object.keys(eaten).length;
  const percentage = totalCells > 0 ? Math.round((eatenCount / totalCells) * 100) : 100;
  const apiUrl = `/api/contributions/${username}`;
  const monthPositions = [];

  let lastMonth = -1;

  for (let col = 0; col < COLS; col += 1) {
    const contribution = contributions[col * ROWS];

    if (!contribution?.date || contribution.date === "2000-01-01") {
      continue;
    }

    const month = new Date(contribution.date).getMonth();

    if (month !== lastMonth) {
      monthPositions.push({ label: MONTH_LABELS[month], col });
      lastMonth = month;
    }
  }

  function submitUsername() {
    const trimmed = inputValue.trim();

    if (trimmed) {
      setUsername(trimmed);
    }
  }

  function copy(text, key) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  const deployedUrl = origin;
  const workflowYaml = [
    "name: Generate Pac-Man",
    "",
    "on:",
    "  schedule:",
    '    - cron: "17 3 * * *"',
    '    - cron: "47 15 * * *"',
    "",
    "  workflow_dispatch:",
    "",
    "permissions:",
    "  contents: write",
    "",
    "concurrency:",
    "  group: generate-pacman-svg",
    "  cancel-in-progress: true",
    "",
    "jobs:",
    "  generate:",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 15",
    "",
    "    steps:",
    "      - uses: actions/checkout@v5",
    "",
    "      - uses: skp8500/PAC-CONTRIBUTIONS@main",
    "        with:",
    "          github_token: ${{ secrets.GITHUB_TOKEN }}",
  ].join("\n");
  const darkReadmeHtml = `<img alt="Pac-Man contribution graph"\n     src="https://raw.githubusercontent.com/${username}/${username}/output/pacman-dark.svg?v=1" />`;
  const adaptiveReadmeHtml = [
    "<picture>",
    '  <source media="(prefers-color-scheme: dark)"',
    `          srcset="https://raw.githubusercontent.com/${username}/${username}/output/pacman-dark.svg" />`,
    "",
    '  <img alt="Pac-Man contribution graph"',
    `       src="https://raw.githubusercontent.com/${username}/${username}/output/pacman-light.svg" />`,
    "</picture>",
  ].join("\n");

  return (
    <div
      style={{
        fontFamily: "'Share Tech Mono', monospace",
        background: appBackground,
        minHeight: "100vh",
        color: theme === "dark" ? "#c9d1d9" : "#24292f",
        paddingBottom: 60,
      }}
    >
      <div style={{ textAlign: "center", padding: "40px 20px 30px", borderBottom: `1px solid ${borderColor}` }}>
        <svg width="52" height="52" viewBox="0 0 52 52" style={{ marginBottom: 10, filter: "drop-shadow(0 0 14px #FFD70099)" }}>
          <path d="M26,26 L50,12 A24,24 0 1,0 50,40 Z" fill="#FFD700" />
          <circle cx="17" cy="17" r="4" fill="#111" />
        </svg>
        <div
          style={{
            fontFamily: "'Press Start 2P'",
            fontSize: "clamp(13px,3vw,22px)",
            color: "#FFD700",
            letterSpacing: 2,
            textShadow: "0 0 24px #FFD70066",
            marginBottom: 10,
          }}
        >
          PAC-CONTRIBUTIONS
        </div>
        <div style={{ color: "#00fff5", fontSize: 11, letterSpacing: 5, opacity: 0.7 }}>
          // eat your github history //
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px 0" }}>
        <div style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderTop: "2px solid #FFD700", borderRadius: 4, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", background: theme === "dark" ? "#0a0e14" : "#f6f8fa", border: `1px solid ${borderColor}`, borderRadius: 3, overflow: "hidden" }}>
              <span
                style={{
                  padding: "0 10px",
                  color: textColor,
                  fontSize: 12,
                  borderRight: `1px solid ${borderColor}`,
                  whiteSpace: "nowrap",
                  alignSelf: "stretch",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                github.com/
              </span>
              <input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitUsername();
                  }
                }}
                placeholder="your-username"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#FFD700",
                  fontFamily: "'Share Tech Mono'",
                  fontSize: 15,
                  padding: "11px 13px",
                }}
              />
            </div>
            <div style={{ display: "flex", border: `1px solid ${borderColor}`, borderRadius: 3, overflow: "hidden" }}>
              {["dark", "light"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  style={{
                    background: theme === mode ? "#FFD700" : "#0a0e14",
                    border: "none",
                    color: theme === mode ? "#111" : textColor,
                    fontFamily: "'Press Start 2P'",
                    fontSize: 7,
                    padding: "0 12px",
                    cursor: "pointer",
                    transition: "all .15s",
                  }}
                >
                  {mode === "dark" ? "DARK" : "LIGHT"}
                </button>
              ))}
            </div>
            <button
              onClick={submitUsername}
              style={{
                background: "#FFD700",
                color: "#111",
                border: "none",
                fontFamily: "'Press Start 2P'",
                fontSize: 9,
                padding: "11px 18px",
                cursor: "pointer",
                borderRadius: 3,
                letterSpacing: 1,
              }}
            >
              GENERATE
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: textColor, whiteSpace: "nowrap" }}>PAC SPEED:</span>
            <div style={{ display: "flex", border: `1px solid ${borderColor}`, borderRadius: 3, overflow: "hidden" }}>
              {[
                { key: "quarter", label: "0.25×" },
                { key: "half", label: "0.5×" },
                { key: "threequarter", label: "0.75×" },
                { key: "full", label: "1×" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setGameSpeed(key); speedRef.current = SPEED_PRESETS[key]; }}
                  style={{
                    background: gameSpeed === key ? "#FFD700" : theme === "dark" ? "#0a0e14" : "#f6f8fa",
                    border: "none",
                    color: gameSpeed === key ? "#111" : textColor,
                    fontFamily: "'Press Start 2P'",
                    fontSize: 7,
                    padding: "7px 12px",
                    cursor: "pointer",
                    transition: "all .15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
          {[
            { label: "SOURCE", value: apiState.source.toUpperCase() },
            { label: "CACHE", value: apiState.cached ? "HIT" : "MISS" },
            { label: "TOTAL", value: String(apiState.totalContributions) },
            { label: "STATUS", value: isPending ? "LOADING" : errorMessage ? "ERROR" : "READY" },
          ].map((item) => (
            <div key={item.label} style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 4, padding: "12px 14px" }}>
              <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: textColor, marginBottom: 8 }}>{item.label}</div>
              <div style={{ fontFamily: "'Press Start 2P'", fontSize: 10, color: item.label === "STATUS" && errorMessage ? "#ff7b72" : "#FFD700" }}>{item.value}</div>
            </div>
          ))}
        </div>

        {errorMessage ? (
          <div style={{ background: "#2d1117", border: "1px solid #f85149", color: "#ff7b72", borderRadius: 4, padding: "12px 14px", marginBottom: 18 }}>
            {errorMessage}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "0 2px", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 9, color: "#FFD700" }}>
            SCORE: {String(score).padStart(6, "0")}
          </div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: "#00fff5" }}>
            {remaining} CELLS LEFT
          </div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: textColor }}>{percentage}% EATEN</div>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: textColor }}>
            {apiState.generatedAt ? new Date(apiState.generatedAt).toLocaleString() : "Waiting for data"}
          </div>
        </div>
        <div style={{ height: 3, background: borderColor, borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percentage}%`, background: "linear-gradient(90deg,#FFD700,#39d353)", borderRadius: 2, transition: "width .1s" }} />
        </div>

        <div style={{ marginBottom: 8, textAlign: "center", fontFamily: "'Press Start 2P'", fontSize: 9, color: textColor, letterSpacing: 4 }}>
          LIVE PREVIEW
        </div>
        <div style={{ background, border: `1px solid ${borderColor}`, borderRadius: 8, padding: "14px 10px 10px", marginBottom: 24, overflow: "hidden", position: "relative" }}>
          <div style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: textColor, marginBottom: 8, paddingLeft: 4 }}>
            <span style={{ color: "#FFD700" }}>{username}</span>&apos;s GitHub Contributions
          </div>
          <div style={{ overflowX: "auto" }}>
            <svg width={SVG_W} height={SVG_H} style={{ display: "block", minWidth: SVG_W, overflow: "visible" }}>
              {monthPositions.map(({ label, col }) => (
                <text key={col} x={PAD_L + col * STEP} y={18} fill={textColor} fontSize={9} fontFamily="monospace">
                  {label}
                </text>
              ))}

              {[1, 3, 5].map((row) => (
                <text key={row} x={2} y={PAD_T + row * STEP + CELL - 1} fill={textColor} fontSize={8} fontFamily="monospace">
                  {DAY_LABELS[row].slice(0, 3)}
                </text>
              ))}

              {Array.from({ length: COLS }, (_, col) =>
                Array.from({ length: ROWS }, (_, row) => {
                  const contribution = getContributionAt(contributions, col, row);
                  const isEaten = Boolean(eaten[cellKey(col, row)]);
                  const cx = PAD_L + col * STEP + CELL / 2;
                  const cy = PAD_T + row * STEP + CELL / 2;

                  return (
                    <g key={`cell-${col}-${row}`}>
                      <rect
                        x={PAD_L + col * STEP}
                        y={PAD_T + row * STEP}
                        width={CELL}
                        height={CELL}
                        rx={2}
                        fill={contribution.level === 0 ? colors[0] : isEaten ? background : colors[0]}
                        opacity={contribution.level === 0 ? 0.9 : isEaten ? 0.15 : 0.35}
                      />
                      {contribution.level > 0 && !isEaten && (
                        <SmallGhost cx={cx} cy={cy} level={contribution.level} />
                      )}
                    </g>
                  );
                }),
              )}

              {trail.map((point, index) => {
                const opacity = Math.max(0, 0.55 - point.age * 0.06);
                const radius = Math.max(0.5, 2.8 - point.age * 0.3);

                return <circle key={index} cx={point.x} cy={point.y} r={radius} fill="#FFD700" opacity={opacity} />;
              })}

              {eatEffects.map((effect) => (
                <EatenGhostEffect
                  key={effect.id}
                  x={effect.x}
                  y={effect.y}
                  progress={Math.min(1, (performance.now() - effect.createdAt) / EAT_EFFECT_DURATION)}
                />
              ))}

              <PacMan x={pacPos.x} y={pacPos.y} dir={pacDir} mouth={mouth} />
            </svg>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: theme === "dark" ? "#0a0e14" : "#fff", border: `2px solid #FFD70055`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 13px", background: cardBackground, borderBottom: `1px solid ${borderColor}`, fontSize: 11, color: textColor }}>
              <span style={{ color: "#FFD700", fontFamily: "'Press Start 2P'", fontSize: 8 }}>README EMBED</span>
              <span style={{ fontSize: 10, color: textColor }}>Profile README setup guide</span>
            </div>

            <div style={{ padding: "16px 16px 6px", background: theme === "dark" ? "#070b12" : "#f8f9ff", color: textColor }}>
              <div style={{ fontFamily: "'Press Start 2P'", fontSize: 8, color: "#FFD700", marginBottom: 12 }}>
                Pac-Man GitHub Contribution Graph — Setup Guide
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.7 }}>
                Transform your GitHub contribution graph into an animated Pac-Man display for your profile README.
              </p>
              <div style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 14 }}>
                <div>Features</div>
                <div>Animated Pac-Man contribution graph</div>
                <div>Dark mode support</div>
                <div>Light mode support</div>
                <div>Automatic daily updates via GitHub Actions</div>
                <div>Compatible with any GitHub profile README</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: "#00fff5", marginBottom: 8 }}>STEP 1 — CREATE YOUR GITHUB PROFILE REPOSITORY</div>
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  <div>Your GitHub profile repository must follow this format:</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>YOUR_USERNAME/YOUR_USERNAME</code></pre>
                  <div>Example:</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>{username}/{username}</code></pre>
                  <div>If the repository does not exist:</div>
                  <div>1. Go to GitHub</div>
                  <div>2. Create a new repository</div>
                  <div>3. Set the repository name as your GitHub username</div>
                  <div>4. Make the repository public</div>
                  <div>5. Initialize it with a README</div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: "#00fff5", marginBottom: 8 }}>STEP 2 — CREATE THE WORKFLOW FILE</div>
                <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 8 }}>
                  <div>Inside your profile repository, create the following file:</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>.github/workflows/pacman.yml</code></pre>
                  <div>Add the following configuration:</div>
                </div>
                <div style={{ background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", borderBottom: `1px solid ${borderColor}`, background: cardBackground }}>
                    <span style={{ fontSize: 11 }}>Workflow YAML</span>
                    <button onClick={() => copy(workflowYaml, "workflow-yml")} style={{ background: copied === "workflow-yml" ? "#39d353" : "#FFD700", border: "none", color: "#111", fontFamily: "'Press Start 2P'", fontSize: 7, padding: "4px 10px", cursor: "pointer", borderRadius: 2 }}>
                      {copied === "workflow-yml" ? "COPIED" : "COPY YAML"}
                    </button>
                  </div>
                  <pre style={{ padding: 13, overflowX: "auto", margin: 0 }}><code style={{ fontFamily: "'Share Tech Mono'", fontSize: 11, color: "#7dd3fc", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{workflowYaml}</code></pre>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: "#00fff5", marginBottom: 8 }}>STEP 3 — ENABLE WORKFLOW WRITE PERMISSIONS</div>
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  <div>Navigate to:</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>Repository → Settings → Actions → General</code></pre>
                  <div>Under Workflow permissions, enable:</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>Read and write permissions</code></pre>
                  <div>Click Save.</div>
                  <div>This permission is required for the workflow to generate and push SVG files to the output branch.</div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: "#00fff5", marginBottom: 8 }}>STEP 4 — RUN THE WORKFLOW</div>
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  <div>1. Open the Actions tab</div>
                  <div>2. Select Generate Pac-Man</div>
                  <div>3. Click Run workflow</div>
                  <div>The workflow typically completes within a minute.</div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: "#00fff5", marginBottom: 8 }}>STEP 5 — VERIFY THE OUTPUT BRANCH</div>
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  <div>After the workflow completes successfully, a new branch named:</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>output</code></pre>
                  <div>will be created.</div>
                   <div>The branch should contain:</div>
                   <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>{`pacman-dark.svg\npacman-light.svg`}</code></pre>
                 </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: "#00fff5", marginBottom: 8 }}>STEP 6 — ADD PAC-MAN TO YOUR README</div>
                <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 10 }}>Open your README.md file.</div>

                <div style={{ background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", borderBottom: `1px solid ${borderColor}`, background: cardBackground }}>
                    <span style={{ fontSize: 11 }}>Dark Mode Only HTML</span>
                    <button onClick={() => copy(darkReadmeHtml, "html-dark")} style={{ background: copied === "html-dark" ? "#39d353" : "#FFD700", border: "none", color: "#111", fontFamily: "'Press Start 2P'", fontSize: 7, padding: "4px 10px", cursor: "pointer", borderRadius: 2 }}>
                      {copied === "html-dark" ? "COPIED" : "COPY HTML"}
                    </button>
                  </div>
                  <pre style={{ padding: 13, overflowX: "auto", margin: 0 }}><code style={{ fontFamily: "'Share Tech Mono'", fontSize: 11, color: "#7dd3fc", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{darkReadmeHtml}</code></pre>
                </div>

                <div style={{ background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", borderBottom: `1px solid ${borderColor}`, background: cardBackground }}>
                    <span style={{ fontSize: 11 }}>Automatic Dark & Light Mode HTML</span>
                    <button onClick={() => copy(adaptiveReadmeHtml, "html-adaptive")} style={{ background: copied === "html-adaptive" ? "#39d353" : "#FFD700", border: "none", color: "#111", fontFamily: "'Press Start 2P'", fontSize: 7, padding: "4px 10px", cursor: "pointer", borderRadius: 2 }}>
                      {copied === "html-adaptive" ? "COPIED" : "COPY HTML"}
                    </button>
                  </div>
                  <pre style={{ padding: 13, overflowX: "auto", margin: 0 }}><code style={{ fontFamily: "'Share Tech Mono'", fontSize: 11, color: "#7dd3fc", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{adaptiveReadmeHtml}</code></pre>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: "#00fff5", marginBottom: 8 }}>EXAMPLE</div>
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  <div>If your GitHub username is:</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>{username}</code></pre>
                  <div>Use:</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>{darkReadmeHtml}</code></pre>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: "#00fff5", marginBottom: 8 }}>AUTOMATIC UPDATES</div>
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  <div>The workflow updates the graph daily using:</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>{'schedule:\n  - cron: "17 3 * * *"\n  - cron: "47 15 * * *"'}</code></pre>
                  <div>Using two off-peak schedules reduces the chance of delayed or dropped scheduled runs.</div>
                </div>
              </div>

              <div style={{ marginBottom: 6 }}>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: "#00fff5", marginBottom: 8 }}>TROUBLESHOOTING</div>
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  <div>404 Not Found</div>
                  <div>Possible causes:</div>
                  <div>The output branch has not been created yet</div>
                  <div>The workflow failed</div>
                  <div>GitHub automatically disabled scheduled workflows after 60 days with no repository activity</div>
                  <div>Solutions:</div>
                  <div>Run the workflow manually</div>
                  <div>Ensure workflow permissions are enabled</div>
                  <div>Verify that the output branch exists</div>
                  <div>Re-enable the workflow from the Actions tab if GitHub disabled its schedule</div>
                  <div style={{ marginTop: 8 }}>Workflow Permission Error</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>Settings → Actions → General → Read and write permissions</code></pre>
                  <div>Contribution Graph Not Updating</div>
                  <div>GitHub may cache SVG files aggressively.</div>
                  <div>To force a refresh, update the version parameter:</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>?v=2</code></pre>
                  <div>Example:</div>
                  <pre style={{ margin: "8px 0", padding: 10, background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, overflowX: "auto" }}><code>{`<img src="https://raw.githubusercontent.com/${username}/${username}/output/pacman-dark.svg?v=2" />`}</code></pre>
                  <div>Increase the version number whenever you want to refresh the cache.</div>
                </div>
              </div>

              <div style={{ marginTop: 16, padding: 12, border: `1px solid ${borderColor}`, borderRadius: 4, background: theme === "dark" ? "#0a0e14" : "#fff" }}>
                <div style={{ fontFamily: "'Press Start 2P'", fontSize: 7, color: "#FFD700", marginBottom: 8 }}>FINAL RESULT</div>
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  <div>Animated Pac-Man contribution graph</div>
                  <div>Dark mode support</div>
                  <div>Light mode support</div>
                  <div>Automatic daily updates</div>
                  <div>Fully automated GitHub profile animation</div>
                </div>
              </div>
            </div>
          </div>

          {[
            { key: "url", label: "API ENDPOINT", code: apiUrl },
            {
              key: "json",
              label: "RESPONSE SHAPE",
              code: JSON.stringify(
                {
                  username,
                  source: apiState.source,
                  cached: apiState.cached,
                  generatedAt: apiState.generatedAt,
                  totalContributions: apiState.totalContributions,
                  contributions: contributions.slice(0, 2),
                },
                null,
                2,
              ),
            },
          ].map((snippet) => (
            <div key={snippet.key} style={{ background: theme === "dark" ? "#0a0e14" : "#fff", border: `1px solid ${borderColor}`, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 13px", background: cardBackground, borderBottom: `1px solid ${borderColor}`, fontSize: 11, color: textColor }}>
                <span>{snippet.label}</span>
                <button
                  onClick={() => copy(snippet.code, snippet.key)}
                  style={{
                    background: "transparent",
                    border: `1px solid ${borderColor}`,
                    color: copied === snippet.key ? "#39d353" : "#00fff5",
                    fontFamily: "'Press Start 2P'",
                    fontSize: 7,
                    padding: "4px 10px",
                    cursor: "pointer",
                    borderRadius: 2,
                    transition: "all .2s",
                  }}
                >
                  {copied === snippet.key ? "COPIED" : "COPY"}
                </button>
              </div>
              <pre style={{ padding: 13, overflowX: "auto", margin: 0 }}>
                <code style={{ fontFamily: "'Share Tech Mono'", fontSize: 12, color: "#7dd3fc", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {snippet.code}
                </code>
              </pre>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 32, color: textColor, fontSize: 11, letterSpacing: 2 }}>
          BUILT BY{" "}
          <a
            href="https://github.com/skp8500"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#FFD700", textDecoration: "none" }}
          >
            skp8500
          </a>{" "}
          · OPEN SOURCE · MIT
        </div>
      </div>
    </div>
  );
}
