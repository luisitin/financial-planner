// modules/retirement/contributions/view.js -- DOM only. What goes into each retirement account
// a year, with the match and the limits, and one folded form to add or edit.
import { compute } from "./compute.js";
import { PERIOD_OPTIONS } from "../../../core/math/periods.js";
import { BUCKET_OF } from "../projection/compute.js";

let pending = null;
// "Yes: add what Bo puts in" opens the add form with Bo and Bo's 401(k) already chosen
let prefill = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const accounts = (plan.accounts ?? []).filter((a) => BUCKET_OF[a.type] && BUCKET_OF[a.type] !== "cash");
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  let editing = null;
  const FIELDS = [
    { key: "accountId", label: "Into which account", type: "select", options: accounts.map((a) => ({ value: a.id, label: a.name })) },
    { key: "personId", label: "Whose", type: "select", options: [{ value: "", label: "Household" }, ...people.map((p) => ({ value: p.id, label: p.name }))] },
    { key: "amount", label: "Your own money", type: "money", required: true, min: 0, help: "each time it goes in" },
    { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS.filter((o) => o.value !== "once") },
    { key: "employerMatch", label: "Employer adds, a year", type: "money", min: 0, help: "the match or profit sharing, per year; blank for none" },
  ];

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasData ? `${fmt.money(d.totalYearly, cur)} a year into retirement accounts` : "Retirement contributions"),
    ui.h("p", { class: "lede" }, d.hasData ? `${fmt.money(d.yearly, cur)} of your own money and ${fmt.money(d.matchYearly, cur)} from employers. The Projection page adds these every year until each person retires.` : "What you put into 401(k)s, IRAs, Roths and HSAs each pay period, plus what an employer adds. The projection needs it to know how the pot grows before retirement."),
    !accounts.length ? ui.h("p", { class: "muted small" }, "First add the retirement accounts themselves on the ", ui.h("a", { href: "#/balance/net-worth" }, "Net worth page"), " (401(k), IRA, Roth, HSA, brokerage).") : null,
    d.hasData ? enoughLine() : null,
  ));
  // "are we saving enough?": the share of pay, then the plan's own answer (Will the money last?), the same one the
  // Dashboard, How am I doing? and Next best action give
  function enoughLine() {
    const st = ctx.computeOf?.("overview/setup", { today: fmt.today(), screen: "done" })?.standing ?? null;
    const inc = ctx.computeOf?.("cashflow/income", { today: fmt.today() }) ?? null;
    const pay = (inc?.active ?? []).filter((x) => x.type === "salary" || x.type === "bonus").reduce((t, x) => t + (Number(x.yearly) || 0), 0);
    const share = pay > 0 ? `That is ${Math.round((d.totalYearly / pay) * 100)}% of your pay, your employers' money included. ` : "";
    const r = st?.retire ?? null;
    const said = !st?.retirementKnown ? `Once Social Security is in the plan, this says whether that is enough.`
      : !r ? "" : r.verdict === "on track" ? "At this rate the money lasts to the end of the plan: you are on track."
      : r.verdict === "tight" ? "At this rate the money lasts, with little to spare."
      : `At this rate the money runs out${r.shortAge ? ` at about ${r.shortAge}` : ""}: saving more is the surest fix.`;
    if (!share && !said) return null;
    return ui.h("p", { class: "small" }, `${share}${said} `, ui.h("a", { href: "#/retirement/projection" }, "Will the money last? ›"));
  }
  for (const w of d.warnings) root.append(ui.notice("warn", w));
  const out = ui.h("div");
  if (pending && typeof pending === "object") {
    // an answer to the match question: say what the next move is now, from the Dashboard's own list
    const mv = ctx.computeOf?.("overview/setup", { today: fmt.today(), screen: "done" })?.standing?.moves?.[0] ?? null;
    const n = ui.notice("ok", pending.text);
    if (mv) n.append(" ", ui.h("a", { href: mv.href }, `Your next move: ${mv.title} ›`));
    out.append(n); pending = null;
  } else if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);

  // The Dashboard's next move can be "Check if Bo's job matches retirement saving": a 401(k) and pay with nothing going in.
  // One question, three answers, so the move can be done here: add what goes in, no match at that job, or an old job's 401(k).
  const nba = ctx.computeOf?.("overview/next-best-action", { today: fmt.today() });
  const ask = nba?.ready ? (nba.steps.find((s) => s.id === "match" && s.status === "check")?.ask ?? []) : [];
  const formCard = ui.card(null);
  for (const a of ask.slice(0, 1)) {
    const whose = a.name === "Me" || !a.name ? "your" : `${a.name}'s`, who = a.name === "Me" || !a.name ? "you" : a.name;
    const noPlanAnswer = () => { pending = { text: `Noted: no plan or no match at ${whose} job.` }; store.update((p) => { p.retirement.workPlans = { ...(p.retirement.workPlans ?? {}), [a.personId]: { ...(p.retirement.workPlans?.[a.personId] ?? {}), match: false } }; }); };
    // every 401(k) on file is from a job left: ask about the job now, whose plan is not in the plan yet
    if (a.newJob) {
      const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
      const old = (a.old ?? []).map((id) => (plan.accounts ?? []).find((x) => x.id === id)?.name).filter(Boolean);
      root.append(ui.h("section", { class: "card" },
        ui.h("h2", {}, `Does ${whose} job now have a retirement plan with a match?`),
        ui.h("p", {}, `${old.length ? old.join(" and ") : `${cap(whose)} 401(k)`} ${old.length > 1 ? "are" : "is"} from a job ${who === "you" ? "you" : who} left. If the job ${who === "you" ? "you have" : `${who} has`} now offers a 401(k) with a match, putting in enough to get all of it is free money.`),
        ui.h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
          ui.h("a", { class: "btn", href: "#/balance/net-worth" }, `Yes: add ${whose} new 401(k)`),
          ui.button(`No plan or no match at ${whose} job`, noPlanAnswer, { class: "secondary" })),
        ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, "Add the new 401(k) on Net worth, then come back here to add what goes in each paycheck. Not sure? The job's benefits site says whether there is a plan and a match.")));
      continue;
    }
    const acct = (plan.accounts ?? []).find((x) => x.id === a.accounts[0]);
    root.append(ui.h("section", { class: "card" },
      ui.h("h2", {}, `Does ${whose} job add money when ${who === "you" ? "you save" : `${who} saves`} for retirement?`),
      ui.h("p", {}, `${who === "you" ? "You are paid and have" : `${who} is paid and has`} ${a.accounts.length > 1 ? `${a.accounts.length} 401(k)s (${a.accounts.map((id) => (plan.accounts ?? []).find((x) => x.id === id)?.name).filter(Boolean).join(", ")})` : acct && /401/.test(acct.name ?? "") ? acct.name : `a 401(k)${acct?.name ? ` (${acct.name})` : ""}`}, but nothing goes into ${a.accounts.length > 1 ? "them" : "it"} in this plan. Many employers add money when you put some in (a match): free money worth getting in full.`),
      ui.h("div", { class: "row", style: { flexWrap: "wrap", gap: "8px" } },
        ui.button(`Yes: add what ${who === "you" ? "you put" : `${who} puts`} in`, () => {
          // the 401(k) at the job now: one whose name does not say it is an old one
          const cur = a.accounts.map((id) => (plan.accounts ?? []).find((x) => x.id === id)).filter(Boolean);
          const now = cur.find((x) => !/\b(old|former|previous|prior|rollover)\b/i.test(x.name ?? "")) ?? cur[0];
          prefill = { personId: a.personId, accountId: now?.id ?? accounts[0]?.id };
          editing = null; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" });
        }),
        ui.button(`No match at ${whose} job`, () => {
          pending = { text: `Noted: no match at ${whose} job.` };
          store.update((p) => { p.retirement.workPlans = { ...(p.retirement.workPlans ?? {}), [a.personId]: { ...(p.retirement.workPlans?.[a.personId] ?? {}), match: false } }; });
        }, { class: "secondary" }),
        // one button per 401(k) when there are several, so only the old one is marked
        ...(a.accounts.length > 1 ? a.accounts : [a.accounts[0]]).map((id) => {
          const x = (plan.accounts ?? []).find((y) => y.id === id);
          return ui.button(a.accounts.length > 1 ? `${x?.name ?? "This 401(k)"} is from a job ${who === "you" ? "you" : who} left` : `That 401(k) is from a job ${who === "you" ? "you" : who} left`, () => {
            pending = { text: `Noted: ${x?.name ?? "that 401(k)"} is from a job ${who === "you" ? "you" : who} left, so no money goes in.` };
            store.update((p) => { const y = (p.accounts ?? []).find((z) => z.id === id); if (y) y.formerJob = true; });
          }, { class: "secondary" });
        })),
      ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, "Not sure? Your pay stub or your job's benefits site shows what goes in each paycheck and what the employer adds.")));
  }
  // what was answered, so it can be taken back
  const answered = [
    ...people.filter((p) => plan.retirement?.workPlans?.[p.id]?.match === false).map((p) => ({ text: `No match at ${p.name === "Me" ? "your" : `${p.name}'s`} job`, undo: (draft) => { if (draft.retirement.workPlans?.[p.id]) delete draft.retirement.workPlans[p.id].match; } })),
    ...(plan.accounts ?? []).filter((x) => x.formerJob).map((x) => ({ text: `${x.name}: from a job left`, undo: (draft) => { const y = (draft.accounts ?? []).find((z) => z.id === x.id); if (y) delete y.formerJob; } })),
  ];
  if (answered.length) root.append(ui.card(null, ...answered.map((x) => ui.h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" } },
    ui.h("span", { class: "muted small" }, x.text),
    ui.button("Change", () => { pending = { text: "Answer taken back." }; store.update(x.undo); }, { class: "secondary small" })))));

  if (d.byPerson.some((p) => p.limits.length)) root.append(ui.card(`Against the ${d.limitsYear} limits`,
    ui.h("ul", { class: "records" }, d.byPerson.flatMap((p) => p.limits.map((l) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${p.name}: ${l.label}`), ui.h("span", { class: "rec-value" }, `${fmt.money(l.used, cur)} of ${fmt.money(l.limit, cur)}`)),
      ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.min(100, Math.round(l.used / l.limit * 100))}%`, background: l.over ? "var(--bad)" : "var(--ok)" } })),
      ui.h("div", { class: "rec-sub" }, `${l.over ? `${fmt.money(l.over, cur)} over the limit` : `${fmt.money(l.limit - l.used, cur)} of room left${l.catchUp ? `, including the catch-up allowed from ${p.age >= 60 && p.age <= 63 && l.kind === "401k" ? "60 to 63" : d.limits.kinds[l.kind]?.catchUpAge ?? 50}` : ""}`}${l.year && l.year !== d.limitsYear ? ` · ${l.year} limit` : ""}`))))),
    ui.h("p", { class: "muted small" }, "An employer's 401(k) match does not count against these; an employer's HSA money does. IRS figures; check them each January."),
  ));

  const formHost = ui.h("div");
  let showForm = !d.hasData;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!accounts.length) return;
    if (!showForm && !editing) { formHost.append(ui.button("+ Add another contribution", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    // a new contribution starts on a retirement account, not a brokerage one
    const firstRetirement = accounts.find((a) => BUCKET_OF[a.type] !== "taxable" && !a.formerJob) ?? accounts[0];
    const values = editing ? { ...editing } : { period: "monthly", personId: people.find((p) => p.role === "self")?.id ?? "", accountId: firstRetirement?.id, ...(prefill ?? {}) };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit: ${editing.accountName}` : "Add a contribution"),
      ui.form(FIELDS, values, (v) => {
        const clean = { accountId: v.accountId, personId: v.personId || "", amount: v.amount ?? 0, period: v.period, employerMatch: v.employerMatch ?? 0 };
        pending = editing ? "Contribution saved." : prefill ? { text: "Contribution added." } : "Contribution added.";
        store.update((p) => { p.retirement.contributions = p.retirement.contributions ?? []; if (editing) { const i = p.retirement.contributions.findIndex((c) => c.id === editing.id); if (i >= 0) p.retirement.contributions[i] = { ...p.retirement.contributions[i], ...clean }; } else p.retirement.contributions.push({ id: ui.uid(), ...clean }); });
        editing = null; prefill = null;
      }, { submitLabel: editing ? "Save changes" : "Add contribution", resetAfter: !editing, onCancel: (editing || d.hasData || prefill) ? () => { editing = null; prefill = null; showForm = !d.hasData; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Remove this contribution", () => { const id = editing.id; editing = null; pending = "Contribution removed."; store.update((p) => { p.retirement.contributions = (p.retirement.contributions ?? []).filter((c) => c.id !== id); }); }, { class: "danger" })) : null,
    ));
  };
  drawForm();
  if (d.items.length) root.append(ui.card("Contributions",
    ui.h("ul", { class: "page-list" }, d.items.map((c) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => { editing = plan.retirement.contributions.find((x) => x.id === c.id); editing = { ...editing, accountName: c.accountName }; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" }); },
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "ic" }, "🏦"),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.accountName), ui.h("div", { class: "d" }, `${c.personName} · ${fmt.money(c.amount, cur)} ${c.periodLabel.toLowerCase()}${c.matchYearly ? ` · employer adds ${fmt.money(c.matchYearly, cur)} a year` : ""}`)),
      ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(c.totalYearly, cur)), ui.h("div", { class: "muted small" }, "a year"))))),
  ));
  formCard.append(formHost);
  root.append(formCard);
}
