// tests/levers-before.test.mjs -- "Before your change" on Will the money last? (modules/retirement/projection/view.js, D-A6) after the
// review of 2026-11-12: said only after a change that moved the answer, turned the headline or changed a number the person sets
// (B6); the headline's own words first when they turned, and the answer said as the average-market answer it is (F5); the same
// sentence first in the card on arriving back, with the row that changed kept in view (F3); taps held just after the hero's
// filled button scrolls the page (B4); no link to a pay stub reader that reads a Roth line as pre-tax (B8).
// Households: the invented phone-built ones (qa/fixtures/phone-households.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import * as LV from "../modules/retirement/levers.js";
import { migrate } from "../core/schema/migrate.js";
import { compute as nbaCompute } from "../modules/overview/next-best-action/compute.js";
import { danaLee, jamie, casey, robin, morgan } from "../qa/fixtures/phone-households.mjs";

const T = "2026-11-11";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VIEW = pathToFileURL(path.join(ROOT, "modules/retirement/projection/view.js")).href;
const cOf = { "overview/next-best-action": nbaCompute };
const spareOf = (plan) => { const n = nbaCompute(plan, { today: T }); return n.ready ? n.spare : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const route = () => ({ rest: [], query: {} });   // a new object: a new arrival, as the router makes one per address
const lineOf = (r) => r.root.querySelector(".lv-before");
const cardNotice = (r) => r.root.querySelector(".lv")?.querySelector(".notice") ?? null;
const whatChanged = (r) => r.root.querySelector(".lv-what");
async function settled(r, { head = false } = {}) {
  // the card's rows (and, with `head`, the headline's own words) are worked out after the first paint
  for (let i = 0; i < 200; i++) {
    const busy = r.root.querySelector(".lv-rows")?.getAttribute("aria-busy");
    const checking = head && /Checking your plan/.test(r.root.all().find((e) => e.tagName === "H1")?.textContent ?? "");
    if (!busy && !checking) return;
    await sleep(50);
  }
}

test("B8: no row links to the pay stub reader until it reads a Roth 401(k) line apart from the pre-tax one (L7)", () => {
  for (const mk of [danaLee, jamie, casey, robin, morgan]) {
    const p = migrate(mk());
    const r = LV.leverRows(p, { today: T, spare: spareOf(p) });
    for (const x of [...r.shown, ...r.folded, ...r.hidden]) for (const a of x.acts ?? []) assert.doesNotMatch(String(a.href ?? ""), /ai\/reader/, `${x.key}: ${a.label}`);
  }
});

test("B6: the left-over, not answered, is a result: a bill that moves it is not named as a change the person made", () => {
  const a = migrate(jamie());
  const b = migrate(jamie()); b.expenses.push({ id: "streaming", name: "Streaming", amount: 20, period: "monthly", category: "fun" });
  const va = LV.valuesOf(LV.leverList(a, { today: T, spare: spareOf(a) })), vb = LV.valuesOf(LV.leverList(b, { today: T, spare: spareOf(b) }));
  assert.equal(va.leftover.short, "$567 a month"); assert.equal(vb.leftover.short, "$547 a month");
  assert.deepEqual(LV.changedWords(va, vb), []);
});

test("B6: a balance update, a renamed account or a $20 bill that moves nothing draws no 'Before your change' line", async () => {
  const base = migrate(jamie());
  await renderPage0(base);
  const checking = base.accounts.find((x) => x.type === "checking");
  const steps = [
    (p) => { p.accounts.find((x) => x.id === checking.id).balance += 100; },
    (p) => { p.accounts.find((x) => x.id === checking.id).name = "Everyday"; },
    (p) => { p.expenses.push({ id: "streaming", name: "Streaming", amount: 20, period: "monthly", category: "fun" }); },
  ];
  let plan = base;
  for (const change of steps) {
    plan = structuredClone(plan); change(plan);
    const r = await renderPage0(plan);
    assert.equal(lineOf(r), null, r.text().slice(0, 300));
    assert.equal(cardNotice(r), null);
  }
});
async function renderPage0(plan, r0 = route()) {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  return renderPage(VIEW, plan, T, { route: r0, computeOf: cOf });
}

test("F3, F5: back from a change elsewhere: the line says the average-market answer, the card says it first, the row that changed is first and says what it was", async () => {
  const before = migrate(jamie());
  await renderPage0(before);
  const after = structuredClone(before);
  after.retirement.contributions.find((c) => c.id === "setup-contrib-setup-self").employerMatch = 2040;
  delete after.retirement.workPlans["setup-self"].match;
  const back = route();
  const r = await renderPage0(after, back);
  const words = "If markets do as well as average, before your change: runs out at 70. Now: runs out at 74. You changed the match at Jamie's job (none → $2,040 a year).";
  // the hero says one sentence and what was changed (simple first, review 2026-11-12, P12; in sight since 2026-11-13); the card,
  // where the person lands, says it all
  assert.equal(lineOf(r).textContent, "If markets do as well as average, before your change: runs out at 70. Now: runs out at 74.");
  assert.equal(whatChanged(r).textContent, "You changed the match at Jamie's job (none → $2,040 a year).");
  // said in sight, not as a row that opens (the first view keeps to five such rows: docs/OPTIONAL.md R1)
  assert.equal(whatChanged(r).tagName, "P");
  assert.equal(r.root.querySelector(".hero").querySelectorAll("details").length, 0);
  assert.equal(cardNotice(r).textContent, words);
  await settled(r);
  const first = r.root.querySelector(".lv-rows").children[0];
  assert.equal(first.getAttribute("data-lever"), "match:setup-contrib-setup-self");
  assert.match(first.textContent, /You just changed this: none → \$2,040 a year\./);
  // a redraw of the same arrival (a save on this page) keeps the hero's line and does not repeat it in the card
  const again = structuredClone(after); again.retirement.contributions.find((c) => c.id === "setup-contrib-setup-self").amount = 260;
  const r2 = await renderPage0(again, back);
  assert.ok(lineOf(r2));
  assert.equal(cardNotice(r2), null);
});

test("F5: a headline that turned is said first, in its own words, once checked", { timeout: 60000 }, async () => {
  const p = migrate(danaLee());
  const r1 = await renderPage0(p);
  await settled(r1, { head: true });
  const h1 = r1.root.all().find((e) => e.tagName === "H1").textContent;
  assert.equal(h1, "It lasts in most cases, not all");
  // $1,820 a month more into an account of Dana's: tight turns to on track
  const q = structuredClone(p);
  q.accounts.push({ id: "n-inv", name: "Investments for later", type: "brokerage", balance: 0, ownerId: "setup-self", history: [] });
  q.retirement.contributions.push({ id: "c-inv", accountId: "n-inv", personId: "setup-self", amount: 1820, period: "monthly", employerMatch: 0 });
  const r2 = await renderPage0(q);
  // drawn at once with a grey bar where the new headline goes (it is still being checked), filled when it comes
  assert.equal(lineOf(r2).textContent, "Before your change: It lasts in most cases, not all. Now: .");
  await settled(r2, { head: true });
  assert.equal(lineOf(r2).textContent, "Before your change: It lasts in most cases, not all. Now: The money lasts.");
  // the average-market answer under a headline that turned opens the card (on track: the card is shut, with no notice of its own)
  assert.match(r2.root.querySelector(".lv").querySelector(".lv-also").textContent, /^If markets do as well as average, before your change: lasts to the end \(age 97\), about \$261,000 left in today's dollars\. Now: lasts to the end \(age 97\), about \$1,425,000 left in today's dollars\./);
});

test("B4: just after the hero's filled button scrolls the page, a second tap on the page is let go", async () => {
  const r = await renderPage0(migrate(jamie()));
  const btn = r.root.all().find((e) => e.tagName === "BUTTON" && e.textContent === "Check the numbers behind this ↓");
  btn.click();
  let stopped = 0;
  r.root.dispatch("click", { preventDefault() { stopped++; }, stopPropagation() {} });
  r.root.dispatch("pointerdown", { preventDefault() { stopped++; }, stopPropagation() {} });
  assert.equal(stopped, 2);
});

// ---- simple first (owner, 2026-11-12) and the review's view findings ----
test("simple first: the card shows three rows and folds the rest, but never a number that is not counted yet; the intro is one sentence", async () => {
  for (const mk of [jamie, danaLee, casey]) {
    await renderPage0(migrate(mk()));   // (the page remembers the last answer it drew: a first drawing of this household)
    const r = await renderPage0(migrate(mk()));
    await settled(r);
    const card = r.root.querySelector(".lv");
    const rows = [...r.root.querySelector(".lv-rows").children];
    const list = LV.leverList(migrate(mk()), { today: T, spare: spareOf(migrate(mk())) });
    const missing = list.rows.filter((x) => x.tag === "missing").length;
    assert.equal(rows.length, Math.max(3, missing), `${mk.name}: three rows, or every row not counted yet`);
    for (const x of list.rows.filter((y) => y.tag === "missing")) assert.ok(rows.some((li) => li.getAttribute("data-lever") === x.key), `${mk.name}: ${x.key} is not folded`);
    assert.match(card.textContent, /The numbers this answer uses, whose each one is, and what one change would do if markets do as well as average\./);
    assert.match(card.textContent, /\d+ more numbers?(, \d+ you gave us)?›/, `${mk.name}: the rest one quiet tap away`);
  }
});

test("P21: the line of what the answer rests on and the one filled button come right after the answer's own words, before the bad-run lines", async () => {
  const r = await renderPage0(migrate(jamie()));
  const hero = r.root.querySelector(".hero");
  const kids = hero.children.map((e) => e.textContent);
  const lede = kids.findIndex((t) => /^Short\. If markets do as well as average/.test(t));
  const rests = kids.findIndex((t) => /^This answer rests on \d+ numbers/.test(t));
  const buttons = kids.findIndex((t) => /Check the numbers behind this ↓/.test(t));
  const bad = kids.findIndex((t) => /bad run of years/.test(t));
  assert.ok(lede >= 0 && rests === lede + 1 && buttons === rests + 1 && bad > buttons, JSON.stringify([lede, rests, buttons, bad]));
});

test("P19: no Go deeper while the answer is 'We don't know yet'", async () => {
  const { finishSetup, sam } = await import("../qa/fixtures/setup-personas.mjs");
  const s = migrate(finishSetup("sam", sam(T), T));
  const r = await renderPage0(s);
  assert.match(r.text(), /We don't know yet|You haven't told us about retirement savings/);
  assert.doesNotMatch(r.text(), /Go deeper/);
  assert.match((await renderPage0(migrate(jamie()))).text(), /Go deeper/);
});

test("N4: the spending row's 'Change ›' opens the settings in place (a button, never a link to this page's own address)", async () => {
  // every phone-built household whose card lists the spending row (shown or folded): at least one must, or the test says nothing
  let seen = 0;
  for (const make of [jamie, casey, danaLee, robin, morgan]) {
    const r = await renderPage0(migrate(make()));
    await settled(r);
    const li = r.root.querySelector(".lv").querySelectorAll("li").find((x) => x.getAttribute("data-lever") === "spending");
    if (!li) continue;
    const change = [...li.querySelectorAll("a"), ...li.querySelectorAll("button")].filter((x) => x.textContent === "Change ›");
    assert.equal(change.length, 1);
    assert.equal(change[0].tagName, "BUTTON");
    assert.doesNotMatch(change[0].getAttribute("href") ?? "", /retirement\/projection/);
    seen++;
  }
  assert.ok(seen >= 1, "no household lists the spending row");
});

test("P7: Retirement settings: the spending box and Save first, the six other settings one quiet tap away; the save says what it did to the answer", async () => {
  const p = migrate(jamie());
  const r = await renderPage0(p);
  const settings = r.root.querySelectorAll("details").find((x) => /pj-settings/.test(x.className));
  const more = settings.querySelectorAll("details").find((x) => /pj-more/.test(x.className));
  assert.match(more.textContent, /^More settings \(stocks, tax, how much to take out\)as usual›/);
  for (const k of ["stocksNow", "stocksRetired", "taxMode", "taxRate", "strategy", "withdrawalRate"]) assert.ok(more.querySelector(`[name="${k}"]`), `${k} in the fold`);
  const form = settings.querySelector("form");
  assert.ok(form.querySelector('[name="spendingMonthly"]').closest("details") === settings, "the spending box is not folded");
  form.querySelector('[name="spendingMonthly"]').value = "2898";
  form.reset = () => {};
  form.dispatch("submit");
  assert.equal(r.saved.length, 1);
  const after = await renderPage0(r.saved[0]);
  assert.match(after.text(), /Retirement settings saved\. Your retirement answer: now runs out at 73 \(was 70\)\./);
  // a setting not at the usual figure: the fold's line says so
  const q = migrate(jamie()); q.retirement.stocksRetired = 0.3;
  const r3 = await renderPage0(q);
  assert.match(r3.root.querySelectorAll("details").find((x) => /pj-more/.test(x.className)).textContent, /1 changed/);
  // a save that changes settings under the closed fold names them (the final review F3, 2026-11-13)
  const r4 = await renderPage0(migrate(jamie()));
  const f4 = r4.root.querySelectorAll("details").find((x) => /pj-settings/.test(x.className)).querySelector("form");
  f4.querySelector('[name="stocksNow"]').value = "85";
  f4.querySelector('[name="taxMode"]').value = "brackets";
  f4.reset = () => {};
  f4.dispatch("submit");
  assert.equal(r4.saved[0].retirement.stocksNow, 0.85);
  assert.match((await renderPage0(r4.saved[0])).text(), /Retirement settings saved: share in stocks now 70% → 85%; how tax is worked out: the federal brackets on each year's income\. Your retirement answer: /);
});
