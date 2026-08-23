/* ============================================================
   RENDERER — chunky pixel art, 2.5D.

   The race runs on a diagonal ground plane with a camera that
   follows your car, so cars are big enough to carry real detail
   and you can actually see a pass happen.  Everything is drawn
   procedurally — there are no image assets.
   ============================================================ */
"use strict";

let cv, cx, CW = 200, CH = 400, SCALE = 2, frame = 0;
let DPR = 1, PX = 2;        // PX = size of one "art pixel" in CSS pixels
const U = () => PX / 2;     // scale for trackside furniture authored at PX=2

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
  /* Draw in CSS pixels but back the canvas with real device pixels, so
     lines and text are sharp instead of a stretched low-res bitmap.
     Sprites stay chunky because they are drawn PX css-px per art pixel. */
  DPR = clamp(window.devicePixelRatio || 1, 1, 2);
  CW = Math.max(300, Math.round(rw));
  CH = Math.max(360, Math.round(rh));
  PX = clamp(Math.round(CW / 190), 2, 4);
  SCALE = PX;
  cv.width = Math.round(CW * DPR);
  cv.height = Math.round(CH * DPR);
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.imageSmoothingEnabled = false;
  DITH_CACHE = new Map();
  CAR_ATLAS = null;                   // rebake at the new size
}

/* ---------- pixel helpers ---------- */
function px(x, y, w, h, c) { cx.fillStyle = c; cx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
/* Dithered fill.  The naive version stamped one rectangle per pixel and
   cost ~14 ms a frame on a full-screen ground fill; this bakes the tile
   once and lets the GPU repeat it.                                    */
let DITH_CACHE = new Map();
function dithPattern(c1, c2, step) {
  const key = c1 + "|" + c2 + "|" + step;
  let p = DITH_CACHE.get(key);
  if (p) return p;
  const t = document.createElement("canvas");
  t.width = step * 2; t.height = 4;
  const g = t.getContext("2d");
  g.fillStyle = c1; g.fillRect(0, 0, t.width, t.height);
  g.fillStyle = c2;
  for (let j = 0; j < 4; j += 2)
    for (let i = (((j / 2) | 0) % 2 ? 0 : 2); i < t.width; i += step) g.fillRect(i, j, 1, 1);
  p = cx.createPattern(t, "repeat");
  DITH_CACHE.set(key, p);
  return p;
}
function dith(x, y, w, h, c1, c2, step) {
  step = step || 4;
  cx.save();
  cx.translate(Math.round(x), Math.round(y));
  cx.fillStyle = dithPattern(c1, c2, step);
  cx.fillRect(0, 0, Math.round(w), Math.round(h));
  cx.restore();
}
function txt(s, x, y, c, size, align) {
  cx.fillStyle = c; cx.font = "bold " + Math.round((size || 7) * PX) + "px monospace";
  cx.textAlign = align || "left"; cx.textBaseline = "alphabetic";
  cx.fillText(s, Math.round(x), Math.round(y));
}
function txtO(s, x, y, c, size, align) {          // outlined display text
  cx.font = "bold " + Math.round((size || 7) * PX) + "px monospace";
  cx.textAlign = align || "left"; cx.textBaseline = "alphabetic";
  cx.lineWidth = 3 * (PX / 2); cx.strokeStyle = "#101a45"; cx.lineJoin = "round";
  cx.strokeText(s, Math.round(x), Math.round(y));
  cx.fillStyle = c; cx.fillText(s, Math.round(x), Math.round(y));
}

const SKIN = ["#f7c8a0", "#efb488", "#d9996a", "#b87a4a"];
const HAIR = ["#4a2c12", "#171717", "#a4442e", "#e0b74a", "#8a8a8a", "#6a3fa0", "#2e5fa3", "#b5651d"];
const SHIRT = ["#e8332a", "#2255cc", "#ffd23f", "#ffffff", "#3fae4a", "#d457a0", "#ff8c42", "#7a4c22",
               "#12b0b0", "#8a3fc2", "#e8e8ee", "#c0392b"];
const TEAMC = ["#e8332a", "#2255cc", "#e9a11b", "#3fae4a", "#8a3fc2", "#12b0b0", "#d457a0", "#f0f0f0"];

/* ============================================================
   PEOPLE
   ============================================================ */
/* A packed spectator, 5×10.  `wave` lifts the arms. */
/* Chibi staff: big head, tiny body, four facings, two walk frames */

/* ============================================================
   3D helpers — everything on the ground plane can be extruded
   upward, which is what gives objects real volume.
   ============================================================ */
function quadS(a, b, c, d, fill) {
  cx.beginPath();
  cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.lineTo(c.x, c.y); cx.lineTo(d.x, d.y);
  cx.closePath(); cx.fillStyle = fill; cx.fill();
}
const lift = (p, h) => ({ x: p.x, y: p.y - h });
/* Extrude a ground edge upward into a wall face. */
function face(p1, p2, h, fill) { quadS(p1, p2, lift(p2, h), lift(p1, h), fill); }
/* The four ground corners of a box sitting on the track. */
function boxCorners(p, off, L, W) {
  const cs = Math.cos(p.h), sn = Math.sin(p.h);
  const nx = -sn, ny = cs;
  const ox = p.x + nx * off, oy = p.y + ny * off;
  const hl = L / 2, hw = W / 2;
  return [
    { x: ox + cs * hl + nx * hw, y: oy + sn * hl + ny * hw },
    { x: ox + cs * hl - nx * hw, y: oy + sn * hl - ny * hw },
    { x: ox - cs * hl - nx * hw, y: oy - sn * hl - ny * hw },
    { x: ox - cs * hl + nx * hw, y: oy - sn * hl + ny * hw },
  ];
}

/* ============================================================
   THE STOCK CAR — a real extruded body with a driver in it
   ============================================================ */
const SQ_F = 0.58;

/* The real one: takes the four projected ground corners.
   cor[0]=front-left cor[1]=front-right cor[2]=rear-right cor[3]=rear-left */
function paintCar(cor, H, col, num, L) {
  const dark = shade(col, -0.40), mid = shade(col, -0.16), lite = shade(col, 0.30);
  const cxm = (cor[0].x + cor[1].x + cor[2].x + cor[3].x) / 4;
  const cym = (cor[0].y + cor[1].y + cor[2].y + cor[3].y) / 4;

  /* ground shadow */
  cx.save();
  cx.beginPath();
  cx.moveTo(cor[0].x + 1, cor[0].y + 2);
  for (let i = 1; i < 4; i++) cx.lineTo(cor[i].x + 1, cor[i].y + 2);
  cx.closePath(); cx.fillStyle = "rgba(0,0,0,.28)"; cx.fill();
  cx.restore();

  /* wheels: little extruded blocks tucked under the corners */
  const wh = Math.max(2, H * 0.55);
  for (let i = 0; i < 4; i++) {
    const a = cor[i], b = cor[(i + 1) % 4];
    if (i % 2 === 0) continue;                       // only the two long sides
    for (const t of [0.20, 0.76]) {
      const wx = a.x + (b.x - a.x) * t, wy = a.y + (b.y - a.y) * t;
      const w = Math.max(2, L * 0.17);
      quadS({ x: wx - w / 2, y: wy }, { x: wx + w / 2, y: wy },
            { x: wx + w / 2, y: wy - wh }, { x: wx - w / 2, y: wy - wh }, "#17181d");
      px(wx - w / 2, wy - wh, w, 1, "#3a3d45");
    }
  }

  /* side faces, far ones first so the near ones overlap correctly */
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const a = cor[i], b = cor[(i + 1) % 4];
    const my = (a.y + b.y) / 2;
    const isSide = i % 2 === 1;
    faces.push({ a, b, my, fill: isSide ? mid : (my > cym ? dark : shade(col, -0.26)) });
  }
  faces.sort((p, q) => p.my - q.my);
  for (const f of faces) face(f.a, f.b, H, f.fill);

  /* top deck */
  const top = cor.map(p => lift(p, H));
  quadS(top[0], top[1], top[2], top[3], col);
  /* a highlight stripe down the middle of the deck */
  const mixp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  quadS(mixp(top[0], top[1], 0.34), mixp(top[0], top[1], 0.66),
        mixp(top[3], top[2], 0.66), mixp(top[3], top[2], 0.34), lite);

  /* cabin: a smaller box standing on the deck */
  const ch = Math.max(2, H * 0.62);
  const cA = mixp(mixp(top[0], top[1], 0.18), mixp(top[3], top[2], 0.18), 0.30);
  const cB = mixp(mixp(top[0], top[1], 0.82), mixp(top[3], top[2], 0.82), 0.30);
  const cC = mixp(mixp(top[0], top[1], 0.82), mixp(top[3], top[2], 0.82), 0.80);
  const cD = mixp(mixp(top[0], top[1], 0.18), mixp(top[3], top[2], 0.18), 0.80);
  face(cD, cC, ch, shade(col, -0.30));
  face(cA, cD, ch, mid); face(cC, cB, ch, mid);
  face(cB, cA, ch, "#8fc4e8");                                  // windscreen
  quadS(lift(cA, ch), lift(cB, ch), lift(cC, ch), lift(cD, ch), shade(col, -0.06));

  /* driver: helmet above the cabin */
  if (L > 16) {
    const hx = (cA.x + cB.x + cC.x + cD.x) / 4, hy = (cA.y + cB.y + cC.y + cD.y) / 4 - ch - 1;
    const hr = Math.max(1.6, L * 0.10);
    cx.fillStyle = "#f4f4f4";
    cx.beginPath(); cx.arc(hx, hy, hr, 0, 7); cx.fill();
    cx.fillStyle = "#5fc0f0";
    cx.fillRect(hx - hr * 0.5, hy - hr * 0.25, hr * 1.5, hr * 0.75);
    cx.fillStyle = "#c9ced6"; cx.fillRect(hx - hr, hy - hr * 1.1, hr * 2, hr * 0.4);
  }

  /* rear wing on posts */
  const wA = mixp(top[3], top[2], 0.12), wB = mixp(top[3], top[2], 0.88);
  const wh2 = Math.max(2, H * 0.75);
  px(wA.x, wA.y - wh2, 1.4, wh2, dark); px(wB.x - 1, wB.y - wh2, 1.4, wh2, dark);
  face(lift(wA, wh2 - 1.5), lift(wB, wh2 - 1.5), Math.max(1.5, H * 0.22), lite);

  /* number roundel on the deck */
  if (L > 18 && num != null) {
    const r0 = Math.max(2.4, L * 0.15);
    cx.fillStyle = "#ffffff";
    cx.beginPath(); cx.arc(cxm, cym - H - ch * 0.1, r0, 0, 7); cx.fill();
    cx.fillStyle = "#16181f";
    cx.font = "bold " + Math.round(r0 * 1.5) + "px monospace";
    cx.textAlign = "center"; cx.textBaseline = "middle";
    cx.fillText(String(num), cxm, cym - H - ch * 0.1 + 0.5);
  }
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt > 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return "rgb(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ")";
}
function carColor(car) { return TEAMC[car.paint % 8]; }

