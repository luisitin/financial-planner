// modules/cashflow/expenses/view.js -- DOM only. Totals, a breakdown by category with bars,
// a tappable list of expenses, one form to add or edit.
import { bankVsPlan } from "../income-statement/compute.js";
import { compute, CATEGORIES, closeGap } from "./compute.js";
import { PERIOD_OPTIONS, periodLabel } from "../../../core/math/periods.js";

const FIELDS = [
  { key: "name", label: "What is it", type: "text", required: true, placeholder: "e.g. Rent" },
  { key: "category", label: "Category", type: "select", options: Object.entries(CATEGORIES).map(([value, c]) => ({ value, label: c.label })) },
  { key: "amount", label: "Amount", type: "money", required: true, min: 0, help: "what you pay each time" },
  { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS },
  { key: "essential", label: "I must pay this (not optional)", type: "checkbox" },
  { key: "inflates", label: "Goes up with prices over the years", type: "checkbox" },
  { key: "startDate", label: "Starts", type: "date", help: "blank if it already has" },
  { key: "endDate", label: "Ends", type: "date", help: "blank if it does not end" },
];

const periodWords = (p) => periodLabel(p).toLowerCase();
// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  // One left-over figure across the app: what is left after tax, spending and saving, the same number the Dashboard
  // and Next best action show. Pay before tax minus spending (this page's own leftOver) left tax out and read about
  // twice as high; it shows only when the after-tax figure cannot be worked out yet, and says so.
  const nba = d.income ? ctx.computeOf("overview/next-best-action", { today: fmt.today() }) : null;
  const leftTile = () => {
    if (!d.income) return null;
    // the tile opens Next best action's "Each month's money", which shows how the figure is reached
    const linked = (t) => { t.append(ui.h("span", { class: "stat-chev", "aria-hidden": "true" }, "\u203a")); return ui.h("a", { href: "#/overview/next-best-action", class: "stat-link", "aria-label": `${t.textContent.replace("\u203a", "").trim()}. See how it is worked out` }, t); };
    // short on the careful month (uneven pay counted at what you can count on): said so, with what a month that brings the
    // Income page's amount leaves (review 2026-11-02)
    // (the full-month figure to the nearest $10, as every page says it: Next best action's spare.fullAbout; round 5)
    // within $5 of $0 the full month "only just about breaks even" (spare.fullKind), never "about $0" (round 5)
    if (nba?.ready) { const v = nba.spare.monthly, held = nba.spare.held > 0.5, kind = nba.spare.fullKind, about = nba.spare.fullAbout; return linked(ui.stat(v >= 0 ? "Left over" : nba.drawing ? "From savings" : "Short", fmt.money(Math.abs(v), cur), v >= 0 ? `each month, after tax, bills and saving${nba.spare.debtExtra > 0 ? `, and ${fmt.money(nba.spare.debtExtra, cur)} extra on debts` : ""}${held ? `, counting uneven pay at what you can count on` : ""}` : nba.drawing ? "each month, as your retirement plan intends" : held ? `in a lean month; when all your uneven pay comes in, ${kind === "ahead" ? `about ${fmt.money(about, cur)} is left` : kind === "even" ? "it only just about breaks even" : `it is still about ${fmt.money(-about, cur)} short`}` : "more goes out than comes in, after tax and saving", { link: true })); }
    return ui.stat("Before tax", fmt.money(d.leftOver, cur), "pay minus spending each month; tax and saving not taken out yet");
  };
  let editing = null;
  // short each month: say by how much, then the fewest nice-to-haves that close it (tap one to change it), the biggest
  // must-pays when that is not enough, and the goal saving that could pause; Next best action's first step lands here
  const gapCard = () => {
    if (!(nba?.ready && nba.spare.monthly < 0)) return null;
    // retired and living on savings as the plan intends: a calm line, not a list of things to cut
    if (nba.drawing) return ui.h("section", { class: "card" }, ui.h("h2", {}, "Drawn from savings"),
      ui.h("p", {}, `About ${fmt.money(-nba.spare.monthly, cur)} a month comes from your savings. If markets do as well as average, your plan can carry ${fmt.money(nba.drawing.affordableMonthly, cur)} a month of spending and the money lasts; less in a bad run of years (Will the money last? shows how much less).`),
      ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "Will the money last? ›")));
    const g = closeGap(d.items, -nba.spare.monthly, { goalSaving: nba.spare.goalSaving });
    const m = (v) => fmt.money(v, cur);
    // short only on the careful month (Side income's "count on"): a month that brings the Income page's amount leaves money,
    // so good months make up for lean ones and no must-pay has to go (review 2026-11-02)
    const held = nba.spare.held > 0.5, kind = nba.spare.fullKind, lean = held && kind === "ahead";
    const open = (id) => { const x = plan.expenses.find((y) => y.id === id); if (!x) return; editing = x; showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); };
    const row = (x, detail) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" }, onClick: () => open(x.id),
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name), ui.h("div", { class: "d" }, detail)),
      ui.h("span", { class: "st amount" }, ui.h("div", {}, m(x.monthly)), ui.h("div", { class: "muted small" }, "a month"), ui.h("div", { class: "muted small" }, "Change \u203a")));
    // a trim in the expense's own terms, the amount its form asks for: "$360 once a year instead of $3,000"
    const trimText = (x) => x.period === "monthly" ? `trimming it by ${m(x.trimBy)} a month is enough` : `${m(x.trimTo)} ${periodWords(x.period)} instead of ${m(x.amount)} is enough`;
    const lead = !g.picks.length ? (lean ? "There are no nice-to-have expenses to cut. Good months make up for lean ones; keep your cash cushion for the months in between." : "There are no nice-to-have expenses to cut, so the gap has to come from the must-pays below or from what goes to saving.")
      : g.enough ? (g.picks.length === 1 ? (g.picks[0].trimBy ? `${g.picks[0].name}: ${trimText(g.picks[0])}.` : `Cutting ${g.picks[0].name} closes it.`) : `Cutting ${g.picks.length === 2 ? "these two" : `these ${g.picks.length}`} nice-to-haves closes it:`)
      : `Cutting every nice-to-have (${m(g.niceTotal)} a month) still leaves ${m(g.gap - g.covered)} short${lean ? " in a lean month. Good months make up for the rest; keep your cash cushion for the months in between." : "."}`;
    const must = g.bigMustPays.length && !lean;
    return ui.h("section", { class: "card gap-card" },
      ui.h("h2", {}, "Close the gap"),
      ui.notice("warn", held ? `About ${m(g.gap)} a month more goes out than comes in, after tax and saving, counting uneven pay at what you can count on (Side income). ${lean ? `A month that brings the Income page's amount leaves about ${m(nba.spare.fullAbout)}, so this is about the lean months.` : kind === "even" ? "Even a month that brings the Income page's amount only just about breaks even. This is the first thing to fix." : `Even a month that brings the Income page's amount is about ${m(-nba.spare.fullAbout)} short. This is the first thing to fix.`}`
        : `About ${m(g.gap)} a month more goes out than comes in, after tax and what goes to saving. This is the first thing to fix.`),
      ui.h("p", {}, lead),
      g.picks.length ? ui.h("ul", { class: "page-list" }, g.picks.map((x) => row(x, x.trimBy ? `nice to have \u00b7 ${trimText(x)}` : "nice to have"))) : null,
      must ? ui.h("p", { class: "small", style: { margin: "12px 0 0" } }, g.picks.length ? "The rest has to come from a must-pay. The biggest:" : "The biggest must-pays:") : null,
      must ? ui.h("ul", { class: "page-list" }, g.bigMustPays.map((x) => row(x, "must pay \u00b7 a cheaper version closes part of it"))) : null,
      g.goalSaving > 0 ? ui.h("p", { class: "muted small" }, `Or for now: ${m(g.goalSaving)} a month goes to your goals, and pausing some of it closes ${g.goalSaving >= g.gap ? "the gap" : "part of the gap"}. `, ui.h("a", { href: "#/goals/goals" }, "Goals \u203a")) : null,
      // the saved debt plan's extra counts as spoken for; when it is what tips the month over, lowering it is a way out too
      nba.spare.debtExtra > 0 ? ui.h("p", { class: "muted small" }, `Or: ${m(nba.spare.debtExtra)} a month extra goes to debts on top of the required payments, and lowering it closes ${nba.spare.debtExtra >= g.gap ? "the gap" : "part of the gap"}. `, ui.h("a", { href: "#/debt/payoff" }, "Pay off debts ›")) : null,
      ui.h("p", { class: "muted small" }, "Tap one to change its amount or give it an end date. The left-over figure updates as soon as you save."),
    );
  };

  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What goes out?"),
      ui.h("p", { class: "lede" }, "Add your regular expenses: rent or mortgage, utilities, groceries, insurance, the car, subscriptions. Rough numbers are fine to start."),
      ui.h("p", { class: "muted small" }, "Mark each one as something you must pay or something that is nice to have. That split is what the emergency-fund and retirement pages use."),
    ));
  } else {
    root.append(ui.card(null, ui.row(
      ui.stat("Per month", fmt.money(d.monthly, cur), `${fmt.money(d.yearly, cur)} a year`),
      ui.stat("Must pay", fmt.money(d.essentialMonthly, cur), "per month, the bills that cannot wait"),
      ui.stat("Nice to have", fmt.money(d.optionalMonthly, cur), "per month, could be cut in a pinch"),
      leftTile(),
    ),
    // Next year and one-time amounts as one sentence under the tiles (design log 2026-09-16, pass 3).
    ui.h("p", { class: "muted small", style: { marginTop: "10px" } },
      `Next year about ${fmt.money(d.nextYear, cur)} after inflation.` +
      (d.oneTime ? ` One-time costs coming up: ${fmt.money(d.oneTime, cur)}, not in the monthly total.` : "")),
    ));
    // the bank files show more going out than this page lists (bankVsPlan): each kind the bank shows more of, one tap to add
    // the rest, so every figure in the plan follows (round 4, 2026-11-02)
    let bk = null;
    try { bk = bankVsPlan(plan, { today: fmt.today() }); } catch { bk = null; }
    const ten = (v) => Math.round(v / 10) * 10;
    // months left out for a payment that went to one of two cards (ledger unsureWords), said under the card that compares
    const unsureNote = () => ((bk?.unsure ?? []).length ? ui.h("p", { class: "muted small" }, bk.unsure.map((u) => u.text).join(" ")) : null);
    // the gap is mostly payments to a card whose file isn't in: nobody has seen what they bought, so its file comes first,
    // never an "Add" for it (re-check 4, 2026-11-02)
    // (two cards at one bank with no file for either: "Bring in the card files", over the months whole but for them; re-check 5)
    const cf = bk?.cardFile;
    if (cf) root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, `${cf.title} before adding more here`),
      ui.h("p", {}, `Over the last ${cf.months}${cf.whole ? " whole" : ""} months about ${fmt.money(ten(cf.monthly), cur)} a month went to ${cf.the} from your bank, but ${cf.plural ? "their own files aren't in, so what they bought isn't sorted into kinds yet. Bring them in" : "its own file isn't in, so what it bought isn't sorted into kinds yet. Bring it in"}, then compare again.`),
      ui.row(ui.h("a", { class: "btn", href: cf.href }, cf.title)), unsureNote()));
    if (bk?.over) {
      root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Your bank shows more going out"),
        ui.h("p", {}, `Over the last ${bk.months} whole months your bank files show about ${fmt.money(ten(bk.bankOut), cur)} a month going out; this page lists ${fmt.money(ten(bk.planOut), cur)}. Add what is missing, and every figure in the plan follows.${bk.cards >= 1 ? ` Another ${fmt.money(ten(bk.cards), cur)} a month went to cards whose files aren't in; that is not counted here until their files show what it bought.` : ""}`),
        bk.lines.length ? ui.h("ul", { class: "page-list" }, bk.lines.map((x) => ui.h("li", {},
          ui.h("span", { class: "ic" }, x.icon),
          ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.label), ui.h("div", { class: "d" }, x.plan > 0.5 ? `bank about ${fmt.money(ten(x.bank), cur)} a month, listed here ${fmt.money(ten(x.plan), cur)}` : `bank about ${fmt.money(ten(x.bank), cur)} a month, not listed here`)),
          ui.h("span", { class: "st" }, ui.button(`Add ${fmt.money(ten(x.more), cur)}`, () => {
            const name = x.plan > 0.5 ? `${x.label}: the rest the bank shows` : x.label;
            pending = `Added ${name}: ${fmt.money(ten(x.more), cur)} a month.`;
            store.update((p) => { p.expenses = p.expenses ?? []; p.expenses.push({ id: ui.uid(), name, category: x.category, amount: ten(x.more), period: "monthly", essential: x.essential, inflates: true }); });
          }, { class: "secondary small" }))))) : null,
        bk.unfiled >= 50 ? ui.h("p", { class: "muted small" }, `About ${fmt.money(ten(bk.unfiled), cur)} a month of it is not filed under a kind yet. `, ui.h("a", { href: "#/transactions/categorize" }, "File it \u203a")) : null, unsureNote()));
    }
    const gc = gapCard();
    if (gc) root.append(gc);
    // a debt paid off whose payment is still listed: one tap stops it from today, and the left-over figure grows by it
    for (const x of d.ended ?? []) {
      root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, `${x.debtName} is paid off`),
        ui.h("p", {}, `Its payment, ${x.name} (${fmt.money(x.monthly, cur)} a month), is still counted here. Stop it, and that money is free for your next step.`),
        ui.row(ui.button(`Stop ${x.name} from today`, () => {
          pending = `${x.name} stopped: ${fmt.money(x.monthly, cur)} a month is free from today.`;
          const y = new Date(`${fmt.today()}T12:00:00`); y.setDate(y.getDate() - 1);
          const before = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
          store.update((p) => { const e = (p.expenses ?? []).find((z) => z.id === x.id); if (e) e.endDate = before; });
        }), ui.button("It is something else", () => { const e = plan.expenses.find((z) => z.id === x.id); if (!e) return; editing = e; showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, { class: "secondary" }))));
    }
    if (d.byCategory.length) root.append(ui.card("Where it goes",
      ui.h("ul", { class: "page-list" }, d.byCategory.map((c) => ui.h("li", {},
        ui.h("span", { class: "ic" }, c.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.label), ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(c.share * 100)}%` } }))),
        ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(c.monthly, cur)), ui.h("div", { class: "muted small" }, `a month \u00b7 ${c.percent}%`)),
      ))),
      // a payment kept only on the Debts page is counted, and said by name, so the total is never short of it
      d.fromDebts?.length ? ui.h("p", { class: "muted small", style: { margin: "10px 0 0" } }, `Counted from the Debts page, as no expense here is ${d.fromDebts.length === 1 ? "its" : "their"} payment: ${d.fromDebts.map((x) => `${x.name} ${fmt.money(x.monthly, cur)} a month`).join(", ")}. `, ui.h("a", { href: "#/balance/liabilities" }, "Debts \u203a")) : null,
    ));
  }
  // the before-tax "you spend more than comes in" gives way to the after-tax figure the tile shows, whichever way it falls
  for (const w of d.warnings) if (!(nba?.ready && w === d.overspend)) root.append(ui.notice("warn", w));
  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = d.count === 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) {
      formHost.append(ui.button("+ Add another expense", () => { showForm = true; drawForm(); }, { class: "secondary" }));
      return;
    }
    const values = editing ? { ...editing, inflates: editing.inflates !== false } : { category: "housing", period: "monthly", essential: true, inflates: true };
    const f = ui.form(FIELDS, values, (v) => {
      const clean = { name: v.name.trim(), category: v.category, amount: v.amount ?? 0, period: v.period, essential: !!v.essential, inflates: !!v.inflates, startDate: v.startDate || "", endDate: v.endDate || "" };
      if (!clean.name) return;
      pending = editing ? "Changes saved." : `${clean.name} added.`;
      store.update((p) => {
        p.expenses = p.expenses ?? [];
        if (editing) { const i = p.expenses.findIndex((x) => x.id === editing.id); if (i >= 0) p.expenses[i] = { ...p.expenses[i], ...clean }; }
        else p.expenses.push({ id: ui.uid(), ...clean });
      });
      editing = null;
    }, { submitLabel: editing ? "Save changes" : "Add expense", resetAfter: !editing, onCancel: (editing || d.count > 0) ? () => { editing = null; showForm = false; drawForm(); } : null });
    // picking a category suggests whether it is a must-pay
    const catSel = f.querySelector("select[name=category]"), essBox = f.querySelector("input[name=essential]");
    if (catSel && essBox && !editing) catSel.addEventListener("change", () => { essBox.checked = (CATEGORIES[catSel.value] ?? CATEGORIES.other).essential; });
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.name}` : "Add an expense"),
      f,
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
        if (!ui.confirm(`Remove ${editing.name}?`)) return;
        const id = editing.id; const name = editing.name; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.expenses = (p.expenses ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  if (d.count > 0) {
    const sub = (x) => {
      const bits = [`${fmt.money(x.amount, cur)} ${x.periodLabel.toLowerCase()}`, x.categoryLabel, x.essential ? "must pay" : "nice to have"];
      if (x.upcoming) bits.push(`starts ${fmt.date(x.startDate)}`);
      if (x.ended) bits.push(`ended ${fmt.date(x.endDate)}`);
      else if (x.endDate) bits.push(`until ${fmt.date(x.endDate)}`);
      return bits.join(" · ");
    };
    const rows = [...d.items].sort((a, b) => Number(b.active) - Number(a.active) || b.monthly - a.monthly);
    root.append(ui.card("Expenses",
      ui.h("ul", { class: "page-list" }, rows.map((x) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer", opacity: x.active ? 1 : 0.6 },
        onClick: () => { editing = plan.expenses.find((y) => y.id === x.id); showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, x.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name, x.active ? null : ui.h("span", { class: "pill" }, x.upcoming ? "not yet" : "ended")), ui.h("div", { class: "d" }, sub(x))),
        ui.h("span", { class: "st amount" }, !x.active ? ui.h("div", { class: "muted" }, x.upcoming ? "not yet" : "ended") : ui.h("div", {}, x.period === "once" ? fmt.money(x.amount, cur) : fmt.money(x.monthly, cur)), !x.active ? null : ui.h("div", { class: "muted small" }, x.period === "once" ? "one time" : "a month"), ui.h("div", { class: "muted small" }, "Edit \u203a")),
      ))),
      ui.h("p", { class: "muted small" }, "Tap an expense to change it."),
      out, formHost,
    ));
  } else {
    formCard.append(out, formHost);
    root.append(formCard);
  }
  root.append(ui.h("style", {}, ".st.amount { text-align: right; }"));
}
