// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("rebalance: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("no trades against a mix nobody chose, and a target-date fund is never sold as one class", async () => {
  const held = async () => (await import("../../../qa/fixtures/held-plan.mjs")).heldPlan();
  const { compute: allocation } = await import("../allocation/compute.js");
  const p = await held(), T = { today: "2026-11-02" };
  const w = compute(p, T);
  assert.equal(w.waiting, "pick"); assert.equal(w.needed, false); assert.deepEqual(w.trades, []);
  // the plan's 70/30 chosen: the US index funds are sold, the 2055 fund is not
  p.investments = { ...(p.investments ?? {}), target: allocation(p, T).choices.find((c) => c.key === "plan").mix };
  const r = compute(p, T);
  assert.equal(r.waiting, null); assert.equal(r.needed, true);
  assert.ok(r.sells.length && r.sells.every((s) => s.symbol !== "FFFHX"), r.sells.map((s) => s.symbol).join(","));
  assert.deepEqual(r.blended.map((b) => b.symbol), ["FFFHX"]);
  // only the target-date fund holds stocks: nothing can be sold for them, and the page says why
  p.holdings = p.holdings.filter((h) => h.symbol === "FFFHX" || h.symbol === "BND");
  for (const [id, v] of [["a-401", 3300 * 16], ["a-roth", 0], ["a-bk401", 0]]) p.accounts.find((a) => a.id === id).balance = v;
  p.investments.target = { us_stocks: 0.3, intl_stocks: 0.2, bonds: 0.5, cash: 0, real_estate: 0, other: 0 };
  const o = compute(p, T);
  assert.ok(o.sells.every((s) => s.symbol !== "FFFHX"));
  assert.ok(o.overOnlyBlended.length > 0);
  // nothing can be sold: the page says the ways to move the fund's mix instead of an empty trade list
  assert.equal(o.sells.length, 0); assert.ok(o.onlyInFund, "only the fund holds what is over");
  assert.deepEqual(o.onlyInFund.funds.map((x) => x.symbol), ["FFFHX"]); assert.equal(o.onlyInFund.taxFree, true, "inside the 401(k)");
  assert.ok(!o.notes.some((n) => /keeps its own mix|could not be placed/.test(n)), "the hero says it, not two notes");
  // the fund alone, its own mix picked: no rebalance, and no note telling them to pick it
  p.holdings = p.holdings.filter((h) => h.symbol === "FFFHX"); p.accounts.find((a) => a.id === "a-brk").balance = 0;
  p.investments.target = null;
  p.investments.target = allocation(p, T).choices.find((c) => c.key === "fund").mix;
  const k = compute(p, T);
  assert.equal(k.needed, false); assert.equal(k.onlyInFund, null); assert.deepEqual(k.overOnlyBlended, []);
  assert.ok(!k.notes.some((n) => /pick a target that matches|could not be placed/.test(n)), k.notes.join(" | "));
});

// ---- "Try a trade" (gap list, next 60, item 50): trade.js, worked by hand on the investments fixture -----------------
import { sellChoices, buyChoices, tryTrade, offTarget, shareTexts, tradeLead, tooMuchSentence, mixSentence, outsideSentence, gainSentence, gainNotes, sellNote, nothingAsked, NEW_FUND } from "./trade.js";
import { migrate } from "../../../core/schema/migrate.js";
import { compute as allocation } from "../allocation/compute.js";

const T = "2026-11-15";
const P0 = () => migrate(investmentsPlan());
// the fixture's money by class (Holdings' mixes; the 2055 target-date fund, 29 years out, is 54% US, 36% international and
// 10% bonds; Acme, not classified, stays out as Allocation counts it): US 87,000 + 318,000 + 108,000; international
// 144,000 + 72,000; bonds 51,100 + 20,000; cash 12,900; real estate 66,500
const V = { us_stocks: 513000, intl_stocks: 216000, bonds: 71100, cash: 12900, real_estate: 66500, other: 0 };
const TOTAL = 879500;
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const row = (r, cls) => r.rows.find((x) => x.cls === cls);

