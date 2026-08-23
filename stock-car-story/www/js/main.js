/* ============================================================
   MAIN — boot, game loop, input
   ============================================================ */
"use strict";

let MODE = "title";        // title | shop | race
let weekAcc = 0, lastT = 0;

function enterRaceMode() {
  MODE = "race";
  $("objCard").classList.remove("on");
  $("tabbar").style.display = "none";
  $("speedBtn").classList.remove("on");
  $("order").classList.add("on");
  $("raceHud").style.display = "flex";
  $("auraBtn").style.display = "none";
}
function exitRaceMode() {
  MODE = "shop";
  $("tabbar").style.display = "flex";
  $("speedBtn").classList.add("on");
  $("order").classList.remove("on");
  $("raceHud").style.display = "none";
}

function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
  lastT = ts; frame++;

  if (MODE === "title") {
    $("tabbar").style.display = "none"; $("speedBtn").classList.remove("on");
    drawTitle(); return;
  }
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
      refreshObjective();
      if (!G.ended && G.year === 14 && G.month === 4) { G.ended = true; showEndgame(); }
    }
  }
  drawGarage();
  if (frame % 20 === 0) refreshObjective();
}

function updateRaceHud() {
  const me = R.field[0];
  const pos = playerPos();
  $("posBadge").textContent = "P" + pos;
  $("lapBox").innerHTML = "LAP " + Math.min(me.lap + 1, R.laps) + "/" + R.laps +
    "<div class='hb2'><span>T</span><i style='width:" + Math.round(me.tyreLife) + "%'></i></div>" +
    "<div class='hb2 f'><span>F</span><i style='width:" + Math.round(me.fuel) + "%'></i></div>";
  $("spdBox").textContent = Math.round(me.v * MPH) + " mph";
  /* pit button state */
  const pb = $("pitBtn");
  pb.classList.toggle("armed", pitArmed());
  pb.firstChild.textContent = pitArmed() ? "BOX" : "PIT";
  pb.querySelector("span").textContent = pitArmed() ? "this lap" : "call stop";
  pb.disabled = R.phase !== "green";

  /* running order: the three ahead, you, and the one behind */
  const ord = raceOrder();
  const mi = ord.indexOf(me);
  const from = clamp(mi - 3, 0, Math.max(0, ord.length - 5));
  const slice = ord.slice(from, from + 5);
  $("order").innerHTML = slice.map((c, i) =>
    "<div class='o" + (c.isP ? " me" : "") + "'><b>" + (from + i + 1) + "</b>" +
    "<i style='background:" + c.col + "'></i><span>" + esc(c.name.split(" ")[0]) + "</span></div>").join("");

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
  $("tabbar").style.display = "flex";
  $("speedBtn").classList.add("on");
  updateChrome();
  refreshObjective();
  if (!G.seenIntro) {
    G.seenIntro = true;
    dlg("Welcome, boss",
      "Pop's old <b class='b'>Backyard Garage</b> is yours — one tired Street Stocker, rookie driver " +
      "<b class='b'>Rusty Axles</b>, and <b class='b'>Gus Grease</b> on the wrenches.<br><br>" +
      "<span class='small'>· The <b class='b'>card at the top</b> always tells you what to do next — tap its button.<br>" +
      "· The <b class='b'>tabs</b> along the bottom are Team, Machines, Race, Develop and More.<br>" +
      "· <b class='b'>▶ SPEED</b> at the bottom-left runs the calendar; tap it to go faster or pause.<br>" +
      "· Tap things in the shop — the car, the crew, the banner — to open their screen.<br><br>" +
      "Before a race you pick <b>tyres and fuel</b>, and during it you call your own <b>pit stops</b>.</span>",
      [["Let's go racing", () => { closeDlg(); refreshObjective(); }]]);
  }
}

function boot() {
  initRender();

  const tab = (id, fn) => { $(id).onclick = () => { if (MODE !== "shop") return; sfx("click"); fn(); }; };
  tab("tabTeam", scrTeam); tab("tabCars", scrCars); tab("tabRace", scrRaces);
  tab("tabShop", scrDevelop); tab("tabMore", openMenu);
  $("speedBtn").onclick = () => {
    if (!G) return; sfx("click");
    if (G.set.paused) { G.set.paused = false; G.set.speed = 1; }
    else if (G.set.speed === 1) G.set.speed = 2;
    else { G.set.speed = 1; G.set.paused = true; }
    updateChrome();
  };
  $("auraBtn").onclick = fireAura;
  $("pitBtn").onclick = () => {
    if (!R || R.phase !== "green") return;
    sfx("click");
    if (pitArmed()) { cancelPit(); return; }
    dlg("Pit stop", "<div class='small'>What do you want done? A tyres-only or fuel-only stop is quicker " +
      "than taking both.</div>",
      [["Tyres", () => { closeAllDlg(); callPit("tyres"); }],
       ["Fuel", () => { closeAllDlg(); callPit("fuel"); }],
       ["Both", () => { closeAllDlg(); callPit("both"); }],
       ["Stay out", () => closeAllDlg()]]);
  };
  /* tapping the shop scene itself opens the matching screen */
  const canvasTap = ev => {
    if (MODE !== "shop" || dlgStack.length) return;
    const r = cv.getBoundingClientRect();
    const t = ev.changedTouches ? ev.changedTouches[0] : ev;
    const action = hitHotspot(t.clientX - r.left, t.clientY - r.top);
    if (action && window[action]) { sfx("click"); window[action](); }
  };
  $("scene").addEventListener("click", canvasTap);
  document.addEventListener("visibilitychange", () => { if (document.hidden && G && MODE === "shop") saveGame(); });
  window.addEventListener("pagehide", () => { if (G && MODE === "shop") saveGame(); });
  titleScreen();
  requestAnimationFrame(loop);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
    navigator.serviceWorker.register("sw.js").catch(() => {});
}
window.addEventListener("load", boot);
