// modules/estate/legacy/view.js -- DOM only. Whom you want to leave what, the total the plan should keep
// for it, whether the plan does, and what each lever would have to be if not. Runs on the PC when connected.
// One quiet row, "Who gets what" (gap list, next 60, item 15), opens to a picture of who would receive what today: by the
// account forms, the other owner and the will's wishes, with what no one is named for as its own bar. Nothing there is saved.
import { KINDS, listedLevers, roomWords, verdictWords, whoGetsWhat, WHO_TITLE, UNNAMED, NOT_ADVICE, GAP_LINKS, ledeWords, detailWords, unnamedWords, gapWords, keptWords, debtWords, ruleWords, goalsWords } from "./compute.js";
import { needsWords } from "../../../core/words.js";
import { part, parts } from "../../../core/ui/more.js";

let pending = null;   // the confirmation shown on the next render
let homeSaid = null;  // the home tick box's confirmation, drawn under the box on the next render
let whose = null;     // "Who gets what": the case picked with a chip (an adult's id or "both"); kept on this tab, never saved

/** "Who gets what"'s case on this tab: Back keeps it (the variable above) and a reload too (sessionStorage, this tab only, the
 * sandbox its own twin). It holds an adult's id or "both", never a name or a figure; a case the plan no longer has draws the first. */
const whoseKey = (ctx) => `planner.legacy.whose${ctx.store?.sandbox?.() ? ".sandbox" : ""}`;
function whoseNow(ctx) {
  if (whose === null) { try { whose = globalThis.sessionStorage?.getItem(whoseKey(ctx)) ?? null; } catch { whose = null; } }
  return whose;
}
function pickWhose(ctx, id) {
  whose = id;
  try { globalThis.sessionStorage?.setItem(whoseKey(ctx), id); } catch { /* blocked: kept for the visit only */ }
}
/** The picture, or null when the plan cannot be read for it (an entry it does not expect): the row is then left out and the
 * rest of the page draws as before. */
