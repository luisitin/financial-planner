// modules/transactions/import/camt.js -- PURE, dependency-free but for core/ofx.js's text helpers (no DOMParser: it does
// not exist in Node). Reads the bank statement file European banks give: ISO 20022 "bank to customer statement",
// camt.053 (gap list, next 60, item 43, 2026-11-14), and the same entries in its two siblings, the day report camt.052 and
// the notice camt.054. Written for this app from the element names of the ISO 20022 schemas camt.053.001.02, .08 and .13
// (README "QIF and CAMT.053 files" says where they were read); no code copied from any parser.
//
//   isCamt(text)       -> true for an ISO 20022 cash statement, report or notice (its root element or namespace)
//   readXml(text)      -> { root, complete }: a small tolerant reader for this one shape of XML (prefixes and namespaces
//                         dropped, entities and CDATA decoded, comments and declarations passed over, a file cut short read
//                         as far as it is whole)
//   parseCamt(text)    -> { ok, complete, org, version, accounts: [{ kind, last4, currency, balance, balanceDate, from, to,
//                         rows, bad, pending, zero }], investment: false }, the shape core/ofx parseOfx gives
// The account's own number (IBAN or other id) never leaves parseCamt: an account carries its last 4 only, a line's bank
// reference leaves only as a one-way id (lineId), and account numbers are taken out of every text.
import { decodeEntities, lineId, scrubNumbers } from "../../../core/ofx.js";

const HEAD = 4096;
const ROOTS = ["BkToCstmrStmt", "BkToCstmrAcctRpt", "BkToCstmrDbtCdtNtfctn"];
/** An ISO 20022 statement (camt.053), report (camt.052) or notice (camt.054): its message element or its namespace. */
export function isCamt(text) {
  const head = String(text ?? "").slice(0, HEAD).replace(/^﻿/, "");
  return /<([A-Za-z_][\w.\-]*:)?(BkToCstmrStmt|BkToCstmrAcctRpt|BkToCstmrDbtCdtNtfctn)[\s>\/]/.test(head) || /urn:iso:std:iso:20022:tech:xsd:camt\.05[234]\./i.test(head);
}

/**
 * readXml(text) -> { root, complete }. Each element is { name (its prefix dropped: "ns2:Ntry" is "Ntry"), attrs ({ name:
 * value }, prefixes dropped, entities decoded), kids, text (its own text, entities left for txt()), closed }. A closing tag
 * pops back to the open element it names (one never opened is passed over); "<x/>" is an empty element. Comments,
 * processing instructions and a DOCTYPE are passed over; CDATA is text. `complete`: every element was closed (a file cut
 * short leaves some open; their closed elements are still read).
 */
