// modules/transactions/import/compute.js -- PURE. Turn a bank's CSV into transactions:
// find which column is the date, the description and the amount (or debit/credit), read
// dates and money in the formats banks use, drop lines already on file, and apply the rules.
// The view only reads the file and shows the preview; everything decidable is here.
import { parseCsv } from "../../../core/csv.js";
import { isValidDate, isoOf } from "../../../core/math/dates.js";
import { applyRules, prettyPayee } from "../rules/compute.js";
import { txKey, coverageByAccount, usualInDays, usualWords } from "../ledger/compute.js";
import { isLiability } from "../../balance/net-worth/compute.js";
// the account's usual payments due in some days: one test, in the ledger, for its holes, this page's warning and the Monthly
// review's "nothing happened" button (re-check 4, 2026-11-02)
export { usualInDays };

// ---------------------------------------------------------------- detection
const H = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const DATE_NAMES = ["date", "posted", "posting date", "transaction date", "trans date", "post date", "datum", "fecha", "booking date", "value date"];
const DESC_NAMES = ["description", "memo", "payee", "name", "merchant", "details", "transaction", "narrative", "text", "concepto", "beschreibung", "original description"];
const AMOUNT_NAMES = ["amount", "transaction amount", "betrag", "importe", "value", "sum"];
const DEBIT_NAMES = ["debit", "withdrawal", "withdrawals", "money out", "paid out", "charge", "outflow", "spent"];
const CREDIT_NAMES = ["credit", "deposit", "deposits", "money in", "paid in", "inflow", "received"];
const TYPE_NAMES = ["type", "transaction type", "debit credit", "dr cr", "cr dr", "details"];
const TYPE_WORD = /^(debit|credit|dr|cr|d|c|withdrawal|deposit|debit card|ach|check|fee|payment|purchase)$/i;
const scoreName = (h, names) => { const x = H(h); return names.some((n) => x === n) ? 3 : names.some((n) => x.includes(n)) ? 2 : 0; };

/** The share of sample cells that read as a date / a money amount. */
const sampleScore = (rows, i, fn) => { const cells = rows.slice(0, 25).map((r) => r[i]).filter((c) => c !== undefined && c !== ""); return cells.length ? cells.filter((c) => fn(c) !== null).length / cells.length : 0; };
/** A column of a few repeated words (DEBIT / CREDIT) is a type column, never a description. */
const looksLikeType = (rows, i) => { const cells = rows.slice(0, 50).map((r) => String(r[i] ?? "").trim()).filter(Boolean); if (cells.length < 2) return false; const distinct = new Set(cells.map((c) => c.toLowerCase())).size; return cells.every((c) => TYPE_WORD.test(c)) || (cells.length >= 5 && distinct / cells.length < 0.3 && cells.every((c) => c.length <= 12 && !/\d/.test(c))); };

/** Some banks (Wells Fargo) export no header row. If the "header" has a date and an amount in it, it is data. */
export function parseBankCsv(text) {
  const parsed = parseCsv(text);
  const h = parsed.headers;
  if (h.length >= 2 && h.some((c) => parseDate(c) !== null) && h.some((c) => parseAmount(c) !== null && parseDate(c) === null)) {
    return { ...parsed, headers: h.map((_, i) => `Column ${i + 1}`), rows: [h, ...parsed.rows], headerless: true };
  }
  return { ...parsed, headerless: false };
}

/**
 * detectMapping(headers, rows) -> { date, payee, amount, debit, credit, type, dateOrder }
 * Column indexes (or null). `amount` is a single signed column; `debit`/`credit` are the
 * two-column style; `type` is a DEBIT/CREDIT column that gives the sign to a positive amount.
 */
