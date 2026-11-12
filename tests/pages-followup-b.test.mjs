// tests/pages-followup-b.test.mjs -- the page follow-ups of the 2026-11-07 wording review (claude-b, lane B):
// words that read in a circle, margins said in plain numbers, and the Roth conversions page without the hard words.
import test from "node:test";
import assert from "node:assert/strict";
import { pageText, renderPage } from "../qa/fixtures/fake-dom.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { migrate } from "../core/schema/migrate.js";

const T = "2026-10-30";
const URL_OF = (k) => new URL(`../modules/${k}/view.js`, import.meta.url).href;
const computeOfAll = async (keys) => {
  const out = {};
  for (const k of keys) out[k] = (await import(new URL(`../modules/${k}/compute.js`, import.meta.url).href)).compute;
  return out;
};

test("liquidity: a goal named Emergency fund is explained without going in a circle, and the button makes sense", async () => {
  const p = migrate(familyPlan(T));
  const goal = p.goals.find((g) => g.id === "g-ef");
  assert.equal(goal.name, "Emergency fund");
  const computeOf = await computeOfAll(["overview/next-best-action", "overview/setup"]);
  const r = await renderPage(URL_OF("balance/liquidity"), p, T, { computeOf });
  const t = r.text();
  assert.match(t, /The money in Ally savings is kept for your "Emergency fund" goal, so it is not counted in the months above\. If you keep that money for emergencies, count it here too\./);
  assert.match(t, /Yes, count it as my emergency fund If not, leave it as it is\./);
  assert.ok(!t.includes("so that money counts as set aside for the goal, not as your emergency fund"));
  const btn = r.root.all().find((e) => e.tagName === "BUTTON" && /count it as my emergency fund/.test(e.textContent));
  assert.ok(btn, "the button does not name a goal, so it reads right for any goal name");
  assert.equal(btn.textContent, "Yes, count it as my emergency fund");
  btn.click();
  assert.equal(r.saved.at(-1).goals.find((g) => g.id === "g-ef").isEmergencyFund, true);
  // another name for the same goal
  const q = migrate(familyPlan(T)); q.goals.find((g) => g.id === "g-ef").name = "Rainy day money";
  const t2 = await pageText(URL_OF("balance/liquidity"), q, T, { computeOf });
  assert.match(t2, /kept for your "Rainy day money" goal/);
  // a goal with no name (review D1): never `your "" goal`
  const blank = migrate(familyPlan(T)); blank.goals.find((g) => g.id === "g-ef").name = "";
  const r3 = await renderPage(URL_OF("balance/liquidity"), blank, T, { computeOf });
  assert.match(r3.text(), /is kept for one of your goals \(it has no name\), so it is not counted/);
  assert.ok(!r3.text().includes('""'));
  r3.root.all().find((e) => e.tagName === "BUTTON" && /count it as my emergency fund/.test(e.textContent)).click();
  assert.equal(r3.saved.at(-1).goals.find((g) => g.id === "g-ef").isEmergencyFund, true);
});

test("projection: the 'short in a bad run' pill follows the full stop with a space", async () => {
  const p = migrate(familyPlan(T));
  const computeOf = await computeOfAll(["retirement/projection"]);
  const r = await renderPage(URL_OF("retirement/projection"), p, T, { computeOf });
  // the careful search settles after the first paint (a slice at a time)
  for (let i = 0; i < 100 && /it lasts \./.test(r.text()); i++) await new Promise((x) => setTimeout(x, 100));
  assert.ok(!/it lasts \./.test(r.text()), "the search settled");
  const pill = r.root.all().find((e) => e.hasAttribute("class") && /\bpill\b/.test(e.className) && /short in a bad run/.test(e.textContent));
  assert.ok(pill, "this household's plan is short in a bad run, so the pill shows");
  const before = pill.parentNode.childNodes[pill.parentNode.childNodes.indexOf(pill) - 1];
  assert.equal(before.textContent, " ", "a space between the full stop and the pill");
});

