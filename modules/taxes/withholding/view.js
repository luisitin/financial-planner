// modules/taxes/withholding/view.js -- DOM only. Simple first (docs/OPTIONAL.md; opt C12, gap #30): the refund or bill at
// filing time, one sentence with the W-4 (or W-4P) change that fixes it, and the one thing to do; on request, a sheet of
// what to write on the form, line by line ("Print what to write"). The four figures, the paycheck boxes and how the W-4
// works are quiet rows one tap away.
import { compute, step3Words, addJanuaryWords, firstMove, w4Changes, w4Sheet, formFor } from "./compute.js";
import { ratePct } from "../federal/compute.js";
import { PERIOD_OPTIONS } from "../../../core/math/periods.js";
import { isYou, nameIn, NameIn, nameOf, NameOf, verbFor } from "../../../core/words.js";
import { parts, links } from "../../../core/ui/more.js";
import { reportFrame, printSheet } from "../../reports/report-kit.js";

// what the last save was, kept for the redraw the shell makes after it: { part, said, before (the headline then) }
let pending = null;
// the visit (its route object) on which "Print what to write" drew the sheet: the redraw after a save keeps it on the page,
// a new visit starts without it
let sheetFor = null;

/** The headline after a save, said as the new answer (docs/OPTIONAL.md R7): "You would now owe about $1,730 in April". */
export const nowHead = (head) => String(head)
  .replace(/ would (likely )?(owe|get) /g, (m, l, v) => ` would now ${l ?? ""}${v} `)
  .replace(/^Your withholding (is|looks) about right$/, (m, v) => `Your withholding ${v === "is" ? "is now" : "now looks"} about right`);

/**
 * sheetRows(f, { money, year }) -> [{ step, write, note }]: one form of w4Sheet in words, line by line, as the 2026 Form W-4 or
 * W-4P has its steps. `write` is what goes on the line ("Leave blank", "As on your W-4 now", a figure, a ticked box); `note`
 * says why in plain words. Never a line for Step 1(b): the plan holds no such number and the person writes it in.
 */
