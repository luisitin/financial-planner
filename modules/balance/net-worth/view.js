// modules/balance/net-worth/view.js -- DOM only.
import { ACCOUNT_TYPES, isLiability, countedBalance, typeName, balanceGuessKey, balanceGuessPath, labelTotals, compute as worthOf } from "./compute.js";
import { labelsOf, hasLabel, labelsIn, planLabels, labelChange, labelWords, sameLabel } from "./labels.js";
import { LABELS_FIELD, labelPicks, readLabels, labelChips } from "./labels-view.js";
import { keepOnFile, looksLikeSlip, correctSlip, markTyped } from "../update/compute.js";
import { isGuess, clearGuess, guessAt, markGuess, applies, same } from "../../../core/estimate/index.js";
import { escrowBefore, escrowKept } from "../../overview/guesses/estimators/home.js";
import { guessTwins } from "../../overview/guesses/compute.js";
import { snapshotOf, keepSnapshot, dropSnapshot, against, sentenceOf, statusWords, staleWords, comingOn, comingWords, savedWords, wouldKeep, tooSmall } from "./path.js";
import { part, parts, choice } from "../../../core/ui/more.js";
import { isMetal, metalOf, metalValue, metalLine, metalSaid, NEED_WEIGHT, NEED_PRICE } from "./metals.js";
import { isPrivate, privateOf, privatesOf, promisedOf, flowsOf, planFlow, addFlow, removeFlow, privateSentence, staleLine, keepReadyLine, keepReadyAll, rowRate, rowPromised,
  privateStatus, flowTitle, flowAsk, flowAddedSaid, flowRemovedSaid, FLOW_UNDONE, HOW } from "./private-fund.js";
import { sectionsOf, sectionKey, asOne, itemize, unmarkOnAdd, rowLine, statusWords as oneStatus, sectionLine, holdWords, askWords, doneWords, itemizeWords, undoneWords as oneUndone, addWords, INTRO, PART_TITLE } from "./one-figure.js";

// The shell re-renders after store.update, so a confirmation waits here for the next render:
// { card: "accounts" | "history", text }.
let pending = null;
// The label the Accounts list is narrowed to by its chips (gap next-60 #44): a choice of this visit, never the plan's.
let shownLabel = null;
// A page that sends people here to add one thing opens the form already set to it (DP-3, B4, D1, CF-1):
//   ?add=<type>   the add form open, Type chosen, a heading and a name hint for that kind ("add=debt": a loan or card)
//   ?edit=<id>    that account's edit form open
//   ?back=<group/id>   after the save, the green line carries "Back to <that page> ›"
//   ?from=import  sent by Import for a file's account (gap #33): with ?name=<the file's name for it> the name box starts with
//                 it, and the balance may be left empty (added at $0 with no date, said in the green line): a person moving
//                 their history in rarely knows it then, and must not have to make one up
// Read once per address: the shell redraws with the same route object after a save, so the form does not open again.
let landedOn = null;
// "One figure or item by item" (gap next-60 #11): the green line after a tap in that part ({ text, undo?, r? }), and, for this
// visit, whether the person acted in it (it stays open, R17) and which kinds they changed (still listed with one row left)
let oneSaid = null, oneOpen = false;
const oneTouched = new Set();
// "Private investments" (gap list, next 60, item 45): the green line after a change in that row ({ text, undo?, error? }), whether
// it opens on the next draw (an investment just added there by the form), "+ Add money in or out" tapped, and what was typed in
// that form when another investment was picked (it is drawn again for it)
let privSaid = null, privOpen = false, privAdding = false, privDraft = null;
// gold and silver by weight, a private investment: the kinds of "Something else I own" (the box "What it is", shown only for it)
const KIND_OPTIONS = [{ value: "", label: "Something else: I type what it is worth" }, { value: "gold", label: "Gold, by its weight" }, { value: "silver", label: "Silver, by its weight" }, { value: "private", label: "A private fund, or a share in a business" }];
const UNIT_OPTIONS = [{ value: "oz", label: "ounces (troy)" }, { value: "g", label: "grams" }];   // the troy ounce: the one gold and silver are priced in
const kindOfAccount = (a) => (isMetal(a) ? a.metal.kind : isPrivate(a) ? "private" : "");
/** The boxes that hold the new kinds' details, hidden (and not read) unless Type is "Something else I own" and its kind asks. */
const KIND_FIELDS = [
  { key: "kindOf", label: "What it is", type: "select", options: KIND_OPTIONS },
  { key: "weight", label: "How much gold", type: "number", min: 0, max: 1e9, step: "any", help: "the metal's own weight: a one-ounce coin is 1" },
  { key: "unit", label: "Weighed in", type: "select", options: UNIT_OPTIONS },
  { key: "price", label: "Price of one ounce", type: "money", min: 0, max: 1e7, help: "Type the price you see: this app never looks prices up." },
  { key: "promised", label: "Still promised", type: "money", min: 0, help: "money you agreed to put in but have not put in yet; leave it empty if none" },
];
/** Sets an account's kind details as the form saved them (`kp`: { metal?, private?, drop }); nothing without `kp`. */
const applyKind = (acc, kp) => { if (!acc || !kp) return; for (const k of kp.drop ?? []) delete acc[k]; if (kp.metal) acc.metal = kp.metal; if (kp.private) acc.private = kp.private; };
const ADD_AS = {
  debt: { type: "credit", title: "Add a loan or card", hint: "e.g. Visa card or Car loan", help: "Pick the kind under Type." },
  credit: { title: "Add a credit card", hint: "e.g. Visa card" },
  loan: { title: "Add a loan", hint: "e.g. Car loan" },
  mortgage: { title: "Add the mortgage", hint: "e.g. Home loan" },
  student_loan: { title: "Add a student loan", hint: "e.g. Federal student loan" },
  property: { title: "Add your home", hint: "e.g. Our home", help: "Type what it would sell for today." },
  vehicle: { title: "Add a car", hint: "e.g. Family car" },
  checking: { title: "Add an account", hint: "e.g. Main checking", help: "Pick the kind under Type." },
  savings: { title: "Add a savings account", hint: "e.g. Emergency savings" },
  investment: { type: "brokerage", title: "Add an investment account", hint: "e.g. Investment account", help: "A retirement account? Pick 401(k), IRA or Roth under Type." },
  belonging: { type: "property", title: "Add a home or car", hint: "e.g. Our home or Family car", help: `Under Type, pick "${typeName("property")}" or "${typeName("vehicle")}", and type what it would sell for today.` },
};
// the words a kind of account is asked in: a home is not an "account" with an "institution" and a "balance" (walk 2026-11-11)
const WORDS = {
  asset: { name: "Account name", institution: "Bank or company", balance: "Current balance", submit: "Add account", title: "Add an account" },
  debt: { name: "What to call it", institution: "Lender (optional)", balance: "What you owe now", submit: "Add it", title: "Add something you owe" },
  thing: { name: "What to call it", institution: null, balance: "What it would sell for today", submit: "Add it", title: "Add something you own" },
};
const wordsFor = (type) => isLiability(type) ? WORDS.debt : type === "property" || type === "vehicle" || type === "other_asset" ? WORDS.thing : WORDS.asset;
// a page's name as a way back: "Back to Your home", not "Back to Home" (which reads like the app's first screen)
const BACK_NAMES = { "property/home": "Your home", "balance/accounts": "your account", "balance/assets": "your list of belongings" };
// any other kind in the address: the form set to it, under the heading for its sort (its own words, "A home or land" or
// "Roth (tax-free later)", do not fit inside "Add a ... account")
const addAs = (q) => ADD_AS[q] ? { type: ADD_AS[q].type ?? q, ...ADD_AS[q] } : ACCOUNT_TYPES[q] ? { type: q, title: wordsFor(q).title, hint: null } : null;

