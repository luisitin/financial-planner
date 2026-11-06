// qa/flows/path-walk.js -- the walk from point A to point B (the path spec, 2026-11-06): tap only the forward button, from the
// last question the persona has not answered, through every step of the path, to "Your plan". Households: sam (a young
// renter), jordan (a family), ruth (a retired widow); pick one with ?household=sam in the address (default sam).
// Run it TWICE in one command: the first run seeds the persona (the questions up to Q5, as qa/fixtures/setup-personas.mjs builds
// it) into the sandbox, drive.mjs reloads the page between scripts, the second run walks:
//   node tools/drive.mjs "http://127.0.0.1:8787/?sandbox=1&household=sam#/overview/start" --script qa/flows/path-walk.js --script qa/flows/path-walk.js
// Never run it with --real. It records, at every page: the address, "Step N of M", the main path buttons (must be 1), the filled
// buttons (reported, not failed: some step pages draw a button of their own), banned words in the first screen (reported until the
// plain-words pass lands, then must be 0), overflow wider than the screen and tap targets under 44 px (must be 0 on the path's own
// parts; the page's own small links are reported), and it fails when a Next lands on a page already seen (a loop), when a step page
// has no Next, or when Your plan is not reached. Tested by the tester role (docs/TEAM.md); the builder wrote it.
const params = new URLSearchParams(location.search);
if (!params.has("sandbox")) throw new Error("path-walk.js only runs in the sandbox");
const HOUSEHOLD = params.get("household") || "sam";
const KEY = "planner.plan.sandbox", FLAG = "planner.qa.walk";
const LIMIT = { sam: 18, jordan: 20, patLee: 18, ruth: 16 };
const BANNED = ["Monte Carlo", "simulated", "liabilities", "assumptions", "net worth", "RMD", "AGI", "IRMAA", "W-4", "withholding", "withheld", "guide", "journey", "scenario", "lever", "levers", "goal seek", "PC", "AI", "server", "sandbox", "inflation", "bonds", "stocks", "pre-tax", "Roth", "Medigap", "9 of 10 markets", "middle run", "must-pay"];
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

if (localStorage.getItem(FLAG) !== HOUSEHOLD) {
  const P = await import("/qa/fixtures/setup-personas.mjs");
  const S = await import("/modules/overview/setup/compute.js");
  const make = P[HOUSEHOLD];
  if (!make) throw new Error("no household " + HOUSEHOLD);
  const plan = make(today);
  S.markAt(plan, "owe", today);
  localStorage.setItem(KEY, JSON.stringify(plan));
  localStorage.setItem(FLAG, HOUSEHOLD);
  const screens = S.visibleScreens(plan), at = S.nextScreen(plan, "owe");
  return { seeded: HOUSEHOLD, startsAt: at, seededScreens: screens.findIndex((s) => s.id === at) - 1, next: "run this script again (second --script): it walks" };
}

