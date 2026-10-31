// modules/ai/categorizer/view.js -- DOM only. Sort many transactions at once with the AI: choose the payees not filed
// yet or every payee, ask (in questions of 40 payee names), then review what it suggests with how sure it is and
// whether it differs from what is filed. File the sure ones in one tap, or row by row with your own choice; each
// filed payee gets a rule for future imports. The AI's answers stay on this page until you accept them.
//
// One ask runs at a time. It owns its state (`running`), and every render draws it (Ask off, Stop, the progress line),
// so a redraw mid-ask (a scope or filter tap, a filing, leaving and coming back) never loses it. The loop writes only
// its progress line, found afresh each time; how it ended goes in `note`, shown by the next render.
import { compute, groupsFor, batches, promptFor, readAnswer, review, applyChoices, needsLook, replaces, SCOPES } from "./compute.js";
import { categoriesOf, categoryById, categoryLabel } from "../../transactions/categories/compute.js";

let pending = null;      // the confirmation shown on the next render
let pendingError = null; // what went wrong filing, shown on the next render
let note = null;         // how the last ask ended: { kind, text, detail?, links? }, shown on the next render
let scope = "open";
let answers = {};        // payee key -> { category, confidence, fits }, kept while the app is open
let chosen = {};         // payee key -> the category picked in that row's list (both layouts read it)
let filedHere = new Set();   // payees filed from this page since they were last asked about: not "unanswered"
let asked = { open: false, all: false };   // an ask that ran to the end in that scope
let filter = "all";      // all | look | sure
let running = null;      // the ask in progress: { stop, scope, done, total, part, parts }
let live = null;         // the render on screen: { page, root, ctx }
let nextKey = null;      // the row to bring into view after filing one

const STYLE = `
.cz-root .cz-why { font-size: var(--fs-sm); color: var(--muted); }
.cz-root .cz-why.cz-check { color: var(--warn); }
.cz-root .rec-foot { flex-wrap: wrap; gap: 8px; }
.cz-root .rec-foot select { flex: 1 1 180px; min-height: 44px; }
.cz-root td { white-space: normal; overflow-wrap: anywhere; }
.cz-root td:first-child { min-width: 160px; }
.cz-root td select { min-height: 44px; min-width: 150px; max-width: 200px; }
.cz-root .cz-act { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.cz-root .pill { margin-left: 0; white-space: nowrap; }
.cz-root .cz-sum { margin-top: 12px; }
.cz-root .chip:disabled { opacity: .45; cursor: not-allowed; }
.cz-root .cz-float { position: sticky; top: calc(var(--topbar) + 8px); z-index: 5; box-shadow: var(--shadow-lg); }
`;
const BAND_WORDS = { sure: "Sure", fairly: "Fairly sure", unsure: "Unsure" };
const BAND_PILL = { sure: "ok", fairly: "", unsure: "warn" };
const WHY = {
  "income-out": "Money going out, but the AI says income: check it.",
  "spending-in": "Money coming in, but the AI says spending: a refund?",
  other: "The AI chose \"Other\", which it picks when it is not sure: choose a better one if you can.",
};
const NO_ANSWER = "The AI gave no answer it could use for these payees. Try again, or file them by hand.";
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** A category's name on this page: the two built-in "Other"s say which one they are. */
function nameOf(plan, id) {
  const c = categoryById(plan, id);
  if (c && c.label === "Other" && c.kind !== "transfer") return c.kind === "income" ? "Other money in" : "Other spending";
  return categoryLabel(plan, id);
}

/** Draw the page again with the latest plan, unless the person has left it. */
function rerender() {
  if (!live?.root?.isConnected) return;
  const { page, ctx } = live;
  page.replaceChildren();
  render(page, { ...ctx, plan: ctx.store.get() });
}

const progressText = (run) => run.stop ? "Stopping after this question…"
  : !run.parts ? "Checking that the AI helper is on…"
  : `Asking the AI about ${plural(run.total, "payee", "payees")}${run.parts > 1 ? ` (part ${run.part + 1} of ${run.parts})` : ""}… On a home PC this can take a minute or two.`;
function showProgress(run) {
  const el = live?.root?.isConnected ? live.root.querySelector(".cz-progress") : null;
  if (el) el.textContent = progressText(run);
}

