/* ============================================================
   RACE ENGINE
   Qualifying, green-flag running, drafting, tyre/fuel wear, pit
   strategy, cautions, stage points, and championship seasons.
   ============================================================ */
"use strict";

/* ---------- race strategy ----------
   Two decisions before the flag and one during it.  Enough to matter,
   few enough to make on a phone without a manual.                     */
const TYRES = {
  soft:   { n: "Soft",   grip: 1.10, wear: 1.50, desc: "Clearly quickest, but they go off early — expect an extra stop." },
  medium: { n: "Medium", grip: 1.00, wear: 1.00, desc: "The safe choice." },
  hard:   { n: "Hard",   grip: 0.962, wear: 0.60, desc: "A shade slower, but they may save you a stop." },
};
/* The short-fill option is gone.  It only ever won if the race rewarded a
   sprint stint, and nothing here does, so it was a choice with a right
   answer — which is not a choice.  Everyone starts full; what you do with
   the fuel is the decision now, and that is what the modes are for. */

/* ---------- driving modes ----------
   The live decision, changeable any lap.  Each is genuinely better at
   something and worse at something else, so there is no default answer. */
const MODES = {
  push:     { n: "Push",     ico: "\u25B2", pace: 1.045, wear: 1.55, fuel: 1.30, risk: 1.90,
              desc: "Everything you have. Tyres and fuel go quickly and mistakes cost races." },
  normal:   { n: "Normal",   ico: "\u25CF", pace: 1.000, wear: 1.00, fuel: 1.00, risk: 1.00,
              desc: "Race pace. Nothing gained, nothing thrown away." },
  conserve: { n: "Conserve", ico: "\u25BC", pace: 0.958, wear: 0.62, fuel: 0.72, risk: 0.45,
              desc: "Short-shift and roll the corners. Saves a stop, costs track position." },
};
const MODE_ORDER = ["push", "normal", "conserve"];

let STRAT = { tyre: "medium", mode: "normal", aura: "none" };

let R = null;          // live race
let SEASON = null;     // live championship

const MPH = 2.35;      // world-units/sec → displayed mph

/* ---------- field construction ---------- */
function makeEntry(name, team, perf, col, num, opts) {
  return Object.assign({
    name, team, perf, col, num,
    paintIdx: Math.max(0, TEAMC.indexOf(col)), model: "stock",
    isP: false, s: 0, lap: 0, v: 0, grid: 0, lane: 0, laneT: 0,
    tyreLife: 100, fuel: 100, dur: 9999, maxdur: 9999,
    pit: 0, stops: 0, pitMul: 1, fuelMul: 1, draftMul: 1, brake: 0,
    done: false, dnf: false, fin: 0, stagePts: 0, ledLaps: 0, best: 0,
    pace: 0, defend: 0, sbs: 0,
    tyre: "medium", mode: "normal", pitArmed: 0, pitKind: "both",
    /* crash state: heat is how close this car is to a mistake, spin is the
       seconds it spends gathering one up, damage slows it for good */
    heat: 0, spin: 0, damage: 0, wrecked: 0, nudge: 0,
  }, opts || {});
}

function buildField(track, season) {
  const t = G.teams[G.curTeam];
  const car = G.cars[t.car], drv = G.drivers[t.driver];
  const cs = carStats(car);
  const perf = carPerf(car, track.surf) + driverPerf(drv, track.surf);
  const field = [makeEntry(drv.name, "YOUR TEAM", perf, TEAMC[car.paint % 8], car.num, {
    isP: true, dur: car.dur, maxdur: cs.maxdur,
    tyre: STRAT.tyre, mode: STRAT.mode || "normal",
    paintIdx: car.paint % 8, model: CHASSIS_MODEL[car.id] || "stock",
    pitMul: Math.max(0.45, 1 - cs.pit / 100 - shopTech() / 900),
    fuelMul: 1 + cs.fuel / 100, draftMul: 1 + cs.drv / 200,
    brake: cs.brake, anl: teamAnalysis(G.curTeam), adRate: cs.ad + teamAppeal(G.curTeam) * 0.4,
  })];
  /* Sixteen cars on track.  A six-car field never felt like a race: there
     was no traffic to lap, no pack to get shuffled in, and a caution
     bunched nobody up. */
  const n = season ? season.def.rivals : 15;
  const cols = TEAMC.slice();
  /* Rival strength tracks the player so racing stays competitive, but the
     tier still matters: club events stay winnable, the Cup stays hard. */
  const tierFloor = 24 + track.fee * 1.9;
  const band = season ? { rookie: 0.86, national: 0.95, cup: 1.04 }[season.def.id] || 0.95
                      : clamp(0.80 + track.fee / 190, 0.80, 1.00);
  const scaled = Math.max(tierFloor, perf * band);
  /* no duplicate drivers, teams or car numbers in a field */
  const pool = RIVAL_DRIVERS.slice(), tpool = RIVAL_TEAMS.slice();
  const nums = [car.num];
  for (let i = 0; i < n; i++) {
    let str, name, team, num;
    if (season) {
      str = scaled * season.rivals[i].rel * (1 + season.round * 0.008);
      name = season.rivals[i].name; team = season.rivals[i].team; num = season.rivals[i].num;
    } else {
      /* A real grid is not fifteen equal cars.  Everyone used to sit within
         a few percent of the player, which meant a sixteen-car field was
         sixteen cars all capable of winning — and, more to the point, that
         there was never anybody slow enough to lap.  Spreading it gives a
         couple of genuine front-runners, a midfield, and backmarkers you
         come up behind and have to deal with. */
      str = scaled * (1.06 - (i / Math.max(1, n - 1)) * 0.34) * rnd(0.97, 1.03);
      name = pool.splice(ri(0, pool.length - 1), 1)[0] || "Privateer " + i;
      team = tpool.splice(ri(0, tpool.length - 1), 1)[0] || "Independent";
      do { num = ri(2, 99); } while (nums.includes(num));
    }
    nums.push(num);
    /* step through the palette by a stride co-prime with its length so
       neighbours on the grid never share a colour */
    const rc = cols[(i * 3 + 1) % cols.length];
    field.push(makeEntry(name, team, str, rc, num,
      { pitMul: rnd(0.85, 1.15), fuelMul: rnd(0.95, 1.1), draftMul: rnd(0.95, 1.08),
        /* rivals run a neutral plan: their difficulty already comes from the
           strength band, so letting them stack compound bonuses on top would
           just tax the player for a choice the AI never actually makes */
        tyre: "medium", mode: "normal",
        paintIdx: Math.max(0, TEAMC.indexOf(rc)),
        model: ["stock", "stock", "aero", "stock", "truck", "mod"][i % 6] }));
  }
  return field;
}

