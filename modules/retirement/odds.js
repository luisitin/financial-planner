// modules/retirement/odds.js -- the one plain way of saying how often the money lasts, for every page that shows it (Will the money
// last?, How much to take out, Required withdrawals, Financial independence, Chance the money lasts, Goal seek's careful line).
// Pure: no DOM, no imports, so a compute.js may use it too. Round 8 follow-up (owner: "no concepts / words too hard"): the pages said
// "9 of 10 markets", "about half of markets", "every market tried", "400 simulated markets" and "100 markets" for the same idea.
// The idea is: the plan is replayed through many pretend sequences of good and bad years (a "pretend future"); the share of pretend futures in which the
// money lasts is the chance. A "market" is not a pretend future, so no page says "markets" for one. (Money review UX 2: "tries" was never explained; a pretend future explains itself.)

/** The careful answer's yardstick, said once: spending that lasts even when the years go badly (only 1 try in 10 does worse). */
export const BAD_RUN = "even in a bad run of years";
/** The short explanation beside it, for the first place a page uses BAD_RUN. */
export const BAD_RUN_NOTE = "(only 1 in 10 is worse)";

/**
 * chanceWords(share, { exact }) -> what follows "the money lasts" for a share of pretend futures in which it did (0 to 1):
 *   100%             "in every pretend future we ran"
 *   90% or more      "even in a bad run of years"
 *   45% to under 60% "about half the time"
 *   under 10%        "in fewer than 1 of 10 pretend futures"
 *   else             "in about N of 10 pretend futures" (N rounded down, never 9 under 90%)
 * `exact` (the default) adds the number where one helps: "even in a bad run of years (93 of 100 pretend futures last)", the percent rounded
 * down, never 100 unless it is every pretend future.
 */
export function chanceWords(share, { exact = true } = {}) {
  const s = Number(share) || 0;
  const n = Math.max(0, Math.min(100, Math.floor(s * 100)));
  if (s >= 1) return "in every pretend future we ran";
  const words = s >= 0.9 ? BAD_RUN : s >= 0.45 && s < 0.6 ? "about half the time" : s < 0.1 ? "in fewer than 1 of 10 pretend futures" : `in about ${Math.min(8, Math.floor(s * 10))} of 10 pretend futures`;
  return exact ? `${words} (${n} of 100${/pretend futures$/.test(words) ? "" : " pretend futures last"})` : words;
}
