// core/format.js -- display formatting only. Never do math here.
export const money = (n, currency = "USD", locale = "en-US", digits = 0) =>
  Number.isFinite(Number(n)) ? new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(n)) : "-";
// toPrecision(12) first: 0.0725 * 100 is 7.249999999999999 in floating point and would show 7.2%.
export const pct = (x, digits = 1) => Number.isFinite(Number(x)) ? `${Number((Number(x) * 100).toPrecision(12)).toFixed(digits)}%` : "-";
export const num = (n, digits = 0, locale = "en-US") => Number.isFinite(Number(n)) ? new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Number(n)) : "-";
// Plan dates are "YYYY-MM-DD" with no time zone. `new Date("2026-09-15")` would read that as
// midnight UTC and show 9/14 in the Americas, so date-only strings are parsed as local days.
export const parseDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "")); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso); };
export const date = (iso, locale = "en-US") => { if (!iso) return "-"; const d = parseDate(iso); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(locale); };
export const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => isoDate(new Date());   // the local calendar day, not the UTC one
export const signed = (n, currency) => (Number(n) < 0 ? "-" : "+") + money(Math.abs(Number(n)), currency);
// Reading what someone typed into a money box (the inverse of money(), not math): "$4,500", "4500.50", "72k", "1.2m",
// "-500" and " 950 " all read as numbers; blank or nonsense is null, so a blank box saves nothing and never becomes 0.
export const readAmount = (text) => {
  if (text === null || text === undefined) return null;
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  const s = String(text).trim().toLowerCase().replace(/[$€£¥,\s]|us\$|ca\$|a\$/g, "");
  const m = /^([-+]?)(\d+\.?\d*|\.\d+)([km])?$/.exec(s);
  if (!m) return null;
  const n = Number(m[2]) * (m[3] === "k" ? 1e3 : m[3] === "m" ? 1e6 : 1) * (m[1] === "-" ? -1 : 1);
  return Number.isFinite(n) ? n : null;
};
// An amount for a money box: commas, up to two decimals, no sign ("380,000", "1,234.5").
export const amountText = (n) => Number.isFinite(Number(n)) && n !== "" && n !== null ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(n)) : "";
