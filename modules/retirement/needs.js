// modules/retirement/needs.js -- the view side, shared by the retirement pages that cannot work out their answer yet: one
// button for each thing the plan still needs, each going where that thing is typed, the first one filled. (Stress test
// 2026-11-11, RB2 and R-A9: the empty pages listed what was missing as plain text and sent a newcomer to Will the money last?,
// which listed the same things again before anything could be typed; some made the way on a small word inside a sentence.)
// It reads projection buildInputs' `missing` strings (the golden keys read them, so they stay as they are) and is DOM only.

/** needAct(text) -> { href, label } for one `missing` string, or null when no page types it (e.g. a plan longer than the history). */
export function needAct(text) {
  const t = String(text);
  if (/^a person with a birth date on the People page$/.test(t)) return { href: "#/household/people", label: "Add people ›" };
  if (/People page/.test(t)) return { href: "#/household/people", label: "Check People ›" };
  if (/Net worth page/.test(t)) return { href: "#/balance/net-worth", label: "Add what you own ›" };
  // the box is on Will the money last?, which opens its settings at the box for ?type=spending
  if (/spend in retirement/.test(t)) return { href: "#/retirement/projection?type=spending", label: "Type what you'll spend ›" };
  return null;
}

/** needButtons(ui, missing) -> a ui.row of links, the first filled and the rest outlined, or null when none applies. */
export function needButtons(ui, missing) {
  const seen = new Set();
  const acts = (missing ?? []).map(needAct).filter((a) => a && !seen.has(a.href) && seen.add(a.href));
  if (!acts.length) return null;
  return ui.row(...acts.map((a, i) => ui.h("a", { class: i ? "btn secondary" : "btn", href: a.href }, a.label)));
}
