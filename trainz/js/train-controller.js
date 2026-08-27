import { getPiece, state } from "./state.js";
import {
  getPiecePaths,
  getSwitchRoutes,
  normalizePiece,
  opposite,
} from "./track-types.js";
import { emptyCargo, ITEM_TYPES, normalizeGoal } from "./cargo-goals.js";
import { addInventory, removeInventory } from "./resources.js";
import { findRoute, findEscapeRoute } from "./track-network.js";

const MAX_SPEED = 1.35;
const ACCELERATION = 2.2;
const BRAKING = 3.4;
const MIN_PROGRESS = 0.001;
// A blocked train stops short of the tile boundary (rather than right at it) so
// two trains blocked nose-to-nose on opposite sides of the same boundary render
// with visible separation instead of their bodies coinciding.
const BLOCKED_STOP_PROGRESS = 0.75;
// Randomized pause range (~0.3s-2.8s) before a "resume" or "reroute" response
// acts, so two trains that meet head-on don't retry in perfect lockstep.
const BLOCK_PAUSE_MIN_TICKS = 20;
const BLOCK_PAUSE_RANGE = 150;
// Randomized pause (~1.25s-2.25s) before the "reverse" response acts — long
// enough for a train accelerating from rest to clear one tile before this one
// abandons its route and backs away.
const REVERSE_PAUSE_MIN_TICKS = 75;
const REVERSE_PAUSE_RANGE = 60;
// Safety net: force any stopped, goal-bearing train to retry from scratch after
// ~4s, regardless of how it got stuck (including a stale controlMode drop).
const STALL_WATCHDOG_TICKS = 240;

function pathForTrain(train) {
  const piece = findPiece(train.pieceId);
  if (!piece) return null;
  const paths = getPiecePaths(piece);
  return paths[train.pathIndex] || paths[0] || null;
}

function findPiece(pieceId) {
  return (
    [...state.pieces.values()].find((piece) => piece.id === pieceId) || null
  );
}

