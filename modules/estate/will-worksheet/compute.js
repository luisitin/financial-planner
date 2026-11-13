// modules/estate/will-worksheet/compute.js -- PURE. "Choices to take to a lawyer" (gap design #14): the choices a will
// and its sister papers ask for, written down in plain words before the visit, and the sheet that prints them. It gives
// no legal advice and works out one thing only: the shares of "who gets what" must add up to 100%.
//
// What is kept where (one place for each thing):
//   estate.worksheet           this page's own choices (optional; absent until something is saved)
//   estate.documents guardian  `who`: who would raise the children, the same box as on Estate documents
//   estate.wishes.pets         pets and who takes them, the same box as Final wishes (If something happens to us)
import { ageOn } from "../../../core/math/dates.js";
import { heldOut, saveWishes } from "../../reports/if-something-happens/compute.js";

/** The five rows the page shows, in order. `main`: counted in the headline; the others are optional. */
export const ROWS = [
  { key: "children", title: "For the children", main: true },
  { key: "people", title: "Who acts for you", main: true },
  { key: "rest", title: "Who gets what", main: true },
  { key: "gifts", title: "Special gifts", main: false },
  { key: "other", title: "Pets and notes", main: false },
];
/** What each row asks, in plain words (the first lines of its form). */
export const INTROS = {
  children: "If neither parent were alive: who would bring up the children, and at what age each child would get their share to spend as they like. Ask the lawyer how money can be looked after for a child until then.",
  people: "The people you would trust with each job. Many couples name each other first; a second choice is for when the first cannot do it. Ask each person before you name them.",
  rest: "After any special gifts, who gets everything else you own? Write each person or cause and their share. Leave every share empty to split it equally.",
  gifts: "One thing you want a particular person to have: a ring, a piano, a sum of money. Leave this empty if there is nothing like that.",
  other: "Who would take your pets, and anything else you want to ask or tell the lawyer: a family situation, a home in another state, a question you do not want to forget.",
};
/** The seven sections of the printed sheet, in the order a lawyer's questions usually come, then the notes. */
export const SHEET = [
  { key: "guardian", title: "Who would raise the children" },
  { key: "executor", title: "Who carries out our will" },
  { key: "rest", title: "Who gets what" },
  { key: "gifts", title: "Special gifts" },
  { key: "childrenMoney", title: "Money for the children" },
  { key: "pets", title: "Pets" },
  { key: "powers", title: "The two powers of attorney" },
  { key: "notes", title: "Other notes and questions" },
];
/** The text boxes of `estate.worksheet`, by row. */
export const TEXT_KEYS = ["executor", "executorBackup", "guardianBackup", "poaMoney", "poaHealth", "notes"];
/** How many "who gets what" names and special gifts the forms offer (stored lists may be longer; they are kept). */
export const SLOTS = 4;
/** Shares are fractions; a sum this close to 1 counts as 100% (33.3% + 33.3% + 33.4% does, 33% three times does not). */
export const SHARE_TOLERANCE = 0.0005;
export const NOT_DECIDED = "Not decided yet.";

/** A list from the plan, or none when the plan holds something else there (a hand-edited or damaged file). */
const arr = (v) => (Array.isArray(v) ? v : []);
const text = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
/** A fraction as a percentage in words: 0.5 -> "50%", 0.333 -> "33.3%". */
export const pct = (x) => `${Math.round(Number(x) * 1000) / 10}%`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const andList = (a) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

/**
 * The shares check (the page's one formula). rows: [{ name, share }] with share a fraction (0.5) or empty.
 * -> { ok, rows: [{ name, share }] (cleaned; equal shares filled in), sum, error (one plain sentence, "" when ok) }
 *   - a row with neither a name nor a share is dropped; no rows left is fine (nothing decided yet)
 *   - a share without a name is refused
 *   - every share empty: each name gets 1 / n
 *   - some shares empty and some not: refused
 *   - a share must be above 0 and at most 100%
 *   - | sum of shares - 1 | must be at most SHARE_TOLERANCE, else refused with what is missing or over
 */
