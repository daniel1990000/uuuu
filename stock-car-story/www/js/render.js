/* ============================================================
   RENDERER — chunky pixel art, Kairosoft-style.
   Low internal resolution scaled up with image-rendering:pixelated,
   so every shape lands on a fat, crisp pixel.
   ============================================================ */
"use strict";

let cv, cx, CW = 240, CH = 320, SCALE = 3, frame = 0;

function initRender() {
  cv = document.getElementById("scene");
  cx = cv.getContext("2d", { alpha: false });
  resizeCanvas();
  window.addEventListener("resize", () => setTimeout(resizeCanvas, 60));
  window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 200));
}
function resizeCanvas() {
  const w = document.getElementById("sceneWrap");
  const rw = w.clientWidth, rh = w.clientHeight;
  SCALE = Math.max(2, Math.min(4, Math.floor(rw / 190)));
  CW = Math.max(160, Math.floor(rw / SCALE));
  CH = Math.max(200, Math.floor(rh / SCALE));
  cv.width = CW; cv.height = CH;
  cx.imageSmoothingEnabled = false;
}
/* pixel helpers */
function px(x, y, w, h, c) { cx.fillStyle = c; cx.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0)); }
function dith(x, y, w, h, c1, c2, step) {
  px(x, y, w, h, c1); cx.fillStyle = c2; step = step || 4;
  for (let j = y | 0; j < y + h; j += 2)
    for (let i = (x | 0) + (((j / 2) | 0) % 2 ? 0 : 2); i < x + w; i += step) cx.fillRect(i, j, 1, 1);
}
function txt(s, x, y, c, size, align) {
  cx.fillStyle = c; cx.font = "bold " + (size || 7) + "px monospace";
  cx.textAlign = align || "left"; cx.textBaseline = "alphabetic";
  cx.fillText(s, x | 0, y | 0);
}
const SKIN = ["#f7c8a0", "#efb488", "#d9996a", "#c1804f"];
const HAIR = ["#4a2c12", "#171717", "#a4442e", "#e0b74a", "#8a8a8a", "#6a3fa0", "#2e5fa3", "#b5651d"];

/* Kairosoft-style chibi: huge head, tiny body, 8 wide × 13 tall */
function chibi(x, y, seed, kind, facing) {
  const sk = SKIN[seed % 4], hr = HAIR[seed % 8];
  const shirt = kind === "driver" ? "#e8332a" : kind === "crew" ? "#2a55c8" : "#f0f0f0";
  x = x | 0; y = y | 0;
  px(x + 1, y + 11, 6, 2, "rgba(0,0,0,.20)");        // shadow
  px(x + 2, y + 9, 2, 3, "#26313f"); px(x + 4, y + 9, 2, 3, "#26313f");   // legs
  px(x + 1, y + 5, 6, 5, shirt);                      // torso
  px(x, y + 6, 1, 3, sk); px(x + 7, y + 6, 1, 3, sk); // arms
  px(x + 1, y, 6, 6, sk);                             // head
  px(x, y - 1, 8, 3, hr);                             // hair
  px(x, y + 1, 1, 2, hr); px(x + 7, y + 1, 1, 2, hr);
  if (facing !== "away") {
    px(x + 2, y + 3, 1, 2, "#20232c"); px(x + 5, y + 3, 1, 2, "#20232c");
    px(x + 3, y + 5, 2, 1, "#c98");
  }
  if (kind === "crew") { px(x, y - 2, 8, 2, "#2a55c8"); px(x, y - 1, 8, 1, "#1b3f9e"); } // cap
  if (kind === "driver") { px(x, y - 2, 8, 3, "#f2f2f2"); px(x + 1, y, 6, 2, "#7fd0ff"); } // helmet
}
function tree(x, y, s) {
  s = s || 1;
  px(x + 2 * s, y + 6 * s, 2 * s, 4 * s, "#6d4520");
  px(x, y + s, 6 * s, 6 * s, "#2f8f3a");
  px(x + s, y - s, 4 * s, 3 * s, "#3fae4a");
  px(x + 2 * s, y + 2 * s, 2 * s, s, "#6ddf74");
}
/* a stock car sprite, drawn rotated */
function carSprite(g, col, big) {
  const w = big ? 14 : 11, h = big ? 8 : 6;
  g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(-w / 2, -h / 2 + 2, w, h);
  g.fillStyle = col; g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle = "#1c1c22"; g.fillRect(-w / 2 + 1, -h / 2 - 1, 3, 1); g.fillRect(-w / 2 + 1, h / 2, 3, 1);
  g.fillRect(w / 2 - 4, -h / 2 - 1, 3, 1); g.fillRect(w / 2 - 4, h / 2, 3, 1);
  g.fillStyle = "#cfe8ff"; g.fillRect(-1, -h / 2 + 1, 4, h - 2);      // roof/glass
  g.fillStyle = "#ffffff"; g.fillRect(w / 2 - 2, -h / 2 + 1, 1, h - 2);
}

