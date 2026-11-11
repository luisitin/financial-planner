// tests/followups-path.test.mjs -- the path follow-ups (B4, B5, B8): one figure on neighbouring screens, one name for the Emergency fund, a retired person's question 4.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PATH_STEPS } from "../modules/overview/guide/journeys.js";
import { RESULT_ROWS } from "../modules/overview/guide/compute.js";
import { ROWS } from "../modules/overview/plan/compute.js";
import * as S from "../modules/overview/setup/compute.js";
import { ruth, jordan } from "../qa/fixtures/setup-personas.mjs";

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("B4: the reveal shows its figures as they are: no count-up from $0 that a look mid-way reads as $380 and -$10,085", () => {
  const v = read("modules/overview/setup/view.js");
  assert.doesNotMatch(v, /requestAnimationFrame\(tick\)/, "the figures counted up for 800 ms");
  assert.doesNotMatch(v, /counters\.push/);
});

test("B4: a cushion above the months aimed for reads '17.9 months, well over the 6 you want', never '18 of 6 months'", () => {
  const row = ROWS.cushion({ st: () => ({ runway: 17.9, runwayTarget: 6, runwayStatus: "warn" }) });
  assert.match(row.line, /well over the 6 you want/);
  assert.doesNotMatch(row.short, /of 6 months/);
  assert.match(row.short, /well over the 6 you want/);
  assert.equal(row.status, "ok");
  // under the aim: as before
  const low = ROWS.cushion({ st: () => ({ runway: 1.9, runwayTarget: 6, runwayStatus: "warn" }) });
  assert.match(low.short, /about 1\.9 months of bills in cash \(the aim is 6 months\)/);   // p058: months of bills, never "1.9 of 6 months"
});

test("B5: the path's step, its short words and the reveal use 'Emergency fund', not 'cash cushion'", () => {
  const step = PATH_STEPS.find((s) => s.key === "cushion");
  assert.equal(RESULT_ROWS.find((r) => r.key === "cushion").name, "Emergency fund");
  assert.equal(step.name, "Emergency fund");
  assert.equal(step.title, "See your emergency fund");
  assert.equal(step.short, "See emergency fund");
  assert.doesNotMatch(JSON.stringify(step), /cash cushion|Your cushion/i);
  const v = read("modules/overview/setup/view.js");
  assert.doesNotMatch(v, /"Safety cushion"/, "the reveal's tile");
  assert.doesNotMatch(read("modules/overview/plan/view.js"), /A cash cushion of/);
});

test("B8: a retired person's question 4 asks 'Where is it held?' with no pay words and the Roth question folded", () => {
  const r = S.retireKindsFor(ruth(), "setup-self");
  assert.equal(r.label, "Where is it held?");
  assert.deepEqual(r.kinds.map((k) => k.label), ["In a company plan", "In my own IRA", "Not sure"]);
  assert.equal(r.putIn, false, "no 'put in a month: from pay' and no employer match");
  assert.equal(r.iraFold, true);
  assert.doesNotMatch(JSON.stringify(r), /pay/);
  const w = S.retireKindsFor(jordan(), "setup-self");
  assert.equal(w.label, "Where");
  assert.deepEqual(w.kinds.map((k) => k.label), ["Through work", "On my own", "Not sure"]);
  assert.equal(w.putIn, true); assert.equal(w.iraFold, false);
});
