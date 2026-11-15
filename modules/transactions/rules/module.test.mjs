import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePayee, prettyPayee, matchRule, applyRules, ruleFor, ruleText, compute, ruleFiles } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("normalizePayee strips statement noise so the same merchant compares equal", () => {
  assert.equal(normalizePayee("AMAZON MKTPL*2K3AB1 AMZN.COM/BILL WA"), "amazon mktpl amzn wa", ".com/bill is a web address, dropped");
  assert.equal(normalizePayee("KROGER #0421 DAYTON OH"), "kroger dayton oh");
  assert.equal(normalizePayee("NETFLIX.COM 866-579-7172 CA"), "netflix ca");
  assert.equal(normalizePayee("POS DEBIT 09/01 STARBUCKS 1234"), "starbucks");
  assert.equal(normalizePayee(""), "");
  assert.equal(prettyPayee("KROGER #0421 DAYTON OH"), "Kroger Dayton");
  assert.equal(prettyPayee("Zelle payment to Bo Rivera 20812"), "Zelle Rivera");
  assert.equal(prettyPayee("12345"), "12345", "nothing left after cleaning: keep the raw text");
});
test("matchRule: contains, direction, account", () => {
  const tx = { payee: "Netflix", rawPayee: "NETFLIX.COM 866-579-7172 CA", amount: -15.49, accountId: "chk" };
  assert.equal(matchRule({ contains: "netflix", category: "subscriptions" }, tx), true);
  assert.equal(matchRule({ contains: "NetFlix.com", category: "subscriptions" }, tx), true, "the rule text is normalised too");
  assert.equal(matchRule({ contains: "netflix", direction: "in", category: "x" }, tx), false);
  assert.equal(matchRule({ contains: "netflix", direction: "out", category: "x" }, tx), true);
  assert.equal(matchRule({ contains: "netflix", accountId: "visa", category: "x" }, tx), false);
  assert.equal(matchRule({ contains: "", category: "x" }, tx), false);
  assert.equal(matchRule({ contains: "hulu", category: "x" }, tx), false);
});
test("applyRules files uncategorized transactions, renames payee, counts hits, leaves categorised alone unless forced", () => {
  const rules = [{ id: "r1", contains: "kroger", category: "groceries", payee: "Kroger" }, { id: "r2", contains: "kroger", category: "other" }];
  const txs = [
    { id: "a", payee: "Kroger Dayton", rawPayee: "KROGER #0421 DAYTON OH", amount: -50, category: "" },
    { id: "b", payee: "Kroger Dayton", rawPayee: "KROGER #0421 DAYTON OH", amount: -20, category: "dining" },
    { id: "c", payee: "Shell", rawPayee: "SHELL OIL 57442", amount: -48, category: "" },
  ];
  const r = applyRules(rules, txs);
  assert.equal(r.changed, 1);
  assert.deepEqual(r.hits, { r1: 1 }, "the first matching rule wins");
  assert.equal(r.txs[0].category, "groceries"); assert.equal(r.txs[0].payee, "Kroger"); assert.equal(r.txs[0].rawPayee, "KROGER #0421 DAYTON OH");
  assert.equal(r.txs[1].category, "dining", "already categorised: untouched");
  assert.equal(r.txs[2].category, "");
  assert.equal(txs[0].category, "", "input not mutated");
  const forced = applyRules(rules, txs, { force: true });
  assert.equal(forced.txs[1].category, "groceries"); assert.equal(forced.changed, 2);
});
test("ruleFor builds the rule the Categorize page saves", () => {
  const r = ruleFor("AMAZON MKTPL*2K3AB1 AMZN.COM/BILL WA", "shopping");
  assert.equal(r.contains, "amazon mktpl", "cut at the code: the words before it"); assert.equal(r.category, "shopping"); assert.equal(r.payee, "Amazon Mktpl"); assert.equal(r.wholeWords, true); assert.equal(r.direction, "any");
  assert.equal(matchRule(r, { rawPayee: "AMAZON MKTPL*9Z9 AMZN.COM/BILL WA", payee: "x", amount: -1 }), true, "next month's Amazon line matches");
});
test("compute lists rules with match counts and how many uncategorized they would fix", () => {
  const p = emptyPlan();
  p.rules.push({ id: "r1", contains: "kroger", category: "groceries" });
  p.transactions.push({ id: "a", payee: "Kroger", rawPayee: "KROGER 1", amount: -5, category: "" }, { id: "b", payee: "Kroger", rawPayee: "KROGER 2", amount: -5, category: "groceries" }, { id: "c", payee: "Shell", rawPayee: "SHELL", amount: -5, category: "" });
  const d = compute(p);
  assert.equal(d.count, 1); assert.equal(d.rules[0].matches, 2); assert.equal(d.rules[0].categoryLabel, "Groceries"); assert.equal(d.uncategorised, 2); assert.equal(d.wouldFix, 1);
});

test("ruleText: the shop's own name, so a rule saved from one file files the next (another branch, the card's file)", () => {
  assert.equal(ruleText("KROGER #0388 DAYTON OH"), "kroger");
  assert.equal(ruleText("SHELL OIL 57442 DAYTON OH"), "shell oil", "the words before the code, two at most");
  assert.equal(ruleText("SOUTHWEST AIRLINES 52621 DALLAS TX"), "southwest airlines", "never just 'southwest' (Southwest Gas)");
  assert.equal(ruleText("NETFLIX.COM LOS GATOS CA"), "netflix");
  assert.equal(ruleText("BEST BUY 00012 DAYTON OH"), "best buy", "a short first word keeps the second");
  assert.equal(ruleText("COMCAST CABLE COMM"), "comcast cable comm", "no code, no state: up to three words, as before");
  assert.equal(ruleText("Online Transfer to SAV 1234"), "transfer to sav", "a word that only says what kind of line it is keeps the words after it");
  const r = ruleFor("KROGER #0388 DAYTON OH", "groceries");
  for (const raw of ["KROGER #0421", "KROGER #0388 CENTERVILLE OH", "KROGER 0421 DAYTON OH"]) assert.equal(matchRule(r, { rawPayee: raw, payee: "x", amount: -20 }), true, raw);
  assert.equal(matchRule(ruleFor("SHELL OIL 57442 DAYTON OH", "transport"), { rawPayee: "SHELL OIL 12345 XENIA OH", payee: "x", amount: -40 }), true);
  assert.equal(matchRule(ruleFor("NETFLIX.COM LOS GATOS CA", "subscriptions"), { rawPayee: "NETFLIX.COM", payee: "x", amount: -15 }), true);
});
test("review: rules made from a bank line match whole words; a payment service keeps its shop; a common first word keeps the second", async () => {
  const { ruleFor, ruleText, ruleName, matchRule, payeeWords } = await import("./compute.js");
  const shell = ruleFor("SHELL OIL 57442 DAYTON OH", "transport");
  assert.equal(shell.contains, "shell oil"); assert.equal(shell.wholeWords, true); assert.equal(shell.payee, "Shell Oil");
  assert.equal(matchRule(shell, { rawPayee: "ZELLE TO SHELLEY JONES", amount: -50 }), false, "not inside another word");
  assert.equal(matchRule(shell, { rawPayee: "SHELL OIL 12345 CENTERVILLE OH", amount: -40 }), true, "another branch");
  assert.equal(matchRule({ contains: "shell", category: "x" }, { rawPayee: "ZELLE TO SHELLEY", amount: -1 }), true, "a rule typed by hand still matches any part, as before");
  assert.equal(matchRule({ contains: "shell", wholeWords: true, category: "x" }, { rawPayee: "ZELLE TO SHELLEY JONES", amount: -1 }), false, "whole words only");
  for (const [from, other] of [["SOUTHWEST AIRLINES 52621 DALLAS TX", "SOUTHWEST GAS CORP 1234"], ["FRONTIER AIRLINES 4221234 DENVER CO", "FRONTIER COMM 80055"], ["DELTA AIR 0062 ATLANTA GA", "DELTA DENTAL INS 4411"]])
    assert.equal(matchRule(ruleFor(from, "travel"), { rawPayee: other, amount: -80 }), false, `${from} never files ${other}`);
  assert.equal(payeeWords("PAYPAL *NETFLIX"), "paypal netflix");
  const pp = ruleFor("PAYPAL *NETFLIX", "subscriptions");
  assert.equal(pp.contains, "paypal netflix"); assert.equal(pp.payee, "Netflix");
  assert.equal(matchRule(pp, { rawPayee: "PAYPAL *EBAY", amount: -80 }), false, "another PayPal shop is not a subscription");
  assert.equal(matchRule(pp, { rawPayee: "PAYPAL *NETFLIX", amount: -15.49 }), true);
  assert.equal(ruleName("SQ *BLUE BOTTLE 1234"), "Blue Bottle");
  assert.equal(ruleText("AMERICAN AIRLINES 0012345"), "american airlines", "never just 'american' (American Express)");
  assert.equal(ruleName("ONLINE TRANSFER TO SAV 1234"), "Transfer Sav", "a kind-of-line rule keeps the old name");
  assert.equal(ruleText("UBER *EATS"), "uber eats");
});

