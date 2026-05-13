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
const SPEED = 160;

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

function Ghost({ x, y, color }) {
  const size = 13;

  return (
    <g transform={`translate(${x - size / 2}, ${y - size / 2})`}>
      <path
        d={`M1,${size} L1,${size * 0.46} Q1,0 ${size / 2},0 Q${size - 1},0 ${size - 1},${size * 0.46}
            L${size - 1},${size} L${size * 0.83},${size * 0.78} L${size * 0.67},${size}
            L${size * 0.5},${size * 0.78} L${size * 0.33},${size} L${size * 0.17},${size * 0.78} Z`}
        fill={color}
      />
      <ellipse cx={size * 0.32} cy={size * 0.38} rx="2.8" ry="3" fill="white" />
      <ellipse cx={size * 0.68} cy={size * 0.38} rx="2.8" ry="3" fill="white" />
      <circle cx={size * 0.38} cy={size * 0.43} r="1.3" fill="#111" />
      <circle cx={size * 0.74} cy={size * 0.43} r="1.3" fill="#111" />
    </g>
  );
}

function PacMan({ x, y, dir, mouth }) {
  const rotate = { right: 0, left: 180, down: 90, up: 270 }[dir] ?? 0;
  const angle = Math.max(2, mouth);
  const rad = (angle * Math.PI) / 180;
  const x1 = x + PAC_R * Math.cos(rad);
  const y1 = y - PAC_R * Math.sin(rad);
  const x2 = x + PAC_R * Math.cos(rad);
  const y2 = y + PAC_R * Math.sin(rad);
  const eyeX = x;
  const eyeY = y - PAC_R * 0.55;

  return (
    <g transform={`rotate(${rotate},${x},${y})`}>
      <circle cx={x} cy={y} r={PAC_R + 3} fill="none" stroke="#FFD700" strokeWidth="1.5" opacity="0.25" />
      {angle < 3 ? (
        <circle cx={x} cy={y} r={PAC_R} fill="#FFD700" />
      ) : (
        <path d={`M${x},${y} L${x1},${y1} A${PAC_R},${PAC_R} 0 1,1 ${x2},${y2} Z`} fill="#FFD700" />
      )}
      <circle cx={eyeX} cy={eyeY} r="1.6" fill="#1a1a00" />
    </g>
  );
}

