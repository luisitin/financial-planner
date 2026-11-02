// modules/insurance/life-needs/view.js -- DOM only. One answer first (who needs more cover and how much, from the plan),
// then for each adult: the need against the cover they have, how it is worked out, two rules of thumb folded for
// comparison, what Social Security would pay the family, and how long the cover should last. Runs on the PC when connected.
import { FUNERAL, SURVIVOR_SPENDING, earningsTestExempt, SCHOOL_DONE, sayName } from "./compute.js";

const STYLE = `
.ln-root .ln-ways { list-style: none; margin: 4px 0 0; padding: 0; }
.ln-root .ln-ways li { padding: 12px 0; border-bottom: 1px solid var(--line); }
.ln-root .ln-ways li:last-child { border-bottom: 0; }
.ln-root .ln-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-weight: 650; }
.ln-root .ln-head .ln-v { white-space: nowrap; }
.ln-root .ln-ways .ln-d { color: var(--text-2); font-size: var(--fs-sm); margin-top: 2px; }
.ln-root .ln-ways li.ln-main .ln-v { color: var(--accent-ink, var(--accent)); }
.ln-root .ln-verdict { font-weight: 650; }
.ln-root .ln-verdict.ok { color: var(--ok); } .ln-root .ln-verdict.bad { color: var(--bad); }
.ln-root .ln-more { margin-top: 12px; border-top: 1px solid var(--line); }
.ln-root .ln-more > summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--accent-ink, var(--accent)); font-weight: 600; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const root = ui.h("div", { class: "ln-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const host = ui.h("div");
  root.append(host);
  host.append(ui.notice("info", "Working out what your family would need..."));
  ctx.computeRemote("insurance/life-needs", { today: fmt.today() }).then((d) => draw(d), (e) => host.replaceChildren(ui.notice("error", `Life insurance needs could not be worked out: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));

  function draw(d) {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" },
        ui.h("h1", {}, "How much life insurance?"),
        ui.h("p", { class: "lede" }, "If one of you died, how much money would the rest of the family need to stay on track? This page works it out from your own plan and checks it against the cover you have. It needs the basics first:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))),
        ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"), ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    const anyCover = d.people.some((p) => p.cover > 0);
    // one answer first, by the rule the Dashboard uses (compute's `raise`: someone lives on the pay and the gap is at least
    // MIN_GAP, today or once cover that ends soon is gone); a smaller gap, or one with no pay to replace, is said softly
    const raised = d.people.filter((p) => p.raise);
    const small = d.people.filter((p) => p.dependants && !p.raise && p.gap > 0);
    const depends = d.people.some((p) => p.dependants);
    const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a.at(-1)}` : a[0] ?? "");
    const nm = (p) => sayName(p.name), Nm = (p) => { const t = nm(p); return t.charAt(0).toUpperCase() + t.slice(1); };
    const whoOf = (p) => list([p.survivorName, ...d.children.map((c) => c.name)].filter(Boolean).map(sayName)) || "the family";
    const gapOf = (p) => (p.endsSoon?.length && p.gapAfterEnd > p.gap ? p.gapAfterEnd : p.gap);
    const lineOf = (p) => {
      const end = p.endsSoon?.length && p.gapAfterEnd > p.gap ? p.endsSoon.reduce((a, x) => (x.endDate < a.endDate ? x : a)) : null;
      if (end) return `${Nm(p)}'s ${money(end.benefit)} term policy ends on ${fmt.date(end.endDate)}, and ${whoOf(p)} count on ${nm(p)}${p.termUntil ? ` until about ${p.termUntil.year}` : ""}: without it they would be about ${money(p.gapAfterEnd)} short.`;
      const base = p.method === "plan" ? `If ${nm(p)} died this year, ${whoOf(p)} would need about ${money(p.need)} to stay on track` : `If ${nm(p)} died, a common rule of thumb puts what ${whoOf(p)} would need at about ${money(p.need)}`;
      return `${base}; ${p.cover > 0 ? `${money(p.cover)} of cover is on file` : "no life insurance is on file"}.${p.termUntil ? ` Term cover until about ${p.termUntil.year} (${p.termUntil.why.replace(/^(Me|My spouse|My partner)\b/, (m) => sayName(m)).replace(/^you retires$/, "you retire")}) is the usual way to buy it.` : ""}`;
    };
    const smallLine = (p) => p.pay > 0
      ? `If ${nm(p)} died this year, ${whoOf(p)} would be about ${money(p.gap)} short: a small gap that savings or a modest policy covers.`
      : `If ${nm(p)} died this year, ${whoOf(p)} would be about ${money(p.gap)} short: the income that stops with ${nm(p)}, such as a pension or Social Security. With no pay to replace, buying cover now is optional; this shows the gap so you can decide.`;
    host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, raised.length === 1 ? `${Nm(raised[0])} ${nm(raised[0]) === "you" ? "need" : "needs"} about ${money(gapOf(raised[0]))} more life cover` : raised.length ? `${list(raised.map(nm))} need more life cover` : small.length ? "Close to covered" : depends ? "Your family is covered" : "Nobody depends on one income"),
      ui.h("p", { class: "lede" }, raised.length ? raised.map(lineOf).join(" ")
        : small.length ? small.map(smallLine).join(" ")
        : depends ? `With the cover on file${anyCover ? "" : " (none yet)"} and the savings you have, the family's plan stays on track if one of you died this year.` : "No one else in the plan lives on one person's pay, so life insurance only needs to pay for a funeral and debts."),
      ui.row(ui.h("a", { class: raised.length ? "btn" : "btn secondary", href: "#/insurance/policies" }, anyCover ? "Your policies" : "Add a policy you have"))));
    if (d.unassignedCover > 0) host.append(ui.notice("warn", `A ${money(d.unassignedCover)} life policy on Policies names nobody, so it is not counted for anyone. Pick who it covers on Policies.`));
    for (const p of d.people) host.append(personCard(p, d));
    host.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/scenarios/stress-tests" }, "Stress tests: other things that could go wrong"))));
  }

  function personCard(p, d) {
    const card = ui.card(`If ${sayName(p.name)} died this year`);
    if (!p.dependants) {
      card.append(ui.h("p", {}, `No one else in the plan depends on ${p.name}'s income, so life insurance would only need to pay for the funeral and any debts: about ${money(p.dime.debts + p.dime.finalExpenses)}.`),
        ui.h("p", { class: "muted small" }, p.cover > 0 ? `${p.name} has ${money(p.cover)} of cover.` : "Add a partner or children on People if someone does."));
      return card;
    }
    // cover that ends soon, before the need does: covered now, short from the day it ends
    const end = p.endsSoon?.length && p.gapAfterEnd > p.gap ? p.endsSoon.reduce((a, x) => (x.endDate < a.endDate ? x : a)) : null;
    const short = p.gap > 0 || !!end;
    // no need: one sentence, not a "$0" tile over the rules of thumb
    if (p.need > 0) card.append(ui.row(
      ui.stat("Cover needed", money(p.need), p.method === "plan" ? "from your plan" : "debts, pay, mortgage and college added up"),
      ui.stat("Cover you have", money(p.cover), p.coverWork > 0 ? `${money(p.coverWork)} of it through work` : p.cover > 0 ? "on Policies" : "none on file"),
    ));
    card.append(ui.h("p", { class: `ln-verdict ${short ? "bad" : "ok"}` }, end ? `Covered until ${fmt.date(end.endDate)}, when ${money(end.benefit)} of it ends; short by about ${money(p.gapAfterEnd)} from then.` : short ? `Short by about ${money(p.gap)}.` : p.need === 0 ? `No extra money needed: ${p.survivorName ? `${sayName(p.survivorName)}'s ${p.plan?.survivorPay > 0 ? "pay" : "income"} and your savings keep the plan on track` : "the plan holds on its own"}.${p.cover > 0 ? ` ${p.name} has ${money(p.cover)} of cover on top.` : ""}` : `Covered, with about ${money(p.spare)} to spare.`));
    if (p.coverWork > 0 && p.gapIfJobEnds > p.gap) card.append(ui.notice("warn", `${money(p.coverWork)} of ${p.name}'s cover comes with the job and ends with it. Without it the family would be short about ${money(p.gapIfJobEnds)}.`));
    if (p.plan && !p.plan.withCover.success && p.plan.withCover.failAge) card.append(ui.notice("warn", `With today's cover, ${p.survivorName}'s money would run out at ${p.survivorName}'s age ${p.plan.withCover.failAge}.`));

    // how the plan's answer is worked out, then the two rules of thumb folded (they leave out the survivor's pay, Social
    // Security and savings, so they run several times higher and read as rival answers when shown at the same weight)
    const ways = ui.h("ul", { class: "ln-ways" });
    if (p.plan && p.plan.need !== null) {
      const g = p.plan.gapYears.filter((x) => x.amount > 0);
      const living = g.length ? ` Before ${p.survivorName} retires, the household would be short about ${money(g[0].amount)} a year at first; that is counted.` : ` ${p.survivorName}'s pay${p.plan.benefits ? " and Social Security" : ""} would cover the household's living costs until retirement.`;
      card.append(ui.h("p", { class: "small" }, `How it is worked out: the smallest lump sum that keeps ${p.survivorName}'s plan on track to the end, spending ${Math.round(SURVIVOR_SPENDING * 100)}% of what you spend together, after a funeral of about ${money(FUNERAL)}. ${p.name}'s savings pass to ${p.survivorName}.${living}`));
    }
    const di = p.dime;
    const dimeParts = [`debts ${money(di.debts)}`, `funeral ${money(di.finalExpenses)}`, di.incomeYears > 0 ? `${Math.round(di.incomeYears)} years of pay ${money(di.income)}` : null, `mortgage ${money(di.mortgage)}`, di.education > 0 ? `education ${money(di.education)}` : null].filter(Boolean);
    ways.append(way("Debts, pay, mortgage and college added up", money(di.total), `${dimeParts.join(" + ")}.${di.incomeYears > 0 ? " Pay counts until the youngest child turns 18." : " With no children, no pay is counted."}`));
    if (p.lifetime.years > 0) ways.append(way("Lifetime earnings", money(p.lifetime.total), `The family's share of ${p.name}'s take-home pay for ${p.lifetime.years} more working year${p.lifetime.years === 1 ? "" : "s"} (about ${money(p.lifetime.yearly)} a year, what ${p.name} would have spent on themself taken out), in today's money.`));
    const rules = p.lifetime.years > 0 ? 2 : 1;
    card.append(ui.h("details", { class: "ln-more" }, ui.h("summary", {}, rules === 2 ? "Two rules of thumb, for comparison" : "A rule of thumb, for comparison"), ways,
      p.plan && p.plan.need !== null ? ui.h("p", { class: "muted small" }, `${rules === 2 ? "Both leave" : "It leaves"} out ${p.survivorName}'s own pay, Social Security for the family and the savings you already have, so ${rules === 2 ? "they come" : "it comes"} out higher. ${rules === 2 ? "They are quick checks" : "It is a quick check"}; the figure above is the one built from your numbers.`) : null));

    // Social Security for the family
    const b = p.plan?.benefits;
    if (b && (b.childMonthly > 0 || b.parentMonthly > 0)) {
      const kids = d.children.map((c) => c.name);
      const parts = [];
      if (b.childMonthly > 0) parts.push(`${kids.length === 1 ? kids[0] : "the children"} about ${money(b.childMonthly)} a month until ${b.childUntil}`);
      parts.push(b.parentMonthly > 0 ? `${p.survivorName} about ${money(b.parentMonthly)} a month while caring for a child under 16${p.plan.survivorPay > earningsTestExempt(d.startYear) ? ` (most of it is held back because ${p.survivorName} earns over ${money(earningsTestExempt(d.startYear))} a year)` : ""}` : `${p.survivorName} nothing while working (the benefit for a parent caring for a child under 16 is held back on pay over ${money(earningsTestExempt(d.startYear))} a year)`);
      card.append(ui.h("h3", { style: { margin: "16px 0 4px" } }, "Social Security for the family"), ui.h("p", {}, `On ${p.name}'s record Social Security would pay ${parts.join(", and ")}. This is in your plan's answer.`));
    }

    // how long
    if (p.termUntil && p.termUntil.year > d.startYear && p.need > 0) {
      card.append(ui.h("h3", { style: { margin: "16px 0 4px" } }, "For how long"), ui.h("p", {}, `The need is largest now and shrinks as savings grow${d.children.length ? " and the children grow up" : ""}. Cover that lasts until about ${p.termUntil.year} (${p.termUntil.why}) is the usual choice; a term policy is the cheap way to buy it.`));
    }
    return card;
  }

  function way(title, value, text, main = false) {
    return ui.h("li", { class: main ? "ln-main" : null }, ui.h("div", { class: "ln-head" }, ui.h("span", {}, title), ui.h("span", { class: "ln-v" }, value)), ui.h("div", { class: "ln-d" }, text));
  }
}
