// modules/taxes/estimated/view.js -- DOM only. Simple first (docs/OPTIONAL.md; opt C12): the answer (what to pay and by
// when, or what is behind), the next payment's row, and the page's one action; the other payments, the four figures, the
// payment boxes, last year's figures and what paying late costs are quiet rows one tap away.
import { compute, lateCosts } from "./compute.js";
import { parts, rest } from "../../../core/ui/more.js";
import { RATES_READ } from "./data/rates.js";

// what the last save was, kept for the redraw the shell makes after it: { part, said, before (the headline then), safe }
let pending = null;

const about = (n, money) => (n < 1 ? "less than $1" : `about ${money(n)}`);
const pctOf = (r) => `${Number((r * 100).toPrecision(6))}%`;
const QUARTER_WORDS = ["January to March", "April to June", "July to September", "October to December"];
/** The sum for one charge, with the person's figures: "$2,100 × 7% × 31 days ÷ 365 = $12.48" (one term per rate or year). */
const sumOf = (amount, c, { money, money2 }) => `${c.parts.map((x) => `${money(amount)} × ${pctOf(x.rate)} × ${x.days} day${x.days === 1 ? "" : "s"} ÷ ${x.yearDays}`).join(" + ")} = ${money2(c.cost)}`;

/**
 * lateWords(L, { money, money2, date }) -> { lead, says, lines }: the words of "What paying late costs" for one case of
 * compute's lateCosts (one written sentence per case, docs/OPTIONAL.md R5), the part's status, and the working under it.
 */
