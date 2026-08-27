import { normalizePiece } from "./track-types.js";
import { state, STATION_COLORS } from "./state.js";
import { emptyInventory } from "./resources.js";
import { resetEconomyClock } from "./resources.js";

const supportedTypes = new Set([
  "straight",
  "curve",
  "doubleCurve",
  "intersection",
  "switchLeft",
  "switchRight",
  "deadEnd",
  "station",
]);

export function exportLayout() {
  const payload = {
    format: "trainz-layout",
    version: 1,
    pieces: [...state.pieces.values()].map((piece) => ({
      type: piece.type,
      gridX: piece.gridX,
      gridY: piece.gridY,
      rotation: piece.rotation,
      switchState: piece.switchState,
      station: piece.station
        ? {
            id: piece.station.id,
            name: piece.station.name,
            side: piece.station.side,
          }
        : null,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "trainz-layout.json";
  link.click();
  URL.revokeObjectURL(url);
}

export function importLayout(text) {
  const payload = JSON.parse(text);
  if (
    !payload ||
    payload.format !== "trainz-layout" ||
    !Array.isArray(payload.pieces)
  ) {
    throw new Error("This is not a valid Trainz layout file.");
  }
  const pieces = payload.pieces.filter(
    (piece) =>
      supportedTypes.has(piece.type) &&
      Number.isInteger(piece.gridX) &&
      Number.isInteger(piece.gridY),
  );
  if (pieces.length !== payload.pieces.length)
    throw new Error("The layout contains unsupported or invalid track pieces.");
  state.pieces.clear();
  state.trains.length = 0;
  state.nextPieceId = 1;
  state.nextTrainId = 1;
  state.stationCounter = 1;
  resetEconomyClock(state);
  for (const data of pieces) {
    const stationNumber =
      Number(String(data.station?.name || "").match(/(\d+)$/)?.[1]) ||
      state.stationCounter;
    const piece = {
      id: "piece-" + state.nextPieceId++,
      type: data.type,
      gridX: data.gridX,
      gridY: data.gridY,
      rotation: (((Number(data.rotation) || 0) % 360) + 360) % 360,
      switchState: data.type.startsWith("switch")
        ? data.switchState === "branch"
          ? "branch"
          : "straight"
        : null,
      station:
        data.type === "station"
          ? {
              id: data.station?.id || "station-" + stationNumber,
              name: data.station?.name || "Station " + stationNumber,
              side: data.station?.side || "N",
              color:
                STATION_COLORS[(stationNumber - 1) % STATION_COLORS.length],
              inventory: emptyInventory(),
              production: [],
              consumption: [],
            }
          : null,
    };
    if (piece.station)
      state.stationCounter = Math.max(state.stationCounter, stationNumber + 1);
    normalizePiece(piece);
    state.pieces.set(piece.gridX + ":" + piece.gridY, piece);
  }
}
