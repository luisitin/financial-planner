import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compute, groupsFor, batches, promptFor, readAnswer, readConfidence, review, applyChoices, band, keyOf, lostWord, cleanText, aiText,
  misfit, needsLook, replaces, BATCH, BANDS, GUARD,
} from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { applyRules } from "../../transactions/rules/compute.js";

// the sample plan: Netflix, the card autopay, the card's "Payment Thank You" and one Amazon charge have no category;
// two transfers are linked; Kroger, rent, payroll and Shell are filed
const tx = (id, payee, amount, category = "", extra = {}) => ({ id, accountId: "chk", date: "2026-09-01", amount, payee, rawPayee: payee, category, tags: [], note: "", ...extra });
const planWith = (...txs) => { const p = emptyPlan(); p.transactions.push(...txs); return p; };
const nextImport = (p, payee, amount = -10, accountId = "chk") => applyRules(p.rules, [{ id: "n1", accountId, payee, amount, category: "" }]).txs[0].category;
const opts = (extra = {}) => { let n = 0; return { uid: () => `r${++n}`, today: "2026-10-31", ...extra }; };

test("the payees to ask about: not filed yet, or every payee; transfers left out; one group per payee, most first", () => {
  const p = samplePlan();
  const open = groupsFor(p, "open");
  assert.deepEqual(open.map((g) => g.payee).sort(), ["Amazon Mktpl Amzn", "Chase Credit Crd Autopay", "Netflix", "Payment Thank You"]);
  assert.ok(open.every((g) => g.filed === "" && g.count === 1));
  const all = groupsFor(p, "all");
  assert.ok(!all.some((g) => /transfer/i.test(g.payee)), "linked transfers are not asked about");
  const kroger = all.find((g) => g.payee === "Kroger");
  assert.equal(kroger.count, 3); assert.equal(kroger.filed, "groceries"); assert.equal(kroger.mixed, false); assert.equal(kroger.in, false);
  assert.deepEqual(kroger.byCat, { groceries: 3 });
  assert.ok(Math.abs(kroger.total - (-86.40 - 54.12 - 60)) < 1e-9);
  const amazon = all.find((g) => g.payee === "Amazon Mktpl Amzn");
  assert.equal(amazon.count, 2); assert.equal(amazon.filed, "shopping"); assert.equal(amazon.mixed, true, "one filed, one not");
  assert.equal(amazon.unfiled, 1); assert.equal(amazon.ways, 1); assert.equal(kroger.unfiled, 0); assert.equal(kroger.ways, 1);
  assert.deepEqual(amazon.byCat, { shopping: 1 });
  const pay = all.find((g) => /payroll/i.test(g.payee));
  assert.equal(pay.in, true); assert.equal(all[0], pay, "payroll and Kroger have 3 each; the larger total first");
  assert.equal(keyOf({ rawPayee: "AMAZON MKTPL*2K3 09/01", payee: "x" }), keyOf({ rawPayee: "Amazon Mktpl", payee: "y" }), "card codes and dates do not split a payee");
  const d = compute(p);
  assert.equal(d.total, 16); assert.equal(d.transfers, 2); assert.equal(d.open, 4);
  assert.deepEqual(d.scopes, { open: 4, all: all.length }); assert.deepEqual(d.questions, { open: 1, all: 1 });
  assert.deepEqual(compute(emptyPlan()), { total: 0, transfers: 0, open: 0, scopes: { open: 0, all: 0 }, questions: { open: 0, all: 0 } });
});

test("transfers are what the ledger counts: linked, filed as transfer, or a category of the transfer kind", () => {
  const p = samplePlan();
  p.categories = [{ id: "card-pay", label: "Card paid off", icon: "💳", kind: "transfer" }];
  p.transactions.find((t) => t.id === "t9").category = "card-pay";    // custom transfer kind, not linked
  p.transactions.find((t) => t.id === "t10").category = "transfer";   // the built-in one, not linked
  const all = groupsFor(p, "all");
  assert.ok(!all.some((g) => g.key === "chase crd" || g.key === "thank you"), "neither is asked about");
  const d = compute(p);
  assert.equal(d.transfers, 4); assert.equal(d.open, 2, "Netflix and one Amazon");
  assert.deepEqual(groupsFor(p, "open").map((g) => g.key).sort(), ["amazon mktpl amzn", "netflix"]);
});

