// modules/retirement/rmd/view.js -- DOM only. The answer first: what the law makes you take out this year, from which account,
// by when, and what you can spend with it; then what to do (one line, one button), the years ahead in a sentence, and every
// IRS figure, the year-by-year list and the table under "How this is worked out" (round 8, Batch 5b: the owner, 2026-11-06,
// "Just make sure a layman can easily understand and use the page").
import { compute, thisYear, thisYearTax, markTaken } from "./compute.js";
import { firstYear } from "../withdrawal-strategy/compute.js";
import { compute as estimated } from "../../taxes/estimated/compute.js";
import { whenCareful, monthlyOf, accountName, slot, chanceWords, BAD_RUN, BAD_RUN_NOTE } from "../careful.js";
import { rmdFactor, RMD_ACCOUNT_TYPES } from "../../../core/math/rmd.js";
// "you" and "your" for the first adult Get started left unnamed ("Me"), with the verb to match (round 7); thisYear names
// someone with no name "You", which reads the same
import { isYou, nameIn, NameIn, nameOf, NameOf, verbFor } from "../../../core/words.js";
// the states with no income tax (taxes/state's own list): there the hold-back is the federal tax only (round 8 review D5)
import { NO_WAGE_TAX } from "../../taxes/state/compute.js";
// the Roth sentence and the source line under the "none on file" answer (path part 3); with an account on file, "How this is
// worked out" (batch 5b) says both in its own lines
const ROTH_SOURCE = "Rules from IRS Publication 590-B and the SECURE 2.0 Act. Roth accounts (money you already paid tax on) have no required withdrawals while you are alive.";
const unnamed = (n) => (n === "You" ? "" : n);
/** "a", "a and b", "a, b and c" */
const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;

