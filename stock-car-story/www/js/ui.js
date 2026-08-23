/* ============================================================
   UI — dialogs and every management screen
   ============================================================ */
"use strict";

const $ = id => document.getElementById(id);
let dlgStack = [], toastT = null;

/* ---------- audio ---------- */
let AC = null;
function sfx(kind) {
  if (!G || !G.set.sfx) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    const t = AC.currentTime;
    const seq = { click: [[660, .04, .035]], ok: [[520, .06, .05], [790, .08, .055]],
      cash: [[880, .05, .05], [1170, .09, .06], [1560, .1, .05]],
      bad: [[200, .16, .07]], aura: [[440, .05, .06], [660, .05, .06], [990, .14, .07]],
      go: [[392, .09, .07], [392, .09, .07], [523, .24, .09]],
      win: [[523, .1, .07], [659, .1, .07], [784, .1, .07], [1046, .3, .09]],
      yellow: [[494, .13, .06], [440, .16, .06]] }[kind] || [[660, .04, .035]];
    let dt = 0;
    for (const [f, d, g] of seq) {
      const o = AC.createOscillator(), v = AC.createGain();
      o.type = "square"; o.frequency.value = f;
      v.gain.setValueAtTime(g, t + dt);
      v.gain.exponentialRampToValueAtTime(.0008, t + dt + d);
      o.connect(v); v.connect(AC.destination);
      o.start(t + dt); o.stop(t + dt + d + .02); dt += d * .85;
    }
  } catch (e) {}
}

/* ---------- dialog ---------- */
function dlg(title, body, buttons) {
  const d = document.createElement("div");
  d.className = "dlg";
  d.innerHTML = "<div class='ttl'>" + title + "</div><div class='bd'>" + body + "</div>";
  const bt = document.createElement("div"); bt.className = "bt";
  for (const [lbl, fn] of (buttons || [["OK", closeDlg]])) {
    const b = document.createElement("button"); b.className = "pill"; b.innerHTML = lbl;
    b.onclick = () => { sfx("click"); fn(); };
    bt.appendChild(b);
  }
  d.appendChild(bt);
  $("dim").style.display = "block";
  $("app").appendChild(d);
  dlgStack.push(d);
  d.querySelector(".bd").scrollTop = 0;
  return d;
}
function closeDlg() { const d = dlgStack.pop(); if (d) d.remove(); if (!dlgStack.length) $("dim").style.display = "none"; }
function closeAllDlg() { while (dlgStack.length) closeDlg(); }
function toast(msg) {
  const t = $("toast"); t.innerHTML = msg; t.style.display = "block";
  clearTimeout(toastT); toastT = setTimeout(() => t.style.display = "none", 2800);
}

/* ---------- chrome ---------- */
function updateChrome() {
  if (!G) return;
  $("dateLcd").textContent = dateStr();
  $("moneyBox").textContent = fmtK(G.money);
  $("rpBox").textContent = "RP " + Math.floor(G.rp);
  $("fanBox").textContent = G.fans >= 10000 ? ((G.fans / 1000).toFixed(0) + "k") : G.fans >= 1000 ? ((G.fans / 1000).toFixed(1) + "k") : G.fans;
  const t = G.teams[G.curTeam], d = t && G.drivers[t.driver];
  $("drvPill").textContent = d ? d.name + " Lv" + d.lv : "— no driver —";
  $("clockPill").textContent = G.set.paused ? "❚❚" : G.set.speed === 2 ? "▶▶" : "▶";
}

/* ---------- little widgets ---------- */
function face(s, kind) {
  const sk = SKIN[s.face % 4], hr = HAIR[s.face % 8];
  const shirt = kind === "driver" ? "#e8332a" : "#2a55c8";
  return "<svg class='face' viewBox='0 0 8 10'>" +
    "<rect width='8' height='10' fill='#bcd9ff'/>" +
    "<rect x='1' y='6' width='6' height='4' fill='" + shirt + "'/>" +
    "<rect x='1' y='1' width='6' height='6' fill='" + sk + "'/>" +
    "<rect x='0' y='0' width='8' height='2' fill='" + hr + "'/>" +
    "<rect x='2' y='4' width='1' height='2' fill='#20232c'/>" +
    "<rect x='5' y='4' width='1' height='2' fill='#20232c'/></svg>";
}
function bar(pct, cls) { return "<div class='bar " + (cls || "") + "'><i style='width:" + clamp(pct, 0, 100) + "%'></i></div>"; }
function statGrid(o, keys) {
  let h = "<div class='sg'>";
  for (const [k, l] of keys) h += "<div>" + l + " <b>" + Math.floor(o[k]) + "</b></div>";
  return h + "</div>";
}
const DKEYS = [["pd", "Pedal"], ["sh", "Shift"], ["st", "Steer"], ["ap", "Appl"], ["tc", "Tech"], ["an", "Anlys"]];
const CKEYS = [["tc", "Tech"], ["ap", "Appl"], ["an", "Anlys"]];
function libTag(kind, id) {
  const e = libEntry(kind, id);
  return "<span class='chip lv'>Lv" + e.lv + " " + e.up + "%</span>";
}
function auraPicker(cb, verb) {
  if (!anyAura()) { cb(null); return; }
  const btns = [];
  for (const c of AURA_ORDER.slice().reverse())
    if (G.auras[c] > 0) btns.push(["<span style='color:" + AURAS[c].col + "'>" + AURAS[c].n + "</span> ×" + G.auras[c], () => { closeDlg(); cb(c); }]);
  btns.push(["No aura", () => { closeDlg(); cb(null); }]);
  dlg("Use an Aura?", "Spend an aura to boost this " + verb + "?<br><span class='small dim'>Stronger auras give a bigger result.</span>", btns);
}

