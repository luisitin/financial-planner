// modules/cashflow/shared-costs/view.js -- DOM only. Sharing costs as a couple (gap design #22), simple first
// (docs/OPTIONAL.md): the answer (what each puts in a month) and one sentence, three chips for how to split, then one card
// of quiet rows: which costs are shared (checkboxes, all checked by default), bills split with others (gap list next 60,
// item 17: roommates, friends, a trip; who owes whom, fewest payments, Mark as settled), what each keeps for themselves,
// how it is worked out. The couple's choices are a what-if (whatIfs.shareCosts), written only through store.update on a
// chip tap, the share box's change or the checkboxes' Save; the bills are plan.splitBills, written by a bill's Save or
// Remove and by Mark as settled, each with Undo. The bills row shows in every state the page draws; for one adult (and the
// empty plan) the hero is about it ("Split a bill with friends or roommates", a filled "Add a bill" that opens the row).
import { compute, answerFor, alarmFor, namesOf, METHOD_LABELS } from "./compute.js";
import { splitOf, readBill, nameFor, namesFrom, typedWho, storeKey, canon, orderPayments, statusWords, billSub, historyLine, owesWords, paidWords,
  savedWords, undoneWords, confirmWords, fixWords, dayWords, INTRO, SOLO, ME, SPLITS, SPLIT_LABELS } from "./split.js";
import { part, parts, choice, links } from "../../../core/ui/more.js";
import { nameIn, NameIn, NameOf, verbFor } from "../../../core/words.js";

// what the next draw says and keeps open: { at: "choice" | "costs" | "bills", text?, undo?, back? } (the green line names
// the new answer, R7; the part saved in stays open, R17; a bill's save, remove or a settle carries Undo)
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

  // bills split with others: one quiet row in every state (a single person with roommates is who splits most)
  const { spec: bills, startAdd } = billsPart(ctx, saved, { intro: d.ready });

  // one adult (the empty plan too): splitting the month as a couple needs two, so the hero is the bills row's, with one
  // filled "Add a bill" that opens the row at its add form; adding a partner is a quiet link (w1 fix P1)
  if (!d.ready) {
    const card = parts(ctx, bills);
    const openBills = () => {
      const el = [...(card?.querySelectorAll?.("details") ?? [])].find((x) => x.dataset?.part === "bills");
      if (!el) return;
      el.open = true;
      // with bills the add form comes after the list: it is what is brought into view and takes the focus (no keyboard)
      const form = startAdd();
      ui.reveal?.(form ?? el, { block: "start" });
      try {
        if (form) { form.setAttribute?.("tabindex", "-1"); form.focus?.({ preventScroll: true }); }
        else el.querySelector?.("summary")?.focus?.({ preventScroll: true });
      } catch { /* not focusable here */ }
    };
    box.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, SOLO.head), ui.h("p", { class: "lede" }, SOLO.say),
      ui.row(ui.button(SOLO.add, openBills)),
      ui.h("p", { class: "small muted", style: { margin: 0 } }, `${SOLO.partner} `,
        ui.h("a", { href: "#/household/people", style: { display: "inline-flex", alignItems: "center", minHeight: "44px" } }, SOLO.partnerLink))));
    box.append(card);
    return;
  }
  const [A, B] = d.people;
  const nA = names.a, nB = names.b;

  // nothing to split yet: what to do first, one filled way to start; the bills row under it
  if (d.case === "no-costs") {
    box.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, said.head), ui.h("p", { class: "lede" }, said.say),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/expenses" }, "Open Expenses"))));
    box.append(parts(ctx, bills));
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
  const card = parts(ctx, costsPart, bills, keepsPart, howPart);
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

/**
 * "Bills split with others" (gap list next 60, item 17): the part's spec for parts(). Inside: the green line, who owes whom
 * (fewest payments, each with an outlined "Mark as settled"), the bills since everyone was last square (Change, Remove),
 * "+ Add another bill" (the form open while the list is empty), and the settled history. Every change is one
 * store.update with Undo; a remove and a settle ask first. Returns { spec, startAdd } (startAdd: the add form, open; the
 * one-adult hero's button). `intro` false: the hero already says what the row is for.
 */
