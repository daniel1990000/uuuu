/* ============================================================
   TRACK GEOMETRY
   Real racetrack centerlines built from straights and banked
   arcs, the way an actual oval is surveyed.  Travel is
   counter-clockwise (NASCAR), so left turns are positive.

   Authors write the arcs they want; straights marked f:1 are
   "flex" and their lengths are solved so the loop closes
   exactly.  That lets tracks be asymmetric (egg ovals, tri-
   ovals, road courses) without hand-solving any trigonometry.
   ============================================================ */
"use strict";

/* {k:"s", l:length, b:bank, f:flex?}   straight
   {k:"a", r:radius, d:degrees, b:bank} arc (+ left / - right)  */
const GEOS = {
  /* Martinsville: flat half-mile paperclip, long straights, tight ends */
  paperclip: [
    {k:"s", l:270, b:0, f:1},
    {k:"a", r:74,  d:180, b:11},
    {k:"s", l:270, b:0, f:1},
    {k:"a", r:74,  d:180, b:11},
  ],
  /* Bristol: concrete bowl, tiny straights, enormous banking */
  bowl: [
    {k:"s", l:110, b:8, f:1},
    {k:"a", r:112, d:180, b:30},
    {k:"s", l:110, b:8, f:1},
    {k:"a", r:112, d:180, b:30},
  ],
  /* Flat one-mile oval */
  oval: [
    {k:"s", l:310, b:2, f:1},
    {k:"a", r:116, d:180, b:13},
    {k:"s", l:310, b:2, f:1},
    {k:"a", r:116, d:180, b:13},
  ],
  /* Charlotte / Texas: quad-oval — frontstretch bulges out past
     the start/finish line, four distinct bends on that side.     */
  quadoval: [
    {k:"a", r:340, d:-13, b:5},        // off T4, drift out to the right
    {k:"s", l:120, b:4},
    {k:"a", r:250, d:13,  b:6},        // start/finish apex, back left
    {k:"a", r:250, d:13,  b:6},
    {k:"s", l:120, b:4},               // (front pair stays symmetric)
    {k:"a", r:340, d:-13, b:5},
    {k:"a", r:128, d:180, b:24},       // T1-2
    {k:"s", l:330, b:2, f:1},          // backstretch
    {k:"a", r:128, d:180, b:24},       // T3-4
  ],
  /* Daytona / Talladega: 2.5-mile tri-oval, 31° banking */
  trioval: [
    {k:"a", r:420, d:-18, b:6},
    {k:"s", l:190, b:5},
    {k:"a", r:300, d:18,  b:9},        // the tri-oval dogleg
    {k:"a", r:300, d:18,  b:9},
    {k:"s", l:190, b:5},               // (front pair stays symmetric)
    {k:"a", r:420, d:-18, b:6},
    {k:"a", r:170, d:180, b:31},       // T1-2
    {k:"s", l:430, b:3, f:1},          // backstretch
    {k:"a", r:170, d:180, b:31},       // T3-4
  ],
  /* Michigan: D-shaped oval, one long sweeping front bend */
  doval: [
    {k:"a", r:560, d:-11, b:4},
    {k:"s", l:150, b:3},
    {k:"a", r:330, d:11,  b:7},        // the gentle bow of the "D"
    {k:"a", r:330, d:11,  b:7},
    {k:"s", l:150, b:3},
    {k:"a", r:560, d:-11, b:4},
    {k:"a", r:186, d:180, b:18},       // T1-2
    {k:"s", l:400, b:2, f:1},          // backstretch
    {k:"a", r:186, d:180, b:18},       // T3-4
  ],
  /* Darlington: egg-shaped — one end far tighter than the other */
  eggoval: [
    {k:"s", l:240, b:3, f:1},
    {k:"a", r:104, d:172, b:26},       // the narrow end
    {k:"s", l:210, b:3, f:1},
    {k:"a", r:150, d:188, b:19},       // the wide end
  ],
  /* Pocono: three corners, three radii, three straight lengths */
  triangle: [
    {k:"s", l:390, b:2, f:1},
    {k:"a", r:92,  d:120, b:14},
    {k:"s", l:300, b:2, f:1},
    {k:"a", r:124, d:120, b:8},
    {k:"s", l:250, b:2, f:1},
    {k:"a", r:74,  d:120, b:6},
  ],
  /* Dirt oval: wide and sweeping, low banking */
  dirtoval: [
    {k:"s", l:180, b:2, f:1},
    {k:"a", r:100, d:180, b:15},
    {k:"s", l:180, b:2, f:1},
    {k:"a", r:100, d:180, b:15},
  ],
  /* Infield road course: the oval frontstretch, a dive into the infield
     for a technical loop, then back out through the banking.  The
     infield section nets zero, so the two oval ends still supply the
     whole +360 — which is exactly how a real one is laid out. */
  roadoval: [
    {k:"s", l:250, b:2, f:1},          // frontstretch, oval speeds
    {k:"a", r:70,  d:90,  b:4},        // dive left off the banking
    {k:"s", l:110, b:0},
    {k:"a", r:44,  d:-95, b:2},
    {k:"s", l:95,  b:0},
    {k:"a", r:38,  d:100, b:2},
    {k:"s", l:140, b:0, f:1},
    {k:"a", r:50,  d:-85, b:2},
    {k:"s", l:80,  b:0},
    {k:"a", r:42,  d:95,  b:3},
    {k:"s", l:120, b:0},
    {k:"a", r:58,  d:-105,b:3},        // back out onto the banking
    {k:"s", l:160, b:2, f:1},
    {k:"a", r:118, d:180, b:20},       // oval end
    {k:"s", l:200, b:2, f:1},
    {k:"a", r:118, d:180, b:20},       // oval end
  ],
  /* Park road course: a long opening sweeper, esses, a hairpin and a
     fast right that never quite lets go. */
  roadlong: [
    {k:"s", l:280, b:0, f:1},
    {k:"a", r:56,  d:155, b:3},        // the long turn one
    {k:"s", l:100, b:0},
    {k:"a", r:40,  d:-70, b:2},
    {k:"a", r:40,  d:70,  b:2},        // esses
    {k:"s", l:130, b:0, f:1},
    {k:"a", r:34,  d:160, b:3},        // hairpin
    {k:"s", l:170, b:0},
    {k:"a", r:90,  d:-120,b:4},        // the long right
    {k:"s", l:110, b:0},
    {k:"a", r:48,  d:130, b:3},
    {k:"s", l:140, b:0, f:1},
    {k:"a", r:44,  d:-85, b:2},
    {k:"a", r:52,  d:120, b:3},
  ],
  /* Street circuit: public roads closed for the weekend.  Ninety-degree
     block corners, no run-off anywhere, concrete on both sides. */
  street: [
    {k:"s", l:300, b:0, f:1},          // the long shoreline straight
    {k:"a", r:28,  d:90,  b:0},
    {k:"s", l:150, b:0},
    {k:"a", r:26,  d:90,  b:0},
    {k:"s", l:120, b:0, f:1},
    {k:"a", r:22,  d:-90, b:0},        // a jog around one block
    {k:"s", l:80,  b:0},
    {k:"a", r:22,  d:90,  b:0},
    {k:"s", l:200, b:0, f:1},
    {k:"a", r:30,  d:90,  b:0},
    {k:"s", l:170, b:0},
    {k:"a", r:24,  d:-90, b:0},
    {k:"s", l:90,  b:0},
    {k:"a", r:24,  d:90,  b:0},
    {k:"s", l:130, b:0, f:1},
    {k:"a", r:26,  d:90,  b:0},
  ],
  /* Tighter street circuit: shorter blocks and a hairpin round a
     monument, so it is all first and second gear. */
  streettight: [
    {k:"s", l:220, b:0, f:1},
    {k:"a", r:24,  d:90, b:0},
    {k:"s", l:110, b:0},
    {k:"a", r:20,  d:90, b:0},
    {k:"s", l:140, b:0, f:1},
    {k:"a", r:18,  d:-90,b:0},
    {k:"s", l:70,  b:0},
    {k:"a", r:18,  d:-90,b:0},
    {k:"s", l:100, b:0},
    {k:"a", r:16,  d:180,b:0},         // the hairpin round the monument
    {k:"s", l:120, b:0, f:1},
    {k:"a", r:22,  d:90, b:0},
    {k:"s", l:160, b:0},
    {k:"a", r:26,  d:90, b:0},
  ],
  /* Road course: esses, a hairpin, a long back straight.
     Rights are negative; the whole thing still nets +360.      */
  road: [
    {k:"s", l:300, b:0, f:1},
    {k:"a", r:62,  d:110, b:4},        // T1, hard left
    {k:"s", l:70,  b:0},
    {k:"a", r:54,  d:-80, b:3},
    {k:"a", r:54,  d:80,  b:3},        // esses
    {k:"s", l:150, b:0, f:1},
    {k:"a", r:40,  d:150, b:2},        // hairpin
    {k:"s", l:210, b:0},
    {k:"a", r:72,  d:-70, b:3},
    {k:"s", l:120, b:0},
    {k:"a", r:66,  d:120, b:4},
    {k:"s", l:90,  b:0},
    {k:"a", r:60,  d:-60, b:3},
    {k:"a", r:68,  d:110, b:4},
  ],
};

