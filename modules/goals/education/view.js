// modules/goals/education/view.js -- DOM only. Each child's college: what it would cost when they get
// there, what is set aside, the monthly saving that covers the share you choose, and how much today's
// saving covers; the kind of college and the share per child in a fold; a button to set the goal.
import { compute, COSTS, DEFAULTS, DEFAULT_GROWTH, shownAmount, previewsOf } from "./compute.js";
import { previewText } from "../house/compute.js";
import { part } from "../../../core/ui/more.js";

let pending = null;   // the confirmation shown on the next render: { text, part } (the part just saved stays open, R17)

const STYLE = `
.ed2-root .ed2-bar { height: 10px; border-radius: 6px; background: var(--panel-2); border: 1px solid var(--line); overflow: hidden; margin: 6px 0 4px; }
.ed2-root .ed2-bar span { display: block; height: 100%; background: var(--accent); }
.ed2-root .ed2-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

/** The federal student aid form (the FAFSA) line: open now, or the day it opens by (20 U.S.C. 1090(d)(4)(A)). */
function fafsaWords(f) {
  const opens = new Date(`${f.opens}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `${f.open ? `The free federal student aid form for ${f.label} is open now` : `The free federal student aid form for ${f.label} opens by ${opens}`} at studentaid.gov: it decides grants, work-study and federal student loans, and some aid goes to those who file first.`;
}

/**
 * What the rate does, for the first child still to start (pure): "At 4.0% a year, a public in-state year ($25,850 in
 * 2025-26) would cost about $41,390 in 2038, when Cy starts." With no such child, the rate alone.
 */
