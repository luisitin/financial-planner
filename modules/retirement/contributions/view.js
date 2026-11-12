// modules/retirement/contributions/view.js -- DOM only. What goes into each retirement account
// a year, with the match and the limits, and one folded form to add or edit.
import { compute, taxPairOf, applyTaxChoice, applyMatchAtWork, catchUpRothWords, rothAccountName, rothPartName, rothRenameOf, isLaterAccount, isNowAccount, TAX_RULE_OF_THUMB, ROTH_MATCH_WORDS } from "./compute.js";
// this year's federal tax with and without a split, and the money when retirement starts by when its tax is paid (spec L6)
import { compute as federalOf } from "../../taxes/federal/compute.js";
// the month's own federal and state income tax (the figures Next best action takes off the month): what paying the tax now
// takes from take-home pay (review 2026-11-12, M4)
import { yearTaxes } from "../../cashflow/budget-percent/compute.js";
import { PERIOD_OPTIONS, perYear } from "../../../core/math/periods.js";
import { readAmount, amountText } from "../../../core/format.js";
import { clearGuess, isGuess, markGuess } from "../../../core/estimate/index.js";
import { jobPayOf as payOf, matchTerms } from "../../overview/guesses/estimators/saving.js";
import { BUCKET_OF } from "../projection/compute.js";
import { nameIn, NameIn, nameOf, NameOf, verbFor } from "../../../core/words.js";
import { leftWords } from "../../overview/next-best-action/compute.js";
import { workLanding, workRows, matchLanding, matchChecks, answerOf, answerChangeWords, usualMatchAt, mixAtRetirement, mixWords } from "../levers.js";

let pending = null;
// "Yes: add what Bo puts in" opens the add form with Bo and Bo's 401(k) already chosen
let prefill = null;
let prefillNote = null;   // a line over the form saying what it was filled in with
/** A contribution's period for a number of paychecks a year (Work benefits' `paychecks`); anything else goes in once a year. */
const PERIOD_FOR = { 52: "weekly", 26: "biweekly", 24: "semimonthly", 12: "monthly" };
// the retirement answer before a save on this page, so the notice after it can say "now runs out at 76 (was 66)" (spec L3)
let before = null;
// a link from "What this rests on" (Will the money last?) lands once per arrival: ?add=<pid> on what goes in, ?match=<rowId> on
// the match box; a redraw after a save keeps the same route object and is not brought back to it (as ?show= on Assumptions)
let landedFor = null;
/** A person's own rows (theirs, or a household row into an account they own). */
const rowsOfPerson = (p, pid) => (p.retirement?.contributions ?? []).filter((c) => c.personId === pid || (!c.personId && (p.accounts ?? []).find((a) => a.id === c.accountId)?.ownerId === pid));
const hasMatch = (p, pid) => rowsOfPerson(p, pid).some((c) => Number(c.employerMatch) > 0);
/**
 * A save that puts a match on a row of a person who had said "no match at this job" takes that answer back in the same save
 * (review 2026-11-12, P9: "No match at Jamie's job" stood over "employer adds $2,040 a year"). `hadMatch`: the ids of the
 * people who had a match on a row before the save.
 */
export function matchTakesBackNo(draft, hadMatch) {
  for (const [pid, wp] of Object.entries(draft.retirement?.workPlans ?? {})) if (wp?.match === false && !hadMatch.has(pid) && hasMatch(draft, pid)) delete wp.match;
}
/** The retirement verdict in the page's own words, for "Before: ... Now: ..." after a save that turned it (P6). */
const VERDICT_WORDS = { "on track": "the money lasts to the end of the plan", tight: "the money lasts, with little to spare", short: "the money runs out before the end of the plan" };
/** fn() once the page has been painted (the boxes are on the page then). */
const afterPaint = (fn) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => setTimeout(fn, 0)) : setTimeout(fn, 0));
const pctText = (x) => `${Number((x * 100).toFixed(1))}%`;
/** The usual match in words, from the same table as the guesses (Vanguard, How America Saves 2026; matchTerms, spec D-A4). */
export function usualMatchWords() {
  const t = matchTerms();
  return `about ${pctText(t.value)} of pay when you put in ${pctText(t.needed)} (Vanguard, How America Saves 2026)`;
}

/** What the amount box holds: dollars ({ amount }), a share of pay ({ pct }, a fraction), blank (null) or neither ({ bad }). "6%" is 0.06. */
export function readAmountOrShare(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const m = /^(\d*\.?\d+)\s*%$/.exec(t);
  if (m) return { pct: Number(m[1]) / 100 };
  const n = readAmount(t);
  return n === null || n < 0 ? { bad: true } : { amount: n };
}

/**
 * Save the edit form over a row. The share kept from "6%" goes (it is set again by `clean` when the new text is a share); a guess
 * on the amount ends when the amount or the period changed (a changed period is the person's own, and a guess is only ever
 * monthly dollars), and one on the match when the match changed.
 */
/** Above this much a year a contribution is taken for a typing slip and refused (R-A10). Far above the law's limits on retirement
 * accounts; a brokerage account has none, so it is generous. */
export const CONTRIBUTION_YEARLY_CEILING = 500000;

export function applyContributionEdit(p, id, clean) {
  const i = (p.retirement.contributions ?? []).findIndex((c) => c.id === id);
  if (i < 0) return;
  const { pctOfPay: _gone, ...rest } = p.retirement.contributions[i];
  p.retirement.contributions[i] = { ...rest, ...clean };
  // any save of the form is the person's own word, equal to our guess or not (spec S2): both guesses end
  clearGuess(p, `retirement.contributions[${id}].amount`);
  clearGuess(p, `retirement.contributions[${id}].employerMatch`);
}

/**
 * The edit form's first values for a row. A figure that is still our guess opens grey (an empty box with the guess as its
 * placeholder), never as typed text (spec P2). -> { values, amountHint, matchHint } (a hint is "" when that figure is typed)
 */
export function contributionFormStart(plan, row) {
  const gAmt = isGuess(plan, `retirement.contributions[${row.id}].amount`), gMatch = isGuess(plan, `retirement.contributions[${row.id}].employerMatch`);
  return { values: { ...row, amount: gAmt ? "" : row.amount, employerMatch: gMatch ? "" : row.employerMatch }, amountHint: gAmt ? String(row.amount) : "", matchHint: gMatch ? String(row.employerMatch) : "" };
}
/** A box left empty on a form that opened with a grey guess keeps the guess: saving it makes the figure the person's. */
export function fillBlankFromGuess(v, start) {
  const blank = (x) => x === "" || x === null || x === undefined;
  // the grey guess is a figure in the period the row had; if How often changed meanwhile it is carried over, so $270 a month stays $270 a month
  const was = start.values?.period ?? "monthly", carried = v.period && v.period !== was ? Math.round(Number(start.amountHint) * perYear(1, was) / perYear(1, v.period) * 100) / 100 : start.amountHint;
  return { ...v, ...(start.amountHint !== "" && blank(v.amount) ? { amount: String(carried) } : {}), ...(start.matchHint !== "" && blank(v.employerMatch) ? { employerMatch: Number(start.matchHint) } : {}) };
}

/**
 * "Will the money last?" in one sentence, from Get started's standing: the verdict; while it rests mostly on our guesses
 * (`retireGuessed`, spec 8.1: "never 'Short at 65' on guesses alone") it is said as ours, with what to type first.
 */
