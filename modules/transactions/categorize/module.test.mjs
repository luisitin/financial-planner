import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, buildPrompt, parseSuggestions } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("empty plan: nothing to file, share 1", () => {
  const d = compute(emptyPlan());
  assert.equal(d.groups.length, 0); assert.equal(d.share, 1); assert.equal(d.uncategorised, 0);
});
test("groups the uncategorised by payee, most frequent first, with suggestions from history and rules", () => {
  const p = samplePlan();
  p.rules.push({ id: "r", contains: "netflix", category: "subscriptions" });
  const d = compute(p);
  assert.equal(d.uncategorised, 4); assert.equal(d.done, 12); assert.ok(Math.abs(d.share - 12 / 16) < 1e-9);
  assert.equal(d.groups.length, 4);
  const amazon = d.groups.find((g) => g.payee === "Amazon Mktpl Amzn");
  assert.equal(amazon.count, 1);
  assert.equal(amazon.suggestion.category, "shopping", "the other Amazon line was filed as shopping");
  assert.ok(amazon.suggestion.why.includes("earlier"));
  const netflix = d.groups.find((g) => g.payee === "Netflix");
  assert.equal(netflix.suggestion.category, "subscriptions"); assert.equal(netflix.suggestion.why, "a rule matches");
  // the card's own line for its payment from checking (money in on the Visa): a transfer, or it would count as income (2026-11-02)
  const payment = d.groups.find((g) => g.payee === "Payment Thank You");
  assert.deepEqual([payment.suggestion.category, payment.suggestion.why], ["transfer", "it looks like a payment to the card from your other accounts"]); assert.equal(payment.in, true);
  assert.deepEqual(d.groups.map((g) => g.count), [1, 1, 1, 1]);
  assert.equal(d.groups[0].payee, "Chase Credit Crd Autopay", "ties broken by amount");
});
test("the AI prompt carries only payee names and category ids; answers are checked against the list", () => {
  const p = samplePlan();
  const d = compute(p);
  const pr = buildPrompt(p, d.groups);
  assert.ok(pr.system.includes("JSON"));
  assert.ok(pr.user.includes("groceries: Groceries"));
  assert.ok(pr.user.includes("NETFLIX"));
  assert.ok(!pr.user.includes("15.49"), "no amounts");
  assert.ok(!pr.user.includes("Chase checking"), "no account names");
  assert.ok(!pr.user.includes("transfer:"), "transfer is not offered");
  const got = parseSuggestions(p, 'Sure! [{"payee":"NETFLIX","category":"subscriptions","confidence":0.9},{"payee":"X","category":"not-a-category","confidence":1}]');
  assert.deepEqual(got, { netflix: { category: "subscriptions", confidence: 0.9 } });
  assert.deepEqual(parseSuggestions(p, "no json here"), {});
  assert.deepEqual(parseSuggestions(p, "[not json"), {});
});

