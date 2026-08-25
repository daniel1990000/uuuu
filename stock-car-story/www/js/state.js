/* ============================================================
   GAME STATE — economy, time, teams, research, sponsors, auras
   All money is $K.
   ============================================================ */
"use strict";

const SAVEKEY = "stockCarStory.save.v2";
const LIBKEY  = "stockCarStory.library.v2";     // survives New Game+
let G = null;

/* ---------- helpers ---------- */
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const ord = n => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function fmtK(k) {
  if (k >= 1e6) return "$" + (k / 1e6).toFixed(2) + "B";
  if (k >= 1000) return "$" + (k / 1000).toFixed(k >= 10000 ? 0 : 1) + "M";
  return "$" + Math.round(k) + "K";
}
const byId = (arr, id) => arr.find(x => x.id === id);

/* ============================================================
   NEW GAME
   ============================================================ */
function loadLibrary() {
  try { return JSON.parse(localStorage.getItem(LIBKEY)) || { cars: {}, parts: {} }; }
  catch (e) { return { cars: {}, parts: {} }; }
}
function saveLibrary() {
  try { localStorage.setItem(LIBKEY, JSON.stringify(G.lib)); } catch (e) {}
}

function newGame(carry) {
  const lib = carry ? loadLibrary() : { cars: {}, parts: {} };
  if (!lib.cars.street) lib.cars.street = { lv: 1, up: 0 };
  G = {
    v: 2,
    year: 1, month: 1, week: 1,
    money: 500, rp: 20, fans: 100, adPoints: 0,
    lib,                                  // {cars:{id:{lv,up}}, parts:{id:{lv,up}}}
    known: { cars: ["street"], parts: [], trains: ["jog", "joyride", "read", "dance"] },
    drivers: [], crew: [], cars: [], teams: [],
    auras: { blue: 1, pink: 0, silver: 0, gold: 0 },
    sponsors: [],                          // {id, ad, filled} — max 2 live
    sponsorsFilled: [],                    // ids whose gauge was ever filled (permanent)
    sponsorProgress: {},                   // partial ad progress on dropped contracts
    offers: [],                            // sponsor ids currently offered
    trophies: {}, seriesWon: {}, seriesDone: {},
    garage: 1, build: null, repair: null,
    hiredNames: [],
    stats: { races: 0, wins: 0, podiums: 0, titles: 0, earned: 0, upgrades: 0, adTotal: 0 },
    set: { sfx: true, music: false, paused: false, speed: 1 },
    curTeam: 0, clearPts: 0, ended: false, seenIntro: false,
    bailoutUsed: false, log: [],
  };
  hireDriver(DRIVERS[0]);
  hireCrew(CREW[0]);
  const c = buildCarInstance("street", 1.0);
  G.cars.push(c);
  G.teams = [{ name: "Main Team", driver: 0, car: 0, crew: [0] }];
  refreshUnlocks(true);
  return G;
}

/* ---------- staff ---------- */
function hireDriver(t) {
  const d = { name: t.n, role: "driver", lv: 1, xp: 0, energy: 100,
    sal: Math.max(2, Math.round(t.c / 22 + 4)),
    pd: t.pd, sh: t.sh, st: t.st, ap: t.ap, tc: t.tc, an: t.an,
    face: ri(0, 7), aura: null, wins: 0 };
  G.drivers.push(d); G.hiredNames.push(t.n); return d;
}
function hireCrew(t) {
  const c = { name: t.n, role: "crew", lv: 1, sal: t.s,
    ap: t.ap, tc: t.tc, an: t.an, face: ri(0, 7) };
  G.crew.push(c); G.hiredNames.push(t.n); return c;
}
function crewOfTeam(ti) {
  const t = G.teams[ti]; if (!t) return [];
  return t.crew.map(i => G.crew[i]).filter(Boolean);
}
/* Tech/Analysis/Appeal pools — the driver contributes too, as in GPS */
function teamTech(ti) {
  const t = G.teams[ti]; if (!t) return 10;
  let v = crewOfTeam(ti).reduce((a, c) => a + c.tc * (1 + (c.lv - 1) * 0.25), 0);
  const d = G.drivers[t.driver]; if (d) v += d.tc * 0.5;
  return v;
}
function teamAnalysis(ti) {
  const t = G.teams[ti]; if (!t) return 5;
  let v = crewOfTeam(ti).reduce((a, c) => a + c.an * (1 + (c.lv - 1) * 0.25), 0);
  const d = G.drivers[t.driver]; if (d) v += d.an * 0.5;
  return v;
}
function teamAppeal(ti) {
  const t = G.teams[ti]; if (!t) return 5;
  let v = crewOfTeam(ti).reduce((a, c) => a + c.ap * (1 + (c.lv - 1) * 0.25), 0);
  const d = G.drivers[t.driver]; if (d) v += d.ap;
  return v;
}
function totalAppeal() { return G.teams.reduce((a, t, i) => a + teamAppeal(i), 0); }
function shopTech() { return G.crew.reduce((a, c) => a + c.tc * (1 + (c.lv - 1) * 0.25), 0); }

