/* Stock Car Story — offline cache.
   Bump CACHE on every release so returning players get the new build. */
const CACHE = "scs-v10";
const ASSETS = [
  ".", "index.html",
  "css/game.css",
  "js/data.js", "js/track.js", "js/state.js", "js/race.js",
  "js/sprites.js", "js/textures.js", "js/render.js", "js/ui.js", "js/main.js",
  "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  /* network-first for navigations so updates land; cache-first for assets */
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && new URL(req.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => new Response("", { status: 504, statusText: "offline" })))
  );
});
