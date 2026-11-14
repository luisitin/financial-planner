// modules/transactions/ledger/view.js -- DOM only. Filters on top, totals, the list (tap a row
// to edit), "show more", and one form for adding or editing a transaction by hand.
// Gap #24 (2026-11-14): the form's Note and Tags wait under "More details (optional)", with "Split this across
// categories" beside them; search reads tags ("#trip"); a split purchase is one row naming its parts.
// Gap #32 (2026-11-14): under the same line, "How this counts" (paid back later, the money back, a refund of a purchase,
// left out of reports) and "Flag to look at later"; a row says its mark, and the totals say how many lines are left out.
import { compute, txKey, theCard, signedAmount, directionOf, monthLabel, makeSplit, splitForm, splitWords, restWords, cleanTags, tagsOf,
  markOf, markChoices, applyMark, unlinkGone, markHelp, markSaid, backGap, notCounted, lineWords, MARK_LABELS } from "./compute.js";
import { categoriesOf } from "../categories/compute.js";

// filter state survives the re-render the shell does after every save
const state = { month: "", accountId: "", category: "", q: "", dir: "", only: "", limit: 100 };
// a new line to open on arrival (the Monthly review's "Add Chase checking's lines by hand": ?add=<first missing day>)
let addOn = null;
// a line to open on arrival (Categorize's flagged list: ?edit=<its id>), gap #32
let editOn = null;
// the confirmation shown on the next render (the shell re-renders after store.update): "Added Corner cafe: $6.25 out."
let pending = null;
// arrived from a link that set the filters (a category on Where the money goes, an account, a month): bring the list up once
let toList = false;
// when the last add, save or delete happened: a second tap within 700 ms lands on whatever moved under the thumb (the
// list slides up as the form closes) and must not open another row (stress-test attack, 2026-11-11)
let committedAt = 0;
// a tag's link from Where the money goes lands on the lines with "Showing" shut (its one line already says the month and
// the tag); it opens as before once the person opens it or changes a filter by hand (gap #24)
let showShut = false;
let ledgerForm = null;   // the open add/edit form, for its error line
const STYLE = `.lg-show > summary .fold-status { white-space: normal; text-align: right; min-width: 0; }
.lg-split { display: grid; gap: 10px; }
.lg-split .lg-part { display: grid; gap: 8px; padding: 10px 0; border-top: 1px solid var(--line, rgba(128,128,128,.3)); }
.lg-count { display: grid; gap: 14px; }
.lg-count .lg-flag { display: flex; flex-direction: row; align-items: center; gap: 10px; min-height: 44px; }
.lg-count .lg-flag .field-label { order: 2; margin: 0; }
.lg-left { margin-top: 12px; }`;

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
  // optional, one tap away: a saved note or tag opens the line by itself (ui.form `more`)
  { key: "note", label: "Note", type: "text", more: true },
  { key: "tagsText", label: "Tags", type: "text", more: true, placeholder: "e.g. trip, kids", help: "A word to find these by later, with commas between. Where the money goes adds up each tag." },
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
    Object.assign(state, { month: "", accountId: "", category: "", q: "", dir: "", only: "", limit: 100 });
    if (rest[0] === "uncategorised") { state.category = "none"; }
    if (rest[0] === "month" && rest[1]) { state.month = rest[1]; }
    // a category with it (?category=groceries, or none for the unfiled lines): "Groceries in Sep 2026", not the whole month
    if (query.category && rest[0] !== "uncategorised") state.category = query.category;
    // ?dir=out: only money out, as a spending page counts it (review N3, 2026-11-11)
    if (query.dir === "out" || query.dir === "in") state.dir = query.dir;
    // ?q=#trip: a tag's lines, from Where the money goes (gap #24)
    showShut = false;
    if (typeof query.q === "string" && query.q.trim()) { state.q = query.q.trim().slice(0, 60); showShut = true; }
    toList = !addOn;
    if (rest[0] === "account" && rest[1]) {
      state.accountId = rest[1];
      // opened to add the days an account's files miss: that month, and a new line dated the first missing day (re-check 4)
      if (/^\d{4}-\d{2}$/.test(query.month ?? "")) state.month = query.month;
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.add ?? "")) addOn = { date: query.add, accountId: rest[1] };
    }
    // ?edit=<id>: that line's own form, open (Categorize's "Open it" on a flagged line)
    editOn = typeof query.edit === "string" && query.edit ? query.edit : null;
    if (addOn || editOn) toList = false;
    // the way back to the check-in (from=review) stays in the address (re-check 4, 2026-11-02). The address is replaced, not
    // added to: one Back returns to the page the link was on (stress test p-cashflow-b-goals/F1, 2026-11-11)
    location.replace(hrefOf(ledgerQuery(query)));
    return;
  }
  let d = compute(plan, { ...state, today: fmt.today() });
  const hasAccounts = (plan.accounts ?? []).length > 0;
  let editing = addOn ? { date: addOn.date, accountId: addOn.accountId, category: "", amount: null } : editOn ? (plan.transactions ?? []).find((x) => x.id === editOn) ?? null : null;
  const arrived = !!editing;   // opened by a link: the form comes up once
  addOn = null; editOn = null;
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
    const search = ui.h("input", { type: "search", placeholder: "Search payee, note or #tag", value: state.q, "aria-label": "Search", enterkeyhint: "search", onInput: (e) => { state.q = e.target.value; clearTimeout(search._t); search._t = setTimeout(refresh, 250); },
      onKeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(search._t); refresh(); } } });
    // Totals first; the four filters fold behind one row that says what is showing
    // (design log 2026-09-15).
    const totals = () => ui.card(null, ui.row(
      ui.stat("Money in", fmt.money(d.in, cur), state.month ? "this month" : "all time"),
      ui.stat("Money out", fmt.money(d.out, cur), `transfers between your accounts not counted${d.cardsOut >= 1 ? `; ${fmt.money(d.cardsOut, cur)} of it went to ${d.cardsOutNames?.length === 1 ? `${theCard(d.cardsOutNames[0])}, whose file isn't in` : "cards whose files aren't in"}` : ""}`),
      ui.stat(d.net >= 0 ? "Kept" : "Short", fmt.money(Math.abs(d.net), cur), `${d.matched} transaction${d.matched === 1 ? "" : "s"}${d.uncategorised ? `, ${d.uncategorised} uncategorized` : ""}`),
    ),
    // the lines in none of these totals (gap #32): how many, and one tap lists them
    d.leftOut && !state.only ? ui.row(ui.button(notCounted(d.leftOut), () => { state.only = "left"; redraw(); }, { class: "secondary small lg-left" })) : null);
    totalsHost.append(totals());
    root.append(totalsHost);
    const showingText = () => [
      state.month ? (d.months.find((m) => m.ym === state.month)?.label ?? monthLabel(state.month)) : "all months",
      state.accountId ? (d.accounts.find((a) => a.id === state.accountId)?.name ?? "one account") : "all accounts",
      state.category === "none" ? "uncategorized" : state.category ? (categoriesOf(plan).find((c) => c.id === state.category)?.label ?? "one category") : "all categories",
      state.q ? `“${state.q}”` : null,
      state.dir === "out" ? "money out only" : state.dir === "in" ? "money in only" : null,
      state.only === "left" ? "not counted only" : null,
    ].filter(Boolean).join(" · ");
    const status = ui.h("span", { class: "fold-status" }, showingText());
    refreshTop = () => { totalsHost.replaceChildren(totals()); status.textContent = showingText(); };
    // "not counted only" has its own line and way back under the fold, so it does not open the four boxes
    const filtered = !!(state.month || state.accountId || state.category || state.q || state.dir);
    root.append(ui.h("details", { class: "card fold fold-card lg-show", open: filtered && !showShut ? true : null, onToggle: (e) => { if (e.currentTarget.open) showShut = false; } },
      ui.h("summary", {}, ui.h("h2", {}, "Showing"), status, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("div", { class: "form" }, ui.field("Month", monthSel), ui.field("Account", acctSel), ui.field("Category", catSel), ui.field("Search", search)))));
    // money out only (a spending page's link): say so, with the way to see both; unfiled lines with money in among them:
    // say how many, since the spending pages count only the money going out (review N3, 2026-11-11)
    if (state.only === "left") root.append(ui.notice("info", [ui.h("div", {}, "Showing only the lines not counted in your spending or income: paid back, or left out."), ui.row(ui.button("Show every line", () => { state.only = ""; redraw(); }, { class: "secondary" }))]));
    else if (state.dir) root.append(ui.notice("info", [ui.h("div", {}, state.dir === "out" ? "Showing money out only." : "Showing money in only."), ui.row(ui.button("Show money in and out", () => { state.dir = ""; redraw(); }, { class: "secondary" }))]));
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
    const values = { ...editing, dir: isNew && editing.amount === null ? "out" : directionOf(editing.amount), amount: editing.amount === null || editing.amount === undefined ? null : Math.abs(Number(editing.amount)), tagsText: tagsOf(editing).join(", ") };
    // a split purchase opens on the category that kept the rest; its other parts sit under "More details (optional)"
    const saved = splitForm(editing);
    if (saved.parts.length) values.category = saved.category;
    const money2 = (x) => fmt.money(x, cur, undefined, 2);
    const labelOf = (id) => categoriesOf(plan, { all: true }).find((c) => c.id === id)?.label ?? id;
    const kindOf = (id) => categoriesOf(plan, { all: true }).find((c) => c.id === id)?.kind ?? null;
    const split = splitEditor(ctx, { parts: saved.parts, money2, labelOf, form: () => ledgerForm });
    const count = countEditor(ctx, { line: editing, money2, form: () => ledgerForm });
    const markWas = markOf(editing, plan.transactions), flagWas = !!editing.flag;
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
        const clean = { date: v.date, payee: v.payee.trim(), amount: signedAmount(v.dir, v.amount) ?? 0, accountId: v.accountId, category: v.category, note: (v.note || "").trim(), tags: cleanTags(v.tagsText) };
        if (!clean.payee || !clean.date) return;
        // the parts typed come off the amount and the Category box keeps the rest; a refusal is said at its box (gap #24)
        const sp = makeSplit({ amount: clean.amount, category: v.category, parts: split.read(), transfer: !!editing.transferId || v.category === "transfer" || kindOf(v.category) === "transfer" }, { money: money2, label: labelOf });
        if (!sp.ok) return ui.fieldError(sp.at < 0 ? ledgerForm.querySelector('[name="category"]') : split.boxAt(sp.at, sp.on === "amount"), sp.error);
        clean.category = sp.category;
        // "How this counts": a choice that names another line needs the line picked (gap #32)
        const mk = count.read();
        if ((mk.kind === "back" || mk.kind === "refund") && !mk.of) return ui.fieldError(count.pickBox(), "Pick the purchase, or choose “As usual” above.");
        const said = `${fmt.money(Math.abs(clean.amount), cur, undefined, 2)}${clean.amount > 0 ? " in" : clean.amount < 0 ? " out" : ""}`;   // $0.00 has no way
        const catName = clean.category ? (categoriesOf(plan).find((c) => c.id === clean.category)?.label ?? null) : null;
        committedAt = Date.now();
        const parts = sp.splits ? splitWords({ ...clean, splits: sp.splits }, { money: money2, label: labelOf }) : "";
        const was = !isNew && !sp.splits && saved.parts.length > 0;   // the split was taken off: one category again
        const left = sp.empty ? ` (the empty part${sp.empty === 1 ? " was" : "s were"} left out)` : "";
        pending = parts ? `${isNew ? "Added" : "Saved"} ${clean.payee}: ${said}, split: ${parts}.`
          : isNew ? `Added ${clean.payee}: ${said}.` : `Saved ${clean.payee}: ${said}${catName ? `, ${catName}` : ""}${was ? ", no longer split" : ""}.`;
        if (left) pending = `${pending.slice(0, -1)}${left}.`;
        store.update((p) => {
          p.transactions = p.transactions ?? [];
          let id = editing.id;
          if (isNew) { const t = { id: (id = ui.uid()), ...clean, rawPayee: clean.payee, ...(sp.splits ? { splits: sp.splits } : {}) }; t.key = txKey(t); p.transactions.push(t); }
          else {
            const i = p.transactions.findIndex((t) => t.id === editing.id);
            if (i >= 0) { const t = { ...p.transactions[i], ...clean }; if (sp.splits) t.splits = sp.splits; else delete t.splits; t.key = txKey(t); p.transactions[i] = t; }
          }
          // the mark, and the pair kept true on both lines; the green line says what it did (one sentence a case: markSaid)
          const res = applyMark(p.transactions, id, mk);
          const other = res.kind === "refund" ? p.transactions.find((x) => x.id === mk.of) : res.partner;
          const more = markSaid({ kind: res.kind, was: markWas.kind, of: res.kind === "refund" ? mk.of : res.partner?.id ?? null, wasOf: markWas.of, out: clean.amount < 0, line: clean, other, freed: res.freed,
            category: other && catName && clean.category === other.category ? catName : "", flag: mk.flag, flagWas }, { money: money2 });
          if (more) pending += more;
        });
        editing = null;
      }, { submitLabel: isNew ? "Add transaction" : "Save changes", onCancel: () => { editing = null; drawForm(); }, ...(saved.parts.length || markWas.kind !== "usual" || flagWas ? { moreOpen: true } : {}) })),
      isNew ? null : ui.h("p", { style: { marginTop: "12px" } }, ui.button("Delete this transaction", () => {
        if (!ui.confirm(`Delete "${editing.payee}" on ${fmt.date(editing.date)}?`)) return;
        const id = editing.id;
        committedAt = Date.now();
        pending = `Deleted ${editing.payee}, ${fmt.date(editing.date)}.`;
        editing = null;
        // a pair it was half of comes apart: the purchase waits again, the money back counts again (gap #32)
        store.update((p) => { p.transactions = (p.transactions ?? []).filter((t) => t.id !== id); unlinkGone(p.transactions, id); });
      }, { class: "danger" })),
    ));
    // "Split this across categories" sits with Note and Tags under the form's "More details (optional)" line; money moved
    // between your own accounts is never split
    if (!editing.transferId) split.mount(ledgerForm);
    count.mount(ledgerForm);
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
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, t.payee, t.category || t.mark ? null : ui.h("span", { class: "pill warn" }, "no category"), t.mark ? ui.h("span", { class: "pill" }, t.mark) : null, t.flag ? ui.h("span", { class: "pill accent" }, "flagged") : null),
          ui.h("div", { class: "d" }, [fmt.date(t.date), t.transfer ? "transfer" : t.splitLabel ? `split: ${t.splitLabel}` : (t.category ? t.categoryLabel : null), t.refundLabel ?? null, d.accounts.length > 1 ? t.accountName : null, t.note || null, tagsOf(t).map((g) => `#${g}`).join(" ") || null].filter(Boolean).join(" · "))),
        ui.h("span", { class: "st", style: { fontWeight: "600", color: a > 0 && !t.transfer && !t.mark ? "var(--ok)" : "inherit" } }, (a > 0 ? "+" : "-") + fmt.money(Math.abs(a), cur, undefined, 2)),
      ));
    }
    list.append(ui.card(null, ui.h("ul", { class: "page-list" }, items),
      d.hasMore ? ui.row(ui.button(`Show more (${d.matched - d.shown} left)`, () => { state.limit += 100; redraw(); }, { class: "secondary" })) : null,
      ui.h("p", { class: "muted small" }, "Tap a transaction to change its category, name or note. More details there: split it, leave it out, or flag it.")));
  };
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };   // same plan, new filters
  const refresh = () => { d = compute(plan, { ...state, today: fmt.today() }); refreshTop(); drawList(); };   // the search box stays

  drawForm();
  formCard.append(formHost);
  root.append(formCard);
  if (editing && (!editing.id || arrived)) requestAnimationFrame(() => formCard.scrollIntoView({ block: "start" }));
  drawList();
  root.append(list);
  if (toList) { toList = false; requestAnimationFrame(() => list.scrollIntoView({ block: "start" })); }
}

