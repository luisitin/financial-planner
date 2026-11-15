// modules/property/home/view.js -- DOM only. Your home: its value and your share of it, how it has grown, what a
// year of keeping it costs, what selling today would leave, value and equity ahead; today's value and the home's
// details in folds. One quiet row under the year of owning it, "Work done on the home": a dated list of jobs, newest first,
// and one line comparing the last 12 months with the upkeep counted ("Use $X a year" changes that figure, asked first, with
// Undo; a job ticked "Also count this as an improvement" adds its cost to Improvements, and its Remove takes it off). The
// optional pieces are drawn by core/ui/more.js (no hand-written <details>).
import { compute, DEFAULTS, purchaseDateFrom, sharePct, upkeepLog, logLine, UNEVEN, LOG_INTRO, useConfirmWords, useSavedWords, useUndoneWords,
  removeConfirmWords, removedWords, restoredWords, addedWords, jobFrom, withoutJob, isDay, improvementsWith, improvementOff, IMPROVE_HINT } from "./compute.js";
import { homeEntryFor } from "../../overview/guesses/estimators/loanhome.js";
import { part, parts } from "../../../core/ui/more.js";

let pending = null;   // the confirmation shown on the next render
// the green line of "Work done on the home" after an add, a remove, "Use $X a year" or an Undo: { text, undo?, back? }, shown
// once inside that part, which the next draw keeps open (docs/OPTIONAL.md R7, R17)
let said = null;
/** The part's title (pinned in qa/first-view-lib.mjs PINNED_TITLES: a named list a person looks for, not our guess overridden). */
export const LOG_TITLE = "Work done on the home";

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
  const logSaid = said; said = null;
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
  d.bought ? ui.h("p", {}, `Bought for ${money(d.bought.price)}${d.bought.date ? ` in ${shortDate(d.bought.date)}` : ""}: ${d.bought.gain >= 0 ? "up" : "down"} ${money(Math.abs(d.bought.gain))}${d.bought.growth !== null ? `, about ${pct(d.bought.growth, 1)} a year` : ""}.`) : ui.h("p", { class: "hm-d" }, "Add what you paid and when, below, to see its growth."),
  d.history.length > 1 ? ui.h("ul", { class: "hm-lines" }, d.history.slice(-6).reverse().map((h) => ui.h("li", {}, ui.h("span", {}, shortDate(h.date)), ui.h("span", {}, money(h.value))))) : null));

  root.append(ui.card("A year of owning it", ui.h("ul", { class: "hm-lines" }, [...d.costs.lines.map((l) => ui.h("li", {}, ui.h("span", {}, l.label), ui.h("span", {}, money(l.amount)))), ui.h("li", { class: "hm-tot" }, ui.h("span", {}, "A year"), ui.h("span", {}, money(d.costs.total)))]),
    ui.h("p", { class: "hm-d" }, `${money(d.costs.monthly)} a month.${d.costs.inPayment ? " The property tax and home insurance marked above come out of your mortgage payment: they are counted once." : ""}${d.costs.guessed ? " You said you pay property tax and home insurance yourself: the two amounts marked above are our guess of the usual ones for a home like yours. Type yours under The home's details." : ""}${d.costs.principal > 0 ? ` The ${money(d.costs.principal)} that pays down the loan is not a cost: it becomes yours.` : ""} Upkeep is counted at ${sharePct(d.details.maintenance ?? DEFAULTS.maintenance)} of the value a year; older homes often need more.`),
    // the work done on it: one quiet row in the card it belongs to (R12), shut until tapped, open again after its own save
    ui.h("div", { class: "folds" }, part(ctx, { id: "log", kind: "own", title: LOG_TITLE, says: logCount(d), open: logSaid ? true : undefined, holds: ["date", "what", "cost", "note"], body: () => logBody() }))));

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

  root.append(ui.card("Ahead", ui.h("ul", { class: "records" }, d.ahead.map((a) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `In ${a.years} years (${a.year})`), ui.h("span", { class: "rec-value" }, money(a.equity))), ui.h("div", { class: "rec-sub" }, `worth about ${money(a.value)}${a.owed > 0.5 ? `, ${money(a.owed)} still owed` : d.owed > 0.5 ? ", the mortgage paid off" : ""}`)))),
    ui.h("p", { class: "hm-d" }, `Growing ${pct(d.appreciation, 1)} a year (roughly prices plus a little over the long run), ${d.owed > 0.5 ? "with the mortgage paid as it is now" : "nothing owed on it"}. Not in today's dollars.`)));

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

  // the home's details
  const e = d.details;
  const wasYear = /^\d{4}/.test(e.purchaseDate ?? "") ? Number(e.purchaseDate.slice(0, 4)) : null;
  // the year it was bought: blank shows our guess in grey and in words (home.boughtYear), typed it is the person's
  let ourYear = null;
  try { ourYear = ctx.guess ? ctx.guess("home.boughtYear") : null; } catch { ourYear = null; }
  // "we use it" only while the mortgage's years left are worked from it (a balance and payment you typed, or a year too long ago
  // to be the loan's start, do not use it; bought verify, low item)
  const yearHelp = wasYear ? (d.yearUsed ? "The year is enough. We use it to work out the mortgage's years left." : "The year is enough.") : ourYear?.value ? `Our guess: ${ourYear.value}. ${ourYear.why} Blank is fine.` : "The year is enough. Blank is fine.";
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
  // today's value and the home's details: two rows of one card (R12: no column of folded cards), drawn by the helper; the
  // details open while there is no price yet, as before
  root.append(ui.h("div", {}, parts(ctx,
    { id: "value", kind: "own", title: "Update its value", says: acct?.asOf ? `last ${shortDate(acct.asOf)}` : "never", holds: ["value"],
      body: [ui.h("p", { class: "hm-d" }, "What you type here is the value every page counts: Net worth, a year of owning it, selling today. The value it replaces is kept with its date, so you can see how it has moved."), valueForm] },
    { id: "details", kind: "own", title: "The home's details", says: e.purchasePrice ? "price, costs" : wasYear ? `bought ${wasYear}` : "what you paid", open: e.purchasePrice ? undefined : true, holds: ["purchasePrice", "boughtYear", "purchaseDate", "improvements", "propertyTax", "insurance", "hoaMonthly", "maintenance", "appreciation", "sellCosts", "reducedReason"], body: detailsForm })));
  root.append(ui.card("More on this", ui.row(ui.h("a", { class: "btn secondary", href: "#/debt/mortgage" }, "Mortgage"), ui.h("a", { class: "btn secondary", href: "#/property/renovation" }, "A home project"))));

  // ---------------------------------------------------------------- "Work done on the home"
  // The home's entry in the draft, made when there is none yet (as the details form does).
  function entryOf(p) {
    p.property = Array.isArray(p.property) ? p.property : [];
    let x = homeEntryFor(p, d.accountId);
    if (!x) { x = { id: ui.uid(), kind: "home", accountId: d.accountId }; p.property.push(x); }
    return x;
  }
  // What the part holds: an empty list says what it is for and keeps its form open (R20); a list has the comparison with the
  // upkeep counted, "Use $X a year" when it applies, the jobs newest first, and its form behind "+ Add another job".
  function logBody() {
    const log = upkeepLog(d, today);
    const h = ui.h;
    const note = logSaid ? ui.notice("ok", logSaid.text, logSaid.undo ? { undo: logSaid.undo, undone: (r) => { said = { text: ui.undoneWords(r, logSaid.back) }; } } : {}) : null;
    if (!log.count) return [note, h("p", {}, LOG_INTRO), jobForm(null)];
    const line = logLine(log, money);
    const rows = log.jobs.map((j) => h("li", {},
      h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, j.what), h("span", { class: "rec-value" }, Number(j.cost) > 0 ? money(Number(j.cost)) : "no cost")),
      h("div", { class: "rec-sub" }, `${dayDate(j.date)}${j.improvement === true ? " · counted as an improvement" : ""}${j.note ? ` · ${j.note}` : ""}`),
      h("div", { class: "rec-foot" }, ui.button("Remove", () => removeJob(j), { class: "secondary small", "aria-label": `Remove ${j.what}` }))));
    return [note,
      line ? h("p", {}, line) : null,
      ["equal", "close", "less", "more"].includes(log.case) ? h("p", { class: "hm-d" }, UNEVEN) : null,
      log.use ? ui.row(ui.button(`Use ${money(log.use.yearly)} a year`, () => useYear(log), { class: "secondary" })) : null,
      h("ul", { class: "records" }, rows),
      h("p", { class: "hm-d" }, IMPROVE_HINT),
      opensUnder("+ Add another job", (shut) => jobForm(shut))];
  }
  // a form that opens under its outlined button (the kit's openUnder; a plain node after it on the test stand-in), as on Vehicles
  function opensUnder(label, build) {
    let close = null;
    const shut = () => { const c = close; close = null; c?.(); btn.setAttribute?.("aria-expanded", "false"); };
    const btn = ui.button(label, () => {
      if (close) { shut(); return; }
      if (ui.openUnder && row.parentElement) close = ui.openUnder(row, (holder) => holder.append(build(shut)));
      else { const holder = ui.h("div"); row.after(holder); holder.append(build(shut)); close = () => holder.remove(); }
      btn.setAttribute?.("aria-expanded", "true");
    }, { class: "secondary", "aria-expanded": "false" });
    const row = ui.row(btn);
    return row;
  }
  // date, what, cost; a note and "Also count this as an improvement" under "More details (optional)". Nothing is required at
  // the box (a shut part holds no required box): a job with no words or no day is refused at its box with what to do
  function jobForm(onCancel) {
    const form = ui.form([
      { key: "date", label: "When", type: "date", max: "today" },
      { key: "what", label: "What was done", type: "text", help: "For example, new water heater." },
      { key: "cost", label: "What it cost", type: "money", min: 0, help: "Leave it empty for work you did yourself." },
      { key: "note", label: "A note", type: "text", more: true, help: "Who did it, a warranty, where the receipt is." },
      { key: "improvement", label: "Also count this as an improvement", type: "checkbox", more: true, help: "A new roof or an addition, not a repair: its cost is added to Improvements in the home's details, which lowers the tax when you sell." },
    ], { date: today, what: "", cost: null, note: "", improvement: false }, (v) => {
      const r = jobFrom(v, { id: ui.uid(), today });
      if (r.error) return ui.fieldError(form.querySelector(`[name="${r.error}"]`), r.words);
      // ticked: its cost goes under Improvements in the same save, the one figure the sale and the projection read
      said = { text: addedWords(r.job, money, r.job.improvement ? improvementsWith(d.details.improvements, r.job) : null) };
      store.update((p) => {
        const x = entryOf(p); x.jobs = [...(Array.isArray(x.jobs) ? x.jobs : []), r.job];
        if (r.job.improvement) x.improvements = improvementsWith(x.improvements, r.job);
      });
    }, { submitLabel: "Add to the list", onCancel });
    // while the home's details are open (no price yet) their Save is the page's one filled button: this one is outlined
    if (!d.details.purchasePrice) form.querySelector?.('[type="submit"]')?.classList?.add("secondary");
    return form;
  }
  // asked first; one change Undo takes back. The job tapped goes by its place in the list as drawn (a job saved by hand or
  // imported may have no id, and a filter on the id removed every such job)
  // A job counted as an improvement takes its cost off Improvements with it (never more than is there), in the same change.
  function removeJob(j) {
    const off = improvementOff(d.details.improvements, j);
    if (!ui.confirm(removeConfirmWords(j, money, off))) return;
    const at = Array.isArray(d.details.jobs) ? d.details.jobs.indexOf(j) : -1;
    const next = { text: removedWords(j, money, off), back: restoredWords(j, money, off) };
    said = next;
    next.undo = ui.undoable(store, (p) => {
      const x = homeEntryFor(p, d.accountId);
      if (!x || !Array.isArray(x.jobs)) return;
      const left = withoutJob(x.jobs, j, at);
      if (left.length === x.jobs.length) return;
      x.jobs = left;
      const o = improvementOff(x.improvements, j);
      if (o > 0) x.improvements = Math.max(0, Number(x.improvements) - o);
    });
  }
  // "Use $X a year": the one way this part changes a figure of the plan (the upkeep share), asked first, with Undo
  function useYear(log) {
    if (!ui.confirm(useConfirmWords(log, money))) return;
    const next = { text: useSavedWords(log, money), back: useUndoneWords(log, money) };
    said = next;
    next.undo = ui.undoable(store, (p) => { entryOf(p).maintenance = log.use.rate; });
  }
}
/** The row's status: how many jobs the list holds ("3 jobs"), nothing while it is empty. */
function logCount(d) {
  const n = Array.isArray(d.details?.jobs) ? d.details.jobs.filter((j) => j && typeof j === "object" && isDay(j.date)).length : 0;
  return n ? `${n} job${n === 1 ? "" : "s"}` : "";
}
