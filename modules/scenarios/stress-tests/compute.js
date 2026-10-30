// modules/scenarios/stress-tests/compute.js -- PURE and heavy. The plan run through the shocks that
// break plans: real market crises (2008, the 2000s, the 1970s, 1929, 2022) dropped in now or in the
// year you retire, returns that stay lower, a job loss, never working again, the death of one of a
// couple, a long life, years in a care home. Every shock is the plan's own engine with one thing
// changed, so the answer is "this plan, if that happened", and the spending each version can still
// carry says by how much to cut, or how much room there is.
import { project, affordableSpending } from "../../../core/math/retirement.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { RETURNS } from "../../retirement/historical/data/returns.js";
import { compute as computeSocialSecurity } from "../../retirement/social-security/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { survival } from "../../retirement/longevity/compute.js";
import { ageOn } from "../../../core/math/dates.js";
import { money as fmtMoney } from "../../../core/format.js";

/** A private nursing-home room, national median: CareScout (Genworth) Cost of Care Survey 2024. */
export const CARE_HOME_YEARLY = 127750;
/** A funeral with viewing and burial, national median: National Funeral Directors Association, 2023. */
export const FUNERAL = 8300;
/** Share of gross pay that reaches the bank after payroll and income taxes (a planning assumption, not a law). */
export const TAKE_HOME = 0.75;
/** What a household of one spends compared with two (a planning rule of thumb). */
export const SURVIVOR_SPENDING = 0.75;
/** How long the job loss lasts: about the average spell of unemployment in a downturn (BLS). */
export const JOB_LOSS_MONTHS = 6;
/** Returns lower by this much a year, stocks and bonds alike, in the "lower for good" shock. */
export const LOWER_RETURNS = 0.02;

/** The market crises, replayed with the real yearly returns and inflation of those years (Damodaran's data). */
export const CRISES = [
  { id: "crash-2008", from: 2008, years: 5, icon: "📉", title: "A crash like 2008" },
  { id: "lost-decade", from: 2000, years: 10, icon: "🕳️", title: "A lost decade like the 2000s" },
  { id: "seventies", from: 1973, years: 10, icon: "🔥", title: "The 1970s: prices up, markets down" },
  { id: "depression", from: 1929, years: 10, icon: "🏚️", title: "1929 and the Depression" },
  { id: "both-down", from: 2022, years: 1, icon: "🧊", title: "Stocks and bonds fall together, like 2022" },
];

const cloneInputs = (I) => ({ ...I, people: I.people.map((p) => ({ ...p })), balances: { ...I.balances }, contributions: I.contributions.map((c) => ({ ...c })), incomes: I.incomes.map((x) => ({ ...x })), spending: { ...I.spending }, rates: { ...I.rates }, returns: { ...I.returns }, events: [...(I.events ?? [])], spendingChanges: [...(I.spendingChanges ?? [])] });
const yearOf = (iso) => Number(String(iso).slice(0, 4));

/** What a crisis did, in words, from its own years: the deepest stock fall, the years to get back, the inflation. */
export function crisisFacts(c) {
  const yrs = RETURNS.filter((r) => r.year >= c.from && r.year < c.from + c.years);
  let level = 1, peak = 1, low = 1, back = null;
  for (const [i, r] of yrs.entries()) { level *= 1 + r.stocks; if (level < low) low = level; if (back === null && low < 1 && level >= peak) back = i + 1; }
  const avgInflation = Math.pow(yrs.reduce((p, r) => p * (1 + r.inflation), 1), 1 / yrs.length) - 1;
  const realStocks = yrs.reduce((p, r) => p * (1 + r.stocks) / (1 + r.inflation), 1) - 1;
  const bondsWorst = Math.min(...yrs.map((r) => r.bonds));
  return { fall: 1 - low, back, avgInflation, realStocks, bondsWorst, first: yrs[0], span: c.years > 1 ? `${c.from} to ${c.from + c.years - 1}` : String(c.from) };
}
const pct = (x) => `${Math.round(Math.abs(x) * 100)}%`;
function crisisStory(c, f) {
  switch (c.id) {
    case "crash-2008": return `Stocks lose ${pct(f.first.stocks)} in the first year while bonds gain, then climb back; the real years ${f.span}, one after another.`;
    case "lost-decade": return `Two crashes back to back: stocks fall ${pct(f.fall)} at the worst and end the ten years ${f.realStocks < 0 ? `${pct(f.realStocks)} behind inflation` : "barely ahead of inflation"} (${f.span}).`;
    case "seventies": return `Prices rise about ${pct(f.avgInflation)} a year for ten years while stocks fall ${pct(f.fall)} and end ${f.realStocks < 0 ? `${pct(f.realStocks)} behind inflation` : "barely ahead of it"} (${f.span}). Spending and Social Security rise with prices; savings do not keep up.`;
    case "depression": return `Stocks fall ${pct(f.fall)} over three years, the worst in the record (${f.span}). Prices fall too, which softens it a little.`;
    case "both-down": return `One year in which stocks lose ${pct(f.first.stocks)} and bonds ${pct(f.first.bonds)} with prices up ${pct(f.first.inflation)}: nowhere to hide (${f.span}).`;
    default: return f.span;
  }
}

