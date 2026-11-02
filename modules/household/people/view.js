// modules/household/people/view.js -- DOM only. A list of people you tap to edit, one form,
// and the household's tax filing status and state.
import { compute, ROLES, FILING_STATUSES, US_STATES, tiedTo, removePerson } from "./compute.js";

const FIELDS = (assumptions) => [
  { key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Ana" },
  { key: "role", label: "Who is this", type: "select", options: Object.entries(ROLES).map(([value, r]) => ({ value, label: r.label })) },
  { key: "birthDate", label: "Birth date", type: "date", help: "sets the ages the plan uses" },
  { key: "retirementAge", label: "Retirement age", type: "number", min: 18, max: 100, step: "1", help: `leave blank to use the plan's assumption (${assumptions.retirementAge ?? 65})` },
  { key: "lifeExpectancy", label: "Plan to age", type: "number", min: 18, max: 120, step: "1", help: `how long the money must last; blank means ${assumptions.planEndAge ?? 95}` },
];

// The shell re-renders after store.update, so a confirmation waits here for the next render
// (design log 2026-09-15). { card: "people" | "taxes", text, undo? (the plan as it was: an Undo button puts it back) }
let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta?.currency;
  const d = compute(plan, { today: fmt.today() });
  let editing = null;
  let removing = null;   // the person whose Remove was tapped: the form shows what goes with them instead
  const flash = (host) => {
    if (!pending) return;
    const n = ui.notice("ok", pending.text);
    const was = pending.undo;
    // a removal can be taken back while its message shows (until the next change re-draws the page)
    if (was) n.append(" ", ui.button("Undo", () => { pending = { card: "people", text: "Put back as it was." }; store.update((d) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, structuredClone(was)); }); }, { class: "secondary small" }));
    else setTimeout(() => n.remove(), 4000);
    host.append(n); pending = null;
  };

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Who is in this plan?"),
      ui.h("p", { class: "lede" }, "Add yourself first, then a partner and anyone who depends on you. Birth dates set the ages the plan uses for retirement, insurance and how long the money needs to last."),
      ui.h("p", { class: "muted small" }, "Only a name and a role are required. You can fill in the rest later."),
    ));
  } else {
    const me = d.self ?? d.people.find((p) => p.role !== "dependent") ?? d.people[0];
    root.append(ui.card(null, ui.row(
      ui.stat("People", String(d.count), [d.adults ? `${d.adults} adult${d.adults === 1 ? "" : "s"}` : null, d.dependents ? `${d.dependents} dependent${d.dependents === 1 ? "" : "s"}` : null].filter(Boolean).join(", ") || " "),
      me && me.yearsToRetirement !== null ? ui.stat(me.retired ? `${me.name} is retired` : `Years until ${me.name} retires`, me.retired ? "now" : String(me.yearsToRetirement), me.retirementDate ? `at ${me.retirementAge}, in ${me.retirementDate.slice(0, 4)}` : null) : null,
      d.horizonYears !== null ? ui.stat("The plan must last", `${d.horizonYears} years`, "until the last adult reaches their plan age") : null,
    )));
  }
  for (const w of d.warnings) {
    if (w.includes("Change it")) {
      const [before, after] = w.split("Change it");
      root.append(ui.h("div", { class: "notice warn" }, before, ui.h("a", { href: "#taxes", onClick: (e) => { e.preventDefault(); taxCard.scrollIntoView({ behavior: "smooth", block: "start" }); taxCard.querySelector("select")?.focus(); } }, "Change it"), after));
    } else root.append(ui.notice("warn", w));
  }

  const formHost = ui.h("div");
  const formCard = ui.card(null);
  let showForm = d.count === 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (removing) { formHost.append(removePanel(removing)); return; }
    if (!showForm && !editing) {
      formHost.append(ui.button("+ Add another person", () => { showForm = true; drawForm(); }, { class: "secondary" }));
      return;
    }
    const values = editing ? { ...editing } : { role: d.count === 0 ? "self" : (d.self ? "partner" : "self") };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.name}` : "Add a person"),
      ui.form(FIELDS(plan.assumptions ?? {}), values, (v) => {
        const clean = { name: v.name.trim(), role: v.role, birthDate: v.birthDate || "", retirementAge: v.retirementAge ?? null, lifeExpectancy: v.lifeExpectancy ?? null };
        if (!clean.name) return;
        pending = { card: "people", text: editing ? "Changes saved." : `${clean.name} added.` };
        store.update((p) => {
          p.household = p.household ?? { people: [], filingStatus: "single", state: "" };
          p.household.people = p.household.people ?? [];
          if (editing) { const i = p.household.people.findIndex((x) => x.id === editing.id); if (i >= 0) p.household.people[i] = { ...p.household.people[i], ...clean }; }
          else p.household.people.push({ id: ui.uid(), ...clean });
        });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add person", resetAfter: !editing, onCancel: (editing || d.count > 0) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => { removing = editing; editing = null; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, { class: "danger" })) : null,
    ));
  };
  // Remove used to drop only the person, so their pay and accounts went on counting as the household's without a word.
  // Now it lists what is theirs and asks once: take it out too, or keep it as the household's.
  const removePanel = (person) => {
    const t = tiedTo(plan, person.id);
    const name = person.name;
    // their Social Security and their own papers go either way (`always`): only the rest can be kept, and the message
    // counts only what was kept (review 2026-11-02)
    const keepable = t.items.filter((i) => !i.always), always = t.items.filter((i) => i.always);
    const listed = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
    const finish = (keep) => {
      const n = t.items.length, k = keepable.length;
      const what = n === 1 ? t.items[0].name : `${n} things that were ${name}'s`;
      const text = !n ? `${name} removed.` : keep ? `${name} removed. ${k === 1 ? `${keepable[0].name} now counts` : `${k} things that were ${name}'s now count`} as the household's.${always.length ? ` ${listed(always.map((i) => i.name))} went with ${name}.` : ""}` : `${name} removed, with ${what}.`;
      pending = { card: "people", text: text + (t.leavesOneAdult && t.married ? " Taxes are now Single." : ""), undo: structuredClone(plan) };
      removing = null;
      store.update((p) => { removePerson(p, person.id, { keep }); });
    };
    const amount = (i) => i.amount === null ? null : i.every === "a month" ? `${fmt.money(i.amount, cur)} a month` : i.every === "one time" ? `${fmt.money(i.amount, cur)} one time` : i.every === "owed" ? `${fmt.money(i.amount, cur)} owed` : i.every === "cover" ? `${fmt.money(i.amount, cur)} cover` : fmt.money(i.amount, cur);
    const kids = t.dependents ? (plan.household?.people ?? []).filter((x) => x.id !== person.id && x.role === "dependent").map((x) => x.name) : [];
    return ui.h("div", { class: "remove-person", style: { marginTop: "20px" } },
      ui.h("h2", {}, `Remove ${name} from the plan?`),
      t.items.length ? [
        keepable.length ? [ui.h("p", {}, `These are ${name}'s in the plan:`),
          ui.h("ul", { class: "page-list" }, keepable.map((i) => ui.h("li", {},
            ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, i.name), ui.h("div", { class: "d" }, i.where)),
            amount(i) ? ui.h("span", { class: "st amount" }, amount(i)) : null))),
          ui.h("p", { class: "muted small" }, `If ${name} has left the household, take these out too. If they stay with you (a joint account, an inherited one), keep them as the household's.`)] : null,
        always.length ? [ui.h("p", {}, `These go with ${name} either way:`),
          ui.h("ul", { class: "page-list" }, always.map((i) => ui.h("li", {},
            ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, i.name), ui.h("div", { class: "d" }, i.where)),
            amount(i) ? ui.h("span", { class: "st amount" }, amount(i)) : null)))] : null,
      ] : ui.h("p", { class: "muted" }, `Nothing else in the plan is tied to ${name}.`),
      t.leavesOneAdult && t.married ? ui.notice("warn", `Taxes are set to ${FILING_STATUSES[plan.household.filingStatus]}. With one adult left the plan will use Single.${kids.length ? ` With ${kids.join(" and ")} at home you may file as head of household, which costs less tax: pick it under Taxes below.` : " Change it under Taxes below if you still file together this year."}`) : null,
      t.named.length ? ui.h("div", { class: "notice warn" }, `${name} is still named as a beneficiary on ${t.named.map((x) => x.name).join(" and ")}. Removing ${name} here does not change that: only the bank or insurer can. `, ui.h("a", { href: t.named[0].href }, "Beneficiary audit")) : null,
      ui.h("div", { class: "row", style: { marginTop: "12px" } },
        keepable.length
          ? [ui.button(`Remove ${name} and ${t.items.length === 1 ? "it" : `these ${t.items.length}`}`, () => finish(false), { class: "danger" }),
             ui.button(`Remove ${name}, keep ${keepable.length === 1 ? "it" : always.length ? `the ${keepable.length} above` : "these"} as the household's`, () => finish(true), { class: "secondary" })]
          : ui.button(`Remove ${name}${t.items.length ? ` and ${t.items.length === 1 ? "it" : `these ${t.items.length}`}` : ""}`, () => finish(false), { class: "danger" }),
        ui.button("Cancel", () => { removing = null; drawForm(); }, { class: "secondary" })),
    );
  };
  drawForm();

  if (d.count > 0) {
    const sub = (p) => {
      const bits = [];
      if (p.age === null) bits.push("no birth date yet"); else if (p.age < 0) bits.push("not born yet"); else bits.push(`age ${p.age}`);
      if (p.role !== "dependent" && p.retirementDate) bits.push(p.retired ? "retired" : `retires at ${p.retirementAge} (${p.retirementDate.slice(0, 4)})`);
      return bits.join(" · ");
    };
    root.append(ui.card("Household",
      ui.h("ul", { class: "page-list" }, d.people.map((p) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
        onClick: () => { editing = plan.household.people.find((x) => x.id === p.id); showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, (ROLES[p.role] ?? ROLES.dependent).icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, p.name, " ", ui.h("span", { class: "pill" }, (ROLES[p.role] ?? ROLES.dependent).label)), ui.h("div", { class: "d" }, sub(p))),
        ui.h("span", { class: "st muted" }, "Edit ›"),
      ))),
      ui.h("p", { class: "muted small" }, "Tap a person to change their details."),
    ));
  }

  // With people on file the add form (folded or open) lives inside the Household card.
  const peopleOut = ui.h("div");
  if (pending?.card === "people") flash(peopleOut);
  const host = d.count > 0 ? root.lastElementChild : formCard;
  host.append(peopleOut, formHost);
  if (host === formCard) root.append(formCard);

  const filing = ui.select(Object.entries(FILING_STATUSES).map(([value, label]) => ({ value, label })), d.filingStatus, { onChange: (e) => { pending = { card: "taxes", text: "Saved." }; store.update((p) => { p.household = p.household ?? { people: [], filingStatus: "single", state: "" }; p.household.filingStatus = e.target.value; }); } });
  const state = ui.select([{ value: "", label: "Choose a state" }, ...US_STATES.map((s) => ({ value: s, label: s }))], d.state, { onChange: (e) => { pending = { card: "taxes", text: "Saved." }; store.update((p) => { p.household = p.household ?? { people: [], filingStatus: "single", state: "" }; p.household.state = e.target.value; }); } });
  const taxOut = ui.h("div");
  const taxCard = ui.card("Taxes",
    ui.h("p", { class: "muted small" }, "Used by the tax pages later. Pick what you put on your federal return."),
    ui.h("div", { class: "form" }, ui.field("How you file your taxes", filing), ui.field("State you live in", state, "for state income tax")),
    taxOut,
  );
  taxCard.id = "taxes";
  if (pending?.card === "taxes") flash(taxOut);
  root.append(taxCard);
}
