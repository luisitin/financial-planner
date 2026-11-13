// Tests for cashflow/shared-costs (gap design #22): the formulas, one test per sentence case, the page simple first, and
// the invariance check (the new optional field changes no other page's result).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, answerFor, alarmFor, namesOf, ownShares, dollars, costsOf, coupleOf, settingsOf, METHODS, METHOD_LABELS } from "./compute.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { takeHome } from "../paycheck/compute.js";
import { compute as computeIncome } from "../income/compute.js";

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
    [["keeps", "more", "4 more numbers", "", false], ["costs", "own", "Which costs are shared", "all 3 shared", false], ["how", "how", "How this is worked out", "5 steps", false]]);
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
  assert.deepEqual(before, { keeps: false, costs: false, how: false });
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
  assert.equal(s.text(), "Sharing costs as a couple This is for two people who share costs. Add a partner on People");
  assert.equal(partsOf(s.root).length, 0); assert.equal(filled(s.root).length, 0);
  const c = await pageOf(couple({ costs: false }));
  assert.deepEqual(filled(c.root).map((a) => [textOf(a), a.getAttribute("href")]), [["Open Expenses", "#/cashflow/expenses"]]);
  assert.equal(partsOf(c.root).length, 0);
  const n = await pageOf(couple({ ana: 0, bo: 0 }));
  assert.deepEqual(filled(n.root).map((a) => [textOf(a), a.getAttribute("href")]), [["Open Income", "#/cashflow/income"]]);
  assert.deepEqual(partsOf(n.root).map((x) => x.dataset.part), ["costs", "how"]);
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