/* ---------- start a race ---------- */
function startRace(track, season, auraTier) {
  const tk = buildTrack(track.geo);
  const field = buildField(track, season);

  /* qualifying: one clean lap, no draft */
  field.forEach(c => { c.qt = 1000 / (c.perf * rnd(0.94, 1.06)); });
  const grid = field.slice().sort((a, b) => a.qt - b.qt);
  grid.forEach((c, i) => {
    c.grid = i;
    c.lane = (i % 2) ? 0.68 : 0.28;          // inside / outside rows
    c.laneT = c.lane;
    c.s = tk.sfDist - 26 - Math.floor(i / 2) * 15;   // two-by-two, as they roll off
    c.lap = 0;
  });
  if (typeof resetRaceView === "function") resetRaceView();
  const pQual = grid.findIndex(c => c.isP) + 1;

  R = {
    track, tk, field, season, phase: "grid", t: 0, timer: 2.6,
    lap: 1, laps: track.laps, yellow: 0, yellowT: 0, cautions: 0,
    auraTier, auraLeft: auraTier ? 1 : 0, auraT: 0,
    stageAt: [Math.round(track.laps / 3), Math.round(track.laps * 2 / 3)], stage: 0,
    rp: 0, ad: 0, lapCount: 0, msg: "", msgT: 0, pQual,
    leader: grid[0], camS: grid[0].s, finish: [], winT: 0,
  };
  /* Bake the liveries this race actually needs, now, while the grid
     countdown is on screen.  Baking on demand keeps boot cheap, but left
     alone it means a stutter the first time each new car comes into view;
     doing it here pays that cost once, where there is nothing to stutter. */
  if (typeof atlasFor === "function") {
    for (const c of field) { try { atlasFor(c.model, c.paintIdx); } catch (e) { break; } }
  }
  banner("QUALIFIED " + ord(pQual), 2.2);
  sfx("ok");
  return R;
}
function banner(text, secs) { if (R) { R.msg = text; R.msgT = secs; } }

/* ---------- the racing line ----------

   The old engine gave every track one groove and held it for the whole
   lap, which is why the field traced a ring: nobody ever used the width
   of the road.  A real lap is out-in-out.  You run up by the wall down
   the straight, turn in, take the apex as low as the car will go, and
   let it drift back out on exit.

   Curvature is what tells us which of those we are in.  What is under
   the car says whether we are cornering; what is coming says whether to
   start setting up; what we just left says we are still unwinding. */
function racingLine(tk, d, lanes) {
  const here = sampleTrack(tk, d).c;
  const soon = curvatureAhead(tk, d, 85);
  const past = curvatureAhead(tk, d - 85, 85);
  const apex = lanes.lo + 0.06;              // as low as the car will go
  const wall = lanes.hi - 0.08;              // up against the fence

  if (here > 0.18) {
    /* in the corner: the tighter it is, the more it is worth being at the
       apex, and a gentle sweeper is barely worth leaving the middle for */
    const t = clamp((here - 0.18) / 0.45, 0, 1);
    return lanes.line + (apex - lanes.line) * t;
  }
  if (soon > 0.22) {
    /* entry: swing out to open the corner up, more so the tighter it is */
    const t = clamp((soon - 0.22) / 0.45, 0, 1);
    return lanes.line + (wall - lanes.line) * t;
  }
  if (past > 0.22) {
    /* exit: still unwinding, so let it run out toward the wall */
    const t = clamp((past - 0.22) / 0.45, 0, 1);
    return lanes.line + (wall - lanes.line) * t * 0.72;
  }
  return lanes.line;
}

/* How much speed a line costs.  Away from the groove the surface is
   dirtier and the corner is longer, which is what makes the low line
   worth having and an outside pass a real commitment. */
function lineCost(tk, d, lane, lanes) {
  const here = sampleTrack(tk, d).c;
  if (here < 0.14) return 1;                 // on a straight, anywhere is fine
  const ideal = racingLine(tk, d, lanes);
  const off = Math.abs(lane - ideal);
  return 1 - Math.min(0.055, off * 0.085) * clamp(here / 0.5, 0.4, 1.4);
}

