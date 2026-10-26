// modules/transactions/statements/compute.js -- PURE. Turn the text of a bank or card
// statement into transaction rows. Three ways in, in order of preference:
//   1. the PDF's own text layer (pdf.js on the server) -> parseStatementText() below, no AI;
//   2. that text, when the layout is odd, handed to the text model with buildTextPrompt();
//   3. a picture (PNG/JPG, or a scanned PDF page rendered to PNG) handed to a vision model
//      with buildVisionPrompt(). Both prompts answer in the same JSON, read by parseModelRows().
// The server does the reading (server/statements.mjs); this file decides and checks, so it
// can be tested with fake statements (qa/fixtures/statement-*.txt).
import { parseDate, parseAmount } from "../import/compute.js";
import { isoOf, isValidDate, addMonths } from "../../../core/math/dates.js";
import { prettyPayee } from "../rules/compute.js";

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const DATE_TOKEN = String.raw`(?:\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{1,2}(?:,? \d{4})?)`;
const AMOUNT_TOKEN = String.raw`(?:-?\(?\$?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?|-?\(?\$?-?\d+\.\d{2}\)?)(?:\s?(?:CR|DR|-))?`;
const LINE = new RegExp(String.raw`^\s*(${DATE_TOKEN})\s+(?:(${DATE_TOKEN})\s+)?(.*?)\s+(${AMOUNT_TOKEN})(?:\s+(${AMOUNT_TOKEN}))?\s*$`, "i");
const HEAD = new RegExp(String.raw`^\s*(${DATE_TOKEN})\s+(?:(${DATE_TOKEN})\s+)?([a-z][^$]*?)\s*$`, "i");         // a row whose amount wrapped to the next line
const TAIL = new RegExp(String.raw`^\s*(.*?)\s*(${AMOUNT_TOKEN})(?:\s+(${AMOUNT_TOKEN}))?\s*$`, "i");              // ...that next line

