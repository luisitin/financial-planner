// modules/system/assumptions/health.js -- PURE. What the choice "Health costs rise" does to this household's plan, as one
// written sentence per case (gap design #10, 2026-11-13). Kept apart from compute.js because it runs the retirement plan
// (projection/compute.js reads compute.js for the rate itself; this file is read only by the page and its tests).
import { buildInputs } from "../../retirement/projection/compute.js";
import { healthGrowthOf, healthPoints } from "./compute.js";

/**
 * healthEffect(plan, { today }) -> { h, case, total?, flat? }
 *   case "not-yet"   the plan cannot work out a retirement yet (birth dates, savings or spending missing)
 *        "included"  "my spending figure already includes health cover" is ticked: Will the money last? adds no health line
 *        "none"      the plan adds no health insurance after work (a job's plan or lines on Expenses pay for it; those lines
 *                    stay as typed: only the plan's own health line grows)
 *        "flat"      with prices: `total` is the plan's health line over retirement, today's dollars
 *        "faster"    h > 0: `total` with the choice, `flat` what it would be with prices
 * The totals are the projection's own health line (buildInputs().health.total): the marketplace years after any credit,
 * Medicare for everyone 65 or over, and a premium at work put back while someone still works.
 */
export function healthEffect(plan, { today = null } = {}) {
  const h = healthGrowthOf(plan);
  let b = null;
  try { b = buildInputs(plan, { today }); } catch { b = null; }
  if (!b?.inputs) return { h, case: "not-yet" };
  if (b.health?.included) return { h, case: "included" };
  const total = b.health?.total ?? 0;
  if (!(total > 0)) return { h, case: "none" };
  if (!(h > 0)) return { h, case: "flat", total };
  const a = { ...(plan.assumptions ?? {}) };
  delete a.healthGrowth;
  let f = null;
  try { f = buildInputs({ ...plan, assumptions: a }, { today }); } catch { f = null; }
  return { h, case: "faster", total, flat: f?.health?.total ?? total };
}

const dollars = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
/** Totals are said to the nearest $1,000 ($100 under $10,000): they are sums over decades. */
const round = (n) => (Math.abs(n) >= 10000 ? Math.round(n / 1000) * 1000 : Math.round(n / 100) * 100);
/** healthEffectWords(effect, money) -> the one sentence (or two) under the chips, written out for each case. */
export function healthEffectWords(e, money = dollars) {
  if (!e) return "";
  if (e.case === "not-yet") return "This will count once the plan can work out your retirement. It is used for health insurance after you stop work.";
  if (e.case === "included") return "You said your spending figure already includes health insurance, so this choice does not change Will the money last? The pages Before Medicare and Medicare at 65 still use it.";
  if (e.case === "none") return "Your plan does not add health insurance of its own right now (a plan at work or a line on Expenses covers it), so this only changes the pages Before Medicare and Medicare at 65.";
  if (e.case === "flat") return `Now: with prices. On your plan, health insurance after you stop work comes to about ${money(round(e.total))} in all, in today's dollars.`;
  return `Now: ${healthPoints(e.h)} a year faster than prices. On your plan, health insurance after you stop work comes to about ${money(round(e.total))} in all, in today's dollars. Rising with prices it would be about ${money(round(e.flat))}.`;
}