test("a payee paid through a service keeps its shop: PayPal ones split, Amazon codes still merge", () => {
  assert.equal(keyOf({ rawPayee: "PAYPAL *SPOTIFY" }), "paypal spotify");
  assert.equal(keyOf({ rawPayee: "PAYPAL *EBAY INC" }), "paypal ebay inc");
  assert.equal(keyOf({ rawPayee: "SQ *BLUE BOTTLE COFFEE" }), "sq blue bottle coffee");
  assert.equal(keyOf({ rawPayee: "AMZN MKTP*2K3 09/01" }), keyOf({ rawPayee: "AMZN MKTP*7Q9AB1" }), "store codes with a digit are still codes");
  assert.equal(lostWord("PAYPAL *SPOTIFY"), "spotify"); assert.equal(lostWord("AMZN MKTP*2K3"), ""); assert.equal(lostWord("KROGER #0421"), "");
  const p = planWith(tx("a", "PAYPAL *SPOTIFY", -11.99), tx("b", "PAYPAL *EBAY INC", -25), tx("c", "PAYPAL *SPOTIFY", -11.99));
  const g = groupsFor(p, "open");
  assert.deepEqual(g.map((x) => [x.key, x.count]), [["paypal spotify", 2], ["paypal ebay inc", 1]]);
});

test("what the AI is sent: cleaned bank text (no digits, codes or odd punctuation), at most 60 characters, and a guard", () => {
  assert.equal(cleanText("PURCHASE AUTHORIZED ON 08/31 KROGER #0421 DAYTON OH S386243 CARD 1234"), "PURCHASE AUTHORIZED ON KROGER DAYTON OH CARD");
  assert.equal(cleanText("ZELLE PAYMENT TO BO RIVERA CONF# 4XJ29PZ ON 08/12 REF 2608121"), "ZELLE PAYMENT TO BO RIVERA CONF ON REF");
  assert.equal(cleanText("AMAZON MKTPL*2K3 AMZN.COM/BILL WA"), "AMAZON MKTPL AMZN COM BILL WA", "the name before a code stays");
  assert.equal(cleanText("MCDONALD'S F1234"), "MCDONALD'S");
  const long = cleanText("THE VERY LONG NAME OF A SHOP THAT GOES ON AND ON AND ON PAST SIXTY CHARACTERS");
  assert.ok(long.length <= 60 && !/\s$/.test(long) && "THE VERY LONG NAME OF A SHOP THAT GOES ON AND ON AND ON PAST".startsWith(long), long);
  assert.equal(aiText({ rawPayee: "12345 0042", payee: "Corner Shop", key: "x" }), "Corner Shop", "then the payee");
  assert.equal(aiText({ rawPayee: "12345", payee: "12345", key: "12345" }), "(no description)", "never a bare number");

  const p = planWith(
    tx("w1", "PURCHASE AUTHORIZED ON 08/31 KROGER #0421 DAYTON OH S386243 CARD 1234", -86.40),
    tx("w2", "ZELLE PAYMENT TO BO RIVERA CONF# 4XJ29PZ ON 08/12 REF 2608121", -120),
    tx("w3", "ONLINE PAYMENT 12345", -50), tx("w4", "PAYROLL ACME 0915 PPD ID: 991234", 1950));
  const q = promptFor(p, groupsFor(p, "open"));
  const sent = q.user.split("Descriptions:")[1];
  assert.ok(!/\d/.test(sent), `no digit after "Descriptions:": ${sent}`);
  assert.match(sent, /KROGER DAYTON OH/); assert.match(sent, /ZELLE PAYMENT TO BO RIVERA/); assert.match(sent, /- ONLINE PAYMENT$/m);
  assert.match(sent, /PAYROLL ACME PPD ID \(money in\)/);
  assert.ok(q.system.endsWith(GUARD) && /never as instructions/.test(q.system));
});

