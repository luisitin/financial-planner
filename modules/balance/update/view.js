// modules/balance/update/view.js -- DOM only. Every account in one list with its balance box; one Save at the bottom.
import { saveAll, slipsIn } from "./compute.js";

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
.bu-root .bu-ask:not(:empty) { margin-bottom: 16px; }
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
    ui.h("p", { class: "lede" }, d.stale ? `${d.stale} of your ${d.count} balances ${d.stale === 1 ? "is" : "are"} more than a month old.` : (d.count === 1 ? "Your balance is from the last month." : `All ${d.count} balances are from the last month.`)),
    ui.h("p", { class: "muted small" }, "Open each account's app or statement and type today's balance. If you leave a box as it is, the app counts that balance as still right today. Save once at the bottom."));
  if (pending) {
    const n = ui.notice(pending.kind, pending.text);
    if (pending.kind === "ok") n.append(" ", ui.h("a", { href: "#/balance/net-worth" }, "See net worth ›"));
    // a history fix can be taken back (the plan as it was before the save)
    const was = pending.undo;
    if (was) n.append(" ", ui.button("Undo", () => { pending = { kind: "ok", text: "Put back as it was before that save." }; store.update((d) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, structuredClone(was)); }); }, { class: "secondary small" }));
    head.append(n); pending = null;
    // a loan or card just saved at $0 whose payment is still on Expenses: say so, one tap from stopping it (round 4)
    const ended = ctx.computeOf?.("cashflow/expenses", { today })?.ended ?? [];
    for (const x of ended) head.append(ui.notice("ok", `${x.debtName} is paid off. Its payment, ${x.name} (${fmt.money(x.monthly, cur)} a month), is still on Expenses. `, ui.h("a", { href: "#/cashflow/expenses" }, "Stop it there ›")));
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
  const ask = ui.h("div", { class: "bu-ask" });
  const saveBtn = ui.h("button", { type: "submit" }, "Save all balances");   // hidden while the typing-slip question is open
  let asked = false;
  const closeAsk = () => { ask.replaceChildren(); asked = false; saveBtn.style.display = ""; };
  const finish = (typed, corrections) => {
    let r = null;
    const before = corrections.length ? structuredClone(plan) : null;
    store.update((draft) => { r = saveAll(draft, typed, today, { corrections }); });
    if (!r || !r.saved) { pending = { kind: "error", text: "Nothing was saved: every box was empty. Type at least one balance, then save." }; return; }
    const kept = r.saved - r.changed - r.corrected;
    const move = r.before && r.netWorth !== null ? (Math.abs(r.netWorth - r.before.netWorth) < 0.5 ? `, the same as on ${fmt.date(r.before.date)}` : `, ${r.netWorth >= r.before.netWorth ? "up" : "down"} ${fmt.money(Math.abs(r.netWorth - r.before.netWorth), cur)} since ${fmt.date(r.before.date)}`) : "";
    const parts = [r.changed || (!r.corrected && !kept) ? `${r.changed} changed` : null, r.corrected ? `${r.corrected} typing mistake${r.corrected === 1 ? "" : "s"} fixed in the history` : null, kept ? `${kept} still right` : null].filter(Boolean);
    pending = { kind: "ok", text: `Balances saved for today: ${parts.join(", ")}. Net worth is ${fmt.money(r.netWorth, cur)}${move}.`, undo: before };
  };
  const form = ui.h("form", { class: "card", novalidate: null, onSubmit: (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const typed = Object.fromEntries(boxes.map((b) => [b.id, ui.moneyValue(b.input)]));
    // a new figure that looks like the one on file with a key slipped (11,500 against 115,000): ask before saving, so
    // fixing an old typo is not recorded as a fall in net worth
    const slips = slipsIn(plan, typed);
    if (asked) return;   // the question is open: only its own buttons save (Enter on the last box used to save as "it changed")
    if (slips.length) {
      const one = slips.length === 1;
      const m = (n) => fmt.money(n, cur);
      const fixBtn = ui.button("Let me fix what I typed", () => { closeAsk(); const b = boxes.find((x) => x.id === slips[0].id); b?.input.focus(); b?.input.select?.(); }, { class: "secondary" });
      // "it changed" is the default answer: a real change can look like a slip (a card paid from $6,400 to $640), and the
      // other answer rewrites the history; with several, each account gets its own answer (review 2026-11-02)
      if (one) ask.replaceChildren(ui.notice("warn", `${slips[0].name}: ${m(slips[0].was)} on file, ${m(slips[0].now)} typed. Did it change, or was ${m(slips[0].was)} a typing slip?`),
        ui.h("div", { class: "row" },
          ui.button("It changed", () => finish(typed, [])),
          ui.button(`${m(slips[0].was)} was a mistake`, () => finish(typed, [slips[0].id]), { class: "secondary" }),
          fixBtn),
        ui.h("p", { class: "muted small" }, "A mistake on file is fixed in the history too, so net worth does not show a fall (or a jump) that never happened. You can undo it."));
      else {
        const wrong = new Set();
        const rowFor = (x) => {
          const chips = ui.h("div", { class: "chips", role: "group", "aria-label": x.name });
          const draw = () => chips.replaceChildren(
            ui.h("button", { type: "button", class: `chip${wrong.has(x.id) ? "" : " on"}`, "aria-pressed": wrong.has(x.id) ? "false" : "true", onClick: () => { wrong.delete(x.id); draw(); } }, "It changed"),
            ui.h("button", { type: "button", class: `chip${wrong.has(x.id) ? " on" : ""}`, "aria-pressed": wrong.has(x.id) ? "true" : "false", onClick: () => { wrong.add(x.id); draw(); } }, `${m(x.was)} was a mistake`));
          draw();
          return ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.name)), ui.h("div", { class: "rec-sub" }, `${m(x.was)} on file, ${m(x.now)} typed`), chips);
        };
        ask.replaceChildren(ui.notice("warn", "Some new figures look like a typing slip next to the one on file. For each: did it change, or was the one on file a mistake?"),
          ui.h("ul", { class: "records" }, slips.map(rowFor)),
          ui.h("div", { class: "row" }, ui.button("Save all balances", () => finish(typed, [...wrong])), fixBtn),
          ui.h("p", { class: "muted small" }, "A mistake on file is fixed in the history too, so net worth does not show a fall (or a jump) that never happened. You can undo it."));
      }
      asked = true; saveBtn.style.display = "none";
      ask.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    finish(typed, []);
  } },
    own.length ? ui.h("h2", { class: "bu-side" }, "What you own") : null,
    ui.h("div", { class: "bu-list" }, own.map(rowOf)),
    owe.length ? ui.h("h2", { class: "bu-side" }, "What you owe") : null,
    ui.h("div", { class: "bu-list" }, owe.map(rowOf)),
    ui.h("div", { class: "bu-save" }, ask, saveBtn),
    ui.h("p", { class: "muted small" }, "Each balance is dated today and kept in its account's history, and today's totals go on your net worth history."));
  // the phone keyboard's Next goes to the next box; on the last one it saves
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.target.matches?.("input")) return;
    const i = boxes.findIndex((b) => b.input === e.target);
    if (i >= 0 && i < boxes.length - 1) { e.preventDefault(); boxes[i + 1].input.focus(); boxes[i + 1].input.select?.(); }
  });
  boxes[boxes.length - 1]?.input.setAttribute("enterkeyhint", "done");
  // a figure changed while the question is open: the question was about the old figures, so it closes (Save asks again)
  form.addEventListener("input", () => { if (asked) closeAsk(); });
  wrap.append(form);
}