export function sharesCheck(rows) {
  const list = (rows ?? []).map((r) => ({ name: text(r?.name), share: r?.share === null || r?.share === undefined || r?.share === "" || !Number.isFinite(Number(r.share)) ? null : Number(r.share) }))
    .filter((r) => r.name || r.share !== null);
  const bad = (error, sum = 0) => ({ ok: false, rows: list, sum, error });
  if (!list.length) return { ok: true, rows: [], sum: 0, error: "" };
  const nameless = list.find((r) => !r.name);
  if (nameless) return bad(`Write who gets the ${pct(nameless.share)} share.`);
  if (list.every((r) => r.share === null)) return { ok: true, rows: list.map((r) => ({ name: r.name, share: 1 / list.length })), sum: 1, error: "" };
  if (list.some((r) => r.share === null)) return bad("Give every name a share, or leave every share empty to split it equally.");
  if (list.some((r) => !(r.share > 0) || r.share > 1 + SHARE_TOLERANCE)) return bad("A share is more than 0% and at most 100%.");
  const sum = list.reduce((s, r) => s + r.share, 0);
  if (sum < 1 - SHARE_TOLERANCE) return bad(`The shares add up to ${pct(sum)}. They must add up to 100%: ${pct(1 - sum)} is still to give.`, sum);
  if (sum > 1 + SHARE_TOLERANCE) return bad(`The shares add up to ${pct(sum)}. They must add up to 100%: take off ${pct(sum - 1)}.`, sum);
  return { ok: true, rows: list, sum, error: "" };
}

/**
 * A special gift needs both halves. list: [{ what, to }] -> { ok, list (the rows with something in them), at (the index
 * of the first half-written row, -1 when none), missing ("what" | "to"), error (one plain sentence) }
 */
export function giftsCheck(list) {
  const rows = (list ?? []).map((g) => ({ what: text(g?.what), to: text(g?.to) }));
  const at = rows.findIndex((g) => !!g.what !== !!g.to);
  if (at < 0) return { ok: true, list: rows.filter((g) => g.what), at: -1, missing: "", error: "" };
  return rows[at].what ? { ok: false, list: rows, at, missing: "to", error: "Write who gets this gift." } : { ok: false, list: rows, at, missing: "what", error: "Write what the gift is." };
}

/** Are the shares all the same (so the sheet can say "in equal shares")? */
const equalShares = (rows) => rows.length > 1 && rows.every((r) => Math.abs(r.share - rows[0].share) < 1e-9);
/** "Who gets what" in one sentence, one written case each: no one, one name, equal shares, unequal shares. */
export function restWords(rows) {
  const list = (rows ?? []).filter((r) => r?.name);
  if (!list.length) return NOT_DECIDED;
  if (list.length === 1) return `Everything goes to ${list[0].name}.`;
  if (equalShares(list)) return `${andList(list.map((r) => r.name))} get equal shares.`;
  return `${list.map((r) => `${r.name} ${pct(r.share)}`).join(", ")}.`;
}

/** The stored worksheet, cleaned (texts trimmed, a text that looks like a password or holds a long number left out). */
function read(plan) {
  const w = plan?.estate?.worksheet ?? {};
  const safe = (v) => (heldOut(v) ? "" : text(v));
  const out = Object.fromEntries(TEXT_KEYS.map((k) => [k, safe(w[k])]));
  const age = Number(w.childrenAge);
  out.childrenAge = Number.isInteger(age) && age >= 1 && age <= 120 ? age : null;
  out.specific = (Array.isArray(w.specific) ? w.specific : []).map((g) => ({ what: safe(g?.what), to: safe(g?.to) })).filter((g) => g.what || g.to);
  out.rest = (Array.isArray(w.rest) ? w.rest : []).map((r) => ({ name: safe(r?.name), share: Number.isFinite(Number(r?.share)) && Number(r.share) > 0 ? Number(r.share) : 0 })).filter((r) => r.name);
  out.updatedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(w.updatedAt ?? "")) ? w.updatedAt : "";
  // kept by other pages, shown and changed here too
  const guardian = arr(plan?.estate?.documents).find((r) => r?.kind === "guardian" && !(r.personId ?? ""));
  out.who = safe(guardian?.who);
  out.pets = safe(plan?.estate?.wishes?.pets);
  return out;
}

