import re,sys
p=sys.argv[1]
s=open(p).read()
def rep(old,new,count=1):
    global s
    assert s.count(old)==count, (old, s.count(old))
    s=s.replace(old,new)
rep('''import { compute, applyProposal, buildPrompt, parseAnswer, KINDS } from "./compute.js";

// this visit's state (kept across the re-render after each accepted change; never saved)
let text = "", kind = "", personId = "", accountId = "", extra = {}, aiNote = "", pending = null;
const accepted = new Set();
''','''import { compute, applyProposal, buildPrompt, parseAnswer, KINDS } from "./compute.js";
import { NameOf } from "../../../core/words.js";

// this visit's state (kept across the re-render after each accepted change; never saved)
let text = "", kind = "", personId = "", accountId = "", extra = {}, aiNote = "", pending = null;
const accepted = new Set();
// the address this page last landed from (#/ai/reader?kind=paystub&person=<id>, the retirement card's "Read it from a pay
// stub ›"): its kind and person are taken once per arrival, as other pages' ?show= landings are (2026-11-11)
let landedFor = null;
// how often a paycheck comes, for a stub that does not say (the proposals' "a paycheck" and "a year")
const PAY_PERIODS = [{ value: "biweekly", label: "Every two weeks" }, { value: "semimonthly", label: "Twice a month" }, { value: "weekly", label: "Every week" }, { value: "monthly", label: "Every month" }];
const EVERY = { weekly: "every week", biweekly: "every two weeks", semimonthly: "twice a month", monthly: "every month" };
''')
rep('''  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const accounts = plan.accounts ?? [];
  const d = compute(plan, { text, kind: kind || undefined, personId, accountId, today: fmt.today(), extra });''','''  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const accounts = plan.accounts ?? [];
  // opened for one kind of paper (?kind=paystub) and maybe one person (?person=<id>): taken once per arrival; text kept from
  // an earlier visit that is another kind of paper is cleared, so the page opens on the pay stub it was asked for
  const q = ctx.route?.query ?? {};
  const asked = KINDS[q.kind] ? q.kind : "";
  if (ctx.route && landedFor !== ctx.route && (asked || q.person)) {
    landedFor = ctx.route;
    if (asked) {
      if (text && (kind || compute(plan, { text }).kind) !== asked) { text = ""; extra = {}; aiNote = ""; accepted.clear(); }
      kind = asked;
    }
    if (people.some((p) => p.id === q.person)) personId = q.person;
  }
  const d = compute(plan, { text, kind: kind || undefined, personId, accountId, today: fmt.today(), extra });''')
rep('''  const box = ui.h("textarea", { "aria-label": "The document's text", placeholder: "Paste the text here: open the PDF or the website, select all, copy, paste." }, text);''','''  const stub = (kind || d.kind) === "paystub";
  const box = ui.h("textarea", { "aria-label": stub ? "The pay stub's text" : "The document's text", placeholder: stub ? "Paste the pay stub here: open it on your employer's pay site or as a PDF, select all, copy, paste." : "Paste the text here: open the PDF or the website, select all, copy, paste." }, text);''')
rep('''      kind = ""; extra = {}; aiNote = ""; accepted.clear();
      page.replaceChildren(); render(page, ctx);
    } catch (e)''','''      kind = asked; extra = {}; aiNote = ""; accepted.clear();
      page.replaceChildren(); render(page, ctx);
    } catch (e)''')
rep('''    text ? null : ui.h("h1", {}, "Read a document"),
    ui.h("p", { class: text ? "muted small" : "lede" }, "A pay stub, an account statement, a Social Security statement or an advisor's plan: paste its text and the app finds the figures and shows what each would change. You accept each change yourself."),''','''    text ? null : ui.h("h1", {}, stub ? "Read your pay stub" : "Read a document"),
    ui.h("p", { class: text ? "muted small" : "lede" }, stub
      ? "Paste the text of your latest pay stub. The app finds your pay, the tax taken out and what goes into your 401(k): the part you pay the tax on later, any Roth part you pay the tax on now, and your employer's match. It shows what each would change, and you accept each change yourself."
      : "A pay stub, an account statement, a Social Security statement or an advisor's plan: paste its text and the app finds the figures and shows what each would change. You accept each change yourself."),''')
