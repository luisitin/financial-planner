// modules/cashflow/subscriptions/view.js -- DOM only. The yearly cost of everything that
// renews by itself, biggest first, with "still worth it?" as the question the page asks.
// One tap away (docs/OPTIONAL.md): "How to ask for a lower price" (Bills and regular payments links here with
// ?show=lower when a bill went up; with no subscription it is drawn only for that link) and the payees you hid.
import { compute } from "./compute.js";
import { compute as recurring } from "../recurring/compute.js";
import { hideRow, hiddenPart } from "../recurring/view.js";
import { parts } from "../../../core/ui/more.js";

let pending = null;   // { text, at: "list" | "hidden" }: what a hide or put-back did, said on the next render where it was done

/** The plain steps of "How to ask for a lower price" (gap #6, K6 as it fits the promise: nobody calls for you). */
export const LOWER_PRICE_STEPS = Object.freeze([
  "Know your price and a rival's: what you pay now, and what another company charges a new customer for the same thing.",
  "Call or chat, and ask for the department that keeps customers (often called retention, or cancellations).",
  "Ask what they can do to lower your bill: a cheaper plan, a deal for new customers, a discount for staying.",
  "Be ready to cancel. The best offer often comes once you say you are leaving.",
  "Write down the new price and the day it ends.",
  "Put a reminder for that day on the Money calendar, so the price does not creep back up.",
]);

/** "How to ask for a lower price" as a part (kind "how": a reading part, kept open on this phone once opened by hand). */
export function lowerPricePart(ctx) {
  const { ui } = ctx;
  return { id: "lower", kind: "how", title: "How to ask for a lower price", says: `${LOWER_PRICE_STEPS.length} steps`,
    body: () => [
      ui.h("ol", { style: { margin: "0", paddingLeft: "20px", display: "grid", gap: "6px" } }, LOWER_PRICE_STEPS.map((s) => ui.h("li", {}, s))),
      ui.h("p", { class: "muted small" }, "Nobody calls a company for you from here: the call is yours, and so is canceling. It works best for phone, internet, TV, streaming and insurance."),
      ui.row(ui.h("a", { class: "btn secondary", href: "#/household/calendar" }, "Open the Money calendar")),
    ] };
}

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });

  const said = pending; pending = null;
  const okLine = said ? ui.notice("ok", said.text) : null;
  const say = (at) => (t) => { pending = { text: t, at }; };
  const rec = recurring(plan, { today: fmt.today() });
  const hidden = rec.hidden;
  const hiddenHere = hidden.length > 0;
  // a bill that went up says its new price beside the usual one the year counts, in Bills and regular payments' words
  const rises = new Map(rec.changes.filter((c) => c.kind === "up").map((c) => [c.key, c.to]));
  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Subscriptions"),
      ui.h("p", { class: "lede" }, "Streaming, phone, gym, apps: the charges that renew by themselves. This page adds up what they cost you a year so the ones you no longer use stand out."),
      ui.h("p", { class: "muted small" }, "The page finds them in your transactions (same payee, same amount, every month) and adds any you typed on the Expenses page under Subscriptions."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Type them on Expenses"))));
    if (okLine && !(said.at === "hidden" && hiddenHere)) root.append(okLine);
    // the steps are for any bill that went up: Bills and regular payments links here (?show=lower) also when no bill is a
    // subscription, so they are drawn for that link; otherwise the empty page stays as short as it was (critic F5)
    const asked = ctx.route?.query?.show === "lower";
    const more = parts(ctx, asked ? lowerPricePart(ctx) : null, hiddenPart(ctx, hidden, say("hidden"), { open: said?.at === "hidden", said: said?.at === "hidden" ? okLine : null }));
    if (more) root.append(more);
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${fmt.money(d.yearly, cur)} a year`),
    ui.h("p", { class: "lede" }, `${d.count} subscription${d.count === 1 ? "" : "s"}, ${fmt.money(d.monthly, cur)} a month. Go down the list and ask of each one: did I use this last month?`),
  ));
  // a typed one opens its own form on Expenses, with a way back here (CF-5, F2)
  const openTyped = (i) => ctx.go("cashflow", "expenses", [], { edit: i.expenseId, back: "cashflow/subscriptions" });
  root.append(ui.card("Biggest first", okLine && !(said.at === "hidden" && hiddenHere) ? okLine : null,
    ui.h("ul", { class: "page-list" }, d.items.map((i) => ui.h("li", i.source === "typed" ? { role: "link", tabindex: "0", style: { cursor: "pointer" }, onClick: () => openTyped(i),
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } } : {},
      ui.h("span", { class: "ic" }, i.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, i.name, i.source === "typed" ? ui.h("span", { class: "pill" }, "typed") : null), ui.h("div", { class: "d" }, `${fmt.money(i.amount, cur, undefined, 2)} ${i.cadenceLabel}${i.source === "found" && rises.has(i.key) ? ` · now ${fmt.money(rises.get(i.key), cur, undefined, 2)}` : ""}${i.next ? ` · next ${fmt.date(i.next)}` : ""}`)),
      ui.h("span", { class: "st", style: { textAlign: "right" } }, ui.h("div", { style: { fontWeight: "600" } }, `${fmt.money(i.yearly, cur)} a year`),
        // asks first, naming it, and says what it did (F3)
        i.source === "found" ? ui.button("Not a subscription", () => hideRow(ctx, { key: i.key, payee: i.name }, say("list"), { what: "subscription" }), { class: "secondary small", "aria-label": `${i.name} is not a subscription` }) : ui.h("div", { class: "muted small" }, "Edit ›"))))),
    ui.h("p", { class: "muted small" }, "You cancel with the company itself, not here; once the charges stop, the item drops off this list on its own."),
    d.items.some((i) => i.source === "typed") ? ui.row(ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Change these on Expenses")) : null,
  ));
  const more = parts(ctx, lowerPricePart(ctx), hiddenPart(ctx, hidden, say("hidden"), { open: said?.at === "hidden", said: said?.at === "hidden" ? okLine : null }));
  if (more) root.append(more);
}
