/* Generated from docs/cutscene_guide/src/app.js (art section). Do not edit by hand. */
  const C = {
    bg: "#050A1E", bgAlt: "#0B1433", cyan: "#6EEBFF", orange: "#FF9628", pink: "#FF4FD8", lime: "#9CFF57",
    red: "#FF4848", yellow: "#FFD447", violet: "#8C7BFF", white: "#E8F7FF", muted: "#7FA3C8", glitch: "#FF3D6E",
    glitchCore: "#FFE1EA",
  };
  const KINDS = ["buggy", "glitch", "chip", "coin", "keyRed", "keyGreen", "keyYellow", "phone", "lordLag", "core",
    "nodeLocked", "nodeDone", "nodeCurrent", "label"];
  const EASES = ["linear", "inOut", "outBack", "outBounce", "inQuad", "outQuad"];
  const BGS = ["grid", "circuit", "space", "kernel", "black"];
  const EMOTES = ["!", "?", "heart", "dots", "angry", "note"];
  const SFX = ["click", "back", "chip", "coin", "death", "respawn", "checkpoint", "unlock", "win", "star1", "star2",
    "star3", "whoosh", "blip", "key", "door", "error", "laser", "place"];
  const VERBS = ["bg", "spawn", "move", "say", "wait", "shake", "flash", "glitch", "emote", "title", "remove", "camera",
    "sfx", "together"];
  const GROUP = { bg: "staging", spawn: "staging", remove: "staging", camera: "staging", move: "motion", wait: "motion",
    together: "motion", say: "talk", emote: "talk", title: "talk", shake: "fx", flash: "fx", glitch: "fx", sfx: "audio" };
  const CPS = 45; // TypewriterText.charsPerSecond

  const reduceMotionMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  // ---------------------------------------------------------------- helpers
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
    return n;
  };
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hexOk = (h) => typeof h === "string" && /^#?[0-9a-fA-F]{6}$/.test(h);
  const hex = (h, f) => (hexOk(h) ? (h[0] === "#" ? h : "#" + h) : f);
  const rgba = (h, a) => {
    const n = parseInt(h.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  async function copyText(text, btn) {
    const old = btn.textContent;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch (e) {
      const ta = el("textarea", { style: "position:fixed;opacity:0" });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
      ta.remove();
      btn.textContent = ok ? "Copied" : "Select and copy";
    }
    setTimeout(() => (btn.textContent = old), 1400);
  }

  // ---------------------------------------------------------------- syntax highlight
  const KW = {
    dart: "abstract|async|await|break|case|class|const|default|else|enum|extends|final|for|if|implements|import|in|interface|late|new|null|on|required|return|sealed|static|super|switch|this|throw|true|false|var|void|when|with|double|int|bool|String|Future|List|Map",
    python: "def|return|if|else|for|in|import|from|None|True|False|and|or|not|dict|lambda",
    json: "true|false|null",
    bash: "python3|flutter|dart|test|run",
  };
  function highlight(code, lang) {
    const kw = KW[lang] || "";
    const comment = lang === "python" || lang === "bash" ? "#[^\\n]*" : lang === "json" ? "(?!)" : "\\/\\/[^\\n]*";
    const re = new RegExp(
      `(${comment})|("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*')|\\b(\\d+(?:\\.\\d+)?)\\b` +
        (kw ? `|\\b(${kw})\\b` : "|(?!)") + `|\\b([A-Z][A-Za-z0-9_]+)\\b`,
      "g"
    );
    let out = "", last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      const t = m[0];
      if (m[1] !== undefined) out += `<span class="tk-${/NEW|new:/.test(t) ? "add" : "c"}">${esc(t)}</span>`;
      else if (m[2] !== undefined) out += `<span class="tk-s">${esc(t)}</span>`;
      else if (m[3] !== undefined) out += `<span class="tk-n">${esc(t)}</span>`;
      else if (m[4] !== undefined) out += `<span class="tk-k">${esc(t)}</span>`;
      else out += `<span class="tk-t">${esc(t)}</span>`;
      last = m.index + t.length;
    }
    return out + esc(code.slice(last));
  }
  function codeBlock(code, lang, title) {
    const wrap = el("div", { class: "code" });
    const pre = el("pre");
    pre.innerHTML = highlight(code, lang);
    const btn = el("button", { class: "copy", type: "button" }, "Copy");
    btn.addEventListener("click", () => copyText(code, btn));
    wrap.append(el("div", { class: "bar" }, el("span", {}, title || lang), btn), pre);
    return wrap;
  }
  function enhanceStaticCode() {
    document.querySelectorAll(".code[data-lang]").forEach((w) => {
      const pre = w.querySelector("pre");
      const code = pre.textContent;
      const nw = codeBlock(code, w.dataset.lang, w.dataset.title);
      w.replaceWith(nw);
    });
  }

  // ---------------------------------------------------------------- easing (cutscene_game.dart Easing.apply)
  function ease(name, t) {
    const x = clamp(t, 0, 1);
    switch (name) {
      case "linear": return x;
      case "inQuad": return x * x;
      case "outQuad": return 1 - (1 - x) * (1 - x);
      case "outBack": { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
      case "outBounce": {
        const n1 = 7.5625, d1 = 2.75;
        let v = x;
        if (v < 1 / d1) return n1 * v * v;
        if (v < 2 / d1) { v -= 1.5 / d1; return n1 * v * v + 0.75; }
        if (v < 2.5 / d1) { v -= 2.25 / d1; return n1 * v * v + 0.9375; }
        v -= 2.625 / d1; return n1 * v * v + 0.984375;
      }
      default: return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; // inOut
    }
  }
  const elastic = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);

  // ---------------------------------------------------------------- art (approximation of ActorArt)
  function glow(ctx, color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
  function noGlow(ctx) { ctx.shadowBlur = 0; }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function halo(ctx, r, color, a) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const Art = {
    buggy(ctx, size, o = {}) {
      const t = o.t || 0, mood = o.mood || "normal", look = o.look || 0, sx = o.sx || 1, sy = o.sy || 1;
      const body = C.cyan, accent = C.orange;
      const w = size * sx, h = size * sy, st = Math.max(1.5, size * 0.075);
      ctx.save();
      ctx.translate(0, (size - h) / 2);
      halo(ctx, size * 1.1, body, 0.18);
      rr(ctx, -w / 2, -h / 2, w, h, size * 0.2);
      ctx.fillStyle = rgba(C.bgAlt, 0.92);
      ctx.fill();
      glow(ctx, body, size * 0.3);
      ctx.strokeStyle = body;
      ctx.lineWidth = st;
      ctx.stroke();
      const bob = Math.sin(t * 6) * size * 0.03;
      const tip = [look * size * 0.06, -h / 2 - size * 0.22 + bob];
      ctx.lineWidth = st * 0.8;
      ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
      glow(ctx, accent, size * 0.2);
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(tip[0], tip[1], size * 0.065, 0, Math.PI * 2); ctx.fill();
      noGlow(ctx);
      // face
      const ex = size * 0.19, ey = -size * 0.06, er = size * 0.105, px = look * size * 0.045;
      ctx.fillStyle = C.white; ctx.strokeStyle = C.white; ctx.lineWidth = size * 0.055; ctx.lineCap = "round";
      const blink = o.blink;
      for (const s of [-1, 1]) {
        const cx = s * ex;
        if (blink && mood !== "happy" && mood !== "dizzy") {
          ctx.beginPath(); ctx.moveTo(cx - er, ey); ctx.lineTo(cx + er, ey); ctx.stroke();
          continue;
        }
        if (mood === "happy") {
          ctx.beginPath(); ctx.arc(cx, ey + er * 0.4, er * 0.9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        } else if (mood === "dizzy") {
          ctx.beginPath();
          for (let a = 0; a < Math.PI * 3.4; a += 0.25) {
            const r = (a / (Math.PI * 3.4)) * er * 1.05;
            const xx = cx + Math.cos(a + t * 5) * r, yy = ey + Math.sin(a + t * 5) * r;
            a === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
          }
          ctx.lineWidth = size * 0.035; ctx.stroke(); ctx.lineWidth = size * 0.055;
        } else {
          const r = mood === "scared" ? er * 1.25 : er;
          ctx.beginPath(); ctx.ellipse(cx, ey, r, r * 1.1, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = C.bg;
          ctx.beginPath(); ctx.arc(cx + px, ey + size * 0.01, mood === "scared" ? r * 0.32 : r * 0.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = C.white;
          if (mood === "determined") {
            ctx.strokeStyle = body; ctx.lineWidth = size * 0.05;
            ctx.beginPath(); ctx.moveTo(cx - s * er * 1.2, ey - er * 1.7); ctx.lineTo(cx + s * er * 1.0, ey - er * 1.0); ctx.stroke();
            ctx.strokeStyle = C.white; ctx.lineWidth = size * 0.055;
          }
        }
      }
      // mouth
      ctx.strokeStyle = C.white; ctx.lineWidth = size * 0.045;
      const my = size * 0.2;
      ctx.beginPath();
      if (mood === "happy") { ctx.arc(0, my - size * 0.06, size * 0.13, Math.PI * 0.15, Math.PI * 0.85); }
      else if (mood === "scared") { ctx.ellipse(0, my, size * 0.05, size * 0.07, 0, 0, Math.PI * 2); }
      else if (mood === "dizzy") { ctx.moveTo(-size * 0.12, my); ctx.quadraticCurveTo(-size * 0.06, my - size * 0.05, 0, my); ctx.quadraticCurveTo(size * 0.06, my + size * 0.05, size * 0.12, my); }
      else if (mood === "determined") { ctx.moveTo(-size * 0.1, my); ctx.lineTo(size * 0.1, my - size * 0.015); }
      else { ctx.arc(0, my - size * 0.07, size * 0.09, Math.PI * 0.2, Math.PI * 0.8); }
      ctx.stroke();
      ctx.restore();
    },
    core(ctx, size, o = {}) {
      const t = o.t || 0, r = size * 0.42;
      halo(ctx, size * 0.95, C.lime, 0.16);
      ctx.save();
      ctx.rotate(t * 0.6);
      ctx.setLineDash([size * 0.09, size * 0.07]);
      glow(ctx, C.lime, size * 0.15);
      ctx.strokeStyle = rgba(C.lime, 0.7); ctx.lineWidth = size * 0.035;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.58, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(C.bgAlt, 0.95); ctx.fill();
      glow(ctx, C.lime, size * 0.3);
      ctx.strokeStyle = C.lime; ctx.lineWidth = size * 0.065; ctx.stroke();
      noGlow(ctx);
      ctx.fillStyle = C.lime;
      const blink = (t % 4) < 0.12;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * size * 0.13, -size * 0.04, size * 0.05, blink ? size * 0.01 : size * 0.065, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = C.lime; ctx.lineWidth = size * 0.04; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, size * 0.06, size * 0.11, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    },
    lordLag(ctx, size, o = {}) {
      const t = o.t || 0, anger = o.anger ?? 0.3, R = size * 0.45;
      halo(ctx, size * 0.9, C.glitch, 0.2);
      ctx.beginPath();
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        const spike = i % 2 ? 0.78 : 1.06 + 0.06 * Math.sin(t * 7 + i);
        const top = Math.sin(a) < -0.5 ? 1.12 : 1;
        const rr2 = R * spike * (i % 2 ? 1 : top) * (1 + 0.03 * Math.sin(t * 13 + i * 2.1));
        const x = Math.cos(a) * rr2, y = Math.sin(a) * rr2 * 0.92;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = "#1A0A22"; ctx.fill();
      glow(ctx, C.glitch, size * 0.15);
      ctx.strokeStyle = C.glitch; ctx.lineWidth = size * 0.035; ctx.stroke();
      noGlow(ctx);
      const lx = Math.sin(t) * size * 0.02;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * size * 0.15 + lx, -size * 0.05);
        ctx.rotate(s * (0.25 + anger * 0.3));
        glow(ctx, C.yellow, size * 0.08);
        ctx.fillStyle = C.yellow;
        ctx.beginPath(); ctx.ellipse(0, 0, size * 0.085, size * 0.04 + (1 - anger) * size * 0.015, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      noGlow(ctx);
      ctx.strokeStyle = C.glitch; ctx.lineWidth = size * 0.03; ctx.lineJoin = "round";
      ctx.beginPath();
      const mw = size * 0.22, my = size * 0.15;
      ctx.moveTo(-mw, my);
      for (let i = 1; i <= 6; i++) ctx.lineTo(-mw + (i * mw * 2) / 6, my + (i % 2 ? -1 : 1) * size * (0.03 + anger * 0.03));
      ctx.stroke();
    },
    glitch(ctx, r, o = {}) {
      const t = o.t || 0;
      ctx.save();
      ctx.rotate(t * 1.5);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (Math.PI * 2 * i) / 16;
        const rad = (i % 2 ? 0.62 : 1.3) * r * (1 + 0.08 * Math.sin(t * 9 + i));
        i ? ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(C.glitch, 0.25); ctx.fill();
      glow(ctx, C.glitch, r * 0.9);
      ctx.strokeStyle = C.glitch; ctx.lineWidth = r * 0.16; ctx.stroke();
      ctx.restore();
      noGlow(ctx);
      ctx.fillStyle = C.glitchCore;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
    },
    chip(ctx, size, o = {}) {
      const t = o.t || 0, s = size * 0.62;
      ctx.translate(0, Math.sin(t * 3) * size * 0.06);
      halo(ctx, size * 0.9, C.orange, 0.2);
      ctx.strokeStyle = C.orange; ctx.lineWidth = size * 0.06;
      glow(ctx, C.orange, size * 0.3);
      for (let i = -1; i <= 1; i++) {
        const p = i * s * 0.3;
        ctx.beginPath();
        ctx.moveTo(-s / 2 - size * 0.14, p); ctx.lineTo(-s / 2, p);
        ctx.moveTo(s / 2, p); ctx.lineTo(s / 2 + size * 0.14, p);
        ctx.moveTo(p, -s / 2 - size * 0.14); ctx.lineTo(p, -s / 2);
        ctx.moveTo(p, s / 2); ctx.lineTo(p, s / 2 + size * 0.14);
        ctx.stroke();
      }
      rr(ctx, -s / 2, -s / 2, s, s, size * 0.08);
      ctx.fillStyle = rgba(C.bgAlt, 0.95); ctx.fill(); ctx.stroke();
      noGlow(ctx);
      ctx.fillStyle = rgba(C.orange, 0.8);
      rr(ctx, -s * 0.22, -s * 0.22, s * 0.44, s * 0.44, size * 0.04); ctx.fill();
    },
    coin(ctx, size, o = {}) {
      const t = o.t || 0, r = size * 0.42, sx = Math.max(0.15, Math.abs(Math.cos(t * 2.2)));
      halo(ctx, size * 0.9, C.yellow, 0.2);
      glow(ctx, C.yellow, size * 0.35);
      ctx.strokeStyle = C.yellow; ctx.lineWidth = size * 0.08;
      ctx.beginPath(); ctx.ellipse(0, 0, r * sx, r, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(C.yellow, 0.18); ctx.fill(); ctx.stroke();
      noGlow(ctx);
      ctx.lineWidth = size * 0.05;
      ctx.beginPath(); ctx.moveTo(0, -r * 0.45); ctx.lineTo(0, r * 0.45); ctx.globalAlpha *= sx; ctx.stroke(); ctx.globalAlpha /= sx;
    },
    key(ctx, size, color, o = {}) {
      const t = o.t || 0;
      ctx.translate(0, Math.sin(t * 2.6) * size * 0.05);
      ctx.rotate(-0.5);
      halo(ctx, size * 0.85, color, 0.18);
      glow(ctx, color, size * 0.3);
      ctx.strokeStyle = color; ctx.lineWidth = size * 0.1; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(-size * 0.22, 0, size * 0.17, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-size * 0.05, 0); ctx.lineTo(size * 0.4, 0);
      ctx.moveTo(size * 0.26, 0); ctx.lineTo(size * 0.26, size * 0.15);
      ctx.moveTo(size * 0.37, 0); ctx.lineTo(size * 0.37, size * 0.12);
      ctx.stroke();
      noGlow(ctx);
    },
    phone(ctx, h, o = {}) {
      const t = o.t || 0, w = h * 0.52;
      glow(ctx, C.muted, h * 0.06);
      rr(ctx, -w / 2, -h / 2, w, h, h * 0.09);
      ctx.fillStyle = "#0A1230"; ctx.fill();
      ctx.strokeStyle = C.muted; ctx.lineWidth = h * 0.018; ctx.stroke();
      noGlow(ctx);
      const sw = w * 0.86, sh = h * 0.84, gl = 0.35 + 0.25 * Math.sin(t * 2);
      const g = ctx.createLinearGradient(0, -sh / 2, 0, sh / 2);
      g.addColorStop(0, rgba(C.cyan, gl * 0.6));
      g.addColorStop(1, rgba(C.violet, gl * 0.3));
      rr(ctx, -sw / 2, -sh / 2, sw, sh, h * 0.04);
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = C.muted;
      rr(ctx, -w * 0.16, -h / 2 + h * 0.035, w * 0.32, h * 0.025, h * 0.012); ctx.fill();
      rr(ctx, -w * 0.2, h / 2 - h * 0.05, w * 0.4, h * 0.012, h * 0.006); ctx.fill();
    },
    node(ctx, size, state, o = {}) {
      const t = o.t || 0, r = size * 0.42;
      const col = state === 1 ? C.lime : state === 2 ? C.orange : C.muted;
      if (state === 2) {
        const p = (t * 1.2) % 1;
        ctx.strokeStyle = rgba(C.orange, 1 - p); ctx.lineWidth = size * 0.05;
        ctx.beginPath(); ctx.arc(0, 0, r * (1 + p * 0.7), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(C.bgAlt, 0.95); ctx.fill();
      glow(ctx, col, state ? size * 0.35 : 0);
      ctx.strokeStyle = col; ctx.lineWidth = size * 0.08; ctx.stroke();
      noGlow(ctx);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = size * 0.07; ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (state === 1) {
        ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(-r * 0.1, r * 0.32); ctx.lineTo(r * 0.45, -r * 0.3); ctx.stroke();
      } else if (state === 2) {
        ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
      } else {
        rr(ctx, -r * 0.35, -r * 0.05, r * 0.7, r * 0.5, r * 0.08); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.22, Math.PI, 0); ctx.stroke();
      }
    },
    label(ctx, text, size = 22, color = C.white, alpha = 1) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.font = `${size}px "Tilt Neon", "Trebuchet MS", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      glow(ctx, color, size * 0.5);
      ctx.fillStyle = color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    },
  };

  function drawKind(ctx, kind, o) {
    switch (kind) {
      case "buggy": return Art.buggy(ctx, 70, o);
      case "glitch": return Art.glitch(ctx, 16, o);
      case "chip": return Art.chip(ctx, 34, o);
      case "coin": return Art.coin(ctx, 30, o);
      case "keyRed": return Art.key(ctx, 40, C.red, o);
      case "keyGreen": return Art.key(ctx, 40, C.lime, o);
      case "keyYellow": return Art.key(ctx, 40, C.yellow, o);
      case "phone": return Art.phone(ctx, 220, o);
      case "lordLag": return Art.lordLag(ctx, 130, o);
      case "core": return Art.core(ctx, 70, o);
      case "nodeLocked": return Art.node(ctx, 46, 0, o);
      case "nodeDone": return Art.node(ctx, 46, 1, o);
      case "nodeCurrent": return Art.node(ctx, 46, 2, o);
      default: return Art.label(ctx, o.text || "", 22, C.white, 1);
    }
  }

  // Backdrop (NeonGridBackground params as passed by CutscenePlayer)
  const STARS = Array.from({ length: 90 }, (_, i) => {
    const r = Math.sin(i * 127.1) * 43758.5453;
    const r2 = Math.sin(i * 311.7) * 12543.123;
    return [r - Math.floor(r), r2 - Math.floor(r2), (i % 5) / 5];
  });
  function drawBackdrop(ctx, W, H, style, accentHex, t) {
    if (style === "black") { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); return; }
    const accent = style === "kernel" ? C.glitch : hex(accentHex, C.cyan);
    const hz = (style === "space" ? 0.85 : 0.62) * H;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, C.bg);
    sky.addColorStop(1, rgba(accent, 0.16));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    ctx.fillStyle = C.bg; ctx.fillRect(0, hz, W, H - hz);
    if (style === "space" || style === "kernel") {
      for (const [x, y, p] of STARS) {
        const a = 0.25 + 0.5 * Math.abs(Math.sin(t * 1.3 + p * 9));
        ctx.fillStyle = rgba(C.white, a);
        ctx.fillRect(x * W, y * hz * 0.95, 1.6, 1.6);
      }
    }
    if (style === "grid") {
      const r = H * 0.2;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, hz); ctx.clip();
      const g = ctx.createLinearGradient(0, hz - r, 0, hz);
      g.addColorStop(0, rgba(C.yellow, 0.9)); g.addColorStop(1, rgba(C.pink, 0.85));
      ctx.fillStyle = g;
      glow(ctx, C.pink, 40);
      ctx.beginPath(); ctx.arc(W / 2, hz, r, 0, Math.PI * 2); ctx.fill();
      noGlow(ctx);
      ctx.fillStyle = C.bg;
      for (let i = 0; i < 5; i++) { const y = hz - r * 0.12 - i * r * 0.16; ctx.fillRect(0, y, W, 2.5 + (4 - i) * 0.9); }
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, hz, W, H - hz); ctx.clip();
    ctx.strokeStyle = rgba(accent, 0.5); ctx.lineWidth = 1.4;
    glow(ctx, accent, 8);
    for (let k = -14; k <= 14; k++) {
      ctx.beginPath(); ctx.moveTo(W / 2 + k * 6, hz); ctx.lineTo(W / 2 + k * W * 0.12, H); ctx.stroke();
    }
    const scroll = (t * 0.35) % 1;
    for (let i = 0; i < 9; i++) {
      const f = Math.pow((i + scroll) / 9, 2.2);
      const y = hz + (H - hz) * f;
      ctx.globalAlpha = 0.35 + 0.65 * f;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = accent; ctx.lineWidth = 2; glow(ctx, accent, 14);
    ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(W, hz); ctx.stroke();
    noGlow(ctx);
  }

