// modules/scenarios/goal-seek/view.js -- DOM only. Set the goal (the money lasts, leaving at least so
// much), then every lever solved for it on its own: spending, retirement age, saving, the return
// needed (a grey line, not a card), a lump sum or the room today, the Social Security claiming age. Runs on the PC when connected.
import { legacyTarget } from "../../estate/legacy/compute.js";
import { whenCareful, carefulKey, knownAnswer, monthlyOf, RULE_WORDS } from "../../retirement/careful.js";
import { RETIRE_HOW, shownValue, roundUp, roundDown, BAD_LUCK, RETURN_FORECAST, firstLevers, agesFor, agesWords, ageLine } from "./compute.js";
import { needItem } from "../../../core/words.js";
import { part, parts } from "../../../core/ui/more.js";

let legacy = null;   // what the plan should leave; a view choice on this device, starting from Legacy goals' amount
let scale = 1;       // 1 = the spending as planned; BAD_LUCK (1.15) = room for bad luck: every answer is worked out for 15% more spending
let readRoute = null; // the route object whose ?target=last was already read: the shell redraws with the same object, so a chip chosen since stays
// the parts with boxes or rows the person opened (docs/OPTIONAL.md 3.11): kept for this visit while the page draws itself again after
// a chip or an amount, so nothing closes under the thumb (R17), shut again on a new visit; never the plan's (opening or closing changes
// nothing). "N more changes", "N more ages" and "How this is worked out" are reading parts: core/ui/more.js keeps the person's tap.
let visit = null;       // the route object of this visit (the shell draws again with the same one after a sync)
let optsOpen = false;   // the goal's "Set my own numbers" (room for bad luck, your own amount)
let agesOpen = false;   // the Social Security card's "See each age"
/** The goal chips' amounts ("Just last" is 0): an amount not among them is the person's own, typed in "More options". */
const GOAL_CHIPS = [0, 250000, 500000, 1000000];
/** A folded card in a few words, for the fold's line ("2 more changes: retiring, Social Security"). */
const SHORT = { spending: "spending", retire: "retiring", saving: "saving", lump: "savings today", claim: "Social Security" };

const STYLE = `
.gs-root .gs-lever { display: flex; flex-direction: column; gap: 6px; }
.gs-root .gs-top { display: flex; align-items: center; gap: 6px 10px; flex-wrap: wrap; }
.gs-root .gs-ic { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; background: var(--panel-2); font-size: 18px; }
.gs-root .gs-t { flex: 1 1 8.5em; font-weight: 650; min-width: 0; }
.gs-root .gs-v { font-size: var(--fs-xl); font-weight: 750; letter-spacing: -.01em; line-height: 1.15; }
.gs-root .gs-u { font-size: var(--fs-sm); font-weight: 500; color: var(--text-2); margin-left: 4px; }
.gs-root .gs-s { color: var(--text-2); font-size: var(--fs-sm); }
.gs-root .gs-goal { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.gs-root .gs-goal .field { flex: 1 1 180px; }
.gs-root .gs-claims { display: grid; grid-template-columns: repeat(9, 1fr); gap: 3px; align-items: end; height: 70px; margin-top: 6px; }
.gs-root .gs-claims span { background: var(--accent-soft); border-radius: 4px 4px 0 0; position: relative; }
.gs-root .gs-claims span.best { background: var(--accent); }
.gs-root .gs-ages { display: grid; grid-template-columns: repeat(9, 1fr); gap: 3px; font-size: var(--fs-xs); color: var(--muted); text-align: center; }
.gs-root .gs-ages small { display: block; white-space: nowrap; font-size: inherit; }
.gs-root .gs-info { margin: 16px 0 0; }
.gs-root .gs-more { margin-top: 12px; }
.gs-root .gs-opts { margin-top: 8px; border-top: 1px solid var(--line); }
.gs-root .gs-rest { margin-top: 12px; border-top: 1px solid var(--line); }
.gs-root .gs-each > summary { min-height: 44px; }
.gs-root .gs-each .fold-title { font-weight: 500; font-size: var(--fs-sm); color: var(--text-2); }
.gs-root .gs-agelist { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
`;
/** What each lever's button says: where the change is made (the page's own title follows when a lever is not listed). The return
 * it needs has no card and no button (owner's request 2026-11-11, L1): it is the grey line under the cards. */