/* ---------- library maths ---------- */
function libEntry(kind, id) {
  const L = kind === "car" ? G.lib.cars : G.lib.parts;
  if (!L[id]) L[id] = { lv: 1, up: 0 };
  return L[id];
}
/* growth multiplier from level + upgrade% (lv6/100% ≈ 3.4×) */
function libMult(e) { return 1 + (e.lv - 1) * 0.40 + (e.up / 100) * 0.40; }

function buildCarInstance(carId, quality) {
  const def = byId(CARS, carId), e = libEntry("car", carId);
  const m = libMult(e) * quality;
  return { id: carId, name: def.name, quality, num: ri(2, 99),
    dur: Math.round(def.dur * m), xp: 0, lv: 1, parts: [],
    paint: ri(0, 7), inst: m };
}
function carStats(car) {
  const def = byId(CARS, car.id), e = libEntry("car", car.id);
  const m = libMult(e) * car.quality * (1 + (car.lv - 1) * 0.05);
  const s = { spd: def.spd * m, acc: def.acc * m, hdl: def.hdl * m,
    maxdur: Math.round(def.dur * libMult(e) * car.quality),
    exp: def.exp, ad: 10 * (APT[def.ad] || 1), rep: APT[def.rep] || 1,
    apt: {}, drv: 0, sc: 0, turbo: 0, brake: 0, anl: 0, xp: 0, pit: 0, fuel: 0,
    surf: { short: 0, mid: 0, ss: 0, road: 0, street: 0 } };
  for (const k in def.apt) s.apt[k] = APT[def.apt[k]];
  for (const p of car.parts) {
    const pd = byId(PARTS, p.id), pe = libEntry("part", p.id);
    const pm = libMult(pe) * p.qual;
    for (const k in pd.fx) {
      const v = pd.fx[k] * pm;
      if (k === "spd" || k === "acc" || k === "hdl") s[k] += v;
      else if (k === "dur") s.maxdur += Math.round(v);
      else if (k in s.surf) s.surf[k] += v;
      else if (k in s) s[k] += v;
    }
  }
  return s;
}
/* Track-weighted machine performance */
function carPerf(car, surf) {
  const s = carStats(car);
  const w = { short: { spd: .24, acc: .34, hdl: .42 }, mid: { spd: .40, acc: .26, hdl: .34 },
    ss: { spd: .56, acc: .16, hdl: .28 }, road: { spd: .28, acc: .30, hdl: .42 },
    /* street: no straight long enough to matter, so it is all traction
       out of ninety-degree corners and the handling to place the car */
    street: { spd: .18, acc: .38, hdl: .44 } }[surf];
  let base = (s.spd * w.spd + s.acc * w.acc + s.hdl * w.hdl);
  base *= (s.apt[surf] || 1);
  base += (s.surf[surf] || 0) * 0.8;
  base *= 1 + s.drv * 0.004 + s.sc * 0.0009 + s.turbo * 0.0016;
  return Math.max(4, base);
}
function driverPerf(d, surf) {
  const w = { short: { pd: .30, sh: .30, st: .40 }, mid: { pd: .38, sh: .28, st: .34 },
    ss: { pd: .46, sh: .22, st: .32 }, road: { pd: .28, sh: .32, st: .40 },
    street: { pd: .20, sh: .34, st: .46 } }[surf];
  const en = 0.72 + 0.28 * (d.energy / 100);
  return (d.pd * w.pd + d.sh * w.sh + d.st * w.st) * (1 + (d.lv - 1) * 0.04) * en;
}