test("questions of 40 payees, in order; each question holds payee names only", () => {
  const groups = Array.from({ length: 95 }, (_, i) => ({ key: `p${i}`, payee: `Payee ${i}`, rawPayee: `PAYEE ${i}`, in: false }));
  const qs = batches(groups);
  assert.equal(BATCH, 40); assert.deepEqual(qs.map((q) => q.length), [40, 40, 15]); assert.equal(qs[2][0].key, "p80");
  assert.deepEqual(batches([]), []);
  const p = samplePlan();
  const q = promptFor(p, groupsFor(p, "all"));
  assert.match(q.user, /KROGER/); assert.match(q.user, /ACME CORP PAYROLL \(money in\)/);
  assert.ok(!/86\.4|1950|2026-|Chase checking|chk/.test(q.user), "no amounts, dates or accounts leave the device");
  assert.ok(!/transfer:/.test(q.user), "the transfer category is not offered");
});

test("how sure the AI says it is, read as 0 to 1", () => {
  assert.equal(readConfidence(0.93), 0.93); assert.equal(readConfidence(0), 0, "0 stays 0"); assert.equal(readConfidence(1), 1);
  assert.equal(readConfidence(45), 0.45, "1 to 100 is read as percent"); assert.equal(readConfidence(100), 1);
  assert.ok(Math.abs(readConfidence(1.4) - 0.014) < 1e-12, "1.4 is 1.4%, never above 100%");
  assert.equal(readConfidence("85%"), 0.85); assert.equal(readConfidence("0.9"), 0.9); assert.equal(readConfidence("150%"), 0.5);
  assert.equal(readConfidence(-0.2), 0); assert.equal(readConfidence(500), 0.5, "above 100: no usable figure");
  for (const v of [undefined, null, "", "  ", "very", true, NaN]) assert.equal(readConfidence(v), 0.5, String(v));
});

test("the answer read back: only this batch's payees, only offered categories, the first answer per payee", () => {
  const p = samplePlan();
  const batch = groupsFor(p, "open");   // NETFLIX, CHASE CREDIT CRD AUTOPAY, PAYMENT THANK YOU, AMAZON MKTPL AMZN
  const text = 'Here you go: [{"payee":"NETFLIX","category":"subscriptions","confidence":0.93},{"payee":"PAYMENT THANK YOU","category":"debt","confidence":45},'
    + '{"payee":"amazon  mktpl amzn","category":"shopping","confidence":"85%"},{"payee":"CHASE CREDIT CRD AUTOPAY","category":"transfer","confidence":0.9},'
    + '{"payee":"KROGER","category":"groceries","confidence":0.9},{"payee":"NETFLIX","category":"shopping","confidence":1}]';
  const a = readAnswer(p, text, batch);
  assert.deepEqual(Object.keys(a).sort(), ["amazon mktpl amzn", "netflix", "thank you"], "keyed by group; Kroger was not asked; transfer is not offered");
  assert.deepEqual(a.netflix, { category: "subscriptions", confidence: 0.93, fits: true }, "the first answer wins");
  assert.equal(a["thank you"].confidence, 0.45); assert.equal(a["thank you"].fits, false, "money in, a spending category");
  assert.equal(a["amazon mktpl amzn"].confidence, 0.85);
  assert.deepEqual(readAnswer(p, "sorry, I cannot", batch), {}); assert.deepEqual(readAnswer(p, "[not json", batch), {});
  assert.deepEqual(readAnswer(p, text, []), {}, "nothing asked, nothing kept");
  // an echo that is not exact still maps through the payee key
  assert.equal(readAnswer(p, '[{"payee":"Netflix.com","category":"subscriptions","confidence":0.8}]', batch).netflix.category, "subscriptions");
  // other categories: unknown and hidden ones are dropped; "other" is kept but does not fit
  p.categories = [{ id: "subscriptions", hidden: true }];
  assert.deepEqual(readAnswer(p, '[{"payee":"NETFLIX","category":"subscriptions"},{"payee":"PAYMENT THANK YOU","category":"nope"}]', batch), {});
  assert.deepEqual(readAnswer(p, '[{"payee":"NETFLIX","category":"other","confidence":0}]', batch), { netflix: { category: "other", confidence: 0, fits: false } });
  // money going out answered with an income category
  assert.equal(readAnswer(p, '[{"payee":"NETFLIX","category":"income-salary","confidence":0.99}]', batch).netflix.fits, false);
});

