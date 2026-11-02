// modules/insurance/life-needs/view.js -- DOM only. One answer first (who needs more cover and how much, from the plan),
// then for each adult: the need against the cover they have, how it is worked out, two rules of thumb folded for
// comparison, what Social Security would pay the family, and how long the cover should last. Runs on the PC when connected.
import { FUNERAL, SURVIVOR_SPENDING, earningsTestExempt, SCHOOL_DONE } from "./compute.js";

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
    // one answer first: who needs cover and how much (the plan's own figure), then a card per adult
    const short = d.people.filter((p) => p.dependants && p.gap > 0);
    const depends = d.people.some((p) => p.dependants);
    const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a.at(-1)}` : a[0] ?? "");
    const whoOf = (p) => list([p.survivorName, ...d.children.map((c) => c.name)].filter(Boolean)) || "the family";
    host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, short.length === 1 ? `${short[0].name} needs about ${money(short[0].gap)} more life cover` : short.length ? `${list(short.map((p) => p.name))} need more life cover` : depends ? "Your family is covered" : "Nobody depends on one income"),
      ui.h("p", { class: "lede" }, short.length ? short.map((p) => `If ${p.name} died this year, ${whoOf(p)} would need about ${money(p.need)} to stay on track; ${p.cover > 0 ? `${money(p.cover)} of cover is on file` : "no life insurance is on file"}.${p.termUntil && p.termUntil.year > d.startYear ? ` Term cover until about ${p.termUntil.year} (${p.termUntil.why}) is the usual way to buy it.` : ""}`).join(" ")
        : depends ? `With the cover on file${anyCover ? "" : " (none yet)"} and the savings you have, the family's plan stays on track if one of you died this year.` : "No one else in the plan lives on one person's pay, so life insurance only needs to pay for a funeral and debts."),
      ui.row(ui.h("a", { class: short.length ? "btn" : "btn secondary", href: "#/insurance/policies" }, anyCover ? "Your policies" : "Add a policy you have"))));
    for (const p of d.people) host.append(personCard(p, d));
    host.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/scenarios/stress-tests" }, "Stress tests: other things that could go wrong"))));
  }

  function personCard(p, d) {
    const card = ui.card(`If ${p.name} died this year`);
    if (!p.dependants) {
      card.append(ui.h("p", {}, `No one else in the plan depends on ${p.name}'s income, so life insurance would only need to pay for the funeral and any debts: about ${money(p.dime.debts + p.dime.finalExpenses)}.`),
        ui.h("p", { class: "muted small" }, p.cover > 0 ? `${p.name} has ${money(p.cover)} of cover.` : "Add a partner or children on People if someone does."));
      return card;
    }
    const short = p.gap > 0;
    // no need: one sentence, not a "$0" tile over the rules of thumb
    if (p.need > 0) card.append(ui.row(
      ui.stat("Cover needed", money(p.need), p.method === "plan" ? "from your plan" : "debts, pay, mortgage and college added up"),
      ui.stat("Cover you have", money(p.cover), p.coverWork > 0 ? `${money(p.coverWork)} of it through work` : p.cover > 0 ? "on Policies" : "none on file"),
    ));
    card.append(ui.h("p", { class: `ln-verdict ${short ? "bad" : "ok"}` }, short ? `Short by about ${money(p.gap)}.` : p.need === 0 ? `No extra money needed: ${p.survivorName ? `${p.survivorName}'s pay and your savings keep the plan on track` : "the plan holds on its own"}.${p.cover > 0 ? ` ${p.name} has ${money(p.cover)} of cover on top.` : ""}` : `Covered, with about ${money(p.spare)} to spare.`));
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
    card.append(ui.h("details", { class: "ln-more" }, ui.h("summary", {}, "Two rules of thumb, for comparison"), ways,
      p.plan && p.plan.need !== null ? ui.h("p", { class: "muted small" }, `Both leave out ${p.survivorName}'s own pay, Social Security for the family and the savings you already have, so they come out higher. They are quick checks; the figure above is the one built from your numbers.`) : null));

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