/* How many lanes a surface supports, and where the groove sits. */
function raceLanes(surf) {
  if (surf === "ss")   return { lo: 0.10, hi: 0.90, line: 0.34 };   // three wide
  if (surf === "mid")  return { lo: 0.14, hi: 0.86, line: 0.34 };
  if (surf === "road") return { lo: 0.18, hi: 0.82, line: 0.40 };
  /* A street circuit is a closed public road: barely wider than two cars,
     with a wall where the run-off would be.  Passing means the braking
     zones or nothing, so the usable band is the narrowest in the game. */
  if (surf === "street") return { lo: 0.26, hi: 0.74, line: 0.44 };
  return { lo: 0.20, hi: 0.80, line: 0.32 };                        // short track, two wide
}
/* signed gap to another car along the lap, in world units */
function gapTo(a, b, tk) {
  let g = (b.lap * tk.len + b.s) - (a.lap * tk.len + a.s);
  return g;
}
function carAhead(c, tk) {
  let best = null;
  for (const o of R.field) {
    if (o === c || o.done || o.dnf || o.pit > 0) continue;
    const g = gapTo(c, o, tk);
    if (g > 0 && g < 30 && Math.abs(o.lane - c.lane) < 0.22 && (!best || g < best.gap))
      best = { car: o, gap: g };
  }
  return best;
}
function carBehind(c, tk) {
  let best = null;
  for (const o of R.field) {
    if (o === c || o.done || o.dnf || o.pit > 0) continue;
    const g = -gapTo(c, o, tk);
    if (g > 0 && g < 22 && Math.abs(o.lane - c.lane) < 0.26 && (!best || g < best.gap))
      best = { car: o, gap: g };
  }
  return best;
}
/* a car overlapping us door-to-door */
function alongside(c, tk) {
  for (const o of R.field) {
    if (o === c || o.done || o.dnf || o.pit > 0) continue;
    const g = Math.abs(gapTo(c, o, tk));
    if (g < 7 && Math.abs(o.lane - c.lane) < 0.30) return o;
  }
  return null;
}
/* is a lane clear enough to move into? */
function laneFree(c, lane, tk) {
  if (lane <= 0.02 || lane >= 0.98) return false;
  for (const o of R.field) {
    if (o === c || o.done || o.dnf || o.pit > 0) continue;
    const g = gapTo(c, o, tk);
    if (g > -8 && g < 16 && Math.abs(o.lane - lane) < 0.20) return false;
  }
  return true;
}

