import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, markdownToHtml, DOCS, docAddress, docTrouble } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("docs list and selection", () => {
  const d = compute(emptyPlan(), { doc: "plan" });
  assert.equal(d.current.id, "plan");
  assert.equal(compute(emptyPlan(), { doc: "nope" }).current.id, DOCS[0].id);
});
test("markdown converter", () => {
  const html = markdownToHtml("# Title\n\nSome **bold** and `code` and [a link](https://x.y).\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\nraw <tag>\n```\n");
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<a href="https:\/\/x.y" target="_blank" rel="noopener">a link<\/a>/);
  assert.match(html, /<ul>\n<li>one<\/li>\n<li>two<\/li>\n<\/ul>/);
  assert.match(html, /<table><thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/);
  assert.match(html, /<pre><code>raw &lt;tag&gt;<\/code><\/pre>/);
});
test("docs are read next to the app's page, so they work under GitHub Pages' /financial-planner/ subpath", () => {
  // GitHub Pages: the site lives under the subpath; the domain root is someone else's (it answered 404)
  assert.equal(docAddress("README.md", { page: "https://someone.github.io/financial-planner/#/system/docs/readme" }), "https://someone.github.io/financial-planner/README.md");
  assert.equal(docAddress("docs/PLAN.md", { page: "https://someone.github.io/financial-planner/?sandbox=1#/system/docs/plan" }), "https://someone.github.io/financial-planner/docs/PLAN.md");
  assert.equal(docAddress("docs/PLAN.md", { page: "https://someone.github.io/financial-planner/index.html" }), "https://someone.github.io/financial-planner/docs/PLAN.md");
  // the PC's server: the app is at the root, as before
  assert.equal(docAddress("docs/PLAN.md", { page: "http://127.0.0.1:8787/#/system/docs/plan" }), "http://127.0.0.1:8787/docs/PLAN.md");
  // a PC address set on this device (a copy of the app opened elsewhere) still wins
  assert.equal(docAddress("README.md", { serverUrl: "http://pc.local:8787/", page: "https://someone.github.io/financial-planner/" }), "http://pc.local:8787/README.md");
  // a file opened from the phone's files with no PC address: nowhere to read from
  assert.equal(docAddress("README.md", { page: "file:///phone-files/planner.html" }), null);
  assert.equal(docAddress("README.md", {}), null);
});
test("a doc that cannot be read: the PC is mentioned only when the app talks to one", () => {
  assert.equal(docTrouble(503, { pc: true }), "pc");
  assert.equal(docTrouble(0, { pc: true }), "pc");
  assert.equal(docTrouble(404, { pc: false }), "missing", "not in this copy (vendor/ is never on GitHub Pages)");
  assert.equal(docTrouble(0, { pc: false }), "offline");
  assert.equal(docTrouble(500), "offline");
});
