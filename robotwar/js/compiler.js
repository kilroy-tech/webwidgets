export const REGISTER_NAMES = [
  ..."ABCDEFGHIJKLMNOPQRSTUVW",
  "X", "Y", "Z", "AIM", "SHOT", "RADAR", "DAMAGE",
  "SPEEDX", "SPEEDY", "RANDOM", "INDEX",
];

const REGISTER_SET = new Set([...REGISTER_NAMES, "DATA"]);
const RESERVED = new Set([
  ...REGISTER_SET,
  "TO", "IF", "GOTO", "GOSUB", "ENDSUB",
]);
const COMPARISONS = new Set(["=", ">", "<", "#"]);
const ARITHMETIC = new Map([
  ["+", "ADD"], ["-", "SUB"], ["*", "MUL"], ["/", "DIV"],
]);
const SEGMENT_WORDS = [...RESERVED].sort((a, b) => b.length - a.length);
const COMPOUND_MARKERS = SEGMENT_WORDS.filter((word) => word.length > 1);

export class CompileError extends Error {
  constructor(code, message, line, column = 1) {
    super(message);
    this.name = "CompileError";
    this.code = code;
    this.line = line;
    this.column = column;
  }
}

function segmentKnownWord(word) {
  const memo = new Map();
  function visit(offset) {
    if (offset === word.length) return [];
    if (memo.has(offset)) return memo.get(offset);
    for (const candidate of SEGMENT_WORDS) {
      if (!word.startsWith(candidate, offset)) continue;
      const remainder = visit(offset + candidate.length);
      if (remainder) {
        const result = [candidate, ...remainder];
        memo.set(offset, result);
        return result;
      }
    }
    memo.set(offset, null);
    return null;
  }
  return visit(0);
}

function sourceCodeFromLine(sourceLine) {
  const commentIndex = sourceLine.indexOf(";");
  return (commentIndex >= 0 ? sourceLine.slice(0, commentIndex) : sourceLine)
    .replace(/^\s*]\s?/, "")
    .trim();
}

function tokenize(sourceLine, lineNumber, labels = new Map()) {
  const line = sourceCodeFromLine(sourceLine);
  const tokens = [];
  let offset = 0;

  while (offset < line.length) {
    const character = line[offset];
    if (/\s/.test(character)) {
      offset += 1;
      continue;
    }
    if ("+-*/=><#".includes(character)) {
      tokens.push({ value: character, column: offset + 1 });
      offset += 1;
      continue;
    }
    const number = line.slice(offset).match(/^\d+(?:\.\d+)?/);
    if (number) {
      tokens.push({ value: number[0], column: offset + 1 });
      offset += number[0].length;
      continue;
    }
    const word = line.slice(offset).match(/^[A-Za-z][A-Za-z0-9!]*/);
    if (word) {
      const value = word[0].toUpperCase();
      const mayBeCompactSource = COMPOUND_MARKERS.some((marker) => value.includes(marker));
      const segmented = labels.has(value)
        ? [value]
        : RESERVED.has(value)
        ? [value]
        : mayBeCompactSource
          ? segmentKnownWord(value)
          : null;
      if (segmented) {
        let column = offset + 1;
        for (const part of segmented) {
          tokens.push({ value: part, column });
          column += part.length;
        }
      } else {
        tokens.push({ value, column: offset + 1 });
      }
      offset += word[0].length;
      continue;
    }
    throw new CompileError("FATAL JUNK", `Unexpected character '${character}'`, lineNumber, offset + 1);
  }
  return tokens;
}

function diagnostic(error, sourceLine) {
  return {
    code: error.code || "FATAL JUNK",
    message: error.message,
    line: error.line || 1,
    column: error.column || 1,
    source: sourceLine || "",
  };
}