/* ============================================================
   MAIN MENU
   ============================================================ */
function openMenu() {
  sfx("click");
  const items = [
    ["Team", "scrTeam", "👥"], ["Machines", "scrCars", "🏎"], ["Training", "scrTrain", "🏋"],
    ["Research", "scrResearch", "🔬"], ["Parts", "scrParts", "🔧"], ["Sponsors", "scrSponsors", "📣"],
    ["Enter Race", "scrRaces", "🏁"], ["Standings", "scrRecords", "🏆"],
    ["Auras", "scrAuras", "✨"], ["Options", "scrOptions", "⚙"]];
  const badge = (f) => {
    if (f === "scrRaces" && !SEASON) return "";
    if (f === "scrSponsors" && G.offers.length && G.sponsors.length < 2) return "<i class='dot'></i>";
    if (f === "scrResearch" && (availableCarBlueprints().length || availablePartBlueprints().length)) return "<i class='dot'></i>";
    if (f === "scrAuras" && anyAura()) return "<i class='dot'></i>";
    return "";
  };
  dlg("Menu", "<div class='mg'>" + items.map(([l, f, ic]) =>
    "<button class='pill mi' onclick='" + f + "()'><span class='ico'>" + ic + "</span>" + l + badge(f) + "</button>").join("") + "</div>",
    [["Close", closeDlg]]);
}

/* ============================================================
   TEAM
   ============================================================ */
