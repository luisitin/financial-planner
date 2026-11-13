// modules/retirement/monte-carlo/view.js -- DOM only. Runs the projection thousands of times on
// the PC (or here if the PC is not connected), then shows the chance the money lasts, the range
// of outcomes as a band, and the age it ran out in the paths that failed.
// Simple first (opt C14, 2026-11-13): the answer and one sentence; the rest in three quiet rows (core/ui/more.js), one of them
// "Set my own numbers": how careful the spending that lasts is, and my own lines for strong and fair (gap #17).
import { needButtons } from "../needs.js";
import { rememberChance, chanceKey, whenCareful, monthlyOf, slot, busyWords, carefulChanceOf, badRunNote, inWords, linesOf, verdictOf, perHundred, CAREFUL_CHANCE, CAREFUL_CHOICES, GOOD_CHANCE, OK_CHANCE } from "../careful.js";
import { buildInputs, healthAdded } from "../projection/compute.js";
import { bandChart } from "../charts.js";
import { ssNotice } from "../ss-notice.js";
import { needsWords } from "../../../core/words.js";
import { parts, choice } from "../../../core/ui/more.js";

const state = { paths: 2000, seed: 1 };
let pending = null;   // after a save: { part (stays open on the next draw, R17), say(d) -> the green line (R7) }
let last = null;      // { key, successRate }: the plan's chance as last drawn, so a new line can say at once what the plan now reads

const LEAD = { weak: "Look at spending, the retirement age and Social Security timing.", fair: "A little less spending or a little more saving moves this a lot." };
const WORD = { strong: "strong", fair: "fair", weak: "weak" };

/**
 * answerFor(d, lines) -> { key, value, label, lede }: the answer (one ui.stat with its words, R3) and the one sentence under it
 * for each case the page can reach (R5): every, strong, fair, weak, none, and with the person's own lines (gap #17) strongOwn,
 * fairOwn, weakOwn, which name the line. `d` is compute()'s result; `lines` linesOf(plan).
 */
export function answerFor(d, lines = { good: GOOD_CHANCE, ok: OK_CHANCE }) {
  const s = d.successRate;
  const n = perHundred(s);
  const value = s > 0 && n === 0 ? "under 1 of 100" : `${n} of 100`;
  const label = `pretend futures where the money lasts to ${d.endYear}`;
  const own = lines.good !== GOOD_CHANCE || lines.ok !== OK_CHANCE;
  const v = verdictOf(s, lines);
  const G = perHundred(lines.good), O = perHundred(lines.ok);
  let key, lede;
  if (s >= 1 || s <= 0) { key = s >= 1 ? "every" : "none"; lede = d.successRate >= 1 ? "Strong: the money lasted in every pretend future." : `Weak: the money ran out in every pretend future. ${LEAD.weak}`; }
  else if (!own) {
    key = v;
    lede = { strong: "Strong: the money lasted in nearly every pretend future.", fair: `Fair: it lasted in most pretend futures, but not all. ${LEAD.fair}`, weak: `Weak: it ran out in many pretend futures. ${LEAD.weak}` }[v];
  } else {
    key = `${v}Own`;
    lede = { strong: `Strong: that is at or above the ${G} of 100 you call strong.`, fair: `Fair: under the ${G} of 100 you call strong, at or above the ${O} you call fair. ${LEAD.fair}`, weak: `Weak: under the ${O} of 100 you call fair. ${LEAD.weak}` }[v];
  }
  return { key, value, label, lede };
}

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  { const ss = ssNotice(ctx); if (ss) root.append(ss); }   // no Social Security in the plan: say so first (ss-notice.js)
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const said = pending; pending = null;
  const answer = ui.h("div", {}, ui.h("p", { class: "lede", "aria-busy": "true" }, `Trying your plan ${state.paths.toLocaleString("en-US")} times...`));
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Chance the money lasts"),
    answer,
    ctx.view?.build ? ui.h("p", { class: "muted small" }, ctx.store.backend() === "server" ? "Runs on your computer." : "Runs on this device (your computer is not connected).") : null,
  ));
  const host = ui.h("div");
  root.append(host);
  // careful: false: this page shows the chance at the plan's own spending; the careful figure is worked out only when "Set my own
  // numbers" is opened (whenCareful, at the plan's own careful chance)
  const sentFor = chanceKey(ctx);   // the plan this run is for (Compare reads the figure by it)
  ctx.computeRemote("retirement/monte-carlo", { today: fmt.today(), paths: state.paths, seed: state.seed, careful: false }).then((d) => {
    answer.replaceChildren();
    if (!d || !d.ready) {
      // the same words as every page that cannot run yet (core/words.js needsWords; wording follow-up l001), never "...: see Will the money last?."
      const missing = d?.missing?.length ? needsWords("First, the plan needs", d.missing) : "First, the plan needs a few answers.";
      // the way on is a button to where each thing is typed, not a small link to a page that lists them again (stress test 2026-11-11, R-A9)
      answer.append(ui.h("p", {}, missing), needButtons(ui, d?.missing) ?? ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Open Will the money last?")));
      return;
    }
    // kept for the visit, so Compare shows this same figure for this same plan (stress test 2026-11-11, W7)
    rememberChance(ctx, d, sentFor);
    const lines = linesOf(plan);
    const a = answerFor(d, lines);
    last = { key: sentFor, successRate: d.successRate };
    answer.append(ui.stat(a.label, a.value), ui.h("p", {}, a.lede));
    host.append(ui.h("div", {}, parts(ctx, numbersPart(ctx, d, lines, money), carefulPart(ctx, lines, said, money), howPart(ctx, lines))));
  }).catch((e) => { answer.replaceChildren(); host.append(ui.notice("error", `Could not run it: ${e.message}`)); });
}

