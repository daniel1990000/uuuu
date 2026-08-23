/* ============================================================
   RACE ENGINE
   Qualifying, green-flag running, drafting, tyre/fuel wear, pit
   strategy, cautions, stage points, and championship seasons.
   ============================================================ */
"use strict";

let R = null;          // live race
let SEASON = null;     // live championship

const MPH = 2.35;      // world-units/sec → displayed mph

/* ---------- field construction ---------- */
function makeEntry(name, team, perf, col, num, opts) {
  return Object.assign({
    name, team, perf, col, num,
    isP: false, s: 0, lap: 0, v: 0, grid: 0, lane: 0, laneT: 0,
    tyre: 100, fuel: 100, dur: 9999, maxdur: 9999,
    pit: 0, stops: 0, pitMul: 1, fuelMul: 1, draftMul: 1, brake: 0,
    done: false, dnf: false, fin: 0, stagePts: 0, ledLaps: 0, best: 0,
    pace: 0, defend: 0, sbs: 0,
  }, opts || {});
}

function buildField(track, season) {
  const t = G.teams[G.curTeam];
  const car = G.cars[t.car], drv = G.drivers[t.driver];
  const cs = carStats(car);
  const perf = carPerf(car, track.surf) + driverPerf(drv, track.surf);
  const field = [makeEntry(drv.name, "YOUR TEAM", perf, "#e8332a", car.num, {
    isP: true, dur: car.dur, maxdur: cs.maxdur,
    pitMul: Math.max(0.45, 1 - cs.pit / 100 - shopTech() / 900),
    fuelMul: 1 + cs.fuel / 100, draftMul: 1 + cs.drv / 200,
    brake: cs.brake, anl: teamAnalysis(G.curTeam), adRate: cs.ad + teamAppeal(G.curTeam) * 0.4,
  })];
  const n = season ? season.def.rivals : 5;
  const cols = ["#2255cc", "#e9a11b", "#3fae4a", "#8a3fc2", "#12b0b0", "#d457a0", "#7a4c22", "#556270"];
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
      str = scaled * rnd(0.90, 1.09);
      name = pool.splice(ri(0, pool.length - 1), 1)[0] || "Privateer " + i;
      team = tpool.splice(ri(0, tpool.length - 1), 1)[0] || "Independent";
      do { num = ri(2, 99); } while (nums.includes(num));
    }
    nums.push(num);
    field.push(makeEntry(name, team, str, cols[i % cols.length], num,
      { pitMul: rnd(0.85, 1.15), fuelMul: rnd(0.95, 1.1), draftMul: rnd(0.95, 1.08) }));
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
  banner("QUALIFIED " + ord(pQual), 2.2);
  sfx("ok");
  return R;
}
function banner(text, secs) { if (R) { R.msg = text; R.msgT = secs; } }

