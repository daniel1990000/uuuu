#!/usr/bin/env node
/* Inline every local script and stylesheet into one self-contained
   dist/index.html — used for itch.io, static hosting and previews.
   The Capacitor apps ship the multi-file www/ folder instead.        */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WWW = path.join(ROOT, "www");
const DIST = path.join(ROOT, "dist");

function read(p) { return fs.readFileSync(path.join(WWW, p), "utf8"); }

let html = read("index.html");

/* inline <link rel=stylesheet href="css/..."> */
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  if (/^https?:/.test(href)) return m;
  return "<style>\n" + read(href) + "\n</style>";
});

/* inline <script src="js/..."> in order */
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  if (/^https?:/.test(src)) return m;
  return "<script>\n" + read(src) + "\n</script>";
});

/* the single-file build has no service worker or manifest to fetch */
html = html.replace(/<link rel="manifest"[^>]*>\s*/g, "");
html = html.replace(/navigator\.serviceWorker\.register\("sw\.js"\)\.catch\(\(\) => \{\}\);?/,
  "void 0;");

/* embed the icon as a data URI so the favicon works from file:// too */
try {
  const ico = fs.readFileSync(path.join(WWW, "icons/icon-192.png")).toString("base64");
  html = html.replace(/<link rel="icon"[^>]*>/, '<link rel="icon" href="data:image/png;base64,' + ico + '">');
  html = html.replace(/<link rel="apple-touch-icon"[^>]*>/, '<link rel="apple-touch-icon" href="data:image/png;base64,' + ico + '">');
} catch (e) { /* icons not generated yet */ }

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, "index.html"), html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log("dist/index.html written — " + kb + " KB, self-contained");
