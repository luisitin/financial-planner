// modules/property/home/view.js -- DOM only. Your home: its value and your share of it, how it has grown, what a
// year of keeping it costs, what selling today would leave, value and equity ahead; today's value and the home's
// details in folds.
import { compute, DEFAULTS, purchaseDateFrom } from "./compute.js";
import { homeEntryFor } from "../../overview/guesses/estimators/loanhome.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.hm-root .hm-lines { list-style: none; margin: 0; padding: 0; }
.hm-root .hm-lines li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); }
.hm-root .hm-lines li:last-child { border-bottom: 0; }
.hm-root .hm-lines li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
.hm-root .hm-lines .hm-tot { font-weight: 700; }
.hm-root .hm-bar { height: 12px; border-radius: 6px; background: var(--panel-2); border: 1px solid var(--line); overflow: hidden; margin: 10px 0 4px; }
.hm-root .hm-bar span { display: block; height: 100%; background: var(--accent); }
.hm-root .hm-d { color: var(--text-2); font-size: var(--fs-sm); }
.hm-root .hm-flag { color: var(--warn); font-weight: 650; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x, dp = 0) => `${(x * 100).toFixed(dp)}%`;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "hm-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const dayDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Your home"),
      ui.h("p", { class: "lede" }, "What your home is worth, how much of it is yours, what it costs to keep, and what selling would leave you."),
      ui.h("p", { class: "muted small" }, "Add the home on Net worth as Real estate, with what it is worth today; the mortgage as its own account."),
      // says what it does and opens that form (DP-3: "Accounts" opened Account detail, which cannot add one)
      ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth?add=property&back=property/home" }, "Add your home"))));
    return;
  }

  root.append(ui.card(d.name, ui.row(
    ui.stat("Worth", money(d.value), plan.accounts.find((a) => a.id === d.accountId)?.asOf ? `as of ${shortDate(plan.accounts.find((a) => a.id === d.accountId).asOf)}` : "as typed"),
    ui.stat("Yours", money(d.equity), d.owed > 0 ? `${money(d.owed)} still owed` : "nothing owed"),
  ), ui.h("div", { class: "hm-bar", role: "img", "aria-label": `${pct(Math.max(0, d.equityShare ?? 0))} of the home is yours` }, ui.h("span", { style: { width: `${Math.max(0, Math.min(1, d.equityShare ?? 0)) * 100}%` } })),
  ui.h("p", { class: "hm-d" }, `${pct(Math.max(0, d.equityShare ?? 0))} of the home is yours${d.ltv !== null && d.ltv > 0 ? `; the loan is ${pct(d.ltv)} of its value${d.ltv > 0.8 ? " (above 80%, lenders usually charge mortgage insurance)" : ""}` : ""}.`),
  d.bought ? ui.h("p", {}, `Bought for ${money(d.bought.price)}${d.bought.date ? ` in ${shortDate(d.bought.date)}` : ""}: ${d.bought.gain >= 0 ? "up" : "down"} ${money(Math.abs(d.bought.gain))}${d.bought.growth !== null ? `, about ${pct(d.bought.growth, 1)} a year` : ""}.`) : ui.h("p", { class: "hm-d" }, "Add what you paid and when, below, to see how it has grown."),
  d.history.length > 1 ? ui.h("ul", { class: "hm-lines" }, d.history.slice(-6).reverse().map((h) => ui.h("li", {}, ui.h("span", {}, shortDate(h.date)), ui.h("span", {}, money(h.value))))) : null));

  root.append(ui.card("A year of owning it", ui.h("ul", { class: "hm-lines" }, [...d.costs.lines.map((l) => ui.h("li", {}, ui.h("span", {}, l.label), ui.h("span", {}, money(l.amount)))), ui.h("li", { class: "hm-tot" }, ui.h("span", {}, "A year"), ui.h("span", {}, money(d.costs.total)))]),
    ui.h("p", { class: "hm-d" }, `${money(d.costs.monthly)} a month.${d.costs.principal > 0 ? ` The ${money(d.costs.principal)} of the mortgage that pays down the loan is not a cost: it becomes yours.` : ""} Upkeep is counted at ${pct(d.details.maintenance ?? DEFAULTS.maintenance, 1)} of the value a year; older homes often need more.`)));

  const s = d.sale;
  const niitLine = s.niitLine;
  const niitPart = s.niit > 0.5 ? `, and ${money(s.niit)} of that is the 3.8% extra tax on investment income, charged only on the part of your income over ${money(niitLine)}` : "";
  const ifLived = s.dateMissing ? " if you have owned and lived in it two of the last five years" : "";
  const owned = (m) => [Math.floor(m / 12) ? `${Math.floor(m / 12)} year${Math.floor(m / 12) === 1 ? "" : "s"}` : null, m % 12 ? `${m % 12} month${m % 12 === 1 ? "" : "s"}` : null].filter(Boolean).join(" and ") || "less than a month";
  function saleText() {
    if (s.gain === null) return `Up to ${money(s.cap)} of gain on your main home is tax-free once you have owned it and lived in it two of the last five years. Add what you paid, below, to check yours.`;
    if (s.gain <= 0) return `After selling costs that would be a loss of ${money(-s.gain)}. A loss on your own home does not lower your tax.`;
    const taxPart = s.taxable <= 0.5 ? "" : s.term === "short"
      ? ` Owned a year or less, it is taxed like your pay: about ${money(s.tax)}${niitPart}.${s.longOn ? ` From ${dayDate(s.longOn)} it would get the lower rate for things owned over a year.` : ""}`
      : ` About ${money(s.tax)} of federal tax: gains are taxed at 0%, 15% or 20% depending on your income that year${niitPart}.`;
    if (s.test && !s.test.meets && s.reduced === null) return `You have owned it ${owned(s.test.months)}. The ${money(s.cap)} of gain that is tax-free on a main home needs two of the last five years owned and lived in (you reach that on ${dayDate(s.test.from)}), so the whole ${money(s.gain)} gain is taxed.${s.taxable > 0.5 && s.tax <= 0.5 ? " At your income it is taxed at 0%." : taxPart}`;
    if (s.reduced !== null) return `Selling early for a new job, your health or an event you could not foresee: ${money(s.exclusion)} of gain can be tax-free (${money(s.cap)} times the ${pct(s.reduced, 0)} of two years you have owned it).${s.taxable > 0.5 ? ` The other ${money(s.taxable)} is taxed.${taxPart}` : ` That covers the whole ${money(s.gain)} gain.`}`;
    if (s.taxable > 0.5) return `The gain (${money(s.gain)}) is ${money(s.taxable)} above the ${money(s.exclusion)} that is tax-free on a main home${s.owners > 1 ? ` (${money(s.capEach)} on each of your returns)` : ""}${ifLived}.${s.tax <= 0.5 ? " At your income it is taxed at 0%." : taxPart}`;
    return `The gain after costs (${money(s.gain)}) is under the ${money(s.exclusion)} that is tax-free on a main home${s.owners > 1 ? ` (${money(s.capEach)} on each of your returns)` : ""}${s.dateMissing ? ifLived : " you have owned and lived in two of the last five years"}.`;
  }
  root.append(ui.card("If you sold today", ui.h("ul", { class: "hm-lines" }, [
    ui.h("li", {}, ui.h("span", {}, "Sale price"), ui.h("span", {}, money(d.value))),
    ui.h("li", {}, ui.h("span", {}, `Selling costs (about ${pct(d.details.sellCosts ?? DEFAULTS.sellCosts)})`), ui.h("span", {}, `−${money(s.costs)}`)),
    d.owed > 0 ? ui.h("li", {}, ui.h("span", {}, "Mortgage paid off"), ui.h("span", {}, `−${money(d.owed)}`)) : null,
    s.tax > 0.5 ? ui.h("li", {}, ui.h("span", {}, "Tax on the gain"), ui.h("span", {}, `−${money(s.tax)}`)) : null,
    ui.h("li", { class: "hm-tot" }, ui.h("span", {}, "You would keep"), ui.h("span", {}, money(s.net))),
  ].filter(Boolean)),
    ui.h("p", {}, saleText()),
    s.dateMissing && s.gain > 0 ? ui.h("p", { class: "hm-flag" }, "Add when you bought it, below: owned and lived in under two years, the gain is taxed, and owned a year or less it is taxed like pay.") : null,
    s.owners > 1 && s.gain > 0 ? ui.h("p", { class: "hm-d" }, `Filing separately, a home in neither name is half each: each of you reports half the gain, with up to ${money(s.capEach)} of it tax-free. If it is in one name, choose the owner on Net worth.`) : null,
    s.test && !s.test.meets && s.reduced === null && s.gain > 0 ? ui.h("p", { class: "hm-d" }, "Selling because of a new job, your health or an event you could not foresee? Then part of the gain can still be tax-free: check that box in the home's details below.") : null,
    s.otherYear ? ui.h("p", { class: "hm-d" }, `A sale today falls in ${s.year}, so this is ${s.year}'s tax (the Federal estimate is set to ${s.otherYear}).`) : null,
    s.gain !== null && s.gain > 0 ? ui.h("p", { class: "hm-d" }, "This assumes the home has been your main home since you bought it; time it was rented out or empty can change the tax-free part.") : null));

  root.append(ui.card("Ahead", ui.h("ul", { class: "records" }, d.ahead.map((a) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `In ${a.years} years (${a.year})`), ui.h("span", { class: "rec-value" }, money(a.equity))), ui.h("div", { class: "rec-sub" }, `worth about ${money(a.value)}${a.owed > 0.5 ? `, ${money(a.owed)} still owed` : ", the mortgage paid off"}`)))),
    ui.h("p", { class: "hm-d" }, `Growing ${pct(d.appreciation, 1)} a year (roughly prices plus a little over the long run), with the mortgage paid as it is now. Not in today's dollars.`)));

  // today's value
  const acct = plan.accounts.find((a) => a.id === d.accountId);
  const valueForm = ui.form([{ key: "value", label: "What it is worth today", type: "money", min: 0, help: "a recent appraisal, or an estimate from a home-value site or an agent" }], { value: d.value }, (v) => {
    if (!(v.value > 0)) return;
    pending = `Value updated to ${money(v.value)}.`;
    store.update((p) => {
      const a = p.accounts.find((x) => x.id === d.accountId);
      a.history = (a.history ?? []).filter((h) => h.date !== today);
      if (a.asOf && a.asOf !== today && !a.history.some((h) => h.date === a.asOf)) a.history.push({ date: a.asOf, balance: Number(a.balance) || 0 });
      a.balance = v.value; a.asOf = today;
      a.history.push({ date: today, balance: v.value });
    });
  }, { submitLabel: "Update value" });
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Update its value"), ui.h("span", { class: "fold-status" }, acct?.asOf ? `last ${shortDate(acct.asOf)}` : "never"), ui.h("span", { class: "fold-chev" }, "›")), valueForm));

  // the home's details
  const e = d.details;
  const wasYear = /^\d{4}/.test(e.purchaseDate ?? "") ? Number(e.purchaseDate.slice(0, 4)) : null;
  // the year it was bought: blank shows our guess in grey and in words (home.boughtYear), typed it is the person's
  let ourYear = null;
  try { ourYear = ctx.guess ? ctx.guess("home.boughtYear") : null; } catch { ourYear = null; }
  const yearHelp = wasYear ? "The year is enough. We use it to work out the mortgage's years left." : ourYear?.value ? `Our guess: ${ourYear.value}. ${ourYear.why} Blank is fine.` : "The year is enough. Blank is fine.";
  const detailsForm = ui.form([
      { key: "purchasePrice", label: "What you paid", type: "money", min: 0 },
      { key: "boughtYear", label: "Year you bought it", type: "text", placeholder: ourYear?.value ? String(ourYear.value) : "", help: yearHelp },
      { key: "purchaseDate", label: "The exact date, if you know it", type: "date" },
      { key: "improvements", label: "Improvements since (a new roof, an addition)", type: "money", min: 0, help: "they lower the taxable gain when you sell; keep the receipts" },
      { key: "propertyTax", label: "Property tax a year", type: "money", min: 0 },
      { key: "insurance", label: "Home insurance a year", type: "money", min: 0 },
      { key: "hoaMonthly", label: "Association dues a month", type: "money", min: 0 },
      { key: "maintenance", label: "Upkeep a year, as a share of the value", type: "percent", min: 0, max: 10 },
      { key: "appreciation", label: "Value grows each year", type: "percent", min: -10, max: 15 },
      { key: "sellCosts", label: "Selling costs, as a share of the price", type: "percent", min: 0, max: 15 },
      s.test && !s.test.meets ? { key: "reducedReason", label: "Selling before two years because of a new job, my health or an event I could not foresee", type: "checkbox", help: "then part of the gain can still be tax-free" } : null,
    ].filter(Boolean), { maintenance: DEFAULTS.maintenance, appreciation: DEFAULTS.appreciation, sellCosts: DEFAULTS.sellCosts, ...e, boughtYear: wasYear ?? "", propertyTax: e.propertyTax ?? (plan.taxes?.itemized?.propertyTax || "") }, (v) => {
      const { boughtYear, ...rest } = v;
      const typedYear = String(boughtYear ?? "").trim();
      // a year before 1950 is refused as the mortgage page and Get started refuse it, never saved as blank under "Saved." (verify 2026-11-07)
      if (typedYear !== "" && (!/^\d{4}$/.test(typedYear) || Number(typedYear) < 1950)) { const n = ui.notice("error", "Type the year as four digits from 1950 on, like 2019, or leave it blank."); root.prepend(n); setTimeout(() => n.remove(), 6000); return false; }
      const yr = Number(today.slice(0, 4));
      const date = purchaseDateFrom({ year: typedYear === "" ? null : Number(typedYear), date: rest.purchaseDate }, { year: wasYear, date: e.purchaseDate ?? "" }, yr);
      if (typedYear !== "" && Number(typedYear) > yr) { const n = ui.notice("error", `${typedYear} is still ahead. Type the year you bought it, or leave it blank.`); root.prepend(n); setTimeout(() => n.remove(), 6000); return false; }
      pending = "Saved.";
      store.update((p) => {
        p.property = p.property ?? [];
        const found = homeEntryFor(p, d.accountId), i = found ? p.property.indexOf(found) : -1;
        const item = { ...(i >= 0 ? p.property[i] : { id: ui.uid(), kind: "home", accountId: d.accountId }), ...rest };
        if (date) item.purchaseDate = date; else delete item.purchaseDate;
        if (i >= 0) p.property[i] = item; else p.property.push(item);
      });
    }, { submitLabel: "Save" });
  const yearBox = detailsForm.querySelector('input[name="boughtYear"]');
  if (yearBox) { yearBox.setAttribute("inputmode", "numeric"); yearBox.setAttribute("maxlength", "4"); yearBox.setAttribute("autocomplete", "off"); }
  root.append(ui.h("details", { class: "card fold fold-card", open: e.purchasePrice ? null : true }, ui.h("summary", {}, ui.h("h2", {}, "The home's details"), ui.h("span", { class: "fold-status" }, e.purchasePrice ? "price, costs" : wasYear ? `bought ${wasYear}` : "what you paid"), ui.h("span", { class: "fold-chev" }, "›")),
    detailsForm));
  root.append(ui.card("More on this", ui.row(ui.h("a", { class: "btn secondary", href: "#/debt/mortgage" }, "Mortgage"), ui.h("a", { class: "btn secondary", href: "#/property/renovation" }, "A home project"))));
}