/* ---------- per-tick simulation ---------- */
function raceTick(dt) {
  if (!R || R.phase === "done") return;
  R.msgT -= dt;
  const tk = R.tk, track = R.track;

  if (R.phase === "grid") {
    R.timer -= dt;
    if (R.timer <= 0) { R.phase = "green"; banner("GREEN FLAG!", 1.8); sfx("go"); }
    return;
  }
  R.t += dt;
  if (R.auraT > 0) R.auraT -= dt;
  if (R.yellow) { R.yellowT -= dt; if (R.yellowT <= 0) { R.yellow = 0; banner("BACK TO GREEN", 1.6); sfx("go"); } }

  const running = R.field.filter(c => !c.done && !c.dnf);
  const order = running.slice().sort((a, b) => (b.lap * tk.len + b.s) - (a.lap * tk.len + a.s));
  if (order.length) { R.leader = order[0]; if (order[0].isP || !R.field[0].done) R.camS = R.field[0].s; }

  for (let i = 0; i < order.length; i++) {
    const c = order[i];
    if (c.pit > 0) {                                  // serving a stop
      c.pit -= dt; c.v = 0;
      if (c.pit <= 0) {
        if (c.pitKind !== "fuel") c.tyreLife = 100;
        if (c.pitKind !== "tyres") c.fuel = 100;
        c.stops++;
      }
      continue;
    }
    /* a car gathering up a slide is a passenger until it is done */
    if (c.spin > 0) {
      c.spin -= dt;
      c.v = Math.max(0, c.v - 26 * dt);
      c.s += c.v * dt;
      c.lane = clamp(c.lane + c.nudge * dt, 0.04, 0.96);
      if (c.spin <= 0) c.nudge = 0;
      continue;
    }

    const sample = sampleTrack(tk, c.s);
    const curv = sample.c;
    const bank = sample.b;
    const mode = MODES[c.mode] || MODES.normal;

    /* grip: tyres, corner tightness, banking helps, surface matters */
    const tset = TYRES[c.tyre] || TYRES.medium;
    const grip = (0.80 + 0.20 * (c.tyreLife / 100)) * (1 + bank / 220) * tset.grip;
    /* cornering cost: tight corners scrub speed unless handling is high */
    const cornerCost = curv * (1.0 - Math.min(0.55, c.perf / 340));
    let target = (26 + c.perf * 0.62) * grip * (1 - cornerCost * 0.42);
    target *= mode.pace;
    if (c.damage) target *= 1 - Math.min(0.28, c.damage / 100);
    if (c.brake) target *= 1 + Math.min(0.05, c.brake / 400) * curv;

    /* drafting — real on the big ovals, mild on intermediates */
    if (i > 0 && (track.surf === "ss" || track.surf === "mid")) {
      const ah = order[i - 1];
      const gap = (ah.lap * tk.len + ah.s) - (c.lap * tk.len + c.s);
      if (gap > 3 && gap < 30) {
        const pull = (track.surf === "ss" ? 0.11 : 0.05) * (1 - gap / 30) * c.draftMul;
        target *= 1 + pull;
      }
    }
    if (c.isP && R.auraT > 0) target *= AURAS[R.auraTier].boost;
    target *= rnd(0.99, 1.01);

    if (R.yellow) {
      target = Math.min(target, 20);
      if (i > 0) {                                    // pack up behind the pace car
        const ah = order[i - 1];
        const gap = (ah.lap * tk.len + ah.s) - (c.lap * tk.len + c.s);
        if (gap > 16) target = Math.min(target * 1.7, 30);
      }
    }

    /* ---- racecraft ----
       Everyone aims at the racing line for where they are on the lap.
       Passing means deliberately leaving it, which costs grip — so a move
       has to be worth it rather than free. */
    const lanes = raceLanes(track.surf);
    const line = racingLine(tk, c.s, lanes);
    let want = line;
    if (R.yellow) {
      want = lanes.line;                              // single file behind the pace car
    } else {
      const ahead = carAhead(c, tk);
      if (ahead && ahead.gap < 26 && c.pace > ahead.car.pace * 1.002) {
        /* quicker than the car in front: try the high side or the low side,
           whichever is actually open */
        const out = clamp(line + 0.26, lanes.lo, lanes.hi);
        const ins = clamp(line - 0.26, lanes.lo, lanes.hi);
        const outFree = laneFree(c, out, tk), insFree = laneFree(c, ins, tk);
        const preferOut = track.surf === "ss" || track.surf === "mid";
        want = preferOut ? (outFree ? out : (insFree ? ins : c.lane))
                         : (insFree ? ins : (outFree ? out : c.lane));
        if (!outFree && !insFree) target *= 0.985;    // stuck in traffic
      } else if (ahead && ahead.gap < 9) {
        target *= 0.99;                               // dirty air right behind
      }
      /* a leader defends by taking the line away rather than by magic */
      const beh = carBehind(c, tk);
      c.defend = (beh && beh.gap < 12 && beh.car.pace > c.pace) ? 1 : 0;
      if (c.defend && !ahead) want = line;
    }
    /* never steer into a car alongside */
    const side = alongside(c, tk);
    if (side) {
      if (want > c.lane && side.lane > c.lane) want = c.lane;
      if (want < c.lane && side.lane < c.lane) want = c.lane;
      target *= 0.992;                                // side-by-side scrubs speed
      c.sbs = 1;
    } else c.sbs = 0;
    const rate = (track.surf === "road" ? 0.75 : track.surf === "street" ? 0.85 : 0.55) * dt;
    c.lane += clamp(want - c.lane, -rate, rate);
    c.lane = clamp(c.lane, lanes.lo, lanes.hi);

    /* running off the groove is slower, which is what makes a pass a
       commitment instead of a free lane change */
    target *= lineCost(tk, c.s, c.lane, lanes);
    c.pace = target;

    const accel = 8 + c.perf * 0.05;
    c.v += clamp(target - c.v, -accel * dt * 2.4, accel * dt);

    /* ---- how close this car is to losing it ----
       Heat builds from the things that actually bite in a stock car: a
       worn set, running hard, running beside someone, and the corner
       loading the car up.  Skill bleeds it back off. */
    if (!R.yellow) {
      const worn = clamp((45 - c.tyreLife) / 45, 0, 1);
      const load = 0.35 + curv * 1.5;
      /* Tuned against a 30-lap short track, which is about five minutes of
         running.  A car on fresh rubber builds less heat than it sheds and
         never makes a mistake at all; a car on a worn set in Normal reaches
         one about every hundred seconds; Push gets there roughly three
         times as often, and Conserve almost never does.

         The decay is deliberately small.  When it sat close to the build
         rate the whole thing became a threshold: Normal produced 0.06
         wrecks a race and Push produced 3.28, a fifty-five-fold jump off a
         2.3x risk figure, because the multiplier was fighting the decay
         rather than setting the pace.  With decay near zero the time to a
         mistake is roughly one over the build, so the risk number in the
         mode table means what it says. */
      let build = (0.0026 + worn * 0.0500) * load * mode.risk;
      if (c.sbs) build *= 1.5;
      if (c.damage) build *= 1 + c.damage / 90;
      build *= clamp(1.5 - c.perf / 150, 0.55, 1.5);      // better cars are calmer
      c.heat = Math.max(0, c.heat + (build - 0.0008) * dt);
      if (c.heat > 1) { c.heat = 0; carMistake(c, tk, curv); }
    } else c.heat = Math.max(0, c.heat - dt * 0.6);

    c.s += c.v * dt;

    /* lap crossing */
    if (c.s >= tk.len) {
      c.s -= tk.len; c.lap++;
      if (c === R.leader) onLeaderLap();
      const md = MODES[c.mode] || MODES.normal;
      const wearT = (100 / (track.laps * 0.55)) * (1 + curvatureAhead(tk, 0, tk.len) * 1.2) *
        tset.wear * md.wear;
      const wearF = (100 / (track.laps * 0.80 * c.fuelMul)) * md.fuel;
      c.tyreLife = Math.max(0, c.tyreLife - wearT * rnd(0.85, 1.15) * 0.55);
      c.fuel = Math.max(0, c.fuel - wearF);
      if (c.isP) {
        /* a healthy car spends roughly a fifth of its durability per race,
           more on the rough stuff, so it lasts about five events */
        const wearMul = { short: 1.35, ss: 1.1, mid: 1.0, road: 1.15, street: 1.45 }[track.surf];
        c.dur = Math.max(0, c.dur - (c.maxdur * 0.20 / track.laps) * wearMul * rnd(0.7, 1.4));
        R.rp += 1 + (c.anl || 10) / 26;
        R.ad += (c.adRate || 10) / 14;
        if (c.dur <= 0 && !c.dnf) { c.dnf = true; banner("ENGINE LET GO — DNF", 3); sfx("bad"); }
      } else if (Math.random() < 0.0012 && c.lap > 3) {
        /* Rivals break too, but this used to be the leading cause of
           retirement — nearly two a race, which is more than the wrecks.
           Mechanical trouble should be the rarer story. */
        c.dnf = true;
      }
      /* pit decision at the line — yours is a call you make, theirs is not */
      const lapsLeft = track.laps - c.lap;
      const needT = c.tyreLife < 26, needF = c.fuel < 14;
      let doStop = false;
      if (c.isP) {
        if (c.pitArmed) { doStop = true; c.pitArmed = 0; }
        else if ((c.tyreLife < 26 || c.fuel < 15) && lapsLeft > 1) {
          /* the crew will call you in rather than let you ruin the race —
             calling it yourself, earlier and under caution, is the edge */
          doStop = true; c.pitKind = "both";
          banner("CREW CALLS YOU IN", 1.8);
        }
      } else if ((needT || needF) && lapsLeft > 1) { doStop = true; c.pitKind = "both"; }
      if (doStop && lapsLeft >= 1) {
        const base = c.isP ? Math.max(3.2, 7.5 - shopTech() / 46) : rnd(5.5, 8);
        const kindMul = c.pitKind === "both" ? 1 : 0.62;
        let stop = base * kindMul * c.pitMul;
        if (R.yellow) stop *= 0.55;
        c.pit = stop;
        if (c.isP) banner("PIT ROAD — " + c.pitKind.toUpperCase(), 1.5);
      }
      if (c.lap >= track.laps && !c.done) {
        c.done = true; c.fin = R.finish.length + 1; R.finish.push(c);
        if (c.fin === 1) { banner("CHECKERED FLAG!", 3); R.winT = R.t; }
      }
    }
    if (c === R.leader) c.ledLaps += dt;
  }

  /* the road is solid: nobody drives through anybody */
  resolveContact(dt);

  /* classify anyone still out 12s after the winner */
  if (R.finish.length && R.t - R.winT > 12) {
    running.filter(c => !c.done).sort((a, b) => (b.lap * tk.len + b.s) - (a.lap * tk.len + a.s))
      .forEach(c => { c.done = true; c.fin = R.finish.length + 1; R.finish.push(c); });
  }
  if (R.field.every(c => c.done || c.dnf)) endRace();
}

