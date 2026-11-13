// modules/estate/will-worksheet/view.js -- DOM only. "Choices to take to a lawyer" (gap design #14): the headline (how
// many of the main choices are written down, one sentence per case), one filled button ("Print my choices"; "Start with
// the first choice" while nothing is written), the line that is never folded ("This is not a will ..."), then the
// choices as quiet rows that open in place (core/ui/more.js, kind "item"), each with its small form saved through
// ctx.store.update. The printed sheet (report-kit.js) holds every section; it is drawn hidden and shown only by the
// printer. No legal advice, never a password or a full number.
import { compute, sharesCheck, giftsCheck, saveWorksheet, headlineOf, ledeOf, lawyerLinkWords, refusal, nothingWords, NOT_A_WILL, INTROS, SLOTS } from "./compute.js";
import { part, links } from "../../../core/ui/more.js";
import { reportFrame, printSheet, section } from "../../reports/report-kit.js";

export const TITLE = "Choices to take to a lawyer";
let pending = null;   // { part, text?, focus? }: the green line after a save and the part that stays open (R17)

const STYLE = `
.ww-root .ww-intro { color: var(--text-2); margin: 0; }
.ww-root .ww-never { margin: 12px 0 0; font-size: var(--fs-sm); color: var(--text-2); }
.ww-root .ww-never a { display: flex; align-items: center; min-height: 44px; }
.ww-root .rp-root[hidden] { display: none; }
@media print { .ww-root .rp-root[hidden] { display: block !important; } }
`;
const ORDINAL = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"];
const nth = (i) => ORDINAL[i] ?? `Number ${i + 1}`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const today = fmt.today();
  const d = compute(plan, { today });
  const v = d.values;
  const root = ui.h("div", { class: "ww-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const just = pending; pending = null;
  // per row: the one line under its form (the green "Saved." or "Nothing to save yet."), and whether a box was typed in
  // since the page was drawn
  const line = {}, typed = {};
  /** Put one line under a row's form, in place of the last one; say(key, form, null) takes it away. */
  const say = (key, form, node) => { line[key]?.remove?.(); line[key] = node ?? null; if (node) { form.after(node); ui.reveal?.(node, { block: "nearest" }); } };
  /** A refusal, or a new keystroke: the green line of the last save no longer describes what is in the boxes. */
  const hush = (key) => { line[key]?.remove?.(); line[key] = null; };

  // the printed sheet: every section, drawn hidden; only the printer shows it (report-kit's print rules)
  const { wrap, sheet } = reportFrame(ui, { title: TITLE });
  wrap.querySelector(".row")?.remove();   // the kit's own print button: this page's one filled button is in the hero
  wrap.hidden = true;
  drawSheet(ui, sheet, d);

  // the answer: one sentence per case and one filled way on. While nothing is written the way on is the first row's
  // form; once it is open, its Save is the one filled button and this one goes quiet
  const first = d.rows[0];
  const start = () => { pending = { part: first.key, focus: true }; if (ctx.redraw) ctx.redraw(); else { page.replaceChildren(); render(page, ctx); } };
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, headlineOf(d)),
    ui.h("p", { class: "lede" }, ledeOf(d)),
    d.any ? ui.row(ui.button("Print my choices", () => printSheet(TITLE, sheet)))
      : ui.row(ui.button("Start with the first choice ›", start, just?.part === first.key ? { class: "secondary" } : {}))));

  const rows = d.rows.map((r) => part(ctx, { id: r.key, kind: "item", title: r.title, says: r.says, open: just?.part === r.key ? true : undefined,
    holds: HOLDS[r.key], // the green line sits under the form's Save, where the thumb is
    body: () => {
      const form = formOf(r.key);
      form.addEventListener?.("input", () => { typed[r.key] = true; hush(r.key); });
      if (just?.part === r.key && just.text) line[r.key] = ui.notice("ok", just.text);
      return [ui.h("p", { class: "ww-intro" }, INTROS[r.key]), form, line[r.key]].filter(Boolean);
    } }));
  // the row just saved stays open (R17) until the person opens another: then it shuts, unless they typed in it again,
  // and the row they tapped stays where their thumb is
  const savedRow = just?.text ? rows.find((el) => el.dataset?.part === just.part) : null;
  if (savedRow) for (const el of rows) if (el !== savedRow) el.addEventListener?.("toggle", () => {
    if (!el.open || !savedRow.open || typed[just.part]) return;
    const sum = el.querySelector?.("summary"), top = () => sum?.getBoundingClientRect?.().top ?? 0;
    const was = top();
    savedRow.open = false;
    const by = top() - was;
    if (by && typeof scrollBy === "function") scrollBy(0, by);
  });
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Your choices"), ui.h("div", { class: "folds" }, rows),
    // never folded: what this page is not, and where the lawyer is kept
    ui.h("p", { class: "ww-never" }, NOT_A_WILL, ui.h("a", { href: "#/household/contacts" }, lawyerLinkWords(d))),
    v.updatedAt ? ui.h("p", { class: "muted small" }, `Last saved ${fmt.date(v.updatedAt)}.`) : null));

  // "More on this" once something is written: while the page is empty it keeps to its one way to start
  const more = d.any ? links(ctx, [
    { href: "#/estate/documents", ask: "Are the will and the other papers signed?", says: "Estate documents" },
    { href: "#/estate/beneficiaries", ask: "Who is named on each account and policy?", says: "Beneficiary audit" },
    { href: "#/reports/if-something-happens", ask: "What would your family need if something happened to you?", says: "One packet to print" },
  ]) : null;
  if (more) root.append(more);
  root.append(wrap);

  // the Start button opened the first row: bring it under the top bar and put the cursor in its first box
  if (just?.focus && typeof setTimeout === "function") setTimeout(() => {
    const el = page.querySelector?.(`details[data-part="${just.part}"]`);
    if (!el) return;
    ui.reveal?.(el);
    el.querySelector?.("input, textarea")?.focus?.({ preventScroll: true });
  }, 0);

  /** Save one row: refuse a password or a long number at its box, then write it and say so (the new headline when it changed). */
  function save(key, form, texts, patch) {
    for (const [name, value] of Object.entries(texts)) {
      const why = refusal(value);
      if (!why) continue;
      hush(key);
      const box = form.querySelector?.(`[name="${name}"]`);
      if (box && ui.fieldError) ui.fieldError(box, why); else form.append(ui.notice("error", why));
      return false;
    }
    const q = structuredClone(plan);
    const id = ui.uid();
    saveWorksheet(q, patch, today, id);
    const after = compute(q, { today });
    // the row was empty and still is: nothing is written, and the page does not claim it saved
    const filled = (x) => !!x.rows.find((r) => r.key === key)?.filled;
    if (!filled(d) && !filled(after)) { say(key, form, ui.notice("warn", nothingWords(key))); return false; }
    const was = headlineOf(d), now = headlineOf(after);
    pending = { part: key, text: now !== was ? `Saved. ${now}.` : "Saved." };
    store.update((draft) => { saveWorksheet(draft, patch, today, id); });
    return true;
  }
  const refuse = (key, form, name, words) => { hush(key); const box = form.querySelector?.(`[name="${name}"]`); if (box && ui.fieldError) ui.fieldError(box, words); else form.append(ui.notice("error", words)); return false; };

  function formOf(key) {
    if (key === "children") {
      const kids = d.children.length ? ` (${d.children.join(" and ")})` : "";
      const form = ui.form([
        { key: "who", label: `Who would raise the children${kids}?`, type: "text", placeholder: "For example: Aunt Kay", help: "the same name Estate documents shows" },
        { key: "guardianBackup", label: "A second choice", type: "text", placeholder: "If the first cannot" },
        { key: "childrenAge", label: "Age each child gets their share", type: "number", whole: true, min: 1, max: 120, placeholder: "For example: 25" },
      ], { who: v.who, guardianBackup: v.guardianBackup, childrenAge: v.childrenAge }, (x) => save(key, form, { who: x.who, guardianBackup: x.guardianBackup }, { who: x.who, guardianBackup: x.guardianBackup, childrenAge: x.childrenAge }), { submitLabel: "Save" });
      return form;
    }
    if (key === "people") {
      const form = ui.form([
        { key: "executor", label: "Who carries out your will?", type: "text", placeholder: "For example: each other, then Dee", help: "called the executor: pays the last bills and hands out what you leave" },
        { key: "executorBackup", label: "A second choice", type: "text", placeholder: "If the first cannot" },
        { key: "poaMoney", label: "Who handles your money if you cannot?", type: "text", help: "named in a financial power of attorney" },
        { key: "poaHealth", label: "Who makes medical decisions if you cannot?", type: "text", help: "named in a health care power of attorney" },
      ], v, (x) => save(key, form, x, x), { submitLabel: "Save" });
      return form;
    }
    if (key === "rest") {
      const n = Math.max(SLOTS, v.rest.length);
      // typed shares are shown again as typed; equal shares were left empty, so they come back empty
      const equal = v.rest.length > 1 && v.rest.every((r) => Math.abs(r.share - v.rest[0].share) < 1e-9);
      const fields = [], values = {};
      for (let i = 0; i < n; i++) {
        fields.push({ key: `name${i}`, label: `${nth(i)} person or cause`, type: "text", placeholder: i === 0 ? "For example: Bo" : null, more: i >= 2 },
          { key: `share${i}`, label: i === 0 ? "Their share (leave empty to split equally)" : `${nth(i)} share`, type: "percent", placeholder: "For example: 50", more: i >= 2 });
        values[`name${i}`] = v.rest[i]?.name ?? "";
        values[`share${i}`] = v.rest[i] && !equal && v.rest.length > 1 ? v.rest[i].share : null;
      }
      if (v.rest.length === 1 && Math.abs(v.rest[0].share - 1) > 1e-9) values.share0 = v.rest[0].share;
      const form = ui.form(fields, values, (x) => {
        const typed = Array.from({ length: n }, (_, i) => ({ name: x[`name${i}`], share: x[`share${i}`] }));
        const c = sharesCheck(typed);
        // the shares do not add up: said in words above the buttons, nothing saved
        if (!c.ok) { hush(key); form.append(ui.notice("error", c.error)); return false; }
        return save(key, form, Object.fromEntries(typed.map((t, i) => [`name${i}`, t.name])), { rest: c.rows });
      }, { submitLabel: "Save", moreLabel: "More people (optional)" });
      return form;
    }
    if (key === "gifts") {
      const n = Math.max(SLOTS, v.specific.length);
      const fields = [], values = {};
      for (let i = 0; i < n; i++) {
        fields.push({ key: `what${i}`, label: i === 0 ? "A gift" : `${nth(i)} gift`, type: "text", placeholder: i === 0 ? "For example: the piano" : null, more: i >= 2 },
          { key: `to${i}`, label: i === 0 ? "Goes to" : `${nth(i)} gift goes to`, type: "text", placeholder: i === 0 ? "For example: Cy" : null, more: i >= 2 });
        values[`what${i}`] = v.specific[i]?.what ?? ""; values[`to${i}`] = v.specific[i]?.to ?? "";
      }
      const form = ui.form(fields, values, (x) => {
        const c = giftsCheck(Array.from({ length: n }, (_, i) => ({ what: x[`what${i}`], to: x[`to${i}`] })));
        // half a gift: held at the empty box, in words, nothing saved
        if (!c.ok) return refuse(key, form, `${c.missing}${c.at}`, c.error);
        return save(key, form, x, { specific: c.list });
      }, { submitLabel: "Save", moreLabel: "More gifts (optional)" });
      return form;
    }
    const form = ui.form([
      { key: "pets", label: "Pets and who takes them", type: "text", placeholder: "For example: the dog goes to my sister", help: "the same line Final wishes shows" },
      { key: "notes", label: "Anything else for the lawyer", type: "textarea", rows: 3, placeholder: "For example: we also own a cabin in another state" },
    ], v, (x) => save(key, form, x, x), { submitLabel: "Save" });
    return form;
  }
}
/** The box names inside each row, so an address with ?show=<box> finds its row. */
const HOLDS = {
  children: ["who", "guardianBackup", "childrenAge"], people: ["executor", "executorBackup", "poaMoney", "poaHealth"],
  rest: ["name0", "share0"], gifts: ["what0", "to0"], other: ["pets", "notes"],
};

/** The printed sheet: what it is, then every section with its lines. Light on paper (report-kit). */
export function drawSheet(ui, sheet, d) {
  const long = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "")); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""; };
  sheet.append(
    ui.h("h1", {}, TITLE),
    ui.h("p", { class: "rp-sub" }, `Written down ${long(d.today)}.`),
    ui.h("p", { class: "rp-lead" }, "This is not a will. It is a list of our choices for a lawyer, who makes them valid under our state's law."));
  for (const s of d.sheet) sheet.append(section(ui, s.title, ui.h("ul", { class: "rp-list" }, s.lines.map((l) => ui.h("li", {}, l)))));
  sheet.append(ui.h("p", { class: "rp-foot" }, "Never on this sheet: passwords, full account numbers or Social Security numbers."));
}
