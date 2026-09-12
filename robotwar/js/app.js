import { compile, formatInstruction, REGISTER_NAMES } from "./compiler.js";
import { Battle, BATTLE_CONFIG } from "./battle.js";
import { createBattleSeed, parseSeed } from "./seeds.js";

const SAMPLE_ROBOTS = [
  {
    name: "HUNTER",
    color: "#f04f3d",
    source: `250 TO RANDOM
START
DAMAGE TO D
SCAN
IF DAMAGE # D GOTO MOVE
AIM + 17 TO AIM
SPOT
AIM TO RADAR
IF RADAR > 0 GOTO SCAN
IF SHOT # 0 GOTO SPOT
0 - RADAR TO SHOT
GOTO SPOT
MOVE
RANDOM TO H
RANDOM TO V
MOVEX
H - X * 100 TO SPEEDX
IF H - X > 10 GOTO MOVEX
IF H - X < -10 GOTO MOVEX
0 TO SPEEDX
MOVEY
V - Y * 100 TO SPEEDY
IF V - Y > 10 GOTO MOVEY
IF V - Y < -10 GOTO MOVEY
0 TO SPEEDY
GOTO START`,
  },
  {
    name: "SWEEPER",
    color: "#33a8a5",
    source: `200 TO RANDOM
80 TO SPEEDX
60 TO SPEEDY
SWEEP
AIM + 9 TO AIM
AIM TO RADAR
IF RADAR < 0 GOSUB FIRE
IF X > 235 GOSUB LEFT
IF X < 21 GOSUB RIGHT
IF Y > 235 GOSUB UP
IF Y < 21 GOSUB DOWN
GOTO SWEEP
FIRE
IF SHOT # 0 ENDSUB
0 - RADAR TO SHOT
ENDSUB
LEFT
-80 TO SPEEDX
ENDSUB
RIGHT
80 TO SPEEDX
ENDSUB
UP
-60 TO SPEEDY
ENDSUB
DOWN
60 TO SPEEDY
ENDSUB`,
  },
  {
    name: "SENTRY",
    color: "#f2b134",
    source: `WATCH
AIM + 3 TO AIM
AIM TO RADAR
IF RADAR > 0 GOTO WATCH
IF SHOT # 0 GOTO WATCH
0 - RADAR TO SHOT
GOTO WATCH`,
  },
];

const ROBOT_COLORS = ["#f04f3d", "#33a8a5", "#f2b134", "#4d7ed8", "#c05bd8"];
const STORAGE_KEY = "robotwar-workspace-v2";
const state = {
  robots: [], activeIndex: 0, view: "arena", lowerView: "diagnostics",
  battle: null, battleRunning: false, battlePaused: false, battleSpeed: 1,
  matchTotal: 1, matchCurrent: 1, matchScores: {}, matchSeed: null, nextBattleAt: 0,
  bench: null, benchRunning: false, benchInstructionCredit: 0, editor: null, sdk: null,
  hadLocalWorkspace: false,
};

const $ = (id) => document.getElementById(id);
const elements = {
  tabs: $("robotTabs"), name: $("robotName"), badge: $("compileBadge"), fallback: $("editorFallback"),
  diagnostics: $("diagnostics"), object: $("objectCode"), stats: $("sourceStats"), canvas: $("arenaCanvas"),
  empty: $("arenaEmpty"), roster: $("roster"), battleStatus: $("battleStatus"), clock: $("battleClock"),
  matchStatus: $("matchStatus"), pause: $("pauseBtn"), toast: $("toast"), benchCode: $("benchCode"),
  registerGrid: $("registerGrid"), benchPc: $("benchPc"), benchAcc: $("benchAcc"), benchSteps: $("benchSteps"),
  benchState: $("benchState"), arenaView: $("arenaView"), benchView: $("benchView"), fileInput: $("fileInput"),
};

