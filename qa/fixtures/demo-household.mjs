// qa/fixtures/demo-household.mjs -- an invented family for the single-file build (`node tools/build.mjs --demo
// qa/fixtures/demo-household.mjs --out <file>`): two parents, two children, a mortgage, two cars (one with a loan),
// a 401(k), savings and a card. Everything here is made up. It is the sample family (family-plan.mjs) with a second
// child and a second car added; balances are dated `today`.
import { familyPlan } from "./family-plan.mjs";

export function demoHousehold(today = "2026-10-30") {
  const p = familyPlan(today);
  p.meta.name = "Our plan";
  p.household.people.push({ id: "p-dee", name: "Dee", role: "dependent", birthDate: "2017-09-12" });
  p.accounts.push(
    { id: "a-car1", name: "Family car", type: "vehicle", balance: 21000, asOf: today, ownerId: "", history: [] },
    { id: "a-car2", name: "Bo's truck", type: "vehicle", balance: 14500, asOf: today, ownerId: "p-bo", history: [] },
  );
  return p;
}
export default demoHousehold;