test("the answer read back: prose around it, a reply cut off, a payee with no name left, shared texts, and a cap", () => {
  const p = samplePlan();
  const batch = groupsFor(p, "open");
  const prose = '[{"payee":"NETFLIX","category":"subscriptions","confidence":0.9}] I hope this helps [1].';
  assert.deepEqual(Object.keys(readAnswer(p, prose, batch)), ["netflix"], "a stray bracket after the list");
  const cut = '[{"payee":"NETFLIX","category":"subscriptions","confidence":0.9},{"payee":"AMAZON MKTPL AMZN","category":"shopp';
  assert.deepEqual(Object.keys(readAnswer(p, cut, batch)), ["netflix"], "a reply cut off keeps what came before");
  // bank text that is all noise words and digits: the key falls back, the text sent is "ONLINE PAYMENT"
  const q = planWith(tx("o1", "ONLINE PAYMENT 12345", -50), tx("o2", "(no description)", -9));
  const qb = groupsFor(q, "open");
  const qa = readAnswer(q, '[{"payee":"ONLINE PAYMENT","category":"debt","confidence":0.7},{"payee":"no description","category":"other","confidence":0.2}]', qb);
  assert.deepEqual(Object.keys(qa).sort(), ["no description", "online payment 12345"]);
  // two groups sent as the same text: an answer for it counts for neither
  const two = planWith(tx("s1", "ONLINE PAYMENT 12345", -50), tx("s2", "ONLINE PAYMENT 67890", -60));
  const tb = groupsFor(two, "open");
  assert.equal(tb.length, 2);
  assert.deepEqual(readAnswer(two, '[{"payee":"ONLINE PAYMENT","category":"debt","confidence":0.7}]', tb), {});
  // at most 2 items per payee asked are read
  const one = batch.filter((g) => g.key === "netflix");
  const many = '[{"payee":"KROGER","category":"groceries"},{"payee":"SHELL OIL","category":"transport"},{"payee":"NETFLIX","category":"subscriptions"}]';
  assert.deepEqual(readAnswer(p, many, one), {});
});

test("how sure, in words: 80% or more sure, 50% or more fairly sure, else unsure", () => {
  assert.deepEqual(BANDS, { sure: 0.8, fairly: 0.5 });
  assert.equal(band(0.8), "sure"); assert.equal(band(0.79), "fairly"); assert.equal(band(0.5), "fairly"); assert.equal(band(0.49), "unsure"); assert.equal(band(0), "unsure");
});

test("whether a category fits the money", () => {
  const p = samplePlan();
  assert.equal(misfit(p, "groceries", false), ""); assert.equal(misfit(p, "income-salary", true), "");
  assert.equal(misfit(p, "income-salary", false), "income-out"); assert.equal(misfit(p, "groceries", true), "spending-in");
  assert.equal(misfit(p, "other", false), "other"); assert.equal(misfit(p, "income-other", true), "other");
});