function picture(ctx, dies) {
  try { return whoGetsWhat(ctx.plan, { today: ctx.fmt.today(), dies }); } catch { return null; }
}

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
/* "Who gets what": one row per person or cause, its bar the share of the total (one color; amber only for no one named) */
.lg-root .lg-who .chips { margin-bottom: 4px; }
.lg-root .lg-bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.lg-root .lg-bar-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.lg-root .lg-bar-top .lg-t { min-width: 0; overflow-wrap: anywhere; }
.lg-root .lg-bar { height: 10px; border-radius: 5px; background: var(--line); overflow: hidden; margin: 6px 0 4px; }
.lg-root .lg-bar > span { display: block; height: 100%; min-width: 4px; border-radius: 5px; background: var(--accent); }
.lg-root .lg-bar.warn > span { background: var(--warn); }
.lg-root .lg-who p { margin: 0; }
.lg-root .lg-go { display: inline-flex; align-items: center; min-height: 44px; }
`;
/** How many changes "Does the plan leave it?" shows before any tap. */
const FIRST = 3;
/** A folded change in a few words, for the fold's line. */
const SHORT = { spending: "spending", retire: "retiring", saving: "saving", lump: "savings today", claim: "Social Security" };
const leverItem = (ui, l) => ui.h("li", {}, ui.h("div", { style: { fontWeight: 600 } }, `${l.icon} ${l.title}`), ui.h("div", { class: "lg-d" }, l.sentence));
/** The first FIRST changes as a list, the rest under "N more changes" (a part; never a fold for none). Its line names
 * them when the names fit in a status (20 characters). */
function leverList(ctx, listed) {
  const ui = ctx.ui;
  const rest = listed.slice(FIRST);
  const names = rest.map((l) => SHORT[l.id] ?? l.title).join(", ");
  return [ui.h("ul", { class: "lg-levers" }, listed.slice(0, FIRST).map((l) => leverItem(ui, l))),
    rest.length ? part(ctx, { id: "changes", kind: "more", n: rest.length, noun: "changes", one: "change", says: names.length <= 20 ? names : "", body: () => ui.h("ul", { class: "lg-levers" }, rest.map((l) => leverItem(ui, l))) }) : null];
}

/** The page each gap sentence sends the person to, by its name on the menu. */
const GO = { "#/estate/beneficiaries": "Beneficiary audit", "#/estate/will-worksheet": "Choices to take to a lawyer", "#/estate/documents": "Estate documents" };
/**
 * The body of "Who gets what": for a couple, a chip per case (nothing saved: the picture redraws in place); the sentence,
 * the bars, the biggest gap with the page that fixes it, what stays with the one alive, the debts, the order things pass in.
 */
function whoBody(ctx, money) {
  const { ui, fmt } = ctx;
  const holder = ui.h("div", { class: "lg-who", style: { display: "grid", gap: "12px" } });
  const bar = (name, amount, share, words, warn) => ui.h("li", {},
    ui.h("div", { class: "lg-bar-top" }, ui.h("span", { class: "lg-t" }, name), ui.h("span", { class: "lg-v" }, money(amount))),
    ui.h("div", { class: warn ? "lg-bar warn" : "lg-bar", role: "img", "aria-label": `${name}: ${fmt.pct(share, 0)} of it` }, ui.h("span", { style: { width: `${Math.max(0, Math.min(1, share)) * 100}%` } })),
    ui.h("div", { class: "lg-d" }, [fmt.pct(share, 0), words].filter(Boolean).join(" · ")));
  const fill = (focusId = null) => {
    const d = picture(ctx, whoseNow(ctx));
    if (!d) { holder.replaceChildren(); return; }
    const href = GAP_LINKS[d.gap.id] ?? null;
    const goals = goalsWords(d, money);
    holder.replaceChildren(...[
      d.cases.length ? ui.h("div", { class: "chips", role: "group", "aria-label": "Whose death to picture" }, d.cases.map((c) => ui.h("button", {
        type: "button", class: c.id === d.dies ? "chip on" : "chip", "aria-pressed": c.id === d.dies ? "true" : "false", dataset: { case: c.id },
        onClick: () => { if (c.id === d.dies) return; pickWhose(ctx, c.id); fill(c.id); },
      }, c.label))) : null,
      ui.h("p", {}, ledeWords(d, money)),
      d.total > 0 ? ui.h("ul", { class: "lg-bars" }, ...d.rows.map((r) => bar(r.name, r.amount, r.share, detailWords(r, money), false)),
        d.unnamed ? bar(UNNAMED, d.unnamed.amount, d.unnamed.share, unnamedWords(d.unnamed), true) : null) : null,
      // what this page's own list wants to leave and the picture does not give (one adult, or everyone gone)
      goals ? ui.h("p", { class: "lg-goals" }, goals) : null,
      ui.h("p", { class: "lg-gap" }, gapWords(d.gap, money)),
      href ? ui.h("a", { class: "lg-go", href }, `${GO[href]} ›`) : null,
      d.kept ? ui.h("p", { class: "lg-d" }, keptWords(d, money)) : null,
      d.debts > 0 ? ui.h("p", { class: "lg-d" }, debtWords(d, money)) : null,
      ui.h("p", { class: "lg-d" }, `${ruleWords(d)} ${NOT_ADVICE}`),
    ].filter(Boolean));
    // after a chip: the row's line follows the case drawn ("1 name" for Ana alone, "3 names" with both gone), and the chip
    // just pressed keeps the focus (the row of chips was drawn again)
    if (focusId) {
      const line = holder.closest?.("details")?.querySelector?.(".fold-status");
      if (line) line.textContent = d.status;
      holder.querySelector?.(`[data-case="${focusId}"]`)?.focus?.();
    }
  };
  fill();
  return holder;
}

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
    // who would get what today (gap list, next 60, item 15): drawn as one quiet row above More on this when there is something to picture
    const who = picture(ctx, whoseNow(ctx));
    if (!d.bequests.length) host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What you want to leave"),
      ui.h("p", { class: "lede" }, "Money for the children, a grandchild's education, a cause you care about. Write down what you would like to leave and to whom, in today's dollars, and the plan will aim to still have it at the end."),
      // the will and the forms pass it on: with the row to point to, the line says where to see what passes today (fewer words)
      ui.h("p", { class: "muted small" }, who?.ready ? "A planning goal, not a will: Who gets what, below, shows what passes today." : "This is a planning goal, not a will: the will (or the beneficiary forms) is what actually passes it on.")));
    else {
      host.append(ui.card(null, ui.row(
        ui.stat("You want to leave", money(d.total), [d.people ? `${money(d.people)} to people` : null, d.charity ? `${money(d.charity)} to causes` : null].filter(Boolean).join(", ")),
        ui.stat("The plan should keep", money(d.target), d.includeHome && d.home ? `in savings, after ${money(d.home)} from the home` : "in savings, in today's dollars"),
      )));
      if (d.ready) {
        const verdict = verdictWords(d, money);
        host.append(ui.card("Does the plan leave it?", ui.h("p", { class: verdict.tone ? `lg-verdict ${verdict.tone}` : "lg-verdict" }, verdict.text),
          // simple first (owner, 2026-11-12 and 2026-11-13; fix round 2): the first three changes, in Goal seek's order (what is worth
          // money and what gets there on its own first), the rest one quiet tap away
          // (nothing saved for retirement on file: Will the money last? and Goal seek can't say either, so no changes are listed and
          // the way on is what you own, as on those pages; z2, 2026-11-16)
          ...(d.levers && !d.meets && !verdict.unknown ? leverList(ctx, listedLevers(d.levers)) : []),
          d.levers && d.meets && d.levers.find((l) => l.id === "spending" && l.status === "room") ? ui.h("p", { class: "lg-d" }, roomWords(d.levers.find((l) => l.id === "spending").sentence)) : null,
          ui.row(verdict.unknown ? ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Add what you own ›") : ui.h("a", { class: "btn secondary", href: "#/scenarios/goal-seek" }, "Goal seek"))));
      } else host.append(ui.card(null, ui.h("p", { class: "muted" }, needsWords("To check it against your plan, it needs", d.missing))));
      const list = ui.h("ul", { class: "lg-list" }, d.bequests.map((b) => ui.h("li", { role: "button", tabindex: "0", onClick: () => { editing = (plan.estate.legacy.bequests ?? []).find((y) => y.id === b.id); drawForm(true); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("div", { class: "lg-body" }, ui.h("div", { class: "lg-t" }, b.to || "Someone"), ui.h("div", { class: "lg-d" }, [b.kindLabel, b.notes].filter(Boolean).join(" · "))),
        ui.h("div", { class: "lg-v" }, money(b.amount)))));
      host.append(ui.card("To whom", ui.h("p", { class: "muted small" }, "Tap one to change it."), list));
    }

    const formHost = ui.h("div");
    const drawForm = (open = !d.bequests.length) => {
      formHost.innerHTML = "";
      if (!open && !editing) { formHost.append(ui.button("+ Add someone", () => drawForm(true), { class: "secondary" })); return; }
      const fm = ui.form([
        { key: "to", label: "To whom", type: "text", required: true, placeholder: "e.g. Cy, or a food bank" },
        { key: "kind", label: "Who", type: "select", options: Object.entries(KINDS).map(([value, label]) => ({ value, label })) },
        { key: "amount", label: "Amount, in today's dollars", type: "money", required: true, min: 1, max: 1e9 },
        { key: "notes", label: "Notes", type: "text", placeholder: "e.g. for a first home", more: true },
      ], editing ? { ...editing } : { kind: "person" }, (v) => {
        const clean = { to: v.to.trim(), kind: v.kind, amount: v.amount, notes: (v.notes ?? "").trim() };
        if (!clean.to || !(clean.amount > 0)) return false;
        pending = editing ? "Changes saved." : `${clean.to} added.`;
        const id = editing?.id;
        store.update((p) => {
          p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.legacy = p.estate.legacy ?? { bequests: [] }; p.estate.legacy.bequests = p.estate.legacy.bequests ?? [];
          if (id) { const i = p.estate.legacy.bequests.findIndex((x) => x.id === id); if (i >= 0) p.estate.legacy.bequests[i] = { ...p.estate.legacy.bequests[i], ...clean }; }
          else p.estate.legacy.bequests.push({ id: ui.uid(), ...clean });
        });
      }, { submitLabel: editing ? "Save changes" : "Add", resetAfter: !editing, onCancel: (editing || d.bequests.length) ? () => { editing = null; drawForm(false); } : null });
      // simple first (owner, 2026-11-12 and 2026-11-13; fix round 2): three boxes, the optional note one quiet tap away under the
      // kit's own "More details (optional)" (gap next-60 #15 drew it through the kit: no fold by hand), open when the one being
      // changed has a note (nothing of the person's is hidden); opening it changes nothing
      formHost.append(...[ui.h("h2", {}, editing ? `Change ${editing.to}` : "Add someone"), fm,
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
      // one tick box saves when it is ticked: a second filled "Save" beside the add form's button asked which one finishes the page
      const tick = ui.h("input", { type: "checkbox", name: "includeHome", checked: d.includeHome ? true : null, onChange: (e) => {
        const on = e.currentTarget.checked;
        homeSaid = on ? "Saved: the home counts toward what you leave." : "Saved: the home no longer counts toward what you leave.";
        store.update((p) => { p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.legacy = { ...(p.estate.legacy ?? { bequests: [] }), includeHome: on }; });
      } });
      const said = homeSaid ? ui.notice("ok", homeSaid) : null; homeSaid = null;   // under the box: nothing above the thumb moves
      host.append(ui.card("The home", ui.h("div", { class: "form" }, ui.field("The home is part of what we leave (the plan does not need to keep its value in savings)", tick)), said));
    }
    // one quiet row (gap list, next 60, item 15): who would get what today, one tap away; none while there is nothing to picture
    if (who?.ready) host.append(parts(ctx, { id: "who", kind: "more", title: WHO_TITLE, says: who.status, body: () => whoBody(ctx, money) }));
    host.append(ui.card("More on this", ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/estate-tax" }, "Estate tax"), ui.h("a", { class: "btn secondary", href: "#/estate/gifting" }, "Give some now"),
      // the will is what passes it on: the choices to write down before seeing a lawyer (gap design #14)
      ui.h("a", { class: "btn secondary", href: "#/estate/will-worksheet" }, "Choices for a lawyer"))));
  }
}