rep('''      text = box.value; kind = ""; extra = {}; aiNote = ""; accepted.clear(); page.replaceChildren(); render(page, ctx); }), ui.button(pcOk ? "Pick a PDF" : "Pick a text file", () => fileIn.click(), { class: "secondary" }), text ? ui.button("Clear", () => { text = ""; kind = ""; extra = {}; aiNote = ""; accepted.clear(); page.replaceChildren(); render(page, ctx); }, { class: "secondary" }) : null),''','''      text = box.value; kind = asked; extra = {}; aiNote = ""; accepted.clear(); page.replaceChildren(); render(page, ctx); }, text ? { class: "secondary" } : {}), ui.button(pcOk ? "Pick a PDF" : "Pick a text file", () => fileIn.click(), { class: "secondary" }), text ? ui.button("Clear", () => { text = ""; kind = asked; extra = {}; aiNote = ""; accepted.clear(); page.replaceChildren(); render(page, ctx); }, { class: "secondary" }) : null),''')
rep('''    ui.h("p", { class: "muted small" }, pcOk ? "The text stays on this page and is not saved. PDFs are read on your computer." : "The text stays on this page and is not saved.")));''','''    ui.h("p", { class: "muted small" }, `The text stays on this page and is not saved. Account numbers on it are never read or kept.${pcOk ? " PDFs are read on your computer." : ""}`)));''')
rep('''  const setup = ui.card("What it is", ui.field("Kind", kindSel));
  if (d.kind === "statement") setup.append(ui.field("Account", acctSel));
  else if (d.kind && people.length > 1) setup.append(ui.field("Whose", whoSel));''','''  const setup = ui.card("What it is", ui.field("Kind", kindSel));
  if (d.kind === "statement") setup.append(ui.field("Account", acctSel));
  else if (d.kind && people.length > 1) setup.append(ui.field("Whose", whoSel));
  // a stub that does not say how often it pays (no words, no period dates): asked here, so "a paycheck" becomes the right
  // amount a year; a stub that says it is not asked
  if (d.kind === "paystub" && (!d.fields.period || extra.period !== undefined)) {
    setup.append(ui.field("How often are you paid?", ui.select(PAY_PERIODS, d.fields.period ?? "biweekly", { "aria-label": "How often are you paid?", onChange: (e) => { extra = { ...extra, period: e.target.value }; page.replaceChildren(); render(page, ctx); } }), "This pay stub does not say."));
  }''')
rep('''  for (const x of d.proposals) {
    const done = accepted.has(x.id);
    const before = x.before ? Object.entries(x.before).filter(([k]) => k !== "yearly").map(([k, v]) => fmtVal(k, v)).join(", ") : "nothing yet";
    const after = Object.entries(x.after).filter(([k, v]) => k !== "yearly" && v !== null && v !== undefined).map(([k, v]) => fmtVal(k, v)).join(", ");
    props.append(ui.h("div", { class: `rd-prop${done ? " done" : ""}` },
      ui.h("div", { class: "rd-t" }, TITLES[x.op] ?? x.label),
      ui.h("div", { class: "rd-d" }, `Now: ${before}. Would be: ${after}.${x.after.yearly && x.before?.yearly ? ` That is ${money(Math.round(x.after.yearly))} a year instead of ${money(Math.round(x.before.yearly))}.` : ""}`),
      done ? ui.h("p", { class: "muted small" }, "Done.") : ui.button("Use it", () => {
        accepted.add(x.id);
        pending = `${TITLES[x.op] ?? "Change"} saved.`;
        store.update((p) => applyProposal(p, x, { newId: () => ui.uid() }));
      })));
  }
  root.append(props);''','''  // the first change not used yet is the screen's one filled button; the others are outlined (one filled button per screen)
  const next = d.proposals.find((x) => !accepted.has(x.id))?.id ?? null;
  for (const x of d.proposals) {
    const done = accepted.has(x.id);
    const title = titleOf(x);
    let desc;
    if (x.op === "work") desc = workWords(x);
    else {
      const before = x.before ? Object.entries(x.before).filter(([k]) => k !== "yearly").map(([k, v]) => fmtVal(k, v)).join(", ") : "nothing yet";
      const after = Object.entries(x.after).filter(([k, v]) => k !== "yearly" && v !== null && v !== undefined).map(([k, v]) => fmtVal(k, v)).join(", ");
      desc = `Now: ${before}. Would be: ${after}.${x.after.yearly && x.before?.yearly ? ` That is ${money(Math.round(x.after.yearly))} a year instead of ${money(Math.round(x.before.yearly))}.` : ""}`;
    }
    // the change just used says so where it was tapped (the shell keeps the screen where it was)
    const said = done && pending?.id === x.id ? ui.notice("ok", pending.text) : null;
    props.append(ui.h("div", { class: `rd-prop${done ? " done" : ""}` },
      ui.h("div", { class: "rd-t" }, title),
      ui.h("div", { class: "rd-d" }, desc),
      said ?? (done ? ui.h("p", { class: "muted small" }, "Done.") : ui.button("Use it", () => {
        accepted.add(x.id);
        pending = { id: x.id, text: savedWords(x, title) };
        store.update((p) => applyProposal(p, x, { newId: () => ui.uid() }));
      }, x.id === next ? {} : { class: "secondary" }))));
  }
  if (pending?.id === undefined && pending) pending = null;
  else if (pending) pending = null;
  root.append(props);''')
