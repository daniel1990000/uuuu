# Stock Car Story

A pixel-art racing team management sim. Start with a rusty garage, one tired
stock car and a rookie driver; finish with a championship trophy. You never
drive — you build the team that wins.

Portrait, touch-first, fully offline, no dependencies.

![built with vanilla JS](https://img.shields.io/badge/deps-none-brightgreen)

## Play it

```bash
npm install
npm run serve      # http://localhost:8080
```

Or open `dist/index.html` directly — the whole game is one self-contained file.

## What's in it

- **16 tracks** — short tracks, intermediates, superspeedways and a road
  course — each built from real oval geometry, with straights, banked corners,
  tri-oval doglegs and egg-shaped ends
- **15 chassis** and **18 parts** in a permanent upgrade library that carries
  into New Game+
- **36 drivers**, **23 crew chiefs**, **23 sponsors**, **15 training programmes**
- **3 championships** with qualifying, stage points, cautions, pit strategy,
  drafting and a playoff finale
- Four tiers of **aura** to spend on a race, a build, an install, an upgrade or
  a training session

## Layout

| Path | What it is |
|---|---|
| `www/` | the game (this is what ships) |
| `www/js/track.js` | track geometry engine and loop-closure solver |
| `www/js/race.js` | race simulation and championships |
| `www/js/sprites.js` | hand-authored pixel art + the voxel car baker |
| `www/js/render.js` | scene composition and the chase camera |
| `tools/build.js` | inlines everything into `dist/index.html` |
| `GAME_DESIGN.md` | systems reference and design rationale |
| `RELEASE.md` | Android, iOS and web release steps |
| `STORE.md` | store listing copy and asset checklist |

## Shipping

`www/` is a complete PWA. Capacitor wraps the same folder for Google Play and
the App Store — see `RELEASE.md`.

```bash
npm run build            # dist/index.html
npm run cap:add:android  # generate the Android project
npm run cap:sync         # copy www/ into the native shells
```

## Originality

All art is authored pixel by pixel in `sprites.js`. Every track, sponsor,
driver and team name is invented; no real racing series, sanctioning body, team or
driver is referenced, and no third-party assets are used. The game is an
original work in the tradition of Japanese pixel management sims.