/* ---------- scenery ---------- */

/* ============================================================
   TITLE
   ============================================================ */
function drawTitle() {
  const sky = cx.createLinearGradient(0, 0, 0, CH * 0.62);
  sky.addColorStop(0, "#1e3a8c"); sky.addColorStop(1, "#7fb8ee");
  cx.fillStyle = sky; cx.fillRect(0, 0, CW, CH);
  for (let i = 0; i < 20; i++) {
    const x = (i * 71 + ((frame / 4) | 0)) % (CW + 40) - 20;
    px(x, 22 + (i % 4) * 13, 11, 4, "rgba(255,255,255,.6)");
    px(x + 3, 19 + (i % 4) * 13, 6, 3, "rgba(255,255,255,.6)");
  }
  const hz = Math.round(CH * 0.52);
  px(0, hz - 30, CW, 22, "#98a0a9");
  px(0, hz - 33, CW, 4, "#6d747d");
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < CW; i += 6)
      spectator(i + (r % 2) * 3, hz - 28 + r * 7, i + r * 5, ((frame >> 4) + i) % 3 === 0);
  px(0, hz - 8, CW, 4, "#c9d0da");
  for (let i = 0; i < CW; i += 22)
    px(i + 1, hz - 6, 20, 5, ["#e8332a", "#ffd23f", "#2255cc", "#3fae4a"][((i / 22) | 0) % 4]);
  dith(0, hz - 2, CW, CH - hz + 2, "#5b6068", "#53585f", 6);
  px(0, hz + 26, CW, 2, "#e8ecf2");
  for (let i = 0; i < CW; i += 18) px(i, hz + 14, 9, 2, "#e8ecf2");
  const t = frame * 0.9;
  const cars = [[0, 34, 0, "stock"], [-30, 27, 1, "aero"], [-56, 40, 2, "stock"], [-84, 30, 3, "truck"]];
  for (const [ox, oy, ci, mdl] of cars) {
    const x = ((t + ox + 400) % (CW + 130)) - 60;
    drawCarSprite(x, hz + oy, 0, ci, mdl, 32);
  }
  const ty = Math.round(CH * 0.20);
  txtO("STOCK CAR", CW / 2, ty, "#ffd23f", Math.round(CW / 9), "center");
  txtO("STORY", CW / 2, ty + Math.round(CW / 8), "#ffd23f", Math.round(CW / 9), "center");
  px(CW / 2 - 58, ty + Math.round(CW / 8) + 7, 116, 2, "#e8332a");
  txt("BUILD THE GREATEST TEAM IN RACING", CW / 2, ty + Math.round(CW / 8) + 19, "#eaf2ff", 6, "center");
}

/* ============================================================
   THE SHOP — isometric garage
   ============================================================ */
let TW = 16, TH = 8;
let ISO = { ox: 0, oy: 0 };
function iso(gx, gy) { return { x: ISO.ox + (gx - gy) * TW, y: ISO.oy + (gx + gy) * TH }; }
function isoTile(gx, gy, top) {
  const p = iso(gx, gy);
  cx.fillStyle = top;
  cx.beginPath();
  cx.moveTo(p.x, p.y - TH); cx.lineTo(p.x + TW, p.y); cx.lineTo(p.x, p.y + TH); cx.lineTo(p.x - TW, p.y);
  cx.closePath(); cx.fill();
}
function isoBox(gx, gy, w, d, h, top, l, r) {
  const p = iso(gx, gy);
  const dx = w * TW, dy = d * TH;
  cx.fillStyle = l;
  cx.beginPath(); cx.moveTo(p.x - dx, p.y); cx.lineTo(p.x, p.y + dy);
  cx.lineTo(p.x, p.y + dy - h); cx.lineTo(p.x - dx, p.y - h); cx.closePath(); cx.fill();
  cx.fillStyle = r;
  cx.beginPath(); cx.moveTo(p.x + dx, p.y); cx.lineTo(p.x, p.y + dy);
  cx.lineTo(p.x, p.y + dy - h); cx.lineTo(p.x + dx, p.y - h); cx.closePath(); cx.fill();
  cx.fillStyle = top;
  cx.beginPath(); cx.moveTo(p.x, p.y - dy - h); cx.lineTo(p.x + dx, p.y - h);
  cx.lineTo(p.x, p.y + dy - h); cx.lineTo(p.x - dx, p.y - h); cx.closePath(); cx.fill();
}

