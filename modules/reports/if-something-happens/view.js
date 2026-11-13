// modules/reports/if-something-happens/view.js -- DOM only. "If something happens to us": the packet's cover (how many of
// its five parts are filled in, and one filled button, "Print the packet"), then the five parts as quiet rows that open
// in place (core/ui/more.js, kind "item"): each one's sections (compute.js GROUPS: the first steps sit with who to call, the
// bills with the accounts), with each list, what is still missing and the page where it is kept. Final wishes is the one
// part kept here: five boxes, saved through ctx.store.update. The printed sheet (report-kit.js) holds every part; it is
// drawn hidden and shown only by the printer. Never a password or a full account number.
import { compute, saveWishes, headlineOf, ledeOf, leftOutOf, heldOut, INTROS, WISHES, SSA_PHONE } from "./compute.js";
import { part, links } from "../../../core/ui/more.js";
import { reportFrame, printSheet, section } from "../report-kit.js";

export const TITLE = "If something happens to us";
let pending = null;   // { text, part }: the green line after a save, and the part that stays open (R17)

const STYLE = `
.sp-root .sp-rows .fold-body { padding-bottom: 6px; }
.sp-root .sp-intro { color: var(--text-2); margin: 0; }
.sp-root .sp-missing { color: var(--warn); font-size: var(--fs-sm); margin: 0; }
.sp-root .sp-note { margin: 0; font-weight: 600; }
.sp-root .sp-steps { margin: 0; padding-left: 22px; }
.sp-root .sp-steps li { margin: 8px 0; }
.sp-root .sp-steps .rec-sub { color: var(--text-2); font-size: var(--fs-sm); }
.sp-root .sp-go { display: flex; flex-wrap: wrap; gap: 8px; }
.sp-root .sp-never { color: var(--muted); font-size: var(--fs-sm); margin: 10px 0 0; }
.sp-root .sp-sub { margin: 6px 0 0; font-size: var(--fs); font-weight: 650; }
.sp-root .rp-root[hidden] { display: none; }
@media print { .sp-root .rp-root[hidden] { display: block !important; } }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "sp-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const just = pending; pending = null;

  // the printed packet: every part, drawn hidden; only the printer shows it (report-kit's print rules)
  const { wrap, sheet } = reportFrame(ui, { title: TITLE });
  wrap.querySelector(".row")?.remove();   // the kit's own print button: this page's one filled button is in the hero
  wrap.hidden = true;
  drawSheet(ui, sheet, d);

  // the cover: one sentence per case, and one filled way on
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, headlineOf(d)),
    ui.h("p", { class: "lede" }, ledeOf(d)),
    d.empty
      ? ui.row(ui.h("a", { class: "btn", href: "#/household/contacts" }, "Start with who to call ›"))
      : ui.row(ui.button("Print the packet", () => printSheet(TITLE, sheet)))));
  // a text that looked like a password, or held a long number, is left out of the packet, and the page says so (never folded)
  for (const line of leftOutOf(d)) root.append(ui.notice("warn", line));

  // the five parts, as rows that open in place; a part of two sections names each inside
  const rows = d.groups.map((g) => part(ctx, { id: g.key, kind: "item", title: g.title, says: g.says, open: just?.part === g.key ? true : undefined,
    holds: g.sections.some((p) => p.key === "wishes") ? WISHES.map((f) => f.key) : undefined,
    body: () => g.sections.flatMap((p) => [g.sections.length > 1 ? ui.h("h3", { class: "sp-sub" }, p.title) : null, ...bodyOf(p)]) }));
  root.append(ui.h("section", { class: "card sp-rows" }, ui.h("h2", {}, "What the packet holds"), ui.h("div", { class: "folds" }, rows),
    ui.h("p", { class: "sp-never" }, "Never in it: passwords, full account numbers or Social Security numbers.")));

  const more = d.empty ? null : links(ctx, [
    { href: "#/estate/documents", ask: "Are the will and the other papers signed?", says: "Estate documents" },
    { href: "#/insurance/life-needs", ask: "Would your family have enough to live on?", says: "Life insurance needs" },
  ]);
  if (more) root.append(more);
  root.append(wrap);

  function bodyOf(p) {
    const out = [ui.h("p", { class: "sp-intro" }, INTROS[p.key])];
    if (p.key === "wishes") return [...out, wishesForm()];
    if (p.key === "steps") return [...out, ui.h("ol", { class: "sp-steps" }, p.rows.map((r, i) => ui.h("li", {}, stepText(r.title, i), r.lines.map((l) => ui.h("div", { class: "rec-sub" }, l))))),
      ui.h("p", { class: "muted small" }, "From Social Security, USA.gov, the Consumer Financial Protection Bureau and the credit bureaus (read November 2026).")];
    if (p.note) out.push(ui.h("p", { class: "sp-note" }, p.note));
    for (const m of p.missing) out.push(ui.h("p", { class: "sp-missing" }, m));
    if (p.rows.length) out.push(ui.h("ul", { class: "records" }, p.rows.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.title), r.value ? ui.h("span", { class: "rec-value" }, r.value) : null),
      r.lines.map((l) => ui.h("div", { class: "rec-sub" }, l))))));
    if (p.go.length) out.push(ui.h("div", { class: "sp-go" }, p.go.map((g) => ui.h("a", { class: "btn secondary small", href: g.href }, `${g.label} ›`))));
    return out;
  }
  // step 2's number is one tap from the phone's dialer
  function stepText(t, i) {
    const at = t.indexOf(SSA_PHONE);
    if (i !== 1 || at < 0) return ui.h("span", {}, t);
    return ui.h("span", {}, t.slice(0, at), ui.h("a", { href: `tel:${SSA_PHONE.replace(/\D/g, "")}` }, SSA_PHONE), t.slice(at + SSA_PHONE.length));
  }

  function wishesForm() {
    const fields = WISHES.map((f) => ({ key: f.key, label: f.label, type: f.key === "funeral" ? "textarea" : "text", rows: 3,
      placeholder: { funeral: "For example: a small service, then burial next to my parents", written: "For example: a letter in the fire safe", pets: "For example: the dog goes to my sister", tell: "For example: my brother, then my best friend", letterWhere: "For example: the top desk drawer" }[f.key] }));
    const form = ui.form(fields, d.wishes, (v) => {
      // a password, a recovery phrase or a long number never goes in the plan: held at its box, nothing saved
      const bad = WISHES.find((f) => heldOut(v[f.key]));
      if (bad) {
        const why = heldOut(v[bad.key]) === "secret" ? "This looks like a password or a recovery phrase. Write where it is kept, never the secret."
          : "This holds a long number, like a full account or Social Security number. Write only the last four digits.";
        const box = form.querySelector?.(`[name="${bad.key}"]`);
        if (box && ui.fieldError) ui.fieldError(box, why);
        else form.append(ui.notice("error", why));
        return false;
      }
      const q = structuredClone(plan);
      const kept = saveWishes(q, v, today);
      const after = compute(q, { today });
      const was = headlineOf(d), now = headlineOf(after);
      pending = { part: "wishes", text: !kept ? "Cleared your final wishes." : now !== was ? `Saved your final wishes. ${now}.` : "Saved your final wishes." };
      store.update((draft) => { saveWishes(draft, v, today); });
    }, { submitLabel: "Save" });
    return ui.h("div", {}, just?.part === "wishes" ? ui.notice("ok", just.text) : null, form,
      d.wishes.updatedAt ? ui.h("p", { class: "muted small" }, `Last saved ${fmt.date(d.wishes.updatedAt)}.`) : null);
  }
}

/** The printed packet: the five parts as on screen, each section with its rows and what is missing, the first steps in
 * order. Light on paper (report-kit). */
export function drawSheet(ui, sheet, d) {
  const long = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "")); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""; };
  sheet.append(
    ui.h("h1", {}, TITLE),
    ui.h("p", { class: "rp-sub" }, `Prepared ${long(d.today)}. Keep it with your will, where your family can find it.`),
    ui.h("p", { class: "rp-lead" }, "Never in it: passwords, full account numbers or Social Security numbers."));
  const of = (p) => (p.key === "steps"
    ? [ui.h("ol", { class: "rp-list" }, p.rows.map((r) => ui.h("li", {}, r.title, r.lines.length ? ui.h("div", { class: "rp-sub" }, r.lines.join(" ")) : null)))]
    : [p.note ? ui.h("p", {}, p.note) : null,
      p.rows.length ? ui.h("ul", { class: "rp-recs" }, p.rows.map((r) => ui.h("li", {},
        ui.h("div", { class: "rp-rh" }, ui.h("span", {}, r.title), r.value ? ui.h("span", {}, r.value) : null),
        r.lines.length ? ui.h("div", { class: "rp-rs" }, r.lines.join(" · ")) : null))) : ui.h("p", { class: "rp-sub" }, "Nothing written down yet."),
      ...p.missing.map((m) => ui.h("p", { class: "rp-sub" }, m))]);
  for (const g of d.groups) sheet.append(section(ui, g.title, ...g.sections.flatMap((p) => [g.sections.length > 1 ? ui.h("h3", {}, p.title) : null, ...of(p)])));
}
