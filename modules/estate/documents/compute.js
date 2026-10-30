// modules/estate/documents/compute.js -- PURE. The papers every adult should have (a will, powers of
// attorney for money and for health care, a living will, a HIPAA release), the ones that depend on the
// household (a guardian for children under 18, a trust), each one's status, and the reasons to look at
// a signed one again: it is old, or a child was born or someone joined the household after it was signed.
import { ageOn } from "../../../core/math/dates.js";

/** The documents, who needs each, and what it does, in plain words. */
export const KINDS = {
  will:       { label: "Will", per: "adult", what: "Says who gets what you own and who carries it out (the executor). Without one, state law decides." },
  guardian:   { label: "Guardian for the children", per: "household", when: "minors", what: "Named in the will: who raises the children if both parents die. Without it a court chooses." },
  poaFinance: { label: "Financial power of attorney", per: "adult", what: "Lets someone you trust pay the bills and run your accounts if you cannot." },
  poaHealth:  { label: "Health care power of attorney", per: "adult", what: "Names who makes medical decisions for you if you cannot speak for yourself (a health care proxy)." },
  livingWill: { label: "Living will", per: "adult", what: "Your wishes about life support and end-of-life care (an advance directive)." },
  hipaa:      { label: "HIPAA release", per: "adult", what: "Lets doctors talk to the people you name about your health." },
  trust:      { label: "Living trust", per: "household", optional: true, what: "Passes what you own without probate (the court process) and privately. Worth it in some states, with property in more than one state, or for complicated families." },
  letter:     { label: "Letter of instruction", per: "household", optional: true, what: "Not a legal paper: where everything is, the accounts, the passwords plan, funeral wishes. It saves the family weeks." },
};
export const STATUS = { done: "Signed", started: "In progress", none: "Not yet" };
/** Look at signed documents again after this many years (the usual advice: every three to five). */
export const REVIEW_YEARS = 5;

/**
 * compute(plan, { today }) -> {
 *   items: [{ key (kind or kind:personId), kind, label, what, personId, personName, optional, status, updatedAt, where, notes, stale, reasons: [text], id (stored row) }],
 *   required, done, share, minors: [names], warnings
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const people = plan.household?.people ?? [];
  const adults = people.filter((p) => p.role !== "dependent");
  const minors = people.filter((p) => p.role === "dependent" && (!p.birthDate || !today || ageOn(p.birthDate, today) < 18));
  const rows = plan.estate?.documents ?? [];
  const find = (kind, personId) => rows.find((r) => r.kind === kind && (r.personId ?? "") === (personId ?? "")) ?? null;
  const items = [];
  for (const [kind, k] of Object.entries(KINDS)) {
    if (k.when === "minors" && !minors.length) continue;
    const owners = k.per === "adult" ? (adults.length ? adults : [{ id: "", name: "You" }]) : [{ id: "", name: "" }];
    for (const o of owners) {
      const r = find(kind, o.id);
      const status = STATUS[r?.status] ? r.status : r?.done ? "done" : "none";
      const updatedAt = r?.updatedAt || "";
      const reasons = [];
      if (status === "done" && updatedAt && today) {
        const years = ageOn(updatedAt, today);
        if (years >= REVIEW_YEARS) reasons.push(`signed ${years} years ago`);
        // someone in the household was born after it was signed
        for (const p of people) if (p.birthDate && p.birthDate > updatedAt && (kind === "will" || kind === "guardian" || kind === "trust")) reasons.push(`${p.name} was born after it was signed`);
      }
      items.push({ key: o.id ? `${kind}:${o.id}` : kind, kind, label: k.label, what: k.what, personId: o.id, personName: o.name, optional: !!k.optional, status, updatedAt, where: r?.where ?? "", notes: r?.notes ?? "", stale: reasons.length > 0, reasons, id: r?.id ?? null });
    }
  }
  const required = items.filter((x) => !x.optional);
  const done = required.filter((x) => x.status === "done").length;
  const warnings = [];
  if (minors.length && items.find((x) => x.kind === "guardian")?.status !== "done") warnings.push(`No guardian is named for ${minors.map((m) => m.name).join(" and ")}. If both parents died, a court would choose who raises ${minors.length > 1 ? "them" : minors[0].name}.`);
  return { items, required: required.length, done, share: required.length ? done / required.length : 0, minors: minors.map((m) => m.name), warnings };
}
