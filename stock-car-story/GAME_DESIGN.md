# Stock Car Story — design & systems reference

A stock-car racing team management sim built on the classic Japanese
pixel-sim formula (Grand Prix Story's systems, restaged around American
oval racing). This document records what the game does and why, so the
build stays coherent as it grows.

> **Originality.** Every system here was rebuilt from an analysis of the
> genre's mechanics; no assets, code or text were copied. All art is authored
> pixel by pixel in `sprites.js`. All names — tracks, sponsors, drivers, teams —
> are invented. No real racing series, sanctioning body, team or driver is
> referenced. That is a deliberate constraint: style is free, assets and
> trademarks are not, and a store takedown is fatal to a small release.

---

## Part 1 — The source formula, analysed

The genre's core is a four-currency economy driven by a single race loop:

```
money → hire / train / research / build / install
  ↑                                        ↓
purse, sponsors, fans   ←   race  →  research data, advertising, auras
```

**Time.** Year / Month / Week. Four weeks a month, twelve months a year.
The career scores out in **Year 14, Month 4**, then continues endlessly.

**Staff.** Two roles sharing six attributes:

| Stat | Driver | Crew | Effect |
|---|---|---|---|
| Pedal | ✔ | — | top speed |
| Shift | ✔ | — | acceleration |
| Steer | ✔ | — | cornering and overtaking |
| Appeal | ✔ | ✔ | advertising value → sponsor payouts |
| Tech | ✔ | ✔ | build quality, install quality, repairs, pit stops |
| Analysis | ✔ | ✔ | research data earned per lap |

Drivers train (money + energy, better at full energy) and gain levels.
Crew level 1→5 by spending research data; salary scales ×3 across that range.

**Machines and parts.** Both live in a persistent **library** with a level
(1–6) and an upgrade percentage (0–100). Upgrades cost research data, are
permanent, and are the main progression axis — they also gate the unlock
chains ("upgrade the 400 V8 to 80% to unlock the 427"). A *built* car is an
instance: library stats × build quality (100–160%, set by shop Tech and any
aura spent). Parts install at 80–130% fit quality the same way.

**Auras.** Four tiers — Blue, Pink, Silver, Gold — with work multipliers
×1.5 / ×2 / ×2.5 / ×3. The tier a driver earns depends on their total stats.
Earned from a first-time podium at a track, a championship, level milestones,
and occasional test sessions. Spent on **one of five sinks**: a race boost,
a car build, a part install, a library upgrade, or a training session. One
resource, five competing uses — the genre's signature decision.

**Sponsors.** Two contracts at a time, settling in Month 1 and Month 7.
Racing generates advertising points; payout scales with them, and filling a
sponsor's gauge permanently unlocks its reward (a part, a chassis, a training
programme, cash or research data).

**Endgame.** Score = funds×0.3 + RP×30 + wins×2,000 + titles×15,000 +
machines×2,500 + parts×1,300 + upgrades×320 + sponsors×950 + advertising×2.
New Game+ carries the **library** (every machine and part level) but not
money, staff, fans or sponsors.

---

## Part 2 — The stock-car restaging

The management layer is kept whole. The racing layer is rebuilt around ovals.

| Source formula | Stock Car Story |
|---|---|
| Road circuits | Real oval geometry: short tracks → superspeedways |
| On-road / off-road / icy | Short / Intermediate / Superspeedway / Dirt / Road |
| Three formula series | Rookie Cup → National Series → Premier Cup |
| Steer | Steer, and the draft that goes with it |
| 1–2 lap sprints | 16–44 lap races with pit strategy and cautions |

### Track geometry (`track.js`)

Tracks are surveyed the way real ones are: a sequence of **straights and
banked arcs** whose turning sums to 360°. Straights marked `f:1` are *flex* —
a minimum-norm least-squares solver adjusts their lengths so the loop closes
exactly, which is what lets asymmetric shapes exist without hand-solving any
trigonometry. Any residual is spread smoothly along the lap, so every track is
watertight.

Ten shapes ship, each matching a real archetype:

| Preset | Archetype | Character |
|---|---|---|
| `paperclip` | flat half-mile | long straights, tight flat ends |
| `bowl` | concrete short track | tiny straights, 30° banking |
| `oval` | flat one-mile | momentum track |
| `quadoval` | 1.5-mile | frontstretch bulges past the line |
| `trioval` | 2.5-mile superspeedway | 31° banking, dogleg at the line |
| `doval` | D-shaped two-mile | gentle bowed frontstretch |
| `eggoval` | egg-shaped | one end far tighter than the other |
| `triangle` | three-cornered | three radii, three straight lengths |
| `dirtoval` | dirt | wide, sweeping, low bank |
| `road` | road course | esses, a hairpin, a long back straight |

Banking is per-segment and feeds grip. Curvature feeds cornering loss, tyre
wear and the AI's lift-off point.

### Race simulation (`race.js`)

Per tick, per car:

```
grip        = (0.80 + 0.20·tyre) · (1 + banking/220)
cornerCost  = curvature · (1 − min(0.55, perf/340))
target      = (26 + perf·0.62) · grip · (1 − cornerCost·0.42)
            × draft bonus  (superspeedway 11%, intermediate 5%, by gap)
            × aura boost   (player, while active)
            × surface noise (dirt is twitchy)
```

- **Qualifying** is one clean lap with no draft; it sets the grid.
- **Tyres and fuel** wear per lap, scaled by the track's mean curvature. The
  crew calls a stop below 26% tyre or 14% fuel; stop time comes from shop
  Tech and pit parts, and is 45% shorter under yellow.
- **Cautions** fire per leader lap (1.8%–5% by surface). Under yellow the
  field packs up behind the pace car. On superspeedways a caution can be
  **the Big One**, scattering the field — and sometimes catching the player.
- **Stage points** at 1/3 and 2/3 distance, and the Premier Cup resets its
  top four before the finale.
- **Attrition**: the player's durability drains ~20% of the car's maximum per
  race (more on short tracks and dirt), so a machine lasts roughly five events
  before needing the shop. Rivals suffer occasional mechanical failures too.

**Rival strength scales with the player**, floored by the track's own tier:

```
band  = Rookie 0.86 · National 0.95 · Premier Cup 1.04
rival = max(trackTier, playerPerf × band) × per-driver variance
```

So club racing stays winnable, the Cup is genuinely hard, and neglecting the
car still loses — the floor means you cannot drag the whole field down with
you. Measured across a simulated ten-year career this yields a **~43% win
rate** for an actively managed team, which is where the loop stays tense
without feeling unfair.

### Content

- **16 tracks** across five surfaces, unlocked by wins, garage level and series
- **15 chassis** (E→S rank) with per-surface aptitudes and 2–4 part slots
- **30 parts** in ten categories, including hidden stats (driver assist,
  supercharge, turbo, braking, advertising, analysis, XP, pit speed, fuel)
- **36 drivers**, **23 crew**, **23 sponsors**, **15 training programmes**
- **3 championships**, ladder-gated by garage level

---

## Part 3 — The art pipeline

All art is authored, not generated from primitives. Two kinds live in
`sprites.js`:

**Flat sprites** are pixel maps — one character per pixel, with a palette
substitution table so a single authored sprite becomes a whole crowd. The
spectators (six poses: standing, capped, cheering, flag-waving), the staff
(three roles × four facings × two walk frames, with cap/helmet overlays),
and the props (tyre, cone, drum, toolbox, pine, palm, trophy) are all drawn
this way.

**Voxel sprites** solve the problem that a car on an oval faces every
direction. Each car body is authored once as a top-down pixel map where
every character also carries a *height* — sill, body panel, chrome stripe,
number panel, hood, roof, windscreen, rear window, spoiler blade and post,
tyre, grille, headlight, tail light, cab pillar, helmet. At boot each model
is baked into 32 rotation frames by drawing every cell as a small vertical
column, far columns first so nearer ones occlude them, then running an
outline pass so the silhouette reads at small sizes. Four body styles ship
— stock saloon, aero coupe, race truck, dirt modified — and each of the 15
chassis maps to one, so machines look different as you develop them.

Baking costs about 40 ms at boot and buys correct rotation with consistent
lighting, which hand-drawing 32 frames per body per livery could not.

