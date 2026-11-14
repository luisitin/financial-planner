// modules/debt/refinance/view.js -- DOM only. Type the offer, see the payment, the break-even
// month and the interest both ways over the years you plan to stay. One quiet tap away, "Compare two offers": two
// lenders' quotes with points, a lender credit and the costs paid or added to the loan, side by side.
import { compute, twoOffers, offerInputs, keepOf, KEEP_CHIPS, TERM_CHIPS, POINT_CHIPS, TIE } from "./compute.js";
import { parts, choice } from "../../../core/ui/more.js";

let pending = false;   // Compare was tapped: the answer card under it says what it found (kept across the shell's redraw)
// "Compare two offers": the working copy (chips and boxes act on it at once; nothing reaches the plan until "Save these
// offers"), kept across the shell's redraws, dropped after the save or when the saved offers change under it
let work = null;
let pendingTwo = null;   // { part: "offers" } after "Save these offers": the part stays open and its green line names the answer
let twoSaid = null;      // that green line, on this draw: the page brings it into view once it is drawn

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Refinance"),
      ui.h("p", { class: "lede" }, "Type a refinance offer (rate, term, closing costs) to see whether it pays off: the new payment, how many months it takes to earn back the closing costs, and the interest with and without it over the years you plan to stay. It needs your mortgage with its rate and payment first."),
      ui.row(ui.h("a", { class: "btn", href: d.missing === "mortgage" ? "#/balance/net-worth?add=mortgage&back=debt/refinance" : d.mortgageId ? `#/balance/liabilities/${encodeURIComponent(d.mortgageId)}?back=debt/refinance` : "#/balance/liabilities" }, d.missing === "mortgage" ? "Add the mortgage" : "Add its rate and payment"))));
    return;
  }
  const rf = plan.debtPlan?.refinance ?? {};
  const FIELDS = [
    { key: "rate", label: "Offered rate per year", type: "percent", required: true, min: 0, max: 30, help: "e.g. 5.5 for 5.5%" },
    { key: "termYears", label: "New term in years", type: "number", required: true, min: 1, max: 40, step: "1" },
    { key: "closingCosts", label: "Closing costs", type: "money", min: 0, help: "from the lender's quote: fees, points, appraisal" },
    { key: "yearsStaying", label: "Years you expect to keep this home", type: "number", min: 1, max: 40, step: "1", help: "the comparison only counts interest over these years" },
  ];
  // offers saved in "Compare two offers" with no single offer compared: the hero says their answer, not "Type an offer
  // below." (a person critic's P2: the page asked for an offer while two sat saved behind a shut row)
  const savedTwo = d.needsOffer ? twoOffers(plan, { today: fmt.today() }) : null;
  const savedLine = savedTwo && savedTwo.case !== "none" ? ` ${savedLede(savedTwo, fmt, cur)}` : null;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.needsOffer ? "Refinance" : d.verdict === "worth it" ? "Worth it" : d.verdict === "close call" ? "A close call" : "Not worth it"),
    ui.h("p", { class: "lede" }, `Your mortgage: ${fmt.money(d.current.balance, cur)} at ${fmt.pct(d.current.rate, 2)}, ${fmt.money(d.current.payment, cur)} a month.${d.needsOffer ? savedLine ?? " Type an offer below." : " The offer you compared is under the boxes below."}`),
  ));
  const offerForm = ui.form(FIELDS, { rate: rf.rate ?? null, termYears: rf.termYears ?? 30, closingCosts: rf.closingCosts ?? null, yearsStaying: rf.yearsStaying ?? 7 }, (v) => {
    pending = true;
    store.update((p) => { p.debtPlan = { ...(p.debtPlan ?? {}), refinance: { ...(p.debtPlan?.refinance ?? {}), rate: v.rate ?? null, termYears: v.termYears ?? 30, closingCosts: v.closingCosts ?? 0, yearsStaying: v.yearsStaying ?? 7 } }; });
  }, { submitLabel: "Compare" });
  root.append(ui.card("The offer", offerForm));
  // the whole answer sits in one card right under Compare: the verdict in words, a green line for each compare, then the
  // figures (D5: the verdict was above the form and the figures below the screen, and a second compare looked like nothing)
  const said = pending && !d.needsOffer ? ui.notice("ok", `Compared: ${fmt.money(d.offer.payment, cur)} a month, ${Math.abs(d.monthlySaving) < 0.5 ? "the same as now" : d.monthlySaving > 0 ? `${fmt.money(d.monthlySaving, cur)} less than now` : `${fmt.money(-d.monthlySaving, cur)} more than now`}.`) : null;
  pending = false;
  const stale = ui.h("p", { class: "muted small", hidden: true }, "These figures are for the offer you last compared. Tap Compare to see the one typed above.");
  offerForm.addEventListener("input", () => { stale.hidden = false; said?.remove(); });
  const answer = d.needsOffer ? null : ui.card("What this offer does", said, stale,
    ui.h("p", {}, `${fmt.money(d.current.balance, cur)} at ${fmt.pct(d.offer.rate, 2)} over ${d.offer.termYears} years: ${fmt.money(d.offer.payment, cur)} a month, ${d.monthlySaving > 0 ? `${fmt.money(d.monthlySaving, cur)} less than now` : `${fmt.money(-d.monthlySaving, cur)} more than now`}. Over the ${d.yearsStaying} years you plan to stay, ${d.netWhileStaying >= 0 ? `you come out ${fmt.money(d.netWhileStaying, cur)} ahead after the closing costs` : `you come out ${fmt.money(-d.netWhileStaying, cur)} behind once the closing costs are counted`}.`),
    ui.row(
    ui.stat("New payment", fmt.money(d.offer.payment, cur), `now ${fmt.money(d.current.payment, cur)}`),
    ui.stat("Costs paid back in", d.breakEvenMonths === null ? "never" : `${d.breakEvenMonths} month${d.breakEvenMonths === 1 ? "" : "s"}`, d.breakEvenMonths === null ? "the payment does not go down" : `${fmt.money(d.offer.closingCosts, cur)} of closing costs`),
    ui.stat(`Interest over ${d.yearsStaying} years`, fmt.money(d.interestWhileStaying.offer, cur), `now: ${fmt.money(d.interestWhileStaying.current, cur)}`),
    ui.stat("Whole loan", fmt.money(d.offer.totalInterest, cur), `interest over ${d.offer.termYears} years; the current loan has ${fmt.money(d.current.totalInterest, cur)} left${d.extraYears > 0 ? ` and ends ${fmt.yearsMonthsWords(Math.round(d.extraYears * 12))} sooner` : ""}`),
  ), ui.h("p", { class: "muted small" }, "A lower payment over a longer term can cost more in total even when it saves money each month. The years-you-stay figure is the one that matters if you will move before the loan ends."));
  if (answer) root.append(answer);
  // one quiet tap away once an offer is compared: two offers side by side (gap list, next 60, item 1). Before that the
  // offer's own four boxes are the one way in (a person critic's P3: the part asked the same questions again); offer 1
  // then starts from the offer compared, and offer 2's boxes are the ones out
  const saved = Array.isArray(rf.offers) && rf.offers.some((o) => offerInputs(o).ready);
  const justSaved = pendingTwo?.part === "offers";
  twoSaid = null;
  root.append(ui.h("div", {}, parts(ctx, (!d.needsOffer || saved) && { id: "offers", kind: "own", title: TWO_TITLE, set: saved, open: justSaved, holds: ["twoRate", "twoCosts", "twoCredit"],
    body: () => twoBody(ctx, { rf, single: d, cur, justSaved }) })));
  pendingTwo = null;
  // after "Save these offers" its green line, in the answer's place at the top of the part, is brought up under the top
  // bar (the page scrolls itself, so the shell gives way and says it once: a person critic's P6)
  twoSaid?.scrollIntoView?.({ block: "start" });
  twoSaid = null;
  // after Compare the answer is brought up under the top bar (it sat below the screen; the page scrolls itself, so the shell gives way)
  if (answer && said) answer.scrollIntoView({ block: "start" });
}

