import { BODY_PART_TYPES, BODY_TYPES, MOTION_TYPES, STATE_FIELDS } from "./constants.js";

export const AQUARIUM_STATE_FILENAME = "/aquarium_state.json";
export const AQUARIUM_STATE_STORAGE_KEY = "openmatrix:aquarium_state.json";

const BYTE_MAX = 255;
const BODY_TYPE_SET = new Set(Object.values(BODY_TYPES));
const HEAD_TYPE_SET = new Set(BODY_PART_TYPES.HEADS);
const TAIL_TYPE_SET = new Set(BODY_PART_TYPES.STATE_TAILS);
const FIN_TYPE_SET = new Set(BODY_PART_TYPES.FINS);
const MOTION_TYPE_SET = new Set(Object.values(MOTION_TYPES));

const clampByte = (value) => Math.max(0, Math.min(BYTE_MAX, Math.round(Number(value) || 0)));
const finiteNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const hasStorageShape = (storage) =>
  storage && typeof storage.getItem === "function" && typeof storage.setItem === "function";

export class MemoryAquariumStateStorage {
  constructor() {
    this.items = new Map();
  }

  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }

  setItem(key, value) {
    this.items.set(key, String(value));
  }

  removeItem(key) {
    this.items.delete(key);
  }
}

export const resolveDefaultStorage = () => {
  const storage = globalThis?.localStorage;
  return hasStorageShape(storage) ? storage : new MemoryAquariumStateStorage();
};

export const canonicalColor = (color = {}) => ({
  [STATE_FIELDS.HUE]: clampByte(color[STATE_FIELDS.HUE] ?? color.hue ?? 0),
  [STATE_FIELDS.SATURATION]: clampByte(color[STATE_FIELDS.SATURATION] ?? color.saturation ?? 0),
  [STATE_FIELDS.VALUE]: clampByte(color[STATE_FIELDS.VALUE] ?? color.value ?? 0),
});

export const canonicalFishDefinition = (rawFish = {}) => {
  const bodyType = rawFish[STATE_FIELDS.BODY_TYPE];
  const headType = rawFish[STATE_FIELDS.HEAD_TYPE];
  const tailType = rawFish[STATE_FIELDS.TAIL_TYPE];
  const finType = rawFish[STATE_FIELDS.FIN_TYPE];
  const motionType = rawFish[STATE_FIELDS.MOTION_TYPE];

  if (
    !BODY_TYPE_SET.has(bodyType) ||
    !HEAD_TYPE_SET.has(headType) ||
    !TAIL_TYPE_SET.has(tailType) ||
    !FIN_TYPE_SET.has(finType) ||
    !MOTION_TYPE_SET.has(motionType)
  ) {
    return null;
  }

  return {
    [STATE_FIELDS.AGE]: finiteNumber(rawFish[STATE_FIELDS.AGE], 0),
    [STATE_FIELDS.HEALTH]: finiteNumber(rawFish[STATE_FIELDS.HEALTH], 1),
    [STATE_FIELDS.BODY_TYPE]: bodyType,
    [STATE_FIELDS.HEAD_TYPE]: headType,
    [STATE_FIELDS.TAIL_TYPE]: tailType,
    [STATE_FIELDS.FIN_TYPE]: finType,
    [STATE_FIELDS.MOTION_TYPE]: motionType,
    [STATE_FIELDS.COLORS]: Array.isArray(rawFish[STATE_FIELDS.COLORS])
      ? rawFish[STATE_FIELDS.COLORS].map((color) => canonicalColor(color))
      : [],
  };
};

export const serializeFishDefinition = (fish) => {
  const raw = typeof fish?.toStateDefinition === "function" ? fish.toStateDefinition() : fish;
  return canonicalFishDefinition(raw);
};

export const serializeAquariumState = (fishSource) => {
  const fishList = Array.isArray(fishSource)
    ? fishSource
    : Array.isArray(fishSource?.fish)
      ? fishSource.fish
      : typeof fishSource?.getStateDefinitions === "function"
        ? fishSource.getStateDefinitions()
        : [];

  return {
    [STATE_FIELDS.ROOT_FISHES]: fishList.map((fish) => serializeFishDefinition(fish)).filter(Boolean),
  };
};

export const parseAquariumState = (stateInput) => {
  let parsed = stateInput;
  if (typeof stateInput === "string") {
    parsed = JSON.parse(stateInput);
  }

  const fishes = parsed?.[STATE_FIELDS.ROOT_FISHES];
  if (!Array.isArray(fishes)) {
    throw new Error("Aquarium state must contain a fishes array");
  }

  const definitions = fishes.map((fish) => canonicalFishDefinition(fish));
  if (definitions.some((definition) => definition === null)) {
    throw new Error("Aquarium state contains an invalid fish definition");
  }

  return {
    [STATE_FIELDS.ROOT_FISHES]: definitions,
  };
};

export class AquariumStateManager {
  constructor({ storage = resolveDefaultStorage(), key = AQUARIUM_STATE_STORAGE_KEY } = {}) {
    this.storage = storage;
    this.key = key;
    this.filename = AQUARIUM_STATE_FILENAME;
    this.storageType = storage instanceof MemoryAquariumStateStorage ? "memory" : "storage";
    this.lastSave = null;
    this.lastLoad = null;
  }

  saveState(fishSource) {
    const state = serializeAquariumState(fishSource);
    const json = JSON.stringify(state);
    this.storage.setItem(this.key, json);
    this.lastSave = {
      ok: json.length > 0,
      length: json.length,
      count: state[STATE_FIELDS.ROOT_FISHES].length,
    };
    return state;
  }

  loadState() {
    const raw = this.storage.getItem(this.key);
    if (!raw) {
      this.lastLoad = { ok: false, reason: "missing" };
      return null;
    }

    try {
      const state = parseAquariumState(raw);
      this.lastLoad = {
        ok: true,
        count: state[STATE_FIELDS.ROOT_FISHES].length,
      };
      return state;
    } catch (error) {
      this.lastLoad = {
        ok: false,
        reason: "invalid",
        message: error.message,
      };
      return null;
    }
  }

  loadFishDefinitions() {
    return this.loadState()?.[STATE_FIELDS.ROOT_FISHES] ?? null;
  }

  clearState() {
    this.storage.removeItem?.(this.key);
  }

  getDebugSnapshot() {
    return {
      state: {
        filename: this.filename,
        storageKey: this.key,
        storageType: this.storageType,
        lastLoad: this.lastLoad,
        lastSave: this.lastSave,
      },
    };
  }
}

export const createAquariumStateManager = (options = {}) => new AquariumStateManager(options);

export default AquariumStateManager;
