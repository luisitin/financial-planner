// tests/wording.test.mjs -- the words on screen stay American and plain.
//
// The app is for people in the United States. This scans every string and template literal in
// modules/**/*.js and core/**/*.js (text people read) for British spellings and words, for the insurance
// noun "cover" (US: "coverage", "health insurance", "life insurance"), and for a few names and slips that
// were fixed in the 2026-11-07 wording sweep, so they cannot come back. Each message names the US form.
//
// What it leaves alone on purpose:
//   - code: identifiers, object keys, class names and comments are not literals, and verbs are not on the
//     lists ("would cover", "covers every year", "credits cover the tax");
//   - search aliases and glossary `aka` lists that hold the British spelling so typing it still finds the page
//     (an `aliases:` / `aka:` line), the route segment "uncategorised", the word lists of the note parser
//     (ai/notes: it must understand "fortnight" and "whilst" when someone types them), the builder inventory
//     (overview/guesses/coverage.js, never shown) and core/search.js (what people type);
//   - claude-a's pages (docs/WORKBOARD.md lanes): listed as todo with their counts until they are fixed there.
// Test names and tests/golden/** are not scanned.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

// ---- the rules: [pattern, what to write instead]
const NOUN_COVER = "health|life|term|disability|vision|dental|family|self-only|marketplace|dwelling|liability|umbrella|HSA|job|single|work";
export const RULES = [
  [/\binstalments?\b/i, "installment(s)"],
  [/\bcancell(?:ed|ing)\b/i, "canceled / canceling"],
  [/\b(?:label|model|travel|level|signal|fuel)l(?:ed|ing)\b/i, "labeled, modeled, traveled (one l)"],
  [/\blicences?\b/i, "license(s)"],
  [/\benrolments?\b/i, "enrollment"],
  [/\bharbours?\b/i, "harbor"],
  [/\b(?:realis|categoris|prioritis|memorialis|summaris|organis|recognis|minimis|maximis|authoris|customis|utilis)(?:e|es|ed|ing|er|ers|ation|ations)\b/i, "the -ize spelling (realize, categorize, prioritize...)"],
  [/\bcolour(?:s|ed|ful)?\b/i, "color"],
  [/\bcentres?\b/i, "center(s)"],
  [/\bfortnights?\b/i, "two weeks"],
  [/\bwhilst\b/i, "while"],
  [/\bgrey(?:s|ish)?\b/i, "gray"],
  [/\bMum(?:'s|s)?\b/, "Mom"],
  [/\bpay rises?\b/i, "pay raise(s)"],
  [/\bnext working day\b/i, "next business day"],
  [/\bpay slips?\b/i, "pay stub(s)"],
  [/\bone-off\b/i, "one-time"],
  [/\btoday['’]s money\b/i, "today's dollars"],
  [/\bleft-over\b/i, "leftover"],
  [/\bdebt free\b/i, "debt-free"],
  [/\b(?:un)?ticked\b|\buntick\b|\bticking\b|\btick (?:a|the|each|that|it|if|box|this)\b/i, "check / uncheck (a box)"],
  [/\b(?:safety|cash) cushion\b/i, "emergency fund"],
  // a phrase put where a noun was: "could be cut" and "one-time" are not nouns
  [/\b(?:every|no|these \w+|is|a) could be cuts?\b|\bcould be cuts\b|\bcould be cut (?:expenses?|items?|costs?)\b/i, "expenses you could cut / everything that could be cut (\"could be cut\" is not a noun)"],
  [/\b(?:the|a|of) one-time(?=\s*$|[.,;:?!)])/i, "a one-time sum / cost (\"one-time\" is not a noun)"],
  // the insurance noun
  [new RegExp(`\\b(?:${NOUN_COVER}) cover(?![A-Za-z-])`, "i"), "coverage, or health / life / disability insurance (cover is only a verb in US English: it covers, would cover)"],
  [/\b(?:of|more|no|extra|your|the same|with|without|new|the new|term|that|this|any|some|less|how much) cover(?![A-Za-z-])/i, "coverage (or insurance)"],
  [/\bcover (?:on file|needed|you have|would pay|through work|that lasts)\b/i, "coverage (or insurance)"],
  [/(?:^|[.!?:"] )Cover (?:needed|for your|you|through|above|on |that|would)\b/, "Coverage / Life insurance"],
  // page names
  [/(?<!Retirement )\bContributions page\b/, "Retirement contributions page"],
  [/\b(?:the )?Projection page\b/, "Will the money last?"],
  [/\bthe HSA page\b/, "the HSA and FSA page"],
  [/\bState page\b/, "State tax page"],
  [/\bon Accounts\b/, "on Net worth"],
];

// ---- a small lexer: the text of the string and template literals in JS source (comments, code and regexes are skipped)
const BEFORE_REGEX = new Set(["return", "typeof", "in", "of", "case", "delete", "void", "throw", "new", "else", "do", "yield", "await", "instanceof"]);
export function literals(src) {
  const n = src.length, out = [];
  let i = 0, prev = "";
  function str(q) {
    const start = i + 1; i++;
    while (i < n && src[i] !== q) { if (src[i] === "\\") i++; if (src[i] === "\n") break; i++; }
    out.push([start, Math.min(i, n)]); i++;
  }
  function tpl() {
    i++; let start = i;
    while (i < n && src[i] !== "`") {
      if (src[i] === "\\") { i += 2; continue; }
      if (src[i] === "$" && src[i + 1] === "{") { out.push([start, i]); i += 2; code(true); i++; start = i; continue; }
      i++;
    }
    out.push([start, Math.min(i, n)]); i++;
  }
  function regex() {
    i++; let cls = false;
    while (i < n) { const c = src[i]; if (c === "\\") { i += 2; continue; } if (c === "\n") break; if (c === "[") cls = true; else if (c === "]") cls = false; else if (c === "/" && !cls) break; i++; }
    i++; while (i < n && /[a-z]/i.test(src[i])) i++;
  }
  function code(inTpl) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
      if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === '"' || c === "'") { str(c); prev = "a"; continue; }
      if (c === "`") { tpl(); prev = "a"; continue; }
      if (c === "/") { if (prev === "" || prev === "p" || (prev.startsWith("id:") && BEFORE_REGEX.has(prev.slice(3)))) { regex(); prev = "a"; continue; } i++; prev = "p"; continue; }
      if (c === "{") { depth++; i++; prev = "p"; continue; }
      if (c === "}") { if (depth === 0 && inTpl) return; depth--; i++; prev = "}"; continue; }
      if (c === ")" || c === "]") { prev = c; i++; continue; }
      if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(src[j])) j++; prev = "id:" + src.slice(i, j); i = j; continue; }
      if (/[0-9]/.test(c)) { while (i < n && /[\w.]/.test(src[i])) i++; prev = "a"; continue; }
      if (/\s/.test(c)) { i++; continue; }
      prev = "p"; i++;
    }
  }
  code(false);
  return out.map(([a, b]) => ({ at: a, text: src.slice(a, b) }));
}

// ---- what is left alone
const ALIAS_LINE = /\b(?:aliases|aka)\b["']?\s*:/;
const ALLOWED_FILES = [
  /^modules\/ai\/notes\/compute\.js$/,              // the parser must understand "fortnight" and "whilst" when someone types them
  /^modules\/overview\/guesses\/coverage\.js$/,     // builder inventory, never shown
  /^core\/search\.js$/,                              // what people type to find a page
  /^modules\/overview\/guesses\/data\//,             // generated from cited sources and tools/build-guess-data.mjs
];
const ALLOWED_LITERALS = new Set(["uncategorised", "utilisation"]); // the route segment #/transactions/ledger/uncategorised; the data key of the card-limits ratio
// claude-a's lane (docs/WORKBOARD.md): listed as todo until claude-a fixes them
export const CLAUDE_A_LANE = [
  "modules/balance/projection", "modules/balance/statement", "modules/cashflow/statement", "modules/debt/consolidation", "modules/debt/student-loans",
  "modules/goals/charitable", "modules/goals/emergency-fund", "modules/goals/travel", "modules/goals/vehicle", "modules/taxes/documents",
  "modules/taxes/filing-status", "modules/taxes/self-employment", "modules/taxes/state",
];

/** the slips in one JS source: [{ line, text, rule }] */
export function slipsIn(rel, src) {
  if (ALLOWED_FILES.some((re) => re.test(rel))) return [];
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") lineStarts.push(i + 1);
  const lineOf = (at) => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineStarts[m] <= at) lo = m; else hi = m - 1; } return lo; };
  const found = [], seen = new Set();
  for (const lit of literals(src)) {
    if (ALLOWED_LITERALS.has(lit.text)) continue;
    for (const [re, us] of RULES) {
      const m = re.exec(lit.text);
      if (!m) continue;
      const li = lineOf(lit.at + m.index);
      const lineText = src.slice(lineStarts[li], lineStarts[li + 1] ?? src.length);
      if (ALIAS_LINE.test(lineText) || seen.has(`${li}:${m[0]}`)) continue;
      seen.add(`${li}:${m[0]}`);
      found.push({ line: li + 1, text: lit.text.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25).replace(/\s+/g, " "), us, hit: m[0] });
    }
  }
  return found;
}