export function lateWords(L, { money, money2, date }) {
  const nextLine = L.next ? `Paying the ${money(L.next.amount)} due ${date(L.next.due)} one month late costs ${about(L.next.cost, money)}.` : null;
  const lead = {
    next: () => nextLine,
    // "since" is the day the charge began, which can be a quarter paid since (critic F1): the cost is said of paying late,
    // not of the amount behind now
    behind: () => `Paying late has cost ${about(L.behind.soFar, money)} since ${date(L.behind.from)}, and the ${money(L.behind.amount)} behind adds ${about(L.behind.perMonth.cost, money)} for each month it waits.`,
    after: () => `Paying late cost ${about(L.behind.soFar, money)} up to ${date(L.stops)}; after that, unpaid tax costs interest and a late-payment charge instead.`,
    late: () => `The ${L.late.label}'s payment came after ${date(L.late.due)}: ${about(L.late.perMonth.cost, money)} for each month it was late.`,
    met: () => (L.basis === "last year" ? `No penalty: you paid in ${pctOf(L.priorShare)} of last year's tax in time.` : "No penalty: you paid in 90% of this year's tax in time."),
    withheld: () => (L.via === "withdrawal"
      ? "No penalty if the extra is held back from your IRA withdrawal before December 31: the IRS counts it as paid evenly through the year."
      : "No penalty if the extra is taken from pay before December 31: the IRS counts tax withheld from pay as paid evenly through the year."),
  }[L.case]();
  const fit = (s, short) => (s.length <= 20 ? s : short);
  const says = {
    next: () => about(L.next.cost, money),
    behind: () => fit(`${about(L.behind.soFar, money)} so far`, about(L.behind.soFar, money)),
    after: () => about(L.behind.soFar, money),
    late: () => fit(`${about(L.late.perMonth.cost, money)} a month`, about(L.late.perMonth.cost, money)),
    met: () => "no penalty",
    withheld: () => (L.via === "withdrawal" ? "none if held back" : "none if withheld"),
  }[L.case]();
  const r = L.rate, pct = pctOf(r.rate);
  const sum = L.case === "next" ? sumOf(L.next.amount, L.next, { money, money2 })
    : L.case === "behind" ? `${sumOf(L.behind.amount, L.behind.perMonth, { money, money2 })}, for the month ahead`
    : L.case === "late" ? sumOf(L.late.short, L.late.perMonth, { money, money2 }) : null;
  // a quarter paid since but short on its own date: its row says "paid late", and its days are in "so far"
  const ear = L.behind?.earlier ?? [];
  const names = ear.map((x) => x.label.replace(/ quarter$/, ""));
  const earlierLine = ear.length === 1 ? `The ${ear[0].label} is paid now, but it was ${money(ear[0].short)} short on ${date(ear[0].due)}: the days until later payments covered it count too.`
    : ear.length > 1 ? `The ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} quarters are paid now, but each was short on its due date: the days until later payments covered them count too.` : null;
  const lines = [
    earlierLine,
    ["behind", "late"].includes(L.case) ? nextLine : null,
    `The IRS charges ${pct} a year on a payment that is late, counted by the day from its due date until it is paid. Each payment counts on its own, so catching up later does not undo a late one, and the charge stops on ${date(L.stops)}, when the return is due.`,
    sum,
    ["behind", "after"].includes(L.case) ? "So far counts any payment you typed as made on its quarter's due date, and the amount still missing on each day since." : null,
    r.known ? `${pct} is the rate for ${QUARTER_WORDS[Number(r.quarter.slice(5)) - 1]} ${r.quarter.slice(0, 4)}. It is set each quarter: what the government pays to borrow for a short time, plus 3 points.`
      : `${pct}, the rate through ${date(r.through)}. The IRS sets each quarter's rate a few weeks ahead: what the government pays to borrow for a short time, plus 3 points.`,
    `From the IRS Form 2210 instructions and the IRS quarterly interest rates, read ${date(RATES_READ)}.`,
  ].filter(Boolean);
  return { lead, says, lines };
}

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const just = pending; pending = null;
  // tax withheld from pay counts as paid evenly through the year (IRC 6654(g)(1)), so someone whose pay has tax taken out
  // can cover the whole shortfall, earlier quarters too, by raising withholding for the paychecks left: the easier fix,
  // and the one Withholding check and the Federal estimate point to
  // filing separately, each return is on its own: its own tax, withholding, safe amount and payments (compute `returns`;
  // Review 2026-11-06: "No estimated payments needed" while Bo's own return was 1,660 short of his tax)
  const rets = Array.isArray(d.returns) && d.returns.length > 1 ? d.returns : null;
  const needing = rets ? rets.filter((x) => x.needsEstimates) : [];
  // the schedule shown: the one return that needs payments, else the household's
  const S = needing.length === 1 ? { ...needing[0], withholding: needing[0].withheld } : d;
  const viaPay = S.needsEstimates && S.withholding > 0 && S.remaining > 0 && d.withholdingFrom !== "none";
  const who = needing.length === 1 ? `${S.name}'s ` : "";
  // a retiree whose tax is on this year's IRA withdrawals: tax held back from a withdrawal counts as paid evenly through the
  // year (IRC 6654(g)), so the easier fix is to have it held back from the withdrawal still to come (compute `holdBack`;
  // round 8, widow-2)
  const hb = !rets && !viaPay ? d.holdBack ?? null : null;
  const head = rets ? (!needing.length ? "No estimated payments needed"
      : needing.length > 1 ? "Both returns need estimated payments"
      : viaPay ? `${S.name}: about ${money(S.remaining)} more withheld this year` : S.behind > 0 ? `${S.name}'s return: ${money(S.behind)} behind, pay it now` : S.nextDue ? `${S.name}'s return: ${money(S.nextDue.amount)} due by ${fmt.date(S.nextDue.due)}` : `All four payments on ${S.name}'s return are in`)
    : !d.hasIncome ? "Quarterly estimated payments" : !d.needsEstimates ? "No estimated payments needed" : hb ? `Have about ${money(hb.amount)} of tax held back from your IRA withdrawal` : viaPay ? `Raise your withholding: about ${money(d.remaining)} more this year` : d.behind > 0 ? `${money(d.behind)} behind: pay it now` : d.nextDue ? `${money(d.nextDue.amount)} due by ${fmt.date(d.nextDue.due)}` : `All four payments for ${d.year} are in`;
  const retLine = (x) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.name}'s return`), ui.h("span", { class: "rec-value" }, x.needsEstimates ? `${money(x.perQuarter)} a quarter` : "none needed")),
    ui.h("div", { class: "rec-sub" }, `${x.back > 0.5 ? `no federal tax, and ${money(x.back)} of credits come back` : `about ${money(x.owed)} of federal tax`}; ${x.people.length ? `${money(x.withheld)} withheld from ${x.name}'s pay` : `nothing withheld from ${x.name}'s pay`}${x.paid >= 0.5 ? `, ${money(x.paid)} of the payments` : ""}.`),
    ui.h("div", { class: "rec-sub" }, x.needsEstimates
      ? `To stay clear of the penalty this return needs ${money(x.harbour.required)} paid in during the year (${x.harbour.label === "90% of this year's" ? "90% of its tax" : `${x.harbour.label}, its share`}), so ${money(x.toPayByEstimates)} in four payments. ${money(x.paid)} paid so far, ${money(x.remaining)} to go${x.behind > 0 ? `, ${money(x.behind)} of it behind` : ""}.`
      : `${x.balanceAfterWithholding < 1000 ? "Under $1,000 is left at filing time" : "The withholding reaches this return's safe amount"}, so no installments are required: ${x.balanceAtFiling >= 0.5 ? `about ${money(x.balanceAtFiling)} to pay in April` : x.balanceAtFiling <= -0.5 ? `about ${money(-x.balanceAtFiling)} back` : "nothing to pay in April"}.`));
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, head),
    rets ? ui.h("p", { class: "lede" }, `${d.year}: filing separately, each of you pays the tax on your own return, and one return's refund cannot pay the other's bill.${viaPay ? ` The IRS treats tax taken from pay as paid evenly through the year, so having about ${money(S.remaining)} more withheld from ${S.name}'s pay before December keeps ${S.name}'s return clear of the penalty, earlier quarters included${S.balanceAtFiling > S.remaining + 50 ? ` (about ${money(S.balanceAtFiling)} more clears its April bill too)` : ""}. The Withholding check page works out the W-4 change; paying the quarterly amounts below works too.` : ""}`) : null,
    rets && viaPay ? ui.row(ui.h("a", { class: "btn", href: "#/taxes/withholding" }, "Work out the W-4 change")) : null,
    rets && S.penaltyRisk && !viaPay ? ui.h("p", { class: "muted small" }, S.overdue ? `${who ? `${who}payments are` : "You are"} behind starting with the ${S.overdue.label} (due ${fmt.date(S.overdue.due)}). The penalty grows like interest from each due date, so paying now costs less than waiting.` : `The ${S.lateQuarter.label}'s payment came after its due date (${fmt.date(S.lateQuarter.due)}): the IRS charges a small penalty, like interest, from that date until the day it was paid.`) : null,
    hb ? ui.h("p", { class: "lede" }, `${d.year}: about ${money(d.totalTax)} of federal tax, most of it on the ${money(hb.withdrawal)} you take out of your retirement account this year, and ${d.withholding > 0.5 ? `only ${money(d.withholding)}` : "nothing"} held back so far. Tax held back from a withdrawal counts as paid evenly through the year, so asking the firm that holds your IRA to hold back about ${money(hb.amount)} from a withdrawal before December 31 keeps you clear of the penalty, the quarters already past included${hb.whole > hb.amount + 50 ? `; about ${money(hb.whole)} leaves nothing to pay in April` : ""}.`) : null,
    hb ? ui.h("p", { class: "muted small" }, `Then type what was held back under "Federal tax withheld so far" on the Federal estimate, so these pages count it.${d.behind > 0 && d.nextDue ? ` Paying the quarters instead works too: ${money(d.behind)} now for the quarters already past, then ${money(d.nextDue.amount)} by ${fmt.date(d.nextDue.due)}.` : ""}`) : null,
    // the button names what that page shows: this year's required withdrawal, or (none required yet, a draw for spending)
    // the withdrawals themselves (round 8 review: "required" at 50)
    hb ? ui.row(ui.h("a", { class: "btn secondary", href: hb.required > 0.5 ? "#/retirement/rmd" : "#/retirement/withdrawal-strategy" }, hb.required > 0.5 ? "This year's required withdrawal" : "Your IRA withdrawals")) : null,
    rets || hb ? null : viaPay ? ui.h("p", { class: "lede" }, `The IRS treats tax taken from pay as paid evenly through the year, so having about ${money(d.remaining)} more withheld before December avoids the penalty, even for the earlier quarters${d.balanceAtFiling > d.remaining + 50 ? ` (about ${money(d.balanceAtFiling)} more clears the April bill too)` : ""}. The Withholding check page works out the W-4 change; paying the quarterly amounts below works too.`) : null,
    !rets && viaPay ? ui.row(ui.h("a", { class: "btn", href: "#/taxes/withholding" }, "Work out the W-4 change")) : null,
    rets || hb ? null : ui.h("p", { class: viaPay ? "muted small" : "lede" }, !d.hasIncome
      ? "When money comes in with no tax taken out (self-employment, pensions, IRA withdrawals, investment income, a Roth conversion), you pay the tax yourself in four installments through the year, or the IRS charges interest. Add income first."
      : !d.needsEstimates
        ? `${d.year}: ${d.creditsBack > 0.5 ? `no federal tax, and about ${money(d.creditsBack)} of credits come back on top of the ${money(d.withholding)} withheld from pay` : `about ${money(d.totalTax)} of federal tax${d.seTax >= 1 ? ` (self-employment tax included)` : ""}, ${money(d.withholding)} of it withheld from pay`}${d.paid > 0 ? ` and ${money(d.paid)} already paid in estimates` : ""}. ${d.balanceAfterWithholding < 1000 ? "You would owe less than $1,000 when you file, so you do not need to pay quarterly." : "Withholding alone reaches the safe-harbor amount, so no installments are required."}`
        : `${d.year}: about ${money(d.totalTax)} of federal tax${d.seTax >= 1 ? ` (self-employment tax included)` : ""} and ${d.withholdingFrom === "paycheck" ? `about ${money(d.withholding)} withheld from pay (estimated from your paychecks)` : d.withholdingFrom === "mixed" ? `about ${money(d.withholding)} withheld from pay (partly estimated)` : `only ${money(d.withholding)} withheld`}. To stay clear of the penalty you need ${money(d.harbour.required)} paid in during the year (${d.harbour.label}), so ${money(d.toPayByEstimates)} in four payments of ${money(d.perQuarter)}. ${money(d.paid)} paid so far, ${money(d.remaining)} to go.`),
    !rets && !hb && d.behind > 0 && d.nextDue ? ui.h("p", { class: viaPay ? "muted small" : null }, viaPay ? `To pay by quarter instead: ${money(d.behind)} now for the quarters already past, then ${money(d.nextDue.amount)} by ${fmt.date(d.nextDue.due)}.` : `Then ${money(d.nextDue.amount)} by ${fmt.date(d.nextDue.due)}.`) : null,
    !rets && !hb && d.penaltyRisk && !viaPay ? ui.h("p", { class: "muted small" }, d.overdue ? `You are behind starting with the ${d.overdue.label} (due ${fmt.date(d.overdue.due)}). The penalty grows like interest from each due date, so paying now costs less than waiting.` : `The ${d.lateQuarter.label}'s payment came after its due date (${fmt.date(d.lateQuarter.due)}): the IRS charges a small penalty, like interest, from that date until the day it was paid. Paying the rest on time keeps it there.`) : null,
    // nothing earned on file: one button, no $0 tiles (stress test T3)
    !d.hasIncome && !rets && !hb ? ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add your income")) : null,
  ));
  if (rets) root.append(ui.card("Each return", ui.h("ul", { class: "records" }, rets.map(retLine)),
    ui.h("p", { class: "muted small" }, `Your tax for the year in all: about ${money(d.totalTax)}${d.seTax >= 1 ? " (self-employment tax included)" : ""}. The payments typed below go to the return that needs them; you choose how to split them between your returns (IRS Publication 505).`)));
  for (const n of d.notes) if (d.hasIncome || !/^(No income on file|Type last year)/.test(n)) root.append(ui.notice("info", n));

  // the payments: the next one's row on the first view (with any that is behind or due now: a deadline is never folded),
  // the others under "3 more payments" (rest()); paying through withholding instead, a past quarter is not "behind": it is
  // covered once the withholding is raised
  const Q = needing.length === 1 ? S : d;
  // a quarter covered after its due date says so (critic F1): the charge ran from that date (lateCosts); paying through pay or
  // a withdrawal instead, the extra counts as paid evenly through the year, the earlier quarters included (IRC 6654(g))
  const badge = (q, s = q.status) => s === "paid" ? (q.late && !viaPay && !hb ? ui.h("span", { class: "pill" }, "paid late") : ui.h("span", { class: "pill ok" }, "paid")) : s === "short" ? (viaPay || hb ? ui.h("span", { class: "pill" }, "not paid") : ui.h("span", { class: "pill warn" }, "behind")) : s === "due" ? ui.h("span", { class: "pill accent" }, "due now") : s === "upcoming" ? ui.h("span", { class: "pill" }, "upcoming") : null;
  const qRow = (q) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, q.label, " ", badge(q)), ui.h("span", { class: "rec-value" }, money(q.share))),
    ui.h("div", { class: "rec-sub" }, `due ${fmt.date(q.due)} · covers ${q.covers}${d.quarters[q.n - 1].paid > 0 ? ` · ${money(d.quarters[q.n - 1].paid)} paid` : ""}`));
  if ((d.hasIncome || rets) && Q.needsEstimates) {
    // paying through withholding or a withdrawal instead, a past quarter "not paid" is no deadline: it waits with the others
    const keep = (q) => (q.status === "short" && !viaPay && !hb) || q.status === "due" || (!!Q.nextDue && q.due === Q.nextDue.due);
    const rows = Q.quarters.some(keep) ? rest(ctx, { id: "payments", items: Q.quarters, row: qRow, first: 0, noun: "payments", one: "payment", keep }) : [ui.h("ul", { class: "records" }, Q.quarters.map(qRow))];
    root.append(ui.card(`The four payments for ${d.year}${needing.length === 1 ? `, on ${S.name}'s return` : ""}`, ...rows,
      ui.h("p", { class: "muted small" }, "Pay at irs.gov/payments (Direct Pay, free) or with Form 1040-ES vouchers, then type each payment under “What you paid” so the Federal estimate page counts it.")));
  }

  // the payment boxes: open when the page sends you to type them (a payment behind and none typed yet: Needs attention and
  // Next best action say "type what you paid on Estimated payments"), and after their own save (R17)
  const paidNow = plan.taxes?.estimated?.paid ?? [0, 0, 0, 0];
  const FIELDS = d.quarters.map((q, i) => ({ key: `q${i}`, label: `${q.label} (due ${fmt.date(q.due)})`, type: "money", min: 0, help: `covers ${q.covers}` }));
  const values = Object.fromEntries(d.quarters.map((q, i) => [`q${i}`, paidNow[i] || null]));
  const form = ui.form(FIELDS, values, (v) => {
    pending = { part: "paid", said: "Payments saved.", before: head, safe: Q.harbour?.required ?? null };
    store.update((p) => { p.taxes.estimated = { ...(p.taxes.estimated ?? {}), paid: [0, 1, 2, 3].map((i) => v[`q${i}`] ?? 0), typedAt: fmt.today() }; });
  }, { submitLabel: "Save payments" });
  const askPaid = Q.needsEstimates && Q.behind > 0 && !d.paidTyped && !viaPay && !hb;

  const pr = plan.taxes?.priorYear ?? {};
  // the 110% line is half for a married person filing separately (IRC 6654(d)(1)(C); safeHarbour already works it so)
  const over110 = d.filingStatus === "married_separate" ? "$75,000" : "$150,000";
  const priorForm = ui.form([
    { key: "tax", label: "Last year's total tax", type: "money", min: 0, help: "Form 1040 line 24" },
    { key: "agi", label: "Last year's income before deductions (adjusted gross income)", type: "money", min: 0, help: `On last year's federal return, line 11 of Form 1040; over ${over110} raises the safe harbor to 110%${d.filingStatus === "married_separate" ? " (filing separately)" : ""}` },
  ], { tax: pr.tax ?? null, agi: pr.agi ?? null }, (v) => {
    pending = { part: "prior", said: "Last year's figures saved.", before: head, safe: Q.harbour?.required ?? null };
    store.update((p) => { p.taxes.priorYear = { ...(p.taxes.priorYear ?? {}), tax: v.tax ?? null, agi: v.agi ?? null }; });
  }, { submitLabel: "Save" });

  // the four figures (or each return's balance), what paying late costs
  const tiles = rets ? rets.map((x) => ui.stat(`${x.name}: at filing time`, money(Math.abs(x.balanceAtFiling)), `${x.balanceAtFiling >= 0 ? "still to pay" : "refund"}; ${x.needsEstimates ? `${money(x.perQuarter)} a quarter by estimates` : "no estimates needed"}`)) : [
    ui.stat("Safe amount", money(d.harbour.required), d.harbour.label),
    ui.stat("Withholding covers", money(d.withholding), d.withholdingFrom === "paycheck" ? "estimated from your pay" : d.withholdingFrom === "mixed" ? "partly estimated from pay" : "Withholding check page"),
    ui.stat("By estimates", money(d.toPayByEstimates), d.needsEstimates ? `${money(d.perQuarter)} a quarter` : "none needed"),
    ui.stat("At filing time", money(Math.abs(d.balanceAtFiling)), d.balanceAtFiling >= 0 ? "still to pay" : "refund"),
  ];
  const L = lateCosts(Q, { today: fmt.today(), via: viaPay ? "pay" : hb ? "withdrawal" : null });
  const lw = L ? lateWords(L, { money, money2: (n) => fmt.money(n, cur, "en-US", 2), date: fmt.date }) : null;
  const more = parts(ctx,
    (d.hasIncome || rets) && { id: "numbers", kind: "more", n: tiles.length, noun: "numbers", one: "number", body: () => ui.row(tiles) },
    (d.hasIncome || rets) && { id: "paid", kind: "own", title: "What you paid", says: d.paidTyped ? `${money(d.paid)} paid` : "", missing: !d.paidTyped,
      holds: FIELDS.map((f) => f.key), open: just?.part === "paid" || askPaid, body: [ui.h("p", { class: "muted small" }, "What you have sent the IRS for this year, each in the box of the quarter you paid it for. The Federal estimate page counts it."), form] },
    { id: "prior", kind: "own", title: "Last year's return", says: d.hasPrior ? `tax ${money(d.priorTax)}` : "", missing: !d.hasPrior, holds: ["tax", "agi"], open: just?.part === "prior",
      body: [ui.h("p", { class: "muted small" }, `The safe harbor rule: no penalty if what is withheld and what you pay in installments reach 90% of this year's tax or 100% of last year's (110% if last year's income was over ${over110}${d.filingStatus === "married_separate" ? ", the line for a married person filing separately" : ""}). You know last year's figure for certain, while this year's is only a forecast, so most people go by last year's.`), priorForm] },
    lw && { id: "late", kind: "how", title: "What paying late costs", says: lw.says, body: () => [ui.h("p", {}, lw.lead), ...lw.lines.map((l) => ui.h("p", { class: "muted small" }, l))] });
  if (more) root.append(more);

  // the green line names the new answer when the save changed it (R7); drawn at the foot of the page (the shell repeats it at
  // the bottom of the screen): put in above the form, it moved "Save payments" 76 px down under the thumb (stress test T4)
  if (just) {
    const safe = Q.harbour?.required ?? null;
    const said = head !== just.before ? `${just.said} ${head}.`
      : just.part === "prior" && safe !== null && just.safe !== null && Math.abs(safe - just.safe) >= 0.5 ? `${just.said} The safe amount is now ${money(safe)} (${Q.harbour.label}).`
      : just.said;
    const n = ui.notice("ok", said);
    root.append(n);
    setTimeout(() => n.remove(), 4000);
  }
}
