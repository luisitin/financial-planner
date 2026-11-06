import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("empty plan: no data, planned figures still offered when entered", () => {
  let d = compute(emptyPlan(), { today: "2026-09-15" });
  assert.equal(d.hasData, false); assert.equal(d.planned, null);
  const p = emptyPlan();
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 4000, period: "monthly" });
  d = compute(p, { today: "2026-09-15" });
  assert.equal(d.planned.in, 4000); assert.equal(d.planned.out, 0);
});
test("months from transactions: transfers out, income by category kind, uncategorised money in counts as income", () => {
  const p = samplePlan();
  const d = compute(p, { today: "2026-09-15" });
  assert.deepEqual(d.rows.map((r) => r.ym), ["2026-09", "2026-08"]);
  const sep = d.rows[0], aug = d.rows[1];
  near(sep.in, 1950 + 1950 + 640.22, "payroll twice plus the card payment received (uncategorised money in)");
  near(sep.out, 1500 + 86.40 + 54.12 + 15.49 + 640.22 + 42.17 + 42.17);
  assert.equal(sep.complete, false, "September is the current month"); assert.equal(aug.complete, true);
  assert.equal(sep.uncategorised, 4);
  near(aug.in, 1950); near(aug.out, 1608); near(aug.net, 342); near(aug.rate, 342 / 1950);
  near(d.totals.in, sep.in + aug.in);
  assert.equal(d.average.months, 1); near(d.average.net, 342);
  assert.equal(d.byCategory.out[0].category, "housing"); near(d.byCategory.out[0].total, 3000);
  assert.equal(d.byCategory.in[0].category, "income-salary"); near(d.byCategory.in[0].total, 5850);
  assert.equal(compute(p, { months: 1 }).rows.length, 1);
});
test("plan versus real compares the bank's money in with take-home pay, and calls it short only beyond 10%", async () => {
  const { takeHome } = await import("../paycheck/compute.js");
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1988-05-01" });
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 5000 });
  p.income.push({ id: "ia", name: "Ana's salary", type: "salary", personId: "a", amount: 6000, period: "monthly", taxable: true });
  const net = takeHome(p, { today: "2026-11-01" }).monthly;
  assert.ok(net < 6000 * 0.9, `take-home is well below pay before tax: ${net}`);
  // the bank shows exactly the take-home in each of three full months: nothing is short
  const months = ["2026-08", "2026-09", "2026-10"];
  months.forEach((m, k) => p.transactions.push({ id: `t${k}`, date: `${m}-15`, amount: Math.round(net * 100) / 100, payee: "Acme payroll", accountId: "c", category: "income-salary" }));
  let d = compute(p, { today: "2026-11-01" });
  near(d.planned.in, 6000); near(d.planned.takeHomeIn, net); assert.equal(d.planned.takeHome, true);
  assert.ok(Math.abs(d.inGap) < 0.01); assert.equal(d.inShort, false, "matching take-home is not a red gap");
  // 8% below: two paychecks in a month of pay every two weeks, not a gap
  p.transactions.forEach((t) => { t.amount = Math.round(net * 0.92 * 100) / 100; });
  assert.equal(compute(p, { today: "2026-11-01" }).inShort, false);
  // 20% below take-home: worth a look
  p.transactions.forEach((t) => { t.amount = Math.round(net * 0.8 * 100) / 100; });
  d = compute(p, { today: "2026-11-01" });
  assert.equal(d.inShort, true); near(d.inGap, Math.round(net * 0.8 * 100) / 100 - net);
});

