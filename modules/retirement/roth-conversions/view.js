// modules/retirement/roth-conversions/view.js -- DOM only. The answer first: how much to move to a Roth, what it leaves at the
// end after tax, and one filled button that puts it in the plan; then each way as one line with its figure and one button, and
// the year-by-year list, the rules and the official names under "How this is worked out"; the settings last (round 8, Batch 5b:
// the owner, 2026-11-06, "Just make sure a layman can easily understand and use the page"). A "way" is a fill rate: each year,
// convert only what would be taxed at up to that rate (the bracket's top, in compute.js).
import { needButtons } from "../needs.js";
import { compute, IRMAA_FIRST_TIER } from "./compute.js";
// "you" for the first adult Get started left unnamed ("Me"), with the verb to match (round 7)
import { NameIn, nameIn, nameOf, verbFor, needItem } from "../../../core/words.js";
// every fold is drawn by the one helper (docs/OPTIONAL.md), titles unchanged: "How this is worked out" (kind how) opens with
// Settings' "Show how answers are worked out" and a person's own tap on it is kept on this phone; the costlier rates and the
// settings are items, never opened by a switch
import { part } from "../../../core/ui/more.js";

let pending = null;
let openAfter = null;   // the part a save was made in ("settings"): drawn open on the redraw that follows, then forgotten (R17)

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const justSaved = openAfter === "settings";   // read once, on the draw after the save
  openAfter = null;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Roth conversions"), ui.h("p", { class: "lede" }, "Moving money from a 401(k) or IRA into a Roth in a year when its tax is low. It needs the same answers as the Will the money last? page:"), ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, needItem(m)))), (needButtons(ui, d.missing) ?? ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Open Will the money last?")))));
    return;
  }
  const best = d.options.find((o) => o.best), none = d.none;
  const pct = (r) => `${Math.round(r * 100)}%`;
  // "at the 10% rate", never "up to 10%": that read as 10% of the account (UX review 4)
  const wayName = (o) => (o.fillRate ? `At the ${pct(o.fillRate)} rate` : "No conversions");
  const rateWords = (r) => (r === 0.1 ? "the lowest rate, 10%" : `no more than ${pct(r)}`);
  const years = (ys) => (ys.length > 1 ? `${ys[0]} to ${ys.at(-1)}` : String(ys[0]));
  const r100 = (n) => money(Math.round(n / 100) * 100);
  // the amounts to tell the 401(k) or IRA firm, year by year in a few words: "about $4,300 in 2028, then about $18,500 a year from
  // 2033 to 2040" (runs of years; a run that grows says where it starts and ends; more than two runs: the total and the span)
  // the moves in words, the amount first so the sentence reads "move about $18,700 to a Roth in 2030, rising each year to about
  // $28,200 in 2039" (wording follow-up w001); the clause carries "to a Roth" itself, once
  const movesWords = (moves = []) => {
    const runs = [];
    for (const m of moves) { const last = runs.at(-1); if (last && m.year === last.at(-1).year + 1) last.push(m); else runs.push([m]); }
    const runWords = (run, first) => {
      const to = first ? " to a Roth" : "";
      if (run.length === 1) return `about ${r100(run[0].real)}${to} in ${run[0].year}`;
      const xs = run.map((m) => m.real), lo = Math.min(...xs), hi = Math.max(...xs);
      if (hi <= lo * 1.25) return `about ${r100(xs.reduce((a, b) => a + b, 0) / xs.length)} a year${to} from ${run[0].year} to ${run.at(-1).year}`;
      const up = xs.every((x, i) => i === 0 || x >= xs[i - 1] - 0.5), down = xs.every((x, i) => i === 0 || x <= xs[i - 1] + 0.5);
      return `about ${r100(run[0].real)}${to} in ${run[0].year}, ${up ? "rising each year to" : down ? "falling each year to" : "then"} about ${r100(run.at(-1).real)} in ${run.at(-1).year}`;
    };
    if (!runs.length) return "";
    return runs.length <= 2 ? runs.map((r, i) => runWords(r, i === 0)).join(", then ") : `about ${r100(moves.reduce((t, m) => t + m.real, 0))} in all to a Roth, from ${moves[0].year} to ${moves.at(-1).year}`;
  };
  // the plan works tax out at a flat rate until conversions are on, and turning them on switches it to the real rates: said before
  // and after the tap, so the change in Will the money last? is not taken for the conversions' doing (UX review 3)
  const flatNow = (plan.retirement?.taxMode ?? "flat") !== "brackets";
  const flatPct = pct(Number(plan.retirement?.taxRate ?? 0.15));
  // the plan's own setting into the projection: conversions run on the federal rates (the brackets), so those go on with them
  const useWay = (o) => {
    const mv = movesWords(o.moves);
    pending = o.fillRate ? `Done: your plan now converts at the ${pct(o.fillRate)} rate${mv ? `: it moves ${mv}` : ""}.${flatNow ? ` It also works out tax at the real rates now, not a flat ${flatPct}: that alone changes what Will the money last? says.` : ""}` : "Conversions turned off.";
    store.update((p) => { p.retirement.rothConversion = { ...(p.retirement.rothConversion ?? {}), on: !!o.fillRate, fillRate: o.fillRate ?? p.retirement.rothConversion?.fillRate ?? 0.22 }; if (o.fillRate) p.retirement.taxMode = "brackets"; });
  };
  const canConvert = d.verdict !== "no-pretax" && d.verdict !== "no-years";
  // the help with marketplace cover before 65 (the premium tax credit), said plainly when the plan has those years (round 8,
  // equity-1): what stops it, and that every figure counts it; each way's own loss is on its line
  const market = d.options.some((o) => o.creditReal > 0 || o.cliffYears.length);
  const line = d.options.find((o) => o.cliffIncome)?.cliffIncome;
  // no years to convert in (round 8, widow-3): say what still works, never "conversions do not help"
  const nw = d.noWindow, who = nw ? nw.name : null;
  // another adult's own pre-tax money, still before their own required withdrawals (round 8 review D3): any part of it can be converted
  const youngerWords = (nw?.younger ?? []).map((y) => `${NameIn(y.name)} can move any part of ${nameOf(y.name)} ${money(y.deferredNow)} to a Roth each year until ${y.startYear}, when ${nameOf(y.name)} required withdrawals start. Each move is taxed as income that year.`);
  const heirsShort = "It can pay for your heirs: they must empty an inherited IRA within 10 years and pay tax on it, while a Roth comes out tax-free.";
  // the plan's own setting leaves at least $1,000 less than the best, or runs out while the best lasts (round 8 review UX 3): said, with the switch
  const bb = d.behind, behind = bb ? d.options.find((o) => o.chosen) : null;
  // the best way, when the plan does not use it yet: the page's one filled button
  // (only when it helps: with the money running out either way the page says to fix the plan first)
  const offerBest = d.verdict === "helps" && best && !best.chosen && best.offer && (best.fillRate === null || best.totalConvertedReal >= 1);
  // a gain under 2% of what is left with none is little: said so, and the button is outlined (UX review 13: $4,948 after 50 years
  // under a filled button)
  const gain = best && none ? best.endAfterTaxReal - none.endAfterTaxReal : 0;
  const small = d.verdict === "helps" && gain < 0.02 * Math.max(1, none.endAfterTaxReal);
  // why the first move waits (UX review 13): the years before it have no room at that rate, the year's other income already fills it
  const firstMove = best?.moves?.[0]?.year ?? null;
  // today's dollars, and the plan's flat rate until conversions are on, on one small line (UX review 3)
  const dollarsWords = `Amounts are in today's dollars.${flatNow ? ` This page uses the actual tax rates for each year; your plan uses a flat ${flatPct} tax rate until you turn conversions on.` : ""}`;
  // said as what the setting does, not as "nothing could be converted": the rate's room is what ordinary income leaves; qualified dividends and
  // gains sit on top of it and do not fill it (follow-up 2026-11-07, 5b R4: it blamed investment gains and dividends; verify: withdrawals from an
  // investment account fill nothing either, so the list names 401(k) or IRA withdrawals)
  const waitWords = d.helps && firstMove && d.span && firstMove > d.span.from + 1 ? `Until ${firstMove}, your pay, pension, taxable Social Security and 401(k) or IRA withdrawals fill the ${pct(best.fillRate)} rate, so this converts nothing before then.` : null;
  // a setting whose every conversion year owes no tax (the deduction covers it) is not "taxed at 10%" (Kim: $0 of tax in each year)
  // a conversion that lifts income past the top of the 0% (or 15%) rate on investment gains and dividends makes those pay the next rate
  // too, so "taxed at 10%" is a little low in those years: said, not hidden (money review M4)
  const gainsUp = !!best && best.fillRate !== null && d.shown === best.fillRate && (d.table ?? []).some((r) => r.gainsMoved >= 1);
  const taxedAt = (r) => rateWords(r) + (gainsUp ? ", or a little more in years it also raises the tax on your investment earnings" : "");
  const untaxed = !!best && d.shown === best.fillRate && (d.table ?? []).length > 0 && d.table.every((r) => r.taxes < 0.5);

  // ---- the answer ------------------------------------------------------------------------------------------------------------------
  const hero = ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Roth conversions"));
  const say = (text, cls) => hero.append(ui.h("p", cls ? { class: cls } : {}, ...[text].flat()));
  if (d.verdict === "no-pretax") {
    say("There is nothing to convert: a conversion moves money from a 401(k) or traditional IRA into a Roth, and none is on file.", "lede");
    say("If you have one, add it on Net worth.");
    hero.append(ui.row(ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Add it on Net worth ›")));   // RB3: a button, not a word in the sentence
  } else if (d.verdict === "no-years") {
    if (nw.reason === "started") {
      // a do-or-don't in two short lines (UX review 12: "It can pay for your heirs" left her asking "so should I?")
      say("You can still move money into a Roth account once this year's required amount is out. A Roth is one you pay the tax on now and never owe tax on again.", "lede");
      for (const y of youngerWords) say(y);
      say("It pays off only if your children would pay tax at a higher rate on what you leave them.");
    } else if (nw.reason === "owner-younger") {
      const [y0, ...more] = youngerWords;
      say(y0, "lede");
      for (const y of more) say(y);
      say(heirsShort);
    } else if (nw.reason === "until") {
      say(`You chose to stop converting at ${d.untilAge}, and retirement starts at ${nw.retireAge}, so no years are left to convert in.`, "lede");
      say('Change "Convert each year" under Conversion settings below.');
    } else {
      say(`Required withdrawals start at ${d.rmdStartAge}, and ${nameIn(who)} ${verbFor(who, "retires", "retire")} at ${nw.retireAge}: there are no years between to convert in.`, "lede");
      say("Once they start, you can still convert once each year's required amount is out.");
      say(heirsShort);
    }
  } else if (!none.success) {
    say(`The money runs out in ${none.failYear} with or without conversions${best.fillRate !== null && best.failYear !== none.failYear ? `; converting at the ${pct(best.fillRate)} rate moves that to ${best.failYear}` : ""}.`, "lede");
    // one outlined button, not a link inside the sentence (batch 5b UX review: links in a sentence are hard to tap on a phone)
    say("Conversions move tax around; they do not add money. To see what would fix the plan, open \"Will the money last?\".");
    hero.append(ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "Will the money last?")));
  } else if (d.helps && small) {
    say(`Converting makes little difference for you: about ${money(gain)} more at the end, after tax.`, "lede");
    say(`It would move ${movesWords(best.moves)}, ${untaxed ? "with no tax to pay in those years" : `each taxed at ${taxedAt(best.fillRate)}`}.`);
    if (waitWords) say(waitWords, "small");
    say(dollarsWords, "small");
  } else if (d.helps) {
    // the amounts to move, year by year, first (UX review 4: the hero gave a rate, never a dollar figure)
    say(`Move ${movesWords(best.moves)}.`, "lede");
    say(untaxed ? `No tax is due in those years, and it leaves about ${money(gain)} more at the end, after tax.` : `Each move is taxed at ${taxedAt(best.fillRate)}, and leaves about ${money(gain)} more at the end, after tax.`);
    if (waitWords) say(waitWords, "small");
    say(dollarsWords, "small");
  } else {
    // the reason the figures show (money review M2): where the nearest rate loses mostly through the help with health insurance before 65,
    // it is not "the tax now is about what it would be later" (it can even be less)
    const near = d.options.find((o) => o.fillRate && o.success);   // the lowest rate: the one that should cost least
    const taxLess = near ? none.taxesReal - near.taxesReal : 0;
    const helpWords = !!near && near.creditLostReal >= 1000 && near.creditLostReal > Math.max(0, taxLess);   // exactly what the sentence says: more help lost than tax saved
    say(`Moving money to a Roth would not leave you more at the end (${money(none.endAfterTaxReal)} after tax)${helpWords ? "." : ": the tax now is about what it would be later."}`, "lede");
    if (helpWords) say(`Even at the lowest rate you would end with less. Before 65, what you convert counts as income, and that costs more of the help with health insurance than it saves in tax (at the ${pct(near.fillRate)} rate, about ${money(near.creditLostReal)} of help lost for ${taxLess >= 1 ? `${money(taxLess)} less tax` : `${money(Math.max(0, -taxLess))} more tax`}).`);
    if (d.span) say("Worth another look if your income in retirement turns out lower than planned.", "muted small");
  }
  // the plan's own setting, well behind the best: said in two short lines, with the switch as the filled button
  if (bb) {
    const bestShort = best.fillRate ? `the ${pct(best.fillRate)} rate` : "none";
    say(bb.fails
      ? `Your plan converts at the ${pct(bb.fillRate)} rate, and with it the money runs out in ${bb.failYear}; at ${bestShort} it lasts to the end.`
      : `Your plan converts at the ${pct(bb.fillRate)} rate: that leaves about ${money(bb.byBest)} less than ${bestShort}${bb.byNone !== null ? `, and ${money(bb.byNone)} less than none` : ""}.`);
    if (!bb.fails && bb.creditMore >= bb.byBest / 2) say("Mostly because it gives up more of the help with health insurance before 65.", "small");
  }
  if (bb || offerBest) hero.append(ui.row(ui.button(best.fillRate ? `Move money up to the ${pct(best.fillRate)} tax rate${bb ? " instead" : ""}` : "Turn conversions off", () => useWay(best), small && !bb ? { class: "secondary" } : {})));
  if (d.verdict === "no-years" && nw.reason === "started") hero.append(ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/rmd" }, "This year's required withdrawal")));
  if (d.verdict === "no-years" && d.on) hero.append(ui.row(ui.button("Turn conversions off", () => { pending = "Conversions turned off."; store.update((p) => { p.retirement.rothConversion = { ...(p.retirement.rothConversion ?? {}), on: false }; }); }, { class: "secondary" })));
  root.append(hero);
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  // the projection's own notes, plainly: its "on this page" is Will the money last? here (the page's own name, not "the Projection
  // page"), its "brackets" the federal rates (round 8 review UX 9; batch 5b UX 18: the spending note says where to change it)
  const noteWords = (n) => n.replace("The plan assumes you will spend in retirement what you spend today; set your own figure on this page if it will differ.", "Retirement spending is set to what you spend today; change it under Retirement settings on Will the money last?")
    .replace(/ on this page\b/, " on Will the money last?").replace(/the federal brackets/g, "the federal tax rates");
  if (canConvert) for (const n of d.notes) root.append(ui.notice("info", noteWords(n)));

  // ---- the ways: one line each, its figure against not converting, one button ---------------------------------------------------
  // each way as a difference from not converting (UX review 11: totals here and on Will the money last? were different figures);
  // a rate that leaves less than not converting has no button and is folded away (UX review 10: three costly "Use this one")
  const diffOf = (o) => (o.fillRate === null ? "" : !o.success ? `runs out ${o.failYear}` : Math.abs(o.endAfterTaxReal - none.endAfterTaxReal) < 0.5 ? "the same" : o.endAfterTaxReal > none.endAfterTaxReal ? `${money(o.endAfterTaxReal - none.endAfterTaxReal)} more` : `${money(none.endAfterTaxReal - o.endAfterTaxReal)} less`);
  const worse = (o) => o.fillRate !== null && !o.chosen && !o.best && (!o.success || o.endAfterTaxReal < none.endAfterTaxReal - 0.5);
  const record = (o, button) => ui.h("li", {},
    // green only means good: the plan's setting well behind the best is amber (round 8 review UX 3)
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, wayName(o), o.best ? ui.h("span", { class: "pill accent" }, "best") : null, o.chosen ? ui.h("span", { class: o === behind ? "pill warn" : o.best ? "pill ok" : "pill" }, "yours") : null), ui.h("span", { class: "rec-value" }, diffOf(o))),
    ui.h("div", { class: "rec-sub" }, `${o.fillRate ? (o.totalConvertedReal >= 1 ? `Moves about ${money(o.totalConvertedReal)} in all.` : "Moves nothing: your other income already uses up the room under that rate.") : "Leaves it where it is; you pay tax as you take it out."}${o.creditLostReal >= 1 ? ` ${money(o.creditLostReal)} less help with health insurance before 65 than with no conversions.` : ""}`),
    // the best one's button is the filled one above
    !button || !o.offer || (o.best && (bb || offerBest)) ? null : ui.h("div", { class: "rec-foot" }, ui.button(o.fillRate ? "Use this one" : "Turn conversions off", () => useWay(o), { class: "secondary" })));
  const keep = d.options.filter((o) => !worse(o)), rest = d.options.filter(worse);
  const medicareYears = canConvert ? d.table.filter((r) => r.irmaa).map((r) => r.year) : [];
  const shownRate = `the ${pct(d.shown)} rate`;
  const medicareLine = IRMAA_FIRST_TIER[d.filingStatus] ?? IRMAA_FIRST_TIER.single;
  if (canConvert) root.append(ui.card("How much to convert",
    // what "the 22% rate" means, in one sentence (follow-up 2026-11-07: "fill up to the top of the 22% rate" was never explained)
    ui.h("p", { class: "small" }, "A Roth conversion moves money from your regular retirement account into a Roth account. You pay tax on it now, and later withdrawals are tax-free."),
    ui.h("p", { class: "small" }, "Each rate is a ceiling: each year the plan converts only as much as stays taxed at that rate or lower. At the 22% rate, none of it reaches 24%."),
    ui.h("p", { class: "muted small" }, "What each rate leaves at the end, after tax, against not converting, in today's dollars."),
    market ? ui.h("p", { class: "small" }, `Before 65, what you convert counts as income for the help with health insurance, which stops once income passes ${line ? `about ${money(line)} a year` : "a set line"}.`) : null,
    // Medicare's extra charge, in one sentence with the figure (follow-up 2026-11-07): the official name is under "How this is worked out"
    medicareYears.length ? ui.h("p", { class: "small" }, `Medicare also charges extra on its monthly premiums, from 65, when your income two years earlier passes about ${money(medicareLine)} (in today's dollars).`) : null,
    medicareYears.length ? ui.h("p", { class: "small" }, `Converting at ${shownRate} in ${years(medicareYears)} would pass it. The figures below count that charge.`) : null,
    ui.h("ul", { class: "records" }, keep.map((o) => record(o, true))),
    // its title is pinned by two tests and names the group it holds, so it is an item, not "N more ways"
    rest.length ? part(ctx, { id: "other", kind: "item", title: `Other choices: each ends with less than not converting (${rest.length})`,
      body: ui.h("ul", { class: "records" }, rest.map((o) => record(o, false))) }) : null,
  ));

  // ---- How this is worked out --------------------------------------------------------------------------------------------------------
  const shownName = `the ${pct(d.shown)} rate`;
  const heirs = ["Pre-tax money you leave is taxed when your heirs take it out.", "Most heirs other than a husband or wife must empty an inherited IRA within 10 years, often in their own working years.", "A Roth they inherit comes out tax-free once it has been open five years."];
  const why = nw?.reason === "started" ? [`This page only works out conversions before ${d.rmdStartAge}, the age required withdrawals start, and ${nameIn(who)} ${verbFor(who, "is", "are")} ${nw.age}.`, "After that, take each year's required amount first (it cannot be converted); anything more moved to a Roth is taxed that year and never again."]
    : nw?.reason === "owner-younger" ? [`This page works out conversions by ${nameOf(who)} age only, and ${nameIn(who)} ${verbFor(who, "is", "are")} ${nw.age}, past the age required withdrawals start.`] : [];
  const showTable = canConvert && d.table.length;
  root.append(part(ctx, { id: "how", kind: "how", card: true, body: [
    ui.h("p", { class: "small" }, "A conversion moves money from a 401(k) or traditional IRA into a Roth. It is taxed as income that year, and never again."),
    ...why.map((t) => ui.h("p", { class: "small" }, t)),
    ...(d.verdict === "no-years" && nw.reason !== "until" ? heirs.map((t) => ui.h("p", { class: "small" }, t)) : []),
    canConvert ? ui.h("p", { class: "small" }, `The years tried run from retirement to ${d.rmdStartAge}, when required withdrawals start. The tax is paid from cash and savings, so the total dips before it gains.`) : null,
    canConvert ? ui.h("p", { class: "small" }, `What is left at the end counts the tax still owed on pre-tax money. With no conversions it is ${money(none.endAfterTaxReal)}.`) : null,
    canConvert ? ui.h("p", { class: "small" }, `Will the money last? counts 401(k) and IRA money at its full value before tax, so its "left at the end" is a different figure.`) : null,
    canConvert && flatNow ? ui.h("p", { class: "small" }, `It also uses a flat ${flatPct} until conversions are on.`) : null,
    canConvert ? ui.h("p", { class: "small" }, "Each way's tax over the plan, and its required withdrawals:") : null,
    canConvert ? ui.h("ul", { class: "records" }, d.options.map((o) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, wayName(o))),
      ui.h("div", { class: "rec-sub" }, `Tax over the plan ${money(o.taxesReal)}; required withdrawals ${money(o.rmdReal)}${o.cliffYears.length ? `; income passes the health insurance line in ${years(o.cliffYears)}` : ""}.`)))) : null,
    // "Income before" is a column of the wide table only; on a phone each row says it in words (RB4)
    showTable ? ui.h("p", { class: "small" }, `Year by year, ${d.on ? "your plan's setting" : "the best way"}: ${shownName}. Amounts in each year's dollars.`, ui.h("span", { class: "only-wide" }, " Income before is what the plan already has that year.")) : null,
    showTable ? ui.h("div", { class: "only-wide" }, ui.table([
      { key: "year", label: "Year" }, { key: "ages", label: d.people.length > 1 ? "Ages" : "Age", render: (r) => r.ages.join(" / ") },
      { key: "incomeBefore", label: "Income before", align: "right", render: (r) => money(r.incomeBefore) },
      { key: "conversion", label: "Convert", align: "right", render: (r) => money(r.conversion) },
      { key: "taxes", label: "Tax that year", align: "right", render: (r) => money(r.taxes) },
      { key: "bracketRate", label: "Taxed at up to", align: "right", render: (r) => (r.bracketRate !== null ? fmt.pct(r.bracketRate, 0) : "-") },
      { key: "irmaa", label: "Medicare", render: (r) => (r.irmaa ? "extra charge" : "") },
    ], d.table)) : null,
    showTable ? ui.h("ul", { class: "records only-narrow" }, d.table.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${r.year} · ${d.people.length > 1 ? "ages" : "age"} ${r.ages.join(" / ")}`), ui.h("span", { class: "rec-value" }, `${money(r.conversion)} to convert`)),
      ui.h("div", { class: "rec-sub" }, `${r.incomeBefore >= 1 ? `${money(r.incomeBefore)} of other taxed income` : "no other taxed income"} · ${r.taxes >= 0.5 ? `${money(r.taxes)} of tax that year` : "no tax that year"}${r.irmaa ? " · trips Medicare's extra charge" : ""}`)))) : null,
    showTable ? ui.h("p", { class: "small" }, "Gains and dividends from an investment account are taxed on top of your other income: they do not use up a rate, but a conversion can push some of them from the 0% rate to 15%.") : null,
    showTable && d.table.some((r) => r.irmaa) ? ui.h("p", { class: "small" }, "Medicare's extra charge: from 65, premiums rise if income two years earlier passed about $109,000 ($218,000 for a couple, 2026).") : null,
    showTable && d.table.some((r) => r.irmaa) ? ui.h("p", { class: "small" }, "Converting from 63 on can trip it; the years before are clear.") : null,
    canConvert && market ? ui.h("p", { class: "small" }, "The help with health insurance before 65 is worked out from each year's income, conversions included. Every figure here counts it.") : null,
    canConvert && !market ? ui.h("p", { class: "small" }, "Before 65, a conversion counts as income for the help with marketplace health insurance.") : null,
    canConvert && !market ? ui.h("p", { class: "small" }, "That help stops at a set income: check the year's income before converting.") : null,
    ui.h("p", { class: "small" }, "Pay the tax from cash or savings, not from the conversion itself: that is worse and, before 59½, has a penalty."),
    ui.h("p", { class: "small" }, "Five years: under 59½, each conversion must sit in the Roth five years before it comes out without a penalty."),
    ui.h("p", { class: "muted small" }, "Official names: tax brackets (the rates), the premium tax credit (the help with health insurance), IRMAA (income-related monthly adjustment amount: Medicare's extra charge)."),
    ui.h("p", { class: "muted small" }, "Rules from IRS Publications 590-A and 590-B."),
  ] }));

  // ---- settings, last -----------------------------------------------------------------------------------------------------------------
  // with no years to convert in, the settings would compare five identical runs: only when the stop age is what closed the window
  if (!canConvert && !(d.noWindow?.reason === "until")) return;
  const untilSel = ui.select([{ value: "", label: `until required withdrawals begin (${d.rmdStartAge})` }, ...[60, 62, 63, 65, 67, 70, 72].map((a) => ({ value: String(a), label: `until age ${a}` }))], d.untilAge ? String(d.untilAge) : "", { "aria-label": "Convert until", onChange: (e) => { pending = "Saved."; openAfter = "settings"; store.update((p) => { p.retirement.rothConversion = { ...(p.retirement.rothConversion ?? {}), untilAge: e.target.value ? Number(e.target.value) : null }; }); } });
  // a pick from a list, no figure to type, so not "Set my own numbers": an item named for what it sets; the one just saved in
  // stays open on the redraw (R17)
  root.append(part(ctx, { id: "settings", kind: "item", card: true, title: "Conversion settings", says: d.on ? `on, at the ${pct(d.fillRate)} rate` : "off", open: justSaved || undefined,
    body: ui.h("div", { class: "form" }, ui.field("Convert each year", untilSel, "stop early to keep the years from 63 clear of Medicare's extra charge for higher incomes")) }));
}
