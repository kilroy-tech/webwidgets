import { sdk, bindSdkStatus, bindSwarmCommands } from "./sdk.js";
import { state, TRACK_TYPES } from "./state.js";
import { Renderer } from "./renderer.js";
import { bindInput } from "./input.js";
import { handleTrainCommand } from "./swarm-commands.js";
import { addTrain, setTrainThrottle, updateTrains } from "./train-controller.js";
import { exportLayout, importLayout } from "./layout-io.js";

const renderer = new Renderer(document.getElementById("board"), state);
const palette = document.getElementById("palette");
const toast = document.getElementById("toast");
const modeToggle = document.getElementById("modeToggle");
const layoutMenuToggle = document.getElementById("layoutMenuToggle");
const layoutMenu = document.getElementById("layoutMenu");
const layoutFileInput = document.getElementById("layoutFileInput");

function showToast(message) { toast.textContent = message; toast.classList.add("show"); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800); }
function renderPalette() { palette.innerHTML = ""; palette.classList.toggle("is-disabled", state.mode === "run"); Object.entries(TRACK_TYPES).forEach(([type, definition]) => { const button = document.createElement("button"); button.type = "button"; button.className = type === state.selectedType ? "active" : ""; const preview = document.createElement("canvas"); preview.className = "piece-icon"; preview.width = 58; preview.height = 58; renderer.drawPreview(preview, type, state.selectedRotation); const label = document.createElement("span"); label.textContent = definition.label; button.append(preview, label); button.addEventListener("click", () => { state.selectedType = type; renderPalette(); }); palette.appendChild(button); }); }
function setLayoutMenuOpen(open) { layoutMenu.hidden = !open; layoutMenuToggle.setAttribute("aria-expanded", String(open)); }
function throttleText(value) { if (Math.abs(value) < .03) return "NEUTRAL"; return value > 0 ? "FWD " + Math.round(value * 100) + "%" : "REV " + Math.round(Math.abs(value) * 100) + "%"; }
function renderTrains() { const list = document.getElementById("trainList"); list.innerHTML = state.trains.length ? "" : '<div class="empty-state">No trains placed</div>'; state.trains.forEach((train) => { const card = document.createElement("div"); card.className = "train-card"; const head = document.createElement("div"); head.className = "train-card-head"; const preview = document.createElement("span"); preview.className = "engine-preview"; preview.style.setProperty("--train-color", train.color || "#2878c8"); const label = document.createElement("label"); label.innerHTML = 'Train ' + train.id.split("-")[1] + ' throttle <span>' + throttleText(train.targetThrottle) + '</span>'; head.append(preview, label); const throttleWrap = document.createElement("div"); throttleWrap.className = "throttle-wrap"; const input = document.createElement("input"); input.type = "range"; input.min = "-1"; input.max = "1"; input.step = ".05"; input.value = String(train.targetThrottle); const neutralTick = document.createElement("span"); neutralTick.className = "neutral-tick"; neutralTick.setAttribute("aria-hidden", "true"); throttleWrap.append(input, neutralTick); const status = document.createElement("small"); status.textContent = train.blocked || "Ready"; input.addEventListener("input", (event) => { const value = Number(event.target.value); const snappedValue = Math.abs(value) < .12 ? 0 : value; input.value = String(snappedValue); setTrainThrottle(train, snappedValue); label.querySelector("span").textContent = throttleText(train.targetThrottle); status.textContent = train.blocked || "Ready"; }); card.append(head, throttleWrap, status); list.appendChild(card); }); }
function findTrainStart() { const occupied = new Set(state.trains.map((train) => train.pieceId)); const openPieces = [...state.pieces.values()].filter((piece) => !occupied.has(piece.id)); const preferredColor = state.stationColors[state.trains.length % state.stationColors.length]; return openPieces.find((piece) => piece.station?.color === preferredColor) || openPieces.find((piece) => piece.station) || openPieces[0] || null; }

document.getElementById("rotateTool").addEventListener("click", () => { state.selectedRotation = (state.selectedRotation + 90) % 360; renderPalette(); });
document.getElementById("clearBoard").addEventListener("click", () => { state.pieces.clear(); state.trains.length = 0; state.nextPieceId = 1; state.nextTrainId = 1; state.stationCounter = 1; renderer.draw(); renderTrains(); showToast("Board cleared"); });
layoutMenuToggle.addEventListener("click", () => { if (state.mode !== "edit") return; setLayoutMenuOpen(layoutMenu.hidden); });
document.addEventListener("pointerdown", (event) => { if (!layoutMenu.hidden && !event.target.closest(".palette-tools")) setLayoutMenuOpen(false); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !layoutMenu.hidden) { setLayoutMenuOpen(false); layoutMenuToggle.focus(); } });
document.getElementById("exportLayout").addEventListener("click", () => { if (state.mode !== "edit") return; exportLayout(); setLayoutMenuOpen(false); showToast("Layout downloaded"); });
document.getElementById("importLayout").addEventListener("click", () => { if (state.mode !== "edit") return; layoutFileInput.click(); setLayoutMenuOpen(false); });
layoutFileInput.addEventListener("change", async () => { const file = layoutFileInput.files[0]; if (!file || state.mode !== "edit") return; try { importLayout(await file.text()); renderer.draw(); renderTrains(); showToast("Layout imported"); } catch (error) { showToast("Import failed: " + error.message); } finally { layoutFileInput.value = ""; } });
modeToggle.addEventListener("click", () => { state.mode = state.mode === "edit" ? "run" : "edit"; const running = state.mode === "run"; modeToggle.classList.toggle("running", running); modeToggle.setAttribute("aria-pressed", String(running)); modeToggle.setAttribute("aria-label", running ? "Switch to edit mode" : "Switch to run mode"); document.querySelector(".sidebar").classList.toggle("run-mode", running); if (running) setLayoutMenuOpen(false); renderPalette(); showToast(running ? "Run mode enabled" : "Edit mode enabled"); });
document.getElementById("addTrain").addEventListener("click", () => { const piece = findTrainStart(); const train = addTrain(piece); renderTrains(); renderer.draw(); showToast(train ? "Train added" : "No open track tile available"); });
bindInput(renderer, () => { renderer.draw(); });
renderPalette(); renderTrains();
bindSdkStatus((connected, status) => { document.getElementById("connectionDot").classList.toggle("connected", connected); document.getElementById("connectionText").textContent = connected ? "Swarm connected" : status; });
bindSwarmCommands((command) => { handleTrainCommand(command); renderTrains(); renderer.draw(); showToast("Command: /train " + command.command); });
let lastFrame = performance.now();
let trainControlSignature = "";
function animate(time) { const dt = Math.min(.05, (time - lastFrame) / 1000); lastFrame = time; updateTrains(dt); const nextSignature = state.trains.map((train) => train.id + ":" + train.targetThrottle + ":" + train.blocked).join("|"); if (nextSignature !== trainControlSignature) { trainControlSignature = nextSignature; renderTrains(); } renderer.draw(); requestAnimationFrame(animate); }
requestAnimationFrame(animate);
sdk.ready.catch((error) => showToast("SDK unavailable: " + error.message));
