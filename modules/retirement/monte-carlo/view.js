// modules/retirement/monte-carlo/view.js -- DOM only. Runs the projection thousands of times on
// the PC (or here if the PC is not connected), then shows the chance the money lasts, the range
// of outcomes as a band, and the age it ran out in the paths that failed.
// Simple first (opt C14, 2026-11-13): the answer and one sentence; the rest in quiet rows (core/ui/more.js), one of them
// "Set my own numbers": how careful the spending that lasts is, and my own lines for strong and fair (gap #17); another
// "How the pretend futures end" (gap next-60 #36), with "Save all 2,000 pretend futures as a spreadsheet" at the foot of How this
// is done (its status says "with a spreadsheet").
import { needButtons } from "../needs.js";
import { rememberChance, chanceKey, whenCareful, monthlyOf, slot, busyWords, carefulChanceOf, badRunNote, inWords, linesOf, verdictOf, perHundred, CAREFUL_CHANCE, CAREFUL_CHOICES, GOOD_CHANCE, OK_CHANCE } from "../careful.js";
import { buildInputs, healthAdded } from "../projection/compute.js";
import { bandChart } from "../charts.js";
import { ssNotice } from "../ss-notice.js";
import { needsWords } from "../../../core/words.js";
import { parts, choice } from "../../../core/ui/more.js";
import { runsCsv } from "./compute.js";

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
  // endings: true adds how the runs end (the part below) to the same run; every other figure is the same (gap next-60 #36)
  ctx.computeRemote("retirement/monte-carlo", { today: fmt.today(), paths: state.paths, seed: state.seed, careful: false, endings: true }).then((d) => {
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
    host.append(ui.h("div", {}, parts(ctx, numbersPart(ctx, d, lines, money), endingsPart(ctx, d, money), carefulPart(ctx, lines, said, money), howPart(ctx, lines, d))));
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

// ---------------------------------------------------------------- "How the pretend futures end" (gap next-60 #36)
/** The part's title: fixed (the number of pretend futures is a choice in How this is done), pinned in qa/first-view-lib.mjs. */
export const ENDINGS_TITLE = "How the pretend futures end";
const count = (n) => Number(n).toLocaleString("en-US");
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * groupWords(groups) -> [{ label, phrase }] for compute's endings.out (failGroups): a row's label ("before 80", "80 to 89",
 * "90 or later") and the sentence's words ("before 80", "between 80 and 89", "at 90 or later"); one group alone is its two
 * ages ("91 to 100", "between 91 and 100"), or one age ("at 95").
 */
export function groupWords(groups) {
  const n = groups.length;
  return groups.map((g, i) => {
    if (g.from === g.to) return { label: `at ${g.from}`, phrase: `at ${g.from}` };
    if (n > 1 && i === 0) return { label: `before ${g.to + 1}`, phrase: `before ${g.to + 1}` };
    if (n > 1 && i === n - 1) return { label: `${g.from} or later`, phrase: `at ${g.from} or later` };
    return { label: `${g.from} to ${g.to}`, phrase: `between ${g.from} and ${g.to}` };
  });
}

/**
 * endingsFor(e, money) -> { key, sentence }: the one sentence that reads the picture, written out for each case (R5): every
 * (none ran out), some, one (only one lasted), none (all ran out); and, where the middle run that lasted keeps under $1,000,
 * everyThin and someThin. "Most often" names the group with the most runs (the earliest on a tie). `e` is compute's endings.
 */
export function endingsFor(e, money) {
  const N = count(e.paths);
  let top = 0;
  e.out.forEach((g, i) => { if (g.n > e.out[top].n) top = i; });
  const often = e.ranOut > 0 && e.out.length ? groupWords(e.out)[top].phrase : "";
  const thin = !(e.medianLeft >= 1000);
  const left = thin ? "less than $1,000 is left at the end" : `more than ${money(e.medianLeft)} is left at the end`;
  if (e.ranOut === 0) return { key: thin ? "everyThin" : "every", sentence: `The money lasted in all ${N} pretend futures; in half of them ${left}, in today's dollars.` };
  if (e.lasted === 0) return { key: "none", sentence: `The money ran out in all ${N} pretend futures, most often ${often}.` };
  if (e.lasted === 1) return { key: "one", sentence: `The money ran out in ${count(e.ranOut)} of the ${N} pretend futures, most often ${often}; in the one that lasted, ${thin ? "less than $1,000" : `about ${money(e.medianLeft)}`} is left at the end, in today's dollars.` };
  return { key: thin ? "someThin" : "some", sentence: `The money ran out in ${count(e.ranOut)} of the ${N} pretend futures, most often ${often}; in half of the ${count(e.lasted)} that lasted, ${left}, in today's dollars.` };
}

/** bandWords(band, money) -> "under $1,000,000", "$1,000,000 to $2,000,000", "$3,000,000 or more" (endings.left). */
export const bandWords = (b, money) => (b.to === null ? `${money(b.from)} or more` : b.from === 0 ? `under ${money(b.to)}` : `${money(b.from)} to ${money(b.to)}`);

/** The part: the sentence, then one bar per group, red for the runs that ran out and green for those that lasted, each as
 * wide as its share of all the runs (plain scoped rows with base.css's .progress bar, as "Still funded at..." draws). */
function endingsPart(ctx, d, money) {
  const { ui, plan } = ctx;
  const e = d.endings;
  if (!e) return null;
  const words = groupWords(e.out);
  const bar = (n, tone) => ui.h("div", { class: "progress", "aria-hidden": "true", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round((1000 * n) / e.paths) / 10}%`, background: tone } }));
  const rowOf = (label, n, tone) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, label), ui.h("span", { class: "rec-value" }, count(n))), bar(n, tone));
  const first = plan.household?.people?.find((p) => p.role !== "dependent")?.name;
  const whose = !first || first === "Me" ? "your" : `${first}'s`;
  return { id: "endings", kind: "more", title: ENDINGS_TITLE, body: () => [
    ui.h("p", {}, endingsFor(e, money).sentence),
    e.ranOut > 0 ? ui.h("h3", {}, "Ran out, by age") : null,
    e.ranOut > 0 ? ui.h("ul", { class: "records" }, e.out.map((g, i) => rowOf(cap(words[i].label), g.n, "var(--bad)"))) : null,
    e.lasted > 0 ? ui.h("h3", {}, "Lasted, by what is left at the end") : null,
    e.lasted > 0 ? ui.h("ul", { class: "records" }, e.left.map((b) => rowOf(cap(bandWords(b, money)), b.n, "var(--ok)"))) : null,
    ui.h("p", { class: "muted small" }, `Each bar is out of all ${count(e.paths)} pretend futures. What is left is in today's dollars; an age is ${whose} age in the first year the money falls short.`),
  ] };
}

// ---------------------------------------------------------------- every run as a file (gap next-60 #36), in How this is done
/** The button's words: the page's own "pretend futures", with how many (n1 fix P3: it said "Save every run as a file"). */
export const saveWords = (n) => `Save all ${count(n)} pretend futures as a spreadsheet`;
/** The status of "How this is done" while it holds the file, so the row says a file lives there (n1 fix P3). */
export const FILE_SAYS = "with a spreadsheet";
/** sizeWords(bytes) -> "890 KB" (to the 10 KB) or "1.2 MB". */
export const sizeWords = (bytes) => (bytes < 995000 ? `${Math.max(10, Math.round(bytes / 10000) * 10)} KB` : `${(Math.round(bytes / 1e5) / 10).toFixed(1)} MB`);
/** fileWords(endings, endYear) -> the line above the button: what the file holds and its size (the exact bytes compute counted). */
export function fileWords(e, endYear) {
  const f = e.file, n = count(f.rows);
  return f.years > 0
    ? `A spreadsheet file (CSV) with one row for each of the ${n} pretend futures: the age the money ran out, what is left at the end and the balance at the end of each year to ${endYear}, in today's dollars. About ${sizeWords(f.bytes)}.`
    : `A spreadsheet file (CSV) with one row for each of the ${n} pretend futures: the age the money ran out and what is left at the end, in today's dollars; with this many, the balance of each year is left out to keep the file small. About ${sizeWords(f.bytes)}.`;
}
/** savedWords(name, rows, bytes) -> the green line once the file is on its way. */
export const savedWords = (name, rows, bytes) => `${name} is downloading: ${count(rows)} rows, about ${sizeWords(bytes)}. Open it with Excel, Numbers or Google Sheets.`;
/** The download, the way the Export page does it: a Blob, a link with `download`, a tap on it. */
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click?.();
  setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch { /* gone already */ } }, 5000);
}
function fileBlock(ctx, d) {
  const { ui, fmt } = ctx;
  if (!d?.endings?.file) return [];
  const say = ui.h("div", { "aria-live": "polite" });
  let btn = null;
  const run = async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    say.replaceChildren(ui.h("p", { class: "muted small" }, "Making the file..."));
    try {
      const today = fmt.today();
      const r = await ctx.computeRemote("retirement/monte-carlo", { today, paths: state.paths, seed: state.seed, careful: false, runs: true });
      if (!r?.ready || !Array.isArray(r.runs)) throw new Error("the pretend futures did not come back");
      const text = runsCsv(r), name = `planner-pretend-futures-${today}.csv`;
      download(name, text);
      say.replaceChildren(ui.notice("ok", savedWords(name, r.runs.length, text.length)));
    } catch (e) {
      say.replaceChildren(ui.notice("error", `The file could not be made: ${e?.message ?? e}. Reload the page and try again.`));
    } finally { btn.disabled = false; }
  };
  btn = ui.button(saveWords(d.endings.file.rows), run, { class: "secondary" });
  return [ui.h("p", { class: "small" }, fileWords(d.endings, d.endYear)), ui.row(btn), say];
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
function howPart(ctx, lines, d) {
  const { ui, plan } = ctx;
  // how many pretend futures: three chips (R23), not a box. A box in the parts card outside a form is a control the page keeps
  // for itself (docs/OPTIONAL.md R32, S15), and a reading part holds no box (R30). Kept for this visit only, never in the plan;
  // a tap tries the plan again (ctx.redraw), and wave 1 keeps this part as the person left it
  const pathsPick = choice(ctx, { id: "paths", label: "How many pretend futures to try", value: state.paths,
    presets: [{ value: 1000, label: "1,000 (quick)" }, { value: 2000, label: "2,000" }, { value: 10000, label: ctx.view?.build ? "10,000 (best on your computer)" : "10,000" }],
    onPick: (v) => { state.paths = v; ctx.redraw?.(); } });
  return { id: "how", kind: "how", title: "How this is done", says: d?.endings?.file ? FILE_SAYS : "", body: () => [
    ui.h("p", {}, "Your plan was tried thousands of times, each a pretend future with its own good and bad years mixed at random. The share of pretend futures in which the money lasts to the end is the chance it lasts."),
    ui.h("p", { class: "muted small" }, `Each pretend future picks a random return for stocks and bonds every year, averaging ${ctx.fmt.pct(plan.assumptions.returnStocks, 1)} and ${ctx.fmt.pct(plan.assumptions.returnBonds, 1)}, with typical swings of ${ctx.fmt.pct(plan.assumptions.stdevStocks, 0)} and ${ctx.fmt.pct(plan.assumptions.stdevBonds, 0)}, and inflation steady at ${ctx.fmt.pct(plan.assumptions.inflation, 1)}. The random picks are the same each time, so the answer does not change when you reopen the page.`),
    ui.h("p", { class: "muted small" }, `We call the chance strong from ${perHundred(lines.good)} of 100 and fair from ${perHundred(lines.ok)}; under that it is weak.`),
    ui.h("p", { class: "small" }, "How many pretend futures to try:"),
    pathsPick,
    // every run as a file (gap next-60 #36): the technical end of the page, outlined, made only when tapped
    ...fileBlock(ctx, d),
  ] };
}
