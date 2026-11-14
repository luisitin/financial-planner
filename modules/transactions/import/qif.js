// modules/transactions/import/qif.js -- PURE, dependency-free but for core/ofx.js's text helpers. Reads a Quicken
// Interchange Format file (QIF): the text file older Quicken, Microsoft Money and many banks still write (gap list,
// next 60, item 43, 2026-11-14). Written for this app from the QIF field codes (D date, T and U amount, P payee, M memo,
// L category or [account], N number, C cleared, A address, S/E/$ a split's category, memo and amount, ^ end of record)
// and section headers (!Type:Bank, !Type:CCard, !Type:Cash, !Type:Oth A, !Type:Oth L, !Type:Invst, !Account,
// !Option:AutoSwitch); no code copied from any parser (README "QIF and CAMT.053 files" says where they were checked).
//
//   isQif(text)            -> true for a file whose first line is a QIF header (decided by content, never by the name)
//   qifDate(s, order)      -> "YYYY-MM-DD" from 1/15/26, 1/15'26, 01/15/2026, " 6/ 1/94", 15.01.26 (order "MDY" | "DMY"),
//                             2026-01-15 or 20260115, or null
//   qifDateOrder(samples)  -> "MDY" | "DMY", decided from the file's own dates only
//   qifDateCheck(samples)  -> { order, sure, sample }: that order, and whether the file settles it (else the page asks)
//   qifAmount(s, mark)     -> a signed number from "-1,234.56", "1234.56", "-1.234,56", "12,50", "0,500", or null
//   qifDecimalMark(samples)-> "," | "." | null: the file's own decimal mark, when its amounts say
//   parseQif(text, opts)   -> { ok, complete, org: null, accounts: [{ kind, name, last4: "", currency: null, balance: null,
//                             balanceDate: null, from: null, to: null, rows, bad, left }], investment, dateOrder, dateCheck }
// The plan-aware part (a Quicken category to one of the plan's, the payee shown) is compute.js prepareQif's.
import { decodeEntities, scrubNumbers } from "../../../core/ofx.js";

const HEAD = 4096;
/** A QIF file, by what it holds: its first line is a header (!Type:..., !Account, !Option:..., !Clear:...). */
export function isQif(text) {
  const head = String(text ?? "").slice(0, HEAD).replace(/^﻿/, "");
  return /^\s*!(type\s*:|account\s*(\r?\n|$)|option\s*:|clear\s*:)/i.test(head);
}

// the section types that hold lines (the kind of account they are) and the one that holds investments
const KINDS = { bank: "bank", ccard: "card", "credit card": "card", creditcard: "card", cash: "cash", "oth a": "other asset", "oth l": "other debt" };
const INVEST = new Set(["invst", "invest", "investment", "port", "401(k)/403(b)"]);
const typeOf = (t) => { const k = String(t ?? "").trim().toLowerCase().replace(/\s+/g, " "); return KINDS[k] ?? (INVEST.has(k) ? "investment" : null); };

/**
 * qifDate(s, order) -> "YYYY-MM-DD" | null. Spaces are dropped first (Quicken pads with them: " 6/ 1/94", "1/ 5' 6").
 * Day and month in `order` ("MDY", the U.S. way, or "DMY"), then the year after "/", "-", "." or "'": four digits as
 * written; one or two after "'" are the 2000s (Quicken's mark for them: 1/15'26 is 2026); two after another separator are
 * 19xx from 70 up, else 20xx (6/1/94 is 1994, 1/15/26 is 2026). Also 2026-01-15 and 20260115. A day that does not exist,
 * or a year before 1970, is no date.
 */
