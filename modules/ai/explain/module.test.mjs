import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { digest, sheetFor, copyFor, scrub, outsiderAliases, anonymise, explainable, buildMessages, readAnswer, compute, words, roomLetters, payeeAliases, payeeSwap, payeeFree, dayless, movedBirths, MAX_LINES, MAX_CHARS, MAX_ITEMS, MAX_TEXT, SKIP, NOT_OFFERED } from "./compute.js";
import { aliases } from "../critic/compute.js";
import { compute as netWorth } from "../../balance/net-worth/compute.js";
import { compute as income } from "../../cashflow/income/compute.js";
import { compute as goals } from "../../goals/goals/compute.js";
import { compute as spending } from "../../cashflow/spending/compute.js";
import { compute as recurring } from "../../cashflow/recurring/compute.js";
import REGISTRY from "../../registry.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-31";
const plan = () => familyPlan(TODAY);
const REAL = /\b(Ana|Bo|Cy|Chase|Ally|Visa)\b/;
const MODS = new Map();
for (const e of REGISTRY) { const m = (await e.load()).default; MODS.set(`${m.group}/${m.id}`, m); }
const PAGES = explainable([...MODS.values()].map((m) => ({ key: `${m.group}/${m.id}`, group: m.group, title: m.title, purpose: m.purpose, status: m.status, hasCompute: typeof m.compute === "function" })));
const page = (p, key) => sheetFor(p, (c) => MODS.get(key).compute(c, { today: TODAY }), { today: TODAY });
/** Every number, yes/no and list length in a compute result, sorted: what must not change when only names change. */
const figures = (v, out = []) => {
  if (typeof v === "number") { if (Number.isFinite(v)) out.push(String(Math.round(v * 1e6) / 1e6)); }
  else if (typeof v === "boolean") out.push(v ? "yes" : "no");
  else if (Array.isArray(v)) { out.push(`#${v.length}`); v.forEach((x) => figures(x, out)); }
  else if (v && typeof v === "object") Object.values(v).forEach((x) => figures(x, out));
  return out;
};
const same = (a, b) => JSON.stringify(figures(a).sort()) === JSON.stringify(figures(b).sort());

test("the digest: a part's own numbers first (money to the cent, rates kept), yes/no, words for keys, ids and free text left out", () => {
  const d = digest({ parts: { inner: 1 }, netWorth: 1234.567, ok: true, label: "  Fine  ", id: "x1", ownerId: "p1", giverId: "p2", note: "private words", go: ["a", "b"], nothing: null, nan: NaN });
  assert.deepEqual(d.lines, ["net worth: 1234.57", "ok: yes", "label: Fine", "parts › inner: 1"]);
  assert.equal(d.cut, false);
  for (const k of ["id", "note", "go", "phone", "email", "where", "who", "rawPayee", "contains", "institution", "insurer", "firm", "contact", "fileName", "proof", "birthDate", "params"]) assert.ok(SKIP.has(k), k);
  assert.equal(words("sinceLastPct"), "since last pct");
  assert.equal(words("dti_ratio"), "dti ratio");
  assert.deepEqual(digest({ rate: 0.0625, withdrawalRate: 0.035, apr: 0.239, inflation: 0.025, er: 0.0004, share: -0.12345, big: 2.345, cents: 1234.567 }).lines,
    ["rate: 0.0625", "withdrawal rate: 0.035", "apr: 0.239", "inflation: 0.025", "er: 0.0004", "share: -0.1235", "big: 2.35", "cents: 1234.57"], "rates and shares to 4 significant digits, money to the cent");
});

test("the digest: lists of records (how many, the first few, a label instead of its code), a list repeated, long lists of numbers", () => {
  const items = Array.from({ length: 9 }, (_, i) => ({ id: `i${i}`, name: `Item ${i}`, type: "salary", typeLabel: "Pay from a job", amount: i * 10, rate: { apr: 0.2, id: "r" } }));
  const d = digest({ items, active: items, path: Array.from({ length: 30 }, (_, i) => i * 1.5), few: [1, 2.345], tags: ["a", "b"] });
  assert.deepEqual(d.lines.slice(0, 3), ["path: 30 values, first 0, last 43.5, lowest 0, highest 43.5", "few: 1, 2.35", "tags: a, b"], "short lists of values before lists of records");
  assert.equal(d.lines[3], "items (9 in all):");
  assert.equal(d.lines[4], "  1. name Item 0; type label Pay from a job; amount 0; rate apr 0.2");
  assert.equal(d.lines[4 + MAX_ITEMS], `  and ${9 - MAX_ITEMS} more`);
  assert.equal(d.lines[5 + MAX_ITEMS], "active: the same 9 as items");
});

test("the digest stops at MAX_LINES or MAX_CHARS and says something was left out; long text is cut; anything deeper than the depth limit is left out", () => {
  const big = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i]));
  const d = digest(big);
  assert.equal(d.cut, true);
  assert.equal(d.lines.length, MAX_LINES + 1);
  assert.equal(d.lines.at(-1), "(more numbers on the page were left out)");
  const wide = digest(Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, "x".repeat(300)])));
  assert.equal(wide.cut, true);
  assert.ok(wide.lines.slice(0, -1).reduce((s, l) => s + l.length + 1, 0) <= MAX_CHARS, "at most MAX_CHARS characters");
  assert.ok(wide.lines.length < 50);
  const long = digest({ text: "y".repeat(300) }).lines[0].slice("text: ".length);
  assert.equal(Array.from(long).length, MAX_TEXT);
  assert.ok(long.endsWith("…"));
  assert.deepEqual(digest({ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }).lines, []);
  assert.deepEqual(digest({ a: { b: { c: { d: { e: 1 } } } } }).lines, ["a › b › c › d › e: 1"]);
  assert.deepEqual(digest(null).lines, []);
});

