# My own plan, written before reading w1/forms2 (19:20)
- ERR: ui.form novalidate; kit check per control from the schema (required, money, number/percent min/max/whole, date
  badInput + year 1900..2100 + notFuture, text pattern) + field.check(v, all) + opts.check(values); words under the box
  (small.field-error, aria-invalid, aria-describedby), help kept; on submit: all errors shown, first bad box's .field
  scrolled under the top bar (label visible) + focused; one summary line above .form-actions listing the boxes (44px
  links), live: shrinks as boxes are fixed. On blur: only a changed, non-empty box is checked. On input: clear when fixed.
  Global safety net for hand-built forms: document capture 'invalid' -> same words at the box, bubble suppressed.
  Page-level notices made inside onSubmit (form.prepend / root.prepend) -> moved (cloned) into the summary slot, deduped.
  ui.fieldError(control, words) + ui.check(scope) for plain-button saves (payoff, credit cards).
  Money default max 1e9; step ignored except whole numbers (step 1); date sanity.
- ENTER: enterkeyhint next/done; Enter in a non-last box focuses the next text-like box or select; last submits.
  One submit per form per 800 ms (Enter twice).
- EDIT: kit records the opener (focused or last-tapped row/button) when a ui.form is built; Cancel (wrapped) returns
  scroll+focus to the opener; after a successful submit's redraw the kit returns to the opener's twin (locator) when the
  person's place is gone. Keyboard-opened form -> first box focused (K4). Page adoption: ui.editAt(row, form) to open AT
  the row.
- UNDO: ui.change(store, fn) = store.update + a diff ticket (changed paths, ids for list rows); ticket.undo() applies the
  inverse only where the value is still what the change left. ui.notice(kind, text, { undo }) adds a 44px Undo.
  ui.undoLine(ticket, words) for done rows. Removes of typed records keep window.confirm (app's way).
- LIVE: page adoption (results holder) for mortgage/cap gains/brackets; kit ui.later(fn) to defer a page-local redraw
  until the tap under way landed; store-driven redraws are place's (focus put back, M8).
- RESULT: ui.reveal(el) (no-op when readable in view; else top under the top bar; queued until after the shell's draw);
  kit form snapshot of page cards by key before submit; after the redraw: target = [data-answer] | the opener row (edit)
  | first new card/row | first changed card; reveal only when the person's place is gone (button gone / scroll clamped)
  or the form opted in (answer: true); otherwise the echo carries "Show the answer" (place's echo).
- TARGET: ui.goTo(ctx, key, words) 44px row link named by the page's title; .notice a { padding-block } to raise
  inline link hit area; page adoption for the rest.
- Shell needs: ui.afterDraw() called by show() after render and after place restores folds/focus; place treats a kit
  reveal/return as "the page scrolled itself"; place ignores removals of [data-kit] nodes; ui.setSay(echo) for "Put
  back." and errors not on screen.
