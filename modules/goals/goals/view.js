// modules/goals/goals/view.js -- DOM only. Totals, a tappable list of goals with progress
// bars, one form to add or edit.
import { compute, PRIORITIES, GOAL_ICONS, plannerFor, plannerFigure, plannerDiffers } from "./compute.js";
import { goalsBehind } from "../../overview/alerts/compute.js";

const FIELDS = (accounts) => [
  { key: "name", label: "What are you saving for", type: "text", required: true, placeholder: "e.g. Emergency fund" },
  { key: "target", label: "Amount needed", type: "money", required: true, min: 0, help: "in today's dollars" },
  { key: "targetDate", label: "By when", type: "date", help: "leave blank if there is no deadline" },
  { key: "icon", label: "Icon", type: "select", options: GOAL_ICONS },
  { key: "priority", label: "How important", type: "select", options: Object.entries(PRIORITIES).map(([value, label]) => ({ value, label })) },
  { key: "saved", label: "Already set aside", type: "money", min: 0, help: "cash you have earmarked, if it is not in an account below" },
  { key: "accountId", label: "Account it is saved in", type: "select", options: [{ value: "", label: "None / not tracked" }, ...accounts.map((x) => ({ value: x.id, label: x.name }))], help: "that account's balance counts toward the goal" },
  { key: "monthly", label: "Putting in each month", type: "money", min: 0, help: "what you add now; the page tells you if it is enough" },
  { key: "rate", label: "Growth per year", type: "percent", min: 0, max: 50, help: "between 0 and 50; leave blank to use the plan's figure for the time left" },
  { key: "inflates", label: "Grow the amount with inflation until then", type: "checkbox" },
];