function scrTeam() {
  closeAllDlg();
  const gl = GARAGES[G.garage];
  let h = "<div class='small dim'>" + gl.n + " · crew " + G.crew.length + "/" + gl.crew +
    " · machines " + G.cars.length + "/" + gl.cars + "</div>";
  h += "<h4>Drivers</h4>";
  G.drivers.forEach((d, i) => {
    const racing = G.teams.some(t => t.driver === i);
    h += "<div class='row' onclick='scrDriver(" + i + ")'>" + face(d, "driver") +
      "<div class='f1'><b class='b'>" + esc(d.name) + "</b> Lv" + d.lv +
      "<div class='small dim'>Pd" + d.pd + " Sh" + d.sh + " St" + d.st + " · " + fmtK(d.sal) + "/mo</div>" +
      bar(d.energy, "e") + "</div>" + (racing ? "<span class='chip gold'>RACE</span>" : "") + "</div>";
  });
  h += "<h4>Pit Crew</h4>";
  G.crew.forEach((c, i) => {
    h += "<div class='row' onclick='scrCrew(" + i + ")'>" + face(c, "crew") +
      "<div class='f1'><b class='b'>" + esc(c.name) + "</b> Lv" + c.lv + "/5" +
      "<div class='small dim'>Tech " + c.tc + " · Anl " + c.an + " · Appl " + c.ap + "</div></div>" +
      "<span class='chip'>" + fmtK(c.sal * (1 + (c.lv - 1) * 0.5)) + "</span></div>";
  });
  h += "<h4>Teams</h4>";
  G.teams.forEach((t, i) => {
    const d = G.drivers[t.driver], c = G.cars[t.car];
    h += "<div class='row' onclick='scrTeamEdit(" + i + ")'><div class='f1'><b>" + esc(t.name) + "</b>" +
      "<div class='small dim'>" + (d ? esc(d.name) : "no driver") + " · " + (c ? "#" + c.num + " " + esc(c.name) : "no machine") +
      " · " + t.crew.length + " crew</div></div>" + (i === G.curTeam ? "<span class='chip gold'>ACTIVE</span>" : "") + "</div>";
  });
  dlg("Team", h, [["Hire", scrHire], ["Back", () => { closeDlg(); openMenu(); }]]);
}
function scrDriver(i) {
  const d = G.drivers[i];
  const h = face(d, "driver") + " <b class='b'>" + esc(d.name) + "</b> Lv" + d.lv +
    "<div class='small dim'>Salary " + fmtK(d.sal) + "/mo · XP " + d.xp + "/" + (d.lv * 100) + " · Wins " + d.wins + "</div>" +
    "<div class='small' style='margin:5px 0'>Energy " + Math.floor(d.energy) + "/100</div>" + bar(d.energy, "e") +
    statGrid(d, DKEYS) +
    "<div class='small dim' style='margin-top:6px'>Aura tier at these stats: <b style='color:" +
    AURAS[auraTierFor(d)].col + "'>" + AURAS[auraTierFor(d)].n + "</b></div>";
  dlg("Driver", h, [
    ["Race this driver", () => { G.teams[G.curTeam].driver = i; updateChrome(); closeDlg(); scrTeam(); }],
    ["Train", () => { closeAllDlg(); scrTrain(i); }],
    ["Back", () => { closeDlg(); scrTeam(); }]]);
}
function scrCrew(i) {
  const c = G.crew[i], cost = c.lv * 35;
  const h = face(c, "crew") + " <b class='b'>" + esc(c.name) + "</b> Lv" + c.lv + "/5" +
    "<div class='small dim'>Salary " + fmtK(c.sal * (1 + (c.lv - 1) * 0.5)) + "/mo</div>" +
    statGrid(c, CKEYS) +
    "<div class='small' style='margin-top:6px'>Level up costs <b class='b'>" + cost + " RP</b><br>" +
    "<span class='dim'>Tech speeds builds, installs, repairs and pit stops. Analysis earns research data.</span></div>";
  dlg("Crew", h, [
    ["Level Up (" + cost + " RP)", () => { levelCrew(i); updateChrome(); closeDlg(); scrCrew(i); }],
    ["Back", () => { closeDlg(); scrTeam(); }]]);
}
function scrTeamEdit(i) {
  const t = G.teams[i];
  let h = "<b>" + esc(t.name) + "</b><h4>Driver</h4>";
  G.drivers.forEach((d, di) => {
    h += "<div class='row'><div class='f1'>" + esc(d.name) + " Lv" + d.lv + "</div>" +
      (t.driver === di ? "<span class='chip gold'>✓</span>" : "<button class='pill' onclick='setTeamDriver(" + i + "," + di + ")'>Pick</button>") + "</div>";
  });
  h += "<h4>Machine</h4>";
  G.cars.forEach((c, ci) => {
    h += "<div class='row'><div class='f1'>#" + c.num + " " + esc(c.name) + "</div>" +
      (t.car === ci ? "<span class='chip gold'>✓</span>" : "<button class='pill' onclick='setTeamCar(" + i + "," + ci + ")'>Pick</button>") + "</div>";
  });
  h += "<h4>Crew assigned</h4>";
  G.crew.forEach((c, ci) => {
    const on = t.crew.includes(ci);
    h += "<div class='row'><div class='f1'>" + esc(c.name) + " <span class='small dim'>T" + c.tc + "</span></div>" +
      "<button class='pill' onclick='toggleTeamCrew(" + i + "," + ci + ")'>" + (on ? "Remove" : "Add") + "</button></div>";
  });
  dlg("Team Setup", h, [["Make Active", () => { G.curTeam = i; updateChrome(); closeDlg(); scrTeam(); }],
    ["Back", () => { closeDlg(); scrTeam(); }]]);
}
function setTeamDriver(ti, di) { G.teams[ti].driver = di; closeDlg(); scrTeamEdit(ti); }
function setTeamCar(ti, ci) { G.teams[ti].car = ci; closeDlg(); scrTeamEdit(ti); }
function toggleTeamCrew(ti, ci) {
  const t = G.teams[ti];
  if (t.crew.includes(ci)) t.crew = t.crew.filter(x => x !== ci);
  else { G.teams.forEach(o => { o.crew = o.crew.filter(x => x !== ci); }); t.crew.push(ci); }
  closeDlg(); scrTeamEdit(ti);
}
function scrHire() {
  closeAllDlg();
  const gl = GARAGES[G.garage];
  const dAvail = DRIVERS.filter(d => !G.hiredNames.includes(d.n) && d.c <= Math.max(120, G.fans * 2.2));
  const cAvail = CREW.filter(c => !G.hiredNames.includes(c.n) && c.s * 22 <= Math.max(60, G.fans * 1.6));
  let h = "<h4>Drivers</h4>";
  if (!dAvail.length) h += "<div class='small dim'>No driver will take your call yet — build your reputation.</div>";
  dAvail.slice(0, 8).forEach(d => {
    h += "<div class='row'><div class='f1'><b class='b'>" + esc(d.n) + "</b>" +
      "<div class='small dim'>Pd" + d.pd + " Sh" + d.sh + " St" + d.st + " Ap" + d.ap + " Tc" + d.tc + " An" + d.an + "</div></div>" +
      "<button class='pill' onclick=\"doHire('d','" + esc(d.n) + "')\">" + fmtK(d.c) + "</button></div>";
  });
  h += "<h4>Crew (" + G.crew.length + "/" + gl.crew + ")</h4>";
  cAvail.slice(0, 8).forEach(c => {
    const full = G.crew.length >= gl.crew;
    h += "<div class='row'><div class='f1'><b class='b'>" + esc(c.n) + "</b>" +
      "<div class='small dim'>Tech " + c.tc + " · Anl " + c.an + " · Appl " + c.ap + " · " + fmtK(c.s) + "/mo</div></div>" +
      (full ? "<span class='chip'>FULL</span>" : "<button class='pill' onclick=\"doHire('c','" + esc(c.n) + "')\">" + fmtK(c.s * 20) + "</button>") + "</div>";
  });
  dlg("Hire", h, [["Back", () => { closeDlg(); scrTeam(); }]]);
}
function doHire(kind, name) {
  if (kind === "d") {
    const t = DRIVERS.find(x => x.n === name); if (!t) return;
    if (G.money < t.c) return toast("Not enough money.");
    G.money -= t.c; hireDriver(t);
  } else {
    const t = CREW.find(x => x.n === name); if (!t) return;
    const gl = GARAGES[G.garage];
    if (G.crew.length >= gl.crew) return toast("Crew is full.");
    const cost = Math.round(t.s * 20);
    if (G.money < cost) return toast("Not enough money.");
    G.money -= cost; hireCrew(t);
    G.teams[G.curTeam].crew.push(G.crew.length - 1);
  }
  sfx("ok"); updateChrome(); toast(esc(name) + " joins the team!");
  closeAllDlg(); scrTeam();
}

/* ============================================================
   TRAINING
   ============================================================ */
function scrTrain(di) {
  closeAllDlg();
  di = (di === undefined) ? G.teams[G.curTeam].driver : di;
  const d = G.drivers[di];
  if (!d) return toast("No driver.");
  let h = face(d, "driver") + " <b class='b'>" + esc(d.name) + "</b> Lv" + d.lv +
    "<div class='small dim'>Energy " + Math.floor(d.energy) + "/100 — training at full energy is 50% more effective.</div>" +
    bar(d.energy, "e") + "<h4>Programmes</h4>";
  TRAININGS.filter(t => G.known.trains.includes(t.id)).forEach(t => {
    const fx = Object.entries(t.fx).map(([k, v]) => ({ pd: "Pd", sh: "Sh", st: "St", ap: "Ap", tc: "Tc", an: "An" }[k]) + "+" + v).join(" ");
    const can = G.money >= t.c && d.energy >= t.e;
    h += "<div class='row'><div class='f1'><b>" + t.n + "</b>" +
      "<div class='small dim'>" + fx + " · " + fmtK(t.c) + " · EN " + t.e + "</div></div>" +
      "<button class='pill" + (can ? "" : " off") + "' onclick='pickTrain(" + di + ",\"" + t.id + "\")'>Go</button></div>";
  });
  dlg("Training", h, [["Back", () => { closeDlg(); openMenu(); }]]);
}
function pickTrain(di, tid) {
  const t = byId(TRAININGS, tid), d = G.drivers[di];
  if (G.money < t.c) return toast("Not enough money.");
  if (d.energy < t.e) return toast("Too tired — rest a few weeks.");
  auraPicker(a => { doTraining(di, tid, a); updateChrome(); closeAllDlg(); scrTrain(di); }, "training");
}

