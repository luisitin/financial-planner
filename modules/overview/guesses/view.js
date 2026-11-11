// modules/overview/guesses/view.js -- DOM only. "Our guesses for you": the figures the plan filled in where a box was
// left empty, the ones that change your answers most first. Each row: what it is, our figure, one "Our guess:" line, a
// box to type the real figure (grey with ours) and "That's about right". Folded below: the ones that matter less, the
// market assumptions, and, last, where the figures come from. The plan changes only through ctx.store.update, with
// core/estimate's saveField (a typed figure is the person's: the guess on it is dropped) and confirmGuess.
import { compute, useNewGuesses, keepOldGuesses, sameLoan, twoLoans, useFillGuesses, fillLater, addSpendGuesses, spendIsComplete, fillOffers, fillEffect, escrowBefore, escrowKept } from "./compute.js";
import { mergeEstimators, saveField, confirmGuess } from "../../../core/estimate/index.js";

const STYLE = `
.gs-root input::placeholder { color: var(--muted); opacity: 1; }
.gs-root .gs-why { color: var(--text-2); font-size: var(--fs-sm); margin-top: 4px; line-height: 1.4; }
.gs-root .gs-note { color: var(--muted); font-size: var(--fs-sm); margin-top: 4px; }
.gs-root .gs-form { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; }
.gs-root .gs-form .money-in { flex: 1 1 auto; min-width: 0; }
.gs-root .gs-form button { flex: none; }
.gs-root .gs-foot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.gs-root .gs-err:empty { display: none; }
.gs-root .gs-src li { display: block; }
.gs-root .gs-src .rec-sub { margin-top: 2px; }
.gs-root .gs-src .btn { margin-top: 6px; }
.gs-root .gs-group { font-weight: 600; margin: 14px 0 2px; color: var(--text-2); font-size: var(--fs-sm); }
`;
let pending = null;   // the green or red line the last save leaves, shown on the next render (the shell re-renders after store.update)
let visit = { route: null, done: new Map(), hadBig: null, ord: new Map(), upH: 0 };   // this visit's looked-over rows (see render)

// ---- the cards about our guesses, drawn here and on the Dashboard and Expenses (spec 11.3-11.6). Each lists what its filled
// button writes; nothing is written before a tap. `say(kind, text, undo)` keeps the page's notice for its next render; `undo` is
// the plan's parts the tap may change, as they were (sayNotice draws an outlined Undo that puts them back).
const CARD_STYLE = `
.gs-card .gs-why { color: var(--text-2); font-size: var(--fs-sm); margin-top: 4px; line-height: 1.4; }
.gs-card .gs-note { color: var(--muted); font-size: var(--fs-sm); margin: 8px 0 12px; line-height: 1.4; }
.gs-card .gs-effect { margin: 12px 0 0; line-height: 1.4; }
.gs-card .rec-value { white-space: normal; text-align: right; }
.gs-card details.fold { margin-top: 4px; }
.gs-card .gs-rows { list-style: none; margin: 0; padding: 0; }
.gs-card .gs-rows li { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: var(--fs-sm); color: var(--text-2); }
.gs-card .gs-rows li.gs-sum { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 8px; color: var(--text); font-weight: 600; }
.gs-card .gs-ask { margin-top: 12px; }
.gs-card .gs-ask p { margin: 0 0 6px; font-weight: 600; font-size: var(--fs-sm); }
.gs-card .gs-ask .chips { margin-bottom: 0; }
.gs-card a.gs-link { display: flex; align-items: center; width: fit-content; min-height: 44px; }
.gs-undo { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.gs-undo .btn, .gs-undo button { flex: none; }
`;
/** The registry merged from every manifest (core/app.js merges the same at boot). */
export const registryOf = (ctx) => mergeEstimators([...(ctx.modules?.values?.() ?? [])].map((m) => ({ from: `${m.group}/${m.id}`, estimators: m.estimators, tables: m.guessTables })));
/** A why that may already end in a period ("in the U.S.") as one sentence: one period, never "U.S.." (stress test F11). */
const sentence = (t) => `${String(t ?? "").replace(/\.+$/, "")}.`;
/** Where a guessed figure lives once it is yours (stress test x-3: nothing said where to change it later). */
const HOME_OF = [[/^expenses\b/, "Expenses", "#/cashflow/expenses"], [/^debts\b/, "Debts", "#/balance/liabilities"], [/^accounts\b/, "Net worth", "#/balance/net-worth"],
  [/^income\b/, "Income", "#/cashflow/income"], [/^retirement\b/, "Will the money last?", "#/retirement/projection"], [/^goals\b/, "Goals", "#/goals/goals"], [/^household\b/, "People", "#/household/people"]];