/* ============================================================
   TITLE
   ============================================================ */
function drawTitle() {
  const sky = cx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, "#2a3f9e"); sky.addColorStop(1, "#6fa8e8");
  cx.fillStyle = sky; cx.fillRect(0, 0, CW, CH);
  for (let i = 0; i < 26; i++) { const x = (i * 53 + ((frame / 3) | 0)) % (CW + 30) - 15; px(x, 18 + (i % 5) * 9, 7, 3, "rgba(255,255,255,.55)"); }
  const hz = CH * 0.56;
  dith(0, hz, CW, CH - hz, "#3fae4a", "#2f8f3a");
  px(0, hz + 22, CW, 20, "#6b7078"); px(0, hz + 30, CW, 2, "#e8e8e8");
  for (let i = 0; i < 9; i++) tree(6 + i * (CW / 8), hz - 6, 1);
  /* grandstand silhouette */
  px(0, hz - 22, CW, 16, "#8f969f");
  for (let x = 2; x < CW; x += 3) for (let y = hz - 20; y < hz - 8; y += 3)
    px(x, y, 2, 2, ["#e8332a", "#2255cc", "#ffd23f", "#fff", "#3fae4a"][(x + y) % 5]);
  /* hero cars running down the front stretch */
  const carX = ((frame * 1.6) % (CW + 60)) - 30;
  cx.save(); cx.translate(carX, hz + 32); carSprite(cx, "#e8332a", true); cx.restore();
  cx.save(); cx.translate(carX - 22, hz + 26); carSprite(cx, "#2255cc", true); cx.restore();
  cx.save(); cx.translate(carX - 44, hz + 34); carSprite(cx, "#e9a11b", true); cx.restore();
  /* infield: pit wall, tyre stacks and trees so the foreground isn't bare */
  px(0, hz + 44, CW, 3, "#c9d0da");
  for (let i = 0; i < CW; i += 26) {
    px(i + 3, hz + 48, 11, 4, "#1b1b1f"); px(i + 6, hz + 49, 5, 2, "#43434b");
    px(i + 3, hz + 52, 11, 4, "#1b1b1f"); px(i + 6, hz + 53, 5, 2, "#43434b");
  }
  for (let i = 0; i < 5; i++) tree(8 + i * (CW / 4.2), CH - 22, 1);
  /* haulers parked in the infield */
  for (let i = 0; i < 3; i++) {
    const hx = 12 + i * (CW / 3);
    px(hx, CH - 44, 26, 9, ["#e6ebf2", "#c8d2de", "#eef1f6"][i]);
    px(hx + 2, CH - 41, 14, 4, "#e8332a");
    px(hx + 3, CH - 35, 5, 3, "#20232c"); px(hx + 18, CH - 35, 5, 3, "#20232c");
  }
  /* logo */
  const ty = CH * 0.24;
  txt("STOCK CAR", CW / 2 + 1, ty + 1, "#101a45", 19, "center");
  txt("STOCK CAR", CW / 2, ty, "#ffd23f", 19, "center");
  txt("STORY", CW / 2 + 1, ty + 20, "#101a45", 19, "center");
  txt("STORY", CW / 2, ty + 19, "#ffd23f", 19, "center");
  px(CW / 2 - 52, ty + 26, 104, 2, "#e8332a");
  txt("BUILD THE GREATEST TEAM IN RACING", CW / 2, ty + 38, "#ffffff", 6, "center");
}