function directionOffset(direction) {
  return { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[direction];
}

function selectSwitchRouteForEntry(piece, entry) {
  if (!piece.type.startsWith("switch")) return;
  const routes = getSwitchRoutes(piece);
  const selectedPath = routes[piece.switchState || "straight"]?.[0];
  if (selectedPath?.includes(entry)) return;
  const incomingRoute = Object.entries(routes).find(([, paths]) =>
    paths.some(([from, to]) => from === entry || to === entry),
  );
  if (incomingRoute) {
    piece.switchState = incomingRoute[0];
    normalizePiece(piece);
  }
}

function nextPath(train, exitDirection, claimedTiles) {
  if (!exitDirection) return null;
  const offset = directionOffset(exitDirection);
  if (!offset) return null;
  const nextPiece = getPiece(train.gridX + offset[0], train.gridY + offset[1]);
  if (!nextPiece || nextPiece.type === "deadEnd") return null;
  const entry = opposite(exitDirection);
  if (train.controlMode === "plan" && train.route?.length) {
    const plannedStep = train.route[0];
    if (
      plannedStep.from.id !== train.pieceId ||
      plannedStep.to.id !== nextPiece.id ||
      plannedStep.entry !== entry ||
      plannedStep.exit !== exitDirection
    )
      return null;
    const followingStep = train.route[1];
    if (plannedStep.requiredSwitchState) {
      nextPiece.switchState = plannedStep.requiredSwitchState;
      normalizePiece(nextPiece);
    }
  } else {
    selectSwitchRouteForEntry(nextPiece, entry);
  }
  const paths = getPiecePaths(nextPiece);
  const pathIndex = paths.findIndex(
    ([from, to]) => from === entry || to === entry,
  );
  if (pathIndex < 0) return null;
  const path = paths[pathIndex];
  const nextExit = path[0] === entry ? path[1] : path[0];
  if (!nextExit) return null;
  return {
    piece: nextPiece,
    pathIndex,
    entry,
    exit: nextExit,
    geometry: path[2],
  };
}

function stopTrain(train, reason, preserveThrottle = false) {
  if (!preserveThrottle) train.targetThrottle = 0;
  train.blocked = reason;
}

function moveToNextPath(train, path, claimedTiles) {
  if (!path || claimedTiles.has(path.piece.id)) {
    stopTrain(train, path ? "another train" : "blocked track", Boolean(path));
    train.blockedPieceId = path ? path.piece.id : null;
    if (path) train.resumeVelocity = train.resumeVelocity || train.velocity;
    if (train.controlMode === "plan") train.blockEvent = true;
    return false;
  }
  claimedTiles.delete(train.pieceId);
  claimedTiles.add(path.piece.id);
  train.pieceId = path.piece.id;
  train.gridX = path.piece.gridX;
  train.gridY = path.piece.gridY;
  train.pathIndex = path.pathIndex;
  train.entry = path.entry;
  train.exit = path.exit;
  train.orientationEntry = path.entry;
  train.orientationExit = path.exit;
  train.geometry = path.geometry;
  train.progress = MIN_PROGRESS;
  if (train.resumeVelocity) {
    train.velocity =
      Math.sign(train.targetThrottle || train.direction) * train.resumeVelocity;
    train.resumeVelocity = 0;
  }
  train.blocked = "";
  if (train.controlMode === "plan" && train.route?.length)
    train.route = train.route.slice(1);
  return true;
}

function setTrainPath(train, direction) {
  const piece = findPiece(train.pieceId);
  if (!piece) return false;
  const paths = getPiecePaths(piece);
  const path = paths[train.pathIndex] || paths[0];
  if (!path) return false;
  const entry = direction > 0 ? path[0] : path[1];
  const exit = direction > 0 ? path[1] : path[0];
  if (!entry || !exit) return false;
  train.entry = entry;
  train.exit = exit;
  train.orientationEntry = entry;
  train.orientationExit = exit;
  train.geometry = path[2];
  train.direction = direction;
  return true;
}

function reverseTrainPath(train) {
  [train.entry, train.exit] = [train.exit, train.entry];
  train.progress = 1 - train.progress;
  train.direction *= -1;
}

function stationAtTrain(train) {
  const piece = findPiece(train.pieceId);
  return piece?.station || null;
}
function stationPiece(stationId) {
  return (
    [...state.pieces.values()].find(
      (piece) => piece.station?.id === stationId,
    ) || null
  );
}
function configureSwitchForExit(piece, entry, exit) {
  if (!piece.type.startsWith("switch")) return;
  const routes = getSwitchRoutes(piece);
  const selectedRoute = Object.entries(routes).find(([, paths]) =>
    paths.some(
      ([from, to]) =>
        (from === entry && to === exit) || (from === exit && to === entry),
    ),
  );
  if (selectedRoute && piece.switchState !== selectedRoute[0]) {
    piece.switchState = selectedRoute[0];
    normalizePiece(piece);
  }
}
function prepareRouteSwitches(route, currentPiece, currentEntry) {
  if (!route?.length) return;
  const firstStep = route[0];
  configureSwitchForExit(currentPiece, currentEntry, firstStep.exit);
  route.forEach((step, index) => {
    const nextStep = route[index + 1];
    if (nextStep) configureSwitchForExit(step.to, step.entry, nextStep.exit);
  });
}
function alignCurrentPath(train, entry, exit) {
  const piece = findPiece(train.pieceId);
  if (!piece) return false;
  const paths = getPiecePaths(piece);
  const index = paths.findIndex(
    ([from, to]) =>
      (from === entry && to === exit) || (from === exit && to === entry),
  );
  return (
    index >= 0 &&
    train.pathIndex === index &&
    train.entry === entry &&
    train.exit === exit
  );
}
function applyRoute(train, chosen, status) {
  const nextStep = chosen.route[0];
  const currentPiece = findPiece(train.pieceId);
  // Physically re-align the current tile's crossing direction to the chosen route:
  // needed both when a switch on the current tile is thrown to a new branch, and
  // when the route reverses the train (chosen.entry is then the old exit side).
  if (chosen.entry !== train.entry) {
    // Reversal: swapping entry/exit and flipping progress keeps the rendered
    // position mathematically continuous (no jump).
    train.progress = 1 - train.progress;
  } else if (nextStep.exit !== train.exit) {
    // Same entry, different exit (e.g. a switch branch change while the train
    // is already partway across): it hasn't actually traveled toward the new
    // exit at all, so progress must restart from the entry side. Leaving the
    // old, already-advanced progress value would make the renderer jump
    // straight to interpolating toward the new exit mid-curve.
    train.progress = MIN_PROGRESS;
  }
  train.entry = chosen.entry;
  train.exit = nextStep.exit;
  train.orientationEntry = train.entry;
  train.orientationExit = train.exit;
  train.direction = chosen.direction;
  configureSwitchForExit(currentPiece, chosen.entry, nextStep.exit);
  const matchedPath = getPiecePaths(currentPiece).find(
    ([from, to]) =>
      (from === train.entry && to === train.exit) ||
      (from === train.exit && to === train.entry),
  );
  if (matchedPath) train.geometry = matchedPath[2];
  train.route = chosen.route.map((step, index, route) => ({
    ...step,
    requiredSwitchState: switchStateForStep(step, route[index + 1]),
  }));
  train.planStatus = status;
  train.planDirection = chosen.direction;
  train.targetThrottle = chosen.direction;
  train.blocked = "";
}
function chooseEscapeRoute(train, blockedIds) {
  const piece = findPiece(train.pieceId);
  if (!piece) return null;
  const currentDirection = train.direction || 1;
  const forward = findEscapeRoute(piece, train.entry, blockedIds);
  if (forward?.length)
    return { route: forward, direction: currentDirection, entry: train.entry };
  if (train.speed > 0.01) return null;
  const reverse = findEscapeRoute(piece, train.exit, blockedIds);
  return reverse?.length
    ? { route: reverse, direction: currentDirection * -1, entry: train.exit }
    : null;
}
// Existence check only: ignores current motion/occupancy, just "is there any path at all".
function destinationReachable(train, destinationId) {
  const piece = findPiece(train.pieceId);
  if (!piece) return false;
  return Boolean(
    findRoute(piece, destinationId, new Set(), train.entry) ||
    findRoute(piece, destinationId, new Set(), train.exit),
  );
}
function randomPauseTicks() {
  return BLOCK_PAUSE_MIN_TICKS + Math.floor(Math.random() * BLOCK_PAUSE_RANGE);
}
function randomReversePauseTicks() {
  return (
    REVERSE_PAUSE_MIN_TICKS + Math.floor(Math.random() * REVERSE_PAUSE_RANGE)
  );
}
// Randomly pick how this train responds to a fresh block, so two trains that
// meet head-on don't both run the identical deterministic response and keep
// bouncing off each other in lockstep every retry cycle.
function pickBlockStrategy() {
  const r = Math.random();
  if (r < 1 / 3) return "reverse"; // act immediately, prefer reversing away
  if (r < 2 / 3) return "resume"; // wait, then just resume if the path cleared
  return "reroute"; // wait, then fully replan (today's default behavior)
}
// Direct route if one exists; otherwise a repositioning waypoint to break a
// deadlock. With preferReverse, an escape/reversal is tried before the direct
// route, so a train can back off even when the direct path is nominally usable.
function resolveRoute(
  train,
  destinationStationId,
  { preferReverse, allowFollow = true } = {},
) {
  if (!destinationReachable(train, destinationStationId)) {
    train.controlMode = "manual";
    train.planStatus = "unreachable";
    train.targetThrottle = 0;
    return;
  }
  const blockedIds = new Set(
    state.trains
      .filter((other) => other !== train)
      .map((other) => other.pieceId),
  );
  const committedRoute = chooseVisitRoute(
    train,
    destinationStationId,
    new Set(),
    true,
  );
  if (preferReverse) {
    const escapeRoute = chooseEscapeRoute(train, blockedIds);
    if (escapeRoute) {
      applyRoute(train, escapeRoute, "repositioning");
      return;
    }
  }
  const clearRoute = chooseVisitRoute(
    train,
    destinationStationId,
    blockedIds,
    true,
  );
  // findRoute exempts the destination tile from blockedIds so a route can still
  // terminate there — but if the very next step is onto a currently-occupied
  // tile (e.g. another train parked right on our destination), that "clear"
  // route can't actually be driven yet. Prefer backing away to open space
  // first in that case, rather than repeatedly re-applying a route that will
  // just fail again at the same spot.
  const nextTileOccupied =
    clearRoute && blockedIds.has(clearRoute.route[0].to.id);
  if (clearRoute && !nextTileOccupied) {
    applyRoute(train, clearRoute, "planning");
    return;
  }
  if (committedRoute && allowFollow && !preferReverse) {
    // Keep the topology route even though its next tile is occupied. This is a
    // following-train state, not a failed route: processVisitGoal can now watch
    // that exact next tile and resume immediately when its occupant moves on.
    applyRoute(train, committedRoute, "blocked");
    train.targetThrottle = 0;
    train.blockStrategy = train.blockStrategy || "resume";
    train.blockGraceTicks = train.blockGraceTicks || randomPauseTicks();
    return;
  }
  const escapeRoute = chooseEscapeRoute(train, blockedIds);
  if (escapeRoute) {
    applyRoute(train, escapeRoute, "repositioning");
    return;
  }
  if (clearRoute) {
    // No room to back away: wait right at the approach; will retry once clear.
    applyRoute(train, clearRoute, "planning");
    return;
  }
  // Reachable in principle but not actionable yet (e.g. still moving the wrong
  // way and can't reverse mid-tile, or genuinely boxed in) — stop and re-evaluate.
  // Route must be cleared here: a stale non-empty route would make the next
  // processVisitGoal call treat this train as "still cruising" and never retry.
  train.route = null;
  train.targetThrottle = 0;
  if (train.speed > 0.01) {
    train.planStatus = "planning";
    return;
  }
  train.planStatus = "blocked";
  train.blockedCooldown = 60;
}
function processVisitGoal(train, goal, dt) {
  const destination = stationPiece(goal.stationId);
  if (!destination) {
    train.controlMode = "manual";
    train.planStatus = "unreachable";
    train.targetThrottle = 0;
    return;
  }
  if (destination.id === train.pieceId) {
    train.planStatus = "planning";
    train.targetThrottle = 0;
    if (train.speed < 0.01) advanceGoal(train);
    return;
  }
  if (train.blockEvent) {
    train.blockEvent = false;
    if (train.route?.length && !train.blockStrategy) {
      // Roll a response strategy once per block episode, and a pause length
      // for the two strategies that wait before acting (see pickBlockStrategy).
      train.planStatus = "blocked";
      train.blockStrategy = pickBlockStrategy();
      train.blockGraceTicks =
        train.blockStrategy === "reverse"
          ? randomReversePauseTicks()
          : randomPauseTicks();
      train.targetThrottle = 0;
    }
  }
  // Counted every frame the train is marked blocked — not just on blockEvent
  // frames, which only fire once per failed approach attempt (every ~0.3s of
  // ramp-up/fail/reset) and would otherwise stretch a short pause into tens of
  // seconds of real time.
  if (train.planStatus === "blocked" && train.route?.length) {
    const blockedIds = new Set(
      state.trains
        .filter((other) => other !== train)
        .map((other) => other.pieceId),
    );
    const nextTileId = train.route[0]?.to?.id;
    if (nextTileId && !blockedIds.has(nextTileId)) {
      // Following a train is the default behavior: as soon as it clears the
      // next tile, continue the committed route without rerouting.
      train.planStatus = "planning";
      train.targetThrottle = train.planDirection || train.direction;
      train.blockGraceTicks = 0;
      train.blockStrategy = null;
      train.blocked = "";
      return;
    }
    if (train.blockGraceTicks > 0) {
      train.blockGraceTicks = Math.max(0, train.blockGraceTicks - dt * 60);
      return;
    }
    if (train.blockStrategy === "resume") {
      // Still blocked: give up waiting and escalate to a full reroute.
      train.blockStrategy = "reroute";
      train.blockGraceTicks = randomPauseTicks();
      return;
    }
    const preferReverse = train.blockStrategy === "reverse";
    train.route = null;
    // Force a clean stop before replanning: otherwise residual velocity from
    // the last failed forward attempt can disqualify chooseEscapeRoute's
    // reverse check (train.speed > 0.01), causing the same forward route to
    // be re-applied and the train to cycle forward/blocked forever instead
    // of ever reversing.
    train.velocity = 0;
    train.speed = 0;
    train.targetThrottle = 0;
    train.blockStrategy = null;
    resolveRoute(train, destination.station.id, {
      preferReverse,
      allowFollow: false,
    });
    return;
  } else if (train.route?.length) {
    return;
  } else if (train.planStatus === "repositioning") {
    // Just finished backing off, with no active blockEvent driving another
    // decision. Pause briefly before deciding whether another escape is
    // needed — otherwise two trains that both just repositioned can instantly
    // retrigger each other and ping-pong the length of the whole layout.
    train.planStatus = "blocked";
    train.blockedCooldown = randomPauseTicks();
    return;
  } else if (train.planStatus === "blocked") {
    if (train.blockedCooldown > 0) {
      train.blockedCooldown--;
      return;
    }
  }
  train.blockGraceTicks = 0;
  train.blockStrategy = null;
  resolveRoute(train, destination.station.id);
}
function switchStateForStep(step, nextStep) {
  if (!step.to.type.startsWith("switch") || !nextStep) return null;
  const routes = getSwitchRoutes(step.to);
  const match = Object.entries(routes).find(([, paths]) =>
    paths.some(
      ([from, to]) =>
        (from === step.entry && to === nextStep.exit) ||
        (from === nextStep.exit && to === step.entry),
    ),
  );
  return match ? match[0] : null;
}
function advanceGoal(train) {
  train.goalIndex++;
  if (train.goalIndex >= train.goals.length) {
    train.controlMode = "manual";
    train.planStatus = "complete";
    train.targetThrottle = 0;
  } else train.planStatus = "planning";
}
function processGoal(train, dt = 1 / 60) {
  if (train.controlMode !== "plan" || !train.goals.length) return;
  const goal = train.goals[train.goalIndex];
  if (!goal) {
    train.controlMode = "manual";
    train.planStatus = "complete";
    train.targetThrottle = 0;
    return;
  }
  if (goal.opcode === "STEP") {
    train.goalIndex = Math.min(goal.step, train.goals.length);
    if (train.goalIndex >= train.goals.length) {
      train.controlMode = "manual";
      train.planStatus = "complete";
      train.targetThrottle = 0;
    }
    return;
  }
  if (goal.opcode === "DRIVE") {
    train.planStatus = "planning";
    train.targetThrottle =
      ((goal.direction === "REVERSE" ? -1 : 1) * goal.speed) / 100;
    return;
  }
  if (goal.opcode === "VISIT") {
    processVisitGoal(train, goal, dt);
    return;
  }
  const station = stationAtTrain(train);
  if (goal.opcode === "BUY") {
    if (!station || train.speed > 0.01) return;
    const available = station.inventory[goal.item] || 0;
    // Any reason this can't be satisfied right now (no stock, carrying a
    // different commodity, or already full) just skips the step rather than
    // freezing the train indefinitely — a BUY goal is a best-effort pickup,
    // not something worth blocking the whole plan on.
    if (
      !available ||
      (train.cargo.item && train.cargo.item !== goal.item) ||
      (train.cargo.quantity || 0) >= 3
    ) {
      advanceGoal(train);
      return;
    }
    removeInventory(station, goal.item, 1);
    train.cargo = {
      item: goal.item,
      quantity: (train.cargo.quantity || 0) + 1,
    };
    advanceGoal(train);
    return;
  }
  if (goal.opcode === "SELL") {
    if (!station || train.speed > 0.01) return;
    // Always dump whatever cargo is currently held, regardless of goal.item —
    // there's no reason to keep hauling it around if a SELL step is reached.
    if (train.cargo.item && train.cargo.quantity > 0) {
      addInventory(station, train.cargo.item, train.cargo.quantity);
    }
    train.cargo = emptyCargo();
    advanceGoal(train);
  }
}

export function addTrain(piece) {
  if (!piece) return null;
  const train = {
    id: "train-" + (state.trains.length + 1),
    color:
      state.stationColors[state.trains.length % state.stationColors.length],
    pieceId: piece.id,
    gridX: piece.gridX,
    gridY: piece.gridY,
    pathIndex: 0,
    entry: null,
    exit: null,
    orientationEntry: null,
    orientationExit: null,
    geometry: "straight",
    progress: 0.5,
    direction: 1,
    blockedPieceId: null,
    targetThrottle: 0,
    velocity: 0,
    speed: 0,
    throttle: 0,
    blocked: "",
    resumeVelocity: 0,
    destination: "",
    cargo: emptyCargo(),
    goals: [],
    goalIndex: 0,
    controlMode: "manual",
    planStatus: "manual",
    route: null,
    blockEvent: false,
    blockedCooldown: 0,
    blockGraceTicks: 0,
    blockStrategy: null,
    stalledTicks: 0,
  };
  setTrainPath(train, 1);
  state.trains.push(train);
  return train;
}

export function setTrainThrottle(train, value) {
  train.targetThrottle = Math.max(-1, Math.min(1, Number(value) || 0));
  train.controlMode = "manual";
  train.planStatus = "manual override";
  if (Math.abs(train.targetThrottle) > 0.03) train.blocked = "";
}

export function appendGoal(train, goal) {
  const normalized = normalizeGoal(goal);
  if (!normalized) return false;
  train.goals.push(normalized);
  return true;
}
export function clearGoals(train) {
  train.goals = [];
  train.goalIndex = 0;
  train.controlMode = "manual";
  train.planStatus = "manual";
}
export function startGoalPlan(train) {
  train.goalIndex = 0;
  train.route = null;
  train.blockEvent = false;
  train.blockedCooldown = 0;
  train.blockGraceTicks = 0;
  train.blockStrategy = null;
  train.controlMode = train.goals.length ? "plan" : "manual";
  train.planStatus = train.goals.length ? "planning" : "manual";
  if (train.controlMode === "plan") processGoal(train);
}

export function beginGoalPlan(train) {
  startGoalPlan(train);
  if (train.controlMode === "plan") processGoal(train);
  return train.controlMode === "plan";
}

export function updateTrains(dt) {
  if (state.mode !== "run") return;
  const claimedTiles = new Set(
    state.trains.map((train) => train.pieceId).filter(Boolean),
  );
  for (const train of state.trains) {
    processGoal(train, dt);
    const desiredVelocity = train.targetThrottle * MAX_SPEED;
    const velocityDelta = desiredVelocity - train.velocity;
    const rate =
      Math.abs(desiredVelocity) > Math.abs(train.velocity)
        ? ACCELERATION
        : BRAKING;
    train.velocity +=
      Math.sign(velocityDelta) * Math.min(Math.abs(velocityDelta), rate * dt);
    train.speed = Math.abs(train.velocity);
    train.throttle = train.targetThrottle;
    if (Math.abs(train.velocity) < 0.01) {
      train.velocity = 0;
      train.speed = 0;
      // Watchdog: a stopped train with pending goals must never sit forever —
      // force a fresh replan attempt periodically, even recovering from a
      // control-mode drop (e.g. a stale "unreachable" determination).
      if (train.blocked && train.goalIndex < train.goals.length) {
        train.stalledTicks = (train.stalledTicks || 0) + 1;
        if (train.stalledTicks > STALL_WATCHDOG_TICKS) {
          train.stalledTicks = 0;
          train.blocked = "";
          train.route = null;
          train.blockEvent = false;
          train.blockedCooldown = 0;
          train.blockGraceTicks = 0;
          train.blockStrategy = null;
          train.controlMode = "plan";
          train.planStatus = "planning";
        }
      } else {
        train.stalledTicks = 0;
      }
      continue;
    }
    train.stalledTicks = 0;
    const requestedDirection =
      Math.abs(train.targetThrottle) >= 0.03
        ? train.targetThrottle > 0
          ? 1
          : -1
        : train.direction;
    if (
      train.direction !== requestedDirection &&
      Math.sign(train.velocity) === requestedDirection
    )
      reverseTrainPath(train);
    if (!train.entry || !train.exit) {
      if (!setTrainPath(train, requestedDirection)) {
        stopTrain(train, "dead end");
        train.velocity = 0;
        train.speed = 0;
        continue;
      }
    }
    let distance = Math.abs(train.velocity) * dt;
    if (!findPiece(train.pieceId)) {
      stopTrain(train, "missing track");
      train.velocity = 0;
      train.speed = 0;
      continue;
    }
    while (Math.abs(distance) > 0 && train.speed > 0.01) {
      const remaining = 1 - train.progress;
      if (distance < remaining) {
        train.progress += distance;
        distance = 0;
        continue;
      }
      distance -= remaining;
      const next = nextPath(train, train.exit, claimedTiles);
      if (!moveToNextPath(train, next, claimedTiles)) {
        train.progress = BLOCKED_STOP_PROGRESS;
        train.velocity = 0;
        train.speed = 0;
        if (
          train.controlMode === "plan" &&
          train.goals[train.goalIndex]?.opcode === "DRIVE"
        )
          advanceGoal(train);
        else if (train.controlMode !== "plan")
          train.planStatus = next ? "blocked" : "unreachable";
        break;
      }
    }
    train.speed = Math.max(0, train.speed);
  }
}

function chooseVisitRoute(
  train,
  destinationId,
  blockedIds,
  allowReverse = false,
) {
  const piece = findPiece(train.pieceId);
  if (!piece) return null;
  const currentDirection = train.direction || 1;
  const forward = findRoute(piece, destinationId, blockedIds, train.entry);
  if (forward)
    return { route: forward, direction: currentDirection, entry: train.entry };
  if (!allowReverse || train.speed > 0.01) return null;
  const reverse = findRoute(piece, destinationId, blockedIds, train.exit);
  return reverse
    ? { route: reverse, direction: currentDirection * -1, entry: train.exit }
    : null;
}
