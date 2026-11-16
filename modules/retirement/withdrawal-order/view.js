// modules/retirement/withdrawal-order/view.js -- DOM only. Which order wins for this plan and
// by how much, the best order and yours, the others one tap away, and one tap to make an order the
// plan's, with a way back. The fifth order takes a share from every account (gap list, next 60,
// item 22); the page is drawn simple first (docs/OPTIONAL.md; opt spec C14 for this page, done with it). "Try Roth conversions too"
// searches the five orders and Roth conversions together (gap list, next 60, item 23; mix.js), one quiet row before the method.
import { needButtons } from "../needs.js";
import { needItem } from "../../../core/words.js";
import { compute, chooseOrder, agesIn } from "./compute.js";
import { parts, rest } from "../../../core/ui/more.js";
import { mixGrid, runsNeeded, runMix, rankMixes, chooseMix, MIX_TITLE, ROTH_WORDS, leadWords, moveWords, rowWords, valueWords, orderTitle, tellWords, bestWords, triedWords, GAINS_WORDS, ownConverts, FLAT_MIX_WORDS, FLAT_CONV_WORDS, confirmMixWords, savedMixWords, backMixWords, busyWords } from "./mix.js";

let pending = null;
let mixPending = null;   // the green line after "Use this mix" (with its Undo) or after that Undo, shown on the next draw
let mixOpen = false;     // "Use this mix" or its Undo was tapped: the part is drawn open on the draw that follows (R17), then forgotten
// The search's runs for one plan. Every run sets the order, the conversions and the tax setting itself (mix.js planWith), so the
// runs are kept while only those change: after "Use this mix" or Undo the answer is there at once. Any other change starts afresh.
let memo = { key: null, runs: new Map() };
let job = null;          // the runs being worked out: { key, runs, todo, waiters }
/** The longest one slice of runs may take before the phone gets a turn (milliseconds). */
export const SLICE_MS = 25;

/** The plan as the search reads it: all of it but the fields every run sets itself and the plan's stamp (meta changes on every save). */
export function searchKey(plan, today) {
  const { meta, ...rest } = plan ?? {};
  const rt = { ...(rest.retirement ?? {}) };
  delete rt.taxMode; delete rt.withdrawalOrder; delete rt.withdrawalSplit;
  if (rt.rothConversion && typeof rt.rothConversion === "object") { const { on, fillRate, untilAge, ...rc } = rt.rothConversion; rt.rothConversion = rc; }
  return JSON.stringify([today, { ...rest, retirement: rt }]);
}
const runsOf = (plan, today) => { const key = searchKey(plan, today); if (memo.key !== key) { memo = { key, runs: new Map() }; job = null; } return memo; };
const clock = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
/** Work out the missing runs a slice at a time (SLICE_MS), a turn for the phone between slices; then call each waiter. Each
 * run carries the plan of the drawing that asked for it: a share from every account is run on that plan's own order. */
function work(plan, today, todo, done) {
  if (job && job.key === memo.key) {
    job.waiters.push(done);
    for (const x of todo) if (!job.todo.some((y) => y.rk === x.rk)) job.todo.push(x);
    return job;
  }
  const j = (job = { key: memo.key, runs: memo.runs, todo: [...todo], waiters: [done] });
  const step = () => {
    if (job !== j) return;   // the plan changed meanwhile: a newer search took over
    const t0 = clock();
    while (j.todo.length && clock() - t0 < SLICE_MS) {
      const x = j.todo.shift();
      if (j.runs.has(x.rk)) continue;
      let f = null;
      try { f = runMix(x.plan ?? plan, x.mix, { today }); } catch (e) { try { console.error("[planner] withdrawal-order mix", e); } catch { /* no console */ } }
      j.runs.set(x.rk, f);
    }
    if (j.todo.length) { setTimeout(step, 0); return; }
    job = null;
    for (const w of j.waiters) w();
  };
  setTimeout(step, 0);
  return j;
}
/** The search's answer for this plan if every run is done (null while runs are missing): for tests and the shell's own checks. */
export function searched(plan, today) {
  const grid = mixGrid(plan, { today });
  if (!grid.ready) return null;
  const m = runsOf(plan, today);
  return runsNeeded(grid).every((x) => m.runs.has(x.rk)) ? { grid, runs: m.runs, ...rankMixes(grid, m.runs) } : null;
}
/** Resolves once no runs are being worked out (tests). */
export const searchDone = () => new Promise((resolve) => { const wait = () => (job ? setTimeout(wait, 5) : resolve()); wait(); });

