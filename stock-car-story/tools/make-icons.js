#!/usr/bin/env node
/* Regenerate every app icon from code — no binary art to maintain.
   Requires playwright (already a dev dependency of most CI images):
     node tools/make-icons.js                                        */
"use strict";
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "www", "icons");

const DRAW = `(size)=>{
  const c=document.createElement('canvas'); c.width=size; c.height=size;
  const x=c.getContext('2d'); x.imageSmoothingEnabled=false;
  const U=size/32;
  const P=(px,py,w,h,col)=>{x.fillStyle=col;x.fillRect(Math.round(px*U),Math.round(py*U),Math.ceil(w*U),Math.ceil(h*U));};
  P(0,0,32,32,'#1b2a6b'); P(0,0,32,11,'#2a3f9e');
  for(let i=0;i<16;i++) for(let j=0;j<2;j++) P(i*2,j*2,2,2,(i+j)%2?'#ffffff':'#101a45');
  P(0,20,32,12,'#5b6068'); P(0,19,32,1,'#e8ecf2'); P(0,17,32,2,'#3fae4a');
  for(let i=0;i<6;i++) P(2+i*5,25,3,1,'#e8ecf2');
  const a=6,b=12;
  P(a,b+3,20,6,'#e8332a'); P(a+5,b,11,4,'#e8332a'); P(a+7,b+1,7,2,'#cfe8ff');
  P(a+1,b+2,18,1,'#ff7a6e');
  P(a+2,b+9,4,3,'#1c1c22'); P(a+14,b+9,4,3,'#1c1c22');
  P(a+3,b+10,2,1,'#6b7480'); P(a+15,b+10,2,1,'#6b7480');
  P(a+8,b+4,5,4,'#ffffff');
  x.fillStyle='#101a45'; x.font='bold '+Math.round(4*U)+'px monospace';
  x.textAlign='center'; x.textBaseline='middle'; x.fillText('1',(a+10.5)*U,(b+6.2)*U);
  return c.toDataURL('image/png');
}`;
const MASK = `(size)=>{
  const c=document.createElement('canvas'); c.width=size; c.height=size;
  const x=c.getContext('2d'); x.imageSmoothingEnabled=false;
  x.fillStyle='#1b2a6b'; x.fillRect(0,0,size,size);
  const U=size/32,P=(px,py,w,h,col)=>{x.fillStyle=col;x.fillRect(Math.round(px*U),Math.round(py*U),Math.ceil(w*U),Math.ceil(h*U));};
  for(let i=0;i<16;i++) for(let j=0;j<2;j++) P(i*2,6+j*2,2,2,(i+j)%2?'#ffffff':'#101a45');
  P(0,22,32,4,'#5b6068');
  const a=8,b=13;
  P(a,b+3,16,5,'#e8332a'); P(a+4,b,9,4,'#e8332a'); P(a+6,b+1,5,2,'#cfe8ff');
  P(a+2,b+8,3,2,'#1c1c22'); P(a+11,b+8,3,2,'#1c1c22');
  return c.toDataURL('image/png');
}`;

(async () => {
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { console.error("playwright is required: npm i -D playwright"); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent("<body></body>");
  for (const s of [48, 72, 96, 144, 192, 256, 384, 512, 1024]) {
    const url = await page.evaluate(`(${DRAW})(${s})`);
    fs.writeFileSync(path.join(OUT, `icon-${s}.png`), Buffer.from(url.split(",")[1], "base64"));
  }
  for (const s of [192, 512]) {
    const url = await page.evaluate(`(${MASK})(${s})`);
    fs.writeFileSync(path.join(OUT, `maskable-${s}.png`), Buffer.from(url.split(",")[1], "base64"));
  }
  await browser.close();
  console.log("icons regenerated in www/icons");
})();