// ---------------------------------------------------------------- gap #24 (2026-11-14): "then add the tag"
test("gap #24 fix F2: a forced run leaves a split purchase's category and parts alone, and reports only what it did", () => {
  const split = { id: "s", payee: "BIG BOX STORE 114", amount: -300, category: "groceries", tags: [], splits: [{ category: "shopping", amount: -100 }, { category: "groceries", amount: -200 }] };
  const whole = { id: "w", payee: "BIG BOX STORE 220", amount: -20, category: "groceries", tags: [] };
  // a rule that only re-files: nothing to do on the split purchase, so no change and no hit for it
  const refile = [{ id: "r1", contains: "big box", category: "fun" }];
  const a = applyRules(refile, [split, whole], { force: true });
  assert.equal(a.txs[0], split, "untouched"); assert.equal(a.txs[1].category, "fun");
  assert.equal(a.changed, 1); assert.deepEqual(a.hits, { r1: 1 });
  // a rule that also tags: the tag is added, the category and the parts stay
  const b = applyRules([{ ...refile[0], tag: "Trip" }], [split, whole], { force: true });
  assert.equal(b.txs[0].category, "groceries"); assert.deepEqual(b.txs[0].splits, split.splits); assert.deepEqual(b.txs[0].tags, ["trip"]);
  assert.equal(b.changed, 2); assert.deepEqual(b.hits, { r1: 2 });
  // parts that do not add up are not a split: the line is re-filed like any other
  const broken = { ...split, splits: [{ category: "shopping", amount: -100 }, { category: "groceries", amount: -150 }] };
  assert.equal(applyRules(refile, [broken], { force: true }).txs[0].category, "fun");
});
test("gap #24 test 5: a rule with a tag adds it to each line it files, on import too, never twice; a rule without one does what it did", async () => {
  const rules = [{ id: "r1", contains: "delta air", category: "travel", tag: "#Trip" }, { id: "r2", contains: "kroger", category: "groceries" }];
  const txs = [
    { id: "a", payee: "DELTA AIR 0061234", amount: -412.3, category: "" },
    { id: "b", payee: "DELTA AIR 0069876", amount: -88, category: "", tags: ["Trip", "work"] },
    { id: "c", payee: "KROGER #0421", amount: -54.12, category: "", tags: [] },
    { id: "d", payee: "DELTA AIR 0061111", amount: -50, category: "gifts" },   // already filed: left alone, as before
  ];
  const r = applyRules(rules, txs);
  assert.deepEqual(r.txs[0].tags, ["trip"]); assert.equal(r.txs[0].category, "travel");
  assert.deepEqual(r.txs[1].tags, ["Trip", "work"], "it has the tag already");
  assert.deepEqual(r.txs[2].tags, []); assert.equal(r.txs[2].category, "groceries");
  assert.equal(r.txs[3], txs[3]);
  assert.equal(r.changed, 3); assert.deepEqual(r.hits, { r1: 2, r2: 1 });
  // without a tag anywhere the result is what it always was
  const plain = rules.map(({ tag, ...x }) => x);
  assert.deepEqual(applyRules(plain, txs).txs.map((t) => t.tags), [undefined, ["Trip", "work"], [], undefined]);
  // on import: a bank file's new lines pass the rules first
  const { prepareImport } = await import("../import/compute.js");
  const p = emptyPlan(); p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 0 }]; p.rules = rules;
  const prep = prepareImport(p, "Date,Description,Amount\n2026-07-03,DELTA AIR 0061234,-412.30\n2026-07-05,KROGER #0421,-54.12\n", { accountId: "chk" });
  const byPayee = Object.fromEntries(prep.add.map((t) => [t.rawPayee, t]));
  assert.deepEqual(byPayee["DELTA AIR 0061234"].tags, ["trip"]); assert.equal(byPayee["DELTA AIR 0061234"].category, "travel");
  assert.deepEqual(byPayee["KROGER #0421"].tags ?? [], []);
});

