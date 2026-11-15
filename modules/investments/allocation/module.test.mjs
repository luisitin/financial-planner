// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("allocation: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// the round-3 walk-through's household (qa/fixtures/held-plan.mjs)
const held = async () => (await import("../../../qa/fixtures/held-plan.mjs")).heldPlan();

test("no target of your own: no drift is called; three mixes to pick, each keeping what is held inside stocks and inside the rest", async () => {
  const p = await held(), T = { today: "2026-11-02" };
  const a = compute(p, T);
  assert.equal(a.targetSource, "plan"); assert.equal(a.verdict, "pick");
  assert.deepEqual(a.choices.map((c) => c.key), ["now", "fund", "plan"]);
  const fund = a.choices.find((c) => c.key === "fund");
  assert.equal(fund.year, 2055); assert.ok(Math.abs(fund.stocks - 0.9) < 0.006, "a 2055 fund holds about 90% stocks in 2026");
  const sum = (m) => Object.values(m).reduce((s, x) => s + x, 0);
  for (const c of a.choices) assert.ok(Math.abs(sum(c.mix) - 1) < 1e-9);
  const usOverIntl = (m) => m.us_stocks / (m.us_stocks + m.intl_stocks);
  assert.ok(Math.abs(usOverIntl(fund.mix) - usOverIntl(a.choices[0].mix)) < 0.01, "US against international as held");
  // picking 90% when 92% is held: close to target, not a trade between US and international
  p.investments = { ...(p.investments ?? {}), target: fund.mix };
  const b = compute(p, T);
  assert.equal(b.verdict, "ok"); assert.equal(b.flaggedCount, 0);
  // most of the money not classified: no verdict
  p.holdings = p.holdings.filter((h) => h.id === "h6");
  assert.equal(compute(p, T).verdict, "partial");
});

test("holdings with no class are named in dollars; a 2055 fund typed by ticker alone gives the fund choice", () => {
  const p = investmentsPlan();
  const d = compute(p, { today: "2026-09-16" });
  const note = d.notes.find((n) => /have no asset class/.test(n));
  assert.match(note, /^\$90,000 of holdings have no asset class yet/, "ACME: 500 x $180");
  p.holdings.find((h) => h.symbol === "VFFVX").name = "";
  const c = compute(p, { today: "2026-09-16" }).choices.find((x) => x.key === "fund");
  assert.equal(c?.year, 2055);
});

test("review: a guess comes first (no mix to pick while most money is not typed in); the one-tap mixes never become REITs, gold or cash", async () => {
  const { targetDateMix } = await import("../holdings/compute.js");
  const T = { today: "2026-11-02" };
  // one bond fund typed, $177,000 in the investment accounts: a guess, not a mix to pick
  const g = await held(); g.holdings = g.holdings.filter((h) => h.symbol === "BND");
  const dg = compute(g, T);
  assert.equal(dg.verdict, "partial", "partial is checked before pick"); assert.ok(dg.known < 0.1);
  assert.match(dg.notes.find((n) => /holdings cover/.test(n)), /of the \$\d/, "the dollars in the note carry a $");
  // a brokerage with VTI and one other thing, nothing else invested
  const one = async (sym, cls, value) => {
    const p = await held(); const t = "2026-11-02";
    p.holdings = [{ id: "a", accountId: "a-brk", symbol: "VTI", name: "", shares: 100, price: 300, priceAsOf: t, costBasis: 30000, assetClass: "", lots: [] },
      { id: "b", accountId: "a-brk", symbol: sym, name: "", shares: value / 100, price: 100, priceAsOf: t, costBasis: value, assetClass: cls, lots: [] }];
    for (const id of ["a-401", "a-roth", "a-bk401"]) p.accounts.find((x) => x.id === id).balance = 0;
    p.accounts.find((x) => x.id === "a-brk").balance = 30000 + value;
    return compute(p, T);
  };
  const gold = await one("GLD", "", 10000);
  assert.equal(gold.restWords, "gold and other", "the hero names the 25% as gold, not bonds and cash");
  const pg = gold.choices.find((c) => c.key === "plan").mix;
  assert.ok(pg.other <= 0.25 + 1e-9 && Math.abs(pg.us_stocks - 0.7) < 0.011 && pg.bonds > 0, JSON.stringify(pg));
  const cash = await one("SPAXX", "cash", 10000);
  const pc = cash.choices.find((c) => c.key === "plan").mix;
  assert.equal(pc.cash, 0, "no bonds held: the rest of the plan's mix is bonds, not 30% cash"); assert.ok(Math.abs(pc.bonds - 0.3) < 0.011);
  assert.equal(cash.restWords, "cash");
  const reit = await one("VNQ", "", 30000);
  const pr = reit.choices.find((c) => c.key === "plan").mix;
  assert.ok(pr.real_estate <= 0.5 + 1e-9 && pr.us_stocks > 0, "REITs keep no more than they hold; never 70% REITs");
  assert.equal(reit.restWords, "", "100% stocks (REITs count as stocks): nothing to name");
  // the glide's parts add to 1 after rounding (the 2030 fund was 101%)
  for (const y of [2030, 2040, 2055, 2020]) { const m = targetDateMix(y, 2026); assert.ok(Math.abs(m.us_stocks + m.intl_stocks + m.bonds - 1) < 1e-9, `${y}: ${JSON.stringify(m)}`); }
});

