// Tests for cashflow/shared-costs (gap design #22): the formulas, one test per sentence case, the page simple first, and
// the invariance check (the new optional field changes no other page's result).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, answerFor, alarmFor, namesOf, ownShares, dollars, costsOf, coupleOf, settingsOf, METHODS, METHOD_LABELS } from "./compute.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { takeHome } from "../paycheck/compute.js";
import { compute as computeIncome } from "../income/compute.js";
import { splitOf, partsOf as billParts, readBill, fewestPayments, canon, namesFrom, nameFor, statusWords, afterWords, billSub, historyLine, savedWords, undoneWords,
  confirmWords, fixWords, dayWords, cashOf, orderPayments, INTRO, EXACT_MAX, SPLIT_LABELS, storeKey, realDay, AMOUNT_MAX, SOLO } from "./split.js";

const TY = "2026-11-13";
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const run = (p, today = TY) => compute(migrate(structuredClone(p)), { today });
const say = (p, today = TY) => { const q = migrate(structuredClone(p)); const d = compute(q, { today }); return { d, ...answerFor(d, namesOf(q), usd), alarm: alarmFor(d, namesOf(q), usd) }; };

/** Ana and Bo with income typed as it reaches them (no paycheck to work take-home from): `ana` and `bo` a month, and
 * costs that come to $3,900 a month (the design's example: 60% and 40%, $2,340 and $1,560). */
function couple({ ana = 6000, bo = 4000, costs = true, names = ["Ana", "Bo"] } = {}) {
  const p = emptyPlan();
  p.household = { people: [{ id: "a", name: names[0], role: "self", birthDate: "1985-01-01" }, { id: "b", name: names[1], role: "partner", birthDate: "1986-01-01" }], filingStatus: "married_joint", state: "TX" };
  p.income = [];
  if (ana) p.income.push({ id: "i-a", name: "Ana's work", type: "other", personId: "a", amount: ana, period: "monthly", taxable: false });
  if (bo) p.income.push({ id: "i-b", name: "Bo's work", type: "other", personId: "b", amount: bo, period: "monthly", taxable: false });
  p.expenses = costs ? [
    { id: "rent", name: "Rent", category: "housing", amount: 2400, period: "monthly", essential: true },
    { id: "food", name: "Groceries", category: "groceries", amount: 225, period: "weekly", essential: true },   // 225 x 52 / 12 = 975
    { id: "net", name: "Phone and internet", category: "phone", amount: 525, period: "monthly", essential: true },
  ] : [];
  return p;
}

// ---- the formulas ----
test("gap #22: by income, each share is that person's part of both incomes; the parts are the share times the shared costs", () => {
  const d = run(couple());
  assert.equal(d.case, "income"); assert.equal(d.basis, "income");
  near(d.shared, 2400 + 225 * 52 / 12 + 525);   // 3,900
  near(d.people[0].share, 0.6); near(d.people[1].share, 0.4);
  near(d.people[0].part, 2340); near(d.people[1].part, 1560);
  assert.deepEqual(d.people.map((p) => [p.percent, p.dollars]), [[60, 2340], [40, 1560]]);
  near(d.people[0].keeps, 6000 - 2340); near(d.people[1].keeps, 4000 - 1560);
});

test("gap #22: the shares add up to 1, the percents to 100 and the dollars to the shared costs, whichever way you split", () => {
  const cases = [couple(), couple({ ana: 3333.33, bo: 6666.67 }), couple({ ana: 1, bo: 2 }), familyPlan(TY)];
  for (const p0 of cases) for (const method of ["income", "equal", "own"]) {
    const p = structuredClone(p0);
    const [ia, ib] = coupleOf(p).a ? [coupleOf(p).a.id, coupleOf(p).b.id] : [];
    p.whatIfs = { ...(p.whatIfs ?? {}), shareCosts: { method, own: { [ia]: 0.37 } } };
    const d = run(p);
    near(d.people[0].share + d.people[1].share, 1, 1e-12);
    assert.equal(d.people[0].percent + d.people[1].percent, 100);
    assert.equal(d.people[0].dollars + d.people[1].dollars, Math.round(d.shared));
    near(d.people[0].part + d.people[1].part, d.shared, 1e-9);
    if (method === "equal") { near(d.people[0].share, 0.5); }
    if (method === "own") { near(d.people[0].share, 0.37); near(d.people[1].share, 0.63); }
  }
});

test("gap #22: take-home is the Paycheck page's (each salary times its earner's take-home share), other income as typed", () => {
  const p = migrate(familyPlan(TY));
  const d = compute(p, { today: TY });
  assert.equal(d.basis, "take-home");
  const th = takeHome(p, { today: TY });
  const inc = computeIncome(p, { today: TY });
  const mine = (id) => inc.active.filter((x) => x.personId === id && x.period !== "once").reduce((t, x) => t + x.monthly * (th.ratio[x.id] ?? 1), 0);
  near(d.people[0].income, mine("p-ana"), 1e-9); near(d.people[1].income, mine("p-bo"), 1e-9);
  assert.ok(d.people[0].income < d.people[0].gross && d.people[0].scaled);
  // Bo's photography counts as typed: his figure is his salary's take-home plus 600
  near(d.people[1].income - 5200 * th.ratio["i-bo"], 600, 1e-9);
  // the family: $5,826 of costs a month, Ana $3,198 (55%), Bo $2,628 (45%)
  near(d.shared, 1980 + 220 * 52 / 12 + 450 + 410 + 400 + 350 + 260 + 3000 / 12 + 200 + 180 + 540 / 3 + 165 + 48, 1e-9);
  assert.deepEqual(d.people.map((x) => [x.percent, x.dollars]), [[55, 3198], [45, 2628]]);
});

test("gap #22: income of the household's own counts half each; a child's and another adult's are left out of the split", () => {
  const p = couple();
  p.household.people.push({ id: "kid", name: "Cy", role: "dependent", birthDate: "2010-01-01" }, { id: "gran", name: "Di", role: "self", birthDate: "1950-01-01" });
  p.income.push({ id: "i-h", name: "Rent from the flat", type: "other", personId: "", amount: 1000, period: "monthly", taxable: false },
    { id: "i-k", name: "Cy's job", type: "other", personId: "kid", amount: 300, period: "monthly", taxable: false },
    { id: "i-g", name: "Di's pension", type: "pension", personId: "gran", amount: 2000, period: "monthly", taxable: false },
    { id: "i-once", name: "Gift", type: "other", personId: "a", amount: 5000, period: "once", taxable: false });
  const d = run(p);
  near(d.people[0].income, 6500); near(d.people[1].income, 4500);
  near(d.household, 1000); near(d.leftOut, 2300); assert.equal(d.others, 1);
  // the first "Me" is the couple's first; the other adult is not in it
  assert.deepEqual([coupleOf(p).a.id, coupleOf(p).b.id], ["a", "b"]);
});

test("gap #22: leaveOut is excluded from the shared costs; a Debts payment and a yearly bill are costs; taxes and one-time costs are not", () => {
  const p = couple();
  p.expenses.push({ id: "trip", name: "Trip", category: "travel", amount: 1200, period: "annual" },
    { id: "tax", name: "Estimated tax", category: "taxes", amount: 300, period: "monthly" },
    { id: "sofa", name: "Sofa", category: "shopping", amount: 900, period: "once" },
    { id: "gym", name: "Ana's gym", category: "fun", amount: 60, period: "monthly", endDate: "2026-01-31" });
  p.accounts = [{ id: "acc-card", name: "Card", type: "credit", balance: 2000, asOf: TY, ownerId: "" }];
  p.debts = [{ id: "d-card", accountId: "acc-card", rate: 0.2, minPayment: 80, extra: 0 }];
  const all = run(p);
  assert.deepEqual(all.costs.map((c) => c.id), ["rent", "food", "net", "trip", "debt:acc-card"]);
  near(all.shared, 3900 + 100 + 80); near(all.taxes, 300);
  p.whatIfs = { shareCosts: { leaveOut: ["trip", "debt:acc-card", "not-a-cost"] } };
  const d = run(p);
  near(d.shared, 3900); assert.equal(d.sharedCount, 3); assert.equal(d.count, 5);
  assert.deepEqual(d.costs.filter((c) => !c.shared).map((c) => c.id), ["trip", "debt:acc-card"]);
  near(d.people[0].part, 2340);
});

test("gap #22: your own split as typed (both scaled to 100%, one and the rest); nothing usable splits by income", () => {
  assert.deepEqual(ownShares({ a: 0.6, b: 0.6 }, "a", "b"), [0.5, 0.5]);
  assert.deepEqual(ownShares({ a: 0.7 }, "a", "b").map((x) => Math.round(x * 100)), [70, 30]);
  assert.deepEqual(ownShares({ b: 0.25 }, "a", "b"), [0.75, 0.25]);
  for (const junk of [null, {}, { a: 2 }, { a: -0.1 }, { a: "x" }, { a: true }, { a: 0, b: 0 }, []]) assert.equal(ownShares(junk, "a", "b"), null, JSON.stringify(junk));
  const p = couple(); p.whatIfs = { shareCosts: { method: "own", own: { a: "x" } } };
  const d = run(p);
  assert.equal(d.method, "income"); assert.equal(d.asked, "own"); assert.equal(d.case, "income");
  assert.deepEqual(settingsOf({ method: "thirds", leaveOut: ["x", 3, ""] }), { method: "income", own: {}, leaveOut: new Set(["x"]) });
  assert.deepEqual(METHODS, ["income", "equal", "own"]);
  assert.deepEqual(Object.values(METHOD_LABELS), ["By income", "Half each", "Our own split"]);
});

test("gap #22: whole dollars by the largest remainder add up to the total", () => {
  assert.deepEqual(dollars([1950.5, 1950.5], 3901), [1951, 1950]);
  assert.deepEqual(dollars([0.4, 0.4, 0.2], 1), [1, 0, 0]);
  assert.deepEqual(dollars([2340, 1560], 3900), [2340, 1560]);
  assert.deepEqual(dollars([0, 0], 0), [0, 0]);
});

