// modules/ai/reader/view.js -- DOM only. Paste the text of a document (or pick a PDF, read on the PC),
// see the figures found and what each would change in the plan, and accept the ones that are right.
// The AI can look for the figures the labels missed; nothing reaches the plan without a tap. The text
// is kept only while this page is open, never saved.
// A pay stub (round-1 review, 2026-11-12): the changes come first and what was read sits in a fold under them; whose stub
// it is and how often it pays are said in one quiet line with a way to change them, and asked only when the stub and the
// plan cannot tell; a used card stays where it was with what it changed; a figure that cannot be right gets no "Use it".
import { compute, applyProposal, buildPrompt, parseAnswer, KINDS } from "./compute.js";
import { NameOf, nameOf } from "../../../core/words.js";

// this visit's state (kept across the re-render after each accepted change; never saved)
let text = "", draft = "", kind = "", personId = "", accountId = "", extra = {}, aiNote = "", aiErr = false;
// figures the person typed themself ("Set my own number"), the job a stub is from, the account a new row goes into
const typed = new Set();
let jobRowId = null, accountFor = {};
// the changes used on this visit: id -> { title, was, now, said: [text or link], at } so a used card stays in its place,
// says what it changed, and nothing slides under the thumb (review P6, P11); cleared when what the cards mean changes
const used = new Map();
// the address this page last landed from (#/ai/reader?kind=paystub&person=<id>, the retirement card's "Read it from a pay
// stub ›"): its kind and person are taken once per arrival, as other pages' ?show= landings are (2026-11-11)
let landedFor = null, landedPerson = "";
// "Read it" was just tapped: the changes come to the top of the screen once (at 320 px they were below it; review P13)
let justRead = false;
// the folds a person opened on this visit ("1 more change", the pasted text): the page re-renders after each "Use it", and a
// fold opened to use a change inside it stays open (simple first, 2026-11-13; never saved, and opening changes nothing)
const opened = new Set();
// at most this many changes show before "N more changes" (the owner's rule of 2026-11-12: the least a person needs first)
const FIRST = 3;
// how often a paycheck comes
const PAY_PERIODS = [{ value: "biweekly", label: "Every two weeks" }, { value: "semimonthly", label: "Twice a month" }, { value: "weekly", label: "Every week" }, { value: "monthly", label: "Every month" }];
const EVERY = { weekly: "every week", biweekly: "every two weeks", semimonthly: "twice a month", monthly: "every month", quarterly: "every quarter", annual: "a year" };
const TIMES = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };

const STYLE = `
.rd-root textarea { width: 100%; min-height: 160px; font: inherit; font-size: max(16px, var(--fs)); }   /* 16 px or more: an iPhone zooms the page on a smaller box */
.rd-root .rd-found { list-style: none; margin: 0; padding: 0; }
.rd-root .rd-found li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.rd-root .rd-found li:last-child { border-bottom: 0; }
.rd-root .rd-found b { white-space: nowrap; }
.rd-root .rd-found .rd-parts { display: block; color: var(--text-2); font-size: var(--fs-xs); }
.rd-root .rd-ai { color: var(--accent-ink, var(--accent)); font-size: var(--fs-xs); margin-left: 6px; }
.rd-root .rd-prop { border: 1px solid var(--line); border-radius: var(--radius); padding: 12px; margin: 10px 0; }
/* a used card: its words step back, its confirmation stays at full strength (review P10) */
.rd-root .rd-prop.done > .rd-t, .rd-root .rd-prop.done > .rd-d { opacity: .6; }
.rd-root .rd-prop .rd-t { font-weight: 650; margin-bottom: 4px; }
.rd-root .rd-prop .rd-d { color: var(--text-2); font-size: var(--fs-sm); margin-bottom: 8px; }
.rd-root .rd-prop .notice { margin: 0 0 8px; }
.rd-root .rd-prop .notice:last-child { margin-bottom: 0; }
.rd-root .rd-ask { font-weight: 600; margin: 10px 0 6px; }
.rd-root .rd-why { color: var(--text-2); font-size: var(--fs-sm); margin: 0 0 8px; }
.rd-root h2:focus { outline: none; }
.rd-root .rd-same { color: var(--text-2); font-size: var(--fs-sm); margin: 10px 0 0; }
/* "What the app read on it": its count (and what the AI did) may wrap under a 320 px heading instead of pushing it off */
.rd-root .rd-found-fold > summary .fold-status { white-space: normal; text-align: right; max-width: 45%; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store, api, ai } = ctx;
  // the household's view (core/view.js) offers the PC's PDF reader and the AI only while they answer
  const pcOk = ctx.view.build || ctx.live.pc, aiOk = ctx.view.build || ctx.live.ai;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const cents = (n) => fmt.money(n, cur, undefined, 2);
  const root = ui.h("div", { class: "rd-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const again = () => { page.replaceChildren(); render(page, ctx); };
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const accounts = plan.accounts ?? [];
  // a new paper starts over: nothing typed, picked or used for the one before it carries on
  const fresh = () => { extra = {}; typed.clear(); aiNote = ""; aiErr = false; used.clear(); jobRowId = null; accountFor = {}; personId = landedPerson; };
  // what the cards mean changed (whose it is, how often it pays, which job): cards used before are not "done" for the new reading (review B7)
  const changed = () => { used.clear(); again(); };
  // opened for one kind of paper (?kind=paystub) and maybe one person (?person=<id>): taken once per arrival; text kept from
  // an earlier visit that is another kind of paper is cleared, so the page opens on the pay stub it was asked for
  const q = ctx.route?.query ?? {};
  const asked = KINDS[q.kind] ? q.kind : "";
  if (ctx.route && landedFor !== ctx.route) {
    landedFor = ctx.route;
    landedPerson = people.some((p) => p.id === q.person) ? q.person : "";
    if (asked) {
      if (text && (kind || compute(plan, { text }).kind) !== asked) { text = ""; fresh(); }
      kind = asked;
    } else if (!text) kind = "";   // a plain arrival with nothing pasted: the general page, not the last landing's pay stub
    if (landedPerson) personId = landedPerson;
  }
  const d = compute(plan, { text, kind: kind || undefined, personId, accountId, today: fmt.today(), extra, typed: [...typed], jobRowId, accountFor });
  const isStub = (kind || d.kind) === "paystub";
  const st = d.stub;
  const person = people.find((p) => p.id === (st?.personId ?? personId)) ?? null;
  const Whose = NameOf(person?.name), whose = nameOf(person?.name);
  // "$110.77 every two weeks"; a yearly figure in whole dollars ("$72,000 a year")
  const paid = (amount, period) => (period === "annual" ? `${money(amount)} a year` : `${cents(amount)} ${EVERY[period] ?? "a paycheck"}`);
  const link = (href, label) => ui.h("a", { href }, label);
  // a quiet fold: a summary line (title, a short status, the chevron) and what sits behind it; opened on this visit, it stays open
  const fold = (key, title, status, body, { cls = "fold", open = false, h2 = false } = {}) => {
    const d = ui.h("details", { class: cls, open: open || opened.has(key) ? true : null },
      ui.h("summary", {}, h2 ? ui.h("h2", {}, title) : ui.h("span", { class: "fold-title" }, title), status ? ui.h("span", { class: "fold-status" }, status) : null, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" }, ...[].concat(body)));
    d.addEventListener("toggle", () => { if (d.open) opened.add(key); else opened.delete(key); });
    return d;
  };
  // a pay stub's lines to the cent, as printed ($110.77, not $111); dates as the rest of the app writes them
  const show = (unit, v) => (unit === "money" ? (isStub ? cents(v) : money(v)) : unit === "percent" ? `${Math.round(v * 1000) / 10}%` : unit === "date" ? fmt.date(v) : String(v));

  // ---- 1. the document
  const box = ui.h("textarea", { "aria-label": isStub ? "The pay stub's text" : "The document's text", placeholder: isStub ? "Paste the pay stub here: open it on your employer's pay site or as a PDF, select all, copy, paste." : "Paste the text here: open the PDF or the website, select all, copy, paste." }, text || draft);
  // what is pasted and not read yet is kept for this visit, so Back and Forward do not lose it (review N8)
  box.addEventListener("input", () => { draft = box.value; });
  const fileIn = ui.h("input", { type: "file", accept: pcOk ? ".pdf,.txt,application/pdf,text/plain" : ".txt,text/plain", "aria-label": pcOk ? "A PDF or text file" : "A text file", style: { display: "none" } });
  const status = ui.h("div");
  const readNow = (t) => { text = t; draft = ""; kind = asked; fresh(); opened.clear(); justRead = true; again(); };
  fileIn.addEventListener("change", async () => {
    const f = fileIn.files?.[0]; if (!f) return;
    status.replaceChildren(ui.notice("info", `Reading ${f.name}...`));
    try {
      if (/\.txt$/i.test(f.name) || f.type.startsWith("text/")) readNow(await f.text());
      else {
        const buf = new Uint8Array(await f.arrayBuffer());
        let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        readNow((await api.readDocumentText({ fileName: f.name, mime: f.type, dataBase64: btoa(bin) })).text);
      }
    } catch (e) { status.replaceChildren(ui.notice("error", `${e.message ?? e}. You can also paste the text instead.`)); }
  });
  const landed = people.find((p) => p.id === landedPerson);
  const readBtn = ui.button("Read it", () => {
    // nothing pasted: say so at the box instead of doing nothing (stress test T7, 2026-11-11)
    if (!box.value.trim()) { status.replaceChildren(ui.notice("warn", "Paste the document's text in the box first.")); box.focus(); return; }
    readNow(box.value); }, text ? { class: "secondary" } : {});
  const privacy = ui.h("p", { class: "muted small" }, `The text stays on this page and is not saved. Account numbers on it are never read or kept.${pcOk ? " PDFs are read on your computer." : ""}`);
  // simple first (2026-11-13): picking a file instead of pasting is one quiet tap away
  const moreWays = fold("ways", "More options", null, [
    ui.h("p", { class: "small", style: { margin: "0 0 8px" } }, isStub ? "The app finds your pay, the tax taken out, your 401(k) and Roth 401(k) money and your employer's match. You can also pick a text file instead of pasting." : `It finds the figures a pay stub, an account statement, a Social Security statement or an advisor's plan holds. You can also pick ${pcOk ? "a PDF or a text file" : "a text file"} instead of pasting.`),
    ui.row(ui.button(pcOk ? "Pick a PDF" : "Pick a text file", () => fileIn.click(), { class: "secondary" }))]);
  if (!text) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, isStub ? (landed && people.length > 1 ? `Read ${nameOf(landed.name)} pay stub` : "Read your pay stub") : "Read a document"),
      ui.h("p", { class: "lede" }, isStub ? "Paste the text of your latest pay stub. You see what each figure would change, and you use only the ones that are right." : "Paste the text of a pay stub, a statement or a plan. You see what each figure would change, and you use only the ones that are right."),
      box, ui.row(readBtn), fileIn, status, moreWays, privacy));
    return;
  }
  // read: the pasted text folds away under the changes' card (one tap opens it to read again, paste another or clear)
  const docFold = fold("doc", isStub ? "The pay stub you pasted" : "The text you pasted", "Paste another", [box,
    ui.row(readBtn, ui.button("Clear", () => { text = ""; draft = ""; kind = asked; fresh(); opened.clear(); again(); }, { class: "secondary" })), fileIn, status, moreWays, privacy], { cls: "card fold fold-card" });

  const kindSel = ui.select([{ value: "", label: d.detected ? `Looks like: ${KINDS[d.detected].label.toLowerCase()}` : "What is it?" }, ...Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label }))], kind, { "aria-label": "Kind of document", onChange: (e) => { kind = e.target.value; extra = {}; typed.clear(); aiNote = ""; aiErr = false; changed(); } });
  const whoSel = ui.select(people.map((p) => ({ value: p.id, label: p.name })), person?.id ?? "", { "aria-label": "Whose", onChange: (e) => { personId = e.target.value; jobRowId = null; changed(); } });
  // after "Read it": the card that answers comes to the top once, and its heading takes the focus
  const arrive = (card) => { if (!justRead) return; justRead = false; requestAnimationFrame(() => { card.scrollIntoView({ block: "start" }); const h = card.querySelector("h2"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } }); };

  // ---- what was found (the AI can look for the rest)
  const foundList = () => (d.found.length ? ui.h("ul", { class: "rd-found" }, d.found.map((f) => ui.h("li", {},
    ui.h("span", {}, f.label, typed.has(f.key) ? ui.h("span", { class: "rd-ai" }, "typed by you") : extra[f.key] !== undefined && f.key !== "period" ? ui.h("span", { class: "rd-ai" }, "from the AI: check it") : null,
      f.parts ? ui.h("span", { class: "rd-parts" }, f.parts.map((x) => `${x.catchUp ? "catch-up" : f.key === "roth401k" ? "Roth" : f.key === "match" ? "match" : "401(k)"} ${cents(x.amount)}`).join(" + ")) : null),
    ui.h("b", {}, show(f.unit, f.value))))) : ui.h("p", { class: "muted" }, "None of the usual labels are in the text."));
  const foundRest = () => [
    d.missing.length ? ui.h("p", { class: "muted small" }, `Not found: ${d.missing.map((l) => (/^(Roth|Social)\b/.test(l) ? l : l[0].toLowerCase() + l.slice(1))).join("; ")}.`) : null,
    d.missing.length && aiOk ? ui.row(ui.button("Ask the AI to find the rest", async (e) => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Asking...";
      try {
        const answer = await ai.chat(buildPrompt(d.kind, text));
        const got = parseAnswer(d.kind, answer.content);
        const add = Object.fromEntries(Object.entries(got).filter(([k]) => d.fields[k] === undefined));
        extra = { ...extra, ...add };
        aiNote = Object.keys(add).length ? `The AI found ${Object.keys(add).length} more. Check them against the document.` : "The AI found nothing more."; aiErr = false;
      } catch (err) { aiNote = `The AI is not available: ${err.message ?? err}. Settings has the AI connection.`; aiErr = true; }
      // its answer, or its error, shows where the person tapped: the fold it sits in stays open (fix round 3, F3)
      opened.add("found");
      again();
    }, { class: "secondary" })) : null,
    aiNote ? ui.notice(aiErr ? "error" : "info", aiNote) : null];

  // ---- any paper but a pay stub: what it is, what was found, what it would change (as before)
  if (d.kind !== "paystub") {
    const acctSel = ui.select([{ value: "", label: "Which account?" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))], accountId, { "aria-label": "Which account", onChange: (e) => { accountId = e.target.value; again(); } });
    const setup = ui.card("What it is", ui.field("Kind", kindSel));
    if (d.kind === "statement") setup.append(ui.field("Account", acctSel));
    else if (d.kind && people.length > 1) setup.append(ui.field("Whose", whoSel));
    root.append(setup);
    arrive(setup);
    if (!d.kind) { root.append(ui.notice("info", "Pick what kind of document it is above."), docFold); return; }
    root.append(ui.card(`Found in it (${d.found.length} of ${d.found.length + d.missing.length})`, foundList(), ...foundRest()));
    const props = ui.card("What it would change");
    if (!d.proposals.length) props.append(ui.h("p", { class: "muted" }, d.kind === "statement" && !accountId ? "Pick the account above." : "Nothing to change from what was found."));
    const next = d.proposals.find((x) => !used.has(x.id) && !x.same)?.id ?? null;
    for (const x of d.proposals) {
      const u = used.get(x.id), title = TITLES[x.op] ?? x.label;
      const before = x.before ? Object.entries(x.before).filter(([k]) => k !== "yearly").map(([k, v]) => fmtVal(k, v)).join(", ") : "nothing yet";
      const after = Object.entries(x.after).filter(([k, v]) => k !== "yearly" && v !== null && v !== undefined).map(([k, v]) => fmtVal(k, v)).join(", ");
      const desc = u ? `Was: ${u.was}. Now: ${u.now}.` : x.same ? "Already on file. Nothing to change." : `Now: ${before}. Would be: ${after}.`;
      props.append(ui.h("div", { class: `rd-prop${u ? " done" : ""}` }, ui.h("div", { class: "rd-t" }, title), ui.h("div", { class: "rd-d" }, desc),
        u ? ui.notice("ok", `${title} saved.`) : x.same ? null : ui.button("Use it", () => {
          used.set(x.id, { was: before, now: after });
          store.update((p) => applyProposal(p, x, { newId: () => ui.uid() }));
        }, x.id === next ? {} : { class: "secondary" })));
    }
    root.append(props);
    if (d.kind === "advisor") root.append(ui.card(null, ui.row(ui.h("a", { class: "btn secondary", href: "#/scenarios/advisor-plan" }, "Compare it on Advisor's plan"))));
    root.append(docFold);
    return;
  }

  // ---- a pay stub: the changes first
  const props = ui.card("What it would change");
  root.append(props);
  arrive(props);
  // one quiet line: whose stub, how often it pays; the boxes to change them sit behind it
  const periodSel = ui.select([...(st.period ? [] : [{ value: "", label: "Not sure" }]), ...PAY_PERIODS], st.period ?? "", { "aria-label": "How often are you paid?", onChange: (e) => { if (e.target.value) extra = { ...extra, period: e.target.value }; changed(); } });
  const periodHelp = st.periodWhy === "dates" ? "From the pay period's dates on the stub." : st.periodWhy === "words" ? "The stub says so." : st.periodWhy === "you" ? "You picked this." : st.periodWhy === "pay" ? "Worked out from your pay on file." : "This pay stub does not say.";
  props.append(ui.h("details", { class: "fold" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, `${person ? `${Whose} pay stub` : "A pay stub"}${st.period ? `, paid ${EVERY[st.period]}` : ""}`), ui.h("span", { class: "fold-status" }, "Change"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "form fold-body" }, ui.field("Kind", kindSel), people.length > 1 ? ui.field("Whose", whoSel) : null, ui.field("How often are you paid?", periodSel, periodHelp))));
  // why the app took it so, when it worked it out itself (review P2, P4)
  // (one line, not two, when both come from the pay on file: simple first)
  const byPay = st.periodWhy === "pay" ? `${cents(d.fields.gross)} x ${TIMES[st.period]} is ${whose} ${money(st.payOnFile)} a year` : null;
  if (people.length > 1 && st.who === "pay" && byPay) props.append(ui.h("p", { class: "rd-why" }, `This looks like ${whose} pay stub, paid ${EVERY[st.period]}: ${byPay}. Change it above if that is wrong.`));
  else {
    if (people.length > 1 && st.who === "pay") props.append(ui.h("p", { class: "rd-why" }, `This looks like ${whose} pay stub: its pay matches ${whose} ${money(st.payOnFile)} a year.`));
    if (byPay) props.append(ui.h("p", { class: "rd-why" }, `Taken as paid ${EVERY[st.period]}: ${byPay}. Change it above if that is wrong.`));
  }
  if (people.length > 1 && st.who === "name") props.append(ui.h("p", { class: "rd-why" }, `This looks like ${whose} pay stub: it names ${person.name}.`));

  // ---- questions the stub and the plan cannot answer: asked here, above the changes, as chips
  if (st.noPeople) {
    props.append(ui.notice("info", "Add yourself on People first; then the pay and 401(k) lines on this stub can be used."), ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "Add yourself")));
    root.append(foundCard(false), docFold);
    return;
  }
  if (st.ask) {
    props.append(ui.h("p", { class: "rd-ask" }, "Whose pay stub is this?"),
      ui.h("div", { class: "chips", role: "group", "aria-label": "Whose pay stub is this?" }, st.ask.map((p) => ui.h("button", { type: "button", class: "chip", onClick: () => { personId = p.id; jobRowId = null; changed(); } }, p.name))),
      ui.h("p", { class: "muted small" }, "The stub does not name either of you, and its pay matches neither pay on file. Nothing is changed until you say."));
    root.append(foundCard(false), docFold);
    return;
  }
  const waits = d.proposals.some((x) => x.needsPeriod);
  if (waits) props.append(ui.h("p", { class: "rd-ask" }, "How often are you paid?"),
    ui.h("div", { class: "chips", role: "group", "aria-label": "How often are you paid?" }, PAY_PERIODS.map((o) => ui.h("button", { type: "button", class: "chip", onClick: () => { extra = { ...extra, period: o.value }; changed(); } }, o.label))),
    ui.h("p", { class: "muted small" }, `This pay stub does not say${st.payOnFile ? `, and ${cents(d.fields.gross)} a paycheck fits ${whose} ${money(st.payOnFile)} a year in none of these` : ""}. The yearly figures need it.`));
  if (st.jobs) props.append(ui.h("p", { class: "rd-ask" }, "Which job is this pay stub from?"),
    ui.h("div", { class: "chips", role: "group", "aria-label": "Which job is this pay stub from?" }, st.jobs.map((j) => ui.h("button", { type: "button", class: `chip${j.rowId === st.jobRowId ? " on" : ""}`, "aria-pressed": j.rowId === st.jobRowId ? "true" : "false", onClick: () => { jobRowId = j.rowId; changed(); } }, j.name))));
  // ---- cautions: the pay looks like someone else's, or this paycheck is not like the usual one. No filled button then.
  if (st.other) props.append(ui.notice("warn", `This stub's pay (${money(st.stubYearly ?? 0)} a year) matches ${nameOf(st.other.name)} ${money(st.other.yearly)} on file, not ${whose} ${money(st.payOnFile)}. If it is ${nameOf(st.other.name)} stub, say so before using anything.`),
    ui.row(ui.button(`It is ${nameOf(st.other.name)} pay stub`, () => { personId = st.other.id; jobRowId = null; changed(); }, { class: "secondary" })));
  else if (st.odd) props.append(ui.notice("warn", st.stubYearly > st.payOnFile
    ? `This paycheck is bigger than ${whose} usual pay (a bonus or overtime?): ${cents(d.fields.gross)} ${EVERY[st.period]} would be ${money(st.stubYearly)} a year, and ${money(st.payOnFile)} is on file. The yearly figures below would assume every paycheck is like it.`
    : `This paycheck is smaller than ${whose} usual pay (unpaid days?): ${cents(d.fields.gross)} ${EVERY[st.period]} would be ${money(st.stubYearly)} a year, and ${money(st.payOnFile)} is on file. The yearly figures below would assume every paycheck is like it.`));
  const careful = !!st.other || !!st.odd;

  // ---- the changes
  const isWork = (id) => ["k401", "roth401k", "match"].includes(id);
  // simple first (2026-11-13): the 401(k) lines the owner asked about come first (the match, a hint worth money, is never
  // folded), then the pay, then the tax taken out; at most FIRST of them show, the rest wait behind "N more changes"; a
  // change that is already on file is one quiet line, not a card
  const RANK = { k401: 0, roth401k: 1, match: 2, pay: 4, withholding: 5 };
  const SHORT = { k401: "401(k)", roth401k: "Roth 401(k)", match: "the match", pay: "pay", withholding: "tax taken out" };
  const shown = d.proposals.filter((x) => used.has(x.id) || !x.same).map((x, i) => ({ x, i })).sort((a, b) => (RANK[a.x.id] ?? 9) - (RANK[b.x.id] ?? 9) || a.i - b.i).map((o) => o.x);
  const sameOnes = d.proposals.filter((x) => x.same && !used.has(x.id));
  // the first plain change not used yet, in the order shown, is the screen's one filled button; a question, a doubt or a caution never is
  const plain = (x) => !used.has(x.id) && !x.same && !x.needsPeriod && !x.suspect && !x.move && !x.alone && !x.twoJobs;
  const next = careful ? null : shown.find(plain)?.id ?? null;
  // every card is built into this list, then the first FIRST go on the card and the rest into the fold
  const items = [];
  // the person's own money a year on this stub and on file, above the 401(k) cards (review M12)
  const ownLine = () => {
    // (not beside a figure the page does not trust, or one that still waits for the pay rhythm)
    // (and not above the Roth-only question, whose card already says both figures)
    if (!st.own || d.proposals.some((x) => isWork(x.id) && (x.suspect || x.needsPeriod || (x.move && !used.has(x.id))))) return null;
    const differ = Math.abs(st.own.stub - st.own.file) > 1, some = [...used.keys()].some(isWork);
    // with one line of the person's own money its card already says both figures: the total is said when there are two
    // (the 401(k) and the Roth 401(k)), and in amber once a card was used and the two still differ (review M12)
    const two = d.proposals.filter((x) => x.id === "k401" || x.id === "roth401k").length > 1;
    if (!two && !(some && differ)) return null;
    if (some && differ) return ui.h("div", { class: "notice warn" }, `This stub shows ${money(st.own.stub)} a year of ${whose} own money; the plan now says ${money(st.own.file)}. If that is not what goes in, use the other changes too, or fix it on `, link("#/retirement/contributions", "What you save for retirement ›"), ".");
    return ui.h("p", { class: "rd-why" }, `This stub: ${money(st.own.stub)} a year of ${whose} own money. On file now: ${differ ? money(st.own.file) : "the same"}.`);
  };
  const partsOf = (key) => { const f = d.found.find((y) => y.key === key); return f?.parts ? ` (${f.parts.map((y) => `${y.catchUp ? "catch-up" : key === "roth401k" ? "Roth" : "401(k)"} ${cents(y.amount)}`).join(" + ")})` : ""; };
  // a box to type the right number for a line the app could not trust or read
  const ownNumber = (key, label) => {
    const { box: mb, input } = ui.moneyBox({ label, placeholder: "this paycheck", min: 0 });
    const msg = ui.h("div");
    return ui.h("details", { class: "fold" },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Set my own number"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("div", { class: "form" }, ui.field(label, mb, "What goes in from one paycheck, as the stub's “current” or “this period” column shows it.")), msg,
        ui.row(ui.button("Use this number", () => {
          const v = ui.moneyValue(input);
          if (v === null || !(v > 0)) { msg.replaceChildren(ui.notice("warn", "Type the amount from one paycheck, like 110.77.")); input.focus(); return; }
          extra = { ...extra, [key]: v }; typed.add(key); used.delete(key); again();
        }, { class: "secondary" }))));
  };
  const use = (x, was, now, said) => { used.set(x.id, { title: titleOf(x), was, now, said }); store.update((p) => applyProposal(p, x, { newId: () => ui.uid() })); };
  const titleOf = (x) => {
    if (x.op === "income") return `${Whose} pay${x.incomeName ? ` (${x.incomeName})` : ""}`;
    if (x.op === "withholding") return `${Whose} federal tax taken out of each paycheck`;
    if (x.employerMatch !== undefined) return `${Whose} employer's match${st.jobs ? ` (${x.accountName})` : ""}`;
    if (x.side === "now") return x.move ? `${Whose} 401(k) money is Roth on this stub` : `${Whose} Roth 401(k), pay the tax now`;
    return `${Whose} 401(k), pay the tax later${st.jobs ? ` (${x.accountName})` : ""}`;
  };
  const yearOf = (b) => (b?.yearly > 0 && b.period !== "annual" ? ` (${money(Math.round(b.yearly))} a year)` : "");
  const where = (x) => (x.make === "account" ? ` into a new account, ${x.accountName}, at $0 until you type its balance on Net worth` : x.make === "row" ? ` into ${x.accountName}` : "");
  for (const x of shown) {
    const u = used.get(x.id), title = titleOf(x);
    if (u) {
      items.push({ x, used: true, el: ui.h("div", { class: "rd-prop done" }, ui.h("div", { class: "rd-t" }, u.title), ui.h("div", { class: "rd-d" }, `Was: ${u.was}. Now: ${u.now}.`), ui.h("div", { class: "notice ok" }, ...u.said)) });
      continue;
    }
    const card = ui.h("div", { class: "rd-prop" }, ui.h("div", { class: "rd-t" }, title));
    const say = (t) => card.append(ui.h("div", { class: "rd-d" }, t));
    const useBtn = (label, onClick, filled) => ui.button(label, onClick, filled ? {} : { class: "secondary" });
    items.push({ x, el: card, warn: !!(x.suspect || x.alone) });
    // what is on file and what it would be, in words
    let was, now;
    if (x.op === "income") { was = x.before ? `${paid(x.before.amount, x.before.period)}${yearOf(x.before)}` : "nothing on file"; now = `${paid(x.amount, x.period)}${yearOf(x.after)}`; }
    else if (x.op === "withholding") { was = x.before ? paid(x.before.perPaycheck, x.before.period) : "nothing on file"; now = paid(x.perPaycheck, x.period); }
    else if (x.employerMatch !== undefined) { was = x.before.matchYearly > 0 ? `${money(Math.round(x.before.matchYearly))} a year${x.before.onNow > 0 ? " on the Roth 401(k)" : ""}${x.before.guess ? " (our guess)" : ""}` : "no match on file"; now = `${paid(x.perPaycheck, x.period)}, about ${money(Math.round(x.employerMatch))} a year`; }
    else { was = x.before && x.before.yearly > 0 ? `${paid(x.before.amount, x.before.period)}${yearOf(x.before)}${x.before.guess ? " (our guess)" : ""}` : "nothing goes in on file"; now = `${paid(x.amount, x.period)}${yearOf(x.after)}`; }
    const savedLinks = isWork(x.id)
      ? [`${title}: saved. `, ...(x.make === "account" ? [`${x.accountName} is on `, link("#/balance/net-worth", "Net worth ›"), " at $0: type its balance there. "] : []), link("#/retirement/contributions", "What you save for retirement ›"), " shows it."]
      : [`${title}: saved.`];
    if (x.needsPeriod) { say(`This stub: ${cents(x.amount ?? x.perPaycheck)} a paycheck${isWork(x.id) ? partsOf(x.id) : ""}. On file: ${was}.`); card.append(ui.h("p", { class: "muted small", style: { margin: "0" } }, "Say how often you are paid, above, to use this.")); continue; }
    if (x.suspect) {
      say(`On file: ${was}. This stub's line reads ${cents(x.amount ?? x.perPaycheck)}.`);
      card.append(ui.notice("warn", x.suspect === "pay"
        ? `This looks like the wrong line: ${cents(x.amount ?? x.perPaycheck)} is ${(x.amount ?? x.perPaycheck) >= d.fields.gross ? "as much as the whole paycheck" : "half of this paycheck or more"} (${cents(d.fields.gross)} before tax). It may be a wages line or the year-to-date figure: check the stub.`
        : `${cents(x.amount)} ${EVERY[x.period]} would be ${money(Math.round(x.after.yearly))} a year, more than the ${money(x.limit)} a person may put in this year. It may be the year-to-date figure: check the stub.`),
      ownNumber(x.id, x.id === "match" ? "The employer's match this paycheck" : x.id === "roth401k" ? "Roth 401(k) this paycheck" : "401(k) this paycheck"));
      continue;
    }
    if (x.move) {
      // one card, one question: is the money on file this same Roth money? Either answer is one tap; neither is the filled button
      const m = x.move, mWas = `${paid(m.amount, m.period)}${yearOf(m)}, pay the tax later${m.guess ? " (our guess)" : ""}`;
      say(`On file: ${mWas}. This stub shows ${paid(x.amount, x.period)}${partsOf("roth401k")} going in as Roth (pay the tax now), ${money(Math.round(x.after.yearly))} a year, and no pay-the-tax-later line. Is it the same money?`);
      card.append(ui.row(
        useBtn("Yes, it is the same money", () => use({ ...x, zeroLater: m.rowId }, mWas, `${paid(x.amount, x.period)}${yearOf(x.after)}, Roth (pay the tax now)`,
          [`${Whose} saving is now Roth: ${paid(x.amount, x.period)} (was ${paid(m.amount, m.period)}, pay the tax later). `, ...(x.make === "account" ? [`${x.accountName} is on `, link("#/balance/net-worth", "Net worth ›"), " at $0. "] : []), link("#/retirement/contributions", "What you save for retirement ›"), " shows it."]), false),
        useBtn("No, both go in", () => use(x, x.before && x.before.yearly > 0 ? paid(x.before.amount, x.before.period) : "no Roth money on file", `${paid(x.amount, x.period)}${yearOf(x.after)}, Roth, and ${paid(m.amount, m.period)} you pay the tax on later`,
          [`${Whose} Roth 401(k): ${paid(x.amount, x.period)} added; the ${paid(m.amount, m.period)} you pay the tax on later stays too. `, link("#/retirement/contributions", "What you save for retirement ›"), " shows it."]), false)),
        // what each answer does: one quiet tap away (simple first)
        fold("move", "What each answer does", null, ui.h("p", { class: "muted small", style: { margin: "0" } }, `Yes moves it to a Roth line of its own${x.make === "account" ? ` (a new account, ${x.accountName}, starting at $0)` : x.make === "row" ? ` in ${x.accountName}` : ""} and sets the pay-the-tax-later line to $0; the ${money(m.balance)} in ${m.accountName} stays where it is until you split it on Net worth. No keeps the pay-the-tax-later line and adds the Roth line beside it.`)));
      continue;
    }
    if (x.employerMatch !== undefined) say(`Now: ${was}. Would be: ${now}${where(x)}. Most plans add the employer's money as pay-the-tax-later, so it goes there${x.before.onNow > 0 ? " and comes off the Roth 401(k)" : ""}.`);
    else if (isWork(x.id)) say(`Now: ${was}. Would be: ${paid(x.amount, x.period)}${partsOf(x.id)}${where(x)}. That is ${money(Math.round(x.after.yearly))} a year${x.before?.yearly > 0 && Math.round(x.before.yearly) !== Math.round(x.after.yearly) ? ` instead of ${money(Math.round(x.before.yearly))}` : ""}.`);
    else say(`Now: ${was}. Would be: ${now}.`);
    // several 401(k) accounts nobody owns: which one this paycheck pays into
    if (x.choices) card.append(ui.h("div", { class: "form", style: { marginBottom: "8px" } }, ui.field("Which account is it?", ui.select([...x.choices.map((c) => ({ value: c.id, label: c.name })), { value: "new", label: "A new one" }], x.make === "account" ? "new" : x.accountId, { "aria-label": "Which account is it?", onChange: (e) => { accountFor = { ...accountFor, later: e.target.value }; again(); } }))));
    if (x.alone) card.append(ui.notice("warn", `Nothing of ${whose} own goes in on file, and this stub shows none. A match usually comes with your own money: check the stub's 401(k) line first.`));
    if (x.twoJobs) card.append(ui.h("p", { class: "muted small", style: { margin: "0 0 8px" } }, `The plan keeps one figure for ${whose} tax taken out. With two jobs on file, add both paychecks' tax together before using it.`));
    card.append(useBtn("Use it", () => use(x, was, isWork(x.id) && x.employerMatch === undefined ? `${now}${where(x) ? where(x).replace(/, at \$0 until.*$/, "") : ""}` : now, savedLinks), x.id === next));
  }
  // a retirement line the app saw and could not read: said, with a way to type it (never the match alone without a word)
  if (st.unread && !d.proposals.some((x) => x.id === "k401" || x.id === "roth401k")) items.splice(items.filter((o) => isWork(o.x.id)).length, 0, { x: { id: "unread" }, warn: true, el: ui.h("div", { class: "rd-prop" },
    ui.h("div", { class: "rd-t" }, `${Whose} 401(k)`),
    ui.h("div", { class: "rd-d" }, st.unread === "ytd" ? "The 401(k) line on this stub has one figure where the pay line has two, so it may be the year-to-date total. It is not used." : "This stub has a 401(k) line the app could not read: no dollar amount is on it.", " Type what goes in from one paycheck here, or on ", link("#/retirement/contributions", "What you save for retirement ›"), "."),
    ownNumber("k401", "401(k) this paycheck")) });
  // no retirement line at all: say what the stub shows (review P9); a line of the person's own printed as $0.00 this
  // paycheck is said the same way, and when the plan says money goes in, "Set it to $0" is one outlined tap (fix round 3, F1)
  if (st.noPlanLine) {
    const z = st.noPlanLine, u = used.get("zero"), what = z.zeroLine ? (z.sides.length > 1 ? "the 401(k) and the Roth 401(k)" : z.sides[0] === "now" ? "the Roth 401(k)" : "the 401(k)") : "";
    const soFar = z.ytd > 0 ? ` (${cents(z.ytd)} so far this year)` : "", onFile = money(Math.round(z.onFile));
    const putIn = () => ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/contributions" }, "See what putting some in would do ›"));
    const setZero = () => {
      const was = z.set.map((x) => `${paid(x.before.amount, x.before.period)}${yearOf(x.before)}${x.side === "now" ? ", Roth" : ""}`).join(" and ");
      const match = z.set.reduce((t, x) => t + x.before.match, 0);
      used.set("zero", { title: `${Whose} 401(k)`, was, now: "$0", said: [`${Whose} 401(k): set to $0. `, link("#/retirement/contributions", "What you save for retirement ›"), match > 0 ? ` shows it. The employer's match on file, ${money(Math.round(match))} a year, stays: change it there if it stopped too.` : " shows it."] });
      store.update((p) => { for (const x of z.set) applyProposal(p, x, { newId: () => ui.uid() }); });
    };
    const el = u
      ? ui.h("div", { class: "rd-prop done" }, ui.h("div", { class: "rd-t" }, u.title), ui.h("div", { class: "rd-d" }, `Was: ${u.was}. Now: ${u.now}.`), ui.h("div", { class: "notice ok" }, ...u.said))
      : z.zeroLine && z.onFile > 0
        ? ui.h("div", { class: "rd-prop" }, ui.h("div", { class: "rd-t" }, `${Whose} 401(k)`),
          ui.h("div", { class: "notice warn" }, `This pay stub shows $0.00 going into ${what} this paycheck${soFar}; the plan says ${onFile} a year. If you stopped, change it on `, link("#/retirement/contributions", "What you save for retirement ›"), z.set.length ? ", or set it to $0 here." : "."),
          z.set.length ? ui.row(ui.button("Set it to $0", setZero, { class: "secondary" })) : null)
        : z.zeroLine
          ? ui.h("div", { class: "rd-prop" }, ui.h("div", { class: "rd-t" }, `${Whose} 401(k)`), ui.h("div", { class: "rd-d" }, `This pay stub shows $0.00 going into ${what} this paycheck${soFar}. That matches what is on file ($0).`), putIn())
          : ui.h("div", { class: "rd-prop" }, ui.h("div", { class: "rd-t" }, `${Whose} 401(k)`),
            z.onFile > 0
              ? ui.h("div", { class: "rd-d" }, `The app found no 401(k) line on this stub, and the plan says ${onFile} a year goes in. If it is under another name, check it on `, link("#/retirement/contributions", "What you save for retirement ›"), ".")
              : ui.h("div", { class: "rd-d" }, "This pay stub shows no money going into a 401(k). That matches what is on file ($0)."),
            z.onFile > 0 ? null : putIn());
    // a $0.00 line the plan does not match, or its change used, is never folded away
    items.splice(items.filter((o) => isWork(o.x.id)).length, 0, { x: { id: "noPlanLine" }, used: !!u, warn: !!(z.zeroLine && z.onFile > 0), el });
  }
  // the person's own money a year on this stub and on file, just above the first 401(k) card
  const own = ownLine();
  const firstWork = items.findIndex((o) => isWork(o.x.id));
  if (own && firstWork >= 0) items.splice(firstWork, 0, { x: { id: "own" }, line: true, el: own });
  // the first FIRST cards (a line is not a card), then the rest behind one quiet fold that says what it holds
  let n = 0, cut = items.length;
  items.forEach((o, i) => { if (!o.line && ++n === FIRST + 1 && cut === items.length) cut = i; });
  // a used or doubted change never hides: the fold starts after the last card the person must see
  const must = items.reduce((m, o, i) => (o.used || o.warn ? i : m), -1);
  if (must >= cut) cut = must + 1;
  for (const o of items.slice(0, cut)) props.append(o.el);
  const rest = items.slice(cut).filter((o) => !o.line);
  if (rest.length) props.append(fold("more", `${rest.length} more change${rest.length === 1 ? "" : "s"}: ${rest.map((o) => SHORT[o.x.id] ?? "other").join(", ")}`, null, items.slice(cut).map((o) => o.el), { cls: "fold rd-more" }));
  // what the stub shows that the plan already says: one quiet line with the figures, no card and no button
  const sameWords = (x) => {
    const t = titleOf(x).replace(/^Your /, "your ");
    if (x.op === "withholding") return `${t}, ${paid(x.perPaycheck, x.period)}`;
    if (x.employerMatch !== undefined) return `${t}, about ${money(Math.round(x.employerMatch))} a year`;
    return `${t}, ${money(Math.round(x.after.yearly))} a year`;
  };
  if (sameOnes.length) props.append(ui.h("p", { class: "rd-same" }, `Already on file, nothing to change: ${sameOnes.map(sameWords).join("; ")}.`));
  if (!d.proposals.length && !st.noPlanLine && !st.unread) props.append(ui.h("p", { class: "muted" }, "Nothing to change from what was found."));
  // after a 401(k) or match change: the way on (review P12)
  if ([...used.keys()].some((k) => isWork(k) || k === "zero")) props.append(ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "See if the money lasts ›")));
  root.append(foundCard(!d.proposals.length && !st.noPlanLine && !st.unread), docFold);

  // what was read, one tap away under the changes (open when there is nothing else to show). Opened on this visit, it stays
  // open when the page is drawn again (after "Use it" or "Ask the AI"); its summary says what the AI did (fix round 3, F3)
  function foundCard(open) {
    const fromAi = d.found.filter((f) => extra[f.key] !== undefined && f.key !== "period" && !typed.has(f.key)).length;
    const status = `${d.found.length} of ${d.found.length + d.missing.length}${aiErr ? ", the AI did not answer" : fromAi ? `, ${fromAi} from the AI` : ""}`;
    return fold("found", "What the app read on it", status, [foundList(), ...foundRest()], { cls: "card fold fold-card rd-found-fold", open, h2: true });
  }
  function fmtVal(k, v) {
    if (k === "period") return { weekly: "weekly", biweekly: "every two weeks", semimonthly: "twice a month", monthly: "monthly" }[v] ?? v;
    if (k === "asOf" || k === "firm") return v ? `on ${k === "asOf" ? fmt.date(v) : v}` : "";
    if (["returnStocks", "returnBonds", "inflation", "fee", "quotedChance"].includes(k)) return `${k.replace(/([A-Z])/g, " $1").toLowerCase()} ${Math.round(v * 1000) / 10}%`;
    if (k.startsWith("retireAge")) return `retire at ${v}`;
    return money(v);
  }
}

const TITLES = { balance: "The account's balance", ssa: "Social Security at full retirement age", advisor: "The advisor's assumptions (Advisor's plan)" };
