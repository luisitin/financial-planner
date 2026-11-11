// modules/balance/liquidity/view.js -- DOM only. The emergency-fund check: months of bills
// covered, the target, and every asset account sorted by how fast it turns into cash.
import { compute, TIERS } from "./compute.js";
import { saveAll } from "../update/compute.js";
import { cushionLater, monthWords } from "../../overview/next-best-action/compute.js";

// The shell re-renders after store.update, so the confirmation waits here for the next render: { step } (the move saved for).
let pending = null;
// an emergency goal, in the same words goals/emergency-fund looks for
const EMERGENCY = /emergency|rainy ?day|cushion/i;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// the app's list style, no comma before "and" ("Ally savings, Chase checking and Cash jar"), as namesIn and the other pages write it
const joinAnd = (list) => list.length < 3 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
const monthYear = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

export function render(root, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  // Whole months; one decimal only under 2 months, where the difference matters (design log 2026-09-15).
  // Just short of the target, one decimal rounded down, so "3 months" never stands beside "$914 to go" (core/words.js monthsNear;
  // j-first-family x-2, asked by claude-f)
  const months = (m) => m === null ? "-" : m >= 100 ? "100+" : m < 2 ? (Math.round(m * 10) / 10).toString()
    : m < d.targetMonths && Math.round(m) >= d.targetMonths ? (Math.floor(m * 10) / 10).toString() : String(Math.round(m));
  const monthsOf = (m) => `${months(m)} month${months(m) === "1" ? "" : "s"}`;
  // amounts that rest on our guesses of the bills you have to pay: to $100, as Next best action and Get started's cushion say them
  // "About 0 months" says nothing: with our guesses of the bills, no cash at all is "none yet", under a month is "under 1 month"
  const aboutMonths = (m) => (m === null ? "-" : m < 0.05 ? "None yet" : m < 1 ? "Under 1 month" : `About ${monthsOf(m)}`);
  const targetNote = () => ui.h("div", { class: "muted small" }, ui.h("p", { style: { margin: "0" } }, `The target is ${d.targetMonths} months of the bills you have to pay.`),
    ui.h("div", { class: "lq-links" }, ui.h("a", { href: "#/system/assumptions?show=emergencyMonths", class: "lq-link" }, "Change how many months \u203a"), ui.h("a", { href: "#/cashflow/expenses", class: "lq-link" }, "Choose which bills you have to pay \u203a")));
  const billMoney = (n) => fmt.money(d.waits ? Math.round(n / 100) * 100 : n, cur);

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
    const text = done ? `${lead} ${was.step === "starter" ? "One month of the bills you have to pay is covered" : `${d.targetMonths} months of the bills you have to pay are covered`} ✓`
      : `${lead} Your cash now covers ${monthsOf(d.runwayMonths)} of the bills you have to pay${step?.gap ? `; ${fmt.money(step.gap, cur)} more to go` : ""}.`;
    const n = ui.notice("ok", text);
    if (done && mv) n.append(" ", ui.h("a", { href: mv.href }, `Your next move: ${mv.title} ›`));
    // "count it as my emergency fund" changed the plan in one tap: the line says how to take it back (x-4)
    if (was.goalId) n.append(ui.h("div", { class: "row", style: { marginTop: "8px" } }, ui.button("Undo", () => {
      pending = { step: was.step, text: "Undone: that goal's money is kept for the goal again, not counted as your emergency fund." };
      store.update((p) => { const g = (p.goals ?? []).find((y) => y.id === was.goalId); if (g) g.isEmergencyFund = false; });
    }, { class: "secondary" })));
    root.append(n);
    // the card that was tapped is gone, so the line (and its Undo) is brought into view instead of left above the screen
    if (was.goalId) n.scrollIntoView({ block: "start" });
  }
  const nba = d.expenses ? ctx.computeOf?.("overview/next-best-action", { today }) : null;
  const move = nba?.ready && nba.next && (nba.next.id === "starter" || nba.next.id === "full-fund") && nba.next.gap >= 0.5 ? nba.next : null;
  // the move card goes right under the fund card: the owner put the fund card first, months as the headline (DESIGN_LOG
  // 2026-09-15, round 13, Finding 2), so the move follows it instead of pushing it down
  let moveCard = null;
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
      : spare >= move.gap ? ` This month's leftover covers it (${fmt.money(spare, cur)} after tax, bills and saving): keep ${fmt.money(move.gap, cur)} of it ${where}.`
      : ` Keep the ${fmt.money(spare, cur)} left over each month (after tax, bills and saving) ${where}${move.doneDate ? `, and you are there by about ${monthYear(move.doneDate)}` : ""}.`;
    const boxes = cash.map((a) => ({ a, m: ui.moneyBox({ name: a.id, value: Number(a.balance) || 0, label: `${a.name}: balance` }) }));
    for (const b of boxes) b.m.input.setAttribute("enterkeyhint", "done");
    const form = ui.h("form", { novalidate: null, onSubmit: (e) => {
      e.preventDefault();
      const typed = Object.fromEntries(boxes.map((b) => [b.a.id, ui.moneyValue(b.m.input)]));
      if (!Object.values(typed).some((x) => x !== null && x !== undefined && x !== "")) { form.querySelector(".lq-err")?.remove(); const n = ui.notice("error", "Nothing was saved: the box is empty. Type the new balance, then tap Save."); n.classList.add("lq-err"); form.append(n); return; }
      let r = null;
      pending = { step: move.id };
      store.update((draft) => { r = saveAll(draft, typed, today); });
      if (!r || !r.saved) pending = null;
    } },
      boxes.length ? ui.h("p", { class: "small", style: { margin: "12px 0 6px" } }, `When the money is in, type the new balance${cash.length === 1 ? "" : "s"}:`) : null,
      ...boxes.map((b) => ui.h("label", { class: "lq-row" }, ui.h("span", { class: "lq-name" }, b.a.name), b.m.box)),
      boxes.length ? ui.h("div", { style: { marginTop: "12px" } }, ui.h("button", { type: "submit" }, cash.length === 1 ? "Save the new balance" : "Save the new balances")) : ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth?add=savings&back=balance/liquidity" }, "Add a savings account")));
    const goalName = String(efGoal?.name ?? "").trim();
    const goalWords = goalName ? `your "${goalName}" goal` : "one of your goals (it has no name)";
    const goalOwn = goalName ? `the "${goalName}" goal's` : "that goal's";
    moveCard = ui.h("section", { class: "card", "aria-labelledby": "lq-move-h" },
      ui.h("h2", { id: "lq-move-h" }, move.id === "starter" ? "Your next move: one month of bills in cash" : `Your next move: ${d.targetMonths} months of bills in cash`),
      ui.h("p", {}, move.id === "starter"
        ? `${billMoney(move.gap)} more in cash you can use gets you to one month of the bills you have to pay (${billMoney(essential)}${d.waits ? ", by our guesses of them" : ""}).${when}`
        : `${billMoney(move.gap)} more in cash you can use gets you to ${d.targetMonths} months of the bills you have to pay (${billMoney(d.target)}${d.waits ? ", by our guesses of them" : ""}).${when}`),
      efGoal ? ui.h("div", { class: "notice info", style: { marginTop: "10px" } },
        ui.h("p", { style: { margin: 0 } }, `The money in ${joinAnd((efGoal.fundedBy ?? []).map((id) => d.accounts.find((a) => a.id === id)?.name).filter(Boolean))} is kept for ${goalWords}, so it is not counted in the months above. If you keep that money for emergencies, count it here too.`),
        ui.h("div", { style: { marginTop: "8px" } }, ui.button("Yes, count it as my emergency fund", () => {
          pending = { step: move.id, goalId: efGoal.id, text: `Done: ${goalOwn} money now counts as your emergency fund.` };
          store.update((p) => { const g = (p.goals ?? []).find((y) => y.id === efGoal.id); if (g) g.isEmergencyFund = true; });
        }, { class: "secondary" }), ui.h("span", { class: "small", style: { marginLeft: "10px" } }, "If not, leave it as it is."))) : null,
      form);
  }

  // the plan pays costly debt before the full cushion (Next best action's order): one month in cash is enough for now
  const later = (d.status === "bad" || d.status === "warn") ? cushionLater(nba) : null;
  const statusText = later ? "enough for now" : { ok: "covered", warn: "getting there", bad: "thin", unknown: "" }[d.status];
  // The fund card comes first with the months as the headline; the tiles follow.
  // While the bills you have to pay are mostly our guesses (d.waits, spec 8.1) the months are said "about", to one decimal, by our
  // guesses, with no pill and a calm bar: no green, amber or red, and no money move, rests on figures the person never gave.
  if (d.target && d.waits) {
    // (whole months, one decimal under 2: the owner's rule for this page, DESIGN_LOG 2026-09-15 round 13)
    root.append(ui.card("Emergency fund",
      ui.h("div", { class: "fund-head" },
        ui.h("div", {}, ui.h("div", { class: "stat-value" }, aboutMonths(d.runwayMonths)),
          ui.h("div", { class: "muted small" }, `by our guesses of the bills you have to pay; target: ${d.targetMonths} months`))),
      ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.round((d.fundedShare ?? 0) * 100)}%`, background: "var(--muted)" } })),
      ui.h("p", { class: "small" }, `Most of the bills you have to pay are our guesses for now, so how many months your cash covers isn't known yet. Type your real bills and we'll tell you ${d.gap > 0.5 ? "how much more you need" : "whether you have more than you need"}.`),
      ui.row(ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Type your bills on Expenses \u203a")),
      d.taxOwed > 0.5 ? ui.h("p", { class: "small" }, `${fmt.money(d.taxOwed, cur)} of your cash is this year's federal tax on what you have earned so far, not paid yet, so it is left out of your emergency fund.`) : null,
      targetNote(),
    ));
  } else if (d.target) {
    const above = d.now - d.target;
    root.append(ui.card("Emergency fund",
      ui.h("div", { class: "fund-head" },
        ui.h("div", {}, ui.h("div", { class: "stat-value" }, d.expenses ? `${monthsOf(d.runwayMonths)} covered` : fmt.money(d.now, cur)),
          ui.h("div", { class: "muted small" }, `target: ${d.targetMonths} months (${fmt.money(d.target, cur)})`)),
        ui.h("span", { class: `pill ${d.status === "ok" ? "ok" : "warn"}` }, statusText)),
      ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.round((d.fundedShare ?? 0) * 100)}%`, background: d.status === "ok" ? "var(--ok)" : d.status === "warn" || later ? "var(--warn)" : "var(--bad)" } })),
      later ? ui.h("p", { class: "small" }, `Your usable cash covers ${monthsOf(d.runwayMonths)} of the bills you have to pay: enough for now. Your plan puts the money left over each month on costly debt first${later.until ? `; once it is paid off (about ${monthWords(later.until)})` : "; after that"} it builds this to ${d.targetMonths} months.`) : null,
      later ? ui.row(ui.h("a", { class: "btn secondary", href: "#/debt/payoff" }, "Open my payoff plan")) : null,
      later ? null : ui.h("p", { class: "small" },
        d.status === "ok" ? `Your usable cash covers ${monthsOf(d.runwayMonths)} of the bills you have to pay; the plan aims for ${d.targetMonths}.${above > 0 ? ` About ${fmt.money(above, cur)} above the target could work harder elsewhere.` : ""}`
        : `Your usable cash covers ${monthsOf(d.runwayMonths)} of bills; the plan aims for ${d.targetMonths}. ${fmt.money(d.gap, cur)} more in savings gets you there.`),
      d.taxOwed > 0.5 ? ui.h("p", { class: "small" }, `${fmt.money(d.taxOwed, cur)} of your cash is this year's federal tax on what you have earned so far, not paid yet, so it is left out of your emergency fund. `, ui.h("a", { href: "#/taxes/estimated" }, d.tax?.overdue && !d.tax.paidTyped ? `No payments typed yet: type what you paid (if none, ${fmt.money(d.tax.overdue.amount, cur)} is past due)` : d.tax?.overdue ? `${fmt.money(d.tax.overdue.amount, cur)} is past due: pay it now` : d.tax?.nextDue ? `Next payment: ${fmt.money(d.tax.nextDue.amount, cur)} by ${fmt.date(d.tax.nextDue.due)}` : "Estimated payments"), ".") : null,
      targetNote(),
    ));
  }
  if (moveCard) root.append(moveCard);
  root.append(ui.card(null, ui.row(
    ui.stat("Usable today", fmt.money(d.now, cur), [TIERS.now.desc, d.earmarked ? `${fmt.money(d.earmarked, cur)} more is set aside for goals` : null, d.taxOwed > 0.5 ? `${fmt.money(d.taxOwed, cur)} more is this year's tax, not paid yet` : null].filter(Boolean).join("; ")),
    d.oneOffs > 0 ? ui.stat("After one-time costs", fmt.money(d.nowAfterOneOffs, cur), `${fmt.money(d.oneOffs, cur)} of one-time costs are coming up${d.runwayAfterOneOffs !== null ? `: ${monthsOf(d.runwayAfterOneOffs)} of the bills you have to pay after them` : ""}`) : null,
    d.expenses ? ui.stat("Months of bills covered", d.waits ? aboutMonths(d.runwayMonths) : months(d.runwayMonths), d.waits ? "by our guesses of your bills" : d.fullRunwayMonths !== null ? `${monthsOf(d.fullRunwayMonths)} of all spending` : null) : null,
    d.target ? ui.stat("Emergency fund target", billMoney(d.target), d.waits ? `${d.targetMonths} months of the bills you have to pay, by our guesses of them` : `${d.targetMonths} months of the bills you have to pay; ${d.gap ? `${fmt.money(d.gap, cur)} to go` : "you have it"}`) : null,
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
  root.append(ui.h("p", { class: "muted small" }, "Balances come from the accounts on ", ui.h("a", { href: "#/balance/net-worth", class: "lq-link" }, "Net worth"), "."), ui.row(ui.h("a", { href: "#/balance/update", class: "btn secondary" }, "Update my balances")));
  // scoped style for the fund headline row and the move's balance boxes
  root.append(ui.h("style", {}, ".fund-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 6px; } .fund-head .pill { margin-top: 6px; } .lq-links { display: flex; flex-direction: column; } .lq-link { display: inline-flex; align-items: center; min-height: 44px; } .lq-row { display: block; margin-top: 8px; } .lq-name { display: block; font-weight: 600; margin-bottom: 4px; }"));
}
