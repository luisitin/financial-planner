// modules/overview/dashboard/view.js -- DOM only. Welcome, start-here actions, setup
// steps, and what is coming. Money numbers appear once there is money in the plan: first where you stand (one plain
// sentence, three status lines and your next move, from overview/setup's standing()), then the owner's four tiles.
import { PHASES } from "../../../core/phases.js";
import { usable, offKeys } from "../guide/act.js";
import { pathSummary } from "../guide/compute.js";
import { goalsBehind } from "../alerts/compute.js";
import { checkInDue } from "../monthly-review/compute.js";
import { setupCard } from "../start/compute.js";
import { retireGuessAsk } from "../setup/compute.js";
import { monthsNear } from "../../../core/words.js";
import { homeNext, calmHeadline, SHORT_LABEL } from "./compute.js";
import { aiHealth } from "../../ai/health.js";
import { fillCard, missingCard, upgradeCard, registryOf, sayNotice } from "../guesses/view.js";

// scoped to the where-you-stand card (no new global CSS)
const STYLE = `
.db-now h1 { font-size: var(--fs-xl); margin: 0 0 6px; }
.db-now .db-head { color: var(--text); font-size: var(--fs-md); line-height: 1.45; margin: 0 0 14px; text-wrap: pretty; }
.db-now .db-rows { list-style: none; margin: 0 0 16px; padding: 0; }
.db-now .db-rows li + li a { border-top: 1px solid var(--line); }
.db-now .db-rows a { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 2px; color: var(--text); text-decoration: none; }
.db-now .db-rows a:hover .db-k { color: var(--accent-ink); }
.db-now .db-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--text-2); }
.db-now .db-dot.ok { background: var(--ok); } .db-now .db-dot.warn { background: var(--warn); } .db-now .db-dot.bad { background: var(--bad); }
.db-now .db-k { flex: 1; min-width: 0; font-weight: 600; line-height: 1.3; }
.db-now .db-s { display: block; font-weight: 400; font-size: var(--fs-sm); color: var(--text-2); margin-top: 2px; }
.db-now .db-v { flex: none; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }
.db-now .db-v.open { font-weight: 600; color: var(--accent-ink); }
.db-now .db-chev { flex: none; color: var(--text-2); font-size: 20px; line-height: 1; }
.db-now .db-go { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 52px; text-align: center; font-size: var(--fs-md); }
.db-now .db-all { display: flex; align-items: center; justify-content: center; min-height: 44px; margin-top: 6px; font-weight: 600; }
/* a 320 px phone: the row's explanation goes under its figure, so the filled button stays on the first screen (stress test 2026-11-11) */
@media (max-width: 359px) { .db-now .db-rows a { flex-wrap: wrap; row-gap: 2px; column-gap: 8px; } .db-now .db-k { display: contents; } .db-now .db-rows .db-s { order: 5; flex-basis: 100%; padding-left: 18px; margin-top: 0; } .db-now .db-v { margin-left: auto; } .db-now .db-go { font-size: var(--fs); } }
.db-hero .db-go { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 52px; margin-top: 14px; text-align: center; font-size: var(--fs-md); }
.db-hero .db-all { display: flex; align-items: center; justify-content: center; min-height: 44px; margin-top: 6px; font-weight: 600; }
@media (min-width: 720px) { .db-hero .db-go { width: auto; display: inline-flex; padding: 0 22px; } .db-now .db-go { width: auto; display: inline-flex; padding: 0 22px; } .db-now .db-all { display: inline-flex; margin: 0 0 0 16px; } }
`;

// The green line a tap on one of our guesses' cards leaves, shown where the card was on the next render (the shell re-renders
// after store.update).
let pending = null;

// Whether the AI helper answers, asked at most once a minute (the Dashboard re-renders after every change) and never
// waited for: the "Ask a question" tile is drawn at once and changes when the answer comes.
let aiSeen = { st: null, at: 0, asking: null };
const AI_RECHECK_MS = 60000;
function aiAnswers(ai) {
  if (aiSeen.st !== null && Date.now() - aiSeen.at < AI_RECHECK_MS) return Promise.resolve(aiSeen.st);
  aiSeen.asking ??= Promise.resolve().then(() => aiHealth(ai)).then((h) => h.st).catch(() => "unreachable")
    .then((st) => { aiSeen = { st, at: Date.now(), asking: null }; return st; });
  return aiSeen.asking;
}