/* How many lanes a surface supports, and where the groove sits. */
function raceLanes(surf) {
  if (surf === "ss")   return { lo: 0.10, hi: 0.90, line: 0.34 };   // three wide
  if (surf === "mid")  return { lo: 0.14, hi: 0.86, line: 0.34 };
  if (surf === "road") return { lo: 0.18, hi: 0.82, line: 0.40 };
  if (surf === "dirt") return { lo: 0.14, hi: 0.86, line: 0.44 };
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
      if (c.pit <= 0) { c.tyre = 100; c.fuel = 100; c.stops++; }
      continue;
    }
    const sample = sampleTrack(tk, c.s);
    const curv = sample.c;
    const bank = sample.b;

    /* grip: tyres, corner tightness, banking helps, surface matters */
    const grip = (0.80 + 0.20 * (c.tyre / 100)) * (1 + bank / 220);
    /* cornering cost: tight corners scrub speed unless handling is high */
    const cornerCost = curv * (1.0 - Math.min(0.55, c.perf / 340)) * (track.surf === "dirt" ? 0.85 : 1);
    let target = (26 + c.perf * 0.62) * grip * (1 - cornerCost * 0.42);
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
    if (track.surf === "dirt") target *= rnd(0.965, 1.035);
    else target *= rnd(0.99, 1.01);

    if (R.yellow) {
      target = Math.min(target, 20);
      if (i > 0) {                                    // pack up behind the pace car
        const ah = order[i - 1];
        const gap = (ah.lap * tk.len + ah.s) - (c.lap * tk.len + c.s);
        if (gap > 16) target = Math.min(target * 1.7, 30);
      }
    }
    const accel = 8 + c.perf * 0.05;
    c.v += clamp(target - c.v, -accel * dt * 2.4, accel * dt);

    /* ---- racecraft: pick a lane, defend, and pass ---- */
    const lanes = raceLanes(track.surf);
    let want = c.lane;
    if (R.yellow) {
      want = 0.42;                                   // single file behind the pace car
    } else {
      const ahead = carAhead(c, tk);
      if (ahead && ahead.gap < 26 && c.pace > ahead.car.pace * 1.004) {
        /* faster than the car in front — look for a way by */
        const out = clamp(c.lane + 0.30, lanes.lo, lanes.hi);
        const ins = clamp(c.lane - 0.30, lanes.lo, lanes.hi);
        const outFree = laneFree(c, out, tk), insFree = laneFree(c, ins, tk);
        /* momentum outside on the big tracks, dive inside on the short ones */
        const preferOut = track.surf === "ss" || track.surf === "mid";
        want = preferOut ? (outFree ? out : (insFree ? ins : c.lane))
                         : (insFree ? ins : (outFree ? out : c.lane));
        if (!outFree && !insFree) target *= 0.985;    // stuck in traffic
      } else if (ahead && ahead.gap < 9) {
        target *= 0.99;                               // dirty air right behind
      } else {
        /* no traffic: settle back onto the groove */
        want = c.defend > 0 ? c.lane : lanes.line;
      }
      /* a leader defends the preferred line when someone is close behind */
      const beh = carBehind(c, tk);
      c.defend = (beh && beh.gap < 12 && beh.car.pace > c.pace) ? 1 : 0;
      if (c.defend) want = lanes.line;
    }
    /* never steer into a car alongside */
    const side = alongside(c, tk);
    if (side) {
      if (want > c.lane && side.lane > c.lane) want = c.lane;
      if (want < c.lane && side.lane < c.lane) want = c.lane;
      target *= 0.992;                                // side-by-side scrubs speed
      c.sbs = 1;
    } else c.sbs = 0;
    const rate = (track.surf === "road" ? 0.75 : 0.55) * dt;
    c.lane += clamp(want - c.lane, -rate, rate);
    c.lane = clamp(c.lane, lanes.lo, lanes.hi);
    c.pace = target;

    c.s += c.v * dt;

    /* lap crossing */
    if (c.s >= tk.len) {
      c.s -= tk.len; c.lap++;
      if (c === R.leader) onLeaderLap();
      const wearT = (100 / (track.laps * 0.55)) * (1 + curvatureAhead(tk, 0, tk.len) * 1.2);
      const wearF = 100 / (track.laps * 0.80 * c.fuelMul);
      c.tyre = Math.max(0, c.tyre - wearT * rnd(0.85, 1.15) * 0.55);
      c.fuel = Math.max(0, c.fuel - wearF);
      if (c.isP) {
        /* a healthy car spends roughly a fifth of its durability per race,
           more on the rough stuff, so it lasts about five events */
        const wearMul = { short: 1.35, dirt: 1.4, ss: 1.1, mid: 1.0, road: 1.15 }[track.surf];
        c.dur = Math.max(0, c.dur - (c.maxdur * 0.20 / track.laps) * wearMul * rnd(0.7, 1.4));
        R.rp += 1 + (c.anl || 10) / 26;
        R.ad += (c.adRate || 10) / 14;
        if (c.dur <= 0 && !c.dnf) { c.dnf = true; banner("ENGINE LET GO — DNF", 3); sfx("bad"); }
      } else if (Math.random() < 0.0035 && c.lap > 3) {
        c.dnf = true;                                  // rivals break too
      }
      /* pit decision at the line */
      const lapsLeft = track.laps - c.lap;
      const needT = c.tyre < 26, needF = c.fuel < 14;
      if ((needT || needF) && lapsLeft > 1) {
        let stop = (c.isP ? Math.max(3.2, 7.5 - shopTech() / 46) : rnd(5.5, 8)) * c.pitMul;
        if (R.yellow) stop *= 0.55;
        c.pit = stop;
        if (c.isP) banner("PIT ROAD — " + (needT ? "TYRES" : "FUEL"), 1.5);
      }
      if (c.lap >= track.laps && !c.done) {
        c.done = true; c.fin = R.finish.length + 1; R.finish.push(c);
        if (c.fin === 1) { banner("CHECKERED FLAG!", 3); R.winT = R.t; }
      }
    }
    if (c === R.leader) c.ledLaps += dt;
  }

  /* classify anyone still out 12s after the winner */
  if (R.finish.length && R.t - R.winT > 12) {
    running.filter(c => !c.done).sort((a, b) => (b.lap * tk.len + b.s) - (a.lap * tk.len + a.s))
      .forEach(c => { c.done = true; c.fin = R.finish.length + 1; R.finish.push(c); });
  }
  if (R.field.every(c => c.done || c.dnf)) endRace();
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
    const base = { short: 0.045, mid: 0.028, ss: 0.042, dirt: 0.05, road: 0.018 }[track.surf];
    if (Math.random() < base) throwCaution();
  }
}
function throwCaution() {
  R.yellow = 1; R.yellowT = rnd(5, 8); R.cautions++;
  const big = R.track.surf === "ss" && Math.random() < 0.32;
  banner(big ? "THE BIG ONE! CAUTION" : "CAUTION — YELLOW FLAG", 2.4);
  sfx("yellow");
  if (big) {
    for (const c of R.field) {
      if (c.done || c.dnf) continue;
      if (!c.isP && Math.random() < 0.42) { c.v *= 0.25; c.s -= rnd(15, 45); }
    }
    const me = R.field[0];
    if (!me.done && !me.dnf && Math.random() < 0.35) {
      me.v *= 0.35; me.dur = Math.max(1, me.dur - ri(6, 14));
      banner("YOU'RE COLLECTED IN THE WRECK!", 2.6);
    }
  }
}
function fireAura() {
  if (!R || !R.auraTier || R.auraLeft <= 0 || R.phase !== "green") return;
  R.auraLeft--; R.auraT = AURAS[R.auraTier].dur;
  banner("AURA — " + AURAS[R.auraTier].n.toUpperCase() + " BOOST!", 1.6);
  sfx("aura");
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
  const pos = me.fin || R.finish.length;

  car.dur = Math.max(0, me.dur);
  drv.energy = clamp(drv.energy - 20, 0, 100);

  const purse = season ? season.def.purse : track.prize;
  let prize = pos <= 6 ? purse[pos - 1] : 0;
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
      rel: rnd(0.90, 1.10), num, pts: 0,
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