// ---- one written sentence per case (R5) ----
test("gap #22, sentence: by income (take-home, and as typed)", () => {
  const t = say(couple());
  assert.equal(t.head, "Splitting by income: Ana puts in $2,340 a month, Bo $1,560.");
  assert.equal(t.say, "That is 60% and 40%, the same shares as your income.");
  assert.equal(t.alarm, null);
  const f = say(familyPlan(TY));
  assert.equal(f.head, "Splitting by income: Ana puts in $3,198 a month, Bo $2,628.");
  assert.equal(f.say, "That is 55% and 45%, the same shares as your take-home pay.");
  // the first adult Get started left unnamed is "you"; the partner it named "My spouse" is "your spouse"
  const y = say(couple({ names: ["Me", "My spouse"] }));
  assert.equal(y.head, "Splitting by income: you put in $2,340 a month, your spouse $1,560.");
});

test("gap #22, sentence: one earner (the design's words)", () => {
  const t = say(couple({ bo: 0 }));
  assert.equal(t.d.case, "one-earner");
  assert.equal(t.head, "Splitting by income: Ana covers all $3,900 a month.");
  assert.equal(t.say, "Bo has no pay on Income, so Ana covers it all. Or pick Half each.");
  const u = say(couple({ ana: 0, names: ["Me", "Bo"] }));
  assert.equal(u.head, "Splitting by income: Bo covers all $3,900 a month.");
  assert.equal(u.say, "You have no pay on Income, so Bo covers it all. Or pick Half each.");
  const shares = u.d.people.map((p) => p.share);
  assert.deepEqual(shares, [0, 1]);
});

test("gap #22, sentence: neither has pay; no costs; none checked; one adult", () => {
  const n = say(couple({ ana: 0, bo: 0 }));
  assert.equal(n.d.case, "no-income");
  assert.deepEqual([n.head, n.say], ["Neither of you has pay on Income yet", "Add what each of you earns on Income to split by it, or pick Half each."]);
  assert.equal(n.d.people[0].part, null);
  const c = say(couple({ costs: false }));
  assert.deepEqual([c.d.case, c.head, c.say], ["no-costs", "No costs to share yet", "List the bills you pay each month on Expenses, and this page splits them between you."]);
  const p = couple(); p.whatIfs = { shareCosts: { leaveOut: ["rent", "food", "net"] } };
  const z = say(p);
  assert.deepEqual([z.d.case, z.head, z.say], ["none-shared", "No costs are checked as shared", "Check the ones you share under \"Which costs are shared\" below."]);
  // a single adult, and the empty plan: the empty state (one sentence)
  const one = couple(); one.household.people = one.household.people.slice(0, 1);
  for (const p1 of [one, emptyPlan()]) {
    const s = say(p1);
    assert.deepEqual(s.d, { ready: false, why: "one-adult" });
    assert.deepEqual([s.head, s.say], ["Sharing costs as a couple", "This is for two people who share costs."]);
  }
  // a partner and a child is not a couple either way round: two adults are needed
  const kid = couple(); kid.household.people[1].role = "dependent";
  assert.equal(run(kid).ready, false);
});

test("gap #22, sentence: half each, with what it would be by income, or down the middle", () => {
  const p = couple(); p.whatIfs = { shareCosts: { method: "equal" } };
  const t = say(p);
  assert.equal(t.head, "Half each: Ana and Bo each put in $1,950 a month.");
  assert.equal(t.say, "Split by income, Ana would put in $2,340 and Bo $1,560.");
  const q = couple({ ana: 5000, bo: 5000 }); q.expenses[0].amount = 2401; q.whatIfs = { shareCosts: { method: "equal" } };
  const u = say(q);
  assert.equal(u.head, "Half each: Ana puts in $1,951 a month, Bo $1,950.");
  assert.equal(u.say, "That splits $3,901 of shared costs a month down the middle.");
});

test("gap #22, sentence: your own split", () => {
  const p = couple(); p.whatIfs = { shareCosts: { method: "own", own: { a: 0.65, b: 0.35 } } };
  const t = say(p);
  assert.equal(t.head, "Your own split: Ana puts in $2,535 a month, Bo $1,365.");
  assert.equal(t.say, "That is 65% and 35% of $3,900 of shared costs a month.");
});

