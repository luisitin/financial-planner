// modules/investments/allocation/view.js -- DOM only. The drift verdict first, the actual and
// target mixes as two bars, each class with its drift; then ONE card of quiet rows (core/ui/more.js, docs/OPTIONAL.md):
// "Mix by account", "Regions and sectors" (a fund's own split, copied from its own page, with Undo; gap list, next 60,
// item 49) and "Your target mix" (the form). With no target of your own: what you hold and a few mixes to pick in one tap.
import { compute, TARGET_CLASSES, REGIONS, SECTORS, checkSplit } from "./compute.js";
import { ASSET_CLASSES } from "../holdings/compute.js";
import { parts } from "../../../core/ui/more.js";
import * as W from "./words.js";

let pending = null;   // the green line after a save: a string or { text, stocks?, part? } (the target), or { part: "splits", saved, symbol, undo, back }
let editing = null;   // { id, kind: "region" | "sector" }: the fund whose split form is open
let opened = false;   // a fund's form was just opened: it comes into view with the cursor in its first empty box (critic P4)
/** The page's memory, for its tests. */
export const _test = { reset() { pending = null; editing = null; opened = false; }, get editing() { return editing; } };
/** The cursor in `el` once it is on the page (a redraw draws the form before the page holds it). */
const focusSoon = (el, n = 0) => {
  if (!el || typeof requestAnimationFrame !== "function") return;
  if (el.isConnected) { try { el.focus({ preventScroll: true }); } catch { /* focus is a nicety */ } } else if (n < 30) requestAnimationFrame(() => focusSoon(el, n + 1));
};
const COLORS = { us_stocks: "var(--accent)", intl_stocks: "#7c9cd6", bonds: "#8fb996", cash: "#c9c9c9", real_estate: "#d6a06b", other: "#b48ad6", unknown: "#e0e0e0" };

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), splits: true });
  const money = (n) => fmt.money(n, cur);
  const pts = (x) => `${Math.round(x * 100)}%`;
  const said = pending; pending = null;
  const again = () => (typeof ctx.redraw === "function" ? ctx.redraw() : (root.replaceChildren?.(), render(root, ctx)));
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Your mix against your target"), ui.h("p", { class: "lede" }, "How much of your money sits in US stocks, international stocks, bonds and cash across every account, next to the mix you aim for. It needs your holdings first."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Add holdings"))));
    if (said && said.part !== "splits") root.append(ui.notice("ok", said.text ?? said));
    root.append(ui.h("div", {}, parts(ctx, targetPart(ctx, d, said))));
    return;
  }
  const w = d.worst;
  // a target of your own is judged only once most of the money is classified: on a guess, show what is held
  const own = d.targetSource === "own" && d.verdict !== "partial";
  const out = ui.h("div");
  if (said && said.part !== "splits") {
    const n = ui.notice("ok", said.text ?? said), share = said.stocks;
    // a target that differs from the Projection's stock share: one tap makes the plan's projection use it too
    if (share !== undefined) n.append(" ", ui.button(`Use ${pts(share)} stocks on Will the money last? too`, () => { pending = `Will the money last? now assumes ${pts(share)} stocks.`; store.update((q) => { q.retirement.stocksNow = Math.round(share * 100) / 100; }); }, { class: "secondary small" }));
    out.append(n); if (share === undefined) setTimeout(() => n.remove(), 4000);
  }
  // no target of your own: what you hold, and a few mixes to pick in one tap; no drift is called against a default
  if (d.verdict === "pick" || d.verdict === "partial") {
    const fund = d.choices.find((c) => c.key === "fund"), planC = d.choices.find((c) => c.key === "plan");
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, d.verdict === "partial" ? "Add what's in your other accounts first" : (d.restWords ? `You hold ${pts(d.stockShareActual)} stocks and ${pts(1 - d.stockShareActual)} ${d.restWords}` : `You hold ${pts(d.stockShareActual)} stocks`)),
      ui.h("p", { class: "lede" }, d.verdict === "partial"
        ? `The funds typed so far cover ${pts(d.known)} of the money in your investment accounts, so the mix below is a guess. Add each account's funds on Holdings, and pick a class for any marked unknown.`
        : `Pick the mix you want and this page will tell you when you drift away from it.${fund ? ` A ${fund.year} target-date fund holds about ${pts(fund.stocks)} stocks; your plan's projection assumes ${pts(planC?.stocks ?? 0.7)}.` : ` Your plan's projection assumes ${pts(planC?.stocks ?? 0.7)}.`}`),
      d.verdict === "partial" ? ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Open Holdings")) : null));
    root.append(out);
    if (d.verdict === "pick") {
      const save = (c) => {
        const sharePlan = Number(plan.retirement?.stocksNow ?? 0.7);
        pending = Math.abs(c.stocks - sharePlan) >= 0.05 ? { text: `Target saved: ${pts(c.stocks)} stocks.`, stocks: c.stocks } : `Target saved: ${pts(c.stocks)} stocks.`;
        store.update((q) => { q.investments.target = { ...c.mix }; });
      };
      root.append(ui.card("Pick the mix you want",
        ui.h("p", { class: "muted small" }, "Stocks grow more and swing more; bonds and cash steady the ride. You can change it any time."),
        ui.h("div", { style: { display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" } },
          d.choices.map((c, i) => ui.button(`${c.label}: ${pts(c.stocks)} stocks`, () => save(c), { class: i === 0 ? null : "secondary" })),
          ui.button("Type my own", () => { const f = root.querySelector("details[data-part='target']"); if (f) { f.open = true; f.scrollIntoView({ behavior: "smooth", block: "start" }); f.querySelector("input")?.focus({ preventScroll: true }); } }, { class: "secondary" }))));
    }
  } else root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.flaggedCount ? `${d.flaggedCount === 1 ? "One kind of investment has" : `${d.flaggedCount} kinds of investment have`} drifted too far from your target` : "Your mix is close to the target"),
    ui.h("p", { class: "lede" }, `${pts(d.stockShareActual)} in stocks against a target of ${pts(d.stockShareTarget)}, across ${money(d.total)} of holdings sorted into kinds. ${w && d.flaggedCount ? `The biggest gap is ${w.label}: ${pts(w.actual)} held, ${pts(w.target)} wanted (${w.drift > 0 ? "over" : "under"} by ${money(Math.abs(w.move))}).` : "No kind of investment has drifted too far from its target."}${d.flaggedCount ? " The Rebalance page says how to move back." : ""}`),
    ui.h("p", { class: "muted small" }, `A class is flagged when it is more than ${Math.round(d.band * 100)} points off, or more than a quarter of its own target off (the 5/25 rule). Balanced and target-date funds are split into their parts.`),
  ));
  if (d.verdict === "drift" || d.verdict === "ok") root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  const bar = (mixRows, key) => ui.h("div", { class: "alloc-bar", style: { display: "flex", height: "28px", borderRadius: "8px", overflow: "hidden", background: "var(--line)" } }, mixRows.filter((r) => r[key] > 0.001).map((r) => ui.h("span", { title: `${r.label} ${pts(r[key])}`, style: { width: `${r[key] * 100}%`, background: COLORS[r.cls] ?? "var(--muted)", display: "inline-block" } })));
  root.append(ui.card(own ? "Actual and target" : "What you hold",
    own ? ui.h("div", { class: "muted small", style: { marginBottom: "4px" } }, "What you hold") : null, bar(d.rows, "actual"),
    own ? ui.h("div", { class: "muted small", style: { margin: "10px 0 4px" } }, "What you aim for") : null, own ? bar(d.rows, "target") : null,
    ui.h("div", { class: "chips", style: { marginTop: "10px" } }, d.rows.map((r) => ui.h("span", { class: "chip", style: { cursor: "default", minHeight: "32px", padding: "2px 10px" } }, ui.h("span", { style: { display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: COLORS[r.cls], marginRight: "6px", verticalAlign: "middle" } }), `${r.label} ${pts(r.actual)}`))),
    ui.h("ul", { class: "records" }, d.rows.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.icon ? `${r.icon} ` : "", r.label, own && d.verdict === "drift" && r.flagged ? ui.h("span", { class: "pill warn" }, "off target") : null), ui.h("span", { class: "rec-value" }, own ? `${pts(r.actual)} of ${pts(r.target)}` : pts(r.actual))),
      ui.h("div", { class: "rec-sub" }, own ? `${money(r.value)} held; ${Math.abs(r.move) < 1 ? "on target" : `${r.move > 0 ? "add" : "trim"} ${money(Math.abs(r.move))} to match`}${r.flagged ? ` · ${r.reason}` : ""}` : `${money(r.value)} held`)))),
  ));
  root.append(ui.h("div", {}, parts(ctx,
    d.byAccountClass.length > 1 && { id: "accounts", kind: "more", title: "Mix by account", says: `${d.byAccountClass.length} accounts`,
      body: ui.h("ul", { class: "records" }, d.byAccountClass.map((a) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, a.account), ui.h("span", { class: "rec-value" }, money(a.value))),
        ui.h("div", { class: "rec-sub" }, Object.entries(a.classes).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([cls, v]) => `${ASSET_CLASSES[cls].label} ${a.value > 0 ? pts(v / a.value) : "-"}`).join(" · ")),
        bar(Object.entries(a.classes).map(([cls, v]) => ({ cls, label: ASSET_CLASSES[cls].label, share: a.value > 0 ? v / a.value : 0 })), "share")))) },
    splitsPart(ctx, d, said, again),
    targetPart(ctx, d, said))));
}

