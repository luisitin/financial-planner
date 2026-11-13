// modules/cashflow/recurring/view.js -- DOM only. Simple first (docs/OPTIONAL.md; class C in the simple-first spec):
// what goes out a month in regular bills, one sentence for the case, what changed (a bill went up, a new regular charge,
// one that looks missed: never folded), the six biggest bills. One tap away: the rest of the bills ("N more bills"),
// every found bill with "Add to Expenses" and "Not a bill" ("See or change each bill"), how it is worked out, and the
// payees you hid. The deeper pages are in "More on this".
import { compute, billFrom, addBill } from "./compute.js";
import { CATEGORIES, ROW_HOLDS } from "../expenses/compute.js";
import { isGuess } from "../../../core/estimate/index.js";
import { part, parts, rest, links } from "../../../core/ui/more.js";

// what a tap did, said on the next draw where it was done: { text, undo?, undone?, key?, at: "changes" | "each" | "hidden" }
let pending = null;
// this visit's Add and Use, by bill key: each keeps its Undo where its bill is once the green line has moved on to a later
// tap (the critic of gap #6, F3: Use, then Add, lost the Use's Undo). { route, by: Map(key -> { kind: "add" | "use", undo,
// undone, ask }) }. A visit is one route object (the shell's redraw after a save keeps it); another arrival forgets them.
const visit = { route: null, by: new Map() };

/** "a month" after an amount, for each way a bill comes (the sentences of the What changed card). */
export const PER = Object.freeze({ weekly: "a week", biweekly: "every two weeks", semimonthly: "twice a month", monthly: "a month", quarterly: "every three months", annual: "a year" });
const ymd = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "")); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null; };
/** "October", or "October 2025" in another year than today's. */
export const monthWord = (iso, today) => { const t = ymd(iso); if (!t) return String(iso ?? ""); const w = t.toLocaleDateString("en-US", { month: "long" }); return String(iso).slice(0, 4) === String(today ?? "").slice(0, 4) ? w : `${w} ${t.getFullYear()}`; };
/** "October 3", or "October 3, 2025" in another year than today's. */
export const dayWord = (iso, today) => { const t = ymd(iso); if (!t) return String(iso ?? ""); return t.toLocaleDateString("en-US", String(iso).slice(0, 4) === String(today ?? "").slice(0, 4) ? { month: "long", day: "numeric" } : { month: "long", day: "numeric", year: "numeric" }); };

/**
 * The sentence of each case under the headline (one written sentence per case; module.test.mjs reads each):
 *   empty      nothing typed on Expenses and no bank file
 *   typed      bills typed on Expenses, no bank file
 *   found      bank files with regular bills going out (one, or several; with money coming in or not)
 *   none       bank files, no regular bill found yet (with typed bills to show meanwhile, or not)
 */
export function sentenceOf(d, { money, typedBills = 0 } = {}) {
  const out = d.detected.filter((r) => r.amount < 0).length;
  if (!d.total && !typedBills) return "Once transactions are on file, this page finds the payments that come back every week, month or year, says when the next one is due and warns when one looks missed.";
  if (!d.total) return "These are the bills you typed on Expenses. Import a bank file and this page also finds the ones you forgot, and says when each is due.";
  if (!out) return typedBills
    ? "It takes two or three charges from the same payee to be sure. Meanwhile the bills you typed on Expenses are listed below."
    : "It takes two or three charges from the same payee to be sure. Import more months of your bank file, or type your bills on Expenses.";
  if (out === 1) return d.monthlyIn > 0 ? `Your bank files show one bill that comes back, and ${money(d.monthlyIn)} a month coming in.` : "Your bank files show one bill that comes back.";
  return d.monthlyIn > 0 ? `Your bank files show ${out} bills that come back, and ${money(d.monthlyIn)} a month coming in.` : `Your bank files show ${out} bills that come back.`;
}

/**
 * The sentence of each line of What changed (one per case; module.test.mjs reads each):
 *   up      "Netflix went up from $15.49 to $17.99 in October."
 *   new     "New: Gym Co, $39 a month since October 3. A new bill?"
 *   missed  "Gym Membership looks missed: it was expected August 20."
 */
export function changeSentence(c, { amount, today }) {
  if (c.kind === "up") return `${c.payee} went up from ${amount(c.from)} to ${amount(c.to)} in ${monthWord(c.at, today)}.`;
  if (c.kind === "new") return `New: ${c.payee}, ${amount(c.amount)} ${PER[c.cadence] ?? "a month"} since ${dayWord(c.at, today)}. A new bill?`;
  return `${c.payee} looks missed: it was expected ${dayWord(c.at, today)}.`;
}

