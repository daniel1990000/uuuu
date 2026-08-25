# Published build

`index.html` is the whole game in one self-contained file, built from
`stock-car-story/www/` by `stock-car-story/tools/build.js`.

It lives here rather than in `stock-car-story/dist/` (which is ignored)
so that it has a stable public URL, and so that GitHub Pages can serve
it directly from this folder if Pages is switched to "Deploy from a
branch" with `/docs` as the source.

Rebuild with:

    cd stock-car-story && node tools/build.js && cp dist/index.html ../docs/index.html