// ---------------------------------------------------------------- "Compare two offers"
export const TWO_TITLE = "Compare two offers";
const rateWords = (r) => `${Number((Number(r) * 100).toPrecision(12))}%`;
const pointWords = (n) => `${Number(Number(n).toPrecision(12))} point${n === 1 ? "" : "s"}`;
const keepTogether = (t) => t.replace(/(\d) (point|year)/g, "$1\u00a0$2");   // "1 point" never split over two lines
/** "Over 7 years" / "Over 1 year" / "Until the loans are paid off": how a sentence starts for the years kept. */
export const horizonWords = (keep) => (keep === "payoff" ? "Until the loans are paid off" : `Over ${keep} year${keep === 1 ? "" : "s"}`);
/** "5.25%, 20 years, 1 point" / "5.625%, 20 years, $1,500 credit" / "5.75%, 30 years, no points". */
export function offerWords(o, fmt, cur) {
  const extra = [o.points > 0 ? pointWords(o.points) : null, o.credit > 0 ? `${fmt.money(o.credit, cur)} credit` : null].filter(Boolean);
  return keepTogether([rateWords(o.rate), `${o.termYears} year${o.termYears === 1 ? "" : "s"}`, ...(extra.length ? extra : ["no points"])].join(", "));
}

/**
 * The one sentence for the comparison, written out for every case it can reach (docs/OPTIONAL.md R5), each with a test.
 * t: twoOffers()'s result. Returns null when no offer has a rate yet.
 */