// ---------------------------------------------------------------- regions and sectors (gap list, next 60, item 49)
import { REGIONS, SECTORS, checkSplit, splitOf, regionMix, stockPart } from "./compute.js";
import * as W from "./words.js";
import { migrate } from "../../../core/schema/migrate.js";
const T2 = "2026-11-13";
const near = (a, b, tol = 1e-9, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const rowOf = (d, cls) => d.rows.find((r) => r.cls === cls);

test("a typed split must come to 100: plain words otherwise; blanks count as 0; within half a point is 100", () => {
  assert.deepEqual(REGIONS.map((r) => r.label), ["United States", "Other rich countries", "Emerging countries"]);
  assert.deepEqual(SECTORS.map((r) => r.label), ["Technology and communication", "Health care", "Banks and insurance", "Shops and brands", "Everything else"]);
  const ok = checkSplit("region", { us: 60, rich: 30, emerging: 10 });
  assert.equal(ok.ok, true); assert.deepEqual(ok.shares, { us: 0.6, rich: 0.3, emerging: 0.1 });
  assert.equal(checkSplit("region", { us: 100, rich: null, emerging: "" }).ok, true, "blanks are 0");
  const off = checkSplit("region", { us: 60, rich: 20, emerging: 10 });
  assert.equal(off.ok, false); assert.equal(off.error, "These add up to 90%. Make them come to 100%, so all of the fund's stocks are counted.");
  assert.equal(checkSplit("sector", { tech: 40.2, health: 10, money: 14, shops: 16, rest: 20.2 }).ok, true, "100.4 is 100");
  assert.equal(checkSplit("sector", { tech: 41, health: 10, money: 14, shops: 16, rest: 20 }).error, "These add up to 101%. Make them come to 100%, so all of the fund's stocks are counted.");
  assert.equal(checkSplit("region", {}).error, "Type a share in at least one box, or tap Cancel.");
  assert.equal(checkSplit("region", { us: -10, rich: 110 }).ok, false);
  assert.equal(checkSplit("region", { us: -10, rich: 110 }).error, "A share cannot be below 0.");
  assert.equal(checkSplit("region", { us: "abc" }).error, "Type a number in each box, or leave it blank.", "not 'below 0' for text (critic M5)");
  near(Object.values(checkSplit("sector", { tech: 40.2, health: 10, money: 14, shops: 16, rest: 20.2 }).shares).reduce((a, b) => a + b, 0), 1, 1e-12);
  // what is saved is read back only when it makes sense
  assert.deepEqual(splitOf({ regions: { us: 0.6, rich: 0.3, emerging: 0.1 } }, "region"), { us: 0.6, rich: 0.3, emerging: 0.1 });
  assert.equal(splitOf({ regions: { us: 0.6, rich: 0.3 } }, "region"), null, "90%: not read");
  assert.equal(splitOf({ regions: "60/40" }, "region"), null);
  assert.equal(splitOf({}, "sector"), null);
});

test("a region split re-splits only that fund's stocks into US and international; one equal to our rough guide, or on a bond fund, changes nothing", () => {
  const base = compute(investmentsPlan(), { today: T2 });
  // VFFVX, the 2055 target-date fund: $200,000, 90% stocks, our rough guide 60/40 of them
  const p = investmentsPlan();
  const f = p.holdings.find((h) => h.symbol === "VFFVX");
  f.regions = { us: 0.5, rich: 0.35, emerging: 0.15 };
  const d = compute(p, { today: T2 });
  near(rowOf(d, "us_stocks").value, rowOf(base, "us_stocks").value + 200000 * 0.9 * (0.5 - 0.6), 1e-6, "US: 18,000 less");
  near(rowOf(d, "intl_stocks").value, rowOf(base, "intl_stocks").value + 200000 * 0.9 * (0.5 - 0.4), 1e-6, "international: 18,000 more");
  assert.deepEqual(d.rows.map((r) => [r.cls, r.value]).filter(([c]) => !/stocks/.test(c)), base.rows.map((r) => [r.cls, r.value]).filter(([c]) => !/stocks/.test(c)), "bonds, cash, REITs unchanged");
  assert.equal(d.total, base.total);
  const acct = (x) => x.byAccountClass.find((a) => a.accountId === "k401").classes;
  near(acct(d).us_stocks, acct(base).us_stocks - 18000, 1e-6); near(acct(d).intl_stocks, acct(base).intl_stocks + 18000, 1e-6);
  assert.equal(JSON.stringify(regionMix({ mix: { bonds: 1 }, regions: { us: 1 } })), JSON.stringify({ bonds: 1 }), "no stocks: nothing to split");
  assert.equal(stockPart({ us_stocks: 0.54, intl_stocks: 0.36, bonds: 0.1 }), 0.9);
  // a split equal to the table (FXAIX: all US) goes the new way and gives the same rows, byte for byte
  const q = investmentsPlan(); q.holdings.find((h) => h.symbol === "FXAIX").regions = { us: 1, rich: 0, emerging: 0 };
  assert.equal(JSON.stringify(compute(q, { today: T2 }).rows), JSON.stringify(base.rows));
  // a split by kind of business never changes a figure (the holdings passed through carry the field, nothing else)
  const s = investmentsPlan(); s.holdings.find((h) => h.symbol === "VTI").sectors = { tech: 0.4, health: 0.1, money: 0.13, shops: 0.16, rest: 0.21 };
  const { holdings: hs, ...figs } = compute(s, { today: T2 }), { holdings: hb, ...figb } = base;
  assert.equal(JSON.stringify(figs), JSON.stringify(figb));
  assert.equal(JSON.stringify({ ...hs, items: hs.items.map(({ sectors, ...x }) => x) }), JSON.stringify(hb));
});

test("the stocks by region and by kind of business add up to the stocks; the funds still on our rough guide are named", () => {
  const p = investmentsPlan();
  p.holdings.find((h) => h.symbol === "VFFVX").regions = { us: 0.5, rich: 0.35, emerging: 0.15 };
  p.holdings.find((h) => h.symbol === "VTI").sectors = { tech: 0.4, health: 0.1, money: 0.13, shops: 0.16, rest: 0.21 };
  p.holdings.find((h) => h.symbol === "FXAIX").sectors = { tech: 0.45, health: 0.09, money: 0.13, shops: 0.15, rest: 0.18 };
  const sp = compute(p, { today: T2, splits: true }).splits;
  // FXAIX $318,000, VFFVX $180,000 of stocks, VTIAX $144,000, VTI $87,000 (ACME has no class, BND and SPAXX no stocks, VNQ is REITs)
  assert.deepEqual(sp.holdings.map((x) => [x.symbol, x.stockValue]), [["FXAIX", 318000], ["VFFVX", 180000], ["VTIAX", 144000], ["VTI", 87000]]);
  assert.equal(sp.stockValue, 729000);
  near(sp.regions.rows.reduce((s, r) => s + r.value, 0), sp.stockValue, 1e-6, "regions add to the stocks");
  near(sp.regions.rows.reduce((s, r) => s + r.share, 0), 1, 1e-12);
  assert.deepEqual(sp.regions.rows.map((r) => [r.key, Math.round(r.value)]), [["us", 318000 + 90000 + 87000], ["rich", 63000], ["emerging", 27000], ["outside", 144000]]);
  assert.deepEqual(sp.regions.table, ["VTIAX"], "the only fund whose international part is not split");
  assert.equal(sp.sectors.split, 318000 + 87000); assert.equal(sp.sectors.notSplit, 324000);
  near(sp.sectors.rows.reduce((s, r) => s + r.value, 0), sp.sectors.split, 1e-6, "sectors add to the stocks split");
  near(sp.sectors.rows.find((r) => r.key === "tech").share, (318000 * 0.45 + 87000 * 0.4) / 405000, 1e-12);
  assert.deepEqual(sp.sectors.table, ["VFFVX", "VTIAX"]); assert.equal(sp.typed, 3);
  // every sentence, one per case
  assert.equal(W.regionSaved("VFFVX", sp.regions.rows), "Saved for VFFVX. Your stocks are now 68% in the United States, 9% in other rich countries, 4% in emerging countries and 20% outside the US, not split yet.");
  assert.equal(W.sectorSaved("VTI", sp.sectors, "USD"), "Saved for VTI. Of the $405,000 of stocks split by kind of business, 44% is technology and communication, the largest part.");
  assert.equal(W.tableAgain("VFFVX", "region", sp.regions.rows), "Saved: VFFVX uses our rough guide again. Your stocks are now 68% in the United States, 9% in other rich countries, 4% in emerging countries and 20% outside the US, not split yet.");
  assert.equal(W.tableAgain("VTI", "sector"), "Saved: VTI is no longer split by kind of business.");
  assert.equal(W.splitBack("VTI"), "VTI's split is as it was.");
  assert.equal(W.regionTableLine([]), "Every fund's stocks are split by region.");
  assert.equal(W.regionTableLine(["VTIAX"]), "VTIAX still splits only into US and international, from our rough guide.");
  assert.equal(W.regionTableLine(["FFFHX", "VTIAX", "VT"]), "3 funds still split only into US and international, from our rough guide: FFFHX, VTIAX and VT.");
  assert.equal(W.sectorLine(sp.sectors, "USD"), "Over the $405,000 of stocks split so far; not split yet: VFFVX and VTIAX.");
  assert.equal(W.sectorLine({ typed: 0 }, "USD"), "No fund is split by kind of business yet.");
  assert.equal(W.sectorLine({ typed: 2, table: [], split: 405000 }, "USD"), "Every fund's stocks are split by kind of business, $405,000 in all.");
  assert.equal(W.fundSub(sp.holdings[1]), "your split: 50% US, 35% other rich, 15% emerging");
  assert.equal(W.fundSub(sp.holdings[0]), "our rough guide: 100% US · split by kind of business");
  assert.equal(W.fundSub(sp.holdings[2]), "our rough guide: 0% US, 100% international");
  assert.equal(W.SPLITS_INTRO, "Our rough guide only tells US from international. A fund's own page on its company's website, usually under \"Portfolio\" or \"Composition\", lists where its stocks are and what kinds of business they are in: copy those percentages here.");
  // the buttons and the line over the boxes, one per case (critic P3)
  assert.equal(W.splitButton(sp.holdings[2]), "Split VTIAX by region");
  assert.equal(W.splitButton(sp.holdings[1]), "Change VFFVX's split");
  assert.equal(W.splitButton({ symbol: "Vanguard Target 2055", table: {} }), "Split it by region", "a long name is not put on the button");
  assert.equal(W.splitButton({ symbol: "Vanguard Target 2055", sectors: {}, table: {} }), "Change its split");
  assert.equal(W.guideLine(sp.holdings[3]), "Our rough guide puts all of VTI's stocks in the United States. Check it against the fund's page.");
  assert.equal(W.guideLine(sp.holdings[2]), "Our rough guide puts all of VTIAX's stocks outside the US: split the 100 between other rich and emerging countries as the fund's page shows.");
  assert.equal(W.guideLine({ symbol: "VFFVX", table: { us: 0.6, intl: 0.4 } }), "Our rough guide puts 60% of VFFVX's stocks in the United States and 40% outside it: check the 60 against the fund's page, then split the 40 between the other two.");
  assert.deepEqual([W.guideValues(sp.holdings[3]), W.guideValues(sp.holdings[2]), W.guideValues({ table: { us: 0.6 } })], [{ us: 100 }, {}, { us: 60 }]);
});

/** The page as the shell runs it: a store that keeps each update, the redraw after it (the shell's comes 50 ms after the tap). */
async function harness(plan, today = T2) {
  const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const revealed = [];
  const ui = { ...(await import("../../../core/ui/dom.js")), reveal: (el, o) => { revealed.push([el, o]); return false; } };
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  let p = migrate(structuredClone(plan)), root = null;
  const saved = [];
  const ctx = { ui, fmt: { ...fmt, today: () => today }, get plan() { return p; }, route: { group: "investments", id: "allocation", rest: [], query: {} }, module: { group: "investments", id: "allocation" },
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); p = d; saved.push(d); } }, redraw: () => draw() };
  const draw = () => { root = new FakeElement("main"); render(root, ctx); return root; };
  draw();
  const partOf = (id) => root.querySelectorAll("details").find((x) => x.dataset.part === id);
  const states = () => root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]);
  return { get root() { return root; }, get plan() { return p; }, saved, draw, partOf, states, revealed };
}