/**
 * The pills on a row of the five orders: "best" (accent) on the best order, "your plan" (green) on the plan's own, and one pill,
 * "your plan, the best" (green), when they are the same row (fix round, critic P4: "best" and "your plan" side by side read as two
 * answers, under a hero that already says the plan's order is the best one).
 */
export function orderPills(ui, o, best) {
  if (best && o.current) return [ui.h("span", { class: "pill ok" }, "your plan, the best")];
  return [best ? ui.h("span", { class: "pill accent" }, "best") : null, o.current ? ui.h("span", { class: "pill ok" }, "your plan") : null].filter(Boolean);
}
/** The order said in a sentence: only its first letter lower-cased ("pre-tax, then taxable, then Roth", never "roth"). */
const said = (o) => o.label.replace(/^./, (c) => c.toLowerCase());
/**
 * An order's note in its row, its first letter upper-cased. The order marked best for this plan never says "the usual worst" beside
 * its "best" (critic of x2, P2: after "Use this mix" the family read "best", "your plan" and "The usual worst: spends the tax-free
 * money first" on one row): "Spends the tax-free money first: usually the worst order, but the best for this plan."
 */
export function noteWords(o, best = false) {
  const n = best && /^the usual worst: /.test(o.note) ? `${o.note.replace(/^the usual worst: /, "")}: usually the worst order, but the best for this plan` : o.note;
  return n.replace(/^./, (c) => c.toUpperCase());
}
/**
 * The green line after a "Use ..." on this page (one sentence per case; module.test.mjs reads each). o: the order chosen;
 * bracketsOn: the plan already works out tax at the real rates; withRates: the tap also turns them on (the first card's button
 * on a flat-rate plan).
 *   real rates on         -> "The plan now draws a share from every account."
 *   flat rate, with them  -> "The plan now draws pre-tax, then taxable, then Roth and works out tax at the real rates, so the order counts. Every retirement page's figures change with it; to go back, pick the flat rate under Retirement settings on Will the money last?"
 *   flat rate, order only -> "The plan now draws pre-tax, then taxable, then Roth. It changes nothing until tax is worked out at the real rates (the button below)."
 */
export function choseWords(o, { bracketsOn, withRates = false }) {
  if (bracketsOn) return `The plan now draws ${said(o)}.`;
  if (withRates) return `The plan now draws ${said(o)} and works out tax at the real rates, so the order counts. Every retirement page's figures change with it; to go back, pick the flat rate under Retirement settings on Will the money last?`;
  return `The plan now draws ${said(o)}. It changes nothing until tax is worked out at the real rates (the button below).`;
}
/**
 * The line after "Put it back" (one per case): the order the plan had, by its name, or, for an order that is none of the five
 * (a custom one, put in the plan by hand), "the order you had"; and the flat rate, when the tap had turned the real rates on.
 *   -> "Back to "Taxable, then pre-tax, then Roth", as before."   /   "Back to the order you had, as before."
 *   withRates -> "Back to "Taxable, then pre-tax, then Roth" and the flat tax rate, as before."
 */