test("try a trade: what can be sold, and what a sale can buy (the same account only)", () => {
  const s = sellChoices(P0(), { today: T });
  assert.deepEqual(s.map((c) => [c.id, c.label, c.account, c.value]), [["h1", "VTI", "Brokerage", 87000], ["h2", "BND", "Brokerage", 51100], ["h3", "SPAXX", "Brokerage", 12900], ["h4", "FXAIX", "Sam's 401(k)", 318000], ["h5", "VFFVX", "Sam's 401(k)", 200000], ["h6", "VTIAX", "Lee's IRA", 144000], ["h7", "VNQ", "Lee's IRA", 66500], ["h8", "ACME", "Sam's Roth", 90000]]);
  assert.deepEqual(buyChoices(P0(), "h1", { today: T }).map((b) => [b.value, b.label]), [["h2", "BND · Bonds"], ["h3", "SPAXX · Cash"], ...Object.entries(NEW_FUND).map(([c, l]) => [`cls:${c}`, l])]);
  assert.deepEqual(buyChoices(P0(), "h4", { today: T }).slice(0, 1).map((b) => [b.value, b.label]), [["h5", "VFFVX · Stocks and bonds"]]);
  assert.deepEqual(buyChoices(P0(), "nope", { today: T }), []);
});

test("try a trade: the new mix by class, worked by hand (sell $29,000 of VTI, buy BND)", () => {
  const p = P0(), r = tryTrade(p, { sell: "h1", amount: 29000, buy: "h2" }, { today: T });
  const a = allocation(p, { today: T });
  for (const c of Object.keys(V)) near(a.rows.find((x) => x.cls === c)?.value ?? 0, V[c], 1e-6);
  near(row(r, "us_stocks").before, 513000 / TOTAL); near(row(r, "us_stocks").after, 484000 / TOTAL);
  near(row(r, "bonds").before, 71100 / TOTAL); near(row(r, "bonds").after, 100100 / TOTAL);
  near(row(r, "intl_stocks").after, 216000 / TOTAL);
  assert.deepEqual(r.rows.map((x) => [x.label, ...shareTexts(x.before, x.after), Math.round(x.target * 100)]), [["US stocks", "58%", "55%", 50], ["International stocks", "25%", "25%", 20], ["Bonds", "8%", "11%", 25], ["Cash", "1%", "1%", 5], ["Real estate (REITs)", "8%", "8%", 0]]);
  // off target: half the sum of each class's distance from the target
  const target = { us_stocks: 0.5, intl_stocks: 0.2, bonds: 0.25, cash: 0.05, real_estate: 0, other: 0 };
  const off = (m) => Object.keys(target).reduce((s, c) => s + Math.abs(m[c] / TOTAL - target[c]), 0) / 2;
  near(r.offBefore, off(V)); near(r.offAfter, off({ ...V, us_stocks: 484000, bonds: 100100 }));
  assert.equal(r.mixCase, "closer");
  assert.equal(tradeLead(r), "If you sell $29,000 of VTI and buy BND with it:");
  assert.equal(mixSentence(r), "This trade brings your mix closer to your target: 20% of the money is off target now, 17% after.");
  assert.equal(r.amount, 29000); assert.equal(r.tooMuch, false); assert.equal(r.hasTarget, true);
});

test("try a trade: all of it, a target-date fund bought, something new, an unclassified holding sold", () => {
  const all = tryTrade(P0(), { sell: "h1", all: true, amount: 5, buy: "cls:cash" }, { today: T });
  assert.equal(all.amount, 87000); assert.equal(tradeLead(all), "If you sell all of VTI ($87,000) and keep it as cash:");
  near(row(all, "cash").after, (12900 + 87000) / TOTAL); near(row(all, "us_stocks").after, (513000 - 87000) / TOTAL);
  // the 2055 fund bought: 54% US, 36% international, 10% bonds of the $50,000
  const td = tryTrade(P0(), { sell: "h4", amount: 50000, buy: "h5" }, { today: T });
  near(row(td, "us_stocks").after, (513000 - 50000 + 27000) / TOTAL); near(row(td, "intl_stocks").after, (216000 + 18000) / TOTAL); near(row(td, "bonds").after, (71100 + 5000) / TOTAL);
  assert.equal(td.mixCase, "about");
  assert.equal(mixSentence(td), "This trade leaves your mix about as far from your target as it is now: 20% of the money is off target.");
  assert.equal(tradeLead(tryTrade(P0(), { sell: "h2", amount: 1000, buy: "cls:intl_stocks" }, { today: T })), "If you sell $1,000 of BND and buy an international stocks fund with it:");
  // Acme is not classified: selling it into bonds adds to the money the mix counts, and the page says so (critic M3: the
  // US share fell while only bonds were bought, unexplained)
  const ac = tryTrade(P0(), { sell: "h8", amount: 90000, buy: "cls:bonds" }, { today: T });
  near(row(ac, "bonds").after, (71100 + 90000) / (TOTAL + 90000));
  near(row(ac, "us_stocks").after, 513000 / (TOTAL + 90000));
  assert.equal(ac.outside, true);
  assert.equal(outsideSentence(ac), "ACME is not in your mix (no kind is set for it on Holdings), so selling it adds $90,000 to the mix.");
  assert.equal(tryTrade(P0(), { sell: "h1", amount: 1000, buy: "h2" }, { today: T }).outside, false);
  assert.equal(outsideSentence(tryTrade(P0(), { sell: "h1", amount: 1000, buy: "h2" }, { today: T })), "");
  assert.equal(tryTrade(P0(), { sell: "h5", amount: 1000, buy: "h4" }, { today: T }).outside, false, "a target-date fund is in the mix");
  // further from the target
  const away = tryTrade(P0(), { sell: "h2", amount: 10000, buy: "h1" }, { today: T });
  assert.equal(away.mixCase, "further");
  assert.equal(mixSentence(away), "This trade moves your mix away from your target: 20% of the money is off target now, 22% after.");
});

