// qa/flows/seed-policies.js -- add a household's usual policies to the SANDBOX plan (after
// qa/flows/seed-family.js): term life through work and a private one, disability through work,
// health, home, the cars, no umbrella. Insurers are invented. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-policies.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
const y = new Date().getFullYear();
plan.insurance = { policies: [
  { id: "pol-ana-work", name: "Ana's group life", kind: "term", personId: "p-ana", insurer: "Cedar Group Benefits", benefit: 200000, premium: 0, period: "monthly", throughWork: true },
  { id: "pol-ana-term", name: "Ana's 20-year term", kind: "term", personId: "p-ana", insurer: "Lantern Life", benefit: 500000, premium: 32, period: "monthly", endDate: `${y + 16}-03-01` },
  { id: "pol-bo-work", name: "Bo's group life", kind: "term", personId: "p-bo", insurer: "Harbor Mutual", benefit: 125000, premium: 0, period: "monthly", throughWork: true },
  { id: "pol-ana-ltd", name: "Ana's long-term disability", kind: "disability", personId: "p-ana", insurer: "Cedar Group Benefits", benefit: 5070, premium: 22, period: "monthly", throughWork: true },
  { id: "pol-health", name: "Family health plan", kind: "health", personId: "", insurer: "Bluepine Health", benefit: 9000, premium: 640, period: "monthly", throughWork: true, renewalDate: `${y + 1}-01-01` },
  { id: "pol-home", name: "Homeowners", kind: "home", personId: "", insurer: "Oakridge Home & Auto", benefit: 410000, premium: 2160, period: "annual", renewalDate: `${y}-12-05` },
  { id: "pol-auto", name: "Two cars", kind: "auto", personId: "", insurer: "Oakridge Home & Auto", benefit: 300000, premium: 104, period: "monthly", renewalDate: `${y + 1}-04-10` },
] };
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { policies: plan.insurance.policies.length };