/** "Regions and sectors": the stocks by region and by kind of business, and each fund's own split, copied from its own page. */
function splitsPart(ctx, d, said, again) {
  const { ui, fmt, plan } = ctx;
  const sp = d.splits, cur = plan.meta.currency;
  if (!sp?.holdings.length) return null;
  const money = (n) => fmt.money(n, cur);
  const pts = (x) => `${Math.round(x * 100)}%`;
  const rows = (list) => ui.h("ul", { class: "records" }, list.map((r) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.label), ui.h("span", { class: "rec-value" }, pts(r.share))),
    ui.h("div", { class: "rec-sub" }, money(r.value)))));
  let green = null;
  if (said?.part === "splits") {
    const text = said.saved === "region" ? W.regionSaved(said.symbol, sp.regions.rows) : said.saved === "sector" ? W.sectorSaved(said.symbol, sp.sectors, cur)
      : said.saved === "tableRegion" ? W.tableAgain(said.symbol, "region", sp.regions.rows) : said.saved === "tableSector" ? W.tableAgain(said.symbol, "sector") : said.text;
    if (text) green = ui.notice("ok", text, said.undo ? { undo: said.undo, undone: (r) => { pending = { part: "splits", text: ui.undoneWords(r, said.back) }; } } : {});
    // a line with no button (after Undo, "Nothing to save") is brought wholly into view too: half under the top bar, the
    // shell would say it again at the bottom of the screen (critic P5, as on Performance)
    if (green && !said.undo) ui.reveal?.(green, { block: "nearest" });
  }
  const fund = (x) => {
    const open = editing?.id === x.id;
    return ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.symbol, x.name && x.name !== x.symbol ? ui.h("span", { class: "muted small" }, ` ${x.name}`) : null), ui.h("span", { class: "rec-value" }, money(x.stockValue))),
      ui.h("div", { class: "rec-sub" }, `${W.fundSub(x)} · ${x.account}`),
      open ? splitForm(ctx, x, editing.kind, again) : ui.h("div", { class: "rec-foot" }, ui.button(W.splitButton(x), () => { editing = { id: x.id, kind: x.regions || !x.sectors ? "region" : "sector" }; opened = true; pending = { part: "splits" }; again(); }, { class: "secondary small" })));
  };
  return { id: "splits", kind: "own", title: "Regions and sectors", set: sp.typed, missing: sp.typed === 0,
    open: said?.part === "splits" || !!editing,
    body: [
      green,
      ui.h("p", { class: "muted small" }, W.SPLITS_INTRO),
      ui.h("h3", {}, "Your stocks by region"),
      rows(sp.regions.rows),
      ui.h("p", { class: "small" }, W.regionTableLine(sp.regions.table)),
      ui.h("h3", {}, "Your stocks by kind of business"),
      sp.sectors.typed ? rows(sp.sectors.rows) : null,
      ui.h("p", { class: "small" }, W.sectorLine(sp.sectors, cur)),
      ui.h("h3", {}, "Your funds with stocks"),
      ui.h("ul", { class: "records" }, sp.holdings.map(fund)),
    ] };
}

