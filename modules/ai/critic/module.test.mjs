import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compute, aliases, accountAliases, hideTerms, hide, restore, anonymise, plainWords, partLine, papersLine, factSheet,
  allowedPages, buildPrompt, findList, readAnswer, cut, MAX_POINTS, MAX_TITLE, LEVELS, SOMEONE, ALWAYS_PAGES,
} from "./compute.js";
import { compute as computeHealth } from "../../overview/health-score/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-31";
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The name as a whole word, any case, any alphabet: the same guards the page's own hiding uses. */
const word = (name) => new RegExp(`(?<![\\p{L}\\p{N}_])${esc(name)}(?![\\p{L}\\p{N}_])`, "iu");
const sheet = (p) => factSheet(p, { today: TODAY });
const text = (p) => sheet(p).lines.join("\n");
const person = (p, id) => p.household.people.find((x) => x.id === id);

test("people's stand-ins: by household order, named or not; a dependent of 18 or more is not a child; empty entries skipped", () => {
  const p = familyPlan(TODAY);
  assert.deepEqual(aliases(p, { today: TODAY }), [{ name: "Ana", alias: "Adult 1", kind: "person" }, { name: "Bo", alias: "Adult 2", kind: "person" }, { name: "Cy", alias: "Child 1", kind: "person" }]);
  p.household.people.push({ id: "p-gran", name: "Gran", role: "dependent", birthDate: "1948-01-15" }, null, { id: "p-new", name: "", role: "dependent" });
  assert.deepEqual(aliases(p, { today: TODAY }).map((x) => x.alias), ["Adult 1", "Adult 2", "Child 1", "Dependent 1", "Child 2"], "Gran is 78; the unnamed baby (no birth date) is a child");
  assert.deepEqual(aliases(emptyPlan()), []);
});

test("accounts' stand-ins: their kind, numbered when several share it, in plain nouns", () => {
  const p = familyPlan(TODAY);
  p.accounts.push({ id: "a-hsa", name: "Ana's HSA", type: "hsa", balance: 1 });
  const by = Object.fromEntries(accountAliases(p).map((a) => [a.name, a.alias]));
  assert.equal(by["Visa card"], "the credit card");
  assert.equal(by["Ana's 401(k)"], "401(k) 1"); assert.equal(by["Bo's old 401(k)"], "401(k) 2", "two 401(k)s can be told apart");
  assert.equal(by["Bo's Roth IRA"], "the Roth account"); assert.equal(by["Ana's HSA"], "the health savings account");
  assert.equal(by["Ally savings"], "the savings account"); assert.equal(by.House, "the property");
});

test("hiding typed text: whole words in any alphabet and letter case, first names of full names, people before accounts", () => {
  const terms = hideTerms([{ name: "Jo", alias: "Adult 1" }, { name: "Ana", alias: "Adult 2" }, { name: "Zoë", alias: "Child 1" }]);
  assert.equal(hide("Joël and Jo; Anaïs and ana; Zoë's bike; ZOË; Anagram", terms), "Joël and Adult 1; Anaïs and Adult 2; Child 1's bike; Child 1; Anagram");
  assert.equal(hide("Zoe\u0308's bike", terms), "Child 1's bike", "a name typed with a separate accent mark");
  const full = hideTerms([{ name: "Ana Lopez", alias: "Adult 1" }, { name: "Bo Lopez", alias: "Adult 2" }]);
  assert.equal(hide("Ana Lopez's car, bo's bike, BO LOPEZ's boat", full), "Adult 1's car, Adult 2's bike, Adult 2's boat");
  assert.equal(hide("A new roof", hideTerms([{ name: "A", alias: "Adult 1" }])), "A new roof", "a one-letter name is not hunted for in typed text");
  const twins = hideTerms([{ name: "Bo Lopez", alias: "Adult 1" }, { name: "Bo Kim", alias: "Adult 2" }, { name: "Cy", alias: "Child 1" }, { name: "Cy", alias: "Child 2" }]);
  assert.equal(hide("Bo's car, Cy's bike, Bo Kim's boat", twins), `${SOMEONE}'s car, ${SOMEONE}'s bike, Adult 2's boat`, "a shared name is hidden without naming the wrong person");
  const both = hideTerms([{ name: "Cy", alias: "Child 1" }], [{ name: "Cy", alias: "the 529 plan" }, { name: "Chase Sapphire", alias: "the credit card" }, { name: "Mortgage", alias: "the mortgage" }, { name: "Emergency fund", alias: "the savings account" }], { keep: ["Emergency fund"] });
  assert.equal(hide("Cy's college; pay off chase sapphire; the Mortgage; Emergency fund", both), "Child 1's college; pay off the credit card; the Mortgage; Emergency fund",
    "an account named like a person, like its kind or like a goal is left alone");
  assert.equal(hide("Jo$&e's car", hideTerms([{ name: "Jo$&e", alias: "Adult 1" }])), "Adult 1's car");
});