/* ---------- a car loses it ----------
   Not every mistake is a wreck.  Most are a twitch the driver catches;
   some cost a couple of seconds; the bad ones end in the fence and take
   whoever was close enough with them. */
function carMistake(c, tk, curv) {
  /* Most moments are caught — that is what makes the ones that are not
     worth watching.  A better driver in a better car catches more of them,
     but nobody catches all of them. */
  const skill = clamp(c.perf / 130, 0.35, 1.25);
  const save = clamp(0.62 + skill * 0.22, 0.55, 0.90);
  const slide = save + (1 - save) * 0.72;
  const r = Math.random();
  if (r < save) {                          // gathered it up
    c.v *= 0.96;
    if (c.isP) banner("YOU GATHER IT UP", 1.1);
    return;
  }
  if (r < slide) {                         // a slide, a couple of seconds
    c.spin = rnd(0.5, 1.1);
    c.nudge = (Math.random() < 0.5 ? -1 : 1) * rnd(0.15, 0.4);
    c.v *= 0.62;
    if (c.isP) { banner("LOOSE! YOU LOSE GROUND", 1.6); sfx("bad"); }
    return;
  }
  wreck(c, tk, curv, Math.random() < 0.28);
}

/* Into the fence.  A heavy one collects the cars running close behind,
   which is where the multi-car pile comes from — not from a dice roll on
   the track type. */
function wreck(lead, tk, curv, heavy) {
  const collected = [lead];
  if (heavy) {
    for (const o of R.field) {
      if (o === lead || o.done || o.dnf || o.pit > 0 || o.spin > 0) continue;
      const g = -gapTo(lead, o, tk);
      /* behind the incident and close enough to have nowhere to go */
      if (g > 0 && g < 34 && Math.abs(o.lane - lead.lane) < 0.42 &&
          Math.random() < 0.55) collected.push(o);
    }
  }
  for (const c of collected) {
    c.spin = rnd(1.1, 2.2);
    c.nudge = (Math.random() < 0.5 ? -1 : 1) * rnd(0.3, 0.7);
    c.v *= 0.25;
    const hit = ri(heavy ? 18 : 8, heavy ? 46 : 24);
    c.damage = Math.min(100, c.damage + hit);
    c.wrecked = 1;
    if (c.isP) c.dur = Math.max(0, c.dur - hit);
    /* a hard enough hit is the end of the day */
    if (c.damage >= 82 || (heavy && Math.random() < 0.30)) {
      c.dnf = true; c.done = false;
      if (c.isP) { banner("YOU'RE OUT — TOO MUCH DAMAGE", 3); sfx("bad"); }
    }
  }
  const me = collected.find(c => c.isP);
  if (me) { if (!me.dnf) sfx("bad"); banner(heavy ? "YOU'RE COLLECTED!" : "YOU'RE IN THE FENCE!", 2.4); }
  else banner(collected.length > 2 ? "BIG WRECK — " + collected.length + " CARS"
                                   : "CAUTION — CAR IN THE FENCE", 2.4);
  if (!R.yellow) { R.yellow = 1; R.yellowT = rnd(6, 10); R.cautions++; sfx("yellow"); }
}

/* ---------- separation ----------
   Cars used to pass straight through each other: being alongside only
   scrubbed a little speed, and nothing ever stopped two of them holding
   the same piece of road.  This runs after everyone has moved and makes
   the road solid — a car cannot be driven into the back of the one in
   front, and two side by side push each other apart rather than merge. */
