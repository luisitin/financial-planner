// modules/estate/inheritance/view.js -- DOM only. An inheritance you might receive, as a what-if: what it
// would change if it came, and if it came smaller or later; the plan itself never counts on it. Runs on
// the PC when connected. Simple first (docs/OPTIONAL.md): the answer, the cases, the list and one way to add; an
// inherited IRA's ten years ("Emptying it within 10 years", one part per account) and "How this is worked out" are one
// tap away.
import { KINDS, LATER_YEARS, EMPTYING_MAX, NO_INCOME, emptying, emptyingSentence, eligibleNote, wayWords, answerSentence, savedLine, emptyingSays, emptyingSaved, bridgeSentence, partTitles } from "./compute.js";
import { needsWords } from "../../../core/words.js";
import { parts, rest, links } from "../../../core/ui/more.js";

let pending = null;   // { word, part? }: the confirmation shown on the next render, and the part that was saved (it stays open)
// The account parts saved in on this visit: they stay open (after a save in another part, and on Back) until the person
// shuts them or the app is opened again, like the form kit's "More details (optional)" line. Never stored.
const stay = new Set();

const STYLE = `
.ih-root .ih-list { list-style: none; margin: 0; padding: 0; }
.ih-root .ih-list li { display: flex; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.ih-root .ih-list li:last-child { border-bottom: 0; }
.ih-root .ih-body { flex: 1; min-width: 0; }
.ih-root .ih-t { font-weight: 600; }
.ih-root .ih-d { color: var(--text-2); font-size: var(--fs-sm); }
.ih-root .ih-v { flex: none; white-space: nowrap; text-align: right; }
.ih-root .ih-cases { list-style: none; margin: 0; padding: 0; }
.ih-root .ih-cases li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.ih-root .ih-cases li:last-child { border-bottom: 0; }
.ih-root .ih-cases .ih-v span { display: block; color: var(--muted); font-size: var(--fs-xs); }
.ih-root .ih-ways { list-style: none; margin: 0; padding: 0; }
.ih-root .ih-ways li { padding: 10px 0; border-bottom: 1px solid var(--line); }
.ih-root .ih-ways li:last-child { border-bottom: 0; }
.ih-root .ih-way { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.ih-root .ih-way .ih-v { font-weight: 600; }
.ih-root .ih-how li { margin: 6px 0; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const root = ui.h("div", { class: "ih-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const said = pending; pending = null;
  const host = ui.h("div");
  root.append(host);
  host.append(ui.notice("info", "Running your plan with and without it..."));
  ctx.computeRemote("estate/inheritance", { today: fmt.today() }).then(draw, (e) => host.replaceChildren(ui.notice("error", `The inheritance could not be worked out: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));

  function draw(d) {
    host.replaceChildren();
    let editing = null;
    // the green line (R7: it names the new answer), where the save was: in the saved part, else above the form
    const confirm = (text) => { const n = ui.notice("ok", text); setTimeout(() => n.remove(), 4000); return n; };
    const out = ui.h("div");
    const line = said && !said.part ? confirm(said.named ? savedLine(said.word, d, money) : said.word) : null;
    // the first one added (or the last one removed) redraws the whole page from its top: the line goes where the eye is
    if (line && said.top) host.append(line); else if (line) out.append(line);

    if (!d.items.length) host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "An inheritance you might receive"),
      ui.h("p", { class: "lede" }, "Many people expect something from parents or relatives. It is wise not to count on it: care in later life can use most of it up, and plans change. Here you can see what it would change if it came, without putting it in your plan."),
      ui.h("p", { class: "muted small" }, "Enter what you might receive and when, in today's dollars. Nothing here changes your other pages.")));
    else if (d.ready) {
      const w = d.withIt;
      host.append(ui.card("If it comes", ui.row(
        ui.stat("What arrives", money(d.net), d.net < d.total ? `of ${money(d.total)}, after tax and selling costs` : "in today's dollars"),
        ui.stat("You could spend", `${d.extraMonthly >= 0 ? "+" : ""}${money(d.extraMonthly)}`, `a month more in retirement, about ${money(w.affordableMonthly)} in all`),
      ), ui.h("p", { class: "ih-d" }, answerSentence(d, money))));
      const cases = [["Without it (your plan)", d.base], ["If it comes as expected", w], ["Half as much", d.half], [`${LATER_YEARS} years later`, d.later]];
      host.append(ui.card("If it is smaller, or later", ui.h("ul", { class: "ih-cases" }, cases.map(([t, r]) => ui.h("li", {}, ui.h("span", {}, t), ui.h("span", { class: "ih-v" }, `${money(r.affordableMonthly)} a month`, ui.h("span", {}, r.success ? `ends with ${money(r.endReal)}` : `runs out in ${r.failYear}`))))),
        ui.h("p", { class: "muted small" }, "What the plan could spend a month in retirement and still last, in each case. Spend it only once it has arrived.")));
    } else host.append(ui.card(null, ui.h("p", { class: "muted" }, needsWords("To see what it would change, the plan needs", d.missing))));

    if (d.items.length) host.append(ui.card("What you might receive", ui.h("p", { class: "muted small" }, "Tap one to change it."), ...rest(ctx, { id: "items", items: d.items, noun: "inheritances", list: "ih-list", row: (x) => ui.h("li", { role: "button", tabindex: "0", onClick: () => { editing = (plan.estate.inheritance.items ?? []).find((y) => y.id === x.id); drawForm(true); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("div", { class: "ih-body" }, ui.h("div", { class: "ih-t" }, x.from ? `From ${x.from}` : "An inheritance"), ui.h("div", { class: "ih-d" }, `${x.kindLabel} · about ${x.year}${x.net < x.amount ? ` · ${money(x.net)} after tax and costs` : ""}`)),
      ui.h("div", { class: "ih-v" }, money(x.amount))) })));

    const formHost = ui.h("div");
    const drawForm = (open = !d.items.length) => {
      formHost.innerHTML = "";
      if (!open && !editing) { formHost.append(ui.button("+ Add another inheritance", () => drawForm(true), { class: "secondary" })); return; }
      formHost.append(...[ui.h("h2", {}, editing ? "Change it" : "Add what you might receive"), ui.form([
        { key: "from", label: "From", type: "text", placeholder: "e.g. Mom and Dad" },
        { key: "amount", label: "About how much, in today's dollars", type: "money", required: true, min: 1, max: 1e9 },
        { key: "year", label: "About when (year)", type: "number", min: 1990, max: 2150, step: "1" },
        { key: "kind", label: "In what form", type: "select", options: Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label })) },
        { key: "notes", label: "Notes", type: "text" },
      ], editing ? { ...editing } : { kind: "cash", year: (d.items[0]?.year ?? Number(fmt.today().slice(0, 4)) + 20) }, (v) => {
        const clean = { from: (v.from ?? "").trim(), amount: v.amount, year: v.year ?? null, kind: v.kind, notes: (v.notes ?? "").trim() };
        if (!(clean.amount > 0)) return false;
        pending = { word: editing ? "Changes saved." : "Added.", named: true, top: !d.items.length };
        const id = editing?.id;
        store.update((p) => {
          p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.inheritance = p.estate.inheritance ?? { items: [] }; p.estate.inheritance.items = p.estate.inheritance.items ?? [];
          if (id) { const i = p.estate.inheritance.items.findIndex((x) => x.id === id); if (i >= 0) p.estate.inheritance.items[i] = { ...p.estate.inheritance.items[i], ...clean }; }
          else p.estate.inheritance.items.push({ id: ui.uid(), ...clean });
        });
      }, { submitLabel: editing ? "Save changes" : "Add", resetAfter: !editing, onCancel: (editing || d.items.length) ? () => { editing = null; drawForm(false); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Remove it", () => {
        if (!ui.confirm("Remove this inheritance?")) return;
        const id = editing.id; editing = null;
        pending = { word: "Removed.", top: d.items.length === 1 };
        store.update((p) => { p.estate.inheritance.items = (p.estate.inheritance.items ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null].filter(Boolean));
    };
    drawForm();
    host.append(ui.card(null, out, formHost));

    // ---- one tap away: each inherited IRA's ten years, then how the page works its answer out
    let E = null;
    try { E = emptying(plan, { today: fmt.today() }); } catch { E = null; }   // the page's answer never waits on this part
    const shown = (E?.items ?? []).slice(0, EMPTYING_MAX);
    const titles = partTitles(shown);
    const thisYear = Number(fmt.today().slice(0, 4));
    const emptyPart = (e, i) => {
      const id = `empty-${e.id}`, roth = e.kind === "roth";
      const item = (plan.estate.inheritance.items ?? []).find((y) => y.id === e.id) ?? {};
      const fields = [
        { key: "pastRbd", label: "Was the person already taking required withdrawals?", type: "select", help: "Most people must start taking money out of these accounts at about age 73.",
          options: [{ value: "unsure", label: "Not sure" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
        { key: "fromBirthYear", label: "The year the person was born", type: "number", min: 1900, max: thisYear, step: "1", placeholder: "e.g. 1950", help: "With it this page can tell whether they had started, when you are not sure.", more: true },
        E.heirs.length > 1 ? { key: "heirId", label: "Which of you inherits", type: "select", options: E.heirs.map((p) => ({ value: p.id, label: p.name || "Someone in your household" })), more: true } : null,
      ].filter(Boolean);
      const form = roth ? null : ui.form(fields, { pastRbd: item.pastRbd === "yes" || item.pastRbd === "no" ? item.pastRbd : "unsure", fromBirthYear: item.fromBirthYear ?? null, heirId: e.heirId ?? E.heirs[0]?.id ?? "" }, (v) => {
        pending = { word: "Saved.", part: id }; stay.add(id);
        store.update((p) => {
          const x = (p.estate.inheritance.items ?? []).find((y) => y.id === e.id);
          if (!x) return;
          if (v.pastRbd === "yes" || v.pastRbd === "no") x.pastRbd = v.pastRbd; else delete x.pastRbd;
          if (v.fromBirthYear > 0) x.fromBirthYear = v.fromBirthYear; else delete x.fromBirthYear;
          if (v.heirId && v.heirId !== E.heirs[0]?.id) x.heirId = v.heirId; else delete x.heirId;
        });
      }, { submitLabel: "Save" });
      return { id, kind: "item", title: titles[i], says: emptyingSays(e, money, E.noIncome), set: e.set, open: said?.part === id || stay.has(id), holds: ["pastRbd", "fromBirthYear", "heirId"], body: () => [
        !roth && E.noIncome ? ui.h("p", {}, NO_INCOME, " ", ui.h("a", { href: "#/cashflow/income" }, "Add what you earn on Income"), ".") : null,
        ui.h("p", {}, emptyingSentence(e, money)),
        ui.h("ul", { class: "ih-ways" }, e.offered.map((k) => { const w = wayWords(e, k, money); return ui.h("li", {},
          ui.h("div", { class: "ih-way" }, ui.h("span", { class: "ih-t" }, w.title), ui.h("span", { class: "ih-v" }, w.value)),
          ui.h("div", { class: "ih-d" }, w.when ? `${w.detail} (${w.when})` : w.detail)); })),
        ui.h("p", { class: "muted small" }, eligibleNote(e)),
        ui.h("p", { class: "muted small" }, roth ? "This holds when the person who died first put money in a Roth IRA at least five years before the money comes out. This page shows what the rules allow; it is not tax advice." : "Federal income tax only, at this year's rates and in today's dollars, counted on top of your other income; your state may tax it too. This page shows what each way would cost; it is not tax advice."),
        roth || E.noIncome ? null : ui.h("p", { class: "muted small" }, bridgeSentence(d.items.find((y) => y.id === e.id)?.net ?? e.amount * (1 - d.taxRate), d.taxRate, money)),
        said?.part === id ? confirm(emptyingSaved(e, said.word, money)) : null,
        form,
      ] };
    };
    const folds = ui.h("div", {}, parts(ctx, ...shown.map(emptyPart), { id: "how", kind: "how", says: "sources", body: () => [
      ui.h("ul", { class: "ih-how" },
        ui.h("li", {}, "There is no federal inheritance tax; a few states tax some heirs (Estate tax lists them)."),
        ui.h("li", {}, "An inherited traditional IRA or 401(k) must usually be emptied within 10 years, and each withdrawal is taxed as income: spreading them out keeps the tax lower."),
        ui.h("li", {}, "For inherited property and shares, the tax counts what you \"paid\" as their value on the day the person died, so if you sell soon after, you owe little or no tax on the gain.")),
      ui.h("p", {}, `What arrives: money, investments and a Roth IRA count whole; a house less about 6% to sell it; a traditional IRA or 401(k) less your plan's tax rate (${Math.round(d.taxRate * 100)}%). Each one goes into savings in its year, and the plan is run again with it, with half of it, and with it ${LATER_YEARS} years later.`),
      ui.h("p", {}, `Emptying an inherited IRA: the money still inside is taken to grow ${(Math.round((E?.growth ?? 0) * 1000) / 10).toFixed(1)}% a year above inflation, as your plan expects. "Evenly" takes one tenth in the first year, one ninth of what is left in the second, and so on. "Only the yearly minimum" divides what is left by the years the IRS life expectancy table gives for the age of the one who inherits (or of the person who died, if that is longer), one year fewer each year. The tax on a year's withdrawal is your federal income tax with it minus without it: on top of this year's income while you work, and of what your plan expects once you have stopped.`),
      ui.h("p", { class: "muted small" }, "The rules: IRS Publication 590-B (2025), \"10-year rule\" and \"Eligible designated beneficiaries\"; the Treasury's final regulations on required withdrawals (July 2024, in force from 2025). Read November 13, 2026. A year's missed required withdrawal is penalized; the firm that holds the account works out the exact amount."),
    ] }));
    // a part the person shuts stops being kept open
    for (const el of folds.querySelectorAll("details")) if (stay.has(el.dataset.part)) el.addEventListener("toggle", () => { if (!el.open) stay.delete(el.dataset.part); });
    host.append(folds);
    if ((E?.items.length ?? 0) > shown.length) host.append(ui.h("p", { class: "muted small" }, `The first ${EMPTYING_MAX} inherited accounts each have a row here. The same rules hold for the ${E.items.length - shown.length === 1 ? "other one" : "others"}.`));
    host.append(ui.h("div", {}, links(ctx, [
      { href: "#/insurance/ltc", ask: "Could care in later life use it up first?", says: "Long-term care" },
      { href: "#/estate/estate-tax", ask: "Would the estate or a state tax it?", says: "Estate tax" },
      { href: "#/taxes/brackets", ask: "What does more income cost you this year?", says: "Your tax bracket" },
    ])));
  }
}
