// modules/balance/net-worth/metals.js -- PURE. Gold and silver held by weight (gap list, next 60, item 45; README "Gold and
// silver by weight"): an account of the kind "Something else I own" can carry `metal: { kind, weight, unit, price }`, and its
// balance is then the weight in troy ounces times the price of one ounce the person typed, with the day of that price as the
// account's `asOf`. Prices are never fetched: the person types the one they see, and the row says whose price and of which
// day. Every page goes on reading `balance`, so no total changes because of the weight; the weight only says how the balance
// was worked out, and lets the page work it again from a new price.

/** One troy ounce in grams: 480 grains of 64.79891 milligrams each (the grain is defined as exactly 64.79891 mg), so
 *  480 x 64.79891 mg = 31,103.4768 mg. Gold and silver are priced per troy ounce. */
export const TROY_OUNCE_GRAMS = 31.1034768;
export const GRAIN_MG = 64.79891;
export const GRAINS_PER_TROY_OUNCE = 480;
/** The metals a weight can be typed for, and the units of weight. */
export const METAL_KINDS = Object.freeze(["gold", "silver"]);
export const UNITS = Object.freeze(["oz", "g"]);

const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** The unit a metal is weighed in: "oz" or "g" as saved, "oz" when none is saved (the form's first choice); null for any other
 *  (a plan edited by hand: "kg" is not read as ounces, the account then reads as a plain thing with its balance). */
export const unitOf = (u) => (u === undefined || u === null || u === "" ? "oz" : UNITS.includes(u) ? u : null);

/** A weight in troy ounces: grams / 31.1034768; ounces as typed. 0 for anything that is not a weight above 0, or a unit not
 *  on the list. */
export function ouncesOf(weight, unit = "oz") {
  const w = Number(weight), u = unitOf(unit);
  if (!(w > 0) || !Number.isFinite(w) || !u) return 0;
  return u === "g" ? w / TROY_OUNCE_GRAMS : w;
}
/** What it is worth: ounces x the price of one ounce, to the cent (0 without a weight or a price). */
export function metalValue({ weight, unit = "oz", price } = {}) {
  const oz = ouncesOf(weight, unit), p = Number(price);
  return oz > 0 && p >= 0 && Number.isFinite(p) ? cents(oz * p) : 0;
}

/** An account held by weight: "Something else I own" with a metal of the list, a weight above 0 and a unit of the list. */
export const isMetal = (a) => !!a && typeof a === "object" && a.type === "other_asset" && !!a.metal && typeof a.metal === "object"
  && METAL_KINDS.includes(a.metal.kind) && Number(a.metal.weight) > 0 && Number.isFinite(Number(a.metal.weight)) && !!unitOf(a.metal.unit);

/**
 * metalOf(account) -> null, or { id, name, kind, weight, unit, ounces, price, typed, value, asOf }: `price` is the price of one
 * ounce the person typed while the balance still equals weight x it (to the cent; `typed` true), else the balance / ounces
 * (the balance was changed somewhere else, as on Update all balances: the row then says the price that balance means).
 */
export function metalOf(a) {
  if (!isMetal(a)) return null;
  const unit = unitOf(a.metal.unit);
  const weight = Number(a.metal.weight), ounces = ouncesOf(weight, unit);
  const value = Number(a.balance) || 0;
  const typedPrice = Number(a.metal.price);
  const typed = typedPrice >= 0 && Number.isFinite(typedPrice) && Math.abs(metalValue({ weight, unit, price: typedPrice }) - value) < 0.005;
  return { id: a.id, name: a.name ?? "", kind: a.metal.kind, weight, unit, ounces, price: typed ? typedPrice : cents(value / ounces), typed, value, asOf: typeof a.asOf === "string" && a.asOf ? a.asOf : null };
}

/** A weight as the row says it: "10 ounces", "1 ounce", "31.1 grams", "0.25 ounces" (up to four decimals, commas). */
export function weightText(weight, unit = "oz") {
  const n = Number(weight) || 0;
  const t = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);
  const one = t === "1";
  return unit === "g" ? `${t} ${one ? "gram" : "grams"}` : `${t} ${one ? "ounce" : "ounces"}`;
}

/** The row's line. The price typed on the form (the balance still equals weight x it): "10 ounces of gold at $2,400.00 an
 *  ounce, your price of 11/16/2026" (no day on file: "your price, with no day typed"). A balance changed somewhere else
 *  (Update all balances), so the price is only what it means: "10 ounces of gold, about $2,450.00 an ounce going by its
 *  balance of 11/20/2026" (no day: "going by its balance"). `price` writes a price with its cents, `date` a day as the page does. */
export function metalLine(m, price, date) {
  if (!m.typed) return `${weightText(m.weight, m.unit)} of ${m.kind}, about ${price(m.price)} an ounce going by its balance${m.asOf ? ` of ${date(m.asOf)}` : ""}`;
  const when = m.asOf ? `your price of ${date(m.asOf)}` : "your price, with no day typed";
  return `${weightText(m.weight, m.unit)} of ${m.kind} at ${price(m.price)} an ounce, ${when}`;
}
/** The green line after the form saves an account held by weight (R7: it names what it is worth now). */
export function metalSaid(name, m, added, price, money) {
  return `${name} ${added ? "added" : "saved"}: ${weightText(m.weight, m.unit)} of ${m.kind} at ${price(m.price)} an ounce, ${money(m.value)}.`;
}
/** What the form says when a box it needs is empty (one sentence each). */
export const NEED_WEIGHT = (kind) => `Type how much ${kind} you hold.`;
export const NEED_PRICE = "Type the price of one ounce.";
