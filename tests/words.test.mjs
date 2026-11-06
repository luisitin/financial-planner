import { test } from "node:test";
import assert from "node:assert/strict";
import { isYou, nameIn, NameIn, nameOf, NameOf, verbFor, selfOf, namesIn, NamesIn } from "../core/words.js";

test("core/words: the unnamed first adult is 'you', the unnamed partner 'your spouse', any other name as typed", () => {
  assert.equal(isYou("Me"), true); assert.equal(isYou(""), true); assert.equal(isYou(null), true); assert.equal(isYou("Ana"), false); assert.equal(isYou("Mei"), false); assert.equal(isYou("You"), true); assert.equal(NameOf("You"), "Your"); assert.equal(isYou("Meg"), false);
  assert.equal(nameIn("Me"), "you"); assert.equal(NameIn("Me"), "You"); assert.equal(nameIn("My spouse"), "your spouse"); assert.equal(NameIn("My partner"), "Your partner");
  assert.equal(nameIn("Ana"), "Ana"); assert.equal(NameIn("ana"), "Ana");
  assert.equal(nameOf("Me"), "your"); assert.equal(NameOf("Me"), "Your"); assert.equal(nameOf("My spouse"), "your spouse's"); assert.equal(nameOf("Ana"), "Ana's"); assert.equal(nameOf("Chris"), "Chris's");
  assert.equal(verbFor("Me", "joins", "join"), "join"); assert.equal(verbFor("Ana", "joins", "join"), "joins"); assert.equal(verbFor("Me", "is", "are"), "are");
  assert.equal(selfOf("Me"), "yourself"); assert.equal(selfOf("Ana"), "themself"); assert.equal(selfOf("Ana", "herself"), "herself");
  assert.equal(namesIn(["Bo", "Me"]), "you and Bo"); assert.equal(namesIn(["Me", "My spouse", "Cy"]), "you, your spouse and Cy"); assert.equal(namesIn(["Ana", "Bo"]), "Ana and Bo"); assert.equal(namesIn(["Ana"]), "Ana"); assert.equal(namesIn([]), "");
  assert.equal(NamesIn(["My spouse", "Me"]), "You and your spouse");
});
