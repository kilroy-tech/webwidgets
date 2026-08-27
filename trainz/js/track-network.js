import { getPiece } from "./state.js";
import { getAllSwitchPaths, getPiecePaths, opposite } from "./track-types.js";

const offsets = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

function pathsForTopology(piece) {
  if (!piece.type.startsWith("switch")) return getPiecePaths(piece);
  const seen = new Set();
  return getAllSwitchPaths(piece).filter(([from, to, geometry]) => {
    const key = [from, to, geometry].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function neighbors(piece, entry) {
  const paths = pathsForTopology(piece).filter(
    ([from, to]) => from === entry || to === entry,
  );
  return paths.flatMap(([from, to]) => {
    const exit = from === entry ? to : from;
    if (!exit || !offsets[exit]) return [];
    const [dx, dy] = offsets[exit];
    const nextPiece = getPiece(piece.gridX + dx, piece.gridY + dy);
    if (
      !nextPiece ||
      !pathsForTopology(nextPiece).some(
        ([nextFrom, nextTo]) =>
          nextFrom === opposite(exit) || nextTo === opposite(exit),
      )
    )
      return [];
    return [{ piece: nextPiece, exit, entry: opposite(exit) }];
  });
}

// A currently-unblocked repositioning target, chosen at random among reachable
// candidates: a deadlocked train uses this to clear the contested tile so a
// later replan can find a real route. Randomized (rather than always picking
// the farthest tile) so two trains repeatedly out-planning each other don't
// keep converging on the same spot and cycling forever.
export function findEscapeRoute(
  startPiece,
  startEntry,
  blockedIds = new Set(),
) {
  if (!startPiece) return null;
  const queue = [{ piece: startPiece, entry: startEntry, steps: [] }];
  const visited = new Set([startPiece.id + "|" + (startEntry || "*")]);
  const candidates = [];
  while (queue.length) {
    const current = queue.shift();
    if (current.steps.length && !blockedIds.has(current.piece.id)) {
      candidates.push(current);
    }
    const exits = current.entry
      ? neighbors(current.piece, current.entry)
      : pathsForTopology(current.piece)
          .flatMap(([from, to]) =>
            [from, to]
              .filter(Boolean)
              .map((entry) => neighbors(current.piece, entry)),
          )
          .flat();
    for (const next of exits) {
      if (blockedIds.has(next.piece.id)) continue;
      const key = next.piece.id + "|" + next.entry;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({
        piece: next.piece,
        entry: next.entry,
        steps: [
          ...current.steps,
          {
            from: current.piece,
            to: next.piece,
            exit: next.exit,
            entry: next.entry,
          },
        ],
      });
    }
  }
  if (!candidates.length) return null;
  // Prefer clearing at least 2 tiles (one alone tends to put the train right
  // back in contact as soon as it re-approaches) but pick from the *nearest*
  // couple of candidates that satisfy that, not the whole remaining range —
  // otherwise, in a long single-track corridor, "farther" can mean the entire
  // opposite end, causing full-length shuttling instead of a modest step back.
  const sorted = [...candidates].sort(
    (a, b) => a.steps.length - b.steps.length,
  );
  const minDesired = Math.min(2, sorted[sorted.length - 1].steps.length);
  const eligible = sorted.filter((c) => c.steps.length >= minDesired);
  const pool = (eligible.length ? eligible : sorted).slice(0, 2);
  return pool[Math.floor(Math.random() * pool.length)].steps;
}

export function findRoute(
  startPiece,
  destinationId,
  blockedIds = new Set(),
  startEntry = null,
) {
  if (!startPiece) return null;
  const queue = [{ piece: startPiece, entry: startEntry, steps: [] }];
  const visited = new Set([startPiece.id + "|" + (startEntry || "*")]);
  while (queue.length) {
    const current = queue.shift();
    if (current.piece.station?.id === destinationId) return current.steps;
    const exits = current.entry
      ? neighbors(current.piece, current.entry)
      : pathsForTopology(current.piece)
          .flatMap(([from, to]) =>
            [from, to]
              .filter(Boolean)
              .map((entry) => neighbors(current.piece, entry)),
          )
          .flat();
    for (const next of exits) {
      if (
        blockedIds.has(next.piece.id) &&
        next.piece.station?.id !== destinationId
      )
        continue;
      const key = next.piece.id + "|" + next.entry;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({
        piece: next.piece,
        entry: next.entry,
        steps: [
          ...current.steps,
          {
            from: current.piece,
            to: next.piece,
            exit: next.exit,
            entry: next.entry,
          },
        ],
      });
    }
  }
  return null;
}