test("gap #24 on the page: 'And add the tag' waits under More details (optional); saving it keeps one clean tag and says what it does", async () => {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const page = (plan) => renderPage(new URL("./view.js", import.meta.url).href, plan, "2026-11-13");
  const p = emptyPlan();
  const r = await page(p);
  const f = r.root.querySelector("form"), more = f.querySelector(".form-more");
  assert.ok(more && !more.hasAttribute("open"));
  // gap #42: the amount's two boxes and the narrowing choices joined it (the form opens with three boxes)
  assert.deepEqual(more.querySelectorAll("input").map((c) => c.getAttribute("name")), ["amountValue", "amountTo", "tag"]);
  assert.deepEqual(more.querySelectorAll("select").map((c) => c.getAttribute("name")), ["match", "amountIs", "direction", "accountId"]);
  f.querySelector('[name="contains"]').value = "delta air"; f.querySelector('[name="category"]').value = "travel"; f.querySelector('[name="tag"]').value = " #Trip ";
  f.reset = () => {};   // the stand-in form has no reset (the add form clears itself after a save)
  f.dispatch("submit");
  assert.equal(r.saved[0].rules[0].tag, "trip");
  const r2 = await page(r.saved[0]);
  assert.deepEqual(r2.root.querySelectorAll(".notice.ok").map((n) => textOf(n)), ["Rule added. It adds #trip to each line it files from now on."]);
  assert.match(r2.text(), /adds #trip/);
  // a rule saved without a tag has no tag field, and the line is the old one
  const r3 = await page(emptyPlan());
  const f3 = r3.root.querySelector("form");
  f3.querySelector('[name="contains"]').value = "kroger"; f3.querySelector('[name="category"]').value = "groceries";
  f3.reset = () => {};
  f3.dispatch("submit");
  assert.equal("tag" in r3.saved[0].rules[0], false);
  assert.deepEqual((await page(r3.saved[0])).root.querySelectorAll(".notice.ok").map((n) => textOf(n)), ["Rule added."]);
});

// ---------------------------------------------------------------- gap next-60 #42 (2026-11-15): invariance
// Nothing new typed, nothing moves. Every invented household (qa/fixtures/*-plan.mjs, the 14 households, the phone-built
// ones, the empty plan) is given six months of invented bank lines (qa/fixtures/bank-lines.mjs), every bank file in
// qa/fixtures read in, and rules of every shape saved before this change (typed, Categorize's whole-word ones, direction,
// account, a name, a tag, a category of "", a text that cleans to nothing). For each, the rules page's compute(), the rules
// run over every line (as the page's button does, and forced), which rule fits which line, every bank file imported through
// the rules, Categorize's compute() and the AI categorizer's filing give the very output they gave at 461df76: a digest per
// plan written down from that commit's code (invariance.json). To write them again after a deliberate change:
// PRINT=1 node --test modules/transactions/rules/module.test.mjs
async function invariancePlans() {
  const fs = await import("node:fs"), path = await import("node:path"), { fileURLToPath, pathToFileURL } = await import("node:url");
  const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const { withBankLines, splitSome, tagSome } = await import("../../../qa/fixtures/bank-lines.mjs");
  const { prepareImport } = await import("../import/compute.js");
  const { categoriesOf } = await import("../categories/compute.js");
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn("2026-11-13") });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) out.push({ name: `phone ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  const csvs = fs.readdirSync(dir).filter((x) => x.endsWith(".csv") && !x.startsWith("positions-")).sort().map((f) => [f, fs.readFileSync(path.join(dir, f), "utf8")]);
  return out.map(({ name, plan }, i) => {
    let q = withBankLines(migrate(structuredClone(plan)), i + 1);
    if (i % 3 === 1) q = splitSome(q, "other");
    if (i % 4 === 2) q = tagSome(q);
    const chk = q.accounts.find((a) => a.type === "checking"), card = q.accounts.find((a) => a.type === "credit");
    // the bank files' lines join the plan (no rules yet), so the rules below meet real bank text too
    for (const [f, text] of csvs) { const prep = prepareImport(q, text, { accountId: /card/.test(f) ? card.id : chk.id, importId: f.replace(/\W/g, "") }); q.transactions.push(...prep.add); }
    const cats = categoriesOf(q), spend = cats.filter((c) => c.kind === "expense").map((c) => c.id), pay = cats.find((c) => c.kind === "income")?.id ?? "";
    const s = (k) => spend[(k + i) % spend.length];
    q.rules = [
      { id: "o1", contains: "corner market", direction: "out", category: s(0), payee: "Corner Market", hits: 0, createdAt: "2026-10-01" },
      { id: "o2", contains: "kettle", direction: "any", category: s(1), tag: "coffee", hits: 2 },
      { id: "o3", contains: "payroll", direction: "in", category: pay, hits: 0 },
      { id: "o4", contains: "transit", direction: "any", accountId: card.id, category: s(2), hits: 0 },
      { id: "o5", contains: "pharmacy", direction: "any", category: "", payee: "Pharmacy", hits: 0 },
      { id: "o6", contains: "lakeview", direction: "out", accountId: chk.id, category: s(3), payee: "Lakeview", tag: "#Books, Fun", hits: 0 },
      { ...ruleFor("KROGER #0421 DAYTON OH", s(4)), id: "o7", hits: 1, createdAt: "2026-10-02" },
      { ...ruleFor("NETFLIX.COM 866-579-7172 CA", s(5)), id: "o8", hits: 0 },
      { ...ruleFor("SHELL OIL 57442 DAYTON OH", s(6)), id: "o9", hits: 0 },
      { ...ruleFor("AMAZON MKTPL*2K3AB1 AMZN.COM/BILL WA", s(7)), id: "o10", hits: 0, tag: "online" },
      { id: "o11", contains: "kroger", direction: "any", category: s(8), hits: 0 },
      { id: "o12", contains: "Green Cart", direction: "out", category: s(9), payee: "Green Cart", hits: 0 },
      { id: "o13", contains: "#0421", direction: "any", category: s(10), hits: 0 },   // cleans to nothing: fits every line, as before
    ];
    if (i % 5 === 3) q.rules.reverse();
    return { name, plan: q, csvs, ids: { chk: chk.id, card: card.id }, spend };
  });
}
async function invarianceDigests() {
  const crypto = await import("node:crypto");
  const { prepareImport } = await import("../import/compute.js");
  const cat = await import("../categorize/compute.js");
  const ai = await import("../../ai/categorizer/compute.js");
  const dig = (x) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("base64url").slice(0, 22);
  const out = {};
  for (const { name, plan: q, csvs, ids, spend } of await invariancePlans()) {
    const txs = q.transactions;
    const fits = q.rules.map((r) => txs.slice(0, 260).map((t) => (matchRule(r, t) ? 1 : 0)).join("")).join("/");
    const imports = csvs.map(([f, text]) => { const p = prepareImport(q, text, { accountId: /card/.test(f) ? ids.card : ids.chk, importId: `again${f.length}` }); return { add: p.add, ruled: p.ruled, ruleHits: p.ruleHits }; });
    const draft = structuredClone(q);
    const choices = ai.groupsFor(q, "open").slice(0, 6).map((g, k) => ({ key: g.key, ids: g.ids, rawPayee: g.rawPayee, category: spend[k % spend.length] }));
    let n = 0;
    const filed = ai.applyChoices(draft, choices, { uid: () => `u${++n}`, today: "2026-11-15" });
    out[name] = dig({ compute: compute(q), run: applyRules(q.rules, txs), forced: applyRules(q.rules, txs, { force: true }), fits, imports, categorize: cat.compute(q), filed, rules: draft.rules, lines: draft.transactions.map((t) => [t.payee, t.rawPayee, t.category]) });
  }
  return out;
}
test("gap #42 invariance: with nothing new typed, every rule saved before does what it did at 461df76, byte for byte, for every invented household", async () => {
  const fs = await import("node:fs");
  const file = new URL("./invariance.json", import.meta.url);
  const now = await invarianceDigests();
  if (process.env.PRINT) { fs.writeFileSync(file, JSON.stringify({ note: "digests of the rules' output at 461df76 (gap next-60 #42); module.test.mjs says how to write them again", plans: now }, null, 1) + "\n"); return; }
  const was = JSON.parse(fs.readFileSync(file, "utf8")).plans;
  assert.ok(Object.keys(now).length >= 30, `${Object.keys(now).length} plans`);
  assert.deepEqual(Object.keys(now).sort(), Object.keys(was).sort());
  for (const k of Object.keys(was)) assert.equal(now[k], was[k], k);
});
test("gap #42 invariance: the new fields at their defaults (contains, any amount, no other texts, no more tags) change nothing", async () => {
  const { fitsRule } = await import("./compute.js");
  let lines = 0;
  for (const { name, plan: q } of await invariancePlans()) {
    const dflt = q.rules.map((r) => ({ ...r, match: "contains", amount: null, anyOf: [], tags: [] }));
    assert.equal(JSON.stringify(applyRules(dflt, q.transactions)), JSON.stringify(applyRules(q.rules, q.transactions)), name);
    assert.equal(JSON.stringify(applyRules(dflt, q.transactions, { force: true })), JSON.stringify(applyRules(q.rules, q.transactions, { force: true })), name);
    for (const t of q.transactions.slice(0, 120)) q.rules.forEach((r, k) => { assert.equal(fitsRule(dflt[k], t), matchRule(r, t)); assert.equal(fitsRule(r, t), matchRule(r, t)); });
    lines += applyRules(q.rules, q.transactions).changed;
  }
  assert.ok(lines > 1000, `${lines} lines filed across the households`);
});

// ---------------------------------------------------------------- gap #42: how the words match
const tx = (rawPayee, amount = -20, more = {}) => ({ id: rawPayee, payee: more.payee ?? rawPayee, rawPayee, amount, accountId: "chk", category: "", tags: [], ...more });
test("gap #42 match kinds: contains as before; starts with and is exactly read the bank's text and the name shown, noise left out", async () => {
  const { fitsRule, textFits } = await import("./compute.js");
  const coffee = tx("SQ *COFFEE 1234", -4.5), shop = tx("COFFEE HOUSE ANNEX", -6), named = tx("SQ *COFFEE 5678", -4.5, { payee: "Coffee" });
  // contains: any part, as before
  assert.equal(fitsRule({ contains: "coffee", category: "x" }, shop), true);
  // starts with: the description's first words, capitals and codes not counted
  const starts = { contains: "SQ", match: "starts", category: "x" };
  assert.equal(fitsRule(starts, coffee), true); assert.equal(fitsRule(starts, shop), false);
  assert.equal(fitsRule({ contains: "coffee", match: "starts", category: "x" }, shop), true);
  assert.equal(fitsRule({ contains: "coff", match: "starts", category: "x" }, shop), true, "a typed rule: any start, like contains takes any part");
  assert.equal(fitsRule({ contains: "coff", match: "starts", wholeWords: true, category: "x" }, shop), false, "a rule from a bank line: whole words");
  assert.equal(fitsRule({ contains: "coffee house", match: "starts", wholeWords: true, category: "x" }, shop), true);
  // is exactly: the whole description, or the whole name shown, store numbers and dates never counting
  const exact = { contains: "sq *coffee 0000", match: "exact", category: "x" };
  assert.equal(fitsRule(exact, coffee), true, "the store number does not count"); assert.equal(fitsRule(exact, shop), false);
  assert.equal(fitsRule({ contains: "Coffee", match: "exact", category: "x" }, named), true, "the name shown");
  assert.equal(fitsRule({ contains: "Coffee", match: "exact", category: "x" }, shop), false, "not a longer name");
  assert.equal(fitsRule({ contains: "Coffee", match: "exact", category: "x" }, coffee), false, "not with the card service in front");
  // other spellings (a merge): matched the same way
  const both = { contains: "sq coffee", anyOf: ["coffee house annex"], match: "exact", category: "x" };
  assert.equal(fitsRule(both, coffee), true); assert.equal(fitsRule(both, shop), true); assert.equal(fitsRule(both, tx("COFFEE HOUSE")), false);
  assert.equal(fitsRule({ contains: "zzz", anyOf: ["annex"], category: "x" }, shop), true, "contains reads the other texts too");
  // a text with nothing left after cleaning never fits a starts or exact rule; a kind this version cannot read fits nothing
  assert.equal(textFits({ match: "exact" }, "#1234", coffee), false); assert.equal(textFits({ match: "starts" }, "", coffee), false);
  assert.equal(fitsRule({ contains: "coffee", match: "sounds like", category: "x" }, shop), false);
  assert.equal(fitsRule({ contains: "", match: "starts", category: "x" }, shop), false, "no text: no rule, as before");
});

// ---------------------------------------------------------------- gap #42: the amount
test("gap #42 amount kinds: the size of the line in cents (in or out alike), exactly, at least, at most, between either way round", async () => {
  const { amountFits, fitsRule } = await import("./compute.js");
  assert.equal(amountFits(undefined, -15.49), true); assert.equal(amountFits(null, 3), true, "absent or null: any amount");
  assert.equal(amountFits({ is: "exactly", value: 15.49 }, -15.49), true); assert.equal(amountFits({ is: "exactly", value: 15.49 }, -15.5), false);
  assert.equal(amountFits({ is: "exactly", value: 0.1 + 0.2 }, 0.3), true, "compared in cents, so 0.1 + 0.2 is 30 cents");
  assert.equal(amountFits({ is: "exactly", value: 15.49 }, 15.49), true, "money in of the same size: direction says in or out");
  assert.equal(amountFits({ is: "atLeast", value: 100 }, -100), true); assert.equal(amountFits({ is: "atLeast", value: 100 }, -99.99), false);
  assert.equal(amountFits({ is: "atMost", value: 20 }, -20), true); assert.equal(amountFits({ is: "atMost", value: 20 }, -20.01), false);
  assert.equal(amountFits({ is: "between", value: 10, to: 20 }, -10), true); assert.equal(amountFits({ is: "between", value: 10, to: 20 }, -20), true);
  assert.equal(amountFits({ is: "between", value: 20, to: 10 }, -15), true, "either way round"); assert.equal(amountFits({ is: "between", value: 10, to: 20 }, -9.99), false);
  // a condition this version cannot read fits no line (a rule never files by a condition it cannot read)
  for (const bad of [{}, { is: "about", value: 10 }, { is: "exactly" }, { is: "exactly", value: "" }, { is: "exactly", value: "ten" }, { is: "between", value: 10 }, 15]) assert.equal(amountFits(bad, -10), false, JSON.stringify(bad));
  assert.equal(amountFits({ is: "atLeast", value: 1 }, "x"), false, "a line with no amount");
  // with the words: a $15.49 Netflix line, not the $22.99 one
  const r = { contains: "netflix", category: "subscriptions", amount: { is: "exactly", value: 15.49 } };
  assert.equal(fitsRule(r, tx("NETFLIX.COM", -15.49)), true); assert.equal(fitsRule(r, tx("NETFLIX.COM", -22.99)), false);
});

// ---------------------------------------------------------------- gap #42: several actions, in order
test("gap #42 actions and order: a filing rule ends the walk; a rule that only renames or tags does its part and the next one files", () => {
  const lines = [tx("SQ *COFFEE 1234", -4.5), tx("KROGER #0421", -54.12, { tags: ["Food"] }), tx("CORNER MARKET", -12, { category: "groceries" })];
  // one rule doing all three things at once: the category, the name, two tags
  const all = applyRules([{ id: "a", contains: "kroger", category: "groceries", payee: "Kroger", tag: "food", tags: ["Weekly", "food"] }], lines);
  assert.deepEqual([all.txs[1].category, all.txs[1].payee, all.txs[1].tags], ["groceries", "Kroger", ["Food", "weekly"]], "a tag it has already is not added twice");
  assert.equal(all.changed, 1); assert.deepEqual(all.hits, { a: 1 });
  // first match wins: the first filing rule that fits files the line; the one under it is never tried
  const two = applyRules([{ id: "f1", contains: "coffee", category: "dining" }, { id: "f2", contains: "sq", category: "fun", payee: "Square" }], lines);
  assert.equal(two.txs[0].category, "dining"); assert.equal(two.txs[0].payee, "SQ *COFFEE 1234", "the second rule's name is not used"); assert.deepEqual(two.hits, { f1: 1 });
  // a rule that only renames (no category) lets the rule under it file the line, and its name wins over the filing rule's
  const merge = { id: "m", contains: "sq coffee", match: "exact", payee: "Coffee" };
  const w = applyRules([merge, { id: "f", contains: "coffee", category: "dining", payee: "Coffee Shop" }], lines);
  assert.deepEqual([w.txs[0].category, w.txs[0].payee, w.txs[0].rawPayee], ["dining", "Coffee", "SQ *COFFEE 1234"]);
  assert.deepEqual(w.hits, { f: 1, m: 1 }); assert.equal(w.changed, 1);
  // ... but under a filing rule that fits first, it is never reached (the order is the person's)
  const under = applyRules([{ id: "f", contains: "coffee", category: "dining", payee: "Coffee Shop" }, merge], lines);
  assert.equal(under.txs[0].payee, "Coffee Shop"); assert.deepEqual(under.hits, { f: 1 });
  // the first rename-only rule's name wins over a later one's; their tags add up
  const names = applyRules([{ id: "n1", contains: "coffee", payee: "Coffee", tag: "treat" }, { id: "n2", contains: "sq", payee: "Square", tags: ["card"] }], lines);
  assert.deepEqual([names.txs[0].category, names.txs[0].payee, names.txs[0].tags], ["", "Coffee", ["treat", "card"]]);
  assert.deepEqual(names.hits, { n1: 1, n2: 1 }); assert.equal(names.changed, 1);
  // a line already filed: only rules that file nothing reach it (unless forced); a filing rule above does not stop them
  const filed = applyRules([{ id: "f", contains: "corner", category: "fun" }, { id: "n", contains: "corner market", payee: "Corner Market" }], lines);
  assert.deepEqual([filed.txs[2].category, filed.txs[2].payee], ["groceries", "Corner Market"]);
  const forced = applyRules([{ id: "f", contains: "corner", category: "fun" }, { id: "n", contains: "corner market", payee: "Corner Market" }], lines, { force: true });
  assert.deepEqual([forced.txs[2].category, forced.txs[2].payee], ["fun", "CORNER MARKET"], "forced: the filing rule fits first and ends the walk");
  // nothing to do: the line is the same object; tags only
  const same = applyRules([{ id: "n", contains: "coffee", payee: "SQ *COFFEE 1234" }], lines);
  assert.equal(same.txs[0], lines[0]); assert.equal(same.changed, 0); assert.deepEqual(same.hits, {});
  const tagOnly = applyRules([{ id: "t", contains: "kroger", tag: "food" }], lines);
  assert.equal(tagOnly.txs[1], lines[1], "it has the tag already"); 
  assert.deepEqual(applyRules([{ id: "t", contains: "coffee", tag: "treat" }], lines).txs[0].tags, ["treat"]);
  // inputs untouched
  assert.equal(lines[0].payee, "SQ *COFFEE 1234"); assert.equal(lines[0].category, "");
});
test("gap #42 a split purchase under a rename-only rule: renamed, its parts and category kept", () => {
  const split = { id: "s", payee: "BIG BOX STORE 114", amount: -300, category: "groceries", tags: [], splits: [{ category: "shopping", amount: -100 }, { category: "groceries", amount: -200 }] };
  const r = applyRules([{ id: "n", contains: "big box", payee: "Big Box" }, { id: "f", contains: "big box", category: "fun" }], [split], { force: true });
  assert.deepEqual([r.txs[0].payee, r.txs[0].category, r.txs[0].splits], ["Big Box", "groceries", split.splits]);
  assert.equal(r.changed, 1); assert.deepEqual(r.hits, { f: 1, n: 1 });
});
test("gap #42 matchRule is 'would this rule file the line': a rule that only renames files nothing, so Categorize never suggests it", async () => {
  const { fitsRule, ruleFiles } = await import("./compute.js");
  const merge = { id: "m", contains: "netflix", payee: "Netflix" };
  const line = tx("NETFLIX.COM 866", -15.49);
  assert.equal(fitsRule(merge, line), true); assert.equal(ruleFiles(merge), false); assert.equal(matchRule(merge, line), false);
  assert.equal(ruleFiles({ contains: "x", category: "" }), true, "a category of \"\" (only by editing the file) still files, as before");
  const p = emptyPlan();
  p.rules = [merge, { id: "f", contains: "netflix", category: "subscriptions" }];
  p.transactions = [{ ...line, id: "n1" }];
  const { compute: categorize } = await import("../categorize/compute.js");
  assert.deepEqual(categorize(p).groups.map((g) => [g.suggestion?.category, g.suggestion?.why]), [["subscriptions", "a rule matches"]]);
  const d = compute(p);
  assert.deepEqual(d.rules.map((r) => r.matches), [1, 1], "the page counts the lines each rule fits"); assert.equal(d.wouldFix, 1);
  p.rules = [merge];
  assert.equal(compute(p).wouldFix, 0, "a rename alone is not filing: no 'File N now'");
});

// ---------------------------------------------------------------- gap #42: the order
test("gap #42 moveRule: one place up or down, the same list at an end or for an unknown rule", async () => {
  const { moveRule } = await import("./compute.js");
  const rules = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(moveRule(rules, "b", -1).map((r) => r.id), ["b", "a", "c"]);
  assert.deepEqual(moveRule(rules, "b", 1).map((r) => r.id), ["a", "c", "b"]);
  assert.equal(moveRule(rules, "a", -1), rules); assert.equal(moveRule(rules, "c", 1), rules); assert.equal(moveRule(rules, "z", 1), rules); assert.equal(moveRule(rules, "b", 0), rules);
  assert.deepEqual(rules.map((r) => r.id), ["a", "b", "c"], "a new list; the old one untouched");
  // the order decides: Kroger's second rule files once it is moved above the first
  const lines = [tx("KROGER #0421", -54.12)];
  const two = [{ id: "r1", contains: "kroger", category: "groceries" }, { id: "r2", contains: "kroger", category: "household" }];
  assert.equal(applyRules(two, lines).txs[0].category, "groceries");
  assert.equal(applyRules(moveRule(two, "r2", -1), lines).txs[0].category, "household");
});

// ---------------------------------------------------------------- gap #42: every sentence
test("gap #42 words: one sentence per case (saved, refused, moved, the order line, a rule's row)", async () => {
  const { savedWords, REFUSED, movedWords, orderWords, amountWords, whenWords, andList } = await import("./compute.js");
  assert.equal(savedWords({ added: true, files: true }), "Rule added.");
  assert.equal(savedWords({ added: false, files: true }), "Rule saved.");
  assert.equal(savedWords({ added: true, files: true, tags: ["trip"] }), "Rule added. It adds #trip to each line it files from now on.");
  assert.equal(savedWords({ added: false, files: true, tags: ["trip", "work"] }), "Rule saved. It adds #trip and #work to each line it files from now on.");
  assert.equal(savedWords({ added: true, files: false, name: "Coffee" }), "Rule added. It shows each line it fits as Coffee; your other rules still pick the category.");
  assert.equal(savedWords({ added: true, files: false, tags: ["trip"] }), "Rule added. It adds #trip to each line it fits; your other rules still pick the category.");
  assert.equal(savedWords({ added: false, files: false, name: "Coffee", tags: ["a", "b", "c"] }), "Rule saved. It shows each line it fits as Coffee and adds #a, #b and #c; your other rules still pick the category.");
  assert.deepEqual(REFUSED, {
    nothing: "Pick a category, a name to show or a tag: a rule needs something to do.",
    noAmount: "Type the amount, or pick “Any amount”.",
    noTo: "Type the second amount for “Between”.",
  });
  assert.equal(movedWords(-1, 0, 5), "Moved up. It is now the first rule, tried before all the others.");
  assert.equal(movedWords(-1, 1, 5), "Moved up. It is now rule 2 of 5.");
  assert.equal(movedWords(1, 4, 5), "Moved down. It is now the last rule, tried after all the others.");
  assert.equal(movedWords(1, 2, 5), "Moved down. It is now rule 3 of 5.");
  assert.equal(orderWords(false), "Rules are tried from the top. The first one that fits a line files it.");
  assert.equal(orderWords(true), "Rules are tried from the top. The first one that fits a line files it. A rule that only renames, like a merge, lets the rules under it file the line.");
  assert.deepEqual([{ is: "exactly", value: 15.49 }, { is: "atLeast", value: 100 }, { is: "atMost", value: 20 }, { is: "between", value: 20, to: 10 }, null, { is: "about", value: 3 }].map(amountWords),
    ["exactly $15.49", "$100 or more", "$20 or less", "$10 to $20", "", "an amount to fix"]);
  assert.equal(whenWords({ contains: "kroger" }), '"kroger"', "as before");
  assert.equal(whenWords({ contains: "amzn", match: "starts" }), 'starts with "amzn"');
  assert.equal(whenWords({ contains: "sq coffee", anyOf: ["coffee", "coffee co"], match: "exact" }), 'exactly "sq coffee", "coffee" or "coffee co"', "critic F6: 'exactly', not 'is'");
  assert.deepEqual([andList([]), andList(["a"]), andList(["a", "b"]), andList(["a", "b", "c"])], ["", "a", "a and b", "a, b and c"]);
});

// ---------------------------------------------------------------- gap #42 on the page
async function rulesPage(plan) {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(new URL("./view.js", import.meta.url).href, plan, "2026-11-15");
  const button = (label) => r.root.querySelectorAll("button").find((b) => textOf(b) === label) ?? null;
  const form = () => { const f = r.root.querySelector("form"); if (f) f.reset = () => {}; return f; };
  const set = (f, name, value) => { f.querySelector(`[name="${name}"]`).value = value; };
  const notices = () => r.root.querySelectorAll(".notice.ok").map((n) => textOf(n));
  // the boxes outside "More details (optional)"
  const shown = (f) => f.all().filter((e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && !e.closest(".form-more")).map((e) => e.getAttribute("name"));
  return { ...r, button, form, set, notices, shown, textOf };
}
/** The page with a store that keeps what was saved, drawn again on demand (draw() -> a fresh root), as the shell does. */
async function liveRules(plan0) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"), fmt = await import("../../../core/format.js"), { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  let cur = migrate(structuredClone(plan0));
  const store = { get: () => cur, update: (fn) => { const d = structuredClone(cur); fn(d); cur = d; } };
  return {
    get plan() { return cur; }, textOf,
    draw: () => { const root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => "2026-11-15" }, plan: cur, route: { rest: [] }, store }); return root; },
    button: (root, label) => root.querySelectorAll("button").find((b) => textOf(b) === label) ?? null,
    notices: (root) => root.querySelectorAll(".notice.ok").map((n) => textOf(n)),
  };
}
const withRules = (rules, transactions = []) => { const p = emptyPlan(); p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 0 }]; p.rules = rules; p.transactions = transactions; return p; };
test("gap #42 on the page: the form opens with three boxes; the new choices wait under More details (optional)", async () => {
  const r = await rulesPage(emptyPlan());
  const f = r.form();
  assert.deepEqual(r.shown(f), ["contains", "category", "payee"]);
  assert.equal(f.querySelector('[name="category"]').hasAttribute("required"), false, "a rule may only rename or tag");
  const more = f.querySelector(".form-more");
  assert.ok(more && !more.hasAttribute("open"));
  assert.match(r.textOf(more), /How the words must match .*Contains them \(usual\).*Starts with them.*Is exactly them.*Capitals, store numbers and dates never count\./);
  assert.match(r.textOf(more), /And the amount is .*Any amount.*Exactly.*At least.*At most.*Between/);
  assert.match(r.textOf(more), /And add tags .*One or more, with commas between/);
  assert.equal(f.querySelector('[name="anyOf"]'), null, "other spellings only on a rule that has them");
});
test("gap #42 on the page: a rule that only renames, a rule on the amount, and every refusal", async () => {
  // only a name: no category key at all, and the green line says the other rules still pick the category
  let r = await rulesPage(emptyPlan()), f = r.form();
  r.set(f, "contains", "sq coffee"); r.set(f, "payee", "Coffee"); r.set(f, "match", "exact");
  f.dispatch("submit");
  const saved = r.saved[0].rules[0];
  assert.equal("category" in saved, false); assert.equal(saved.payee, "Coffee"); assert.equal(saved.match, "exact");
  assert.deepEqual((await rulesPage(r.saved[0])).notices(), ["Rule added. It shows each line it fits as Coffee; your other rules still pick the category."]);
  // the amount, and two tags
  r = await rulesPage(emptyPlan()); f = r.form();
  r.set(f, "contains", "netflix"); r.set(f, "category", "subscriptions"); r.set(f, "amountIs", "exactly"); r.set(f, "amountValue", "15.49"); r.set(f, "tag", "Fun, #Streaming");
  f.dispatch("submit");
  const n = r.saved[0].rules[0];
  assert.deepEqual([n.amount, n.tag, n.tags, "match" in n], [{ is: "exactly", value: 15.49 }, "fun", ["streaming"], false]);
  const again = await rulesPage(r.saved[0]);
  assert.deepEqual(again.notices(), ["Rule added. It adds #fun and #streaming to each line it files from now on."]);
  assert.match(again.text(), /"netflix" → Subscriptions exactly \$15\.49 · adds #fun, #streaming · 0 matches on file/);
  r = await rulesPage(emptyPlan()); f = r.form();
  r.set(f, "contains", "rent"); r.set(f, "category", "housing"); r.set(f, "amountIs", "between"); r.set(f, "amountValue", "2000"); r.set(f, "amountTo", "1500");
  f.dispatch("submit");
  assert.deepEqual(r.saved[0].rules[0].amount, { is: "between", value: 2000, to: 1500 });
  // refusals: nothing saved (the red line goes at the box: REFUSED, tested above)
  for (const [what, boxes] of [["nothing to do", { contains: "x" }], ["no amount", { contains: "x", category: "fun", amountIs: "atLeast" }],
    ["no second amount", { contains: "x", category: "fun", amountIs: "between", amountValue: "10" }]]) {
    r = await rulesPage(emptyPlan()); f = r.form();
    for (const [k, v] of Object.entries(boxes)) r.set(f, k, v);
    f.dispatch("submit");
    assert.equal(r.saved.length, 0, what);
  }
  // a box its choice hides is not read: a figure left in "Amount" under "Any amount", or in "And up to" under "At least",
  // saves nothing out of sight (critic F2, 2026-11-15)
  r = await rulesPage(emptyPlan()); f = r.form();
  r.set(f, "contains", "x"); r.set(f, "category", "fun"); r.set(f, "amountValue", "10"); r.set(f, "amountTo", "20");
  f.dispatch("submit");
  assert.equal("amount" in r.saved[0].rules[0], false);
  r = await rulesPage(emptyPlan()); f = r.form();
  r.set(f, "contains", "x"); r.set(f, "category", "fun"); r.set(f, "amountIs", "atLeast"); r.set(f, "amountValue", "10"); r.set(f, "amountTo", "20");
  f.dispatch("submit");
  assert.deepEqual(r.saved[0].rules[0].amount, { is: "atLeast", value: 10 });
});
test("critic F2 (2026-11-15): the amount's boxes follow its choice: none under Any amount, one for a figure, two for Between", async () => {
  const r = await rulesPage(emptyPlan()), f = r.form();
  const seen = () => ["amountValue", "amountTo"].filter((k) => { const lab = f.querySelector(`[name="${k}"]`).closest(".field"); return !lab.hidden && lab.style.display !== "none"; });
  const label = (k) => r.textOf(f.querySelector(`[name="${k}"]`).closest(".field").querySelector(".field-label"));
  assert.deepEqual(seen(), [], "Any amount: no empty boxes");
  for (const [kind, want] of [["exactly", ["amountValue"]], ["atLeast", ["amountValue"]], ["atMost", ["amountValue"]], ["between", ["amountValue", "amountTo"]], ["", []]]) {
    r.set(f, "amountIs", kind); f.querySelector('[name="amountIs"]').dispatch("change");
    assert.deepEqual(seen(), want, kind || "any");
  }
  assert.deepEqual([label("amountValue"), label("amountTo")], ["Amount", "And up to"]);
  // a rule on the amount opens with its boxes shown
  const e = await rulesPage(withRules([{ id: "a", contains: "rent", category: "housing", direction: "any", amount: { is: "between", value: 1500, to: 2000 }, hits: 0 }]));
  e.root.querySelectorAll("li").find((li) => li.getAttribute("role") === "button").click();
  const g = e.form();
  assert.deepEqual(["amountValue", "amountTo"].map((k) => g.querySelector(`[name="${k}"]`).closest(".field").style.display), ["", ""]);
  // money in or out reads as a choice, not a fragment (critic F7)
  assert.match(r.textOf(f.querySelector('[name="direction"]').closest(".field")), /^Money In or out Only going out Only coming in$/);
});
test("gap #42 on the page: a rule saved before, opened and saved with nothing changed, is saved with the very same fields", async () => {
  const old = { id: "r1", contains: "kroger", category: "groceries", payee: "Kroger", direction: "out", accountId: "chk", tag: "food", hits: 4, createdAt: "2026-09-01" };
  const r = await rulesPage(withRules([old]));
  r.root.querySelectorAll("li").find((li) => li.getAttribute("role") === "button").click();
  const f = r.form();
  assert.equal(f.querySelector(".form-more").hasAttribute("open"), true, "it holds something (money out only, one account, a tag): open");
  f.dispatch("submit");
  assert.equal(JSON.stringify(r.saved[0].rules[0]), JSON.stringify(old));
});
test("gap #42 on the page: the order line, numbered rows, and Move up keeps the rule's form open with its green line", async () => {
  const rules = [{ id: "a", contains: "kroger", category: "groceries", direction: "any", hits: 0 }, { id: "b", contains: "kroger fuel", category: "transport", direction: "any", hits: 0 }];
  const r = await rulesPage(withRules(rules));
  assert.match(r.text(), /Your rules Rules are tried from the top\. The first one that fits a line files it\. 1 "kroger" → Groceries .* 2 "kroger fuel" → Car, gas, transit/);
  assert.equal(r.button("Move up"), null, "nothing open yet: no move buttons");
  r.root.querySelectorAll("li").filter((li) => li.getAttribute("role") === "button")[1].click();
  assert.equal(r.button("Move down"), null, "the last rule cannot go down"); assert.ok(r.button("Remove this rule"));
  // the moves sit in one quiet row over the form, Remove under it (critic F4, 2026-11-15)
  const order = r.root.all().filter((x) => x.tagName === "BUTTON" || x.tagName === "FORM").map((x) => (x.tagName === "FORM" ? "form" : r.textOf(x))).filter((x) => ["form", "Move up", "Remove this rule"].includes(x));
  assert.deepEqual(order, ["Move up", "form", "Remove this rule"]);
  r.button("Move up").click();
  assert.deepEqual(r.saved[0].rules.map((x) => x.id), ["b", "a"]);
  const after = await rulesPage(r.saved[0]);
  assert.deepEqual(after.notices(), ["Moved up. It is now the first rule, tried before all the others."]);
  assert.match(after.text(), /Edit rule/); assert.ok(after.button("Move down")); assert.equal(after.button("Move up"), null);
  assert.equal(after.form().querySelector('[name="contains"]').value, "kroger fuel", "the moved rule's own form");
  // a rule that only renames adds the second sentence
  const m = await rulesPage(withRules([{ id: "m", contains: "sq coffee", match: "exact", payee: "Coffee", hits: 0 }, ...rules]));
  assert.match(m.text(), /A rule that only renames, like a merge, lets the rules under it file the line\. 1 exactly "sq coffee" → shown as Coffee/);
});
test("gap #42 S11: after a save only the saved part changes: a move opens nothing else; the rules past six stay folded as they were", async () => {
  const rules = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, contains: `shop ${String.fromCharCode(97 + i)}`, category: "fun", direction: "any", hits: 0 }));
  const r = await rulesPage(withRules(rules));
  const part = r.root.querySelector("details[data-part]") ?? r.root.querySelectorAll("details").find((x) => x.dataset?.part === "rules");
  assert.ok(part, "the rules past six behind one row"); assert.equal(part.hasAttribute("open"), false);
  assert.match(r.textOf(part), /^3 more rules/);
  r.root.querySelectorAll("li").filter((li) => li.getAttribute("role") === "button")[2].click();
  r.button("Move down").click();
  const after = await rulesPage(r.saved[0]);
  const parts = after.root.querySelectorAll("details").filter((x) => !x.classList.contains("form-more"));
  assert.deepEqual(parts.map((x) => [x.dataset.part, x.hasAttribute("open")]), [["rules", false]], "no part opened or shut by the save");
  assert.deepEqual(after.notices(), ["Moved down. It is now rule 4 of 9."]);
});

// ---------------------------------------------------------------- gap #42 critics' findings (2026-11-15)
test("critic F1 (person): Move up / Move down keeps what was typed in the rule's form (not saved) and its More details as it was", async () => {
  const rules = [{ id: "a", contains: "power", category: "utilities", direction: "out", hits: 0 }, { id: "b", contains: "corner", category: "dining", payee: "Corner Coffee", direction: "any", hits: 0 }];
  const live = await liveRules(withRules(rules));
  let root = live.draw();
  root.querySelectorAll("li").filter((li) => li.getAttribute("role") === "button")[1].click();
  let f = root.querySelector("form");
  f.querySelector('[name="payee"]').value = "Corner Cafe EDITED";
  f.querySelector(".form-more").setAttribute("open", "");   // the person opened More details
  f.querySelector('[name="tag"]').value = "treat";
  f.querySelector('[name="amountIs"]').value = "atMost";
  f.querySelector('[name="amountValue"]').value = "12.5";
  live.button(root, "Move up").click();
  assert.deepEqual(live.plan.rules.map((x) => x.id), ["b", "a"]);
  assert.equal(live.plan.rules[0].payee, "Corner Coffee", "a move saves the order only");
  root = live.draw();
  assert.deepEqual(live.notices(root), ["Moved up. It is now the first rule, tried before all the others."]);
  f = root.querySelector("form");
  assert.deepEqual(["payee", "tag", "amountIs", "contains"].map((k) => f.querySelector(`[name="${k}"]`).value), ["Corner Cafe EDITED", "treat", "atMost", "corner"]);
  assert.equal(Number(String(f.querySelector('[name="amountValue"]').value).replace(/[^\d.]/g, "")), 12.5);
  assert.equal(f.querySelector(".form-more").hasAttribute("open"), true, "More details stays open");
  assert.ok(live.button(root, "Move down")); assert.equal(live.button(root, "Move up"), null);
  // Save changes then saves what was typed
  f.reset = () => {};
  f.dispatch("submit");
  assert.deepEqual([live.plan.rules[0].payee, live.plan.rules[0].tag, live.plan.rules[0].amount], ["Corner Cafe EDITED", "treat", { is: "atMost", value: 12.5 }]);
  // opening another rule after a move shows that rule as saved, nothing carried over
  root = live.draw();
  root.querySelectorAll("li").filter((li) => li.getAttribute("role") === "button")[1].click();
  assert.equal(root.querySelector("form").querySelector('[name="contains"]').value, "power");
  assert.equal(root.querySelector("form").querySelector('[name="tag"]').value, "");
});
test("critic F2 (money): 'File N now' changes only the lines it files; a filed line keeps its name, one typed by hand too", async () => {
  const { fileOpen } = await import("./compute.js");
  const tx = (id, payee, more = {}) => ({ id, date: "2026-10-01", payee, rawPayee: payee, amount: -9, accountId: "chk", category: "", tags: [], ...more });
  const lines = [tx("1", "Kroger Dayton", { rawPayee: "KROGER #0421 DAYTON OH", category: "groceries" }), tx("2", "Mom's groceries", { rawPayee: "KROGER #0421 DAYTON OH", category: "groceries" }),
    tx("3", "Gym", {}), tx("4", "KROGER #0421 DAYTON OH", {}), tx("5", "Corner Cafe", {})];
  // a rule that only renames (a merge's, or one typed with no category) above two that file
  const rules = [{ id: "m", contains: "kroger dayton oh", match: "exact", payee: "Kroger", direction: "any", hits: 0 }, { id: "c", contains: "cafe", payee: "Cafe", tag: "treat", direction: "any", hits: 0 },
    { id: "g", contains: "gym", category: "fitness", direction: "any", hits: 0 }, { id: "k", contains: "kroger", category: "groceries", direction: "any", hits: 0 }];
  const r = fileOpen(rules, lines);
  const by = Object.fromEntries(r.txs.map((t) => [t.id, t]));
  assert.equal(by["1"], lines[0], "filed: the very same object"); assert.equal(by["2"], lines[1], "a name typed by hand stays");
  assert.equal(by["5"], lines[4], "no rule files it: a rename alone is not filing");
  assert.deepEqual([by["3"].category, by["4"].category, by["4"].payee], ["fitness", "groceries", "Kroger"], "the lines it files, named by the merge on the way");
  assert.equal(r.changed, 2); assert.deepEqual(r.hits, { g: 1, k: 1, m: 1 });
  assert.equal(r.changed, compute(withRules(rules, lines)).wouldFix, "the button's count is what it does");
  // with no rule that only renames it is the old run, byte for byte
  const old = rules.slice(2);
  assert.deepEqual(fileOpen(old, lines), applyRules(old, lines));
  // on the page
  const page = await rulesPage(withRules(rules, lines));
  page.button("File 2 uncategorized transactions now").click();
  const saved = Object.fromEntries(page.saved[0].transactions.map((t) => [t.id, t]));
  assert.deepEqual([saved["1"].payee, saved["2"].payee, saved["5"].payee, saved["4"].payee], ["Kroger Dayton", "Mom's groceries", "Corner Cafe", "Kroger"]);
  assert.deepEqual((await rulesPage(page.saved[0])).notices(), ["Filed 2 transactions by your rules."]);
});
test("critic F1 (money): the AI categorizer never gives a rule that only renames a category; it adds a rule of its own", async () => {
  const ai = await import("../../ai/categorizer/compute.js");
  const p = withRules([{ id: "m", contains: "kroger", match: "exact", payee: "Kroger Store", direction: "any", hits: 3 }],
    [{ id: "9", date: "2026-10-01", payee: "KROGER 0999", rawPayee: "KROGER 0999", amount: -9, accountId: "chk", category: "" }]);
  const res = ai.applyChoices(p, [{ key: "k", ids: ["9"], rawPayee: "KROGER 0999", category: "groceries" }], { uid: () => "new", today: "2026-11-15" });
  assert.deepEqual(p.rules[0], { id: "m", contains: "kroger", match: "exact", payee: "Kroger Store", direction: "any", hits: 3 }, "the rename rule as it was");
  assert.deepEqual([res.rulesChanged, res.rulesAdded], [[], 1]);
  assert.deepEqual([p.rules[1].id, p.rules[1].category, ruleFiles(p.rules[1])], ["new", "groceries", true]);
  assert.equal(p.transactions[0].category, "groceries");
  // the next import: the rename rule names the line, the AI's rule files it
  const next = applyRules(p.rules, [{ id: "n", payee: "KROGER 1234", rawPayee: "KROGER 1234", amount: -5, accountId: "chk", category: "" }]);
  assert.deepEqual([next.txs[0].payee, next.txs[0].category], ["Kroger Store", "groceries"]);
});