test("the review: changes first and surest first, agreements last; the summary counts each kind", () => {
  const p = samplePlan();
  const all = groupsFor(p, "all");
  const answers = {
    kroger: { category: "groceries", confidence: 0.95 },          // agrees
    "shell oil": { category: "dining", confidence: 0.6 },          // the AI would choose differently
    netflix: { category: "subscriptions", confidence: 0.9 },       // new, sure, fits
    "thank you": { category: "debt", confidence: 0.3 },            // new, unsure, does not fit (money in)
    "amazon mktpl amzn": { category: "shopping", confidence: 0.85 },   // filed the AI's way, one not filed yet
  };
  const r = review(p, all, answers);
  assert.deepEqual(r.rows.map((x) => x.key), ["netflix", "amazon mktpl amzn", "shell oil", "thank you", "kroger"]);
  const row = (k) => r.rows.find((x) => x.key === k);
  assert.equal(row("kroger").agrees, true); assert.equal(row("kroger").isNew, false); assert.equal(row("kroger").band, "sure"); assert.equal(row("kroger").label, "Groceries");
  assert.equal(row("shell oil").agrees, false); assert.equal(row("shell oil").fillsIn, false);
  assert.equal(row("amazon mktpl amzn").agrees, false, "mixed: filing would change one of them"); assert.equal(row("amazon mktpl amzn").fillsIn, true);
  assert.equal(row("thank you").fits, false); assert.equal(row("thank you").why, "spending-in"); assert.equal(row("netflix").fits, true);
  assert.deepEqual(r.summary, { asked: all.length, answered: 5, unanswered: all.length - 5, sure: 3, fairly: 1, unsure: 1, isNew: 2, differ: 1, partly: 1, agree: 1, sureNew: 1, look: 3 });
  assert.deepEqual(r.rows.filter(needsLook).map((x) => x.key), ["amazon mktpl amzn", "shell oil", "thank you"], "a sure answer for a payee not filed is left to the one tap");
  assert.deepEqual(review(p, all, {}).rows, []);
  // a sure answer that does not fit the money is never in the one tap, and needs a look
  const wrong = review(p, all, { netflix: { category: "income-salary", confidence: 0.99 } });
  assert.equal(wrong.summary.sureNew, 0); assert.equal(needsLook(wrong.rows[0]), true);
  // answers whose category is no longer offered are left out
  p.categories = [{ id: "subscriptions", hidden: true }];
  assert.deepEqual(review(p, all, { netflix: answers.netflix, kroger: { category: "transfer", confidence: 1 } }).rows, []);
});

test("which rows replace what is filed, and the name filing gives", () => {
  const p = samplePlan();
  const r = review(p, groupsFor(p, "all"), { "shell oil": { category: "dining", confidence: 0.6 }, "amazon mktpl amzn": { category: "shopping", confidence: 0.9 }, netflix: { category: "subscriptions", confidence: 0.9 } });
  const row = (k) => r.rows.find((x) => x.key === k);
  assert.equal(replaces(row("shell oil"), "dining"), true); assert.equal(replaces(row("shell oil"), "transport"), false);
  assert.equal(replaces(row("amazon mktpl amzn"), "shopping"), false, "files the rest the same way");
  assert.equal(replaces(row("netflix"), "subscriptions"), false);
  assert.equal(replaces({ isNew: false, filed: "groceries", ways: 2 }, "groceries"), true, "filed two ways: one of them changes");
  assert.equal(row("netflix").rename, null, "already its tidy name");
  const q = planWith(tx("a", "AMAZON MKTPL*2K3 AMZN.COM/BILL WA", -20), tx("b", "Corner shop", -5, "", { rawPayee: "SQ CORNER SHOP 0042" }));
  const rq = review(q, groupsFor(q, "open"), { "amazon mktpl amzn wa": { category: "shopping", confidence: 0.9 }, "sq corner shop": { category: "groceries", confidence: 0.9 } });
  assert.equal(rq.rows.find((x) => x.key === "amazon mktpl amzn wa").rename, "Amazon Mktpl Amzn");
  assert.equal(rq.rows.find((x) => x.key === "sq corner shop").rename, null, "a name the person typed stays");
});

