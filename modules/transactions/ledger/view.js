// modules/transactions/ledger/view.js -- DOM only. Filters on top, totals, the list (tap a row
// to edit), "show more", and one form for adding or editing a transaction by hand.
import { compute, txKey, theCard, signedAmount, directionOf, monthLabel } from "./compute.js";
import { categoriesOf } from "../categories/compute.js";

// filter state survives the re-render the shell does after every save
const state = { month: "", accountId: "", category: "", q: "", dir: "", limit: 100 };
// a new line to open on arrival (the Monthly review's "Add Chase checking's lines by hand": ?add=<first missing day>)
let addOn = null;
// the confirmation shown on the next render (the shell re-renders after store.update): "Added Corner cafe: $6.25 out."
let pending = null;
// arrived from a link that set the filters (a category on Where the money goes, an account, a month): bring the list up once
let toList = false;
// when the last add, save or delete happened: a second tap within 700 ms lands on whatever moved under the thumb (the
// list slides up as the form closes) and must not open another row (stress-test attack, 2026-11-11)
let committedAt = 0;
let ledgerForm = null;   // the open add/edit form, for its error line
const STYLE = `.lg-show > summary .fold-status { white-space: normal; text-align: right; min-width: 0; }`;

const FIELDS = (plan) => [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "payee", label: "Who or what", type: "text", required: true, placeholder: "e.g. Kroger" },
  // which way, never a sign: an iPhone's number pad has no minus key (stress test T3, 2026-11-11)
  { key: "dir", label: "Which way", type: "select", options: [{ value: "out", label: "Money out (I paid)" }, { value: "in", label: "Money in (I received)" }] },
  // no minimum on the box: an imported $0.00 card check must still save, and a typed or pasted minus means money out
  // (signedAmount); a new line of $0 is refused in the submit instead (review N1, N2, 2026-11-11)
  { key: "amount", label: "Amount", type: "money", required: true, placeholder: "e.g. 45.20", help: "Just the amount; the choice above says which way." },
  { key: "accountId", label: "Account", type: "select", options: (plan.accounts ?? []).map((a) => ({ value: a.id, label: a.name })) },
  { key: "category", label: "Category", type: "select", options: [{ value: "", label: "Uncategorized" }, ...categoriesOf(plan).map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))] },
  { key: "note", label: "Note", type: "text" },
  { key: "tagsText", label: "Tags", type: "text", placeholder: "comma separated, e.g. vacation, kids" },
];

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  // deep links set the filters once, then the address goes back to the bare page so the
  // filters the person picks afterwards are not overridden on the next render
  const rest = ctx.route.rest ?? [];
  const query = ctx.route.query ?? {};
  if (rest.length) {
    // a link shows what it names and nothing left over from an earlier visit
    Object.assign(state, { month: "", accountId: "", category: "", q: "", dir: "", limit: 100 });
    if (rest[0] === "uncategorised") { state.category = "none"; }
    if (rest[0] === "month" && rest[1]) { state.month = rest[1]; }
    // a category with it (?category=groceries, or none for the unfiled lines): "Groceries in Sep 2026", not the whole month
    if (query.category && rest[0] !== "uncategorised") state.category = query.category;
    // ?dir=out: only money out, as a spending page counts it (review N3, 2026-11-11)
    if (query.dir === "out" || query.dir === "in") state.dir = query.dir;
    toList = !addOn;
    if (rest[0] === "account" && rest[1]) {
      state.accountId = rest[1];
      // opened to add the days an account's files miss: that month, and a new line dated the first missing day (re-check 4)
      if (/^\d{4}-\d{2}$/.test(query.month ?? "")) state.month = query.month;
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.add ?? "")) addOn = { date: query.add, accountId: rest[1] };
    }
    if (addOn) toList = false;
    // the way back to the check-in (from=review) stays in the address (re-check 4, 2026-11-02). The address is replaced, not
    // added to: one Back returns to the page the link was on (stress test p-cashflow-b-goals/F1, 2026-11-11)
    location.replace(hrefOf(ledgerQuery(query)));
    return;
  }
  let d = compute(plan, { ...state, today: fmt.today() });
  const hasAccounts = (plan.accounts ?? []).length > 0;
  let editing = addOn ? { date: addOn.date, accountId: addOn.accountId, category: "", amount: null } : null;
  addOn = null;
  root.append(ui.h("style", {}, STYLE));
  const totalsHost = ui.h("div");
  let refreshTop = () => {};

  if (d.total === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Your transactions"),
      hasAccounts
        ? ui.h("p", { class: "lede" }, "Nothing here yet. The quickest way in is a file from your bank: download the last three months as CSV and bring it to the Import page. You can also add a transaction by hand below.")
        : ui.h("p", { class: "lede" }, "Nothing here yet. First add your checking account or card: every transaction belongs to one, and the app needs to know which account a bank file is from."),
      // with no account the first step is the filled button (stress test T2, 2026-11-11)
      hasAccounts
        ? ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"))
        : ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add your checking account or card"), ui.h("a", { class: "btn secondary", href: "#/transactions/import" }, "Import a bank file")),
    ));
  } else {
    // a month a link set that has no lines yet still shows in the box ("Oct 2026 (0)")
    const monthOpts = d.months.some((m) => m.ym === state.month) || !state.month ? d.months : [{ ym: state.month, label: monthLabel(state.month), count: 0 }, ...d.months];
    const monthSel = ui.select([{ value: "", label: "All months" }, ...monthOpts.map((m) => ({ value: m.ym, label: `${m.label} (${m.count})` }))], state.month, { "aria-label": "Month", onChange: (e) => { state.month = e.target.value; redraw(); } });
    const acctSel = ui.select([{ value: "", label: "All accounts" }, ...d.accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.count})` }))], state.accountId, { "aria-label": "Account", onChange: (e) => { state.accountId = e.target.value; redraw(); } });
    const catSel = ui.select([{ value: "", label: "All categories" }, { value: "none", label: `Uncategorized (${d.uncategorisedAll})` }, ...categoriesOf(plan).map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))], state.category, { "aria-label": "Category", onChange: (e) => { state.category = e.target.value; redraw(); } });
    // typing in Search refreshes only the totals and the list under the box: the box itself is never rebuilt, so the
    // cursor and the phone's keyboard stay put however slowly the word is typed (stress test x-search, 2026-11-11)
    const search = ui.h("input", { type: "search", placeholder: "Search payee or note", value: state.q, "aria-label": "Search", enterkeyhint: "search", onInput: (e) => { state.q = e.target.value; clearTimeout(search._t); search._t = setTimeout(refresh, 250); },
      onKeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(search._t); refresh(); } } });
    // Totals first; the four filters fold behind one row that says what is showing
    // (design log 2026-09-15).
    const totals = () => ui.card(null, ui.row(
      ui.stat("Money in", fmt.money(d.in, cur), state.month ? "this month" : "all time"),
      ui.stat("Money out", fmt.money(d.out, cur), `transfers between your accounts not counted${d.cardsOut >= 1 ? `; ${fmt.money(d.cardsOut, cur)} of it went to ${d.cardsOutNames?.length === 1 ? `${theCard(d.cardsOutNames[0])}, whose file isn't in` : "cards whose files aren't in"}` : ""}`),
      ui.stat(d.net >= 0 ? "Kept" : "Short", fmt.money(Math.abs(d.net), cur), `${d.matched} transaction${d.matched === 1 ? "" : "s"}${d.uncategorised ? `, ${d.uncategorised} uncategorized` : ""}`),
    ));
    totalsHost.append(totals());
    root.append(totalsHost);
    const showingText = () => [
      state.month ? (d.months.find((m) => m.ym === state.month)?.label ?? monthLabel(state.month)) : "all months",
      state.accountId ? (d.accounts.find((a) => a.id === state.accountId)?.name ?? "one account") : "all accounts",
      state.category === "none" ? "uncategorized" : state.category ? (categoriesOf(plan).find((c) => c.id === state.category)?.label ?? "one category") : "all categories",
      state.q ? `“${state.q}”` : null,
      state.dir === "out" ? "money out only" : state.dir === "in" ? "money in only" : null,
    ].filter(Boolean).join(" · ");
    const status = ui.h("span", { class: "fold-status" }, showingText());
    refreshTop = () => { totalsHost.replaceChildren(totals()); status.textContent = showingText(); };
    const filtered = !!(state.month || state.accountId || state.category || state.q || state.dir);
    root.append(ui.h("details", { class: "card fold fold-card lg-show", open: filtered ? true : null },
      ui.h("summary", {}, ui.h("h2", {}, "Showing"), status, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("div", { class: "form" }, ui.field("Month", monthSel), ui.field("Account", acctSel), ui.field("Category", catSel), ui.field("Search", search)))));
    // money out only (a spending page's link): say so, with the way to see both; unfiled lines with money in among them:
    // say how many, since the spending pages count only the money going out (review N3, 2026-11-11)
    if (state.dir) root.append(ui.notice("info", [ui.h("div", {}, state.dir === "out" ? "Showing money out only." : "Showing money in only."), ui.row(ui.button("Show money in and out", () => { state.dir = ""; redraw(); }, { class: "secondary" }))]));
    // a $0.00 line is neither in nor out, so the count going out is matchedOut, not matched - matchedIn (review of N3)
    else if (state.category === "none" && d.matchedOut < d.matched) root.append(ui.h("p", { class: "muted small" }, `${d.matched} lines, ${d.matchedOut} of them money going out. Where the money goes counts only ${d.matchedOut === 1 ? "that one" : `those ${d.matchedOut}`}.`));
    // the way to Categorise is a full-size button, not a link inside the sentence (44 px to tap)
    if (d.uncategorisedAll && state.category !== "none") root.append(ui.notice("info", [ui.h("div", {}, `${d.uncategorisedAll} transaction${d.uncategorisedAll === 1 ? " has" : "s have"} no category yet.`), ui.row(ui.h("a", { class: "btn secondary", href: "#/transactions/categorize" }, "File them in a few taps"))]));
  }

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!editing) {
      if (pending) { formHost.append(ui.notice("ok", pending)); pending = null; }
      // outlined: the hero's Import is the filled first step; with no account there is nothing to add a line to (T2)
      if (hasAccounts) formHost.append(ui.row(ui.button("Add a transaction by hand", () => { editing = { date: fmt.today(), accountId: (plan.accounts ?? [])[0]?.id ?? "", category: "", amount: null }; drawForm(); }, { class: "secondary" })));
      return;
    }
    const isNew = !editing.id;
    // the box shows the size, the choice above it the way (a new line starts on Money out, the common case)
    const values = { ...editing, dir: isNew && editing.amount === null ? "out" : directionOf(editing.amount), amount: editing.amount === null || editing.amount === undefined ? null : Math.abs(Number(editing.amount)), tagsText: (editing.tags ?? []).join(", ") };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, isNew ? "New transaction" : `Edit: ${editing.payee}`),
      editing.rawPayee && editing.rawPayee !== editing.payee ? ui.h("p", { class: "muted small" }, `The bank wrote: ${editing.rawPayee}`) : null,
      (ledgerForm = ui.form(FIELDS(plan), values, (v) => {
        if (isNew && !(Math.abs(Number(v.amount)) > 0)) {
          // the message goes right above the box, where the eyes are (at the top of the form it was off screen; under the box the
          // phone's keyboard covers it)
          const box = ledgerForm.querySelector("input[name=amount]"), lbl = box?.closest("label");
          ledgerForm.querySelector(".amount-err")?.remove();
          const err = ui.notice("error", "Type how much it was, more than $0.");
          err.classList.add("amount-err");
          if (lbl) lbl.before(err); else ledgerForm.prepend(err);
          box?.addEventListener("input", () => err.remove(), { once: true });
          err.scrollIntoView?.({ block: "start" });
          box?.focus({ preventScroll: true });
          return false;
        }
        const clean = { date: v.date, payee: v.payee.trim(), amount: signedAmount(v.dir, v.amount) ?? 0, accountId: v.accountId, category: v.category, note: (v.note || "").trim(), tags: (v.tagsText || "").split(",").map((s) => s.trim()).filter(Boolean) };
        if (!clean.payee || !clean.date) return;
        const said = `${fmt.money(Math.abs(clean.amount), cur, undefined, 2)}${clean.amount > 0 ? " in" : clean.amount < 0 ? " out" : ""}`;   // $0.00 has no way
        const catName = clean.category ? (categoriesOf(plan).find((c) => c.id === clean.category)?.label ?? null) : null;
        committedAt = Date.now();
        pending = isNew ? `Added ${clean.payee}: ${said}.` : `Saved ${clean.payee}: ${said}${catName ? `, ${catName}` : ""}.`;
        store.update((p) => {
          p.transactions = p.transactions ?? [];
          if (isNew) { const t = { id: ui.uid(), ...clean, rawPayee: clean.payee }; t.key = txKey(t); p.transactions.push(t); }
          else { const i = p.transactions.findIndex((t) => t.id === editing.id); if (i >= 0) { p.transactions[i] = { ...p.transactions[i], ...clean }; p.transactions[i].key = txKey(p.transactions[i]); } }
        });
        editing = null;
      }, { submitLabel: isNew ? "Add transaction" : "Save changes", onCancel: () => { editing = null; drawForm(); } })),
      isNew ? null : ui.h("p", { style: { marginTop: "12px" } }, ui.button("Delete this transaction", () => {
        if (!ui.confirm(`Delete "${editing.payee}" on ${fmt.date(editing.date)}?`)) return;
        const id = editing.id;
        committedAt = Date.now();
        pending = `Deleted ${editing.payee}, ${fmt.date(editing.date)}.`;
        editing = null;
        store.update((p) => { p.transactions = (p.transactions ?? []).filter((t) => t.id !== id); });
      }, { class: "danger" })),
    ));
  };

  const list = ui.h("div");
  const drawList = () => {
    list.innerHTML = "";
    if (!d.total) return;
    if (!d.rows.length) { list.append(ui.card(null, ui.muted("No transactions match these filters."))); return; }
    let lastMonth = "";
    const items = [];
    for (const t of d.rows) {
      const m = String(t.date).slice(0, 7);
      if (m !== lastMonth && !state.month) { items.push(ui.h("li", { class: "muted small", style: { minHeight: "auto", padding: "10px 0 2px", borderBottom: "0", fontWeight: "600" } }, d.months.find((x) => x.ym === m)?.label ?? m)); lastMonth = m; }
      const a = Number(t.amount) || 0;
      items.push(ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
        onClick: () => {
          if (Date.now() - committedAt < 700) return;
          // a new line half typed is never thrown away by a tap on a row under it (stress test x-halfform, 2026-11-11)
          if (editing && !editing.id && [...formHost.querySelectorAll("input[name=payee], input[name=amount], input[name=note], input[name=tagsText]")].some((b) => b.value.trim())) {
            formHost.querySelector(".lg-hold")?.remove();
            formHost.prepend(ui.h("div", { class: "lg-hold" }, ui.notice("warn", "Finish the new transaction first: tap Add transaction to keep it, or Cancel to drop it.")));
            formCard.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          editing = plan.transactions.find((x) => x.id === t.id); drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, t.transfer ? "🔁" : t.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, t.payee, t.category ? null : ui.h("span", { class: "pill warn" }, "no category")),
          ui.h("div", { class: "d" }, [fmt.date(t.date), t.transfer ? "transfer" : (t.category ? t.categoryLabel : null), d.accounts.length > 1 ? t.accountName : null, t.note || null].filter(Boolean).join(" · "))),
        ui.h("span", { class: "st", style: { fontWeight: "600", color: a > 0 && !t.transfer ? "var(--ok)" : "inherit" } }, (a > 0 ? "+" : "-") + fmt.money(Math.abs(a), cur, undefined, 2)),
      ));
    }
    list.append(ui.card(null, ui.h("ul", { class: "page-list" }, items),
      d.hasMore ? ui.row(ui.button(`Show more (${d.matched - d.shown} left)`, () => { state.limit += 100; redraw(); }, { class: "secondary" })) : null,
      ui.h("p", { class: "muted small" }, "Tap a transaction to change its category, name or note.")));
  };
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };   // same plan, new filters
  const refresh = () => { d = compute(plan, { ...state, today: fmt.today() }); refreshTop(); drawList(); };   // the search box stays

  drawForm();
  formCard.append(formHost);
  root.append(formCard);
  if (editing && !editing.id) requestAnimationFrame(() => formCard.scrollIntoView({ block: "start" }));
  drawList();
  root.append(list);
  if (toList) { toList = false; requestAnimationFrame(() => list.scrollIntoView({ block: "start" })); }
}

// the bare Ledger address with what a link carries on (from=review&review=YYYY-MM)
const ledgerQuery = (query) => (query.from ? { from: query.from, ...(query.review ? { review: query.review } : {}) } : {});
function hrefOf(q) {
  const qs = Object.entries(q).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
  return `#/transactions/ledger${qs ? `?${qs}` : ""}`;
}
