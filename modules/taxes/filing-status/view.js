// modules/taxes/filing-status/view.js -- DOM only. The federal tax each way of filing, the cheapest marked,
// the separate returns' parts, and what filing separately gives up.
import { compute } from "./compute.js";

const STYLE = `
.fs-root .fs-list { list-style: none; margin: 0; padding: 0; }
.fs-root .fs-list li { display: flex; justify-content: space-between; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); }
.fs-root .fs-list li:last-child { border-bottom: 0; }
.fs-root .fs-t { font-weight: 600; }
.fs-root .fs-d { color: var(--text-2); font-size: var(--fs-sm); }
.fs-root .fs-v { white-space: nowrap; text-align: right; font-weight: 650; }
.fs-root .fs-best .fs-v { color: var(--ok); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "fs-root" }, ui.h("style", {}, STYLE));
  page.append(root);

  if (!d.options.length) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Which way to file"), ui.h("p", { class: "lede" }, "Married couples can file one return or two; a single parent can usually file as head of household. Add the people in the household first."), ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"))));
    return;
  }
  if (d.kind === "single" && d.options.length === 1) {
    root.append(ui.card(null, ui.h("p", {}, `Single, with no one else in the household: the only way to file. Federal tax this year about ${money(d.options[0].tax)}.`), ui.h("p", { class: "fs-d" }, "With a child or a relative you support living with you, head of household lowers the tax: add them on People.")));
    return;
  }
  const same = d.saving < 1 && d.options.every((o) => Math.abs(o.tax - d.options[0].tax) < 1);
  root.append(ui.card(null, ui.row(
    same ? ui.stat("Either way", money(d.options[0].tax), "the same federal tax this year") : ui.stat("Cheapest", d.options.find((o) => o.status === d.best).label, `saves ${money(Math.max(...d.options.map((o) => o.tax)) - Math.min(...d.options.map((o) => o.tax)))} a year`),
    ui.stat("You file now", d.options.find((o) => o.status === d.current)?.label ?? "-", d.saving > 0 ? `${money(d.saving)} more than the cheapest` : "already the cheapest"),
  )));
  root.append(ui.card("Federal tax each way, this year", ui.h("ul", { class: "fs-list" }, d.options.map((o) => ui.h("li", { class: o.status === d.best && !same ? "fs-best" : null },
    ui.h("span", {}, ui.h("div", { class: "fs-t" }, o.label), ui.h("div", { class: "fs-d" }, [o.note, o.parts ? o.parts.map((x) => `${x.name} ${money(x.tax)}`).join(", ") : ""].filter(Boolean).join(": "))),
    ui.h("span", { class: "fs-v" }, money(o.tax)))))));
  if (d.limits.length) root.append(ui.card("What filing separately gives up", ui.h("ul", {}, d.limits.map((l) => ui.h("li", {}, l[0].toUpperCase() + l.slice(1) + "."))),
    ui.h("p", { class: "fs-d" }, "Couples usually file jointly. Separately can pay off when one of you has large medical bills (the floor is a share of that person's income alone) or an income-driven student loan."),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/debt/student-loans" }, "Student loans"), ui.h("a", { class: "btn secondary", href: "#/taxes/federal" }, "Federal estimate"))));
  else root.append(ui.card("Head of household", ui.h("p", { class: "fs-d" }, "You qualify when you are unmarried (or lived apart from a spouse the last six months of the year) and paid more than half the cost of keeping up a home where a qualifying child or relative lived more than half the year. A dependent parent need not live with you.")));
}
