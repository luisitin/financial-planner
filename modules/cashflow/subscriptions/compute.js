// modules/cashflow/subscriptions/compute.js -- PURE. Every recurring charge that looks like a
// subscription or membership: from the transactions (found payments in the subscriptions
// category, or a payee that sounds like one) and from the Expenses page (subscriptions
// category). What each costs a year, the total, and which ones have not been used lately
// is not knowable from a bank line, so the page asks the owner instead of guessing.
import { compute as computeRecurring } from "../recurring/compute.js";
import { normalizePayee } from "../../transactions/rules/compute.js";
import { PERIODS } from "../../../core/math/periods.js";

export const SUBSCRIPTION_WORDS = /\b(netflix|spotify|hulu|disney|hbo|max|paramount|peacock|apple|itunes|icloud|google|youtube|amazon prime|prime video|audible|kindle|xbox|playstation|nintendo|steam|adobe|microsoft|office|dropbox|github|patreon|substack|new york times|nyt|wsj|washington post|gym|fitness|planet|peloton|strava|chatgpt|openai|anthropic|claude|verizon|att|t mobile|xfinity|comcast|spectrum|ring|nest|dashlane|1password|nordvpn|expressvpn|duolingo|headspace|calm|tinder|bumble|onlyfans|twitch|crunchyroll|sling|fubo|sirius|pandora|tidal|deezer|zoom|slack|notion|canva)\b/i;
const perYear = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, quarterly: 4, annual: 1 };

/**
 * compute(plan, { today }) -> { items: [{ key, name, icon, source, cadenceLabel, amount, yearly, monthly, last, next }], monthly, yearly, count, hasData }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const items = [];
  const rec = computeRecurring(plan, { today });
  for (const r of rec.detected) {
    if (r.amount >= 0) continue;
    const looks = r.category === "subscriptions" || SUBSCRIPTION_WORDS.test(normalizePayee(r.rawPayee ?? r.payee)) || SUBSCRIPTION_WORDS.test(String(r.payee ?? ""));
    if (!looks) continue;
    const yearly = Math.abs(r.amount) * (perYear[r.cadence] ?? 12);
    items.push({ key: r.key, name: r.payee, icon: r.icon ?? "📺", source: "found", cadenceLabel: r.cadenceLabel, amount: Math.abs(r.amount), yearly, monthly: yearly / 12, last: r.last, next: r.next });
  }
  for (const e of plan.expenses ?? []) {
    if (e.category !== "subscriptions" || e.period === "once") continue;
    const amount = Number(e.amount) || 0; if (amount <= 0) continue;
    if (items.some((i) => Math.abs(i.amount - amount) < 0.5 && normalizePayee(i.name).split(" ").some((w) => w.length > 3 && normalizePayee(e.name).includes(w)))) continue;   // already found
    const yearly = amount * (PERIODS[e.period]?.perYear ?? 12);
    items.push({ key: `typed-${e.id}`, name: e.name, icon: "📺", source: "typed", cadenceLabel: (PERIODS[e.period]?.label ?? "every month").toLowerCase(), amount, yearly, monthly: yearly / 12, last: null, next: null });
  }
  items.sort((a, b) => b.yearly - a.yearly);
  return { items, monthly: items.reduce((s, i) => s + i.monthly, 0), yearly: items.reduce((s, i) => s + i.yearly, 0), count: items.length, hasData: items.length > 0 };
}