/* ============================================================
   GARAGE / SHOP SCENE
   ============================================================ */
let walkers = [];
function syncWalkers() {
  const staff = G.drivers.map(d => ({ s: d, k: "driver" })).concat(G.crew.map(c => ({ s: c, k: "crew" })));
  while (walkers.length < staff.length)
    walkers.push({ x: rnd(.15, .85), y: rnd(.2, .85), tx: rnd(.15, .85), ty: rnd(.2, .85), t: rnd(0, 4), f: "at" });
  walkers.length = staff.length;
  return staff;
}
function drawGarage() {
  /* ground */
  dith(0, 0, CW, CH, "#79c34d", "#68b243");
  /* road down the left */
  px(0, 0, 24, CH, "#7d838c"); px(0, 0, 2, CH, "#5c626b");
  px(10, 0, 3, CH, "#e9e9e9");
  for (let y = 6; y < CH; y += 24) px(11, y, 1, 12, "#7d838c");
  /* parking apron */
  dith(24, CH * 0.06, CW - 24, CH * 0.14, "#9aa0a8", "#8b919a", 6);
  /* transporter */
  const tx0 = CW - 62;
  px(tx0, 12, 40, 15, "#e6ebf2"); px(tx0 + 40, 16, 12, 11, "#c3ccd8");
  px(tx0 + 42, 18, 7, 5, "#8fb7d8");
  px(tx0 + 4, 26, 6, 4, "#20232c"); px(tx0 + 30, 26, 6, 4, "#20232c"); px(tx0 + 44, 26, 6, 4, "#20232c");
  px(tx0 + 4, 16, 26, 5, "#e8332a"); txt("RACING", tx0 + 6, 20, "#fff", 5);
  tree(28, 8, 1); tree(CW - 12, 34, 1); tree(30, CH - 20, 1); tree(CW - 16, CH - 16, 1);

  /* ---- the shop building ---- */
  const gx = 30, gw = CW - 46;
  const gy = Math.floor(CH * 0.30), gh = Math.floor(CH * 0.50);
  /* back wall */
  px(gx - 4, gy - 30, gw + 8, 30, "#98a0a9");
  px(gx - 4, gy - 33, gw + 8, 4, "#6d747d");
  px(gx - 4, gy - 4, gw + 8, 5, "#7f868f");
  /* corrugation */
  for (let x = gx - 2; x < gx + gw + 4; x += 4) px(x, gy - 29, 1, 25, "#8b939c");
  /* window */
  px(gx + gw - 40, gy - 26, 28, 13, "#a9dcff");
  px(gx + gw - 40, gy - 26, 28, 2, "#6d747d"); px(gx + gw - 27, gy - 26, 2, 13, "#6d747d");
  /* sponsor banner */
  const spName = G.sponsors.length ? byId(SPONSORS, G.sponsors[0].id).n.toUpperCase() : "STOCK CAR STORY";
  px(gx + 2, gy - 27, 50, 11, "#e8332a"); px(gx + 2, gy - 27, 50, 2, "#ff7a6e");
  txt(spName.slice(0, 11), gx + 5, gy - 19, "#fff", 6);
  /* side walls */
  px(gx - 4, gy - 4, 4, gh + 6, "#79808a"); px(gx + gw, gy - 4, 4, gh + 6, "#79808a");
  /* floor */
  dith(gx, gy, gw, gh, "#c78f52", "#b67f45", 6);
  cx.fillStyle = "#a97338";
  for (let y = gy + 9; y < gy + gh; y += 10) cx.fillRect(gx, y, gw, 1);
  /* lift pad + bay markings */
  const bx = gx + gw / 2 - 26, by = gy + gh / 2 - 14;
  px(bx, by, 52, 30, "#9ba2ab"); px(bx + 2, by + 2, 48, 26, "#b8bfc8");
  cx.fillStyle = "#e9a11b";
  for (let i = 0; i < 6; i++) px(bx + i * 9, by + 31, 6, 2, "#e9a11b");
  /* tyre stacks */
  for (let i = 0; i < 4; i++) { px(gx + 3, gy + 6 + i * 4, 11, 4, "#1b1b1f"); px(gx + 6, gy + 7 + i * 4, 5, 2, "#43434b"); }
  for (let i = 0; i < 3; i++) { px(gx + 16, gy + 12 + i * 4, 11, 4, "#1b1b1f"); px(gx + 19, gy + 13 + i * 4, 5, 2, "#43434b"); }
  /* tool chest + bench */
  px(gx + gw - 30, gy + 4, 26, 9, "#8a6a3c"); px(gx + gw - 28, gy + 13, 3, 7, "#6a4c28"); px(gx + gw - 9, gy + 13, 3, 7, "#6a4c28");
  px(gx + gw - 26, gy, 10, 5, "#cc3a3a"); px(gx + gw - 24, gy - 2, 6, 3, "#a02a2a");
  px(gx + gw - 18, gy + gh - 16, 13, 10, "#c0392b"); px(gx + gw - 16, gy + gh - 13, 9, 2, "#e8e8e8"); px(gx + gw - 16, gy + gh - 10, 9, 2, "#e8e8e8");
  /* oil drums */
  px(gx + 3, gy + gh - 17, 9, 12, "#c0392b"); px(gx + 3, gy + gh - 13, 9, 2, "#eee");
  px(gx + 14, gy + gh - 14, 9, 9, "#2a55c8"); px(gx + 14, gy + gh - 11, 9, 2, "#eee");
  /* toolbox trolley */
  px(gx + gw - 44, gy + gh - 14, 12, 9, "#8a929c"); px(gx + gw - 42, gy + gh - 12, 8, 3, "#aab2bc");

  /* the race machine on the pad */
  const t = G.teams[G.curTeam];
  const car = t && G.cars[t.car];
  if (car) {
    const cxp = bx + 26, cyp = by + 15;
    cx.save(); cx.translate(cxp, cyp); cx.scale(1.5, 1.5); carSprite(cx, carColor(car), true); cx.restore();
    txt("#" + car.num, cxp, cyp + 14, "#20232c", 6, "center");
  }
  /* staff */
  const staff = syncWalkers();
  walkers.forEach((w, i) => {
    w.t -= 1 / 60;
    if (w.t <= 0) { w.tx = rnd(.08, .92); w.ty = rnd(.1, .92); w.t = rnd(2.5, 6); }
    const dx = w.tx - w.x, dy = w.ty - w.y;
    w.x += clamp(dx, -.0022, .0022); w.y += clamp(dy, -.0018, .0018);
    chibi(gx + 5 + w.x * (gw - 16), gy + 3 + w.y * (gh - 18), staff[i].s.face, staff[i].k, dy < -0.02 ? "away" : "at");
  });
  /* floating status bubbles */
  let by2 = gy - 46;
  const bubble = (s, col) => {
    cx.font = "bold 7px monospace";
    const w = cx.measureText(s).width + 9;
    px(gx + 4, by2, w, 13, "#ffffff"); px(gx + 4, by2, w, 1, "#c9d2e2");
    cx.strokeStyle = "#20232c"; cx.lineWidth = 1; cx.strokeRect(gx + 4.5, by2 + 0.5, w - 1, 12);
    px(gx + 9, by2 + 13, 4, 3, "#ffffff");
    txt(s, gx + 8, by2 + 9, col, 7);
    by2 += 17;
  };
  if (G.build) bubble("Building " + G.build.wks + "w", "#2255cc");
  if (G.repair) bubble("Repair " + G.repair.wks + "w", "#e8332a");
  if (car && car.dur < carStats(car).maxdur * 0.35) bubble("Machine damaged!", "#e8332a");
  if (!G.build && !G.repair && G.rp >= 40) bubble("Research ready", "#1e8a2e");
}
function carColor(car) {
  return ["#e8332a", "#2255cc", "#e9a11b", "#3fae4a", "#8a3fc2", "#12b0b0", "#d457a0", "#f0f0f0"][car.paint % 8];
}

