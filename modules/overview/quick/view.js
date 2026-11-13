// modules/overview/quick/view.js -- DOM only. "Will my savings last?" answered here in three boxes (gap #2), then the other
// questions as rows, each opening the page that answers it with ?from=quick so the page shows a way back. Simple first
// (docs/OPTIONAL.md): one sentence, the plan's own answers, the three boxes, six questions, then "N more questions"; the
// answer's depth one quiet tap away ("3 more numbers", "The figures", "How this is worked out").
import { compute, LAST_DEFAULTS, LAST_YEARS, LAST_STOCKS, LAST_FEES } from "./compute.js";
import { part, parts, rest, choice, detail } from "../../../core/ui/more.js";

const STYLE = `
.qk-root .qk-lede { color: var(--text-2); margin: 6px 0 4px; }
.qk-root .qk-foot { color: var(--text-2); font-size: var(--fs-sm); margin: 12px 0 0; }
.qk-root h2 { margin: 18px 0 2px; }
.qk-root .card > h2:first-child, .qk-root .qk-first { margin-top: 0; }
.qk-root .qk-sub { color: var(--text-2); font-size: var(--fs-sm); margin: 0 0 4px; }
.qk-root .page-list .row-link { align-items: center; min-height: 60px; padding: 8px 4px; }
.qk-root .page-list .row-link .t { color: var(--text); }
.qk-root .page-list .d { color: var(--text-2); }
.qk-root .page-list .ic { width: 40px; height: 40px; font-size: 20px; border: 1px solid var(--line); }
.qk-root .qk-chev { flex: none; color: var(--muted); font-size: 22px; line-height: 1; padding-left: 4px; }
.qk-root .qk-search { width: 100%; margin-top: 12px; }
.qk-root .qk-answers .row-link .t { font-weight: 700; font-size: var(--fs-md); }
.qk-root .qk-answers .qk-q { display: block; color: var(--text); font-weight: 600; margin-bottom: 2px; }
.qk-root .qk-last h2 { margin: 0 0 10px; }
.qk-root .qk-last .form > .qk-pick, .qk-root .qk-last .form > .fold { grid-column: 1 / -1; }
.qk-root .qk-last .chips { margin-bottom: 0; }
.qk-root .qk-last .form > .fold { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.qk-root .qk-answer { font-size: var(--fs-md); font-weight: 600; color: var(--text); margin: 0 0 6px; line-height: 1.4; }
.qk-root .qk-second { color: var(--text-2); margin: 0 0 6px; }
.qk-root .qk-note { color: var(--text-2); font-size: var(--fs-sm); margin: 10px 0 0; }
.qk-root .qk-note a { display: inline-block; min-height: 44px; line-height: 44px; font-weight: 600; }
.qk-root .qk-lines { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.qk-root .qk-how p { margin: 0; }
@media (min-width: 720px) {
  .qk-root .qk-two { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; }
  .qk-root .qk-two li:nth-last-child(2) { border-bottom: 0; }   /* the last row of each column */
  .qk-root .qk-search { width: auto; }
}
`;

// The shell draws the page again after store.update: the green line and the parts to keep open wait here (AGENTS.md).
let pending = null;   // { say: true (the green line names the new answer), open: [part ids] }
// Chips tapped before the first answer: shown at once, saved with "See the answer" (the shell keeps the typing in the
// two boxes across the redraw). Once there is an answer a chip saves straight away, so the answer always matches it.
let draft = {};

const pct = (x) => `${Number((Number(x) * 100).toPrecision(12))}%`;
const given = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