function* jsFiles(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== "node_modules") yield* jsFiles(rel); }
    else if (/\.js$/.test(e.name) && rel !== "modules/registry.js") yield rel;
  }
}

const mine = [], lane = new Map();
const t0 = Date.now();
for (const dir of ["modules", "core"]) {
  for (const rel of jsFiles(dir)) {
    const slips = slipsIn(rel, fs.readFileSync(path.join(ROOT, rel), "utf8"));
    if (!slips.length) continue;
    const l = CLAUDE_A_LANE.find((d) => rel.startsWith(d + "/"));
    if (l) lane.set(rel, slips); else for (const s of slips) mine.push({ rel, ...s });
  }
}
const scanMs = Date.now() - t0;

test("no British spelling or insurance 'cover' noun in the words on screen", () => {
  const msg = mine.slice(0, 40).map((s) => `${s.rel}:${s.line} "${s.text}" -> write: ${s.us}`).join("\n");
  assert.equal(mine.length, 0, `${mine.length} wording slip(s) (US English, see tests/wording.test.mjs):\n${msg}${mine.length > 40 ? "\n..." : ""}`);
});

test("the scan is fast (under 5 s for the whole app)", () => {
  assert.ok(scanMs < 5000, `scanning took ${scanMs} ms`);
});

for (const [rel, slips] of [...lane].sort()) {
  test(`todo (claude-a's lane) ${rel}: ${slips.length} slip(s) to fix, e.g. "${slips[0].hit}"`, { todo: "claude-a's page; the list is in the wording sweep's claude-a message" }, () => {
    assert.equal(slips.length, 0, slips.slice(0, 8).map((s) => `line ${s.line} "${s.text}" -> ${s.us}`).join("\n"));
  });
}