function makeId() {
  return `robot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function activeRobot() { return state.robots[state.activeIndex]; }
function sourceValue() { return state.editor ? state.editor.getValue() : elements.fallback.value; }
function setSourceValue(value) {
  if (state.editor) state.editor.setValue(value, -1);
  else elements.fallback.value = value;
  updateSourceStats();
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function saveActiveSource() {
  const robot = activeRobot();
  if (!robot) return;
  const source = sourceValue();
  if (source !== robot.source) {
    robot.source = source;
    robot.compiled = null;
    robot.score = 0;
    renderCompileState();
    scheduleSave();
  }
}

function serializableWorkspace() {
  return {
    activeIndex: state.activeIndex,
    robots: state.robots.map(({ id, name, color, source, score }) => ({ id, name, color, source, score })),
  };
}

async function persist() {
  const data = serializableWorkspace();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  try { await state.sdk?.setKV(STORAGE_KEY, data); } catch { /* local storage remains authoritative offline */ }
}

function scheduleSave() {
  clearTimeout(scheduleSave.timer);
  scheduleSave.timer = setTimeout(persist, 350);
}

function loadLocalWorkspace() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(data?.robots) && data.robots.length) return data;
  } catch { /* use samples */ }
  return null;
}

function normalizeRobot(robot, index) {
  return {
    id: robot.id || makeId(), name: String(robot.name || `ROBOT ${index + 1}`).slice(0, 20).toUpperCase(),
    color: robot.color || ROBOT_COLORS[index % ROBOT_COLORS.length], source: String(robot.source || ""),
    score: Number(robot.score) || 0, compiled: null,
  };
}

function initializeEditor() {
  if (window.ace) {
    state.editor = window.ace.edit("editor");
    state.editor.setTheme("ace/theme/tomorrow_night_eighties");
    state.editor.session.setMode("ace/mode/text");
    state.editor.session.setUseWorker(false);
    state.editor.setOptions({ fontSize: "12px", showPrintMargin: false, tabSize: 2, useSoftTabs: true });
    state.editor.on("change", saveActiveSource);
    elements.fallback.hidden = true;
  } else {
    $("editor").hidden = true;
    elements.fallback.addEventListener("input", saveActiveSource);
  }
}

function renderTabs() {
  elements.tabs.innerHTML = "";
  state.robots.forEach((robot, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `robot-tab${index === state.activeIndex ? " active" : ""}`;
    button.style.setProperty("--robot-color", robot.color);
    button.textContent = robot.name;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(index === state.activeIndex));
    button.addEventListener("click", () => selectRobot(index));
    elements.tabs.appendChild(button);
  });
  $("addRobotBtn").disabled = state.robots.length >= 5;
  $("removeRobotBtn").disabled = state.robots.length <= 2;
}

function selectRobot(index) {
  saveActiveSource();
  state.activeIndex = index;
  elements.name.value = activeRobot().name;
  setSourceValue(activeRobot().source);
  renderTabs();
  renderCompileState();
  if (state.view === "bench") resetBench();
  scheduleSave();
}

function updateSourceStats() {
  const source = sourceValue();
  const lines = source ? source.split("\n").length : 0;
  elements.stats.textContent = `${lines} lines · ${source.length} chars`;
}

function compileRobot(robot = activeRobot(), silent = false) {
  if (robot === activeRobot()) saveActiveSource();
  const result = compile(robot.source);
  robot.compiled = result.diagnostics.length ? null : result;
  if (robot === activeRobot()) {
    renderDiagnostics(result);
    renderCompileState();
  }
  if (!silent) toast(result.diagnostics.length ? "Assembly failed" : `${result.instructions.length} object instructions`);
  return result;
}

function compileAll() {
  const results = state.robots.map((robot) => compileRobot(robot, true));
  renderCompileState();
  return results.every((result) => !result.diagnostics.length);
}

function renderDiagnostics(result = activeRobot()?.compiled || { diagnostics: [] }) {
  elements.diagnostics.innerHTML = "";
  if (!result.diagnostics.length) {
    const line = document.createElement("div");
    line.className = "output-ok";
    line.textContent = result.instructions?.length ? `ASSEMBLY COMPLETE · ${result.instructions.length} INSTRUCTIONS` : "No diagnostics";
    elements.diagnostics.appendChild(line);
  } else {
    for (const item of result.diagnostics) {
      const row = document.createElement("div");
      row.className = "diagnostic";
      row.innerHTML = `<strong>${item.code}</strong> · line ${item.line}:${item.column}<br>${escapeHtml(item.message)}`;
      row.addEventListener("click", () => state.editor?.gotoLine(item.line, item.column - 1, true));
      elements.diagnostics.appendChild(row);
    }
  }
  elements.object.textContent = result.instructions?.map(formatInstruction).join("\n") || "No object code.";
}

function renderCompileState() {
  const robot = activeRobot();
  elements.badge.className = `badge ${robot?.compiled ? "good" : "neutral"}`;
  elements.badge.textContent = robot?.compiled ? `${robot.compiled.instructions.length} instructions` : "Not compiled";
  if (robot?.compiled) renderDiagnostics(robot.compiled);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function addRobot() {
  if (state.robots.length >= 5) return;
  const index = state.robots.length;
  state.robots.push(normalizeRobot({ name: `ROBOT ${index + 1}`, color: ROBOT_COLORS[index], source: SAMPLE_ROBOTS[2].source }, index));
  selectRobot(index);
}

function removeRobot() {
  if (state.robots.length <= 2) return;
  state.robots.splice(state.activeIndex, 1);
  state.activeIndex = Math.min(state.activeIndex, state.robots.length - 1);
  selectRobot(state.activeIndex);
}

function battleDefinitions() {
  return state.robots.map((robot) => ({
    id: robot.id, name: robot.name, color: robot.color, source: robot.source,
    instructions: robot.compiled.instructions, score: state.matchScores[robot.id] ?? robot.score,
  }));
}

function startMatch() {
  if (!compileAll()) {
    const failed = state.robots.findIndex((robot) => !robot.compiled);
    selectRobot(Math.max(0, failed));
    toast("Fix assembly errors before battle");
    return;
  }
  state.matchTotal = Math.max(1, Math.min(99, Number($("matchCount").value) || 1));
  state.matchCurrent = 1;
  state.matchScores = Object.fromEntries(state.robots.map((robot) => [robot.id, robot.score]));
  state.matchSeed = parseSeed($("seedInput").value);
  startBattle(seedForCurrentBattle());
}

function seedForCurrentBattle() {
  return state.matchSeed === null
    ? createBattleSeed()
    : ((state.matchSeed + state.matchCurrent - 1) >>> 0) || 1;
}

function startBattle(seed) {
  state.battle = new Battle(battleDefinitions(), { seed });
  state.battleRunning = true;
  state.battlePaused = false;
  state.nextBattleAt = 0;
  elements.pause.disabled = false;
  elements.pause.querySelector("span").textContent = "Pause";
  elements.empty.hidden = true;
  elements.battleStatus.textContent = `Battle in progress · seed ${state.battle.seed}`;
  elements.matchStatus.textContent = `${state.matchCurrent} / ${state.matchTotal}`;
  renderRoster(state.battle.snapshot());
}

function finishBattle() {
  const battle = state.battle;
  state.battleRunning = false;
  elements.pause.disabled = true;
  for (const robot of battle.robots) state.matchScores[robot.id] = robot.score;
  const winner = battle.result?.winnerId ? battle.robots.find((robot) => robot.id === battle.result.winnerId) : null;
  elements.battleStatus.textContent = winner ? `${winner.name} wins` : "Draw";
  if (state.matchCurrent < state.matchTotal) {
    state.nextBattleAt = performance.now() + 1100;
    elements.battleStatus.textContent += " · next battle queued";
  } else {
    state.robots.forEach((robot) => { robot.score = state.matchScores[robot.id] || 0; });
    scheduleSave();
  }
}

function resetBattle() {
  state.battle = null;
  state.battleRunning = false;
  state.battlePaused = false;
  state.nextBattleAt = 0;
  elements.pause.disabled = true;
  elements.empty.hidden = false;
  elements.battleStatus.textContent = "Ready";
  elements.clock.textContent = "00:00.0";
  elements.matchStatus.textContent = "1 / 1";
  renderRoster();
}

function resetBench() {
  const result = compileRobot(activeRobot(), true);
  if (result.diagnostics.length) {
    state.bench = null;
    toast("Compile the robot before testing");
    renderBench();
    return;
  }
  const arena = new Battle([{
    id: activeRobot().id,
    name: activeRobot().name,
    color: activeRobot().color,
    source: activeRobot().source,
    instructions: result.instructions,
  }], { seed: 2002, spawns: [[128, 128]] });
  state.bench = { arena, robot: arena.robots[0], vm: arena.robots[0].vm, result };
  state.benchRunning = false;
  state.benchInstructionCredit = 0;
  $("benchRunBtn").querySelector("span").textContent = "Run";
  renderBench();
}

function stepBench(shouldRender = true) {
  if (!state.bench) resetBench();
  state.bench?.arena.stepTestBench();
  if (shouldRender) renderBench();
}

function keepBenchInstructionVisible() {
  const current = elements.benchCode.querySelector(".current");
  if (!current) return;
  const paneBounds = elements.benchCode.getBoundingClientRect();
  const currentBounds = current.getBoundingClientRect();
  const margin = currentBounds.height * 2;
  const visibleTop = paneBounds.top + margin;
  const visibleBottom = paneBounds.bottom - margin;
  if (currentBounds.top < visibleTop) {
    elements.benchCode.scrollTop -= visibleTop - currentBounds.top;
  } else if (currentBounds.bottom > visibleBottom) {
    elements.benchCode.scrollTop += currentBounds.bottom - visibleBottom;
  }
}

function renderBench() {
  const bench = state.bench;
  if (!bench) {
    elements.benchCode.textContent = "Compile a valid robot to begin.";
    elements.registerGrid.innerHTML = "";
    return;
  }
  const vm = bench.vm;
  elements.benchPc.textContent = String(vm.pc).padStart(3, "0");
  elements.benchAcc.textContent = String(vm.accumulator);
  elements.benchSteps.textContent = String(vm.steps);
  elements.benchState.textContent = vm.error ? "ERROR" : vm.halted ? "HALTED" : state.benchRunning ? "RUNNING" : "PAUSED";
  elements.benchCode.innerHTML = bench.result.instructions.map((item, index) => {
    const line = escapeHtml(formatInstruction(item, index));
    return `<span class="bench-instruction${index === vm.pc ? " current" : ""}" data-pc="${index}">${line}</span>`;
  }).join("");
  keepBenchInstructionVisible();
  const names = [...REGISTER_NAMES, "DATA"];
  elements.registerGrid.innerHTML = names.map((name) => `<div class="register"><span>${name}</span><strong>${vm.peekRegister(name)}</strong></div>`).join("");
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll(".view-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  elements.arenaView.hidden = view !== "arena";
  elements.benchView.hidden = view !== "bench";
  document.querySelector(".arena-only").hidden = view !== "arena";
  document.querySelector(".bench-only").hidden = view !== "bench";
  if (view === "bench") resetBench();
  else resizeCanvas();
}

function formatClock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(1).padStart(4, "0")}`;
}