test("S11: after a split is saved only Regions and sectors opens, with the green line naming the new mix and Undo; the save writes that holding's field only", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(!/h\("details"/.test(src), "no <details> by hand: every fold is a part");
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { _test } = await import("./view.js"); _test.reset();
  const h = await harness(investmentsPlan());
  const before = JSON.stringify(h.plan);
  assert.deepEqual(h.states(), [["accounts", false], ["splits", false], ["target", false]], "three rows, in the helper's order, shut");
  assert.equal(h.partOf("splits").querySelector(".fold-status").textContent, "not set yet");
  assert.equal(h.partOf("target").querySelector(".fold-status").textContent, "70% stocks");
  assert.equal(h.partOf("splits").querySelector("form"), null, "no box until a fund is picked");
  // pick VFFVX: its form opens under its row, the row stays open
  const btn = (label, at = h.partOf("splits")) => at.querySelectorAll("button").find((x) => x.textContent === label);
  const vffvx = () => h.partOf("splits").querySelectorAll("li").find((li) => li.querySelector(".rec-title")?.textContent.startsWith("VFFVX"));
  btn("Split VFFVX by region", vffvx()).click();
  assert.deepEqual(_test.editing, { id: "h5", kind: "region" });
  assert.deepEqual(h.states(), [["accounts", false], ["splits", true], ["target", false]]);
  const form = vffvx().querySelector("form");
  const box = (n) => form.querySelectorAll("input").find((x) => x.getAttribute("name") === n);
  assert.deepEqual(form.querySelectorAll("input").map((x) => x.getAttribute("name")), ["us", "rich", "emerging"]);
  // 90 is held back, in plain words
  box("us").value = "50"; box("rich").value = "30"; box("emerging").value = "10";
  form.dispatch("submit");
  assert.equal(h.saved.length, 0);
  box("emerging").value = "20";
  form.dispatch("submit");
  assert.equal(h.saved.length, 1);
  assert.deepEqual(h.plan.holdings.find((x) => x.id === "h5").regions, { us: 0.5, rich: 0.3, emerging: 0.2 });
  const was = JSON.parse(before);
  const strip = (q) => ({ ...q, holdings: q.holdings.map(({ regions, ...x }) => x), meta: null });
  assert.equal(JSON.stringify(strip(h.plan)), JSON.stringify(strip(was)), "nothing else in the plan");
  // the shell's redraw: only Regions and sectors open, its green line names the new mix, with Undo
  h.draw();
  assert.deepEqual(h.states(), [["accounts", false], ["splits", true], ["target", false]]);
  const ok = h.partOf("splits").querySelector(".notice.ok");
  assert.ok(textOf(ok).startsWith("Saved for VFFVX. Your stocks are now 68% in the United States, 7% in other rich countries, 5% in emerging countries and 20% outside the US, not split yet."), textOf(ok));
  assert.equal(h.partOf("splits").querySelector(".fold-status").textContent, "1 set by you");
  assert.match(textOf(h.root), /US stocks 56%/, "the first view's rows use the split");
  // Undo: the field goes, the next draw says so
  btn("Undo", ok).click();
  assert.equal(h.plan.holdings.find((x) => x.id === "h5").regions, undefined);
  h.draw();
  assert.equal(textOf(h.partOf("splits").querySelector(".notice.ok")), "VFFVX's split is as it was.");
  // by kind of business, then Use our rough guide again
  btn("Split VFFVX by region", vffvx()).click();
  btn("By kind of business", vffvx()).click();
  assert.deepEqual(_test.editing, { id: "h5", kind: "sector" });
  const f2 = vffvx().querySelector("form"), b2 = (n) => f2.querySelectorAll("input").find((x) => x.getAttribute("name") === n);
  assert.deepEqual(f2.querySelectorAll("input").map((x) => x.getAttribute("name")), ["tech", "health", "money", "shops", "rest"]);
  for (const [k, v] of [["tech", "35"], ["health", "12"], ["money", "15"], ["shops", "16"], ["rest", "22"]]) b2(k).value = v;
  f2.dispatch("submit");
  assert.deepEqual(h.plan.holdings.find((x) => x.id === "h5").sectors, { tech: 0.35, health: 0.12, money: 0.15, shops: 0.16, rest: 0.22 });
  h.draw();
  assert.ok(textOf(h.partOf("splits").querySelector(".notice.ok")).startsWith("Saved for VFFVX. Of the $180,000 of stocks split by kind of business, 35% is technology and communication, the largest part."));
  btn("Change VFFVX's split", vffvx()).click();
  assert.deepEqual(_test.editing, { id: "h5", kind: "sector" }, "a fund split only by kind of business opens on that");
  btn("Use our rough guide again", vffvx()).click();
  assert.equal(h.plan.holdings.find((x) => x.id === "h5").sectors, undefined);
  h.draw();
  assert.ok(textOf(h.partOf("splits").querySelector(".notice.ok")).startsWith("Saved: VFFVX is no longer split by kind of business."));
  // the live sum under the boxes, one sentence per case
  btn("Split VFFVX by region", vffvx()).click();
  const f3 = vffvx().querySelector("form"), b3 = (k) => f3.querySelectorAll("input").find((x) => x.getAttribute("name") === k);
  const sumLine = () => textOf(f3.querySelectorAll("p").find((x) => x.getAttribute("aria-live") === "polite"));
  assert.equal(b3("us").value, "60", "the United States share from our rough guide (critic P3)");
  assert.equal(sumLine(), "Adds up to 60%: add 40 somewhere so it comes to 100.");
  b3("us").value = ""; b3("us").dispatch("input");
  assert.equal(sumLine(), "Type each share in percent; together they come to 100.");
  b3("us").value = "60"; b3("rich").value = "30"; b3("us").dispatch("input");
  assert.equal(sumLine(), "Adds up to 90%: add 10 somewhere so it comes to 100.");
  b3("emerging").value = "15"; b3("emerging").dispatch("input");
  assert.equal(sumLine(), "Adds up to 105%: take 5 off somewhere so it comes to 100.");
  b3("emerging").value = "10"; b3("emerging").dispatch("input");
  assert.equal(sumLine(), "Adds up to 100%.");
  btn("Cancel", vffvx()).click();
  // a split saved as it already was: nothing written, said plainly
  btn("Split VFFVX by region", vffvx()).click();
  const f4 = vffvx().querySelector("form"), b4 = (k) => f4.querySelectorAll("input").find((x) => x.getAttribute("name") === k);
  b4("us").value = "50"; b4("rich").value = "30"; b4("emerging").value = "20";
  f4.dispatch("submit"); h.draw();
  const m = h.saved.length;
  btn("Change VFFVX's split", vffvx()).click();
  vffvx().querySelector("form").dispatch("submit");
  assert.equal(h.saved.length, m, "the same split again writes nothing: no update at all");
  assert.equal(textOf(h.partOf("splits").querySelector(".notice.ok")), "Nothing to save: VFFVX's split is as it was.");
  assert.deepEqual(h.states(), [["accounts", false], ["splits", true], ["target", false]], "its row stays open");
  btn("Change VFFVX's split", vffvx()).click();
  btn("Use our rough guide again", vffvx()).click();
  h.draw();
  assert.ok(textOf(h.partOf("splits").querySelector(".notice.ok")).startsWith("Saved: VFFVX uses our rough guide again. Your stocks are now 70% in the United States and 30% outside the US, not split yet."), textOf(h.partOf("splits").querySelector(".notice.ok")));
  assert.equal(h.plan.holdings.find((x) => x.id === "h5").regions, undefined);
  // Cancel shuts the form, saves nothing
  const n = h.saved.length;
  btn("Split VFFVX by region", vffvx()).click();
  btn("Cancel", vffvx()).click();
  assert.equal(_test.editing, null); assert.equal(h.saved.length, n);
  _test.reset();
});