/** A typed figure far from our guess: a money amount over three times it or under a tenth, a rate over three times it. */
export function farOff(r, v) {
  const g = Number(r?.value);
  if (!(g > 0) || !(v > 0) || (r?.kind !== "money" && r?.kind !== "percent")) return false;
  return v > 3 * g || (r.kind === "money" && v < g / 10);
}
export const homeOf = (path) => { const h = HOME_OF.find(([re]) => re.test(String(path ?? ""))); return h ? { name: h[1], href: h[2] } : null; };
const monthWords = (fmt, cur, v) => `${fmt.money(Math.round(v), cur)} a month`;
const listWords = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** The plan's parts a card's tap may change, as they are now: what Undo puts back (UX review 7). */
// (every part a guess's path can name: the cushion goal's target and the older flags move with "Use the new guesses" too)
const UNDO_KEYS = ["accounts", "debts", "expenses", "goals", "income", "household", "retirement", "guesses", "guide"];
export const undoOf = (plan) => Object.fromEntries(UNDO_KEYS.map((k) => [k, plan?.[k] === undefined ? { gone: true } : { v: structuredClone(plan[k]) }]));
function putBack(draft, undo) { for (const [k, x] of Object.entries(undo ?? {})) { if (x.gone) delete draft[k]; else draft[k] = structuredClone(x.v); } }
/** A card's notice: the green line, and after a tap that wrote figures an outlined Undo (the next render only). */
export function sayNotice(ctx, said, say) {
  const { ui, store } = ctx;
  const n = ui.notice(said.kind, said.text);
  // a figure that is yours now: one 44 px link to the page where it lives from here on (stress test x-3)
  const link = said.home ? ui.h("a", { class: "btn secondary small", href: said.home.href }, `Open ${said.home.name} \u203a`) : null;
  if (!said.undo) return link ? ui.h("div", { class: "gs-undo" }, n, link) : n;
  return ui.h("div", { class: "gs-undo" }, n, link, ui.button("Undo", () => { say("ok", "Undone: your plan is as it was before the tap."); store.update((draft) => { putBack(draft, said.undo); }); }, { class: "secondary small" }));
}
/** What the fill card adds, in a few words, for its notice: "your mortgage (about $190,000 owed) and about $5,800 a month of spending". */
const filledWords = (fmt, cur, items) => listWords(items.map((x) => (x.case === "debt" ? `your ${x.name.toLowerCase()} (about ${fmt.money(Math.round(x.owed), cur)} owed)` : `about ${monthWords(fmt, cur, x.total)} of spending`)));
/** One of question 6's taps, as chips (role radio); `onPick` answers it on the card only (nothing is written). */
function askChips(ui, ask, value, onPick) {
  const chips = ask.options.map((o) => ui.h("button", { type: "button", class: `chip${value === o.value ? " on" : ""}`, role: "radio", "aria-checked": String(value === o.value), onClick: () => onPick(o.value) }, o.label));
  return ui.h("div", { class: "gs-ask" }, ui.h("p", {}, ask.question), ui.h("div", { class: "chips", role: "radiogroup", "aria-label": ask.question }, chips));
}
/** What the tap does beside the spending, in one line (UX review 6): what is owed and the home, and what you own minus what you owe. */
function effectWords(fmt, cur, items, effect) {
  const m = (v) => fmt.money(Math.round(Math.abs(v) / 1000) * 1000, cur);
  const debts = items.filter((x) => x.case === "debt"), spend = items.find((x) => x.case === "spend");
  const parts = [];
  if (debts.length) {
    const owe = listWords(debts.map((x) => `the ${m(x.owed)} you owe on ${x.key === "mortgage" ? "your home" : `your ${x.name.toLowerCase()}`}`));
    const home = effect.home > 0 ? ` and your home, worth about ${m(effect.home)}` : "";
    parts.push(`This counts ${owe}${home}, so what you own minus what you owe goes ${effect.net >= 0 ? "up" : "down"} by about ${m(effect.net)}`);
  }
  if (spend) parts.push(`${debts.length ? "and" : "This counts"} about ${monthWords(fmt, cur, spend.total)} of spending`);
  return parts.length ? `${parts.join(", ")}.` : null;
}
let cardTaps = {};   // the card's own answers to question 6's taps, until its tap writes them (nothing is written before)
/**
 * "Fill in what you skipped" (spec 11.4): one record per debt (what is owed, the payment and rate; with a mortgage and no home
 * in the plan, the home's value) and one for the spending (the month in all; question 6's open taps as chips; the rows in a
 * fold), what the tap changes, then "Use these guesses" (filled) and "Not now" (outlined). compact: the Dashboard's (no rows
 * fold). only: one case alone. onMine: Expenses' card, whose outlined button is "I'll type mine" (it writes nothing: the form).
 */
