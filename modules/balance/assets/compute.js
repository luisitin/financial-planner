// modules/balance/assets/compute.js -- PURE. What you own outside your money accounts, in one list: homes and land,
// cars, other things counted in your net worth (all read from Net worth's accounts and the property pages, which stay
// where they are changed), and a home inventory of belongings (`belongings`, kept here): what each cost, when, a
// rough worth now, which policy covers it, and the things worth a look for an insurance claim.
import { countedBalance } from "../net-worth/compute.js";
import { growthRate } from "../../property/home/compute.js";
import { DEFAULTS as CAR } from "../../property/vehicles/compute.js";
import { monthsBetween, daysBetween } from "../../../core/math/dates.js";

/**
 * Kinds of belonging. `life`: an example of the years it lasts, used for the rough worth now (blank = it keeps its
 * value); round examples to change, not from a source. `special`: the kinds a standard home or renters policy pays
 * only a small amount for unless each is listed on the policy (Triple-I homeowners handbook; NAIC).
 */
export const KINDS = {
  electronics: { label: "Electronics and computers", life: 5 },
  appliances:  { label: "Appliances", life: 10 },
  furniture:   { label: "Furniture", life: 10 },
  sports:      { label: "Bikes and sports gear", life: 8 },
  tools:       { label: "Tools and equipment", life: 10 },
  instruments: { label: "Musical instruments", life: 15 },
  clothing:    { label: "Clothing and bags", life: 5 },
  jewelry:     { label: "Jewelry and watches", life: null, special: true },
  art:         { label: "Art and antiques", life: null, special: true },
  collectibles:{ label: "Collectibles (coins, stamps, cards)", life: null, special: true },
  silver:      { label: "Silverware and furs", life: null, special: true },
  guns:        { label: "Guns", life: null, special: true },
  other:       { label: "Something else", life: null },
};
/** The policy kinds (insurance/policies KINDS) that can cover belongings. */
export const COVERS_THINGS = ["home", "other"];

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ""));
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const kindOf = (k) => KINDS[k] ?? KINDS.other;

/**
 * One belonging's worth now: your own figure when you gave one; else, with the years it lasts, what you paid less an
 * even share for each year since you bought it (never below 0); else (it keeps its value) what you paid.
 * -> { worth, how: "yours" | "estimate" | "paid" | null, years (since bought), perYear (what it loses a year) }
 */
export function worthNow(item, today) {
  const paid = num(item?.paid), mine = num(item?.value), life = num(item?.life);
  const years = isDate(item?.bought) && isDate(today) && item.bought <= today ? daysBetween(item.bought, today) / 365.25 : null;
  const perYear = life > 0 && paid !== null ? paid / life : 0;
  if (mine !== null) return { worth: mine, how: "yours", years, perYear: 0 };
  if (paid === null) return { worth: null, how: null, years, perYear: 0 };
  if (life > 0) {
    if (years === null) return { worth: paid, how: "paid", years, perYear };
    const worth = Math.max(0, paid * (1 - years / life));
    return { worth: Math.round(worth * 100) / 100, how: "estimate", years, perYear: worth > 0 ? perYear : 0 };
  }
  return { worth: paid, how: "paid", years, perYear: 0 };
}

/** Insurance policies by id, and the ones that can cover belongings. */
function policiesOf(plan) {
  const all = (plan.insurance?.policies ?? []).filter((p) => p?.id);
  return { all, byId: new Map(all.map((p) => [p.id, p])), things: all.filter((p) => COVERS_THINGS.includes(p.kind)) };
}

