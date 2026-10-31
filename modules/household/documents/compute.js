// modules/household/documents/compute.js -- PURE. Where the household's important papers are kept (the place, never
// the paper or what it says): a checklist from FEMA's Emergency Financial First Aid Kit (identity, money and legal,
// medical), one row per insurance policy, the signed estate papers (read from estate/documents, which keeps their
// place), and papers you add. For each: where it is, where a copy is, who else knows; and what is worth a look.
import { compute as estateDocs } from "../../estate/documents/compute.js";
import { daysBetween } from "../../../core/math/dates.js";

/** The groups, in the order shown. "estate" rows are read from estate/documents; "own" holds the papers you add. */
export const GROUPS = {
  id:      { label: "Who you are", what: "Proves who everyone in the household is, to replace lost papers or apply for help after a disaster." },
  money:   { label: "Money, home and insurance", what: "Shows what you own and owe and what you are insured for." },
  medical: { label: "Health", what: "What a doctor or hospital needs if you cannot tell them." },
  estate:  { label: "Will and estate papers", what: "Kept on Estate documents; shown here so everything is in one list." },
  own:     { label: "Papers you added", what: "Anything else worth finding quickly." },
};

/**
 * The checklist. `per`: "person" (everyone), "adult" (not a dependent), "household" (one). `when`: shown only when the
 * plan has a home ("home") or a car ("car"); otherwise optional rows can be marked "do not
 * have". From FEMA's Emergency Financial First Aid Kit (household identification; financial and legal documentation;
 * medical information) and the tax-records rule from the IRS ("How long should I keep records?").
 */
export const PAPERS = [
  { key: "birth", group: "id", label: "Birth certificate", per: "person" },
  { key: "ssn", group: "id", label: "Social Security card", per: "person" },
  { key: "photoId", group: "id", label: "Driver's license or photo ID", per: "adult" },
  { key: "passport", group: "id", label: "Passport or green card", per: "person", optional: true },
  { key: "marriage", group: "id", label: "Marriage license or divorce papers", per: "household", optional: true },
  { key: "custody", group: "id", label: "Adoption or custody papers", per: "household", optional: true },
  { key: "military", group: "id", label: "Military discharge papers (DD 214)", per: "household", optional: true },
  { key: "taxReturns", group: "money", label: "Tax returns", per: "household", help: "The IRS can usually look back 3 years after you file (6 if a lot of income was left off, 7 for a loss on worthless stock or a bad debt), so keep each return and its papers at least that long. Keep papers about a home or shares until 3 years after you sell." },
  { key: "deed", group: "money", label: "House deed and mortgage papers", per: "household", when: "home", help: "You may need proof you own your home to get disaster help." },
  { key: "carTitle", group: "money", label: "Car titles and registration", per: "household", when: "car" },
  { key: "lease", group: "money", label: "Lease or rental agreement", per: "household", optional: true },
  { key: "statements", group: "money", label: "Recent bank, retirement and investment statements", per: "household" },
  { key: "loans", group: "money", label: "Loan papers and the list of your credit cards", per: "household", optional: true },
  { key: "inventory", group: "money", label: "Home inventory and photos of your things", per: "household", help: "The list on Asset register; keep a copy outside the home." },
  { key: "healthCards", group: "medical", label: "Health insurance and Medicare cards", per: "person" },
  { key: "medicines", group: "medical", label: "List of medicines, allergies and doctors", per: "person" },
];
/** Days after which a place is worth checking again. */
export const RECHECK_DAYS = 365;

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ""));
const text = (v) => String(v ?? "").trim();
/** The stored row key: the paper key, with the person's id when it is per person; "policy:<id>"; or the added paper's id. */
export const rowKey = (key, personId) => (personId ? `${key}:${personId}` : key);

