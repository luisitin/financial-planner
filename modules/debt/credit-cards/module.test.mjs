// The full checks for this page are in tests/debt-pages.test.mjs (shared fixture qa/fixtures/debt-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { debtPlan } from "../../../qa/fixtures/debt-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("credit-cards: runs on the sample household and on an empty plan", () => {
  const d = compute(debtPlan(), { today: "2026-09-15" });
  assert.equal(d.count, 2); assert.ok(d.utilisation > 0.5);
  assert.ok(compute(emptyPlan(), { today: "2026-09-15" }));
});

test("what you really pay first, and how much less gets under 30% and 10% of the limits, and about when", async () => {
  const { underLines } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const today = "2026-11-02";
  const d = compute(familyPlan(today), { today });
  const visa = d.cards[0];
  // the family pays $400 on a $190 minimum: the Debts page's payment, date and interest
  assert.equal(visa.paying.payment, 400); assert.equal(visa.paying.endDate.slice(0, 7), "2028-07"); assert.equal(Math.round(visa.paying.interest), 1384);
  // $6,400 of a $15,000 limit: $1,900 less is 30%, $4,900 less is 10%; at $400 a month and 23.9% (by hand: 6,400 x (1 + 0.239/12) - 400 each
  // month) it is under $4,500 after 7 months and under $1,500 after 16
  assert.equal(Math.round(d.under.less30), 1900); assert.equal(Math.round(d.under.less10), 4900);
  assert.equal(d.under.date30, "2027-06-02"); assert.equal(d.under.date10, "2028-03-02");
  // already under: today; a card with no payment never gets there
  assert.equal(underLines([{ balance: 1000, rate: 0.2, payment: 50 }], 10000, today).date30, today);
  assert.equal(underLines([{ balance: 5000, rate: 0.2, payment: 0 }], 10000, today).date30, null);
  // paying only the minimum: no "you pay" line
  const min = familyPlan(today); min.debts = min.debts.map((x) => (x.accountId === visa.id ? { ...x, extra: 0, payment: undefined } : x));
  const m = compute(min, { today }).cards[0];
  if (m.payment <= m.minPayment + 0.5) assert.equal(m.paying, null);
});

// --- round 8 (2026-11-06), renter-debt-1 ---------------------------------------------------------------------------------------
/** Three cards and a car loan, as a young renter might have them (an invented household). */
function renterCards() {
  const p = emptyPlan();
  p.accounts.push({ id: "visa", name: "Visa card", type: "credit", balance: 4500 }, { id: "mc", name: "Mastercard", type: "credit", balance: 3300 },
    { id: "store", name: "Store card", type: "credit", balance: 2000 }, { id: "car", name: "Car loan", type: "loan", balance: 14000 });
  p.debts.push({ id: "d1", accountId: "visa", rate: 0.29, minPayment: 150, extra: 0, creditLimit: 5000 }, { id: "d2", accountId: "mc", rate: 0.24, minPayment: 100, extra: 0, creditLimit: 4000 },
    { id: "d3", accountId: "store", rate: 0.27, minPayment: 70, extra: 0, creditLimit: 2500 }, { id: "d4", accountId: "car", rate: 0.09, minPayment: 350, extra: 0 });
  return p;
}
test("round 8: paying only what the bank asks takes 16 to 19 years on the $4,500 card, not the 4 years 7 months of a fixed $150", () => {
  const d = compute(renterCards(), { today: "2026-11-06" });
  const visa = d.cards.find((c) => c.id === "visa");
  // what the bank asks: interest + 1% of the balance, at least $40 / $25 (core/math/payoff.js bankMinimum)
  assert.deepEqual([visa.bank.quick.months, Math.round(visa.bank.quick.interest), visa.bank.slow.months, Math.round(visa.bank.slow.interest)], [186, 8933, 233, 9661]);
  // the fixed $150 is still worked out (the answer key's reading of a typed payment): the "if you keep paying $150" line
  assert.deepEqual([visa.trap.months, Math.round(visa.trap.interest)], [55, 3610]);
  // no minimum typed at 29%: an estimate, never "never"
  const p = renterCards(); p.debts[0].minPayment = 0;
  const v0 = compute(p, { today: "2026-11-06" }).cards.find((c) => c.id === "visa");
  assert.ok(Number.isFinite(v0.bank.slow.months) && v0.bank.fromTyped === false);
});
test("round 8: the page leads with what the bank asks, keeps the fixed payment as a second line, and points to the statement's box", async () => {
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const text = await pageText(new URL("./view.js", import.meta.url), renterCards(), "2026-11-06");
  assert.match(text, /If you pay only the minimum \(it gets smaller as you owe less\): about 16 to 19 years and \$8,900 to \$9,700 of interest/);
  assert.match(text, /Keep paying \$150 even when the minimum drops: done in 4 years 7 months, \$3,610 of interest/);
  assert.match(text, /Minimum Payment Warning/);
  const p = renterCards(); p.debts[0].minPayment = 0;
  const t0 = await pageText(new URL("./view.js", import.meta.url), p, "2026-11-06");
  assert.ok(!/never ends/.test(t0), "a 29% card with no minimum typed no longer says it never ends");
  assert.match(t0, /If you pay only what most banks ask/);
});

