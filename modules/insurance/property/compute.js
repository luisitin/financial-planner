// modules/insurance/property/compute.js -- PURE. Auto, home and umbrella cover against what you own:
// is the home insured for what it would cost to rebuild, are the liability limits on the cars and the
// home enough to protect your net worth from a lawsuit (retirement accounts are mostly out of reach),
// does an umbrella policy make sense and for how much, and do the deductibles fit in the cash you keep.
import { compute as computePolicies } from "../policies/compute.js";
import { compute as computeNetWorth, countedBalance } from "../../balance/net-worth/compute.js";
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { money as fmtMoney } from "../../../core/format.js";

/** Car liability per accident: at least the common 100/300/100 advice (state minimums are far lower). */
export const AUTO_MIN = 300000;
/** What umbrella insurers usually require underneath: car liability of 250/500 (500,000 per accident) and home liability of 300,000. */
export const UMBRELLA_UNDER = { auto: 500000, home: 300000 };
/** Home liability when the policy does not say: the usual lowest choice on a homeowners policy. */
export const HOME_LIABILITY_DEFAULT = 100000;
/** Home policies pay partial losses in full only when the dwelling cover is at least 80% of the cost to rebuild (the coinsurance clause). */
export const COINSURANCE = 0.8;
/** Umbrellas come in steps of $1 million; the first million usually costs $150 to $300 a year (Insurance Information Institute). */
export const UMBRELLA_STEP = 1000000, UMBRELLA_COST = [150, 300];
/** Out of a creditor's reach: 401(k)s and other employer plans in full (ERISA); IRAs in bankruptcy up to $1,711,975 (11 U.S.C. 522(n), from April 1, 2025). */
export const IRA_LIMIT = 1711975;
const IRA_TYPES = ["ira", "roth"];