test("a fund's form opens in view with the United States share from our rough guide; the line after Undo is brought into view (critic P3, P4, P5)", async () => {
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { _test } = await import("./view.js"); _test.reset();
  const h = await harness(investmentsPlan());
  const btn = (label, at = h.partOf("splits")) => at.querySelectorAll("button").find((x) => x.textContent === label);
  const row = (sym) => h.partOf("splits").querySelectorAll("li").find((li) => li.querySelector(".rec-title")?.textContent.startsWith(sym));
  assert.deepEqual(h.partOf("splits").querySelectorAll("button").map((b) => b.textContent).filter((t) => / by region$/.test(t)), ["Split FXAIX by region", "Split VFFVX by region", "Split VTIAX by region", "Split VTI by region"]);
  btn("Split VFFVX by region", row("VFFVX")).click();
  const wrap = row("VFFVX").querySelector(".rec-form");
  assert.ok(h.revealed.some(([el, o]) => el === wrap && o.block === "start"), "the form is brought into view");
  assert.match(textOf(wrap), /Our rough guide puts 60% of VFFVX's stocks in the United States and 40% outside it: check the 60 against the fund's page, then split the 40 between the other two\./);
  const box = (n) => wrap.querySelector("form").querySelectorAll("input").find((x) => x.getAttribute("name") === n);
  assert.deepEqual(["us", "rich", "emerging"].map((n) => box(n).value), ["60", "", ""]);
  // drawn again (a chip, a redraw): it is not brought into view again
  const n0 = h.revealed.length;
  h.draw();
  assert.equal(h.revealed.length, n0, "once, on opening");
  // by kind of business: no guide, blank boxes
  btn("By kind of business", row("VFFVX")).click();
  assert.ok(!/Our rough guide puts/.test(textOf(row("VFFVX"))));
  assert.ok(row("VFFVX").querySelector("form").querySelectorAll("input").every((x) => x.value === ""));
  // save a region split, Undo: the line that says so is revealed (it has no button of its own)
  btn("By region", row("VFFVX")).click();
  const f2 = row("VFFVX").querySelector("form"), b2 = (n) => f2.querySelectorAll("input").find((x) => x.getAttribute("name") === n);
  b2("us").value = "50"; b2("rich").value = "35"; b2("emerging").value = "15";
  f2.dispatch("submit");
  h.draw();
  btn("Undo", h.partOf("splits").querySelector(".notice.ok")).click();
  h.draw();
  const back = h.partOf("splits").querySelector(".notice.ok");
  assert.equal(textOf(back), "VFFVX's split is as it was.");
  assert.ok(h.revealed.some(([el, o]) => el === back && o.block === "nearest"));
  _test.reset();
});