/**
 * compute(plan, { today }) -> {
 *   values: { who, guardianBackup, childrenAge, executor, executorBackup, poaMoney, poaHealth, rest: [{ name, share }],
 *             specific: [{ what, to }], pets, notes, updatedAt },
 *   children: [names of the children under 18 on the People page], showChildren (the row is drawn: children under 18, or
 *             no one listed yet, or something already written in it),
 *   rows: [{ key, title, main, filled, says (the row's status, at most 20 characters) }],
 *   written, total (the main choices written down, of how many), any (anything at all written), done (every main one),
 *   sheet: [{ key, title, lines: [text] }] (the printed sheet: every section, "Not decided yet." where empty),
 *   lawyer (the name of a lawyer on Who to call, or ""), today
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const v = read(plan);
  const people = arr(plan?.household?.people).filter(Boolean);
  const minors = people.filter((p) => p.role === "dependent" && (!p.birthDate || !today || ageOn(p.birthDate, today) < 18));
  const childBits = [v.who, v.guardianBackup, v.childrenAge].filter(Boolean).length;
  const showChildren = minors.length > 0 || !people.length || childBits > 0;
  const peopleBits = [v.executor, v.executorBackup, v.poaMoney, v.poaHealth].filter(Boolean).length;
  const otherBits = [v.pets, v.notes].filter(Boolean).length;
  const status = {
    children: { filled: childBits > 0, says: childBits ? `${childBits} of 3 filled in` : "not set yet" },
    people: { filled: peopleBits > 0, says: peopleBits ? `${peopleBits} of 4 filled in` : "not set yet" },
    rest: { filled: v.rest.length > 0, says: v.rest.length ? plural(v.rest.length, "name", "names") : "not set yet" },
    gifts: { filled: v.specific.length > 0, says: v.specific.length ? plural(v.specific.length, "gift", "gifts") : "optional" },
    other: { filled: otherBits > 0, says: otherBits ? `${otherBits} of 2 filled in` : "optional" },
  };
  const rows = ROWS.filter((r) => r.key !== "children" || showChildren).map((r) => ({ ...r, ...status[r.key] }));
  const main = rows.filter((r) => r.main);
  const written = main.filter((r) => r.filled).length;

  const or = (label, t) => `${label}: ${t || NOT_DECIDED}`;
  const lines = {
    guardian: [or("First choice", v.who), or("Second choice", v.guardianBackup)],
    executor: [or("First choice", v.executor), or("Second choice", v.executorBackup)],
    rest: [restWords(v.rest)],
    gifts: v.specific.length ? v.specific.map((g) => `${g.what || "(what is not written)"}: to ${g.to || "(not decided)"}`) : ["None written down."],
    childrenMoney: [v.childrenAge ? `Each child gets their share outright at age ${v.childrenAge}.` : or("The age each child gets their share outright", "")],
    pets: [v.pets || "Nothing written down."],
    powers: [or("Who handles the money if we cannot", v.poaMoney), or("Who makes medical decisions if we cannot", v.poaHealth)],
    notes: [v.notes || "None."],
  };
  const sheet = SHEET.filter((s) => showChildren || (s.key !== "guardian" && s.key !== "childrenMoney")).map((s) => ({ ...s, lines: lines[s.key] }));
  const lawyer = arr(plan?.contacts).find((c) => c?.role === "attorney" && (text(c.name) || text(c.firm)));
  return { values: v, children: minors.map((m) => m.name).filter(Boolean), showChildren, rows, written, total: main.length, any: rows.some((r) => r.filled), done: written === main.length,
    sheet, lawyer: lawyer ? text(lawyer.name) || text(lawyer.firm) : "", today };
}

/** The headline, one written sentence per case: nothing written, some main choices still open, every main choice written. */
export function headlineOf(d) {
  if (!d.any) return "Nothing written down yet";
  if (d.done) return "Your choices are written down";
  return `${d.written} of ${d.total} choices written down`;
}
/** The sentence under the headline, one per case. */
export function ledeOf(d) {
  if (!d.any) return "Write down your choices first; a lawyer turns them into a will.";
  if (d.done) return "Print the sheet and take it to a lawyer, who turns your choices into a will.";
  return "Write down the rest when you are ready, or print what you have. A lawyer turns your choices into a will.";
}
/** The line that is never folded: what this page is not. */
export const NOT_A_WILL = "This is not a will. State laws differ; a lawyer makes it valid.";
/** The link under it, one written sentence per case: a lawyer is on Who to call, or not yet. */
export function lawyerLinkWords(d) {
  return d.lawyer ? `Your lawyer, ${d.lawyer}, is on Who to call ›` : "Keep a lawyer's number on Who to call ›";
}

