import test from "node:test";
import assert from "node:assert/strict";
import { playerAcceptsTarget } from "../command-routing.js";

test("unset and wildcard players accept every target", () => {
  for (const playerId of ["", "   ", "*"]) {
    assert.equal(playerAcceptsTarget(playerId, "kitchen"), true);
    assert.equal(playerAcceptsTarget(playerId, "bedroom"), true);
  }
});

test("configured players accept only their ID without case sensitivity", () => {
  assert.equal(playerAcceptsTarget("Kitchen", "kitchen"), true);
  assert.equal(playerAcceptsTarget("Kitchen", "KITCHEN"), true);
  assert.equal(playerAcceptsTarget("Kitchen", "bedroom"), false);
  assert.equal(playerAcceptsTarget("Kitchen", ""), false);
});