// modules/retirement/claiming/view.js -- DOM only. When to start Social Security: the ages that pay the most, one sentence
// per case, one filled button "Use these ages" (with Undo), and three quiet parts: every pair with its total, "Set my own
// numbers" (how much later years count, each person's health) and "How this is worked out". Simple first (docs/OPTIONAL.md):
// the first view is the answer, the survivor's sentence and the button; the rest is one tap away (core/ui/more.js).
import { compute, words, pairName, roundAbout, nowWords, savedWords, undoWords, retireWords, RATE_PRESETS, RATE_MAX } from "./compute.js";
import { parts, links, choice } from "../../../core/ui/more.js";
import { NameIn, NameOf, nameIn, verbFor } from "../../../core/words.js";

// the green line after a save, drawn once on the next render: { kind: "use" | "own", text, undo?, undoText? }
let pending = null;
const HEALTH_CHIPS = [{ value: "worse", label: "Worse than most" }, { value: "average", label: "About average" }, { value: "better", label: "Better than most" }];

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const today = fmt.today();
  const d = compute(plan, { today });
  const w = words(d, money);
  const said = pending; pending = null;
  const two = d.people.length === 2;

  // ---- the answer: headline, its sentence, the survivor's sentence, the one filled button
  const noFig = d.people.find((p) => p.why === "noFigure");
  const action = d.state === "noPeople" ? ui.h("a", { class: "btn", href: "#/household/people" }, "Add the people in your home ›")
    : d.state === "empty" ? ui.h("a", { class: "btn", href: "#/retirement/social-security" }, "Add your Social Security first ›")
    : d.apply ? ui.button(Object.keys(d.apply).length === 2 ? "Use these ages" : "Use this age", useThese) : null;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, w.title),
    ui.h("p", { class: "lede" }, w.lede),
    w.survivor ? ui.h("p", {}, w.survivor) : null,
    // a reason to doubt the answer is never folded (docs/OPTIONAL.md R9): a partner with no figure yet, a claim age in the
    // plan gone by (the Social Security page's sentence), the adults this page leaves out
    w.noFigure ? ui.h("p", { class: "small" }, w.noFigure) : null,
    w.passed ? ui.h("p", { class: "small" }, w.passed) : null,
    w.left ? ui.h("p", { class: "small" }, w.left) : null,
    action || (w.noFigure && noFig) ? ui.row(action, w.noFigure && noFig ? ui.h("a", { class: "btn secondary", href: "#/retirement/social-security" }, `Add ${nameOfLower(noFig.name)} Social Security ›`) : null) : null,
  ));
  // the green line of "Use these ages", where the button was
  if (said?.kind === "use") {
    // with the retirement answer the plan gives now (Will the money last?), worked out after the save
    const extra = said.later ? retireWords(ctx.computeOf?.("retirement/projection", { today })) : "";
    root.append(ui.notice("ok", extra ? `${said.text} ${extra}` : said.text, said.undo ? { undo: said.undo, undone: (r) => { pending = { kind: "use", text: ui.undoneWords(r, said.undoText) }; } } : {}));
  }
  if (!d.ready && d.state !== "fixed" && d.state !== "now") return;

  // ---- the parts: every pair, my own numbers, how it is worked out
  const vary = d.people.filter((p) => p.varies);
  const rows = d.pairs.filter((x) => x !== d.best && !(d.state === "best" && sameAges(x.ages, d.best.ages)));
  const pairNoun = vary.length === 2 ? ["pairs", "pair"] : ["ages", "age"];
  const ownSet = (d.set.rate ? 1 : 0) + d.set.health;
  // parts() and links() return null when there is nothing to draw: ui.h skips a null child, root.append would write "null"
  const folded = parts(ctx,
    d.ready && rows.length ? { id: "pairs", kind: "more", n: rows.length, noun: pairNoun[0], one: pairNoun[1], lazy: rows.length > 40, body: () => pairList(rows) } : null,
    d.ready ? { id: "own", kind: "own", holds: ["claimingRate", "health"], set: ownSet, says: d.rate ? `${pctWords(d.rate)} a year` : "", open: said?.kind === "own", body: () => ownBody(said?.kind === "own" ? said : null) } : null,
    d.ready ? { id: "how", kind: "how", says: `${steps().length} steps`, body: () => howBody() } : null,
  );
  if (folded) root.append(folded);
  const deeper = links(ctx, [
    { href: "#/retirement/social-security", ask: two ? "What would each of us get?" : "What would I get?", says: d.yearly > 0 ? `${money(d.yearly)} a year in your plan` : null },
    { href: "#/retirement/longevity", ask: two ? "How long might we live?" : "How long might I live?" },
    { href: "#/retirement/projection", ask: "Will the money last?" },
  ]);
  if (deeper) root.append(deeper);

  // "Use these ages": the claim age of each person who can still choose, nothing else; Undo puts back what was there
  function useThese() {
    const text = savedWords(d), undoText = undoWords(d), apply = d.apply;
    pending = { kind: "use", text, undoText, later: true };
    pending.undo = ui.undoable(store, (dr) => {
      dr.retirement = dr.retirement ?? {};
      dr.retirement.socialSecurity = dr.retirement.socialSecurity ?? {};
      for (const [id, age] of Object.entries(apply)) { dr.retirement.socialSecurity[id] = dr.retirement.socialSecurity[id] ?? {}; dr.retirement.socialSecurity[id].claimAge = age; }
    });
  }
  function pairList(list) {
    const bestTotal = d.best.total;
    return [
      ui.h("p", { class: "muted small" }, `What each ${pairNoun[1]} pays over ${two ? "your lives" : "your life"}, in today's dollars, counting each year by the chance of being alive then. Best first; the one at the top of the page pays the most.`),
      ui.h("ul", { class: "records" }, list.map((x) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${pairName(d, x.ages)}${sameAges(x.ages, d.plan.ages) ? " (your plan)" : ""}`), ui.h("span", { class: "rec-value" }, money(Math.round(x.total / 100) * 100))),
        ui.h("div", { class: "rec-sub" }, `about ${money(roundAbout(bestTotal - x.total))} less than the best`)))),
    ];
  }
  // a question and its chips (a div, not the kit's <label> field)
  function asked(label, chips) { return ui.h("div", { class: "field" }, ui.h("span", { class: "field-label" }, label), chips); }
  function ownBody(saved) {
    const out = [];
    // the green line names the answer now (docs/OPTIONAL.md R7), inside the part just saved (R17)
    if (saved) out.push(ui.notice("ok", `${saved.what} ${nowWords(d, saved.before)}`.trim()));
    out.push(ui.h("p", { class: "muted small" }, "Social Security keeps up with prices, so most people count every year the same. Count later years for less if you would rather have money sooner."));
    // a chip row is not put in a <label>: a tap on the words would press its first chip
    out.push(asked("How much less each later year counts", choice(ctx, {
      id: "claimingRate", label: "How much less each later year counts",
      presets: [{ value: RATE_PRESETS[0], label: "Count every year the same (0%)" }, { value: RATE_PRESETS[1], label: "1% a year" }, { value: RATE_PRESETS[2], label: "2% a year" }],
      value: d.rate, own: { type: "percent", label: "Your own rate a year", min: 0, max: RATE_MAX * 100 },
      onPick: (v) => {
        pending = { kind: "own", before: d.best?.ages ?? null, what: v ? `Saved: each later year now counts ${pctWords(v)} less.` : "Saved: every year now counts the same." };
        store.update((dr) => { dr.retirement = dr.retirement ?? {}; dr.retirement.claimingRate = v; });
      },
    })));
    for (const p of d.people) {
      out.push(asked(`${NameOf(p.name)} health`, choice(ctx, {
        id: `health-${p.id}`, label: `${NameOf(p.name)} health`, presets: HEALTH_CHIPS, value: p.health,
        onPick: (v) => {
          pending = { kind: "own", before: d.best?.ages ?? null, what: `Saved: ${nameOfLower(p.name)} health is now "${HEALTH_CHIPS.find((c) => c.value === v).label.toLowerCase()}".` };
          store.update((dr) => {
            dr.retirement = dr.retirement ?? {};
            dr.retirement.longevity = dr.retirement.longevity ?? {};
            const was = dr.retirement.longevity[p.id] ?? {};
            dr.retirement.longevity[p.id] = { sex: was.sex ?? "", health: v };
          });
        },
      })));
    }
    out.push(ui.h("p", { class: "muted small" }, "Health is shared with How long to plan for, which shows the chance of reaching each age."));
    return out;
  }
  function steps() {
    return [
      `Every ${pairNoun[1]} of starting ages is tried, from 62 (or today's age, if later) to 70 for ${two && vary.length === 2 ? "each of you" : nameIn(vary[0]?.name ?? "")}, and added up year by year from today to age 110.`,
      "Starting before full retirement age (67 for anyone born in 1960 or later) takes 5/9 of 1% off the check for each of the first 36 months early and 5/12 of 1% for each month before that. Waiting past it adds 2/3 of 1% a month, 8% a year, up to 70.",
      d.married && two ? "A husband's or wife's top-up: half the other's full-age amount, less their own, once both have started. It is cut by 25/36 of 1% a month for the first 36 months before full retirement age and 5/12 of 1% for each month before that. Waiting adds nothing to it." : null,
      d.married && two ? "When one of you dies, the one left gets the larger of their own check and the other's, from their full retirement age. A check started early still leaves at least 82.5% of the full-age amount; one not started yet leaves the full-age amount and what waiting had added by then." : null,
      `Each year counts by the chance of being alive then, from How long to plan for: ${d.people.map((p) => `${NameIn(p.name)} ${verbFor(p.name, "has", "have")} about a ${fmt.pct(p.odds85, 0)} chance of reaching 85 and ${fmt.pct(p.odds95, 0)} of reaching 95`).join("; ")}.${two ? " The two lives are taken as independent." : ""}`,
      d.rate ? `In today's dollars: Social Security rises with prices each year. Each later year counts ${pctWords(d.rate)} less than the one before, as you set.` : "In today's dollars: Social Security rises with prices each year, so every year counts the same unless you set a rate in Set my own numbers.",
    ].filter(Boolean);
  }
  function howBody() {
    return [
      ...steps().map((s, i) => ui.h("p", {}, `${i + 1}. ${s}`)),
      ui.h("p", { class: "muted small" }, "Left out: tax on the checks, the limit on earnings while working before full retirement age, a widow's or widower's check started before full retirement age (it can start at 60, smaller), checks for children or a former spouse, and more years of work raising the full-age amount."),
      ui.h("p", { class: "muted small" }, "From the Social Security Administration's own rules, read November 13, 2026. A guide to compare, not advice: the right age also depends on your health, your savings and what you need now."),
    ];
  }
}

const sameAges = (a, b) => Object.keys(a).every((k) => Math.abs(a[k] - b[k]) < 1 / 24);
const pctWords = (r) => `${Number((r * 100).toPrecision(6))}%`;
const nameOfLower = (name) => NameOf(name).replace(/^Your/, "your");
