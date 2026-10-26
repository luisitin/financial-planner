// qa/households/run.mjs -- load a case's plan into the SANDBOX, walk the pages, read the
// numbers off the screen and compare them with the tester's own math (lib/expect.mjs).
//   node qa/households/run.mjs 08-retired/base/H-0801-base.md         one case
//   node qa/households/run.mjs 08-retired/debts                       a folder
//   node qa/households/run.mjs 08-retired --limit 5 --mark            first 5, write status into the .md files
//   node qa/households/run.mjs --all --mark                           everything (about 8 s per case)
//   node qa/households/run.mjs --all --untested --mark                only cases not yet marked pass
// Results: qa/households/results/<id>.json and results/SUMMARY.md. Exit code 1 if any case fails.
// Needs the app running on 127.0.0.1:8787 (tools/drive.mjs does the driving; sandbox only).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expectAll } from "./lib/expect.mjs";
import { TODAY } from "./lib/catalog.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i >= 0) { args.splice(i, 1); return true; } return false; };
const opt = (n, d) => { const i = args.indexOf(n); if (i >= 0) { const v = args[i + 1]; args.splice(i, 2); return v; } return d; };
const mark = flag("--mark"), all = flag("--all"), verbose = flag("--verbose"), untestedOnly = flag("--untested");
const limit = Number(opt("--limit", "0"));
const targets = all ? [HERE] : args.map((a) => path.isAbsolute(a) ? a : path.join(HERE, a));

const files = [];
for (const t of targets) {
  if (!fs.existsSync(t)) { console.error("not found: " + t); process.exit(2); }
  if (fs.statSync(t).isDirectory()) { const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "results" && e.name !== "lib") walk(p); else if (e.isFile() && /^H-\d{4}-.*\.md$/.test(e.name)) files.push(p); } }; walk(t); }
  else files.push(t);
}
files.sort();
const pending = untestedOnly ? files.filter((f) => !/^- status: pass /m.test(fs.readFileSync(f, "utf8"))) : files;
const todo = limit ? pending.slice(0, limit) : pending;
if (!todo.length) { console.error("no case files"); process.exit(2); }

const TMP = path.join(HERE, ".tmp"), RES = path.join(HERE, "results");
fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(RES, { recursive: true });
const COLLECT = path.join(TMP, "collect.js");
fs.writeFileSync(COLLECT, `
const pages = ["household/people", "cashflow/income", "cashflow/expenses", "balance/net-worth", "balance/liquidity", "balance/liabilities", "goals/goals", "overview/alerts"];
const out = {};
for (const p of pages) { await qa.go(p); await qa.sleep(350); out[p] = qa.pageText().replace(/\\u200B/g, ""); }
return out;
`);

const N = (s) => s == null ? null : Number(String(s).replace(/[$,\s]/g, "").replace(/^-\\$/, "-"));
const money = (re, t) => { const m = re.exec(t); return m ? N(m[1]) : null; };
function parsePages(T) {
  const P = T["household/people"] ?? "", I = T["cashflow/income"] ?? "", E = T["cashflow/expenses"] ?? "", W = T["balance/net-worth"] ?? "", L = T["balance/liquidity"] ?? "", D = T["balance/liabilities"] ?? "", G = T["goals/goals"] ?? "", A = T["overview/alerts"] ?? "";
  const a = {};
  const pc = /^(\d+)\nPeople\n([^\n]*)/m.exec(P); a.peopleCount = pc ? Number(pc[1]) : null; a.adults = pc ? (Number((/(\d+) adult/.exec(pc[2]) || [])[1]) || 0) : null; a.dependents = pc ? (Number((/(\d+) dependent/.exec(pc[2]) || [])[1]) || 0) : null;
  a.horizonYears = (() => { const m = /(\d+) years\nThe plan must last/.exec(P); return m ? Number(m[1]) : null; })();
  a.retireTile = (() => { const m = /\n(now|\d+)\n((?:Years until .+ retires)|(?:.+ is retired))\n/.exec(P); return m ? m[1] : null; })();
  a.incomeMonthly = money(/(-?\$[\d,]+)\nPer month\n\$[\d,]+ a year/, I); a.incomeYearly = money(/\$[\d,]+\nPer month\n(\$[\d,]+) a year/, I); a.incomeNextYear = money(/(\$[\d,]+)\nNext year/, I); a.incomeOneTime = money(/(\$[\d,]+)\nOne-time amounts/, I);
  a.expensesMonthly = money(/(-?\$[\d,]+)\nPer month\n\$[\d,]+ a year/, E); a.mustPay = money(/(\$[\d,]+)\nMust pay/, E); a.niceToHave = money(/(\$[\d,]+)\nNice to have/, E); a.leftOver = money(/(-?\$[\d,]+)\nLeft over/, E) ?? (() => { const m = /\$([\d,]+)\nShort\n/.exec(E); return m ? -N(m[1]) : null; })();
  a.netWorth = money(/(-?\$[\d,]+)\nNet worth/, W); a.own = money(/(-?\$[\d,]+)\nYou own/, W); a.owe = money(/(\$[\d,]+)\nYou owe/, W); a.invested = money(/(-?\$[\d,]+)\nInvested for later/, W);
  a.usableToday = money(/(-?\$[\d,]+)\nUsable today/, L); a.runwayMonths = (() => { const m = /([\d.]+)\+?\nMonths of must-pay bills/.exec(L); return m ? Number(m[1]) : null; })(); a.efTarget = money(/(\$[\d,]+)\nEmergency fund target/, L); a.week = money(/(\$[\d,]+)\nSellable within a week/, L);
  const dm = /(\$[\d,]+)\nYou owe\n(\d+) debts?/.exec(D); a.debtOwed = dm ? N(dm[1]) : null; a.debtCount = dm ? Number(dm[2]) : null; a.debtPayments = money(/(\$[\d,]+)\nPaying each month/, D); a.debtInterest = money(/(\$[\d,]+)\nInterest each month/, D); a.dtiPct = (() => { const m = /(\d+)%\nDebt payments vs income/.exec(D); return m ? Number(m[1]) : null; })();
  const gc = /^(\d+)\nGoals\n/m.exec(G); a.goalCount = gc ? Number(gc[1]) : null; const gs = /(-?\$[\d,]+)\nSaved so far\nof (\$[\d,]+) in total/.exec(G); a.goalsFunded = gs ? N(gs[1]) : null; a.goalsTarget = gs ? N(gs[2]) : null; a.goalsNeeded = money(/(\$[\d,]+)\nNeeded each month/, G);
  const ac = /(\d+) things? to look at/.exec(A); a.alerts = ac ? Number(ac[1]) : (/all clear|nothing needs/i.test(A) ? 0 : null);
  return a;
}

