// modules/overview/health-score/view.js -- DOM only. Simple first (opt spec 6.2, ha2): the score as a ring with its band, the
// two parts that would gain the most (each with its reason and the one step that earns the points), then one card of two quiet
// rows: "N more parts" (every other part) and "How this is worked out". Runs on the PC when connected (it runs the stress tests).
import { PARTS, BANDS } from "./compute.js";
import { setupCard } from "../start/compute.js";
import { firstStep } from "../dashboard/compute.js";
import { parts } from "../../../core/ui/more.js";

const STYLE = `
.hs-root .hs-hero { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
.hs-root .hs-ring { flex: none; width: 132px; height: 132px; }
.hs-root .hs-ring text { font: 700 34px system-ui, sans-serif; }
.hs-root .hs-ring .sub { font: 600 12px system-ui, sans-serif; }
.hs-root .hs-lede { flex: 1 1 200px; min-width: 0; }
.hs-root .hs-parts { list-style: none; margin: 0; padding: 0; }
.hs-root .hs-part > a { display: block; padding: 12px 0; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none; min-height: 44px; }
.hs-root .hs-part:last-child > a { border-bottom: 0; }
.hs-root .hs-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.hs-root .hs-t { font-weight: 650; }
.hs-root .hs-pts { font-weight: 700; white-space: nowrap; }
.hs-root .hs-pts small { color: var(--muted); font-weight: 500; }
.hs-root .hs-meter { height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; margin: 6px 0; }
.hs-root .hs-meter span { display: block; height: 100%; border-radius: 999px; }
.hs-root .hs-d { color: var(--text-2); font-size: var(--fs-sm); }
.hs-root .hs-fix { font-size: var(--fs-sm); font-weight: 600; color: var(--accent-ink); margin-top: 4px; }
.hs-root .steps li.next .lbl .muted { font-weight: 400; }
`;
/** The two parts that would gain the most are on the first view (opt spec 6.2: "the score + the two parts that pull it down most"). */
export const FIRST_ROWS = 2;
/** A row's way on says what the person finds there; "Open <page title>" (OV-5) unless the title names nothing a layperson knows
 * (ha2: "Goal seek"; Will the money last? links to the same page with "What would change it ›"). */
export const LINK_WORDS = { "scenarios/goal-seek": "See what would change this" };
/** The parts on the first view: the largest gains, never a part whose points wait on another part's ask (`askedIn`: that ask
 * names them), so one missing figure is one row (ha2). The ask itself (the part with `unlock`) is first: its part scores nothing
 * yet, so no other gain is larger, and on a tie with a 15-point part it still makes the first view (ha2 fix P1). */
export const firstRows = (d) => {
  const g = (d?.gains ?? []).filter((p) => !p.askedIn), ask = g.find((p) => p.unlock);
  return (ask ? [ask, ...g.filter((p) => p !== ask)] : g).slice(0, FIRST_ROWS);
};
/** Said after the one ask's step: the score is not final while it waits (ha2 fix P1: "Good: 76 out of 100" with Protection
 * waiting on Sam's Social Security read as settled). */
export const MAY_CHANGE = "Your score may change once this is in.";
/** A part's step as the page says it: the ask's with MAY_CHANGE after it. */
const stepOf = (p) => (p.fix && p.unlock ? `${p.fix} ${MAY_CHANGE}` : p.fix);
const TONE = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)", unknown: "var(--line-2)" };