function operandFrom(token, labels, lineNumber) {
  if (!token) throw new CompileError("NO DATA FIELD", "Expected a number, register, or label", lineNumber);
  if (/^\d/.test(token.value)) {
    if (token.value.includes(".")) {
      throw new CompileError("FATAL JUNK", "Only integer numbers are allowed", lineNumber, token.column);
    }
    const value = Number(token.value);
    if (Math.abs(value) > 1024) {
      throw new CompileError("LARGE NUMBER", "Numbers must be between -1024 and 1024", lineNumber, token.column);
    }
    return { kind: "number", value };
  }
  if (REGISTER_SET.has(token.value)) return { kind: "register", name: token.value };
  if (labels.has(token.value)) return { kind: "address", value: labels.get(token.value), label: token.value };
  if (/^[A-Z][A-Z0-9!]*$/.test(token.value)) return { kind: "label", label: token.value };
  throw new CompileError("UNKNOWN ITEM", `Unknown item '${token.value}'`, lineNumber, token.column);
}

function readOperand(tokens, cursor, labels, lineNumber) {
  let sign = 1;
  if (tokens[cursor.index]?.value === "-") {
    sign = -1;
    cursor.index += 1;
  }
  const token = tokens[cursor.index++];
  const operand = operandFrom(token, labels, lineNumber);
  if (sign < 0) {
    if (operand.kind !== "number") {
      throw new CompileError("FATAL JUNK", "Only numeric literals may use unary minus", lineNumber, token?.column);
    }
    operand.value *= -1;
  }
  return operand;
}

function instruction(opcode, operand, line, column) {
  return { opcode, ...(operand ? { operand } : {}), source: { line, column } };
}

function parseTransfer(tokens, cursor, labels, lineNumber, opcode = "LOAD") {
  const start = tokens[cursor.index];
  const output = [instruction(opcode, readOperand(tokens, cursor, labels, lineNumber), lineNumber, start?.column || 1)];
  while (ARITHMETIC.has(tokens[cursor.index]?.value)) {
    const operator = tokens[cursor.index++];
    output.push(instruction(
      ARITHMETIC.get(operator.value),
      readOperand(tokens, cursor, labels, lineNumber),
      lineNumber,
      operator.column,
    ));
  }
  if (tokens[cursor.index]?.value !== "TO") {
    throw new CompileError("FATAL JUNK", "Expected TO", lineNumber, tokens[cursor.index]?.column || start?.column);
  }
  while (tokens[cursor.index]?.value === "TO") {
    cursor.index += 1;
    const target = tokens[cursor.index++];
    if (!target) throw new CompileError("NO DATA FIELD", "TO requires a destination register", lineNumber);
    if (/^\d/.test(target.value)) {
      throw new CompileError("STORE IN NUMBER", "Cannot store a value in a number", lineNumber, target.column);
    }
    if (!REGISTER_SET.has(target.value)) {
      throw new CompileError("UNKNOWN ITEM", `Unknown register '${target.value}'`, lineNumber, target.column);
    }
    output.push(instruction("STORE", { kind: "register", name: target.value }, lineNumber, target.column));
  }
  return output;
}

function parseCommand(tokens, cursor, labels, lineNumber) {
  const token = tokens[cursor.index];
  if (!token) throw new CompileError("NO DATA FIELD", "IF requires a command", lineNumber);
  if (token.value === "GOTO" || token.value === "GOSUB") {
    cursor.index += 1;
    return [instruction(token.value, readOperand(tokens, cursor, labels, lineNumber), lineNumber, token.column)];
  }
  if (token.value === "ENDSUB") {
    cursor.index += 1;
    return [instruction("ENDSUB", null, lineNumber, token.column)];
  }
  return parseTransfer(tokens, cursor, labels, lineNumber);
}

