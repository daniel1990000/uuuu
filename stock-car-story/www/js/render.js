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
/* How many CSS pixels one authored ground texel covers.  Tied to PX so
   the aggregate in the asphalt is the same size as a pixel on a car. */
const GTEXEL = () => PX * 0.85;

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
  cx.beginPath(); cx.rect(0, 0, CW, CH);
  fillFlatTex("grass", PX, "#6cb545");
  /* fit the shop floor to the screen width */
  TW = Math.max(11, Math.floor((CW * 0.96) / (2 * ROOM)));
  TH = Math.max(6, Math.round(TW * 0.60));
  ISO.ox = Math.round(CW / 2);
  ISO.oy = Math.round(CH * 0.30);

  /* yard behind the shop */
  cx.beginPath(); cx.rect(0, 0, CW, Math.round(CH * 0.17));
  fillFlatTex("asphalt", PX, "#8a9099");
  for (let i = 0; i < CW; i += 26) px(i, Math.round(CH * 0.10), 14, 2, "#e6e9ee");
  const tx = Math.round(CW * 0.52), ty = Math.round(CH * 0.04);
  px(tx, ty, 46, 17, "#e9eef5"); px(tx - 13, ty + 5, 14, 12, "#c3ccd8");
  px(tx - 11, ty + 7, 8, 5, "#8fb7d8");
  px(tx + 2, ty + 4, 30, 7, "#e8332a"); txt("RACING", tx + 4, ty + 10, "#fff", 6);
  px(tx - 10, ty + 16, 7, 4, "#20232c"); px(tx + 8, ty + 16, 7, 4, "#20232c"); px(tx + 33, ty + 16, 7, 4, "#20232c");
  tree(18, Math.round(CH * 0.16), 1); tree(CW - 18, Math.round(CH * 0.14), 1);

  /* Floor: authored sealed concrete, mapped onto the iso diamond so the
     bay markings and drain channel run with the room rather than being
     a flat chequerboard of two browns. */
  {
    const o = iso(0, 0), ex = iso(ROOM, 0), ey = iso(0, ROOM);
    cx.beginPath();
    cx.moveTo(o.x, o.y); cx.lineTo(ex.x, ex.y);
    cx.lineTo(ex.x + ey.x - o.x, ex.y + ey.y - o.y); cx.lineTo(ey.x, ey.y);
    cx.closePath();
    cx.save(); cx.clip();
    /* one repeat across the whole floor: the tile already carries three
       bay lines, and tiling it twice turned them into a grid */
    fillQuadTex(o, ex, ey, "garageFloor", 1, 1);
    cx.restore();
  }
  cx.strokeStyle = "#e9a11b"; cx.lineWidth = 1.5;
  const c0 = iso(1.6, 1.6), c1 = iso(4.4, 1.6), c2 = iso(4.4, 4.4), c3 = iso(1.6, 4.4);
  cx.beginPath(); cx.moveTo(c0.x, c0.y); cx.lineTo(c1.x, c1.y); cx.lineTo(c2.x, c2.y); cx.lineTo(c3.x, c3.y); cx.closePath(); cx.stroke();

  /* walls */
  const WH = 42;
  {
    const a = iso(0, -0.5), b = iso(ROOM, -0.5), c = iso(-0.5, 0), e = iso(-0.5, ROOM);
    const up = p2 => ({ x: p2.x, y: p2.y - WH });
    /* back wall, then the darker side wall */
    cx.fillStyle = "#9aa2ab";
    cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y);
    cx.lineTo(b.x, b.y - WH); cx.lineTo(a.x, a.y - WH); cx.closePath(); cx.fill();
    fillQuadTex(up(a), up(b), a, "garageWall", Math.max(2, Math.round(ROOM * 0.9)), 3, 0.95);
    cx.fillStyle = "#848c95";
    cx.beginPath(); cx.moveTo(c.x, c.y); cx.lineTo(e.x, e.y);
    cx.lineTo(e.x, e.y - WH); cx.lineTo(c.x, c.y - WH); cx.closePath(); cx.fill();
    fillQuadTex(up(c), up(e), c, "garageWall", Math.max(2, Math.round(ROOM * 0.9)), 3, 0.6);
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

  /* Fixed anchors around the room, so labels never collide with each other,
     with the machine, or with the staff. */
  const roomTop = ISO.oy - WH - 4 * PX;
  const roomBot = ISO.oy + ROOM * 2 * TH + 2 * PX;
  tapLabel(CW * 0.21, roomTop, "Team", "scrTeam", 58 * (PX / 2), 30 * (PX / 2));
  tapLabel(CW * 0.79, roomTop, G.sponsors.length ? "Sponsors" : "Get a sponsor",
    "scrSponsors", 92 * (PX / 2), 30 * (PX / 2));
  tapLabel(CW * 0.21, roomBot, "Build", "scrDevelop", 58 * (PX / 2), 30 * (PX / 2));
  if (car) tapLabel(CW * 0.79, roomBot, "Machine #" + car.num, "scrCars", 92 * (PX / 2), 30 * (PX / 2));

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

  /* status bubbles pinned to the top-left of the scene */
  let by = 5 * PX;
  const bubble = (s, col) => {
    cx.font = "bold " + Math.round(7 * PX) + "px monospace";
    const w = cx.measureText(s).width + 11 * PX;
    px(5 * PX, by, w, 12 * PX, "#ffffff");
    cx.strokeStyle = "#20232c"; cx.lineWidth = 1 * (PX / 2);
    cx.strokeRect(5 * PX + 0.5, by + 0.5, w - 1, 12 * PX - 1);
    px(5 * PX, by, 3 * (PX / 2), 12 * PX, col);
    txt(s, 5 * PX + 7 * (PX / 2), by + 8.5 * PX, "#20232c", 7);
    by += 15 * PX;
  };
  if (G.build) bubble("Building - " + G.build.wks + "w left", "#2255cc");
  if (G.repair) bubble("Repairing - " + G.repair.wks + "w left", "#e8332a");
  if (car && car.dur < carStats(car).maxdur * 0.35) bubble("Machine damaged", "#e8332a");
  if (!G.build && !G.repair && shopParts().some(p => G.money >= p.cost && !invCount(p.id)))
    bubble("Parts in stock", "#1a8a2e");
  if (G.offers.length && G.sponsors.length < 2) bubble("Sponsor offer waiting", "#c47b00");

  flushLabels();
}

