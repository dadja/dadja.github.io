/* Live bits of the one-pager: the hero plays the game's real levels along their recorded winning
   routes ("ghost runs"), and small canvases draw the rules and the cast with the game's own art code.
   Needs: levels.js (window.__DATA__), art.js (Art, C), store.js (Store). */
(function () {
  "use strict";
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const D = window.__DATA__;
  if (!D || !window.Store) return;
  for (const L of Object.values(D.levels)) L.g = Store.parseGrid(L.grid);

  // ---------------- hero: real levels on a loop
  const cv = document.getElementById("live");
  if (cv) {
    const ctx = cv.getContext("2d");
    const order = ["w1_l6", "w2_l3", "w3_l5", "w4_l8"];
    const label = document.getElementById("live-label");
    const names = JSON.parse(cv.dataset.names || "{}");
    let li = 0, t = 0, last = performance.now(), visible = true;
    const level = () => D.levels[order[li]];
    const setLabel = () => {
      const L = level();
      if (label) label.textContent = (names.prefix || "") + `${L.world}-${L.id.slice(-1)} “${L.name}”`;
    };
    const joyFor = (L, tt) => {
      const g = L.ghost; let i = 0;
      while (i < g.length - 2 && g[i + 1][0] <= tt) i++;
      const a = g[i], b = g[Math.min(i + 1, g.length - 1)], dx = b[1] - a[1], dy = b[2] - a[2], n = Math.hypot(dx, dy) || 1;
      return [(dx / n) * 26, (dy / n) * 26];
    };
    const draw = () => {
      const L = level();
      Store.gameScreen(ctx, cv.width, cv.height, { level: L.id, t, joy: joyFor(L, t) }, 390);
    };
    setLabel();
    if (reduce) { t = level().ghost[level().ghost.length - 1][0] * 0.35; draw(); }
    else {
      if ("IntersectionObserver" in window) new IntersectionObserver((es) => es.forEach((e) => (visible = e.isIntersecting))).observe(cv);
      const step = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        if (visible && !document.hidden && now - last > 30) {
          last = now;
          t += dt;
          const end = level().ghost[level().ghost.length - 1][0] + 0.8;
          if (t > end) { li = (li + 1) % order.length; t = 0; setLabel(); }
          draw();
        } else if (!visible || document.hidden) last = now;
        requestAnimationFrame(step);
      };
      draw();
      requestAnimationFrame(step);
    }
  }

  // ---------------- small art canvases
  function paint(canvas, fn) {
    const r = window.devicePixelRatio > 1 ? 2 : 1, s = canvas.clientWidth || 76;
    canvas.width = s * r; canvas.height = s * r;
    const ctx = canvas.getContext("2d");
    ctx.scale(r, r); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, s, s);
    ctx.translate(s / 2, s / 2);
    fn(ctx, s);
  }
  const ART = {
    chip: (c, s) => Art.chip(c, s * 0.5, { t: 0.3 }),
    glitch: (c, s) => Art.glitch(c, s * 0.2, { t: 0.4 }),
    exit: (c, s) => {
      c.fillStyle = "rgba(255,150,40,0.25)"; c.fillRect(-s * 0.32, -s * 0.32, s * 0.64, s * 0.64);
      c.strokeStyle = C.orange; c.lineWidth = 2; c.shadowColor = C.orange; c.shadowBlur = 8; c.strokeRect(-s * 0.32, -s * 0.32, s * 0.64, s * 0.64); c.shadowBlur = 0;
      Art.buggy(c, s * 0.36, { t: 0.2, mood: "happy" });
    },
    buggy: (c, s) => { c.translate(0, s * 0.06); Art.buggy(c, s * 0.52, { t: 0.4, mood: "happy", look: 0.5 }); },
    core: (c, s) => Art.core(c, s * 0.62, { t: 0.6 }),
    lag: (c, s) => { c.translate(0, s * 0.04); Art.lordLag(c, s * 0.7, { t: 1.1, anger: 0.8 }); },
  };
  const all = () => document.querySelectorAll("canvas[data-art]").forEach((cnv) => ART[cnv.dataset.art] && paint(cnv, ART[cnv.dataset.art]));
  all();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
})();