/* ============================================================
   RACE SCENE — the whole oval, blimp view
   ============================================================ */
let VIEW = null;
function computeView(tk) {
  const b = tk.bounds;
  /* leave room outside the track for walls, grandstands and run-off */
  const halo = Math.min(b.maxx - b.minx, b.maxy - b.miny) * 0.11;
  const bw = (b.maxx - b.minx) + halo * 2, bh = (b.maxy - b.miny) + halo * 2;
  /* rotate 90° when the screen is portrait but the track is wide */
  const rot = (CH > CW * 1.05) && (bw > bh * 1.15);
  const w0 = rot ? bh : bw, h0 = rot ? bw : bh;
  const aw = CW - 20, ah = CH - 46;
  /* pick the vertical squash so the track fills both axes; the clamp keeps
     it looking like a track seen from a blimp rather than from directly above */
  const sq = clamp((ah * w0) / (aw * h0), 0.52, 0.86);
  const sc = Math.min(aw / w0, ah / (h0 * sq));
  return { rot, sq, sc, ox: CW / 2, oy: 24 + (CH - 46) / 2,
    cxw: (b.minx + b.maxx) / 2, cyw: (b.miny + b.maxy) / 2 };
}
function W2S(p) {
  const v = VIEW;
  let dx = p.x - v.cxw, dy = p.y - v.cyw;
  if (v.rot) { const t = dx; dx = dy; dy = -t; }
  return { x: v.ox + dx * v.sc, y: v.oy + dy * v.sc * v.sq };
}
/* screen-space heading for a world heading (accounts for rotate+squash) */
function W2Sang(h) {
  const v = VIEW;
  let cxx = Math.cos(h), cyy = Math.sin(h);
  if (v.rot) { const t = cxx; cxx = cyy; cyy = -t; }
  return Math.atan2(cyy * v.sq, cxx);
}

