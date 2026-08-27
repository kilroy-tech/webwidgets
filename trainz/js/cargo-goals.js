export const ITEM_TYPES = ["COAL", "FRUIT", "WINE", "FOOD", "BOTTLES"];
export const GOAL_OPCODES = ["DRIVE", "VISIT", "BUY", "SELL", "STEP"];

export function emptyInventory() {
  return Object.fromEntries(ITEM_TYPES.map((item) => [item, 0]));
}

export function randomInventory() {
  return Object.fromEntries(
    ITEM_TYPES.map((item) => [item, Math.floor(Math.random() * 6)]),
  );
}

export function emptyCargo() {
  return { item: null, quantity: 0 };
}

export function normalizeCargo(cargo) {
  if (
    !cargo ||
    !ITEM_TYPES.includes(cargo.item) ||
    !Number.isInteger(cargo.quantity) ||
    cargo.quantity < 1 ||
    cargo.quantity > 3
  )
    return emptyCargo();
  return { item: cargo.item, quantity: cargo.quantity };
}

export function normalizeGoal(goal) {
  if (!goal || !GOAL_OPCODES.includes(goal.opcode)) return null;
  if (goal.opcode === "DRIVE")
    return {
      opcode: "DRIVE",
      direction: goal.direction === "REVERSE" ? "REVERSE" : "FORWARD",
      speed: Math.max(0, Math.min(100, Number(goal.speed) || 0)),
    };
  if (goal.opcode === "VISIT")
    return { opcode: "VISIT", stationId: String(goal.stationId || "") };
  if (goal.opcode === "BUY" || goal.opcode === "SELL")
    return {
      opcode: goal.opcode,
      item: ITEM_TYPES.includes(goal.item) ? goal.item : null,
    };
  return {
    opcode: "STEP",
    step: Math.max(0, Math.floor(Number(goal.step) || 0)),
  };
}

export function goalText(goal, stations = []) {
  if (!goal) return "NONE";
  if (goal.opcode === "DRIVE") return `DRIVE ${goal.direction} ${goal.speed}%`;
  if (goal.opcode === "VISIT")
    return `VISIT ${stations.find((station) => station.id === goal.stationId)?.name || goal.stationId}`;
  if (goal.opcode === "STEP") return `STEP ${goal.step}`;
  return `${goal.opcode} ${goal.item || "?"}`;
}