export function sheetRows(f, { money, year }) {
  const W = f.form, pen = W === "W-4P", pay = pen ? "payment" : "paycheck";
  const k = f.known, asNow = `As on your ${W} now`;
  const next = Number(year) + 1;
  const left = f.left === 1 ? `the one ${pay} left` : `the ${f.left} ${pay}s left`;
  const blankOr = (v) => (v >= 0.5 ? money(v) : "Leave blank");
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const p = f.step3.plan;
  const planWords = p.over ? `Your plan's income is over ${money(p.limit)}, where the form leaves Step 3 blank.`
    : p.amount >= 0.5 ? `Your plan: ${[p.kids ? `${plural(p.kids, "child", "children")} under 17 × ${money(p.perChild)}` : null, p.others ? `${plural(p.others, "other dependent", "other dependents")} × ${money(p.perOther)}` : null].filter(Boolean).join(" and ")} = ${money(p.amount)}.`
    : "Your plan has no children or other dependents.";
  const rows = [];
  rows.push({ step: "Step 1(a)", write: "Your name and address", note: "Fill these in yourself." });
  rows.push({ step: "Step 1(c)", write: `☒ ${f.status.box}`, note: k ? "" : "How your plan files." });
  // Step 2: a job's W-4 has the two-jobs box; a W-4P asks for the yearly amounts from jobs and smaller pensions
  if (!pen) {
    const s = f.step2;
    const why = s.jobs <= 1 ? "One job." : s.jobs === 2 ? null : "With three or more jobs the box does not fit: the IRS estimator (Step 2(a)) works it out.";
    if (k && s.tick) rows.push({ step: "Step 2", write: "☒ The box in 2(c)", note: "There are only two jobs between you: check it on the other job's W-4 too." });
    else if (k) rows.push({ step: "Step 2", write: "Leave blank", note: why ?? "Step 4(c) below is worked out with this box empty. With only two jobs between you, checking 2(c) on both W-4s is the other way to fix it: then Step 4(c) needs less, so check this page after the next pay stubs." });
    else rows.push({ step: "Step 2", write: asNow, note: why ?? "The box in 2(c) is for when there are only two jobs between you." });
  } else {
    const s = f.step2;
    rows.push({ step: "Step 2(b)", write: asNow, note: s.total >= 0.5 ? `Your plan: ${[s.job >= 0.5 ? `${money(s.job)} a year from jobs in (i)` : null, s.lower >= 0.5 ? `${money(s.lower)} a year from smaller pensions in (ii)` : null].filter(Boolean).join(", ")}, ${money(s.total)} in (iii).` : "Your plan has no job and no smaller pension, so it is blank." });
  }
  // Steps 3 to 4(b): on one form only (the highest-paying job, or the pension that pays the most when there is no job)
  if (pen && !f.carries) {
    const where = f.step2.job >= 0.5 ? "on the W-4 for the job" : "on the W-4P of the pension that pays the most";
    for (const step of ["Step 3", "Step 4(a)", "Step 4(b)"]) rows.push({ step, write: "Leave blank", note: step === "Step 3" ? `Steps 3 to 4(b) go ${where}.` : "" });
  } else {
    const s3 = f.step3, cut = f.change === "cut";
    const jan = s3.january === null || s3.january === undefined ? ""
      : s3.january >= 1 ? ` In January ${next}, make it ${k ? money(k.credits + s3.january) : `${money(s3.january)} more than before this change`}, or next year's ${pay}s would take out too little (a ${W} stays until you change it).`
      : ` In January ${next}, set it back${k ? ` to ${k.credits >= 0.5 ? money(k.credits) : "blank"}` : " to what it said before"}: a ${W} stays until you change it.`;
    const one = !pen && !f.carries ? " Steps 3 to 4(b) go on the higher-paying job's W-4 only." : "";
    if (cut) rows.push({ step: "Step 3", write: k ? blankOr(s3.write) : `${money(s3.add)} more than now`, note: `That is ${money(s3.add)} more than now: each ${pay} takes out less and the refund shrinks.${jan}` });
    else if (k) rows.push({ step: "Step 3", write: blankOr(s3.write), note: s3.alt ? `${planWords.replace(/\.$/, "")} could go here. That takes about ${money(s3.alt)} less from each ${pay}, so add ${money(s3.alt)} to Step 4(c) as well if you claim it.` : `${planWords}${one}` });
    else rows.push({ step: "Step 3", write: asNow, note: `${planWords}${one}` });
    rows.push({ step: "Step 4(a)", write: k ? blankOr(f.step4a) : asNow, note: "" });
    const dd = f.deductions ?? { itemized: 0, senior: 0 };
    const counted = [dd.itemized >= 1 ? `the ${money(dd.itemized)} your plan itemizes above the standard deduction` : null, dd.senior >= 1 ? `the ${money(dd.senior)} deduction at 65 or older` : null].filter(Boolean);
    rows.push({ step: "Step 4(b)", write: k ? blankOr(f.step4b) : asNow,
      note: `${k ? "Blank means the standard deduction. " : ""}${counted.length ? `This page's figure already counts ${counted.join(" and ")}, so leave ${counted.length > 1 ? "them" : "it"} out here. ` : ""}If you have tips, overtime pay or interest on a car loan, the worksheet on page 4 of the form turns them into an amount for this line; this page does not count them yet.` });
  }
  // Step 4(c): the page's own figure (the extra for the paychecks left), and the whole year's for January
  const c = f.step4c;
  if (f.change === "add") {
    const jan = c.january === null || c.january === undefined ? ""
      : c.january >= 1 ? ` In January ${next}, change it to ${k ? money(c.now + c.january) : `${money(c.january)} more than before this change`}: a ${W} stays until you change it.`
      : ` In January ${next}, take the extra off again${k && c.now >= 0.5 ? ` (back to ${money(c.now)})` : ""}: a ${W} stays until you change it.`;
    rows.push({ step: "Step 4(c)", write: k ? money(c.write) : `${money(c.more)} more than now`, note: `${k && c.now >= 0.5 ? `${money(c.more)} more than the ${money(c.now)} there now, for` : "For"} ${left} this year: that clears the bill.${jan}` });
  } else rows.push({ step: "Step 4(c)", write: k ? blankOr(c.write ?? 0) : asNow, note: f.change ? "No change here." : "" });
  if (pen) rows.push(f.noWithholding?.tick
    ? { step: "No withholding", write: "☒ Check it", note: "Your plan's tax is covered without any tax from this pension, this year and next (about: next year's tax is taken as this year's)." }
    : { step: "No withholding", write: "Leave it empty", note: "Checking it stops all federal tax from this pension; the tax would then be due in April, or in quarterly payments." });
  rows.push({ step: "Step 5", write: "Sign and date it", note: pen ? "Then send it to whoever pays the pension." : "Then give it to whoever runs payroll at work." });
  return rows;
}

/** The sheet of what to write, as nodes: one form per earner (per pension for a W-4P), in the report kit's sheet. */
export function sheetNode(ctx, sheet, { today } = {}) {
  const { ui, fmt } = ctx;
  const money = (n) => fmt.money(n, ctx.plan?.meta?.currency);
  const kinds = [...new Set(sheet.forms.map((f) => f.form))];
  const title = `What to write on your ${kinds.join(" and ")}`;
  const { wrap, sheet: el } = reportFrame(ui, { title });
  // the page keeps its one filled button: the frame's print button is outlined here (scoped to this sheet's own row)
  try { wrap.querySelector?.(".row > button")?.classList?.add("secondary"); } catch { /* a stand-in without classList */ }
  wrap.append(ui.h("style", {}, ".wh-form + .wh-form { break-before: page; } .wh-form .rp-rh > span:first-child { white-space: nowrap; } .wh-form .rp-rh > span:last-child { text-align: right; } .wh-nb { white-space: nowrap; }"));
  const nm = (n) => (n === "You" ? null : n);
  // a form's name never breaks at its hyphen ("W-" at the end of a line, "4" on the next)
  const nb = (t) => ui.h("span", { class: "wh-nb" }, t);
  el.append(ui.h("h1", {}, "What to write on your ", kinds.flatMap((k, i) => (i ? [" and ", nb(k)] : [nb(k)]))),
    ui.h("p", { class: "rp-sub" }, `For ${sheet.year}, from your plan on ${fmt.date(today ?? fmt.today())}. A new form replaces the old one, and the change starts with the next ${kinds.includes("W-4") ? "paycheck" : "payment"}.`));
  for (const f of sheet.forms) {
    const pen = f.form === "W-4P";
    const lead = !f.change ? `No change on this one. Each pension has its own ${f.form}: if you fill in a new one, this is what goes on it.`
      : f.known ? `Steps 1 to 4(b) are the W-4 this page works out ${nameOf(nm(f.name))} withholding with (the one on the Paycheck page); the change is in Step ${f.change === "cut" ? "3" : "4(c)"}.`
      : `${pen ? "This pension's" : `${NameOf(nm(f.name))} paycheck's`} tax was typed from ${pen ? "a statement" : "a pay stub"}, so copy Steps 1 to 4(b) from the ${f.form} you have now (${pen ? "the payer" : "payroll"} can give you a copy); the change is in Step ${f.change === "cut" ? "3" : "4(c)"}.`;
    el.append(ui.h("section", { class: "wh-form" },
      ui.h("h2", {}, "Form ", nb(f.form), ` for ${f.payer ?? `${nameOf(nm(f.name))} ${pen ? "pension" : "job"}`}`),
      ui.h("p", {}, lead),
      ui.h("ul", { class: "rp-recs" }, sheetRows(f, { money, year: sheet.year }).map((r) => ui.h("li", {},
        ui.h("div", { class: "rp-rh" }, ui.h("span", {}, r.step), ui.h("span", {}, r.write)),
        r.note ? ui.h("div", { class: "rp-rs" }, r.note) : null)))));
  }
  if (sheet.rest.length) el.append(ui.h("p", {}, sheet.rest.map((r) => `${NameOf(nm(r.name))} ${r.form}: no change needed.`).join(" ")));
  el.append(ui.h("p", { class: "rp-foot" }, `The steps are those of the 2026 ${kinds.map((k) => `Form ${k}`).join(" and ")} (IRS, read 2026-11-13); the amounts are this page's for ${sheet.year}. After the first new ${kinds.includes("W-4") ? "pay stub" : "payment"}, type its federal tax under What a paycheck withholds to check it.`));
  return { wrap, sheet: el, title };
}

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const today = fmt.today();
  const d = compute(plan, { today });
  const money = (n) => fmt.money(n, cur);
  const just = pending; pending = null;
  // whenever any earner's withholding comes from pay (no pay stub figure typed for them), the answer is the estimate: the
  // withholding payroll would work out (the Paycheck page) for them and the typed figures for the rest, the same figure
  // Estimated payments, the Federal estimate and Quick answers use; it never counts an earner as $0 withheld
  const est = d.estimate, guessed = est.from === "paycheck" || est.from === "mixed";
  const v = guessed ? est.verdict : d.verdict, bal = guessed ? est.balance : d.balance;
  const sg = guessed ? est.suggestion : d.suggestion;
  const paidElse = d.estimatedPaid + (est.otherPaid || 0);
  const estNames = est.people.filter((p) => p.estimated);
  // with business income the year's tax includes self-employment tax (yearTax), which the Federal estimate's total leaves out
  // (its own figure, seOwn, as the Federal estimate's walk says it; seTax is the business's whole effect, deductions off)
  const seBit = d.seOwn >= 1 ? `, ${money(d.seOwn)} of it self-employment tax on business income` : "";
  // credits worth more than the tax (the refundable child tax credit): no tax, and the rest comes back with the refund
  const back = d.creditsBack > 0.5;
  const taxWords = back ? `no federal tax, and about ${money(d.creditsBack)} of credits come back on top of what is withheld` : `about ${money(d.totalTax)} of federal tax${seBit}`;
  // the first adult Get started left unnamed ("Me", or the compute's "You" when no adult is on People) reads "you" and "your",
  // the partner it named "My spouse" reads "your spouse"; a typed name as before (Review 2026-11-06 round 7)
  const nm = (n) => (n === "You" ? null : n);
  const whose = (x) => nameOf(nm(x.name));
  const said = (n) => nameIn(nm(n)) !== String(n ?? "");   // Get started's own name, said as "you" or "your spouse"
  const andList = (names) => names.map((n, i) => (i ? nameIn(nm(n)) : NameIn(nm(n)))).join(" and ");
  // the W-4 change and the earner it is on (w4Changes: the page's own choice); a pension's is the W-4P, paid in payments (gap #30)
  const changes = w4Changes(d);
  const penFor = (ret) => { const c = changes.find((x) => x.ret === ret); return !!c && formFor(plan, c.who.personId, { today }) === "W-4P"; };
  // a cut gives the Step 3 figure for the paychecks left and, when it differs, the whole year's for January (step3Words:
  // a W-4 stays until it is changed; Review 2026-11-06)
  const w4 = (x, back = d.creditsBack, pen = false) => {
    const W = pen ? "W-4P" : "W-4", pay = pen ? "payment" : "paycheck";
    return x.kind === "add" ? ` Ask for ${money(x.perPaycheck)} more ${x.paychecks === 1 ? `on the one ${pay} left on ${whose(x)} ${W} (Step 4(c), "extra withholding"); that clears it.` : `per ${pay} on ${whose(x)} ${W} (Step 4(c), "extra withholding") for the ${x.paychecks} ${pay}s left this year; that clears it.`}${x.january === null || x.january === undefined ? "" : ` ${addJanuaryWords(x.january, d.year, money, pen)}`}`
      : x.kind === "cut" && (x.takeHome ?? x.perPaycheck) >= 1 ? ` That is about ${money(x.takeHome ?? x.perPaycheck)} a ${pay} lent to the IRS${x.all ? `, all of what each ${pay} takes out` : ""}${back > 0.5 ? ` (the ${money(back)} of credits comes back whatever the ${W} says)` : ""}. ${x.step3 ? step3Words(x, x.paychecks, { year: d.year, whose: x.name && !isYou(nm(x.name)) ? nameOf(x.name) : null, pension: pen }) : `A new ${W} with an amount in Step 3 or 4(b) brings ${pen ? "each payment" : "take-home"} up and the refund down.`}`
      : x.kind === "estimates" ? (x.noPay ? " No tax comes out of pay for this return: the Estimated payments page works out the payments." : " No paycheck is left this year to change: the Estimated payments page works out a payment instead.") : "";
  };
  // filing separately, each return settles on its own: one return's refund cannot pay the other's bill (byReturn; Review
  // 2026-11-06: "You would likely get about $540 back" while Bo's own return owed 1,660)
  const rets = est.from !== "none" && Array.isArray(est.returns) && est.returns.length > 1 ? est.returns : null;
  const likely = guessed ? "likely " : "";
  const owing = rets ? rets.filter((x) => x.verdict === "owe") : [], getting = rets ? rets.filter((x) => x.verdict === "refund") : [];
  const sum = (xs) => xs.reduce((t, x) => t + x.balance, 0);
  const retHead = !rets ? null
    : owing.length && getting.length ? `${NameIn(nm(owing[0].name))} would ${likely}owe about ${money(owing[0].balance)} in April; ${nameIn(nm(getting[0].name))} would ${likely}get about ${money(-getting[0].balance)} back`
    : owing.length ? `${owing.length > 1 ? "You" : NameIn(nm(owing[0].name))} would ${likely}owe about ${money(sum(owing))} in April`
    : getting.length ? `${getting.length > 1 ? "You" : NameIn(nm(getting[0].name))} would ${likely}get about ${money(-sum(getting))} back`
    : `Your withholding ${guessed ? "looks" : "is"} about right`;
  const head = !d.hasIncome ? "Is enough tax taken out of your pay?" : retHead ?? (v === "owe" ? `You would ${likely}owe about ${money(bal)} in April` : v === "refund" ? `You would ${likely}get about ${money(-bal)} back` : v === "about right" ? `Your withholding ${guessed ? "looks" : "is"} about right` : "Is enough tax coming out of your pay?");
  // each return's own line: its tax, its own withholding, what is left, the W-4 change on it, and its own penalty test
  const retLine = (x) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${NameOf(nm(x.name))} return`), ui.h("span", { class: "rec-value" }, x.verdict === "owe" ? `owes ${money(x.balance)}` : x.verdict === "refund" ? `${money(-x.balance)} back` : "about right")),
    ui.h("div", { class: "rec-sub" }, `${x.back > 0.5 ? `no federal tax, and ${money(x.back)} of credits come back` : `about ${money(x.owed)} of federal tax`}; ${x.people.length ? `${money(x.withheld)} withheld from ${whose(x)} pay` : `nothing withheld from ${whose(x)} pay`}${x.paid >= 0.5 ? `, ${money(x.paid)} paid otherwise` : ""}.${x.verdict === "about right" ? " Within a few hundred dollars: nothing to change." : w4(x.suggestion, x.back, penFor(x))}`),
    x.penaltyRisk ? ui.h("div", { class: "rec-sub" }, `${NameOf(nm(x.name))} pay takes out less than the safe amount for this return (${money(x.harbour.required)}, ${x.harbour.label === "90% of this year's" ? "90% of its tax" : x.harbour.label}), so an underpayment penalty is possible. More withheld before December counts as paid through the year.`) : null);
  // the one thing to do first, as the hero's filled button (stress test MR-7); "Type your pay stub figure" opens the paycheck
  // part below in place, scrolls it into view and puts the cursor in it. A change on a pension gets the W-4P (gap #30).
  const firstRet = rets ? (rets.find((x) => x.verdict === "owe") ?? rets.find((x) => x.verdict === "refund")) : null;
  const pen = rets ? (firstRet ? penFor(firstRet) : false) : penFor(null);
  const mv = firstMove({ hasIncome: d.hasIncome, guessed, verdict: v, suggestion: sg, returns: rets, noPay: est.from === "none", tax: d.totalTax, pension: pen });
  let partsEl = null;
  const toStub = () => {
    const fold = partsEl?.querySelector?.('[data-part="paycheck"]');
    if (!fold) return;
    fold.open = true; fold.scrollIntoView({ block: "start", behavior: "smooth" }); fold.querySelector("input")?.focus({ preventScroll: true });
  };
  const stubBtn = (cls) => ui.h("button", { type: "button", class: cls, onClick: toStub }, "Type your pay stub figure");
  // gap #30: what to write on the form, line by line, drawn under the answer and printed in place ("Print what to write")
  const sheetHost = ui.h("div");
  const drawSheet = (print) => {
    const sheet = w4Sheet(plan, d, { today });
    if (!sheet) return;
    const { wrap, sheet: el, title } = sheetNode(ctx, sheet, { today });
    sheetHost.replaceChildren?.(wrap);
    if (!print) return;
    ui.reveal?.(sheetHost, { block: "start" });
    if (typeof window !== "undefined" && typeof window.print === "function") printSheet(title, el);
  };
  const printBtn = changes.length ? ui.h("button", { type: "button", class: "btn secondary", onClick: () => { sheetFor = ctx.route ?? true; drawSheet(true); } }, "Print what to write") : null;
  const moveRow = !mv ? (printBtn ? ui.row(printBtn) : null)
    : mv.kind === "stub" ? ui.row(stubBtn("btn"), printBtn)
    : ui.row(ui.h("a", { class: "btn", href: mv.href, ...(mv.kind === "w4" ? { target: "_blank", rel: "noopener" } : {}) }, `${mv.label} ›`), mv.also === "stub" ? stubBtn("btn secondary") : null, printBtn);
  const moveNote = mv?.kind === "w4" ? ui.h("p", { class: "muted small" }, pen
    ? `The W-4P button opens the form on the IRS site: fill in the amount ${rets ? "for that return, under Each return below" : "above"}, send it to whoever pays the pension, and the change starts with the next payment.`
    : `The W-4 button opens the form on the IRS site: fill in the amount ${rets ? "for that return, under Each return below" : "above"}, hand it to whoever runs payroll at work, and the change starts with the next paycheck.`) : null;
  // the typed figures' own sentence (compute's), unless the change is on a pension: then the W-4P words, on that earner
  const typedChange = !rets && !guessed && pen ? w4({ ...d.suggestion, name: changes[0]?.who?.name }, d.creditsBack, true).trim() : d.suggestion.text;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, head),
    // nothing earned on file: say what to do first, with one button, instead of "$0 Tax for the year" (stress test T3, A8)
    !d.hasIncome ? ui.h("p", { class: "lede" }, "Add what you earn first, then this page checks whether your paychecks take out enough tax for the year.") : null,
    !d.hasIncome ? ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add your income")) : null,
    !d.hasIncome ? null : ui.h("p", { class: "lede" }, rets
      ? `${d.year}: filing separately, each of you pays the tax on your own return from your own withholding, and one return's refund cannot pay the other's bill.${owing.length && getting.length ? " Each return's change is below." : ""}`
      : guessed
      ? `${d.year}: ${taxWords}; the paychecks take out about ${money(est.projected)} over the year${paidElse > 0 ? `, and ${money(paidElse)} is paid otherwise` : ""}.${v === "about right" ? " Within a few hundred dollars either way: nothing to change." : w4(sg, d.creditsBack, pen)}`
      : d.verdict === "unknown"
      ? `The plan estimates ${back ? `no federal tax for ${d.year}: about ${money(d.creditsBack)} of credits come back` : `${money(d.totalTax)} of federal tax for ${d.year}${seBit}`}. Type what one paycheck withholds, and the page tells you whether a year of paychecks covers your tax or leaves you a bill or a refund.`
      : `${d.year}: ${taxWords}; ${money(d.withholding.projected)} withheld over the year${d.withholding.soFar > 0 ? ` (${money(d.withholding.soFar)} so far, ${money(d.withholding.rest)} from the paychecks left)` : ""}${d.estimatedPaid > 0 ? `, ${money(d.estimatedPaid)} paid in estimates` : ""}. ${d.verdict === "about right" ? "Within a few hundred dollars either way: nothing to change." : typedChange}`),
    guessed ? ui.h("p", { class: "muted small" }, `${est.from === "mixed" ? `${estNames.length === 1 ? NameOf(nm(estNames[0].name)) : `${andList(estNames.map((p) => p.name))}'s`} withholding is estimated` : "Estimated"} from pay the way payroll works it out (${estNames.map((p) => `${nameIn(nm(p.name))} about ${money(p.perPaycheck)} a paycheck`).join(", ")}). Type the "Federal income tax" figure from a pay stub below to make it exact.`) : null,
    d.penaltyRisk && !guessed && !rets ? ui.h("p", { class: "muted small" }, `Underpayment penalty risk: the safe amount is ${money(d.harbour.required)} (${d.harbour.label}) and the ${pen ? "payments" : "paychecks"} reach ${money(d.withholding.projected + d.estimatedPaid)}.`) : null,
    moveNote, d.hasIncome ? moveRow : null,
  ));
  // filing separately each return's change stays in sight: it is the amount to write (docs/OPTIONAL.md R9, the action)
  if (rets) root.append(ui.card("Each return", ui.h("ul", { class: "records" }, rets.map(retLine)),
    ui.h("p", { class: "muted small" }, `Your tax for the year in all: ${taxWords}.${rets.some((x) => x.paid >= 0.5) ? " Payments made for the year go to the return that owes first: you choose how to split them between your returns (IRS Publication 505)." : ""}${est.detail?.soFarTyped && est.detail.soFar > 0 && est.from !== "paycheck" ? " The withholding so far is one figure for the two of you, so each return's share of it goes by what each paycheck takes out: about." : ""}`)));
  root.append(sheetHost);
  if (changes.length && sheetFor !== null && sheetFor === (ctx.route ?? true)) drawSheet(false);
  for (const n of d.notes) if ((!guessed || !/^Type the federal tax/.test(n)) && (d.hasIncome || !/^No income on file/.test(n))) root.append(ui.notice("info", n));

  // ---- the optional parts: the four figures, the paycheck boxes (a guide step opens them by their title), how the W-4 works
  const tiles = d.hasIncome ? [
    back ? ui.stat("Credits back", money(d.creditsBack), "more than the year's tax: they come back with the refund")
      : ui.stat("Tax for the year", money(d.totalTax), d.seOwn >= 1 ? `with ${money(d.seOwn)} of self-employment tax` : `${ratePct(d.effectiveRate)} of income`),
    guessed ? ui.stat("Withheld by December", money(est.projected), est.from === "mixed" ? "partly estimated from pay" : "estimated from your pay")
      : ui.stat("Withheld by December", money(d.withholding.projected), d.withholding.people.length ? d.withholding.people.map((p) => `${p.name}: ${money(p.perPaycheck)} × ${p.left} left`).join(" · ") : "type a paycheck below"),
    ...(rets ? rets.map((x) => ui.stat(x.verdict === "owe" ? `${x.name}: still to pay` : x.verdict === "refund" ? `${x.name}: refund` : `${x.name}: about right`, money(Math.abs(x.balance)), "on their own return, at filing time"))
      : [d.verdict === "unknown" && !guessed ? null : ui.stat(bal >= 0 ? "Still to pay" : "Refund", money(Math.abs(bal)), guessed ? "at filing time, estimated" : "at filing time")]),
    rets ? null : sg.kind === "add" ? ui.stat(pen ? "Add per payment" : "Add per paycheck", money(sg.perPaycheck), `for ${sg.paychecks} ${pen ? "payments" : "paychecks"}${sg.name ? ` on ${whose(sg)} ${pen ? "W-4P" : "W-4"}` : ""}: Step 4(c)`) : sg.kind === "cut" && (sg.takeHome ?? sg.perPaycheck) >= 1 ? ui.stat("Could take home", money(sg.takeHome ?? sg.perPaycheck), `more per ${pen ? "payment" : "paycheck"}`) : null,
  ].filter(Boolean) : [];
  const w = plan.taxes?.withholding ?? {};
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const selfName = (adults.find((p) => p.role === "self") ?? adults[0])?.name ?? "You";
  const partner = adults.find((p) => p.role !== "self");
  // "Your federal tax taken per paycheck", "How often you are paid"; a typed name keeps "Ana: paid how often"
  const perLabel = (n) => (said(n) ? `${NameOf(nm(n))} federal tax taken per paycheck` : `${n}: federal tax taken per paycheck`);
  const periodLabel = (n) => (said(n) ? `How often ${nameIn(nm(n))} ${verbFor(nm(n), "is", "are")} paid` : `${n}: paid how often`);
  const FIELDS = [
    { key: "selfPer", label: perLabel(selfName), type: "money", min: 0, help: 'the "Federal income tax" line on the stub, not Social Security or Medicare' },
    { key: "selfPeriod", label: periodLabel(selfName), type: "select", options: PERIOD_OPTIONS.filter((o) => ["weekly", "biweekly", "semimonthly", "monthly"].includes(o.value)) },
    ...(partner ? [
      { key: "partnerPer", label: perLabel(partner.name), type: "money", min: 0 },
      { key: "partnerPeriod", label: periodLabel(partner.name), type: "select", options: PERIOD_OPTIONS.filter((o) => ["weekly", "biweekly", "semimonthly", "monthly"].includes(o.value)) },
    ] : []),
  ];
  // how often each is paid starts on the pay period of their salary on Income (it was always "every two weeks")
  const PAYS = ["weekly", "biweekly", "semimonthly", "monthly"];
  const payOf = (person) => (plan.income ?? []).find((x) => x.personId === person?.id && x.type === "salary" && PAYS.includes(x.period))?.period ?? "biweekly";
  const values = { selfPer: w.self?.perPaycheck || null, selfPeriod: w.self?.period ?? payOf(adults.find((p) => p.role === "self") ?? adults[0]), partnerPer: w.partner?.perPaycheck || null, partnerPeriod: w.partner?.period ?? payOf(partner) };
  const form = ui.form(FIELDS, values, (vv) => {
    pending = { part: "paycheck", said: "Paycheck figures saved.", before: head };
    store.update((p) => { p.taxes.withholding = { ...(p.taxes.withholding ?? {}), self: { perPaycheck: vv.selfPer ?? 0, period: vv.selfPeriod }, partner: partner ? { perPaycheck: vv.partnerPer ?? 0, period: vv.partnerPeriod } : undefined }; });
  }, { submitLabel: "Save" });
  const typedN = d.withholding.people.length;
  root.append(partsEl = parts(ctx,
    tiles.length >= 2 && { id: "numbers", kind: "more", n: tiles.length, noun: "numbers", one: "number", body: () => ui.row(tiles) },
    { id: "paycheck", kind: "own", title: "What a paycheck withholds", set: typedN, missing: !d.withholding.hasSetup, holds: FIELDS.map((f) => f.key), open: just?.part === "paycheck",
      body: [ui.h("p", { class: "muted small" }, "From the latest paystub. Type the amount withheld so far this year on the Federal estimate page (\"Federal tax withheld so far\"); without it, the page assumes the whole year was withheld at this rate."), form] },
    { id: "how", kind: "how", says: "3 points", body: () => ui.h("ul", { class: "records" }, [
      ["No more allowances", "Since 2020 the form asks for dollar amounts, not allowances. Step 3 credits and Step 4(b) deductions lower withholding; Step 4(c) adds a fixed extra amount per paycheck. A pension's form, the W-4P, works the same way and can also stop withholding altogether."],
      ["Two earners", "Each job withholds as if it were the only income, which under-withholds a couple. Checking the Step 2(c) box on both W-4s, or putting the extra on the higher earner's 4(c), fixes it."],
      ["A refund is not a win", "It is money you overpaid through the year. Aiming for a small bill or a small refund keeps the cash in your own account; the safe-harbor rule means no penalty as long as the paychecks cover 90% of this year's tax or all of last year's."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))) }));
  // the green line names the new answer when the save changed it (R7); at the foot, as Estimated payments does (stress test T4)
  if (just) {
    const n = ui.notice("ok", head !== just.before ? `${just.said} ${nowHead(head)}.` : just.said);
    root.append(n);
    setTimeout(() => n.remove(), 4000);
  }
  // the deeper pages, as the questions they answer: the Paycheck page only when someone is paid a salary
  if (d.hasIncome) root.append(links(ctx, [
    (plan.income ?? []).some((x) => x.type === "salary") && { href: "#/cashflow/paycheck", ask: "What does one paycheck take out?" },
    { href: "#/taxes/estimated", ask: "What if no tax comes out of my pay?" },
  ]));
}