/* ============================================================
   TRACK FURNITURE
   Built once when a race starts, in (distance-along-lap, offset)
   space, then drawn back-to-front.  This is what turns an empty
   green field into an actual speedway infield.
   ============================================================ */
let SCENE = null;
function buildScenery(tk, track, HALF) {
  const S = [];
  const runs = straightRuns(tk);
  const fs = runs.find(r2 => r2.start <= tk.sfDist && r2.end >= tk.sfDist) || runs[0];
  const bs = runs.find(r2 => r2 !== fs) || fs;
  const fl = fs.end - fs.start, bl = bs.end - bs.start;

  /* --- pit road along the frontstretch --- */
  const stalls = clamp(Math.floor(fl / 26), 6, 18);
  for (let i = 0; i < stalls; i++) {
    const d = fs.start + fl * 0.10 + (i + 0.5) * (fl * 0.80 / stalls);
    S.push({ t: "pitbox", d, off: HALF + 8.5, i });
  }
  /* haulers backed up behind the pit boxes */
  const haulers = clamp(Math.floor(fl / 55), 3, 9);
  for (let i = 0; i < haulers; i++)
    S.push({ t: "hauler", d: fs.start + fl * 0.12 + (i + 0.5) * (fl * 0.76 / haulers), off: HALF + 31, i });

  /* --- infield garage row --- */
  const bays = clamp(Math.floor(fl / 34), 4, 12);
  for (let i = 0; i < bays; i++)
    S.push({ t: "bay", d: fs.start + fl * 0.16 + (i + 0.5) * (fl * 0.70 / bays), off: HALF + 21, i });

  /* --- infield buildings --- */
  S.push({ t: "building", d: fs.start + fl * 0.5, off: HALF + 46, w: 26, l: 18, h: 15, col: "#e6ebf2", roof: "#c0392b", label: "MEDIA" });
  S.push({ t: "building", d: bs.start + bl * 0.30, off: HALF + 34, w: 18, l: 13, h: 11, col: "#dfe6ef", roof: "#2255cc", label: "CARE" });
  S.push({ t: "tower", d: fs.start + fl * 0.62, off: HALF + 15.5 });

  if (track.surf === "street") {
    /* A street circuit is a city with a race running through it, so the
       scenery is blocks of buildings on both kerbs rather than an
       infield.  Heights and widths are stepped off a fixed sequence so
       the skyline reads as a real street rather than as noise. */
    const HGT = [26, 15, 34, 19, 44, 12, 30, 22, 38, 17];
    const WID = [20, 15, 24, 18, 28, 14, 22, 16];
    for (let i = 0; i < 26; i++) {
      const d = (i / 26) * tk.len + 9;
      const inner = i % 2 === 0;
      S.push({ t: "city", d, off: (inner ? HALF + 20 : -HALF - 22),
        w: WID[i % 8], l: WID[(i + 3) % 8] * 0.8, h: HGT[i % 10], i });
    }
    /* street furniture along the kerb line */
    for (let i = 0; i < 18; i++)
      S.push({ t: "light", d: (i / 18) * tk.len, off: -HALF - 12 });
    for (let i = 0; i < 8; i++)
      S.push({ t: "tree", d: (i / 8) * tk.len + 20, off: HALF + 13, kind: "pine" });
  } else {
    /* --- lake and greenery in the middle --- */
    S.push({ t: "lake", d: bs.start + bl * 0.62, off: HALF + 40, rx: 30, ry: 13 });
    for (let i = 0; i < 14; i++) {
      const d = (i / 14) * tk.len;
      S.push({ t: "tree", d, off: HALF + 26 + ((i * 37) % 30), kind: track.surf === "ss" ? "palm" : "pine" });
    }
    /* motorhomes parked up in the infield */
    for (let i = 0; i < 5; i++)
      S.push({ t: "rv", d: bs.start + bl * (0.18 + i * 0.15), off: HALF + 30, i });
  }

  if (track.surf !== "street") {
    /* --- a car park outside the main grandstand --- */
    for (let i = 0; i < 26; i++) {
      const d = fs.start - 30 + (i % 13) * (fl / 12);
      S.push({ t: "parked", d, off: -HALF - 34 - Math.floor(i / 13) * 10, i });
    }
    /* --- floodlights outside the stands --- */
    for (let i = 0; i < 22; i++)
      S.push({ t: "light", d: (i / 22) * tk.len, off: -HALF - 30 });
  }

  /* --- marshal posts around the outside, on the corners --- */
  for (let d = 0; d < tk.len; d += 90) {
    const p = sampleTrack(tk, d);
    if (p.c > 0.3) S.push({ t: "post", d, off: -HALF - 9 });
  }
  return { S, fs, bs };
}