test("putting names back: any letter case, $ in a name taken as it is, accounts keep their stand-in and get their name after it", () => {
  const names = [{ name: "Jo$&e", alias: "Adult 1", kind: "person" }, { name: "Ke$'ha", alias: "Adult 2", kind: "person" }, { name: "", alias: "Child 1", kind: "person" },
    { name: "Visa card", alias: "the credit card", kind: "account" }, { name: "Ana's 401(k)", alias: "the 401(k)", kind: "account" }, { name: "Mortgage", alias: "the mortgage", kind: "account" }];
  assert.equal(restore("Adult 1 should act; adult 1's car; Adult 2 too; Adult 12 is not a person; Child 1 has no name", names), "Jo$&e should act; Jo$&e's car; Ke$'ha too; Adult 12 is not a person; Child 1 has no name");
  assert.equal(restore("The credit card first, then the 401(k) and the mortgage.", names), "The credit card (Visa card) first, then the 401(k) (Ana's 401(k)) and the mortgage.");
});

test("the fact sheet: stand-ins and birthday-aware ages, the health score's parts, the next steps, the legal papers", () => {
  const p = familyPlan(TODAY);
  const s = sheet(p);
  assert.equal(s.ready, true);
  assert.equal(s.lines[0], "Household: Adult 1 (age 36), Adult 2 (age 37), Child 1 (age 6); files taxes as married filing jointly; lives in TX.", "Bo turns 38 on 2 November");
  const all = s.lines.join("\n");
  assert.match(all, /Plan health score: \d+ of 100/);
  for (const t of ["Cash cushion (a problem)", "Saving each month", "Next step (do now)", "Debt (fine): $6,400 of debt at 10% or more (the credit card).", "Emergency fund, Replace Adult 2's car, Child 1's college, Japan trip need more each month",
    "Will and other legal papers: 0 of 11 done. Missing for each adult: Will, Financial power of attorney, Health care power of attorney, Living will and Medical records release (HIPAA). Missing for the household: Guardian for the children.",
    "Warning about the legal papers: No guardian is named for Child 1. If both parents died, a court would choose who raises Child 1."]) assert.ok(all.includes(t), `has "${t}"`);
  assert.ok(!/\(fine\)[^\n]*To fix:/.test(all), "a part that is fine is not followed by 'To fix'");
  assert.ok(!/Still to do:/.test(all), "no doubled label");
  assert.deepEqual(factSheet(emptyPlan(), { today: TODAY }), { lines: [], names: [], related: [], ready: false });
});

