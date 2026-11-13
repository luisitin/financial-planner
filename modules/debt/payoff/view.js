// modules/debt/payoff/view.js -- DOM only. Pick the extra and the order; see when each debt ends. Simple first
// (docs/OPTIONAL.md): the debt-free month, the box and the order, and each debt's month on the first view; one-time
// payments and how it is worked out (each debt's figures, the three orders, the printed month-by-month plan) one tap away.
import { compute, offer as offerFor, monthByMonth, LUMP_MAX } from "./compute.js";
import { ORDERS } from "../../../core/math/payoff.js";
import { addMonths } from "../../../core/math/dates.js";
import { parts, rest, choice, links } from "../../../core/ui/more.js";
import { reportFrame, rtable, printSheet } from "../../reports/report-kit.js";

const monthYear = (iso) => { const dt = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return Number.isNaN(dt.getTime()) ? String(iso) : dt.toLocaleDateString(undefined, { month: "long", year: "numeric" }); };
let pending = null;   // confirmation kept across the shell re-render
let pendingMove = null;   // "Visa card moved up to 3rd.", shown in the My own order card (where the thumb is)
let pendingLump = null;   // the green line in "One-time payments" after an add, a remove or an Undo: { added } | { removed, undo } | { putBack, r }
let lumpsOpen = false;    // "One-time payments" was just saved in: drawn open on the next draw, and no other part moves (R17)
let lumpShow = null;      // which of its two forms is out ("lump" | "skip"); null: the lump form while there is no line, else neither
const lumpAt = { lump: 1, skip: 1 };   // the month picked in each form, in months from now (1 = next month)
const ordinal = (n) => { const t = n % 100, u = n % 10; return `${n}${t >= 11 && t <= 13 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"}`; };
// the most a month this page takes: a slip of the thumb (99999999999) is refused at the box, not saved
const EXTRA_MAX = 1000000;

const monthOf = (ym) => monthYear(`${ym}-15`);
/** "$2,500 in March 2027 on the Visa card" / "$300 less in March 2027": how a one-time line is named. */
export const lumpHead = (l, money) => l.amount > 0 ? `${money(l.amount)} in ${monthOf(l.month)}${l.debtName ? ` on the ${l.debtName}` : ""}` : `${money(-l.amount)} less in ${monthOf(l.month)}`;
/**
 * One written sentence per case for a saved one-time line (docs/OPTIONAL.md R5), from compute's lumpLines (its `kind`): what
 * it does to the debt-free month and the interest, against the same plan without it.
 */
export function lumpSentence(l, money) {
  const head = lumpHead(l, money), more = l.amount > 0, cost = money(Math.round(Math.abs(l.interestDelta)));
  const now = monthYear(l.endDate), was = monthYear(l.endWithout);
  switch (l.kind) {
    case "past": return more ? `${head} is past, so the plan leaves it out. If you paid it, update the balance on Debts.` : `${head} is past, so the plan leaves it out.`;
    case "after": return `${head}: your debts are paid off before then, so it changes nothing.`;
    case "never": return more ? `${head}: at these payments the debts are still never paid off.` : `${head}: at these payments the debts would never be paid off.`;
    case "ends": return `${head}: debt-free by ${now}; without it the debts are never paid off.`;
    case "sooner": return `${head}: debt-free by ${now} instead of ${was}, about ${cost} less interest.`;
    case "later": return `${head}: debt-free by ${now} instead of ${was}, about ${cost} more interest.`;
    case "same": return more ? `${head}: still debt-free by ${now}, about ${cost} less interest.` : `${head}: still debt-free by ${now}, about ${cost} more interest.`;
    default: return more ? `${head}: still debt-free by ${now}, with less than ${money(1)} of interest saved.` : `${head}: nothing above the required payments is paid that month, so it changes nothing.`;
  }
}
/**
 * The green line after a line is saved (docs/OPTIONAL.md R7): the new answer, in one sentence per case; the line's own sentence
 * is right under it in the list, so it is not said twice.
 */