const CAR_LEN = 7.0;                 // world units, nose to tail plus a gap
const CAR_WIDE = 0.17;               // lane units, door to door

function resolveContact(dt) {
  const tk = R.tk;
  const live = R.field.filter(c => !c.done && !c.dnf && c.pit <= 0);
  /* front to back, so each car only has to look at the one it is chasing */
  live.sort((a, b) => (b.lap * tk.len + b.s) - (a.lap * tk.len + a.s));
  for (let i = 1; i < live.length; i++) {
    const c = live[i];
    for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
      const ah = live[j];
      const gap = gapTo(c, ah, tk);
      if (gap <= 0 || gap > CAR_LEN * 2) continue;
      const dl = Math.abs(ah.lane - c.lane);
      if (dl > CAR_WIDE) continue;                 // clear of each other sideways
      if (gap < CAR_LEN) {
        /* nowhere to go: hold station behind and lose the closing speed */
        const closing = c.v - ah.v;
        c.s -= (CAR_LEN - gap);
        if (c.s < 0) { c.s += tk.len; c.lap--; }
        c.v = Math.min(c.v, ah.v * 0.985);
        /* a hard enough closing rate is contact, not a lift */
        if (closing > 9 && c.spin <= 0 && ah.spin <= 0) {
          const hard = closing > 17;
          c.heat += hard ? 0.16 : 0.05;
          ah.heat += hard ? 0.12 : 0.035;
          if (hard) {
            ah.v *= 0.93;
            if (ah.isP || c.isP) { banner("CONTACT!", 1.2); sfx("bad"); }
          }
        }
        /* and they lean on each other looking for room */
        const push = (c.lane <= ah.lane ? -1 : 1) * 0.55 * dt;
        c.lane = clamp(c.lane + push, 0.03, 0.97);
        ah.lane = clamp(ah.lane - push * 0.5, 0.03, 0.97);
      }
    }
  }
  /* door to door: two cars cannot hold the same lane at the same point */
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (Math.abs(gapTo(a, b, tk)) > CAR_LEN * 0.8) continue;
      const dl = b.lane - a.lane;
      const need = CAR_WIDE * 1.05;
      if (Math.abs(dl) >= need) continue;
      const shove = ((dl >= 0 ? 1 : -1) * need - dl) * 0.5;
      a.lane = clamp(a.lane - shove, 0.03, 0.97);
      b.lane = clamp(b.lane + shove, 0.03, 0.97);
      a.v *= 0.998; b.v *= 0.998;
      a.heat += 0.02 * dt; b.heat += 0.02 * dt;
    }
  }
}

function onLeaderLap() {
  const track = R.track;
  R.lap = Math.min(R.leader.lap + 1, track.laps);
  /* stage breaks */
  if (R.stage < R.stageAt.length && R.leader.lap >= R.stageAt[R.stage]) {
    R.stage++;
    const top = R.field.filter(c => !c.dnf).sort((a, b) => (b.lap * R.tk.len + b.s) - (a.lap * R.tk.len + a.s)).slice(0, 3);
    top.forEach((c, i) => c.stagePts += (3 - i));
    banner("STAGE " + R.stage + " — points awarded", 2.2); sfx("yellow");
    if (!R.yellow) { R.yellow = 1; R.yellowT = rnd(4, 6); }
  }
  /* cautions */
  if (!R.yellow && R.leader.lap < track.laps - 1) {
    /* Concrete on both sides and no run-off: a mistake on a street course
       is a caution far more often than the same mistake on a road course. */
    /* Lower than it was on purpose: most yellows now come out of a car
       actually losing it, so this is only debris and mechanical trouble. */
    const base = { short: 0.014, mid: 0.010, ss: 0.013, road: 0.006, street: 0.016 }[track.surf];
    if (Math.random() < base) throwCaution();
  }
}
/* A caution that is not somebody's wreck: debris, a cut tyre, a car
   stopped on the apron.  Wrecks now come out of the racing itself, so
   this only covers the rest. */
function throwCaution() {
  R.yellow = 1; R.yellowT = rnd(5, 8); R.cautions++;
  banner("CAUTION — YELLOW FLAG", 2.2);
  sfx("yellow");
}
function fireAura() {
  if (!R || !R.auraTier || R.auraLeft <= 0 || R.phase !== "green") return;
  R.auraLeft--; R.auraT = AURAS[R.auraTier].dur;
  banner("AURA — " + AURAS[R.auraTier].n.toUpperCase() + " BOOST!", 1.6);
  sfx("aura");
}
/* Arm a stop for the next time you cross the line. */
function callPit(kind) {
  if (!R || R.phase !== "green") return;
  const me = R.field[0];
  if (me.done || me.dnf) return;
  me.pitKind = kind || "both";
  me.pitArmed = 1;
  banner("BOX THIS LAP — " + me.pitKind.toUpperCase(), 1.8);
  sfx("ok");
}
function cancelPit() { if (R) { R.field[0].pitArmed = 0; banner("STAY OUT", 1.4); } }
function pitArmed() { return !!(R && R.field[0].pitArmed); }

/* running order for the HUD */
function raceOrder() {
  if (!R) return [];
  const tk = R.tk;
  return R.field.slice().sort((a, b) =>
    (b.done ? 1e9 - b.fin : b.lap * tk.len + b.s) - (a.done ? 1e9 - a.fin : a.lap * tk.len + a.s));
}

function playerPos() {
  if (!R) return 1;
  const me = R.field[0];
  if (me.done) return me.fin;
  const tk = R.tk;
  const all = R.field.slice().sort((a, b) =>
    (b.done ? 1e9 - b.fin : b.lap * tk.len + b.s) - (a.done ? 1e9 - a.fin : a.lap * tk.len + a.s));
  return all.indexOf(me) + 1;
}