export function render(root, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const today = fmt.today();
  const d = compute(plan, { today });
  const money = (n) => fmt.money(n, cur);
  const long = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  // this year's withdrawal first: the one deadline here with a penalty (IRS, Retirement topics: RMDs, reviewed 2026-04-08)
  const ty = thisYear(plan, { today });
  const year = ty.year ?? Number(String(today).slice(0, 4));
  const by = (iso) => (iso === `${year}-12-31` ? "December 31" : long(iso));
  // what each withdrawal adds to this year's federal tax, at the brackets (round 8, widow-2); null while the first adult still works
  const tt = ty.people.length ? thisYearTax(plan, { today, thisYear: ty }) : null;
  const addsOf = (r) => (tt && tt.byPerson[r.id] >= 0.5 ? tt.byPerson[r.id] : null);
  // filing separately each withdrawal is on its owner's own return (round 8 review D1); jointly it is the household's
  const whoseTax = (r) => (tt?.separate && ty.people.length > 1 ? nameOf(unnamed(r.name)) : "your");
  const stateToo = NO_WAGE_TAX[String(plan.household?.state ?? "").toUpperCase()] ? "" : " Your state may tax it too.";
  const from = (r) => list(r.accounts.map((a) => accountName(a.name)));
  const withAmt = ty.people.filter((x) => x.amount >= 1);
  const due = ty.due;
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const endAge = Math.max(...adults.map((p) => Number(p.lifeExpectancy ?? plan.assumptions?.planEndAge ?? 95)), 0) || Number(plan.assumptions?.planEndAge ?? 95);
  // Estimated payments' hold-back (taxes/estimated holdBack): what to have held back from a withdrawal, which counts as paid evenly
  // through the year (IRC 6654(g)); null when it does not apply (nothing still to come, or no tax short)
  let est = null;
  try { est = withAmt.length ? estimated(plan, { today }) : null; } catch { est = null; }
  const estLink = ui.h("a", { href: "#/taxes/estimated" }, "Estimated payments");
  const hero = ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Required withdrawals"));
  root.append(hero);
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);

  // ---- nobody to work it out for, or nothing pre-tax --------------------------------------------------------------------------
  if (!d.people.length) {
    hero.append(ui.h("p", { class: "lede" }, "From 73 or 75, depending on the year you were born, the law makes you take some money out of accounts you haven't paid tax on yet (like a 401(k) or a traditional IRA) each year."));
    root.append(ui.notice("warn", ui.h("span", {}, "Add the adults with their birth dates on the ", ui.h("a", { href: "#/household/people" }, "People page"), ", and this page says when and how much.")));
    return;
  }
  if (!d.hasDeferred) { hero.append(ui.h("p", { class: "lede" }, "The law requires no withdrawals: there is no 401(k) or traditional IRA on file."), ui.h("p", {}, "If you have one, add it on ", ui.h("a", { href: "#/balance/net-worth" }, "Net worth"), "."), ui.h("p", { class: "muted small" }, ROTH_SOURCE)); return; }

  // ---- the answer: what to take, from where, by when, and what you can spend --------------------------------------------------
  if (due.length) {
    const same = due.every((r) => r.deadline === due[0].deadline);
    const parts = due.map((r) => `${money(r.amount)} from ${from(r)}${same ? "" : ` by ${by(r.deadline)}`}`);
    const lead = due.every((r) => r.first) ? `For ${year}` : "This year";
    hero.append(ui.h("p", { class: "lede" }, `${lead}, take at least ${list(parts)}${same ? ` by ${by(due[0].deadline)}` : ""}: the law requires ${due.length === 1 ? "it" : due.length === 2 ? "both" : "all of them"}.`));
  } else if (withAmt.length) {
    // said once here; the card below gives the date (UX 15: "taken" three times on one screen)
    hero.append(ui.h("p", { class: "lede" }, `Done for ${year}.`));
  } else if (ty.people.length) {
    hero.append(ui.h("p", { class: "lede" }, "Nothing is required this year: the balance is too small to need a withdrawal."));
  } else {
    // not started: whose accounts, from when, and how big the first one looks
    const firstAdult = adults.find((p) => p.role === "self") ?? adults[0];
    const owns = (p, a) => a.ownerId === p.id || (p.id === firstAdult?.id && !adults.some((q) => q.id === a.ownerId));
    // with the owner's name, unless the account's own name already has it ("Kim's Old 401(k)", not "Old 401(k)"; UX 16)
    const withOwner = (p, n) => (new RegExp(`\\b${String(p.name ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(n) && !isYou(p.name) ? n : `${nameOf(unnamed(p.name))} ${n}`);
    const accountsOf = (p) => (plan.accounts ?? []).filter((a) => RMD_ACCOUNT_TYPES.includes(a.type) && owns(p, a) && Number(a.balance) > 0).map((a) => withOwner(p, accountName(a.name || "Account")));
    const owners = d.people.filter((p) => p.deferredNow > 0).sort((a, b) => a.startYear - b.startYear);
    const firstOne = d.ready && d.schedule.length ? `: about ${money(d.schedule[0].rmdReal)} the first year, in today's dollars, taxed as income` : ", taxed as income";
    const together = owners.length && owners.every((p) => p.startYear === owners[0].startYear && p.startAge === owners[0].startAge);
    const names = owners.map((p) => nameIn(p.name));
    // no owner with a birth date holds the pre-tax money (it is unowned and the first adult has none): say only what is true
    const lede = !owners.length ? "Nothing is required yet."
      : together
      ? `Nothing is required yet. Required withdrawals from ${list(owners.flatMap(accountsOf))} start in ${owners[0].startYear}, when ${owners.length === 1 ? `${names[0]} ${verbFor(owners[0].name, "turns", "turn")}` : "they turn"} ${owners[0].startAge}.`
      : `Nothing is required yet. Required withdrawals start ${list(owners.map((p) => `from ${list(accountsOf(p))} in ${p.startYear}, when ${nameIn(p.name)} ${verbFor(p.name, "turns", "turn")} ${p.startAge}`))}.`;
    hero.append(ui.h("p", { class: "lede" }, lede));
    if (owners.length) hero.append(ui.h("p", {}, `Then the law makes ${list(names)} take a share out each year${firstOne}.`));
  }

  // what this year's income and savings let you spend, even in a bad run of years (Monte Carlo's careful figure, after the first paint)
  const fy = withAmt.length ? firstYear(plan, { today }) : null;
  if (fy && fy.thisYear) {
    const onTop = fy.healthAdded ? " plus health insurance" : "";
    const steady = (plan.retirement?.strategy ?? "fixed-real") === "fixed-real";
    const withIncome = fy.income >= 0.5 ? `With your ${money(fy.income)} of ${list(fy.sources)}, you` : "You";
    const averageWords = `${withIncome} can spend about ${money(Math.round(fy.affordable / 100) * 100)} a year${onTop} if markets do as well as average.`;
    const carefulWords = (mo) => [`${withIncome} can spend about `, mo, ` a month${onTop}${steady ? "" : ", the same every year"}${onTop || !steady ? "," : ""} and the money lasts ${BAD_RUN} ${BAD_RUN_NOTE}.`];
    const underWords = (mo, share) => [`${fy.income >= 0.5 ? `With your ${money(fy.income)} of ${list(fy.sources)}, the` : "The"} money lasts ${BAD_RUN} at up to about `, mo, ` a month${onTop}. At what you plan, it lasts ${chanceWords(share)}.`];
    if (fy.verdict === "short") hero.append(ui.h("p", {}, `At what you plan, the money runs out${fy.shortAge ? ` at ${fy.shortAge}` : ""}. Will the money last? shows what would fix it.`), ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "Will the money last?")));
    else {
      const careLine = ui.h("p", { style: { color: "var(--muted)" } }, ...carefulWords(slot(ui, money(5000))));
      hero.append(careLine);
      whenCareful(ctx, careLine, (c) => {
        careLine.style.color = "";
        if (!c || !(c.yearly > 0)) { careLine.replaceChildren(averageWords); return; }
        careLine.style.minHeight = `${careLine.offsetHeight}px`;
        const mo = money(Math.round(monthlyOf(c.yearly) / 10) * 10);
        careLine.replaceChildren(...(steady && Number.isFinite(c.planned) && c.planned < 0.9 ? underWords(mo, c.planned) : carefulWords(mo)));
      });
    }
    // the year needs more from savings than the law's minimum: the other page says how much, and from where
    if (fy.need >= 0.5 && fy.fromSavings > fy.required + 0.5) hero.append(ui.h("p", { class: "small" }, `This year needs about ${money(fy.fromSavings)} from savings in all, the required amount among it.`), ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/withdrawal-strategy" }, "How much to take out")));
  }

  // ---- what to do: one card per person, one line with its figure, one button ---------------------------------------------------
  const many = withAmt.length > 1;
  for (const r of withAmt) {
    const who = unnamed(r.name);
    if (r.taken) {
      root.append(ui.card(null,
        ui.h("p", { style: { margin: 0 } }, many ? `${NameOf(who)}: marked as taken on ${long(r.taken)}.` : `Marked as taken on ${long(r.taken)}.`),
        // what it adds to the year's tax stays said once it is out (round 8 review UX 11): taken with nothing held back, it is still
        // owed. Batch 1 landed, so Estimated payments counts the withdrawal: where it has a hold-back for a withdrawal still to come, the
        // sentence is a link to it; where it only has payments to make, the date stays and the link follows; else the date alone
        addsOf(r) !== null ? ui.h("p", { class: "small" }, `It adds about ${money(addsOf(r))} to ${whoseTax(r)} ${year} federal tax. `,
          est?.holdBack ? ["If none was held back, ", estLink, " shows how much to have held back from a withdrawal still to come."]
            : [`If none was held back, send that to the IRS by January 15, ${year + 1} (irs.gov/payments).`, ...(est?.needsEstimates ? [" ", estLink, " has the amounts by quarter."] : [])]) : null,
        ui.row(ui.button("Not yet", () => { pending = `${NameOf(who)} ${year} withdrawal is back on the list.`; store.update((p) => markTaken(p, year, r.id, null)); }, { class: "secondary" }))));
      continue;
    }
    const k401 = r.accounts.filter((a) => a.type === "401k").length;
    // the federal figure, said as such (round 8 review D5), and not "if you like" (UX 5)
    const hold = addsOf(r) !== null
      ? `It adds about ${money(addsOf(r))} to ${whoseTax(r)} ${year} federal tax: ask your bank or broker to hold that back when they send it.${stateToo}`
      : tt ? `At ${whoseTax(r)} income it adds no federal tax for ${year}: ask your bank or broker to send it.${stateToo}` : "Ask your bank or broker to send it; they can hold back tax from it too.";
    root.append(ui.h("section", { class: "card" },
      many ? ui.stat(`${NameIn(who)}, ${r.age}`, money(r.amount), `from ${from(r)} by ${by(r.deadline)}`) : null,
      ui.h("p", {}, hold),
      r.first ? ui.h("p", { class: "small" }, `This is ${nameOf(who)} first one: it can wait until April 1, ${year + 1}, but then ${year + 1} has two, both taxed that year. Taking it by December 31 spreads the tax.`) : null,
      r.estimated ? ui.h("p", { class: "muted small" }, `Worked out from today's balance. For the exact figure, type the December 31, ${year - 1} balance from the year-end statement on the account's page.`) : null,
      k401 && r.accounts.length > 1 ? ui.h("p", { class: "small" }, "Each 401(k)'s share comes out of that 401(k). The IRAs' shares can be taken from any one of them.") : null,
      k401 && r.working ? ui.h("p", { class: "small" }, `Still working? A 401(k) at ${nameOf(who)} current job can usually wait until retiring (check the plan's rules); IRAs cannot.`) : null,
      ui.h("p", { class: "muted small" }, "Missing it costs 25% of what was not taken."),
      ui.row(ui.button("I've taken it", () => { pending = `Marked: ${nameOf(who)} ${year} withdrawal is taken.`; store.update((p) => markTaken(p, year, r.id, today)); })),
    ));
  }

  // ---- the years ahead, in a sentence (the Roth line is its own card at the bottom) -------------------------------------------------------------------------
  // started for someone who has pre-tax money (round 8 review D3: a 75-year-old with none read that conversions now come after
  // "this year's required withdrawal" while the IRA was a 66-year-old's, with none due until 2035)
  const started = d.people.some((p) => p.yearsUntil === 0 && p.deferredNow > 0);
  const next = d.schedule.find((r) => r.year === year + 1);
  const biggest = d.schedule.reduce((m, r) => Math.max(m, r.rmdReal), 0);
  if (!d.ready) root.append(ui.notice("info", ui.h("span", {}, "To see how big they get, ", ui.h("a", { href: "#/retirement/projection" }, "Will the money last?"), " needs a few more answers.")));
  else if (d.schedule.length) root.append(ui.card("The years ahead",
    ui.h("p", {}, withAmt.length && next
      ? `Next year's ${many ? "come to" : "is"} about ${money(next.rmdReal)}, in today's dollars. All of them together come to about ${money(d.totalRmdReal)}.`
      : `They grow to about ${money(biggest)} a year and come to about ${money(d.totalRmdReal)} in all, in today's dollars.`),
  ));

  // the Roth line, in its own card above the fold card, which is last as technical sections are (follow-up 2026-11-07: "Roth" is a word a layperson does not know and path part 3 bans it on
  // the first screen, which on this short page reaches the bottom: the card says what a Roth account is instead of its name, and the button says
  // what the page does; the page it opens is titled Roth conversions and explains the word there)
  if (d.ready && d.schedule.length) root.append(ui.card("Making them smaller",
    // once they have started (round 8, widow-3): a conversion is still allowed, after each year's required amount
    ui.h("p", {}, started
      ? "Once this year's is out, you can still move more into an account you pay the tax on this year, then never have to take money out of."
      : "Moving some into an account you pay the tax on now, and never have to take money out of, makes them smaller before they start."),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/roth-conversions" }, "Move some to a tax-free account")),
  ));
  // ---- How this is worked out ------------------------------------------------------------------------------------------------------
  const couple = d.people.length > 1;
  const owned = (r) => (r.owners?.length ? r.owners : [{ name: d.people[0]?.name, age: r.age, factor: r.factor }]);
  const whoAges = (r) => (owned(r).length > 1 ? `${list(owned(r).map((o) => NameIn(o.name)))}, ${list(owned(r).map((o) => String(o.age)))}` : `${couple ? `${NameIn(owned(r)[0].name)}, ` : "age "}${owned(r)[0].age}`);
  const howOf = (r) => (owned(r).length > 1 ? `Each balance divided by the IRS figure for its owner's age (${owned(r).map((o) => `${o.factor} at ${o.age}`).join(", ")})` : `The balance divided by ${owned(r)[0].factor}, the IRS figure at ${owned(r)[0].age}`);
  const workings = withAmt.map((r) => {
    const f = rmdFactor(r.age), lastDec = `December 31, ${year - 1}`;
    const amount = r.accounts.length === 1
      ? `${cap(accountName(r.accounts[0].name))} ${r.accounts[0].estimated ? `holds ${money(r.accounts[0].balance)} today` : `held ${money(r.accounts[0].balance)} on ${lastDec}`}. The law divides that by ${f}, the IRS figure for age ${r.age}: ${money(r.amount)}.`
      : `${NameOf(unnamed(r.name))} ${money(r.amount)} is each account's ${r.estimated ? "balance today" : `balance on ${lastDec}`} divided by ${f}, the IRS figure for age ${r.age}: ${r.accounts.map((a) => `${a.name} ${money(a.balance / f)}`).join(", ")}.`;
    const adds = addsOf(r);
    const tax = adds === null ? null : withAmt.length === 1 && tt.socialMore >= 1
      ? `It is taxed as income and makes ${money(tt.socialMore)} more of the Social Security taxable: about ${money(adds)} more federal tax in all.`
      : `It is taxed as income: about ${money(adds)} more federal tax, on top of the year's other income.`;
    return [ui.h("p", { class: "small" }, amount), tax ? ui.h("p", { class: "small" }, tax) : null];
  });
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How this is worked out"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.h("p", { class: "small" }, "From 73 (75 if born in 1960 or later), the owner of a 401(k) or traditional IRA must take a share out each year and pay income tax on it."),
      ui.h("p", { class: "small" }, "Roth IRAs and, since 2024, Roth 401(k)s have none while the owner is alive."),
      ...workings.flat(),
      withAmt.length ? ui.h("p", { class: "small" }, "Missing it costs 25% of what was not taken (10% if it is taken within two years).") : null,
      d.ready && d.schedule.length ? ui.h("p", { class: "small" }, "Year by year, from the plan's projection, in today's dollars. The tax is what each one adds to that year's federal income tax, Social Security included.") : null,
      d.ready && d.schedule.length ? ui.h("ul", { class: "records" }, d.schedule.slice(0, 12).map((r) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${r.year} · ${whoAges(r)}`), ui.h("span", { class: "rec-value" }, money(r.rmdReal))),
        ui.h("div", { class: "rec-sub" }, `${howOf(r)} · ${r.extraTaxReal !== null ? `adds about ${money(r.extraTaxReal)} of federal tax` : `about ${money(r.taxes / (r.rmd / r.rmdReal || 1))} of tax at the plan's ${fmt.pct(d.taxRate, 0)} while you still work`}`)))) : null,
      d.ready && d.schedule.length > 12 ? ui.h("p", { class: "muted small" }, `...and ${d.schedule.length - 12} more years, to ${endAge}.`) : null,
      started ? ui.h("p", { class: "small" }, "The required amount itself cannot be moved to a Roth.") : null,
      started ? ui.h("p", { class: "small" }, "What you move after it is taxed that year, then never has to come out, and after five years comes out tax-free for you and your heirs.") : null,
      ui.h("p", { class: "small" }, "The IRS figure for each age: divide last December 31's balance by it to get the year's required withdrawal."),
      ui.h("div", { class: "chips" }, d.table.map((t) => ui.h("span", { class: "chip", style: { cursor: "default" } }, `${t.age}: ${t.factor}`))),
      ui.h("p", { class: "muted small" }, "Rules from IRS Publication 590-B (the Uniform Lifetime Table) and the SECURE 2.0 Act; tax at each year's federal rates."),
    )));

}
