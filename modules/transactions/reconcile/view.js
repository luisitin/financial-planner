// modules/transactions/reconcile/view.js -- DOM only. Check a bank or card statement against the ledger: pick the
// account, type the statement's first and last day and its starting and ending balance, and see whether the lines on
// file add up to the same change. A gap comes with what could explain it; a match can be saved, so the next statement
// starts where this one ended. Checking changes nothing; only "Mark as reconciled" and "Remove" change the plan.
import { compute, reconcile, recordOf, nextStart } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let input = null;     // { accountId, from, to, startBalance, endBalance } as last checked, kept while the app is open

const STYLE = `
.rc-root .rc-lines { margin: 6px 0 0; }
.rc-root .rec-sub b { font-weight: 600; }
.rc-root td.align-right, .rc-root th.align-right { white-space: nowrap; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta?.currency;
  const d = compute(plan);
  const root = ui.h("div", { class: "rc-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 5000); pending = null; }
  const money = (v) => fmt.money(v, cur, "en-US", 2);
  const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v))}`;

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Check a statement"),
      ui.h("p", { class: "lede" }, "Once your bank's transactions are in the app, this page checks them against a bank or card statement: type the statement's dates and balances and it shows whether the two agree, and what could explain any difference."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"))));
    return;
  }

  // the statement
  // a fresh statement for an account starts the day after its last checked one, at that one's ending balance
  const fresh = (accountId) => { const s = nextStart(plan, accountId); return { accountId, from: s?.from ?? "", startBalance: s?.startBalance ?? null, to: "", endBalance: null }; };
  const rerender = () => { page.replaceChildren(); render(page, ctx); };
  if (!input || input.fresh || !d.accounts.some((a) => a.id === input.accountId)) input = fresh(d.accounts.some((a) => a.id === input?.accountId) ? input.accountId : d.accounts.find((a) => a.lines > 0).id);
  const acct = d.accounts.find((a) => a.id === input.accountId);
  const options = d.accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.lines} ${a.lines === 1 ? "transaction" : "transactions"})` }));
  const form = ui.form([
    { key: "accountId", label: "Account", type: "select", options },
    { key: "from", label: "First day on the statement", type: "date", required: true },
    { key: "startBalance", label: "Starting balance", type: "money", required: true, help: acct?.liability ? "as printed: what you owed at the start (a credit is below 0)" : "as printed on the statement" },
    { key: "to", label: "Last day on the statement", type: "date", required: true },
    { key: "endBalance", label: "Ending balance", type: "money", required: true, help: acct?.liability ? "as printed: what you owed at the end" : "as printed on the statement" },
  ], input, (v) => { input = { ...v }; rerender(); }, { submitLabel: "Check" });
  form.querySelector("select[name=accountId]")?.addEventListener("change", (e) => { input = fresh(e.target.value); rerender(); });
  const last = acct?.last;
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Check a statement"),
    ui.h("p", { class: "muted small" }, "Type four things from the statement. The page adds up your transactions on file for the same days and compares. Checking changes nothing."),
    last ? ui.h("p", { class: "muted small" }, `Last checked statement for this account: ${fmt.date(last.from)} to ${fmt.date(last.to)}, ending at ${money(last.endBalance)}. The next one starts the day after.`) : null,
    form));

  const r = input.to ? reconcile(plan, input) : null;
  if (r && !r.ready) root.append(ui.notice("error", r.why === "dates" ? "The last day must be on or after the first day. Check both dates on the statement." : "Type both balances from the statement."));
  if (r?.ready) {
    root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, r.matches ? "Your ledger matches the statement" : "Your ledger and the statement differ"),
      ui.row(
        ui.stat("The statement", signed(r.statementChange), `${money(input.startBalance)} to ${money(input.endBalance)}`),
        ui.stat("Your ledger", signed(r.ledgerChange), `${r.lines.length} ${r.lines.length === 1 ? "transaction" : "transactions"} in these days`),
        ui.stat(r.matches ? "Difference" : "To explain", money(Math.abs(r.gap)), r.matches ? "they agree to the cent" : r.gap > 0 ? `the statement ${r.liability ? "owes" : "has"} more` : `the statement ${r.liability ? "owes" : "has"} less`)),
      r.liability ? ui.h("p", { class: "muted small" }, "For a card or loan the balance is what you owe, so spending raises it and payments lower it.") : null,
      r.matches ? ui.row(ui.button("Mark as reconciled", () => {
        const rec = recordOf(r, input, { id: ui.uid(), today: fmt.today() });
        pending = `${acct.name}: the statement from ${fmt.date(input.from)} to ${fmt.date(input.to)} is saved as checked. The next one starts the day after.`;
        input = { accountId: acct.id, fresh: true };   // set before the update: the shell draws the page again inside it
        store.update((q) => { q.reconciliations = q.reconciliations ?? []; q.reconciliations.push(rec); });
      })) : null));

    if (!r.matches) root.append(ui.card("What could explain it", ui.h("ul", { class: "records" }, r.hints.map((h) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, h.ids.length ? h.ids.map((id) => r.lines.find((t) => t.id === id) ?? (plan.transactions ?? []).find((t) => t.id === id)).filter(Boolean).map((t) => `${t.payee || "No description"}, ${fmt.date(t.date)}`).join(" and ") : h.kind === "swap" ? "Two digits swapped?" : "A missing transaction?"), ui.h("span", { class: "rec-value" }, signed(h.amount))),
      ui.h("div", { class: "rec-sub" }, `${h.text[0].toUpperCase()}${h.text.slice(1)}.`))))));

    if (r.lines.length) {
      const row = (t) => ({ ...t, shown: signed(t.amount) });
      const rows = r.lines.map(row);
      root.append(ui.h("details", { class: "card fold fold-card", open: r.matches ? null : true },
        ui.h("summary", {}, ui.h("h2", {}, "The transactions in these days"), ui.h("span", { class: "fold-status" }, `${rows.length}`), ui.h("span", { class: "fold-chev" }, "›")),
        ui.h("p", { class: "muted small" }, "Compare them with the statement's lines; the balance after each should match the statement's where it prints one."),
        ui.h("ul", { class: "records only-narrow rc-lines" }, rows.map((t) => ui.h("li", {},
          ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t.payee || "No description"), ui.h("span", { class: "rec-value" }, t.shown)),
          ui.h("div", { class: "rec-sub" }, `${fmt.date(t.date)} · balance after: ${money(t.running)}`)))),
        ui.h("div", { class: "only-wide" }, ui.table([
          { key: "date", label: "Date", render: (t) => fmt.date(t.date) },
          { key: "payee", label: "Description", render: (t) => t.payee || "No description" },
          { key: "shown", label: "Amount", align: "right" },
          { key: "running", label: "Balance after", align: "right", render: (t) => money(t.running) },
        ], rows))));
    }
  }

  // saved reconciliations
  if (d.records.length) root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "Statements checked"), ui.h("span", { class: "fold-status" }, `${d.records.length}`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("ul", { class: "records" }, d.records.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.accountName), ui.h("span", { class: "rec-value" }, money(x.endBalance))),
      ui.h("div", { class: "rec-sub" }, `${fmt.date(x.from)} to ${fmt.date(x.to)} · ${x.lines} ${x.lines === 1 ? "transaction" : "transactions"} · checked ${x.at ? fmt.date(x.at) : ""}`),
      ui.h("div", { class: "rec-foot" }, ui.h("span", { class: "rec-actions" }, ui.button("Remove", () => {
        if (!ui.confirm(`Remove the check of ${x.accountName}'s statement from ${fmt.date(x.from)} to ${fmt.date(x.to)}? Your transactions stay as they are.`)) return;
        pending = "Removed. Your transactions are unchanged.";
        store.update((q) => { q.reconciliations = (q.reconciliations ?? []).filter((y) => y.id !== x.id); });
      }, { class: "secondary small" }))))))));
}