/** What a Save says when the row was empty and still is (nothing is written to the plan), one sentence per row. */
export function nothingWords(key) {
  return key === "gifts" ? "Nothing to save yet. Write the gift in the first box."
    : key === "other" ? "Nothing to save yet. Write something in a box first."
    : "Nothing to save yet. Write a name in the first box.";
}

/** Why a typed text is refused at its box, in words ("" when it is fine): never a password, never a full number. */
export function refusal(v) {
  const why = heldOut(v);
  return why === "secret" ? "This looks like a password or a recovery phrase. Write where it is kept, never the secret."
    : why === "number" ? "This holds a long number, like a full account or Social Security number. Write only the last four digits." : "";
}

/**
 * Save one row's form on the plan draft (changes `draft` in place). `patch` holds only that row's keys:
 *   children: { who, guardianBackup, childrenAge }   people: { executor, executorBackup, poaMoney, poaHealth }
 *   rest: { rest: [{ name, share }] } (already through sharesCheck)   gifts: { specific: [{ what, to }] }
 *   other: { pets, notes }
 * `who` goes to the guardian row of estate.documents (made with `newId` when there is none and a name was typed), `pets`
 * to estate.wishes; the rest to estate.worksheet, which is removed when nothing is left in it.
 */
export function saveWorksheet(draft, patch = {}, today = "", newId = "") {
  draft.estate = draft.estate ?? { documents: [], beneficiaries: [] };
  if ("who" in patch) {
    const who = text(patch.who);
    if (!Array.isArray(draft.estate.documents)) draft.estate.documents = [];
    const row = draft.estate.documents.find((r) => r?.kind === "guardian" && !(r.personId ?? ""));
    if (row) row.who = who;
    else if (who) draft.estate.documents.push({ id: newId || `guardian-${today}`, kind: "guardian", personId: "", status: "none", done: false, updatedAt: "", where: "", notes: "", who });
  }
  if ("pets" in patch) saveWishes(draft, { ...(draft.estate.wishes ?? {}), pets: patch.pets }, today);
  const w = { ...(draft.estate.worksheet ?? {}) };
  for (const k of TEXT_KEYS) if (k in patch) w[k] = text(patch[k]);
  if ("childrenAge" in patch) { const n = Number(patch.childrenAge); w.childrenAge = patch.childrenAge !== null && patch.childrenAge !== "" && Number.isInteger(n) && n >= 1 && n <= 120 ? n : null; }
  if ("specific" in patch) w.specific = (patch.specific ?? []).map((g) => ({ what: text(g?.what), to: text(g?.to) })).filter((g) => g.what || g.to);
  if ("rest" in patch) w.rest = (patch.rest ?? []).map((r) => ({ name: text(r?.name), share: Number(r?.share) })).filter((r) => r.name && r.share > 0);
  const holds = TEXT_KEYS.some((k) => w[k]) || w.childrenAge || (w.specific ?? []).length || (w.rest ?? []).length;
  if (!holds) { delete draft.estate.worksheet; return null; }
  draft.estate.worksheet = { ...Object.fromEntries(TEXT_KEYS.map((k) => [k, w[k] ?? ""])), childrenAge: w.childrenAge ?? null, specific: w.specific ?? [], rest: w.rest ?? [], updatedAt: today ?? "" };
  return draft.estate.worksheet;
}
