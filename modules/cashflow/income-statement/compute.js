// modules/cashflow/income-statement/compute.js -- PURE. Month by month: what came in, what
// went out, what was kept, from the transactions (transfers excluded). Next to it, what the
// Income and Expenses pages say should happen each month, so the two can be compared.
import { allLines, countOnce, isTransfer, monthOf, monthLabel, coverage, monthCover, COVER_SLACK, shortDate, coverageByAccount, monthGaps, gapIssues, wholeMonth, allUnimportedCardLines, unimportedCardLines, cardLineLabel, beforeLabel, monthsWords, unsureCardPayments, unsureWords, bringWords, theCard } from "../../transactions/ledger/compute.js";
import { categoryById, categoryLabel, categoryIcon } from "../../transactions/categories/compute.js";
import { compute as computeIncome } from "../income/compute.js";
import { perMonth, activeOn } from "../../../core/math/periods.js";
import { compute as computeExpenses, CATEGORIES, ROW_HOLDS, guessedSetupRow, mortgageLines } from "../expenses/compute.js";
import { compute as computePayoff } from "../../debt/payoff/compute.js";
import { takeHome } from "../paycheck/compute.js";

/** Plan versus real: money in from the bank more than this share below the plan's take-home is a gap worth a look (two paychecks in a month of a pay every two weeks are 12/13 of the average month, 7.7% below). */
export const IN_BAND = 0.1;

/** A line's group on the out side: its category, or for a card's stand-in line that card. */
const keyOf = (t) => (t.synthetic ? `${t.category}:${t.cardId}` : t.category || "");

