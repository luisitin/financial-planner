// qa/fixtures/guessed-plan.mjs -- a household made by walking Get started (overview/setup) and leaving the boxes a
// layperson does not know empty, so the plan holds today's older guesses: the typical card and mortgage rates and
// payments (debts[].rateGuessed / paymentGuessed), Social Security worked out from pay (guide.setup.ssWrote), spending
// once work stops that follows the bills (retireAuto) and the safety cushion (cushionTarget / cushionFunds). Invented
// people (Ana and Bo, Ohio). Used by tests/guesses-*.test.mjs, modules/overview/guesses/module.test.mjs and screenshots.
import * as S from "../../modules/overview/setup/compute.js";
import { emptyPlan, migrate } from "../../core/schema/migrate.js";

export function guessedPlan(today = "2026-11-01") {
  const p = migrate(emptyPlan());
  S.applyYou(p, { name: "Ana", who: "spouse", partnerName: "Bo", kids: 1, state: "OH" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: "68k", period: "annual" }, "setup-partner": { status: "work", amount: "1,900", period: "biweekly" } } });
  S.applyAges(p, { people: { "setup-self": { month: 4, year: 1988, stopAge: 65, ss: { mode: "estimate" } }, "setup-partner": { month: 9, year: 1986, stopAge: 65, ss: { mode: "estimate" } } }, kids: { "setup-kid-1": 2019 } }, today);
  S.applyHavePicks(p, ["checking", "savings", "retire"]);
  S.applyHaveAmounts(p, { checking: 2800, savings: 6500, "retire-setup-self": 38000 }, today);
  S.applyOwePicks(p, ["credit", "mortgage"]);
  // the rates and payments left empty: the setup puts in the typical ones and remembers they are guesses
  S.applyOweAmounts(p, { credit: { owed: 3600 }, mortgage: { owed: 185000, home: "260k" } }, today);
  S.applySpend(p, { mode: "rows", rows: { housing: 350, utilities: 320, groceries: 850, transport: 380, insurance: 240, childcare: 500, dining: 300, shopping: 400 } });
  S.applySpend(p, { ...S.valuesFor(p, "spend", { today }), retireMonthly: S.retireDefault(p, today), retireAuto: true });
  S.applyGoalPicks(p, ["cushion", "debt"]);
  S.applyGoalDetails(p, { cushion: { months: 3 } }, today);
  S.applyGuesses(p, today);
  S.markAt(p, "done", today);
  return p;
}