// ---- the scanner itself: what it must flag, what it must leave alone
const flagged = (src) => slipsIn("modules/x/y.js", src).map((s) => s.hit).sort();
test("the scanner flags the slips", () => {
  assert.deepEqual(flagged('const a = "Cover needed and health cover";'), ["Cover needed", "health cover"].sort());
  assert.deepEqual(flagged("const a = `Term life cover on ${who} ends`;"), ["life cover"]);
  assert.deepEqual(flagged('const a = "Fees and licences";'), ["licences"]);
  assert.deepEqual(flagged('const a = "tick the box";'), ["tick the"]);
  assert.deepEqual(flagged('const a = "a safety cushion";'), ["safety cushion"]);
});
test("the scanner leaves verbs, identifiers, comments and aliases alone", () => {
  assert.deepEqual(flagged('const a = "Social Security covers your spending; credits cover the tax; it would cover the rest";'), []);
  assert.deepEqual(flagged("const lifeCover = 1; const b = { every: 'cover', key: 'health-cover' }; // health cover, licences\n"), []);
  assert.deepEqual(flagged('const m = { aliases: ["safe harbor", "safe harbour"] };'), []);
  assert.deepEqual(flagged("const r = /health cover/; const s = 'uncategorised';"), []);
  assert.deepEqual(flagged('const a = "the family coverage and the self-only coverage";'), []);
});