test("bank versus plan: the bank's whole months against Expenses, by kind; flagged only when the bank shows clearly more (round 4)", async () => {
  const { bankVsPlan, BANK_OVER } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { standing } = await import("../../overview/setup/compute.js");
  const { compute: alerts } = await import("../../overview/alerts/compute.js");
  const T = "2026-11-02";
  const fill = (p, extraShopping) => {
    p.transactions = [];
    let n = 0;
    const add = (date, amount, category) => p.transactions.push({ id: `t${++n}`, date, amount, payee: category || "x", accountId: "a-chk", category, tags: [], note: "" });
    for (const ym of ["2026-08", "2026-09", "2026-10"]) {
      add(`${ym}-01`, 10950, "income-salary");
      add(`${ym}-02`, -1980, "housing"); add(`${ym}-05`, -953, "groceries"); add(`${ym}-06`, -410, "debt");
      add(`${ym}-09`, -extraShopping, "shopping"); add(`${ym}-10`, -500, "transfer"); add(`${ym}-12`, -900, "taxes"); add(`${ym}-15`, -100, "");
      add(`${ym}-28`, -20, "dining");
    }
    add("2026-11-01", -5000, "shopping");   // this month: not whole yet, left out
    return p;
  };
  const p = fill(familyPlan(T), 3000);
  const b = bankVsPlan(p, { today: T });
  assert.equal(b.months, 3);
  // out: housing 1980 + groceries 953 + debt 410 + shopping 3000 + unfiled 100 + dining 20; transfers and taxes left out
  assert.ok(Math.abs(b.bankOut - (1980 + 953 + 410 + 3000 + 100 + 20)) < 0.01, String(b.bankOut));
  assert.ok(b.over, "the bank shows about $3,000 a month more than Expenses lists");
  assert.equal(b.lines[0].category, "shopping"); assert.ok(Math.abs(b.lines[0].more - 3000) < 0.01); assert.equal(b.lines[0].plan, 0);
  assert.ok(Math.abs(b.unfiled - 100) < 0.01);
  assert.ok(b.lines.every((x) => x.more >= BANK_OVER.lineAtLeast));
  // the Dashboard: the first move is to put the rest on Expenses, and the headline says the figures may be too rosy
  const st = standing(p, { today: T });
  assert.equal(st.moves[0].id, "bank"); assert.equal(st.moves[0].href, "#/cashflow/expenses");
  assert.match(st.headline, /^Your bank shows about \$[\d,]+ a month more going out than your plan lists/);
  assert.ok(st.bank && Math.abs(st.bank.gap - b.gap) < 0.01);
  assert.ok(alerts(p, { today: T }).alerts.some((a) => a.id === "bank-over"));
  // a bank close to the plan is not flagged; nor are fewer than two whole months
  const q = fill(familyPlan(T), 0);
  assert.equal(bankVsPlan(q, { today: T }).over, false);
  assert.equal(standing(q, { today: T }).bank, null);
  q.transactions = q.transactions.filter((t) => t.date >= "2026-10-01");
  assert.equal(bankVsPlan(q, { today: T }), null);
});

