// modules/investments/crypto/txf.js -- PURE. The year's coin sales, as `coinSales` lays them out as Form 8949 lines, in
// the Tax Exchange Format (TXF) version 042 that some tax programs bring in (gap list, next 60, item 51). The file restates
// each line as it is: no figure is worked out here. Nothing is written to the plan; the page makes the file on the phone.
//
// The format, as read 2026-11-16 (README "A file for tax software (TXF)" has the sources and what could not be read):
//   header   V042 / A<program> / D<today, MM/DD/YYYY> / ^
//   a sale   TD / N<code> / C1 / L1 / P<what was sold> / D<date bought> / D<date sold> / $<cost> / $<proceeds> / ^
//   every line ends with a carriage return and a line feed.
// Codes: N712 a short-term sale and N714 a long-term sale with no form from a broker (Form 8949 box C or F). Version 042 has
// no code for the digital-asset boxes (G to L) the IRS added for 2025, so the page tells the person to check that their
// program files these sales as crypto.
import { formDay, realDay } from "./sales.js";

export const TXF_VERSION = "V042";
export const TXF_PROGRAM = "Planner";
/** The record codes by term: Form 8949 Part I box C (short-term) and Part II box F (long-term), "Copy C" in GnuCash's list. */
export const TXF_CODES = Object.freeze({ short: "N712", long: "N714" });

/** One line of plain text the format can carry: accents dropped (é -> e), line breaks and other control characters as a
 *  space, any other character outside printable ASCII dropped, spaces squeezed, trimmed. */
export function txfText(s) {
  return String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[^\x20-\x7e]/g, "").replace(/ {2,}/g, " ").trim();
}

/** An amount as the format writes it: "$", the dollars to the cent with two decimals, no thousands commas ("$9400.00"). */
export function txfMoney(n) {
  const c = Math.round((Number(n) || 0) * 100) / 100;
  return `$${(Object.is(c, -0) ? 0 : c).toFixed(2)}`;
}

/** A day as the format writes it (MM/DD/YYYY), only for a day on the calendar: anything else (none, or a hand-edited
 *  2026-02-31) is "" and its field a bare "D", for the person to type in the program (the green line says so). */
export const txfDay = (iso) => (realDay(iso) ? formDay(iso) : "");

/** What was sold, as the format can carry it: the line's own words ("0.1 BTC", `txfText`). A symbol with nothing the format
 *  can carry (only letters outside ASCII, "₿") reads "coin", as a line with no symbol does in `coinSales` ("0.1 coin"),
 *  never a bare "0.1". */
export function txfWhat(l) {
  const what = txfText(l.description);
  return typeof l.symbol === "string" && !txfText(l.symbol) ? `${what} coin`.trim() : what;
}

/** One Form 8949 line (`coinSales(...).lines[i]`) as a record, one entry per line of the file. A purchase with no date on
 *  file has a bare "D": the format's own way for a date acquired to be added in the tax program (README: code N673's
 *  description and GnuCash's record for it). The line is never left out, so no sale can go missing from the file. */
export function txfRecord(l) {
  return ["TD", l.term === "long" ? TXF_CODES.long : TXF_CODES.short, "C1", "L1", `P${txfWhat(l)}`,
    `D${txfDay(l.acquired)}`, `D${txfDay(l.sold)}`, txfMoney(l.cost), txfMoney(l.proceeds), "^"];
}

/** The whole file: the header (made `today`) and every line of the year's coin sales, in the list's order (by the day sold). */
export function txfFile(cs, params = {}) {
  const head = [TXF_VERSION, `A${TXF_PROGRAM}`, `D${txfDay(params.today ?? "")}`, "^"];
  return [...head, ...(cs?.lines ?? []).flatMap(txfRecord)].map((x) => `${x}\r\n`).join("");
}

/** Whether the page offers the file: not without a line; and, filing separately, only when every line is one person's
 *  (a file is brought into one return; a sale in neither name is split between the two returns, which a line cannot say). */
export function txfOffer(cs) {
  const lines = cs?.lines ?? [];
  if (!lines.length) return { ok: false, why: "none" };
  if (cs.separate) {
    const who = new Set(lines.map((l) => l.personId ?? null));
    if (who.size > 1 || who.has(null)) return { ok: false, why: "separate" };
  }
  return { ok: true, why: null };
}

/** What the person has to finish in their program: lines with no purchase date, lines whose day sold is not on the
 *  calendar (only a hand-edited plan has one), lines whose cost is not on file ($0). */
export function txfStats(cs) {
  const lines = cs?.lines ?? [];
  return { lines: lines.length, noDate: lines.filter((l) => !txfDay(l.acquired)).length, noSold: lines.filter((l) => !txfDay(l.sold)).length, noCost: lines.filter((l) => l.noCost).length };
}

/** The file's name. */
export const txfName = (cs) => `coin-sales-${cs.year}.txf`;

// ---------------------------------------------------------------- the words (one written sentence per case, each tested)
/** Above the buttons when the file is offered: the list's own sentence (sales.js `FORM_SCREEN`) naming all three ways, so
 *  the third button has its lead-in. Filing separately with no file, `FORM_SCREEN` stays as it is. */
export const TXF_FORM_SCREEN = "For your tax preparer or your tax program: print this list (the printout also says where each line goes on the form) or save it as a spreadsheet or as a file for tax software. It is not a filing.";
/** Under the buttons, before a tap: the one thing to know first, that the same sales must not come in twice ("the yearly
 *  form your exchange sends" places Form 1099-DA for a person who has never heard of it). The rest (import, the check that
 *  the program files them as crypto) is in the green line after the tap, where it is done; which programs are known to read
 *  the file is in the README. */
export const TXF_SCREEN = "If your tax program already has these sales from the yearly form your exchange sends (Form 1099-DA), skip the file for tax software: each sale would count twice.";
/** In place of the button, filing separately when the lines are not all one person's. True whether or not the spreadsheet
 *  has its "Whose" column (it has one only when a line names its owner). */
export const TXF_SEPARATE = "Filing separately, each of you reports your own sales, and a file for tax software would put them all on one return: split them between you from the spreadsheet or the printout.";

/** The green line after the tap: the file, where to bring it in, the check that the format cannot make for coins (version
 *  042 has no digital-asset boxes), then what is left to type in the program (one sentence per case). Short: the part
 *  before what is left to type is at most 22 words (the file's name already says what kind of file it is). */
export function txfSaid(name, st = {}) {
  const out = [`${name} is downloading. Import it into your tax program, then check that each sale is filed as crypto, not as stocks.`];
  if (st.noDate === 1) out.push("One line has no purchase date on file: type it there.");
  else if (st.noDate > 1) out.push(`${st.noDate} lines have no purchase date on file: type them there.`);
  if (st.noSold === 1) out.push("One line has a date sold that is not on the calendar: type the right one there.");
  else if (st.noSold > 1) out.push(`${st.noSold} lines have a date sold that is not on the calendar: type the right ones there.`);
  if (st.noCost === 1) out.push("One line has no cost on file and comes in at $0: type what you paid there.");
  else if (st.noCost > 1) out.push(`${st.noCost} lines have no cost on file and come in at $0: type what you paid there.`);
  return out.join(" ");
}
/** The red line when the phone cannot make the file (the spreadsheet's own words). */
export const txfFailed = (why) => `The file could not be made: ${why}. Reload the page and try again.`;
