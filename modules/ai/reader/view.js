// modules/ai/reader/view.js -- DOM only. Paste the text of a document (or pick a PDF, read on the PC),
// see the figures found and what each would change in the plan, and accept the ones that are right.
// The AI can look for the figures the labels missed; nothing reaches the plan without a tap. The text
// is kept only while this page is open, never saved.
import { compute, applyProposal, buildPrompt, parseAnswer, KINDS } from "./compute.js";

// this visit's state (kept across the re-render after each accepted change; never saved)
let text = "", kind = "", personId = "", accountId = "", extra = {}, aiNote = "", pending = null;
const accepted = new Set();

const STYLE = `
.rd-root textarea { width: 100%; min-height: 160px; font: inherit; font-size: var(--fs-sm); }
.rd-root .rd-found { list-style: none; margin: 0; padding: 0; }
.rd-root .rd-found li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.rd-root .rd-found li:last-child { border-bottom: 0; }
.rd-root .rd-found b { white-space: nowrap; }
.rd-root .rd-ai { color: var(--accent-ink, var(--accent)); font-size: var(--fs-xs); margin-left: 6px; }
.rd-root .rd-prop { border: 1px solid var(--line); border-radius: var(--radius); padding: 12px; margin: 10px 0; }
.rd-root .rd-prop.done { opacity: .6; }
.rd-root .rd-prop .rd-t { font-weight: 650; margin-bottom: 4px; }
.rd-root .rd-prop .rd-d { color: var(--text-2); font-size: var(--fs-sm); margin-bottom: 8px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store, api, ai } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const root = ui.h("div", { class: "rd-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const accounts = plan.accounts ?? [];
  const d = compute(plan, { text, kind: kind || undefined, personId, accountId, today: fmt.today(), extra });
  const show = (unit, v) => (unit === "money" ? money(v) : unit === "percent" ? `${Math.round(v * 1000) / 10}%` : String(v));

  // 1. the document
  const box = ui.h("textarea", { "aria-label": "The document's text", placeholder: "Paste the text here: open the PDF or the website, select all, copy, paste." }, text);
  const fileIn = ui.h("input", { type: "file", accept: ".pdf,.txt,application/pdf,text/plain", "aria-label": "A PDF or text file", style: { display: "none" } });
  const status = ui.h("div");
  fileIn.addEventListener("change", async () => {
    const f = fileIn.files?.[0]; if (!f) return;
    status.replaceChildren(ui.notice("info", `Reading ${f.name}...`));
    try {
      if (/\.txt$/i.test(f.name) || f.type.startsWith("text/")) text = await f.text();
      else {
        const buf = new Uint8Array(await f.arrayBuffer());
        let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        text = (await api.readDocumentText({ fileName: f.name, mime: f.type, dataBase64: btoa(bin) })).text;
      }
      kind = ""; extra = {}; aiNote = ""; accepted.clear();
      page.replaceChildren(); render(page, ctx);
    } catch (e) { status.replaceChildren(ui.notice("error", `${e.message ?? e}. You can also paste the text instead.`)); }
  });
  root.append(ui.h("section", { class: text ? "card" : "card accent hero" },
    text ? null : ui.h("h1", {}, "Read a document"),
    ui.h("p", { class: text ? "muted small" : "lede" }, "A pay stub, an account statement, a Social Security statement or an advisor's plan: paste its text and the app finds the figures and shows what each would change. You accept each change yourself."),
    box,
    ui.row(ui.button("Read it", () => { text = box.value; kind = ""; extra = {}; aiNote = ""; accepted.clear(); page.replaceChildren(); render(page, ctx); }), ui.button("Pick a PDF", () => fileIn.click(), { class: "secondary" }), text ? ui.button("Clear", () => { text = ""; kind = ""; extra = {}; aiNote = ""; accepted.clear(); page.replaceChildren(); render(page, ctx); }, { class: "secondary" }) : null),
    fileIn, status,
    ui.h("p", { class: "muted small" }, "The text stays on this page and is not saved. PDFs are read on your PC.")));
  if (!text) return;

  // 2. what it is, and whose
  const kindSel = ui.select([{ value: "", label: d.detected ? `Looks like: ${KINDS[d.detected].label.toLowerCase()}` : "What is it?" }, ...Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label }))], kind, { "aria-label": "Kind of document", onChange: (e) => { kind = e.target.value; extra = {}; aiNote = ""; page.replaceChildren(); render(page, ctx); } });
  const whoSel = ui.select(people.map((p) => ({ value: p.id, label: p.name })), personId || people.find((p) => p.role === "self")?.id || "", { "aria-label": "Whose", onChange: (e) => { personId = e.target.value; page.replaceChildren(); render(page, ctx); } });
  const acctSel = ui.select([{ value: "", label: "Which account?" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))], accountId, { "aria-label": "Which account", onChange: (e) => { accountId = e.target.value; page.replaceChildren(); render(page, ctx); } });
  const setup = ui.card("What it is", ui.field("Kind", kindSel));
  if (d.kind === "statement") setup.append(ui.field("Account", acctSel));
  else if (d.kind && people.length > 1) setup.append(ui.field("Whose", whoSel));
  root.append(setup);
  if (!d.kind) { root.append(ui.notice("info", "Pick what kind of document it is above.")); return; }

  // 3. what was found
  const found = ui.card(`Found in it (${d.found.length} of ${d.found.length + d.missing.length})`, d.found.length ? ui.h("ul", { class: "rd-found" }, d.found.map((f) => ui.h("li", {}, ui.h("span", {}, f.label, extra[f.key] !== undefined ? ui.h("span", { class: "rd-ai" }, "from the AI: check it") : null), ui.h("b", {}, show(f.unit, f.value))))) : ui.h("p", { class: "muted" }, "None of the usual labels are in the text."),
    d.missing.length ? ui.h("p", { class: "muted small" }, `Not found: ${d.missing.join(", ").toLowerCase()}.`) : null);
  if (d.missing.length) found.append(ui.row(ui.button("Ask the AI to find the rest", async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Asking...";
    try {
      const answer = await ai.chat(buildPrompt(d.kind, text));
      const got = parseAnswer(d.kind, answer.content);
      const add = Object.fromEntries(Object.entries(got).filter(([k]) => d.fields[k] === undefined));
      extra = { ...extra, ...add };
      aiNote = Object.keys(add).length ? `The AI found ${Object.keys(add).length} more. Check them against the document.` : "The AI found nothing more.";
    } catch (err) { aiNote = `The AI is not available: ${err.message ?? err}. Settings has the AI connection.`; }
    page.replaceChildren(); render(page, ctx);
  }, { class: "secondary" })));
  if (aiNote) found.append(ui.notice("info", aiNote));
  root.append(found);

  // 4. what it would change
  const props = ui.card("What it would change");
  if (!d.proposals.length) props.append(ui.h("p", { class: "muted" }, d.kind === "statement" && !accountId ? "Pick the account above." : "Nothing to change from what was found."));
  for (const x of d.proposals) {
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
  root.append(props);
  if (d.kind === "advisor") root.append(ui.card(null, ui.row(ui.h("a", { class: "btn secondary", href: "#/scenarios/advisor-plan" }, "Compare it on Advisor's plan"))));

  function fmtVal(k, v) {
    if (k === "period") return { weekly: "weekly", biweekly: "every two weeks", semimonthly: "twice a month", monthly: "monthly" }[v] ?? v;
    if (k === "asOf" || k === "firm") return v ? `on ${v}` : "";
    if (["returnStocks", "returnBonds", "inflation", "fee", "quotedChance"].includes(k)) return `${k.replace(/([A-Z])/g, " $1").toLowerCase()} ${Math.round(v * 1000) / 10}%`;
    if (k.startsWith("retireAge")) return `retire at ${v}`;
    return money(v);
  }
}

const TITLES = { income: "Pay on the Income page", withholding: "Tax withheld per paycheck (Withholding check)", contribution: "401(k) per paycheck (Contributions)", balance: "The account's balance", ssa: "Social Security at full retirement age", advisor: "The advisor's assumptions (Advisor's plan)" };