/**
 * compute(plan, { today, when = "retire" | "now" }) -> {
 *   ready, missing, when, hitYear, base: { success, failYear, failAge, endReal, path, affordable, spendingYearly },
 *   scenarios: [{ id, group: "market"|"life", icon, title, story, success, failYear, failAge, endReal, minReal, path,
 *                 affordable, roomMonthly (affordable - spending, a month, in the scenario's own spending; < 0 = the cut that makes it last),
 *                 worstGap: { year, share } | null (the deepest the savings sit below the plan's own path), go }],
 *   passed, total, years: [startYear..endYear], notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const b = buildInputs(plan, { today });
  if (!b.inputs) return { ready: false, missing: b.missing };
  const I = b.inputs;
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(Math.round(n / 10) * 10, cur);
  const startYear = I.startYear;
  const when = params.when === "now" || I.retireYear <= startYear ? "now" : "retire";
  const hitYear = when === "now" ? startYear : I.retireYear;
  const years = [];
  for (let y = startYear; y <= I.endYear; y++) years.push(y);
  const notes = [];

  let basePath = null;
  const run = (inputs, options = {}) => {
    const r = project(inputs, options);
    const affordable = affordableSpending(inputs, options);
    const path = r.rows.map((x) => x.totalReal);
    // the deepest the savings fall below the plan's own path, as a share of that path (only years both runs cover)
    let worstGap = null;
    if (basePath) for (let i = 0; i < Math.min(path.length, basePath.length); i++) { const share = basePath[i] > 0 ? 1 - path[i] / basePath[i] : 0; if (share > (worstGap?.share ?? 0.005)) worstGap = { year: r.rows[i].year, share }; }
    // spending room in the household's own spending after any change (a survivor spends less)
    const factor = (inputs.spendingChanges ?? []).reduce((f, s) => f * s.factor, 1);
    return { success: r.success, failYear: r.failYear, failAge: r.failAge, endReal: r.endBalanceReal, minReal: Math.min(...path), path, affordable, roomMonthly: (affordable - inputs.spending.yearly) * factor / 12, worstGap };
  };
  const base = { ...run(I), spendingYearly: I.spending.yearly };
  basePath = base.path;
  const scenarios = [];
  const add = (s, result) => scenarios.push({ ...s, ...result });

  // markets: real crises dropped in at the hit year, the plan's expected returns before and after
  for (const c of CRISES) {
    const seq = years.map((y) => { const k = y - hitYear; const r = k >= 0 && k < c.years ? RETURNS.find((x) => x.year === c.from + k) : null; return r ? { stocks: r.stocks, bonds: r.bonds, cash: r.bills, inflation: r.inflation } : null; });
    const r = run(I, { sequence: seq });
    const ahead = r.success && r.endReal > base.endReal * 1.01 ? " The recovery that followed beat your plan's own assumptions, so the plan ends ahead of where it would have: what hurts is the dip, not the end." : "";
    add({ id: c.id, group: "market", icon: c.icon, title: c.title, story: crisisStory(c, crisisFacts(c)) + ahead, go: ["retirement", "sequence-risk"] }, r);
  }
  const low = cloneInputs(I); low.returns.stocks -= LOWER_RETURNS; low.returns.bonds -= LOWER_RETURNS;
  add({ id: "lower-returns", group: "market", icon: "🐢", title: `Returns ${Math.round(LOWER_RETURNS * 100)} points lower, for good`, story: `Stocks earn ${pctOne(low.returns.stocks)} and bonds ${pctOne(low.returns.bonds)} a year instead of ${pctOne(I.returns.stocks)} and ${pctOne(I.returns.bonds)}, every year of the plan. Many forecasters expect lower returns than the last century's.`, go: ["system", "assumptions"] }, run(low));

  // life: who earns the most, their age, their Social Security
  const adults = I.people.map((p, i) => ({ ...p, index: i, person: (plan.household?.people ?? []).find((q) => q.id === p.id) }));
  const inc = computeIncome(plan, { today });
  const payOf = (id) => inc.active.filter((x) => x.personId === id && ["salary", "bonus", "business"].includes(x.type)).reduce((s, x) => s + x.yearly, 0);
  const earners = adults.map((a) => ({ ...a, pay: payOf(a.id), age: a.person?.birthDate ? ageOn(a.person.birthDate, today) : startYear - a.birthYear })).filter((a) => a.pay > 0 && a.age < a.retireAge).sort((x, y) => y.pay - x.pay);
  const ss = computeSocialSecurity(plan, { today });
  if (earners.length) {
    const e = earners[0];
    const out = e.pay * TAKE_HOME * JOB_LOSS_MONTHS / 12;
    const j = cloneInputs(I);
    j.events.push({ year: startYear, amount: out, label: "job loss" });
    for (const c of j.contributions) if (c.personIndex === e.index) c.skipYears = [...(c.skipYears ?? []), startYear];
    add({ id: "job-loss", group: "life", icon: "📦", title: `${e.name} is out of work for ${JOB_LOSS_MONTHS} months`, story: `About ${money(out)} of take-home pay is missing (${Math.round(TAKE_HOME * 100)}% of ${money(e.pay * JOB_LOSS_MONTHS / 12)} gross). It comes out of savings, cash first, and ${e.name}'s retirement saving stops for the year. The emergency fund is what this is for.`, go: ["balance", "liquidity"] }, run(j));

    // never working again: the plan is rebuilt with that person retiring now; Social Security disability pays the full-retirement-age amount from next year
    const p2 = JSON.parse(JSON.stringify(plan));
    const who = p2.household.people.find((q) => q.id === e.id);
    who.retirementAge = e.age + 1;
    const bd = buildInputs(p2, { today });
    if (bd.inputs) {
      const sp = ss.people.find((q) => q.id === e.id);
      const k = bd.inputs.people.findIndex((q) => q.id === e.id);
      const line = bd.inputs.incomes.find((x) => x.kind === "social" && x.personIndex === k);
      let ssdi = 0;
      if (sp && sp.pia > 0 && line) { ssdi = sp.pia; line.startAge = e.age + 1; line.yearly = sp.pia * 12; }
      const dis = (plan.insurance?.policies ?? []).filter((x) => x.kind === "disability" && x.personId === e.id && Number(x.benefit) > 0);
      for (const d of dis) bd.inputs.incomes.push({ name: "Disability insurance", yearly: Number(d.benefit) * 12, personIndex: k, startAge: e.age + 1, endAge: 64, cola: false, taxable: true });
      const extra = [ssdi > 0 ? `Social Security disability pays about ${money(ssdi)} a month (the full-retirement-age amount)` : "with no Social Security figure in the plan, no disability benefit is counted", dis.length ? `the disability policy ${money(dis.reduce((s, d) => s + Number(d.benefit), 0))} a month to 65` : "there is no disability insurance in the plan"].join("; ");
      add({ id: "disability", group: "life", icon: "🦽", title: `${e.name} can never work again`, story: `From next year: ${e.name}'s pay and retirement saving stop, ${extra}. ${e.index === 0 ? "The household's spending years start now." : "The rest of the household keeps working as planned."}`, go: ["retirement", "social-security"] }, run(bd.inputs));
    }
  } else notes.push("No one has pay on the Income page before their retirement age, so the job-loss and disability shocks are left out.");

  // the death of one of a couple: the plan rebuilt for the survivor alone, from this year
  if (adults.length >= 2) {
    for (const d of adults.slice(0, 2)) {
      const survivor = adults.find((a) => a.id !== d.id);
      const p2 = JSON.parse(JSON.stringify(plan));
      p2.household.people = p2.household.people.filter((q) => q.id !== d.id).map((q) => (q.id === survivor.id ? { ...q, role: "self" } : q));
      const kids = p2.household.people.some((q) => q.role === "dependent");
      p2.household.filingStatus = kids ? "head_of_household" : "single";
      p2.income = (p2.income ?? []).filter((x) => x.personId !== d.id);
      if (p2.retirement) { p2.retirement.contributions = (p2.retirement.contributions ?? []).filter((c) => c.personId !== d.id); delete (p2.retirement.socialSecurity ?? {})[d.id]; }
      const bd = buildInputs(p2, { today });
      if (!bd.inputs) continue;
      const S = bd.inputs;
      S.spendingChanges = [...(S.spendingChanges ?? []), { fromYear: startYear, factor: SURVIVOR_SPENDING }];
      const keep = ss.couple?.survivorMonthly?.[survivor.id] ?? 0;
      const sline = S.incomes.find((x) => x.kind === "social");
      const sp = ss.people.find((q) => q.id === survivor.id);
      if (keep > 0) {
        if (sline) sline.yearly = Math.max(sline.yearly, keep * 12);
        else S.incomes.push({ name: `${survivor.name}'s survivor benefit`, yearly: keep * 12, personIndex: 0, startAge: Math.max(60, Math.floor(sp?.claimAge ?? 67)), cola: true, taxable: true, kind: "social" });
      }
      const life = (plan.insurance?.policies ?? []).filter((x) => ["term", "whole"].includes(x.kind) && x.personId === d.id).reduce((s, x) => s + (Number(x.benefit) || 0), 0);
      S.events = [...(S.events ?? []), { year: startYear, amount: FUNERAL - life, label: "funeral and life insurance" }];
      add({ id: `death-${d.id}`, group: "life", icon: "🕯️", title: `If ${d.name} died this year`, story: `${survivor.name} goes on alone: ${d.name}'s pay and saving stop, spending drops to about ${Math.round(SURVIVOR_SPENDING * 100)}% of the couple's, ${keep > 0 ? `Social Security becomes the larger of ${survivor.name}'s own and the survivor amount, about ${money(keep)} a month` : "no Social Security figures are in the plan"}, a funeral costs about ${money(FUNERAL)}${life > 0 ? `, and life insurance pays ${money(life)}` : ", and no life insurance is in the plan"}. Tax is filed as ${kids ? "head of household" : "single"}. Before retirement the plan assumes ${survivor.name}'s pay covers the household; if it would not, that gap comes on top.`, go: ["retirement", "social-security"] }, run(S));
    }
  }

  // a long life: everyone to 100 (105 if the plan already runs that far)
  {
    const p2 = JSON.parse(JSON.stringify(plan));
    let to = 100;
    for (const q of p2.household.people) if (q.role !== "dependent") { const cur = Number(q.lifeExpectancy ?? p2.assumptions?.planEndAge ?? 95); if (cur >= 100) to = 105; }
    for (const q of p2.household.people) if (q.role !== "dependent") q.lifeExpectancy = to;
    const bl = buildInputs(p2, { today });
    // the chance of it, from the How long to plan for curve: at least one of you alive at that age
    const lg = plan.retirement?.longevity ?? {};
    const alive = adults.map((a) => { const age = a.person?.birthDate ? ageOn(a.person.birthDate, today) : startYear - a.birthYear; const o = lg[a.id] ?? {}; return survival(age, to, { sex: o.sex ?? "", health: o.health ?? "average" }); });
    const chance = 1 - alive.reduce((p, s) => p * (1 - s), 1);
    const odds = chance >= 0.095 ? `about 1 in ${Math.round(1 / chance)}` : chance >= 0.01 ? `about ${Math.round(chance * 100)} in 100` : "under 1 in 100";
    if (bl.inputs) add({ id: "long-life", group: "life", icon: "🎂", title: `Living to ${to}`, story: `The plan has to run until ${adults.length > 1 ? "the last of you" : "you"} turn${adults.length > 1 ? "s" : ""} ${to}, ${bl.inputs.endYear - I.endYear} more year${bl.inputs.endYear - I.endYear === 1 ? "" : "s"} than now. The chance that ${adults.length > 1 ? "at least one of you" : "you"} get${adults.length > 1 ? "s" : ""} there is ${odds} (How long to plan for).`, go: ["retirement", "longevity"] }, run(bl.inputs));
  }

  // three years in a care home, from the first person's 85th birthday (earlier if the plan ends sooner)
  {
    const p0 = I.people[0];
    const startAge = Math.max(p0.retireAge, Math.min(85, p0.endAge - 2));
    const fromYear = p0.birthYear + startAge;
    const c = cloneInputs(I);
    for (let k = 0; k < 3; k++) if (fromYear + k <= I.endYear) c.events.push({ year: fromYear + k, amount: CARE_HOME_YEARLY, label: "care home" });
    add({ id: "care-home", group: "life", icon: "🏥", title: "Three years in a care home", story: `From ${p0.name}'s ${startAge}th birthday, three years of a private nursing-home room at the national median, about ${money(CARE_HOME_YEARLY)} a year in today's dollars (2024 survey), on top of normal spending.`, go: ["retirement", "projection"] }, run(c));
  }

  const passed = scenarios.filter((s) => s.success).length;
  return { ready: true, missing: [], when, hitYear, base, scenarios, passed, total: scenarios.length, years, notes, retireYear: I.retireYear, startYear };
}

function pctOne(x) { return `${(Math.round(x * 1000) / 10).toFixed(1)}%`; }
