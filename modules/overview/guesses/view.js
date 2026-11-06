// modules/overview/guesses/view.js -- DOM only. "Our guesses for you": the figures the plan filled in where a box was
// left empty, the ones that change your answers most first. Each row: what it is, our figure, one "Our guess:" line, a
// box to type the real figure (grey with ours) and "That's about right". Folded below: the ones that matter less, the
// market assumptions, and, last, where the figures come from. The plan changes only through ctx.store.update, with
// core/estimate's saveField (a typed figure is the person's: the guess on it is dropped) and confirmGuess.
import { compute, useNewGuesses, keepOldGuesses, sameLoan, twoLoans } from "./compute.js";
import { mergeEstimators, saveField, confirmGuess } from "../../../core/estimate/index.js";

const STYLE = `
.gs-root input::placeholder { color: var(--muted); opacity: 1; }
.gs-root .gs-why { color: var(--text-2); font-size: var(--fs-sm); margin-top: 4px; line-height: 1.4; }
.gs-root .gs-note { color: var(--muted); font-size: var(--fs-sm); margin-top: 4px; }
.gs-root .gs-form { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; }
.gs-root .gs-form .money-in { flex: 1 1 auto; min-width: 0; }
.gs-root .gs-form button { flex: none; }
.gs-root .gs-foot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.gs-root .gs-err:empty { display: none; }
.gs-root .gs-src li { display: block; }
.gs-root .gs-src .rec-sub { margin-top: 2px; }
.gs-root .gs-src .btn { margin-top: 6px; }
.gs-root .gs-group { font-weight: 600; margin: 14px 0 2px; color: var(--text-2); font-size: var(--fs-sm); }
`;
let pending = null;   // the green or red line the last save leaves, shown on the next render (the shell re-renders after store.update)

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const today = fmt.today();
  const cur = plan?.meta?.currency ?? "USD";
  const reg = mergeEstimators([...(ctx.modules?.values?.() ?? [])].map((m) => ({ from: `${m.group}/${m.id}`, estimators: m.estimators, tables: m.guessTables })));
  const d = compute(plan, { estimators: reg.estimators, tables: reg.tables, today });
  const root = ui.h("div", { class: "gs-root" }, ui.h("style", {}, STYLE));
  page.append(root);

  // a rate as the plan keeps it: to a thousandth of a percent (6.125%, 6.875%), as Get started and the box save it
  const pctNumber = (v) => Number((v * 100).toFixed(3));
  const pctText = (v) => `${pctNumber(v)}%`;
  const accountNames = (ids) => (ids ?? []).map((id) => (plan.accounts ?? []).find((a) => a.id === id)?.name).filter(Boolean);
  const shown = (r) => {
    if (r.kind === "percent") return pctText(r.value);
    if (r.kind === "list") { const n = accountNames(r.value); return n.length ? n.join(", ") : "none yet"; }
    if (r.kind === "number") return String(r.value);
    return `${fmt.money(r.value, cur)}${r.unit === "month" ? " a month" : r.unit === "year" ? " a year" : ""}`;
  };
  const say = (kind, text) => { pending = { kind, text }; };

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Our guesses for you"),
    ui.h("p", { class: "lede" }, d.count
      ? "We filled in what you skipped with typical figures, so your plan works before you know every number. The first few change your answers the most. Type the real figure when you have it."
      : "When you leave a box empty, we fill in a typical figure so your plan still works. Every figure we fill in shows up here.")));
  if (pending) { root.append(ui.notice(pending.kind, pending.text)); ctx.announce?.(pending.text); pending = null; }

  // "Is this the same loan?" (C2 review D2): a debt or home Get started guessed beside one of its kind added later;
  // counted twice until the person says which it is
  const twins = d.offers.twins ?? [];
  if (twins.length) {
    const m = (v) => fmt.money(Math.round(v), cur);
    const noun = (t) => (t.kind === "home" ? "home" : "loan");
    root.append(ui.card(twins.length === 1 ? `Is this the same ${noun(twins[0])}?` : "Did you add any of these twice?",
      ui.h("ul", { class: "records" }, twins.map((t) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${t.twinName} and ${t.name}`)),
        ui.h("p", {}, `You added ${t.twinName}, ${m(t.twinAmount)}. We also have ${t.name}, with our guess of about ${m(t.amount)}${t.kind === "home" ? "" : " still owed"}. If they're the same ${noun(t)}, it's counted twice now.`),
        ui.h("div", { class: "row" },
          ui.button(`Yes, the same ${noun(t)}`, () => { say("ok", `Done: ${t.twinName} counts once, and our guess for ${t.name} is gone.`); store.update((draft) => { sameLoan(draft, t.id, t.twinId); }); }),
          ui.button(`No, two ${noun(t)}s`, () => { say("ok", `Kept both: ${t.twinName} and ${t.name} count as two ${noun(t)}s. We won't ask about these two again.`); store.update((draft) => { twoLoans(draft, t.id, t.twinId, today); }); }, { class: "secondary" })))))));
  }

  // "Better guesses are ready" (spec 11.5): the figures Get started filled in before stay as they are until a tap here.
  // A change of under 2% in an amount is not listed (it is still written with the rest): it would only be noise
  const up = d.offers.upgrade;
  const small = (x) => x.kind === "money" && Number(x.from) > 0 && Math.abs(x.to - x.from) / Number(x.from) < 0.02;
  const listed = up.filter((x) => !small(x)), quiet = up.length - listed.length;
  if (listed.length) {
    const words = (x, v) => (x.kind === "percent" ? pctText(v) : x.kind === "money" ? `${fmt.money(v, cur)}${x.unit === "month" ? " a month" : x.unit === "year" ? " a year" : ""}` : String(v));
    root.append(ui.card("Better guesses are ready",
      ui.h("p", {}, `We now fill in figures from where you live and what you told us. ${listed.length === 1 ? "This one would change" : `These ${listed.length} would change`}; nothing moves until you say so.`),
      ui.h("ul", { class: "records" }, listed.map((x) => ui.h("li", {},
        // the label on its own line and the change under it: side by side, a long label broke into one word a line at 390 px
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.label)),
        ui.h("div", { class: "rec-value" }, `From ${words(x, x.from)} to ${words(x, x.to)}`),
        ui.h("div", { class: "gs-why" }, `Our new guess: ${x.why}.`)))),
      quiet ? ui.h("p", { class: "muted small" }, `Plus ${quiet === 1 ? "one small change" : `${quiet} small changes`} of under 2%.`) : null,
      ui.h("div", { class: "row" },
        ui.button("Use the new guesses", () => { say("ok", `Saved: ${up.length === 1 ? "the new guess is" : `the ${up.length} new guesses are`} in your plan. They follow your answers from now on.`); store.update((draft) => { useNewGuesses(draft, { estimators: reg.estimators, tables: reg.tables, today }); }); }),
        ui.button("Keep the old ones", () => { say("ok", "Kept: your older figures stay as they are. We won't ask again."); store.update((draft) => { keepOldGuesses(draft, today); }); }, { class: "secondary" }))));
  }

  if (!d.count) {
    root.append(d.planEmpty
      ? ui.card("Nothing to look over yet",
        ui.h("p", {}, "Answer the questions on Get started. Any box you leave empty gets a figure typical for a household like yours, and it shows up here so you can check it or type the real one."),
        ui.h("div", { class: "row" }, ui.h("a", { class: "btn", href: "#/overview/setup" }, "Get started"), ui.h("a", { class: "btn secondary", href: "#/overview/dashboard" }, "Back to the Dashboard")))
      : ui.card("Nothing to look over",
        ui.h("p", {}, "Every figure in your plan is one you typed. If you leave a box empty later, the figure we fill in shows up here."),
        ui.h("div", { class: "row" }, ui.h("a", { class: "btn secondary", href: "#/overview/dashboard" }, "Back to the Dashboard"))));
    root.append(sourcesFold());
    return;
  }

  /** One guess: what it is, our figure, why, the box for the real figure, and "That's about right". */
  function record(r) {
    const err = ui.h("div", { class: "gs-err", "aria-live": "polite" });
    const li = ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.label), r.kind !== "list" ? ui.h("span", { class: "rec-value" }, shown(r)) : null),
      r.kind === "list" ? ui.h("div", { class: "rec-sub" }, shown(r)) : null,
      ui.h("div", { class: "gs-why" }, r.frozen || r.stale ? r.why : `Our guess: ${r.why}.`),
      err);
    const keep = () => { say("ok", `Kept. ${r.label} stays at ${shown(r)}, and it counts as yours now.`); store.update((draft) => { confirmGuess(draft, r.path); }); };
    if (r.kind === "list") {
      li.append(ui.h("div", { class: "gs-foot" },
        ui.button("That's about right", keep, { class: "secondary small" }),
        r.href ? ui.h("a", { class: "btn secondary small", href: r.href }, "Change it on Goals ›") : null));
      return li;
    }
    const aria = `${r.label}, blank uses our guess of about ${shown(r)}`;
    let box, input, read;
    if (r.kind === "money") {
      ({ box, input } = ui.moneyBox({ name: "real", placeholder: fmt.amountText(r.value), label: aria, min: 0 }));
      read = () => ui.moneyValue(input);
    } else {
      input = ui.h("input", { type: "text", name: "real", inputmode: "decimal", autocomplete: "off", placeholder: r.kind === "percent" ? String(pctNumber(r.value)) : String(r.value), "aria-label": aria });
      box = ui.h("span", { class: "money-in" }, input, r.kind === "percent" ? ui.h("span", { class: "money-sign", "aria-hidden": "true", style: { left: "auto", right: "12px" } }, "%") : null);
      if (r.kind === "percent") input.style.paddingRight = "34px";
      read = () => {
        const t = String(input.value).replace(/[%\s,]/g, "");
        if (!t) return null;
        const n = Number(t);
        if (!Number.isFinite(n) || n < 0 || (r.kind === "percent" && n > 100)) return NaN;
        return r.kind === "percent" ? Math.round(n * 1000) / 100000 : n;
      };
    }
    const form = ui.h("form", { class: "gs-form", onSubmit: (e) => {
      e.preventDefault();
      const v = read();
      if (v === null || Number.isNaN(v)) {
        err.replaceChildren(ui.notice("error", v === null ? "Type the real figure first, or tap “That's about right” to keep ours." : r.kind === "percent" ? "Type the rate as a number, like 6.5 for 6.5%." : "Type an amount in numbers, like 4,500."));
        input.focus();
        return;
      }
      const words = r.kind === "percent" ? pctText(v) : `${fmt.money(v, cur)}${r.unit === "month" ? " a month" : r.unit === "year" ? " a year" : ""}`;
      // a debt's older payment was worked out at its rate: a new rate leaves it behind, so say so (it leads the page next)
      const pay = /^debts\[[^\]]+\]\.rate$/.test(r.path) && Math.abs(v - r.value) > 1e-9 ? d.rows.find((x) => x.path === r.path.replace(/\.rate$/, ".minPayment") && x.legacy && !x.stale) : null;
      say("ok", `Saved. ${r.label} is ${words} now. It's yours, so we won't change it.${pay ? ` Your payment of ${shown(pay)} was worked out at the old rate, so type your real one too.` : ""}`);
      store.update((draft) => { saveField(draft, r.path, { value: v, guessed: false }, null, today); });
    } }, box, ui.h("button", { type: "submit" }, "Save"));
    li.append(form, ui.h("div", { class: "gs-foot" }, ui.button("That's about right", keep, { class: "secondary small" })));
    return li;
  }

  // at most four open at the top (a phone screen or so; C2 review, UX 10): the rest of the big ones fold with the small
  const lead = Math.max(4, d.big.filter((r) => r.frozen || r.stale).length);
  const big = d.big.slice(0, lead), more = [...d.big.slice(lead), ...d.small];
  // while what is left each month waits on our spending guesses (Next best action's spare.waits, spec 8.1), spending leads:
  // every other page says it is the figure to type next, so this one does too (C3 UX review 6). It opens question 6, the
  // screen made for typing it; the rows stay below one by one.
  let spendLead = null;
  try { const nba = ctx.computeOf?.("overview/next-best-action", { today }); if (nba?.ready && nba.spare.waits) spendLead = nba.spare; } catch { spendLead = null; }
  const spendRecord = spendLead ? ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, "Everyday spending"), ui.h("span", { class: "rec-value" }, `about ${fmt.money(Math.round(spendLead.guessedMonthly / 10) * 10, cur)} a month`)),
    ui.h("div", { class: "gs-why" }, `${spendLead.spending - spendLead.guessedMonthly < 5 ? "All of your spending is" : "Most of your spending is"} our guesses for now, and it decides whether your month works. Type what you really spend, row by row, on one screen.`),
    ui.h("div", { class: "gs-foot" }, ui.h("a", { class: "btn small", href: "#/overview/setup/spend?back=done" }, "Type yours \u203a"))) : null;
  if (big.length || spendRecord) root.append(ui.card(d.frozen || d.stale ? "Type these first" : "Matters most", ui.h("ul", { class: "records" }, spendRecord, ...big.map(record))));
  if (more.length) {
    root.append(ui.h("details", { class: "card fold fold-card", open: big.length ? null : true },
      ui.h("summary", {}, ui.h("h2", {}, d.big.length > lead ? "More of our guesses" : "Matters less"), ui.h("span", { class: "fold-status" }, `${more.length} ${more.length === 1 ? "guess" : "guesses"}`), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("ul", { class: "records" }, more.map(record))));
  }
  root.append(ui.h("section", { class: "card flat" },
    ui.h("p", { class: "muted" }, d.lookedAt ? `You looked these over on ${fmt.date(d.lookedAt)}. Type a real figure whenever you have one.` : "Looked them over? Say so here. You can type a real figure any time."),
    ui.h("div", { class: "row" }, ui.button("These look fine", () => { say("ok", "Thanks. Our guesses stay as they are until you type the real figures."); store.update((draft) => { draft.guide = draft.guide ?? {}; draft.guide.guessesLookedAt = today; }); }, { class: "secondary" }))));

  const reviewed = plan?.assumptions?.reviewedAt;
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "What the plan assumes about prices and markets"), ui.h("span", { class: "fold-status" }, reviewed ? "Looked over" : "Worth a look"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", {}, "How fast prices rise, what investments earn and how long the money has to last are the same for everyone until you change them. They are not guesses about you."),
    ui.h("div", { class: "row" }, ui.h("a", { class: "btn secondary", href: "#/system/assumptions" }, "Change them ›"))));
  root.append(sourcesFold());

  /**
   * Where the figures come from: for each table, our name for it, the publisher, the publisher's table, a plain "as of"
   * line and the day we read it, with a 44 px link to the table. The ones behind your guesses first. A plan that takes no
   * U.S. figures (core/estimate applies) is told so, with no list.
   */
  function sourcesFold() {
    const used = new Set(d.sources.used.map((s) => s.id));
    const item = (s) => ui.h("li", {},
      ui.h("div", { class: "rec-title" }, s.title),
      ui.h("div", { class: "rec-sub" }, `${s.shownBy ?? s.publisher}${s.industry ? " (an industry survey)" : ""}${s.derived ? " (worked out from the published data)" : ""}`),
      s.tableShown ? ui.h("div", { class: "rec-sub" }, s.tableShown) : null,
      ui.h("div", { class: "rec-sub" }, `${s.asOf ?? s.vintage}. Read ${fmt.date(s.readOn)}.`),
      s.url ? ui.h("a", { class: "btn secondary small", href: s.url, target: "_blank", rel: "noopener" }, "The table ›") : null);
    const others = d.sources.all.filter((s) => !used.has(s.id));
    const status = d.applies ? `${d.sources.all.length} tables from ${d.sources.orgs} publishers` : "Not used for your plan";
    return ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("h2", {}, "Where our guesses come from"), ui.h("span", { class: "fold-status" }, status), ui.h("span", { class: "fold-chev" }, "›")),
      d.applies
        ? ui.h("p", { class: "muted small" }, "Public figures from government surveys, plus a few industry surveys where no public one exists. Some guesses are worked out from your own answers instead, and say so.")
        : ui.h("p", {}, `We fill in typical figures only for households in the U.S. that count in dollars, so none of these tables is used for your plan.${d.count ? " The figures above were filled in when a box was left empty: type the real ones when you have them." : ""}`),
      d.applies && d.sources.used.length ? ui.h("div", { class: "gs-group" }, "Behind the guesses above") : null,
      d.applies && d.sources.used.length ? ui.h("ul", { class: "records gs-src" }, d.sources.used.map(item)) : null,
      d.applies && others.length ? ui.h("div", { class: "gs-group" }, d.sources.used.length ? "On hand for other guesses" : "On hand for when we fill in a figure") : null,
      d.applies && others.length ? ui.h("ul", { class: "records gs-src" }, others.map(item)) : null);
  }
}
