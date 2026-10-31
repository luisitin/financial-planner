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

test("every money abbreviation in page titles, purposes, view text and compute labels is explained (data tables, fund names and form numbers are not checked)", () => {
  // not money words: the computer, the app, the sources' names, fund tickers, currency codes, date orders, form numbers
  const NOT_MONEY = new Set(["PC", "US", "USA", "AI", "KB", "MB", "GB", "CSV", "PDF", "PDFs", "JSON", "URL", "ZIP", "OK", "IRS", "SSA", "BLS", "SEC", "FDIC", "FINRA", "CFPB", "KFF", "NYU", "NFDA", "CMS", "DOL", "HHS", "IBIT", "FBTC", "ETHA", "AM", "PM", "TV", "ID", "IDs", "QR", "PIN", "FAQ", "API", "LAN", "IP", "OFX", "QFX", "QIF", "TSV", "XLSX", "UTC", "DA", "ES", "NEC", "INT", "DIV", "ACA", "COVID", "SECURE", "CARES", "TCJA", "OBBBA", "NO", "YES", "ALL", "AND", "OR", "THE",
    "USD", "EUR", "GBP", "CAD", "MXN", "MDY", "DMY", "VTI", "FXAIX", "AAPL", "ACME", "ARB", "BTC",
    "DD",     // a form number: "Military discharge papers (DD 214)" (household/documents)
    "DIME",   // insurance/life-needs spells the rule out where it shows it: "Debts, Income, Mortgage, Education"
  ]);
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
      for (const tok of text.join(" ").match(/\b(?:[A-Z]{2,6}s?|401\(k\)|403\(b\)|457\(b\))(?![\w(])/g) ?? []) {
        const one = tok.replace(/s$/, "");
        if (NOT_MONEY.has(tok) || NOT_MONEY.has(one) || find(tok) || find(one)) continue;
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
