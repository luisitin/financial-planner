// modules/retirement/contributions/view.js -- DOM only. What goes into each retirement account
// a year, with the match and the limits, and one folded form to add or edit.
import { compute } from "./compute.js";
import { PERIOD_OPTIONS, perYear } from "../../../core/math/periods.js";
import { readAmount, amountText } from "../../../core/format.js";
import { clearGuess, isGuess } from "../../../core/estimate/index.js";
import { jobPayOf as payOf } from "../../overview/guesses/estimators/saving.js";
import { BUCKET_OF } from "../projection/compute.js";
import { nameIn, NameIn, nameOf, NameOf, verbFor } from "../../../core/words.js";
import { leftWords } from "../../overview/next-best-action/compute.js";

let pending = null;
// "Yes: add what Bo puts in" opens the add form with Bo and Bo's 401(k) already chosen
let prefill = null;
let prefillNote = null;   // a line over the form saying what it was filled in with
/** A contribution's period for a number of paychecks a year (Work benefits' `paychecks`); anything else goes in once a year. */
const PERIOD_FOR = { 52: "weekly", 26: "biweekly", 24: "semimonthly", 12: "monthly" };

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
  const d = compute(plan, { today: fmt.today() });
  const accounts = (plan.accounts ?? []).filter((a) => BUCKET_OF[a.type] && BUCKET_OF[a.type] !== "cash");
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  let editing = null;
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
    { key: "employerMatch", label: "Employer adds, a year", type: "money", min: 0, help: "the match or profit sharing, per year; blank for none" },
  ];

  // The Dashboard's next move can be "Check if Bo's job matches retirement saving": a 401(k) and pay with nothing going in,
  // or (round 8) pay and no 401(k) on file at all. One question, three answers, so the move can be done here.
  const nba = ctx.computeOf?.("overview/next-best-action", { today: fmt.today() });
  const ask = nba?.ready ? (nba.steps.find((s) => s.id === "match" && s.status !== "done")?.ask ?? []) : [];
  const startable = ask.some((a) => a.noAccount);
  const matchStep = nba?.ready ? nba.steps.find((s) => s.id === "match" && s.status !== "done") ?? null : null;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasData ? `${fmt.money(d.totalYearly, cur)} a year into retirement accounts` : "Retirement contributions"),
    ui.h("p", { class: "lede" }, d.hasData ? `${fmt.money(d.yearly, cur)} of your own money and ${fmt.money(d.matchYearly, cur)} from employers. The Projection page adds these every year until each person retires.` : "Money you put into retirement accounts each paycheck, and what your employer adds. The plan uses it to grow your savings until you retire."),
    // no retirement account yet: a paid adult's 401(k) starts from the question below in one tap (round 8); the rest on Net worth
    // (review UX 8: "starts a 401(k) at work" claimed more than a plan can do; the plan gets it, work starts it)
    !accounts.length ? ui.h("p", { class: "muted small" }, startable ? "No retirement account yet: one tap below adds your 401(k) to the plan. An IRA, Roth or HSA goes on the " : "First add the retirement accounts themselves on the ", ui.h("a", { href: "#/balance/net-worth" }, "Net worth page"), startable ? "." : " (401(k), IRA, Roth, HSA, brokerage).") : null,
    d.hasData ? enoughLine() : null,
  ));
  // "are we saving enough?": the share of pay, then the plan's own answer (Will the money last?), the same one the
  // Dashboard, How am I doing? and Next best action give
  function enoughLine() {
    const st = ctx.computeOf?.("overview/setup", { today: fmt.today(), screen: "done" })?.standing ?? null;
    const inc = ctx.computeOf?.("cashflow/income", { today: fmt.today() }) ?? null;
    // earned pay, a business's income included (what a SEP or solo 401(k) is based on), as How am I doing? counts it
    const pay = (inc?.active ?? []).filter((x) => x.type === "salary" || x.type === "bonus" || x.type === "business").reduce((t, x) => t + (Number(x.yearly) || 0), 0);
    const share = pay > 0 ? `That is ${Math.round((d.totalYearly / pay) * 100)}% of your pay, your employers' money included. ` : "";
    // what is still missing, named (birth dates or Social Security), not always "Social Security"; a verdict on our guesses waits
    const said = verdictWords(st);
    if (!share && !said) return null;
    return ui.h("p", { class: "small" }, `${share}${said} `, ui.h("a", { href: "#/retirement/projection" }, "Will the money last? ›"));
  }
  for (const w of d.warnings) root.append(ui.notice("warn", w));
  const out = ui.h("div");
  if (pending && typeof pending === "object") {
    // an answer to the match question: say what the next move is now, from the Dashboard's own list
    const mv = ctx.computeOf?.("overview/setup", { today: fmt.today(), screen: "done" })?.standing?.moves?.[0] ?? null;
    const n = ui.notice("ok", pending.text);
    // what the month has left now, after a start that takes from take-home pay (review D2)
    if (pending.left) { const w = leftWords(nba, cur); if (w) n.append(" ", w); }
    if (mv) n.append(" ", ui.h("a", { href: mv.href }, `Your next move: ${mv.title} ›`));
    out.append(n); pending = null;
  } else if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);

  // the answers: add what goes in, no match at that job, or an old job's 401(k)
  const formCard = ui.card(null);
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
            : `${NameOf(a.name)} job has a plan with a match. A common match, 50% of what you put in up to 6% of pay, would add about ${fmt.money(Math.round(m.match / 10) * 10, cur)} a year for ${who}: putting in ${pctOf(m.pct)} (${money(m.perCheck)} a paycheck, about ${money(m.take)} less take-home pay) gets all of it. Human resources can say what the real match is.`),
          costNote(),
          ui.h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
            ui.button(`Start it at ${pctOf(m.pct)}`, () => { pending = { text: addedWords(m, known), left: true }; store.update((p) => contribute(p, acct.id, m, known)); }),
            ui.button("Type my own amount", () => {
              prefill = { personId: a.personId, accountId: acct.id, period: periodOf(m), amount: eachOf(m) };
              prefillNote = `Filled in with ${pctOf(m.pct)} of pay, ${money(eachOf(m))} a paycheck: change it to yours${known ? "" : ", and add what the employer puts in when you know it"}.`;
              editing = null; showForm = true; drawForm(); formCard.scrollIntoView?.({ behavior: "smooth", block: "start" });
            }, { class: "secondary" })),
          known ? ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, "The match is the one typed on ", ui.h("a", { href: "#/career/benefits" }, "Work benefits"), ".") : null));
        continue;
      }
    }
    const noPlanAnswer = () => { pending = { text: `Noted: no plan or no match at ${whose} job.` }; store.update((p) => { p.retirement.workPlans = { ...(p.retirement.workPlans ?? {}), [a.personId]: { ...(p.retirement.workPlans?.[a.personId] ?? {}), match: false } }; }); };
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
        store.update((p) => {
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
          : `Many employers add money when you save for retirement through work, in a 401(k) or 403(b): free money worth getting in full.${m ? ` A common match, 50% of what you put in up to 6% of pay, would add about ${fmt.money(Math.round(m.match / 10) * 10, cur)} a year for ${who}.` : ""}`),
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
              store.update((p) => { const r = (p.retirement.contributions ?? []).find((x) => x.id === a.rowId); if (r) { r.amount = a.wantMonthly; r.period = "monthly"; r.pctOfPay = a.wantPct; clearGuess(p, `retirement.contributions[${a.rowId}].amount`); } });
            }),
            ui.button("Type my own amount", () => { editing = { ...row, accountName: acct?.name ?? "" }; showForm = true; drawForm(); formCard.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, { class: "secondary" })),
          ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, "Your pay stub shows the real figures. Type them here when you have them.")));
        continue;
      }
    }
    const acct = (plan.accounts ?? []).find((x) => x.id === a.accounts[0]);
    root.append(ui.h("section", { class: "card" },
      ui.h("h2", {}, `Does ${whose} job add money when ${who} ${verb("saves", "save")} for retirement?`),
      a.saidPlan ? ui.h("p", {}, `${NameOf(a.name)} job has a retirement plan (you said so in Get started), but nothing goes into it yet. Many employers add money when you put some in (a match): free money worth getting in full.`) :
      ui.h("p", {}, `${Who} ${verb("is paid and has", "are paid and have")} ${a.accounts.length > 1 ? `${a.accounts.length} 401(k)s (${a.accounts.map((id) => (plan.accounts ?? []).find((x) => x.id === id)?.name).filter(Boolean).join(", ")})` : acct && /401/.test(acct.name ?? "") ? acct.name : `a 401(k)${acct?.name ? ` (${acct.name})` : ""}`}, but nothing goes into ${a.accounts.length > 1 ? "them" : "it"} in this plan. Many employers add money when you put some in (a match): free money worth getting in full.`),
      ui.h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
        ui.button(`Yes, it matches: add what ${who} ${verb("puts", "put")} in`, () => {
          // the 401(k) at the job now: one whose name does not say it is an old one
          const cur = a.accounts.map((id) => (plan.accounts ?? []).find((x) => x.id === id)).filter(Boolean);
          const now = cur.find((x) => !/\b(old|former|previous|prior|rollover)\b/i.test(x.name ?? "")) ?? cur[0];
          prefill = { personId: a.personId, accountId: now?.id ?? accounts[0]?.id };
          editing = null; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" });
        }),
        ui.button(`No match at ${whose} job`, () => {
          pending = { text: `Noted: no match at ${whose} job.` };
          store.update((p) => { p.retirement.workPlans = { ...(p.retirement.workPlans ?? {}), [a.personId]: { ...(p.retirement.workPlans?.[a.personId] ?? {}), match: false } }; });
        }, { class: "secondary" }),
        // one button per 401(k) when there are several, so only the old one is marked (none when the job's plan was said in Get started)
        ...(a.saidPlan ? [] : a.accounts.length > 1 ? a.accounts : [a.accounts[0]]).map((id) => {
          const x = (plan.accounts ?? []).find((y) => y.id === id);
          return ui.button(a.accounts.length > 1 ? `${x?.name ?? "This 401(k)"} is from a job ${who} left` : `That 401(k) is from a job ${who} left`, () => {
            pending = { text: `Noted: ${x?.name ?? "that 401(k)"} is from a job ${who} left, so no money goes in.` };
            store.update((p) => { const y = (p.accounts ?? []).find((z) => z.id === id); if (y) y.formerJob = true; });
          }, { class: "secondary" });
        })),
      ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, "Not sure? Your pay stub or your job's benefits site shows what goes in each paycheck and what the employer adds.")));
  }
  // what was answered, so it can be taken back
  const answered = [
    ...people.filter((p) => plan.retirement?.workPlans?.[p.id]?.match === false).map((p) => ({ text: `No match at ${nameOf(p.name)} job`, undo: (draft) => { if (draft.retirement.workPlans?.[p.id]) delete draft.retirement.workPlans[p.id].match; } })),
    ...people.filter((p) => plan.retirement?.workPlans?.[p.id]?.match === true).map((p) => ({ text: `A plan with a match at ${nameOf(p.name)} job`, undo: (draft) => { if (draft.retirement.workPlans?.[p.id]) delete draft.retirement.workPlans[p.id].match; } })),
    ...(plan.accounts ?? []).filter((x) => x.formerJob).map((x) => ({ text: `${x.name}: from a job left`, undo: (draft) => { const y = (draft.accounts ?? []).find((z) => z.id === x.id); if (y) delete y.formerJob; } })),
  ];
  if (answered.length) root.append(ui.card(null, ...answered.map((x) => ui.h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" } },
    ui.h("span", { class: "muted small" }, x.text),
    ui.button("Change", () => { pending = { text: "Answer taken back." }; store.update(x.undo); }, { class: "secondary small" })))));

  if (d.byPerson.some((p) => p.limits.length)) root.append(ui.card(`Against the ${d.limitsYear} limits`,
    ui.h("ul", { class: "records" }, d.byPerson.flatMap((p) => p.limits.map((l) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${p.name}: ${l.label}`), ui.h("span", { class: "rec-value" }, `${fmt.money(l.used, cur)} of ${fmt.money(l.limit, cur)}`)),
      ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.min(100, Math.round(l.used / l.limit * 100))}%`, background: l.over ? "var(--bad)" : "var(--ok)" } })),
      ui.h("div", { class: "rec-sub" }, `${l.over ? `${fmt.money(l.over, cur)} over the limit` : `${fmt.money(l.limit - l.used, cur)} of room left${l.catchUp ? `, including the catch-up allowed from ${p.age >= 60 && p.age <= 63 && l.kind === "401k" ? "60 to 63" : d.limits.kinds[l.kind]?.catchUpAge ?? 50}` : ""}`}${l.year && l.year !== d.limitsYear ? ` · ${l.year} limit` : ""}`))))),
    ui.h("p", { class: "muted small" }, "An employer's 401(k) match does not count against these; an employer's HSA money does. IRS figures; check them each January."),
  ));

  const formHost = ui.h("div");
  let showForm = !d.hasData || !!prefill;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!accounts.length) return;
    if (!showForm && !editing) { formHost.append(ui.button("+ Add another contribution", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    // a new contribution starts on a retirement account, not a brokerage one
    const firstRetirement = accounts.find((a) => BUCKET_OF[a.type] !== "taxable" && !a.formerJob) ?? accounts[0];
    // a row whose figures are still our guess opens with them grey (placeholders), not typed (follow-up F4)
    const start = editing ? contributionFormStart(plan, editing) : null;
    const fields = !start ? FIELDS : FIELDS.map((f) => (f.key === "amount" && start.amountHint ? { ...f, required: false, placeholder: start.amountHint, help: `${f.help}. Our guess is grey: leave it empty to keep it.` } : f.key === "employerMatch" && start.matchHint ? { ...f, placeholder: start.matchHint, help: `${f.help}. Our guess is grey: leave it empty to keep it, or type 0 for none.` } : f));
    const values = editing ? { ...start.values, amount: start.amountHint ? "" : shareOf(editing) ? `${Number((editing.pctOfPay * 100).toFixed(2))}%` : editing.amount } : { period: "monthly", personId: people.find((p) => p.role === "self")?.id ?? "", accountId: firstRetirement?.id, ...(prefill ?? {}) };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit: ${editing.accountName}` : "Add a contribution"),
      !editing && prefill && prefillNote ? ui.h("p", { class: "muted small" }, prefillNote) : null,
      ui.form(fields, values, (v0) => {
        const v = start ? fillBlankFromGuess(v0, start) : v0;
        // "6%" is a share of this person's pay: saved as the dollars it comes to each time, with the share kept beside it
        const said = readAmountOrShare(v.amount);
        const fail = (text) => { formHost.querySelector(".notice.error")?.remove(); formHost.prepend(ui.notice("error", text)); return false; };
        if (said === null || said.bad) return fail("That isn't an amount. Type dollars, like 270, or a share of your pay, like 6%.");
        let amount = said.amount ?? 0, pctOfPay = null;
        if (said.pct !== undefined) {
          const pay = v.personId ? payOf(plan, v.personId, fmt.today()) : 0;
          if (said.pct > 1) return fail("A share of pay can't be more than 100%.");
          if (!v.personId) return fail("Pick whose pay the share is of (under Whose), then try again.");
          if (!(pay > 0)) return fail("We don't have this person's pay yet, so we can't turn a share of it into dollars. Type dollars, or add their pay on Income first.");
          amount = Math.round(said.pct * pay / perYear(1, v.period) * 100) / 100;
          pctOfPay = said.pct;
        }
        const clean = { accountId: v.accountId, personId: v.personId || "", amount, period: v.period, employerMatch: v.employerMatch ?? 0, ...(pctOfPay !== null ? { pctOfPay } : {}) };
        pending = editing ? "Contribution saved." : prefill ? { text: "Contribution added." } : "Contribution added.";
        if (pctOfPay !== null) { const t = `${pending?.text ?? pending} ${Number((pctOfPay * 100).toFixed(2))}% of your pay is ${fmt.money(amount, cur)} each time.`; pending = typeof pending === "object" ? { ...pending, text: t } : t; }
        store.update((p) => { p.retirement.contributions = p.retirement.contributions ?? []; if (editing) applyContributionEdit(p, editing.id, clean); else p.retirement.contributions.push({ id: ui.uid(), ...clean }); });
        editing = null; prefill = null; prefillNote = null;
      }, { submitLabel: editing ? "Save changes" : "Add contribution", resetAfter: !editing, onCancel: (editing || d.hasData || prefill) ? () => { editing = null; prefill = null; prefillNote = null; showForm = !d.hasData; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Remove this contribution", () => { const id = editing.id; editing = null; pending = "Contribution removed."; store.update((p) => { p.retirement.contributions = (p.retirement.contributions ?? []).filter((c) => c.id !== id); }); }, { class: "danger" })) : null,
    ));
  };
  drawForm();
  if (d.items.length) root.append(ui.card("Contributions",
    ui.h("ul", { class: "page-list" }, d.items.map((c) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => { editing = plan.retirement.contributions.find((x) => x.id === c.id); editing = { ...editing, accountName: c.accountName }; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" }); },
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "ic" }, "🏦"),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.accountName), ui.h("div", { class: "d" }, `${c.personName} · ${fmt.money(c.amount, cur)} ${c.periodLabel.toLowerCase()}${shareOf(plan.retirement.contributions.find((x) => x.id === c.id)) ? ` (${Number((plan.retirement.contributions.find((x) => x.id === c.id).pctOfPay * 100).toFixed(2))}% of pay)` : ""}${isGuess(plan, `retirement.contributions[${c.id}].amount`) ? " (our guess)" : ""}${c.matchYearly ? ` · employer adds ${fmt.money(c.matchYearly, cur)} a year${isGuess(plan, `retirement.contributions[${c.id}].employerMatch`) ? " (our guess)" : ""}` : ""}`)),
      ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(c.totalYearly, cur)), ui.h("div", { class: "muted small" }, "a year"))))),
  ));
  formCard.append(formHost);
  // no account yet: the form has nothing to show, so no empty card (round 8)
  if (accounts.length) root.append(formCard);
}
