// modules/investments/fees/view.js -- DOM only. The lifetime cost first, this year's fees and the
// average rate, the priciest holdings, then one shut part "Set my own numbers": the advisor's fee,
// each plan at work's own fee and this year's trading fees (gap #34; docs/OPTIONAL.md).
import { compute, planFeeAccounts, headlineOf, ledeOf, savedWords, rateText } from "./compute.js";
import { parts } from "../../../core/ui/more.js";

let pending = null;   // the green line for the next draw: { part (the part just saved stays open, R17), say(d) }
const FIRST_PLANS = 3; // plans at work whose dollar box is in the first five boxes; the rest wait under More details (optional)

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const said = pending; pending = null;
  const green = said ? said.say(d) : null;
  const own = ownPart(ctx, d, money, said?.part === "own");
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "What your investments cost"), ui.h("p", { class: "lede" }, "The yearly fee inside each fund (the \"expense ratio\" on your statement) and an advisor's fee look tiny and cost a fortune: a 1% fee takes about a quarter of a lifetime's growth. This page adds yours up once the holdings are in."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Add holdings"))));
    if (green) root.append(okLine(ui, green));
    root.append(parts(ctx, own));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, headlineOf(d, money)),
    ui.h("p", { class: "lede" }, ledeOf(d, money, (x) => fmt.pct(x, 1))),
    ui.h("p", { class: "muted small" }, `Fees compound like returns do, in reverse. The plan's blended return and the ages on the People page set the ${d.years}-year horizon; today's dollars are not adjusted.`),
  ));
  const out = ui.h("div");
  if (green) out.append(okLine(ui, green));
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  root.append(ui.card(null, ui.row(
    ui.stat("A year", money(d.feesYearly), `${rateText(d.allIn)} of the portfolio`),
    ui.stat("Average fund fee", rateText(d.weightedEr), "weighted by what you hold"),
    ui.stat("Over the plan", money(d.lifetimeCost), `${d.years} years of compounding`),
    d.cheapSaves > 0 ? ui.stat("Index funds would keep", money(d.cheapSaves), "at 0.05% a year") : null,
  )));
  root.append(ui.card("Each holding",
    ui.h("ul", { class: "records" }, d.items.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.symbol, x.er !== null && x.er > 0.005 ? ui.h("span", { class: "pill warn" }, "pricey") : null), ui.h("span", { class: "rec-value" }, x.er !== null ? `${money(x.feeYearly)} a year` : "unknown")),
      ui.h("div", { class: "rec-sub" }, `${x.name ? `${x.name} · ` : ""}${x.account} · ${money(x.value)}${x.er !== null ? ` at ${rateText(x.er)}` : " · expense ratio not on file"}`)))),
    ui.h("p", { class: "muted small" }, "Expense ratios come from a table of common funds or what you typed on the Holdings page. Sales loads, 12b-1 fees and trading spreads are not counted."),
  ));
  root.append(parts(ctx, own));
}

function okLine(ui, words) { const n = ui.notice("ok", words); setTimeout(() => n.remove(), 4000); return n; }

/**
 * "Set my own numbers": the fees the fund table cannot see. The advisor's fee (was its own fold), each plan at work's own
 * fee in dollars a year (the quarterly statement shows the dollars taken) and as a % (the yearly fee notice), and this
 * year's trading and crypto fees. Shut unless just saved; the status counts what is typed.
 */
