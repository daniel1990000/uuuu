/* ============================================================
   TEXTURES — hand-authored tileable pixel art for every surface.

   The cars were the only thing in this game made of real pixel
   art; everything they drove on was a flat fill with a couple of
   translucent strokes over it.  That gap is what made the track
   look cheap next to the machines running on it.

   So every surface is authored here the same way the cars are:
   a character grid, one character per pixel, one entry per
   palette colour.  At boot each grid is baked into a little
   canvas and turned into a repeating pattern.

   The important trick is that the patterns are WORLD-LOCKED.
   The chase camera rotates and zooms, so a pattern left in
   screen space would swim under the cars like a bad screensaver.
   Instead each pattern carries the same matrix the geometry uses
   (rotate by the camera, squash by SQ, scale by the zoom), so the
   aggregate in the asphalt stays glued to the piece of track it
   was painted on.
   ============================================================ */
"use strict";

/* ---------- ground palette ----------
   Deliberately narrow.  Four or five steps per material reads as
   texture; more reads as noise and fights the sprites on top.  */
const GP = {
  /* asphalt, dark to light */
  "1": "#41464e", "2": "#4b515a", "3": "#555b65", "4": "#5f666f", "5": "#6b727c",
  /* tar black + fresh patch */
  "0": "#33373d", "6": "#767d87",
  /* grass, dark to light */
  a: "#3f8a2c", b: "#489632", c: "#51a239", d: "#5cae42", e: "#68ba4d",
  /* concrete */
  f: "#8d939c", g: "#9aa1aa", h: "#a8afb8", i: "#7d838c", j: "#b6bdc6",
  /* sand / run-off */
  k: "#c8b184", l: "#d3bd92", m: "#bda476", n: "#ddc9a3",
  /* painted */
  w: "#eef2f8", y: "#f0c53c", r: "#d63b30", u: "#c9cfd8",
  /* street tarmac (bluer, older, more patched than speedway asphalt) */
  p: "#464b54", q: "#505660", s: "#5a616b", t: "#646b75",
};

/* ============================================================
   GROUND TILES — 32x32, authored to wrap seamlessly.
   ============================================================ */

/* Speedway asphalt.  Fine aggregate only — 16x16 and deliberately
   featureless.  The first cut of this tile carried a repair patch and
   a tar seam baked in, and at the size a texel actually renders they
   repeated across the whole track like polka dots.  Anything bigger
   than a couple of pixels has to be geometry that follows the surface,
   not something trapped in the tile. */
const TEX_ASPHALT = [
  "3243333423423334",
  "4333243342333423",
  "3342333423334233",
  "2433423533423334",
  "3334233342333142",
  "4233342342333423",
  "3324334233342333",
  "3423423335423342",
  "2333423423334233",
  "3342332433423423",
  "4233342333314233",
  "3334423342332433",
  "2342333423423335",
  "3323423334233342",
  "4233234233342333",
  "3334233342334234",
];

/* Worn asphalt for the older tracks: the aggregate polished out of it,
   so it sits a step lighter and flatter than fresh speedway surface. */
const TEX_ASPHALT_WORN = [
  "4554445545444554",
  "5445544454455445",
  "4454455445544554",
  "5544544554455445",
  "4455445545445544",
  "5445544454554455",
  "4554455445445454",
  "5445445554554455",
  "4455445445544554",
  "5544554455445445",
  "4454455545544554",
  "5545445454455445",
  "4455445545445544",
  "5445544455445455",
  "4554455445544554",
  "5445445454455445",
];

/* Street-course tarmac: bluer and older, with the seam of a
   resurfaced lane and a drain cover. */
