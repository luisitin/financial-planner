// modules/balance/assets/view.js -- DOM only. What you own outside your money accounts: homes, cars and other things
// (read from Net worth and the property pages, which stay where they are changed) and a home inventory of belongings
// kept here (added, changed and removed on this page), with the things worth a look for an insurance claim.
import { compute, saveBelonging, removeBelonging, KINDS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let editing = null;   // the id of the belonging being changed
let adding = false;   // the add form is open on a page that already has belongings

const STYLE = `
.as-root .as-meta { color: var(--muted); font-size: var(--fs-sm); }
.as-root .rec-foot { flex-wrap: wrap; gap: 8px; }
.as-root .as-checks { list-style: none; padding: 0; margin: 0; }
.as-root .as-checks li { padding: 10px 0; border-top: 1px solid var(--line); }
.as-root .as-checks li:first-child { border-top: 0; }
.as-root .as-checks a { display: inline-block; min-height: 44px; line-height: 44px; }
.as-root .card h3 { margin-top: 18px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta?.currency;
  const today = fmt.today();
  const d = compute(plan, { today });
  const money = (v) => fmt.money(v, cur);
  const year = (iso) => (iso ? iso.slice(0, 4) : "");
  const pct = (x) => `${(Math.abs(x) * 100).toFixed(1)}%`;
  const root = ui.h("div", { class: "as-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice(pending.kind ?? "ok", pending.text); root.append(n); if ((pending.kind ?? "ok") === "ok") setTimeout(() => n.remove(), 5000); pending = null; }
  const rerender = () => { page.replaceChildren(); render(page, ctx); };

  if (d.empty && !adding) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "What you own, in one list"),
      ui.h("p", { class: "lede" }, "Your home, your car and the things in your home, each with what you paid, what it is worth now and which insurance covers it. If there is ever a fire or a break-in, this list is what your insurer will ask for."),
      ui.row(ui.button("Add your first belonging", () => { adding = true; rerender(); }), ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Add a home or car"))));
    return;
  }

  // the totals
  if (!d.empty) root.append(ui.h("section", { class: "card" }, ui.row(
    ui.stat("Homes, cars and other things", money(d.totals.counted), "counted in your net worth"),
    ui.stat("Your belongings", d.items.length ? money(d.totals.worth) : "None listed", d.items.length ? `worth about this now; you paid ${money(d.totals.paid)}` : "the things in your home"))));

  // things worth a look
  if (d.checks.length) root.append(ui.card("Worth a look", ui.h("ul", { class: "as-checks" }, d.checks.map((c) => ui.h("li", {},
    ui.h("span", {}, c.text), c.go ? ui.h("div", {}, ui.h("a", { href: `#/${c.go.join("/")}` }, "Open Policies ›")) : null)))));

  // homes
  if (d.homes.length) root.append(ui.card(d.homes.length === 1 ? "Your home" : "Homes and land", ui.h("ul", { class: "records" }, d.homes.map((h) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${h.name}${h.rental ? " (rental)" : ""}`), ui.h("span", { class: "rec-value" }, money(h.value))),
    ui.h("div", { class: "rec-sub" }, h.paid !== null
      ? `Paid ${money(h.paid)}${h.bought ? ` in ${year(h.bought)}` : ""}: ${h.change >= 0 ? "up" : "down"} ${money(Math.abs(h.change))}${h.perYear !== null ? `, about ${pct(h.perYear)} a year` : ""}.`
      : "Add what you paid and when on the Home page to see how its value has moved."),
    ui.h("div", { class: "rec-sub" }, h.policy ? `Insured by ${h.policy.name}.` : ui.h("span", { class: "pill warn" }, "No policy on file")),
    ui.h("div", { class: "rec-foot" }, ui.h("a", { class: "btn secondary small", href: h.rental ? "#/property/rental" : "#/property/home" }, h.rental ? "Rental details" : "Home details")))))));

  // cars
  if (d.cars.length) root.append(ui.card(d.cars.length === 1 ? "Your car" : "Your cars", ui.h("ul", { class: "records" }, d.cars.map((c) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, c.name), ui.h("span", { class: "rec-value" }, money(c.value))),
    ui.h("div", { class: "rec-sub" }, `Loses about ${money(c.lossYear)} a year (${pct(c.loss)} of its value).${c.paid !== null ? ` Paid ${money(c.paid)}${c.bought ? ` in ${year(c.bought)}` : ""}.` : ""}`),
    ui.h("div", { class: "rec-sub" }, d.carPolicies.length ? `Car insurance on file: ${d.carPolicies.map((p) => p.name).join(", ")}.` : ui.h("span", { class: "pill warn" }, "No car insurance on file")),
    ui.h("div", { class: "rec-foot" }, ui.h("a", { class: "btn secondary small", href: "#/property/vehicles" }, "Car costs")))))));

  // other things counted in net worth
  if (d.others.length) root.append(ui.card("Other things you counted", ui.h("p", { class: "muted small" }, "Added on Net worth as an \"other asset\", so they are in your net worth."),
    ui.h("ul", { class: "records" }, d.others.map((o) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, o.name), ui.h("span", { class: "rec-value" }, money(o.value))))))));

  // belongings: the home inventory
  const inv = ui.card("Your belongings");
  root.append(inv);
  inv.append(ui.h("p", { class: "muted small" }, `A list of the things in your home for an insurance claim: what you paid, when, and where the receipt and photos are. These are not added to your net worth.${d.lastChanged ? ` Last changed ${fmt.date(d.lastChanged)}.` : ""}`));
  if (d.items.length) {
    const recs = ui.h("ul", { class: "records" });
    for (const x of d.items) {
      if (editing === x.id) { recs.append(ui.h("li", {}, ui.h("h3", {}, `Change ${x.name}`), itemForm(x))); continue; }
      const worthText = x.worth === null ? "Add what you paid to see what it is worth now."
        : x.how === "yours" ? `Worth ${money(x.worth)} by your figure${x.valuedAt ? ` on ${fmt.date(x.valuedAt)}` : ""}.`
        : x.how === "estimate" ? (x.worth > 0 ? `Worth about ${money(x.worth)} now: loses about ${money(x.perYear)} a year over ${x.life} years.` : `Worth little now: it has passed the ${x.life} years it lasts.`)
        : x.life ? "Add the day you bought it to estimate what it is worth now." : "Keeps its value: worth what you paid until you add your own figure.";
      recs.append(ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.name), ui.h("span", { class: "rec-value" }, x.worth === null ? "?" : money(x.worth))),
        ui.h("div", { class: "rec-sub" }, [x.kindLabel, x.room, x.paid !== null ? `paid ${money(x.paid)}${x.bought ? ` on ${fmt.date(x.bought)}` : ""}` : null].filter(Boolean).join(" · ")),
        ui.h("div", { class: "rec-sub" }, worthText),
        ui.h("div", { class: "rec-sub" }, x.policy ? `Covered by ${x.policy.name}${x.special ? (x.listed ? ", listed on the policy." : ".") : "."}` : null,
          x.flags.includes("uncovered") ? ui.h("span", { class: "pill warn" }, "No policy picked") : null, " ",
          x.flags.includes("list-it") ? ui.h("span", { class: "pill warn" }, "Ask about listing it") : null),
        x.details || x.proof ? ui.h("div", { class: "rec-sub" }, [x.details, x.proof ? `Receipt and photos: ${x.proof}` : null].filter(Boolean).join(" · ")) : null,
        ui.h("div", { class: "rec-foot" }, ui.h("span", { class: "rec-actions" },
          ui.button("Change", () => { editing = x.id; adding = false; rerender(); }, { class: "secondary small" }),
          ui.button("Remove", () => {
            if (!ui.confirm(`Remove ${x.name} from your belongings?`)) return;
            pending = { text: `${x.name} removed.` };
            if (editing === x.id) editing = null;
            store.update((q) => { removeBelonging(q, x.id); });
          }, { class: "secondary small" })))));
    }
    inv.append(recs);
    if (adding) inv.append(ui.h("h3", {}, "Add a belonging"), itemForm(null));
    else if (!editing) inv.append(ui.row(ui.button("+ Add another belonging", () => { adding = true; rerender(); }, { class: "secondary" })));
  } else inv.append(itemForm(null));

  // how the figures are worked out
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "How \"worth now\" is worked out"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", {}, "For a belonging: your own figure if you gave one (an appraisal, or what one sells for used). Otherwise what you paid, less an even share for every year since you bought it, over the years it lasts. Jewelry, art and other things that keep their value stay at what you paid."),
    ui.h("p", {}, "Why it matters: a policy that pays \"actual cash value\" pays about the worth now, after wear and age. One that pays \"replacement cost\" pays what a new one costs, and many pay the worth now first and the rest once you have replaced it. Your policy says which."),
    ui.h("p", {}, "Homes: the value on Net worth against what you paid, as a yearly rate. Cars: the share of its value a car loses in a year, set on the car costs page."),
    ui.h("p", { class: "muted small" }, "The years each kind of thing lasts are round examples. Change them to fit.")));

  function itemForm(x) {
    const policyOpts = [{ value: "", label: d.policies.length ? "None picked yet" : "No home or renters policy on file yet" }, ...d.policies.map((p) => ({ value: p.id, label: p.name }))];
    const start = x ?? { kind: "electronics", life: KINDS.electronics.life, policyId: d.policies.length === 1 ? d.policies[0].id : "", bought: "" };
    const form = ui.form([
      { key: "name", label: "What it is", required: true, placeholder: "For example: laptop, sofa, engagement ring" },
      { key: "kind", label: "Kind", type: "select", options: Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label })) },
      { key: "room", label: "Where it is", placeholder: "For example: living room, garage", help: "optional; helps you go room by room" },
      { key: "bought", label: "Day you bought it", type: "date" },
      { key: "paid", label: "What you paid", type: "money" },
      { key: "life", label: "Years it lasts", type: "number", min: 1, step: 1, help: "an example for this kind; leave blank if it keeps its value" },
      { key: "value", label: "What it is worth now (optional)", type: "money", help: "your own figure or an appraisal; leave blank to estimate" },
      { key: "policyId", label: "Insurance that covers it", type: "select", options: policyOpts },
      { key: "listed", label: "Listed by name on the policy", type: "checkbox", help: "some insurers call this a rider, floater or schedule" },
      { key: "details", label: "Make, model, serial number", placeholder: "optional" },
      { key: "proof", label: "Where the receipt and photos are", placeholder: "For example: phone photos, folder in the desk" },
    ], start, (v) => {
      if (v.bought && v.bought > today) { form.append(ui.notice("error", "That day is in the future. Pick the day you bought it.")); return; }
      if (v.paid !== null && v.paid < 0) { form.append(ui.notice("error", "What you paid cannot be below zero.")); return; }
      const id = x?.id ?? ui.uid();
      const name = String(v.name ?? "").trim() || "Something";
      pending = { text: x ? `${name} saved.` : `${name} added to your belongings.` };
      editing = null; adding = false;
      store.update((q) => { saveBelonging(q, { ...v, id, valuedAt: x && x.value === v.value ? x.valuedAt : today }, today); });
    }, { submitLabel: x ? "Save" : "Add it", onCancel: x || d.items.length || adding ? () => { editing = null; adding = false; rerender(); } : null });
    // a new kind suggests its years, unless the years were typed
    const kind = form.querySelector('[name="kind"]'), life = form.querySelector('[name="life"]');
    let typed = !!x;
    life?.addEventListener("input", () => { typed = true; });
    kind?.addEventListener("change", () => { if (!typed && life) life.value = KINDS[kind.value]?.life ?? ""; });
    return form;
  }
}
