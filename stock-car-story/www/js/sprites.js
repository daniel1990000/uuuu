/* ============================================================
   SPRITES — hand-authored pixel art.

   Two kinds of art live here:

   1. FLAT sprites: pixel maps, one character per pixel, drawn
      exactly as authored.  People, props, scenery.

   2. VOXEL sprites: a top-down pixel map where every character
      also carries a HEIGHT.  At boot each model is baked into a
      full set of rotation frames by drawing every cell as a
      little vertical column, far columns first.  That is how the
      cars get real volume and still turn smoothly, without
      hand-drawing thirty-two separate frames per body style.
   ============================================================ */
"use strict";

/* ---------- shared palette ---------- */
const P = {
  o: "#16181d",   // outline
  k: "#2b3038",   // dark trim
  t: "#101216",   // tyre
  T: "#3a404a",   // tyre highlight
  g: "#8f97a3",   // grey metal
  G: "#c3cad4",   // light metal
  w: "#ffffff",
  W: "#e6ebf2",
  s: "#f7c8a0",   // skin (recoloured per person)
  e: "#20232c",   // eye
  m: "#c98a7a",   // mouth
  h: "#4a2c12",   // hair (recoloured)
  b: "#8fc9ef",   // glass
  B: "#5d9dc7",   // glass shade
  r: "#e8332a",
  y: "#ffd23f",
  n: "#2255cc",
  q: "#3fae4a",
  d: "#6d4520",   // wood
  D: "#8a6a3c",
  x: "#c0392b",
  z: "#7d879b",
};

/* Draw a flat pixel map at (x,y).  `sub` swaps palette entries,
   which is how one authored sprite becomes a whole crowd.        */
function blitMap(map, x, y, sub) {
  const u = PX;
  x = Math.round(x); y = Math.round(y);
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    let run = -1, runCol = null;
    for (let c = 0; c <= row.length; c++) {
      const ch = row[c];
      const col = ch && ch !== "." ? ((sub && sub[ch]) || P[ch] || null) : null;
      if (col === runCol && col !== null) continue;
      if (runCol !== null) { cx.fillStyle = runCol; cx.fillRect(x + run * u, y + r * u, (c - run) * u, u); }
      run = c; runCol = col;
    }
  }
}
/* size of a flat sprite on screen */
const sprW = m => Math.max(...m.map(r => r.length)) * PX;
const sprH = m => m.length * PX;

/* ---------- sprite cache ----------
   A spectator is a dozen fill runs; there can be two hundred of them on
   screen.  Bake each variant once into its own little canvas and blit it
   instead — one drawImage per person.                                */
let SPR_CACHE = new Map();
let SPR_CACHE_PX = 0;
function cachedSprite(key, map, sub) {
  if (SPR_CACHE_PX !== PX) { SPR_CACHE = new Map(); SPR_CACHE_PX = PX; }
  let c = SPR_CACHE.get(key);
  if (c) return c;
  const w = Math.max(...map.map(r => r.length)), h = map.length;
  c = document.createElement("canvas");
  c.width = Math.max(1, w * PX); c.height = Math.max(1, h * PX);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  for (let r = 0; r < h; r++) {
    const row = map[r];
    for (let col = 0; col < row.length; col++) {
      const ch = row[col];
      if (!ch || ch === ".") continue;
      g.fillStyle = (sub && sub[ch]) || P[ch] || "#f0f";
      g.fillRect(col * PX, r * PX, PX, PX);
    }
  }
  SPR_CACHE.set(key, c);
  return c;
}
/* Same, but into an arbitrary 2D context (used while baking). */
function blitMapTo(g, map, x, y, sub) {
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (!ch || ch === ".") continue;
      g.fillStyle = (sub && sub[ch]) || P[ch] || "#f0f";
      g.fillRect(x + c, y + r, 1, 1);
    }
  }
}

/* ============================================================
   PEOPLE — authored pixel by pixel
   ============================================================ */