test("try a trade: the same class, too much, nothing asked, and a buy outside the account", () => {
  const same = tryTrade(P0(), { sell: "h4", amount: 1000, buy: "cls:us_stocks" }, { today: T });
  assert.equal(same.mixCase, "same"); assert.equal(mixSentence(same), "Both are US stocks, so your mix stays the same.");
  assert.equal(mixSentence(tryTrade(P0(), { sell: "h2", amount: 1000, buy: "cls:bonds" }, { today: T })), "Both are bonds, so your mix stays the same.");
  const big = tryTrade(P0(), { sell: "h4", amount: 500000, buy: "h5" }, { today: T });
  assert.equal(big.tooMuch, true); assert.equal(tooMuchSentence(big), "FXAIX is worth $318,000: type at most that, or tick “Sell all of it”.");
  assert.equal(tradeLead(big), ""); assert.equal(mixSentence(big), ""); assert.equal(gainSentence(big), "");
  // a few cents over (the box rounds) is the whole holding
  assert.equal(tryTrade(P0(), { sell: "h1", amount: 87000.4, buy: "h2" }, { today: T }).amount, 87000);
  for (const t of [null, {}, { sell: "h1", buy: "h2" }, { sell: "h1", amount: 0, buy: "h2" }, { sell: "nope", amount: 10, buy: "h2" }, { sell: "h1", amount: 10, buy: "h4" }, { sell: "h1", amount: 10 }]) assert.equal(tryTrade(P0(), t, { today: T }), null, JSON.stringify(t));
  // an amount that shows as $0 is nothing asked (critic M4: 0.001 gave "If you sell $0 of BND ..."); 50 cents shows as $1
  for (const a of [0.001, 0.004, 0.3, 0.49, -5, "", "abc", NaN, null]) { assert.equal(tryTrade(P0(), { sell: "h2", amount: a, buy: "h1" }, { today: T }), null, String(a)); assert.ok(nothingAsked(a), String(a)); }
  assert.equal(tryTrade(P0(), { sell: "h2", amount: 0.5, buy: "h1" }, { today: T }).amount, 0.5);
  assert.equal(tryTrade(P0(), { sell: "h2", amount: 12.345, buy: "h1" }, { today: T }).amount, 12.35, "to the cent");
  assert.ok(!nothingAsked(0.5) && !nothingAsked("10"));
  assert.equal(tryTrade(migrate(emptyPlan()), { sell: "h1", amount: 10, buy: "h2" }, { today: T }), null);
});

test("try a trade: no target of your own: the mix only, no target column", async () => {
  const { heldPlan } = await import("../../../qa/fixtures/held-plan.mjs");
  const p = migrate(heldPlan());
  assert.equal(compute(p, { today: T }).waiting, "pick");
  const r = tryTrade(p, { sell: "h2", amount: 11000, buy: "h1" }, { today: T });
  assert.equal(r.hasTarget, false); assert.equal(r.mixCase, "none"); assert.ok(r.rows.every((x) => x.target === null));
  assert.equal(mixSentence(r), "No target is chosen yet, so this shows your mix only: pick one on Allocation to compare.");
  assert.equal(gainSentence(r), "No tax on this sale: it is inside Ana's 401(k), where selling costs nothing.");
});

