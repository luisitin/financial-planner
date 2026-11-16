// modules/career/business/view.js -- DOM only. A small business from its owner's side, simple first (docs/OPTIONAL.md; opt
// spec 6.1, career/business, class C, done with gap list next 60 #6): the hero says what the business leaves the person
// after tax (one sentence per case, words.js), an S corporation's saving when there is one, the retirement plans for the
// business; then one card of quiet rows drawn by core/ui/more.js (no hand-written <details>): "Costs you may be
// missing" (costs.js), "The business" (its figures and its expenses), "Costs from your bank lines" (costs.js: the
// ledger lines tied to the business added up by the page's kinds, "Use these" with a question first and Undo), "As an
// S corporation", "How this is worked out".
import { compute, CATEGORIES } from "./compute.js";
import { HOME_OFFICE, SCORP_COSTS_EXAMPLE } from "./data/business.js";
import { answerFor, drawLine, savedLine, scorpWorth, scorpStatus } from "./words.js";
import { checklist, missedStatus, typedByKind, MISSED_TITLE, MISSED_INTRO, MISSED_SOURCES, BANK_TITLE, BANK_TAG, BANK_THEN, BANK_UNDONE, bankCosts, bankSentence, apartLine, bankStatus, usable, inUse, bankAsk, bankSaid, useBank, bankFrom, fromBank, partNote } from "./costs.js";
import { PERIOD_OPTIONS } from "../../../core/math/periods.js";
import { parts, links } from "../../../core/ui/more.js";

// the confirmation shown on the next render, and where: { text, at: "hero" | "business" | "bank" | "scorp", undo?, back? }. The
// part saved in shows it and stays open (R17); no other part opens or shuts
let pending = null;

