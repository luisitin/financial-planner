// core/ofx.js -- PURE, dependency-free. Reads the "Quicken" / "QuickBooks" download a bank or card site offers: OFX, QFX
// (Quicken's OFX with an Intuit id) and QBO (QuickBooks Web Connect, also OFX). Both shapes are read the same way:
// OFX 1.x is SGML (a leaf tag such as <TRNAMT>-12.50 is never closed) and OFX 2.x is XML (every tag is closed).
// Written for this app from the OFX specification's element names (Open Financial Exchange 2.1.1, section 11: bank and
// card statements); no code copied from any parser.
//
//   isOfx(text)                -> true for a file that says OFXHEADER, or holds an <OFX> element (decided by content,
//                                 never by the file's name: an iPhone may hand over "download" with no extension)
//   ofxCharset(head)           -> the TextDecoder label its header names: "windows-1252" for CHARSET:1252, else "utf-8"
//   decodeOfx(bytes)           -> the text of a file's bytes, decoded by the charset its header names
//   ofxDate(s)                 -> "YYYY-MM-DD" from YYYYMMDD[HHMMSS[.XXX]][[-5:EST]] (the time and zone are ignored), or null
//   ofxAmount(s)               -> a signed number from "-12.50", "+1,234.00", "12,50" (a comma as the decimal mark), or null
//   decodeEntities(s)          -> &amp; &lt; &gt; &quot; &apos; &nbsp; &#38; &#x26; as characters; an unknown one is left as it is
//   lineId(fitid)              -> a short one-way id for a line's FITID (what transactions[].extId keeps), or null
//   scrubNumbers(text, ids)    -> the text with every account number of the file taken out ("...")
//   parseOfx(text)             -> { ok, complete, org, accounts: [{ kind, last4, currency, balance, balanceDate, from, to,
//                                   rows: [{ date, amount, payee, memo, fitid, type }], bad: [{ row, why }] }], investment }
//
// The account number (ACCTID) never leaves parseOfx: an account carries only its last 4 characters, for the person to
// pick the account on screen. A line's FITID leaves only as lineId (a one-way id: some banks build the FITID from the
// account number), and every account number of the file is taken out of NAME and MEMO (a transfer's "TO ACCT 40281234").

const HEAD = 4096;   // the header and the start of the body: enough to tell an OFX file and its charset

/** An OFX / QFX / QBO file, by what it holds (the SGML header line, the XML processing instruction, or the root element). */
export function isOfx(text) {
  const head = String(text ?? "").slice(0, HEAD).replace(/^﻿/, "");
  return /^\s*OFXHEADER\s*:/im.test(head) || /<\?OFX\b/i.test(head) || /<OFX\s*>/i.test(head);
}

/**
 * The decoder label for a file's header: SGML "CHARSET:1252" (and "CHARSET:ISO-8859-1", which browsers decode as 1252 too)
 * -> "windows-1252"; "ENCODING:UTF-8", an XML encoding="UTF-8" or anything else -> "utf-8". "ENCODING:USASCII" with
 * "CHARSET:1252" is the usual U.S. bank pair: the bytes above 127 (an é, a ’) are 1252 there.
 */
export function ofxCharset(head) {
  const h = String(head ?? "").slice(0, HEAD);
  const xml = /<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i.exec(h);
  if (xml) return /^(windows-1252|cp1252|iso-8859-1|latin1)$/i.test(xml[1].trim()) ? "windows-1252" : "utf-8";
  if (/^\s*ENCODING\s*:\s*UTF-?8\b/im.test(h)) return "utf-8";
  const cs = /^\s*CHARSET\s*:\s*([^\s<]+)/im.exec(h);
  return cs && /^(1252|windows-1252|iso-8859-1|8859-1|latin-?1)$/i.test(cs[1]) ? "windows-1252" : "utf-8";
}

/**
 * The text of an OFX file's bytes (Uint8Array or ArrayBuffer): the header is read as plain ASCII first, then the whole
 * file is decoded with the charset it names (TextDecoder "windows-1252", with the 0x80-0x9F fix below).
 */
