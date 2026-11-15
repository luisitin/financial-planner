// modules/investments/glide-path/view.js -- DOM only. The headline (where you stand against the path, or the path itself
// while no holdings are on file) and one sentence for its case, the chart, then the page's optional parts as quiet rows of
// one card (docs/OPTIONAL.md): the milestones ("N more ages"), "Five questions about how much ups and downs suit you",
// "Which path to measure against" and "How this is worked out".
import { compute, RULES } from "./compute.js";
import { lineChart } from "../../retirement/charts.js";
import { parts, choice } from "../../../core/ui/more.js";
import { QUESTIONS, KEYS, riskRange, answersOf, answersLine, sameAnswers, compareShare, rangeText, rangeShort, progressSentence, capSentence, compareSentence, planAlsoSentence, heroWords, NOT_ADVICE } from "./risk.js";

/** The green line after a save, in the part that was saved (R17): { part, text, undo?, undone? }. */
let pending = null;
/** The answers being picked and not saved yet (this visit only; nothing is kept unless "Save my answers" is tapped). */
let draft = null;
/** The visit the draft belongs to: the address drawn (a new one on every arrival, Back included; the same one on the
 *  redraw after a save) and the plan (another household loaded in the same tab). Either changes: the draft goes. */
let visit = { route: null, plan: null };