/* ============================================================
   MACHINES
   ============================================================ */
function carIcon(car) {
  return "<svg class='cicon' viewBox='0 0 16 9'><rect width='16' height='9' fill='#cfd8e6'/>" +
    "<rect x='1' y='2' width='14' height='5' rx='1' fill='" + carColor(car) + "'/>" +
    "<rect x='6' y='3' width='5' height='3' fill='#cfe8ff'/>" +
    "<rect x='2' y='1' width='3' height='1' fill='#1c1c22'/><rect x='11' y='1' width='3' height='1' fill='#1c1c22'/>" +
    "<rect x='2' y='7' width='3' height='1' fill='#1c1c22'/><rect x='11' y='7' width='3' height='1' fill='#1c1c22'/></svg>";
}
function scrCars() {
  closeAllDlg();
  const gl = GARAGES[G.garage];
  let h = "";
  G.cars.forEach((c, i) => {
    const s = carStats(c);
    h += "<div class='row' onclick='scrCar(" + i + ")'>" + carIcon(c) +
      "<div class='f1'><b class='b'>#" + c.num + " " + esc(c.name) + "</b> " + libTag("car", c.id) +
      "<div class='small dim'>Sp" + Math.floor(s.spd) + " Ac" + Math.floor(s.acc) + " Hd" + Math.floor(s.hdl) +
      " · parts " + c.parts.length + "/" + s.exp + "</div>" +
      bar(100 * c.dur / s.maxdur, c.dur < s.maxdur * .35 ? "d" : "") + "</div>" +
      (G.teams[G.curTeam].car === i ? "<span class='chip gold'>RACE</span>" : "") + "</div>";
  });
  if (G.build) h += "<div class='small b'>Building " + esc(byId(CARS, G.build.carId).name) + " — " + G.build.wks + " week(s) left</div>";
  if (G.repair) h += "<div class='small r'>Repairing — " + G.repair.wks + " week(s) left</div>";
  h += "<div class='small dim'>Garage slots " + G.cars.length + "/" + gl.cars + "</div>";
  dlg("Machines", h, [["Build New", scrBuild], ["Back", () => { closeDlg(); openMenu(); }]]);
}
function scrCar(i) {
  const car = G.cars[i], s = carStats(car), def = byId(CARS, car.id);
  let h = carIcon(car) + " <b class='b'>#" + car.num + " " + esc(car.name) + "</b> " + libTag("car", car.id) +
    "<div class='small dim'>Build quality " + Math.round(car.quality * 100) + "% · machine Lv" + car.lv + "</div>" +
    "<div class='sg' style='margin:6px 0'>" +
    "<div>Speed <b>" + Math.floor(s.spd) + "</b></div><div>Accel <b>" + Math.floor(s.acc) + "</b></div>" +
    "<div>Handling <b>" + Math.floor(s.hdl) + "</b></div>" +
    "<div>Durab. <b>" + car.dur + "/" + s.maxdur + "</b></div><div>Slots <b>" + car.parts.length + "/" + s.exp + "</b></div>" +
    "<div>Ad <b>" + Math.floor(s.ad) + "</b></div></div>" +
    "<h4>Track aptitude</h4><div class='small'>" +
    Object.keys(SURF).map(k => SURF[k].split(" ")[0] + " <b>" + (APT_SYM[def.apt[k]] || "○") + "</b>").join(" · ") + "</div>" +
    "<h4>Fitted parts</h4>";
  if (!car.parts.length) h += "<div class='small dim'>Nothing fitted — buy parts from the Parts screen.</div>";
  car.parts.forEach((p, pi) => {
    const pd = byId(PARTS, p.id);
    h += "<div class='row'><div class='f1'><b>" + pd.name + "</b> " + libTag("part", p.id) +
      "<div class='small dim'>install " + Math.round(p.qual * 100) + "% · " + pd.cat + "</div></div>" +
      "<button class='pill' onclick='rmPartUI(" + i + "," + pi + ")'>✕</button></div>";
  });
  const btns = [["Race this machine", () => { G.teams[G.curTeam].car = i; closeDlg(); scrCars(); }]];
  if (car.dur < s.maxdur) btns.push(["Repair " + fmtK(repairCost(car)), () => { startRepair(i); updateChrome(); closeAllDlg(); scrCars(); }]);
  btns.push(["Back", () => { closeDlg(); scrCars(); }]);
  dlg("Machine", h, btns);
}
function rmPartUI(ci, pi) { removePart(G.cars[ci], pi); updateChrome(); closeDlg(); scrCar(ci); }
function scrBuild() {
  closeAllDlg();
  if (G.build) return dlg("Build", "The crew is already building — " + G.build.wks + " week(s) left.", [["OK", () => { closeDlg(); scrCars(); }]]);
  const gl = GARAGES[G.garage];
  let h = "<div class='small dim'>Shop Tech " + Math.floor(shopTech()) + " sets build quality (100–160%). Library level raises the base stats permanently.</div>";
  CARS.filter(c => G.known.cars.includes(c.id)).forEach(c => {
    h += "<div class='row'><div class='f1'><b class='b'>" + c.name + "</b> " + libTag("car", c.id) +
      "<div class='small dim'>Sp" + c.spd + " Ac" + c.acc + " Hd" + c.hdl + " Dur" + c.dur + " · " + c.exp + " slots · " + fmtK(c.cost) + "</div></div>" +
      "<button class='pill' onclick=\"pickBuild('" + c.id + "')\">Build</button></div>";
  });
  dlg("Build Machine", h, [["Back", () => { closeDlg(); scrCars(); }]]);
}
function pickBuild(id) {
  const gl = GARAGES[G.garage];
  const full = G.cars.length >= gl.cars;
  const slot = full ? G.teams[G.curTeam].car : G.cars.length;
  const go = () => auraPicker(a => { startBuild(id, slot, a); updateChrome(); closeAllDlg(); scrCars(); }, "build");
  if (full) dlg("Garage Full", "This build will <span class='r'>replace</span> #" + G.cars[slot].num + " " + esc(G.cars[slot].name) + ".",
    [["Build anyway", () => { closeDlg(); go(); }], ["Cancel", closeDlg]]);
  else go();
}