const RAD = Math.PI / 180;

/* Walk the segments once, returning the closing error and the
   heading each flex straight runs at.                          */
function traverse(segs, flexLen) {
  let x = 0, y = 0, h = 0, fi = 0;
  const flexDirs = [];
  for (const seg of segs) {
    if (seg.k === "s") {
      const l = seg.f ? flexLen[fi] : seg.l;
      if (seg.f) { flexDirs.push({ c: Math.cos(h), s: Math.sin(h) }); fi++; }
      x += Math.cos(h) * l; y += Math.sin(h) * l;
    } else {
      const total = seg.d * RAD;
      /* exact arc displacement in local frame, then rotate by h */
      const dx = seg.r * Math.sin(Math.abs(total));
      const dy = seg.r * (1 - Math.cos(total)) * Math.sign(total || 1);
      x += Math.cos(h) * dx - Math.sin(h) * dy;
      y += Math.sin(h) * dx + Math.cos(h) * dy;
      h += total;
    }
  }
  return { x, y, h, flexDirs };
}

/* Solve the flex straights so the loop closes.  Minimum-norm least
   squares: with N unknown lengths and 2 constraints the correction is
   spread across every flex straight instead of blowing up one of them. */
function solveClosure(segs) {
  const flexIdx = [];
  segs.forEach((sg, i) => { if (sg.k === "s" && sg.f) flexIdx.push(i); });
  const len = flexIdx.map(i => segs[i].l);
  if (!flexIdx.length) return len;
  for (let it = 0; it < 40; it++) {
    const t = traverse(segs, len);
    const ex = -t.x, ey = -t.y;
    if (Math.hypot(ex, ey) < 1e-6) break;
    const d = t.flexDirs;
    let cc = 0, cs = 0, ss = 0;
    for (const v of d) { cc += v.c * v.c; cs += v.c * v.s; ss += v.s * v.s; }
    const lam = 1e-6;
    const det = (cc + lam) * (ss + lam) - cs * cs;
    if (Math.abs(det) < 1e-12) break;
    const y0 = ((ss + lam) * ex - cs * ey) / det;
    const y1 = ((cc + lam) * ey - cs * ex) / det;
    let moved = false;
    for (let i = 0; i < len.length; i++) {
      const dl = d[i].c * y0 + d[i].s * y1;
      const nl = Math.max(30, len[i] + dl);
      if (nl !== len[i]) moved = true;
      len[i] = nl;
    }
    if (!moved) break;
  }
  return len;
}