function compare(e, a) {
  const c = [];
  const add = (name, exp, act, tol = 1) => { if (exp === null || exp === undefined) return; if (act === null || act === undefined) { c.push({ name, expected: exp, actual: null, ok: null }); return; } const ok = typeof exp === "number" ? Math.abs(exp - act) <= tol : exp === act; c.push({ name, expected: typeof exp === "number" ? Math.round(exp * 100) / 100 : exp, actual: act, ok }); };
  add("people.count", e.people.count, a.peopleCount, 0); if (e.people.count) { add("people.adults", e.people.adults, a.adults, 0); add("people.dependents", e.people.dependents, a.dependents, 0); }
  add("people.horizonYears", e.people.horizonYears, a.horizonYears, 0);
  if (e.people.me && e.people.me.yearsToRetirement !== null) add("people.retireTile", e.people.me.retired ? "now" : String(e.people.me.yearsToRetirement), a.retireTile, 0);
  if (e.income.count) { add("income.monthly", e.income.monthly, a.incomeMonthly); add("income.yearly", e.income.yearly, a.incomeYearly); add("income.nextYear", e.income.nextYear, a.incomeNextYear); if (e.income.oneTime) add("income.oneTime", e.income.oneTime, a.incomeOneTime); }
  if (e.expenses.count) { add("expenses.monthly", e.expenses.monthly, a.expensesMonthly); add("expenses.mustPay", e.expenses.essentialMonthly, a.mustPay); add("expenses.niceToHave", e.expenses.optionalMonthly, a.niceToHave); add("expenses.leftOver", e.expenses.leftOver, a.leftOver); }
  if (e.netWorth.count) { add("netWorth.net", e.netWorth.netWorth, a.netWorth); add("netWorth.own", e.netWorth.assets, a.own); add("netWorth.owe", e.netWorth.liabilities, a.owe); add("netWorth.invested", e.netWorth.investable, a.invested); add("liquidity.now", e.liquidity.now, a.usableToday); add("liquidity.week", e.liquidity.week, a.week); add("liquidity.runwayMonths", e.liquidity.runwayMonths === null ? null : (e.liquidity.runwayMonths >= 100 ? 100 : e.liquidity.runwayMonths < 2 ? Math.round(e.liquidity.runwayMonths * 10) / 10 : Math.round(e.liquidity.runwayMonths)), a.runwayMonths, 0.01); if (e.liquidity.target) add("liquidity.target", e.liquidity.target, a.efTarget); }
  if (e.debts.count) { add("debts.owed", e.debts.owed, a.debtOwed); add("debts.count", e.debts.count, a.debtCount, 0); add("debts.payments", e.debts.payments, a.debtPayments); add("debts.interest", e.debts.interestMonthly, a.debtInterest); if (e.debts.dti !== null) add("debts.dtiPct", Math.round(e.debts.dti * 100), a.dtiPct, 1); }
  if (e.goals.count) { add("goals.count", e.goals.count, a.goalCount, 0); add("goals.funded", e.goals.totalFunded, a.goalsFunded); add("goals.target", e.goals.totalTarget, a.goalsTarget); add("goals.needed", e.goals.neededMonthly, a.goalsNeeded); }
  return c;
}

