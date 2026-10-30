/* Store image renderer for Ha!! Buggy.
   Draws real campaign levels (assets/levels) with a port of FloorLayer / ZoneLayer / hazard
   components and the HUD, then composes captioned store screenshots and the feature graphic.
   Driven by tool/store/render_store.mjs. Depends on art.js (Art, drawBackdrop, C, helpers). */
/* global Art, drawBackdrop, C, rgba, hex, glow, noGlow, rr, ease */

const K = 40; // kTile
const DATA = window.__DATA__;

// ---------------------------------------------------------------- level model
function parseGrid(rows) {
  return rows.map((r) => [...r].map((ch) => ({
    " ": "empty", ".": "floor", "#": "wall", S: "start", C: "checkpoint", G: "goal", "~": "ice",
    "^": "up", v: "down", "<": "left", ">": "right", 1: "door1", 2: "door2", 3: "door3",
  }[ch] || "empty")));
}
const isSolid = (t) => t === "wall" || t === "empty";
const isConv = (t) => ["up", "down", "left", "right"].includes(t);
const KEYCOL = { red: C.red, green: C.lime, yellow: C.yellow };
const DOORCOL = { door1: "red", door2: "green", door3: "yellow" };

function ghostAt(ghost, t) {
  if (!ghost || !ghost.length) return null;
  let i = 0;
  while (i < ghost.length - 2 && ghost[i + 1][0] <= t) i++;
  const a = ghost[i], b = ghost[Math.min(i + 1, ghost.length - 1)];
  const span = b[0] - a[0];
  const k = span <= 0 ? 1 : Math.max(0, Math.min(1, (t - a[0]) / span));
  return { x: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, dx: b[1] - a[1] };
}
function takenBy(ghost, t, pts, r = 0.6) {
  const res = new Set();
  pts.forEach((p, idx) => {
    for (const g of ghost) {
      if (g[0] > t) break;
      if (Math.hypot(g[1] - p[0], g[2] - p[1]) < r) { res.add(idx); break; }
    }
  });
  return res;
}

function patrolPos(h, t) {
  const pts = h.points;
  if (pts.length < 2 || h.speed <= 0) return pts[0];
  const route = [...pts];
  if (h.loop) route.push(pts[0]); else route.push(...pts.slice(0, -1).reverse());
  let cycle = 0;
  for (let i = 0; i < route.length - 1; i++) cycle += Math.hypot(route[i + 1][0] - route[i][0], route[i + 1][1] - route[i][1]);
  if (cycle <= 0) return pts[0];
  let d = (((h.phase || 0) * cycle + h.speed * t) % cycle + cycle) % cycle;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg <= 0) continue;
    if (d <= seg) return [a[0] + (b[0] - a[0]) * (d / seg), a[1] + (b[1] - a[1]) * (d / seg)];
    d -= seg;
  }
  return route[route.length - 1];
}
function orbitPos(h, t) {
  const ang = 2 * Math.PI * ((h.phase || 0) + h.speed * t);
  return [h.center[0] + h.radius * Math.cos(ang), h.center[1] + h.radius * Math.sin(ang)];
}
const ballPos = (h, t) => (h.type === "orbit" ? orbitPos(h, t) : patrolPos(h, t));
function laserOn(h, t) { if (h.period <= 0) return true; const l = (((t + (h.phase || 0)) % h.period) + h.period) % h.period; return l < h.on; }
function laserWarm(h, t) {
  if (laserOn(h, t) || h.period <= 0) return 0;
  const l = (((t + (h.phase || 0)) % h.period) + h.period) % h.period;
  const until = h.period - l;
  return until > 0.6 ? 0 : 1 - until / 0.6;
}