/**
 * compute(plan, { months = 12, today }) -> {
 *   rows: [{ ym, label, in, out, net, rate, count, uncategorised, complete, cards, cardsBy, holes, whole, missing }] newest first
 *     (`complete` = a full month before today; `cards` = the payments to cards on days their own file does not cover, counted in
 *     `out` as spending (2026-11-02), `cardsBy` = that per card [{ cardId, name, total }]; `holes` = how many gaps monthGaps finds in the month (a hole in an account's files, an account
 *     whose lines stop early or start late, a payment counted for neither card); `whole` = complete with none; `missing` = those
 *     gaps in short words; `unsure` / `daysMissing`: which kinds they are, for the row's label),
 *   totals: { in, out, net, rate } over the rows, average: { in, out, net, months } over whole months (a month missing a
 *     paycheck and the mortgage would make the typical month wrong),
 *   leftOut: [{ yms, why }] the complete months left out of the typical month, grouped by their first gap ("Chase checking has
 *     no lines from 7/31 to 8/2" for July and August), the group with the newest month first (re-check 5, 2026-11-05: the page
 *     names the first two, and the oldest were not the ones that matter),
 *   planned: { in (before tax), takeHomeIn (salaries at take-home, Paycheck page), takeHome (true when that differs), out, net (before tax) } | null
 *     (from the Income/Expenses pages), inGap: average money in from the bank minus takeHomeIn | null, inShort: inGap below IN_BAND of takeHomeIn,
 *   byCategory: { in: [...], out: [...] } over the rows,
 *   hasData
 * }
 * Income = money in; spending = money out; a transaction whose category is an income kind counts as income even if negative (a refund of income), and vice versa.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const want = Math.max(1, Number(params.months ?? 12));
  // the bank lines, plus a stand-in spending line for each payment to a card on a day its own file does not cover
  const covBy = coverageByAccount(plan);
  // (a purchase split across categories comes as one line per part, counted once in the month's lines: ledger allLines, gap #24)
  const txs = [...allLines(plan).filter((t) => !isTransfer(t, plan)), ...allUnimportedCardLines(plan, { today, covBy })];
  const months = new Map(), once = countOnce();   // a split purchase is one line of its month, whichever parts are kept
  const cat = { in: new Map(), out: new Map() };
  for (const t of txs) {
    const ym = monthOf(t.date); if (!ym) continue;
    const m = months.get(ym) ?? { ym, label: monthLabel(ym), in: 0, out: 0, count: 0, uncategorised: 0, cards: 0 };
    const amt = Number(t.amount) || 0;
    const kind = t.synthetic ? "expense" : categoryById(plan, t.category)?.kind ?? (amt >= 0 ? "income" : "expense");
    if (kind === "income") m.in += amt; else m.out += -amt;
    if (t.synthetic) { m.cards += -amt; const b = (m.cardsBy ??= []).find((x) => x.cardId === t.cardId); if (b) b.total += -amt; else m.cardsBy.push({ cardId: t.cardId, name: t.cardName, total: -amt }); }
    else if (once(t)) { m.count++; if (!t.category) m.uncategorised++; }
    months.set(ym, m);
    const side = kind === "income" ? "in" : "out";
    const key = keyOf(t);
    const c = cat[side].get(key) ?? (t.synthetic ? { category: t.category, cardId: t.cardId, cardName: t.cardName, unimported: true, label: t.payee, icon: "💳", total: 0, count: 0, months: new Set(), before: true, first: t.first ?? null } : { category: key, label: categoryLabel(plan, key), icon: categoryIcon(plan, key), total: 0, count: 0 });
    c.total += side === "in" ? amt : -amt; c.count++;
    if (t.synthetic) { c.months.add(ym); if (!t.before) c.before = false; }
    cat[side].set(key, c);
  }
  // a card's stand-in line names its months when it is not in every month that is over: "Visa card (July), details not
  // imported yet" once the Visa's file is in from August (2026-11-02)
  const thisMonth = today ? String(today).slice(0, 7) : null;
  const over = [...months.keys()].filter((ym) => !thisMonth || ym < thisMonth);
  // ...and "Visa card (July), before its file starts on 8/1" when every payment is dated before its first line (re-check 4)
  for (const c of cat.out.values()) if (c.unimported) {
    const yms = [...c.months].sort();
    if (c.before && c.first) c.label = beforeLabel(`${c.cardName || "Card"} (${monthsWords(yms)})`, c.first);
    else if (over.some((ym) => !c.months.has(ym))) c.label = cardLineLabel(`${c.cardName || "Card"} (${monthsWords(yms)})`);
    c.months = yms;
  }
  const cov = coverage(plan);
  const rows = [...months.values()].sort((a, b) => b.ym.localeCompare(a.ym)).slice(0, want)
    .map((m) => {
      const complete = thisMonth ? m.ym < thisMonth : true;
      const g = monthGaps(plan, m.ym, today, covBy), issues = gapIssues(plan, { ...g, cards: [] }, m.ym), missing = issues.map((x) => x.why);
      // whole: the one question Spending, Budget and bank versus plan ask (ledger wholeMonth: the files together reach both
      // ends, and no account's files have a hole in it, stop early or start late; re-check 2026-11-02)
      const whole = complete && wholeMonth(plan, m.ym, today, { cov, covBy });
      // why a month that is over is not whole: its first gap, or where the files together start or stop in it
      const mc = monthCover(cov, m.ym, today);
      const why = whole || !complete ? null : missing[0] ?? (!mc.days ? "no bank file reaches it" : mc.firstDay > 1 + COVER_SLACK ? `your files start on ${shortDate(mc.from)}` : `your files stop on ${shortDate(mc.to)}`);
      // `unsure`: a payment counted for neither card (its one sentence is in `missing`); `daysMissing`: a gap in an account's days
      return { ...m, cardsBy: m.cardsBy ?? [], net: m.in - m.out, rate: m.in > 0 ? (m.in - m.out) / m.in : null, complete, holes: missing.length, whole, missing, why,
        unsure: issues.some((x) => x.kind === "unsure"), daysMissing: issues.some((x) => x.kind !== "unsure"), kinds: issues.map((x) => x.kind) };
    });
  // the complete months left out of the typical month, grouped by the gap they share (one hole across July and August)
  const leftOut = [];
  for (const r of [...rows].reverse()) if (r.complete && !r.whole) { const g = leftOut.find((x) => x.why === r.why); if (g) g.yms.push(r.ym); else leftOut.push({ yms: [r.ym], why: r.why }); }
  leftOut.sort((a, b) => b.yms[b.yms.length - 1].localeCompare(a.yms[a.yms.length - 1]));
  const sum = (arr, k) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const totals = { in: sum(rows, "in"), out: sum(rows, "out") };
  totals.net = totals.in - totals.out; totals.rate = totals.in > 0 ? totals.net / totals.in : null;
  const full = rows.filter((r) => r.whole);
  // `cards`: of the typical month's money out, what went to cards whose file isn't in (their stand-in lines), and per card
  const cardsAvg = new Map();
  for (const r of full) for (const c of r.cardsBy ?? []) { const x = cardsAvg.get(c.cardId) ?? { cardId: c.cardId, name: c.name, monthly: 0 }; x.monthly += c.total / full.length; cardsAvg.set(c.cardId, x); }
  const average = full.length ? { in: sum(full, "in") / full.length, out: sum(full, "out") / full.length, net: (sum(full, "in") - sum(full, "out")) / full.length, months: full.length,
    cards: sum(full, "cards") / full.length, cardsBy: [...cardsAvg.values()].sort((a, b) => b.monthly - a.monthly) } : null;
  const inc = (plan.income ?? []).length ? computeIncome(plan, { today }) : null;
  const exp = (plan.expenses ?? []).length ? computeExpenses(plan, { today }) : null;
  // the bank sees pay after tax: the plan's money in is compared at take-home (each salary at its earner's share)
  const th = inc ? takeHome(plan, { today }) : null;
  const takeHomeIn = th ? th.monthly : 0;
  const planned = inc || exp ? { in: inc?.monthly ?? 0, takeHomeIn, takeHome: !!th && Math.abs(takeHomeIn - (inc?.monthly ?? 0)) > 0.5, out: exp?.monthly ?? 0, net: (inc?.monthly ?? 0) - (exp?.monthly ?? 0) } : null;
  const inGap = planned && average && inc ? average.in - takeHomeIn : null;
  const inShort = inGap !== null && inGap < 0 && -inGap > Math.max(50, IN_BAND * takeHomeIn);
  const top = (map) => [...map.values()].sort((a, b) => b.total - a.total);
  return { rows, totals, average, leftOut, planned, inGap, inShort, byCategory: { in: top(cat.in), out: top(cat.out) }, hasData: rows.length > 0, monthsWanted: want };
}

/** Bank versus plan: the bank shows more going out than Expenses lists by at least this much a month, and this share of it. */
export const BANK_OVER = { dollars: 200, share: 0.1, minMonths: 2, maxMonths: 6, lineAtLeast: 50 };
/**
 * bankVsPlan(plan, { today }) -> null | { months, bankOut, planOut, gap, over, lines: [{ category, label, icon, essential, bank, plan, more, ours? }],
 *   unfiled, cards, cardsUnfiled: [{ accountId, name, monthly }], gapWithCards, cardsGap, cardFile, unsure: [{ ym, text }] } (all a month)
 * What the bank files show going out, on average over the whole months they cover (the last BANK_OVER.maxMonths, at least
 * minMonths; ledger's wholeMonth: a month with a hole in an account's files, an account stopping early or starting late, or a
 * payment counted for neither card is not whole; transfers between your own accounts left out), against what the Expenses page
 * lists (plus a saved Pay off debts extra). Taxes are left out on both sides (they come off income elsewhere). `over` when the
 * bank shows at least BANK_OVER.dollars and BANK_OVER.share more.
 * A card whose own file is missing (re-check 4, 2026-11-02): its payments from checking stand in for what it bought, but nobody
 * has seen what that was, so they are never in `bankOut`, `gap` or `over` (Expenses cannot offer a kind for them, and "add what
 * your bank shows" could never be finished): they are `cards` a month and `cardsUnfiled` per card. `gapWithCards` = gap + cards;
 * `cardsGap` when the gap is mostly that: not `over`, but `gapWithCards` would be. Then the move is "Bring in the Visa file":
 * `cardFile` = { accountId, name, title "Bring in the Visa file", the "the Visa card", monthly (every such card), months (how
 * many were looked at), whole (they are whole months), plural (several cards: "Bring in the card files", "your Chase cards"),
 * href } | null.
 * `unsure`: the months looked at that are left out because a payment went to one of two cards and neither file is in (one sentence
 * each, ledger unsureWords).
 * Two cards at one bank and no file for either (re-check 5, 2026-11-05): no month is whole, but some are whole but for those
 * payments (no hole, no account stopping early or starting late). When those and the whole months make at least minMonths,
 * they are looked at the same way, the payments counted for neither card added to `cards`; when `gapWithCards` would be over,
 * the result is `months` 0 (nothing compared), not `over`, `cardsGap`, and `cardFile` for those cards ("Bring in the card
 * files", "your Chase cards", whole false), so the Dashboard, Needs attention and Expenses say what they say for one card.
 * Otherwise null. `lines`: each spending kind the bank shows at least lineAtLeast a month more of than Expenses
 * lists, largest first; `unfiled`: bank spending not filed under a kind yet. Round 4 (2026-11-02): the Dashboard, Next best
 * action and the Forecast were worked out from the typed Expenses only, so a household whose bank showed it short was told
 * "Your month works".
 */