export const backWords = (was, { withRates = false } = {}) => `Back to ${was ? `"${was.label}"` : "the order you had"}${withRates ? " and the flat tax rate" : ""}, as before.`;
/**
 * The hero's headline and its one sentence (one per case; module.test.mjs reads each). best / current: the five's best and the
 * plan's own (null for an order that is none of the five); five: compute's ranking over the five; bracketsOn: the plan works out tax
 * at the real rates. The tax over the plan and the figure before tax are in each order's row (critic of 2026-11-15, P2: the hero
 * said the order's name twice and four figures).
 *   every order runs out    -> allFailWords below (the headline is then the alarm itself)
 *   yours is the best       -> "Your order leaves about $840,251 at the end, after tax and in today's dollars. The worst order leaves $18,123 less."
 *                              (... "For this plan the order barely matters." when the worst leaves $500 or less less)
 *   another; yours lasts    -> "This order leaves about $840,251 at the end, after tax and in today's dollars: $3,707 more than yours."
 *                              (... ", about as much as yours: for this plan the order barely matters." within $500)
 *   another; yours runs out -> "This order leaves about $840,251 at the end, after tax and in today's dollars; yours runs out in 2061."
 *   another; yours is none of the five -> as "yours is the best", with "This order" for "Your order".
 * Headline: "Your order is the best one for this plan", or on a flat-rate plan, where the order changes nothing yet, "Your order
 * is the best one at the real tax rates" (P1: it read as done while the green line said nothing had changed); otherwise
 * ""Pre-tax, then taxable, then Roth" works best for you".
 * Every order runs out (fix round r2: the renter's plan read "Your order is the best one ..." over "The money runs out under
 * every order"): the alarm is the headline, "The money runs out under every order" ("At the real tax rates, the money runs
 * out under every order" on a flat-rate plan), and the lede says which lasts longest, to when and what age (allFailWords).
 */
export function heroWords({ best, current, five, bracketsOn, orders = [], people = [] }, money) {
  if (!best.success) return { title: bracketsOn ? "The money runs out under every order" : "At the real tax rates, the money runs out under every order", lede: allFailWords({ best, current, orders, people }) };
  const title = best.current ? (bracketsOn ? "Your order is the best one for this plan" : "Your order is the best one at the real tax rates") : `"${best.label}" works best for you`;
  const left = `${best.current ? "Your" : "This"} order leaves about ${money(best.endAfterTaxReal)} at the end, after tax and in today's dollars`;
  if (current && !best.current) {
    if (!current.success) return { title, lede: `${left}; yours runs out in ${current.failYear}.` };
    // the two figures as shown, so the difference checks by hand ($840,251 - $836,544 = $3,707)
    const more = Math.round(best.endAfterTaxReal) - Math.round(current.endAfterTaxReal);
    return { title, lede: more > 500 ? `${left}: ${money(more)} more than yours.` : `${left}, about as much as yours: for this plan the order barely matters.` };
  }
  return { title, lede: `${left}. ${five.gainVsWorst > 500 ? `The worst order leaves ${money(five.gainVsWorst)} less.` : "For this plan the order barely matters."}` };
}

/**
 * When the money runs out, in words: "in 2067, when you are 65" (one person), "in 2067, when Ana is 77 and Bo is 79" (two named
 * people), "in 2067, at age 77" (a first person with no name), "in 2067" (no birth year).
 */
export function whenWords(year, people = []) {
  const a = agesIn(year, people);
  if (a.length === 1) return `in ${year}, when you are ${a[0].age}`;
  if (a.length === 2 && a[0].name && a[1].name) return `in ${year}, when ${a[0].name} is ${a[0].age} and ${a[1].name} is ${a[1].age}`;
  if (a.length) return `in ${year}, at age ${a[0].age}`;
  return `in ${year}`;
}
/** Every one of the five runs out the same year: the order makes no difference to when. */
export const allSameYear = (orders) => orders.length > 1 && orders.every((o) => !o.success && o.failYear === orders[0].failYear);
/**
 * The lede when every order runs out (one sentence per case; module.test.mjs reads each). best: the one that lasts longest
 * (the plan's own when it lasts as long); current: the plan's (null for an order that is none of the five); orders: the five.
 *   all the same year   -> "All five orders run out in 2067, when you are 65. Fix that first on the page called Will the money last?"
 *   yours lasts longest -> "Yours lasts longest: the money runs out in 2069, when you are 67. Fix that first on the page called Will the money last?"
 *   another lasts longer -> ""Pre-tax, then taxable, then Roth" lasts longest: the money runs out in 2069, when you are 67; under yours it runs out in 2067. Fix that first on the page called Will the money last?"
 *   yours is none of the five -> ""Pre-tax, then taxable, then Roth" lasts longest: the money runs out in 2069, when you are 67. Fix that first on the page called Will the money last?"
 * The page's name ends the sentence and is drawn as its link (ledeNodes; a person critic of r2: "Will the money last? is the
 * place ..." named a page in bare text, its question mark mid-sentence).
 */
