// modules/debt/mortgage/view.js -- DOM only. The mortgage today, what extra or biweekly
// payments would save, a recast, when mortgage insurance can go, the year-by-year balance.
import { compute, loanHome, setMortgageStart, seeLoanWords } from "./compute.js";
import { twoDates } from "../payoff/compute.js";
import { purchaseDateFrom } from "../../property/home/compute.js";
// the loan's own home only (a second loan with no home of its own never writes to the main home): ok when a Net worth home account (or the rental) is there to hold the year
const homeFor = (plan, loanId) => { const h = loanHome(plan, loanId); return { ok: !!h && !!h.account, account: h?.account ?? null, entry: h?.entry ?? null }; };
const listWords = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

let pending = null;   // the confirmation shown on the next render
const state = { extra: null, lump: 0, shown: null };   // shown: the loan the what-ifs were typed for

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  // several mortgages (a home and a rental, round 8 batch 6): the one picked rides in the address (#/debt/mortgage?loan=<id>), so
  // Back returns to the other and the menu opens the home's (review 2026-11-06, UX 6); the what-ifs belong to one loan
  const which = ctx.route?.query?.loan ?? null;
  if (state.shown !== which) { state.extra = null; state.lump = 0; state.shown = which; }
  const d = compute(plan, { today: fmt.today(), extra: state.extra ?? undefined, lump: state.lump, ...(which ? { accountId: which } : {}) });
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };
  // the others a tap away, as outlined buttons (UX 6: a 16 px link)
  const pick = d.others?.length ? ui.h("div", { class: "row" }, ...d.others.map((o) => ui.h("a", { class: "btn secondary", href: `#/debt/mortgage?loan=${encodeURIComponent(o.id)}` }, `${seeLoanWords(o.name)} ›`))) : null;
  const monthsText = (m) => !Number.isFinite(m) ? "never" : `${Math.floor(m / 12)} yr ${m % 12} mo`;

  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Mortgage"),
      ui.h("p", { class: "lede" }, d.mortgage ? `${d.mortgage.name} is on file but needs its interest rate and required payment before this page can work out the schedule.` : "Add the mortgage as an account on the Net worth page (type Mortgage) and give it a rate and payment on the Debts page. Then this page shows what extra payments, paying every two weeks or a recast would do."),
      ui.row(ui.h("a", { class: "btn", href: d.mortgage ? "#/balance/liabilities" : "#/balance/net-worth" }, d.mortgage ? "Add the rate and payment" : "Add the mortgage")), pick));
    return;
  }
  const m = d.mortgage;
  const monthYear = (iso) => { const t = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return Number.isNaN(t.getTime()) ? String(iso) : t.toLocaleDateString(plan.meta.locale, { month: "long", year: "numeric" }); };
  let rolled = null;
  try { rolled = twoDates(plan, { today: fmt.today() })[m.id] ?? null; } catch { rolled = null; }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, m.name),
    // the home it is on, when there is more than one loan or it is a rental's (UX 6)
    d.home && (d.others?.length || d.home.rental) ? ui.h("p", { class: "muted" }, `On ${d.home.name}${d.home.rental ? ", which you rent out" : ""}`) : null,
    ui.h("p", { class: "lede" }, `${fmt.money(m.balance, cur)} left at ${fmt.pct(m.rate, 2)}, ${fmt.money(m.payment, cur)} a month. At that pace it ends ${d.base.endDate ? `in ${monthYear(d.base.endDate)}` : `in ${monthsText(d.base.months)}`} after ${fmt.money(d.base.totalInterest, cur)} more interest.`),
    // the payoff plan's date, which the Timeline and the Plan summary show: said here with the reason (round 4, 2026-11-02)
    pick,
    rolled ? ui.h("p", {}, `On your payoff plan it ends in ${monthYear(rolled.plan)} instead: ${rolled.from.length ? `once the ${listWords(rolled.from)} ${rolled.from.length > 1 ? "are" : "is"} paid off, ${rolled.from.length > 1 ? "their payments move" : "its payment moves"} onto ${d.others?.length ? "this loan" : "the mortgage"}` : "the plan's payments move onto it"}${rolled.extra > 0 ? `, with the ${fmt.money(rolled.extra, cur)} extra a month` : ""}. `, ui.h("a", { href: "#/debt/payoff" }, "Open my payoff plan")) : null,
  ));
  // how the years left were worked out, in one plain line, and a way to change the year the home was bought
  const st = d.start;
  if (st) {
    // the years the page shows (the payment against the balance), so the card and the hero above agree (verify 2026-11-07)
    const loanYears = Math.max(1, Math.round(st.yearsLeft ?? 0)), years = st.worked && Number.isFinite(st.pageMonths) ? Math.max(1, Math.round(st.pageMonths / 12)) : loanYears;
    const yearsWords = `${years} ${years === 1 ? "year is" : "years are"}`;
    // the year typed for this home (Home's purchase date or Get started's box), whatever the loan's start was worked from
    const home = homeFor(plan, m.id);
    const typedYear = Number(/^(\d{4})/.exec(String(home.entry?.purchaseDate ?? ""))?.[1]) || null;
    let ours = null;
    try { ours = !typedYear && ctx.guess ? ctx.guess("home.boughtYear") : null; } catch { ours = null; }
    if (st.via === "stale") {
      // a year told that long ago cannot be this loan's start: ask when it was last refinanced (the same answer Get started keeps)
      root.append(ui.card("When did you last refinance?",
        ui.h("p", {}, `You told us you bought in ${st.stale}. A loan from then would be paid off by now, so this one was probably refinanced, or is a newer loan.${st.date ? ` Until you tell us when, we count it like most owners your age, from about ${st.year}: about ${yearsWords} left.` : " We used the usual balance and a full 30 years until you tell us."}`),
        ui.row(...[["pre2010", "Before 2010"], ["2010s", "2010 to 2019"], ["2020-21", "2020 or 2021"], ["2022on", "2022 or later"]].map(([v, label]) => ui.h("button", { class: "btn secondary", type: "button", onClick: () => { pending = "Got it: we counted the loan from then."; ctx.store.update((p) => setMortgageStart(p, v)); } }, label)))));
    } else {
      const who = st.via === "typed" ? `the year you told us you bought, ${st.year}` : st.via === "tap" ? `when you said you took out the loan, about ${st.year}` : `the year we guess you bought, ${st.year}`;
      const lines = !st.worked ? ["The years left come from the balance and payment you gave us."]
        // a typed payment far above the usual one: the balance is held at the home's value, so it is paid off sooner than the loan's term
        : st.apart ? [`At ${fmt.money(m.payment, cur)} a month, the ${fmt.money(m.balance, cur)} ${st.owedGuess ? "we have for this loan" : "you owe"} is paid off in about ${yearsWords.replace(" is", "").replace(" are", "")}. A usual 30-year loan from ${st.year} would have about ${loanYears} ${loanYears === 1 ? "year" : "years"} left.`, st.owedGuess ? "A payment this size usually means you owe more than our guess. Type what you still owe on Debts and every page follows." : "The payment is our guess. Type what you pay a month on Debts and every page follows."]
        : [`About ${yearsWords} left on a usual 30-year loan, counted from ${who}.`, st.via === "guess" && ours?.why ? `${ours.why} Bought in another year? Change it below and every page follows.` : st.via === "tap" ? "The year you bought the home is below; the loan stays counted from when you took it out." : "Change the year below and every page follows."];
      root.append(ui.card("How the years left were worked out", ...lines.map((t) => ui.h("p", {}, t)), st.apart ? ui.h("p", {}, ui.h("a", { href: "#/balance/liabilities" }, st.owedGuess ? "Type what you still owe ›" : "Type what you pay ›")) : null));
    }
    // the year bought: on this home's Home page entry (a rental's loan has its own on Rental analysis); the box and its label show
    // the year typed for the home, also when a refinance answered is what the loan is counted from (verify 2026-11-07)
    if ((st.worked || st.via === "typed" || st.via === "stale") && home.ok) {
      const yearForm = ui.form([{ key: "year", label: "Year you bought it", type: "text", placeholder: ours?.value ? String(ours.value) : "", help: typedYear ? "Four digits, like 2019. Blank goes back to our guess." : "Four digits, like 2019." }], { year: typedYear ?? "" }, (v) => {
        const typed = String(v.year ?? "").trim(), thisYear = Number(fmt.today().slice(0, 4));
        if (typed !== "" && (!/^\d{4}$/.test(typed) || Number(typed) < 1950 || Number(typed) > thisYear)) { const n = ui.notice("error", `Type the year as four digits between 1950 and ${thisYear}, like 2019, or leave it blank for our guess.`); root.prepend(n); setTimeout(() => n.remove(), 6000); return false; }
        const wasYear = typedYear;
        const date = purchaseDateFrom({ year: typed === "" ? null : Number(typed), date: home.entry?.purchaseDate ?? "" }, { year: wasYear, date: home.entry?.purchaseDate ?? "" }, thisYear);
        pending = typed === "" ? "Back to our guess for the year." : `Got it: bought in ${typed}.`;
        ctx.store.update((p) => {
          p.property = p.property ?? [];
          let e = p.property.find((x) => x.id === home.entry?.id) ?? null;
          if (!e) { e = { id: ui.uid(), kind: "home", accountId: home.account.id }; p.property.push(e); }
          if (date) e.purchaseDate = date; else delete e.purchaseDate;
        });
      }, { submitLabel: typedYear ? "Save" : "Use this year" });
      const box = yearForm.querySelector('input[name="year"]');
      if (box) { box.setAttribute("inputmode", "numeric"); box.setAttribute("maxlength", "4"); box.setAttribute("autocomplete", "off"); }
      root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Change the year you bought it"), ui.h("span", { class: "fold-status" }, typedYear ? String(typedYear) : st.via === "guess" ? `${st.year}, our guess` : ours?.value ? `${ours.value}, our guess` : "not given"), ui.h("span", { class: "fold-chev" }, "›")), yearForm));
    }
  }
  const extraIn = ui.input({ type: "number", value: d.withExtra.extra, min: 0, step: "25", inputmode: "decimal", "aria-label": "Extra each month", onChange: (e) => { state.extra = Math.max(0, Number(e.target.value) || 0); redraw(); } });
  const lumpIn = ui.input({ type: "number", value: state.lump || "", min: 0, step: "1000", inputmode: "decimal", placeholder: "e.g. 20000", "aria-label": "Lump sum", onChange: (e) => { state.lump = Math.max(0, Number(e.target.value) || 0); redraw(); } });
  root.append(ui.card("What if", ui.h("div", { class: "form" },
    ui.field("Extra each month", extraIn, "on top of the required payment; the Debts page keeps the extra you really pay"),
    ui.field("One lump sum (for a recast)", lumpIn, "a recast keeps the end date and lowers the payment; lenders charge a small fee")),
  ));
  root.append(ui.card(null, ui.row(
    ui.stat(`Extra ${fmt.money(d.withExtra.extra, cur)} a month`, d.withExtra.monthsSaved ? `${monthsText(d.withExtra.monthsSaved)} sooner` : "no change", d.withExtra.interestSaved ? `saves ${fmt.money(d.withExtra.interestSaved, cur)} of interest; ends ${d.withExtra.endDate ? fmt.date(d.withExtra.endDate) : monthsText(d.withExtra.months)}` : "type an extra amount above"),
    ui.stat("Half a payment every two weeks", d.biweekly.monthsSaved ? `${monthsText(d.biweekly.monthsSaved)} sooner` : "-", `26 half-payments a year is one extra payment; saves ${fmt.money(d.biweekly.interestSaved, cur)}`),
    d.recast ? ui.stat(`Recast with ${fmt.money(d.recast.lump, cur)}`, `${fmt.money(d.recast.newPayment, cur)}/mo`, `${fmt.money(d.recast.monthlySaving, cur)} a month less, same end date`) : null,
    d.pmi?.rental ? ui.stat("Owed against its value", fmt.pct(d.pmi.ltv, 0), `of ${d.pmi.homeName}'s ${fmt.money(d.pmi.homeValue, cur)} today`)
    : d.pmi ? ui.stat("Mortgage insurance", d.pmi.basis !== "price" ? `you owe ${fmt.pct(d.pmi.ltv, 0)} now` : d.pmi.monthsUntilDrop === 0 ? "you can ask to end it" : `${monthsText(d.pmi.monthsUntilDrop)} to go`, d.pmi.basis === "price"
      ? `you owe ${fmt.pct(d.pmi.ltv, 0)} of the ${fmt.money(d.pmi.basisValue, cur)} you paid. You can ask the lender to end it at 80% (${fmt.money(d.pmi.dropAtBalance, cur)})${d.pmi.dateDrop && d.pmi.monthsUntilDrop ? `, around ${fmt.date(d.pmi.dateDrop)}` : ""}; it ends by itself at 78%${d.pmi.dateAuto && d.pmi.monthsUntilAuto ? `, around ${fmt.date(d.pmi.dateAuto)}` : ""}`
      : `Extra insurance the lender charges until you owe 80% or less of the home's price. You owe ${fmt.pct(d.pmi.ltv, 0)} of its ${fmt.money(d.pmi.homeValue, cur)} value now. Enter what you paid on Your home to see the dates`) : null,
  )));
  if (d.schedule.length) root.append(ui.card("Year by year, with the extra above",
    ui.h("ul", { class: "page-list" }, d.schedule.map((y) => ui.h("li", {},
      ui.h("span", { class: "ic" }, String(y.year)),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, `Year ${y.year}`), ui.h("div", { class: "d" }, `${fmt.money(y.principalPaid, cur)} paid off · ${fmt.money(y.interestPaid, cur)} interest`)),
      ui.h("span", { class: "st" }, `${fmt.money(y.endBalance, cur)} left`)))),
  ));
  if (!d.home) root.append(ui.notice("info", "Add the house as an account (type Real estate) with its value to see when mortgage insurance can end."));
}