/* spectator, 7×12, arms down */
const SPEC_A = [
  "..ooo..",
  ".ohhho.",
  ".hhhhh.",
  ".hsssh.",
  ".seses.",
  ".sssss.",
  "..sss..",
  ".SSSSS.",
  "sSSSSSs",
  "sSSSSSs",
  ".SdddS.",
  ".kk.kk.",
];
/* spectator, arms up cheering */
const SPEC_B = [
  "s.ooo.s",
  "s.hhh.s",
  "shhhhhs",
  "shssshs",
  ".seses.",
  ".sssss.",
  "..sss..",
  ".SSSSS.",
  ".SSSSS.",
  ".SSSSS.",
  ".SdddS.",
  ".kk.kk.",
];
/* spectator wearing a cap */
const SPEC_C = [
  ".ccccc.",
  "cccccc.",
  ".hhhhh.",
  ".hsssh.",
  ".seses.",
  ".sssss.",
  "..sss..",
  ".SSSSS.",
  "sSSSSSs",
  "sSSSSSs",
  ".SdddS.",
  ".kk.kk.",
];
/* spectator waving a flag */
const SPEC_D = [
  "..ooo.F",
  ".ohhhoF",
  ".hhhhhF",
  ".hsssh|",
  ".seses|",
  ".sssss|",
  "..sss.|",
  ".SSSSS.",
  "sSSSSSs",
  ".SSSSS.",
  ".SdddS.",
  ".kk.kk.",
];
const SPEC_POSES = [SPEC_A, SPEC_C, SPEC_A, SPEC_D, SPEC_B, SPEC_C, SPEC_A, SPEC_B];

const SKIN_T = ["#f7c8a0", "#efb488", "#d9996a", "#b87a4a"];
const HAIR_T = ["#4a2c12", "#171717", "#a4442e", "#e0b74a", "#8a8a8a", "#6a3fa0", "#2e5fa3", "#b5651d"];
const SHIRT_T = ["#e8332a", "#2255cc", "#ffd23f", "#ffffff", "#3fae4a", "#d457a0",
                 "#ff8c42", "#7a4c22", "#12b0b0", "#8a3fc2", "#e8e8ee", "#c0392b"];

function specSub(seed) {
  const sk = SKIN_T[seed % 4], sh = SHIRT_T[(seed * 7) % 12];
  return {
    s: sk, h: HAIR_T[(seed * 3) % 8], S: sh, d: shade(sh, -0.3),
    c: SHIRT_T[(seed * 5) % 12],
    F: seed % 2 ? "#ffd23f" : "#e8332a", "|": "#8a6a3c",
  };
}
/* one spectator; `wave` picks a cheering pose */
function drawSpectator(x, y, seed, wave) {
  const v = seed % 24;                       // 24 recolour variants is plenty
  const poseIdx = wave ? (seed % 2 ? 8 : 9) : (seed % 8);
  const pose = wave ? (seed % 2 ? SPEC_B : SPEC_D) : SPEC_POSES[seed % 8];
  const img = cachedSprite("sp" + poseIdx + "_" + v, pose, specSub(v));
  cx.drawImage(img, Math.round(x), Math.round(y));
}