const TEX_STREET = [
  "qsqqtsqqsqtqqsqqtsqqsqtqqsqqtsqq",
  "sqqtqsqqtqsqqtsqqtqsqqtqsqqtqsqq",
  "qtsqqsqtqqsqqtsqqsqtqqsqqtsqqsqt",
  "pppppppppppppppppppppppppppppppp",
  "qsqqtsqqsqtqqsqqtsqqsqtqqsqqtsqq",
  "sqqtqsqqtqsqqtsqqtqsqqtqsqqtqsqq",
  "qtsqqsqtqqsqqtsqqsqtqqsqqtsqqsqt",
  "qsqqtsqqsqtqqsqqtsqqsqtqqsqqtsqq",
  "sqqtqsqqtqppppppppqsqqtqsqqtqsqq",
  "qtsqqsqtqqpiiiiiipqtqqsqqtsqqsqt",
  "qsqqtsqqsqpiffffipqqtsqqsqqtsqqs",
  "sqqtqsqqtqpifiiffpqsqqtqsqqtqsqq",
  "qtsqqsqtqqpiffffipqtqqsqqtsqqsqt",
  "qsqqtsqqsqpiiiiiipqqtsqqsqqtsqqs",
  "sqqtqsqqtqppppppppqsqqtqsqqtqsqq",
  "qtsqqsqtqqsqqtsqqsqtqqsqqtsqqsqt",
  "qsqqtsqqsqtqqsqqtsqqsqtqqsqqtsqq",
  "sqqtqsqqtqsqqtsqqtqsqqtqsqqtqsqq",
  "tttttttttttttttttttttttttttttttt",
  "sqqtqsqqtqsqqtsqqtqsqqtqsqqtqsqq",
  "qtsqqsqtqqsqqtsqqsqtqqsqqtsqqsqt",
  "qsqqtsqqsqtqqsqqtsqqsqtqqsqqtsqq",
  "sqqtqsqqtqsqqtsqqtqsqqtqsqqtqsqq",
  "qtsqqsqtqqsqqtsqqsqtqqsqqtsqqsqt",
  "qsqqtsqqsqtqqsqqtsqqsqtqqsqqtsqq",
  "sqqtqsqqtqsqqtsqqtqsqqtqsqqtqsqq",
  "qtsqqsqtqqsqqtsqqsqtqqsqqtsqqsqt",
  "qsqqtsqqsqtqqsqqtsqqsqtqqsqqtsqq",
  "sqqtqsqqtqsqqtsqqtqsqqtqsqqtqsqq",
  "qtsqqsqtqqsqqtsqqsqtqqsqqtsqqsqt",
  "qsqqtsqqsqtqqsqqtsqqsqtqqsqqtsqq",
  "sqqtqsqqtqsqqtsqqtqsqqtqsqqtqsqq",
];

/* Infield grass, mown.  The blade flecks are irregular so the
   repeat does not read as a grid; the two mow bands run the whole
   width so neighbouring tiles line up. */
const TEX_GRASS = [
  "ccdcccdccccdcccdccdcccdccccdcccd",
  "cdcccccdcccccdccccdcccccdcccccdc",
  "ccccdccccdcccccdccccdccccdccccdc",
  "dccccdcccccdccccdcccccdcccccdccc",
  "ccdcccdcecccdcccdccdcccdcecccdcc",
  "cccccdcccccdcccccdcccccdcccccdcc",
  "cdccccdccccdcccdccdccccdccccdccc",
  "ccccdcccccdccccdcccccdcccccdcccc",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "bcbbcbbbcbbbcbbcbbcbbcbbbcbbbcbb",
  "bbbcbbbcbbbbcbbbcbbbcbbbcbbbbcbb",
  "cbbbbcbbbbcbbbbcbbbbcbbbbcbbbbcb",
  "bbcbbbbcbbbcbbbcbbcbbbbcbbbcbbbc",
  "bbbbcbbbcbbbbcbbbbcbbbcbbbbcbbbb",
  "cbbbbbcbbbbcbbbbcbbbbbcbbbbcbbbb",
  "bbcbbbbbcbbbbcbbbbcbbbbbcbbbbcbb",
  "ccdcccdccccdcccdccdcccdccccdcccd",
  "cdcccccdcccccdccccdcccccdcccccdc",
  "ccccdccccdcccccdccccdccccdccccdc",
  "dccccdcccccdccccdcccccdcccccdccc",
  "ccdcccdccecccdccdccdcccdccecccdc",
  "cccccdcccccdcccccdcccccdcccccdcc",
  "cdccccdccccdcccdccdccccdccccdccc",
  "ccccdcccccdccccdcccccdcccccdcccc",
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "abaabaaabaaabaabaabaabaaabaaabaa",
  "aaabaaabaaaabaaabaaabaaabaaaabaa",
  "baaaabaaaabaaaabaaaabaaaabaaaaba",
  "aabaaaabaaabaaabaabaaaabaaabaaab",
  "aaaabaaabaaaabaaaabaaabaaaabaaaa",
  "baaaaabaaaabaaaabaaaaabaaaabaaaa",
  "aabaaaaabaaaabaaaabaaaaabaaaabaa",
];