/** One fund's split, by region or by kind of business: boxes in percent that must come to 100, Save with Undo. */
function splitForm(ctx, x, kind, again) {
  const { ui } = ctx;
  const list = kind === "region" ? REGIONS : SECTORS, field = kind === "region" ? "regions" : "sectors";
  const have = kind === "region" ? x.regions : x.sectors;
  // no split of its own yet: the United States share from our rough guide (by region), so the form never opens blank there
  const values = have ? Object.fromEntries(list.map((r) => [r.key, Math.round(have[r.key] * 1000) / 10 || null])) : kind === "region" ? W.guideValues(x) : {};
  const nothing = { part: "splits", text: `Nothing to save: ${x.symbol}'s split is as it was.` };
  const save = (shares, saved) => {
    // the split it already has: the plan is not written (no save, no new date on it), the line says so
    if (shares && have && list.every((r) => Math.abs((shares[r.key] ?? 0) - (have[r.key] ?? 0)) < 1e-9)) { pending = nothing; editing = null; again(); return; }
    const next = { part: "splits", saved, symbol: x.symbol, back: W.splitBack(x.symbol) };
    pending = next; editing = null;
    next.undo = ui.undoable(ctx.store, (dr) => { const t = (dr.holdings ?? []).find((y) => y.id === x.id); if (!t) return; if (shares) t[field] = shares; else delete t[field]; });
    if (!next.undo) pending = nothing;   // the shell's redraw after the update shows it
  };
  const form = ui.form(list.map((r) => ({ key: r.key, label: r.label, type: "number", min: 0, max: 100, step: "any", help: r.help })), values, (v) => {
    const c = checkSplit(kind, v);
    if (!c.ok) return ui.fieldError(form.elements?.[list[0].key], c.error);
    save(c.shares, kind);
  }, { submitLabel: "Save the split", onCancel: () => { editing = null; opened = false; pending = { part: "splits" }; again(); } });
  const sumLine = ui.h("p", { class: "small", "aria-live": "polite", style: { margin: "4px 0 0" } });
  const tally = () => {
    const sum = list.reduce((s, r) => s + (Number(form.elements?.[r.key]?.value) || 0), 0), off = Math.round((sum - 100) * 10) / 10;
    sumLine.style.color = sum > 0 && Math.abs(off) > 0.5 ? "var(--bad)" : "var(--muted)";
    sumLine.textContent = sum <= 0 ? "Type each share in percent; together they come to 100." : Math.abs(off) <= 0.5 ? "Adds up to 100%." : `Adds up to ${Math.round(sum * 10) / 10}%: ${off > 0 ? `take ${off} off` : `add ${-off}`} somewhere so it comes to 100.`;
  };
  for (const r of list) form.elements?.[r.key]?.addEventListener?.("input", tally);
  tally();
  form.querySelector?.(".form-actions")?.before?.(sumLine);
  const chip = (k, text) => ui.h("button", { type: "button", class: k === kind ? "chip on" : "chip", "aria-pressed": k === kind ? "true" : "false", onClick: () => { if (k !== kind) { editing = { id: x.id, kind: k }; pending = { part: "splits" }; again(); } } }, text);
  const wrap = ui.h("div", { class: "rec-form", style: { display: "grid", gap: "8px", marginTop: "8px" } },
    ui.h("div", { class: "chips", role: "group", "aria-label": `Split ${x.symbol}` }, chip("region", "By region"), chip("sector", "By kind of business")),
    kind === "region" && !have ? ui.h("p", { class: "small" }, W.guideLine(x)) : null,
    form,
    have ? ui.button("Use our rough guide again", () => save(null, kind === "region" ? "tableRegion" : "tableSector"), { class: "secondary small" }) : null);
  // just opened from its button (gone with the redraw): the form in view, the cursor in its first empty box
  if (opened) {
    opened = false;
    ui.reveal?.(wrap, { block: "start" });
    focusSoon(list.map((r) => form.elements?.[r.key]).find((b) => b && !b.value) ?? form.elements?.[list[0].key]);
  }
  return wrap;
}