## Part 4 — Making it playable

A simulation nobody can navigate is not a game. Three things carry the
player through:

**The objective card.** A next-step engine (`nextStep()` in `ui.js`) reads the
whole game state and returns one sentence plus the single button that acts on
it — repair the machine, sign the sponsor waiting on you, research what you can
afford, rest a tired driver, enter the next round of the championship. It sits
under the status bar and updates as the clock runs, so there is never a moment
where the answer to "what now?" is hidden in a menu.

**A real tab bar.** Five permanent tabs — Team, Machines, Race, Develop, More —
each a 52px touch target, with a red dot when something is waiting behind it.
Develop groups research, parts, building and training, which are otherwise four
separate trips through a menu.

**A tappable shop.** The garage is not a picture. The machine on the lift, the
crew on the floor, the sponsor banner and the tool bench each carry a floating
label and open the matching screen when tapped.

Type is set for a phone held at arm's length: 13px base, 44px minimum row
height, and dialogs at 96% of screen width.

## Part 5 — Presentation

The canvas is backed by real device pixels (DPR up to 2) and drawn in CSS
pixels, so lines and text are sharp rather than a stretched low-res bitmap.
Sprites stay chunky because they are drawn at an explicit *art pixel* size
(`PX`, 2–4 CSS px per authored pixel) — the pixel-art look without the
blurry upscale.

Two optimisations matter. The dithered ground fill originally stamped one
rectangle per pixel and cost about 14 ms a frame on its own; it is now a
cached 8×4 pattern tile. Flat sprites are baked once per variant into small
canvases and blitted, so a two-hundred-strong crowd is two hundred
`drawImage` calls rather than a few thousand fills. Frame time is about
3 ms. Navy chrome bars top and bottom with gold LCD readouts and white
rounded pill buttons; white dialogs with red title bars.

**Shop scene**: corrugated-steel garage, wood floor, lift pad, tyre stacks,
tool chests, oil drums, sponsor banner, transporter outside, and chibi staff
who wander the floor while status bubbles float above.

**Race scene**: the whole speedway from a blimp view — the track ribbon with a
worn groove and banking shading, SAFER-striped outer wall, tiered grandstands
with a pixel crowd on the frontstretch and backstretch, pit road with stalls
in the infield, garages and a lake inside, a flag stand at the line. The view
auto-rotates and picks its vertical squash to fill a portrait screen.

---

## Part 6 — Technical

```
www/
  index.html            shell + chrome bars
  css/game.css          all styling
  js/data.js            every content table
  js/track.js           geometry engine + closure solver
  js/sprites.js         hand-authored pixel art + the voxel car baker
  js/state.js           economy, time, library, sponsors, auras, save/load
  js/race.js            race simulation + championships
  js/render.js          all pixel art
  js/ui.js              dialogs and management screens
  js/main.js            boot, loop, input
  manifest.webmanifest  installable PWA
  sw.js                 offline cache
  icons/                generated from code by tools/make-icons.js
tools/build.js          inlines everything into dist/index.html
capacitor.config.json   Android + iOS wrapper config
```

Zero runtime dependencies. Fixed-timestep loop, event-driven UI. Saves are one
JSON object in `localStorage`, versioned (`G.v`) and refused on mismatch rather
than crashing; the developed library is stored separately so New Game+ can
carry it. Autosaves monthly, on tab hide and on page hide.

See `RELEASE.md` for build and store submission, `STORE.md` for listing copy.

---

## Part 7 — What I would build next

In the order that would most improve the game:

1. **Race replays / highlights** — a short recap of the last five laps. The
   sim already stores everything needed.
2. **Second team management** — the garage grants a second team slot at
   level 2, but the AI doesn't run it for you yet; it currently sits idle
   unless the player switches to it manually.
3. **Weather** — rain on the road course, a wet line, tyre choice as a real
   decision. The tyre model already supports it.
4. **Driver personalities** — a temperament that shifts aggression, wear and
   caution risk; gives the 36-driver roster more identity than stat spreads.
5. **Track records and a hall of fame** — cheap to add, and gives the endless
   post-Year-14 mode something to chase.
