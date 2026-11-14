// modules/ai/reader/forms.js -- PURE. The Document reader's tax forms (gap design #23, 2026-11-14): a W-2, a 1099 (INT, DIV,
// B and R, alone or in one combined statement) and last year's Form 1040. Each is read by its box and line WORDS, not its
// line numbers (the 2025 Form 1040 renumbered them: adjusted gross income is line 11a there, line 11 before), and turned
// into proposed changes, each written to the plan only when the person taps that one change's "Use it" (AGENTS.md rule 5).
//
// Three promises, each with a test in module.test.mjs:
//   - Identifiers are never read. `scrub` blanks Social Security numbers, employer numbers (EIN), account and control
//     numbers and long runs of digits before anything is read, and every result is built from a fixed list of keys, so
//     none can be proposed, kept, shown or sent to the AI helper.
//   - A form of another year than the one the Federal estimate works out never changes that year's figures (wages, tax
//     taken out, interest, dividends, sales, withdrawals). Last year's W-2 fills only what the plan does not have yet: the
//     401(k) money going in, where nothing (or only our guess) is on file. It never replaces a figure the person set.
//   - Nothing is kept: the text lives in the page's memory for the visit only (view.js), never in the plan.
// Sources (read 2026-11-14 on www.irs.gov): the 2026 General Instructions for Forms W-2 and W-3 (box 12 codes), Form W-2
// (2026), Forms 1099-INT and 1099-DIV (Rev. January 2024), 1099-B (2026), 1099-R (2026), Form 1040 (2025). README has them.
import { perYear } from "../../../core/math/periods.js";
import { isGuess } from "../../../core/estimate/ledger.js";

export const FORM_KINDS = {
  w2: { label: "A W-2", hint: "pay, the tax taken out, 401(k) and Roth 401(k) money, HSA money through work", noun: "W-2" },
  f1099: { label: "A 1099", hint: "interest, dividends, sales, retirement withdrawals", noun: "1099" },
  f1040: { label: "Last year's tax return", hint: "adjusted gross income, total tax", noun: "tax return" },
};
export const isForm = (kind) => Object.prototype.hasOwnProperty.call(FORM_KINDS, kind);