const STYLE = `
.bz-root .bz-lines { list-style: none; margin: 0; padding: 0; }
.bz-root .bz-lines li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.bz-root .bz-lines li:last-child { border-bottom: 0; }
.bz-root .bz-lines li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
.bz-root .bz-lines .bz-tot { font-weight: 700; }
.bz-root .bz-say { margin: 8px 0; }
.bz-root .bz-add { margin-top: 10px; }
.bz-root .bz-head { margin: 4px 0 0; font-weight: 700; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const h = ui.h;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const today = fmt.today();
  const d = compute(plan, { today });
  const s = plan.whatIfs?.business ?? {};
  const root = h("div", { class: "bz-root" }, h("style", {}, STYLE));
  page.append(root);
  const said = pending; pending = null;
  const noteAt = (at) => (said && said.at === at ? ui.notice("ok", said.text, said.undo ? { undo: said.undo, undone: (r) => { pending = { text: ui.undoneWords(r, said.back), at }; } } : {}) : null);
  // the green line names the answer as saved (R7): the page worked again on the plan the change makes
  const answerAfter = (lead, change) => {
    try { const p = structuredClone(plan); p.whatIfs = p.whatIfs ?? {}; p.whatIfs.business = p.whatIfs.business ?? {}; change(p.whatIfs.business, p); return savedLine(compute(p, { today }), money, lead); } catch { return lead; }
  };
  const save = (lead, at, fn) => { pending = { text: answerAfter(lead, fn), at }; store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.business = p.whatIfs.business ?? {}; fn(p.whatIfs.business, p); }); };
  const line = (label, amount, opts = {}) => h("li", { class: opts.total ? "bz-tot" : null }, h("span", {}, label), h("span", {}, `${opts.minus ? "−" : ""}${money(amount)}`));
  const head = (text) => h("p", { class: "bz-head" }, text);

  // ---------------------------------------------------------------- the answer
  const A = answerFor(d, money);
  if (!d.ready) root.append(h("section", { class: "card accent hero" }, h("h1", {}, A.title), h("p", { class: "lede" }, A.line),
    h("p", { class: "muted small" }, "Add it on the Income page as \"Self-employment / business\", or type what customers pay under \"The business\" below."),
    ui.row(h("a", { class: "btn", href: "#/cashflow/income" }, "Add it on Income"))));
  else {
    // put this profit on Income (what the federal estimate, the budget and the retirement plan count) and fold the
    // Self-employment page's expenses in here, so every page counts the same profit
    const synced = d.incomeYearly !== null && Math.abs(d.incomeYearly - d.profit) < 12 && !(d.seExpenses > 0);
    const offer = !synced && d.incomeId && d.singleBusiness && d.typedHere && d.profit > 0;
    const drawn = drawLine(d, money);
    root.append(h("section", { class: "card accent hero" }, h("h1", {}, A.title), h("p", { class: "lede" }, A.line),
      drawn ? h("p", { class: "bz-say" }, drawn) : null,
      noteAt("hero"),
      offer ? ui.row(ui.button("Use this profit on Income", () => {
        pending = { text: `The Income page now counts the profit, ${money(d.profit / 12)} a month.${d.seExpenses > 0 ? " The Self-employment page's expenses are part of it now, so that page shows none." : ""}`, at: "hero" };
        store.update((p) => {
          const x = (p.income ?? []).find((y) => y.id === d.incomeId);
          if (x) { x.amount = Math.round(d.profit / 12); x.period = "monthly"; }
          p.whatIfs = p.whatIfs ?? {}; p.whatIfs.business = p.whatIfs.business ?? {};
          const w = p.whatIfs.business;
          w.revenue = Math.round(d.revenue);   // kept here, since Income now holds the profit
          if (!(w.expenses ?? []).length && d.seExpenses > 0) w.expenses = [{ id: ui.uid(), name: "Expenses from the Self-employment page", category: "other", amount: d.seExpenses, period: "annual" }];
          p.whatIfs.selfEmployment = { ...(p.whatIfs.selfEmployment ?? {}), expenses: 0 };
        });
      })) : null,
      offer ? h("p", { class: "muted small" }, `Income then holds the profit, ${money(d.profit / 12)} a month, so the federal estimate, the Self-employment page, the budget and the retirement plan all count the same business.`) : null));
  }

  // ---------------------------------------------------------------- alarms and what is worth money (never folded, R9)
  const NO_COSTS = "No expenses typed yet: the profit below is all of the revenue.";   // compute's words, said here as the page reads now
  // the bank lines' costs, read once for the notice and the row (they write nothing)
  const B = bankCosts(plan, { year: d.year, today, incomeId: d.incomeId ?? s.incomeId ?? null });
  const bankShows = d.ready && B.case === "some" && usable(B).length ? usable(B).reduce((t, k) => t + k.amount, 0) : 0;
  // no costs typed while the bank lines hold some: say where they are (person critic P3)
  for (const n of d.notes ?? []) root.append(ui.notice("info", n === NO_COSTS ? `No costs typed yet, so all of what customers pay counts as profit.${bankShows > 0.5 ? ` Your bank lines show ${money(bankShows)} of costs: open “${BANK_TITLE}” below to use them.` : ""}` : n));
  // costs put in from the bank lines that cover part of a year: the profit is too high until the rest is in (P1)
  const part = d.ready ? partNote(s.expenses) : null;
  if (part) root.append(ui.notice("info", part));
  if (d.ready && d.draw === "over" && !d.loss) root.append(ui.notice("warn", `You take out ${money(d.drawMonthly)} a month, ${money(d.drawMonthly - d.keepMonthly)} more than it leaves after tax: the difference comes from savings or from the money you should keep for tax.`));
  if (d.ready && d.loss && d.drawMonthly > 0) root.append(ui.notice("warn", `You take out ${money(d.drawMonthly)} a month as well: all of it comes from savings while the business loses money.`));
  const worth = d.ready ? scorpWorth(d, money) : null;
  if (worth) root.append(h("p", { class: "bz-say", dataset: { worth: "" } }, worth));

  // the retirement plans for the business: the room in each and the tax it saves (each a hint worth money)
  const thisYear = d.year === Number(today.slice(0, 4)) ? "this year" : `for ${d.year}`;
  if (d.ready && d.earned < 0.5) root.append(ui.card("Retirement plans for the business", h("p", {}, "No earnings from the business this year, so nothing can go into a business retirement plan. A plan at a job, or an IRA, still can.")));
  else if (d.ready) {
    const best = d.plans.find((p) => p.key === d.best);
    root.append(ui.card("Retirement plans for the business", h("ul", { class: "records" }, d.plans.map((p) => h("li", {},
      h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, p.label), h("span", { class: "rec-value" }, p.late ? "too late now" : `up to ${money(p.room)}`)),
      // a SIMPLE IRA too late for the year says why under "How this is worked out"
      !p.late && p.saved > 0.5 ? h("div", { class: "rec-sub", dataset: { worth: "" } }, `Putting in the most saves about ${money(p.saved)} in tax ${thisYear}.`) : null))),
    best ? h("p", { class: "muted small" }, `${best.label} has the most room here.`) : null));
  }

  // ---------------------------------------------------------------- (a) costs you may be missing
  const C = checklist(d, s, money);
  let partsCard = null;
  const missedBody = () => [h("p", { class: "small" }, MISSED_INTRO),
    // a row not counted yet has its "Add" where a counted row has its figure (the row's sentence, "Not counted yet.", is
    // the button's name); the others say what the page does with it under what counts
    h("ul", { class: "records" }, C.items.map((it) => h("li", { dataset: { cost: it.key } },
      h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, it.title),
        it.state === "add" ? h("span", { class: "rec-value" }, ui.button("Add", () => goTo(it.go), { class: "secondary small", "aria-label": `${it.title}: not counted yet. ${it.label}` }))
          : it.amount > 0.5 ? h("span", { class: "rec-value" }, money(it.amount)) : null),
      h("div", { class: "rec-sub" }, it.counts),
      it.state === "add" ? null : h("div", { class: "rec-sub" }, it.said),
      it.go?.href ? h("div", { class: "rec-foot" }, h("a", { class: "btn secondary small", href: it.go.href }, it.label)) : null))),
    h("p", { class: "muted small" }, MISSED_SOURCES)];

  // ---------------------------------------------------------------- the business: its figures and its expenses
  const items = (plan.income ?? []).filter((x) => x.type === "business");
  const several = items.length > 1;
  let bizForm = null;
  const bizFields = [
    several ? { key: "incomeId", label: "Which one on the Income page", type: "select", options: items.map((x) => ({ value: x.id, label: x.name || "Business" })) } : null,
    { key: "revenue", label: "What customers pay a year", type: "money", min: 0, help: d.ready && d.incomeYearly !== null ? `before any expenses; leave blank to use the Income page's ${money(d.incomeYearly)}` : "before any expenses" },
    { key: "homeOfficeSqft", label: "Home office, square feet", type: "number", min: 0, max: 2000, step: "1", help: "a room used only and regularly for the business; up to 300 count. For example, a 10 by 12 foot room is 120." },
    { key: "miles", label: "Business miles a year", type: "number", min: 0, step: "1", help: "not the drive from home to a regular workplace; keep a log. For example, 50 miles a week is 2,600 a year." },
    { key: "healthPremiums", label: "Health insurance you pay for yourself a year", type: "money", min: 0, help: "when no employer plan covers you; it lowers the income you pay tax on" },
    { key: "drawMonthly", label: "What you take out for yourself a month", type: "money", min: 0, more: several },
    { key: "name", label: "Name of the business", type: "text", more: true },
  ].filter(Boolean);
  bizForm = ui.form(bizFields, { name: s.name ?? "", incomeId: d.incomeId ?? "", revenue: s.revenue ?? null, drawMonthly: s.drawMonthly ?? null, healthPremiums: s.healthPremiums ?? null, homeOfficeSqft: s.homeOfficeSqft ?? null, miles: s.miles ?? null }, (v) => {
    // Save with nothing typed on a first visit said "Saved." and saved nothing (stress test F5, 2026-11-11)
    if (!Object.keys(s).length && !d.ready && (v.incomeId ?? "") === (d.incomeId ?? "") && !String(v.name ?? "").trim() && ["revenue", "drawMonthly", "healthPremiums", "homeOfficeSqft", "miles"].every((k) => v[k] === null || v[k] === undefined)) {
      bizForm.querySelector(".notice.error")?.remove();
      bizForm.prepend(ui.notice("error", "Type what customers pay a year, or the business's name, first."));
      bizForm.querySelector("input")?.focus();
      return false;
    }
    save("Saved.", "business", (w) => { Object.assign(w, { ...v, name: String(v.name ?? "").trim() }); });
  }, { submitLabel: "Save" });

  const expenses = d.expenses ?? [];
  const expFields = [
    { key: "name", label: "What it is", type: "text", placeholder: "for example a camera lens" },
    { key: "category", label: "Kind", type: "select", options: Object.entries(CATEGORIES).map(([value, label]) => ({ value, label })) },
    // not `required`: the form sits in a shut part (S5); an empty amount is held back at Save instead
    { key: "amount", label: "Amount", type: "money", min: 0 },
    { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS.filter((o) => o.value !== "once") },
  ];
  const expForm = (kind = "supplies") => { const f = ui.form(expFields, { category: kind, period: kind === "professional" || kind === "education" ? "annual" : "monthly" }, (v) => {
    if (v.amount === null || v.amount === undefined) return ui.fieldError(f.querySelector('[name="amount"]'), "Type the amount first.");
    const entry = { id: ui.uid(), name: String(v.name ?? "").trim(), category: v.category, amount: v.amount ?? 0, period: v.period };
    save(`${entry.name || CATEGORIES[v.category]} added.`, "business", (w) => { w.expenses = [...(w.expenses ?? []), entry]; });
  }, { submitLabel: "Add the expense" }); return f; };
  const expBody = h("div", { style: { display: "grid", gap: "12px" } });
  let addForm = null;
  const openAdd = (kind) => {
    if (addForm) { const sel = addForm.querySelector('[name="category"]'); if (sel) sel.value = kind; return addForm; }
    addForm = expForm(kind);
    addBox.replaceChildren(addForm);
    return addForm;
  };
  const addBox = h("div", { class: "bz-add" });
  if (expenses.length) {
    expBody.append(h("ul", { class: "records" }, expenses.map((e) => h("li", {},
      h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, e.name), h("span", { class: "rec-value" }, `${money(e.yearly)} a year`)),
      e.fromSelfEmployment ? h("div", { class: "rec-sub" }, "Typed there as one figure. Add your expenses here one by one to replace it.")
        : e.deductible < e.yearly - 0.5 ? h("div", { class: "rec-sub" }, `${e.name === e.label ? "" : `${e.label}: `}half of it counts for tax (${money(e.deductible)})`)
        : e.name !== e.label ? h("div", { class: "rec-sub" }, e.label) : null,
      // put in from the bank lines: which ones, and when they cover part of a year only (P1)
      (() => { const w = bankFrom((s.expenses ?? []).find((x) => x?.id === e.id)); return w ? h("div", { class: "rec-sub" }, w) : null; })(),
      e.fromSelfEmployment ? null : h("div", { class: "rec-foot" }, ui.button("Remove", () => { save(`${e.name} removed.`, "business", (w) => { w.expenses = (w.expenses ?? []).filter((x) => x.id !== e.id); }); }, { class: "secondary small", "aria-label": `Remove ${e.name}` }))))));
    const b = ui.button("+ Add another expense", () => openAdd("supplies"), { class: "secondary" });
    addBox.append(ui.row(b));
  } else { addForm = expForm("supplies"); addBox.append(addForm); }
  expBody.append(addBox);
  const bizBody = [noteAt("business"), bizForm, head(expenses.length ? `Expenses, ${money(d.typedTotal ?? 0)} a year` : "Expenses"), expBody];

  // a checklist row's button: "The business" opens where it is, with the focus in the box (or the expense form, its kind
  // picked); nothing is saved until the person saves there
  function goTo(go) {
    const el = [...(partsCard?.querySelectorAll?.("details") ?? [])].find((x) => x.dataset?.part === "business");
    if (!el) return;
    el.open = true;
    let box = null;
    if (go.kind) box = openAdd(go.kind).querySelector('[name="amount"]');
    else if (go.box) box = el.querySelector(`[name="${go.box}"]`);
    // a box under the form's "More details (optional)" opens it too
    for (let a = box?.parentNode; a && a !== el; a = a.parentNode) if (a.tagName === "DETAILS" && !a.open) a.open = true;
    (ui.reveal ?? ((x) => x?.scrollIntoView?.({ block: "center" })))(box ?? el, { block: "center" });
    try { box?.focus?.({ preventScroll: true }); } catch { /* not focusable here */ }
  }

  // ---------------------------------------------------------------- (b) costs from your bank lines
  const typed = typedByKind(d), banked = fromBank(s.expenses);
  const bankBody = () => {
    const out = [noteAt("bank"), h("p", {}, bankSentence(B, money))];
    if (B.case === "noLines") out.push(h("p", { class: "muted small" }, BANK_THEN), ui.row(h("a", { class: "btn secondary", href: "#/transactions/import" }, "Bring in a bank file")));
    else if (B.case === "noneTied") out.push(h("p", { class: "muted small" }, BANK_THEN), ui.row(h("a", { class: "btn secondary", href: "#/transactions/ledger" }, "Transactions")));
    else {
      if (B.kinds.length) out.push(h("ul", { class: "records" }, B.kinds.map((k) => h("li", {},
        h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, k.label), h("span", { class: "rec-value" }, k.amount < 0 ? `${money(-k.amount)} back` : money(k.amount))),
        h("div", { class: "rec-sub" }, (typed[k.key] ?? 0) > 0.5 ? `${money(typed[k.key])} ${banked[k.key] ?? "a year typed here"}` : "none typed here")))));
      for (const a of B.apart) out.push(h("p", { class: "small" }, apartLine(a, money, { miles: d.miles?.miles ?? 0 })));
      if (usable(B).length && inUse(B, typed)) out.push(h("p", { class: "muted small" }, "The page counts these totals now."));
      else if (usable(B).length) {
        out.push(ui.row(ui.button("Use these", () => useThese(), { class: "secondary" })));
        out.push(h("p", { class: "muted small" }, "They replace what is typed for those kinds; the other kinds stay as typed. Nothing changes until you tap."));
      }
      out.push(h("a", { class: "small", href: `#/transactions/ledger?q=${encodeURIComponent(`#${BANK_TAG}`)}`, style: { display: "inline-flex", alignItems: "center", minHeight: "44px" } }, "See the lines on Transactions ›"));
    }
    return out;
  };
  // asked first; one change Undo takes back; the green line names the new answer (R7)
  function useThese() {
    const seFigure = !(s.expenses ?? []).length && d.seExpenses > 0 ? d.seExpenses : 0;
    if (!ui.confirm(bankAsk(B, money, { seFigure, typed }))) return;
    let text = bankSaid(B, money);
    try { const p = structuredClone(plan); p.whatIfs = p.whatIfs ?? {}; p.whatIfs.business = p.whatIfs.business ?? {}; useBank(p.whatIfs.business, B, () => "new"); text = savedLine(compute(p, { today }), money, text); } catch { /* the lead alone */ }
    const next = { text, at: "bank", back: BANK_UNDONE };
    pending = next;
    next.undo = ui.undoable(store, (q) => { q.whatIfs = q.whatIfs ?? {}; q.whatIfs.business = q.whatIfs.business ?? {}; useBank(q.whatIfs.business, B, ui.uid); });
  }

  // ---------------------------------------------------------------- an S corporation
  let scorpBody = null;
  if (d.ready && d.scorp) {
    const c = d.scorp;
    scorpBody = [noteAt("scorp"),
      ui.row(ui.stat(c.saving > 0 ? "Would save" : "Would cost", money(Math.abs(c.saving)), "a year, after its own costs"),
        ui.stat("Your salary from it", money(c.salary), c.salaryFrom === "example" ? "60% of profit: only an example" : "as you typed it")),
      h("ul", { class: "bz-lines" },
        line("Social Security and Medicare on the salary (both halves)", c.employee + c.employer),
        line("Federal income tax", c.federal),
        c.state > 0.5 ? line("State tax", c.state) : null,
        line(`Running costs${c.costsFrom === "example" ? " (an example)" : ""}`, c.costs),
        line("In all", c.total + c.costs, { total: true })),
      h("p", { class: "muted small" }, `An S corporation pays Social Security and Medicare only on the salary, not on the profit passed to you. The IRS requires a reasonable salary for the work you do before you take the rest, so a low salary to save tax is not allowed; ${c.costsFrom === "example" ? `the ${money(c.costs)} of yearly costs (payroll, the corporate return, state fees) is an example too.` : "set the costs below to your quotes."}`),
      ui.form([
        { key: "salary", label: "A reasonable salary for your work, a year", type: "money", min: 0, help: "what you would pay someone else to do the work; leave blank to use 60% of profit, an example" },
        { key: "scorpCosts", label: "Its running costs a year", type: "money", min: 0, help: `payroll service, the corporate return, state fees; leave blank to use ${money(SCORP_COSTS_EXAMPLE)}, an example` },
      ], { salary: s.salary ?? null, scorpCosts: s.scorpCosts ?? null }, (v) => {
        const lead = "Saved.";
        let text = lead;
        try { const p = structuredClone(plan); p.whatIfs = p.whatIfs ?? {}; p.whatIfs.business = { ...(p.whatIfs.business ?? {}), salary: v.salary, scorpCosts: v.scorpCosts }; const n = compute(p, { today }).scorp; if (n) text = n.saving > 0.5 ? `${lead} As an S corporation you would now keep about ${money(n.saving)} more a year.` : n.saving < -0.5 ? `${lead} As an S corporation you would now pay about ${money(-n.saving)} more a year.` : `${lead} As an S corporation you would now come out about the same.`; } catch { /* the plain line */ }
        pending = { text, at: "scorp" };
        store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.business = p.whatIfs.business ?? {}; p.whatIfs.business.salary = v.salary; p.whatIfs.business.scorpCosts = v.scorpCosts; });
      }, { submitLabel: "Compare" })];
  }

  // ---------------------------------------------------------------- how this is worked out: the profit, the tax, the plans
  let howBody = null;
  if (d.ready) {
    const t = d.tax;
    const off = [t.se > 0.5 ? "half the self-employment tax" : null, t.health > 0.5 ? "the health insurance you pay" : null].filter(Boolean);
    const synced = d.incomeYearly !== null && Math.abs(d.incomeYearly - d.profit) < 12 && !(d.seExpenses > 0);
    howBody = () => [
      head(`${d.name}, a year`),
      h("ul", { class: "bz-lines" },
        line(d.revenueFrom === "typed" ? "What customers paid" : "What customers paid (the Income page)", d.revenue),
        ...d.expenses.map((e) => line(e.deductible < e.yearly - 0.5 ? `${e.name} (half of ${money(e.yearly)} counts)` : e.name, e.deductible, { minus: true })),
        d.miles.amount > 0 ? line(`Business miles (${Math.round(d.miles.miles).toLocaleString("en-US")} at ${Math.round(d.miles.rate * 1000) / 10}¢)`, d.miles.amount, { minus: true }) : null,
        d.homeOffice > 0 ? line(`Home office (${money(HOME_OFFICE.perSqft)} a square foot)`, d.homeOffice, { minus: true }) : null,
        line(d.loss ? "Loss" : "Profit", Math.abs(d.profit), { total: true, minus: d.loss })),
      h("p", { class: "muted small" }, `${d.loss ? "" : d.margin !== null ? `The profit is ${pct(d.margin)} of what comes in. ` : ""}Costs a month: ${money(d.breakEvenMonthly)}, what must come in each month to break even.`),
      d.loss ? h("p", { class: "small" }, "There is no self-employment tax on a loss, and no 20% business deduction.") : [
        head("Your tax with the business in your own name (a sole proprietor)"),
        h("ul", { class: "bz-lines" },
          line("Self-employment tax (Social Security and Medicare)", t.se),
          line("Federal income tax", t.income),
          t.extra > 0.5 ? line("Extra Medicare tax", t.extra) : null,
          t.state > 0.5 ? line("State tax", t.state) : null,
          line(`In all${t.rate !== null ? `, ${pct(t.rate)} of profit` : ""}`, t.total, { total: true })),
        off.length || t.qbi > 0.5 ? h("p", { class: "muted small" }, [off.length ? `${off.join(" and ").replace(/^./, (x) => x.toUpperCase())} come${off.length > 1 ? "" : "s"} off income.` : null, t.qbi > 0.5 ? `The 20% business deduction takes ${money(t.qbi)} off taxable income.` : null, d.qbiLimited ? `Above ${money(d.qbiLine)} of taxable income the 20% deduction can be limited: check it with a tax preparer.` : null].filter(Boolean).join(" ")) : null],
      d.earned >= 0.5 ? [
        head("Retirement plans for the business"),
        h("ul", { class: "records" }, d.plans.map((p) => h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, p.label)), h("div", { class: "rec-sub" }, {
          sep: "Only the business puts in: 20% of your earnings after half the self-employment tax. Can be opened and filled up to the tax-filing deadline, extensions included.",
          solo: "You put in as the employee (the yearly limit, shared with any 401(k) at a job, more from age 50) and as the business (20%). Often the most room for a one-person business. A new one can still be set up for this year until the April tax-filing deadline.",
          simple: p.late ? `A new SIMPLE IRA must be set up by October 1 to count for that year, so it is too late for ${d.year}; you could open one for ${d.year + 1}. It would allow about ${money(p.room)}.`
            : `You put in up to ${money(d.simpleLimit)} a year (more from age 50), and the business adds the same, up to 3% of your pay. A new one must be set up by October 1 to count for that year.`,
        }[p.key])))),
        d.job401k ? h("p", { class: "muted small" }, `A 401(k) at a job already uses ${money(d.job401k.used)} of the ${money(d.job401k.limit)} a person may put in a year, so the solo 401(k) and the SIMPLE IRA have less room.`) : null,
        h("p", { class: "muted small" }, `Earnings for these plans: profit less half the self-employment tax, ${money(d.earned)} (the SIMPLE IRA counts 92.35% of profit, ${money(d.simpleComp)}). The money is invested like a 401(k) or IRA and taxed when taken out.`)] : null,
      synced && d.typedHere ? h("p", { class: "muted small" }, "The Income page counts this profit, so the other pages agree with this one.") : null,
    ].flat().filter(Boolean);
  }

  // ---------------------------------------------------------------- the parts, as quiet rows of one card
  const typedCount = ["revenue", "homeOfficeSqft", "miles", "healthPremiums", "drawMonthly"].filter((k) => s[k] !== null && s[k] !== undefined && s[k] !== "").length;
  partsCard = parts(ctx,
    { id: "missed", kind: "more", title: MISSED_TITLE, says: missedStatus(C), body: missedBody },
    // the person's own state, not a figure the answer above already says: "4 set by you", "from Income", "not set yet"
    { id: "business", kind: "own", title: "The business", set: typedCount + (s.expenses ?? []).length, says: d.ready && d.revenueFrom === "income" ? "from Income" : "", missing: !d.ready && !typedCount && !expenses.length,
      open: said?.at === "business" || undefined, holds: [...bizFields.map((f) => f.key), "amount", "category"], body: bizBody },
    // the bank lines wait until there is a business to tie them to (person critic P2)
    d.ready && { id: "bank", kind: "own", title: BANK_TITLE, says: bankStatus(B, money), open: said?.at === "bank" || undefined, body: bankBody },
    scorpBody && { id: "scorp", kind: "own", title: "As an S corporation", says: scorpStatus(d, money), open: said?.at === "scorp" || undefined, holds: ["salary", "scorpCosts"], body: scorpBody },
    howBody && { id: "how", kind: "how", says: "profit and tax", body: howBody });
  root.append(h("div", {}, partsCard));

  root.append(h("div", {}, links(ctx, [
    { href: "#/taxes/self-employment", ask: "What is the self-employment tax?" },
    { href: "#/taxes/estimated", ask: "When do I pay the tax during the year?" },
    { href: "#/retirement/contributions", ask: "Where do retirement savings go in?" },
    { href: "#/career/side-income", ask: "How much to set aside from side income?" },
  ])));
}
