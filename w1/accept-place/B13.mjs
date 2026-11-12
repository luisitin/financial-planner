// B13 -- "Undo my typing" puts back what the page showed: every box of that form back to the figure the page drew, the
// words go, and nothing is kept for it any more (the next visit says nothing).
import { H, sleep, settle, seen, thumb, type, vals, look, openFold, menuTo, phoneBack, journeys } from "./_lib.mjs";
await journeys("B13 Undo my typing", [
  ["Estimated payments: a quarter typed, last year saved, Undo my typing", "family", "taxes/estimated", async (s, p) => {
    const drawn = (await vals(p, "#content input[name=q0]")).join("|");
    await type(s, "input[name=q0]", "1000", { clear: true });
    await openFold(s, "Last year"); await type(s, "input[name=tax]", "9000", { clear: true });
    await thumb(s, "details[open] button[type=submit]", {}); await sleep(900); await settle(p);
    const kept = (await vals(p, "#content input[name=q0]")).join("|");
    if (!(await seen(p, "button", { text: "Undo my typing" }))) return { drawn, kept, ok: false, why: "no Undo my typing" };
    await thumb(s, "button", { text: "Undo my typing" }); await sleep(700); await settle(p);
    const after = (await vals(p, "#content input[name=q0]")).join("|"), l = await look(p);
    await menuTo(s, "Dashboard"); await phoneBack(s);
    const again = (await vals(p, "#content input[name=q0]")).join("|"), l2 = await look(p);
    return { drawn, kept, afterUndo: after, words: l.notSaved, nextVisit: again, wordsNextVisit: l2.notSaved, ok: after === drawn && l.notSaved === 0 && again === drawn && l2.notSaved === 0 && kept !== drawn };
  }],
]);