test("gap #22, alarm: costs above both incomes; one part above that person's income; a part with no pay at all", () => {
  const over = say(couple({ ana: 2000, bo: 1000 }));
  assert.equal(over.alarm, "Your shared costs, $3,900 a month, are more than the $3,000 you both bring in. Spend less, or check the amounts on Expenses.");
  const p = couple({ ana: 6000, bo: 1500 }); p.whatIfs = { shareCosts: { method: "equal" } };
  assert.equal(say(p).alarm, "Bo's part, $1,950 a month, is more than Bo brings in ($1,500).");
  const q = couple({ bo: 0, names: ["Ana", "My spouse"] }); q.whatIfs = { shareCosts: { method: "equal" } };
  assert.equal(say(q).alarm, "Your spouse has no pay on Income, so your spouse's part, $1,950 a month, has to come from savings or from Ana.");
  const f = familyPlan(TY); f.whatIfs = { ...(f.whatIfs ?? {}), shareCosts: { method: "own", own: { "p-ana": 0.05 } } };
  assert.match(say(f).alarm, /^Bo's part, \$5,535 a month, is more than Bo takes home \(\$5,142\)\.$/);
  assert.equal(say(couple()).alarm, null);
});

test("gap #22, alarm: neither has pay, half each or your own split: all of it comes from savings (not \"from the other\")", () => {
  const words = "Neither of you has pay on Income, so all $3,900 a month of shared costs has to come from savings.";
  for (const s of [{ method: "equal" }, { method: "own", own: { a: 0.7 } }]) {
    for (const names of [["Ana", "Bo"], ["Me", "My spouse"]]) {
      const p = couple({ ana: 0, bo: 0, names }); p.whatIfs = { shareCosts: s };
      const t = say(p);
      assert.deepEqual(t.d.short, ["a", "b"]);
      assert.equal(t.alarm, words, `${s.method} ${names}`);
    }
  }
  // one of the two with pay: still that person's own words, and the other can help
  const q = couple({ ana: 0, bo: 4000 }); q.whatIfs = { shareCosts: { method: "equal" } };
  assert.equal(say(q).alarm, "Ana has no pay on Income, so Ana's part, $1,950 a month, has to come from savings or from Bo.");
});

test("gap #22: the README's sources say where to read them and quote the article's own words", async () => {
  const { readFileSync } = await import("node:fs");
  const md = readFileSync(new URL("./README.md", import.meta.url), "utf8");
  const src = md.slice(md.indexOf("**Sources**"), md.indexOf("## First view"));
  const items = src.split("\n  - ").slice(1);
  assert.equal(items.length, 2);
  for (const x of items) assert.match(x, /https:\/\/\S+, read 2026-11-13/);
  assert.match(items[0], /https:\/\/www\.nbc\.ca\/personal\/advice\/budget\/sharing-expenses-as-a-couple-what-approach-to-take\.html/);
  assert.match(items[0], /"First, you calculate what percentage of the total household income each partner earns\./);
  assert.match(items[1], /https:\/\/kb\.splitwise\.com\/balances-and-expenses\/what-are-different-ways-i-can-split-an-expense/);
});

// ---- invariance (gap spec 3.5) ----
test("gap #22, invariance: with whatIfs.shareCosts absent or empty, every result is the same, and no other page reads it", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { samplePlan } = await import("../../../qa/fixtures/sample-plan.mjs");
  const { ARCHETYPES, COMMON_PACKS, SPECIAL_PACKS } = await import("../../../qa/households/lib/catalog.mjs");
  const { compute: budgetPercent } = await import("../budget-percent/compute.js");
  const { compute: expenses } = await import("../expenses/compute.js");
  const plans = [familyPlan(TY), renterDebtPlan(), retiredCouplePlan(TY), samplePlan(), emptyPlan()];
  for (const a of ARCHETYPES) {
    plans.push(a.build());
    for (const vs of Object.values({ ...COMMON_PACKS, special: SPECIAL_PACKS[a.id] ?? [] })) for (const v of vs) { const q = structuredClone(a.build()); v.apply(q); plans.push(q); }
  }
  assert.ok(plans.length > 500, `${plans.length} plans`);
  let couples = 0;
  for (const [i, p0] of plans.entries()) {
    const p = migrate(structuredClone(p0)), q = structuredClone(p);
    q.whatIfs = { ...(q.whatIfs ?? {}), shareCosts: {} };
    const a = compute(p, { today: TY });
    assert.equal(JSON.stringify(compute(q, { today: TY })), JSON.stringify(a));
    if (a.ready) {
      couples++;
      assert.equal(a.people[0].dollars === null ? null : a.people[0].dollars + a.people[1].dollars, a.people[0].dollars === null ? null : Math.round(a.shared));
      answerFor(a, namesOf(p), usd); alarmFor(a, namesOf(p), usd);
    }
    // the pages it reads give the same with a choice saved here (every eighth plan: Budget (50/30/20) works the year's taxes)
    if (i % 8 === 0) {
      const r = structuredClone(p); r.whatIfs = { ...(r.whatIfs ?? {}), shareCosts: { method: "own", own: { x: 0.3 }, leaveOut: ["rent"] } };
      assert.equal(JSON.stringify(budgetPercent(r, { today: TY })), JSON.stringify(budgetPercent(p, { today: TY })));
      assert.equal(JSON.stringify(expenses(r, { today: TY })), JSON.stringify(expenses(p, { today: TY })));
    }
  }
  assert.ok(couples > 100, `${couples} couples`);
});

// ---- the page, simple first ----
const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
const pageOf = (plan, opts) => renderPage(new URL("./view.js", import.meta.url).href, plan, TY, opts);
const partsOf = (root) => root.querySelectorAll("details").filter((x) => x.dataset?.part);
const outside = (root) => { const shut = new Set(partsOf(root).filter((x) => !x.hasAttribute("open"))); const walk = (n) => (n.childNodes ?? []).map((c) => (shut.has(c) ? textOf(c.childNodes[0]) : c.data !== undefined ? c.data : walk(c))).join(" "); return walk(root).replace(/\s+/g, " "); };
const filled = (root) => [...root.querySelectorAll("button"), ...root.querySelectorAll("a")].filter((b) => (b.tagName === "BUTTON" || /\bbtn\b/.test(b.className)) && !/secondary|chip/.test(b.className) && !b.closest("details"));   // on the first view: outside the parts
const chips = (root) => root.querySelectorAll("button").filter((b) => /\bchip\b/.test(b.className));

test("gap #22, page: the answer, its sentence and three chips; costs, what each keeps and the working one tap away", async () => {
  const r = await pageOf(couple());
  const first = outside(r.root);
  assert.match(first, /Splitting by income: Ana puts in \$2,340 a month, Bo \$1,560\. That is 60% and 40%, the same shares as your income\./);
  assert.deepEqual(chips(r.root).map((b) => [textOf(b), b.getAttribute("aria-pressed")]), [["By income", "true"], ["Half each", "false"], ["Our own split", "false"]]);
  assert.deepEqual(partsOf(r.root).map((x) => [x.dataset.part, x.dataset.kind, textOf(x.querySelector(".fold-title")), textOf(x.querySelector(".fold-status")), x.hasAttribute("open")]),
    [["keeps", "more", "4 more numbers", "", false], ["costs", "own", "Which costs are shared", "all 3 shared", false], ["bills", "own", "Bills split with others", "", false], ["how", "how", "How this is worked out", "5 steps", false]]);
  assert.ok(!/Rent|Uncheck|takes home|brings in \$|National Bank/.test(first), "the costs, what each keeps and the working are inside their parts");
  assert.match(first, /More on this How much of your take-home goes to needs, wants and savings\?/);
  assert.equal(filled(r.root).length, 0, "no filled button on the first view: the chips are the action");
  assert.equal(r.root.querySelectorAll(".notice.warn").length, 0);
  // inside: what each keeps, and the working with the household's own numbers
  const keeps = textOf(partsOf(r.root).find((x) => x.dataset.part === "keeps"));
  assert.match(keeps, /Ana \$3,660 a month Ana brings in \$6,000 a month and puts \$2,340 into the shared costs: \$3,660 is left for Ana\./);
  // "Which costs are shared" holds no figure to type, only a tick per cost (docs/OPTIONAL.md R24: why it is not "Set my own
  // numbers", and why its title is pinned)
  const costBoxes = partsOf(r.root).find((x) => x.dataset.part === "costs").all().filter((e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName));
  assert.deepEqual([...new Set(costBoxes.map((e) => e.getAttribute("type")))], ["checkbox"]);
  assert.equal(costBoxes.length, 3, "one tick per cost");
  // the title's count is true: the part adds four figures to the first view, each one's income and what is left (their parts are
  // in the answer already); it said "2 more numbers", the people (integ2 check round 2)
  const figs = (t) => new Set(t.match(/\$[\d,]+/g) ?? []);
  const added = [...figs(textOf(partsOf(r.root).find((x) => x.dataset.part === "keeps").querySelector(".fold-body")))].filter((x) => !figs(first).has(x));
  assert.deepEqual(added.sort(), ["$2,440", "$3,660", "$4,000", "$6,000"]);
  const how = textOf(partsOf(r.root).find((x) => x.dataset.part === "how"));
  assert.match(how, /Shared costs: \$3,900 a month, the 3 costs checked/);
  assert.match(how, /\$6,000 ÷ \$10,000 = 60%, \$4,000 ÷ \$10,000 = 40%/);
  assert.match(how, /National Bank of Canada/);
});

test("gap #22, page: a chip saves the way to split and the green line names the new answer", async () => {
  const r = await pageOf(couple());
  chips(r.root).find((b) => textOf(b) === "Half each").click();
  assert.equal(r.saved.length, 1);
  assert.deepEqual(r.saved[0].whatIfs.shareCosts, { method: "equal" });
  const r2 = await pageOf(r.saved[0]);
  assert.deepEqual(r2.root.querySelectorAll(".notice.ok").map((n) => textOf(n)), ["Saved. Half each: Ana and Bo each put in $1,950 a month."]);
  assert.equal(chips(r2.root).find((b) => textOf(b) === "Half each").getAttribute("aria-pressed"), "true");
  // the next draw has no green line; tapping the chip that is on saves nothing
  const r3 = await pageOf(r.saved[0]);
  assert.equal(r3.root.querySelectorAll(".notice.ok").length, 0);
  chips(r3.root).find((b) => textOf(b) === "Half each").click();
  assert.equal(r3.saved.length, 0);
});

test("gap #22, page: Our own split starts from the split on screen and shows one box in place; a change saves both shares", async () => {
  const r = await pageOf(couple());
  chips(r.root).find((b) => textOf(b) === "Our own split").click();
  assert.deepEqual(r.saved[0].whatIfs.shareCosts, { method: "own", own: { a: 0.6, b: 0.4 } });
  const r2 = await pageOf(r.saved[0]);
  assert.deepEqual(r2.root.querySelectorAll(".notice.ok").map((n) => textOf(n)), ["Saved. Your own split: Ana puts in $2,340 a month, Bo $1,560."]);
  const input = r2.root.querySelector("input");
  assert.equal(input.getAttribute("name"), "ownShare"); assert.equal(input.value, "60");
  assert.match(outside(r2.root), /Ana's share of the shared costs .* Bo puts in the rest: 40%\./);
  assert.ok(!input.closest("details"), "the box is in place, not in a part");
  input.value = "65"; input.dispatch("change");
  assert.deepEqual(r2.saved[0].whatIfs.shareCosts, { method: "own", own: { a: 0.65, b: 0.35 } });
  const r3 = await pageOf(r2.saved[0]);
  assert.deepEqual(r3.root.querySelectorAll(".notice.ok").map((n) => textOf(n)), ["Saved. Your own split: Ana puts in $2,535 a month, Bo $1,365."]);
});

test("gap #22, page: uncheck a cost and Save: leaveOut is written, the part stays open with the green line, the next draw shuts it", async () => {
  const r = await pageOf(couple());
  const costs = partsOf(r.root).find((x) => x.dataset.part === "costs");
  const boxes = costs.querySelectorAll("input").filter((x) => x.getAttribute("type") === "checkbox");
  assert.deepEqual(boxes.map((b) => [b.getAttribute("value"), b.checked]), [["rent", true], ["food", true], ["net", true]]);
  assert.match(textOf(costs), /Rent \$2,400 a month Groceries \$975 a month Phone and internet \$525 a month/);
  boxes[2].checked = false;
  costs.querySelector("form").dispatch("submit");
  assert.deepEqual(r.saved[0].whatIfs.shareCosts, { leaveOut: ["net"] });
  const r2 = await pageOf(r.saved[0]);
  const c2 = partsOf(r2.root).find((x) => x.dataset.part === "costs");
  assert.equal(c2.hasAttribute("open"), true);
  assert.equal(partsOf(r2.root).find((x) => x.dataset.part === "how").hasAttribute("open"), false);
  assert.deepEqual(c2.querySelectorAll(".notice.ok").map((n) => textOf(n)), ["Saved. Splitting by income: Ana puts in $2,025 a month, Bo $1,350."]);
  assert.equal(textOf(c2.querySelector(".fold-status")), "2 of 3 shared");
  const r3 = await pageOf(r.saved[0]);
  assert.equal(partsOf(r3.root).find((x) => x.dataset.part === "costs").hasAttribute("open"), false);
  // checking it again removes the field's list
  const c3 = partsOf(r3.root).find((x) => x.dataset.part === "costs");
  c3.querySelectorAll("input").filter((x) => x.getAttribute("value") === "net")[0].checked = true;
  c3.querySelector("form").dispatch("submit");
  assert.deepEqual(r3.saved[0].whatIfs.shareCosts, {});
  // with nothing checked the part opens by itself and says what to do
  const p = couple(); p.whatIfs = { shareCosts: { leaveOut: ["rent", "food", "net"] } };
  const z = await pageOf(p);
  assert.equal(partsOf(z.root).find((x) => x.dataset.part === "costs").hasAttribute("open"), true);
  assert.ok(!partsOf(z.root).some((x) => x.dataset.part === "keeps"));
});

test("S11: after a save only the saved part changes: a chip or the share box opens no part; Save the shared costs keeps that part open and no other", async () => {
  const states = (root) => Object.fromEntries(partsOf(root).map((x) => [x.dataset.part, x.hasAttribute("open")]));
  await pageOf(couple());   // a green line an earlier test's tap left (the view keeps it for the next draw) is said here
  const r = await pageOf(couple());
  const before = states(r.root);
  assert.deepEqual(before, { keeps: false, costs: false, bills: false, how: false });
  // outside every part: a chip, then the share box that "Our own split" shows in place
  chips(r.root).find((b) => textOf(b) === "Our own split").click();
  const r2 = await pageOf(r.saved[0]);
  assert.deepEqual(states(r2.root), before, "a chip moves no part");
  assert.ok(!partsOf(r2.root).some((x) => x.querySelectorAll(".notice").length), "its green line is beside the chips, in no part");
  const input = r2.root.querySelector("input");
  input.value = "55"; input.dispatch("change");
  const r3 = await pageOf(r2.saved[0]);
  assert.deepEqual(states(r3.root), before, "the share box moves no part");
  // inside a part: Save the shared costs keeps "Which costs are shared" open with its green line; the others as they were
  const costs = partsOf(r3.root).find((x) => x.dataset.part === "costs");
  costs.querySelectorAll("input").filter((x) => x.getAttribute("value") === "net")[0].checked = false;
  costs.querySelector("form").dispatch("submit");
  const r4 = await pageOf(r3.saved[0]);
  assert.deepEqual(states(r4.root), { ...before, costs: true });
  assert.equal(partsOf(r4.root).find((x) => x.dataset.part === "costs").querySelectorAll(".notice.ok").length, 1);
  // said once: the next draw is quiet again
  assert.deepEqual(states((await pageOf(r3.saved[0])).root), before);
});

test("gap #22, page: one adult, no costs and no pay say what to do first", async () => {
  const one = couple(); one.household.people = one.household.people.slice(0, 1);
  const s = await pageOf(one);
  // the page is about bills split with others (a single person with roommates splits bills): its hero, one filled "Add a
  // bill", adding a partner a quiet link, then the one quiet row (w1 fix P1: it used to say the page was not for them)
  assert.equal(outside(s.root).trim(), "Split a bill with friends or roommates Add each bill you share, and this works out who owes whom. Add a bill Sharing costs with a partner? Add them on People Bills split with others ›");
  assert.deepEqual(partsOf(s.root).map((x) => [x.dataset.part, x.hasAttribute("open")]), [["bills", false]]);
  assert.deepEqual(filled(s.root).map((b) => textOf(b)), ["Add a bill"]);
  assert.equal(s.root.querySelectorAll("a").find((a) => textOf(a) === "Add them on People")?.getAttribute("href"), "#/household/people");
  const c = await pageOf(couple({ costs: false }));
  assert.deepEqual(filled(c.root).map((a) => [textOf(a), a.getAttribute("href")]), [["Open Expenses", "#/cashflow/expenses"]]);
  assert.deepEqual(partsOf(c.root).map((x) => x.dataset.part), ["bills"]);
  const n = await pageOf(couple({ ana: 0, bo: 0 }));
  assert.deepEqual(filled(n.root).map((a) => [textOf(a), a.getAttribute("href")]), [["Open Income", "#/cashflow/income"]]);
  assert.deepEqual(partsOf(n.root).map((x) => x.dataset.part), ["costs", "bills", "how"]);
});

test("gap #22, page: an alarm is never folded", async () => {
  const p = couple({ ana: 6000, bo: 1500 }); p.whatIfs = { shareCosts: { method: "equal" } };
  const r = await pageOf(p);
  const warn = r.root.querySelectorAll(".notice.warn");
  assert.deepEqual(warn.map((n) => textOf(n)), ["Bo's part, $1,950 a month, is more than Bo brings in ($1,500)."]);
  assert.ok(!warn[0].closest("details"));
});

test("gap #22: Budget (50/30/20)'s More on this links here for a couple, each row a question, and not for one adult", async () => {
  const view = new URL("../budget-percent/view.js", import.meta.url).href;
  const fam = await renderPage(view, familyPlan(TY), TY, { computeOf: { "cashflow/shared-costs": compute } });
  const card = fam.root.querySelectorAll("section").find((x) => x.dataset?.links !== undefined);
  assert.ok(card, "a More on this card");
  const rows = card.querySelectorAll("a").map((a) => [a.getAttribute("href"), textOf(a)]);
  assert.deepEqual(rows.map((x) => x[0]), ["#/cashflow/expenses", "#/cashflow/paycheck", "#/cashflow/budget", "#/cashflow/shared-costs"]);
  assert.equal(rows[3][1], "How should you two split the costs you share? Ana $3,198, Bo $2,628 a month ›");
  const one = couple(); one.household.people = one.household.people.slice(0, 1);
  const s = await renderPage(view, one, TY);
  assert.ok(!s.root.querySelectorAll("a").some((a) => a.getAttribute("href") === "#/cashflow/shared-costs"));
});

// ==== bills split with others (gap list next 60, item 17): split.js and the part "Bills split with others" ====
const TS = "2026-11-16";
/** A plan with the bills given; `base` a plan (the empty plan: "you" is the first adult, unnamed). */
const withBills = (bills, base = emptyPlan()) => { const p = migrate(structuredClone(base)); p.splitBills = structuredClone(bills); return p; };
const bill = (id, amount, paidBy, among, extra = {}) => ({ id, what: id, on: "2026-11-14", amount, paidBy, split: "even", among: among.map((w) => (typeof w === "string" ? { who: w } : w)), ...extra });
const namer = (p, s) => (k) => nameFor(p, k, s.spelled);
const sumOf = (o) => Object.values(o).reduce((t, c) => t + c, 0);

test("split #17: evenly, each owes the bill over how many share it, and the odd cents go to whoever paid", () => {
  const p = withBills([]);
  const a = billParts(p, bill("dinner", 90, "me", ["me", "name:Sam", "name:Lee"]));
  assert.deepEqual(a.parts, { "name:sam": 3000, "name:lee": 3000, me: 3000 });
  // $100 three ways: $33.33 each for the others, $33.34 for whoever paid; the parts add up to the bill
  const b = billParts(p, bill("x", 100, "me", ["me", "name:Sam", "name:Lee"]));
  assert.deepEqual(b.parts, { "name:sam": 3333, "name:lee": 3333, me: 3334 }); assert.equal(sumOf(b.parts), 10000);
  // whoever paid need not be in it: $100 for Sam, Lee and Kim is $33.33 each, and the odd cent stays with the payer
  const c = billParts(p, bill("y", 100, "me", ["name:Sam", "name:Lee", "name:Kim"]));
  assert.deepEqual(c.parts, { "name:sam": 3333, "name:lee": 3333, "name:kim": 3333, me: 1 });
  const s = splitOf(withBills([bill("y", 100, "me", ["name:Sam", "name:Lee", "name:Kim"])]));
  assert.deepEqual(s.balances, { me: 9999, "name:sam": -3333, "name:lee": -3333, "name:kim": -3333 }); assert.equal(sumOf(s.balances), 0);
  // all of it for one other person
  assert.deepEqual(billParts(p, bill("z", 90, "me", ["name:Sam"])).parts, { "name:sam": 9000 });
  // the same name in any case or spacing is one person, and a name that is "you" is you
  assert.deepEqual(billParts(p, bill("w", 60, "name:sam", ["name:Sam", "name:  SAM ", "name:You"])).among.map((y) => [y.who, y.cents]), [["name:sam", 3000], ["me", 3000]]);
});

test("split #17: by shares, each owes the bill times their shares over all the shares; whoever paid has the rest", () => {
  const p = withBills([]);
  const sh = (who, share) => ({ who, share });
  assert.deepEqual(billParts(p, bill("a", 100, "me", [sh("me", 2), sh("name:Sam", 1), sh("name:Lee", 1)], { split: "shares" })).parts, { "name:sam": 2500, "name:lee": 2500, me: 5000 });
  assert.deepEqual(billParts(p, bill("b", 100, "me", [sh("me", 1), sh("name:Sam", 1), sh("name:Lee", 1)], { split: "shares" })).parts, { "name:sam": 3333, "name:lee": 3333, me: 3334 });
  // $10 paid by Sam, shares 1 and 2: Lee floor(1,000 x 2 / 3) = 666 cents, Sam the rest, 334
  assert.deepEqual(billParts(p, bill("c", 10, "name:Sam", [sh("name:Sam", 1), sh("name:Lee", 2)], { split: "shares" })).parts, { "name:lee": 666, "name:sam": 334 });
  // a share of 0 owes nothing; a blank share counts as 1
  assert.deepEqual(billParts(p, bill("d", 90, "me", [sh("me", 1), sh("name:Sam", 0), { who: "name:Lee" }], { split: "shares" })).parts, { "name:sam": 0, "name:lee": 4500, me: 4500 });
  // shares adding up to 0 cannot be worked
  assert.equal(billParts(p, bill("e", 90, "me", [sh("me", 0), sh("name:Sam", 0)], { split: "shares" })), null);
});

test("split #17: exact amounts are kept to the cent and must add up to the bill (a plain error says both figures)", () => {
  const p = withBills([]);
  const ok = readBill(p, { what: " Groceries ", amount: 90, on: TS, paidBy: "me", split: "exact", among: ["me", "name:Sam"], amounts: { me: 50, "name:Sam": 40 } });
  assert.deepEqual(ok.bill, { what: "Groceries", on: TS, amount: 90, paidBy: "me", split: "exact", among: [{ who: "me", amount: 50 }, { who: "name:Sam", amount: 40 }] });
  assert.deepEqual(billParts(p, ok.bill).parts, { "name:sam": 4000, me: 5000 });
  assert.deepEqual(readBill(p, { amount: 90, paidBy: "me", split: "exact", among: ["me", "name:Sam"], amounts: { me: 50, "name:Sam": 35 } }),
    { error: "exact", words: "These add up to $85.00, but the bill is $90.00. Change them so they add up to $90.00." });
  assert.deepEqual(readBill(p, { amount: 90, paidBy: "me", split: "exact", among: ["me", "name:Sam"], amounts: { me: 50, "name:Sam": 45.5 } }),
    { error: "exact", words: "These add up to $95.50, but the bill is $90.00. Change them so they add up to $90.00." });
  // a blank amount is $0; cents are kept: $33.33 + $33.33 + $33.34
  assert.ok(readBill(p, { amount: 100, paidBy: "me", split: "exact", among: ["me", "name:Sam", "name:Lee"], amounts: { me: 33.34, "name:Sam": 33.33, "name:Lee": 33.33 } }).bill);
  // a stored bill whose amounts are above it is left out and said (never from the form)
  const bad = splitOf(withBills([bill("bad", 90, "me", [{ who: "name:Sam", amount: 100 }], { split: "exact" }), bill("ok", 30, "me", ["me", "name:Sam"])]));
  assert.equal(bad.fix, 1); assert.deepEqual(bad.balances, { me: 1500, "name:sam": -1500 });
  assert.equal(fixWords(1), "One bill is left out: its parts add up to more than the bill, or nobody is in the split. Change or remove it.");
  assert.equal(fixWords(2), "2 bills are left out: their parts add up to more than the bill, or nobody is in the split. Change or remove them.");
});

test("split #17: the form's other plain errors", () => {
  const p = withBills([]);
  const r = (v) => readBill(p, { paidBy: "me", split: "even", ...v });
  assert.deepEqual(r({ amount: null, among: ["me", "name:Sam"] }), { error: "amount", words: "Type how much the bill was." });
  assert.deepEqual(r({ amount: 0, among: ["me", "name:Sam"] }), { error: "amount", words: "Type how much the bill was." });
  assert.deepEqual(r({ amount: 20, among: [] }), { error: "among", words: "Check or type who shares it." });
  assert.deepEqual(r({ amount: 20, among: ["me"] }), { error: "among", words: "Check or type at least one other person to split it with." });
  assert.deepEqual(r({ amount: 20, among: ["me", "name:Sam"], split: "exact", amounts: { me: 20 } }), { error: "among", words: "Give someone other than whoever paid a part of it." });
  assert.deepEqual(r({ amount: 20, among: ["me", "name:Sam"], split: "shares", shares: { me: 1, "name:Sam": -1 } }), { error: "shares", words: "A share is 0 or more." });
  assert.deepEqual(r({ amount: 20, among: ["me", "name:Sam"], split: "shares", shares: { me: 0, "name:Sam": 0 } }), { error: "shares", words: "Give at least one person a share." });
  // a typed name twice is one person; the title is cut at 80 characters; a blank day stays blank (the page gives today)
  const ok = r({ what: "x".repeat(90), amount: 20, among: ["me", "name:Sam", "name:sam"] });
  assert.deepEqual(ok.bill.among, [{ who: "me" }, { who: "name:Sam" }]); assert.equal(ok.bill.what.length, 80); assert.equal(ok.bill.on, "");
});

test("split #17: three people netted to the fewest payments", () => {
  // you paid $90 for dinner for you, Sam and Lee; Sam paid $30 for a cab for the three: four debts, two payments
  const p = withBills([bill("Dinner", 90, "me", ["me", "name:Sam", "name:Lee"]), bill("Cab", 30, "name:Sam", ["me", "name:sam", "name:Lee"])]);
  const s = splitOf(p);
  assert.deepEqual(s.balances, { me: 5000, "name:sam": -1000, "name:lee": -4000 });
  assert.deepEqual(orderPayments(s.payments), [{ from: "name:lee", to: "me", cents: 4000 }, { from: "name:sam", to: "me", cents: 1000 }]);
  assert.equal(afterWords(s, namer(p, s)), "Lee owes you $40, and Sam owes you $10.");
  // a chain: Sam owes you $10, you owe Lee $10: one payment, Sam to Lee
  const q = withBills([bill("Lunch", 20, "me", ["me", "name:Sam"]), bill("Movie", 20, "name:Lee", ["me", "name:Lee"])]);
  const t = splitOf(q);
  assert.deepEqual(t.payments, [{ from: "name:sam", to: "name:lee", cents: 1000 }]);
  assert.equal(afterWords(t, namer(q, t)), "Sam owes Lee $10.");
  assert.equal(statusWords(t, namer(q, t)), "Sam owes Lee $10");
});

test("split #17: the fewest payments are searched exactly (they beat largest-to-largest), and a big group still settles", () => {
  const settles = (bal, ps) => { const b = { ...bal }; for (const x of ps) { b[x.from] += x.cents; b[x.to] -= x.cents; assert.ok(x.cents > 0); } return Object.values(b).every((c) => c === 0); };
  const greedy = (bal) => { const b = Object.entries(bal).map(([k, c]) => ({ k, c })); let n = 0; for (;;) { const d = b.filter((x) => x.c < 0).sort((x, y) => x.c - y.c)[0], c = b.filter((x) => x.c > 0).sort((x, y) => y.c - x.c)[0]; if (!d || !c) return n; const m = Math.min(-d.c, c.c); d.c += m; c.c -= m; n++; } };
  // +6, +4, -3, -3, -4: largest-to-largest takes 4 payments; {+4, -4} and {+6, -3, -3} take 3
  const bal = { a: 600, b: 400, c: -300, d: -300, e: -400 };
  const ps = fewestPayments(bal);
  assert.equal(greedy(bal), 4); assert.equal(ps.length, 3); assert.ok(settles(bal, ps));
  assert.deepEqual(ps.find((x) => x.from === "e"), { from: "e", to: "b", cents: 400 });
  // random groups of 2 to 9: always settled, never more than largest-to-largest, never more than n - 1
  let seed = 7; const rnd = () => { seed = (seed * 75 + 74) % 65537; return seed / 65537; };   // a small fixed sequence (ZX81 rule)
  for (let i = 0; i < 300; i++) {
    const n = 2 + Math.floor(rnd() * 8), b = {};
    for (let j = 0; j < n - 1; j++) b[`p${j}`] = Math.round((rnd() - 0.5) * 20) * 100;
    b[`p${n - 1}`] = -Object.values(b).reduce((t, c) => t + c, 0);
    const got = fewestPayments(b), live = Object.values(b).filter((c) => c !== 0).length;
    assert.ok(settles(b, got)); assert.ok(got.length <= greedy(b)); assert.ok(got.length <= Math.max(0, live - 1));
  }
  // above EXACT_MAX people: largest to largest, still settled in at most n - 1
  const big = {}; for (let j = 0; j < EXACT_MAX + 1; j++) big[`q${j}`] = (j % 2 ? 1 : -1) * (100 + j);
  big.q0 += -Object.values(big).reduce((t, c) => t + c, 0);
  const bp = fewestPayments(big);
  assert.ok(settles(big, bp)); assert.ok(bp.length <= EXACT_MAX);
  assert.deepEqual(fewestPayments({}), []); assert.deepEqual(fewestPayments({ a: 0 }), []);
});

test("split #17: Mark as settled writes a payment; the bills stay as history once everyone is square", () => {
  const dinner = bill("Dinner", 90, "me", ["me", "name:Sam", "name:Lee"]);
  const p1 = withBills([dinner, { id: "pay1", kind: "paid", on: TS, from: "name:Sam", to: "me", amount: 30 }]);
  const s1 = splitOf(p1);
  assert.deepEqual(s1.payments, [{ from: "name:lee", to: "me", cents: 3000 }]);
  assert.deepEqual([s1.open.map((e) => e.id), s1.settled.map((e) => e.id)], [["Dinner", "pay1"], []]);
  const p2 = withBills([...p1.splitBills, { id: "pay2", kind: "paid", on: TS, from: "name:Lee", to: "me", amount: 30 }, bill("Taxi", 12, "name:Lee", ["me", "name:Lee"])]);
  const s2 = splitOf(p2);
  // square after the second payment: the dinner and both payments are history; the taxi is open
  assert.deepEqual([s2.settled.map((e) => e.id), s2.open.map((e) => e.id)], [["Dinner", "pay1", "pay2"], ["Taxi"]]);
  assert.deepEqual(s2.payments, [{ from: "me", to: "name:lee", cents: 600 }]);
  assert.equal(statusWords(s2, namer(p2, s2)), "You owe Lee $6");
  const s3 = splitOf(withBills(p1.splitBills.concat({ id: "pay2", kind: "paid", on: TS, from: "name:Lee", to: "me", amount: 30 })));
  assert.equal(statusWords(s3, namer(p1, s3)), "all square"); assert.equal(afterWords(s3, namer(p1, s3)), "Everyone is square.");
  // a payment to oneself or of nothing is left out
  assert.equal(splitOf(withBills([{ kind: "paid", from: "me", to: "me", amount: 5 }])).fix, 1);
});

test("split #17, words: the status, the lines, the green lines, Undo's words and the questions", () => {
  const p = withBills([bill("Pizza night", 42, "me", ["name:Sam"])]);
  const s = splitOf(p), n = namer(p, s);
  assert.equal(statusWords(splitOf(withBills([])), n), "");
  assert.equal(statusWords(s, n), "Sam owes you $42");
  assert.equal(statusWords(splitOf(withBills([bill("a", 42.5, "me", ["name:Alexandra-Maria"])])), (k) => nameFor(p, k, { "name:alexandra-maria": "Alexandra-Maria" })), "1 payment open");
  assert.equal(statusWords(splitOf(withBills([bill("a", 40, "me", ["name:Sam", "name:Lee"])])), n), "2 payments open");
  // a first adult with a name is named, as everywhere on this page; a partner too
  const fam = withBills([bill("Groceries", 60, "name:Sam", ["person:p-ana", "name:Sam", "name:bo"])], familyPlan(TY));
  const sf = splitOf(fam), nf = namer(fam, sf);
  assert.deepEqual(sf.balances, { "name:sam": 4000, me: -2000, "person:p-bo": -2000 });
  assert.equal(afterWords(sf, nf), "Ana owes Sam $20, and Bo owes Sam $20.");
  assert.equal(billSub(sf.entries[0], nf, { today: TS }), "Nov 14 · Sam paid · evenly between Ana, Sam and Bo");
  // the line under a bill, each way it splits, and the history line
  const sub = (b) => { const q = withBills([b]), t = splitOf(q); return billSub(t.entries[0], namer(q, t), { today: TS }); };
  assert.equal(sub(bill("x", 90, "me", ["me", "name:Sam", "name:Lee"])), "Nov 14 · you paid · evenly between you, Sam and Lee");
  assert.equal(sub(bill("x", 90, "me", ["name:Sam"])), "Nov 14 · you paid · all of it for Sam");
  assert.equal(sub(bill("x", 100, "me", [{ who: "me", share: 2 }, { who: "name:Sam", share: 1 }], { split: "shares" })), "Nov 14 · you paid · by shares: you 2, Sam 1");
  assert.equal(sub(bill("x", 90, "name:Sam", [{ who: "me", amount: 50.5 }, { who: "name:Sam", amount: 39.5 }], { split: "exact", on: "2025-12-30" })), "Dec 30, 2025 · Sam paid · exact amounts: you $50.50, Sam $39.50");
  assert.equal(historyLine(s.entries[0], n, { today: TS }), "Nov 14 · Pizza night · $42 · you paid");
  assert.equal(historyLine({ kind: "paid", on: TS, from: "name:sam", to: "me", cents: 4200 }, n, { today: TS }), "Nov 16 · Sam paid you $42");
  assert.equal(historyLine({ kind: "bill", on: "", what: "", payer: "me", cents: 900 }, n), "A bill · $9 · you paid");
  assert.equal(dayWords("2026-01-05", TS), "Jan 5"); assert.equal(dayWords("x", TS), "");
  // the green lines name who owes whom after the change; Undo's words; the questions
  const it = s.entries[0], none = splitOf(withBills([]));
  assert.equal(savedWords("add", it, s, n), "Added \"Pizza night\". Sam owes you $42.");
  assert.equal(savedWords("change", it, s, n), "Saved \"Pizza night\". Sam owes you $42.");
  assert.equal(savedWords("remove", it, none, n), "Removed \"Pizza night\". Everyone is square.");
  assert.equal(savedWords("add", { ...it, what: "" }, s, n), "Added the $42 bill. Sam owes you $42.");
  const pay = { from: "name:sam", to: "me", cents: 4200 };
  assert.equal(savedWords("settle", pay, none, n), "Settled: Sam paid you $42. Everyone is square.");
  assert.equal(savedWords("remove", { kind: "paid", ...pay }, s, n), "Removed \"Sam paid you $42\". Sam owes you $42.");
  const tq = withBills([bill("a", 40, "me", ["name:Sam", "name:Lee"]), bill("b", 10, "name:Kim", ["name:Kim", "name:Jo"])]), three = splitOf(tq);
  assert.equal(afterWords(three, namer(tq, three)), "3 payments settle it.");
  assert.equal(undoneWords("add", it, n), "Undone: \"Pizza night\" is off the list.");
  assert.equal(undoneWords("change", it, n), "Undone: \"Pizza night\" is back as it was.");
  assert.equal(undoneWords("remove", it, n), "Undone: \"Pizza night\" is back on the list.");
  assert.equal(undoneWords("settle", pay, n), "Undone: Sam owes you $42 again.");
  assert.equal(undoneWords("remove", { kind: "paid", ...pay }, n), "Undone: \"Sam paid you $42\" is back on the list.");
  assert.equal(undoneWords("settle", { from: "me", to: "name:sam", cents: 500 }, n), "Undone: you owe Sam $5 again.");
  assert.equal(confirmWords("remove", it, n), "Remove \"Pizza night\" ($42)? Who owes whom is worked out again without it.");
  assert.equal(confirmWords("remove", { ...it, what: "" }, n), "Remove the $42 bill? Who owes whom is worked out again without it.");
  assert.equal(confirmWords("remove", { kind: "paid", ...pay }, n), "Remove \"Sam paid you $42\"? Who owes whom is worked out again without it.");
  assert.equal(confirmWords("settle", pay, n), "Mark it settled: Sam paid you $42? The bills stay in your history.");
  assert.equal(confirmWords("settle", { from: "me", to: "name:sam", cents: 500 }, n), "Mark it settled: you paid Sam $5? The bills stay in your history.");
  assert.equal(INTRO, "For costs you share with roommates, friends or on a trip: add each bill, and this works out who owes whom.");
  assert.deepEqual(Object.values(SPLIT_LABELS), ["Evenly", "By shares", "Exact amounts"]);
  assert.deepEqual([cashOf(4200), cashOf(4250), cashOf(8500, true), cashOf(123456)], ["$42", "$42.50", "$85.00", "$1,234.56"]);
});

test("split #17: who is who: the first adult is you, a typed name that is someone in the plan is them, names from one box", () => {
  const fam = migrate(familyPlan(TY));
  assert.equal(canon(fam, "person:p-ana"), "me"); assert.equal(canon(fam, "name:ANA"), "me"); assert.equal(canon(fam, "name:you"), "me");
  assert.equal(canon(fam, "name: bo "), "person:p-bo"); assert.equal(canon(fam, "person:p-bo"), "person:p-bo");
  assert.equal(canon(fam, "name:Sam  Lee"), "name:sam lee"); assert.equal(canon(fam, "name:  "), null); assert.equal(canon(fam, 3), null); assert.equal(canon(fam, "x"), null);
  assert.deepEqual(namesFrom("Sam, Lee and Kim & Jo; sam,  "), ["Sam", "Lee", "Kim", "Jo"]);
  assert.deepEqual(namesFrom("Alexander"), ["Alexander"]);
  // the people the form offers: you, the plan's other adults, then each name used, in the order first used
  const s = splitOf(withBills([bill("a", 30, "name:Sam", ["person:p-ana", "name:Sam", "name:Lee"])], familyPlan(TY)));
  assert.deepEqual(s.people, ["me", "person:p-bo", "name:sam", "name:lee"]);
  assert.deepEqual(s.last, ["me", "name:sam", "name:lee"]);
  assert.deepEqual(splitOf(withBills([])).last, ["me"]);
  // someone no longer in the plan is still counted, and named so
  const gone = withBills([bill("a", 30, "person:zzz", ["me", "person:zzz"])]);
  const g = splitOf(gone);
  assert.equal(afterWords(g, namer(gone, g)), "You owe someone no longer in your plan $15.");
});

test("w1 fix M1: a bill is written by each person's id, so marking another adult \"Me\" (or reordering People) never moves it", () => {
  const fam = migrate(familyPlan(TY));
  // the form's keys: "me" (the first adult's tick), a typed name that is the partner's, and someone outside the plan
  const r = readBill(fam, { what: "Dinner", amount: 90, on: TS, paidBy: "me", split: "even", among: ["me", "name:Sam", "name:bo"] });
  assert.deepEqual([r.bill.paidBy, r.bill.among.map((y) => y.who)], ["person:p-ana", ["person:p-ana", "name:Sam", "person:p-bo"]]);
  fam.splitBills = [{ id: "d", ...r.bill }];
  const said = (p) => { const t = splitOf(p); return afterWords(t, namer(p, t)); };
  assert.equal(said(fam), "Sam owes Ana $30, and Bo owes Ana $30.");
  // Bo is marked "Me" and Ana partner: the same people owe the same person (it read "Sam owes Bo $45" before the fix);
  // the payment with you in it comes first, as always, and Bo is now you
  const swapped = structuredClone(fam);
  for (const x of swapped.household.people) x.role = x.id === "p-ana" ? "partner" : x.id === "p-bo" ? "self" : x.role;
  assert.equal(said(swapped), "Bo owes Ana $30, and Sam owes Ana $30.");
  const t = splitOf(swapped);
  assert.deepEqual(t.balances, { "person:p-ana": 6000, "name:sam": -3000, me: -3000 }, "Bo is now you, and owes Ana");
  // no one marked "Me" and the people in another order (Bo first, so Bo is you): the same
  const reordered = structuredClone(fam);
  for (const x of reordered.household.people) if (x.role !== "dependent") delete x.role;
  reordered.household.people.reverse();
  assert.equal(said(reordered), "Bo owes Ana $30, and Sam owes Ana $30.");
  // storeKey: the first adult by id; "me" only while the plan has no adult; a typed name as typed, or as the person it is
  assert.equal(storeKey(fam, "me"), "person:p-ana"); assert.equal(storeKey(fam, "name:ANA"), "person:p-ana"); assert.equal(storeKey(fam, "person:p-bo"), "person:p-bo");
  assert.equal(storeKey(fam, "name:Sam "), "name:Sam"); assert.equal(storeKey(fam, "x"), null);
  assert.equal(storeKey(withBills([]), "me"), "me");
  // a settle writes ids too, and an old list with "me" still reads as the first adult
  assert.equal(said(Object.assign(structuredClone(fam), { splitBills: [bill("old", 90, "me", ["me", "name:Sam", "person:p-bo"])] })), "Sam owes Ana $30, and Bo owes Ana $30.");
});

test("w1 fix M2-M4: a bill too small to split says so; amounts above the cap are refused; a day not on the calendar is not shown", () => {
  const p = withBills([]);
  // M2: half a cent rounds to 1 cent, and Sam's part to 0: the words say why, not "check at least one other person"
  assert.deepEqual(readBill(p, { amount: 0.005, paidBy: "me", split: "even", among: ["me", "name:Sam"] }), { error: "amount", words: "This bill is too small to split: each part would be less than a cent." });
  assert.deepEqual(readBill(p, { amount: 0.02, paidBy: "me", split: "shares", among: ["me", "name:Sam"], shares: { me: 100, "name:Sam": 1 } }), { error: "amount", words: "This bill is too small to split: each part would be less than a cent." });
  // nobody else in it, or nobody else with a share: as before
  assert.equal(readBill(p, { amount: 0.005, paidBy: "me", split: "even", among: ["me"] }).words, "Check or type at least one other person to split it with.");
  assert.equal(readBill(p, { amount: 1, paidBy: "me", split: "shares", among: ["me", "name:Sam"], shares: { me: 1, "name:Sam": 0 } }).words, "Give someone other than whoever paid a part of it.");
  assert.ok(readBill(p, { amount: 0.02, paidBy: "me", split: "even", among: ["me", "name:Sam"] }).bill, "2 cents between two is 1 cent each");
  // M3: up to $1,000,000,000 a bill (every sum of cents stays exact); above it the form says so, and a stored one is left out
  assert.equal(AMOUNT_MAX, 1e9);
  assert.ok(readBill(p, { amount: AMOUNT_MAX, paidBy: "me", split: "even", among: ["me", "name:Sam", "name:Lee"] }).bill);
  assert.deepEqual(readBill(p, { amount: 1e16, paidBy: "me", split: "even", among: ["me", "name:Sam"] }), { error: "amount", words: "Type an amount up to $1,000,000,000." });
  assert.equal(billParts(p, bill("big", 1e17, "me", ["me", "name:Sam", "name:Lee"])), null);
  const huge = splitOf(withBills([bill("big", 1e17, "me", ["me", "name:Sam"]), { id: "p", kind: "paid", from: "name:Sam", to: "me", amount: 1e12 }, bill("ok", 30, "me", ["me", "name:Sam"])]));
  assert.equal(huge.fix, 2); assert.deepEqual(huge.balances, { me: 1500, "name:sam": -1500 });
  // shares so large the parts would not be exact: left out, never a part that is not a whole cent
  assert.equal(billParts(p, bill("s", 100, "me", [{ who: "me", share: 1e308 }, { who: "name:Sam", share: 1e308 }], { split: "shares" })), null);
  for (const e of splitOf(withBills([bill("a", 1e9, "me", ["me", "name:Sam", "name:Lee"])])).entries) for (const c of Object.values(e.parts)) assert.ok(Number.isSafeInteger(c));
  // M4: only days of the calendar; a stored "2026-13-40" or "2024-02-30" shows no day (it said "undefined 40", "Feb 30")
  assert.deepEqual(["2026-13-40", "2024-02-30", "2026-00-10", "2023-02-29", "2024-02-29", "2026-12-31"].map((x) => dayWords(x, TS)), ["", "", "", "", "Feb 29, 2024", "Dec 31"]);
  assert.deepEqual(["2026-04-31", "2026-04-30", "2000-02-29", "1900-02-29"].map(realDay), [false, true, true, false]);
  const odd = splitOf(withBills([bill("x", 30, "me", ["me", "name:Sam"], { on: "2026-13-40" })]));
  assert.equal(odd.entries[0].on, ""); assert.equal(billSub(odd.entries[0], namer(p, odd), { today: TS }), "you paid · evenly between you and Sam");
  assert.equal(readBill(p, { amount: 30, on: "2026-02-30", paidBy: "me", split: "even", among: ["me", "name:Sam"] }).bill.on, "");
});

// ---- the part on the page (the real UI kit; a store that keeps its saves, so Undo can be tapped)
async function drawSplit(plan0, { answer = true } = {}) {
  const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const asked = [], saved = [];
  let cur = migrate(structuredClone(plan0));
  const store = { get: () => cur, update: (fn) => { const d = structuredClone(cur); fn(d); cur = d; saved.push(d); } };
  const draw = () => {
    const root = new FakeElement("main");
    render(root, { ui: { ...ui, confirm: (q) => { asked.push(q); return answer; } }, fmt: { ...fmt, today: () => TS }, plan: cur, route: { rest: [], query: {} }, module: { group: "cashflow", id: "shared-costs" }, computeOf: () => null, store });
    return root;
  };
  return { draw, saved, asked, plan: () => cur };
}
const billsEl = (root) => partsOf(root).find((x) => x.dataset.part === "bills");
const button = (el, words) => el.querySelectorAll("button").find((b) => textOf(b) === words);
const named = (el, n) => el.all().find((x) => x.getAttribute("name") === n);
const ticksOf = (el) => el.all().filter((x) => x.tagName === "INPUT" && x.getAttribute("type") === "checkbox" && x.getAttribute("name") === "among");
const youCouple = () => couple({ names: ["Me", "Bo"] });

test("split #17, page: one quiet row, shut; inside, what it is for and the add form, open while the list is empty", async () => {
  const a = await drawSplit(youCouple());
  const root = a.draw();
  const part = billsEl(root);
  assert.deepEqual([textOf(part.querySelector(".fold-title")), textOf(part.querySelector(".fold-status")), part.hasAttribute("open"), part.dataset.kind], ["Bills split with others", "", false, "own"]);
  assert.ok(!/roommates/.test(outside(root)), "what it is for is inside the row");
  const t = textOf(part);
  assert.match(t, /For costs you share with roommates, friends or on a trip: add each bill, and this works out who owes whom\./);
  const form = part.querySelector("form");
  assert.deepEqual(form.all().filter((x) => /^(INPUT|SELECT)$/.test(x.tagName)).map((x) => x.getAttribute("name")), ["what", "amount", "among", "among", "others", "paidBy", "on", "split"]);
  // who shares it: you (ticked, as on no bill yet) and Bo; who paid: you
  assert.deepEqual(ticksOf(form).map((x) => [x.getAttribute("value"), x.checked]), [["me", true], ["person:b", false]]);
  // a line says what the boxes are for (w1 fix P4); the example names are none of the invented households' (w1 fix P5)
  assert.match(t, /Who shares it Check who shares it, and type anyone else below\. You Bo Add people For example: Robin, Dana\. Names stay in your plan only\. Who paid You Bo More details \(optional\)/);
  assert.equal(named(form, "paidBy").value, "me");
  // the day and how it splits wait under "More details (optional)"
  assert.ok(named(form, "on").closest("details") && named(form, "split").closest("details"));
  assert.deepEqual(button(form, "Add the bill")?.getAttribute("type"), "submit");
  assert.equal(button(form, "Cancel"), undefined, "nothing to go back to while the list is empty");
});

test("split #17, page: Add saves the bill; the part stays open with the green line naming who owes whom, and Undo takes it off", async () => {
  const a = await drawSplit(youCouple());
  let root = a.draw();
  const form = billsEl(root).querySelector("form");
  named(form, "what").value = "Pizza night"; named(form, "amount").value = "90";
  named(form, "others").value = "Sam, Lee"; named(form, "others").dispatch("change");
  // a name typed can be the one who paid
  assert.deepEqual(named(form, "paidBy").querySelectorAll("option").map((o) => o.getAttribute("value")), ["me", "person:b", "name:Sam", "name:Lee"]);
  form.dispatch("submit");
  assert.equal(a.saved.length, 1);
  const [b] = a.plan().splitBills;
  // the first adult is written by id (w1 fix M1: marking another adult "Me" later never moves the bill)
  assert.deepEqual({ ...b, id: typeof b.id }, { id: "string", what: "Pizza night", on: TS, amount: 90, paidBy: "person:a", split: "even", among: [{ who: "person:a" }, { who: "name:Sam" }, { who: "name:Lee" }] });
  root = a.draw();
  const part = billsEl(root);
  assert.equal(part.hasAttribute("open"), true);
  assert.deepEqual(partsOf(root).filter((x) => x.hasAttribute("open")).map((x) => x.dataset.part), ["bills"], "no other part opens");
  const ok = part.querySelectorAll(".notice.ok");
  assert.equal(textOf(ok[0]), "Added \"Pizza night\". Sam owes you $30, and Lee owes you $30. Undo");
  assert.equal(textOf(part.querySelector(".fold-status")), "2 payments open");
  assert.match(textOf(part), /Who owes whom Sam owes you \$30 Mark as settled Lee owes you \$30 Mark as settled Bills Pizza night \$90 Nov 16 · you paid · evenly between you, Sam and Lee Change Remove \+ Add another bill/);
  // the form folded behind "+ Add another bill"; the names are offered as ticks next time, ticked as on the last bill
  assert.equal(part.querySelector("form"), null);
  button(part, "+ Add another bill").click();
  assert.deepEqual(ticksOf(part.querySelector("form")).map((x) => [x.getAttribute("value"), x.checked]), [["me", true], ["person:b", false], ["name:sam", true], ["name:lee", true]]);
  button(ok[0], "Undo").click();
  assert.equal(a.plan().splitBills, undefined, "Undo takes the bill off: the plan is as it was");
  root = a.draw();
  assert.equal(textOf(billsEl(root).querySelector(".notice.ok")), "Undone: \"Pizza night\" is off the list.");
});

test("split #17, page: exact amounts that do not add up are refused in plain words; by shares saves a box per person", async () => {
  const a = await drawSplit(youCouple());
  let form = billsEl(a.draw()).querySelector("form");
  named(form, "amount").value = "90"; named(form, "others").value = "Sam"; named(form, "others").dispatch("change");
  named(form, "split").value = "exact"; named(form, "split").dispatch("change");
  assert.deepEqual(form.all().filter((x) => /^exact-/.test(x.getAttribute("name") ?? "")).length, 2);
  assert.match(textOf(form), /Your part \$ Sam's part \$/);
  named(form, "exact-0").value = "50"; named(form, "exact-1").value = "35";
  form.dispatch("submit");
  assert.equal(a.saved.length, 0, "nothing saved");
  assert.equal(textOf(form.querySelector(".notice.error")), "These add up to $85.00, but the bill is $90.00. Change them so they add up to $90.00.");
  named(form, "exact-1").value = "40";
  form.dispatch("submit");
  assert.deepEqual(a.plan().splitBills[0].among, [{ who: "person:a", amount: 50 }, { who: "name:Sam", amount: 40 }]);
  // by shares: 1 each to start; you 2, Sam 1
  const b = await drawSplit(youCouple());
  form = billsEl(b.draw()).querySelector("form");
  named(form, "amount").value = "60"; ticksOf(form)[1].checked = true; ticksOf(form)[1].dispatch("change");
  named(form, "split").value = "shares"; named(form, "split").dispatch("change");
  assert.deepEqual(["share-0", "share-1"].map((k) => named(form, k).value), ["1", "1"]);
  assert.match(textOf(form), /Shares for you Shares for Bo/);
  named(form, "share-0").value = "2";
  form.dispatch("submit");
  assert.deepEqual(b.plan().splitBills[0].among, [{ who: "person:a", share: 2 }, { who: "person:b", share: 1 }]);
  const s = splitOf(b.plan());
  assert.deepEqual(s.payments, [{ from: "person:b", to: "me", cents: 2000 }]);
});

test("split #17, page: Remove asks first; No keeps it, Yes takes it off with Undo; Change saves in place", async () => {
  const p = withBills([bill("Pizza night", 90, "me", ["me", "name:Sam", "name:Lee"])], youCouple());
  const no = await drawSplit(p, { answer: false });
  button(billsEl(no.draw()), "Remove").click();
  assert.deepEqual(no.asked, ["Remove \"Pizza night\" ($90)? Who owes whom is worked out again without it."]);
  assert.equal(no.saved.length, 0);
  const a = await drawSplit(p);
  button(billsEl(a.draw()), "Remove").click();
  assert.deepEqual(a.plan().splitBills, []);
  let part = billsEl(a.draw());
  assert.equal(textOf(part.querySelector(".notice.ok")), "Removed \"Pizza night\". Everyone is square. Undo");
  button(part.querySelector(".notice.ok"), "Undo").click();
  assert.equal(a.plan().splitBills.length, 1);
  part = billsEl(a.draw());
  assert.equal(textOf(part.querySelector(".notice.ok")), "Undone: \"Pizza night\" is back on the list.");
  // Change: the bill's own form under its row, filled in; Save writes it in place
  button(part, "Change").click();
  const form = part.querySelector("form");
  assert.equal(named(form, "amount").value, "90"); assert.equal(named(form, "what").value, "Pizza night");
  assert.deepEqual(ticksOf(form).map((x) => [x.getAttribute("value"), x.checked]), [["me", true], ["person:b", false], ["name:sam", true], ["name:lee", true]]);
  named(form, "amount").value = "120";
  form.dispatch("submit");
  assert.deepEqual(a.plan().splitBills.map((x) => [x.id, x.amount, x.paidBy, x.among.map((y) => y.who)]), [["Pizza night", 120, "person:a", ["person:a", "name:Sam", "name:Lee"]]]);
  assert.equal(textOf(billsEl(a.draw()).querySelector(".notice.ok")), "Saved \"Pizza night\". Sam owes you $40, and Lee owes you $40. Undo");
});

test("split #17, page: Mark as settled asks, writes the payment and keeps the bills; Undo; once square the bills are history", async () => {
  const p = withBills([bill("Pizza night", 90, "me", ["me", "name:Sam", "name:Lee"])], youCouple());
  const a = await drawSplit(p);
  let part = billsEl(a.draw());
  part.querySelectorAll("button").filter((x) => textOf(x) === "Mark as settled")[0].click();
  assert.deepEqual(a.asked, ["Mark it settled: Sam paid you $30? The bills stay in your history."]);
  const pay = a.plan().splitBills[1];
  assert.deepEqual({ ...pay, id: typeof pay.id }, { id: "string", kind: "paid", on: TS, from: "name:Sam", to: "person:a", amount: 30 });
  part = billsEl(a.draw());
  assert.equal(textOf(part.querySelector(".notice.ok")), "Settled: Sam paid you $30. Lee owes you $30. Undo");
  // a payment listed with the bills: the heading says "Bills and payments" (w1 fix P2); with bills only it is "Bills"
  assert.match(textOf(part), /Who owes whom Lee owes you \$30 Mark as settled Bills and payments Sam paid you \$30 Nov 16 · marked settled Remove Pizza night \$90/);
  button(part.querySelector(".notice.ok"), "Undo").click();
  assert.equal(a.plan().splitBills.length, 1);
  assert.equal(textOf(billsEl(a.draw()).querySelector(".notice.ok")), "Undone: Sam owes you $30 again.");
  // both settled: everyone is square, and the bill and both payments are history
  for (let i = 0; i < 2; i++) { part = billsEl(a.draw()); part.querySelectorAll("button").find((x) => textOf(x) === "Mark as settled").click(); }
  part = billsEl(a.draw());
  assert.equal(textOf(part.querySelector(".fold-status")), "all square");
  assert.match(textOf(part), /Who owes whom Everyone is square\. \+ Add another bill Settled Nov 16 · Lee paid you \$30 Nov 16 · Sam paid you \$30 Nov 14 · Pizza night · \$90 · you paid$/);
  assert.equal(part.querySelectorAll("button").filter((x) => /^(Change|Remove)$/.test(textOf(x))).length, 0, "history is read only");
});

test("S11, bills: a save in Bills split with others keeps that part open and no other; one adult has the row too", async () => {
  const states = (root) => Object.fromEntries(partsOf(root).map((x) => [x.dataset.part, x.hasAttribute("open")]));
  const a = await drawSplit(youCouple());
  let root = a.draw();
  const before = states(root);
  assert.deepEqual(before, { keeps: false, costs: false, bills: false, how: false });
  const form = billsEl(root).querySelector("form");
  named(form, "amount").value = "20"; named(form, "others").value = "Sam"; named(form, "others").dispatch("change");
  form.dispatch("submit");
  root = a.draw();
  assert.deepEqual(states(root), { ...before, bills: true });
  assert.deepEqual(states(a.draw()), before, "said once: the next draw is quiet again");
  // one adult (the empty plan too): the sentence, then the row; an add works the same
  for (const p0 of [emptyPlan(), (() => { const q = youCouple(); q.household.people = q.household.people.slice(0, 1); return q; })()]) {
    const b = await drawSplit(p0);
    const f = billsEl(b.draw()).querySelector("form");
    named(f, "amount").value = "45"; named(f, "others").value = "Sam, Lee"; named(f, "others").dispatch("change");
    f.dispatch("submit");
    assert.equal(textOf(billsEl(b.draw()).querySelector(".notice.ok")), "Added the $45 bill. Sam owes you $15, and Lee owes you $15. Undo");
  }
});

test("w1 fix P1, page: one adult's filled \"Add a bill\" opens the row at its add form; the hero says what the row is for", async () => {
  const solo = () => { const q = youCouple(); q.household.people = q.household.people.slice(0, 1); return q; };
  for (const p0 of [emptyPlan(), solo()]) {
    const a = await drawSplit(p0);
    const root = a.draw();
    assert.deepEqual([textOf(root.querySelector("h1")), textOf(root.querySelector(".lede"))], [SOLO.head, SOLO.say]);
    const part = billsEl(root);
    assert.equal(part.hasAttribute("open"), false);
    // the hero says what it is for, so the row does not say it again
    assert.ok(!textOf(part).includes(INTRO));
    button(root, "Add a bill").click();
    assert.equal(part.hasAttribute("open"), true, "the tap opens the row");
    assert.ok(part.querySelector("form") && button(part, "Add the bill"), "its add form is there");
    assert.equal(a.saved.length, 0, "opening changes nothing in the plan");
  }
  // with bills, the tap opens the add form too (it waits behind "+ Add another bill" otherwise)
  const b = await drawSplit(withBills([bill("Pizza night", 90, "me", ["me", "name:Sam"])], solo()));
  const root = b.draw();
  const part = billsEl(root);
  assert.equal(part.querySelector("form"), null);
  button(root, "Add a bill").click();
  assert.equal(part.hasAttribute("open"), true);
  assert.ok(button(part, "Add the bill"), "the add form, open");
  assert.equal(button(part, "+ Add another bill"), undefined);
  assert.equal(part.querySelector("form").getAttribute("tabindex"), "-1", "the form after the list takes the focus (no keyboard)");
  button(root, "Add a bill").click();
  assert.equal(part.querySelectorAll("form").length, 1, "a second tap draws no second form");
  // a couple's page keeps its own hero and the row its words
  const c = await drawSplit(youCouple());
  const cr = c.draw();
  assert.equal(button(cr, "Add a bill"), undefined);
  assert.ok(textOf(billsEl(cr)).includes(INTRO));
});

test("split #17, invariance: the bills change no page's result, and no bills is the empty answer", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { samplePlan } = await import("../../../qa/fixtures/sample-plan.mjs");
  const { ARCHETYPES, COMMON_PACKS, SPECIAL_PACKS } = await import("../../../qa/households/lib/catalog.mjs");
  const { compute: budgetPercent } = await import("../budget-percent/compute.js");
  const { compute: expenses } = await import("../expenses/compute.js");
  const plans = [familyPlan(TY), renterDebtPlan(), retiredCouplePlan(TY), samplePlan(), emptyPlan()];
  for (const a of ARCHETYPES) {
    plans.push(a.build());
    for (const vs of Object.values({ ...COMMON_PACKS, special: SPECIAL_PACKS[a.id] ?? [] })) for (const v of vs) { const q = structuredClone(a.build()); v.apply(q); plans.push(q); }
  }
  const full = [bill("Cabin", 300, "me", ["me", "name:Sam", "name:Lee"]), bill("Food", 100, "name:Sam", [{ who: "me", share: 2 }, { who: "name:Sam", share: 1 }], { split: "shares" }),
    { id: "pay", kind: "paid", on: TS, from: "name:Lee", to: "me", amount: 100 }];
  let n = 0;
  for (const [i, p0] of plans.entries()) {
    const p = migrate(structuredClone(p0));
    assert.deepEqual(splitOf(p), { entries: [], open: [], settled: [], fix: 0, balances: {}, payments: [], people: splitOf(p).people, spelled: {}, last: ["me"] });
    for (const list of [[], full]) {
      const q = structuredClone(p); q.splitBills = structuredClone(list);
      assert.equal(JSON.stringify(compute(q, { today: TY })), JSON.stringify(compute(p, { today: TY })));
      if (i % 8 === 0) {
        assert.equal(JSON.stringify(budgetPercent(q, { today: TY })), JSON.stringify(budgetPercent(p, { today: TY })));
        assert.equal(JSON.stringify(expenses(q, { today: TY })), JSON.stringify(expenses(p, { today: TY })));
      }
      n++;
    }
    const s = splitOf(Object.assign(structuredClone(p), { splitBills: full }));
    assert.equal(sumOf(s.balances), 0);
  }
  assert.ok(n > 1000, `${n} plans`);
});
