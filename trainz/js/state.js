import { TRACK_TYPES, normalizePiece } from "./track-types.js";

export const STATION_COLORS = ["#e53935", "#1e88e5", "#fb8c00", "#00897b", "#d81b60", "#43a047", "#8e24aa", "#795548", "#00acc1", "#757575"];
export const state = { pieces: new Map(), trains: [], mode: "edit", selectedType: "straight", selectedRotation: 0, nextPieceId: 1, nextTrainId: 1, stationCounter: 1, stationColors: STATION_COLORS };
export function createPiece(type, x, y, rotation = state.selectedRotation) { const piece = { id: "piece-" + state.nextPieceId++, type, gridX: x, gridY: y, rotation, switchState: type.startsWith("switch") ? "straight" : null, station: type === "station" ? { id: "station-" + state.stationCounter, name: "Station " + state.stationCounter, side: "N", color: STATION_COLORS[(state.stationCounter - 1) % STATION_COLORS.length] } : null }; if (piece.station) state.stationCounter++; normalizePiece(piece); state.pieces.set(x + ":" + y, piece); return piece; }
export function getPiece(x, y) { return state.pieces.get(x + ":" + y); }
export function removePiece(x, y) { state.pieces.delete(x + ":" + y); }
export function rotatePiece(piece) { piece.rotation = (piece.rotation + 90) % 360; return normalizePiece(piece); }
export function createTrain(piece) { const train = { id: "train-" + (state.trains.length + 1), color: state.stationColors[state.trains.length % state.stationColors.length], pieceId: piece?.id || null, progress: 0, throttle: 0, direction: 1, destination: "" }; state.trains.push(train); return train; }
export { TRACK_TYPES };
