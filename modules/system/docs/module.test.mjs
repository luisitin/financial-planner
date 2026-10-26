import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, markdownToHtml, DOCS } from "./compute.js";
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