function billsPart(ctx, saved, { intro = true } = {}) {
  const { ui, fmt, plan, store } = ctx;
  const h = ui.h, today = fmt.today(), cur = plan.meta?.currency ?? "USD";
  const cash = (cents, two = false) => fmt.money((Number(cents) || 0) / 100, cur, "en-US", two || Math.round(cents) % 100 !== 0 ? 2 : 0);
  const s = splitOf(plan);
  const name = (k) => nameFor(plan, k, s.spelled);
  const label = (k) => NameIn(name(k));
  const list = Array.isArray(plan.splitBills) ? plan.splitBills : [];
  // a key as it is stored: a typed name keeps its spelling ("name:Sam"); someone in the plan by id, the first adult too, so
  // marking another adult "Me" later never moves a bill (storeKey; w1 fix M1)
  const stored = (k) => (k.startsWith("name:") ? typedWho(s.spelled[k] ?? k.slice(5)) : storeKey(plan, k) ?? k);
  const note = saved?.at === "bills" ? ui.notice("ok", saved.text, saved.undo ? { undo: saved.undo, undone: (r) => { pending = { at: "bills", text: ui.undoneWords(r, saved.back) }; } } : {}) : null;
  let adding = false, editing = null;   // this draw only: the add form behind "+ Add another bill", the bill being changed
  let addForm = null;                   // that add form while it is drawn after the list
  const body = h("div", { style: { display: "grid", gap: "12px" } });

  // one change, one store.update, one Undo; the green line names who owes whom after it (R7)
  const change = (kind, e, nextList, mutate) => {
    const after = splitOf({ ...plan, splitBills: nextList });
    const it = kind === "add" || kind === "change" ? after.entries.find((x) => x.id === e.id) ?? e : e;
    const afterName = (k) => nameFor(plan, k, after.spelled);
    const next = { at: "bills", text: savedWords(kind, it, after, afterName, cash), back: undoneWords(kind, it, afterName, cash) };
    pending = next;
    next.undo = ui.undoable(store, (q) => { q.splitBills = mutate(Array.isArray(q.splitBills) ? q.splitBills : []); });
  };
  const sameEntry = (e) => (x, i) => (e.id ? x?.id === e.id : i === e.at);
  const remove = (e) => {
    if (!ui.confirm(confirmWords("remove", e, name, cash))) return;
    change("remove", e, list.filter((x, i) => !sameEntry(e)(x, i)), (xs) => xs.filter((x, i) => !sameEntry(e)(x, i)));
  };
  const settle = (p) => {
    if (!ui.confirm(confirmWords("settle", p, name, cash))) return;
    const pay = { id: ui.uid(), kind: "paid", on: today, from: stored(p.from), to: stored(p.to), amount: p.cents / 100 };
    change("settle", p, [...list, pay], (xs) => [...xs, pay]);
  };

  // the form: what, how much, who shares it (a tick per person known, and names typed), who paid; the day and how it
  // splits under "More details (optional)", with a box per person for shares or exact amounts
  const billForm = (e) => {
    const raw = e ? list.find((x, i) => sameEntry(e)(x, i)) : null;
    const ticked = new Set(e ? e.among.map((y) => y.who) : s.last);
    const ticks = s.people.map((k) => ({ k, cb: h("input", { type: "checkbox", name: "among", value: k, checked: ticked.has(k) ? true : null }) }));
    const others = h("input", { type: "text", name: "others", autocomplete: "off", placeholder: "Names, with commas" });
    // the names typed: someone known already counts as ticked; a new name is someone new
    const typed = () => namesFrom(others.value).map((n) => ({ k: typedWho(n), n }));
    const fresh = () => typed().filter((x) => !s.people.includes(canon(plan, x.k)));
    // everyone in this bill now: the ticks in order, then the names typed (stored keys)
    const sharers = () => [...ticks.filter((t) => t.cb.checked).map((t) => ({ k: stored(t.k), n: label(t.k) })), ...typed().map((x) => ({ k: x.k, n: x.n }))]
      .filter((x, i, xs) => xs.findIndex((y) => canon(plan, y.k) === canon(plan, x.k)) === i);
    const fields = [
      { key: "what", label: "What was it", type: "text", placeholder: "e.g. Pizza night" },
      // not `required`: a required box may not sit in a shut part (docs/OPTIONAL.md R9); Save says "Type how much the bill was."
      { key: "amount", label: "How much", type: "money", min: 0.01 },
      { key: "paidBy", label: "Who paid", type: "select", options: s.people.map((k) => ({ value: k, label: label(k) })) },
      { key: "on", label: "Day", type: "date", more: true, help: "Empty: today." },
      { key: "split", label: "How it splits", type: "select", options: SPLITS.map((v) => ({ value: v, label: SPLIT_LABELS[v] })), more: true },
    ];
    const values = e ? { what: raw?.what ?? e.what, amount: e.cents / 100, paidBy: e.payer, on: e.on, split: e.split } : { paidBy: ME, split: "even" };
    const form = ui.form(fields, values, (v) => {
      form.querySelector(".notice.error")?.remove();
      const people = sharers();
      const byKey = (box) => Object.fromEntries(box.map((x) => [x.k, x.input.value]));
      const r = readBill(plan, { what: v.what, amount: v.amount, on: v.on || today, paidBy: stored(v.paidBy || ME), split: v.split, among: people.map((x) => x.k),
        shares: Object.fromEntries(Object.entries(byKey(perBoxes)).map(([k, t]) => [k, ui.readNumber(t)])),
        amounts: Object.fromEntries(Object.entries(byKey(perBoxes)).map(([k, t]) => [k, ui.moneyValue({ value: t })])) }, { cash });
      if (r.error) {
        const at = r.error === "amount" ? form.querySelector('[name="amount"]') : r.error === "among" ? others : perBoxes[0]?.input ?? null;
        form.querySelector(".form-actions")?.before(ui.notice("error", r.words));
        at?.focus?.();
        return false;
      }
      const id = e?.id ?? ui.uid();
      const bill = { id, ...r.bill };
      const at = e ? list.findIndex((x, i) => sameEntry(e)(x, i)) : -1;
      if (e) change("change", { ...e, id }, list.map((x, i) => (i === at ? bill : x)), (xs) => xs.map((x, i) => ((e.id ? x?.id === e.id : i === at) ? bill : x)));
      else change("add", { id }, [...list, bill], (xs) => [...xs, bill]);
    }, { submitLabel: e ? "Save the bill" : "Add the bill", onCancel: e || s.entries.length ? () => { adding = false; editing = null; draw(); } : null });
    // who shares it: above "Who paid", so a name typed there can be picked as the one who paid
    const paidSel = form.querySelector('[name="paidBy"]');
    const whoBox = h("div", { class: "field", role: "group", "aria-label": "Who shares it" }, h("span", { class: "field-label", "aria-hidden": "true" }, "Who shares it"),
      h("small", { class: "help" }, "Check who shares it, and type anyone else below."),
      ticks.map((t) => h("label", { class: "toggle-row" }, t.cb, h("span", { class: "toggle-text" }, label(t.k)))),
      h("label", { class: "field" }, h("span", { class: "field-label" }, "Add people"), others, h("small", { class: "help" }, "For example: Robin, Dana. Names stay in your plan only.")));
    paidSel?.closest(".field")?.before(whoBox);
    // a box per person for "By shares" or "Exact amounts", kept by person as the ticks change
    const per = h("div", { style: { display: "grid", gap: "12px" } });
    form.querySelector('[name="split"]')?.closest(".field")?.after(per);
    let perBoxes = [];
    const was = Object.fromEntries((e?.among ?? []).map((y) => [stored(y.who), e.split === "exact" ? y.cents / 100 : y.share]));
    const drawPer = () => {
      const how = form.querySelector('[name="split"]')?.value ?? "even";
      const keep = Object.fromEntries(perBoxes.map((x) => [x.k, x.input.value]));
      perBoxes = [];
      if (how === "shares" || how === "exact") for (const [i, x] of sharers().entries()) {
        const v = keep[x.k] ?? (e && e.split === how ? was[x.k] : null) ?? (how === "shares" ? 1 : "");
        const made = how === "shares" ? ui.numberBox({ name: `share-${i}`, value: v, min: 0 }) : ui.moneyBox({ name: `exact-${i}`, value: v, min: 0 });
        perBoxes.push({ k: x.k, input: made.input, el: ui.field(how === "shares" ? `Shares for ${nameIn(x.n)}` : `${NameOf(x.n)} part`, made.box) });
      }
      per.replaceChildren(...perBoxes.map((x) => x.el));
    };
    // who paid: everyone known and every name typed, the choice kept
    const drawPaid = () => {
      if (!paidSel) return;
      const keep = paidSel.value;
      const opts = [...s.people.map((k) => ({ v: k, n: label(k) })), ...fresh().map((x) => ({ v: x.k, n: x.n }))];
      paidSel.replaceChildren(...opts.map((o) => h("option", { value: o.v, selected: o.v === keep ? true : null }, o.n)));
      paidSel.value = opts.some((o) => o.v === keep) ? keep : ME;
    };
    for (const t of ticks) t.cb.addEventListener("change", drawPer);
    others.addEventListener("change", () => { drawPaid(); drawPer(); });
    form.querySelector('[name="split"]')?.addEventListener("change", drawPer);
    drawPer();
    return form;
  };

  const payRow = (p) => h("li", {},
    h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, owesWords(name(p.from), name(p.to))), h("span", { class: "rec-value" }, cash(p.cents))),
    h("div", { class: "rec-foot" }, ui.button("Mark as settled", () => settle(p), { class: "secondary small", "aria-label": `Mark as settled: ${owesWords(name(p.from), name(p.to))} ${cash(p.cents)}` })));
  const entryRow = (e) => {
    const title = e.kind === "paid" ? paidWords(name(e.from), name(e.to)) : e.what || "A bill";
    const sub = e.kind === "paid" ? [dayWords(e.on, today), "marked settled"].filter(Boolean).join(" · ") : billSub(e, name, { cash, today });
    return h("li", {},
      h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, title), h("span", { class: "rec-value" }, cash(e.cents))),
      editing === e ? billForm(e) : [
        e.ok ? h("div", { class: "rec-sub" }, sub) : null,
        h("div", { class: "rec-foot" }, h("span", { class: "rec-actions" },
          e.kind === "bill" ? ui.button("Change", () => { editing = e; adding = false; draw(); }, { class: "secondary small", "aria-label": `Change ${title}` }) : null,
          ui.button("Remove", () => remove(e), { class: "secondary small", "aria-label": `Remove ${title}` })))]);
  };

  function draw() {
    const out = [note, s.fix ? ui.notice("warn", fixWords(s.fix)) : null];
    if (!s.entries.length) out.push(intro ? h("p", { class: "muted small" }, INTRO) : null, billForm(null));
    else {
      const ps = orderPayments(s.payments);
      out.push(h("h3", {}, "Who owes whom"), ps.length ? h("ul", { class: "records" }, ps.map(payRow)) : h("p", {}, "Everyone is square."));
      const open = [...s.open].sort((a, b) => String(b.on).localeCompare(String(a.on)) || b.at - a.at);
      // a payment marked settled is listed with the bills until everyone is square: the heading says so (w1 fix P2)
      if (open.length) out.push(h("h3", {}, open.some((e) => e.kind === "paid") ? "Bills and payments" : "Bills"), h("ul", { class: "records" }, open.map(entryRow)));
      addForm = adding ? billForm(null) : null;
      out.push(addForm ?? ui.row(ui.button("+ Add another bill", () => { adding = true; editing = null; draw(); }, { class: "secondary" })));
      const past = [...s.settled].sort((a, b) => String(b.on).localeCompare(String(a.on)) || b.at - a.at);
      if (past.length) out.push(h("h3", {}, "Settled"), h("ul", { class: "muted small", style: { margin: 0, paddingLeft: "20px", display: "grid", gap: "4px" } }, past.map((e) => h("li", {}, historyLine(e, name, { cash, today })))));
    }
    body.replaceChildren(...out.filter(Boolean));
  }
  draw();

  // the one-adult hero's "Add a bill": the add form, open (with an empty list it is open already, right under the title:
  // null); returns the form when it waits after the list
  const startAdd = () => {
    if (!s.entries.length) return null;
    if (!adding) { adding = true; editing = null; draw(); }
    return addForm;
  };
  return {
    spec: {
      id: "bills", kind: "own", title: "Bills split with others", says: statusWords(s, name, cash), fix: s.fix,
      open: saved?.at === "bills" || undefined, holds: ["what", "amount", "among", "others", "paidBy", "on", "split"], body,
    },
    startAdd,
  };
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
