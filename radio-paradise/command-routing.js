export function playerAcceptsTarget(playerId, targetId) {
  const configuredId = String(playerId || "").trim().toLowerCase();
  const requestedId = String(targetId || "").trim().toLowerCase();
  return !configuredId || configuredId === "*" || requestedId === configuredId;
}