test("the digest goes breadth first: a big early part never crowds out the figures of a later one", () => {
  const d = digest({ params: { brackets: [1, 2] }, tables: { a: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i])) }, result: { totalTax: 15071.6, agi: 158780 } });
  assert.ok(d.lines.includes("result › total tax: 15071.6"), "the later part's own figures");
  assert.ok(!d.lines.some((l) => l.startsWith("params")), "tax tables are not sent");
  const fed = page(plan(), "taxes/federal").lines;
  assert.ok(fed.some((l) => l.startsWith("result › total tax: ")), "the household's tax on the federal tax page");
  assert.ok(!fed.some((l) => /brackets/.test(l)));
});

test("ids: an id key or value is said as the stand-in of what it names, any other app-made id is left out", () => {
  const card = randomUUID(), ana = randomUUID(), stray = randomUUID();
  const ids = new Map([[card, "credit card 1"], [ana, "Adult 1"], ["d-1", null]]);
  assert.deepEqual(digest({ balances: { [card]: 5, "d-1": 2, [stray]: 3 }, [`retireAge:${ana}`]: 65, from: ana, link: stray, entryId: "pr1", fundedBy: [card] }, { ids }).lines,
    ["retire age Adult 1: 65", "from: Adult 1", "funded by: credit card 1", "balances › credit card 1: 5"], "an id with no name, a stray id and an id key are left out");
  // the family plan with ids the way the app makes them
  let json = JSON.stringify(plan());
  for (const id of new Set(JSON.stringify(plan()).match(/"[a-z]{1,2}-[a-z0-9]+"/g))) json = json.split(id).join(`"${randomUUID()}"`);
  const p = JSON.parse(json);
  const uuid = /[0-9a-f]{8}[- ][0-9a-f]{4}[- ][0-9a-f]{4}/i;
  for (const key of ["debt/payoff", "retirement/social-security", "scenarios/compare", "estate/gifting", "balance/liquidity", "career/salary", "investments/allocation"]) {
    const s = page(p, key);
    assert.ok(!s.lines.some((l) => uuid.test(l)), `${key}: ${s.lines.find((l) => uuid.test(l))}`);
  }
  assert.ok(page(p, "debt/payoff").lines.some((l) => l.includes("balances credit card 1: 6127.47; balances mortgage 1: 264400.21")), "which balance is the card's");
  assert.ok(page(p, "retirement/social-security").lines.includes("couple › survivor monthly › Adult 1: 2900"));
  assert.ok(page(p, "scenarios/compare").lines.includes("current › retire age Adult 1: 65"));
});

test("what the AI reads for a page: its own compute on a renamed copy; no real names of people or accounts; numbers unchanged", () => {
  for (const run of [(c) => netWorth(c, { today: TODAY }), (c) => income(c, { today: TODAY }), (c) => goals(c, { today: TODAY })]) {
    const s = sheetFor(plan(), run, { today: TODAY });
    assert.equal(s.ok, true);
    assert.ok(!REAL.test(s.lines.join("\n")), s.lines.find((l) => REAL.test(l)));
  }
  const nw = sheetFor(plan(), (c) => netWorth(c, { today: TODAY }), { today: TODAY });
  assert.ok(nw.lines.includes(`net worth: ${netWorth(plan(), { today: TODAY }).netWorth}`), "the same figure the page shows");
  const inc = sheetFor(plan(), (c) => income(c, { today: TODAY }), { today: TODAY });
  assert.ok(inc.lines.some((l) => l.includes("Adult 1's salary")), "names in text are swapped for the stand-ins");
  assert.ok(inc.names.some((n) => n.alias === "Adult 1"), "the names to put back");
});

test("a page whose compute fails, that has no numbers yet, or that says it is not ready, says so instead of sending zeros", () => {
  assert.equal(sheetFor(plan(), () => { throw new Error("boom"); }).why, "error");
  assert.equal(sheetFor(plan(), () => ({ error: "Error: boom" })).why, "error", "the shell's way of reporting a failed compute");
  const empty = sheetFor(emptyPlan(), () => ({ ready: false, items: [] }));
  assert.deepEqual([empty.ok, empty.why], [false, "empty"]);
  assert.deepEqual([sheetFor(plan(), () => ({ ready: false, total: 0 })).why, page(plan(), "investments/fees").why], ["empty", "empty"], "no holdings yet: no fees of 0 to explain");
});

test("the pages offered: built, with a compute, not system or AI pages, not contacts, where papers are kept or the list of all pages", () => {
  const pages = [
    { key: "balance/net-worth", group: "balance", status: "usable", hasCompute: true },
    { key: "goals/vehicle", group: "goals", status: "planned", hasCompute: true },
    { key: "system/settings", group: "system", status: "usable", hasCompute: true },
    { key: "ai/critic", group: "ai", status: "usable", hasCompute: true },
    { key: "household/contacts", group: "household", status: "usable", hasCompute: true },
    { key: "overview/pages", group: "overview", status: "usable", hasCompute: true },
    { key: "overview/dashboard", group: "overview", status: "stub", hasCompute: true },
    { key: "x/no-compute", group: "x", status: "usable", hasCompute: false },
  ];
  assert.deepEqual(explainable(pages).map((p) => p.key), ["balance/net-worth", "overview/dashboard"]);
  assert.deepEqual(explainable(undefined), []);
  assert.ok(NOT_OFFERED.has("household/documents"));
  assert.ok(PAGES.length > 100 && !PAGES.some((p) => NOT_OFFERED.has(p.key)));
});

