// modules/system/diagnostics/view.js -- DOM only. "Is everything working?": the plan's own check (with a fix where one is
// safe), every page's sums run on the plan, where the plan is kept, the PC and the AI helper; versions and connection
// details folded last.
import { compute, applyFix, checkPages, STORAGE_LIMIT } from "./compute.js";

let pending = null;      // the confirmation shown on the next render
let pageCheck = null;    // { at (the plan's updatedAt), result } so a re-render does not run every page again

const STYLE = `
.dg-root .pill { margin-left: 0; white-space: nowrap; }
.dg-root .pill.bad { color: var(--bad); border-color: var(--bad); background: var(--bad-soft); }
.dg-root .dg-err { font-family: ui-monospace, monospace; font-size: 12px; overflow-wrap: anywhere; color: var(--muted); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store, modules, api, ai } = ctx;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "dg-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  const pill = (kind, text) => ui.h("span", { class: `pill ${kind}` }, text);
  const titleOf = (key) => modules?.get?.(key)?.title ?? key;
  const open = (key, label) => ui.h("a", { class: "btn secondary small", href: `#/${key}` }, label ?? `Open ${titleOf(key)}`);
  const bad = d.issues.filter((x) => x.level === "bad").length;

  // the summary: one line each, filled in as the checks answer
  const line = (title, sub) => {
    const value = ui.h("span", { class: "rec-value" }, pill("", "Checking…"));
    const subEl = ui.h("div", { class: "rec-sub" }, sub ?? "");
    const li = ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, title), value), subEl);
    return { li, set: (kind, text, more) => { value.replaceChildren(pill(kind, text)); if (more !== undefined) subEl.textContent = more; } };
  };
  const L = { plan: line("Your plan"), pages: line("Every page's sums"), kept: line("Where your plan is kept"), pc: line("The PC"), ai: line("The AI helper") };
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Is everything working?"),
    ui.h("p", { class: "muted small" }, "A check of your plan and of the parts of the app that keep and use it. Nothing here changes your plan unless you press Fix."),
    ui.h("ul", { class: "records" }, Object.values(L).map((x) => x.li))));
  L.plan.set(d.issues.length ? (bad ? "bad" : "warn") : "ok", d.issues.length ? `${d.issues.length} to look at` : "No problems", d.issues.length ? "Listed below, with a fix where there is a safe one." : "Every link between people, accounts and goals points somewhere; dates are dates; amounts are numbers.");
  const backend = store.backend?.() ?? "local";
  const sandbox = store.sandbox?.() ?? false;
  L.kept.set(sandbox ? "accent" : backend === "server" ? "ok" : "warn", sandbox ? "Pretend plan" : backend === "server" ? "On your PC" : "This browser only",
    sandbox ? "A pretend plan for trying things out, kept in this browser only; your real plan is untouched." : backend === "server" ? "Every device that connects to your PC sees the same plan; this browser keeps a copy for when it is offline." : "Other devices cannot see it, and clearing this browser's data would remove it: connect to your PC (Settings), or export a copy now and then.");

  // the plan's own check
  const problems = ui.card("Problems in your plan");
  if (!d.issues.length) problems.append(ui.notice("ok", "No problems found in your plan."));
  else problems.append(ui.h("ul", { class: "records" }, d.issues.map((x) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.text}.`), ui.h("span", { class: "rec-value" }, pill(x.level === "bad" ? "bad" : "warn", x.level === "bad" ? "Problem" : "Check"))),
    x.names ? ui.h("div", { class: "rec-sub" }, x.names) : null,
    ui.h("div", { class: "rec-foot" }, ui.h("span", {}, ""), ui.h("span", { class: "rec-actions" },
      x.fix ? ui.button(x.fix.label, () => {
        if (!ui.confirm(`${x.fix.label}? This changes ${x.count === 1 ? "1 item" : `${x.count} items`} in your plan.`)) return;
        store.update((q) => { const n = applyFix(q, x.key); pending = `Fixed: ${n === 1 ? "1 item" : `${n} items`} changed.`; });
      }, { class: "small" }) : null,
      open(x.page)))))));
  root.append(problems);

  // every page's sums on the plan (run once per version of the plan, after the page is shown)
  const pagesCard = ui.card("Every page's sums", ui.h("p", { class: "muted" }, "Running each page's numbers on your plan…"));
  root.append(pagesCard);
  const list = [...(modules?.values?.() ?? [])];
  const byStatus = (s) => list.filter((m) => m.status === s).length;
  const showPages = (r) => {
    L.pages.set(r.failed.length ? "bad" : "ok", r.failed.length ? `${r.failed.length} failed` : `All ${r.ran} work`, r.failed.length ? "Some pages could not work out their numbers: listed below." : `${r.ran} pages worked out their numbers from your plan without an error.`);
    pagesCard.replaceChildren(ui.h("h2", {}, "Every page's sums"),
      r.failed.length ? ui.h("ul", { class: "records" }, r.failed.map((f) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, f.title), ui.h("span", { class: "rec-value" }, pill("bad", "Error"))),
        ui.h("div", { class: "rec-sub" }, "This page could not work out its numbers from your plan. Open it to see what it shows; if it stays broken, the message below helps whoever fixes the app."),
        ui.h("div", { class: "dg-err" }, f.error),
        ui.h("div", { class: "rec-foot" }, ui.h("span", {}, ""), open(f.key, "Open the page"))))) : ui.notice("ok", `All ${r.ran} pages worked out their numbers from your plan.`),
      ui.h("p", { class: "muted small" }, `${list.length} pages in the app: ${byStatus("usable")} ready, ${byStatus("stub")} partly built, ${byStatus("planned")} still to come. ${r.skipped - byStatus("planned") > 0 ? `${r.skipped - byStatus("planned")} pages that run long simulations are not run here: open them to check.` : ""}`));
  };
  const at = plan.meta?.updatedAt ?? "";
  let timer = null;
  if (pageCheck && pageCheck.at === at) showPages(pageCheck.result);
  else timer = setTimeout(() => {
    const result = checkPages(list.map((m) => ({ key: `${m.group}/${m.id}`, title: m.title, compute: m.compute, heavy: m.heavy, status: m.status })), plan, today);
    pageCheck = { at, result };
    showPages(result);
  }, 30);

  // what is in the plan, and how much room it takes
  const c = d.counts;
  const kb = d.size.chars / 1024;
  root.append(ui.card("What is in your plan", ui.row(
    ui.stat("Accounts", String(c.accounts), `${c.people} ${c.people === 1 ? "person" : "people"}, ${c.goals} ${c.goals === 1 ? "goal" : "goals"}`),
    ui.stat("Transactions", c.transactions.toLocaleString("en-US"), `${c.income} income, ${c.expenses} spending items`),
  ), ui.h("p", { class: "muted small" }, `The plan is about ${kb < 1024 ? `${Math.max(1, Math.round(kb))} KB` : `${(kb / 1024).toFixed(1)} MB`}: ${d.size.share < 0.01 ? "under 1%" : `${Math.round(d.size.share * 100)}%`} of the ${Math.round(STORAGE_LIMIT / 1024 / 1024)} MB a browser keeps for one site.`)));

  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/system/settings" }, "Settings"), ui.h("a", { class: "btn secondary", href: "#/household/people" }, "People"))));

  // the PC and the AI helper (asked after the page is shown)
  const details = ui.h("ul", { class: "records" });
  const detail = (title, value) => details.append(ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, title), ui.h("span", { class: "rec-value" }, value))));
  const foldStatus = ui.h("span", { class: "fold-status" }, "checking…");
  let storageOk = true;
  try { localStorage.setItem("planner.diagnostics", "1"); localStorage.removeItem("planner.diagnostics"); } catch { storageOk = false; }
  detail("Plan version", `${d.schema.plan} (this app: ${d.schema.app})`);
  detail("This browser can keep data", storageOk ? "Yes" : "No");
  detail("Online", navigator.onLine ? "Yes" : "No");
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Versions and connection"), foldStatus, ui.h("span", { class: "fold-chev" }, "›")),
    details, ui.h("p", { class: "muted small" }, "For whoever looks after the app. The tests that prove every page's formulas run on the PC: npm test.")));
  (async () => {
    let ok = false;
    try { ok = await api.ready(); } catch { ok = false; }
    const h = api.health;
    L.pc.set(ok ? "ok" : backend === "server" ? "bad" : "", ok ? "Connected" : "Not connected", ok ? `The app's server answers${h?.version ? ` (version ${h.version})` : ""}${h?.plan ? " and holds your plan" : ""}.` : backend === "server" ? "Your plan is kept on the PC but it does not answer now: changes stay in this browser until it does." : "This app is not connected to a PC. That is fine on one device; Settings connects it.");
    if (ok) { detail("App version", h?.version ?? "-"); detail("Server", api.base() || "-"); detail("Asks for a sign-in code", h?.authRequired ? "Yes" : "No"); }
    let st = "off";
    try { st = await ai.status(); } catch { st = "unreachable"; }
    const on = String(st).startsWith("on");
    L.ai.set(on ? "ok" : st === "off" ? "" : "warn", on ? "Working" : st === "off" ? "Turned off" : st === "no models" ? "No model" : "Not answering",
      on ? "The AI helper answers. It explains and sorts; your numbers never come from it." : st === "off" ? "Pages work without it; Settings turns it on." : st === "no models" ? "The AI program answers but has no model installed (see Settings)." : "The AI program does not answer: is it running on the PC? Pages work without it.");
    const s = await ai.settings().catch(() => null);
    if (s) detail("AI helper", `${s.provider}${on ? `, ${String(st).replace(/^on \(|\)$/g, "")}` : ""}`);
    foldStatus.textContent = `${ok ? "connected" : "not connected"}, AI ${on ? "on" : st === "off" ? "off" : "not answering"}`;
  })();

  return () => { if (timer) clearTimeout(timer); };
}