// --- round 8 (2026-11-06), renter-debt-5, Credit cards' side: a transfer only if approved; a counselor when cards are full ----
test("round 8: the transfer saving says it needs approval and may not take it all; a nonprofit counselor when card use is over half", async () => {
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { compute: nba } = await import("../../overview/next-best-action/compute.js");
  const view = new URL("./view.js", import.meta.url);
  const text = await pageText(view, renterCards(), "2026-11-06", { computeOf: { "overview/next-best-action": nba } });
  // each card's saving covers the promo months, and holds only if a 0% card is granted
  assert.match(text, /saves about \$931 over 15 months if you are approved and pay \$309 a month/);
  assert.match(text, /A 0% card usually needs good credit, and its limit may not take all \$9,800 you owe on cards\./);
  // 85% of the limits in use: the counselor line (CFPB: NFCC or FCAA members; one payment a month to them)
  assert.match(text, /nonprofit credit counselor/); assert.match(text, /National Foundation for Credit Counseling/);
  // the family uses 43% of its limits and has money left each month: no counselor line
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const fam = await pageText(view, familyPlan("2026-11-02"), "2026-11-02", { computeOf: { "overview/next-best-action": nba } });
  assert.ok(!/counselor/.test(fam), "no counselor line for the family");
  assert.match(fam, /if you are approved/);
});