function renderRoster(snapshot = state.battle?.snapshot()) {
  const records = snapshot?.robots || state.robots.map((robot) => ({ ...robot, damage: 100, alive: true, pc: 0, score: robot.score }));
  elements.roster.innerHTML = records.map((robot) => `
    <article class="robot-card${robot.alive ? "" : " destroyed"}" style="--robot-color:${robot.color}">
      <div class="robot-card-head"><strong>${escapeHtml(robot.name)}</strong><span>${robot.alive ? "ACTIVE" : "OUT"}</span></div>
      <div class="meter"><span style="width:${Math.max(0, robot.damage)}%"></span></div>
      <dl><dt>Integrity</dt><dd>${Math.ceil(robot.damage)}%</dd><dt>Score</dt><dd>${robot.score || 0}</dd><dt>PC</dt><dd>${String(robot.pc || 0).padStart(3, "0")}</dd></dl>
    </article>`).join("");
}

function resizeCanvas() {
  const rect = elements.canvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (elements.canvas.width !== width || elements.canvas.height !== height) {
    elements.canvas.width = width;
    elements.canvas.height = height;
  }
}

function drawArena(snapshot) {
  resizeCanvas();
  const canvas = elements.canvas;
  const context = canvas.getContext("2d");
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const padding = 26;
  const size = Math.max(1, Math.min(width, height) - padding * 2);
  const left = (width - size) / 2;
  const top = (height - size) / 2;
  const scale = size / BATTLE_CONFIG.arenaSize;
  context.fillStyle = "#0a120c";
  context.fillRect(left, top, size, size);
  context.strokeStyle = "rgba(184,227,75,.12)";
  context.lineWidth = 1;
  for (let meter = 32; meter < 256; meter += 32) {
    const point = left + meter * scale;
    context.beginPath(); context.moveTo(point, top); context.lineTo(point, top + size); context.stroke();
    const vertical = top + meter * scale;
    context.beginPath(); context.moveTo(left, vertical); context.lineTo(left + size, vertical); context.stroke();
  }
  context.strokeStyle = "rgba(184,227,75,.65)";
  context.lineWidth = 2;
  context.strokeRect(left, top, size, size);
  if (!snapshot) return;

  const recentEvents = state.battle?.events.filter((event) => snapshot.time - event.time < .35) || [];
  for (const event of recentEvents) {
    if (event.type === "radar") {
      const robot = snapshot.robots.find((item) => item.id === event.robotId);
      if (!robot) continue;
      const vector = { x: Math.sin(event.angle * Math.PI / 180), y: -Math.cos(event.angle * Math.PI / 180) };
      const length = Math.abs(event.result) * scale;
      context.strokeStyle = event.result < 0 ? "rgba(240,174,55,.65)" : "rgba(70,185,180,.22)";
      context.lineWidth = 1;
      context.beginPath(); context.moveTo(left + robot.x * scale, top + robot.y * scale); context.lineTo(left + robot.x * scale + vector.x * length, top + robot.y * scale + vector.y * length); context.stroke();
    }
    if (event.type === "explosion") {
      const age = snapshot.time - event.time;
      context.strokeStyle = `rgba(240,174,55,${1 - age / .35})`;
      context.lineWidth = 2;
      context.beginPath(); context.arc(left + event.x * scale, top + event.y * scale, (4 + age * 45) * scale, 0, Math.PI * 2); context.stroke();
    }
  }
  for (const shell of snapshot.shells) {
    context.fillStyle = "#fff4c4";
    context.beginPath(); context.arc(left + shell.x * scale, top + shell.y * scale, Math.max(2, scale), 0, Math.PI * 2); context.fill();
  }
  for (const robot of snapshot.robots) {
    const x = left + robot.x * scale;
    const y = top + robot.y * scale;
    const radius = Math.max(7, BATTLE_CONFIG.robotRadius * scale);
    context.save();
    context.globalAlpha = robot.alive ? 1 : .22;
    context.fillStyle = robot.color;
    context.strokeStyle = "#081009";
    context.lineWidth = 2;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
    const vector = { x: Math.sin(robot.aim * Math.PI / 180), y: -Math.cos(robot.aim * Math.PI / 180) };
    context.strokeStyle = "#f5f8eb";
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(x, y); context.lineTo(x + vector.x * radius * 1.7, y + vector.y * radius * 1.7); context.stroke();
    context.fillStyle = "#dfe7dd";
    context.font = "9px IBM Plex Mono";
    context.textAlign = "center";
    context.fillText(robot.name, x, y - radius - 7);
    context.restore();
  }
}