/**
 * compute(plan, { today }) -> {
 *   netWorth, exposed (net worth less the retirement money a lawsuit cannot reach), shielded, ownsHome, homes: [{ name, value, policy, dwelling, rebuild, share, status: "ok"|"low"|"under"|"unknown"|"none" }],
 *   auto: { policies, liability } | null, homeLiability, umbrella, inCar, atHome, suggestedUmbrella, umbrellaCost: [low, high],
 *   deductibles: { total, cash, ok } | null, checks: [{ id, ok: true|false|null, title, text, go }], hasAny
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(Math.round(n), cur);
  const accounts = plan.accounts ?? [];
  const pol = computePolicies(plan, { today });
  const active = pol.items.filter((x) => !x.ended);
  const autos = active.filter((x) => x.kind === "auto"), homesPol = active.filter((x) => x.kind === "home"), umbrellas = active.filter((x) => x.kind === "umbrella");
  const nw = computeNetWorth(plan, { today });
  const k401 = accounts.filter((a) => a.type === "401k").reduce((s, a) => s + countedBalance(a), 0);
  const iras = accounts.filter((a) => IRA_TYPES.includes(a.type)).reduce((s, a) => s + countedBalance(a), 0);
  const shielded = k401 + Math.min(iras, IRA_LIMIT);
  const exposed = Math.max(0, nw.netWorth - shielded);

  // the homes against their dwelling cover: paired one to one when the counts match (or by accountId), else in total
  const properties = accounts.filter((a) => a.type === "property" && countedBalance(a) > 0);
  const homes = properties.map((a, i) => {
    const policy = homesPol.find((x) => x.accountId === a.id) ?? (properties.length === homesPol.length ? homesPol[i] : properties.length === 1 ? homesPol[0] : null) ?? null;
    const dwelling = policy ? Number(policy.benefit) || 0 : 0;
    const rebuild = policy && Number(policy.rebuildCost) > 0 ? Number(policy.rebuildCost) : null;
    const share = rebuild ? dwelling / rebuild : null;
    const status = !policy ? "none" : rebuild === null ? "unknown" : share >= 1 - 1e-9 ? "ok" : share >= COINSURANCE ? "low" : "under";
    return { id: a.id, name: a.name, value: countedBalance(a), policy: policy ? { id: policy.id, name: policy.name } : null, dwelling, rebuild, share, status };
  });
  const ownsHome = properties.length > 0;

  const autoLiability = autos.length ? Math.max(...autos.map((x) => Number(x.benefit) || 0)) : 0;
  const homeLiability = homesPol.length ? Math.max(...homesPol.map((x) => Number(x.liability) > 0 ? Number(x.liability) : HOME_LIABILITY_DEFAULT)) : 0;
  const homeLiabilityKnown = homesPol.some((x) => Number(x.liability) > 0);
  const umbrella = umbrellas.reduce((s, x) => s + (Number(x.benefit) || 0), 0);
  const inCar = autos.length ? autoLiability + umbrella : 0, atHome = homesPol.length ? homeLiability + umbrella : 0;
  const weakest = Math.min(...[autos.length ? inCar : null, homesPol.length ? atHome : null].filter((x) => x !== null), Infinity);
  const under = Math.max(autoLiability, homeLiability);
  const suggestedUmbrella = umbrella > 0 || exposed <= under ? 0 : Math.ceil((exposed - under) / UMBRELLA_STEP) * UMBRELLA_STEP;

  const checks = [];
  const add = (c) => checks.push(c);
  // 1. the home: insured for the cost to rebuild
  for (const h of homes) {
    if (h.status === "none") add({ id: `home-${h.id}`, ok: false, title: `${h.name} has no home insurance on file`, text: "Add the homeowners policy on Policies. A lender requires it while there is a mortgage; without one a fire is paid from savings.", go: ["insurance", "policies"] });
    else if (h.status === "unknown") add({ id: `home-${h.id}`, ok: null, title: `${h.name}: insured for ${money(h.dwelling)}`, text: `What matters is the cost to rebuild, not the price it would sell for (${money(h.value)}, land included, which does not burn). Ask the insurer for its rebuild estimate and enter it under Policy terms below.`, go: null });
    else add({ id: `home-${h.id}`, ok: h.status === "ok", title: h.status === "ok" ? `${h.name} is insured for the full cost to rebuild` : `${h.name} is insured for ${Math.round(h.share * 100)}% of the cost to rebuild`, text: h.status === "ok" ? `${money(h.dwelling)} of dwelling cover against a rebuild cost of ${money(h.rebuild)}.` : `${money(h.dwelling)} against ${money(h.rebuild)}. ${h.status === "under" ? `Under ${Math.round(COINSURANCE * 100)}%, most policies also cut what they pay for a partial loss, like a kitchen fire. ` : ""}Raising the dwelling cover to ${money(h.rebuild)} usually costs little.`, go: null });
  }
  if (!ownsHome && !homesPol.length) add({ id: "renters", ok: false, title: "No renters insurance on file", text: "Renters insurance covers your belongings and your liability if someone is hurt in your home. It usually costs a few hundred dollars a year or less.", go: ["insurance", "policies"] });
  // 2. the cars
  const vehicles = accounts.filter((a) => a.type === "vehicle" && countedBalance(a) > 0);
  const carLoans = accounts.filter((a) => a.type === "loan" && /car|auto|vehicle|truck/i.test(`${a.name} ${a.institution ?? ""}`));
  if (autos.length) add({ id: "auto", ok: autoLiability >= AUTO_MIN, title: autoLiability >= AUTO_MIN ? `Car liability: ${money(autoLiability)} per accident` : autoLiability > 0 ? `Car liability is low: ${money(autoLiability)} per accident` : "Car liability limit not entered", text: autoLiability >= AUTO_MIN ? `At or above the ${money(AUTO_MIN)} per accident (100/300/100) most advisers suggest as a floor.` : `Most advisers suggest at least ${money(AUTO_MIN)} per accident (100/300/100); state minimums are far lower and a serious accident costs much more. Raising the limits is usually cheap.`, go: autoLiability > 0 ? null : ["insurance", "policies"] });
  else if (vehicles.length || carLoans.length) add({ id: "auto", ok: false, title: "No car insurance on file", text: "Your accounts show a car. Add its policy on Policies with the liability limit per accident.", go: ["insurance", "policies"] });
  // 3. a lawsuit against what you own
  if (autos.length || homesPol.length) {
    const okLiab = weakest >= exposed;
    add({ id: "liability", ok: okLiab, title: okLiab ? "Your liability cover protects your net worth" : `A lawsuit could reach about ${money(exposed - weakest)} of what you own`,
      text: `Your net worth is ${money(nw.netWorth)}; ${shielded > 0 ? `${money(shielded)} of it is in retirement accounts, which are mostly out of a creditor's reach, leaving ${money(exposed)} exposed` : `all of it is exposed`}. Cover for someone hurt: ${[autos.length ? `${money(inCar)} in a car accident` : null, homesPol.length ? `${money(atHome)} at home${homeLiabilityKnown ? "" : ` (${money(HOME_LIABILITY_DEFAULT)} assumed for the home policy: enter its liability limit below)`}` : null].filter(Boolean).join(", ")}${umbrella > 0 ? `, the umbrella's ${money(umbrella)} included` : ""}.${okLiab ? "" : suggestedUmbrella > 0 ? " An umbrella policy closes the gap (below)." : ` Raising the ${autos.length && inCar === weakest ? "car" : "home"} policy's liability limit to ${money(Math.max(exposed, autos.length && inCar === weakest ? AUTO_MIN : UMBRELLA_UNDER.home))} closes it and usually costs little.`}`, go: null });
  }
  // 4. an umbrella
  if (suggestedUmbrella > 0) add({ id: "umbrella", ok: false, title: `An umbrella policy of ${money(suggestedUmbrella)}`, text: `It adds liability cover on top of the car and home policies, for about ${money(UMBRELLA_COST[0] * suggestedUmbrella / UMBRELLA_STEP)} to ${money(UMBRELLA_COST[1] * suggestedUmbrella / UMBRELLA_STEP)} a year. Insurers usually want ${money(UMBRELLA_UNDER.auto)} per accident on the cars and ${money(UMBRELLA_UNDER.home)} on the home underneath it.`, go: null });
  else if (umbrella > 0) {
    const shortUnder = (autos.length && autoLiability < UMBRELLA_UNDER.auto) || (homesPol.length && homeLiability < UMBRELLA_UNDER.home);
    add({ id: "umbrella", ok: !shortUnder, title: `Umbrella: ${money(umbrella)}`, text: shortUnder ? `Check the limits underneath it: umbrella insurers usually require ${money(UMBRELLA_UNDER.auto)} per accident on the cars and ${money(UMBRELLA_UNDER.home)} on the home, and a gap below them is yours to pay.` : "The car and home limits underneath meet what umbrella insurers usually require.", go: null });
  }
  // 5. the deductibles against the cash
  const withDeductible = active.filter((x) => ["auto", "home"].includes(x.kind) && Number(x.deductible) > 0);
  let deductibles = null;
  if (withDeductible.length) {
    const liq = computeLiquidity(plan, { today });
    const total = withDeductible.reduce((s, x) => s + Number(x.deductible), 0);
    deductibles = { total, cash: liq.now, ok: liq.now >= total };
    add({ id: "deductibles", ok: deductibles.ok, title: deductibles.ok ? "Your cash covers the deductibles" : "The deductibles are more than your cash", text: deductibles.ok ? `The deductibles add up to ${money(total)}; usable cash is ${money(liq.now)}. ${liq.now >= total * 3 ? "With this much cash, a higher deductible would lower the premiums." : ""}` : `They add up to ${money(total)} against ${money(liq.now)} of usable cash: a claim would mean borrowing. Build the emergency fund, or choose lower deductibles.`, go: deductibles.ok ? null : ["balance", "liquidity"] });
  }
  return { netWorth: nw.netWorth, exposed, shielded, ownsHome, homes, auto: autos.length ? { policies: autos.map((x) => x.name), liability: autoLiability } : null, homeLiability, homeLiabilityKnown, umbrella, inCar, atHome, suggestedUmbrella, umbrellaCost: UMBRELLA_COST.map((c) => c * suggestedUmbrella / UMBRELLA_STEP), deductibles, checks, hasAny: autos.length + homesPol.length + umbrellas.length > 0 };
}