// ---- a card whose own file is missing, and holes between files (2026-11-02)
test("the sample family: the Visa's payments count as money out until its file is in; the typical month skips the holed months", async () => {
  const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const { bankVsPlan } = await import("./compute.js");
  const { standing } = await import("../../overview/setup/compute.js");
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  const d = compute(p, { today: T });
  const row = (ym) => d.rows.find((r) => r.ym === ym);
  // October: $4,843.32 of spending from checking plus the $2,610.30 that went to the Visa
  near(row("2026-10").out, 4843.32 + 2610.3); near(row("2026-10").cards, 2610.3); near(row("2026-10").in, 13206);
  assert.equal(row("2026-10").count, 24, "October's 27 lines less its 3 transfers; the stand-in line is not a bank line");
  near(d.totals.out, 3549.49 + 3264.16 + 5746.48 + 4843.32 + 46.8 + 640.22 + 2450.22 + 2980.55 + 2610.3);
  near(d.totals.net, 44234 - d.totals.out);
  const visa = d.byCategory.out.find((c) => c.unimported);
  assert.equal(visa.label, "Visa card, details not imported yet"); near(visa.total, 640.22 + 2450.22 + 2980.55 + 2610.3); assert.equal(visa.count, 4);
  // July (7/31) and August (8/1, 8/2) have Chase's hole: the typical month is September and October only
  assert.deepEqual(d.rows.map((r) => [r.ym, r.holes, r.whole]), [["2026-11", 0, false], ["2026-10", 0, true], ["2026-09", 0, true], ["2026-08", 1, false], ["2026-07", 1, false]]);
  assert.equal(d.average.months, 2);
  near(d.average.in, (10318 + 13206) / 2); near(d.average.out, (5746.48 + 2980.55 + 4843.32 + 2610.3) / 2);
  // bank versus plan: the same two months; the Visa's payments are apart (re-check 4: nobody has seen what they bought, so they
  // are never "over" and never an Add), and the gap is mostly them: the move is the Visa's file
  const b = bankVsPlan(p, { today: T });
  assert.equal(b.months, 2); near(b.cards, (2980.55 + 2610.3) / 2); near(b.bankOut + b.cards, d.average.out); near(b.bankOut, (5746.48 + 4843.32) / 2);
  assert.deepEqual([b.over, b.cardsGap], [false, true]); assert.ok(!b.lines.some((l) => l.category === "card-unimported"), "the card is no kind of spending yet");
  assert.equal(standing(p, { today: T }).headline, "About $2,800 a month went to the Visa card, whose file isn't in, so your bank can't be checked against your plan yet. The first move fixes that.");
});
test("the stand-in line goes once the card has lines in the month", async () => {
  const p = emptyPlan();
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 1 }, { id: "visa", name: "Visa card", type: "credit", institution: "Chase", balance: 1 });
  const t = (id, accountId, date, amount, payee, category) => ({ id, accountId, date, amount, payee, rawPayee: payee.toUpperCase(), category, tags: [], note: "" });
  p.transactions.push(t("p", "chk", "2026-10-01", 3000, "Payroll", "income-salary"), t("r", "chk", "2026-10-02", -1500, "Rent", "housing"), t("c", "chk", "2026-10-14", -640, "Chase Credit Crd Autopay", "transfer"));
  let r = compute(p, { today: "2026-11-02" }).rows[0];
  near(r.out, 2140); near(r.cards, 640); near(r.net, 860);
  p.transactions.push(t("v", "visa", "2026-10-09", -90, "Cafe", "dining"), t("vp", "visa", "2026-10-15", 640, "Payment Thank You", "transfer"));
  r = compute(p, { today: "2026-11-02" }).rows[0];
  near(r.out, 1590); near(r.cards, 0); near(r.net, 1410);
});
// ---- round-5 review (2026-11-02): a card file that starts late or stops early; which months are left out, and why
test("the Visa's file from 8/20: August is not whole (Chase's hole, the Visa's late start), the card line names its months", async () => {
  const { cardGapPlan, withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = withVisaFile(cardGapPlan(T), "2026-08-20", "2026-10-31");
  const d = compute(p, { today: T });
  assert.deepEqual(d.rows.map((r) => [r.ym, r.whole, r.missing]), [["2026-11", false, []], ["2026-10", true, []], ["2026-09", true, []],
    ["2026-08", false, ["Chase checking has no lines from 7/31 to 8/2", "Visa card's lines start on 8/20"]], ["2026-07", false, ["Chase checking has no lines from 7/31 to 8/2"]]]);
  assert.deepEqual(d.leftOut, [{ yms: ["2026-07", "2026-08"], why: "Chase checking has no lines from 7/31 to 8/2" }]);
  // the typical month: September (5,746.48 + 900 of Visa dinners) and October (4,843.32 + 930)
  assert.equal(d.average.months, 2); near(d.average.out, (5746.48 + 900 + 4843.32 + 930) / 2);
  // stand-ins only in July (no Visa lines) and August (the 8/14 payment, before the file's first day): the line says so
  const visa = d.byCategory.out.find((c) => c.unimported);
  // both are dated before the Visa's first line (8/20): "before its file starts" (re-check 4, page finding 4)
  assert.equal(visa.label, "Visa card (July and August), before its file starts on 8/20"); near(visa.total, 640.22 + 2450.22);
  assert.deepEqual(d.rows.find((r) => r.ym === "2026-08").cardsBy.map((c) => [c.cardId, Math.round(c.total * 100) / 100]), [["a-visa", 2450.22]]);
});
test("the Visa's file stopping on 9/19: September is not whole; October (its payment standing in) is", async () => {
  const { cardGapPlan, withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const { bankVsPlan } = await import("./compute.js");
  const T = "2026-11-02";
  const p = withVisaFile(cardGapPlan(T), "2026-08-20", "2026-09-19");
  const d = compute(p, { today: T });
  assert.deepEqual(d.rows.find((r) => r.ym === "2026-09").missing, ["Visa card's lines stop on 9/19"]);
  assert.equal(d.average.months, 1); near(d.average.out, 4843.32 + 2610.3);
  assert.equal(bankVsPlan(p, { today: T }), null, "one whole month: too few to compare");
});
test("bank versus plan names the card whose file is missing, and the gap without it (plan3: the whole gap is the Visa)", async () => {
  const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const { bankVsPlan } = await import("./compute.js");
  const T = "2026-11-02";
  const b = bankVsPlan(cardGapPlan(T), { today: T });
  // (2,980.55 + 2,610.30) / 2 = 2,795.43 a month went to the Visa; without it the bank shows less than Expenses lists
  // ((5,746.48 + 4,843.32) / 2 = 5,294.90 against 5,826.33: -531.43), with it 2,263.99 more (re-check 4, page finding 1)
  assert.deepEqual(b.cardsUnfiled.map((c) => [c.accountId, c.name, Math.round(c.monthly * 100) / 100]), [["a-visa", "Visa card", 2795.43]]);
  near(b.gap, -531.43); near(b.gapWithCards, 2263.99); near(b.gapWithCards, b.gap + b.cards);
  assert.deepEqual([b.over, b.cardsGap], [false, true]);
  assert.deepEqual(b.cardFile, { accountId: "a-visa", name: "Visa card", title: "Bring in the Visa file", the: "the Visa card", monthly: b.cards, months: 2, whole: true, plural: false, href: "#/transactions/import?accountId=a-visa" });
});
// ---- re-check of the card patch (2026-11-02): the findings' own inputs and figures
test("finding 5 (rule 6): the typical month is the months ledger's wholeMonth counts, the same as bank versus plan: out $7,298.34", async () => {
  const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const { bankVsPlan } = await import("./compute.js");
  const { wholeMonth } = await import("../../transactions/ledger/compute.js");
  const T = "2026-11-02";
  const p = cardGapPlan(T); p.transactions = p.transactions.filter((t) => t.date >= "2026-08-01");
  for (const [i, d] of ["2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31"].entries()) p.transactions.push({ id: `in${i}`, date: d, amount: 12.5, payee: "Interest", rawPayee: "INTEREST PAID", accountId: "a-sav", category: "income-interest", tags: [], note: "" });
  const d = compute(p, { today: T });
  // July has only Ally's $12.50 on 7/31 (checking starts 8/3): over, but not whole
  assert.deepEqual(d.rows.map((r) => [r.ym, r.whole]), [["2026-11", false], ["2026-10", true], ["2026-09", true], ["2026-08", true], ["2026-07", false]]);
  assert.deepEqual(d.rows.map((r) => r.whole), d.rows.map((r) => r.complete && wholeMonth(p, r.ym, T)));
  // August $5,714.38, September $8,727.03, October $7,453.62 (each with the Visa's payment): (21,895.03) / 3
  assert.equal(d.average.months, 3); near(d.average.out, 7298.34);
  assert.deepEqual(d.leftOut, [{ yms: ["2026-07"], why: "your files start on 7/31" }]);
  const b = bankVsPlan(p, { today: T });
  assert.equal(b.months, 3); near(b.bankOut + b.cards, d.average.out);
});
test("finding 4: a quiet savings account (interest on 7/31 and 10/31) and no card: the typical month is August to October, as bank versus plan", async () => {
  const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const { bankVsPlan } = await import("./compute.js");
  const T = "2026-11-02";
  const p = cardGapPlan(T); p.accounts = p.accounts.filter((a) => a.type !== "credit");
  p.transactions = p.transactions.filter((t) => t.date >= "2026-08-01" && !/CRD AUTOPAY/.test(t.rawPayee));
  for (const [i, d] of ["2026-07-31", "2026-10-31"].entries()) p.transactions.push({ id: `iq${i}`, date: d, amount: 12, payee: "INTEREST PAID", rawPayee: "INTEREST PAID", accountId: "a-sav", category: "income-interest", tags: [], note: "" });
  const b = bankVsPlan(p, { today: T });
  assert.equal(b.months, 3); near(b.bankOut, 4617.99);
  const d = compute(p, { today: T });
  assert.equal(d.average.months, 3); near(d.average.out, 4617.99); assert.ok(d.rows.every((r) => !r.missing.length));
});
test("page review 4: the typical month names what went to the card and the months left out, and why", async () => {
  const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const d = compute(cardGapPlan(T), { today: T });
  // September's $2,980.55 and October's $2,610.30 to the Visa, a month: $2,795.43 of the $8,090.33 out
  near(d.average.cards, 2795.425); near(d.average.out, 8090.325);
  assert.deepEqual(d.average.cardsBy.map((c) => [c.cardId, c.name, Math.round(c.monthly * 100) / 100]), [["a-visa", "Visa card", 2795.43]]);
  assert.deepEqual(d.leftOut, [{ yms: ["2026-07", "2026-08"], why: "Chase checking has no lines from 7/31 to 8/2" }]);
  assert.deepEqual(d.rows.find((r) => r.ym === "2026-08").missing, ["Chase checking has no lines from 7/31 to 8/2"]);
});

// --- re-check 4: one rule for holes, own accounts never cards, never count twice, every page says the same thing ---
const RC4 = "2026-11-02";
const rc4Fix = () => import("../../../qa/fixtures/card-gap-plan.mjs");
test("money 1 (re-check 4): one checking file a month (8/3-8/29, 9/1-9/26, 10/1-10/31) is no hole: 3 typical months of $4,205.78", async () => {
  const { cardGapPlan, noCardFromAug, oneFileAMonth } = await rc4Fix();
  const { bankVsPlan } = await import("./compute.js");
  const { coverageByAccount } = await import("../../transactions/ledger/compute.js");
  const p = noCardFromAug(cardGapPlan(RC4)); p.transactions = p.transactions.filter((t) => t.date !== "2026-09-28" && t.date !== "2026-09-30");
  oneFileAMonth(p, "a-chk");
  assert.deepEqual(p.imports.map((i) => [i.from, i.to]), [["2026-08-03", "2026-08-29"], ["2026-09-01", "2026-09-26"], ["2026-10-01", "2026-10-31"], ["2026-11-01", "2026-11-01"]]);
  // 8/30-8/31 (2 days) and 9/27-9/30 (4 days) are quiet spells: 7 days or fewer, and the paycheck and mortgage are in their months
  assert.deepEqual(coverageByAccount(p)["a-chk"].holes, []);
  const d = compute(p, { today: RC4 });
  assert.equal(d.average.months, 3); near(d.average.out, 4205.78);
  const b = bankVsPlan(p, { today: RC4 });
  assert.equal(b.months, 3); near(b.bankOut, 4205.78); near(b.gap, -1220.55); assert.deepEqual(b.cardsUnfiled, []);
});
test("money 2 (re-check 4): a Discover savings transfer is not a Discover card payment: the year's money out is unchanged", async () => {
  const { cardGapPlan, bankLine, anAccount } = await rc4Fix();
  const p = cardGapPlan(RC4); const v = p.accounts.find((a) => a.id === "a-visa"); v.name = "Discover it card"; v.institution = "Discover";
  for (const t of p.transactions) if (/CRD AUTOPAY/.test(t.rawPayee)) { t.rawPayee = "DISCOVER E-PAYMENT 1234"; t.payee = "Discover E-payment"; }
  p.accounts.push(anAccount("a-dsav", "Discover savings", "savings", "Discover"));
  for (const [i, day] of ["2026-08-05", "2026-09-05", "2026-10-05"].entries()) p.transactions.push(bankLine(`ds${i}`, day, -500, "DISCOVER BANK ACH TRANSFER", "a-chk", "transfer"), bankLine(`dsi${i}`, day, 500, "TRANSFER FROM CHASE", "a-dsav", "transfer"));
  const d = compute(p, { today: RC4 });
  near(d.average.out, 8090.325); near(d.rows.find((r) => r.ym === "2026-10").out, 7453.62); near(d.rows.find((r) => r.ym === "2026-10").cards, 2610.3);
});
test("money 4 (re-check 4): a payment for one of two Chase cards: each month says the one sentence, none is averaged, no bank check", async () => {
  const { cardGapPlan, anAccount } = await rc4Fix();
  const { bankVsPlan } = await import("./compute.js");
  const p = cardGapPlan(RC4); p.accounts.find((a) => a.id === "a-visa").name = "Freedom";
  p.accounts.push(anAccount("a-sap", "Sapphire", "credit", "Chase"));
  const d = compute(p, { today: RC4 });
  assert.equal(d.average, null);
  assert.deepEqual(d.rows.map((r) => [r.ym, Math.round(r.out * 100) / 100, r.whole, r.unsure]), [["2026-11", 46.8, false, false], ["2026-10", 4843.32, false, true], ["2026-09", 5746.48, false, true], ["2026-08", 3264.16, false, true], ["2026-07", 3549.49, false, true]]);
  assert.deepEqual(d.leftOut.find((x) => x.yms[0] === "2026-10"), { yms: ["2026-10"], why: "$2,610 went to one of your Chase cards in October; bring in the card files to see what it bought" });
  // no month is compared; the card files come first (re-check 5, 2026-11-05: it was null, and the Dashboard said "Your month works")
  assert.deepEqual([bankVsPlan(p, { today: RC4 }).months, bankVsPlan(p, { today: RC4 }).cardFile.title], [0, "Bring in the card files"]);
});
test("pages 1 (re-check 4): plan3's next move and Needs attention say Bring in the Visa file, and still do after every Add on Expenses", async () => {
  const { cardGapPlan } = await rc4Fix();
  const { bankVsPlan } = await import("./compute.js");
  const { standing } = await import("../../overview/setup/compute.js");
  const alerts = await import("../../overview/alerts/compute.js");
  const p = cardGapPlan(RC4);
  assert.equal(standing(p, { today: RC4 }).moves[0].title, "Bring in the Visa file");
  assert.equal(standing(p, { today: RC4 }).moves[0].href, "#/transactions/import?accountId=a-visa");
  const a = alerts.compute(p, { today: RC4 }).alerts.find((x) => x.id.startsWith("bank"));
  assert.deepEqual([a.id, a.title, a.go, a.query], ["bank-card", "Bring in the Visa file", ["transactions", "import"], { accountId: "a-visa" }]);
  assert.ok(!alerts.compute(p, { today: RC4 }).alerts.some((x) => x.id === "bank-over"), "nothing is over: the gap is the Visa's");
  // tap every Add on Expenses (each line's more, rounded to $10): the bank is under Expenses by $1,351.43, still the Visa file
  for (const x of bankVsPlan(p, { today: RC4 }).lines) p.expenses.push({ id: `add-${x.category}`, name: x.label, category: x.category, amount: Math.round(x.more / 10) * 10, period: "monthly", essential: x.essential, inflates: true });
  const b = bankVsPlan(p, { today: RC4 });
  near(b.gap, -1351.43); near(b.gapWithCards, 1443.99); assert.deepEqual([b.over, b.cardsGap, b.lines.length], [false, true, 0]);
  assert.equal(standing(p, { today: RC4 }).moves[0].title, "Bring in the Visa file");
});
test("pages 4 (re-check 4): the card's July line says before its file starts on 8/1", async () => {
  const { cardGapPlan, withVisaFile } = await rc4Fix();
  const d = compute(withVisaFile(cardGapPlan(RC4), "2026-08-01", "2026-10-31"), { today: RC4 });
  assert.deepEqual(d.byCategory.out.filter((c) => c.unimported).map((c) => [c.label, c.before, c.first]), [["Visa card (July), before its file starts on 8/1", true, "2026-08-01"]]);
});

// --- re-check 5 (2026-11-05): two cards at one bank, no files: the same "bring in the card files" as for one card ---
const twoChase = async () => {
  const { cardGapPlan, anAccount } = await rc4Fix();
  const p = cardGapPlan(RC4); p.accounts.find((a) => a.id === "a-visa").name = "Freedom";
  p.accounts.push(anAccount("a-sap", "Sapphire", "credit", "Chase"));
  return p;
};
test("re-check 5, defect 4: two Chase cards, no files: bank versus plan says bring in the card files, over September and October", async () => {
  const { bankVsPlan } = await import("./compute.js");
  const b = bankVsPlan(await twoChase(), { today: RC4 });
  // no whole month, but September and October would be but for the payments counted for neither card: they are looked at.
  // Without them the bank shows (5,746.48 + 4,843.32) / 2 = 5,294.90 against 5,826.33 (-531.43); with them (2,980.55 +
  // 2,610.30) / 2 = 2,795.43 more a month, 2,263.99 over: the move is the card files (as plan3's Visa)
  assert.deepEqual([b.months, b.over, b.cardsGap], [0, false, true]);
  near(b.gap, -531.43); near(b.gapWithCards, 2263.99);
  assert.deepEqual(b.cardFile, { accountId: "a-visa", name: "Freedom", title: "Bring in the card files", the: "your Chase cards", monthly: 2795.425, months: 2, whole: false, plural: true, href: "#/transactions/import?accountId=a-visa" });
  assert.deepEqual(b.unsure.map((u) => u.ym), ["2026-10", "2026-09"]);
  // one card: the same fields, its months whole
  const { cardGapPlan } = await rc4Fix();
  const one = bankVsPlan(cardGapPlan(RC4), { today: RC4 });
  assert.deepEqual([one.cardFile.months, one.cardFile.whole, one.cardFile.plural, one.cardFile.title], [2, true, false, "Bring in the Visa file"]);
});
test("re-check 5, defect 4: the Dashboard's first move and Needs attention say bring in the card files for two Chase cards", async () => {
  const { standing } = await import("../../overview/setup/compute.js");
  const alerts = await import("../../overview/alerts/compute.js");
  const p = await twoChase();
  const s = standing(p, { today: RC4 });
  assert.deepEqual([s.moves[0].title, s.moves[0].href], ["Bring in the card files", "#/transactions/import?accountId=a-visa"]);
  assert.equal(s.moves[0].detail, "About $2,800 a month went to your Chase cards, but their own files aren't in, so what they bought can't be checked against your plan yet.");
  assert.equal(s.headline, "About $2,800 a month went to your Chase cards, whose files aren't in, so your bank can't be checked against your plan yet. The first move fixes that.");
  const a = alerts.compute(p, { today: RC4 }).alerts.find((x) => x.id.startsWith("bank"));
  assert.deepEqual([a.id, a.title, a.query], ["bank-card", "Bring in the card files", { accountId: "a-visa" }]);
  assert.equal(a.detail, "About $2,800 a month went to your Chase cards over the last 2 months, but their own files aren't in, so what they bought can't be checked against Expenses yet.");
  // the one-card words are unchanged
  const { cardGapPlan } = await rc4Fix();
  assert.equal(alerts.compute(cardGapPlan(RC4), { today: RC4 }).alerts.find((x) => x.id === "bank-card").detail, "About $2,800 a month went to the Visa card over the last 2 whole months, but its own file isn't in, so what it bought can't be checked against Expenses yet.");
});
test("re-check 5, defect 4: the months left out are named newest first (October and September, not July and August)", async () => {
  const d = compute(await twoChase(), { today: RC4 });
  assert.deepEqual(d.leftOut.map((g) => g.yms), [["2026-10"], ["2026-09"], ["2026-08"], ["2026-07"]]);
  // a group's place is its newest month
  const { cardGapPlan } = await rc4Fix();
  assert.deepEqual(compute(cardGapPlan(RC4), { today: RC4 }).leftOut, [{ yms: ["2026-07", "2026-08"], why: "Chase checking has no lines from 7/31 to 8/2" }]);
});
test("verify 5, D: two Chase cards with no files, and checking alone already shows more going out than Expenses lists: that is said, not hidden", async () => {
  const { bankVsPlan } = await import("./compute.js");
  const { standing } = await import("../../overview/setup/compute.js");
  const p = await twoChase();
  // Expenses without groceries, eating out, fun and travel: 4,073.00 a month. Checking's own lines in September and October
  // (whole but for the payments counted for neither card): (5,746.48 + 4,843.32) / 2 = 5,294.90, 1,221.90 more, over
  // max(200, 10% of 4,073) = 407.30. The payments to the cards only add to that, so it is over whatever they bought.
  p.expenses = p.expenses.filter((e) => !["travel", "fun", "dining", "groceries"].includes(e.category));
  const b = bankVsPlan(p, { today: RC4 });
  near(b.bankOut, 5294.9); near(b.planOut, 4073); near(b.gap, 1221.9);
  assert.deepEqual([b.months, b.over, b.cardsGap, b.cardFile], [2, true, false, null]);
  assert.ok(b.lines.length > 0);
  assert.deepEqual(b.unsure.map((u) => u.ym), ["2026-10", "2026-09"]);
  const s = standing(p, { today: RC4 });
  assert.equal(s.moves[0].id, "bank");
  assert.match(s.headline, /^Your bank shows about \$1,220 a month more going out than your plan lists/);
});

// C7 (R12 on): a mortgage on Debts, paid from checking, is filed under housing by the bank. It was read as that much more
// spent on the home than Expenses lists, and "Use" on Get started's home-costs row (our guess) counted the mortgage twice.
test("C7: the bank's mortgage line is compared with loan payments when the mortgage is counted from Debts, not as home costs", async () => {
  const { bankVsPlan } = await import("./compute.js");
  const S = await import("../../overview/setup/compute.js");
  const { patLee } = await import("../../../qa/fixtures/setup-personas.mjs");
  const T = "2026-11-02";
  const make = (typedMortgage) => {
    const p = patLee(T);
    S.applyOweAmounts(p, { mortgage: { owed: 300000, payment: 1600, rate: "4" } }, T);
    S.applySpend(p, { mode: "rows", rows: { housing: 90, utilities: 0, groceries: 900, transport: 0, insurance: 0, dining: 40, shopping: 500 } }, T);
    if (typedMortgage) p.expenses.push({ id: "mtg", name: "Mortgage payment", category: "housing", amount: 1600, period: "monthly", essential: true, inflates: false, startDate: "", endDate: "" });
    p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 1, asOf: T, institution: "", ownerId: "", history: [], notes: "" });
    p.transactions = []; p.imports = [{ id: "imp", accountId: "chk", from: "2026-09-01", to: "2026-10-31", at: T, rows: 0 }];
    let n = 0;
    const add = (date, amount, category, payee) => p.transactions.push({ id: `t${++n}`, date, amount, payee, rawPayee: payee, accountId: "chk", category, tags: [], note: "", importId: "imp" });
    for (const ym of ["2026-09", "2026-10"]) {
      add(`${ym}-01`, 9000, "income-salary", "PAYROLL"); add(`${ym}-02`, -1600, "housing", "WELLS FARGO HOME MTG"); add(`${ym}-03`, -90, "housing", "HOME DEPOT");
      add(`${ym}-05`, -900, "groceries", "SAFEWAY"); add(`${ym}-08`, -2000, "shopping", "FURNITURE"); add(`${ym}-29`, -40, "dining", "CAFE");
    }
    return p;
  };
  const b = bankVsPlan(make(false), { today: T });
  assert.equal(b.over, true, "the furniture: $1,500 a month more than listed");
  assert.deepEqual(b.lines.map((l) => [l.category, Math.round(l.more)]), [["shopping", 1500]], "no 'home costs $1,600 more' line");
  assert.equal(Math.round(b.gap), 1500);
  // the mortgage typed on Expenses under housing (Debts' is then not added): the bank's line is compared there, as before
  const t = bankVsPlan(make(true), { today: T });
  assert.deepEqual(t.lines.map((l) => [l.category, Math.round(l.more)]), [["shopping", 1500]]);
  assert.equal(Math.round(t.gap), 1500);
});
