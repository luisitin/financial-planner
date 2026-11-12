// THROWAWAY COPY for the forms acceptance scripts only (never committed): the tip's page with the wave 1 adoption the plan names (A1 / A2 / A5), served by accept-forms/_lib.mjs in place of a page that has not adopted the kit call yet.
// modules/balance/net-worth/view.js -- DOM only.
import { ACCOUNT_TYPES, isLiability, countedBalance } from "./compute.js";
import { keepOnFile, looksLikeSlip, correctSlip, markTyped } from "../update/compute.js";
import { isGuess, clearGuess } from "../../../core/estimate/index.js";
import { escrowBefore, escrowKept } from "../../overview/guesses/estimators/home.js";
import { guessTwins } from "../../overview/guesses/compute.js";

// The shell re-renders after store.update, so a confirmation waits here for the next render:
// { card: "accounts" | "history", text }.
let pending = null;
// A page that sends people here to add one thing opens the form already set to it (DP-3, B4, D1, CF-1):
//   ?add=<type>   the add form open, Type chosen, a heading and a name hint for that kind ("add=debt": a loan or card)
//   ?edit=<id>    that account's edit form open
//   ?back=<group/id>   after the save, the green line carries "Back to <that page> ›"
// Read once per address: the shell redraws with the same route object after a save, so the form does not open again.
let landedOn = null;
const ADD_AS = {
  debt: { type: "credit", title: "Add a loan or card", hint: "e.g. Visa card or Car loan", help: "Pick the kind under Type." },
  credit: { title: "Add a credit card", hint: "e.g. Visa card" },
  loan: { title: "Add a loan", hint: "e.g. Car loan" },
  mortgage: { title: "Add the mortgage", hint: "e.g. Home loan" },
  student_loan: { title: "Add a student loan", hint: "e.g. Federal student loan" },
  property: { title: "Add your home", hint: "e.g. Our home", help: "Type what it would sell for today." },
  vehicle: { title: "Add a car", hint: "e.g. Family car" },
  checking: { title: "Add an account", hint: "e.g. Chase checking", help: "Pick the kind under Type." },
  savings: { title: "Add a savings account", hint: "e.g. Emergency savings" },
  investment: { type: "brokerage", title: "Add an investment account", hint: "e.g. Brokerage account", help: "A retirement account? Pick 401(k), IRA or Roth under Type." },
  belonging: { type: "property", title: "Add a home or car", hint: "e.g. Our home or Family car", help: "Pick Real estate or Vehicle under Type, with what it would sell for today." },
};
// the words a kind of account is asked in: a home is not an "account" with an "institution" and a "balance" (walk 2026-11-11)
const WORDS = {
  asset: { name: "Account name", institution: "Bank or firm", balance: "Current balance", submit: "Add account" },
  debt: { name: "What to call it", institution: "Lender (optional)", balance: "What you owe now", submit: "Add it" },
  thing: { name: "What to call it", institution: null, balance: "What it would sell for today", submit: "Add it" },
};
const wordsFor = (type) => isLiability(type) ? WORDS.debt : type === "property" || type === "vehicle" || type === "other_asset" ? WORDS.thing : WORDS.asset;
// a page's name as a way back: "Back to Your home", not "Back to Home" (which reads like the app's first screen)
const BACK_NAMES = { "property/home": "Your home", "balance/accounts": "your account", "balance/assets": "your list of belongings" };
const addAs = (q) => ADD_AS[q] ? { type: ADD_AS[q].type ?? q, ...ADD_AS[q] } : ACCOUNT_TYPES[q] ? { type: q, title: `Add ${/^[aeiou]/i.test(ACCOUNT_TYPES[q].label) ? "an" : "a"} ${ACCOUNT_TYPES[q].label.toLowerCase()} account`, hint: null } : null;