export function twoSentence(t, fmt, cur, { ask = true } = {}) {
  const m = (x) => fmt.money(Math.abs(x), cur), H = horizonWords(t.keep);
  if (t.case === "one") {
    const o = t.offers.find((x) => x.ready), more = ask ? " Type the other offer to compare the two." : "";
    if (Math.abs(o.vsKeeping) < TIE) return `${H}, offer ${o.n} costs about the same as keeping your loan.${more}`;
    if (o.vsKeeping > 0) return `${H}, offer ${o.n} costs ${m(o.vsKeeping)} less than keeping your loan.${more}`;
    return `${H}, offer ${o.n} costs ${m(o.vsKeeping)} more than keeping your loan.${more}`;
  }
  if (t.case === "keep") return `${H}, keeping your loan costs less than either offer: offer 1 costs ${m(t.offers[0].vsKeeping)} more, offer 2 ${m(t.offers[1].vsKeeping)} more.`;
  if (t.case === "tie") return `${H}, the two offers cost about the same: ${m(t.diff)} apart.`;
  if (t.case === "two") {
    const w = t.cheaper, l = w === 1 ? 2 : 1, { within, from } = t.otherWins;
    // both can happen (rare): the one nearer the years kept is said
    const say = within !== null && (from === null || t.months - within <= from - t.months) ? "within" : from !== null ? "from" : "always";
    if (say === "within") return `${H}, offer ${w} costs ${m(t.diff)} less than offer ${l}; offer ${l} would cost less if you move or pay it off within ${fmt.yearsMonthsWords(within)}.`;
    if (say === "from") return `${H}, offer ${w} costs ${m(t.diff)} less than offer ${l}; offer ${l} would cost less if you keep the loan ${fmt.yearsMonthsWords(from)} or longer.`;
    return `${H}, offer ${w} costs ${m(t.diff)} less than offer ${l}, and it stays the cheaper one however long you keep the loan.`;
  }
  return null;
}
/** When an offer's costs are paid back, in words: one case each. */
export function evenWords(o, t, fmt) {
  if (o.noCosts) return "No costs to pay back.";
  if (o.breakEven === null) return "It never pays back its costs.";
  if (t.keep !== "payoff" && o.breakEven > t.months) return `Its costs are paid back after ${fmt.yearsMonthsWords(o.breakEven)}, later than the ${t.keep} year${t.keep === 1 ? "" : "s"} you expect to keep it.`;
  return `Its costs are paid back after ${fmt.yearsMonthsWords(o.breakEven)}.`;
}
/** What is paid at closing, in words. */
export function cashWords(o, fmt, cur) {
  if (o.rolled > 0) return `nothing at closing: ${fmt.money(o.rolled, cur)} added to the loan`;
  if (o.fees > 0 && o.net === 0) return "nothing at closing: the credit covers the costs";
  if (o.net === 0) return "nothing to pay at closing";
  return `${fmt.money(o.cashAtClosing, cur)} at closing`;
}
const payWords = (o, fmt, cur) => (Math.abs(o.saving) < 0.5 ? "the same as now" : o.saving > 0 ? `${fmt.money(o.saving, cur)} less than now` : `${fmt.money(-o.saving, cur)} more than now`);
const overWords = (t) => (t.keep === "payoff" ? "until it is paid off" : `over ${t.keep} year${t.keep === 1 ? "" : "s"}`);
function costWords(o, t, fmt, cur) {
  const vs = Math.abs(o.vsKeeping) < TIE ? "about the same as keeping your loan" : o.vsKeeping > 0 ? `${fmt.money(o.vsKeeping, cur)} less than keeping your loan` : `${fmt.money(-o.vsKeeping, cur)} more than keeping your loan`;
  return `Fees and interest ${overWords(t)}: ${fmt.money(o.cost, cur)}, ${vs}.`;
}
/** The words of the saved answer, after "Save these offers" (R7). */
export const savedWords = (t, fmt, cur) => `Saved. ${twoSentence(t, fmt, cur) ?? ""}`.trim();
/** The hero's line when offers are saved and no single offer is compared: "Your saved offers: over 7 years, ...". */
export function savedLede(t, fmt, cur) {
  const line = twoSentence(t, fmt, cur, { ask: false });
  return line ? `Your saved offer${t.ready === 1 ? "" : "s"}: ${line[0].toLowerCase()}${line.slice(1)}` : null;
}
/** What is still owed at the end of the years kept (a longer loan's lower payment leaves a bigger balance: M1). */
export function owedWords(owed, t, fmt, cur) {
  if (t.keep === "payoff") return null;
  const yrs = `${t.keep} year${t.keep === 1 ? "" : "s"}`;
  return owed < 0.5 ? `Paid off within the ${yrs}.` : `Still owed after ${yrs}: ${fmt.money(owed, cur)}.`;
}
/** A lender credit above the costs: the part not counted, said (M2). */
export const creditLeftWords = (o, fmt, cur) => (o.creditLeft >= 0.5 ? `The credit is ${fmt.money(o.creditLeft, cur)} more than the costs; that part is not counted.` : null);