test("filing: the category on every transaction of the payee, its clean name, and one rule per payee for future imports", () => {
  const p = samplePlan();
  const open = groupsFor(p, "open");
  const netflix = open.find((g) => g.payee === "Netflix");
  const res = applyChoices(p, [{ key: "netflix", ids: netflix.ids, rawPayee: netflix.rawPayee, category: "subscriptions" }, { key: "chase crd", ids: ["t9"], rawPayee: "CHASE CREDIT CRD AUTOPAY", category: "nope" }], opts());
  assert.deepEqual(res, { transactions: 1, payees: 1, overwritten: 0, skipped: 0, unknown: 1, rules: 1, rulesAdded: 1, rulesChanged: [], rulesKept: 0, rulesSkipped: 0, filedKeys: ["netflix"] }, "a category the plan does not know is skipped");
  const t6 = p.transactions.find((t) => t.id === "t6");
  assert.equal(t6.category, "subscriptions"); assert.equal(t6.rawPayee, "NETFLIX"); assert.equal(t6.payee, "Netflix");
  assert.equal(p.transactions.find((t) => t.id === "t9").category, "", "untouched");
  assert.deepEqual(p.rules, [{ id: "r1", contains: "netflix", category: "subscriptions", payee: "Netflix", direction: "any", hits: 1, createdAt: "2026-10-31" }]);
  assert.equal(nextImport(p, "NETFLIX.COM 10/05", -15.49), "subscriptions", "next month's import files itself");
  // the same payee filed again the same way: hits; another way: the rule follows the new choice, and says so
  const again = applyChoices(p, [{ key: "netflix", ids: ["t6"], rawPayee: "NETFLIX", category: "subscriptions" }], opts());
  assert.equal(again.transactions, 0); assert.equal(again.rules, 1); assert.equal(again.rulesAdded, 0); assert.equal(p.rules[0].hits, 2); assert.equal(p.rules.length, 1);
  const changed = applyChoices(p, [{ key: "netflix", ids: ["t6"], rawPayee: "NETFLIX", category: "shopping" }], opts());
  assert.equal(changed.transactions, 1); assert.equal(changed.overwritten, 1);
  assert.deepEqual(changed.rulesChanged, [{ contains: "netflix", from: "subscriptions", to: "shopping" }]);
  assert.equal(p.rules[0].category, "shopping"); assert.equal(p.rules.length, 1); assert.equal(nextImport(p, "NETFLIX.COM 11/05"), "shopping");
  assert.equal(applyChoices(p, [], {}).payees, 0);
  // a card payment filed as a transfer between my own accounts
  const card = applyChoices(p, [{ key: "chase crd", ids: ["t9"], rawPayee: "CHASE CREDIT CRD AUTOPAY", category: "transfer" }], opts());
  assert.equal(card.transactions, 1); assert.equal(p.transactions.find((t) => t.id === "t9").category, "transfer");
  assert.ok(!groupsFor(p, "all").some((g) => g.key === "chase crd"), "now a transfer, so no longer asked about");
  // transfers in the list are never touched
  const tr = applyChoices(p, [{ key: "x", ids: ["t7"], rawPayee: "ONLINE TRANSFER TO SAV", category: "shopping" }], opts());
  assert.equal(tr.payees, 0); assert.equal(p.transactions.find((t) => t.id === "t7").category, "transfer");
});

test("rechecking what is filed: filing a payee filed several ways sets them all, counts what changed and what it overwrote", () => {
  const p = samplePlan();
  const amazon = groupsFor(p, "all").find((g) => g.payee === "Amazon Mktpl Amzn");
  const res = applyChoices(p, [{ key: amazon.key, ids: amazon.ids, rawPayee: amazon.rawPayee, category: "shopping" }], opts());
  assert.equal(res.transactions, 1, "t11 was already shopping, t12 was not filed"); assert.equal(res.overwritten, 0);
  assert.deepEqual(p.transactions.filter((t) => amazon.ids.includes(t.id)).map((t) => t.category), ["shopping", "shopping"]);
  assert.equal(p.rules[0].hits, 2);
  const q = samplePlan();
  q.transactions.find((t) => t.id === "t5").category = "dining";
  q.transactions.find((t) => t.id === "t16").category = "shopping";
  const kroger = groupsFor(q, "all").find((g) => g.key === "kroger");
  assert.equal(kroger.ways, 3); assert.deepEqual(kroger.byCat, { groceries: 1, dining: 1, shopping: 1 });
  const k = applyChoices(q, [{ key: "kroger", ids: kroger.ids, rawPayee: kroger.rawPayee, category: "groceries" }], opts());
  assert.equal(k.transactions, 2); assert.equal(k.overwritten, 2);
});