/* Concrete apron / pit lane: big poured slabs with control joints
   that meet the tile edges, plus a little surface mottle. */
const TEX_CONCRETE = [
  "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii",
  "ighghgghghgghghgghgghgghghgghghg",
  "ihgghghgghghgghghgghghgghghgghgi",
  "igghgjghgghghgghgjghgghghgghghgi",
  "ihgghghgghgjgghghgghghgghgjgghgi",
  "igghgghgghghgghghgghghgghghgghgi",
  "ihgghgjghgghghgghghgghgjghgghghi",
  "igghghgghghgghgjgghghgghghgghgji",
  "ihgghghgghghgghghgghghgghghgghgi",
  "igghgjghgghghgghgjghgghghgghghgi",
  "ihgghghgghgjgghghgghghgghgjgghgi",
  "igghgghgghghgghghgghghgghghgghgi",
  "ihgghgjghgghghgghghgghgjghgghghi",
  "igghghgghghgghgjgghghgghghgghgji",
  "ihgghghgghghgghghgghghgghghgghgi",
  "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii",
  "ihgghghgghghgghghgghghgghghgghgi",
  "igghgjghgghghgghgjghgghghgghghgi",
  "ihgghghgghgjgghghgghghgghgjgghgi",
  "igghgghgghghgghghgghghgghghgghgi",
  "ihgghgjghgghghgghghgghgjghgghghi",
  "igghghgghghgghgjgghghgghghgghgji",
  "ihgghghgghghgghghgghghgghghgghgi",
  "igghgjghgghghgghgjghgghghgghghgi",
  "ihgghghgghgjgghghgghghgghgjgghgi",
  "igghgghgghghgghghgghghgghghgghgi",
  "ihgghgjghgghghgghghgghgjghgghghi",
  "igghghgghghgghgjgghghgghghgghgji",
  "ihgghghgghghgghghgghghgghghgghgi",
  "igghgjghgghghgghgjghgghghgghghgi",
  "ihgghghgghgjgghghgghghgghgjgghgi",
  "igghgghgghghgghghgghghgghghgghgi",
];

/* Sand run-off for the road courses. */
const TEX_SAND = [
  "klkkllkkllkklkklkllkkllkklkklkll",
  "lkkllkklkkllkkllkklkkllkklkkllkk",
  "kllkkllkklkklkklkllkkllkklkklkkl",
  "lkklkklkllkkllkklkkllkklkkllkklk",
  "klnkllkkllkklkklkllkkllnkklkklkl",
  "lkkllkklkkllkkllkklkkllkklkkllkk",
  "kllkkllkklkklkklkllkkllkklkklkkl",
  "mkklkklkllkkllkklkkllkklkkllkklm",
  "klkkllkkllkklkklkllkkllkklkklkll",
  "lkkllkkmkkllkkllkklkkllkklkkllkk",
  "kllkkllkklkklkklkllkkllkklkklkkl",
  "lkklkklkllkkllkklkkllkklkkllkklk",
  "klkkllkkllkklkklkllkkllkklkklkll",
  "lkkllkklkkllkkllkklkkllkklkkllkk",
  "kllkkllkklkklkknkllkkllkklkklkkl",
  "lkklkklkllkkllkklkkllkklkkllkklk",
  "klkkllkkllkklkklkllkkllkklkklkll",
  "lkkllkklkkllkkllkklkkllkklkkllkk",
  "kllkkllkklkklkklkllkkllkklkklkkl",
  "lkklkklkllkkllkklkkllkklkkllkklk",
  "klnkllkkllkklkklkllkkllkklkklkll",
  "lkkllkklkkllkkllkklkkllkklkkllkk",
  "kllkkllkklkklkklkllkkllkklkklkkl",
  "mkklkklkllkkllkklkkllkklkkllkklm",
  "klkkllkkllkklkklkllkkllkklkklkll",
  "lkkllkkmkkllkkllkklkkllkklkkllkk",
  "kllkkllkklkklkklkllkkllkklkklkkl",
  "lkklkklkllkkllkklkkllkklkkllkklk",
  "klkkllkkllkklkklkllkkllkklkklkll",
  "lkkllkklkkllkkllkklkkllkklkkllkk",
  "kllkkllkklkklkknkllkkllkklkklkkl",
  "lkklkklkllkkllkklkkllkklkkllkklk",
];