test("the question: the page, its numbers, and the person's question with names hidden (or the default question)", () => {
  const s = sheetFor(plan(), (c) => netWorth(c, { today: TODAY }), { today: TODAY });
  const m = buildMessages({ title: "Net worth", purpose: "What you own minus what you owe.", lines: s.lines, question: "Why is Ana's 401(k) so big compared with the Chase checking?", terms: s.terms });
  assert.equal(m[0].role, "system");
  assert.match(m[0].content, /never invent/);
  assert.match(m[0].content, /exactly as written/);
  assert.match(m[1].content, /^PAGE: Net worth \(What you own minus what you owe\.\)/);
  assert.match(m[1].content, /- net worth: \d+/);
  assert.ok(!REAL.test(m[1].content), m[1].content.split("QUESTION:")[1]);
  assert.match(m[1].content, /QUESTION: Why is Adult 1's 401\(k\) so big compared with the checking account 1\?$/);
  assert.match(buildMessages({ title: "T", lines: [] })[1].content, /QUESTION: What does this page tell me about my money\?$/);
  assert.equal(buildMessages({ title: "T", lines: [], question: "x".repeat(500) })[1].content.split("QUESTION: ")[1].length, 300, "cut to MAX_QUESTION");
  const p = poisoned(); p.household.people[0].name = "José Varga";
  const q = page(p, "property/home");
  const asked = buildMessages({ title: "Home", lines: q.lines, question: "Is the VARGA 401(k) on track for Jose? Will Zelda  Quorn get 14 Larkmoor Lane? Ask Mott Thorne.", terms: q.terms })[1].content.split("QUESTION: ")[1];
  assert.equal(asked, `Is the ${"someone in the household"} 401(k) on track for Adult 1? Will Person 3 get home 1? Ask Contact 1.`, "surnames, no accents, outsiders, an address");
});

test("the answer: a reasoning model's thinking dropped, the real names put back, tidy, never empty-looking", () => {
  const s = sheetFor(plan(), (c) => income(c, { today: TODAY }), { today: TODAY });
  const a = readAnswer("<think>working…</think>\n\nAdult 1 earns most.   \n\n\n\nChecking account 1 holds cash.", s.names);
  assert.equal(a, "Ana earns most.\n\nChecking account 1 (Chase checking) holds cash.");
  assert.equal(readAnswer("The loan on your house is the biggest debt; the property tax is not on this page.", s.names), "The loan on your house is the biggest debt; the property tax is not on this page.", "the AI's own words are not an account");
  const p = page(poisoned(), "cashflow/spending");
  assert.equal(readAnswer("Payee 1 took the most; home 1 is not on this page.", p.names), "Zelle to Zelda Quorn took the most; 14 Larkmoor Lane is not on this page.");
  const words = page(poisoned(), "balance/assets");
  assert.equal(readAnswer("You can tag a payment as a gift. Your biggest payee a month was rent. There is still room a bit lower; room B is insured; payee 12 is not one.", words.names),
    "You can tag a payment as a gift. Your biggest payee a month was rent. There is still room a bit lower; Zelda's room is insured; payee 12 is not one.", "the AI's own words are not stand-ins");
  assert.equal(readAnswer("reasoning only</think>Done.", []), "Done.");
  assert.equal(readAnswer("  ", []), "");
  assert.equal(readAnswer(undefined), "");
  assert.ok(readAnswer("y".repeat(5000)).length <= 3000);
});

test("names that are everyday words never rewrite the app's own words: Will, Max, Ira, Al with the state AL, an account named House", () => {
  const p = plan(); p.household.people[0].name = "Will"; p.household.people[1].name = "Max";
  const docs = page(p, "estate/documents").lines.join("\n");
  assert.ok(docs.includes("kind will; label Will;") && docs.includes("Named in the will: who raises the children"), docs.slice(0, 300));
  assert.ok(page(p, "goals/house").lines.includes("max price: 636883.96"));
  assert.ok(page(p, "debt/ratios").lines.includes("grades › dti › max: 0.36"));
  const ira = plan(); ira.household.people[1].name = "Ira";
  assert.ok(page(ira, "balance/liquidity").lines.some((l) => l.includes("type label Roth IRA / 401(k)")));
  const al = plan(); al.household.people[0].name = "Al"; al.household.state = "AL";
  assert.ok(page(al, "taxes/state").lines.includes("code: AL"));
  assert.ok(page(plan(), "debt/consolidation").lines.some((l) => l.includes("becomes debt the house answers for")), "the fixture's account named House");
});

test("typed names: a goal named like its account keeps its name; a name that runs past the cut is hidden before it", () => {
  const p = plan(); p.accounts.find((a) => a.id === "a-sav").name = "Emergency fund";
  assert.ok(page(p, "goals/goals").lines.some((l) => l.startsWith("  1. name Emergency fund; target 20000")));
  const q = plan(); q.goals[0].name = `${"x".repeat(150)} Chase checking`;
  const all = page(q, "goals/goals").lines.join("\n");
  assert.ok(!/Chase|checking …|ch…/.test(all), all.split("\n").find((l) => l.includes("xxx")));
});

test("surnames, the plan's name and exact birth dates are never sent", () => {
  const p = plan();
  p.meta.name = "Varga family plan";
  p.household.people.forEach((x) => { x.name = `${x.name} Varga`; });
  p.estate = { digital: [{ id: "dg1", kind: "email", name: "ana.varga1990@example.com", access: "manager", contact: "Bo Varga" }] };
  for (const key of ["reports/plan-summary", "household/people", "overview/timeline", "estate/digital", "retirement/social-security"]) {
    const all = page(p, key).lines.join("\n");
    assert.ok(!/varga|1990-05-20|1988-11-02|2020-03-03/i.test(all), `${key}: ${all.split("\n").find((l) => /varga|-05-20|11-02|03-03/i.test(l))}`);
  }
  assert.ok(page(p, "household/people").lines.includes("self › age: 36"), "the age goes instead");
  assert.ok(page(p, "household/people").lines.includes("self › retirement date: 2055-05"), "the day someone retires (a birth date plus 65 years) goes without its day");
});

test("dayless leaves the day out of every date; the digest does so only when told; movedBirths moves birth dates a few days in their month, ages kept", () => {
  assert.equal(dayless("Retires 2055-05-20; Medicare May 20, 2055; 20 May; Nov 1st; 2026-10-31 today; saved 1/1/2026; Marked 20 items; 2026-13-01; May 2055; Dec 45; 3/4 of 13/40/2026"),
    "Retires 2055-05; Medicare May 2055; May; Nov; 2026-10 today; saved 1/2026; Marked 20 items; 2026-13-01; May 2055; Dec 45; 3/4 of 13/40/2026");
  assert.deepEqual(digest({ when: "2055-05-20", "2055-05-20": 3 }, { keepDays: false }).lines, ["when: 2055-05", "2055 05: 3"]);
  assert.deepEqual(digest({ when: "2055-05-20", "2055-05-20": 3 }).lines, ["when: 2055-05-20", "2055 05 20: 3"]);
  const people = (...births) => ({ household: { people: births.map((b) => ({ name: "x", birthDate: b })) } });
  assert.deepEqual(movedBirths(people("1990-05-20", "1961-10-31", "2020-02-29", "2000-10-30", undefined), TODAY).household.people.map((x) => x.birthDate),
    ["1990-05-27", "1961-10-24", "2020-02-22", "2000-10-23", undefined], "a week on, or back when a week on would change the age today or the month");
  assert.equal(movedBirths(people("", undefined), TODAY), null, "nobody has a birth date");
  assert.equal(movedBirths(people("05/20/1990"), TODAY), true, "a birth date that cannot be read");
});

test("dates: a page that shows a date worked out from a birth date sends every date without its day; every other page keeps its days, whoever was born on them", () => {
  // Adult 1 born 15 January 1962 turns 65 on the day the last estimated tax payment is due
  const p = plan(); p.household.people[0].birthDate = "1962-01-15";
  assert.ok(page(p, "taxes/estimated").lines.some((l) => l.includes("due 2027-01-15")), "the tax page keeps its due dates");
  assert.ok(page(p, "household/calendar").lines.some((l) => l.includes("date 2027-01-15; kind tax")), "and so does the calendar");
  const who = page(p, "household/people").lines;
  assert.ok(who.includes("self › retirement date: 2027-01") && who.includes("self › plan end date: 2057-01"), "the day someone turns 65 goes without its day, and so does every other date on that page");
  assert.ok(!page(p, "overview/timeline").lines.some((l) => /\d{4}-\d{2}-\d{2}/.test(l)), "the timeline: no date with its day");
  // born on the 31st: the month ends elsewhere keep their days
  const q = plan(); q.household.people[0].birthDate = "1990-01-31";
  assert.ok(page(q, "balance/accounts").lines.includes("account › as of: 2026-10-31"));
  assert.ok(page(q, "debt/payoff").lines.includes("chosen › end date: 2039-02-28"));
  assert.ok(page(q, "goals/goals").lines.some((l) => l.includes("target date 2027-06-30")));
  assert.ok(page(q, "taxes/documents").lines.some((l) => l.includes("due by January 31")));
  // whatever day of its month each birth date is on, every page sends the same dates with their day: a missing day never points at a birthday
  const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
  const full = (lines) => lines.join("\n").match(new RegExp(`(?<!\\d)\\d{4}-\\d{2}-\\d{2}(?!\\d)|\\b${month}\\.? \\d{1,2}\\b|\\b\\d{1,2} ${month}\\b`, "g"))?.sort() ?? [];
  const at = (years, by) => {
    const x = plan();
    for (const h of x.household.people) {
      const d = new Date(`${Number(h.birthDate.slice(0, 4)) - years}${h.birthDate.slice(4)}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + by);
      h.birthDate = d.toISOString().slice(0, 10);
    }
    return x;
  };
  // 0, 11, 28 and 31 years older (59 and a half, Medicare, Social Security, required withdrawals, a child turning 17 and 18), each birth date then 3 days on (same months, same ages today)
  for (const years of [0, 11, 28, 31]) {
    const a = at(years, 0), b = at(years, 3);
    const keys = years === 28 ? PAGES.map((x) => x.key) : ["household/people", "overview/timeline", "reports/plan-summary", "reports/annual-review", "retirement/medicare", "retirement/social-security", "retirement/rmd", "household/calendar", "insurance/life-needs", "goals/education", "taxes/estimated"];
    for (const key of keys) {
      const la = page(a, key).lines, lb = page(b, key).lines;
      assert.deepEqual(full(la), full(lb), `${key} (${years} years older)`);
      for (const h of [...a.household.people, ...b.household.people]) assert.ok(!la.join("\n").includes(h.birthDate) && !lb.join("\n").includes(h.birthDate), `${key}: ${h.birthDate}`);
    }
  }
});

test("the payees the pages read stay as typed in the copy: Subscriptions, Rules, Categorise and Transfers send the figures they show", () => {
  const charges = (p) => ["2026-08-12", "2026-09-12", "2026-10-12"].map((d, i) => ({ id: `s${i}`, date: d, amount: -15.49, payee: "Netflix", rawPayee: `NFLX DIGITAL 884${i}`, accountId: "a-visa", category: "entertainment", tags: [], note: "" }));
  const p = plan(); p.transactions = charges(p);
  const real = MODS.get("cashflow/subscriptions").compute(p, { today: TODAY });
  assert.equal(real.count, 2, "the renamed payee is found by its name");
  const sub = page(p, "cashflow/subscriptions").lines;
  assert.ok(sub.includes(`yearly: ${Math.round(real.yearly * 100) / 100}`) && sub.includes("count: 2"), sub.join(" | "));
  assert.ok(!sub.join("\n").includes("Netflix") && sub.some((l) => l.includes("name Payee 1")), "the payee goes as its stand-in");
  const r = plan();
  r.rules = [{ id: "r1", contains: "pay", direction: "any", category: "salary", hits: 0, createdAt: TODAY }];
  r.transactions = [
    { id: "y1", date: "2026-10-01", amount: 3900, payee: "Acme Pay", rawPayee: "ACME PAY 4471", accountId: "a-chk", category: "", tags: [], note: "" },
    { id: "y2", date: "2026-10-02", amount: -60, payee: "Corner Grocer", rawPayee: "CORNER GROCER 0012", accountId: "a-visa", category: "", tags: [], note: "" },
    { id: "y3", date: "2026-10-04", amount: -30, payee: "Gas Stop", rawPayee: "GAS STOP 99", accountId: "a-visa", category: "", tags: [], note: "" },
  ];
  const rules = page(r, "transactions/rules").lines;
  assert.ok(rules.includes("would fix: 1") && rules.some((l) => l.endsWith("matches 1")), rules.join(" | "));
  const cat = copyFor(r, { today: TODAY }).copy;
  assert.deepEqual(MODS.get("transactions/categorize").compute(cat).groups.map((g) => g.suggestion?.why ?? null), ["a rule matches", null, null]);
  const t = plan();
  t.transactions = [
    { id: "x1", date: "2026-10-03", amount: -500, payee: "Move to savings", rawPayee: "ONLINE BANKING 8812", accountId: "a-chk", category: "", tags: [], note: "" },
    { id: "x2", date: "2026-10-05", amount: 500, payee: "From checking", rawPayee: "DEP 8812", accountId: "a-sav", category: "", tags: [], note: "" },
  ];
  assert.ok(page(t, "transactions/transfers").lines.some((l) => l.endsWith("gap 2; score 8")), "the payee's wording still counts");
  for (const [x, key] of [[p, "cashflow/subscriptions"], [r, "transactions/rules"], [r, "transactions/categorize"], [t, "transactions/transfers"]])
    assert.ok(same(MODS.get(key).compute(x, { today: TODAY }), MODS.get(key).compute(copyFor(x, { today: TODAY }).copy, { today: TODAY })), key);
  // the stand-ins, and what the digest says instead of each payee and bank text
  assert.deepEqual(payeeAliases(r).map((x) => `${x.alias}=${x.name}`), ["Payee 1=Acme Pay", "Payee 2=Corner Grocer", "Payee 3=Gas Stop"]);
  const g = plan(); g.transactions = [{ id: "g1", date: "2026-10-01", amount: -50, payee: "Groceries", rawPayee: "SAFEWAY 0042", accountId: "a-visa" }, { id: "g2", date: "2026-10-02", amount: -9, payee: "", rawPayee: "ZELLE TO QUORN" }];
  assert.deepEqual([...payeeSwap(g)], [["SAFEWAY 0042", "Payee 1"], ["ZELLE TO QUORN", "Payee 2"]], "a payee typed as a category's name (Groceries) is the app's word, not a stand-in");
  assert.deepEqual(digest({ payee: "Acme Pay", text: "Paid Corner Grocer twice", label: "Gas Stop", other: "Stop" }, { swap: payeeSwap(r) }).lines, ["payee: Payee 1", "text: Paid Payee 2 twice", "label: Payee 3", "other: Stop"], "a payee as a whole text, or of two or more words inside one");
  assert.deepEqual(digest({ title: "Gas Stop is thin", label: "Gas Stop", text: "Paid Gas Stop twice", "Gas Stop": 2 }, { swap: payeeSwap(r), own: new Set(["Gas Stop is thin", "Gas Stop"]) }).lines,
    ["title: Gas Stop is thin", "label: Gas Stop", "text: Paid Payee 3 twice", "gas stop: 2"], "the page's own words (`own`) stay, as a whole text or a key; a text it does not say itself is still swapped");
});

test("a payee typed like the app's own words (an account's kind, the budget's Needs, Wants and Savings, a goal, an expense) never turns those words into a stand-in", () => {
  const p = plan();
  const payees = ["Mortgage", "Savings", "Checking", "Cash", "Needs", "Wants", "Credit card", "Mortgage payment", "Emergency fund", "Japan trip", "Zelle to Zelda Quorn"];
  p.transactions = payees.map((x, i) => ({ id: `w${i}`, date: `2026-10-${String(10 + i).padStart(2, "0")}`, amount: -100 - i, payee: x, rawPayee: `${x.toUpperCase()} 0042`, accountId: "a-chk", category: "", tags: [], note: "" }));
  const lines = (key) => page(p, key).lines;
  for (const key of ["balance/liabilities", "balance/statement", "reports/statements", "cashflow/budget-percent", "estate/beneficiaries", "cashflow/expenses", "overview/alerts", "overview/timeline", "goals/goals", "debt/payoff"]) {
    const l = lines(key).find((x) => /\bPayee \d+\b|Zelda|Quorn/.test(x));
    assert.ok(!l, `${key}: ${l}`);
  }
  assert.ok(lines("balance/liabilities").some((l) => l.includes("type label Mortgage")) && lines("balance/liabilities").includes("highest › type label: Credit card"));
  assert.ok(lines("cashflow/budget-percent").some((l) => /^ {2}\d\. label Savings; /.test(l)) && lines("cashflow/budget-percent").some((l) => /^ {2}\d\. label Needs; /.test(l)));
  assert.ok(lines("overview/alerts").some((l) => l.includes("title Emergency fund is thin")));
  assert.ok(lines("cashflow/expenses").some((l) => l.includes("name Mortgage payment")));
  // on the pages that list payees they are still stand-ins, unless the page says the same words of its own (Checking, an account's kind, on Accounts)
  const top = lines("cashflow/spending").filter((l) => /^ {2}\d+\. payee /.test(l)).map((l) => l.split(";")[0].replace(/^ {2}\d+\. payee /, ""));
  assert.ok(top.length === MAX_ITEMS && top.every((x) => /^Payee \d+$/.test(x)), top.join(", "));
  const accounts = lines("balance/accounts").join("\n");
  assert.ok(!/Zelda|Quorn|Japan trip|Emergency fund/.test(accounts) && /payee Payee \d+/.test(accounts) && accounts.includes("label Checking"), accounts);
  // the copy the page's own words are read from: no payee left, one made-up word per payee as typed (Spending's top payees as before)
  const poison = poisoned(), { copy, swap } = copyFor(poison, { today: TODAY }), free = payeeFree(copy, swap);
  assert.ok(free.transactions.every((t) => /^Zq[a-z]+$/.test(t.payee) && (t.rawPayee === undefined || /^Zq[a-z]+$/.test(t.rawPayee))), JSON.stringify(free.transactions.map((t) => [t.payee, t.rawPayee])));
  assert.ok(!MARKERS.test(JSON.stringify([free.transactions.map((t) => [t.payee, t.rawPayee]), free.rules.map((r) => r.payee)])), "no payee, bank text or rule's payee name left");
  assert.deepEqual(spending(free, { today: TODAY }).topPayees.map((x) => [x.total, x.count]), spending(copy, { today: TODAY }).topPayees.map((x) => [x.total, x.count]));
});

/** The family plan with every name and note the plan can hold filled in (all invented): people outside the household, payees, addresses, an employer, banks and an insurer, serial numbers, a file name, a surname. */
function poisoned() {
  const p = plan();
  p.meta.name = "Varga family plan";
  p.household.people.forEach((x) => { x.name = `${x.name} Varga`; });
  const inst = { "a-chk": "Zephyr Credit Union", "a-sav": "Harborline Bank", "a-401": "Brindle Retirement", "a-roth": "Brindle Retirement", "a-bk401": "Corvane Benefits", "a-brk": "Corvane Brokerage", "a-mort": "Harborline Bank", "a-visa": "Zephyr Credit Union", "a-car": "Quillon Auto Finance" };
  for (const a of p.accounts) { a.institution = inst[a.id] ?? ""; a.notes = "NOTEX routing"; }
  p.transactions = [
    { id: "t1", date: "2026-10-03", amount: -250, payee: "Zelle to Zelda Quorn", rawPayee: "ZELLE TO QUORN Z CONF QX4471", accountId: "a-chk", category: "gifts", tags: ["Ignatz"], note: "NOTEX rent", key: "k1" },
    { id: "t2", date: "2026-10-05", amount: -89.5, payee: "Dr Pell Pediatrics", rawPayee: "PELL PEDIATRICS 4432", accountId: "a-visa", category: "health", tags: [], note: "", key: "k2" },
    { id: "t3", date: "2026-09-05", amount: -89.5, payee: "Dr Pell Pediatrics", rawPayee: "PELL PEDIATRICS 4419", accountId: "a-visa", category: "health", tags: [], note: "", key: "k3" },
    { id: "t4", date: "2026-08-05", amount: -89.5, payee: "Dr Pell Pediatrics", rawPayee: "PELL PEDIATRICS 4407", accountId: "a-visa", category: "health", tags: [], note: "", key: "k4" },
    { id: "t5", date: "2026-10-01", amount: 3900, payee: "Quillon Robotics payroll", rawPayee: "QUILLON ROBOTICS PAYROLL", accountId: "a-chk", category: "salary", tags: [], note: "", key: "k5" },
    { id: "t6", date: "2026-10-10", amount: -40, payee: "Ana Quorn", accountId: "a-visa", category: "", tags: [], note: "" },
    { id: "t7", date: "2026-10-12", amount: -15.49, payee: "Netflix", accountId: "a-visa", category: "", tags: [], note: "" },
    { id: "t8", date: "2026-09-12", amount: -15.49, payee: "Netflix", accountId: "a-visa", category: "", tags: [], note: "" },
    { id: "t9", date: "2026-08-12", amount: -15.49, payee: "NETFLIX", accountId: "a-visa", category: "", tags: [], note: "" },
    // payees the pages read: a payee renamed from the bank's text (Subscriptions), "to" in a payee (Transfers), a rule's word inside "Payee"
    ...["2026-08-20", "2026-09-20", "2026-10-20"].map((d, i) => ({ id: `t1${i}`, date: d, amount: -11.99, payee: "Spotify", rawPayee: `SPTFY DIGITAL 77${i}`, accountId: "a-visa", category: "", tags: [], note: "" })),
    { id: "t13", date: "2026-10-03", amount: -500, payee: "Move to savings", rawPayee: "ONLINE BANKING 8812", accountId: "a-chk", category: "", tags: [], note: "" },
    { id: "t14", date: "2026-10-05", amount: 500, payee: "From checking", rawPayee: "DEP 8812", accountId: "a-sav", category: "", tags: [], note: "" },
  ];
  p.categories = [{ id: "c-dues", label: "Varga dues", kind: "expense" }];
  p.rules = [{ id: "r1", contains: "QUORN", direction: "out", category: "gifts", payee: "Zelda Quorn", hits: 3, createdAt: TODAY }, { id: "r2", contains: "pay", direction: "any", category: "income-salary", hits: 0, createdAt: TODAY }];
  p.imports = [{ id: "im1", at: TODAY, accountId: "a-chk", fileName: "Zephyr_QX4471_Varga_Oct.csv", rows: 6, added: 6, skipped: 0, bad: 0 }];
  p.holdings = [{ id: "h1", accountId: "a-brk", symbol: "VTI", name: "Total market (Mott Thorne pick)", shares: 50, price: 280, priceAsOf: TODAY, costBasis: 10000, assetClass: "", lots: [] },
    { id: "h2", accountId: "a-401", symbol: "", name: "Brindle Target Retirement 2050 Trust", shares: 100, price: 30, costBasis: 2500, assetClass: "", lots: [] }];
  p.equity = { symbol: "QRBT", price: 50, priceAsOf: TODAY, personId: "p-ana", grants: [{ id: "eg1", kind: "rsu", name: "Quillon Robotics 2025 grant", granted: "2025-01-01", vestStart: "2025-01-01", shares: 400, vestMonths: 48, cliffMonths: 12, every: 3 }] };
  p.insurance.policies = [
    { id: "pol1", name: "Quillmark term for Ana", kind: "term", personId: "p-ana", insurer: "Quillmark Mutual", benefit: 500000, premium: 40, period: "monthly", notes: "NOTEX policy QX4471" },
    { id: "pol2", name: "Quillmark home", kind: "home", personId: "", insurer: "Quillmark Mutual", benefit: 400000, premium: 1800, period: "annual", accountId: "a-home" },
  ];
  p.estate = {
    documents: [{ id: "ed1", kind: "will", personId: "p-ana", status: "done", done: TODAY, updatedAt: TODAY, where: "NOTEX safe at Zelda's", notes: "NOTEX" }],
    beneficiaries: [
      { key: "account:a-401", accountId: "a-401", primary: [{ name: "Zelda Quorn", share: 1, personId: "" }], contingent: [{ name: "Ignatz Quorn", share: 1, personId: "" }], reviewedAt: TODAY },
      { key: "policy:pol1", policyId: "pol1", primary: [{ name: "Bo Varga", share: 0.5, personId: "p-bo" }, { name: "Ignatz Quorn", share: 0.5, personId: "" }], contingent: [], reviewedAt: TODAY },
    ],
    gifts: [{ id: "gf1", to: "Ignatz Quorn", from: "both", amount: 5000, year: 2026, kind: "cash", superfund: false, notes: "NOTEX" }, { id: "gf2", to: "Cy", from: "p-bo", amount: 3000, year: 2026, kind: "529", superfund: false }],
    stateTax: { exemption: 0, rate: 0 },
    legacy: { bequests: [{ id: "bq1", to: "Ravi Quorn", kind: "person", amount: 20000, notes: "NOTEX" }, { id: "bq2", to: "Fernwood Animal Rescue", kind: "charity", amount: 5000 }], includeHome: true },
    inheritance: { items: [{ id: "in1", from: "Grandma Odile Quorn", amount: 100000, year: 2030, kind: "cash", notes: "NOTEX" }] },
    digital: [{ id: "dg1", kind: "email", name: "ana.varga1990@example.com", access: "legacy", contact: "Ravi Quorn", notes: "NOTEX" }],
  };
  p.contacts = [{ id: "ct1", role: "attorney", name: "Mott Thorne", firm: "Thorne Law", phone: "555-0100", email: "mott@example.com", notes: "NOTEX", accountIds: ["a-chk"], policyIds: ["pol1"], last4: { "a-chk": "4471" } }];
  p.property = [
    { id: "pr1", kind: "home", accountId: "a-home", name: "14 Larkmoor Lane", value: 380000, purchasePrice: 300000, purchaseDate: "2022-06-01", improvements: 0, propertyTax: 6000, insurance: 1800, hoaMonthly: 0, maintenance: 0.01, appreciation: 0.03, sellCosts: 0.06 },
    { id: "pr2", kind: "vehicle", name: "Ravi's old Camry", value: 9000, purchasePrice: 20000, purchaseDate: "2019-01-01", milesYear: 12000, mpg: 30, fuelPrice: 3.5, insuranceYear: 900, maintenanceYear: 600, registrationYear: 100, loss: 0.15, loanAccountId: "a-car" },
    { id: "pr3", kind: "rental", name: "88 Oakhurst Ave unit B", value: 250000, purchasePrice: 200000, purchaseDate: "2020-01-01", rentMonthly: 1800, vacancy: 0.05, propertyTax: 3000, insurance: 900, hoaMonthly: 0, maintenance: 0.01, management: 0.08, utilitiesMonthly: 0, otherMonthly: 0, cashIn: 50000, loanBalance: 0, loanRate: 0, loanPayment: 0, landShare: 0.2, improvements: 0, appreciation: 0.03 },
  ];
  p.debts[0].securedBy = "14 Larkmoor Lane";
  p.belongings = [{ id: "bl1", name: "Ring from Odile", kind: "jewelry", room: "Zelda's room", bought: "2020-01-01", paid: 3000, value: 3500, valuedAt: TODAY, life: null, policyId: "pol2", listed: true, details: "serial SN-QX4471", proof: "receipt in the blue folder", updatedAt: TODAY },
    { id: "bl2", name: "TV", kind: "electronics", room: "Den", paid: 800, value: 400, policyId: "", details: "", proof: "" }];
  p.papers = [{ key: "taxReturns", where: "NOTEX", copy: "NOTEX", who: "NOTEX Zelda", none: false, notes: "NOTEX", updatedAt: TODAY }];
  p.reminders = [{ id: "rm1", name: "Pay Zelda back", date: "2026-11-15", repeat: "none", amount: 300, note: "NOTEX" }];
  p.events = [{ id: "ev1", name: "Ignatz's wedding", kind: "wedding", date: "2027-06-01", people: 3, guests: 100, perGuest: 80, venue: 5000 }];
  p.retirement.pensions = [{ id: "pn1", personId: "p-bo", name: "Ironvale Steel pension", monthly: 800, startAge: 65, cola: 0 }];
  p.retirement.annuities = [{ id: "an1", name: "Quillmark income annuity", insurer: "Quillmark Mutual", personId: "p-ana", premium: 100000, monthly: 550, startAge: 65, joint: false, cola: 0 }];
  p.scenarios = [{ id: "sc1", name: "If Zelda moves in", changes: { spendingMonthly: 7500 }, createdAt: TODAY }];
  p.advisor = { firm: "Parkside Advisors (Mott Thorne)", date: TODAY, fee: 0.01, quotedChance: 0.85, notes: "NOTEX", changes: {} };
  p.pageNotes = { "goals/charitable": "NOTEX Zelda" };
  p.reviews = [{ month: "2026-09", at: "2026-10-01", note: "NOTEX Zelda" }];
  p.notes = "NOTEX Zelda";
  p.taxes.gains = [{ id: "gn1", name: "Sold Quillon shares for Ignatz", proceeds: 8000, basis: 5000, held: "long" }];
  p.taxes.extraDocuments = [{ id: "xd1", form: "1099-MISC", from: "Parkside Advisors (Mott Thorne)" }];
  p.income.find((i) => i.id === "i-side").name = "Photography (Varga, B.)";
  p.whatIfs = {
    offers: { personId: "p-ana", years: 3, current: {}, offers: [{ id: "of1", name: "Offer from Initrode via Mott", salary: 120000 }] },
    business: { name: "Bo Varga Lens LLC", incomeId: "i-side", expenses: [{ id: "bx1", name: "Paid Ravi for editing", category: "contractors", amount: 100, period: "monthly" }] },
    purchase: { name: "Ring for Zelda", price: 4000, salesTax: 0.08, when: "2027-01-01", saved: 0, apr: 0.2, termMonths: 12 },
    renovation: { project: "Odile's room", cost: 20000, recoup: 0.6 },
  };
  return p;
}
/** What must never reach the AI from that plan: every marker, whole word or not, any case. */
const MARKERS = /varga|zelda|quorn|ignatz|odile|ravi\b|mott|thorne|fernwood|pell|pediatrics|quillon|initrode|quillmark|ironvale|parkside|zephyr|harborline|brindle|corvane|larkmoor|oakhurst|camry|qx4471|blue folder|notex|example\.com|1990-05-20|1988-11-02|2020-03-03|\b(ana|bo|cy|chase|ally)\b/i;

test("every page offered, on a plan holding every name and note there is: none of it reaches the AI, and no figure changes", () => {
  const p = poisoned();
  const { copy, names } = copyFor(p, { today: TODAY });
  const others = outsiderAliases(p, { today: TODAY });
  const anon = anonymise(p, { today: TODAY, outsiders: others }).plan;
  let sent = 0;
  for (const { key, title, purpose } of PAGES) {
    const s = page(p, key);
    const text = [...s.lines, ...buildMessages({ title, purpose, lines: s.lines, terms: s.terms }).map((m) => m.content)].join("\n");
    assert.ok(!MARKERS.test(text), `${key}: ${text.split("\n").find((l) => MARKERS.test(l))}`);
    if (s.ok) sent++;
    // stand-ins change names only: every figure of the page is the same on the anonymised copy and on the scrubbed one
    const run = (c) => { try { return MODS.get(key).compute(structuredClone(c), { today: TODAY }); } catch (e) { return String(e); } };
    assert.ok(same(run(anon), run(copy)), `${key}: a figure changed`);
  }
  assert.ok(sent > 100, `${sent} pages had numbers`);
  // the pages that group or read payees: the same totals, counts and matches as on the real plan
  for (const key of ["cashflow/spending", "cashflow/recurring", "cashflow/subscriptions", "transactions/rules", "transactions/categorize", "transactions/transfers", "transactions/duplicates", "household/calendar"])
    assert.ok(same(MODS.get(key).compute(structuredClone(p), { today: TODAY }), MODS.get(key).compute(structuredClone(copy), { today: TODAY })), `${key}: a figure differs from the real plan`);
  const s = spending(copy, { today: TODAY }), real = spending(p, { today: TODAY });
  assert.deepEqual(s.topPayees.map((x) => [x.total, x.count]), real.topPayees.map((x) => [x.total, x.count]));
  assert.deepEqual(recurring(copy, { today: TODAY }).detected.map((r) => [r.count, r.amount]), recurring(p, { today: TODAY }).detected.map((r) => [r.count, r.amount]));
  const top = page(p, "cashflow/spending").lines.filter((l) => /^ {2}\d+\. payee /.test(l)).map((l) => l.split(";")[0].replace(/^ {2}\d+\. payee /, ""));
  assert.ok(top.length >= 5 && top.every((x) => /^Payee \d+$/.test(x)) && new Set(top).size === top.length, `each payee its own stand-in: ${top}`);
  assert.ok(payeeAliases(p).some((x) => x.name === "Netflix") && payeeAliases(p).some((x) => x.name === "NETFLIX"), "Netflix and NETFLIX stay two payees, as on the page");
  // and the names come back on screen
  for (const [alias, name] of [["Payee 2", "Dr Pell Pediatrics"], ["home 1", "14 Larkmoor Lane"], ["Person 3", "Zelda Quorn"], ["grant 1", "Quillon Robotics 2025 grant"], ["room B", "Zelda's room"]]) assert.ok(names.some((n) => n.alias === alias && n.name === name), alias);
  assert.ok(!names.some((n) => n.alias === "VTI"), "a symbol is not put back: it can be an everyday word");
});

test("the stand-ins: in the order handed out; one per payee, outsider, room; the page's reading of a name kept", () => {
  assert.deepEqual([0, 1, 7, 8, 24, 25, 26, 50].map(roomLetters), ["A", "B", "H", "J", "Z", "ZA", "ZB", "ZZA"], "no I; letters that sort as handed out");
  const p = poisoned();
  const people = aliases(p, { today: TODAY }), others = outsiderAliases(p, { today: TODAY });
  assert.deepEqual(others.map((o) => `${o.alias}=${o.name}`), ["Person 1=Ignatz Quorn", "Person 2=Ravi Quorn", "Charity 1=Fernwood Animal Rescue", "Person 3=Zelda Quorn", "Giver 1=Grandma Odile Quorn", "Contact 1=Mott Thorne"],
    "Cy is in the household, Bo Varga is on the policy as himself");
  const a = anonymise(p, { today: TODAY, outsiders: others }), c = a.plan;
  scrub(c, { people, others, terms: a.terms });
  assert.deepEqual(c.estate.gifts.map((g) => g.to), ["Person 1", "Child 1"]);
  assert.deepEqual(c.estate.beneficiaries.map((b) => b.primary.map((x) => x.name)), [["Person 3"], ["Adult 2", "Person 1"]]);
  assert.deepEqual([c.transactions[0].payee, c.transactions[0].rawPayee, c.transactions[5].rawPayee, c.transactions[0].tags], ["Zelle to Zelda Quorn", "ZELLE TO QUORN Z CONF QX4471", undefined, ["tag 1"]], "payees and the bank's text stay for the pages that read them; the digest swaps them");
  assert.deepEqual(payeeAliases(p).slice(0, 4).map((x) => `${x.alias}=${x.name}`), ["Payee 1=Zelle to Zelda Quorn", "Payee 2=Dr Pell Pediatrics", "Payee 3=Quillon Robotics payroll", "Payee 4=Ana Quorn"]);
  assert.equal(payeeSwap(p).get("PELL PEDIATRICS 4419"), "Payee 2", "the bank's text is said as its payee's stand-in");
  assert.deepEqual(c.holdings.map((h) => h.name), ["VTI", "holding 1 target 2050"], "a target-date fund stays one");
  assert.deepEqual(c.belongings.map((b) => [b.name, b.room, b.details, b.proof]), [["jewelry 1", "room B", "", "noted"], ["electronics 1", "room A", "", ""]], "rooms in the same order (Den before Zelda's)");
  const q = plan(); q.belongings = [{ id: "b1", name: "Grandpa's clock", kind: "other", room: "Hall", value: 100 }];
  const qa = anonymise(q, { today: TODAY }).plan; scrub(qa, { people: aliases(q, { today: TODAY }) });
  assert.equal(qa.belongings[0].name, "belonging 1", "not 'item 1', which the AI may write about a line on the page");
  assert.deepEqual([c.meta.name, c.policies?.[0]?.insurer ?? c.insurance.policies[0].insurer, c.imports[0].fileName, c.debts[0].securedBy, c.reminders[0].name, c.reminders[0].note], ["", "", "", "home 1", "reminder 1", ""]);
  assert.equal(c.categories[0].label, `${"someone in the household"} dues`);
});