test("projection: 'Retirement money today' leaves out empty parts and says when only cash is counted", async () => {
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const { moneyToday } = await import("../modules/retirement/projection/view.js");
  const z = { cash: 0, taxable: 0, deferred: 0, free: 0 };
  assert.equal(moneyToday({ ...z, cash: 3700 }, true, money), "no retirement savings on file; $3,700 in cash is counted");
  assert.equal(moneyToday({ ...z, cash: 3700 }, false, money), "$3,700, all of it in cash");
  assert.equal(moneyToday(z, false, money), "none on file yet");
  // taxable accounts are "regular savings" on this card (review D5): "all of it taxable" read as "all of it will be taxed"
  assert.equal(moneyToday({ ...z, taxable: 50000 }, false, money), "$50,000, all of it in regular savings");
  assert.equal(moneyToday({ cash: 15700, taxable: 18000, deferred: 128000, free: 0 }, false, money), "$161,700: $15,700 in cash, $18,000 in regular savings, $128,000 in retirement accounts you pay tax on later");
  const p = migrate(familyPlan(T));
  const computeOf = await computeOfAll(["retirement/projection"]);
  const t = await pageText(URL_OF("retirement/projection"), p, T, { computeOf });
  assert.ok(!/\$0 taxable|\$0 you already paid/.test(t), "no empty parts");
  assert.match(t, /Retirement money today \$192,700: \$15,700 in cash, \$18,000 in regular savings, \$128,000 in retirement accounts you pay tax on later, \$31,000 you already paid tax on/);
});

test("Your plan and Get started: cash a bit over the target is 'a bit over', only far above it is 'well over'", async () => {
  const { overTarget } = await import("../core/words.js");
  assert.equal(overTarget(6, 6), null);
  assert.equal(overTarget(6.05, 6), null);
  assert.equal(overTarget(7, 6), "a bit over the 6 you want");
  assert.equal(overTarget(8.9, 6), "a bit over the 6 you want");
  assert.equal(overTarget(9, 6), "well over the 6 you want");
  assert.equal(overTarget(17.9, 6), "well over the 6 you want");
  assert.equal(overTarget(null, 6), null);
  const S = await import("../modules/overview/setup/compute.js");
  const p = migrate(familyPlan(T));
  const have = (covered) => S.cushionHave(p, { covered, months: 6, now: 5000, all: 5000, earmarked: 0, taxOwed: 0 });
  // months are whole numbers from 2 up (the 58-sentence follow-up, n04), and under the target the line says "so far, and you want 6"
  // the family never chose its months: "we suggest 6" (left2 merge W d, 2026-11-11), "you want" once they are chosen
  assert.match(have(7), /7 months, a bit over the 6 we suggest/);
  assert.match(have(17.9), /18 months, well over the 6 we suggest/);
  assert.match(have(3), /3 months so far, and we suggest 6/);
});

