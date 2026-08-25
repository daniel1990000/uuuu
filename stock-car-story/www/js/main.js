/* ============================================================
   MAIN — boot, game loop, input
   ============================================================ */
"use strict";

let MODE = "title";        // title | shop | race
let weekAcc = 0, lastT = 0;
/* How fast the calendar runs at each setting.  Not linear on purpose —
   3x is for skipping a quiet stretch between races, so it is allowed to
   run a little hotter than three times one. */
const SPEED_MUL = { 1: 1, 2: 2.2, 3: 3.6 };

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

/* One draw failure used to mean a black screen forever: the frame threw,
   nothing was painted, and the next frame threw in the same place.  Now
   the first failure is reported on screen with its message, so a phone
   that cannot run something says so instead of going dark. */
let LOOP_ERR = 0;
function fatal(where, e) {
  if (LOOP_ERR++) return;
  const msg = (e && (e.message || e)) + "";
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;inset:0;z-index:99;background:#0d1638;color:#fff;" +
    "font:12px/1.7 monospace;padding:18px;overflow:auto;-webkit-user-select:text;user-select:text";
  d.innerHTML = "<b style='color:#ffd23f'>Stock Car Story hit a problem</b><br><br>" +
    "<b>where:</b> " + where + "<br><b>error:</b> " + msg.replace(/</g, "&lt;") +
    "<br><br><span style='color:#9aa4bd'>Screenshot this and send it over — it says exactly " +
    "what your browser could not do.</span>";
  document.body.appendChild(d);
}
window.addEventListener("error", e => fatal("script", e.error || e.message));

function loop(ts) {
  requestAnimationFrame(loop);
  if (LOOP_ERR) return;
  const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
  lastT = ts; frame++;

  if (MODE === "title") {
    $("tabbar").style.display = "none"; $("speedBtn").classList.remove("on");
    try { drawTitle(); } catch (e) { fatal("title screen", e); }
    return;
  }
  if (!G) return;

  if (MODE === "race") {
    try {
      /* Run the simulation N times at the normal step instead of once at
         N times the step.  Feeding raceTick a triple-length dt would let
         cars pass through each other between frames; stepping keeps every
         overtake and every contact resolved exactly as it is at 1x. */
      if (R && !dlgStack.length && !G.set.paused) {
        const steps = clamp(G.set.speed | 0, 1, 3);
        for (let i = 0; i < steps && R; i++) raceTick(dt);
      }
      if (R) { drawRace(); updateRaceHud(); }
      else drawGarage();
    } catch (e) { fatal("race", e); }
    return;
  }
  /* shop: time flows unless a dialog is open or the player paused */
  if (!dlgStack.length && !G.set.paused) {
    weekAcc += dt * (SPEED_MUL[G.set.speed] || 1);
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
    "<span class='small dim'>Short tracks, superspeedways, road courses and street circuits.</span>" +
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

/* Pin the app to the viewport we can actually see.

   dvh is the right unit but it is not everywhere yet, and on a phone the
   difference is not cosmetic: vh is measured as though the address bar
   were hidden, so a vh-sized layout runs off the bottom of the screen and
   takes the tab bar with it.  Measuring the viewport directly is the one
   thing every browser agrees on, so that value wins over both units.

   visualViewport fires while the address bar slides, which the plain
   resize event does not. */
function syncAppHeight() {
  const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  if (h > 200) document.documentElement.style.setProperty("--appH", Math.round(h) + "px");
}

function boot() {
  syncAppHeight();
  window.addEventListener("resize", syncAppHeight);
  window.addEventListener("orientationchange", () => setTimeout(syncAppHeight, 250));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", syncAppHeight);
  initRender();
  /* Textures and the pixel-art button frames are both cosmetic.  If a
     browser cannot bake them the game should still be playable, so
     neither is allowed to stop boot. */
  try { buildTextures(); } catch (e) { console.warn("textures unavailable", e); }
  try { buildUIChrome(); } catch (e) { console.warn("ui chrome unavailable", e); }

  const tab = (id, fn) => { $(id).onclick = () => { if (MODE !== "shop") return; sfx("click"); fn(); }; };
  tab("tabTeam", scrTeam); tab("tabCars", scrCars); tab("tabRace", scrRaces);
  tab("tabShop", scrDevelop); tab("tabMore", openMenu);
  /* 1x -> 2x -> 3x -> paused, shared by the shop button and the race one
     so the game only has one idea of how fast time is running. */
  const cycleSpeed = () => {
    if (!G) return; sfx("click");
    if (G.set.paused) { G.set.paused = false; G.set.speed = 1; }
    else if (G.set.speed < 3) G.set.speed++;
    else { G.set.speed = 1; G.set.paused = true; }
    updateChrome();
  };
  $("speedBtn").onclick = cycleSpeed;
  $("raceSpeedBtn").onclick = cycleSpeed;
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