/* draw one scenery item; everything is placed on the ground plane */
function drawSceneItem(it, tk, HALF) {
  const p = sampleTrack(tk, it.d);
  const g = W2S(offsetPoint(p, it.off));
  if (!onScreen(g, 120)) return;
  const u = PX / 2, sc = VIEW.sc;
  const box = (w, l, h, top, side, dark) => {
    const cor = boxCorners(p, it.off, l, w).map(W2S);
    const H = h * sc * 0.5;
    const fs2 = [];
    for (let i = 0; i < 4; i++) {
      const a = cor[i], b = cor[(i + 1) % 4];
      fs2.push({ a, b, my: (a.y + b.y) / 2 });
    }
    fs2.sort((x, y2) => x.my - y2.my);
    for (const f of fs2) face(f.a, f.b, H, f.my > (cor[0].y + cor[2].y) / 2 ? dark : side);
    quadS(lift(cor[0], H), lift(cor[1], H), lift(cor[2], H), lift(cor[3], H), top);
    return { cor, H };
  };

  switch (it.t) {
    case "pitbox": {
      /* a painted stall in the team's colour, boxed in white, with the
         crew and their gear waiting over the wall */
      const col = it.i === 0 ? "#e8332a" : TEAMC[(it.i * 3) % 8];
      const cor = boxCorners(p, it.off, 11, 6.5).map(W2S);
      quadS(cor[0], cor[1], cor[2], cor[3], shade(col, -0.15));
      cx.strokeStyle = "#f2f5fa"; cx.lineWidth = 1.6 * u;
      cx.beginPath();
      cx.moveTo(cor[0].x, cor[0].y);
      for (let i = 1; i < 4; i++) cx.lineTo(cor[i].x, cor[i].y);
      cx.closePath(); cx.stroke();
      if (sc > 2) {
        const eq = W2S(offsetPoint(p, it.off + 4.5));
        tyreStack(eq.x - 4 * PX, eq.y, 2);
        drawProp(PROP_TOOLBOX, eq.x + 7 * PX, eq.y - 5 * PX);
        chibi(g.x - 6 * PX, g.y - 15 * PX, it.i, "crew", "left", (frame >> 4) % 2);
        chibi(g.x + 3 * PX, g.y - 13 * PX, it.i + 3, "crew", "left", ((frame >> 4) + 1) % 2);
      }
      break;
    }
    case "hauler": {
      const b2 = box(9, 24, 8, "#e9eef5", "#cfd7e3", "#aab4c4");
      /* a coloured band and a cab */
      const mid = { x: (b2.cor[0].x + b2.cor[3].x) / 2, y: (b2.cor[0].y + b2.cor[3].y) / 2 };
      px(mid.x - 9 * u, mid.y - b2.H * 0.6, 18 * u, 3 * u, TEAMC[it.i % 8]);
      break;
    }
    case "bay": {
      /* garage stall with a roller door */
      const b2 = box(10, 13, 11, "#c9d0da", "#aeb6c2", "#8f97a3");
      const front = W2S(offsetPoint(p, it.off - 5));
      px(front.x - 5 * u, front.y - b2.H * 0.85, 10 * u, b2.H * 0.7, "#6b7480");
      for (let k = 0; k < 3; k++)
        px(front.x - 5 * u, front.y - b2.H * 0.8 + k * b2.H * 0.2, 10 * u, u, "#8a93a0");
      break;
    }
    case "building": {
      const b2 = box(it.w, it.l, it.h, it.col, shade(it.col, -0.14), shade(it.col, -0.3));
      const topMid = {
        x: (b2.cor[0].x + b2.cor[1].x + b2.cor[2].x + b2.cor[3].x) / 4,
        y: (b2.cor[0].y + b2.cor[1].y + b2.cor[2].y + b2.cor[3].y) / 4 - b2.H,
      };
      /* roof band + a row of windows */
      quadS(lift(b2.cor[0], b2.H + 2 * u), lift(b2.cor[1], b2.H + 2 * u),
            lift(b2.cor[2], b2.H + 2 * u), lift(b2.cor[3], b2.H + 2 * u), it.roof);
      if (sc > 2) txt(it.label, topMid.x, topMid.y + 3 * u, "#48506a", 6, "center");
      break;
    }
    case "city": {
      /* A city block on a street circuit.  The walls carry the authored
         facade so the storeys read as real windows rather than a flat
         slab, and the pavement is laid at its foot. */
      const cor = boxCorners(p, it.off, it.l, it.w).map(W2S);
      const H = it.h * sc * 0.5;
      const ROOFC = ["#5b6472", "#6a5346", "#4e5867", "#6b6357"];
      const roof = ROOFC[it.i % 4];
      const fs2 = [];
      for (let k = 0; k < 4; k++) {
        const a = cor[k], b = cor[(k + 1) % 4];
        fs2.push({ a, b, my: (a.y + b.y) / 2 });
      }
      fs2.sort((x, y2) => x.my - y2.my);
      const storeys = Math.max(1, Math.round(it.h / 9));
      for (const f of fs2) {
        const len = Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y);
        face(f.a, f.b, H, f.my > (cor[0].y + cor[2].y) / 2 ? "#3f4653" : "#525b69");
        if (sc > 1.6 && len > 6) {
          /* one repeat per ~4 window bays: any denser and the storeys
             collapse into stripes instead of reading as windows */
          fillQuadTex(lift(f.a, H), lift(f.b, H), f.a, "facade",
            Math.max(1, Math.round(len / (30 * u))), storeys,
            f.my > (cor[0].y + cor[2].y) / 2 ? 0.55 : 0.92);
        }
      }
      quadS(lift(cor[0], H), lift(cor[1], H), lift(cor[2], H), lift(cor[3], H), roof);
      /* parapet, so the roofline is not a bare edge */
      quadS(lift(cor[0], H + 1.4 * u), lift(cor[1], H + 1.4 * u),
            lift(cor[2], H + 1.4 * u), lift(cor[3], H + 1.4 * u), shade(roof, 0.18));
      break;
    }
    case "tower": {
      /* the scoring pylon */
      const b2 = box(6, 6, 30, "#3a4256", "#2b3244", "#20263a");
      const t2 = { x: (b2.cor[0].x + b2.cor[2].x) / 2, y: (b2.cor[0].y + b2.cor[2].y) / 2 };
      for (let k = 0; k < 5; k++) {
        px(t2.x - 4 * u, t2.y - b2.H + 3 * u + k * 5 * u, 8 * u, 4 * u, "#0f1424");
        if (sc > 2) txt(String(k + 1), t2.x, t2.y - b2.H + 6.5 * u + k * 5 * u, "#ffd23f", 5, "center");
      }
      break;
    }
    case "lake": {
      const a = W2S(offsetPoint(p, it.off - it.ry));
      const b3 = W2S(offsetPoint(p, it.off + it.ry));
      const cxm = (a.x + b3.x) / 2, cym = (a.y + b3.y) / 2;
      cx.fillStyle = "#2f86c4";
      cx.beginPath(); cx.ellipse(cxm, cym, it.rx * sc * 0.5, it.ry * sc * 0.45, 0, 0, 7); cx.fill();
      cx.fillStyle = "#57b0e4";
      cx.beginPath(); cx.ellipse(cxm, cym - 2 * u, it.rx * sc * 0.36, it.ry * sc * 0.28, 0, 0, 7); cx.fill();
      break;
    }
    case "rv": {
      box(8, 16, 9, "#f2f4f8", "#d8dee8", "#b6bfcd");
      break;
    }
    case "parked":
      drawCarSprite(g.x, g.y, p.h + VIEW.rot + Math.PI / 2, (it.i * 3) % 8, "stock", sc * 4.2);
      break;
    case "light": {
      /* floodlight pylon */
      const h = 34 * u;
      px(g.x - u, g.y - h, 2 * u, h, "#8d95a2");
      px(g.x - 6 * u, g.y - h - 4 * u, 12 * u, 4 * u, "#5f6874");
      for (let k = 0; k < 3; k++) px(g.x - 5 * u + k * 4 * u, g.y - h - 3 * u, 3 * u, 2 * u, "#ffeaa0");
      break;
    }
    case "tree": tree(g.x, g.y, 1, it.kind); break;
    case "post": {
      /* a marshal on a proper platform, not standing in the grass */
      px(g.x - 5 * u, g.y - 12 * u, 11 * u, 12 * u, "#c8ced8");
      px(g.x - 6 * u, g.y - 15 * u, 13 * u, 4 * u, "#e8332a");
      if (sc > 2) chibi(g.x - 4 * PX, g.y - 15 * u - 14 * PX, (it.d | 0) % 8, "marshal", "down", 0);
      break;
    }
  }
}
function drawScenery(tk, HALF, d0, d1) {
  if (!SCENE) return;
  const vis = [];
  for (const it of SCENE.S) {
    /* wrap the item's distance into the visible window */
    let d = it.d;
    while (d < d0 - tk.len / 2) d += tk.len;
    while (d > d0 + tk.len / 2) d -= tk.len;
    if (d < d0 - 60 || d > d1 + 60) continue;
    const g = W2S(offsetPoint(sampleTrack(tk, d), it.off));
    if (!onScreen(g, 130)) continue;
    vis.push({ it: Object.assign({}, it, { d }), y: g.y });
  }
  vis.sort((a, b) => a.y - b.y);
  for (const v of vis) drawSceneItem(v.it, tk, HALF);
}