/* ---------- extra palette entries used by the structures ---------- */
GP.S = "#3a6fb5"; GP.V = "#2f5c99"; GP.X = "#4d82c8";   // moulded seats
GP.A = "#b9c0ca"; GP.B = "#8a919b"; GP.C = "#dde3ec";   // galvanised steel
GP.D = "#2a2f38"; GP.E = "#1b1f26";                     // shadow, void
GP.F = "#e8332a"; GP.G = "#2255cc"; GP.H = "#3fae4a";   // livery reds/blues/greens

/* ============================================================
   STRUCTURE TEXTURES
   These are mapped onto the quads the geometry already produces,
   so the seat rows follow the rake of a stand and the barrier
   panels follow the curve of a wall.
   ============================================================ */

/* One seat row: tread, riser, and moulded seats with a highlight
   down the right of each shell.  32 wide so it tiles along a
   stand, 8 tall so a deck of N rows repeats it N times. */
const TEX_SEATS = [
  "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii",
  "VVVXVVVXVVVXVVVXVVVXVVVXVVVXVVVX",
  "SSSXSSSXSSSXSSSXSSSXSSSXSSSXSSSX",
  "SSSXSSSXSSSXSSSXSSSXSSSXSSSXSSSX",
  "VVVXVVVXVVVXVVVXVVVXVVVXVVVXVVVX",
  "gggggggggggggggggggggggggggggggg",
  "gggggggggggggggggggggggggggggggg",
  "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii",
];

/* SAFER barrier: stacked steel tubes over a concrete base, with a
   vertical seam every eight texels where the panels bolt up. */
const TEX_SAFER = [
  "CCCCCCCiCCCCCCCiCCCCCCCiCCCCCCCi",
  "AAAAAAAiAAAAAAAiAAAAAAAiAAAAAAAi",
  "AAAAAAAiAAAAAAAiAAAAAAAiAAAAAAAi",
  "BBBBBBBiBBBBBBBiBBBBBBBiBBBBBBBi",
  "CCCCCCCiCCCCCCCiCCCCCCCiCCCCCCCi",
  "AAAAAAAiAAAAAAAiAAAAAAAiAAAAAAAi",
  "BBBBBBBiBBBBBBBiBBBBBBBiBBBBBBBi",
  "ffffffffffffffffffffffffffffffff",
  "gggggggggggggggggggggggggggggggg",
  "ffffffffffffffffffffffffffffffff",
  "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii",
  "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
];

/* Plain concrete wall for the street circuits — no SAFER steel,
   just poured barrier sections with a scuffed top rail. */
const TEX_CONCWALL = [
  "jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj",
  "hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh",
  "ghgggghgigggghgggigggghgiggggghg",
  "gggghggigggghggggigghgggigggghgg",
  "hggggggifgggghggfigggghgifgggggh",
  "ggghgggigggghgggigggghggigggghgg",
  "ffffffffffffffffffffffffffffffff",
  "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii",
  "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
];

/* Kerb: alternating red and white blocks with a bevelled inner lip.
   Eight texels per block, so it tiles along any length of apex. */