// ---------------------------------------------------------------- "N more numbers": what is left, when it ran out, the range, still funded at
function numbersPart(ctx, d, lines, money) {
  const { ui } = ctx;
  const at = (age) => d.byAge.find((b) => b.age === age);
  const rows = [70, 75, 80, 85, 90, 95].map((a) => at(a)).filter(Boolean);
  const years = d.bands.map((b) => b.year);
  const tone = (f) => (f >= lines.good ? "var(--ok)" : f >= lines.ok ? "var(--warn)" : "var(--bad)");
  return { id: "numbers", kind: "more", n: 2 + rows.length, noun: "numbers", one: "number", body: () => [
    ui.row(
      ui.stat("Typical amount left", money(d.medianEndReal), `at ${d.endYear}, today's dollars (the middle pretend future)`),
      d.failAges ? ui.stat("When it ran out", `age ${Math.round(d.failAges.p50)}`, `in the ${d.failAges.count} ${d.failAges.count === 1 ? "pretend future" : "pretend futures"} where the money ran out; in one in ten of those, it ran out by ${Math.round(d.failAges.p10)}`) : ui.stat("Ran out", "never", "in any pretend future"),
    ),
    ui.h("h3", {}, "The range of outcomes, in today's dollars"),
    bandChart({ years, low: d.bands.map((b) => Math.max(0, b.p10)), high: d.bands.map((b) => b.p90), mid: d.bands.map((b) => Math.max(0, b.p50)), marks: [{ year: d.retireYear, label: "retire" }], label: "range of balances" }),
    ui.h("p", { class: "muted small" }, "The band holds the middle 80% of pretend futures (one in ten did better than the top, one in ten worse than the bottom); the line is the middle one."),
    rows.length ? ui.h("h3", {}, "Still funded at...") : null,
    rows.length ? ui.h("ul", { class: "records" }, rows.map((b) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Age ${b.age} (${b.year})`), ui.h("span", { class: "rec-value" }, `${perHundred(b.funded)}%`)), ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(b.funded * 100)}%`, background: tone(b.funded) } }))))) : null,
  ] };
}