export function detectMapping(headers, rows) {
  const best = (names, fn, exclude = []) => {
    let top = { i: null, s: 0 };
    headers.forEach((h, i) => { if (exclude.includes(i)) return; const s = scoreName(h, names) + (fn ? sampleScore(rows, i, fn) : 0); if (s > top.s) top = { i, s }; });
    return top.s >= 1 ? top.i : null;
  };
  const date = best(DATE_NAMES, (c) => parseDate(c));
  const debit = best(DEBIT_NAMES, null, [date]);
  const credit = best(CREDIT_NAMES, null, [date, debit]);
  const amount = debit !== null && credit !== null ? null : best(AMOUNT_NAMES, (c) => parseAmount(c), [date, debit, credit]);
  const typeCols = headers.map((_, i) => i).filter((i) => ![date, debit, credit, amount].includes(i) && looksLikeType(rows, i));
  let type = best(TYPE_NAMES, null, [date, debit, credit, amount]);   // a named type column, else the first that looks like one
  if (type === null && typeCols.length) type = typeCols[0];
  // a signed amount column (any negative value) already says which way the money went: ignore the type column then
  if (type !== null && amount !== null && rows.some((r) => (parseAmount(r[amount]) ?? 0) < 0)) type = null;
  const taken = [date, debit, credit, amount, type, ...typeCols];
  const payee = best(DESC_NAMES, null, taken) ?? headers.findIndex((h, i) => !taken.includes(i) && sampleScore(rows, i, (c) => /[a-z]{3}/i.test(c) ? c : null) > 0.8);
  return { date, payee: payee >= 0 ? payee : null, amount, debit, credit, type, dateOrder: guessDateOrder(rows.map((r) => r[date])) };
}
/** "MDY" or "DMY" from a column of dates: if any first number is > 12 it is a day. */
export function guessDateOrder(samples) {
  for (const s of samples ?? []) { const m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-]\d{2,4}/.exec(String(s ?? "").trim()); if (m) { if (Number(m[1]) > 12) return "DMY"; if (Number(m[2]) > 12) return "MDY"; } }
  return "MDY";
}

// ---------------------------------------------------------------- values
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
/** Read a date cell into "YYYY-MM-DD"; null if it is not a date. `order` is MDY (US) or DMY. */
export function parseDate(cell, order = "MDY") {
  const s = String(cell ?? "").trim();
  let m;
  if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s))) return check(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/.exec(s))) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return order === "DMY" ? check(y, +m[2], +m[1]) : check(y, +m[1], +m[2]); }
  if ((m = /^(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})/i.exec(s)) && MONTHS[m[2].slice(0, 3).toLowerCase()]) return check(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  if ((m = /^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/i.exec(s)) && MONTHS[m[1].slice(0, 3).toLowerCase()]) return check(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return check(+m[1], +m[2], +m[3]);
  return null;
}
const check = (y, mo, d) => { const iso = isoOf(y, mo, d); return y >= 1970 && y <= 2100 && isValidDate(iso) && iso === `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` ? iso : null; };
/** Read a money cell: "$1,234.56", "-12.00", "(12.00)" (negative), "12,34" (European), "1.234,56". null if empty or not a number. */
export function parseAmount(cell) {
  let s = String(cell ?? "").trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/^-/.test(s) || /-$/.test(s)) { neg = !neg; s = s.replace(/^-|-$/g, ""); }
  if (/^\+/.test(s)) s = s.slice(1);
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");   // 1.234,56 or 12,34
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}
const isDebitWord = (v) => /^(d|dr|db|debit|withdrawal|withdraw|payment|purchase|charge|out|sent|wd|w)\b/i.test(String(v ?? "").trim()) && !/^dep/i.test(String(v ?? "").trim());

/**
 * rowsToTransactions(parsed, mapping, { accountId, importId, flipSign }) -> { txs, bad: [{ row, why }] }
 * Sign convention of the plan: money in positive, money out negative. A single amount column is
 * taken as signed, unless a type column says debit; `flipSign` reverses everything (some card
 * exports list charges as positive).
 */