export function decodeOfx(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
  let head = "";
  for (let i = 0; i < Math.min(b.length, HEAD); i++) head += String.fromCharCode(b[i]);
  const cs = ofxCharset(head);
  const text = new TextDecoder(cs).decode(b);
  return cs === "windows-1252" ? text.replace(/[\u0080-\u009F]/g, (c) => CP1252[c.charCodeAt(0) - 0x80] ?? c) : text;
}
// Bytes 0x80-0x9F in windows-1252 (the WHATWG Encoding Standard's index-windows-1252): browsers decode them so, but Node's
// TextDecoder reads "windows-1252" as ISO-8859-1 and leaves them as control characters (a ’ would come out as U+0092), so
// they are mapped here. An empty slot (0x81, 0x8D, 0x8F, 0x90, 0x9D) is left as it is.
const CP1252 = ["\u20AC", null, "\u201A", "\u0192", "\u201E", "\u2026", "\u2020", "\u2021", "\u02C6", "\u2030", "\u0160", "\u2039", "\u0152", null, "\u017D", null,
  null, "\u2018", "\u2019", "\u201C", "\u201D", "\u2022", "\u2013", "\u2014", "\u02DC", "\u2122", "\u0161", "\u203A", "\u0153", null, "\u017E", "\u0178"];

/** "YYYY-MM-DD" from an OFX date-time: YYYYMMDD, then optionally HHMMSS, .XXX and a zone such as [-5:EST]. The day as the bank printed it. */
export function ofxDate(s) {
  const m = /^\s*(\d{4})(\d{2})(\d{2})/.exec(String(s ?? ""));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 1970 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** A signed amount: "-12.50", "+1,234.00" (a thousands comma before a 3-digit group), "12,50" (a decimal comma). */
export function ofxAmount(s) {
  let t = String(s ?? "").trim().replace(/\s+/g, "");
  if (!t) return null;
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");   // 1,234.00
  else if (/^[+-]?\d*,\d+$/.test(t)) t = t.replace(",", ".");             // 12,50
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
/** Character references as characters. "AT&T" written raw (as some SGML files do) stays "AT&T". */
export function decodeEntities(s) {
  return String(s ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all; }
    return NAMED[e.toLowerCase()] ?? all;
  });
}

/**
 * The element tree of the body (from <OFX> on). A tag with text after it is a leaf ({ name, value }). A tag with no text
 * is an aggregate when it is one of the statement aggregates or the file closes that name somewhere (every aggregate is
 * closed, in SGML and XML), else an empty leaf (SGML's <MEMO> with nothing in it). A closing tag pops back to the
 * aggregate it names; a leaf's own closing tag (XML) is passed over.
 */
// the bank and card statement aggregates (OFX 2.1.1 sections 2, 11.4, 11.5): always boxes, even in a file that never closes one
const AGGREGATES = new Set(["OFX", "SIGNONMSGSRSV1", "SONRS", "STATUS", "FI", "BANKMSGSRSV1", "STMTTRNRS", "STMTRS", "BANKACCTFROM", "BANKTRANLIST", "STMTTRN", "PAYEE", "LEDGERBAL", "AVAILBAL", "CREDITCARDMSGSRSV1", "CCSTMTTRNRS", "CCSTMTRS", "CCACCTFROM", "INVSTMTMSGSRSV1", "INVSTMTTRNRS", "INVSTMTRS"]);
function tree(body) {
  const closers = new Set([...AGGREGATES, ...[...body.matchAll(/<\/([A-Za-z][\w.]*)\s*>/g)].map((m) => m[1].toUpperCase())]);
  const root = { name: "#", kids: [] };
  const stack = [root];
  for (const m of body.matchAll(/<(\/?)([A-Za-z][\w.]*)\s*>([^<]*)/g)) {
    const name = m[2].toUpperCase();
    if (m[1]) {
      const at = stack.map((n) => n.name).lastIndexOf(name);
      if (at > 0) stack.length = at;
      continue;
    }
    const value = m[3].replace(/\s+/g, " ").trim();
    // an aggregate opened while one of the same name is still open is its next sibling (a file that leaves out a
    // </STMTTRN>, or every closing tag, would otherwise nest every line inside the one before): back to that one's parent
    if (value === "" && closers.has(name)) { const open = stack.map((n) => n.name).lastIndexOf(name); if (open > 0) stack.length = open; }
    const top = stack[stack.length - 1];
    if (value !== "" || !closers.has(name)) top.kids.push({ name, value: decodeEntities(value) });
    else { const node = { name, kids: [] }; top.kids.push(node); stack.push(node); }
  }
  return root;
}
const kid = (n, name) => n?.kids?.find((k) => k.name === name) ?? null;
const val = (n, name) => { const k = kid(n, name); return k && typeof k.value === "string" ? k.value : null; };
function every(n, names, out = []) {
  for (const k of n?.kids ?? []) { if (names.includes(k.name)) out.push(k); else if (k.kids) every(k, names, out); }
  return out;
}

