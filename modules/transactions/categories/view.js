// modules/transactions/categories/view.js -- DOM only. The category list grouped by kind, tap to rename / change icon /
// hide, add your own, and a count of how many transactions use each. Gap list next 60 #16 (2026-11-16): each group shows
// its first six, the rest one quiet tap away ("N more categories"); a category may sit inside another one (one level),
// set under the form's "More details (optional)", asked first and with Undo; it is listed right under that one. One quiet
// row, "Combine two categories": everything filed under one moves to another in one save, with a count, a question and Undo.
import { compute, KINDS, slug, parentsOf, parentChoices, childrenOf, nestRefused, nestWords, readAs, addedInsideWords, onTheirOwnWords, nowOnTheirOwnWords, holdsOthersWords, unnest,
  INSIDE_HELP, ON_ITS_OWN, MERGE_LEAD, mergeRefused, mergeWords, mergeCategories } from "./compute.js";
import { dropCategory, splitsUsing, splitLossWords, splitBackWords } from "../ledger/compute.js";
import { rest, parts } from "../../../core/ui/more.js";

const ICONS = ["📦", "🏠", "💡", "🛒", "🚗", "🛡️", "🩺", "💳", "🧒", "📱", "🧾", "📺", "🍽️", "🎉", "🛍️", "✈️", "🎁", "💇", "🐾", "💼", "🎯", "🛠️", "🏘️", "🏛️", "📈", "💵", "🔁", "🎓", "🏋️", "🍺", "☕", "🚌", "🏥", "🧴", "🎮", "📚", "🌳", "🏦"];
/** The choices of the box "Inside another category" for a category of `kind` (`id`: null for a new one). */
const parentOptions = (plan, id, kind) => [{ value: "", label: ON_ITS_OWN }, ...parentChoices(plan, { id, kind }).map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))];
/** The form's boxes. The last, "Inside another category", waits under "More details (optional)"; a category that has others
 * inside it has none (one level only). */
const FIELDS = (plan, editing) => [
  { key: "label", label: "Name", type: "text", required: true, placeholder: "e.g. Coffee" },
  { key: "icon", label: "Icon", type: "select", options: ICONS },
  { key: "kind", label: "Kind", type: "select", options: Object.entries(KINDS).map(([value, label]) => ({ value, label })) },
  { key: "essential", label: "Counts as a must-pay bill", type: "checkbox", help: "for the emergency-fund target; spending only" },
  ...(editing && childrenOf(plan, editing.id).length ? [] : [{ key: "parent", label: "Inside another category", type: "select", more: true, help: INSIDE_HELP,
    options: parentOptions(plan, editing?.id ?? null, editing?.kind ?? "expense") }]),
];
/** The part ids of the groups' "N more categories" (stable names, never a title). */
const GROUP_IDS = { expense: "spending", income: "income", transfer: "transfer" };