const blankOffer = () => ({ rate: null, termYears: 30, points: 0, credit: 0, costs: null, rollIn: false });
const stored = (o) => { const x = offerInputs(o); return x.ready || o?.costs > 0 || o?.credit > 0 ? { rate: x.rate, termYears: x.termYears, points: x.points, credit: x.credit, costs: x.costs, rollIn: x.rollIn } : null; };
// what the working copy was started from: the saved offers and years, and (while no offer is saved) the single offer's rate
// and term that offer 1 starts from
const basisOf = (rf) => JSON.stringify({ offers: rf.offers ?? null, keep: rf.keep ?? null, ...(Array.isArray(rf.offers) && rf.offers.some(Boolean) ? {} : { single: [rf.rate ?? null, rf.termYears ?? null, rf.closingCosts ?? null, rf.yearsStaying ?? null] }) });
/** The working copy: the saved offers, or offer 1 started from the single offer above (not saved until the person saves). */
function startWork(rf) {
  const saved = Array.isArray(rf.offers) ? rf.offers : [];
  const fromSingle = Number.isFinite(Number(rf.rate)) && rf.rate !== null ? { ...blankOffer(), rate: Number(rf.rate), termYears: offerInputs({ termYears: rf.termYears }).termYears, costs: rf.closingCosts ?? null } : blankOffer();
  const offers = saved.some(Boolean) ? [0, 1].map((i) => (saved[i] ? { ...blankOffer(), ...saved[i] } : blankOffer())) : [fromSingle, blankOffer()];
  const first = offers.findIndex((o) => !offerInputs(o).ready);
  return { basis: basisOf(rf), offers, keep: keepOf(rf.keep, rf), open: first === -1 ? null : first, touched: false };
}