export function bankVsPlan(plan, params = {}) {
  const today = params.today ?? null;
  const txs = allLines(plan).filter((t) => !isTransfer(t, plan));
  if (!txs.length || !today || !(plan.expenses ?? []).length) return null;
  const cov = coverage(plan), covBy = coverageByAccount(plan);
  const thisMonth = String(today).slice(0, 7);
  // whole months only: the files reach both ends, no account's files have a hole in it, stop early or start late (2026-11-02)
  const over = [...new Set(txs.map((t) => monthOf(t.date)).filter((m) => m && m < thisMonth))].sort().reverse();
  const whole = new Set(over.filter((ym) => wholeMonth(plan, ym, today, { cov, covBy })));
  let yms = [...whole].slice(0, BANK_OVER.maxMonths);
  // too few whole months: those whole but for payments counted for neither card can say "bring in the card files" (re-check 5)
  let unsureOnly = null;
  if (yms.length < BANK_OVER.minMonths) {
    unsureOnly = new Map();
    for (const ym of over) {
      if (whole.has(ym) || !monthCover(cov, ym, today).full) continue;
      const g = monthGaps(plan, ym, today, covBy);
      if (g.unsure && !g.holes.length && !g.short.length && !g.late.length) unsureOnly.set(ym, g.unsure);
    }
    yms = over.filter((ym) => whole.has(ym) || unsureOnly.has(ym)).slice(0, BANK_OVER.maxMonths);
    if (!yms.some((ym) => unsureOnly.has(ym)) || yms.length < BANK_OVER.minMonths) return null;
  }
  const inWindow = new Set(yms);
  // the months looked at that are left out only for a payment counted for neither card: said in one sentence each
  const oldest = yms[yms.length - 1];
  const unsure = unsureOnly ? yms.filter((ym) => unsureOnly.has(ym)).map((ym) => ({ ym, text: `${unsureWords(plan, unsureOnly.get(ym), ym)}.` }))
    : over.filter((ym) => ym >= oldest && !inWindow.has(ym)).map((ym) => ({ ym, u: unsureCardPayments(plan, ym, { today, covBy }) })).filter((x) => x.u)
      .map(({ ym, u }) => ({ ym, text: `${unsureWords(plan, u, ym)}.` }));
  const byCat = new Map();
  let out = 0, unfiled = 0, cards = 0;
  const perCard = new Map();
  // a card whose own file is missing: its payments stand in for what it bought, apart from bankOut (no kind, nobody has seen it)
  for (const ym of yms) for (const t of unimportedCardLines(plan, ym, { today, covBy })) {
    const amt = -(Number(t.amount) || 0);
    cards += amt;
    const c = perCard.get(t.cardId) ?? { accountId: t.cardId, name: t.cardName, monthly: 0 };
    c.monthly += amt; perCard.set(t.cardId, c);
  }
  // ...and in a month whole but for them, the payments counted for neither card (they went to one of the cards; re-check 5)
  const unsureIds = [];
  for (const [ym, u] of unsureOnly ?? []) if (inWindow.has(ym)) { cards += u.paid; for (const id of u.cardIds) if (!unsureIds.includes(id)) unsureIds.push(id); }
  const exp = computeExpenses(plan, { today });
  // a mortgage counted from Debts (not typed under housing on Expenses): the bank's housing line that is its payment (named so,
  // within 10% of it, or its servicer's line every month: Expenses mortgageLines) is compared with loan payments, where the plan
  // counts it, up to the payment on Debts; what goes to the servicer beyond it (the home's tax and insurance, or a payment typed
  // low) stays a home cost, as the spending guesses read it. Under housing it read as that much more spent on the home than
  // planned, and "Use" on our home-costs row counted the mortgage twice (C7; review M2: "MR COOPER", "PENNYMAC LOAN SVC")
  // (Expenses' fromDebts: the debts counted from Debts, by their account)
  const mortgagePay = exp.fromDebts.filter((f) => (plan.accounts ?? []).find((a) => a.id === f.id)?.type === "mortgage").reduce((s, f) => s + (Number(f.monthly) || 0), 0);
  const housingOut = txs.filter((t) => inWindow.has(monthOf(t.date)) && t.category === "housing" && (Number(t.amount) || 0) < 0 && (categoryById(plan, t.category)?.kind ?? "expense") === "expense")
    .map((t) => ({ t, ym: monthOf(t.date), out: -(Number(t.amount) || 0) }));
  const servicer = mortgageLines(housingOut, yms, mortgagePay), payLeft = new Map();
  for (const t of txs) {
    if (!inWindow.has(monthOf(t.date))) continue;
    const amt = Number(t.amount) || 0;
    const c = categoryById(plan, t.category);
    const kind = c?.kind ?? (amt >= 0 ? "income" : "expense");
    if (kind !== "expense") continue;
    const key = CATEGORIES[t.category] ? t.category : t.category ? "other" : "";
    if (key === "taxes") continue;
    out += -amt;
    if (servicer.has(t)) {
      const ym = monthOf(t.date), left = payLeft.has(ym) ? payLeft.get(ym) : mortgagePay, toDebt = Math.min(-amt, left);
      payLeft.set(ym, left - toDebt);
      byCat.set("debt", (byCat.get("debt") ?? 0) + toDebt);
      if (-amt - toDebt > 0) byCat.set("housing", (byCat.get("housing") ?? 0) + (-amt - toDebt));
      continue;
    }
    if (!key) unfiled += -amt; else byCat.set(key, (byCat.get(key) ?? 0) - amt);
  }
  const n = yms.length;
  const planCat = new Map(exp.byCategory.map((c) => [c.category, c.monthly]));
  let extra = 0;
  try { const pay = computePayoff(plan, { today }); extra = pay?.hasData && pay.extra > 0 ? pay.extra : 0; } catch { extra = 0; }
  const planOut = exp.monthly - (planCat.get("taxes") ?? 0) + extra;
  const bankOut = out / n;
  const gap = bankOut - planOut;
  // one of Get started's rows that is still our guess holds several kinds at once ("Eating out and fun" holds fun,
  // subscriptions and pets: Expenses' ROW_HOLDS), so the bank is compared with the row as a whole: one line, named as the row,
  // whose `ours` says which row "Add" sets to what the bank shows (addFromBank). A bill added beside our guess came off it
  // again at the next save (C3 review D3). Only for a plan with such a row; every other plan's lines are as before.
  const ourRows = (plan.expenses ?? []).filter((x) => ROW_HOLDS[x.category] && x.id === `setup-x-${x.category}` && (!today || activeOn(x, today)) && guessedSetupRow(plan, x));
  // "Shopping and everything else" holds every kind in no row too (travel, gifts, other, one of your own), as the spending
  // guesses read the bank files (R12, C7): a line for them beside our row would count them twice
  const held = new Set(Object.values(ROW_HOLDS).flat());
  const rest = [...new Set([...byCat.keys(), ...planCat.keys()])].filter((c) => !held.has(c) && c !== "debt" && c !== "taxes");
  const holdsOf = (row) => (row === "shopping" ? [...ROW_HOLDS.shopping, ...rest] : ROW_HOLDS[row]);
  const grouped = new Map(ourRows.flatMap((r) => holdsOf(r.category).map((c) => [c, r])));
  const lineOf = (category, bank, planned) => ({ category, label: CATEGORIES[category].label, icon: CATEGORIES[category].icon, essential: CATEGORIES[category].essential, bank, plan: planned, more: bank - planned });
  const lines = [
    ...[...byCat].filter(([category]) => !grouped.has(category)).map(([category, total]) => lineOf(category, total / n, (planCat.get(category) ?? 0) + (category === "debt" ? extra : 0))),
    ...ourRows.map((r) => {
      const holds = holdsOf(r.category), bank = holds.reduce((t, c) => t + (byCat.get(c) ?? 0), 0) / n, planned = holds.reduce((t, c) => t + (planCat.get(c) ?? 0), 0);
      const amount = perMonth(r.amount, r.period);
      // kind by kind, what the bank shows less what is typed beside our row (the row is in its own kind's figure): "Use" writes
      // each kind on its own, as the card compares them once the row is the person's (C3 verify: "Use $390" on Utilities and
      // phone, then "Add $170" Phone and internet, counted the phone twice)
      const parts = Object.fromEntries(holds.map((c) => [c, Math.max(0, (byCat.get(c) ?? 0) / n - ((planCat.get(c) ?? 0) - (c === r.category ? amount : 0)))]));
      return { ...lineOf(r.category, bank, planned), label: r.name || CATEGORIES[r.category].label, essential: r.essential ?? CATEGORIES[r.category].essential, ours: { id: r.id, amount, to: Math.max(0, Math.round((amount + bank - planned) / 10) * 10), parts } };
    }),
  ].filter((x) => x.more >= BANK_OVER.lineAtLeast).sort((a, b) => b.more - a.more);
  const overBy = (g) => g >= Math.max(BANK_OVER.dollars, BANK_OVER.share * planOut);
  const cardsUnfiled = [...perCard.values()].map((c) => ({ ...c, monthly: c.monthly / n })).sort((a, b) => b.monthly - a.monthly);
  // in a month whole but for payments counted for neither card, the bank's own lines are a floor: what the cards bought only
  // adds to it, so a gap over the line is over whatever they bought (verify 5, 2026-11-05: it was hidden behind the card files)
  const isOver = overBy(gap), gapWithCards = gap + cards / n;
  const compared = !unsureOnly || isOver;
  // the cards whose files would say: those standing in, then those a payment counted for neither may have gone to
  const accounts = plan.accounts ?? [];
  const fileIds = [...cardsUnfiled.map((c) => c.accountId), ...unsureIds.filter((id) => !perCard.has(id))];
  const cardsGap = !isOver && fileIds.length > 0 && overBy(gapWithCards);
  if (unsureOnly && !cardsGap && !isOver) return null;
  const c0 = accounts.find((a) => a.id === fileIds[0]) ?? { id: fileIds[0], name: cardsUnfiled[0]?.name };
  const plural = fileIds.length > 1;
  const banks = new Set(fileIds.map((id) => String(accounts.find((a) => a.id === id)?.institution ?? "").trim()));
  const bank = banks.size === 1 ? [...banks][0] : "";
  const cardFile = cardsGap ? { accountId: c0.id, name: c0.name, title: plural ? "Bring in the card files" : bringWords(c0.name).replace(/\.$/, ""),
    the: plural ? `your ${bank ? `${bank} ` : ""}cards` : theCard(c0.name), monthly: cards / n, months: n, whole: !unsureOnly, plural, href: `#/transactions/import?accountId=${encodeURIComponent(c0.id)}` } : null;
  return { months: compared ? n : 0, bankOut, planOut, gap, over: isOver, lines: compared ? lines : [], unfiled: unfiled / n, cards: cards / n, cardsUnfiled, gapWithCards, cardsGap, cardFile, unsure };
}
