// qa/fixtures/setup-personas.mjs -- the three walks of the smart-guesses spec (7.H), built with Get started's own apply
// functions up to the debts question (Q5b), so a test can answer Q5b with or without our guesses. Invented people:
//   jordan()  one parent of two in Ohio, $58,000 a year, born June 1985, a home and a mortgage (knows the payment only)
//   patLee()  a couple in Arizona, $85,000 + $40,000, born 1965 and 1967, a typed $450,000 home, a mortgage
//   sam()     one person in Texas, $48,000, born 2002, $1,200 checking and $800 savings, a car loan and credit cards
// Used by modules/overview/guesses/module.test.mjs, modules/overview/setup/module.test.mjs and the C2 phone walks.
import * as S from "../../modules/overview/setup/compute.js";
import { emptyPlan, migrate } from "../../core/schema/migrate.js";

export const PERSONA_TODAY = "2026-11-02";

export function jordan(today = PERSONA_TODAY) {
  const p = migrate(emptyPlan());
  S.applyYou(p, { name: "Jordan", who: "me", kids: 2, state: "OH" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: "58000", period: "annual" } } });
  S.applyAges(p, { people: { "setup-self": { month: 6, year: 1985, stopAge: 65, ss: { mode: "estimate" } } }, kids: { "setup-kid-1": 2019, "setup-kid-2": 2023 } }, today);
  S.applyHavePicks(p, ["checking", "home"]);
  S.applyOwePicks(p, ["mortgage"]);
  return p;
}

export function patLee(today = PERSONA_TODAY) {
  const p = migrate(emptyPlan());
  S.applyYou(p, { name: "Pat", who: "spouse", partnerName: "Lee", kids: 0, state: "AZ" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: "85000", period: "annual" }, "setup-partner": { status: "work", amount: "40000", period: "annual" } } });
  S.applyAges(p, { people: { "setup-self": { month: 3, year: 1965, stopAge: 65, ss: { mode: "estimate" } }, "setup-partner": { month: 8, year: 1967, stopAge: 65, ss: { mode: "estimate" } } } }, today);
  S.applyHavePicks(p, ["checking", "retire", "home"]);
  S.applyHaveAmounts(p, { checking: 28000, home: 450000, "retire-setup-self": 500000 }, today);
  S.applyOwePicks(p, ["mortgage"]);
  return p;
}

export function sam(today = PERSONA_TODAY) {
  const p = migrate(emptyPlan());
  S.applyYou(p, { name: "Sam", who: "me", kids: 0, state: "TX" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: "48000", period: "annual" } } });
  S.applyAges(p, { people: { "setup-self": { month: 2, year: 2002, stopAge: 65, ss: { mode: "estimate" } } } }, today);
  S.applyHavePicks(p, ["checking", "savings"]);
  S.applyHaveAmounts(p, { checking: 1200, savings: 800 }, today);
  S.applyOwePicks(p, ["car-loan", "credit"]);
  return p;
}