export function growthExample(d, money) {
  const g = d.growth, rate = `${(g * 100).toFixed(1)}% a year`;
  const c = d.children.find((x) => !x.started);
  if (!c) return `The plan assumes ${rate} for college prices.`;
  const then = COSTS.public.yearly * Math.pow(1 + g, Math.max(0, c.startYear - d.costYear - 1));
  return `At ${rate}, a public in-state year (${money(COSTS.public.yearly)} in ${d.costYear}-${String(d.costYear + 1).slice(2)}) would cost about ${money(then)} in ${c.startYear}, when ${c.name} starts.`;
}
/** A kind of college in a few words, for a row's status (at most 20 characters with the share). */
const KIND_WORDS = { public: "public", private: "private", custom: "your own cost" };
/** The line in a child's card while an empty "A cost I enter" box counts our gray figure. */
export const PREVIEW_LINE = "The yearly cost is our guess for now: a public in-state year. Put yours in under Type of college and share to cover.";

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  // to the $10, as Life insurance needs quotes this page's figures (`shownAmount`)
  const money = (n) => fmt.money(shownAmount(n), cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  // our guess for an empty "A cost I enter" box (goals/education:yearly): compute counts it itself, so every page that quotes it
  // agrees; it is never saved. The box shows that figure, the help line its reason.
  const g = previewsOf(plan, { today: fmt.today() }).yearly ?? null;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "ed2-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const said = pending; pending = null;
  if (said) { const n = ui.notice("ok", said.text); root.append(n); setTimeout(() => n.remove(), 4000); }
  const rises = `College prices have risen faster than prices in general; the plan assumes ${(d.growth * 100).toFixed(1)}% a year.`;

  root.append(ui.h("section", { class: d.children.length ? "card" : "card accent hero" },
    d.children.length ? null : ui.h("h1", {}, "Saving for college"),
    ui.h("p", { class: d.children.length ? "" : "lede" }, `A year of a public college in your state costs about ${money(COSTS.public.yearly)} with room and board; a private one about ${money(COSTS.private.yearly)} (${d.costYear}-${String(d.costYear + 1).slice(2)} published prices). ${rises} Many families pay less after grants.`),
    d.children.length ? null : ui.h("p", { class: "muted small" }, "Add your children on People with their birth dates."),
    d.children.length ? null : ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"))));

  const monthYear = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  for (const c of d.children) {
    // already in college (round 8 item 18): what is still to pay leads, and the goal is the next school year's, dated at its
    // next bill (it said "0% covered" and wrote a goal dated at the first bill, years ago)
    if (c.started && c.left) {
      const card = ui.card(c.finished ? `${c.name}: college is paid for` : `${c.name}: in college since ${c.startYear}`);
      if (c.finished) { card.append(ui.h("p", { class: "ed2-d" }, `The last school year's bills (${c.costs[c.costs.length - 1].year}-${String(c.costs[c.costs.length - 1].year + 1).slice(2)}) are behind you.`)); root.append(card); continue; }
      const first = c.left[0];
      const spring = first.part === "spring";
      const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      card.append(ui.row(
        ui.stat("Still to pay", money(c.stillToPay), `${c.left.map((x) => x.label).join(", ")}${c.share < 1 ? `, ${pct(c.share)} of it` : ""}`),
        // the next bill as what it is (review UX 1): the spring half once the fall bill has come due, else the year from its fall bill
        ui.stat("Next bill", monthYear(c.nextBill), spring ? `about ${money(c.nextYearCost)}, the spring half of ${first.label}` : `${first.label}: about ${money(c.nextYearCost)} for the year`),
      ));
      card.append(ui.h("p", { class: "ed2-d" }, `${spring ? `The August bill for ${first.label} is taken as paid; the spring half, about ${money(c.nextYearCost)}, is due by ${day(c.nextBill)}.` : `${first.label} has not begun yet.`} ${money(c.saved)} is set aside${c.goal ? ` ("${c.goal.name}")` : ""}${c.saved >= c.stillToPay - 0.5 ? ": that covers what is left" : c.saved >= c.nextYearCost - 0.5 ? ": that covers the next bill" : ""}.`));
      if (c.fafsa) card.append(ui.h("p", { class: "ed2-d" }, fafsaWords(c.fafsa)));
      const target = shownAmount(c.nextYearCost), name = `${c.name}'s college, ${first.label}`;
      // a generic "Education" goal naming no child (review UX 1): offered first, turned into this child's goal with what is set
      // aside for it, so college is not counted twice
      const generic = !c.goal && d.generic ? d.generic : null;
      const setGoal = (id) => () => {
        pending = { text: generic && id === generic.id ? `"${generic.name}" is now ${name}.` : c.goal ? "Goal updated." : "Goal added on the Goals page." };
        store.update((p) => {
          p.goals = p.goals ?? [];
          const g = id ? p.goals.find((y) => y.id === id) : null;
          // a name this page wrote for an earlier school year moves on to this one; the generic goal takes the child's name
          if (g) Object.assign(g, { target, targetDate: c.nextBill, inflates: false }, (generic && id === generic.id) || /^.+'s college, \d{4}-\d{2}$/.test(g.name ?? "") ? { name } : {});
          else p.goals.push({ id: ui.uid(), name, icon: "🎓", target, targetDate: c.nextBill, priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false });
        });
      };
      card.append(ui.h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
        generic ? ui.button(`Use "${generic.name}" for ${c.name}`, setGoal(generic.id)) : null,
        ui.button(c.goal ? `Update "${c.goal.name}"` : generic ? "Add a new goal instead" : `Make it ${c.name}'s goal`, setGoal(c.goal?.id ?? null), { class: "secondary" })),
        ui.h("p", { class: "muted small" }, generic ? `"${generic.name}" names no child: using it for ${c.name} keeps one goal for each child, with what is set aside for it.` : "The goal is the next bill, due by its date; update it each school year."));
      root.append(card);
      continue;
    }
    const card = ui.card(`${c.name}: college from ${c.startYear}`);
    card.append(ui.row(
      ui.stat("Four years would cost", money(c.total), `${c.type === "custom" ? (c.previewed ? "our guess of the cost" : "your own cost") : c.typeLabel.toLowerCase()}; ${money(c.totalToday)} in today's dollars`),
      ui.stat(c.started ? "Started" : "To cover " + pct(c.share), c.started ? "-" : money(c.neededMonthly), c.started ? "college has begun" : `a month for ${c.monthsLeft >= 24 ? `about ${Math.round(c.monthsLeft / 12)} years` : fmt.yearsMonthsWords(c.monthsLeft)}`),
    ));
    card.append(ui.h("div", { class: "ed2-bar", role: "img", "aria-label": `today's saving covers ${pct(c.coveredShare)}` }, ui.h("span", { style: { width: `${c.coveredShare * 100}%` } })),
      ui.h("p", { class: "ed2-d" }, `${money(c.saved)} set aside${c.goal ? ` ("${c.goal.name}")` : ""} and ${money(c.monthly)} a month would cover about ${pct(c.coveredShare)} of it, growing at ${(d.returnRate * 100).toFixed(1)}% a year in a 529 plan.`),
);
    // a cost the person chose to enter and has not: our gray figure counts, and says so outside the fold (R9 #5)
    if (c.previewed) card.append(ui.h("p", { class: "muted small" }, PREVIEW_LINE));
    if (c.fafsa) card.append(ui.h("p", { class: "ed2-d" }, fafsaWords(c.fafsa)));
    card.append(ui.row(ui.button(c.goal ? `Update "${c.goal.name}"` : `Make it ${c.name}'s goal`, () => {
      pending = { text: c.goal ? "Goal updated." : "Goal added on the Goals page." };
      store.update((p) => {
        p.goals = p.goals ?? [];
        const target = Math.round(c.totalToday * c.share / 1000) * 1000;
        const g = c.goal ? p.goals.find((y) => y.id === c.goal.id) : null;
        if (g) Object.assign(g, { target, targetDate: `${c.startYear}-08-15` });
        else p.goals.push({ id: ui.uid(), name: `${c.name}'s college`, icon: "🎓", target, targetDate: `${c.startYear}-08-15`, priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true });
      });
    }, { class: "secondary" })));
    // per child: the kind of college, the share, the years (one row of its own in the child's card: an item part)
    const s = plan.whatIfs?.college?.[c.id] ?? {};
    const pid = `college-${c.id}`;
    const ours = g && !(s.yearly !== null && s.yearly !== undefined && s.yearly !== "" && Number.isFinite(Number(s.yearly)));
    const eduForm = ui.form([
      { key: "type", label: "Kind of college", type: "select", options: Object.entries(COSTS).map(([value, x]) => ({ value, label: x.label })) },
      { key: "yearly", label: "A year's cost today", type: "money", min: 0, help: ours ? `Our guess: ${g.why}. Tuition, fees, housing and food for one year.` : "Tuition, fees, housing and food for one year.", placeholder: ours ? previewText(g.value, "money") : undefined },
      { key: "share", label: "Share you want to cover", type: "percent", min: 0, max: 100, placeholder: "" },
      { key: "years", label: "Years of college", type: "number", min: 1, max: 8, step: "1" },
      { key: "startAge", label: "Starts at age", type: "number", min: 14, max: 30, step: "1" },
    ], { type: s.type ?? DEFAULTS.type, yearly: s.yearly ?? "", share: s.share ?? DEFAULTS.share, years: s.years ?? DEFAULTS.years, startAge: s.startAge ?? DEFAULTS.startAge }, (v) => {
      pending = { text: `${c.name}'s college saved.`, part: pid };
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.college = p.whatIfs.college ?? {}; p.whatIfs.college[c.id] = { type: v.type, yearly: v.yearly ?? null, share: v.share ?? 1, years: v.years ?? 4, startAge: v.startAge ?? 18 }; });
    }, { submitLabel: "Save" });
    card.append(ui.h("div", { style: { marginTop: "8px" } }, part(ctx, { id: pid, kind: "item", title: "Type of college and share to cover", says: `${KIND_WORDS[c.type] ?? "public"}, ${pct(c.share)}`, guess: c.previewed ? 1 : 0,
      open: said?.part === pid, holds: ["type", "yearly", "share", "years", "startAge"], body: eduForm })));
    // the cost box, its gray figure and its "Our guess" line show only for "A cost I enter" (F10: it was labelled "(for 'a cost I
    // enter')" whatever kind was chosen). `hidden` alone did not hide it: the kit's `.field { display: flex }` wins over the
    // browser's [hidden] (critic e9 F6: the gray 25,850 and "Our guess" showed under Public), so the box is also set to none.
    const kindSel = eduForm?.querySelector('select[name="type"]'), yearlyLab = eduForm?.querySelector('[name="yearly"]')?.closest("label");
    if (kindSel && yearlyLab) { const sync = () => { const off = kindSel.value !== "custom"; yearlyLab.hidden = off; yearlyLab.style.display = off ? "none" : ""; }; sync(); kindSel.addEventListener("change", sync); }
    root.append(card);
  }

  const gr = plan.whatIfs?.college?.growth;
  const growthSet = gr !== null && gr !== undefined && gr !== "" && Number.isFinite(Number(gr));
  if (d.children.length) root.append(ui.card("Good to know", ui.h("ul", {},
    ui.h("li", {}, "A 529 plan grows tax-free when spent on college, and many states take contributions off state income tax: check your state's plan first."),
    ui.h("li", {}, "Grandparents and others can give five years of gifts to a 529 at once (Gifting)."),
    ui.h("li", {}, "Up to $35,000 left in a 529 can move to the child's Roth IRA over the years, if the 529 is 15 years old."),
    ui.h("li", {}, "Retirement first: there are loans for college, not for retirement."),
    // only under the credit's income limit, with a student in the first four years (round 8 item 18)
    d.aotc ? ui.h("li", {}, `The American Opportunity tax credit takes up to ${money(d.aotc.perStudent)} a year off your tax for each student in the first four years of college (Form 8863)${d.aotc.status === "partial" ? "; at your income it is smaller, and it ends at " + money(d.aotc.range[1]) : ""}.`) : null),
    // how fast prices rise: its box, with what the rate does to the first child's first year, one quiet row (its title as
    // before; an item part with its own name: the page's one row about all the children, beside one row per child)
    ui.h("div", { class: "folds" }, part(ctx, { id: "growth", kind: "item", title: "How fast prices rise", says: `${(d.growth * 100).toFixed(1)}% a year`, set: growthSet, open: said?.part === "growth", holds: ["growth"], body: [
      ui.h("p", { class: "ed2-d" }, growthExample(d, money)),
      ui.form([{ key: "growth", label: "How much college prices rise each year", type: "percent", min: 0, max: 15, placeholder: "", help: `Left empty, we count ${(DEFAULT_GROWTH * 100).toFixed(0)}% a year.` }], { growth: plan.whatIfs?.college?.growth ?? null }, (v) => {
        pending = { text: "Saved.", part: "growth" };
        store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.college = { ...(p.whatIfs.college ?? {}), growth: v.growth ?? null }; });
      }, { submitLabel: "Save" })] })),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/gifting" }, "Gifting"), ui.h("a", { class: "btn secondary", href: "#/goals/goals" }, "Goals"))));
}
