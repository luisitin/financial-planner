// modules/ai/reader/forms-view.js -- DOM only. The Document reader's screen for a W-2, a 1099 or last year's return (gap
// design #23), drawn by view.js once one of them is read. Simple first: the changes it would make, at most three cards and
// then "N more figures", each used by its own tap ("Use it", AGENTS.md rule 5) and confirmed where it was tapped; then two
// quiet parts, "The figures" (what was read, box by box, and the AI helper for the rest) and "How this is worked out"; the
// pasted text, what it is, whose and which year last, folded. Every optional piece is a part of core/ui/more.js, none a
// <details> by hand. The words are form-words.js's (one sentence per case, each tested); the figures are compute's.
import { part, parts, rest } from "../../../core/ui/more.js";
import { NameOf, nameOf, nameIn } from "../../../core/words.js";
import { cardOf, checkOf, headLine, sameWords, askLine } from "./form-words.js";
import { FORM_KINDS, replaceOf } from "./forms.js";

const STYLE = `
.rd-root .rd-cards { list-style: none; margin: 0; padding: 0; }
.rd-root .rd-how p { margin: 0; font-size: var(--fs-sm); }
.rd-root .rd-prop > .row { margin: 0 0 8px; }
.rd-root .rd-prop > .row:last-child { margin-bottom: 0; }
`;
// the part a tap inside it redraws the page from stays open on that draw, and no other opens (docs/OPTIONAL.md R17); never saved
let pending = null;
// the order of the cards: the money of the year first, the checks after them
const RANK = { prior: 0, k401: 1, roth401k: 2, wages: 3, withheld: 4, ordinary: 5, qualified: 6, exempt: 7, capdist: 8, "sale-short": 9, "sale-long": 10, ira: 11 };
const HEAD = { w2: "Read your W-2", f1099: "Read a 1099", f1040: "Read last year's tax return" };
/** The landing's heading and first sentence when the page is opened for one of these forms (#/ai/reader?kind=w2). */
export const landing = (kind) => (HEAD[kind] ? { h1: HEAD[kind], lede: `Paste the text of ${kind === "w2" ? "your W-2" : kind === "f1099" ? "a 1099" : "last year's federal tax return"}. You see what each figure would change, and you use only the ones that are right.` } : null);

/**
 * drawForm(root, ctx, d, S): d is compute()'s answer for a form; S is the page's state for this visit (view.js):
 * { people, used (Map), extra, aiNote, aiErr, aiOk, text, KINDS, box, readBtn, clearBtn, fileIn, status, pickBtn, privacy,
 *   arrive(card), apply(draft, x), remember(x, print), setKind(kind), setPerson(id), setYear(year), setExtra(fields),
 *   setAi(note, err), again() }.
 */
