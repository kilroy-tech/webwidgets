export function parseSeed(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return (Math.trunc(number) >>> 0) || 1;
}

export function createBattleSeed(randomValue = Math.random(), timestamp = Date.now()) {
  const randomBits = Math.floor(randomValue * 0x100000000) >>> 0;
  return ((randomBits ^ (Math.trunc(timestamp) >>> 0)) >>> 0) || 1;
}