/** "Your target mix": the six shares and the band (the two rarer kinds under "More details (optional)": five boxes first, R21). */
function targetPart(ctx, d, said) {
  const { ui, store, plan } = ctx;
  // the boxes start blank unless you chose a target: the Projection's default is not yours to save by accident
  const t = d.targetSource === "own" ? d.target ?? {} : {};
  const FIELDS = [
    ...TARGET_CLASSES.map((cls) => ({ key: cls, label: ASSET_CLASSES[cls].label, type: "number", min: 0, max: 100, step: "1", help: cls === "us_stocks" ? "percent of the whole portfolio; the six add up to 100" : undefined, more: cls === "real_estate" || cls === "other" })),
    { key: "band", label: "How far a kind of investment can drift", type: "number", min: 1, max: 25, step: "1", help: "how many percentage points it can drift before the page flags it; 5 is the usual" },
  ];
  const values = { ...Object.fromEntries(TARGET_CLASSES.map((c) => [c, Math.round((t[c] ?? 0) * 100) || null])), band: Math.round((plan.investments?.band ?? 0.05) * 100) };
  const form = ui.form(FIELDS, values, (v) => {
    const sum = TARGET_CLASSES.reduce((s, c) => s + (v[c] ?? 0), 0);
    // a target that does not add up to 100 is held, with the sum said beside the button (60 + 60 was saved as 50 / 50)
    if (sum > 0 && Math.abs(sum - 100) > 0.5) { tally(); sumLine.scrollIntoView({ block: "center" }); form.querySelector("input")?.focus({ preventScroll: true }); return false; }
    pending = { text: "Target saved.", part: "target" };
    store.update((p) => { p.investments.target = sum > 0 ? Object.fromEntries(TARGET_CLASSES.map((c) => [c, (v[c] ?? 0) / sum])) : null; p.investments.band = Math.min(0.25, Math.max(0.01, (v.band ?? 5) / 100)); });
  }, { submitLabel: "Save target" });
  const sumLine = ui.h("p", { class: "small", "aria-live": "polite", style: { margin: "4px 0 0" } });
  const tally = () => {
    const sum = TARGET_CLASSES.reduce((s, c) => s + (Number(form.elements[c]?.value) || 0), 0);
    const off = Math.round((sum - 100) * 10) / 10;
    sumLine.style.color = sum > 0 && Math.abs(off) > 0.5 ? "var(--bad)" : "var(--muted)";
    sumLine.textContent = sum <= 0 ? "Leave all six blank for no target." : Math.abs(off) <= 0.5 ? "Adds up to 100%." : `Adds up to ${Math.round(sum * 10) / 10}%: ${off > 0 ? `take ${off} off` : `add ${-off}`} somewhere so it comes to 100.`;
  };
  for (const c of TARGET_CLASSES) form.elements[c]?.addEventListener("input", tally);
  tally();
  form.querySelector(".form-actions")?.before(sumLine);
  // the opt spec's own title (pinned in qa/first-view-lib.mjs): shut on every plan, the empty one too; open after its own save (R17)
  return { id: "target", kind: "own", title: "Your target mix", open: said?.part === "target", holds: [...TARGET_CLASSES, "band"],
    says: d.targetSource === "own" ? `${Math.round((t.us_stocks + t.intl_stocks + (t.real_estate ?? 0)) * 100)}% stocks` : "", missing: d.targetSource !== "own",
    body: [ui.h("p", { class: "muted small" }, "Percent of the whole portfolio in each; leave everything blank for no target (the page then shows what you hold without calling anything off target). Typical: 60% stocks / 40% bonds for someone near retirement, 90/10 for someone with decades to go; about a third of stocks outside the US matches the world's markets."), form] };
}
