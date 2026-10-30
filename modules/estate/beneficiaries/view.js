// modules/estate/beneficiaries/view.js -- DOM only. How much money has someone named on it, then one row
// per account and policy: who is named, what to fix; tap a row to list the people (quick picks from the
// household), their shares and the backups.
import { compute } from "./compute.js";

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
  const total = d.items.reduce((s, x) => s + x.value, 0);
  root.append(ui.card(null, ui.row(
    ui.stat("Has someone named", `${d.named} of ${d.count}`, "accounts and policies"),
    ui.stat("Money with no one named", money(d.missingValue), d.missingValue ? `of ${money(total)}` : "all of it has a beneficiary"),
  )));
  root.append(ui.h("p", { class: "muted" }, "Copy each name from the account's own beneficiary form (on the provider's site, under beneficiaries). Tap an account to fill it in."));

  const people = (plan.household?.people ?? []).map((p) => ({ name: p.name, personId: p.id }));
  const ul = ui.h("ul", { class: "eb-list" });
  for (const x of d.items) {
    const li = ui.h("li");
    const names = (l) => l.map((b) => `${b.name}${l.length > 1 && b.share !== null ? ` ${Math.round(b.share * 100)}%` : ""}`).join(", ");
    const draw = () => {
      li.replaceChildren(ui.h("button", { type: "button", class: "eb-row", "aria-expanded": openKey === x.key ? "true" : "false", onClick: () => { openKey = openKey === x.key ? null : x.key; draw(); } },
        ui.h("span", { class: "eb-ic" }, !x.primary.length ? "⬜" : x.ok ? "✅" : "⚠️"),
        ui.h("span", { class: "eb-body" }, ui.h("div", { class: "eb-t" }, x.name),
          ui.h("div", { class: "eb-d" }, x.primary.length ? `${names(x.primary)}${x.contingent.length ? `; then ${names(x.contingent)}` : ""}` : `${x.typeLabel}: ${x.form}`),
          x.flags.length && x.primary.length ? ui.h("div", { class: "eb-f" }, x.flags.map((f) => f[0].toUpperCase() + f.slice(1)).join(". ") + ".") : null),
        ui.h("span", { class: "eb-v" }, money(x.value))));
      if (openKey === x.key) li.append(editor(x, () => { openKey = null; draw(); }));
    };
    draw();
    ul.append(li);
  }
  root.append(ui.card("Accounts and policies", ul));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/documents" }, "Documents"), ui.h("a", { class: "btn secondary", href: "#/estate/legacy" }, "Legacy goals"))));

  // the people on one account: primary and backup, each with a share; quick picks from the household
  function editor(x, close) {
    const draft = { primary: x.primary.map((b) => ({ ...b })), contingent: x.contingent.map((b) => ({ ...b })) };
    let reviewed = x.reviewedAt || today;
    const host = ui.h("div", { class: "eb-edit" });
    const drawEd = () => {
      host.replaceChildren();
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
          pending = `${x.name} saved.`;
          openKey = null;
          const clean = (l) => l.filter((b) => b.name.trim()).map((b) => ({ name: b.name.trim(), share: b.share, personId: b.personId ?? "" }));
          store.update((p) => {
            p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.beneficiaries = p.estate.beneficiaries ?? [];
            const row = { key: x.key, [x.source === "account" ? "accountId" : "policyId"]: x.id, primary: clean(draft.primary), contingent: clean(draft.contingent), reviewedAt: reviewed || "" };
            const i = p.estate.beneficiaries.findIndex((r) => (r.key ?? (r.accountId ? `account:${r.accountId}` : `policy:${r.policyId}`)) === x.key);
            if (i >= 0) p.estate.beneficiaries[i] = row; else p.estate.beneficiaries.push(row);
          });
        }), ui.button("Cancel", close, { class: "secondary" })));
      if (x.flags.length && !x.primary.length) host.prepend(ui.h("p", { class: "eb-f" }, x.flags[0][0].toUpperCase() + x.flags[0].slice(1) + "."));
    };
    // equal shares whenever someone is added from the quick picks (the last one takes the rounding)
    const spread = (l) => { const each = Math.floor(100 / l.length) / 100; l.forEach((b, i) => { b.share = i === l.length - 1 ? Math.round((1 - each * (l.length - 1)) * 100) / 100 : each; }); };
    drawEd();
    return host;
  }
}
