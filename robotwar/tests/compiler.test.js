import test from "node:test";
import assert from "node:assert/strict";
import { compile } from "../js/compiler.js";

test("assembles the manual's 13-instruction example", () => {
  const result = compile(`
SCAN
AIM + 5 TO AIM
AIM TO RADAR
LOOP
IF RADAR < 0 GOSUB FIRE
GOTO SCAN
FIRE
0 - RADAR TO SHOT
ENDSUB
`);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.instructions.length, 13);
  assert.deepEqual(result.labels, { SCAN: 0, LOOP: 5, FIRE: 9 });
  assert.deepEqual(
    result.instructions.map(({ opcode, operand }) => [opcode, operand?.name ?? operand?.value]),
    [
      ["LOAD", "AIM"], ["ADD", 5], ["STORE", "AIM"],
      ["LOAD", "AIM"], ["STORE", "RADAR"],
      ["IF_LOAD", "RADAR"], ["LT", 0], ["GOSUB", 9],
      ["GOTO", 0], ["LOAD", 0], ["SUB", "RADAR"],
      ["STORE", "SHOT"], ["ENDSUB", undefined],
    ],
  );
});

test("supports compact source, chained stores, and conditional assignments", () => {
  const result = compile("0-BTOA\n0 TO SPEEDX TO SPEEDY\nIF A=B C*4 TO C");
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.instructions.map((item) => item.opcode), [
    "LOAD", "SUB", "STORE", "LOAD", "STORE", "STORE",
    "IF_LOAD", "EQ", "LOAD", "MUL", "STORE",
  ]);
  assert.equal(result.instructions[7].skip, 3);
});

test("supports the manual's chained TO command", () => {
  const result = compile("0 TO SPEEDX TO SPEEDY");
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.instructions.map(({ opcode, operand }) => [opcode, operand?.name ?? operand?.value]),
    [["LOAD", 0], ["STORE", "SPEEDX"], ["STORE", "SPEEDY"]],
  );
});

test("labels take precedence over compact register tokenization", () => {
  const result = compile(`
MOVE
IF D > 0 GOTO AIMRIGHT
270 TO AIM TO RADAR
GOTO WALLCHECK
AIMRIGHT
90 TO AIM TO RADAR
WALLCHECK
GOTO MOVE
`);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.labels.AIMRIGHT, 7);
  assert.equal(result.instructions[2].opcode, "GOTO");
  assert.equal(result.instructions[2].operand.label, "AIMRIGHT");
  assert.deepEqual(
    result.instructions.slice(3, 6).map((item) => item.opcode),
    ["LOAD", "STORE", "STORE"],
  );
});

test("reports representative manual diagnostics", () => {
  const cases = [
    ["10 +", "NO DATA FIELD"],
    ["MISSING TO A", "UNKNOWN ITEM"],
    ["1025 TO A", "LARGE NUMBER"],
    ["10 TO 3", "STORE IN NUMBER"],
    ["20.35 TO E", "FATAL JUNK"],
    ["; comment only", "NO PROGRAM CODE"],
  ];
  for (const [source, code] of cases) {
    assert.equal(compile(source).diagnostics[0]?.code, code, source);
  }
});

test("enforces the object instruction limit", () => {
  const result = compile(Array.from({ length: 129 }, () => "1 TO A").join("\n"));
  assert.equal(result.diagnostics[0]?.code, "PROGRAM TOO LONG");
});