function edgePath(tk, off, step) {
  const out = [];
  for (let d = 0; d < tk.len; d += step) {
    const p = sampleTrack(tk, d);
    out.push(W2S(offsetPoint(p, off)));
  }
  return out;
}
function tracePoly(pts, close, append) {
  if (!append) cx.beginPath();
  cx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) cx.lineTo(pts[i].x, pts[i].y);
  if (close !== false) cx.closePath();
}
/* ring between two closed edges, filled with the even-odd rule */
function ringPath(outer, inner) {
  cx.beginPath();
  tracePoly(outer, true, true);
  tracePoly(inner, true, true);
}
function drawRace() {
  const tk = R.tk, track = R.track;
  VIEW = computeView(tk);
  const dirt = track.surf === "dirt";
  const road = track.surf === "road";

  /* background */
  dith(0, 0, CW, CH, dirt ? "#c39a5c" : "#5fa93f", dirt ? "#b58d50" : "#529639", 6);

  const bb = tk.bounds;
  const small = Math.min(bb.maxx - bb.minx, bb.maxy - bb.miny);
  const HALF = clamp(small * 0.055, 9, 34);          // track half-width, world units
  const step = Math.max(4, tk.len / 260);
  const outer = edgePath(tk, -HALF, step);
  const inner = edgePath(tk, HALF, step);
  const outerW = edgePath(tk, -HALF - 5, step);

  /* --- infield --- */
  tracePoly(inner); cx.fillStyle = dirt ? "#b08a52" : "#4f9b36"; cx.fill();
  /* infield furniture: lake, garages, care centre */
  drawInfield(tk, HALF);

  /* --- grandstands outside the two longest straights --- */
  drawGrandstands(tk, HALF);

  /* --- track surface --- */
  cx.save();
  ringPath(outer, inner);
  cx.fillStyle = dirt ? "#8d6236" : (road ? "#4a4f57" : "#5b6068");
  cx.fill("evenodd");
  cx.restore();

  /* banking shading: lighter high-bank corners read as leaning away */
  cx.save();
  ringPath(outer, inner); cx.clip("evenodd");
  for (let d = 0; d < tk.len; d += step) {
    const p = sampleTrack(tk, d);
    if (p.b < 8) continue;
    const a = W2S(offsetPoint(p, -HALF)), b2 = W2S(offsetPoint(p, -HALF * 0.15));
    cx.strokeStyle = "rgba(255,255,255," + Math.min(0.16, p.b / 190) + ")";
    cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b2.x, b2.y); cx.stroke();
  }
  cx.restore();

  /* groove (the worn racing line) */
  cx.strokeStyle = dirt ? "rgba(60,40,20,.30)" : "rgba(20,20,25,.28)";
  cx.lineWidth = Math.max(2, HALF * VIEW.sc * 0.42);
  tracePoly(edgePath(tk, HALF * 0.36, step)); cx.stroke();

  /* inner white line + apron */
  cx.strokeStyle = dirt ? "#d8c49a" : "#e8ecf2"; cx.lineWidth = 1.4;
  tracePoly(inner); cx.stroke();

  /* --- outer wall with SAFER barrier stripes --- */
  cx.lineWidth = 3.2; cx.strokeStyle = "#eef2f7";
  tracePoly(outerW); cx.stroke();
  cx.lineWidth = 3.2;
  let seg = 0;
  for (let d = 0; d < tk.len; d += step * 2, seg++) {
    if (seg % 3 !== 0) continue;
    const a = W2S(offsetPoint(sampleTrack(tk, d), -HALF - 5));
    const b2 = W2S(offsetPoint(sampleTrack(tk, d + step * 1.6), -HALF - 5));
    cx.strokeStyle = seg % 6 === 0 ? "#e8332a" : "#2255cc";
    cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b2.x, b2.y); cx.stroke();
  }

  /* --- pit road, then the start/finish line on top of it --- */
  drawPitRoad(tk, HALF);
  drawStartFinish(tk, HALF);

  /* --- cars --- */
  const sorted = R.field.slice().sort((a, b) => (a.lane - b.lane));
  for (const c of sorted) {
    if (c.dnf && c.done) continue;
    const p = sampleTrack(tk, c.s);
    const lane = (c.lane - 0.5) * 2 * (HALF * 0.62);
    const w = W2S(offsetPoint(p, lane));
    const ang = W2Sang(p.h);
    cx.save(); cx.translate(w.x, w.y); cx.rotate(ang);
    if (c.pit > 0) cx.globalAlpha = 0.45;
    carSprite(cx, c.col, VIEW.sc > 0.22);
    if (c.isP && R.auraT > 0) {
      cx.strokeStyle = AURAS[R.auraTier].col; cx.lineWidth = 1.5;
      cx.strokeRect(-9, -6, 18, 12);
    }
    cx.restore();
    if (c.isP) {
      const bob = Math.sin(frame / 6) * 1.2;
      px(w.x - 2, w.y - 12 + bob, 5, 3, "#ffd23f");
      px(w.x - 1, w.y - 9 + bob, 3, 2, "#ffd23f");
    }
  }

  /* yellow-flag wash */
  if (R.yellow) {
    cx.fillStyle = "rgba(233,161,27,.16)"; cx.fillRect(0, 0, CW, CH);
    px(4, 4, 26, 9, "#e9a11b"); txt("CAUTION", 6, 11, "#3a2a00", 6);
  }
  /* countdown */
  if (R.phase === "grid") {
    const n = Math.ceil(R.timer);
    px(CW / 2 - 26, CH / 2 - 16, 52, 26, "rgba(10,17,48,.86)");
    txt(n > 0 ? String(n) : "GO!", CW / 2, CH / 2 + 4, "#ffd23f", 16, "center");
  }
  /* banner */
  if (R.msgT > 0) {
    const w = Math.min(CW - 16, R.msg.length * 6 + 16);
    px(CW / 2 - w / 2, 6, w, 14, "#e8332a");
    px(CW / 2 - w / 2, 6, w, 2, "#ff8b80");
    txt(R.msg, CW / 2, 16, "#fff", 7, "center");
  }
  /* mini map corner marker: lap + flag */
  drawFlagStand(tk, HALF);
}