// ---------------------------------------------------------------- neon helpers (NeonDraw)
function neonPath(ctx, build, color, width, sigma, core = true) {
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); build(ctx);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowColor = color; ctx.shadowBlur = sigma * 2.2;
  ctx.stroke();
  ctx.shadowBlur = sigma; ctx.stroke();
  if (core) { ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = Math.max(1, width * 0.35); ctx.stroke(); }
  ctx.restore();
}
function edgeSegs(grid, inside, outside, oob = false) {
  const H = grid.length, W = grid[0].length, segs = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (!inside(grid[r][c])) continue;
    const x = c * K, y = r * K;
    const out = (dc, dr) => { const nc = c + dc, nr = r + dr; if (nr < 0 || nr >= H || nc < 0 || nc >= W) return oob; return outside(grid[nr][nc]); };
    if (out(0, -1)) segs.push([x, y, x + K, y]);
    if (out(0, 1)) segs.push([x, y + K, x + K, y + K]);
    if (out(-1, 0)) segs.push([x, y, x, y + K]);
    if (out(1, 0)) segs.push([x + K, y, x + K, y + K]);
  }
  return segs;
}
const segBuild = (segs) => (ctx) => segs.forEach((s) => { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); });

// ---------------------------------------------------------------- level painter
function paintLevel(ctx, L, accent, st) {
  const g = L.g, H = g.length, W = g[0].length, t = st.t;
  // floor + walls
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const tt = g[r][c], x = c * K, y = r * K;
    if (tt === "empty") continue;
    if (tt === "wall") { ctx.fillStyle = "#0A1440"; ctx.fillRect(x, y, K, K); continue; }
    ctx.fillStyle = (r + c) % 2 === 0 ? "#081130" : "#0A1538"; ctx.fillRect(x, y, K, K);
    const tint = { start: rgba("#3DFFB0", 0.16), checkpoint: rgba("#3DC8FF", 0.16), goal: rgba(C.orange, 0.12), ice: rgba("#BFF4FF", 0.1) }[tt];
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(x, y, K, K); }
    if (tt === "ice") {
      ctx.strokeStyle = rgba("#BFF4FF", 0.35); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + 8, y + 26); ctx.lineTo(x + 20, y + 14); ctx.moveTo(x + 18, y + 32); ctx.lineTo(x + 32, y + 18); ctx.stroke();
    }
  }
  ctx.strokeStyle = rgba("#14285A", 0.55); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = 0; r <= H; r++) { ctx.moveTo(0, r * K); ctx.lineTo(W * K, r * K); }
  for (let c = 0; c <= W; c++) { ctx.moveTo(c * K, 0); ctx.lineTo(c * K, H * K); }
  ctx.stroke();
  for (const [type, col] of [["start", "#3DFFB0"], ["checkpoint", "#3DC8FF"], ["goal", C.orange]]) {
    neonPath(ctx, segBuild(edgeSegs(g, (x) => x === type, (x) => x !== type)), rgba(col, 0.85), 2, 4, false);
  }
  const wallSegs = edgeSegs(g, isSolid, (x) => !isSolid(x)).concat(edgeSegs(g, (x) => !isSolid(x), () => false, true));
  neonPath(ctx, segBuild(wallSegs), accent, 3, 7);
  ctx.strokeStyle = rgba(accent, 0.09); ctx.lineWidth = 2;
  ctx.beginPath();
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (g[r][c] !== "wall") continue;
    const x = c * K, y = r * K;
    for (let k = 8; k < K * 2; k += 10) {
      ctx.moveTo(x + (k < K ? k : K), y + (k < K ? 0 : k - K));
      ctx.lineTo(x + (k < K ? 0 : k - K), y + (k < K ? k : K));
    }
  }
  ctx.stroke();

  // zones: goal
  const goals = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (g[r][c] === "goal") goals.push([c * K, r * K]);
  if (goals.length) {
    const pulse = 0.5 + 0.5 * Math.sin(t * (st.goalOpen ? 6 : 2));
    ctx.fillStyle = rgba(C.orange, st.goalOpen ? 0.18 + pulse * 0.22 : 0.05 + pulse * 0.04);
    goals.forEach(([x, y]) => ctx.fillRect(x, y, K, K));
    const cx = goals.reduce((a, p) => a + p[0], 0) / goals.length + K / 2, cy = goals.reduce((a, p) => a + p[1], 0) / goals.length + K / 2;
    if (st.goalOpen) {
      ctx.strokeStyle = rgba(C.orange, 0.5); ctx.lineWidth = 2;
      goals.forEach(([x, y], i) => { const ph = (t * 0.9 + i * 0.37) % 1, yy = y + K - ph * K, xx = x + 8 + ((i * 13) % 24); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 10); ctx.stroke(); });
      ctx.save(); ctx.translate(cx, cy); halo(ctx, K * 1.6, C.orange, 0.15 + pulse * 0.15); ctx.restore();
    } else {
      ctx.fillStyle = rgba(C.orange, 0.55);
      rr(ctx, cx - 8, cy - 2, 16, 12, 3); ctx.fill();
      neonPath(ctx, (c2) => c2.arc(cx, cy - 3, 5.5, Math.PI, 0), rgba(C.orange, 0.55), 2, 2, false);
    }
  }
  // checkpoint shimmer
  ctx.strokeStyle = rgba("#3DC8FF", 0.18); ctx.lineWidth = 6;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (g[r][c] !== "checkpoint") continue;
    const x = c * K, y = r * K, loc = ((x + y) / (K * 12) + (t * 0.6) % 1) % 1, k = loc * K * 2;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, K, K); ctx.clip();
    ctx.beginPath(); ctx.moveTo(x + k, y); ctx.lineTo(x + k - K, y + K); ctx.stroke(); ctx.restore();
  }
  // conveyors
  const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const tt = g[r][c];
    if (!isConv(tt)) continue;
    const x = c * K, y = r * K, [dx, dy] = DIR[tt], px = -dy, py = dx, cx = x + K / 2, cy = y + K / 2;
    ctx.fillStyle = rgba(C.violet, 0.14); ctx.fillRect(x, y, K, K);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, K, K); ctx.clip();
    for (let i = -1; i <= 1; i++) {
      const sh = (((t * 1.8) % 1) + i) * K * 0.5, tx = cx + dx * (sh + 6), ty = cy + dy * (sh + 6);
      neonPath(ctx, (c2) => { c2.moveTo(tx - dx * 7 + px * 8, ty - dy * 7 + py * 8); c2.lineTo(tx, ty); c2.lineTo(tx - dx * 7 - px * 8, ty - dy * 7 - py * 8); }, rgba(C.violet, 0.75), 2.5, 3, false);
    }
    ctx.restore();
  }
  // doors
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const tt = g[r][c];
    if (!DOORCOL[tt] || st.openDoors.has(DOORCOL[tt])) continue;
    const col = KEYCOL[DOORCOL[tt]], x = c * K + 3, y = r * K + 3, s = K - 6;
    ctx.fillStyle = rgba(col, 0.22); ctx.fillRect(x, y, s, s);
    neonPath(ctx, (c2) => { rr(c2, x, y, s, s, 4); }, col, 2.5, 5);
    ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 2;
    ctx.beginPath(); for (let i = 1; i <= 3; i++) { const xx = x + (s * i) / 4; ctx.moveTo(xx, y + 4); ctx.lineTo(xx, y + s - 4); } ctx.stroke();
  }
  // hazard guides
  ctx.strokeStyle = rgba(C.glitch, 0.16); ctx.lineWidth = 1.2;
  for (const h of L.hazards) {
    ctx.beginPath();
    if (h.type === "patrol" && h.points.length > 1) { ctx.moveTo(h.points[0][0] * K, h.points[0][1] * K); h.points.slice(1).forEach((p) => ctx.lineTo(p[0] * K, p[1] * K)); if (h.loop) ctx.closePath(); }
    if (h.type === "orbit") ctx.arc(h.center[0] * K, h.center[1] * K, h.radius * K, 0, Math.PI * 2);
    ctx.stroke();
  }
  // pickups
  L.chips.forEach((p, i) => { if (st.chips.has(i)) return; ctx.save(); ctx.translate(p[0] * K, p[1] * K); Art.chip(ctx, K * 0.62, { t: t + i }); ctx.restore(); });
  (L.coins || []).forEach((p, i) => { if (st.coins.has(i)) return; ctx.save(); ctx.translate(p[0] * K, p[1] * K); Art.coin(ctx, K * 0.5, { t: t + i }); ctx.restore(); });
  (L.keys || []).forEach((k, i) => { if (st.keys.has(i)) return; ctx.save(); ctx.translate(k.x * K, k.y * K); Art.key(ctx, K * 0.7, KEYCOL[k.color], { t: t + i }); ctx.restore(); });
  // player
  if (st.buggy) {
    ctx.save(); ctx.translate(st.buggy.x * K, st.buggy.y * K);
    Art.buggy(ctx, K * 0.72, { t, look: st.buggy.look, mood: st.mood || "normal" });
    ctx.restore();
  }
  // hazards
  for (const h of L.hazards) {
    if (h.type === "laser") {
      const a = [h.a[0] * K, h.a[1] * K], b = [h.b[0] * K, h.b[1] * K], on = laserOn(h, t), warm = laserWarm(h, t);
      if (on) {
        neonPath(ctx, (c2) => { c2.moveTo(a[0], a[1]); c2.lineTo(b[0], b[1]); }, "#FF2E4D", 5.5, 9, false);
        ctx.strokeStyle = "#FFE0E6"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      } else if (warm > 0) {
        ctx.strokeStyle = rgba("#FF2E4D", 0.15 + 0.45 * warm); ctx.lineWidth = 1 + warm * 1.5;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      } else {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
        ctx.fillStyle = rgba("#FF2E4D", 0.22);
        for (let d = 0; d < len; d += 10) { ctx.beginPath(); ctx.arc(a[0] + ux * d, a[1] + uy * d, 1.2, 0, Math.PI * 2); ctx.fill(); }
      }
      for (const e of [a, b]) {
        ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(e[0], e[1], 7, 0, Math.PI * 2); ctx.fill();
        neonPath(ctx, (c2) => c2.arc(e[0], e[1], 7, 0, Math.PI * 2), rgba("#FF2E4D", on ? 1 : 0.6 + warm * 0.4), 2, 4, false);
        ctx.fillStyle = C.glitchCore; ctx.beginPath(); ctx.arc(e[0], e[1], 2.5 + warm * 1.5, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const R = 0.28 * K;
      for (let i = 6; i >= 1; i--) {
        const p = ballPos(h, t - i * 0.03), k = 1 - i / 6;
        ctx.fillStyle = rgba(C.glitch, 0.18 * k); ctx.beginPath(); ctx.arc(p[0] * K, p[1] * K, R * (0.35 + 0.5 * k), 0, Math.PI * 2); ctx.fill();
      }
      const p = ballPos(h, t);
      ctx.save(); ctx.translate(p[0] * K, p[1] * K); Art.glitch(ctx, R, { t: t * 1.3 + (p[0] % 7) }); ctx.restore();
    }
  }
}

function levelState(L, t, opts = {}) {
  const gh = L.ghost || [];
  const pos = ghostAt(gh, t);
  const chips = takenBy(gh, t, L.chips);
  const coins = takenBy(gh, t, L.coins || []);
  const keys = takenBy(gh, t, (L.keys || []).map((k) => [k.x, k.y]));
  const openDoors = new Set([...keys].map((i) => L.keys[i].color));
  return {
    t, chips, coins, keys, openDoors, goalOpen: chips.size >= L.chips.length,
    buggy: pos && { x: pos.x, y: pos.y, look: Math.sign(pos.dx) || 0.4 }, mood: opts.mood,
  };
}

// ---------------------------------------------------------------- HUD (game_hud.dart) in dp units
function pill(ctx, x, y, w, h, color, glowOn) {
  ctx.save();
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(11,20,51,0.9)"; ctx.fill();
  if (glowOn) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
  ctx.strokeStyle = rgba(color, 0.8); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}
function hudText(ctx, text, x, y, size, color, align = "left") {
  ctx.save();
  ctx.font = `${size}px Buggy, sans-serif`; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.shadowColor = color; ctx.shadowBlur = size * 0.5; ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
  ctx.font = `${size}px Buggy, sans-serif`;
  return ctx.measureText(text).width;
}
function drawHud(ctx, W, st, L) {
  // W in dp. Row: pause | chips  ...  deaths | timer
  const top = 8, h = 34, cy = top + 22;
  ctx.save();
  rr(ctx, 12, top, 44, 44, 12); ctx.fillStyle = "rgba(11,20,51,0.9)"; ctx.fill();
  ctx.strokeStyle = rgba(C.cyan, 0.85); ctx.lineWidth = 1.6; ctx.shadowColor = C.cyan; ctx.shadowBlur = 8; ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = C.cyan; ctx.fillRect(28, top + 14, 4.5, 16); ctx.fillRect(36, top + 14, 4.5, 16);
  ctx.restore();
  const chipTxt = `${st.chips.size}/${L.chips.length}`;
  ctx.font = "16px Buggy, sans-serif";
  const tw = ctx.measureText(chipTxt).width + (st.goalOpen ? 8 + (() => { ctx.font = "11px Buggy, sans-serif"; return ctx.measureText("EXIT OPEN").width; })() : 0);
  const pw = 12 + 22 + 6 + tw + 12, px = 12 + 44 + 12;
  pill(ctx, px, cy - h / 2, pw, h, st.goalOpen ? C.orange : C.orange, st.goalOpen);
  ctx.save(); ctx.translate(px + 12 + 11, cy); Art.chip(ctx, 20, { t: 0 }); ctx.restore();
  const w1 = hudText(ctx, chipTxt, px + 12 + 22 + 6, cy + 1, 16, C.orange);
  if (st.goalOpen) hudText(ctx, "EXIT OPEN", px + 12 + 22 + 6 + w1 + 8, cy + 1, 11, C.orange);
  // timer + deaths
  const tPill = 64 + 24, tx = W - 12 - tPill;
  pill(ctx, tx, cy - h / 2, tPill, h, C.cyan);
  hudText(ctx, `${st.t.toFixed(1)}s`, tx + tPill / 2, cy + 1, 15, C.white, "center");
  const dPill = 12 + 18 + 4 + 12 + 12, dx = tx - 8 - dPill;
  pill(ctx, dx, cy - h / 2, dPill, h, C.cyan);
  ctx.save();
  ctx.fillStyle = C.glitch; ctx.shadowColor = C.glitch; ctx.shadowBlur = 6;
  ctx.translate(dx + 12, cy - 9);
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(3, 10); ctx.lineTo(8, 10); ctx.lineTo(5, 18); ctx.lineTo(14, 7); ctx.lineTo(9, 7); ctx.lineTo(12, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
  hudText(ctx, "0", dx + 12 + 18 + 4, cy + 1, 16, C.white);
}
function drawJoystick(ctx, x, y, kx, ky) {
  ctx.save();
  ctx.strokeStyle = rgba(C.cyan, 0.35); ctx.lineWidth = 2; ctx.fillStyle = rgba(C.cyan, 0.06);
  ctx.beginPath(); ctx.arc(x, y, 58, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = rgba(C.cyan, 0.3); ctx.shadowColor = C.cyan; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(x + kx, y + ky, 24, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- screens (what the device shows)
/** Gameplay screen at pixel size w×h. dpH = logical height of the device in dp (landscape phone ≈ 390). */
function gameScreen(ctx, w, h, spec, dpH = 390) {
  const L = DATA.levels[spec.level];
  const accent = DATA.worlds[L.world - 1].accent;
  ctx.save();
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
  const LW = L.grid[0].length * K, LH = L.grid.length * K;
  const s = Math.min(w / LW, h / LH), ox = (w - LW * s) / 2, oy = (h - LH * s) / 2;
  ctx.translate(ox, oy); ctx.scale(s, s);
  const st = levelState(L, spec.t, spec);
  paintLevel(ctx, L, accent, st);
  ctx.restore();
  ctx.save();
  const dp = h / dpH; ctx.scale(dp, dp);
  drawHud(ctx, w / dp, st, L);
  if (spec.joy) drawJoystick(ctx, 120, dpH - 100, spec.joy[0], spec.joy[1]);
  ctx.restore();
}

/** Story screen: the w1_intro moment where Lord Lag appears. */
function storyScreen(ctx, w, h, spec, dpH = 390) {
  ctx.save();
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
  const sb = h / 480;
  ctx.save(); ctx.scale(w / 800 > sb ? w / 800 : sb, sb); drawBackdrop(ctx, Math.max(800, w / sb), 480, "grid", "#6EEBFF", 1.2); ctx.restore();
  const s = Math.min(w / 800, h / 480), ox = (w - 800 * s) / 2, oy = (h - 480 * s) / 2;
  ctx.translate(ox, oy); ctx.scale(s, s);
  const put = (x, y, sc, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); f(); ctx.restore(); };
  put(620, 170, 1, () => Art.lordLag(ctx, 130, { t: 1.1, anger: 1 }));
  put(480, 120, 1, () => Art.glitch(ctx, 16, { t: 0.4 }));
  put(700, 300, 1, () => Art.glitch(ctx, 16, { t: 1.2 }));
  put(380, 410, 1, () => Art.glitch(ctx, 16, { t: 2.1 }));
  put(520, 300, 1, () => Art.core(ctx, 70, { t: 0.8 }));
  const by = spec.dialogue ? 285 : 330;
  put(260, by, 1, () => Art.buggy(ctx, 70, { t: 0.3, mood: "scared", look: 1 }));
  put(260, by - 70 - 10, 1, () => Art.label(ctx, "!", 30, C.yellow));
  ctx.restore();
  if (spec.dialogue) {
    const dp = h / dpH;
    ctx.save(); ctx.scale(dp, dp);
    const W = w / dp, bw = Math.min(760, W - 32), bx = (W - bw) / 2, bh = 92, by = dpH - 16 - bh;
    const col = C.glitch;
    rr(ctx, bx, by, bw, bh, 14);
    ctx.fillStyle = "rgba(11,20,51,0.94)"; ctx.fill();
    ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.save(); ctx.translate(bx + 12 + 28, by + 12 + 34); Art.lordLag(ctx, 56 * 0.62, { t: 0.5, anger: 0.6 }); ctx.restore();
    ctx.font = "14px Buggy, sans-serif"; ctx.fillStyle = col; ctx.textBaseline = "top";
    ctx.fillText("LORD LAG", bx + 12 + 56 + 12, by + 14);
    ctx.font = "17px Buggy, sans-serif"; ctx.fillStyle = C.white;
    wrapText(ctx, spec.dialogue, bx + 80, by + 38, bw - 110, 23);
    ctx.fillStyle = C.orange; ctx.font = "18px sans-serif"; ctx.fillText("⌄", bx + bw - 26, by + 50);
    ctx.restore();
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(" "); let line = "", yy = y;
  const lines = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l) => { ctx.fillText(l, x, yy); yy += lh; });
  return lines.length;
}

function screen(ctx, w, h, spec) {
  if (spec.kind === "story") storyScreen(ctx, w, h, spec);
  else gameScreen(ctx, w, h, spec);
}

// ---------------------------------------------------------------- store compositions
function marketingBg(ctx, W, H, accent) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.save();
  const s = H / 480;
  ctx.scale(s, s);
  drawBackdrop(ctx, W / s, 480, "circuit", accent, 0.7);
  ctx.restore();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(5,10,30,0.25)"); g.addColorStop(0.55, "rgba(5,10,30,0.55)"); g.addColorStop(1, "rgba(5,10,30,0.92)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function glowText(ctx, text, x, y, size, color, font = "Dodger", align = "left", maxW) {
  ctx.save();
  ctx.font = `${size}px ${font}, sans-serif`; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  let fs = size;
  if (maxW) while (ctx.measureText(text).width > maxW && fs > 10) { fs -= 2; ctx.font = `${fs}px ${font}, sans-serif`; }
  ctx.shadowColor = color; ctx.shadowBlur = fs * 0.35; ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = fs * 0.12; ctx.fillText(text, x, y);
  ctx.restore();
  return fs;
}
function framedScreen(ctx, x, y, w, h, accent, spec) {
  ctx.save();
  const r = h * 0.045;
  ctx.shadowColor = accent; ctx.shadowBlur = h * 0.06;
  rr(ctx, x, y, w, h, r); ctx.fillStyle = C.bg; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip(); ctx.translate(x, y);
  screen(ctx, w, h, spec);
  ctx.restore();
  rr(ctx, x, y, w, h, r); ctx.strokeStyle = rgba(accent, 0.9); ctx.lineWidth = Math.max(3, h * 0.004); ctx.stroke();
  ctx.restore();
}
function captionLines(ctx, cap, x, y, W, size, accent, align) {
  const fs = glowText(ctx, cap.title, x, y, size, C.white, "Dodger", align, W);
  ctx.save();
  ctx.font = `${Math.round(size * 0.42)}px Buggy, sans-serif`; ctx.fillStyle = "#C9DCF5"; ctx.textAlign = align; ctx.textBaseline = "top";
  const n = wrapAligned(ctx, cap.sub, x, y + fs * 0.42, W, size * 0.56, align);
  ctx.restore();
  // accent underline
  ctx.save(); ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 10;
  const lw = size * 1.6; ctx.fillRect(align === "center" ? x - lw / 2 : x, y - fs * 1.05, lw, Math.max(4, size * 0.06)); ctx.restore();
  return n;
}
function wrapAligned(ctx, text, x, y, maxW, lh, align) {
  const words = text.split(" "); let line = ""; const lines = [];
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return lines.length;
}

/** layout: "top" (caption above a 16:9 screen) or "left" (caption column + screen, for very wide iPhones). */
function composeShot(canvas, W, H, spec, cap, layout) {
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;
  const L = spec.level ? DATA.levels[spec.level] : null;
  const accent = spec.accent || (L ? DATA.worlds[L.world - 1].accent : C.cyan);
  marketingBg(ctx, W, H, accent);
  if (layout === "left") {
    const colW = W * 0.33, sh = H * 0.84, sw = Math.min(sh * 16 / 9, W - colW - W * 0.06), shh = sw * 9 / 16;
    const sx = W - sw - W * 0.035, sy = (H - shh) / 2;
    framedScreen(ctx, sx, sy, sw, shh, accent, spec);
    const maxW = colW - W * 0.035;
    const wrapAt = (font, text) => { ctx.font = font; const ws = text.split(" "), out = []; let l = ""; for (const w of ws) { const t2 = l ? l + " " + w : w; if (ctx.measureText(t2).width > maxW && l) { out.push(l); l = w; } else l = t2; } if (l) out.push(l); return out; };
    let size = H * 0.075, lines;
    ctx.save();
    for (;;) {
      lines = wrapAt(`${size}px Dodger, sans-serif`, cap.title);
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if ((lines.length <= 3 && widest <= maxW) || size < H * 0.035) break;
      size -= H * 0.003;
    }
    ctx.restore();
    const lh = size * 1.12, x = W * 0.04;
    ctx.save(); ctx.font = `${Math.round(size * 0.48)}px Buggy, sans-serif`;
    const subLines = (() => { const ws = cap.sub.split(" "), out = []; let l = ""; for (const w of ws) { const t2 = l ? l + " " + w : w; if (ctx.measureText(t2).width > maxW && l) { out.push(l); l = w; } else l = t2; } if (l) out.push(l); return out; })();
    ctx.restore();
    const blockH = lines.length * lh + size * 0.4 + subLines.length * size * 0.66;
    let y = (H - blockH) / 2 + size;
    ctx.save(); ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 10; ctx.fillRect(x, y - size * 1.25, size * 1.6, Math.max(4, size * 0.06)); ctx.restore();
    lines.forEach((l) => { glowText(ctx, l, x, y, size, C.white, "Dodger", "left", maxW); y += lh; });
    ctx.save(); ctx.font = `${Math.round(size * 0.48)}px Buggy, sans-serif`; ctx.fillStyle = "#C9DCF5"; ctx.textBaseline = "top";
    subLines.forEach((l, i) => ctx.fillText(l, x, y - size * 0.55 + size * 0.4 + i * size * 0.66));
    ctx.restore();
  } else {
    const size = H * (W / H > 1.5 ? 0.085 : 0.07);
    const capH = size * 2.6;
    const availH = H - capH - H * 0.06, sw0 = Math.min(W * 0.92, availH * 16 / 9), sh0 = sw0 * 9 / 16;
    framedScreen(ctx, (W - sw0) / 2, capH + (H - capH - sh0) * 0.45, sw0, sh0, accent, spec);
    captionLines(ctx, cap, W / 2, size * 1.45, W * 0.9, size, accent, "center");
  }
  return canvas;
}
function cleanShot(canvas, W, H, spec) {
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;
  screen(ctx, W, H, spec);
  return canvas;
}

function featureGraphic(canvas, lang) {
  const W = 1024, H = 500, ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.save(); const s = H / 480; ctx.scale(s, s); drawBackdrop(ctx, W / s, 480, "grid", "#6EEBFF", 0.9); ctx.restore();
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "rgba(5,10,30,0.15)"); g.addColorStop(0.55, "rgba(5,10,30,0.35)"); g.addColorStop(1, "rgba(5,10,30,0.65)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const put = (x, y, sc, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); f(); ctx.restore(); };
  // trail of chips Buggy collected
  put(330, 140, 1.3, () => Art.chip(ctx, 34, { t: 0.2 }));
  put(150, 110, 1.1, () => Art.glitch(ctx, 16, { t: 0.5 }));
  put(410, 380, 1.2, () => Art.glitch(ctx, 16, { t: 1.1 }));
  put(70, 400, 1.0, () => Art.coin(ctx, 30, { t: 0.1 }));
  put(240, 290, 2.9, () => Art.buggy(ctx, 70, { t: 0.35, mood: "happy", look: 0.6 }));
  put(905, 120, 0.82, () => Art.lordLag(ctx, 130, { t: 1.4, anger: 0.8 }));
  glowText(ctx, "HA!! BUGGY", 760, 260, 92, C.cyan, "Dodger", "center", 470);
  const tag = lang === "fr" ? "Esquive. Attrape. Évade-toi !" : "Dodge. Grab. Escape!";
  glowText(ctx, tag, 760, 330, 40, C.orange, "Buggy", "center", 460);
  return canvas;
}

window.Store = { composeShot, cleanShot, featureGraphic, gameScreen, parseGrid, levelState };
