import { getPiece, state } from "./state.js";
import { getPiecePaths, getSwitchRoutes, normalizePiece, opposite } from "./track-types.js";

const MAX_SPEED = 1.35;
const ACCELERATION = 2.2;
const BRAKING = 3.4;
const MIN_PROGRESS = 0.001;

function pathForTrain(train) {
  const piece = findPiece(train.pieceId);
  if (!piece) return null;
  const paths = getPiecePaths(piece);
  return paths[train.pathIndex] || paths[0] || null;
}

function findPiece(pieceId) {
  return [...state.pieces.values()].find((piece) => piece.id === pieceId) || null;
}

function directionOffset(direction) {
  return { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[direction];
}

function selectSwitchRouteForEntry(piece, entry) {
  if (!piece.type.startsWith("switch")) return;
  const routes = getSwitchRoutes(piece);
  const selectedPath = routes[piece.switchState || "straight"]?.[0];
  if (selectedPath?.includes(entry)) return;
  const incomingRoute = Object.entries(routes).find(([, paths]) => paths.some(([from, to]) => from === entry || to === entry));
  if (incomingRoute) {
    piece.switchState = incomingRoute[0];
    normalizePiece(piece);
  }
}

function nextPath(train, exitDirection) {
  if (!exitDirection) return null;
  const offset = directionOffset(exitDirection);
  if (!offset) return null;
  const nextPiece = getPiece(train.gridX + offset[0], train.gridY + offset[1]);
  if (!nextPiece || nextPiece.type === "deadEnd") return null;
  const entry = opposite(exitDirection);
  selectSwitchRouteForEntry(nextPiece, entry);
  const paths = getPiecePaths(nextPiece);
  const pathIndex = paths.findIndex(([from, to]) => from === entry || to === entry);
  if (pathIndex < 0) return null;
  const path = paths[pathIndex];
  const nextExit = path[0] === entry ? path[1] : path[0];
  if (!nextExit) return null;
  return { piece: nextPiece, pathIndex, entry, exit: nextExit, geometry: path[2] };
}

function stopTrain(train, reason, preserveThrottle = false) {
  if (!preserveThrottle) train.targetThrottle = 0;
  train.blocked = reason;
}

function moveToNextPath(train, path, claimedTiles) {
  if (!path || claimedTiles.has(path.piece.id)) {
    stopTrain(train, path ? "another train" : "blocked track", Boolean(path));
    if (path) train.resumeVelocity = train.resumeVelocity || train.velocity;
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
    train.velocity = Math.sign(train.targetThrottle || train.direction) * train.resumeVelocity;
    train.resumeVelocity = 0;
  }
  train.blocked = "";
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

export function addTrain(piece) {
  if (!piece) return null;
  const train = {
    id: "train-" + (state.trains.length + 1), color: state.stationColors[state.trains.length % state.stationColors.length], pieceId: piece.id, gridX: piece.gridX, gridY: piece.gridY,
    pathIndex: 0, entry: null, exit: null, orientationEntry: null, orientationExit: null, geometry: "straight", progress: 0.5, direction: 1,
    targetThrottle: 0, velocity: 0, speed: 0, throttle: 0, blocked: "", resumeVelocity: 0, destination: ""
  };
  setTrainPath(train, 1);
  state.trains.push(train);
  return train;
}

export function setTrainThrottle(train, value) {
  train.targetThrottle = Math.max(-1, Math.min(1, Number(value) || 0));
  if (Math.abs(train.targetThrottle) > 0.03) train.blocked = "";
}

export function updateTrains(dt) {
  if (state.mode !== "run") return;
  const claimedTiles = new Set(state.trains.map((train) => train.pieceId).filter(Boolean));
  for (const train of state.trains) {
    const desiredVelocity = train.targetThrottle * MAX_SPEED;
    const velocityDelta = desiredVelocity - train.velocity;
    const rate = Math.abs(desiredVelocity) > Math.abs(train.velocity) ? ACCELERATION : BRAKING;
    train.velocity += Math.sign(velocityDelta) * Math.min(Math.abs(velocityDelta), rate * dt);
    train.speed = Math.abs(train.velocity);
    train.throttle = train.targetThrottle;
    if (Math.abs(train.velocity) < 0.01) { train.velocity = 0; train.speed = 0; continue; }
    const requestedDirection = Math.abs(train.targetThrottle) >= 0.03 ? (train.targetThrottle > 0 ? 1 : -1) : train.direction;
    if (train.direction !== requestedDirection) reverseTrainPath(train);
    if (!train.entry || !train.exit) {
      if (!setTrainPath(train, requestedDirection)) { stopTrain(train, "dead end"); train.velocity = 0; train.speed = 0; continue; }
    }
    let distance = Math.abs(train.velocity) * dt;
    if (!findPiece(train.pieceId)) { stopTrain(train, "missing track"); train.velocity = 0; train.speed = 0; continue; }
    while (Math.abs(distance) > 0 && train.speed > 0.01) {
      const remaining = 1 - train.progress;
      if (distance < remaining) { train.progress += distance; distance = 0; continue; }
      distance -= remaining;
      const next = nextPath(train, train.exit);
      if (!moveToNextPath(train, next, claimedTiles)) { train.progress = .985; train.velocity = 0; train.speed = 0; break; }
    }
    train.speed = Math.max(0, train.speed);
  }
}
