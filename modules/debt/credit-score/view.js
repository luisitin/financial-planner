// modules/debt/credit-score/view.js -- DOM only. "Your credit score": the score a person typed and when, what it means on
// its scale, and the one lever that matters most (Credit cards' own figure); "+ Add a newer score" outlined. One tap away
// (core/ui/more.js): the older scores with a small line, "Keep your credit safe" (a freeze per person and bureau, saved on
// the tap, and the fraud alert's day with its Save; the free weekly reports), "Fix a mistake on your report" and "How this
// is worked out". The plan changes only through ctx.store.update: on Save, and on a tick (never per keystroke). Nothing is
// fetched from a bureau, and nothing beyond the score is kept.
import { compute, headlineOf, sentenceOf, staleSentence, leverSentence, cardsLine, emptySentence, savedSentence, safeStatus, trendWords, longDate,
  saveScore, removeScore, setFreeze, setAlert, adultsOf, BANDS, BUREAUS, FICO_PARTS, MODEL_LABELS, SCALE } from "./compute.js";
import { part, parts, links } from "../../../core/ui/more.js";
import { NameIn, nameOf, NameOf, isYou } from "../../../core/words.js";

let pending = null;   // { part, text }: the green line after a save or a tick, and the part that stays open (R7, R17)

const STYLE = `
.cs-root .cs-lede { margin: 6px 0 0; }
.cs-root .cs-lever { margin: 10px 0 0; font-weight: 600; }
.cs-root .cs-who { margin: 8px 0 0; font-weight: 600; }
.cs-root .cs-spark { width: 100%; height: 64px; display: block; }
.cs-root .cs-steps { margin: 0; padding-left: 22px; }
.cs-root .cs-steps li { margin: 6px 0; }
.cs-root .cs-bands { list-style: none; margin: 0; padding: 0; }
.cs-root .cs-bands li { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--line); }
.cs-root .cs-bands li:last-child { border-bottom: 0; }
.cs-root .cs-src { color: var(--muted); font-size: var(--fs-sm); margin: 0; }
.cs-root p { margin: 0; }
.cs-root .cs-add > .row { margin-bottom: 14px; }
`;
const SVG = "http://www.w3.org/2000/svg";

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const today = fmt.today();
  const cur = plan.meta?.currency ?? "USD";
  const d = compute(plan, { today });
  const just = pending; pending = null;
  const root = ui.h("div", { class: "cs-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const adults = adultsOf(plan);
  const whoName = (pid) => adults.find((a) => a.id === pid)?.name ?? "";

  // the answer: the score and its sentence, per person; then the one lever (not before there is a score)
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, headlineOf(d)),
    d.empty ? ui.h("p", { class: "lede" }, emptySentence()) : d.shown.flatMap((s) => [ui.h("p", { class: "lede cs-lede" }, sentenceOf(s, d)), staleSentence(s, d) ? ui.h("p", { class: "cs-lede" }, staleSentence(s, d)) : null]),
    d.empty ? null : ui.h("p", { class: "cs-lever" }, leverSentence(d.lever, cur))));
  if (just?.part === "add") root.append(ui.notice("ok", just.text));

  // the add form: open while there is no score; behind "+ Add a newer score" once there is one
  const holder = ui.h("div", { class: "cs-add" });
  root.append(holder);
  const drawForm = (withCancel) => {
    const last = d.shown[0];
    const fields = [
      // no `whole`: the kit would say "Use a whole number, like 12." for 712.5 (12 is not a score); Save says it below instead
      { key: "score", label: "Score", type: "number", min: SCALE.min, max: SCALE.max, required: true, placeholder: "e.g. 712", missing: "Type the score, a whole number from 300 to 850.", help: "Scores run from 300 to 850." },
      { key: "date", label: "The day you saw it", type: "date", required: true, max: "today" },
      adults.length > 1 ? { key: "personId", label: "Whose", type: "select", options: adults.map((a) => ({ value: a.id, label: isYou(a.name) ? "You" : a.name })) } : null,
      { key: "model", label: "Which kind", type: "select", options: ["fico", "vantage", "unsure"].map((m) => ({ value: m, label: MODEL_LABELS[m] })), help: "Your app names it, like FICO Score 8 or VantageScore 3.0." },
    ].filter(Boolean);
    const values = { date: today, personId: adults[0].id, model: last?.model ?? "unsure" };
    const form = ui.form(fields, values, (v) => {
      const box = (k) => form.querySelector?.(`[name="${k}"]`);
      if (!Number.isInteger(v.score) || v.score < SCALE.min || v.score > SCALE.max) return ui.fieldError(box("score"), "Type a whole score from 300 to 850.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.date ?? ""))) return ui.fieldError(box("date"), "Type the day you saw it.");
      const entry = { id: ui.uid(), personId: adults.length > 1 ? (v.personId ?? adults[0].id) : adults[0].id, date: v.date, score: v.score, model: v.model || "unsure" };
      const q = structuredClone(plan);
      if (!saveScore(q, entry)) return false;
      const after = compute(q, { today });
      const s = after.people.flatMap((p) => p.scores).find((x) => x.personId === entry.personId && x.date === entry.date);
      pending = { part: "add", text: savedSentence(after, s) };
      store.update((draft) => { saveScore(draft, entry); });
    }, { submitLabel: "Save", onCancel: withCancel ? () => { holder.replaceChildren(addButton()); } : undefined });
    holder.replaceChildren(ui.h("section", { class: "card" }, withCancel ? ui.h("h2", {}, "Add a newer score") : null, form));
  };
  const addButton = () => ui.row(ui.button("+ Add a newer score", () => drawForm(true), { class: "secondary" }));
  if (d.empty) drawForm(false); else holder.append(addButton());

  // the parts, as rows of one card
  const more = parts(ctx,
    d.more.length ? { id: "scores", kind: "more", n: d.more.length, noun: "scores", one: "score", open: just?.part === "scores" ? true : undefined, body: () => olderScores() } : null,
    // the person's own ticks and days: a part with boxes is "own" (the "how answers are worked out" switch never opens it)
    { id: "safe", kind: "own", title: "Keep your credit safe", says: safeStatus(d), open: just?.part === "safe" ? true : undefined,
      holds: adults.flatMap((a) => [...BUREAUS.map((b) => `freeze-${a.id}-${b.key}`), `alert-${a.id}`]), body: () => safeBody() },
    { id: "fix", kind: "how", title: "Fix a mistake on your report", says: "4 steps", body: () => fixBody() },
    { id: "how", kind: "how", says: "5 bands", body: () => howBody() });
  if (more) root.append(more);
  // "More on this" once there is a score: before that, the page has one way to start
  const deeper = d.empty ? null : links(ctx, [
    { href: "#/debt/credit-cards", ask: "Which card should I pay first?", says: "Credit cards" },
    { href: "#/debt/ratios", ask: "What would a lender see?", says: "What lenders see" },
  ]);
  if (deeper) root.append(deeper);

  // ---------------------------------------------------------------- the parts' bodies
  function olderScores() {
    const out = [];
    if (just?.part === "scores") out.push(ui.notice("ok", just.text));
    for (const p of d.people) { const line = spark(p); if (line) out.push(line); }
    out.push(ui.h("ul", { class: "records" }, d.more.map((s) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, String(s.score)), ui.h("span", { class: "rec-value" }, longDate(s.date))),
      ui.h("div", { class: "rec-sub" }, [d.shown.length > 1 || adults.length > 1 ? NameIn(whoName(s.personId) || "") : null, MODEL_LABELS[s.model], s.band ? s.band.label : null].filter(Boolean).join(" · ")),
      ui.h("div", { class: "rec-foot" }, ui.h("span", {}, ""), ui.button("Remove", () => {
        pending = { part: "scores", text: `Removed the ${s.score} from ${longDate(s.date)}.` };
        store.update((draft) => { removeScore(draft, s.id); });
      }, { class: "secondary", "aria-label": `Remove the ${s.score} from ${longDate(s.date)}` }))))));
    return out;
  }
  /** The small line: a person's scores from oldest to newest, when there are three or more. */
  function spark(person) {
    const words = trendWords(person);
    if (!words) return null;
    const pts = [...person.scores].reverse();
    const t = (s) => Date.parse(`${s.date}T12:00:00Z`);
    const t0 = t(pts[0]), t1 = t(pts[pts.length - 1]), lo = Math.min(...pts.map((s) => s.score)) - 10, hi = Math.max(...pts.map((s) => s.score)) + 10;
    const x = (s) => (t1 > t0 ? 8 + ((t(s) - t0) / (t1 - t0)) * 284 : 150), y = (s) => 56 - ((s.score - lo) / (hi - lo)) * 48;
    let svg = null;
    if (typeof document !== "undefined" && typeof document.createElementNS === "function") {
      const el = (tag, attrs) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };
      svg = el("svg", { class: "cs-spark", viewBox: "0 0 300 64", preserveAspectRatio: "none", role: "img", "aria-label": words });
      svg.append(el("polyline", { points: pts.map((s) => `${x(s).toFixed(1)},${y(s).toFixed(1)}`).join(" "), fill: "none", stroke: "var(--accent)", "stroke-width": 2, "vector-effect": "non-scaling-stroke" }));
      for (const s of pts) svg.append(el("circle", { cx: x(s).toFixed(1), cy: y(s).toFixed(1), r: 3, fill: "var(--accent)" }));
    }
    return ui.h("div", {}, svg, ui.h("p", { class: "cs-src" }, `${words}.`));
  }
  function safeBody() {
    const out = [];
    if (just?.part === "safe") out.push(ui.notice("ok", just.text));
    out.push(ui.h("p", {}, "A freeze stops anyone opening new credit in your name. It is free since September 21, 2018, it lasts until you lift it, and you can lift it for a while when you apply for credit. Check the box for each bureau once it is done: each box is saved when you tap it."));
    out.push(safeForm());
    out.push(ui.h("p", {}, "A fraud alert asks lenders to check it is really you before they open credit. It lasts one year, or seven years with an identity theft report, and the bureau you ask tells the other two."),
      ui.h("p", {}, "You can see your three reports free every week at AnnualCreditReport.com: look for accounts you do not know."),
      ui.h("p", { class: "cs-src" }, "From the Federal Trade Commission and the three bureaus (read November 13, 2026)."));
    return out;
  }
  /** The ticks per adult and bureau and each adult's fraud alert, in the kit's one form (a box in a part sits in a form: S15).
   * A tick is saved when it is tapped: a freeze is done once, at the bureau, and a tick that waited for Save was lost by
   * leaving the page (integ2 check, item 4); a tap by mistake is named in the green line and undone by one more tap. The
   * fraud alert's day waits for its Save (a date box changes on every digit typed). The green line says what is true now. */
  function safeForm() {
    const two = adults.length > 1;
    const who = (a) => (isYou(a.name) ? "You" : a.name);
    const tick = (a, b) => `freeze-${a.id}-${b.key}`, day = (a) => `alert-${a.id}`;
    const fields = adults.flatMap((a) => {
      const al = d.alerts[a.id];
      return [
        ...BUREAUS.map((b) => ({ key: tick(a, b), label: two ? `${who(a)}: frozen at ${b.name}` : `Frozen at ${b.name}`, type: "checkbox" })),
        { key: day(a), label: two ? `${who(a)}: fraud alert until (optional)` : "Fraud alert until (optional)", type: "date",
          help: al ? (al.active ? `${NameOf(a.name)} fraud alert lasts until ${longDate(al.until)}.` : `${NameOf(a.name)} fraud alert ended on ${longDate(al.until)}.`) : null },
      ];
    });
    const values = Object.fromEntries(adults.flatMap((a) => [...BUREAUS.map((b) => [tick(a, b), !!d.freeze[a.id]?.[b.key]]), [day(a), d.alerts[a.id]?.until ?? ""]]));
    const and = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
    const form = ui.form(fields, values, (v) => {
      const said = [];
      const lead = (a) => (said.length ? NameOf(a.name) : nameOf(a.name));
      for (const a of adults) {
        const now = BUREAUS.filter((b) => !!v[tick(a, b)]);
        if (BUREAUS.some((b) => !!v[tick(a, b)] !== !!d.freeze[a.id]?.[b.key])) said.push(now.length ? `${lead(a)} credit is frozen at ${and(now.map((b) => b.name))}.` : `${lead(a)} credit is not marked frozen at any bureau.`);
        const until = String(v[day(a)] ?? "");
        if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return ui.fieldError(form.querySelector?.(`[name="${day(a)}"]`), "Type the day the alert ends.");
        if (until !== (d.alerts[a.id]?.until ?? "")) said.push(until ? `${lead(a)} fraud alert lasts until ${longDate(until)}.` : `${said.length ? "No" : "no"} fraud alert on file for ${isYou(a.name) ? "you" : a.name}.`);
      }
      if (!said.length) { pending = { part: "safe", text: `Nothing to save: ${two ? "the days are" : "the day is"} as before.` }; ctx.redraw?.(); return; }
      pending = { part: "safe", text: `Saved: ${said.join(" ")}` };
      store.update((draft) => {
        for (const a of adults) {
          for (const b of BUREAUS) if (!!v[tick(a, b)] !== !!d.freeze[a.id]?.[b.key]) setFreeze(draft, a.id, b.key, !!v[tick(a, b)]);
          const until = String(v[day(a)] ?? "");
          if (until !== (d.alerts[a.id]?.until ?? "")) setAlert(draft, a.id, until);
        }
      });
    }, { submitLabel: two ? "Save the alert days" : "Save the alert day" });
    // a tick is a whole answer: saved on the tap, one store.update, and the part stays open with its green line (R17)
    for (const a of adults) for (const b of BUREAUS) {
      const box = form.querySelector?.(`[name="${tick(a, b)}"]`);
      box?.addEventListener?.("change", () => {
        const on = !!box.checked;
        if (on === !!d.freeze[a.id]?.[b.key]) return;
        pending = { part: "safe", text: on ? `Saved: ${nameOf(a.name)} credit is frozen at ${b.name}.` : `Saved: ${nameOf(a.name)} credit is no longer marked frozen at ${b.name}.` };
        store.update((draft) => { setFreeze(draft, a.id, b.key, on); });
      });
    }
    return form;
  }
  function fixBody() {
    return [ui.h("ol", { class: "cs-steps" },
      ui.h("li", {}, "Get your free reports from all three bureaus at AnnualCreditReport.com and mark what is wrong."),
      ui.h("li", {}, "Dispute it with each bureau that shows it, online or by mail, with copies of what proves it."),
      ui.h("li", {}, "The bureau has 30 days to look into it: 45 if you send more information during those 30 days, or if you dispute right after getting your free yearly report."),
      ui.h("li", {}, "It must tell you the result within 5 business days after it finishes. If it is still wrong, dispute with the company that reported it too.")),
    ui.h("p", { class: "cs-src" }, "From the Fair Credit Reporting Act (15 U.S.C. 1681i and 1681j) and the Consumer Financial Protection Bureau (read November 13, 2026).")];
  }
  function howBody() {
    const lines = (model) => ui.h("ul", { class: "cs-bands" }, BANDS[model].map((b) => ui.h("li", {}, ui.h("span", {}, `${b.lo} to ${b.hi}`), ui.h("span", {}, b.label))));
    return [ui.h("p", { class: "cs-who" }, "What the numbers mean on FICO's scale"), lines("fico"),
      ui.h("p", { class: "cs-who" }, "On VantageScore's scale"), lines("vantage"),
      ui.h("p", {}, "With \"Not sure\" no word is given: the same number can mean different things on each scale."),
      ui.h("p", { class: "cs-who" }, "What goes into a FICO score"),
      ui.h("ul", { class: "cs-bands" }, FICO_PARTS.map((x) => ui.h("li", {}, ui.h("span", {}, x.what), ui.h("span", {}, fmt.pct(x.share, 0))))),
      ui.h("p", {}, cardsLine(d, cur)),
      ui.h("p", {}, "Your scores are only what you type here: this app never asks a bureau."),
      ui.h("p", { class: "cs-src" }, "From myFICO and VantageScore (read November 13, 2026).")];
  }
}
