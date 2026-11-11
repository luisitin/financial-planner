// modules/overview/plan/view.js -- DOM only. "Your plan": the end of the path. Head (what state the plan is in, one filled
// button), the answers in three groups (each row one sentence, the whole row a link), what to do next, our guesses, what we're
// counting on (folded), the monthly check-in, and the end. Everything comes from compute.js, which quotes the result pages.
import { setupCard } from "../start/compute.js";
import { firstStep } from "../dashboard/compute.js";
import { compute, GUESSES_SHOWN, VALUE_MAX } from "./compute.js";
import { applyGuesses } from "../setup/compute.js";
import { startGuide, PATH_ID } from "../guide/compute.js";
import { offKeys, usable, change } from "../guide/act.js";
import { MONTH_NAMES } from "./words.js";

let pending = null;   // a green line for the top of the next render (the shell re-renders after every save)

const STYLE = `
.pl-root { max-width: 640px; margin: 0 auto; }
.pl-root h1 { text-wrap: balance; margin: 4px 0 8px; }
.pl-root h1:focus { outline: none; }
.pl-root h2.pl-h { font-size: var(--fs-md); margin: 24px 0 4px; }
.pl-root .pl-help { color: var(--text-2); margin: 0 0 8px; line-height: 1.45; }
.pl-root .pl-lede { color: var(--text); margin: 0 0 12px; line-height: 1.45; text-wrap: pretty; }
.pl-root .pl-short { margin: 0 0 12px; font-weight: 600; line-height: 1.45; text-wrap: pretty; }
.pl-root .pl-small { color: var(--text-2); font-size: var(--fs-sm); margin: 8px 0 0; }
.pl-root .pl-check { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--ok-soft); color: var(--ok); border: 1px solid var(--ok); font-weight: 700; margin-bottom: 8px; }
.pl-root .pl-bar { height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; margin: 4px 0 12px; }
.pl-root .pl-bar > span { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
.pl-root .btn.pl-go { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 52px; text-align: center; font-size: var(--fs-md); }
.pl-root .pl-rows { list-style: none; margin: 0; padding: 0; }
.pl-root .pl-rows li + li a { border-top: 1px solid var(--line); }
.pl-root .pl-rows a { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 2px; color: var(--text); text-decoration: none; }
.pl-root .pl-rows a:hover .pl-k { color: var(--accent-ink); }
.pl-root .pl-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--text-2); }
.pl-root .pl-dot.ok { background: var(--ok); } .pl-root .pl-dot.warn { background: var(--warn); } .pl-root .pl-dot.bad { background: var(--bad); }
.pl-root .pl-k { flex: 1; min-width: 0; font-weight: 600; line-height: 1.3; }
.pl-root .pl-s { display: block; font-weight: 400; font-size: var(--fs-sm); color: var(--text-2); margin-top: 2px; line-height: 1.4; }
.pl-root .pl-n { display: block; font-weight: 400; font-size: var(--fs-sm); color: var(--text-2); margin-top: 2px; font-style: italic; }
.pl-root .pl-v { flex: none; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; max-width: 40%; }
.pl-root .pl-v.open { font-weight: 600; color: var(--text-2); }
.pl-root .pl-chev { flex: none; color: var(--text-2); font-size: 20px; line-height: 1; }
.pl-root ol.pl-moves { list-style: none; margin: 0; padding: 0; }
.pl-root ol.pl-moves li + li a { border-top: 1px solid var(--line); }
.pl-root ol.pl-moves a { display: flex; gap: 12px; align-items: center; min-height: 56px; padding: 8px 2px; color: var(--text); text-decoration: none; }
.pl-root .pl-num { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-ink); font-weight: 700; font-size: var(--fs-sm); }
.pl-root .pl-link { display: flex; align-items: center; min-height: 44px; font-weight: 600; }
.pl-root .pl-lines { list-style: none; margin: 8px 0 12px; padding: 0; display: grid; gap: 10px; }
.pl-root .pl-lines li b { display: block; font-weight: 600; }
.pl-root .pl-lines li span { display: block; color: var(--text-2); font-size: var(--fs-sm); }
.pl-root .pl-btns { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.pl-root .pl-btns .btn, .pl-root .pl-btns button { min-height: 44px; }
.pl-root .pl-end { margin-top: 24px; }
.pl-root .pl-end p { margin: 0 0 12px; line-height: 1.45; }
.pl-root .pl-end .btn { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 52px; font-size: var(--fs-md); }
@media (min-width: 720px) { .pl-root .btn.pl-go, .pl-root .pl-end .btn { width: auto; display: inline-flex; padding: 0 22px; } }
`;

