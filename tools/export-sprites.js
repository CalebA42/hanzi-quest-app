#!/usr/bin/env node
/* Export every sprite and background into a review sheet: each sprite's
   frames enlarged (idle loop, combat hit, fight-size art, per-background
   versions), the real scenes it appears in, a see-through check, and every
   background.

   Usage:  node tools/export-sprites.js
   Output: review/hanzi-quest-sprites.html  (open in a browser)
           review/sprites/<name>.png         (still frame, one file per sprite)

   Renders straight from index.html through tools/scene-render.js, so re-run
   it after edits to get an up-to-date copy. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const { loadArt, png, bufRGBA } = require("./scene-render");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
// block 0 = dictionary D + L(), block 1 = LEVELS + CT (pure data, no DOM)
const { LEVELS } = vm.runInNewContext(blocks[0] + blocks[1] + ";({LEVELS})");
const A = loadArt(src);
const VERSION = (src.match(/const APP_VERSION = "([^"]+)"/) || [])[1] || "?";
const TODAY = new Date().toLocaleDateString("en-CA");  // local YYYY-MM-DD

const LEVEL_EN = { 1: "The Cave", 2: "The Forest", 3: "The Town", 4: "The Island",
                   5: "Snow Mountain", 6: "The Ancient Temple" };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uri = img => "data:image/png;base64," + png(img).toString("base64");

/* Where each sprite appears: { name: { level: Set(nodeIds) } }, and on which backgrounds.
   A fight keeps the background of the node that led into it. */
const uses = {}, scenes = {};
for (const [n, lv] of Object.entries(LEVELS))
  for (const [id, nd] of Object.entries(lv.nodes)) {
    const s = nd.sprite || (nd.combat && nd.combat.sprite);
    if (!s) continue;
    ((uses[s] ||= {})[n] ||= new Set()).add(id + (nd.combat ? " (fight)" : ""));
    const bgs = nd.combat
      ? Object.values(lv.nodes).filter(o => o.bg && (o.choices || []).some(c => c.next === id)).map(o => o.bg)
      : [nd.bg];
    for (const bg of bgs.length ? bgs : ["battle"]) (scenes[s] ||= new Map()).set(bg + (nd.combat ? "|fight" : ""), { bg, fight: !!nd.combat });
  }

const whereList = name => {
  const u = uses[name];
  return u
    ? Object.entries(u).map(([n, ids]) =>
        `<li><b>Level ${n}</b> · ${esc(LEVELS[n].name)} ${LEVEL_EN[n]}<br><span>${[...ids].map(esc).join(", ")}</span></li>`).join("")
    : `<li class="none">Not used in any scene</li>`;
};

