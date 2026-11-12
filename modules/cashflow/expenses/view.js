// modules/cashflow/expenses/view.js -- DOM only. Totals, a breakdown by category with bars,
// a tappable list of expenses, one form to add or edit.
import { bankVsPlan } from "../income-statement/compute.js";
import { compute, billsFoldOpen, CATEGORIES, closeGap, addFromBank, fromBankWords, BANK_SPREAD } from "./compute.js";
import { PERIOD_OPTIONS, periodLabel } from "../../../core/math/periods.js";
import { isGuess, clearGuess, applies } from "../../../core/estimate/index.js";
import { applyLeftOver, applyMonthTotal, spendAnswers } from "../../overview/setup/compute.js";
import { yearSavingWords, leftFromWords, leftGoalsWords } from "../../../core/math/leftover.js";
import { dayWords } from "../../overview/next-best-action/compute.js";
import { spendMissing, spendSaidComplete, spendAskAgain, spendBankNote, fillOffers } from "../../overview/guesses/compute.js";

/**
 * The groups named in the clash notice: at most four, then "and N more", so the names and the total it gives agree; a name
 * with a comma in it ("Car, gas and transit") is kept whole by joining with ";" (left2 fix round 1, L-8).
 */
export function groupNamesWords(names, max = 4) {
  const shown = names.slice(0, max), rest = names.length - shown.length;
  const list = rest > 0 ? [...shown, `${rest} more`] : shown;
  if (list.length <= 1) return list.join("");
  const sep = shown.some((x) => x.includes(",")) ? "; " : ", ";
  return `${list.slice(0, -1).join(sep)}${list.length > 2 && sep === "; " ? ";" : ""} and ${list[list.length - 1]}`;
}
import { missingCard, fillCard, registryOf, sayNotice } from "../../overview/guesses/view.js";

const FIELDS = [
  { key: "name", label: "What is it", type: "text", required: true, placeholder: "e.g. Rent" },
  { key: "category", label: "Category", type: "select", options: Object.entries(CATEGORIES).map(([value, c]) => ({ value, label: c.label })) },
  { key: "amount", label: "Amount", type: "money", required: true, min: 0, help: "what you pay each time" },
  { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS },
  { key: "essential", label: "I must pay this (not optional)", type: "checkbox" },
  { key: "inflates", label: "Goes up with prices over the years", type: "checkbox" },
  { key: "startDate", label: "Starts", type: "date", help: "leave blank if it has already started" },
  { key: "endDate", label: "Ends", type: "date", help: "leave blank if it does not end" },
];

