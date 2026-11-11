// modules/ai/reader/compute.js -- PURE. Reads the text of a pay stub, an account statement, a Social
// Security statement or an advisor's plan, finds the figures that matter (by their labels, no model
// needed), and turns them into proposed changes to the plan, each with what it is now and what it would
// become. Nothing changes until the user accepts one (the view applies it with applyProposal). A
// language model can fill the figures the labels missed (buildPrompt / parseAnswer); it never writes
// to the plan itself. Account numbers are never kept.
// A pay stub's 401(k) lines are read apart (2026-11-11, owner's request): the part you pay the tax on later
// (pre-tax), the Roth part you pay the tax on now, and the employer's match when the stub prints it. Each
// becomes a proposal on the person's own 401(k) rows, and a row (and its account) that does not exist yet is
// proposed too, so a stub can fill a 401(k) nobody typed.
import { perYear } from "../../../core/math/periods.js";
import { limitKind, limitsFor, catchUpFor } from "../../retirement/contributions/compute.js";
import { isGuess, clearGuess } from "../../../core/estimate/ledger.js";

export const KINDS = {
  paystub: { label: "A pay stub", hint: "gross pay, net pay, tax withheld, 401(k) and Roth 401(k), the employer's match" },
  statement: { label: "An account statement", hint: "the ending balance and the date" },
  ssa: { label: "A Social Security statement", hint: "the benefit at full retirement age" },
  advisor: { label: "An advisor's plan", hint: "assumed returns, inflation, fees, chance of success" },
};

// ---- the words of a pay stub's retirement lines (round-1 review, 2026-11-12) -----------------------------------------------
// A plan at work, under the names stubs use: 401(k), 401K, 403(b), 457(b), TSP, thrift, deferred comp, retirement plan,
// retirement savings. The same plans retirement/contributions' limitKind counts as a 401(k) (IRC 402(g)(3): 401(k), 403(b),
// SIMPLE and SARSEP deferrals share one limit; a governmental 457(b) has its own, 457(e)(15), and is read here as money
// going in all the same). A bare 457 inside an amount ("1,457.00") is not one.
export const PLAN_WORDS = /40[13]\s*\(?\s*[kb]\s*\)?|(?<![\d.,$])457(?![\d.,])\s*\(?\s*b?\s*\)?|\btsp\b|\bthrift\b|deferred\s*comp|retirement\s*(?:plan|savings)/i;
const ROTH = /\broth/i;
// the employer's money, not the person's: a match, an employer, ER, company or agency line
const EMPLOYER = /match|employer|\ber\b|company|agency/i;
// a line that names the plan and is not money going in: a loan being paid back, after-tax money that is not Roth, the pay
// the plan is worked out on ("401(k) Eligible Wages"), hours, a rate, a balance or a limit
const NOT_MONEY_IN = /loan|after[\s-]*tax|wages|earnings|eligible|taxable|\bhours\b|\brate\b|\bbalance\b|\bvested\b|\blimit\b/i;
// another benefit's employer line is not the 401(k) match: "HSA ER Match", "Charity Matching Gift"
const OTHER_BENEFIT = /\bhsa\b|\bfsa\b|health|dental|vision|medical|\blife\b|stock|espp|charit|gift|insur|disab/i;
/** the person's own pay-the-tax-later line: it names the plan and is not Roth, the employer's, or one of the lines above */
const isLaterLine = (l) => PLAN_WORDS.test(l) && !ROTH.test(l) && !EMPLOYER.test(l) && !NOT_MONEY_IN.test(l);
// a line that starts with Roth and goes on only in a deduction's words before its figure ("Roth 55.38", "ROTH CATCH UP 207.69",
// "Roth EE Deferral 2%"); a business named Roth ("ROTH & SONS FREIGHT  Check 10443.00") goes on in other words (fix round 2)
const ROTH_ONLY = /^\s*roth\b(?:[\s:*-]+(?:catch[\s-]*up|contrib\w*|deferr?al|def|ee|employee|elective|ded\w*|deduct\w*|amt|amount|k|pct|percent))*[\s:*-]*(?=[$(\-.\d]|$)/i;
/** the person's own Roth line: Roth with the plan's name, or a line that is Roth and a deduction's words ("ROTH CATCH UP"); never an IRA, the employer's, a loan */
const isRothLine = (l) => ROTH.test(l) && !EMPLOYER.test(l) && !/\bira\b/i.test(l) && !NOT_MONEY_IN.test(l) && (PLAN_WORDS.test(l) || ROTH_ONLY.test(l));
/** the employer's money into the plan: 2 when the line names the plan and the employer ("401(k) ER Match"), 1 for a bare "Employer Match" / "Company match", 0 otherwise */
const matchTier = (l) => (/loan/i.test(l) || OTHER_BENEFIT.test(l) ? 0 : PLAN_WORDS.test(l) && EMPLOYER.test(l) ? 2 : /match/i.test(l) && /\b(er|employer|company|agency|co)\b/i.test(l) ? 1 : 0);
/** true when the stub has a pay-the-tax-later plan line at all (read or not): then a Roth-only reading never asks about the money on file */
export const hasPreTaxLine = (text) => stubLines(text).some(isLaterLine);

/** The fields each kind looks for: label patterns (first match wins), lines a field must skip, the unit, and how to read the value. */
export const FIELDS = {
  paystub: [
    { key: "gross", label: "Gross pay this period", unit: "money", labels: [/gross\s*(pay|earnings|wages)/i, /total\s*gross/i, /^\s*gross\b/i] },
    { key: "net", label: "Net (take-home) pay", unit: "money", labels: [/net\s*(pay|amount|check)/i, /take[\s-]*home/i] },
    // what comes off the pay is read as its size: a stub may print it with a minus or in brackets (`off`)
    { key: "federal", label: "Federal income tax withheld", unit: "money", off: true, labels: [/fed(eral)?\.?\s*(income\s*)?(tax|withholding|w\/h)/i, /\bfit\b/i], skip: /taxable|wages|gross/i },
    // the person's own 401(k) money in three lines a stub keeps apart (2026-11-11): pay the tax later, Roth (pay the tax
    // now), the match. These three are read by readPlanLines (every matching line, added up), not by a first label.
    { key: "k401", label: "401(k), pay the tax later", unit: "money", plan: "later" },
    { key: "roth401k", label: "Roth 401(k), pay the tax now", unit: "money", plan: "now" },
    { key: "match", label: "Employer match", unit: "money", plan: "match" },
    { key: "payDate", label: "Pay date", unit: "date", labels: [/(pay|check|advice)\s*date/i] },
    { key: "periodStart", label: "Period start", unit: "date", labels: [/period\s*(begin|beginning|start)/i, /pay\s*period/i] },
    { key: "periodEnd", label: "Period end", unit: "date", last: true, labels: [/period\s*(end|ending)/i, /pay\s*period/i] },
  ],
  statement: [
    { key: "balance", label: "Ending balance", unit: "money", labels: [/(ending|closing|new|current)\s*balance/i, /total\s*(account\s*)?value/i, /ending\s*value/i, /balance\s*(as\s*of|on)/i] },
    { key: "date", label: "Statement date", unit: "date", last: true, labels: [/statement\s*(date|closing\s*date|period)/i, /(period|cycle)\s*end(ing)?/i, /closing\s*date/i, /as\s*of/i, /through/i] },
  ],
  ssa: [
    { key: "monthlyAtFRA", label: "Monthly benefit at full retirement age", unit: "money", labels: [/full\s*retirement\s*age/i, /at\s*(age\s*)?67\b/i] },
    { key: "at70", label: "Monthly benefit at 70", unit: "money", labels: [/at\s*(age\s*)?70\b/i] },
    { key: "at62", label: "Monthly benefit at 62", unit: "money", labels: [/at\s*(age\s*)?62\b/i] },
  ],
  advisor: [
    { key: "returnStocks", label: "Stock return assumed", unit: "percent", labels: [/(equit(y|ies)|stocks?)[^%\n]{0,40}return/i, /return[^%\n]{0,30}(equit|stock)/i] },
    { key: "returnBonds", label: "Bond return assumed", unit: "percent", labels: [/(bonds?|fixed\s*income)[^%\n]{0,40}return/i, /return[^%\n]{0,30}(bond|fixed)/i] },
    { key: "inflation", label: "Inflation assumed", unit: "percent", labels: [/inflation/i] },
    { key: "fee", label: "Advisory fee a year", unit: "percent", labels: [/(advisory|management|advisor|wrap)\s*fee/i] },
    { key: "quotedChance", label: "Chance of success quoted", unit: "percent", labels: [/(probability|chance|likelihood)\s*of\s*success/i, /confidence\s*(level|score)/i, /success\s*rate/i] },
    { key: "retireAge", label: "Retirement age", unit: "age", labels: [/retire(ment)?\s*(at\s*)?age/i, /retir\w*\s*at\s*(\d\d)/i] },
    { key: "spendingMonthly", label: "Spending in retirement, a month", unit: "money", labels: [/(retirement\s*)?(spending|living\s*expenses|income\s*(need|goal))/i] },
  ],
};

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

/**
 * Every money amount in a piece of text, in order: $1,234.56, 1,234.56, (123.45) and -12.00 as negative; a bare number only
 * with cents or a $ (so years, ages and the 401 of "401(k)" are skipped); a number followed by % is a rate, never money
 * ("401(k) 6.00% 243.00" reads 243.00).
 */
export function moneyIn(s) {
  const t = String(s), out = [];
  const re = /(\(?)(-?)(\$\s?)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2}|\d+)(\)?)/g;
  for (const m of t.matchAll(re)) {
    const digits = m[4];
    if (!m[3] && !/[,.]/.test(digits)) continue;   // a bare whole number (a year, an age) is not money
    if (/^\s*%/.test(t.slice(m.index + m[0].length))) continue;   // a share of pay, not money
    const v = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(v)) continue;
    out.push((m[1] === "(" && m[5] === ")") || m[2] === "-" ? -v : v);
  }
  return out;
}
/** The first money amount in a piece of text (moneyIn), or null. */
export function firstMoney(s) { const all = moneyIn(s); return all.length ? all[0] : null; }
/** The first percentage: 6.5% -> 0.065. */
export function firstPercent(s) { const m = String(s).match(/(-?\d+(?:\.\d+)?)\s*%/); return m ? Number(m[1]) / 100 : null; }
/** A real day only: 2026-02-31 is no date (WORKBOARD 2026-10-31, for whoever owns this page). */
const day = (y, mo, d) => {
  const Y = Number(y), M = Number(mo), D = Number(d);
  return M >= 1 && M <= 12 && D >= 1 && D <= new Date(Date.UTC(Y, M, 0)).getUTCDate() ? `${Y}-${pad(M)}-${pad(D)}` : null;
};
/** The first date as YYYY-MM-DD: 03/15/2026, 2026-03-15, March 15, 2026, 15 Mar 2026. A day that does not exist is skipped. */
export function firstDate(s) {
  const t = String(s);
  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/); if (m && day(m[1], m[2], m[3])) return day(m[1], m[2], m[3]);
  m = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/); if (m) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); if (day(y, m[1], m[2])) return day(y, m[1], m[2]); }
  const month = (w) => MONTHS[w.slice(0, 4).toLowerCase()] ?? MONTHS[w.slice(0, 3).toLowerCase()] ?? null;
  m = t.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/); if (m && month(m[1]) && day(m[3], month(m[1]), m[2])) return day(m[3], month(m[1]), m[2]);
  m = t.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/); if (m && month(m[2]) && day(m[3], month(m[2]), m[1])) return day(m[3], month(m[2]), m[1]);
  return null;
}
/** The last date in a piece of text (the end of "09/01/2026 to 09/30/2026"). */
export function lastDate(s) {
  const parts = String(s).split(/\s+(?:to|through|thru|-|–)\s+/i);
  for (let i = parts.length - 1; i >= 0; i--) { const d = firstDate(parts[i]); if (d) return d; }
  return null;
}
const firstAge = (s) => { const m = String(s).match(/\b([4-8]\d)\b/); return m ? Number(m[1]) : null; };

