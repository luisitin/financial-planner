// modules/estate/beneficiaries/view.js -- DOM only. How much money has someone named on it, then one row
// per account and policy: who is named, what to fix; tap a row to list the people (quick picks from the
// household), their shares and the backups.
import { compute } from "./compute.js";
import { links, rest } from "../../../core/ui/more.js";

/** The headline (simple first, R3 and R5): one written sentence per case. */
export function headlineOf(d) {
  const missing = d.count - d.named, look = d.items.filter((x) => x.primary.length && !x.ok).length;
  if (d.count === 1 && missing === 1) return "Your one account or policy has no one named";
  if (missing === d.count) return `${d.count} accounts and policies have no one named`;
  if (missing === 1) return `1 of ${d.count} accounts and policies has no one named`;
  if (missing > 1) return `${missing} of ${d.count} accounts and policies have no one named`;
  if (look === 1) return "Everyone has someone named; 1 needs a look";
  if (look > 1) return `Everyone has someone named; ${look} need a look`;
  return "Every account and policy has someone named, and a backup";
}
/** The line under it, one per case; `money` formats the money with no one named. "could": the sum counts every account
 * with no one named, and a joint account may still pass straight to the other owner. */
export function ledeOf(d, money) {
  const look = d.items.filter((x) => x.primary.length && !x.ok).length, missing = d.count - d.named;
  if (missing > 0 && d.missingValue > 0) return `${money(d.missingValue)} could go through the courts before anyone gets it.`;
  if (missing === 1) return "Name someone on it now, so it goes straight to the people you choose.";
  if (missing > 1) return "Name someone on each now, so they go straight to the people you choose.";
  if (look === 1) return "Tap the one marked ⚠️ to see what to fix.";
  if (look > 1) return "Tap the ones marked ⚠️ to see what to fix.";
  return "Check them again every few years, and after a birth, a death, a marriage or a divorce.";
}
/** The one to do next: the first with no one named, else the first that needs a look. */
const nextOf = (d) => d.items.find((x) => !x.primary.length) ?? d.items.find((x) => !x.ok) ?? null;

let pending = null;   // the confirmation shown on the next render
let openKey = null;   // the row being edited