/* ============================================================
   UNLOCKS
   ============================================================ */
function condMet(u) {
  if (!u) return true;
  switch (u.t) {
    case "start":   return true;
    case "date":    return G.year > u.y || (G.year === u.y && G.month >= u.m);
    case "race":    return !!G.trophies[u.id] && G.trophies[u.id] === 1;
    case "sponsor": return (G.sponsorsFilled || []).includes(u.id);
    case "garage":  return G.garage >= u.lv;
    case "series":  return !!G.seriesWon[u.id];
    case "partUp":  { const e = G.lib.parts[u.id]; return !!e && (e.lv > 1 || e.up >= u.pct); }
    case "carUp":   { const e = G.lib.cars[u.id];  return !!e && (e.lv > 1 || e.up >= u.pct); }
    case "partUp2": { const a = G.lib.parts[u.a], b = G.lib.parts[u.b];
                      return !!a && !!b && (a.lv > 1 || a.up >= u.pct) && (b.lv > 1 || b.up >= u.pct); }
    case "carUp2":  { const a = G.lib.cars[u.a], b = G.lib.cars[u.b];
                      return !!a && !!b && (a.lv > 1 || a.up >= u.pct) && (b.lv > 1 || b.up >= u.pct); }
  }
  return false;
}
/* Which blueprints are researchable right now (condition met, not yet known) */
function availableCarBlueprints() { return CARS.filter(c => !G.known.cars.includes(c.id) && condMet(c.unlock)); }
function availablePartBlueprints() { return PARTS.filter(p => !G.known.parts.includes(p.id) && condMet(p.unlock)); }

function refreshUnlocks(silent) {
  const news = [];
  for (const t of TRAININGS)
    if (!G.known.trains.includes(t.id) && condMet(t.unlock)) { G.known.trains.push(t.id); news.push("Training: " + t.n); }
  /* sponsor offers appear as fans/appeal grow */
  for (const sp of SPONSORS) {
    if (G.sponsors.some(s => s.id === sp.id) || G.offers.includes(sp.id)) continue;
    if (G.fans >= sp.need * 6 && totalAppeal() >= sp.need * 0.35) G.offers.push(sp.id);
  }
  if (!silent && news.length) toast("Unlocked!<br>" + news.join("<br>"));
  return news;
}

/* ============================================================
   TIME
   ============================================================ */
function dateStr() { return G.year + "Y " + G.month + "M " + G.week + "W"; }

function advanceWeek() {
  G.week++;
  if (G.week > 4) { G.week = 1; G.month++; onMonth(); }
  if (G.month > 12) { G.month = 1; G.year++; onYear(); }

  for (const d of G.drivers) {
    d.energy = clamp(d.energy + 14, 0, 100);
    if (Math.random() < 0.16) { const k = pick(["pd", "sh", "st", "ap", "tc", "an"]); d[k] += 1; }
  }
  for (const c of G.crew) if (Math.random() < 0.13) { const k = pick(["ap", "tc", "an"]); c[k] += 1; }

  if (G.build) {
    G.build.wks--;
    if (G.build.wks <= 0) {
      const car = buildCarInstance(G.build.carId, G.build.quality);
      if (G.build.slot < G.cars.length) G.cars[G.build.slot] = car; else G.cars.push(car);
      toast("Machine complete!<br><span class='b'>" + esc(car.name) + "</span> — build quality " + Math.round(G.build.quality * 100) + "%");
      sfx("ok"); G.build = null;
    }
  }
  if (G.repair) {
    G.repair.wks--;
    if (G.repair.wks <= 0) {
      const car = G.cars[G.repair.slot];
      if (car) car.dur = carStats(car).maxdur;
      toast("Repairs finished."); G.repair = null;
    }
  }
  /* merchandising trickle */
  G.money += Math.floor(G.fans / 2500);
  /* random events */
  if (Math.random() < 0.05) fireEvent();
  refreshUnlocks();
  if (G.week === 1) autosave();
}

