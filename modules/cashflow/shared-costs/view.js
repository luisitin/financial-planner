// modules/cashflow/shared-costs/view.js -- DOM only. Sharing costs as a couple (gap design #22), simple first
// (docs/OPTIONAL.md): the answer (what each puts in a month) and one sentence, three chips for how to split, then one card
// of quiet rows: which costs are shared (checkboxes, all checked by default), what each keeps for themselves, how it is worked out.
// The choices are a what-if (whatIfs.shareCosts), written only through store.update on a chip tap, the share box's
// change or the checkboxes' Save.
import { compute, answerFor, alarmFor, namesOf, METHOD_LABELS } from "./compute.js";
import { part, parts, choice, links } from "../../../core/ui/more.js";
import { nameIn, NameIn, NameOf, verbFor } from "../../../core/words.js";

// what the next draw says and keeps open: { at: "choice" | "costs" } (the green line names the new answer, R7; the costs
// part saved in stays open, R17)
let pending = null;

const STYLE = `
.sc-root .sc-costs { display: grid; gap: 2px; }
.sc-root .sc-costs .toggle-row { justify-content: space-between; border-bottom: 1px solid var(--line); padding: 4px 0; }
.sc-root .sc-costs .toggle-row:last-child { border-bottom: 0; }
.sc-root .sc-costs .sc-amt { color: var(--muted); font-size: var(--fs-sm); white-space: nowrap; flex: none; }
.sc-root .sc-own { margin-top: 4px; }
.sc-root ol.sc-how { margin: 0; padding-left: 20px; display: grid; gap: 8px; }
`;

const write = (store, fn) => store.update((q) => {
  q.whatIfs = q.whatIfs && typeof q.whatIfs === "object" ? q.whatIfs : {};
  const s = q.whatIfs.shareCosts && typeof q.whatIfs.shareCosts === "object" && !Array.isArray(q.whatIfs.shareCosts) ? q.whatIfs.shareCosts : {};
  q.whatIfs.shareCosts = s;
  fn(s);
});

