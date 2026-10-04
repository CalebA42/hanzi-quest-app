#!/usr/bin/env node
/* Export every Chinese line in the game into a printable review document
   for a native speaker (issue #4), one section per level.

   Usage:  node tools/export-review.js
   Output: review/hanzi-quest-review.html  (open in a browser → Print → PDF)
   Then:   libreoffice --headless --convert-to odt:writer8 --infilter="HTML (StarWriter)" \
             --outdir review review/hanzi-quest-review.html

   Reads the dictionary and level data straight from index.html, so re-run it
   after edits to get an up-to-date copy. */
const fs = require("fs"), path = require("path"), vm = require("vm");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
// block 0 = dictionary D + L(), block 1 = LEVELS + CT (pure data, no DOM)
const { D, LEVELS, CT } = vm.runInNewContext(blocks[0] + blocks[1] + ";({D,LEVELS,CT})");
const VERSION = (src.match(/const APP_VERSION = "([^"]+)"/) || [])[1] || "?";
const TODAY = new Date().toLocaleDateString("en-CA");  // local YYYY-MM-DD

const LEVEL_EN = { 1: "The Cave", 2: "The Forest", 3: "The Town", 4: "The Island",
                   5: "Snow Mountain", 6: "The Ancient Temple" };
const NUM_ZH = ["", "一", "二", "三", "四", "五", "六"];

/* Interface text outside the level data (title screen, buttons, messages). */
const UI = [
  ["汉字冒险", "Game title"],
  ["开始", "Title screen button: New game"],
  ["继续", "Title screen button: Continue saved game"],
  ["重置", "Title screen button: Reset progress"],
  ["重置所有进度？", "Confirmation: Reset everything?"],
  ["已重置", "Message after reset: Reset done"],
  ["关于", "Title screen button: About"],
  ["选关", "Heading: Select level"],
  ["存", "Top bar button: Save"],
  ["已保存", "Message: Saved!"],
  ["已保存（仅本次）", "Message: Saved (this session only)"],
  ["没有游戏", "Message when saving with no game in progress: Nothing to save"],
  ["主页", "Top bar button: Home (back to title)"],
  ["回主页？", "Confirmation: Back to title? Unsaved progress is lost."],
  ["回主页", "Button after winning or losing: Back to title"],
  ["拼", "Button that shows pinyin (short for 拼音)"],
  ["第二关 unlocked!", "Message when the next level unlocks (第二关 … 第六关)"],
  ["你", "Battle screen: label for the player (You)"],
];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const OPEN = /^[“‘（《「]$/;
const ASCII = { "，": ",", "。": ".", "！": "!", "？": "?", "：": ":", "；": ";", "、": "," };
const zh = line => line.map(t => t.h).join("");
/* Word-by-word pinyin ("nǐ hǎo!") and gloss ("you · good"), as players see them in tooltips. */
function pinyinRow(line) {
  let out = "", glue = true;
  for (const t of line) {
    if (t.punct && !OPEN.test(t.h)) { out += t.h.replace(/[，。！？：；、]/g, c => ASCII[c]); continue; }   // closing punctuation hugs the word before
    out += (glue ? "" : " ") + (t.punct ? t.h : t.p);
    glue = !!t.punct;                                            // opening punctuation hugs the word after
  }
  return out;
}
const glossRow = line => line.filter(t => !t.punct).map(t => t.e).join("  ·  ");

/* Scenes in story order: walk from the start scene, then anything unreached. */
function sceneOrder(lv) {
  const seen = [], q = [lv.start];
  while (q.length) {
    const id = q.shift();
    if (!lv.nodes[id] || seen.includes(id)) continue;
    seen.push(id);
    const n = lv.nodes[id];
    [n.win, n.lose, n.flee, ...(n.choices || []).flatMap(c => [c.next, c.missing])]
      .filter(Boolean).forEach(x => q.push(x));
  }
  return seen.concat(Object.keys(lv.nodes).filter(id => !seen.includes(id)));
}