/* Build the dense polyline.  Each point: {x,y,h,b,c,s}. */
function buildTrack(geoName) {
  const segs = GEOS[geoName] || GEOS.oval;
  const flexLen = solveClosure(segs);
  const pts = [];
  let x = 0, y = 0, h = 0, s = 0, fi = 0;
  const STEP = 5;
  for (const seg of segs) {
    if (seg.k === "s") {
      const l = seg.f ? flexLen[fi++] : seg.l;
      const n = Math.max(1, Math.round(l / STEP)), dl = l / n;
      for (let i = 0; i < n; i++) {
        x += Math.cos(h) * dl; y += Math.sin(h) * dl; s += dl;
        pts.push({ x, y, h, b: seg.b || 0, c: 0, cs: 0, s });
      }
    } else {
      const total = seg.d * RAD, arcLen = Math.abs(total) * seg.r;
      const n = Math.max(2, Math.round(arcLen / STEP));
      const dh = total / n, dl = arcLen / n;
      const curv = Math.min(1, 100 / seg.r);
      for (let i = 0; i < n; i++) {
        h += dh;
        x += Math.cos(h) * dl; y += Math.sin(h) * dl; s += dl;
        pts.push({ x, y, h, b: seg.b || 0, c: curv, cs: Math.sign(total) * curv, s });
      }
    }
  }
  /* Any residual (a shape the flex straights physically cannot close)
     is spread smoothly along the lap so the loop is watertight. */
  const rx = pts[pts.length - 1].x, ry = pts[pts.length - 1].y;
  if (Math.hypot(rx, ry) > 0.01) {
    for (const p of pts) { const f = p.s / s; p.x -= rx * f; p.y -= ry * f; }
  }
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const p of pts) {
    if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
    if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
  }
  /* start/finish sits on the longest straight (the frontstretch) */
  let best = 0, bestRun = -1, run = 0, runStart = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].c === 0) { if (run === 0) runStart = i; run++; }
    else { if (run > bestRun) { bestRun = run; best = runStart + Math.floor(run * 0.65); } run = 0; }
  }
  if (run > bestRun) best = runStart + Math.floor(run * 0.65);
  return { pts, len: s, bounds: { minx, maxx, miny, maxy },
           sf: best % pts.length, sfDist: pts[best % pts.length].s, geo: geoName };
}