let walkers = [];
function syncWalkers() {
  const staff = G.drivers.map(d => ({ s: d, k: "driver" })).concat(G.crew.map(c => ({ s: c, k: "crew" })));
  while (walkers.length < staff.length)
    walkers.push({ x: rnd(0.6, 5.4), y: rnd(0.6, 5.4), tx: rnd(0.6, 5.4), ty: rnd(0.6, 5.4), t: rnd(0, 4), f: "down" });
  walkers.length = staff.length;
  return staff;
}
let HOTSPOTS = [];
function drawGarage() {
  HOTSPOTS = [];
  const ROOM = 6;
  dith(0, 0, CW, CH, "#79c34d", "#6cb545", 6);
  /* fit the shop floor to the screen width */
  TW = Math.max(11, Math.floor((CW * 0.96) / (2 * ROOM)));
  TH = Math.max(6, Math.round(TW * 0.60));
  ISO.ox = Math.round(CW / 2);
  ISO.oy = Math.round(CH * 0.30);

  /* yard behind the shop */
  px(0, 0, CW, Math.round(CH * 0.17), "#8a9099");
  for (let i = 0; i < CW; i += 26) px(i, Math.round(CH * 0.10), 14, 2, "#e6e9ee");
  const tx = Math.round(CW * 0.52), ty = Math.round(CH * 0.04);
  px(tx, ty, 46, 17, "#e9eef5"); px(tx - 13, ty + 5, 14, 12, "#c3ccd8");
  px(tx - 11, ty + 7, 8, 5, "#8fb7d8");
  px(tx + 2, ty + 4, 30, 7, "#e8332a"); txt("RACING", tx + 4, ty + 10, "#fff", 6);
  px(tx - 10, ty + 16, 7, 4, "#20232c"); px(tx + 8, ty + 16, 7, 4, "#20232c"); px(tx + 33, ty + 16, 7, 4, "#20232c");
  tree(18, Math.round(CH * 0.16), 1); tree(CW - 18, Math.round(CH * 0.14), 1);

  /* floor */
  for (let gx = 0; gx < ROOM; gx++)
    for (let gy = 0; gy < ROOM; gy++)
      isoTile(gx, gy, (gx + gy) % 2 ? "#c98f52" : "#bd8449");
  cx.strokeStyle = "#e9a11b"; cx.lineWidth = 1.5;
  const c0 = iso(1.6, 1.6), c1 = iso(4.4, 1.6), c2 = iso(4.4, 4.4), c3 = iso(1.6, 4.4);
  cx.beginPath(); cx.moveTo(c0.x, c0.y); cx.lineTo(c1.x, c1.y); cx.lineTo(c2.x, c2.y); cx.lineTo(c3.x, c3.y); cx.closePath(); cx.stroke();

  /* walls */
  const WH = 42;
  for (let gx = 0; gx < ROOM; gx++) {
    const a = iso(gx, -0.5), b = iso(gx + 1, -0.5);
    cx.fillStyle = "#9aa2ab";
    cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y);
    cx.lineTo(b.x, b.y - WH); cx.lineTo(a.x, a.y - WH); cx.closePath(); cx.fill();
  }
  for (let gy = 0; gy < ROOM; gy++) {
    const a = iso(-0.5, gy), b = iso(-0.5, gy + 1);
    cx.fillStyle = "#848c95";
    cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y);
    cx.lineTo(b.x, b.y - WH); cx.lineTo(a.x, a.y - WH); cx.closePath(); cx.fill();
  }
  /* corrugated sheeting + roof trim */
  cx.strokeStyle = "rgba(255,255,255,.13)"; cx.lineWidth = 1;
  for (let g = 0; g <= ROOM * 3; g++) {
    const a = iso(g / 3, -0.5), b = iso(-0.5, g / 3);
    cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(a.x, a.y - WH); cx.stroke();
    cx.beginPath(); cx.moveTo(b.x, b.y); cx.lineTo(b.x, b.y - WH); cx.stroke();
  }
  {
    const a = iso(0, -0.5), b = iso(ROOM, -0.5), c = iso(-0.5, ROOM);
    cx.fillStyle = "#6d747d";
    cx.beginPath(); cx.moveTo(a.x, a.y - WH); cx.lineTo(b.x, b.y - WH);
    cx.lineTo(b.x, b.y - WH - 4); cx.lineTo(a.x, a.y - WH - 4); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(a.x, a.y - WH); cx.lineTo(c.x, c.y - WH);
    cx.lineTo(c.x, c.y - WH - 4); cx.lineTo(a.x, a.y - WH - 4); cx.closePath(); cx.fill();
  }
  {
    const a = iso(0.3, -0.5), b = iso(3.2, -0.5);
    cx.fillStyle = "#e8332a";
    cx.beginPath(); cx.moveTo(a.x, a.y - WH + 6); cx.lineTo(b.x, b.y - WH + 6);
    cx.lineTo(b.x, b.y - WH + 20); cx.lineTo(a.x, a.y - WH + 20); cx.closePath(); cx.fill();
    const nm = G.sponsors.length ? byId(SPONSORS, G.sponsors[0].id).n.toUpperCase() : "STOCK CAR STORY";
    cx.save(); cx.translate((a.x + b.x) / 2, (a.y + b.y) / 2 - WH + 16);
    cx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
    txt(nm.slice(0, 13), 0, 0, "#fff", 6, "center"); cx.restore();
  }
  {
    const a = iso(-0.5, 1.2), b = iso(-0.5, 3.4);
    cx.fillStyle = "#a9dcff";
    cx.beginPath(); cx.moveTo(a.x, a.y - WH + 8); cx.lineTo(b.x, b.y - WH + 8);
    cx.lineTo(b.x, b.y - WH + 24); cx.lineTo(a.x, a.y - WH + 24); cx.closePath(); cx.fill();
    cx.strokeStyle = "#6d747d"; cx.lineWidth = 1.5; cx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const a = iso(3.6 + i * 0.75, -0.5);
    px(a.x - 6, a.y - WH + 24, 13, 3, "#5d452c");
    for (let k = 0; k < 3; k++) px(a.x - 5 + k * 4, a.y - WH + 20, 3, 4, ["#cc4444", "#4477cc", "#44aa66"][k]);
    px(a.x - 6, a.y - WH + 32, 13, 3, "#5d452c");
    for (let k = 0; k < 3; k++) px(a.x - 5 + k * 4, a.y - WH + 28, 3, 4, ["#ddaa33", "#8a3fc2", "#cc4444"][k]);
  }

  /* depth-sorted contents */
  const items = [];
  const at = (gx, gy) => iso(gx, gy);
  items.push({ d: 5.6, f: () => { const p = at(0.4, 5.2); tyreStack(p.x - 4, p.y, 4); } });
  items.push({ d: 4.8, f: () => { const p = at(0.4, 4.4); tyreStack(p.x - 4, p.y, 3); } });
  items.push({ d: 5.6, f: () => isoBox(5.4, 0.2, 0.55, 0.55, 13, "#8a6a3c", "#6f5430", "#7b5e35") });
  items.push({ d: 5.5, f: () => isoBox(5.2, 0.3, 0.28, 0.28, 9, "#cc3a3a", "#992a2a", "#b03232") });
  items.push({ d: 1.0, f: () => isoBox(0.4, 0.6, 0.3, 0.3, 12, "#c0392b", "#8d2a20", "#a83125") });
  items.push({ d: 1.6, f: () => isoBox(0.4, 1.2, 0.3, 0.3, 10, "#2a55c8", "#1d3c91", "#2447ab") });
  items.push({ d: 9.4, f: () => isoBox(4.6, 4.8, 0.5, 0.5, 11, "#8a929c", "#69707a", "#79818b") });
  items.push({ d: 10.4, f: () => {
    const p = at(5.2, 5.2);
    isoBox(5.2, 5.2, 0.5, 0.5, 14, "#6d5334", "#513c26", "#5f472d");
    px(p.x - 5, p.y - 21, 3, 6, "#ffd23f"); px(p.x - 6, p.y - 15, 5, 2, "#e0a800");
    px(p.x + 2, p.y - 19, 3, 5, "#c8d2de"); px(p.x + 1, p.y - 14, 5, 2, "#9aa4b2");
  } });

  const team = G.teams[G.curTeam];
  const car = team && G.cars[team.car];
  if (car) items.push({ d: 6.0, f: () => {
    const p = at(3.0, 3.0);
    /* the lift pad, then the machine sitting on it */
    isoBox(3.0, 3.0, 1.15, 1.15, 4, "#b8bfc8", "#8f97a1", "#a2aab4");
    const sz = Math.max(30, TW * 2.6);
    drawCarSprite(p.x, p.y - 8, -0.62, car.paint % 8, CHASSIS_MODEL[car.id] || "stock", sz);
    tapLabel(p.x, p.y + 10 * PX + TH * 2.4, "#" + car.num + " " + car.name, "scrCars", sz * 1.2, sz);
  } });

  const staff = syncWalkers();
  walkers.forEach((w, i) => {
    w.t -= 1 / 60;
    if (w.t <= 0) { w.tx = rnd(0.5, 5.5); w.ty = rnd(0.5, 5.5); w.t = rnd(2.5, 6); }
    const dx = w.tx - w.x, dy = w.ty - w.y;
    const md = Math.hypot(dx, dy);
    if (md > 0.05) { w.x += (dx / md) * 0.014; w.y += (dy / md) * 0.014; }
    w.f = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    const p = iso(w.x, w.y);
    const moving = md > 0.08;
    items.push({ d: w.x + w.y, f: () => chibi(p.x - 4, p.y - 15, staff[i].s.face, staff[i].k, w.f, moving && ((frame >> 3) % 2)) });
  });

  /* extra shop furniture */
  items.push({ d: 2.2, f: () => isoBox(1.8, 0.4, 0.34, 0.34, 15, "#7d848f", "#5e646d", "#6c727c") });   // engine hoist post
  items.push({ d: 3.0, f: () => { const p = at(2.4, 0.6); px(p.x - 8, p.y - 22, 16, 3, "#5e646d"); px(p.x - 2, p.y - 19, 3, 7, "#3c414a"); } });
  items.push({ d: 8.0, f: () => isoBox(3.4, 4.6, 0.45, 0.45, 8, "#3f7a46", "#2c5a32", "#35683a") });    // sofa
  items.push({ d: 7.2, f: () => isoBox(0.5, 3.4, 0.3, 0.3, 16, "#c0392b", "#8d2a20", "#a83125") });     // vending machine
  items.push({ d: 4.4, f: () => { const p = at(0.5, 3.4); px(p.x - 4, p.y - 14, 8, 5, "#ffd7d2"); } });

  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.f();

  /* tappable people: whoever is standing furthest forward gets the label */
  {
    const a = iso(0.5, 4.8);                       // by the tyre stacks, front-left
    tapLabel(a.x + 6 * PX, a.y + 4 * PX, "Team", "scrTeam", 46 * (PX / 2), 30 * (PX / 2));
  }
  {
    const a = iso(1.4, -0.5);                      // the banner, high on the wall
    tapLabel(a.x, a.y - WH + 26 * (PX / 2), G.sponsors.length ? "Sponsors" : "Get a sponsor",
      "scrSponsors", 86 * (PX / 2), 26 * (PX / 2));
  }
  {
    const a = iso(5.4, 0.6);                       // by the bench, back-right
    tapLabel(a.x - 4 * PX, a.y + 4 * PX, "Develop", "scrDevelop", 60 * (PX / 2), 30 * (PX / 2));
  }

  /* --- the yard in front of the shop, laid out proportionally so it
         always fills whatever space is left below the building --- */
  const yardY = ISO.oy + ROOM * 2 * TH + 12;
  const yh = Math.max(40, CH - yardY);
  const Y = f => yardY + yh * f;
  const u = PX / 2;
  dith(0, yardY, CW, yh, "#9aa0a8", "#8d939b", 6);
  px(0, yardY, CW, 2 * u, "#7b818a");

  /* team haulers backed up to the shop */
  const hw = 34 * u, hh = 12 * u;
  for (let i = 0; i < 3; i++) {
    const hx = 8 + i * Math.round((CW - 16 - hw) / 2);
    px(hx, Y(0.06), hw, hh, ["#e9eef5", "#c8d2de", "#eef1f6"][i]);
    px(hx + 2 * u, Y(0.06) + 3 * u, hw * 0.55, 5 * u, ["#e8332a", "#2255cc", "#e9a11b"][i]);
    px(hx + 3 * u, Y(0.06) + hh, 6 * u, 3 * u, "#20232c");
    px(hx + hw - 9 * u, Y(0.06) + hh, 6 * u, 3 * u, "#20232c");
  }
  /* drums, spare tyres and crates along the middle */
  for (let i = 0; i < 6; i++) {
    const bx = 14 + i * Math.round((CW - 34) / 6);
    if (i % 3 === 0) tyreStack(bx, Y(0.40), 2);
    else if (i % 3 === 1) drawProp(PROP_DRUM, bx, Y(0.34));
    else drawProp(PROP_TOOLBOX, bx, Y(0.36));
  }
  /* painted parking bays */
  cx.strokeStyle = "#e7eaee"; cx.lineWidth = 2 * u;
  for (let i = 0; i < 6; i++) {
    const bx = 10 + i * ((CW - 20) / 6);
    cx.beginPath(); cx.moveTo(bx, Y(0.52)); cx.lineTo(bx, Y(0.66)); cx.stroke();
  }
  cx.beginPath(); cx.moveTo(0, Y(0.66)); cx.lineTo(CW, Y(0.66)); cx.stroke();

  /* the fence and the fans who hang around outside it */
  const fy = Y(0.74);
  px(0, fy, CW, 2 * u, "#c9d0da");
  for (let i = 4; i < CW; i += 13 * u) px(i, fy, 2 * u, 9 * u, "#b3bac4");
  for (let i = 6; i < CW - 10; i += 11 * PX)
    if ((i * 7) % 5 < 3) spectator(i, fy + 7 * u, i, ((frame >> 5) + i) % 3 === 0);

  /* the access road running past the gate */
  const ry = Y(0.90);
  dith(0, ry, CW, CH - ry, "#7d838c", "#747a83", 6);
  px(0, ry, CW, 2 * u, "#5c626b");
  for (let i = 6; i < CW; i += 26 * u) px(i, ry + (CH - ry) / 2, 13 * u, 2 * u, "#e9e9e9");
  tree(14 * u, ry - 2 * u, 1, "pine");
  tree(CW - 14 * u, ry - 2 * u, 1, "pine");

  /* status bubbles */
  let by = Math.round(CH * 0.36) - 66;
  const bubble = (s, col) => {
    cx.font = "bold 7px monospace";
    const w = cx.measureText(s).width + 10;
    px(6, by, w, 14, "#ffffff"); px(6, by, w, 2, "#dfe6f2");
    cx.strokeStyle = "#20232c"; cx.lineWidth = 1; cx.strokeRect(6.5, by + 0.5, w - 1, 13);
    px(12, by + 14, 5, 3, "#ffffff");
    txt(s, 11, by + 10, col, 7);
    by += 19;
  };
  if (G.build) bubble("Building " + G.build.wks + "w", "#2255cc");
  if (G.repair) bubble("Repair " + G.repair.wks + "w", "#e8332a");
  if (car && car.dur < carStats(car).maxdur * 0.35) bubble("Machine damaged!", "#e8332a");
  if (!G.build && !G.repair && G.rp >= 40) bubble("Research ready", "#1a8a2e");
  if (G.offers.length && G.sponsors.length < 2) bubble("Sponsor offer!", "#c47b00");
}

