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

/** needButtons(ui, missing, { quiet }) -> a ui.row of links, the first filled and the rest outlined, or null when none applies.
 * `quiet`: all outlined, when the page already shows a filled button above (the Social Security notice's "Add Social Security";
 * whole-app sweep x3, 2026-11-16: two filled buttons on one first view). */
export function needButtons(ui, missing, { quiet = false } = {}) {
  const seen = new Set();
  const acts = (missing ?? []).map(needAct).filter((a) => a && !seen.has(a.href) && seen.add(a.href));
  if (!acts.length) return null;
  return ui.row(...acts.map((a, i) => ui.h("a", { class: i || quiet ? "btn secondary" : "btn", href: a.href }, a.label)));
}

/**
 * unknownHero(ui, words, { title }) -> the hero for a plan with nothing saved for retirement and nothing going in (projection's
 * retirementUnknown; `words` from its unknownWords): the page's title, the one sentence, and one filled link to Net worth, as Will
 * the money last?, Goal seek and What matters most show it (whole-app sweep x3, 2026-11-16: twelve pages said "runs out at 65").
 */
export function unknownHero(ui, words, { title = "We don't know yet", quiet = false } = {}) {
  return ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, title), ...unknownBody(ui, words, { quiet }));
}
/** The hero's inside alone (the sentence and the link), for a page whose hero is already drawn while its answer is worked out.
 * `quiet`: the link outlined, under the Social Security notice's filled "Add Social Security" (as Will the money last? does). */
export function unknownBody(ui, words, { quiet = false } = {}) {
  return [ui.h("p", { class: "lede" }, words), ui.row(ui.h("a", { class: quiet ? "btn secondary" : "btn", href: "#/balance/net-worth" }, "Add what you own ›"))];
}