/* ============================================================
   PARTS
   ============================================================ */
function scrParts() {
  closeAllDlg();
  const car = G.cars[G.teams[G.curTeam].car];
  if (!car) return dlg("Parts", "Pick a race machine first.", [["OK", closeDlg]]);
  const s = carStats(car);
  let h = "<div class='small'>Fitting to <b class='b'>#" + car.num + " " + esc(car.name) + "</b> — slots " + car.parts.length + "/" + s.exp + "</div>";
  let cat = "";
  PARTS.filter(p => G.known.parts.includes(p.id)).forEach(p => {
    if (p.cat !== cat) { cat = p.cat; h += "<h4>" + cat + "</h4>"; }
    const fx = Object.entries(p.fx).map(([k, v]) => k + (v > 0 ? "+" : "") + v).join(" ");
    const on = car.parts.some(x => x.id === p.id);
    h += "<div class='row'><div class='f1'><b>" + p.name + "</b> " + libTag("part", p.id) +
      "<div class='small dim'>" + fx + " · " + fmtK(p.cost) + "</div></div>" +
      (on ? "<span class='chip gold'>ON</span>" : "<button class='pill' onclick=\"pickInstall('" + p.id + "')\">Fit</button>") + "</div>";
  });
  if (!G.known.parts.length) h += "<div class='small dim'>No parts researched yet — visit Research.</div>";
  dlg("Parts", h, [["Back", () => { closeDlg(); openMenu(); }]]);
}
function pickInstall(pid) {
  const car = G.cars[G.teams[G.curTeam].car];
  const s = carStats(car);
  if (car.parts.length >= s.exp) return toast("No free slots — remove one first.");
  const p = byId(PARTS, pid);
  if (G.money < p.cost) return toast("Not enough money.");
  auraPicker(a => { installPart(car, pid, a); updateChrome(); closeAllDlg(); scrParts(); }, "installation");
}

/* ============================================================
   RESEARCH
   ============================================================ */