const KINDS = { CHECKING: "checking", SAVINGS: "savings", MONEYMRKT: "savings", CD: "savings", CREDITLINE: "credit line" };
/**
 * lineId(fitid) -> a short one-way id for a bank's line id (FITID), or null when there is none. The plan keeps this
 * (transactions[].extId), never the FITID itself: some banks build the FITID from the account number ("40287351-20261103-1",
 * or the number without its dashes), and no rule about where the digits sit catches every bank. Two 32-bit FNV-1a sums
 * (Fowler, Noll, Vo; public domain), the second over the text reversed, written in base 36: the same FITID always gives
 * the same id, so the duplicate check works across downloads.
 */
export function lineId(fitid) {
  const f = String(fitid ?? "").trim();
  if (!f) return null;
  const fnv = (t) => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  return `${fnv(f).toString(36)}${fnv(`${f.length}:${[...f].reverse().join("")}`).toString(36)}`;
}

/**
 * scrubNumbers(text, ids) -> the text with account numbers taken out ("..."). Each id in `ids` (the file's ACCTIDs) is
 * looked for as written, as its letters and digits only, and without leading zeros (5 or more characters), and where
 * the same characters are written with spaces, dashes or dots between them ("0040-2899-64" for those ten digits). A run of 6
 * or more digits right after a word that names an account (acct, account, a/c, chk, checking, sav, savings, card, to,
 * from) goes too: the other account of a transfer ("XFER FROM CHK 40287351") is not one of the file's own.
 */