const summary = [];
let failed = 0;
for (const file of todo) {
  const md = fs.readFileSync(file, "utf8");
  const id = (/^# (H-\d{4})/m.exec(md) || [])[1] ?? path.basename(file, ".md");
  const json = (/```json\n([\s\S]*?)\n```/.exec(md) || [])[1];
  if (!json) { console.error(`${id}: no plan JSON block`); continue; }
  const plan = JSON.parse(json);
  const expected = expectAll(plan, TODAY);
  const seed = path.join(TMP, `seed-${id}.js`);
  fs.writeFileSync(seed, `if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("sandbox only");\nlocalStorage.setItem("planner.plan.sandbox", ${JSON.stringify(JSON.stringify(plan))});\nreturn "seeded ${id}";\n`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "drive.mjs"), "overview/dashboard", "--script", path.relative(ROOT, seed), "--script", path.relative(ROOT, COLLECT), "--profile", `hh-${id}`, "--settle", "600"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let out = null; try { out = JSON.parse(r.stdout); } catch { }
  const texts = out?.results?.[1]?.result ?? null;
  const errors = [...(out?.errors ?? []), ...(out?.results ?? []).filter((x) => x.threw).map((x) => x.threw)];
  if (!out) errors.push("drive.mjs produced no JSON: " + (r.stderr || "").slice(0, 300));
  const actual = texts ? parsePages(texts) : {};
  const checks = texts ? compare(expected, actual) : [];
  const bad = checks.filter((c) => c.ok === false), unparsed = checks.filter((c) => c.ok === null);
  const pass = !errors.length && !bad.length;
  const status = pass ? "pass" : "fail";
  if (!pass) failed++;
  const result = { id, file: path.relative(HERE, file), status, seconds: Math.round((Date.now() - t0) / 100) / 10, errors, consoleMessages: out?.console ?? [], checks, unparsed: unparsed.map((c) => c.name), pages: verbose ? texts : undefined };
  fs.writeFileSync(path.join(RES, `${id}.json`), JSON.stringify(result, null, 1));
  const line = `${status.toUpperCase()}  ${id}  ${path.relative(HERE, file)}  ${bad.length ? "wrong: " + bad.map((c) => `${c.name} expected ${c.expected} got ${c.actual}`).join("; ") : ""}${unparsed.length ? "  (not read: " + unparsed.map((c) => c.name).join(", ") + ")" : ""}${errors.length ? "  errors: " + errors.join(" | ").slice(0, 200) : ""}`;
  console.log(line);
  summary.push(`| ${id} | ${status} | ${path.relative(HERE, file).replace(/\\/g, "/")} | ${bad.map((c) => `${c.name}: expected ${c.expected}, got ${c.actual}`).join("; ") || (errors.length ? errors.join(" | ").slice(0, 120) : "")} |`);
  if (mark) {
    const stamp = pass ? `pass ${new Date().toISOString().slice(0, 10)}` : `fail (results/${id}.json)`;
    fs.writeFileSync(file, md.replace(/^- status: .*$/m, `- status: ${stamp}   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)`), "utf8");
    const idx = path.join(HERE, "INDEX.md");
    if (fs.existsSync(idx)) fs.writeFileSync(idx, fs.readFileSync(idx, "utf8").replace(new RegExp(`^(\\| ${id} \\|.*\\| )[^|]*\\|$`, "m"), `$1${stamp} |`), "utf8");
  }
  try { fs.rmSync(path.join(ROOT, "shots", `.qa-hh-${id}`), { recursive: true, force: true }); } catch { }
}
const sumFile = path.join(RES, "SUMMARY.md");
const prev = fs.existsSync(sumFile) ? fs.readFileSync(sumFile, "utf8").split("\n").filter((l) => l.startsWith("| H-")) : [];
const merged = new Map(prev.map((l) => [l.split("|")[1].trim(), l]));
for (const l of summary) merged.set(l.split("|")[1].trim(), l);
fs.writeFileSync(sumFile, [`# Household runs (${merged.size} cases recorded, last run ${new Date().toISOString().slice(0, 16).replace("T", " ")})`, ``, `| id | status | case | wrong |`, `|---|---|---|---|`, ...[...merged.values()].sort(), ``].join("\n"), "utf8");
console.log(`\n${todo.length} run, ${failed} failed. Results in qa/households/results/`);
process.exit(failed ? 1 : 0);
