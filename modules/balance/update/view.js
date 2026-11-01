// modules/balance/update/view.js -- DOM only. Every account in one list with its balance box; one Save at the bottom.
import { saveAll } from "./compute.js";

// The shell re-renders after store.update, so the confirmation waits here for the next render: { kind, text }.
let pending = null;

const STYLE = `
.bu-root .bu-list { display: grid; gap: 4px; margin-top: 4px; }
.bu-root .bu-row { padding: 10px 0; border-top: 1px solid var(--line); }
.bu-root .bu-row:first-child { border-top: 0; }
.bu-root .bu-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.bu-root .bu-name { font-weight: 650; }
.bu-root .bu-sub { color: var(--text-2); font-size: var(--fs-sm); }
.bu-root .bu-side { margin: 14px 0 4px; font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.bu-root .bu-save { margin-top: 16px; }
@media (min-width: 720px) { .bu-root .bu-list { grid-template-columns: 1fr 1fr; column-gap: 24px; } .bu-root .bu-row:nth-child(2) { border-top: 0; } }
`;

/** "today", "yesterday", "12 days ago", "about 3 months ago", "not dated" */
const age = (days) => days === null ? "not dated" : days === 0 ? "today" : days === 1 ? "yesterday" : days < 45 ? `${days} days ago` : days < 365 ? `about ${Math.round(days / 30.4)} months ago` : "over a year ago";

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const today = fmt.today();
  const d = ctx.computeOf("balance/update", { today });   // ctx.derived has no today, so no ages
  const wrap = ui.h("div", { class: "bu-root" }, ui.h("style", {}, STYLE));
  root.append(wrap);

  if (!d.count) {
    wrap.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Update my balances"),
      ui.h("p", { class: "lede" }, "Once your accounts are in the plan, this page brings every balance up to date in one go: type today's amounts, save once."),
      ui.h("p", { class: "muted small" }, "Start by adding your accounts: checking, savings, retirement, the mortgage and cards."),
      ui.row(ui.h("a", { href: "#/overview/setup", class: "btn" }, "Set up my plan"), ui.h("a", { href: "#/balance/net-worth", class: "btn secondary" }, "Add accounts on Net worth"))));
    return;
  }

  const head = ui.h("section", { class: "card" },
    ui.h("h1", {}, "Update my balances"),
    ui.h("p", { class: "lede" }, d.stale ? `${d.stale} of your ${d.count} balances ${d.stale === 1 ? "is" : "are"} more than a month old.` : `All ${d.count} balances are from the last month.`),
    ui.h("p", { class: "muted small" }, "Open each account's app or statement and type today's balance. A box you leave as it is counts as still right today. Save once at the bottom."));
  if (pending) {
    const n = ui.notice(pending.kind, pending.text);
    if (pending.kind === "ok") n.append(" ", ui.h("a", { href: "#/balance/net-worth" }, "See net worth ›"));
    head.append(n); pending = null;
  }
  wrap.append(head);

  const boxes = [];
  const rowOf = (r) => {
    const m = ui.moneyBox({ name: r.id, value: r.balance, min: r.debt ? 0 : undefined, label: `${r.name}: ${r.debt ? "amount owed" : "balance"}` });
    m.input.setAttribute("enterkeyhint", "next");
    boxes.push({ id: r.id, input: m.input });
    const when = r.stale ? ui.h("span", { class: "pill warn" }, r.days === null ? "not dated" : `updated ${age(r.days)}`) : ui.h("span", { class: "bu-sub" }, `updated ${age(r.days)}`);
    return ui.h("label", { class: "bu-row" },
      ui.h("div", { class: "bu-head" }, ui.h("span", { class: "bu-name" }, r.name), when),
      m.box,
      ui.h("div", { class: "bu-sub", style: { marginTop: "4px" } }, r.debt ? `${r.typeLabel}: what you still owe` : r.typeLabel));
  };
  const own = d.rows.filter((r) => !r.debt), owe = d.rows.filter((r) => r.debt);
  const form = ui.h("form", { class: "card", novalidate: null, onSubmit: (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const typed = Object.fromEntries(boxes.map((b) => [b.id, ui.moneyValue(b.input)]));
    let r = null;
    store.update((draft) => { r = saveAll(draft, typed, today); });
    if (!r || !r.saved) { pending = { kind: "error", text: "Nothing was saved: every box was empty. Type at least one balance, then save." }; return; }
    const kept = r.saved - r.changed;
    const move = r.before && r.netWorth !== null ? `, ${r.netWorth >= r.before.netWorth ? "up" : "down"} ${fmt.money(Math.abs(r.netWorth - r.before.netWorth), cur)} since ${fmt.date(r.before.date)}` : "";
    pending = { kind: "ok", text: `Balances saved for today: ${r.changed} changed${kept ? `, ${kept} still right` : ""}. Net worth is ${fmt.money(r.netWorth, cur)}${move}.` };
  } },
    own.length ? ui.h("h2", { class: "bu-side" }, "What you own") : null,
    ui.h("div", { class: "bu-list" }, own.map(rowOf)),
    owe.length ? ui.h("h2", { class: "bu-side" }, "What you owe") : null,
    ui.h("div", { class: "bu-list" }, owe.map(rowOf)),
    ui.h("div", { class: "bu-save" }, ui.h("button", { type: "submit" }, "Save all balances")),
    ui.h("p", { class: "muted small" }, "Each balance is dated today and kept in its account's history, and today's totals go on your net worth history."));
  // the phone keyboard's Next goes to the next box; on the last one it saves
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.target.matches?.("input")) return;
    const i = boxes.findIndex((b) => b.input === e.target);
    if (i >= 0 && i < boxes.length - 1) { e.preventDefault(); boxes[i + 1].input.focus(); boxes[i + 1].input.select?.(); }
  });
  boxes[boxes.length - 1]?.input.setAttribute("enterkeyhint", "done");
  wrap.append(form);
}