test("a first bank file: well-known shops and moves between your own accounts come with a guess, marked as one", async () => {
  const { compute, shopGuess } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 1000 }, { id: "s", name: "Savings", type: "savings", balance: 500 }, { id: "v", name: "Visa", type: "credit", balance: -300 });
  const tx = (id, rawPayee, amount) => ({ id, date: "2026-09-02", amount, payee: rawPayee, rawPayee, accountId: "c", category: "" });
  p.transactions.push(tx("a", "KROGER #0388 DAYTON OH", -54.12), tx("b", "SHELL OIL 57442", -40), tx("c", "Online Transfer to SAV 1234", -500), tx("d", "CHASE CREDIT CRD AUTOPAY", -640.22), tx("e", "SHELLEY JONES", -20), tx("f", "ACME CORP PAYROLL", 2000));
  const by = Object.fromEntries(compute(p).groups.map((g) => [g.rawPayee, g.suggestion]));
  assert.equal(by["KROGER #0388 DAYTON OH"].category, "groceries"); assert.equal(by["KROGER #0388 DAYTON OH"].guess, true);
  assert.equal(by["SHELL OIL 57442"].category, "transport");
  assert.equal(by["Online Transfer to SAV 1234"].category, "transfer");
  assert.equal(by["CHASE CREDIT CRD AUTOPAY"].category, "transfer");
  assert.equal(by["SHELLEY JONES"], null, "whole words only");
  assert.equal(by["ACME CORP PAYROLL"], null);
  assert.equal(shopGuess("NETFLIX.COM"), "subscriptions");
  p.accounts = p.accounts.filter((a) => a.type === "checking");
  assert.equal(compute(p).groups.find((g) => g.rawPayee === "CHASE CREDIT CRD AUTOPAY").suggestion, null, "no card in the plan: not called a transfer");
});
test("review: guesses try the longest name first and leave unclear names alone; loans and people are not transfers; PayPal shops are separate payees", async () => {
  const { shopGuess, transferGuess, compute: cat } = await import("./compute.js");
  assert.equal(shopGuess("UBER EATS"), "dining"); assert.equal(shopGuess("UBER *EATS"), "dining"); assert.equal(shopGuess("UBER *TRIP"), "transport");
  assert.equal(shopGuess("FRONTIER AIRLINES 4221234 DENVER CO"), null); assert.equal(shopGuess("SPECTRUM HEALTH 0042"), null); assert.equal(shopGuess("MARATHON PETRO 123"), null);
  const plan = { accounts: [{ type: "savings" }, { type: "credit" }] };
  assert.equal(transferGuess("NAVY FEDERAL CREDIT UNION LOAN PMT", plan, false), false, "a loan payment is spending");
  assert.equal(transferGuess("ZELLE TO SAVANNAH M", plan, false), false, "a person called Savannah");
  assert.equal(transferGuess("ONLINE TRANSFER TO SAV 1234", plan, false), true);
  assert.equal(transferGuess("CHASE CREDIT CRD AUTOPAY", plan, false), true);
  // money in on a card with a payment's words is the payment arriving; a shop's refund or a reward is not (2026-11-02)
  assert.equal(transferGuess("AUTOMATIC PAYMENT - THANK", plan, true, { onCard: true }), true);
  assert.equal(transferGuess("PAYMENT RECEIVED - THANK YOU", plan, true, { onCard: true }), true);
  assert.equal(transferGuess("AUTOMATIC PAYMENT - THANK", plan, true), false, "on checking, money in like this is not known to be a card's");
  assert.equal(transferGuess("AMAZON.COM RETURN", plan, true, { onCard: true }), false);
  assert.equal(transferGuess("CASH BACK REWARD PAYMENT", plan, true, { onCard: true }), false);
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  p.transactions.push({ id: "1", date: "2026-10-01", amount: -15.49, payee: "PAYPAL *NETFLIX", rawPayee: "PAYPAL *NETFLIX", accountId: "c", category: "" }, { id: "2", date: "2026-10-02", amount: -80, payee: "PAYPAL *EBAY", rawPayee: "PAYPAL *EBAY", accountId: "c", category: "" });
  assert.equal(cat(p).groups.length, 2);
});

