// tests/health-score-words.mjs -- for the invariance tests only (not a test file itself): Plan health score's words of
// 452408a put back on its output (ha2, 2026-11-17: one ask for a missing Social Security figure, the retirement part in plain
// words). On the score's output before that change every function here is a no-op, so a digest written from that code compares
// with the output after it, put back; nothing but these words may differ. What changed, and how it is put back:
//   - "Retirement on track", lasting: "The plan can carry about $X a month; you plan to spend $Y." was "... a month against the
//     $Y it plans (N%).", N = round(ratio x 100); `ratio` (new, on a scored retirement part) is taken out;
//   - the part that asks for the missing figure (it carries `unlock`, new, taken out, as is its new `query` { show }) says the ask
//     in its own short words (askWords: "Add Sam's Social Security estimate from ssa.gov/myaccount, or say Sam won't get it."): put
//     back as setup's retirementGap(plan) fix, called as 452408a called it (without today);
//   - Protection asking (the retirement part scored without the figure): "Not scored yet: checking life's shocks, like a death or a
//     long life, needs X." was "Not scored yet: the stress tests need X first.";
//   - the retirement part with the plan not runnable: "We can't tell yet whether your money lasts." was "The plan cannot be run yet.";
//   - "The plan knows enough" leaves out what that ask fills (Social Security, birth dates; a birth date also when no adult has
//     one and the retirement part asks for it): put back where its list had it, in its words then ("add Sam's Social Security (as
//     above)" while the retirement part was scored without it, else "add a Social Security figure for every adult"; "add a birth
//     date for every adult");
//   - `askedIn` (new: the part whose ask these points wait on) is taken out.
import { lastsWithoutSs, retirementGap } from "../modules/overview/setup/compute.js";
import { ssOnIncome } from "../modules/retirement/projection/compute.js";

const BIRTH = "add a birth date for every adult", SS = "add a Social Security figure for every adult";
/** The completeness part's things, in its order (452408a), the Social Security one by key. */
const ORDER = [BIRTH, "add your accounts", "update your balances (at least every 90 days)", "enter your income and expenses", "ss", "say what you will spend in retirement", "look over your assumptions (once a year)"];
const isSs = (x) => x === SS || /^add .+ \(as above\)$/.test(x);
const at = (x) => (isSs(x) ? ORDER.indexOf("ss") : ORDER.indexOf(x));
const UNLOCK = / This unlocks up to .*$/;
/** The ask's own short words (askWords), as a step or a fix says them. */
const ASK = /^Add (?:your|.+'s|a) Social Security estimate (?:for .+ )?from ssa\.gov\/myaccount, or say .+ won't get it\.(?: Add .+ on People\.)?$|^Add (?:your birth date|.+'s birth date|the birth dates of .+) on People\.$/;
const PROTECTION_ASK = /^Not scored yet: checking life's shocks, like a death or a long life, needs (.+)\.$/;
const NOT_RUN = "We can't tell yet whether your money lasts.";
/** The ask as 452408a said it: setup's retirementGap fix, without today. */
const askBack = (plan) => { let g = null; try { g = retirementGap(plan); } catch { g = null; } return g?.fix ?? "Add Social Security on the Social Security page."; };

/** "The plan knows enough"'s fix as 452408a wrote it, from the fix now and the plan. */
export function knowsFixBack(fix, plan, today) {
  if (fix !== null && typeof fix !== "string") return fix;
  const people = (plan?.household?.people ?? []).filter((p) => p.role !== "dependent");
  const ss = plan?.retirement?.socialSecurity ?? {};
  // the two things the ask may fill, by the rule of 452408a (a figure, a record, or Social Security on the Income page)
  const birthMissing = !(people.length > 0 && people.every((p) => p.birthDate));
  const ssMissing = !(people.length > 0 && people.every((p) => (ss[p.id] && (Number(ss[p.id].monthlyAtFRA) > 0 || (ss[p.id].record ?? []).length)) || ssOnIncome(plan, p.id, today)));
  const items = fix ? fix.replace(/^Still to do: /, "").replace(/\.$/, "").split("; ") : [];
  const put = (word) => { const i = items.findIndex((x) => at(x) > at(word)); items.splice(i < 0 ? items.length : i, 0, word); };
  if (birthMissing && !items.includes(BIRTH)) put(BIRTH);
  if (ssMissing && !items.some(isSs)) {
    let without = null;
    try { without = lastsWithoutSs(plan, { today }); } catch { without = null; }
    put(without ? `add ${without.words} (as above)` : SS);
  }
  return items.length ? `Still to do: ${items.join("; ")}.` : null;
}

/** One part as 452408a gave it. */
export function partBack(p, plan, today) {
  if (!p || typeof p !== "object") return p;
  const { ratio, askedIn: _a, unlock, ...q } = p;
  if (typeof q.fix === "string") q.fix = q.fix.replace(UNLOCK, "");
  if (unlock !== undefined && typeof q.fix === "string" && ASK.test(q.fix)) q.fix = askBack(plan);
  if (q.query && typeof q.query === "object" && "show" in q.query) delete q.query;
  if (q.id === "protection" && typeof q.detail === "string") q.detail = q.detail.replace(PROTECTION_ASK, (_m, what) => `Not scored yet: the stress tests need ${what} first.`);
  if (q.id === "retirement" && q.detail === NOT_RUN) q.detail = "The plan cannot be run yet.";
  if (q.id === "retirement" && typeof q.detail === "string" && Number.isFinite(ratio)) {
    q.detail = q.detail.replace(/^The plan can carry about (\S+) a month; you plan to spend (\S+)\./, (_m, a, b) => `The plan can carry about ${a} a month against the ${b} it plans (${Math.round(ratio * 100)}%).`);
  }
  if (q.id === "knows" && (q.points < q.max)) q.fix = knowsFixBack(q.fix, plan, today);
  return q;
}

/** Plan health score's whole output as 452408a gave it (parts and gains alike). */
export function healthBack(d, plan, today) {
  if (!d || typeof d !== "object" || !Array.isArray(d.parts)) return d;
  return { ...d, parts: d.parts.map((p) => partBack(p, plan, today)), gains: (d.gains ?? []).map((p) => partBack(p, plan, today)) };
}

/** A list of steps quoting the score's fixes ({ title, detail }: Plan summary's next steps, the yearly review's), as then. */
export function stepsBack(steps, plan, today) {
  if (!Array.isArray(steps)) return steps;
  return steps.map((s) => {
    if (!s || typeof s.detail !== "string") return s;
    if (UNLOCK.test(s.detail)) return { ...s, detail: s.detail.replace(UNLOCK, "") };
    if (ASK.test(s.detail)) return { ...s, detail: askBack(plan) };
    if (/^Still to do: /.test(s.detail)) return { ...s, detail: knowsFixBack(s.detail, plan, today) };
    return s;
  });
}

/** Plan summary's output as 452408a gave it: its next steps quote the score's fixes. */
export function summaryBack(s, plan, today) {
  if (!s || typeof s !== "object" || !Array.isArray(s.nextSteps)) return s;
  return { ...s, nextSteps: stepsBack(s.nextSteps, plan, today) };
}