function scrResearch() {
  closeAllDlg();
  let h = "<div class='small dim'>Research data (RP) comes from racing — Analysis raises the rate.<br>You have <b class='b'>" + Math.floor(G.rp) + " RP</b>.</div>";
  h += "<h4>Upgrade library</h4><div class='small dim'>Upgrades are permanent and carry into New Game+.</div>";
  G.known.cars.forEach(id => {
    const c = byId(CARS, id), e = libEntry("car", id), cost = upgradeCost("car", id);
    const max = e.lv >= 6 && e.up >= 100;
    h += "<div class='row'><div class='f1'><b class='b'>" + c.name + "</b> " + libTag("car", id) +
      "<div class='small dim'>machine blueprint</div></div>" +
      (max ? "<span class='chip gold'>MAX</span>" : "<button class='pill' onclick=\"pickUpgrade('car','" + id + "')\">" + cost + " RP</button>") + "</div>";
  });
  G.known.parts.forEach(id => {
    const p = byId(PARTS, id), e = libEntry("part", id), cost = upgradeCost("part", id);
    const max = e.lv >= 6 && e.up >= 100;
    h += "<div class='row'><div class='f1'><b>" + p.name + "</b> " + libTag("part", id) +
      "<div class='small dim'>" + p.cat + "</div></div>" +
      (max ? "<span class='chip gold'>MAX</span>" : "<button class='pill' onclick=\"pickUpgrade('part','" + id + "')\">" + cost + " RP</button>") + "</div>";
  });
  const nc = availableCarBlueprints(), np = availablePartBlueprints();
  h += "<h4>New blueprints</h4>";
  if (!nc.length && !np.length) h += "<div class='small dim'>Nothing researchable right now — see the locked list below.</div>";
  nc.forEach(c => {
    h += "<div class='row'><div class='f1'><b class='b'>" + c.name + "</b> <span class='chip'>" + c.rank + "</span>" +
      "<div class='small dim'>Sp" + c.spd + " Ac" + c.acc + " Hd" + c.hdl + " · " + c.exp + " slots</div></div>" +
      "<button class='pill" + (G.rp < c.res ? " off" : "") + "' onclick=\"researchCar('" + c.id + "');updateChrome();closeAllDlg();scrResearch()\">" + c.res + " RP</button></div>";
  });
  np.forEach(p => {
    h += "<div class='row'><div class='f1'><b>" + p.name + "</b> <span class='chip'>" + p.rank + "</span>" +
      "<div class='small dim'>" + p.cat + " · " + Object.entries(p.fx).map(([k, v]) => k + (v > 0 ? "+" : "") + v).join(" ") + "</div></div>" +
      "<button class='pill" + (G.rp < p.res ? " off" : "") + "' onclick=\"researchPart('" + p.id + "');updateChrome();closeAllDlg();scrResearch()\">" + p.res + " RP</button></div>";
  });
  /* locked blueprints, with the requirement spelled out */
  const lockedC = CARS.filter(c => !G.known.cars.includes(c.id) && !condMet(c.unlock));
  const lockedP = PARTS.filter(p => !G.known.parts.includes(p.id) && !condMet(p.unlock));
  if (lockedC.length || lockedP.length) {
    h += "<h4>Locked</h4>";
    lockedC.forEach(c => {
      h += "<div class='row'><div class='f1'><b class='dim'>" + c.name + "</b> <span class='chip'>" + c.rank + "</span>" +
        "<div class='small dim'>" + unlockText(c.unlock) + "</div></div><span class='chip'>🔒</span></div>";
    });
    lockedP.forEach(p => {
      h += "<div class='row'><div class='f1'><b class='dim'>" + p.name + "</b> <span class='chip'>" + p.rank + "</span>" +
        "<div class='small dim'>" + unlockText(p.unlock) + "</div></div><span class='chip'>🔒</span></div>";
    });
  }
  /* garage */
  h += "<h4>Garage</h4>";
  const nx = GARAGES[G.garage + 1];
  if (!nx) h += "<div class='small g'>Fully upgraded.</div>";
  else {
    const locked = nx.req && !G.seriesWon[nx.req];
    h += "<div class='row'><div class='f1'><b class='b'>" + nx.n + "</b>" +
      "<div class='small dim'>" + nx.crew + " crew · " + nx.cars + " machines · " + nx.teams + " teams · " + fmtK(nx.cost) + "</div></div>" +
      (locked ? "<span class='chip'>Win " + byId(SERIES, nx.req).n + "</span>" :
        "<button class='pill' onclick='upgradeGarage();updateChrome();closeAllDlg();scrResearch()'>Buy</button>") + "</div>";
  }
  dlg("Research", h, [["Back", () => { closeDlg(); openMenu(); }]]);
}
/* human-readable unlock requirement */
function unlockText(u) {
  if (!u) return "Available";
  const carName = id => { const c = byId(CARS, id); return c ? c.name : id; };
  const partName = id => { const p = byId(PARTS, id); return p ? p.name : id; };
  switch (u.t) {
    case "start":   return "Available from the start";
    case "date":    return "From Year " + u.y + ", Month " + u.m;
    case "race":    return "Win at " + (byId(TRACKS, u.id) || { n: u.id }).n;
    case "sponsor": return "Fill the " + (byId(SPONSORS, u.id) || { n: u.id }).n + " ad gauge";
    case "garage":  return "Garage level " + u.lv;
    case "series":  return "Win the " + (byId(SERIES, u.id) || { n: u.id }).n;
    case "partUp":  return "Upgrade " + partName(u.id) + " to " + u.pct + "%";
    case "carUp":   return "Upgrade " + carName(u.id) + " to " + u.pct + "%";
    case "partUp2": return "Upgrade " + partName(u.a) + " and " + partName(u.b) + " to " + u.pct + "%";
    case "carUp2":  return "Upgrade " + carName(u.a) + " and " + carName(u.b) + " to " + u.pct + "%";
  }
  return "?";
}
function pickUpgrade(kind, id) {
  if (G.rp < upgradeCost(kind, id)) return toast("Not enough research data.");
  auraPicker(a => { doUpgrade(kind, id, a); updateChrome(); closeAllDlg(); scrResearch(); }, "upgrade");
}

/* ============================================================
   SPONSORS
   ============================================================ */
function scrSponsors() {
  closeAllDlg();
  let h = "<div class='small dim'>Two contracts at a time. They settle in M1 and M7 — advertising points earned by racing decide the payout, and filling a gauge unlocks its reward.<br>Ad points banked: <b class='b'>" + Math.floor(G.adPoints) + "</b></div>";
  h += "<h4>Signed (" + G.sponsors.length + "/2)</h4>";
  if (!G.sponsors.length) h += "<div class='small dim'>None. Sign one below.</div>";
  G.sponsors.forEach(s => {
    const sp = byId(SPONSORS, s.id);
    h += "<div class='row'><div class='f1'><b class='b'>" + esc(sp.n) + "</b>" + (s.filled ? " <span class='chip gold'>★</span>" : "") +
      "<div class='small dim'>" + Math.floor(s.ad) + "/" + sp.need + " ad · base " + fmtK(sp.base) + " · " + rewardText(sp) + "</div>" +
      bar(100 * s.ad / sp.need) + "</div>" +
      "<button class='pill' onclick=\"dropSponsor('" + s.id + "');closeAllDlg();scrSponsors()\">Drop</button></div>";
  });
  if (G.sponsorsFilled.length) {
    h += "<h4>Gauges completed (rewards kept forever)</h4>";
    G.sponsorsFilled.forEach(id => {
      const sp = byId(SPONSORS, id);
      h += "<div class='small'><span class='chip gold'>★</span> " + esc(sp.n) + " — " + rewardText(sp) + "</div>";
    });
  }
  h += "<h4>Offers</h4>";
  const offers = G.offers.filter(id => !G.sponsors.some(s => s.id === id));
  if (!offers.length) h += "<div class='small dim'>No offers yet — win races and grow your fanbase.</div>";
  offers.forEach(id => {
    const sp = byId(SPONSORS, id);
    h += "<div class='row'><div class='f1'><b>" + esc(sp.n) + "</b> <span class='chip'>" + sp.cat + "</span>" +
      "<div class='small dim'>base " + fmtK(sp.base) + " · gauge " + sp.need +
      (G.sponsorProgress[id] ? " (" + Math.floor(G.sponsorProgress[id]) + " banked)" : "") +
      " · reward " + rewardText(sp) + "</div></div>" +
      "<button class='pill" + (G.sponsors.length >= 2 ? " off" : "") + "' onclick=\"signSponsor('" + id + "');closeAllDlg();scrSponsors()\">Sign</button></div>";
  });
  dlg("Sponsors", h, [["Back", () => { closeDlg(); openMenu(); }]]);
}

