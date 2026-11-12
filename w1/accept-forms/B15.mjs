// B15. Every Remove asks first, naming what goes (ui.confirm). On each page below a person reaches the Remove or Delete
// of one named row (on the row itself, or in the form the row opens) and taps it with the question answered "no": one
// question was asked (the phone's own, or the page's own on screen: People), it names the row, and the plan did not
// change. Then "yes" on one page: the row goes and a green line says so. taxes/documents (claude-a's page, still one tap at ee09f6e) is left out: its handoff is in the build log.
// usage: node B15.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, planOf, look, H } from "./_lib.mjs";

const withContacts = () => { const p = H.family(); p.contacts = [{ id: "ct0", role: "advisor", name: "Helper A", firm: "Firm 1", phone: "555-0100", email: "", notes: "", accountIds: [], policyIds: [], last4: {} }]; return p; };
// [page, household, the row a person opens first (null: the Remove is on the row), a word the question must name]
const PAGES = [
  ["balance/net-worth", "family", null, "House"],
  ["household/contacts", withContacts, null, "Helper A"],
  ["household/people", "family", "Cy", "Cy"],
  ["goals/goals", "family", "Replace Bo's car", "Replace Bo's car"],
  ["cashflow/income", "family", "Weekend photography", "Weekend photography"],
  ["cashflow/expenses", "family", "Groceries", "Groceries"],
];
const removeOf = (s) => s.page.locator("#content button:visible").filter({ hasText: /^(Remove|Delete)\b/ });
for (const [route, hh, rowText, name] of PAGES) await run(`B15-${route}`, hh, route, async (s) => {
  if (rowText) {
    const row = s.page.locator("#content li").filter({ hasText: rowText }).first();
    const edit = row.getByRole("button", { name: /^Edit/ }).first();
    await swipeTap(s, (await edit.count()) ? edit : row, 700); await settle(s.page); await sleep(400);
  }
  const all = removeOf(s);
  // the row's own Remove (the page's first when the Remove is on each row and the first row is the named one)
  const rm = rowText ? all.first() : s.page.locator("#content li:visible, #content tr:visible").filter({ hasText: name }).first().locator("button").filter({ hasText: /^(Remove|Delete)\b/ }).first();
  if (!(await rm.count())) { say(`B15-${route}`, false, `no Remove or Delete for "${name}" on the page${rowText ? " after opening its row" : ""}`); return; }
  const label = (await rm.textContent()).trim().slice(0, 40);
  const before = JSON.stringify(await planOf(s));
  await s.page.evaluate(() => { window.__j.confirmAnswer = false; window.__j.confirms = []; });
  await swipeTap(s, rm, 700); await settle(s.page);
  const asked = await s.page.evaluate(() => window.__j.confirms.slice());
  const same = JSON.stringify(await planOf(s)) === before;
  // a page may ask on the page itself instead (People lists what goes with the person and offers the ways): a question
  // on screen that names the row, with nothing changed yet
  const onPage = asked.length ? null : await s.page.evaluate((n) => [...document.querySelectorAll("#content h2, #content h3, #content .notice")].filter((e) => e.getClientRects().length > 0).map((e) => e.textContent.replace(/\s+/g, " ").trim()).find((t) => t.includes(n) && t.includes("?")) ?? null, name);
  say(`B15-${route}`, same && ((asked.length === 1 && asked[0].includes(name)) || !!onPage), `"${label}" for ${name}: asked ${asked.length ? JSON.stringify(asked) : `on the page ${JSON.stringify(onPage)}`}; plan unchanged ${asked.length ? 'after "no"' : "so far"}: ${same}`);
  if (route !== "cashflow/income") return;
  // and "yes": it goes, and the page says so
  await s.page.evaluate(() => { window.__j.confirmAnswer = true; window.__j.confirms = []; });
  await swipeTap(s, removeOf(s).first(), 1200); await settle(s.page); await sleep(300);
  const gone = !(await planOf(s)).income.some((x) => x.name === name), l = await look(s);
  const said = [...l.okInView, ...(await s.page.evaluate(() => [...document.querySelectorAll(".save-echo")].map((e) => e.textContent.trim())))];
  say(`B15-${route}-yes`, gone && said.some((t) => t.includes(name)), `answered "yes": ${name} gone from the plan ${gone}; said on screen ${JSON.stringify(said)}`);
});
done("B15 every Remove asks first");