const TEX_KERB = [
  "wwwwwwwwrrrrrrrrwwwwwwwwrrrrrrrr",
  "wwwwwwwwrrrrrrrrwwwwwwwwrrrrrrrr",
  "wwwwwwwwrrrrrrrrwwwwwwwwrrrrrrrr",
  "uuuuuuuuFFFFFFFFuuuuuuuuFFFFFFFF",
  "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii",
];

/* Catch-fence mesh, 8x8.  Deliberately sparse: it has to read as
   wire across the crowd without hiding them. */
const TEX_FENCE = [
  "A..A....",
  "........",
  "A..A....",
  "....A..A",
  "........",
  "....A..A",
  "A..A....",
  "........",
];

/* City facade for the street circuits: floors of lit and dark windows
   over a spandrel band.  16 wide so a building of any width tiles it,
   8 tall so one repeat is one storey. */
const TEX_FACADE = [
  "iiiiiiiiiiiiiiii",
  "hEEhhEEhhEEhhEEh",
  "hEyhhEEhhyEhhEEh",
  "hEEhhyEhhEEhhyEh",
  "iiiiiiiiiiiiiiii",
  "gggggggggggggggg",
  "gggggggggggggggg",
  "iiiiiiiiiiiiiiii",
];

/* Pavement: flagstones with a kerbstone edge, for the street courses
   where the run-off would otherwise be. */
const TEX_PAVEMENT = [
  "hhhhhhhhiiiiiiii",
  "hgggggghiggggggi",
  "hgggggghiggggggi",
  "hgggggghiggggggi",
  "hhhhhhhhiiiiiiii",
  "iggggggihggggggh",
  "iggggggihggggggh",
  "iiiiiiiihhhhhhhh",
];

/* Garage floor: sealed concrete with a painted bay outline, a
   drain channel and the odd oil stain. */
const TEX_GARAGE_FLOOR = [
  "hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh",
  "hgghghgghghgghghgghghgghghgghghh",
  "hghgghghgghgjgghghgghgjgghghghgh",
  "hgghghgghghgghghgghghgghghgghghh",
  "hyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyh",
  "hghgghghgghghgghghgghghgghghghgh",
  "hgghghgghgDDgghghgghgDDgghgghghh",
  "hghgghghgghDgghghgghghDgghghghgh",
  "hgghghgghghgghghgghghgghghgghghh",
  "hghgghghgghgjgghghgghgjgghghghgh",
  "hgghghgghghgghghgghghgghghgghghh",
  "hghgghghgghghgghghgghghgghghghgh",
  "hgghghgghghgghghgghghgghghgghghh",
  "hghgghghgghgjgghghgghgjgghghghgh",
  "hgghghgghghgghghgghghgghghgghghh",
  "hyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyh",
  "hgghghgghghgghghgghghgghghgghghh",
  "hghgghghgghghgghghgghghgghghghgh",
  "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii",
  "ffffffffffffffffffffffffffffffff",
  "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii",
  "hgghghgghghgghghgghghgghghgghghh",
  "hghgghghgghgjgghghgghgjgghghghgh",
  "hgghghgghghgghghgghghgghghgghghh",
  "hghgghghgghghgghghgghghgghghghgh",
  "hgghghgghghgghghgghghgghghgghghh",
  "hghgghghgghgjgghghgghgjgghghghgh",
  "hgghghgghghgghghgghghgghghgghghh",
  "hyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyh",
  "hghgghghgghghgghghgghghgghghghgh",
  "hgghghgghghgghghgghghgghghgghghh",
  "hghgghghgghgjgghghgghgjgghghghgh",
];

/* Garage wall: breeze block with a tool-board strip. */
const TEX_GARAGE_WALL = [
  "ffffffffffffffffffffffffffffffff",
  "gggggggigggggggigggggggigggggggi",
  "gggggggigggggggigggggggigggggggi",
  "gggggggigggggggigggggggigggggggi",
  "ffffffffffffffffffffffffffffffff",
  "gggigggggggigggggggigggggggigggg",
  "gggigggggggigggggggigggggggigggg",
  "gggigggggggigggggggigggggggigggg",
];