// --- round 8 review (2026-11-06): what the bank asks said truly for every card, and the help card only when it fits ----------
/** The page's words for a plan, with the two pages it reads (spare money a month; usable cash). */
async function cardsPage(plan, today) {
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { compute: nba } = await import("../../overview/next-best-action/compute.js");
  const { compute: liq } = await import("../../balance/liquidity/compute.js");
  return pageText(new URL("./view.js", import.meta.url), plan, today, { computeOf: { "overview/next-best-action": nba, "balance/liquidity": liq } });
}
const household = async (id) => { const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs"); return ARCHETYPES.find((a) => a.id === id).build(); };

test("review D1: a typed minimum that is the card's floor gives one figure; one that is the whole balance has no interest", async () => {
  // $900 at 19.9%, $35 required (qa household 05 base): interest + 1% is $23.93, so $35 is the floor: 34 months, $283 (by hand)
  const t5 = await cardsPage(await household("05-stay-at-home-parent"), "2026-09-15");
  assert.match(t5, /If you pay only the minimum \(\$35 a month until the balance is under it\): 2 years 10 months and \$283 of interest\./);
  assert.ok(!/to 5 years|\$240 to|asks for less|Keep paying \$35|no minimum typed/.test(t5), t5);
  // the Amex paid in full each month (household 12 base: $9,800 owed, $9,800 required)
  const t12 = await cardsPage(await household("12-high-net-worth"), "2026-09-15");
  assert.match(t12, /The bank asks for the whole balance each month: no interest while you keep paying it in full\./);
  assert.ok(!/years|asks for less|Keep paying|no minimum typed|0% transfer/.test(t12), t12);
  // a minimum under the month's interest: said, and most banks' minimum used ($10,000 at 24%: $200 of interest, $150 typed)
  const low = renterCards(); low.accounts[0].balance = 10000; low.debts[0].rate = 0.24;
  assert.match(await cardsPage(low, "2026-11-06"), /your \$150 minimum is less than this month's \$200 of interest: check it on your statement/);
});

test("review D2: no counselor card for a household that pays its card in full with cash to spare; the stretched renter keeps it", async () => {
  // household 12: spare money is negative on paper, but the only card is paid in full and $202,000 is in the bank
  assert.ok(!/counselor/.test(await cardsPage(await household("12-high-net-worth"), "2026-09-15")));
  // households 11 and 07: little spare money, but more cash in the bank than they owe on cards (07's is all set aside for goals)
  for (const id of ["11-self-employed", "07-multigenerational"]) assert.ok(!/counselor/.test(await cardsPage(await household(id), "2026-09-15")), id);
  // the renter: 85% of the limits in use, about $3 a month spare, $1,000 in the bank: the card, with where to find one
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const t = await cardsPage(renterDebtPlan(), "2026-11-06");
  assert.match(t, /nonprofit credit counselor/); assert.match(t, /nfcc\.org/); assert.match(t, /fcaa\.org/);
});

test("review UX: one word for the bank's figure, the reason in the line, what keeping the payment saves, a missing minimum said", async () => {
  const t = await cardsPage(renterCards(), "2026-11-06");
  // the rate is in the pill (20% or more): not again in the detail line
  assert.match(t, /Visa card 90% of limit 29\.0% minimum this month \$150 · limit \$5,000/);
  assert.match(t, /If you pay only the minimum \(it gets smaller as you owe less\): about 16 to 19 years and \$8,900 to \$9,700 of interest\./);
  // $8,933 - $3,610 = $5,323 and $9,661 - $3,610 = $6,051 less
  assert.match(t, /Keep paying \$150 even when the minimum drops: done in 4 years 7 months, \$3,610 of interest, about \$5,300 to \$6,100 less\./);
  assert.match(t, /0% transfer: saves about \$931 over 15 months if you are approved and pay \$309 a month\./);
  assert.ok(!/Paying only what the bank asks|a month required/.test(t), t);
  // no minimum typed: never "$0 a month required"
  const p = renterCards(); p.debts[0].minPayment = 0;
  const t0 = await cardsPage(p, "2026-11-06");
  assert.match(t0, /minimum not entered yet \(Debts page\)/); assert.ok(!/\$0 a month required/.test(t0));
  assert.match(t0, /If you pay only what most banks ask \(it gets smaller as you owe less\): about/);
});

test("review UX: the transfer saving says what clearing it takes when the month cannot carry it, and what it does at today's payments", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const d = compute(renterDebtPlan(), { today: "2026-11-06" });
  // by hand (an independent loop): 15 months at today's payments ($150, $70, $100) at 29%, 27% and 24%: $3,036.57 of interest;
  // the 3% fees $294; on the 0% card $4,635 + $2,060 + $3,399 less 15 x $320 = $5,294 still owed when the 15 months end
  assert.equal(d.transferPlan.count, 3); assert.equal(Math.round(d.transferPlan.payToClear), 673); assert.equal(d.transferPlan.paying, 320);
  assert.equal(Math.round(d.transferPlan.atPay.saves), 2743); assert.equal(Math.round(d.transferPlan.atPay.owedAfter), 5294);
  const t = await cardsPage(renterDebtPlan(), "2026-11-06");
  assert.match(t, /Clearing all three in 15 months takes about \$673 a month, \$353 more than you pay on them now, and your month has about \$3 to spare\./);
  assert.match(t, /At what you pay now \(\$320 a month\), the 0% months would save about \$2,700 of interest and leave about \$5,300 to pay when they end\./);
  // the family has money to spare: no such line
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  assert.ok(!/Clearing /.test(await cardsPage(familyPlan("2026-11-02"), "2026-11-02")));
});

test("review (phone check): a card paid in full is charged no interest in the headline, and there is no transfer offer to compare", async () => {
  const t12 = await cardsPage(await household("12-high-net-worth"), "2026-09-15");
  assert.ok(!/goes to interest|Balance transfer offer/.test(t12), t12);
  // a carried card keeps both
  const t5 = await cardsPage(await household("05-stay-at-home-parent"), "2026-09-15");
  assert.match(t5, /About \$15 a month goes to interest\./); assert.match(t5, /Moving a balance to a 0% card/);
});

// --- verify (2026-11-06): a small card's typed minimum under $40, and a balance paid off in one month ------------------------------
test("verify: a $30 minimum never reads as paid off sooner than keeping $30 a month; one month is 'month'", async () => {
  // the qa fixture's store card: $900 at 26.9%, $30 required. Keeping $30 level takes 51 months (4 years 3 months); what the bank
  // asks only drops, so "paying only the minimum" is 51 to 69 months, about 4 to 6 years, never "3 years"
  const t = await cardsPage(debtPlan(), "2026-09-15");
  assert.match(t, /Store card[^]*?If you pay only the minimum \(it gets smaller as you owe less\): about 4 to 6 years and \$610 to \$840 of interest\./);
  assert.ok(!/about 3 to 6 years/.test(t), t);
  // a $20 card with no minimum typed: paid in one month at either floor, said as "1 month"
  const p = renterCards(); p.accounts.find((a) => a.id === "visa").balance = 20; p.debts[0].minPayment = 0;
  const t1 = await cardsPage(p, "2026-11-06");
  assert.match(t1, /If you pay only what most banks ask \(it gets smaller as you owe less\): about 1 month and/); assert.ok(!/\b1 months\b/.test(t1), t1);
});

// --- round 8 batch 4 follow-up F3 (2026-11-07): the card's transfer line is worked at the payment it names ----------------------------
test("F3: each card's transfer saving is worked at payToClear, the payment its line names; the answer key's fields are unchanged", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const d = compute(renterDebtPlan(), { today: "2026-11-06" });
  const byName = (n) => d.cards.find((c) => c.name === n).transfer;
  // by hand (an independent loop, 15 months, 3% fee): Visa pays 4,500 x 1.03 / 15 = 309.00 against 29%: 1,065.83 of interest, less
  // the 135.00 fee = 930.83; Mastercard 226.60 against 24%: 621.68 - 99 = 522.68; Store card 137.33 against 27%: 434.08 - 60 = 374.08
  assert.equal(byName("Visa card").payToClear, 309); assert.equal(byName("Visa card").atClear.pay, 309);
  assert.ok(Math.abs(byName("Visa card").atClear.saves - 930.83) < 0.02, byName("Visa card").atClear.saves);
  assert.ok(Math.abs(byName("Mastercard").atClear.saves - 522.68) < 0.02); assert.ok(Math.abs(byName("Store card").atClear.saves - 374.08) < 0.02);
  // not the old reading: $300 a month (balance / 15) saved $956.24, still the answer key's `saves`
  assert.ok(Math.abs(byName("Visa card").saves - 956.24) < 0.01);
  assert.ok(byName("Visa card").atClear.saves < byName("Visa card").saves);
  // the page says the same figure
  const t = await cardsPage(renterDebtPlan(), "2026-11-06");
  assert.match(t, /0% transfer: saves about \$931 over 15 months if you are approved and pay \$309 a month\./);
  assert.match(t, /saves about \$523 over 15 months if you are approved and pay \$227 a month/); assert.match(t, /saves about \$374 over 15 months if you are approved and pay \$137 a month/);
  // a card whose minimum is more than payToClear: worked at the minimum, which the line then names
  const p = renterCards(); p.debts.find((x) => x.accountId === "visa").minPayment = 500;
  const v = compute(p, { today: "2026-11-06" }).cards.find((c) => c.name === "Visa card").transfer;
  assert.equal(v.atClear.pay, 500); assert.ok(v.atClear.saves < 930);
});