// ---- checks added by the wording sweep's final verify (2026-11-07)
test("every search alias is one phrase (no quotes inside an alias)", () => {
  const bad = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const id of fs.readdirSync(path.join(ROOT, "modules", g.name))) {
      const rel = `modules/${g.name}/${id}/module.js`;
      if (!fs.existsSync(path.join(ROOT, rel))) continue;
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      const m = /\baliases\s*:\s*\[([^\]]*)\]/.exec(src);
      if (!m) continue;
      for (const lit of literals(m[1])) if (/["'`]/.test(lit.text.replace(/\\(["'`])/g, "$1")) || /\\/.test(lit.text)) bad.push(`${rel}: ${JSON.stringify(lit.text)}`);
    }
  }
  assert.deepEqual(bad, [], `aliases with quotes inside (two phrases glued into one):\n${bad.join("\n")}`);
});

test("docs/MODULE_CATALOG.md names each page as its menu does (AGENTS.md rule 9)", () => {
  const rows = new Map();
  for (const line of fs.readFileSync(path.join(ROOT, "docs/MODULE_CATALOG.md"), "utf8").split("\n")) {
    const m = /^\| `([\w-]+\/[\w-]+)` \| ([^|]+) \|/.exec(line);
    if (m) rows.set(m[1], m[2].trim());
  }
  const off = [];
  for (const [key, title] of rows) {
    const f = path.join(ROOT, "modules", key, "module.js");
    if (!fs.existsSync(f)) continue;
    const t = /^\s*title:\s*"((?:[^"\\]|\\.)*)"/m.exec(fs.readFileSync(f, "utf8"))?.[1];
    if (t && t !== title) off.push(`${key}: catalog "${title}", menu "${t}"`);
  }
  assert.deepEqual(off, [], off.join("\n"));
});

test("pages read right: a page name keeps its capitals and one stop; a sentence ends before the next starts", async () => {
  const { pageText } = await import("../qa/fixtures/fake-dom.mjs");
  const { familyPlan } = await import("../qa/fixtures/family-plan.mjs");
  const T = "2026-11-07";
  const backtest = await pageText(new URL("../modules/investments/backtest/view.js", import.meta.url), familyPlan(T), T);
  assert.match(backtest, /Solid: the mix on Will the money last\? Dashed: /, "the page name keeps its capital W, with no period after its question mark");
  assert.doesNotMatch(backtest, /\?\.|will the money last/);
  const gains = await pageText(new URL("../modules/taxes/capital-gains/view.js", import.meta.url), familyPlan(T), T);
  assert.match(gains, /calls it "cost basis"\)\. Selling a home you rented out\?/, "a period ends the sentence before \"Selling a home\"");
});

test("the new rules flag the phrase-for-noun slips and leave the right uses alone", () => {
  assert.deepEqual(flagged('const a = "Cutting every could be cut ($300 a month)"; const b = "There are no could be cut expenses";'), ["every could be cut", "no could be cut"]);
  assert.deepEqual(flagged('const a = "Year of the one-time";'), ["the one-time"]);
  assert.deepEqual(flagged('const a = "Could be cut"; const b = "$150 every month · could be cut"; const c = "Cutting everything that could be cut"; const d = "plus the one-time ones"; const e = "Year of the one-time sum";'), []);
});