// A new goal needs a name and an amount: the rest folds under "More details (optional)" just above the button (F5: ten boxes
// before "Add goal", 1.6 screens down). Open when editing a goal, or when any of them holds something.
const MORE = ["icon", "priority", "saved", "accountId", "monthly", "rate", "inflates"];
function foldMore(ui, form, open) {
  const labels = MORE.map((k) => form.querySelector(`[name="${k}"]`)?.closest("label")).filter(Boolean);
  const actions = form.querySelector(".form-actions");
  if (!labels.length || !actions) return;
  const more = ui.h("details", { class: "fold", style: { margin: "4px 0 12px" }, ...(open ? { open: "" } : {}) },
    // a short summary that fits 320 px; the boxes inside keep the form's own spacing
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "More details (optional)"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body", style: { display: "grid", gap: "14px", paddingTop: "8px" } }, ...labels));
  form.insertBefore(more, actions);
  // a box in it that the browser refuses (a growth of 80) opens the fold, so its message is not hidden
  form.addEventListener("invalid", () => { more.open = true; }, true);
}
// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;



export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const accounts = plan.accounts ?? [];
  let editing = null;
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  // A goal whose account is gone: the warning names the goal as a tap that opens its form.
  const broken = new Set((plan.goals ?? []).filter((g) => (g.fundedBy ?? []).some((id) => !accounts.some((a) => a.id === id))).map((g) => g.id));
  // what the goal's own page works out, when it works it out for this goal: { amount (today's dollars, as the goal's
  // "Amount needed"), words, monthly }; null when that page has no figure for it
  const memo = new Map();
  const of = (page) => { if (!memo.has(page)) { let r = null; try { r = ctx.computeOf?.(page, { today: fmt.today() }) ?? null; } catch { r = null; } memo.set(page, r); } return memo.get(page); };
  const figureOf = (g, gr) => { const pl = plannerFor(g); return pl ? plannerFigure(g, gr, pl.page, of(pl.page), plan) : null; };
  const differs = plannerDiffers;
  const openGoal = (id) => { editing = plan.goals.find((y) => y.id === id); showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); };
  // bills Next best action pays from savings (due within 3 months, more than a month can save, the cash covers it; review UX 1):
  // not a month's saving here either
  const nbaNow = d.count ? of("overview/next-best-action") : null;
  const fromCash = new Map(((nbaNow?.ready ? nbaNow.steps.find((x) => x.id === "goals")?.fromCash : null) ?? []).map((x) => [x.id, x]));
  const cashMonthly = d.goals.filter((g) => fromCash.has(g.id)).reduce((t, g) => t + (Number(g.neededMonthly) || 0), 0);
  // a passed date the goal's own page has a figure for (Education's next bill for a child in college; round 8 verify, UX 4's
  // rest): that figure, on the row's link, is what is due, so the goal's whole amount ("$103,000 is due now") is not said
  const lateFigure = (g) => { if (g.status !== "past due") return null; const f = figureOf((plan.goals ?? []).find((y) => y.id === g.id) ?? g, g); return f && f.amount > 0 ? f : null; };
  const dueNowSaid = d.goals.filter((g) => g.status === "past due" && g.dueNow > 0 && !lateFigure(g)).reduce((t, g) => t + g.dueNow, 0);

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What are you saving for?"),
      ui.h("p", { class: "lede" }, "A goal is an amount by a date: an emergency fund, a house down payment, a car, a trip, college. The plan tells you what to put aside each month to get there and whether you are on track."),
      ui.h("p", { class: "muted small" }, "A good first goal is an emergency fund: three to six months of the bills you must pay."),
    ));
  } else {
    root.append(ui.card(null, ui.row(
      ui.stat("Goals", String(d.count), d.done ? `${d.done} reached` : "none reached yet"),
      ui.stat("Saved so far", fmt.money(d.totalFunded, cur), `of ${fmt.money(d.totalTarget, cur)} in total`),
      ui.stat("Needed each month", fmt.money(Math.max(0, d.neededMonthly - cashMonthly), cur), [
        d.dueNow > 0 ? (dueNowSaid > 0 ? `for the goals still ahead; ${fmt.money(dueNowSaid, cur)} is due now on goals whose date has passed` : "for the goals still ahead; a goal's date has passed (below)") : d.contributing ? `you are putting in ${fmt.money(d.contributing, cur)}` : "to reach every dated goal on time",
        fromCash.size ? `; bills due soon (${fmt.money([...fromCash.values()].reduce((t, x) => t + x.amount, 0), cur)}) come from savings` : ""].join("")),
    )));
  }
  for (const w of d.warnings) {
    const g = w.includes("no longer exists") ? (plan.goals ?? []).find((x) => broken.has(x.id) && w.startsWith(x.name)) : null;
    if (g) root.append(ui.h("div", { class: "notice warn" }, ui.h("a", { href: "#goal", onClick: (e) => { e.preventDefault(); openGoal(g.id); } }, g.name), w.slice(g.name.length), " Tap it to pick another."));
    else root.append(ui.notice("warn", w));
  }

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = d.count === 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) {
      formHost.append(ui.button("+ Add another goal", () => { showForm = true; drawForm(); }, { class: "secondary" }));
      return;
    }
    const values = editing ? { ...editing, accountId: editing.fundedBy?.[0] ?? "", inflates: editing.inflates !== false, priority: String(editing.priority ?? 2) } : { icon: "🎯", priority: "2", inflates: true, accountId: "" };
    const goalForm = ui.form(FIELDS(accounts), values, (v) => {
        const clean = { name: v.name.trim(), icon: v.icon || "🎯", target: v.target ?? 0, targetDate: v.targetDate || "", priority: Number(v.priority) || 2, saved: v.saved ?? 0, fundedBy: v.accountId ? [v.accountId] : [], monthly: v.monthly ?? 0, rate: v.rate ?? null, inflates: !!v.inflates };
        if (!clean.name) return;
        pending = editing ? "Changes saved." : `${clean.name} added.`;
        store.update((p) => {
          p.goals = p.goals ?? [];
          if (editing) { const i = p.goals.findIndex((x) => x.id === editing.id); if (i >= 0) p.goals[i] = { ...p.goals[i], ...clean }; }
          else p.goals.push({ id: ui.uid(), ...clean });
        });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add goal", resetAfter: !editing, onCancel: (editing || d.count > 0) ? () => { editing = null; showForm = false; drawForm(); } : null });
    foldMore(ui, goalForm, !!editing);
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.name}` : "Add a goal"),
      goalForm,
      (() => {
        if (!editing) return null;
        const gr = d.goals.find((x) => x.id === editing.id), f = figureOf(editing, gr), pl = plannerFor(editing);
        if (!differs(editing, f)) return pl ? ui.h("p", { class: "muted small", style: { marginTop: "12px" } }, f?.note ? `${f.note} ` : "", ui.h("a", { href: `#/${pl.page}` }, `${f?.note ? "Open" : "Work out what it costs on"} ${pl.label} ›`)) : null;
        const to = Math.round(f.amount / 10) * 10;
        const dollars = editing.inflates === false ? "in the dollars of its date" : "in today's dollars";
        const note = ui.h("p", { class: "small", style: { margin: "8px 0 0" } });
        return ui.h("div", { class: "notice info", style: { marginTop: "12px" } },
          ui.h("p", { style: { margin: 0 } }, `The ${pl.label} page puts it at ${fmt.money(f.shown ?? f.amount, cur)} ${f.words}${f.monthly ? ` (${fmt.money(f.monthly, cur)} a month)` : ""}; this goal counts ${fmt.money(Number(editing.target) || 0, cur)} ${dollars}.`),
          // the figure goes into the form's own box, so whatever else was typed is saved with it by Save changes
          ui.h("div", { style: { marginTop: "8px" } }, ui.button(`Use ${fmt.money(to, cur)} from ${pl.label}`, () => {
            const box = formHost.querySelector('input[name="target"]');
            if (!box) return;
            box.value = to.toLocaleString("en-US"); box.dispatchEvent(new Event("input", { bubbles: true })); box.dispatchEvent(new Event("change", { bubbles: true }));
            box.focus(); box.scrollIntoView({ behavior: "smooth", block: "center" });
            note.textContent = `${fmt.money(to, cur)} is in Amount needed: tap Save changes to keep it.`;
          }, { class: "secondary" })), note);
      })(),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
        if (!ui.confirm(`Remove the goal ${editing.name}?`)) return;
        const id = editing.id; const name = editing.name; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.goals = (p.goals ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  if (d.count > 0) {
    // a goal with nothing going in whose turn Next best action gives later is waiting, not behind (alerts' goalsBehind)
    const gb = goalsBehind(d, { nba: ctx.computeOf?.("overview/next-best-action", { today: fmt.today() }) ?? null, today: fmt.today() });
    const waiting = new Set(gb.queued.map((g) => g.id));
    const turn = gb.turn ? new Date(`${gb.turn}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";
    const pill = (g) => waiting.has(g.id) ? ["", "starts later"] : fromCash.has(g.id) ? ["", "from savings"] : ({ done: ["ok", "reached"], "on track": ["ok", "on track"], behind: ["warn", "behind"], "past due": ["warn", "date passed"], "no date": ["", "no date"], "no amount": ["warn", "no amount"] })[g.status] ?? ["", g.status];
    const sub = (g) => {
      // the amount as typed first; what rising prices make it by the date after (a typed $30,000 read as "$0 of $32,782")
      const grown = g.targetThen > g.target * 1.005 && g.targetDate;
      const bits = [`${fmt.money(g.funded, cur)} of ${fmt.money(g.target, cur)}`];
      if (g.targetDate) bits.push(grown ? `about ${fmt.money(Math.round(g.targetThen / 100) * 100, cur)} by ${fmt.date(g.targetDate)} with rising prices` : `by ${fmt.date(g.targetDate)}`);
      if (waiting.has(g.id)) bits.push(`its turn comes in ${turn}, after the steps before it on Next best action`);
      else if (fromCash.has(g.id)) bits.push("paid from savings when it is due (Next best action)");
      else if (g.status === "behind" || g.status === "on track") bits.push(`needs ${fmt.money(g.neededMonthly, cur)} a month${g.status === "behind" && g.monthly > 0 ? `; you put in ${fmt.money(g.monthly, cur)}` : ""}`);
      // a date that has passed: what is left is due now, not a month's saving (round 8 item 18)
      else if (g.status === "past due" && g.dueNow > 0 && !lateFigure(g)) bits.push(`due now: ${fmt.money(g.dueNow, cur)}`);
      if (g.fundedFrom.length) bits.push(`in ${g.fundedFrom.join(", ")}${g.sharedWith.length ? ` (shared with ${g.sharedWith.join(", ")})` : ""}`);
      return bits.join(" · ");
    };
    const plans = new Map((plan.goals ?? []).map((x) => [x.id, x]));
    const order = { "past due": 0, behind: 1, "on track": 2, "no date": 3, "no amount": 4, done: 5 };
    const rows = [...d.goals].sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2) || order[a.status] - order[b.status]);
    root.append(ui.card("Your goals",
      ui.h("ul", { class: "page-list" }, rows.map((g) => { const [k, t] = pill(g); return ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
        onClick: () => openGoal(g.id),
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, g.icon || "🎯"),
        ui.h("span", { class: "body" },
          ui.h("div", { class: "t" }, g.name, " ", ui.h("span", { class: `pill ${k}` }, t), g.priority === 1 ? ui.h("span", { class: "pill" }, "must have") : null, broken.has(g.id) ? ui.h("span", { class: "pill warn" }, "check account") : null),
          ui.h("div", { class: "d" }, sub(g)),
          ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(g.progress * 100)}%` } })),
          // the costing page is the row's last line, under the bar with clear space above it: in the middle of the row a tap
          // meant for the goal went to the link (F4)
          (() => { const pl = plannerFor(g); if (!pl) return null; const f = figureOf(plans.get(g.id) ?? g, g); const say = differs(plans.get(g.id) ?? g, f) ? `The ${pl.label} page puts it at ${fmt.money(f.shown ?? f.amount, cur)} ${f.words} ›` : `What it costs: ${pl.label} ›`;
            return ui.h("a", { class: "small", href: `#/${pl.page}`, style: { display: "inline-flex", alignItems: "center", marginTop: "8px", minHeight: "44px" }, onClick: (e) => e.stopPropagation() }, say); })()),
        ui.h("span", { class: "st muted" }, "Edit ›"),
      ); })),
      ui.h("p", { class: "muted small" }, "Tap a goal to change it. \"Needs\" is what to put in each month from now on, assuming the money grows at the plan's rate for that time frame."),
      out, formHost,
    ));
  } else {
    formCard.append(out, formHost);
    root.append(formCard);
  }
}