export function allFailWords({ best, current, orders = [], people = [] }) {
  const fix = `Fix that first on the page called ${FIX_PAGE}`;
  // (short: the headline already says every order runs out, and the first view's words may only go down)
  if (allSameYear(orders)) return `All five orders run out ${whenWords(best.failYear, people)}. ${fix}`;
  if (best.current) return `Yours lasts longest: the money runs out ${whenWords(best.failYear, people)}. ${fix}`;
  if (current) return `"${best.label}" lasts longest: the money runs out ${whenWords(best.failYear, people)}; under yours it runs out in ${current.failYear}. ${fix}`;
  return `"${best.label}" lasts longest: the money runs out ${whenWords(best.failYear, people)}. ${fix}`;
}
/** The page the money running out is fixed on: its title, the last words of allFailWords, drawn as its link. */
export const FIX_PAGE = "Will the money last?";
const FIX_HREF = "#/retirement/projection";
/** The hero's lede as nodes: allFailWords' closing page name becomes its link; any other lede is its text. */
export function ledeNodes(ui, lede) {
  if (!lede.endsWith(` ${FIX_PAGE}`)) return [lede];
  return [lede.slice(0, -FIX_PAGE.length), ui.h("a", { href: FIX_HREF }, FIX_PAGE)];
}
/**
 * The flat-rate notice's first line (one per case): the order changes nothing yet, then what the real rates would show.
 *   yours is the best     -> "... With the real rates, this order is the best one; they also change the figures on every retirement page."
 *   every order runs out  -> "... Working tax out at the real rates changes the figures on every retirement page." (all the same year)
 *                            or "... makes it count, and changes ..." (one lasts longer): the hero already says which lasts
 *                            longest and when (a person critic of r2: the notice said "every order runs out the same year" again)
 *   another is better     -> "... Working tax out at the real rates makes it count, and changes the figures on every retirement page."
 */
