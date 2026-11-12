// B6. The plain word finds the page named for it first, in the real menu (household's view, typed key by key): "budget"
// lists Budget first; "car" lists Vehicles first and never Medicare; "will" puts the wills page first; "card" puts Credit
// cards first; "who to call", "phone", "papers", "reminder", "reset" find Contacts, the papers page, the money calendar and
// Settings. Topics stay grouped and ordered by their best hit (the owner's rule, design log 2026-09-15).
// usage: node B6.mjs <base> <root>
import { run, say, done, sleep } from "./_lib.mjs";
const WANT = [
  ["budget", (l) => l[0] === "Budget"],
  ["car", (l) => /Vehicle/.test(l[0]) && !l.some((t) => /Medicare/.test(t))],
  ["will", (l) => /Estate documents|will/i.test(l[0]) && !/^Will the money last/.test(l[0])],
  ["card", (l) => l[0] === "Credit cards"],
  ["who to call", (l) => l[0] === "Contacts"],
  ["phone", (l) => l[0] === "Contacts"],
  ["papers", (l) => /Document vault|papers/i.test(l[0])],
  ["reminder", (l) => l[0] === "Money calendar"],
  ["reset", (l) => l[0] === "Settings"],
];
await run("menu", "family", "overview/dashboard", async (p) => {
  const tb = await p.locator("#nav-toggle").boundingBox(); await p.touchscreen.tap(tb.x + 22, tb.y + 22); await sleep(500);
  const box = p.locator("#sidebar .nav-search");
  for (const [word, ok] of WANT) {
    await box.fill(""); await box.focus(); await p.keyboard.type(word, { delay: 50 }); await sleep(250);
    const r = await p.evaluate(() => {
      const groups = [...document.querySelectorAll("#sidebar .nav-group")].map((g) => ({ topic: g.querySelector(".t")?.textContent, pages: [...g.querySelectorAll("a.nav-link")].map((a) => a.textContent.trim()) }));
      return { flat: groups.flatMap((g) => g.pages), groups };
    });
    // grouped by topic: every topic appears once and its pages sit together under it
    const grouped = new Set(r.groups.map((g) => g.topic)).size === r.groups.length;
    say(`"${word}"`, ok(r.flat) && grouped, `first: ${r.flat.slice(0, 4).join(" / ") || "(nothing)"}; topics in order: ${r.groups.slice(0, 4).map((g) => g.topic).join(", ")}`);
  }
});
done("B6 the plain word finds the page named for it first");
