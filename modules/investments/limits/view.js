// modules/investments/limits/view.js -- DOM only. The room left this year first, then each
// person's limits with a bar, what each adult may put in a Roth IRA directly, and the deadlines.
import { compute } from "./compute.js";

const RETURN = {
  married_joint: "Filing jointly",
  qualifying_surviving: "As a qualifying surviving spouse",
  single: "Filing single",
  head_of_household: "Filing as head of household",
};

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const room = d.totals.limit - d.totals.used;
  const hsaYear = d.kindYear.hsa;
  const yearNote = hsaYear > d.limitsYear
    ? `IRS limits for ${d.limitsYear}, and the HSA limits already published for ${hsaYear}; the others stay at ${d.limitsYear}'s until the IRS publishes ${d.year}'s.`
    : `IRS limits for ${d.limitsYear}.`;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasContributions ? (room > 0 ? `${money(room)} of tax-advantaged room left this year` : "Every account is filled to its limit") : `${d.year} contribution limits`),
    ui.h("p", { class: "lede" }, d.hasContributions
      ? `${money(d.totals.used)} a year is going into 401(k)s, IRAs and HSAs against ${money(d.totals.limit)} of limits for the accounts you have. ${room > 0 ? "Room in a tax-advantaged account is the cheapest place for the next dollar you save." : "Anything more goes to a taxable brokerage account."}`
      : `Each person may put ${money(d.base["401k"])} into a 401(k), ${money(d.base.ira)} into IRAs (traditional and Roth together) and ${money(d.base.hsa)} into an HSA (${money(d.base.hsaFamily)} with family cover) this year, more from 50 (and 55 for the HSA). Enter what goes in on the Contributions page to see the room left.`),
    ui.h("p", { class: "muted small" }, `${yearNote} Employer matches do not count against the 401(k) limit; employer HSA money does count against the HSA limit. Health FSA ${money(d.fsa.limit)}; 529 plans have no yearly limit but gifts over ${money(d.gift.exclusion)} a year per child per giver use the gift-tax exclusion (up to ${money(d.gift.superfund)} at once, spread over five years).`),
  ));
  for (const w of d.warnings) root.append(ui.notice("warn", w));
  for (const n of d.notes) root.append(ui.notice("info", n));

  const others = (p) => d.people.filter((q) => q !== p).map((q) => q.name).join(" and ");
  const noHsaWhy = (p) => d.hsa.coverage === "none"
    ? "The HSA page says there is no high-deductible health plan, and only people on one can put money in an HSA."
    : `Only ${d.hsa.coveredName ?? "the person on the plan"} is on the self-only high-deductible health plan. If ${p.name} is covered too, set family cover on the HSA page.`;
  const sub = (p, r) => {
    if (r.kind === "hsa" && !r.eligible) return r.over > 0 ? `${money(r.over)} over: ${noHsaWhy(p)} Money put in anyway is taxed as pay.` : noHsaWhy(p);
    const parts = [r.over > 0 ? `${money(r.over)} over the limit` : `${money(r.room)} of room`];
    if (r.catchUp) parts[0] += ` (includes the ${money(r.catchUp)} catch-up${r.catchUpCapped ? ", the most the pay allows" : ` from ${r.kind === "401k" && p.age >= 60 && p.age <= 63 ? "60 to 63" : r.catchUpAge}`})`;
    else if (r.catchUpCapped) parts[0] += " (no catch-up: it cannot be more than the pay left after the other 401(k) money)";
    else if (p.age !== null && r.catchUpAge && p.age < r.catchUpAge) parts.push(`catch-up from ${r.catchUpAge}`);
    if (r.shared) parts.push(`shares the family limit with ${others(p)}`);
    if (r.year !== d.limitsYear) parts.push(`${r.year} limit`);
    parts.push(r.accounts.length ? r.accounts.join(", ") : r.hasAccount ? null : "no such account on file");
    return parts.filter(Boolean).join(" · ");
  };
  const limitRow = (p, r) => {
    const none = r.kind === "hsa" && !r.eligible && !r.used;
    return ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.label, r.over > 0 ? ui.h("span", { class: "pill warn" }, "over") : null), ui.h("span", { class: "rec-value" }, none ? "None this year" : `${money(r.used)} of ${money(r.limit)}`)),
      none ? null : ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${r.limit > 0 ? Math.min(100, Math.round((r.used / r.limit) * 100)) : 100}%`, background: r.over ? "var(--bad)" : "var(--ok)" } })),
      ui.h("div", { class: "rec-sub" }, sub(p, r)));
  };
  for (const p of d.people) root.append(ui.card(`${p.name}${p.age !== null ? `, ${p.age}` : ""}`, ui.h("ul", { class: "records" }, p.rows.map((r) => limitRow(p, r)))));

  if (d.roth) {
    const r = d.roth, [lo, hi] = r.phaseOut;
    const range = `${money(lo)} and ${money(hi)}`;
    const rangeYear = r.year !== d.year ? ` (the ${r.year} range; ${d.year}'s is not out yet)` : "";
    const how = r.filingStatus === "married_separate"
      ? (r.livedApart
        ? `Filing separately after living apart all year, each spouse counts as single: the amount shrinks between ${range} of their own income${rangeYear}.`
        : `Filing separately while living together, the amount shrinks between ${range} of each spouse's own income${rangeYear}, so above ${money(hi)} nothing can go in directly.`)
      : `${RETURN[r.filingStatus] ?? "On your return"}, the amount shrinks between ${range} of income${rangeYear}. The plan puts yours at about ${money(r.magi)}.`;
    const line = (x) => {
      const who = x.name === "You" ? "You" : x.name;
      const title = x.allowed > 0 ? `${who} can put up to ${money(x.allowed)} in a Roth IRA directly this year` : x.status === "over" ? `${who} cannot put money in a Roth IRA directly this year` : `${who} has no Roth IRA room left this year`;
      const why = [];
      if (r.separate) why.push(`Own income about ${money(x.magi)}.`);
      why.push(x.status === "ok" ? "Under the income limit, so the full amount." : x.status === "partial" ? `Income is inside the band, so the ${money(x.full)} is cut to ${money(x.reduced)}.` : "Over the income limit. The backdoor route still works: put money in a traditional IRA without a deduction, then convert it to a Roth.");
      if (x.traditional > 0 && x.status !== "over") why.push(`The ${money(x.traditional)} going into a traditional IRA uses the same yearly limit${x.allowed < x.reduced ? `, which leaves ${money(x.allowed)}` : ""}.`);
      if (x.over > 0) why.push(`${money(x.roth)} is going in, ${money(x.over)} too much.`);
      else if (x.roth > 0) why.push(`${money(x.roth)} is going in now${x.allowed > x.roth ? `, so ${money(x.allowed - x.roth)} more fits` : ""}.`);
      return ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, title, x.over > 0 ? ui.h("span", { class: "pill warn" }, "over") : null)),
        ui.h("div", { class: "rec-sub" }, why.join(" ")));
    };
    root.append(ui.card("Roth IRA: how much can go in directly",
      ui.h("p", { class: "small" }, "A Roth IRA has an income limit. Under it, each adult can put in the full IRA amount; across a band of income the amount shrinks; above it nothing can go in directly. The income that counts is the total on the tax return before the standard deduction, with any traditional IRA deduction added back."),
      ui.h("p", { class: "small" }, how),
      ui.h("ul", { class: "records" }, r.people.map(line)),
    ));
  }
  const hsaOff = d.people.some((p) => p.rows.some((r) => r.kind === "hsa" && !r.eligible));
  root.append(ui.card("Deadlines",
    ui.h("ul", { class: "records" }, d.deadlines.map((x) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.label), ui.h("span", { class: "rec-value" }, fmt.date(x.date))), ui.h("div", { class: "rec-sub" }, x.note)))),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/contributions" }, "Edit contributions"), hsaOff ? ui.h("a", { class: "btn secondary", href: "#/taxes/hsa-fsa" }, "HSA cover") : null),
  ));
}
