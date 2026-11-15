import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compute, search, find, forPlan, norm, shortNames, askMessages, sourceLabel, PLAN_WORDS } from "./compute.js";
import { TERMS, TOPICS } from "./data/terms.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const MODULES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const words = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean).length;
const SOURCES = /^https:\/\/([a-z0-9-]+\.)*(irs\.gov|ssa\.gov|medicare\.gov|investor\.gov|consumerfinance\.gov|finra\.org|studentaid\.gov|healthcare\.gov|law\.cornell\.edu|sec\.gov|bls\.gov|fdic\.gov|cms\.gov|dol\.gov|treasurydirect\.gov|federalreserve\.gov|usa\.gov|acf\.gov|benefits\.gov)\//;

/** Dollar figures the law fixes and never indexes, so they do not age: IRC 1211(b) ($3,000 of capital loss a year), IRC
 * 6654(e)(1) (no estimated-tax penalty under $1,000 owed), IRC 121(b) ($250,000 / $500,000 of home-sale profit). */
const FIXED_IN_LAW = new Set(["capital-loss", "estimated-tax", "home-sale-exclusion"]);

/** Every string and template text in a JavaScript source, in order (comments and regex literals skipped; a template's
 * `${...}` parts become a space and their own strings are read too). */
function strings(src) {
  const out = []; let i = 0, prev = "";
  const lit = (q) => {
    let s = ""; i++;
    while (i < src.length && src[i] !== q) {
      if (src[i] === "\\") { s += src[i + 1] ?? ""; i += 2; continue; }
      if (q === "`" && src[i] === "$" && src[i + 1] === "{") { i += 2; s += " "; code("}"); continue; }
      s += src[i++];
    }
    i++; out.push(s); prev = "x";
  };
  function code(close) {
    let depth = 0;
    while (i < src.length) {
      const c = src[i], d = src[i + 1];
      if (c === "/" && d === "/") { const e = src.indexOf("\n", i); i = e < 0 ? src.length : e; continue; }
      if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
      if (c === '"' || c === "'" || c === "`") { lit(c); continue; }
      if (c === "/" && (/^$|[(,=:[!&|?{};]$/.test(prev) || /\b(return|typeof|case)\s*$/.test(src.slice(Math.max(0, i - 8), i)))) {
        i++; let cls = false;
        while (i < src.length && (cls || src[i] !== "/")) { if (src[i] === "\\") i++; else if (src[i] === "[") cls = true; else if (src[i] === "]") cls = false; i++; }
        i++; while (/[a-z]/.test(src[i] ?? "")) i++;
        prev = "x"; continue;
      }
      if (close && c === "{") depth++;
      if (close && c === "}" && depth-- === 0) { i++; return; }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  code(null);
  return out;
}

test("every entry: a unique kebab-case id, a name, a plain definition of 40 words or fewer, a topic, a public source", () => {
  assert.ok(TERMS.length >= 100, `${TERMS.length} entries`);
  const ids = new Set(), names = new Map();
  for (const t of TERMS) {
    assert.match(t.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, t.id); assert.ok(!ids.has(t.id), `id ${t.id} twice`); ids.add(t.id);
    for (const n of [t.term, ...(t.aka ?? [])].map(norm)) { assert.ok(!names.has(n), `"${n}" names both ${names.get(n)} and ${t.id}`); names.set(n, t.id); }
    assert.ok(t.term && t.plain, t.id);
    assert.ok(words(t.plain) <= 40, `${t.id}: ${words(t.plain)} words`); assert.ok(words(t.example) <= 30, `${t.id} example: ${words(t.example)} words`);
    assert.ok(TOPICS.some((x) => x.key === t.topic), `${t.id}: topic ${t.topic}`);
    assert.match(t.sourceUrl, SOURCES, `${t.id}: ${t.sourceUrl}`); assert.ok(t.sourceName, t.id);
    assert.ok(FIXED_IN_LAW.has(t.id) || !/\$\s?\d/.test(t.plain), `${t.id}: a dollar figure in the definition ages; keep it to the example`);
  }
});

test("every page an entry points to exists (a page not built yet keeps its link; the view leaves its button out)", () => {
  for (const t of TERMS) for (const k of t.pages ?? []) assert.ok(fs.existsSync(path.join(MODULES, k, "module.js")), `${t.id}: no page ${k}`);
});

// not money words: the computer, the app, the sources' names, fund tickers, currency codes, date orders, form numbers
const NOT_MONEY = new Set(["PC", "US", "USA", "AI", "KB", "MB", "GB", "CSV", "PDF", "PDFs", "JSON", "URL", "ZIP", "OK", "IRS", "SSA", "BLS", "SEC", "FDIC", "FINRA", "CFPB", "KFF", "NYU", "NFDA", "CMS", "DOL", "HHS", "IBIT", "FBTC", "ETHA", "AM", "PM", "TV", "ID", "IDs", "QR", "PIN", "FAQ", "API", "LAN", "IP", "OFX", "QFX", "QIF", "TSV", "XLSX", "UTC", "DA", "ES", "NEC", "INT", "DIV", "ACA", "COVID", "SECURE", "CARES", "TCJA", "OBBBA", "NO", "YES", "ALL", "AND", "OR", "THE",
    "USD", "EUR", "GBP", "CAD", "MXN", "MDY", "DMY", "VTI", "FXAIX", "AAPL", "ACME", "ARB", "BTC",
    "DD",     // a form number: "Military discharge papers (DD 214)" (household/documents)
    "II",     // a form's part, a Roman numeral: "long-term sales on Part II" of Form 8949 (investments/tax-lots)
    "DIME",   // insurance/life-needs spells the rule out where it shows it: "Debts, Income, Mortgage, Education"
    "YNAB",   // a budgeting app's own name, like Monarch and Mint: "Moving from YNAB, Monarch or Mint?" (transactions/import)
]);
/** The money abbreviations in a text (capitals, 401(k), 403(b), 457(b)), as the scan below reads them. */
const abbreviations = (text) => String(text).match(/\b(?:[A-Z]{2,6}s?|401\(k\)|403\(b\)|457\(b\))(?![\w(])/g) ?? [];
const explained = (tok) => { const one = tok.replace(/s$/, ""); return NOT_MONEY.has(tok) || NOT_MONEY.has(one) || !!find(tok) || !!find(one); };

test("every money abbreviation in page titles, purposes, view text and compute labels is explained (data tables, fund names and form numbers are not checked)", () => {
  const missing = new Map();
  for (const g of fs.readdirSync(MODULES)) {
    const gd = path.join(MODULES, g);
    if (g.startsWith("_") || !fs.statSync(gd).isDirectory()) continue;
    for (const id of fs.readdirSync(gd)) {
      const d = path.join(gd, id);
      if (!fs.existsSync(path.join(d, "module.js"))) continue;
      const m = fs.readFileSync(path.join(d, "module.js"), "utf8");
      const text = [(m.match(/title: "([^"]+)"/) ?? [])[1], (m.match(/purpose: "([^"]+)"/) ?? [])[1]];
      // every string in the view with two words or more, or a lone abbreviation (a label, a button, a placeholder)
      if (fs.existsSync(path.join(d, "view.js")))
        for (const str of strings(fs.readFileSync(path.join(d, "view.js"), "utf8"))) if (/\S\s+\S/.test(str) || /^\s*[A-Z]{2,6}s?\s*$/.test(str)) text.push(str);
      // labels that a page's compute hands to its view ("HIPAA release" on estate/documents)
      if (fs.existsSync(path.join(d, "compute.js")))
        for (const x of fs.readFileSync(path.join(d, "compute.js"), "utf8").matchAll(/label:\s*"([^"]+)"/g)) text.push(x[1]);
      for (const tok of abbreviations(text.join(" "))) {
        if (explained(tok)) continue;
        if (!missing.has(tok)) missing.set(tok, new Set());
        missing.get(tok).add(`${g}/${id}`);
      }
    }
  }
  assert.deepEqual([...missing].map(([t, s]) => `${t} (${[...s].slice(0, 3).join(", ")})`), []);
});

test("the abbreviation scan reads every string: apostrophes in templates, short labels, comments and regexes skipped", () => {
  const src = "const a = `It's ${x ? \"DIME\" : 'Plan'} here`; // a TODO comment\nconst r = /QQQ/g; const s = 'Sam\\'s plan'; const b = a / 2;";
  assert.deepEqual(strings(src), ["DIME", "Plan", "It's   here", "Sam's plan"]);
});

test("search: own name exactly, an other name, names starting with it, a word in a name, all the words in a name, then the definitions", () => {
  const rmd = find("RMD");
  assert.ok(rmd, "RMD is explained");
  assert.equal(search("rmd")[0], rmd, "other names count as names");
  assert.equal(search("401(k)")[0], find("401(k)"), "401(k) keeps its brackets");
  assert.equal(search("  401(K) ")[0], find("401(k)"), "any case, extra spaces");
  assert.ok(find("Roth IRA"));
  const roth = search("roth");
  assert.equal(roth[0], find("Roth IRA")); assert.ok(roth.every((t) => /\broth/i.test(`${t.term} ${(t.aka ?? []).join(" ")} ${t.plain} ${t.example}`)));
  // the tiers, on a fixed list: own name, own name starts with it, a word in a name, the definition; "Surtax" holds
  // "tax" only inside a word, so it is not a match
  const T = [["def", "Other", "a tax on it"], ["sur", "Surtax"], ["estate", "Estate tax"], ["lot", "Tax lot"], ["tax", "Tax"]].map(([id, term, plain = "x"]) => ({ id, term, plain }));
  assert.deepEqual(search("tax", T).map((t) => t.id), ["tax", "lot", "estate", "def"]);
  assert.deepEqual(search("tax", [{ id: "z", term: "Zeta tax", plain: "x" }, { id: "e", term: "Estate tax", plain: "x" }]).map((t) => t.id), ["e", "z"], "ties A to Z");
  const O = [{ id: "aka", term: "Zed", aka: ["Fee"], plain: "x" }, { id: "own", term: "Fee", plain: "x" }, { id: "akastart", term: "Alpha", aka: ["Fee table"], plain: "x" }, { id: "ownstart", term: "Fee schedule", plain: "x" }];
  assert.deepEqual(search("fee", O).map((t) => t.id), ["own", "aka", "ownstart", "akastart"], "the entry's own name before an other name");
  const all = search("");
  assert.equal(all.length, TERMS.length);
  assert.ok(all.every((t, i) => i === 0 || all[i - 1].term.localeCompare(t.term, "en", { sensitivity: "base" }) <= 0), "A to Z");
  assert.deepEqual(search("zzzz not a word"), []);
  assert.equal(norm("Café 50/30/20!"), "cafe 50/30/20");
});

test("search: word starts only, any order, apostrophes, plurals, punctuation alone", () => {
  assert.equal(search("w-2").length, 1, "no match inside other words"); assert.equal(search("w-2")[0], find("Form W-2"));
  assert.equal(search("fica").length, 1);
  assert.deepEqual(search("magi").map((t) => t.id), ["modified-adjusted-gross-income"], "not Umbrella insurance's \"damaging\"");
  assert.ok(search("age").length < 20, `${search("age").length} matches for "age"`);
  assert.equal(norm("Today’s dollars"), "todays dollars");
  assert.equal(search("todays dollars")[0], find("Today's dollars"), "typed without the apostrophe");
  assert.equal(search("ira roth")[0], find("Roth IRA"), "words in another order");
  assert.equal(search("beneficiaries")[0], find("Beneficiary"));
  assert.equal(search("annuities")[0], find("Annuity"));
  assert.equal(search("losses")[0], find("Capital loss"));
  assert.equal(search("mortgage")[0], find("Mortgage"));
  assert.equal(search("Social Security")[0], find("Social Security"));
  assert.equal(search("equity compensation")[0], find("Equity compensation"));
  assert.deepEqual(search("$"), search(""), "punctuation alone is nothing typed");
  assert.ok(search("a").every((t) => [t.term, ...(t.aka ?? [])].some((n) => / a/.test(` ${norm(n)}`) || /[(/]a/.test(norm(n)))), "a single letter searches names only");
});

test("words for this household, from its accounts, work, shares and ages", () => {
  for (const ws of [...Object.values(PLAN_WORDS.account), PLAN_WORDS.business, ...Object.values(PLAN_WORDS.equity), PLAN_WORDS.children, PLAN_WORDS.age50, PLAN_WORDS.age60]) for (const w of ws) assert.ok(find(w), `"${w}" is in the glossary`);
  for (const k of Object.keys(PLAN_WORDS.account)) assert.ok(ACCOUNT_TYPES[k], `${k} is an account type`);
  const p = emptyPlan(); p.accounts = Object.keys(PLAN_WORDS.account).map((type, i) => ({ id: `a${i}`, type }));
  const got = forPlan(p, { today: TODAY }); for (const w of Object.values(PLAN_WORDS.account).flat()) assert.ok(got.includes(find(w)), w);
  const mine = forPlan(familyPlan(TODAY), { today: TODAY }).map((t) => t.term);
  for (const w of ["401(k)", "Roth IRA", "Self-employment tax", "Child tax credit"]) assert.ok(mine.includes(find(w).term), `${w} for the family: ${mine.join(", ")}`);
  assert.ok(!mine.includes(find("Medicare").term), "nobody in the family is 60");
  const older = familyPlan(TODAY); older.household.people[0].birthDate = "1960-01-01";
  assert.ok(forPlan(older, { today: TODAY }).includes(find("Medicare")));
  const q = emptyPlan(); q.household.people = [{ id: "s", role: "self", birthDate: "1976-12-31" }, { id: "k", role: "dependent", birthDate: "1950-01-01" }];
  const w2 = forPlan(q, { today: TODAY });
  assert.ok(w2.includes(find("Catch-up contribution")), "50 by the end of this year");
  assert.ok(!w2.includes(find("Medicare")), "a dependent's age does not count");
  q.household.people[0].birthDate = "1977-01-01"; assert.ok(!forPlan(q, { today: TODAY }).includes(find("Catch-up contribution")), "49 this year");
  const e = emptyPlan(); e.equity = { grants: [{ id: "g", kind: "rsu" }] };
  const rsu = forPlan(e, { today: TODAY }); assert.ok(rsu.includes(find("RSU")) && rsu.includes(find("Vesting")) && !rsu.includes(find("Stock option")));
  e.equity = { grants: [{ id: "o", kind: "option", optionType: "iso" }] };
  const iso = forPlan(e, { today: TODAY });
  assert.ok(iso.includes(find("Stock option")) && iso.includes(find("ISO")) && !iso.includes(find("RSU")) && !iso.includes(find("NSO")), "options only: no RSU");
  e.equity = { grants: [{ id: "o", kind: "option" }], espp: [{ id: "p" }] };
  const nso = forPlan(e, { today: TODAY }); assert.ok(nso.includes(find("NSO")) && nso.includes(find("ESPP")) && !nso.includes(find("ISO")));
  e.equity = { grants: [], espp: [{ id: "p" }] }; assert.deepEqual(forPlan(e, { today: TODAY }), [find("ESPP")], "a purchase plan alone");
  assert.deepEqual(forPlan(emptyPlan(), { today: TODAY }), []);
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.count, TERMS.length); assert.equal(d.topics.reduce((s, x) => s + x.count, 0), TERMS.length);
  assert.ok(d.topics.every((x) => x.count > 0 && x.label));
});

test("the short other names beside a word: abbreviations only, at most two, none already in its name", () => {
  assert.deepEqual(shortNames({ term: "Social Security and Medicare tax", aka: ["FICA", "payroll tax", "Medicare tax"] }), ["FICA"]);
  assert.deepEqual(shortNames({ term: "Health savings account (HSA)", aka: ["HSA", "health savings"] }), [], "HSA is already in the name");
  assert.deepEqual(shortNames({ term: "401(k)", aka: ["401k", "workplace retirement plan"] }), [], "lower-case letters are not abbreviations");
  assert.deepEqual(shortNames({ term: "Required minimum distribution", aka: ["RMD", "RMDs", "MRD", "required withdrawal"] }), ["RMD", "MRD"]);
  assert.deepEqual(shortNames({ term: "Form 1099", aka: ["1099", "1099-NEC", "1099-K"] }), [], "form numbers are not abbreviations");
  assert.deepEqual(shortNames({ term: "Escrow account", aka: [] }), []);
});

test("the question to the AI: the word only, no plan, no yearly limits", () => {
  const m = askMessages("bond ladder");
  assert.equal(m.length, 2);
  assert.match(m[0].content, /no current-year dollar limits/i);
  assert.equal(m[1].content, 'What does "bond ladder" mean?');
  assert.equal(askMessages(`  ${"x".repeat(200)} `)[1].content.length, 'What does "" mean?'.length + 80, "cut to 80 characters");
});

test("a source's name in plain words: the agency spelled out, one colon", () => {
  assert.equal(sourceLabel("CFPB: What is an escrow or impound account?"), "Consumer Financial Protection Bureau – What is an escrow or impound account?");
  assert.equal(sourceLabel("LII Wex: will"), "Cornell Law School's legal dictionary – will");
  assert.equal(sourceLabel("Cornell Law School LII Wex: trust"), "Cornell Law School's legal dictionary – trust");
  assert.equal(sourceLabel("SSA POMS DI 00115.015"), "Social Security staff manual DI 00115.015");
  assert.equal(sourceLabel("IRS: Topic no. 409, Capital gains and losses"), "IRS – Topic no. 409, Capital gains and losses");
  assert.equal(sourceLabel("FINRA: Bank products"), "FINRA (the brokers' watchdog) – Bank products");
  for (const t of TERMS) assert.ok(!/^(CFPB|SSA|LII|SEC|BLS|FDIC|DOL)\b/.test(sourceLabel(t.sourceName)) && !/:.*:/.test(sourceLabel(t.sourceName)), `${t.id}: ${sourceLabel(t.sourceName)}`);
});

// ---------------------------------------------------------------- invariance (gap list items 13 and 59, 2026-11-15)
// Adding the lessons and the word "Velocity banking" moves nothing else: over every qa/fixtures/*-plan.mjs plan, the 14
// households' base plans, the phone-built ones and the empty plan, compute() gives the very output it gave before (the
// new word taken out of the count and its topic), every entry that was there reads byte for byte as before, every search
// finds what it found before (the new word aside), and the page reads as before for four households once the new word's
// row and the lessons' rows are taken out. Checked by digests written down from the code before the change (3c0b8a1).
// To write them again after a deliberate change: PRINT=1 node --test modules/ai/glossary/module.test.mjs
const crypto = await import("node:crypto");
const { pathToFileURL } = await import("node:url");
const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
const phone = await import("../../../qa/fixtures/phone-households.mjs");
const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
const INV_FILE = new URL("./invariance.json", import.meta.url);
const INV_TODAY = "2026-11-15";
const NEW_WORDS = new Set(["velocity-banking"]);   // words added after 3c0b8a1
const digest = (x) => crypto.createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x)).digest("base64url").slice(0, 22);
const OLD_TERMS = TERMS.filter((t) => !NEW_WORDS.has(t.id));
async function invariancePlans() {
  const out = [];
  const dir = path.join(MODULES, "..", "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn() });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") out.push({ name: `phone ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
/** compute()'s output as the code before the new word gave it: the new word out of the count, its topic's count and the household's words. */
const asBefore = (out) => ({
  ...out, count: out.count - TERMS.filter((t) => NEW_WORDS.has(t.id)).length,
  topics: out.topics.map((x) => ({ ...x, count: x.count - TERMS.filter((t) => NEW_WORDS.has(t.id) && t.topic === x.key).length })),
  mine: out.mine.filter((t) => !NEW_WORDS.has(t.id)),
});
// what people type: every name and other name the old words had, and words around the new ones
const PROBES = [...new Set([...OLD_TERMS.flatMap((t) => [t.term, ...(t.aka ?? [])]), "", "$", "a", "tax", "line of credit", "heloc", "mortgage", "pay off", "velocity", "chunk", "extra payment", "interest", "lesson", "banking", "credit"])];

// the page itself, drawn on the stand-in DOM with every page of the app known
const vUi = await import("../../../core/ui/dom.js");
const vFmt = await import("../../../core/format.js");
const { render: renderGlossary } = await import("./view.js");
const fieldOf = (src, k) => (new RegExp(`^\\s*${k}:\\s*"([^"]*)"`, "m").exec(src) ?? [])[1] ?? null;
const PAGES = new Map();
for (const g of fs.readdirSync(MODULES, { withFileTypes: true })) {
  if (!g.isDirectory() || g.name.startsWith("_")) continue;
  for (const m of fs.readdirSync(path.join(MODULES, g.name), { withFileTypes: true })) {
    const f = path.join(MODULES, g.name, m.name, "module.js");
    if (!m.isDirectory() || !fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, "utf8");
    PAGES.set(`${g.name}/${m.name}`, { group: g.name, id: m.name, title: fieldOf(s, "title"), status: fieldOf(s, "status"), enabledByDefault: !/enabledByDefault:\s*false/.test(s) });
  }
}
function drawGlossary(plan = emptyPlan(), { rest = [], query = {} } = {}) {
  const saved = [];
  const root = new FakeElement("main");
  renderGlossary(root, {
    ui: vUi, fmt: { ...vFmt, today: () => INV_TODAY }, plan, modules: PAGES, isReady: (m) => m.status !== "planned", features: { enabled: () => true }, shown: () => true,
    route: { group: "ai", id: "glossary", rest, query }, module: { group: "ai", id: "glossary" }, view: { build: true }, live: {}, ai: { status: async () => "off" },
    store: { get: () => plan, update: (fn) => saved.push(fn) },
  });
  return { root, saved };
}
/** The words of a node as a person reads them (the page's <style> left out), on one line. */
const wordsOf = (n) => (!(n instanceof FakeElement) ? String(n.data ?? n.textContent ?? "") : n.tagName === "STYLE" || n.hidden ? "" : n.childNodes.map(wordsOf).join(" "));
const line = (s) => s.replace(/\s+/g, " ").trim();
const entryEls = (root) => root.all().filter((e) => e.tagName === "DETAILS" && /^gl-/.test(e.getAttribute("id") ?? ""));
const lessonEls = (root) => root.all().filter((e) => e.tagName === "DETAILS" && /^lesson-/.test(e.dataset?.part ?? ""));
/** The page's words as the code before the change drew them: the new words' rows and every lesson row taken out, the counts back by one per new word. */
function pageAsBefore(root) {
  let text = line(wordsOf(root));
  for (const e of entryEls(root).filter((x) => NEW_WORDS.has(x.getAttribute("id").slice(3)))) text = text.replace(line(wordsOf(e)), " ");
  for (const l of lessonEls(root)) text = text.replace(line(wordsOf(l)), " ");
  const n = TERMS.length, was = n - TERMS.filter((t) => NEW_WORDS.has(t.id)).length;
  return line(text.replace(`${n} money words the app uses`, `${was} money words the app uses`).replace(`${n} words, A to Z.`, `${was} words, A to Z.`));
}
async function measureNow() {
  const out = { compute: {}, terms: digest(OLD_TERMS), search: digest(PROBES.map((q) => [q, search(q).filter((t) => !NEW_WORDS.has(t.id)).map((t) => t.id)])), page: {} };
  for (const { name, plan } of await invariancePlans()) out.compute[name] = digest(asBefore(compute(plan, { today: INV_TODAY })));
  const homes = { empty: emptyPlan(), family: familyPlan(INV_TODAY), renterDebt: (await import("../../../qa/fixtures/renter-debt-plan.mjs")).renterDebtPlan(), retiredCouple: (await import("../../../qa/fixtures/retired-couple-plan.mjs")).retiredCouplePlan() };
  for (const [name, plan] of Object.entries(homes)) out.page[name] = digest(pageAsBefore(drawGlossary(plan).root));
  out.page["empty, \"tax\" typed"] = digest((() => { const { root } = drawGlossary(); const box = root.all().find((e) => e.tagName === "INPUT"); box.value = "tax"; box.dispatch("input"); const t = pageAsBefore(root); box.value = ""; box.dispatch("input"); return t; })());   // typed back to nothing: the page keeps the search until the app reloads
  return out;
}

test("invariance: with nothing new looked at, every output, entry, search and page reads as before the lessons and the new word (3c0b8a1)", async () => {
  const now = await measureNow();
  if (process.env.PRINT) { fs.writeFileSync(INV_FILE, `${JSON.stringify({ note: "digests of the glossary before the lessons and Velocity banking (commit 3c0b8a1); module.test.mjs says how to write them again", ...now }, null, 1)}\n`); return; }
  const was = JSON.parse(fs.readFileSync(INV_FILE, "utf8"));
  assert.ok(Object.keys(was.compute).length >= 30, `${Object.keys(was.compute).length} plans`);
  assert.deepEqual(Object.keys(now.compute).sort(), Object.keys(was.compute).sort(), "the same plans");
  for (const k of Object.keys(was.compute)) assert.equal(now.compute[k], was.compute[k], `compute() for ${k}`);
  assert.equal(now.terms, was.terms, "every entry that was there is byte for byte as it was, in the same order");
  assert.equal(now.search, was.search, "every search finds what it found before (the new word aside)");
  for (const k of Object.keys(was.page)) assert.equal(now.page[k], was.page[k], `the page for ${k}, the new rows taken out`);
});

// ---------------------------------------------------------------- the two-minute lessons (gap list item 13, 2026-11-15)
const { LESSONS } = await import("./data/lessons.js");
const { lessonOf, lessonWords, metOn, LESSON } = await import("./compute.js");
const { amortization } = await import("../../../core/math/finance.js");
const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
const BY_DESIGN = new Set(["velocity-banking"]);   // lessons asked for by name, not for being met on the most pages
const built = (k) => !!PAGES.get(k) && PAGES.get(k).status !== "planned";
const lessonText = (l) => [...l.what, ...l.why, ...l.example].join(" ");
const sentences = (text) => text.split(/(?<=[.!?])\s+(?=[A-Z0-9$(])/);
/** How many built pages' view.js shows one of a word's names (whole word, any case): the tie-break at the cut. */
const VIEWS = [...PAGES].filter(([k, m]) => k !== "ai/glossary" && m.status !== "planned" && fs.existsSync(path.join(MODULES, k, "view.js"))).map(([, m]) => fs.readFileSync(path.join(MODULES, m.group, m.id, "view.js"), "utf8").toLowerCase().replace(/’/g, "'"));
const shownOn = (t) => { const esc = (x) => x.toLowerCase().replace(/’/g, "'").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const re = new RegExp(`(?<![a-z0-9])(?:${[t.term, ...(t.aka ?? [])].map(esc).join("|")})(?![a-z0-9])`); return VIEWS.filter((v) => re.test(v)).length; };

test("lessons: one behind each of the 20 words met on the most pages (built pages in its \"Where you meet it\" list), ties at the cut by how many pages show the word", () => {
  const ids = LESSONS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, "one lesson per word");
  for (const id of ids) assert.ok(TERMS.some((t) => t.id === id), `${id}: a word of the glossary`);
  const has = new Set(ids);
  const most = TERMS.filter((t) => has.has(t.id) && !BY_DESIGN.has(t.id)), rest = TERMS.filter((t) => !has.has(t.id));
  assert.equal(most.length, 20);
  const cut = Math.min(...most.map((t) => metOn(t, built)));
  for (const t of rest) assert.ok(metOn(t, built) <= cut, `${t.term} is met on ${metOn(t, built)} pages, more than ${cut}: give it a lesson too (README "Lessons")`);
  // at the cut, the words with a lesson are shown on at least as many pages as those without
  const atCut = (xs) => xs.filter((t) => metOn(t, built) === cut).map(shownOn);
  assert.ok(Math.min(...atCut(most)) >= Math.max(0, ...atCut(rest)), `the tie-break at ${cut} pages`);
  assert.equal(cut, 12, "the count the README gives");
  assert.deepEqual(TERMS.filter((t) => metOn(t, built) > cut).map((t) => t.id).sort(), most.filter((t) => metOn(t, built) > cut).map((t) => t.id).sort());
  // the counting: only built pages count
  assert.equal(metOn({ pages: ["taxes/federal", "nowhere/page"] }, built), 1);
  assert.equal(metOn({}, built), 0);
});

test("lessons: every lesson's one page is a real, usable page of the app", () => {
  for (const l of LESSONS) {
    const m = PAGES.get(l.page);
    assert.ok(m, `${l.id}: no page ${l.page}`);
    assert.notEqual(m.status, "planned", `${l.id}: ${l.page} is not built`);
    assert.ok(m.title, l.page);
  }
});

test("lessons: 250 to 350 words in three parts, plain words, every abbreviation a glossary word, every source a public page", () => {
  for (const l of LESSONS) {
    const n = lessonWords(l), text = lessonText(l);
    assert.ok(n >= 250 && n <= 350, `${l.id}: ${n} words`);
    for (const k of ["what", "why", "example"]) assert.ok(Array.isArray(l[k]) && l[k].length >= 1 && l[k].every((x) => typeof x === "string" && x.trim().length > 20), `${l.id}: ${k}`);
    for (const s of sentences(text)) assert.ok(words(s) <= 32, `${l.id}: a sentence of ${words(s)} words: "${s.slice(0, 80)}..."`);
    assert.doesNotMatch(text, /\be\.g\.|\bi\.e\.|\betc\b|\bvs\.?\b|&/i, `${l.id}: written out`);
    assert.doesNotMatch(text, /today['’]s money|Will the money last\?[,;:).]/, l.id);
    for (const tok of abbreviations(text)) assert.ok(explained(tok), `${l.id}: "${tok}" is not a glossary word`);
    assert.ok(l.sources.length >= 1, l.id);
    for (const s of l.sources) { assert.match(s.url, SOURCES, `${l.id}: ${s.url}`); assert.ok(s.name, l.id); assert.ok(!/:.*:/.test(sourceLabel(s.name)), s.name); }
    assert.doesNotMatch(text, /undefined|null|NaN/);
  }
  // the scan itself
  assert.deepEqual(abbreviations("An HSA, two IRAs, a 401(k) and the AGI; Pay"), ["HSA", "IRAs", "401(k)", "AGI"]);
  assert.ok(explained("IRAs") && explained("CPI") && !explained("ZZQ"));
});

test("lessons: what they explain carries no yearly dollar limit; the dollar figures there are fixed in law or worked out beside them", () => {
  // what it is and why it matters: only the lines of the extra Medicare tax (fixed in law and never indexed, IRC
  // 3101(b)(2) and 3102(f); IRS Topics 751 and 560: $200,000 from one job for the withholding, $250,000 / $125,000 /
  // $200,000 by filing status for what is owed) and the round amounts a sentence works out on the spot ("a $1,000
  // deduction saves $120")
  const OK = new Set(["$200,000", "$250,000", "$125,000", "$1,000", "$120", "$50,000", "$100", "$103"]);
  for (const l of LESSONS) for (const x of [...l.what, ...l.why].join(" ").match(/\$[\d,.]+\d/g) ?? []) assert.ok(OK.has(x), `${l.id}: ${x} in what it is or why it matters`);
});

test("lessons: the extra 0.9% Medicare tax as the law has it: withheld past $200,000 from one job, owed by filing status (IRS Topic 560)", () => {
  const said = LESSONS.filter((l) => /0\.9%/.test(lessonText(l)));
  assert.deepEqual(said.map((l) => l.id), ["social-security-and-medicare-tax"]);
  for (const l of said) {
    const text = lessonText(l);
    assert.match(text, /Once one job pays you more than \$200,000 in a year, your employer also takes out an extra 0\.9% for Medicare/, "the $200,000 line is the employer's withholding, job by job");
    assert.match(text, /What you owe in the end depends on your filing status\./);
    assert.match(text, /It starts above \$250,000 of a married couple's combined pay if they file jointly, \$125,000 each if they file separately, and \$200,000 for anyone else\. Your tax return settles any difference\./);
    assert.doesNotMatch(text, /Pay above \$200,000 in a year has/, "never the $200,000 line alone, as if it were what everyone owes on");
    assert.ok(l.sources.some((s) => s.url === "https://www.irs.gov/taxtopics/tc560"), "IRS Topic 560 gives the three lines");
  }
  // a couple paid $230,000 together, $115,000 each: nothing withheld (no job past $200,000) and nothing owed (under $250,000)
  assert.ok(115000 <= 200000 && 230000 <= 250000);
  assert.match(find("Additional Medicare tax").plain, /depends on your filing status/, "the word for the tax itself says so too");
});

test("lessons: a line of a tax form is named with the year of its form (the 2025 Form 1040 has adjusted gross income on line 11a)", () => {
  // irs.gov/pub/irs-pdf/f1040.pdf, read 2026-11-16: "11a Subtract line 10 from line 9. This is your adjusted gross
  // income", repeated as 11b on page 2; returns up to 2024 have it on line 11, as the IRS's definition page still says
  assert.match(lessonText(lessonOf("adjusted-gross-income")), /Form 1040, it is line 11a on the 2025 form \(line 11 on earlier years' forms\)\./);
  for (const l of LESSONS) {
    const text = lessonText(l);
    for (const m of text.matchAll(/\bline (\d+[a-z]?)\b/g)) assert.match(text.slice(m.index, m.index + 40), /^line \w+ on (the 20\d\d form|earlier years' forms)/, `${l.id}: "line ${m[1]}" says which year's form it is on`);
  }
});

// a lesson starts where its word's meaning stops: the meaning and its example sit just above the lesson, one tap away
const toks = (s) => String(s ?? "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9$%]+/g, " ").trim().split(" ").filter(Boolean);
const grams = (ws, n) => Array.from({ length: Math.max(0, ws.length - n + 1) }, (_, i) => ws.slice(i, i + n).join(" "));
/** The share of a sentence's three-word runs found in a word's meaning and example. */
const repeats = (sentence, t) => { const seen = new Set(grams(toks(`${t.plain} ${t.example ?? ""}`), 3)), g = grams(toks(sentence), 3); return g.filter((x) => seen.has(x)).length / Math.max(1, g.length); };

test("lessons: each starts where its word's meaning stops: the meaning and example shown just above are not said again", () => {
  for (const l of LESSONS) {
    const t = TERMS.find((x) => x.id === l.id), first = sentences(l.what[0])[0];
    const share = repeats(first, t);
    assert.ok(share < 0.5, `${l.id}: its first sentence says again what the meaning just above says (${Math.round(share * 100)}% of its three-word runs): "${first}"`);
    const shown = new Set(grams(toks(`${t.plain} ${t.example ?? ""}`), 10));
    const again = grams(toks(lessonText(l)), 10).find((g) => shown.has(g));
    assert.equal(again, undefined, `${l.id}: "${again}" is word for word the meaning or example just above`);
  }
  // the measure itself: the sentence that opened the Interest rate lesson before (2026-11-15) fails it
  assert.equal(repeats("What a lender charges you each year to borrow, written as a percent of what you still owe.", find("Interest rate")), 1);
  assert.equal(repeats("The rate is a yearly figure, even on a card that bills you every month.", find("Interest rate")), 0);
});

// every figure an example writes, against its sum: [value, rounding step (1 = dollars, 0.01 = cents), the words in the lesson]
const $ = (x, step = 1) => `$${(Math.round(x / step) * step).toLocaleString("en-US", step < 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 })}`;
const fam = familyPlan(INV_TODAY), bal = (type) => fam.accounts.filter((a) => a.type === type).reduce((s, a) => s + a.balance, 0);
const riley = renterDebtPlan(), rileyMustPay = riley.expenses.filter((x) => x.essential).reduce((s, x) => s + x.amount, 0) + riley.debts.reduce((s, d) => s + d.minPayment, 0);
const card = (pay) => amortization({ principal: 4500, annualRate: 0.29, years: 30, payment: pay });
const SUMS = {
  "todays-dollars": [[1.03 ** 30, 0.01, "2.43"], [1e6 / 1.03 ** 30, 1000, "$412,000"], [60000 * 1.03 ** 30, 1000, "$146,000"]],
  "federal-income-tax": [[39000 + 100, 1, "$39,100"], [39100 - 2000, 1, "$37,100"], [37100 - 15000, 1, "$22,100"], [22100 - 12000, 1, "$10,100"], [0.10 * 12000, 1, "$1,200"], [0.12 * 10100, 1, "$1,212"], [1200 + 1212, 1, "$2,412"], [2412 - 500, 1, "$1,912"]],
  "tax-bracket": [[0.10 * 12000, 1, "$1,200"], [40000 - 12000, 1, "$28,000"], [0.12 * 28000, 1, "$3,360"], [1200 + 3360, 1, "$4,560"], [48000 - 40000, 1, "$8,000"], [0.12 * 8000, 1, "$960"], [50000 - 48000, 1, "$2,000"], [0.22 * 2000, 1, "$440"], [960 + 440, 1, "$1,400"], [10000 - 1400, 1, "$8,600"]],
  "health-savings-account": [[3000 * 0.22, 1, "$660"], [1000 * 0.22, 1, "$220"], [1000 * 0.20, 1, "$200"], [220 + 200, 1, "$420"]],
  "tax-deduction": [[1000 * 0.12, 1, "$120"], [9000 + 6000, 1, "$15,000"], [90000 - 34000, 1, "$56,000"]],
  "stock": [[10000 * 1.2, 1, "$12,000"], [10000 * 0.7, 1, "$7,000"], [10000 - 7000, 1, "$3,000"], [10000 * 1.07 ** 30, 1000, "$76,000"], [10000 * 1.07 ** 30 / 1.03 ** 30, 1000, "$31,000"]],
  "taxable-account": [[bal("brokerage"), 1, "$18,000"], [18000 * 0.02, 1, "$360"], [8000 - 5000, 1, "$3,000"], [3000 * 0.15, 1, "$450"]],
  "filing-status": [[17000 - 12000, 1, "$5,000"], [5000 * (0.12 - 0.10), 1, "$100"]],
  "social-security-and-medicare-tax": [[fam.income.find((x) => x.id === "i-ana").amount, 1, "$3,900"], [3900 * 0.10, 1, "$390"], [3900 - 390, 1, "$3,510"], [3900 * 0.062, 0.01, "$241.80"], [3900 * 0.0145, 0.01, "$56.55"], [241.80 + 56.55, 0.01, "$298.35"], [298.35 * 26, 0.01, "$7,757.10"], [3900 * 26, 1, "$101,400"]],
  "bond": [[10000 * 0.04, 1, "$400"], [400 * 10, 1, "$4,000"], [10000 + 4000, 1, "$14,000"], [10000 * 0.05, 1, "$500"]],
  "interest-rate": [[4500 * 0.29 / 12, 0.01, "$108.75"], [150 - 108.75, 0.01, "$41.25"], [250 - 108.75, 0.01, "$141.25"], [100 * 0.29 / 12, 0.01, "$2.42"], [card(150).totalInterest, 10, "$3,610"], [card(250).totalInterest, 10, "$1,480"]],
  "inflation-and-cpi": [[100 * 1.03, 1, "$103"], [5000 * 1.03 ** 10, 10, "$6,720"], [5000 * 1.03 ** 20, 10, "$9,030"], [5000 * 1.03 ** 30, 10, "$12,140"], [20000 / 1.03 ** 10, 10, "$14,880"]],
  "emergency-fund": [[rileyMustPay, 100, "$2,400"], [6 * 2400, 1, "$14,400"], [14400 - 1000, 1, "$13,400"]],
  "taxable-income": [[3900 * 26 + fam.income.find((x) => x.id === "i-bo").amount * 12, 1000, "$164,000"], [164000 - 12000, 1, "$152,000"], [152000 - 32000, 1, "$120,000"], [120000 - 2000, 1, "$118,000"], [2000 * 0.22, 1, "$440"]],
  "net-worth": [[bal("checking") + bal("savings"), 1, "$15,700"], [bal("401k") + bal("roth"), 1, "$159,000"], [bal("brokerage"), 1, "$18,000"], [bal("property"), 1, "$380,000"],
    [bal("checking") + bal("savings") + bal("401k") + bal("roth") + bal("brokerage") + bal("property"), 1, "$572,700"], [bal("mortgage"), 1, "$265,000"], [bal("credit"), 1, "$6,400"], [bal("loan"), 1, "$14,200"],
    [265000 + 6400 + 14200, 1, "$285,600"], [572700 - 285600, 1, "$287,100"], [572700 - 6400, 1, "$566,300"], [285600 - 6400, 1, "$279,200"], [566300 - 279200, 1, "$287,100"]],
  "tax-credit": [[1000 * 0.12, 1, "$120"], [9000 - 2000, 1, "$7,000"], [2000 * 0.22, 1, "$440"], [2000 * 0.12, 1, "$240"], [500 - 300, 1, "$200"]],
  "adjusted-gross-income": [[52000 + 6000 + 500, 1, "$58,500"], [2000 + 250, 1, "$2,250"], [58500 - 2250, 1, "$56,250"], [56250 - 3000, 1, "$53,250"]],
  "gross-and-net": [[fam.income.find((x) => x.id === "i-bo").amount, 1, "$5,200"], [5200 * 0.06, 1, "$312"], [5200 * 0.0765, 0.01, "$397.80"], [312 + 397.80 + 420, 0.01, "$1,129.80"], [5200 - 1129.80, 0.01, "$4,070.20"], [5200 * 12, 1, "$62,400"], [4070.20 * 12, 10, "$48,840"], [1129.80, 10, "$1,130"]],
  "401k": [[100000 * 0.06, 1, "$6,000"], [6000 * 0.5, 1, "$3,000"], [6000 * 0.22, 1, "$1,320"], [6000 - 1320, 1, "$4,680"], [6000 + 3000, 1, "$9,000"], [10000 * 0.10, 1, "$1,000"]],
  "ira": [[4000 * 0.12, 1, "$480"], [4000 * 1.07 ** 34, 1000, "$40,000"]],
};

test("lessons: every sum in an example is right (each figure written, against its arithmetic and the invented household's own numbers)", () => {
  for (const l of LESSONS.filter((x) => !BY_DESIGN.has(x.id))) {
    const text = lessonText(l), sums = SUMS[l.id];
    assert.ok(sums?.length >= 2, `${l.id}: its example's sums are checked here`);
    for (const [value, step, said] of sums) {
      const got = said.startsWith("$") ? $(value, step) : value.toFixed(2);
      assert.equal(got, said, `${l.id}: ${said}`);
      assert.ok(text.includes(said), `${l.id}: "${said}" is in the lesson`);
    }
  }
  // the words around the sums
  assert.equal(card(150).periods, 55, "4 years and 7 months"); assert.equal(card(250).periods, 24, "about 2 years");
  assert.ok(lessonText(lessonOf("interest-rate")).includes("about 4 years and 7 months") && lessonText(lessonOf("interest-rate")).includes("in about 2 years"));
  assert.ok((250 - 108.75) / (150 - 108.75) > 3, "more than three times as much");
  assert.equal(100 * 0.09 / 12, 0.75, "75 cents");
  assert.equal(Math.round(13400 / 300), 45, "about 45 months"); assert.ok(45 / 12 < 4, "almost four years");
  assert.equal(Math.round((10000 * 1.07 ** 30 / 1.03 ** 30) / 10000), 3, "about three times what he put in");
  assert.ok(9000 + 6000 < 34000, "they take the standard deduction");
  assert.equal(3000 / 100000, 0.03, "a 3% raise");
  assert.equal(fam.household.filingStatus, "married_joint"); assert.equal(riley.household.filingStatus, "single");
  assert.equal(riley.assumptions.emergencyMonths, 6, "Riley's 6 months");
});

test("lessonOf and lessonWords: by entry or id; a word without a lesson has none", () => {
  assert.equal(lessonOf("tax-bracket").page, "taxes/brackets");
  assert.equal(lessonOf(find("Tax bracket")), lessonOf("tax-bracket"));
  assert.equal(lessonOf(find("Escrow")), null); assert.equal(lessonOf(null), null); assert.equal(lessonOf("nothing"), null);
  assert.equal(lessonWords({ what: ["one two"], why: ["three"], example: [" four  five "] }), 5);
  assert.equal(lessonWords(null), 0);
  assert.deepEqual(Object.keys(LESSON), ["title", "what", "why", "example", "tryIt", "sources"]);
});

// ---------------------------------------------------------------- the lessons on the page
const lessonRow = (root, id) => root.all().find((e) => e.tagName === "DETAILS" && e.dataset?.part === `lesson-${id}`) ?? null;
const entryRow = (root, id) => root.all().find((e) => e.tagName === "DETAILS" && e.getAttribute("id") === `gl-${id}`) ?? null;
const titleIn = (d) => line(wordsOf(d.children.find((c) => c.tagName === "SUMMARY").all().find((e) => e.getAttribute("class") === "fold-title")));
/** What a person meets before any tap: everything outside a shut row (its summary only). */
const firstWords = (n) => (!(n instanceof FakeElement) ? String(n.data ?? "") : n.tagName === "STYLE" || n.hidden ? "" : n.tagName === "DETAILS" && !n.hasAttribute("open") ? wordsOf(n.children.find((c) => c.tagName === "SUMMARY")) : n.childNodes.map(firstWords).join(" "));

test("the page: the first view shows no lesson; a word's row opens on its meaning with the lesson one quiet row below, shut", () => {
  const { root } = drawGlossary(familyPlan(INV_TODAY));
  const first = line(firstWords(root));
  for (const w of [LESSON.title, LESSON.what, LESSON.why, LESSON.tryIt]) assert.ok(!first.includes(w), `"${w}" is not on the first view`);
  assert.equal(lessonEls(root).length, LESSONS.length, "every lesson is in the page (find-in-page reaches it), each in its word's row");
  for (const l of LESSONS) {
    const d = lessonRow(root, l.id), e = entryRow(root, l.id);
    assert.ok(d && e, l.id);
    assert.equal(d.dataset.kind, "item"); assert.equal(titleIn(d), "A two-minute lesson"); assert.equal(d.hasAttribute("open"), false);
    assert.ok(e.all().includes(d), `${l.id}: inside its word's row`);
  }
  // a word without a lesson reads as before: no lesson row
  assert.equal(lessonRow(root, "escrow-account"), null);
  assert.equal(entryRow(root, "escrow-account").dataset.kind, "item", "each word is a row of the helper");
});

test("the page: a lesson holds its three parts in order, one page to try it on and its sources", () => {
  const { root } = drawGlossary(emptyPlan(), { rest: ["tax-bracket"] });
  const e = entryRow(root, "tax-bracket"), d = lessonRow(root, "tax-bracket");
  assert.ok(e.hasAttribute("open"), "the word in the address opens");
  assert.equal(d.hasAttribute("open"), false, "its lesson waits for a tap");
  const l = lessonOf("tax-bracket"), body = d.all().find((x) => x.getAttribute("class") === "gl-lesson");
  const partsIn = body.children.map((c) => c.dataset?.lesson);
  assert.deepEqual(partsIn, ["what", "why", "example", "page", "sources"]);
  const said = line(wordsOf(body));
  assert.ok(said.startsWith(`What it is ${l.what.join(" ")} Why it matters to you ${l.why.join(" ")} An example ${l.example.join(" ")} Try it with your own numbers: Bracket explorer Sources:`), said.slice(0, 200));
  const a = body.all().filter((x) => x.tagName === "A");
  assert.equal(a[0].getAttribute("href"), "#/taxes/brackets"); assert.match(a[0].getAttribute("class"), /btn secondary/);
  assert.deepEqual(a.slice(1).map((x) => x.getAttribute("href")), l.sources.map((s) => s.url));
  assert.ok(a.slice(1).every((x) => x.getAttribute("target") === "_blank" && x.getAttribute("rel") === "noopener"));
  // the lesson sits between the example and "Where you meet it in the app"
  const order = line(wordsOf(e));
  assert.ok(order.indexOf("For example:") < order.indexOf("A two-minute lesson") && order.indexOf("A two-minute lesson") < order.indexOf("Where you meet it in the app:"));
  // no filled button, no box
  assert.ok(!d.all().some((x) => ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(x.tagName)), "nothing to press or type");
  assert.ok(d.all().filter((x) => /\bbtn\b/.test(x.getAttribute("class") ?? "")).every((x) => /\bsecondary\b/.test(x.getAttribute("class"))), "no filled button: the page link is outlined");
});

test("the page: the lesson's page is left out when it is turned off, and ?show=lesson-<word> opens the lesson", () => {
  const off = new Map([...PAGES].map(([k, m]) => [k, k === "taxes/brackets" ? { ...m, status: "planned" } : m]));
  const root = new FakeElement("main");
  renderGlossary(root, { ui: vUi, fmt: { ...vFmt, today: () => INV_TODAY }, plan: emptyPlan(), modules: off, isReady: (m) => m.status !== "planned", features: { enabled: () => true }, shown: () => true,
    route: { group: "ai", id: "glossary", rest: ["tax-bracket"], query: {} }, module: { group: "ai", id: "glossary" }, view: { build: true }, live: {}, ai: { status: async () => "off" }, store: { get: () => null, update() { } } });
  const body = lessonRow(root, "tax-bracket").all().find((x) => x.getAttribute("class") === "gl-lesson");
  assert.deepEqual(body.children.map((c) => c.dataset?.lesson), ["what", "why", "example", "sources"], "no page to try it on");
  const { root: r2 } = drawGlossary(emptyPlan(), { rest: ["tax-bracket"], query: { show: "lesson-tax-bracket" } });
  assert.ok(lessonRow(r2, "tax-bracket").hasAttribute("open"), "a link can land on the lesson");
});

test("S11: there is nothing to save here, so drawing the page and opening every word and every lesson writes nothing to the plan", () => {
  const plan = familyPlan(INV_TODAY), before = JSON.stringify(plan);
  const { root, saved } = drawGlossary(plan);
  for (const d of root.all().filter((e) => e.tagName === "DETAILS")) { d.setAttribute("open", ""); d.dispatch("toggle"); }
  assert.equal(saved.length, 0);
  assert.equal(JSON.stringify(plan), before);
  assert.ok(root.all().filter((e) => e.tagName === "DETAILS" && e.hasAttribute("open")).length > TERMS.length, "every word and every lesson opened");
});

// ---------------------------------------------------------------- Velocity banking (gap list item 59, 2026-11-15)
const { velocity, VELOCITY } = await import("./compute.js");
const { pmt } = await import("../../../core/math/finance.js");

test("Velocity banking: a word of its own, with no page claiming it, the line of credit's source, and a lesson linked to the Mortgage page", () => {
  const t = find("Velocity banking");
  assert.ok(t); assert.equal(t.id, "velocity-banking"); assert.equal(t.topic, "borrowing");
  assert.deepEqual(t.pages, [], "no page of the app uses the word");
  assert.equal(t.sourceUrl, find("HELOC").sourceUrl, "the same source as the home-equity line's entry");
  assert.equal(find("chunking"), t); assert.equal(search("velocity")[0], t);
  assert.equal(search("heloc")[0], find("HELOC"), "the line of credit itself stays first");
  assert.ok(!/\$\s?\d/.test(t.plain));
  const l = lessonOf(t);
  assert.equal(l.page, "debt/mortgage"); assert.equal(PAGES.get("debt/mortgage").title, "Mortgage");
  assert.ok(BY_DESIGN.has(t.id));
  assert.match(lessonText(l), /This is information, not advice\./);
  assert.match(lessonText(l), /its rate usually changes, and not repaying it can cost you the home/, "what the HELOC entry already says");
  assert.match(find("HELOC").plain, /The rate usually changes, and not repaying can cost you the home\./);
  assert.ok(!forPlan(familyPlan(INV_TODAY), { today: INV_TODAY }).includes(t), "never pushed as a word for a household with a mortgage");
});

test("Velocity banking: the example's arithmetic (velocity()), each step", () => {
  const v = velocity();
  assert.deepEqual(VELOCITY, { loan: 200000, years: 30, mortgageRate: 0.06, lineRate: 0.09, spending: 5000, leftOver: 1000, chunk: 10000, lowRate: 0.04 });
  // the mortgage with and without the leftover as an extra payment (core/math/finance.js amortization)
  assert.equal(v.payment, 1199.10);
  assert.equal(v.years, 30); assert.equal(v.monthsWithExtra, 122); assert.equal(Math.round(v.yearsWithExtra), 10);
  assert.ok(Math.abs(v.interestSaved - 164268.14) < 0.01, String(v.interestSaved));
  // the chunk on the line: 10,000, 9,000 ... 1,000, cleared in 10 months; its average; the rate gap on it
  assert.equal(v.months, 10); assert.equal(v.onLine, 5500); assert.equal(v.onLine, (10000 + 1000) / 2);
  assert.ok(Math.abs(v.rateGap - 0.03) < 1e-12);
  assert.ok(Math.abs(v.rateCost - 5500 * 0.03 * 10 / 12) < 1e-9); assert.ok(Math.abs(v.rateCost - 137.5) < 1e-9);
  // pay sitting on the line: half the everyday spending, at the line's rate
  assert.equal(v.sitting, 2500); assert.ok(Math.abs(v.floatSaved - 2500 * 0.09 * 10 / 12) < 1e-9); assert.ok(Math.abs(v.floatSaved - 187.5) < 1e-9);
  assert.ok(Math.abs(v.net - 50) < 1e-9); assert.ok(Math.abs(v.perMonth - 5) < 1e-9);
  // the mortgage at 4%: 5 points on the same average
  assert.ok(Math.abs(v.low.rateCost - 5500 * 0.05 * 10 / 12) < 1e-9); assert.ok(Math.abs(v.low.net - (187.5 - 229.1666666666667)) < 1e-9);
  // a chunk the leftover does not divide; nothing left over
  const odd = velocity({ ...VELOCITY, chunk: 2500 });
  assert.equal(odd.months, 3); assert.equal(odd.onLine, (2500 + 1500 + 500) / 3);
  const none = velocity({ ...VELOCITY, leftOver: 0 });
  assert.equal(none.months, 0); assert.equal(none.net, 0); assert.equal(none.perMonth, 0); assert.equal(none.interestSaved, 0);
});

/** Day by day, 30-day months: pay lands on the line on day 0 (the mortgage payment in and straight out), the everyday
 * spending leaves a 30th a day, the line charges its rate on the month's average daily balance; the leftover lowers the
 * line at the month's end, or (leftoverOnLine) sits on it from day 0. The plain way sends the payment and the leftover to
 * the mortgage. Returns how much less velocity banking owes after `months` (below 0: it owes more). */
function dayByDay({ loan = 200000, mortgageRate = 0.06, lineRate = 0.09, spending = 5000, leftOver = 1000, chunk = 10000, leftoverOnLine = false, months = 10 } = {}) {
  const P = pmt(mortgageRate / 12, 360, loan);
  let m1 = loan, m2 = loan - chunk, h = chunk;
  for (let k = 0; k < months; k++) {
    m1 = m1 + m1 * mortgageRate / 12 - P - leftOver;
    m2 = m2 + m2 * mortgageRate / 12 - P;
    let bal = h - (spending + (leftoverOnLine ? leftOver : 0)), sum = 0;
    for (let d = 0; d < 30; d++) { sum += bal; bal += spending / 30; }
    h = bal + (sum / 30) * lineRate / 12 - (leftoverOnLine ? 0 : leftOver);
  }
  return m1 - (m2 + h);
}

test("Velocity banking: counted day by day the answer moves a little and stays a few dollars a month, as the lesson says", () => {
  const v = velocity();
  assert.ok(Math.abs(dayByDay() - v.net) < 5, `${dayByDay()} against ${v.net}`);                               // 52.31 against 50
  assert.ok(Math.abs(dayByDay({ mortgageRate: 0.04 }) - v.low.net) < 5, `${dayByDay({ mortgageRate: 0.04 })}`);   // -44.03 against -41.67
  for (const leftoverOnLine of [false, true]) for (const mortgageRate of [0.06, 0.04]) {
    const n = dayByDay({ leftoverOnLine, mortgageRate });
    assert.ok(Math.abs(n / 10) < 15, `${leftoverOnLine}, ${mortgageRate}: ${n} in 10 months`);
  }
  // next to what the leftover saves either way
  assert.ok(v.interestSaved / Math.abs(dayByDay({ leftoverOnLine: true })) > 1000);
});

test("Velocity banking: the lesson quotes velocity()'s figures, rounded as said", () => {
  const v = velocity(), text = lessonText(lessonOf("velocity-banking"));
  const said = [
    $(VELOCITY.loan), "30 years at 6%", "at 9%", `${$(VELOCITY.spending)} of everyday spending`, `${$(VELOCITY.leftOver)} left over`,
    `in about ${Math.round(v.yearsWithExtra)} years instead of ${v.years}`, `about ${$(v.interestSaved, 1000)} of interest`,
    `you borrow ${$(VELOCITY.chunk)} from the line at once`, `clears the line in ${v.months} months`,
    `you owe ${$(v.onLine)} on the line on average, at ${Math.round(VELOCITY.lineRate * 100)}% instead of the mortgage's ${Math.round(VELOCITY.mortgageRate * 100)}%`,
    `about ${$(v.rateCost)} of extra interest`, `you owe about ${$(v.sitting)} less on average`, `that saves about ${$(v.floatSaved)}.`,
    `So after ${v.months} months you are about ${$(v.net)} better off than sending the ${$(VELOCITY.leftOver)} straight to the mortgage, about ${$(v.perMonth)} a month`,
    `With the mortgage at ${Math.round(VELOCITY.lowRate * 100)}%, you would be about ${$(-v.low.net)} worse off.`,
    `Either way, it is tiny next to the ${$(v.interestSaved, 1000)}.`,
  ];
  for (const s of said) assert.ok(text.includes(s), `"${s}" is in the lesson`);
  assert.ok(v.net > 0 && v.low.net < 0, "better off at 6%, worse off at 4%, as written");
  // the answer first, then the figures; "better off" says than what (a look on a phone, 2026-11-16: "about $50 ahead"
  // did not say ahead of what)
  const ex = lessonOf("velocity-banking").example;
  assert.ok(ex[0].startsWith("In short, the line itself changes the result by a few dollars a month. Take a "), ex[0]);
  assert.ok(Math.abs(v.perMonth) < 10 && Math.abs(v.low.net / v.months) < 10, "a few dollars a month, both ways");
  assert.doesNotMatch(text, /\bahead\b|\bbehind\b|comes out/, "never ahead or behind of nothing named");
  // money words a reader may not know, said plainly: the home-equity line as a line borrowed against the home, a sum
  // borrowed "at once" rather than a "lump sum"
  assert.match(text, /a line of credit, often one borrowed against your home,/);
  assert.doesNotMatch(text, /lump sum|home-equity/);
  // plain words (a look on a phone, 2026-11-15): the rates said as rates, "chunk" said once and explained, no sentence
  // that has lost its verb
  assert.equal(Math.round(v.rateGap * 100), Math.round(VELOCITY.lineRate * 100) - Math.round(VELOCITY.mortgageRate * 100), "9% instead of 6% is the 3-point gap velocity() costs");
  assert.doesNotMatch(text, /points more|percentage point/, "the two rates, not the gap between them");
  assert.deepEqual(text.match(/\bchunks?\b/gi), ["chunk"], "said once");
  assert.match(text, /a large amount from the line at once, often called a chunk,/);
  assert.doesNotMatch(text, /pay sitting on it until it is spent/);
  assert.equal(lessonWords(lessonOf("velocity-banking")) <= 350, true);
});
