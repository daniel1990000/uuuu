# Getting Stock Car Story onto a URL

The game is plain HTML, CSS and JavaScript with no runtime dependencies and
no build step at play time, so anything that can serve a static file can host
it. Three routes, easiest first.

## 0. Already live — githack, no setup at all

The repository is public, so the committed build at `docs/index.html`
already has a working public URL. Nothing to enable, no account:

- <https://raw.githack.com/daniel1990000/uuuu/claude/nascar-story-game-w36ol1/docs/index.html>
  — follows the branch, so it updates on every push.
- <https://rawcdn.githack.com/daniel1990000/uuuu/6d25a65551464f7b4277aecb644af51212fa1ad4/docs/index.html>
  — pinned to a commit and CDN-cached, so it never changes under you.

githack serves raw GitHub files with a real `text/html` content type,
which is the only reason this works where `raw.githubusercontent.com`
does not (that serves everything as `text/plain`).

Treat it as a share-and-playtest link rather than a shipping host: it is
a free third-party CDN with rate limits and no uptime promise. For a
release, use one of the routes below.

Refresh it with:

    cd stock-car-story && node tools/build.js && cp dist/index.html ../docs/index.html
    git add -f ../docs/index.html && git commit && git push

## 1. Netlify Drop — no account, about ten seconds

    node tools/build.js          # writes dist/index.html

Open <https://app.netlify.com/drop> and drag `dist/index.html` onto the page.
You get a live URL immediately. It is the entire game in one 228 KB file, so
there is nothing else to upload.

The URL Netlify hands you is random (`fluffy-tapioca-12ab34.netlify.app`).
Claim it with a free account if you want to rename it or keep it permanently —
unclaimed drops expire.

## 2. GitHub Pages — one click, then automatic forever

`.github/workflows/deploy-stock-car-story.yml` already builds and publishes on
every push to the development branch. It needs Pages switched on once, because
a workflow cannot enable Pages for its own repository:

1. <https://github.com/daniel1990000/uuuu/settings/pages>
2. **Source** → **GitHub Actions**
3. Re-run the workflow from the Actions tab, or push anything

The site then lives at:

- <https://daniel1990000.github.io/uuuu/> — the normal multi-file build
- <https://daniel1990000.github.io/uuuu/single/> — the one-file build

Until step 2 is done the deploy job fails with `HttpError: Not Found`, which is
Pages saying it has not been turned on rather than anything wrong with the build.

## 3. Netlify from the repository — automatic, custom domain

Connect the repo at <https://app.netlify.com/start>, then set:

- **Base directory:** `stock-car-story`
- **Build command:** `node tools/build.js`
- **Publish directory:** `www`

Netlify rebuilds on every push and will attach a custom domain.

## Notes

- **Service worker.** `www/sw.js` caches the game for offline play. Bump
  `CACHE` on every release or returning players keep the old scripts. It is at
  `scs-v3` now.
- **Paths are all relative**, so hosting under a subpath like `/uuuu/` works
  without changes.
- **HTTPS is required** for the service worker and for install-to-home-screen.
  All three routes above give you that.
- **Android and iOS** builds go through Capacitor instead — see `RELEASE.md`.