// ---------------------------------------------------------------- gap #32 (2026-11-14): the lines flagged to look at later
const G32 = await import("./compute.js");
const flagPlan = () => {
  const p = samplePlan();
  const out = p.transactions.filter((t) => t.category && Number(t.amount) < 0);
  out[0].flag = true; out[1].flag = true; out[1].exclude = true; out[1].note = "ask about this";
  return { p, a: out[0], b: out[1] };
};
test("gap #32 test 3: a flag shows in the inbox, newest first; with none the result is what it was", () => {
  const plain = compute(samplePlan());
  assert.equal("flagged" in plain, false, "the key is absent with nothing flagged");
  const { p, a, b } = flagPlan();
  const d = compute(p);
  assert.equal(d.flagged.length, 2);
  assert.deepEqual(d.flagged.map((f) => f.id).sort(), [a.id, b.id].sort());
  assert.ok(String(d.flagged[0].date) >= String(d.flagged[1].date), "newest first");
  const fb = d.flagged.find((f) => f.id === b.id);
  assert.equal(fb.mark, "left out"); assert.equal(fb.note, "ask about this"); assert.equal(fb.amount, b.amount); assert.ok(fb.categoryLabel);
  assert.equal(d.flagged.find((f) => f.id === a.id).mark, null);
  // a flag changes nothing else
  const { flagged, ...rest } = d;
  assert.deepEqual(rest, plain);
});
test("gap #32: a line left out of the totals waits for no category", () => {
  const p = samplePlan();
  const base = compute(p);
  const open = p.transactions.filter((t) => !t.category);
  open[0].exclude = true; open[1].reimb = true;
  const d = compute(p);
  assert.equal(d.uncategorised, base.uncategorised - 2); assert.equal(d.groups.some((g) => g.ids.includes(open[0].id) || g.ids.includes(open[1].id)), false);
  assert.equal(d.total, base.total);
});
test("gap #32: the words: the status, the green line, and where a flagged line opens", () => {
  assert.equal(G32.flaggedSays(1), "1 line"); assert.equal(G32.flaggedSays(3), "3 lines");
  assert.equal(G32.unflagSaid({ payee: "Corner cafe", date: "2026-11-03" }), "The flag is off Corner cafe, 11/3.");
  assert.equal(G32.unflagSaid({}), "The flag is off that line.");
  // critic P3: "Open it" names the line itself, not a search for its payee
  assert.equal(G32.flaggedHref({ id: "t7", payee: "Corner cafe", date: "2026-11-03" }), "#/transactions/ledger/month/2026-11?edit=t7");
  assert.equal(G32.flaggedHref({ id: "t 8", payee: "X" }), "#/transactions/ledger/all?edit=t%208");
});
test("S11, gap #32 on the page: after a save only the saved part changes; the flagged lines are one quiet tap away, shut; taking a flag off writes only that, confirms itself and keeps the part open", async () => {
  // the page as the shell draws it, on the stand-in document: the real kit, the AI helper off, store.update recorded
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"), fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const draw = async (plan) => {
    const p = migrate(structuredClone(plan)), saved = [], root = new FakeElement("main");
    render(root, { ui, fmt: { ...fmt, today: () => "2026-11-14" }, plan: p, route: { rest: [] }, view: {}, live: {}, ai: { status: async () => "off", health: async () => ({ st: "off" }) },
      store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } } });
    await new Promise((res) => setTimeout(res, 0));
    return { root, saved };
  };
  // nothing flagged: no part at all
  const plain = await draw(samplePlan());
  assert.equal(plain.root.querySelectorAll("details").some((x) => /Flagged/.test(textOf(x))), false);
  const { p, a } = flagPlan();
  const r = await draw(p);
  const fold = r.root.querySelectorAll("details").find((x) => /Flagged to look at later/.test(textOf(x.querySelector("summary"))));
  assert.ok(fold, "the part is drawn"); assert.equal(fold.hasAttribute("open"), false, "shut by default");
  assert.match(textOf(fold.querySelector("summary")), /2 lines/);
  assert.match(textOf(fold), /ask about this/); assert.match(textOf(fold), /left out/);
  assert.ok(fold.querySelectorAll("button").every((b) => /secondary/.test(b.getAttribute("class") ?? "")), "no filled button inside");
  assert.ok(fold.querySelectorAll("a").some((l) => l.getAttribute("href") === `#/transactions/ledger/month/${String(a.date).slice(0, 7)}?edit=${a.id}`));
  const row = fold.querySelectorAll("li").find((l) => textOf(l).includes(a.payee));
  row.querySelectorAll("button").find((b) => textOf(b) === "Take the flag off").click();
  assert.equal(r.saved.length, 1);
  assert.equal("flag" in r.saved[0].transactions.find((t) => t.id === a.id), false);
  const strip = (plan) => JSON.stringify(plan.transactions.map(({ flag, ...t }) => t));
  assert.equal(strip(r.saved[0]), strip((await import("../../../core/schema/migrate.js")).migrate(structuredClone(p))), "nothing else changed");
  const r2 = await draw(r.saved[0]);
  assert.ok(r2.root.querySelectorAll(".notice.ok").some((n) => /^The flag is off /.test(textOf(n))));
  const fold2 = r2.root.querySelectorAll("details").find((x) => /Flagged to look at later/.test(textOf(x.querySelector("summary"))));
  assert.equal(fold2.hasAttribute("open"), true, "the part just used stays open"); assert.match(textOf(fold2.querySelector("summary")), /1 line/);
  // and shut again on the draw after
  const fold3 = (await draw(r.saved[0])).root.querySelectorAll("details").find((x) => /Flagged to look at later/.test(textOf(x.querySelector("summary"))));
  assert.equal(fold3.hasAttribute("open"), false);
});
