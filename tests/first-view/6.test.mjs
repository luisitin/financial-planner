// tests/first-view/6.test.mjs -- shard 6 of the first-view check (docs/OPTIONAL.md, check N; qa/first-view-lib.mjs):
// the pages tests/first-view.kinds.mjs gives shard 6, each drawn for four invented households and held to its kind's
// budget or its entry in tests/first-view.known.json. The whole picture: node qa/first-view-node.mjs.
import { test } from "node:test";
import * as K from "../first-view.kinds.mjs";
import { defineShard } from "../../qa/first-view-lib.mjs";

await defineShard(test, 6, K);