export function render(root, ctx) {
  const { ui, modules, features, isReady } = ctx;
  const h = ui.h;
  const usable = (key) => { const m = modules.get(key); return !!m && isReady(m) && features.enabled(m) && (ctx.shown ? ctx.shown(m) : true); };
  const off = [...modules.keys()].filter((k) => !usable(k));
  const d = compute(ctx.plan, { off, today: ctx.fmt.today() });
  const wrap = h("div", { class: "qk-root" }, h("style", {}, STYLE));
  root.append(wrap);
  const again = () => (typeof ctx.redraw === "function" ? ctx.redraw() : (root.replaceChildren?.(), render(root, ctx)));

  const row = (q, icon) => h("li", {}, h("a", { href: q.href, class: "row-link" },
    h("span", { class: "ic", "aria-hidden": "true" }, icon ?? q.icon ?? modules.get(q.key)?.icon ?? "⚡"),
    h("span", { class: "body" }, h("div", { class: "t" }, q.title), h("div", { class: "d" }, q.line)),
    h("span", { class: "qk-chev", "aria-hidden": "true" }, "›")));

  // 1. what the page is, in one sentence, and the answers the plan already gives (answers are never folded)
  wrap.append(h("section", { class: "card" },
    h("h1", {}, "Get a quick answer"),
    h("p", { class: "qk-lede" }, d.answers.length ? "Your plan already answers the questions below; for any other, type your own numbers." : "Pick a question and type your own numbers: nothing to set up first."),
    d.answers.length ? [
      h("h2", {}, "Your plan already answers"),
      h("ul", { class: "page-list qk-answers" }, d.answers.map((a) => h("li", {}, h("a", { href: a.href, class: "row-link" },
        h("span", { class: "ic", "aria-hidden": "true" }, a.icon),
        h("span", { class: "body" }, h("div", { class: "t" }, a.headline), h("div", { class: "d" }, h("span", { class: "qk-q" }, a.title), a.line)),
        h("span", { class: "qk-chev", "aria-hidden": "true" }, "›"))))),
    ] : null));

  // 2. "Will my savings last?": three boxes, answered here. The line under it says what it leaves out and where the plan
  // counts it: the plan's own answer when it has one, else the steps that set it up (that question's row then goes).
  const retire = d.answers.find((a) => a.guide === "retire");
  const steps = d.needsFirst.find((n) => n.guide === "retire" && usable("overview/guide"));
  // ("We don't know yet": the plan still needs its savings, so the way on is still to set it up)
  const way = retire ? { href: retire.href, words: retire.verdict === "unknown" ? "Set up my plan" : "See your plan's answer" } : steps ? { href: steps.href, words: "Set up my plan" }
    : usable("retirement/projection") ? { href: "#/retirement/projection", words: "Set up my plan" } : null;
  wrap.append(...lastPart(ctx, d.last ?? null, way, again));

  // 3. the other questions with nothing to set up: six, then "N more questions"
  wrap.append(h("section", { class: "card" }, h("h2", { class: "qk-first" }, "Other quick questions"),
    ...rest(ctx, { id: "questions", items: [...d.mostAsked, ...d.more], row: (q) => row(q), noun: "questions", one: "question", list: "page-list qk-two" })));

  // 4. the questions that need the plan's numbers first, each opening its step-by-step guide
  const needs = d.needsFirst.filter((n) => usable("overview/guide") && !(way && n.href === way.href));
  wrap.append(h("section", { class: "card" },
    needs.length ? [
      h("h2", { class: "qk-first" }, "Questions that need your numbers first"),
      h("p", { class: "qk-sub" }, "These take a few short steps, one page at a time, then answer from your own plan."),
      h("ul", { class: "page-list" }, needs.map((n) => row(n, n.icon))),
    ] : null,
    h("button", { type: "button", class: "secondary qk-search", onClick: () => ctx.openSearch?.() }, "Not here? Search by a word"),
    h("p", { class: "qk-foot" }, "Everything stays on your own devices. Nothing goes to the cloud.")));
}

/**
 * "Will my savings last?" (gap #2): asks first (two money boxes, the years as chips, the mix and the fee under "More
 * details (optional)", one filled "See the answer"); once answered, the answer leads and the boxes fold into "The
 * figures", beside "3 more numbers" and "How this is worked out". Writes only whatIfs.quickLast.
 */
