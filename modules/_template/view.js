// modules/_template/view.js -- DOM only. Build the page with ctx.ui, read numbers
// from ctx.derived (this module's compute() result) or ctx.computeOf("group/id").
// Change the plan ONLY through ctx.store.update(draft => ...). Commit on save/blur,
// not on every keystroke (the shell re-renders the page after each update).
// Return a cleanup function if you set timers or global listeners.
export function render(root, ctx) {
  const { ui, derived } = ctx;
  root.append(
    ui.card("Template page",
      ui.muted("Copy modules/_template to modules/<group>/<id>/ and edit. This page shows the module contract working."),
      ui.row(ui.stat("Accounts on file", String(derived?.example ?? 0))),
    ),
  );
  return () => { /* cleanup */ };
}