function row(num, kind, line, ctx) {
  return `<tr>
  <td class="num">${num}</td>
  <td class="kind">${kind}</td>
  <td class="text"><div class="zh">${esc(zh(line))}</div>
    <div class="py">${esc(pinyinRow(line))}</div>
    <div class="gl">${esc(glossRow(line))}</div>${ctx ? `<div class="ctx">${esc(ctx)}</div>` : ""}</td>
  <td class="ok">☐</td>
  <td class="notes"></td>
</tr>`;
}

/* Old-style table attributes too: LibreOffice's HTML import ignores most table CSS. */
const TABLE = `<table border="1" cellspacing="0" cellpadding="4" width="100%">`;
const TABLE_HEAD = `${TABLE}<thead><tr bgcolor="#e8e8e8"><th width="7%">#</th><th width="9%">Type</th><th width="46%">Chinese · pinyin · word meanings</th><th width="5%">OK</th><th width="33%">Corrections / comments</th></tr></thead><tbody>`;

const wordsSeen = new Set();
let levelsHtml = "", totalRows = 0;
for (const [n, lv] of Object.entries(LEVELS)) {
  let i = 0, rows = "";
  const newWords = [];
  const track = line => line.forEach(t => { if (!t.punct && !wordsSeen.has(t.h)) { wordsSeen.add(t.h); newWords.push(t.h); } });
  for (const id of sceneOrder(lv)) {
    const nd = lv.nodes[id];
    const label = nd.combat ? `Battle: ${zh(nd.combat.name)}` : nd.chip ? `Speaker: ${nd.chip}` : "";
    rows += `<tr class="scene" bgcolor="#f0f0f0"><td colspan="5">Scene <b>${esc(id)}</b>${label ? " · " + esc(label) : ""}${nd.victory ? " · level complete" : ""}</td></tr>`;
    if (nd.chip) { track([{ h: nd.chip, ...(D[nd.chip] ? { p: D[nd.chip][0], e: D[nd.chip][1] } : { punct: true }) }]); }
    if (nd.combat) { track(nd.combat.name); rows += row(`${n}-${++i}`, "Enemy", nd.combat.name, "Enemy name shown in battle"); }
    for (const l of nd.text || []) { track(l); rows += row(`${n}-${++i}`, "Story", l); }
    for (const c of nd.choices || []) {
      track(c.t);
      const ctx = [c.req && `Needs item ${c.req}`, c.give && `Player gets ${c.give}`,
                   c.heal && "Heals the player", c.danger && "Leads to a fight or danger"].filter(Boolean).join(" · ");
      rows += row(`${n}-${++i}`, "Option", c.t, ctx);
    }
  }
  totalRows += i;
  const words = newWords.filter(w => D[w]).map(w =>
    `<tr><td class="wzh">${esc(w)}</td><td class="wpy">${esc(D[w][0])}</td><td class="wen">${esc(D[w][1])}</td><td class="ok">☐</td><td class="notes"></td></tr>`).join("");
  levelsHtml += `
<section class="level">
<h2>第${NUM_ZH[n]}关 · ${esc(lv.name)} <span>Level ${n} · HSK ${lv.hsk} · ${LEVEL_EN[n]}</span></h2>
<p class="meta">${i} lines to check · scenes in story order</p>
${TABLE_HEAD}${rows}</tbody></table>
<h3>New words in this level <span>(pinyin and meaning shown when players hover a word)</span></h3>
${TABLE.replace("<table", '<table class="words"')}<thead><tr bgcolor="#e8e8e8"><th width="13%">Word</th><th width="16%">Pinyin</th><th width="30%">Meaning</th><th width="5%">OK</th><th width="36%">Corrections</th></tr></thead><tbody>${words}</tbody></table>
</section>`;
}

let ci = 0;
const combatRows = Object.entries(CT).map(([k, l]) => row(`B-${++ci}`, "Battle", l, {
  attack: "Battle button: attack", rest: "Battle button: rest", flee: "Battle button: run away",
  youHit: "After the player attacks", itHit: "After the enemy attacks", youRest: "After resting",
  itRan: "When the enemy runs away", youRan: "When the player runs away" }[k] || "")).join("");