function exportRobot() {
  saveActiveSource();
  const robot = activeRobot();
  const blob = new Blob([JSON.stringify({ format: "robotwar-source-v1", name: robot.name, source: robot.source }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${robot.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.robot.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importRobot(file) {
  const text = await file.text();
  let source = text;
  let name = file.name.replace(/\.[^.]+(?:\.json)?$/, "");
  try {
    const data = JSON.parse(text);
    if (typeof data.source === "string") { source = data.source; name = data.name || name; }
  } catch { /* plain source file */ }
  const robot = activeRobot();
  robot.name = String(name).slice(0, 20).toUpperCase();
  robot.source = source;
  robot.compiled = null;
  robot.score = 0;
  selectRobot(state.activeIndex);
  compileRobot();
  scheduleSave();
}

function bindEvents() {
  $("compileBtn").addEventListener("click", () => compileRobot());
  $("addRobotBtn").addEventListener("click", addRobot);
  $("removeRobotBtn").addEventListener("click", removeRobot);
  elements.name.addEventListener("input", () => {
    activeRobot().name = elements.name.value.toUpperCase();
    renderTabs(); renderRoster(); scheduleSave();
  });
  $("battleBtn").addEventListener("click", startMatch);
  elements.pause.addEventListener("click", () => {
    state.battlePaused = !state.battlePaused;
    elements.pause.querySelector("span").textContent = state.battlePaused ? "Resume" : "Pause";
    elements.battleStatus.textContent = state.battlePaused ? "Paused" : "Battle in progress";
  });
  $("resetBattleBtn").addEventListener("click", resetBattle);
  $("battleSpeed").addEventListener("change", (event) => { state.battleSpeed = Number(event.target.value); });
  document.querySelectorAll(".view-tab").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  document.querySelectorAll(".lower-tab").forEach((button) => button.addEventListener("click", () => {
    state.lowerView = button.dataset.lower;
    document.querySelectorAll(".lower-tab").forEach((item) => item.classList.toggle("active", item === button));
    elements.diagnostics.hidden = state.lowerView !== "diagnostics";
    elements.object.hidden = state.lowerView !== "object";
  }));
  $("benchRunBtn").addEventListener("click", () => {
    if (!state.bench) resetBench();
    state.benchRunning = !state.benchRunning;
    $("benchRunBtn").querySelector("span").textContent = state.benchRunning ? "Pause" : "Run";
    renderBench();
  });
  $("benchStepBtn").addEventListener("click", stepBench);
  $("benchResetBtn").addEventListener("click", resetBench);
  $("radarInjectBtn").addEventListener("click", () => {
    if (!state.bench) resetBench();
    if (state.bench) state.bench.robot.radarResult = -(20 + Math.floor(Math.random() * 100));
    renderBench();
  });
  $("damageInjectBtn").addEventListener("click", () => {
    if (!state.bench) resetBench();
    if (state.bench) state.bench.arena.applyDamage(state.bench.robot, 1 + Math.floor(Math.random() * 10), "test-bench");
    renderBench();
  });
  $("importBtn").addEventListener("click", () => elements.fileInput.click());
  $("exportBtn").addEventListener("click", exportRobot);
  elements.fileInput.addEventListener("change", () => {
    if (elements.fileInput.files[0]) importRobot(elements.fileInput.files[0]);
    elements.fileInput.value = "";
  });
  window.addEventListener("resize", () => { resizeCanvas(); state.editor?.resize(); });
  window.addEventListener("beforeunload", saveActiveSource);
}

async function initializeSdk() {
  const params = new URLSearchParams(location.search);
  if (!params.has("alias") && !params.has("webwidget_alias") && !params.has("guid") && !params.has("webwidget_guid")) return;
  try {
    const { initWebWidget } = await import("/apps/kilroy.utils/lib/kilroy/js/webwidget_sdk.js");
    state.sdk = initWebWidget({
      alias: params.get("alias") || params.get("webwidget_alias") || "kilroypublic.robotwar",
      guid: params.get("guid") || params.get("webwidget_guid") || `robotwar-${Date.now()}`,
      focusBridgeEnabled: true, targetOrigin: location.origin,
    });
    state.sdk.onConnectionState((event) => {
      document.querySelector(".connection").classList.toggle("connected", Boolean(event.connected));
      $("connectionText").textContent = event.connected ? "Kilroy connected" : "Local";
    });
    await state.sdk.ready;
    if (!state.hadLocalWorkspace) {
      const remote = await state.sdk.getKV(STORAGE_KEY, null);
      if (Array.isArray(remote?.robots) && remote.robots.length >= 2) {
        state.robots = remote.robots.slice(0, 5).map(normalizeRobot);
        state.activeIndex = Math.min(remote.activeIndex || 0, state.robots.length - 1);
        setSourceValue(activeRobot().source);
        selectRobot(state.activeIndex);
        compileAll();
        renderRoster();
      }
    }
  } catch { $("connectionText").textContent = "Local"; }
}

let lastFrame = performance.now();
function frame(now) {
  const elapsed = Math.min(.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (state.battleRunning && !state.battlePaused && state.battle) {
    const snapshot = state.battle.step(elapsed * state.battleSpeed);
    drawArena(snapshot);
    renderRoster(snapshot);
    elements.clock.textContent = formatClock(snapshot.time);
    if (snapshot.finished) finishBattle();
  } else if (state.battle) drawArena(state.battle.snapshot());
  else drawArena(null);

  if (state.nextBattleAt && now >= state.nextBattleAt) {
    state.matchCurrent += 1;
    startBattle(seedForCurrentBattle());
  }
  if (state.benchRunning && state.bench && !state.bench.vm.halted) {
    state.benchInstructionCredit += elapsed * BATTLE_CONFIG.instructionsPerSecond;
    while (state.benchInstructionCredit >= 1 && !state.bench.vm.halted) {
      stepBench(false);
      state.benchInstructionCredit -= 1;
    }
    renderBench();
  }
  requestAnimationFrame(frame);
}

function initialize() {
  const saved = loadLocalWorkspace();
  state.hadLocalWorkspace = Boolean(saved);
  state.robots = (saved?.robots || SAMPLE_ROBOTS).slice(0, 5).map(normalizeRobot);
  while (state.robots.length < 2) state.robots.push(normalizeRobot(SAMPLE_ROBOTS[state.robots.length], state.robots.length));
  state.activeIndex = Math.min(saved?.activeIndex || 0, state.robots.length - 1);
  initializeEditor();
  bindEvents();
  setSourceValue(activeRobot().source);
  selectRobot(state.activeIndex);
  compileAll();
  renderRoster();
  resizeCanvas();
  window.lucide?.createIcons();
  initializeSdk();
  requestAnimationFrame(frame);
}

initialize();