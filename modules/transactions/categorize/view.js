// modules/transactions/categorize/view.js -- DOM only. One row per payee that still has no
// category: pick a category in the row and every transaction from that payee gets it, plus
// a rule so next month's import files itself. An optional "ask the AI" button fills in
// suggestions (payee names only leave the device) that you still confirm one by one.
import { compute, buildPrompt, parseSuggestions } from "./compute.js";
import { categoriesOf, categoryLabel } from "../categories/compute.js";
import { ruleFor, normalizePayee } from "../rules/compute.js";

let aiSuggestions = {};   // normalized payee -> { category, confidence }; kept across re-renders in this session

let pending = null;   // confirmation kept across the shell re-render

export function render(root, ctx) {
  const { ui, fmt, store, plan, ai } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan);

  if (d.total === 0) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Categorise"), ui.h("p", { class: "lede" }, "Once transactions are on file, this page lists the ones with no category, grouped by payee, so you can file dozens in a few taps."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"))));
    return;
  }
  if (d.uncategorised === 0) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "All filed"), ui.h("p", { class: "lede" }, `Every one of your ${d.total} transactions has a category. New imports that match a rule file themselves; the rest show up here.`),
      ui.row(ui.h("a", { class: "btn secondary", href: "#/cashflow/spending" }, "See where the money went"))));
    return;
  }

  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 5000); pending = null; }
  root.append(out);
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${d.uncategorised} to file`),
    ui.h("p", { class: "lede" }, `${d.groups.length} payee${d.groups.length === 1 ? "" : "s"}. Pick a category on a row and every transaction from that payee gets it, now and in future imports.`),
    ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.round(d.share * 100)}%` } })),
    ui.h("p", { class: "muted small" }, `${d.done} of ${d.total} filed so far.`),
  ));

  const cats = categoriesOf(plan);
  const opt = (c) => ({ value: c.id, label: `${c.icon} ${c.label}` });
  const optionsFor = (g) => [{ value: "", label: "Pick a category..." }, ...(g.in ? [...cats.filter((c) => c.kind === "income"), ...cats.filter((c) => c.kind !== "income")] : cats).map(opt)];
  const apply = (g, category, makeRule = true) => {
    if (!category) return;
    const label = cats.find((c) => c.id === category)?.label ?? category;
    pending = `${g.payee} filed under ${label} (${g.count} transaction${g.count === 1 ? "" : "s"}).`;
    store.update((p) => {
      const ids = new Set(g.ids);
      const pretty = ruleFor(g.rawPayee, category);
      for (const t of p.transactions ?? []) if (ids.has(t.id)) { t.category = category; t.rawPayee = t.rawPayee ?? t.payee; if (pretty.payee) t.payee = pretty.payee; }
      if (makeRule && pretty.contains) {
        p.rules = p.rules ?? [];
        const dup = p.rules.find((r) => r.contains === pretty.contains && r.category === category);
        if (dup) dup.hits = (dup.hits ?? 0) + g.count;
        else p.rules.push({ id: ui.uid(), ...pretty, hits: g.count, createdAt: fmt.today() });
      }
    });
  };
  const applyAll = () => {
    const ready = d.groups.filter((g) => g.suggestion || aiSuggestions[g.key]);
    if (!ready.length) return;
    if (!ui.confirm(`File ${ready.reduce((s, g) => s + g.count, 0)} transactions from ${ready.length} payees with the suggested categories?`)) return;
    store.update((p) => {
      p.rules = p.rules ?? [];
      for (const g of ready) {
        const category = g.suggestion?.category ?? aiSuggestions[g.key].category;
        const ids = new Set(g.ids), pretty = ruleFor(g.rawPayee, category);
        for (const t of p.transactions ?? []) if (ids.has(t.id)) { t.category = category; t.rawPayee = t.rawPayee ?? t.payee; if (pretty.payee) t.payee = pretty.payee; }
        if (pretty.contains && !p.rules.some((r) => r.contains === pretty.contains && r.category === category)) p.rules.push({ id: ui.uid(), ...pretty, hits: g.count, createdAt: fmt.today() });
      }
    });
  };

  const suggested = d.groups.filter((g) => g.suggestion || aiSuggestions[g.key]).length;
  const aiBtn = ui.button("Ask the AI to suggest", async () => {
    aiBtn.disabled = true; aiBtn.textContent = "Asking...";
    try {
      const st = await ai.status();
      if (st === "off") throw new Error("AI is turned off in Settings.");
      const prompt = buildPrompt(plan, d.groups.filter((g) => !g.suggestion));
      const r = await ai.chat([{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }]);
      const got = parseSuggestions(plan, r.content);
      aiSuggestions = { ...aiSuggestions, ...got };
      aiBtn.textContent = `${Object.keys(got).length} suggestion${Object.keys(got).length === 1 ? "" : "s"} from the AI`;
      drawList();
    } catch (e) { aiBtn.textContent = "Ask the AI to suggest"; aiBtn.disabled = false; root.insertBefore(ui.notice("warn", `The AI could not help: ${e.message}`), listHost); }
  }, { class: "secondary" });
  root.append(ui.card(null, ui.row(
    suggested ? ui.button(`File all ${suggested} suggested`, applyAll) : null,
    aiBtn,
  ), ui.h("p", { class: "muted small" }, "Suggestions come from your rules, from what the same payee got before, or from the AI on your PC (it only sees the payee names). Nothing is filed until you pick or confirm.")));

  const listHost = ui.h("div");
  const drawList = () => {
    listHost.innerHTML = "";
    listHost.append(ui.card(null, ui.h("ul", { class: "page-list" }, d.groups.map((g) => {
      const sug = g.suggestion ?? (aiSuggestions[g.key] ? { category: aiSuggestions[g.key].category, label: categoryLabel(plan, aiSuggestions[g.key].category), why: `the AI thinks so (${Math.round(aiSuggestions[g.key].confidence * 100)}%)` } : null);
      const sel = ui.select(optionsFor(g), sug?.category ?? "", { "aria-label": `Category for ${g.payee}`, onChange: (e) => apply(g, e.target.value) });
      return ui.h("li", { style: { alignItems: "flex-start", flexWrap: "wrap" } },
        ui.h("span", { class: "ic" }, g.in ? "💵" : "🧾"),
        ui.h("span", { class: "body", style: { flex: "1 1 180px" } },
          ui.h("div", { class: "t" }, g.payee, " ", ui.h("span", { class: "pill" }, `${g.count} transaction${g.count === 1 ? "" : "s"}`), sug ? ui.h("span", { class: "pill accent" }, `suggested: ${sug.label}`) : null),
          ui.h("div", { class: "d" }, `${(g.in ? "+" : "-") + fmt.money(Math.abs(g.total), cur)} in total · ${fmt.date(g.first)}${g.first !== g.last ? ` to ${fmt.date(g.last)}` : ""}${sug ? ` · ${sug.why}` : ""}`),
          g.rawPayee && normalizePayee(g.rawPayee) !== normalizePayee(g.payee) ? ui.h("div", { class: "d" }, `bank wrote: ${g.rawPayee}`) : null),
        ui.h("span", { class: "st", style: { flex: "1 1 100%", marginTop: "6px", display: "flex", gap: "8px", alignItems: "center" } }, sel, sug ? ui.button("OK", () => apply(g, sug.category), { class: "small" }) : null),
      );
    }))));
  };
  drawList();
  root.append(listHost);
}
