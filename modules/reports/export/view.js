// modules/reports/export/view.js -- DOM only. Every table as a file a spreadsheet opens: what you typed
// in, then what the pages work out, each with its size and a download button; and the whole plan as
// one file. Downloads happen in the browser; nothing is sent anywhere.
import { compute, datasetCsv } from "./compute.js";

let pending = null;   // the confirmation shown after a download starts (the shell may re-render)

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const today = fmt.today();
  const d = compute(plan, { today });
  const say = ui.h("div", { "aria-live": "polite" });
  const save = (name, text, type) => {
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type }));
      a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      pending = ["ok", `${name} is downloading. Open it with Excel, Numbers or Google Sheets.`];
    } catch (e) { pending = ["error", `The file could not be made: ${e.message}. Reload the page and try again.`]; }
    say.replaceChildren(ui.notice(...pending));
  };
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Export"),
    ui.h("p", { class: "lede" }, "Any table in the app as a file a spreadsheet opens (CSV), to check the numbers your own way, share them with an advisor, or keep a copy. The files are made on this device; nothing is sent anywhere."),
    d.total === 0 ? ui.h("p", {}, "There is nothing to export yet: start with your accounts on the Net worth page.") : null));
  root.append(say);
  if (pending) { say.append(ui.notice(...pending)); pending = null; }
  const group = (title, kind, note) => ui.h("section", { class: "card" }, ui.h("h2", {}, title), ui.h("p", { class: "muted small" }, note),
    ui.h("ul", { class: "records" }, d.datasets.filter((x) => x.kind === kind).map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.title), ui.h("span", { class: "rec-value" }, x.rows ? `${x.rows.toLocaleString("en-US")} row${x.rows === 1 ? "" : "s"}` : "empty")),
      ui.h("div", { class: "rec-sub" }, x.what),
      ui.h("div", { class: "rec-foot" }, ui.h("span", {}, `${x.columns} columns`), ui.h("span", { class: "rec-actions" }, ui.button("Download CSV", () => save(`planner-${x.id}-${today}.csv`, datasetCsv(plan, x.id, today), "text/csv;charset=utf-8"), { class: "secondary small", disabled: x.rows ? null : true })))))));
  root.append(group("What you typed in", "typed", "The lists you keep in the app, as they are today."));
  root.append(group("What the app works out", "worked", "The plan's own figures, as the pages show them today (money in today's dollars)."));
  root.append(ui.card("The whole plan, as one file",
    ui.h("p", { class: "muted small" }, "Everything in one JSON file: what Settings saves as a backup, and what Settings can load back in."),
    ui.row(ui.button("Download the plan (JSON)", () => save(`plan-${today}.json`, JSON.stringify(plan, null, 2), "application/json"), { class: "secondary" }))));
}
