// modules/insurance/disability/view.js -- DOM only. For each person who earns: what their disability
// cover pays against their pay, whether the household could still pay the must-pay bills, whether the
// cash lasts through the waiting period, Social Security disability, and the policy terms to fill in.
import { compute, TARGET_SHARE, ODDS_TEXT, SSDI_WAIT_MONTHS, DEFAULT_WAIT_DAYS, DEFAULT_UNTIL_AGE } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.di-root .di-verdict { font-weight: 650; margin: 6px 0 2px; }
.di-root .di-verdict.ok { color: var(--ok); } .di-root .di-verdict.bad { color: var(--bad); } .di-root .di-verdict.warn { color: var(--warn); }
.di-root .di-checks { list-style: none; margin: 8px 0 0; padding: 0; }
.di-root .di-checks li { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.di-root .di-checks li:last-child { border-bottom: 0; }
.di-root .di-checks .di-ic { flex: none; width: 22px; text-align: center; }
.di-root .di-checks .di-t { font-weight: 600; }
.di-root .di-checks .di-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

const TERMS = [
  { key: "waitDays", label: "Waiting period (days)", type: "number", min: 0, step: "1", help: `the days you must be off work before it pays; ${DEFAULT_WAIT_DAYS} if you leave it empty` },
  { key: "untilAge", label: "Pays until age", type: "number", min: 1, step: "1", help: `usually 65 or 67; ${DEFAULT_UNTIL_AGE} if you leave it empty` },
  { key: "paidBy", label: "Who pays the premium", type: "select", options: [{ value: "employer", label: "The employer (the benefit is taxed)" }, { value: "me", label: "Me, from my pay after tax (the benefit is tax-free)" }] },
  { key: "offset", label: "Pays less once Social Security disability pays (most work plans do)", type: "checkbox" },
];

export function render(page, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "di-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.count) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "If you could not work"),
      ui.h("p", { class: "lede" }, `An illness or injury that stops you working is more likely than dying young: ${ODDS_TEXT} of today's 20-year-olds will be disabled before retirement age. This page checks what your cover would pay and whether the bills would still get paid.`),
      ui.h("p", { class: "muted small" }, "It needs pay on the Income page for someone who has not retired yet."),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add your pay"))));
    return;
  }

  root.append(ui.h("p", { class: "muted" }, `${ODDS_TEXT[0].toUpperCase()}${ODDS_TEXT.slice(1)} of today's 20-year-olds will be unable to work for a while before retirement age. Disability insurance replaces part of the pay while you cannot work.`));
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  for (const e of d.earners) {
    const card = ui.card(`If ${e.name} could not work`);
    card.append(ui.row(
      ui.stat("Cover would pay", `${money(e.benefitMonthly)}`, e.policies.length ? `a month, ${pct(e.share)} of pay; ${money(e.afterTaxMonthly)} after tax` : "no disability cover on file"),
      ui.stat("Pay now", money(e.grossMonthly), `a month before tax; about ${money(e.takeHomeMonthly)} take-home`),
    ));
    const good = e.share >= TARGET_SHARE - 0.005;
    card.append(ui.h("p", { class: `di-verdict ${good ? "ok" : e.policies.length ? "warn" : "bad"}` }, good ? `Covers ${pct(e.share)} of pay: at or above the ${pct(TARGET_SHARE)} most planners aim for.` : e.policies.length ? `Covers ${pct(e.share)} of pay; most planners aim for ${pct(TARGET_SHARE)}. About ${money(e.extraNeeded)} a month more would get there.` : `Nothing would replace ${e.name}'s pay. Most planners aim for ${pct(TARGET_SHARE)} of it: about ${money(e.target)} a month.`));

    const checks = ui.h("ul", { class: "di-checks" });
    const check = (ok, title, text) => checks.append(ui.h("li", {}, ui.h("span", { class: "di-ic" }, ok === null ? "•" : ok ? "✅" : "⚠️"), ui.h("div", {}, ui.h("div", { class: "di-t" }, title), ui.h("div", { class: "di-d" }, text))));
    const h = e.household;
    if (h.essentialMonthly > 0) {
      const others = h.othersMonthly > 0 ? `the rest of the household's take-home pay (about ${money(h.othersMonthly)})` : "";
      const from = [others, e.policies.length ? `the cover (${money(e.afterTaxMonthly)} after tax)` : ""].filter(Boolean).join(" and ");
      check(h.shortMonthly <= 0, h.shortMonthly <= 0 ? "The must-pay bills would still be paid" : `The must-pay bills would be ${money(h.shortMonthly)} a month short`, `Must-pay bills are about ${money(h.essentialMonthly)} a month${from ? `; ${from} would cover ${pct(h.coveredShare)} of them` : "; nothing else would come in"}.${h.shortMonthly > 0 ? " Savings would have to fill the gap." : ""}`);
    }
    if (e.wait.covered !== null) {
      const waitText = e.wait.days === null ? `Social Security disability, if approved, starts after ${SSDI_WAIT_MONTHS} full months` : `the cover starts paying after ${e.wait.days} days (about ${Math.round(e.wait.months * 10) / 10} months)`;
      const detail = e.wait.shortMonthly <= 0 ? "the rest of the household's pay covers the must-pay bills meanwhile." : `meanwhile the must-pay bills are ${money(e.wait.shortMonthly)} a month more than the rest of the household earns, about ${money(e.wait.needed)} in all; usable cash is ${money(e.wait.cash)}${e.wait.covered ? "." : `, enough for about ${Math.round(e.wait.lastsMonths * 10) / 10} months.`}`;
      check(e.wait.covered, e.wait.covered ? "The household gets through the wait" : "Your cash would run out before the money starts", `${waitText[0].toUpperCase()}${waitText.slice(1)}; ${detail}`);
    }
    if (e.ssdiMonthly > 0) check(null, `Social Security disability: about ${money(e.ssdiMonthly)} a month, if approved`, `It starts after ${SSDI_WAIT_MONTHS} full months off work and only for a condition expected to last a year or more; many first applications are turned down. ${e.policies.some((x) => x.offset) ? `Once it pays, the work plan pays less by the same amount, so together they come to about ${money(e.withSsdiMonthly)} after tax.` : `With the cover, about ${money(e.withSsdiMonthly)} a month after tax.`}`);
    else check(null, "Social Security disability", "Add Social Security figures on the Social Security page to see what it might pay.");
    if (e.extraNeeded > 0) check(null, "Closing the gap", `An individual policy for about ${money(e.extraNeeded)} a month usually costs ${money(e.costRange[0])} to ${money(e.costRange[1])} a year. Ask first whether work offers extra cover you can buy: it is usually cheaper. Bought with your own money, its benefit is tax-free.`);
    card.append(checks);

    // the terms of each policy, which the Policies form does not ask
    if (e.policies.length) {
      const fold = ui.h("details", { class: "fold", style: { marginTop: "12px" } }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Policy terms"), ui.h("span", { class: "fold-status" }, e.policies.length === 1 ? `${e.policies[0].waitDays} days, to ${e.policies[0].untilAge}` : `${e.policies.length} policies`), ui.h("span", { class: "fold-chev" }, "›")));
      for (const x of e.policies) {
        const stored = plan.insurance.policies.find((y) => y.id === x.id) ?? {};
        fold.append(ui.h("h3", { style: { margin: "12px 0 4px" } }, x.name), ui.form(TERMS, { waitDays: stored.waitDays ?? "", untilAge: stored.untilAge ?? "", paidBy: stored.paidBy ?? (x.throughWork ? "employer" : "me"), offset: stored.offset ?? x.throughWork }, (v) => {
          pending = `${x.name} saved.`;
          store.update((p) => { const t = p.insurance.policies.find((y) => y.id === x.id); if (t) Object.assign(t, { waitDays: v.waitDays ?? null, untilAge: v.untilAge ?? null, paidBy: v.paidBy, offset: !!v.offset }); });
        }, { submitLabel: "Save" }));
      }
      card.append(fold);
    } else card.append(ui.row(ui.h("a", { class: "btn secondary", href: "#/insurance/policies" }, "Add a disability policy")));
    root.append(card);
  }
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/insurance/policies" }, "Your policies"), ui.h("a", { class: "btn secondary", href: "#/scenarios/stress-tests" }, "Stress tests"))));
}
