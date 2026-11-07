// modules/insurance/life-needs/view.js -- DOM only. One answer first (who needs more cover and how much, from the plan),
// with "How to get it" when someone is short; then for each adult: the need against the cover they have, how it is worked
// out (a single parent's part by part), two rules of thumb folded for comparison, what Social Security would pay the
// family, and how long the cover should last. Runs on the PC when connected.
import { FUNERAL, SURVIVOR_SPENDING, earningsTestExempt, sayName, sayWhose, termYears, collegeWords, shownChild, inDollars } from "./compute.js";
import { isYou, nameIn, NameIn, nameOf, NameOf, verbFor, selfOf, NamesIn } from "../../../core/words.js";

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
.ln-root .ln-ways li.ln-total { border-top: 2px solid var(--line-2); border-bottom: 0; }
.ln-root .ln-how[hidden] { display: none; }
.ln-root .ln-how p { margin: 0 0 10px; }
.ln-root .ln-how h3 { margin: 14px 0 4px; }
.ln-root .ln-how .row { margin-top: 4px; }
.ln-root .ln-years li { padding: 8px 0; }
.ln-root .ln-years li.ln-peak .ln-v { color: var(--accent-ink, var(--accent)); }
`;
const MINUS = "−";

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a.at(-1)}` : a[0] ?? "");
  const nm = (p) => sayName(p.name), Nm = (p) => { const t = nm(p); return t.charAt(0).toUpperCase() + t.slice(1); };
  const gapOf = (p) => (p.endsSoon?.length && p.gapAfterEnd > p.gap ? p.gapAfterEnd : p.gap);
  // someone to check on People, as a sentence says it: "your details" for the unnamed first adult, else the name
  const checkWho = (n) => (isYou(n) ? "your details" : nameIn(n));
  const whyOf = (t) => t.why.replace(/^(Me|My spouse|My partner)\b/, (m) => sayName(m)).replace(/^you retires$/, "you retire");
  // a single parent's answer as shown: every part to the $100, every sum worked from the shown parts (compute's `shown`), so
  // what the page shows always adds up; each child's Social Security pays only that child's own costs and college
  const sh = (c) => c.shown ?? shownChild(c);
  const kidsShown = (c) => { const s = sh(c); return s.kids?.length ? s.kids : [{ ...s, name: c.children?.[0] ?? "" }]; };
  const ssCovers = (c) => sh(c).counted > 0 && sh(c).short === 0;
  // what of the children's own part the cover still pays, child by child: nothing for a child their Social Security covers,
  // college alone for one whose costs it covers, else both
  const kidNeeds = (c) => {
    const short = kidsShown(c).filter((k) => k.short > 0);
    if (!short.length) return [];
    return short.some((k) => k.counted < k.costs) ? [sh(c).costs > 0 ? "costs until 18" : null, short.some((k) => k.college > 0) ? "college" : null].filter(Boolean) : short.some((k) => k.college > 0) ? ["college"] : [];
  };
  // whose college the cover still pays: the children still short with college counted ("college" when every child is)
  const shortCollege = (c) => kidsShown(c).filter((k) => k.short > 0 && k.college > 0).map((k) => k.name);
  // the cover a single parent needs is sized to a later year than today (compute's `sized`: the largest of each year's need
  // in that year's dollars, as a level policy pays the same dollars every year): the page names that year
  const sizedOf = (p) => p.child?.sized ?? p.child?.peak ?? null;
  const peakLater = (p, d) => p.method === "child" && (sizedOf(p)?.year ?? d.startYear) > d.startYear;
  // the year of a single parent's figure, said plainly: "if Jo died in 2040, in that year's dollars"
  const diedIn = (p, s) => `if ${nm(p)} died in ${s.year}${inDollars(s)}`;
  // a single parent's cover that ends soon (compute's `afterEnd`): what is needed after it ends, with its year, less only the
  // cover that stays ("the most Child 1 and Child 2 would need, if Jo died in 2037, in that year's dollars")
  const ending = (p) => (p.endsSoon?.length && p.gapAfterEnd > p.gap ? stepsOf(p)[0] ?? p.endsSoon.reduce((a, x) => (x.endDate < a.endDate ? x : a)) : null);
  // a single parent's policies that end before afterEnd's year, by date (compute's `endSteps`: the same day added up), so
  // the page names all of them, never only the first to end (verification, review 2026-11-06)
  // a couple's or the rule of thumb's: compute's `endSteps`, every policy ending by next year (verification 8b)
  const stepsOf = (p) => (p.method === "child" ? p.child?.endSteps ?? [] : p.endSteps ?? []);
  const many = (p) => stepsOf(p).length > 1;
  const stepList = (p) => list(stepsOf(p).map((s) => `${money(s.benefit)} on ${fmt.date(s.endDate)}`));
  // what ends, as the subject of a sentence: "$300,000 term policy ends on 12/31/2030", "$250,000 of term cover ends on
  // 12/31/2033" (two policies that day), "term cover ends in steps, $150,000 on 12/31/2031 and $150,000 on 12/31/2036"
  const endsWords = (p, end) => (many(p) ? `term life insurance ends in steps, ${stepList(p)}` : `${money(end.benefit)} ${(end.policies ?? 1) > 1 ? "of term life insurance" : "term policy"} ends on ${fmt.date(end.endDate)}`);
  // the cover that has ended by afterEnd's year: all the steps added up
  const endedSum = (p, end) => (stepsOf(p).length ? stepsOf(p).reduce((t, s) => t + s.benefit, 0) : end.benefit);
  const afterOf = (p) => (p.method === "child" && ending(p) ? p.child?.afterEnd ?? null : null);
  // the cover still paying in afterEnd's year (compute's `afterEnd.cover`): what stays for good ("the $50,000 that stays on
  // file"), or with a later policy not yet ended then ("the $200,000 still on file then")
  const leftOf = (p, ae) => ae?.cover ?? p.child?.coverStays ?? 0;
  const leftWords = (p, ae) => `the ${money(leftOf(p, ae))} ${leftOf(p, ae) > (p.child?.coverStays ?? 0) ? "still on file then" : "that stays on file"}`;
  // a single parent's year the cover is sized to, from the year list: its cover still paying then (`coverInForce`)
  const sizedYear = (p) => (p.child?.needByYear ?? []).find((y) => y.year === sizedOf(p)?.year) ?? null;
  // what the need pays for, for a tile's small line: "costs until 18, college and debts"; "debts and a funeral"; a later peak:
  // "the most, if Jo died in 2037"
  const childSub = (c) => { const k = kidNeeds(c), x = [...k, sh(c).debts > 0 ? "debts" : null].filter(Boolean); return list(k.length ? x : [...x, "a funeral"]); };
  const saidSaved = (p) => `the ${money(sh(p.child).savings)} ${nm(p) === "you" ? "you have" : `${nm(p)} has`} saved`;
  // a child whose college is not counted, said plainly (never said as covered)
  const leftOutWords = (c) => (c.collegeLeftOut ?? []).map((k) => ` ${sayWhose(k.name)} college is not counted: ${k.why === "share" ? "on the Education page you chose to pay none of it" : `the Education page has no figure for ${sayName(k.name)} yet`}.`).join("");
  // nothing short: what pays for what ("Social Security for Child 1 would cover their costs until 18 and college, and the
  // $401,900 Jo has saved would pay the debts and a funeral")
  const coveredChild = (p, d) => {
    const c = p.child, s0 = sh(c), kw = kidsOf(p, d), col = collegeWords(c);
    const kids = [s0.costs > 0 ? "costs until 18" : null, s0.college > 0 ? col : null].filter(Boolean);
    const rest = [s0.debts > 0 ? "debts" : null, "a funeral"].filter(Boolean);
    const others = [s0.savings > 0 ? saidSaved(p) : null, p.cover > 0 ? `the ${money(p.cover)} of coverage on file` : null].filter(Boolean);
    const s = ssCovers(c) && kids.length
      ? `If ${nm(p)} died, Social Security for ${kw} would cover their ${list(kids)}, and ${list(others) || "what is on file"} would pay the ${list(rest)}.`
      : `If ${nm(p)} died, ${list([s0.counted > 0 ? `Social Security for ${kw}` : null, ...others].filter(Boolean)) || "what is on file"} would cover ${kw}'s ${list([...kids, ...rest])}.`;
    // covered in every year from now, not only today: said when the need would be larger later
    // (the cover still paying in that year: a policy that ends before it does not pay then)
    const inForce = sizedYear(p)?.coverInForce ?? p.cover;
    const later = peakLater(p, d) && inForce > 0 ? ` The ${money(inForce)} of coverage ${inForce < p.cover ? `still on file in ${sizedOf(p).year}` : "on file"} also covers the most they would need, about ${money(p.need)} ${diedIn(p, sizedOf(p))}.` : "";
    return s + later + leftOutWords(c);
  };
  // the rule of thumb's parts, a funeral always among them (as Next best action says it)
  const dimeNames = (di) => list([di.debts > 0 ? "debts" : null, di.income > 0 ? "pay" : null, di.mortgage > 0 ? "the mortgage" : null, di.education > 0 ? "college" : null, "a funeral"].filter(Boolean));
  // who would be left: the survivor and the children; a single parent's children under 18
  const whoOf = (p, d) => list([p.survivorName ?? p.survivorMissing?.name, ...d.children.map((c) => c.name)].filter(Boolean).map(sayName)) || "the family";
  const kidsOf = (p, d) => list((p.child?.children ?? []).map(sayName)) || whoOf(p, d);
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
        ui.h("p", { class: "lede" }, "If one of you died, how much money would the rest of the family need to stay on track? This page works it out from your own plan and checks it against the coverage you have. It needs the basics first:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))),
        ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"), ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    const anyCover = d.people.some((p) => p.cover > 0);
    // one answer first, by the rule the Dashboard uses (compute's `raise`: someone lives on the pay and the gap is at least
    // MIN_GAP, today or once cover that ends soon is gone); a smaller gap, or one with no pay to replace, is said softly
    const raised = d.people.filter((p) => p.raise);
    // a gap under MIN_GAP, today or once cover that ends is gone (never "Your family is covered" beside "short" on the card)
    const small = d.people.filter((p) => p.dependants && !p.raise && gapOf(p) > 0);
    const depends = d.people.some((p) => p.dependants);
    const lineOf = (p) => {
      const end = ending(p), ae = afterOf(p);
      // a single parent's cover that ends soon: what they would need after it ends, and the year of that figure (never "less"
      // a policy that will be gone)
      if (end && ae) {
        const left = leftOf(p, ae);
        // the year short the most is not the year of the largest need (a later policy pays that one): said as the shortfall
        const then = ae.most === false
          ? `After it ends they would be up to about ${money(p.gapAfterEnd)} short, ${diedIn(p, ae)}${left > 0 ? `, with ${leftWords(p, ae)} against ${money(ae.need)} needed` : ""}`
          : `After it ends they would need up to about ${money(ae.need)}, ${diedIn(p, ae)}${left > 0 ? `; with ${leftWords(p, ae)}, about ${money(p.gapAfterEnd)} short` : ""}`;
        return `${NameOf(p.name)} ${endsWords(p, end)}, and ${kidsOf(p, d)} ${(p.child.children ?? []).length > 1 ? "count" : "counts"} on ${nm(p)}${p.termUntil ? ` until about ${p.termUntil.year}` : ""}. ${then}.`;
      }
      // a couple's: every policy that ends by next year, by date (`endSteps`), and short once it has all ended
      if (end) return `${NameOf(p.name)} ${endsWords(p, end)}, and ${whoOf(p, d)} count on ${nm(p)}${p.termUntil ? ` until about ${p.termUntil.year}` : ""}: ${many(p) ? "once it has ended" : "without it"} they would be about ${money(p.gapAfterEnd)} short.`;
      // a single parent's cover sized to a later year: said once, plainly, with today's figure
      if (peakLater(p, d)) {
        const c = p.child, s = sizedOf(p), kw = (c.children ?? []).length > 1 ? "the children" : kidsOf(p, d);
        const first = gapOf(p) === p.need ? `That is the most ${kw} would need, ${diedIn(p, s)}` : `${cap(kw)} would need the most, about ${money(p.need)}, ${diedIn(p, s)}`;
        // nothing needed today: what pays for it, named (Social Security, the savings)
        const pays = list([sh(c).counted > 0 ? "Social Security" : null, sh(c).savings > 0 ? "savings" : null].filter(Boolean)) || "what is on file";
        const now = c.today > 0 ? `Today it would be ${money(c.today)}` : `If ${nm(p)} died today, ${pays} would pay for everything ${kw} would need`;
        return `${first}. ${now}; ${p.cover > 0 ? `${money(p.cover)} of coverage is on file` : "no life insurance is on file"}.${p.termUntil ? ` Term life insurance until about ${p.termUntil.year} (${whyOf(p.termUntil)}) is the usual way to buy it.` : ""}`;
      }
      // the plan together runs short too (round 8 item 14): never "on track"
      const base = p.method === "plan" ? `If ${nm(p)} died this year, ${whoOf(p, d)} would need about ${money(p.need)} ${p.plan?.eitherWay ? "to last as long as your plan together does" : "to stay on track"}`
        : p.method === "child" ? `If ${nm(p)} died, ${kidsOf(p, d)} would need about ${money(p.need)}${childFor(p.child)}`
        : `If ${nm(p)} died, a common rule of thumb puts what ${whoOf(p, d)} would need at about ${money(p.need)}`;
      // a rule of thumb standing in for a second adult's missing birth date: say how to get the plan's own answer
      const sm = p.method === "dime" && p.survivorMissing ? (p.survivorMissing.birthDate ? ` Add ${nameOf(p.survivorMissing.name)} birth date on People and the answer comes from your own plan instead.` : ` Check ${checkWho(p.survivorMissing.name)} on People: once ${nameOf(p.survivorMissing.name)} plan can be worked out, the answer comes from your own plan instead.`) : "";
      return `${base}; ${p.cover > 0 ? `${money(p.cover)} of coverage is on file` : "no life insurance is on file"}.${sm}${p.termUntil ? ` Term life insurance until about ${p.termUntil.year} (${whyOf(p.termUntil)}) is the usual way to buy it.` : ""}`;
    };
    // what a single parent's need is for, never a part Social Security covers or a college left out: " to grow up and go to
    // college", " to go to college (Social Security would cover their costs until 18)", " for the debts and a funeral (...)"
    const childFor = (c) => {
      const k = kidNeeds(c), col = collegeWords(c), s = sh(c);
      // whose college the cover pays: every child's ("go to college"), else the ones their own Social Security leaves short
      const whose = shortCollege(c), all = col === "college" && whose.length === (c.children ?? []).length;
      const go = all ? "go to college" : `for ${list(whose.map(sayName))} to go to college`;
      if (k.includes("costs until 18")) return ` to grow up${k.includes("college") ? ` and ${go}` : ""}`;
      if (k.includes("college")) return `${all ? " to " : " "}${go}${s.costs > 0 ? " (Social Security would cover their costs until 18)" : ""}`;
      const ss = [s.costs > 0 ? "costs until 18" : null, s.college > 0 ? col : null].filter(Boolean);
      return ` for ${list([s.debts > 0 ? "the debts" : null, "a funeral"].filter(Boolean))}${ss.length && s.counted > 0 ? ` (Social Security would cover their ${list(ss)})` : ""}`;
    };
    // once cover that ends is gone: "Once Jo's $50,000 term policy ends on 12/31/2030", "Once Jo's term cover has ended
    // ($100,000 on 12/31/2028 and $50,000 on 12/31/2035)"
    const onceWords = (p) => { const e = ending(p), w = nm(p) === "you" ? "your" : `${nm(p)}'s`; return many(p) ? `Once ${w} term life insurance has ended (${stepList(p)})` : `Once ${w} ${money(e.benefit)} ${(e.policies ?? 1) > 1 ? "of term life insurance" : "term policy"} ends on ${fmt.date(e.endDate)}`; };
    const smallLine = (p) => p.pay > 0 && ending(p)
      ? `${onceWords(p)}, ${p.method === "child" ? kidsOf(p, d) : whoOf(p, d)} would be about ${money(gapOf(p))} short${afterOf(p) ? ` (${diedIn(p, afterOf(p))})` : ""}: a small gap that savings or a modest policy covers.`
      : p.pay > 0
      ? `If ${nm(p)} died ${peakLater(p, d) ? `in ${sizedOf(p).year}` : "this year"}, ${whoOf(p, d)} would be about ${money(p.gap)} short${peakLater(p, d) ? inDollars(sizedOf(p)) : ""}: a small gap that savings or a modest policy covers.`
      : `${ending(p) ? onceWords(p) : `If ${nm(p)} died this year`}, ${whoOf(p, d)} would be about ${money(gapOf(p))} short: the income that stops with ${nm(p)}, such as a pension or Social Security. With no pay to replace, buying life insurance now is optional; this shows the gap so you can decide.`;
    // a rule of thumb standing in for the plan's own answer (a second adult's missing birth date): the headline says so, as
    // "How to get it" does
    const ruleUntil = (p) => (p.method === "dime" && p.survivorMissing ? `, by a rule of thumb until ${p.survivorMissing.birthDate ? `${nameOf(p.survivorMissing.name)} birth date is in` : `${nameOf(p.survivorMissing.name)} plan can be worked out`}` : "");
    // nobody short: a couple's plan stays on track; a single parent's children are paid for by Social Security, savings and cover
    const coveredLine = () => {
      const ones = d.people.filter((p) => p.dependants);
      // short for retirement whoever lives (round 8 item 14): life cover does not fix that, and "on track" is not said
      if (d.people.length && d.people.every((p) => p.plan?.eitherWay && p.need === 0)) return "Your plan is short for retirement either way, whoever lives, so life insurance would not fix it. Will the money last? shows what does.";
      if (ones.length && ones.every((p) => p.method === "child")) return ones.map((p) => coveredChild(p, d)).join(" ");
      if (ones.length && ones.every((p) => p.method === "dime")) return ones.map((p) => `If ${nm(p)} died, the ${money(p.cover)} of coverage on file would pay what a common rule of thumb says ${whoOf(p, d)} would need (${dimeNames(p.dime)}).`).join(" ");
      return `With the coverage on file${anyCover ? "" : " (none yet)"} and the savings you have, the family's plan stays on track if one of you died this year.`;
    };
    // "How to get it": what to buy, for how long, and who to name, for everyone who is short (a local toggle, nothing saved)
    const how = raised.length ? howCard(raised, d) : null;
    const howBtn = how ? ui.button("How to get it", () => {
      how.hidden = !how.hidden;
      howBtn.setAttribute("aria-expanded", how.hidden ? "false" : "true");
      if (!how.hidden) how.scrollIntoView({ behavior: "smooth", block: "start" });
    }, { "aria-expanded": "false", "aria-controls": "ln-how" }) : null;
    host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, raised.length === 1 ? `${Nm(raised[0])} ${nm(raised[0]) === "you" ? "need" : "needs"} about ${money(gapOf(raised[0]))} more life insurance${ruleUntil(raised[0])}` : raised.length ? `${NamesIn(raised.map((p) => p.name))} need more life insurance` : small.length ? "Close to covered" : d.people.length && d.people.every((p) => p.plan?.eitherWay && p.need === 0 && !(p.cover > 0)) ? "No life insurance needed now" : depends ? "Your family is covered" : "Nobody depends on one income"),
      ui.h("p", { class: "lede" }, raised.length ? raised.map(lineOf).join(" ")
        : small.length ? small.map(smallLine).join(" ")
        : depends ? coveredLine() : "No one else in the plan lives on one person's pay, so life insurance only needs to pay for a funeral and debts."),
      // the filled button is the next step (how to buy it); the policies link is secondary beside it
      ui.row(howBtn, ui.h("a", { class: "btn secondary", href: "#/insurance/policies" }, anyCover ? "Your policies" : "Add a policy you have"))));
    if (how) host.append(how);
    if (d.unassignedCover > 0) host.append(ui.notice("warn", `A ${money(d.unassignedCover)} life policy on Policies names nobody, so it is not counted for anyone. Pick who it covers on Policies.`));
    for (const p of d.people) host.append(personCard(p, d));
    for (const u of d.unplanned ?? []) host.append(unplannedCard(u));
    host.append(ui.card("More on this", ui.row(ui.h("a", { class: "btn secondary", href: "#/scenarios/stress-tests" }, "Stress tests: other things that could go wrong"))));
  }

  // a single parent with nothing to buy: what pays for what ("Social Security covers Child 1's costs until 18 and college, and
  // savings pay the debts and the funeral")
  function childEnough(p, d) {
    const c = p.child, s = sh(c), kw = kidsOf(p, d);
    // nothing in any year from now: said, since today's parts alone would not show it
    const every = (c.needByYear?.length ?? 0) > 1 ? " in any year until the need ends" : "";
    if (!ssCovers(c)) return `${cap(list([s.counted > 0 ? "Social Security" : null, s.savings > 0 ? "savings" : null].filter(Boolean)) || "savings")} cover what ${kw} would need${every}`;
    const what = list([s.costs > 0 ? "costs until 18" : null, s.college > 0 ? collegeWords(c) : null].filter(Boolean));
    return `Social Security covers ${kw}'s ${what}, and savings pay ${s.debts > 0 ? "the debts and the funeral" : "the funeral"}${every}`;
  }

  // what the rules of thumb leave out that the single parent's answer counts, for this plan, by name: "The first counts Jo's
  // pay until Child 1 turns 18 rather than what Child 1 would cost, and leaves out college, Social Security for Child 1 and
  // the $1,900 Jo has saved; the second counts only Jo's pay to retirement."
  function rulesNote(p, rules) {
    const c = p.child, s = sh(c), di = p.dime, kids = c.children.map(sayName), kw = list(kids);
    const out = [s.college > 0 && di.education < 50 ? "college" : null, s.counted > 0 ? `Social Security for ${kids.length === 1 ? kw : "the children"}` : null, s.savings > 0 ? saidSaved(p) : null].filter(Boolean);
    const counts = di.income > 0 ? `${sayWhose(p.name)} pay until ${kids.length === 1 ? `${kw} turns` : "the youngest is"} 18 rather than what ${kw} would cost` : `${dimeNames(di)} rather than what ${kw} would cost`;
    const first = `${rules === 2 ? "The first" : "It"} counts ${counts}${out.length ? `, and leaves out ${list(out)}` : ""}`;
    // a grown dependent's college goal: left out of the rule of thumb too, as it is of the answer above (said by name)
    const others = c.collegeOthers ?? [];
    // whose they are: a grown dependent is not one of the children under 18; one with no birth date is not counted as one,
    // because the birth date is missing (the page does not know their age)
    const forAll = [...new Set(others.flatMap((g) => g.for))];
    const undated = [...new Set(others.filter((g) => g.why === "nobirth").flatMap((g) => g.for))];
    const grown = forAll.filter((n) => !undated.includes(n));
    const whose = [grown.length ? `${list(grown.map(sayName))}, not the children under 18` : null,
      undated.length ? `${list(undated.map(sayName))}, who ${undated.length > 1 ? "are" : "is"} not counted as ${undated.length > 1 ? "children" : "a child"} under 18 because ${undated.length > 1 ? "their birth dates are" : `${sayWhose(undated[0])} birth date is`} missing on People` : null].filter(Boolean);
    const theirs = others.length ? ` Like the answer above, ${rules === 2 ? "neither counts" : "it does not count"} ${list(others.map((g) => `“${g.name}”`))}: ${others.length > 1 ? "they are" : "it is"} for ${whose.join(", and ")}.` : "";
    return `${first}${rules === 2 ? `; the second counts only ${sayWhose(p.name)} pay to retirement` : ""}.${theirs} ${rules === 2 ? "They are quick checks" : "It is a quick check"}; the figure above is the one built from your numbers.`;
  }

  // an adult the plan cannot run for (no birth date): what is known, and what to add
  function unplannedCard(u) {
    const card = ui.card(`If ${sayName(u.name)} died this year`);
    const known = [u.pay > 0 ? `pay of about ${money(u.pay)} a year` : null, u.cover > 0 ? `${money(u.cover)} of life insurance${u.coverWork > 0 ? `, ${money(u.coverWork)} of it through work` : ""}` : `no life insurance on ${nameIn(u.name)}`].filter(Boolean);
    card.append(ui.h("p", {}, `${NameOf(u.name)} own answer needs ${u.birthDate ? `${nameOf(u.name)} birth date` : `${nameOf(u.name)} details on People`}: without it the plan cannot be run for ${nameIn(u.name)}. On file: ${list(known)}.`),
      ui.h("div", { class: "row", style: { marginTop: "8px" } }, ui.h("a", { class: "btn secondary small", href: "#/household/people" }, u.birthDate ? "Add it on People" : "Check it on People")));
    return card;
  }

  function personCard(p, d) {
    // a single parent's need largest in a later year: the card is about every year, not only this one
    const card = ui.card(peakLater(p, d) ? `If ${sayName(p.name)} died` : `If ${sayName(p.name)} died this year`);
    if (!p.dependants) {
      card.append(ui.h("p", {}, `No one else in the plan depends on ${nameOf(p.name)} income, so life insurance would only need to pay for the funeral and any debts: about ${money(p.dime.debts + p.dime.finalExpenses)}.`),
        ui.h("p", { class: "muted small" }, p.cover > 0 ? `${NameIn(p.name)} ${verbFor(p.name, "has", "have")} ${money(p.cover)} of coverage.` : "Add a partner or children on People if someone does."));
      return card;
    }
    // cover that ends soon, before the need does: covered now, short from the day it ends
    const end = ending(p), ae = afterOf(p);
    const short = p.gap > 0 || !!end;
    // no need: one sentence, not a "$0" tile over the rules of thumb
    if (p.need > 0) card.append(ui.row(
      ui.stat("Coverage needed", money(p.need), p.method === "plan" ? "from your plan" : peakLater(p, d) ? `the most, ${diedIn(p, sizedOf(p))}` : p.method === "child" ? childSub(p.child) : `${dimeNames(p.dime)} added up`),
      ui.stat("Coverage you have", money(p.cover), p.coverWork > 0 ? `${money(p.coverWork)} of it through work` : p.cover > 0 ? "on Policies" : "none on file"),
    ));
    // a single parent's cover that ends soon: covered until then (when it pays each year's need until it ends), then what
    // they would need after it ends, with that figure's year; never "short by" the whole series' figure "from then"
    const endWords = () => {
      const left = leftOf(p, ae);
      // the year short the most is not the year of the largest need (a later policy pays that one): only its year is said,
      // and the cover still on file then "with" it (the figure is already the shortfall: never "less" it again)
      const what = ae.most === false ? `${diedIn(p, ae)}${left > 0 ? `, with ${leftWords(p, ae)}` : ""}` : `the most ${kidsOf(p, d)} would need, ${diedIn(p, ae)}${left > 0 ? `, less ${leftWords(p, ae)}` : ""}`;
      // several dates: each one said, never "Covered until" the first (the cover may pay every year to a later one)
      const head = many(p) ? list(stepsOf(p).map((s, i) => `${money(s.benefit)}${i ? "" : " of it ends"} on ${fmt.date(s.endDate)}`))
        : p.child.coveredUntilEnd ? `Covered until ${fmt.date(end.endDate)}, when ${money(end.benefit)} of it ends` : `${money(end.benefit)} of it ends on ${fmt.date(end.endDate)}`;
      return `${head}; after that short by up to about ${money(p.gapAfterEnd)} (${what}).`;
    };
    // cover on file checked year by year: a level payout is worth less as prices rise (its payout / that year's price level,
    // in today's money, against that year's need)
    // only the cover still paying that year (`coverInForce`; none: no line), and the shortfall said in both kinds of dollars
    // beside the "Short by" line above it (that figure is in that year's dollars: the cover to buy)
    const sy = !end && peakLater(p, d) && p.cover > 0 && inDollars(sizedOf(p)) ? sizedYear(p) : null;
    const worth = sy && sy.coverInForce > 0 ? (() => {
      const w = Math.round(sy.coverWorth / 100) * 100, under = sy.need - w;
      const what = sy.coverInForce < p.cover ? `the ${money(sy.coverInForce)} still on file then` : `the ${money(p.cover)} on file`;
      const unit = p.gap > 0 && under > 0 ? `: about ${money(under)} short in today's dollars, which is the ${money(p.gap)} more coverage in ${sy.year}'s dollars (rounded up to the next $1,000)` : "";
      return ` If ${nm(p)} died in ${sy.year}, ${what} would be worth about ${money(w)} in today's dollars, against ${money(sy.need)} needed then${unit}.`;
    })() : "";
    // a couple's (or the rule of thumb's) cover that ends by next year: "Covered until" only when the cover on file meets the
    // need today (gap 0), and every date named (verification 8b, review 2026-11-06: short $35,000 today read "Covered until
    // 6/30/2027"; two dates read only the first, with its own amount, as when the shortfall starts)
    const coupleEnd = () => {
      const steps = stepsOf(p).length ? stepsOf(p) : [end];
      const each = list(steps.map((s, i) => `${money(s.benefit)}${i ? "" : " of it ends"} on ${fmt.date(s.endDate)}`));
      if (p.gap > 0) return `Short by about ${money(p.gap)} now, and by about ${money(p.gapAfterEnd)} once ${many(p) ? `it has ended (${list(steps.map((s) => `${money(s.benefit)} on ${fmt.date(s.endDate)}`))})` : `${money(end.benefit)} of it ends on ${fmt.date(end.endDate)}`}.`;
      return many(p) ? `Covered for now: ${each}; once it has ended, short by about ${money(p.gapAfterEnd)}.` : `Covered until ${fmt.date(end.endDate)}, when ${money(end.benefit)} of it ends; short by about ${money(p.gapAfterEnd)} from then.`;
    };
    // short for retirement either way and no cover asked for: plain words, not a green "good" (round 8 review, UX 5)
    const eitherNone = !short && p.need === 0 && p.plan?.eitherWay;
    card.append(ui.h("p", { class: `ln-verdict ${short ? "bad" : eitherNone ? "" : "ok"}` }, end && ae ? endWords() : end ? coupleEnd() : short ? `Short by about ${money(p.gap)}.` : p.need === 0 && p.plan?.eitherWay ? `No life insurance needed for this: your plan is short for retirement either way, whoever lives.${p.cover > 0 ? ` ${Nm(p)} ${nm(p) === "you" ? "have" : "has"} ${money(p.cover)} of coverage on file.` : ""}` : p.need === 0 ? `No extra money needed: ${p.survivorName ? `${sayWhose(p.survivorName)} ${p.plan?.survivorPay > 0 ? "pay" : "income"} and your savings keep the plan on track` : p.method === "child" ? childEnough(p, d) : "the plan holds on its own"}.${p.method === "child" ? leftOutWords(p.child) : ""}${p.cover > 0 ? ` ${Nm(p)} ${nm(p) === "you" ? "have" : "has"} ${money(p.cover)} of coverage on top.` : ""}` : Math.round(p.spare) > 0 ? `Covered, with about ${money(p.spare)} to spare.` : "Covered, with nothing to spare."));
    if (worth) card.append(ui.h("p", { class: "small" }, worth.trim()));
    // without the cover through work (compute's `gapIfJobEnds`: a single parent's year by year, `ifJobEnds`, with its year)
    const jobYear = p.method === "child" && p.child?.ifJobEnds && p.child.ifJobEnds.year > d.startYear ? ` (${diedIn(p, p.child.ifJobEnds)})` : "";
    // a couple's term cover that ends by next year, which the figure leaves out too (compute's `jobEnding`): "once Ana's
    // $200,000 term policy ends on 6/30/2027" (review 2026-11-06 follow-up)
    const je = p.method === "child" ? null : p.jobEnding;
    const jobOnce = je ? ` once ${sayWhose(p.name)} ${je.policies > 1 ? `${money(je.benefit)} of term life insurance has ended (by ${fmt.date(je.endDate)})` : `${money(je.benefit)} term policy ends on ${fmt.date(je.endDate)}`}` : "";
    if (p.coverWork > 0 && p.gapIfJobEnds > gapOf(p)) card.append(ui.notice("warn", `${money(p.coverWork)} of ${sayWhose(p.name)} coverage comes with the job and ends with it. Without it ${p.method === "child" ? kidsOf(p, d) : "the family"} would be short about ${money(p.gapIfJobEnds)}${jobYear}${jobOnce}.`));
    // a second adult whose own plan cannot be built: the rule of thumb stands in, and this says what to add
    if (p.survivorMissing) card.append(ui.notice("info", [p.survivorMissing.birthDate
      ? `Add ${nameOf(p.survivorMissing.name)} birth date on People: the answer then comes from ${nameOf(p.survivorMissing.name)} own plan (pay, Social Security and savings) instead of a rule of thumb.`
      : `${NameOf(p.survivorMissing.name)} plan could not be worked out, so a rule of thumb stands in. Check ${checkWho(p.survivorMissing.name)} on People.`,
    // the fix is on another page: an outlined button to it, on its own line
    ui.h("div", { class: "row", style: { marginTop: "8px" } }, ui.h("a", { class: "btn secondary small", href: "#/household/people" }, p.survivorMissing.birthDate ? "Add it on People" : "Check it on People"))]));
    // short either way (round 8 review, UX 5): "with or without cover" was true only of the $0 worked out, not of any cover;
    // said as what it is: the death does not make the money run out sooner, so cover is not the fix. Cover asked for and not on
    // file: with today's cover it runs out sooner than the plan together would, as before
    if (p.plan && !p.plan.withCover.success && p.plan.withCover.failAge) card.append(ui.notice("warn", p.plan.eitherWay && !(p.gap > 0)
      ? [`${NameOf(p.survivorName)} money would run out at about ${p.plan.withCover.failAge} if ${nm(p)} died, and so would your plan together: ${p.need > 0 ? "with the coverage above, a death does not make it run out sooner, so more coverage is not the fix" : "a death does not make it run out sooner, so life insurance is not the fix"}. `, ui.h("a", { href: "#/retirement/projection" }, "Will the money last? ›")]
      : `With the insurance you have today, ${nameOf(p.survivorName)} money would run out at ${nameOf(p.survivorName)} age ${p.plan.withCover.failAge}.`));

    // how the plan's answer is worked out, then the two rules of thumb folded (they leave out the survivor's pay, Social
    // Security and savings, so they run several times higher and read as rival answers when shown at the same weight)
    const ways = ui.h("ul", { class: "ln-ways" });
    if (p.plan && p.plan.need !== null) {
      const g = p.plan.gapYears.filter((x) => x.amount > 0);
      const living = g.length ? ` Before ${nameIn(p.survivorName)} ${verbFor(p.survivorName, "retires", "retire")}, the household would be short about ${money(g[0].amount)} a year at first; the amount above already includes that.` : ` ${NameOf(p.survivorName)} pay${p.plan.benefits ? " and Social Security" : ""} would cover the household's living costs until retirement.`;
      card.append(ui.h("p", { class: "small" }, `How it is worked out: the smallest lump sum that keeps ${nameOf(p.survivorName)} plan ${p.plan.eitherWay ? `going as long as your plan together's, which runs out${p.plan.jointFailYear ? ` in ${p.plan.jointFailYear}` : ""} either way` : "on track to the end"}, spending ${Math.round(SURVIVOR_SPENDING * 100)}% of what you spend together, after a funeral of about ${money(FUNERAL)}. ${NameOf(p.name)} savings pass to ${nameIn(p.survivorName)}.${living}`));
    }
    // a single parent: the answer part by part
    if (p.method === "child") card.append(...childWays(p, d));
    const di = p.dime;
    const dimeParts = [di.debts > 0 ? `debts ${money(di.debts)}` : null, `funeral ${money(di.finalExpenses)}`, di.incomeYears > 0 ? `${di.incomeYears < 1.5 ? (di.incomeYears < 0.5 ? "less than a year" : "a year") : `${Math.round(di.incomeYears)} years`} of pay ${money(di.income)}` : null, di.mortgage > 0 ? `mortgage ${money(di.mortgage)}` : null, di.education > 0 ? `education ${money(di.education)}` : null].filter(Boolean);
    const dimeTitle = `${dimeNames(di)} added up`;
    ways.append(way(dimeTitle.charAt(0).toUpperCase() + dimeTitle.slice(1), money(di.total), `${dimeParts.join(" + ")}.${di.incomeYears > 0 ? " Pay counts until the youngest child turns 18." : d.children.length ? " No child is under 18, so no pay is counted." : " With no children, no pay is counted."}`));
    if (p.lifetime.years > 0) ways.append(way("Lifetime earnings", money(p.lifetime.total), `The family's share of ${nameOf(p.name)} take-home pay for ${p.lifetime.years} more working year${p.lifetime.years === 1 ? "" : "s"} (about ${money(p.lifetime.yearly)} a year, what ${nameIn(p.name)} would have spent on ${selfOf(p.name)} taken out), in today's dollars.`));
    const rules = p.lifetime.years > 0 ? 2 : 1;
    card.append(ui.h("details", { class: "ln-more" }, ui.h("summary", {}, rules === 2 ? "Two rules of thumb, for comparison" : "A rule of thumb, for comparison"), ways,
      p.plan && p.plan.need !== null ? ui.h("p", { class: "muted small" }, `${rules === 2 ? "Both leave" : "It leaves"} out ${nameOf(p.survivorName)} own pay, Social Security for the family and the savings you already have, so ${rules === 2 ? "they come" : "it comes"} out higher. ${rules === 2 ? "They are quick checks" : "It is a quick check"}; the figure above is the one built from your numbers.`)
      : p.method === "child" ? ui.h("p", { class: "muted small" }, rulesNote(p, rules)) : null));

    // Social Security for the family
    const b = p.plan?.benefits;
    if (b && (b.childMonthly > 0 || b.parentMonthly > 0)) {
      const kids = d.children.map((c) => c.name);
      const parts = [];
      if (b.childMonthly > 0) parts.push(`${kids.length === 1 ? kids[0] : "the children"} about ${money(b.childMonthly)} a month until ${b.childUntil}`);
      parts.push(b.parentMonthly > 0 ? `${nameIn(p.survivorName)} about ${money(b.parentMonthly)} a month while caring for a child under 16${p.plan.survivorPay > earningsTestExempt(d.startYear) ? ` (most of it is held back because ${nameIn(p.survivorName)} ${verbFor(p.survivorName, "earns", "earn")} over ${money(earningsTestExempt(d.startYear))} a year)` : ""}` : `${nameIn(p.survivorName)} nothing while working (the benefit for a parent caring for a child under 16 is held back on pay over ${money(earningsTestExempt(d.startYear))} a year)`);
      card.append(ui.h("h3", { style: { margin: "16px 0 4px" } }, "Social Security for the family"), ui.h("p", {}, `On ${nameOf(p.name)} record Social Security would pay ${parts.join(", and ")}. This is in your plan's answer.`));
    }

    // how long
    if (p.method === "child" && p.termUntil && p.termUntil.year > d.startYear && p.need > 0) card.append(...howLong(p, d));
    else if (p.termUntil && p.termUntil.year > d.startYear && p.need > 0) {
      const growing = d.children.filter((c) => c.age < 18).map((c) => c.name);
      card.append(ui.h("h3", { style: { margin: "16px 0 4px" } }, "For how long"), ui.h("p", {}, `${p.method === "dime" ? `The rule of thumb is largest now and gets smaller every year, as fewer years of ${sayWhose(p.name)} pay are left to count` : `The need is largest now and shrinks as savings grow${growing.length === 1 ? ` and ${sayName(growing[0])} grows up` : growing.length ? " and the children grow up" : ""}`}. Coverage that lasts until about ${p.termUntil.year} (${whyOf(p.termUntil)}) is the usual choice; a term policy is the cheap way to buy it.`));
    }
    return card;
  }

  // a single parent's need over time (compute's needByYear: the same answer if the parent died at the start of each year,
  // in today's money): when it is largest, that it ends when the children's needs end (the youngest's college), the cover
  // sized to the largest, and every year in a fold. "Shrinks" only when it goes down every year.
  function howLong(p, d) {
    const c = p.child, ys = c.needByYear ?? [], kw = kidsOf(p, d), t = p.termUntil;
    const ends = `It ends when ${whyOf(t)}, in about ${t.year}`;
    const many = (c.children ?? []).length > 1;
    const whose = many ? "each child's" : sayWhose(c.children[0]);
    // what is over each child's costs is kept for that child; it goes toward college only for a child whose college is
    // counted (never said of a child whose college is left out)
    const withCollege = [...new Set((c.collegeKids ?? []).map((k) => k.name))].filter((n) => (c.children ?? []).includes(n));
    const keptFor = many
      ? (withCollege.length === c.children.length ? "that child's college" : withCollege.length ? `that child, ${list(withCollege.map(sayWhose))} toward college` : "that child")
      : withCollege.length ? `${whose} college` : sayName(c.children[0]);
    const why = `Social Security for ${kw} is paid only until 18, and what it pays beyond ${whose} costs is kept for ${keptFor}: the later the death, the fewer of those years are left`;
    // the shape is read in today's money with a tolerance (compute's `rising`: a dip under 2% of the largest is not "going
    // down"); the cover is sized in that year's dollars (compute's `sized`), said once when prices make it larger
    const s = sizedOf(p), dollarsBigger = s.need > c.peak.need;
    const inToday = dollarsBigger ? "In today's dollars, the" : "The";
    const rising = c.rising ?? (() => { const upTo = ys.filter((y) => y.year <= c.peak.year); return upTo.every((y, i) => i === 0 || y.need >= upTo[i - 1].need); })();
    const largest = `${dollarsBigger ? "In today's dollars it" : "It"} is largest if ${nm(p)} died in ${c.peak.year}`;
    const text = c.steady
      ? `${inToday} need is largest now and gets smaller every year. ${ends}.`
      : c.peak.year === d.startYear
        ? `${inToday} need is largest now. It goes down and up again over the years (${why}). ${ends}.`
        : rising
          ? `The need grows for a while: ${why}. ${largest}. ${ends}.`
          : `The need goes down for a few years, then grows: ${why}. ${largest}. ${ends}.`;
    // a level policy pays the same dollars every year while prices rise: sized to the most in that year's dollars, said once
    const size = dollarsBigger
      ? ` A policy pays the same dollars every year while prices rise, so it is sized to the most in that year's dollars: about ${money(p.need)}, if ${nm(p)} died in ${s.year}. Coverage for that amount that lasts until about ${t.year} covers every year; a term policy is the cheap way to buy it.`
      : ` Coverage for the largest amount, ${money(p.need)}, that lasts until about ${t.year} covers every year; a term policy is the cheap way to buy it.`;
    const out = [ui.h("h3", { style: { margin: "16px 0 4px" } }, "For how long"), ui.h("p", {}, `${text}${size}`)];
    if (ys.length > 1) {
      const ul = ui.h("ul", { class: "ln-ways ln-years" });
      for (const y of ys) {
        // the year the cover is sized to: marked, and its figure in that year's dollars said under it
        const top = y.year === s.year && y.need > 0;
        const li = way(y.year === d.startYear ? `${y.year} (today)` : `${y.year}`, y.need > 0 ? money(y.need) : "nothing", top && dollarsBigger ? `About ${money(p.need)} in ${y.year}'s dollars, the most of any year: the coverage is sized to it.${(y.coverInForce ?? 0) > 0 && !ending(p) ? (y.coverInForce < p.cover ? ` The ${money(y.coverInForce)} still on file in ${y.year} would be worth about ${money(Math.round(y.coverWorth / 100) * 100)} in today's dollars.` : ` The ${money(p.cover)} on file would be worth about ${money(Math.round(y.coverWorth / 100) * 100)} in today's dollars then.`) : ""}` : "");
        if (top) li.classList.add("ln-peak");
        if (!(top && dollarsBigger)) li.querySelector(".ln-d")?.remove();
        ul.append(li);
      }
      out.push(ui.h("details", { class: "ln-more" }, ui.h("summary", {}, `The need year by year, to ${ys.at(-1).year}`),
        ui.h("p", { class: "muted small" }, `What ${kw} would need if ${nm(p)} died at the start of each year, in today's dollars: ${many ? "the children" : sayName(c.children[0])} that much older, the debts and savings as your plan projects them, everything else as today.`), ul));
    }
    return out;
  }

  // a single parent's answer, part by part, each with what it is (compute's `child`; the parts as the sentence says them)
  function childWays(p, d) {
    const c = p.child, s = sh(c);
    const kids = c.children.map(sayName), one = kids.length === 1, kw = list(kids);
    const theirs = one ? `${kw}'s` : "the children's";
    const half = (x) => (Math.abs(x - 1 / 2) < 1e-6 ? "half" : Math.abs(x - 2 / 3) < 1e-6 ? "two thirds" : Math.abs(x - 3 / 4) < 1e-6 ? "three quarters" : `${Math.round(x * 100)}%`);
    const ul = ui.h("ul", { class: "ln-ways" });
    // childcare as the total counts it, month by month: shared between the children under 13 today, each one's part stopping
    // the month they turn 13, a line stopping after its end date ("$900 a month until Ava turns 13 in 2029, then $450 ...")
    const careFor = (c.childcareFor ?? []).map(sayName);
    const lines = c.childcareLines ?? [];
    const careWhen = (s) => {
      const ev = [s.who.length ? `${list(s.who.map(sayName))} ${s.who.length > 1 ? "turn" : "turns"} 13 in ${s.until}` : null,
        s.ended.length ? (lines.length === 1 ? `it ends on Expenses in ${s.lastYear}` : `the ${list(s.ended)} ${s.ended.length > 1 ? "lines on Expenses end" : "line on Expenses ends"} in ${s.lastYear}`) : null].filter(Boolean);
      return ev.length ? `until ${ev.join(" and ")}` : `until ${s.until}`;
    };
    const careText = (c.careSteps ?? []).map((s, i) => `${i ? "then " : ""}${money(s.monthly)} a month ${careWhen(s)}`).join(", ");
    const care = c.childcare >= 50 && careText ? `Childcare (${careText}) and ${theirs}` : cap(theirs);
    const careNot = c.childcare < 50 && c.childcareMonthly >= 1 && !careFor.length ? ` The ${money(c.childcareMonthly)} a month of childcare on Expenses is not counted: no child is under 13.` : "";
    // a page to go to, as an outlined button on its own line (44 px), never a link inside the sentence
    const go = (href, label) => ui.h("div", { class: "row", style: { marginTop: "8px" } }, ui.h("a", { class: "btn secondary small", href }, label));
    const ssWho = one ? kw : "the children";
    // the children's own part first (costs until 18, college), then the Social Security that pays only for it, then the
    // debts and the funeral (Social Security never pays those: it is the children's money)
    if (c.years === 0) {
      // turning 18 this month: one sentence, no $0 lines
      ul.append(ui.h("li", {}, ui.h("div", { class: "ln-d" }, `${one ? `${kw} turns` : "The children turn"} 18 this month, so no month of costs or Social Security is left to count.`)));
    } else {
      // the share steps down as a child turns 18, like childcare: "half of it, about $1,460 a month until Child 1 turns 18 in
      // 2040"; "two thirds of it, about $1,947 a month until Child 2 turns 18 in 2037, then half, about $1,460 a month ..."
      const shareText = (c.shareSteps ?? []).map((s, i) => `${i ? "then " : ""}${half(s.fraction)}${i ? "" : " of it"}, about ${money(s.monthly)} a month until ${s.who.length ? `${list(s.who.map(sayName))} ${s.who.length > 1 ? "turn" : "turns"} 18 in ` : ""}${s.until}`).join(", ");
      ul.append(way(`${cap(theirs)} costs until 18`, money(s.costs), `${care} share of the rest of what the household spends${shareText ? ` (${shareText})` : ""}, in today's dollars.${careNot}`));
    }
    ul.append(collegeWay(c, go, d));
    if (c.years > 0) {
      // the benefit steps down as a child turns 18 (steps of the same amount are one): "about $3,900 a month until Ava turns 18
      // in 2034, then about $1,950 ..."
      const steps = c.benefitSteps ?? [];
      const pays = steps.length > 1
        ? steps.map((s, i) => `${i ? "then " : ""}about ${money(s.monthly)} a month until ${s.who.length ? `${list(s.who.map(sayName))} ${s.who.length > 1 ? "turn" : "turns"} 18 in ` : ""}${s.until}`).join(", ")
        : `about ${money(c.benefitMonthly)} a month until ${c.benefitUntil}`;
      // each child's Social Security pays only that child's own costs and college: more than the costs goes toward their
      // college; more than both is kept for them (never another child's, the debts or the funeral). Every figure is a shown
      // part, and the spare is the shown total less the shown part counted, so they add up
      const whose = one ? `${kw}'s` : "the children's";
      const ks = kidsShown(c);
      const same = !one && ks.every((k) => (k.short > 0) === (ks[0].short > 0) && (k.spare > 0) === (ks[0].spare > 0) && (k.counted >= k.costs) === (ks[0].counted >= ks[0].costs));
      const over = one || same
        ? (s.spare > 0
          ? ` That is about ${money(s.benefits)} in all, more than ${whose} costs until 18${s.college > 0 ? ` and ${collegeWords(c)}` : ""}: those are covered, and the other ${money(s.spare)} is ${whose} money, kept for ${one ? kw : "them"}, so it does not go toward the debts or the funeral.`
          : s.benefits > s.costs ? ` That is more than ${whose} costs until 18: the rest is ${whose} money too, so it goes toward the college above.` : "")
        : ` That is about ${money(s.benefits)} in all, but each child's is that child's own money: it pays only that child's costs and college. ${ks.map((k) => {
          const K = sayName(k.name), Ks = sayWhose(k.name);
          if (k.short === 0) return `${cap(Ks)} (about ${money(k.benefits)}) covers ${K}${k.spare > 0 ? `, and the other ${money(k.spare)} is kept for ${K}` : ""}.`;
          if (k.counted >= k.costs) return `${cap(Ks)} (about ${money(k.benefits)}) covers ${Ks} costs until 18; ${K} still needs ${money(k.short)} for college.`;
          return `${cap(Ks)} (about ${money(k.benefits)}) pays part of ${Ks} costs; ${K} still needs ${money(k.short)}${k.college > 0 ? " for costs and college" : ""}.`;
        }).join(" ")} One child's money never pays another's costs, the debts or the funeral.`;
      ul.append(c.noRecord
        ? way(`Social Security for ${ssWho}`, "not counted", [`No Social Security figure for ${nm(p)} is in the plan, so nothing comes off. Add it and the answer goes down.`, go("#/retirement/social-security", "Add it on Social Security")])
        : way(`Social Security for ${ssWho}`, `${MINUS}${money(s.counted)}`, `On ${sayWhose(p.name)} record Social Security would pay ${ssWho} ${pays}. This is in the answer.${over}`));
    }
    if (s.debts > 0) ul.append(way("Debts", money(s.debts), `Everything ${nm(p) === "you" ? "you owe" : `${nm(p)} owes`} but a mortgage, paid off at once.${p.dime.mortgage > 0 ? " The mortgage is not paid off: the home's cost is already in the spending above." : ""}`));
    ul.append(way("Funeral", money(s.funeral), "A typical funeral and burial (the US median)."));
    if (s.savings > 0) ul.append(way(`Savings that pass to ${ssWho}`, `${MINUS}${money(s.savings)}`, "Checking, savings and investments outside retirement accounts. Retirement accounts are left out: tax comes off on the way out."));
    // every part is in today's money; one years away counts for less (or more) by the real bond return, the costs and college alike
    const r = c.realDiscount ?? 0, pct = `${+(Math.abs(r) * 100).toFixed(1)}%`;
    const disc = Math.abs(r) >= 0.0005 ? ` Every part is in today's dollars; a cost years away counts for a little ${r > 0 ? "less" : "more"}, because money set aside now grows about ${pct} a year ${r > 0 ? "faster" : "slower"} than prices.` : " Every part is in today's dollars.";
    // Social Security covers the children's own part: say so, and what the debts and the funeral still need (every figure a
    // shown part or a sum of them: 12,300 - 1,900 = 10,400)
    const covers = ssCovers(c) ? `Social Security covers ${theirs} ${list([s.costs > 0 ? "costs" : null, s.college > 0 ? collegeWords(c) : null].filter(Boolean))}` : "";
    const restNames = s.debts > 0 ? "the debts and the funeral" : "the funeral";
    let words;
    if (covers) words = s.net < 0
      ? `${covers}, and the savings come to about ${money(-s.net)} more than ${restNames}, so no coverage is needed${peakLater(p, d) ? " today" : ""}.`
      : `${covers}; ${restNames} still ${s.debts > 0 ? "need" : "needs"} ${money(s.rest)}${s.savings > 0 ? `, less the ${money(s.savings)} saved: about ${money(s.net)}` : ""}, rounded up to the next $1,000.`;
    else {
      const pay = list([s.counted > 0 ? "Social Security" : null, s.savings > 0 ? "the savings" : null].filter(Boolean)) || "what is on file";
      words = s.net < 0 ? `${cap(pay)} ${s.counted > 0 && s.savings > 0 ? "come" : "comes"} to about ${money(-s.net)} more than all of this, so no coverage is needed${peakLater(p, d) ? " today" : ""}.` : `Added up${s.net % 1000 ? `, about ${money(s.net)},` : ""} and rounded up to the next $1,000.`;
    }
    // the largest need is later than today: this is today's figure, and the cover is sized to the largest (For how long)
    const laterWords = peakLater(p, d) ? ` The coverage is sized to a later year: about ${money(p.need)} ${diedIn(p, sizedOf(p))} (see For how long).` : "";
    const total = way(peakLater(p, d) ? "Needed today" : "Coverage needed", money(c.today ?? p.need), `${words}${disc}${laterWords}`, true);
    total.classList.add("ln-total");
    ul.append(total);
    return [ui.h("h3", { style: { margin: "16px 0 0" } }, "How it is worked out"), ul];
  }

  // college, once for each child under 18, every child it counts named and any it leaves out said plainly (compute's
  // collegeParts: a goal's own amount, else the Education page's figure; collegeKids: whose and from when)
  function collegeWay(c, go, d) {
    const parts = (c.collegeParts ?? []).filter((x) => x.gross > 0), left = c.collegeLeftOut ?? [], ck = c.collegeKids ?? [];
    const named = (a) => list(a.map(sayName));
    // the Education page's figures quoted as that page shows them (to the $10, its `shownAmount`), the share chosen there said
    const pctOf = (x) => `${Math.round(x * 100)}%`;
    const say = (x) => x.from === "planner"
      ? `The Education page puts ${list(x.figures.map((f, i) => `${sayWhose(f.name)}${i ? "" : " college"} at ${money(f.full ?? f.amount)}${(f.share ?? 1) < 1 ? ` (${pctOf(f.share)} of it counted, the share you chose there: ${money(f.amount)})` : ""}`))} in today's dollars${x.saved > 0 ? `, less the ${money(x.saved)} set aside in your goal “${x.name}”` : ""}.`
      : `Your goal “${x.name}” is ${money(x.gross)} for ${named(x.for)}${x.saved > 0 ? `, less the ${money(x.saved)} set aside` : ""}.`;
    // counted from the year each child turns 18, discounted like the costs
    const seen = new Set(), kids = ck.filter((k) => !seen.has(k.name) && seen.add(k.name));
    const later = Math.abs(c.realDiscount ?? 0) >= 0.0005 && kids.some((k) => k.year > d.startYear);
    const rest = parts.some((x) => x.saved > 0) ? "the rest" : "it";
    const shownCollege = sh(c).college;
    const when = later && shownCollege > 0 ? (kids.length === 1
      ? ` Counted from ${kids[0].year}, when ${sayName(kids[0].name)} turns 18: about ${money(shownCollege)} set aside now covers ${rest}.`
      : ` Each child's is counted from the year they turn 18 (${list([...new Set(kids.map((k) => k.year))].map((y) => `${list(kids.filter((k) => k.year === y).map((k) => sayName(k.name)))} in ${y}`))}): about ${money(shownCollege)} set aside now covers ${rest}.`) : "";
    // nothing discounted (college this year): the figure quoted and the line's differ only by the rounding to $100, said once
    const quoted = parts.filter((x) => x.from === "planner").flatMap((x) => x.figures).reduce((t, f) => t + (f.amount ?? 0), 0) + parts.filter((x) => x.from === "goal").reduce((t, x) => t + x.gross, 0) - parts.reduce((t, x) => t + (x.saved ?? 0), 0);
    const rounding = !when && shownCollege > 0 && Math.abs(quoted - shownCollege) >= 1 && Math.abs(quoted - c.college) < 1 ? ` That is about ${money(shownCollege)} here, to the nearest $100 like every part of this answer.` : "";
    const out = leftOutWords(c);
    // a goal for a grown dependent (or one with no birth date) is theirs, not the children's: said, never counted for them
    const others = (c.collegeOthers ?? []).map((g) => ` “${g.name}” is not counted: ${g.why === "nobirth" ? `${list(g.for.map(sayName))} ${g.for.length > 1 ? "have" : "has"} no birth date on People` : `it is for ${list(g.for.map(sayName))}, 18 or over`}, and this answer is for the children under 18.`).join("");
    const text = `${parts.map(say).join(" ")}${when}${rounding}${out}${others}`.trim();
    const btn = left.some((k) => k.why === "none") ? go("#/goals/education", "Work it out on Education") : parts.some((x) => x.from === "planner") || left.length ? go("#/goals/education", "Change it on Education") : null;
    const value = shownCollege > 0 ? money(shownCollege) : parts.some((x) => x.saved > 0) ? "set aside" : "not counted";
    const words = shownCollege === 0 && parts.some((x) => x.saved > 0) ? `${text} What is already set aside covers it.` : text || "No college is counted.";
    return way("College", value, btn ? [words, btn] : words);
  }

  // what to buy, for how long, and who to name (no price: there is no rate table the plan can stand behind)
  function howCard(people, d) {
    const card = ui.h("section", { class: "card ln-how", id: "ln-how", hidden: true }, ui.h("h2", {}, "How to get it"));
    const unplanned = d.unplanned ?? [];
    const many = people.length + unplanned.length > 1;
    const toPeople = (label) => ui.h("div", { class: "row" }, ui.h("a", { class: "btn secondary small", href: "#/household/people" }, label));
    for (const p of people) {
      const you = nm(p) === "you";
      // a rule of thumb standing in for the plan's own answer: say it is one, and how to get the plan's answer (a second
      // adult's missing birth date) before buying on it
      const sm = p.method === "dime" ? p.survivorMissing : null;
      if (p.method === "dime") {
        const rule = `This is a rule of thumb: ${dimeNames(p.dime)} added up come to about ${money(p.need)}${p.cover > 0 ? `, ${money(gapOf(p))} more than the coverage on file` : ""}.`;
        const fix = !sm ? "" : sm.birthDate
          ? ` Add ${nameOf(sm.name)} birth date on People first: the answer then comes from your own plan, with ${nameOf(sm.name)} pay, Social Security and savings counted, instead of a rule of thumb.`
          : ` Check ${checkWho(sm.name)} on People first: once ${nameOf(sm.name)} plan can be worked out, the answer comes from your own plan instead of a rule of thumb.`;
        if (many) card.append(ui.h("h3", {}, `Life insurance on ${nm(p)}`));
        card.append(ui.h("p", {}, `${rule}${fix}`));
        if (sm) card.append(toPeople(sm.birthDate ? "Add it on People" : "Check it on People"));
      }
      const least = gapOf(p);
      // a single parent's largest need is later than today: the policy is sized to it, and says when it peaks
      // with cover that ends soon, the figure is what is needed after it ends (compute's `afterEnd`), less only the cover that
      // stays; never "less" a policy that will be gone
      const peakWords = (q) => {
        const ae = afterOf(q);
        const left = ae ? leftOf(q, ae) : 0;
        // the year short the most is not the year of the largest need: the figure is the shortfall, the cover then "with" it
        if (ae) return ae.most === false ? ` (the most ${kidsOf(q, d)} would be short as coverage on file ends, ${diedIn(q, ae)}${left > 0 ? `, with ${leftWords(q, ae)}` : ""})` : ` (the most ${kidsOf(q, d)} would need after ${money(endedSum(q, ending(q)))} of coverage ends, ${diedIn(q, ae)}${left > 0 ? `, less ${leftWords(q, ae)}` : ""})`;
        return peakLater(q, d) ? ` (the most ${kidsOf(q, d)} would need, ${diedIn(q, sizedOf(q))}${q.cover > 0 ? `, less the ${money(q.cover)} on file` : ""})` : "";
      };
      // the length to ask for on a quote: the shortest usual term that reaches the year (TERM_LENGTHS)
      const yrs = p.termUntil ? termYears(p.termUntil.year, d.startYear) : null;
      const term = p.termUntil ? ` that lasts until about ${p.termUntil.year} (${whyOf(p.termUntil)}): ask for a ${yrs}-year term${d.startYear + yrs < p.termUntil.year ? `, the longest most companies sell` : ""}` : "";
      // cover through work is already counted; it ends with the job, so say both sizes: the least to buy now, and what keeps
      // them covered after a job change
      const job = p.coverWork > 0 && p.gapIfJobEnds > least;
      const workCover = `${you ? "Your" : `${Nm(p)}'s`} ${money(p.coverWork)} through work is counted, but it ends with the job.`;
      const check = p.coverWork > 0 ? workCover : `Check what work already gives ${you ? "you" : nm(p)} first: it often pays one or two years of pay and ends with the job.`;
      const buy = sm
        // the amount waits for the plan's own answer; the kind and length of cover do not
        ? `When you know the amount: ${term ? `a level term policy${term}` : "level term life insurance"}. ${check}`
        : job
          ? `${term ? `A level term policy${term}. Buy at least ${money(least)} now` : `Buy at least ${money(least)} of level term life insurance now`}; ${money(p.gapIfJobEnds)} keeps ${p.method === "child" ? kidsOf(p, d) : whoOf(p, d)} covered even after a job change. ${workCover}`
          : `A level term policy for about ${money(least)}${peakWords(p)}${term}. ${check}`;
      if (many && p.method !== "dime") card.append(ui.h("h3", {}, `Life insurance on ${nm(p)}`));
      card.append(ui.h("p", {}, `${buy} Get two or three quotes from an independent agent or an online quote site.`));
    }
    // an adult the plan cannot run for: what is on file, and what to add first
    for (const u of unplanned) {
      card.append(ui.h("h3", {}, `Life insurance on ${sayName(u.name)}`),
        ui.h("p", {}, `${NameOf(u.name)} own answer needs ${u.birthDate ? `${nameOf(u.name)} birth date` : `${nameOf(u.name)} details on People`} first. ${u.cover > 0 ? `${money(u.cover)} of life insurance on ${nameIn(u.name)} is on file${u.coverWork > 0 ? `, ${money(u.coverWork)} of it through work` : ""}.` : `No life insurance on ${nameIn(u.name)} is on file.`}`));
    }
    card.append(ui.h("p", { class: "muted small" }, "Level term: the payout and the price stay the same until the policy ends."));
    const minors = d.children.filter((c) => c.age < 18).map((c) => sayName(c.name));
    if (minors.length) {
      // a couple names the other parent first and a trust or custodian for the children as the backup; a single parent names
      // the trust or custodian (the answer above is worked out as the survivor's money, or the children's)
      const spouses = [...new Set(people.map((p) => p.survivorName ?? p.survivorMissing?.name).filter(Boolean))];
      const who = people.length > 1 && spouses.length > 1 ? "each other" : selfOf(spouses[0], nameIn(spouses[0]));
      card.append(ui.h("h3", {}, "Who gets the money"),
        ui.h("p", {}, spouses.length
          ? `Name ${who} as the beneficiary. As the backup for ${list(minors)}, name a trust or a custodian under your state's Uniform Transfers to Minors Act (UTMA): a child under 18 cannot receive the money directly. Name a guardian in your will.`
          : "A child under 18 cannot receive the money directly: name a trust or a custodian under your state's Uniform Transfers to Minors Act (UTMA) as the beneficiary, and name a guardian in your will."),
        // labelled with the titles of the pages they open
        ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/documents" }, "Documents checklist"), ui.h("a", { class: "btn secondary", href: "#/estate/beneficiaries" }, "Beneficiary audit")));
    }
    return card;
  }

  function way(title, value, text, main = false) {
    return ui.h("li", { class: main ? "ln-main" : null }, ui.h("div", { class: "ln-head" }, ui.h("span", {}, title), ui.h("span", { class: "ln-v" }, value)), ui.h("div", { class: "ln-d" }, text));
  }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
}