/* ---------- staff: big head, small body, four facings ---------- */
const STAFF_DOWN = [
  "..oooooo..",
  ".ohhhhhho.",
  "ohhhhhhhho",
  "ohsssssssh",
  ".ssssssss.",
  ".seesseesf",
  ".ssssssss.",
  "..smmmss..",
  "...oooo...",
  "..ASSSSA..",
  ".ASSSSSSA.",
  ".ASdddSA..",
  "...kkkk...",
  "..kk..kk..",
];
const STAFF_UP = [
  "..oooooo..",
  ".ohhhhhho.",
  "ohhhhhhhho",
  "ohhhhhhhhh",
  ".hhhhhhhh.",
  ".hhhhhhhh.",
  ".shhhhhhs.",
  "..ssssss..",
  "...oooo...",
  "..ASSSSA..",
  ".ASSSSSSA.",
  ".ASdddSA..",
  "...kkkk...",
  "..kk..kk..",
];
const STAFF_SIDE = [
  "..oooooo..",
  ".ohhhhhho.",
  "ohhhhhhhho",
  "ohssssssh.",
  ".sssssss..",
  ".seesss...",
  ".sssssm...",
  "..sssss...",
  "...oooo...",
  "..ASSSSA..",
  ".ASSSSSSA.",
  ".ASdddSA..",
  "...kkkk...",
  "..kk..kk..",
];
/* headgear overlays */
const CAP = [
  "..nnnnnn..",
  ".nnnnnnnn.",
  "..NNNNNN..",
];
const HELMET = [
  "..WWWWWW..",
  ".WWWWWWWW.",
  "WWbbbbbbWW",
  "WWWWWWWWWW",
];
const MARSHAL_CAP = [
  "..yyyyyy..",
  ".yyyyyyyy.",
  "..YYYYYY..",
];
function drawStaff(x, y, seed, kind, facing, step) {
  const sk = SKIN_T[seed % 4];
  const shirt = kind === "driver" ? "#e8332a" : kind === "crew" ? "#2a55c8" : "#eceff4";
  const sub = {
    s: sk, h: HAIR_T[(seed * 3) % 8], S: shirt, d: shade(shirt, -0.32),
    A: sk, f: sk, m: "#c98a7a",
    n: "#2255cc", N: "#173a8c", y: "#ffd23f", Y: "#c79000",
  };
  const face2 = facing === "up" ? "u" : (facing === "left" || facing === "right") ? "s" : "d";
  const map = face2 === "u" ? STAFF_UP : face2 === "s" ? STAFF_SIDE : STAFF_DOWN;
  const v = seed % 8;
  const body = cachedSprite("st" + kind + face2 + v, map, sub);
  const hat = kind === "crew" ? cachedSprite("hc" + v, CAP, sub)
    : kind === "driver" ? cachedSprite("hd" + v, HELMET, sub)
    : kind === "marshal" ? cachedSprite("hm" + v, MARSHAL_CAP, sub) : null;
  const hatDy = kind === "driver" ? -2 * PX : -PX;
  cx.save();
  if (facing === "left") { cx.translate(Math.round(x) + 10 * PX, Math.round(y)); cx.scale(-1, 1); }
  else cx.translate(Math.round(x), Math.round(y));
  cx.fillStyle = "rgba(0,0,0,.22)"; cx.fillRect(PX, 14 * PX, 8 * PX, 2 * PX);
  const bob = step ? -PX : 0;
  cx.drawImage(body, 0, bob);
  if (hat) cx.drawImage(hat, 0, bob + hatDy);
  cx.restore();
}

/* ============================================================
   PROPS
   ============================================================ */
