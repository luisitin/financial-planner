// modules/taxes/hsa-fsa/view.js -- DOM only. What the HSA saves and grows into first, the
// room left this year, the FSA deadline, and one folded form for the figures.
import { compute } from "./compute.js";

let pending = null;

const COVER_LABEL = { none: "no high-deductible plan", self: "self-only cover", family: "family cover" };

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const H = d.hsa, F = d.fsa;
  const noCover = H.coverage === "none";
  const coveredName = H.coverage === "self" && H.people.length > 1 ? H.people.find((p) => p.eligible)?.name : null;
  const coverText = `${COVER_LABEL[H.coverage]}${coveredName ? ` for ${coveredName}` : ""}`;
  const ssLimit = Number.isFinite(d.wageBase) ? `${money(d.wageBase)} in ${d.year}` : "";
  let title, lede;
  if (H.total > 0 && noCover) {
    title = "HSA money needs a high-deductible health plan";
    lede = `You said you have no high-deductible health plan, so the ${money(H.total)} going into an HSA for ${d.year} saves no tax. If you do have such a plan, change the cover under "This year's figures".`;
  } else if (H.total > 0) {
    title = `Your HSA saves about ${money(H.savedTotal)} of tax this year`;
    lede = `${money(H.total)} goes in for ${d.year} (${money(H.contribution)} from you${H.employer ? `, ${money(H.employer)} from the employer` : ""}) against a limit of ${money(H.limit)}${H.catchUp ? " including the catch-up from 55" : ""}: ${H.room > 0 ? `${money(H.room)} of room left` : H.over > 0 ? `${money(H.over)} over` : "the limit exactly"}. ${H.kept > 0 ? ` Kept invested, this year's money alone is worth about ${money(H.futureValue > 0 ? H.kept * Math.pow(1 + H.growthRate, H.years) : H.kept)} at 65, untaxed if it pays for health costs.` : ""}`;
  } else if (noCover) {
    title = "Health savings and flexible spending accounts";
    lede = `You said you have no high-deductible health plan, so no money can go into an HSA this year: only someone covered by such a plan can put money in. Money already in an HSA can still pay for health costs tax-free. If you pick a high-deductible plan, change the cover below.`;
  } else {
    title = "Health savings and flexible spending accounts";
    lede = `An HSA is the only account where money goes in untaxed, grows untaxed and comes out untaxed (for health costs), so it beats a 401(k) dollar for dollar. It needs a high-deductible health plan; the ${d.limitsYear} limit is ${money(H.base)} for ${H.coverage === "family" ? "family" : "self-only"} cover, plus ${money(H.catchUpAmount)} a person from age ${H.catchUpAge}. Type what goes in below.`;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, title),
    ui.h("p", { class: "lede" }, lede),
    noCover ? null : ui.h("p", { class: "muted small" }, `Money taken from pay also skips the 7.65% Social Security and Medicare tax, or only the 1.45% Medicare part on pay above the Social Security pay limit${ssLimit ? ` (${ssLimit})` : ""}. After 65 the money can be taken for anything, taxed like a traditional IRA.`),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("warn", n));
  const taxSub = H.ficaSaved > 0 || H.taxSaved > 0 ? `${money(H.taxSaved)} income tax + ${money(H.ficaSaved)} payroll tax` : noCover ? "none without a high-deductible plan" : "on your own money from pay";
  root.append(ui.card(null, ui.row(
    ui.stat(`${d.limitsYear} limit`, money(H.limit), `${coverText}${H.catchUp ? ", with catch-up" : ""}`),
    ui.stat("Room left", money(H.room), H.total > 0 ? `${money(H.total)} in so far` : "nothing in yet"),
    // nothing in and no balance yet: no zero tiles, the hero says what to do first
    H.total > 0 || H.balance > 0 ? ui.stat("Tax saved", money(H.savedTotal), taxSub) : null,
    H.kept > 0 || H.balance > 0 ? ui.stat("At 65", money(H.atSixtyFive), `${H.years} years at ${fmt.pct(H.growthRate, 1)}: ${money(H.balance)} today plus ${money(H.kept)} a year`) : null,
  ),
  H.aboveWageBase.length ? ui.h("p", { class: "muted small" }, `${H.aboveWageBase.join(" and ")} ${H.aboveWageBase.length > 1 ? "earn" : "earns"} more than the Social Security pay limit (${ssLimit}). Pay above it has no Social Security tax, so HSA money from that pay saves only the 1.45% Medicare tax, not the full 7.65%.`) : null,
  ));
  if (d.hasFsa) root.append(ui.card("Flexible spending account",
    ui.row(
      ui.stat("Elected", money(F.election), `limit ${money(F.limit)}`),
      ui.stat("Unspent", money(F.unspent), F.daysLeft !== null ? `${F.daysLeft} days left in ${d.year}` : ""),
      ui.stat("Tax saved", money(F.taxSaved), "income and payroll tax"),
    ),
    ui.h("p", { class: "small" }, F.unspent > 0 ? `Use it or lose it: what is not spent by December 31 is gone, unless your plan allows a grace period to mid-March or a carryover of up to ${money(F.carryover)}. ${F.daysLeft !== null && F.daysLeft < 90 ? "Glasses, dental work, prescriptions and first-aid supplies all count." : ""}` : "All spent: nothing to lose at year end."),
  ));
  const h = plan.taxes?.hsa ?? {};
  const adults = H.people.filter((p) => p.id !== null);
  const FIELDS = [
    { key: "coverage", label: "Health plan for the HSA", type: "select", options: [{ value: "self", label: "High-deductible, self-only" }, { value: "family", label: "High-deductible, family" }, { value: "none", label: "No high-deductible plan" }], help: "only a high-deductible health plan allows an HSA" },
    adults.length > 1 ? { key: "coveredId", label: "Who the plan covers", type: "select", options: adults.map((p) => ({ value: p.id, label: p.name })), help: "with self-only cover only this person can have an HSA" } : null,
    { key: "contribution", label: "You put in this year", type: "money", min: 0, help: "your own money for the year, taken from pay; the HSA rows on the Contributions page count if they are more" },
    { key: "employer", label: "Employer puts in", type: "money", min: 0, help: "counts against the same limit" },
    { key: "fsa", label: "FSA election this year", type: "money", min: 0, help: "leave blank if you have no FSA" },
    { key: "fsaSpent", label: "FSA spent so far", type: "money", min: 0 },
  ].filter(Boolean);
  const coveredNow = H.coveredId ?? adults.find((p) => p.role === "self")?.id ?? adults[0]?.id ?? "";
  const form = ui.form(FIELDS, { coverage: H.coverage, coveredId: coveredNow, contribution: h.contribution || null, employer: h.employer || null, fsa: h.fsa || null, fsaSpent: h.fsaSpent || null }, (v) => {
    pending = "Saved.";
    store.update((p) => { p.taxes.hsa = { ...(p.taxes.hsa ?? {}), coverage: v.coverage, ...(v.coveredId ? { coveredId: v.coveredId } : {}), contribution: v.contribution ?? 0, employer: v.employer ?? 0, fsa: v.fsa ?? 0, fsaSpent: v.fsaSpent ?? 0 }; });
  }, { submitLabel: "Save" });
  // "Who the plan covers" matters only for self-only cover: shown while that is the choice
  const coverSelect = form.querySelector('select[name="coverage"]'), whoField = form.querySelector('select[name="coveredId"]')?.closest(".field");
  if (coverSelect && whoField) { const sync = () => { whoField.style.display = coverSelect.value === "self" ? "" : "none"; }; coverSelect.addEventListener("change", sync); sync(); }
  root.append(ui.h("details", { class: "card fold fold-card", open: d.hasHsa || d.hasFsa ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "This year's figures"), ui.h("span", { class: "fold-status" }, H.total > 0 ? `HSA ${money(H.total)}` : noCover ? "no high-deductible plan" : "not set"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "The HSA money also lowers the Federal estimate page's income, up to the limit. An HSA account on the Net worth page is counted in the growth figure."), form)));
  root.append(ui.card("Why an HSA comes first",
    ui.h("ul", { class: "records" }, [
      ["Three tax breaks, not two", "A 401(k) skips tax going in and pays it coming out; a Roth is the reverse. The HSA skips both, and the payroll tax as well when it comes from a paycheck."],
      ["Pay cash now, reimburse later", "Receipts never expire: pay today's medical bills from your own pocket, let the HSA grow for decades, and reimburse yourself tax-free whenever you like."],
      ["Medicare and the deadline", "No HSA money can go in from the month Medicare starts. Signing up for Medicare after 65 backdates Part A up to six months (not before the month you turn 65), so stop six months before you apply. Contributions for a year can be made until the April filing deadline."],
      ["FSA is different", "An FSA is a spending account, not a savings account: the money is spent within the year, and unspent balances are forfeited apart from the small carryover."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}