/**
 * The green line after "Add to Expenses" (one written sentence per case; module.test.mjs reads each): what was added, how
 * much, how often and under which kind; and, when Expenses already has bills of that kind typed by hand, which one to lower
 * if it already counted this bill (a typed "Streaming $48" holds Netflix).
 */
export function addedWords(payee, row, cadence, kindRows, { amount, kindLabel }) {
  const said = `Added ${payee} to Expenses: ${amount(row.amount)} ${PER[cadence] ?? "a month"}, under ${kindLabel}.`;
  if (!kindRows.length) return `${said} Change it there any time.`;
  // a typed name is quoted: "Electric, water, gas" is one row, not three
  if (kindRows.length === 1) return `${said} If "${kindRows[0]}" already counted it, lower it on Expenses.`;
  if (kindRows.length === 2) return `${said} If "${kindRows[0]}" or "${kindRows[1]}" already counted it, lower that one on Expenses.`;
  return `${said} If another bill under ${kindLabel} already counted it, lower that one on Expenses.`;
}

// a payee hidden or put back: asked first, then said; nothing in the plan is removed, only hidden (plan.recurringIgnored)
export function hideRow(ctx, r, say, { what = "bill" } = {}) {
  const name = r.payee ?? r.name;
  if (!ctx.ui.confirm(`Take ${name} off the list? It is hidden on Bills and regular payments and on Subscriptions. Your transactions stay as they are, and you can put it back at the bottom of either page.`)) return;
  say(`${name} taken off this list (and off ${what === "bill" ? "Subscriptions" : "Bills and regular payments"}). Put it back under "Payees you hid" at the bottom.`);
  ctx.store.update((p) => { p.recurringIgnored = [...new Set([...(p.recurringIgnored ?? []), r.key])]; });
}
/** The payees hidden with "Not a bill" or "Not a subscription", as one part ("Payees you hid") for parts(): each with
 * "Put back". Null when none is hidden. Shared with Subscriptions. */