/**
 * "Split this across categories" (gap #24): each part taken out is a category and an amount; the form's Category box keeps
 * the rest, so the parts always add up to what was paid. Nothing here writes: the form's own Save reads the parts (read()).
 */
function splitEditor(ctx, { parts, money2, labelOf, form }) {
  const { ui, plan } = ctx;
  const rows = [];   // { el, cat, amt }
  const host = ui.h("div", { class: "lg-split" });
  const list = ui.h("div"), restLine = ui.h("p", { class: "muted small", "aria-live": "polite" });
  const options = [{ value: "", label: "Pick a category..." }, ...categoriesOf(plan).filter((c) => c.kind !== "transfer").map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))];
  const box = (name) => form()?.querySelector?.(`[name="${name}"]`) ?? null;
  const say = () => {
    if (!rows.length) { restLine.textContent = ""; return; }
    const total = Math.abs(ui.moneyValue(box("amount")) ?? 0), taken = rows.reduce((s, r) => s + Math.abs(ui.moneyValue(r.amt) ?? 0), 0);
    restLine.textContent = restWords({ total, taken, main: box("category")?.value ?? "" }, { money: money2, label: labelOf });
  };
  const addBtn = ui.button("Split this across categories", () => add(), { class: "secondary" });
  const lead = ui.h("p", { class: "muted small" }, "Take part of this out into another category.");
  const relabel = () => { addBtn.textContent = rows.length ? "+ Take out another part" : "Split this across categories"; lead.hidden = !rows.length; };
  function add(p = {}) {
    const n = rows.length + 1;
    const cat = ui.select(options.some((o) => o.value === (p.category ?? "")) ? options : [...options, { value: p.category, label: labelOf(p.category) }], p.category ?? "", { name: `splitCategory${n}`, onChange: say });
    const m = ui.moneyBox({ name: `splitAmount${n}`, value: p.amount ?? "", placeholder: "e.g. 40.00", label: "Its amount" });
    m.input.addEventListener?.("input", say);
    const row = { cat, amt: m.input };
    row.el = ui.h("div", { class: "lg-part" }, ui.field("This part is for", cat), ui.field("Its amount", m.box),
      ui.row(ui.button("Remove this part", () => { rows.splice(rows.indexOf(row), 1); row.el.remove?.(); relabel(); say(); }, { class: "secondary" })));
    rows.push(row); list.append(row.el); relabel(); say();
  }
  for (const p of parts) add(p);
  relabel();
  host.append(lead, list, restLine, ui.row(addBtn));
  return {
    /** Put the editor under the form's "More details (optional)" line, and keep the rest line true as the form is typed in. */
    mount(f) {
      const body = f?.querySelector?.(".form-more")?.querySelector?.(".fold-body");
      if (!body) return;
      body.append(host);
      box("amount")?.addEventListener?.("input", say);
      box("category")?.addEventListener?.("change", say);
      say();
    },
    read: () => rows.map((r) => ({ category: r.cat.value, amount: ui.moneyValue(r.amt) })),
    /** The box to mark for the part at `i` of what read() gave with the empty rows left out (makeSplit's `at`). */
    boxAt(i, amount) { const typed = rows.filter((r) => r.cat.value || (r.amt.value ?? "") !== ""); const r = typed[i] ?? typed[typed.length - 1] ?? rows[0]; return amount ? r?.amt : r?.cat; },
  };
}