// --- round 8 batch 4 follow-up F6 (2026-11-07): the page opens short ----------------------------------------------------------------
test("F6: each card folds its other ways (keep the payment up, a 0% transfer) into one closed row; every figure is still on the page", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { compute: nba } = await import("../../overview/next-best-action/compute.js");
  const view = new URL("./view.js", import.meta.url);
  const r = await renderPage(view, renterDebtPlan(), "2026-11-06", { computeOf: { "overview/next-best-action": nba } });
  const more = r.root.querySelectorAll(".cc-more");
  assert.equal(more.length, 3);
  assert.ok(more.every((m) => m.tagName === "DETAILS" && !m.hasAttribute("open")), "closed by default: three cards, none is plainly the best move");
  assert.ok(more.every((m) => /Pay more, or move this balance to a 0% card/.test(m.textContent)));
  // each fold holds that card's two lines; the counselor card and the offer are folded cards, nothing removed
  assert.ok(more.every((m) => /Keep paying \$/.test(m.textContent) && /0% transfer: saves about/.test(m.textContent)));
  const t = r.text();
  for (const w of ["If payments are too much", "nfcc.org", "Moving a balance to a 0% card", "Use these numbers", "Promotional 0% months", "Clearing all three in 15 months takes about $673 a month"]) assert.ok(t.includes(w), w);
  assert.equal(r.root.querySelectorAll("details").filter((d) => d.hasAttribute("open")).length, 0);
  // one carried card whose transfer pays: that card's fold is open (the transfer is the move)
  const p = renterDebtPlan(); p.accounts = p.accounts.filter((a) => !["mc", "store"].includes(a.id)); p.debts = p.debts.filter((x) => !["mc", "store"].includes(x.accountId));
  const one = await renderPage(view, p, "2026-11-06", { computeOf: { "overview/next-best-action": nba } });
  const open = one.root.querySelectorAll(".cc-more");
  assert.equal(open.length, 1); assert.ok(open[0].hasAttribute("open"));
});