function twoBody(ctx, { rf, single, cur, justSaved }) {
  const { ui, fmt, store, plan } = ctx;
  const h = ui.h, today = fmt.today();
  if (!work || work.basis !== basisOf(rf)) work = startWork(rf);
  const B = single.current.balance;
  const results = h("div", { style: { display: "grid", gap: "8px" } });
  const notSaved = h("p", { class: "muted small" }, "Not saved yet: tap Save these offers to keep them.");
  notSaved.hidden = !work.touched;
  // while one offer's boxes are out the answer is its sentence alone (it changes as they are typed); with no boxes out, the
  // figures of each offer and how they are worked out (the open part stays under a screen and a half, R15)
  const drawResults = () => {
    const t = twoOffers(plan, { today, offers: work.offers, keep: work.keep });
    const nodes = resultNodes(ctx, t, cur, { brief: work.open !== null });
    if (said) nodes.splice(0, 1, said);
    results.replaceChildren(...nodes);
    notSaved.hidden = !work.touched;
    if (howLine) howLine.hidden = t.case === "none" || work.open !== null;
  };
  let howLine = null;
  // after the save, the green line naming the answer stands in the answer's place, once (R7; a person critic's P6: the
  // same sentence was bold above, green under Save and in the shell's copy at the bottom); the next change puts it back
  let said = justSaved ? ui.notice("ok", savedWords(twoOffers(plan, { today }), fmt, cur)) : null;
  twoSaid = said;
  const touch = () => { work.touched = true; said = null; drawResults(); };
  const formHost = h("div", {});
  const drawForm = () => { formHost.replaceChildren(...twoForm(ctx, { B, cur, rf, touch, drawForm }).filter(Boolean)); drawResults(); };
  drawForm();
  // how the answer is worked out, under it (a part holds no part): said once there is an answer
  const how = h("p", { class: "muted small" }, "How these are worked out: an offer costs its fees, paid at closing or added to the loan, and its interest over the years you keep it; keeping your loan costs its interest. Its costs are paid back once the interest saved covers them, so a longer loan's lower payment is not a saving: you still owe that money.",
    single.needsOffer ? "" : " That is why this can be later than \u201cCosts paid back in\u201d above.", " Dollars as paid, not adjusted for prices.");
  how.hidden = work.open !== null || !work.offers.some((o) => offerInputs(o).ready);
  howLine = how;
  return [h("p", {}, "Two lenders' quotes side by side, against keeping your loan."), results, notSaved, formHost, how];
}