/* one tyre seen from the side; stacks build on top of each other */
const PROP_TYRES = [
  ".ooooooooo.",
  "otTTTTTTTto",
  "ottggggttto",
  "otTTTTTTTto",
  ".ooooooooo.",
];
const PROP_CONE = [
  "..rr..",
  "..rr..",
  ".rwwr.",
  ".rrrr.",
  "rrrrrr",
  "kkkkkk",
];
const PROP_DRUM = [
  ".GGGGG.",
  "GxxxxxG",
  "GxxxxxG",
  "GwwwwwG",
  "GxxxxxG",
  "GxxxxxG",
  ".kkkkk.",
];
const PROP_TOOLBOX = [
  "..GGGG..",
  ".xxxxxx.",
  "xxxxxxxx",
  "xwwwwwwx",
  "xxxxxxxx",
  "kkkkkkkk",
];
const PROP_PINE = [
  "....qq....",
  "...qqqq...",
  "..qqqqqq..",
  ".qqQQQQqq.",
  "..qqqqqq..",
  ".qqqqqqqq.",
  "qqqQQQQqqq",
  ".qqqqqqqq.",
  "....dd....",
  "....dd....",
];
const PROP_PALM = [
  "..q...q...",
  ".qqq.qqq..",
  "qqqQQQqqq.",
  "..qqQqq...",
  "....D.....",
  "....D.....",
  "...DD.....",
  "...DD.....",
  "..DDD.....",
  "..dd......",
];
const PROP_TROPHY = [
  ".yyyyy.",
  ".yYYYy.",
  ".yyyyy.",
  "..yyy..",
  "...y...",
  "..ddd..",
  ".ddddd.",
];
let PROP_KEY = 0;
const PROP_KEYS = new WeakMap();
function drawProp(map, x, y, sub) {
  if (sub) { blitMap(map, x, y, sub); return; }
  let k = PROP_KEYS.get(map);
  if (k === undefined) { k = "pr" + (PROP_KEY++); PROP_KEYS.set(map, k); }
  cx.drawImage(cachedSprite(k, map, null), Math.round(x), Math.round(y));
}

/* ============================================================
   VOXEL CAR MODELS
   Each character is one cell of the car seen from directly above.
   VOX gives every character a colour role and a height.
   Colour roles:  1 = livery (team colour), 2 = livery shade,
   3 = livery light, and anything else is a literal palette entry.
   ============================================================ */
const VOX = {
  //         height (cells), colour role
  "#": { h: 1.6, c: "2" },        // rocker / sill
  "K": { h: 1.8, c: "#2b3038" },  // bumper
  "B": { h: 2.3, c: "1" },        // body panel
  "b": { h: 2.2, c: "2" },        // body shade
  "C": { h: 2.4, c: "#d5dbe4" },  // chrome side stripe
  "N": { h: 2.4, c: "#ffffff" },  // number panel
  "H": { h: 2.0, c: "1" },        // hood
  "h": { h: 2.0, c: "3" },        // hood highlight
  "R": { h: 3.4, c: "1" },        // roof
  "r": { h: 3.4, c: "3" },        // roof highlight
  "W": { h: 3.0, c: "#8fc9ef" },  // windscreen
  "V": { h: 3.0, c: "#6ba8cf" },  // rear window
  "S": { h: 3.3, c: "2" },        // spoiler blade
  "P": { h: 2.6, c: "2" },        // spoiler post
  "T": { h: 1.3, c: "#101216" },  // tyre
  "t": { h: 1.5, c: "#33383f" },  // tyre shoulder
  "G": { h: 1.9, c: "#2b3038" },  // grille
  "L": { h: 2.0, c: "#ffe9a8" },  // headlight
  "X": { h: 2.0, c: "#ff5a4a" },  // tail light
  "D": { h: 3.9, c: "#f2f2f2" },  // driver helmet
  "d": { h: 3.9, c: "#5fc0f0" },  // helmet visor
  "A": { h: 3.6, c: "#c3cad4" },  // cab pillar / roll cage
};

/* Every model is a top-down pixel map, 26 long × 12 wide.
   Columns run rear (left) to nose (right); the middle rows carry the
   cabin, the outer rows the fenders, so the shape reads from above. */

/* --- standard stock car: fendered saloon --- */
const CAR_STOCK = [
  "...TTTTT.........TTTTT....",
  ".##ttttt#########ttttt###.",
  "KXBBBBBBBBBBBBBBBBHHHHHHLK",
  "SPBBCCBBBBBBBBBBBBHHHHHHLK",
  "SPBBBBBBBVVRRRRRWWHHHHHHGK",
  "SPBBBBBBBVVRNNNRWWhhhhhhGK",
  "SPBBBBBBBVVRNNNRWWhhhhhhGK",
  "SPBBBBBBBVVRRRRRWWHHHHHHGK",
  "SPBBCCBBBBBBBBBBBBHHHHHHLK",
  "KXBBBBBBBBBBBBBBBBHHHHHHLK",
  ".##ttttt#########ttttt###.",
  "...TTTTT.........TTTTT....",
];