const ACCOUNT_WORD = /\b(acct|account|a\/c|chk|checking|sav|savings|card|to|from)\b([\s#:.\-]*)\d(?:[\s.\-]?\d){5,}/gi;
export function scrubNumbers(text, ids = []) {
  let t = String(text ?? "");
  const forms = new Set();
  for (const id of ids) {
    const raw = String(id ?? "").trim(), bare = raw.replace(/[^0-9A-Za-z]/g, "");
    for (const f of [raw, bare, bare.replace(/^0+/, "")]) if (f.length >= 5 && /\d{4}/.test(f)) forms.add(f);
  }
  for (const f of [...forms].sort((x, y) => y.length - x.length)) {
    t = t.split(f).join("...");
    // the same characters with separators between them
    if (/^[0-9A-Za-z]+$/.test(f)) t = t.replace(new RegExp([...f].join("[\\s.\\-]?"), "g"), "...");
  }
  return t.replace(ACCOUNT_WORD, (all, word, gap) => `${word}${gap}...`);
}

/**
 * parseOfx(text) -> { ok, complete, org, accounts, investment }. One account per bank (STMTRS) or card (CCSTMTRS)
 * statement in the file, in file order: kind ("checking", "savings", "credit line" or "card"), last4 (the last 4 letters
 * or digits of ACCTID, shown once and never kept), currency (CURDEF), balance and balanceDate (LEDGERBAL's BALAMT and
 * DTASOF, the bank's own figure), from and to (the list's DTSTART and DTEND), and rows: date (DTPOSTED, else DTUSER),
 * amount (TRNAMT, signed as the bank sends it: money out negative, card charges negative), payee (EXTDNAME when it is the
 * longer text, else NAME, else PAYEE's NAME, else MEMO: NAME is cut at 32 characters by the format, OFX 2.1.1
 * GenericNameType), memo, fitid (lineId of the FITID, never the FITID) and type (TRNTYPE). A line with no readable date
 * or amount is left out and counted in `bad` ([{ row, why: "no date" | "no amount" }]). CDATA sections are read as text.
 * `complete`: the file ends with </OFX>; when it does not (a download cut short), a last line that was never closed is
 * dropped: its amount may be half a number. `investment`: the file also holds investment statements (INVSTMTRS), which
 * this reader does not bring in. `org`: the bank's name (FI/ORG).
 */
export function parseOfx(text) {
  let s = String(text ?? "").replace(/^\uFEFF/, "");
  const at = s.search(/<OFX\s*>/i);
  if (at < 0) return { ok: false, complete: false, org: null, accounts: [], investment: false };
  // CDATA as plain text, its < > & written as entities so the tags inside are not read as tags
  s = s.slice(at).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (all, t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  const complete = /<\/OFX\s*>\s*$/i.test(s);
  if (!complete) {
    // cut short: the last line, when it was never closed, may stop in the middle of its amount
    const last = s.search(/<STMTTRN\s*>(?![\s\S]*<STMTTRN\s*>)/i);
    if (last >= 0 && !/<\/STMTTRN\s*>/i.test(s.slice(last))) s = s.slice(0, last);
  }
  const root = tree(s);
  const org = val(every(every(root, ["SONRS"])[0], ["FI"])[0], "ORG");
  const statements = every(root, ["STMTRS", "CCSTMTRS"]);
  const acctIds = every(root, ["ACCTID"]).map((k) => k.value).filter(Boolean);
  const clean = (t) => scrubNumbers(t, acctIds);
  const accounts = statements.map((st) => {
    const card = st.name === "CCSTMTRS";
    const from = every(st, [card ? "CCACCTFROM" : "BANKACCTFROM"])[0];
    const acctId = val(from, "ACCTID") ?? "";
    const list = every(st, ["BANKTRANLIST"])[0];
    const bal = every(st, ["LEDGERBAL"])[0];
    const bad = [];
    const rows = every(list ?? st, ["STMTTRN"]).map((t, n) => {
      const name = val(t, "NAME") ?? val(every(t, ["PAYEE"])[0], "NAME") ?? null, ext = val(t, "EXTDNAME");
      const payee = ext && ext.length > (name ?? "").length ? ext : name;
      const memo = val(t, "MEMO");
      const row = { date: ofxDate(val(t, "DTPOSTED") ?? val(t, "DTUSER")), amount: ofxAmount(val(t, "TRNAMT")), payee: clean(payee || memo || ""), memo: clean(memo ?? ""), fitid: lineId(val(t, "FITID")), type: (val(t, "TRNTYPE") ?? "").toUpperCase() };
      if (!row.date) bad.push({ row: n + 1, why: "no date" }); else if (row.amount === null) bad.push({ row: n + 1, why: "no amount" });
      return row;
    }).filter((r) => r.date && r.amount !== null);
    const balance = ofxAmount(val(bal, "BALAMT"));
    return {
      kind: card ? "card" : KINDS[(val(from, "ACCTTYPE") ?? "").toUpperCase()] ?? "checking",
      last4: acctId.replace(/[^0-9A-Za-z]/g, "").slice(-4),
      currency: (val(st, "CURDEF") ?? "").toUpperCase() || null,
      balance, balanceDate: balance === null ? null : ofxDate(val(bal, "DTASOF")),
      from: ofxDate(val(list, "DTSTART")), to: ofxDate(val(list, "DTEND")),
      rows, bad,
    };
  });
  return { ok: accounts.length > 0, complete, org, accounts, investment: every(root, ["INVSTMTRS"]).length > 0 };
}