function resultNodes(ctx, t, cur, { brief = false } = {}) {
  const { ui, fmt } = ctx, h = ui.h;
  const line = twoSentence(t, fmt, cur);
  if (!line) return [];
  if (brief) return [h("p", { dataset: { two: t.case } }, h("strong", {}, line))];
  const rec = (title, value, ...subs) => h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, title), h("span", { class: "rec-value" }, value)), ...subs.filter(Boolean).map((x) => h("div", { class: "rec-sub" }, x)));
  return [h("p", { dataset: { two: t.case } }, h("strong", {}, line)),
    h("ul", { class: "records" },
      ...t.offers.filter((o) => o.ready).map((o) => rec(`Offer ${o.n} \u00b7 ${offerWords(o, fmt, cur)}`, `${fmt.money(o.payment, cur)} a month`,
        `${payWords(o, fmt, cur)} \u00b7 ${cashWords(o, fmt, cur)}`, creditLeftWords(o, fmt, cur), evenWords(o, t, fmt), costWords(o, t, fmt, cur), owedWords(o.owed, t, fmt, cur))),
      rec("Keeping your loan", `${fmt.money(t.current.payment, cur)} a month`, `${fmt.money(t.keeping.cost, cur)} of interest ${overWords(t)}.`, owedWords(t.keeping.owed, t, fmt, cur)))];
}

/** The chips of one choice inside the form, redrawn in place when one is picked (the boxes keep what was typed). */
function chipField(ctx, label, make) {
  const h = ctx.ui.h;
  // data-no-keep: a "Type my own" box is used up when its figure is picked (the chips are drawn again without it)
  const holder = h("div", { style: { display: "grid", gap: "6px" }, dataset: { noKeep: "" } });
  const draw = () => holder.replaceChildren(...[make(draw)].flat().filter(Boolean));
  draw();
  return h("div", { class: "field" }, h("span", { class: "field-label" }, label), holder);
}

