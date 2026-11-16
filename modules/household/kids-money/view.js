// modules/household/kids-money/view.js -- DOM only. Children's money (gap list, next 60, item 57), simple first
// (docs/OPTIONAL.md): the sentence for the case, one line per child (age, allowance a month, what they hold), each child's
// form one tap away under their row, and one quiet card of two rows: "Growing it" (two rows of chips) and "How this is
// worked out". Every word and figure comes from compute.js. The plan changes only through ctx.store.update: a child's
// Save (with Undo), a chip under "Growing it" (whatIfs.kidsMoney), and "Add allowances to spending" (asked first, with Undo).
import {
  compute, answerFor, olderLine, rowWords, savedLine, undoneLine, unchangedLine, withMoney, cleanMoney, spendLine, spendConfirm, spendDone,
  applySpending, SPEND_UNDONE, growStatus, growLabels, growLine, growSaved, kiddieLine, howSteps, PERIODS, SHARES, GROWS,
  CUSTODIAL_LINE, CUSTODIAL_HELP, GROW_INTRO, GROW_EXAMPLE,
} from "./compute.js";
import { PERIODS as ALL_PERIODS } from "../../../core/math/periods.js";
import { part, parts, rest, choice, links } from "../../../core/ui/more.js";

// what the next draw says, and where: { at: "row:<child id>" | "spend" | "grow", text, undo?, back? } (R7, R17: drawn once)
let pending = null;

const STYLE = `
.km-root .km-pick { margin: 12px 0 4px; font-size: var(--fs-sm); color: var(--text-2); }
.km-root .records .rec-foot { justify-content: flex-end; }
.km-root ol.km-how { margin: 0; padding-left: 20px; display: grid; gap: 8px; }
.km-root .km-note { margin-top: 10px; }
`;
const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);