async function ask(ctx) {
  if (running) return;
  const { ai, store } = ctx;
  const run = running = { stop: false, scope, done: 0, total: 0, part: 0, parts: 0 };
  note = null;
  rerender();
  let st = "off";
  try { st = await ai.status(); } catch { st = "unreachable"; }
  if (!String(st).startsWith("on")) {
    if (running === run) running = null;
    note = {
      kind: "warn",
      text: st === "off" ? "The AI helper is turned off. Turn it on in Settings, then come back."
        : st === "no models" ? "The AI helper is running but has no model downloaded yet. Settings shows how to add one."
        : "The AI helper on your PC does not answer. Check that it is running, then try again.",
      links: [["Open Settings", "#/system/settings"], ["File them by hand", "#/transactions/categorize"]],
    };
    rerender();
    return;
  }
  const qs = batches(groupsFor(store.get(), run.scope));
  for (const q of qs) for (const g of q) filedHere.delete(g.key);
  run.total = qs.reduce((t, q) => t + q.length, 0); run.parts = qs.length;
  let got = 0, failed = null, i = 0;
  try {
    for (; i < qs.length && !run.stop; i++) {
      run.part = i;
      showProgress(run);
      try {
        const p = promptFor(store.get(), qs[i]);
        const res = await ai.chat([{ role: "system", content: p.system }, { role: "user", content: p.user }]);
        const a = readAnswer(store.get(), res?.content, qs[i]);
        got += Object.keys(a).length;
        answers = { ...answers, ...a };
        run.done += qs[i].length;
      } catch (e) { failed = e?.message ?? String(e); break; }
    }
  } finally {
    if (running === run) running = null;
  }
  const finished = !failed && i >= qs.length;
  if (finished) asked[run.scope] = true;
  const kept = got === 1 ? "1 answer is kept below" : `${got} answers are kept below`;
  note = failed ? (got
      ? { kind: "error", text: `The AI stopped answering partway. ${kept}; tap "Ask again" for the rest.`, detail: failed }
      : { kind: "error", text: "The AI stopped answering. Try again in a minute; if it keeps happening, open Settings and check the AI helper.", detail: failed })
    : !finished ? { kind: "info", text: got ? `Stopped. ${kept}; tap "Ask again" for the rest.` : "Stopped before the AI answered." }
    : !got && run.total ? { kind: "info", text: NO_ANSWER, links: [["File them by hand", "#/transactions/categorize"]] }
    : null;
  rerender();
}

function drawNote(ui, n) {
  return ui.h("div", { class: `notice ${n.kind}` }, ui.h("div", {}, n.text),
    n.detail ? ui.h("details", { class: "notice-details" }, ui.h("summary", {}, "Show details"), ui.h("ul", {}, ui.h("li", {}, n.detail))) : null,
    n.links?.length ? ui.row(n.links.map(([label, href]) => ui.h("a", { class: "btn secondary small", href }, label))) : null);
}