/* --- aero coupe: shallower cabin, long nose, tall wing --- */
const CAR_AERO = [
  "...TTTTT..........TTTTT...",
  ".##ttttt##########ttttt##.",
  "KXBBBBBBBBBBBBBBBhhhhhhhLK",
  "SSBBCCBBBBBBBBBBBhhhhhhhLK",
  "SPBBBBBBBVVRRRRWWhhhhhhhGK",
  "SPBBBBBBBVVRNNRWWhhhhhhhGK",
  "SPBBBBBBBVVRNNRWWhhhhhhhGK",
  "SPBBBBBBBVVRRRRWWhhhhhhhGK",
  "SSBBCCBBBBBBBBBBBhhhhhhhLK",
  "KXBBBBBBBBBBBBBBBhhhhhhhLK",
  ".##ttttt##########ttttt##.",
  "...TTTTT..........TTTTT...",
];

/* --- race truck: tall square cab, flat bed behind --- */
const CAR_TRUCK = [
  "...TTTTT.........TTTTT....",
  ".##ttttt#########ttttt###.",
  "KXBBBBBBBBAAAAAAWWHHHHHHLK",
  "KXBBBBBBBBARRRRAWWHHHHHHLK",
  "KKBBBBBBBBARRRRAWWHHHHHHGK",
  "KKBBNNBBBBARRRRAWWhhhhhhGK",
  "KKBBNNBBBBARRRRAWWhhhhhhGK",
  "KKBBBBBBBBARRRRAWWHHHHHHGK",
  "KXBBBBBBBBARRRRAWWHHHHHHLK",
  "KXBBBBBBBBAAAAAAWWHHHHHHLK",
  ".##ttttt#########ttttt###.",
  "...TTTTT.........TTTTT....",
];

/* --- dirt modified: wheels outside the body, roof wing, open cockpit --- */
const CAR_MOD = [
  "..TTTTTT........TTTTTT....",
  "..TTTTTT........TTTTTT....",
  "..tttttt........tttttt....",
  "...SSSSSSSSSSSSSS.........",
  "...#BBBBBBBBBBBBBhhhhhGK..",
  "...PBBNNBAADdAAWBhhhhhGK..",
  "...PBBNNBAADdAAWBhhhhhGK..",
  "...#BBBBBBBBBBBBBhhhhhGK..",
  "...SSSSSSSSSSSSSS.........",
  "..tttttt........tttttt....",
  "..TTTTTT........TTTTTT....",
  "..TTTTTT........TTTTTT....",
];

const CAR_MODELS = { stock: CAR_STOCK, aero: CAR_AERO, truck: CAR_TRUCK, mod: CAR_MOD };
/* which model each chassis uses */
const CHASSIS_MODEL = {
  street: "stock", late: "stock", dirtmod: "mod", dragster: "aero", truck: "truck",
  pony: "stock", sonic: "stock", torpedo: "aero", proto: "stock", aero: "aero",
  spiral: "aero", hauler: "truck", gen4: "stock", moonshine: "stock", nextgen: "aero",
};

/* ---------- the baker ---------- */
const CAR_FRAMES = 32;
const VOX_SQ = 0.56;              // matches the ground-plane squash
let CAR_CELL = 1.7;               // screen px per model cell (scales with PX)
let CAR_ATLAS = null;             // [colourIndex][frame] -> canvas
let CAR_ATLAS_KEYS = null;