const FIELDS = [
  { key: "name", label: "Account name", type: "text", required: true, placeholder: "e.g. Chase checking" },
  { key: "type", label: "Type", type: "select", options: Object.entries(ACCOUNT_TYPES).map(([value, t]) => ({ value, label: t.label })) },
  { key: "institution", label: "Institution", type: "text" },
  { key: "balance", label: "Current balance", type: "money", required: true, help: "for a loan or card, the amount still owed" },
  { key: "asOf", label: "Balance as of", type: "date" },
];
// Whose account: one of the people on the People page, saved as their id (the tax pages put an account's sales and
// contributions on its owner's return); "Joint or shared" saves "". A name typed before this was a choice stays selectable.
const ownerField = (plan, current) => {
  const people = plan.household?.people ?? [];
  const options = [{ value: "", label: "Joint or shared" }, ...people.map((p) => ({ value: p.id, label: p.name || "Unnamed" }))];
  if (current && !people.some((p) => p.id === current)) options.push({ value: current, label: `${current} (typed before; choose a person)` });
  return { key: "ownerId", label: "Whose account", type: "select", options, help: people.length ? "" : "add the household's people on the People page to choose" };
};

export function render(root, ctx) {
  const { ui, fmt, store, derived, plan } = ctx;
  // worked out with today's date: "since" is the last point before today, and a point saved today says so as well
  const d = ctx.computeOf?.("balance/net-worth", { today: fmt.today() }) ?? derived;
  const savedToday = (d.history ?? []).some((h) => h.date === fmt.today());
  const cur = plan.meta.currency;
  const q = ctx.route?.query ?? {};
  const fresh = ctx.route !== landedOn; landedOn = ctx.route;
  const asked = fresh ? addAs(q.add) : null;
  // the page to go back to after the save; Import is named by what comes next there
  const backKey = q.from === "import" ? "transactions/import" : q.back;
  // group/id, or group/id/<one more part> (Account detail opened at one account)
  const backMod = backKey && /^[a-z0-9-]+\/[a-z0-9-]+(\/[A-Za-z0-9_-]+)?$/.test(backKey) ? ctx.modules?.get(backKey.split("/").slice(0, 2).join("/")) : null;
  const backLink = backMod ? { href: `#/${backKey}`, label: backKey === "transactions/import" ? "Now import the bank file ›" : `Back to ${BACK_NAMES[backKey.split("/").slice(0, 2).join("/")] ?? backMod.title} ›` } : null;
  let editing = fresh && q.edit ? plan.accounts.find((a) => a.id === q.edit) ?? null : null;

  const empty = plan.accounts.length === 0;
  if (empty) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Net worth"),
      ui.h("p", { class: "lede" }, "Add each account with its current balance. Net worth is simply what you own minus what you owe, and this page tracks it over time."),
      ui.h("p", { class: "muted small" }, "Start with the big ones: checking, savings, retirement accounts, the mortgage, credit cards. You can add the rest later."),
    ));
  } else {
    root.append(ui.card(null, ui.row(
      // smart guesses C2 (spec 8.1): a guessed balance that is half or more of either side says so, never as settled fact
      ui.stat("Net worth", fmt.money(d.netWorth, cur), d.partlyGuessed ? "Partly our guesses. Type the real balances below." : d.change ? `${Math.abs(d.change.sinceLast) < 0.5 ? "No change" : fmt.signed(d.change.sinceLast, cur)} since ${fmt.date(d.change.since)}${savedToday ? ", saved today" : ""}` : savedToday ? "saved today" : "what you own minus what you owe"),
      ui.stat("You own", fmt.money(d.assets, cur), `${fmt.money(d.liquid, cur)} is cash or easy to sell`),
      ui.stat("You owe", fmt.money(d.liabilities, cur), d.liabilities ? "loans, cards, mortgage" : "nothing on file"),
      ui.stat("Invested for later", fmt.money(d.investable, cur), investedLine(d, fmt, cur)),
    )));
  }

  const said = (card) => {
    if (pending?.card !== card) return null;
    const n = ui.notice("ok", pending.text);
    if (pending.links?.length) n.append(ui.h("div", { class: "row", style: { marginTop: "8px" } }, ...pending.links.map((l) => ui.h("a", { class: l.filled ? "btn" : "btn secondary", href: l.href }, l.label))));
    pending = null; return n;
  };
  // The form stays open on the first visit; once accounts exist it folds behind a button
  // (design log 2026-09-15). Edit opens it filled in.
  let showForm = empty || !!asked || !!editing;
  let shownNote = null;
  const formHost = ui.h("div");
  // EVIDENCE (forms2 final): the form draws into a host it is given; an edit opens under its row (ui.openUnder)
  let closeEdit = null;
  const drawForm = (host = formHost) => {
    host.innerHTML = "";
    const n = said("form");
    if (n) { host.append(n); if (n.querySelector("a")) shownNote = n; }
    if (!showForm && !editing) {
      host.append(ui.h("div", { style: { marginTop: "12px" } }, ui.button("+ Add another account", () => { showForm = true; drawForm(); }, { class: "secondary" })));
      return;
    }
    const values = editing ? { ...editing } : { type: asked?.type ?? "checking", asOf: fmt.today() };
    host.append(ui.h("h2", {}, editing ? `Edit ${editing.name}` : asked?.title ?? "Add an account"));
    if (!editing && asked?.help) host.append(ui.h("p", { class: "muted small" }, asked.help));
    if (editing && isGuess(plan, `accounts[${editing.id}].balance`)) host.append(ui.h("p", { class: "muted small" }, "This balance is our guess. Type the real one, or save it as it is to keep it as yours."));
    const ask = ui.h("div");   // "was the old figure a typing mistake?", above the form
    host.append(ask);
    const save = (v, typo) => {
      const was = editing;
      const id = was ? was.id : ui.uid();
      // the green line is drawn where the form was (where the thumb is), with what comes next: the page that sent you here,
      // and for a new loan or card its rate and payment on Debts (a debt with neither is left out of every plan)
      const links = [];
      const rateLink = { href: `#/balance/liabilities/${encodeURIComponent(id)}${backMod && !backKey.startsWith("balance/liabilities") && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(backKey) ? `?back=${backKey}` : ""}`, label: "Next: its rate and payment ›" };
      // sent from Debts: back there, straight to the new debt's rate and payment
      if (backLink && backKey.startsWith("balance/liabilities") && !was && isLiability(v.type)) links.push({ ...rateLink, filled: true });
      else {
        if (backLink) links.push({ ...backLink, filled: true });
        if (!was && isLiability(v.type)) links.push({ ...rateLink, filled: !backLink });
      }
      pending = { card: "form", links, text: !was ? `${v.name} added.` : typo ? `${v.name || was.name} corrected to ${fmt.money(Math.abs(Number(v.balance)), cur)}, with its history: no fall is shown.` : `${v.name || was.name} saved.` };
      // a mortgage balance of ours saved here becomes the person's: the tax and insurance its payment was read with stay in that
      // payment, so the payoff date does not jump (home.js escrowKept; fix round 1, 2026-11-11)
      const held = escrowBefore(plan, fmt.today());
      store.update((p) => {
        if (was) {
          const i = p.accounts.findIndex((a) => a.id === was.id);
          if (i >= 0) {
            const old = p.accounts[i];
            const moved = Number(v.balance) !== Number(old.balance);
            // a typing mistake is fixed where it stood (its points and the saved totals), never kept as a point
            if (moved && typo) { correctSlip(p, old.id, Number(v.balance)); p.accounts[i] = { ...p.accounts[i], ...v, balance: p.accounts[i].balance }; markTyped(p, old.id, fmt.today()); return; }
            // a new balance is today's unless you dated it yourself; the old one stays a point on its own date
            if (moved) keepOnFile(p, old, v.asOf && v.asOf !== (old.asOf ?? "") ? v.asOf : fmt.today());
            p.accounts[i] = { ...p.accounts[i], ...v, ...(moved && (v.asOf ?? "") === (old.asOf ?? "") ? { asOf: fmt.today() } : {}) };
            if (moved) markTyped(p, old.id, fmt.today());
            // saved from the form, even unchanged, the balance is the person's: it is no longer our guess (spec S2)
            clearGuess(p, `accounts[${old.id}].balance`);
            escrowKept(p, held, fmt.today());
          }
        }
        else p.accounts.push({ id, ...v, history: [] });
      });
      // done with what the address asked: Back or Reload must not open an empty "Add a loan or card" again (walk 2026-11-11);
      // the history entry is replaced, so no page change happens
      if (q.add || q.edit) {
        const keep = Object.entries(q).filter(([k]) => k !== "add" && k !== "edit").map(([k, x]) => `${encodeURIComponent(k)}=${encodeURIComponent(x)}`).join("&");
        try { history.replaceState(history.state, "", `#/balance/net-worth${keep ? `?${keep}` : ""}`); } catch { /* not allowed: Back reopens the form, nothing worse */ }
      }
      editing = null;
    };
    const w = wordsFor(values.type);
    const fields = FIELDS.map((f) => f.key === "name" ? { ...f, label: w.name, ...(!editing && asked?.hint ? { placeholder: asked.hint } : {}) }
      : f.key === "balance" ? { ...f, label: w.balance, help: isLiability(values.type) || w === WORDS.thing ? null : f.help }
      : f.key === "asOf" && w !== WORDS.asset ? { ...f, label: w === WORDS.thing ? "Worth that on" : "Owed that on" }
      : f.key === "institution" ? (w.institution ? { ...f, label: w.institution } : null) : f).filter(Boolean);
    const owner = ownerField(plan, values.ownerId);
    host.append(ui.form([...fields, w === WORDS.asset ? owner : { ...owner, label: "Whose it is" }], { ownerId: "", ...values }, (v) => {
      // a new figure that looks like the old one with a key slipped (115,000 for 11,500): ask once which it was
      if (editing && looksLikeSlip(editing.balance, v.balance)) {
        const wrong = fmt.money(Math.abs(Number(editing.balance)), cur), right = fmt.money(Math.abs(Number(v.balance)), cur);
        // "it changed" is the default answer (a real change can look like a slip); the other rewrites the history (review 2026-11-02)
        ask.replaceChildren(ui.notice("warn", `${wrong} on file, ${right} typed. Did it change, or was ${wrong} a typing slip?`),
          ui.h("div", { class: "row" },
            ui.button("It changed", () => save(v, false)),
            ui.button(`${wrong} was a mistake`, () => save(v, true), { class: "secondary" }),
            ui.button("Let me fix what I typed", () => { ask.replaceChildren(); ask.style.marginBottom = ""; const box = host.querySelector('input[name="balance"]'); box?.focus(); box?.select?.(); }, { class: "secondary" })),
          ui.h("p", { class: "muted small" }, "A mistake on file is fixed in the history too, so net worth does not show a fall (or a jump) that never happened."));
        ask.style.marginBottom = "16px";
        ask.scrollIntoView({ behavior: "smooth", block: "center" });
        return false;   // keep the form as typed behind the question
      }
      save(v, false);
    }, { submitLabel: editing ? "Save changes" : asked && w !== WORDS.asset ? w.submit : "Add account", resetAfter: !editing, onCancel: (editing || !empty) ? () => { const wasEdit = !!editing; editing = null; if (wasEdit && closeEdit) { const c = closeEdit; closeEdit = null; c(); } else { showForm = false; drawForm(); } } : null }));
    // another kind picked under Type: the boxes' words follow it
    const typeSel = host.querySelector('select[name="type"]');
    typeSel?.addEventListener("change", () => {
      const x = wordsFor(typeSel.value);
      const lab = (k) => host.querySelector(`[name="${k}"]`)?.closest("label");
      const set = (k, t) => { const l = lab(k)?.querySelector(".field-label"); if (l && t) l.textContent = t; };
      set("name", x.name); set("balance", x.balance);
      if (lab("institution")) { set("institution", x.institution ?? WORDS.asset.institution); lab("institution").hidden = !x.institution; }
    });
  };
  drawForm();

  const edit = (a, ev) => { const row = ev?.currentTarget?.closest?.("li, tr"); if (!row) { editing = a; showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth" }); return; } closeEdit?.(); editing = a; closeEdit = ui.openUnder(row, (holder) => drawForm(holder)); };
  const del = (a) => { if (ui.confirm(`Delete ${a.name}?`)) { pending = { card: "accounts", text: `${a.name} removed.` }; store.update((p) => { p.accounts = p.accounts.filter((x) => x.id !== a.id); }); } };
  const guessed = (a) => isGuess(plan, `accounts[${a.id}].balance`);
  const typeLabel = (a) => (ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset).label;
  // Anything that counts against you (a loan, or an overdrawn asset) shows a minus in red (F-008).
  const balance = (a) => { const against = isLiability(a.type) || countedBalance(a) < 0; return ui.h("span", { class: against ? "bad" : "" }, (against ? "-" : "") + fmt.money(Math.abs(countedBalance(a)), cur)); };
  const rows = [...plan.accounts].sort((a, b) => Number(isLiability(a.type)) - Number(isLiability(b.type)) || Math.abs(b.balance) - Math.abs(a.balance));
  // Desktop: a table. Phone: one stacked record per account (tester F-002).
  const table = ui.h("div", { class: "only-wide" }, ui.table([
    { key: "name", label: "Account" },
    { key: "type", label: "Type", render: typeLabel },
    { key: "institution", label: "Institution" },
    { key: "balance", label: "Balance", align: "right", render: balance },
    { key: "asOf", label: "Balance as of", render: (a) => (guessed(a) ? "our guess for now" : fmt.date(a.asOf)) },
    { key: "actions", label: "", render: (a) => ui.h("span", {},
      ui.button("Edit", (ev) => edit(a, ev), { class: "secondary small" }), " ",
      ui.button("Delete", () => del(a), { class: "danger small" })) },
  ], rows, { empty: "No accounts yet. Add your first one below." }));
  // Phone record: name + Edit/Delete on the first line, type and balance on the second,
  // "as of" on the third (design log 2026-09-15, pass 2).
  const records = ui.h("ul", { class: "records only-narrow" }, rows.map((a) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, a.name),
      ui.h("span", { class: "rec-actions" }, ui.button("Edit", (ev) => edit(a, ev), { class: "secondary small" }), ui.button("Delete", () => del(a), { class: "danger small" }))),
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-sub" }, [typeLabel(a), a.institution].filter(Boolean).join(" \u00b7 ")), ui.h("span", { class: "rec-value" }, balance(a))),
    ui.h("div", { class: "rec-sub" }, guessed(a) ? "Our guess for now: Edit to type the real balance" : a.asOf ? `as of ${fmt.date(a.asOf)}` : ""))));
  // a debt typed here beside one Get started guessed: asked once on Our guesses for you, so it is not counted twice
  const twins = guessTwins(plan);
  if (twins.length) root.append(ui.h("ul", { class: "page-list" }, twins.map((t) => ui.h("li", {}, ui.h("a", { href: "#/overview/guesses", class: "muted" }, `Is ${t.twinName} the ${t.name.toLowerCase()} we guessed? Tell us, so it counts once ›`)))));
  root.append(ui.card(empty ? null : "Accounts",
    said("accounts"),
    empty ? null : ui.h("p", {}, ui.h("a", { href: "#/balance/update", class: "btn secondary" }, "Update all balances at once")),
    empty ? null : table, empty ? null : records,
    formHost,
  ));

  // the green line with its next steps, in view (on a small phone it sat under the top bar after the form folded away)
  if (shownNote) { const r = shownNote.getBoundingClientRect(); if (r.top < 70 || r.bottom > window.innerHeight) shownNote.scrollIntoView({ block: "start" }); }
  // landed here to add or change one thing: the form in view and its first box ready (the page scrolls itself, so the shell's
  // "a new address starts at the top" gives way)
  if (fresh && (asked || editing) && !empty) {
    const h2 = formHost.querySelector("h2");
    h2?.scrollIntoView({ block: "start" });
    const box = formHost.querySelector(editing ? 'input[name="balance"]' : 'input[name="name"]');
    try { box?.focus({ preventScroll: true }); } catch { /* old browsers */ }
  }
  const histOut = ui.h("div");
  const histSaid = said("history");
  if (histSaid) { histOut.append(histSaid); setTimeout(() => histSaid.remove(), 4000); }
  const overTime = empty ? null : ui.card("Over time",
    ui.h("p", { class: "muted small" }, "Save today's totals now and then (monthly is plenty). Each save becomes a point on your history; saving twice in one day just updates that day."),
    // one filled button on the screen: while the green line offers its filled way on, this one is outlined (review N3)
    ui.row(ui.button("Save today's totals", () => { pending = { card: "history", text: "Today's totals saved." }; store.update((p) => {
      p.netWorthHistory = (p.netWorthHistory ?? []).filter((h) => h.date !== fmt.today());
      p.netWorthHistory.push({ date: fmt.today(), assets: d.assets, liabilities: d.liabilities, netWorth: d.netWorth });
      for (const a of p.accounts ?? []) { a.history = (a.history ?? []).filter((h) => h.date !== fmt.today()); a.history.push({ date: fmt.today(), balance: Number(a.balance) || 0 }); }   // per-account points feed investments/performance
    }); }, shownNote?.querySelector("a.btn:not(.secondary)") ? { class: "secondary" } : {})),
    histOut,
    d.history.length === 0 ? null : snapshots([...d.history].reverse()),
  );
  if (overTime) root.append(overTime);
  // the check-in's "save today's totals" step (#/balance/net-worth?at=history, MR-5): the Over time card in view, once per address
  if (fresh && q.at === "history" && !asked && !editing && overTime) overTime.scrollIntoView({ block: "start" });
  // a total saved on a bad day (a balance mistyped then) can be taken out; the accounts themselves are not touched
  function snapshots(list) {
    const drop = (h) => {
      if (!ui.confirm(`Remove the totals saved on ${fmt.date(h.date)}? Your accounts are not changed.`)) return;
      pending = { card: "history", text: `The totals of ${fmt.date(h.date)} are removed.` };
      store.update((p) => { p.netWorthHistory = (p.netWorthHistory ?? []).filter((x) => x.date !== h.date); });
    };
    return ui.h("div", {},
      ui.h("div", { class: "only-wide" }, ui.table([
        { key: "date", label: "Date", render: (h) => fmt.date(h.date) },
        { key: "assets", label: "You own", align: "right", render: (h) => fmt.money(h.assets, cur) },
        { key: "liabilities", label: "You owe", align: "right", render: (h) => fmt.money(h.liabilities, cur) },
        { key: "netWorth", label: "Net worth", align: "right", render: (h) => fmt.money(h.netWorth, cur) },
        { key: "actions", label: "", render: (h) => ui.button("Remove", () => drop(h), { class: "danger small" }) },
      ], list)),
      ui.h("ul", { class: "records only-narrow" }, list.map((h) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, fmt.date(h.date)), ui.h("span", { class: "rec-value" }, fmt.money(h.netWorth, cur))),
        ui.h("div", { class: "rec-sub" }, `You own ${fmt.money(h.assets, cur)} · you owe ${fmt.money(h.liabilities, cur)}`),
        ui.h("div", { class: "rec-foot" }, ui.button("Remove", () => drop(h), { class: "danger small" }))))));
  }
}

// Small line under "Invested for later": plain words at zero, no $0 parts otherwise.
function investedLine(d, fmt, cur) {
  if (!d.investable) return "nothing yet: retirement and investment accounts count here";
  const b = d.byTaxBucket;
  const parts = [];
  if (b.deferred) parts.push(`${fmt.money(b.deferred, cur)} in retirement accounts (pre-tax)`);
  if (b.free) parts.push(`${fmt.money(b.free, cur)} tax-free`);
  if (b.taxable) parts.push(`${fmt.money(b.taxable, cur)} taxable`);
  return parts.join(", ");
}