export function rowsToTransactions(parsed, mapping, { accountId, importId = "", flipSign = false } = {}) {
  const txs = [], bad = [];
  parsed.rows.forEach((r, n) => {
    const date = mapping.date === null ? null : parseDate(r[mapping.date], mapping.dateOrder);
    let amount = null;
    if (mapping.amount !== null && mapping.amount !== undefined) {
      amount = parseAmount(r[mapping.amount]);
      if (amount !== null && mapping.type !== null && mapping.type !== undefined && isDebitWord(r[mapping.type]) && amount > 0) amount = -amount;
    } else {
      const dr = mapping.debit !== null ? parseAmount(r[mapping.debit]) : null, cr = mapping.credit !== null ? parseAmount(r[mapping.credit]) : null;
      if (dr !== null && dr !== 0) amount = -Math.abs(dr); else if (cr !== null) amount = Math.abs(cr); else if (dr === 0) amount = 0;
    }
    if (flipSign && amount !== null) amount = -amount;
    const raw = mapping.payee === null ? "" : String(r[mapping.payee] ?? "").trim();
    if (!date) { bad.push({ row: n + 1, why: "no date" }); return; }
    if (amount === null) { bad.push({ row: n + 1, why: "no amount" }); return; }
    const t = { id: `${importId || "csv"}-${n + 1}`, date, amount: Math.round(amount * 100) / 100, payee: prettyPayee(raw) || "(no description)", rawPayee: raw, accountId, category: "", tags: [], note: "", importId };
    t.key = txKey(t);
    txs.push(t);
  });
  return { txs, bad };
}
/** Split incoming transactions into ones to add and ones already on file (same key, or same key seen twice in the file). */
export function dedupe(existing, incoming) {
  const seen = new Set((existing ?? []).map((t) => t.key ?? txKey(t)));
  const add = [], skip = [];
  for (const t of incoming) { const k = t.key ?? txKey(t); if (seen.has(k)) skip.push(t); else { seen.add(k); add.push(t); } }
  return { add, skip };
}
/** A fingerprint of a file's header row, so a saved column mapping can be reused next month. */
export const headerKey = (headers) => headers.map(H).join("|");

/**
 * prepareImport(plan, text, { accountId, mapping?, flipSign?, importId }) -> {
 *   parsed, mapping, headerKey, txs (after rules), add, skip, bad, dateFrom, dateTo (of what is added), fileFrom, fileTo (the file's
 *   own first and last day), inTotal, outTotal, ruled, elsewhere (alsoOn: another account already has most of these lines) | null,
 *   gap (gapBefore: days between the account's last lines and this file) | null, fills (uncoveredDays: the days of this file the
 *   account's files did not cover; with nothing new to add, the page offers to record the file so those days count as checked)
 * }
 * The whole import decided in one call; the view shows it and, on confirm, appends `add`.
 */
export function prepareImport(plan, text, { accountId, mapping = null, flipSign = null, importId = "csv" } = {}) {
  const parsed = parseBankCsv(text);
  const key = headerKey(parsed.headers);
  const profile = plan.importProfiles?.[key] ?? null;
  const map = mapping ?? profile?.mapping ?? detectMapping(parsed.headers, parsed.rows);
  let flip = flipSign, flipAuto = false;
  if (flip === null || flip === undefined) {
    if (profile && typeof profile.flipSign === "boolean") flip = profile.flipSign;
    else { flip = suggestFlip(plan, accountId, parsed, map); flipAuto = flip; }
  }
  const { txs: rawTxs, bad } = rowsToTransactions(parsed, map, { accountId, importId, flipSign: flip });
  return { parsed, mapping: map, headerKey: key, flipSign: flip, flipAuto, bad, ...finish(plan, rawTxs) };
}
/** Rules, duplicates and totals for a batch of new transactions (shared by CSV and statement imports). */
function finish(plan, rawTxs) {
  const ruled = applyRules(plan.rules ?? [], rawTxs);
  const { add, skip } = dedupe(plan.transactions ?? [], ruled.txs);
  const dates = add.map((t) => t.date).sort();
  const all = ruled.txs.map((t) => t.date).filter(Boolean).sort();   // the file's own first and last day, duplicates included
  let inTotal = 0, outTotal = 0;
  for (const t of add) { if (t.amount >= 0) inTotal += t.amount; else outTotal += -t.amount; }
  const fileFrom = all[0] ?? null, fileTo = all[all.length - 1] ?? null;
  const accountId = rawTxs[0]?.accountId ?? null;
  return { txs: ruled.txs, add, skip, dateFrom: dates[0] ?? null, dateTo: dates[dates.length - 1] ?? null, fileFrom, fileTo, inTotal, outTotal, ruled: ruled.changed, ruleHits: ruled.hits, elsewhere: alsoOn(plan, add),
    gap: gapBefore(plan, { accountId, fileFrom, fileTo, add }), fills: fileFrom ? uncoveredDays(plan, accountId, fileFrom, fileTo) : [] };
}
/**
 * uncoveredDays(plan, accountId, from, to) -> [{ from, to, days }]: the days between from and to that the account's files do not
 * cover yet (coverageByAccount: before its first day, after its last, or in a hole). A file with nothing new in it that spans
 * them still says something: nothing happened on those days, so importing it records them as covered (2026-11-02).
 */
