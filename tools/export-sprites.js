#!/usr/bin/env node
/* Export every pixel-art sprite into a review sheet: each sprite drawn large,
   at in-game size on the cave background, its char-map source, and the
   levels/scenes that show it.

   Usage:  node tools/export-sprites.js
   Output: review/hanzi-quest-sprites.html  (open in a browser)
           review/sprites/<name>.svg         (one file per sprite)

   Reads PAL, SPR and the level data straight from index.html, so re-run it
   after edits to get an up-to-date copy. */
const fs = require("fs"), path = require("path"), vm = require("vm");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
// block 0 = dictionary D + L(), block 1 = LEVELS + CT (pure data, no DOM)
const { LEVELS } = vm.runInNewContext(blocks[0] + blocks[1] + ";({LEVELS})");
// The pixel-art block touches the DOM, so pull out just the two data literals.
const pal = src.match(/const PAL=\{[\s\S]*?\};/)[0];
const spr = src.match(/const SPR=\{[\s\S]*?\n\};/)[0];
const { PAL, SPR } = vm.runInNewContext(pal + spr + ";({PAL,SPR})");
const VERSION = (src.match(/const APP_VERSION = "([^"]+)"/) || [])[1] || "?";
const TODAY = new Date().toLocaleDateString("en-CA");  // local YYYY-MM-DD

const LEVEL_EN = { 1: "The Cave", 2: "The Forest", 3: "The Town", 4: "The Island",
                   5: "Snow Mountain", 6: "The Ancient Temple" };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Where each sprite appears: { name: { level: Set(nodeIds) } } */
const uses = {};
for (const [n, lv] of Object.entries(LEVELS))
  for (const [id, nd] of Object.entries(lv.nodes)) {
    const s = nd.sprite || (nd.combat && nd.combat.sprite);
    if (!s) continue;
    ((uses[s] ||= {})[n] ||= new Set()).add(id + (nd.combat ? " (fight)" : ""));
  }

function svg(name, scale) {
  const m = SPR[name], w = m[0].length, h = m.length;
  let rects = "";
  m.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== ".") rects += `<rect x="${c}" y="${r}" width="1.04" height="1.04" fill="${PAL[ch] || "#fff"}"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges">${rects}</svg>`;
}

const cards = Object.keys(SPR).map(name => {
  const u = uses[name];
  const where = u
    ? Object.entries(u).map(([n, ids]) =>
        `<li><b>Level ${n}</b> · ${esc(LEVELS[n].name)} ${LEVEL_EN[n]}<br><span>${[...ids].map(esc).join(", ")}</span></li>`).join("")
    : `<li class="none">${name === "torch" ? "Wall torches in cave scenes and the title screen (drawn by torchAt)" : "Not used in any scene"}</li>`;
  return `<section class="card" id="${esc(name)}">
<h2>${esc(name)}</h2>
<div class="views">
  <figure class="big">${svg(name, 16)}<figcaption>16× with pixel grid</figcaption></figure>
  <figure class="game">${svg(name, 6)}<figcaption>in-game size (6×)</figcaption></figure>
</div>
<pre>${m(name)}</pre>
<ul>${where}</ul>
</section>`;
}).join("\n");

function m(name) { return SPR[name].map(esc).join("\n"); }

const legend = Object.entries(PAL).map(([k, v]) =>
  `<span class="sw"><i style="background:${v}"></i><code>${esc(k)}</code> ${v}</span>`).join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hanzi Quest Sprites</title>
<style>
body{margin:0;padding:24px 16px;background:#14111f;color:#e8e3f0;font:14px/1.45 system-ui,sans-serif}
h1{margin:0 0 4px;font-size:22px}
.meta{color:#9a93ad;margin:0 0 16px}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0 0 24px;padding:12px;background:#1f1a2e;border-radius:8px}
.sw{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#b8b1c8}
.sw i{width:16px;height:16px;border-radius:3px;border:1px solid #0006}
.sw code{color:#fff;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.card{background:#1f1a2e;border-radius:10px;padding:14px;min-width:0}
.card h2{margin:0 0 10px;font-size:17px;font-family:ui-monospace,monospace}
.views{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
figure{margin:0}
figcaption{font-size:11px;color:#9a93ad;margin-top:4px}
.big svg{max-width:100%;height:auto;background-color:#2a2440;
  background-image:linear-gradient(#ffffff14 1px,transparent 1px),linear-gradient(90deg,#ffffff14 1px,transparent 1px);
  background-size:16px 16px;border-radius:4px}
.game svg{background:#1c1730;padding:6px;border-radius:4px}
pre{margin:12px 0 8px;padding:8px;background:#14111f;border-radius:6px;font-size:12px;line-height:1.15;overflow-x:auto;color:#cfc8de}
ul{margin:0;padding-left:18px;font-size:13px}
ul span{color:#9a93ad;font-size:12px}
.none{color:#e0a05e}
.note{margin-top:24px;color:#9a93ad;font-size:13px}
</style></head><body>
<h1>Hanzi Quest sprites</h1>
<p class="meta">${Object.keys(SPR).length} sprites · game version ${esc(VERSION)} · exported ${TODAY}</p>
<div class="legend">${legend}</div>
<div class="grid">
${cards}
</div>
<p class="note">Not included: the cave doors (<code>doors</code>, <code>firedoor</code>, <code>backdoor</code>) and all backgrounds are drawn with code in index.html (drawDoors, drawBackdoor, bg*), not from char maps.</p>
</body></html>
`;

const outDir = path.join(ROOT, "review");
fs.mkdirSync(path.join(outDir, "sprites"), { recursive: true });
for (const name of Object.keys(SPR))
  fs.writeFileSync(path.join(outDir, "sprites", name + ".svg"), svg(name, 16));
const out = path.join(outDir, "hanzi-quest-sprites.html");
fs.writeFileSync(out, html);
console.log("Wrote " + path.relative(ROOT, out) + " and " + Object.keys(SPR).length + " SVGs in review/sprites/");
