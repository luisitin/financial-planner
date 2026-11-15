// modules/balance/net-worth/labels.js -- PURE, imports nothing. The person's own short labels on an account or a holding
// ("kids", "retirement"; gap next-60 #44): typed with commas between, or picked from the ones already used anywhere in the
// plan, saved with the record as `labels: [text]` (docs/DATA_MODEL.md). Net worth and Holdings show one row of chips to
// list only what carries a label, with its subtotal; nothing here writes the plan. Holdings imports these too.

/** The longest label, in characters: one chip fits a 320 px phone. */
export const LABEL_MAX = 30;
const squeeze = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
/** Two labels are the same when they differ only in capitals and spaces ("Kids" is "kids"). */
export const sameLabel = (a, b) => squeeze(a).toLowerCase() === squeeze(b).toLowerCase();
/**
 * cleanLabels(text or list) -> [label]: split at commas, spaces squeezed, empty pieces dropped, the same label twice kept
 * once (its first spelling). cleanLabels("kids, Retirement ,, Kids") -> ["kids", "Retirement"]. Nothing is cut: tooLong
 * names a label over LABEL_MAX, and the form holds it back with words.
 */
export function cleanLabels(x) {
  const pieces = (Array.isArray(x) ? x : [x]).flatMap((p) => (typeof p === "string" || typeof p === "number" ? String(p).split(",") : []));
  const out = [];
  for (const p of pieces) { const t = squeeze(p); if (t && !out.some((o) => sameLabel(o, t))) out.push(t); }
  return out;
}
/** A record's labels, cleaned (stored data may hold anything: not a list reads as none). */
export const labelsOf = (r) => (r && Array.isArray(r.labels) ? cleanLabels(r.labels) : []);
/** Does the record carry this label (capitals not counted)? */
export const hasLabel = (r, label) => labelsOf(r).some((l) => sameLabel(l, label));
/** labelsIn(...lists of records) -> every label they carry, the first spelling met of each, in a-to-z order. */
export function labelsIn(...lists) {
  const out = [];
  for (const list of lists) for (const r of Array.isArray(list) ? list : []) for (const l of labelsOf(r)) if (!out.some((o) => sameLabel(o, l))) out.push(l);
  return out.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}
/** The labels used anywhere in the plan (accounts and holdings): the chips a form offers to pick from. */
export const planLabels = (plan) => labelsIn(plan?.accounts, plan?.holdings);
/** spellAs(labels, known) -> the labels, each spelled as the known label it matches ("Kids" typed, "kids" on file: "kids"). */
export const spellAs = (labels, known = []) => labels.map((l) => known.find((k) => sameLabel(k, l)) ?? l);
/** tooLong(text or list) -> the first label longer than LABEL_MAX, or null. */
export const tooLong = (x) => cleanLabels(x).find((l) => l.length > LABEL_MAX) ?? null;
/** labelChange(before, after) -> null when the two hold the same labels (order and capitals not counted), else the new list. */
export function labelChange(before, after) {
  const a = cleanLabels(before), b = cleanLabels(after);
  return a.length === b.length && a.every((x) => b.some((y) => sameLabel(x, y))) ? null : b;
}
/** The green line's words for a change of labels: "Labels: kids, retirement." / "Label: kids." / "No labels now." */
export const labelWords = (list) => (!list ? "" : !list.length ? "No labels now." : `${list.length === 1 ? "Label" : "Labels"}: ${list.join(", ")}.`);
/** toggleIn(text, label) -> the box's text with the label added at the end, or taken out when it is there (a chip's tap). */
export function toggleIn(text, label) {
  const now = cleanLabels(text);
  const next = now.some((l) => sameLabel(l, label)) ? now.filter((l) => !sameLabel(l, label)) : [...now, label];
  return next.join(", ");
}
