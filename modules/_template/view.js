// modules/_template/view.js -- DOM only. Build the page with ctx.ui, read numbers
// from ctx.derived (this module's compute() result) or ctx.computeOf("group/id").
// Change the plan ONLY through ctx.store.update(draft => ...). Commit on save/blur,
// not on every keystroke (the shell re-renders the page after each update).
// Return a cleanup function if you set timers or global listeners.
//
// Simple first (docs/OPTIONAL.md): the answer and one action on the first view; every other
// figure, the working and the person's own boxes in parts (core/ui/more.js), rows of one card
// right under the answer; the deeper pages in "More on this", each row the question it answers.
// Copied to modules/<group>/<id>/, a page sits one folder deeper: the import becomes "../../../core/ui/more.js".
import { parts, links } from "../../core/ui/more.js";

export function render(root, ctx) {
  const { ui, derived } = ctx;
  const n = derived?.example ?? 0;
  root.append(
    ui.card("Template page",
      ui.row(ui.stat("Accounts on file", String(n))),
      ui.muted(n ? "Copy modules/_template to modules/<group>/<id>/ and edit. This page shows the module contract working." : "Add an account on Net worth first: this page counts them."),
    ),
  );
  // the optional parts, in one card (parts() returns null when there is none: ui.h skips it, root.append would not)
  const more = parts(ctx,
    { id: "how", kind: "how", says: "1 step", body: [ui.muted("Counts the accounts in your plan, one by one.")] },
  );
  if (more) root.append(more);
  const deeper = links(ctx, [{ href: "#/balance/net-worth", ask: "What do I own and owe?", says: "Net worth" }]);
  if (deeper) root.append(deeper);
  return () => { /* cleanup */ };
}