export function lumpSaved(l) {
  const now = monthYear(l.endDate);
  if (l.kind === "sooner" || l.kind === "later") return `Saved. Debt-free by ${now} now, instead of ${monthYear(l.endWithout)}.`;
  if (l.kind === "ends") return `Saved. Debt-free by ${now} now.`;
  if (l.kind === "never") return "Saved. At these payments the debts are still never paid off.";
  return `Saved. Still debt-free by ${now}.`;
}
/** The answer now, for the green line after a remove or an Undo (R7). */
const answerNow = (x) => (Number.isFinite(x.chosen.months) && x.chosen.endDate ? `Debt-free by ${monthYear(x.chosen.endDate)} now.` : "At these payments the debts are never paid off.");
/** The month chips: next month, March (most tax refunds are paid by the end of March) and December (a bonus), soonest first. */
export function monthPresets(today) {
  const m = Number(String(today).slice(5, 7)) || 1;
  const until = (target) => ((target - m + 12) % 12) || 12;   // months from this month to the next `target` month after it
  const all = [{ value: 1, label: "Next month" }, { value: until(3), label: "March (a tax refund)" }, { value: until(12), label: "December (a bonus)" }];
  return all.filter((p, i) => all.findIndex((q) => q.value === p.value) === i).sort((a, b) => a.value - b.value);
}

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
  // the headline and its sentence for a plan (the hero, and the printed sheet of the saved plan)
  const heroWords = (x) => {
    const p0 = x.chosen;
    // an aimed extra is paid only until its debts are gone, so it is not added into one monthly figure
    const monthly = x.targets.length && x.extra > 0 ? `${fmt.money(x.budget - x.extra, cur)} a month ${paySplit({ ...x, extra: 0 })}, plus ${extraPart(x)}` : `${fmt.money(x.budget, cur)} a month ${paySplit(x)}`;
    return {
      title: Number.isFinite(p0.months) ? `Debt-free ${p0.endDate ? `by ${monthYear(p0.endDate)}` : `in ${monthsText(p0.months)}`}` : "This plan never ends",
      lede: Number.isFinite(p0.months) ? `${monthly}, ${ORDERS[x.order].toLowerCase()}: ${monthsText(p0.months)} and ${fmt.money(p0.totalInterest, cur)} of interest.` : "The payments do not cover the interest on every debt. Add an extra amount below.",
    };
  };
  // the hero shows the saved plan, or what is being typed below before it is saved ("if you save it")
  const drawHero = (x, preview) => {
    const words = heroWords(x);
    heroTitle.textContent = words.title;
    heroLede.textContent = words.lede;
    heroNote.textContent = preview ? "With what you typed below. Save the plan to keep it." : x.plus100 && !offered && (x.plus100.months > 0 || x.plus100.interest >= 1) ? `${fmt.money(100, cur)} more a month would ${x.plus100.months > 0 ? `end it ${x.plus100.months} month${x.plus100.months === 1 ? "" : "s"} sooner and ` : ""}save ${fmt.money(x.plus100.interest, cur)} of interest.` : "";
    heroNote.hidden = !heroNote.textContent;
  };
  drawHero(d, false);
  let drawLists = () => {};
  let movedNow = null;   // set below, once the cards' places are on the page
  root.append(ui.h("section", { class: "card accent hero" }, heroTitle, heroLede, heroNote,
    // each debt left out is a button to its own form on Debts (a sentence of names gave no way to fix it)
    d.missingRows.length ? ui.h("p", { class: "muted small" }, `Not in the plan yet, because ${d.missingRows.length === 1 ? "it has" : "they have"} no rate or payment: ${d.missing.join(", ")}.`) : null,
    d.missingRows.length ? ui.row(...d.missingRows.map((r) => ui.h("a", { class: "btn secondary", href: `#/balance/liabilities/${encodeURIComponent(r.id)}?back=debt/payoff` }, `Add ${r.name}'s rate and payment ›`))) : null,
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

  // $0 shows as an empty box with a grey 0, so typing 200 does not read "0200" (walk 2026-11-11)
  const extra = ui.moneyBox({ name: "extra", value: d.extra || "", placeholder: "0", min: 0, max: EXTRA_MAX, label: "Extra each month" });
  const extraIn = extra.input;
  const orderSel = ui.select(Object.entries(ORDERS).map(([value, label]) => ({ value, label })), d.order, { "aria-label": "Order" });
  // typing previews the date at the top (nothing is saved until Save plan)
  const preview = () => {
    // an empty box is $0, as Save plan saves it; a box that cannot be read (or is below 0) previews the saved amount, since
    // Save plan refuses it
    const typed = ui.moneyValue(extraIn);
    const ex = !extraIn.value.trim() ? 0 : typed === null || !extraIn.checkValidity() ? d.extra : typed;
    const x = compute(plan, { today: fmt.today(), extra: ex, order: orderSel.value });
    drawHero(x, x.extra !== d.extra || x.order !== d.order);
    drawLists(x);
  };
  extraIn.addEventListener("input", preview); orderSel.addEventListener("change", preview);
  root.append(ui.card("Your plan", ui.h("div", { class: "form" },
    // with an extra already set on the Debts page the box is on top of that too: say so, so it is not typed twice
    ui.field(d.alreadyExtra > 0 ? `Extra each month, on top of the ${fmt.money(d.required + d.alreadyExtra, cur)} you pay now` : "Extra each month, on top of the required payments", extra.box, d.targets.length ? `goes to ${aimedNames(d)} until ${d.targets.length === 1 ? "it is" : "they are"} paid off, then stops` : "any amount; the freed payment of each finished debt rolls onto the next"),
    ui.field("Order", orderSel, "highest rate first costs the least; smallest balance first gives quick wins")),
    ui.row(ui.button("Save plan", () => {
      // the box's own check ("Type an amount in numbers, like 4,500.", "Use 0 or more.") holds the save: "50.." or "abc"
      // were saved as $0 under a green "Plan saved."
      if (!extraIn.reportValidity()) return;
      const amount = ui.moneyValue(extraIn) ?? 0;
      pending = amount > 0 ? `Plan saved: ${fmt.money(amount, cur)} a month on top of the required payments, ${ORDERS[orderSel.value].toLowerCase()}.` : `Plan saved: the required payments only, ${ORDERS[orderSel.value].toLowerCase()}.`;
      store.update((p) => { p.debtPlan = { ...(p.debtPlan ?? {}), extra: amount, order: orderSel.value }; });
    }, fromSav || of ? { class: "secondary" } : {}),
      // an aimed extra can be kept going to every debt; once its debts are paid off it can be put on the rest
      d.targets.length || d.targetsDone ? ui.button(d.targetsDone ? `Put ${fmt.money(d.extraTyped, cur)} a month on the other debts` : "Keep it going to the next debts", () => { pending = d.targetsDone ? `Plan saved: ${fmt.money(d.extraTyped, cur)} a month on the other debts.` : "Plan saved: the extra moves on to the next debt when these are paid off."; store.update((p) => { const { targets, ...others } = p.debtPlan ?? {}; void targets; p.debtPlan = others; }); }, { class: "secondary" }) : null),
    d.targetsDone ? ui.h("p", { class: "muted small" }, `The debts the extra was aimed at are paid off, so the ${fmt.money(d.extraTyped, cur)} a month has stopped and is free for your next step.`) : null,
    out,
  ));
  // "My own order", "When each debt ends" and "The three orders" follow what is typed above, as the headline does (round 8,
  // 2026-11-06: typing $150 moved only the headline to December 2029 while the list and the orders stayed on the saved $50)
  // "Each debt" (its figures) and the three orders now sit in "How this is worked out" (simple first, opt C9): they follow
  // the typing too, from inside the part
  const customHost = ui.h("div"), endsHost = ui.h("div"), eachHost = ui.h("div", { style: { display: "grid", gap: "4px" } }), ordersHost = ui.h("div", { style: { display: "grid", gap: "4px" } });
  root.append(customHost, endsHost);
  drawLists = (x) => {
    const c = x.chosen;
    // Up saves the order together with "My own order" and the amount typed above: it used to save only the order, and the
    // redraw put the Order box back on the saved order and the box on the saved amount, so the whole card vanished
    const moved = pendingMove; pendingMove = null; if (moved) movedNow = moved;
    customHost.replaceChildren(...[x.order === "custom" ? ui.card("My own order",
      ui.h("p", { class: "muted small" }, "The top debt gets the extra first. Tap Up to move a debt earlier."),
      ui.h("ul", { class: "page-list" }, c.debts.map((y, i) => ui.h("li", { dataset: { debt: y.id } },
        ui.h("span", { class: "ic" }, String(i + 1)), ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, y.name, moved?.id === y.id ? ui.h("span", { class: "pill ok" }, "moved") : null)),
        ui.h("span", { class: "st" }, i > 0 ? ui.button("Up", (ev) => {
          const typed = extraIn.checkValidity() ? ui.moneyValue(extraIn) : null;
          const keep = !extraIn.value.trim() ? 0 : typed;
          pendingMove = { id: y.id, top: ev.currentTarget.closest("li")?.getBoundingClientRect().top ?? null, text: `${y.name} moved up to ${ordinal(i)}. Plan saved with this order${keep !== null && keep !== d.extra ? ` and ${fmt.money(keep, cur)} extra a month` : ""}.` };
          store.update((p) => { const ids = c.debts.map((z) => z.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; p.debtPlan = { ...(p.debtPlan ?? {}), customOrder: ids, order: "custom", ...(keep !== null ? { extra: keep } : {}) }; });
        }, { class: "secondary small", "aria-label": `Move ${y.name} up to ${ordinal(i)}` }) : null)))),
      // under the list, so the rows do not slide down under the thumb
      moved ? ui.notice("ok", moved.text) : null) : null].filter(Boolean));
    // the first view keeps one line per debt with the month it ends (six, then "N more debts"); its figures are in "Each debt"
    const endRow = (y) => ui.h("li", {},
      ui.h("span", { class: "ic" }, Number.isFinite(y.months) ? "✅" : "⚠️"),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, y.name)),
      ui.h("span", { class: "st", style: { textAlign: "right", fontWeight: "600" } }, y.endDate ? monthYear(y.endDate) : monthsText(y.months)));
    endsHost.replaceChildren(ui.card("When each debt ends",
      ...rest(ctx, { id: "debts", items: c.debts, row: endRow, noun: "debts", one: "debt", list: "page-list", keep: (y) => !Number.isFinite(y.months) }),
      // the Debts and Mortgage pages give each debt's date on its own payment; say why this plan's is sooner
      ...x.rollover.map((r) => ui.h("p", { class: "muted small" }, `${r.name}: ${monthYear(r.planEnd)} here because, as the other debts are paid off, their payments move to it. If you keep paying just its own payment, it ends ${monthYear(r.ownEnd)}, the date on the Debts page.`)),
    ));
    eachHost.replaceChildren(ui.h("h3", {}, "Each debt"),
      ui.h("ul", { class: "page-list" }, c.debts.map((y) => { const src = x.debts.find((z) => z.id === y.id); return ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, y.name), ui.h("div", { class: "d" }, `${fmt.money(src.balance, cur)} at ${fmt.pct(src.rate, 1)} · ${fmt.money(src.required, cur)} a month required${src.extraSet > 0 ? ` plus ${fmt.money(src.extraSet, cur)} extra` : ""} · ${fmt.money(y.interest, cur)} interest to come · ${Number.isFinite(y.months) ? `gone in ${monthsText(y.months)}` : "never paid off"}`))); })));
    // every order within a dollar of the least interest is "least interest"; the trophy only when one order alone wins
    const least = ["avalanche", "snowball", "custom"].filter((k) => x.plans[k].totalInterest - x.plans[x.best].totalInterest < 1);
    const rowFor = (k) => { const p = x.plans[k]; return ui.h("li", {},
      ui.h("span", { class: "ic" }, least.length === 1 && k === x.best ? "🏆" : ""),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, ORDERS[k], k === x.order ? ui.h("span", { class: "pill accent" }, "chosen") : null, least.includes(k) ? ui.h("span", { class: "pill ok" }, "least interest") : null), ui.h("div", { class: "d" }, Number.isFinite(p.months) ? `${monthsText(p.months)}${p.endDate ? `, by ${monthYear(p.endDate)}` : ""}` : "the debts would never be paid off")),
      ui.h("span", { class: "st" }, Number.isFinite(p.months) ? `${fmt.money(p.totalInterest, cur)} interest` : "interest keeps growing")); };
    ordersHost.replaceChildren(ui.h("h3", {}, "The three orders, same money"),
      // a tie has no winner: one sentence instead of three equal rows and a trophy
      x.tie ? ui.h("p", {}, !Number.isFinite(c.months) ? (x.debts.length === 1 ? "With one debt there is no order to choose; at this payment it would never be paid off." : "Here every order costs the same: the debts are never paid off, and the interest keeps growing.") : x.debts.length === 1 ? `With one debt there is no order to choose: ${fmt.money(c.totalInterest, cur)} of interest, debt-free ${c.endDate ? `by ${monthYear(c.endDate)}` : `in ${monthsText(c.months)}`}.` : `Here every order costs the same: ${fmt.money(c.totalInterest, cur)} of interest, debt-free ${c.endDate ? `by ${monthYear(c.endDate)}` : `in ${monthsText(c.months)}`}.${x.extra + x.alreadyExtra > 0 ? "" : " The order starts to matter once there is extra money each month."}`)
        : ui.h("ul", { class: "page-list" }, ["avalanche", "snowball", "custom"].map(rowFor)),
      // today's payments with nothing extra, each finished debt's payment moving on (compute's baseline): "with the required
      // payments only" read as paying the bank's shrinking minimum (round 8 review, 2026-11-06)
      x.baseline ? ui.h("p", { class: "muted small" }, `If you pay nothing more than today's ${x.alreadyExtra > 0 ? "payments" : "required amounts"} (each finished debt's payment moving to the next): ${Number.isFinite(x.baseline.months) ? `${monthsText(x.baseline.months)} and ${fmt.money(x.baseline.totalInterest, cur)} of interest` : "the debts would never be paid off"}.`) : null,
    );
  };
  drawLists(d);

  // ---- the optional parts: one-time payments, and how it is worked out (with the printed month-by-month plan)
  const today = fmt.today(), money = (n) => fmt.money(n, cur);
  const lines = d.lumpLines ?? [];
  const lumpHost = ui.h("div", { style: { display: "grid", gap: "12px" } });
  drawLumps(ctx, { d, lines, host: lumpHost, today, money });
  const sheetHost = ui.h("div");
  const printPlan = () => {
    const rows = monthByMonth(d, today), title = "Your debt payoff plan, month by month", words = heroWords(d);
    const { wrap, sheet } = reportFrame(ui, { title });
    // on the screen the sheet is not shown (it is drawn for the printer only); scoped to this page's own class
    wrap.className = `${wrap.className} po-print`;
    wrap.append(ui.h("style", {}, ".po-print { display: none; } @media print { .po-print { display: block !important; } }"));
    const cols = [{ label: "Month", get: (r) => monthOf(r.month) }, { label: "Paid", num: true, get: (r) => money(r.paid) }, { label: "Interest", num: true, get: (r) => money(r.interest) },
      ...(lines.length ? [{ label: "One-time", num: true, get: (r) => (r.once ? money(r.once) : "") }] : []),
      ...d.chosen.debts.map((y) => ({ label: y.name, num: true, get: (r) => money(r.balances[y.id] ?? 0) })), { label: "Left to pay", num: true, get: (r) => money(r.total) }];
    sheet.append(ui.h("h1", {}, title), ui.h("p", { class: "rp-sub" }, `From your plan on ${fmt.date(today)}.`), ui.h("p", { class: "rp-lead" }, `${words.title}. ${words.lede}`),
      lines.length ? ui.h("ul", { class: "rp-list" }, lines.map((l) => ui.h("li", {}, lumpSentence(l, money)))) : null,
      rtable(ui, cols, rows),
      ui.h("p", { class: "rp-foot" }, "Each month every debt is charged its balance × its yearly rate ÷ 12, every debt gets its own payment, and the rest goes to the first debt in the order. The balances are what is left after that month's payments."));
    sheetHost.replaceChildren(wrap);
    if (typeof window !== "undefined" && typeof window.print === "function") printSheet(title, sheet);
  };
  root.append(parts(ctx,
    { id: "lumps", kind: "own", title: "One-time payments", ...(lines.length ? { set: lines.length } : { says: "none yet" }), open: lumpsOpen, holds: ["lumpAmount", "skipAmount", "lumpDebt"], body: [lumpHost] },
    { id: "how", kind: "how", says: "3 orders", body: [
      ui.h("ol", { style: { margin: "0", paddingLeft: "20px", display: "grid", gap: "6px" } },
        ui.h("li", {}, "Each month every debt is charged its balance × its yearly rate ÷ 12."),
        ui.h("li", {}, "Every debt gets its own payment."),
        ui.h("li", {}, "The rest (the extra, and the payment of each debt already paid off) goes to the first debt in your order."),
        ui.h("li", {}, "A one-time payment goes to the debt you picked, or the first in your order; a month you pay less holds back only what is above the debts' own payments.")),
      eachHost, ordersHost,
      ui.row(ui.button("Print the month-by-month plan", printPlan, { class: "secondary" })),
    ] }));
  lumpsOpen = false;
  root.append(sheetHost);
  // the deeper pages, each row the question it answers: the two that fit these debts (the first view stays short)
  const hasType = (t) => d.debts.some((x) => x.type === t);
  const deeper = links(ctx, [
    hasType("credit") && { href: "#/debt/credit-cards", ask: "What does paying only the minimum on a card cost?" },
    hasType("mortgage") && { href: "#/debt/mortgage", ask: "What would paying the mortgage faster save?" },
    { href: "#/debt/ratios", ask: "How would a lender see these debts?" },
  ].filter(Boolean).slice(0, 2));
  if (deeper) root.append(deeper);
  // the moved debt stays under the thumb: the page scrolls by the row it climbed, so a second Up moves the same debt again
  // (two quick taps used to land on the debt that slid down and put the order back)
  if (movedNow) {
    const li = customHost.querySelector(`li[data-debt="${CSS.escape(movedNow.id)}"]`);
    if (li && movedNow.top !== null) { const dy = li.getBoundingClientRect().top - movedNow.top; if (Math.abs(dy) > 2) window.scrollBy(0, dy); }
    li?.querySelector("button")?.focus({ preventScroll: true });
  }
}