const uiRows = UI.map(([z, en], j) => `<tr><td class="num">U-${j + 1}</td><td class="kind">Interface</td>
  <td class="text"><div class="zh">${esc(z)}</div><div class="ctx">${esc(en)}</div></td><td class="ok">☐</td><td class="notes"></td></tr>`).join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Hanzi Quest · Chinese text review</title>
<style>
@page{size:letter;margin:14mm 12mm}
body{font-family:"Noto Sans CJK SC","Noto Serif CJK SC","PingFang SC","Microsoft YaHei",sans-serif;
  color:#111;font-size:10pt;line-height:1.35;margin:0}
h1{font-size:22pt;margin:0 0 4pt}
h2{font-size:17pt;margin:0 0 2pt;page-break-before:always;break-before:page}
h2 span,h3 span{font-size:10pt;font-weight:normal;color:#555}
h3{font-size:12pt;margin:14pt 0 4pt}
.meta{color:#555;margin:0 0 6pt}
.cover p,.cover li{font-size:11pt}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th,td{border:1px solid #999;padding:3pt 5pt;vertical-align:top;text-align:left}
th{background:#e8e8e8;font-size:9pt}
tr{page-break-inside:avoid;break-inside:avoid}
tr.scene td{background:#f3f3f3;font-size:9pt;color:#333;border-top:2px solid #555}
td.num{font-size:8.5pt;color:#444;white-space:nowrap}
td.kind{font-size:8.5pt;color:#444}
td.ok{text-align:center;font-size:13pt}
.zh{font-size:15pt;line-height:1.4}
.py{font-size:9pt;color:#333}
.gl{font-size:8pt;color:#666}
.ctx{font-size:8pt;color:#7a4a00;font-style:italic}
td.wzh{font-size:13pt}
td.notes{height:30pt}
</style></head><body>
<section class="cover">
<h1>汉字冒险 · Hanzi Quest</h1>
<p><b>Chinese text review</b> · game version ${esc(VERSION)} · exported ${TODAY}</p>
<p>Thank you for helping! Hanzi Quest is a game for people learning to read Chinese.
Each level matches an HSK level (HSK 1 is the easiest, HSK 6 the hardest).
The Chinese was written by a learner, so it may contain mistakes or unnatural wording.</p>
<p><b>What to check for each line:</b></p>
<ul>
<li>Is it correct and natural Chinese?</li>
<li>Does it fit the level? (Words should be simple enough for that HSK level.)</li>
<li>Is the pinyin right? Pinyin is shown word by word, exactly as players see it.</li>
<li>Does the word meaning (grey line) match how the word is used in the sentence?</li>
</ul>
<p><b>How to mark it:</b> tick <b>OK</b> if the line is fine. Otherwise write the correct
version or a comment in the right-hand column. Please use the line number (for example <b>2-14</b>) if you
send corrections by message.</p>
<p><b>Line types:</b> <i>Story</i> = narration or dialogue the player reads ·
<i>Option</i> = a choice the player picks · <i>Enemy</i> = a monster's name in battle.
Brown italic notes explain the situation (for example, that an option needs an item).</p>
<p><b>Contents:</b> Levels 1–6 (${totalRows} lines, with each level's new words) ·
Battle messages (${ci} lines) · Interface text (${UI.length} items).</p>
<p class="meta">Reviewer: ______________________ &nbsp;&nbsp; Date: ______________</p>
</section>
${levelsHtml}
<section class="level">
<h2>Battle messages <span>Shown in every level's battles</span></h2>
${TABLE_HEAD}${combatRows}</tbody></table>
</section>
<section class="level">
<h2>Interface text <span>Menus, buttons, and messages</span></h2>
${TABLE_HEAD}${uiRows}</tbody></table>
</section>
</body></html>
`;

const outDir = path.join(ROOT, "review");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "hanzi-quest-review.html");
fs.writeFileSync(out, html);
console.log(`Wrote ${path.relative(ROOT, out)}: ${totalRows} level lines, ${ci} battle lines, ${UI.length} interface items, ${wordsSeen.size} words`);