test("try a trade: the gain, one sentence per case (Pub. 550: oldest shares first; nothing to count inside a retirement account)", () => {
  // VTI: 200 shares bought 2021-03-10 for $38,000 ($190 each), 100 bought 2026-05-02 for $32,000 ($320 each); $290 today
  const some = tryTrade(P0(), { sell: "h1", amount: 29000, buy: "h2" }, { today: T });
  assert.deepEqual([some.gain.kind, some.gain.gain, some.gain.longGain, some.gain.shortGain], ["lots", 10000, 10000, 0]);
  assert.equal(gainSentence(some), "Selling this makes a taxable gain of $10,000 (held over a year, so it is taxed at the lower long-term rate).");
  assert.deepEqual(gainNotes(some), ["Worked out with the oldest shares first, which is what counts as sold unless you tell the broker otherwise."]);
  // all 300: the old 200 at a $20,000 long-term gain, the 100 bought in May at a $3,000 short-term loss
  const all = tryTrade(P0(), { sell: "h1", all: true, buy: "h2" }, { today: T });
  assert.deepEqual([all.gain.gain, all.gain.longGain, all.gain.shortGain], [17000, 20000, -3000]);
  assert.equal(gainSentence(all), "Selling this makes a taxable gain of $17,000: +$20,000 on shares held over a year (taxed at the lower long-term rate) and −$3,000 on shares held a year or less.");
  // both bought this year: all short-term
  const young = P0(); young.holdings.find((h) => h.id === "h1").lots[0].date = "2026-06-01";
  assert.equal(gainSentence(tryTrade(young, { sell: "h1", all: true, buy: "h2" }, { today: T })), "Selling this makes a taxable gain of $17,000 (held a year or less, so it is taxed like your pay).");
  // a short-term loss, a net loss of both kinds, and none: VTI at $190 sells the old 200 at cost and the May 100 at a loss
  const down = P0(); down.holdings.find((h) => h.id === "h1").price = 190;
  // (the old 200 at no gain are not named: "+$0 on shares held over a year" would say nothing)
  assert.equal(gainSentence(tryTrade(down, { sell: "h1", all: true, buy: "h2" }, { today: T })), "Selling this makes a loss of $13,000, which can lower your tax (held a year or less: a short-term loss).");
  assert.equal(gainSentence(tryTrade(down, { sell: "h1", amount: 19000, buy: "h2" }, { today: T })), "No gain or loss on this sale.");
  // VTI at $250: the old 200 gain $12,000 long-term, the May 100 lose $7,000 short-term: a net gain of $5,000
  const mid = P0(); mid.holdings.find((h) => h.id === "h1").price = 250;
  assert.equal(gainSentence(tryTrade(mid, { sell: "h1", all: true, buy: "h2" }, { today: T })), "Selling this makes a taxable gain of $5,000: +$12,000 on shares held over a year (taxed at the lower long-term rate) and −$7,000 on shares held a year or less.");
  // the two kinds cancelling exactly: the May 100 cost $49,000 ($490 each), so at $290 they lose $20,000 short-term while
  // the old 200 gain $20,000 long-term
  const even2 = P0(); const v2 = even2.holdings.find((h) => h.id === "h1"); v2.lots[1].cost = 49000;
  assert.equal(gainSentence(tryTrade(even2, { sell: "h1", all: true, buy: "h2" }, { today: T })), "Selling this makes no gain or loss overall: +$20,000 on shares held over a year (taxed at the lower long-term rate) and −$20,000 on shares held a year or less.");
  // both lots bought this year (the June lot is now the newer one): the oldest is the May lot, 100 shares at $320 each, so
  // $10,000 at $100 a share sells those 100 for a $22,000 short-term loss
  const youngDown = P0(); youngDown.holdings.find((h) => h.id === "h1").lots[0].date = "2026-06-01"; youngDown.holdings.find((h) => h.id === "h1").price = 100;
  assert.equal(gainSentence(tryTrade(youngDown, { sell: "h1", amount: 10000, buy: "h2" }, { today: T })), "Selling this makes a loss of $22,000, which can lower your tax (held a year or less: a short-term loss).");
  // no purchases on file: the whole holding's gain per dollar, BND: $10,000 x (51,100 - 56,000) / 51,100 = -$958.90
  const bnd = tryTrade(P0(), { sell: "h2", amount: 10000, buy: "h1" }, { today: T });
  assert.deepEqual([bnd.gain.kind, bnd.gain.gain], ["average", -958.9]);
  assert.equal(gainSentence(bnd), "Selling this makes a loss of about $959, from what the whole holding cost; when you bought these shares is not on file, so whether it counts as long- or short-term is not known.");
  assert.deepEqual(gainNotes(bnd), []);
  const cheap = P0(); cheap.holdings.find((h) => h.id === "h2").costBasis = 40000;   // $10,000 x 11,100 / 51,100 = $2,172.21
  assert.equal(gainSentence(tryTrade(cheap, { sell: "h2", amount: 10000, buy: "h1" }, { today: T })), "Selling this makes a taxable gain of about $2,172, from what the whole holding cost; when you bought these shares is not on file, so whether it counts as long- or short-term is not known.");
  const even = P0(); even.holdings.find((h) => h.id === "h2").costBasis = 51100;
  assert.equal(gainSentence(tryTrade(even, { sell: "h2", amount: 10000, buy: "h1" }, { today: T })), "No gain or loss on this sale, from what the whole holding cost.");
  const free = P0(); free.holdings.find((h) => h.id === "h2").costBasis = 0;
  assert.equal(gainSentence(tryTrade(free, { sell: "h2", amount: 10000, buy: "h1" }, { today: T })), "What BND cost is not on file, so the gain is not known: add it on Holdings.");
  const unpriced = P0(); unpriced.holdings.find((h) => h.id === "h2").price = null;
  assert.equal(gainSentence(tryTrade(unpriced, { sell: "h2", amount: 10000, buy: "h1" }, { today: T })), "BND has no price on file, so the gain is not known: add one on Holdings.");
  assert.equal(gainSentence(tryTrade(P0(), { sell: "h3", amount: 5000, buy: "h1" }, { today: T })), "Cash: there is no gain or loss on spending it.");
  assert.equal(gainSentence(tryTrade(P0(), { sell: "h4", amount: 5000, buy: "h5" }, { today: T })), "No tax on this sale: it is inside Sam's 401(k), where selling costs nothing.");
  assert.equal(gainSentence(tryTrade(P0(), { sell: "h8", amount: 5000, buy: "cls:bonds" }, { today: T })), "No tax on this sale: it is inside Sam's Roth, where selling costs nothing.");
  const lost = P0(); lost.holdings.push({ id: "h9", accountId: "gone", symbol: "VXUS", shares: 10, price: 60, costBasis: 500, lots: [] });
  assert.equal(gainSentence(tryTrade(lost, { sell: "h9", amount: 100, buy: "cls:bonds" }, { today: T })), "VXUS is not in an investment account on Net worth, so the tax on a sale is not known.");
});