/**
 * compute(plan, { today }) -> {
 *   homes: [{ accountId, entryId, name, rental, value, paid, bought, change, perYear (yearly growth), policy }],
 *   cars: [{ accountId, entryId, name, value, paid, bought, loss, lossYear }], carPolicies: [{ id, name }],
 *   others: [{ accountId, name, value }],
 *   items: [{ ...belonging, kindLabel, special, worth, how, years, perYear, policy, listed, flags }],
 *   totals: { counted (homes + cars + others on file as accounts), homes, cars, others, paid, worth, uncovered, uncoveredCount },
 *   checks: [{ id, text, go: [group, id] | null }], policies (that can cover belongings), lastChanged, empty
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const accounts = plan.accounts ?? [];
  const entries = (plan.property ?? []).filter(Boolean);
  const pol = policiesOf(plan);
  const linked = (id) => entries.find((e) => id && e.accountId === id) ?? null;
  const unlinked = (kinds) => entries.filter((e) => kinds.includes(e.kind) && !(e.accountId && accounts.some((a) => a.id === e.accountId)));

  // homes and land: the Real estate accounts, plus property-page entries with no account
  const homePol = pol.all.filter((p) => p.kind === "home");
  const homeRows = [
    ...accounts.filter((a) => a.type === "property").map((a) => ({ a, e: linked(a.id) ?? {} })),
    ...unlinked(["home", "rental"]).map((e) => ({ a: null, e })),
  ];
  const homes = homeRows.map(({ a, e }, i) => {
    const value = a ? countedBalance(a) : num(e.value) ?? 0;
    const paid = num(e.purchasePrice), bought = isDate(e.purchaseDate) ? e.purchaseDate : null;
    const months = bought && isDate(today) ? monthsBetween(bought, today) : null;
    // the policy: one tied to this home's account, else paired one to one as insurance/property pairs them
    const policy = (a && homePol.find((p) => p.accountId === a.id)) ?? (homeRows.length === homePol.length ? homePol[i] : homeRows.length === 1 && homePol.length === 1 ? homePol[0] : null) ?? null;
    return { accountId: a?.id ?? null, entryId: e.id ?? null, name: e.name || a?.name || "Home", rental: e.kind === "rental", value, paid, bought,
      change: paid !== null ? value - paid : null, perYear: paid !== null && months !== null ? growthRate(paid, value, months) : null,
      policy: policy ? { id: policy.id, name: policy.name || "Home policy" } : null };
  });

  // cars: the Vehicle accounts, plus property-page cars with no account (as property/vehicles lists them)
  const carRows = [
    ...accounts.filter((a) => a.type === "vehicle").map((a) => ({ a, e: linked(a.id) ?? {} })),
    ...unlinked(["vehicle"]).map((e) => ({ a: null, e })),
  ];
  const cars = carRows.map(({ a, e }) => {
    const value = a ? countedBalance(a) : num(e.value) ?? 0;
    const loss = num(e.loss) ?? CAR.car.loss;
    return { accountId: a?.id ?? null, entryId: e.id ?? null, name: e.name || a?.name || "Car", value, paid: num(e.purchasePrice), bought: isDate(e.purchaseDate) ? e.purchaseDate : null, loss, lossYear: value * loss };
  });
  const carPolicies = pol.all.filter((p) => p.kind === "auto").map((p) => ({ id: p.id, name: p.name || "Car policy" }));

  const others = accounts.filter((a) => a.type === "other_asset").map((a) => ({ accountId: a.id, name: a.name || "Other asset", value: countedBalance(a) }));

  // belongings
  const items = (plan.belongings ?? []).filter((b) => b?.id).map((b) => {
    const k = kindOf(b.kind), w = worthNow(b, today);
    const p = b.policyId ? pol.byId.get(b.policyId) : null;
    const flags = [];
    if (!p) flags.push("uncovered");
    if (p && k.special && !b.listed) flags.push("list-it");
    if (!String(b.proof ?? "").trim()) flags.push("no-proof");
    return { ...b, kindLabel: k.label, special: !!k.special, ...w, policy: p ? { id: p.id, name: p.name || "Policy" } : null, listed: !!b.listed, flags };
  }).sort((x, y) => String(x.room ?? "").localeCompare(String(y.room ?? "")) || String(x.name ?? "").localeCompare(String(y.name ?? "")));

  const sum = (list, f) => list.reduce((s, x) => s + (f(x) || 0), 0);
  const uncovered = items.filter((x) => x.flags.includes("uncovered"));
  const totals = {
    homes: sum(homes.filter((h) => h.accountId), (h) => h.value), cars: sum(cars.filter((c) => c.accountId), (c) => c.value), others: sum(others, (o) => o.value),
    paid: sum(items, (x) => num(x.paid)), worth: sum(items, (x) => x.worth), uncovered: sum(uncovered, (x) => x.worth), uncoveredCount: uncovered.length,
  };
  totals.counted = totals.homes + totals.cars + totals.others;

  const checks = [];
  for (const h of homes) if (!h.policy && !h.rental) checks.push({ id: `home-${h.accountId ?? h.entryId}`, text: `No home insurance on file for ${h.name}. Add its policy so a claim has the right numbers.`, go: ["insurance", "policies"] });
  for (const h of homes) if (!h.policy && h.rental) checks.push({ id: `home-${h.accountId ?? h.entryId}`, text: `No policy on file for the rental ${h.name}.`, go: ["insurance", "policies"] });
  if (cars.length && !carPolicies.length) checks.push({ id: "cars", text: `${cars.length === 1 ? "Your car has" : "Your cars have"} no car insurance on file.`, go: ["insurance", "policies"] });
  const names = (list) => (list.length <= 3 ? list.map((x) => x.name).join(list.length === 2 ? " and " : ", ") : `${list.length} belongings`);
  if (uncovered.length) checks.push({ id: "uncovered", text: `${names(uncovered)} ${uncovered.length === 1 ? "is" : "are"} not tied to a policy.${pol.things.length ? " Pick the policy that covers each one." : " Add your home or renters policy, then pick it for each one."}`, go: pol.things.length ? null : ["insurance", "policies"] });
  const listIt = items.filter((x) => x.flags.includes("list-it"));
  if (listIt.length) checks.push({ id: "list-it", text: `${listIt.length === 1 ? `${listIt[0].name} is` : `${listIt.length} things are`} the kind a standard policy pays only a small amount for (jewelry, art, collectibles, silver, furs, guns) unless ${listIt.length === 1 ? "it is" : "each is"} listed on the policy. Ask your insurer about listing ${listIt.length === 1 ? "it" : "them"}.`, go: null });
  const noProof = items.filter((x) => x.flags.includes("no-proof"));
  if (noProof.length) checks.push({ id: "no-proof", text: `${names(noProof)} ${noProof.length === 1 ? "has" : "have"} no note of where the receipt or photos are. An insurer pays for what you can show you owned.`, go: null });

  const changed = items.map((x) => x.updatedAt).filter(isDate).sort();
  return {
    homes, cars, carPolicies, others, items, totals, checks,
    policies: pol.things.map((p) => ({ id: p.id, name: p.name || "Policy", kind: p.kind })),
    lastChanged: changed.length ? changed[changed.length - 1] : null,
    empty: !homes.length && !cars.length && !others.length && !items.length,
  };
}

/** Add a belonging, or change the one with the same id, on the plan draft; changes `draft` in place. -> the stored item */
export function saveBelonging(draft, item, today) {
  const clean = {
    id: item.id, name: String(item.name ?? "").trim() || "Something", kind: KINDS[item.kind] ? item.kind : "other",
    room: String(item.room ?? "").trim(), bought: isDate(item.bought) ? item.bought : "", paid: num(item.paid),
    value: num(item.value), valuedAt: num(item.value) !== null ? (isDate(item.valuedAt) ? item.valuedAt : today ?? "") : "",
    life: num(item.life) > 0 ? num(item.life) : null, policyId: String(item.policyId ?? ""), listed: !!item.listed,
    details: String(item.details ?? "").trim(), proof: String(item.proof ?? "").trim(), updatedAt: today ?? "",
  };
  draft.belongings = draft.belongings ?? [];
  const i = draft.belongings.findIndex((b) => b.id === clean.id);
  if (i >= 0) draft.belongings[i] = clean; else draft.belongings.push(clean);
  return clean;
}

/** Remove a belonging by id. -> true when one went */
export function removeBelonging(draft, id) {
  const n = (draft.belongings ?? []).length;
  draft.belongings = (draft.belongings ?? []).filter((b) => b.id !== id);
  return draft.belongings.length < n;
}
