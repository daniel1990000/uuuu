/* ============================================================
   UI — dialogs and every management screen
   ============================================================ */
"use strict";

const $ = id => document.getElementById(id);
let dlgStack = [], toastT = null;

/* ---------- audio ---------- */
let AC = null;
/* A short burst of noise, shaped.  Square waves are fine for a menu blip
   but nothing made of tone sounds like sheet metal hitting a wall, so the
   impacts are filtered noise instead. */
let NOISE_BUF = null;
function noiseBuffer() {
  if (NOISE_BUF) return NOISE_BUF;
  const n = Math.floor(AC.sampleRate * 1.2);
  NOISE_BUF = AC.createBuffer(1, n, AC.sampleRate);
  const d = NOISE_BUF.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return NOISE_BUF;
}
function noiseHit(when, dur, gain, freq, q, type, slideTo) {
  const src = AC.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const f = AC.createBiquadFilter();
  f.type = type || "bandpass";
  f.frequency.setValueAtTime(freq, when);
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
  f.Q.value = q || 1;
  const v = AC.createGain();
  v.gain.setValueAtTime(0.0001, when);
  v.gain.exponentialRampToValueAtTime(gain, when + Math.min(0.012, dur * 0.2));
  v.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(f); f.connect(v); v.connect(AC.destination);
  src.start(when); src.stop(when + dur + 0.02);
}
/* a low body thump under an impact, so it has weight */
function thump(when, dur, gain, f0, f1) {
  const o = AC.createOscillator(), v = AC.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), when + dur);
  v.gain.setValueAtTime(gain, when);
  v.gain.exponentialRampToValueAtTime(0.0008, when + dur);
  o.connect(v); v.connect(AC.destination);
  o.start(when); o.stop(when + dur + 0.02);
}