/* A labelled, tappable spot in the shop.  The label is what turns a
   pretty scene into something a player can actually operate.        */
function tapLabel(x, y, text, action, w, h) {
  HOTSPOTS.push({ x: x - w / 2, y: y - h, w, h, action });
  cx.font = "bold " + Math.round(7 * PX) + "px monospace";
  const tw = cx.measureText(text).width + 8 * PX;
  const bx = Math.round(x - tw / 2), by = Math.round(y);
  px(bx, by, tw, 11 * PX, "rgba(10,17,48,.90)");
  px(bx, by, tw, 1.5 * PX, "#5f74c8");
  px(bx + tw / 2 - 3 * PX, by - 3 * PX, 6 * PX, 3 * PX, "rgba(10,17,48,.90)");
  txt(text, x, by + 8 * PX, "#ffffff", 7, "center");
}
function hitHotspot(cssX, cssY) {
  for (let i = HOTSPOTS.length - 1; i >= 0; i--) {
    const s = HOTSPOTS[i];
    if (cssX >= s.x && cssX <= s.x + s.w && cssY >= s.y && cssY <= s.y + s.h) return s.action;
  }
  return null;
}

/* ============================================================
   RACE — diagonal 2.5D plane, camera follows your car
   ============================================================ */
let VIEW = null;
/* Where the car points on screen: up and slightly right, so the track
   runs diagonally and the outside wall is always on the left. */
