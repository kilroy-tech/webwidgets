import { sdk, bindSdkStatus, bindSwarmCommands } from "./sdk.js";
import { state, TRACK_TYPES } from "./state.js";
import { GOAL_OPCODES, ITEM_TYPES, goalText } from "./cargo-goals.js";
import {
  assignStationEconomy,
  randomPrimaryInventory,
  resetEconomyClock,
  updateStationEconomy,
} from "./resources.js";
import { Renderer } from "./renderer.js";
import { bindInput } from "./input.js";
import { handleTrainCommand } from "./swarm-commands.js";
import {
  addTrain,
  appendGoal,
  beginGoalPlan,
  clearGoals,
  setTrainThrottle,
  startGoalPlan,
  updateTrains,
} from "./train-controller.js";
import { exportLayout, importLayout } from "./layout-io.js";

const renderer = new Renderer(document.getElementById("board"), state);
const palette = document.getElementById("palette");
const toast = document.getElementById("toast");
const modeToggle = document.getElementById("modeToggle");
const layoutMenuToggle = document.getElementById("layoutMenuToggle");
const layoutMenu = document.getElementById("layoutMenu");
const layoutFileInput = document.getElementById("layoutFileInput");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(
    () => toast.classList.remove("show"),
    1800,
  );
}
function renderPalette() {
  palette.innerHTML = "";
  palette.classList.toggle("is-disabled", state.mode === "run");
  Object.entries(TRACK_TYPES).forEach(([type, definition]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = type === state.selectedType ? "active" : "";
    const preview = document.createElement("canvas");
    preview.className = "piece-icon";
    preview.width = 58;
    preview.height = 58;
    renderer.drawPreview(preview, type, state.selectedRotation);
    const label = document.createElement("span");
    label.textContent = definition.label;
    button.append(preview, label);
    button.addEventListener("click", () => {
      state.selectedType = type;
      renderPalette();
    });
    palette.appendChild(button);
  });
}
function setLayoutMenuOpen(open) {
  layoutMenu.hidden = !open;
  layoutMenuToggle.setAttribute("aria-expanded", String(open));
}
const trainCardRefs = new Map();
function throttleText(value) {
  if (Math.abs(value) < 0.03) return "NEUTRAL";
  return value > 0
    ? "FWD " + Math.round(value * 100) + "%"
    : "REV " + Math.round(Math.abs(value) * 100) + "%";
}
function renderTrains() {
  const list = document.getElementById("trainList");
  trainCardRefs.clear();
  list.innerHTML = state.trains.length
    ? ""
    : '<div class="empty-state">No trains placed</div>';
  state.trains.forEach((train) => {
    const card = document.createElement("div");
    card.className = "train-card";
    const head = document.createElement("div");
    head.className = "train-card-head";
    const preview = document.createElement("span");
    preview.className = "engine-preview";
    preview.style.setProperty("--train-color", train.color || "#2878c8");
    const label = document.createElement("label");
    label.textContent = "Train " + train.id.split("-")[1] + " throttle ";
    const throttleStatus = document.createElement("span");
    throttleStatus.textContent = throttleText(train.targetThrottle);
    label.appendChild(throttleStatus);
    head.append(preview, label);
    const throttleWrap = document.createElement("div");
    throttleWrap.className = "throttle-wrap";
    const input = document.createElement("input");
    input.type = "range";
    input.min = "-1";
    input.max = "1";
    input.step = ".05";
    input.value = String(train.targetThrottle);
    const neutralTick = document.createElement("span");
    neutralTick.className = "neutral-tick";
    neutralTick.setAttribute("aria-hidden", "true");
    throttleWrap.append(input, neutralTick);
    const status = document.createElement("small");
    const details = document.createElement("small");
    function updateCardStatus() {
      status.textContent = train.blocked || train.planStatus || "Ready";
      details.textContent =
        "Carrying " +
        (train.cargo?.item
          ? train.cargo.item + " x" + train.cargo.quantity
          : "EMPTY") +
        " | Goal: " +
        (train.goals?.[train.goalIndex]
          ? goalText(train.goals[train.goalIndex], stationRecords())
          : train.planStatus === "complete"
            ? "GOALS COMPLETE"
            : "NONE");
    }
    input.addEventListener("input", (event) => {
      const value = Number(event.target.value);
      const snappedValue = Math.abs(value) < 0.12 ? 0 : value;
      input.value = String(snappedValue);
      setTrainThrottle(train, snappedValue);
      throttleStatus.textContent = throttleText(train.targetThrottle);
      updateCardStatus();
    });
    const planToggle = document.createElement("button");
    planToggle.className = "plan-toggle";
    planToggle.type = "button";
    planToggle.setAttribute("aria-label", "Start goal plan");
    planToggle.textContent = "▶";
    planToggle.hidden = state.mode !== "run" || !train.goals.length;
    planToggle.addEventListener("click", () => {
      if (train.controlMode === "plan") {
        train.controlMode = "manual";
        train.planStatus = "stopped";
        train.targetThrottle = 0;
        planToggle.textContent = "▶";
        planToggle.setAttribute("aria-label", "Start goal plan");
      } else {
        startGoalPlan(train);
        planToggle.textContent = "■";
        planToggle.setAttribute("aria-label", "Stop goal plan");
      }
      updateCardStatus();
    });
    const goalToggle = document.createElement("button");
    goalToggle.className = "goal-toggle";
    goalToggle.type = "button";
    goalToggle.textContent = train.goalsOpen ? "Hide goals" : "Edit goals";
    const editor = document.createElement("div");
    editor.className = "goal-editor";
    editor.hidden = !train.goalsOpen;
    function renderGoalEditor() {
      editor.innerHTML = "";
      const queue = document.createElement("ol");
      queue.className = "goal-queue";
      (train.goals || []).forEach((goal, index) => {
        const item = document.createElement("li");
        item.className = index === train.goalIndex ? "current" : "";
        item.textContent = index + ": " + goalText(goal, stationRecords());
        queue.appendChild(item);
      });
      editor.appendChild(queue);
      const addRow = document.createElement("div");
      addRow.className = "goal-add";
      const opcode = document.createElement("select");
      GOAL_OPCODES.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        opcode.appendChild(option);
      });
      const argument = document.createElement("select");
      const direction = document.createElement("select");
      ["FORWARD", "REVERSE"].forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        direction.appendChild(option);
      });
      const speed = document.createElement("input");
      speed.type = "number";
      speed.min = "0";
      speed.max = "100";
      speed.value = "50";
      function refreshArgument() {
        argument.innerHTML = "";
        const values =
          opcode.value === "VISIT"
            ? stationRecords().map((station) => ({
                value: station.id,
                label: station.name,
              }))
            : opcode.value === "BUY" || opcode.value === "SELL"
              ? ITEM_TYPES.map((item) => ({ value: item, label: item }))
              : opcode.value === "STEP"
                ? (train.goals || []).map((_, index) => ({
                    value: String(index),
                    label: String(index),
                  }))
                : [];
        values.forEach(({ value, label }) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          argument.appendChild(option);
        });
        argument.hidden = opcode.value === "DRIVE";
        direction.hidden = opcode.value !== "DRIVE";
        speed.hidden = opcode.value !== "DRIVE";
      }
      opcode.addEventListener("change", refreshArgument);
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.textContent = "+";
      addButton.addEventListener("click", () => {
        const goal =
          opcode.value === "DRIVE"
            ? {
                opcode: "DRIVE",
                direction: direction.value,
                speed: Number(speed.value),
              }
            : opcode.value === "VISIT"
              ? { opcode: "VISIT", stationId: argument.value }
              : opcode.value === "STEP"
                ? { opcode: "STEP", step: Number(argument.value) }
                : { opcode: opcode.value, item: argument.value };
        if (appendGoal(train, goal)) renderGoalEditor();
      });
      addRow.append(opcode, argument, addButton, direction, speed);
      editor.appendChild(addRow);
      const clearButton = document.createElement("button");
      clearButton.className = "goal-clear";
      clearButton.type = "button";
      clearButton.textContent = "Clear goals";
      clearButton.addEventListener("click", () => {
        clearGoals(train);
        renderGoalEditor();
        updateCardStatus();
      });
      editor.appendChild(clearButton);
      refreshArgument();
    }
    goalToggle.addEventListener("click", () => {
      train.goalsOpen = !train.goalsOpen;
      goalToggle.textContent = train.goalsOpen ? "Hide goals" : "Edit goals";
      editor.hidden = !train.goalsOpen;
      if (train.goalsOpen) renderGoalEditor();
      else startGoalPlan(train);
      updateCardStatus();
    });
    card.append(
      head,
      throttleWrap,
      status,
      details,
      planToggle,
      goalToggle,
      editor,
    );
    list.appendChild(card);
    updateCardStatus();
    if (train.goalsOpen) renderGoalEditor();
    trainCardRefs.set(train, {
      status,
      details,
      throttleStatus,
      input,
      planToggle,
    });
  });
}
// Updates status text/throttle/plan-toggle in place without touching the goal
// editor DOM, so periodic refreshes don't clobber in-progress edits or clicks.
function refreshTrainCards() {
  state.trains.forEach((train) => {
    const refs = trainCardRefs.get(train);
    if (!refs) return;
    refs.status.textContent = train.blocked || train.planStatus || "Ready";
    refs.details.textContent =
      "Carrying " +
      (train.cargo?.item
        ? train.cargo.item + " x" + train.cargo.quantity
        : "EMPTY") +
      " | Goal: " +
      (train.goals?.[train.goalIndex]
        ? goalText(train.goals[train.goalIndex], stationRecords())
        : train.planStatus === "complete"
          ? "GOALS COMPLETE"
          : "NONE");
    refs.throttleStatus.textContent = throttleText(train.targetThrottle);
    if (document.activeElement !== refs.input)
      refs.input.value = String(train.targetThrottle);
    refs.planToggle.hidden = state.mode !== "run" || !train.goals.length;
    const running = train.controlMode === "plan";
    refs.planToggle.textContent = running ? "■" : "▶";
    refs.planToggle.setAttribute(
      "aria-label",
      running ? "Stop goal plan" : "Start goal plan",
    );
  });
}
function stationRecords() {
  return [...state.pieces.values()]
    .filter((piece) => piece.station)
    .map((piece) => piece.station);
}
function renderStations() {
  const list = document.getElementById("stationList");
  const stations = stationRecords();
  list.innerHTML = stations.length
    ? ""
    : '<div class="empty-state">No stations placed</div>';
  stations.forEach((station) => {
    const card = document.createElement("div");
    card.className = "station-card";
    card.style.setProperty("--station-color", station.color);
    const name = document.createElement("div");
    name.className = "station-name";
    name.innerHTML =
      '<span class="station-swatch"></span>' +
      station.name +
      " (" +
      station.id +
      ")";
    const inventory = document.createElement("div");
    inventory.className = "inventory-list";
    ITEM_TYPES.forEach((item) => {
      const label = document.createElement("span");
      label.textContent = item;
      const value = document.createElement("strong");
      value.textContent = String(station.inventory?.[item] || 0);
      inventory.append(label, value);
    });
    const roles = document.createElement("small");
    const produces = (station.production || []).map(
      ({ commodity }) => commodity,
    );
    const consumes = (station.consumption || []).map(
      ({ commodity }) => commodity,
    );
    roles.textContent =
      "Produces: " +
      (produces.length ? produces.join(", ") : "NONE") +
      " | Consumes: " +
      (consumes.length ? consumes.join(", ") : "NONE");
    card.append(name, roles, inventory);
    list.appendChild(card);
  });
}
function findTrainStart() {
  const occupied = new Set(state.trains.map((train) => train.pieceId));
  const openPieces = [...state.pieces.values()].filter(
    (piece) => !occupied.has(piece.id),
  );
  const preferredColor =
    state.stationColors[state.trains.length % state.stationColors.length];
  return (
    openPieces.find((piece) => piece.station?.color === preferredColor) ||
    openPieces.find((piece) => piece.station) ||
    openPieces[0] ||
    null
  );
}