// `quiet`: the page already has its one filled button (the Dashboard's "Continue your plan"), so the card's first button is
// outlined (stress test 2026-11-11: two filled buttons on one screen)
export function fillCard(ctx, items0, { reg, today, say, compact = false, only = null, ignoreLater = false, onMine = null, title = null, quiet = false }) {
  const { ui, fmt, store } = ctx;
  const cur = ctx.plan?.meta?.currency ?? "USD";
  const m = (v) => fmt.money(Math.round(v), cur);
  const pct = (r) => `${Number((r * 100).toFixed(2))}%`;
  const opts = { estimators: reg.estimators, tables: reg.tables, today };
  const card = ui.h("section", { class: "card gs-card" });
  const asked = items0.find((x) => x.case === "spend")?.asks ?? [];
  const draw = (items) => {
    const spend = items.find((x) => x.case === "spend");
    const li = (x) => {
      if (x.case === "debt") return ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.name), ui.h("span", { class: "rec-value" }, `about ${m(x.owed)} owed`)),
        ui.h("div", { class: "rec-sub" }, x.paidAs ? `${monthWords(fmt, cur, x.payment)} (your “${x.paidAs}” on Expenses${x.paidUnder && x.paidUnder !== "debt" && x.paidUnder !== "housing" ? ", moved under Loan and card payments so it counts once" : ""}) at ${pct(x.rate)} a year` : `${monthWords(fmt, cur, x.payment)} at ${pct(x.rate)} a year`),
        x.home ? ui.h("div", { class: "rec-sub" }, `Your home: worth about ${m(x.home)}`) : null,
        ui.h("div", { class: "gs-why" }, `Our guess: ${sentence(x.why)}`));
      if (x.case === "spend") return ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.mortgage ? "Day-to-day spending (not the mortgage)" : "Everyday spending"), ui.h("span", { class: "rec-value" }, `about ${monthWords(fmt, cur, x.total)}`)),
        ui.h("div", { class: "gs-why" }, `Our guess: typical for ${x.who}.`),
        // (a mortgage on Net worth with no payment on Debts: this spending leaves it out, and nothing counts it yet; C7 verify V2)
        x.mortgageUnpaid ? ui.h("div", { class: "rec-sub" }, "Your mortgage's payment isn't on Debts yet, so it isn't counted.") : null,
        x.mortgageUnpaid ? ui.h("a", { class: "gs-link", href: "#/balance/liabilities" }, "Add it on Debts ›") : null,
        x.retire ? ui.h("div", { class: "rec-sub" }, `Once you stop working: about ${monthWords(fmt, cur, x.retire)}`) : null,
        // the questions it first asked stay, the answer picked (it can be changed until the tap)
        ...[...asked, ...x.asks.filter((a) => !asked.some((b) => b.key === a.key))].map((a) => askChips(ui, a, cardTaps[a.key] ?? null, (v) => { cardTaps = { ...cardTaps, [a.key]: v }; redraw(); })),
        compact ? null : ui.h("details", { class: "fold" },
          ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How it adds up"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
          ui.h("ul", { class: "gs-rows" }, x.rows.map((r) => ui.h("li", {}, ui.h("span", {}, r.row === "housing" && x.mortgage ? `${r.label} (tax and insurance are in the mortgage payment)` : r.label), ui.h("span", {}, m(r.value)))))));
      return null;
    };
    const effect = effectWords(fmt, cur, items, fillEffect(items));
    const spendOnly = items.length === 1 && items[0].case === "spend";
    const lead = onMine && spendOnly ? `Households like yours (${spend?.who ?? "like yours"}) spend about ${monthWords(fmt, cur, spend?.total ?? 0)}${spend?.mortgage ? ", besides the mortgage" : ""}. Use our guesses to start, and type your own figures as you learn them.`
      : `When your plan was set up, ${items.length === 1 && items[0].case === "spend" ? "your spending was left blank, so it isn't counted yet" : "some boxes were left blank, so these aren't counted yet"}. Here is what's typical for a household like yours.`;
    // (the DOM's own replaceChildren writes a null as the text "null": the parts left out are filtered first)
    card.replaceChildren(...[ui.h("style", {}, CARD_STYLE),
      ui.h("h2", {}, title ?? "Fill in what you skipped"),
      ui.h("p", {}, lead),
      ui.h("ul", { class: "records" }, items.map(li)),
      effect && !(onMine && spendOnly) ? ui.h("p", { class: "gs-effect" }, effect) : null,
      ui.h("p", { class: "gs-note" }, `Nothing changes until you tap. After that, you can type your real figures any time${onMine ? " in the list below" : " on Expenses and Debts"}.`),
      ui.h("div", { class: "row" },
        ui.button("Use these guesses", () => {
          const taps = cardTaps; cardTaps = {};
          say("ok", `Saved: ${filledWords(fmt, cur, items)} ${items.length > 1 ? "are" : "is"} counted now. Type the real figures${onMine ? " in the list below" : " on Expenses and Debts"} when you have them.`, undoOf(ctx.plan));
          store.update((draft) => { useFillGuesses(draft, { ...opts, taps, ...(only ? { only } : {}), ...(ignoreLater ? { ignoreLater } : {}) }); });
        }, quiet ? { class: "secondary" } : undefined),
        onMine
          ? ui.button("I'll type mine", () => { onMine(); }, { class: "secondary" })
          : ui.button("Not now", () => { cardTaps = {}; say("ok", "Nothing was changed. We'll ask again in a month; Our guesses for you keeps them until then."); store.update((draft) => { fillLater(draft, today); }); }, { class: "secondary" }))].filter((x) => x !== null && x !== undefined && x !== false));
  };
  const redraw = () => { let items = items0; try { items = fillOffers(ctx.plan, { ...opts, taps: cardTaps, ...(only ? { only } : {}), ...(ignoreLater ? { ignoreLater } : {}) }); } catch { items = items0; } draw(items.length ? items : items0); };
  if (Object.keys(cardTaps).length) redraw(); else draw(items0);
  return card;
}
/**
 * "Is something missing?" (spec 11.6): what households like this spend against what is listed (to the dollar), our guesses for
 * the rows with nothing of their own kind listed (less what is listed under their other kinds), what the list comes to with
 * them, then "Add our guesses for the rest" (filled) and "That's everything" (outlined, guide.spendComplete). here: the page it
 * is on ("expenses": the list is below it).
 */