/** The confirmation after filing, in plain words. */
function filedText(q, res) {
  const parts = [];
  if (res.transactions) parts.push(`Filed ${plural(res.transactions, "transaction", "transactions")} from ${plural(res.payees, "payee", "payees")}${!res.overwritten ? "" : res.transactions === 1 ? "; it was filed another way before" : res.overwritten === res.transactions ? "; all of them were filed another way before" : `; ${res.overwritten} of them were filed another way before`}.`);
  else parts.push("Nothing changed: those transactions already had that category.");
  if (res.skipped) parts.push(`${res.skipped === 1 ? "1 was" : `${res.skipped} were`} given a category in the meantime and left as ${res.skipped === 1 ? "it is" : "they are"}.`);
  const added = res.rules - res.rulesChanged.length;
  if (added > 0) parts.push(`${added === 1 ? "A rule files" : `${added} rules file`} future imports the same way.`);
  for (const c of res.rulesChanged) parts.push(`Your rule for "${c.contains}" now files as ${nameOf(q, c.to)} (it was ${nameOf(q, c.from)}).`);
  if (res.rulesKept) parts.push(res.rulesKept === 1 ? "A rule you already had files that payee another way; it was left as it is." : `${res.rulesKept} rules you already had file those payees another way; they were left as they are.`);
  if (res.rulesSkipped) parts.push("No rule was saved for payments through a service like PayPal or Square, because future imports cannot tell those shops apart.");
  return parts.join(" ");
}

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta?.currency;
  const d = compute(plan);
  const root = ui.h("div", { class: "cz-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  live = { page, root, ctx };
  // after filing one row the page scrolls on to the next, so the confirmation floats at the top for a few seconds
  if (pending) { const n = ui.notice("ok", pending); if (nextKey) n.classList.add("cz-float"); root.append(n); setTimeout(() => n.remove(), 5000); pending = null; }
  if (pendingError) { root.append(ui.notice("error", pendingError)); pendingError = null; }

  if (!d.total) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Sort many transactions at once"),
      ui.h("p", { class: "lede" }, "Once your bank's transactions are in the app, the AI helper on your PC can suggest a category for every payee at once and say how sure it is. You check the list and file them in a few taps."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"))));
    return;
  }

  const groups = groupsFor(plan, scope);
  const r = review(plan, groups.filter((g) => !filedHere.has(g.key)), answers);
  const s = r.summary;
  const cats = categoriesOf(plan);
  const money = (v) => fmt.money(v, cur, "en-US", 2);
  const busy = !!running;

  // the page's question
  const status = ui.h("div", { class: "cz-status" });
  if (note) { status.append(drawNote(ui, note)); note = null; }
  const actions = [];
  if (groups.length) {
    // once there are answers, filing is the main action and asking again the second
    actions.push(ui.button(`Ask ${s.answered ? "again" : "the AI"} about ${plural(groups.length, "payee", "payees")}`, () => ask(ctx), { disabled: busy ? true : null, class: s.answered ? "secondary" : null }));
    if (busy) {
      const stopBtn = ui.button("Stop", () => { const run = running; if (!run) return; run.stop = true; stopBtn.disabled = true; showProgress(run); }, { class: "secondary", disabled: running.stop ? true : null });
      actions.push(stopBtn);
    }
  } else if (scope === "open" && d.scopes.all) {
    actions.push(ui.button("Have the AI check what you filed", () => { scope = "all"; rerender(); }, { class: "secondary", disabled: busy ? true : null }));
  }
  const scopeChips = ui.h("div", { class: "chips", role: "group", "aria-label": "Which payees" }, Object.entries(SCOPES).map(([k, label]) =>
    ui.h("button", { type: "button", class: `chip${scope === k ? " on" : ""}`, "aria-pressed": scope === k ? "true" : "false", disabled: busy ? true : null, onClick: () => { if (running) return; scope = k; rerender(); } }, `${label} (${d.scopes[k]})`)));
  const scopeText = scope === "open"
    ? (d.open ? `${plural(d.open, "transaction has", "transactions have")} no category yet, from ${plural(d.scopes.open, "payee", "payees")}.`
      : d.scopes.all ? "Every transaction has a category, so there is nothing to sort. You can have the AI look over what you filed."
      : "Every transaction is a transfer between your own accounts, so there is nothing to sort.")
    : (d.scopes.all ? `Every payee, filed or not (${d.scopes.all}), so you can see where the AI would choose differently. Money you marked as a transfer between your own accounts is left out.`
      : "Every transaction is a transfer between your own accounts, so there is nothing to check.");
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Sort many transactions at once"),
    ui.h("p", { class: "muted small" }, "The AI helper suggests a category for each payee and says how sure it is. It sees only the payee names, with numbers taken out (never amounts, dates or accounts), and nothing changes until you file."),
    scopeChips,
    ui.h("p", { class: "muted small" }, scopeText),
    actions.length ? ui.row(actions) : null,
    ui.h("p", { class: "muted small cz-progress", "aria-live": "polite" }, busy ? progressText(running) : ""),
    status));

  if (!s.answered) return;

  // the answers
  const choiceOf = (x) => chosen[x.key] ?? x.suggested;
  const file = (rows, what) => {
    const choices = rows.map((x) => ({ key: x.key, ids: x.ids, rawPayee: x.rawPayee, category: choiceOf(x) }));
    const n = rows.reduce((t, x) => t + x.count, 0);
    if (what === "all" && !ui.confirm(`File ${plural(n, "transaction", "transactions")} from ${plural(rows.length, "payee", "payees")} as shown in the list? Future imports from them will be filed the same way.`)) return;
    if (what === "one") {
      const x = rows[0], c = choiceOf(x);
      if (replaces(x, c) && !ui.confirm(changeText(x, c))) return;
      const i = shown.findIndex((y) => y.key === x.key);
      nextKey = (shown[i + 1] ?? shown[i - 1])?.key ?? null;
    }
    store.update((q) => {
      const res = applyChoices(q, choices, { uid: ui.uid, today: fmt.today(), ...(what === "all" ? { keepRules: true, onlyUnfiled: true } : {}) });
      for (const k of res.filedKeys) { delete answers[k]; delete chosen[k]; filedHere.add(k); }
      if (res.payees) { pending = filedText(q, res); return; }
      nextKey = null;   // stay at the top, where the error shows
      pendingError = res.unknown ? "Nothing was filed: that category no longer exists. Pick another one in the list and tap File."
        : res.skipped ? "Nothing was filed: those transactions were given a category in the meantime."
        : "Nothing was filed: those transactions have changed since the AI answered. Ask again to see them as they are now.";
    });
  };
  // one tap files only sure answers that fit the money, for payees not filed yet; changing what is filed is row by row
  const sureRows = r.rows.filter((x) => x.band === "sure" && x.isNew && x.fits);
  root.append(ui.card("What the AI suggests",
    ui.row(ui.stat("Sure", String(s.sure), "80% sure or more"), ui.stat("Fairly sure", String(s.fairly), "50% to 79%"), ui.stat("Unsure", String(s.unsure), "under 50%")),
    ui.h("p", { class: "muted small cz-sum" }, [
      s.isNew ? `${s.isNew} not filed yet` : null,
      s.differ ? `${s.differ} where it would choose differently from you` : null,
      s.partly ? `${s.partly} filed the same way, with some not filed yet` : null,
      s.agree ? `${s.agree} where it agrees with you` : null,
      s.unanswered ? (asked[scope] ? `${s.unanswered} it gave no answer for` : `${s.unanswered} not asked about yet`) : null,
    ].filter(Boolean).join(", ") + ". How sure it says it is comes from the AI itself: check the unsure ones."
      + (s.unanswered && !asked[scope] ? " Tap \"Ask again\" to include them." : "")),
    sureRows.length ? ui.row(ui.button(`File the ${sureRows.length} sure ${sureRows.length === 1 ? "one" : "ones"} not filed yet`, () => file(sureRows, "all"))) : null));

  // the review list
  const looks = r.rows.filter(needsLook).length;
  const chips = ui.h("div", { class: "chips", role: "group", "aria-label": "Show" }, [["all", `All (${r.rows.length})`], ["look", `Needs a look (${looks})`], ["sure", `Sure (${s.sure})`]].map(([k, label]) =>
    ui.h("button", { type: "button", class: `chip${filter === k ? " on" : ""}`, "aria-pressed": filter === k ? "true" : "false", onClick: () => { filter = k; rerender(); } }, label)));
  const shown = r.rows.filter((x) => filter === "all" || (filter === "sure" ? x.band === "sure" : needsLook(x)));
  const byKind = (k) => cats.filter((c) => c.kind === k);
  const opt = (c, value) => ui.h("option", { value: c.id, selected: c.id === value ? true : null }, `${c.icon} ${nameOf(plan, c.id)}`);
  const pick = (x) => {
    const value = choiceOf(x);
    const inn = ui.h("optgroup", { label: "Money in" }, byKind("income").map((c) => opt(c, value)));
    const out = ui.h("optgroup", { label: "Money out" }, byKind("expense").map((c) => opt(c, value)));
    return ui.h("select", { "aria-label": `Category for ${x.payee}`, "data-pick": x.key, onChange: (e) => choose(x, e.target.value) },
      x.in ? [inn, out] : [out, inn], byKind("transfer").map((c) => opt(c, value)));
  };
  const btnLabel = (x) => (replaces(x, choiceOf(x)) ? (x.count === 1 ? "Change it" : `Change all ${x.count}`) : "File");
  // a choice in one layout shows in the other, and the button says whether it replaces what is filed
  function choose(x, value) {
    chosen[x.key] = value;
    for (const el of root.querySelectorAll("[data-pick]")) if (el.dataset.pick === x.key) el.value = value;
    for (const el of root.querySelectorAll("[data-act]")) if (el.dataset.act === x.key) el.textContent = btnLabel(x);
  }
  const filedAs = (x) => {
    const ways = Object.entries(x.byCat).sort((a, b) => b[1] - a[1]);
    const list = ways.length > 1 ? ways.map(([c, n]) => `${nameOf(plan, c)} (${n})`).join(", ") : nameOf(plan, x.filed);
    return `${list}${x.unfiled ? `, ${x.unfiled} not filed yet` : ""}`;
  };
  const nowText = (x) => (x.isNew ? "Not filed yet" : `Filed as ${filedAs(x)}`);
  function changeText(x, c) {
    const them = x.count === 1 ? "it" : "them";
    return `${x.count === 1 ? `File this ${x.payee} transaction` : `File all ${x.count} ${x.payee} transactions`} as ${nameOf(plan, c)}? You filed ${them} as ${filedAs(x)}. The rule for ${x.payee} changes too, so future imports follow.`;
  }
  const pill = (x) => ui.h("span", { class: `pill ${BAND_PILL[x.band]}` }, `${BAND_WORDS[x.band]} · ${Math.round(x.confidence * 100)}%`);
  const counts = (x) => `${plural(x.count, "transaction", "transactions")}, ${x.in ? "+" : "−"}${money(Math.abs(x.total))}`;
  const says = (x) => (x.agrees ? `The AI agrees with how you filed it: ${nameOf(plan, x.suggested)}.`
    : `The AI says ${nameOf(plan, x.suggested)}. ${nowText(x)}.${x.rename ? ` Will show as "${x.rename}".` : ""}`);
  const why = (x) => (x.why && !x.agrees ? ui.h("div", { class: "cz-why cz-check" }, WHY[x.why]) : null);
  const action = (x) => (x.agrees ? null : [pick(x), ui.button(btnLabel(x), () => file([x], "one"), { class: "secondary small", "data-act": x.key })]);
  const records = ui.h("ul", { class: "records only-narrow" }, shown.map((x) => ui.h("li", { "data-key": x.key },
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.payee), ui.h("span", { class: "rec-value" }, pill(x))),
    ui.h("div", { class: "rec-sub" }, says(x)),
    why(x),
    ui.h("div", { class: "rec-sub" }, `${counts(x)} in all`),
    x.agrees ? null : ui.h("div", { class: "rec-foot" }, action(x)))));
  const table = ui.h("div", { class: "only-wide" }, ui.table([
    { key: "payee", label: "Payee", render: (x) => ui.h("span", {}, x.payee, ui.h("div", { class: "cz-why" }, counts(x)), x.rename && !x.agrees ? ui.h("div", { class: "cz-why" }, `Will show as "${x.rename}".`) : null, why(x)) },
    { key: "filed", label: "Now", render: nowText },
    { key: "band", label: "How sure", render: pill },
    { key: "act", label: "File as", render: (x) => (x.agrees ? ui.h("span", { class: "cz-why" }, "The AI agrees with how you filed it.") : ui.h("span", { class: "cz-act" }, action(x))) },
  ], shown, { empty: "Nothing to show here." }));
  table.querySelectorAll("tbody tr").forEach((tr, i) => { if (shown[i]) tr.dataset.key = shown[i].key; });
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Check and file"), chips,
    ui.h("p", { class: "muted small" }, "Change the category if the AI is wrong, then File. Filing gives every transaction from that payee the category, tidies its name, and saves a rule so future imports file themselves."),
    ui.h("p", { class: "muted small" }, "Paying off your own card or moving money to savings is not spending: choose Transfer between my accounts."),
    shown.length ? [records, table] : ui.h("p", { class: "muted" }, filter === "sure" ? "No sure answers to show." : "Nothing needs a look.")));

  if (nextKey) {
    const k = nextKey; nextKey = null;
    setTimeout(() => [...root.querySelectorAll("[data-key]")].find((el) => el.dataset.key === k && el.getClientRects().length)?.scrollIntoView({ block: "center" }), 0);
  }
}