const TARGET_ANG = -1.12;
const SQ = 0.56;
/* the car sits low and right, leaving the upper-left for wall + crowd */
const ANCH_X = 0.56, ANCH_Y = 0.66;

const CAR_WORLD = 5.6;                 // a stock car is 5.6 world units long
function setupView(tk) {
  /* Zoom is set by how big we want the CAR, not by how big the track is —
     otherwise a 2.5-mile superspeedway renders the cars as specks.  The
     racing surface then gets a fixed world width, so it looks the same on
     every track and stays correctly thin relative to a long lap.        */
  const carPx = clamp(CW * 0.115, 34, 100);
  const sc = carPx / CAR_WORLD;
  const HALF = (CW * 0.27) / sc;
  VIEW = { sc, HALF, cx: 0, cy: 0, rot: 0, ready: false };
}
/* Chase camera: follows the car and rotates with it, so the racing
   surface always runs the same way up the screen. */
function camFollow(p) {
  if (!VIEW) return;
  const wantRot = TARGET_ANG - p.h;
  const far = !VIEW.ready || Math.hypot(p.x - VIEW.cx, p.y - VIEW.cy) > 90;
  if (far) { VIEW.cx = p.x; VIEW.cy = p.y; VIEW.rot = wantRot; VIEW.ready = true; return; }
  VIEW.cx += (p.x - VIEW.cx) * 0.16;
  VIEW.cy += (p.y - VIEW.cy) * 0.16;
  let dl = wantRot - VIEW.rot;
  while (dl > Math.PI) dl -= 2 * Math.PI;
  while (dl < -Math.PI) dl += 2 * Math.PI;
  VIEW.rot += dl * 0.10;
}
function W2S(p) {
  const v = VIEW;
  const dx = p.x - v.cx, dy = p.y - v.cy;
  const c = Math.cos(v.rot), s = Math.sin(v.rot);
  const rx = dx * c - dy * s, ry = dx * s + dy * c;
  return { x: CW * ANCH_X + rx * v.sc, y: CH * ANCH_Y + ry * v.sc * SQ };
}
function W2Sang(h) {
  const a = h + VIEW.rot;
  return Math.atan2(Math.sin(a) * SQ, Math.cos(a));
}
const onScreen = (p, m) => p.x > -(m || 40) && p.x < CW + (m || 40) && p.y > -(m || 40) && p.y < CH + (m || 40);
function laneOffset(lane) { return (0.5 - lane) * 2 * VIEW.HALF * 0.74; }

/* ---- authored-sprite wrappers ---- */
function spectator(x, y, seed, wave) { drawSpectator(x - PX, y, seed, wave); }
function chibi(x, y, seed, kind, face, step) { drawStaff(x - PX, y, seed, kind, face, step); }
function tyreStack(x, y, n) {
  n = n || 3;
  for (let i = 0; i < n; i++) drawProp(PROP_TYRES, x, y - (4 + i * 4) * PX);
}
function tree(x, y, s, kind) {
  drawProp(kind === "palm" ? PROP_PALM : PROP_PINE, x - 5 * PX, y - 10 * PX);
}