// --- review of the follow-ups (2026-11-07) ------------------------------------------------------------------------------------------
test("review UX: which card first, what the fold holds, the plain wording", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { renderPage, pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { firstCard } = await import("./view.js");
  const { compute: nba } = await import("../../overview/next-best-action/compute.js");
  const view = new URL("./view.js", import.meta.url);
  const t = (await renderPage(view, renterDebtPlan(), "2026-11-06", { computeOf: { "overview/next-best-action": nba } })).text();
  assert.match(t, /Put extra money on the Visa card first: it costs the most \(29%\)\./);
  assert.match(t, /Pay more, or move this balance to a 0% card/);
  // another saved payoff order: the line is not said (it would say the opposite of the plan)
  const p = renterDebtPlan(); p.debtPlan = { ...(p.debtPlan ?? {}), order: "snowball" };
  assert.ok(!/Put extra money on/.test(await pageText(view, p, "2026-11-06")));
  const cards = [{ name: "A", rate: 0.29, balance: 10, carried: true }, { name: "B", rate: 0.24, balance: 10, carried: true }];
  assert.equal(firstCard(cards, undefined).name, "A"); assert.equal(firstCard(cards, "avalanche").name, "A");
  assert.equal(firstCard(cards, "custom"), null); assert.equal(firstCard([cards[0]], undefined), null);
  assert.equal(firstCard([cards[0], { ...cards[0], name: "C" }], undefined), null);
  assert.equal(firstCard([{ ...cards[0], rate: 0.15 }, { ...cards[1], rate: 0.1 }], undefined), null);
  assert.ok(!/which drops as you pay down/.test(t));
  assert.match(t, /box called Minimum Payment Warning/);
});

// verify of the follow-ups (2026-11-07): the "which card first" line gives the rate as the card's pill does
test("verify: 'put extra money on' names the rate to the tenth when it is not whole", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const p = renterDebtPlan(); p.debts.find((x) => x.accountId === "setup-owe-credit").rate = 0.299;
  const t = await cardsPage(p, "2026-11-06");
  assert.match(t, /29\.9%/); assert.match(t, /Put extra money on the Visa card first: it costs the most \(29\.9%\)\./); assert.ok(!/\(30%\)/.test(t), t);
  assert.match(await cardsPage(renterDebtPlan(), "2026-11-06"), /it costs the most \(29%\)\./);
});