/* ============================================================
   BAKING
   Every tile becomes a 1:1 canvas once at boot.  They are tiny
   (32x32 at most) so the whole set costs a few kilobytes, and
   baking means a fill is one pattern instead of a thousand
   fillRects.
   ============================================================ */
const TEX_MAPS = {
  asphalt: TEX_ASPHALT, asphaltWorn: TEX_ASPHALT_WORN, street: TEX_STREET,
  grass: TEX_GRASS, concrete: TEX_CONCRETE, sand: TEX_SAND,
  seats: TEX_SEATS, safer: TEX_SAFER, concwall: TEX_CONCWALL,
  kerb: TEX_KERB, fence: TEX_FENCE,
  garageFloor: TEX_GARAGE_FLOOR, garageWall: TEX_GARAGE_WALL,
  facade: TEX_FACADE, pavement: TEX_PAVEMENT,
};
const TEX = {};

function bakeTileCanvas(map, sub) {
  const w = map[0].length, h = map.length;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  for (let r = 0; r < h; r++) {
    const row = map[r];
    for (let col = 0; col < w; col++) {
      const ch = row[col];
      if (!ch || ch === ".") continue;
      g.fillStyle = (sub && sub[ch]) || GP[ch] || "#f0f";
      g.fillRect(col, r, 1, 1);
    }
  }
  return c;
}

function buildTextures() {
  for (const k in TEX_MAPS) TEX[k] = bakeTileCanvas(TEX_MAPS[k]);
}

/* Recoloured variants — one authored tile serves every track by
   swapping a few palette entries rather than redrawing it. */
const TEX_VARIANTS = new Map();
function texVariant(key, subKey, sub) {
  const id = key + "|" + subKey;
  let c = TEX_VARIANTS.get(id);
  if (!c) { c = bakeTileCanvas(TEX_MAPS[key], sub); TEX_VARIANTS.set(id, c); }
  return c;
}

/* ============================================================
   WORLD-LOCKED PATTERNS
   The camera rotates with the car.  A pattern left in screen
   space would slide under the field; these carry the same
   transform the geometry does, so the aggregate stays put on the
   piece of track it belongs to.
   ============================================================ */
let PAT_CACHE = new Map();
let PAT_STAMP = "";

/* `texel` is how many CSS pixels one authored texel covers.  Keeping
   it constant rather than scaling with zoom is what makes the grain
   read as pixel art instead of as a blurry photo. */
function worldPattern(key, texel, canvasOverride) {
  const src = canvasOverride || TEX[key];
  if (!src || !VIEW) return null;
  const stamp = key + "|" + texel + "|" + VIEW.rot.toFixed(4) + "|" +
    VIEW.cx.toFixed(2) + "|" + VIEW.cy.toFixed(2) + "|" + VIEW.sc.toFixed(3) +
    "|" + CW + "|" + CH + (canvasOverride ? "|v" : "");
  if (PAT_STAMP !== stamp) { PAT_CACHE = new Map(); PAT_STAMP = stamp; }
  let p = PAT_CACHE.get(key + texel + (canvasOverride ? "v" : ""));
  if (p) return p;
  p = cx.createPattern(src, "repeat");
  if (!p) return null;
  /* world units covered by one texel, chosen so a texel lands on a
     constant number of screen pixels whatever the track's size */
  const wpt = texel / VIEW.sc;
  try {
    const m = new DOMMatrix()
      .translateSelf(CW * ANCH_X, CH * ANCH_Y)
      .scaleSelf(VIEW.sc, VIEW.sc * SQ)
      .rotateSelf(VIEW.rot * 180 / Math.PI)
      .translateSelf(-VIEW.cx, -VIEW.cy)
      .scaleSelf(wpt, wpt);
    p.setTransform(m);
  } catch (e) { /* older engines: an unrotated tile still beats a flat fill */ }
  PAT_CACHE.set(key + texel + (canvasOverride ? "v" : ""), p);
  return p;
}

/* Fill the current path with an authored ground texture.  Falls back
   to a flat colour if patterns with transforms are unavailable. */
