// modules/system/methods/compute.js -- pure. Turns the hand-written list (data/methods.js) into what the page shows:
// each topic with its status, its sentences, its sources with the day each was read said in words, and its pages.
// No plan field is read and none is written; there is no money math here.
import { METHODS } from "./data/methods.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The page's one sentence. */
export const INTRO = "Every answer is simple arithmetic on your own numbers and on published figures, such as tax tables and past returns.";
/** The words under it, small. */
export const PROMISE = "Tap a topic to see how. Each source shows the day we last read it.";
/** Said after the day under a source that is a link: the tap leaves the app. */
export const NEW_TAB = "Opens in a new tab.";

/** "2026-11-13" -> "November 13, 2026"; anything that is not a day -> "" (a source without a day is never shown). */
export function dayWords(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return "";
  const month = Number(m[2]), day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${MONTHS[month - 1]} ${day}, ${m[1]}`;
}
/** The line under a source's name: "Read November 13, 2026". */
export const readWords = (iso) => { const d = dayWords(iso); return d ? `Read ${d}` : ""; };
/** "1 source" / "3 sources". */
export const sourcesWords = (n) => `${n} source${n === 1 ? "" : "s"}`;

/**
 * compute(plan) -> { intro, promise, topics: [{ id, topic, status, says[], sources: [{ name, url, read, readWords }], pages[] }], sourceCount, newest }
 * The plan is not read: the page is the same for every household. A source without a read date is left out.
 */
export function compute() {
  const topics = METHODS.map((t) => ({
    id: t.id, topic: t.topic, status: t.status, says: [...t.says],
    sources: t.sources.filter((s) => readWords(s.read)).map((s) => ({ name: s.name, url: s.url ?? null, read: s.read, readWords: readWords(s.read) })),
    pages: [...t.pages],
  }));
  const all = topics.flatMap((t) => t.sources);
  return {
    intro: INTRO, promise: PROMISE, topics,
    sourceCount: new Set(all.map((s) => s.name)).size,
    newest: all.map((s) => s.read).sort().at(-1) ?? null,
  };
}