function bakeCarFrame(model, colour, ang) {
  const rows = model.length, cols = Math.max(...model.map(r => r.length));
  const diag = Math.hypot(rows, cols) * CAR_CELL;
  const size = Math.ceil(diag + 14);
  const cv2 = document.createElement("canvas");
  cv2.width = size; cv2.height = size;
  const g = cv2.getContext("2d");
  g.imageSmoothingEnabled = false;

  const lit = shade(colour, 0.24), dim = shade(colour, -0.34);
  const roleCol = { "1": colour, "2": dim, "3": lit };

  const cs = Math.cos(ang), sn = Math.sin(ang);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = model[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (!ch || ch === ".") continue;
      const v = VOX[ch];
      if (!v) continue;
      const fx = (c - cols / 2 + 0.5) * CAR_CELL;
      const fy = (r - rows / 2 + 0.5) * CAR_CELL;
      const rx = fx * cs - fy * sn;
      const ry = (fx * sn + fy * cs) * VOX_SQ;
      cells.push({ rx, ry, v, ch });
    }
  }
  /* far cells first so near columns overdraw them */
  cells.sort((a, b) => a.ry - b.ry);

  const cx0 = size / 2, cy0 = size / 2 + 4;
  const W = Math.ceil(CAR_CELL) + 1;
  for (const cell of cells) {
    const top = roleCol[cell.v.c] || cell.v.c;
    const side = shade(typeof top === "string" && top[0] === "#" ? top : colour, -0.42);
    const h = cell.v.h * CAR_CELL;
    const x = cx0 + cell.rx, y = cy0 + cell.ry;
    g.fillStyle = side;
    g.fillRect(Math.round(x), Math.round(y - h), W, Math.ceil(h) + 1);
    g.fillStyle = top;
    g.fillRect(Math.round(x), Math.round(y - h), W, W);
  }
  outlinePass(cv2, "#14161b");
  return cv2;
}

/* Stamp a one-pixel dark edge wherever an opaque pixel touches empty
   space.  Pixel art needs the silhouette to read at a glance.        */
function outlinePass(canvas, colour) {
  const g = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const src = g.getImageData(0, 0, w, h);
  const a = src.data;
  const out = g.createImageData(w, h);
  const o = out.data;
  const col = [parseInt(colour.slice(1, 3), 16), parseInt(colour.slice(3, 5), 16), parseInt(colour.slice(5, 7), 16)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (a[i + 3] > 0) { o[i] = a[i]; o[i + 1] = a[i + 1]; o[i + 2] = a[i + 2]; o[i + 3] = a[i + 3]; continue; }
      let touch = false;
      for (let dy = -1; dy <= 1 && !touch; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (a[(ny * w + nx) * 4 + 3] > 0) { touch = true; break; }
        }
      if (touch) { o[i] = col[0]; o[i + 1] = col[1]; o[i + 2] = col[2]; o[i + 3] = 255; }
    }
  }
  g.putImageData(out, 0, 0);
}

function buildCarAtlas() {
  CAR_CELL = 1.7 * (PX / 2) * 1.25;      // more cells of detail at high dpi
  CAR_ATLAS = {};
  CAR_ATLAS_KEYS = Object.keys(CAR_MODELS);
  for (const key of CAR_ATLAS_KEYS) {
    CAR_ATLAS[key] = TEAMC.map(col => {
      const frames = [];
      for (let f = 0; f < CAR_FRAMES; f++)
        frames.push(bakeCarFrame(CAR_MODELS[key], col, (f / CAR_FRAMES) * Math.PI * 2));
      return frames;
    });
  }
}
/* Blit a baked car.  `ang` is the screen-space heading. */
function drawCarSprite(x, y, ang, colourIdx, modelKey, size) {
  if (!CAR_ATLAS) buildCarAtlas();
  const set = CAR_ATLAS[modelKey] || CAR_ATLAS.stock;
  const frames = set[((colourIdx % TEAMC.length) + TEAMC.length) % TEAMC.length];
  let a = ang % (Math.PI * 2); if (a < 0) a += Math.PI * 2;
  const f = Math.round((a / (Math.PI * 2)) * CAR_FRAMES) % CAR_FRAMES;
  const img = frames[f];
  const sc = size / (img.width * 0.72);
  const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
  cx.drawImage(img, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
}
