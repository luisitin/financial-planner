// core/ui/checks.js -- what the form kit says about a box, and how it finds a row again. Pure (no DOM):
// tests/ui-checks.test.mjs. Used by core/ui/dom.js. Every sentence says what to type, never what the rule is called.
// validityWords is adapted from the forms2 design's wordsFor (wave 1 prototype, same repo, MIT), made pure over a plain record.
import { readAmount, amountText } from "../format.js";

export const FLOOR_DATE = "1900-01-01";          // a year typed as 0026 or 19 is refused at the box
export const CEILING = 1e9;                       // no household amount is a billion: a slip of extra digits

const has = (x) => x !== undefined && x !== null && x !== "";
const plain = (n, unit = "") => `${Math.abs(n) >= 10000 ? amountText(n) : String(Number(Number(n).toPrecision(12)))}${unit}`;   // years and ages without commas

/** A number typed in a number or percent box: "1,200", " 300 ", "2.555", "-2" (and "5%" in a percent box). Blank or nonsense is null. */
export function readNumber(raw, { percent = false } = {}) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (percent) s = s.replace(/\s*%$/, "");
  if (!s || /[km$€£¥]/i.test(s)) return null;      // "72k" and "$5" are money talk, not a count or a rate
  return readAmount(s);
}
/** What a number box holds once the person leaves it, so a page that reads Number(box.value) gets the number: "5,000" -> "5000". */
export const numberText = (raw, opts) => { const n = readNumber(raw, opts); return n === null ? String(raw ?? "") : String(n); };

/**
 * The kit's own words for a box it reads itself (money, number, percent), or "" when it has nothing to say. Blank is
 * left to `required` (the browser's valueMissing), so an empty box says nothing until Save.
 * spec: { kind: "money"|"number"|"percent", min?, max?, whole? }; money's max defaults to under a billion (max: null turns it off).
 */
export function boxWords(spec = {}, raw) {
  if (!has(raw) || !String(raw).trim()) return "";
  const s = String(raw).trim();
  if (spec.kind === "money") {
    const n = readAmount(s);
    if (n === null) return "Type an amount in numbers, like 4,500.";
    if (has(spec.min) && n < Number(spec.min)) return `Use ${spec.sign ?? "$"}${amountText(Number(spec.min))} or more.`;
    const max = spec.max === undefined ? CEILING : spec.max;
    if (has(max) && n > Number(max)) return Number(max) >= CEILING ? "That is more than a billion: check for an extra digit." : `Use ${spec.sign ?? "$"}${amountText(Number(max))} or less.`;
    return "";
  }
  const pc = spec.kind === "percent";
  const n = readNumber(s, { percent: pc });
  if (n === null) return pc ? "Type a number, like 3.5 for 3.5%." : "Type a number, like 12.";
  if (spec.whole && !Number.isInteger(n)) return "Use a whole number, like 12.";
  const u = pc ? "%" : "", lo = has(spec.min) ? Number(spec.min) : null, hi = has(spec.max) ? Number(spec.max) : null;
  if ((lo !== null && n < lo) || (hi !== null && n > hi)) {
    if (lo !== null && hi !== null) return `Use a number from ${plain(lo, u)} to ${plain(hi, u)}.`;
    return lo !== null ? `Use ${plain(lo, u)} or more.` : `Use ${plain(hi, u)} or less.`;
  }
  return "";
}

const dayText = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? ""); if (!m) return String(iso); return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }); };
/**
 * The words for a box the browser holds back, from a plain record of its state (dom.js builds it from the element):
 * { tag, type, kind, missing, title, min, max, step, value, maxLength, minLength, today, message,
 *   valid, customError, valueMissing, badInput, typeMismatch, rangeUnderflow, rangeOverflow, stepMismatch, tooLong, tooShort, patternMismatch }
 */