export function qifDate(s, order = "MDY") {
  const t = String(s ?? "").replace(/\s+/g, "");
  let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) return day(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(t))) return day(+m[1], +m[2], +m[3]);
  if (!(m = /^(\d{1,2})[\/.\-](\d{1,2})(['\/.\-])(\d{1,4})$/.exec(t))) return null;
  const a = +m[1], b = +m[2], year = yearOf(m[4], m[3]);
  if (!year) return null;
  return order === "DMY" ? day(year, b, a) : day(year, a, b);
}
// the year after its mark: four digits as written; one or two after "'" the 2000s; two after another mark 19xx from 70 up
const yearOf = (y, mark) => (y.length === 4 ? +y : y.length <= 2 ? (mark === "'" ? 2000 + +y : +y >= 70 ? 1900 + +y : 2000 + +y) : null);
const day = (y, mo, d) => {
  if (y < 1970 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
// a slash, dash or dot date's two first numbers, its mark and the date as the page shows it in a question, its year in full
// ("10/ 1'26" -> [10, 1, "/", "10/1/2026"]); null for any other spelling
const parts = (s) => {
  const m = /^(\d{1,2})([\/.\-])(\d{1,2})(['\/.\-])(\d{1,4})$/.exec(String(s ?? "").replace(/\s+/g, ""));
  const y = m ? yearOf(m[5], m[4]) : null;
  return m ? [+m[1], +m[3], m[2], y ? `${m[1]}${m[2]}${m[3]}${m[2]}${y}` : null] : null;
};
/**
 * qifDateOrder(samples) -> "DMY" | "MDY", from the file's own dates only: a date whose first number is above 12 can only be
 * day first, one whose second number is above 12 only month first; the order more of them show wins (fix round, F1: before,
 * the first such date decided, so one stray "13/6/2026" among "11/1/2026" lines turned the whole file round). When none
 * tells, or as many tell each way, dots ("15.01.26", the European way of writing) mean day first, else month first
 * (Quicken's U.S. default).
 */
export function qifDateOrder(samples) {
  return qifDateCheck(samples).order;
}
/**
 * qifDateCheck(samples) -> { order, sure, sample }. `order`: qifDateOrder's. `sure`: the file settles it, so the page does
 * not ask: no date of the file reads two ways (each has a number above 12, or both numbers the same), or two or more dates
 * can only be read in that order and none the other way. Otherwise (fix round, F1 and F2: every date at most 12/12, one
 * stray date, dates that disagree) the page asks, with `sample`: the first date of the file that reads two ways, its spaces
 * dropped and its year in full ("10/ 1'26" -> "10/1/2026"; null when none does: then only dates that disagree make it
 * unsure).
 */
export function qifDateCheck(samples) {
  let dmy = 0, mdy = 0, dots = false, sample = null;
  for (const s of samples ?? []) {
    const p = parts(s);
    if (!p) continue;
    if (p[0] > 12 && p[1] <= 12) dmy++;
    else if (p[1] > 12 && p[0] <= 12) mdy++;
    else if (p[0] !== p[1] && p[0] >= 1 && p[1] >= 1 && p[0] <= 12 && p[1] <= 12 && sample === null && p[3] && qifDate(s, "MDY") && qifDate(s, "DMY")) sample = p[3];
    if (p[2] === ".") dots = true;
  }
  const order = dmy > mdy ? "DMY" : mdy > dmy ? "MDY" : dots ? "DMY" : "MDY";
  const sure = !(dmy && mdy) && (sample === null || dmy >= 2 || mdy >= 2);
  return { order, sure, sample: sure ? null : sample };
}
/**
 * qifAmount(s, mark) -> a number or null. "-1,234.56" and "1,234" (thousands commas), "1234.56", "-1.234,56" (dots between
 * thousands and a decimal comma), "12,50" (a decimal comma), a "$" or a space anywhere. A first group of "0" is never
 * thousands: "0,500" is a half (fix round, F3). `mark` (qifDecimalMark: the file's own, else null): in a file of decimal
 * commas "1.234" is a thousand and "1,234" one and a bit; in any other file "1.234" is one and a bit, as before.
 */
export function qifAmount(s, mark = null) {
  const t = String(s ?? "").replace(/[\s$€£]/g, "");
  if (!t) return null;
  const point = (x) => Number(x.replace(/,/g, "")), comma = (x) => Number(x.replace(/\./g, "").replace(",", "."));
  let n = null;
  if (mark === "," && /^[+-]?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) n = comma(t);
  else if ((mark !== "," && /^[+-]?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(t)) || /^[+-]?\d*\.?\d+$/.test(t) || /^[+-]?\d+\.$/.test(t)) n = point(t);
  else if (/^[+-]?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(t) || /^[+-]?\d+,\d{1,2}$/.test(t) || /^[+-]?0,\d+$/.test(t) || (mark === "," && /^[+-]?\d+,\d+$/.test(t))) n = comma(t);
  return n !== null && Number.isFinite(n) ? n : null;
}
/**
 * qifDecimalMark(samples) -> "," when some amount of the file ends in a comma and one or two digits ("12,50") and none in a
 * dot and one or two ("12.50"); "." the other way round; else null (the file does not say; qifAmount's own reading).
 */
export function qifDecimalMark(samples) {
  let comma = false, dot = false;
  for (const s of samples ?? []) { const t = String(s ?? "").replace(/[\s$€£]/g, ""); if (/,\d{1,2}$/.test(t)) comma = true; if (/\.\d{1,2}$/.test(t)) dot = true; }
  return comma && !dot ? "," : dot && !comma ? "." : null;
}

/** A line's text as kept: entities decoded (some programs write "&amp;"), spaces tidied, account numbers taken out. */
const clean = (s) => scrubNumbers(decodeEntities(String(s ?? "")).replace(/\s+/g, " ").trim(), []);
/** L or S as the category's own name: the class after "/" dropped ("Groceries/Family" -> "Groceries"). */
export const qifCategoryName = (s) => { const t = clean(s); const b = /^\[[^\]]*\]/.exec(t); return b ? b[0] : t.split("/")[0].trim(); };

/**
 * parseQif(text, { dateOrder }) -> { ok, complete, org, accounts, investment, dateOrder, dateCheck }. One account per line section (!Type:Bank,
 * CCard, Cash, Oth A, Oth L), named by the !Account block before it when there is one (`name`: its N line); a section of
 * the same type with no new !Account carries on the account before it. kind "bank" (QIF does not say checking or savings:
 * "savings" when the account's name says so), "card", "cash", "other asset" or "other debt".
 * rows: { date, amount (T, else U, else the sum of the split amounts; signed as Quicken writes it: money out negative, a
 * card's charges too), payee (P, else "Check <N>" for a check number, else M), memo (M), number (N when it is a check
 * number), category (L as its own name: "[Savings]" for a transfer), splits: [{ category, amount, memo }], fitid: null
 * (QIF has no bank id), type: "" }.
 * bad: [{ row, why: "no date" | "no amount" }] (row: the record's number in its section). left: [{ row, why }], Quicken's
 * "Opening Balance" record ("opening balance": its starting figure for the account, not money in or out) and a line for
 * 0.00 ("no money": a voided check, a note; it moves nothing; fix round, F4). `investment`: how many investment sections
 * (!Type:Invst) the file holds; they are never read as lines. `complete`: false when the file ends inside a record (no
 * closing "^"): that record is dropped, its amount may be cut. Lists (!Type:Cat, Class, Memorized, Prices, Security) and the
 * account list of !Option:AutoSwitch are passed over.
 * The dates' order (`dateOrder`): `opts.dateOrder` ("MDY" | "DMY", the person's answer on the page), else the file's own
 * (qifDateCheck, also returned as `dateCheck`: the page asks when the file does not settle it). The amounts are read with the
 * file's own decimal mark (qifDecimalMark over every T, U and $ line).
 */
export function parseQif(text, { dateOrder: asked = null } = {}) {
  const lines = String(text ?? "").replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const accounts = [];
  let investment = 0, section = null, cur = null, head = null, rec = null, inAccount = false, acctRec = null;
  const start = (kind) => {
    if (kind === "investment") { investment++; section = "invest"; cur = null; return; }
    section = "lines";
    const name = head?.N ? clean(head.N) : "";
    const last = accounts[accounts.length - 1];
    if (!head && last && last.kind === typeKind(kind, last.name) && cur === last) return;   // the same account carries on
    const k = typeKind(kind, name);
    cur = { kind: k, name, recs: [] };
    accounts.push(cur);
    head = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    if (line.trimStart()[0] === "!") {
      const h = line.trim().slice(1).trim().toLowerCase();
      rec = null;
      inAccount = false;
      if (/^(option|clear)\s*:\s*autoswitch/.test(h)) { section = null; head = null; continue; }
      if (/^account\b/.test(h)) { section = null; inAccount = true; acctRec = {}; continue; }
      const m = /^type\s*:\s*(.*)$/.exec(h);
      const kind = m ? typeOf(m[1]) : null;
      if (kind) start(kind); else { section = null; cur = null; }
      continue;
    }
    const code = line[0], value = line.slice(1);
    if (inAccount) {
      // an account block: its last record names the next line section (N its name, T its type)
      if (code === "^") { head = acctRec; acctRec = {}; } else if (!(code in acctRec)) acctRec[code] = value.trim();
      continue;
    }
    if (section !== "lines" && section !== "invest") continue;
    if (code === "^") { if (section === "lines" && rec) cur.recs.push(rec); rec = null; continue; }
    rec ??= { A: [], splits: [] };
    if (code === "S") rec.splits.push({ S: value, E: "", $: "" });
    else if ((code === "E" || code === "$" || code === "%") && rec.splits.length) rec.splits[rec.splits.length - 1][code] = value;
    else if (code === "A") rec.A.push(value);
    else if (!(code in rec)) rec[code] = value;
  }
  // a record still open at the end: the file stops in the middle of it (cut short)
  const complete = !(rec && (section === "lines" || section === "invest"));
  const dateCheck = qifDateCheck(accounts.flatMap((a) => a.recs.map((r) => r.D)));
  const dateOrder = asked === "MDY" || asked === "DMY" ? asked : dateCheck.order;
  const mark = qifDecimalMark(accounts.flatMap((a) => a.recs.flatMap((r) => [r.T, r.U, ...r.splits.map((x) => x.$)])));
  const out = accounts.map((a) => {
    const rows = [], bad = [], left = [];
    a.recs.forEach((r, n) => {
      const splits = r.splits.map((s) => ({ category: qifCategoryName(s.S), amount: qifAmount(s.$, mark), memo: clean(s.E) }));
      let amount = qifAmount(r.T, mark) ?? qifAmount(r.U, mark);
      if (amount === null && !String(r.T ?? r.U ?? "").trim() && splits.length && splits.every((s) => s.amount !== null)) amount = Math.round(splits.reduce((x, s) => x + s.amount * 100, 0)) / 100;
      const date = qifDate(r.D, dateOrder);
      const payee = clean(r.P), memo = clean(r.M), num = /^\s*\d{1,9}\s*$/.test(r.N ?? "") ? String(Number(r.N)) : "";
      if (/^opening balance$/i.test(payee)) { left.push({ row: n + 1, why: "opening balance" }); return; }
      if (!date) { bad.push({ row: n + 1, why: "no date" }); return; }
      if (amount === null) { bad.push({ row: n + 1, why: "no amount" }); return; }
      if (Math.round(amount * 100) === 0) { left.push({ row: n + 1, why: "no money" }); return; }
      rows.push({ date, amount, payee: payee || (num ? `Check ${num}` : "") || memo, memo, number: num, category: qifCategoryName(r.L), splits, fitid: null, type: "" });
    });
    return { kind: a.kind, name: a.name, last4: "", currency: null, balance: null, balanceDate: null, from: null, to: null, rows, bad, left };
  });
  return { ok: out.length > 0, complete, org: null, accounts: out, investment, dateOrder, dateCheck };
}
// QIF's "Bank" covers checking and savings alike: an account named for savings is savings
const typeKind = (kind, name) => (kind === "bank" && /\bsav(e|ings?)?\b/i.test(String(name ?? "")) ? "savings" : kind);