// the balance box of an account added for a file on Import (gap #33): it may be left empty
const balanceLater = (zero) => `Not sure now? Leave it empty: it is added at ${zero}, and you type the balance later.`;
// (no grey example in a box, smart guesses C6: grey means counted; the example is the name box's help line, "For example, ...")
const exampleOf = (hint) => (hint ? `For example, ${hint.replace(/^e\.g\. /, "")}.` : null);
const FIELDS = [
  { key: "name", label: "Account name", type: "text", required: true, help: exampleOf("e.g. Main checking") },
  { key: "type", label: "Type", type: "select", options: Object.keys(ACCOUNT_TYPES).map((value) => ({ value, label: typeName(value) })) },
  { key: "institution", label: "Bank or company", type: "text" },
  { key: "balance", label: "Current balance", type: "money", required: true, help: "for a loan or card, the amount still owed" },
  { key: "asOf", label: "Balance as of", type: "date" },
];
// Whose account: one of the people on the People page, saved as their id (the tax pages put an account's sales and
// contributions on its owner's return); "Both of us" (two adults; "Shared" with more) saves "". A name typed before this
// was a choice stays selectable. With one adult there is no "Both of us" (plain-words pass C10): the adult's choice saves ""
// as before (every page counts an account nobody owns as the one adult's), or their id when that is what is on file; with
// nothing to choose (one adult and no one else) the box is not shown and what is on file is kept (null here).
const ownerField = (plan, current) => {
  const people = plan.household?.people ?? [];
  const adults = people.filter((p) => p.role !== "dependent");
  const one = adults.length === 1 ? adults[0] : null;
  const opt = (p) => ({ value: p.id, label: p.name || "Unnamed" });
  const options = one ? [{ value: current === one.id ? one.id : "", label: one.name || "Unnamed" }, ...people.filter((p) => p !== one).map(opt)]
    : [{ value: "", label: adults.length === 2 ? "Both of us" : "Shared" }, ...people.map(opt)];
  if (current && !people.some((p) => p.id === current)) options.push({ value: current, label: `${current} (typed before; choose a person)` });
  return options.length > 1 ? { key: "ownerId", label: "Whose account", type: "select", options } : null;
};

/** The line under the label chips (one sentence per case): what carries the label and its subtotal. */
export function labelLine(t, money) {
  const n = `${t.count} account${t.count === 1 ? "" : "s"} labeled ${t.label}`;
  if (t.hasAssets && t.hasDebts) return `${n}: ${money(t.assets)} owned, ${money(t.liabilities)} owed, ${money(t.net)} in all.`;
  if (t.hasDebts) return `${n}: ${money(t.liabilities)} owed.`;
  return `${n}: ${money(t.assets)}.`;
}
/** Every balance counted is our guess (the hero says "A rough start", not "Partly", P1: a first account saved empty). */
const allOurs = (d) => (d.guessedAssets ?? 0) + (d.guessedLiabilities ?? 0) > 0 && Math.abs((d.guessedAssets ?? 0) - (d.assets ?? 0)) < 0.5 && Math.abs((d.guessedLiabilities ?? 0) - (d.liabilities ?? 0)) < 0.5;