/**
 * compute(plan, { today }) -> {
 *   groups: [{ key, label, what, rows: [{ key, paper, label, help, personId, personName, optional, readOnly, go,
 *             where, copy, who, none, notes, updatedAt, placed, done, stale }], placed, total }],
 *   placed, total (rows that count: not optional-and-empty, not "do not have"), share, checks: [{ id, text }], started
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const people = (plan.household?.people ?? []).filter((p) => p?.id);
  const adults = people.filter((p) => p.role !== "dependent");
  const stored = new Map((plan.papers ?? []).filter((r) => r?.key).map((r) => [r.key, r]));
  const has = {
    home: (plan.accounts ?? []).some((a) => a.type === "property") || (plan.property ?? []).some((e) => e?.kind === "home"),
    car: (plan.accounts ?? []).some((a) => a.type === "vehicle") || (plan.property ?? []).some((e) => e?.kind === "vehicle"),
  };
  const row = (key, base) => {
    const r = stored.get(key) ?? {};
    const where = text(r.where), none = !!r.none;
    const updatedAt = isDate(r.updatedAt) ? r.updatedAt : "";
    return { key, ...base, where, copy: text(r.copy), who: text(r.who), notes: text(r.notes), none, updatedAt, placed: !!where,
      done: !!where || none, stale: !!where && !!updatedAt && isDate(today) && daysBetween(updatedAt, today) > RECHECK_DAYS };
  };
  const groups = Object.entries(GROUPS).map(([key, g]) => ({ key, ...g, rows: [] }));
  const G = Object.fromEntries(groups.map((g) => [g.key, g]));

  for (const p of PAPERS) {
    const optional = !!p.optional || (p.when ? !has[p.when] : false);
    const owners = p.per === "person" ? (people.length ? people : [{ id: "", name: "" }]) : p.per === "adult" ? (adults.length ? adults : [{ id: "", name: "" }]) : [{ id: "", name: "" }];
    for (const o of owners) G[p.group].rows.push(row(rowKey(p.key, o.id), { paper: p.key, label: p.label, help: p.help ?? "", personId: o.id, personName: o.name ?? "", optional, readOnly: false, go: null }));
  }
  // one row per insurance policy, in the money group
  for (const pol of (plan.insurance?.policies ?? []).filter((x) => x?.id)) {
    G.money.rows.push(row(`policy:${pol.id}`, { paper: "policy", label: `Insurance policy: ${pol.name || "a policy"}`, help: "The policy papers, the claims phone number and what it covers.", personId: "", personName: "", optional: false, readOnly: false, go: null }));
  }
  // the signed estate papers, read-only (their place is kept on estate/documents)
  for (const e of estateDocs(plan, { today }).items.filter((x) => x.status === "done")) {
    const where = text(e.where);
    G.estate.rows.push({ key: `estate:${e.key}`, paper: "estate", label: e.label, help: "", personId: e.personId ?? "", personName: e.personName ?? "", optional: false, readOnly: true, go: ["estate", "documents"],
      where, copy: "", who: "", notes: "", none: false, updatedAt: "", placed: !!where, done: !!where, stale: false });
  }
  // papers you added
  for (const r of (plan.papers ?? []).filter((x) => x?.custom && x.key)) {
    G.own.rows.push({ ...row(r.key, { paper: "own", label: text(r.label) || "A paper", help: "", personId: "", personName: "", optional: false, readOnly: false, go: null }), custom: true });
  }

  const counts = (rows) => { const c = rows.filter((x) => !x.none && !(x.optional && !x.placed)); return { placed: c.filter((x) => x.placed).length, total: c.length }; };
  for (const g of groups) Object.assign(g, counts(g.rows));
  const all = groups.flatMap((g) => g.rows);
  const { placed, total } = counts(all);

  const checks = [];
  const missing = all.filter((x) => !x.done && !x.optional && !x.readOnly);
  if (missing.length) checks.push({ id: "missing", text: `${missing.length} ${missing.length === 1 ? "paper has" : "papers have"} no place written down yet.` });
  const estateNoPlace = all.filter((x) => x.readOnly && !x.placed);
  if (estateNoPlace.length) checks.push({ id: "estate", text: `${estateNoPlace.length === 1 ? `Your ${estateNoPlace[0].label.toLowerCase()} is` : `${estateNoPlace.length} signed estate papers are`} signed but not where ${estateNoPlace.length === 1 ? "it is" : "they are"}: add the place on Estate documents.`, go: ["estate", "documents"] });
  const noCopy = all.filter((x) => x.placed && !x.readOnly && !x.copy && (x.paper === "birth" || x.paper === "ssn" || x.paper === "passport" || x.paper === "deed" || x.paper === "carTitle" || x.paper === "policy" || x.paper === "inventory"));
  if (noCopy.length) checks.push({ id: "copy", text: `${noCopy.length} ${noCopy.length === 1 ? "paper has" : "papers have"} no copy kept anywhere else. A copy in another place (a safe deposit box, someone you trust, or a protected file) still exists after a fire or flood.` });
  const alone = all.filter((x) => x.placed && !x.readOnly && !x.who);
  if (alone.length && alone.length === all.filter((x) => x.placed && !x.readOnly).length) checks.push({ id: "who", text: "Nobody else is noted as knowing where your papers are. Tell one person you trust, or write it in your letter of instruction." });
  const stale = all.filter((x) => x.stale);
  if (stale.length) checks.push({ id: "stale", text: `${stale.length} ${stale.length === 1 ? "place was" : "places were"} written down over a year ago. Check ${stale.length === 1 ? "it is" : "they are"} still right.` });

  return { groups, placed, total, share: total ? placed / total : 0, checks, started: all.some((x) => x.done && !x.readOnly) };
}

/** Save a row's place on the plan draft (changes `draft` in place). Fields: where, copy, who, none, notes; `label` for an added paper. */
export function savePlace(draft, key, fields, today) {
  draft.papers = draft.papers ?? [];
  const i = draft.papers.findIndex((r) => r.key === key);
  const old = i >= 0 ? draft.papers[i] : { key };
  const next = { ...old, where: text(fields.where), copy: text(fields.copy), who: text(fields.who), none: !!fields.none, notes: text(fields.notes), updatedAt: today ?? "" };
  if (old.custom) next.label = text(fields.label ?? old.label) || "A paper";
  if (next.none) { next.where = ""; next.copy = ""; }
  if (i >= 0) draft.papers[i] = next; else draft.papers.push(next);
  return next;
}

/** Add a paper of your own; -> its key. */
export function addPaper(draft, id, label, fields = {}, today) {
  draft.papers = draft.papers ?? [];
  const key = `own:${id}`;
  draft.papers.push({ key, custom: true, label: text(label) || "A paper", where: text(fields.where), copy: text(fields.copy), who: text(fields.who), none: false, notes: "", updatedAt: today ?? "" });
  return key;
}

/** Forget a row's place (an added paper is removed). -> true when something went */
export function clearPlace(draft, key) {
  const n = (draft.papers ?? []).length;
  draft.papers = (draft.papers ?? []).filter((r) => r.key !== key);
  return draft.papers.length < n;
}
