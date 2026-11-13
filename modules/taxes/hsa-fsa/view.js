// modules/taxes/hsa-fsa/view.js -- DOM only. Simple first (docs/OPTIONAL.md): one sentence that says what the HSA does for
// you this year (one written case each, answerFor), the alarms and the FSA deadline; then the parts, rows of one card:
// the figures behind the answer, this year's figures (the form), the receipts to pay yourself back later (gap #16), and
// how it is worked out with why an HSA comes first; then "More on this".
import { compute, roomSaving } from "./compute.js";
import { isYou, nameIn, NameIn, NameOf } from "../../../core/words.js";
import { dueDay } from "../../household/calendar/compute.js";
import { part, parts, links } from "../../../core/ui/more.js";
// the April deadline for a tax year, moved past a weekend or holiday as the IRS moves it ("April 15, 2027"; "April 18, 2028")
const filingDeadline = (year) => new Date(`${dueDay(`${year + 1}-04-15`)}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

let pending = null;    // the green line for the next draw: { part (the part that was saved stays open, R17), say(d, answer) }
let adding = false;    // the add-a-receipt form is open (a list with receipts folds it behind "+ Add another receipt")
let editing = null;    // the id of the receipt whose form is open

const COVER_LABEL = { none: "no high-deductible plan", self: "self-only coverage", family: "family coverage" };

/**
 * answerFor(d, money, { roomSaves, hasAccount, figures }) -> { key, title, lede }: the headline and the sentence under it,
 * one written case each (docs/OPTIONAL.md R3 to R5). d is compute()'s answer; roomSaves what putting the room in would save
 * (roomSaving); hasAccount: an HSA account is on the Net worth page; figures: the title of the part that holds the form.
 */
export function answerFor(d, money, { roomSaves = 0, hasAccount = false, figures = "This year's figures" } = {}) {
  const H = d.hsa;
  const saves = H.savedTotal >= 1;
  // the saving is worked on the household's own money (the employer's goes in tax-free either way), so the sentence names that money
  const now = H.employer > 0.005 ? `What you put in now, ${money(H.contribution)},` : `What goes in now, ${money(H.total)},`;
  const bossOnly = H.employer > 0.005 && !(H.contribution > 0.005);
  // everyone the cover is for is on Medicare all year: nothing can go in, whether or not something is typed
  if (H.limit === 0 && H.coverage !== "none" && H.people.some((p) => p.eligible && p.medicareMonths >= 12)) return { key: "medicare",
    title: "Once you're on Medicare you can't add to an HSA",
    lede: H.total > 0 ? `The ${money(H.total)} typed for ${d.year} is too much and gets no tax break, so it saves nothing. You can still spend what is in the account on medical bills, tax-free.` : "You can still spend what is in the account on medical bills, tax-free." };
  if (H.total > 0 && H.coverage === "none") return { key: "noPlanMoney",
    title: "HSA money needs a high-deductible health plan",
    lede: `You said you have no high-deductible health plan, so the ${money(H.total)} going into an HSA for ${d.year} saves no tax. If you do have such a plan, change the coverage under "${figures}".` };
  if (H.coverage === "none") return { key: "noPlan",
    title: "Without a high-deductible health plan, no money can go into an HSA",
    lede: `Money already in an HSA can still pay medical bills tax-free. If you pick such a plan, change the coverage under "${figures}".` };
  if (H.over > 0.005) return { key: "over",
    title: `You are putting ${money(H.over)} more in your HSA than the ${d.limitsYear} limit allows`,
    lede: saves ? `What fits within the limit saves you about ${money(H.savedTotal)} of tax. Take the extra out before the tax filing deadline.` : "Take the extra out before the tax filing deadline." };
  if (H.total > 0 && H.room > 0.005 && roomSaves >= 1) return { key: "room",
    title: `You could put ${money(H.room)} more in your HSA this year and save about ${money(roomSaves)} of tax`,
    lede: bossOnly ? `Your employer puts in ${money(H.employer)}, tax-free.` : saves ? `${now} saves you about ${money(H.savedTotal)}.` : `${now} saves no tax at this income.` };
  if (H.total > 0 && H.room > 0.005) return { key: "roomNoSaving",
    title: `You have ${money(H.room)} of room left in your HSA this year`,
    lede: saves ? `${now} saves you about ${money(H.savedTotal)}; more would save no tax at this income.` : "At this income it saves no tax now, but it grows untaxed for medical bills." };
  if (H.total > 0) return { key: "full",
    title: saves ? `Your HSA is full for ${d.limitsYear} and saves you about ${money(H.savedTotal)} of tax` : `Your HSA is full for ${d.limitsYear}`,
    lede: saves ? `${money(H.total)} goes in, the most allowed this year.` : bossOnly ? `Your employer puts in ${money(H.total)}, the most allowed this year, tax-free.` : `${money(H.total)} goes in, the most allowed; at this income it saves no tax now, but it grows untaxed for medical bills.` };
  if (hasAccount && roomSaves >= 1) return { key: "startHsa",
    title: `You could put up to ${money(H.room)} in your HSA this year and save about ${money(roomSaves)} of tax`,
    lede: "That needs a high-deductible health plan this year. Type what goes in below." };
  return { key: "start",
    title: "An HSA can cut your tax three ways",
    lede: `With a high-deductible health plan you can put up to ${money(H.limit)} in ${d.limitsYear} into a health savings account: no tax going in, while it grows, or when it pays medical bills. Type what goes in below.` };
}

export function render(page, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), iraAsAssumed: false });
  const money = (n) => fmt.money(n, cur);
  // a receipt keeps its cents ($45.50); a whole amount reads without them
  const cents = (n) => fmt.money(n, cur, "en-US", Math.abs(Math.round(Number(n) * 100) % 100) > 0 ? 2 : 0);
  const H = d.hsa, F = d.fsa;
  const noCover = H.coverage === "none";
  const hasAccount = (plan.accounts ?? []).some((a) => a.type === "hsa");
  const room = roomSaving(plan, { today: fmt.today(), iraAsAssumed: false }, d);
  // the receipts part is there for a household with an HSA (gap #16); the form's part is named for what it holds when it
  // sits beside it, else it takes the vocabulary's "The figures" (docs/OPTIONAL.md R24)
  const R = d.receipts ?? null;
  const rows = R?.list ?? [];
  const withReceipts = d.hasHsa || hasAccount || rows.length > 0;
  const onMedicare = answerFor(d, money).key === "medicare";
  const figuresTitle = !withReceipts ? "The figures" : onMedicare ? "Change what you typed" : "This year's figures";
  const ans = answerFor(d, money, { roomSaves: room.saves, hasAccount, figures: figuresTitle });
  const redraw = () => ctx.redraw?.();
  const root = ui.h("div", { class: "hsa-root" });
  page.append(root);

  // 1. the answer, 2. the confirmation of the last save, 3. the alarms and the FSA deadline (never folded, R9)
  root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, ans.title), ui.h("p", { class: "lede" }, ans.lede)));
  const said = pending; pending = null;
  const green = said ? said.say(d, ans) : null;
  if (green && said.part !== "receipts") { const n = ui.notice("ok", green); root.append(n); setTimeout(() => n.remove(), 4000); }
  for (const n of d.notes) root.append(ui.notice("warn", n));
  // a bill from before the HSA marked paid back: the HSA paid out for something it may not (Pub. 969), an alarm (R9)
  const early = d.receipts?.beforePaid ?? { n: 0 };
  if (early.n > 0) root.append(ui.notice("warn", `${early.n} receipt${early.n === 1 ? "" : "s"} (${cents(early.amount)}) from before you opened the HSA on ${fmt.date(d.receipts.openedOn)} ${early.n === 1 ? "is" : "are"} marked paid back. Money the HSA paid out for ${early.n === 1 ? "it" : "them"} is taxed as income, plus an extra 20% unless you were 65 or older or disabled. If a date is wrong, fix it under "Receipts to pay back".`));
  if (d.hasFsa && F.unspent > 0) root.append(ui.notice(F.daysLeft !== null && F.daysLeft < 90 ? "warn" : "info",
    `${money(F.unspent)} of your FSA is not spent yet${F.daysLeft !== null ? `, with ${F.daysLeft} days left in ${d.year}` : ""}. What is not spent by December 31 is lost, unless your plan allows a grace period to mid-March or a carryover of up to ${money(F.carryover)}.${F.daysLeft !== null && F.daysLeft < 90 ? " Glasses, dental work, prescriptions and first-aid supplies all count." : ""}`));
  // on Medicare nothing can go in: what she can still do comes first, the form stays folded (to fix what was typed) and the
  // case for saving into an HSA is left out (money review UX 3: the widow was still sold one under the headline telling her she cannot)
  if (onMedicare) root.append(ui.card("What you can still do", ui.h("ul", { class: "records" }, [
    ["Spend what is in the account", `Pay medical bills from it, tax-free. Keep the receipts${withReceipts ? ` under "Receipts to pay back" below` : ""}.`],
    ...(H.total > 0 ? [["Take out what was added this year", `The ${money(H.total)} typed for ${d.year} cannot stay in. Take it out before the tax filing deadline to avoid a 6% charge each year, then type 0 under "Change what you typed" below.`]] : []),
  ].map(([t, x]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, x))))));

  // ---------------------------------------------------------------- part: the figures behind the answer ("N more numbers")
  const coveredName = H.coverage === "self" && H.people.length > 1 ? H.people.find((p) => p.eligible)?.name : null;
  const coverText = `${COVER_LABEL[H.coverage]}${coveredName ? ` for ${nameIn(coveredName)}` : ""}`;
  const ssLimit = Number.isFinite(d.wageBase) ? `${money(d.wageBase)} in ${d.year}` : "";
  const taxSub = H.ficaSaved > 0 || H.taxSaved > 0 ? `${money(H.taxSaved)} income tax + ${money(H.ficaSaved)} payroll tax` : noCover ? "none without a high-deductible plan" : onMedicare ? "none: on Medicare nothing can go in" : H.total > 0 ? "none: no income tax to save at this income" : "nothing going in this year";
  const tiles = [
    ui.stat(`${d.limitsYear} limit`, money(H.limit), `${coverText}${H.catchUp ? ", with catch-up" : ""}`),
    ui.stat("Room left", money(H.room), H.total > 0 ? `${money(H.total)} in so far` : "nothing in yet"),
    // nothing in and no balance yet: no zero tiles, the hero says what to do first
    H.total > 0 || H.balance > 0 ? ui.stat("Tax saved", money(H.savedTotal), taxSub) : null,
    // "At 65" only for someone not yet 65 (follow-up 2026-11-07, HSA R3: a 74-year-old read "At 65"); then what is in the account today
    H.years > 0 && (H.kept > 0 || H.balance > 0) ? ui.stat("At 65", money(H.atSixtyFive), `${H.years} years at ${fmt.pct(H.growthRate, 1)}: ${money(H.balance)} today plus ${money(H.kept)} a year`)
      : H.balance > 0 ? ui.stat("In the account", money(H.balance), "today, for medical bills") : null,
  ].filter(Boolean);
  const fsaTiles = d.hasFsa ? [
    ui.stat("Elected", money(F.election), F.people.filter((x) => x.election > 0).length > 1 ? `${F.people.filter((x) => x.election > 0).map((x) => `${x.name} ${money(x.election)}`).join(", ")}; limit ${money(F.limit)} each` : `limit ${money(F.limit)}`),
    ui.stat("Unspent", money(F.unspent), F.daysLeft !== null ? `${F.daysLeft} days left in ${d.year}` : ""),
    ui.stat("Tax saved", money(F.taxSaved), "income and payroll tax"),
  ] : [];
  // the numbers are worth a row only when something goes in, the account holds money, or there is an FSA (otherwise the
  // headline already says the limit)
  const numbersPart = H.total > 0 || H.balance > 0 || d.hasFsa ? { id: "numbers", kind: "more", n: tiles.length + fsaTiles.length, noun: "numbers", body: () => [
    H.total > 0 ? ui.h("p", {}, `${money(H.total)} goes in for ${d.year} (${money(H.contribution)} from you${H.employer ? `, ${money(H.employer)} from the employer` : ""}) against a limit of ${money(H.limit)}${H.catchUp ? " including the catch-up from 55" : ""}: ${H.room > 0 ? `${money(H.room)} of room left` : H.over > 0 ? `${money(H.over)} over` : "the limit exactly"}.`) : null,
    tiles.length ? ui.row(...tiles) : null,
    H.kept > 0 && H.years > 0 ? ui.h("p", {}, `Kept invested, this year's money alone is worth about ${money(H.futureValue > 0 ? H.kept * Math.pow(1 + H.growthRate, H.years) : H.kept)} at 65, untaxed if it pays for health costs.`) : null,
    H.aboveWageBase.length ? ui.h("p", { class: "muted small" }, `${H.aboveWageBase.map((x, i) => (i ? nameIn(x) : NameIn(x))).join(" and ")} ${H.aboveWageBase.length > 1 || isYou(H.aboveWageBase[0]) ? "earn" : "earns"} more than the Social Security pay limit (${ssLimit}). Pay above it has no Social Security tax, so HSA money from that pay saves only the 1.45% Medicare tax, not the full 7.65%.`) : null,
    fsaTiles.length ? ui.h("h3", {}, "Flexible spending account") : null,
    fsaTiles.length ? ui.row(...fsaTiles) : null,
    d.hasFsa && F.unspent <= 0 ? ui.h("p", { class: "small" }, "All spent: nothing to lose at year end.") : null,
  ] } : null;

  // ---------------------------------------------------------------- part: this year's figures (the form)
  const h = plan.taxes?.hsa ?? {};
  const adults = H.people.filter((p) => p.id !== null);
  const meAdult = adults.find((p) => p.role === "self") ?? adults[0], partnerName = adults.find((p) => p !== meAdult)?.name ?? "Partner";
  const FIELDS = [
    { key: "coverage", label: "Health plan for the HSA", type: "select", options: [{ value: "self", label: "High-deductible, self-only" }, { value: "family", label: "High-deductible, family" }, { value: "none", label: "No high-deductible plan" }], help: "only a high-deductible health plan allows an HSA" },
    adults.length > 1 ? { key: "coveredId", label: "Who the plan covers", type: "select", options: adults.map((p) => ({ value: p.id, label: p.name })), help: "with self-only coverage only this person can have an HSA" } : null,
    { key: "contribution", label: "You put in this year", type: "money", min: 0, help: "your own money for the year, from pay" },
    { key: "employer", label: "Employer puts in", type: "money", min: 0, help: "counts against the same limit" },
    { key: "fsa", label: adults.length > 1 ? `${NameOf(meAdult?.name)} FSA election this year` : "FSA election this year", type: "money", min: 0, more: true, help: "leave blank if you have no FSA" },
    adults.length > 1 ? { key: "fsaPartner", label: `${NameOf(partnerName)} FSA election this year`, type: "money", min: 0, more: true, help: "through their own employer; each person can put in up to the limit" } : null,
    { key: "fsaSpent", label: "FSA spent so far", type: "money", min: 0, more: true },
  ].filter(Boolean);
  const coveredNow = H.coveredId ?? adults.find((p) => p.role === "self")?.id ?? adults[0]?.id ?? "";
  const form = ui.form(FIELDS, { coverage: H.coverage, coveredId: coveredNow, contribution: h.contribution || null, employer: h.employer || null, fsa: h.fsa || null, fsaPartner: h.fsaPartner || null, fsaSpent: h.fsaSpent || null }, (v) => {
    // the green line names the new answer when the headline changed (R7)
    const was = ans.title;
    pending = { part: "figures", say: (_, now) => (now.title !== was ? `Saved. ${now.title}.` : "Saved.") };
    store.update((p) => { p.taxes.hsa = { ...(p.taxes.hsa ?? {}), coverage: v.coverage, ...(v.coveredId ? { coveredId: v.coveredId } : {}), contribution: v.contribution ?? 0, employer: v.employer ?? 0, fsa: v.fsa ?? 0, ...(adults.length > 1 ? { fsaPartner: v.fsaPartner ?? 0 } : {}), fsaSpent: v.fsaSpent ?? 0 }; });
  }, { submitLabel: "Save" });
  // "Who the plan covers" matters only for self-only cover: shown while that is the choice
  const coverSelect = form.querySelector?.('select[name="coverage"]'), whoField = form.querySelector?.('select[name="coveredId"]')?.closest(".field");
  if (coverSelect && whoField) { const sync = () => { whoField.style.display = coverSelect.value === "self" ? "" : "none"; }; coverSelect.addEventListener("change", sync); sync(); }
  const typed = ["contribution", "employer", "fsa", "fsaPartner", "fsaSpent"].some((k) => Number(h[k]) > 0);
  const figuresPart = { id: "figures", kind: withReceipts ? "own" : "figures", title: figuresTitle,
    holds: FIELDS.map((f) => f.key), set: typed || noCover, says: H.total > 0 ? money(H.total) : "", missing: !typed && !noCover && !onMedicare,
    // open while nothing is typed (the page asks first, R8); shut once anything is set
    open: said?.part === "figures" || (!onMedicare && !typed && !noCover && !d.hasFsa), body: [form] };

  // ---------------------------------------------------------------- part: receipts to pay yourself back later (gap #16)
  const receiptsPart = withReceipts ? receiptsBody() : null;
  function receiptsBody() {
    const status = R && R.waiting > 0 ? cents(R.canPayBack) : rows.some((r) => r.counts) ? "all paid back" : "none yet";
    const body = [];
    if (green && said.part === "receipts") { const n = ui.notice("ok", green); body.push(n); setTimeout(() => n.remove(), 4000); }
    body.push(ui.h("p", {}, "Paid a medical bill from your own pocket? Keep the receipt. You can pay yourself back from the HSA, tax-free, at any time, even years from now, and the money stays invested until then."));
    if (R && R.waiting > 0) {
      body.push(ui.h("p", {}, ui.h("strong", {}, `You can pay yourself back ${cents(R.canPayBack)} tax-free${R.openedOn ? "" : ", if paid after you opened the HSA"}.`)));
      body.push(ui.h("p", {}, `Left invested ${R.years} years at your plan's return, ${cents(R.canPayBack)} grows to about ${money(R.grows)} in today's dollars, and you can still pay yourself back the ${cents(R.canPayBack)} tax-free whenever you like.`));
    }
    const notYet = R ? { n: R.before.n - R.beforePaid.n, amount: R.before.amount - R.beforePaid.amount } : { n: 0 };
    if (notYet.n > 0) body.push(ui.h("p", {}, `${notYet.n} receipt${notYet.n === 1 ? "" : "s"} (${cents(notYet.amount)}) ${notYet.n === 1 ? "is" : "are"} from before you opened the HSA on ${fmt.date(R.openedOn)}, so the HSA cannot pay ${notYet.n === 1 ? "it" : "them"} back tax-free.`));
    // the list: the money waiting first (newest first), then bills from before the HSA, then the ones paid back
    const order = (r) => (r.paidBack ? 2 : r.before ? 1 : 0);
    const sorted = [...rows].sort((a, b) => order(a) - order(b) || String(b.date ?? "").localeCompare(String(a.date ?? "")));
    if (sorted.length) body.push(ui.h("ul", { class: "records" }, sorted.map((r) => (r.id !== null && r.id === editing ? ui.h("li", {}, receiptForm(r)) : receiptRow(r)))));
    if (!sorted.length || adding) body.push(receiptForm(null));
    else if (editing === null) body.push(ui.row(ui.button("+ Add another receipt", () => { adding = true; editing = null; redraw(); }, { class: "secondary" })));
    body.push(openedForm());
    return { id: "receipts", kind: "own", title: "Receipts to pay back", says: status, fix: R?.beforePaid.n ?? 0, holds: ["date", "amount", "what", "proof", "openedOn"],
      open: said?.part === "receipts" || adding || editing !== null, body };
  }
  function receiptRow(r) {
    const pill = r.paidBack && r.before ? ui.h("span", { class: "pill warn" }, "Paid back, but from before the HSA")
      : r.paidBack ? ui.h("span", { class: "pill ok" }, r.reimbursedOn ? `Paid back ${fmt.date(r.reimbursedOn)}` : "Paid back")
      : r.before ? ui.h("span", { class: "pill warn" }, "Before the HSA") : null;
    return ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.what || "Medical bill"), ui.h("span", { class: "rec-value" }, cents(r.amount))),
      ui.h("div", { class: "rec-sub" }, `Paid ${r.date ? fmt.date(r.date) : "on a day not given"}${r.proof ? ` · receipt: ${r.proof}` : ""}`),
      pill ? ui.h("div", { class: "rec-sub" }, pill) : null,
      ui.h("div", { class: "rec-foot" },
        r.before && !r.paidBack ? null : ui.button(r.paidBack ? "Not paid back yet" : "Mark paid back", () => markPaid(r, !r.paidBack), { class: "secondary small" }),
        ui.button("Change", () => { editing = r.id; adding = false; redraw(); }, { class: "secondary small" })));
  }
  // what is left to pay back, said after every change to the list
  const left = (dd) => (dd.receipts?.canPayBack > 0 ? `You can pay yourself back ${cents(dd.receipts.canPayBack)} in all.` : "Nothing is waiting to be paid back.");
  function markPaid(r, paid) {
    const day = fmt.today();
    // one tap stamps today; the green line says so and where another day is set (the row's Change, whose form shows the day)
    pending = { part: "receipts", say: (dd) => (paid ? `Marked paid back today: ${r.what || "the bill"}, ${cents(r.amount)}. Paid back on another day? Tap Change to set it.` : `${r.what || "The bill"} is waiting to be paid back again.`) + ` ${left(dd)}` };
    store.update((p) => { const x = (p.taxes.hsa.receipts ?? []).find((q) => q.id === r.id); if (!x) return; if (paid) x.reimbursedOn = day; else delete x.reimbursedOn; });
  }
  function receiptForm(r) {
    const fields = [
      // the three boxes a receipt needs are asked for at Save (ui.fieldError), not marked required: the form sits in a part a
      // person opens only to keep receipts, and nothing else on the page needs them (docs/OPTIONAL.md R9 item 9)
      { key: "date", label: "Date paid", type: "date", max: "today" },
      { key: "amount", label: "Amount", type: "money", min: 0.01 },
      { key: "what", label: "What it was for", placeholder: "For example: dentist" },
      { key: "proof", label: "Where the receipt is kept", placeholder: "For example: photo in a Receipts album" },
      { key: "reimbursedOn", label: "Paid back on", type: "date", max: "today", more: true, help: "leave blank until the HSA pays you back" },
    ];
    const f = ui.form(fields, r ? { date: r.date ?? "", amount: r.amount, what: r.what, proof: r.proof, reimbursedOn: r.reimbursedOn ?? "" } : {}, (v) => {
      const box = (k) => f.querySelector?.(`[name="${k}"]`);
      if (!v.date) return ui.fieldError(box("date"), "Type the day you paid the bill.");
      if (!(Number(v.amount) > 0)) return ui.fieldError(box("amount"), "Type what you paid.");
      if (!String(v.what ?? "").trim()) return ui.fieldError(box("what"), "Say what the bill was for.");
      const row = { date: v.date, amount: Math.round(Number(v.amount) * 100) / 100, what: String(v.what ?? "").trim(), proof: String(v.proof ?? "").trim(), ...(v.reimbursedOn ? { reimbursedOn: v.reimbursedOn } : {}) };
      const id = r?.id ?? ui.uid();
      pending = { part: "receipts", say: (dd) => `${r ? "Receipt saved" : "Receipt added"}: ${row.what}, ${cents(row.amount)}. ${left(dd)}` };
      adding = false; editing = null;
      store.update((p) => {
        const list = Array.isArray(p.taxes.hsa.receipts) ? p.taxes.hsa.receipts : (p.taxes.hsa.receipts = []);
        const at = list.findIndex((q) => q.id === id);
        if (at >= 0) list[at] = { id, ...row }; else list.push({ id, ...row });
      });
    }, { submitLabel: r ? "Save" : "Add receipt", ...(r || rows.length ? { onCancel: () => { adding = false; editing = null; redraw(); } } : {}) });
    const out = ui.h("div", {}, ui.h("h3", {}, r ? `Change: ${r.what || "medical bill"}` : rows.length ? "Add a receipt" : "Your first receipt"), f);
    if (r) out.append(ui.row(ui.button("Remove this receipt", () => {
      if (!ui.confirm(`Remove ${r.what || "this receipt"} (${cents(r.amount)})?`)) return;
      pending = { part: "receipts", say: (dd) => `Removed ${r.what || "the receipt"}. ${left(dd)}` };
      editing = null;
      store.update((p) => { p.taxes.hsa.receipts = (p.taxes.hsa.receipts ?? []).filter((q) => q.id !== r.id); });
    }, { class: "secondary small" })));
    return out;
  }
  function openedForm() {
    // an HSA filled by moving money from an older HSA dates from the older one (Pub. 969): said at the box, so a person who
    // moved accounts does not type the newer day and get "before you opened" alarms on bills that do count
    const f = ui.form([{ key: "openedOn", label: "When you opened the HSA", type: "date", max: "today", help: "only bills paid on or after this day can be paid back tax-free. Moved money in from an older HSA? Then use the day the older one was opened." }], { openedOn: R?.openedOn ?? "" }, (v) => {
      pending = { part: "receipts", say: (dd) => (v.openedOn ? `Saved: the HSA was opened ${fmt.date(v.openedOn)}.` : "The opening day is cleared.") + ` ${left(dd)}` };
      store.update((p) => { if (v.openedOn) p.taxes.hsa.openedOn = v.openedOn; else delete p.taxes.hsa.openedOn; });
    }, { submitLabel: "Save the date" });
    // one filled button per screen: this Save is outlined (the receipt form's is the part's own)
    f.querySelector?.('[type="submit"]')?.classList?.add("secondary");
    return f;
  }

  // ---------------------------------------------------------------- part: how this is worked out, and why an HSA comes first
  const howPart = onMedicare ? null : { id: "how", kind: "how", body: [
    H.total > 0 && !noCover ? ui.h("ul", { class: "records" }, [
      ["The limit", `${money(H.limit)} for ${d.limitsYear}: ${coverText}${H.catchUp ? ", with the catch-up from 55" : ""}. Your money and the employer's count against it.`],
      ["Income tax", `The Federal estimate's return worked with the HSA money and without it: ${money(H.taxSaved)} less with it.`],
      ["Payroll tax", H.ficaSaved > 0 ? `${money(H.ficaSaved)}: money taken from pay before tax skips Social Security and Medicare tax.` : "None here: only money taken from pay through an employer skips payroll tax."],
    ].map(([t, x]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, x)))) : null,
    noCover ? null : ui.h("p", { class: "muted small" }, `Money that comes out of your paycheck also skips most payroll tax (7.65%; only 1.45% on pay above ${ssLimit ? `${ssLimit}` : "the Social Security pay limit"}). After 65 you can spend it on anything, and you pay income tax on what is not for medical bills.`),
    ui.h("p", { class: "muted small" }, "The HSA money also lowers the Federal estimate page's income, up to the limit. An HSA account on the Net worth page is counted in the growth figure."),
    ui.h("h3", {}, "Why an HSA comes first"),
    ui.h("ul", { class: "records" }, [
      ["Three tax breaks, not two", "A 401(k) skips tax going in and pays it coming out; a Roth is the reverse. The HSA skips both, and the payroll tax as well when it comes from a paycheck."],
      ["Pay cash now, reimburse later", "Receipts never expire: pay today's medical bills from your own pocket, let the HSA grow for decades, and reimburse yourself tax-free whenever you like."],
      ["Medicare and the deadline", `No HSA money can go in from the month Medicare starts. If you sign up for Medicare after 65, Part A starts up to six months earlier (but not before the month you turn 65), so stop putting money into the HSA six months before you apply. Money for a tax year can go in until that year's April tax deadline (for ${d.year}, until ${filingDeadline(d.year)}).`],
      ["FSA is different", "An FSA is a spending account, not a savings account: you must spend the money within the year, and you lose what is left, except a small amount you can carry over."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
    ui.h("p", { class: "muted small" }, "Where the rules come from: the IRS's yearly limits (Rev. Proc. 2025-19 for 2026, 2026-24 for 2027), Publication 969 on HSAs and FSAs, and Notice 2004-50 on paying yourself back later."),
  ] };

  const card = parts(ctx, numbersPart, figuresPart, receiptsPart, howPart);
  if (card) root.append(card);
  const more = links(ctx, [
    { href: "#/insurance/health", ask: "Which health plan costs least, with or without an HSA?" },
    { href: "#/investments/limits", ask: "How much more can go into each account this year?" },
    { href: "#/taxes/federal", ask: "What would I owe in April?" },
  ]);
  if (more) root.append(more);
}