function GameComplete({ score, onRestart, theme }) {
  const background = theme === "dark" ? "rgba(5,8,16,0.93)" : "rgba(240,246,252,0.93)";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background,
        borderRadius: 8,
        zIndex: 10,
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        style={{
          fontFamily: "'Press Start 2P'",
          fontSize: "clamp(10px,2.5vw,18px)",
          color: "#FFD700",
          textShadow: "0 0 30px #FFD700aa",
          marginBottom: 16,
          letterSpacing: 2,
          textAlign: "center",
        }}
      >
        GAME COMPLETE
      </div>
      <div style={{ fontFamily: "'Press Start 2P'", fontSize: "clamp(8px,2vw,13px)", color: "#39d353", marginBottom: 8 }}>
        100% EATEN
      </div>
      <div style={{ fontFamily: "'Press Start 2P'", fontSize: "clamp(8px,2vw,12px)", color: "#00fff5", marginBottom: 24 }}>
        FINAL SCORE: {String(score).padStart(6, "0")}
      </div>
      <button
        onClick={onRestart}
        style={{
          background: "#FFD700",
          color: "#111",
          border: "none",
          fontFamily: "'Press Start 2P'",
          fontSize: 9,
          padding: "12px 24px",
          cursor: "pointer",
          borderRadius: 3,
          letterSpacing: 1,
          boxShadow: "0 0 20px #FFD70066",
        }}
      >
        PLAY AGAIN
      </button>
    </div>
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
  const [gameOver, setGameOver] = useState(false);
  const [ghosts, setGhosts] = useState([
    { color: "#FF0000", lag: 0, x: cellCX(0), y: cellCY(0) },
    { color: "#FFB8FF", lag: 8, x: cellCX(0), y: cellCY(0) },
    { color: "#00CFCF", lag: 16, x: cellCX(0), y: cellCY(0) },
    { color: "#FFB852", lag: 24, x: cellCX(0), y: cellCY(0) },
  ]);

  const eatenRef = useRef({});
  const scoreRef = useRef(0);
  const mouthRef = useRef(35);
  const mouthDirectionRef = useRef(-1);
  const lastTimestampRef = useRef(null);
  const frameRef = useRef(null);
  const pacCellRef = useRef({ col: 0, row: 0 });
  const segmentRef = useRef([]);
  const segmentIndexRef = useRef(0);
  const remainingCellsRef = useRef(null);
  const historyRef = useRef([]);

  function pickTarget(fromCol, fromRow) {
    const remainingCells = remainingCellsRef.current;

    if (!remainingCells || remainingCells.size === 0) {
      return null;
    }

    const keys = [...remainingCells];
    const maxTries = Math.min(20, keys.length);

    for (let index = 0; index < maxTries; index += 1) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      const [targetCol, targetRow] = key.split(",").map(Number);

      if (targetCol === fromCol && targetRow === fromRow) {
        continue;
      }

      const nodes = aStar(fromCol, fromRow, targetCol, targetRow);

      if (nodes.length > 0) {
        return toPixelPath(nodes);
      }
    }

    const visited = new Set([cellKey(fromCol, fromRow)]);
    const queue = [{ col: fromCol, row: fromRow, path: [] }];

    while (queue.length > 0) {
      const current = queue.shift();

      for (const [dc, dr, dir] of DIRS) {
        const nc = current.col + dc;
        const nr = current.row + dr;

        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) {
          continue;
        }

        const nextKey = cellKey(nc, nr);

        if (visited.has(nextKey)) {
          continue;
        }

        visited.add(nextKey);
        const nextPath = [...current.path, { col: nc, row: nr, dir }];

        if (remainingCells.has(nextKey)) {
          return toPixelPath(nextPath);
        }

        queue.push({ col: nc, row: nr, path: nextPath });
      }
    }

    return null;
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
    historyRef.current = [];
    remainingCellsRef.current = new Set(
      Array.from({ length: COLS }, (_, col) =>
        Array.from({ length: ROWS }, (_, row) => cellKey(col, row)),
      ).flat(),
    );

    setEaten({});
    setScore(0);
    setRemaining(COLS * ROWS);
    setTrail([]);
    setGameOver(false);
    setPacPos({ x: cellCX(0), y: cellCY(0) });
    setPacDir("right");
    setGhosts((previous) => previous.map((ghost) => ({ ...ghost, x: cellCX(0), y: cellCY(0) })));

    const firstSegment = pickTarget(0, 0);

    if (firstSegment) {
      segmentRef.current = firstSegment;
      segmentIndexRef.current = 0;
    }
  }

  useEffect(() => {
    resetAnimation();

    function animate(timestamp) {
      if (!lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
      }

      const deltaSeconds = Math.min((timestamp - lastTimestampRef.current) / 1000, 0.05);
      lastTimestampRef.current = timestamp;

      if (segmentRef.current.length === 0 || segmentIndexRef.current >= segmentRef.current.length) {
        const { col, row } = pacCellRef.current;
        const nextSegment = pickTarget(col, row);

        if (!nextSegment) {
          setGameOver(true);
          return;
        }

        segmentRef.current = nextSegment;
        segmentIndexRef.current = 0;
      }

      let distance = SPEED * deltaSeconds;
      let nextIndex = segmentIndexRef.current;
      const currentSegment = segmentRef.current;

      while (distance > 0 && nextIndex < currentSegment.length - 1) {
        const pointA = currentSegment[nextIndex];
        const pointB = currentSegment[nextIndex + 1];
        const stepDistance = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);

        if (stepDistance === 0) {
          nextIndex += 1;
          continue;
        }

        if (stepDistance <= distance) {
          distance -= stepDistance;
          nextIndex += 1;
        } else {
          break;
        }
      }

      segmentIndexRef.current = Math.min(nextIndex, currentSegment.length - 1);
      const currentPoint = currentSegment[segmentIndexRef.current];

      if (!currentPoint) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      pacCellRef.current = { col: currentPoint.col, row: currentPoint.row };

      const currentCellKey = cellKey(currentPoint.col, currentPoint.row);

      if (!eatenRef.current[currentCellKey]) {
        eatenRef.current = { ...eatenRef.current, [currentCellKey]: true };
        remainingCellsRef.current.delete(currentCellKey);

        const contribution = contributions[currentPoint.col * ROWS + currentPoint.row];
        scoreRef.current += (contribution?.level ?? 0) + 1;

        setEaten({ ...eatenRef.current });
        setScore(scoreRef.current);
        setRemaining(remainingCellsRef.current.size);
      }

      if (segmentIndexRef.current >= currentSegment.length - 1) {
        const nextSegment = pickTarget(currentPoint.col, currentPoint.row);

        if (!nextSegment) {
          setGameOver(true);
          return;
        }

        segmentRef.current = nextSegment;
        segmentIndexRef.current = 0;
      }

      mouthRef.current += mouthDirectionRef.current * deltaSeconds * 420;

      if (mouthRef.current <= 2) {
        mouthRef.current = 2;
        mouthDirectionRef.current = 1;
      }

      if (mouthRef.current >= 40) {
        mouthRef.current = 40;
        mouthDirectionRef.current = -1;
      }

      setMouth(mouthRef.current);
      setPacPos({ x: currentPoint.x, y: currentPoint.y });
      setPacDir(currentPoint.dir);

      historyRef.current.push({ x: currentPoint.x, y: currentPoint.y, timestamp });

      if (historyRef.current.length > 200) {
        historyRef.current.shift();
      }

      const recentTrail = historyRef.current.slice(-14).map((point, index, collection) => ({
        x: point.x,
        y: point.y,
        age: collection.length - 1 - index,
      }));

      setTrail(recentTrail);

      setGhosts((previous) =>
        previous.map((ghost) => {
          const laggedIndex = Math.max(0, historyRef.current.length - 1 - ghost.lag);
          const point = historyRef.current[laggedIndex] || historyRef.current[0];

          return point ? { ...ghost, x: point.x, y: point.y } : ghost;
        }),
      );

      frameRef.current = requestAnimationFrame(animate);
    }

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
  const totalCells = COLS * ROWS;
  const eatenCount = Object.keys(eaten).length;
  const percentage = Math.round((eatenCount / totalCells) * 100);
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Share+Tech+Mono&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; background: #0a0e14; }
        ::-webkit-scrollbar-thumb { background: #FFD700; border-radius: 3px; }
      `}</style>

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
                  const contribution = contributions[col * ROWS + row] || { level: 0 };
                  const isEaten = Boolean(eaten[cellKey(col, row)]);

                  return (
                    <rect
                      key={`${col}-${row}`}
                      x={PAD_L + col * STEP}
                      y={PAD_T + row * STEP}
                      width={CELL}
                      height={CELL}
                      rx={2}
                      fill={isEaten ? background : colors[contribution.level]}
                      opacity={isEaten ? 0.1 : 0.95}
                    />
                  );
                }),
              )}

              {Array.from({ length: COLS }, (_, col) =>
                Array.from({ length: ROWS }, (_, row) => {
                  if (eaten[cellKey(col, row)]) {
                    return null;
                  }

                  const contribution = contributions[col * ROWS + row] || { level: 0 };
                  const radius = contribution.level >= 3 ? 3.2 : contribution.level >= 2 ? 2.4 : contribution.level >= 1 ? 1.8 : 1.3;

                  return (
                    <circle
                      key={`d-${col}-${row}`}
                      cx={PAD_L + col * STEP + CELL / 2}
                      cy={PAD_T + row * STEP + CELL / 2}
                      r={radius}
                      fill="#FFD700"
                      opacity={0.65 + contribution.level * 0.08}
                    />
                  );
                }),
              )}

              {Array.from({ length: COLS }, (_, col) =>
                Array.from({ length: ROWS }, (_, row) => {
                  const contribution = contributions[col * ROWS + row] || { level: 0 };

                  if (contribution.level < 4 || eaten[cellKey(col, row)]) {
                    return null;
                  }

                  return (
                    <circle
                      key={`pp-${col}-${row}`}
                      cx={PAD_L + col * STEP + CELL / 2}
                      cy={PAD_T + row * STEP + CELL / 2}
                      r={4.5}
                      fill="#FFD700"
                    >
                      <animate attributeName="opacity" values="1;0.2;1" dur="0.75s" repeatCount="indefinite" />
                    </circle>
                  );
                }),
              )}

              {trail.map((point, index) => {
                const opacity = Math.max(0, 0.55 - point.age * 0.06);
                const radius = Math.max(0.5, 2.8 - point.age * 0.3);

                return <circle key={index} cx={point.x} cy={point.y} r={radius} fill="#FFD700" opacity={opacity} />;
              })}

              {ghosts.map((ghost, index) => (
                <Ghost key={index} x={ghost.x} y={ghost.y} color={ghost.color} />
              ))}

              <PacMan x={pacPos.x} y={pacPos.y} dir={pacDir} mouth={mouth} />
            </svg>
          </div>

          {gameOver ? <GameComplete score={score} onRestart={resetAnimation} theme={theme} /> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
      </div>
    </div>
  );
}