test("Roth conversions: the first screen says what 'the 22% rate' means and gives Medicare's extra charge with its figure", async () => {
  const rc = await import("../qa/fixtures/retiree-cases.mjs");
  for (const name of ["bridgeCouple", "fullBracketRetiree", "taxedDrawRetiree", "earlyRetiree"]) {
    const t = await pageText(URL_OF("retirement/roth-conversions"), migrate(rc[name]()), "2026-11-06");
    const first = t.split("How this is worked out")[0];
    assert.ok(!/bracket/i.test(first), `${name}: 'bracket' on the first screen`);
    assert.ok(!/IRMAA|premium tax credit/i.test(first), `${name}: a hard name on the first screen`);
    assert.match(first, /A Roth conversion moves money from your regular retirement account into a Roth account\. You pay tax on it now, and later withdrawals are tax-free\./);
    assert.match(first, /Each rate is a ceiling: each year the plan converts only as much as stays taxed at that rate or lower\. At the 22% rate, none of it reaches 24%\./);
  }
  const t = await pageText(URL_OF("retirement/roth-conversions"), migrate(rc.taxedDrawRetiree()), "2026-11-06");
  // the sentence names the rate it is about: here the best answer is "No conversions", so the 22% rate is the one shown
  assert.match(t, /Medicare also charges extra on its monthly premiums, from 65, when your income two years earlier passes about \$109,000 \(in today's dollars\)\. Converting at the 22% rate in 2026 to 2030 would pass it\. The figures below count that charge\./);
  assert.match(t, /IRMAA \(income-related monthly adjustment amount: Medicare's extra charge\)/);
  assert.match(t, /Other choices: each ends with less than not converting/);
  // a household that never passes the line is not told about it
  const b = await pageText(URL_OF("retirement/roth-conversions"), migrate(rc.bridgeCouple()), "2026-11-06");
  assert.ok(!/Medicare also charges/.test(b));
  assert.match(b, /Before 65, what you convert counts as income for the help with health insurance, which stops once income passes about \$86,560 a year\./);
});

test("credit cards: extra money goes where Pay off debts puts it; a card name reads right; a transfer that does not pay is not offered in a title", async () => {
  const { renterDebtPlan } = await import("../qa/fixtures/renter-debt-plan.mjs");
  const { compute: payoff } = await import("../modules/debt/payoff/compute.js");
  const { compute: nba } = await import("../modules/overview/next-best-action/compute.js");
  const { cardPhrase, dearerLoan, loanPhrase } = await import("../modules/debt/credit-cards/view.js");
  const computeOf = { "debt/payoff": payoff, "overview/next-best-action": nba };
  const view = URL_OF("debt/credit-cards");
  // as before: the dearest card when the cards are the dearest debts
  const base = await pageText(view, renterDebtPlan(), "2026-11-06", { computeOf });
  assert.match(base, /Put extra money on the Visa card first: it costs the most \(29%\)\./);
  // a 32% car loan costs more than any card: the page says so, as Pay off debts does (its first debt is the loan)
  const p = renterDebtPlan();
  p.debts.find((x) => x.accountId === "setup-owe-car-loan").rate = 0.32;
  const t = await pageText(view, p, "2026-11-06", { computeOf });
  assert.match(t, /Put extra money on the Car loan first: it costs the most \(32%\), more than any card\. It is not one of the 3 cards here; Pay off debts shows the full order\./);
  assert.ok(!/Put extra money on the Visa card/.test(t));
  const pay = payoff(p, { today: "2026-11-06" });
  assert.equal([...pay.debts].sort((a, b) => b.rate - a.rate)[0].name, "Car loan", "Pay off debts puts the loan first too");
  // names: ends in card / starts with the word / neither
  assert.equal(cardPhrase("Visa card"), "the Visa card");
  assert.equal(cardPhrase("Card A"), "Card A");
  assert.equal(cardPhrase("Amex Gold"), "the Amex Gold card");
  // a loan that already says whose it is has no "the" (review D6)
  assert.equal(loanPhrase("Car loan"), "the Car loan");
  assert.equal(loanPhrase("Pat's car loan"), "Pat's car loan");
  assert.equal(loanPhrase("Payday"), "the Payday");
  assert.equal(dearerLoan([{ id: "x", name: "Car", type: "loan", balance: 5, rate: 0.3 }], [{ id: "c" }], 0.29).name, "Car");
  assert.equal(dearerLoan([{ id: "x", name: "Mortgage", type: "mortgage", balance: 5, rate: 0.3 }], [{ id: "c" }], 0.29), null);
  assert.equal(dearerLoan([{ id: "c", name: "Visa", type: "credit", balance: 5, rate: 0.3 }], [{ id: "c" }], 0.29), null);
  const named = renterDebtPlan(); named.accounts.find((a) => a.id === "setup-owe-credit").name = "Card A";
  assert.match(await pageText(view, named, "2026-11-06", { computeOf }), /Put extra money on Card A first/);
  // the transfer offer points at the lines under each card, which are folded
  assert.match(base, /The 0% transfer figures under each card use these months and fee/);
  assert.ok(!/saving above/.test(base));
});

test("credit cards: a card whose 0% transfer does not pay has a fold titled for what it holds", async () => {
  const { renterDebtPlan } = await import("../qa/fixtures/renter-debt-plan.mjs");
  const { compute: nba } = await import("../modules/overview/next-best-action/compute.js");
  const { compute: cc } = await import("../modules/debt/credit-cards/compute.js");
  const view = URL_OF("debt/credit-cards");
  // the Visa card at 4%: the transfer's fee is more than the interest it saves ($14 less), the other two cards still gain
  const p = renterDebtPlan(); for (const x of p.debts.filter((y) => /credit/.test(y.accountId))) x.rate = 0.04; p.debts.find((x) => x.accountId === "setup-owe-credit").rate = 0.04;
  const d = cc(p, { today: "2026-11-06" });
  const visa = d.cards.find((c) => c.name === "Visa card");
  assert.ok(visa.transfer.interestNow >= 0.5 && visa.transfer.atClear.saves <= 0, "the Visa card's transfer does not pay");
  const r = await renderPage(view, p, "2026-11-06", { computeOf: { "overview/next-best-action": nba } });
  const titles = r.root.querySelectorAll(".cc-more").map((e) => e.querySelector(".fold-title").textContent);
  assert.equal(titles.filter((x) => x === "Keep paying more").length, 1, titles.join(" | "));
  assert.equal(titles.filter((x) => x === "Pay more, or move this balance to a 0% card").length, d.cards.filter((c) => c.transfer?.atClear?.saves > 0).length);
  assert.ok(!titles.includes("Move to 0%"));
});

test("goal seek: ?target=badluck opens with Room for bad luck on; the address keeps its other keys; the score's 115% hint links there", async () => {
  const { renterDebtPlan } = await import("../qa/fixtures/renter-debt-plan.mjs");
  const { compute: gs } = await import("../modules/scenarios/goal-seek/compute.js");
  const { compute: score } = await import("../modules/overview/health-score/compute.js");
  const calls = [];
  globalThis.history = { state: null, replaceState: (...a) => calls.push(a) };
  globalThis.location = { pathname: "/", search: "?sandbox=1", hash: "" };
  try {
    const live = { "scenarios/goal-seek": (plan, params) => gs(plan, params) };
    const route = { group: "scenarios", id: "goal-seek", rest: [], query: { target: "badluck", guide: "retire", step: "3" } };
    // (with some retirement savings on file: with none the page is its hero alone, stress test 2026-11-11, F4)
    const saved = () => { const q = renterDebtPlan(); q.accounts.find((x) => x.id === "k401").balance = 100000; return q; };
    const a = await renderPage(URL_OF("scenarios/goal-seek"), saved(), "2026-11-06", { computeRemote: live, route });
    const last = a.remote[a.remote.length - 1].params;
    assert.equal(last.legacy, 0); assert.equal(last.spendingScale, 1.15);
    const chip = a.root.querySelectorAll(".chip").find((c) => c.textContent.startsWith("Room for bad luck"));
    assert.equal(chip.getAttribute("aria-pressed"), "true");
    assert.equal(calls.length, 1);
    assert.equal(calls[0][2], "/?sandbox=1#/scenarios/goal-seek?guide=retire&step=3", "target is taken out, guide and step stay");
    // ?target=last keeps the other keys too, and does not turn the chip on
    const calls0 = calls.length;
    const b = await renderPage(URL_OF("scenarios/goal-seek"), saved(), "2026-11-06", { computeRemote: live, route: { ...route, query: { target: "last", guide: "retire" } } });
    assert.equal(b.remote[b.remote.length - 1].params.spendingScale, undefined);
    assert.equal(calls[calls0][2], "/?sandbox=1#/scenarios/goal-seek?guide=retire");
  } finally { delete globalThis.history; delete globalThis.location; }
  // the score: a plan that lasts but is under 115% links to the chip
  const q = renterDebtPlan(); q.accounts.find((a) => a.id === "k401").balance = 100000;
  const ret = score(q, { today: "2026-11-06" }).parts.find((x) => x.id === "retirement");
  assert.deepEqual(ret.query, { target: "badluck" });
  assert.match(ret.fix, /Open the Goal seek page to see (it|each) with "Room for bad luck" on\.$/);
  const page = await renderPage(URL_OF("overview/health-score"), q, "2026-11-06", { computeRemote: { "overview/health-score": score } });
  assert.ok(page.root.querySelectorAll("a").some((x) => x.getAttribute("href") === "#/scenarios/goal-seek?target=badluck"));
});

test("goal seek: the bad-luck line and the sentence under the chip follow the answer on screen (d.scale), not the chip's state", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../modules/scenarios/goal-seek/view.js", import.meta.url), "utf8");
  assert.ok(/carefulLine\(ctx, d\.legacy, money, moneyUp, moneyDown, d\.spendingMonthly \/ d\.scale, d\.scale, pillEl, answered\)/.test(src));
  assert.ok(/d\.scale === BAD_LUCK \? ` Every figure below/.test(src));
});

test("review follow-ups: Federal estimate says 'rate' and spells out the income line; Tax brackets and guesses put '$' and 'income' where they belong", async () => {
  const fs = await import("node:fs");
  const walkSrc = fs.readFileSync(new URL("../modules/taxes/federal/compute.js", import.meta.url), "utf8");
  assert.ok(walkSrc.includes('sub: "your income after the adjustments above"'));
  assert.ok(!/through the bracket/.test(walkSrc));
  const viewSrc = fs.readFileSync(new URL("../modules/taxes/federal/view.js", import.meta.url), "utf8");
  assert.ok(viewSrc.includes("of room left before it goes up") && !viewSrc.includes("of room left in it"));
  // Tax brackets: money in the gains note has its dollar sign (review D7)
  const src = fs.readFileSync(new URL("../modules/taxes/brackets/compute.js", import.meta.url), "utf8");
  assert.ok(src.includes("`$${Math.round(r.qualifiedTaxable).toLocaleString(\"en-US\")} of dividends and long-term gains"));
  // one name for the emergency money (review D11), and Get started's work-plan line is not a fact about the money (D10)
  assert.ok(fs.readFileSync(new URL("../modules/overview/benchmarks/compute.js", import.meta.url), "utf8").includes('title: "Emergency fund"'));
  assert.ok(fs.readFileSync(new URL("../modules/property/purchase/view.js", import.meta.url), "utf8").includes("under your emergency fund target of"));
  // the Debt row names the debts the way a sentence does (UX 6)
  const { theList } = await import("../modules/overview/health-score/compute.js");
  assert.equal(theList(["Visa card", "Store card", "Mastercard"]), "the Visa card, the Store card and the Mastercard");
  assert.equal(theList(["Pat's car loan"]), "Pat's car loan");
});

test("people: someone who told Get started they are retired is retired on every page, even with a later retirement age on file (review D2)", async () => {
  const { compute } = await import("../modules/household/people/compute.js");
  const p = migrate(familyPlan(T));
  const me = p.household.people.find((x) => x.role !== "dependent");
  me.birthDate = "1956-06-01"; me.retirementAge = 71;
  p.guide = p.guide ?? {}; p.guide.setup = { ...(p.guide.setup ?? {}), status: { ...(p.guide.setup?.status ?? {}), [me.id]: "retired" } };
  const x = compute(p, { today: T }).people.find((y) => y.id === me.id);
  assert.equal(x.retired, true);
  assert.equal(x.yearsToRetirement, 0);
  // the list line and the tile both read `retired` from compute (the list no longer re-checks the setup answer on its own)
  const fs = await import("node:fs");
  const view = fs.readFileSync(new URL("../modules/household/people/view.js", import.meta.url), "utf8");
  assert.ok(view.includes('p.retired ? "retired" : `retires at'));
  const src = (await import("node:fs")).readFileSync(new URL("../modules/retirement/projection/view.js", import.meta.url), "utf8");
  assert.ok(src.includes('plan.guide?.setup?.status?.[p.id] === "retired") ?'));
});

// ---- verify (2026-11-07) ----------------------------------------------------------------------------------------------------
test("verify: People's tile says 'is retired' without a future 'at 71, in 2027' for someone who told Get started they are retired", async () => {
  const { FakeElement } = await import("../qa/fixtures/fake-dom.mjs");
  if (!Object.getOwnPropertyDescriptor(FakeElement.prototype, "lastElementChild")) Object.defineProperty(FakeElement.prototype, "lastElementChild", { configurable: true, get() { return this.children.at(-1) ?? null; } });
  const { compute } = await import("../modules/household/people/compute.js");
  const page = async (p) => (await renderPage(URL_OF("household/people"), p, T, { computeOf: { "household/people": compute } })).text();
  const p = migrate(familyPlan(T));
  const me = p.household.people.find((x) => x.role !== "dependent");
  me.birthDate = "1956-06-01"; me.retirementAge = 71;
  p.guide = p.guide ?? {}; p.guide.setup = { ...(p.guide.setup ?? {}), status: { ...(p.guide.setup?.status ?? {}), [me.id]: "retired" } };
  const t = await page(p);
  assert.match(t, /now (Ana|You) (is|are) retired/);
  assert.ok(!/retired at 71, in 2027/.test(t), t.slice(0, 300));
  assert.match(t, /age 70 · retired/);
  // past the age on file: the tile keeps when it happened
  const q = migrate(familyPlan(T));
  const m2 = q.household.people.find((x) => x.role !== "dependent");
  m2.birthDate = "1956-06-01"; m2.retirementAge = 65;
  assert.match(await page(q), /retired at 65, in 2021/);
});

test("verify: the Federal estimate's Additional Medicare and investment income tax lines give their line in dollars", async () => {
  const { walk } = await import("../modules/taxes/federal/compute.js");
  const r = { income: { gross: 0, wages: 0, ordinary: 0, socialSecurity: 0, capitalLoss: 0 }, adjustments: 0, agi: 0, deduction: { used: "standard", amount: 0, senior: 0, standard: 0, charity: 0 },
    taxableIncome: 0, qualifiedTaxable: 0, incomeTax: 0, qualifiedTax: 0, credits: { childTaxCredit: 0, refundable: 0, careCredit: 0 }, niit: 380, additionalMedicare: 45, totalTax: 425, effectiveRate: 0.1, withheld: 0, paid: 0 };
  const params = { niitThreshold: { married_joint: 250000, married_separate: 125000 }, additionalMedicareThreshold: { married_joint: 250000, married_separate: 125000 } };
  const b = { filingStatus: "married_joint", inputs: { filingStatus: "married_joint" }, params, itemized: { total: 0 }, people: { ages65plus: 0, dependentsUnder17: 0 }, gains: { carryForward: 0 } };
  const sub = (steps, label) => steps.find((s) => s.label === label)?.sub;
  const joint = walk(r, b, 0.24);
  assert.equal(sub(joint, "Additional Medicare tax"), "0.9% on wages over $250,000");
  assert.equal(sub(joint, "Net investment income tax"), "3.8% on investment income once income passes $250,000");
  const sep = walk(r, { ...b, filingStatus: "married_separate", inputs: { filingStatus: "married_separate" }, separate: true }, 0.24);
  assert.equal(sub(sep, "Additional Medicare tax"), "0.9% on wages over $125,000 on each return");
  // the household on the page: Ana's pay at $7,600 a month passes the joint line
  const { known } = await import("../modules/taxes/federal/known.js");
  const p = familyPlan("2026-10-30"); p.income.find((x) => x.id === "i-ana").amount = 7600;
  const k = known(p, { today: "2026-10-30" });
  assert.equal(sub(k.steps, "Additional Medicare tax"), "0.9% on wages over $250,000");
});

test("verify: the Emergency fund note lists three accounts the way the other pages do (no comma before 'and')", async () => {
  const p = migrate(familyPlan(T));
  p.accounts.push({ id: "a-jar", name: "Cash jar", type: "cash", balance: 900 });
  p.goals.find((g) => g.id === "g-ef").fundedBy = ["a-sav", "a-chk", "a-jar"];
  const computeOf = await computeOfAll(["overview/next-best-action", "overview/setup"]);
  const t = await pageText(URL_OF("balance/liquidity"), p, T, { computeOf });
  assert.match(t, /The money in Ally savings, Chase checking and Cash jar is kept for your "Emergency fund" goal/);
});