const pc = (x) => `${Math.round(Number(x) * 1000) / 10}%`;
const dateWords = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "")); return m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : ""; };

export function render(root, ctx) {
  const { ui, fmt } = ctx;
  const today = fmt.today();
  const d = compute(ctx.plan, { today, off: offKeys(ctx) });
  const h = d.head;
  const wrap = ui.h("div", { class: "pl-root" }, ui.h("style", {}, STYLE));
  root.append(wrap);
  if (pending) { const n = ui.notice("ok", pending); n.setAttribute("role", "status"); ctx.announce?.(pending); wrap.append(n); pending = null; }
  const follow = () => change(ctx, (q) => startGuide(q, PATH_ID, today));
  const filled = (href, label, onClick) => ui.h("a", { class: "btn pl-go", href, onClick }, label);

  // ---- head
  const head = ui.h("section", { class: "card", "aria-labelledby": "pl-h" });
  const title = (t) => ui.h("h1", { id: "pl-h", tabindex: "-1" }, t);
  const put = (el, ...xs) => el.append(...xs.filter(Boolean));   // (Element.append turns a null into the text "null")
  let headBtn = false;
  if (h.state === "empty") {
    put(head, title("Your plan"),
      ui.h("p", { class: "pl-lede" }, "It starts with a few easy questions, then a quick look at each step. About 20 minutes in all; stop any time."),
      filled("#/overview/setup/you", "Let's go"));
    headBtn = true;
  } else if (h.state === "going") {
    // part way through the questions: the questions' own count, as on the Dashboard and Get started (stress test retest)
    let sc = null; try { sc = h.next?.key === "answers" ? setupCard(ctx.plan, { today }) : null; } catch { sc = null; }
    const inQuestions = sc?.state === "started";
    // a plan built on the pages, the questions never opened: the first missing basic, as the Dashboard says it (review N5)
    let basics = null; try { basics = h.next?.key === "answers" && !inQuestions ? firstStep(ctx.plan) : null; } catch { basics = null; }
    if (basics?.kind !== "basics" && basics?.kind !== "start") basics = null;
    put(head, title("Your plan so far"),
      // the same count as the Dashboard and Get started: the step you are on, not how many count as done by your figures
      // (stress test 2026-11-11: "step 2 of 7" there and "done 3 of 7" here; j-first-retiree/x-3)
      ui.h("p", { class: "pl-lede" }, `${inQuestions ? `You're part way through the questions: question ${sc.q} of ${sc.total} is next.` : h.step ? `You're on step ${h.step} of ${h.total}.` : `${h.total} steps.`} Everything below is worked out already; the next steps go through it with you.`),
      ui.h("div", { class: "pl-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(h.total), "aria-valuenow": String(Math.max(0, (h.step ?? 1) - 1)), "aria-label": "Steps behind you" },
        ui.h("span", { style: { width: `${h.total ? Math.max(4, Math.round(100 * Math.max(0, (h.step ?? 1) - 1) / h.total)) : 4}%` } })),
      h.inShort ? ui.h("p", { class: "pl-short" }, h.inShort) : null,
      inQuestions ? filled(sc.href, `Continue your plan: question ${sc.q} of ${sc.total} ›`, follow) : basics ? filled(basics.href, `${basics.label} ›`, follow) : h.next ? filled(h.next.href, `Continue: ${h.next.name} ›`, follow) : null);
    headBtn = !!h.next;
  } else if (!h.ready) {
    // finished the steps but some answers are still missing: no check mark and no "ready"
    put(head, title(h.title),
      ui.h("p", { class: "pl-lede" }, h.lede),
      h.inShort ? ui.h("p", { class: "pl-short" }, h.inShort) : null,
      h.firstGap ? filled(h.firstGap.href ?? "#/overview/plan", `Fill in the first gap: ${h.firstGap.what} ›`) : null);
    headBtn = !!h.firstGap;
  } else {
    put(head, ui.h("div", { class: "pl-check", "aria-hidden": "true" }, "✓"),
      title(h.title),
      h.inShort ? ui.h("p", { class: "pl-short" }, h.inShort) : null,
      ui.h("p", { class: "pl-lede" }, `You've done all ${h.total} steps. This page is your plan: it changes by itself when your numbers do.`),
      ui.h("p", { class: "pl-small" }, `Made from your answers on ${dateWords(d.madeOn)}${d.someGuessed ? ", with some of our guesses" : ""}.`));
  }
  wrap.append(head);
  // nothing answered yet: the intro and Let's go are the whole page (a list of "Not yet" rows would only be noise)
  if (h.state === "empty") { try { head.querySelector("h1")?.focus({ preventScroll: true }); } catch { /* focus is a nicety */ } return; }

  // ---- the answers, in three groups
  const rowLink = (r) => {
    const long = r.value && r.value.length > VALUE_MAX;
    const sentence = long ? `${r.value}. ${r.line}` : r.line;
    const dot = r.guessed && r.status === "ok" ? "" : r.status === "ok" ? "ok" : r.status === "warn" ? "warn" : r.status === "bad" ? "bad" : "";
    const open = r.status === "open";
    return ui.h("li", {}, ui.h("a", { href: r.href, "aria-label": `${r.label}: ${sentence}` },
      ui.h("span", { class: `pl-dot ${dot}`, "aria-hidden": "true" }),
      ui.h("span", { class: "pl-k", "aria-hidden": "true" }, r.label, ui.h("span", { class: "pl-s" }, sentence), r.note ? ui.h("span", { class: "pl-n" }, r.note) : null),
      r.value && !long ? ui.h("span", { class: `pl-v${open ? " open" : ""}`, "aria-hidden": "true" }, r.value) : null,
      ui.h("span", { class: "pl-chev", "aria-hidden": "true" }, "›")));
  };
  for (const g of d.groups) wrap.append(ui.h("section", { class: "card", "aria-labelledby": `pl-g-${g.title.length}` },
    ui.h("h2", { id: `pl-g-${g.title.length}` }, g.title), ui.h("ul", { class: "pl-rows" }, g.rows.map(rowLink))));

  // ---- what to do next
  wrap.append(ui.h("section", { class: "card", "aria-labelledby": "pl-m" },
    ui.h("h2", { id: "pl-m" }, "What to do next"),
    h.state === "complete" && !h.ready ? ui.h("p", { class: "pl-help" }, "First, fill in the gaps above. Then this list tells you what to do next.")
      : d.moves.length ? [ui.h("p", { class: "pl-help" }, "In this order. Each one opens the page where you do it."),
      ui.h("ol", { class: "pl-moves" }, d.moves.map((m, i) => ui.h("li", {}, ui.h("a", { href: m.href },
        ui.h("span", { class: "pl-num", "aria-hidden": "true" }, String(i + 1)),
        ui.h("span", { class: "pl-k" }, m.title, m.detail ? ui.h("span", { class: "pl-s" }, m.detail) : null),
        ui.h("span", { class: "pl-chev", "aria-hidden": "true" }, "›")))))]
      : ui.h("p", { class: "pl-help" }, "Nothing urgent. Keep going as you are.")));

  // ---- make it fit you better
  const shown = d.guesses.slice(0, GUESSES_SHOWN);
  wrap.append(ui.h("section", { class: "card", "aria-labelledby": "pl-f" },
    ui.h("h2", { id: "pl-f" }, "Make it fit you better"),
    shown.length ? [ui.h("p", { class: "pl-help" }, "We filled these in where you didn't know. They're typical for a household like yours. Type the real figure when you have it, and every page updates."),
      ui.h("ul", { class: "pl-rows" }, shown.map((g) => ui.h("li", {}, ui.h("a", { href: g.href }, ui.h("span", { class: "pl-dot", "aria-hidden": "true" }), ui.h("span", { class: "pl-k" }, g.label), ui.h("span", { class: "pl-chev", "aria-hidden": "true" }, "›"))))),
      ui.h("a", { class: "pl-link", href: "#/overview/guesses" }, `All ${Math.max(d.guessCount, d.guesses.length)} of our guesses ›`)]
      // (never "every figure is yours" above a line that says some of it rests on our guesses: stress test retest)
      : d.someGuessed || /our guesses/.test(h.inShort ?? "") ? [ui.h("p", { class: "pl-help" }, "Some figures are typical ones we filled in."), ui.h("a", { class: "pl-link", href: "#/overview/guesses" }, "See our guesses ›")]
      : ui.h("p", { class: "pl-help" }, "Every figure here is one you gave us."),
    d.notCounted.length ? [ui.h("h3", { class: "pl-help", style: { marginTop: "14px", fontWeight: "650" } }, "Not counted yet"),
      ui.h("ul", { class: "pl-rows" }, d.notCounted.map((g) => ui.h("li", {}, ui.h("a", { href: g.href }, ui.h("span", { class: "pl-dot", "aria-hidden": "true" }), ui.h("span", { class: "pl-k" }, g.label), ui.h("span", { class: "pl-chev", "aria-hidden": "true" }, "›")))))] : null));

  // ---- what we're counting on (folded)
  const a = d.assumptions;
  wrap.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "What we're counting on"), ui.h("span", { class: "fold-status" }, a.looked ? "✓ Looked over" : "Worth a look"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.h("ul", { class: "pl-lines" },
        [[`Prices rise about ${pc(a.inflation)} a year`, ""],
          [`Money in the stock market grows about ${pc(a.returnStocks)} a year, safer investments about ${pc(a.returnBonds)}`, "Before rising prices are taken off. Some years they go down."],
          [`The plan runs to age ${a.planEndAge}`, "So the money is planned to last"],
          [`An emergency fund of ${a.emergencyMonths} months of the bills you have to pay`, "For a lost job or a big repair"]]
          .map(([b, m]) => ui.h("li", {}, ui.h("b", {}, b), m ? ui.h("span", {}, m) : null))),
      ui.h("div", { class: "pl-btns" },
        a.looked ? null : ui.h("button", { type: "button", class: "secondary", onClick: () => { pending = "Saved: you've looked over what we're counting on."; ctx.store.update((q) => applyGuesses(q, today)); } }, "These sound fine"),
        ui.h("a", { class: "btn secondary", href: "#/system/assumptions" }, "Change them ›")))));

  // ---- keep it up to date
  // due: the month just ended, not checked in on yet (any day of the month); done: checked in (stress test MR-2)
  const due = d.checkIn.due && !d.checkIn.due.done ? d.checkIn.due : null, doneIn = d.checkIn.due?.done ? d.checkIn.due : null;
  const complete = h.state === "complete";
  const checkBtn = due ? ui.h("a", { class: `btn ${complete && !h.gaps ? "pl-go" : "secondary"}`, href: `#/overview/monthly-review?month=${due.month}` }, `Start the ${due.name} check-in`) : null;
  const filledSoFar = headBtn || (checkBtn && complete && !h.gaps);
  wrap.append(ui.h("section", { class: "card", "aria-labelledby": "pl-u" },
    ui.h("h2", { id: "pl-u" }, "Keep it up to date"),
    due ? [ui.h("p", { class: "pl-help" }, `Your ${due.name} check-in is ready: a look back at where the money went, about ten minutes.`), checkBtn]
      : doneIn ? ui.h("p", { class: "pl-help" }, `Your ${doneIn.name} check-in is done. The next one is in early ${doneIn.nextWhen}, to look back at ${doneIn.nextName}.`)
      : ui.h("p", { class: "pl-help" }, d.checkIn.nextName ? `Once a month, a ten-minute check-in brings your balances and spending up to date. Your first one is in early ${d.checkIn.nextName}; the Dashboard says when.` : "Once a month, a ten-minute check-in brings your balances and spending up to date. The Dashboard says when."),
    usable(ctx, "reports/plan-summary") ? ui.h("a", { class: "pl-link", href: "#/reports/plan-summary" }, "A copy to print or save ›") : null,
    usable(ctx, "overview/timeline") ? ui.h("a", { class: "pl-link", href: "#/overview/timeline" }, "Your life ahead, in dates ›") : null));

  // ---- the end
  if (complete) wrap.append(ui.h("section", { class: "pl-end" },
    h.ready ? [ui.h("p", {}, "Nothing else is needed. The pages in the menu are extras."),
      ui.h("p", {}, "You're done for now. Come back any time something changes, like a new job, a move or a baby.")]
      : ui.h("p", {}, "Fill in the gaps above whenever you are ready; the rest of your plan is already here."),
    ui.h("a", { class: `btn${filledSoFar || h.gaps ? " secondary" : ""}`, href: "#/overview/dashboard" }, "Go to my dashboard")));
  else if (h.state === "going" && h.next) { const fs = h.next.key === "answers" ? (() => { try { return firstStep(ctx.plan); } catch { return null; } })() : null;
    wrap.append(ui.h("section", { class: "pl-end" }, ui.h("a", { class: "btn secondary", href: fs?.href ?? h.next.href, onClick: follow }, fs ? `${fs.label} ›` : `Continue: ${h.next.name} ›`))); }
  try { wrap.querySelector("h1")?.focus({ preventScroll: true }); } catch { /* focus is a nicety */ }
}