/**
 * "One-time payments" (gap #3): the saved lines, each with what it does, and two short forms: a lump sum on top (when, how
 * much; which debt under "More details (optional)") and a month you can't pay the extra (when, how much less). One form is
 * out at a time; with lines saved both wait behind outlined buttons. Saving keeps the part open with a green line that names
 * the new debt-free month (docs/OPTIONAL.md R7, R17); a removed line can be put back with Undo.
 */
function drawLumps(ctx, { d, lines, host, today, money }) {
  const { ui, store } = ctx;
  const note = (() => {
    const p = pendingLump; pendingLump = null;
    if (!p) return null;
    if (p.added) { const l = lines.find((x) => x.id === p.added); return l ? ui.notice("ok", lumpSaved(l)) : null; }
    if (p.removed) return ui.notice("ok", `Removed: ${p.removed}. ${answerNow(d)}`, p.undo ? { undo: p.undo, undone: (r) => { pendingLump = { putBack: p.removed, r }; lumpsOpen = true; } } : {});
    if (p.putBack) return ui.notice("ok", ui.undoneWords(p.r, `Put back: ${p.putBack}. ${answerNow(d)}`));
    return null;
  })();
  const save = (entry) => {
    pendingLump = { added: entry.id }; lumpsOpen = true; lumpShow = null; lumpAt.lump = 1; lumpAt.skip = 1;
    store.update((p) => { const dp = p.debtPlan ?? {}; p.debtPlan = { ...dp, lumps: [...(Array.isArray(dp.lumps) ? dp.lumps : []), entry] }; });
  };
  const remove = (l) => {
    const head = lumpHead(l, money);
    lumpsOpen = true; pendingLump = { removed: head };
    const undo = ui.undoable(store, (p) => {
      const dp = p.debtPlan ?? {};
      const left = (Array.isArray(dp.lumps) ? dp.lumps : []).filter((x, i) => String(x?.id ?? `lump-${i}`) !== l.id);
      const { lumps, ...others } = dp; void lumps;
      p.debtPlan = left.length ? { ...others, lumps: left } : others;
    });
    if (undo) pendingLump = { removed: head, undo };
  };
  // "When": three chips (next month, a tax refund, a bonus) and "Type my own" (months from now); the month it is, under them
  const when = (kind) => {
    // data-no-keep: the "Type my own" box is used up when its month is picked (the chips are drawn again without it), so
    // wave 1 must not keep its typing as "not saved yet" (seen in the walk of 2026-11-13)
    const holder = ui.h("div", { style: { display: "grid", gap: "6px" }, dataset: { noKeep: "" } });
    const draw = () => holder.replaceChildren(
      choice(ctx, { id: `${kind}At`, label: "When", presets: monthPresets(today), value: lumpAt[kind],
        own: { type: "number", name: `${kind}At`, label: "How many months from now (1 is next month)", min: 1, max: 360, whole: true, show: (v) => monthYear(addMonths(today, Number(v))) },
        onPick: (v) => { lumpAt[kind] = Math.min(360, Math.max(1, Math.round(Number(v)) || 1)); draw(); } }),
      ui.h("small", { class: "help" }, `In ${monthYear(addMonths(today, lumpAt[kind]))}.`));
    draw();
    return ui.h("div", { class: "field" }, ui.h("span", { class: "field-label" }, "When"), holder);
  };
  let show = lumpShow ?? (lines.length ? null : "lump");
  const close = () => { show = lumpShow = lines.length ? null : "lump"; drawWays(); };
  // the amount is asked for only by this optional form, inside a shut part: no `required` (docs/OPTIONAL.md R9 item 9 keeps a
  // box the answer needs out of a shut part; this one the answer never needs). An empty amount is held at the box with the
  // same words, the part opens around it, and nothing is saved.
  const lumpForm = ui.form([
    { key: "lumpAmount", label: "How much", type: "money", min: 1, max: LUMP_MAX },
    { key: "lumpDebt", label: "Which debt it goes to", type: "select", more: true, options: [{ value: "", label: "The next one in your order" }, ...d.chosen.debts.map((y) => ({ value: y.id, label: y.name }))], help: "Once that debt is paid off, the rest goes to the next one." },
  ], {}, (v) => {
    const amount = Math.round((Number(v.lumpAmount) || 0) * 100) / 100;
    if (!(amount > 0)) return ui.fieldError(lumpForm.querySelector?.('[name="lumpAmount"]'), "Type the amount, like 2,500.");
    save({ id: ui.uid(), month: String(addMonths(today, lumpAt.lump)).slice(0, 7), amount, debtId: v.lumpDebt || "" });
  }, { submitLabel: "Add this payment", ...(lines.length ? { onCancel: close } : {}) });
  lumpForm.prepend(when("lump"));
  const skipForm = ui.form([
    { key: "skipAmount", label: "How much less than usual", type: "money", min: 1, max: LUMP_MAX, help: "The debts' own payments are always paid." },
  ], {}, (v) => {
    const amount = Math.round((Number(v.skipAmount) || 0) * 100) / 100;
    if (!(amount > 0)) return ui.fieldError(skipForm.querySelector?.('[name="skipAmount"]'), "Type how much less, like 300.");
    save({ id: ui.uid(), month: String(addMonths(today, lumpAt.skip)).slice(0, 7), amount: -amount, debtId: "" });
  }, { submitLabel: "Save this month", onCancel: close });
  skipForm.prepend(when("skip"));
  // (no display style on these two: a style would beat the `hidden` that folds the one not in use)
  const lumpBox = ui.h("div", {}, ui.h("h3", { style: { margin: "0 0 8px" } }, "Put a lump sum on a debt"), lumpForm);
  const skipBox = ui.h("div", {}, ui.h("h3", { style: { margin: "0 0 8px" } }, "A month you can't pay the extra"), skipForm);
  const ways = ui.h("div", { class: "row" });
  const drawWays = () => {
    lumpBox.hidden = show !== "lump"; skipBox.hidden = show !== "skip";
    ways.replaceChildren(...[
      show !== "lump" ? ui.button(lines.length ? "+ Add another lump sum" : "Put a lump sum on a debt", () => { show = lumpShow = "lump"; drawWays(); }, { class: "secondary" }) : null,
      show !== "skip" ? ui.button("A month you can't pay the extra", () => { show = lumpShow = "skip"; drawWays(); }, { class: "secondary" }) : null,
    ].filter(Boolean));
  };
  drawWays();
  host.append(...[note,
    lines.length
      ? ui.h("ul", { class: "records" }, lines.map((l) => ui.h("li", { dataset: { lump: l.id } },
        ui.h("div", {}, lumpSentence(l, money)),
        ui.h("div", { class: "rec-foot" }, ui.h("span", {}, ""), ui.h("div", { class: "rec-actions" }, ui.button("Remove", () => remove(l), { class: "secondary small", "aria-label": `Remove ${lumpHead(l, money)}` }))))))
      : ui.h("p", { class: "muted small" }, "A tax refund or a bonus paid on top once ends the debts sooner; a month you can't pay the extra moves the date later."),
    lumpBox, skipBox, ways].filter(Boolean));
}