let autoN = 0;
function autosave() { if (++autoN % 2 === 0) saveGame(); }

/* What the roster costs to put a car on track once. */
function teamWages() {
  return Math.round(G.drivers.reduce((a, d) => a + d.sal, 0) +
                    G.crew.reduce((a, c) => a + c.sal * (1 + (c.lv - 1) * 0.5), 0));
}
function onMonth() {
  /* Wages used to come out here, every month, whether or not you raced.
     Sitting in the shop deciding what to build therefore cost money and
     returned nothing, which reads as the game quietly fining you for
     thinking.  They are charged per race entered instead: the same money
     over a career, since a race is about a month apart, but now it is
     attached to the thing that earns it and idle weeks are free. */
  if (G.month === 1 || G.month === 7) settleSponsors();
  if (G.money < 0) checkBankrupt();
}
function onYear() {
  /* a couple of free auras a year, as in GPS */
  if (Math.random() < 0.7) grantAura(auraTierFor(G.drivers[G.teams[0].driver]), "a quiet season of testing");
  if (G.year === 14) { /* endgame fires in M4 */ }
}
function fireEvent() {
  const e = pick(EVENTS);
  if (e.fx.fans) G.fans += e.fx.fans;
  if (e.fx.rp) G.rp += e.fx.rp;
  if (e.fx.money) G.money += e.fx.money;
  if (e.fx.ad) { G.adPoints += e.fx.ad; G.stats.adTotal += e.fx.ad; }
  G.log.push({ y: G.year, m: G.month, t: e.t });
  toast(e.t);
}
function checkBankrupt() {
  if (G.money >= 0) return;
  if (!G.bailoutUsed) {
    G.bailoutUsed = true; G.money += 300;
    dlg("Emergency Fund", "The bank covers your debts — once.<br><span class='g'>+$300K</span><br>Don't let it happen again.", [["OK", closeDlg]]);
  } else {
    G.fans = Math.floor(G.fans * 0.8);
    G.money = 50;
    dlg("Bankrupt!", "Creditors strip the shop. Fans drift away.<br>You keep racing — barely.", [["Ouch", closeDlg]]);
  }
}

/* ============================================================
   SPONSORS — ad points fill a gauge, contracts settle twice a year
   ============================================================ */
