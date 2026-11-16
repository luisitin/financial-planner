// modules/cashflow/income/view.js -- DOM only. Totals up top, a tappable list of income
// sources, one form to add or edit.
import { compute, INCOME_TYPES, looksYearly, changeFrom, rentAfterCostsOf } from "./compute.js";
import { PERIOD_OPTIONS, periodLabel, payRhythm } from "../../../core/math/periods.js";
import { takeHome } from "../paycheck/compute.js";
import { part, choice } from "../../../core/ui/more.js";
import { sectionsOf, sectionKey, asOne, itemize, unmarkOnAdd, rowLine, statusWords, sectionLine, holdWords, askWords, doneWords, itemizeWords, undoneWords, addWords, INTRO, PART_TITLE } from "./one-figure.js";

// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;
// "One figure or item by item" (gap next-60 #11): the green line after a tap in that part ({ text, undo?, r?, total? }), and,
// for this visit (a new address starts afresh), whether the person acted in it (it stays open, R17) and which kinds they changed
let oneSaid = null, oneOpen = false, landedOn = null;
const oneTouched = new Set();

const FIELDS = (people) => [
  { key: "name", label: "What is it", type: "text", required: true, placeholder: "e.g. Ana's salary" },
  { key: "type", label: "Kind of income", type: "select", options: Object.entries(INCOME_TYPES).map(([value, t]) => ({ value, label: t.label })) },
  { key: "personId", label: "Whose", type: "select", options: [{ value: "", label: "Household / joint" }, ...people.map((p) => ({ value: p.id, label: p.name }))] },
  { key: "amount", label: "Amount", type: "money", required: true, min: 0, help: "what arrives each time, before taxes if you know it" },
  { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS },
  { key: "growth", label: "Yearly raise", type: "percent", min: 0, max: 100, help: "type 3 for 3% a year; leave blank for none" },
  { key: "startDate", label: "Starts", type: "date", help: "leave blank if it has already started; for a raise from a later date, that date: the old amount runs until then" },
  { key: "endDate", label: "Ends", type: "date", help: "leave blank if it does not end" },
  { key: "taxable", label: "Income tax applies to it", type: "checkbox" },
];

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const today = fmt.today();
  const d = compute(plan, { today });
  const people = plan.household?.people ?? [];
  let editing = null;
  if (ctx.route !== landedOn) { landedOn = ctx.route; oneOpen = false; oneTouched.clear(); }

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What comes in?"),
      ui.h("p", { class: "lede" }, "Add each source of money: your pay, a partner's pay, side work, rent you collect, a pension. The plan puts them all on a monthly footing whatever the pay schedule."),
      ui.h("p", { class: "muted small" }, people.length ? "Tip: use the amount on the pay stub before taxes; the tax pages will work out the rest." : "Tip: add the people first (Household > People) so each income can be tied to who earns it. It works without that too."),
    ));
  } else {
    // typed pay is before tax; say so, and what reaches the bank (the Paycheck page's take-home), so nobody types take-home over it
    const th = takeHome(plan, { today });
    const net = th.ready && th.monthly < d.monthly - 0.5 ? th.monthly : null;
    // business income has no tax held back: it reaches the bank before its tax, which goes in four estimated payments
    // (review 2026-11-02: the sentence called the whole figure after tax, above what the Dashboard plans with)
    const biz = d.items.filter((x) => x.active && x.type === "business" && x.period !== "once" && x.taxable !== false).reduce((t, x) => t + x.monthly, 0);
    root.append(ui.card(null, ui.row(
      ui.stat("A month, before tax", fmt.money(d.monthly, cur), net !== null ? `${fmt.money(d.yearly, cur)} a year. About ${fmt.money(net, cur)} a month reaches the bank${biz > 0.5 ? `: your pay after tax, plus the ${fmt.money(biz, cur)} of business income before its tax (you pay that tax four times a year)` : " after tax"}` : `${fmt.money(d.yearly, cur)} a year`),
      ui.stat("Next year", fmt.money(d.nextYear, cur), d.nextYear > d.yearly ? "after the raises you entered" : "no raises entered"),
      d.untaxedYearly ? ui.stat("Not taxed", fmt.money(d.untaxedYearly, cur), "a year") : null,
      d.oneTime ? ui.stat("One-time amounts", fmt.money(d.oneTime, cur), "not in the monthly total") : null,
    )));
    if (d.byPerson.length > 1) root.append(ui.card("Who brings in what",
      ui.h("ul", { class: "page-list" }, d.byPerson.map((p) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, p.name), ui.h("div", { class: "d" }, `${Math.round(d.yearly ? (p.yearly / d.yearly) * 100 : 0)}% of the total`)),
        ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(p.monthly, cur)), ui.h("div", { class: "muted small" }, "a month"))))),
    ));
  }
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = d.count === 0;
  const ask = ui.h("div");   // the "did you mean a year?" question, above the form
  const save = (clean) => {
    const was = editing; editing = null;
    // a new amount from a date still to come (a raise from January) keeps today's pay until then: say both, and the change a month
    const ch = was ? changeFrom(was, clean, today) : null;
    const each = (x) => `${fmt.money(x.amount, cur)} ${periodLabel(x.period).toLowerCase()}`;
    if (ch?.split) {
      const diff = ch.change;
      pending = `From ${fmt.date(clean.startDate)} ${clean.name} is ${each(clean)}${Math.abs(diff) >= 1 ? ` (${diff > 0 ? "+" : "-"}${fmt.money(Math.abs(diff), cur)} a month before tax)` : ""}. Until then it stays ${each(was)}. Both are on this page.`;
    } else pending = was ? `Changes saved: ${clean.name}, ${each(clean)}.` : `${clean.name} added.`;
    // another line of a kind kept as one figure lists that kind item by item again (gap next-60 #11)
    const unmark = !was ? sectionsOf(plan).find((s) => s.mode === "one" && s.key === sectionKey(clean)) : null;
    if (unmark) pending = `${pending} ${addWords(unmark.name)}`;
    store.update((p) => {
      p.income = p.income ?? [];
      if (was) {
        const i = p.income.findIndex((x) => x.id === was.id);
        // the pay that ends keeps its id; the new pay gets a new one and says which line it carries on (`continues`), so
        // Side income and Salary keep one record for both (review 2026-11-02, round 5)
        // (the new pay is a line of its own: it does not carry the one-figure mark of the pay it follows)
        if (i >= 0 && ch?.split) { const { oneFigure, ...next } = ch.next; void oneFigure; p.income[i] = ch.old; p.income.splice(i + 1, 0, { id: ui.uid(), ...next }); }
        else if (i >= 0) {
          p.income[i] = { ...p.income[i], ...clean };
          // Side income's careful figure is for uneven pay that repeats: a line changed to another kind or to one time drops it
          if (clean.type !== "business" || clean.period === "once") delete p.income[i].countOn;
        }
      } else { p.income.push({ id: ui.uid(), ...clean }); if (unmark) unmarkOnAdd(p, p.income.at(-1)); }
    });
  };
  const drawForm = () => {
    formHost.innerHTML = ""; ask.replaceChildren();
    if (!showForm && !editing) {
      formHost.append(ui.button("+ Add another income", () => { showForm = true; drawForm(); }, { class: "secondary" }));
      return;
    }
    const values = editing ? { ...editing, taxable: editing.taxable !== false } : { type: "salary", period: "monthly", taxable: true, personId: people.find((p) => p.role === "self")?.id ?? "" };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.name}` : "Add an income"),
      ask,
      ui.form(FIELDS(people), values, (v) => {
        const clean = { name: v.name.trim(), type: v.type, personId: v.personId || "", amount: v.amount ?? 0, period: v.period, growth: v.growth ?? 0, startDate: v.startDate || "", endDate: v.endDate || "", taxable: !!v.taxable };
        if (!clean.name) return;
        // pay of more than $40,000 a month not typed as yearly is usually a yearly figure under the default "Every month":
        // ask once, with both answers one tap away, before saving it
        const odd = looksYearly(clean);
        if (odd) {
          ask.replaceChildren(ui.notice("warn", `That's ${fmt.money(odd.yearly, cur)} a year. Did you mean ${fmt.money(odd.asIf, cur)} a year?`),
            ui.row(ui.button(`Yes, ${fmt.money(odd.asIf, cur)} a year`, () => save({ ...clean, period: "annual" })),
              ui.button(`Keep ${fmt.money(clean.amount, cur)} ${periodLabel(clean.period).toLowerCase()}`, () => save(clean), { class: "secondary" })));
          ask.style.marginBottom = "16px";
          ask.scrollIntoView({ behavior: "smooth", block: "center" });
          return false;   // keep the form as typed behind the question
        }
        save(clean);
      }, { submitLabel: editing ? "Save changes" : "Add income", resetAfter: !editing, onCancel: (editing || d.count > 0) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
        if (!ui.confirm(`Remove ${editing.name}?`)) return;
        const id = editing.id; const name = editing.name; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.income = (p.income ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  if (d.count > 0) {
    const sub = (x) => {
      // a salary typed as a yearly figure is paid in paychecks: say how often (set on Paycheck), not "once a year"
      const rh = payRhythm(x, plan);
      const bits = [rh ? `${fmt.money(x.amount, cur)} ${x.period === "annual" ? "a year" : "every three months"}, ${rh.words}` : `${fmt.money(x.amount, cur)} ${x.periodLabel.toLowerCase()}`, x.personName];
      if (Number(x.growth) > 0) bits.push(`+${fmt.pct(x.growth, 1)} a year`);
      if (x.upcoming) bits.push(`starts ${fmt.date(x.startDate)}`);
      if (x.ended) bits.push(`ended ${fmt.date(x.endDate)}`);
      else if (x.endDate) bits.push(`until ${fmt.date(x.endDate)}`);
      if (x.taxable === false) bits.push("not taxed");
      // Side income's careful figure: spending plans with it, tax keeps the amount above
      if (x.heldMonthly > 0.5) bits.push(`the plan counts on ${fmt.money(x.monthly - x.heldMonthly, cur)} a month (Side income)`);
      return bits.join(" · ");
    };
    // rent: what is left once the place's running costs are paid (Rental analysis), or "before its costs" (round 8 batch 6)
    const rents = rentAfterCostsOf(plan, { today });
    const listNames = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
    const rentNote = (x) => {
      const r = rents.get(x.id);
      if (!r) return null;
      const link = ui.h("a", { href: "#/property/rental", onClick: (e) => e.stopPropagation() }, "Rental analysis");
      // one answer to "what does it bring in": after its running costs, then after its loan payment too (review 2026-11-06, UX 5),
      // and the rent Rental analysis works from when it is not this line's (money 10)
      if (r.afterCosts !== null) return ui.h("div", { class: "d" }, `${fmt.money(r.afterCosts, cur)} a month after ${listNames(r.rentals)}'s running costs (`, link, `)`,
        r.loanMonthly !== null ? `; ${r.afterLoan < -0.5 ? `${fmt.money(-r.afterLoan, cur)} short` : fmt.money(r.afterLoan, cur)} after its ${fmt.money(r.loanMonthly, cur)} loan payment too (the loan is on ${r.loanInDebts ? "Debts" : "Rental analysis"})` : "",
        r.beforeCosts > 0.5 ? `; ${fmt.money(r.beforeCosts, cur)} of it is for a place not there, before its costs` : "",
        r.rentalRent !== null ? `. Rental analysis has the rent at ${fmt.money(r.rentalRent, cur)} a month: change one so they match` : "", ".");
      return ui.h("div", { class: "d" }, "Before the place's running costs (tax, insurance, upkeep): add it on ", link, " to count them.");
    };
    const rows = [...d.items].sort((a, b) => Number(b.active) - Number(a.active) || b.monthly - a.monthly);
    // a line that holds its kind as one figure says so ("One figure for your dividends and interest"; gap next-60 #11)
    const kinds = sectionsOf(plan);
    const oneLine = (x) => { const w = rowLine(plan, x, kinds); return w ? ui.h("div", { class: "d" }, w) : null; };
    root.append(ui.card("Income sources",
      ui.h("ul", { class: "page-list" }, rows.map((x) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer", opacity: x.active ? 1 : 0.6 },
        onClick: () => { editing = plan.income.find((y) => y.id === x.id); showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, x.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name, x.active ? null : ui.h("span", { class: "pill" }, x.upcoming ? "not yet" : "ended")), ui.h("div", { class: "d" }, sub(x)), oneLine(x), rentNote(x),
          // our guess (Get started left the amount blank; fixer round 1, ssg-L-6), as Net worth marks a guessed balance
          x.guessed ? ui.h("div", { class: "d" }, "Our guess for now: tap to type what arrives") : null),
        ui.h("span", { class: "st amount" }, !x.active ? ui.h("div", { class: "muted" }, x.upcoming ? "not yet" : "ended") : ui.h("div", {}, x.period === "once" ? fmt.money(x.amount, cur) : fmt.money(x.monthly, cur)), !x.active ? null : ui.h("div", { class: "muted small" }, x.period === "once" ? "one time" : "a month"), ui.h("div", { class: "muted small" }, "Edit \u203a")),
      ))),
      ui.h("p", { class: "muted small" }, "Tap an income to change it."),
      onePart(),
      out, formHost,
    ));
  } else {
    formCard.append(out, formHost);
    root.append(formCard);
  }
  root.append(ui.h("style", {}, ".st.amount { text-align: right; }"));

  // "One figure or item by item" (gap next-60 #11; README): one quiet row under the list, drawn only while a kind of income can
  // be put together into one figure or is kept as one (a kind = one kind of income of one person: Bo's business income,
  // Dividends and interest; never pay from a job: one-figure.js says why). Inside: each such kind with its two chips; One figure asks first, in place, then replaces the lines with one
  // (Undo); Item by item keeps the one line as the first of the list. Nothing here is drawn for a plan with nothing to choose.
  function onePart() {
    const money = (n) => fmt.money(n, cur);
    const all = sectionsOf(plan, { all: true });
    const shown = all.filter((s) => s.count >= 2 || s.mode === "one" || oneTouched.has(s.key));
    const said = oneSaid; oneSaid = null;
    if (!said && !shown.some((s) => s.changes || oneTouched.has(s.key))) return null;
    const act = (s, mutate, words) => {
      oneOpen = true; oneTouched.add(s.key);
      let r = null, total = d.monthly;
      const undo = ui.undoable(store, (dr) => { r = mutate(dr); total = compute(dr, { today }).monthly; });
      if (!r) return;
      oneSaid = { text: words(r, total), r, total, undo };
    };
    const putTogether = (s) => act(s, (dr) => asOne(dr, s.key), (r, total) => doneWords(r, s, money, total));
    const toItems = (s) => act(s, (dr) => itemize(dr, s.key), (r) => itemizeWords(r));
    // One figure asks first, in place; while it asks, its chip is the one lit (review 2026-11-16 P2: the old choice stayed lit and
    // the tap looked lost). "Keep them as they are", or a tap on the other chip, puts the block back as it was. Nothing is written.
    const block = (s) => {
      const host = ui.h("div", { dataset: { kind: s.key }, style: { display: "grid", gap: "8px" } });
      // the chip lit now keeps the focus when the block is drawn again under the finger (the tapped control is replaced)
      const lit = () => { try { host.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true }); } catch { /* old browsers */ } };
      const draw = (asking, focus = false) => {
        const ask = !asking ? null : ui.h("div", { style: { display: "grid", gap: "8px" } }, ui.h("p", {}, askWords(plan, s, money, d.monthly)),
          ui.row(ui.button("Replace with one line", () => putTogether(s), { class: "secondary" }), ui.button("Keep them as they are", () => draw(false, true), { class: "secondary" })));
        const pick = (v) => {
          if (asking) return draw(false, true);      // the other chip while asking: the question goes, nothing changes
          if (v === "items") return toItems(s);
          if (!s.join.length) return putTogether(s);   // one row: only marked, nothing to replace
          draw(true, true);
        };
        host.replaceChildren(...[   // (a native replaceChildren writes a null as the word "null": left out)
          ui.h("p", {}, ui.h("strong", {}, s.name), ` \u00b7 ${sectionLine(s, money)}`),
          s.changes || oneTouched.has(s.key) ? choice(ctx, { id: `one-${s.key}`, label: `${s.name}: one figure or item by item`, value: asking ? "one" : s.mode, onPick: pick,
            presets: [{ value: "one", label: "One figure" }, { value: "items", label: "Item by item" }] }) : null,
          ...s.held.map((h) => ui.h("p", { class: "muted small" }, holdWords(h))),
          ask].filter(Boolean));
        if (focus) lit();
      };
      draw(false);
      return host;
    };
    const note = said ? ui.notice("ok", said.text, said.undo ? { undo: said.undo, undone: (res) => { oneOpen = true; oneSaid = { text: ui.undoneWords(res, undoneWords(said.r, money, said.total)) }; } } : {}) : null;
    return ui.h("div", { class: "folds", style: { marginTop: "8px" } }, part(ctx, { id: "asOne", kind: "own", title: PART_TITLE, says: statusWords(shown),
      open: !!said || oneOpen, body: [note, ui.h("p", {}, INTRO), ...shown.map(block)] }));
  }
}