/* ---------- results ---------- */
function endRace() {
  if (R.phase === "done") return;
  R.phase = "done";
  R.field.filter(c => c.dnf && !c.fin).forEach(c => { c.fin = R.finish.length + 1; R.finish.push(c); });
  setTimeout(() => showResults(), 700);
}

function showResults() {
  const track = R.track, me = R.field[0], season = R.season;
  const t = G.teams[G.curTeam];
  const car = G.cars[t.car], drv = G.drivers[t.driver];
  /* A retirement before anyone was classified leaves both of these at
     zero, and a zero position indexes the purse at -1, which is undefined.
     That was added straight onto the bank: money went NaN and stayed NaN
     for the rest of the career, including in the save.  Never below last. */
  const pos = clamp(me.fin || R.finish.length || R.field.length, 1, R.field.length);

  car.dur = Math.max(0, me.dur);
  drv.energy = clamp(drv.energy - 20, 0, 100);

  const purse = season ? season.def.purse : track.prize;
  /* The purse is six deep and the field is sixteen, so ten finishers used
     to be paid nothing at all — which made a quiet mid-pack day cost more
     than not entering.  Everyone who takes the start and runs it out gets
     something.  A real purse does not cliff after sixth either; it slopes.
     Tapering harder than this stalled the garage at level two across a
     ten-year career, because tripling the field size tripled how often you
     finish outside the top six. */
  let prize;
  if (pos <= purse.length) prize = purse[pos - 1];
  else {
    const tail = purse[purse.length - 1];
    const k = (pos - purse.length) / Math.max(1, 16 - purse.length);
    prize = Math.round(tail * (1.00 - 0.55 * clamp(k, 0, 1)));
  }
  /* and nothing that is not a real number ever reaches the bank */
  if (!Number.isFinite(prize)) prize = 0;
  G.money += prize; G.stats.earned += prize;

  let fans = Math.round(track.fans * (pos === 1 ? 1.6 : pos <= 3 ? 1.05 : pos <= 6 ? 0.6 : 0.28));
  G.fans += fans;
  const ad = Math.round(R.ad + track.ad * (pos === 1 ? 1 : pos <= 5 ? 0.6 : 0.3));
  G.adPoints += ad; G.stats.adTotal += ad;
  const rp = Math.round(R.rp);
  G.rp += rp;

  car.xp += 18; while (car.xp >= car.lv * 90) { car.xp -= car.lv * 90; car.lv++; }
  drv.xp += pos <= 3 ? 34 : 16; checkLevel(drv);
  G.stats.races++;
  if (pos === 1) { G.stats.wins++; drv.wins++; }
  if (pos <= 3) G.stats.podiums++;

  /* first-time podium at a track earns an aura (GPS rule) */
  let auraMsg = "";
  if (pos <= 3 && !me.dnf) {
    const prev = G.trophies[track.id] || 99;
    if (pos < prev) {
      G.trophies[track.id] = pos;
      const tier = auraTierFor(drv);
      grantAura(tier, "first " + ord(pos) + " at " + track.n);
      auraMsg = "<div class='b small'>+1 " + AURAS[tier].n + " Aura — new best at this track!</div>";
      G.clearPts += pos === 1 ? 10 : 4;
    }
  }
  refreshUnlocks();

  let rows = "";
  R.finish.slice(0, 12).forEach(c => {
    rows += "<tr" + (c.isP ? " class='me'" : "") + "><td>" + c.fin + "</td><td>#" + c.num + " " + esc(c.name) +
      "<div class='small dim'>" + esc(c.team) + "</div></td><td class='small'>" +
      (c.dnf ? "<span class='r'>DNF</span>" : c.stops + " stop" + (c.stops === 1 ? "" : "s")) + "</td></tr>";
  });
  const head = pos === 1 ? "<div class='bigwin'>🏁 VICTORY LANE 🏁</div>"
    : "<div class='bigpos " + (pos <= 3 ? "g" : "") + "'>" + ord(pos) + " place</div>";
  const body = head + (me.dnf ? "<div class='r' style='text-align:center'>Did not finish</div>" : "") +
    "<table class='t'><tr><th>P</th><th>Driver</th><th>Pits</th></tr>" + rows + "</table>" +
    "<div class='small' style='margin-top:6px'>" +
    (prize ? "Purse <span class='g'>+" + fmtK(prize) + "</span> · " : "") +
    "Fans <span class='b'>+" + fans + "</span> · RP <span class='b'>+" + rp + "</span> · Ad <span class='b'>+" + ad + "</span>" +
    "<br>Cautions " + R.cautions + " · your stops " + me.stops + "</div>" + auraMsg;

  sfx(pos === 1 ? "win" : pos <= 3 ? "ok" : "bad");
  const seasonRef = season;
  if (seasonRef) seasonRef.lastFinish = R.finish.slice();
  R = null;
  exitRaceMode();
  advanceWeek();
  updateChrome();

  if (seasonRef) {
    applySeasonPoints(seasonRef);
    dlg(track.n, body, [["Standings", () => { closeDlg(); afterSeasonRace(seasonRef); }]]);
  } else {
    dlg(track.n, body, [["OK", closeDlg]]);
  }
}

/* ============================================================
   CHAMPIONSHIP SEASONS
   ============================================================ */
