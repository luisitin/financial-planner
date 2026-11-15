// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("holdings: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("a Vanguard target-date fund typed by its ticker alone is a mix by its year, the fee left unknown", async () => {
  const { classify } = await import("./compute.js");
  const t = classify("vffvx", "", 2026);
  assert.equal(t.cls, "balanced"); assert.equal(t.targetYear, 2055); assert.equal(t.er, null);
  assert.deepEqual(t.mix, { us_stocks: 0.54, intl_stocks: 0.36, bonds: 0.1 }, "29 years out: the glide's 90% stocks");
  assert.equal(classify("VTWNX", "", 2026).targetYear, 2020);
  const inc = classify("VTINX", "", 2026);
  assert.equal(inc.cls, "balanced"); assert.equal(Math.round((inc.mix.us_stocks + inc.mix.intl_stocks) * 100), 30, "the Income fund: the glide's end");
});

// ---------------------------------------------------------------- the page, simple first (opt spec 6.1, done with gap next-60 #8)
const T = "2026-11-15";
const view = new URL("./view.js", import.meta.url);
async function page(plan, route = { rest: [], query: {} }) {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(view, plan, T, { route });
  const partsOf = () => r.root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => ({ id: x.dataset.part, kind: x.dataset.kind, open: x.hasAttribute("open"), title: x.querySelector(".fold-title")?.textContent, status: x.querySelector(".fold-status")?.textContent ?? "" }));
  const button = (words) => r.root.querySelectorAll("button").find((b) => textOf(b) === words);
  return { ...r, textOf, partsOf, button };
}
const fill = (form, typed) => { for (const [k, v] of Object.entries(typed)) form.querySelector(`[name="${k}"]`).value = v; form.reset = () => {}; form.dispatch("submit"); };
const noHoldings = () => { const { investmentsPlan } = INV; const p = investmentsPlan(); p.holdings = []; return p; };
const INV = await import("../../../qa/fixtures/investments-plan.mjs");
// the page brings a saved or new row into view after a redraw: the stand-in DOM has no layout and Node no window
{ const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs"); FakeElement.prototype.getBoundingClientRect ??= () => ({ top: 100, bottom: 200 }); globalThis.window ??= { innerHeight: 844 }; }

test("simple first: the add form asks five boxes (account, symbol, shares, price, what you paid); name, kind, fee and yield wait under More details (optional)", async () => {
  const r = await page(noHoldings());
  const form = r.root.querySelector("form");
  const fold = form.querySelector("details");
  assert.ok(fold && fold.classList.contains("form-more") && !fold.hasAttribute("open"), "the optional boxes, shut");
  const outside = form.all().filter((e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && !e.closest("details")).map((e) => e.getAttribute("name"));
  assert.deepEqual(outside, ["accountId", "symbol", "shares", "price", "costBasis"]);
  const inside = fold.all().filter((e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)).map((e) => e.getAttribute("name"));
  assert.deepEqual(inside.slice(0, 4), ["name", "assetClass", "expenseRatio", "yield"]);
  assert.match(r.textOf(fold.querySelector("summary")), /^More details \(optional\)/);
});

test("R22: an added holding is the same record as before the fold, whether More details (optional) is open or shut", async () => {
  for (const open of [false, true]) {
    const r = await page(noHoldings());
    const form = r.root.querySelector("form");
    if (open) form.querySelector("details").setAttribute("open", "");
    fill(form, { accountId: "brk", symbol: "vxus", shares: "10", price: "65", costBasis: "600", yield: "3" });
    const h = r.saved.at(-1).holdings.at(-1);
    const { id, ...rest } = h;
    assert.ok(id);
    assert.deepEqual(rest, { lots: [], accountId: "brk", symbol: "VXUS", name: "", shares: 10, price: 65, priceAsOf: T, costBasis: 600, assetClass: "", expenseRatio: null, yield: 0.03 }, `fold ${open ? "open" : "shut"}`);
    assert.deepEqual(Object.keys(h), ["id", "lots", "accountId", "symbol", "name", "shares", "price", "priceAsOf", "costBasis", "assetClass", "expenseRatio", "yield"], "the keys of 154a597, in its order");
  }
});

test("a holding with no kind yet opens its form with More details (optional) open, so the kind is in view", async () => {
  const p = INV.investmentsPlan();
  const r = await page(p, { rest: [], query: { edit: "h8" } });   // ACME: "pick a class"
  const form = r.root.querySelector("form");
  assert.ok(form.querySelector("details").hasAttribute("open"));
  r.button("Cancel").click();   // (the page keeps the holding open for editing between draws: shut it again)
  const s = await page(INV.investmentsPlan(), { rest: [], query: { edit: "h1" } });   // VTI: known; its name box is empty, so shut
  assert.ok(!s.root.querySelector("form").querySelector("details").hasAttribute("open"));
  s.button("Cancel").click();
});

test("the importer is one quiet card drawn by the helper: Import a positions file, kind own, shut", async () => {
  const r = await page(INV.investmentsPlan());
  assert.deepEqual(r.partsOf(), [{ id: "import", kind: "own", open: false, title: "Import a positions file", status: "from your brokerage" }]);
  assert.ok(r.root.querySelectorAll("details").every((d) => d.dataset.part !== undefined || d.classList.contains("form-more")), "no <details> by hand (S10)");
  const { PINNED_TITLES } = await import("../../../qa/first-view-lib.mjs");
  assert.ok(PINNED_TITLES.includes("Import a positions file"));
});

test("S11: after a save only the saved part changes: an import keeps the importer open with its green line inside; adding a holding leaves it shut", async () => {
  const fs = await import("node:fs");
  const csv = fs.readFileSync(new URL("../../../qa/fixtures/positions-vanguard.csv", import.meta.url), "utf8");
  const r = await page(INV.investmentsPlan());
  const imp = r.root.querySelectorAll("details").find((d) => d.dataset.part === "import");
  imp.setAttribute("open", "");
  imp.querySelector("textarea").value = csv;
  r.button("Use the pasted text").click();
  const sel = imp.all().find((e) => e.tagName === "SELECT" && e.getAttribute("aria-label") === "Into which account");
  sel.value = "brk"; sel.dispatch("change");
  r.root.querySelectorAll("button").find((b) => /^Import \d+ positions?$/.test(r.textOf(b))).click();
  assert.equal(r.saved.length, 1);
  const again = await page(r.saved[0]);
  assert.deepEqual(again.partsOf().map((x) => [x.id, x.open]), [["import", true]]);
  const inside = again.textOf(again.root.querySelector("details .fold-body") ?? again.root.querySelector("details"));
  assert.match(inside, /\d+ added, \d+ updated in Brokerage\. Holdings already on file that the file did not list were left alone\./);
  assert.equal(again.root.querySelectorAll(".notice").filter((n) => !n.closest("details") && n.classList.contains("ok")).length, 0, "said once, inside");
  // a holding added with the add form: the importer is drawn shut as before, the green line at the top
  const next = await page(again.saved.length ? again.saved.at(-1) : r.saved[0]);
  assert.deepEqual(next.partsOf().map((x) => [x.id, x.open]), [["import", false]]);
  next.button("+ Add a holding").click();
  fill(next.root.querySelector("form"), { accountId: "brk", symbol: "VXUS", shares: "5", price: "60" });
  const after = await page(next.saved.at(-1));
  assert.deepEqual(after.partsOf().map((x) => [x.id, x.open]), [["import", false]]);
  assert.match(after.text(), /VXUS added to Brokerage\./);
});

test("How often it pays (gap next-60 #8): saved only when chosen, taken off when set back to usual, said in the green line", async () => {
  const p = INV.investmentsPlan();
  const r = await page(p, { rest: [], query: { edit: "h1" } });   // VTI
  const sel = r.root.querySelector("form").querySelector('[name="paysEvery"]');
  assert.ok(sel.closest("details"), "under More details (optional)");
  assert.deepEqual(sel.querySelectorAll("option").map((o) => r.textOf(o)), ["As usual for its kind", "Every month", "Every 3 months", "Twice a year", "Once a year"]);
  fill(r.root.querySelector("form"), { paysEvery: "year" });
  const saved = r.saved.at(-1).holdings.find((h) => h.id === "h1");
  assert.equal(saved.paysEvery, "year");
  const shown = await page(r.saved.at(-1));
  assert.match(shown.text(), /VTI saved\. Dividends now counts it as paying once a year\./);
  // set back to usual: the field goes, the record is what it was
  const back = await page(r.saved.at(-1), { rest: [], query: { edit: "h1" } });
  assert.equal(back.root.querySelector("form").querySelector('[name="paysEvery"]').value, "year");
  fill(back.root.querySelector("form"), { paysEvery: "" });
  const again = back.saved.at(-1).holdings.find((h) => h.id === "h1");
  assert.ok(!("paysEvery" in again));
  const before = p.holdings.find((h) => h.id === "h1");
  assert.deepEqual(Object.keys(again).sort(), Object.keys(before).sort());
  const words = await page(back.saved.at(-1));
  assert.match(words.text(), /VTI saved\. Dividends now counts it as paying as usual for its kind\./);
  // saved unchanged: no word about it
  const same = await page(INV.investmentsPlan(), { rest: [], query: { edit: "h2" } });
  fill(same.root.querySelector("form"), {});
  assert.doesNotMatch((await page(same.saved.at(-1))).text(), /Dividends now counts/);
});