// the confirmation shown on the next render (the shell re-renders after store.update; stress test T4):
// { text, undo?, undone?, part? } -- the green line, an Undo with the words after it, and the part it was saved in (it stays
// open there, R17)
let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan);
  const links = parentsOf(plan);
  const labelOf = (id) => (id ? d.categories.find((c) => c.id === id)?.label ?? id : "");
  let said = pending; pending = null;
  let editing = null;

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Categories"),
    ui.h("p", { class: "lede" }, "Every transaction gets one category. The list starts with the same categories as the Expenses and Income pages; rename or hide the ones you do not use and add your own."),
    d.total ? ui.h("p", { class: "muted small" }, `${d.total} transactions on file, ${d.uncategorised} still uncategorized.`) : null,
  ));

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  // the green line, with its Undo when the save can be taken back (a category put inside another, taken out or moved)
  const okLine = (s) => ui.notice("ok", s.text, s.undo ? { undo: s.undo, undone: (r) => { pending = { text: ui.undoneWords(r, s.undone), ...(s.part ? { part: s.part } : {}) }; } } : {});
  // The add form folds behind a button; tapping a category opens it filled in (design log 2026-09-15).
  let showForm = false;
  // one filled button on the screen: while this form is open, the Combine part's button is outlined (critic P6)
  let mergeSave = null;
  const oneFilled = () => { if (mergeSave) mergeSave.classList.toggle("secondary", !!(showForm || editing)); };
  const drawBody = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) {
      if (said && !said.part) { formHost.append(okLine(said)); said = null; }
      formHost.append(ui.button("+ Add a category", () => { showForm = true; drawForm(); }, { class: "secondary" }));
      return;
    }
    const values = editing ? { ...editing, parent: links.get(editing.id) ?? "" } : { icon: "📦", kind: "expense", essential: false, parent: "" };
    let f = null;
    f = ui.form(FIELDS(plan, editing), values, (v) => {
      const label = v.label.trim(); if (!label) return;
      // the box is there unless the category has others inside it (then it stays on its own)
      const hasBox = v.parent !== undefined, parentNow = hasBox ? v.parent || "" : null, was = editing ? links.get(editing.id) ?? "" : "";
      const no = hasBox ? nestRefused(plan, { id: editing?.id ?? null, parent: parentNow, kind: v.kind }) : null;
      if (no) return ui.fieldError(f.querySelector('[name="parent"]'), no);
      const moved = !!editing && hasBox && parentNow !== was;
      // a category of yours inside Taxes, Debt or Rent or mortgage (or a dividend one) changes what the spending guesses (or
      // Dividends) count, so that question says so instead of "every total stays the same" (critic M4)
      const words = moved ? nestWords(label, labelOf(was), labelOf(parentNow), readAs(plan, editing.id, parentNow)) : null;
      if (moved && !ui.confirm(words.ask)) return false;
      // a category whose kind changes: the ones inside it stand on their own (a category and those inside it are one kind)
      const kids = editing && v.kind !== editing.kind ? childrenOf(plan, editing.id).map((c) => c.label) : [];
      const id0 = editing?.id ?? null;
      const write = (p) => {
        p.categories = p.categories ?? [];
        if (id0) {
          const i = p.categories.findIndex((c) => c.id === id0);
          const entry = { ...(i >= 0 ? p.categories[i] : {}), id: id0, label, icon: v.icon, kind: v.kind, essential: !!v.essential };
          if (hasBox) { if (parentNow) entry.parent = parentNow; else delete entry.parent; }
          if (i >= 0) p.categories[i] = entry; else p.categories.push(entry);
          if (kids.length) unnest(p, id0);
        } else {
          let id = slug(label); const taken = new Set(compute(p).categories.map((c) => c.id)); let n = 2; while (taken.has(id)) id = `${slug(label)}-${n++}`;
          p.categories.push({ id, label, icon: v.icon, kind: v.kind, essential: !!v.essential, ...(parentNow ? { parent: parentNow } : {}) });
        }
      };
      const text = !editing ? (parentNow ? addedInsideWords(label, labelOf(parentNow)) : `${label} added.`) : label !== editing.label ? `${editing.label} is now ${label}.` : `${label} saved.`;
      showForm = false; editing = null;
      if (moved) { const undo = ui.undoable(store, write); pending = { text: words.done, undo, undone: words.undone }; }
      else { pending = { text: kids.length ? `${text} ${nowOnTheirOwnWords(kids)}` : text }; store.update(write); }
    }, { submitLabel: editing ? "Save changes" : "Add category", resetAfter: !editing, onCancel: () => { editing = null; showForm = false; drawForm(); } });
    // the box lists the categories of the kind picked: a new income category can go inside an income one (critic M5); a
    // pick of another kind goes back to "No, it stands on its own"
    const kindBox = f.querySelector('[name="kind"]'), parentBox = f.querySelector('[name="parent"]'), me = editing?.id ?? null;
    if (kindBox && parentBox) kindBox.addEventListener("change", () => {
      const keep = parentBox.value, opts = parentOptions(plan, me, kindBox.value);
      parentBox.replaceChildren(...opts.map((o) => ui.h("option", { value: o.value }, o.label)));
      parentBox.value = opts.some((o) => o.value === keep) ? keep : "";
    });
    // a category with others inside it has no such box: one line says why (critic P5)
    const holds = editing ? childrenOf(plan, editing.id).map((c) => c.label) : [];
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.label}` : "Add a category"),
      f,
      holds.length ? ui.h("p", { class: "muted small", style: { marginTop: "12px" } }, holdsOthersWords(editing.label, holds)) : null,
      editing ? ui.h("p", { style: { marginTop: "12px" } },
        editing.hidden
          ? ui.button("Show it again", () => { const id = editing.id; pending = { text: `${editing.label} is back in the list.` }; editing = null; store.update((p) => { const c = (p.categories ?? []).find((x) => x.id === id); if (c) delete c.hidden; }); }, { class: "secondary" })
          : ui.button(editing.builtIn ? `Hide ${editing.label}` : `Remove ${editing.label}`, () => {
            // a split purchase with a part here stops being split: said before, and again in the green line (gap #24);
            // the categories inside it stand on their own: said before and after (gap next-60 #16)
            const nSplit = splitsUsing(plan, editing.id), loss = splitLossWords(nSplit);
            const kids = childrenOf(plan, editing.id).map((c) => c.label);
            // with others inside it the question says first what is hidden or removed (critic P3)
            const ask = [kids.length ? `${editing.builtIn ? "Hide" : "Remove"} ${editing.label}?` : "", editing.count ? `${editing.count === 1 ? `1 transaction uses ${editing.label}. It` : `${editing.count} transactions use ${editing.label}. They`} will become uncategorized.${loss}` : "", onTheirOwnWords(kids)].filter(Boolean);
            if (ask.length && !ui.confirm(`${ask.join(" ")} Continue?`)) return;
            const id = editing.id, builtIn = editing.builtIn;
            pending = { text: `${builtIn ? `${editing.label} hidden. Show it again under Hidden.` : `${editing.label} removed.`}${splitBackWords(nSplit)}${kids.length ? ` ${nowOnTheirOwnWords(kids)}` : ""}` };
            editing = null;
            store.update((p) => {
              p.categories = p.categories ?? [];
              for (const t of p.transactions ?? []) dropCategory(t, id);   // and off the parts of a split purchase (gap #24)
              unnest(p, id);
              if (builtIn) { const c = p.categories.find((x) => x.id === id); if (c) c.hidden = true; else p.categories.push({ id, hidden: true }); }
              else p.categories = p.categories.filter((x) => x.id !== id);
            });
          }, { class: "danger" })) : null,
    ));
  };
  const drawForm = () => { drawBody(); oneFilled(); };
  drawForm();

  const open = (c) => { editing = c; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const row = (c) => {
    const inside = links.get(c.id);
    const bits = [inside ? `Inside ${labelOf(inside)}` : "", c.count ? `${c.count} transaction${c.count === 1 ? "" : "s"}, ${fmt.money(Math.abs(c.total), cur)}` : ""].filter(Boolean);
    // a category inside another is set in under it, so the two read as one group (critic P4)
    return ui.h("li", { role: "button", tabindex: "0", style: inside ? { cursor: "pointer", marginLeft: "28px" } : { cursor: "pointer" },
      onClick: () => open(c),
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "ic" }, c.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.label, c.builtIn ? null : ui.h("span", { class: "pill" }, "yours"), c.essential && c.kind === "expense" ? ui.h("span", { class: "pill" }, "must pay") : null),
        bits.length ? ui.h("div", { class: "d" }, bits.join(" · ")) : null),
      ui.h("span", { class: "st muted" }, "Edit ›"));
  };
  // each group: its first six, then "N more categories" (a category inside another right under it)
  for (const [kind, title] of Object.entries(KINDS)) {
    const rows = d.categories.filter((c) => c.kind === kind && !c.hidden);
    if (!rows.length) continue;
    root.append(ui.card(title, ...rest(ctx, { id: GROUP_IDS[kind], items: rows, row, noun: "categories", one: "category", list: "page-list" })));
  }
  const hidden = d.categories.filter((c) => c.hidden);
  if (hidden.length) root.append(ui.card("Hidden",
    ui.h("ul", { class: "page-list" }, hidden.map((c) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer", opacity: 0.6 },
      onClick: () => open(c) },
      ui.h("span", { class: "ic" }, c.icon), ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.label)), ui.h("span", { class: "st muted" }, "Show ›")))),
  ));

  formCard.append(formHost);
  root.append(formCard);
  // offered once something is filed under a category: a bank line, a rule, an envelope, a bill or a category of your own
  // (on an empty plan, combining would only hide one; the first view stays as short as it was)
  const filed = (plan.transactions ?? []).length || (plan.rules ?? []).length || (plan.budgets ?? []).length || (plan.expenses ?? []).length || d.custom;
  if (filed || said?.part === "merge") {
    const host = ui.h("div", {}, parts(ctx, mergePart(ctx, d, said?.part === "merge" ? said : null)));
    root.append(host);
    mergeSave = Array.from(host.querySelectorAll("button")).find((b) => b.getAttribute("type") === "submit") ?? null;   // a NodeList in a browser
    oneFilled();
  }
}

/**
 * "Combine two categories" (gap list next 60 #16): two picks and the part's own Save. The count (or why not) is said under
 * the picks as they change (nothing is saved until "Combine them"); the save asks first and comes back with Undo, in the
 * part, which stays open (R17). Two picks, no figure to type: its title is pinned (qa/first-view-lib.mjs PINNED_TITLES).
 */
function mergePart(ctx, d, said) {
  const { ui, store, plan } = ctx;
  const all = d.categories.filter((c) => !c.hidden && c.kind !== "transfer"), kindOf = new Map(all.map((c) => [c.id, c.kind]));
  const optionsOf = (list) => [{ value: "", label: "Pick one..." }, ...list.map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))];
  const options = optionsOf(all);
  // what a picker holds: "Pick one...", then, while it lists both kinds, a heading for each ("Spending", "Income": KINDS) over its
  // own categories (the first picker listed all of them mixed; recheck leftover y2 (a), 2026-11-16); a list of one kind, bare. A
  // stored kind that is neither (malformed data; the page cannot make one) goes under "Other kinds", last, never dropped (fix round,
  // F1; not "Other", the name of a built-in income category in the list above it)
  const drawn = (list) => {
    const opt = (o) => ui.h("option", { value: o.value }, o.label);
    const groups = Object.keys(KINDS).map((k) => [KINDS[k], list.filter((c) => c.kind === k)])
      .concat([["Other kinds", list.filter((c) => !Object.hasOwn(KINDS, c.kind))]]).filter(([, cs]) => cs.length);
    if (groups.length < 2) return optionsOf(list).map(opt);
    return [opt(optionsOf([])[0]), ...groups.map(([label, cs]) => ui.h("optgroup", { label }, optionsOf(cs).slice(1).map(opt)))];
  };
  // the count (or why not), right above "Combine them" so it is read before the tap; nothing while a pick is missing
  const line = ui.h("p", { class: "small", "aria-live": "polite", hidden: true });
  let f = null;
  const pick = () => ({ from: f?.querySelector('[name="from"]')?.value ?? "", to: f?.querySelector('[name="to"]')?.value ?? "" });
  const say = () => {
    const { from, to } = pick(), text = !from || !to ? "" : mergeRefused(plan, from, to) ?? mergeWords(plan, from, to).line;
    line.textContent = text;
    if (text) line.removeAttribute("hidden"); else line.setAttribute("hidden", "");
  };
  f = ui.form([
    { key: "from", label: "Move everything from", type: "select", options },
    { key: "to", label: "Into", type: "select", options },
  ], { from: "", to: "" }, (v) => {
    const no = mergeRefused(plan, v.from, v.to);
    if (no) return ui.fieldError(f.querySelector(`[name="${v.from ? "to" : "from"}"]`), no);
    const words = mergeWords(plan, v.from, v.to);
    if (!ui.confirm(words.ask)) return false;
    const undo = ui.undoable(store, (dr) => { mergeCategories(dr, { from: v.from, to: v.to }); });
    pending = { part: "merge", text: words.done, undo, undone: words.undone };
  }, { submitLabel: "Combine them" });
  // once the first is picked, "Into" lists only the others of its kind (spending or income; critic P1); a pick there that no
  // longer fits goes back to "Pick one..."
  const fromBox = f.querySelector('[name="from"]'), toBox = f.querySelector('[name="to"]');
  for (const box of [fromBox, toBox]) box?.replaceChildren(...drawn(all));
  if (fromBox && toBox) fromBox.addEventListener("change", () => {
    const k = kindOf.get(fromBox.value), keep = toBox.value, list = k ? all.filter((c) => c.kind === k && c.id !== fromBox.value) : all;
    toBox.replaceChildren(...drawn(list));
    toBox.value = list.some((c) => c.id === keep) ? keep : "";
  });
  for (const box of f.querySelectorAll("select")) box.addEventListener("change", say);
  const actions = f.querySelector(".form-actions");
  if (actions) actions.before(line);
  const okLine = said ? ui.notice("ok", said.text, said.undo ? { undo: said.undo, undone: (r) => { pending = { part: "merge", text: ui.undoneWords(r, said.undone) }; } } : {}) : null;
  return { id: "merge", kind: "own", title: "Combine two categories", open: !!said, holds: ["from", "to"], body: [ui.h("p", { class: "muted small" }, MERGE_LEAD), okLine, f, actions ? null : line] };
}