/** Guess what kind of paper it is from its words. */
export function detectKind(text) {
  const t = String(text).toLowerCase();
  const score = {
    paystub: (/net pay/.test(t) ? 2 : 0) + (/gross/.test(t) ? 1 : 0) + (/ytd|year to date/.test(t) ? 1 : 0) + (/pay (date|period)/.test(t) ? 1 : 0),
    ssa: (/social security/.test(t) ? 2 : 0) + (/full retirement age/.test(t) ? 2 : 0) + (/earnings record/.test(t) ? 1 : 0),
    advisor: (/(probability|chance) of success|monte carlo/.test(t) ? 2 : 0) + (/assum/.test(t) ? 1 : 0) + (/inflation/.test(t) ? 1 : 0) + (/advis/.test(t) ? 1 : 0),
    statement: (/(ending|closing|new) balance/.test(t) ? 2 : 0) + (/statement (period|date)/.test(t) ? 1 : 0) + (/account (summary|number)/.test(t) ? 1 : 0),
  };
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : null;
}

/**
 * A pay stub's text as lines. A stub pasted as one line (a copy from a PDF can lose its line breaks: fewer than 3 breaks in
 * more than 80 characters) is cut where a figure is followed by a new label (a word that starts with a capital, or the
 * plan's name), so "... 262.50 5,512.50 401(k) Pre-Tax 6% 195.00 4,095.00 Dental ..." is read line by line again.
 */
