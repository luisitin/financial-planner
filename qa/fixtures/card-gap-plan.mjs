// qa/fixtures/card-gap-plan.mjs -- the sample family back after three months (2026-11-02), for the tests of card files and
// gaps between bank files (2026-11-02). Chase checking (a-chk) has July's lines from last time with no import record (the last
// on 7/30), then one 90-day file imported today covering 8/3 to 11/1 (an import record), so 7/31 to 8/2 is a hole: the
// mortgage of the 2nd and a paycheck of the 1st are missing from August. The Visa card (a-visa, credit) has no lines at all;
// its autopays from checking (7/14 $640.22, 8/14 $2,450.22, 9/14 $2,980.55, 10/14 $2,610.30) are filed as transfers, so its
// purchases are missing from spending. Lines are built with their categories filed, as the owner filed them; invented data.
import { familyPlan } from "./family-plan.mjs";

/** The 90-day checking file's lines (Aug 3 to Nov 1 2026): [date, bank description, amount, category]. */
export function ninetyDays() {
  const rows = [];
  const add = (iso, desc, amt, category) => { if (amt) rows.push([iso, desc, Math.round(amt * 100) / 100, category]); };
  let i = 0;
  for (let t = Date.UTC(2026, 7, 3); t <= Date.UTC(2026, 10, 1); t += 864e5, i++) {
    const d = new Date(t), day = d.getUTCDate(), dow = d.getUTCDay(), m = d.getUTCMonth(), iso = d.toISOString().slice(0, 10);
    if (dow === 5 && Math.floor((t - Date.UTC(2026, 7, 7)) / 864e5) % 14 === 0) add(iso, "ACME CORP PAYROLL PPD ID: 1234567", 2888, "income-salary");
    if (day === 1) add(iso, "BRIGHTWAY DESIGN PAYROLL PPD ID: 9988776", 4542, "income-salary");
    if (day === 2) add(iso, "WELLS FARGO HOME MTG AUTO PAY", -1980, "housing");
    if (day === 5) add(iso, "DAYTON POWER & LIGHT WEB PMT", -(m === 7 ? 212.4 : m === 8 ? 188.1 : 141.75), "utilities");
    if (day === 9) add(iso, "CITY OF DAYTON WATER", -58.2, "utilities");
    if (day === 10) add(iso, "COMCAST CABLE COMM 800-COMCAST", -165, "phone");
    if (day === 12) add(iso, "TOYOTA MOTOR CREDIT PMT", -410, "debt");
    if (day === 14) add(iso, "CHASE CREDIT CRD AUTOPAY PPD ID: 4760039224", -(m === 7 ? 2450.22 : m === 8 ? 2980.55 : 2610.3), "transfer");
    if (day === 21) add(iso, "NETFLIX.COM 866-579-7172 CA", -15.49, "subscriptions");
    if (day === 22) add(iso, "SPOTIFY USA", -11.99, "subscriptions");
    if (day === 3 && m === 7) add(iso, "LITTLE STARS DAYCARE ACH", -1150, "childcare");
    if (day === 3 && m > 7) add(iso, "YMCA AFTERSCHOOL DAYTON", -450, "childcare");
    if (dow === 6) add(iso, "KROGER #0421 DAYTON OH", -(180 + (i * 37) % 90 + 0.37), "groceries");
    if (dow === 3) add(iso, "SHELL OIL 57442 DAYTON OH", -(38 + (i * 13) % 20), "transport");
    if (dow === 0 && i % 2 === 0) add(iso, "CHIPOTLE 2231 DAYTON OH", -46.8, "dining");
    if (day === 16) add(iso, `Online Transfer to SAV ...5566 transaction#: ${9900 + i}`, -400, "transfer");
    if (day === 28 && m === 8) add(iso, "FIRESTONE AUTO CARE 0412", -1184.62, "transport");
    if (day === 19 && m === 9) add(iso, "TARGET 00012345 DAYTON OH", -132.44, "shopping");
    if (day === 8 && m === 8) add(iso, "ATM WITHDRAWAL 000123 MAIN ST", -100, "other");
    if (day === 25 && m === 9) add(iso, "Zelle payment from Bo Rivera 2210", 600, "transfer");
  }
  return rows;
}

/** July's lines from last time (no import record): [date, payee, amount, category]. */
export const JULY = [
  ["2026-07-01", "Acme Corp Payroll", 1950, "income-salary"], ["2026-07-15", "Acme Corp Payroll", 1950, "income-salary"], ["2026-07-29", "Acme Corp Payroll", 1950, "income-salary"],
  ["2026-07-01", "Bo employer payroll", 4542, "income-salary"], ["2026-07-02", "Wells Fargo mortgage", -1980, "housing"],
  ["2026-07-06", "Kroger", -212.4, "groceries"], ["2026-07-13", "Kroger", -198.1, "groceries"], ["2026-07-20", "Kroger", -230, "groceries"], ["2026-07-27", "Kroger", -205.5, "groceries"],
  ["2026-07-10", "Comcast", -165, "phone"], ["2026-07-12", "Toyota Financial", -410, "debt"], ["2026-07-14", "Chase credit card autopay", -640.22, "transfer"],
  ["2026-07-18", "Shell", -48, "transport"], ["2026-07-21", "Netflix", -15.49, "subscriptions"], ["2026-07-30", "Blue Bottle Cafe", -85, "dining"],
];