export function readXml(text) {
  const s = String(text ?? "").replace(/^﻿/, "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (all, t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[^>]*>/gi, "");
  const root = { name: "#", attrs: {}, kids: [], text: "", closed: true };
  const stack = [root];
  for (const m of s.matchAll(/<(\/?)(?:[A-Za-z_][\w.\-]*:)?([A-Za-z_][\w.\-]*)((?:\s+[^\s=<>\/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g)) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) { top.text += m[5]; continue; }
    const name = m[2];
    if (m[1]) {
      const at = stack.map((n) => n.name).lastIndexOf(name);
      if (at > 0) { stack[at].closed = true; stack.length = at; }
      continue;
    }
    const attrs = {};
    for (const a of (m[3] ?? "").matchAll(/(?:[^\s=:]+:)?([^\s=:]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decodeEntities(a[2] ?? a[3] ?? "");
    const node = { name, attrs, kids: [], text: "", closed: !!m[4] };
    top.kids.push(node);
    if (!m[4]) stack.push(node);
  }
  return { root, complete: stack.length === 1 && root.kids.length > 0 };
}
const kid = (n, name) => n?.kids?.find((k) => k.name === name) ?? null;
const kids = (n, name) => n?.kids?.filter((k) => k.name === name) ?? [];
const at = (n, path) => path.split("/").reduce((x, p) => kid(x, p), n);
const txt = (n) => (n ? decodeEntities(n.text).replace(/\s+/g, " ").trim() : "");
const val = (n, path) => txt(at(n, path)) || null;
function find(n, names, out = []) {
  for (const k of n?.kids ?? []) { if (names.includes(k.name)) out.push(k); else find(k, names, out); }
  return out;
}
/** "YYYY-MM-DD" from a date or a date-time ("2026-01-15", "2026-01-15T09:30:00+01:00"), a day that exists; else null. */
const isoDay = (s) => {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  return y >= 1970 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(Date.UTC(y, mo, 0)).getUTCDate() ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
/** A date element's day: its Dt, else its DtTm. */
const dayOf = (n) => isoDay(val(n, "Dt") ?? val(n, "DtTm"));
/** An amount: a decimal 0 or more (the schema's ActiveOrHistoricCurrencyAndAmount); anything else is no amount. */
const amountOf = (n) => { const t = txt(n); return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null; };
/** CRDT -> 1 (money in), DBIT -> -1 (money out), else 0 (not said). */
const signOf = (s) => ({ CRDT: 1, DBIT: -1 })[String(s ?? "").trim().toUpperCase()] ?? 0;
// an IBAN in a text (the other party's, in a payment's words): 2 letters, 2 digits, then groups of letters and digits
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g;
// Acct/Tp/Cd (the ISO external code list for cash accounts): savings, money market and deposits are savings; a loan is a debt
const SAVINGS = new Set(["SVGS", "LLSV", "ONDP", "MOMA"]);
const kindOf = (acct) => {
  const c = (val(acct, "Tp/Cd") ?? val(acct, "Tp/Prtry") ?? "").toUpperCase();
  return SAVINGS.has(c) ? "savings" : c === "LOAN" ? "other debt" : c === "CARD" ? "card" : "checking";
};
const NOT_BOOKED = (s) => s !== "BOOK";

/**
 * parseCamt(text) -> { ok, complete, org, version, accounts, investment: false }.
 * Every statement (Stmt; a report's Rpt and a notice's Ntfctn alike) is read; statements of one account (the same IBAN or
 * other id, compared here and never returned: a bank's monthly file often holds one statement a day) are one account:
 * kind (Acct/Tp/Cd: savings, other debt, card, else checking), last4 (of the id), currency (Acct/Ccy, else the entries'
 * Ccy), balance and balanceDate (the latest closing booked balance, Bal of type CLBD: Amt, negative when its CdtDbtInd is
 * DBIT, as of its Dt), from and to (the earliest FrDtTm and the latest ToDtTm), rows and bad as parseOfx's, pending
 * (entries not booked yet: Sts other than BOOK, left out) and zero (entries for 0.00, which move no money: left out; fix
 * round, F4).
 * An entry (Ntry) is one row: date (BookgDt, else ValDt), amount (Amt, minus for DBIT; a reversal's CdtDbtInd already
 * says which way its money went), fitid (lineId of AcctSvcrRef, else NtryRef, else the only TxDtls's Refs/AcctSvcrRef,
 * with the booking day: a NtryRef can be a running number within one day's statement; the second entry of one statement
 * with the same reference and day adds "|2", the third "|3": two entries are two lines, fix round F5, while the same
 * statement read again gives the same ids), payee (the other party: for money
 * out Cdtr, else UltmtCdtr; for money in Dbtr, else UltmtDbtr; Nm or Pty/Nm; else the text), memo (the text: RmtInf
 * Ustrd lines, else its Strd reference, else AddtlTxInf, else AddtlNtryInf), named (the payee is a name, not words),
 * parts (how many payments it holds: two or
 * more TxDtls, or a batch's NbOfTxs) and note (the payments, "3 payments: Ana Ruiz 120.00, Ben Okafor 80.00, Kim Ito
 * 50.00.", 10 at most). An entry never closed in a file cut short is dropped. org: the first account's bank
 * (Acct/Svcr/FinInstnId/Nm). version: "053", "052" or "054".
 */
export function parseCamt(text) {
  const { root, complete } = readXml(text);
  const groups = find(root, ROOTS);
  const version = groups[0] ? { BkToCstmrStmt: "053", BkToCstmrAcctRpt: "052", BkToCstmrDbtCdtNtfctn: "054" }[groups[0].name] : null;
  const statements = groups.flatMap((g) => [...kids(g, "Stmt"), ...kids(g, "Rpt"), ...kids(g, "Ntfctn")]);
  const idOf = (st) => val(kid(st, "Acct"), "Id/IBAN") ?? val(kid(st, "Acct"), "Id/Othr/Id") ?? "";
  const ids = [...new Set(statements.map(idOf).filter(Boolean))];
  const clean = (s) => scrubNumbers(String(s ?? ""), ids).replace(IBAN, "...").replace(/\s+/g, " ").trim();
  const byId = new Map();
  let org = null;
  for (const st of statements) {
    const acct = kid(st, "Acct"), key = idOf(st).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    let a = byId.get(key);
    if (!a) {
      a = { kind: kindOf(acct), last4: key.slice(-4), currency: (val(acct, "Ccy") ?? "").toUpperCase() || null, balance: null, balanceDate: null, from: null, to: null, rows: [], bad: [], pending: 0, zero: 0, n: 0 };
      byId.set(key, a);
      org ??= val(acct, "Svcr/FinInstnId/Nm");
    }
    const from = isoDay(val(st, "FrToDt/FrDtTm")), to = isoDay(val(st, "FrToDt/ToDtTm"));
    if (from && (!a.from || from < a.from)) a.from = from;
    if (to && (!a.to || to > a.to)) a.to = to;
    for (const b of kids(st, "Bal")) {
      if ((val(b, "Tp/CdOrPrtry/Cd") ?? "").toUpperCase() !== "CLBD" || (!b.closed && !complete)) continue;   // (cut inside it: its figure may be half a number)
      const amt = amountOf(kid(b, "Amt")), d = dayOf(kid(b, "Dt")), sign = signOf(val(b, "CdtDbtInd"));
      if (amt === null || !d || !sign) continue;
      if (!a.balanceDate || d >= a.balanceDate) { a.balance = sign * amt; a.balanceDate = d; }
      a.currency ??= (kid(b, "Amt").attrs.Ccy ?? "").toUpperCase() || null;
    }
    const seen = new Map();   // reference|day -> how many entries of this statement had it
    for (const e of kids(st, "Ntry")) {
      a.n++;
      if (!e.closed && !complete) continue;   // cut short inside this entry: its amount may be half a number
      const sts = (val(e, "Sts/Cd") ?? val(e, "Sts/Prtry") ?? val(e, "Sts") ?? "BOOK").toUpperCase();
      if (NOT_BOOKED(sts)) { a.pending++; continue; }
      const date = dayOf(kid(e, "BookgDt")) ?? dayOf(kid(e, "ValDt"));
      const amt = amountOf(kid(e, "Amt")), sign = signOf(val(e, "CdtDbtInd"));
      if (!date) { a.bad.push({ row: a.n, why: "no date" }); continue; }
      if (amt === null || !sign) { a.bad.push({ row: a.n, why: "no amount" }); continue; }
      if (Math.round(amt * 100) === 0) { a.zero++; continue; }
      a.currency ??= (kid(e, "Amt").attrs.Ccy ?? "").toUpperCase() || null;
      const tx = kids(e, "NtryDtls").flatMap((d) => kids(d, "TxDtls"));
      const ref = val(e, "AcctSvcrRef") ?? val(e, "NtryRef") ?? (tx.length === 1 ? val(tx[0], "Refs/AcctSvcrRef") : null);
      const party = (t, out) => { for (const side of out ? ["Cdtr", "UltmtCdtr"] : ["Dbtr", "UltmtDbtr"]) { const nm = val(t, `RltdPties/${side}/Nm`) ?? val(t, `RltdPties/${side}/Pty/Nm`); if (nm) return clean(nm); } return ""; };
      const words = (t) => clean(kids(kid(t, "RmtInf"), "Ustrd").map(txt).filter(Boolean).join(" ") || val(t, "RmtInf/Strd/CdtrRefInf/Ref") || val(t, "AddtlTxInf") || "");
      const extra = clean(val(e, "AddtlNtryInf") ?? "");
      const twin = ref ? (seen.get(`${ref}|${date}`) ?? 0) + 1 : 0;
      if (ref) seen.set(`${ref}|${date}`, twin);
      const row = { date, amount: Math.round(sign * amt * 100) / 100, payee: "", memo: "", fitid: ref ? lineId(`${ref}|${date}${twin > 1 ? `|${twin}` : ""}`) : null, type: "", named: false, parts: 1, note: "" };
      if (tx.length >= 2) {
        // a batch: one line on the statement for several payments; its parts are said in its note
        const parts = tx.map((t) => { const s = signOf(val(t, "CdtDbtInd")) || sign; return { name: party(t, s < 0) || words(t) || "a payment", amount: amountOf(kid(t, "Amt")) ?? amountOf(at(t, "AmtDtls/TxAmt/Amt")) ?? amountOf(at(t, "AmtDtls/InstdAmt/Amt")) }; });
        const names = [...new Set(parts.map((p) => p.name))];
        row.payee = names.length === 1 ? names[0] : extra || `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}`;
        row.named = names.length === 1 || !extra;
        row.memo = extra && extra !== row.payee ? extra : "";
        row.parts = tx.length;
        row.note = `${tx.length} payments: ${parts.slice(0, 10).map((p) => (p.amount !== null ? `${p.name} ${p.amount.toFixed(2)}` : p.name)).join(", ")}${tx.length > 10 ? `, and ${tx.length - 10} more` : ""}.`;
      } else {
        const t = tx[0] ?? null, name = t ? party(t, sign < 0) : "", w = (t ? words(t) : "") || extra;
        row.payee = name || w;
        row.named = !!name;
        row.memo = name ? w : "";
        row.note = name ? w : "";
        const many = Number(val(kid(e, "NtryDtls"), "Btch/NbOfTxs"));
        if (Number.isInteger(many) && many >= 2) { row.parts = many; row.note = [row.note, `A batch of ${many} payments.`].filter(Boolean).join(" "); }
      }
      a.rows.push(row);
    }
  }
  const accounts = [...byId.values()].map(({ n, ...a }) => a);
  return { ok: accounts.length > 0, complete, org, version, accounts, investment: false };
}