export function missingCard(ctx, x, { reg, today, say, here = null, quiet = false }) {
  const { ui, fmt, store } = ctx;
  const cur = ctx.plan?.meta?.currency ?? "USD";
  const round = (v) => Math.round(v / (v >= 1000 ? 100 : 10)) * (v >= 1000 ? 100 : 10);
  const m = (v) => fmt.money(Math.round(v), cur);
  const where = here === "expenses" ? "in the list below" : "on Expenses";
  return ui.h("section", { class: "card gs-card", id: "gs-missing" }, ui.h("style", {}, CARD_STYLE),
    ui.h("h2", {}, "Is something missing?"),
    ui.h("p", {}, `Households like yours usually spend about ${fmt.money(round(x.usual), cur)} a month. You've listed ${m(x.typed)}.`),
    ui.h("ul", { class: "records" }, ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, "Not listed yet"), ui.h("span", { class: "rec-value" }, `about ${monthWords(fmt, cur, x.rest)}`)),
      ui.h("div", { class: "gs-why" }, "Our guesses for what's not on your list:"),
      ui.h("ul", { class: "gs-rows" },
        x.rows.map((r) => ui.h("li", {}, ui.h("span", {}, r.listed > 0.5 ? `${r.name}, besides the ${m(r.listed)} you listed` : r.name), ui.h("span", {}, m(r.value)))),
        ui.h("li", { class: "gs-sum" }, ui.h("span", {}, "With these, your list comes to"), ui.h("span", {}, `about ${fmt.money(round(x.withThese ?? x.typed + x.rest), cur)}`))))),
    ui.h("p", { class: "gs-note" }, "Nothing changes until you tap. Each one goes on your list of bills, and you can change it any time."),
    ui.h("div", { class: "row" },
      ui.button("Add our guesses for the rest", () => { say("ok", `Added our guesses for what wasn't listed: about ${monthWords(fmt, cur, x.rest)}. Change any of them ${where} when you know the real figure.`, undoOf(ctx.plan)); store.update((draft) => { addSpendGuesses(draft, { estimators: reg.estimators, tables: reg.tables, today }); }); }, quiet ? { class: "secondary" } : undefined),
      ui.button("That's everything", () => { say("ok", `Noted: what's listed is everything. ${here === "expenses" ? "You can ask for this again just below the totals." : "You can ask for this again on Expenses."}`); store.update((draft) => { spendIsComplete(draft, today); }); }, { class: "secondary" })));
}
/** A change of under 2% in an amount is not listed (it is still written with the rest): it would only be noise. */
export const smallChange = (x) => x.kind === "money" && Number(x.from) > 0 && Math.abs(x.to - x.from) / Number(x.from) < 0.02;
/** "Better guesses are ready" on the Dashboard (spec 11.5): the first change or two with why, the same two buttons as Our guesses
 *  for you, and a link to the rest there. */
export function upgradeCard(ctx, up, { reg, today, say, quiet: calm = false }) {
  const { ui, fmt, store } = ctx;
  const cur = ctx.plan?.meta?.currency ?? "USD";
  const words = (x, v) => (x.kind === "percent" ? `${Number((v * 100).toFixed(3))}%` : x.kind === "money" ? `${fmt.money(v, cur)}${x.unit === "month" ? " a month" : x.unit === "year" ? " a year" : ""}` : String(v));
  const listed = up.filter((x) => !smallChange(x)), quiet = up.length - listed.length;
  const shown = listed.slice(0, 2), more = listed.length - shown.length;
  return ui.h("section", { class: "card gs-card" }, ui.h("style", {}, CARD_STYLE),
    ui.h("h2", {}, "Better guesses are ready"),
    ui.h("p", {}, "We now fill in figures from where you live and what you told us. Some of the figures we filled in for you before would change:"),
    ui.h("ul", { class: "records" }, shown.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.label)),
      ui.h("div", { class: "rec-sub" }, `From ${words(x, x.from)} to ${words(x, x.to)}`),
      x.why ? ui.h("div", { class: "gs-why" }, `Our new guess: ${sentence(x.why)}`) : null))),
    ui.h("p", { class: "gs-note" }, [more ? `And ${more === 1 ? "one more" : `${more} more`}.` : "", quiet ? `Plus ${quiet === 1 ? "one small change" : `${quiet} small changes`} of under 2%.` : "", "Nothing moves until you say so."].filter(Boolean).join(" ")),
    // (its own line, 44 px tall: a link inside the sentence is a 16 px target on a phone)
    ui.h("a", { class: "gs-link", href: "#/overview/guesses", style: { marginBottom: "8px" } }, "See all on Our guesses for you ›"),
    ui.h("div", { class: "row" },
      ui.button("Use the new guesses", () => { say("ok", `Saved: ${up.length === 1 ? "the new guess is" : `the ${up.length} new guesses are`} in your plan. They follow your answers from now on.`, undoOf(ctx.plan)); store.update((draft) => { useNewGuesses(draft, { estimators: reg.estimators, tables: reg.tables, today }); }); }, calm ? { class: "secondary" } : undefined),
      ui.button("Keep the old ones", () => { say("ok", "Kept: your older figures stay as they are. We won't ask again."); store.update((draft) => { keepOldGuesses(draft, today); }); }, { class: "secondary" })));
}


