// modules/transactions/reconcile/view.js -- DOM only. Check a bank or card statement against the ledger: pick the
// account, type the statement's first and last day and its starting and ending balance, and see whether the lines on
// file add up to the same change. A gap comes with what could explain it, and a link to the page that fixes it; a
// match can be saved, so the next statement starts where this one ended. Pressing Check changes nothing; only
// "Save as checked" and "Remove" change the plan.
import { compute, reconcile, recordOf, saveRecord, nextStart } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let input = null;     // { accountId, from, to, startBalance, endBalance } as last checked, kept while the app is open

const STYLE = `
.rc-root .rc-lines { margin: 6px 0 0; }
.rc-root .rec-sub b { font-weight: 600; }
.rc-root td.align-right, .rc-root th.align-right { white-space: nowrap; }
.rc-root .rc-save { margin-top: 12px; }
.rc-root .rc-result > .row + p, .rc-root .rc-result > .row + .notice { margin-top: 12px; }
.rc-root .rc-result, .rc-root > .notice { scroll-margin-top: calc(var(--topbar) + 8px); }
.rc-root .rc-hints .rec-foot { justify-content: flex-start; }
`;

/** The page that fixes each kind of hint ("edge" and "start" need none: the bank's dates, or the form above). */
const ACTIONS = {
  twice: [["Open Duplicates", () => "#/transactions/duplicates"]],
  missing: [["Import a bank file", () => "#/transactions/import"], ["Add it by hand", (a) => `#/transactions/ledger/account/${a}`]],
  extra: [["Open the Ledger", (a) => `#/transactions/ledger/account/${a}`]],
  sign: [["Open the Ledger", (a) => `#/transactions/ledger/account/${a}`]],
  pair: [["Open the Ledger", (a) => `#/transactions/ledger/account/${a}`]],
  elsewhere: [["Open the Ledger", (a) => `#/transactions/ledger/account/${a}`]],
};

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta?.currency;
  const d = compute(plan);
  const root = ui.h("div", { class: "rc-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 5000); pending = null; }
  const money = (v) => fmt.money(v, cur, "en-US", 2);
  const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v))}`;
  const days = (from, to) => `${fmt.date(from)} to ${fmt.date(to)}`;

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
    { key: "startBalance", label: "Starting balance", type: "money", required: true, help: acct?.liability ? "called \"Previous balance\" on most card statements: what you owed on the first day. Numbers only, like 640.22; if the card owed you money, put a minus in front." : "often called \"Beginning balance\". Numbers only, like 2103.77; a minus if the account was overdrawn." },
    { key: "to", label: "Last day on the statement", type: "date", required: true },
    { key: "endBalance", label: "Ending balance", type: "money", required: true, help: acct?.liability ? "called \"New balance\": what you owed on the last day" : "often called \"Ending balance\"" },
  ], input, (v) => {
    input = { ...v };
    rerender();
    page.querySelector(".rc-result, .rc-root > .notice.error")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, { submitLabel: "Check" });
  // no decimal keypad on the balances: a phone's decimal keypad has no minus key
  for (const k of ["startBalance", "endBalance"]) form.querySelector(`input[name=${k}]`)?.removeAttribute("inputmode");
  form.querySelector("select[name=accountId]")?.addEventListener("change", (e) => { input = fresh(e.target.value); rerender(); });
  const last = acct?.last;
  const prefilled = !!last && input.from === nextStart(plan, acct.id)?.from;
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Your statement"),
    ui.h("p", { class: "muted small" }, "Pick the account, then type four things from its statement: the first and last day, and the balance at the start and at the end. The page adds up your transactions in the app for the same days and compares. Pressing Check doesn't change your plan."),
    last ? ui.h("p", { class: "muted small" }, `Last statement checked: ${days(last.from, last.to)}, ending at ${money(last.endBalance)}.${prefilled ? " The first day and starting balance below are filled in from it; make sure they match your new statement." : ""}`) : null,
    form));

  const r = input.to ? reconcile(plan, input) : null;
  if (r && !r.ready) root.append(ui.notice("error", r.why === "dates" ? "The last day must be on or after the first day. Check both dates on the statement." : "Type both balances from the statement."));
  if (r?.ready) {
    const n = r.lines.length;
    const differ = r.liability ? (r.gap > 0 ? "the statement says you owe more" : "the statement says you owe less") : (r.gap > 0 ? "the statement ends higher" : "the statement ends lower");
    const same = r.overlaps.filter((x) => x.same), other = r.overlaps.filter((x) => !x.same);
    root.append(ui.h("section", { class: "card rc-result" }, ui.h("h2", {}, r.matches ? "Your transactions match the statement" : "Your transactions and the statement don't agree"),
      ui.row(
        ui.stat("Change on the statement", signed(r.statementChange), r.liability ? `you owed ${money(r.startBalance)}, then ${money(r.endBalance)}` : `${money(r.startBalance)} to ${money(r.endBalance)}`),
        ui.stat("Change in your transactions", signed(r.ledgerChange), `${n} ${n === 1 ? "transaction" : "transactions"} from ${days(input.from, input.to)}`),
        ui.stat("Difference", money(Math.abs(r.gap)), r.matches ? "they agree to the cent" : differ)),
      r.minus ? ui.h("p", { class: "muted small" }, "You typed the balances with a minus sign; they are read as what you owe, as in the rest of the app.") : null,
      r.liability ? ui.h("p", { class: "muted small" }, "For a card or loan the balance is what you owe: spending raises it, payments lower it, so a minus here means you owe less.") : null,
      !r.matches && n && r.newest && r.newest < input.to ? ui.h("p", { class: "muted small" }, `The newest ${acct.name} transaction in the app is from ${fmt.date(r.newest)}; anything after that isn't counted yet.`) : null,
      r.matches && same.length ? ui.notice("info", `You saved this statement as checked before${same[0].at ? ` (on ${fmt.date(same[0].at)})` : ""}. Saving again replaces it.`) : null,
      r.matches && other.length ? ui.notice("warn", `You already checked a statement for some of these days (${other.map((x) => days(x.from, x.to)).join(" and ")}). Saving keeps both.`) : null,
      r.matches ? ui.h("div", { class: "row rc-save" }, ui.button("Save as checked", () => {
        const rec = recordOf(r, input, { id: ui.uid(), today: fmt.today() });
        pending = `Saved: ${acct.name}'s statement from ${days(input.from, input.to)} is checked. The next one is ready to fill in below.`;
        input = { accountId: acct.id, fresh: true };   // set before the update: the shell draws the page again after it
        store.update((q) => { q.reconciliations = saveRecord(q.reconciliations, rec); });
      })) : null));

    if (!r.matches && !n) root.append(ui.h("div", { class: "notice warn" },
      ui.h("div", {}, `There are no ${acct.name} transactions in the app from ${days(input.from, input.to)}. Bring in this statement's transactions first, then check again.`),
      ui.h("div", { class: "row rc-save" }, ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"))));
    else if (!r.matches) {
      const titleOf = (h) => {
        if (h.ids.length) return h.ids.map((id) => r.lines.find((t) => t.id === id) ?? (plan.transactions ?? []).find((t) => t.id === id)).filter(Boolean).map((t) => `${t.payee || "No description"}, ${fmt.date(t.date)}`).join(" and ");
        if (h.kind === "swap") return "Two digits swapped?";
        if (h.kind === "start") return "The starting balance?";
        return r.hints.length > 1 ? "None of these? Something missing from the app" : "Something missing from the app?";
      };
      // a line's own amount is shown signed, as the ledger stores it; so is the missing line; a typed balance's slip is a size
      const valueOf = (h) => (!h.amount ? "" : h.ids.length || h.kind === "missing" ? signed(h.amount) : money(Math.abs(h.amount)));
      const linksOf = (h) => {
        const on = h.kind === "elsewhere" ? (plan.transactions ?? []).find((t) => t.id === h.ids[0])?.accountId ?? acct.id : acct.id;
        const list = h.kind === "swap" && h.ids.length ? ACTIONS.extra : ACTIONS[h.kind];
        return list ? ui.h("div", { class: "rec-foot" }, ui.h("span", { class: "rec-actions" }, list.map(([label, href]) => ui.h("a", { class: "btn secondary small", href: href(on) }, label)))) : null;
      };
      root.append(ui.card("What could explain it", ui.h("ul", { class: "records rc-hints" }, r.hints.map((h) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, titleOf(h)), ui.h("span", { class: "rec-value" }, valueOf(h))),
        ui.h("div", { class: "rec-sub" }, `${h.text[0].toUpperCase()}${h.text.slice(1)}.`),
        linksOf(h))))));
    }

    if (n) {
      const owe = r.liability;
      const rows = r.lines.map((t) => ({ ...t, shown: signed(t.amount) }));
      root.append(ui.h("details", { class: "card fold fold-card", open: r.matches ? null : true },
        ui.h("summary", {}, ui.h("h2", {}, `Transactions from ${days(input.from, input.to)}`), ui.h("span", { class: "fold-status" }, `${rows.length}`), ui.h("span", { class: "fold-chev" }, "›")),
        ui.h("p", { class: "muted small" }, `Go down the statement and find each of these on it. Where the statement prints a balance, the balance at the end of each day here should match it.${owe ? " A card's statement usually shows purchases without a minus and payments with one; here they are the other way round, as money out of and into your pocket." : ""}`),
        ui.h("ul", { class: "records only-narrow rc-lines" }, rows.map((t) => ui.h("li", {},
          ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t.payee || "No description"), ui.h("span", { class: "rec-value" }, t.shown)),
          ui.h("div", { class: "rec-sub" }, `${fmt.date(t.date)}${t.dayEnd ? ` · ${owe ? "you owe at the end of the day" : "balance at the end of the day"}: ${money(t.running)}` : ""}`)))),
        ui.h("div", { class: "only-wide" }, ui.table([
          { key: "date", label: "Date", render: (t) => fmt.date(t.date) },
          { key: "payee", label: "Description", render: (t) => t.payee || "No description" },
          { key: "shown", label: "Amount", align: "right" },
          { key: "running", label: owe ? "You owe at day's end" : "Balance at day's end", align: "right", render: (t) => (t.dayEnd ? money(t.running) : "") },
        ], rows))));
    }
  }

  // saved reconciliations
  if (d.records.length) root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "Statements checked"), ui.h("span", { class: "fold-status" }, `${d.records.length}`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("ul", { class: "records" }, d.records.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.accountName)),
      ui.h("div", { class: "rec-sub" }, `${days(x.from, x.to)} · ended at ${money(x.endBalance)}${x.liability ? " owed" : ""} · ${x.lines} ${x.lines === 1 ? "transaction" : "transactions"}${x.at ? ` · checked ${fmt.date(x.at)}` : ""}`),
      ui.h("div", { class: "rec-foot" }, ui.h("span", { class: "rec-actions" }, ui.button("Remove", () => {
        const latest = d.accounts.find((y) => y.id === x.accountId)?.last?.id === x.id;
        if (!ui.confirm(`Remove the check of ${x.accountName}'s statement from ${days(x.from, x.to)}? Your transactions stay as they are${latest ? "; the next statement will no longer start from this one" : ""}.`)) return;
        // the form was filled in from this check and nothing was checked yet: fill it in again without it
        if (latest && input?.accountId === x.accountId && !input.to) input = { accountId: x.accountId, fresh: true };
        pending = `Removed the check of ${x.accountName}'s statement. Your transactions are unchanged.`;
        store.update((q) => { q.reconciliations = (q.reconciliations ?? []).filter((y) => y.id !== x.id); });
      }, { class: "secondary small" }))))))));
}