test("try a trade: the wash-sale rule on a loss, and shares without a purchase date", () => {
  // VTI at $150: the oldest 100 shares ($190 each) sell at a $4,000 loss; 50 more were bought on 2026-11-05, within 30 days:
  // half the loss does not count yet (IRC 1091(a), Tax lots' own rule)
  const p = P0(), v = p.holdings.find((h) => h.id === "h1");
  v.price = 150; v.shares = 350; v.costBasis = 77500; v.lots.push({ id: "l3", date: "2026-11-05", shares: 50, cost: 7500 });
  const r = tryTrade(p, { sell: "h1", amount: 15000, buy: "h2" }, { today: T });
  assert.deepEqual([r.gain.gain, r.gain.longGain, r.gain.disallowed], [-4000, -4000, 2000]);
  assert.equal(gainSentence(r), "Selling this makes a loss of $4,000, which can lower your tax (held over a year: a long-term loss).");
  assert.deepEqual(gainNotes(r), ["Worked out with the oldest shares first, which is what counts as sold unless you tell the broker otherwise.", "$2,000 of this loss does not count yet: you bought more VTI in the last 30 days (the wash-sale rule). It is added to the cost of those shares."]);
  // 100 of VTI's 300 shares in no purchase on file: they count as bought first and long-term (Tax lots' convention)
  const q = P0(); q.holdings.find((h) => h.id === "h1").lots.pop();
  const u = tryTrade(q, { sell: "h1", all: true, buy: "h2" }, { today: T });
  assert.equal(u.gain.undated, true);
  assert.equal(gainNotes(u).at(-1), "Shares without a purchase date count as long-term, as on Tax lots.");
});

