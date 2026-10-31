// modules/ai/categorizer/view.js -- DOM only. Sort many transactions at once with the AI: choose the payees not filed
// yet or every payee, ask (in questions of 40 payee names), then review what it suggests with how sure it is and
// whether it differs from what is filed. File the sure ones in one tap, or row by row with your own choice; each
// filed payee gets a rule for future imports. The AI's answers stay on this page until you accept them.
import { compute, groupsFor, batches, promptFor, readAnswer, review, applyChoices, SCOPES } from "./compute.js";
import { categoriesOf, categoryLabel } from "../../transactions/categories/compute.js";

let pending = null;      // the confirmation shown on the next render
let scope = "open";
let answers = {};        // payee key -> { category, confidence }, kept while the app is open
let asked = { open: false, all: false };
let filter = "all";      // all | sure | look
let running = null;      // { stop: bool } while asking

const STYLE = `
.cz-root .cz-why { font-size: var(--fs-sm); color: var(--muted); }
.cz-root .rec-foot { flex-wrap: wrap; gap: 8px; }
.cz-root .rec-foot select { flex: 1 1 180px; min-height: 44px; }
.cz-root td select { min-height: 44px; min-width: 170px; max-width: 220px; }
.cz-root .pill { margin-left: 0; white-space: nowrap; }
`;
const BAND_WORDS = { sure: "Sure", fairly: "Fairly sure", unsure: "Unsure" };
const BAND_PILL = { sure: "ok", fairly: "", unsure: "warn" };