/* ============================================================
   RACES
   ============================================================ */
function scrRaces() {
  closeAllDlg();
  const t = G.teams[G.curTeam];
  const car = G.cars[t.car], drv = G.drivers[t.driver];
  if (!car || !drv) return dlg("Race", "Assign a driver and a machine to your team first.", [["OK", closeDlg]]);
  const s = carStats(car);
  let h = "<div class='small'>" + esc(drv.name) + " · #" + car.num + " " + esc(car.name) +
    "<br><span class='dim'>Energy " + Math.floor(drv.energy) + " · Durability " + car.dur + "/" + s.maxdur + "</span></div>";
  if (car.dur < s.maxdur * 0.3) h += "<div class='small r'>⚠ The machine is badly damaged — repair before racing.</div>";
  if (SEASON) h += "<div class='small b'>Season in progress: " + SEASON.def.n + " (round " + (SEASON.round + 1) + "/" + SEASON.def.tracks.length + ")</div>";
  h += "<h4>Championships</h4>";
  SERIES.forEach(sd => {
    const ok = G.garage >= sd.req.garage;
    h += "<div class='row'><div class='f1'><b class='b'>" + sd.n + "</b>" + (G.seriesWon[sd.id] ? " <span class='chip gold'>WON</span>" : "") +
      "<div class='small dim'>" + sd.tracks.length + " rounds · entry " + fmtK(sd.fee) + " · champion " + fmtK(sd.purse[0]) + "</div></div>" +
      (SEASON ? "<span class='chip'>busy</span>" : ok ? "<button class='pill' onclick=\"startSeason('" + sd.id + "')\">Enter</button>" :
        "<span class='chip'>Garage " + sd.req.garage + "</span>") + "</div>";
  });
  h += "<h4>Single Races</h4>";
  TRACKS.forEach(tr => {
    if (!condMet(tr.unlock)) return;
    const tro = G.trophies[tr.id];
    h += "<div class='row'><div class='f1'><b class='b'>" + tr.n + "</b>" +
      (tro ? " " + (tro === 1 ? "🏆" : tro === 2 ? "🥈" : "🥉") : "") +
      "<div class='small dim'>" + SURF[tr.surf] + " · " + tr.mi.toFixed(2) + " mi · " + tr.laps + " laps · fee " + fmtK(tr.fee) + " · win " + fmtK(tr.prize[0]) + "</div>" +
      "<div class='small dim'>" + tr.desc + "</div></div>" +
      "<button class='pill' onclick=\"preRace('" + tr.id + "',null)\">Go</button></div>";
  });
  dlg("Enter Race", h, [["Back", () => { closeDlg(); openMenu(); }]]);
}
function preRace(trackId, season) {
  const tr = byId(TRACKS, trackId);
  const fee = season ? 0 : tr.fee;
  if (G.money < fee) return toast("Can't afford the entry fee.");
  /* warn before starting on a machine that probably won't survive */
  const pcar = G.cars[G.teams[G.curTeam].car];
  if (pcar && !preRace._ok) {
    const st = carStats(pcar), frac = pcar.dur / st.maxdur;
    if (frac < 0.35) {
      return dlg("Machine is damaged",
        "#" + pcar.num + " " + esc(pcar.name) + " is at <span class='r'>" + Math.round(frac * 100) +
        "% durability</span>. It will very likely blow up before the finish.<br><span class='small dim'>Repairing costs " +
        fmtK(repairCost(pcar)) + " and takes a week or two.</span>",
        [["Race anyway", () => { closeDlg(); preRace._ok = 1; preRace(trackId, season); preRace._ok = 0; }],
         ["Repair first", () => { closeDlg(); startRepair(G.teams[G.curTeam].car); updateChrome(); }],
         ["Cancel", () => { closeDlg(); if (!season) scrRaces(); }]]);
    }
  }
  const go = auraTier => {
    G.money -= fee; updateChrome(); closeAllDlg();
    enterRaceMode();
    startRace(tr, season, auraTier);
  };
  const h = "<b class='b'>" + tr.n + "</b><div class='small dim'>" + SURF[tr.surf] + " · " + tr.mi.toFixed(2) +
    " mi · " + tr.laps + " laps" + (season ? "" : " · fee " + fmtK(fee)) + "<br>" + tr.desc + "</div>";
  const btns = [];
  if (anyAura()) {
    for (const c of AURA_ORDER.slice().reverse())
      if (G.auras[c] > 0) btns.push(["Bring <span style='color:" + AURAS[c].col + "'>" + AURAS[c].n + "</span>", () => { G.auras[c]--; go(c); }]);
    btns.push(["No aura", () => go(null)]);
  } else btns.push(["Start!", () => go(null)]);
  if (!season) btns.push(["Cancel", () => { closeDlg(); scrRaces(); }]);
  dlg(season ? "Round " + (season.round + 1) : "Race Entry", h, btns);
}

/* ============================================================
   RECORDS / AURAS / OPTIONS
   ============================================================ */
