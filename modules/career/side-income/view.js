// modules/career/side-income/view.js -- DOM only. Each side income: the month the plan can count on against the Income
// page's figure (and a button to use it), the last twelve months as bars, the cushion that smooths them; the share of
// each payment to set aside for tax and the next quarterly payment; the forms and the mileage rate; the months typed in
// a fold per side income.
import { compute, MIN_MONTHS, setCountOn, saveMonths } from "./compute.js";
import { THRESHOLDS } from "./data/rules.js";

let pending = null;   // the confirmation shown on the next render
let openId = null;    // the side income whose months were just saved stays open

const STYLE = `
.si-root .si-bars { display: grid; grid-template-columns: repeat(12, 1fr); gap: 4px; align-items: end; height: 110px; margin: 10px 0 2px; position: relative; }
.si-root .si-bars span { display: block; background: var(--accent); border-radius: 3px 3px 0 0; min-height: 2px; }
.si-root .si-bars span.low { background: var(--muted); }
.si-root .si-bars span.none { background: transparent; border-bottom: 2px dashed var(--line); }
.si-root .si-line { position: absolute; left: 0; right: 0; border-top: 2px dashed var(--ok); }
.si-root .si-ticks { display: grid; grid-template-columns: repeat(12, 1fr); gap: 4px; font-size: var(--fs-xs); color: var(--muted); text-align: center; }
.si-root .si-key { font-size: var(--fs-xs); color: var(--muted); margin: 4px 0 8px; }
.si-root .si-key i { display: inline-block; width: 16px; border-top: 2px dashed var(--ok); vertical-align: middle; margin-right: 6px; }
.si-root .si-say { margin: 8px 0; }
.si-root .row + p { margin-top: 14px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "si-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const monthName = (ym, style = "long") => new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-US", style === "short" ? { month: "narrow" } : { month: "long", year: "numeric" });
  const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Side income"),
      ui.h("p", { class: "lede" }, "Money from gigs, freelance work or a small business comes in unevenly. This page works out the month your plan can safely count on, the cushion that smooths the rest, and how much of each payment to set aside for tax."),
      ui.h("p", { class: "muted small" }, "First add it on the Income page as \"Self-employment / business\", with a rough monthly amount."),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add it on Income"))));
    rulesCard();
    return;
  }
  const anySaved = d.items.some((it) => it.stats.n > 0);
  if (!anySaved) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Side income"),
    ui.h("p", { class: "lede" }, "Pay that changes month to month is safest to plan with at a lower, ordinary month, with a cushion for the lean ones."),
    ui.h("p", { class: "muted small" }, "Type what came in each of the last 12 months (your bank or the app that pays you shows it) under each side income below.")));
  for (const n of d.notes) root.append(ui.notice("info", n));

  for (const it of d.items) root.append(itemCard(it));

  // the tax to set aside
  if (d.setAside) {
    const s = d.setAside;
    const e = d.estimates;
    root.append(ui.card("Tax to set aside", ui.row(
      ui.stat("Of every payment", pct(s.rate), `what comes in, before expenses: self-employment and federal income tax${s.state ? ", and state tax" : ""}`),
      // a share to put aside as the money comes in, not a quarterly figure: what to send the IRS and when is the Estimated
      // payments page's one answer, said in the sentence below (round 8 review: "$3,514 a quarter to the IRS" sat above
      // "$3,577 by January 15" on one card)
      ui.stat("This income adds", money(s.yearly), `of tax a year: set aside about ${money(s.yearly / 12)} a month`),
    ), ui.h("p", {}, !e.needed || (!e.nextDue && !e.overdue) ? "Your whole return does not need quarterly payments now: what is already withheld covers enough (the Estimated payments page checks)."
      : e.overdue ? `Your whole return needs quarterly payments to the IRS, and ${money(e.overdue.amount)} that was due from ${longDate(e.overdue.due)} on is not marked as paid: pay it now${e.nextDue ? `, then ${money(e.nextDue.amount)} by ${longDate(e.nextDue.due)}` : ""}.`
        : `Your whole return needs quarterly payments to the IRS: the next is ${money(e.nextDue.amount)} by ${longDate(e.nextDue.due)}.`),
    e.needed && (e.nextDue || e.overdue) ? ui.h("p", { class: "muted small" }, `These come from the Estimated payments page, worked on the Income page's ${money(d.items.reduce((t, it) => t + it.monthly, 0))} a month: the safe amount is ${e.harbour === "90% of this year's" || !e.harbour ? "90% of this year's tax" : e.harbour}, paid in four parts, and the rest is due in April.`) : null,
    ui.h("p", { class: "muted small" }, [
      "Nobody holds back tax from side income, so it is paid during the year, or covered by more withholding at a job.",
      s.onAverage ? " Worked on what came in on average over the months typed, not on the careful figure the plan counts on." : " Worked on the Income page's figure; type the months for what really comes in.",
    ].join("")),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/taxes/estimated" }, "Estimated payments"), ui.h("a", { class: "btn secondary", href: "#/taxes/self-employment" }, "Self-employment tax"))));
  }
  rulesCard();
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/goals/emergency-fund" }, "Emergency fund"), ui.h("a", { class: "btn secondary", href: "#/career/business" }, "Small business"))));

  function setCount(it, value) {
    pending = value === null ? `${it.name}: the plan counts the full ${money(it.monthly)} a month again.` : `${it.name}: your left-over figure and forecast now count on ${money(value)} a month. The tax pages stay on ${money(it.monthly)}.`;
    // on both halves of a raise from a later date (the chain), so the figure set here holds after the start date too (round 5)
    store.update((p) => { setCountOn(p, it, value); });
  }
  // the careful figure on file, said wherever it is (with too few months typed too), with the way back: it used to vanish
  // from this page once the months ran out while it kept lowering the left-over figure (review 2026-11-02)
  function countedSay(it) {
    const better = it.enough && it.countOn > 0 && Math.abs(it.counted - it.countOn) >= 1 && it.countOn < it.monthly - 0.5;
    return [ui.h("p", { class: "si-say" }, `Your plan counts on ${money(it.counted)} a month from this for spending and saving (the left-over figure and the forecast). The tax pages (Estimated payments, the April bill) still use the Income page's ${money(it.monthly)} a month; what comes in above ${money(it.counted)} is a bonus to save.`),
      ui.row(better ? ui.button(`Count on ${money(it.countOn)} instead`, () => setCount(it, Math.round(it.countOn)), { class: "secondary" }) : null,
        ui.button(`Count the full ${money(it.monthly)} again`, () => setCount(it, null), { class: "secondary" }))];
  }
  function itemCard(it) {
    const s = it.stats;
    const card = ui.card(it.name);
    if (it.enough) {
      card.append(ui.row(
        ui.stat("Count on", money(it.countOn), `a month: reached in ${s.reached} of the ${s.n} months typed`),
        ui.stat("Average", money(s.average), `a month; from ${money(s.low)} to ${money(s.high)}`),
      ));
      card.append(bars(it));
      // "count on" is saved apart (income[].countOn): the left-over figure, Forecast and Budget plan with it, while tax stays on
      // the Income page's amount. It used to overwrite that amount, so every tax page dropped and the quarterly payment shrank
      // to a third (round 4, 2026-11-02)
      if (it.counted !== null) card.append(...countedSay(it));
      else if (it.gap > 0.5 && it.countOn > 0) card.append(ui.h("p", { class: "si-say" }, `The Income page counts ${money(it.monthly)} a month, but less than that came in during ${it.below} of the ${s.n} months. Planning your spending with ${money(it.countOn)} keeps the lean months from catching you out; the rest is a bonus to save. The tax pages stay on ${money(it.monthly)}.`),
        ui.row(ui.button(`Count on ${money(it.countOn)} a month`, () => setCount(it, Math.round(it.countOn)))));
      else if (it.countOn <= 0) card.append(ui.h("p", { class: "si-say" }, `More than 1 month in 4 brought nothing, so there is no amount the plan can safely count on every month: keep it out of the monthly budget and save what comes.`));
      else card.append(ui.h("p", { class: "si-say" }, `The Income page's ${money(it.monthly)} a month is a careful figure: at least that much came in during ${s.n - it.below} of the ${s.n} months.`));
      if (s.cushion > 0.5) card.append(ui.h("p", {}, `To pay yourself the average, ${money(s.average)}, every month, you would have needed ${money(s.cushion)} saved at the worst point (${monthName(s.deepest)}). Keep a cushion like that in savings for this income.`));
      if (s.zeros) card.append(ui.h("p", { class: "muted small" }, `${s.zeros} of the months brought nothing.`));
    } else {
      card.append(ui.h("p", {}, `The Income page counts ${money(it.monthly)} a month. ${s.n ? `With only ${s.n} month${s.n === 1 ? "" : "s"} typed, there is not enough to say what to count on: type at least ${MIN_MONTHS}.` : "Type what came in each of the last months below to see how much a month you can safely count on."}`));
      if (it.counted !== null) card.append(...countedSay(it));
    }
    // the months
    const fields = d.months.map((m) => ({ key: m, label: monthName(m), type: "money", min: 0 }));
    const values = Object.fromEntries(d.months.map((m, i) => [m, it.typedMonths[i]]));
    card.append(ui.h("details", { class: "fold", open: openId === it.id || (!s.n && d.items.length === 1) || null }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "The last 12 months"), ui.h("span", { class: "fold-status" }, s.n ? `${s.n} typed` : "none typed"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("p", { class: "muted small" }, "What came in each month, before tax and before expenses; leave a month empty if you do not know it, type 0 if nothing came."),
      ui.form(fields, values, (v) => {
        openId = it.id; pending = "Months saved.";
        // kept by the chain (it.key), so months typed before a raise's start date are still there after it (round 5)
        store.update((p) => { saveMonths(p, it, Object.fromEntries(d.months.map((m) => [m, v[m]]))); });
      }, { submitLabel: "Save the months" })));
    return card;
  }
  function bars(it) {
    const top = Math.max(1, ...it.typedMonths.filter((v) => v !== null));
    const box = ui.h("div", { class: "si-bars", role: "img", "aria-label": `The last 12 months of ${it.name}, with the amount to count on` },
      it.typedMonths.map((v) => ui.h("span", { class: v === null ? "none" : v < it.countOn ? "low" : null, style: { height: `${v === null ? 0 : Math.max(2, (v / top) * 100)}%` } })),
      ui.h("div", { class: "si-line", style: { bottom: `${(it.countOn / top) * 100}%` } }));
    return ui.h("div", {}, box, ui.h("div", { class: "si-ticks" }, d.months.map((m) => ui.h("span", {}, monthName(m, "short")))),
      ui.h("div", { class: "si-key" }, ui.h("i", {}), `the ${money(it.countOn)} to count on; grey months fell short of it`));
  }
  function rulesCard() {
    const r = d.rules;
    root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Forms and records"), ui.h("span", { class: "fold-status" }, r.stale ? `${r.year} rules, the latest known` : `${r.year} rules`), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("ul", { class: "records" },
        ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, "Clients who pay you"), ui.h("span", { class: "rec-value" }, `from ${money(r.form1099NEC)}`)), ui.h("div", { class: "rec-sub" }, `send a Form 1099-NEC when they paid you ${money(r.form1099NEC)} or more in the year.`)),
        ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, "Payment apps and marketplaces"), ui.h("span", { class: "rec-value" }, `over ${money(r.form1099K.apps.amount)}`)), ui.h("div", { class: "rec-sub" }, `send a Form 1099-K over ${money(r.form1099K.apps.amount)} and more than ${r.form1099K.apps.payments} payments in the year.`)),
        ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, "Card readers and card processors"), ui.h("span", { class: "rec-value" }, "any amount")), ui.h("div", { class: "rec-sub" }, "send a Form 1099-K for card sales of any size.")),
        ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, "Taxed either way"), ui.h("span", { class: "rec-value" }, "all of it")), ui.h("div", { class: "rec-sub" }, `with or without a form, the profit is income; self-employment tax starts once ${Math.round(THRESHOLDS.seBase * 10000) / 100}% of the year's profit reaches ${money(THRESHOLDS.seTax)} (about ${money(THRESHOLDS.seTax / THRESHOLDS.seBase)} of profit).`)),
        ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, "Driving for it"), ui.h("span", { class: "rec-value" }, `${Math.round(r.mileage * 1000) / 10}¢ a mile`)), ui.h("div", { class: "rec-sub" }, `comes off the profit: keep a log of the date, the trip and the miles.${r.mileageSteps.length > 1 && !r.stale ? ` In ${r.year} the rate was ${r.mileageSteps.map((m, i) => `${m.cents}¢ ${i === 0 ? "from January" : `from ${new Date(`${m.from}T12:00:00`).toLocaleDateString("en-US", { month: "long" })}`}`).join(", then ")}.` : ""}`))),
      ui.h("p", { class: "muted small" }, "Expenses (supplies, a share of the phone, miles) go on the Self-employment page and lower the tax.")));
  }
}
