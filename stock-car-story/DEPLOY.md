# Getting a playable URL

Three routes, fastest first.

## 1. Netlify Drop — 30 seconds, no account needed

`npm run build` produces **`dist/index.html`**: the entire game in one file.

Open <https://app.netlify.com/drop> and drag that single file onto the page.
You get a public URL immediately. Create a free Netlify account if you want to
keep the URL permanently and give it a nicer name.

The same file works on **itch.io** (upload as an HTML game, mark
`index.html` as the main file) and on any static host.

## 2. GitHub Pages — automatic on every push

`.github/workflows/deploy-stock-car-story.yml` is already in the repo. Enable it once:

1. GitHub → your repo → **Settings** → **Pages**
2. Under **Source**, choose **GitHub Actions**
3. Push to `claude/nascar-story-game-w36ol1` (or run the workflow manually
   from the Actions tab)

The site lands at:

```
https://daniel1990000.github.io/uuuu/
```

That URL serves the full PWA — installable to a phone home screen, works
offline. A one-file copy is also published at `/single/`.

## 3. Netlify from the repo — automatic, custom domain

1. Netlify → **Add new site** → **Import an existing project** → GitHub
2. Pick the repo, set:
   - **Base directory**: `stock-car-story`
   - **Build command**: `node tools/build.js`
   - **Publish directory**: `stock-car-story/www`
3. Deploy

Every push then rebuilds automatically, and you can attach a custom domain.

---

## Before you share it widely

Bump `CACHE` in `www/sw.js` whenever you deploy an update, or returning
players keep getting the cached old build.