function drawRace() {
  const tk = R.tk, track = R.track;
  if (!VIEW) setupView(tk);
  const me = R.field[0];
  camFollow(sampleTrack(tk, me.s + 16));

  const dirt = track.surf === "dirt", road = track.surf === "road";
  const HALF = VIEW.HALF;

  dith(0, 0, CW, CH, dirt ? "#6fae46" : "#61ab41", dirt ? "#63a03e" : "#559a39", 6);

  const step = Math.max(5, 34 / VIEW.sc);
  const span = (CH / (VIEW.sc * SQ)) * 1.5 + 220;
  const d0 = me.s - span * 0.30, d1 = me.s + span * 0.85;

  /* track surface */
  const outer = [], inner = [];
  for (let d = d0; d <= d1; d += step) {
    const p = sampleTrack(tk, d);
    outer.push(W2S(offsetPoint(p, -HALF)));
    inner.push(W2S(offsetPoint(p, HALF)));
  }
  if (outer.length > 1) {
    cx.beginPath();
    cx.moveTo(outer[0].x, outer[0].y);
    for (const p of outer) cx.lineTo(p.x, p.y);
    for (let i = inner.length - 1; i >= 0; i--) cx.lineTo(inner[i].x, inner[i].y);
    cx.closePath();
    cx.fillStyle = dirt ? "#96693a" : (road ? "#4b5058" : "#5c616a");
    cx.fill();
    cx.strokeStyle = dirt ? "rgba(70,45,22,.34)" : "rgba(22,22,28,.30)";
    cx.lineWidth = Math.max(2, HALF * VIEW.sc * 0.5);
    cx.beginPath();
    for (let i = 0, d = d0; d <= d1; d += step, i++) {
      const q = W2S(offsetPoint(sampleTrack(tk, d), HALF * 0.30));
      if (i === 0) cx.moveTo(q.x, q.y); else cx.lineTo(q.x, q.y);
    }
    cx.stroke();
    cx.strokeStyle = dirt ? "rgba(120,88,48,.5)" : "rgba(255,255,255,.06)";
    cx.lineWidth = 1;
    for (let d = Math.floor(d0 / 55) * 55; d <= d1; d += 55) {
      const p = sampleTrack(tk, d);
      const a = W2S(offsetPoint(p, -HALF)), b = W2S(offsetPoint(p, HALF));
      cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
    }
  }

  /* apron line */
  cx.strokeStyle = dirt ? "#d8c49a" : "#eef2f8"; cx.lineWidth = 1.6;
  cx.beginPath();
  for (let i = 0, d = d0; d <= d1; d += step, i++) {
    const q = W2S(offsetPoint(sampleTrack(tk, d), HALF - 0.6));
    if (i === 0) cx.moveTo(q.x, q.y); else cx.lineTo(q.x, q.y);
  }
  cx.stroke();

  /* red-and-white kerbing on the inside of the corners */
  for (let d = Math.floor(d0 / 9) * 9; d <= d1; d += 9) {
    const p = sampleTrack(tk, d);
    if (p.c < 0.25) continue;
    const p2 = sampleTrack(tk, d + 8.6);
    const a1 = W2S(offsetPoint(p, HALF - 0.4)), a2 = W2S(offsetPoint(p, HALF - 2.6));
    const b1 = W2S(offsetPoint(p2, HALF - 0.4)), b2 = W2S(offsetPoint(p2, HALF - 2.6));
    if (!onScreen(a1, 40)) continue;
    quadS(a1, b1, b2, a2, Math.abs((d / 6) | 0) % 2 ? "#e8332a" : "#f4f6fa");
  }

  drawPitRoad(tk, HALF);
  drawStartFinish(tk, HALF);
  drawInnerWall(tk, HALF, d0, d1, step);
  drawOuterFurniture(tk, HALF, d0, d1, step);

  /* cars, back to front */
  const carL = VIEW.sc * CAR_WORLD * 1.15;
  const drawn = R.field.filter(c => !(c.dnf && c.done)).map(c => {
    const p = sampleTrack(tk, c.s);
    const w = W2S(offsetPoint(p, laneOffset(c.lane)));
    return { c, w, ang: W2Sang(p.h) };
  }).filter(o => onScreen(o.w, 60));
  drawn.sort((a, b) => a.w.y - b.w.y);
  for (const o of drawn) {
    const c = o.c;
    if (c.pit > 0) cx.globalAlpha = 0.5;
    if (dirt && c.v > 12 && !c.pit) {
      for (let i = 1; i <= 4; i++) {
        const q = W2S(offsetPoint(sampleTrack(tk, c.s - i * 2.4), laneOffset(c.lane)));
        const s2 = Math.max(2, 5 - i);
        px(q.x - s2 / 2, q.y - 1 - i, s2, s2, "rgba(186,146,96," + (0.34 / i).toFixed(2) + ")");
      }
    }
    /* ground shadow, then the baked sprite */
    cx.save(); cx.scale(1, 0.5);
    cx.fillStyle = "rgba(0,0,0,.25)";
    cx.beginPath(); cx.ellipse(o.w.x, (o.w.y + 2) / 0.5, carL * 0.42, carL * 0.30, 0, 0, 7); cx.fill();
    cx.restore();
    drawCarSprite(o.w.x, o.w.y, o.ang, c.paintIdx, c.model, carL);
    if (carL > 26) {
      cx.font = "bold " + Math.round(7 * PX) + "px monospace"; cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.lineWidth = 2.5 * (PX / 2); cx.strokeStyle = "rgba(20,22,27,.85)"; cx.lineJoin = "round";
      cx.strokeText(String(c.num), o.w.x, o.w.y - carL * 0.16);
      cx.fillStyle = "#ffffff";
      cx.fillText(String(c.num), o.w.x, o.w.y - carL * 0.16);
    }
    if (c.isP) {
      if (R.auraT > 0) {
        cx.strokeStyle = AURAS[R.auraTier].col; cx.lineWidth = 2;
        cx.strokeRect(o.w.x - carL * 0.62, o.w.y - carL * 0.42, carL * 1.24, carL * 0.84);
      }
      const U2 = PX / 2;
      const bob = Math.round(Math.sin(frame / 7) * 1.6 * U2);
      const my = o.w.y - carL * 0.55 - 11 * U2 + bob;
      px(o.w.x - 5 * U2, my - U2, 11 * U2, 6 * U2, "#14161b");
      px(o.w.x - 4 * U2, my, 9 * U2, 4 * U2, "#ffd23f");
      px(o.w.x - 3 * U2, my + 4 * U2, 7 * U2, 2 * U2, "#14161b");
      px(o.w.x - 2 * U2, my + 4 * U2, 5 * U2, U2, "#ffd23f");
    }
    cx.globalAlpha = 1;
  }

  drawGantry(tk, HALF);

  if (R.yellow) {
    cx.fillStyle = "rgba(233,161,27,.15)"; cx.fillRect(0, 0, CW, CH);
    for (let i = 0; i < CW; i += 34) px(i, 0, 17, 4, "#e9a11b");
  }
  drawMiniMap(tk);
  if (R.phase === "grid") {
    const n = Math.ceil(R.timer);
    const bw = 40 * PX, bh = 20 * PX;
    px(CW / 2 - bw / 2, CH / 2 - bh / 2, bw, bh, "rgba(10,17,48,.85)");
    px(CW / 2 - bw / 2, CH / 2 - bh / 2, bw, PX, "#3c50b0");
    txtO(n > 0 ? String(n) : "GO!", CW / 2, CH / 2 + 6 * (PX / 2), "#ffd23f", 18, "center");
  }
  if (R.msgT > 0) {
    cx.font = "bold " + Math.round(8 * PX) + "px monospace";
    const w = Math.min(CW - 8 * PX, cx.measureText(R.msg).width + 9 * PX);
    const col = /CAUTION|BIG ONE|DNF|BLOWN|PIT/.test(R.msg) ? "#e9a11b" : /GREEN|GO/.test(R.msg) ? "#3fae4a" : "#e8332a";
    px(CW / 2 - w / 2, 4 * PX, w, 9 * PX, col);
    px(CW / 2 - w / 2, 4 * PX, w, 1.5 * PX, "rgba(255,255,255,.45)");
    txt(R.msg, CW / 2, 10.5 * PX, "#fff", 8, "center");
  }
}

function drawInnerWall(tk, HALF, d0, d1, step) {
  cx.lineWidth = 2.2; cx.strokeStyle = "#e9edf3";
  cx.beginPath();
  for (let i = 0, d = d0; d <= d1; d += step, i++) {
    const q = W2S(offsetPoint(sampleTrack(tk, d), HALF + 3));
    if (i === 0) cx.moveTo(q.x, q.y); else cx.lineTo(q.x, q.y);
  }
  cx.stroke();
}