function fillWorldTex(key, texel, fallback, canvasOverride) {
  const p = worldPattern(key, texel, canvasOverride);
  const sm = cx.imageSmoothingEnabled;
  cx.imageSmoothingEnabled = false;
  cx.fillStyle = p || fallback;
  cx.fill();
  cx.imageSmoothingEnabled = sm;
}

/* Screen-space fill for the shop, which has no chase camera to lock to.
   Same authored tiles, just laid straight onto the canvas. */
function fillFlatTex(key, texel, fallback) {
  const src = TEX[key];
  const sm = cx.imageSmoothingEnabled;
  cx.imageSmoothingEnabled = false;
  let p = src ? cx.createPattern(src, "repeat") : null;
  if (p) { try { p.setTransform(new DOMMatrix().scaleSelf(texel, texel)); } catch (e) { } }
  cx.fillStyle = p || fallback;
  cx.fill();
  cx.imageSmoothingEnabled = sm;
}

/* ============================================================
   QUAD-MAPPED TEXTURES
   For anything that is not on the ground plane — a raked seating
   deck, a barrier face — the texture is mapped onto the quad's own
   axes, so seat rows follow the rake and panel seams follow the
   curve of the wall.
   ============================================================ */
function fillQuadTex(A, B, D, key, nu, nv, alpha) {
  const src = TEX[key];
  if (!src) return;
  const tw = src.width * nu, th = src.height * nv;
  const p = cx.createPattern(src, "repeat");
  if (!p) return;
  try {
    p.setTransform(new DOMMatrix([
      (B.x - A.x) / tw, (B.y - A.y) / tw,
      (D.x - A.x) / th, (D.y - A.y) / th,
      A.x, A.y,
    ]));
  } catch (e) { return; }
  const C = { x: B.x + D.x - A.x, y: B.y + D.y - A.y };
  const sm = cx.imageSmoothingEnabled;
  cx.imageSmoothingEnabled = false;
  if (alpha != null) cx.globalAlpha = alpha;
  cx.fillStyle = p;
  cx.beginPath();
  cx.moveTo(A.x, A.y); cx.lineTo(B.x, B.y); cx.lineTo(C.x, C.y); cx.lineTo(D.x, D.y);
  cx.closePath(); cx.fill();
  if (alpha != null) cx.globalAlpha = 1;
  cx.imageSmoothingEnabled = sm;
}

/* A texture laid along a run of points — used for kerbs, painted
   lines and barrier faces, which all follow the track rather than
   sitting on a flat quad. */
function stripTex(pts, width, key, texel, rise) {
  const src = TEX[key];
  if (!src || pts.length < 2) return;
  const sm = cx.imageSmoothingEnabled;
  cx.imageSmoothingEnabled = false;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) continue;
    const ux = dx / len, uy = dy / len;
    const p = cx.createPattern(src, "repeat");
    if (!p) break;
    const sx = texel, sy = texel;
    try {
      p.setTransform(new DOMMatrix([
        ux * sx, uy * sx, -uy * sy, ux * sy,
        a.x + uy * (rise || 0), a.y - ux * (rise || 0),
      ]));
    } catch (e) { break; }
    cx.fillStyle = p;
    cx.beginPath();
    const hw = width;
    cx.moveTo(a.x + uy * (rise || 0), a.y - ux * (rise || 0));
    cx.lineTo(b.x + uy * (rise || 0), b.y - ux * (rise || 0));
    cx.lineTo(b.x + uy * ((rise || 0) + hw), b.y - ux * ((rise || 0) + hw));
    cx.lineTo(a.x + uy * ((rise || 0) + hw), a.y - ux * ((rise || 0) + hw));
    cx.closePath(); cx.fill();
  }
  cx.imageSmoothingEnabled = sm;
}

/* Which asphalt a track runs on.  Authored variety rather than a
   tint: an old bullring and a new intermediate should not be the
   same grey. */
function surfaceTex(track) {
  if (!track) return "asphalt";
  if (track.surf === "street") return "street";
  if (track.worn) return "asphaltWorn";
  return "asphalt";
}
