// explore.mjs <rule> [kind-substring] [--by control|measured|page] [--n 60]: the breaks of a rule grouped, to find causes
import fs from "node:fs";
const D = "$SP/touch";
const j = JSON.parse(fs.readFileSync(process.env.SWEEP ?? `${D}/sweep-full.json`, "utf8"));
const av = process.argv.slice(2), pos = av.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--by", "--n"].includes(av[i - 1])));
const [rule, kindSub] = pos;
const opt = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const by = opt("--by", "control"), n = Number(opt("--n", 60)), src = process.argv.includes("--listed") ? j.listed : j.breaks;
const bs = src.filter((b) => (!rule || rule === "all" || b.rule === rule) && (!kindSub || b.kind.includes(kindSub)));
const key = (b) => by === "page" ? b.page : by === "measured" ? `${b.page} || ${b.control?.slice(0, 50)} || ${b.measured?.slice(0, 160)}` : by === "kind" ? `${b.rule} | ${b.kind}` : by === "state" ? `${b.kind} | ${b.state}` : `${b.page} || ${b.control?.slice(0, 70)}`;
const m = new Map();
for (const b of bs) { const k = key(b); const e = m.get(k) ?? { n: 0, hh: new Set(), ex: b }; e.n++; e.hh.add(b.household); m.set(k, e); }
console.log(`${bs.length} breaks, ${new Set(bs.map((b) => b.page)).size} pages, ${new Set(bs.map((b) => b.household)).size} households, ${new Set(bs.map((b) => b.page + "|" + b.control)).size} page-controls`);
for (const [k, e] of [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, n)) console.log(String(e.n).padStart(4), `[${[...e.hh].join(",")}]`, k, process.argv.includes("--ex") ? `\n        ${e.ex.state} :: ${e.ex.measured?.slice(0, 220)}` : "");