function sfx(kind) {
  if (!G || !G.set.sfx) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    const t = AC.currentTime;

    /* the noise-based ones */
    if (kind === "crash" || kind === "bigcrash") {
      const big = kind === "bigcrash";
      thump(t, big ? 0.55 : 0.34, big ? 0.55 : 0.34, big ? 150 : 190, 32);
      noiseHit(t, big ? 0.42 : 0.26, big ? 0.42 : 0.28, 2200, 0.7, "bandpass", 500);
      noiseHit(t + 0.05, big ? 0.7 : 0.4, big ? 0.3 : 0.18, 900, 1.4, "bandpass", 240);
      if (big) {                                  // secondary hits: cars piling in
        noiseHit(t + 0.20, 0.30, 0.26, 1700, 0.8, "bandpass", 420);
        thump(t + 0.22, 0.34, 0.34, 130, 30);
        noiseHit(t + 0.44, 0.26, 0.18, 1400, 0.9, "bandpass", 380);
      }
      return;
    }
    if (kind === "scrape") {                      // along the wall
      noiseHit(t, 0.5, 0.16, 3200, 6, "bandpass", 2100);
      return;
    }
    if (kind === "squeal") {                      // locked tyres
      const o = AC.createOscillator(), v = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
      o.type = "sawtooth"; o.frequency.value = 1250;
      lfo.frequency.value = 26; lg.gain.value = 90;
      lfo.connect(lg); lg.connect(o.frequency);
      v.gain.setValueAtTime(0.0001, t);
      v.gain.exponentialRampToValueAtTime(0.10, t + 0.05);
      v.gain.exponentialRampToValueAtTime(0.0008, t + 0.55);
      const f = AC.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 5;
      o.connect(f); f.connect(v); v.connect(AC.destination);
      o.start(t); lfo.start(t); o.stop(t + 0.58); lfo.stop(t + 0.58);
      return;
    }

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
  d.innerHTML = "<div class='ttl'>" + title + "<button class='x' aria-label='Close'>✕</button></div>" +
    "<div class='bd'>" + body + "</div>";
  const bt = document.createElement("div"); bt.className = "bt";
  for (const [lbl, fn] of (buttons || [["OK", closeDlg]])) {
    const b = document.createElement("button"); b.className = "pill"; b.innerHTML = lbl;
    b.onclick = () => { sfx("click"); fn(); };
    bt.appendChild(b);
  }
  d.appendChild(bt);
  $("dim").style.display = "block";
  $("sceneWrap").appendChild(d);
  dlgStack.push(d);
  /* lets the toast drop below a sheet's title bar instead of sitting on it */
  $("app").classList.add("sheeting");
  d.querySelector(".x").onclick = () => { sfx("click"); closeAllDlg(); };
  d.querySelector(".bd").scrollTop = 0;
  return d;
}
function closeDlg() {
  const d = dlgStack.pop(); if (d) d.remove();
  if (!dlgStack.length) {
    $("dim").style.display = "none";
    $("app").classList.remove("sheeting");
    if (typeof refreshObjective === "function") refreshObjective();
  }
}
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
  $("rpBox").textContent = "\uD83C\uDFC6 " + (G.stats ? G.stats.wins : 0);
  $("fanBox").textContent = G.fans >= 10000 ? ((G.fans / 1000).toFixed(0) + "k") : G.fans >= 1000 ? ((G.fans / 1000).toFixed(1) + "k") : G.fans;
  const paused = !!G.set.paused, spd = G.set.speed || 1;
  const sp = $("speedBtn");
  if (sp) {
    sp.classList.toggle("paused", paused);
    sp.querySelector(".ico").textContent = paused ? "\u275a\u275a" : spd === 3 ? "\u25b6\u25b6\u25b6" : spd === 2 ? "\u25b6\u25b6" : "\u25b6";
    sp.querySelector(".lbl").textContent = paused ? "PAUSED" : spd + "\u00d7 SPEED";
  }
  const rs = $("raceSpeedBtn");
  if (rs) {
    rs.textContent = paused ? "❚❚" : spd + "×";
    rs.classList.toggle("fast", !paused && spd > 1);
    rs.classList.toggle("paused", paused);
  }
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
function libTag(kind, id) { return ""; }
function libTag_unused(kind, id) {
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
function scrHelp() {
  closeAllDlg();
  dlg("How to play",
    "<h4>The loop</h4><div class='small'>Race for prize money and fans. Money buys everything: " +
    "parts from the shop, machines, staff and a bigger garage. There is one currency and one shop. " +
    "Win a championship to earn a bigger garage, then move up the ladder.</div>" +
    "<h4>Getting around</h4><div class='small'>The <b class='b'>card at the top</b> always says what to do next — " +
    "tap its button. The <b class='b'>tabs</b> along the bottom are your five screens. " +
    "<b class='b'>▶ SPEED</b> at the bottom-left runs the calendar; tap it to go 1×, 2×, 3× or pause. " +
    "You can also tap the car, the crew, the banner or the bench in the shop.</div>" +
    "<h4>Race day</h4><div class='small'>Pick your <b>tyres</b> (grip against wear) before the flag. " +
    "During the race the <b class='b'>PIT</b> button calls your stop — tyres, fuel or both. A partial " +
    "stop is quicker, and stopping under caution costs about half the time. If you never call one, the " +
    "When a stop becomes the right call the game asks you once; nobody pits for you. Stay out and you " +
    "keep the position, but bald tyres are slow and an empty tank is slower still.</div>" +
    "<h4>Driving modes</h4><div class='small'>The button beside PIT switches between " +
    "<b>\u25B2 Push</b>, <b>\u25CF Normal</b> and <b>\u25BC Conserve</b>, any lap you like. Push is real " +
    "lap time, but it eats tyres and fuel and it is how you end up in the fence. Conserve gives track " +
    "position back and can save you a whole stop. Nothing is free.</div>" +
    "<h4>Wrecks</h4><div class='small'>Worn tyres, running hard, running beside someone and the load a " +
    "corner puts through the car all build toward a mistake. Most get caught. Some are a slide worth a " +
    "couple of seconds. The bad ones are the fence — and a heavy one collects whoever was close behind, " +
    "which is where a big wreck comes from. Damage stays with you for the rest of the race.</div>" +
    "<h4>Auras</h4><div class='small'>One-shot boosts earned from first podiums, titles and driver levels. " +
    "Spend them on a race, a build, a part fitting, an upgrade or a training session — " +
    "the upgrade is usually the best value because it is permanent.</div>" +
    "<h4>Durability</h4><div class='small'>A machine loses about a fifth of its durability per race. " +
    "Repair it before it blows up — the objective card will tell you when.</div>" +
    "<h4>Reading the numbers</h4><div class='small'>Drivers: <b>Pd</b> pedal (throttle down the straights), " +
    "<b>Sh</b> shift (getting off the corner) and <b>St</b> steer (holding a line). " +
    "Short tracks lean on steer, superspeedways on pedal.<br>" +
    "Everyone also carries <b>Ap</b> appeal, <b>Tc</b> tech and <b>An</b> analysis: appeal pulls fans and " +
    "sponsors, tech decides how well the shop builds a machine, and analysis brings in extra prize money. " +
    "Crew count triple on those three, drivers only half — so hire crew for the shop, drivers for the track.<br>" +
    "Machines: <b>Sp</b> top speed, <b>Ac</b> acceleration, <b>Hd</b> handling.</div>",
    [["Got it", () => closeAllDlg()]]);
}
function saveNow() {
  sfx("click");
  toast(saveGame() ? "Game saved." : "Save failed — storage is blocked.");
  closeAllDlg();
}
function openMenu() {
  sfx("click");
  /* The tab bar already covers Team, Machines, Race and Develop, so this
     holds only what has nowhere else to live. */
  const items = [
    ["Training", "scrTrain", "🏋"], ["Sponsors", "scrSponsors", "📣"],
    ["Records", "scrRecords", "🏆"], ["Auras", "scrAuras", "✨"],
    ["How to play", "scrHelp", "❓"], ["Save Game", "saveNow", "💾"],
    ["Options", "scrOptions", "⚙"]];
  const badge = (f) => {
    if (f === "scrSponsors" && G.offers.length && G.sponsors.length < 2) return "<i class='dot'></i>";
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
  dlg("Team", h, [["Hire", scrHire], ["Close", () => closeAllDlg()]]);
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
    "<div class='small' style='margin-top:6px'>Level up costs <b class='g'>" + fmtK(cost) + "</b><br>" +
    "<span class='dim'>Tech speeds builds, installs, repairs and pit stops. Analysis brings in extra prize money.</span></div>";
  dlg("Crew", h, [
    ["Level Up (" + fmtK(cost) + ")", () => { levelCrew(i); updateChrome(); closeDlg(); scrCrew(i); }],
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
  dlg("Training", h, [["Close", () => closeAllDlg()]]);
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
  dlg("Machines", h, [["\uD83D\uDED2 Buy a machine", () => { closeAllDlg(); scrShop("cars"); }], ["Close", () => closeAllDlg()]]);
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
function scrBuild() { return scrShop("cars"); }
function scrBuild_unused() {
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
function scrParts() { return scrDevelop(); }
function scrParts_unused() {
  closeAllDlg();
  const car = G.cars[G.teams[G.curTeam].car];
  if (!car) return dlg("Parts", "<div class='small'>Pick a race machine first.</div>", [["Close", () => closeAllDlg()]]);
  const s = carStats(car);

  let h = "<div class='row'>" + carIcon(car) + "<div class='f1'><b class='b'>#" + car.num + " " + esc(car.name) +
    "</b> " + libTag("car", car.id) + "<div class='small dim'>Sp" + Math.floor(s.spd) + " Ac" + Math.floor(s.acc) +
    " Hd" + Math.floor(s.hdl) + "</div></div></div>";

  /* the slots, drawn as boxes so it is obvious what is empty */
  h += "<h4>Part slots " + car.parts.length + "/" + s.exp + "</h4><div class='slots'>";
  for (let i = 0; i < s.exp; i++) {
    const p = car.parts[i];
    if (p) {
      const pd = byId(PARTS, p.id);
      h += "<div class='slot on' onclick='rmPartUI(" + G.teams[G.curTeam].car + "," + i + ")'>" +
        "<b>" + pd.name.split(" ")[0] + "</b><span>" + pd.cat + "</span><span class='dim'>tap ✕</span></div>";
    } else h += "<div class='slot'><b>EMPTY</b><span>fit a part</span></div>";
  }
  h += "</div>";
  if (car.parts.length >= s.exp)
    h += "<div class='small r' style='margin-top:6px'>All slots full — tap a slot to remove that part, or build a machine with more slots.</div>";

  /* everything on the shelf, grouped by category */
  const owned = PARTS.filter(p => G.known.parts.includes(p.id));
  let cat = "";
  if (!owned.length) h += "<h4>Nothing on the shelf</h4><div class='small dim'>Buy parts in the Shop.</div>";
  owned.forEach(p => {
    if (p.cat !== cat) { cat = p.cat; h += "<h4>" + cat + "</h4>"; }
    const on = car.parts.some(x => x.id === p.id);
    const e = libEntry("part", p.id);
    const fx = fxText(p.fx) + (p.note ? " · " + p.note : "");
    const canPay = G.money >= partCostUI(p);
    h += "<div class='row'><span class='chip rank'>" + p.rank + "</span>" +
      "<div class='f1'><b>" + p.name + "</b> <span class='chip lv'>Lv" + e.lv + "</span>" +
      "<div class='small dim'>" + esc(p.desc || "") + "</div>" +
      "<div class='small'>" + fx + "</div>" +
      "<div class='small'>" + fmtK(partCostUI(p)) + "</div></div>" +
      (on ? "<span class='chip gold'>FITTED</span>"
        : "<button class='pill" + (canPay && car.parts.length < s.exp ? "" : " off") +
          "' onclick=\"pickInstall('" + p.id + "')\">Fit</button>") + "</div>";
  });
  dlg("Parts", h, [["Close", () => closeAllDlg()]]);
}
/* Fit a part to the machine currently entered.  The button in the parts
   list has always called this; it was never written, so the whole game
   threw "pickInstall is not defined" the moment anyone tapped Fit. */
function pickInstall(id) {
  const car = G.cars[G.teams[G.curTeam].car];
  if (!car) return toast("No machine to fit it to.");
  auraPicker(a => { installPart(car, id, a); updateChrome(); closeAllDlg(); scrDevelop(); }, "part fitting");
}
/* Part effects in words, so the list reads without a legend. */
const FX_NAME = { spd: "Speed", acc: "Accel", hdl: "Handling", dur: "Durability",
  short: "Short track", mid: "Intermediate", ss: "Superspeedway", road: "Road course",
  street: "Street circuit",
  pit: "Pit speed", fuel: "Fuel range", ad: "Advertising" };
function fxText(fx) {
  return Object.entries(fx).map(([k, v]) =>
    "<b class='" + (v > 0 ? "g" : "r") + "'>" + (v > 0 ? "+" : "") + v + "</b> " + (FX_NAME[k] || k)
  ).join(" · ");
}

/* the sponsor perk that discounts parts is applied here */
function partCostUI(p) {
  let c = p.cost;
  if ((G.sponsorsFilled || []).includes("spon_betterbuy")) c *= 0.9;
  return Math.round(c);
}

/* ============================================================
   SHOP
   ============================================================ */
let SEG_RES = "car";
function segBar(opts, cur, fn) {
  return "<div class='seg'>" + opts.map(([k, l]) =>
    "<button class='" + (k === cur ? "on" : "") + "' onclick=\"" + fn + "('" + k + "')\">" + l + "</button>").join("") + "</div>";
}
function setResSeg(k) { SEG_RES = k; scrResearch(); }

/* ============================================================
   SHOP — one screen, one currency.

   This was Research: race data was a second currency, spent in its own
   screen, to learn blueprints you then paid money for a second time, with
   a library level and an upgrade percentage on top.  Four ideas to buy a
   set of tyres.  You buy parts with money now and they go on a shelf.
   ============================================================ */
function scrResearch() { scrShop(); }
function scrShop(tab) {
  closeAllDlg();
  SHOP_TAB = tab || SHOP_TAB || "parts";
  const t = G.teams[G.curTeam];
  const car = G.cars[t.car];
  let h = "<div class='small dim'>Money <b class='g'>" + fmtK(G.money) + "</b> \u00b7 career wins <b>" +
    (G.stats ? G.stats.wins : 0) + "</b> \u00b7 shop tech <b>" + Math.floor(shopTech()) + "</b></div>";
  h += segBar([["parts", "Parts"], ["cars", "Machines"], ["garage", "Garage"]], SHOP_TAB, "scrShop");

  if (SHOP_TAB === "parts") {
    const stock = shopParts();
    h += "<h4>On the shelf</h4>";
    let cat = "";
    stock.forEach(p => {
      if (p.cat !== cat) { cat = p.cat; h += "<h4>" + cat + "</h4>"; }
      const own = invCount(p.id);
      const fitted = car && car.parts.some(x => x.id === p.id);
      h += "<div class='row'><span class='chip rank'>" + p.rank + "</span><div class='f1'><b>" +
        esc(p.name) + "</b>" + (own ? " <span class='chip gold'>" + own + " in stock</span>" : "") +
        (fitted ? " <span class='chip'>fitted</span>" : "") +
        "<div class='small dim'>" + esc(p.desc || "") + "</div>" +
        "<div class='small'>" + fxText(p.fx) + "</div></div>" +
        "<button class='pill" + (G.money >= p.cost ? "" : " off") +
        "' onclick=\"buyPart('" + p.id + "');scrShop('parts')\">" + fmtK(p.cost) + "</button></div>";
    });
    /* what is still to come, so the shelf never looks finished */
    const later = PARTS.filter(p => !condMet(p.unlock) && p.unlock.t === "wins")
      .sort((a, b) => a.unlock.n - b.unlock.n).slice(0, 3);
    if (later.length) {
      h += "<h4>Coming in</h4>";
      later.forEach(p => {
        h += "<div class='row'><span class='chip rank'>" + p.rank + "</span><div class='f1'><b class='dim'>" +
          esc(p.name) + "</b><div class='small dim'>" + fxText(p.fx) + "</div></div>" +
          "<span class='chip'>\uD83D\uDD12 " + p.unlock.n + " wins</span></div>";
      });
    }
  } else if (SHOP_TAB === "cars") {
    h += "<h4>Machines for sale</h4>";
    if (G.build) h += "<div class='small dim'>The crew is building \u2014 " + G.build.wks + " to go.</div>";
    shopCars().forEach(c => {
      h += "<div class='row'><span class='chip rank'>" + c.rank + "</span><div class='f1'><b class='b'>" +
        esc(c.name) + "</b><div class='small dim'>Sp" + c.spd + " Ac" + c.acc + " Hd" + c.hdl +
        " Dur" + c.dur + " \u00b7 " + c.exp + " part slots</div></div>" +
        "<button class='pill" + (G.money >= c.cost && !G.build ? "" : " off") +
        "' onclick=\"pickBuild('" + c.id + "')\">" + fmtK(c.cost) + "</button></div>";
    });
    const later = CARS.filter(c => !condMet(c.unlock) && c.unlock.t === "wins")
      .sort((a, b) => a.unlock.n - b.unlock.n).slice(0, 3);
    if (later.length) {
      h += "<h4>Coming in</h4>";
      later.forEach(c => h += "<div class='row'><div class='f1'><b class='dim'>" + esc(c.name) +
        "</b><div class='small dim'>Sp" + c.spd + " Ac" + c.acc + " Hd" + c.hdl + "</div></div>" +
        "<span class='chip'>\uD83D\uDD12 " + c.unlock.n + " wins</span></div>");
    }
  } else {
    const gl = GARAGES[G.garage];
    h += "<h4>Current: " + gl.n + "</h4><div class='small dim'>Crew " + G.crew.length + "/" + gl.crew +
      " \u00b7 machines " + G.cars.length + "/" + gl.cars + " \u00b7 teams " + G.teams.length + "/" + gl.teams + "</div>";
    const nx = GARAGES[G.garage + 1];
    if (!nx) h += "<h4>Fully upgraded</h4><div class='small g'>Nothing left to build.</div>";
    else {
      const locked = !garageUnlocked(nx);
      h += "<h4>Next</h4><div class='row'><div class='f1'><b class='b'>" + nx.n + "</b>" +
        "<div class='small dim'>" + nx.crew + " crew \u00b7 " + nx.cars + " machines \u00b7 " + nx.teams + " teams</div>" +
        "<div class='small'>Cost " + fmtK(nx.cost) + "</div></div>" +
        (locked ? "<div class='small r' style='max-width:44%'>\uD83D\uDD12 " + garageReqText(nx) + "</div>"
          : "<button class='pill" + (G.money < nx.cost ? " off" : "") +
            "' onclick='upgradeGarage();updateChrome();scrShop(\"garage\")'>Buy</button>") + "</div>";
    }
  }
  dlg("Shop", h, [["Close", () => closeAllDlg()]]);
}
let SHOP_TAB = "parts";

function doResearchUI(kind, id) {
  if (kind === "car") researchCar(id); else researchPart(id);
  updateChrome(); scrResearch();
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
  if (G.money < upgradeCost(kind, id)) return toast("Not enough money.");
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
  dlg("Sponsors", h, [["Close", () => closeAllDlg()]]);
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
        "<span class='chip'>\uD83D\uDD12 Needs Garage " + sd.req.garage + "</span>") + "</div>";
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
  dlg("Enter Race", h, [["Close", () => closeAllDlg()]]);
}
function preRace(trackId, season) {
  const tr = byId(TRACKS, trackId);
  const fee = season ? 0 : tr.fee;
  if (G.money < fee) return toast("Can't afford the entry fee.");
  const pcar = G.cars[G.teams[G.curTeam].car];
  if (pcar && !preRace._ok) {
    const st = carStats(pcar), frac = pcar.dur / st.maxdur;
    if (frac < 0.35) {
      return dlg("Machine is damaged",
        "<div class='small'>#" + pcar.num + " " + esc(pcar.name) + " is at <b class='r'>" + Math.round(frac * 100) +
        "% durability</b>. It will very likely blow up before the finish.<br><br>Repairing costs " +
        fmtK(repairCost(pcar)) + " and takes a week or two.</div>",
        [["Race anyway", () => { closeDlg(); preRace._ok = 1; preRace(trackId, season); preRace._ok = 0; }],
         ["Repair first", () => { closeAllDlg(); startRepair(G.teams[G.curTeam].car); updateChrome(); }],
         ["Cancel", () => { closeAllDlg(); }]]);
    }
  }
  scrStrategy(tr, season, fee);
}

/* The strategy sheet: pick rubber and fuel, then choose an aura. */
function scrStrategy(tr, season, fee) {
  SCR_TR = tr; SCR_SE = season; SCR_FEE = fee;
  closeAllDlg();
  const t = G.teams[G.curTeam];
  const car = G.cars[t.car], drv = G.drivers[t.driver];
  const st = carStats(car);
  let h = "<div class='row'>" + carIcon(car) + "<div class='f1'><b class='b'>" + tr.n + "</b>" +
    "<div class='small dim'>" + SURF[tr.surf] + " · " + tr.mi.toFixed(2) + " mi · " + tr.laps + " laps" +
    (season ? "" : " · entry " + fmtK(fee)) + "</div>" +
    "<div class='small'>" + esc(tr.desc) + "</div></div></div>";
  h += "<div class='small dim'>" + esc(drv.name) + " · energy " + Math.floor(drv.energy) +
    "/100 · machine " + car.dur + "/" + st.maxdur + "</div>";

  h += "<h4>Tyres</h4>" + segBar(Object.keys(TYRES).map(k => [k, TYRES[k].n]), STRAT.tyre, "setTyre");
  h += "<div class='small dim'>" + TYRES[STRAT.tyre].desc + "</div>";
  h += "<h4>Starting mode</h4>" +
    segBar(MODE_ORDER.map(k => [k, MODES[k].ico + " " + MODES[k].n]), STRAT.mode, "setMode");
  h += "<div class='small dim'>" + MODES[STRAT.mode].desc +
    " You can change this any time during the race.</div>";

  /* aura is part of the same decision, not a second button */
  if (anyAura()) {
    const opts = [["none", "None"]];
    for (const c of AURA_ORDER) if (G.auras[c] > 0) opts.push([c, AURAS[c].n + " ×" + G.auras[c]]);
    if (!opts.some(o => o[0] === STRAT.aura)) STRAT.aura = "none";
    h += "<h4>Aura</h4>" + segBar(opts, STRAT.aura || "none", "setAura");
    h += "<div class='small dim'>" + (STRAT.aura && STRAT.aura !== "none"
      ? "Spends one " + AURAS[STRAT.aura].n + " aura for a burst of speed you trigger yourself, worth +" +
        Math.round((AURAS[STRAT.aura].boost - 1) * 100) + "% for " + AURAS[STRAT.aura].dur + " seconds."
      : "Save your auras for training, builds and upgrades.") + "</div>";
  }
  h += "<h4>What it costs to run</h4><div class='row'><div class='f1'>" +
    "<div class='small'>Entry fee <b>" + fmtK(fee) + "</b></div>" +
    "<div class='small'>Crew and driver wages <b>" + fmtK(teamWages()) + "</b></div>" +
    "<div class='small dim'>Wages are charged per race, not per month — sitting in the shop is free.</div>" +
    "</div><span class='chip" + (G.money >= fee + teamWages() ? " gold" : " r") + "'>" +
    fmtK(fee + teamWages()) + "</span></div>";
  h += "<div class='small' style='margin-top:10px'>You call your own stops with the <b class='b'>PIT</b> " +
    "button during the race — tyres, fuel or both. Stopping under caution costs about half the time.</div>";

  const go = () => {
    const a = (STRAT.aura && STRAT.aura !== "none" && G.auras[STRAT.aura] > 0) ? STRAT.aura : null;
    if (a) G.auras[a]--;
    /* entry fee plus a race weekend's wages — the roster is paid for
       turning up, not for the calendar turning over */
    G.money -= fee + teamWages(); updateChrome(); closeAllDlg();
    if (G.money < 0) checkBankrupt();
    enterRaceMode();
    startRace(tr, season, a);
  };
  const btns = [["🏁 START RACE", go]];
  if (!season) btns.push(["Cancel", () => { closeAllDlg(); scrRaces(); }]);
  dlg(season ? "Round " + (season.round + 1) : "Race strategy", h, btns);
}
function setAura(k) { STRAT.aura = k; scrStrategy(SCR_TR, SCR_SE, SCR_FEE); }
function setTyre(k) { STRAT.tyre = k; scrStrategy(SCR_TR, SCR_SE, SCR_FEE); }
function setMode(k) { STRAT.mode = k; scrStrategy(SCR_TR, SCR_SE, SCR_FEE); }
/* Change the mode mid-race from the HUD. */
function cycleMode() {
  if (!R || R.phase !== "green") return;
  const me = R.field[0];
  if (me.done || me.dnf) return;
  const i = MODE_ORDER.indexOf(me.mode);
  me.mode = MODE_ORDER[(i + 1) % MODE_ORDER.length];
  STRAT.mode = me.mode;
  sfx("click");
  banner(MODES[me.mode].n.toUpperCase(), 1.1);
  updateRaceHud();
}
let SCR_TR = null, SCR_SE = null, SCR_FEE = 0;

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
  dlg("Records", h, [["Close", () => closeAllDlg()]]);
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
  dlg("Auras", h, [["Close", () => closeAllDlg()]]);
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
    [["Close", () => closeAllDlg()]]);
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

/* ============================================================
   NEXT STEP — the game always says what to do and offers the
   one button that does it.  This is the difference between a
   simulation and something a person can actually play.
   ============================================================ */
function nextStep() {
  const t = G.teams[G.curTeam];
  const car = G.cars[t.car], drv = G.drivers[t.driver];

  if (!drv) return { t: "Your team has no driver. Pick one from <b>Team</b>.", b: "Team", f: scrTeam };
  if (!car) return { t: "Your team has no machine. Pick one from <b>Machines</b>.", b: "Machines", f: scrCars };

  const st = carStats(car);
  if (G.repair) return { t: "The crew is repairing the machine — <b>" + G.repair.wks + " week(s)</b> left. Let the clock run.", b: "Wait", f: () => { G.set.paused = false; updateChrome(); } };
  if (car.dur < st.maxdur * 0.35)
    return { t: "#" + car.num + " is <b>badly damaged</b> and will blow up mid-race. Repair it first.", b: "Repair", f: () => { startRepair(t.car); updateChrome(); } };

  if (SEASON) {
    const tr = byId(TRACKS, SEASON.def.tracks[SEASON.round]);
    return { t: SEASON.def.n + " — <b>round " + (SEASON.round + 1) + "</b> at " + tr.n + ".", b: "Race", f: () => nextSeasonRace() };
  }
  if (!G.stats.races)
    return { t: "Time to go racing. Enter <b>Pine Ridge Bullring</b> and see where you stand.", b: "Race", f: scrRaces };

  if (G.offers.length && G.sponsors.length < 2)
    return { t: "A sponsor wants your car. Signing pays twice a year and unlocks new gear.", b: "Sponsors", f: scrSponsors };

  if (drv.energy < 40)
    return { t: esc(drv.name) + " is worn out (" + Math.floor(drv.energy) + "/100). Rest a few weeks before racing.", b: "Wait", f: () => { G.set.paused = false; updateChrome(); } };

  const nc = shopCars().filter(c => G.money >= c.cost && !G.cars.some(x => x.id === c.id));
  const np = shopParts().filter(p => G.money >= p.cost && !invCount(p.id));
  if (nc.length || np.length)
    return { t: "The shop has <b>" + ((nc[0] || np[0]).name) + "</b> in stock and you can afford it.", b: "Shop", f: () => scrShop(nc[0] ? "cars" : "parts") };

  if (car.parts.length < st.exp && G.known.parts.some(id => G.money >= byId(PARTS, id).cost))
    return { t: "#" + car.num + " has an <b>empty part slot</b>. Fitting a part makes it faster.", b: "Parts", f: scrParts };

  const gl = GARAGES[G.garage + 1];
  if (gl && (!gl.req || G.seriesWon[gl.req]) && G.money >= gl.cost)
    return { t: "You can afford the <b>" + gl.n + "</b> \u2014 more crew, more machines, more teams.", b: "Upgrade", f: () => scrShop("garage") };

  const trainable = TRAININGS.filter(x => G.known.trains.includes(x.id) && G.money >= x.c && drv.energy >= x.e);
  if (trainable.length && G.money > 200)
    return { t: "Train " + esc(drv.name) + " — better stats win more races and earn better auras.", b: "Train", f: () => scrTrain(t.driver) };

  const sd = SERIES.filter(s => G.garage >= s.req.garage && !G.seriesWon[s.id] && G.money >= s.fee).pop();
  if (sd) return { t: "Enter the <b>" + sd.n + "</b> — winning it unlocks a bigger garage.", b: "Enter", f: scrRaces };

  return { t: "Pick a race and go earn some money.", b: "Race", f: scrRaces };
}

function refreshObjective() {
  if (!G || MODE !== "shop") { $("objCard").classList.remove("on"); return; }
  if (dlgStack.length) { $("objCard").classList.remove("on"); return; }
  const s = nextStep();
  $("objText").innerHTML = s.t;
  $("objBtn").textContent = s.b;
  $("objBtn").onclick = () => { sfx("click"); s.f(); };
  $("objCard").classList.add("on");
  /* badge the tabs that have something waiting */
  const badge = (id, on) => {
    const el = $(id); if (!el) return;
    let d = el.querySelector("i.dot");
    if (on && !d) { d = document.createElement("i"); d.className = "dot"; el.appendChild(d); }
    else if (!on && d) d.remove();
  };
  badge("tabShop", shopParts().some(p => G.money >= p.cost && !invCount(p.id)));
  badge("tabRace", !!SEASON);
  badge("tabMore", G.offers.length > 0 && G.sponsors.length < 2);
  badge("tabTeam", anyAura());
}

/* the shop screen groups the development tools in one place */
/* ============================================================
   WORKSHOP — one screen for everything you do to the machine.

   This was a menu of four buttons that each opened another screen:
   Research, Parts, Build, Training.  Four taps to change a tyre, and no
   screen ever showed you the machine you were changing.  The work now
   happens here, next to the car it applies to: what is fitted, what you
   could fit, and what you could build instead.  Research keeps its own
   screen because it is the one place you spend a different currency, and
   Training moved out because it is about the driver, not the car.
   ============================================================ */
function scrDevelop() {
  closeAllDlg();
  const t = G.teams[G.curTeam];
  const car = G.cars[t.car];
  let h = "<div class='small dim'>Money <b class='g'>" + fmtK(G.money) +
    "</b> \u00b7 shop tech <b>" + Math.floor(shopTech()) + "</b> \u00b7 shelf <b>" +
    ((G.inv || []).length) + " part(s)</b></div>";

  if (G.build) {
    h += "<h4>In build</h4><div class='row'><div class='f1'><b class='b'>" +
      esc(byId(CARS, G.build.carId).name) + "</b><div class='small dim'>" +
      G.build.wks + " week(s) left</div></div></div>";
  }

  /* ---- the machine, and its slots ---- */
  if (car) {
    const s2 = carStats(car);
    h += "<h4>Race machine</h4><div class='row'>" + carIcon(car) +
      "<div class='f1'><b class='b'>#" + car.num + " " + esc(car.name) + "</b> " + libTag("car", car.id) +
      "<div class='small dim'>Sp" + Math.floor(s2.spd) + " Ac" + Math.floor(s2.acc) +
      " Hd" + Math.floor(s2.hdl) + " · condition " + Math.round(100 * car.dur / s2.maxdur) + "%</div>" +
      bar(100 * car.dur / s2.maxdur, car.dur < s2.maxdur * 0.35 ? "d" : "") + "</div></div>";
    if (car.dur < s2.maxdur * 0.9) {
      h += "<div class='row'><div class='f1'><b>Repair the machine</b>" +
        "<div class='small dim'>Back to full condition, " +
        Math.max(1, Math.round(2 - shopTech() / 200)) + " week(s) in the shop</div></div>" +
        "<button class='pill" + (G.money >= repairCost(car) && !G.repair ? "" : " off") +
        "' onclick='startRepair(" + t.car + ");scrDevelop()'>" + fmtK(repairCost(car)) + "</button></div>";
    }

    /* fitted parts, removable in place */
    h += "<h4>Parts fitted " + car.parts.length + "/" + s2.exp + "</h4>";
    if (!car.parts.length) h += "<div class='small dim'>Nothing fitted yet.</div>";
    car.parts.forEach((pp, i) => {
      const pd = byId(PARTS, pp.id);
      if (!pd) return;
      h += "<div class='row'><span class='chip rank'>" + pd.rank + "</span><div class='f1'><b>" +
        esc(pd.name) + "</b><div class='small'>" + fxText(pd.fx) + "</div>" +
        "<div class='small dim'>install quality " + Math.round(pp.qual * 100) + "%</div></div>" +
        "<button class='pill' onclick='removePart(G.cars[" + t.car + "]," + i + ");scrDevelop()'>Remove</button></div>";
    });

    /* everything you own that would go on it */
    /* the shelf: parts you own and have not bolted on */
    const shelfIds = [...new Set((G.inv || []).map(x => x.id))]
      .filter(id => !car.parts.some(x => x.id === id));
    if (car.parts.length < s2.exp && shelfIds.length) {
      h += "<h4>On the shelf</h4>";
      shelfIds.forEach(id => {
        const p = byId(PARTS, id);
        if (!p) return;
        h += "<div class='row'><span class='chip rank'>" + p.rank + "</span><div class='f1'><b>" +
          esc(p.name) + "</b> <span class='chip gold'>" + invCount(id) + "</span>" +
          "<div class='small'>" + fxText(p.fx) + "</div></div>" +
          "<button class='pill' onclick=\"pickInstall('" + id + "')\">Fit</button></div>";
      });
    } else if (car.parts.length < s2.exp) {
      h += "<div class='small dim' style='margin-top:6px'>Nothing on the shelf. Buy parts in the Shop.</div>";
    } else if (car.parts.length >= s2.exp) {
      h += "<div class='small dim' style='margin-top:6px'>Every slot on this machine is full. A better " +
        "chassis carries more.</div>";
    }
  } else {
    h += "<h4>No machine</h4><div class='small dim'>Build one below to go racing.</div>";
  }

  dlg("Workshop", h, [["\uD83D\uDED2 Shop", () => { closeAllDlg(); scrShop("parts"); }],
                      ["Close", () => closeAllDlg()]]);
}
