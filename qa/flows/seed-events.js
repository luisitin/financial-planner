// qa/flows/seed-events.js -- a family trip and a big birthday for the SANDBOX family (after seed-family.js). Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-events.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
const y = new Date().getFullYear();
plan.events = [
  { id: "ev-trip", name: "Lake week", kind: "trip", date: `${y + 1}-07-10`, people: 3, nights: 7, flightPerPerson: 420, lodgingPerNight: 210, foodPerPersonDay: 45, activities: 300, other: 150 },
  { id: "ev-bday", name: "Bo's 40th", kind: "other", date: `${y + 2}-11-02`, other: 2500 },
];
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { events: 2 };
