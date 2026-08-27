import {
  createPiece,
  getPiece,
  removePiece,
  rotatePiece,
  state,
} from "./state.js";
import { normalizePiece } from "./track-types.js";

export function bindInput(renderer, onChange) {
  let removedAtPointer = false;
  renderer.canvas.addEventListener("click", (event) => {
    const cell = renderer.cellAt(event.clientX, event.clientY);
    const existing = getPiece(cell.x, cell.y);
    if (state.mode === "run") {
      if (existing?.type.startsWith("switch")) {
        existing.switchState =
          existing.switchState === "straight" ? "branch" : "straight";
        normalizePiece(existing);
        onChange(existing);
        renderer.draw();
      }
      return;
    }
    if (existing) {
      rotatePiece(existing);
      onChange(existing);
    } else {
      onChange(createPiece(state.selectedType, cell.x, cell.y));
    }
    renderer.draw();
  });
  renderer.canvas.addEventListener("dblclick", (event) => {
    if (state.mode !== "edit") return;
    const cell = renderer.cellAt(event.clientX, event.clientY),
      piece = getPiece(cell.x, cell.y);
    if (piece?.type === "station") {
      const name = window.prompt("Station name", piece.station.name);
      if (name?.trim()) piece.station.name = name.trim();
      renderer.draw();
    }
  });
  renderer.canvas.addEventListener("pointerdown", (event) => {
    if (state.mode !== "edit" || event.button !== 2) return;
    event.preventDefault();
    const cell = renderer.cellAt(event.clientX, event.clientY);
    if (getPiece(cell.x, cell.y)) {
      removePiece(cell.x, cell.y);
      removedAtPointer = true;
      onChange();
      renderer.draw();
    }
  });
  renderer.canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (state.mode !== "edit" || removedAtPointer) {
      removedAtPointer = false;
      return;
    }
    const cell = renderer.cellAt(event.clientX, event.clientY);
    if (getPiece(cell.x, cell.y)) {
      removePiece(cell.x, cell.y);
      onChange();
      renderer.draw();
    }
  });
}