test("the fact sheet sends no person's or account's name and no id", () => {
  const p = familyPlan(TODAY);
  const s = sheet(p), all = s.lines.join("\n");
  for (const x of p.household.people) assert.ok(!word(x.name).test(all), `"${x.name}" is not sent`);
  for (const a of accountAliases(p)) if (!a.alias.toLowerCase().includes(a.name.toLowerCase())) assert.ok(!word(a.name).test(all), `"${a.name}" is not sent`);
  const ids = [...p.household.people, ...p.accounts, ...p.income, ...p.expenses, ...p.goals, ...p.debts, ...p.retirement.contributions].map((x) => x.id);
  assert.ok(ids.length > 30);
  for (const id of ids) assert.ok(!all.includes(id), `id ${id} is not sent`);
  // an account name with brackets that the health score really writes: the check above has to be able to see it
  p.accounts.push({ id: "a-old", name: "Ana's card (old)", type: "credit", balance: 900, asOf: TODAY, ownerId: "" });
  p.debts.push({ id: "d-old", accountId: "a-old", rate: 0.25, minPayment: 40, extra: 0 });
  assert.ok(word("Ana's card (old)").test(computeHealth(p, { today: TODAY }).parts.map((x) => x.detail).join("\n")), "the raw score names it");
  assert.ok(!word("Ana's card (old)").test(text(p)), "the fact sheet does not");
});

test("only goal names reach the fact sheet as typed: every other name, label, note or title in the plan stays home", () => {
  const p = familyPlan(TODAY);
  const marks = [];
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" && /^(name|label|title|notes|where|institution|securedBy|payee|description|memo)$/.test(k) && o !== p.meta) { const m = `Zq${marks.length}x`; marks.push({ m, goal: p.goals.includes(o) }); o[k] = m; }
      else walk(v);
    }
  };
  walk(p);
  const all = text(p);
  assert.ok(marks.length > 40);
  for (const x of marks) assert.equal(all.includes(x.m), x.goal, `${x.m} ${x.goal ? "is a goal name" : "is not sent"}`);
});

test("the copy changes names only: the health score and each part's points are the same", () => {
  const p = familyPlan(TODAY);
  const a = computeHealth(p, { today: TODAY }), b = computeHealth(anonymise(p, { today: TODAY }).plan, { today: TODAY });
  assert.equal(b.score, a.score);
  assert.deepEqual(b.parts.map((x) => x.points), a.parts.map((x) => x.points));
  assert.equal(p.household.people[0].name, "Ana", "the real plan is not touched");
});

