// modules/balance/liquidity/view.js -- DOM only. The emergency-fund check: months of bills
// covered, the target, and every asset account sorted by how fast it turns into cash.
import { compute, TIERS } from "./compute.js";
import { saveAll } from "../update/compute.js";

// The shell re-renders after store.update, so the confirmation waits here for the next render: { step } (the move saved for).
let pending = null;
// an emergency goal, in the same words goals/emergency-fund looks for
const EMERGENCY = /emergency|rainy ?day|cushion/i;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthYear = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

export function render(root, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  // Whole months; one decimal only under 2 months, where the difference matters (design log 2026-09-15).
  const months = (m) => m === null ? "-" : m >= 100 ? "100+" : m < 2 ? (Math.round(m * 10) / 10).toString() : String(Math.round(m));
  const monthsOf = (m) => `${months(m)} month${months(m) === "1" ? "" : "s"}`;

  if (!d.accounts.length) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "How long could you last?"),
      ui.h("p", { class: "lede" }, "This page shows how many months of bills the cash you can reach would cover, and whether your emergency fund is big enough. It needs two things: your accounts and your expenses."),
      ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add your accounts"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Add your expenses")),
    ));
    return;
  }

  const today = fmt.today();
  // The Dashboard's next move is often the cushion ("Keep one month of bills in cash", "Build your cushion to 6 months").
  // Then this page starts with that move: how much more, when the money left over each month gets there, and the
  // cash accounts' balance boxes to type the new amounts once the money is moved (dated today, as Update my balances does).
  if (pending) {
    const was = pending; pending = null;
    const nba = ctx.computeOf?.("overview/next-best-action", { today });
    const step = nba?.ready ? nba.steps.find((x) => x.id === was.step) : null;
    const mv = ctx.computeOf?.("overview/setup", { today, screen: "done" })?.standing?.moves?.[0] ?? null;
    const done = step && step.status === "done";
    const lead = was.text ?? "Saved.";
    const text = done ? `${lead} ${was.step === "starter" ? "One month of must-pay bills is covered" : `${d.targetMonths} months of must-pay bills are covered`} ✓`
      : `${lead} Your cash now covers ${monthsOf(d.runwayMonths)} of must-pay bills${step?.gap ? `; ${fmt.money(step.gap, cur)} more to go` : ""}.`;
    const n = ui.notice("ok", text);
    if (done && mv) n.append(" ", ui.h("a", { href: mv.href }, `Your next move: ${mv.title} ›`));
    root.append(n);
  }
  const nba = d.expenses ? ctx.computeOf?.("overview/next-best-action", { today }) : null;
  const move = nba?.ready && nba.next && (nba.next.id === "starter" || nba.next.id === "full-fund") && nba.next.gap > 0 ? nba.next : null;
  if (move) {
    const spare = Math.max(0, nba.spare.monthly);
    const essential = d.expenses?.essentialMonthly ?? 0;
    // money put in an account a goal saves in counts for that goal, not the cushion (F-020), so the boxes are the cash
    // accounts no goal claims; a goal that is the emergency fund itself can be counted as the cushion in one tap (F-034's
    // opt-in, the same tick as on goals/emergency-fund)
    const claimed = new Set((plan.goals ?? []).filter((g) => !g.isEmergencyFund).flatMap((g) => g.fundedBy ?? []));
    const cash = d.accounts.filter((a) => a.tier === "now" && !claimed.has(a.id));
    const into = cash.find((a) => a.type === "savings") ?? cash[0] ?? null;
    const efGoal = d.earmarked > 0 ? (plan.goals ?? []).find((g) => !g.isEmergencyFund && (EMERGENCY.test(g.name ?? "") || g.icon === "🛟") && (g.fundedBy ?? []).some((id) => d.accounts.some((a) => a.id === id && a.tier === "now"))) ?? null : null;
    // the cushion grows from the money left over each month, kept in savings rather than spent
    const where = into ? (into.type === "savings" ? `in ${into.name}` : `in ${into.name} and leave it unspent`) : "in a savings account no goal uses";
    const when = !spare ? ` Once the month leaves money over, keep it ${where}.`
      : spare >= move.gap ? ` This month's left-over covers it (${fmt.money(spare, cur)} after tax, bills and saving): keep ${fmt.money(move.gap, cur)} of it ${where}.`
      : ` Keep the ${fmt.money(spare, cur)} left over each month (after tax, bills and saving) ${where}${move.doneDate ? `, and you are there by about ${monthYear(move.doneDate)}` : ""}.`;
    const boxes = cash.map((a) => ({ a, m: ui.moneyBox({ name: a.id, value: Number(a.balance) || 0, label: `${a.name}: balance` }) }));
    for (const b of boxes) b.m.input.setAttribute("enterkeyhint", "done");
    const form = ui.h("form", { novalidate: null, onSubmit: (e) => {
      e.preventDefault();
      const typed = Object.fromEntries(boxes.map((b) => [b.a.id, ui.moneyValue(b.m.input)]));
      let r = null;
      pending = { step: move.id };
      store.update((draft) => { r = saveAll(draft, typed, today); });
      if (!r || !r.saved) pending = null;
    } },
      boxes.length ? ui.h("p", { class: "small", style: { margin: "12px 0 6px" } }, `When the money is in, type the new balance${cash.length === 1 ? "" : "s"}:`) : null,
      ...boxes.map((b) => ui.h("label", { class: "lq-row" }, ui.h("span", { class: "lq-name" }, b.a.name), b.m.box)),
      boxes.length ? ui.h("div", { style: { marginTop: "12px" } }, ui.h("button", { type: "submit" }, cash.length === 1 ? "Save the new balance" : "Save the new balances")) : ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add a savings account")));
    root.append(ui.h("section", { class: "card", "aria-labelledby": "lq-move-h" },
      ui.h("h2", { id: "lq-move-h" }, move.id === "starter" ? "Your next move: one month of bills in cash" : `Your next move: ${d.targetMonths} months of bills in cash`),
      ui.h("p", {}, move.id === "starter"
        ? `${fmt.money(move.gap, cur)} more in cash you can use gets you to one month of must-pay bills (${fmt.money(essential, cur)}).${when}`
        : `${fmt.money(move.gap, cur)} more in cash you can use gets you to ${d.targetMonths} months of must-pay bills (${fmt.money(d.target, cur)}).${when}`),
      efGoal ? ui.h("div", { class: "notice info", style: { marginTop: "10px" } },
        ui.h("p", { style: { margin: 0 } }, `Your "${efGoal.name}" goal saves in ${(efGoal.fundedBy ?? []).map((id) => d.accounts.find((a) => a.id === id)?.name).filter(Boolean).join(" and ")}, so that money counts as set aside for the goal, not as your cushion. If that goal is your cushion, count it:`),
        ui.h("div", { style: { marginTop: "8px" } }, ui.button(`Count "${efGoal.name}" as my cushion`, () => {
          pending = { step: move.id, text: `Done: the "${efGoal.name}" goal's money now counts as your emergency fund.` };
          store.update((p) => { const g = (p.goals ?? []).find((y) => y.id === efGoal.id); if (g) g.isEmergencyFund = true; });
        }, { class: "secondary" }))) : null,
      form));
  }

  const statusText = { ok: "covered", warn: "getting there", bad: "thin", unknown: "" }[d.status];
  // The fund card comes first with the months as the headline; the tiles follow.
  if (d.target) {
    const above = d.now - d.target;
    root.append(ui.card("Emergency fund",
      ui.h("div", { class: "fund-head" },
        ui.h("div", {}, ui.h("div", { class: "stat-value" }, d.expenses ? `${monthsOf(d.runwayMonths)} covered` : fmt.money(d.now, cur)),
          ui.h("div", { class: "muted small" }, `target: ${d.targetMonths} months (${fmt.money(d.target, cur)})`)),
        ui.h("span", { class: `pill ${d.status === "ok" ? "ok" : "warn"}` }, statusText)),
      ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.round((d.fundedShare ?? 0) * 100)}%`, background: d.status === "ok" ? "var(--ok)" : d.status === "warn" ? "var(--warn)" : "var(--bad)" } })),
      ui.h("p", { class: "small" },
        d.status === "ok" ? `Your usable cash covers ${monthsOf(d.runwayMonths)} of must-pay bills; the plan aims for ${d.targetMonths}.${above > 0 ? ` About ${fmt.money(above, cur)} above the target could work harder elsewhere.` : ""}`
        : `Your usable cash covers ${months(d.runwayMonths)} of the ${d.targetMonths} months the plan aims for. ${fmt.money(d.gap, cur)} more in savings gets you there.`),
      ui.h("p", { class: "muted small" }, "The target is months x your must-pay expenses. Change the months on the Assumptions page; mark expenses as must-pay on the Expenses page."),
    ));
  }
  root.append(ui.card(null, ui.row(
    ui.stat("Usable today", fmt.money(d.now, cur), d.earmarked ? `${TIERS.now.desc}; ${fmt.money(d.earmarked, cur)} more is set aside for goals` : TIERS.now.desc),
    d.oneOffs > 0 ? ui.stat("After one-time costs", fmt.money(d.nowAfterOneOffs, cur), `${fmt.money(d.oneOffs, cur)} of one-time costs are coming up${d.runwayAfterOneOffs !== null ? `: ${monthsOf(d.runwayAfterOneOffs)} of must-pay bills after them` : ""}`) : null,
    d.expenses ? ui.stat("Months of must-pay bills", months(d.runwayMonths), d.fullRunwayMonths !== null ? `${monthsOf(d.fullRunwayMonths)} of all spending` : null) : null,
    d.target ? ui.stat("Emergency fund target", fmt.money(d.target, cur), `${d.targetMonths} months of must-pay bills; ${d.gap ? `${fmt.money(d.gap, cur)} to go` : "you have it"}`) : null,
    ui.stat("Sellable within a week", fmt.money(d.week, cur), TIERS.week.desc),
  )));
  for (const w of d.warnings) root.append(ui.notice("info", w));

  for (const [tier, t] of Object.entries(TIERS)) {
    const rows = d.accounts.filter((a) => a.tier === tier);
    if (!rows.length) continue;
    root.append(ui.card(t.label,
      ui.h("p", { class: "muted small" }, t.desc),
      ui.h("ul", { class: "page-list" }, rows.map((a) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, a.name), ui.h("div", { class: "d" }, [a.typeLabel, a.institution].filter(Boolean).join(" · "))),
        ui.h("span", { class: "st" }, fmt.money(a.balance, cur))))),
    ));
  }
  root.append(ui.h("p", { class: "muted small" }, "Balances come from your accounts on the Net worth page."), ui.row(ui.h("a", { href: "#/balance/update", class: "btn secondary" }, "Update my balances")));
  // scoped style for the fund headline row and the move's balance boxes
  root.append(ui.h("style", {}, ".fund-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 6px; } .fund-head .pill { margin-top: 6px; } .lq-row { display: block; margin-top: 8px; } .lq-name { display: block; font-weight: 600; margin-bottom: 4px; }"));
}
