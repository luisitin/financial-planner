// merge the four chunk runs of the full sweep into one JSON (sweep-full.json), same shape as one run's --json
import fs from "node:fs";
const D = "$SP/touch";
const parts = ["A", "B", "C", "D"].map((k) => ({ k, j: JSON.parse(fs.readFileSync(`${D}/full/sweep-${k}.json`, "utf8")) }));
const out = { about: parts[0].j.about + " (the full sweep, run as four page-group chunks A-D with one browser each, merged)", day: parts[0].j.day, phone: parts[0].j.phone,
  chunks: parts.map(({ k, j }) => ({ chunk: k, seconds: j.seconds, pages: j.pages, runAgain: j.runAgain, browserLaunchedAgain: j.browserLaunchedAgain })),
  seconds: Math.max(...parts.map((p) => p.j.seconds)), secondsSum: parts.reduce((s, p) => s + p.j.seconds, 0),
  households: parts[0].j.households, pages: parts.flatMap((p) => p.j.pages), rulesRun: parts[0].j.rulesRun,
  runAgain: parts.reduce((s, p) => s + p.j.runAgain, 0), browserLaunchedAgain: parts.reduce((s, p) => s + p.j.browserLaunchedAgain, 0),
  counts: {}, checked: {}, byKind: {}, reach: {}, worst: {}, breaks: [], listed: [], notChecked: [], said: [], times: [], sources: parts[0].j.sources };
const cells = {};
for (const { j } of parts) {
  for (const [r, n] of Object.entries(j.counts)) out.counts[r] = (out.counts[r] ?? 0) + n;
  for (const [r, n] of Object.entries(j.checked)) out.checked[r] = (out.checked[r] ?? 0) + n;
  for (const [r, kinds] of Object.entries(j.byKind)) for (const [k, n] of Object.entries(kinds)) { (out.byKind[r] ??= {}); out.byKind[r][k] = (out.byKind[r][k] ?? 0) + n; }
  out.breaks.push(...j.breaks); out.listed.push(...j.listed); out.notChecked.push(...j.notChecked); out.said.push(...(j.said ?? [])); out.times.push(...j.times);
}
// reach: households x pages the rule was checked on is not in the JSON per cell; keep each chunk's "h x p" and sum the pages
for (const { j } of parts) for (const [r, s] of Object.entries(j.reach)) { const [h, p] = s.split(" x ").map(Number); const c = (cells[r] ??= { h: 0, p: 0 }); c.h = Math.max(c.h, h); c.p += p; }
for (const [r, c] of Object.entries(cells)) out.reach[r] = `${c.h} x ${c.p}`;
for (const r of Object.keys(out.counts)) {
  const m = {}; for (const b of out.breaks.filter((b) => b.rule === r)) m[b.page] = (m[b.page] ?? 0) + 1;
  out.worst[r] = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10);
}
out.times.sort((a, b) => b.s - a.s);
fs.writeFileSync(`${D}/sweep-full.json`, JSON.stringify(out, null, 1));
console.log("breaks", out.breaks.length, "listed", out.listed.length, "notChecked", out.notChecked.length, "longest chunk", out.seconds, "s");
for (const r of Object.keys(out.checked)) console.log(r.padEnd(14), String(out.checked[r]).padStart(6), String(out.counts[r] ?? 0).padStart(5), out.reach[r]);