rep('''  function fmtVal(k, v) {''','''  // the person a pay stub's 401(k) change is for, in a heading: "Casey's", "Your"
  function whoseOf(x) { return NameOf(people.find((p) => p.id === x.personId)?.name); }
  function titleOf(x) {
    if (x.op !== "work") return TITLES[x.op] ?? x.label;
    if (x.employerMatch !== undefined) return `${whoseOf(x)} employer's match`;
    if (x.side === "now") return `${whoseOf(x)} Roth 401(k), pay the tax now`;
    return x.zero ? `${whoseOf(x)} 401(k), pay the tax later: none on this stub` : `${whoseOf(x)} 401(k), pay the tax later`;
  }
  // a pay stub's 401(k) change in words: what is on file, what it would be a paycheck and a year, and where it goes
  function workWords(x) {
    const paid = (amount, period) => `${fmt.money(amount, cur, undefined, 2)} ${EVERY[period] ?? "a paycheck"}`;
    const where = x.make === "account" ? ` into a new account, ${x.accountName}, at $0 until you type its balance on Net worth` : x.make === "row" ? ` into ${x.accountName}` : "";
    if (x.employerMatch !== undefined) {
      const now = x.before.matchYearly > 0 ? `${money(Math.round(x.before.matchYearly))} a year${x.before.onNow > 0 ? " on the Roth 401(k)" : ""}` : "no match on file";
      return `Now: ${now}. Would be: ${paid(x.perPaycheck, x.period)}, about ${money(Math.round(x.employerMatch))} a year${where}. Most plans add the employer's money as pay-the-tax-later, so it goes there${x.before.onNow > 0 ? " and comes off the Roth 401(k)" : ""}.`;
    }
    const before = x.before && x.before.yearly > 0 ? paid(x.before.amount, x.before.period) : "nothing goes in on file";
    if (x.zero) return `Now: ${before}. This pay stub has a Roth 401(k) line and no line for money you pay the tax on later, so it would be nothing. Use it if the money on file is the same Roth money.`;
    return `Now: ${before}. Would be: ${paid(x.amount, x.period)}${where}. That is ${money(Math.round(x.after.yearly))} a year${x.before?.yearly > 0 ? ` instead of ${money(Math.round(x.before.yearly))}` : ""}.`;
  }
  // the confirmation, said where "Use it" was tapped
  function savedWords(x, title) {
    if (x.op !== "work") return `${title} saved.`;
    const made = x.make === "account" ? ` ${x.accountName} is on Net worth at $0: type its balance there.` : "";
    return `${title}: saved.${made} What you save for retirement shows it.`;
  }

  function fmtVal(k, v) {''')
open(p,'w').write(s)