export function stubLines(text) {
  let t = String(text ?? "");
  if (t.length > 80 && (t.match(/\n/g) ?? []).length < 3) t = t.replace(/(?<=\d|\d\)|%|\*)\s+(?=[A-Z]|40[13]\s*\(?\s*[kKbB]|457\s*\(?b)/g, "\n");
  return t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/**
 * readPlanLines(lines, gross) -> { k401, roth401k, match (each a sum to the cent, or absent), parts: { k401, roth401k,
 * match: [{ amount, catchUp }] }, unread: null | "ytd" | "line" }: a pay stub's retirement lines (round-1 review).
 * - Every line of a kind is added: a catch-up is its own line ("401(k) Catch-Up", "ROTH CATCH UP"; from 2026 a high
 *   earner's catch-up must be Roth, IRC 414(v)(7), so two lines is the usual layout over 50). The same line printed
 *   twice (the same words and amount) counts once. For the match, the lines that name the plan win over a bare
 *   "Employer Match".
 * - A line's amount is its first money figure, as a size (a stub may print what comes off with a minus or in
 *   brackets). After "% of" the last figure on the line is the amount. A first figure that is the share of pay (first x
 *   gross / 100 is within 2 cents of the next) is a rate printed without its % sign and is passed over.
 * - A line with no figure takes the next line's only when that line holds no letters (a stub copied cell by cell); a
 *   heading ("401(k) Plan") never takes the dollars of the line under it.
 * - Under a "Current ... YTD" heading, a line with one figure where gross pay has two may be the year-to-date figure:
 *   nothing is read (`unread: "ytd"`). `unread: "line"`: a plan line of the person's own was seen and gave no amount.
 * - `ytd: { k401, roth401k }`: the year-to-date figure of the person's own lines, when the gross pay line prints two figures
 *   (this paycheck, then the year so far) and every line of that kind does too: the second figure, added up (fix round 3,
 *   F1: "401(k) 0.00 1,200.00" is nothing this paycheck and $1,200.00 so far this year).
 */
export function readPlanLines(lines, gross = null) {
  const columns = lines.some((l) => /\b(current|this\s*period)\b.*\b(ytd|year[\s-]*to[\s-]*date)\b/i.test(l));
  const grossLine = lines.find((l) => FIELDS.paystub[0].labels.some((re) => re.test(l)));
  const grossTwo = !!grossLine && moneyIn(grossLine).length >= 2;
  const twoCols = columns && grossTwo;
  const out = { parts: { k401: [], roth401k: [], match: [] }, unread: null };
  const ytds = { k401: [], roth401k: [] };
  const amountOf = (i) => {
    const l = lines[i];
    let nums = moneyIn(l);
    if (!nums.length) { const next = lines[i + 1]; return next && !/[A-Za-z]/.test(next) && moneyIn(next).length ? { amount: Math.abs(moneyIn(next)[0]) } : { none: true }; }
    if (twoCols && nums.length === 1) return { ytd: true };
    if (/%\s*of\b/i.test(l)) return { amount: Math.abs(nums[nums.length - 1]) };
    if (gross > 0 && nums.length >= 2 && Math.abs(Math.abs(nums[0]) * gross / 100 - Math.abs(nums[1])) <= 0.02) nums = nums.slice(1);
    return { amount: Math.abs(nums[0]), ytd: grossTwo && nums.length === 2 ? Math.abs(nums[1]) : null };
  };
  const tiers = lines.map(matchTier), top = Math.max(0, ...tiers);
  const seen = new Set();
  lines.forEach((l, i) => {
    const key = isRothLine(l) ? "roth401k" : isLaterLine(l) ? "k401" : top > 0 && tiers[i] === top ? "match" : null;
    if (!key) return;
    const r = amountOf(i);
    if (r.amount === undefined) { if (key !== "match" && (r.ytd || !out.unread)) out.unread = r.ytd ? "ytd" : "line"; return; }
    const sig = `${key}|${l.replace(/[\d.,$%()*\s-]+/g, " ").trim().toLowerCase()}|${r.amount}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    out.parts[key].push({ amount: r.amount, catchUp: /catch/i.test(l) });
    if (ytds[key]) ytds[key].push(r.ytd ?? null);
  });
  for (const k of ["k401", "roth401k", "match"]) if (out.parts[k].length) out[k] = Math.round(out.parts[k].reduce((s, x) => s + x.amount, 0) * 100) / 100;
  out.ytd = {};
  for (const k of ["k401", "roth401k"]) if (ytds[k].length && ytds[k].every((v) => v !== null)) out.ytd[k] = Math.round(ytds[k].reduce((s, v) => s + v, 0) * 100) / 100;
  // a line that was read makes up for a heading that was not ("401(k) Plan" above "401(k) Employee 110.77")
  if (out.unread === "line" && (out.k401 !== undefined || out.roth401k !== undefined)) out.unread = null;
  return out;
}

/**
 * stubPeriod(text, start, end) -> { period, why: "dates" | "words" | null }: how often the stub pays.
 * - Its period's dates first: the 1st to the 15th, or the 16th to the month's last day, is twice a month; the 1st to the
 *   last day is a month; else by length: 6 to 8 days a week, 13 or 14 two weeks, 15 or 16 twice a month, 28 to 31 a month.
 * - Else its words: "biweekly", "bi-weekly", "bi weekly", "every two weeks" and "semi-monthly", "semi monthly", "twice a
 *   month" anywhere; "weekly" or "monthly" only on a line that also says pay, paid, frequency, schedule or cycle (a
 *   "Monthly Transit Pass" or "Standard weekly hours" line says nothing about the paycheck).
 * When the dates and the words disagree the dates win. null: the stub does not say.
 */
export function stubPeriod(text, start = null, end = null) {
  const d = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "")); return m ? { y: +m[1], m: +m[2], d: +m[3], t: Date.UTC(+m[1], +m[2] - 1, +m[3]) } : null; };
  const s = d(start), e = d(end);
  if (s && e && e.t >= s.t) {
    const days = Math.round((e.t - s.t) / 864e5) + 1, sameMonth = s.y === e.y && s.m === e.m, last = new Date(Date.UTC(e.y, e.m, 0)).getUTCDate();
    const by = sameMonth && s.d === 1 && e.d === 15 ? "semimonthly" : sameMonth && s.d === 16 && e.d === last ? "semimonthly" : sameMonth && s.d === 1 && e.d === last ? "monthly"
      : days >= 6 && days <= 8 ? "weekly" : days === 13 || days === 14 ? "biweekly" : days === 15 || days === 16 ? "semimonthly" : days >= 28 && days <= 31 ? "monthly" : null;
    if (by) return { period: by, why: "dates" };
  }
  const t = String(text ?? "").toLowerCase();
  if (/\bbi[\s-]?weekly\b|every\s+(two|2)\s+weeks|every\s+other\s+week/.test(t)) return { period: "biweekly", why: "words" };
  if (/\bsemi[\s-]?monthly\b|twice\s+(a|per)\s+month|twice\s+monthly/.test(t)) return { period: "semimonthly", why: "words" };
  for (const l of t.split(/\r?\n/)) {
    if (!/\b(pay|paid|frequency|schedule|cycle)\b/.test(l)) continue;
    if (/\bweekly\b/.test(l)) return { period: "weekly", why: "words" };
    if (/\bmonthly\b/.test(l)) return { period: "monthly", why: "words" };
  }
  return { period: null, why: null };
}

/**
 * Read the fields of a kind from text: for each field, the first line matching a label (and not the field's `skip`), the
 * value after the label (or on the next line, unless that line is one the field skips). A field marked `off` (what comes
 * off the pay) is read as its size. A pay stub's three retirement fields come from readPlanLines, its period from stubPeriod.
 */
export function readFields(kind, text) {
  const lines = kind === "paystub" ? stubLines(text) : String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = {};
  for (const f of FIELDS[kind] ?? []) {
    for (const re of f.labels ?? []) {
      const i = lines.findIndex((l) => re.test(l) && !(f.skip && f.skip.test(l)));
      if (i < 0) continue;
      const m = lines[i].match(re);
      const after = lines[i].slice((m.index ?? 0) + m[0].length);
      const read = (s) => (f.unit === "money" ? firstMoney(s) : f.unit === "percent" ? firstPercent(s) : f.unit === "date" ? (f.last ? lastDate(s) : firstDate(s)) : firstAge(m[0].match(/\d\d/) ? m[0] : s));
      let v = read(after);
      if (v === null && lines[i + 1] && !(f.skip && f.skip.test(lines[i + 1]))) v = read(lines[i + 1]);
      if (v !== null) { out[f.key] = f.off ? Math.abs(v) : v; break; }
    }
  }
  // the advisor's spending: a yearly figure becomes a month
  if (kind === "advisor" && out.spendingMonthly !== undefined) { const line = lines.find((l) => FIELDS.advisor.at(-1).labels[0].test(l)) ?? ""; if (/year|annual|\/yr|per\s*yr/i.test(line) && !/month|\/mo/i.test(line)) out.spendingMonthly = out.spendingMonthly / 12; }
  if (kind === "paystub") {
    const plan = readPlanLines(lines, out.gross ?? null);
    const { gross, net, federal, ...rest } = out;
    const ordered = { ...(gross !== undefined ? { gross } : {}), ...(net !== undefined ? { net } : {}), ...(federal !== undefined ? { federal } : {}) };
    for (const k of ["k401", "roth401k", "match"]) if (plan[k] !== undefined) ordered[k] = plan[k];
    // the paycheck's frequency: the period's dates, else the words on the stub (stubPeriod)
    return { ...ordered, ...rest, period: stubPeriod(text, out.periodStart, out.periodEnd).period };
  }
  return out;
}

/** The prompt that asks a model for the same fields as JSON (numbers only, null when not there). */
export function buildPrompt(kind, text) {
  const keys = (FIELDS[kind] ?? []).map((f) => `"${f.key}": ${f.label} (${f.unit === "percent" ? "a fraction, 0.065 for 6.5%" : f.unit === "date" ? "YYYY-MM-DD" : f.unit === "money" ? "a number, no $ or commas" : "a number"})`).join("\n");
  return [
    { role: "system", content: "You read financial documents and return only JSON. Never invent a figure: use null when the paper does not state it. Never include account numbers." },
    { role: "user", content: `${KINDS[kind]?.label ?? "A financial paper"}. Return a JSON object with these keys:\n${keys}\n\nThe text:\n"""\n${String(text).slice(0, 12000)}\n"""` },
  ];
}
/** The model's answer as fields: the JSON object in it, only the known keys, numbers and dates checked. */
export function parseAnswer(kind, content) {
  const m = String(content ?? "").match(/\{[\s\S]*\}/);
  if (!m) return {};
  let j; try { j = JSON.parse(m[0]); } catch { return {}; }
  const out = {};
  for (const f of FIELDS[kind] ?? []) {
    const v = j[f.key];
    if (v === null || v === undefined || v === "") continue;
    if (f.unit === "date") { const d = firstDate(String(v)); if (d) out[f.key] = d; }
    else { const n = Number(String(v).replace(/[$,%\s]/g, "")); if (Number.isFinite(n)) out[f.key] = f.unit === "percent" && n > 1 ? n / 100 : n; }
  }
  return out;
}

const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** "Casey's", or "Your" for the first adult Get started left unnamed ("Me") */
const possessive = (name) => (!name || ["me", "you"].includes(String(name).trim().toLowerCase()) ? "Your" : `${name}'s`);
const adultsOf = (plan) => (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
const PERIODS = ["weekly", "biweekly", "semimonthly", "monthly"];
const salariesOf = (plan, pid) => (plan.income ?? []).filter((x) => x.personId === pid && x.type === "salary");
const payOf = (plan, pid) => salariesOf(plan, pid).reduce((s, x) => s + perYear(x.amount, x.period), 0);
const within = (a, b, share) => b > 0 && Math.abs(a - b) <= share * b;

/**
 * workRows(plan, personId, { jobRowId }) -> { later, now, laterAcct, nowAcct, jobs, laterChoices }: the person's own 401(k)
 * rows at the job they still have (an account with `formerJob`, or named as an old job's, is left out).
 * `later`: a contribution row into a `401k` account (pay the tax later): the one `jobRowId` names, else the first.
 * `jobs`: every such row, when the person has more than one (two jobs): [{ rowId, accountId, name, yearly }], so the page
 * can ask which job a stub is from. `now`: the first row into a `roth` account that Contributions counts as a Roth 401(k)
 * (`limitKind` "401k": a match on it, or 401(k), 403(b), 457, TSP or thrift in its name).
 * `laterAcct` / `nowAcct`: that row's account; else an account of that kind the person owns with no row yet; else one
 * nobody owns (Net worth saves "Joint or shared" as no owner) that no other adult pays into, when the household has one
 * adult or there is only one such account; else null (then using the proposal makes one). `laterChoices`: several such
 * unowned 401(k) accounts, for the page to ask which.
 */
export function workRows(plan, personId, { jobRowId = null } = {}) {
  const accounts = plan.accounts ?? [];
  const acct = (id) => accounts.find((a) => a.id === id) ?? null;
  // an account with nothing going in that is named as an old job's ("Bo's old 401(k)") is not this paycheck's plan
  const old = (a) => !!a.formerJob || /\b(old|former|previous|prior|rollover)\b/i.test(String(a.name ?? ""));
  const isLater = (a) => !!a && a.type === "401k" && !a.formerJob;
  const isNow = (a, match = 0) => !!a && a.type === "roth" && !a.formerJob && limitKind("roth", a.name, match) === "401k";
  const all = plan.retirement?.contributions ?? [];
  const rows = all.filter((c) => c.personId === personId);
  const laters = rows.filter((c) => isLater(acct(c.accountId)));
  const later = laters.find((c) => c.id === jobRowId) ?? laters[0] ?? null;
  const now = rows.find((c) => isNow(acct(c.accountId), c.employerMatch)) ?? null;
  const own = accounts.filter((a) => a.ownerId === personId && !old(a));
  const free = (is) => accounts.filter((a) => !a.ownerId && !old(a) && is(a) && !all.some((c) => c.accountId === a.id && c.personId && c.personId !== personId));
  const loose = (is) => { const f = free(is); return adultsOf(plan).length === 1 || f.length === 1 ? f : []; };
  const looseLater = later || own.some(isLater) ? [] : loose(isLater);
  return {
    later, now,
    laterAcct: later ? acct(later.accountId) : own.find((a) => isLater(a)) ?? looseLater[0] ?? null,
    nowAcct: now ? acct(now.accountId) : own.find((a) => isNow(a)) ?? loose(isNow)[0] ?? null,
    jobs: laters.length > 1 ? laters.map((c) => ({ rowId: c.id, accountId: c.accountId, name: acct(c.accountId)?.name ?? "401(k)", yearly: perYear(c.amount, c.period) })) : null,
    laterChoices: looseLater.length > 1 ? looseLater.map((a) => ({ id: a.id, name: a.name })) : null,
  };
}

/**
 * whoseStub(plan, text, fields, asked) -> { personId, why: "asked" | "name" | "pay" | "only" | null, ask, other }: the adult
 * a pay stub is for (round-1 review). The one the page was opened or set for (`asked`); else the only adult whose name is
 * in the text as a word; else the only adult whose pay on file is within 2% of the stub's gross x pay periods (any of the
 * four rhythms when the stub does not say); else the only adult with pay, or the only adult. `ask`: two or more adults
 * with pay and nothing tells them apart: [{ id, name }], and no change is proposed until the person says.
 * `other`: the stub's yearly pay is more than 15% from the chosen adult's and matches another adult's: { id, name, yearly }.
 */
export function whoseStub(plan, text, fields, asked = null) {
  const adults = adultsOf(plan);
  const none = { personId: null, why: null, ask: null, other: null };
  if (!adults.length) return none;
  const yearlies = fields.gross > 0 ? (fields.period ? [fields.period] : PERIODS).map((per) => perYear(fields.gross, per)) : [];
  const matches = (p) => { const pay = payOf(plan, p.id); return yearlies.some((y) => within(y, pay, 0.02)); };
  const otherOf = (id) => {
    const pay = payOf(plan, id);
    if (!yearlies.length || !(pay > 0) || yearlies.some((y) => within(y, pay, 0.15))) return null;
    const o = adults.filter((p) => p.id !== id && matches(p));
    return o.length === 1 ? { id: o[0].id, name: o[0].name, yearly: payOf(plan, o[0].id) } : null;
  };
  if (asked && adults.some((p) => p.id === asked)) return { personId: asked, why: "asked", ask: null, other: otherOf(asked) };
  if (adults.length === 1) return { personId: adults[0].id, why: "only", ask: null, other: null };
  const words = new Set(String(text ?? "").toLowerCase().split(/[^a-z']+/));
  const named = adults.filter((p) => { const n = String(p.name ?? "").trim().toLowerCase(); return n.length >= 2 && !/^(me|you|my .*)$/.test(n) && n.split(/\s+/).every((w) => words.has(w)); });
  if (named.length === 1) return { personId: named[0].id, why: "name", ask: null, other: null };
  const paid = adults.filter(matches);
  if (paid.length === 1) return { personId: paid[0].id, why: "pay", ask: null, other: null };
  const earners = adults.filter((p) => payOf(plan, p.id) > 0);
  if (earners.length === 1) return { personId: earners[0].id, why: "only", ask: null, other: null };
  return { ...none, ask: adults.map((p) => ({ id: p.id, name: p.name })) };
}

/**
 * The most a person may put into a 401(k) of their own in the year of `today`: the limit plus the catch-up for the age
 * they reach that year (limitsFor, catchUpFor: IRC 402(g)(1), 414(v)); with no birth year, the largest catch-up there is.
 */
export function ownLimit(person, today) {
  const year = Number(String(today ?? "").slice(0, 4)) || new Date().getUTCFullYear();
  const def = limitsFor(year).kinds["401k"];
  const born = Number(String(person?.birthDate ?? "").slice(0, 4)) || Number(person?.birthYear) || null;
  return def.limit + (born ? catchUpFor(def, year - born) : Math.max(def.catchUp ?? 0, def.superCatchUp?.amount ?? 0));
}

/**
 * The changes the fields suggest, against the plan as it is. Each: { id, op, label, before, after, ...target } -- applied only by the user.
 * ctx: { personId, accountId, today, preTaxLine (the stub has a pay-the-tax-later plan line, read or not), typed (the keys
 * of fields the person typed themself: no "wrong line" check on those), jobRowId, accountFor: { later: id | "new" } }
 * A pay stub's 401(k) lines (2026-11-11) are `op: "work"` proposals on the person's own rows (workRows): `side` "later" (the
 * 401(k) you pay the tax on later), "now" (the Roth 401(k)) or the match (the employer's money, always on the later row: most
 * plans add it as pay-the-tax-later, IRC 402(a); a match typed on the Roth row moves there). `make`: what using it adds,
 * "row" (a row into an account the person has) or "account" (a $0 account and its row) or null (the row is there).
 * Round-1 review (2026-11-12):
 * - `suspect`: the figure cannot be a paycheck's saving: "pay" (half the gross pay or more: the wrong line, a wages line)
 *   or "limit" (a year of it is above the person's limit with catch-up, ownLimit: likely the year-to-date figure). The
 *   page offers no "Use it" for it, only a box to type the right number.
 * - `move`: a Roth line, no pay-the-tax-later line, and pay-the-tax-later money on file: the money on file may be this
 *   same Roth money. ONE proposal (the Roth one) carries { rowId, amount, period, yearly, accountName, balance }; used with
 *   `zeroLater: rowId` it also sets that row to $0 (the person says "it is the same money"), used without, both go in.
 * - `alone`: the match with none of the person's own money read from the stub and none on file.
 * - With no period (the stub does not say and the pay on file fits none), every stub proposal has `needsPeriod`.
 */
export function proposals(plan, kind, fields, ctx = {}) {
  const out = [];
  const people = plan.household?.people ?? [];
  const person = people.find((p) => p.id === ctx.personId) ?? people.find((p) => p.role === "self") ?? people[0];
  const who = person?.name ?? "You";
  const typed = new Set(ctx.typed ?? []);
  const needsPeriod = kind === "paystub" && !fields.period;
  if (kind === "paystub" && fields.gross > 0) {
    const period = fields.period ?? "biweekly";
    // with two salaries on file (two jobs), the one nearest this stub's pay a year
    const incs = salariesOf(plan, person?.id), yearly = perYear(fields.gross, period);
    const inc = incs.slice().sort((a, b) => Math.abs(perYear(a.amount, a.period) - yearly) - Math.abs(perYear(b.amount, b.period) - yearly))[0] ?? null;
    out.push({ id: "pay", op: "income", personId: person?.id ?? "", incomeId: inc?.id ?? null, incomeName: incs.length > 1 ? inc.name : null, amount: fields.gross, period, label: `${who}'s pay: ${fields.gross} ${period}`, before: inc ? { amount: inc.amount, period: inc.period, yearly: perYear(inc.amount, inc.period) } : null, after: { amount: fields.gross, period, yearly } });
    if (fields.federal > 0) {
      const slot = person?.role === "partner" ? "partner" : "self";
      const w = plan.taxes?.withholding?.[slot] ?? null;
      // the plan keeps one withholding figure per person: with two jobs on file, one job's paycheck is not all of it
      out.push({ id: "withholding", op: "withholding", personId: person?.id ?? "", slot, ...(incs.length > 1 ? { twoJobs: true } : {}), perPaycheck: fields.federal, period, label: `Federal tax withheld per paycheck: ${fields.federal}`, before: w ? { perPaycheck: w.perPaycheck, period: w.period } : null, after: { perPaycheck: fields.federal, period } });
    }
  }
  if (kind === "paystub" && person && (fields.k401 > 0 || fields.roth401k > 0 || fields.match > 0)) {
    const period = fields.period ?? "biweekly";
    const pid = person.id, whose = possessive(person.name), whoseIn = whose === "Your" ? "your" : whose;
    const w = workRows(plan, pid, { jobRowId: ctx.jobRowId });
    const accounts = plan.accounts ?? [];
    // several 401(k) accounts nobody owns: the one the person picked, else the first; "new" makes one
    const pickLater = w.laterChoices ? (ctx.accountFor?.later === "new" ? null : accounts.find((a) => a.id === ctx.accountFor?.later) ?? w.laterAcct) : w.laterAcct;
    const base = (side) => {
      const row = side === "now" ? w.now : w.later, a = side === "now" ? w.nowAcct : pickLater;
      const name = side === "now" ? `${whose} Roth 401(k) at work` : `${whose} 401(k) at work`;
      return { op: "work", side, personId: pid, today: ctx.today ?? "", period, contributionId: row?.id ?? null, accountId: a?.id ?? null, accountName: a?.name ?? name, make: row ? null : a ? "row" : "account",
        ...(side === "later" && w.laterChoices && !row ? { choices: w.laterChoices } : {}) };
    };
    // what is on file, and whether it is our guess (the guesses ledger), so the page never shows a guess as the person's own
    const own = (row) => (row ? { amount: row.amount, period: row.period, yearly: perYear(row.amount, row.period), ...(isGuess(plan, `retirement.contributions[${row.id}].amount`) ? { guess: true } : {}) } : null);
    const after = (amount) => ({ amount: cents(amount), period, yearly: perYear(cents(amount), period) });
    const limit = ownLimit(person, ctx.today);
    const suspect = (key, amount) => (typed.has(key) ? {} : fields.gross > 0 && amount >= fields.gross / 2 ? { suspect: "pay" } : key !== "match" && perYear(amount, period) > limit + 1 ? { suspect: "limit", limit } : {});
    if (fields.k401 > 0) out.push({ id: "k401", ...base("later"), amount: cents(fields.k401), label: `What goes into ${whoseIn} 401(k), pay the tax later: ${fields.k401} a paycheck`, before: own(w.later), after: after(fields.k401), ...suspect("k401", fields.k401) });
    if (fields.roth401k > 0) {
      // a stub with a Roth line and no pay-the-tax-later line at all: the later row on file may be this same Roth money (Get
      // started's "Through work" always saves a 401(k)). One card asks; the person says whether it is the same money.
      const same = !(fields.k401 > 0) && !ctx.preTaxLine && w.later && perYear(w.later.amount, w.later.period) > 0;
      const acct = same ? accounts.find((a) => a.id === w.later.accountId) : null;
      out.push({ id: "roth401k", ...base("now"), amount: cents(fields.roth401k), label: `What goes into ${whoseIn} Roth 401(k), pay the tax now: ${fields.roth401k} a paycheck`, before: own(w.now), after: after(fields.roth401k), ...suspect("roth401k", fields.roth401k),
        ...(same ? { move: { rowId: w.later.id, ...own(w.later), accountName: acct?.name ?? "the 401(k)", balance: Number(acct?.balance) || 0 } } : {}) });
    }
    if (fields.match > 0) {
      const onNow = Number(w.now?.employerMatch) || 0;
      const yearly = cents(perYear(fields.match, period));
      const ownOnFile = [w.later, w.now].reduce((s, r) => s + (r ? perYear(r.amount, r.period) : 0), 0);
      out.push({ id: "match", ...base("later"), employerMatch: yearly, perPaycheck: cents(fields.match), moveMatch: onNow > 0, label: `The employer's match into ${whoseIn} 401(k): ${fields.match} a paycheck`,
        before: { matchYearly: (Number(w.later?.employerMatch) || 0) + onNow, onNow, ...([w.later, w.now].some((r) => r && Number(r.employerMatch) > 0 && isGuess(plan, `retirement.contributions[${r.id}].employerMatch`)) ? { guess: true } : {}) }, after: { matchYearly: yearly, perPaycheck: cents(fields.match), period },
        ...suspect("match", fields.match), ...(!(fields.k401 > 0) && !(fields.roth401k > 0) && !(ownOnFile > 0) ? { alone: true } : {}) });
    }
  }
  if (needsPeriod) for (const x of out) x.needsPeriod = true;
  if (kind === "statement" && fields.balance !== undefined && ctx.accountId) {
    const a = (plan.accounts ?? []).find((x) => x.id === ctx.accountId);
    if (a) out.push({ id: "balance", op: "balance", accountId: a.id, balance: Math.abs(fields.balance), date: fields.date ?? ctx.today ?? "", label: `${a.name}: balance ${Math.abs(fields.balance)}`, before: { balance: a.balance, asOf: a.asOf }, after: { balance: Math.abs(fields.balance), asOf: fields.date ?? ctx.today ?? "" } });
  }
  if (kind === "ssa" && fields.monthlyAtFRA > 0 && person) {
    const s = plan.retirement?.socialSecurity?.[person.id] ?? {};
    out.push({ id: "ssa", op: "ssa", personId: person.id, monthlyAtFRA: fields.monthlyAtFRA, label: `${who}'s Social Security at full retirement age: ${fields.monthlyAtFRA} a month`, before: s.monthlyAtFRA ? { monthlyAtFRA: s.monthlyAtFRA } : null, after: { monthlyAtFRA: fields.monthlyAtFRA } });
  }
  if (kind === "advisor") {
    const changes = {};
    for (const k of ["returnStocks", "returnBonds", "inflation", "spendingMonthly"]) if (fields[k] !== undefined) changes[k] = fields[k];
    if (fields.retireAge && person) changes[`retireAge:${person.id}`] = fields.retireAge;
    if (Object.keys(changes).length || fields.fee !== undefined || fields.quotedChance !== undefined) out.push({ id: "advisor", op: "advisor", changes, fee: fields.fee ?? null, quotedChance: fields.quotedChance ?? null, label: "The advisor's assumptions, to compare on Advisor's plan", before: plan.advisor ? { firm: plan.advisor.firm } : null, after: { ...changes, fee: fields.fee ?? null, quotedChance: fields.quotedChance ?? null } });
  }
  for (const x of out) if (alreadyOnFile(x)) x.same = true;
  return out;
}

/**
 * A proposal that would change nothing that counts: the same figure a year to the dollar (a pay of $72,000 a year read as
 * $2,769.23 every two weeks), the same withholding a paycheck, balance and date, or Social Security amount. A guess on file
 * is never "already on file": using the paper's figure makes it the person's own. A Roth line that asks about the money on
 * file (`move`) is a question, never "already on file". The page says "Already on file" and offers no "Use it".
 */
export function alreadyOnFile(x) {
  const b = x.before, a = x.after, dollars = (n) => Math.round(Number(n) || 0);
  if (!b || b.guess || x.move) return false;
  switch (x.op) {
    case "income": return dollars(b.yearly) === dollars(a.yearly);
    case "withholding": return cents(b.perPaycheck) === cents(a.perPaycheck) && b.period === a.period;
    case "work": return x.employerMatch !== undefined ? !(b.onNow > 0) && dollars(b.matchYearly) === dollars(a.matchYearly) : !x.make && dollars(b.yearly) === dollars(a.yearly);
    case "balance": return cents(b.balance) === cents(a.balance) && (b.asOf ?? "") === (a.asOf ?? "");
    case "ssa": return dollars(b.monthlyAtFRA) === dollars(a.monthlyAtFRA);
    default: return false;
  }
}

/** Apply one accepted proposal to a draft of the plan (inside store.update). */
export function applyProposal(p, x, ids = { newId: () => `r${Math.random().toString(36).slice(2, 9)}` }) {
  switch (x.op) {
    case "income": {
      p.income = p.income ?? [];
      const i = p.income.findIndex((y) => y.id === x.incomeId);
      if (i >= 0) Object.assign(p.income[i], { amount: x.amount, period: x.period });
      else p.income.push({ id: ids.newId(), name: `${possessive((p.household?.people ?? []).find((q) => q.id === x.personId)?.name)} pay`, type: "salary", personId: x.personId, amount: x.amount, period: x.period, growth: 0.03, taxable: true });
      break;
    }
    case "withholding": p.taxes = p.taxes ?? {}; p.taxes.withholding = p.taxes.withholding ?? {}; p.taxes.withholding[x.slot] = { perPaycheck: x.perPaycheck, period: x.period }; break;
    case "contribution": { const c = (p.retirement?.contributions ?? []).find((y) => y.id === x.contributionId); if (c) Object.assign(c, { amount: x.amount, period: x.period }); break; }
    case "work": {
      // the row is the one the proposal names (the job the person picked) when it is still there; else it is looked up
      // again on the plan as it is now (an earlier "Use it" on this stub may have made it), and made when it is still
      // missing: the account the proposal names, an account of that kind the person has, else a new $0 account
      p.retirement = p.retirement ?? {}; p.retirement.contributions = p.retirement.contributions ?? []; p.accounts = p.accounts ?? [];
      const w = workRows(p, x.personId);
      let row = (x.contributionId ? p.retirement.contributions.find((c) => c.id === x.contributionId && c.personId === x.personId) : null) ?? (x.side === "now" ? w.now : w.later);
      if (!row) {
        const type = x.side === "now" ? "roth" : "401k";
        let a = (x.make === "row" && x.accountId ? p.accounts.find((y) => y.id === x.accountId && y.type === type) : null) ?? (x.make === "account" && x.choices ? null : x.side === "now" ? w.nowAcct : w.laterAcct);
        if (!a) { a = { id: ids.newId(), name: x.accountName, type, institution: "", balance: 0, asOf: x.today ?? "", ownerId: x.personId, history: [], notes: "" }; p.accounts.push(a); }
        // an account nobody owned ("Joint or shared" on Net worth) that this paycheck pays into is this person's
        if (!a.ownerId) a.ownerId = x.personId;
        row = { id: ids.newId(), accountId: a.id, personId: x.personId, amount: 0, period: x.period, employerMatch: 0 };
        p.retirement.contributions.push(row);
      }
      // a figure read from the person's own pay stub and used is theirs: any guess on it is dropped (core/estimate ledger)
      if (x.amount !== undefined) { row.amount = x.amount; row.period = x.period; delete row.pctOfPay; clearGuess(p, `retirement.contributions[${row.id}].amount`); }
      // "it is the same money": the pay-the-tax-later row on file was this Roth money all along, so nothing goes in there
      if (x.zeroLater) { const lr = p.retirement.contributions.find((c) => c.id === x.zeroLater && c.id !== row.id); if (lr) { lr.amount = 0; delete lr.pctOfPay; clearGuess(p, `retirement.contributions[${lr.id}].amount`); } }
      // money going in from the paycheck shows the job has a retirement plan (Get started's question 2, "Yes"); an earlier
      // "No" gives way, and the match it said "no" to is left to the match line (or asked again elsewhere)
      if (x.amount > 0 && p.retirement.workPlans?.[x.personId]?.plan !== true) {
        p.retirement.workPlans = p.retirement.workPlans ?? {};
        p.retirement.workPlans[x.personId] = { ...(p.retirement.workPlans[x.personId] ?? {}), plan: true };
      }
      if (x.employerMatch !== undefined) {
        row.employerMatch = x.employerMatch; clearGuess(p, `retirement.contributions[${row.id}].employerMatch`);
        // the stub's match is the whole match: one typed on the Roth 401(k) row is not counted twice (it moves here)
        if (x.moveMatch && w.now && w.now !== row) { w.now.employerMatch = 0; clearGuess(p, `retirement.contributions[${w.now.id}].employerMatch`); }
        // the stub shows a match, so an earlier "no match" answer no longer holds
        if (x.employerMatch > 0) { p.retirement.workPlans = p.retirement.workPlans ?? {}; p.retirement.workPlans[x.personId] = { ...(p.retirement.workPlans[x.personId] ?? {}), match: true }; }
      }
      break;
    }
    case "balance": {
      const a = (p.accounts ?? []).find((y) => y.id === x.accountId);
      if (a) { a.balance = x.balance; clearGuess(p, `accounts[${a.id}].balance`); if (x.date) { a.asOf = x.date; a.history = (a.history ?? []).filter((h) => h.date !== x.date); a.history.push({ date: x.date, balance: x.balance }); a.history.sort((m, n) => String(m.date).localeCompare(String(n.date))); } }
      break;
    }
    case "ssa": p.retirement = p.retirement ?? {}; p.retirement.socialSecurity = p.retirement.socialSecurity ?? {}; p.retirement.socialSecurity[x.personId] = { ...(p.retirement.socialSecurity[x.personId] ?? {}), monthlyAtFRA: x.monthlyAtFRA }; clearGuess(p, `retirement.socialSecurity.${x.personId}.monthlyAtFRA`); break;
    case "advisor": p.advisor = { ...(p.advisor ?? {}), changes: { ...(p.advisor?.changes ?? {}), ...x.changes }, ...(x.fee !== null ? { fee: x.fee } : {}), ...(x.quotedChance !== null ? { quotedChance: x.quotedChance } : {}) }; break;
    default: break;
  }
  return p;
}

/**
 * stubFacts(plan, text, fields, params) -> what the page says around a pay stub's changes (round-1 review, 2026-11-12):
 * { personId, who (whoseStub's why), ask (whose it is must be asked: [{ id, name }]), other ({ id, name, yearly }: the pay
 *   matches another adult's), noPeople, period, periodWhy ("you" picked it | "dates" | "words" | "pay": gross x periods is
 *   within 2% of the pay on file | null: not known), payOnFile, stubYearly, odd (the period is known from the stub and
 *   gross x periods is more than 15% from the pay on file: a bonus, overtime, unpaid days), jobs + jobRowId (two jobs: which
 *   row this stub is taken for: the one picked, else the one nearest the stub's 401(k) a year), own ({ stub, file }: the
 *   person's own money a year on this stub and on file now, so using only some of the cards is seen), unread (readPlanLines),
 *   noPlanLine (pay and take-home were read and no retirement line of the person's own is on the stub; `onFile`: what the
 *   plan says goes in a year; or, with `zeroLine: true`, the stub prints the person's own line as $0.00 this paycheck and
 *   no own line above $0: `sides` ("later", "now"), `ytd` (the year so far on those lines, or null) and `set` (the changes
 *   that set the rows on file holding money for those lines to $0; used only when the person taps "Set it to $0")) }
 */
function stubFacts(plan, text, read, params, lines401 = {}) {
  const fields = { ...read };
  const adults = adultsOf(plan);
  const who = whoseStub(plan, text, fields, adults.some((p) => p.id === params.personId) ? params.personId : null);
  const pid = who.personId;
  const pay = pid ? payOf(plan, pid) : 0;
  let periodWhy = params.extra?.period ? "you" : fields.period ? stubPeriod(text, fields.periodStart, fields.periodEnd).why : null;
  if (params.extra?.period) fields.period = params.extra.period;
  if (!fields.period && fields.gross > 0 && pay > 0) {
    const fit = PERIODS.filter((per) => within(perYear(fields.gross, per), pay, 0.02));
    if (fit.length === 1) { fields.period = fit[0]; periodWhy = "pay"; }
  }
  const stubYearly = fields.gross > 0 && fields.period ? perYear(fields.gross, fields.period) : null;
  const odd = stubYearly !== null && pay > 0 && periodWhy !== "pay" && !within(stubYearly, pay, 0.15);
  const w0 = pid ? workRows(plan, pid) : null;
  const want = perYear(fields.k401 ?? 0, fields.period ?? "biweekly");
  const jobRowId = w0?.jobs ? (w0.jobs.some((j) => j.rowId === params.jobRowId) ? params.jobRowId : w0.jobs.slice().sort((a, b) => Math.abs(a.yearly - want) - Math.abs(b.yearly - want))[0].rowId) : null;
  const w = pid ? workRows(plan, pid, { jobRowId }) : null;
  const fileOwn = w ? [w.later, w.now].reduce((s, r) => s + (r ? perYear(r.amount, r.period) : 0), 0) : 0;
  const hasOwn = fields.k401 > 0 || fields.roth401k > 0;
  // a line of the person's own printed as 0.00 this paycheck, and none above $0 (fix round 3, F1): said, never passed over
  const KEY = { later: "k401", now: "roth401k" };
  const zeroSides = hasOwn || read.unread || !w ? [] : ["later", "now"].filter((side) => fields[KEY[side]] === 0 && (lines401.parts?.[KEY[side]] ?? []).length > 0 && params.extra?.[KEY[side]] === undefined);
  const zeroYtd = zeroSides.length && zeroSides.every((side) => lines401.ytd?.[KEY[side]] !== undefined) ? zeroSides.reduce((t, side) => t + lines401.ytd[KEY[side]], 0) : null;
  const zeroRows = zeroSides.map((side) => [side, side === "now" ? w.now : w.later]).filter(([, r]) => r && perYear(r.amount, r.period) > 0);
  const zeroLine = zeroSides.length ? { onFile: fileOwn, zeroLine: true, sides: zeroSides, ytd: zeroYtd,
    set: zeroRows.map(([side, r]) => ({ id: "zero", op: "work", side, personId: pid, today: params.today ?? "", contributionId: r.id, accountId: r.accountId, make: null, amount: 0, period: r.period,
      before: { amount: r.amount, period: r.period, yearly: perYear(r.amount, r.period), match: Number(r.employerMatch) || 0 } })) } : null;
  return { fields, facts: {
    personId: pid, who: who.why, ask: who.ask, other: who.other, noPeople: adults.length === 0,
    period: fields.period ?? null, periodWhy, payOnFile: pay || null, stubYearly, odd,
    jobs: w0?.jobs ?? null, jobRowId,
    own: hasOwn && fields.period ? { stub: perYear((fields.k401 ?? 0) + (fields.roth401k ?? 0), fields.period), file: fileOwn } : null,
    noPlanLine: zeroLine ?? (fields.gross > 0 && fields.net > 0 && !hasOwn && !read.unread && !stubLines(text).some((l) => isLaterLine(l) || isRothLine(l)) ? { onFile: fileOwn } : null),
  } };
}

/**
 * compute(plan, { text, kind, personId, accountId, today, extra, typed, jobRowId, accountFor }) -> { kind, detected, fields,
 *   found: [{ key, label, unit, value, parts? }], missing: [labels], proposals, stub (stubFacts, for a pay stub; else null) }
 * `extra`: fields from the AI or typed by the person ("Set my own number", whose keys are in `typed`: no wrong-line check
 * on those); `extra.period` is the person's answer to "How often are you paid?". A pay stub with no adult on the plan, or whose adult must be asked, proposes nothing yet.
 */
export function compute(plan, params = {}) {
  const text = String(params.text ?? "");
  const detected = text ? detectKind(text) : null;
  const kind = KINDS[params.kind] ? params.kind : detected;
  if (!kind) return { kind: null, detected, fields: {}, found: [], missing: [], proposals: [], stub: null };
  const read = readFields(kind, text);
  let fields = { ...read, ...(params.extra ?? {}) }, stub = null, parts = {};
  if (kind === "paystub") {
    const plan401 = readPlanLines(stubLines(text), read.gross ?? null);
    parts = plan401.parts;
    const r = stubFacts(plan, text, { ...fields, unread: plan401.unread }, params, plan401);
    fields = r.fields; delete fields.unread;
    stub = { ...r.facts, unread: fields.k401 > 0 || fields.roth401k > 0 ? null : plan401.unread };
  }
  const found = (FIELDS[kind] ?? []).filter((f) => fields[f.key] !== undefined).map((f) => ({ key: f.key, label: f.label, unit: f.unit, value: fields[f.key], ...((parts[f.key] ?? []).length > 1 && params.extra?.[f.key] === undefined ? { parts: parts[f.key] } : {}) }));
  const missing = (FIELDS[kind] ?? []).filter((f) => fields[f.key] === undefined).map((f) => f.label);
  const blocked = stub && (stub.noPeople || stub.ask);
  const list = blocked ? [] : proposals(plan, kind, fields, { ...params, personId: stub?.personId ?? params.personId, jobRowId: stub?.jobRowId ?? null, typed: params.typed ?? [], preTaxLine: kind === "paystub" && hasPreTaxLine(text) });
  return { kind, detected, fields, found, missing, proposals: list, stub };
}
