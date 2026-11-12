// B7 -- A stray tap on another row keeps my typing, says so at once, and never puts it in the other row. I change Ana's
// salary, my thumb lands on Bo's row: Bo's form shows Bo's saved figures, a note names Ana's form within half a second,
// Bo is saved with his own figures, Ana's row again shows my typing with "Not saved yet". Cancel still throws it away.
import { H, sleep, settle, seen, type, look, planOf, tapRow, tapBtn, thumb, journeys } from "./_lib.mjs";
const formVals = (p) => p.evaluate(() => { const f = document.querySelector("#content form"); if (!f) return null; const g = (n) => [...f.querySelectorAll("input")].find((i) => i.getAttribute("name") === n)?.value ?? null; return { amount: g("amount"), growth: g("growth") }; });
const plain = (v) => String(v ?? "").replace(/,/g, "");
await journeys("B7 a stray tap keeps my typing apart", [
  ["Income: Ana's form typed, a stray tap on Bo's row", "family", "cashflow/income", async (s, p) => {
    const plan0 = await planOf(p); const bo0 = plan0.income.find((i) => /^Bo/.test(i.name));
    await tapRow(s, "Ana's salary");
    await type(s, "input[name=amount]", "4100", { clear: true });
    const hasGrowth = !!(await seen(p, "input[name=growth]"));
    if (hasGrowth) await type(s, "input[name=growth]", "6", { clear: true });
    await thumb(s, "li, [role=button], .rec, tr, a, button", { text: "Bo's salary" });
    let noteAt = null; const t0 = Date.now();
    for (let i = 0; i < 12 && noteAt === null; i++) { const l = await look(p); if ((l.note && /Ana/.test(l.note)) || l.kept.some((k) => /Ana/.test(k) && l.notSavedOnScreen)) noteAt = Date.now() - t0; else await sleep(50); }
    const l = await look(p);
    await sleep(700); await settle(p);
    const bo = await formVals(p);
    await type(s, "input[name=amount]", "5400", { clear: true });
    await tapBtn(s, "Save", "button");
    const bo1 = (await planOf(p)).income.find((i) => /^Bo/.test(i.name));
    await tapRow(s, "Ana's salary");
    const ana = await formVals(p), l2 = await look(p);
    const boClean = plain(bo?.amount) === plain(bo0.amount) && (!hasGrowth || Math.abs(Number(bo?.growth) - Number(bo0.growth) * 100) < 1e-6);   // the raise box shows a percent (0.03 as 3)
    return { boAtStray: bo, bo0: `${bo0.amount}/${bo0.growth}`, noteWithinMs: noteAt, note: l.note, boSaved: `${bo1.amount}/${bo1.growth}`, anaAgain: ana, hint: l2.notSaved,
      ok: boClean && noteAt !== null && noteAt <= 600 && Number(bo1.amount) === 5400 && bo1.growth === bo0.growth && plain(ana?.amount) === "4100" && (!hasGrowth || plain(ana?.growth) === "6") && l2.notSaved > 0 };
  }],
  ["Income: Cancel still throws the typing away", "family", "cashflow/income", async (s, p) => {
    await tapRow(s, "Ana's salary");
    const drawn = (await formVals(p))?.amount;
    await type(s, "input[name=amount]", "4100", { clear: true });
    await tapBtn(s, "Cancel", "button");
    await tapRow(s, "Ana's salary");
    const again = (await formVals(p))?.amount, l = await look(p);
    return { drawn, again, words: l.notSaved, ok: again === drawn && l.notSaved === 0 };
  }],
]);