test("Rebalance sells the fund Allocation counts in the class that is over: a region split decides which fund that is (critic M3)", async () => {
  const { compute: rebalance } = await import("../rebalance/compute.js");
  const { tryTrade } = await import("../rebalance/trade.js");
  const { migrate: mg } = await import("../../../core/schema/migrate.js");
  const p = mg(emptyPlan());
  p.accounts.push({ id: "b", name: "Brokerage", type: "brokerage", balance: 25000 });
  const H = (id, symbol, shares, price) => ({ id, accountId: "b", symbol, name: "", shares, price, priceAsOf: T2, costBasis: shares * price, assetClass: "", lots: [] });
  p.holdings = [H("t", "VTI", 100, 100), H("x", "VXUS", 100, 100), H("n", "BND", 100, 50)];
  p.investments.target = { us_stocks: 0.5, intl_stocks: 0.1, bonds: 0.4, cash: 0, real_estate: 0, other: 0 };
  // a (silly) split that says VTI's stocks are all outside the US: Allocation counts $20,000 of international stocks
  p.holdings[0].regions = { us: 0, rich: 0.8, emerging: 0.2 };
  const a = compute(p, { today: T2 });
  assert.equal(rowOf(a, "intl_stocks").value, 20000);
  const r = rebalance(p, { today: T2 });
  const sold = r.sells.filter((t) => t.cls === "intl_stocks");
  assert.equal(sold.reduce((s, t) => s + t.amount, 0), -rowOf(a, "intl_stocks").move, "the whole of what is over is sold, not only VXUS");
  assert.ok(sold.some((t) => t.symbol === "VTI"), "VTI, counted as international, is one to sell");
  assert.deepEqual(r.leftover, [], "every buy finds cash in the account");
  // Try a trade: selling VTI takes it out of international, where Allocation counts it
  const t = tryTrade(p, { sell: "t", amount: 5000, buy: "cls:us_stocks" }, { today: T2 });
  const before = t.rows.find((x) => x.cls === "intl_stocks").before, after = t.rows.find((x) => x.cls === "intl_stocks").after;
  near(before, 20000 / 25000, 1e-12); near(after, 15000 / 25000, 1e-12);
  // no split: VXUS is the only international fund, as before
  delete p.holdings[0].regions;
  assert.deepEqual(rebalance(p, { today: T2 }).sells.map((x) => x.symbol), ["VXUS"]);
});