export function uncoveredDays(plan, accountId, from, to) {
  if (!accountId || !from || !to || from > to) return [];
  const c = coverageByAccount(plan)[accountId];
  const spans = !c ? [{ from, to }] : [
    ...(from < c.from ? [{ from, to: to < c.from ? to : plusDays(c.from, -1) }] : []),
    ...(c.holes ?? []).filter((h) => h.from <= to && h.to >= from).map((h) => ({ from: h.from > from ? h.from : from, to: h.to < to ? h.to : to })),
    ...(to > c.to ? [{ from: from > c.to ? from : plusDays(c.to, 1), to }] : []),
  ];
  return spans.map((s) => ({ ...s, days: Math.round((Date.parse(`${s.to}T00:00:00Z`) - Date.parse(`${s.from}T00:00:00Z`)) / 864e5) + 1 }));
}

const md = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const plusDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
/**
 * gapBefore(plan, { accountId, fileFrom, fileTo, add }) -> null | { accountId, name, last, fileFrom, from, to, days, hole, usual: [{ name, day, out }], text }
 * Said before importing (2026-11-02): the days between that account's last line (or its last import's `to`) and the file's
 * first line would be a hole once it is in (coverageByAccount's one rule, re-check 4: more than a quiet spell, or a usual
 * payment due in them with none of it that month), so `hole` is always true when this is said. `usual`: usualInDays over the
 * gap. "Your last Chase checking lines end 7/30; this file starts 8/3. Anything on 7/31 to 8/2 is missing (your
 * mortgage usually goes out on the 2nd and a paycheck on the 1st). Bring in a file from 7/31, or add those by hand."
 */
export function gapBefore(plan, { accountId, fileFrom, fileTo = null, add = [] } = {}) {
  if (!accountId || !fileFrom) return null;
  const mine = (plan.transactions ?? []).filter((t) => t.accountId === accountId);
  let last = null;
  for (const d of [...mine.map((t) => String(t.date ?? "").slice(0, 10)), ...(plan.imports ?? []).filter((im) => im.accountId === accountId).map((im) => String(im.to ?? "").slice(0, 10))]) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < fileFrom && (!last || d > last)) last = d;
  if (!last) return null;
  const gFrom = plusDays(last, 1), gTo = plusDays(fileFrom, -1);
  if (gFrom > gTo) return null;
  // the hole as the coverage will see it once this file is in (coverageByAccount decides)
  const sim = { ...plan, transactions: [...(plan.transactions ?? []), ...add], imports: [...(plan.imports ?? []), { accountId, from: fileFrom, to: fileTo ?? fileFrom }] };
  const hole = (coverageByAccount(sim)[accountId]?.holes ?? []).find((h) => h.to === gTo) ?? null;
  // a few quiet days with nothing usual due in them are not a hole, and are not said (re-check 4, 2026-11-02)
  if (!hole) return null;
  const from = hole.from, to = hole.to;
  const usual = usualInDays(plan, accountId, from, to, add);
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5) + 1;
  const list = usualWords(usual);
  const name = (plan.accounts ?? []).find((a) => a.id === accountId)?.name ?? "account";
  const span = days === 1 ? md(from) : `${md(from)} to ${md(to)}`;
  const text = `Your last ${name} lines end ${md(last)}; this file starts ${md(fileFrom)}. Anything on ${span} is missing${list ? ` (${list})` : ""}. Bring in a file from ${md(from)}, or add ${days === 1 ? "that" : "those"} by hand.`;
  return { accountId, name, last, fileFrom, from, to, days, hole: !!hole, usual: usual.map(({ name: n, day, out }) => ({ name: n, day, out })), text };
}
/**
 * alsoOn(plan, add) -> { accountId, count, of } | null: the other account that already has most of these lines (the same day,
 * amount and bank description), when it has at least 80% of them and at least 3: the same file imported on the wrong
 * account first (dedupe() only looks within one account, so importing it again on the right one would count it twice).
 * Only a warning: two real lines can match by chance. (2026-11-02)
 */
