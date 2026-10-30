// modules/goals/education/view.js -- DOM only. Each child's college: what it would cost when they get
// there, what is set aside, the monthly saving that covers the share you choose, and how much today's
// saving covers; the kind of college and the share per child in a fold; a button to set the goal.
import { compute, COSTS, DEFAULTS, DEFAULT_GROWTH } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.ed2-root .ed2-bar { height: 10px; border-radius: 6px; background: var(--panel-2); border: 1px solid var(--line); overflow: hidden; margin: 6px 0 4px; }
.ed2-root .ed2-bar span { display: block; height: 100%; background: var(--accent); }
.ed2-root .ed2-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "ed2-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  root.append(ui.h("section", { class: d.children.length ? "card" : "card accent hero" },
    d.children.length ? null : ui.h("h1", {}, "Saving for college"),
    ui.h("p", { class: d.children.length ? "" : "lede" }, `A year of a public college in your state costs about ${money(COSTS.public.yearly)} with room and board; a private one about ${money(COSTS.private.yearly)} (${d.costYear}-${String(d.costYear + 1).slice(2)} published prices). Prices have risen faster than inflation; the plan assumes ${(d.growth * 100).toFixed(1)}% a year. Many families pay less after grants.`),
    d.children.length ? null : ui.h("p", { class: "muted small" }, "Add your children on People with their birth dates."),
    d.children.length ? null : ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"))));

  for (const c of d.children) {
    const card = ui.card(`${c.name}: college from ${c.startYear}`);
    card.append(ui.row(
      ui.stat("Four years would cost", money(c.total), `${c.typeLabel.toLowerCase()}; ${money(c.totalToday)} in today's money`),
      ui.stat(c.started ? "Started" : "To cover " + pct(c.share), c.started ? "-" : money(c.neededMonthly), c.started ? "college has begun" : `a month for ${Math.round(c.monthsLeft / 12 * 10) / 10} years`),
    ));
    card.append(ui.h("div", { class: "ed2-bar", role: "img", "aria-label": `today's saving covers ${pct(c.coveredShare)}` }, ui.h("span", { style: { width: `${c.coveredShare * 100}%` } })),
      ui.h("p", { class: "ed2-d" }, `${money(c.saved)} set aside${c.goal ? ` ("${c.goal.name}")` : ""} and ${money(c.monthly)} a month would cover about ${pct(c.coveredShare)} of it, growing at ${(d.returnRate * 100).toFixed(1)}% a year in a 529 plan.`));
    card.append(ui.row(ui.button(c.goal ? `Update "${c.goal.name}"` : `Make it ${c.name}'s goal`, () => {
      pending = c.goal ? "Goal updated." : "Goal added on the Goals page.";
      store.update((p) => {
        p.goals = p.goals ?? [];
        const target = Math.round(c.totalToday * c.share / 1000) * 1000;
        const g = c.goal ? p.goals.find((y) => y.id === c.goal.id) : null;
        if (g) Object.assign(g, { target, targetDate: `${c.startYear}-08-15` });
        else p.goals.push({ id: ui.uid(), name: `${c.name}'s college`, icon: "🎓", target, targetDate: `${c.startYear}-08-15`, priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true });
      });
    }, { class: "secondary" })));
    // per child: the kind of college, the share, the years
    const s = plan.whatIfs?.college?.[c.id] ?? {};
    card.append(ui.h("details", { class: "fold", style: { marginTop: "8px" } }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "College and share"), ui.h("span", { class: "fold-status" }, `${c.typeLabel.toLowerCase()}, ${pct(c.share)}`), ui.h("span", { class: "fold-chev" }, "›")),
      ui.form([
        { key: "type", label: "Kind of college", type: "select", options: Object.entries(COSTS).map(([value, x]) => ({ value, label: x.label })) },
        { key: "yearly", label: "A year's cost today (for 'a cost I enter')", type: "money", min: 0 },
        { key: "share", label: "Share you want to cover", type: "percent", min: 0, max: 100 },
        { key: "years", label: "Years of college", type: "number", min: 1, max: 8, step: "1" },
        { key: "startAge", label: "Starts at age", type: "number", min: 14, max: 30, step: "1" },
      ], { type: s.type ?? DEFAULTS.type, yearly: s.yearly ?? "", share: s.share ?? DEFAULTS.share, years: s.years ?? DEFAULTS.years, startAge: s.startAge ?? DEFAULTS.startAge }, (v) => {
        pending = `${c.name}'s college saved.`;
        store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.college = p.whatIfs.college ?? {}; p.whatIfs.college[c.id] = { type: v.type, yearly: v.yearly ?? null, share: v.share ?? 1, years: v.years ?? 4, startAge: v.startAge ?? 18 }; });
      }, { submitLabel: "Save" })));
    root.append(card);
  }

  if (d.children.length) root.append(ui.card("Good to know", ui.h("ul", {},
    ui.h("li", {}, "A 529 plan grows tax-free when spent on college, and many states take contributions off state income tax: check your state's plan first."),
    ui.h("li", {}, "Grandparents and others can give five years of gifts to a 529 at once (Gifting)."),
    ui.h("li", {}, "Up to $35,000 left in a 529 can move to the child's Roth IRA over the years, if the 529 is 15 years old."),
    ui.h("li", {}, "Retirement first: there are loans for college, not for retirement.")),
    ui.h("details", { class: "fold" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How fast prices rise"), ui.h("span", { class: "fold-status" }, `${(d.growth * 100).toFixed(1)}% a year`), ui.h("span", { class: "fold-chev" }, "›")),
      ui.form([{ key: "growth", label: "College prices rise a year", type: "percent", min: 0, max: 15, help: `${(DEFAULT_GROWTH * 100).toFixed(0)}% if empty` }], { growth: plan.whatIfs?.college?.growth ?? null }, (v) => {
        pending = "Saved.";
        store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.college = { ...(p.whatIfs.college ?? {}), growth: v.growth ?? null }; });
      }, { submitLabel: "Save" })),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/gifting" }, "Gifting"), ui.h("a", { class: "btn secondary", href: "#/goals/goals" }, "Goals"))));
}
