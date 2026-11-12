// modules/transactions/import/compute.js -- PURE. Turn a bank's CSV into transactions:
// find which column is the date, the description and the amount (or debit/credit), read
// dates and money in the formats banks use, drop lines already on file, and apply the rules.
// An OFX / QFX / QBO file (the "Quicken" or "QuickBooks" download, 2026-11-11) needs no columns: core/ofx.js reads it and
// prepareOfx feeds its lines to prepareRows, its FITIDs to the duplicate check and its balance to a one-tap offer.
// The view only reads the file and shows the preview; everything decidable is here.
import { parseCsv } from "../../../core/csv.js";
import { isOfx, parseOfx } from "../../../core/ofx.js";
import { clearGuess, guessAt, markGuess } from "../../../core/estimate/ledger.js";
import { saveBalance } from "../../balance/accounts/compute.js";
import { keepOnFile } from "../../balance/update/compute.js";
import { isValidDate, isoOf } from "../../../core/math/dates.js";
import { applyRules, prettyPayee } from "../rules/compute.js";
import { txKey, coverageByAccount, usualInDays, usualWords } from "../ledger/compute.js";
import { isLiability, countedBalance } from "../../balance/net-worth/compute.js";
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
 * looksLikeBankFile(parsed) -> boolean. Text with at least one line that has a date in one cell and an amount in another
 * (either date order) could be a bank file, even when its column names are not recognised (then the person picks the
 * columns). Anything else ("hello world", a sentence, an empty paste) is said to be no bank file instead of being answered
 * with column pickers and tiles of 0 (stress test T6, 2026-11-11).
 */