export function render(root, ctx) {
  const { ui, fmt, plan, derived: d, computeOf, modules, isReady, store, go } = ctx;
  const cur = plan.meta.currency;
  const all = [...modules.values()];
  const readyN = all.filter(isReady).length;
  const today = fmt.today();
  const setupOn = usable(ctx, "overview/setup");
  let moveShown = false;   // the where-you-stand card holds the page's one filled button
  let shown = null;        // that button (homeNext), for the cards below that must not repeat or contradict it
  const way = setupOn ? (() => { try { return pathSummary(plan, { off: offKeys(ctx), today }); } catch { return null; } })() : null;
  const pathStarted = way?.started ? way : null;
  // "Set up my plan" stopped part way: every place that offers it picks up at the question reached (Get started's own card)
  const sc = setupOn ? setupCard(plan, { today }) : null;
  const underWay = !!way && way.started && !way.complete && !!way.next;
  // the page's one filled button, the same rule for every household (dashboard compute homeNext; stress test 2026-11-11)
  const nextOf = (move) => homeNext({ setupOn, hasMoney: d.hasMoney, path: way, setup: sc, steps: d, move });
  root.append(ui.h("style", {}, STYLE));

  // ---- welcome / money
  if (!d.hasMoney) {
    // The hero says what to do first; the build progress bar lives in "What is coming"
    // (design log 2026-09-15).
    // The hero holds the page's one filled button on the first screen: the questions, picked up where they stopped, or the
    // path once they are answered (stress test 2026-11-11: x-4, F5, OV-7; design log 2026-11-06)
    const nx = nextOf(null);
    shown = nx;
    const bold = !setupOn ? "Start by adding your accounts. It takes about five minutes."
      : nx?.kind === "questions" ? `You're part way through the questions: question ${sc.q} of ${sc.total} is next. What you have answered is kept.`
      : nx?.kind === "path" && way?.next?.key !== "answers" ? `You've been through the questions. Next: ${way.next.name}, step ${way.step} of ${way.total} of your plan.`
      : nx?.kind === "plan" || nx?.kind === "move" ? "Your plan is complete. Add your accounts any time to see more."
      : "Start with a few easy questions: about five minutes for those, about 20 for your whole plan.";
    root.append(ui.h("section", { class: "card accent hero db-hero" },
      ui.h("h1", {}, "Your financial plan"),
      ui.h("p", { class: "lede" }, "Everything about your money in one place, on your own computer. Nothing here goes to the cloud."),
      ui.h("p", { class: "lede", style: { marginTop: "10px", fontWeight: "600" } }, bold),
      nx && nx.kind !== "checklist" ? ui.h("a", { class: "btn db-go", href: nx.href }, `${nx.label} ›`) : null,
      // a plan with nothing in it yet but the questions answered or skipped still has a page to see: Your plan says what is missing
      setupOn && pathStarted && nx?.kind !== "plan" ? ui.h("a", { class: "db-all", href: pathStarted.planHref }, way?.complete ? "See your plan ›" : "See your plan so far ›") : null,
    ));
  } else {
    // ---- our guesses (spec 11.3): one card at a time. "Fill in what you skipped" and "Is something missing?" sit right under
    // where you stand (C7 UX review 2: a green "Left over" with the card a screen below read as money to spare); "Better
    // guesses are ready" after the money tiles. Dashboard compute's `guesses`; nothing is written before a tap.
    const reg = usable(ctx, "overview/guesses") ? registryOf(ctx) : null;
    const gc = reg ? computeOf("overview/dashboard", { today, estimators: reg.estimators, tables: reg.tables })?.guesses ?? null : null;
    const say = (kind, text, undo = null) => { pending = { kind, text, undo }; };
    const said = pending ? sayNotice(ctx, pending, say) : null;
    if (pending) { ctx.announce?.(pending.text); pending = null; }
    const fillSpend = gc?.first === "fill" ? gc.fill.find((x) => x.case === "spend") ?? null : null;
    const guessCard = gc?.first === "fill" ? fillCard(ctx, gc.fill, { reg, today, say, compact: true, quiet: setupOn }) : gc?.first === "missing" ? missingCard(ctx, gc.missing, { reg, today, say, quiet: setupOn }) : null;
    // while the card is up, the rows it decides go calm and lead to it: one way to fill in spending, not two (UX review 4)
    const toCard = guessCard ? { onClick: (e) => { e.preventDefault(); guessCard.scrollIntoView?.({ behavior: "smooth", block: "start" }); } } : {};
    // ---- where you stand: the setup's end screen, kept up to date, so every return starts with it
    const st = setupOn ? computeOf("overview/setup", { today, screen: "done" })?.standing ?? null : null;
    // balances more than a month old: one line here (not another card under What to do now, the owner's three)
    const bu = usable(ctx, "balance/update") ? computeOf("balance/update", { today }) : null;
    if (st && !st.error) {
      const self = (plan.household?.people ?? []).find((p) => p.role === "self");
      const name = self?.name && self.name !== "Me" ? self.name : null;
      const money = (n) => fmt.money(Math.round(Number(n) || 0), cur);
      // part way through the questions, a row's "Add ›" picks them up at the question reached: a save from a single
      // question opened with ?back=done ends on the reveal and drops the questions not yet asked (stress test retest)
      const back = (id) => (sc?.state === "started" ? sc.href : `#/overview/setup/${id}?back=done`);
      const rows = [];
      // short on the careful month (Side income's "count on": uneven pay counted at what you can count on): the row says so,
      // with what a month that brings the Income page's amount leaves (setup's standing().lean, which also words the sentence
      // above the rows; review 2026-11-02, round 5: the Dashboard had its own sentence, the setup's done screen the plain one)
      const lean = st.lean ?? null;
      if (st.spare === null) { const hasPay = (plan.income ?? []).length > 0, hasSpend = (plan.expenses ?? []).length > 0; rows.push({ dot: "", k: "Left over each month", s: hasPay ? "Needs what you spend each month" : hasSpend ? "Needs your pay" : "Needs your pay and spending", v: "Add ›", open: true, href: back(hasPay ? "spend" : "money") }); }
      // most of the spending is our guesses (spec 8.1): no green or amber dot; what our guesses say, and where to type yours
      else if (st.spareWaits) rows.push({ dot: "", k: "Left over each month", s: `Depends on your spending. With our guesses, about ${money(Math.round(Math.abs(st.spare) / 10) * 10)} ${st.spare < 0 ? "short" : "spare"}${st.childcareMissing ? ". Childcare is not counted yet" : ""}`, v: "Type yours ›", open: true, href: back("spend") });
      else if (st.drawing) rows.push({ dot: "", k: "Drawn from savings each month", s: "What a pension and Social Security don't cover", v: money(-st.spare), href: "#/retirement/projection" });
      // the bank files show more going out than Expenses lists: the figure is from Expenses, so it is amber and says so
      else if (st.bank) rows.push({ dot: "warn", k: "Left over each month", s: `By your plan. Your bank shows about ${money(Math.round(st.bank.gap / 10) * 10)} a month more going out`, v: money(st.spare), href: "#/cashflow/expenses" });
      else rows.push({ dot: st.spare >= 0 ? "ok" : "warn", k: "Left over each month", s: st.spare >= 0 ? `${st.debtExtra > 0 ? `After tax, bills, saving and ${money(st.debtExtra)} extra on ${st.debtOn ?? "debts"}` : "After tax, bills and saving"}${st.yearWords ? `. ${st.yearWords}` : ""}` : lean ? `In a lean month. When all your uneven pay comes in, ${lean.kind === "ahead" ? `about ${money(lean.about)} is left` : lean.kind === "even" ? "it only just about breaks even" : `it is still about ${money(-lean.about)} short`}` : "More goes out than comes in", v: money(st.spare), href: "#/overview/next-best-action" });
      if (st.runway === null) { const hasSpend = (plan.expenses ?? []).length > 0, hasCash = (plan.accounts ?? []).some((a) => ["checking", "savings", "cash"].includes(a.type)); rows.push({ dot: "", k: "Emergency fund", s: hasSpend ? "Needs your savings" : hasCash ? "Needs what you spend each month" : "Needs your spending and savings", v: "Add ›", open: true, href: back(hasSpend ? "have" : "spend") }); }
      else if (st.runwayWaits) rows.push({ dot: "", k: "Emergency fund", s: `By our guesses of your bills. Aim for ${st.runwayTarget ?? 6} months`, v: `About ${monthsNear(st.runway, st.runwayTarget ?? 6)}`, href: "#/balance/liquidity" });
      else rows.push({ dot: st.runwayStatus === "ok" ? "ok" : st.cushionLater ? "warn" : st.runwayStatus === "bad" ? "bad" : "warn", k: "Emergency fund", s: st.runwayStatus === "ok" ? "Covered" : st.cushionLater ? `Enough for now; ${st.runwayTarget ?? 6} months after the costly debt` : `Aim for ${st.runwayTarget ?? 6} months`, v: monthsNear(st.runway, st.runwayTarget ?? 6), href: "#/balance/liquidity" });
      // Social Security and the birth dates known, the forecast still waits: on the spending (j-first-renter/x-1: it said the
      // ages were missing and sent them back to the question they had just answered)
      if (!st.retire && !st.retirementMissing && !(plan.expenses ?? []).length) rows.push({ dot: "", k: "Retirement", s: "Needs what you spend each month", v: "Add ›", open: true, href: back("spend") });
      else if (!st.retire && !st.retirementMissing) rows.push({ dot: "", k: "Retirement", s: "Needs a few more of your figures", v: "Add ›", open: true, href: "#/retirement/projection" });
      else if (!st.retire) rows.push({ dot: "", k: "Retirement", s: `Needs ${st.retirementMissing}`, v: "Add ›", open: true, href: back("ages") });
      // the tick for a retirement account is on "What do you have?", not on the amounts screen (j-first-renter/x-2)
      else if (st.retireSavingsUnknown) rows.push({ dot: "", k: "Retirement", s: "Add your retirement savings to see", v: "Not known yet", open: true, href: back("have") });
      else if (st.retireGuessed) rows.push({ dot: "", k: "Retirement", s: retireGuessAsk(st).dash, v: st.retire.verdict === "on track" ? "On track" : st.retire.verdict === "tight" ? "Tight" : "Needs a look", href: "#/retirement/projection" });
      else rows.push({ dot: st.retire.verdict === "on track" ? "ok" : "warn", k: "Retirement", s: st.retire.verdict === "on track" ? "The money lasts" : "Small changes help", v: st.retire.verdict === "on track" ? "On track" : st.retire.verdict === "tight" ? "Tight" : st.retire.shortAge ? `Short at ${st.retire.shortAge}` : "Needs a look", href: "#/retirement/projection" });
      // time for the monthly update: the oldest balance is 25 days old or more (or one has no date)
      const oldDays = bu?.rows?.length ? Math.max(...bu.rows.map((r) => (r.days === null ? Infinity : r.days))) : 0;
      // the month just ended and not checked in on: one row inviting the check-in, all month (not only the first ten days:
      // stress test 2026-11-11, MR-2), opening that month; its first step is the balances, so it takes the balances row's
      // place. Checked in: one quiet line that says so and when the next one is (unless the balances row is due).
      // (a plan made this month is never asked about last month: checkInDue wants something dated before the 1st)
      const due = usable(ctx, "overview/monthly-review") ? checkInDue(plan, today) : null;
      if (due && !due.done) rows.push({ dot: oldDays >= 25 ? "warn" : "", k: `Your ${due.name} check-in`, s: oldDays >= 25 ? "Starts with your balances: about ten minutes" : "A look back at where the money went: about ten minutes", v: "Start ›", open: true, href: `#/overview/monthly-review?month=${due.month}` });
      else if (due?.done && oldDays < 25) rows.push({ dot: "ok", k: `${due.name} check-in done \u2713`, s: `Next: early ${due.nextWhen}, to look back at ${due.nextName}`, v: "", href: `#/overview/monthly-review?month=${due.month}` });
      else if (oldDays >= 25) rows.push({ dot: "warn", k: "Your balances", s: Number.isFinite(oldDays) ? `The oldest is from ${fmt.date(bu.oldest)}, ${oldDays} days ago` : "Some have no date yet", v: "Update ›", open: true, href: "#/balance/update" });
      // (C7 UX reviews 2 and 4: with spending or a debt left out, or a list far too short, the month and retirement wait on the card)
      if (guessCard) {
        const waitWords = gc.first === "missing" ? `Depends on your spending: your list may be missing about ${money(Math.round(gc.missing.rest / 10) * 10)} a month` : fillSpend ? "Depends on your spending: not counted yet" : "Depends on what you owe: not all counted yet";
        for (const r of rows) {
          if (r.k === "Left over each month" || (r.k === "Emergency fund" && r.open && fillSpend)) Object.assign(r, { dot: "", s: r.k === "Left over each month" ? waitWords : "Needs your spending", v: "See below ›", open: true, href: "#/overview/guesses", ...toCard });
          else if (r.k === "Retirement" && !r.open) Object.assign(r, { dot: "", s: "Depends on the figures below", v: "See below ›", open: true, href: "#/overview/guesses", ...toCard });
        }
      }
      const move = st.moves[0] ?? null;
      // the path (Your plan) under way: the page's one filled button continues it, and the next move waits on Your plan;
      // complete: the next move, else "See your plan" (homeNext)
      const nx = nextOf(move);
      moveShown = !!nx; shown = nx;
      root.append(ui.h("section", { class: "card db-now", "aria-labelledby": "db-now-h" },
        ui.h("h1", { id: "db-now-h" }, name ? `Hi ${name}.` : "Where you stand"),
        ui.h("p", { class: "db-head" }, calmHeadline(st.headline, { underWay })),
        ui.h("ul", { class: "db-rows" }, rows.map((r) => ui.h("li", {}, ui.h("a", { href: r.href, "aria-label": `${r.k}: ${r.open ? "not known yet" : r.v}. ${r.s}.`, ...(r.onClick ? { onClick: r.onClick } : {}) },
          ui.h("span", { class: `db-dot ${r.dot}`, "aria-hidden": "true" }),
          ui.h("span", { class: "db-k", "aria-hidden": "true" }, r.k, ui.h("span", { class: "db-s" }, r.s)),
          ui.h("span", { class: `db-v${r.open ? " open" : ""}`, "aria-hidden": "true" }, r.v),
          r.open ? null : ui.h("span", { class: "db-chev", "aria-hidden": "true" }, "›"))))),
        nx?.line ? ui.h("p", { class: "db-s", style: { margin: "0 0 8px" } }, nx.line) : null,
        nx ? ui.h("a", { class: "btn db-go", href: nx.href }, `${nx.label} ›`) : null,
        nx?.kind === "plan" ? null : ui.h("a", { class: "db-all", href: way?.started ? way.planHref : "#/overview/setup/done" }, underWay ? "See your plan so far ›" : way?.complete ? "See your plan ›" : move ? "See all your moves ›" : "See where you stand ›")));
    }
    if (said) root.append(said);
    if (guessCard) root.append(guessCard);

    const nw = computeOf("balance/net-worth", { today });   // change since the last point before today
    const savedToday = (nw.history ?? []).some((h) => h.date === today);
    const gl = computeOf("goals/goals", { today: fmt.today() }) ?? {};
    // how far behind, as money a month (Needs attention's own sum), not only how many; a goal past its date is said apart
    const gb = goalsBehind(gl, { nba: gl.count ? computeOf("overview/next-best-action", { today }) : null, today }), behind = gb.behind.length, late = gb.pastDue.length;
    // a goal whose turn comes later (Next best action funds it after the cards and the cushion) is not "behind"
    const turnWords = gb.turn ? `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(gb.turn.slice(5, 7)) - 1]} ${gb.turn.slice(0, 4)}` : "";
    const goalsLine = !gl.count ? "none set yet" : [gl.done ? `${gl.done} reached` : null, behind ? `${behind} ${behind === 1 ? "goal" : "goals"} behind${gb.need >= 1 ? ` (${behind === 1 ? "it needs" : "they need"} about ${fmt.money(gb.need, cur)} more a month)` : ""}` : null, gb.queued.length ? (gb.queued.length === gl.count ? `${gl.count === 1 ? "starts" : "they start"} in ${turnWords}, after your earlier steps` : `${gb.queued.length} start${gb.queued.length === 1 ? "s" : ""} in ${turnWords}`) : null, late ? `${late} past ${late === 1 ? "its date" : "their dates"}` : null].filter(Boolean).join("; ") || "all on track";
    // Each tile is a link to its page (design log 2026-09-15, pass 2).
    const tile = (href, label, value, sub) => { const t = ui.stat(label, value, sub, { link: true }); t.append(ui.h("span", { class: "stat-chev", "aria-hidden": "true" }, "\u203a")); return ui.h("a", { href, class: "stat-link" }, t); };
    root.append(ui.card(null, ui.row(
      tile("#/balance/net-worth", "Net worth", fmt.money(nw.netWorth, cur), nw.partlyGuessed ? "Partly our guesses" : nw.change ? `${Math.abs(nw.change.sinceLast) < 0.5 ? "No change" : fmt.signed(nw.change.sinceLast, cur)} since ${fmt.date(nw.change.since)}${savedToday ? ", saved today" : ""}` : savedToday ? "saved today" : "what you own minus what you owe"),
      tile("#/balance/net-worth", "You own", fmt.money(nw.assets, cur), `${fmt.money(nw.liquid, cur)} of it is cash or easy to sell`),
      tile("#/balance/liabilities", "You owe", fmt.money(nw.liabilities, cur), nw.liabilities ? "loans, cards, mortgage" : "nothing on file"),
      tile("#/goals/goals", (gl.count ?? plan.goals?.length ?? 0) === 1 ? "Goal" : "Goals", String(gl.count ?? plan.goals?.length ?? 0), goalsLine),
    )));
    if (gc?.first === "upgrade") root.append(upgradeCard(ctx, gc.upgrade, { reg, today, say, quiet: moveShown }));
  }

  // ---- start here
  // Before the first account: how to start. After it: what to do now (design log 2026-09-15, pass 2).
  const al = d.hasMoney ? computeOf("overview/alerts", { today: fmt.today() }) : null;
  const alN = al?.total ?? 0;
  // only while a step of the plan is still to do (the assumptions look aside): a plan built on its own pages after the
  // first question keeps its "N of 6 done" checklist, not "pick up at question 2" (review 2026-11-02)
  const resume = sc?.state === "started" && (!d.hasMoney || (d.next && d.next.key !== "assumptions")) ? sc : null;
  // with no money in the plan the hero holds the way on (the questions, or the path); the tile here would only repeat it
  // (OV-7, F5). Once the questions are answered the tile lets a person change an answer (x-4).
  const actions = !d.hasMoney ? [
    !setupOn ? { icon: "💰", t: "Add your accounts", d: "Checking, savings, retirement, loans. This is where the numbers start.", go: ["balance", "net-worth"] }
      : sc?.state === "done" ? { icon: "✏️", t: "Change an answer", d: "Your answers to the seven questions, one tap each.", go: ["overview", "setup"] } : null,
    { icon: "💬", t: "Ask a question", d: "Chat with the plan. It runs on your computer and only sees a summary.", go: ["ai", "assistant"] },
    { icon: "📱", t: "Put it on your phone", d: "Open the planner on your phone and add it to your home screen, so it opens like any other app.", go: ["system", "settings"] },
  ] : [
    { icon: "🔔", t: "Needs attention", d: alN ? `${alN} thing${alN === 1 ? "" : "s"} to look at, worst first.` : "Nothing needs your attention right now.", go: ["overview", "alerts"] },
    { icon: "📥", t: "Import a bank file", d: "Three months of transactions keeps the numbers real.", go: ["transactions", "import"] },
    { icon: "💬", t: "Ask a question", d: "Chat with the plan. It runs on your computer and only sees a summary.", go: ["ai", "assistant"] },
  ];
  // The household's view offers only what works: no "Ask a question" while the AI helper does not answer, and no
  // "connect this device to the PC" while there is no PC to connect to (core/view.js, docs/CONVENTIONS.md "View").
  for (let i = actions.length - 1; i >= 0; i--) if (!actions[i]) actions.splice(i, 1);
  if (ctx.view && !ctx.view.build) {
    const keep = actions.filter((a) => !(a.go?.[0] === "ai" && !ctx.live.ai) && !(a.go?.[0] === "system" && a.go?.[1] === "settings" && !ctx.live.pc));
    actions.splice(0, actions.length, ...keep);
  }
  const askOff = (st) => st !== "on";
  const tiles = actions.map((a) => ui.h("a", { href: a.href ?? `#/${a.go.join("/")}`, class: "action" },
    ui.h("span", { class: "ic" }, a.icon), ui.h("span", {}, ui.h("div", { class: "t" }, a.t), ui.h("div", { class: "d" }, a.d))));
  if (tiles.length) root.append(ui.card(d.hasMoney ? "What to do now" : setupOn ? "Also here" : "Start here", ui.h("div", { class: "grid" }, tiles)));
  // the AI helper off or not answering: the tile stays "Ask a question" (design log) and opens the plan's own answers
  const askTile = tiles[actions.findIndex((a) => a.go?.[0] === "ai")];
  const showAsk = (st) => { if (!askTile || !askOff(st)) return; askTile.setAttribute("href", "#/overview/quick"); askTile.querySelector(".d").textContent = st === "off" ? "The AI helper is turned off, so this opens your plan's own answers." : "The AI helper isn't answering right now, so this opens your plan's own answers."; };
  if (askTile) { if (aiSeen.st !== null) showAsk(aiSeen.st); aiAnswers(ctx.ai).then(showAsk); }

  // ---- setup steps (the six basics)
  // Every step row is one tappable link with a chevron (design log 2026-09-15). While a filled button above already says
  // the next thing (the path, the questions, or the next move), this card never adds a second next thing or a second count
  // that says "step" (stress test 2026-11-11: F3, OV-2, OV-7): with nothing in the plan the list shows what a plan holds and
  // marks no row; a plan built by hand keeps its open list (the filled button names the same row); otherwise the list folds
  // to one line. With no filled button above (the questions turned off on this device), the list's own filled "Do step N".
  const next = d.next;
  const nextIdx = next ? d.steps.indexOf(next) : -1;
  const filledAbove = !!shown && shown.kind !== "checklist";
  const stepsList = (markNext = true) => ui.h("ol", { class: "steps" }, d.steps.map((s, i) => {
      const m = modules.get(s.go.join("/"));
      const soon = m && !isReady(m) && ctx.view?.build;   // "coming soon" is build-view talk (core/view.js)
      return ui.h("li", { class: s.done ? "done" : (markNext && s === next ? "next" : "") },
        ui.h("a", { href: `#/${s.go.join("/")}`, class: "step-link" },
          ui.h("span", { class: "num" }, s.done ? "✓" : String(i + 1)),
          ui.h("span", { class: "lbl" }, s.label, soon ? ui.h("span", { class: "pill warn" }, "coming soon") : null),
          ui.h("span", { class: "chev", "aria-hidden": "true" }, "›")));
    }));
  const folded = (title, body) => ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, title), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")), ui.h("div", { class: "fold-body" }, ...body));
  if (resume && shown?.kind !== "questions") {
    // the questions part way through while the filled button goes elsewhere: one quiet way back to the question reached
    if (d.hasMoney) root.append(ui.card(`Set up my plan: question ${resume.q} of ${resume.total}`,
      ui.h("p", { class: "muted" }, `${resume.next ? `Next: ${resume.next}. ` : ""}What you have answered is kept.`),
      ui.h("div", { class: "steps-cta" }, ui.h("a", { href: resume.href, class: moveShown ? "btn secondary" : "btn" }, `Pick up at question ${resume.q}`))));
  } else if (resume) {
    // the filled button above already picks the questions up: nothing to repeat
  } else if (!next || d.setupFinished) {
    // All done, or "Set up my plan" finished: one folded line (design log 2026-09-15, pass 2). A step still open (the
    // assumptions) stays inside and on Needs attention.
    // "done ✓" only when every step is done; finished Set up my plan with only the assumptions look left (it lives in Needs
    // attention too): done, not "5 of 6"
    root.append(folded(!next ? `Set up your plan: all ${d.total} steps done \u2713` : d.setupFinished && next.key === "assumptions" && d.doneCount === d.total - 1 ? "Set up my plan: done \u2713" : `What's in your plan: ${d.doneCount} of ${d.total} basics`,
      [stepsList(), d.setupFinished && setupOn && d.hasMoney ? ui.h("div", { class: "steps-cta" }, ui.h("a", { href: "#/overview/setup", class: "btn secondary" }, "Change an answer")) : null]));
  } else if (filledAbove && d.doneCount === 0) {
    // nothing in the plan yet: what a plan holds; the hero's "Set up my plan" fills the first five in one go
    root.append(ui.card("What your plan will hold", stepsList(false)));
  } else if (filledAbove && shown.kind === "basics") {
    // built by hand: the list stays open, the filled button above names its next row
    root.append(ui.card(`What's in your plan: ${d.doneCount} of ${d.total} basics`, stepsList()));
  } else if (filledAbove) {
    root.append(folded(`What's in your plan: ${d.doneCount} of ${d.total} basics`, [stepsList(false)]));
  } else {
    root.append(ui.card(`Set up your plan: ${d.doneCount} of ${d.total} done`, stepsList(),
      ui.h("div", { class: "steps-cta" }, ui.h("a", { href: `#/${next.go.join("/")}`, class: "btn" }, `Do step ${nextIdx + 1}: ${SHORT_LABEL[next.key] ?? next.label}`))));
  }

  // ---- what is coming (build view only: the household's view has no build progress; design log 2026-11-06)
  if (!ctx.view || ctx.view.build) {
  const byPhase = new Map(PHASES.map((p) => [p.n, { ready: 0, total: 0 }]));
  for (const m of all) { const b = byPhase.get(Number(m.phase ?? 10)) ?? byPhase.get(10); b.total++; if (isReady(m)) b.ready++; }
  const nowPhase = PHASES.find((p) => { const b = byPhase.get(p.n); return b.total > b.ready; })?.n;
  const bar = ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.max(2, Math.round(100 * readyN / all.length))}%` } }));
  root.append(ui.card("What is coming",
    ui.h("p", { class: "muted small" }, "The app is being built in phases. Tap a phase to see its pages."),
    bar,
    ui.h("div", { class: "small muted", style: { marginBottom: "10px" } }, `${readyN} of ${all.length} pages are ready to use. The rest are marked "soon" and you can leave notes on them.`),
    ui.h("div", {}, PHASES.map((p) => {
      const b = byPhase.get(p.n);
      const done = b.total > 0 && b.ready === b.total;
      return ui.h("a", { href: `#/overview/pages/phase-${p.n}`, class: `phase${done ? " done" : ""}${p.n === nowPhase ? " now" : ""}`, style: { color: "inherit", textDecoration: "none" } },
        ui.h("span", { class: "num" }, done ? "✓" : String(p.n)),
        ui.h("span", {}, ui.h("div", { class: "t" }, p.title), ui.h("div", { class: "d" }, p.blurb)),
        ui.h("span", { class: "n" }, b.total ? `${b.ready}/${b.total}` : ""));
    })),
    ui.row(ui.h("a", { href: "#/overview/pages", class: "btn secondary" }, "Browse all pages"), d.noteCount ? ui.h("span", { class: "muted small", style: { alignSelf: "center" } }, `You have left notes on ${d.noteCount} page${d.noteCount === 1 ? "" : "s"}.`) : null),
  ));
  }
}
