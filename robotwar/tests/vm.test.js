import test from "node:test";
import assert from "node:assert/strict";
import { compile } from "../js/compiler.js";
import { RobotVM } from "../js/vm.js";

function run(source, options = {}, limit = 100) {
  const result = compile(source);
  assert.deepEqual(result.diagnostics, []);
  const vm = new RobotVM(result.instructions, options);
  for (let count = 0; count < limit && !vm.halted; count += 1) vm.step();
  return vm;
}

test("executes arithmetic from left to right and truncates division", () => {
  const vm = run("100 + 20 * 3 / 7 TO A");
  assert.equal(vm.registers.A, 51);
});

test("conditional assignment skips the entire controlled expression", () => {
  const vm = run("1 TO A\nIF A=2 9*9 TO B\nIF A=1 3*4 TO C");
  assert.equal(vm.registers.B, 0);
  assert.equal(vm.registers.C, 12);
});

test("GOSUB returns and INDEX/DATA accesses a numbered register", () => {
  const vm = run("27 TO INDEX\n90 TO DATA\nGOSUB WORK\nGOTO DONE\nWORK\n5 TO A\nENDSUB\nDONE\n1 TO B", {
    hardware: {
      read: (name) => name === "AIM" ? 90 : 0,
      write: () => {},
    },
  });
  assert.equal(vm.registers.A, 5);
  assert.equal(vm.registers.B, 1);
});

test("seeded RANDOM is reproducible and upper-bound exclusive", () => {
  const source = "100 TO RANDOM\nRANDOM TO A\nRANDOM TO B";
  const first = run(source, { seed: 42 });
  const second = run(source, { seed: 42 });
  assert.equal(first.registers.A, second.registers.A);
  assert.equal(first.registers.B, second.registers.B);
  assert.ok(first.registers.A >= 0 && first.registers.A < 100);
});