function settleSponsors() {
  if (!G.sponsors.length) { G.adPoints = 0; return; }
  let total = 0, msg = "";
  const share = G.adPoints / G.sponsors.length;
  for (const s of G.sponsors) {
    const sp = byId(SPONSORS, s.id);
    s.ad += share;
    const pay = Math.round(sp.base * (0.5 + Math.min(2.0, share / Math.max(20, sp.need * 0.35))));
    total += pay;
    msg += esc(sp.n) + " <span class='g'>+" + fmtK(pay) + "</span><br>";
    if (!s.filled && s.ad >= sp.need) {
      s.filled = true;
      if (!G.sponsorsFilled.includes(s.id)) G.sponsorsFilled.push(s.id);
      msg += "<span class='b'>★ " + esc(sp.n) + " gauge filled!</span><br>";
      grantSponsorReward(sp);
      refreshUnlocks();
    }
  }
  G.money += total;
  G.adPoints = 0;
  if (total > 0) { sfx("cash"); dlg("Sponsor Payments", msg, [["Nice!", closeDlg]]); }
}
function grantSponsorReward(sp) {
  const rw = sp.rw;
  if (rw.t === "cash") { G.money += rw.amt; }
  else if (rw.t === "rp") { G.rp += rw.amt; }
  else if (rw.t === "train") { if (!G.known.trains.includes(rw.id)) G.known.trains.push(rw.id); }
  /* part/car rewards unlock the blueprint condition; research still needed */
  G.clearPts += 6;
}
function signSponsor(id) {
  if (G.sponsors.length >= 2) { toast("Only two contracts at a time."); return; }
  const sp = byId(SPONSORS, id);
  const prior = G.sponsorProgress[id] || 0;
  G.sponsors.push({ id, ad: prior, filled: G.sponsorsFilled.includes(id) });
  G.offers = G.offers.filter(x => x !== id);
  sfx("cash");
  dlg("Contract Signed", "<span class='b'>" + esc(sp.n) + "</span> is on the hood!<br><span class='small'>Fill the ad gauge (" + sp.need + ") to earn: " + rewardText(sp) + "</span>", [["Great", closeDlg]]);
}
function dropSponsor(id) {
  const cur = G.sponsors.find(s => s.id === id);
  /* progress on an unfinished gauge is kept, so a player can come back to it */
  if (cur && !cur.filled) G.sponsorProgress[id] = cur.ad;
  G.sponsors = G.sponsors.filter(s => s.id !== id);
  if (!G.offers.includes(id)) G.offers.push(id);
}
function rewardText(sp) {
  const rw = sp.rw;
  if (rw.t === "cash") return fmtK(rw.amt);
  if (rw.t === "rp") return rw.amt + " RP";
  if (rw.t === "train") { const t = byId(TRAININGS, rw.id); return "Training: " + (t ? t.n : rw.id); }
  if (rw.t === "part") { const p = byId(PARTS, rw.id); return "Part: " + (p ? p.name : rw.id); }
  if (rw.t === "car") { const c = byId(CARS, rw.id); return "Machine: " + (c ? c.name : rw.id); }
  return "?";
}

/* ============================================================
   AURAS
   ============================================================ */
function auraTierFor(d) {
  if (!d) return "blue";
  const tot = d.pd + d.sh + d.st + d.ap + d.tc + d.an;
  if (tot >= 480) return "gold";
  if (tot >= 300) return "silver";
  if (tot >= 160) return "pink";
  return "blue";
}
function grantAura(tier, why) {
  G.auras[tier] = (G.auras[tier] || 0) + 1;
  toast("<span class='b'>" + AURAS[tier].n + " Aura</span> earned" + (why ? "<br><span class='small'>" + why + "</span>" : "") + "!");
  sfx("aura");
}
function bestAura() { for (let i = AURA_ORDER.length - 1; i >= 0; i--) if (G.auras[AURA_ORDER[i]] > 0) return AURA_ORDER[i]; return null; }
function anyAura() { return AURA_ORDER.some(c => G.auras[c] > 0); }
function spendAura(tier) { if (G.auras[tier] > 0) { G.auras[tier]--; sfx("aura"); return AURAS[tier]; } return null; }

/* ============================================================
   RESEARCH / BUILD / PARTS
   ============================================================ */