/**
 * "How this counts" and "Flag to look at later" (gap #32), under the form's "More details (optional)" line. One choice box;
 * a second one only when the choice names another line ("That's the money back", "This is a refund of…"). Nothing here
 * writes: the form's own Save reads it (read()). The choices follow the form's "Which way", date and payee as they change.
 */
function countEditor(ctx, { line, money2, form }) {
  const { ui, plan } = ctx;
  const saved = markOf(line, plan.transactions);
  let kind = saved.kind, of = saved.of, pick = null, kindSel = null, kinds = "";
  const host = ui.h("div", { class: "lg-count" });
  const gapNote = ui.h("small", { class: "help lg-gap", "aria-live": "polite" });
  // the money back and the purchase differ: said under the picker as soon as one is picked, before Save (backGap)
  const gap = () => { const amt = ui.moneyValue ? ui.moneyValue(box("amount")) : Number(box("amount")?.value); gapNote.textContent = kind === "back" && pick?.value ? backGap(amt ?? line.amount, byId(pick.value), { money: money2 }) : ""; gapNote.hidden = !gapNote.textContent; };
  const kindHost = ui.h("div"), pickHost = ui.h("div"), help = ui.h("small", { class: "help", "aria-live": "polite" });
  const flagBox = ui.h("input", { type: "checkbox", name: "flag", checked: line.flag ? true : null });
  const kindField = ui.h("label", { class: "field" }, ui.h("span", { class: "field-label" }, "How this counts"), kindHost, help);
  const box = (name) => form()?.querySelector?.(`[name="${name}"]`) ?? null;
  const isOut = () => (box("dir")?.value ?? "out") !== "in";
  const now = () => ({ id: line.id, transferId: line.transferId, rawPayee: line.rawPayee, refundOf: saved.kind === "refund" ? saved.of : null, amount: isOut() ? -1 : 1, date: box("date")?.value || line.date, payee: box("payee")?.value ?? line.payee });
  const byId = (id) => (plan.transactions ?? []).find((t) => t.id === id) ?? null;
  const draw = () => {
    const c = markChoices(plan, now());
    kindField.hidden = !c.kinds.length;
    if (!c.kinds.includes(kind)) kind = "usual";
    // the choice box is rebuilt only when the choices themselves change (the way flipped, a payee typed): a pick keeps the focus
    if (c.kinds.join() !== kinds) {
      kinds = c.kinds.join();
      kindSel = ui.select(c.kinds.map((k) => ({ value: k, label: MARK_LABELS[k] })), kind, { name: "markKind", onChange: (e) => { kind = e.target.value; draw(); } });
      kindHost.innerHTML = ""; kindHost.append(kindSel);
    }
    pickHost.innerHTML = ""; pick = null;
    if (kind === "back" || kind === "refund") {
      const list = kind === "back" ? c.waiting : c.refunds;
      pick = ui.select([{ value: "", label: "Pick the purchase..." }, ...list.map((t) => ({ value: t.id, label: lineWords(t, money2) }))], list.some((t) => t.id === of) ? of : "", { name: "markOf", onChange: (e) => {
        of = e.target.value || null; gap();
        // a refund is filed where the purchase was, so it comes off that spending; the box above shows it and can still be changed
        const cat = box("category"), bought = kind === "refund" ? byId(of) : null;
        if (cat && bought?.category && categoriesOf(plan).some((c) => c.id === bought.category) && cat.value !== bought.category) { cat.value = bought.category; if (typeof Event === "function") cat.dispatchEvent?.(new Event("change", { bubbles: true })); }
      } });
      pickHost.append(ui.field(kind === "back" ? "The purchase it pays back" : "What was bought", pick), gapNote);
    }
    gap();
    help.textContent = markHelp(kind, { out: isOut(), other: kind === "payback" && saved.kind === "payback" ? byId(saved.of) : null, money: money2 });
  };
  host.append(kindField, pickHost, ui.h("label", { class: "field lg-flag" }, ui.h("span", { class: "field-label" }, "Flag to look at later"), flagBox));
  return {
    mount(f) {
      const body = f?.querySelector?.(".form-more")?.querySelector?.(".fold-body");
      if (!body) return;
      body.append(host);
      for (const n of ["dir", "date", "payee"]) box(n)?.addEventListener?.("change", draw);
      for (const e of ["input", "change"]) box("amount")?.addEventListener?.(e, gap);
      draw();
    },
    read: () => ({ kind, of: kind === "back" || kind === "refund" ? pick?.value || null : null, flag: !!flagBox.checked }),
    pickBox: () => pick,
  };
}

// the bare Ledger address with what a link carries on (from=review&review=YYYY-MM)
const ledgerQuery = (query) => (query.from ? { from: query.from, ...(query.review ? { review: query.review } : {}) } : {});
function hrefOf(q) {
  const qs = Object.entries(q).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
  return `#/transactions/ledger${qs ? `?${qs}` : ""}`;
}