// ---------------------------------------------------------------- "Set my own numbers": how careful, and my own lines (gap #17)
function carefulPart(ctx, lines, said, money) {
  const { ui, plan, store } = ctx;
  const chance = carefulChanceOf(plan);
  const A = plan.assumptions ?? {};
  const mine = ["carefulChance", "goodChance", "okChance"].filter((k) => A[k] !== undefined && A[k] !== null).length;
  const G = perHundred(lines.good), O = perHundred(lines.ok);
  const pickChance = (v) => {
    pending = { part: "careful", say: () => (v === CAREFUL_CHANCE ? "Saved. The spending that lasts is back to the usual 9 of 10 pretend futures." : `Saved. The spending that lasts now has to last in ${inWords(v, "of")} pretend futures.`) };
    store.update((p) => { p.assumptions = p.assumptions ?? {}; if (v === CAREFUL_CHANCE) delete p.assumptions.carefulChance; else p.assumptions.carefulChance = v; });
  };
  const body = () => {
    // the spending that lasts at this chance (careful.js whenCareful; at 9 in 10 the same answer Will the money last? shows),
    // filled in after the part is drawn; the words say the chance it is worked to
    const today = ctx.fmt.today();
    const onTop = (() => { try { return healthAdded(buildInputs(plan, { today }).health) ? " on top of health insurance" : ""; } catch { return ""; } })();
    const note = badRunNote(chance);
    const line = ui.h("p", { "aria-live": "polite", "aria-busy": "true", style: { color: "var(--muted)" } }, busyWords(ui, "Working out the spending that lasts. "),
      `Even in a bad run of years ${note}, the money can pay for about `, slot(ui, "$100,000"), " a year (", slot(ui, "$8,000"), ` a month)${onTop}.`);
    // this page says the chance in words, so it asks for the plan's own (careful.js: a page that says "1 in 10" asks for none)
    whenCareful(ctx, line, (c) => {
      line.removeAttribute("aria-busy"); line.style.color = "";
      const cn = badRunNote(c?.chance ?? chance);
      line.replaceChildren(!c ? "The spending that lasts in a bad run of years could not be worked out."
        : c.yearly > 0 ? `Even in a bad run of years ${cn}, the money can pay for about ${money(c.yearly)} a year (${money(monthlyOf(c.yearly))} a month)${onTop}.`
          : `Even in a bad run of years ${cn}, the money does not last to the end of the plan, even spending nothing.`);
    }, { chance });
    const err = ui.h("div", {});
    const form = ui.form([
      { key: "goodChance", label: "When we call it strong", type: "percent", min: 1, max: 100, more: true, placeholder: String(perHundred(GOOD_CHANCE)), help: "Out of 100 pretend futures. Usually 85." },
      { key: "okChance", label: "When we call it fair", type: "percent", min: 1, max: 100, more: true, placeholder: String(perHundred(OK_CHANCE)), help: "Under this it is weak. Usually 70." },
    ], { goodChance: A.goodChance ?? "", okChance: A.okChance ?? "" }, (v) => {
      err.replaceChildren();
      // a Save with nothing new in the boxes changes nothing: say so, never "Saved"
      if ((v.goodChance ?? null) === (A.goodChance ?? null) && (v.okChance ?? null) === (A.okChance ?? null)) {
        err.append(ui.notice("info", mine > 0 && (A.goodChance != null || A.okChance != null) ? `Nothing changed: strong is still from ${G} of 100 and fair from ${O}.` : "Nothing to save yet: type when you call it strong, fair or both."));
        return false;
      }
      const good = v.goodChance ?? GOOD_CHANCE, ok = v.okChance ?? OK_CHANCE;
      if (!(ok < good)) { err.append(ui.notice("error", `The chance you call fair (${perHundred(ok)} of 100) has to be under the one you call strong (${perHundred(good)}).`)); return false; }
      // the plan's chance does not move with the lines (they only name it), so the last run says at once what the plan now reads
      const known = last && last.key === chanceKey(ctx) ? last.successRate : null;
      pending = { part: "careful", say: () => (known !== null ? `Saved. At ${perHundred(known)} of 100, your plan now reads ${WORD[verdictOf(known, { good, ok })]}.` : `Saved. Strong from ${perHundred(good)} of 100, fair from ${perHundred(ok)}.`) };
      store.update((p) => {
        p.assumptions = p.assumptions ?? {};
        for (const k of ["goodChance", "okChance"]) { if (v[k] === null || v[k] === undefined) delete p.assumptions[k]; else p.assumptions[k] = v[k]; }
      });
    }, { submitLabel: "Save" });
    // the Save stands under the boxes it saves: while "More details (optional)" is shut it is the last line here, never a filled
    // button under no boxes (critic of g34, 2026-11-13); open (a tap, a box holding a saved line, or "Show every box in forms"),
    // the two boxes and their Save. display: none, since base.css draws .form-actions as a flex row whatever `hidden` says
    const fold = form.querySelector(".form-more"), actions = form.querySelector(".form-actions");
    if (fold && actions) {
      const sync = () => { const shut = !fold.hasAttribute("open"); actions.hidden = shut; actions.style.display = shut ? "none" : ""; };
      sync(); fold.addEventListener("toggle", sync);
    }
    return [
      said ? ui.notice("ok", said.say()) : null,
      ui.h("p", {}, "How careful should the spending that lasts be? It is the most you could spend each year and still have the money last in this many pretend futures."),
      choice(ctx, { id: "carefulChance", label: "How careful", value: chance,
        presets: CAREFUL_CHOICES.map((value) => ({ value, label: `${inWords(value)}${value === CAREFUL_CHANCE ? " (usual)" : ""}` })),
        own: { type: "percent", label: "Your own chance", name: "carefulChance", min: 60, max: 99, whole: true, show: (x) => inWords(x) }, onPick: pickChance }),
      line,
      ui.h("p", { class: "muted small" }, `We call the chance strong from ${G} of 100 and fair from ${O}.`),
      err,
      form,
    ];
  };
  return { id: "careful", kind: "own", set: mine, says: inWords(chance), holds: ["carefulChance", "goodChance", "okChance"], open: said?.part === "careful", lazy: true, body };
}