export function drawForm(root, ctx, d, S) {
  const { ui, fmt, plan, store } = ctx, h = ui.h;
  const cur = plan.meta?.currency;
  const money = (n) => fmt.money(n, cur);
  const cents = (n) => fmt.money(n, cur, undefined, 2);
  const f = d.form, noun = FORM_KINDS[d.kind].noun;
  const person = S.people.find((p) => p.id === f.personId) ?? null;
  const w = { money, Whose: NameOf(person?.name), whose: nameOf(person?.name), whoIn: nameIn(person?.name), nameOf };
  const open = pending?.part ?? null;
  pending = null;
  const used = S.used;
  // a sentence of form-words.js: its words, then each page it sends the person to as an outlined button under them, a whole
  // 44 px tap (never a small link inside the words: review P3)
  const text = (list) => list.filter((x) => typeof x === "string").join("");
  const pages = (list) => { const to = list.filter((x) => typeof x !== "string"); return to.length ? ui.row(...to.map((x) => h("a", { class: "btn secondary", href: x.href }, x.label))) : null; };
  root.append(h("style", {}, STYLE));

  const props = ui.card("What it would change");
  root.append(props);
  S.arrive(props);
  props.append(h("p", { class: "rd-why" }, headLine(f, w)));

  let showed = true;
  if (d.kind === "w2" && f.noPeople) {
    props.append(ui.notice("info", "Add yourself on People first; then this W-2's figures can be used."), ui.row(h("a", { class: "btn", href: "#/household/people" }, "Add yourself")));
  } else if (f.ask) {
    const line = askLine(f, w);
    props.append(h("p", { class: "rd-ask" }, "Whose W-2 is this?"),
      h("div", { class: "chips", role: "group", "aria-label": "Whose W-2 is this?" }, f.ask.map((p) => h("button", { type: "button", class: "chip", onClick: () => S.setPerson(p.id) }, p.name))),
      h("p", { class: "muted small" }, text(line)), ...[pages(line)].filter(Boolean));
  } else showed = changes();

  // the two quiet parts: what was read (open when nothing else shows, or while the AI's error stands), and how
  root.append(parts(ctx,
    { id: "figures", kind: "figures", says: `${d.found.length} of ${d.found.length + d.missing.length} read`, open: open === "figures" || S.aiErr || !showed, body: figuresBody },
    { id: "how", kind: "how", says: "sources", body: howBody }));
  root.append(part(ctx, { id: "doc", kind: "item", title: `The ${noun} you pasted`, says: "Paste another", card: true, open: open === "doc", body: docBody }));

  function changes() {
    // a change used on this visit keeps its card where it was, with what it changed (review P6), also once the plan holds
    // it and the form's figure reads as already on file (a 401(k) row a W-2 filled is then the person's own)
    const gone = [...used.keys()].filter((id) => !d.proposals.some((x) => x.id === id)).map((id) => ({ id, op: used.get(id).op }));
    const shown = [...d.proposals.filter((x) => used.has(x.id) || !x.same), ...gone].map((x, i) => ({ x, i })).sort((a, b) => (RANK[a.x.id] ?? 20) - (RANK[b.x.id] ?? 20) || a.i - b.i).map((o) => o.x);
    const checks = f.checks.filter((c) => !c.same && !used.has(c.id));
    const same = [...d.proposals.filter((x) => x.same && !used.has(x.id)), ...f.checks.filter((c) => c.same && !used.has(c.id))];
    // the screen's one filled button: the first plain change not used yet. One that adds to a typed figure, carries a
    // caution, or rests on a year the form does not say is the person's call, never the filled one;
    // the household's one wages or tax figure while another adult has pay: reading only this W-2 leaves theirs out for now
    const plain = (x) => !used.has(x.id) && !x.same && !x.adds && !x.caution && !x.others && !(f.yearWhy === "assumed" && x.op !== "work");
    const next = shown.find(plain)?.id ?? null;
    const items = [...shown.map((x) => ({ x, used: used.has(x.id), warn: !!x.caution })), ...checks.map((c) => ({ x: c, check: true }))];
    // "Use it" (or, on a card that adds to a typed figure, "Replace it" / "Add it": review M1): the change, remembered for
    // this visit with what it wrote, so reading the same form again says it is on file
    const use = (x, c) => {
      used.set(x.id, { op: x.op, title: c.title, was: c.was, now: c.now, saved: c.saved });
      if (x.op === "taxYear") S.remember(x, f.print);
      store.update((p) => S.apply(p, x));
    };
    const row = (o) => {
      const x = o.x;
      if (o.check) { const c = checkOf(x, w), more = pages(c.says); return h("li", { class: "rd-prop" }, h("div", { class: "rd-t" }, c.title), h("div", { class: "rd-d", style: more ? {} : { marginBottom: "0" } }, text(c.says)), more); }
      const u = used.get(x.id);
      if (u) return h("li", { class: "rd-prop done" }, h("div", { class: "rd-t" }, u.title), h("div", { class: "rd-d" }, `Was: ${u.was}. Now: ${u.now}.`), h("div", { class: "notice ok" }, text(u.saved)), pages(u.saved));
      const c = cardOf(x, w);
      const how = (y) => () => use(y, cardOf(y, w));
      return h("li", { class: "rd-prop" }, h("div", { class: "rd-t" }, c.title), h("div", { class: "rd-d" }, text(c.says)),
        c.caution ? h("div", { class: "notice warn" }, text(c.caution)) : null,
        c.caution ? pages(c.caution) : null,
        c.note ? h("p", { class: "muted small", style: { margin: "0 0 8px" } }, c.note) : null,
        c.choices ? ui.row(...c.choices.map((ch) => ui.button(ch.label, how(ch.how === "replace" ? replaceOf(x) : x), { class: "secondary" })))
          : ui.button("Use it", how(x), x.id === next ? {} : { class: "secondary" }));
    };
    // three cards, then "N more figures" (never fewer than three folded; a used card or a caution is never folded)
    if (items.length) props.append(...rest(ctx, { id: "more", items, row, first: 3, noun: "figures", one: "figure", list: "rd-cards", keep: (o) => !!(o.used || o.warn) }));
    if (same.length) props.append(h("p", { class: "rd-same" }, `Already on file, nothing to change: ${same.map((x) => sameWords(x, w)).join("; ")}.`));
    if (!items.length && !same.length) props.append(h("p", { class: "muted" }, `None of the usual boxes of a ${noun} are in the text. The figures below say what was read.`));
    // after a change: the page that shows it, outlined (the filled button stays the next change's)
    const ops = [...used.values()].map((u) => u.op);
    if (ops.length) {
      const [href, label] = ops.some((o) => o === "taxYear" || o === "gain") ? ["#/taxes/federal", "See the Federal estimate ›"] : ops.includes("priorYear") ? ["#/taxes/estimated", "See Estimated payments ›"] : ["#/retirement/projection", "See if the money lasts ›"];
      props.append(ui.row(h("a", { class: "btn secondary", href }, label)));
    }
    return items.length + same.length > 0;
  }

  function figuresBody() {
    const list = d.found.length ? h("ul", { class: "rd-found" }, d.found.map((x) => h("li", {},
      h("span", {}, x.label, S.extra[x.key] !== undefined ? h("span", { class: "rd-ai" }, "from the AI: check it") : null,
        x.parts ? h("span", { class: "rd-parts" }, x.parts.map((p) => `code ${p.code} ${cents(p.amount)}`).join(" + ")) : null),
      h("b", {}, x.unit === "year" ? String(x.value) : cents(x.value))))) : h("p", { class: "muted" }, `None of the usual boxes of a ${noun} are in the text.`);
    const ask = d.missing.length && S.aiOk ? ui.row(ui.button("Ask the AI to find the rest", async (e) => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Asking...";
      try {
        const { buildPrompt, parseAnswer } = S;
        const answer = await ctx.ai.chat(buildPrompt(d.kind, S.text));
        const got = parseAnswer(d.kind, answer.content);
        const add = Object.fromEntries(Object.entries(got).filter(([k]) => d.fields[k] === undefined));
        S.setExtra(add);
        S.setAi(Object.keys(add).length ? `The AI found ${Object.keys(add).length} more. Check them against the ${noun}.` : "The AI found nothing more.", false);
      } catch (err) { S.setAi(`The AI is not available: ${String(err.message ?? err).replace(/\.+$/, "")}. Settings has the AI connection.`, true); }
      // its answer, or its error, shows where the person tapped: this part stays open
      pending = { part: "figures" };
      S.again();
    }, { class: "secondary" })) : null;
    return [list,
      d.missing.length ? h("p", { class: "muted small", style: { margin: "0" } }, `Not found: ${d.missing.map((l) => (/^(Roth|HSA|Federal)\b/.test(l) ? l : l[0].toLowerCase() + l.slice(1))).join("; ")}.`) : null,
      ask, S.aiNote ? ui.notice(S.aiErr ? "error" : "info", S.aiNote) : null];
  }

  function howBody() {
    const p = (t) => h("p", {}, t);
    const what = {
      w2: [p("Box 1 is the pay that is taxed: the pay less what went into a 401(k) and what was taken from pay for health coverage. Box 5, the Medicare wages, keeps the 401(k) money in, so it is the nearer to the pay on file. In box 12, codes D, E and G are money put in before tax (a 401(k), a 403(b), a 457(b); G can hold the employer's money too), AA, BB and EE are Roth money, taxed now, and W is HSA money through work: the employer's and what was taken from pay for it, together."),
        p(`A W-2 covers one year. One for another year than the one the Federal estimate works out (${f.planYear}) changes none of that year's figures, its tax taken out included. It fills in only the 401(k) money going in where nothing, or only our guess, is on file, as a year's figure; a figure you set stays as it is.`)],
      f1099: [p("A 1099-INT's interest (boxes 1 and 3) and a 1099-DIV's dividends that are not qualified (box 1a less box 1b) are taxed at regular rates; qualified dividends (box 1b) and capital gain distributions (box 2a) at the lower rates for gains. A 1099-B's sales go on Capital gains with what they cost (boxes 1d and 1e), each line by how long it was held; a loss not allowed in a wash sale (box 1g) is taken off the cost, as Form 8949 does. A 1099-R's taxed part (box 2a) is what counts as income. Two forms of a kind in one statement are added up; a copy of a form is counted once."),
        p(`Only a 1099 for ${f.planYear}, the year the Federal estimate works out, changes its figures. A figure already typed there changes only as you choose: this form's in its place, or added to it.`)],
      f1040: [p("Last year's adjusted gross income (line 11a on the 2025 Form 1040, line 11 before) and total tax (line 24) are what Estimated payments needs for the safe amount: paying 100% of last year's tax this year (110% when that income was over $150,000, $75,000 filing separately) means no penalty for paying too little during the year."),
        p(`Only the return for ${f.planYear - 1}, the year before the one the Federal estimate works out, is used.`)],
    }[d.kind];
    return h("div", { class: "rd-how", style: { display: "grid", gap: "8px" } }, ...what,
      p("Each figure is read by the words of its box or line, not by its number. Social Security numbers, employer numbers, account and control numbers are blanked before anything is read, and never kept or sent to the AI helper; names are not blanked. The text itself is not saved."),
      p(`From the IRS: ${{ w2: "General Instructions for Forms W-2 and W-3 (2026), the box 12 codes; Form W-2", f1099: "Forms 1099-INT, 1099-DIV, 1099-B and 1099-R and their boxes", f1040: "Form 1040 (2025) and its instructions" }[d.kind]}. Read November 14, 2026.`));
  }

  function docBody() {
    const todayYear = Number(String(fmt.today()).slice(0, 4));
    const kindSel = ui.select(Object.entries(S.KINDS).map(([value, k]) => ({ value, label: k.label })), d.kind, { "aria-label": "What it is", onChange: (e) => { pending = { part: "doc" }; S.setKind(e.target.value); } });
    const whoSel = d.kind === "w2" && S.people.length > 1 ? ui.select([...(f.personId ? [] : [{ value: "", label: "Whose is it?" }]), ...S.people.map((x) => ({ value: x.id, label: x.name }))], f.personId ?? "", { "aria-label": "Whose", onChange: (e) => { if (e.target.value) { pending = { part: "doc" }; S.setPerson(e.target.value); } } }) : null;
    const years = [todayYear, todayYear - 1, todayYear - 2, todayYear - 3];
    if (!years.includes(f.year)) years.push(f.year);
    const yearSel = ui.select(years.map((y) => ({ value: String(y), label: String(y) })), String(f.year), { "aria-label": "Which year it is for", onChange: (e) => { pending = { part: "doc" }; S.setYear(Number(e.target.value)); } });
    return [h("div", { class: "form" }, ui.field("What it is", kindSel), whoSel ? ui.field("Whose", whoSel) : null, ui.field("Which year it is for", yearSel, f.yearWhy === "assumed" ? `The form does not say its year; taken as ${f.year}.` : null)),
      S.box, ui.row(S.readBtn, S.clearBtn), S.fileIn, S.status, ui.row(S.pickBtn), S.privacy];
  }
}