export function render(root, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const h = ui.h;
  const cur = plan.meta?.currency;
  const money = (n) => fmt.money(Math.round(Number(n) || 0), cur);
  const today = fmt.today();
  const d = compute(plan, { today });
  const said = answerFor(d, money);
  const saved = pending; pending = null;
  const note = (at) => (saved?.at === at
    ? ui.notice("ok", saved.text, saved.undo ? { undo: saved.undo, undone: (r) => { pending = { at, text: ui.undoneWords(r, saved.back) }; } } : {})
    : null);
  const box = h("div", { class: "km-root" });
  root.append(box);

  // no child under 18: what the page is for and the one way to start (People)
  if (d.case === "none" || d.case === "older") {
    box.append(h("section", { class: "card accent hero" }, h("h1", {}, said.head), h("p", { class: "lede" }, said.say),
      ui.row(h("a", { class: "btn", href: "#/household/people" }, "Add a child on People"))));
    return;
  }
  box.append(h("style", {}, STYLE));

  // 1. the sentence; with nothing typed yet, the one filled way to start opens the first child's form
  const first = d.kids[0];
  const startBtn = d.case === "start" ? ui.button(`Set ${first.name}'s allowance`, () => openForm(first), {}) : null;
  box.append(h("section", { class: "card accent hero" }, h("h1", {}, said.head), h("p", { class: "lede" }, said.say), startBtn ? ui.row(startBtn) : null));

  // 2. one line per child, the form under the row; the custodial line, the dependents not listed, the spending line
  const rowsOf = new Map(), opened = new Map();
  const kidRow = (k) => {
    const w = rowWords(k, money);
    const act = ui.button(w.action, () => openForm(k), { class: "secondary small", "aria-label": `${w.action}: ${k.name}'s money`, "aria-expanded": "false" });
    const li = h("li", { dataset: { key: k.id } },
      h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, w.title), h("span", { class: "rec-value" }, w.value)),
      ...w.lines.map((t) => h("div", { class: "rec-sub" }, t)),
      h("div", { class: "rec-foot" }, act),
      note(`row:${k.id}`));
    rowsOf.set(k.id, { li, act });
    return li;
  };
  const card = h("section", { class: "card" }, h("h2", {}, "Each child"), ...rest(ctx, { id: "kids", items: d.kids, row: kidRow, noun: "children", one: "child" }));
  if (d.totals.custodial > 0) card.append(h("p", { class: "muted small km-note" }, CUSTODIAL_LINE));
  const older = olderLine(d);
  if (older) card.append(h("p", { class: "muted small km-note" }, older));
  const sl = spendLine(d);
  if (sl) {
    card.append(h("p", { class: "muted small km-note" }, sl.text));
    if (sl.button) card.append(ui.row(ui.button(sl.button, addToSpending, { class: "secondary" })));
  }
  const spent = note("spend");
  if (spent) card.append(spent);
  box.append(card);

  // 3. the parts: "Growing it" (two rows of chips, no box) and how it is worked out, once something is typed
  const growing = d.case === "set" && d.growing;
  if (growing) {
    const labels = growLabels(d.pick);
    const kiddie = kiddieLine(d, money);
    const steps = howSteps(d, money);
    const card2 = parts(ctx,
      // until a chip is tapped both picks are our guess, and the status says so ("our guess · half, 2%", R26)
      { id: "grow", kind: "own", title: "Growing it", says: growStatus(d.pick), guess: d.pick.picked ? 0 : 1, open: saved?.at === "grow" || undefined,
        body: [note("grow"), h("p", {}, GROW_INTRO),
          h("p", { class: "km-pick" }, "How much of the allowance is saved"),
          choice(ctx, { id: "share", label: "How much of the allowance is saved", presets: SHARES, value: d.pick.share, onPick: (v) => pick({ share: v }) }),
          h("p", { class: "km-pick" }, "What the savings earn a year"),
          choice(ctx, { id: "earn", label: "What the savings earn a year", presets: GROWS.map((g) => ({ value: g, label: labels[g] })), value: d.pick.grow, onPick: (v) => pick({ grow: v }) }),
          h("p", { class: "muted small" }, GROW_EXAMPLE),
          h("ul", { class: "records" }, d.kids.map((k) => { const g = growLine(k, money); return h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, g.title)), g.sub ? h("div", { class: "rec-sub" }, g.sub) : null); })),
          kiddie ? h("p", {}, kiddie) : null] },
      { id: "how", kind: "how", says: `${steps.length} steps`, body: () => h("ol", { class: "km-how" }, steps.map((t) => h("li", {}, t))) });
    if (card2) box.append(card2);
  }

  // 4. More on this
  const deeper = links(ctx, [
    { href: "#/household/people", ask: "Is everyone in your plan?", says: "People" },
    { href: "#/cashflow/expenses", ask: "What do you spend each month?", says: "Expenses" },
    { href: "#/goals/education", ask: "What will college cost?", says: "Education (529)" },
  ]);
  if (deeper) box.append(deeper);

  // ---------------------------------------------------------------- a child's form, under their row
  function openForm(k) {
    const r = rowsOf.get(k.id);
    if (!r) return;
    if (opened.has(k.id)) { opened.get(k.id)(); return; }
    let close = null;
    const shut = () => {
      const c = close; close = null; opened.delete(k.id); c?.();
      r.act.setAttribute?.("aria-expanded", "false");
      if (startBtn && !opened.size) startBtn.hidden = false;
    };
    const build = (holder) => holder.append(h("h3", {}, `${k.name}'s money`), formFor(k, shut));
    if (ui.openUnder && r.li.parentElement) close = ui.openUnder(r.li, build);
    else { const holder = h("li", { class: "rec-form" }); r.li.after(holder); build(holder); close = () => holder.remove(); }
    opened.set(k.id, shut);
    r.act.setAttribute?.("aria-expanded", "true");
    if (startBtn) startBtn.hidden = true;   // one filled button on the screen: the form's Save
  }
  function formFor(k, shut) {
    const m = k.money;
    const fields = [
      { key: "allowance", label: "Allowance", type: "money", min: 0, help: `For example, ${money(5)} a week. Leave it empty for none.` },
      { key: "period", label: "How often", type: "select", options: PERIODS.map((v) => ({ value: v, label: ALL_PERIODS[v].label })) },
      { key: "covers", label: "What it is meant to cover", type: "text", help: "For example, snacks, toys or saving for a bike." },
      { key: "jar", label: "In a savings jar or piggy bank", type: "money", min: 0 },
      { key: "bank", label: "In a kids' bank account", type: "money", min: 0 },
      { key: "custodial", label: `In an account in ${k.name}'s name (custodial)`, type: "money", min: 0, more: true, help: CUSTODIAL_HELP(k.name) },
    ];
    const values = { allowance: m.allowance || null, period: m.allowance > 0 ? m.period : "weekly", covers: m.covers, jar: m.jar || null, bank: m.bank || null, custodial: m.custodial || null };
    return ui.form(fields, values, (v) => {
      const next = cleanMoney(v);
      const was = (plan.household?.people ?? []).find((y) => isObj(y) && y.id === k.id)?.childMoney;
      if (JSON.stringify(next) === JSON.stringify(cleanMoney(isObj(was) ? was : {}))) {
        // nothing changed: nothing is written, the form shuts and says so
        pending = { at: `row:${k.id}`, text: unchangedLine(k.name) };
        shut();
        if (ctx.redraw) ctx.redraw(); else pending = null;
        return;
      }
      const p = { at: `row:${k.id}`, text: savedLine(withMoney(k, next), money), back: undoneLine(k.name) };
      pending = p;
      p.undo = ui.undoable(store, (draft) => {
        const x = (draft.household?.people ?? []).find((y) => isObj(y) && y.id === k.id);
        if (!x) return;
        if (next) x.childMoney = next; else delete x.childMoney;
      });
      if (!p.undo) { pending = null; shut(); }   // nothing changed: the form shuts and nothing is said
    }, { submitLabel: "Save", onCancel: shut, moreLabel: `An account in ${k.name}'s name (optional)` });
  }

  // ---------------------------------------------------------------- the one way this page reaches the budget
  function addToSpending() {
    if (!ui.confirm(spendConfirm(d, money))) return;
    const p = { at: "spend", text: spendDone(d, money), back: SPEND_UNDONE };
    pending = p;
    p.undo = ui.undoable(store, (draft) => applySpending(draft, d.spending));
    if (!p.undo) pending = null;
  }
  // a chip under "Growing it": the pick saved (a calculator's choice, whatIfs.kidsMoney), the green line naming the new figures
  function pick(change) {
    const write = (draft) => {
      draft.whatIfs = isObj(draft.whatIfs) ? draft.whatIfs : {};
      const was = isObj(draft.whatIfs.kidsMoney) ? draft.whatIfs.kidsMoney : {};
      draft.whatIfs.kidsMoney = { share: d.pick.share, grow: d.pick.grow, ...was, ...change };
    };
    const next = structuredClone(plan); write(next);
    pending = { at: "grow", text: growSaved(compute(next, { today }), money) };
    store.update(write);
  }
}
