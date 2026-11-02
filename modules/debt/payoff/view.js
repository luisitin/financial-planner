// modules/debt/payoff/view.js -- DOM only. Pick the extra and the order; see when each debt
// ends, the interest, and the three orders side by side.
import { compute, offer as offerFor } from "./compute.js";
import { ORDERS } from "../../../core/math/payoff.js";

const monthYear = (iso) => { const dt = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return Number.isNaN(dt.getTime()) ? String(iso) : dt.toLocaleDateString(undefined, { month: "long", year: "numeric" }); };
let pending = null;   // confirmation kept across the shell re-render

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const monthsText = (m) => !Number.isFinite(m) ? "never" : m < 12 ? `${m} month${m === 1 ? "" : "s"}` : `${Math.floor(m / 12)} year${Math.floor(m / 12) === 1 ? "" : "s"}${m % 12 ? ` ${m % 12} month${m % 12 === 1 ? "" : "s"}` : ""}`;

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Pay off your debts"),
      ui.h("p", { class: "lede" }, "Put every loan and card on one plan: the same money each month, the smallest balance or the highest rate first, and the date each one is gone. It needs each debt's interest rate and required payment."),
      d.missing.length ? ui.h("p", { class: "muted small" }, `Missing rate or payment: ${d.missing.join(", ")}.`) : null,
      ui.row(ui.h("a", { class: "btn", href: "#/balance/liabilities" }, d.missing.length ? "Add the rates and payments" : "Add your debts"))));
    return;
  }
  const c = d.chosen;
  // The Dashboard's next move sends people here with an amount already worked out (Next best action's left-over after tax,
  // bills and saving). Until an extra has been saved, offer that amount and the date it gives, so the move is one tap.
  const nba = !d.extraSaved ? ctx.computeOf?.("overview/next-best-action", { today: fmt.today() }) : null;
  const step = nba?.ready && nba.next && (nba.next.id === "high-debt" || nba.next.id === "mid-debt") ? nba.next : null;
  const of = step ? offerFor(plan, { today: fmt.today(), amount: nba.spare.monthly, stepId: step.id }) : null;
  const offered = !!of;
  const namesOf = (ts) => ts.length === 1 ? `the ${ts[0].name}` : ts.length === 2 ? `the ${ts[0].name} and the ${ts[1].name}` : `the ${ts.length} costly debts`;
  // an extra aimed at some debts (from the offer) goes to them until they are paid off, then stops
  const aimedNames = (x) => namesOf(x.targets.map((id) => x.debts.find((y) => y.id === id)).filter(Boolean));
  const aimedEnd = (x) => x.targets.map((id) => x.chosen.debts.find((y) => y.id === id)?.endDate).filter(Boolean).sort().pop() ?? null;
  // what the month's payment is made of: the minimums, extras already set on the Debts page, and the extra chosen here
  const extraPart = (x) => x.targets.length ? `${fmt.money(x.extra, cur)} more on ${aimedNames(x)}${aimedEnd(x) ? ` until about ${monthYear(aimedEnd(x))}` : ""}` : `${fmt.money(x.extra, cur)} more from this plan`;
  const paySplit = (x) => x.alreadyExtra > 0 || x.extra > 0 ? `(${[`${fmt.money(x.required, cur)} required`, x.alreadyExtra > 0 ? `${fmt.money(x.alreadyExtra, cur)} extra set on the Debts page` : null, x.extra > 0 ? extraPart(x) : null].filter(Boolean).join(", ")})` : "(the required payments)";
  const heroTitle = ui.h("h1", {}), heroLede = ui.h("p", { class: "lede" }), heroNote = ui.h("p", { class: "muted small" });
  // the hero shows the saved plan, or what is being typed below before it is saved ("if you save it")
  const drawHero = (x, preview) => {
    const p0 = x.chosen;
    heroTitle.textContent = Number.isFinite(p0.months) ? `Debt-free ${p0.endDate ? `by ${monthYear(p0.endDate)}` : `in ${monthsText(p0.months)}`}` : "This plan never ends";
    // an aimed extra is paid only until its debts are gone, so it is not added into one monthly figure
    const monthly = x.targets.length && x.extra > 0 ? `${fmt.money(x.budget - x.extra, cur)} a month ${paySplit({ ...x, extra: 0 })}, plus ${extraPart(x)}` : `${fmt.money(x.budget, cur)} a month ${paySplit(x)}`;
    heroLede.textContent = Number.isFinite(p0.months) ? `${monthly}, ${ORDERS[x.order].toLowerCase()}: ${monthsText(p0.months)} and ${fmt.money(p0.totalInterest, cur)} of interest.` : "The payments do not cover the interest on every debt. Add an extra amount below.";
    heroNote.textContent = preview ? "With what you typed below. Save the plan to keep it." : x.plus100 && !offered && (x.plus100.months > 0 || x.plus100.interest >= 1) ? `${fmt.money(100, cur)} more a month would ${x.plus100.months > 0 ? `end it ${x.plus100.months} month${x.plus100.months === 1 ? "" : "s"} sooner and ` : ""}save ${fmt.money(x.plus100.interest, cur)} of interest.` : "";
    heroNote.hidden = !heroNote.textContent;
  };
  drawHero(d, false);
  root.append(ui.h("section", { class: "card accent hero" }, heroTitle, heroLede, heroNote,
    d.missing.length ? ui.h("p", { class: "muted small" }, `Not in the plan (no rate or payment yet): ${d.missing.join(", ")}.`) : null,
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  // savings above a full cushion can pay the costly debt today (Next best action's `fromSavings`): say so first, with the
  // cushion that is left, and where to record it once the money is moved
  const nbAll = nba ?? ctx.computeOf?.("overview/next-best-action", { today: fmt.today() });
  const fromSav = nbAll?.ready ? nbAll.steps.find((x) => x.id === "high-debt" && x.status !== "done" && x.fromSavings > 0) : null;
  if (fromSav) root.append(ui.h("section", { class: "card" },
    ui.h("h2", {}, `Pay ${fmt.money(fromSav.fromSavings, cur)} from savings`),
    ui.h("p", {}, fromSav.detail),
    ui.row(ui.h("a", { class: "btn", href: "#/balance/update" }, "I moved it: update my balances")),
    ui.h("p", { class: "muted small" }, "Make the payment from your bank's app, then type the new balances of the savings account and the card.")));

  if (of && !fromSav) {
    const names = namesOf(of.targets);
    root.append(ui.h("section", { class: "card" },
      ui.h("h2", {}, `Put ${fmt.money(of.amount, cur)} a month on ${of.targets.length === 1 ? "it" : "them"}`),
      ui.h("p", {}, `You have about ${fmt.money(of.amount, cur)} left over each month after tax, bills and saving (Next best action). Paid on top of the required payments until ${of.targets.length === 1 ? "it is" : "they are"} paid off, ${names} ${of.targets.length === 1 ? "is" : "are"} gone by about ${monthYear(of.soon)}${of.now ? ` instead of ${monthYear(of.now)}` : ""}${of.interestSaved >= 1 ? `, with ${fmt.money(of.interestSaved, cur)} less interest` : ""}. Then the ${fmt.money(of.amount, cur)} is free again for your next step.`),
      ui.row(ui.button(`Use ${fmt.money(of.amount, cur)} a month`, () => { pending = `Plan saved: ${fmt.money(of.amount, cur)} a month on ${names} until ${of.targets.length === 1 ? "it is" : "they are"} paid off.`; store.update((p) => { p.debtPlan = { ...(p.debtPlan ?? {}), extra: of.amount, order: d.order, targets: of.targets.map((x) => x.id) }; }); })),
      ui.h("p", { class: "muted small" }, "Or type your own amount below; the date at the top follows what you type.")));
  }

  const extra = ui.moneyBox({ name: "extra", value: d.extra, min: 0, label: "Extra each month" });
  const extraIn = extra.input;
  const orderSel = ui.select(Object.entries(ORDERS).map(([value, label]) => ({ value, label })), d.order, { "aria-label": "Order" });
  // typing previews the date at the top (nothing is saved until Save plan)
  const preview = () => {
    const typed = ui.moneyValue(extraIn);
    const x = compute(plan, { today: fmt.today(), extra: typed === null ? d.extra : Math.max(0, typed), order: orderSel.value });
    drawHero(x, x.extra !== d.extra || x.order !== d.order);
  };
  extraIn.addEventListener("input", preview); orderSel.addEventListener("change", preview);
  root.append(ui.card("Your plan", ui.h("div", { class: "form" },
    ui.field("Extra each month, on top of the required payments", extra.box, d.targets.length ? `goes to ${aimedNames(d)} until ${d.targets.length === 1 ? "it is" : "they are"} paid off, then stops` : "any amount; the freed payment of each finished debt rolls onto the next"),
    ui.field("Order", orderSel, "highest rate first costs the least; smallest balance first gives quick wins")),
    ui.row(ui.button("Save plan", () => { pending = "Plan saved."; store.update((p) => { p.debtPlan = { ...(p.debtPlan ?? {}), extra: Math.max(0, ui.moneyValue(extraIn) ?? 0), order: orderSel.value }; }); }),
      // an aimed extra can be kept going to every debt; once its debts are paid off it can be put on the rest
      d.targets.length || d.targetsDone ? ui.button(d.targetsDone ? `Put ${fmt.money(d.extraTyped, cur)} a month on the other debts` : "Keep it going to the next debts", () => { pending = d.targetsDone ? `Plan saved: ${fmt.money(d.extraTyped, cur)} a month on the other debts.` : "Plan saved: the extra moves on to the next debt when these are paid off."; store.update((p) => { const { targets, ...rest } = p.debtPlan ?? {}; void targets; p.debtPlan = rest; }); }, { class: "secondary" }) : null),
    d.targetsDone ? ui.h("p", { class: "muted small" }, `The debts the extra was aimed at are paid off, so the ${fmt.money(d.extraTyped, cur)} a month has stopped and is free for your next step.`) : null,
    out,
  ));
  if (d.order === "custom") root.append(ui.card("My own order",
    ui.h("p", { class: "muted small" }, "Top gets the extra first. Move a debt up with the arrow."),
    ui.h("ul", { class: "page-list" }, c.debts.map((x, i) => ui.h("li", {},
      ui.h("span", { class: "ic" }, String(i + 1)), ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name)),
      ui.h("span", { class: "st" }, i > 0 ? ui.button("Up", () => store.update((p) => { const ids = c.debts.map((y) => y.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; p.debtPlan = { ...(p.debtPlan ?? {}), customOrder: ids }; }), { class: "secondary small" }) : null))))));
  root.append(ui.card("When each debt ends",
    ui.h("ul", { class: "page-list" }, c.debts.map((x) => { const src = d.debts.find((y) => y.id === x.id); return ui.h("li", {},
      ui.h("span", { class: "ic" }, Number.isFinite(x.months) ? "✅" : "⚠️"),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name), ui.h("div", { class: "d" }, `${fmt.money(src.balance, cur)} at ${fmt.pct(src.rate, 1)} · ${fmt.money(src.required, cur)} a month required${src.extraSet > 0 ? ` plus ${fmt.money(src.extraSet, cur)} extra` : ""} · ${fmt.money(x.interest, cur)} interest to come`)),
      ui.h("span", { class: "st", style: { textAlign: "right" } }, ui.h("div", { style: { fontWeight: "600" } }, x.endDate ? monthYear(x.endDate) : monthsText(x.months)), ui.h("div", { class: "muted small" }, monthsText(x.months)))); })),
    // the Debts and Mortgage pages give each debt's date on its own payment; say why this plan's is sooner
    ...d.rollover.map((r) => ui.h("p", { class: "muted small" }, `${r.name}: ${monthYear(r.planEnd)} here because, as the other debts are paid off, their payments move to it. On its own payment it ends ${monthYear(r.ownEnd)}, the date on the Debts page.`)),
  ));
  // every order within a dollar of the least interest is "least interest"; the trophy only when one order alone wins
  const least = ["avalanche", "snowball", "custom"].filter((k) => d.plans[k].totalInterest - d.plans[d.best].totalInterest < 1);
  const rowFor = (k) => { const p = d.plans[k]; return ui.h("li", {},
    ui.h("span", { class: "ic" }, least.length === 1 && k === d.best ? "🏆" : ""),
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, ORDERS[k], k === d.order ? ui.h("span", { class: "pill accent" }, "chosen") : null, least.includes(k) ? ui.h("span", { class: "pill ok" }, "least interest") : null), ui.h("div", { class: "d" }, `${monthsText(p.months)}${p.endDate ? `, by ${monthYear(p.endDate)}` : ""}`)),
    ui.h("span", { class: "st" }, `${fmt.money(p.totalInterest, cur)} interest`)); };
  root.append(ui.card("The three orders, same money",
    // a tie has no winner: one sentence instead of three equal rows and a trophy
    d.tie ? ui.h("p", {}, d.debts.length === 1 ? `With one debt there is no order to choose: ${fmt.money(c.totalInterest, cur)} of interest, debt-free ${c.endDate ? `by ${monthYear(c.endDate)}` : `in ${monthsText(c.months)}`}.` : `Here every order costs the same: ${fmt.money(c.totalInterest, cur)} of interest, debt-free ${c.endDate ? `by ${monthYear(c.endDate)}` : `in ${monthsText(c.months)}`}.${d.extra + d.alreadyExtra > 0 ? "" : " The order starts to matter once there is extra money each month."}`)
      : ui.h("ul", { class: "page-list" }, ["avalanche", "snowball", "custom"].map(rowFor)),
    d.baseline ? ui.h("p", { class: "muted small" }, `With the required payments only: ${monthsText(d.baseline.months)} and ${fmt.money(d.baseline.totalInterest, cur)} of interest.`) : null,
  ));
}