const GO_WORDS = { spending: "Change spending on Will the money last?", retire: "Change the age on People", saving: "Retirement contributions", lump: "Net worth", claim: "Social Security" };
// the claiming card on a short plan is "needs a change" or "not on its own", as the others (fix round 1, 2026-11-12, P1: "helps" said
// nothing of what the change does); never "room to spare" while the plan falls short
const PILL = { room: ["ok", "room to spare"], same: ["", "just right"], needs: ["warn", "needs a change"], cannot: ["bad", "not on its own"] };

/** 69.4166... -> "69 and 5 months"; a whole age as it is. */
const ageWords = (a) => { const y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); return m ? `${y} and ${m} month${m === 1 ? "" : "s"}` : String(y); };

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  if (legacy === null) legacy = legacyTarget(plan).target;
  if (ctx.route !== visit) { visit = ctx.route; optsOpen = false; agesOpen = false; }   // a new visit: the parts with boxes shut again
  // opened from the Plan health score's hint (#/scenarios/goal-seek?target=last): the money lasting, leaving nothing, the
  // target its figures were worked out for (round 8 review, 2026-11-06), whatever Legacy goals holds
  // read once, then taken out of the address (round 8 batch 4 follow-up, 2026-11-07): a redraw after a sync must not undo the chip
  // chosen since
  // ?target=badluck is the same with "Room for bad luck" on (the score's 115% hint, which is worked out the same way); other keys in
  // the address (guide, step) stay when the target is taken out
  const target = ctx.route?.query?.target;
  if ((target === "last" || target === "badluck") && ctx.route !== readRoute) {
    readRoute = ctx.route; legacy = 0; scale = target === "badluck" ? BAD_LUCK : 1;
    const rest = Object.entries(ctx.route.query).filter(([k]) => k !== "target").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    try { history.replaceState(history.state, "", `${location.pathname}${location.search}#/${ctx.route.group ?? "scenarios"}/${ctx.route.id ?? "goal-seek"}${rest ? `?${rest}` : ""}`); } catch { /* no address bar to tidy (a test, a file) */ }
  }
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const moneyUp = (n) => fmt.money(roundUp(n), cur), moneyDown = (n) => fmt.money(roundDown(n), cur);
  const root = ui.h("div", { class: "gs-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const host = ui.h("div");
  root.append(host);
  const load = () => {
    host.replaceChildren(ui.notice("info", "Working out each change for your goal..."));
    ctx.computeRemote("scenarios/goal-seek", { today: fmt.today(), legacy, ...(scale !== 1 ? { spendingScale: scale } : {}) }).then(draw, (e) => host.replaceChildren(ui.notice("error", `Goal seek could not run: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));
  };
  const draw = (d) => {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Goal seek"),
        ui.h("p", { class: "lede" }, "Set the goal (the money lasts, and leaves what you want to leave) and see what each change would have to be: what you can spend, when you can retire, what to save, when to claim Social Security. It needs the basics of your plan first:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, needItem(m)))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    // under "Room for bad luck" the result is for 15% more spending than the plan: the hero says so, never "as it stands" (verify
    // 2026-11-07: a family whose money lasts read "As it stands the money runs out in 2082" with the chip on)
    const stands = (d.scale ?? 1) !== 1 ? `With ${Math.round((d.scale - 1) * 100)}% more spending than you plan, the money` : "As it stands the money";
    // "Your plan works, with room to spare" over a spending card that turned "tight" a second later (stress test 2026-11-11, W5):
    // while the bad-run figure for the spending is worked out the headline says it is being checked and the pill says "checking";
    // below the plan's spending the headline is "Your plan works if markets are average" (an answer already worked out: at once)
    const spendLever = d.levers.find((l) => l.id === "spending" && l.status !== "cannot");
    const turns = d.meets && !d.noSavings && !!spendLever;
    const known = turns ? knownAnswer(carefulKey(ctx, { legacy: d.legacy })) : null;
    const meetsHead = (tight) => (tight ? "Your plan works if markets are average" : "Your plan works, with room to spare");
    const heroH1 = !turns ? ui.h("h1", {}, d.meets ? meetsHead(false) : "What it would take")
      : known === undefined ? ui.h("h1", { "aria-busy": "true", style: { minHeight: "2.5em", color: "var(--muted)" } }, "Checking your plan against bad years...")
      : ui.h("h1", {}, meetsHead(tightOf(known, d)));
    const answered = (c) => { if (!turns) return; heroH1.textContent = meetsHead(tightOf(c, d)); heroH1.removeAttribute("aria-busy"); heroH1.style.color = ""; };   // the held two lines stay (nothing below moves)
    host.append(ui.h("section", { class: "card accent hero" },
      heroH1,
      // no retirement savings on file: never "the money runs out in 2065" (the Will the money last? page says "we don't know yet")
      // told rather than untold (fix round 1, 2026-11-12, B4): an empty 401(k) on file, or "None" in Get started
      d.noSavings ? ui.h("p", { class: "lede" }, d.nothingSaved ? "Nothing is saved for retirement yet, and nothing goes in, so we can't say what it would take yet. That is common; once something is saved or goes in each paycheck, add it and come back." : "You haven't told us about retirement savings, so we can't say what it would take yet. Add what you own first; if you have no retirement savings yet, that is common, and you can come back later.") : ui.h("p", { class: "lede" }, d.meets
        ? `${stands} lasts and leaves about ${money(Math.round(d.endReal / 1000) * 1000)} (today's dollars)${d.legacy ? `, more than the ${money(d.legacy)} you want to leave` : ""}. Below: how far each change could go and still get there.`
        : d.success ? `${stands} lasts but leaves about ${money(Math.round(d.endReal / 1000) * 1000)}, short of the ${money(d.legacy)} you want to leave. Below: what each change would have to be.` : `${stands} runs out in ${d.failYear}. Below: what each change would have to be for it to last${d.legacy ? ` and leave ${money(d.legacy)}` : ""}.`),
      d.noSavings ? ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add what you own ›")) : null));
    // no retirement savings on file: no exact answers under "we can't say" (stress test 2026-11-11, F4: "$60,930 short" one line
    // below it); the hero is the page until there is a forecast to improve
    if (d.noSavings) return;

    // the goal
    // any amount, with or without commas (stress test 2026-11-11, RC-4, W6: whole thousands only, refused in the browser's own words)
    const { box: boxWrap, input: box } = ui.moneyBox({ name: "legacy", value: legacy || null, min: 0, placeholder: "0", label: "Leave at least" });
    const boxSaid = ui.h("div");
    // simple first (owner, 2026-11-12 and 2026-11-13; fix round 2): the four goal chips; room for bad luck and an amount of your own
    // are one quiet tap away in "Set my own numbers" (docs/OPTIONAL.md, kind own; "More options" until gap #21), whose status says
    // when either is in use ("1 set by you"), so nothing of the person's is hidden silently
    const own = legacy > 0 && !GOAL_CHIPS.includes(legacy);
    const setByYou = (scale === BAD_LUCK ? 1 : 0) + (own ? 1 : 0);
    const opts = part(ctx, { id: "goal", kind: "own", set: setByYou, says: setByYou ? "" : "bad luck, own amount", holds: ["legacy"], open: optsOpen || undefined, body: [
      // room for bad luck: every answer below worked out for spending 15% above the plan (compute's spendingScale)
      ui.h("div", { class: "chips", role: "group", "aria-label": "Room for bad luck" }, ui.h("button", { type: "button", class: `chip${scale === BAD_LUCK ? " on" : ""}`, "aria-pressed": scale === BAD_LUCK ? "true" : "false", onClick: () => { scale = scale === BAD_LUCK ? 1 : BAD_LUCK; optsOpen = true; load(); } }, "Room for bad luck")),
      // the two amounts it compares (gap #21: a part holds at least two figures, docs/OPTIONAL.md R14)
      ui.h("p", { class: "muted small" }, `Plans for spending ${Math.round((BAD_LUCK - 1) * 100)}% more than you expect (${money((d.spendingMonthly / (d.scale ?? 1)) * BAD_LUCK)} a month instead of ${money(d.spendingMonthly / (d.scale ?? 1))}), in case markets or prices turn out worse.`, d.scale === BAD_LUCK ? ` Every figure below is worked out as if you spent ${Math.round((BAD_LUCK - 1) * 100)}% more than the ${money(d.spendingMonthly / d.scale)} a month your plan has.` : ""),
      ui.h("form", { class: "gs-goal", noValidate: true, onSubmit: (e) => {
        e.preventDefault();
        const v = ui.moneyValue(box);
        // an error opens the part (it is open: the box is in it) and stays there, under the box
        if (box.value.trim() && (v === null || v < 0)) { box.setAttribute("aria-invalid", "true"); opts.open = true; optsOpen = true; boxSaid.replaceChildren(ui.notice("error", "Type an amount in dollars, like 150,000, or 0 to just last.")); return; }
        legacy = Math.max(0, v ?? 0); optsOpen = true; load();
      } }, ui.field("Or leave at least", boxWrap), ui.h("button", { type: "submit", class: "secondary" }, "Use this")), boxSaid] });
    opts.addEventListener?.("toggle", () => { optsOpen = !!opts.open; });
    host.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "The goal"),
      ui.h("p", { class: "muted small" }, "Most people choose \"Just last\": the money simply lasts. Pick an amount to leave something behind (in today's dollars)."),
      ui.h("div", { class: "chips", role: "group", "aria-label": "Leave at least" }, GOAL_CHIPS.map((v) => ui.h("button", { type: "button", class: `chip${legacy === v ? " on" : ""}`, "aria-pressed": legacy === v ? "true" : "false", onClick: () => { legacy = v; load(); } }, v ? `Leave ${money(v)}` : "Just last"))),
      ui.h("div", { class: "folds gs-opts" }, opts)));

    // the levers
    // an age in years and months is "now" only when compute says it is now for everyone it moves (nowForAll)
    // what must be reached rounds up and a limit rounds down, so doing what the page says always works (shownValue)
    const val = (l) => l.value === null || l.value === undefined ? "-" : l.unit === "month" ? money(shownValue(l, d.scale)) : l.unit === "once" ? money(shownValue(l)) : l.unit === "rate" ? `${(Math.round(shownValue(l) * 1000) / 10).toFixed(1)}%` : Number.isInteger(l.value) ? `age ${l.value}` : l.nowForAll && l.value === l.nowAge ? "now" : `age ${ageWords(l.value)}`;
    const unit = (l) => (l.unit === "month" ? "a month" : l.unit === "rate" ? "a year" : "");
    // the return it needs is information, not a change you can make (owner's request 2026-11-11, L1): one grey line under the
    // cards, with the forecasts it is measured against, and no button
    // simple first (owner, 2026-11-12 and 2026-11-13; fix round 2): three cards, chosen by firstLevers (what is worth money and what
    // gets there on its own first), the rest one quiet tap away under "N more changes"
    const { shown, more } = firstLevers(d.levers);
    const infoLines = d.levers.filter((l) => l.info && (l.line || l.sentence));
    const card = (l) => {
      const [tone, label] = PILL[l.status];
      // "room to spare" can still turn "tight" once the bad-run figure is in: a grey "checking" until it is
      const checking = l.id === "spending" && turns && tone === "ok" && known === undefined;
      let pillEl = null;
      return ui.h("div", { class: "card flat gs-lever", style: { margin: "0" } },
        ui.h("div", { class: "gs-top" }, ui.h("span", { class: "gs-ic", "aria-hidden": "true" }, l.icon), ui.h("span", { class: "gs-t" }, l.title), pillEl = checking ? ui.h("span", { class: "pill", "data-was": label }, "checking") : ui.h("span", { class: `pill ${known !== undefined && turns && tone === "ok" && l.id === "spending" && tightOf(known, d) ? "warn" : tone}` }, known !== undefined && turns && tone === "ok" && l.id === "spending" && tightOf(known, d) ? "tight" : label)),
        l.status === "cannot" ? null : ui.h("div", { class: "gs-v" }, val(l), unit(l) ? ui.h("span", { class: "gs-u" }, unit(l)) : null),
        l.id === "spending" && l.status !== "cannot" ? carefulLine(ctx, d.legacy, money, moneyUp, moneyDown, d.spendingMonthly / d.scale, d.scale, pillEl, answered) : null,
        ui.h("div", { class: "gs-s" }, l.sentence),
        // the spending at each claiming age: one quiet tap away (the sentence above names the age that spends the most); a part of
        // kind item, the card's own row, so it may sit inside "N more changes" (docs/OPTIONAL.md R11)
        l.id === "claim" && l.results?.length ? (() => {
          const each = part(ctx, { id: "claim-ages", kind: "item", title: "See each age", open: agesOpen || undefined, body: claimBars(ui, l, moneyDown, d.scale) });
          each.classList?.add("gs-each");
          each.addEventListener?.("toggle", () => { agesOpen = !!each.open; });
          return ui.h("div", { class: "folds" }, each);
        })() : null,
        // the button names the page it opens (stress test 2026-11-11, RC-10: six buttons all called "Open the page")
        ui.h("div", {}, ui.h("a", { class: "btn secondary small", href: `#/${l.go[0]}/${l.go[1]}` }, `${GO_WORDS[l.id] ?? ctx.modules?.get?.(l.go.join("/"))?.title ?? "Open the page"} ›`)));
    };
    host.append(ui.h("section", { class: "card" }, ui.h("h2", {}, d.meets ? "How far each change could go" : "What each change would have to be"),
      ui.h("p", { class: "muted small" }, "Each answer changes just that one thing and keeps everything else as your plan has it. Move two at once and each needs to move less."),
      ui.h("div", { class: "grid" }, shown.map(card)),
      // "N more changes" (kind more): its status names what is inside when that fits in 20 characters ("retiring, saving")
      more.length ? ui.h("div", { class: "folds gs-rest" }, part(ctx, { id: "changes", kind: "more", n: more.length, noun: "changes", one: "change",
        says: (() => { const s = more.map((l) => SHORT[l.id] ?? l.title).join(", "); return s.length <= 20 ? s : ""; })(),
        body: ui.h("div", { class: "grid" }, more.map(card)) })) : null,
      ...infoLines.map((l) => ui.h("p", { class: "muted small gs-info", "data-lever": l.id }, l.line ?? l.sentence)),
      // the way on to which numbers matter most (fix round 1, 2026-11-12, P7: no path from here); outlined, never a filled button
      ui.h("div", { class: "gs-more" }, ui.h("a", { class: "btn secondary small", href: "#/scenarios/sensitivity" }, "What matters most? ›"))));
    // the page's parts, one card (docs/OPTIONAL.md R12): a row for each retirement age (gap #21: lazy, worked out when opened, on the
    // computer when it is connected), then how it is worked out
    const retireLever = d.levers.find((l) => l.id === "retire");
    const span = retireLever ? agesFor(plan, { today: fmt.today(), lever: retireLever }) : null;
    host.append(parts(ctx,
      span && { id: "ages", kind: "more", n: span.n, noun: "ages", one: "age", says: span.from === span.to ? `retiring at ${span.from}` : `retiring at ${span.from} to ${span.to}`,
        lazy: true, body: () => agesBody(ctx, span, d) },
      { id: "how", kind: "how", body: ui.h("ul", {},
        // the spending and age levers spend the same every year; named once when the plan has another rule (recheck 2026-11-05),
        // here since fix round 2 (simple first: it sat under the cards' heading)
        d.strategy && d.strategy !== "fixed-real" ? ui.h("li", {}, `What you can spend and when you can retire are worked out spending the same every year; your plan uses another rule, ${RULE_WORDS[d.strategy] ?? "its own"}, so what you spend moves with markets (`, ui.h("a", { href: "#/retirement/withdrawal-strategy" }, "How much to take out"), ").") : null,
        ui.h("li", {}, "Every change is run through your plan's own year-by-year engine (the one on the Will the money last? page) at your expected returns, searching for the value where the money lasts to the end and leaves the amount you set."),
        ui.h("li", {}, `Spending: the most a month, steady, in today's dollars. ${RETIRE_HOW} Saving: more or less going into the accounts you already save into, until retirement. Room today: what could come out of savings now; short today: what would have to go in. Social Security: everyone who has not claimed yet claiming at the same age, from today's age (62 at the earliest) to 70, and the one that leaves the most to spend; whoever already gets it stays as they are.`),
        // where the grey line's forecasts come from (owner's request 2026-11-11, L1)
        // the grey line is short (owner, 2026-11-12: simple first, the detail one tap away); what the plan's own figure is made of and
        // whose its parts are (the lever's `more`), and the forecasts' source and date, are here
        ui.h("li", {}, `The growth line under the changes: stocks and bonds both moved up or down by the same amount until the money just gets there, then the two put together on the plan's mix (its average share in stocks before and after retiring). It is there to compare, not to choose.${infoLines.map((l) => (l.more ? ` ${l.more}` : "")).join("")} The forecasts are ${RETURN_FORECAST.who}'s for the next 10 years, a year before inflation (as of ${RETURN_FORECAST.asOfWords}): U.S. stocks ${(RETURN_FORECAST.low * 100).toFixed(1)}% to ${(RETURN_FORECAST.high * 100).toFixed(1)}%, U.S. bonds ${(RETURN_FORECAST.bonds.low * 100).toFixed(1)}% to ${(RETURN_FORECAST.bonds.high * 100).toFixed(1)}%, put together on the same mix.`),
        ui.h("li", {}, "Real life is less smooth than expected returns: these answers are markets doing exactly as well as average every year, about a 4 in 10 chance. The careful figures (spending here, the age on Financial independence) and the Stress tests and Chance the money lasts pages show how much room to keep."),
      ) }));
  };
  load();
}

/**
 * The body of "N more ages" (gap #21), built when the part is first opened (and when the page prints): the words that say what each
 * line is, then one line per age, worked out on the computer when it is connected (compute's `ages: true`), with the goal and
 * room for bad luck the cards above were worked out for. The card's own age is in bold.
 */
function agesBody(ctx, span, d) {
  const { ui, fmt } = ctx, h = ui.h;
  const cur = ctx.plan.meta?.currency ?? "USD";
  const scale = d.scale ?? 1;
  const list = h("div", { "aria-busy": "true" }, h("p", { class: "muted small", style: { margin: "0" } }, "Working out each age..."));
  ctx.computeRemote("scenarios/goal-seek", { today: fmt.today(), legacy: d.legacy, ...(scale !== 1 ? { spendingScale: scale } : {}), only: [], ages: true }).then((r) => {
    const a = r?.ages;
    list.removeAttribute?.("aria-busy");
    if (!a?.rows?.length) { list.replaceChildren(h("p", { class: "muted small", style: { margin: "0" } }, "Each age could not be worked out for this plan.")); return; }
    list.replaceChildren(h("ul", { class: "gs-agelist" }, a.rows.map((row) => {
      // "could spend $7,090 a month" kept on one line (at 390 px "a month" fell alone onto a second line)
      const line = ageLine(row, { planned: a.planned, legacy: d.legacy, cur }).replace(/ · (could spend .*)$/, (m, tail) => ` · ${tail.replace(/ /g, "\u00a0")}`);
      return h("li", { dataset: { age: String(row.age) } }, row.age === a.answer ? h("strong", {}, line) : line);
    })));
  }, (e) => { list.removeAttribute?.("aria-busy"); list.replaceChildren(h("p", { class: "muted small", style: { margin: "0" } }, `Each age could not be worked out: ${e}. Reload the page to try again.`)); });
  return [...agesWords(span, { legacy: d.legacy, scale, cur }).map((s) => h("p", { class: "small", style: { margin: "0" } }, s)), list];
}

/** "In 9 of 10 markets: about $7,500 a month": drawn with "..." first (the same line, so nothing moves), filled after the first
 * paint with Monte Carlo's careful figure for the same goal (careful.js); gone when nothing lasts in 9 of 10 markets. Below the
 * plan's own spending it says by how much, and a green "room to spare" over it turns amber (review 2026-11-05: the pill read
 * "room to spare" right above a careful figure lower than the plan spends). */
/** Whether the bad-run spending `c` (careful.js) is under what the plan spends: the same test carefulLine's "less" makes. */
function tightOf(c, d) {
  if (!c || !(c.yearly >= 1200)) return false;
  const scale = d.scale ?? 1, planned = d.spendingMonthly / scale;
  return planned - monthlyOf(c.yearly) / scale >= 5;
}

function carefulLine(ctx, legacy, money, moneyUp, moneyDown, planned, scale, pill, answered = () => {}) {
  const { ui } = ctx;
  const words = (v, less = 0) => [ui.h("strong", {}, "Even in a bad run of years:"), ` about ${v} a month${legacy ? `, leaving ${money(legacy)}` : ""}${less > 0 ? `, ${moneyUp(less)} less than the ${money(planned)} the plan spends` : ""}`];
  const el = ui.h("div", { class: "gs-s", "aria-live": "polite" }, ...words("..."));
  whenCareful(ctx, el, (c) => {
    answered(c);
    // a pill that waited ("checking") goes back to what it was before it can turn
    if (pill?.dataset.was) { pill.className = "pill ok"; pill.textContent = pill.dataset.was; delete pill.dataset.was; }
    if (!c || !(c.yearly >= 1200)) { el.remove(); return; }
    const m = monthlyOf(c.yearly) / scale;   // in the plan's terms, as the answer above (room for bad luck: the most to plan)
    const less = planned - m >= 5 ? planned - m : 0;   // a limit rounds down, how much less than the plan rounds up
    el.replaceChildren(...words(scale === 1 ? money(m) : moneyDown(m), less));
    if (less > 0 && pill?.classList.contains("ok")) { pill.className = "pill warn"; pill.textContent = "tight"; }
  }, { legacy });
  return el;
}

function claimBars(ui, l, money, scale = 1) {
  const max = Math.max(...l.results.map((r) => r.monthly), 1);
  return ui.h("div", { "aria-label": "What the plan can spend a month by claiming age" },
    // today's age is claimable in years and months (69 and 5 months): "now" on the bar, never 69.4166... (review 2026-11-02);
    // "now" only when it is now for everyone moved, else the age and its months on two short lines (review 2026-11-02, round 5)
    ui.h("div", { class: "gs-claims" }, l.results.map((r) => ui.h("span", { class: r.age === l.value ? "best" : null, title: `${ageWords(r.age)}: ${money(r.monthly / scale)} a month`, style: { height: `${Math.max(4, Math.round((r.monthly / max) * 100))}%` } }))),
    ui.h("div", { class: "gs-ages" }, l.results.map((r) => {
      if (Number.isInteger(r.age)) return ui.h("span", {}, String(r.age));
      if (l.nowForAll && r.age === l.nowAge) return ui.h("span", {}, "now");
      const y = Math.floor(r.age + 1e-9), m = Math.round((r.age - y) * 12);
      return ui.h("span", { "aria-label": ageWords(r.age) }, String(y), ui.h("small", {}, ` and ${m} month${m === 1 ? "" : "s"}`));
    })),
    // the first and the last age in words and dollars (gap #21: the bars' figures were only in their tooltips, which a phone never
    // shows; a part holds at least two figures, docs/OPTIONAL.md R14)
    l.results.length > 1 ? ui.h("p", { class: "muted small", style: { margin: "6px 0 0" } }, `About ${money(l.results[0].monthly / scale)} a month claiming ${l.nowForAll && l.results[0].age === l.nowAge ? "now" : `at ${ageWords(l.results[0].age)}`}, about ${money(l.results.at(-1).monthly / scale)} at ${ageWords(l.results.at(-1).age)}.`) : null);
}