export function looksLikeBankFile(parsed) {
  for (const r of (parsed?.rows ?? []).slice(0, 50)) {
    const cells = (r ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
    const dateAt = cells.findIndex((c) => parseDate(c, "MDY") !== null || parseDate(c, "DMY") !== null);
    if (dateAt >= 0 && cells.some((c, i) => i !== dateAt && /\d/.test(c) && parseAmount(c) !== null && parseDate(c) === null)) return true;
  }
  return false;
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
/**
 * fileCurrency(parsed) -> "EUR" | "USD" | ... | null: the currency a file names in a column headed Currency (Währung,
 * Moneda, Devise, Valuta, Divisa, Ccy) whose cells are three-letter codes; with several, the first that is not USD.
 * Kept on the import record (importRecord), so a plan holding lines in another currency gets no U.S. guesses
 * (core/estimate applies; guesses spec 4.8). null when no column names one.
 */
const CURRENCY_NAMES = /^(currency|currency code|iso currency|curr|ccy|w(a|ä|ae)hrung|moneda|devise|valuta|divisa)$/i;
export function fileCurrency(parsed) {
  const i = (parsed?.headers ?? []).findIndex((h) => CURRENCY_NAMES.test(String(h ?? "").replace(/^\uFEFF/, "").trim()));
  if (i < 0) return null;
  const cells = (parsed.rows ?? []).map((r) => String(r?.[i] ?? "").trim()).filter(Boolean);
  if (!cells.length || !cells.every((c) => /^[A-Za-z]{3}$/.test(c))) return null;
  const codes = [...new Set(cells.map((c) => c.toUpperCase()))];
  return codes.find((c) => c !== "USD") ?? codes[0];
}
/**
 * importRecord(prep, { id, at, accountId, fileName, checkedOnly, balance }) -> the `imports[]` record the page writes for a
 * file: { id, at, accountId, fileName, rows, added, skipped, bad, from, to, currency?, balance? }. checkedOnly: nothing was
 * added, the file only counts its days as checked. `currency` only when the file names one (fileCurrency). `balance`: what
 * setBalanceFromFile returned when the import also set the account's balance, so Undo can put the old figure back.
 */
export function importRecord(prep, { id, at, accountId, fileName, checkedOnly = false, balance = null }) {
  return {
    id, at, accountId, fileName: prep.kind === "ofx" ? safeFileName(fileName, prep.fileAccounts.map((a) => a.last4)) : fileName, rows: prep.parsed.rows.length, added: checkedOnly ? 0 : prep.add.length, skipped: prep.skip.length, bad: checkedOnly ? 0 : prep.bad.length,
    from: prep.fileFrom, to: prep.fileTo, ...(prep.currency ? { currency: prep.currency } : {}), ...(balance ? { balance } : {}),
  };
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
/**
 * Split incoming transactions into ones to add and ones already on file.
 * A line with no bank id (a CSV's) is checked by key, as always: the same key on file, or earlier in the file, is a duplicate.
 * A line with the bank's own id (`extId`, from an OFX file's FITID; 2026-11-11) goes through three checks, each line on file
 * standing for one incoming line at most:
 *   1. the id, within its account: the same id with the same amount and a day within ID_DAYS is the same line. The same
 *      id with another amount or another day is NOT (some banks repeat an id, or build it from the day): that line comes
 *      in and its id is not kept, so it cannot hide a later line.
 *   2. the key, as a count: the plan already holds a line with this key that no incoming line has claimed (the same lines
 *      downloaded again with new ids; a CSV of the same days). Two $4.50 coffees in one file both come in when the plan
 *      holds none, and one of them when it holds one.
 *   3. a cut name: a line on file in that account with the same day and amount whose bank text starts with this one's, or
 *      the other way round (an OFX NAME stops at 32 characters, a CSV's does not; OFX 2.1.1 GenericNameType).
 * A CSV line is checked against OFX lines on file by 3 as well.
 */
const ID_DAYS = 5;
export function dedupe(existing, incoming) {
  const cents = (t) => Math.round((Number(t.amount) || 0) * 100);
  const text = (t) => String(t.rawPayee ?? t.payee ?? "").trim().toUpperCase();
  const dayNo = (d) => Math.round(Date.parse(`${String(d ?? "").slice(0, 10)}T00:00:00Z`) / 864e5);
  const near = (a, b) => { const x = dayNo(a), y = dayNo(b); return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= ID_DAYS; };
  const cut = (a, b) => { const [s, l] = a.length <= b.length ? [a, b] : [b, a]; return s.length >= 6 && l.startsWith(s); };
  const seen = new Set(), byKey = new Map(), byId = new Map(), byDay = new Map();
  const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
  for (const t of existing ?? []) {
    const k = t.key ?? txKey(t);
    const e = { date: String(t.date ?? "").slice(0, 10), cents: cents(t), text: text(t), hasId: !!t.extId, used: false };
    seen.add(k); push(byKey, k, e); push(byDay, `${t.accountId ?? ""}|${e.date}|${e.cents}`, e);
    if (t.extId) push(byId, `${t.accountId ?? ""}|${t.extId}`, e);
  }
  const add = [], skip = [];
  for (const t of incoming) {
    const k = t.key ?? txKey(t), c = cents(t), tx = text(t);
    const sameDay = () => (byDay.get(`${t.accountId ?? ""}|${String(t.date ?? "").slice(0, 10)}|${c}`) ?? []);
    if (!t.extId) {
      if (seen.has(k)) { skip.push(t); continue; }
      const short = sameDay().find((e) => e.hasId && !e.used && cut(e.text, tx));
      if (short) { short.used = true; skip.push(t); continue; }
      seen.add(k); add.push(t);
      continue;
    }
    const id = `${t.accountId ?? ""}|${t.extId}`, withId = byId.get(id) ?? [];
    const same = withId.find((e) => !e.used && e.cents === c && near(e.date, t.date));
    if (same) { same.used = true; skip.push(t); continue; }
    const held = (byKey.get(k) ?? []).find((e) => !e.used) ?? sameDay().find((e) => !e.hasId && !e.used && cut(e.text, tx));
    if (held) { held.used = true; skip.push(t); continue; }
    // an id the account already holds for another line is no id: the line comes in without it
    let line = t;
    if (withId.length) { line = { ...t }; delete line.extId; }
    else push(byId, id, { date: String(t.date ?? "").slice(0, 10), cents: c, text: tx, hasId: true, used: false });
    seen.add(k); add.push(line);
  }
  return { add, skip };
}
/** A fingerprint of a file's header row, so a saved column mapping can be reused next month. */
export const headerKey = (headers) => headers.map(H).join("|");

/**
 * prepareImport(plan, text, { accountId, mapping?, flipSign?, importId }) -> {
 *   parsed, mapping, headerKey, currency (fileCurrency), txs (after rules), add, skip, bad, dateFrom, dateTo (of what is added), fileFrom, fileTo (the file's
 *   own first and last day), inTotal, outTotal, ruled, elsewhere (alsoOn: another account already has most of these lines) | null,
 *   gap (gapBefore: days between the account's last lines and this file) | null, fills (uncoveredDays: the days of this file the
 *   account's files did not cover; with nothing new to add, the page offers to record the file so those days count as checked),
 *   auto: { mapping, flipSign, bad } (the columns and the sign the file, or the layout saved from an earlier import, works out
 *   with nothing changed by hand, and how many rows they leave unreadable: columnChanges says what a change by hand differs
 *   in, and the page says it when that change leaves more rows unreadable; fix round 3, F4)
 * }
 * The whole import decided in one call; the view shows it and, on confirm, appends `add`.
 */
export function prepareImport(plan, text, { accountId, mapping = null, flipSign = null, importId = "csv", which = null } = {}) {
  // an OFX / QFX / QBO file, known by what it holds: no columns to work out (prepareOfx)
  if (isOfx(text)) return prepareOfx(plan, text, { accountId, importId, which });
  const parsed = parseBankCsv(text);
  const key = headerKey(parsed.headers);
  const profile = plan.importProfiles?.[key] ?? null;
  const autoMap = profile?.mapping ?? detectMapping(parsed.headers, parsed.rows);
  const map = mapping ?? autoMap;
  let flip = flipSign, flipAuto = false;
  if (flip === null || flip === undefined) {
    if (profile && typeof profile.flipSign === "boolean") flip = profile.flipSign;
    else { flip = suggestFlip(plan, accountId, parsed, map); flipAuto = flip; }
  }
  const { txs: rawTxs, bad } = rowsToTransactions(parsed, map, { accountId, importId, flipSign: flip });
  const autoFlip = profile && typeof profile.flipSign === "boolean" ? profile.flipSign : suggestFlip(plan, accountId, parsed, autoMap);
  // (the sign counts as changed only when the box was set by hand: left alone, it follows the columns chosen)
  const flipByHand = flipSign !== null && flipSign !== undefined;
  const mine = { mapping: map, flipSign: flip, flipByHand, auto: { mapping: autoMap, flipSign: autoFlip } };
  const autoBad = columnChanges(mine).length ? rowsToTransactions(parsed, autoMap, { accountId, importId, flipSign: autoFlip }).bad.length : bad.length;
  return { parsed, mapping: map, headerKey: key, flipSign: flip, flipByHand, flipAuto, bad, currency: fileCurrency(parsed), auto: { ...mine.auto, bad: autoBad }, ...finish(plan, rawTxs) };
}
/**
 * columnChanges(prep) -> [{ key, to }]: how a CSV's columns, as chosen now, differ from what the file worked out (prep.auto):
 * key "date", "dateOrder" ("MDY" | "DMY"; none set reads as "MDY"), "payee", "amount" (the signed amount column or the money
 * out / money in pair, one change; `to`: the amount column, or { debit, credit }), "type", or "flip" (`to`: the amounts turned
 * around or not; only when the box was set by hand, `flipByHand`: left alone, the sign follows the columns chosen). Empty
 * when nothing was changed by hand (fix round 3, F4: the columns fold says "changed by you").
 */
export function columnChanges(prep) {
  const m = prep?.mapping, a = prep?.auto?.mapping;
  if (!m || !a) return [];
  const v = (x, k) => (k === "dateOrder" ? x[k] ?? "MDY" : x[k] ?? null);
  const out = ["date", "dateOrder", "payee", "type"].filter((k) => v(m, k) !== v(a, k)).map((k) => ({ key: k, to: v(m, k) }));
  if (["amount", "debit", "credit"].some((k) => v(m, k) !== v(a, k))) out.push({ key: "amount", to: v(m, "amount") ?? { debit: v(m, "debit"), credit: v(m, "credit") } });
  if (prep.flipByHand && !!prep.flipSign !== !!prep.auto.flipSign) out.push({ key: "flip", to: !!prep.flipSign });
  return out;
}
/**
 * Rules, duplicates and totals for a batch of new transactions (shared by CSV and statement imports). `range`: the days
 * the file itself says it covers ({ from, to }: an OFX file's DTSTART and DTEND), used for fileFrom / fileTo, the gap
 * before it and the days it fills, in place of its first and last line; `accountId`: the account, for a file with no lines.
 */
function finish(plan, rawTxs, { range = null, accountId: given = null } = {}) {
  const ruled = applyRules(plan.rules ?? [], rawTxs);
  const { add, skip } = dedupe(plan.transactions ?? [], ruled.txs);
  const dates = add.map((t) => t.date).sort();
  const all = ruled.txs.map((t) => t.date).filter(Boolean).sort();   // the file's own first and last day, duplicates included
  let inTotal = 0, outTotal = 0;
  for (const t of add) { if (t.amount >= 0) inTotal += t.amount; else outTotal += -t.amount; }
  const fileFrom = range?.from ?? all[0] ?? null, fileTo = range?.to ?? all[all.length - 1] ?? null;
  const accountId = rawTxs[0]?.accountId ?? given ?? null;
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
 * prepareRows(plan, rows, { accountId, importId, flipSign, range }) -> same shape as prepareImport (minus parsed/mapping).
 * `rows` come from any reader: [{ date "YYYY-MM-DD", payee?, rawPayee?, amount, extId? }] (the statement reader, an OFX
 * file). `extId`: the bank's own id for the line (an OFX FITID as core/ofx lineId), kept on the transaction for the
 * duplicate check. `range`: the days the file says it covers (finish).
 */
export function prepareRows(plan, rows, { accountId, importId = "rows", flipSign = false, range = null } = {}) {
  const txs = (rows ?? []).map((r, n) => {
    const amount = Math.round((flipSign ? -Number(r.amount) : Number(r.amount)) * 100) / 100;
    const raw = String(r.rawPayee ?? r.payee ?? "").trim();
    const t = { id: `${importId}-${n + 1}`, date: r.date, amount, payee: (r.payee || prettyPayee(raw) || raw || "(no description)"), rawPayee: raw, accountId, category: "", tags: [], note: "", importId, ...(r.extId ? { extId: String(r.extId) } : {}) };
    t.key = txKey(t);
    return t;
  }).filter((t) => t.date && Number.isFinite(t.amount));
  return { flipSign: !!flipSign, bad: [], ...finish(plan, txs, { range, accountId }) };
}
// ---------------------------------------------------------------- OFX / QFX / QBO (2026-11-11)
// The plan's account types a file's account may go to: a bank file to checking, savings or cash, a card file to a card.
// Never a 401(k), an IRA, a loan, a mortgage or a home (round-1 review, 2026-11-12: a card file once landed on a 401(k)).
export const OFX_TYPES = { checking: ["checking", "savings", "cash"], savings: ["savings", "checking", "cash"], card: ["credit"], "credit line": ["credit", "loan"] };
// the type a file's kind is, exactly: the only-one-of-its-kind guess and the balance offer look at these alone (a checking
// file may be brought in to a savings account by hand, but its balance is never offered there)
const OFX_OWN = { checking: ["checking"], savings: ["savings"], card: ["credit"], "credit line": ["credit", "loan"] };
const OFX_WORDS = { checking: "Checking", savings: "Savings", card: "Card", "credit line": "Credit line" };
/** how a file's kind reads in a sentence: "a checking account", "a card" */
export const OFX_A = { checking: "a checking account", savings: "a savings account", card: "a card", "credit line": "a credit line" };
/** true when a file's account of this kind may go to a plan account of this type */
export const ofxFits = (kind, type) => (OFX_TYPES[kind] ?? []).includes(type);
/** true when the plan account's type is the file's own kind (a checking file and a checking account) */
export const ofxOwn = (kind, type) => (OFX_OWN[kind] ?? []).includes(type);
/** "Checking ending 1234": how a file's account is named on screen (the last 4 are shown, never kept). */
export const ofxLabel = (a) => `${OFX_WORDS[a.kind] ?? "Account"}${a.last4 ? ` ending ${a.last4}` : ""}`;
/** A file's lines as prepareRows reads them: the bank's NAME (else MEMO) as the description, the line id as `extId`. */
export const ofxRows = (a) => (a?.rows ?? []).map((r) => ({ date: r.date, amount: r.amount, rawPayee: r.payee, ...(r.fitid ? { extId: r.fitid } : {}) }));
/** Get started's one line for every card together ("Credit cards"): one card's file is not its balance */
export const isCardLump = (a) => !!a && a.type === "credit" && /^credit cards$/i.test(String(a.name ?? "").trim());
// words in a bank's name that say nothing about which bank it is
const BANK_NOISE = new Set(["bank", "the", "credit", "union", "card", "cards", "financial", "national", "services", "service", "federal", "savings", "trust", "company", "corp", "inc", "and", "of"]);
const bankWords = (org) => String(org ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !BANK_NOISE.has(w));
// words in an account's name that say what it is, not where it is
const KIND_NOISE = new Set(["checking", "savings", "account", "accounts", "card", "cards", "credit", "debit", "cash", "joint", "shared", "main", "our", "my", "the", "money", "market", "emergency", "fund", "line", "loan", "personal", "household", "bills", "spending", "everyday", "rainy", "day", "and", "for", "new", "old"]);
const namesABank = (a) => !!String(a.institution ?? "").trim() || String(a.name ?? "").toLowerCase().split(/[^a-z0-9]+/).some((w) => w.length >= 3 && !KIND_NOISE.has(w));

/**
 * guessOfxAccount(plan, fileAccount, org, { peers }) -> { accountId, why, options, otherBank, lump }: the plan's account a
 * file's account most likely is, without its number (never kept). Only accounts the file's kind may go to are looked at
 * (`options`, ofxFits: a bank file never goes to a 401(k), a loan or a home; a former job's account is left out).
 *   why "holds": an option that already holds at least half of its lines (the same day, amount and bank text, or the same
 *       line id with the same day and amount; an id alone proves nothing, two accounts' ids can repeat);
 *   why "kind": the only account of the file's own kind (a checking file and one checking account), when the file is the
 *       only account of that kind in its file (`peers`, the file's kinds) and the plan's account does not name another
 *       bank. When it does (the file says Prairie Bank, the account is "Chase checking" or at Chase), nothing is picked
 *       and `otherBank` says so: { org, accountId, name, at };
 *   why "name": among several of that kind, the one whose name or bank names the file's bank (FI ORG).
 * accountId null: the person picks, from `options`. `lump`: the pick is Get started's one "Credit cards" line.
 */
export function guessOfxAccount(plan, fileAccount, org = null, { peers = null } = {}) {
  const kind = fileAccount?.kind;
  const options = (plan.accounts ?? []).filter((a) => ofxFits(kind, a.type) && !a.formerJob);
  const ids = options.map((a) => a.id);
  const out = (accountId, why, extra = {}) => ({ accountId, why, options: ids, otherBank: null, lump: isCardLump(options.find((a) => a.id === accountId)), ...extra });
  const rows = ofxRows(fileAccount);
  if (rows.length && options.length) {
    const line = (date, amount, text) => `${date}|${(Math.round((Number(amount) || 0) * 100) / 100).toFixed(2)}|${String(text ?? "").trim().toUpperCase()}`;
    const keys = new Map();
    const note = (k, a) => { if (!keys.has(k)) keys.set(k, new Set()); keys.get(k).add(a); };
    for (const t of plan.transactions ?? []) {
      if (!ids.includes(t.accountId)) continue;
      note(line(t.date, t.amount, t.rawPayee ?? t.payee), t.accountId);
      if (t.extId) note(line(t.date, t.amount, `#${t.extId}`), t.accountId);
    }
    const count = new Map();
    for (const r of rows) for (const a of new Set([...(keys.get(line(r.date, r.amount, r.rawPayee)) ?? []), ...(r.extId ? keys.get(line(r.date, r.amount, `#${r.extId}`)) ?? [] : [])])) count.set(a, (count.get(a) ?? 0) + 1);
    const [best, n] = [...count.entries()].sort((x, y) => y[1] - x[1])[0] ?? [null, 0];
    if (best && n >= Math.max(1, rows.length / 2)) return out(best, "holds");
  }
  // two accounts of one kind in the file: which is which cannot be told from the kind or the bank
  const alone = !peers || peers.filter((k) => k === kind).length < 2;
  const own = options.filter((a) => (OFX_OWN[kind] ?? []).includes(a.type));
  const words = bankWords(org);
  const at = (a) => words.some((w) => `${a.name ?? ""} ${a.institution ?? ""}`.toLowerCase().includes(w));
  if (alone && own.length === 1) {
    const a = own[0];
    if (words.length && !at(a) && namesABank(a)) return out(null, null, { otherBank: { org, accountId: a.id, name: a.name, at: String(a.institution ?? "").trim() || null } });
    return out(a.id, "kind");
  }
  const named = own.filter(at);
  if (alone && named.length === 1) return out(named[0].id, "name");
  return out(null, null);
}

/**
 * balanceOffer(plan, accountId, fileAccount, { today }) -> { accountId, amount, date, was, wasAsOf, debt, ask? } | null:
 * the bank's own balance in the file (LEDGERBAL: BALAMT as of DTASOF) offered for the account. A debt (a card) is what is
 * owed: |BALAMT| (card files send it negative).
 * Not offered when: the file has none; the account's type is not the file's own kind (ofxOwn: a card's figure is never a
 * checking balance, a checking figure never what is owed on a card or held in savings); the plan's balance is dated after the
 * file's; the same figure is on file for that day; or the file's date is more than a day ahead of `today` (a typo).
 * A date one day ahead (an evening download stamped in GMT) is taken as today.
 * `ask: "credit"`: a card file whose charges are negative (half its lines or more, or no lines to tell by) and whose BALAMT
 * is positive may be a card in credit, or an issuer that writes what is owed as a positive figure; the sign cannot be
 * trusted, so the person is asked.
 */
export function balanceOffer(plan, accountId, fileAccount, { today = null } = {}) {
  const a = (plan.accounts ?? []).find((x) => x.id === accountId);
  if (!a || !fileAccount || fileAccount.balance === null || fileAccount.balance === undefined || !fileAccount.balanceDate) return null;
  if (!ofxOwn(fileAccount.kind, a.type)) return null;
  let date = fileAccount.balanceDate;
  if (isValidDate(today) && date > today) { if (date > plusDays(today, 1)) return null; date = today; }
  const debt = isLiability(a.type);
  const amount = Math.round((debt ? Math.abs(fileAccount.balance) : fileAccount.balance) * 100) / 100;
  const was = debt ? countedBalance(a) : Number(a.balance) || 0;
  const wasAsOf = isValidDate(a.asOf) ? a.asOf : null;
  if (wasAsOf && wasAsOf > date) return null;
  if (wasAsOf === date && Math.abs(was - amount) < 0.005) return null;
  // charges negative on half the lines or more (the format's own sign; a file with one charge and one payment is such a
  // file), or no lines to tell by: a positive figure may be a credit (fix round 2: a two-line file was not asked)
  const rows = fileAccount.rows ?? [], out = rows.filter((r) => r.amount < 0).length;
  const ask = debt && fileAccount.balance > 0 && (!rows.length || out >= rows.length / 2) ? { ask: "credit" } : {};
  return { accountId, amount, date, was, wasAsOf, debt, ...ask };
}
/**
 * setBalanceFromFile(draft, offer) -> null | { was, wasAsOf, set, setAsOf, point?, kept?, guess? }: use the offer on a draft
 * (inside store.update). The balance on file is kept as a point of its own day (Update my balances' keepOnFile), the
 * bank's figure becomes the balance and its date the "as of" (balance/accounts saveBalance: a debt keeps its stored
 * sign), and a guess on that balance is dropped: it is the bank's figure now. What it returns goes on the import record
 * (imports[].balance) so Undo can put things back: the balance and date as stored before and after, `point` (the point
 * that day held before, when it held one: the same-day figure the bank's replaced), `kept` (keepOnFile added a point for
 * the old date) and `guess` (the guess entry that was dropped). null when nothing was saved.
 */
export function setBalanceFromFile(draft, offer) {
  const a = (draft.accounts ?? []).find((x) => x.id === offer?.accountId);
  if (!a) return null;
  const path = `accounts[${a.id}].balance`;
  const was = a.balance ?? null, wasAsOf = a.asOf ?? null, guess = guessAt(draft, path);
  const point = (a.history ?? []).find((h) => h?.date === offer.date) ?? null;
  const kept = keepOnFile(draft, a, offer.date);
  const r = saveBalance(draft, a.id, offer.date, offer.amount);
  if (!r.saved) return null;
  clearGuess(draft, path);
  return { was, wasAsOf, set: a.balance, setAsOf: a.asOf, ...(point ? { point: point.balance } : {}), ...(kept ? { kept: true } : {}), ...(guess ? { guess } : {}) };
}
/** setBalanceFromFile as a yes or no (the balance button with nothing to import). */
export const applyBalanceOffer = (draft, offer) => setBalanceFromFile(draft, offer) !== null;
/**
 * canUndoBalance(plan, im) -> { accountId, was, wasAsOf } | null: an import that also set its account's balance
 * (im.balance) can put the old one back while the account still holds exactly what the import set.
 * undoBalance(draft, im) -> true when it did: the balance, its date, that day's point, the point keepOnFile added and a
 * dropped guess are as they were before the import.
 */
export function canUndoBalance(plan, im) {
  const b = im?.balance, a = (plan.accounts ?? []).find((x) => x.id === im?.accountId);
  if (!b || !a || a.balance !== b.set || (a.asOf ?? null) !== (b.setAsOf ?? null)) return null;
  return { accountId: a.id, was: isLiability(a.type) ? Math.abs(Number(b.was) || 0) : Number(b.was) || 0, wasAsOf: b.wasAsOf ?? null };
}
export function undoBalance(draft, im) {
  if (!canUndoBalance(draft, im)) return false;
  const b = im.balance, a = draft.accounts.find((x) => x.id === im.accountId);
  a.history = (a.history ?? []).filter((h) => h?.date !== b.setAsOf && !(b.kept && h?.date === b.wasAsOf));
  if (b.point !== undefined) { a.history.push({ date: b.setAsOf, balance: b.point }); a.history.sort((x, y) => String(x.date).localeCompare(String(y.date))); }
  a.balance = b.was;
  if (b.wasAsOf === null || b.wasAsOf === undefined) delete a.asOf; else a.asOf = b.wasAsOf;
  if (b.guess) markGuess(draft, `accounts[${a.id}].balance`, { key: b.guess.k, value: b.guess.v, unit: b.guess.u, sigma: b.guess.s, dataAsOf: b.guess.d }, b.guess.at);
  return true;
}

/**
 * A file name with account numbers taken out: every run of 6 or more digits, counting dashes, dots and spaces between
 * them ("0040-2899-64_activity.qfx" -> "XXXX_activity.qfx"; a date in the name goes too), then the account's last 4 with
 * any digits before them ("Chase1234_Activity.QFX" -> "ChaseXXXX_Activity.QFX").
 */
export function safeFileName(name, last4s = []) {
  let n = String(name ?? "").replace(/\d(?:[\s.\-]?\d){5,}/g, "XXXX");
  for (const l of last4s.filter((x) => x && x.length >= 3)) n = n.replace(new RegExp(`\\d*${l.replace(/[^0-9A-Za-z]/g, "")}`, "g"), "XXXX");
  return n;
}

/**
 * prepareOfx(plan, text, { accountId, importId, which, today, force }) -> the prepareRows result for one account of the
 * file, plus { kind: "ofx", ok, complete (core/ofx: the file ends as a whole file does), investment, org,
 * fileAccounts: [{ i, kind, last4, label, count, bad, currency, from, to, hasBalance }], which, guess (guessOfxAccount),
 * accountId (the plan's account the lines are prepared for, or null: none yet), mismatch (the account given is not one
 * this kind of file may go to: { accountId, type }; nothing is prepared unless `force`), forced, otherKind (the account
 * used is not the file's own kind: a checking file on a savings account; said on the page, no balance), currency (CURDEF),
 * balance (balanceOffer, with `tick`: whether the page ticks it by default, and `lump`), bad (lines left out: no date or
 * no amount), parsed: { rows } }.
 * The account: the one given (the person's pick, or the account the page was opened for) when the file's kind may go to
 * it; else the guess; else none, and the person picks. A file never goes to the first account in a list.
 * `which`: the file's account to bring in (a file can hold several): by default the first whose lines are not all on
 * file yet. fileFrom / fileTo are the file's own DTSTART and DTEND when they are real dates that contain the lines
 * (DTEND not after `today`), so a quiet week at a file's edge is not read as missing days.
 * `tick`: only when the account is the guess for a sure reason ("holds" or "name"), every line was read, the file is
 * whole, it is not Get started's cards lump and the figure needs no question. The account number is never in the result.
 */
export function prepareOfx(plan, text, { accountId = null, importId = "ofx", which = null, today = null, force = false } = {}) {
  const ofx = parseOfx(text);
  const fileAccounts = ofx.accounts.map((a, i) => ({ i, kind: a.kind, last4: a.last4, label: ofxLabel(a), count: a.rows.length, bad: a.bad.length, currency: a.currency, from: a.from, to: a.to, hasBalance: a.balance !== null && !!a.balanceDate }));
  const empty = { kind: "ofx", ok: false, complete: ofx.complete, investment: ofx.investment, org: ofx.org, fileAccounts, which: null, guess: null, accountId: null, mismatch: null, forced: false, otherKind: false, currency: null, balance: null, parsed: { rows: [] }, flipSign: false, bad: [], txs: [], add: [], skip: [], dateFrom: null, dateTo: null, fileFrom: null, fileTo: null, inTotal: 0, outTotal: 0, ruled: 0, ruleHits: {}, elsewhere: null, gap: null, fills: [] };
  if (!ofx.ok) return empty;
  const peers = ofx.accounts.map((a) => a.kind);
  const typeOf = (id) => (plan.accounts ?? []).find((a) => a.id === id)?.type ?? null;
  const guessOf = (a) => guessOfxAccount(plan, a, ofx.org, { peers });
  const target = (a) => (accountId ? (typeOf(accountId) && (force || ofxFits(a.kind, typeOf(accountId))) ? accountId : null) : guessOf(a).accountId);
  const rangeOf = (a) => {
    const days = a.rows.map((r) => r.date).sort(), first = days[0] ?? null, last = days[days.length - 1] ?? null;
    const from = a.from && (!first || a.from <= first) ? a.from : first;
    let to = a.to && (!last || a.to >= last) ? a.to : last;
    if (to && isValidDate(today) && to > today) to = last && last > today ? last : today;
    return from && to && from <= to ? { from, to } : null;
  };
  const rowsFor = (a, id) => prepareRows(plan, ofxRows(a), { accountId: id, importId, range: rangeOf(a) });
  let w = Number.isInteger(which) && ofx.accounts[which] ? which : null;
  if (w === null) {
    w = ofx.accounts.findIndex((a) => { const id = target(a); return id && rowsFor(a, id).add.length > 0; });
    if (w < 0) w = 0;
  }
  const fa = ofx.accounts[w];
  const guess = guessOf(fa);
  const used = target(fa);
  const given = accountId && typeOf(accountId) ? accountId : null;
  const mismatch = given && !ofxFits(fa.kind, typeOf(given)) ? { accountId: given, type: typeOf(given) } : null;
  const base = { ...empty, ok: true, which: w, guess, mismatch, currency: fa.currency, bad: fa.bad, parsed: { rows: fa.rows } };
  if (!used) return base;
  const offer = balanceOffer(plan, used, fa, { today });
  const lump = isCardLump((plan.accounts ?? []).find((a) => a.id === used));
  const sure = guess.accountId === used && (guess.why === "holds" || guess.why === "name");
  return { ...base, accountId: used, forced: !!mismatch, otherKind: !ofxOwn(fa.kind, typeOf(used)),
    balance: offer ? { ...offer, lump, tick: sure && !lump && !offer.ask && !fa.bad.length && ofx.complete } : null,
    ...rowsFor(fa, used), bad: fa.bad };
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

/** compute(plan) -> { imports: [...newest first], accounts: [{ id, name, type, count }], lastImport } for the page header. */
export function compute(plan) {
  const imports = [...(plan.imports ?? [])].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const accounts = (plan.accounts ?? []).map((a) => ({ id: a.id, name: a.name, type: a.type, count: (plan.transactions ?? []).filter((t) => t.accountId === a.id).length }));
  return { imports, accounts, lastImport: imports[0] ?? null, total: (plan.transactions ?? []).length };
}
