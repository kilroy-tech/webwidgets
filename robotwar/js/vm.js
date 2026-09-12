import { REGISTER_NAMES } from "./compiler.js";

const GENERAL_REGISTERS = [..."ABCDEFGHIJKLMNOPQRSTUVW", "Z"];
const WRITABLE_HARDWARE = new Set(["AIM", "SHOT", "RADAR", "SPEEDX", "SPEEDY"]);

export function createRandom(seed = 1) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export class RobotVM {
  constructor(program, options = {}) {
    this.program = program || [];
    this.hardware = options.hardware || {};
    this.random = options.random || createRandom(options.seed);
    this.registers = Object.fromEntries(GENERAL_REGISTERS.map((name) => [name, 0]));
    this.registers.INDEX = 0;
    this.randomLimit = 1;
    this.randomValue = 0;
    this.reset();
  }

  reset() {
    this.pc = 0;
    this.accumulator = 0;
    this.stack = [];
    this.halted = false;
    this.error = null;
    this.steps = 0;
  }

  resolveRegister(name) {
    if (name !== "DATA") return name;
    const index = Math.trunc(this.registers.INDEX || 0);
    return REGISTER_NAMES[index - 1] || null;
  }

  readRegister(name) {
    const resolved = this.resolveRegister(name);
    if (!resolved) return 0;
    if (resolved === "RANDOM") {
      this.randomValue = Math.floor(this.random() * Math.max(1, this.randomLimit));
      return this.randomValue;
    }
    if (resolved in this.registers) return this.registers[resolved];
    return Math.trunc(this.hardware.read?.(resolved) ?? 0);
  }

  writeRegister(name, value) {
    const resolved = this.resolveRegister(name);
    if (!resolved) return;
    const integer = Math.trunc(Number.isFinite(value) ? value : 0);
    if (resolved === "RANDOM") {
      this.randomLimit = Math.max(1, Math.abs(integer));
      return;
    }
    if (resolved === "INDEX") {
      this.registers.INDEX = Math.max(0, Math.min(34, integer));
      return;
    }
    if (GENERAL_REGISTERS.includes(resolved)) {
      this.registers[resolved] = integer;
      return;
    }
    if (WRITABLE_HARDWARE.has(resolved)) this.hardware.write?.(resolved, integer);
  }

  peekRegister(name) {
    const resolved = this.resolveRegister(name);
    if (!resolved) return 0;
    if (resolved === "RANDOM") return this.randomValue;
    if (resolved in this.registers) return this.registers[resolved];
    return Math.trunc(this.hardware.read?.(resolved) ?? 0);
  }

  valueOf(operand) {
    if (!operand) return 0;
    if (operand.kind === "register") return this.readRegister(operand.name);
    return Math.trunc(operand.value || 0);
  }

  fail(message) {
    this.error = message;
    this.halted = true;
  }

  step() {
    if (this.halted) return null;
    const currentPc = this.pc;
    const item = this.program[currentPc];
    if (!item) {
      this.halted = true;
      return null;
    }
    this.pc += 1;
    const value = () => this.valueOf(item.operand);

    switch (item.opcode) {
      case "LOAD":
      case "IF_LOAD": this.accumulator = value(); break;
      case "ADD": this.accumulator += value(); break;
      case "SUB": this.accumulator -= value(); break;
      case "MUL": this.accumulator *= value(); break;
      case "DIV": {
        const divisor = value();
        if (divisor === 0) this.fail("Division by zero");
        else this.accumulator = Math.trunc(this.accumulator / divisor);
        break;
      }
      case "STORE": this.writeRegister(item.operand.name, this.accumulator); break;
      case "EQ": if (this.accumulator !== value()) this.pc += item.skip || 1; break;
      case "NE": if (this.accumulator === value()) this.pc += item.skip || 1; break;
      case "GT": if (this.accumulator <= value()) this.pc += item.skip || 1; break;
      case "LT": if (this.accumulator >= value()) this.pc += item.skip || 1; break;
      case "GOTO": this.pc = value(); break;
      case "GOSUB":
        if (this.stack.length >= 64) this.fail("Subroutine stack overflow");
        else {
          this.stack.push(this.pc);
          this.pc = value();
        }
        break;
      case "ENDSUB":
        if (!this.stack.length) this.fail("ENDSUB without GOSUB");
        else this.pc = this.stack.pop();
        break;
      default: this.fail(`Unknown opcode ${item.opcode}`);
    }
    this.accumulator = Math.trunc(this.accumulator);
    this.steps += 1;
    return { pc: currentPc, instruction: item };
  }
}