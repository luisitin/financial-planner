// modules/estate/legacy/view.js -- DOM only. Whom you want to leave what, the total the plan should keep
// for it, whether the plan does, and what each lever would have to be if not. Runs on the PC when connected.
import { KINDS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.lg-root .lg-list { list-style: none; margin: 0; padding: 0; }
.lg-root .lg-list li { display: flex; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.lg-root .lg-list li:last-child { border-bottom: 0; }
.lg-root .lg-body { flex: 1; min-width: 0; }
.lg-root .lg-t { font-weight: 600; }
.lg-root .lg-d { color: var(--text-2); font-size: var(--fs-sm); }
.lg-root .lg-v { flex: none; white-space: nowrap; }
.lg-root .lg-verdict { font-weight: 650; margin: 6px 0; }
.lg-root .lg-verdict.ok { color: var(--ok); } .lg-root .lg-verdict.bad { color: var(--warn); }
.lg-root .lg-levers { list-style: none; margin: 0; padding: 0; }
.lg-root .lg-levers li { padding: 10px 0; border-bottom: 1px solid var(--line); }
.lg-root .lg-levers li:last-child { border-bottom: 0; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const root = ui.h("div", { class: "lg-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const host = ui.h("div");
  root.append(host);
  host.append(ui.notice("info", "Checking what your plan leaves..."));
  ctx.computeRemote("estate/legacy", { today: fmt.today() }).then(draw, (e) => host.replaceChildren(ui.notice("error", `Legacy goals could not be worked out: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));

  function draw(d) {
    host.replaceChildren();
    let editing = null;
    if (!d.bequests.length) host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What you want to leave"),
      ui.h("p", { class: "lede" }, "Money for the children, a grandchild's education, a cause you care about. Write down what you would like to leave and to whom, in today's money, and the plan will aim to still have it at the end."),
      ui.h("p", { class: "muted small" }, "This is a planning goal, not a will: the will (or the beneficiary forms) is what actually passes it on.")));
    else {
      host.append(ui.card(null, ui.row(
        ui.stat("You want to leave", money(d.total), [d.people ? `${money(d.people)} to people` : null, d.charity ? `${money(d.charity)} to causes` : null].filter(Boolean).join(", ")),
        ui.stat("The plan should keep", money(d.target), d.includeHome && d.home ? `in savings, after ${money(d.home)} from the home` : "in savings, in today's money"),
      )));
      if (d.ready) {
        const verdict = d.meets ? `Your plan leaves about ${money(Math.round(d.endReal / 1000) * 1000)} in ${d.endYear}: enough.` : d.success ? `Your plan leaves about ${money(Math.round(d.endReal / 1000) * 1000)} in ${d.endYear}: ${money(d.gap)} short.` : "As it stands the money runs out before the end of the plan, before any legacy.";
        host.append(ui.card("Does the plan leave it?", ui.h("p", { class: `lg-verdict ${d.meets ? "ok" : "bad"}` }, verdict),
          d.levers && !d.meets ? ui.h("ul", { class: "lg-levers" }, d.levers.filter((l) => l.status !== "same").slice(0, 5).map((l) => ui.h("li", {}, ui.h("div", { style: { fontWeight: 600 } }, `${l.icon} ${l.title}`), ui.h("div", { class: "lg-d" }, l.sentence)))) : null,
          d.levers && d.meets && d.levers.find((l) => l.id === "spending" && l.status === "room") ? ui.h("p", { class: "lg-d" }, `While still leaving it, you could spend ${d.levers.find((l) => l.id === "spending").sentence.replace(/^Up/, "up")}`) : null,
          ui.row(ui.h("a", { class: "btn secondary", href: "#/scenarios/goal-seek" }, "Goal seek"))));
      } else host.append(ui.card(null, ui.h("p", { class: "muted" }, `To check it against your plan, it needs: ${d.missing.join("; ")}.`)));
      const list = ui.h("ul", { class: "lg-list" }, d.bequests.map((b) => ui.h("li", { role: "button", tabindex: "0", onClick: () => { editing = (plan.estate.legacy.bequests ?? []).find((y) => y.id === b.id); drawForm(true); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("div", { class: "lg-body" }, ui.h("div", { class: "lg-t" }, b.to || "Someone"), ui.h("div", { class: "lg-d" }, [b.kindLabel, b.notes].filter(Boolean).join(" · "))),
        ui.h("div", { class: "lg-v" }, money(b.amount)))));
      host.append(ui.card("To whom", ui.h("p", { class: "muted small" }, "Tap one to change it."), list));
    }

    const formHost = ui.h("div");
    const drawForm = (open = !d.bequests.length) => {
      formHost.innerHTML = "";
      if (!open && !editing) { formHost.append(ui.button("+ Add someone", () => drawForm(true), { class: "secondary" })); return; }
      formHost.append(...[ui.h("h2", {}, editing ? `Change ${editing.to}` : "Add someone"), ui.form([
        { key: "to", label: "To whom", type: "text", required: true, placeholder: "e.g. Cy, or a food bank" },
        { key: "kind", label: "Who", type: "select", options: Object.entries(KINDS).map(([value, label]) => ({ value, label })) },
        { key: "amount", label: "Amount, in today's money", type: "money", min: 0 },
        { key: "notes", label: "Notes", type: "text", placeholder: "e.g. for a first home" },
      ], editing ? { ...editing } : { kind: "person" }, (v) => {
        const clean = { to: v.to.trim(), kind: v.kind, amount: v.amount ?? 0, notes: (v.notes ?? "").trim() };
        if (!clean.to) return;
        pending = editing ? "Changes saved." : `${clean.to} added.`;
        const id = editing?.id;
        store.update((p) => {
          p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.legacy = p.estate.legacy ?? { bequests: [] }; p.estate.legacy.bequests = p.estate.legacy.bequests ?? [];
          if (id) { const i = p.estate.legacy.bequests.findIndex((x) => x.id === id); if (i >= 0) p.estate.legacy.bequests[i] = { ...p.estate.legacy.bequests[i], ...clean }; }
          else p.estate.legacy.bequests.push({ id: ui.uid(), ...clean });
        });
      }, { submitLabel: editing ? "Save changes" : "Add", resetAfter: !editing, onCancel: (editing || d.bequests.length) ? () => { editing = null; drawForm(false); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.to}`, () => {
        if (!ui.confirm(`Remove ${editing.to}?`)) return;
        const id = editing.id, name = editing.to; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.estate.legacy.bequests = (p.estate.legacy.bequests ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null].filter(Boolean));
    };
    drawForm();
    host.append(ui.card(null, out, formHost));
    if (d.home > 0 || (plan.accounts ?? []).some((a) => a.type === "property")) {
      host.append(ui.card("The home", ui.form([{ key: "includeHome", label: "The home is part of what we leave (the plan does not need to keep its value in savings)", type: "checkbox" }], { includeHome: d.includeHome }, (v) => {
        pending = "Saved.";
        store.update((p) => { p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.legacy = { ...(p.estate.legacy ?? { bequests: [] }), includeHome: !!v.includeHome }; });
      }, { submitLabel: "Save" })));
    }
    host.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/estate-tax" }, "Estate tax"), ui.h("a", { class: "btn secondary", href: "#/estate/gifting" }, "Give some now"))));
  }
}