export function hiddenPart(ctx, hidden, onSaid, { open = false, said = null } = {}) {
  const { ui, store } = ctx;
  if (!hidden.length) return null;
  return { id: "hidden", kind: "item", title: "Payees you hid", says: `${hidden.length} payee${hidden.length === 1 ? "" : "s"}`, open,
    body: () => [said,
      ui.h("p", { class: "muted small" }, "Payees you said are not bills or subscriptions. They are left out of both pages and of their totals; your bank lines stay as they are. Put one back and it is counted again on both pages."),
      ui.h("ul", { class: "page-list" }, hidden.map((h) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, h.payee)),
        ui.h("span", { class: "st" }, ui.button("Put back", () => { onSaid(`${h.payee} is back on the list.`); store.update((p) => { p.recurringIgnored = (p.recurringIgnored ?? []).filter((k) => k !== h.key); }); }, { class: "secondary small", "aria-label": `Put ${h.payee} back` })))))] };
}
/** The same part as a folded card of its own (pages with no parts card). */
export function hiddenCard(ctx, hidden, onSaid, opts = {}) {
  const o = hiddenPart(ctx, hidden, onSaid, opts);
  return o ? part(ctx, { ...o, card: true }) : null;
}

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const today = fmt.today();
  const d = compute(plan, { today });
  const whole = (n) => fmt.money(n, cur);
  // bank amounts keep their cents (design log 2026-09-16); a whole-dollar charge reads "$39", not "$39.00"
  const amount = (n) => { const a = Math.abs(Number(n) || 0); return fmt.money(a, cur, undefined, Math.round(a * 100) % 100 ? 2 : 0); };
  const signed = (n) => (n < 0 ? "-" : "+") + amount(n);

  const out = d.detected.filter((r) => r.amount < 0).sort((a, b) => b.monthly - a.monthly);
  const income = d.detected.filter((r) => r.amount > 0).sort((a, b) => b.monthly - a.monthly);
  const typed = d.planned.filter((x) => x.kind === "expense" && x.state === "active").sort((a, b) => b.monthly - a.monthly);
  const typedIncome = d.planned.filter((x) => x.kind === "income" && x.state === "active");
  const notCounted = d.planned.filter((x) => x.state !== "active");
  const typedMonthly = typed.reduce((s, x) => s + x.monthly, 0);
  const held = new Map(d.inPlan.map((x) => [x.key, x]));
  const rises = new Map(d.changes.filter((c) => c.kind === "up").map((c) => [c.key, c]));
  if (visit.route !== ctx.route) { visit.route = ctx.route; visit.by.clear(); }

  const said = pending; pending = null;
  const okLine = said ? ui.notice("ok", said.text, said.undo ? { undo: said.undo, undone: (r) => { visit.by.delete(said.key); pending = { text: ui.undoneWords(r, said.undone), at: said.at }; } } : {}) : null;
  const say = (at) => (text) => { pending = { text, at }; };

  // ---------------------------------------------------------------- the answer
  if (!d.total && !typed.length) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Bills and regular payments"),
      ui.h("p", { class: "lede" }, sentenceOf(d, { money: whole })),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Or type your bills on Expenses"))));
    if (okLine) root.append(okLine);
    return;
  }
  const bank = d.total > 0;
  const shown = bank && out.length;   // the list is the bills found in the bank files; else the bills typed on Expenses
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, shown ? `${whole(d.monthlyOut)} a month in regular bills and payments` : bank ? "No regular bills found yet" : `${whole(typedMonthly)} a month in regular bills and payments`),
    ui.h("p", { class: "lede" }, sentenceOf(d, { money: whole, typedBills: typed.length })),
    // the one filled button: bring in a bank file, while there is none (or nothing was found and nothing typed)
    !bank || (!out.length && !typed.length) ? ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file")) : null));

  // where the green line goes: in the card or part the tap was in, if it is still drawn; else right under the answer
  const lines = bank ? [...d.missed.map((r) => ({ kind: "missed", key: r.key, payee: r.payee, at: r.next, r })), ...d.changes] : [];
  const each = bank && (out.length > 0 || income.length > 0);
  const hiddenOn = d.hidden.length > 0;
  const at = said?.at;
  const placed = (at === "changes" && lines.length) || (at === "each" && each) || (at === "hidden" && hiddenOn);
  if (okLine && !placed) root.append(okLine);

  // ---------------------------------------------------------------- the taps
  const byKey = new Map(d.detected.map((r) => [r.key, r]));
  const labelOf = (c) => CATEGORIES[c]?.label ?? CATEGORIES.other.label;
  // the bills typed on Expenses under one kind (before this tap): a found bill of that kind may already be inside one
  // (a row of Get started's holds more kinds: "Eating out and fun" holds the streaming; a row that is still our guess takes
  // a bill typed under one of its kinds off by itself, overview/guesses, so it is not named)
  const holds = (x, c) => (CATEGORIES[x.category] ? x.category : "other") === c || (String(x.id).startsWith("setup-x-") && (ROW_HOLDS[x.category] ?? []).includes(c));
  const kindNames = (c) => typed.filter((x) => holds(x, c) && !isGuess(plan, `expenses[${x.id}].amount`)).map((x) => x.name);
  const addButton = (r, where) => ui.button("Add to Expenses", () => {
    const rise = rises.get(r.key) ?? null;
    const row = billFrom(r, rise);
    const undo = ui.undoable(store, (draft) => { addBill(draft, r, ui.uid(), rise); });
    const undone = `${r.payee} is off Expenses again.`;
    if (undo) visit.by.set(r.key, { kind: "add", undo, undone, ask: `take ${r.payee} off Expenses` });
    pending = { text: addedWords(r.payee, row, r.cadence, kindNames(row.category), { amount, kindLabel: labelOf(row.category) }), undo, undone, key: r.key, at: where };
  }, { class: "secondary small", "aria-label": `Add ${r.payee} to Expenses` });
  // asks first, naming the payee, and says what it did (F3: one tap hid it from two pages with no word, and two quick taps hid two)
  const notBill = (r, where, label = "Not a bill") => ui.button(label, () => hideRow(ctx, r, say(where), { what: "bill" }), { class: "secondary small", "aria-label": `${r.payee} is not a bill` });
  // the amount a row on Expenses says now (the went-up line names it: within 50 cents of the old or the new price)
  const rowAmount = (id) => Number((plan.expenses ?? []).find((x) => x.id === id)?.amount) || 0;
  // "Use $17.99 on Expenses": the new price on the row, and the row is tied to the bill by its key from then on (the tap
  // said this row is that bill), so a later rename or price leaves it known as on Expenses
  const useNew = (c) => {
    const e = (plan.expenses ?? []).find((x) => x.id === c.expenseId);
    if (!e) return null;
    return ui.button(`Use ${amount(c.to)} on Expenses`, () => {
      const undo = ui.undoable(store, (draft) => { const x = (draft.expenses ?? []).find((y) => y.id === c.expenseId); if (x) { x.amount = c.to; if (!x.payeeKey) x.payeeKey = c.key; } });
      const undone = `${e.name} is back to ${amount(e.amount)} on Expenses.`;
      if (undo) visit.by.set(c.key, { kind: "use", undo, undone, ask: `put ${e.name} back to ${amount(e.amount)} on Expenses` });
      pending = { text: `${e.name} on Expenses is now ${amount(c.to)} ${PER[c.cadence] ?? "a month"}.`, undo, undone, key: c.key, at: "changes" };
    }, { class: "secondary small" });
  };
  // an Add or Use of this visit whose green line has moved on: its Undo where its bill is (F3), outlined, once
  const heldUndo = (key, kind, at) => {
    const x = visit.by.get(key);
    if (!x || x.kind !== kind || (said?.undo && said.key === key)) return null;
    return ui.button("Undo", () => { visit.by.delete(key); const r = x.undo(); pending = { text: ui.undoneWords(r, x.undone), at }; }, { class: "secondary small", "aria-label": `Undo: ${x.ask}` });
  };

  // ---------------------------------------------------------------- what changed: never folded (the first three, and every missed one)
  if (lines.length) {
    const dot = () => ui.h("span", { style: { display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: "var(--warn)" } });
    const lineRow = (c) => {
      const r = byKey.get(c.key);
      const acts = c.kind === "new" ? [addButton(r, "changes"), notBill(r, "changes")] : c.kind === "missed" ? [notBill(c.r, "changes")] : c.expenseId ? [useNew(c)] : c.updatedId ? [heldUndo(c.key, "use", "changes")] : [];
      // a rise says what Expenses has for it: still the old price (with one tap to the new), or the new one already (done: F4)
      const more = c.kind === "missed" ? "Paid another way, canceled, or not in your bank file yet?" : c.kind === "up" && c.expenseId ? `Expenses still says ${amount(rowAmount(c.expenseId))} for it.`
        : c.kind === "up" && c.updatedId ? `Expenses already says ${amount(rowAmount(c.updatedId))} for it.` : null;
      return ui.h("li", {},
        ui.h("span", { class: "ic", style: { background: "transparent" }, "aria-hidden": "true" }, dot()),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t", style: { fontWeight: "500" } }, changeSentence(c, { amount, today })),
          more ? ui.h("div", { class: "d" }, more) : null,
          acts.filter(Boolean).length ? ui.h("div", { class: "row", style: { gap: "8px", marginTop: "8px" } }, acts.filter(Boolean)) : null));
    };
    const card = ui.card("What changed", at === "changes" ? okLine : null,
      ...rest(ctx, { id: "changes", items: lines, row: lineRow, first: 3, noun: "changes", one: "change", keep: (c) => c.kind === "missed", list: "page-list" }));
    // a bill went up: asking for a lower price is worth a call (a hint worth money: never folded)
    if (rises.size) card.append(ui.row(ui.h("a", { class: "btn secondary small", href: "#/cashflow/subscriptions?show=lower", dataset: { worth: "" } }, "How to ask for a lower price")));
    root.append(card);
  }

  // ---------------------------------------------------------------- the six biggest bills, then "N more bills"
  const when = (iso) => { const n = iso ? Math.round((ymd(iso) - ymd(today)) / 864e5) : null; return n === null ? "" : n === 0 ? "due today" : n === 1 ? "due tomorrow" : n > 1 && n <= 14 ? `due in ${n} days` : `next ${dayWord(iso, today)}`; };
  const foundRow = (r) => ui.h("li", {},
    ui.h("span", { class: "ic" }, r.icon ?? "🔁"),
    // a bill that went up says its new price beside the usual one the total counts (the walk: "$180 a month" under "went up to $196")
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, r.payee), ui.h("div", { class: "d" }, [r.cadence === "monthly" ? r.cadenceLabel : `${amount(r.amount)} ${r.cadenceLabel}`, rises.has(r.key) ? `now ${amount(rises.get(r.key).to)}` : null, r.missed ? "looks missed" : when(r.next)].filter(Boolean).join(" · "))),
    ui.h("span", { class: "st amount" }, ui.h("div", {}, amount(r.monthly)), ui.h("div", { class: "muted small" }, "a month")));
  // each typed row opens where it is changed: its own form on Expenses, with a way back here
  const typedRow = (x) => ui.h("li", { role: "link", tabindex: "0", style: { cursor: "pointer" },
    onClick: () => ctx.go("cashflow", "expenses", [], { edit: x.id, back: "cashflow/recurring" }),
    onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
    ui.h("span", { class: "ic" }, "🧾"),
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name), ui.h("div", { class: "d" }, x.period === "monthly" ? x.periodLabel.toLowerCase() : `${whole(-x.amount)} ${x.periodLabel.toLowerCase()}`)),
    ui.h("span", { class: "st amount" }, ui.h("div", {}, whole(x.monthly)), ui.h("div", { class: "muted small" }, "a month"), ui.h("div", { class: "muted small" }, "Edit ›")));
  const notCountedLine = () => notCounted.length ? ui.h("p", { class: "muted small" }, `Not counted: ${notCounted.map((x) => `${x.name} (${x.state === "ended" ? `ended ${dayWord(x.endDate, today)}` : `starts ${dayWord(x.startDate, today)}`})`).join(", ")}.`) : null;
  if (shown) root.append(ui.card("Biggest first", ...rest(ctx, { id: "bills", items: out, row: foundRow, noun: "bills", one: "bill", list: "page-list" })));
  else if (typed.length) root.append(ui.card(bank ? "The bills you typed" : "Biggest first", ...rest(ctx, { id: "bills", items: typed, row: typedRow, noun: "bills", one: "bill", list: "page-list" }),
    notCountedLine(),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Change these on Expenses"))));

  // ---------------------------------------------------------------- one tap away
  const accountName = (id) => (plan.accounts ?? []).find((a) => a.id === id)?.name ?? "a loan";
  const expenseName = (id) => (plan.expenses ?? []).find((e) => e.id === id)?.name ?? "a bill";
  const editHref = (id) => `#/cashflow/expenses?edit=${encodeURIComponent(id)}&back=cashflow/recurring`;
  const heldWords = (r) => {
    const h = held.get(r.key);
    if (!h) { const k = kindNames(billFrom(r).category); return ui.h("span", {}, !k.length ? "Not on Expenses yet" : k.length === 1 ? `Maybe part of "${k[0]}" on Expenses` : `Maybe counted under ${labelOf(billFrom(r).category)} on Expenses`); }
    if (h.how === "debt") return ui.h("span", {}, `Paid on Debts: ${accountName((plan.debts ?? []).find((x) => x.id === h.debtId)?.accountId)}`);
    return ui.h("a", { href: editHref(h.expenseId), style: { display: "inline-flex", alignItems: "center", minHeight: "44px" } }, h.how === "amount" ? `Looks like ${expenseName(h.expenseId)} on Expenses ›` : `On Expenses as ${expenseName(h.expenseId)} ›`);
  };
  const eachRow = (r) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.payee), ui.h("span", { class: "rec-value" }, signed(r.amount))),
    ui.h("div", { class: "rec-sub" }, [r.cadenceLabel, rises.has(r.key) ? `now ${amount(rises.get(r.key).to)}` : null, `last ${dayWord(r.last, today)}`, `${r.count} times so far`, r.category ? r.categoryLabel : null].filter(Boolean).join(" · ")),
    ui.h("div", { class: "rec-foot" }, r.amount < 0 ? heldWords(r) : ui.h("span", {}, "Money coming in"),
      ui.h("div", { class: "rec-actions" }, r.amount < 0 && !held.has(r.key) ? addButton(r, "each") : r.amount < 0 && held.get(r.key)?.how === "added" ? heldUndo(r.key, "add", "each") : null,
        notBill(r, "each", r.amount < 0 ? "Not a bill" : "Not regular"))));
  const notIn = out.filter((r) => !held.has(r.key)).length;
  const eachPart = each ? { id: "each", kind: "own", title: "See or change each bill", says: notIn ? `${notIn} not on Expenses` : `${out.length + income.length} found`, open: at === "each",
    body: () => [at === "each" ? okLine : null,
      ui.h("p", { class: "muted small" }, "Every regular payment in your bank files. Add a bill to Expenses so the plan counts it, or take off one that only looks regular."),
      ui.h("ul", { class: "records" }, [...out, ...income].map(eachRow)),
      typed.length ? ui.h("h3", {}, "Typed on Expenses") : null,
      typed.length ? ui.h("ul", { class: "page-list" }, typed.map(typedRow)) : null,
      notCountedLine(),
      typedIncome.length ? ui.h("h3", {}, "Typed on Income") : null,
      typedIncome.length ? ui.h("ul", { class: "page-list" }, typedIncome.map((x) => ui.h("li", {}, ui.h("span", { class: "ic" }, "💵"),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name), ui.h("div", { class: "d" }, `${whole(x.amount)} ${x.periodLabel.toLowerCase()}`)),
        ui.h("span", { class: "st amount" }, ui.h("div", {}, whole(x.monthly)), ui.h("div", { class: "muted small" }, "a month"))))) : null,
      ui.row(typed.length ? ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Change these on Expenses") : null,
        typedIncome.length ? ui.h("a", { class: "btn secondary", href: "#/cashflow/income" }, "Change what comes in") : null)] } : null;

  const howPart = { id: "how", kind: "how", body: () => (bank ? [
    ui.h("p", {}, `Going out: ${whole(d.monthlyOut)} a month from ${out.length} bill${out.length === 1 ? "" : "s"}. Each bill's usual charge (the middle one of its charges) is made into a month: every week times 52 and divided by 12, every two weeks times 26 and divided by 12, twice a month times 2, every three months divided by 3, once a year divided by 12.`),
    income.length ? ui.h("p", {}, `Coming in: ${whole(d.monthlyIn)} a month, worked out the same way: ${income.map((r) => `${r.payee}, ${amount(r.amount)} ${r.cadenceLabel}`).join("; ")}.`) : null,
    ui.h("p", {}, "A regular payment is the same payee in the same account at least three times (twice when the amount is the same and it comes every month or less often), with steady gaps: every week is 5 to 9 days apart, every two weeks 12 to 16, twice a month 13 to 17, every month 26 to 35, every three months 80 to 100, once a year 340 to 390. Transfers between your accounts are left out, and so are shops whose amounts change a lot."),
    ui.h("p", {}, "Went up: the newest charge is at least $1 and at least 5% more than the middle of the three before it, and those three were steady (a power bill that moves with the season is not called a rise). The line stays until the new price is the usual one."),
    ui.h("p", {}, "New: the first charge was in the last 70 days, your bank file goes back far enough to have shown an earlier one, and the bill is not on Expenses or Debts yet. Looks missed: the next charge is more than 5 days late."),
    ui.h("p", {}, "On Expenses: a bill you added from here, a bill on Expenses with a word of the same name, a loan payment on Debts, or a bill on Expenses of the same kind that costs the same a month (within $1 or 5%)."),
    d.hidden.length ? ui.h("p", { class: "muted small" }, `Not counted: ${d.hidden.length} payee${d.hidden.length === 1 ? "" : "s"} you hid.`) : null,
  ] : [
    ui.h("p", {}, `${whole(typedMonthly)} a month: each bill you typed on Expenses, made into a month (its amount times how many times it comes in a year, divided by 12). One-time costs are left out, and so are bills that ended or have not started.`),
    typedIncome.length ? ui.h("p", {}, `Coming in, typed on Income: ${typedIncome.map((x) => `${x.name}, ${whole(x.amount)} ${x.periodLabel.toLowerCase()}`).join("; ")}.`) : null,
    typedIncome.length ? ui.row(ui.h("a", { class: "btn secondary", href: "#/cashflow/income" }, "Change what comes in")) : null,
    ui.h("p", {}, "Import a bank file and this page also finds the payments you did not type, says when each is due, and tells you when one goes up, a new one starts or one looks missed."),
  ]) };
  const hidden = hiddenPart(ctx, d.hidden, say("hidden"), { open: at === "hidden", said: at === "hidden" ? okLine : null });
  const more = parts(ctx, eachPart, howPart, hidden);
  if (more) root.append(more);

  // ---------------------------------------------------------------- the deeper pages, as questions
  let subs = null;
  try { subs = ctx.computeOf?.("cashflow/subscriptions") ?? null; } catch { subs = null; }
  const deeper = links(ctx, [
    { href: "#/cashflow/subscriptions", ask: "What renews by itself, and what does it cost a year?", says: subs?.hasData ? `${whole(subs.yearly)} a year` : undefined },
    { href: "#/cashflow/forecast", ask: "Will my checking account run low before payday?" },
    { href: "#/cashflow/expenses", ask: "What do I spend each month?" },
  ]);
  if (deeper) root.append(deeper);
}