const RULE_CHIPS = { plan: "The plan's path", age: "110 minus age", "target-date": "Target-date fund" };
const RULE_STATUS = { plan: "plan's path", age: "110 minus age", "target-date": "target-date fund" };
const RULE_WORDS = { plan: "your plan's path", age: "110 minus your age", "target-date": "a target-date fund" };

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const h = ui.h;
  const planKey = plan?.meta?.createdAt ?? null;
  if (visit.route !== (ctx.route ?? null) || visit.plan !== planKey) { draft = null; visit = { route: ctx.route ?? null, plan: planKey }; }
  const today = fmt.today();
  const d = compute(plan, { today });
  const pts = (x) => (x === null || x === undefined ? "-" : `${Math.round(x * 100)}%`);
  const just = pending; pending = null;
  const words = heroWords(d);
  root.append(h("section", { class: "card accent hero" },
    h("h1", {}, words.head),
    h("p", { class: "lede" }, words.lede),
    // no holdings: the one way on, inside the hero so it is on the first screen even at 320 px (review N3)
    d.actual === null ? ui.row(h("a", { class: "btn", href: "#/investments/holdings" }, "Add your holdings ›")) : null,
  ));
  // the People note links to People (a reason to doubt the ages: never folded); the holdings note is the button above
  for (const n of d.notes) {
    if (/^Add your holdings/.test(n)) continue;
    root.append(ui.notice("info", /People page/.test(n) ? [n.split("People page")[0], h("a", { href: "#/household/people" }, "People page"), n.split("People page").slice(1).join("People page")] : n));
  }
  const years = d.rows.map((r) => r.age);
  root.append(ui.card("Stock share by age",
    lineChart({ years, series: [{ values: d.rows.map((r) => r.plan * 100), width: 2.5 }, { values: d.rows.map((r) => r.age110 * 100), color: "var(--muted)", dash: "4 3" }, { values: d.rows.map((r) => r.targetDate * 100), color: "#d6a06b", dash: "2 3" }, ...(d.actual !== null ? [{ values: d.rows.map((r, i) => i <= 1 ? d.actual * 100 : NaN), color: "var(--bad)", width: 6 }] : [])], marks: [{ year: d.retireAge, label: "retire" }], label: "stock share by age, percent" }),
    h("p", { class: "muted small" }, `Solid: your plan's path. Dashed: 110 minus your age. Dotted: a target-date fund.${d.actual !== null ? " Red: where you are now." : ""}`),
  ));

  // ---- the parts
  const notice = (id) => (just?.part === id ? ui.notice("ok", just.text, just.undo ? { undo: just.undo } : {}) : null);
  const milestones = () => [
    h("div", { class: "only-wide" }, ui.table([
      { key: "age", label: "Age" }, { key: "year", label: "Year" },
      { key: "plan", label: "Plan's path", align: "right", render: (r) => pts(r.plan) },
      { key: "age110", label: "110 minus age", align: "right", render: (r) => pts(r.age110) },
      { key: "targetDate", label: "Target-date fund", align: "right", render: (r) => pts(r.targetDate) },
    ], d.milestones)),
    h("ul", { class: "records only-narrow" }, d.milestones.map((r) => h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, `Age ${r.age} · ${r.year}${r.age === d.retireAge ? " · retire" : ""}`), h("span", { class: "rec-value" }, pts(r.plan))), h("div", { class: "rec-sub" }, `110 minus age ${pts(r.age110)} · target-date fund ${pts(r.targetDate)}`)))),
  ];

  // "Five questions about how much ups and downs suit you": chips redraw only this body; Save keeps the answers
  const saved = answersOf(plan);
  const riskBody = () => {
    const host = h("div", { style: { display: "grid", gap: "12px" } });
    // saved answers open on their answer, the questions one tap away ("Change my answers"); new answers ask first
    let editing = false;
    const draw = (focusKey = null) => {
      const cur = draft ?? saved ?? {};
      const r = riskRange(cur);
      const asking = !saved || draft !== null || editing;
      const kids = [];
      if (just?.part === "risk") kids.push(notice("risk"));
      if (asking) {
        kids.push(h("p", { class: "muted small" }, "Nothing is kept until you tap Save."));
        for (const q of QUESTIONS) kids.push(h("div", { class: "field", dataset: { question: q.key } },
          h("span", { class: "field-label" }, q.ask),
          choice(ctx, { id: `risk-${q.key}`, label: q.ask, presets: q.answers.map((a) => ({ value: a.value, label: a.label })), value: cur[q.key] ?? null,
            onPick: (v) => { draft = { ...riskRange(cur).answers, [q.key]: v }; draw(q.key); } }),
          q.help ? h("small", { class: "help" }, q.help) : null));
      }
      if (!r.complete) { const s = progressSentence(r); if (s) kids.push(h("p", { class: "small" }, s)); }
      else {
        // with holdings on file the range is measured against what the money really holds (the hero's figure); the plan's
        // own share stays beside it, because the one link here changes the plan's share
        const share = d.stocksNow, kind = compareShare(share, r);
        const held = d.actual !== null && d.actual !== undefined ? d.actual : null, heldKind = held !== null ? compareShare(held, r) : null;
        // the answer beside what you hold, the share by age and the plan's own (the brief: "shown beside")
        kids.push(h("ul", { class: "records", dataset: { riskRange: "" } }, [
          ["From your answers", rangeText(r)],
          held !== null ? ["What you hold now", pts(held)] : null,
          d.ageNow !== null ? [`By your age: 110 minus ${d.ageNow}`, pts(d.rows[0]?.age110)] : null,
          ["Your plan's share", `${pts(share)} now`],
        ].filter(Boolean).map(([t, v]) => h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, t), h("span", { class: "rec-value" }, v))))));
        const cap = capSentence(r);
        if (cap) kids.push(h("p", { class: "small" }, cap));
        kids.push(h("p", {}, held !== null ? `${compareSentence(heldKind, held, "held")} ${planAlsoSentence(kind, heldKind, share)}` : compareSentence(kind, share)));
        // this page has no save path for the stock share (it saves only which path to measure against): the way to change it
        // is the box itself on Will the money last?, one tap away, and only when the plan is outside the range
        if (kind !== "inside") kids.push(h("a", { href: "#/retirement/projection?show=stocksNow", style: { display: "inline-flex", alignItems: "center", minHeight: "44px" } }, "Change it on Will the money last? ›"));
        kids.push(h("p", { class: "muted small" }, NOT_ADVICE));
      }
      if (!asking) kids.push(h("p", { class: "muted small" }, `Your answers: ${answersLine(saved)}.`));
      const changed = !sameAnswers(cur, saved);
      const save = () => {
        const answers = riskRange(cur).answers;
        pending = { part: "risk", text: `Saved. Your answers give ${rangeText(riskRange(answers))} in stocks.` };
        draft = null;
        store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.riskCheck = Object.fromEntries(KEYS.map((k) => [k, answers[k]])); });
      };
      const forget = () => {
        // the kit's one-tap Undo puts back only what this tap took out; its words are set before the redraw it causes
        const pend = { part: "risk", text: "Your answers are forgotten.", take: null };
        pend.undo = () => {
          const back = { part: "risk", text: "Your answers are back." };
          pending = back;
          const res = pend.take ? pend.take() : { done: 0, kept: 0 };
          back.text = ui.undoneWords ? ui.undoneWords(res, "Your answers are back.") : back.text;
          return res;
        };
        pending = pend; draft = null;
        const change = (p) => { if (p.whatIfs) delete p.whatIfs.riskCheck; };
        if (ui.undoable) pend.take = ui.undoable(store, change); else store.update(change);
      };
      if (asking && r.complete && changed) kids.push(ui.row(ui.button(saved ? "Save my new answers" : "Save my answers", save, { class: "secondary" })));
      else if (!asking) kids.push(ui.row(ui.button("Change my answers", () => { editing = true; draw("when"); }, { class: "secondary" }), ui.button("Forget my answers", forget, { class: "secondary" })));
      host.replaceChildren?.(...kids.filter(Boolean));
      if (!host.replaceChildren) host.append(...kids.filter(Boolean));
      // the tapped answer keeps the focus (the chips were drawn again); "Change my answers" puts it on the first answer
      if (focusKey) try { (host.querySelector?.(`[data-question="${focusKey}"] [aria-pressed="true"]`) ?? host.querySelector?.(`[data-question="${focusKey}"] button`))?.focus?.({ preventScroll: true }); } catch { /* not focusable here */ }
    };
    draw();
    return host;
  };

  // "Which path to measure against": three chips, saved on the tap (the old drop-down, simple first)
  const pathBody = () => [
    notice("path"),
    choice(ctx, { id: "glide", label: "Which path to measure against", presets: Object.entries(RULE_CHIPS).map(([value, label]) => ({ value, label })), value: d.rule, onPick: (v) => {
      const after = compute({ ...plan, investments: { ...(plan.investments ?? {}), glide: v } }, { today });
      pending = { part: "path", text: after.actual !== null ? `Saved. ${heroWords(after).head}.` : `Saved. Once your holdings are in, the page measures them against ${RULE_WORDS[v]}.` };
      store.update((p) => { p.investments = p.investments ?? {}; p.investments.glide = v; });
    } }),
    h("p", { class: "muted small" }, RULES[d.rule].note[0].toUpperCase() + RULES[d.rule].note.slice(1) + "."),
    h("p", { class: "muted small" }, "The plan's own path is set on Will the money last? (stock share now and in retirement). The other two are only for comparison; the retirement pages always use the plan's."),
  ];

  const last = d.rows[d.rows.length - 1];
  const howBody = () => [
    h("p", { class: "small" }, "Stocks: US, international and real-estate funds, plus the stock part of balanced and target-date funds. The percent is of all your investments, in every account."),
    h("ul", { class: "records" }, [
      ["Your plan's path", `${pts(d.stocksNow)} in stocks now, gliding to ${pts(d.stocksRetired)} by the year you retire (${d.retireYear}), then flat. The retirement pages use this one.`],
      ["110 minus your age", "The classic rule of thumb: 110 minus your age in stocks. Some use 100 minus age to be careful, 120 minus age to be bold."],
      ["A target-date fund", "The shape these one-fund portfolios follow: about 90% stocks far from the date, 50% at it, 30% seven years after. Fund families differ by a few points."],
    ].map(([t, s]) => h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, t)), h("div", { class: "rec-sub" }, s)))),
    h("p", { class: "small" }, `On the path means within five points of ${RULE_WORDS[d.rule]}, which is at ${pts(last?.[d.key])} by ${d.endAge}.`),
    h("p", { class: "small" }, "The five questions: questions 2 to 5 give 0 to 2 points each. 0 to 2 points in all suggest 20% to 40% in stocks, 3 to 4 points 40% to 60%, 5 to 6 points 60% to 80%, 7 to 8 points 80% to 100%. Then how soon you need the money sets the most: money needed within 3 years at most 0% to 20%, in 3 to 10 years 40% to 60%, in 10 to 20 years 60% to 80%. The lower of the two is your range."),
  ];

  const r0 = riskRange(saved ?? {});
  root.append(h("div", {}, parts(ctx,
    d.milestones.length >= 2 && { id: "ages", kind: "more", n: d.milestones.length, noun: "ages", one: "age", body: milestones },
    { id: "risk", kind: "own", title: "Five questions about how much ups and downs suit you", set: r0.complete ? true : 0, says: r0.complete ? rangeShort(r0) : "",
      open: just?.part === "risk" || (draft !== null && !sameAnswers(draft, saved)) ? true : undefined, body: riskBody },
    { id: "path", kind: "own", title: "Which path to measure against", says: RULE_STATUS[d.rule], open: just?.part === "path" ? true : undefined, body: pathBody },
    { id: "how", kind: "how", says: "3 paths", body: howBody },
  )));
}