/* transparent pixels enclosed by an (outlined) sprite = see-through holes */
function holes(p) {
  const seen = new Uint8Array(p.w * p.h), q = [];
  for (let x = 0; x < p.w; x++) q.push([x, 0], [x, p.h - 1]);
  for (let y = 0; y < p.h; y++) q.push([0, y], [p.w - 1, y]);
  while (q.length) {
    const [x, y] = q.pop(), k = y * p.w + x;
    if (x < 0 || y < 0 || x >= p.w || y >= p.h || seen[k] || p.d[k]) continue;
    seen[k] = 1; q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  let n = 0; for (let k = 0; k < p.d.length; k++) if (!p.d[k] && !seen[k]) n++;
  return n;
}

const frameFig = (p, label, cls = "", S = p.w > 44 ? 2 : 3) =>
  `<figure class="frame ${cls}"><img src="${uri(bufRGBA(A, p))}" width="${p.w * S}" height="${p.h * S}" alt=""><figcaption>${esc(label)}</figcaption></figure>`;

/* ---- sprites (fight art and per-background versions go on their main sprite's card) ---- */
const variantsOf = name => Object.keys(A.BG).filter(bg => A.SPR[name + "_" + bg]);
const isExtra = n => n.endsWith("_fight") || Object.keys(A.SPR).some(b => Object.keys(A.BG).some(bg => n === b + "_" + bg));
const v2names = Object.keys(A.SPR).filter(n => !isExtra(n));
const v2cards = v2names.map(name => {
  const figs = [], warn = [];
  const addFrames = (key, tag) => {
    const s = A.SPR[key];
    (s.anim || [{}]).forEach((f, i) => {
      if (i > 0 && !Object.keys(f).length) return;   // same as the still frame
      const p = A.sprFrame(s, f), h = holes(p);
      if (h) warn.push(`${tag}frame ${i}: ${h} see-through pixel${h > 1 ? "s" : ""}`);
      figs.push(frameFig(p, `${tag}${i === 0 ? "still" : "idle " + i}`));
    });
    if (s.hit) figs.push(frameFig(A.sprFrame(s, s.hit), `${tag}hit`, "hit"));
  };
  addFrames(name, "");
  if (A.SPR[name + "_fight"]) addFrames(name + "_fight", "fight · ");
  for (const bg of variantsOf(name)) addFrames(name + "_" + bg, bg + " · ");
  const base = A.SPR[name], size = `${base.base[0].length + 2}×${base.base.length + 2}`;
  const shots = [...(scenes[name] || new Map()).values()].map(({ bg, fight }) =>
    `<figure class="scene"><img src="${uri(A.render(bg, name, { fight }))}" width="320" height="150" alt=""><figcaption>${esc(bg)}${fight ? " · fight" : ""}</figcaption></figure>`).join("");
  return `<section class="card" id="${esc(name)}">
<h2>${esc(name)} <small>${size}${base.float ? " · presented" : ""}${A.SPR[name + "_fight"] ? " · has fight art" : ""}</small></h2>
<div class="frames">${figs.join("")}</div>
${warn.length ? `<p class="warn">⚠ ${warn.map(esc).join("<br>⚠ ")}</p>` : ""}
<div class="scenes">${shots}</div>
<ul>${whereList(name)}</ul>
</section>`;
}).join("\n");

/* ---- scenery drawn into backgrounds (no char-map sprite of its own) ---- */
const overlayCards = Object.keys(A.OVERLAY).map(ov => {
  const bgs = [...(scenes[ov] || new Map()).values()].map(v => v.bg);
  return `<section class="card"><h2>${esc(ov)} <small>scenery</small></h2>
<div class="scenes">${bgs.filter(b => A.BG[b]).map(b => `<figure class="scene"><img src="${uri(A.render(b, ov))}" width="320" height="150" alt=""><figcaption>${esc(b)}</figcaption></figure>`).join("")}</div>
<ul>${whereList(ov)}</ul></section>`;
}).join("\n");

/* ---- backgrounds ---- */
const bgCards = Object.keys(A.BG).map(bg => {
  const B = A.BG[bg];
  const extra = [B.frames > 1 ? `${B.frames}-frame loop` : "", B.fx ? "live effects" : "", `ground y=${B.ground}`].filter(Boolean).join(" · ");
  return `<figure class="scene bgcard"><img src="${uri(A.render(bg, B.owns || null))}" width="320" height="150" alt=""><figcaption><b>${esc(bg)}</b> · ${esc(extra)}</figcaption></figure>`;
}).join("\n");

const legend = Object.entries(A.PAL).map(([k, v]) =>
  `<span class="sw"><i style="background:${v}"></i><code>${esc(k)}</code> ${v}</span>`).join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hanzi Quest Sprites</title>
<style>
body{margin:0;padding:24px 16px;background:#14111f;color:#e8e3f0;font:14px/1.45 system-ui,sans-serif}
h1{margin:0 0 4px;font-size:22px}
h3{margin:28px 0 12px;font-size:18px}
.meta{color:#9a93ad;margin:0 0 16px}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0 0 24px;padding:12px;background:#1f1a2e;border-radius:8px}
.sw{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#b8b1c8}
.sw i{width:16px;height:16px;border-radius:3px;border:1px solid #0006}
.sw code{color:#fff;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px}
.card{background:#1f1a2e;border-radius:10px;padding:14px;min-width:0}
.card h2{margin:0 0 10px;font-size:17px;font-family:ui-monospace,monospace}
.card h2 small{font:12px system-ui,sans-serif;color:#9a93ad;margin-left:6px}
img{image-rendering:pixelated}
.frames{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
.frame img{max-width:100%;height:auto;background-color:#2a2440;
  background-image:linear-gradient(#ffffff10 1px,transparent 1px),linear-gradient(90deg,#ffffff10 1px,transparent 1px);
  background-size:4px 4px;border-radius:4px}
.frame.hit img{outline:2px solid #e0566b55}
.scenes{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
.scene img{width:100%;max-width:640px;height:auto;border-radius:4px;display:block}
.scene{flex:1 1 300px;margin:0}
.bggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
figure{margin:0}
figcaption{font-size:11px;color:#9a93ad;margin-top:4px}
ul{margin:0;padding-left:18px;font-size:13px}
ul span{color:#9a93ad;font-size:12px}
.none{color:#e0a05e;font-size:13px}
.warn{color:#ff8a8a;font-size:13px;margin:8px 0}
</style></head><body>
<h1>Hanzi Quest sprites</h1>
<p class="meta">${v2names.length} sprites · game version ${esc(VERSION)} · exported ${TODAY}</p>
<div class="legend">${legend}</div>
<h3>Sprites</h3>
<div class="grid">
${v2cards}
${overlayCards}
</div>
<h3>Backgrounds</h3>
<div class="bggrid">
${bgCards}
</div>
</body></html>
`;

const outDir = path.join(ROOT, "review");
fs.mkdirSync(path.join(outDir, "sprites"), { recursive: true });
for (const name of Object.keys(A.SPR))
  fs.writeFileSync(path.join(outDir, "sprites", name + ".png"), png(bufRGBA(A, A.sprFrame(A.SPR[name], {})), 8));
const out = path.join(outDir, "hanzi-quest-sprites.html");
fs.writeFileSync(out, html);
console.log("Wrote " + path.relative(ROOT, out) + " and " + Object.keys(A.SPR).length + " PNGs in review/sprites/");