function researchCar(id) {
  const c = byId(CARS, id);
  if (G.rp < c.res) return toast("Not enough research data.");
  G.rp -= c.res; G.known.cars.push(id); libEntry("car", id);
  sfx("ok"); toast("<span class='b'>" + esc(c.name) + "</span> blueprints complete!");
  G.clearPts += 4;
}
function researchPart(id) {
  const p = byId(PARTS, id);
  if (G.rp < p.res) return toast("Not enough research data.");
  G.rp -= p.res; G.known.parts.push(id); libEntry("part", id);
  sfx("ok"); toast("<span class='b'>" + esc(p.name) + "</span> blueprints complete!");
  G.clearPts += 3;
}
function upgradeCost(kind, id) {
  const def = kind === "car" ? byId(CARS, id) : byId(PARTS, id);
  const e = libEntry(kind, id);
  return Math.round((def.res * 0.35 + 8) * (1 + (e.lv - 1) * 0.8) * (1 + e.up / 140));
}
/* Upgrading raises upgrade% (and level at 100%).  Auras multiply the gain. */
function doUpgrade(kind, id, auraTier) {
  const cost = upgradeCost(kind, id);
  if (G.rp < cost) { toast("Not enough research data."); return false; }
  const e = libEntry(kind, id);
  if (e.lv >= 6 && e.up >= 100) { toast("Already perfected!"); return false; }
  G.rp -= cost;
  let gain = 10;
  if (auraTier) { const a = spendAura(auraTier); if (a) gain = Math.round(gain * a.mult); }
  e.up += gain;
  while (e.up >= 100 && e.lv < 6) { e.up -= 100; e.lv++; }
  if (e.lv >= 6) e.up = Math.min(100, e.up);
  G.stats.upgrades++; G.clearPts += 1;
  saveLibrary();
  refreshUnlocks();
  sfx("ok");
  return true;
}
function startBuild(carId, slot, auraTier) {
  const def = byId(CARS, carId);
  if (G.money < def.cost) return toast("Not enough money.");
  if (G.build) return toast("The crew is already building.");
  G.money -= def.cost;
  let q = 1 + Math.min(0.45, shopTech() / 420) + rnd(0, 0.06);
  if (auraTier) { const a = spendAura(auraTier); if (a) q += 0.06 * a.mult; }
  q = Math.min(1.6, q);
  const wks = Math.max(2, Math.round(5 - shopTech() / 160));
  G.build = { carId, slot, quality: q, wks };
  toast("Build started: <span class='b'>" + esc(def.name) + "</span><br>" + wks + " weeks");
}
function installPart(car, partId, auraTier) {
  const s = carStats(car);
  if (car.parts.length >= s.exp) return toast("No free part slots.");
  if (car.parts.some(p => p.id === partId)) return toast("Already fitted.");
  const p = byId(PARTS, partId);
  if (G.money < p.cost) return toast("Not enough money.");
  G.money -= p.cost;
  let q = 0.80 + Math.min(0.35, shopTech() / 340) + rnd(0, 0.08);
  if (auraTier) { const a = spendAura(auraTier); if (a) q += 0.05 * a.mult; }
  q = Math.min(1.3, q);
  car.parts.push({ id: partId, qual: q });
  sfx("ok");
  toast(esc(p.name) + " fitted — install quality " + Math.round(q * 100) + "%");
}
function removePart(car, idx) {
  car.parts.splice(idx, 1); G.rp += 4; toast("Part removed (+4 RP salvage).");
}
function repairCost(car) {
  const s = carStats(car);
  let c = Math.round((s.maxdur - car.dur) * 0.55 / (s.rep || 1));
  if (G.sponsors.some(x => x.id === "piggy" && x.filled)) c = Math.round(c / 2);
  return c;
}
function startRepair(slot) {
  const car = G.cars[slot]; if (!car) return;
  const cost = repairCost(car);
  if (G.repair) return toast("The crew is already repairing.");
  if (G.money < cost) return toast("Not enough money.");
  G.money -= cost;
  G.repair = { slot, wks: Math.max(1, Math.round(2 - shopTech() / 200)) };
  toast("Repairing — " + G.repair.wks + " week(s), " + fmtK(cost));
}
/* Is the next garage unlocked yet?

   It used to be the championship or nothing, and that is a trap: the
   garage caps how much crew you can carry, crew drive shop tech, shop tech
   drives build quality, and build quality is what wins a championship.  A
   team that cannot win the title cannot get the garage that would let it
   win the title, and the whole game is locked behind one race weekend.

   Winning the series is still the real route and still the fast one.  Piling
   up race wins is the slow one, so a run of bad luck in one championship
   costs you time rather than the rest of the game. */
