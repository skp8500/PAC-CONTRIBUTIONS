import { useState, useEffect, useRef, useCallback } from "react";

// ─── Grid constants ───────────────────────────────────────────────────────────
const COLS   = 53;
const ROWS   = 7;
const CELL   = 12;
const GAP    = 2;
const STEP   = CELL + GAP;
const PAC_R  = 7;
const PAD_L  = 38;
const PAD_T  = 32;
const SVG_W  = PAD_L + COLS * STEP + 20;
const SVG_H  = PAD_T + ROWS * STEP + 16;
const SPEED  = 160; // px/s

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DARK_COLORS  = ['#161b22','#0e4429','#006d32','#26a641','#39d353'];
const LIGHT_COLORS = ['#ebedf0','#9be9a8','#40c463','#30a14e','#216e39'];

// ─── Grid helpers ─────────────────────────────────────────────────────────────
const cellCX  = (col) => PAD_L + col * STEP + CELL / 2;
const cellCY  = (row) => PAD_T + row  * STEP + CELL / 2;
const cellKey = (col, row) => `${col},${row}`;
const DIRS    = [[1,0,'right'],[-1,0,'left'],[0,1,'down'],[0,-1,'up']];

// ─── A* Pathfinding ───────────────────────────────────────────────────────────
function aStar(startCol, startRow, goalCol, goalRow) {
  const h   = (c, r) => Math.abs(c - goalCol) + Math.abs(r - goalRow);
  const key = (c, r) => c * 100 + r; // fast int key

  // min-heap via sorted array (good enough for 53x7 grid)
  const open   = [];
  const gScore = new Map();
  const parent = new Map();
  const dirMap = new Map();

  const sk = key(startCol, startRow);
  gScore.set(sk, 0);
  open.push({ c: startCol, r: startRow, f: h(startCol, startRow) });

  let iterations = 0;
  const MAX_ITER = COLS * ROWS * 8;

  while (open.length > 0 && iterations++ < MAX_ITER) {
    // pop lowest f (keep sorted)
    open.sort((a, b) => a.f - b.f);
    const { c, r } = open.shift();
    const ck = key(c, r);

    if (c === goalCol && r === goalRow) {
      // reconstruct
      const path = [];
      let cur = ck;
      while (parent.has(cur)) {
        const [pc, pr] = [Math.floor(cur / 100), cur % 100];
        path.unshift({ col: pc, row: pr, dir: dirMap.get(cur) });
        cur = parent.get(cur);
      }
      return path;
    }

    for (const [dc, dr, dir] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
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

// Convert A* node list to pixel waypoints
function toPixelPath(nodes) {
  return nodes.map(n => ({
    x: cellCX(n.col), y: cellCY(n.row),
    col: n.col, row: n.row, dir: n.dir,
  }));
}

// ─── Fake contributions ───────────────────────────────────────────────────────
function makeFakeContributions() {
  const data = [];
  const now  = new Date();
  for (let i = COLS * ROWS - 1; i >= 0; i--) {
    const d    = new Date(now);
    d.setDate(d.getDate() - i);
    const rand  = Math.random();
    const level = rand < 0.42 ? 0 : rand < 0.62 ? 1 : rand < 0.78 ? 2 : rand < 0.92 ? 3 : 4;
    data.push({ date: d.toISOString().slice(0,10), count: level * Math.ceil(Math.random()*4), level });
  }
  return data;
}

// ─── Ghost SVG ───────────────────────────────────────────────────────────────
function Ghost({ x, y, color }) {
  const s = 13;
  return (
    <g transform={`translate(${x - s/2}, ${y - s/2})`}>
      <path
        d={`M1,${s} L1,${s*0.46} Q1,0 ${s/2},0 Q${s-1},0 ${s-1},${s*0.46}
            L${s-1},${s} L${s*0.83},${s*0.78} L${s*0.67},${s}
            L${s*0.5},${s*0.78} L${s*0.33},${s} L${s*0.17},${s*0.78} Z`}
        fill={color}
      />
      <ellipse cx={s*0.32} cy={s*0.38} rx="2.8" ry="3" fill="white"/>
      <ellipse cx={s*0.68} cy={s*0.38} rx="2.8" ry="3" fill="white"/>
      <circle  cx={s*0.38} cy={s*0.43} r="1.3" fill="#111"/>
      <circle  cx={s*0.74} cy={s*0.43} r="1.3" fill="#111"/>
    </g>
  );
}

// ─── Pac-Man SVG ──────────────────────────────────────────────────────────────
function PacMan({ x, y, dir, mouth }) {
  const r      = PAC_R;
  const rotate = { right:0, left:180, down:90, up:270 }[dir] ?? 0;
  const a      = Math.max(2, mouth);
  const rad    = (a * Math.PI) / 180;
  const x1 = x + r * Math.cos(rad);  const y1 = y - r * Math.sin(rad);
  const x2 = x + r * Math.cos(rad);  const y2 = y + r * Math.sin(rad);
  const ex = x;  const ey = y - r * 0.55;
  return (
    <g transform={`rotate(${rotate},${x},${y})`}>
      <circle cx={x} cy={y} r={r+3} fill="none" stroke="#FFD700" strokeWidth="1.5" opacity="0.25"/>
      {a < 3
        ? <circle cx={x} cy={y} r={r} fill="#FFD700"/>
        : <path d={`M${x},${y} L${x1},${y1} A${r},${r} 0 1,1 ${x2},${y2} Z`} fill="#FFD700"/>
      }
      <circle cx={ex} cy={ey} r="1.6" fill="#1a1a00"/>
    </g>
  );
}

// ─── Game Complete Overlay ────────────────────────────────────────────────────
function GameComplete({ score, onRestart, theme }) {
  const bg = theme === 'dark' ? 'rgba(5,8,16,0.93)' : 'rgba(240,246,252,0.93)';
  return (
    <div style={{
      position:'absolute', inset:0, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:bg, borderRadius:8, zIndex:10, backdropFilter:'blur(3px)',
    }}>
      <div style={{fontFamily:"'Press Start 2P'",fontSize:'clamp(10px,2.5vw,18px)',color:'#FFD700',
        textShadow:'0 0 30px #FFD700aa',marginBottom:16,letterSpacing:2,textAlign:'center'}}>
        🎉 GAME COMPLETE! 🎉
      </div>
      <div style={{fontFamily:"'Press Start 2P'",fontSize:'clamp(8px,2vw,13px)',color:'#39d353',marginBottom:8}}>
        100% EATEN
      </div>
      <div style={{fontFamily:"'Press Start 2P'",fontSize:'clamp(8px,2vw,12px)',color:'#00fff5',marginBottom:24}}>
        FINAL SCORE: {String(score).padStart(6,'0')}
      </div>
      <button onClick={onRestart} style={{
        background:'#FFD700',color:'#111',border:'none',
        fontFamily:"'Press Start 2P'",fontSize:9,padding:'12px 24px',
        cursor:'pointer',borderRadius:3,letterSpacing:1,
        boxShadow:'0 0 20px #FFD70066',
      }}>▶ PLAY AGAIN</button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function App() {
  const [username, setUsername] = useState("skp8500");
  const [inputVal, setInputVal] = useState("skp8500");
  const [theme,    setTheme]    = useState("dark");
  const [copied,   setCopied]   = useState("");

  const [contributions] = useState(makeFakeContributions);

  // render state
  const [pacPos,    setPacPos]    = useState({ x: cellCX(0), y: cellCY(0) });
  const [pacDir,    setPacDir]    = useState("right");
  const [mouth,     setMouth]     = useState(35);
  const [eaten,     setEaten]     = useState({});
  const [score,     setScore]     = useState(0);
  const [remaining, setRemaining] = useState(COLS * ROWS);
  const [trail,     setTrail]     = useState([]);
  const [gameOver,  setGameOver]  = useState(false);
  const [ghosts,    setGhosts]    = useState([
    { color:'#FF0000', lag:0  , x: cellCX(0), y: cellCY(0) },
    { color:'#FFB8FF', lag:8  , x: cellCX(0), y: cellCY(0) },
    { color:'#00CFCF', lag:16 , x: cellCX(0), y: cellCY(0) },
    { color:'#FFB852', lag:24 , x: cellCX(0), y: cellCY(0) },
  ]);

  // internal refs
  const eatenRef     = useRef({});
  const scoreRef     = useRef(0);
  const mouthRef     = useRef(35);
  const mouthDRef    = useRef(-1);
  const lastTsRef    = useRef(null);
  const frameRef     = useRef(null);
  const pacCellRef   = useRef({ col:0, row:0 });
  const segRef       = useRef([]);    // current pixel segment
  const segIdxRef    = useRef(0);
  const remainRef    = useRef(null);  // Set<cellKey>
  const historyRef   = useRef([]);    // [{x,y,ts}] for ghost lag

  // ── pick random uneaten target & A*-path to it ──
  const pickTarget = useCallback((fromCol, fromRow) => {
    const rem = remainRef.current;
    if (!rem || rem.size === 0) return null;

    const keys    = [...rem];
    const MAX_TRY = Math.min(20, keys.length);

    // try random targets first
    for (let t = 0; t < MAX_TRY; t++) {
      const k         = keys[Math.floor(Math.random() * keys.length)];
      const [tc, tr]  = k.split(',').map(Number);
      if (tc === fromCol && tr === fromRow) continue;
      const nodes = aStar(fromCol, fromRow, tc, tr);
      if (nodes.length > 0) return toPixelPath(nodes);
    }

    // fallback BFS to nearest uneaten (always succeeds on full grid)
    const visited = new Set([cellKey(fromCol, fromRow)]);
    const queue   = [{ col:fromCol, row:fromRow, path:[] }];
    while (queue.length) {
      const { col, row, path } = queue.shift();
      for (const [dc, dr, dir] of DIRS) {
        const nc = col+dc, nr = row+dr;
        if (nc<0||nc>=COLS||nr<0||nr>=ROWS) continue;
        const nk = cellKey(nc, nr);
        if (visited.has(nk)) continue;
        visited.add(nk);
        const np = [...path, {col:nc,row:nr,dir}];
        if (rem.has(nk)) return toPixelPath(np);
        queue.push({col:nc,row:nr,path:np});
      }
    }
    return null;
  }, []);

  // ── full reset ──
  const reset = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    eatenRef.current   = {};
    scoreRef.current   = 0;
    mouthRef.current   = 35;
    mouthDRef.current  = -1;
    lastTsRef.current  = null;
    pacCellRef.current = { col:0, row:0 };
    segRef.current     = [];
    segIdxRef.current  = 0;
    historyRef.current = [];
    remainRef.current  = new Set(
      Array.from({length:COLS},(_,c)=>Array.from({length:ROWS},(_,r)=>cellKey(c,r))).flat()
    );
    setEaten({});  setScore(0);  setRemaining(COLS*ROWS);
    setTrail([]);  setGameOver(false);
    setPacPos({x:cellCX(0),y:cellCY(0)});  setPacDir("right");
    setGhosts(prev=>prev.map(g=>({...g,x:cellCX(0),y:cellCY(0)})));
    // queue first segment
    const first = pickTarget(0, 0);
    if (first) { segRef.current = first; segIdxRef.current = 0; }
  }, [pickTarget]);

  // ── animation loop ──
  useEffect(() => {
    // init
    remainRef.current = new Set(
      Array.from({length:COLS},(_,c)=>Array.from({length:ROWS},(_,r)=>cellKey(c,r))).flat()
    );
    const first = pickTarget(0,0);
    if (first) { segRef.current = first; segIdxRef.current = 0; }

    function frame(ts) {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;

      // need new segment?
      if (segRef.current.length === 0 || segIdxRef.current >= segRef.current.length) {
        const { col, row } = pacCellRef.current;
        const next = pickTarget(col, row);
        if (!next) { setGameOver(true); return; }
        segRef.current   = next;
        segIdxRef.current = 0;
      }

      // advance along segment
      let dist = SPEED * dt;
      let idx  = segIdxRef.current;
      const seg = segRef.current;

      while (dist > 0 && idx < seg.length - 1) {
        const a = seg[idx], b = seg[idx+1];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d === 0) { idx++; continue; }
        if (d <= dist) { dist -= d; idx++; }
        else break;
      }
      segIdxRef.current = Math.min(idx, seg.length - 1);
      const cur = seg[segIdxRef.current];
      if (!cur) { frameRef.current = requestAnimationFrame(frame); return; }

      pacCellRef.current = { col: cur.col, row: cur.row };

      // eat
      const ck = cellKey(cur.col, cur.row);
      if (!eatenRef.current[ck]) {
        eatenRef.current = { ...eatenRef.current, [ck]: true };
        remainRef.current.delete(ck);
        const cell = contributions[cur.col * ROWS + cur.row];
        scoreRef.current += (cell?.level ?? 0) + 1;
        setEaten({ ...eatenRef.current });
        setScore(scoreRef.current);
        setRemaining(remainRef.current.size);
      }

      // end of segment → pick next
      if (segIdxRef.current >= seg.length - 1) {
        const next = pickTarget(cur.col, cur.row);
        if (!next) { setGameOver(true); return; }
        segRef.current    = next;
        segIdxRef.current = 0;
      }

      // mouth
      mouthRef.current += mouthDRef.current * dt * 420;
      if (mouthRef.current <= 2)  { mouthRef.current = 2;  mouthDRef.current =  1; }
      if (mouthRef.current >= 40) { mouthRef.current = 40; mouthDRef.current = -1; }
      setMouth(mouthRef.current);

      setPacPos({ x: cur.x, y: cur.y });
      setPacDir(cur.dir);

      // history for ghosts + trail
      historyRef.current.push({ x: cur.x, y: cur.y, ts });
      if (historyRef.current.length > 200) historyRef.current.shift();

      const hist = historyRef.current;
      const trailPts = hist.slice(-14).map((p,i,arr) => ({
        x: p.x, y: p.y, age: arr.length - 1 - i,
      }));
      setTrail(trailPts);

      setGhosts(prev => prev.map(g => {
        const li = Math.max(0, hist.length - 1 - g.lag);
        const pt = hist[li] || hist[0];
        return pt ? { ...g, x: pt.x, y: pt.y } : g;
      }));

      frameRef.current = requestAnimationFrame(frame);
    }

    frameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributions]);

  // ── display ──
  const colors      = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const bg          = theme === 'dark' ? '#0d1117'   : '#f6f8fa';
  const textColor   = theme === 'dark' ? '#8b949e'   : '#57606a';
  const borderColor = theme === 'dark' ? '#21262d'   : '#d0d7de';
  const appBg       = theme === 'dark' ? '#050810'   : '#f0f6fc';
  const cardBg      = theme === 'dark' ? '#0d1117'   : '#fff';

  const monthPositions = [];
  { let lm = -1;
    for (let col = 0; col < COLS; col++) {
      const c = contributions[col * ROWS];
      if (c) { const m = new Date(c.date).getMonth(); if (m !== lm) { monthPositions.push({ label:MONTH_LABELS[m], col }); lm = m; } }
    }
  }

  const totalCells = COLS * ROWS;
  const eatenCount = Object.keys(eaten).length;
  const pct        = Math.round((eatenCount / totalCells) * 100);

  const apiUrl      = `https://pacman-contributions.vercel.app/api/${username}?theme=${theme}`;
  const mdSnippet   = `![pacman](${apiUrl})`;
  const htmlSnippet = `<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="${apiUrl}" />\n  <img alt="pacman" src="${apiUrl}" />\n</picture>`;

  function copy(text, key) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <div style={{fontFamily:"'Share Tech Mono',monospace",background:appBg,minHeight:'100vh',color:theme==='dark'?'#c9d1d9':'#24292f',paddingBottom:60}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Share+Tech+Mono&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;background:#0a0e14}
        ::-webkit-scrollbar-thumb{background:#FFD700;border-radius:3px}
      `}</style>

      {/* Header */}
      <div style={{textAlign:'center',padding:'40px 20px 30px',borderBottom:`1px solid ${borderColor}`}}>
        <svg width="52" height="52" viewBox="0 0 52 52" style={{marginBottom:10,filter:'drop-shadow(0 0 14px #FFD70099)'}}>
          <path d="M26,26 L50,12 A24,24 0 1,0 50,40 Z" fill="#FFD700"/>
          <circle cx="17" cy="17" r="4" fill="#111"/>
        </svg>
        <div style={{fontFamily:"'Press Start 2P'",fontSize:'clamp(13px,3vw,22px)',color:'#FFD700',letterSpacing:2,textShadow:'0 0 24px #FFD70066',marginBottom:10}}>
          PAC-CONTRIBUTIONS
        </div>
        <div style={{color:'#00fff5',fontSize:11,letterSpacing:5,opacity:0.7}}>// eat your github history //</div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'28px 16px 0'}}>

        {/* Input */}
        <div style={{background:cardBg,border:`1px solid ${borderColor}`,borderTop:'2px solid #FFD700',borderRadius:4,padding:18,marginBottom:22}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'stretch'}}>
            <div style={{flex:1,minWidth:180,display:'flex',alignItems:'center',background:theme==='dark'?'#0a0e14':'#f6f8fa',border:`1px solid ${borderColor}`,borderRadius:3,overflow:'hidden'}}>
              <span style={{padding:'0 10px',color:textColor,fontSize:12,borderRight:`1px solid ${borderColor}`,whiteSpace:'nowrap',alignSelf:'stretch',display:'flex',alignItems:'center'}}>github.com/</span>
              <input value={inputVal} onChange={e=>setInputVal(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&setUsername(inputVal.trim())}
                placeholder="your-username"
                style={{flex:1,background:'transparent',border:'none',outline:'none',color:'#FFD700',fontFamily:"'Share Tech Mono'",fontSize:15,padding:'11px 13px'}}/>
            </div>
            <div style={{display:'flex',border:`1px solid ${borderColor}`,borderRadius:3,overflow:'hidden'}}>
              {['dark','light'].map(t=>(
                <button key={t} onClick={()=>setTheme(t)}
                  style={{background:theme===t?'#FFD700':'#0a0e14',border:'none',color:theme===t?'#111':textColor,fontFamily:"'Press Start 2P'",fontSize:7,padding:'0 12px',cursor:'pointer',transition:'all .15s'}}>
                  {t==='dark'?'🌑 DARK':'☀️ LIGHT'}
                </button>
              ))}
            </div>
            <button onClick={()=>setUsername(inputVal.trim())}
              style={{background:'#FFD700',color:'#111',border:'none',fontFamily:"'Press Start 2P'",fontSize:9,padding:'11px 18px',cursor:'pointer',borderRadius:3,letterSpacing:1}}>
              ▶ GENERATE
            </button>
          </div>
        </div>

        {/* HUD */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,padding:'0 2px',flexWrap:'wrap',gap:8}}>
          <div style={{fontFamily:"'Press Start 2P'",fontSize:9,color:'#FFD700'}}>
            SCORE: {String(score).padStart(6,'0')}
          </div>
          <div style={{fontFamily:"'Press Start 2P'",fontSize:8,color:'#00fff5'}}>
            {remaining} CELLS LEFT
          </div>
          <div style={{fontFamily:"'Press Start 2P'",fontSize:8,color:textColor}}>{pct}% EATEN</div>
          <div style={{display:'flex',gap:4}}>
            {[0,1,2].map(i=>(
              <svg key={i} width="12" height="12" viewBox="0 0 14 14">
                <path d="M7,7 L14,3 A7,7 0 1,0 14,11 Z" fill="#FFD700"/>
              </svg>
            ))}
          </div>
        </div>
        <div style={{height:3,background:borderColor,borderRadius:2,marginBottom:12,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#FFD700,#39d353)',borderRadius:2,transition:'width .1s'}}/>
        </div>

        {/* Preview */}
        <div style={{marginBottom:8,textAlign:'center',fontFamily:"'Press Start 2P'",fontSize:9,color:textColor,letterSpacing:4}}>— LIVE PREVIEW —</div>
        <div style={{background:bg,border:`1px solid ${borderColor}`,borderRadius:8,padding:'14px 10px 10px',marginBottom:24,overflow:'hidden',position:'relative'}}>
          <div style={{fontFamily:"'Press Start 2P'",fontSize:8,color:textColor,marginBottom:8,paddingLeft:4}}>
            <span style={{color:'#FFD700'}}>{username}</span>'s GitHub Contributions
          </div>
          <div style={{overflowX:'auto'}}>
            <svg width={SVG_W} height={SVG_H} style={{display:'block',minWidth:SVG_W,overflow:'visible'}}>

              {/* Month labels */}
              {monthPositions.map(({label,col})=>(
                <text key={col} x={PAD_L+col*STEP} y={18} fill={textColor} fontSize={9} fontFamily="monospace">{label}</text>
              ))}

              {/* Day labels */}
              {[1,3,5].map(row=>(
                <text key={row} x={2} y={PAD_T+row*STEP+CELL-1} fill={textColor} fontSize={8} fontFamily="monospace">
                  {DAY_LABELS[row].slice(0,3)}
                </text>
              ))}

              {/* Cells */}
              {Array.from({length:COLS},(_,col)=>
                Array.from({length:ROWS},(_,row)=>{
                  const cell    = contributions[col*ROWS+row]||{level:0};
                  const isEaten = !!eaten[cellKey(col,row)];
                  return (
                    <rect key={`${col}-${row}`}
                      x={PAD_L+col*STEP} y={PAD_T+row*STEP}
                      width={CELL} height={CELL} rx={2}
                      fill={isEaten ? bg : colors[cell.level]}
                      opacity={isEaten ? 0.1 : 0.95}
                    />
                  );
                })
              )}

              {/* Dots */}
              {Array.from({length:COLS},(_,col)=>
                Array.from({length:ROWS},(_,row)=>{
                  if (eaten[cellKey(col,row)]) return null;
                  const cell = contributions[col*ROWS+row]||{level:0};
                  const r2   = cell.level>=3 ? 3.2 : cell.level>=2 ? 2.4 : cell.level>=1 ? 1.8 : 1.3;
                  return (
                    <circle key={`d-${col}-${row}`}
                      cx={PAD_L+col*STEP+CELL/2} cy={PAD_T+row*STEP+CELL/2}
                      r={r2} fill="#FFD700" opacity={0.65+cell.level*0.08}
                    />
                  );
                })
              )}

              {/* Power pellets on level-4 cells */}
              {Array.from({length:COLS},(_,col)=>
                Array.from({length:ROWS},(_,row)=>{
                  const cell = contributions[col*ROWS+row]||{level:0};
                  if (cell.level < 4 || eaten[cellKey(col,row)]) return null;
                  return (
                    <circle key={`pp-${col}-${row}`}
                      cx={PAD_L+col*STEP+CELL/2} cy={PAD_T+row*STEP+CELL/2}
                      r={4.5} fill="#FFD700">
                      <animate attributeName="opacity" values="1;0.2;1" dur="0.75s" repeatCount="indefinite"/>
                    </circle>
                  );
                })
              )}

              {/* Trail */}
              {trail.map((pt,i) => {
                const op = Math.max(0, 0.55 - pt.age * 0.06);
                const r2 = Math.max(0.5, 2.8 - pt.age * 0.3);
                return <circle key={i} cx={pt.x} cy={pt.y} r={r2} fill="#FFD700" opacity={op}/>;
              })}

              {/* Ghosts */}
              {ghosts.map((g,i)=>(
                <Ghost key={i} x={g.x} y={g.y} color={g.color}/>
              ))}

              {/* Pac-Man */}
              <PacMan x={pacPos.x} y={pacPos.y} dir={pacDir} mouth={mouth}/>

            </svg>
          </div>

          {gameOver && <GameComplete score={score} onRestart={reset} theme={theme}/>}
        </div>

        {/* Embed codes */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[
            {key:'md',   label:'📄 MARKDOWN',       code:mdSnippet  },
            {key:'html', label:'🌓 HTML (adaptive)', code:htmlSnippet},
            {key:'url',  label:'🔗 DIRECT SVG URL',  code:apiUrl     },
          ].map(({key,label,code})=>(
            <div key={key} style={{background:theme==='dark'?'#0a0e14':'#fff',border:`1px solid ${borderColor}`,borderRadius:4,overflow:'hidden'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 13px',background:cardBg,borderBottom:`1px solid ${borderColor}`,fontSize:11,color:textColor}}>
                <span>{label}</span>
                <button onClick={()=>copy(code,key)}
                  style={{background:'transparent',border:`1px solid ${borderColor}`,color:copied===key?'#39d353':'#00fff5',fontFamily:"'Press Start 2P'",fontSize:7,padding:'4px 10px',cursor:'pointer',borderRadius:2,transition:'all .2s'}}>
                  {copied===key?'✓ COPIED!':'COPY'}
                </button>
              </div>
              <pre style={{padding:13,overflowX:'auto',margin:0}}>
                <code style={{fontFamily:"'Share Tech Mono'",fontSize:12,color:'#7dd3fc',lineHeight:1.6,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{code}</code>
              </pre>
            </div>
          ))}
        </div>

        {/* Deploy steps */}
        <div style={{marginTop:30,background:cardBg,border:`1px solid ${borderColor}`,borderRadius:4,padding:22}}>
          <div style={{fontFamily:"'Press Start 2P'",fontSize:9,color:'#00fff5',letterSpacing:3,marginBottom:16,textAlign:'center'}}>// HOW TO DEPLOY //</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:16}}>
            {[['01','Download the ZIP & push to GitHub'],['02','npm install && npm run dev'],['03','Deploy to Vercel in 1 click'],['04','Any user embeds their Pac-Man 🎮']].map(([n,t])=>(
              <div key={n}>
                <div style={{fontFamily:"'Press Start 2P'",fontSize:16,color:'#FFD700',opacity:0.3,marginBottom:6}}>{n}</div>
                <p style={{fontSize:12,lineHeight:1.6,color:theme==='dark'?'#c9d1d9':'#24292f'}}>{t}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{textAlign:'center',marginTop:32,color:textColor,fontSize:11,letterSpacing:2}}>
          BUILT BY <span style={{color:'#FFD700'}}>skp8500</span> · OPEN SOURCE · MIT
        </div>
      </div>
    </div>
  );
}