test("filing against the rules already there: other capitals, an account, a direction, an earlier broader rule", () => {
  const file = (p, key, category, o = {}) => { const g = groupsFor(p, "all").find((x) => x.key === key); return applyChoices(p, [{ key, ids: g.ids, rawPayee: g.rawPayee, category }], opts(o)); };
  // the same text in other capitals is the same rule: changed, not doubled
  let p = samplePlan(); p.rules = [{ id: "old", contains: "Netflix", category: "shopping", direction: "any", hits: 3 }];
  let res = file(p, "netflix", "subscriptions");
  assert.equal(p.rules.length, 1); assert.deepEqual(res.rulesChanged, [{ contains: "Netflix", from: "shopping", to: "subscriptions" }]);
  assert.equal(nextImport(p, "NETFLIX.COM 10/05"), "subscriptions");
  // a rule for one account, or for money going out, is left as it is, and the new rule goes before it
  for (const extra of [{ accountId: "chk" }, { direction: "out" }]) {
    p = samplePlan(); p.rules = [{ id: "old", contains: "netflix", category: "shopping", ...extra, hits: 0 }];
    res = file(p, "netflix", "subscriptions");
    assert.equal(res.rulesAdded, 1); assert.equal(p.rules[0].id, "r1", JSON.stringify(extra)); assert.equal(p.rules[1].category, "shopping");
    assert.equal(nextImport(p, "NETFLIX.COM 10/05", -15.49, "chk"), "subscriptions", JSON.stringify(extra));
  }
  // an earlier, broader rule with another category would still win: the new rule moves just before it
  p = samplePlan(); p.rules = [{ id: "keep", contains: "kroger", category: "groceries" }, { id: "broad", contains: "amazon", category: "giving" }];
  res = file(p, "amazon mktpl amzn", "shopping");
  assert.deepEqual(p.rules.map((r) => r.id), ["keep", "r1", "broad"]);
  assert.equal(nextImport(p, "AMAZON MKTPL*9Z1 AMZN.COM/BILL WA"), "shopping"); assert.equal(nextImport(p, "AMAZON PRIME VIDEO"), "giving");
  // a same-text rule keeps the name it gives
  p = samplePlan(); p.rules = [{ id: "old", contains: "netflix", category: "shopping", payee: "Streaming" }];
  file(p, "netflix", "subscriptions");
  assert.equal(p.rules[0].payee, "Streaming"); assert.equal(p.transactions.find((t) => t.id === "t6").payee, "Streaming");
});

test("two payees whose first three words match get a rule each, in either order", () => {
  for (const order of [["NETFLIX", "EBAY"], ["EBAY", "NETFLIX"]]) {
    const p = planWith(tx("a", "PAYPAL INST XFER NETFLIX", -15), tx("b", "PAYPAL INST XFER EBAY", -40));
    const groups = groupsFor(p, "open");
    const cat = { NETFLIX: "subscriptions", EBAY: "shopping" };
    const choices = order.map((w) => { const g = groups.find((x) => x.rawPayee.endsWith(w)); return { key: g.key, ids: g.ids, rawPayee: g.rawPayee, category: cat[w] }; });
    const res = applyChoices(p, choices, opts());
    assert.equal(res.rulesChanged.length, 0, order.join()); assert.equal(res.rulesAdded, 2); assert.equal(res.rules, 2);
    assert.equal(nextImport(p, "PAYPAL INST XFER NETFLIX"), "subscriptions", order.join());
    assert.equal(nextImport(p, "PAYPAL INST XFER EBAY"), "shopping", order.join());
  }
});