// --- simple first (docs/OPTIONAL.md; gap design #18's links row), 2026-11-13 -----------------------------------------------------
test("simple first: every fold is a part; the 0% transfer's boxes and the free help are rows of one card; the credit score question is the page's More on this", async () => {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { compute: nba } = await import("../../overview/next-best-action/compute.js");
  const r = await renderPage(new URL("./view.js", import.meta.url), renterCards(), "2026-11-06", { computeOf: { "overview/next-best-action": nba }, route: { rest: [], query: {} } });
  const details = r.root.querySelectorAll("details");
  assert.ok(details.length > 0 && details.every((x) => x.dataset.part), "no hand-written <details>: each is drawn by core/ui/more.js");
  // each card's other ways: one item part per card, inside its outlined holder
  const items = r.root.querySelectorAll(".cc-more");
  assert.equal(items.length, 3); assert.ok(items.every((x) => x.dataset.kind === "item" && /^card-/.test(x.dataset.part)));
  // one parts card: the transfer's own figures, then the free help; statuses fit beside the title (20 characters)
  const card = r.root.querySelector("[data-parts]") ?? r.root.querySelectorAll("section").find((s) => "parts" in s.dataset);
  const rows = card.querySelectorAll("details").map((x) => [x.dataset.part, x.dataset.kind, x.querySelector(".fold-title").textContent, x.querySelector(".fold-status")?.textContent ?? ""]);
  assert.deepEqual(rows.map((x) => x.slice(0, 3)), [["transfer", "own", "Moving a balance to a 0% card"], ["help", "how", "If payments are too much"]]);
  for (const x of rows) assert.ok(x[3].length <= 20, x[3]);
  assert.ok(card.querySelectorAll("details").every((x) => !x.hasAttribute("open")), "shut until asked");
  // the transfer's boxes are named, so an address can land on them (?show=promoMonths)
  assert.deepEqual(card.querySelectorAll("input").map((i) => i.getAttribute("name")), ["promoMonths", "feePct"]);
  const links = r.root.querySelectorAll("a").filter((a) => a.getAttribute("href") === "#/debt/credit-score");
  assert.equal(links.length, 1, "one way to Your credit score");
  const link = links[0];
  assert.equal(textOf(link).replace(/\s+/g, " ").trim(), "What is my credit score? ›", "the question alone while no score is kept");
  // drawn by core/ui/more.js links() (the "More on this" card, data-links), and reachable without opening anything: a balance
  // carried no longer puts it behind the shut transfer part (integ2 check 1, finding 3)
  const foot = r.root.all().find((e) => e.dataset?.links !== undefined);
  assert.ok(foot && foot.all().includes(link), "in the More on this card");
  for (let a = link.parentNode; a; a = a.parentNode) assert.ok(!(a.tagName === "DETAILS" && !a.hasAttribute("open")), "in no shut part");
  assert.ok(!card.all().includes(link), "not in the parts card");
  // a score kept on Your credit score: its answer under the question
  const { compute: score } = await import("../credit-score/compute.js");
  const withScore = renterCards(); withScore.credit = { scores: [{ id: "s1", personId: withScore.household?.people?.[0]?.id ?? "", date: "2026-10-02", score: 655, model: "fico" }] };
  const w = await renderPage(new URL("./view.js", import.meta.url), withScore, "2026-11-06", { computeOf: { "overview/next-best-action": nba, "debt/credit-score": score }, route: { rest: [], query: {} } });
  const wl = w.root.all().find((e) => e.dataset?.links !== undefined).querySelectorAll("a").find((a) => a.getAttribute("href") === "#/debt/credit-score");
  assert.match(textOf(wl), /What is my credit score\?\s*Your score: 655/);
  // every card paid in full: no transfer part, and the same "More on this" row
  const paid = renterCards(); for (const x of paid.debts) x.minPayment = paid.accounts.find((a) => a.id === x.accountId).balance;
  const q = await renderPage(new URL("./view.js", import.meta.url), paid, "2026-11-06", { computeOf: { "overview/next-best-action": nba }, route: { rest: [], query: {} } });
  const more = q.root.all().find((e) => e.dataset?.links !== undefined);
  assert.ok(more && more.querySelectorAll("a").some((a) => a.getAttribute("href") === "#/debt/credit-score"));
  assert.equal(q.root.querySelectorAll("details").filter((x) => x.dataset.part === "transfer").length, 0);
});

test("S11 (R17): after Use these numbers the transfer part stays open with its green line, and no other part opens or shuts", async () => {
  const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const draw = (plan) => { const p = migrate(structuredClone(plan)); const saved = []; const root = new FakeElement("main");
    render(root, { ui, fmt: { ...fmt, today: () => "2026-11-06" }, plan: p, route: { rest: [], query: {} }, module: { group: "debt", id: "credit-cards" }, computeOf: () => null,
      store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } } });
    return { root, saved }; };
  const openOf = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));
  const a = draw(renterCards());
  const before = openOf(a.root);
  assert.equal(before.transfer, false);
  // the two boxes and "Use these numbers" are one form: its Save is the part's one filled button (S6), no box outside it (S15)
  const form = a.root.querySelectorAll("form").find((f) => f.querySelector('[name="promoMonths"]'));
  assert.ok(form && form.querySelector('[name="feePct"]'));
  assert.equal(form.querySelectorAll("button").find((b) => b.textContent === "Use these numbers")?.getAttribute("type"), "submit");
  form.dispatch("submit");
  assert.deepEqual(a.saved[0].debtPlan.transfer, { months: 15, feePct: 0.03 });
  const b = draw(a.saved[0]);
  assert.deepEqual(openOf(b.root), { ...before, transfer: true }, "only the part saved in differs");
  assert.match(b.root.querySelector("[data-parts]")?.textContent ?? b.root.textContent, /Using 15 months at 0% and a 3% fee\./);
  // an empty months box is held, nothing saved
  const c = draw(renterCards());
  const f = c.root.querySelectorAll("form").find((x) => x.querySelector('[name="promoMonths"]'));
  f.querySelector('[name="promoMonths"]').value = "";
  f.dispatch("submit");
  assert.equal(c.saved.length, 0);
});