export function flatWords({ yoursBest, allFail = false, sameYear = false }) {
  const head = "Your plan works out tax at one flat rate, so the order changes nothing yet.";
  if (sameYear) return `${head} Working tax out at the real rates changes the figures on every retirement page.`;
  if (!yoursBest || allFail) return `${head} Working tax out at the real rates makes it count, and changes the figures on every retirement page.`;
  return `${head} With the real rates, this order is the best one; they also change the figures on every retirement page.`;
}

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const openMix = mixOpen;   // read once, on the draw after "Use this mix" or its Undo
  mixOpen = false;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Which account to draw from first"), ui.h("p", { class: "lede" }, "Taxable, pre-tax or Roth first: the order changes the tax you pay over a lifetime. It needs the same answers as the Will the money last? page:"), ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, needItem(m)))), (needButtons(ui, d.missing) ?? ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Open Will the money last?")))));
    return;
  }
  // the four orders and the fifth, a share from every account, ranked together (compute's `five`)
  const all = [...d.options, d.share];
  const current = all.find((o) => o.current);
  // when every order runs out, the plan's own order is the one marked best while it lasts as long as any (a tie goes to the first
  // listed: "Use ..." would change nothing); and in a tie, none is called best
  const ranked = all.find((o) => o.key === d.five.best);
  const best = d.five.allFail && current && current.failYear === ranked.failYear ? current : ranked;
  const sameYear = d.five.allFail && allSameYear(all);
  const isBest = (o) => o === best;
  // choosing an order on a flat-rate plan changes nothing until tax is worked out at the real rates, which moves every retirement
  // figure, often more than the order does. So the rows' buttons set the order only and say so, and the first card's filled button
  // on such a plan names both changes ("... with the real tax rates") and its green line says every page's figures change (stress
  // test 2026-11-11, x-4, and two reviews of it). Every choice has its way back (the kit's undo: only what the tap changed)
  const choose = (o, withRates = false) => {
    const pend = { text: choseWords(o, { bracketsOn: d.bracketsOn, withRates }), undoText: backWords(current, { withRates }), undo: null };
    pending = pend;
    const change = (p) => chooseOrder(p, o, { withRates });
    if (ui.undoable) pend.undo = ui.undoable(store, change); else store.update(change);
  };
  const realRates = () => { pending = "Your plan now works out tax at the real rates (the federal brackets), so the order counts. Every retirement page's figures change with it; to go back, pick the flat rate under Retirement settings on Will the money last?"; store.update((p) => { p.retirement = p.retirement ?? {}; p.retirement.taxMode = "brackets"; }); };
  const words = heroWords({ best, current, five: d.five, bracketsOn: d.bracketsOn, orders: all, people: d.people }, money);
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, words.title),
    ui.h("p", { class: "lede" }, ...ledeNodes(ui, words.lede)),
    // the best order, one tap away on the first screen (x-4: the three buttons were a screen and more below)
    !best.current ? ui.row(ui.button(d.bracketsOn ? `Use "${best.label}"` : `Use "${best.label}" with the real tax rates`, () => choose(best, !d.bracketsOn))) : null,
  ));
  const out = ui.h("div");
  if (pending) {
    const pend = pending;
    const text = typeof pend === "string" ? pend : pend.text;
    const n = ui.notice("ok", text);
    // a choice's line stays, with its way back, until the next change (as on How much to take out, stress test R4)
    if (typeof pend === "object") n.append(ui.row(ui.button("Put it back", () => {
      if (!pend.undo) return;
      pending = pend.undoText;
      const r = pend.undo();
      if (!r?.done) pending = null; else if (r.kept) pending = ui.undoneWords(r, pend.undoText);
    }, { class: "secondary" })));
    else setTimeout(() => n.remove(), 4000);
    out.append(n); pending = null;
    if (typeof pend === "object" && typeof requestAnimationFrame === "function") requestAnimationFrame(() => { try { if (n.getBoundingClientRect().top < 64) n.scrollIntoView({ block: "center", behavior: "auto" }); } catch { /* a nicety */ } });
  }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  // the plan works out tax at one flat rate: said plainly, with the switch here (x-4)
  if (!d.bracketsOn) root.append(ui.h("div", { class: "notice info" },
    ui.h("p", { style: { margin: "0 0 8px" } }, flatWords({ yoursBest: !!best.current, allFail: d.five.allFail, sameYear })),
    // filled when it is the one thing left to do (the plan already on the best order: no "Use ..." above), outlined beside the
    // hero's own filled button (critic of 2026-11-15, P1: after the choice the page had no filled button and no next step)
    ui.row(ui.button("Work out tax at the real rates", realRates, best.current ? {} : { class: "secondary" }))));
  // the best order and yours in sight, the others one tap away (opt spec C14: "3 more orders")
  const row = (o) => ui.h("li", { style: isBest(o) && !sameYear ? { background: "var(--accent-soft)", borderRadius: "8px" } : null },
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, o.label, ...orderPills(ui, o, isBest(o) && !sameYear)), ui.h("span", { class: "rec-value" }, o.success ? money(o.endAfterTaxReal) : `runs out ${o.failYear}`)),
    // "Today's dollars." only where the headline does not say it already (every order runs out); the row before "With Roth
    // conversions too" kept the page's first view at its count (gap list, next 60, item 23)
    ui.h("div", { class: "rec-sub" }, `${noteWords(o, isBest(o) && !sameYear)}. ${o.success ? `Left at the end after tax; ${money(o.endBalanceReal)} before it. ` : ""}Tax over the plan ${money(o.taxesReal)}; ${money(o.rmdReal)} of required withdrawals.${d.five.allFail ? " Today's dollars." : ""}`),
    // the best order's own button is the hero's (one path: P4, it was offered twice)
    o.current || isBest(o) ? null : ui.h("div", { style: { marginTop: "8px" } }, ui.button(`Use this order`, () => choose(o), { class: "secondary" })));
  root.append(ui.card("The five orders",
    ...rest(ctx, { id: "orders", items: all, row, first: 0, keep: (o) => isBest(o) || o.current, noun: "orders", one: "order" })));
  // the five orders with Roth conversions, searched together (mix.js): one quiet row, only when there is money to convert and years
  // to do it in (otherwise the search is the five orders above); its green line sits just above it, outside the parts; what it tried,
  // why gains at 0% are not in it and, on a flat-rate plan, the rates it uses are under "How this is worked out" (critic of x2, P5)
  const grid = mixGrid(plan, { today: fmt.today() });
  const mix = grid.ready && grid.convert ? mixPart(ctx, grid, money, openMix) : null;
  if (mixPending) {
    const pend = mixPending;
    mixPending = null;
    if (typeof pend === "string") root.append(ui.notice("ok", pend));
    else root.append(ui.notice("ok", pend.text, { action: { label: "Undo", run: () => {
      if (!pend.undo) return;
      mixPending = pend.back; mixOpen = true;
      const r = pend.undo();
      if (!r?.done) mixPending = r?.kept ? ui.undoneWords(r, pend.back) : null; else if (r.kept) mixPending = ui.undoneWords(r, pend.back);
    } } }));
  }
  // How this is worked out: the method, the fifth order, and why the order matters (moved from the first screen, word for word); then
  // the search's own method, when the page has it
  root.append(parts(ctx, mix, { id: "how", kind: "how", body: () => [
    ui.h("p", { class: "small" }, "Everyday cash always goes first. The page works each order through the federal tax brackets year by year, so the difference is actual tax, including the effect of required withdrawals and Social Security. What is left is counted after tax, because tax is still owed on pre-tax money."),
    ui.h("p", { class: "small" }, `"${d.share.label}": after everyday cash and any required withdrawal, each account pays its share of what the year needs, by what it held at the start of the year. One holding 60% of your savings pays 60%. Tax is worked out the same way as for the other orders.`),
    ui.h("ul", { class: "records" }, [
      ["Pre-tax money is a tax bill waiting", "Every dollar in a 401(k) or IRA is taxed when it comes out, and from 73 or 75 the IRS makes you take it. Drawing some of it early, in the low-income years before Social Security and required withdrawals, uses up the cheap brackets that would otherwise go unused."],
      ["Taxable money has a hidden bonus", "Only the gain is taxed when you sell, at the lower gains rates, and gains left at death are wiped out (the step-up). That argues for spending it in the middle, not first."],
      ["Roth money last", "Nothing is ever taxed and nothing is required: the best money to leave growing, and the best to leave behind."],
      ["A mix beats a pure order", "The real answer is usually to take from pre-tax up to the top of a low bracket every year and the rest from taxable: that is what the Roth conversions page does."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
    ...(mix ? mixHow(ui, grid) : []),
  ] }));
}

/** The search's method, under "How this is worked out": what was tried, why gains at 0% are not in it (with its link), and on a
 * flat-rate plan whose own setting moves nothing to a Roth, that the figures use the real rates (with conversions saved that is said
 * in the part itself, beside "your plan": FLAT_CONV_WORDS). */
function mixHow(ui, grid) {
  return [
    ui.h("p", { class: "small" }, triedWords(grid)),
    ui.h("p", { class: "small" }, GAINS_WORDS, " ", ui.h("a", { href: "#/taxes/projection?show=gains", style: { display: "inline-flex", alignItems: "center", minHeight: "44px" } }, "Gains you could take tax-free ›")),
    grid.bracketsOn || ownConverts(grid) ? null : ui.h("p", { class: "small" }, FLAT_MIX_WORDS),
  ].filter(Boolean);
}

/**
 * The part "Try Roth conversions too" (kind own: it holds "Use this mix", never a box; title pinned in qa/first-view-lib.mjs): built
 * when first opened. What a Roth conversion is, in one sentence; the runs are worked out a slice at a time with "Trying 50 mixes of
 * order and Roth conversions..." in their place; then the first sentence, on a flat-rate plan with conversions saved why "your plan"
 * differs from the five orders' (FLAT_CONV_WORDS), the plan as it is and the best three, each with its difference and, when it does
 * more, "Use this mix" (outlined: the page's one filled button is the hero's). The rest of what it says is under "How this is worked
 * out" (mixHow; critic of x2, P5: three paragraphs of method under the rows).
 */
function mixPart(ctx, grid, money, open) {
  const { ui, store, fmt, plan } = ctx;
  const today = fmt.today();
  const rmdAge = grid.rmdStartAge;
  const use = (x) => {
    const withRates = !grid.bracketsOn;
    if (!ui.confirm(confirmMixWords(x, { withRates, rmdAge }))) return;
    const pend = { text: savedMixWords(x, { withRates, money, rmdAge }), back: backMixWords({ withRates }), undo: null };
    mixPending = pend; mixOpen = true;
    const change = (d) => chooseMix(d, x, { withRates });
    // one change; Undo takes back only what it changed (the kit's undoable)
    if (ui.undoable) pend.undo = ui.undoable(store, change); else store.update(change);
  };
  // each row's title says what tells it from the others listed (rowTitle; recheck leftover y2 (e)): the order's name, then, only
  // where another listed row shares the order, what differs on its own line (tellWords; fix round, critic P3: one long title wrapped
  // to three lines beside its pill)
  const row = (r) => (x, _i, listed) => {
    const tell = tellWords(x, listed, rmdAge);
    return ui.h("li", {},
    ui.h("div", { class: "rec-head" },
      ui.h("span", { class: "rec-title" }, orderTitle(x.order), tell ? ui.h("span", { class: "mix-tell", style: { display: "block", fontWeight: "400" } }, tell.replace(/^./, (c) => c.toUpperCase())) : null,
        x.asIs ? ui.h("span", { class: "pill ok" }, "your plan") : x === r.top && r.better.has(x.key) ? ui.h("span", { class: "pill accent" }, bestWords(x)) : null),
      ui.h("span", { class: "rec-value" }, valueWords(x, money))),
    ui.h("div", { class: "rec-sub" }, rowWords(x, r.asIs, money, rmdAge)),
    r.better.has(x.key) ? ui.h("div", { style: { marginTop: "8px" } }, ui.button("Use this mix", () => use(x), { class: "secondary" })) : null);
  };
  const answer = (r) => [
    ui.h("p", {}, leadWords(r, money)),
    moveWords(r) ? ui.h("p", {}, moveWords(r)) : null,
    // a flat-rate plan with conversions saved: the five orders above leave them out, "your plan" here has them (critic of x2, F2)
    !grid.bracketsOn && ownConverts(grid) ? ui.h("p", { class: "small muted" }, FLAT_CONV_WORDS) : null,
    r.listed ? ui.h("ul", { class: "records" }, [r.asIs, ...r.shown].map(row(r))) : null,
  ].filter(Boolean);
  const body = () => {
    const holder = ui.h("div", { style: { display: "grid", gap: "12px" }, "aria-live": "polite" });
    const key = searchKey(plan, today);   // worked out only once the part is opened
    const fill = () => {
      if (memo.key !== null && memo.key !== key && holder.childNodes?.length) return;   // a drawing of an older plan: a newer one has its own
      const m = runsOf(plan, today);
      const todo = runsNeeded(grid).filter((x) => !m.runs.has(x.rk)).map((x) => ({ ...x, plan }));
      if (todo.length) { holder.replaceChildren(ui.h("p", { class: "muted", "aria-busy": "true" }, busyWords(grid))); work(plan, today, todo, fill); return; }
      const r = rankMixes(grid, m.runs);
      holder.replaceChildren(...(r.ready ? answer(r) : [ui.h("p", {}, "This could not be worked out for your plan. Will the money last? shows what is missing.")]));
    };
    fill();
    return [ui.h("p", { class: "small muted" }, ROTH_WORDS), holder];
  };
  return { id: "mix", kind: "own", title: MIX_TITLE, open: open || undefined, lazy: true, body };
}