export function render(root, ctx) {
  const { ui, fmt, store, derived, plan } = ctx;
  // worked out with today's date: "since" is the last point before today, and a point saved today says so as well
  const d = ctx.computeOf?.("balance/net-worth", { today: fmt.today() }) ?? derived;
  const savedToday = (d.history ?? []).some((h) => h.date === fmt.today());
  const cur = plan.meta.currency;
  // a price with its cents (an ounce of silver is a few dollars): "$2,400.00"
  const price = (n) => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD" }).format(Number(n) || 0); } catch { return `$${(Number(n) || 0).toFixed(2)}`; } };
  const q = ctx.route?.query ?? {};
  const fresh = ctx.route !== landedOn; landedOn = ctx.route;
  if (fresh) { oneOpen = false; oneTouched.clear(); }
  const asked = fresh ? addAs(q.add) : null;
  // an account added for a bank or app file on Import (the form the address opened): its name from the file, and its
  // balance can wait (gap #33)
  const forImport = !!asked && q.from === "import";
  const startName = forImport ? String(q.name ?? "").trim().slice(0, 60) : "";
  // the page to go back to after the save; Import is named by what comes next there
  const backKey = q.from === "import" ? "transactions/import" : q.back;
  // group/id, or group/id/<one more part> (Account detail opened at one account)
  const backMod = backKey && /^[a-z0-9-]+\/[a-z0-9-]+(\/[A-Za-z0-9_-]+)?$/.test(backKey) ? ctx.modules?.get(backKey.split("/").slice(0, 2).join("/")) : null;
  const backLink = backMod ? { href: `#/${backKey}`, label: backKey === "transactions/import" ? "Now import the bank file ›" : `Back to ${BACK_NAMES[backKey.split("/").slice(0, 2).join("/")] ?? backMod.title} ›` } : null;
  let editing = fresh && q.edit ? plan.accounts.find((a) => a.id === q.edit) ?? null : null;

  const empty = plan.accounts.length === 0;
  if (empty) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Net worth"),
      ui.h("p", { class: "lede" }, "Add each account with its current balance. Net worth is simply what you own minus what you owe, and this page tracks it over time."),
      ui.h("p", { class: "muted small" }, "Start with the big ones: checking, savings, retirement accounts, the mortgage, credit cards. You can add the rest later."),
    ));
  } else {
    root.append(ui.card(null, ui.row(
      // smart guesses C2 (spec 8.1): a guessed balance that is half or more of either side says so, never as settled fact
      ui.stat("Net worth", fmt.money(d.netWorth, cur), d.partlyGuessed ? (allOurs(d) ? "A rough start, from our guesses. Type the real balances below." : "Partly our guesses. Type the real balances below.") : d.change ? `${Math.abs(d.change.sinceLast) < 0.5 ? "No change" : fmt.signed(d.change.sinceLast, cur)} since ${fmt.date(d.change.since)}${savedToday ? ", saved today" : ""}` : savedToday ? "saved today" : "what you own minus what you owe"),
      ui.stat("You own", fmt.money(d.assets, cur), `${fmt.money(d.liquid, cur)} is cash or easy to sell`),
      ui.stat("You owe", fmt.money(d.liabilities, cur), d.liabilities ? "loans, cards, mortgage" : "nothing on file"),
      ui.stat("Invested for later", fmt.money(d.investable, cur), investedLine(d, fmt, cur)),
    )));
  }

  const said = (card) => {
    if (pending?.card !== card) return null;
    const n = ui.notice("ok", pending.text, pending.undo ? { undo: pending.undo, undone: pending.undone } : {});
    if (pending.links?.length) n.append(ui.h("div", { class: "row", style: { marginTop: "8px" } }, ...pending.links.map((l) => ui.h("a", { class: l.filled ? "btn" : "btn secondary", href: l.href }, l.label))));
    pending = null; return n;
  };
  // The form stays open on the first visit; once accounts exist it folds behind a button
  // (design log 2026-09-15). Edit opens it filled in.
  let showForm = empty || !!asked || !!editing;
  let shownNote = null;
  const formHost = ui.h("div");
  const drawForm = () => {
    formHost.innerHTML = "";
    const n = said("form");
    if (n) { formHost.append(n); if (n.querySelector("a")) shownNote = n; }
    if (!showForm && !editing) {
      formHost.append(ui.h("div", { style: { marginTop: "12px" } }, ui.button("+ Add another account", () => { showForm = true; drawForm(); }, { class: "secondary" })));
      return;
    }
    const values = editing ? { ...editing } : { type: asked?.type ?? "checking", asOf: fmt.today(), ...(startName ? { name: startName } : {}) };
    formHost.append(ui.h("h2", {}, editing ? `Edit ${editing.name}` : asked?.title ?? "Add an account"));
    if (!editing && asked?.help) formHost.append(ui.h("p", { class: "muted small" }, asked.help));
    // the id the new account will have: the guess is worked out for it, and saved under it
    const newId = editing ? editing.id : ui.uid();
    const ourBalance = !!editing && isGuess(plan, `accounts[${editing.id}].balance`);
    // on Edit, a balance the person typed is never swapped for ours: its box stays required, as before C6 (fix F2, 2026-11-14:
    // cleared, it saved our $130,000 over a typed $500,000, with no word and no point in the history)
    const typedBalance = !!editing && !ourBalance && editing.balance !== null && editing.balance !== undefined && editing.balance !== "";
    if (ourBalance) formHost.append(ui.h("p", { class: "muted small" }, "This balance is our guess for now. Type the real one; left empty, it stays our guess."));
    // our guess for the balance box (C6, spec 12.1): by kind, for the owner chosen; a balance still ours is the figure the plan
    // counts now (it reopens grey, never as typed text). None for a file's account on Import (it waits at $0 instead)
    const guessFor = (type, ownerId) => {
      if (typedBalance || (forImport && !editing) || !ctx.guess || !applies(plan)) return null;
      if (ourBalance && type === editing.type) {
        const e = guessAt(plan, `accounts[${editing.id}].balance`);
        // its why is today's when today's figure is the one on file (as Add said it), else the figure is one we filled in earlier
        let fresh = null; try { fresh = ctx.guess(e.k, { path: e.path }); } catch { fresh = null; }
        return { key: e.k, value: e.v, unit: e.u ?? "total", sigma: e.s ?? null, dataAsOf: e.d ?? null, why: fresh && same(fresh.value, e.v, e.u ?? "total") ? fresh.why : "what we filled in for now" };
      }
      const key = balanceGuessKey(plan, type, newId);
      if (!key) return null;
      let first = null;
      try { first = ctx.guess(key, { path: balanceGuessPath(plan, type, newId, ownerId) }); } catch { first = null; }
      if (!first) return null;
      // worked out again with the account on file as the save leaves it (its kind, its owner, our figure, marked), on the path
      // the plan keeps it under: that is what settle counts after the save, so the grey figure is never one the plan then
      // moves (fix F1, round 2: a home for a household that owned none read $330,000 grey, and once it was on file, an
      // owner's, the plan counted $270,000). None when that reading gives none (the box is asked, as for a kind with no table)
      try {
        const draft = structuredClone(plan);
        const was = draft.accounts.find((a) => a?.id === newId);
        if (was) Object.assign(was, { type, ownerId: ownerId ?? "" }); else draft.accounts.push({ id: newId, name: "", type, ownerId: ownerId ?? "", balance: first.value, history: [] });
        markGuess(draft, `accounts[${newId}].balance`, first, fmt.today());
        return ctx.guess(key, { path: `accounts[${newId}].balance`, plan: draft });
      } catch { return null; }
    };
    const ask = ui.h("div");   // "was the old figure a typing mistake?", above the form
    formHost.append(ask);
    const save = (v, typo, g = null, kp = null) => {
      const was = editing;
      const id = newId;
      // the green line is drawn where the form was (where the thumb is), with what comes next: the page that sent you here,
      // and for a new loan or card its rate and payment on Debts (a debt with neither is left out of every plan)
      const links = [];
      const rateLink = { href: `#/balance/liabilities/${encodeURIComponent(id)}${backMod && !backKey.startsWith("balance/liabilities") && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(backKey) ? `?back=${backKey}` : ""}`, label: "Next: its rate and payment ›" };
      // sent from Debts: back there, straight to the new debt's rate and payment
      if (backLink && backKey.startsWith("balance/liabilities") && !was && isLiability(v.type)) links.push({ ...rateLink, filled: true });
      else {
        if (backLink) links.push({ ...backLink, filled: true });
        if (!was && isLiability(v.type)) links.push({ ...rateLink, filled: !backLink });
      }
      // a balance left as our guess is said with its figure (spec 9.4's words)
      // (the row says how to change it, "Our guess for now. Tap Edit to type the real one.": said once, P5)
      const ours = g ? ` Its balance is our guess for now: about ${fmt.money(Math.abs(g.value), cur)}.` : "";
      // a change of labels is said (gap next-60 #44); the list stays narrowed only if the record still carries that label
      const labelled = labelsNow === null ? "" : (() => { const ch = labelChange(was ? labelsOf(was) : [], labelsNow); return ch ? ` ${labelWords(ch)}` : ""; })();
      if (shownLabel && labelsNow !== null && !labelsNow.some((l) => sameLabel(l, shownLabel))) shownLabel = null;
      // another account of a kind kept as one figure lists that kind item by item again (gap next-60 #11)
      const unmark = !was ? sectionsOf(plan).find((s) => s.mode === "one" && s.key === sectionKey({ ...v, ownerId: v.ownerId ?? "" })) : null;
      const relisted = unmark ? ` ${addWords(unmark.name)}` : "";
      const specialText = kindWords(v, was, kp, labelled);
      pending = { card: "form", links, text: specialText ? specialText : !was ? (v.later ? `${v.name} added at ${fmt.money(0, cur)} for now. When you know its balance, tap Edit beside it here.${labelled}${relisted}` : `${v.name} added.${ours}${labelled}${relisted}`) : typo ? `${v.name || was.name} corrected to ${fmt.money(Math.abs(Number(v.balance)), cur)}, with its history: no fall is shown.${labelled}` : `${v.name || was.name} saved.${ours}${labelled}` };
      const setLabels = (acc) => { if (!acc || labelsNow === null) return; if (labelsNow.length) acc.labels = labelsNow; else delete acc.labels; };
      // a mortgage balance of ours saved here becomes the person's: the tax and insurance its payment was read with stay in that
      // payment, so the payoff date does not jump (home.js escrowKept; fix round 1, 2026-11-11)
      const held = escrowBefore(plan, fmt.today());
      const mutate = (p) => {
        if (was) {
          const i = p.accounts.findIndex((a) => a.id === was.id);
          if (i >= 0 && g) {
            // left as our guess: the figure we count, marked; a guess is not a balance anyone saw, so no point goes in its history
            p.accounts[i] = { ...p.accounts[i], ...v, balance: g.value };
            markGuess(p, `accounts[${was.id}].balance`, g, fmt.today());
            setLabels(p.accounts[i]);
            applyKind(p.accounts[i], kp);
          } else if (i >= 0) {
            const old = p.accounts[i];
            const moved = Number(v.balance) !== Number(old.balance);
            // a typing mistake is fixed where it stood (its points and the saved totals), never kept as a point
            if (moved && typo) { correctSlip(p, old.id, Number(v.balance)); p.accounts[i] = { ...p.accounts[i], ...v, balance: p.accounts[i].balance }; markTyped(p, old.id, fmt.today()); setLabels(p.accounts[i]); applyKind(p.accounts[i], kp); return; }
            // a new balance is today's unless you dated it yourself; the old one stays a point on its own date
            if (moved) keepOnFile(p, old, v.asOf && v.asOf !== (old.asOf ?? "") ? v.asOf : fmt.today());
            p.accounts[i] = { ...p.accounts[i], ...v, ...(moved && (v.asOf ?? "") === (old.asOf ?? "") ? { asOf: fmt.today() } : {}) };
            if (moved) markTyped(p, old.id, fmt.today());
            // saved from the form, even unchanged, the balance is the person's: it is no longer our guess (spec S2)
            clearGuess(p, `accounts[${old.id}].balance`);
            escrowKept(p, held, fmt.today());
            setLabels(p.accounts[i]);
            applyKind(p.accounts[i], kp);
          }
        }
        else {
          const { later, ...typed } = v;
          p.accounts.push({ id, ...typed, ...(g ? { balance: g.value } : {}), history: [] });
          if (g) markGuess(p, `accounts[${id}].balance`, g, fmt.today());
          setLabels(p.accounts.at(-1));
          applyKind(p.accounts.at(-1), kp);
          if (unmark) unmarkOnAdd(p, p.accounts.at(-1));
        }
      };
      // gold and silver by weight, a private investment: the green line has Undo (every other save stays as it was)
      if (kp) {
        let undo = null;
        const name = v.name || was?.name || "";
        pending.undo = () => undo?.();
        pending.undone = (res) => { pending = { card: "form", text: ui.undoneWords(res, was ? `Undone: ${name} is back as it was.` : `Undone: ${name} is off your list.`) }; };
        if (kp.private && !was) privOpen = true;   // the row where its amounts go opens once, under the list
        undo = ui.undoable(store, mutate);
      } else store.update(mutate);
      // done with what the address asked: Back or Reload must not open an empty "Add a loan or card" again (walk 2026-11-11);
      // the history entry is replaced, so no page change happens
      if (q.add || q.edit) {
        const keep = Object.entries(q).filter(([k]) => k !== "add" && k !== "edit").map(([k, x]) => `${encodeURIComponent(k)}=${encodeURIComponent(x)}`).join("&");
        try { history.replaceState(history.state, "", `#/balance/net-worth${keep ? `?${keep}` : ""}`); } catch { /* not allowed: Back reopens the form, nothing worse */ }
      }
      editing = null;
    };
    const w = wordsFor(values.type);
    const g0 = guessFor(values.type, values.ownerId ?? "");
    if (ourBalance) values.balance = null;
    const fields = FIELDS.map((f) => f.key === "name" ? { ...f, label: w.name, ...(!editing && asked?.hint ? { help: exampleOf(asked.hint) } : editing ? { help: null } : {}) }
      : f.key === "balance" && forImport && !editing ? { ...f, label: w.balance, required: false, help: balanceLater(fmt.money(0, cur)) }
      // (where our guesses apply, the box's grey figure and its line say what it is: "for a loan or card, the amount still owed" goes,
      // the box's own name already says "What you owe now" for a loan or card)
      : f.key === "balance" ? { ...f, label: w.balance, help: (ctx.guess && applies(plan)) || isLiability(values.type) || w === WORDS.thing ? null : f.help, guess: g0 }
      : f.key === "asOf" && w !== WORDS.asset ? { ...f, label: w === WORDS.thing ? "Worth that on" : "Owed that on" }
      : f.key === "institution" ? (w.institution ? { ...f, label: w.institution } : null) : f).filter(Boolean);
    // gold and silver by weight, a private investment (gap list, next 60, item 45): their boxes come right after Type, hidden
    // unless Type is "Something else I own" (showKind below), so every other kind's form says and saves what it did
    fields.splice(fields.findIndex((f) => f.key === "type") + 1, 0, ...KIND_FIELDS);
    const mo = editing ? metalOf(editing) : null;
    const kindStart = { kindOf: editing ? kindOfAccount(editing) : "", weight: mo?.weight ?? null, unit: mo?.unit ?? "oz", price: mo ? mo.price : null, promised: editing && isPrivate(editing) ? promisedOf(editing) || null : null };
    const owner = ownerField(plan, values.ownerId);
    // your own labels (gap next-60 #44): not asked on the first account (the empty page's first view stays as it was)
    const known = planLabels(plan);
    const askLabels = !empty;
    let labelsNow = null;   // what Save writes: null = the form had no labels box (nothing changes)
    if (askLabels && editing) values.labelsText = labelsOf(editing).join(", ");
    const start = { ownerId: "", ...values, ...kindStart };
    // cleared on Edit, a typed balance is asked for again with the way back in view (P5, round 2: "Type an amount first." alone)
    const keepWords = typedBalance ? `Type the ${w === WORDS.debt ? "amount owed" : w === WORDS.thing ? "value" : "balance"}, or tap Cancel to keep ${fmt.money(Math.abs(Number(editing.balance) || 0), cur)}.` : null;
    const theForm = ui.form([...fields.map((f) => (keepWords && f.key === "balance" ? { ...f, missing: keepWords } : f)), ...(owner ? [w === WORDS.asset ? owner : { ...owner, label: "Whose it is" }] : []), ...(askLabels ? [LABELS_FIELD] : [])], start, (typed0, meta) => {
      // the labels box is read apart: Save writes `labels` (or takes it off), never the box's text; the kind's boxes are read
      // apart too (kindPatch): only for "Something else I own", and they never go on the account as they are typed
      const { labelsText, kindOf, weight, unit, price, promised, ...typed } = typed0;
      if (askLabels) { const r = readLabels(labelsText, known); if (r.error) return ui.fieldError(theForm.querySelector('[name="labelsText"]'), r.error); labelsNow = r.list; }
      // no "Whose account" box (one adult): the owner saved is what the box would have held, as before
      let v = owner ? typed : { ...typed, ownerId: start.ownerId ?? "" };
      const kk = kindPatch(v, { kindOf, weight, unit, price, promised });
      if (kk === false) return false;
      if (kk?.error) return ui.fieldError(theForm.querySelector(`[name="${kk.field}"]`), kk.error);
      const kp = kk?.kp ?? null;
      if (kk?.balance !== undefined) v = { ...v, balance: kk.balance, asOf: v.asOf || fmt.today() };
      // the balance box left empty over our grey figure: that guess, for the kind and owner the form holds now
      const g = meta?.guessed?.has("balance") ? guessFor(v.type, v.ownerId ?? "") ?? meta.guess.balance : null;
      if (g) { save({ ...v, balance: g.value }, false, g, kp); return; }
      // added for a file on Import with the balance left empty: $0 for now, with no date (it is not a balance anyone saw)
      if (forImport && !editing && (v.balance === null || v.balance === undefined || v.balance === "")) v = { ...v, balance: 0, asOf: "", later: true };
      // a new figure that looks like the old one with a key slipped (115,000 for 11,500): ask once which it was (never about our
      // guess: nobody typed it, so it cannot be a slip, F3)
      if (editing && !ourBalance && looksLikeSlip(editing.balance, v.balance)) {
        const wrong = fmt.money(Math.abs(Number(editing.balance)), cur), right = fmt.money(Math.abs(Number(v.balance)), cur);
        // "it changed" is the default answer (a real change can look like a slip); the other rewrites the history (review 2026-11-02)
        ask.replaceChildren(ui.notice("warn", `${wrong} on file, ${right} typed. Did it change, or was ${wrong} a typing slip?`),
          ui.h("div", { class: "row" },
            ui.button("It changed", () => save(v, false, null, kp)),
            ui.button(`${wrong} was a mistake`, () => save(v, true, null, kp), { class: "secondary" }),
            ui.button("Let me fix what I typed", () => { ask.replaceChildren(); ask.style.marginBottom = ""; const box = formHost.querySelector('input[name="balance"]'); box?.focus(); box?.select?.(); }, { class: "secondary" })),
          ui.h("p", { class: "muted small" }, "A mistake on file is fixed in the history too, so net worth does not show a fall (or a jump) that never happened."));
        ask.style.marginBottom = "16px";
        ask.scrollIntoView({ behavior: "smooth", block: "center" });
        return false;   // keep the form as typed behind the question
      }
      save(v, false, null, kp);
    }, { submitLabel: editing ? "Save changes" : asked && w !== WORDS.asset ? w.submit : "Add account", resetAfter: !editing, onCancel: (editing || !empty) ? () => { editing = null; showForm = false; drawForm(); } : null });
    formHost.append(theForm);
    if (askLabels) labelPicks(ui, theForm, known);
    // another kind picked under Type: the boxes' words follow it
    const typeSel = formHost.querySelector('select[name="type"]');
    typeSel?.addEventListener("change", () => {
      const x = wordsFor(typeSel.value);
      const lab = (k) => formHost.querySelector(`[name="${k}"]`)?.closest("label");
      const set = (k, t) => { const l = lab(k)?.querySelector(".field-label"); if (l && t) l.textContent = t; };
      set("name", x.name); set("balance", x.balance);
      // (hidden for a thing; its inline display too, as base.css's flex label outranks the hidden attribute)
      if (lab("institution")) { set("institution", x.institution ?? WORDS.asset.institution); lab("institution").hidden = !x.institution; lab("institution").style.display = x.institution ? "" : "none"; }
      showKind();   // (first: a kind's guess, set next, decides whether the worth box is asked)
      ui.setGuess?.(theForm, "balance", guessFor(typeSel.value, ownerSel?.value ?? start.ownerId ?? ""));
    });
    // "What it is" (only for "Something else I own"): gold or silver ask the weight and the price of one ounce in place of the
    // worth (the worth is worked out from them); a private investment asks what is still promised. Hidden boxes are not asked.
    const kindSel = formHost.querySelector('select[name="kindOf"]');
    const balBox = formHost.querySelector('input[name="balance"]');
    const balRequired = !!balBox?.required;
    const kLab = (key) => formHost.querySelector(`[name="${key}"]`)?.closest("label");
    const asOf0 = kLab("asOf")?.querySelector(".field-label")?.textContent ?? null;
    let balHidden = false, asOfSet = false;   // what showKind changed, so it is put back for another Type
    function showKind() {
      const t = typeSel?.value ?? values.type;
      const k = t === "other_asset" ? kindSel?.value ?? "" : "";
      const metal = k === "gold" || k === "silver";
      // (a label is a flex box in base.css, which outranks the hidden attribute: the inline display hides it in a browser)
      const hide = (key, h) => { const l = kLab(key); if (l) { l.hidden = h; l.style.display = h ? "none" : ""; } };
      const set = (key, text) => { const l = kLab(key)?.querySelector(".field-label"); if (l && text && l.textContent !== text) l.textContent = text; };
      hide("kindOf", t !== "other_asset");
      for (const key of ["weight", "unit", "price"]) hide(key, !metal);
      hide("promised", k !== "private");
      // gold or silver: the worth is worked out, so its box goes (and is not asked); any other choice puts it back as it was
      if (metal !== balHidden) { hide("balance", metal); if (balBox) balBox.required = metal ? false : balRequired; balHidden = metal; }
      if (t === "other_asset") {
        set("weight", `How much ${k === "silver" ? "silver" : "gold"}`);
        set("asOf", metal ? "Price as of" : "Worth that on"); asOfSet = true;
        set("balance", k === "private" ? "What it is worth now" : WORDS.thing.balance);
      } else if (asOfSet) { set("asOf", asOf0); asOfSet = false; }
    }
    kindSel?.addEventListener("change", showKind);
    showKind();
    // a retirement account's guess is its owner's: it follows "Whose account"
    const ownerSel = formHost.querySelector('select[name="ownerId"]');
    ownerSel?.addEventListener("change", () => ui.setGuess?.(theForm, "balance", guessFor(typeSel?.value ?? values.type, ownerSel.value)));
  };
  drawForm();

  /**
   * What the form's kind boxes save (gap list, next 60, item 45), for the account `v` the form holds now: null for every
   * kind but "Something else I own" when the account had no such details (nothing changes); else { kp: { metal?, private?,
   * drop }, balance? (gold or silver: ounces x the price of one ounce) }, { field, error } for an empty box it needs, or
   * false when a private investment's amounts would be lost and the person says no.
   */
  function kindPatch(v, { kindOf, weight, unit, price, promised }) {
    const k = v.type === "other_asset" ? kindOf || "" : "";
    const hadMetal = !!editing && isMetal(editing), hadPrivate = !!editing && isPrivate(editing);
    if (k === "gold" || k === "silver") {
      if (!(Number(weight) > 0)) return { field: "weight", error: NEED_WEIGHT(k) };
      if (!(Number(price) > 0)) return { field: "price", error: NEED_PRICE };
      const metal = { kind: k, weight: Number(weight), unit: unit === "g" ? "g" : "oz", price: Number(price) };
      return { kp: { metal, drop: ["private"] }, balance: metalValue(metal) };
    }
    if (k === "private") {
      const pv = { ...(hadPrivate ? structuredClone(editing.private) : { flows: [] }) };
      if (Number(promised) > 0) pv.promised = Math.round(Number(promised) * 100) / 100; else delete pv.promised;
      return { kp: { private: pv, drop: ["metal"] } };
    }
    if (!hadMetal && !hadPrivate) return null;
    const n = hadPrivate ? flowsOf(editing).length : 0;
    if (n && !ui.confirm(`${editing.name} has ${n} ${n === 1 ? "amount" : "amounts"} put in or paid back on file. Saved as something else, ${n === 1 ? "it is" : "they are"} no longer kept. Save it anyway?`)) return false;
    return { kp: { drop: ["metal", "private"] } };
  }
  /** The green line after the form saves one of these kinds (null for every other save: its own words, as before). */
  function kindWords(v, was, kp, labelled) {
    if (!kp?.metal && !kp?.private) return null;
    const name = v.name || was?.name || "";
    if (kp.metal) return `${metalSaid(name, { ...metalOf({ type: "other_asset", metal: kp.metal, balance: v.balance }), value: v.balance }, !was, price, (n) => fmt.money(n, cur))}${labelled}`;
    if (!was) return `${name} added. Next: what you put in and when, under Private investments below.${labelled}`;
    return `${name} saved.${kp.private.promised ? ` Still promised: ${fmt.money(kp.private.promised, cur)}.` : ""}${labelled}`;
  }
  const edit = (a) => { editing = a; showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth" }); };
  const del = (a) => { if (ui.confirm(`Delete ${a.name}?`)) { pending = { card: "accounts", text: `${a.name} removed.` }; store.update((p) => { p.accounts = p.accounts.filter((x) => x.id !== a.id); }); } };
  const guessed = (a) => isGuess(plan, `accounts[${a.id}].balance`);
  const typeLabel = (a) => typeName(a.type);
  // Anything that counts against you (a loan, or an overdrawn asset) shows a minus in red (F-008).
  const balance = (a) => { const against = isLiability(a.type) || countedBalance(a) < 0; return ui.h("span", { class: against ? "bad" : "" }, (against ? "-" : "") + fmt.money(Math.abs(countedBalance(a)), cur)); };
  // your own labels (gap next-60 #44): chips narrow the list to one label and say its subtotal; the figures above stay the whole plan's
  const ownLabels = labelsIn(plan.accounts);
  if (shownLabel && !ownLabels.some((l) => sameLabel(l, shownLabel))) shownLabel = null;
  const pills = (a) => labelsOf(a).map((l) => ui.h("span", { class: "pill" }, l));
  // a row that holds its kind as one figure says so ("One figure for your savings accounts"; gap next-60 #11)
  const kinds = sectionsOf(plan);
  const oneLine = (a) => rowLine(plan, a, kinds);
  // gold or silver by weight, a private investment (gap list, next 60, item 45): the row says how its worth is made, or its own
  // return; null for every other row (which reads as before)
  const kindLine = (a) => {
    const m = metalOf(a);
    if (m) return metalLine(m, price, fmt.date);
    if (!isPrivate(a)) return null;
    const rr = rowRate(privateOf(a, { today: fmt.today() }));
    return `${a.asOf ? `as of ${fmt.date(a.asOf)}` : "no day typed"}${rr ? ` \u00b7 ${rr}` : ""}`;
  };
  const callsLine = (a) => (isPrivate(a) ? rowPromised(privateOf(a, { today: fmt.today() }), (n) => fmt.money(n, cur)) : "");
  const rows = [...plan.accounts].filter((a) => !shownLabel || hasLabel(a, shownLabel)).sort((a, b) => Number(isLiability(a.type)) - Number(isLiability(b.type)) || Math.abs(b.balance) - Math.abs(a.balance));
  const redrawHere = () => (ctx.redraw ? ctx.redraw() : (root.replaceChildren(), render(root, ctx)));
  const filter = ownLabels.length ? ui.h("div", { dataset: { labels: "" } },
    labelChips(ui, ownLabels, shownLabel, (l) => { shownLabel = l; redrawHere(); }, "All accounts"),
    shownLabel ? ui.h("p", { class: "small" }, labelLine(labelTotals(plan, shownLabel), (n) => fmt.money(n, cur))) : null) : null;
  // Desktop: a table. Phone: one stacked record per account (tester F-002).
  const table = ui.h("div", { class: "only-wide" }, ui.table([
    { key: "name", label: "Account", render: (a) => (labelsOf(a).length || oneLine(a) || kindLine(a) ? ui.h("span", {}, a.name ?? "", ...pills(a), oneLine(a) ? ui.h("div", { class: "muted small" }, oneLine(a)) : null, kindLine(a) ? ui.h("div", { class: "muted small" }, kindLine(a)) : null, callsLine(a) ? ui.h("div", { class: "small" }, callsLine(a)) : null) : (a.name ?? "")) },
    { key: "type", label: "Type", render: typeLabel },
    { key: "institution", label: "Bank or company" },
    { key: "balance", label: "Balance", align: "right", render: balance },
    { key: "asOf", label: "Balance as of", render: (a) => (guessed(a) ? "our guess for now" : fmt.date(a.asOf)) },
    { key: "actions", label: "", render: (a) => ui.h("span", {},
      ui.button("Edit", () => edit(a), { class: "secondary small" }), " ",
      ui.button("Delete", () => del(a), { class: "danger small" })) },
  ], rows, { empty: "No accounts yet. Add your first one below." }));
  // Phone record: name + Edit/Delete on the first line, type and balance on the second,
  // "as of" on the third (design log 2026-09-15, pass 2).
  const records = ui.h("ul", { class: "records only-narrow" }, rows.map((a) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, a.name),
      ui.h("span", { class: "rec-actions" }, ui.button("Edit", () => edit(a), { class: "secondary small" }), ui.button("Delete", () => del(a), { class: "danger small" }))),
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-sub" }, [typeLabel(a), a.institution].filter(Boolean).join(" \u00b7 ")), ui.h("span", { class: "rec-value" }, balance(a))),
    ui.h("div", { class: "rec-sub" }, guessed(a) ? "Our guess for now. Tap Edit to type the real one." : kindLine(a) ?? (oneLine(a) ? `${oneLine(a)}${a.asOf ? `, as of ${fmt.date(a.asOf)}` : ""}` : a.asOf ? `as of ${fmt.date(a.asOf)}` : ""), ...pills(a)),
    callsLine(a) ? ui.h("div", { class: "rec-sub" }, callsLine(a)) : null)));
  // a debt typed here beside one Get started guessed: asked once on Our guesses for you, so it is not counted twice
  const twins = guessTwins(plan);
  if (twins.length) root.append(ui.h("ul", { class: "page-list" }, twins.map((t) => ui.h("li", {}, ui.h("a", { href: "#/overview/guesses", class: "muted" }, `Is ${t.twinName} the ${t.name.toLowerCase()} we guessed? Tell us, so it counts once ›`)))));
  root.append(ui.card(empty ? null : "Accounts",
    said("accounts"),
    empty ? null : ui.h("p", {}, ui.h("a", { href: "#/balance/update", class: "btn secondary" }, "Update all balances at once")),
    empty ? null : filter,
    empty ? null : table, empty ? null : records,
    empty ? null : onePart(),
    formHost,
  ));

  // "Private investments" (gap list, next 60, item 45): one quiet row under the list, drawn only while one is on file
  const pp = privatePart();
  if (pp) root.append(ui.h("div", {}, parts(ctx, pp)));
  // the green line with its next steps, in view (on a small phone it sat under the top bar after the form folded away)
  if (shownNote) { const r = shownNote.getBoundingClientRect(); if (r.top < 70 || r.bottom > window.innerHeight) shownNote.scrollIntoView({ block: "start" }); }
  // landed here to add or change one thing: the form in view and its first box ready (the page scrolls itself, so the shell's
  // "a new address starts at the top" gives way)
  if (fresh && (asked || editing) && !empty) {
    const h2 = formHost.querySelector("h2");
    h2?.scrollIntoView({ block: "start" });
    const box = formHost.querySelector(editing ? 'input[name="balance"]' : 'input[name="name"]');
    try { box?.focus({ preventScroll: true }); } catch { /* old browsers */ }
  }
  // "One figure or item by item" (gap next-60 #11; README): one quiet row under the list, drawn only while a kind of account can
  // be put together into one figure or is kept as one (a kind = one kind of account of one owner: Savings, Ana's 401(k)).
  // Inside: each such kind with its two chips; One figure asks first, in place, then replaces the rows with one (Undo);
  // Item by item keeps the one row as the first of the list. Nothing here is drawn for a plan with nothing to choose.
  function onePart() {
    const money = (n) => fmt.money(n, cur);
    const all = sectionsOf(plan, { all: true });
    const shown = all.filter((s) => s.count >= 2 || s.mode === "one" || oneTouched.has(s.key));
    const said = oneSaid; oneSaid = null;
    if (!said && !shown.some((s) => s.changes || oneTouched.has(s.key))) return null;
    const after = (dr) => worthOf(dr, { today: fmt.today() }).netWorth;
    const act = (s, mutate, words) => {
      oneOpen = true; oneTouched.add(s.key);
      let r = null, nw = d.netWorth;
      const undo = ui.undoable(store, (dr) => { r = mutate(dr); nw = after(dr); });
      if (!r) return;
      oneSaid = { text: words(r, nw), r, nw, undo };
    };
    const putTogether = (s) => act(s, (dr) => asOne(dr, s.key, fmt.today()), (r, nw) => doneWords(r, s, money, nw));
    const toItems = (s) => act(s, (dr) => itemize(dr, s.key), (r) => itemizeWords(r));
    // One figure asks first, in place; while it asks, its chip is the one lit (review 2026-11-16 P2: the old choice stayed lit and
    // the tap looked lost). "Keep them as they are", or a tap on the other chip, puts the block back as it was. Nothing is written.
    const block = (s) => {
      const host = ui.h("div", { dataset: { kind: s.key }, style: { display: "grid", gap: "8px" } });
      // the chip lit now keeps the focus when the block is drawn again under the finger (the tapped control is replaced)
      const lit = () => { try { host.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true }); } catch { /* old browsers */ } };
      const draw = (asking, focus = false) => {
        const ask = !asking ? null : ui.h("div", { style: { display: "grid", gap: "8px" } }, ui.h("p", {}, askWords(plan, s, money, d.netWorth)),
          ui.row(ui.button("Replace with one line", () => putTogether(s), { class: "secondary" }), ui.button("Keep them as they are", () => draw(false, true), { class: "secondary" })));
        const pick = (v) => {
          if (asking) return draw(false, true);      // the other chip while asking: the question goes, nothing changes
          if (v === "items") return toItems(s);
          if (!s.join.length) return putTogether(s);   // one row: only marked, nothing to replace
          draw(true, true);
        };
        host.replaceChildren(...[   // (a native replaceChildren writes a null as the word "null": left out)
          ui.h("p", {}, ui.h("strong", {}, s.name), ` \u00b7 ${sectionLine(s, money)}`),
          s.changes || oneTouched.has(s.key) ? choice(ctx, { id: `one-${s.key}`, label: `${s.name}: one figure or item by item`, value: asking ? "one" : s.mode, onPick: pick,
            presets: [{ value: "one", label: "One figure" }, { value: "items", label: "Item by item" }] }) : null,
          ...s.held.map((h) => ui.h("p", { class: "muted small" }, holdWords(h))),
          ask].filter(Boolean));
        if (focus) lit();
      };
      draw(false);
      return host;
    };
    const note = said ? ui.notice("ok", said.text, said.undo ? { undo: said.undo, undone: (res) => { oneOpen = true; oneSaid = { text: ui.undoneWords(res, oneUndone(said.r, money, said.nw)) }; } } : {}) : null;
    return ui.h("div", { class: "folds", style: { marginTop: "8px" } }, part(ctx, { id: "asOne", kind: "own", title: PART_TITLE, says: oneStatus(shown),
      open: !!said || oneOpen, body: [note, ui.h("p", {}, INTRO), ...shown.map(block)] }));
  }
  // ---- "Private investments": each one's own yearly return from its dated amounts, what it can still ask for, and the form
  // that adds money put in or paid back (private-fund.js; asked first and with Undo for a removal, Undo after an add)
  function privatePart() {
    const all = privatesOf(plan, { today: fmt.today() });
    if (!all.list.length) { privSaid = null; privOpen = false; return null; }
    const said = privSaid, open = !!said || privOpen;
    privSaid = null; privOpen = false;
    const m0 = (n) => fmt.money(n, cur);
    return { id: "private", kind: "item", title: "Private investments", says: privateStatus(all, m0), open: open ? true : undefined, holds: ["flowAmount", "flowDate"], body: () => privateBody(all, said) };
  }
  function privateBody(all, said) {
    const m0 = (n) => fmt.money(n, cur);
    const out = [];
    if (said) {
      // the list above the tapped button changes: the green line is brought under the top bar (ui.reveal)
      const n = ui.notice(said.error ? "error" : "ok", said.text);
      out.push(n, said.undo ? ui.row(ui.button("Undo", said.undo, { class: "secondary" })) : null);
      ui.reveal?.(n, { block: "start" });
    }
    const allLine = keepReadyAll(all, m0);
    if (allLine) out.push(ui.h("p", {}, ui.h("strong", {}, allLine)));
    for (const r of all.list) {
      out.push(ui.h("h3", {}, r.name), ui.h("p", {}, privateSentence(r, m0)));
      const st = staleLine(r);
      if (st) out.push(ui.h("p", { class: "small" }, st));
      const kr = keepReadyLine(r, m0);
      if (kr) out.push(ui.h("p", {}, ui.h("strong", {}, kr)));
      if (r.flows.length) {
        const shown = [...r.flows].reverse().slice(0, 10);
        out.push(ui.h("ul", { class: "records" }, shown.map((f) => ui.h("li", {},
          ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, flowTitle(f)), ui.h("span", { class: "rec-value" }, m0(f.amount))),
          ui.h("div", { class: "rec-foot" }, ui.button("Remove", () => takeOff(r, f), { class: "secondary small" }))))));
        if (r.flows.length > 10) out.push(ui.h("p", { class: "muted small" }, `and ${r.flows.length - 10} earlier amounts, counted above.`));
      }
    }
    const host = ui.h("div");
    drawFlowForm(host, all, all.list.some((r) => r.flows.length) && !privAdding);
    out.push(host, ui.h("p", { class: "muted small" }, HOW));
    return out;
  }
  // an amount taken off asks first, says the new return in green, and offers Undo
  function takeOff(r, f) {
    const m0 = (n) => fmt.money(n, cur);
    if (!ui.confirm(flowAsk(f, m0))) return;
    const dry = structuredClone(plan);
    removeFlow(dry, r.id, f.id);
    let undo = null;
    privSaid = { text: flowRemovedSaid(f, privateOf(dry.accounts.find((x) => x.id === r.id), { today: fmt.today() }), m0), undo: () => { privSaid = { text: FLOW_UNDONE }; undo?.(); } };
    undo = ui.undoable(store, (p) => { removeFlow(p, r.id, f.id); });
  }
  // "Add money in or out": open while nothing is typed, else behind an outlined "+ Add money in or out" (R20)
  function drawFlowForm(host, all, folded) {
    host.replaceChildren?.();
    if (folded) { host.append(ui.row(ui.button("+ Add money in or out", () => { privAdding = true; drawFlowForm(host, all, false); host.querySelector?.("input, select")?.focus?.({ preventScroll: true }); }, { class: "secondary" }))); return; }
    const m0 = (n) => fmt.money(n, cur);
    const list = all.list;
    const r = list.find((x) => x.id === privDraft?.inv) ?? list[0];
    const fields = [
      list.length > 1 ? { key: "inv", label: "Which one", type: "select", options: list.map((x) => ({ value: x.id, label: x.name })) } : null,
      { key: "flowKind", label: "What happened", type: "select", options: [{ value: "in", label: "You put money in" }, { value: "back", label: "It paid money back to you" }] },
      { key: "flowAmount", label: "How much", type: "money", required: true, min: 0, max: 1e10 },
      { key: "flowDate", label: "On", type: "date", required: true, max: fmt.today() },
      r.promised > 0 ? { key: "fromPromised", label: "It was money the fund asked for: take it off what is still promised", type: "checkbox" } : null,
    ].filter(Boolean);
    const values = { inv: r.id, flowKind: privDraft?.flowKind ?? "in", flowAmount: privDraft?.flowAmount ?? null, flowDate: privDraft?.flowDate ?? fmt.today(), fromPromised: privDraft?.fromPromised ?? true };
    const f = ui.form(fields, values, (v) => {
      const target = list.find((x) => x.id === (v.inv ?? r.id)) ?? r;
      const w = planFlow({ kind: v.flowKind, amount: v.flowAmount, date: v.flowDate }, { today: fmt.today() });
      if (!w.ok) {
        const box = f.elements?.[w.field === "amount" ? "flowAmount" : "flowDate"];
        if (box) return ui.fieldError(box, w.error);
        f.prepend(ui.notice("error", w.error));
        return false;
      }
      const fromPromised = !!v.fromPromised && w.flow.kind === "in" && target.promised > 0;
      const id = ui.uid();
      const dry = structuredClone(plan);
      addFlow(dry, target.id, w.flow, id, { fromPromised });
      let undo = null;
      privSaid = { text: flowAddedSaid(w.flow, privateOf(dry.accounts.find((x) => x.id === target.id), { today: fmt.today() }), m0, undefined, { fromPromised }), undo: () => { privSaid = { text: FLOW_UNDONE }; undo?.(); } };
      privAdding = false; privDraft = null;
      undo = ui.undoable(store, (p) => { addFlow(p, target.id, w.flow, id, { fromPromised }); });
    }, { submitLabel: "Add it", onCancel: all.list.some((x) => x.flows.length) ? () => { privAdding = false; privDraft = null; drawFlowForm(host, all, true); host.querySelector?.("button")?.focus?.(); } : undefined });
    // another investment: the form is drawn again for it (its tick follows what it still has promised), keeping what was typed
    f.elements?.inv?.addEventListener?.("change", () => { privDraft = { inv: f.elements.inv.value, flowKind: f.elements.flowKind?.value ?? "in", flowAmount: f.elements.flowAmount?.value ?? null, flowDate: f.elements.flowDate?.value ?? "", fromPromised: f.elements.fromPromised?.checked ?? true }; drawFlowForm(host, all, false); });
    host.append(ui.h("h3", {}, "Add money in or out"), f);
  }
  // "Your earlier plan" (gap #35): one quiet row in Over time, drawn only once a path kept by "Save today's totals"
  // is six months old. It reads the plan and writes nothing; without a kept path the page is as it was. While a kept path
  // is younger than that, one small line says from which day the comparison shows.
  function againstPart() {
    const longDay = (d) => fmt.parseDate(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const a = against(plan, fmt.today());
    if (!a) { const on = comingOn(plan, fmt.today()); return on ? ui.h("p", { class: "muted small", dataset: { path: "coming" } }, comingWords(on, longDay)) : null; }
    const m = (n) => fmt.money(Math.round(n), cur);
    const day = longDay(a.at);
    return ui.h("div", { class: "folds", style: { marginTop: "8px" } }, part(ctx, { id: "path", kind: "how", title: "Your earlier plan", says: statusWords(a, m), body: () => [
      ui.h("p", {}, sentenceOf(a, fmt.today(), m)),
      a.staleFrom ? ui.h("p", {}, staleWords(a, longDay)) : null,
      a.staleFrom ? ui.row(ui.h("a", { href: "#/balance/update", class: "btn secondary" }, "Update my balances")) : null,
      ui.h("ul", { class: "records" },
        ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, "Where that plan put you by today"), ui.h("span", { class: "rec-value" }, m(a.expected)))),
        ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, a.staleFrom ? "Your savings on file" : "Your savings today"), ui.h("span", { class: "rec-value" }, m(a.now))))),
      ui.h("p", { class: "muted small" }, `Both are in today's dollars. Savings here are the money your retirement plan draws on: bank accounts, investments and retirement accounts. A home or a car is not counted.`),
      ui.h("p", { class: "muted small" }, `The earlier plan is the one this page kept when you saved your totals on ${day}. It assumed steady saving and steady growth, so a good or a bad stretch for investments moves this as much as your own saving does.`),
    ] }));
  }
  const histOut = ui.h("div");
  const histSaid = said("history");
  if (histSaid) { histOut.append(histSaid); setTimeout(() => histSaid.remove(), 4000); }
  const overTime = empty ? null : ui.card("Over time",
    ui.h("p", { class: "muted small" }, "Save today's totals now and then (monthly is plenty). Each save becomes a point on your history; saving twice in one day just updates that day."),
    // one filled button on the screen: while the green line offers its filled way on, this one is outlined (review N3)
    ui.row(ui.button("Save today's totals", () => {
      // where today's retirement plan puts the savings in the years ahead, kept at most once a month (gap #35, path.js):
      // six months on, "Your earlier plan" below can say ahead or behind. Worked out before the save, written with it.
      const path = snapshotOf(plan, fmt.today());
      // the green line says so when this save keeps the plan too (a later day of a month that already has one keeps none;
      // nothing is promised about a few thousand dollars with no saving going in, which the comparison would pass over)
      pending = { card: "history", text: savedWords(wouldKeep(plan, path) && !tooSmall(plan, path, fmt.today())) };
      store.update((p) => {
      keepSnapshot(p, path);
      p.netWorthHistory = (p.netWorthHistory ?? []).filter((h) => h.date !== fmt.today());
      p.netWorthHistory.push({ date: fmt.today(), assets: d.assets, liabilities: d.liabilities, netWorth: d.netWorth });
      for (const a of p.accounts ?? []) { a.history = (a.history ?? []).filter((h) => h.date !== fmt.today()); a.history.push({ date: fmt.today(), balance: Number(a.balance) || 0 }); }   // per-account points feed investments/performance
    }); }, shownNote?.querySelector("a.btn:not(.secondary)") ? { class: "secondary" } : {})),
    histOut,
    againstPart(),
    d.history.length === 0 ? null : snapshots([...d.history].reverse()),
  );
  if (overTime) root.append(overTime);
  // the check-in's "save today's totals" step (#/balance/net-worth?at=history, MR-5): the Over time card in view, once per address
  if (fresh && q.at === "history" && !asked && !editing && overTime) overTime.scrollIntoView({ block: "start" });
  // a total saved on a bad day (a balance mistyped then) can be taken out; the accounts themselves are not touched
  function snapshots(list) {
    const drop = (h) => {
      if (!ui.confirm(`Remove the totals saved on ${fmt.date(h.date)}? Your accounts are not changed.`)) return;
      pending = { card: "history", text: `The totals of ${fmt.date(h.date)} are removed.` };
      store.update((p) => { p.netWorthHistory = (p.netWorthHistory ?? []).filter((x) => x.date !== h.date); dropSnapshot(p, h.date); });
    };
    return ui.h("div", {},
      ui.h("div", { class: "only-wide" }, ui.table([
        { key: "date", label: "Date", render: (h) => fmt.date(h.date) },
        { key: "assets", label: "You own", align: "right", render: (h) => fmt.money(h.assets, cur) },
        { key: "liabilities", label: "You owe", align: "right", render: (h) => fmt.money(h.liabilities, cur) },
        { key: "netWorth", label: "Net worth", align: "right", render: (h) => fmt.money(h.netWorth, cur) },
        { key: "actions", label: "", render: (h) => ui.button("Remove", () => drop(h), { class: "danger small" }) },
      ], list)),
      ui.h("ul", { class: "records only-narrow" }, list.map((h) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, fmt.date(h.date)), ui.h("span", { class: "rec-value" }, fmt.money(h.netWorth, cur))),
        ui.h("div", { class: "rec-sub" }, `You own ${fmt.money(h.assets, cur)} · you owe ${fmt.money(h.liabilities, cur)}`),
        ui.h("div", { class: "rec-foot" }, ui.button("Remove", () => drop(h), { class: "danger small" }))))));
  }
}

// Small line under "Invested for later": plain words at zero, no $0 parts otherwise.
function investedLine(d, fmt, cur) {
  if (!d.investable) return "nothing yet: retirement and investment accounts count here";
  const b = d.byTaxBucket;
  const parts = [];
  // (plain-words pass C10: "pre-tax" and "taxable" said as what they mean; the same three sums)
  if (b.deferred) parts.push(`${fmt.money(b.deferred, cur)} in retirement accounts, taxed when taken out`);
  if (b.free) parts.push(`${fmt.money(b.free, cur)} tax-free`);
  if (b.taxable) parts.push(`${fmt.money(b.taxable, cur)} in other investments`);
  return parts.join("; ");
}