test("one tap: the person's rules are kept, and transactions filed meanwhile are left alone", () => {
  let p = samplePlan(); p.rules = [{ id: "mine", contains: "netflix", category: "shopping" }];
  let res = applyChoices(p, [{ key: "netflix", ids: ["t6"], rawPayee: "NETFLIX", category: "subscriptions" }], opts({ keepRules: true, onlyUnfiled: true }));
  assert.equal(res.transactions, 1); assert.equal(res.rulesKept, 1); assert.equal(res.rules, 0); assert.deepEqual(res.rulesChanged, []);
  assert.deepEqual(p.rules, [{ id: "mine", contains: "netflix", category: "shopping" }]);
  p = samplePlan(); p.rules = [{ id: "broad", contains: "amazon", category: "giving" }];
  res = applyChoices(p, [{ key: "amazon mktpl amzn", ids: ["t12"], rawPayee: "AMAZON MKTPL AMZN", category: "shopping" }], opts({ keepRules: true }));
  assert.equal(res.rulesKept, 1); assert.equal(p.rules.length, 1, "no rule that would never be used");
  // filed meanwhile
  p = samplePlan();
  res = applyChoices(p, [{ key: "amazon mktpl amzn", ids: ["t11", "t12"], rawPayee: "AMAZON MKTPL AMZN", category: "giving" }], opts({ onlyUnfiled: true }));
  assert.equal(res.skipped, 1); assert.equal(res.transactions, 1);
  assert.equal(p.transactions.find((t) => t.id === "t11").category, "shopping"); assert.equal(p.transactions.find((t) => t.id === "t12").category, "giving");
  p = samplePlan(); p.transactions.find((t) => t.id === "t6").category = "giving";
  res = applyChoices(p, [{ key: "netflix", ids: ["t6"], rawPayee: "NETFLIX", category: "subscriptions" }], opts({ onlyUnfiled: true }));
  assert.equal(res.payees, 0); assert.equal(res.skipped, 1); assert.deepEqual(res.filedKeys, ["netflix"]); assert.equal(p.rules.length, 0);
});

test("names: a name the person typed survives filing; the bank's own text is tidied", () => {
  const p = samplePlan();
  p.transactions.find((t) => t.id === "t6").payee = "My streaming";
  applyChoices(p, [{ key: "netflix", ids: ["t6"], rawPayee: "NETFLIX", category: "subscriptions" }], opts());
  const t6 = p.transactions.find((t) => t.id === "t6");
  assert.equal(t6.payee, "My streaming"); assert.equal(t6.rawPayee, "NETFLIX"); assert.equal(t6.category, "subscriptions");
  const q = planWith(tx("a", "AMAZON MKTPL*2K3 AMZN.COM/BILL WA", -20), tx("b", "(no description)", -5, "", { rawPayee: "POS 0042 0917" }));
  applyChoices(q, [{ key: "k", ids: ["a"], rawPayee: "AMAZON MKTPL*2K3 AMZN.COM/BILL WA", category: "shopping" }, { key: "n", ids: ["b"], rawPayee: "POS 0042 0917", category: "other" }], opts());
  assert.equal(q.transactions[0].payee, "Amazon Mktpl Amzn");
  assert.equal(q.transactions[1].payee, "POS 0042 0917", "the importer's \"(no description)\" gives way to the bank's text");
});

test("a payee paid through PayPal is filed with its shop's name, and no rule that would catch every PayPal payment", () => {
  const p = planWith(tx("a", "PAYPAL *SPOTIFY", -11.99), tx("b", "PAYPAL *EBAY INC", -25));
  const [spotify] = groupsFor(p, "open").filter((g) => g.key === "paypal spotify");
  const res = applyChoices(p, [{ key: spotify.key, ids: spotify.ids, rawPayee: spotify.rawPayee, category: "subscriptions" }], opts());
  assert.equal(res.rulesSkipped, 1); assert.equal(res.rules, 0); assert.equal(p.rules.length, 0);
  assert.equal(p.transactions[0].payee, "Paypal Spotify"); assert.equal(p.transactions[0].category, "subscriptions");
  assert.equal(p.transactions[1].category, "", "eBay is another group");
});