function parseLine(tokens, labels, lineNumber) {
  const cursor = { index: 0 };
  if (tokens[0]?.value === "IF") {
    cursor.index += 1;
    const start = tokens[cursor.index];
    const output = [instruction("IF_LOAD", readOperand(tokens, cursor, labels, lineNumber), lineNumber, start?.column || 1)];
    while (ARITHMETIC.has(tokens[cursor.index]?.value)) {
      const operator = tokens[cursor.index++];
      output.push(instruction(ARITHMETIC.get(operator.value), readOperand(tokens, cursor, labels, lineNumber), lineNumber, operator.column));
    }
    const comparison = tokens[cursor.index++];
    if (!comparison || !COMPARISONS.has(comparison.value)) {
      throw new CompileError("FATAL JUNK", "IF requires =, >, <, or #", lineNumber, comparison?.column || start?.column);
    }
    const right = readOperand(tokens, cursor, labels, lineNumber);
    const compareInstruction = instruction(
      { "=": "EQ", ">": "GT", "<": "LT", "#": "NE" }[comparison.value],
      right,
      lineNumber,
      comparison.column,
    );
    output.push(compareInstruction);
    const controlled = parseCommand(tokens, cursor, labels, lineNumber);
    compareInstruction.skip = controlled.length;
    output.push(...controlled);
    if (cursor.index !== tokens.length) {
      throw new CompileError("FATAL JUNK", `Unexpected item '${tokens[cursor.index].value}'`, lineNumber, tokens[cursor.index].column);
    }
    return output;
  }
  const output = parseCommand(tokens, cursor, labels, lineNumber);
  if (cursor.index !== tokens.length) {
    throw new CompileError("FATAL JUNK", `Unexpected item '${tokens[cursor.index].value}'`, lineNumber, tokens[cursor.index].column);
  }
  return output;
}

function collectLabels(lines) {
  const labels = new Map();
  const entries = [];
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const sourceCode = sourceCodeFromLine(lines[index]);
    const bareIdentifier = sourceCode.match(/^[A-Za-z][A-Za-z0-9!]*$/)?.[0]?.toUpperCase();
    if (bareIdentifier && bareIdentifier !== "ENDSUB") {
      if (RESERVED.has(bareIdentifier)) {
        throw new CompileError("RESERVED LABEL", `Label '${bareIdentifier}' is reserved`, lineNumber, 1);
      }
      if (bareIdentifier.length < 2 || bareIdentifier.length >= 32) {
        throw new CompileError("FATAL JUNK", `Illegal label '${bareIdentifier}'`, lineNumber, 1);
      }
      if (labels.has(bareIdentifier)) {
        throw new CompileError("FATAL JUNK", `Duplicate label '${bareIdentifier}'`, lineNumber, 1);
      }
      labels.set(bareIdentifier, null);
    }
  }

  let address = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const sourceCode = sourceCodeFromLine(lines[index]);
    const bareIdentifier = sourceCode.match(/^[A-Za-z][A-Za-z0-9!]*$/)?.[0]?.toUpperCase();
    if (bareIdentifier && labels.has(bareIdentifier)) {
      labels.set(bareIdentifier, address);
      entries.push({ lineNumber, tokens: [], label: bareIdentifier });
      continue;
    }
    const tokens = tokenize(lines[index], lineNumber, labels);
    if (!tokens.length) continue;
    const placeholders = parseLine(tokens, labels, lineNumber);
    address += placeholders.length;
    entries.push({ lineNumber, tokens });
  }
  return { labels, entries };
}

export function compile(source) {
  const lines = String(source).replace(/\r/g, "").split("\n");
  try {
    const { labels, entries } = collectLabels(lines);
    const instructions = [];
    for (const entry of entries) {
      if (!entry.tokens.length) continue;
      instructions.push(...parseLine(entry.tokens, labels, entry.lineNumber));
    }
    for (const item of instructions) {
      if (item.operand?.kind === "label") {
        if (!labels.has(item.operand.label)) {
          throw new CompileError("UNKNOWN ITEM", `Unknown label '${item.operand.label}'`, item.source.line, item.source.column);
        }
        item.operand = { kind: "address", value: labels.get(item.operand.label), label: item.operand.label };
      }
    }
    if (!instructions.length) throw new CompileError("NO PROGRAM CODE", "The program contains no instructions", 1);
    if (instructions.length > 256) throw new CompileError("PROGRAM TOO LONG", "Programs may contain at most 256 object instructions", 1);
    return { instructions, labels: Object.fromEntries(labels), diagnostics: [] };
  } catch (error) {
    if (!(error instanceof CompileError)) throw error;
    return { instructions: [], labels: {}, diagnostics: [diagnostic(error, lines[(error.line || 1) - 1])] };
  }
}

export function formatInstruction(item, index) {
  const operand = item.operand
    ? item.operand.kind === "register" ? item.operand.name
      : item.operand.label || String(item.operand.value)
    : "";
  return `${String(index).padStart(3, "0")}  ${item.opcode.padEnd(8)} ${operand}`.trimEnd();
}