export function render(root, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmt.money(Math.round(Number(n) || 0), cur);
  const d = compute(plan, { today: fmt.today() });
  const names = namesOf(plan);
  const said = answerFor(d, names, money);
  const box = ui.h("div", { class: "sc-root" });
  root.append(box);
  const saved = pending; pending = null;
  const green = (at) => (saved?.at === at ? ui.notice("ok", `Saved. ${said.head}`) : null);

  // one adult: the page is not for this household (gap design #22: one sentence)
  if (!d.ready) {
    box.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, said.head), ui.h("p", { class: "lede" }, said.say),
      ui.row(ui.h("a", { class: "btn secondary", href: "#/household/people" }, "Add a partner on People"))));
    return;
  }
  const [A, B] = d.people;
  const nA = names.a, nB = names.b;

  // nothing to split yet: what to do first, one filled way to start
  if (d.case === "no-costs") {
    box.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, said.head), ui.h("p", { class: "lede" }, said.say),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/expenses" }, "Open Expenses"))));
    return;
  }

  // 1. the answer and its sentence; the way on when there is no income to split by
  box.append(ui.h("style", {}, STYLE));
  box.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, said.head), ui.h("p", { class: "lede" }, said.say),
    d.case === "no-income" ? ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Open Income")) : null));

  // 2. how to split: three chips (R23); "Our own split" shows one box in place, the first person's share
  const pick = (method) => {
    pending = { at: "choice" };
    write(store, (s) => {
      s.method = method;
      if (method === "own") {
        // start from the split on screen, to the whole percent, so nothing jumps when the box appears
        const now = A.share ?? d.byIncome?.[0] ?? 0.5;
        const f = Math.round(now * 100) / 100;
        if (A.id && B.id) s.own = { [A.id]: f, [B.id]: Number((1 - f).toFixed(2)) };
      }
    });
  };
  const how = ui.h("section", { class: "card" },
    choice(ctx, { id: "method", label: "How to split the shared costs", presets: ["income", "equal", "own"].map((v) => ({ value: v, label: METHOD_LABELS[v] })), value: d.method, onPick: pick }));
  if (d.method === "own") {
    const made = ui.numberBox({ name: "ownShare", value: A.share, percent: true, min: 0, max: 100 });   // its name is the label around it
    made.input.addEventListener("change", () => {
      if (made.input.checkValidity && !made.input.checkValidity()) { made.input.reportValidity?.(); return; }
      const n = ui.readNumber(made.input.value, { percent: true });
      if (n === null || n === undefined || n < 0 || n > 100) return;
      const f = Number((n / 100).toPrecision(12));
      if (Math.abs(f - A.share) < 1e-9) return;
      pending = { at: "choice" };
      write(store, (s) => { s.method = "own"; s.own = { [A.id]: f, [B.id]: Number((1 - f).toPrecision(12)) }; });
    });
    how.append(ui.h("div", { class: "form sc-own" }, ui.field(`${NameOf(nA)} share of the shared costs`, made.box, `${NameIn(nB)} ${verbFor(nB, "puts", "put")} in the rest: ${B.percent}%.`)));
  }
  const g1 = green("choice");
  if (g1) how.append(g1);
  box.append(how);

  // 3. the alarm, never folded (R9)
  const alarm = alarmFor(d, names, money);
  if (alarm) box.append(ui.notice("warn", alarm));

  // 4. the parts: which costs are shared (checkboxes), what each keeps, how it is worked out
  const ticks = d.costs.map((c) => {
    const cb = ui.h("input", { type: "checkbox", name: `share-${c.id}`, checked: c.shared ? true : null, value: c.id });
    return { c, cb, el: ui.h("label", { class: "toggle-row" }, cb, ui.h("span", { class: "toggle-text" }, c.name), ui.h("span", { class: "sc-amt" }, `${money(c.monthly)} a month`)) };
  });
  const costsForm = ui.h("form", { class: "form", onSubmit: (e) => {
    e?.preventDefault?.();
    const out = ticks.filter((t) => !t.cb.checked).map((t) => t.c.id);
    pending = { at: "costs" };
    write(store, (s) => {
      // a choice for a cost not on the list today (ended, or not started yet) is kept for when it comes back
      const listed = new Set(d.costs.map((c) => c.id));
      const kept = (Array.isArray(s.leaveOut) ? s.leaveOut : []).filter((x) => typeof x === "string" && !listed.has(x) && stillThere(plan, x));
      const next = [...kept, ...out];
      if (next.length) s.leaveOut = next; else delete s.leaveOut;
    });
  } },
  ui.h("div", { class: "sc-costs" }, ticks.map((t) => t.el)),
  ui.h("div", { class: "form-actions" }, ui.h("button", { type: "submit" }, "Save the shared costs")));
  const costsPart = {
    id: "costs", kind: "own", title: "Which costs are shared",
    says: d.sharedCount === d.count ? `all ${d.count} shared` : `${d.sharedCount} of ${d.count} shared`,
    open: saved?.at === "costs" || d.case === "none-shared", holds: ["costs"],
    body: [green("costs"), ui.h("p", { class: "muted small" }, "Uncheck a cost one of you pays alone: it is left out of the split. A new cost on Expenses starts as shared."), costsForm],
  };
  const known = d.total > 0.005 && A.part !== null && d.shared > 0.005;
  // what each keeps for themselves: the rest of the figures, so the vocabulary's "N more numbers" (docs/OPTIONAL.md R24). N counts
  // the figures the part adds to the first view: what each takes home (or brings in) and what is left for each, two a person
  // (each one's part is in the answer already); "4 more numbers" for a couple (integ2 check round 2: it said 2, the people)
  const keepsPart = known && {
    id: "keeps", kind: "more", n: 2 * d.people.length, noun: "numbers", one: "number",
    body: () => ui.h("ul", { class: "records" }, d.people.map((p, i) => {
      const n = i === 0 ? nA : nB, left = p.keeps;
      const gets = d.basis === "take-home" ? `${NameIn(n)} ${verbFor(n, "takes", "take")} home` : `${NameIn(n)} ${verbFor(n, "brings", "bring")} in`;
      return ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, NameIn(n)), ui.h("span", { class: "rec-value" }, left >= -0.5 ? `${money(left)} a month` : `${money(-left)} short`)),
        ui.h("div", { class: "rec-sub" }, `${gets} ${money(p.income)} a month and ${verbFor(n, "puts", "put")} ${money(p.dollars)} into the shared costs: ${left >= -0.5 ? `${money(left)} is left for ${nameIn(n)}` : `${money(-left)} more than that`}.`));
    })),
  };
  const steps = howSteps(d, names, money);
  const howPart = { id: "how", kind: "how", says: `${steps.length} steps`, body: () => ui.h("ol", { class: "sc-how" }, steps.map((t) => ui.h("li", {}, t))) };
  const card = parts(ctx, costsPart, keepsPart, howPart);
  if (card) box.append(card);

  // 5. More on this
  const deeper = links(ctx, [
    { href: "#/cashflow/budget-percent", ask: "How much of your take-home goes to needs, wants and savings?", says: "Budget (50/30/20)" },
    { href: "#/cashflow/expenses", ask: "What do you spend each month?", says: "Expenses" },
    { href: "#/cashflow/paycheck", ask: "What does each paycheck keep after tax?", says: "Paycheck" },
    { href: "#/cashflow/income", ask: "What does each of you bring in?", says: "Income" },
  ]);
  if (deeper) box.append(deeper);
}