function lastPart(ctx, last, way, again) {
  const { ui, store } = ctx;
  const h = ui.h;
  const kept = ctx.plan.whatIfs?.quickLast ?? {};
  const said = pending; pending = null;
  const keepOpen = new Set(said?.open ?? []);
  const answered = !!last;
  if (answered) draft = {};
  const val = (k) => (given(draft[k]) ? Number(draft[k]) : given(kept[k]) ? Number(kept[k]) : LAST_DEFAULTS[k]);
  const save = (patch) => store.update((p) => { p.whatIfs ??= {}; p.whatIfs.quickLast = { ...(p.whatIfs.quickLast ?? {}), ...patch }; });
  // a chip (or its "Type my own" box): saved at once when there is an answer; before that, held until "See the answer"
  const pick = (key, open) => (v) => {
    if (answered) { pending = { say: true, open }; save({ [key]: v }); return; }
    draft = { ...draft, [key]: v };
    pending = { open };
    again();
  };
  const inFigures = answered ? ["figures"] : [];

  // data-no-keep: the box "Type my own" opens saves on change, and the shell's typing memory names a form by its boxes, so a
  // box opening inside the form would leave the typing made before it under an old name ("Not saved yet" after a save)
  const field = (label, node, help) => h("div", { class: "field qk-pick", dataset: { noKeep: "" } }, h("span", { class: "field-label" }, label), node, help ? h("small", { class: "help" }, help) : null);
  const years = field("For how many years", choice(ctx, { id: "quickYears", label: "For how many years",
    presets: LAST_YEARS.map((y) => ({ value: y, label: `${y} years` })), value: val("years"),
    own: { type: "number", label: "Years", min: 1, max: 60, whole: true, show: (v) => `${v} year${Number(v) === 1 ? "" : "s"}` }, onPick: pick("years", inFigures) }));
  // More details (optional): the share in stocks and the fee. Open when either is not the page's own, when a chip in it was
  // just tapped, or when this phone shows every box in forms; its status names what is inside until something is set.
  const mine = ["stocks", "fee"].filter((k) => val(k) !== LAST_DEFAULTS[k]).length;
  const options = part(ctx, { id: "options", kind: "own", title: "More details (optional)", says: mine ? `${mine} filled in` : "stocks, fees",
    open: mine > 0 || keepOpen.has("options") || detail.boxes, body: [
      field("Share in stocks", choice(ctx, { id: "quickStocks", label: "Share in stocks", presets: LAST_STOCKS.map((s) => ({ value: s, label: pct(s) })), value: val("stocks"),
        own: { type: "percent", label: "Share in stocks", min: 0, max: 100 }, onPick: pick("stocks", [...inFigures, "options"]) }), "The rest is in bonds."),
      field("Fees a year", choice(ctx, { id: "quickFee", label: "Fees a year", presets: LAST_FEES.map((f) => ({ value: f, label: f ? pct(f) : "None" })), value: val("fee"),
        own: { type: "percent", label: "Fees a year", min: 0, max: 5 }, onPick: pick("fee", [...inFigures, "options"]) }), "An investing app charges about 0.25% a year; an adviser about 1%."),
    ] });
  // a "Type my own" box holding a figure whose change has not reached its chip yet (Return pressed in it) still counts
  const typedIn = (form, name, percent) => {
    const el = form.querySelector?.(`[name="${name}"]`);
    if (!el || !String(el.value ?? "").trim()) return null;
    const n = ui.readNumber(el.value, { percent });
    return n === null || !Number.isFinite(n) ? null : percent ? Number((n / 100).toPrecision(12)) : n;
  };
  const form = ui.form([
    // $1 or more in each (the kit's words at the box): nothing saved or nothing taken out has nothing to test
    { key: "saved", label: "Saved for retirement", type: "money", required: true, min: 1 },
    { key: "monthly", label: "To take out each month", type: "money", required: true, min: 1, help: "In today's dollars" },
  ], { saved: kept.saved ?? "", monthly: kept.monthly ?? "" }, (v) => {
    const low = ["saved", "monthly"].find((k) => !(Number(v[k]) > 0));
    if (low) return ui.fieldError(form.querySelector?.(`[name="${low}"]`), `Use ${ctx.fmt.money(1, ctx.plan.meta?.currency ?? "USD")} or more.`);
    const next = { saved: v.saved, monthly: v.monthly, years: typedIn(form, "quickYears", false) ?? val("years"),
      stocks: typedIn(form, "quickStocks", true) ?? val("stocks"), fee: typedIn(form, "quickFee", true) ?? val("fee") };
    draft = {};
    pending = { say: true, open: inFigures };
    store.update((p) => { p.whatIfs ??= {}; p.whatIfs.quickLast = next; });
  }, { submitLabel: "See the answer" });
  // the years and "More details (optional)" sit between the two boxes and the button
  const actions = [...(form.children ?? [])].find((c) => c.classList?.contains("form-actions"));
  actions?.remove();
  form.append(years, options, ...(actions ? [actions] : []));

  const note = h("p", { class: "qk-note" }, "This leaves out Social Security, pensions and taxes.",
    way ? [" Your plan counts them: ", h("a", { href: way.href }, `${way.words} ›`)] : null);
  const cardOf = (...kids) => h("section", { class: "card qk-last", dataset: { last: "" } }, ...kids);   // h() skips a null child
  if (!answered) return [cardOf(h("h2", {}, "Will my savings last?"), form, note)];
  // the answer leads: its sentence, the hardest start, then what it leaves out; the green line after a save names it
  const w = last.words;
  const card = cardOf(said?.say ? ui.notice("ok", w.saved) : null, h("h2", {}, "Will my savings last?"),
    h("p", { class: "qk-answer" }, w.sentence), h("p", { class: "qk-second" }, w.second), note);
  const mix = `${pct(last.stocks)} stocks and ${pct(1 - last.stocks)} bonds`;
  return [card, parts(ctx,
    { id: "numbers", kind: "more", n: 3, noun: "numbers", body: () => h("ul", { class: "qk-lines" }, w.more.map((x) => h("li", {}, x))) },
    { id: "figures", kind: "figures", says: w.figures, holds: ["saved", "monthly"], open: keepOpen.has("figures"), body: form },
    { id: "how", kind: "how", says: "4 steps", body: () => h("div", { class: "qk-how", style: { display: "grid", gap: "10px" } },
      h("ol", { class: "qk-lines" },
        h("li", {}, `We take every stretch of ${last.years} year${last.years === 1 ? "" : "s"} in the real years from ${last.from} to ${last.to}: ${last.windows} of them, the first starting in ${last.from}${last.windows > 1 ? ` and the last in ${last.lastStart}` : ""}.`),
        h("li", {}, `At the start of each year, ${ctx.fmt.money(12 * last.monthly, ctx.plan.meta?.currency ?? "USD")} comes out (${ctx.fmt.money(last.monthly, ctx.plan.meta?.currency ?? "USD")} a month). A stretch has run out in the first year that cannot pay all of it.`),
        h("li", {}, `What is left grows as ${mix} did that year${last.fee ? `, less ${pct(last.fee)} in fees` : ""}, then is cut by that year's rise in prices, so every figure is in today's dollars.`),
        h("li", {}, "\"Up to\" is the most, in steps of $10, that lasted in every stretch.")),
      h("p", {}, "It leaves out Social Security, pensions, taxes, and spending less after a bad year. Your plan counts all of these."),
      h("p", { class: "help" }, `The years: stocks are the S&P 500 with dividends, bonds are 10-year US Treasury bonds, and prices are the consumer price index, ${last.from} to ${last.to}, from Aswath Damodaran at NYU Stern.`)) })];
}