/* Interpolated sample at distance `dist` (wraps).  Binary search on
   the strictly-increasing s field.                                */
function sampleTrack(tk, dist) {
  const pts = tk.pts, n = pts.length;
  let d = dist % tk.len; if (d < 0) d += tk.len;
  let lo = 0, hi = n - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (pts[m].s < d) lo = m + 1; else hi = m; }
  const b = pts[lo], a = pts[(lo - 1 + n) % n];
  const as = lo === 0 ? 0 : a.s;
  const ds = b.s - as;
  const t = ds > 1e-9 ? Math.max(0, Math.min(1, (d - as) / ds)) : 0;
  const ax = lo === 0 ? 0 : a.x, ay = lo === 0 ? 0 : a.y;
  return { x: ax + (b.x - ax) * t, y: ay + (b.y - ay) * t,
           h: b.h, b: (lo === 0 ? b.b : a.b + (b.b - a.b) * t),
           c: (lo === 0 ? b.c : a.c + (b.c - a.c) * t),
           /* signed: positive bends left, negative bends right.  Kerbs need
              to know which side the apex is on; the AI only needs how hard. */
           cs: (lo === 0 ? b.cs : a.cs + (b.cs - a.cs) * t) };
}

/* Offset sideways; positive = toward the infield (left of travel). */
function offsetPoint(p, off) {
  return { x: p.x + Math.cos(p.h + Math.PI / 2) * off,
           y: p.y + Math.sin(p.h + Math.PI / 2) * off };
}

/* Mean curvature over the next `ahead` units — drives AI lift-off
   and tyre wear, so tight tracks chew tyres faster.               */
function curvatureAhead(tk, dist, ahead) {
  let sum = 0, n = 0;
  for (let d = 0; d < ahead; d += 20) { sum += sampleTrack(tk, dist + d).c; n++; }
  return n ? sum / n : 0;
}
