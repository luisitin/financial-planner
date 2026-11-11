// modules/retirement/social-security/view.js -- DOM only. Per adult: paste the ssa.gov earnings
// record (or type the statement's figure), pick a claiming age, see the monthly benefit at
// each age. Saved with a green line; the projection picks it up.
import { compute, readRecord, saveFigures, survivorWords, spousalWords, heroTopUpWords } from "./compute.js";
import { ssMissingFor, possessive } from "../../overview/setup/compute.js";
import { nameIn, NameIn, nameOf, NameOf, verbFor } from "../../../core/words.js";

let pending = null;
// about twice the largest monthly Social Security payment (someone with the maximum taxed pay every year, claiming at 70: ssa.gov
// "Workers with maximum-taxable earnings"); a figure over it is a slip of extra digits, not a benefit (README)
const SS_MONTHLY_CEILING = 10000;
/** 2055 / 2055 and 2056 / 2055, 2056 and 2057 */
const listYears = (ys) => (ys.length < 2 ? String(ys[0]) : `${ys.slice(0, -1).join(", ")} and ${ys.at(-1)}`);
let openFor = null;   // the person whose fold stays open after a save

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  // a couple: what is left after the first death, the question a widow(er) faces (F-033). The larger benefit stays and
  // the smaller one stops; both figures in today's dollars, the survivor at full retirement age or later
  const withFigure = d.people.filter((p) => p.source !== "none");
  const partnerOf = (p) => d.people.find((x) => x.id !== p.id && x.birthYear) ?? null;
  const left = d.couple && withFigure.length === 2 ? d.people.map((p) => d.couple.survivorMonthly[p.id]).filter((x) => x > 0) : [];
  const lo = left.length ? Math.min(...left) : 0, hi = left.length ? Math.max(...left) : 0;
  const together = left.length === 2 && d.couple.bothMonthly > hi + 0.5
    ? `If one of you dies, the one left keeps about ${hi - lo < 1 ? fmt.money(hi, cur) : `${fmt.money(lo, cur)} to ${fmt.money(hi, cur)}`} a month of the ${fmt.money(d.couple.bothMonthly, cur)} you get together: the larger benefit stays, the smaller one stops.` : "";
  // the yearly figure and "you get together" are the same money, a spouse's top-up in both; the hero says so (recheck 2026-11-05)
  const topUpWords = d.hasData ? heroTopUpWords(d, (n) => fmt.money(n, cur)) : "";
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasData ? `${fmt.money(d.householdYearly, cur)} a year from Social Security` : "Social Security"),
    ui.h("p", { class: "lede" }, d.hasData ? `In today's dollars, at the claiming ages chosen below. The projection counts it from those ages, rising with inflation.${topUpWords ? ` ${topUpWords}` : ""}${together ? ` ${together}` : ""}` : "Your benefit depends on your best 35 years of earnings and the age you claim. Paste the earnings table from your ssa.gov account, or type the monthly figure your Social Security statement shows at full retirement age."),
    ui.h("p", { class: "muted small" }, "ssa.gov > my Social Security > Earnings Record: copy the year and earnings columns and paste them below. Nothing is sent anywhere; this device does the math with the Social Security Administration's own formula."),
  ));
  root.append(out);
  // the way on is a 44 px button, not a word inside a sentence (stress test 2026-11-11, R-A9)
  if (!d.people.length) { root.append(ui.card(null, ui.h("p", {}, "First add the adults in your home, with their birth dates."), ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "Add the people in your home ›")))); return; }

  const missing = new Set(ssMissingFor(plan).map((m) => m.id));   // no figure, no record, not on Income, not "won't get it"
  // One fold per person; the first opens by default, the one just saved stays open
  // (design log 2026-09-16, pass 4).
  d.people.forEach((p, idx) => {
    const s = plan.retirement?.socialSecurity?.[p.id] ?? {};
    // in a sentence the unnamed first adult ("Me") is "you" (review 2026-11-06, round 7); the fold's title keeps the name
    const who = nameIn(p.name), Who = NameIn(p.name), whose = nameOf(p.name), gets = verbFor(p.name, "gets", "get");
    // "won't get it" (the setup's own "none", the answer the retirement pages' notice saves): said here too, where Plan
    // health score and Timeline send the person (review 2026-11-02: the page they were sent to had no such answer)
    const none = p.source === "none" && plan.guide?.setup?.ss?.[p.id] === "none";
    // an age in years and months, for a claim age that is not whole ("69 and 5 months")
    const ageWords = (a) => { const y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); return m ? `${y} and ${m} month${m === 1 ? "" : "s"}` : String(y); };
    const paidMonthly = p.paidLine ? (p.paidLine.period === "monthly" ? p.paidLine.amount : null) : null;
    // 70 or over and not claimed: at 70 (compute's default from 70 on) that is what claiming now pays
    const old70 = !p.claimed && p.ageNow !== null && p.ageNow >= 70;
    const status = p.claimed && p.source !== "none" ? `${fmt.money(p.monthly, cur)} a month ${p.startedEarly ? "now" : `since ${ageWords(p.claimAge)}`}` : p.claimed && paidMonthly ? `${fmt.money(paidMonthly, cur)} a month now` : p.source === "record" || p.source === "typed" ? `${fmt.money(p.monthly, cur)} a month ${old70 && p.claimAge >= 70 ? "if claimed now" : `at ${ageWords(p.claimAge)}`}` : p.claimed ? "already getting it" : none ? "won't get it" : "nothing yet";
    const setNone = (on) => {
      pending = on ? `Saved: no Social Security for ${who}. The retirement pages plan without it.` : `${NameOf(p.name)} Social Security is open again: add a figure below.`; openFor = p.id;
      store.update((pl) => { pl.guide = pl.guide ?? {}; pl.guide.setup = pl.guide.setup ?? {}; pl.guide.setup.ss = pl.guide.setup.ss ?? {}; if (on) pl.guide.setup.ss[p.id] = "none"; else delete pl.guide.setup.ss[p.id]; });
    };
    // the ages still possible: past 62 and not yet claimed, from today's age to 70 (compute's options); a claimed age stays as it is
    const ages = p.claimed ? [p.claimAge] : p.ageNow !== null && p.ageNow > 62 ? p.options.map((o) => o.claimAge) : [62, 63, 64, 65, 66, 67, 68, 69, 70];
    const nearest = ages.reduce((a, b) => (Math.abs(b - p.claimAge) < Math.abs(a - p.claimAge) ? b : a), ages[0]);
    const claimSel = ui.select(ages.map((a, i) => ({ value: String(a), label: !p.claimed && p.ageNow > 62 && i === 0 && !Number.isInteger(a) ? `now (${ageWords(a)})` : a === (p.fra?.years ?? 67) && !(p.fra?.months) ? `${a} (full retirement age)` : ageWords(a) })), String(nearest), { "aria-label": "Claiming age" });
    const recordBox = ui.h("textarea", { rows: 5, placeholder: "2024\t$69,000\n2023\t$66,500\n...", "aria-label": "Earnings record" }, (p.record ?? []).map((r) => `${r.year}\t${r.earnings}`).join("\n"));
    const typedIn = ui.input({ type: "number", value: p.claimed && p.source !== "none" ? Math.round(p.monthly * 100) / 100 : p.monthlyAtFRA ?? "", min: 0, step: "10", inputmode: "decimal", placeholder: "e.g. 2800", "aria-label": p.claimed ? `What ${who} ${gets} a month now` : "Monthly benefit at full retirement age" });
    const futureSel = ui.select([{ value: "same", label: "keep earning about the same until I retire" }, { value: "none", label: "no more earnings from now" }], p.futureEarnings, { "aria-label": "Future earnings" });
    const saidHere = ui.h("div");   // a word under the Save button when there was nothing to save
    const save = () => {
      // what to store is decided in compute.js (saveFigures, tested there): for someone already paid, an unchanged amount
      // changes nothing and the claim age on file stays; a different amount goes on the Income line that pays it when it
      // started before the claim age on file, or becomes the full-age amount (setting an earnings record aside) when not
      // (review 2026-11-02, round 5: Save with nothing changed turned an early claim into one made today)
      const own = `setup-ss-${p.id}`;
      // a refusal stays under the button until the next Save (stress test 2026-11-11, R-A3): what could not be read, and how to fix it
      // (no focus on the box: on a phone that opens the keyboard over the sentence; a screen reader hears it instead)
      const refuse = (box, text) => { box.setAttribute("aria-invalid", "true"); saidHere.replaceChildren(ui.notice("error", text)); ctx.announce?.(text); };
      recordBox.removeAttribute("aria-invalid"); typedIn.removeAttribute("aria-invalid");
      const read = readRecord(recordBox.value, { thisYear: Number(String(fmt.today()).slice(0, 4)) });
      // a space or a dot between the thousands ("69 000", "69.000") is not read (review round 1 N1): said how to write it
      const grouped = read.unread.some((l) => /\d[ .\u00a0'\u2019]\d{3}(?!\d)|\d\s+,\s*\d/.test(l));
      if (!read.empty && !read.read) return refuse(recordBox, read.later.length
        ? `${listYears(read.later)} ${read.later.length === 1 ? "has" : "have"} not happened yet, so there is nothing to save from the earnings record. Paste the years up to this one, one on each line, like 2024 69,000.`
        : `I could not find a year and an amount in what you pasted.${grouped ? " Write the thousands with a comma, not a space, a dot or an apostrophe." : ""} Put one year on each line, like 2024 69,000, and tap Save again.`);
      // a number box that holds what is not a number ("2,650" on a computer keyboard) reads as empty: refused, never "Removed"
      if (typedIn.validity?.badInput) return refuse(typedIn, "Type the monthly amount in numbers only, with no comma, like 2650.");
      const typedRaw = String(typedIn.value).trim();
      const typedNum = typedRaw === "" ? null : Number(typedRaw);
      if (typedRaw !== "" && !(Number.isFinite(typedNum) && typedNum >= 0)) return refuse(typedIn, "Type the monthly amount as a number of dollars, like 2,650. Leave it empty if there is none.");
      // a slip of extra digits (R-A10): nobody is paid this much a month by Social Security
      if (typedNum !== null && typedNum > SS_MONTHLY_CEILING) return refuse(typedIn, `${fmt.money(typedNum, cur)} a month is more than Social Security pays anyone. Check the figure on the statement (it is a monthly amount, usually between $1,000 and $4,000) and tap Save again.`);
      const r = saveFigures(p, s, { claimAge: Number(claimSel.value), record: read.record, typed: typedNum || null, futureEarnings: futureSel.value });
      openFor = p.id;
      // what was pasted but not used, said with the result (never dropped without a word)
      const notUsed = [
        read.unread.length ? `I could not read ${read.unread.length === 1 ? "1 line" : `${read.unread.length} lines`}: "${read.unread[0].replace(/\s+/g, " ").slice(0, 40)}"${read.unread.length > 1 ? " and more" : ""}. ${grouped ? "Write the thousands with a comma, like 69,000, and paste again." : `Check ${read.unread.length === 1 ? "it" : "them"} and paste again.`}` : "",
        read.later.length ? `${listYears(read.later)} ${read.later.length === 1 ? "was" : "were"} left out: ${read.later.length === 1 ? "it has" : "they have"} not happened yet.` : "",
      ].filter(Boolean).join(" ");
      // nothing changed: nothing is written, so the page does not redraw; the word goes under the button that was tapped
      if (!r.changed) { const n = ui.notice(notUsed ? "warn" : "ok", `Nothing to save: these are the figures already in the plan for ${who}.${notUsed ? ` ${notUsed}` : ""}`); saidHere.replaceChildren(n); if (!notUsed) setTimeout(() => n.remove(), 4000); return; }
      const amount = fmt.money(Number(typedIn.value) || 0, cur);
      // a corrected amount says where it went, and a record set aside says so and how to bring it back
      const onIncome = r.addLine !== null ? `, added to the Income page as "${possessive(p)} Social Security"` : r.line ? ", on the Income page too" : "";
      pending = r.recordRemoved || r.recordPasted || r.line || r.addLine !== null
        ? `Saved: ${who} ${gets} ${amount} a month${onIncome}.${r.recordRemoved ? ` The earnings record was removed, so this amount is the one the plan counts. To use the record again, paste it back under "Earnings record from ssa.gov" and tap Save.`
          : r.recordPasted ? ` The earnings record you pasted was not kept, so this amount is the one the plan counts. To use the record instead, paste it again, leave the amount as it is, and tap Save.` : ""}`
        : r.removed ? `Removed: the plan now counts no Social Security for ${who}. To put it back, paste the earnings record or type the monthly figure and tap Save.`
        : read.read ? `${NameOf(p.name)} Social Security saved, from ${read.read} ${read.read === 1 ? "year" : "years"} of earnings.`
        : `${NameOf(p.name)} Social Security saved.`;
      if (notUsed) pending = `${pending} ${notUsed}`;
      store.update((pl) => {
        pl.retirement.socialSecurity = pl.retirement.socialSecurity ?? {}; pl.retirement.socialSecurity[p.id] = r.entry;
        // a figure replaces an earlier "won't get it"
        if (((r.entry.record ?? []).length || Number(r.entry.monthlyAtFRA) > 0) && pl.guide?.setup?.ss?.[p.id] === "none") delete pl.guide.setup.ss[p.id];
        // the Income line that pays it follows the corrected amount
        const line = r.line ? (pl.income ?? []).find((x) => x.id === r.line.id) : null;
        if (line) { line.amount = r.line.amount; line.period = "monthly"; }
        // paid now with no Income line: setup's own one, as setup's "I already get it" writes it
        if (r.addLine !== null) {
          pl.income = pl.income ?? [];
          const mine = pl.income.find((x) => x.id === own);
          if (mine) Object.assign(mine, { amount: r.addLine, period: "monthly", startDate: "", endDate: "" });
          else pl.income.push({ id: own, name: `${possessive(p)} Social Security`, type: "social", personId: p.id, amount: r.addLine, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true });
        }
      });
    };
    const est = p.estimate;
    root.append(ui.h("details", { class: "card fold fold-card", open: (openFor ? openFor === p.id : idx === 0) ? true : null },
      ui.h("summary", {}, ui.h("h2", {}, `${p.name}${p.age !== null ? `, ${p.age}` : ""}`), ui.h("span", { class: "fold-status" }, status), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" },
      ...(() => {
        // one form, so the keyboard's Go (Enter in a box) saves like the button (R-A3); a line break in the record box stays a line break
        const submit = ui.h("button", { type: "submit" }, `Save ${whose} Social Security`);
        const form = [
          ui.h("form", { class: "form", noValidate: true, onSubmit: (e) => { e.preventDefault(); save(); } },
            p.claimed || old70 ? null : ui.field("Claim at age", claimSel, p.ageNow !== null && p.ageNow > 62 ? `From now to 70; each year of waiting adds about 8%` : "62 is the earliest, 70 the latest; each year of waiting adds about 6-8%"),
            ui.field("Earnings record from ssa.gov", recordBox, "one year per line: year and earnings"),
            ui.field(p.claimed ? `What ${who} ${gets} a month now` : "If you have no record: monthly benefit at full retirement age", typedIn, p.claimed ? "before Medicare is taken out, as on the yearly benefit letter" : "the figure on your Social Security statement"),
            p.claimed || (p.ageNow !== null && p.ageNow >= 70) ? null : ui.field("Future earnings", futureSel),
            ui.row(submit,
              none ? ui.button(`Undo: ${who} may get it`, () => setNone(false), { class: "secondary" }) : missing.has(p.id) ? ui.button(`${Who} won't get Social Security`, () => setNone(true), { class: "secondary" }) : null),
            saidHere),
        ];
        // a couple: what this person keeps if the other dies first, and any top-up on the other's record (F-033)
        const partner = partnerOf(p);
        const keeps = d.couple && partner && partner.source !== "none" ? d.couple.survivorMonthly[p.id] : null;
        // a spouse's top-up: counted (and from when), already in the Income line, or what could come (recheck 2026-11-05)
        const topUp = d.couple && partner ? spousalWords(p, partner, d, (n) => fmt.money(n, cur), { none }) : "";
        const couplePart = keeps === null ? [] : [
          ui.h("p", {}, survivorWords(p, partner, keeps, (n) => fmt.money(n, cur))),
          topUp ? ui.h("p", {}, topUp) : null,
        ];
        // already getting it: a fact, not a choice of claiming ages (round 4, 2026-11-02); the figures fold away for corrections
        if (p.claimed) return [
          ui.h("p", {}, p.source !== "none" ? `${Who} ${gets} about ${fmt.money(p.monthly, cur)} a month${p.claimedYear ? `, since ${p.claimedYear} (at ${ageWords(p.claimAge)})` : ""}. Nothing to decide here: the plan counts it, rising with the cost of living.`
            : p.paidLine ? `${Who} ${gets} about ${fmt.money(p.paidLine.amount, cur)} ${p.paidLine.period === "monthly" ? "a month" : "each time"} (${p.paidLine.name || "on the Income page"}). Nothing to decide here: the plan counts it.`
            : `${Who} already ${gets} Social Security. Add the amount below, or on the Income page, so the plan counts it.`),
          ...couplePart,
          ui.h("details", { class: "fold" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Correct these figures"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")), ...form),
        ];
        const w = p.wait;
        if (old70 && p.options.length && p.source !== "none") return [
          ui.h("p", {}, `${Who} can claim now: about ${fmt.money(p.options[0].monthly, cur)} a month. Waiting adds nothing after 70.`),
          // a saved claim age gone by: said here too, with the two ways to settle it (review 2026-11-02, round 5: the warning was
          // hidden here, so the page showed the amount at 66 and "can claim now" side by side with no word why)
          p.pastClaimAge ? ui.notice("warn", ui.h("span", {}, `The plan has ${who} claiming at ${ageWords(p.claimAge)}, which has passed, so it counts ${fmt.money(p.monthly, cur)} a month. Tap Save below to plan on claiming now instead, or if ${who} already ${gets} it, add what arrives each month on the `, ui.h("a", { href: "#/cashflow/income" }, "Income page"), ".")) : null,
          ...couplePart,
          ...form,
        ];
        return [
          ui.h("p", { class: "muted small" }, `Full retirement age ${p.fra ? `${p.fra.years}${p.fra.months ? ` and ${p.fra.months} months` : ""}` : "unknown"}. Now: ${status}.`),
          // past 62, not yet claimed: the question that is left, answered (claim now or at 70)
          w ? ui.h("p", { class: "si-say" }, `Claim now (${ageWords(w.nowAge)}): about ${fmt.money(w.nowMonthly, cur)} a month. Wait until 70 (${new Date(`${w.at70}-15T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}): about ${fmt.money(w.at70Monthly, cur)} a month. Waiting pays back if ${who} ${verbFor(p.name, "lives", "live")} past about ${Math.round(w.breakEven)}.`) : null,
          p.pastClaimAge ? ui.notice("warn", `The plan has ${who} claiming at ${ageWords(p.claimAge)}, which has passed. Pick an age from now to 70, or say ${who} already ${gets} it on the Income page.`) : null,
          p.options.length && (p.source !== "none") ? ui.h("ul", { class: "records" }, p.options.map((o) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Claim at ${ageWords(o.claimAge)}${Math.abs(o.claimAge - p.claimAge) < 0.01 ? " (chosen)" : ""}`), ui.h("span", { class: "rec-value" }, `${fmt.money(o.monthly, cur)} a month`)), ui.h("div", { class: "rec-sub" }, `${Math.round(o.factor * 100)}% of the full-age amount`)))) : null,
          ...couplePart,
          est ? ui.h("p", { class: "muted small" }, `From the record: ${est.yearsInRecord} years${est.projectedYears ? ` (${est.projectedYears} assumed)` : ""}, ${est.credits} of 40 credits${est.eligible ? "" : ": not yet eligible"}; average indexed monthly earnings ${fmt.money(est.aime, cur)}; full-age benefit ${fmt.money(est.pia, cur)} a month.`) : null,
          ...form,
        ];
      })(),
    )));
  });
  root.append(ui.h("p", { class: "muted small" }, `How it is worked out: your past earnings are raised in line with wage growth up to the year you turn 60; your best 35 years are averaged; that average goes through the benefit formula for the year you turn 62; cost-of-living raises are added from 62; and the result goes down or up with the age you claim.${d.couple ? " A survivor's amount is for a widow or widower at full retirement age or later (less before); when the one who died claimed early, it is still at least 82.5% of their full-age amount." : ""} Tables from the Social Security Administration via ssa.tools.`));
}
