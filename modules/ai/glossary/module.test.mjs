import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compute, search, find, forPlan, norm, shortNames, PLAN_WORDS } from "./compute.js";
import { TERMS, TOPICS } from "./data/terms.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const MODULES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const words = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean).length;
const SOURCES = /^https:\/\/([a-z0-9-]+\.)*(irs\.gov|ssa\.gov|medicare\.gov|investor\.gov|consumerfinance\.gov|finra\.org|studentaid\.gov|healthcare\.gov|law\.cornell\.edu|sec\.gov|bls\.gov|fdic\.gov|cms\.gov|dol\.gov|treasurydirect\.gov|federalreserve\.gov|usa\.gov|acf\.gov|benefits\.gov)\//;

/** Dollar figures the law fixes and never indexes, so they do not age: IRC 1211(b) ($3,000 of capital loss a year), IRC
 * 6654(e)(1) (no estimated-tax penalty under $1,000 owed), IRC 121(b) ($250,000 / $500,000 of home-sale profit). */
const FIXED_IN_LAW = new Set(["capital-loss", "estimated-tax", "home-sale-exclusion"]);

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

test("every page an entry points to exists", () => {
  for (const t of TERMS) for (const k of t.pages ?? []) assert.ok(fs.existsSync(path.join(MODULES, k, "module.js")), `${t.id}: no page ${k}`);
});

test("every money abbreviation on screen is explained: page titles, purposes and the sentences in each page", () => {
  // not money words: the computer, the app, the sources' names, fund tickers
  const NOT_MONEY = new Set(["PC", "US", "USA", "AI", "KB", "MB", "GB", "CSV", "PDF", "PDFs", "JSON", "URL", "ZIP", "OK", "IRS", "SSA", "BLS", "SEC", "FDIC", "FINRA", "CFPB", "KFF", "NYU", "NFDA", "CMS", "DOL", "HHS", "IBIT", "FBTC", "ETHA", "AM", "PM", "TV", "ID", "IDs", "QR", "PIN", "FAQ", "API", "LAN", "IP", "OFX", "QFX", "QIF", "TSV", "XLSX", "UTC", "DA", "ES", "NEC", "INT", "DIV", "ACA", "COVID", "SECURE", "CARES", "TCJA", "OBBBA", "NO", "YES", "ALL", "AND", "OR", "THE"]);
  const missing = new Map();
  for (const g of fs.readdirSync(MODULES)) {
    const gd = path.join(MODULES, g);
    if (g.startsWith("_") || !fs.statSync(gd).isDirectory()) continue;
    for (const id of fs.readdirSync(gd)) {
      const d = path.join(gd, id);
      if (!fs.existsSync(path.join(d, "module.js"))) continue;
      const m = fs.readFileSync(path.join(d, "module.js"), "utf8");
      const text = [(m.match(/title: "([^"]+)"/) ?? [])[1], (m.match(/purpose: "([^"]+)"/) ?? [])[1]];
      if (fs.existsSync(path.join(d, "view.js"))) {
        // sentences only (a quoted string with two spaces or more): code words and constants are left alone
        const v = fs.readFileSync(path.join(d, "view.js"), "utf8");
        // (a template's ${...} parts come out innermost first; a match that swallowed code between strings is skipped)
        for (const s of v.matchAll(/(["'`])((?:(?!\1)[^\\]|\\.){12,}?)\1/g)) {
          let str = s[2];
          for (let k = 0; k < 5 && /\$\{[^{}]*\}/.test(str); k++) str = str.replace(/\$\{[^{}]*\}/g, " ");
          // an apostrophe in a short string can open a false single-quoted "sentence" that runs over code: those hold quotes or brackets
          const code = /=>|\bui\.|\bconst |\);|\$\{|\?\?|\?\.|^\s*[,)}\]]|\b[a-z][a-zA-Z]*: \w/.test(str) || (s[1] === "'" && /["`{}[\]]/.test(str));
          if ((str.match(/ /g) ?? []).length >= 2 && !/^[\w.-]+$/.test(str) && !code) text.push(str);
        }
      }
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

test("search: a name exactly first, then names starting with it, then a word in a name, then the definitions", () => {
  const rmd = find("RMD");
  assert.ok(rmd, "RMD is explained");
  assert.equal(search("rmd")[0], rmd, "other names count as names");
  assert.equal(search("401(k)")[0], find("401(k)"), "401(k) keeps its brackets");
  assert.equal(search("  401(K) ")[0], find("401(k)"), "any case, extra spaces");
  const roth = search("roth");
  assert.equal(roth[0], find("Roth IRA") ?? roth[0]); assert.ok(roth.every((t, i) => i === 0 || /roth/i.test(`${t.term} ${(t.aka ?? []).join(" ")} ${t.plain} ${t.example}`)));
  const all = search("");
  assert.equal(all.length, TERMS.length);
  assert.ok(all.every((t, i) => i === 0 || all[i - 1].term.localeCompare(t.term, "en", { sensitivity: "base" }) <= 0), "A to Z");
  assert.deepEqual(search("zzzz not a word"), []);
  assert.equal(norm("Café 50/30/20!"), "cafe 50/30/20");
});

test("words for this household, from its accounts, work and ages", () => {
  for (const ws of [...Object.values(PLAN_WORDS.account), PLAN_WORDS.business, PLAN_WORDS.equity, PLAN_WORDS.children, PLAN_WORDS.age50, PLAN_WORDS.age60]) for (const w of ws) assert.ok(find(w), `"${w}" is in the glossary`);
  const mine = forPlan(familyPlan(TODAY), { today: TODAY }).map((t) => t.term);
  for (const w of ["401(k)", "Roth IRA", "Self-employment tax", "Child tax credit"]) assert.ok(mine.includes(find(w).term), `${w} for the family: ${mine.join(", ")}`);
  assert.ok(!mine.includes(find("Medicare").term), "nobody in the family is 60");
  const older = familyPlan(TODAY); older.household.people[0].birthDate = "1960-01-01";
  assert.ok(forPlan(older, { today: TODAY }).includes(find("Medicare")));
  assert.deepEqual(forPlan(emptyPlan(), { today: TODAY }), []);
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.count, TERMS.length); assert.equal(d.topics.reduce((s, x) => s + x.count, 0), TERMS.length);
  assert.ok(d.topics.every((x) => x.count > 0 && x.label));
});

test("the short other names beside a word: abbreviations only, at most two, none already in its name", () => {
  assert.deepEqual(shortNames({ term: "Social Security and Medicare tax", aka: ["FICA", "payroll tax", "Medicare tax"] }), ["FICA"]);
  assert.deepEqual(shortNames({ term: "Health savings account (HSA)", aka: ["HSA", "health savings"] }), [], "HSA is already in the name");
  assert.deepEqual(shortNames({ term: "401(k)", aka: ["401k", "workplace retirement plan"] }), [], "401k is the name without brackets");
  assert.deepEqual(shortNames({ term: "Required minimum distribution", aka: ["RMD", "RMDs", "MRD", "required withdrawal"] }), ["RMD", "MRD"]);
  assert.deepEqual(shortNames({ term: "Escrow account", aka: [] }), []);
});
