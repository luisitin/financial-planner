// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("performance: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// ---- simple first (docs/OPTIONAL.md): "How this is worked out" is a part drawn by core/ui/more.js, title unchanged --------------
test("S11: the page saves nothing, so no part can move after a save; How this is worked out is the helper's part, shut, and no fold is by hand", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(!/\bstore\b|\.update\(/.test(src), "the view never writes the plan");
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const p = migrate(investmentsPlan());
  const was = JSON.stringify(p);
  const draw = () => { const root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => "2026-09-16" }, plan: p, route: { group: "investments", id: "performance", rest: [], query: {} }, module: { group: "investments", id: "performance" } }); return root; };
  const states = (root) => root.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, e.dataset.kind, e.hasAttribute("open")]);
  const a = draw(), b = draw();
  assert.deepEqual(states(a), [["how", "how", false]], "one part, of kind how (Settings' switch opens it), shut on the first view");
  assert.deepEqual(states(b), states(a), "drawn again, nothing opens or shuts");
  const how = a.all().find((e) => e.dataset.part === "how");
  assert.equal(how.querySelector(".fold-title").textContent, "How this is worked out", "the title is unchanged");
  assert.match(textOf(how), /time-weighted return/);
  assert.equal(JSON.stringify(p), was, "drawing changed nothing in the plan");
});