export function alsoOn(plan, add) {
  if (!add?.length) return null;
  const target = add[0].accountId;
  const norm = (t) => `${t.date}|${Math.round((Number(t.amount) || 0) * 100)}|${String(t.rawPayee ?? t.payee ?? "").trim().toUpperCase()}`;
  const by = new Map();
  for (const t of plan.transactions ?? []) { if (t.accountId === target) continue; const k = norm(t); if (!by.has(k)) by.set(k, new Set()); by.get(k).add(t.accountId); }
  const count = new Map();
  for (const t of add) for (const a of by.get(norm(t)) ?? []) count.set(a, (count.get(a) ?? 0) + 1);
  const [accountId, n] = [...count.entries()].sort((x, y) => y[1] - x[1])[0] ?? [null, 0];
  return accountId && n >= 3 && n >= 0.8 * add.length ? { accountId, count: n, of: add.length } : null;
}
/**
 * prepareRows(plan, rows, { accountId, importId, flipSign }) -> same shape as prepareImport (minus parsed/mapping).
 * `rows` come from any reader: [{ date "YYYY-MM-DD", payee?, rawPayee?, amount }] (the statement reader, later OFX).
 */
export function prepareRows(plan, rows, { accountId, importId = "rows", flipSign = false } = {}) {
  const txs = (rows ?? []).map((r, n) => {
    const amount = Math.round((flipSign ? -Number(r.amount) : Number(r.amount)) * 100) / 100;
    const raw = String(r.rawPayee ?? r.payee ?? "").trim();
    const t = { id: `${importId}-${n + 1}`, date: r.date, amount, payee: (r.payee || prettyPayee(raw) || raw || "(no description)"), rawPayee: raw, accountId, category: "", tags: [], note: "", importId };
    t.key = txKey(t);
    return t;
  }).filter((t) => t.date && Number.isFinite(t.amount));
  return { flipSign: !!flipSign, bad: [], ...finish(plan, txs) };
}
/**
 * Card exports (Amex, Discover, many others) list charges as positive numbers and payments as
 * negative: the opposite of the plan's convention. For a card or loan account with one signed
 * amount column and mostly positive values, flip. Checking and savings files are left alone
 * (deposits can outnumber withdrawals); the preview lets the person flip by hand.
 */
export function suggestFlip(plan, accountId, parsed, mapping) {
  const acct = (plan.accounts ?? []).find((a) => a.id === accountId);
  if (!acct || !isLiability(acct.type)) return false;
  if (mapping.amount === null || mapping.amount === undefined || (mapping.type !== null && mapping.type !== undefined)) return false;
  const amounts = parsed.rows.map((r) => parseAmount(r[mapping.amount])).filter((a) => a !== null && a !== 0);
  if (amounts.length < 2) return false;
  return amounts.filter((a) => a > 0).length / amounts.length >= 0.6;
}

/** compute(plan) -> { imports: [...newest first], accounts, lastImport } for the page header. */
export function compute(plan) {
  const imports = [...(plan.imports ?? [])].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const accounts = (plan.accounts ?? []).map((a) => ({ id: a.id, name: a.name, count: (plan.transactions ?? []).filter((t) => t.accountId === a.id).length }));
  return { imports, accounts, lastImport: imports[0] ?? null, total: (plan.transactions ?? []).length };
}
