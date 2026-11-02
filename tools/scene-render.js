#!/usr/bin/env node
/* Render game scenes outside the browser: runs the pixel-art script from
   index.html against a minimal fake canvas and returns RGBA pixels / PNGs.

   Usage:  node tools/scene-render.js out.png <bg> [sprite] [--fight] [--hit] [--ticks N] [--scale S]
           e.g. node tools/scene-render.js /tmp/rat.png cave rat
                node tools/scene-render.js /tmp/hit.png battle dog --fight --hit

   Also used as a module by export-sprites.js. */
const fs = require("fs"), path = require("path"), vm = require("vm"), zlib = require("zlib");

function parseColor(s) {
  if (s[0] === "#") return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)).concat(1);
  const v = s.match(/rgba?\(([^)]+)\)/)[1].split(",").map(Number);
  return [v[0], v[1], v[2], v[3] ?? 1];
}

/* just enough of canvas 2D for the game's renderer: fillRect (the per-tick
   effects), drawImage, createImageData/putImageData, translate (screen shake) */
function makeCanvas(w = 300, h = 150) {
  const c = { _w: w, _h: h, data: new Uint8ClampedArray(w * h * 4) };
  const resize = () => { c.data = new Uint8ClampedArray(c._w * c._h * 4); };
  Object.defineProperty(c, "width", { get: () => c._w, set: v => { c._w = v; resize(); } });
  Object.defineProperty(c, "height", { get: () => c._h, set: v => { c._h = v; resize(); } });
  let tx = 0; const stack = [];
  const blend = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= c._w || y >= c._h) return;
    const k = (y * c._w + x) * 4, d = c.data;
    d[k] = r * a + d[k] * (1 - a); d[k + 1] = g * a + d[k + 1] * (1 - a); d[k + 2] = b * a + d[k + 2] * (1 - a); d[k + 3] = 255;
  };
  const ctx = {
    fillStyle: "#000", imageSmoothingEnabled: true,
    save() { stack.push(tx); }, restore() { tx = stack.pop() || 0; }, translate(x) { tx += x; },
    fillRect(x, y, w, h) {
      const [r, g, b, a] = parseColor(ctx.fillStyle);
      for (let j = Math.round(y); j < Math.round(y + h); j++)
        for (let i = Math.round(x + tx); i < Math.round(x + tx + w); i++) blend(i, j, r, g, b, a);
    },
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData(im, x, y) {
      for (let j = 0; j < im.height; j++) for (let i = 0; i < im.width; i++)
        for (let q = 0; q < 4; q++) c.data[((y + j) * c._w + x + i) * 4 + q] = im.data[(j * im.width + i) * 4 + q];
    },
    drawImage(img, x, y) {
      x = Math.round(x + tx); y = Math.round(y);
      for (let j = 0; j < img._h; j++) for (let i = 0; i < img._w; i++) {
        const s = (j * img._w + i) * 4, a = img.data[s + 3] / 255;
        if (a) blend(x + i, y + j, img.data[s], img.data[s + 1], img.data[s + 2], a);
      }
    },
  };
  c.getContext = () => ctx;
  return c;
}

/* load the art script; returns the game's own art objects plus render() */
function loadArt(src) {
  src = src || fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  let art = blocks.find(b => b.includes("PIXEL ART"));
  art = art.slice(0, art.indexOf("/* ---------------- boot"));
  const view = makeCanvas(320, 150);
  const ctx = {
    $: () => view, document: { createElement: () => makeCanvas() },
    matchMedia: () => ({ matches: false }), requestAnimationFrame: () => {}, Math, console,
  };
  vm.createContext(ctx);
  vm.runInContext("var C=null;" + art + `
    ;this.A={PAL,SPR,BG,OVERLAY,RGB,sprFrame,outline,px,stamp,setScene,loop,fx,
      setC:v=>{C=v}, reset:()=>{T=0;hitAt=-99;shakeEnd=0;flash=null;}};`, ctx);
  const A = ctx.A;
  /* draw one scene; ticks = frames to advance, hit = enemy was just hit (combat) */
  A.render = (bg, sprite, { fight = false, hit = false, ticks = 1 } = {}) => {
    A.reset(); A.setScene(bg, sprite || null); A.setC(fight ? {} : null);
    for (let t = 0; t < ticks; t++) { if (hit && t === ticks - 6) A.fx.hitEnemy(); A.loop(); }
    A.setC(null);
    return { w: 320, h: 150, data: Uint8ClampedArray.from(view.data) };
  };
  return A;
}

/* RGBA -> PNG buffer, optionally scaled up nearest-neighbour */
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png({ w, h, data }, S = 1) {
  const W = w * S, H = h * S, raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (Math.floor(y / S) * w + Math.floor(x / S)) * 4, o = y * (W * 4 + 1) + 1 + x * 4;
    raw[o] = data[k]; raw[o + 1] = data[k + 1]; raw[o + 2] = data[k + 2]; raw[o + 3] = data[k + 3];
  }
  const chunk = (t, d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/* indexed sprite buffer (from sprFrame) -> RGBA */
function bufRGBA(A, p) {
  const data = new Uint8ClampedArray(p.w * p.h * 4);
  for (let k = 0; k < p.d.length; k++) { const v = A.RGB[p.d[k]]; if (v) { data.set(v, k * 4); data[k * 4 + 3] = 255; } }
  return { w: p.w, h: p.h, data };
}

module.exports = { loadArt, png, bufRGBA, makeCanvas };

if (require.main === module) {
  const args = process.argv.slice(2), flag = f => args.includes(f);
  const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? +args[i + 1] : d; };
  const [out, bg, sprite] = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] || "").match(/^--(ticks|scale)$/));
  if (!out || !bg) { console.error("usage: node tools/scene-render.js out.png <bg> [sprite] [--fight] [--hit] [--ticks N] [--scale S]"); process.exit(1); }
  const A = loadArt();
  const img = A.render(bg, sprite, { fight: flag("--fight"), hit: flag("--hit"), ticks: opt("--ticks", flag("--hit") ? 8 : 1) });
  fs.writeFileSync(out, png(img, opt("--scale", 3)));
  console.log("wrote " + out);
}