// ---------------------------------------------------------------- identifiers out first
/** A line that names an identifier: what follows it on the line, up to its next word, is blanked. */
const ID_LABEL = /social\s*security\s*(?:number|no\b|#)|\bssn\b|\btin\b|taxpayer\s*identification|identification\s*(?:number|no\b)|\bein\b|employer\s*id\b|account\s*(?:number|no\b|#)|\bacct\.?\s*(?:number|no\b|#)?|control\s*(?:number|no\b|#)|routing\s*(?:number|no\b)?/gi;
/**
 * scrub(text) -> the text with every identifier blanked: a Social Security number (nine digits as 3-2-4, with dashes or
 * spaces, or masked to its last four), an employer number (2-7), a masked account number (XXXX1234), a run of seven or
 * more digits that is not an amount, and whatever digits follow a label that names one (SSN, TIN, EIN, account, control
 * or routing number). Run before anything is read, and on what is sent to the AI helper.
 */
export function scrub(text) {
  return String(text ?? "").split(/\r?\n/).map((l) => l
    .replace(/(?<![\d-])\d{3}[- ]\d{2}[- ]\d{4}(?![\d-])/g, " ")
    .replace(/(?<![\w-])[X*•#]{3}[- ]?[X*•#]{2}[- ]?\d{4}(?![\d-])/gi, " ")
    .replace(/(?<![\d-])\d{2}-\d{7}(?![\d-])/g, " ")
    .replace(/(?<![\w])[X*•#]{2,}[\d-]{2,8}(?![\d])/gi, " ")
    .replace(/(?<![\d.,$])\d{7,}(?![\d]|[.,]\d)/g, " ")
    .replace(ID_LABEL, (m) => `${m}\u0000`)
    .replace(/\u0000((?:\s*\([^)\n]{0,30}\))?[^A-Za-z\n]{0,40})/g, (_, rest) => rest.replace(/\u0000/g, "").replace(/\d/g, " "))
    .replace(/\u0000/g, "")).join("\n");
}

// ---------------------------------------------------------------- amounts by their words
/**
 * The amount in the part of a line that follows a label: references ("line 10", "lines 22 and 23", "box 2a", "Schedule 1")
 * and dot leaders are taken out; a number with a letter after it is a box or line ("11a", "1d"); a bare whole number is
 * skipped when it is the label's own box or line number, a year, or (when another label follows on the line) the next
 * box's number. The last figure left is the amount; brackets or a minus make it negative. null: none.
 */
export function amountIn(seg, own = [], { more = false } = {}) {
  const s = String(seg ?? "")
    .replace(/(?:\.\s*){2,}/g, " ")
    .replace(/\b(?:lines?|box(?:es)?|forms?|schedules?|sch\.?|part|copy|section|sec\.)\s+[\dA-Z]{1,4}[a-z]?(?:\s*(?:,|and|through|to|or|-)\s*\d{1,2}[a-z]?)*/gi, " ");
  const toks = [];
  for (const m of s.matchAll(/(?<![\w.,$\/-])(\(?)(-?)(\$\s?)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\.?(\)?)(?![\w%\/]|[.,]\d)/g)) {
    const digits = m[4], bare = !m[3] && !/[,.]/.test(digits);
    toks.push({ v: Number(digits.replace(/,/g, "")) * (((m[1] === "(" && m[5] === ")") || m[2] === "-") ? -1 : 1), bare, digits });
  }
  let list = toks.filter((t) => Number.isFinite(t.v) && !(t.bare && (own.includes(t.digits) || /^(?:19|20)\d\d$/.test(t.digits) || t.digits.length > 7)));
  if (more && list.length && list.at(-1).bare && list.at(-1).digits.length <= 2) list = list.slice(0, -1);
  return list.length ? list.at(-1).v : null;
}
/** The money-shaped figures on a line (a $, thousands commas or cents), for a row of figures under a row of labels. */
const figuresOn = (line) => {
  const out = [];
  for (const m of String(line).matchAll(/(?<![\w.,$\/-])(\(?)(-?)(\$\s?)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d+)\.?(\)?)(?![\w%\/]|[.,]\d)/g)) {
    const bare = !m[3] && !/[,.]/.test(m[4]);
    if (bare) continue;
    out.push(Number(m[4].replace(/,/g, "")) * (((m[1] === "(" && m[5] === ")") || m[2] === "-") ? -1 : 1));
  }
  return out;
};
const lettersIn = (l) => /[A-Za-z]{2,}/.test(l);
const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Where each label of `defs` (and the form's labels that are not read, `ignore`) sits on a line: [{ def | null, at, end }]. */
function labelsOn(line, defs, ignore) {
  const out = [];
  for (const d of defs) for (const re of d.labels ?? []) { const m = re.exec(line); if (m && !(d.skip && d.skip.test(line))) { out.push({ def: d, at: m.index, end: m.index + m[0].length }); break; } }
  for (const re of ignore) { const m = re.exec(line); if (m) out.push({ def: null, at: m.index, end: m.index + m[0].length }); }
  out.sort((a, b) => a.at - b.at);
  // two labels over the same words ("Federal income tax withheld" read and "income tax" ignored): the first one stands
  return out.filter((x, i) => !out.slice(0, i).some((y) => x.at < y.end));
}
/**
 * readLabeled(lines, defs, ignore) -> { key: amount }: for each field, the first line one of its labels names (in the
 * order of its labels), the amount after the label up to the next label on the line; else, when the next line is a row of
 * figures, the figure in the label's place (a form copied box by box: "1 Wages ... 2 Federal income tax withheld" over
 * "58,250.00 6,120.00"). A field with `sum` adds the distinct amounts of every line that names it.
 */
export function readLabeled(lines, defs, ignore = []) {
  const out = {};
  const valueAt = (i, d) => {
    const marks = labelsOn(lines[i], defs, ignore);
    const k = marks.findIndex((x) => x.def === d);
    if (k < 0) return null;
    const next = marks[k + 1];
    const seg = lines[i].slice(marks[k].end, next ? next.at : undefined);
    const v = amountIn(seg, d.box ? [String(d.box)] : [], { more: !!next });
    if (v !== null) return v;
    const below = lines[i + 1];
    if (below === undefined || labelsOn(below, defs, ignore).length) return null;
    const figs = figuresOn(below);
    if (figs.length && figs.length === marks.length) return figs[k];
    if (marks.length === 1 && !lettersIn(below)) { const one = amountIn(below, []); if (one !== null) return one; }
    return null;
  };
  for (const d of defs) {
    if (!d.labels) continue;
    if (d.sum) {
      const seen = new Set();
      lines.forEach((l, i) => { if (d.labels.some((re) => re.test(l))) { const v = valueAt(i, d); if (v !== null && v !== 0 && !seen.has(cents(v))) seen.add(cents(v)); } });
      if (seen.size) out[d.key] = cents([...seen].reduce((s, v) => s + v, 0));
      else if (lines.some((l, i) => d.labels.some((re) => re.test(l)) && valueAt(i, d) === 0)) out[d.key] = 0;
      continue;
    }
    let got = null;
    // a field with `prefer` reads first the lines that also say it ("Total ..."), then the others
    const order = lines.map((_, i) => i);
    if (d.prefer) order.sort((a, b) => Number(!d.prefer.test(lines[a])) - Number(!d.prefer.test(lines[b])) || a - b);
    for (const re of d.labels) {
      for (const i of order) { if (got !== null) break; if (re.test(lines[i]) && !(d.skip && d.skip.test(lines[i]))) got = valueAt(i, d); }
      if (got !== null) break;
    }
    if (got !== null) out[d.key] = d.signed ? cents(got) : cents(Math.abs(got));
  }
  return out;
}

// ---------------------------------------------------------------- the fields of each form
/** The fields each form holds: what the page shows and the AI helper is asked for (a fixed list: nothing else is kept). */
export const FORM_FIELDS = {
  w2: [
    { key: "wages", label: "Pay that is taxed (box 1)", unit: "money", box: 1, labels: [/wages,?\s*tips,?\s*(?:and\s*)?other\s*comp/i] },
    { key: "federal", label: "Federal tax taken out (box 2)", unit: "money", box: 2, labels: [/federal\s*income\s*tax\s*withheld/i, /\bfed(?:eral)?\.?\s*(?:income\s*)?tax\s*w\/?h\b/i] },
    { key: "medicareWages", label: "Pay before tax (box 5, Medicare wages)", unit: "money", box: 5, labels: [/medicare\s*wages(?:\s*and\s*tips)?/i] },
    { key: "k401", label: "401(k), 403(b) or 457(b), pay the tax later (box 12: D, E, G)", unit: "money", codes: ["D", "E", "G"] },
    { key: "roth401k", label: "Roth 401(k), pay the tax now (box 12: AA, BB, EE)", unit: "money", codes: ["AA", "BB", "EE"] },
    { key: "hsaWork", label: "HSA money through work (box 12: W)", unit: "money", codes: ["W"] },
    { key: "year", label: "Tax year", unit: "year" },
  ],
  f1099: [
    { key: "interest", label: "Interest (1099-INT box 1)", unit: "money", box: 1, labels: [/(?<!exempt[\s-]*)\binterest\s*income\b/i] },
    { key: "treasury", label: "Interest on savings bonds and Treasury bills (1099-INT box 3)", unit: "money", box: 3, labels: [/interest\s*on\s*u\.?\s*s\.?\s*savings\s*bonds/i] },
    { key: "ordinaryDiv", label: "Ordinary dividends (1099-DIV box 1a)", unit: "money", labels: [/total\s*ordinary\s*dividends/i, /ordinary\s*dividends/i] },
    { key: "qualifiedDiv", label: "Qualified dividends (1099-DIV box 1b)", unit: "money", labels: [/(?<!non[\s-]*)qualified\s*dividends/i] },
    { key: "capGainDist", label: "Capital gain distributions (1099-DIV box 2a)", unit: "money", labels: [/total\s*capital\s*gain\s*distr/i, /capital\s*gain\s*distributions/i] },
    { key: "exemptInterest", label: "Tax-exempt interest (1099-INT box 8, 1099-DIV box 12)", unit: "money", sum: true, labels: [/tax[\s-]*exempt\s*interest/i, /exempt[\s-]*interest\s*dividends/i] },
    { key: "shortProceeds", label: "Sales held a year or less (1099-B box 1d)", unit: "money" },
    { key: "shortBasis", label: "What they cost (1099-B box 1e)", unit: "money" },
    { key: "longProceeds", label: "Sales held more than a year (1099-B box 1d)", unit: "money" },
    { key: "longBasis", label: "What they cost (1099-B box 1e)", unit: "money" },
    { key: "proceeds", label: "Sales (1099-B box 1d)", unit: "money" },
    { key: "basis", label: "What they cost (1099-B box 1e)", unit: "money" },
    { key: "iraGross", label: "Taken out of an IRA, 401(k) or pension (1099-R box 1)", unit: "money", box: 1, labels: [/gross\s*distribution/i] },
    { key: "iraTaxable", label: "The part that is taxed (1099-R box 2a)", unit: "money", labels: [/taxable\s*amount(?!\s*not)/i] },
    { key: "withheld", label: "Federal tax taken out (box 4)", unit: "money", box: 4, sum: true, labels: [/federal\s*income\s*tax\s*withheld/i] },
    { key: "year", label: "Tax year", unit: "year" },
  ],
  f1040: [
    { key: "agi", label: "Adjusted gross income (line 11a; line 11 before 2025)", unit: "money", box: 11, signed: true, labels: [/this\s*is\s*your\s*adjusted\s*gross\s*income/i, /adjusted\s*gross\s*income/i] },
    { key: "taxable", label: "Taxable income (line 15)", unit: "money", box: 15, labels: [/this\s*is\s*your\s*taxable\s*income/i, /\btaxable\s*income\b/i] },
    { key: "totalTax", label: "Total tax (line 24)", unit: "money", box: 24, labels: [/this\s*is\s*your\s*total\s*tax/i, /\btotal\s*tax\b(?!\s*(?:withheld|payments))/i] },
    { key: "year", label: "Tax year", unit: "year" },
  ],
};
// the words of each form's other boxes, never read: so a row of labels pairs with its row of figures, and one box's words
// never stand for another's
const IGNORE = {
  w2: [/social\s*security\s*wages/i, /social\s*security\s*tax\s*withheld/i, /medicare\s*tax\s*withheld/i, /social\s*security\s*tips/i, /allocated\s*tips/i,
    /dependent\s*care\s*benefits/i, /nonqualified\s*plans/i, /state\s*wages/i, /state\s*income\s*tax/i, /local\s*wages/i, /local\s*income\s*tax/i, /employer'?s?\s*state\s*id/i],
  f1099: [/early\s*withdrawal\s*penalty/i, /investment\s*expenses/i, /foreign\s*tax\s*paid/i, /foreign\s*country/i, /private\s*activity\s*bond/i, /market\s*discount/i,
    /bond\s*premium/i, /nondividend\s*distributions/i, /unrecap/i, /section\s*1202/i, /collectibles/i, /section\s*199a/i, /section\s*897/i, /liquidation\s*distributions/i,
    /capital\s*gain\s*\(included/i, /net\s*unrealized/i, /employee\s*contributions/i, /distribution\s*code/i, /state\s*tax\s*withheld/i, /local\s*tax\s*withheld/i,
    /wash\s*sale/i, /total\s*distribution/i, /taxable\s*amount\s*not\s*determined/i, /fatca/i],
  f1040: [/total\s*income/i, /standard\s*deduction|itemized\s*deductions/i, /qualified\s*business\s*income/i, /total\s*payments/i, /amount\s*you\s*owe/i, /overpaid/i],
};

/** The box 12 codes (General Instructions for Forms W-2 and W-3, 2026). Only D, E, G, AA, BB, EE and W are read. */
export const BOX12 = { D: "401(k)", E: "403(b)", G: "457(b)", AA: "Roth 401(k)", BB: "Roth 403(b)", EE: "Roth 457(b)", W: "HSA" };
const CODE_AMT = /(?<![A-Za-z])(AA|BB|DD|EE|FF|GG|HH|II|TA|TP|TT|[A-HJ-NP-TVWYZ])(?![A-Za-z])(?:[\s:|=.\-]*(?:[A-Za-z]{3,}\.?|\([^)\n]{0,20}\)))*?[\s:|=.\-]*\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2})(?![\d])/g;
/**
 * box12(lines) -> { D: amount, AA: amount, ... }: the codes of box 12 and their amounts, from the lines that name box 12
 * ("12a D 19,500.00", "Box 12: D - 401(k) Deferral $19,500.00", "12a D 19500.00 12b W 1200.00") and the two lines under a
 * "12a" with no amount (a form copied box by box). Each code once: a W-2 pasted with its copies B, C and 2 repeats them.
 */
export function box12(lines) {
  const out = {};
  let under = 0;
  for (const raw of lines) {
    const is12 = /\b12\s*[a-d]\b|\bbox\s*12\b|\bcode\s+[A-Z]{1,2}\b/i.test(raw);
    if (!is12 && under <= 0) continue;
    const l = raw.replace(/\b(?:40[13]|457)\s*\(?\s*[kb]\s*\)?/gi, " plan ").replace(/\b12\s*[a-d]\b|\bbox\s*12\b/gi, " ").replace(/see\s*instructions\s*for(?:\s*box)?/gi, " ");
    let hit = false;
    for (const m of l.matchAll(CODE_AMT)) { hit = true; const code = m[1]; if (!(code in out)) out[code] = cents(Number(m[2].replace(/,/g, ""))); }
    under = is12 && !hit ? 2 : under - 1;
  }
  return out;
}

/**
 * The 1099-B's sales by how long they were held: lines after one that names "short-term" alone are short, after
 * "long-term" alone long (the box 2 words "Short-term gain or loss / Long-term gain or loss" name both and decide nothing,
 * since a tick does not copy as text). Per part, its proceeds (box 1d, a "Total" line first) and cost (box 1e).
 */
function sales(lines) {
  const parts = { short: [], long: [], none: [] };
  let term = "none";
  for (const l of lines) {
    const s = /short[\s-]*term/i.test(l), g = /long[\s-]*term/i.test(l);
    if (s !== g && !/gain\s*or\s*loss/i.test(l)) term = s ? "short" : "long";
    parts[term].push(l);
  }
  const PRO = { key: "p", box: 1, prefer: /\btotal\b/i, labels: [/\bproceeds\b/i], skip: /proceeds\s*from|gross\s*proceeds|net\s*proceeds|check\s*if|if\s*checked/i };
  const COST = { key: "b", box: 1, prefer: /\btotal\b/i, labels: [/\bcost\s*(?:or\s*other\s*)?basis\b|\bbasis\b/i], skip: /noncovered|not\s*reported/i };
  const out = {};
  for (const [t, ls] of Object.entries(parts)) {
    if (!ls.length) continue;
    const r = readLabeled(ls, [PRO, COST], IGNORE.f1099);
    const name = t === "none" ? "" : t;
    if (r.p !== undefined) out[name ? `${name}Proceeds` : "proceeds"] = r.p;
    if (r.b !== undefined) out[name ? `${name}Basis` : "basis"] = r.b;
  }
  // a part with no proceeds says nothing of its cost
  for (const t of ["short", "long", ""]) { const p = t ? `${t}Proceeds` : "proceeds", b = t ? `${t}Basis` : "basis"; if (out[p] === undefined) delete out[b]; }
  return out;
}

/**
 * formYear(kind, text, todayYear) -> the tax year the form is for, or null: "Tax year 2025", "For calendar year 2025", "For
 * the year Jan. 1-Dec. 31, 2025", else a year on the line that holds the form's name ("Form W-2 Wage and Tax Statement
 * 2025"). A form's revision ("Rev. January 2024") and print dates are not its year; a year after this one is no year.
 */
export function formYear(kind, text, todayYear = new Date().getUTCFullYear()) {
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.replace(/\(?\brev(?:ision|\.)?\s*(?:[A-Za-z.]+\s*)?(?:\d{1,2}[-/])?(?:19|20)\d\d\)?|\bcreated\s*\S+|\bcat\.\s*no\.\s*\S+|\d{1,2}\/\d{1,2}\/\d{2,4}/gi, " "));
  const ok = (y) => { const n = Number(y); return n >= 2000 && n <= todayYear ? n : null; };
  for (const l of lines) {
    const m = /(?:tax|calendar)\s*year\s*:?\s*((?:19|20)\d\d)\b/i.exec(l) ?? /\bfor\s*the\s*year\b[^\n]{0,40}?((?:19|20)\d\d)\b/i.exec(l);
    if (m && ok(m[1])) return ok(m[1]);
  }
  const title = { w2: /\bw-?2\b|wage\s*and\s*tax\s*statement/i, f1099: /\b1099\b/i, f1040: /\b1040\b|individual\s*income\s*tax\s*return/i }[kind];
  const yearOn = (l) => { const m = /(?<![\d,.$-])((?:19|20)\d\d)(?![\d,.%-])/.exec(l.replace(/\b1099\b|\b1040\b/g, " ")); return m ? ok(m[1]) : null; };
  for (const l of lines) if (title?.test(l) && yearOn(l)) return yearOn(l);
  // a statement that opens with its year ("2025 Tax Reporting Statement"): a year among its first three lines
  for (const l of lines.filter((x) => x.trim()).slice(0, 3)) if (yearOn(l)) return yearOn(l);
  return null;
}

/** The words that say a text is one of these forms (compute.js detectKind adds them after the kinds it had). */
export function formScores(t) {
  return {
    w2: (/wage\s*and\s*tax\s*statement/.test(t) ? 3 : 0) + (/\bw-?2\b/.test(t) ? 2 : 0) + (/wages,?\s*tips,?\s*(and\s*)?other\s*comp/.test(t) ? 3 : 0),
    f1099: (/\b1099-?(int|div|b|r)\b|form\s*1099\b/.test(t) ? 3 : 0) + (/interest\s*income/.test(t) ? 1 : 0) + (/ordinary\s*dividends/.test(t) ? 2 : 0) + (/gross\s*distribution/.test(t) ? 2 : 0) + (/\bproceeds\b/.test(t) ? 1 : 0),
    f1040: (/form\s*1040\b|individual\s*income\s*tax\s*return/.test(t) ? 3 : 0) + (/adjusted\s*gross\s*income/.test(t) ? 2 : 0) + (/taxable\s*income/.test(t) ? 1 : 0) + (/\btotal\s*tax\b/.test(t) ? 1 : 0),
  };
}

/** readForm(kind, text, todayYear) -> the fields read by their words (no AI): only the keys of FORM_FIELDS[kind]. */
export function readForm(kind, text, todayYear) {
  const lines = scrub(text).split(/\n/).map((l) => l.trim()).filter(Boolean);
  const defs = FORM_FIELDS[kind] ?? [];
  const read = readLabeled(lines, defs, IGNORE[kind] ?? []);
  if (kind === "w2") {
    const codes = box12(lines);
    for (const d of defs.filter((x) => x.codes)) { const got = d.codes.filter((c) => codes[c] !== undefined); if (got.length) read[d.key] = cents(got.reduce((s, c) => s + codes[c], 0)); }
    read.parts = Object.fromEntries(defs.filter((x) => x.codes).map((d) => [d.key, d.codes.filter((c) => codes[c] !== undefined).map((c) => ({ code: c, amount: codes[c] }))]).filter(([, v]) => v.length > 1));
  }
  if (kind === "f1099") {
    // the 1099-R's "Taxable amount" only on a 1099-R: the same words are on other forms
    if (!/1099-?r\b|gross\s*distribution/i.test(text)) delete read.iraTaxable;
    Object.assign(read, sales(lines));
  }
  const y = formYear(kind, text, todayYear);
  if (y) read.year = y;
  const out = {};
  for (const d of defs) if (read[d.key] !== undefined) out[d.key] = read[d.key];
  if (read.parts && Object.keys(read.parts).length) out.parts = read.parts;
  return out;
}

/**
 * The fields worth saying "Not found" for: on a 1099, only the boxes of the forms the text holds (a bank's 1099-INT is not
 * missing a 1099-R's withdrawal), and of a 1099-B's sales only its proceeds, once, when no sale was read at all.
 */
export function worthMissing(kind, text, fields) {
  const keys = (FORM_FIELDS[kind] ?? []).map((f) => f.key);
  if (kind !== "f1099") return new Set(keys);
  const t = String(text ?? "");
  const has = { INT: /1099-?int\b|interest\s*income/i.test(t), DIV: /1099-?div\b|dividends/i.test(t), B: /1099-?b\b|\bproceeds\b/i.test(t), R: /1099-?r\b|gross\s*distribution/i.test(t) };
  const of = { interest: "INT", treasury: "INT", exemptInterest: "INT", ordinaryDiv: "DIV", qualifiedDiv: "DIV", capGainDist: "DIV", iraGross: "R", iraTaxable: "R" };
  const sales = ["shortProceeds", "shortBasis", "longProceeds", "longBasis", "proceeds", "basis"];
  const anySale = sales.some((k) => fields[k] !== undefined);
  return new Set(keys.filter((k) => (sales.includes(k) ? has.B && !anySale && k === "proceeds" : of[k] ? has[of[k]] || (k === "exemptInterest" && has.DIV) : true)));
}

// ---------------------------------------------------------------- whose it is, which year
const adultsOf = (plan) => (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
const payOf = (plan, pid) => (plan.income ?? []).filter((x) => x.personId === pid && x.type === "salary").reduce((s, x) => s + perYear(x.amount, x.period), 0);
const within = (a, b, share) => b > 0 && Math.abs(a - b) <= share * b;
/** The W-2's pay before tax: box 5 when it was read, else box 1 and the money put in before tax (box 12 D, E, G). */
export const payBefore = (f) => (f.medicareWages > 0 ? f.medicareWages : f.wages > 0 ? cents(f.wages + (f.k401 ?? 0)) : null);

/**
 * formFacts(plan, kind, fields, text, { today, personId, year }) -> what the page says around a form's changes:
 * { year, yearWhy: "you" | "form" | "assumed", planYear (the year the Federal estimate works out: taxes.year, else this
 *   year), when: "plan" | "last" | "older" | "later", personId, who, ask, noPeople, others (the other adults with pay) }.
 * A form that does not say its year is taken as last year's (a W-2 or 1099 comes after the year it covers; a return is
 * read for last year's), and the page says so. Whose W-2 (only a W-2 names a person): the adult the page was set for;
 * else the only adult; else the only adult named in it; else the only one whose pay on file is within 10% of its pay;
 * else the only adult with pay; else the page asks.
 */
export function formFacts(plan, kind, fields, text, params = {}) {
  const todayYear = Number(String(params.today ?? "").slice(0, 4)) || new Date().getUTCFullYear();
  const planYear = Number(plan.taxes?.year) || todayYear;
  const picked = Number(params.year) >= 2000 && Number(params.year) <= todayYear ? Number(params.year) : null;
  const year = picked ?? (Number(fields.year) || (kind === "f1040" ? planYear - 1 : todayYear - 1));
  const yearWhy = picked ? "you" : Number(fields.year) ? "form" : "assumed";
  const when = year === planYear ? "plan" : year === planYear - 1 ? "last" : year < planYear ? "older" : "later";
  const adults = adultsOf(plan);
  const facts = { kind, year, yearWhy, planYear, when, personId: null, who: null, ask: null, noPeople: adults.length === 0, others: [] };
  if (kind !== "w2" || !adults.length) return facts;
  const asked = adults.find((p) => p.id === params.personId);
  let who = null, pid = null;
  if (asked) { pid = asked.id; who = "asked"; }
  else if (adults.length === 1) { pid = adults[0].id; who = "only"; }
  else {
    const words = new Set(scrub(text).toLowerCase().split(/[^a-z']+/));
    const named = adults.filter((p) => { const n = String(p.name ?? "").trim().toLowerCase(); return n.length >= 2 && !/^(me|you|my .*)$/.test(n) && n.split(/\s+/).every((w) => words.has(w)); });
    const pay = payBefore(fields);
    const paid = pay ? adults.filter((p) => within(pay, payOf(plan, p.id), 0.1)) : [];
    const earners = adults.filter((p) => payOf(plan, p.id) > 0);
    if (named.length === 1) { pid = named[0].id; who = "name"; }
    else if (paid.length === 1) { pid = paid[0].id; who = "pay"; }
    else if (earners.length === 1) { pid = earners[0].id; who = "earner"; }
    else facts.ask = adults.map((p) => ({ id: p.id, name: p.name }));
  }
  facts.personId = pid; facts.who = who;
  facts.others = adults.filter((p) => p.id !== pid && payOf(plan, p.id) > 0).map((p) => ({ id: p.id, name: p.name }));
  return facts;
}

// ---------------------------------------------------------------- what each form would change
const possessive = (name) => (!name || ["me", "you"].includes(String(name).trim().toLowerCase()) ? "Your" : `${name}'s`);
const typedNum = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
/** The Federal estimate's figure on file for a field of the year it works out: null when the page works it out itself. */
export function onFile(plan, field) {
  const ty = plan.taxes?.thisYear ?? {};
  if (field === "wages" || field === "iraWithdrawals") return typedNum(ty[field]);
  if (field === "withheld") return ty.withheldTyped === true ? (typedNum(ty.withheld) ?? 0) : (Number(ty.withheld) || null);
  return Number(ty[field]) || null;
}
/** The Income page's dividends and interest a year (investment income), which a 1099's interest and dividends may be. */
const incomeOf = (plan, type) => (plan.income ?? []).filter((x) => x.type === type && x.taxable !== false).reduce((s, x) => s + perYear(x.amount, x.period), 0);

/**
 * formProposals(plan, kind, fields, facts, ctx, { workRows, hsaUsed }) -> { proposals, checks }.
 * proposals: each { id, op, ... } is ONE field, applied only by the person (applyForm, or applyProposal's "work"):
 *   - op "work" (a W-2's box 12 D/E/G or AA/BB/EE): the person's own 401(k) row at work, only when nothing goes in on file
 *     or only our guess (a figure the person set is never replaced; the W-2 is last year's): `amount` a year, period
 *     "annual"; a missing row (and a $0 account for it) is made, as for a pay stub.
 *   - op "taxYear" (only a form of the year the Federal estimate works out): taxes.thisYear[field] = amount, or, with a
 *     figure the person typed there already, that figure plus this form's (`adds`: the page asks them to leave it when the
 *     typed figure already holds this form). The same figure already there is "already on file".
 *   - op "gain": a row added to the Capital gains page (taxes.gains), never one changed.
 *   - op "priorYear": last year's adjusted gross income and total tax, for Estimated payments' safe amount.
 * checks: what the form says against the plan with nothing to use: { id, kind, ... } (the pay, a 401(k) figure the
 *   person set, the HSA, a form of another year, sales whose term is not said, a withdrawal whose taxed part is not said).
 * Every proposal and check is built from fixed keys; none carries text from the form.
 */
export function formProposals(plan, kind, fields, facts, ctx = {}, deps = {}) {
  const proposals = [], checks = [];
  const year = facts.year, today = ctx.today ?? "";
  const tax = (id, field, amount, extra = {}) => {
    const before = onFile(plan, field), guess = before !== null && isGuess(plan, `taxes.thisYear.${field}`);
    const a = cents(amount);
    const adds = before !== null && before > 0 && !guess && cents(before) !== a;
    proposals.push({ id, op: "taxYear", field, form: kind === "w2" ? "W-2" : "1099", amount: a, year, before, ...(guess ? { guess: true } : {}), after: adds ? cents(before + a) : a, ...(adds ? { adds: true } : {}),
      ...(before !== null && !guess && cents(before) === a ? { same: true } : {}), ...extra });
  };
  if (kind === "w2") {
    if (facts.noPeople || facts.ask || !facts.personId) return { proposals, checks };
    const pid = facts.personId, person = adultsOf(plan).find((p) => p.id === pid);
    const whose = possessive(person?.name);
    const w = deps.workRows ? deps.workRows(plan, pid) : { later: null, now: null, laterAcct: null, nowAcct: null };
    const work = (id, side, amount) => {
      const row = side === "now" ? w.now : w.later, acct = side === "now" ? w.nowAcct : w.laterAcct;
      const yearly = row ? perYear(row.amount, row.period) : 0;
      const guess = !!row && yearly > 0 && isGuess(plan, `retirement.contributions[${row.id}].amount`);
      if (yearly > 0 && !guess) {
        checks.push({ id, kind: id, side, amount: cents(amount), onFile: cents(yearly), year, ...(Math.round(yearly) === Math.round(amount) ? { same: true } : {}) });
        return;
      }
      // several 401(k) accounts nobody owns: which one is this job's is asked on What you save for retirement
      if (side === "later" && !row && w.laterChoices) { checks.push({ id, kind: "choose", side, amount: cents(amount), year }); return; }
      const name = side === "now" ? `${whose} Roth 401(k) at work` : `${whose} 401(k) at work`;
      proposals.push({ id, op: "work", side, personId: pid, today, period: "annual", contributionId: row?.id ?? null, accountId: acct?.id ?? null, accountName: acct?.name ?? name,
        make: row ? null : acct ? "row" : "account", amount: cents(amount), year,
        before: row ? { amount: row.amount, period: row.period, yearly, ...(guess ? { guess: true } : {}) } : null, after: { amount: cents(amount), period: "annual", yearly: cents(amount) },
        ...(side === "now" && !(fields.k401 > 0) && w.later && perYear(w.later.amount, w.later.period) > 0 ? { caution: "later", laterYearly: cents(perYear(w.later.amount, w.later.period)) } : {}) });
    };
    if (fields.k401 > 0) work("k401", "later", fields.k401);
    if (fields.roth401k > 0) work("roth401k", "now", fields.roth401k);
    if (fields.hsaWork > 0) { const used = deps.hsaUsed ? deps.hsaUsed(plan, facts.planYear) : 0; checks.push({ id: "hsa", kind: "hsa", amount: fields.hsaWork, onFile: cents(used), year }); }
    const pay = payBefore(fields);
    if (pay) checks.push({ id: "pay", kind: "pay", amount: pay, onFile: cents(payOf(plan, pid)), year, about: !(fields.medicareWages > 0) });
    if (facts.when === "plan") {
      const others = facts.others.length ? { others: facts.others } : {};
      if (fields.wages > 0) tax("wages", "wages", fields.wages, others);
      if (fields.federal > 0) tax("withheld", "withheld", fields.federal, { from: "w2", ...others });
    }
  }
  if (kind === "f1099") {
    const any = ["interest", "treasury", "ordinaryDiv", "qualifiedDiv", "capGainDist", "exemptInterest", "iraGross", "iraTaxable", "withheld", "proceeds", "shortProceeds", "longProceeds"].some((k) => fields[k] > 0);
    if (!any) return { proposals, checks };
    if (facts.when !== "plan") { checks.push({ id: "year", kind: "year", year, planYear: facts.planYear }); return { proposals, checks }; }
    const inc = incomeOf(plan, "investment"), twice = inc > 0 ? { caution: "income", incomeYearly: cents(inc) } : {};
    const interest = cents((fields.interest ?? 0) + (fields.treasury ?? 0));
    const nonQualified = cents(Math.max(0, (fields.ordinaryDiv ?? 0) - (fields.qualifiedDiv ?? 0)));
    if (interest + nonQualified > 0) tax("ordinary", "otherOrdinary", interest + nonQualified, { parts: { interest, dividends: nonQualified }, ...twice });
    if (fields.qualifiedDiv > 0) tax("qualified", "qualifiedIncome", fields.qualifiedDiv, twice);
    if (fields.exemptInterest > 0) tax("exempt", "taxExemptInterest", fields.exemptInterest);
    const gains = plan.taxes?.gains ?? [];
    const gain = (id, name, proceeds, basis, held) => {
      const same = gains.some((g) => g.held === held && cents(g.proceeds) === cents(proceeds) && cents(g.basis) === cents(basis));
      proposals.push({ id, op: "gain", name, proceeds: cents(proceeds), basis: cents(basis), held, year, ...(same ? { same: true } : {}) });
    };
    if (fields.capGainDist > 0) gain("capdist", "Capital gain distributions", fields.capGainDist, 0, "long");
    for (const t of ["short", "long"]) {
      const p = fields[`${t}Proceeds`], b = fields[`${t}Basis`];
      if (!(p > 0)) continue;
      if (b === undefined) checks.push({ id: `cost-${t}`, kind: "cost", held: t, proceeds: p, year });
      else gain(`sale-${t}`, t === "short" ? "Sales on a 1099-B, held a year or less" : "Sales on a 1099-B, held more than a year", p, b, t);
    }
    if (fields.proceeds > 0) checks.push({ id: "term", kind: "term", proceeds: fields.proceeds, ...(fields.basis !== undefined ? { basis: fields.basis } : {}), year });
    // a pension on the Income page is counted there: a 1099-R for it would count it twice (said on the card)
    const pension = incomeOf(plan, "pension");
    if (fields.iraTaxable > 0) tax("ira", "iraWithdrawals", fields.iraTaxable, pension > 0 ? { caution: "pension", pensionYearly: cents(pension) } : {});
    else if (fields.iraTaxable === 0 && fields.iraGross > 0) checks.push({ id: "ira", kind: "untaxed", amount: fields.iraGross, year });
    else if (fields.iraGross > 0) checks.push({ id: "ira", kind: "taxedPart", amount: fields.iraGross, year });
    if (fields.withheld > 0) tax("withheld", "withheld", fields.withheld, { from: "1099" });
  }
  if (kind === "f1040") {
    const agi = fields.agi ?? null, t = fields.totalTax ?? null;
    if (agi === null && t === null) return { proposals, checks };
    if (facts.when !== "last") { checks.push({ id: "year", kind: "return", year, planYear: facts.planYear }); return { proposals, checks }; }
    const pr = plan.taxes?.priorYear ?? {};
    const b = { agi: typedNum(pr.agi), tax: typedNum(pr.tax) };
    const after = { agi: agi ?? b.agi, tax: t ?? b.tax };
    const has = b.agi !== null || b.tax !== null;
    proposals.push({ id: "prior", op: "priorYear", agi, tax: t, year, before: has ? b : null, after,
      ...(has && cents(b.agi) === cents(after.agi) && cents(b.tax) === cents(after.tax) && b.agi !== null && b.tax !== null ? { same: true } : {}) });
  }
  return { proposals, checks };
}

/** Apply one accepted proposal of a form (ops "taxYear", "gain", "priorYear") to a draft of the plan. Writes one field. */
export function applyForm(p, x, ids, clearGuess) {
  p.taxes = p.taxes ?? {};
  if (x.op === "taxYear") {
    const now = onFile(p, x.field);
    const guess = now !== null && x.guess;
    p.taxes.thisYear = p.taxes.thisYear ?? {};
    p.taxes.thisYear[x.field] = x.adds && now !== null && now > 0 && !guess ? cents(now + x.amount) : x.amount;
    // the Federal estimate's own Save marks a typed withholding the same way, so a $0 typed reads as typed
    if (x.field === "withheld") p.taxes.thisYear.withheldTyped = true;
    clearGuess?.(p, `taxes.thisYear.${x.field}`);
  }
  if (x.op === "gain") p.taxes.gains = [...(p.taxes.gains ?? []), { id: ids.newId(), name: x.name, proceeds: x.proceeds, basis: x.basis, held: x.held }];
  if (x.op === "priorYear") {
    p.taxes.priorYear = { ...(p.taxes.priorYear ?? {}), ...(x.agi !== null ? { agi: x.agi } : {}), ...(x.tax !== null ? { tax: x.tax } : {}) };
    clearGuess?.(p, "taxes.priorYear.agi"); clearGuess?.(p, "taxes.priorYear.tax");
  }
  return p;
}