document.getElementById("rotateTool").addEventListener("click", () => {
  state.selectedRotation = (state.selectedRotation + 90) % 360;
  renderPalette();
});
document.getElementById("clearBoard").addEventListener("click", () => {
  state.pieces.clear();
  state.trains.length = 0;
  state.nextPieceId = 1;
  state.nextTrainId = 1;
  state.stationCounter = 1;
  renderer.draw();
  renderTrains();
  renderStations();
  showToast("Board cleared");
});
layoutMenuToggle.addEventListener("click", () => {
  if (state.mode !== "edit") return;
  setLayoutMenuOpen(layoutMenu.hidden);
});
document.addEventListener("click", (event) => {
  const toggle = event.target.closest(".goal-toggle");
  if (!toggle) return;
  const cards = [...document.querySelectorAll("#trainList .train-card")];
  const index = cards.indexOf(toggle.closest(".train-card"));
  const train = state.trains[index];
  if (!train) return;
  if (train.goalsOpen) {
    toggle.textContent = "Close goal editor";
    if (state.mode === "run") {
      train.controlMode = "manual";
      train.planStatus = "editing";
      train.targetThrottle = 0;
    }
  } else {
    toggle.textContent = "Edit goals";
  }
});
document.addEventListener("click", (event) => {
  if (
    !event.target.closest(".goal-add button") &&
    !event.target.closest(".goal-clear")
  )
    return;
  const card = event.target.closest(".train-card");
  const index = [
    ...document.querySelectorAll("#trainList .train-card"),
  ].indexOf(card);
  const train = state.trains[index];
  const planToggle = card?.querySelector(".plan-toggle");
  if (train && planToggle)
    planToggle.hidden = state.mode !== "run" || !train.goals.length;
});
document.addEventListener("pointerdown", (event) => {
  if (!layoutMenu.hidden && !event.target.closest(".palette-tools"))
    setLayoutMenuOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !layoutMenu.hidden) {
    setLayoutMenuOpen(false);
    layoutMenuToggle.focus();
  }
});
document.getElementById("exportLayout").addEventListener("click", () => {
  if (state.mode !== "edit") return;
  exportLayout();
  setLayoutMenuOpen(false);
  showToast("Layout downloaded");
});
document.getElementById("importLayout").addEventListener("click", () => {
  if (state.mode !== "edit") return;
  layoutFileInput.click();
  setLayoutMenuOpen(false);
});
layoutFileInput.addEventListener("change", async () => {
  const file = layoutFileInput.files[0];
  if (!file || state.mode !== "edit") return;
  try {
    importLayout(await file.text());
    renderer.draw();
    renderTrains();
    showToast("Layout imported");
  } catch (error) {
    showToast("Import failed: " + error.message);
  } finally {
    layoutFileInput.value = "";
  }
});
modeToggle.addEventListener("click", () => {
  state.mode = state.mode === "edit" ? "run" : "edit";
  const running = state.mode === "run";
  modeToggle.classList.toggle("running", running);
  modeToggle.setAttribute("aria-pressed", String(running));
  modeToggle.setAttribute(
    "aria-label",
    running ? "Switch to edit mode" : "Switch to run mode",
  );
  document.querySelector(".sidebar").classList.toggle("run-mode", running);
  if (running) {
    setLayoutMenuOpen(false);
    state.trains.forEach((train) => {
      train.cargo = { item: null, quantity: 0 };
      train.goalIndex = 0;
      train.controlMode = "manual";
      train.planStatus = train.goals.length ? "ready" : "manual";
      train.targetThrottle = 0;
      train.velocity = 0;
    });
    state.pieces.forEach((piece) => {
      if (piece.station) piece.station.inventory = randomPrimaryInventory();
    });
    assignStationEconomy(stationRecords());
    resetEconomyClock(state);
    renderStations();
  }
  renderTrains();
  renderPalette();
  showToast(running ? "Run mode enabled" : "Edit mode enabled");
});
document.getElementById("addTrain").addEventListener("click", () => {
  const piece = findTrainStart();
  const train = addTrain(piece);
  renderTrains();
  renderStations();
  renderer.draw();
  showToast(train ? "Train added" : "No open track tile available");
});
bindInput(renderer, () => {
  renderer.draw();
});
renderPalette();
renderTrains();
renderStations();
bindSdkStatus((connected, status) => {
  document
    .getElementById("connectionDot")
    .classList.toggle("connected", connected);
  document.getElementById("connectionText").textContent = connected
    ? "Swarm connected"
    : status;
});
bindSwarmCommands((command) => {
  handleTrainCommand(command);
  renderTrains();
  renderer.draw();
  showToast("Command: /train " + command.command);
});
let lastFrame = performance.now();
let trainControlSignature = "";
function animate(time) {
  const dt = Math.min(0.05, (time - lastFrame) / 1000);
  lastFrame = time;
  updateTrains(dt);
  updateStationEconomy(state, dt);
  const nextSignature = state.trains
    .map(
      (train) =>
        train.id +
        ":" +
        train.targetThrottle +
        ":" +
        train.blocked +
        ":" +
        train.goalIndex +
        ":" +
        train.planStatus +
        ":" +
        (train.cargo?.item || "") +
        ":" +
        stationRecords()
          .map((station) =>
            ITEM_TYPES.map((item) => station.inventory?.[item] || 0).join(","),
          )
          .join(";"),
    )
    .join("|");
  if (nextSignature !== trainControlSignature) {
    trainControlSignature = nextSignature;
    refreshTrainCards();
    renderStations();
  }
  renderer.draw();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
sdk.ready.catch((error) => showToast("SDK unavailable: " + error.message));
