// modules/overview/guesses/view.js -- DOM only. "Our guesses for you": the figures the plan filled in where a box was
// left empty, the ones that change your answers most first. Each row: what it is, our figure, one "Our guess:" line, a
// box to type the real figure (grey with ours) and "That's about right". Folded below: the ones that matter less, the
// market assumptions, and, last, where the figures come from. The plan changes only through ctx.store.update, with
// core/estimate's saveField (a typed figure is the person's: the guess on it is dropped) and confirmGuess.
import { compute } from "./compute.js";
import { mergeEstimators, saveField, confirmGuess } from "../../../core/estimate/index.js";

const STYLE = `
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

  const big = d.big, small = d.small;
  if (big.length) root.append(ui.card(d.frozen || d.stale ? "Type these first" : "Matters most", ui.h("ul", { class: "records" }, big.map(record))));
  if (small.length) {
    root.append(ui.h("details", { class: "card fold fold-card", open: big.length ? null : true },
      ui.h("summary", {}, ui.h("h2", {}, "Matters less"), ui.h("span", { class: "fold-status" }, `${small.length} ${small.length === 1 ? "guess" : "guesses"}`), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("ul", { class: "records" }, small.map(record))));
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