/**
 * withVisaFile(plan, from, to) -> the plan with a Visa file imported for those days (review of 2026-11-02): a $30 dinner every
 * day, and the card's own line for each checking autopay that falls in them (the next day, money in, filed as a transfer), with
 * its import record. Late start: withVisaFile(p, "2026-08-20", "2026-10-31"); early stop: withVisaFile(p, "2026-08-20", "2026-09-19").
 */
export function withVisaFile(p, from, to) {
  const pays = new Map(p.transactions.filter((t) => t.accountId === "a-chk" && /\b(CRD|CARD) AUTOPAY\b/i.test(t.rawPayee ?? "")).map((t) => [new Date(Date.parse(`${t.date}T00:00:00Z`) + 864e5).toISOString().slice(0, 10), -t.amount]));
  let n = 0;
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 864e5) {
    const d = new Date(t).toISOString().slice(0, 10);
    p.transactions.push({ id: `v-${from}-${++n}`, date: d, amount: -30, payee: "Olive Garden", rawPayee: "OLIVE GARDEN 0415", accountId: "a-visa", category: "dining", tags: [], note: "", importId: `imp-visa-${from}` });
    if (pays.has(d)) p.transactions.push({ id: `v-${from}-${++n}`, date: d, amount: pays.get(d), payee: "Automatic Payment Thank", rawPayee: "AUTOMATIC PAYMENT - THANK", accountId: "a-visa", category: "transfer", tags: [], note: "", importId: `imp-visa-${from}` });
  }
  p.imports.push({ id: `imp-visa-${from}`, at: "2026-11-02T18:00:00.000Z", accountId: "a-visa", fileName: "visa.csv", rows: n, added: n, skipped: 0, bad: 0, from, to });
  return p;
}

/** cardGapPlan(today) -> the plan; `{ withFile: false }` leaves the 90-day file out (the plan just before it was imported). */
export function cardGapPlan(today = "2026-11-02", { withFile = true } = {}) {
  const p = familyPlan(today);
  p.transactions = JULY.map(([date, payee, amount, category], n) => ({ id: `j${n + 1}`, date, amount, payee, rawPayee: payee.toUpperCase(), accountId: "a-chk", category, tags: [], note: "" }));
  p.imports = [];
  if (!withFile) return p;
  const cap = (s) => s.toLowerCase().replace(/[^a-z ]+/g, " ").trim().split(/\s+/).slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  ninetyDays().forEach(([date, raw, amount, category], n) => p.transactions.push({ id: `c${n + 1}`, date, amount, payee: cap(raw), rawPayee: raw, accountId: "a-chk", category, tags: [], note: "", importId: "imp-chase" }));
  p.imports.push({ id: "imp-chase", at: `${today}T17:35:00.000Z`, accountId: "a-chk", fileName: "chase-90days.csv", rows: 76, added: 76, skipped: 0, bad: 0, from: "2026-08-03", to: "2026-11-01" });
  return p;
}

/** noCardFromAug(p) -> the plan without the card: the Visa account, its debt and its autopays gone, lines from 8/1 on (re-check 4). */
export function noCardFromAug(p) {
  p.accounts = p.accounts.filter((a) => a.type !== "credit");
  p.debts = (p.debts ?? []).filter((d) => d.accountId !== "a-visa");
  p.transactions = p.transactions.filter((t) => t.date >= "2026-08-01" && !/CRD AUTOPAY/.test(t.rawPayee ?? ""));
  return p;
}
/**
 * oneFileAMonth(p, accountId) -> the plan with that account's imported lines as one file per calendar month, each record from its
 * first to its last line (what the Import page writes: fileFrom/fileTo), instead of one long file (re-check 4).
 */
export function oneFileAMonth(p, accountId) {
  const mine = p.transactions.filter((t) => t.accountId === accountId && t.importId).sort((a, b) => a.date.localeCompare(b.date));
  p.imports = (p.imports ?? []).filter((im) => im.accountId !== accountId);
  for (const ym of [...new Set(mine.map((t) => t.date.slice(0, 7)))]) {
    const lines = mine.filter((t) => t.date.slice(0, 7) === ym), id = `imp-${accountId}-${ym}`;
    for (const t of lines) t.importId = id;
    p.imports.push({ id, at: `${ym}-28T10:00:00.000Z`, accountId, fileName: `${ym}.csv`, rows: lines.length, added: lines.length, skipped: 0, bad: 0, from: lines[0].date, to: lines[lines.length - 1].date });
  }
  return p;
}
/** A bank line on one account, filed (re-check 4 tests). */
export const bankLine = (id, date, amount, rawPayee, accountId, category, extra = {}) => ({ id, date, amount, payee: rawPayee, rawPayee, accountId, category, tags: [], note: "", ...extra });
/** An account (re-check 4 tests). */
export const anAccount = (id, name, type, institution, today = "2026-11-02") => ({ id, name, type, institution, balance: 1000, asOf: today, ownerId: "", history: [] });
