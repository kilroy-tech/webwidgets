import { state } from "./state.js";

export function handleTrainCommand({ command, argument }) {
  if (command === "stop") state.trains.forEach((train) => { train.throttle = 0; });
  if (command === "throttle") { const value = Math.max(0, Math.min(1, Number(argument))); state.trains.forEach((train) => { train.throttle = Number.isFinite(value) ? value : train.throttle; }); }
  if (command === "route") state.trains.forEach((train) => { train.destination = argument.trim(); });
}