/* outer wall, SAFER stripes, ad boards, catch fence, grandstands */
function drawOuterFurniture(tk, HALF, d0, d1, step) {
  const runs = straightRuns(tk);
  const fs = runs.find(r => r.start <= tk.sfDist && r.end >= tk.sfDist);
  const wrap = d => ((d % tk.len) + tk.len) % tk.len;
  const isMain = d => fs && wrap(d) >= fs.start && wrap(d) <= fs.end;
  const onStraight = d => runs.slice(0, 3).some(r => wrap(d) >= r.start && wrap(d) <= r.end);

  /* Grandstand: one solid raked deck per track segment, then the step
     nosings and the people sitting on them.  Drawn far-to-near.      */
  const standStep = Math.max(8, step * 3);
  for (let d = Math.floor(d0 / standStep) * standStep; d <= d1; d += standStep) {
    if (!onStraight(d)) continue;
    const p = sampleTrack(tk, d);
    const p2 = sampleTrack(tk, d + standStep * 1.02);
    const rows = isMain(d) ? 6 : 4;
    const depth = rows * 2.1;
    const totalH = 7 + rows * 3.4;
    const fA = W2S(offsetPoint(p, -HALF - 9)), fB = W2S(offsetPoint(p2, -HALF - 9));
    if (!onScreen(fA, 130) && !onScreen(fB, 130)) continue;
    const bA = lift(W2S(offsetPoint(p, -HALF - 9 - depth)), totalH);
    const bB = lift(W2S(offsetPoint(p2, -HALF - 9 - depth)), totalH);
    /* the raked concrete deck */
    quadS(fA, fB, bB, bA, "#9aa2ab");
    /* step nosings + spectators, front row first */
    for (let rw = 0; rw < rows; rw++) {
      const t = (rw + 0.5) / rows;
      const sA = { x: fA.x + (bA.x - fA.x) * t, y: fA.y + (bA.y - fA.y) * t };
      const sB = { x: fB.x + (bB.x - fB.x) * t, y: fB.y + (bB.y - fB.y) * t };
      quadS(sA, sB, lift(sB, 2), lift(sA, 2), rw % 2 ? "#b0b8c2" : "#a6aeb8");
      const seed = Math.abs((d * 5) | 0) + rw * 23;
      if (seed % 10 === 0) continue;
      /* fill the segment with as many people as its screen width allows */
      const segW = Math.hypot(sB.x - sA.x, sB.y - sA.y);
      const n = clamp(Math.round(segW / (6 * PX)), 1, 5);
      for (let k = 0; k < n; k++) {
        const t2 = (k + 0.35) / n;
        const sx = sA.x + (sB.x - sA.x) * t2 - 2 * PX;
        const sy = sA.y + (sB.y - sA.y) * t2 - 11 * PX;
        const sd2 = seed + k * 13;
        if (sd2 % 11 === 0) continue;
        spectator(sx, sy, sd2, ((frame >> 4) + sd2) % 4 === 0);
      }
    }
    /* roof on the main stand, on posts */
    if (isMain(d) && VIEW.sc > 2) {
      const rh = 24;
      quadS(lift(bA, rh), lift(bB, rh), lift(bB, rh + 3), lift(bA, rh + 3), "#6d747d");
      px(bA.x, bA.y - rh, 1, rh, "#8b929c");
    }
  }

  /* --- the outer barrier ---
     Drawn as a constant-thickness ribbon rather than an extruded face:
     a wall running straight up the screen has no face area to show, so
     extruding it vertically would make it disappear.                  */
  const AD = ["#e8332a", "#ffd23f", "#2255cc", "#3fae4a", "#ffffff", "#e9a11b"];
  const wallH = Math.max(4, VIEW.sc * 1.6);
  const wStep = Math.max(5, step * 1.8);
  const segs = [];
  for (let d = d0; d <= d1; d += wStep) segs.push(W2S(offsetPoint(sampleTrack(tk, d), -HALF - 2.2)));
  cx.lineCap = "butt"; cx.lineJoin = "round";
  for (let i = 0; i < segs.length - 1; i++) {
    const a = segs[i], b = segs[i + 1];
    if (!onScreen(a, 70) && !onScreen(b, 70)) continue;
    const k = Math.abs(Math.floor((d0 + i * wStep) / 11));
    cx.strokeStyle = AD[k % 6]; cx.lineWidth = wallH;
    cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
    cx.strokeStyle = k % 2 ? "#f4f7fb" : "#e3e8ef"; cx.lineWidth = wallH * 0.42;
    cx.beginPath();
    cx.moveTo(a.x, a.y - wallH * 0.5); cx.lineTo(b.x, b.y - wallH * 0.5); cx.stroke();
    cx.strokeStyle = (k % 4 < 2) ? "#e8332a" : "#2255cc"; cx.lineWidth = wallH * 0.26;
    cx.beginPath();
    cx.moveTo(a.x, a.y - wallH * 0.78); cx.lineTo(b.x, b.y - wallH * 0.78); cx.stroke();
  }
  cx.strokeStyle = "#ffffff"; cx.lineWidth = 1.5 * U();
  cx.beginPath();
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i];
    if (i === 0) cx.moveTo(a.x, a.y - wallH * 0.92); else cx.lineTo(a.x, a.y - wallH * 0.92);
  }
  cx.stroke();

  /* catch fence: posts plus a dithered mesh */
  if (VIEW.sc > 1.8) {
    const fh = wallH * 2.6;
    for (let i = 0; i < segs.length - 1; i += 2) {
      const a = segs[i];
      if (!onScreen(a, 50)) continue;
      px(a.x, a.y - wallH - fh, 1, fh, "rgba(206,213,224,.9)");
    }
    cx.strokeStyle = "rgba(210,218,230,.35)"; cx.lineWidth = 1;
    for (let t = 0.35; t <= 1; t += 0.32) {
      cx.beginPath();
      for (let i = 0; i < segs.length; i++) {
        const a = segs[i];
        if (i === 0) cx.moveTo(a.x, a.y - wallH - fh * t); else cx.lineTo(a.x, a.y - wallH - fh * t);
      }
      cx.stroke();
    }
  }

  /* trackside props */
  for (let d = Math.floor(d0 / 55) * 55; d <= d1; d += 55) {
    const p = sampleTrack(tk, d);
    const q = W2S(offsetPoint(p, -HALF - 7));
    if (!onScreen(q, 50)) continue;
    if (p.c > 0.35) tyreStack(q.x - 4 * PX, q.y, 3);
    else if (Math.abs((d / 55) | 0) % 3 === 0) chibi(q.x - 4 * PX, q.y - 15 * PX, Math.abs((d / 55) | 0) % 8, "marshal", "down", 0);
  }
  for (let d = Math.floor(d0 / 90) * 90; d <= d1; d += 90) {
    const q = W2S(offsetPoint(sampleTrack(tk, d), HALF + 26));
    if (onScreen(q, 40)) tree(q.x, q.y, 1, R.track.surf === "ss" ? "palm" : "pine");
  }
}

