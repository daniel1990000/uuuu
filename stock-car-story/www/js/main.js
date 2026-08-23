/* ============================================================
   MAIN — boot, game loop, input
   ============================================================ */
"use strict";

let MODE = "title";        // title | shop | race
let weekAcc = 0, lastT = 0;

function enterRaceMode() {
  MODE = "race";
  $("raceHud").style.display = "flex";
  $("auraBtn").style.display = "none";
  $("botbar").classList.add("racing");
}
function exitRaceMode() {
  MODE = "shop";
  $("raceHud").style.display = "none";
  $("botbar").classList.remove("racing");
}

function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
  lastT = ts; frame++;

  if (MODE === "title") { drawTitle(); return; }
  if (!G) return;

  if (MODE === "race") {
    if (R && !dlgStack.length) raceTick(dt);
    if (R) { drawRace(); updateRaceHud(); }
    else drawGarage();
    return;
  }
  /* shop: time flows unless a dialog is open or the player paused */
  if (!dlgStack.length && !G.set.paused) {
    weekAcc += dt * (G.set.speed === 2 ? 2.2 : 1);
    if (weekAcc >= 1.5) {
      weekAcc = 0;
      advanceWeek();
      updateChrome();
      if (!G.ended && G.year === 14 && G.month === 4) { G.ended = true; showEndgame(); }
    }
  }
  drawGarage();
}

function updateRaceHud() {
  const me = R.field[0];
  const pos = playerPos();
  $("posBadge").textContent = "P" + pos;
  $("lapBox").innerHTML = "LAP " + Math.min(me.lap + 1, R.laps) + "/" + R.laps +
    "<br><span class='hs'>T" + Math.round(me.tyre) + " F" + Math.round(me.fuel) + "</span>";
  $("spdBox").textContent = Math.round(me.v * MPH) + " mph";
  const btn = $("auraBtn");
  if (R.auraTier && R.auraLeft > 0) {
    btn.style.display = "block";
    btn.disabled = R.phase !== "green";
    btn.style.background = "linear-gradient(" + AURAS[R.auraTier].col + ",#c98a00)";
  } else btn.style.display = "none";
}

/* ---------- boot ---------- */
function titleScreen() {
  MODE = "title";
  const btns = [];
  if (hasSave()) btns.push(["Continue", () => { closeDlg(); if (loadGame()) startShop(); else { newGame(false); startShop(); } }]);
  btns.push([hasSave() ? "New Game" : "Start Career", () => {
    closeDlg();
    if (hasSave()) dlg("Start over?", "Your current career will be overwritten.<br><span class='small dim'>Your developed machine and part library is kept.</span>",
      [["Yes", () => { closeDlg(); newGame(true); startShop(); }], ["Cancel", () => { closeDlg(); titleScreen(); }]]);
    else { newGame(true); startShop(); }
  }]);
  const lib = loadLibrary();
  const libN = Object.keys(lib.cars || {}).length + Object.keys(lib.parts || {}).length;
  dlg("STOCK CAR STORY",
    "<div style='text-align:center;line-height:1.9'>🏁<br>Hire drivers. Build machines.<br>Chase the championship.<br>" +
    "<span class='small dim'>Ovals, dirt, superspeedways and road courses.</span>" +
    (libN > 1 ? "<br><span class='small g'>Library: " + libN + " developed designs carry over</span>" : "") + "</div>",
    btns);
}
function startShop() {
  MODE = "shop";
  updateChrome();
  if (!G.seenIntro) {
    G.seenIntro = true;
    dlg("Welcome, boss",
      "Pop's old <b class='b'>Backyard Garage</b> is yours — one tired Street Stocker, rookie driver " +
      "<b class='b'>Rusty Axles</b>, and <b class='b'>Gus Grease</b> on the wrenches.<br><br>" +
      "<span class='small'>· <b>Race</b> for purse money, fans and research data<br>" +
      "· <b>Train</b> your driver and <b>upgrade</b> the machine<br>" +
      "· <b>Sponsors</b> pay twice a year and unlock new gear<br>" +
      "· Win a championship to earn a bigger garage</span>",
      [["Let's go racing", () => { closeDlg(); openMenu(); }]]);
  }
}

function boot() {
  initRender();
  $("menuBtn").onclick = () => { if (MODE === "shop") openMenu(); };
  $("saveBtn").onclick = () => { if (MODE !== "shop") return; sfx("click"); toast(saveGame() ? "Game saved." : "Save failed — storage blocked."); };
  $("drvPill").onclick = () => { if (MODE === "shop" && G && G.drivers.length) scrDriver(G.teams[G.curTeam].driver); };
  $("clockPill").onclick = () => {
    if (!G) return; sfx("click");
    if (G.set.paused) { G.set.paused = false; G.set.speed = 1; }
    else if (G.set.speed === 1) G.set.speed = 2;
    else { G.set.speed = 1; G.set.paused = true; }
    updateChrome();
  };
  $("auraBtn").onclick = fireAura;
  document.addEventListener("visibilitychange", () => { if (document.hidden && G && MODE === "shop") saveGame(); });
  window.addEventListener("pagehide", () => { if (G && MODE === "shop") saveGame(); });
  titleScreen();
  requestAnimationFrame(loop);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
    navigator.serviceWorker.register("sw.js").catch(() => {});
}
window.addEventListener("load", boot);
