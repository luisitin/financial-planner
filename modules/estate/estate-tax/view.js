// modules/estate/estate-tax/view.js -- DOM only. The estate against the exemption in one line, then the
// couple's two deaths (with and without portability), the end of the plan, and the state.
import { compute } from "./compute.js";
import { RATE_SCHEDULE } from "../gifting/data/transfer-tax.js";

let pending = null;   // the confirmation shown on the next render

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "et-root" });
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const exemption = d.couple ? d.exclusion * 2 : d.exclusion;
  const owes = d.couple ? d.pair.secondDeath.tax > 0 : d.single.tax > 0;

  root.append(ui.h("section", { class: "card" },
    ui.h("p", {}, `In ${d.year} the federal estate tax only reaches estates over ${money(d.exclusion)} a person${d.couple ? ` (${money(d.exclusion * 2)} for a couple who keep both exemptions)` : ""}. Above that, the tax is 40%. Life insurance counts when you own the policy.`),
    ui.row(
      ui.stat("Your estate today", money(d.estateToday), d.lifeCover ? `what you own, plus ${money(d.lifeCover)} of life insurance` : "what you own, less what you owe"),
      ui.stat(owes ? "Federal estate tax" : "Room under the exemption", owes ? money(d.couple ? d.pair.secondDeath.tax : d.single.tax) : money(Math.max(0, d.headroom)), owes ? "at today's values" : `of ${money(exemption)}`),
    ),
    ui.h("p", { class: owes ? "" : "muted" }, owes ? "The estate is over the exemption. An estate lawyer can lower the tax: gifts while you are alive, a trust that holds the life insurance outside the estate, gifts to charity." : d.headroom > exemption * 0.5 ? "Federal estate tax is very unlikely to touch this estate." : "Under the exemption today, but close enough to keep an eye on as it grows.")));
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  if (d.couple) {
    const s = d.pair.secondDeath;
    root.append(ui.card("For a couple: the two deaths",
      ui.h("p", {}, "At the first death: no federal estate tax when everything goes to the spouse (the marital deduction, for a spouse who is a US citizen)."),
      ui.h("p", {}, `At the second death: the whole estate, about ${money(s.estate)} today, against the survivor's own ${money(s.exemptionWithout)} plus what the first one did not use (portability): up to ${money(s.exemption)}. ${s.tax > 0 ? `The tax would be about ${money(s.tax)}.` : s.taxWithout > 0 ? `No tax with portability; without it, about ${money(s.taxWithout)}. That is why the return at the first death matters.` : "No tax either way."}`)));
  }
  if (d.end) root.append(ui.card(`At the end of the plan (${d.end.year})`, ui.h("p", {}, `If the plan runs as expected, it leaves about ${money(Math.round(d.end.estate / 1000) * 1000)} in today's dollars (the investments it projects, the home and other things it keeps, whole life insurance). ${d.end.tax > 0 ? `Against ${money(exemption)} of exemption that would owe about ${money(d.end.tax)}.` : `That is under the ${money(exemption)} exemption, which rises with prices.`}`)));
  if (d.people.some((p) => p.gifts > 0)) root.append(ui.card("Gifts already count", ui.h("p", {}, `Gifts over the yearly limit use the same exemption: ${d.people.map((p) => `${p.name} has ${money(p.exemptionLeft)} left`).join(", ")}.`), ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/gifting" }, "Gifting"))));

  // the state
  const st = d.state;
  const stateCard = ui.card("Your state");
  if (!st.code) stateCard.append(ui.h("p", { class: "muted" }, "Set your state on People to check for a state estate or inheritance tax."));
  else if (!st.estateTax && !st.inheritanceTax) stateCard.append(ui.h("p", {}, `${st.code} has no estate or inheritance tax of its own.`));
  else {
    if (st.inheritanceTax) stateCard.append(ui.h("p", {}, `${st.code} taxes what some heirs receive (an inheritance tax). Spouses are exempt, and usually children too; more distant heirs pay. Ask a local lawyer.`));
    if (st.estateTax) {
      stateCard.append(ui.h("p", {}, `${st.code} has its own estate tax with a much lower exemption than the federal one, and usually no portability between spouses. Enter your state's exemption and top rate for a rough figure (the state's revenue department lists them).`),
        st.tax !== null ? ui.h("p", { class: "muted" }, `At most about ${money(st.tax)}: ${Math.round(st.rate * 1000) / 10}% on everything over ${money(st.exemption)}. The real tax is lower: most states start at lower rates.`) : null,
        ui.form([
          { key: "exemption", label: "State exemption", type: "money", min: 0 },
          { key: "rate", label: "State top rate", type: "percent", min: 0, max: 30 },
        ], { exemption: st.exemption ?? "", rate: st.rate ?? null }, (v) => {
          pending = "Saved.";
          store.update((p) => { p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.stateTax = { exemption: v.exemption ?? null, rate: v.rate ?? null }; });
        }, { submitLabel: "Save" }));
    }
  }
  root.append(stateCard);
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "How the tax is worked out"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", { class: "muted small" }, `The tax on the estate plus lifetime taxable gifts, from the rate table (18% on the first $10,000 up to 40% over $1,000,000), less any gift tax already due on those gifts, less a credit equal to the tax on the exemption: in practice 40% of whatever is over the exemption. The table has ${RATE_SCHEDULE.length} steps (Internal Revenue Code section 2001). For a couple the page works out both orders (either of you dying first) and shows the costlier one. Values are today's; the exemption rises with prices from 2027.`)));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/beneficiaries" }, "Beneficiaries"), ui.h("a", { class: "btn secondary", href: "#/estate/legacy" }, "Legacy goals"))));
}