/* A labelled, tappable spot in the shop.  The label is what turns a
   pretty scene into something a player can actually operate.        */
let LABELQ = [];
function tapLabel(x, y, text, action, w, h) {
  HOTSPOTS.push({ x: x - w / 2, y: y - h, w, h, action });
  LABELQ.push({ x, y, text });
}
/* Painted after the whole scene, so a chibi walking past can never end up
   on top of a label. */
function flushLabels() { for (const l of LABELQ) paintLabel(l.x, l.y, l.text); LABELQ = []; }
function paintLabel(x, y, text) {
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
const ANCH_X = 0.50, ANCH_Y = 0.62;

const CAR_WORLD = 5.6;                 // a stock car is 5.6 world units long
function setupView(tk) {
  /* Zoom is set by how big we want the CAR, not by how big the track is —
     otherwise a 2.5-mile superspeedway renders the cars as specks.  The
     racing surface then gets a fixed world width, so it looks the same on
     every track and stays correctly thin relative to a long lap.        */
  const carPx = clamp(CW * 0.102, 32, 92);
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
  VIEW.rot += Math.abs(dl) < 0.004 ? dl : dl * 0.18;
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
  /* apply the shake to the whole scene, then take it off again at the end */
  const shaking = SHAKE > 0.05;
  if (shaking) {
    cx.save();
    cx.translate(Math.round(rnd(-SHAKE, SHAKE)), Math.round(rnd(-SHAKE, SHAKE)));
  }
  if (!VIEW) setupView(tk);
  const me = R.field[0];
  camFollow(sampleTrack(tk, me.s + 16));

  const dirt = false, road = track.surf === "road";
  const HALF = VIEW.HALF;
  if (!SCENE) SCENE = buildScenery(tk, track, HALF);

  /* the ground everything else sits on: authored grass, or city
     tarmac on the street circuits where there is no grass at all */
  cx.beginPath(); cx.rect(0, 0, CW, CH);
  if (track.surf === "street") fillWorldTex("street", GTEXEL(), "#4a5058");
  else fillWorldTex("grass", GTEXEL(), "#559a39");

  const step = Math.max(5, 34 / VIEW.sc);
  const span = (CH / (VIEW.sc * SQ)) * 1.5 + 220;
  const d0 = me.s - span * 0.30, d1 = me.s + span * 0.85;

  /* --- infield grass, mown in bands that follow the track --- */
  if (track.surf !== "street") {
    for (let d = Math.floor(d0 / 34) * 34; d <= d1; d += 34) {
      const a1 = W2S(offsetPoint(sampleTrack(tk, d), HALF + 1));
      const a2 = W2S(offsetPoint(sampleTrack(tk, d), HALF + 110));
      const b1 = W2S(offsetPoint(sampleTrack(tk, d + 17), HALF + 1));
      const b2 = W2S(offsetPoint(sampleTrack(tk, d + 17), HALF + 110));
      if (!onScreen(a1, 200) && !onScreen(b1, 200)) continue;
      quadS(a1, b1, b2, a2, "rgba(255,255,255,.055)");
    }
  }

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
    fillWorldTex(surfaceTex(track), GTEXEL(), road ? "#4b5058" : "#5c616a");
    cx.save(); cx.clip();

    /* tonal banding across the width — fresh asphalt at the edges,
       a polished groove where the cars run */
    const bandStroke = (off, w, col) => {
      cx.strokeStyle = col; cx.lineWidth = w;
      cx.beginPath();
      for (let i = 0, d = d0; d <= d1; d += step, i++) {
        const q = W2S(offsetPoint(sampleTrack(tk, d), off));
        if (i === 0) cx.moveTo(q.x, q.y); else cx.lineTo(q.x, q.y);
      }
      cx.stroke();
    };
    bandStroke(HALF * 0.62, HALF * VIEW.sc * 0.34, dirt ? "rgba(120,86,44,.30)" : "rgba(255,255,255,.045)");
    bandStroke(HALF * 0.22, HALF * VIEW.sc * 0.52, dirt ? "rgba(66,42,20,.34)" : "rgba(20,20,26,.30)");
    bandStroke(-HALF * 0.05, HALF * VIEW.sc * 0.26, dirt ? "rgba(56,34,16,.26)" : "rgba(14,14,20,.22)");

    /* expansion seams, and the odd patch of newer surface */
    for (let d = Math.floor(d0 / 46) * 46; d <= d1; d += 46) {
      const p2 = sampleTrack(tk, d);
      const a = W2S(offsetPoint(p2, -HALF)), b = W2S(offsetPoint(p2, HALF));
      cx.strokeStyle = dirt ? "rgba(126,92,50,.45)" : "rgba(255,255,255,.07)";
      cx.lineWidth = 1 * (PX / 2);
      cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
    }
    if (!dirt) {
      for (let d = Math.floor(d0 / 230) * 230; d <= d1; d += 230) {
        const c1 = boxCorners(sampleTrack(tk, d + 40), HALF * 0.3, 46, HALF * 1.1).map(W2S);
        quadS(c1[0], c1[1], c1[2], c1[3], "rgba(30,32,40,.22)");
      }
    }
    cx.restore();
  }

  /* apron and edge lines */
  const line = (off, w, col) => {
    cx.strokeStyle = col; cx.lineWidth = w;
    cx.beginPath();
    for (let i = 0, d = d0; d <= d1; d += step, i++) {
      const q = W2S(offsetPoint(sampleTrack(tk, d), off));
      if (i === 0) cx.moveTo(q.x, q.y); else cx.lineTo(q.x, q.y);
    }
    cx.stroke();
  };
  line(HALF - 0.7, 2 * (PX / 2), "#eef2f8");                        // inside edge
  line(-HALF + 0.7, 2 * (PX / 2), "#eef2f8");                       // outside edge
  /* the apron warning line belongs to an oval; a street course has a
     kerb and then a wall, with nowhere to run to */
  if (track.surf !== "street") line(HALF + 2.6, 1.6 * (PX / 2), "#f0c53c");

  /* --- kerbs ---
     Road and street courses kerb the apex of every real corner.  Which
     side that is depends on which way the corner bends, so this walks
     the signed curvature and lays authored kerb blocks down the inside
     edge wherever the bend is tight enough to warrant one, breaking the
     run whenever the track changes hands. */
  if (road || track.surf === "street") {
    const kw = Math.max(2.5, VIEW.sc * 1.5);
    let run = [], runSide = 0;
    const flushKerb = () => {
      if (run.length > 1) stripTex(run, kw * runSide, "kerb", Math.max(1, kw / 5), 0);
      run = [];
    };
    for (let d = d0; d <= d1; d += step) {
      const p = sampleTrack(tk, d);
      const side = Math.abs(p.cs) > 0.26 ? Math.sign(p.cs) : 0;
      if (side !== runSide) { flushKerb(); runSide = side; }
      if (side !== 0) run.push(W2S(offsetPoint(p, side > 0 ? HALF - 0.4 : -HALF + 0.4)));
    }
    flushKerb();
  }

  drawPitRoad(tk, HALF);
  drawScenery(tk, HALF, d0, d1);
  drawStartFinish(tk, HALF);
  drawInnerWall(tk, HALF, d0, d1, step);
  drawOuterFurniture(tk, HALF, d0, d1, step);

  /* cars, back to front */
  const carL = VIEW.sc * CAR_WORLD * 1.15;
  const drawn = R.field.filter(c => !(c.dnf && c.done)).map(c => {
    const p = sampleTrack(tk, c.s);
    const w = W2S(offsetPoint(p, laneOffset(c.lane)));
    /* spinAng is what makes a spin look like a spin rather than a car
       sliding along still pointing forwards */
    return { c, w, ang: p.h + VIEW.rot + (c.spinAng || 0) };
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

  /* smoke, dust, debris and sparks sit above the cars so a wreck reads
     as happening on top of the track rather than under it */
  drawFX();

  drawGantry(tk, HALF);

  if (R.yellow) {
    cx.fillStyle = "rgba(233,161,27,.15)"; cx.fillRect(0, 0, CW, CH);
    for (let i = 0; i < CW; i += 34) px(i, 0, 17, 4, "#e9a11b");
  }
  if (shaking) cx.restore();          // HUD must not shake with the world

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

  /* Grandstand: a raked deck with a front railing, aisles that split it
     into sections, entrance tunnels at the base and a roof on columns. */
  /* A frame budget for the crowd.

     Grandstands were the most expensive thing in the game by a distance:
     6.7ms of a 9ms frame on the tight street circuit, where the camera can
     see most of the lap at once and every visible section was drawn in
     full with a crowd in it.  Sections are capped and the crowd has a
     sprite budget; both spend themselves nearest-first, so what you lose
     is people in the far corner of a stand you can barely see. */
  let standBudget = 13, crowdBudget = 240;
  const standStep = Math.max(8, step * 3);
  for (let d = Math.floor(d0 / standStep) * standStep; d <= d1; d += standStep) {
    if (!onStraight(d)) continue;
    if (standBudget-- <= 0) break;
    const p = sampleTrack(tk, d);
    const p2 = sampleTrack(tk, d + standStep * 1.02);
    const main = isMain(d);
    const rows = main ? 7 : 5;
    const depth = rows * 1.95;
    const totalH = 8 + rows * 3.4;
    const fA = W2S(offsetPoint(p, -HALF - 9)), fB = W2S(offsetPoint(p2, -HALF - 9));
    if (!onScreen(fA, 150) && !onScreen(fB, 150)) continue;
    const bA = lift(W2S(offsetPoint(p, -HALF - 9 - depth)), totalH);
    const bB = lift(W2S(offsetPoint(p2, -HALF - 9 - depth)), totalH);
    const uu = PX / 2;

    /* Substructure, deck and seats are all authored texture mapped onto
       the quads the geometry already gives us, so the seat rows follow
       the rake instead of being flat bands of grey. */
    const dA = lift(fA, 7 * uu), dB = lift(fB, 7 * uu);
    fillQuadTex(fA, fB, dA, "concrete", 1, 0.4);
    const nRows = Math.max(1, Math.round(rows / 2));
    fillQuadTex(dA, dB, { x: bA.x, y: bA.y }, "seats", 1.1, nRows);

    /* an aisle every fourth section, cut through the seating */
    const aisle = Math.abs(Math.round(d / standStep)) % 4 === 0;
    if (aisle) {
      const mA = { x: (fA.x + fB.x) / 2, y: (fA.y + fB.y) / 2 };
      const mB = { x: (bA.x + bB.x) / 2, y: (bA.y + bB.y) / 2 };
      cx.strokeStyle = "#b6bdc6"; cx.lineWidth = 3 * uu;
      cx.beginPath(); cx.moveTo(mA.x, mA.y - 7 * uu); cx.lineTo(mB.x, mB.y); cx.stroke();
    }

    /* the crowd sits in the rows, in front of the authored seats */
    for (let rw = 0; rw < rows; rw++) {
      const t = (rw + 0.5) / rows;
      const sA = { x: fA.x + (bA.x - fA.x) * t, y: fA.y + (bA.y - fA.y) * t };
      const sB = { x: fB.x + (bB.x - fB.x) * t, y: fB.y + (bB.y - fB.y) * t };
      const seed = Math.abs((d * 5) | 0) + rw * 23;
      const segW = Math.hypot(sB.x - sA.x, sB.y - sA.y);
      const n = clamp(Math.round(segW / (6 * PX)), 1, 5);
      for (let k = 0; k < n; k++) {
        if (aisle && k === Math.floor(n / 2)) continue;      // leave the aisle clear
        const t2 = (k + 0.35) / n;
        const sd2 = seed + k * 13;
        if (sd2 % 12 === 0) continue;                        // an empty seat here and there
        if (crowdBudget-- <= 0) continue;
        spectator(sA.x + (sB.x - sA.x) * t2 - 2 * PX,
                  sA.y + (sB.y - sA.y) * t2 - 11 * PX, sd2, ((frame >> 4) + sd2) % 4 === 0);
      }
    }

    /* front railing so the crowd is not spilling onto the track */
    cx.strokeStyle = "#dfe5ee"; cx.lineWidth = 1.4 * uu;
    cx.beginPath();
    cx.moveTo(fA.x, fA.y - 10 * uu); cx.lineTo(fB.x, fB.y - 10 * uu); cx.stroke();
    for (let k = 0; k <= 2; k++) {
      const t2 = k / 2, rx = fA.x + (fB.x - fA.x) * t2, ry = fA.y + (fB.y - fA.y) * t2;
      px(rx, ry - 10 * uu, uu, 10 * uu, "#cbd2dc");
    }
    /* entrance tunnel at the base of every aisle */
    if (aisle) {
      const mA = { x: (fA.x + fB.x) / 2, y: (fA.y + fB.y) / 2 };
      px(mA.x - 4 * uu, mA.y - 6 * uu, 8 * uu, 6 * uu, "#1b1f26");
      px(mA.x - 5 * uu, mA.y - 8 * uu, 10 * uu, 2 * uu, "#6d747d");
      px(mA.x - 4 * uu, mA.y - 6 * uu, 8 * uu, uu, "#2a2f38");
    }
    /* roof deck on columns over the main stand */
    if (main) {
      const rh = 26 * uu;
      const rA = lift(bA, rh), rB = lift(bB, rh);
      fillQuadTex(rA, rB, lift(rA, 3 * uu), "concrete", 1, 0.2);
      quadS(lift(bA, rh + 3 * uu), lift(bB, rh + 3 * uu),
            lift({ x: bB.x + 6 * uu, y: bB.y + 4 * uu }, rh + 3 * uu),
            lift({ x: bA.x + 6 * uu, y: bA.y + 4 * uu }, rh + 3 * uu), "#6d7682");
      px(bA.x, bA.y - rh, 1.6 * uu, rh, "#87909c");
    }
  }

  /* --- the outer barrier ---
     Drawn as a constant-thickness ribbon rather than an extruded face:
     a wall running straight up the screen has no face area to show, so
     extruding it vertically would make it disappear.  The face itself
     is authored texture — SAFER steel on the ovals, poured concrete on
     the street circuits — with the sponsor livery painted over it. */
  const AD = ["#e8332a", "#ffd23f", "#2255cc", "#3fae4a", "#ffffff", "#e9a11b"];
  const street = R.track.surf === "street";
  const wallH = Math.max(4, VIEW.sc * 1.6);
  const wStep = Math.max(5, step * 1.8);
  const segs = [];
  for (let d = d0; d <= d1; d += wStep) segs.push(W2S(offsetPoint(sampleTrack(tk, d), -HALF - 2.2)));
  cx.lineCap = "butt"; cx.lineJoin = "round";
  let wallBudget = 34;
  for (let i = 0; i < segs.length - 1; i++) {
    const a = segs[i], b = segs[i + 1];
    if (!onScreen(a, 70) && !onScreen(b, 70)) continue;
    if (wallBudget-- <= 0) break;
    const k = Math.abs(Math.floor((d0 + i * wStep) / 11));
    /* the authored panel face */
    stripTex([a, b], -wallH, street ? "concwall" : "safer", Math.max(1, wallH / 12), 0);
    /* a painted livery band across the middle third, which is what makes
       a wall read as a racetrack rather than a kerb */
    if (!street) {
      cx.strokeStyle = AD[k % 6]; cx.lineWidth = wallH * 0.30;
      cx.beginPath();
      cx.moveTo(a.x, a.y - wallH * 0.30); cx.lineTo(b.x, b.y - wallH * 0.30); cx.stroke();
    }
  }
  cx.strokeStyle = "#ffffff"; cx.lineWidth = 1.5 * U();
  cx.beginPath();
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i];
    if (i === 0) cx.moveTo(a.x, a.y - wallH * 0.92); else cx.lineTo(a.x, a.y - wallH * 0.92);
  }
  cx.stroke();

  /* Catch fence: authored mesh between real posts.

     Budgeted like the crowd.  Every visible wall segment used to get its
     own textured strip, and on a circuit where the camera sees most of the
     lap that is a lot of large fills for something you look through. */
  if (VIEW.sc > 1.8) {
    const fh = wallH * 2.6;
    let fenceBudget = 26;
    for (let i = 0; i < segs.length - 1; i++) {
      const a = segs[i], b = segs[i + 1];
      if (!onScreen(a, 60) && !onScreen(b, 60)) continue;
      if (fenceBudget-- <= 0) break;
      stripTex([a, b], -fh, "fence", Math.max(1, PX * 0.7), wallH);
    }
    for (let i = 0; i < segs.length - 1; i += 2) {
      const a = segs[i];
      if (!onScreen(a, 50)) continue;
      px(a.x, a.y - wallH - fh, Math.max(1, U()), fh, "rgba(206,213,224,.9)");
    }
    cx.strokeStyle = "rgba(214,222,234,.55)"; cx.lineWidth = Math.max(1, U());
    for (const t of [0.5, 1]) {
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

/* The pit complex: an inner wall, the lane itself, painted boxes and the
   crew working over the wall.  It runs the length of the frontstretch. */
function drawPitRoad(tk, HALF) {
  if (!SCENE) return;
  const fs = SCENE.fs;
  const u = PX / 2, sc = VIEW.sc;
  const step = Math.max(4, (fs.end - fs.start) / 30);

  /* lane surface, a shade lighter than the track */
  const laneOut = [], laneIn = [];
  for (let d = fs.start; d <= fs.end; d += step) {
    const p = sampleTrack(tk, d);
    laneOut.push(W2S(offsetPoint(p, HALF + 2.2)));
    laneIn.push(W2S(offsetPoint(p, HALF + 14)));
  }
  if (laneOut.length > 1) {
    cx.beginPath();
    cx.moveTo(laneOut[0].x, laneOut[0].y);
    for (const q of laneOut) cx.lineTo(q.x, q.y);
    for (let i = laneIn.length - 1; i >= 0; i--) cx.lineTo(laneIn[i].x, laneIn[i].y);
    cx.closePath();
    cx.fillStyle = "#6e7783"; cx.fill();
    /* the painted lane line down the middle */
    cx.strokeStyle = "#f0f3f8"; cx.lineWidth = 1.6 * u;
    cx.beginPath();
    for (let i = 0, d = fs.start; d <= fs.end; d += step, i++) {
      const q = W2S(offsetPoint(sampleTrack(tk, d), HALF + 5.2));
      if (i === 0) cx.moveTo(q.x, q.y); else cx.lineTo(q.x, q.y);
    }
    cx.stroke();
  }

  /* the pit wall between lane and track, with sponsor panels on it */
  const wallH = Math.max(3, sc * 1.1);
  const AD2 = ["#e8332a", "#ffd23f", "#2255cc", "#3fae4a", "#ffffff"];
  const wsegs = [];
  for (let d = fs.start; d <= fs.end; d += step) wsegs.push(W2S(offsetPoint(sampleTrack(tk, d), HALF + 1.6)));
  for (let i = 0; i < wsegs.length - 1; i++) {
    const a = wsegs[i], b = wsegs[i + 1];
    if (!onScreen(a, 80) && !onScreen(b, 80)) continue;
    cx.strokeStyle = AD2[i % 5]; cx.lineWidth = wallH;
    cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
    cx.strokeStyle = "#ffffff"; cx.lineWidth = wallH * 0.3;
    cx.beginPath();
    cx.moveTo(a.x, a.y - wallH * 0.5); cx.lineTo(b.x, b.y - wallH * 0.5); cx.stroke();
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
function resetRaceView() { VIEW = null; SCENE = null; }

/* ============================================================
   CRASH EFFECTS

   A wreck used to be a number changing: the car slowed, a banner said
   so, and nothing on screen looked like an accident.  These are the bits
   that make it read as one — tyre smoke off a locked wheel, the dust and
   debris of a hit, sparks off the wall, and a plume trailing a damaged
   car for the rest of the race.

   Particles live in world space so they stay where the accident happened
   while the camera moves on, and carry a height so smoke rises off the
   surface instead of sliding along it.
   ============================================================ */
let FX = [];
const FX_MAX = 300;
/* A hit you feel.  Two frames of camera displacement does more for the
   weight of a crash than any amount of extra debris. */
let SHAKE = 0;
function fxShake(amount) { SHAKE = Math.min(9, SHAKE + amount); }

/* kind: smoke | dust | debris | spark */
function fxBurst(kind, wx, wy, power, tint) {
  if (FX.length > FX_MAX) return;
  const n = Math.round(clamp(power, 1, 26));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (kind === "debris" ? 26 : kind === "spark" ? 34 : 9) * rnd(0.35, 1.25);
    FX.push({
      k: kind, x: wx, y: wy, z: kind === "smoke" ? rnd(0, 2) : 0,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      vz: kind === "smoke" ? rnd(7, 15) : kind === "debris" ? rnd(9, 22) : rnd(1, 5),
      life: kind === "smoke" ? rnd(1.4, 2.8) : kind === "spark" ? rnd(0.18, 0.40) : rnd(0.6, 1.3),
      age: 0, sz: kind === "smoke" ? rnd(2.6, 5.2) : rnd(1.1, 2.2),
      tint: tint || null,
    });
  }
}
/* a steady plume off a car that is still running but hurt */
function fxTrail(kind, wx, wy, tint) {
  if (FX.length > FX_MAX) return;
  FX.push({ k: kind, x: wx, y: wy, z: rnd(0, 1.2),
    vx: rnd(-3, 3), vy: rnd(-3, 3), vz: rnd(5, 11),
    life: rnd(0.7, 1.5), age: 0, sz: rnd(1.2, 2.6), tint: tint || null });
}

function updateFX(dt) {
  SHAKE = Math.max(0, SHAKE - dt * 22);
  for (let i = FX.length - 1; i >= 0; i--) {
    const p = FX[i];
    p.age += dt;
    if (p.age >= p.life) { FX.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    /* drag, and gravity on anything solid */
    const drag = p.k === "smoke" ? 0.90 : 0.82;
    p.vx *= Math.pow(drag, dt * 60 / 60 + dt);
    p.vy *= Math.pow(drag, dt * 60 / 60 + dt);
    if (p.k === "debris" || p.k === "spark") {
      p.vz -= 46 * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.34; p.vx *= 0.6; p.vy *= 0.6; }
    } else {
      p.vz *= 0.97;
      p.sz += dt * (p.k === "smoke" ? 2.4 : 1.2);      // smoke expands as it cools
    }
  }
}

const FX_SMOKE = ["#2c2f36", "#4a4f59", "#6c727d", "#8f95a1"];
const FX_DUST  = ["#7a6a4e", "#96866a", "#b0a184", "#c8bda6"];
const FX_SPARK = ["#fff3b0", "#ffd23f", "#ff9d2e", "#e8542a"];

/* Batched by colour and by a coarse alpha step.

   One fillRect per particle also means one fillStyle and one globalAlpha
   assignment per particle, and those state changes cost more than the
   rectangle does — three hundred of them put the busiest track at 13ms a
   frame, which is fine on a desktop and not fine on a phone.  Bucketing
   by appearance turns hundreds of state changes into a handful. */
let FX_BUCKETS = new Map();
function drawFX() {
  if (!FX.length || !VIEW) return;
  const u = Math.max(1, PX * 0.9);
  FX_BUCKETS.clear();
  for (const p of FX) {
    const t = p.age / p.life;
    const s = W2S({ x: p.x, y: p.y });
    if (!onScreen(s, 60)) continue;
    const y = s.y - p.z * VIEW.sc * SQ;
    let col, alpha;
    if (p.k === "spark") { col = FX_SPARK[Math.min(3, Math.floor(t * 4))]; alpha = 1 - t; }
    else if (p.k === "debris") { col = p.tint || "#3a3f49"; alpha = (1 - t * t) * 0.9; }
    else if (p.k === "dust") { col = FX_DUST[Math.min(3, Math.floor(t * 4))]; alpha = (1 - t * t) * 0.9; }
    else { col = FX_SMOKE[Math.min(3, Math.floor(t * 4))]; alpha = (1 - t) * 0.55; }
    const a = Math.max(1, Math.round(alpha * 5));          // five alpha steps is plenty
    const key = col + "|" + a;
    let arr = FX_BUCKETS.get(key);
    if (!arr) { arr = []; FX_BUCKETS.set(key, arr); }
    const sz = Math.max(1, Math.round(p.sz * u * (p.k === "smoke" ? (0.6 + t) : 1)));
    arr.push(s.x - sz / 2, y - sz / 2, sz);
  }
  for (const [key, arr] of FX_BUCKETS) {
    const bar = key.indexOf("|");
    cx.fillStyle = key.slice(0, bar);
    cx.globalAlpha = (+key.slice(bar + 1)) / 5;
    for (let i = 0; i < arr.length; i += 3)
      cx.fillRect(Math.round(arr[i]), Math.round(arr[i + 1]), arr[i + 2], arr[i + 2]);
  }
  cx.globalAlpha = 1;
}
function resetFX() { FX = []; }