/** A cost id that still names a bill on Expenses or a debt, so a choice for it is worth keeping. */
function stillThere(plan, id) {
  if (id === "debts") return true;
  if (id.startsWith("debt:")) { const k = id.slice(5); return (plan.debts ?? []).some((x) => x && (x.id === k || x.accountId === k)); }
  return (plan.expenses ?? []).some((x) => x && String(x.id) === id);
}

/** "How this is worked out": the sum with the household's own numbers, what it leaves out, where the method comes from. */
export function howSteps(d, names, money) {
  const [A, B] = d.people;
  const nA = names.a ?? "", nB = names.b ?? "";
  const out = [];
  out.push(`Shared costs: ${money(d.shared)} a month, the ${d.sharedCount === 1 ? "one cost" : `${d.sharedCount} costs`} checked under "Which costs are shared", each at what it comes to a month (a weekly bill times 52 and divided by 12, a yearly one divided by 12). Payments the Debts page adds to your month are costs too.`);
  if (d.taxes > 0.5) out.push(`Taxes not withheld on Expenses (${money(d.taxes)} a month) are left out: they come off the income of whoever earns it.`);
  if (d.total > 0.005) {
    out.push(d.basis === "take-home"
      ? `What each of you takes home: ${nameIn(nA)} ${money(A.income)} a month, ${nameIn(nB)} ${money(B.income)}. Pay counts after tax, Social Security and Medicare and what each paycheck puts into a 401(k) or benefits, as the Paycheck page works it out. Other income (a business, a pension, Social Security, rent) counts as typed on Income.`
      : `What each of you brings in, as typed on Income: ${nameIn(nA)} ${money(A.income)} a month, ${nameIn(nB)} ${money(B.income)}. The Paycheck page has no pay to work take-home from, so this is before any tax.`);
  } else out.push("Neither of you has income on the Income page yet, so there is nothing to split by income.");
  if (d.household > 0.5) out.push(`Income that belongs to both of you (${money(d.household)} a month, on Income with no one's name) counts half each.`);
  if (d.leftOut > 0.5 || d.others > 0) out.push("Anyone else in the household, and their income, is left out of the split.");
  if (d.byIncome) out.push(`By income, each share is that person's part of what you both ${d.basis === "take-home" ? "take home" : "bring in"}: ${money(A.income)} ÷ ${money(d.total)} = ${Math.round(d.byIncome[0] * 1000) / 10}%, ${money(B.income)} ÷ ${money(d.total)} = ${Math.round(d.byIncome[1] * 1000) / 10}%.`);
  if (A.part !== null && d.shared > 0.005) out.push(`Each part is the share times ${money(d.shared)}, to the dollar, so the two add up to ${money(d.shared)}: ${nameIn(nA)} ${money(A.dollars)}, ${nameIn(nB)} ${money(B.dollars)}.${d.total > 0.005 ? ` What each keeps is what they ${d.basis === "take-home" ? "take home" : "bring in"} less their part.` : ""}`);
  out.push("Splitting by income is a common way for couples whose pay differs: each puts the same share of what they earn toward what you share (National Bank of Canada, \"Sharing expenses as a couple\", 2023). Half each is the simplest; your own split is for anything else you agree on.");
  return out;
}