const STYLE = `
.eb-root .eb-list { list-style: none; margin: 0; padding: 0; }
.eb-root .eb-list > li { border-bottom: 1px solid var(--line); }
.eb-root .eb-list > li:last-child { border-bottom: 0; }
.eb-root .eb-row { display: flex; gap: 12px; align-items: flex-start; width: 100%; min-height: 52px; padding: 10px 0; background: none; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.eb-root .eb-ic { flex: none; width: 24px; text-align: center; }
.eb-root .eb-body { flex: 1; min-width: 0; }
.eb-root .eb-t { font-weight: 600; }
.eb-root .eb-d { color: var(--text-2); font-size: var(--fs-sm); }
.eb-root .eb-f { color: var(--warn); font-size: var(--fs-sm); }
.eb-root .eb-f + .eb-f { margin-top: 4px; }
.eb-root .eb-v { flex: none; white-space: nowrap; font-size: var(--fs-sm); color: var(--muted); }
.eb-root .eb-edit { padding: 0 0 14px; }
.eb-root .eb-line { display: grid; grid-template-columns: 1fr 84px 44px; gap: 8px; align-items: end; margin: 6px 0; }
.eb-root .eb-line input { width: 100%; }
.eb-root .eb-x { min-width: 44px; min-height: 44px; }
.eb-root h4 { margin: 12px 0 2px; font-size: var(--fs-sm); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "eb-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.count) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Who gets each account"),
      ui.h("p", { class: "lede" }, "Retirement accounts, life insurance and accounts with a payable-on-death form go to the people named on them, whatever your will says. An old form can send money to an ex, or to a child too young to take it."),
      ui.h("p", { class: "muted small" }, "Add your accounts and life insurance first; then list who is named on each."),
      ui.row(ui.h("a", { class: "btn", href: "#/balance/accounts" }, "Add accounts"), ui.h("a", { class: "btn secondary", href: "#/insurance/policies" }, "Add policies"))));
    return;
  }
  // the answer, in one sentence per case, and one filled way on: the next account to fill in (none while a form is open:
  // its Save is the one filled button then)
  const next = openKey ? null : nextOf(d);
  // opening or shutting a row's form draws the page again (the one filled button is the open form's Save, else the way on)
  const redraw = () => (ctx.redraw ? ctx.redraw() : (page.replaceChildren(), render(page, ctx)));
  root.append(ui.h("section", { class: "card hero" }, ui.h("h1", {}, headlineOf(d)), ui.h("p", { class: "lede" }, ledeOf(d, money)),
    next ? ui.row(ui.button(next.primary.length ? `See what to fix: ${next.name}` : `Name someone on ${next.name}`, () => { openKey = next.key; redraw(); })) : null));

  const people = (plan.household?.people ?? []).map((p) => ({ name: p.name, personId: p.id }));
  // six rows, then "N more accounts and policies" (opt R19); a row with something to fix or an open form always shows
  const rowOf = (x) => {
    const li = ui.h("li");
    const names = (l) => l.map((b) => `${b.name}${l.length > 1 && b.share !== null ? ` ${Math.round(b.share * 100)}%` : ""}`).join(", ");
    // a child under 18 named on it gets a line of its own (what to name instead); the other flags share one line
    const minorText = new Set((x.minors ?? []).map((m) => m.text));
    const others = x.flags.filter((f) => !minorText.has(f));
    const sentence = (f) => f[0].toUpperCase() + f.slice(1) + ".";
    const draw = () => {
      li.replaceChildren(ui.h("button", { type: "button", class: "eb-row", "aria-expanded": openKey === x.key ? "true" : "false", onClick: () => { openKey = openKey === x.key ? null : x.key; redraw(); } },
        ui.h("span", { class: "eb-ic" }, !x.primary.length ? "⬜" : x.ok ? "✅" : "⚠️"),
        ui.h("span", { class: "eb-body" }, ui.h("div", { class: "eb-t" }, x.name),
          ui.h("div", { class: "eb-d" }, x.primary.length ? `${names(x.primary)}${x.contingent.length ? `; then ${names(x.contingent)}` : ""}` : `${x.typeLabel}: ${x.form}`),
          x.primary.length ? [...minorText].map((t) => ui.h("div", { class: "eb-f eb-minor" }, sentence(t))) : null,
          others.length && x.primary.length ? ui.h("div", { class: "eb-f" }, others.map((f) => f[0].toUpperCase() + f.slice(1)).join(". ") + ".") : null),
        ui.h("span", { class: "eb-v" }, money(x.value))));
      if (openKey === x.key) li.append(editor(x, () => { openKey = null; redraw(); }));
    };
    draw();
    return li;
  };
  root.append(ui.card("Accounts and policies", ...rest(ctx, { id: "rows", items: d.items, row: rowOf, noun: "accounts and policies", one: "account or policy", list: "eb-list", keep: (x) => !x.ok || x.key === openKey })));
  root.append(links(ctx, [
    { href: "#/estate/documents", ask: "Are the will and the other papers signed?", says: "Estate documents" },
    { href: "#/estate/legacy", ask: "Who should get what you leave?", says: "Legacy goals" },
    { href: "#/reports/if-something-happens", ask: "What would your family need if something happened to you?", says: "One packet to print" },
  ]));

  // the people on one account: primary and backup, each with a share; quick picks from the household
  function editor(x, close) {
    const draft = { primary: x.primary.map((b) => ({ ...b })), contingent: x.contingent.map((b) => ({ ...b })) };
    let reviewed = x.reviewedAt || today;
    const host = ui.h("div", { class: "eb-edit" });
    const drawEd = () => {
      host.replaceChildren(ui.h("p", { class: "muted small" }, `Copy each name from this ${x.source === "policy" ? "policy" : "account"}'s own beneficiary form, on the provider's site under beneficiaries.`));
      for (const [level, title] of [["primary", "Main beneficiaries"], ["contingent", "Backups, if the main ones have died"]]) {
        host.append(ui.h("h4", {}, title));
        draft[level].forEach((b, i) => {
          const nameBox = ui.input({ value: b.name, "aria-label": "Name", placeholder: "Name, trust or charity", onChange: (e) => { b.name = e.target.value; } });
          const shareBox = ui.input({ type: "number", min: "0", max: "100", step: "1", inputmode: "decimal", value: b.share === null ? "" : Math.round(b.share * 100), "aria-label": "Share in percent", placeholder: "%", onChange: (e) => { b.share = e.target.value === "" ? null : Number(e.target.value) / 100; } });
          host.append(ui.h("div", { class: "eb-line" }, nameBox, shareBox, ui.button("✕", () => { draft[level].splice(i, 1); drawEd(); }, { class: "secondary eb-x", "aria-label": `Remove ${b.name || "this line"}` })));
        });
        host.append(ui.h("div", { class: "chips" }, [...people.filter((p) => p.personId !== x.ownerId), { name: "A trust", personId: "" }, { name: "Estate", personId: "" }].filter((p) => !draft[level].some((b) => b.name === p.name)).map((p) => ui.h("button", { type: "button", class: "chip", onClick: () => { draft[level].push({ name: p.name, personId: p.personId, share: null }); spread(draft[level]); drawEd(); } }, `+ ${p.name}`)).concat(ui.h("button", { type: "button", class: "chip", onClick: () => { draft[level].push({ name: "", personId: "", share: null }); drawEd(); } }, "+ Someone else"))));
      }
      const dateBox = ui.input({ type: "date", value: reviewed, "aria-label": "Checked on", onChange: (e) => { reviewed = e.target.value; } });
      host.append(ui.field("Checked against the provider's form on", dateBox),
        ui.h("div", { class: "form-actions" }, ui.button("Save", () => {
          openKey = null;
          const clean = (l) => l.filter((b) => b.name.trim()).map((b) => ({ name: b.name.trim(), share: b.share, personId: b.personId ?? "" }));
          const put = (p) => {
            p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.beneficiaries = p.estate.beneficiaries ?? [];
            const row = { key: x.key, [x.source === "account" ? "accountId" : "policyId"]: x.id, primary: clean(draft.primary), contingent: clean(draft.contingent), reviewedAt: reviewed || "" };
            const i = p.estate.beneficiaries.findIndex((r) => (r.key ?? (r.accountId ? `account:${r.accountId}` : `policy:${r.policyId}`)) === x.key);
            if (i >= 0) p.estate.beneficiaries[i] = row; else p.estate.beneficiaries.push(row);
          };
          // the green line names the new answer when the headline changed (R7)
          const after = structuredClone(plan); put(after);
          const now = headlineOf(compute(after, { today }));
          pending = now !== headlineOf(d) ? `${x.name} saved. ${now}.` : `${x.name} saved.`;
          store.update(put);
        }), ui.button("Cancel", close, { class: "secondary" })));
      if (x.flags.length && !x.primary.length) host.prepend(ui.h("p", { class: "eb-f" }, x.flags[0][0].toUpperCase() + x.flags[0].slice(1) + "."));
    };
    // equal shares whenever someone is added from the quick picks (the last one takes the rounding)
    const spread = (l) => { const each = Math.floor(100 / l.length) / 100; l.forEach((b, i) => { b.share = i === l.length - 1 ? Math.round((1 - each * (l.length - 1)) * 100) / 100 : each; }); };
    drawEd();
    return host;
  }
}