// ---------------------------------------------------------------- "How this is done": the method, the lines, how many pretend futures
function howPart(ctx, lines) {
  const { ui, plan } = ctx;
  // how many pretend futures: three chips (R23), not a box. A box in the parts card outside a form is a control the page keeps
  // for itself (docs/OPTIONAL.md R32, S15), and a reading part holds no box (R30). Kept for this visit only, never in the plan;
  // a tap tries the plan again (ctx.redraw), and wave 1 keeps this part as the person left it
  const pathsPick = choice(ctx, { id: "paths", label: "How many pretend futures to try", value: state.paths,
    presets: [{ value: 1000, label: "1,000 (quick)" }, { value: 2000, label: "2,000" }, { value: 10000, label: ctx.view?.build ? "10,000 (best on your computer)" : "10,000" }],
    onPick: (v) => { state.paths = v; ctx.redraw?.(); } });
  return { id: "how", kind: "how", title: "How this is done", body: () => [
    ui.h("p", {}, "Your plan was tried thousands of times, each a pretend future with its own good and bad years mixed at random. The share of pretend futures in which the money lasts to the end is the chance it lasts."),
    ui.h("p", { class: "muted small" }, `Each pretend future picks a random return for stocks and bonds every year, averaging ${ctx.fmt.pct(plan.assumptions.returnStocks, 1)} and ${ctx.fmt.pct(plan.assumptions.returnBonds, 1)}, with typical swings of ${ctx.fmt.pct(plan.assumptions.stdevStocks, 0)} and ${ctx.fmt.pct(plan.assumptions.stdevBonds, 0)}, and inflation steady at ${ctx.fmt.pct(plan.assumptions.inflation, 1)}. The random picks are the same each time, so the answer does not change when you reopen the page.`),
    ui.h("p", { class: "muted small" }, `We call the chance strong from ${perHundred(lines.good)} of 100 and fair from ${perHundred(lines.ok)}; under that it is weak.`),
    ui.h("p", { class: "small" }, "How many pretend futures to try:"),
    pathsPick,
  ] };
}
