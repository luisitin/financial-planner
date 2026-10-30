// modules/estate/beneficiaries/compute.js -- PURE. Retirement accounts, life insurance, HSAs, 529s and
// accounts with a payable-on-death or transfer-on-death form pass to the people named on them, whatever
// the will says. Every one of them, who is named, and what is wrong: no one named, no backup, shares
// that do not add up, a child under 18 named directly, the estate named, a spouse missing from a 401(k).
import { ACCOUNT_TYPES, countedBalance } from "../../balance/net-worth/compute.js";
import { ageOn } from "../../../core/math/dates.js";

/** The accounts that take a beneficiary, and what the form is called. */
export const NAMED = {
  "401k": "beneficiary form", ira: "beneficiary form", roth: "beneficiary form", hsa: "beneficiary form",
  "529": "successor owner", brokerage: "transfer-on-death (TOD) form", checking: "payable-on-death (POD) form", savings: "payable-on-death (POD) form", cash_value_life: "beneficiary form",
};
const RETIREMENT = ["401k", "ira", "roth"];
export const REVIEW_YEARS = 5;
export const ESTATE = /^(my |the )?estate$/i;

/** One beneficiary list as stored (an array of { name, share, personId }) or, from older rows, a plain name. */
export function listOf(v) {
  if (!v) return [];
  if (typeof v === "string") return v.trim() ? [{ name: v.trim(), share: 1 }] : [];
  return (Array.isArray(v) ? v : []).filter((b) => b && String(b.name ?? "").trim()).map((b) => ({ name: String(b.name).trim(), share: Number(b.share) >= 0 && b.share !== null && b.share !== "" ? Number(b.share) : null, personId: b.personId ?? "" }));
}

/**
 * compute(plan, { today }) -> {
 *   items: [{ key, source: "account"|"policy", id, name, ownerId, typeLabel, form, value, primary, contingent, reviewedAt, flags: [text], ok }],
 *   count, named (with a primary), missingValue (money with no one named), married, warnings
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const people = plan.household?.people ?? [];
  const adults = people.filter((p) => p.role !== "dependent");
  const married = ["married_joint", "married_separate", "qualifying_surviving"].includes(plan.household?.filingStatus) || adults.length > 1;
  const minors = people.filter((p) => p.role === "dependent" && p.birthDate && today && ageOn(p.birthDate, today) < 18);
  const isMinor = (b) => minors.some((m) => m.id === b.personId || m.name.toLowerCase() === b.name.toLowerCase());
  const rows = plan.estate?.beneficiaries ?? [];
  const sources = [
    ...(plan.accounts ?? []).filter((a) => NAMED[a.type]).map((a) => ({ key: `account:${a.id}`, source: "account", id: a.id, name: a.name, typeLabel: ACCOUNT_TYPES[a.type]?.label ?? a.type, form: NAMED[a.type], value: countedBalance(a), type: a.type, ownerId: a.ownerId ?? "" })),
    ...(plan.insurance?.policies ?? []).filter((x) => ["term", "whole"].includes(x.kind) && !(x.endDate && today && x.endDate < today)).map((x) => ({ key: `policy:${x.id}`, source: "policy", id: x.id, name: x.name, typeLabel: "Life insurance", form: "beneficiary form", value: Number(x.benefit) || 0, type: x.kind, ownerId: x.personId ?? "" })),
  ];
  const items = sources.map((s) => {
    const r = rows.find((x) => (x.key ?? (x.accountId ? `account:${x.accountId}` : x.policyId ? `policy:${x.policyId}` : "")) === s.key) ?? null;
    const primary = listOf(r?.primary), contingent = listOf(r?.contingent);
    const reviewedAt = r?.reviewedAt ?? "";
    const flags = [];
    const sumOf = (l) => l.reduce((t, b) => t + (b.share ?? (l.length === 1 ? 1 : 0)), 0);
    if (!primary.length) flags.push(`no one is named: it would go through the will or the courts${RETIREMENT.includes(s.type) ? ", and a retirement account left to an estate usually has to be emptied faster, with more tax" : ""}`);
    else {
      if (Math.abs(sumOf(primary) - 1) > 0.005) flags.push(`the shares add up to ${Math.round(sumOf(primary) * 100)}%, not 100%`);
      if (!contingent.length) flags.push("no backup (contingent) beneficiary, if the first one dies first");
      else if (Math.abs(sumOf(contingent) - 1) > 0.005) flags.push(`the backup shares add up to ${Math.round(sumOf(contingent) * 100)}%, not 100%`);
    }
    for (const b of [...primary, ...contingent]) {
      if (isMinor(b)) flags.push(`${b.name} is under 18 and cannot take the money directly: a court would appoint someone. Name a trust, or a custodian "for ${b.name} under the Uniform Transfers to Minors Act"`);
      if (ESTATE.test(b.name)) flags.push("the estate is named: the money goes through probate, and retirement money loses time to spread the tax");
    }
    // ERISA: a married participant's 401(k) goes to the spouse unless the spouse signed a waiver
    const spouse = adults.find((a) => a.id !== s.ownerId && s.ownerId);
    if (s.type === "401k" && married && spouse && primary.length && !primary.some((b) => b.personId === spouse.id || b.name.toLowerCase() === spouse.name.toLowerCase())) flags.push(`${spouse.name} is not the main beneficiary: by federal law a married person's 401(k) goes to the spouse unless ${spouse.name} signed a waiver`);
    if (primary.length && reviewedAt && today) {
      if (ageOn(reviewedAt, today) >= REVIEW_YEARS) flags.push(`checked ${ageOn(reviewedAt, today)} years ago`);
      for (const p of people) if (p.birthDate && p.birthDate > reviewedAt) flags.push(`${p.name} was born after it was last checked`);
    }
    return { key: s.key, source: s.source, id: s.id, name: s.name, ownerId: s.ownerId, typeLabel: s.typeLabel, form: s.form, value: s.value, primary, contingent, reviewedAt, flags, ok: flags.length === 0 };
  });
  const missing = items.filter((x) => !x.primary.length);
  const warnings = [];
  if (missing.length) warnings.push(`${missing.length} of ${items.length} accounts and policies have no beneficiary on file here.`);
  return { items, count: items.length, named: items.length - missing.length, missingValue: missing.reduce((s, x) => s + x.value, 0), married, warnings };
}