const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
const re = new RegExp(`\\b(${BANNED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
const audit = () => {
  const c = document.getElementById("content");
  const pg = c.querySelector("[data-page]") || c;
  const first = [], w = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.textContent.trim(); const el = n.parentElement; if (!t || !el || !vis(el) || el.closest("style,script")) continue; if (el.getBoundingClientRect().top < innerHeight + scrollY) first.push(t); }
  const banned = [...new Set((first.join(" ").match(new RegExp(re.source, "gi")) || []).map((x) => x.toLowerCase()))];
  const small = [...c.querySelectorAll("button, a, summary, input:not([type=checkbox]):not([type=hidden]), select")].filter(vis).map((e) => ({ t: (e.textContent || e.value || "").trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height) })).filter((x) => x.h > 0 && x.h < 44);
  const filled = [...c.querySelectorAll("a.btn:not(.secondary), button:not(.secondary):not(.small):not(.gb-textbtn):not(.gd-textbtn):not(.su-skip)")].filter(vis).map((e) => e.textContent.trim().slice(0, 30));
  return {
    hash: location.hash.replace(/\?.*$/, ""), step: document.querySelector(".gb-root .gb-name")?.textContent ?? null,
    main: [...document.querySelectorAll(".gn-main > a.btn")].filter(vis).map((e) => e.textContent.trim()),
    filled, small, banned, overflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
};
const waitCard = async () => { for (let i = 0; i < 80; i++) { if (document.querySelector(".gn-root .gn-main a.btn")) return true; await qa.sleep(250); } return false; };

const pages = [], seen = [];
let taps = 0, setupTaps = 0, stepTaps = 0, loops = 0;
const startAt = qa.plan()?.guide?.setup?.at ?? "owe";
await qa.go("overview/setup/" + (startAt === "owe" ? "owe-amounts" : startAt), 1200);
for (let i = 0; i < 60; i++) {
  await qa.sleep(700);
  const hash = location.hash;
  if (hash.startsWith("#/overview/plan")) break;
  if (hash.startsWith("#/overview/setup")) {
    const screen = hash.replace("#/overview/setup/", "").replace(/\?.*/, "");
    if (screen === "done") {
      await qa.sleep(1800);   // "Putting your plan together"
      const next = document.querySelector("#content .su-end a.btn");
      if (!next) throw new Error("the reveal has no Next button");
      pages.push({ ...audit(), reveal: (document.querySelector(".su-next")?.innerText || "").replace(/\n+/g, " | ").slice(0, 200) });
      next.click(); taps++; stepTaps++; continue;
    }
    const b = [/^Continue/, /^See where I stand/, /^Skip: use our guesses/, /^Skip this question/].map((r) => [...document.querySelectorAll("#content button")].find((e) => r.test(e.textContent.trim()) && vis(e))).find(Boolean);
    if (!b) throw new Error("no forward button on setup screen " + screen);
    pages.push(audit());
    b.click(); taps++; setupTaps++; continue;
  }
  const ok = await waitCard();
  const a = audit();
  const key = a.hash;
  if (seen.includes(key)) { loops++; a.loop = true; }
  seen.push(key); pages.push(a);
  if (!ok) throw new Error("a step page with no Next at the bottom: " + hash);
  document.querySelector(".gn-main > a.btn").click(); taps++; stepTaps++;
}
await qa.sleep(1500);
localStorage.removeItem(FLAG);
const text = qa.pageText();
const reached = location.hash.startsWith("#/overview/plan") && /Your plan is ready/.test(text);
const stepPages = pages.filter((p) => p.step);
const problems = [];
if (!reached) problems.push("Your plan was not reached: " + location.hash);
if (loops) problems.push(loops + " loop(s): a Next landed on a page already seen");
for (const p of stepPages) { if (p.main.length !== 1) problems.push(`${p.hash}: ${p.main.length} main buttons`); if (p.overflow) problems.push(`${p.hash}: overflow`); }
if (stepPages.length && !(stepTaps === stepPages.length + 1)) problems.push(`Next taps from the reveal to Your plan = ${stepTaps}, steps = ${stepPages.length}`);
const total = taps + 1 + 6;   // + Let's go + the six questions the persona answered
if (total > LIMIT[HOUSEHOLD]) problems.push(`${total} forward taps from A, more than ${LIMIT[HOUSEHOLD]}`);
const out = {
  household: HOUSEHOLD, reachedYourPlan: reached, forwardTapsInBrowser: taps, setupTaps, nextTapsFromReveal: stepTaps, steps: stepPages.length, totalFromA: total, loops,
  twoFilledButtons: stepPages.filter((p) => p.filled.length > 1).map((p) => p.hash), bannedWordsFirstScreen: pages.filter((p) => p.banned.length).map((p) => `${p.hash}: ${p.banned.join(", ")}`),
  smallTargets: pages.filter((p) => p.small.length).map((p) => `${p.hash}: ${p.small.map((s) => s.t + " " + s.h).join("; ")}`),
  pages: pages.map((p) => `${p.hash}  ${p.step ?? ""}`), problems,
};
if (problems.length) throw new Error(JSON.stringify(out));
return out;
