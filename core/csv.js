// core/csv.js -- a small, correct CSV reader (RFC 4180 plus what banks actually export).
// PURE, dependency-free; Papa Parse (vendor/papaparse) was the reference, but 60 lines cover
// every bank file seen so far: quoted fields with commas and newlines inside, doubled quotes,
// CRLF, a UTF-8 byte-order mark, a comma or semicolon or tab separator, ragged rows, and
// junk lines above the header (some banks print the account name first).
//
//   parseCsv(text) -> { headers: [..], rows: [[..]], separator, skipped }
//   rows are arrays of strings in header order; blank lines are dropped.

export function detectSeparator(text) {
  const sample = text.slice(0, 5000);
  const score = (sep) => sample.split(/\r?\n/).slice(0, 10).map((l) => l.split(sep).length - 1);
  const best = [",", ";", "\t", "|"].map((sep) => ({ sep, counts: score(sep) }))
    .map((x) => ({ ...x, total: x.counts.reduce((a, b) => a + b, 0), steady: x.counts.filter((c) => c > 0).length }))
    .sort((a, b) => b.steady - a.steady || b.total - a.total)[0];
  return best.total > 0 ? best.sep : ",";
}

/** Split CSV text into rows of fields. Handles quotes, escaped quotes, newlines in quotes. */
export function splitCsv(text, sep = ",") {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const s = String(text ?? "").replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows.map((r) => r.map((f) => f.trim()));
}

/**
 * Parse a bank export. The header row is the first row with at least two non-empty cells
 * whose width matches the most common row width (so a title line above the header is skipped).
 */
export function parseCsv(text) {
  const separator = detectSeparator(text);
  const all = splitCsv(text, separator);
  if (!all.length) return { headers: [], rows: [], separator, skipped: 0 };
  const freq = new Map();
  for (const r of all) freq.set(r.length, (freq.get(r.length) ?? 0) + 1);
  const common = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];   // most common width; ties -> wider
  let h = all.findIndex((r) => r.length === common && r.filter((c) => c !== "").length >= 2);
  if (h < 0) h = 0;
  const headers = all[h].map((c, i) => c || `Column ${i + 1}`);
  const rows = all.slice(h + 1).filter((r) => r.length >= 2).map((r) => { const out = r.slice(0, headers.length); while (out.length < headers.length) out.push(""); return out; });
  return { headers, rows, separator, skipped: h };
}

/** rows -> objects keyed by header. */
export const toObjects = ({ headers, rows }) => rows.map((r) => Object.fromEntries(headers.map((hd, i) => [hd, r[i] ?? ""])));

/** Serialise rows (arrays or objects with the given headers) back to CSV text. */
export function toCsv(headers, rows) {
  const cell = (v) => { const s = v === null || v === undefined ? "" : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const line = (r) => (Array.isArray(r) ? r : headers.map((h) => r[h])).map(cell).join(",");
  return [headers.map(cell).join(","), ...rows.map(line)].join("\r\n") + "\r\n";
}
