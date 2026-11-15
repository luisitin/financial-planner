// modules/investments/performance/view.js -- DOM only. The true return first, then each
// account with its two returns and the periods between balance points. Four quiet rows under the tiles, one card, all
// shut (core/ui/more.js; docs/OPTIONAL.md): "Gain on each holding since you bought it" (once a cost is typed), "Pick the period"
// (a shorter stretch or your own dates, for this visit only: nothing is saved), "Compare with" (the plan's index mix or
// your own, kept in the plan with a green line and Undo) and "How this is worked out" (Settings' "Show how answers are
// worked out" opens it). Gap list, next 60, item 48.
import { compute, PERIODS, COMPARE_PRESETS } from "./compute.js";
import { part, parts } from "../../../core/ui/more.js";
import * as W from "./words.js";

let period = null;    // the stretch picked on this visit: a PERIODS key or { from, to }; never saved, never on the phone
let pending = null;   // { part, saved?, text?, undo?, back? }: the row to keep open after a pick or a save (R17), and its green line
let datesOpen = false; // "My own dates" shows its two boxes

const PAGE = "investments/performance";
/** The page's memory, for its tests. */
export const _test = { reset() { period = null; pending = null; datesOpen = false; }, get period() { return period; } };

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), period: period ?? undefined, parts: true });
  const money = (n) => fmt.money(n, cur);
  const pc = W.pc;
  const signed = (n) => W.signed(n, cur);
  const said = pending; pending = null;
  const again = () => (typeof ctx.redraw === "function" ? ctx.redraw() : (root.replaceChildren?.(), render(root, ctx)));
  const drivers = driversPart(ctx, d, cur, said);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "How your investments have done"), ui.h("p", { class: "lede" }, "How much your investments grew each year, leaving out the money you added (the figure to compare with an index fund), and what you earned counting when your money went in. Both come from the balances you save on the Net worth page."), ui.h("ul", {}, d.notes.map((n) => ui.h("li", {}, n))), ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, d.notes.some((n) => /No investment accounts/.test(n)) ? "Add an investment account" : "Save today's totals on Net worth"))));
    // the holdings' own gains need no saved points: the one real figure this page can give before they exist
    root.append(ui.h("div", {}, parts(ctx, drivers)));
    return;
  }
  const o = d.overall;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${pc(o.twrAnnual)} a year${o.years >= 0.9 ? "" : " so far"}`),
    ui.h("p", { class: "lede" }, `From ${fmt.date(o.from)} to ${fmt.date(o.to)}: ${money(o.start)} grew to ${money(o.end)} with ${money(o.deposits)} added, so the investments themselves made ${signed(o.gain)}. The plan assumes ${fmt.pct(d.expected, 1)} a year${W.heroClause(d.stockShare, d.compare.mix, d.benchmark)}.`),
  ));
  for (const n of d.notes) root.append(ui.notice("info", n));
  // a note about accounts left out says what to do: a button to Net worth, where balances are saved
  if (d.notes.some((n) => /only one saved balance/.test(n))) root.append(ui.row(ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Save today's totals on Net worth")));
  root.append(ui.card(null, ui.row(
    ui.stat("Investments earned", pc(o.twrAnnual), "a year, leaving out what you added"),
    o.mwr !== null && Math.abs(o.mwr - o.twrAnnual) >= 0.0005 ? ui.stat("You earned", pc(o.mwr), "a year, counting when your money went in") : null,
    ui.stat("Growth", signed(o.gain), `on ${money(o.start)} plus ${money(o.deposits)} added`),
    ui.stat("Plan assumes", fmt.pct(d.expected, 1), "blended stocks and bonds"),
  )));
  root.append(ui.h("div", {}, parts(ctx,
    drivers,
    periodPart(ctx, d, said, again),
    comparePart(ctx, d, said),
    { id: "how", kind: "how",
      body: ui.h("p", { class: "muted small" }, "\"Investments earned\" is the time-weighted return: money added between two saved balances is counted as arriving halfway through (the Modified Dietz method) and the periods are chained together. \"You earned\" is the money-weighted return: the yearly rate that makes every deposit, with its real date, grow to the end value (the internal rate of return). Deposits come from the account's own records when it has them, else from the Retirement contributions page.") })));
  for (const a of d.accounts.filter((x) => x.ready)) root.append(ui.card(a.name,
    ui.row(ui.stat("The investments", pc(a.twrAnnual), `a year over ${a.years.toFixed(1)} years`), ui.stat("What you earned", pc(a.mwr), "a year, counting when money went in"), ui.stat("Added", money(a.deposits), `${fmt.date(a.from)} to ${fmt.date(a.to)}`)),
    ui.h("ul", { class: "records" }, a.periods.map((p) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${fmt.date(p.from)} to ${fmt.date(p.to)}`), ui.h("span", { class: "rec-value" }, pc(p.rate))), ui.h("div", { class: "rec-sub" }, `${money(p.start)} to ${money(p.end)}${Math.abs(p.flow) > 0.5 ? ` with ${signed(p.flow)} added` : ""}`)))),
  ));
  root.append(ui.card("Reading the two numbers",
    ui.h("ul", { class: "records" }, [
      ["\"Investments earned\" is the funds' report card", "It leaves out how much you had invested when. Compare it with an index fund's return for the same stretch; if yours is lower every year, the fees or the picks are the reason."],
      ["\"You earned\" is your own report card", "Big deposits before a good run raise it, before a bad run lower it. Over a long stretch the two come together; over a short one they can differ a lot, and neither is wrong."],
      ["More points, better numbers", "A balance saved every month or quarter on the Net worth page turns this into a real record."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}

/** The green line after an Undo, brought wholly into view once drawn: half under the top bar, the shell would repeat it
 *  at the bottom of the screen (critic P5: the same words twice). */
const shown = (ui, n) => { ui.reveal?.(n, { block: "nearest" }); return n; };

/** A chip, as core/ui/more.js's choice() draws one (a toggle button; never a filled button). */
const chip = (ui, text, on, run, extra = {}) => ui.h("button", { type: "button", class: on ? "chip on" : "chip", "aria-pressed": on ? "true" : "false", onClick: run, ...extra }, text);

/** "Gain on each holding since you bought it": best first, worst last. Left out until a holding has a price and a cost
 *  (a row with nothing to show but a hint is not drawn; critic P6). */
function driversPart(ctx, d, cur, said) {
  const { ui } = ctx;
  const dr = d.drivers;
  if (!dr?.rows.length) return null;
  const row = (r) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.symbol, r.name && r.name !== r.symbol ? ui.h("span", { class: "muted small" }, ` ${r.name}`) : null), ui.h("span", { class: "rec-value" }, W.signed(r.gain, cur))),
    ui.h("div", { class: "rec-sub" }, W.driverSub(r, dr.total, cur)));
  const half = dr.between ? dr.shown.length / 2 : dr.shown.length;
  const list = dr.rows.length ? ui.h("ul", { class: "records" },
    dr.shown.slice(0, half).map(row),
    dr.between ? ui.h("li", {}, ui.h("div", { class: "rec-sub" }, W.betweenWords(dr.between))) : null,
    dr.shown.slice(half).map(row)) : null;
  const left = W.leftWords(dr.left);
  return { id: "drivers", kind: "more", title: W.DRIVERS_TITLE, says: `${dr.rows.length} holding${dr.rows.length === 1 ? "" : "s"}`,
    open: said?.part === "drivers",
    body: [
      ui.h("p", {}, W.driversIntro(dr, cur)),
      d.ready ? ui.h("p", { class: "muted small" }, W.NOT_THE_PERIOD) : null,
      list,
      left ? ui.h("p", { class: "muted small" }, left) : null,
      dr.left.length ? ui.h("a", { class: "btn secondary", href: "#/investments/holdings", style: { justifySelf: "start" } }, "Open Holdings") : null,
    ] };
}

/** "Pick the period": quick chips and your own dates; only what this page measures changes, for this visit. */
function periodPart(ctx, d, said, again) {
  const { ui } = ctx;
  const per = d.period;
  const on = period === null ? "all" : typeof period === "object" ? "own" : period;
  const pick = (key) => { period = key === "all" ? null : key; datesOpen = false; pending = { part: "period" }; again(); };
  const holder = ui.h("div", {});
  const dates = () => {
    const first = per.first ?? d.overall.from, last = per.last ?? d.overall.to;
    const values = typeof period === "object" && period ? { from: period.from, to: period.to } : { from: first, to: last };
    const form = ui.form([
      { key: "from", label: "From", type: "date", max: "today" },
      { key: "to", label: "To", type: "date", max: "today" },
    ], values, (v) => {
      if (!v.from || !v.to) return ui.fieldError(form.elements?.[!v.from ? "from" : "to"], "Pick a date in both boxes.");
      if (v.from >= v.to) return ui.fieldError(form.elements?.to, W.DATES_BACKWARDS);
      // dates that take in every saved point (the two the boxes start with) are "Since the first saved point" (critic P6)
      const every = v.from <= first && v.to >= last;
      period = every ? null : { from: v.from, to: v.to }; datesOpen = !every; pending = { part: "period" }; again();
      return false;
    }, { submitLabel: "Measure these dates" });
    return form;
  };
  const ownChip = chip(ui, "My own dates", on === "own", () => {
    datesOpen = !datesOpen;
    ownChip.setAttribute?.("aria-expanded", datesOpen ? "true" : "false");
    holder.replaceChildren?.(...(datesOpen ? [dates()] : []));
  }, { "aria-expanded": datesOpen || on === "own" ? "true" : "false" });
  if (datesOpen || on === "own") holder.append(dates());
  return { id: "period", kind: "own", title: "Pick the period", says: W.periodStatus(per), fix: per.fellBack ? 1 : 0,
    open: said?.part === "period",
    body: [
      ui.h("p", { class: "muted small" }, "Measure a shorter stretch, or dates of your own. Only what this page shows changes: nothing is saved."),
      ui.h("div", { class: "chips", role: "group", "aria-label": "Pick the period" }, PERIODS.map((p) => chip(ui, p.label, on === p.key, () => { if (on !== p.key) pick(p.key); })), ownChip),
      holder,
      per.fellBack ? ui.notice("error", W.FELL_BACK) : ui.h("p", {}, W.periodSentence(per)),
    ] };
}

/** "Compare with": the plan's index mix, a ready-made one, or the person's own (investments.benchmark, with Undo). */
function comparePart(ctx, d, said) {
  const { ui } = ctx;
  const mix = d.compare.mix, own = mix.source === "own";
  const planShare = Number(ctx.plan.retirement?.stocksNow ?? 0.7);
  const same = (m, s) => Math.abs(m.stocks - s) < 0.0005 && Math.abs(m.bills) < 0.0005;
  const choose = (m) => {
    const back = W.compareBack(mix);
    const next = { part: "compare", saved: true, back };
    pending = next;
    next.undo = ui.undoable(ctx.store, (dr) => { dr.investments ??= {}; if (m) dr.investments.benchmark = m; else delete dr.investments.benchmark; });
    if (!next.undo) pending = null;
  };
  const presets = COMPARE_PRESETS.filter((s) => Math.abs(s - planShare) >= 0.0005);
  const hit = own ? presets.find((s) => same(mix, s)) : undefined;
  const holder = ui.h("div", {});
  let boxOpen = false;
  const ownForm = () => {
    // to a tenth of a percent, so a saved third (33.3 x 3 = 99.9) is taken as it stands (whole percents gave 99: critic M4)
    const tenth = (x) => Math.round(x * 1000) / 10;
    const values = own ? { stocks: tenth(mix.stocks), bonds: tenth(mix.bonds), bills: tenth(mix.bills) } : {};
    const form = ui.form([
      { key: "stocks", label: "Stocks", type: "number", min: 0, max: 100, step: "any", help: "US stocks (the S&P 500), in %" },
      { key: "bonds", label: "Bonds", type: "number", min: 0, max: 100, step: "any", help: "10-year US Treasury bonds, in %" },
      { key: "bills", label: "Cash", type: "number", min: 0, max: 100, step: "any", help: "3-month Treasury bills, in %" },
    ], values, (v) => {
      const s = v.stocks ?? 0, b = v.bonds ?? 0, c = v.bills ?? 0, sum = s + b + c;
      if (Math.abs(sum - 100) > 0.5) return ui.fieldError(form.elements?.stocks, W.mixOff(sum));
      choose({ stocks: s / sum, bonds: b / sum, bills: c / sum });
    }, { submitLabel: "Compare with this mix" });
    return form;
  };
  const typeChip = chip(ui, "Type my own", false, () => { boxOpen = !boxOpen; typeChip.setAttribute?.("aria-expanded", boxOpen ? "true" : "false"); holder.replaceChildren?.(...(boxOpen ? [ownForm()] : [])); }, { "aria-expanded": "false" });
  const why = d.compare.why ?? "short";
  const green = said?.part === "compare" ? (said.saved
    ? ui.notice("ok", W.compareSaved(mix, d.benchmark, why), said.undo ? { undo: said.undo, undone: (r) => { pending = { part: "compare", text: ui.undoneWords(r, said.back) }; } } : {})
    : said.text ? shown(ui, ui.notice("ok", said.text)) : null) : null;
  return { id: "compare", kind: "own", title: "Compare with", says: W.compareStatus(mix), set: own ? true : 0,
    open: said?.part === "compare",
    body: [
      ui.h("p", { class: "muted small" }, "Your return set beside a plain mix of index funds over the same calendar years: US stocks (the S&P 500), US government bonds (10-year Treasury) and cash (3-month Treasury bills)."),
      ui.h("div", { class: "chips", role: "group", "aria-label": "Compare with" },
        chip(ui, `Your plan's mix: ${Math.round(planShare * 100)}% stocks`, !own, () => { if (own) choose(null); }),
        presets.map((s) => chip(ui, s === 1 ? "All stocks" : `${Math.round(s * 100)}% stocks`, hit === s, () => { if (hit !== s) choose({ stocks: s, bonds: 1 - s, bills: 0 }); })),
        own && hit === undefined ? chip(ui, `Yours: ${W.mixWords(mix)}`, true, () => { }) : null,
        typeChip),
      holder,
      green,
      // with no figure, a green line after a save already says why: not twice
      green && said.saved && !d.benchmark ? null : ui.h("p", {}, W.compareLine(mix, d.benchmark, why)),
    ] };
}