export function validityWords(r = {}) {
  if (r.valid) return "";
  if (r.customError && r.message) return r.message;   // the box's own words: the kit's (money, number, percent) or a page's
  const pct = r.kind === "percent" ? "%" : "";
  const lo = has(r.min) ? r.min : null, hi = has(r.max) ? r.max : null;
  if (r.valueMissing) return r.missing || (r.tag === "SELECT" ? "Choose one first." : r.type === "checkbox" ? "Check this box to go on." : r.type === "date" ? "Pick a date first." : r.kind === "money" ? "Type an amount first." : r.type === "tel" ? "Type a phone number first." : r.type === "email" ? "Type an email address first." : "Fill this in first.");
  if (r.badInput) return r.type === "date" ? "Type the whole date: month, day and year." : pct ? "Type a number, like 3.5 for 3.5%." : "Type a number, like 12.";
  if (r.typeMismatch) return r.type === "email" ? "Type an email address, like name@example.com." : "Check what you typed here.";
  if (r.rangeUnderflow || r.rangeOverflow) {
    if (r.type === "date") {
      if (r.rangeUnderflow && lo === FLOOR_DATE) return "Check the year: type all four digits, like 2026.";
      if (r.rangeOverflow && hi === r.today) return "Pick a date that is not in the future.";
      return r.rangeUnderflow ? `Pick a date on or after ${dayText(lo)}.` : `Pick a date on or before ${dayText(hi)}.`;
    }
    if (lo !== null && hi !== null) return `Use a number from ${plain(Number(lo), pct)} to ${plain(Number(hi), pct)}.`;
    return r.rangeUnderflow ? `Use ${plain(Number(lo), pct)} or more.` : `Use ${plain(Number(hi), pct)} or less.`;
  }
  if (r.stepMismatch) { const st = Number(r.step); if (st === 1 || !(st > 0)) return "Use a whole number, like 12."; return `Round it to the nearest ${plain(st)}, like ${plain(Math.round(Number(r.value) / st) * st)}.`; }
  if (r.tooLong) return `Use ${r.maxLength} characters or fewer.`;
  if (r.tooShort) return `Use at least ${r.minLength} characters.`;
  if (r.patternMismatch) return r.title || "Check what you typed here.";
  return "Check what you typed here.";
}

/** The line above a form's buttons when more than one box is held back. Semicolons: 62 labels hold a comma. */
export function summaryWords(labels) {
  const names = labels.map((l) => String(l ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
  if (names.length < 2) return "";
  const shown = names.slice(0, 4).join("; ");
  return `${names.length} boxes need a fix: ${shown}${names.length > 4 ? "; and more" : ""}.`;
}

/**
 * Does an optional box (a field with `more: true`) hold something a person should see without opening its fold? A typed
 * box does when it is not blank; an amount, number or percent when it is not blank and not 0 (pages store 0 for "none");
 * a choice list when it is not on its first choice (what an untouched list shows); a tick box never by itself (it
 * always holds an answer, and which one is "nothing" depends on the page: the page says so with `moreOpen`). The fold
 * opens by itself only then, so a first visit shows the short form and nothing a person typed is hidden.
 */
export function holdsSomething(fd = {}, value) {
  if (fd.type === "checkbox") return false;
  if (!has(value) || (typeof value === "string" && !value.trim())) return false;
  if (fd.type === "money" || fd.type === "number" || fd.type === "percent") return Number(value) !== 0;
  if (fd.type !== "select") return true;
  const first = (fd.options ?? [])[0];
  return String(value) !== String((first !== null && typeof first === "object" ? first.value : first) ?? "");
}

/** A row's words without its figures ("Store card $1,201" and "Store card $1,202" read the same; "Ana's 401(k)" and "Bo's 401(k)" do not). */
export const keyText = (text) => String(text ?? "").replace(/\s+/g, " ").replace(/[-+−]?[$€£¥]?\d[\d,.]*\s*(%|k|m)?/gi, "#").trim().slice(0, 80);
/**
 * Where a row is now, when the list around it was drawn again: the same position, but only when the list reads the same
 * row for row (same count, same words in the same order, figures aside). Anything else (a re-sort, a rename, a row
 * added or gone) is -1: the kit never guesses which row the person meant.
 */
export function sameRowIndex(before, now, index) {
  if (!Array.isArray(before) || !Array.isArray(now) || before.length !== now.length) return -1;
  if (!(index >= 0 && index < now.length)) return -1;
  return before.every((k, i) => k === now[i]) ? index : -1;
}
/** The keyboard's key for a box: "next" when a control follows it in its form, "done" for the last one. */
export const keyHint = (index, count) => (index >= 0 && index < count - 1 ? "next" : "done");
