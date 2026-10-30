// modules/cashflow/budget-percent/view.js -- DOM only. Income after tax split three ways (needs, wants, savings) against
// the 50/30/20 rule or the household's own split: a bar for each against its target, what to change first, the bills in
// each group (with a button to move one between needs and wants), and the split to aim for in a fold.
import { compute, PRESETS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let openFold = null;  // the fold just used stays open

const STYLE = `
.bp-root .bp-bar { position: relative; height: 12px; border-radius: 6px; background: var(--line); overflow: hidden; margin: 6px 0 2px; }
.bp-root .bp-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 6px; background: var(--accent); }
.bp-root .bp-fill.over { background: var(--warn); }
.bp-root .bp-mark { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--text); opacity: .55; }
.bp-root .bp-say { margin: 8px 0; }
`;
const PRESET_LABEL = { "50-30-20": "50 / 30 / 20 (the usual rule)", "60-20-20": "60 / 20 / 20 (high housing costs)", "70-20-10": "70 / 20 / 10 (getting by first)", own: "My own split" };

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "bp-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Needs, wants and savings"),
      ui.h("p", { class: "lede" }, "A simple way to check a budget: about half of what you take home after tax for the bills you must pay, up to 30% for everything else, and at least 20% saved."),
      ui.h("p", { class: "muted small" }, `It needs ${d.missing.map((m) => (m === "income" ? "what comes in (the Income page)" : "what you spend each month (the Expenses page)")).join(" and ")}.`),
      ui.row(...d.missing.map((m, i) => ui.h("a", { class: i ? "btn secondary" : "btn", href: m === "income" ? "#/cashflow/income" : "#/cashflow/expenses" }, m === "income" ? "Open Income" : "Open Expenses")))));
    return;
  }
  const short = d.saving.short > 0.5;
  if (short) root.append(ui.notice("warn", `${money(d.saving.short)} a month more goes out than comes in after tax, so the savings and goals below cannot all happen. Spend less, or put less toward goals for now.`));
  for (const n of d.notes) root.append(ui.notice("info", n));
  if (d.month.bizExpenses > 0.5) root.append(ui.notice("info", `Business income is counted after the ${money(d.month.bizExpenses * 12)} a year of business expenses on the Self-employment page.`));
  if (d.taxesListed > 0.5) root.append(ui.notice("info", `Taxes listed on Expenses (${money(d.taxesListed)} a month) are left out of needs: this page takes taxes off income already.`));

  // the month after tax and the three groups against their targets
  const m = d.month;
  const T = d.targets;
  const head = ui.card("Your month after tax", ui.row(
    ui.stat("After tax", money(m.afterTax), "a month, to split three ways"),
    ui.stat("Taxes", money(m.federal + m.payroll + m.state), `a month off ${money(m.gross)} of income`),
  ), ui.h("p", { class: "muted small" }, `${m.federal < -0.5 ? `Federal income tax: a credit of ${money(-m.federal)} (the refundable child tax credit)` : `Federal income tax ${money(m.federal)}`}, Social Security and Medicare ${money(m.payroll)}${m.state > 0.5 ? `, state ${money(m.state)}` : m.stateKnown ? ", no state income tax" : ", state not counted"}, a month. Aiming for ${pct(T.needs)} needs, ${pct(T.wants)} wants, ${pct(T.savings)} savings${T.from === "50-30-20" ? ", the 50/30/20 rule" : ""}.`));
  root.append(head);

  const split = m.afterTax > 0;   // nothing to split when taxes take everything: amounts only
  const records = ui.h("ul", { class: "records" }, d.buckets.map((b) => {
    const fill = Math.max(0, Math.min(1, b.share ?? 0));
    const bad = b.status === "over" || b.status === "under";
    return ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, b.label), ui.h("span", { class: "rec-value" }, b.share === null ? money(b.monthly) : `${pct(b.share)}`)),
      split ? ui.h("div", { class: "bp-bar", role: "img", "aria-label": `${b.label}: ${pct(b.share)} against ${pct(b.target)}` }, ui.h("div", { class: `bp-fill${bad ? " over" : ""}`, style: `width:${(fill * 100).toFixed(1)}%` }), ui.h("div", { class: "bp-mark", style: `left:calc(${(b.target * 100).toFixed(1)}% - 1px)` })) : null,
      ui.h("div", { class: "rec-sub" }, `${money(b.monthly)} a month${split ? `; the target ${pct(b.target)} is ${money(b.targetMonthly)}` : ""}.${b.key === "savings" ? ` Retirement ${money(d.saving.retirement)}, goals ${money(d.saving.goals)}${d.saving.leftover > 0.5 ? `, left over ${money(d.saving.leftover)}` : ""}.` : ""}`));
  }));
  const say = [];
  const by = Object.fromEntries(d.buckets.map((b) => [b.key, b]));
  if (short) say.push(`You spend ${money(d.saving.short)} a month more than you take home${split ? `: needs ${pct(by.needs.share)} and wants ${pct(by.wants.share)} leave too little for ${pct(T.savings)} saved` : ""}.`);
  if (split && by.needs.status === "over") say.push(`Must-pay bills take ${pct(by.needs.share)}, ${money(by.needs.gap)} a month above ${pct(T.needs)}. Your largest: ${d.needs.slice(0, 2).map((x) => `${x.name} ${money(x.monthly)}`).join(", ")}. Housing and car costs are usually the ones worth looking at.`);
  if (split && by.wants.status === "over") say.push(`Everything else takes ${pct(by.wants.share)}: trimming ${money(by.wants.gap)} a month reaches ${pct(T.wants)}. The largest: ${d.wants.slice(0, 3).map((x) => `${x.name} ${money(x.monthly)}`).join(", ")}.`);
  if (split && !short && by.savings.status === "under") say.push(`Savings reach ${pct(Math.max(0, by.savings.share))}: ${money(-by.savings.gap)} a month more would reach ${pct(T.savings)}.`);
  if (split && !say.length) say.push(`Within your split: needs ${pct(by.needs.share)}, wants ${pct(by.wants.share)}, savings ${pct(by.savings.share)}.`);
  root.append(ui.card("Needs, wants and savings", records, say.length ? ui.h("p", { class: "bp-say" }, ui.h("b", {}, say[0])) : null, ...say.slice(1).map((x) => ui.h("p", {}, x)),
    d.saving.unlisted ? ui.h("p", { class: "muted small" }, `${money(d.saving.leftover)} a month is neither on the Expenses page nor sent to savings, so it counts as saved. If it is really spent, list it on Expenses and this page will show where it goes.`) : null,
    ui.h("p", { class: "muted small" }, "Needs are the bills marked \"I must pay this\" on Expenses, with loan payments (from the Debts page when Expenses lists none); wants are the rest of the spending; savings are what goes into retirement accounts (your own money, not the employer's), goals and what is left. Taxes come off first, so taxes listed on Expenses are left out.")));

  // the bills in each group, with a button to move one across
  const move = (x, toNeed) => {
    openFold = toNeed ? "wants" : "needs";
    pending = `${x.name} now counts as a ${toNeed ? "need" : "want"}.`;
    store.update((q) => { const e = (q.expenses ?? []).find((y) => y.id === x.id); if (e) e.essential = toNeed; });
  };
  const list = (key, title, rows, toNeed) => ui.h("details", { class: "card fold fold-card", open: openFold === key || null },
    ui.h("summary", {}, ui.h("h2", {}, title), ui.h("span", { class: "fold-status" }, rows.length ? `${rows.length} ${rows.length === 1 ? "bill" : "bills"}, ${money(rows.reduce((t, x) => t + x.monthly, 0))} a month` : "none"), ui.h("span", { class: "fold-chev" }, "›")),
    rows.length ? ui.h("ul", { class: "records" }, rows.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.name), ui.h("span", { class: "rec-value" }, `${money(x.monthly)} a month`)),
      x.category && x.category !== x.name ? ui.h("div", { class: "rec-sub" }, x.category) : null,
      x.id ? ui.h("div", { class: "rec-foot" }, ui.button(toNeed ? "Count as a need" : "Count as a want", () => move(x, toNeed), { class: "secondary small" })) : ui.h("div", { class: "rec-sub" }, "From the minimum payments on the Debts page.")))) : ui.h("p", { class: "muted" }, "Nothing here yet."),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Open Expenses")));
  root.append(list("needs", "Needs: the bills you must pay", d.needs, false));
  root.append(list("wants", "Wants: everything else", d.wants, true));

  // the split to aim for
  const s = plan.whatIfs?.budgetPercent ?? {};
  const formError = (form, text) => { form.querySelector(".notice.error")?.remove(); form.prepend(ui.notice("error", text)); form.scrollIntoView({ block: "start" }); };
  const given = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const splitForm = ui.form([
    { key: "preset", label: "Split", type: "select", options: Object.entries(PRESET_LABEL).map(([value, label]) => ({ value, label })) },
    { key: "needs", label: "Needs (your own split)", type: "percent", min: 0, max: 100 },
    { key: "wants", label: "Wants (your own split)", type: "percent", min: 0, max: 100 },
    { key: "savings", label: "Savings (your own split)", type: "percent", min: 0, max: 100 },
  ], { preset: s.preset && (PRESETS[s.preset] || s.preset === "own") ? s.preset : "50-30-20", needs: s.needs ?? null, wants: s.wants ?? null, savings: s.savings ?? null }, (v) => {
    openFold = "split";
    if (v.preset === "own" && !["needs", "wants", "savings"].every((k) => given(v[k]))) return formError(splitForm, "Type all three shares for your own split, for example 55, 25 and 20.");
    const sum = (Number(v.needs) || 0) + (Number(v.wants) || 0) + (Number(v.savings) || 0);
    if (v.preset === "own" && !(sum > 0)) return formError(splitForm, "At least one share must be more than 0.");
    pending = v.preset === "own" && Math.abs(sum - 1) > 1e-6 ? `Saved. Your shares add up to ${Math.round(sum * 100)}%, so they are scaled to 100%: ${Math.round(100 * v.needs / sum)} / ${Math.round(100 * v.wants / sum)} / ${Math.round(100 * v.savings / sum)}.` : "Saved.";
    store.update((q) => { q.whatIfs = q.whatIfs ?? {}; q.whatIfs.budgetPercent = { preset: v.preset, needs: v.needs, wants: v.wants, savings: v.savings }; });
  }, { submitLabel: "Save" });
  root.append(ui.h("details", { class: "card fold fold-card", open: openFold === "split" || null }, ui.h("summary", {}, ui.h("h2", {}, "The split to aim for"), ui.h("span", { class: "fold-status" }, `${Math.round(T.needs * 100)} / ${Math.round(T.wants * 100)} / ${Math.round(T.savings * 100)}`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", { class: "muted small" }, "50/30/20 is a starting point, not a law: where housing costs a lot, 60/20/20 is common; while paying off debt or getting by, 70/20/10. For your own split, choose \"My own split\" and type the three shares."),
    splitForm));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Expenses"), ui.h("a", { class: "btn secondary", href: "#/cashflow/paycheck" }, "Paycheck"), ui.h("a", { class: "btn secondary", href: "#/cashflow/budget" }, "Spending limits by category"))));
}