const GARAGE_WIN_ROUTE = { rookie: 12, national: 30, cup: 55 };
function garageUnlocked(nx) {
  if (!nx || !nx.req) return true;
  if (G.seriesWon[nx.req]) return true;
  const need = GARAGE_WIN_ROUTE[nx.req];
  return need != null && G.stats.wins >= need;
}
function garageReqText(nx) {
  if (!nx || !nx.req) return "";
  const need = GARAGE_WIN_ROUTE[nx.req];
  return "Win the " + byId(SERIES, nx.req).n +
    (need != null ? ", or take " + need + " race wins (you have " + G.stats.wins + ")" : "");
}
function upgradeGarage() {
  const nx = GARAGES[G.garage + 1];
  if (!nx) return toast("Fully upgraded.");
  if (!garageUnlocked(nx)) return toast(garageReqText(nx) + ".");
  if (G.money < nx.cost) return toast("Not enough money.");
  G.money -= nx.cost; G.garage++;
  G.clearPts += 25;
  /* a new garage means a new team slot */
  while (G.teams.length < nx.teams) G.teams.push({ name: "Team " + (G.teams.length + 1), driver: -1, car: -1, crew: [] });
  sfx("win");
  dlg("Garage Upgraded!", "Welcome to the <span class='b'>" + nx.n + "</span>.<br>Crew " + nx.crew + " · Machines " + nx.cars + " · Teams " + nx.teams, [["Great", closeDlg]]);
}

/* ---------- training ---------- */
function doTraining(di, tid, auraTier) {
  const d = G.drivers[di], t = byId(TRAININGS, tid);
  if (G.money < t.c) return toast("Not enough money.");
  if (d.energy < t.e) return toast(esc(d.name) + " is too tired.");
  G.money -= t.c;
  const full = d.energy >= 96;
  d.energy -= t.e;
  let mult = full ? 1.5 : 1.0;
  if (auraTier) { const a = spendAura(auraTier); if (a) mult *= a.mult; }
  let rep = "";
  for (const k in t.fx) {
    const g = Math.max(1, Math.round(t.fx[k] * mult * rnd(0.85, 1.15)));
    d[k] += g;
    rep += ({ pd: "Pedal", sh: "Shift", st: "Steer", ap: "Appeal", tc: "Tech", an: "Analysis" }[k]) + " +" + g + "  ";
  }
  d.xp += 12; checkLevel(d);
  sfx("ok");
  toast("<span class='b'>" + t.n + "</span><br>" + rep + (full ? "<br><span class='g'>Full energy bonus!</span>" : ""));
}
function checkLevel(s) {
  while (s.xp >= s.lv * 100) {
    s.xp -= s.lv * 100; s.lv++;
    toast(esc(s.name) + " reached <span class='b'>Lv" + s.lv + "</span>!");
    if (s.lv % 4 === 0) grantAura(auraTierFor(s), "level milestone");
  }
}
function levelCrew(i) {
  const c = G.crew[i], cost = c.lv * 35;
  if (c.lv >= 5) return toast("Max level.");
  if (G.rp < cost) return toast("Need " + cost + " RP.");
  G.rp -= cost; c.lv++; c.tc += 3; c.an += 2; c.ap += 1;
  sfx("ok"); toast(esc(c.name) + " is now Lv" + c.lv);
}

/* ---------- save / load ---------- */
function saveGame() { try { localStorage.setItem(SAVEKEY, JSON.stringify(G)); saveLibrary(); return true; } catch (e) { return false; } }
function loadGame() {
  try {
    const s = localStorage.getItem(SAVEKEY); if (!s) return false;
    const o = JSON.parse(s); if (!o || o.v !== 2) return false;
    G = o; G.set.paused = false;
    if (!G.lib) G.lib = loadLibrary();
    if (!G.sponsorsFilled) G.sponsorsFilled = G.sponsors.filter(s => s.filled).map(s => s.id);
    if (!G.sponsorProgress) G.sponsorProgress = {};
    return true;
  } catch (e) { return false; }
}
function hasSave() { try { return !!localStorage.getItem(SAVEKEY); } catch (e) { return false; } }

/* ---------- endgame ---------- */
function finalScore() {
  const s = G.stats;
  const vt = Object.keys(G.lib.cars).length, pt = Object.keys(G.lib.parts).length;
  const score = Math.round(G.money * 0.3) + G.rp * 30 + s.wins * 2000 + s.titles * 15000 +
    vt * 2500 + pt * 1300 + s.upgrades * 320 + G.sponsors.length * 950 + Math.round(s.adTotal * 2);
  return { score, vt, pt };
}