test("try a trade: a stray entry among a holding's purchases (an imported or hand-edited file) never breaks the page (critic M2)", () => {
  // VTI's purchases with a null, a word, a number and a list among them: the two real ones are read as before
  const p = P0(); p.holdings.find((h) => h.id === "h1").lots.push(null, "x", 5, []);
  const r = tryTrade(p, { sell: "h1", amount: 29000, buy: "h2" }, { today: T });
  assert.deepEqual([r.gain.kind, r.gain.gain, r.gain.longGain], ["lots", 10000, 10000]);
  // only nulls: no purchase to read, so the whole holding's cost is used
  const q = P0(); const v = q.holdings.find((h) => h.id === "h1"); v.lots = [null];
  const g = tryTrade(q, { sell: "h1", amount: 29000, buy: "h2" }, { today: T }).gain;
  assert.deepEqual([g.kind, g.gain], ["average", Math.round(29000 * (87000 - v.costBasis) / 87000 * 100) / 100]);
  // purchases that are not a list
  for (const bad of [{}, "x", 7]) { const b = P0(); b.holdings.find((h) => h.id === "h1").lots = bad; assert.equal(tryTrade(b, { sell: "h1", amount: 29000, buy: "h2" }, { today: T }).gain.kind, "average", JSON.stringify(bad)); }
  // a null in ANOTHER holding's purchases (Tax lots reads every holding for the wash-sale rule): this sale is still worked out
  const o = P0(); o.holdings.find((h) => h.id === "h2").lots = [null];
  assert.equal(tryTrade(o, { sell: "h1", amount: 29000, buy: "h2" }, { today: T }).gain.gain, 10000);
  // and the plan is not changed by the reading
  const before = JSON.stringify(o); tryTrade(o, { sell: "h1", all: true, buy: "h2" }, { today: T }); assert.equal(JSON.stringify(o), before);
});

test("try a trade: a row's figures, whole percents unless the trade moves less than they show", () => {
  assert.deepEqual(shareTexts(0.2456, 0.2513), ["24.6%", "25.1%"]);
  assert.deepEqual(shareTexts(0.25, 0.25), ["25%", "25%"]);
  assert.deepEqual(shareTexts(0.5833, 0.5503), ["58%", "55%"]);
  near(offTarget({ us_stocks: 0.6, bonds: 0.4 }, { us_stocks: 0.5, bonds: 0.5 }), 0.1);
  near(offTarget({ us_stocks: 1 }, { bonds: 1 }), 1);
});

test("try a trade: trying never changes the plan, and compute() is the same before and after", () => {
  const p = P0(), before = JSON.stringify(p), out = JSON.stringify(compute(p, { today: T }));
  for (const t of [{ sell: "h1", amount: 29000, buy: "h2" }, { sell: "h1", all: true, buy: "cls:cash" }, { sell: "h4", amount: 50000, buy: "h5" }, { sell: "h8", amount: 1, buy: "cls:bonds" }]) tryTrade(p, t, { today: T });
  sellChoices(p, { today: T }); buyChoices(p, "h1", { today: T });
  assert.equal(JSON.stringify(p), before);
  assert.equal(JSON.stringify(compute(p, { today: T })), out);
});

// ---- the page (stand-in DOM) -----------------------------------------------------------------------------------------
async function page(plan, today = T) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  FakeElement.prototype.getBoundingClientRect ??= () => ({ top: 100, bottom: 140 });
  const P = { plan: migrate(structuredClone(plan)), saved: [], root: null };
  // one address for the visit, as the shell draws it again after a save (P.visit() is a new arrival: a new address object)
  P.route = { group: "investments", id: "rebalance", rest: [], query: {} };
  P.visit = () => { P.route = { ...P.route }; return P.draw(); };
  P.draw = () => { P.root = new FakeElement("main"); render(P.root, { ui, fmt: { ...fmt, today: () => today }, plan: P.plan, route: P.route, module: { group: "investments", id: "rebalance" },
    store: { get: () => P.plan, update: (fn) => { const d = structuredClone(P.plan); fn(d); P.saved.push(d); P.plan = d; P.draw(); } }, redraw: P.draw }); return P; };
  P.part = (id) => P.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id);
  P.open = (id) => { const d = P.part(id); d.open = true; d.setAttribute?.("open", ""); d.dispatch("toggle"); return d; };
  P.states = () => P.root.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => [e.dataset.part, e.hasAttribute("open"), e.querySelector(".fold-status")?.textContent ?? ""]);
  P.textOf = textOf;
  P.form = () => P.part("trade").all().find((e) => e.tagName === "FORM");
  P.box = (name) => P.form().querySelector(`[name="${name}"]`);
  P.button = (label, within = P.root) => within.all().find((e) => e.tagName === "BUTTON" && textOf(e) === label);
  return P.draw();
}