function drawInfield(tk, HALF) {
  const c = W2S({ x: (tk.bounds.minx + tk.bounds.maxx) / 2, y: (tk.bounds.miny + tk.bounds.maxy) / 2 });
  const w = (tk.bounds.maxx - tk.bounds.minx) * VIEW.sc;
  const h = (tk.bounds.maxy - tk.bounds.miny) * VIEW.sc * VIEW.sq;
  const iw = (VIEW.rot ? h : w) * 0.4, ih = (VIEW.rot ? w : h) * 0.3;
  /* lake */
  cx.fillStyle = "#3f9fd8";
  cx.beginPath(); cx.ellipse(c.x + iw * 0.34, c.y + ih * 0.22, Math.max(6, iw * 0.22), Math.max(4, ih * 0.16), 0, 0, 7); cx.fill();
  cx.fillStyle = "#7fc9ec";
  cx.beginPath(); cx.ellipse(c.x + iw * 0.34, c.y + ih * 0.18, Math.max(4, iw * 0.15), Math.max(2, ih * 0.09), 0, 0, 7); cx.fill();
  /* garage stalls */
  const gx = c.x - iw * 0.55, gy = c.y - ih * 0.28;
  for (let i = 0; i < 6; i++) {
    px(gx + i * 9, gy, 8, 11, "#d8dde5"); px(gx + i * 9, gy, 8, 3, "#a8b0ba");
    px(gx + i * 9 + 2, gy + 5, 4, 6, "#6b7480");
  }
  px(gx - 2, gy - 5, 58, 4, "#e8332a");
  /* transporters parked */
  for (let i = 0; i < 3; i++) px(gx + 4 + i * 16, gy + 15, 14, 6, ["#e8e8ee", "#c8d2de", "#eee"][i]);
  /* infield trees */
  tree(c.x - iw * 0.1, c.y + ih * 0.35, 1);
  tree(c.x + iw * 0.05, c.y - ih * 0.45, 1);
}