test("names that are everyday words or single letters do not rewrite the app's own sentences", () => {
  const will = familyPlan(TODAY); person(will, "p-bo").name = "Will";
  assert.ok(text(will).includes("Missing for each adult: Will, Financial power of attorney"));
  const a = familyPlan(TODAY); person(a, "p-ana").name = "A";
  assert.ok(text(a).includes("Next step (do now): A starter emergency fund."));
  const cy = familyPlan(TODAY); cy.accounts.push({ id: "a-529", name: "Cy", type: "529", balance: 2000, asOf: TODAY, ownerId: "" });
  assert.ok(text(cy).includes("No guardian is named for Child 1.")); assert.ok(text(cy).includes("Child 1's college"));
  const ret = familyPlan(TODAY); ret.accounts.find((x) => x.id === "a-401").name = "Retirement";
  assert.match(text(ret), /^Retirement on track \(/m);
  const cash = familyPlan(TODAY); cash.accounts.find((x) => x.id === "a-chk").name = "Cash";
  assert.match(text(cash), /^Cash cushion \(/m);
  const debt = familyPlan(TODAY); debt.accounts.find((x) => x.id === "a-chk").name = "Debt";
  assert.match(text(debt), /^Debt \(fine\): /m);
});

test("full names, lower-case names and accounts named in goals are hidden there; the names come back in the answer", () => {
  const p = familyPlan(TODAY);
  Object.assign(person(p, "p-ana"), { name: "Ana Lopez" }); Object.assign(person(p, "p-bo"), { name: "Bo Lopez" }); Object.assign(person(p, "p-cy"), { name: "Cyrus Lopez" });
  p.goals.find((g) => g.id === "g-car").name = "replace bo's car";
  p.goals.find((g) => g.id === "g-col").name = "CYRUS'S COLLEGE";
  p.accounts.find((x) => x.id === "a-visa").name = "Chase Sapphire Preferred";
  p.goals.find((g) => g.id === "g-trip").name = "Pay off Chase Sapphire Preferred";
  const s = sheet(p), all = s.lines.join("\n");
  for (const n of ["Ana", "Bo", "Cyrus", "Lopez", "Chase", "Sapphire"]) assert.ok(!word(n).test(all), `"${n}" is not sent`);
  assert.ok(all.includes("replace Adult 2's car, Child 1'S COLLEGE, Pay off the credit card need more each month"));
  assert.deepEqual(readAnswer('[{"title":"Help adult 2 replace the car","why":"The credit card costs the most."}]', [], s.names),
    [{ title: "Help Bo Lopez replace the car", why: "The credit card (Chase Sapphire Preferred) costs the most.", page: null, level: "medium" }]);
});

test("people with the same name, no name, or an empty entry", () => {
  const twin = familyPlan(TODAY); person(twin, "p-cy").name = "Bo";
  const t = sheet(twin);
  assert.equal(t.lines[0].split(";")[0], "Household: Adult 1 (age 36), Adult 2 (age 37), Child 1 (age 6)");
  assert.ok(t.lines.join("\n").includes("No guardian is named for Child 1."));
  assert.ok(t.lines.join("\n").includes(`Replace ${SOMEONE}'s car`));
  assert.equal(restore("Adult 2 and Child 1", t.names), "Bo and Bo");
  const none = familyPlan(TODAY); person(none, "p-cy").name = "";
  assert.ok(text(none).includes("No guardian is named for Child 1. If both parents died, a court would choose who raises Child 1."));
  const gran = familyPlan(TODAY); gran.household.people.push({ id: "p-gran", name: "Gran", role: "dependent", birthDate: "1948-01-15" });
  assert.match(sheet(gran).lines[0], /Child 1 \(age 6\), Dependent 1 \(age 78\);/);
  const hole = familyPlan(TODAY); hole.household.people.splice(1, 0, null);
  assert.match(sheet(hole).lines[0], /^Household: Adult 1 \(age 36\), Adult 2 \(age 37\), Child 1/);
  assert.deepEqual(compute(hole), { ready: true, people: 3, adults: 2 });
});

test("several cards: each gets its own stand-in, and its own name back", () => {
  const p = familyPlan(TODAY);
  p.accounts.find((x) => x.id === "a-visa").name = "Chase Sapphire Preferred";
  p.accounts.push({ id: "a-amex", name: "Amex", type: "credit", balance: 3000, asOf: TODAY, ownerId: "" }, { id: "a-gold", name: "Amex Gold", type: "credit", balance: 2000, asOf: TODAY, ownerId: "" });
  p.debts.push({ id: "d-amex", accountId: "a-amex", rate: 0.29, minPayment: 90, extra: 0 }, { id: "d-gold", accountId: "a-gold", rate: 0.27, minPayment: 60, extra: 0 });
  const s = sheet(p), all = s.lines.join("\n");
  assert.ok(all.includes("(credit card 2, credit card 3, credit card 1)"), "three different stand-ins (most expensive first, as the score lists them)");
  for (const n of ["Chase", "Amex"]) assert.ok(!word(n).test(all));
  const r = readAnswer('[{"title":"Pay off credit card 2, then Credit card 3","page":"debt/payoff","level":"high"}]', [{ key: "debt/payoff" }], s.names);
  assert.equal(r[0].title, "Pay off credit card 2 (Amex), then Credit card 3 (Amex Gold)");
});

test("the legal papers: done count, then what is missing for whom", () => {
  const p = familyPlan(TODAY);
  p.estate = { documents: [{ id: "x1", kind: "will", personId: "p-ana", status: "done", updatedAt: "2025-01-01" }] };
  assert.ok(text(p).includes("Will and other legal papers: 1 of 11 done. Missing for each adult: Financial power of attorney, Health care power of attorney, Living will and Medical records release (HIPAA). Missing for Adult 2: Will. Missing for the household: Guardian for the children."));
  const one = { done: 0, required: 2, items: [{ kind: "will", label: "Will", personId: "p1", personName: "Adult 1" }, { kind: "hipaa", label: "HIPAA release", personId: "p1", personName: "Adult 1" }, { kind: "trust", label: "Living trust", optional: true }] };
  assert.equal(papersLine(one, 1), "Will and other legal papers: 0 of 2 done. Missing: Will and Medical records release (HIPAA).");
});

test("health-score lines: 'Could still improve' when the part is fine, no doubled label, plain words", () => {
  assert.equal(partLine({ title: "Debt", status: "ok", detail: "No debt.  ", fix: "Paying off the loan earns these points back fastest." }), "Debt (fine): No debt. Could still improve: Paying off the loan first helps most.");
  assert.equal(partLine({ title: "Knows", status: "warn", detail: "6 of 7 things the score leans on are filled in.", fix: "Still to do: assumptions looked over in the last year." }),
    "Knows (needs attention): 6 of 7 things the score needs are filled in. To fix: the app's guesses for inflation and investment growth looked over in the last year.");
  assert.equal(partLine({ title: "Goals", status: "unknown", detail: "No goals yet.", fix: null }), "Goals (not known yet): No goals yet.");
  assert.equal(plainWords("Payments take 20% of gross income. Bring debt payments under 36% of gross income."), "Debt payments take 20% of pay before tax. Bring debt payments under 36% of pay before tax.");
  assert.equal(plainWords("The plan can carry about $9,320 a month against the $7,000 it plans (133%)."), "In retirement your savings could pay about $9,320 a month; the plan needs $7,000 (133%).");
  assert.equal(plainWords("Life and disability insurance are what close these gaps; the stress tests show how much each shock is short."), "Life and disability insurance close these gaps; the Stress tests page shows how short each one is.");
  assert.equal(plainWords("Car needs more each month (Goals)."), "Car needs more each month (see the Goals page).");
});

test("the pages the AI may name: built ones the facts point to, never this page", () => {
  const pages = [{ key: "ai/critic", status: "usable" }, { key: "a/b", status: "usable" }, { key: "c/d", status: "stub" }, { key: "e/f", status: "planned" }, { key: "g/h", status: "usable" }, null];
  assert.deepEqual(allowedPages(pages).map((x) => x.key), ["a/b", "c/d", "g/h"]);
  assert.deepEqual(allowedPages(pages, ["c/d", "e/f", "g/h", "ai/critic"]).map((x) => x.key), ["c/d", "g/h"]);
  const s = sheet(familyPlan(TODAY));
  for (const k of [...ALWAYS_PAGES, "balance/liquidity", "debt/payoff", "goals/goals", "scenarios/stress-tests", "retirement/contributions"]) assert.ok(s.related.includes(k), `points to ${k}`);
  assert.ok(s.related.length < 20, "a short list, not every page");
});

test("the question holds the facts and the page list, and asks for JSON points tied to a page", () => {
  const q = buildPrompt(["Household: Adult 1 (age 40).", "Cash cushion (a problem): 0.9 months."], [{ key: "balance/liquidity", title: "Liquidity", purpose: "How long your cash lasts." }]);
  assert.match(q.system, /JSON only/); assert.match(q.system, new RegExp(`at most ${MAX_POINTS}`)); assert.match(q.system, /never invent numbers/); assert.match(q.system, /Adult 1, Adult 2, Child 1/);
  assert.match(q.user, /- Household: Adult 1 \(age 40\)\./); assert.match(q.user, /balance\/liquidity: Liquidity, How long your cash lasts\./);
});

test("finding the list in the reply: prose with brackets, wrappers, <think>, fences, nesting, brackets inside quotes", () => {
  const one = '[{"title":"A","page":"estate/documents","level":"high"}]';
  for (const reply of [`Here are the [main] points:\n${one}`, `${one}\nSee the [Documents] page.`, `{"points":${one},"notes":["x"]}`, "```json\n" + one + "\n```",
    `<think>the user wants [json] like [{"title":"wrong"}]</think>\n${one}`, `thinking about [it]...</think>${one}`, `[${one}]`, `Note [x:\n${one}`])
    assert.deepEqual(findList(reply), [{ title: "A", page: "estate/documents", level: "high" }], reply);
  assert.deepEqual(findList('Look: [{"title":"Pay ] off [ the card"}]'), [{ title: "Pay ] off [ the card" }]);
  assert.deepEqual(findList('{"title":"Only one","level":"low"}'), [{ title: "Only one", level: "low" }]);
  assert.deepEqual(findList("[]"), []);
  for (const reply of ["I could not find any problems.", "[{broken", "", null]) assert.equal(findList(reply), null, String(reply));
});

test("the answer read back: titles kept in order, unknown pages dropped, levels checked, names put back, at most 8", () => {
  const pages = [{ key: "balance/liquidity" }, { key: "estate/documents" }];
  const names = [{ name: "Cy", alias: "Child 1", kind: "person" }];
  const reply = `Sure! [{"title":"Name a guardian for Child 1","why":"No  guardian is named.","page":"#/estate/documents","level":"High"},
    {"title":"Build the cash cushion","why":"0.9 months of bills.","page":" balance/liquidity ","level":"urgent"},
    {"title":"Buy Acme insurance","page":"made/up","level":"low"},
    {"title":"name a guardian for child 1","page":"estate/documents"},
    {"why":"no title"}, {"title":{"text":"an object"}}, {"title":"Odd","why":["one","two"],"level":"toString"}, {"title":"Odder","level":"constructor"}, 42, null]`;
  assert.deepEqual(readAnswer(reply, pages, names), [
    { title: "Name a guardian for Cy", why: "No guardian is named.", page: "estate/documents", level: "high" },
    { title: "Build the cash cushion", why: "0.9 months of bills.", page: "balance/liquidity", level: "medium" },
    { title: "Buy Acme insurance", why: "", page: null, level: "low" },
    { title: "Odd", why: "one two", page: null, level: "medium" },
    { title: "Odder", why: "", page: null, level: "medium" },
  ], "the repeat (any case, before names come back), the untitled and the object title are dropped");
  assert.deepEqual(readAnswer('["Build the cash cushion","Name a guardian for Child 1"]', pages, names).map((x) => x.title), ["Build the cash cushion", "Name a guardian for Cy"], "a list of plain sentences");
  const many = JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ title: `Point ${i}`, page: "balance/liquidity", level: "low" })));
  assert.equal(readAnswer(many, pages).length, MAX_POINTS);
  assert.deepEqual(readAnswer("[]", pages), [], "an empty list: nothing to flag");
  for (const reply of ["I could not find any problems.", "[{broken", '[{"why":"no title"}]', "[1, 2]"]) assert.equal(readAnswer(reply, pages), null, `${reply}: nothing readable`);
  assert.deepEqual(Object.keys(LEVELS), ["high", "medium", "low"]);
  assert.deepEqual(Object.values(LEVELS), ["Do now", "Do soon", "When you can"]);
});

test("long text is cut on whole characters, with an ellipsis", () => {
  const emoji = "x".repeat(MAX_TITLE - 1) + "😀";
  assert.equal(readAnswer(JSON.stringify([{ title: emoji }]), [])[0].title, emoji, "200 characters fit, the emoji is whole");
  const long = readAnswer(JSON.stringify([{ title: "y".repeat(250) + "😀", why: "z".repeat(700) }]), [])[0];
  assert.equal(Array.from(long.title).length, MAX_TITLE); assert.ok(long.title.endsWith("…"));
  assert.equal(Array.from(long.why).length, 600);
  assert.equal(cut("a 😀😀😀", 4), "a 😀…"); assert.equal(cut("short", 10), "short");
});

test("ready once an adult is in the household", () => {
  assert.deepEqual(compute(emptyPlan()), { ready: false, people: 0, adults: 0 });
  assert.deepEqual(compute(familyPlan(TODAY)), { ready: true, people: 3, adults: 2 });
});