test("S11: Try a trade: one quiet row; trying shows the new mix and the gain, saves nothing, keeps the part open; Clear starts over", async () => {
  const P = await page(investmentsPlan());
  assert.deepEqual(P.states(), [["trade", false, "see the new mix"]], "the shut row says what it is for (critic P6)");
  assert.equal(P.textOf(P.part("trade").querySelector(".fold-title")), "Try a trade");
  // the parts card sits after the trades, before the rules of thumb
  const order = P.root.children.map((c) => (c.all?.().some((e) => e.dataset?.part === "trade") ? "trade" : P.textOf(c.querySelector?.("h2") ?? c).slice(0, 20)));
  assert.ok(order.indexOf("trade") === order.length - 2 && /^Rules of thumb/.test(order.at(-1)), order.join(" | "));
  P.open("trade");
  assert.deepEqual(P.form().all().filter((e) => ["INPUT", "SELECT"].includes(e.tagName)).map((e) => e.getAttribute("name")), ["sell", "amount", "all", "buy"]);
  // under Sell, the fund's name and kind (critic P6); the tick beside its words on one line, the box first (critic P4)
  assert.match(P.textOf(P.part("trade")), /Vanguard Total Stock Market ETF: US stocks\. How much .* VTI is worth \$87,000\. Or tick “Sell all of it”\. Sell all of it Buy with it .* In Brokerage: the money from a sale stays in its account\./);
  const tick = P.box("all"), tickLabel = P.form().all().find((e) => e.tagName === "LABEL" && e.all().includes(tick));
  assert.equal(tickLabel.style.flexDirection, "row"); assert.equal(tickLabel.style.minHeight, "44px");
  // "Try this trade" is outlined: the page's one filled button is "Use this amount" (critic P1)
  const submit = P.form().all().find((e) => e.tagName === "BUTTON" && e.getAttribute("type") === "submit");
  assert.equal(P.textOf(submit), "Try this trade"); assert.match(String(submit.className), /\bsecondary\b/);
  assert.deepEqual(P.box("buy").all().filter((e) => e.tagName === "OPTION").map((o) => P.textOf(o)).slice(0, 3), ["BND · Bonds", "SPAXX · Cash", "A US stocks fund"]);
  // another holding to sell: that account's choices, and what was typed is kept; nothing tried, nothing saved
  P.box("amount").value = "50000"; P.box("sell").value = "h4"; P.box("sell").dispatch("change");
  assert.equal(P.box("amount").value, "50,000");
  assert.deepEqual(P.box("buy").all().filter((e) => e.tagName === "OPTION").map((o) => P.textOf(o)).slice(0, 2), ["VFFVX · Stocks and bonds", "A US stocks fund"]);
  assert.match(P.textOf(P.part("trade")), /Fidelity 500 Index: US stocks\. .* In Sam's 401\(k\): the money from a sale stays in its account\./);
  // nothing typed: nothing is tried
  P.box("amount").value = ""; P.form().dispatch("submit");
  assert.ok(!/If you sell/.test(P.textOf(P.part("trade"))));
  // back to VTI, $29,000, BND
  P.box("sell").value = "h1"; P.box("sell").dispatch("change");
  P.box("amount").value = "29000"; P.box("buy").value = "h2"; P.form().dispatch("submit");
  assert.equal(P.saved.length, 0, "trying saves nothing");
  assert.deepEqual(P.states(), [["trade", true, "$29,000 of VTI"]]);
  const t = P.textOf(P.part("trade"));
  // the answer comes first, under its own heading, above the form it came from (critic P3)
  assert.match(t, /^Try a trade \$29,000 of VTI › See what one sale and one buy would do to your mix before you call the broker\. Nothing is saved\. What this trade does If you sell \$29,000 of VTI and buy BND with it: US stocks 58% → 55% target 50% International stocks 25% → 25% target 20% Bonds 8% → 11% target 25% Cash 1% → 1% target 5% Real estate \(REITs\) 8% → 8% target 0%/);
  assert.match(t, /This trade brings your mix closer to your target: 20% of the money is off target now, 17% after\. Selling this makes a taxable gain of \$10,000 \(held over a year, so it is taxed at the lower long-term rate\)\. Worked out with the oldest shares first.* Sell VTI · Brokerage/);
  assert.ok(!/is not in your mix/.test(t));
  assert.equal(P.box("amount").value, "29,000"); assert.equal(P.box("buy").value, "h2");
  // the new-money form saves (the page's own save): the trade part stays as it was, open with its trade
  const nm = P.root.all().find((e) => e.tagName === "FORM" && e.querySelector('[name="newMoney"]'));
  nm.querySelector('[name="newMoney"]').value = "10000"; nm.dispatch("submit");
  assert.equal(P.saved.length, 1); assert.equal(P.plan.investments.newMoney, 10000);
  assert.deepEqual(P.states(), [["trade", true, "$29,000 of VTI"]]);
  assert.equal(P.saved[0].whatIfs?.trade, undefined);
  // Clear: back to an empty form, said in green, still nothing saved
  P.button("Clear", P.part("trade")).dispatch("click");
  assert.deepEqual(P.states(), [["trade", true, "see the new mix"]]);
  assert.match(P.textOf(P.part("trade")), /^Try a trade see the new mix › Cleared\. Nothing was saved\./);
  assert.ok(!/If you sell/.test(P.textOf(P.part("trade"))) && !P.button("Clear", P.part("trade")));
  assert.equal(P.saved.length, 1);
  // the next draw: shut, as the page draws it
  P.draw(); assert.deepEqual(P.states(), [["trade", false, "see the new mix"]]);
});

test("a tried trade lasts for the visit only: a redraw keeps it; leaving and coming back, or another plan, starts over (critic M1)", async () => {
  const P = await page(investmentsPlan());
  P.open("trade");
  P.box("amount").value = "29000"; P.box("buy").value = "h2"; P.form().dispatch("submit");
  assert.deepEqual(P.states(), [["trade", true, "$29,000 of VTI"]]);
  P.draw();    // the shell's redraw after a save elsewhere on the page: the same address, the trade kept
  assert.deepEqual(P.states(), [["trade", true, "$29,000 of VTI"]]);
  P.visit();   // left and came back (a link, the menu, Back): a new address, nothing kept
  assert.deepEqual(P.states(), [["trade", false, "see the new mix"]]);
  P.open("trade");
  assert.ok(!/If you sell|What this trade does/.test(P.textOf(P.part("trade"))) && !P.button("Clear", P.part("trade")));
  // another plan in the same tab with a holding of the same id: the first plan's trade is not tried on it
  P.box("amount").value = "29000"; P.box("buy").value = "h2"; P.form().dispatch("submit");
  assert.deepEqual(P.states(), [["trade", true, "$29,000 of VTI"]]);
  P.plan = migrate({ ...structuredClone(P.plan), meta: { ...P.plan.meta, createdAt: "2026-01-02T00:00:00.000Z" } });
  P.draw();
  assert.deepEqual(P.states(), [["trade", false, "see the new mix"]]);
  assert.equal(P.saved.length, 0);
});

test("try a trade on the page: a tiny amount is nothing asked; an unclassified holding sold says why the mix grows (critic M4, M3)", async () => {
  const P = await page(investmentsPlan());
  P.open("trade");
  P.box("amount").value = "0.3"; P.box("buy").value = "h2"; P.form().dispatch("submit");
  assert.ok(!/If you sell/.test(P.textOf(P.part("trade"))), "nothing tried");
  assert.deepEqual(P.states(), [["trade", true, "see the new mix"]]);
  P.box("sell").value = "h8"; P.box("sell").dispatch("change");
  assert.match(P.textOf(P.part("trade")), /Acme Robotics: no kind set on Holdings, so it is not in your mix\./);
  P.box("amount").value = "1000"; P.box("buy").value = "cls:bonds"; P.form().dispatch("submit");
  assert.match(P.textOf(P.part("trade")), /ACME is not in your mix \(no kind is set for it on Holdings\), so selling it adds \$1,000 to the mix\./);
  assert.equal(P.saved.length, 0);
});

test("try a trade on the page: no target yet, a mix that is a guess, no holdings", async () => {
  const { heldPlan } = await import("../../../qa/fixtures/held-plan.mjs");
  const P = await page(heldPlan());
  assert.match(P.textOf(P.root.querySelector("h1")), /^Pick your mix first$/);
  assert.deepEqual(P.states(), [["trade", false, "see the new mix"]]);
  P.open("trade"); P.box("sell").value = "h2"; P.box("sell").dispatch("change");
  P.box("amount").value = "11000"; P.box("buy").value = "h1"; P.form().dispatch("submit");
  const t = P.textOf(P.part("trade"));
  assert.match(t, /If you sell \$11,000 of FXAIX and buy FFFHX with it:/);
  assert.match(t, /No target is chosen yet, so this shows your mix only: pick one on Allocation to compare\./);
  assert.ok(!/target \d+%/.test(t));
  // the mix is a guess (most of the money not classified): no trade to try
  const g = heldPlan(); g.accounts.find((a) => a.id === "a-brk").balance = 900000;
  assert.equal((await page(g)).states().length, 0);
  // no holdings: the page asks for them first
  assert.equal((await page(emptyPlan())).states().length, 0);
});
