// qa/flows/seed-digital.js -- the SANDBOX family's digital accounts (after seed-family.js): email with a legacy
// contact, a password manager without emergency access yet, photos, one note that looks like a secret. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-digital.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.estate = plan.estate ?? { documents: [], beneficiaries: [] };
plan.estate.digital = [
  { id: "dg-mail", kind: "email", name: "Ana's main email", access: "legacy", contact: "Bo", notes: "" },
  { id: "dg-pm", kind: "manager", name: "Family password manager", access: "none", contact: "", notes: "set up emergency access for Bo" },
  { id: "dg-photos", kind: "photos", name: "Shared photo library", access: "written", contact: "Bo", notes: "" },
  { id: "dg-phone", kind: "phone", name: "Ana's phone", access: "written", contact: "", notes: "pin: 4821" },
];
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { items: plan.estate.digital.length };
