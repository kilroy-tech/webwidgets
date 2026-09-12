import test from "node:test";
import assert from "node:assert/strict";
import { createBattleSeed, parseSeed } from "../js/seeds.js";

test("blank seed selects random battle seeding", () => {
  assert.equal(parseSeed(""), null);
  assert.equal(parseSeed("   "), null);
});

test("explicit seeds normalize to nonzero unsigned integers", () => {
  assert.equal(parseSeed("2002"), 2002);
  assert.equal(parseSeed("-1"), 0xffffffff);
  assert.equal(parseSeed("0"), 1);
});

test("fresh battle seeds vary with random input and remain reproducible", () => {
  assert.equal(createBattleSeed(0.25, 1000), createBattleSeed(0.25, 1000));
  assert.notEqual(createBattleSeed(0.25, 1000), createBattleSeed(0.75, 1000));
});