function startSeason(sid) {
  const def = byId(SERIES, sid);
  if (G.garage < def.req.garage) return toast("You need a bigger garage.");
  if (G.money < def.fee) return toast("Can't afford the entry fee.");
  G.money -= def.fee;
  const teams = RIVAL_TEAMS.slice(), drivers = RIVAL_DRIVERS.slice();
  const rivals = [], nums = [];
  for (let i = 0; i < def.rivals; i++) {
    let num; do { num = ri(2, 99); } while (nums.includes(num));
    nums.push(num);
    rivals.push({
      name: drivers.splice(ri(0, drivers.length - 1), 1)[0],
      team: teams.splice(ri(0, teams.length - 1), 1)[0],
      /* same gradient for a championship roster, so the title is fought
         between a handful of cars rather than the whole entry list */
      rel: (1.06 - (i / Math.max(1, def.rivals - 1)) * 0.34) * rnd(0.97, 1.03), num, pts: 0,
    });
  }
  const drv = G.drivers[G.teams[G.curTeam].driver];
  SEASON = { def, round: 0, rivals, mePts: 0, meName: drv.name, playoffSet: false };
  closeAllDlg();
  dlg(def.n, "<div class='small'>" + def.tracks.length + " rounds · entry " + fmtK(def.fee) +
    " · champion's purse " + fmtK(def.purse[0]) + "</div>" +
    "<div class='small dim' style='margin-top:5px'>Stage points are awarded at 1/3 and 2/3 distance in every round." +
    (def.playoff ? "<br><span class='b'>Playoff format:</span> the top 4 are reset before the finale — winner takes the title." : "") + "</div>",
    [["Round 1: " + byId(TRACKS, def.tracks[0]).n, () => { closeDlg(); nextSeasonRace(); }]]);
}
function nextSeasonRace() {
  const tr = byId(TRACKS, SEASON.def.tracks[SEASON.round]);
  preRace(tr.id, SEASON);
}
function applySeasonPoints(season) {
  /* called right after a race finishes; R is already cleared, so use the
     stored finish order captured on the season object */
  if (!season || !season.lastFinish) return;
  for (const c of season.lastFinish) {
    const pts = (PTS[c.fin - 1] || 5) + c.stagePts;
    if (c.isP) season.mePts += pts;
    else { const r = season.rivals.find(x => x.name === c.name); if (r) r.pts += pts; }
  }
  season.lastFinish = null;
}
function afterSeasonRace(season) {
  season.round++;
  const done = season.round >= season.def.tracks.length;
  /* playoff reset before the finale */
  if (!done && season.def.playoff && season.round === season.def.tracks.length - 1 && !season.playoffSet) {
    season.playoffSet = true;
    const all = standingsArray(season);
    const cut = all.slice(0, 4).map(e => e.name);
    if (cut.includes(season.meName)) season.mePts = 5000;
    else season.mePts = Math.min(season.mePts, 1);
    season.rivals.forEach(r => { r.pts = cut.includes(r.name) ? 5000 : Math.min(r.pts, 1); });
    toast("<span class='b'>PLAYOFF!</span> The top 4 are level going into the finale.");
  }
  showStandings(season, done);
}
function standingsArray(season) {
  const arr = [{ name: season.meName, team: "YOUR TEAM", pts: season.mePts, isP: true }]
    .concat(season.rivals.map(r => ({ name: r.name, team: r.team, pts: r.pts })));
  return arr.sort((a, b) => b.pts - a.pts);
}
function showStandings(season, done) {
  const arr = standingsArray(season);
  let rows = "";
  arr.forEach((e, i) => {
    rows += "<tr" + (e.isP ? " class='me'" : "") + "><td>" + (i + 1) + "</td><td>" + esc(e.name) +
      "<div class='small dim'>" + esc(e.team) + "</div></td><td><b>" + (e.pts >= 5000 ? "PO" : e.pts) + "</b></td></tr>";
  });
  const table = "<table class='t'><tr><th>#</th><th>Driver</th><th>Pts</th></tr>" + rows + "</table>";
  if (!done) {
    const nx = byId(TRACKS, season.def.tracks[season.round]);
    dlg("Standings — after round " + season.round, table,
      [["Next: " + nx.n, () => { closeDlg(); nextSeasonRace(); }], ["Back to shop", () => { closeDlg(); }]]);
    return;
  }
  /* season over */
  const myRank = arr.findIndex(e => e.isP) + 1;
  const payout = season.def.purse[Math.min(myRank, 6) - 1] || 0;
  G.money += payout; G.stats.earned += payout;
  let msg;
  if (myRank === 1) {
    msg = "<div class='bigwin'>🏆 SERIES CHAMPION 🏆</div>" + table +
      "<div class='small'>Champion's purse <span class='g'>+" + fmtK(payout) + "</span></div>";
    if (!G.seriesWon[season.def.id]) {
      G.seriesWon[season.def.id] = true; G.stats.titles++; G.clearPts += 50;
      G.fans += season.def.fans;
      const drv = G.drivers[G.teams[G.curTeam].driver];
      grantAura(auraTierFor(drv), "championship!");
      msg += "<div class='b small'>+" + season.def.fans + " fans · championship aura earned</div>";
      const nx = GARAGES[G.garage + 1];
      if (nx && nx.req === season.def.id) msg += "<div class='g small'>A bigger garage is now available in Research.</div>";
    }
    sfx("win");
  } else {
    msg = "<div class='bigpos'>Season finished " + ord(myRank) + "</div>" + table +
      (payout ? "<div class='small'>Season payout <span class='g'>+" + fmtK(payout) + "</span></div>" : "");
  }
  G.seriesDone[season.def.id] = true;
  SEASON = null;
  refreshUnlocks();
  dlg("Final Standings", msg, [["Done", closeDlg]]);
}