/** Statement period from lines like "Statement Period 08/13/2026 - 09/12/2026", "Closing Date 09/12/2026", "September 2026". */
export function findPeriod(text) {
  const t = String(text ?? "");
  let m = /(?:statement period|billing period|period|activity)[^\d]{0,30}(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:-|to|through|–)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(t);
  if (m) return { from: parseDate(m[1]), to: parseDate(m[2]) };
  m = /(?:closing date|statement date|as of)[^\d]{0,20}(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(t);
  if (m) { const to = parseDate(m[1]); return { from: to ? addMonths(to, -1) : null, to }; }
  m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/i.exec(t);
  if (m) { const y = Number(m[2]), mo = MONTHS[m[1].slice(0, 3).toLowerCase()]; const last = new Date(y, mo, 0).getDate(); return { from: isoOf(y, mo, 1), to: isoOf(y, mo, last) }; }
  return { from: null, to: null };
}
/** Closing / ending balance if printed. */
export function findClosingBalance(text) {
  const m = /(?:new balance|closing balance|ending balance|statement balance)[^\d-]{0,20}(?:\d{1,2}\/\d{1,2}\/\d{2,4}[^\d-]{0,20})?(\(?-?\$?[\d,]+\.\d{2}\)?)/i.exec(String(text ?? "").replace(/\s+/g, " "));
  return m ? parseAmount(m[1]) : null;
}
/** Section headings that decide the sign of the rows under them (checking statements). */
const SECTION = [
  [/^(deposits?|credits?|deposits and (?:other )?(?:credits|additions)|additions|payments and (?:other )?credits|interest paid)\b/i, 1],
  [/^(withdrawals?|debits?|purchases?|payments?|checks?|fees?|charges?|electronic (?:withdrawals|payments)|other (?:withdrawals|debits)|card transactions|transactions)\b/i, -1],
  [/^(daily (?:ledger )?balances?|balance summary|interest charge calculation|year-to-date|rewards summary|important information)\b/i, 0],   // not transactions: skip until the next heading
];
const CREDIT_WORDS = /\b(payment|thank you|deposit|refund|credit|reversal|interest paid|transfer from|direct dep|payroll|cash back)\b/i;

/** A date that may lack a year: "09/02" -> the year of the period, rolling back when the month is after the period's end. */
export function dateWithYear(token, period) {
  const d = parseDate(token);
  if (d) return d;
  const s = String(token ?? "").trim();
  let m = /^(\d{1,2})[\/.-](\d{1,2})$/.exec(s), mo, day;
  if (m) { mo = +m[1]; day = +m[2]; }
  else { m = /^([a-z]{3,9})\.?\s+(\d{1,2})$/i.exec(s); if (!m || !MONTHS[m[1].slice(0, 3).toLowerCase()]) return null; mo = MONTHS[m[1].slice(0, 3).toLowerCase()]; day = +m[2]; }
  const end = period?.to ?? period?.from;
  if (!end) return null;
  let y = Number(String(end).slice(0, 4));
  if (mo > Number(String(end).slice(5, 7)) + 1) y--;                    // a December line on a January statement
  const iso = isoOf(y, mo, day);
  return isValidDate(iso) && iso === `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}` ? iso : null;
}
const readAmount = (tok) => { const s = String(tok).trim(); const cr = /\bCR$/i.test(s), dr = /\bDR$/i.test(s), trail = /-$/.test(s); const n = parseAmount(s.replace(/\s?(CR|DR|-)$/i, "")); if (n === null) return null; return cr ? Math.abs(n) : dr || trail ? -Math.abs(n) : n; };

/**
 * parseStatementText(text, { kind }) -> { rows: [{ date, description, amount, line }], period, closingBalance, sections, confidence }
 * kind: "card" (charges are money out unless they look like a payment/credit) or "bank" (sign from the section the line sits in,
 * else from the wording). Lines: DATE [DATE] DESCRIPTION AMOUNT [BALANCE]. Two amounts at the end = amount then running balance.
 * Multi-line descriptions: a line without a date that follows a row is appended to it (up to two).
 */
export function parseStatementText(text, { kind = "card" } = {}) {
  const period = findPeriod(text);
  const closingBalance = findClosingBalance(text);
  const rows = [];
  let sign = 0, sections = 0, last = null, extra = 0, pending = null, ignore = false;
  for (const raw of String(text ?? "").replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) { last = null; pending = null; continue; }
    for (const [re, s] of SECTION) if (re.test(line) && line.length < 60 && !LINE.test(line)) { ignore = s === 0; if (s) sign = s; sections++; last = null; pending = null; }
    if (ignore) continue;
    let m = LINE.exec(line);
    if (!m && pending) {
      const t = TAIL.exec(line);
      if (t && !/^\d/.test(line)) { m = [line, pending.date, null, `${pending.desc} ${t[1]}`.trim(), t[2], t[3]]; pending = null; }
      else if (!/^\d/.test(line) && pending.extra < 2) { pending.desc += " " + line; pending.extra++; continue; }
      else pending = null;
    }
    if (!m) {
      const h = HEAD.exec(line);
      if (h && !/total|balance/i.test(h[3])) { pending = { date: h[1], desc: h[3].trim(), extra: 0 }; last = null; continue; }
      if (last && extra < 2 && !/total|balance|page \d|continued/i.test(line) && !/^\d/.test(line)) { last.description += " " + line; extra++; }
      continue;
    }
    const date = dateWithYear(m[1], period);
    const desc = m[3].trim();
    let amount = readAmount(m[4]);
    if (date === null || amount === null || !desc) { last = null; continue; }
    if (!/[a-z]/i.test(desc) && !(sign < 0 && /^\d{3,6}$/.test(desc))) { last = null; continue; }   // numbers only: a balance line, unless it is a check number under "Checks"
    if (/^(total|subtotal|balance|beginning balance|ending balance|new balance|previous balance|minimum payment)/i.test(desc)) { last = null; continue; }
    const explicitSign = /^[-(]|\s?(CR|DR|-)$/i.test(m[4].trim());
    if (!explicitSign) {
      if (kind === "card") amount = CREDIT_WORDS.test(desc) ? Math.abs(amount) : -Math.abs(amount);
      else if (sign) amount = sign * Math.abs(amount);
      else amount = CREDIT_WORDS.test(desc) ? Math.abs(amount) : -Math.abs(amount);
    } else if (kind === "card" && !/CR$/i.test(m[4].trim()) && !/^\(/.test(m[4].trim())) {
      // a card statement printing "-640.22" for a payment: negative means a credit on cards
      amount = -amount;
    }
    last = { date, description: desc, amount: Math.round(amount * 100) / 100, line: line.slice(0, 160) };
    extra = 0;
    rows.push(last);
  }
  const confidence = rows.length === 0 ? 0 : Math.min(1, 0.4 + 0.1 * Math.min(6, rows.length)) * (period.to ? 1 : 0.8);
  return { rows, period, closingBalance, sections, confidence };
}

/** rows (from any reader) -> the shape the Import page understands: { date, payee, rawPayee, amount }. */
export const rowsToImport = (rows) => rows.map((r) => ({ date: r.date, rawPayee: r.description, payee: prettyPayee(r.description) || r.description, amount: r.amount }));

// ---------------------------------------------------------------- prompts for the models
const SCHEMA = `Answer with JSON only, no prose, exactly this shape:
{"period":{"from":"YYYY-MM-DD or null","to":"YYYY-MM-DD or null"},"closingBalance":number or null,
 "rows":[{"date":"YYYY-MM-DD","description":"text as printed","amount":number}]}
Sign rule: money leaving the account (purchases, withdrawals, fees, checks) is NEGATIVE; money arriving (deposits, payments received, refunds, interest) is POSITIVE. Never invent rows; skip totals, balances and summaries. Use the statement period to fill in years that are not printed.`;
export function buildTextPrompt(text, { kind = "card" } = {}) {
  return {
    system: `You read ${kind === "card" ? "credit card" : "bank"} statements and list every transaction line. ${SCHEMA}`,
    user: `Statement text:\n\n${String(text ?? "").slice(0, 24000)}`,
  };
}
export function buildVisionPrompt({ kind = "card", page = 1, pages = 1 } = {}) {
  return {
    system: `You read pictures of ${kind === "card" ? "credit card" : "bank"} statements and list every transaction line you can see. ${SCHEMA}`,
    user: `This is page ${page} of ${pages}. List the transactions on this page.`,
  };
}
/**
 * The model's answer -> { rows, period, closingBalance, dropped }; rows with a bad date or amount are dropped and counted.
 * For card statements the sign is settled by the wording, whatever the model wrote: charges are money out, payments,
 * refunds and credits are money in (models sometimes copy a printed minus instead of applying the rule).
 */
export function parseModelRows(text, { kind = null } = {}) {
  const empty = { rows: [], period: { from: null, to: null }, closingBalance: null, dropped: 0 };
  const m = /\{[\s\S]*\}/.exec(String(text ?? ""));
  if (!m) return empty;
  let j; try { j = JSON.parse(m[0]); } catch { return empty; }
  const period = { from: parseDate(j.period?.from) ?? null, to: parseDate(j.period?.to) ?? null };
  let dropped = 0;
  const rows = [];
  for (const r of Array.isArray(j.rows) ? j.rows : []) {
    const date = parseDate(r?.date) ?? dateWithYear(r?.date, period);
    const amount = typeof r?.amount === "number" ? r.amount : parseAmount(r?.amount);
    const description = String(r?.description ?? "").trim();
    if (!date || amount === null || !description) { dropped++; continue; }
    const signed = kind === "card" ? (CREDIT_WORDS.test(description) ? Math.abs(amount) : -Math.abs(amount)) : amount;
    rows.push({ date, description, amount: Math.round(signed * 100) / 100 });
  }
  return { rows, period, closingBalance: typeof j.closingBalance === "number" ? j.closingBalance : parseAmount(j.closingBalance), dropped };
}

/** compute(plan) -> what the page needs up front: accounts and past statement imports. */
export function compute(plan) {
  const accounts = (plan.accounts ?? []).map((a) => ({ id: a.id, name: a.name, type: a.type }));
  const imports = [...(plan.imports ?? [])].filter((i) => i.method).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { accounts, imports, total: (plan.transactions ?? []).length };
}