export function render(page, ctx) {
  const { ui, fmt, plan, store, ai } = ctx;
  const cur = plan.meta?.currency;
  const d = compute(plan);
  const root = ui.h("div", { class: "cz-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 5000); pending = null; }

  if (!d.total) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Sort many transactions at once"),
      ui.h("p", { class: "lede" }, "Once your bank's transactions are in the app, the AI helper on your PC can suggest a category for every payee at once and say how sure it is. You check the list and file them in a few taps."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"))));
    return;
  }

  const groups = groupsFor(plan, scope);
  const r = review(plan, groups, answers);
  const s = r.summary;
  const cats = categoriesOf(plan).filter((c) => c.kind !== "transfer");
  const money = (v) => fmt.money(v, cur, "en-US", 2);

  // the page's question
  const status = ui.h("div", {});
  const progress = ui.h("p", { class: "muted small", "aria-live": "polite" });
  // once there are answers, filing is the main action and asking again the second
  const askBtn = ui.button(groups.length ? `Ask ${s.answered ? "again" : "the AI"} about ${groups.length} ${groups.length === 1 ? "payee" : "payees"}` : "Nothing to ask", () => ask(), { disabled: groups.length ? null : true, class: s.answered ? "secondary" : null });
  const stopBtn = ui.button("Stop", () => { if (running) running.stop = true; }, { class: "secondary" });
  const askRow = ui.row(askBtn);
  const scopeChips = ui.h("div", { class: "chips", role: "group", "aria-label": "Which payees" }, Object.entries(SCOPES).map(([k, label]) =>
    ui.h("button", { type: "button", class: `chip${scope === k ? " on" : ""}`, "aria-pressed": scope === k ? "true" : "false", onClick: () => { scope = k; rerender(); } }, `${label} (${d.scopes[k]})`)));
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Sort many transactions at once"),
    ui.h("p", { class: "muted small" }, "The AI helper suggests a category for each payee and says how sure it is. It sees only the payee names (never amounts, dates or accounts), and nothing changes until you file."),
    scopeChips,
    ui.h("p", { class: "muted small" }, scope === "open"
      ? (d.open ? `${d.open} ${d.open === 1 ? "transaction has" : "transactions have"} no category yet, from ${d.scopes.open} ${d.scopes.open === 1 ? "payee" : "payees"}.` : "Every transaction already has a category. Choose \"Recheck everything\" to have the AI look over what is filed.")
      : `Every payee, filed or not (${d.scopes.all}), so you can see where the AI would file something differently. Transfers between your own accounts are left out.`),
    askRow, progress, status));

  // a new render (scope chip) without a store change
  function rerender() { page.replaceChildren(); render(page, ctx); }

  async function ask() {
    status.replaceChildren();
    let st = "off";
    try { st = await ai.status(); } catch { st = "unreachable"; }
    if (!String(st).startsWith("on")) {
      status.append(ui.h("div", { class: "notice warn" }, ui.h("p", {}, st === "off" ? "The AI helper is turned off. Turn it on in Settings, then come back." : "The AI helper does not answer. Is it running on your PC? Settings shows how it is set up."),
        ui.row(ui.h("a", { class: "btn secondary small", href: "#/system/settings" }, "Open Settings"), ui.h("a", { class: "btn secondary small", href: "#/transactions/categorize" }, "File them by hand"))));
      return;
    }
    const qs = batches(groups);
    running = { stop: false };
    askBtn.disabled = true; askRow.append(stopBtn);
    let got = 0, failed = null;
    for (let i = 0; i < qs.length && !running.stop; i++) {
      progress.textContent = `Asking… ${Math.min(groups.length, i * qs[0].length)} of ${groups.length} payees so far.`;
      try {
        const p = promptFor(plan, qs[i]);
        const res = await ai.chat([{ role: "system", content: p.system }, { role: "user", content: p.user }]);
        const a = readAnswer(plan, res?.content);
        got += Object.keys(a).length;
        answers = { ...answers, ...a };
      } catch (e) { failed = e?.message ?? String(e); break; }
    }
    const stopped = running.stop;
    running = null; asked[scope] = true;
    const msg = failed ? `The AI stopped answering (${failed}). ${got ? `${got} answers are kept below; ask again for the rest.` : "Check the AI section in Settings, or try again."}`
      : stopped ? `Stopped. ${got} ${got === 1 ? "answer" : "answers"} kept below.` : null;
    rerender();
    if (msg) page.querySelector(".cz-status")?.append(ui.notice(failed ? "error" : "info", msg));
  }
  status.classList.add("cz-status");

  if (!s.answered) {
    if (asked[scope] && groups.length) status.append(ui.notice("info", "The AI gave no answer it could use for these payees. Try again, or file them by hand on the Categorise page."));
    return;
  }

  // the answers
  const file = (rows, what) => {
    const choices = rows.map((x) => ({ ids: x.ids, rawPayee: x.rawPayee, category: x.choice ?? x.suggested }));
    const n = rows.reduce((t, x) => t + x.count, 0);
    if (what === "all" && !ui.confirm(`File ${n} ${n === 1 ? "transaction" : "transactions"} from ${rows.length} ${rows.length === 1 ? "payee" : "payees"} as the AI suggests? Future imports from them will be filed the same way.`)) return;
    for (const x of rows) delete answers[x.key];   // before the update: the shell draws the page again inside it
    store.update((q) => {
      const res = applyChoices(q, choices, { uid: ui.uid, today: fmt.today() });
      const rules = res.rulesAdded + res.rulesChanged;
      pending = `Filed ${res.transactions} ${res.transactions === 1 ? "transaction" : "transactions"} from ${res.payees} ${res.payees === 1 ? "payee" : "payees"}${rules ? `; ${rules === 1 ? "a rule files" : `${rules} rules file`} future imports the same way` : ""}.`;
    });
  };
  // one tap files only sure answers for payees not filed yet; changing what is already filed is done row by row
  const sureRows = r.rows.filter((x) => x.band === "sure" && x.isNew);
  root.append(ui.card("What the AI suggests",
    ui.row(ui.stat("Sure", String(s.sure), "80% sure or more"), ui.stat("Fairly sure", String(s.fairly), "50% to 79%"), ui.stat("Unsure", String(s.unsure), "under 50%")),
    ui.h("p", { class: "muted small" }, [
      s.isNew ? `${s.isNew} not filed yet` : null,
      s.differ ? `${s.differ} filed differently now` : null,
      s.agree ? `${s.agree} the same as now` : null,
      s.unanswered ? `${s.unanswered} it gave no answer for` : null,
    ].filter(Boolean).join(", ") + ". How sure it says it is comes from the AI itself: check the unsure ones."),
    sureRows.length ? ui.row(ui.button(`File the ${sureRows.length} sure ${sureRows.length === 1 ? "one" : "ones"} not filed yet`, () => file(sureRows, "all"))) : null));

  // the review list
  const chips = ui.h("div", { class: "chips", role: "group", "aria-label": "Show" }, [["all", "All"], ["look", "Needs a look"], ["sure", "Sure"]].map(([k, label]) =>
    ui.h("button", { type: "button", class: `chip${filter === k ? " on" : ""}`, "aria-pressed": filter === k ? "true" : "false", onClick: () => { filter = k; rerender(); } }, label)));
  const shown = r.rows.filter((x) => filter === "all" || (filter === "sure" ? x.band === "sure" : x.band !== "sure" || (!x.isNew && !x.agrees)));
  const optionsFor = (x) => (x.in ? [...cats.filter((c) => c.kind === "income"), ...cats.filter((c) => c.kind !== "income")] : cats).map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }));
  const pill = (x) => ui.h("span", { class: `pill ${BAND_PILL[x.band]}` }, `${BAND_WORDS[x.band]} · ${Math.round(x.confidence * 100)}%`);
  const filedText = (x) => (x.isNew ? "Not filed yet" : `Filed as ${categoryLabel(plan, x.filed)}${x.ways > 1 ? " and other ways" : ""}${x.unfiled ? `, ${x.unfiled} not filed yet` : ""}`);
  const action = (x) => {
    if (x.agrees) return ui.h("span", { class: "cz-why" }, "Same as now");
    const sel = ui.select(optionsFor(x), x.suggested, { "aria-label": `Category for ${x.payee}` });
    return [sel, ui.button("File", () => file([{ ...x, choice: sel.value }], "one"), { class: "secondary small" })];
  };
  const records = ui.h("ul", { class: "records only-narrow" }, shown.map((x) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.payee), ui.h("span", { class: "rec-value" }, pill(x))),
    ui.h("div", { class: "rec-sub" }, `The AI says ${x.label}. ${filedText(x)}.`),
    ui.h("div", { class: "rec-sub" }, `${x.count} ${x.count === 1 ? "transaction" : "transactions"}, ${x.in ? "+" : "−"}${money(Math.abs(x.total))} in all`),
    ui.h("div", { class: "rec-foot" }, action(x)))));
  const table = ui.h("div", { class: "only-wide" }, ui.table([
    { key: "payee", label: "Payee", render: (x) => ui.h("span", {}, x.payee, ui.h("div", { class: "cz-why" }, `${x.count} ${x.count === 1 ? "transaction" : "transactions"}, ${x.in ? "+" : "−"}${money(Math.abs(x.total))}`)) },
    { key: "filed", label: "Now", render: filedText },
    { key: "label", label: "The AI says" },
    { key: "band", label: "How sure", render: pill },
    { key: "act", label: "", render: (x) => ui.h("span", { style: { display: "flex", gap: "8px", alignItems: "center" } }, action(x)) },
  ], shown, { empty: "Nothing to show here." }));
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Check and file"), chips,
    ui.h("p", { class: "muted small" }, "Change the category if the AI is wrong, then File. Filing gives every transaction from that payee the category and saves a rule so future imports file themselves."),
    shown.length ? [records, table] : ui.h("p", { class: "muted" }, filter === "sure" ? "No sure answers to show." : "Nothing needs a look.")));
}