export function verdictWords(st) {
  const r = st?.retire ?? null;
  if (!st?.retirementKnown) return `Once ${st?.retirementMissing ?? "Social Security"} ${/ and |dates/.test(st?.retirementMissing ?? "") ? "are" : "is"} in the plan, this says whether that is enough.`;
  if (!r) return "";
  if (st.retireGuessed) {
    const would = r.verdict === "on track" ? "the money would last to the end of the plan" : r.verdict === "tight" ? "the money would last, with little to spare" : `the money would run out${r.shortAge ? ` at about ${r.shortAge}` : ""}`;
    return `By our guesses, ${would}. It rests on our guesses of ${st.retireGuessedWhat === "balance" ? "your savings, so type what is in your retirement accounts" : st.retireGuessedWhat === "saving" ? "what you put in each month, so check the amounts below" : "your spending, so type what you really spend"} to know.`;
  }
  return r.verdict === "on track" ? "At this rate the money lasts to the end of the plan: you are on track."
    : r.verdict === "tight" ? "At this rate the money lasts, with little to spare."
    : `At this rate the money runs out${r.shortAge ? ` at about ${r.shortAge}` : ""}: saving more is the surest fix.`;
}

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const today = fmt.today();
  const d = compute(plan, { today });
  // a checking or savings account is listed only when a row already goes into it (spec D-B7: "it stays in the bank", answered
  // on Will the money last?, so that row can be edited here); new rows into the bank are made only by that answer
  const usedByRow = new Set((plan.retirement?.contributions ?? []).map((c) => c.accountId));
  const accounts = (plan.accounts ?? []).filter((a) => BUCKET_OF[a.type] && (BUCKET_OF[a.type] !== "cash" || usedByRow.has(a.id)));
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  let editing = null;
  // a line over the edit form saying why it opened and what the card tried (a landing, or "It matches"), and boxes filled in
  let editNote = null, noteAt = null;
  // what a landing from "What this rests on" brings to the form (review 2026-11-12): { rowId, pid, fill (nothing of the person's
  // own goes in), tried: { amount, period, label } (the change the card tried, one tap on a chip), matchGuess (the usual match the
  // card counted, asked in the match box), matchAsked (the form asks about the match: a 0 typed is "no match at this job") }
  let landing = null;
  // Get started's standing (the verdict in this page's own words), worked out once a drawing
  const standing = d.hasData ? ctx.computeOf?.("overview/setup", { today, screen: "done" })?.standing ?? null : null;
  const verdictNow = standing?.retirementKnown && !standing.retireGuessed ? standing.retire?.verdict ?? null : null;
  // every save on this page goes through here: the answer before it is kept for the notice after it, and a "no match" answer
  // goes when the save puts a match on file (P9)
  const rowsKey = (p) => JSON.stringify(p?.retirement?.contributions ?? []);
  const update = (fn) => {
    try { before = { answer: answerOf(plan, { today }), rows: rowsKey(plan), verdict: verdictNow }; } catch { before = null; }
    const had = new Set(people.filter((p) => hasMatch(plan, p.id)).map((p) => p.id));
    store.update((p) => { fn(p); matchTakesBackNo(p, had); });
  };
  // a record saved from "6%" keeps the share beside the dollars; it is shown only while the dollars still are that share of the person's pay now
  const shareOf = (c) => {
    const pay = Number(c?.pctOfPay) > 0 && c.personId ? payOf(plan, c.personId, fmt.today()) : 0;
    return pay > 0 && Math.abs(Number(c.amount) - c.pctOfPay * pay / perYear(1, c.period)) < 0.51;
  };
  const FIELDS = [
    { key: "accountId", label: "Into which account", type: "select", options: accounts.map((a) => ({ value: a.id, label: a.name })) },
    { key: "personId", label: "Whose", type: "select", options: [{ value: "", label: "Household" }, ...people.map((p) => ({ value: p.id, label: p.name }))] },
    // dollars each time it goes in, or a share of pay like 6% (worked out from the person's pay when saved)
    { key: "amount", label: "Your own money", type: "text", required: true, help: "each time it goes in: dollars, like 270, or a share of your pay, like 6%" },
    { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS.filter((o) => o.value !== "once") },
    { key: "employerMatch", label: "Employer adds, a year", type: "money", min: 0, help: "the match or profit sharing, per year; leave blank for none" },
  ];

  // The Dashboard's next move can be "Check if Bo's job matches retirement saving": a 401(k) and pay with nothing going in,
  // or (round 8) pay and no 401(k) on file at all. One question, three answers, so the move can be done here.
  const nba = ctx.computeOf?.("overview/next-best-action", { today: fmt.today() });
  const ask = nba?.ready ? (nba.steps.find((s) => s.id === "match" && s.status !== "done")?.ask ?? []) : [];
  const startable = ask.some((a) => a.noAccount);
  const matchStep = nba?.ready ? nba.steps.find((s) => s.id === "match" && s.status !== "done") ?? null : null;
  // money that stays in a checking or savings account (the answer "It stays in the bank" on Will the money last?) is not in
  // the figure: it is said on its own line (review 2026-11-12, M3)
  const bankRows = d.items.filter((i) => i.bank && i.yearly > 0);
  const saves = d.hasData && (d.totalYearly > 0 || !bankRows.length);
  const listOf = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, saves ? `${fmt.money(d.totalYearly, cur)} a year into retirement accounts` : "Retirement contributions"),
    ui.h("p", { class: "lede" }, saves ? `${fmt.money(d.yearly, cur)} of your own money and ${fmt.money(d.matchYearly, cur)} from employers. The plan adds these every year until each person retires.` : "Money you put into retirement accounts each paycheck, and what your employer adds. The plan uses it to grow your savings until you retire."),
    bankRows.length ? ui.h("p", { class: "small" }, `${fmt.money(Math.round(d.bankYearly / 12), cur)} a month stays in ${listOf([...new Set(bankRows.map((i) => i.accountName))])}, counted for later${saves ? ": it is not in the figure above" : ""}.`) : null,
    // no retirement account yet: a paid adult's 401(k) starts from the question below in one tap (round 8); the rest on Net worth
    // (review UX 8: "starts a 401(k) at work" claimed more than a plan can do; the plan gets it, work starts it)
    // (R-A9: the way to Net worth is a button, not a small word in the sentence; outlined when the 401(k) question below is the
    // filled way on)
    !accounts.length ? ui.h("p", { class: "muted small" }, startable ? "No retirement account yet: one tap below adds your 401(k) to the plan. An IRA, Roth or HSA goes on Net worth." : "First add the retirement accounts themselves (401(k), IRA, Roth, HSA, brokerage).") : null,
    !accounts.length ? ui.row(ui.h("a", { class: startable ? "btn secondary" : "btn", href: "#/balance/net-worth" }, "Add your accounts ›")) : null,
    d.hasData ? enoughLine() : null,
  ));
  // "are we saving enough?": the share of pay, then the plan's own answer (Will the money last?), the same one the
  // Dashboard, How am I doing? and Next best action give
  function enoughLine() {
    const st = standing;
    const inc = ctx.computeOf?.("cashflow/income", { today: fmt.today() }) ?? null;
    // earned pay, a business's income included (what a SEP or solo 401(k) is based on), as How am I doing? counts it
    const pay = (inc?.active ?? []).filter((x) => x.type === "salary" || x.type === "bonus" || x.type === "business").reduce((t, x) => t + (Number(x.yearly) || 0), 0);
    const share = pay > 0 && d.totalYearly > 0 ? `That is ${Math.round((d.totalYearly / pay) * 100)}% of your pay, your employers' money included. ` : "";
    // what is still missing, named (birth dates or Social Security), not always "Social Security"; a verdict on our guesses waits
    const said = verdictWords(st);
    if (!share && !said) return null;
    // one 44 px button, not a 16 px link inside the sentence (stress test 2026-11-11, R-A8, FF8)
    return [ui.h("p", { class: "small" }, `${share}${said}`), ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "See if the money lasts ›"))];
  }
  for (const w of d.warnings) root.append(ui.notice("warn", w));
  const out = ui.h("div");
  // "Your retirement answer: now runs out at 76 (was 66)." after a save that moved it, or "still ..." after one that changed what
  // goes in and did not (spec L3); nothing when the plan has no answer yet (Social Security or birth dates missing)
  const moved = (() => {
    const b = before; before = null;
    // when the tax is paid is not judged by the retirement answer: the projection does not count the tax a pay-the-tax-later
    // dollar saves today, so it always favours paying now (spec D-C3)
    if (!b || !pending || pending?.tax) return "";
    let a = null;
    try { a = answerOf(plan, { today }); } catch { a = null; }
    const w = answerChangeWords(b.answer, a, (n) => fmt.money(n, cur), { still: rowsKey(plan) !== b.rows });
    // the verdict turned: its own words first, before and now (P6: "still lasts to the end" stood under a headline that had
    // gone from "The money lasts" back to "It lasts in most cases, not all")
    const turned = w && b.verdict && verdictNow && b.verdict !== verdictNow && VERDICT_WORDS[b.verdict] && VERDICT_WORDS[verdictNow];
    return w ? `${turned ? `Before: ${VERDICT_WORDS[b.verdict]}. Now: ${VERDICT_WORDS[verdictNow]}. ` : ""}Your retirement answer: ${w}.` : "";
  })();
  // a change of when the tax is paid: its one-sentence notice is brought into view, and the line under the rows opens (P3)
  const taxSaved = !!(pending && typeof pending === "object" && pending.tax);
  let taxNotice = null;
  if (pending && typeof pending === "object") {
    // an answer to the match question: say what the next move is now, from the Dashboard's own list
    const mv = ctx.computeOf?.("overview/setup", { today: fmt.today(), screen: "done" })?.standing?.moves?.[0] ?? null;
    const n = ui.notice("ok", pending.text);
    if (moved) n.append(" ", moved);
    if (pending.tax) { taxNotice = n; n.setAttribute("tabindex", "-1"); afterPaint(() => { if (n.isConnected === false) return; n.focus?.({ preventScroll: true }); }); }
    // what the month has left now, after a start that takes from take-home pay (review D2)
    if (pending.left) { const w = leftWords(nba, cur); if (w) n.append(" ", w); }
    if (mv && !taxSaved) n.append(" ", ui.h("a", { href: mv.href }, `Your next move: ${mv.title} ›`));
    out.append(n); pending = null;
  } else if (pending) {
    // a plain "saved" goes after 4 seconds; one with the answer stays to be read
    const n = ui.notice("ok", moved ? `${pending} ${moved}` : pending); out.append(n);
    if (!moved) setTimeout(() => n.remove(), 4000);
    pending = null;
  }
  root.append(out);
  // the tax answer's notice brought into view in this drawing, so the shell sees it on the screen and does not repeat it in a note
  // at the foot over the rows (review 2026-11-12, P3, F6)
  taxNotice?.scrollIntoView?.({ block: "center" });

  // the answers: add what goes in, no match at that job, or an old job's 401(k)
  const formCard = ui.card(null);
  // the form's own rules, scoped to its card: the box a link lands on is outlined; the tax line and its answers; the two lines
  // whose room is kept by the longest sentence each can hold, unseen behind the words (P1); the landing's chip
  formCard.append(ui.h("style", {}, ".ct-form .ct-show { outline: 3px solid var(--accent); outline-offset: 4px; border-radius: var(--radius-sm); } .ct-form .ct-tax { display: block; margin: 0 0 12px; } .ct-form .ct-tax-line { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; } .ct-form .ct-chips { margin: 6px 0 8px; flex-wrap: wrap; } .ct-form .ct-live { display: grid; margin: 4px 0; } .ct-form .ct-live::before { content: attr(data-size); visibility: hidden; grid-area: 1 / 1; } .ct-form .ct-live > span { grid-area: 1 / 1; } .ct-form .ct-use { margin: 0 0 12px; flex-wrap: wrap; }"));
  for (const a of ask.slice(0, 1)) {
    // the unnamed first adult ("Me") reads "you", the partner "your spouse" (review 2026-11-06, round 7)
    const whose = nameOf(a.name), who = nameIn(a.name), Who = NameIn(a.name), verb = (one, you) => verbFor(a.name, one, you);
    const money = (n) => fmt.money(Math.round(n), cur);
    const pctOf = (x) => `${Number((x * 100).toFixed(1))}%`;
    // what goes in each paycheck at the match's share of pay (Work benefits' figures), and the words after the tap: added to the
    // plan, and that signing up at work is what starts it (review UX 8), with the month after it (review D2)
    const periodOf = (m) => (m ? PERIOD_FOR[m.paychecks] ?? "annual" : "biweekly");
    const eachOf = (m) => (m ? Math.round((periodOf(m) === "annual" ? m.yearly : m.yearly / m.paychecks) * 100) / 100 : null);
    const addedWords = (m, known) => `Added to your plan: ${money(eachOf(m))} ${periodOf(m) === "annual" ? "a year" : "a paycheck"} (${pctOf(m.pct)} of pay)${known ? `, and the employer adds ${money(m.match)} a year` : ""}.${known ? "" : " Type what the employer adds on it below once you know it."} To actually start it, sign up at ${pctOf(m.pct)} with human resources or your job's benefits site.`;
    // the month has less than starting it takes: said before the tap (review UX 2), in Next best action's words
    const costNote = () => (matchStep?.costShort && matchStep.costWords && a.monthlyCost > 0.5 ? ui.notice("warn", matchStep.costWords) : null);
    const contribute = (draft, accountId, m, known) => { draft.retirement.contributions = draft.retirement.contributions ?? []; draft.retirement.contributions.push({ id: ui.uid(), accountId, personId: a.personId, amount: eachOf(m), period: periodOf(m), employerMatch: known ? Math.round(m.match) : 0 }); };
    // a 401(k) on file with nothing going in, and the match typed on Work benefits or a plan with a match said (Get started, or
    // "Yes" below): one tap starts what goes in, on that 401(k); or one's own amount in the form (review UX 3: the app asked
    // "Does Priya's job add money?" again right after "Yes", about the account it had just added)
    if (!a.noAccount && (a.kind === "known" || a.kind === "plan") && a.match) {
      const m = a.match, known = a.kind === "known";
      const cur401 = (a.accounts ?? []).map((id) => (plan.accounts ?? []).find((x) => x.id === id)).filter(Boolean);
      const acct = cur401.find((x) => !/\b(old|former|previous|prior|rollover)\b/i.test(x.name ?? "")) ?? cur401[0];
      if (acct) {
        root.append(ui.h("section", { class: "card" },
          ui.h("h2", {}, known ? `Start what goes into ${whose} 401(k) and get the whole match` : `How much goes into ${whose} 401(k)?`),
          ui.h("p", {}, known ? `${NameOf(a.name)} employer adds ${m.tiers.map((t, i) => `${pctOf(t.rate)}${i ? "" : ` of what ${who} ${verb("puts", "put")} in`}, up to ${pctOf(t.upTo)} of pay`).join(", then ")}. Putting in ${pctOf(m.pct)} of pay (${money(m.perCheck)} a paycheck, about ${money(m.take)} less take-home pay) gets ${money(m.match)} a year from the employer.`
            : `${NameOf(a.name)} job has a plan with a match. Most employers that match add ${usualMatchWords()}: about ${money(usualMatchAt(plan, a.personId, today, m.yearly))} a year for ${who}. Putting in ${pctOf(m.pct)} (${money(m.perCheck)} a paycheck, about ${money(m.take)} less take-home pay) gets all of it. Human resources can say what the real match is.`),
          costNote(),
          ui.h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
            ui.button(`Start it at ${pctOf(m.pct)}`, () => { pending = { text: addedWords(m, known), left: true }; update((p) => contribute(p, acct.id, m, known)); }),
            ui.button("Type my own amount", () => {
              landing = null; prefill = { personId: a.personId, accountId: acct.id, period: periodOf(m), amount: eachOf(m) };
              prefillNote = `Filled in with ${pctOf(m.pct)} of pay, ${money(eachOf(m))} a paycheck: change it to yours${known ? "" : ", and add what the employer puts in when you know it"}.`;
              editing = null; showForm = true; drawForm(); formCard.scrollIntoView?.({ behavior: "smooth", block: "start" });
            }, { class: "secondary" })),
          known ? ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, "The match is the one typed on ", ui.h("a", { href: "#/career/benefits" }, "Work benefits"), ".") : null));
        continue;
      }
    }
    const noPlanAnswer = () => { pending = { text: `Noted: no plan or no match at ${whose} job.` }; update((p) => { p.retirement.workPlans = { ...(p.retirement.workPlans ?? {}), [a.personId]: { ...(p.retirement.workPlans?.[a.personId] ?? {}), match: false } }; }); };
    // no 401(k) on file at all (round 8 item 1): one tap starts it -- a $0 401(k) for this person on Net worth, plus what goes
    // in when the match is known (typed on Work benefits), else the add form opened on it
    if (a.noAccount) {
      const m = a.match, known = a.kind === "known" && m;
      // known: the $0 401(k) and what goes in; otherwise "Yes": the $0 401(k), and the job's plan noted as having a match
      // (retirement.workPlans[id].match = true, the answer Get started saves), so the next card offers the start, not this
      // question again (review UX 3)
      const start = () => {
        const id = ui.uid();
        pending = known ? { text: addedWords(m, true), left: true } : { text: `${NameOf(a.name)} 401(k) is added to the plan (at $0, on Net worth).` };
        update((p) => {
          p.accounts = p.accounts ?? [];
          p.accounts.push({ id, name: `${NameOf(a.name)} 401(k)`, type: "401k", balance: 0, ownerId: a.personId, asOf: fmt.today(), history: [] });
          if (known) contribute(p, id, m, true);
          else p.retirement.workPlans = { ...(p.retirement.workPlans ?? {}), [a.personId]: { ...(p.retirement.workPlans?.[a.personId] ?? {}), match: true } };
        });
      };
      const help = ui.h("p", { class: "muted small", style: { marginTop: "10px" }, hidden: true }, `Ask human resources at work, or look on ${whose} job's benefits site or pay stub for "401(k)" or "403(b)". The question stays on Next best action until it is answered.`);
      root.append(ui.h("section", { class: "card" },
        ui.h("h2", {}, known ? `Start ${whose} 401(k) and get the whole match` : a.kind === "plan" ? `Start ${whose} 401(k) at work` : `Does ${whose} job have a retirement plan with a match?`),
        ui.h("p", {}, known ? `${NameOf(a.name)} employer adds ${m.tiers.map((t, i) => `${pctOf(t.rate)}${i ? "" : ` of what ${who} ${verb("puts", "put")} in`}, up to ${pctOf(t.upTo)} of pay`).join(", then ")}. Putting in ${pctOf(m.pct)} of pay (${money(m.perCheck)} a paycheck, about ${money(m.take)} less take-home pay) gets ${money(m.match)} a year from the employer.`
          : `Many employers add money when you save for retirement through work, in a 401(k) or 403(b): free money worth getting in full.${m ? ` Most that match add ${usualMatchWords()}: about ${money(usualMatchAt(plan, a.personId, today, m.yearly))} a year for ${who}.` : ""}`),
        known ? costNote() : null,
        ui.h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
          ui.button(known ? `Start it at ${pctOf(m.pct)}` : `Yes: add ${whose} 401(k)`, start),
          known ? null : ui.button(`No plan or no match at ${whose} job`, noPlanAnswer, { class: "secondary" }),
          known ? null : ui.button("Not sure", () => { help.hidden = false; }, { class: "secondary" })),
        help,
        known ? ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, "The match is the one typed on ", ui.h("a", { href: "#/career/benefits" }, "Work benefits"), ".") : null));
      continue;
    }
    // every 401(k) on file is from a job left: ask about the job now, whose plan is not in the plan yet
    if (a.newJob) {
      const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
      const old = (a.old ?? []).map((id) => (plan.accounts ?? []).find((x) => x.id === id)?.name).filter(Boolean);
      root.append(ui.h("section", { class: "card" },
        ui.h("h2", {}, `Does ${whose} job now have a retirement plan with a match?`),
        ui.h("p", {}, `${old.length ? old.join(" and ") : `${cap(whose)} 401(k)`} ${old.length > 1 ? "are" : "is"} from a job ${who} left. If the job ${who} ${verb("has", "have")} now offers a 401(k) with a match, putting in enough to get all of it is free money.`),
        ui.h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
          ui.h("a", { class: "btn", href: "#/balance/net-worth" }, `Yes: add ${whose} new 401(k)`),
          ui.button(`No plan or no match at ${whose} job`, noPlanAnswer, { class: "secondary" })),
        ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, "Add the new 401(k) on Net worth, then come back here to add what goes in each paycheck. Not sure? The job's benefits site says whether there is a plan and a match.")));
      continue;
    }
    // our guess of what goes in is short of the whole usual match (Get started could not know): one tap puts in the share that
    // gets all of it, or the person types their own
    if (a.kind === "guessed") {
      const row = (plan.retirement?.contributions ?? []).find((x) => x.id === a.rowId);
      const acct = (plan.accounts ?? []).find((x) => x.id === row?.accountId);
      if (row) {
        const m = (n) => fmt.money(Math.round(n), cur), pctText = (x) => `${Number((x * 100).toFixed(1))}%`;
        root.append(ui.h("section", { class: "card" },
          ui.h("h2", {}, `Put in ${pctText(a.wantPct)} of ${whose} pay to get the whole match`),
          ui.h("p", {}, `We guess ${who} put${verb("s", "")} in about ${pctText(Math.round(a.nowPct * 1000) / 1000)} of pay (${m(a.nowMonthly)} a month), the usual for someone like ${who === "you" ? "you" : who}. Most employers that match add the most when you put in ${pctText(a.wantPct)}: ${m(a.wantMonthly)} a month would likely get about ${m(a.wantMatch)} a month from the employer.`),
          ui.h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
            ui.button(`Put in ${pctText(a.wantPct)} (${m(a.wantMonthly)} a month)`, () => {
              pending = `${NameOf(a.name)} 401(k): ${m(a.wantMonthly)} a month goes in now. The employer match should be about ${m(a.wantMatch)} a month.`;
              update((p) => { const r = (p.retirement.contributions ?? []).find((x) => x.id === a.rowId); if (r) { r.amount = a.wantMonthly; r.period = "monthly"; r.pctOfPay = a.wantPct; clearGuess(p, `retirement.contributions[${a.rowId}].amount`); } });
            }),
            ui.button("Type my own amount", () => { editing = { ...row, accountName: acct?.name ?? "" }; editNote = null; landing = null; noteAt = null; showForm = true; drawForm(); formCard.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, { class: "secondary" })),
          ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, "Your pay stub shows the real figures. Type them here when you have them.")));
        continue;
      }
    }
    const acct = (plan.accounts ?? []).find((x) => x.id === a.accounts[0]);
    root.append(ui.h("section", { class: "card" },
      ui.h("h2", {}, `Does ${whose} job add money when ${who} ${verb("saves", "save")} for retirement?`),
      a.saidPlan ? ui.h("p", {}, `${NameOf(a.name)} job has a retirement plan (you said so in Set up my plan), but nothing goes into it yet. Many employers add money when you put some in (a match): free money worth getting in full.`) :
      ui.h("p", {}, `${Who} ${verb("earns a paycheck and has", "earn a paycheck and have")} ${a.accounts.length > 1 ? `${a.accounts.length} 401(k)s (${a.accounts.map((id) => (plan.accounts ?? []).find((x) => x.id === id)?.name).filter(Boolean).join(", ")})` : acct && /401/.test(acct.name ?? "") ? acct.name : `a 401(k)${acct?.name ? ` (${acct.name})` : ""}`}, but nothing goes into ${a.accounts.length > 1 ? "them" : "it"} in this plan. Many employers add money when you put some in (a match): free money worth getting in full.`),
      ui.h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
        ui.button(`Yes, it matches: add what ${who} ${verb("puts", "put")} in`, () => {
          // the 401(k) at the job now: one whose name does not say it is an old one
          const cur = a.accounts.map((id) => (plan.accounts ?? []).find((x) => x.id === id)).filter(Boolean);
          const now = cur.find((x) => !/\b(old|former|previous|prior|rollover)\b/i.test(x.name ?? "")) ?? cur[0];
          landing = null; prefill = { personId: a.personId, accountId: now?.id ?? accounts[0]?.id };
          editing = null; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" });
        }),
        ui.button(`No match at ${whose} job`, () => {
          pending = { text: `Noted: no match at ${whose} job.` };
          update((p) => { p.retirement.workPlans = { ...(p.retirement.workPlans ?? {}), [a.personId]: { ...(p.retirement.workPlans?.[a.personId] ?? {}), match: false } }; });
        }, { class: "secondary" }),
        // one button per 401(k) when there are several, so only the old one is marked (none when the job's plan was said in Get started)
        ...(a.saidPlan ? [] : a.accounts.length > 1 ? a.accounts : [a.accounts[0]]).map((id) => {
          const x = (plan.accounts ?? []).find((y) => y.id === id);
          return ui.button(a.accounts.length > 1 ? `${x?.name ?? "This 401(k)"} is from a job ${who} left` : `That 401(k) is from a job ${who} left`, () => {
            pending = { text: `Noted: ${x?.name ?? "that 401(k)"} is from a job ${who} left, so no money goes in.` };
            update((p) => { const y = (p.accounts ?? []).find((z) => z.id === id); if (y) y.formerJob = true; });
          }, { class: "secondary" });
        })),
      ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, "Not sure? Your pay stub or your job's benefits site shows what goes in each paycheck and what the employer adds.")));
  }
  // the card for the question above, when a link should land on it
  const askEl = ask.length ? (root.lastElementChild ?? root.children?.at?.(-1) ?? null) : null;
  const nameFor = (pid) => people.find((p) => p.id === pid)?.name ?? "";
  // the match check (spec L3): money of one's own goes in at work, no match is on file, and nobody was asked. One question at a
  // time: not while a question above is showing. "That's right" saves the answer Get started and "No match" save; "It matches"
  // opens the row on its match box
  const check = !ask.length ? matchChecks(plan, { today })[0] ?? null : null;
  if (check) {
    const c = (plan.retirement?.contributions ?? []).find((x) => x.id === check.rowId);
    const acct = (plan.accounts ?? []).find((x) => x.id === c?.accountId);
    const whose = nameOf(check.name), who = nameIn(check.name);
    const help = ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, `Ask human resources, or look on ${whose} job's benefits site or a pay stub for "employer match" or "company contribution". Until it is answered, the plan counts no match.`);
    help.hidden = true;
    const noMatch = (p) => { p.retirement.workPlans = { ...(p.retirement.workPlans ?? {}), [check.pid]: { ...(p.retirement.workPlans?.[check.pid] ?? {}), match: false } }; };
    const right = ui.button("That's right", () => { pending = { text: `Noted: no match at ${whose} job.` }; update(noMatch); });
    // "It matches" is answered here, in the card (review 2026-11-12, P5, B4b: it opened the whole edit form and scrolled the
    // page 1,381 px, so the form's Cancel landed under the thumb and a second tap closed it): one box under the buttons, its
    // own Save, nothing above it moves, and a second tap on "It matches" only puts the cursor back in the box
    const inPlace = ui.h("div", { class: "ct-inplace" });
    inPlace.hidden = true;
    const openHere = () => {
      if (inPlace.hidden) {
        const cancel = () => { inPlace.hidden = true; inPlace.replaceChildren(); right.classList?.remove("secondary"); };
        const f = ui.form([{ key: "employerMatch", label: "Employer adds, a year", type: "money", min: 0, required: true, placeholder: check.usual > 0 ? String(check.usual) : undefined, help: `the match or profit sharing, per year: ${whose} benefits site or a pay stub shows it` }], {}, (v) => {
          const m = Math.max(0, Number(v.employerMatch) || 0);
          if (m > CONTRIBUTION_YEARLY_CEILING) { inPlace.querySelector(".notice.error")?.remove(); inPlace.prepend(ui.notice("error", `${fmt.money(m, cur)} a year from the employer is more than anyone can put into these accounts. Check for an extra digit.`)); return false; }
          pending = { text: m > 0 ? `Saved: ${whose} employer adds ${fmt.money(m, cur)} a year.` : `Noted: no match at ${whose} job.` };
          update((p) => { if (m > 0) { applyMatchAtWork(p, check.rowId, m, { today, ids: { laterRow: ui.uid(), laterAccount: ui.uid() } }); clearGuess(p, `retirement.contributions[${check.rowId}].employerMatch`); } else noMatch(p); });
          return undefined;
        }, { submitLabel: "Save the match", onCancel: cancel });
        inPlace.append(f);
        inPlace.hidden = false;
        right.classList?.add("secondary");   // the box's own Save is the one filled button of the card now
      }
      inPlace.querySelector('[name="employerMatch"]')?.focus?.({ preventScroll: true });
    };
    root.append(ui.h("section", { class: "card" },
      ui.h("h2", {}, "No match on file. Is that right?"),
      ui.h("p", {}, `${acct?.name ?? `${NameOf(check.name)} 401(k)`} gets ${fmt.money(Math.round(perYear(Number(c?.amount) || 0, c?.period) / 12), cur)} a month of ${whose} own money and nothing from the employer in this plan.${check.usual > 0 ? ` Most employers that match add ${usualMatchWords()}: about ${fmt.money(check.usual, cur)} a year for ${who} at what goes in now.` : ""}`),
      ui.h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
        right,
        ui.button("It matches", openHere, { class: "secondary" }),
        ui.button("Not sure", () => { help.hidden = false; }, { class: "secondary" })),
      inPlace,
      help));
  }
  // what was answered, so it can be taken back
  const answered = [
    ...people.filter((p) => plan.retirement?.workPlans?.[p.id]?.match === false && !hasMatch(plan, p.id)).map((p) => ({ text: `No match at ${nameOf(p.name)} job`, undo: (draft) => { if (draft.retirement.workPlans?.[p.id]) delete draft.retirement.workPlans[p.id].match; } })),
    ...people.filter((p) => plan.retirement?.workPlans?.[p.id]?.match === true).map((p) => ({ text: `A plan with a match at ${nameOf(p.name)} job`, undo: (draft) => { if (draft.retirement.workPlans?.[p.id]) delete draft.retirement.workPlans[p.id].match; } })),
    ...(plan.accounts ?? []).filter((x) => x.formerJob).map((x) => ({ text: `${x.name}: from a job you left`, undo: (draft) => { const y = (draft.accounts ?? []).find((z) => z.id === x.id); if (y) delete y.formerJob; } })),
  ];
  if (answered.length) root.append(ui.card(null, ...answered.map((x) => ui.h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" } },
    ui.h("span", { class: "muted small" }, x.text),
    ui.button("Edit", () => { pending = { text: "Answer taken back." }; update(x.undo); }, { class: "secondary small" })))));

  if (d.byPerson.some((p) => p.limits.length)) root.append(ui.card(`Against the ${d.limitsYear} limits`,
    ui.h("ul", { class: "records" }, d.byPerson.flatMap((p) => p.limits.map((l) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${p.name}: ${l.label}`), ui.h("span", { class: "rec-value" }, `${fmt.money(l.used, cur)} of ${fmt.money(l.limit, cur)}`)),
      ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.min(100, Math.round(l.used / l.limit * 100))}%`, background: l.over ? "var(--bad)" : "var(--ok)" } })),
      ui.h("div", { class: "rec-sub" }, `${l.over ? `${fmt.money(l.over, cur)} over the limit` : `${fmt.money(l.limit - l.used, cur)} of room left${l.catchUp ? `, including the catch-up allowed from ${p.age >= 60 && p.age <= 63 && l.kind === "401k" ? "60 to 63" : d.limits.kinds[l.kind]?.catchUpAge ?? 50}` : ""}`}${l.year && l.year !== d.limitsYear ? ` · ${l.year} limit` : ""}`))))),
    ui.h("p", { class: "muted small" }, "An employer's 401(k) match does not count against these; an employer's HSA money does. IRS figures; check them each January."),
  ));

  const formHost = ui.h("div");
  let showForm = !d.hasData || !!prefill;
  // "When do you pay the tax on it?" on a row at work (spec part C, L6): the answer for the row being edited, kept while the form
  // is open (a tap on a chip changes the boxes' words, not the boxes). `taxOpen`: the three answers are showing; until then it
  // is one quiet line (review 2026-11-12, P10: every edit of a row at work opened with three chips, a rule of thumb and a
  // citation, and Save was off the first screen)
  let taxFor = null, taxChoice = null, taxOpen = false;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!accounts.length) return;
    if (!showForm && !editing) { formHost.append(ui.button("+ Add another contribution", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    // a new contribution starts on a retirement account, not a brokerage one
    const firstRetirement = accounts.find((a) => BUCKET_OF[a.type] !== "taxable" && BUCKET_OF[a.type] !== "cash" && !a.formerJob) ?? accounts.find((a) => BUCKET_OF[a.type] !== "cash") ?? accounts[0];
    // a row whose figures are still our guess opens with them grey (placeholders), not typed (follow-up F4)
    const start = editing ? contributionFormStart(plan, editing) : null;
    // a row at work (a 401(k) or a Roth 401(k)): the tax question, the two rows of one job read as one (taxPairOf)
    const pair = editing ? taxPairOf(plan, editing.id) : null;
    if (!pair) { taxFor = null; taxChoice = null; taxOpen = false; } else if (taxFor !== editing.id) { taxFor = editing.id; taxChoice = pair.choice; taxOpen = false; }
    // the box shows the row's own figure when it holds the own money for the choice on file; else the pair's figures
    const plainRow = pair && ((pair.choice === "later" && pair.later?.id === editing.id) || (pair.choice === "now" && pair.now?.id === editing.id && !pair.later));
    // a landing from "What this rests on" (review 2026-11-12, P2, M5): nothing of ours is typed in. With nothing going in the
    // amount box opens empty with the amount the card tried grey in it; the match box opens empty with the usual match grey in
    // it and asks; a chip under the amount box puts the tried amount in when the person taps it
    const land = landing && (editing ? landing.rowId === editing.id : !!prefill) ? landing : null;
    // (a guessed match of $0, "no match, our guess", is asked about as well: the card counted the usual match)
    const mg = land?.matchGuess > 0 && !(Number(start?.matchHint) > 0) ? land : null;
    const mgName = mg ? nameFor(mg.pid) : "";
    const guessHelp = "Our guess is gray: left blank it stays our guess, worked out again for the amount you save; type 0 for none.";
    const fields0 = FIELDS.map((f) => (f.key === "amount" && start?.amountHint ? { ...f, required: false, placeholder: start.amountHint, help: `${f.help}. Our guess is gray: leave it blank to keep it.` }
      : f.key === "amount" && land?.fill ? { ...f, placeholder: String(land.tried.amount) }
      : f.key === "employerMatch" && mg ? { ...f, placeholder: String(mg.matchGuess), help: `Does ${nameOf(mgName)} job add money (a match)? Most that match add about ${money0(mg.matchGuess)} a year at this much. Type the real figure, or 0 if it adds nothing; left blank, the usual match stays in as our guess.` }
      : f.key === "employerMatch" && start?.matchHint ? { ...f, placeholder: start.matchHint, help: `${f.help}. ${guessHelp}` } : f));
    // the pay-the-tax-now part, a box of its own shown only for "Some of each"
    const fields = !pair ? fields0 : fields0.flatMap((f) => (f.key === "amount" ? [{ ...f, required: false }, { key: "nowAmount", label: "Pay the tax now: your own money", type: "text", help: "each time, into the Roth 401(k): dollars, like 100, or a share of your pay, like 2%" }] : [f]));
    const values0 = { ...(editing ? { ...start.values, amount: start.amountHint ? "" : shareOf(editing) ? `${Number((editing.pctOfPay * 100).toFixed(2))}%` : editing.amount } : { period: "monthly", personId: people.find((p) => p.role === "self")?.id ?? "", accountId: firstRetirement?.id, ...(prefill ?? {}) }),
      ...(land?.fill ? { amount: "", period: land.tried.period } : {}), ...(mg ? { employerMatch: "" } : {}) };
    const eachText = (row, each) => (row && shareOf(row) ? `${Number((row.pctOfPay * 100).toFixed(2))}%` : each > 0 ? each : "");
    const values = !pair ? values0 : plainRow ? { ...values0, nowAmount: "" } : { ...values0, period: pair.period, amount: pair.choice === "now" ? eachText(pair.now, pair.nowEach) : eachText(pair.later, pair.laterEach), nowAmount: eachText(pair.now, pair.nowEach), employerMatch: pair.match };
    const note = editing ? editNote : prefill ? prefillNote : null;
    const noteEl = note ? ui.h("p", { class: "muted small" }, note) : null;
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit: ${editing.accountName}` : "Add a contribution"),
      noteEl,
      ui.form(fields, values, (v0) => {
        const v = start ? fillBlankFromGuess(v0, start) : v0;
        // a row at work whose tax answer moved, or is split, or a match typed on the pay-the-tax-now row (it is kept on a
        // pay-the-tax-later row, B5): both rows are saved together (applyTaxChoice)
        if (pair && (!(plainRow && taxChoice === pair.choice) || (pair.now?.id === editing.id && Number(v.employerMatch) > 0))) return saveTax(pair, v, v0);
        // "6%" is a share of this person's pay: saved as the dollars it comes to each time, with the share kept beside it
        const said = readAmountOrShare(v.amount);
        const fail = formFail;
        if (said === null || said.bad) return fail(land?.fill && said === null ? `Type what goes in each time, like ${land.tried.amount}, or tap the button under the box to use that.` : "That isn't an amount. Type dollars, like 270, or a share of your pay, like 6%.");
        let amount = said.amount ?? 0, pctOfPay = null;
        if (said.pct !== undefined) {
          const pay = v.personId ? payOf(plan, v.personId, fmt.today()) : 0;
          if (said.pct > 1) return fail("A share of pay can't be more than 100%.");
          if (!v.personId) return fail("Pick whose pay the share is of (under Whose), then try again.");
          if (!(pay > 0)) return fail("We don't have this person's pay yet, so we can't turn a share of it into dollars. Type dollars, or add their pay on Income first.");
          amount = Math.round(said.pct * pay / perYear(1, v.period) * 100) / 100;
          pctOfPay = said.pct;
        }
        // a slip of extra digits is said before it is saved (stress test 2026-11-11, R-A10: $99,999,999 a month was added)
        // the whole account counts (its other rows and the employer's part too), and the check is made here, not by the browser,
        // so an old red line never stays beside a new reason (review of R-A10)
        const match = Math.max(0, Number(v.employerMatch) || 0);
        if (match > CONTRIBUTION_YEARLY_CEILING) return fail(`${fmt.money(match, cur)} a year from the employer is more than anyone can put into these accounts. Check for an extra digit.`);
        const others = (plan.retirement?.contributions ?? []).filter((c) => c.accountId === v.accountId && c.id !== editing?.id).reduce((t, c) => t + perYear(Number(c.amount) || 0, c.period) + (Number(c.employerMatch) || 0), 0);
        const yearly = perYear(amount, v.period);
        if (yearly + match + others > CONTRIBUTION_YEARLY_CEILING) return fail(`That comes to ${fmt.money(yearly + match + others, cur)} a year into this account${others > 0 ? " with what is already going in" : ""}${match > 0 ? ", the employer's part included" : ""}, more than anyone can put into these accounts. Check for an extra digit: the box is what goes in each time.`);
        // the match box left blank while it showed our guess (the row's own, or the usual match a landing asked about): the
        // match stays our guess, never the person's own figure by a save that did not touch it (P2, M5). It is the guess on
        // file when what goes in did not change, else the usual match at what goes in now (levers usualMatchAt)
        const blankMatch = v0.employerMatch === null || v0.employerMatch === undefined || v0.employerMatch === "";
        const gPid = v.personId || mg?.pid || "";
        let guessMatch = null;
        if (blankMatch && (start?.matchHint || mg)) {
          const was = editing ? perYear(Number(editing.amount) || 0, editing.period) : 0;
          const ownOther = gPid ? workRows(plan, gPid).filter(({ c }) => c.id !== editing?.id).reduce((t, { c }) => t + perYear(Number(c.amount) || 0, c.period), 0) : 0;
          guessMatch = start?.matchHint && Math.abs(yearly - was) < 0.5 ? Number(start.matchHint) : gPid && plan.retirement?.workPlans?.[gPid]?.match !== false ? usualMatchAt(plan, gPid, today, yearly + ownOther) : 0;
        }
        const clean = { accountId: v.accountId, personId: v.personId || "", amount, period: v.period, employerMatch: guessMatch !== null ? guessMatch : v.employerMatch ?? 0, ...(pctOfPay !== null ? { pctOfPay } : {}) };
        const keepGuess = (p, id) => { if (guessMatch > 0) markGuess(p, `retirement.contributions[${id}].employerMatch`, { key: "contrib.match", value: guessMatch, unit: "year", dataAsOf: guessDate(plan, editing?.id) }, today); };
        // a 0 typed for the match on a form that asked about it is the answer "no match at this job" (P8: Casey typed 0, as the
        // note told her to, and was asked at once "No match on file. Is that right?")
        const saidNoMatch = !!land?.matchAsked && !blankMatch && match === 0 && !!gPid && plan.retirement?.workPlans?.[gPid]?.match === undefined;
        pending = editing ? "Contribution saved." : prefill ? { text: "Contribution added." } : "Contribution added.";
        const add = (t) => { const s = `${pending?.text ?? pending} ${t}`; pending = typeof pending === "object" ? { ...pending, text: s } : s; };
        if (pctOfPay !== null) add(`${Number((pctOfPay * 100).toFixed(2))}% of your pay is ${fmt.money(amount, cur)} each time.`);
        if (guessMatch > 0) add(`The employer's ${money0(guessMatch)} a year is our guess until you type the real figure.`);
        if (saidNoMatch) add(`Noted: no match at ${nameOf(nameFor(gPid))} job.`);
        update((p) => {
          p.retirement.contributions = p.retirement.contributions ?? [];
          if (editing) { applyContributionEdit(p, editing.id, clean); keepGuess(p, editing.id); } else { const id = ui.uid(); p.retirement.contributions.push({ id, ...clean }); keepGuess(p, id); }
          if (saidNoMatch && !hasMatch(p, gPid)) p.retirement.workPlans = { ...(p.retirement.workPlans ?? {}), [gPid]: { ...(p.retirement.workPlans?.[gPid] ?? {}), match: false } };
        });
        editing = null; prefill = null; prefillNote = null; landing = null;
      }, { submitLabel: editing ? "Save changes" : "Add contribution", resetAfter: !editing, onCancel: (editing || d.hasData || prefill) ? () => { editing = null; prefill = null; prefillNote = null; editNote = null; noteAt = null; landing = null; showForm = !d.hasData; drawForm(); } : null }),
      editing ? ui.h("p", { class: "ct-remove", style: { marginTop: "12px" } }, ui.button("Remove this contribution", () => { const id = editing.id; editing = null; landing = null; pending = "Contribution removed."; update((p) => { p.retirement.contributions = (p.retirement.contributions ?? []).filter((c) => c.id !== id); if (p.retirement.leftover?.rowId === id) delete p.retirement.leftover; }); }, { class: "danger" })) : null,
    ));
    const form = formHost.querySelector("form");
    const amountBox = form?.querySelector('[name="amount"]'), matchBox = form?.querySelector('[name="employerMatch"]');
    if (pair) taxQuestion(pair);
    // simple first (owner, 2026-11-12): editing a row opens on what goes in, how often and the match; which account it goes into
    // and whose it is are already right for a row on file and stay one quiet tap away, in the form (Save saves them as before).
    // The fold's line says the account, or "changed" when the person changed one; a box the browser will not take opens it.
    // "Remove this contribution" waits in the same fold, at its end: a red button under Save on every first view was a second,
    // dangerous action next to the one the person came for (simple-first pass, round 2)
    const moreLabs = editing ? ["accountId", "personId"].map((k) => form?.querySelector(`[name="${k}"]`)?.closest?.("label")).filter(Boolean) : [];
    const actions = form?.querySelector(".form-actions");
    if (moreLabs.length && actions) {
      const status = ui.h("span", { class: "fold-status" });
      const sayMore = () => {
        const acct = form.querySelector('[name="accountId"]'), who = form.querySelector('[name="personId"]');
        const changed = (acct && acct.value !== (editing?.accountId ?? acct.value)) || (who && (who.value || "") !== (editing?.personId || ""));
        status.textContent = changed ? "changed" : accounts.find((a) => a.id === acct?.value)?.name ?? "";
      };
      const more = ui.h("details", { class: "fold ct-more" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "More options"), status, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")), ui.h("div", { class: "fold-body" }, ...moreLabs));
      actions.before(more);
      const remove = formHost.querySelector(".ct-remove");
      if (remove) more.querySelector(".fold-body")?.append(remove);
      sayMore();
      form.addEventListener?.("change", sayMore);
      form.addEventListener?.("invalid", () => { more.open = true; }, true);
    }
    // a landing's line sits right over the box it is about (under the tax line, P2), so the box in the middle of a phone screen has it in view
    const lab = noteEl && noteAt ? formHost.querySelector(`[name="${noteAt}"]`)?.closest?.("label") : null;
    if (lab?.before) lab.before(noteEl);
    // the grey guess in the match box follows the amount: the usual match at what the amount box says now (a placeholder: nothing moves)
    const periodOf = () => form?.querySelector('[name="period"]')?.value || editing?.period || "monthly";
    const pidOf = () => form?.querySelector('[name="personId"]')?.value || mg?.pid || "";
    const greyMatch = () => {
      if (!matchBox || !(start?.matchHint || mg)) return;
      const r = readAmountOrShare(amountBox?.value), per = periodOf(), gp = pidOf();
      if (!r || r.bad || !gp) return;
      const each = r.pct !== undefined ? r.pct * payOf(plan, gp, today) / perYear(1, per) : r.amount;
      const other = workRows(plan, gp).filter(({ c }) => c.id !== editing?.id).reduce((t, { c }) => t + perYear(Number(c.amount) || 0, c.period), 0);
      const g = plan.retirement?.workPlans?.[gp]?.match !== false ? usualMatchAt(plan, gp, today, perYear(each, per) + other) : 0;
      if (g > 0) matchBox.setAttribute("placeholder", String(g));
    };
    amountBox?.addEventListener?.("change", greyMatch);
    // "Use the usual 6.6% ($396 a month)": the change the card tried, put in by the person's own tap (P2), so the chip and Save
    // give the answer the card showed (said = done)
    if (land?.tried && amountBox) {
      const t = land.tried;
      const chip = ui.h("button", { type: "button", class: "chip", "aria-pressed": "false", onClick: () => {
        amountBox.value = String(t.amount);
        const per = form.querySelector('[name="period"]'); if (per) per.value = t.period;
        chip.classList.add("on"); chip.setAttribute("aria-pressed", "true");
        greyMatch();
      } }, t.label);
      amountBox.addEventListener?.("input", () => { chip.classList.remove("on"); chip.setAttribute("aria-pressed", "false"); });
      (form.querySelector('[name="nowAmount"]') ?? amountBox).closest("label")?.after(ui.h("div", { class: "chips ct-use" }, chip));
    }
  };
  // a refused save: the reason over the form, brought into view (it was drawn above the screen when Save sat at the foot of it,
  // so a tap on Save seemed to do nothing: round 2's walk of Casey's landing, 2026-11-13)
  function formFail(text) {
    formHost.querySelector(".notice.error")?.remove();
    const n = ui.notice("error", text);
    formHost.prepend(n);
    n.scrollIntoView?.({ block: "center" });
    return false;
  }
  // the date of the table a kept guess came from (the ledger's own, when the row had one)
  const guessDate = (p, id) => (id ? p.guesses?.[`retirement.contributions[${id}].employerMatch`]?.d ?? null : null);
  // ---- pay the tax later or now (spec part C, L6) ----
  // this year's federal tax on a plan (the Federal estimate's own), or null when it cannot be worked out
  function fedTax(p) { try { const r = federalOf(p, { today }); return Number.isFinite(r?.result?.totalTax) ? r.result.totalTax : null; } catch { return null; } }
  // this year's federal and state income tax on the Income page's money, the month's own (Next best action takes these off the
  // month): { federal, state } a year, or null
  function monthTax(p) { try { const t = yearTaxes(p, { today }); return Number.isFinite(t?.federal) ? { federal: t.federal, state: Number(t.state) || 0 } : null; } catch { return null; } }
  /**
   * What paying the tax now costs this year against paying it all later, for the same money going in (review 2026-11-12, M4):
   * { year (federal income tax a year, the Federal estimate's own difference, to $10), state (the state's income tax moves
   * too), month (take-home pay a month: the month's federal and state tax, a twelfth) } or null. `q` is the plan as it would
   * be, `later` the same plan with all of that money pay-the-tax-later.
   */
  function taxCost(q, later) {
    const a = fedTax(q), b = fedTax(later);
    if (a === null || b === null) return null;
    const year = Math.round((a - b) / 10) * 10;
    const ma = monthTax(q), mb = monthTax(later);
    const state = ma && mb ? ma.state - mb.state : 0;
    const month = ma && mb ? (ma.federal + ma.state - mb.federal - mb.state) / 12 : (a - b) / 12;
    return { year, state, month: Math.round(month) };
  }
  const taxCostWords = (c) => (c && c.year >= 10 ? `About ${fmt.money(c.year, cur)} a year more in federal income tax than paying it all later${c.state >= 5 ? " (state tax on top)" : ""}: about ${fmt.money(c.month, cur)} a month less take-home pay.` : "");
  const eachOf = (text, period, pid) => {
    // "4%" is a share of the person's pay, each time; dollars as typed; blank is 0
    const said = readAmountOrShare(text);
    if (said === null) return { each: 0, blank: true };
    if (said.bad) return { bad: "That isn't an amount. Type dollars, like 270, or a share of your pay, like 4%." };
    if (said.pct === undefined) return { each: said.amount };
    const pay = pid ? payOf(plan, pid, today) : 0;
    if (said.pct > 1) return { bad: "A share of pay can't be more than 100%." };
    if (!(pay > 0)) return { bad: "We don't have this person's pay yet, so we can't turn a share of it into dollars. Type dollars, or add their pay on Income first." };
    return { each: Math.round(said.pct * pay / perYear(1, period) * 100) / 100, pct: said.pct };
  };
  // what the two boxes say for the choice: { later, now } each time (and the shares typed), or { bad }; `blank`: nothing was typed
  const splitOf = (choice, v, pair) => {
    const period = v.period || pair.period;
    const a = eachOf(v.amount, period, pair.pid), b = choice === "some" ? eachOf(v.nowAmount, period, pair.pid) : { each: 0, blank: true };
    if (a.bad || b.bad) return { bad: a.bad ?? b.bad };
    const blank = !!a.blank && !!b.blank;
    return choice === "now" ? { later: 0, now: a.each, nowPct: a.pct, period, blank } : { later: a.each, laterPct: a.pct, now: b.each, nowPct: b.pct, period, blank };
  };
  const newIds = () => ({ nowRow: ui.uid(), laterRow: ui.uid(), nowAccount: ui.uid(), laterAccount: ui.uid() });
  const rothName = (pid) => { const adults = people.length; const n = people.find((p) => p.id === pid)?.name; return adults > 1 && n ? `${NameOf(n)} ${rothAccountName(null)}` : rothAccountName(null); };
  function saveTax(pair, v, v0) {
    const fail = formFail;
    const sp = splitOf(taxChoice, v, pair);
    if (sp.bad) return fail(sp.bad);
    // a blank box is refused, as it is when the tax answer is left alone; a 0 typed keeps the row at $0 (N3: a changed tax
    // answer with the box cleared deleted the row and said "Saved: $0 a month")
    if (sp.blank) return fail("Type how much goes in each time, like 250.");
    const match = Math.max(0, Number(v.employerMatch) || 0);
    if (perYear(sp.later + sp.now, sp.period) + match > CONTRIBUTION_YEARLY_CEILING) return fail(`That comes to ${fmt.money(perYear(sp.later + sp.now, sp.period) + match, cur)} a year, more than anyone can put into these accounts. Check for an extra digit: the boxes are what goes in each time.`);
    const nothing = !(sp.later > 0) && !(sp.now > 0) && !(match > 0);
    // which of the two rows are there after the save (applyTaxChoice): the row asked about stays when nothing goes in
    const laterStays = nothing ? pair.later?.id === editing.id : taxChoice !== "now" ? sp.later > 0 || match > 0 : match > 0;
    const nowStays = nothing ? pair.now?.id === editing.id : taxChoice !== "later" && sp.now > 0;
    // "Into which account" or "Whose" changed with the tax answer (N5: it was ignored while the page said Saved): the row
    // asked about moves to another account of its own kind; anything else is asked for one step at a time
    const isLaterRow = pair.later?.id === editing.id;
    const from = (plan.accounts ?? []).find((a) => a.id === editing.accountId), to = (plan.accounts ?? []).find((a) => a.id === v.accountId);
    const move = to && from && to.id !== from.id ? to : null;
    const who = (v.personId || "") !== (editing.personId || "") ? v.personId || "" : null;
    if (move && !((isLaterRow ? isLaterAccount(to) && laterStays : isNowAccount(to) && nowStays))) return fail("Change the account on its own first: save that, then answer the tax question.");
    const per = PER[sp.period] ?? "each time";
    const roth = pair.nowAccount?.name ?? (pair.jobs > 1 ? rothPartName(pair.laterAccount?.name) : rothName(pair.pid));
    // a Roth account that was a Roth 401(k) only by the match on its row keeps counting as one, by name (N2)
    const renamed = nowStays && Number(pair.now?.employerMatch) > 0 ? rothRenameOf(pair.nowAccount) : null;
    const rothNow = renamed ?? roth;
    // the tax answer itself moved: another of the three answers, or the same "Some of each" with money moved from one part to
    // the other and the total kept. Only then is the retirement answer left out (D-C3); a save that keeps the answer and changes
    // what goes in or the match says what changed and what it did to the retirement answer, as every other save does (the final
    // review F5: a match typed after "Check the match ›" on a Roth row, or the later part raised from $270 to $470, said only
    // the tax sentence)
    const nowYear = perYear(sp.now, sp.period), ownYear = perYear(sp.later + sp.now, sp.period);
    const ownMoved = Math.abs(ownYear - pair.ownYearly) >= 0.5, matchMoved = Math.abs(match - pair.match) >= 0.5;
    const taxMoved = taxChoice !== pair.choice || (taxChoice === "some" && !ownMoved && Math.abs(nowYear - pair.nowYearly) >= 0.5);
    const whose = nameOf(nameFor(pair.pid));
    const matchWords = match > 0 ? `${whose} employer adds ${fmt.money(match, cur)} a year${pair.now?.id === editing.id ? " (on the pay-the-tax-later row)" : ""}` : `no match from ${whose} employer`;
    // the match first when the form was opened to ask about it, or when only the match changed
    const matchFirst = !taxMoved && matchMoved && (!ownMoved || (!!landing?.matchAsked && landing.rowId === editing.id));
    // one sentence (P3: 50 words in a notice that left the screen); this year's tax and the mix are in the line under the rows
    const parts = taxChoice === "later" ? `${fmt.money(sp.later, cur)} ${per} goes in paying the tax later`
      : taxChoice === "now" || !(sp.later > 0) ? `${fmt.money(sp.now, cur)} ${per} goes into ${rothNow}, paying the tax now`
      : `${fmt.money(sp.later, cur)} ${per} paying the tax later${match > 0 && !matchFirst ? " (with the match)" : ""}, ${fmt.money(sp.now, cur)} ${per} paying it now`;
    const text = nothing ? `Saved: nothing goes in now. The row stays at $0; "Remove this contribution" takes it out.`
      : matchFirst ? `Saved: ${matchWords}${ownMoved ? `, and ${parts}` : ""}.`
      : taxChoice === "later" ? `Saved: ${parts}${match > 0 ? ", with the match" : ""}.`
      : taxChoice === "now" || !(sp.later > 0) ? `Saved: ${parts}${match > 0 ? "; the match stays pay-the-tax-later" : ""}.`
      : `Saved: ${parts}.`;
    pending = { text: `${text}${!taxMoved && matchMoved && !matchFirst ? ` ${matchWords.charAt(0).toUpperCase()}${matchWords.slice(1)}.` : ""}${renamed ? ` ${pair.nowAccount.name} is now named "${renamed}", so it still counts as a Roth 401(k).` : ""}${move ? ` It now goes into ${move.name}.` : ""}`, tax: taxMoved };
    const id = editing.id;
    editing = null; prefill = null; prefillNote = null; taxFor = null; landing = null;
    update((p) => {
      const after = applyTaxChoice(p, id, { choice: taxChoice, laterEach: sp.later, nowEach: sp.now, laterPct: sp.laterPct, nowPct: sp.nowPct, period: sp.period, match, today, ids: newIds(), accountName: roth });
      const list = p.retirement.contributions ?? [];
      const mine = [after?.later, after?.now].filter(Boolean).map((c) => list.find((x) => x.id === c.id)).filter(Boolean);
      if (move) {
        const row = list.find((c) => c.id === id);
        if (row) { row.accountId = move.id; if (isLaterRow) for (const c of mine) if (c.pairOf === from.id) c.pairOf = move.id; }
      }
      if (who !== null) for (const c of mine) c.personId = who;
    });
    return undefined;
  }
  // the tax line over the own-money box, the three answers one tap away, the words of the boxes for each answer, what the two
  // parts add up to, this year's tax, the rule of thumb, the catch-up
  function taxQuestion(pair) {
    const form = formHost.querySelector("form");
    const amountBox = form?.querySelector('[name="amount"]'), nowBox = form?.querySelector('[name="nowAmount"]');
    const amountLab = amountBox?.closest("label"), nowLab = nowBox?.closest("label");
    if (!amountLab || !nowLab) return;
    const person = people.find((p) => p.id === pair.pid);
    const age = person?.birthDate ? Number(String(today).slice(0, 4)) - Number(String(person.birthDate).slice(0, 4)) : null;
    const catchUp = catchUpRothWords(age, pair.pid ? payOf(plan, pair.pid, today) : 0, Number(String(today).slice(0, 4)));
    const periodNow = () => form.querySelector('[name="period"]')?.value || pair.period;
    const perWords = () => PER[periodNow()] ?? "each time";
    // the own money on file, each time in the form's period: "Some of each" keeps it unless the person changes it (M2)
    const totalEach = () => Math.round(pair.ownYearly / perYear(1, periodNow()) * 100) / 100;
    // two lines whose room is kept from the first draw: the longest sentence each can hold is there, unseen, behind the words
    // (P1: the tax line was inserted above the boxes on their change event, which the tap on Save itself fires, so Save
    // jumped 43 px from under the thumb and nothing was saved)
    const live = (longest) => { const words = ui.h("span", {}); return { el: ui.h("p", { class: "ct-live small", "aria-live": "polite", "data-size": longest }, words), say: (t) => { words.textContent = t; } }; };
    const sumLine = live("That is $99,999 every three months in all, $99,999 more than now. Add the two parts yourself, then choose again.");
    const taxLine = live("About $99,990 a year more in federal income tax than paying it all later (state tax on top): about $9,999 a month less take-home pay.");
    const CHOICES = [["later", "Pay the tax later"], ["now", "Pay the tax now"], ["some", "Some of each"]];
    const chips = ui.h("div", { class: "chips ct-chips", role: "group", "aria-label": "When do you pay the tax on it?" });
    const quiet = ui.h("span", {});
    const QUIET = { later: "Tax on this money: paid later, the usual.", now: "Tax on this money: paid now (Roth).", some: "Tax on this money: some paid later, some now (Roth)." };
    const more = ui.h("div", { class: "ct-tax-more" });
    let laterTouched = false, sumNote = "";
    // this year's tax for the boxes as they stand, against all of it paid later (worked out on a change, not a keystroke)
    const sayTax = () => {
      if (taxChoice === "later") { taxLine.say(""); return; }
      const sp = splitOf(taxChoice, { amount: amountBox.value, nowAmount: nowBox.value, period: periodNow() }, pair);
      if (sp.bad || !(sp.now > 0)) { taxLine.say(taxChoice === "some" ? "This year's tax for the two parts shows here once both are typed." : ""); return; }
      const tryOn = (choice, laterEach, nowEach) => { const q = structuredClone(plan); applyTaxChoice(q, pair.row.id, { choice, laterEach, nowEach, period: sp.period, match: pair.match, today, ids: newIds() }); return q; };
      taxLine.say(taxCostWords(taxCost(tryOn(taxChoice, sp.later, sp.now), tryOn("later", sp.later + sp.now, 0))));
    };
    // what the two parts add up to, against what goes in now (M2: typing only the pay-the-tax-now part added new money to the plan)
    const saySum = () => {
      if (taxChoice !== "some") { sumLine.say(""); return; }
      const total = totalEach(), per = perWords();
      const a = eachOf(amountBox.value, periodNow(), pair.pid), b = eachOf(nowBox.value, periodNow(), pair.pid);
      const rest = `Now ${fmt.money(total, cur)} ${per} in all.`;
      if (sumNote) { sumLine.say(sumNote); return; }
      if (a.bad || b.bad) { sumLine.say(rest); return; }
      const sum = Math.round((a.each + b.each) * 100) / 100, diff = Math.round((sum - total) * 100) / 100;
      sumLine.say(b.blank ? `${rest} Type the part that pays the tax now; the rest stays pay-the-tax-later.` : Math.abs(diff) < 0.005 ? rest : `That is ${fmt.money(sum, cur)} ${per} in all, ${fmt.money(Math.abs(diff), cur)} ${diff > 0 ? "more" : "less"} than now.`);
    };
    // the pay-the-tax-now part typed: it comes out of the pay-the-tax-later box, so the total stays what it is (in shares of
    // pay when the total is a whole share of pay, else in dollars, to the cent), unless the person typed that box themselves
    const takeFromLater = () => {
      if (taxChoice !== "some" || laterTouched) return;
      const b = eachOf(nowBox.value, periodNow(), pair.pid);
      if (b.bad || b.blank) return;
      const pay = pair.pid ? payOf(plan, pair.pid, today) : 0;
      const share = pay > 0 ? pair.ownYearly / pay : 0, whole = Math.abs(share * 1e4 - Math.round(share * 1e4)) < 0.005;
      if (b.pct !== undefined && whole && share >= b.pct) amountBox.value = `${Number(((share - b.pct) * 100).toFixed(2))}%`;
      else amountBox.value = String(Math.max(0, Math.round((totalEach() - b.each) * 100) / 100));
    };
    const draw = () => {
      for (const b of chips.children) { const on = b.getAttribute("data-choice") === taxChoice; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
      quiet.textContent = QUIET[taxChoice];
      amountLab.querySelector(".field-label").textContent = taxChoice === "some" ? "Pay the tax later: your own money" : taxChoice === "now" ? "Your own money (pay the tax now, into a Roth 401(k))" : "Your own money (pay the tax later)";
      // (a label .field is laid out by the stylesheet, which the hidden attribute alone does not undo)
      nowLab.hidden = taxChoice !== "some";
      nowLab.style.display = taxChoice === "some" ? "" : "none";
      for (const [l, on] of [[sumLine, taxChoice === "some"], [taxLine, taxChoice !== "later"]]) { l.el.hidden = !on; l.el.style.display = on ? "" : "none"; }
      saySum(); sayTax();
    };
    // leaving "Some of each", the two parts go back into one box: both shares of pay as a share, anything else in dollars
    // (B2: 4% and $130 could not be added, the $130 was dropped and the page said Saved). false: a part cannot be read
    const merge = () => {
      const a = readAmountOrShare(amountBox.value), b = readAmountOrShare(nowBox.value);
      if (!b) return true;
      if (a && !a.bad && !b.bad && a.pct !== undefined && b.pct !== undefined) { amountBox.value = `${Number(((a.pct + b.pct) * 100).toFixed(2))}%`; nowBox.value = ""; return true; }
      const x = eachOf(amountBox.value, periodNow(), pair.pid), y = eachOf(nowBox.value, periodNow(), pair.pid);
      if (x.bad || y.bad) return false;
      amountBox.value = String(Math.round((x.each + y.each) * 100) / 100); nowBox.value = "";
      return true;
    };
    for (const [k, label] of CHOICES) chips.append(ui.h("button", { type: "button", class: "chip", "data-choice": k, onClick: () => {
      const was = taxChoice;
      sumNote = "";
      if (was === "some" && k !== "some" && !merge()) { sumNote = "Add the two parts yourself, then choose again."; saySum(); return; }
      taxChoice = k;
      if (k === "some" && was !== "some") laterTouched = false;
      draw();
    } }, label));
    amountBox.addEventListener("change", () => { if (taxChoice === "some") laterTouched = true; sumNote = ""; saySum(); sayTax(); });
    nowBox.addEventListener("change", () => { sumNote = ""; takeFromLater(); saySum(); sayTax(); });
    form.querySelector('[name="period"]')?.addEventListener?.("change", () => { saySum(); sayTax(); });
    // the three answers, the rule of thumb and the catch-up, one quiet tap away ("Change ›" opens them and goes: opening or
    // closing never changes the plan, and a second tap of a double tap finds nothing under it)
    const open = () => {
      taxOpen = true;
      change.remove();
      // (the catch-up line only when there is one: append writes a null as the word "null", review 2026-11-13 F1)
      more.append(chips, ui.h("p", { class: "muted small", style: { margin: "0 0 4px" } }, TAX_RULE_OF_THUMB), ...(catchUp ? [ui.h("p", { class: "small", style: { margin: "4px 0" } }, catchUp)] : []));
    };
    const change = ui.h("button", { type: "button", class: "btn secondary small", "aria-label": "Change when the tax is paid", onClick: open }, "Change ›");
    const block = ui.h("div", { class: "ct-tax" },
      ui.h("div", { class: "ct-tax-line small" }, quiet, change),
      more,
      // a match typed by hand on the Roth 401(k) row (D-C2): said, and a save here puts it on a pay-the-tax-later row
      Number(pair.now?.employerMatch) > 0 || pair.now?.id === pair.row.id ? ui.h("p", { class: "small", style: { margin: "4px 0" } }, `${ROTH_MATCH_WORDS} ${Number(pair.now?.employerMatch) > 0 ? "Saving this form puts it there." : "A match typed here is saved on a pay-the-tax-later row of its own."}`) : null);
    amountLab.before(block);
    nowLab.after(sumLine.el, taxLine.el);
    if (taxOpen) open();
    draw();
  }
  /**
   * "When the tax is paid", a quiet fold under the rows that stays (review 2026-11-12, P3: this year's tax and the mix were in
   * a notice of 50 words that left the screen): for each person who pays the tax now on money at work, what that costs this
   * year against paying it all later (the form's own figure, M4), then the money when retirement starts by when its tax is paid
   * (D-C4). Worked out when it is opened; open right after a save of the tax answer. null when nobody pays the tax now.
   */
  function taxFold() {
    const rows = plan.retirement?.contributions ?? [];
    const acctOf = (c) => (plan.accounts ?? []).find((a) => a.id === c.accountId);
    const nowRows = rows.filter((c) => isNowAccount(acctOf(c), c.employerMatch) && perYear(Number(c.amount) || 0, c.period) > 0);
    if (!nowRows.length) return null;
    const pidOf = (c) => c.personId || acctOf(c)?.ownerId || "";
    const whoPays = [...new Set(nowRows.map(pidOf))];
    const nowYearly = nowRows.reduce((t, c) => t + perYear(Number(c.amount) || 0, c.period), 0);
    const body = ui.h("div", { class: "fold-body" });
    let done = false;
    const fill = () => {
      if (done) return;
      done = true;
      for (const pid of whoPays) {
        const mine = nowRows.filter((c) => pidOf(c) === pid);
        const q = structuredClone(plan);
        for (const c of mine) { const pr = taxPairOf(q, c.id); if (pr) applyTaxChoice(q, c.id, { choice: "later", laterEach: pr.laterEach + pr.nowEach, period: pr.period, match: pr.match, today, ids: newIds() }); }
        const m = mine.reduce((t, c) => t + perYear(Number(c.amount) || 0, c.period), 0) / 12;
        const name = nameFor(pid);
        body.append(ui.h("p", { class: "small" }, `${name ? `${NameIn(name)} ${verbFor(name, "pays", "pay")}` : "The household pays"} the tax now on ${fmt.money(Math.round(m), cur)} a month (Roth 401(k)). ${taxCostWords(taxCost(plan, q))}`.trim()));
      }
      let pd = null;
      try { pd = ctx.computeOf?.("retirement/projection", { today }) ?? null; } catch { pd = null; }
      const mix = pd?.ready ? mixWords(mixAtRetirement(pd)) : "";
      if (mix) body.append(ui.h("p", { class: "small" }, mix));
      body.append(ui.h("p", { class: "muted small" }, "Which is better depends on your tax rate in retirement, which nobody knows yet. To change it, tap a row above."));
    };
    const fold = ui.h("details", { class: "fold ct-taxfold", open: taxSaved ? true : null },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "When the tax is paid"), ui.h("span", { class: "fold-status" }, `${fmt.money(Math.round(nowYearly / 12), cur)} a month now`), ui.h("span", { class: "fold-chev" }, "›")),
      body);
    fold.addEventListener?.("toggle", () => { if (fold.open) fill(); });
    if (taxSaved) fill();
    return fold;
  }
  // ---- landings (spec L3): the card on Will the money last? links here, onto the box that holds the figure ----
  const PER = { weekly: "a week", biweekly: "every two weeks", semimonthly: "twice a month", monthly: "a month", quarterly: "every three months", annual: "a year" };
  const money0 = (n) => fmt.money(Math.round(n), cur);
  // the box, in the middle of the screen, focused and outlined for 2 seconds; at once after a tap (a phone opens its keyboard
  // only then), after the first paint on arrival
  const focusBox = (key, tapped) => {
    const go = () => {
      const box = formHost.querySelector(`[name="${key}"]`);
      if (!box || box.isConnected === false) return;
      const at = box.closest?.("label") ?? box;
      at.scrollIntoView?.({ block: "center", behavior: tapped ? "smooth" : "auto" });
      box.focus?.({ preventScroll: true });
      box.select?.();
      at.classList?.add("ct-show");
      setTimeout(() => at.classList?.remove("ct-show"), 2000);
    };
    if (tapped) go(); else afterPaint(go);
  };
  const setEdit = (r, note, land = null, at = "amount") => {
    editing = { ...r, accountName: d.items.find((x) => x.id === r.id)?.accountName ?? (plan.accounts ?? []).find((x) => x.id === r.accountId)?.name ?? "" };
    editNote = note; landing = land ? { ...land, rowId: r.id } : null; noteAt = at; showForm = true;
  };
  // the match box: the usual match at what goes in now (the figure the card tried), and where the real one is written
  const matchNote = (ml) => {
    const name = nameFor(ml.pid), whose = nameOf(name), who = nameIn(name);
    const usual = !(ml.usual > 0) ? "" : ml.typed ? `With the match typed on Work benefits, about ${money0(ml.usual)} a year comes in at what goes in now. ` : `Most employers that match add ${usualMatchWords()}: about ${money0(ml.usual)} a year for ${who} at what goes in now. `;
    return `${usual}Type the real figure from ${whose} benefits site or a pay stub, or 0 if ${whose} job adds nothing.`;
  };
  // what goes in: the row (or a new one) opens as it is, with a note naming the change the card tried and a chip that puts it
  // in, so the chip and Save give the effect the card showed (said = done); nothing of ours is typed in for the person
  function landAdd(pid) {
    const wl = people.some((p) => p.id === pid) ? workLanding(plan, pid, { today }) : null;
    if (!wl) return false;
    const name = nameFor(pid), whose = nameOf(name), like = nameIn(name) === "you" ? "yours" : nameOf(name);
    const alt = wl.alt, r = wl.rowId ? (plan.retirement?.contributions ?? []).find((x) => x.id === wl.rowId) : null;
    const per = r?.period && PER[r.period] ? r.period : "monthly";
    const each = (monthly) => monthly * 12 / perYear(1, per);
    // the change the card tried, named, and offered as one tap under the box; nothing of ours is typed in (P2), and the match
    // it counted is named with it and asked in the match box (M5)
    const usualMatch = wl.matchGuess > 0 ? `, and the usual match at that, about ${money0(wl.matchGuess)} a year, our guess until you type the real one` : "";
    const tried = !alt ? "" : alt.kind === "usual" ? `${pctText(alt.share)} of pay (${money0(alt.monthly)} a month), the usual for pay like ${like}${usualMatch}`
      : `${alt.kind === "full" ? `${pctText(alt.share)} of pay, enough for the whole usual match` : "1% of pay more"}: ${money0(each(alt.monthly))} ${PER[per]}${r ? ` instead of ${money0(Number(r.amount) || 0)}` : ""}${alt.kind === "full" ? usualMatch : ""}`;
    const note = `${tried ? `The change we tried on your retirement answer was ${tried}. ` : ""}Type what really goes in each time (a pay stub shows it)${alt ? ", or tap the button under the box to use that amount" : ""}.`;
    const eachTried = alt ? Math.round(each(alt.monthly) * 100) / 100 : 0;
    const land = alt ? { pid, fill: wl.fill, matchGuess: wl.matchGuess, matchAsked: wl.matchGuess > 0,
      tried: { amount: eachTried, period: per, label: alt.kind === "usual" ? `Use the usual ${pctText(alt.share)} (${money0(eachTried)} ${PER[per]})` : alt.kind === "full" ? `Use ${pctText(alt.share)} of pay (${money0(eachTried)} ${PER[per]})` : `Use 1% more (${money0(eachTried)} ${PER[per]})` } } : null;
    if (r) { setEdit(r, note, land); return "amount"; }
    if (wl.accountId && accounts.some((a) => a.id === wl.accountId)) { prefill = { personId: pid, accountId: wl.accountId }; prefillNote = note; landing = land; noteAt = "amount"; showForm = true; return "amount"; }
    if (askEl) return askEl;   // no 401(k) on file yet: the question above starts it
    prefill = { personId: pid }; prefillNote = `Type what goes into ${whose} plan at work each time; a pay stub shows it.`; showForm = true;
    return "amount";
  }
  const q = ctx.route?.query ?? {};
  let landOn = null;
  if ((q.add || q.match) && ctx.route && landedFor !== ctx.route) {
    landedFor = ctx.route;
    landOn = q.match ? (matchLanding(plan, String(q.match), { today }) && (plan.retirement?.contributions ?? []).some((x) => x.id === String(q.match)) ? "match" : null) : landAdd(String(q.add));
    if (landOn === "match") { const ml = matchLanding(plan, String(q.match), { today }); setEdit((plan.retirement.contributions ?? []).find((x) => x.id === String(q.match)), matchNote(ml), { pid: ml.pid, matchAsked: true }, "employerMatch"); }
  }
  formCard.classList?.add("ct-form");
  drawForm();
  if (landOn === "match") focusBox("employerMatch", false);
  else if (landOn === "amount") focusBox("amount", false);
  else if (landOn && typeof landOn === "object") afterPaint(() => { landOn.scrollIntoView?.({ block: "start" }); const h2 = landOn.querySelector?.("h2"); if (h2) { h2.setAttribute("tabindex", "-1"); h2.focus?.({ preventScroll: true }); } });
  if (d.items.length) root.append(ui.card("Contributions",
    ui.h("ul", { class: "page-list" }, d.items.map((c) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => { editing = plan.retirement.contributions.find((x) => x.id === c.id); editing = { ...editing, accountName: c.accountName }; editNote = null; landing = null; noteAt = null; taxFor = null; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" }); },
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "ic" }, "🏦"),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.accountName), ui.h("div", { class: "d" }, `${c.personName} · ${fmt.money(c.amount, cur)} ${c.periodLabel.toLowerCase()}${shareOf(plan.retirement.contributions.find((x) => x.id === c.id)) ? ` (${Number((plan.retirement.contributions.find((x) => x.id === c.id).pctOfPay * 100).toFixed(2))}% of pay)` : ""}${isGuess(plan, `retirement.contributions[${c.id}].amount`) ? " (our guess)" : ""}${c.matchYearly ? ` · employer adds ${fmt.money(c.matchYearly, cur)} a year${isGuess(plan, `retirement.contributions[${c.id}].employerMatch`) ? " (our guess)" : ""}` : ""}${c.bank ? " · stays in the bank, counted for later" : ""}`)),
      // "Edit ›" under the amount, as on Income and Expenses (stress test 2026-11-11, CF-8: the rows could be tapped and did not say so)
      ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(c.totalYearly, cur)), ui.h("div", { class: "muted small" }, "a year"), ui.h("div", { class: "muted small" }, "Edit \u203a"))))),
    taxFold(),
  ));
  formCard.append(formHost);
  // no account yet: the form has nothing to show, so no empty card (round 8)
  if (accounts.length) root.append(formCard);
}