function scrRecords() {
  closeAllDlg();
  const s = G.stats;
  let h = "<table class='t'>" +
    "<tr><td>Races</td><td><b>" + s.races + "</b></td><td>Wins</td><td><b>" + s.wins + "</b></td></tr>" +
    "<tr><td>Podiums</td><td><b>" + s.podiums + "</b></td><td>Titles</td><td><b>" + s.titles + "</b></td></tr>" +
    "<tr><td>Purse</td><td><b>" + fmtK(s.earned) + "</b></td><td>Upgrades</td><td><b>" + s.upgrades + "</b></td></tr>" +
    "<tr><td>Fans</td><td><b>" + G.fans + "</b></td><td>Clear Pts</td><td><b>" + G.clearPts + "</b></td></tr></table>";
  h += "<h4>Track bests</h4>";
  let any = false;
  TRACKS.forEach(t => {
    const p = G.trophies[t.id]; if (!p) return; any = true;
    h += "<div class='small'>" + (p === 1 ? "🏆" : p === 2 ? "🥈" : "🥉") + " " + t.n + " — best " + ord(p) + "</div>";
  });
  if (!any) h += "<div class='small dim'>No podiums yet.</div>";
  h += "<h4>Championships</h4>";
  SERIES.forEach(sd => { if (G.seriesWon[sd.id]) h += "<div class='small b'>🏆 " + sd.n + " Champion</div>"; });
  if (!G.stats.titles) h += "<div class='small dim'>No titles yet.</div>";
  if (G.log.length) {
    h += "<h4>Shop diary</h4>";
    G.log.slice(-6).reverse().forEach(l => h += "<div class='small dim'>Y" + l.y + " M" + l.m + " — " + esc(l.t) + "</div>");
  }
  dlg("Records", h, [["Back", () => { closeDlg(); openMenu(); }]]);
}
function scrAuras() {
  closeAllDlg();
  let h = "<div class='small dim'>Auras are one-shot boosts. Spend them on a race, a build, a part install, an upgrade or a training session.</div>";
  for (const c of AURA_ORDER) {
    const a = AURAS[c];
    h += "<div class='row'><span class='chip' style='background:" + a.col + "'>" + a.n + "</span>" +
      "<div class='f1 small'>work ×" + a.mult + " · race +" + Math.round((a.boost - 1) * 100) + "% for " + a.dur + "s</div>" +
      "<b>×" + G.auras[c] + "</b></div>";
  }
  const d = G.drivers[G.teams[G.curTeam].driver];
  if (d) h += "<div class='small' style='margin-top:6px'>" + esc(d.name) + " currently earns <b style='color:" +
    AURAS[auraTierFor(d)].col + "'>" + AURAS[auraTierFor(d)].n + "</b> auras. Raise their stats for better ones.</div>";
  h += "<div class='small dim' style='margin-top:5px'>Earned by: a first-time podium at a track, winning a championship, driver level milestones, and the occasional test session.</div>";
  dlg("Auras", h, [["Back", () => { closeDlg(); openMenu(); }]]);
}
function scrOptions() {
  closeAllDlg();
  const sc = finalScore();
  dlg("Options",
    "<div class='row'><div class='f1'>Sound effects</div><button class='pill' onclick='G.set.sfx=!G.set.sfx;closeAllDlg();scrOptions()'>" + (G.set.sfx ? "ON" : "OFF") + "</button></div>" +
    "<div class='row'><div class='f1'>Save now</div><button class='pill' onclick='toast(saveGame()?\"Saved.\":\"Save failed.\")'>Save</button></div>" +
    "<div class='row'><div class='f1'>Current score</div><b>" + sc.score.toLocaleString() + "</b></div>" +
    "<div class='row'><div class='f1 small'>Library: " + sc.vt + " machines, " + sc.pt + " parts developed</div></div>" +
    "<div class='row'><div class='f1'>Restart (keep library)</div><button class='pill' onclick='confirmRestart(true)'>New+</button></div>" +
    "<div class='row'><div class='f1'>Wipe everything</div><button class='pill' onclick='confirmRestart(false)'>Wipe</button></div>" +
    "<div class='small dim' style='margin-top:6px'>Stock Car Story — an original management sim in the classic Japanese pixel-sim tradition. Art and code are original work.</div>",
    [["Back", () => { closeDlg(); openMenu(); }]]);
}
function confirmRestart(keepLib) {
  dlg(keepLib ? "New Game+" : "Wipe Save",
    keepLib ? "Start a fresh career keeping every machine and part level you've developed." :
      "Erase the save <i>and</i> the developed library. This cannot be undone.",
    [["Do it", () => {
      if (!keepLib) { try { localStorage.removeItem(LIBKEY); } catch (e) {} }
      try { localStorage.removeItem(SAVEKEY); } catch (e) {}
      location.reload();
    }], ["Cancel", closeDlg]]);
}
function showEndgame() {
  const r = finalScore();
  dlg("Year 14 — The Final Season",
    "<div class='bigwin'>FINAL SCORE</div><div class='score'>" + r.score.toLocaleString() + "</div>" +
    "<table class='t'>" +
    "<tr><td>Funds</td><td>" + fmtK(G.money) + "</td></tr>" +
    "<tr><td>Race wins</td><td>" + G.stats.wins + "</td></tr>" +
    "<tr><td>Championships</td><td>" + G.stats.titles + "</td></tr>" +
    "<tr><td>Machines developed</td><td>" + r.vt + "</td></tr>" +
    "<tr><td>Parts developed</td><td>" + r.pt + "</td></tr>" +
    "<tr><td>Upgrades</td><td>" + G.stats.upgrades + "</td></tr>" +
    "<tr><td>Total advertising</td><td>" + Math.round(G.stats.adTotal) + "</td></tr></table>" +
    "<div class='small dim' style='margin-top:6px'>Keep playing as long as you like — or start New Game+ from Options to carry your whole library into a fresh career.</div>",
    [["Keep racing", closeDlg]]);
}