function drawPitRoad(tk, HALF) {
  const runs = straightRuns(tk);
  const fs = runs.find(r => r.start <= tk.sfDist && r.end >= tk.sfDist) || runs[0];
  if (!fs) return;
  const step = Math.max(4, (fs.end - fs.start) / 26);
  cx.strokeStyle = "#767f8b"; cx.lineWidth = Math.max(3, 6 * VIEW.sc * 0.55);
  cx.beginPath();
  let started = false;
  for (let d = fs.start; d <= fs.end; d += step) {
    const q = W2S(offsetPoint(sampleTrack(tk, d), HALF + 7));
    if (!started) { cx.moveTo(q.x, q.y); started = true; } else cx.lineTo(q.x, q.y);
  }
  if (started) cx.stroke();
  let i = 0;
  for (let d = fs.start + step; d < fs.end - step; d += step * 1.6, i++) {
    const b = W2S(offsetPoint(sampleTrack(tk, d), HALF + 12));
    if (!onScreen(b, 40)) continue;
    px(b.x - 4 * PX, b.y - 2 * PX, 9 * PX, 5 * PX, i === 0 ? "#e8332a" : "#c9cfd9");
    px(b.x - 4 * PX, b.y - 2 * PX, 9 * PX, PX, "#8f97a3");
    chibi(b.x + 5 * PX, b.y - 14 * PX, i, "crew", "left", (frame >> 4) % 2);
  }
}

function drawStartFinish(tk, HALF) {
  const p = sampleTrack(tk, tk.sfDist);
  const aS = W2S(offsetPoint(p, -HALF));
  if (!onScreen(aS, 200)) return;
  for (let row = 0; row < 2; row++) {
    const pp = sampleTrack(tk, tk.sfDist + row * 3.2);
    const a2 = offsetPoint(pp, -HALF), b2 = offsetPoint(pp, HALF);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const p0 = W2S({ x: a2.x + (b2.x - a2.x) * t0, y: a2.y + (b2.y - a2.y) * t0 });
      const p1 = W2S({ x: a2.x + (b2.x - a2.x) * t1, y: a2.y + (b2.y - a2.y) * t1 });
      cx.strokeStyle = (i + row) % 2 ? "#1c1c22" : "#ffffff";
      cx.lineWidth = 3.2; cx.beginPath(); cx.moveTo(p0.x, p0.y); cx.lineTo(p1.x, p1.y); cx.stroke();
    }
  }
  const st = W2S(offsetPoint(p, -HALF - 7));
  px(st.x - 4 * (PX / 2), st.y - 22 * (PX / 2), 9 * (PX / 2), 22 * (PX / 2), "#c8ced8");
  px(st.x - 5 * (PX / 2), st.y - 26 * (PX / 2), 11 * (PX / 2), 5 * (PX / 2), "#e8332a");
  chibi(st.x - 4 * PX, st.y - 40 * (PX / 2) - 14 * PX, 3, "marshal", "down", (frame >> 3) % 2);
  const f = (frame >> 3) % 2;
  for (let i = 0; i < 4; i++) px(st.x + 5 * PX, st.y - (24 - i * 2) * (PX / 2), 5 * PX, 2 * (PX / 2), (i + f) % 2 ? "#1c1c22" : "#ffffff");
}

/* The start/finish gantry spans over the track, so it is drawn after the
   cars — they pass underneath it. */
function drawGantry(tk, HALF) {
  const p = sampleTrack(tk, tk.sfDist);
  const l = W2S(offsetPoint(p, -HALF - 2)), r2 = W2S(offsetPoint(p, HALF + 2));
  if (!onScreen(l, 220) && !onScreen(r2, 220)) return;
  const H = clamp(26 * VIEW.sc * 0.5, 18, 52);
  const pw = Math.max(3, VIEW.sc * 1.1);
  /* pillars */
  for (const b of [l, r2]) {
    px(b.x - pw / 2 - 1, b.y - 2, pw + 2, 3, "#8b929c");        // base
    px(b.x - pw / 2, b.y - H, pw, H, "#b4bcc6");
    px(b.x - pw / 2, b.y - H, Math.max(1, pw * 0.35), H, "#d6dce4");
    px(b.x + pw / 2 - 1, b.y - H, 1, H, "#8b929c");
  }
  /* beam: a slab with a shaded underside so it reads as overhead */
  const bh = clamp(VIEW.sc * 2.2, 7, 16);
  const poly = (dy, h, fill) => {
    cx.beginPath();
    cx.moveTo(l.x - pw / 2, l.y - H - dy);
    cx.lineTo(r2.x + pw / 2, r2.y - H - dy);
    cx.lineTo(r2.x + pw / 2, r2.y - H - dy + h);
    cx.lineTo(l.x - pw / 2, l.y - H - dy + h);
    cx.closePath(); cx.fillStyle = fill; cx.fill();
  };
  poly(bh, bh, "#e8332a");
  poly(bh, Math.max(2, bh * 0.28), "#ff8074");
  poly(0, Math.max(2, bh * 0.3), "#7c1810");
  if (VIEW.sc > 2.2) {
    cx.save();
    cx.translate((l.x + r2.x) / 2, (l.y + r2.y) / 2 - H - bh * 0.45);
    cx.rotate(Math.atan2(r2.y - l.y, r2.x - l.x));
    txt("STOCK CAR STORY", 0, 2, "#ffffff", Math.max(5, Math.round(VIEW.sc * 1.2)), "center");
    cx.restore();
  }
}

/* corner mini-map so the whole circuit stays legible */
function drawMiniMap(tk) {
  const MW = Math.round(CW * 0.26), MH = Math.round(MW * 0.74);
  const ox = CW - MW - 4 * PX, oy = 4 * PX;
  px(ox - PX, oy - PX, MW + 2 * PX, MH + 2 * PX, "rgba(10,17,48,.85)");
  px(ox - PX, oy - PX, MW + 2 * PX, PX, "#3c50b0");
  const b = tk.bounds;
  const s = Math.min((MW - 8) / (b.maxx - b.minx), (MH - 8) / (b.maxy - b.miny));
  const mx = ox + MW / 2, my = oy + MH / 2;
  const M = p => ({ x: mx + (p.x - (b.minx + b.maxx) / 2) * s, y: my + (p.y - (b.miny + b.maxy) / 2) * s });
  cx.strokeStyle = "#8f9bb5"; cx.lineWidth = 2 * (PX / 2);
  cx.beginPath();
  for (let i = 0; i < tk.pts.length; i += 4) {
    const q = M(tk.pts[i]);
    if (i === 0) cx.moveTo(q.x, q.y); else cx.lineTo(q.x, q.y);
  }
  cx.closePath(); cx.stroke();
  const sfp = M(sampleTrack(tk, tk.sfDist));
  px(sfp.x - PX, sfp.y - PX, 2 * PX, 2 * PX, "#ffffff");
  for (const c of R.field) {
    if (c.done || c.dnf) continue;
    const q = M(sampleTrack(tk, c.s));
    const s2 = (c.isP ? 2.4 : 1.8) * PX;
    px(q.x - s2 / 2, q.y - s2 / 2, s2, s2, c.isP ? "#ffd23f" : c.col);
  }
}

/* the longest straight runs — used for stands and pit road */
function straightRuns(tk) {
  if (tk._runs) return tk._runs;
  const runs = []; let st = null;
  for (let i = 0; i < tk.pts.length; i++) {
    if (tk.pts[i].c === 0) { if (st === null) st = tk.pts[i].s; }
    else if (st !== null) { runs.push({ start: st, end: tk.pts[i].s }); st = null; }
  }
  if (st !== null) runs.push({ start: st, end: tk.len });
  runs.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  tk._runs = runs;
  return runs;
}
function resetRaceView() { VIEW = null; }