function twoForm(ctx, { B, cur, rf, touch, drawForm }) {
  const { ui, fmt, store } = ctx, h = ui.h;
  const i = work.open, o = i === null ? null : work.offers[i];
  const keepField = chipField(ctx, "How long you expect to keep the loan", (draw) => choice(ctx, { id: "keep", label: "How long you expect to keep the loan",
    presets: KEEP_CHIPS.map((k) => ({ value: k, label: k === "payoff" ? "Until paid off" : `${k} years` })), value: work.keep,
    own: { type: "number", name: "keepYears", label: "Years you expect to keep it", min: 1, max: 40, whole: true, show: (v) => `${v} year${Number(v) === 1 ? "" : "s"}` },
    onPick: (v) => { work.keep = v === "payoff" ? "payoff" : Math.min(40, Math.max(1, Math.round(Number(v)) || 7)); draw(); touch(); } }));
  // the offer not being typed: one line and its Change
  const rowOf = (k) => {
    const x = offerInputs(work.offers[k]);
    return h("div", { dataset: { offerRow: String(k + 1) }, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" } },
      h("span", { style: { minWidth: "0" } }, x.ready ? `Offer ${k + 1}: ${offerWords(x, fmt, cur)}, costs ${x.rollIn ? "added to the loan" : "paid at closing"}` : `Offer ${k + 1}: not typed yet`),
      ui.button(x.ready ? "Change" : "Type it", () => { work.open = k; drawForm(); }, { class: "secondary small", "aria-label": `${x.ready ? "Change" : "Type"} offer ${k + 1}` }));
  };
  // offer 1's line above offer 2's boxes; offer 2's line under offer 1's boxes, just above Save
  const above = [0, 1].filter((k) => k !== i && (i === null || k < i)).map(rowOf), below = [0, 1].filter((k) => i !== null && k > i).map(rowOf);
  const fields = o ? [
    { key: "twoRate", label: "Offered rate per year", type: "percent", min: 0, max: 30 },
    { key: "twoCosts", label: "Other closing costs", type: "money", min: 0, help: `From the quote: appraisal, title, the lender's fees. For example, 3% of your loan would be ${fmt.money(Math.round(B * 0.03), cur)}.` },
    { key: "twoCredit", label: "Lender credit", type: "money", min: 0, more: true, help: "Money the lender puts toward your costs, for a higher rate." },
  ] : [];
  const f = ui.form(fields, o ? { twoRate: o.rate, twoCosts: o.costs, twoCredit: o.credit || null } : {}, (v) => {
    if (o) {
      if (v.twoRate === null || v.twoRate === undefined) return ui.fieldError(f.querySelector?.('[name="twoRate"]'), "Type the rate, like 5.5.");
      Object.assign(o, { rate: v.twoRate, costs: v.twoCosts ?? null, credit: v.twoCredit ?? 0 });
    }
    const offers = work.offers.map(stored), keep = work.keep;
    pendingTwo = { part: "offers" };
    work = null;
    store.update((p) => { const dp = p.debtPlan ?? {}; p.debtPlan = { ...dp, refinance: { ...(dp.refinance ?? {}), offers, keep } }; });
  }, { submitLabel: "Save these offers", moreLabel: "Lender credit (optional)" });
  // outlined: the page's one filled button is the offer's Compare (design log: one filled button; a person critic's P1)
  f.querySelector?.('[type="submit"]')?.classList?.add("secondary");
  const box = (name) => f.querySelector?.(`[name="${name}"]`);
  if (o) {
    // a box acts on the working copy as it is typed (nothing redrawn) and on its change the answer is redrawn
    const read = { twoRate: (el) => ui.readNumber(el.value, { percent: true }), twoCosts: (el) => ui.moneyValue(el), twoCredit: (el) => ui.moneyValue(el) };
    const put = { twoRate: (n) => { o.rate = n === null ? null : Number((n / 100).toPrecision(12)); }, twoCosts: (n) => { o.costs = n; }, twoCredit: (n) => { o.credit = n ?? 0; } };
    for (const name of Object.keys(read)) {
      const el = box(name); if (!el) continue;
      el.addEventListener("input", () => put[name](read[name](el)));
      el.addEventListener("change", () => { put[name](read[name](el)); touch(); });
    }
    const term = chipField(ctx, "New term in years", (draw) => choice(ctx, { id: `term${i + 1}`, label: "New term in years",
      presets: TERM_CHIPS.map((y) => ({ value: y, label: `${y} years` })), value: o.termYears,
      own: { type: "number", name: "twoYears", label: "Years", min: 1, max: 40, whole: true, show: (v) => `${v} years` },
      onPick: (v) => { o.termYears = Math.min(40, Math.max(1, Math.round(Number(v)) || 30)); draw(); touch(); } }));
    const points = chipField(ctx, "Points (a fee for a lower rate)", (draw) => [choice(ctx, { id: `points${i + 1}`, label: "Points (a fee for a lower rate)",
      presets: POINT_CHIPS.map((n) => ({ value: n, label: n === 0 ? "None" : pointWords(n) })), value: o.points,
      own: { type: "number", name: "twoPoints", label: "Points (each is 1% of the new loan)", min: 0, max: 5, show: (v) => pointWords(Number(v)) },
      onPick: (v) => { o.points = Math.min(5, Math.max(0, Number(v) || 0)); draw(); touch(); } }),
      h("small", { class: "help" }, `Each point is 1% of the new loan, paid at closing for a lower rate: about ${fmt.money(Math.round(B * 0.01), cur)} here.`)]);
    const roll = chipField(ctx, "The costs", (draw) => choice(ctx, { id: `roll${i + 1}`, label: "The costs",
      presets: [{ value: "pay", label: "Pay them at closing" }, { value: "add", label: "Add them to the loan" }], value: o.rollIn ? "add" : "pay",
      onPick: (v) => { o.rollIn = v === "add"; draw(); touch(); } }));
    const rateLab = box("twoRate")?.closest?.(".field"), costLab = box("twoCosts")?.closest?.(".field");
    rateLab?.before(keepField, ...above, h("h3", { style: { margin: "8px 0 0" } }, `Offer ${i + 1}`), term);
    rateLab?.after(points);
    costLab?.after(roll);
    f.querySelector?.(".form-actions")?.before(...below);
  } else {
    f.prepend(keepField, ...above);
  }
  return [f];
}

/** For tests only: forget the working copy and the lines kept for the next draw. */
export const _reset = () => { work = null; pendingTwo = null; pending = false; };