/* Grandstands sit outside the track: the big one on the frontstretch
   (where the start/finish and pit road are), a smaller one opposite. */
function drawGrandstands(tk, HALF) {
  const all = straightRuns(tk);
  if (!all.length) return;
  const isRoad = R && R.track.surf === "road";
  /* the frontstretch is whichever straight holds the start/finish */
  const fi = all.findIndex(r2 => r2.start <= tk.sfDist && r2.end >= tk.sfDist);
  const ordered = fi >= 0 ? [all[fi]].concat(all.filter((_, i) => i !== fi)) : all;
  const stands = isRoad ? ordered.slice(0, 1) : ordered.slice(0, 2);

  stands.forEach((run, idx) => {
    const len = run.end - run.start;
    if (len < 70) return;
    const depth = isRoad ? 10 : (idx === 0 ? 26 : 16);
    const rows = isRoad ? 3 : (idx === 0 ? 6 : 4);
    const step = Math.max(4, len / 34);
    const front = [], back = [];
    for (let d = run.start + 6; d <= run.end - 6; d += step) {
      const p = sampleTrack(tk, d);
      front.push(W2S(offsetPoint(p, -HALF - 7)));
      back.push(W2S(offsetPoint(p, -HALF - 7 - depth)));
    }
    if (front.length < 2) return;
    /* concrete deck */
    cx.beginPath();
    cx.moveTo(front[0].x, front[0].y);
    for (const p of front) cx.lineTo(p.x, p.y);
    for (let i = back.length - 1; i >= 0; i--) cx.lineTo(back[i].x, back[i].y);
    cx.closePath();
    cx.fillStyle = "#aab2bb"; cx.fill();
    cx.strokeStyle = "#767d87"; cx.lineWidth = 1; cx.stroke();
    /* seating rows: a dark step line then a row of spectators */
    for (let rw = 0; rw < rows; rw++) {
      const t = (rw + 0.5) / rows;
      cx.beginPath();
      for (let i = 0; i < front.length; i++) {
        const x = front[i].x + (back[i].x - front[i].x) * t;
        const y = front[i].y + (back[i].y - front[i].y) * t;
        if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
      }
      cx.strokeStyle = "rgba(80,88,98,.55)"; cx.lineWidth = 1; cx.stroke();
      for (let i = 0; i < front.length; i++) {
        if (((i * 5 + rw * 7 + (frame >> 6)) % 9) < 2) continue;   // a few empty seats
        const x = front[i].x + (back[i].x - front[i].x) * t;
        const y = front[i].y + (back[i].y - front[i].y) * t;
        const col = ["#e8332a", "#2255cc", "#ffd23f", "#ffffff", "#3fae4a", "#d457a0", "#ff8c42", "#8a3fc2"][(i * 3 + rw) % 8];
        px(x - 1, y - 2, 2, 2, col);
      }
    }
    /* roof lip on the main stand */
    if (idx === 0 && !isRoad) {
      cx.beginPath();
      for (let i = 0; i < back.length; i++) { if (i === 0) cx.moveTo(back[i].x, back[i].y); else cx.lineTo(back[i].x, back[i].y); }
      cx.strokeStyle = "#5c636c"; cx.lineWidth = 3; cx.stroke();
    }
  });
}
/* find the longest straight runs (used for stands + pit road) */
function straightRuns(tk) {
  const runs = []; let st = null;
  for (let i = 0; i < tk.pts.length; i++) {
    if (tk.pts[i].c === 0) { if (st === null) st = tk.pts[i].s; }
    else if (st !== null) { runs.push({ start: st, end: tk.pts[i].s }); st = null; }
  }
  if (st !== null) runs.push({ start: st, end: tk.len });
  return runs.sort((a, b) => (b.end - b.start) - (a.end - a.start));
}
function drawPitRoad(tk, HALF) {
  const runs = straightRuns(tk);
  const fs = runs.find(r => r.start <= tk.sfDist && r.end >= tk.sfDist) || runs[0];
  const step = Math.max(4, (fs.end - fs.start) / 22);
  /* pit lane surface */
  const lane = [];
  for (let d = fs.start; d <= fs.end; d += step) lane.push(W2S(offsetPoint(sampleTrack(tk, d), HALF + 6)));
  if (lane.length > 1) {
    cx.strokeStyle = "#77808c"; cx.lineWidth = Math.max(3, 7 * VIEW.sc * 0.5);
    tracePoly(lane, false); cx.stroke();
    cx.strokeStyle = "#e8ecf2"; cx.lineWidth = 1;
    tracePoly(lane, false); cx.stroke();
  }
  /* pit boxes with crew */
  let i = 0;
  for (let d = fs.start + step; d < fs.end - step; d += step * 1.5, i++) {
    const p = sampleTrack(tk, d);
    const b = W2S(offsetPoint(p, HALF + 11));
    px(b.x - 2, b.y - 2, 5, 4, i === 0 ? "#e8332a" : "#c8ced8");
    if (VIEW.sc > 0.18 && i % 2 === 0) px(b.x + 3, b.y - 1, 1, 3, "#20232c");
  }
}
function drawStartFinish(tk, HALF) {
  /* two staggered rows of checks, drawn across the full racing surface */
  for (let row = 0; row < 2; row++) {
    const p = sampleTrack(tk, tk.sfDist + row * 5);
    const a = offsetPoint(p, -HALF), b = offsetPoint(p, HALF);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const p0 = W2S({ x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 });
      const p1 = W2S({ x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 });
      cx.strokeStyle = (i + row) % 2 ? "#1c1c22" : "#ffffff";
      cx.lineWidth = 4; cx.lineCap = "butt";
      cx.beginPath(); cx.moveTo(p0.x, p0.y); cx.lineTo(p1.x, p1.y); cx.stroke();
    }
  }
}
function drawFlagStand(tk, HALF) {
  const p = sampleTrack(tk, tk.sfDist);
  const s = W2S(offsetPoint(p, -HALF - 9));
  px(s.x - 3, s.y - 12, 7, 12, "#c8ced8");
  px(s.x - 4, s.y - 15, 9, 4, "#e8332a");
  /* waving flag */
  const f = (frame >> 3) % 2;
  for (let i = 0; i < 3; i++)
    px(s.x + 4, s.y - 14 + i * 2, 4, 2, (i + f) % 2 ? "#20232c" : "#ffffff");
}