export function render(page, ctx) {
  const { ui, fmt } = ctx;
  const root = ui.h("div", { class: "hs-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const host = ui.h("div", {}, ui.notice("info", "Scoring your plan (this runs the stress tests too)..."));
  root.append(host);
  ctx.computeRemote("overview/health-score", { today: fmt.today() }).then((d) => {
    host.replaceChildren();
    if (!d || !d.ready) { host.append(ui.notice("warn", `The score needs ${(d?.missing ?? []).join(", ")}.`)); return; }
    // the page each row opens, by its own title (OV-5: rows opened pages they did not name)
    // "Open <page>"; the part rows add the chevron, the step rows have their own (review 2026-11-11 N9: "Open Budget › ›")
    const opens = (p, chev = true) => `${LINK_WORDS[p.go.join("/")] ?? `Open ${ctx.modules?.get?.(p.go.join("/"))?.title ?? "the page"}`}${chev ? " \u203a" : ""}`;
    const partRow = (p) => ui.h("li", { class: "hs-part" }, ui.h("a", { href: hrefOf(p) },
      ui.h("div", { class: "hs-head" }, ui.h("span", { class: "hs-t" }, p.title), ui.h("span", { class: "hs-pts" }, p.status === "unknown" ? "not known yet" : fmtPts(p.points), p.status === "unknown" ? null : ui.h("small", {}, ` out of ${p.max}`))),
      ui.h("div", { class: "hs-meter", role: "img", "aria-label": `${p.title}: ${p.status === "unknown" ? "not known yet" : `${fmtPts(p.points)} out of ${p.max}`}` }, ui.h("span", { style: { width: `${(p.points / p.max) * 100}%`, background: TONE[p.status] } })),
      ui.h("div", { class: "hs-d" }, p.detail),
      p.fix ? ui.h("div", { class: "hs-d" }, stepOf(p)) : null,
      ui.h("div", { class: "hs-fix" }, opens(p))));
    const weights = `Seven parts, each scored by the page that works it out: ${Object.entries(PARTS).map(([k, v]) => `${label(k)} ${v}`).join(", ")}. ${BANDS.slice(0, 3).map((b) => `${b.label} from ${b.min}`).join(", ")}.`;
    // how the score is worked out: the weights and bands, and each part's rule (with a scored retirement part, its own share)
    const ret = d.parts.find((p) => p.id === "retirement");
    const yours = Number.isFinite(ret?.ratio) ? ` Yours is ${Math.round(ret.ratio * 100)}%.` : "";
    // what the one ask does to the score (ha2 fix F2, P2: the sure points and the parts it lets be scored, here and not on the first view)
    const asking = d.parts.find((p) => p.unlock);
    const how = (scoredPage = true) => [scoredPage && asking ? ui.h("p", { class: "small" }, asking.unlock) : null, ui.h("p", { class: "muted small" }, weights), ui.h("ul", {},
      ui.h("li", {}, "Emergency fund: months of the bills you have to pay in usable cash, against the plan's target (Emergency fund)."),
      ui.h("li", {}, "Saving: retirement saving, goal saving and what is left over, as a share of income after federal and payroll tax; 20% earns full marks (the 20 of the 50/30/20 rule)."),
      ui.h("li", {}, "Debt: most points for no card-type debt (10% interest or more); the rest for payments under 36% of pay before tax, or 20% if you rent."),
      ui.h("li", {}, `Retirement: the steady spending the plan can pay for against what it plans: nothing at 60%, full marks at 115% (room for bad luck).${yours}`),
      ui.h("li", {}, "Protection: the share of the stress tests' life shocks the money survives (a job loss, never working again, a death, a long life, a care home)."),
      ui.h("li", {}, "Goals: the share of dated goals done or on track. The plan knows enough: seven things filled in and current."),
      ui.h("li", {}, "A part the plan cannot judge yet scores nothing and says what to add: filling it in is the quickest way up."),
    ),
    // before a score, what the retirement check still needs, in the words every retirement page uses (l001, tests/wording-verify:
    // the seven part rows that said it ran 1,440 px open, so only this one line is kept)
    !scoredPage && ret?.status === "unknown" && ret.fix ? ui.h("p", { class: "small" }, `${ret.title}: ${ret.detail} ${ret.fix}`) : null];
    // not started: no grade for a plan with nothing in it (OV-4); one filled button into the questions, the parts folded
    // part way through the questions it is no grade either (attack2: "21 out of 100" with the debts question still to come)
    let sc = null; try { sc = setupCard(ctx.plan, { today: fmt.today() }); } catch { sc = null; }
    if (d.scored === false || sc?.state === "started") {
      // the questions done (or skipped): the first thing still missing, by the page that takes it, never back to the questions
      const P = (k) => (ctx.plan?.[k] ?? []).length;
      const gap = !(ctx.plan?.household?.people ?? []).length ? ["#/household/people", "Add who is in your household \u203a"]
        : !P("accounts") ? ["#/balance/net-worth", "Add what you own \u203a"] : ["#/cashflow/expenses", "Add what goes out \u203a"];
      // never opened: the Dashboard's first step (firstStep), "Set up my plan" only while there are no accounts; with an
      // account it is the first missing basic, as the Dashboard and the quiet row say it (attack on N18)
      let fs = null; try { fs = firstStep(ctx.plan); } catch { fs = null; }
      const btn = sc?.state === "started" ? [sc.href, `Continue your plan: question ${sc.q} of ${sc.total} \u203a`]
        : sc?.state === "done" ? gap : fs?.kind === "basics" ? [fs.href, `${fs.label} \u203a`] : ["#/overview/setup", "Set up my plan \u203a"];
      const basics = sc?.state !== "started" && sc?.state !== "done" && fs?.kind === "basics";
      const lede = sc?.state === "started" ? "Your score appears once you reach the end of the questions, so it counts everything you tell us."
        : sc?.state === "done" || basics ? "Your score appears once the plan knows who you are, what you own and what you spend. Add what is still missing."
          : "Your score appears once the plan knows who you are, what you own and what you spend. The easy questions fill in all three.";
      host.append(ui.h("section", { class: "card accent hero" },
        ui.h("h1", {}, "No score yet"),
        ui.h("p", { class: "lede" }, lede),
        basics || ctx.modules?.has?.("overview/setup") ? ui.h("a", { class: "btn", href: btn[0], style: { marginTop: "6px" } }, btn[1]) : null));
      // the seven parts it will score and what each is worth, one quiet row (it was the fold "The seven parts it will score",
      // every part's row: open, 1,440 px on a phone, over the 1,300 a part may take; what each part needs is what the
      // questions above ask, and every part's row is on the page once there is a score)
      host.append(parts(ctx, { id: "how", kind: "how", body: () => how(false) }));
      return;
    }
    const tone = d.score >= 85 ? "var(--ok)" : d.score >= 50 ? "var(--accent)" : "var(--warn)";
    host.append(ui.h("section", { class: "card accent hero" },
      ui.h("div", { class: "hs-hero" }, ring(d.score, d.band, tone),
        ui.h("div", { class: "hs-lede" },
          ui.h("h1", {}, `${d.band}: ${d.score} out of 100`),
          ui.h("p", { class: "lede" }, d.gains.length ? `You can gain the most points in "${d.gains[0].title}"${d.gains[1] ? ` and "${d.gains[1].title}"` : ""}.` : "Every part is at full marks.")))));
    // the two parts that would gain the most, each with its reason and the one step that earns the points; a part whose points
    // wait on another's ask is not a row of its own (ha2: one missing figure, one ask)
    const first = firstRows(d), shownIds = new Set(first.map((p) => p.id));
    if (first.length) host.append(ui.card("Where the points are",
      ui.h("ol", { class: "steps" }, first.map((p, i) => ui.h("li", { class: i === 0 ? "next" : null },
        ui.h("a", { class: "step-link", href: hrefOf(p) }, ui.h("span", { class: "num" }, `+${Math.round(p.max - p.points)}`),
          ui.h("span", { class: "lbl" }, ui.h("strong", {}, p.title), ui.h("br"), ui.h("span", { class: "muted small" }, p.detail),
            p.fix ? [ui.h("br"), ui.h("span", { class: "muted small" }, stepOf(p))] : null,
            ui.h("br"), ui.h("span", { class: "small", style: { color: "var(--accent-ink)", fontWeight: "600" } }, opens(p, false))),
          ui.h("span", { class: "chev", "aria-hidden": "true" }, "›")))))));
    // one tap away: every other part as its row (points, bar, reason, step, its page), and how the score is worked out
    const others = d.parts.filter((p) => !shownIds.has(p.id));
    host.append(parts(ctx,
      others.length && { id: "parts", kind: "more", n: others.length, noun: "parts", one: "part", body: () => ui.h("ul", { class: "hs-parts" }, others.map(partRow)) },
      { id: "how", kind: "how", says: `${d.parts.length} parts`, body: () => how(true) }));
  });
}

function ring(score, band, tone) {
  const NS = "http://www.w3.org/2000/svg";
  const e = (t, a, txt) => { const x = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) x.setAttribute(k, v); if (txt !== undefined) x.textContent = txt; return x; };
  const r = 54, c = 2 * Math.PI * r;
  const s = e("svg", { viewBox: "0 0 132 132", class: "hs-ring", role: "img", "aria-label": `Score ${score} out of 100, ${band}` });
  s.append(e("circle", { cx: 66, cy: 66, r, fill: "none", stroke: "var(--line)", "stroke-width": 12 }));
  s.append(e("circle", { cx: 66, cy: 66, r, fill: "none", stroke: tone, "stroke-width": 12, "stroke-linecap": "round", "stroke-dasharray": `${(score / 100) * c} ${c}`, transform: "rotate(-90 66 66)" }));
  s.append(e("text", { x: 66, y: 74, "text-anchor": "middle", fill: "var(--text)" }, String(score)));
  s.append(e("text", { x: 66, y: 94, "text-anchor": "middle", fill: "var(--muted)", class: "sub" }, "out of 100"));
  return s;
}
/** A part's page, with the target it was worked out for when it has one (round 8 review: Goal seek opened on "Just last"). */
const hrefOf = (p) => `#/${p.go[0]}/${p.go[1]}${p.query ? `?${Object.entries(p.query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}` : ""}`;
const fmtPts = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const label = (k) => ({ cushion: "emergency fund", saving: "saving", debt: "debt", retirement: "retirement", protection: "protection", goals: "goals", knows: "a complete plan" })[k];