test("the target mix is a part: shut on the empty plan (one filled button, no box on the first view), open after its own save; four boxes and the band first", async () => {
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const { _test } = await import("./view.js"); _test.reset();
  const h = await harness(emptyPlan());
  assert.deepEqual(h.states(), [["target", false]]);
  const form = h.partOf("target").querySelector("form");
  const shown = form.children.filter((c) => c.tagName === "LABEL").map((l) => l.querySelector("input")?.getAttribute("name"));
  assert.deepEqual(shown, ["us_stocks", "intl_stocks", "bonds", "cash", "band"], "five boxes first (R21)");
  const box = (n) => form.querySelectorAll("input").find((x) => x.getAttribute("name") === n);
  box("us_stocks").value = "60"; box("bonds").value = "40";
  form.dispatch("submit");
  assert.deepEqual(h.plan.investments.target, { us_stocks: 0.6, intl_stocks: 0, bonds: 0.4, cash: 0, real_estate: 0, other: 0 });
  h.draw();
  assert.deepEqual(h.states(), [["target", true]], "the saved part stays open (R17)");
  assert.equal(h.partOf("target").querySelector(".fold-status").textContent, "60% stocks");
  _test.reset();
});

// ---------------------------------------------------------------- invariance: nothing typed, nothing moves
const KEYS_81A5288 = ["ready", "total", "rows", "band", "flaggedCount", "worst", "stockShareActual", "stockShareTarget", "target", "targetSource", "unknownValue", "coverage", "byAccountClass", "notes", "holdings", "known", "verdict", "choices", "restWords"];
test("invariance: with no split typed and nothing asked, the output has 81a5288's keys and bytes; asking for the splits adds one key; Rebalance is unchanged", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { heldPlan } = await import("../../../qa/fixtures/held-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { compute: rebalance } = await import("../rebalance/compute.js");
  let drawn = 0;
  for (const p0 of [investmentsPlan(), familyPlan(T2), renterDebtPlan(), retiredCouplePlan(T2), emptyPlan(), heldPlan(), ...ARCHETYPES.map((a) => a.build())]) {
    const p = migrate(structuredClone(p0));
    for (const today of [T2, "2026-09-16"]) {
      const a = compute(p, { today });
      assert.deepEqual(Object.keys(a), KEYS_81A5288);
      const { splits, ...rest } = compute(p, { today, splits: true });
      assert.equal(JSON.stringify(rest), JSON.stringify(a));
      assert.equal(splits.typed, 0);
      if (splits.holdings.length) drawn++;
      // a split by kind of business on every fund: still every byte of every output, Rebalance's too
      const s = structuredClone(p);
      for (const x of s.holdings ?? []) x.sectors = { tech: 0.2, health: 0.2, money: 0.2, shops: 0.2, rest: 0.2 };
      assert.equal(JSON.stringify(compute(s, { today }).rows), JSON.stringify(a.rows));
      assert.equal(JSON.stringify(rebalance(s, { today }).trades), JSON.stringify(rebalance(p, { today }).trades));
    }
  }
  assert.ok(drawn >= 4, `plans with stock funds: ${drawn / 2}`);
});