function ownPart(ctx, d, money, justSaved) {
  const { ui, fmt, store, plan } = ctx;
  const year = Number(String(fmt.today()).slice(0, 4));
  const { accounts, waiting } = planFeeAccounts(plan, { today: fmt.today() });
  const t = plan.investments?.tradingFees ?? null;
  const tAmount = Number(t?.amount) > 0 ? Number(t.amount) : null, tYear = Number(t?.year) || null;
  const fields = [
    { key: "advisoryFee", label: "Advisory fee a year", type: "percent", min: 0, max: 5, placeholder: "e.g. 1", help: "what an advisor or robo-advisor charges on the whole portfolio; 1 for 1%; leave blank for none" },
    ...accounts.map((a, i) => ({ key: `planDollars-${a.id}`, label: `${a.name}: the plan's own fee, $ a year`, type: "money", min: 0, more: i >= FIRST_PLANS,
      help: i === 0 ? "what the plan charges to run it (record keeping, admin), on top of the funds' fees. Each quarterly statement shows the dollars taken: add up four." : null })),
    { key: "tradingFees", label: "Trading and crypto fees this year", type: "money", min: 0,
      help: tAmount && tYear && tYear < year ? `the ${money(tAmount)} on file is for ${tYear}; type ${year}'s when you know it` : "commissions, and the fee on each crypto buy or sale, from your statements; counted as if every year is like this one" },
    ...accounts.map((a, i) => ({ key: `planPct-${a.id}`, label: `${a.name}: the plan's own fee as a % a year`, type: "percent", min: 0, max: 5, more: true,
      help: i === 0 ? "if the plan's yearly fee notice gives it as a percent of what you have; counted on top of any dollars" : null })),
  ];
  const values = { advisoryFee: plan.investments?.advisoryFee || null, tradingFees: tAmount };
  for (const a of accounts) { values[`planDollars-${a.id}`] = a.dollars || null; values[`planPct-${a.id}`] = a.pct || null; }
  const form = ui.form(fields, values, (v) => {
    const was = headlineOf(d, money);
    pending = { part: "own", say: (now) => savedWords(was, now, money) };
    store.update((p) => {
      p.investments ??= {};
      p.investments.advisoryFee = v.advisoryFee ?? 0;
      const fees = { ...(p.investments.planFees ?? {}) };
      for (const a of accounts) {
        const e = {};
        if (v[`planPct-${a.id}`] > 0) e.pct = v[`planPct-${a.id}`];
        if (v[`planDollars-${a.id}`] > 0) e.dollars = v[`planDollars-${a.id}`];
        if (Object.keys(e).length) fees[a.id] = e; else delete fees[a.id];
      }
      if (Object.keys(fees).length) p.investments.planFees = fees; else delete p.investments.planFees;
      // a figure saved again unchanged keeps the year it was typed for
      if (v.tradingFees > 0) p.investments.tradingFees = { year: v.tradingFees === tAmount && tYear ? tYear : year, amount: v.tradingFees };
      else delete p.investments.tradingFees;
    });
  }, { submitLabel: "Save" });
  // what is counted now, from the plan (each plan at work's fee and the trading figure)
  const counted = [
    ...(d.planFees ?? []).map((a) => [`${a.name}: ${money(a.yearly)} a year`, [a.pct > 0 ? `${rateText(a.pct)} of ${money(a.value)}` : null, a.dollars > 0 ? `${money(a.dollars)} a year` : null].filter(Boolean).join(" plus ")]),
    d.tradingYearly > 0 ? [`Trading and crypto fees: ${money(d.tradingYearly)} a year`, d.tradingYear ? `typed for ${d.tradingYear}, counted for every year` : "counted for every year"] : null,
  ].filter(Boolean);
  const set = (d.advisoryFee > 0 ? 1 : 0) + accounts.reduce((n, a) => n + (a.pct > 0 ? 1 : 0) + (a.dollars > 0 ? 1 : 0), 0) + (tAmount ? 1 : 0);
  const waits = waiting.length
    ? `${listOf(waiting)} ${waiting.length === 1 ? "has" : "have"} no funds on the Holdings page yet. Add ${waiting.length === 1 ? "its funds" : "their funds"} there and a box for ${waiting.length === 1 ? "its" : "each"} plan's own fee shows here.`
    : null;
  return {
    id: "own", kind: "own", set, says: set ? "" : "none typed", open: justSaved, holds: fields.map((f) => f.key),
    body: [
      ui.h("p", { class: "muted small" }, "Fees the fund table cannot see. Each one you type joins the yearly cost and the lifetime cost above. An advisor charging 1% takes 1% every year, in good years and bad; flat-fee advice is not a percentage and does not belong here."),
      counted.length ? ui.h("ul", { class: "records" }, counted.map(([title, sub]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, title)), sub ? ui.h("div", { class: "rec-sub" }, sub) : null))) : null,
      waits ? ui.h("p", { class: "small" }, waits, " ", ui.h("a", { href: "#/investments/holdings" }, "Holdings ›")) : null,
      form,
    ],
  };
}

const listOf = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
