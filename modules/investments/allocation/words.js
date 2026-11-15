// modules/investments/allocation/words.js -- PURE. What the row "Regions and sectors" says (gap list, next 60, item 49),
// one written sentence per case (docs/OPTIONAL.md R5), each read by a test in module.test.mjs.
import { money } from "../../../core/format.js";
import { REGIONS, SECTORS } from "./compute.js";

const pc = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
const and = (list) => (list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`);
const WHERE = { ...Object.fromEntries(REGIONS.map((r) => [r.key, r.words])), outside: "outside the US, not split yet" };

/** The first line inside the row. */
export const SPLITS_INTRO = "Our rough guide only tells US from international. A fund's own page on its company's website, usually under \"Portfolio\" or \"Composition\", lists where its stocks are and what kinds of business they are in: copy those percentages here.";
/** The stocks by region in words: "57% in the United States, 31% in other rich countries and 12% in emerging countries". */
export const regionWords = (rows) => and(rows.filter((r) => r.share > 0.0005).map((r) => `${pc(r.share)} ${WHERE[r.key]}`));
/** The green line after a region split is saved (R7: the new answer). */
export const regionSaved = (symbol, rows) => `Saved for ${symbol}. Your stocks are now ${regionWords(rows)}.`;
/** The green line after a split by kind of business is saved: its largest part. */
export function sectorSaved(symbol, sectors, cur) {
  const top = [...sectors.rows].sort((a, b) => b.share - a.share)[0];
  const words = SECTORS.find((s) => s.key === top.key)?.words ?? top.label.toLowerCase();
  return `Saved for ${symbol}. Of the ${money(sectors.split, cur)} of stocks split by kind of business, ${pc(top.share)} is ${words}, the largest part.`;
}
/** The green line after "Use our rough guide again". */
export const tableAgain = (symbol, kind, rows) => (kind === "region" ? `Saved: ${symbol} uses our rough guide again. Your stocks are now ${regionWords(rows)}.` : `Saved: ${symbol} is no longer split by kind of business.`);
/** The words after Undo. */
export const splitBack = (symbol) => `${symbol}'s split is as it was.`;
/** The one line under the regions: which funds still use the table (only US and international). */
export function regionTableLine(table) {
  if (!table.length) return "Every fund's stocks are split by region.";
  if (table.length === 1) return `${table[0]} still splits only into US and international, from our rough guide.`;
  return `${table.length} funds still split only into US and international, from our rough guide: ${and(table)}.`;
}
/** The line under the kinds of business. */
export function sectorLine(sectors, cur) {
  if (!sectors.typed) return "No fund is split by kind of business yet.";
  if (!sectors.table.length) return `Every fund's stocks are split by kind of business, ${money(sectors.split, cur)} in all.`;
  return `Over the ${money(sectors.split, cur)} of stocks split so far; not split yet: ${and(sectors.table)}.`;
}
/** Under a fund: where its split comes from. */
export function fundSub(x) {
  const region = x.regions ? `your split: ${pc(x.regions.us)} US, ${pc(x.regions.rich)} other rich, ${pc(x.regions.emerging)} emerging`
    : x.table.intl > 0.0005 ? `our rough guide: ${pc(x.table.us)} US, ${pc(x.table.intl)} international` : `our rough guide: ${pc(x.table.us)} US`;
  return `${region}${x.sectors ? " · split by kind of business" : ""}`;
}
/** A fund's name on its button: the symbol when it is short, else "it" ("Split VFFVX by region", "Split it by region"). */
const shortName = (x) => (String(x.symbol ?? "").length <= 10 ? x.symbol : null);
/** The fund's button: "Split VFFVX by region" until it has a split of its own, then "Change VFFVX's split". */
export const splitButton = (x) => {
  const n = shortName(x);
  return x.regions || x.sectors ? (n ? `Change ${n}'s split` : "Change its split") : `Split ${n ?? "it"} by region`;
};
/** Over the region boxes, what our rough guide says, so the form opens with the United States share in it (critic P3). */
export function guideLine(x) {
  const us = Math.round((x.table?.us ?? 0) * 100), intl = 100 - us;
  if (intl <= 0) return `Our rough guide puts all of ${x.symbol}'s stocks in the United States. Check it against the fund's page.`;
  if (us <= 0) return `Our rough guide puts all of ${x.symbol}'s stocks outside the US: split the 100 between other rich and emerging countries as the fund's page shows.`;
  return `Our rough guide puts ${us}% of ${x.symbol}'s stocks in the United States and ${intl}% outside it: check the ${us} against the fund's page, then split the ${intl} between the other two.`;
}
/** The region boxes as the form opens with no split of the fund's own: the United States share from our rough guide. */
export const guideValues = (x) => {
  const us = Math.round((x.table?.us ?? 0) * 100);
  return us > 0 ? { us } : {};
};