const periodWords = (p) => periodLabel(p).toLowerCase();
// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;
let missingSaid = null;
// #/cashflow/expenses?edit=<id>&back=<group/id>: Bills, Subscriptions and Irregular expenses open one expense's form here (CF-5,
// F2), once per address; its green line then carries "Back to <that page> ›"
let landedOn = null;
let landedHere = false;   // this address carried ?back= (set each render from the route)   // the line "Is something missing?" leaves, shown where it was

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  // a row our guesses read from the person's own bank files (R12, C7): said "from your bank", not "our guess"
  const isBank = (x) => typeof x?.id === "string" && plan.guesses?.[`expenses[${x.id}].amount`]?.s === BANK_SPREAD && isGuess(plan, `expenses[${x.id}].amount`);
  // One left-over figure across the app: what is left after tax, spending and saving, the same number the Dashboard
  // and Next best action show. Pay before tax minus spending (this page's own leftOver) left tax out and read about
  // twice as high; it shows only when the after-tax figure cannot be worked out yet, and says so.
  const nba = d.income ? ctx.computeOf("overview/next-best-action", { today: fmt.today() }) : null;
  // our guesses' cards here (spec 11.4, 11.6; overview/guesses): only while that page is in use. Nothing is written before a tap.
  const gm = ctx.modules?.get?.("overview/guesses");
  const reg = gm && ctx.isReady?.(gm) && ctx.features?.enabled?.(gm) ? registryOf(ctx) : null;
  const gOpts = reg ? { estimators: reg.estimators, tables: reg.tables, today: fmt.today() } : null;
  let miss = null;
  if (gOpts && d.count > 0) { try { miss = spendMissing(plan, gOpts); } catch { miss = null; } }
  if (!miss?.rows?.length) miss = null;
  const leftTile = () => {
    if (!d.income) return null;
    // the tile opens Next best action's "Each month's money", which shows how the figure is reached
    const linked = (t) => { t.append(ui.h("span", { class: "stat-chev", "aria-hidden": "true" }, "\u203a")); return ui.h("a", { href: "#/overview/next-best-action", class: "stat-link", "aria-label": `${t.textContent.replace("\u203a", "").trim()}. See how it is worked out` }, t); };
    // short on the careful month (uneven pay counted at what you can count on): said so, with what a month that brings the
    // Income page's amount leaves (review 2026-11-02)
    // (the full-month figure to the nearest $10, as every page says it: Next best action's spare.fullAbout; round 5)
    // within $5 of $0 the full month "only just about breaks even" (spare.fullKind), never "about $0" (round 5)
    // most of the spending is our guesses (spec 8.1): the figure waits for the real spending, said calmly
    if (nba?.ready && nba.spare.waits) return linked(ui.stat("Left over", "Depends on your spending", nba.spare.monthly < 0 ? `Our guess is more than comes in, so it is probably too high. Open "See or change each bill" to type your real month.` : `With our guesses, about ${fmt.money(Math.round(Math.abs(nba.spare.monthly) / 10) * 10, cur)} spare each month. Open "See or change each bill" to type yours.`, { link: true }));
    // the list is far below what households like this spend ("Is something missing?" just below): the figure waits on it, calm
    // (C7 UX review 2: "$4,368 Left over" right above the question read as money to spare)
    if (nba?.ready && miss) return linked(ui.stat("Left over", "Depends on your spending", `Your list may be missing about ${fmt.money(Math.round(miss.rest / 10) * 10, cur)} a month. See "Is something missing?" just below.`, { link: true }));
    if (nba?.ready) { const v = nba.spare.monthly, held = nba.spare.held > 0.5, kind = nba.spare.fullKind, about = nba.spare.fullAbout; return linked(ui.stat(v >= 0 ? "Left over" : nba.drawing ? "From savings" : "Short", fmt.money(Math.abs(v), cur), v >= 0 ? `each month, after tax, bills and saving${nba.spare.debtExtra > 0 ? `, and ${fmt.money(nba.spare.debtExtra, cur)} extra on debts` : ""}${held ? `, counting uneven pay at what you can count on` : ""}` : nba.drawing ? "each month, as your retirement plan intends" : held ? `in a lean month; when all your uneven pay comes in, ${kind === "ahead" ? `about ${fmt.money(about, cur)} is left` : kind === "even" ? "it only just about breaks even" : `it is still about ${fmt.money(-about, cur)} short`}` : "more goes out than comes in, after tax and saving", { link: true })); }
    return ui.stat("Before tax", fmt.money(d.leftOver, cur), "pay minus spending each month; tax and saving not taken out yet");
  };
  // "Set your month in one number" (owner, 2026-11-07): the month said as what is left over in checking, or as one spending
  // figure; the other is worked out and written into the same rows Get started's spending question writes (setup compute.js
  // applyLeftOver / applyMonthTotal). The bills typed on this page stay; the rows are what is not listed here.
  const monthCard = () => {
    if (!d.income) return null;
    const m = (v) => fmt.money(Math.round(v), cur);
    const note = nba?.ready ? nba.spare.fromLeft : null;
    const guess = applies(plan) ? ctx.guess : null;
    const host = ui.h("div");
    const answers = spendAnswers(plan);
    const sayNo = (r, know, n, ins) => {
      const what = know === "left" ? (n < 0 ? "that" : `a ${m(n)} leftover`) : `${m(n)} a month`;
      // the spending groups typed on Get started are rows of this very list (setup-x-...): said by name, with the amount, and settled here
      // (follow-up 2026-11-07: this said "Get started, question 6" and gave no way to say the leftover is right)
      if (r.why === "typed") {
        const mine = (plan.expenses ?? []).filter((x) => typeof x.id === "string" && x.id.startsWith("setup-x-") && x.id !== "setup-x-total" && !isGuess(plan, `expenses[${x.id}].amount`));
        const names = groupNamesWords(mine.map((x) => x.name));
        const pair = ui.h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" } },
          ui.h("button", { type: "button", class: "secondary", onClick: () => host.replaceChildren() }, "My spending is right"),
          know === "left" ? ui.h("button", { type: "button", class: "secondary", onClick: () => {
            // the leftover wins: the groups typed give way to our split of what it leaves room for (rows: {} = none typed)
            const again = { ...ins, rows: {} };
            const c = structuredClone(plan), r2 = applyLeftOver(c, again, fmt.today(), { guess });
            if (!r2.ok) { sayNo(r2, know, n, again); return; }
            pending = `Done: ${n < 0 ? `with your checking going down ${m(-n)} a month` : `with ${m(n)} left over each month`}, you spend about ${m(r2.month)} a month. The groups you typed were replaced by our split of that.`;
            store.update((p) => { applyLeftOver(p, again, fmt.today(), { guess }); });
          } }, "What's left over is right") : null);
        host.replaceChildren(ui.h("div", {}, ui.notice("warn", `The spending you typed in groups${names ? ` (${names})` : ""} comes to ${m(r.allowed + r.over)} a month, which is more than ${what} allows. With that ${know === "left" ? "leftover" : "month"}, your groups can add up to at most ${m(Math.max(0, r.allowed))} a month. They are in the list of bills below. Which is right?`), pair));
        return;
      }
      const text = r.why === "pay" ? "What comes in and your bills are needed first to work this out. Add them, then try again."
        : r.why === "more-than-pay" ? (r.available > 0 ? `That is more than comes in after tax and saving (about ${m(r.available)} a month). Check the amount.` : "That is more than comes in after tax and saving. Check the amount, or add what comes in first.")
        : r.why === "step" ? "We could not match that amount, even to within a couple of dollars. Try a figure a few dollars higher or lower."
        : `Your bills and loan payments listed on this page come to ${m(r.over)} a month more than ${what} allows. Which is right: this amount, or your bills? Check the bills below, or type a different amount.`;
      host.replaceChildren(ui.notice("error", text));
    };
    // the same plain choice as Get started, in the person's words: what stays in checking, or what they spend
    let know = "left";
    const formHost = ui.h("div");
    const drawForm = () => {
      const left = know === "left";
      formHost.replaceChildren(ui.form([
        { key: "amount", label: left ? "How much does your checking go up in a normal month?" : "About how much do you spend in a month, in all?", type: "money", required: true,
          help: left ? "Before you move any to savings. Type a minus sign if it goes down, like -200. Not counting what comes out of your paycheck for retirement, or any extra you pay on debts." : "Everything, loan payments included." },
      ], { amount: left && note ? note.left : null }, (v) => {
        if (v.amount === null) { host.replaceChildren(ui.notice("error", "Type an amount first, like 1,000.")); return false; }
        const ins = left ? { ...answers, left: v.amount } : { ...answers, total: v.amount };
        const c = structuredClone(plan);
        const r = left ? applyLeftOver(c, ins, fmt.today(), { guess }) : applyMonthTotal(c, ins, fmt.today(), { guess });
        if (!r.ok) { sayNo(r, know, v.amount, ins); return false; }
        const goals = Number(r.spare?.goalSaving) || 0;
        // every group typed leaves the rest in one rough line that is not a bill you must pay: said plainly (follow-up 2026-11-07)
        const rough = c.expenses.find((x) => x.id === "setup-x-total" && x.essential === false);
        const roughWords = rough ? ` The ${m(rough.amount)} left after the groups you typed is one rough "Other spending" line, and it is not counted as bills you must pay.` : "";
        const lead = left ? `Done: ${v.amount < 0 ? `with your checking going down ${m(-v.amount)} a month` : `with ${m(v.amount)} left over each month`}, you spend ${r.about ? "about " : ""}${m(r.month)} a month.${!r.about ? "" : Math.round(r.left) < 0 ? ` The closest we can get is checking going down about ${m(-Math.round(r.left))} a month, because your tax credits move in steps.` : ` The closest we can get is a leftover of about ${m(Math.round(r.left))} a month, because your tax credits move in steps.`}` : `Done: your month is ${m(v.amount)} in all. Your bills are kept${rough ? "." : " and the rest is shared over the usual groups."}`;
        pending = `${lead}${left && goals >= 1 && v.amount >= 0 ? ` Your goals take ${m(goals)} of the ${m(v.amount)}.` : ""}${roughWords} ${left && r.spare ? yearSavingWords(r.spare, m) : ""}`.trim();
        store.update((p) => { if (left) applyLeftOver(p, ins, fmt.today(), { guess }); else applyMonthTotal(p, ins, fmt.today(), { guess }); });
      }, { submitLabel: "Save my month" }));
      // the left-over may go below zero ("-200"): a phone's number pad has no minus sign on an iPhone, so this box asks for the
      // keyboard that has one, as Get started's left-over box does (verify 2026-11-07)
      if (left) formHost.querySelector?.('input[name="amount"]')?.setAttribute?.("inputmode", "text");
    };
    const choice = ui.h("div", { class: "chips", role: "radiogroup", "aria-label": "What do you know?" });
    const drawChoice = () => choice.replaceChildren(...[["left", "I know what's left over"], ["spend", "I know what I spend"]].map(([k, label]) =>
      ui.h("button", { type: "button", class: `chip${know === k ? " on" : ""}`, role: "radio", "aria-checked": String(know === k), onClick: () => { know = k; host.replaceChildren(); drawChoice(); drawForm(); } }, label)));
    drawChoice(); drawForm();
    const moved = note ? nba.spare.leftOver - note.left : 0;
    const details = ui.h("details", { class: "fold ex-fold" },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Set your month in one number"), ui.h("span", { class: "fold-status" }, note ? (note.left < 0 ? `checking down ${m(-note.left)} a month` : `${m(note.left)} left over a month`) : "leftover or spending"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" },
        ui.h("p", { class: "muted small" }, "Not sure of every bill? Tell us what is left over in a normal month, or what you spend in all, and we work out the other."),
        // below zero with goals, what makes the shortfall is said too ("Your goals take another $300 ...": left2 fix round 1, L-3)
        note ? ui.h("p", { class: "small" }, `Your spending was worked out on ${dayWords(note.on)} from ${leftFromWords(note.left, m)}${nba.spare.goalSaving >= 1 && note.left > 0 ? `, of which your goals take ${m(nba.spare.goalSaving)} a month` : ""}.${Math.abs(nba.spare.leftOver - note.left) < 10 ? leftGoalsWords(note.left, nba.spare.goalSaving, m) : ""}`, Math.abs(moved) >= 10 ? ` Your pay, tax, bills or saving have changed since, so what is left over now reads ${nba.spare.leftOver < 0 ? `checking going down ${m(-nba.spare.leftOver)} a month` : m(nba.spare.leftOver)}. The spending stays as we worked it out. If ${note.left < 0 ? "that" : m(note.left)} is still right, type it again below and we will update your spending.` : "") : null,
        choice, formHost, host));
    details.open = !!note;
    return details;
  };
  let editing = null;
  // short each month: say by how much, then the fewest nice-to-haves that close it (tap one to change it), the biggest
  // must-pays when that is not enough, and the goal saving that could pause; Next best action's first step lands here
  const gapCard = () => {
    if (!(nba?.ready && nba.spare.monthly < 0) || nba.spare.waits) return null;   // never what to cut on our guesses
    // retired and living on savings as the plan intends: a calm line, not a list of things to cut
    if (nba.drawing) return ui.h("section", { class: "card" }, ui.h("h2", {}, "Drawn from savings"),
      ui.h("p", {}, `About ${fmt.money(-nba.spare.monthly, cur)} a month comes from your savings. If your investments do about average, your plan can pay for ${fmt.money(nba.drawing.affordableMonthly, cur)} a month of spending and the money lasts; less in a bad run of years (Will the money last? shows how much less).`),
      ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "Will the money last? ›")));
    const g = closeGap(d.items, -nba.spare.monthly, { goalSaving: nba.spare.goalSaving });
    const m = (v) => fmt.money(v, cur);
    // short only on the careful month (Side income's "count on"): a month that brings the Income page's amount leaves money,
    // so good months make up for lean ones and no must-pay has to go (review 2026-11-02)
    const held = nba.spare.held > 0.5, kind = nba.spare.fullKind, lean = held && kind === "ahead";
    const open = (id) => { const x = plan.expenses.find((y) => y.id === id); if (!x) return; editing = x; showForm = true; openFold(); drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); };
    const row = (x, detail) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" }, onClick: () => open(x.id),
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name), ui.h("div", { class: "d" }, detail)),
      ui.h("span", { class: "st amount" }, ui.h("div", {}, m(x.monthly)), ui.h("div", { class: "muted small" }, "a month"), ui.h("div", { class: "muted small" }, "Change \u203a")));
    // a trim in the expense's own terms, the amount its form asks for: "$360 once a year instead of $3,000"
    const trimText = (x) => x.period === "monthly" ? `trimming it by ${m(x.trimBy)} a month is enough` : `${m(x.trimTo)} ${periodWords(x.period)} instead of ${m(x.amount)} is enough`;
    const lead = !g.picks.length ? (lean ? "There are no expenses you could cut. Good months make up for lean ones; keep your emergency fund for the months in between." : "There are no expenses you could cut, so the gap has to come from the bills you have to pay below or from what goes to saving.")
      : g.enough ? (g.picks.length === 1 ? (g.picks[0].trimBy ? `${g.picks[0].name}: ${trimText(g.picks[0])}.` : `Cutting ${g.picks[0].name} closes it.`) : `Cutting ${g.picks.length === 2 ? "these two" : `these ${g.picks.length}`} expenses closes it:`)
      : `Cutting everything that could be cut (${m(g.niceTotal)} a month) still leaves ${m(g.gap - g.covered)} short${lean ? " in a lean month. Good months make up for the rest; keep your emergency fund for the months in between." : "."}`;
    const must = g.bigMustPays.length && !lean;
    return ui.h("section", { class: "card gap-card" },
      ui.h("h2", {}, "Close the gap"),
      ui.notice("warn", held ? `About ${m(g.gap)} a month more goes out than comes in, after tax and saving, counting uneven pay at what you can count on (Side income). ${lean ? `A month that brings the Income page's amount leaves about ${m(nba.spare.fullAbout)}, so this is about the lean months.` : kind === "even" ? "Even a month that brings the Income page's amount only just about breaks even. This is the first thing to fix." : `Even a month that brings the Income page's amount is about ${m(-nba.spare.fullAbout)} short. This is the first thing to fix.`}`
        : `About ${m(g.gap)} a month more goes out than comes in, after tax and what goes to saving. This is the first thing to fix.`),
      ui.h("p", {}, lead),
      g.picks.length ? ui.h("ul", { class: "page-list" }, g.picks.map((x) => row(x, x.trimBy ? `could be cut \u00b7 ${trimText(x)}` : "could be cut"))) : null,
      must ? ui.h("p", { class: "small", style: { margin: "12px 0 0" } }, g.picks.length ? "The rest has to come from cutting bills you have to pay. The biggest:" : "The biggest bills you have to pay:") : null,
      must ? ui.h("ul", { class: "page-list" }, g.bigMustPays.map((x) => row(x, "a bill you have to pay \u00b7 a cheaper version closes part of it"))) : null,
      g.goalSaving > 0 ? ui.h("p", { class: "muted small" }, `Or for now: ${m(g.goalSaving)} a month goes to your goals, and pausing some of it closes ${g.goalSaving >= g.gap ? "the gap" : "part of the gap"}. `, ui.h("a", { href: "#/goals/goals" }, "Goals \u203a")) : null,
      // the saved debt plan's extra counts as spoken for; when it is what tips the month over, lowering it is a way out too
      nba.spare.debtExtra > 0 ? ui.h("p", { class: "muted small" }, `Or: ${m(nba.spare.debtExtra)} a month extra goes to debts on top of the required payments, and lowering it closes ${nba.spare.debtExtra >= g.gap ? "the gap" : "part of the gap"}. `, ui.h("a", { href: "#/debt/payoff" }, "Pay off debts ›")) : null,
      ui.h("p", { class: "muted small" }, "Tap one to change its amount or give it an end date. The leftover figure updates as soon as you save."),
    );
  };

  const out = ui.h("div");
  // the bills fold under one button when there are many and most are our guesses (part 3 of the path: the page opens short);
  // short lists and lists the person has mostly typed stay open. Every action that needs the list or the form opens it.
  // (billsFoldOpen in compute.js: counted by bills, so a plan fresh from Get started opens short)
  const shortOpen = billsFoldOpen(plan, d.items);
  const foldBody = ui.h("div", { class: "fold-body" });
  const fold = ui.h("details", { class: "fold ex-fold" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "See or change each bill"), ui.h("span", { class: "fold-status" }, `${d.count} ${d.count === 1 ? "bill" : "bills"}`), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "\u203a")), foldBody);
  // a save, edit or remove just happened inside the list: keep it open after the re-render, and show the confirmation above the
  // fold (inside a closed fold it was hidden: verify 2026-11-06)
  fold.open = shortOpen || !!pending;
  const openFold = () => { fold.open = true; };
  const backKey = /^[a-z0-9-]+\/[a-z0-9-]+$/.test(ctx.route?.query?.back ?? "") ? ctx.route.query.back : null;
  const backMod = backKey ? ctx.modules?.get?.(backKey) : null;
  landedHere = !!backMod;
  // with a way back the line stays (its button must not leave under the thumb) and is drawn where the form was; without, as before
  let backNote = null;
  if (pending) {
    const n = ui.notice("ok", pending);
    if (backMod) { n.append(ui.h("div", { class: "row", style: { marginTop: "8px" } }, ui.h("a", { class: "btn", href: `#/${backKey}` }, `Back to ${backMod.title} ›`))); backNote = n; }
    else { out.append(n); setTimeout(() => n.remove(), 4000); }
    pending = null;
  }

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What goes out?"),
      ui.h("p", { class: "lede" }, "Add your regular expenses: rent or mortgage, utilities, groceries, insurance, the car, subscriptions. Rough numbers are fine to start."),
      ui.h("p", { class: "muted small" }, "Mark each one as something you must pay or something that is nice to have. That split is what the emergency-fund and retirement pages use."),
    ));
    // not sure what you spend? our guesses for the rows, one tap (spec 11.4's spending case; with a debt it left out too, the
    // same card as the Dashboard's, so both say the same figures; "Not now" there hides it there only; C7 UX review 8)
    let offer = null;
    if (gOpts) { try { offer = fillOffers(plan, { ...gOpts, ignoreLater: true }); } catch { offer = null; } }
    if (!offer?.some((x) => x.case === "spend")) offer = null;
    if (missingSaid) { root.append(sayNotice(ctx, missingSaid, (kind, text, undo = null) => { missingSaid = { kind, text, undo }; })); missingSaid = null; }
    { const mc = monthCard(); if (mc) root.append(mc); }
    const spendOnly = offer?.length === 1;
    if (offer) root.append(fillCard(ctx, offer, { reg, today: fmt.today(), only: spendOnly ? "spend" : null, ignoreLater: true, title: spendOnly ? "Not sure what you spend?" : null,
      say: (kind, text, undo = null) => { missingSaid = { kind, text, undo }; }, onMine: () => { formHost.scrollIntoView?.({ behavior: "smooth", block: "start" }); formHost.querySelector?.("input")?.focus?.(); } }));
  } else {
    root.append(ui.card(null, ui.row(
      ui.stat("Per month", fmt.money(d.monthly, cur), d.guessedMonthly > 0 ? (d.monthly - d.guessedMonthly < 5 ? "all of it our guesses for now" : `about ${fmt.money(Math.round(d.guessedMonthly / 10) * 10, cur)} of it our guesses for now`) : `${fmt.money(d.yearly, cur)} a year`),
      leftTile(),
    ),
    // Next year and one-time amounts as one sentence under the tiles (design log 2026-09-16, pass 3).
    ui.h("p", { class: "muted small", style: { marginTop: "10px" } },
      // (with our guesses in the month, to three figures: it is not known to the dollar)
      `Next year about ${fmt.money(d.guessedMonthly > 0 ? Number(d.nextYear.toPrecision(3)) : d.nextYear, cur)} once prices rise.` +
      (d.oneTime ? ` One-time costs coming up: ${fmt.money(d.oneTime, cur)}, not in the monthly total.` : "")),
    ));
    { const mc = monthCard(); if (mc) root.append(mc); }
    // "Is something missing?" (spec 11.6): the list typed here is far below what households like this spend; one question with
    // our guesses for the rows not listed (overview/guesses spendMissing; nothing is written before a tap)
    const sayMissing = (kind, text, undo = null) => { missingSaid = { kind, text, undo }; };
    if (missingSaid) { root.append(sayNotice(ctx, missingSaid, sayMissing)); ctx.announce?.(missingSaid.text); missingSaid = null; }
    if (miss) root.append(missingCard(ctx, miss, { reg, today: fmt.today(), say: sayMissing, here: "expenses" }));
    // "That's everything" said, and the list is still far short: one muted line to ask again (UX review 7)
    else if (gOpts && plan.guide?.spendComplete) {
      let again = false;
      try { again = spendSaidComplete(plan, gOpts); } catch { again = false; }
      if (again) root.append(ui.h("div", { class: "row", style: { alignItems: "center", margin: "4px 0 12px" } }, ui.h("span", { class: "muted small" }, "You said this list is everything."),
        ui.button("Ask me again", () => { missingSaid = { kind: "ok", text: "We'll ask again: the question is just below the totals." }; store.update((p) => { spendAskAgain(p); }); }, { class: "secondary small" })));
    }
    // two months of bank files that set no spending row yet: why not, and what to do (C7 UX reviews 1 and 3)
    let bankNote = null;
    if (gOpts) { try { bankNote = spendBankNote(plan, gOpts); } catch { bankNote = null; } }
    if (bankNote) root.append(ui.h("p", { class: "muted small", style: { margin: "0 0 12px" } }, bankNote.text, " ", ui.h("a", { href: bankNote.link.href }, bankNote.link.label)));
    // the bank files show more going out than this page lists (bankVsPlan): each kind the bank shows more of, one tap to add
    // the rest, so every figure in the plan follows (round 4, 2026-11-02)
    let bk = null;
    try { bk = bankVsPlan(plan, { today: fmt.today() }); } catch { bk = null; }
    const ten = (v) => Math.round(v / 10) * 10;
    // months left out for a payment that went to one of two cards (ledger unsureWords), said under the card that compares
    const unsureNote = () => ((bk?.unsure ?? []).length ? ui.h("p", { class: "muted small" }, bk.unsure.map((u) => u.text).join(" ")) : null);
    // the gap is mostly payments to a card whose file isn't in: nobody has seen what they bought, so its file comes first,
    // never an "Add" for it (re-check 4, 2026-11-02)
    // (two cards at one bank with no file for either: "Bring in the card files", over the months whole but for them; re-check 5)
    const cf = bk?.cardFile;
    if (cf) root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, `${cf.title} before adding more here`),
      ui.h("p", {}, `Over the last ${cf.months}${cf.whole ? " whole" : ""} months about ${fmt.money(ten(cf.monthly), cur)} a month went to ${cf.the} from your bank, but ${cf.plural ? "their own files aren't in, so what they bought isn't sorted into kinds yet. Bring them in" : "its own file isn't in, so what it bought isn't sorted into kinds yet. Bring it in"}, then compare again.`),
      ui.row(ui.h("a", { class: "btn", href: cf.href }, cf.title)), unsureNote()));
    if (bk?.over) {
      root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Your bank shows more going out"),
        ui.h("p", {}, `Over the last ${bk.months} whole months your bank files show about ${fmt.money(ten(bk.bankOut), cur)} a month going out; this page lists ${fmt.money(ten(bk.planOut), cur)}. Add what is missing, and every figure in the plan follows.${bk.cards >= 1 ? ` Another ${fmt.money(ten(bk.cards), cur)} a month went to cards whose files aren't in; that is not counted here until their files show what it bought.` : ""}`),
        bk.lines.length ? ui.h("ul", { class: "page-list" }, bk.lines.map((x) => ui.h("li", {},
          ui.h("span", { class: "ic" }, x.icon),
          // a row of ours (x.ours): the bank's figure takes the place of our guess, so the line says "our guess" and "Use"
          ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.label), ui.h("div", { class: "d" }, x.ours ? (x.plan - x.ours.amount > 0.5 ? `bank about ${fmt.money(ten(x.bank), cur)} a month, listed here ${fmt.money(ten(x.plan), cur)}, ${fmt.money(ten(x.ours.amount), cur)} of it our guess` : `bank about ${fmt.money(ten(x.bank), cur)} a month, our guess ${fmt.money(ten(x.plan), cur)}`) : x.plan > 0.5 ? `bank about ${fmt.money(ten(x.bank), cur)} a month, listed here ${fmt.money(ten(x.plan), cur)}` : `bank about ${fmt.money(ten(x.bank), cur)} a month, not listed here`)),
          ui.h("span", { class: "st" }, ui.button(x.ours ? `Use ${fmt.money(ten(x.bank), cur)}` : `Add ${fmt.money(ten(x.more), cur)}`, () => {
            // (the words first: the page draws again inside store.update)
            const id = ui.uid(), said = addFromBank(structuredClone(plan), x, id);
            if (!said) return;
            pending = fromBankWords(said, cur);
            store.update((p) => { addFromBank(p, x, id); });
          }, { class: "secondary small" }))))) : null,
        bk.unfiled >= 50 ? ui.h("p", { class: "muted small" }, `About ${fmt.money(ten(bk.unfiled), cur)} a month of it is not filed under a kind yet. `, ui.h("a", { href: "#/transactions/categorize" }, "File it \u203a")) : null, unsureNote()));
    }
    const gc = gapCard();
    if (gc) root.append(gc);
    // a debt paid off whose payment is still listed: one tap stops it from today, and the left-over figure grows by it
    for (const x of d.ended ?? []) {
      root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, `${x.debtName} is paid off`),
        ui.h("p", {}, `Its payment, ${x.name} (${fmt.money(x.monthly, cur)} a month), is still counted here. Stop it, and that money is free for your next step.`),
        ui.row(ui.button(`Stop ${x.name} from today`, () => {
          pending = `${x.name} stopped: ${fmt.money(x.monthly, cur)} a month is free from today.`;
          const y = new Date(`${fmt.today()}T12:00:00`); y.setDate(y.getDate() - 1);
          const before = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
          store.update((p) => { const e = (p.expenses ?? []).find((z) => z.id === x.id); if (e) e.endDate = before; });
        }), ui.button("It is something else", () => { const e = plan.expenses.find((z) => z.id === x.id); if (!e) return; editing = e; showForm = true; openFold(); drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, { class: "secondary" }))));
    }
    // a kind that is only Get started's rows is named as the row ("Eating out and fun", "Home costs"), and one that is only
    // our guesses says so, its bar in the calm colour (a guess never looks like a figure the person gave)
    const ofKind = (c) => d.active.filter((x) => (CATEGORIES[x.category] ? x.category : "other") === c.category);
    const isOurs = (x) => typeof x.id === "string" && isGuess(plan, `expenses[${x.id}].amount`) && !isBank(x);
    const barOf = (c) => {
      const xs = c.virtual ? [] : ofKind(c), setupOnly = xs.length > 0 && xs.every((x) => String(x.id ?? "").startsWith("setup-x-"));
      return { label: setupOnly ? xs.map((x) => x.name).join(", ") : c.label, ours: xs.length > 0 && xs.every(isOurs), bank: xs.length > 0 && xs.every(isBank) };
    };
    foldBody.append(ui.row(
      ui.stat("Bills you have to pay", fmt.money(d.essentialMonthly, cur), "per month, the bills that cannot wait"),
      ui.stat("Could be cut", fmt.money(d.optionalMonthly, cur), "per month, nice to have but not needed")));
    root.append(out, fold);
    const activeCount = d.items.filter((x) => x.active).length;
    // one row per kind (Get started's seven rows): "Where it goes" would only repeat the list below it
    if (d.byCategory.length && d.byCategory.length < activeCount) foldBody.append(ui.card("Where it goes",
      ui.h("ul", { class: "page-list" }, d.byCategory.map((c) => { const b = barOf(c); return ui.h("li", {},
        ui.h("span", { class: "ic" }, c.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, b.label), ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(c.share * 100)}%`, ...(b.ours ? { background: "var(--muted)" } : {}) } }))),
        ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(c.monthly, cur)), ui.h("div", { class: "muted small" }, b.ours ? `a month \u00b7 our guess` : b.bank ? `a month \u00b7 from your bank` : `a month \u00b7 ${c.percent}%`)),
      ); })),
      // a payment kept only on the Debts page is counted, and said by name, so the total is never short of it
      d.fromDebts?.length ? ui.h("p", { class: "muted small", style: { margin: "10px 0 0" } }, `Counted from the Debts page, as no expense here is ${d.fromDebts.length === 1 ? "its" : "their"} payment: ${d.fromDebts.map((x) => `${x.name} ${fmt.money(x.monthly, cur)} a month`).join(", ")}. `, ui.h("a", { href: "#/balance/liabilities", class: "ex-link" }, "Debts \u203a")) : null,
    ));
  }
  // the before-tax "you spend more than comes in" gives way to the after-tax figure the tile shows, whichever way it falls
  for (const w of d.warnings) if (!(nba?.ready && w === d.overspend) && !(d.guessedShare >= 0.5 && w === d.overspend)) root.append(ui.notice("warn", w));
  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = d.count === 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (backNote) formHost.append(backNote);
    // opened from another page with a way back: after Cancel (or with no save) that way back is still offered
    else if (backMod && !editing && landedHere) formHost.append(ui.h("div", { class: "row", style: { marginBottom: "12px" } }, ui.h("a", { class: "btn secondary", href: `#/${backKey}` }, `Back to ${backMod.title} ›`)));
    if (!showForm && !editing) {
      formHost.append(ui.button("+ Add another expense", () => { showForm = true; drawForm(); }, { class: "secondary" }));
      return;
    }
    const values = editing ? { ...editing, inflates: editing.inflates !== false } : { category: "housing", period: "monthly", essential: true, inflates: true };
    const f = ui.form(FIELDS, values, (v) => {
      const clean = { name: v.name.trim(), category: v.category, amount: v.amount ?? 0, period: v.period, essential: !!v.essential, inflates: !!v.inflates, startDate: v.startDate || "", endDate: v.endDate || "" };
      if (!clean.name) return;
      // our guess typed over: the person's now (said, since the box opened with our figure in it)
      const wasOurs = editing && typeof editing.id === "string" && isGuess(plan, `expenses[${editing.id}].amount`);
      pending = editing ? (wasOurs ? `Changes saved: ${clean.name} is your figure now.` : "Changes saved.") : `${clean.name} added.`;
      store.update((p) => {
        p.expenses = p.expenses ?? [];
        // saving the form makes its amount the person's, even when it is the figure we guessed (it stops being ours)
        if (editing) { const i = p.expenses.findIndex((x) => x.id === editing.id); if (i >= 0) { p.expenses[i] = { ...p.expenses[i], ...clean }; clearGuess(p, `expenses[${editing.id}].amount`); } }
        else p.expenses.push({ id: ui.uid(), ...clean });
      });
      editing = null;
    }, { submitLabel: editing ? "Save changes" : "Add expense", resetAfter: !editing, onCancel: (editing || d.count > 0) ? () => { editing = null; showForm = false; drawForm(); } : null });
    // picking a category suggests whether it is a must-pay
    const catSel = f.querySelector("select[name=category]"), essBox = f.querySelector("input[name=essential]");
    if (catSel && essBox && !editing) catSel.addEventListener("change", () => { essBox.checked = (CATEGORIES[catSel.value] ?? CATEGORIES.other).essential; });
    const ours = editing && typeof editing.id === "string" && isGuess(plan, `expenses[${editing.id}].amount`);
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.name}` : "Add an expense"),
      ours ? ui.h("p", { class: "muted" }, isBank(editing) ? "This amount is what your bank files show going out on it, a month. It follows them until you type your own figure and save." : "This amount is our guess for now: what a household like yours usually spends. Type what you really pay and save, and it is yours.") : null,
      f,
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
        if (!ui.confirm(`Remove ${editing.name}?`)) return;
        const id = editing.id; const name = editing.name; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.expenses = (p.expenses ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null,
    ));
  };
  drawForm();
  const fresh = ctx.route !== landedOn; landedOn = ctx.route;
  const askedEdit = fresh && ctx.route?.query?.edit ? (plan.expenses ?? []).find((x) => x.id === ctx.route.query.edit) ?? null : null;
  if (fresh && ctx.route?.query?.edit && !askedEdit) out.append(ui.notice("info", "That expense is no longer on the list. It may have been removed; the rest are below."));

  if (d.count > 0) {
    const sub = (x) => {
      const ours = typeof x.id === "string" && isGuess(plan, `expenses[${x.id}].amount`);
      const bits = [...(ours ? [isBank(x) ? "From your bank files: tap to type yours" : "Our guess for now: tap to type yours"] : []), `${fmt.money(x.amount, cur)} ${x.periodLabel.toLowerCase()}`, x.categoryLabel, x.essential ? "a bill you have to pay" : "could be cut"];
      if (x.upcoming) bits.push(`starts ${fmt.date(x.startDate)}`);
      if (x.ended) bits.push(`ended ${fmt.date(x.endDate)}`);
      else if (x.endDate) bits.push(`until ${fmt.date(x.endDate)}`);
      return bits.join(" · ");
    };
    const rows = [...d.items].sort((a, b) => Number(b.active) - Number(a.active) || b.monthly - a.monthly);
    foldBody.append(ui.card("Expenses",
      ui.h("ul", { class: "page-list" }, rows.map((x) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer", opacity: x.active ? 1 : 0.6 },
        onClick: () => { editing = plan.expenses.find((y) => y.id === x.id); showForm = true; openFold(); drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, x.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name, x.active ? null : ui.h("span", { class: "pill" }, x.upcoming ? "not yet" : "ended")), ui.h("div", { class: "d" }, sub(x))),
        ui.h("span", { class: "st amount" }, !x.active ? ui.h("div", { class: "muted" }, x.upcoming ? "not yet" : "ended") : ui.h("div", {}, x.period === "once" ? fmt.money(x.amount, cur) : fmt.money(x.monthly, cur)), !x.active ? null : ui.h("div", { class: "muted small" }, x.period === "once" ? "one time" : "a month"), ui.h("div", { class: "muted small" }, "Edit \u203a")),
      ))),
      ui.h("p", { class: "muted small" }, d.guessedMonthly > 0 ? "Tap an expense to change it. Our guesses fill in what you haven't typed; as you type yours, the rest may adjust so the month stays near what households like yours spend in all." : "Tap an expense to change it."),
      formHost,
    ));
  } else {
    formCard.append(out, formHost);
    root.append(formCard);
  }
  root.append(ui.h("style", {}, ".st.amount { text-align: right; } .ex-fold { margin: 0 0 14px; } .ex-fold > summary { border: 1px solid var(--line-2); border-radius: var(--radius-sm); padding: 6px 14px; background: var(--panel); } .ex-fold[open] > summary { margin-bottom: 12px; } .ex-fold .fold-body { padding-top: 12px; } .ex-fold .fold-body > .row { margin-bottom: 12px; } .ex-fold .fold-title { color: var(--accent-ink); } .ex-link { display: inline; padding: 14px 4px; margin: -14px 0; }"));
  // opened at one expense: its form open and in view (the page scrolls itself, so the shell's "start at the top" gives way)
  if (askedEdit) { editing = askedEdit; showForm = true; openFold(); drawForm(); formHost.scrollIntoView({ block: "start" }); }
}