export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const today = fmt.today();
  const cur = plan?.meta?.currency ?? "USD";
  const reg = registryOf(ctx);
  const d = compute(plan, { estimators: reg.estimators, tables: reg.tables, today });
  const root = ui.h("div", { class: "gs-root" }, ui.h("style", {}, STYLE));
  page.append(root);

  // a rate as the plan keeps it: to a thousandth of a percent (6.125%, 6.875%), as Get started and the box save it
  const pctNumber = (v) => Number((v * 100).toFixed(3));
  const pctText = (v) => `${pctNumber(v)}%`;
  const accountNames = (ids) => (ids ?? []).map((id) => (plan.accounts ?? []).find((a) => a.id === id)?.name).filter(Boolean);
  const shown = (r) => {
    if (r.kind === "percent") return pctText(r.value);
    if (r.kind === "list") { const n = accountNames(r.value); return n.length ? n.join(", ") : "none yet"; }
    if (r.kind === "number") return String(r.value);
    return `${fmt.money(r.value, cur)}${r.unit === "month" ? " a month" : r.unit === "year" ? " a year" : ""}`;
  };
  const say = (kind, text, undo = null, home = null) => { pending = { kind, text, undo, home }; };
  // this visit (a new address is a new visit): the rows kept or saved, each shown as one line where it was until the person
  // leaves, so the next row does not slide under the thumb, and whether "Matters most" had rows when the visit began (F2)
  if (ctx.route !== visit.route) visit = { route: ctx.route, done: new Map(), hadBig: null, ord: new Map(), upH: 0 };
  // each row's place as first drawn this visit: a kept row's line goes back to it (attack2: they came out in reverse order)
  const ordOf = (path) => { if (!visit.ord.has(path)) visit.ord.set(path, visit.ord.size); return visit.ord.get(path); };
  for (const r of [...d.big, ...d.small]) ordOf(r.path);
  const onHome = (home) => (home ? ` Change it any time on ${home.name}${/[?.!]$/.test(home.name) ? "" : "."}` : "");
  const left = d.big.length + d.small.length;
  visit.hadBig ??= d.big.length > 0;

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Our guesses for you"),
    ui.h("p", { class: "lede" }, d.count && d.bank.length === d.count
      ? "Your spending rows are read from your bank files and follow them as new ones come in. Type your own figure to keep one as it is."
      : d.count
      ? "We filled in what you skipped with typical figures, so your plan works before you know every number. The first few change your answers the most. Type the real figure when you have it."
      : "When you leave a box empty, we fill in a typical figure so your plan still works. Every figure we fill in shows up here."),
    // how much is left, counting down in view (F1)
    left || visit.done.size ? ui.h("p", { class: "lede", style: { fontWeight: "600", marginTop: "8px" } }, left ? `${left} to look over` : "All looked over") : null));
  if (pending) { root.append(sayNotice(ctx, pending, say)); ctx.announce?.(pending.text); pending = null; }

  // "Is this the same loan?" (C2 review D2): a debt or home Get started guessed beside one of its kind added later;
  // counted twice until the person says which it is
  const twins = d.offers.twins ?? [];
  if (twins.length) {
    const m = (v) => fmt.money(Math.round(v), cur);
    const noun = (t) => (t.kind === "home" ? "home" : "loan");
    root.append(ui.card(twins.length === 1 ? `Is this the same ${noun(twins[0])}?` : "Did you add any of these twice?",
      ui.h("ul", { class: "records" }, twins.map((t) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${t.twinName} and ${t.name}`)),
        ui.h("p", {}, `You added ${t.twinName}, ${m(t.twinAmount)}. We also have ${t.name}, with our guess of about ${m(t.amount)}${t.kind === "home" ? "" : " still owed"}. If they're the same ${noun(t)}, it's counted twice now.`),
        ui.h("div", { class: "row" },
          ui.button(`Yes, the same ${noun(t)}`, () => { say("ok", `Done: ${t.twinName} counts once, and our guess for ${t.name} is gone.`); store.update((draft) => { sameLoan(draft, t.id, t.twinId); }); }),
          ui.button(`No, two ${noun(t)}s`, () => { say("ok", `Kept both: ${t.twinName} and ${t.name} count as two ${noun(t)}s. We won't ask about these two again.`); store.update((draft) => { twoLoans(draft, t.id, t.twinId, today); }); }, { class: "secondary" })))))));
  }

  // "Fill in what you skipped" (spec 11.4, C7): blanks a plan made before the guesses has, with our guess for each; after "Not
  // now" they stay here, folded, so the page never says there is nothing to look over while they wait (UX review 7)
  const fill = d.offers.fill ?? [], skipped = d.offers.skipped ?? [];
  if (fill.length) root.append(fillCard(ctx, fill, { reg, today, say }));
  else if (skipped.length) {
    const what = listWords(skipped.map((x) => (x.case === "debt" ? `your ${x.name.toLowerCase()}` : "your spending")));
    root.append(ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("h2", {}, `Skipped for now: ${what}`), ui.h("span", { class: "fold-status" }, "Show our guesses"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      fillCard(ctx, skipped, { reg, today, say, ignoreLater: true })));
  }

  // "Better guesses are ready" (spec 11.5): the figures Get started filled in before stay as they are until a tap here.
  // A change of under 2% in an amount is not listed (it is still written with the rest): it would only be noise
  const up = d.offers.upgrade;
  const small = (x) => x.kind === "money" && Number(x.from) > 0 && Math.abs(x.to - x.from) / Number(x.from) < 0.02;
  const listed = up.filter((x) => !small(x)), quiet = up.length - listed.length;
  if (!listed.length && visit.upH) {
    // the card was here this visit and its figure was just settled: a short line keeps its height, so the rows below do not
    // move up under the thumb (attack2: Credit cards' "That's about right" slid under a tap meant for the car loan)
    root.append(ui.h("section", { class: "card", style: { minHeight: `${visit.upH}px` } }, ui.h("h2", {}, "Better guesses"), ui.h("p", { class: "muted" }, "Nothing left to change here.")));
  }
  if (listed.length) {
    const words = (x, v) => (x.kind === "percent" ? pctText(v) : x.kind === "money" ? `${fmt.money(v, cur)}${x.unit === "month" ? " a month" : x.unit === "year" ? " a year" : ""}` : String(v));
    const upCard = ui.card("Better guesses are ready",
      ui.h("p", {}, `We now fill in figures from where you live and what you told us. ${listed.length === 1 ? "This one would change" : `These ${listed.length} would change`}; nothing moves until you say so.`),
      ui.h("ul", { class: "records" }, listed.map((x) => ui.h("li", {},
        // the label on its own line and the change under it: side by side, a long label broke into one word a line at 390 px
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.label)),
        ui.h("div", { class: "rec-value" }, `From ${words(x, x.from)} to ${words(x, x.to)}`),
        ui.h("div", { class: "gs-why" }, `Our new guess: ${sentence(x.why)}`)))),
      quiet ? ui.h("p", { class: "muted small" }, `Plus ${quiet === 1 ? "one small change" : `${quiet} small changes`} of under 2%.`) : null,
      ui.h("div", { class: "row" },
        ui.button("Use the new guesses", () => { say("ok", `Saved: ${up.length === 1 ? "the new guess is" : `the ${up.length} new guesses are`} in your plan. They follow your answers from now on.`, undoOf(ctx.plan)); store.update((draft) => { useNewGuesses(draft, { estimators: reg.estimators, tables: reg.tables, today }); }); }),
        ui.button("Keep the old ones", () => { say("ok", "Kept: your older figures stay as they are. We won't ask again."); store.update((draft) => { keepOldGuesses(draft, today); }); }, { class: "secondary" })));
    root.append(upCard);
    try { requestAnimationFrame(() => { visit.upH = Math.round(upCard.getBoundingClientRect().height) || 0; }); } catch { /* no layout here (tests) */ }
  }

  if (!d.count && visit.done.size) {
    // the last row kept or typed this visit: the lines stay, and the page says it is all looked over (attack2: it said
    // "every figure is one you typed" about guesses just kept, and jumped to the top)
    const lines = [...visit.done.values()].sort((a, b) => a.at - b.at).map((x) => ui.h("li", { class: "gs-done", style: x.h ? { minHeight: `${x.h}px` } : {} }, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `\u2713 ${x.line}`))));
    root.append(ui.card("All looked over", ui.h("ul", { class: "records" }, ...lines),
      ui.h("div", { class: "row" }, ui.h("a", { class: "btn secondary", href: "#/overview/dashboard" }, "Back to the Dashboard"))));
    root.append(sourcesFold());
    return;
  }
  if (!d.count) {
    // (with the fill card above, it is the page: "every figure is one you typed" would say the opposite of it)
    if (fill.length || skipped.length) { root.append(sourcesFold()); return; }
    root.append(d.planEmpty
      ? ui.card("Nothing to look over yet",
        ui.h("p", {}, "Answer the questions in Set up my plan. Any box you leave empty gets a figure typical for a household like yours, and it shows up here so you can check it or type the real one."),
        ui.h("div", { class: "row" }, ui.h("a", { class: "btn", href: "#/overview/setup" }, "Get started"), ui.h("a", { class: "btn secondary", href: "#/overview/dashboard" }, "Back to the Dashboard")))
      : ui.card("Nothing to look over",
        ui.h("p", {}, "Every figure in your plan is one you typed. If you leave a box empty later, the figure we fill in shows up here."),
        ui.h("div", { class: "row" }, ui.h("a", { class: "btn secondary", href: "#/overview/dashboard" }, "Back to the Dashboard"))));
    root.append(sourcesFold());
    return;
  }

  /** One guess: what it is, our figure, why, the box for the real figure, and "That's about right". */
  function record(r, { bank = false } = {}) {
    const err = ui.h("div", { class: "gs-err", "aria-live": "polite" });
    let sure = null;   // the far-off figure the person was asked about, kept on a second Save
    const li = ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.label), r.kind !== "list" ? ui.h("span", { class: "rec-value" }, shown(r)) : null),
      r.kind === "list" ? ui.h("div", { class: "rec-sub" }, shown(r)) : null,
      // (a row read from the person's own bank files, R12, is theirs in all but name: "From your bank files, last three months.")
      ui.h("div", { class: "gs-why" }, r.frozen || r.stale ? r.why : /^your bank files\b/.test(r.why ?? "") ? `From ${sentence(r.why)}` : `Our guess: ${sentence(r.why)}`),
      err);
    const home = homeOf(r.path);
    // (the line keeps the row's height for this visit, so the next row stays where it was, not under the thumb)
    const mark = (line) => visit.done.set(r.path, { line, group: d.big.includes(r) ? "big" : "more", at: ordOf(r.path), h: Math.round(li.getBoundingClientRect?.().height || 0) });
    // a guessed mortgage payment kept (or typed as the same figure) keeps the tax and insurance it held (escrowKept, 2026-11-07)
    const keep = () => {
      const undo = undoOf(ctx.plan);
      mark(`${r.label}: kept at ${shown(r)}`);
      say("ok", `Kept. ${r.label} stays at ${shown(r)}, and it counts as yours now.${onHome(home)}`, undo, home);
      const held = escrowBefore(ctx.plan, today);
      store.update((draft) => { confirmGuess(draft, r.path); escrowKept(draft, held, today); });
    };
    if (r.kind === "list") {
      li.append(ui.h("div", { class: "gs-foot" },
        ui.button("That's about right", keep, { class: "secondary small" }),
        r.href ? ui.h("a", { class: "btn secondary small", href: r.href }, "Change it on Goals ›") : null));
      return li;
    }
    const aria = `${r.label}, leave blank to use our guess of about ${shown(r)}`;
    let box, input, read;
    if (r.kind === "money") {
      ({ box, input } = ui.moneyBox({ name: "real", placeholder: fmt.amountText(r.value), label: aria, min: 0 }));
      read = () => ui.moneyValue(input);
    } else {
      input = ui.h("input", { type: "text", name: "real", inputmode: "decimal", autocomplete: "off", placeholder: r.kind === "percent" ? String(pctNumber(r.value)) : String(r.value), "aria-label": aria });
      box = ui.h("span", { class: "money-in" }, input, r.kind === "percent" ? ui.h("span", { class: "money-sign", "aria-hidden": "true", style: { left: "auto", right: "12px" } }, "%") : null);
      if (r.kind === "percent") input.style.paddingRight = "34px";
      read = () => {
        const t = String(input.value).replace(/[%\s,]/g, "");
        if (!t) return null;
        const n = Number(t);
        if (!Number.isFinite(n) || n < 0 || (r.kind === "percent" && n > 100)) return NaN;
        return r.kind === "percent" ? Math.round(n * 1000) / 100000 : n;
      };
    }
    const form = ui.h("form", { class: "gs-form", onSubmit: (e) => {
      e.preventDefault();
      const v = read();
      if (v === null || Number.isNaN(v)) {
        err.replaceChildren(ui.notice("error", v === null ? "Type the real figure first, or tap “That's about right” to keep ours." : r.kind === "percent" ? "Type the rate as a number, like 6.5 for 6.5%." : "Type an amount in numbers, like 4,500."));
        input.focus();
        return;
      }
      const words = r.kind === "percent" ? pctText(v) : `${fmt.money(v, cur)}${r.unit === "month" ? " a month" : r.unit === "year" ? " a year" : ""}`;
      // far off our guess (a slip of a key: 12500 for 1250): asked once, a second Save keeps it (attack2, 2026-11-11)
      if (farOff(r, v) && sure !== v) {
        sure = v;
        err.replaceChildren(ui.notice("error", `${words} is far from our guess of about ${shown(r)}. If it's right, tap Save again.`));
        input.focus();
        return;
      }
      // a debt's older payment was worked out at its rate: a new rate leaves it behind, so say so (it leads the page next)
      const pay = /^debts\[[^\]]+\]\.rate$/.test(r.path) && Math.abs(v - r.value) > 1e-9 ? d.rows.find((x) => x.path === r.path.replace(/\.rate$/, ".minPayment") && x.legacy && !x.stale) : null;
      const undo = undoOf(ctx.plan);
      mark(`${r.label}: ${words}, yours now`);
      say("ok", `Saved. ${r.label} is ${words} now. It's yours, so we won't change it.${pay ? ` Your payment of ${shown(pay)} was worked out at the old rate, so type your real one too.` : ""}${onHome(home)}`, undo, home);
      const held = escrowBefore(ctx.plan, today);
      store.update((draft) => { saveField(draft, r.path, { value: v, guessed: false }, null, today); escrowKept(draft, held, today); });
    } }, box, ui.h("button", { type: "submit", class: "secondary" }, "Save"));
    // outlined until something is typed in its box: three filled Saves beside empty boxes competed for the eye (F1)
    input.addEventListener?.("input", () => { form.querySelector?.("button[type=submit]")?.classList.toggle("secondary", !String(input.value).trim()); });
    li.append(form);
    if (!bank) li.append(ui.h("div", { class: "gs-foot" }, ui.button("That's about right", keep, { class: "secondary small" })));
    return li;
  }

  // at most four open at the top (a phone screen or so; C2 review, UX 10): the rest of the big ones fold with the small
  const lead = Math.max(4, d.big.filter((r) => r.frozen || r.stale).length);
  const big = d.big.slice(0, lead), more = [...d.big.slice(lead), ...d.small];
  // while what is left each month waits on our spending guesses (Next best action's spare.waits, spec 8.1), spending leads:
  // every other page says it is the figure to type next, so this one does too (C3 UX review 6). It opens question 6, the
  // screen made for typing it; the rows stay below one by one.
  let spendLead = null;
  try { const nba = ctx.computeOf?.("overview/next-best-action", { today }); if (nba?.ready && nba.spare.waits) spendLead = nba.spare; } catch { spendLead = null; }
  // (with a guessed mortgage payment in it, the figure says so: the fill card's "day-to-day spending" left the mortgage out; UX
  // review 4) and, with bank files that set no row yet, why not and what to do (UX review 3)
  const withMortgage = d.rows.some((r) => /^debts\[[^\]]+\]\.minPayment$/.test(r.path) && /^debt\.mortgage\./.test(r.k));
  const spendRecord = spendLead ? ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, withMortgage ? "Spending, with the mortgage payment" : "Everyday spending"), ui.h("span", { class: "rec-value" }, `about ${fmt.money(Math.round(spendLead.guessedMonthly / 10) * 10, cur)} a month`)),
    ui.h("div", { class: "gs-why" }, `${spendLead.spending - spendLead.guessedMonthly < 5 ? "All of your spending is" : "Most of your spending is"} our guesses for now, and it decides whether your month works. Type what you really spend, row by row, on one screen.`),
    d.bankNote ? ui.h("div", { class: "gs-why" }, d.bankNote.text, " ", ui.h("a", { href: d.bankNote.link.href }, d.bankNote.link.label)) : null,
    ui.h("div", { class: "gs-foot" }, ui.h("a", { class: "btn small", href: "#/overview/setup/spend?back=done" }, "Type yours \u203a"))) : null;
  // the rows looked over this visit, one line each where they were (F2)
  const doneLine = (x) => ui.h("li", { class: "gs-done", style: x.h ? { minHeight: `${x.h}px` } : {} }, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `\u2713 ${x.line}`)));
  const withDone = (rows, group) => {
    const out = rows.map(record);
    const items = rows.map((r, i) => ({ at: ordOf(r.path), el: out[i] }));
    for (const [path, x] of visit.done.entries()) if (x.group === group && !rows.some((r) => r.path === path)) items.push({ at: x.at, el: doneLine(x) });
    return items.sort((a, b) => a.at - b.at).map((x) => x.el);
  };
  const bigDone = [...visit.done.values()].some((x) => x.group === "big");
  if (big.length || spendRecord) root.append(ui.card(d.frozen || d.stale ? "Type these first" : "Matters most", ui.h("ul", { class: "records" }, spendRecord, ...withDone(big, "big"))));
  // the group finished this visit: it says so, rather than vanishing with the next group opening by itself (F2)
  else if (bigDone) root.append(ui.card("Matters most: all looked over", ui.h("ul", { class: "records" }, ...withDone([], "big"))));
  if (d.bank.length) {
    root.append(ui.h("details", { class: "card fold fold-card", open: big.length || spendRecord ? null : true },
      ui.h("summary", {}, ui.h("h2", {}, "Read from your bank files"), ui.h("span", { class: "fold-status" }, `${d.bank.length} ${d.bank.length === 1 ? "row" : "rows"}`), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("p", { class: "muted small" }, "These follow your bank files as new ones come in. Type your own figure to keep one as it is."),
      ui.h("ul", { class: "records" }, d.bank.map((r) => record(r, { bank: true })))));
  }
  if (more.length) {
    // open by itself only when the page was opened with nothing above it; never as the first group empties (F2)
    root.append(ui.h("details", { class: "card fold fold-card", open: big.length || visit.hadBig || spendRecord ? null : true },
      ui.h("summary", {}, ui.h("h2", {}, d.big.length > lead ? "More of our guesses" : "Matters less"), ui.h("span", { class: "fold-status" }, `${more.length} ${more.length === 1 ? "guess" : "guesses"}`), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("ul", { class: "records" }, ...withDone(more, "more"))));
  }
  root.append(ui.h("section", { class: "card flat" },
    ui.h("p", { class: "muted" }, d.lookedAt ? `You looked these over on ${fmt.date(d.lookedAt)}. Type a real figure whenever you have one.` : "Looked them over? Say so here. You can type a real figure any time."),
    ui.h("div", { class: "row" }, ui.button("These look fine", () => { say("ok", "Thanks. Our guesses stay as they are until you type the real figures."); store.update((draft) => { draft.guide = draft.guide ?? {}; draft.guide.guessesLookedAt = today; }); }, { class: "secondary" }))));

  const reviewed = plan?.assumptions?.reviewedAt;
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "What the plan assumes about prices and markets"), ui.h("span", { class: "fold-status" }, reviewed ? "Looked over" : "Worth a look"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", {}, "How fast prices rise, what investments earn and how long the money has to last are the same for everyone until you change them. They are not guesses about you."),
    ui.h("div", { class: "row" }, ui.h("a", { class: "btn secondary", href: "#/system/assumptions" }, "Change them ›"))));
  root.append(sourcesFold());

  /**
   * Where the figures come from: for each table, our name for it, the publisher, the publisher's table, a plain "as of"
   * line and the day we read it, with a 44 px link to the table. The ones behind your guesses first. A plan that takes no
   * U.S. figures (core/estimate applies) is told so, with no list.
   */
  function sourcesFold() {
    const used = new Set(d.sources.used.map((s) => s.id));
    const item = (s) => ui.h("li", {},
      ui.h("div", { class: "rec-title" }, s.title),
      ui.h("div", { class: "rec-sub" }, `${s.shownBy ?? s.publisher}${s.industry ? " (an industry survey)" : ""}${s.derived ? " (worked out from the published data)" : ""}`),
      s.tableShown ? ui.h("div", { class: "rec-sub" }, s.tableShown) : null,
      ui.h("div", { class: "rec-sub" }, `${s.asOf ?? s.vintage}. Read ${fmt.date(s.readOn)}.`),
      s.url ? ui.h("a", { class: "btn secondary small", href: s.url, target: "_blank", rel: "noopener" }, "The table ›") : null);
    const others = d.sources.all.filter((s) => !used.has(s.id));
    const status = d.applies ? `${d.sources.all.length} tables from ${d.sources.orgs} publishers` : "Not used for your plan";
    return ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("h2", {}, "Where our guesses come from"), ui.h("span", { class: "fold-status" }, status), ui.h("span", { class: "fold-chev" }, "›")),
      d.applies
        ? ui.h("p", { class: "muted small" }, "Public figures from government surveys, plus a few industry surveys where no public one exists. Some guesses are worked out from your own answers instead, and say so.")
        : ui.h("p", {}, `We fill in typical figures only for households in the U.S. that count in dollars, so none of these tables is used for your plan.${d.count ? " The figures above were filled in when a box was left blank: type the real ones when you have them." : ""}`),
      d.applies && d.sources.used.length ? ui.h("div", { class: "gs-group" }, "Behind the guesses above") : null,
      d.applies && d.sources.used.length ? ui.h("ul", { class: "records gs-src" }, d.sources.used.map(item)) : null,
      d.applies && others.length ? ui.h("div", { class: "gs-group" }, d.sources.used.length ? "On hand for other guesses" : "On hand for when we fill in a figure") : null,
      d.applies && others.length ? ui.h("ul", { class: "records gs-src" }, others.map(item)) : null);
  }
}
