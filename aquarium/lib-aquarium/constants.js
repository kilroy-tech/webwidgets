const freeze = Object.freeze;

export const PANEL_MODE_IDS = freeze({
  ORIGINAL_64: "64x64-original",
  DEVICE_64X85: "64x85-device",
  DEVICE_80X106: "80x106-device",
  DEVICE_96X128: "96x128-device",
});

export const PANEL_MODES = freeze({
  [PANEL_MODE_IDS.ORIGINAL_64]: freeze({
    id: PANEL_MODE_IDS.ORIGINAL_64,
    logicalWidth: 64,
    logicalHeight: 64,
    originalWidth: 64,
    originalHeight: 64,
    source: "lib/Matrix/Original/OMatrixSettings.h",
    purpose: "original-fidelity",
  }),
  [PANEL_MODE_IDS.DEVICE_64X85]: freeze({
    id: PANEL_MODE_IDS.DEVICE_64X85,
    logicalWidth: 64,
    logicalHeight: 85,
    physicalWidth: 240,
    physicalHeight: 320,
    source: "ESP32-2432S028R portrait adaptation",
    purpose: "device-preview",
  }),
  [PANEL_MODE_IDS.DEVICE_80X106]: freeze({
    id: PANEL_MODE_IDS.DEVICE_80X106,
    logicalWidth: 80,
    logicalHeight: 106,
    physicalWidth: 240,
    physicalHeight: 320,
    source: "ESP32-2432S028R portrait medium-density preview",
    purpose: "device-preview-experiment",
  }),
  [PANEL_MODE_IDS.DEVICE_96X128]: freeze({
    id: PANEL_MODE_IDS.DEVICE_96X128,
    logicalWidth: 96,
    logicalHeight: 128,
    physicalWidth: 240,
    physicalHeight: 320,
    source: "ESP32-2432S028R portrait high-density preview",
    purpose: "device-preview-experiment",
  }),
});

export const DEFAULT_PANEL_MODE_ID = PANEL_MODE_IDS.DEVICE_80X106;

export const ORIGINAL_MATRIX = freeze({
  PANEL_RES_X: 64,
  PANEL_RES_Y: 64,
  PANEL_CHAIN: 1,
});

export const UPCYCLED_MATRIX = freeze({
  PANEL_RES_X: 78,
  PANEL_RES_Y: 78,
});

export const ENVIRONMENT = freeze({
  NORMAL_TEMPERATURE_C: 22,
  NORMAL_TEMPERATURE_F: 71.6,
  NORMAL_CO2_PPM: 420,
  NORMAL_HUMIDITY_PERCENT: 50,
});

export const CO2_THRESHOLDS = freeze({
  CO2_OK: 600,
  CO2_BAD: 1000,
  CO2_REALBAD: 2000,
});

export const AQUARIUM = freeze({
  PHYSICS_SCALE: 80,
  PHYSICS_SCALE_UPCYCLED: 50,
  AQUARIUM_SAVE_INTERVAL_MINUTES: 30,
  BORDER_BUFFER: 0,
  FOOD_INTERVAL_MS: 200,
  NUM_FISH_START: 5,
  NUM_FISH_IDEAL: 20,
  NUM_PLANTS: 3,
});

export const AGE = freeze({
  FISH_LIFESPAN_DAYS: 7.0,
  FISH_LIFESPAN_VARIATION: 1.0,
  AGE_EGG: 0.1,
  AGE_CHILD: 0.3,
  AGE_TEEN: 0.5,
  AGE_ADULT: 0.7,
  AGE_SENIOR: 0.9,
  AGE_DEAD: 1.0,
});

export const HEALTH = freeze({
  HEALTH_REDUCTION_RATE_BAD: 0.1,
  HEALTH_REDUCTION_RATE_REALBAD: 0.2,
  HEALTH_INCREASE_RATE_GOOD: 0.05,
});

export const FORCES = freeze({
  MAX_FORCE: 3,
  FOOD_FORCE: 6,
  BOUNDARY_FORCE: 0.2,
});

export const EGG = freeze({
  EGG_SIZE: 1,
  EGG_COLOR: freeze({ r: 0, g: 0, b: 200 }),
});

export const RANDOM_RANGE_SEMANTICS = freeze({
  minInclusive: true,
  maxExclusive: true,
});

export const randomRange = (min, maxExclusive) => freeze({ min, maxExclusive });

export const BODY_TYPES = freeze({
  FISH: "Fish",
  TURTLE: "Turtle",
  STAR: "Star",
  SNAKE: "Snake",
  OCTOPUS: "Octopus",
});

export const MOTION_TYPES = freeze({
  FISH: "Fish",
  TURTLE: "Turtle",
  STAR: "Star",
  SNAKE: "Snake",
  OCTOPUS: "Octopus",
});

export const BODY_PART_TYPES = freeze({
  HEADS: freeze(["TriangleHead", "FrogHead", "NeedleHead"]),
  RANDOM_TAILS: freeze(["TriangleTail", "CurvyTail", "WavyTail"]),
  STATE_TAILS: freeze(["noTail", "TriangleTail", "CurvyTail", "WavyTail"]),
  FINS: freeze(["TriangleFin", "EllipseFin", "LegFin", "RoundFin"]),
});

export const FISH_TYPE_SELECTION = freeze([
  freeze({ bodyType: BODY_TYPES.FISH, motionType: MOTION_TYPES.FISH, probability: 0.5 }),
  freeze({ bodyType: BODY_TYPES.STAR, motionType: MOTION_TYPES.STAR, probability: 0.1 }),
  freeze({ bodyType: BODY_TYPES.TURTLE, motionType: MOTION_TYPES.TURTLE, probability: 0.2 }),
  freeze({ bodyType: BODY_TYPES.SNAKE, motionType: MOTION_TYPES.SNAKE, probability: 0.1 }),
  freeze({ bodyType: BODY_TYPES.OCTOPUS, motionType: MOTION_TYPES.OCTOPUS, probability: 0.1 }),
]);

export const FISH_LIFECYCLE = freeze({
  INITIAL_RANDOM_AGE: 0.5,
});

export const BREEDING = freeze({
  INTERVAL_MINUTES: 10,
  // Fractions of a fish's lifespan, so parents must be past the egg stage but
  // not yet senior.
  PARENT_MIN_AGE: 0.1,
  PARENT_MAX_AGE: 0.9,
});

export const FISH_BODY = freeze({
  NUM_SEGMENTS: randomRange(4, 12),
  MIN_SEGMENT_SIZE: 2.0,
  MAX_SEGMENT_SIZE: randomRange(2, 6),
  GAP_BETWEEN_SEGMENTS_PERCENT: randomRange(70, 100),
  NEEDLE_NOSE_LENGTH_MULTIPLIER: randomRange(2, 6),
});

export const SNAKE_BODY = freeze({
  NUM_SEGMENTS: randomRange(8, 60),
});

export const STAR_BODY = freeze({
  LENGTH: randomRange(4, 6),
  RAD: randomRange(2, 4),
  NUM_ARMS: randomRange(5, 10),
  ROTATION_SPEED: randomRange(5, 10),
  ROTATION_SPEED_DIVISOR: 1000.0,
  NODE_STYLE_RANGE: randomRange(0, 2),
});

export const TURTLE_BODY = freeze({
  LENGTH: randomRange(4, 10),
  WIDTH: randomRange(2, 4),
});

export const OCTOPUS_BODY = freeze({
  SIZE: randomRange(10, 20),
  MIN_TENTACLES: 6,
  MAX_TENTACLES: 10,
  TENTACLE_SEGMENTS: 6,
  TENTACLE_LENGTH: randomRange(10, 25),
});

export const MOTION_INITIAL_VELOCITY = freeze({
  COMPONENT: randomRange(-10, 10),
  RETRY_WHILE_MAG_BELOW: 5,
});

export const MOTION_PROFILES = freeze({
  [MOTION_TYPES.FISH]: freeze({
    MAX_SPEED: 30,
    MIN_SPEED: 10,
    MAX_FORCE: 0.3,
    SIN_AMPLITUDE: 2,
    SIN_FREQUENCY: 0.002,
    NOISE_AMPLITUDE: 6,
    NOISE_FREQUENCY: 0.01,
    DO_MOTION: freeze(["sideSineMotion", "noiseMotion"]),
  }),
  [MOTION_TYPES.SNAKE]: freeze({
    MAX_SPEED: 40,
    MIN_SPEED: 20,
    MAX_FORCE: 0.3,
    SIN_AMPLITUDE: 5,
    SIN_FREQUENCY: 0.005,
    NOISE_AMPLITUDE: 6,
    NOISE_FREQUENCY: 0.01,
    DO_MOTION: freeze(["sideSineMotion", "noiseMotion"]),
  }),
  [MOTION_TYPES.STAR]: freeze({
    MAX_SPEED: 30,
    MIN_SPEED: 10,
    MAX_FORCE: 0.2,
    SIN_AMPLITUDE: 5,
    SIN_FREQUENCY: 0.005,
    NOISE_AMPLITUDE: 2,
    NOISE_FREQUENCY: 0.01,
    DO_MOTION: freeze(["frontSineMotion", "noiseMotion"]),
  }),
  [MOTION_TYPES.TURTLE]: freeze({
    MAX_SPEED: 40,
    MIN_SPEED: 5,
    MAX_FORCE: 0.3,
    SIN_AMPLITUDE: 10,
    SIN_FREQUENCY: 0.001,
    NOISE_AMPLITUDE: 1,
    NOISE_FREQUENCY: 0.01,
    DO_MOTION: freeze(["frontSineMotion", "noiseMotion"]),
  }),
  [MOTION_TYPES.OCTOPUS]: freeze({
    MAX_SPEED: 35,
    MIN_SPEED: 5,
    MAX_FORCE: 0.25,
    SIN_AMPLITUDE: 8,
    SIN_FREQUENCY: 0.002,
    NOISE_AMPLITUDE: 0.1,
    NOISE_FREQUENCY: 0.01,
    DO_MOTION: freeze(["frontSineMotion"]),
  }),
});

export const COLOR_PALETTE = freeze({
  BASE_HUE: randomRange(0, 256),
  HUE_STEP: randomRange(5, 31),
  INITIAL_SATURATION: 130,
  INITIAL_VALUE: 255,
  HEALTH_SATURATION_MULTIPLIER: 115,
  AGE_VALUE_MULTIPLIER: 255,
  STRIPE_SWAP_TYPE: randomRange(0, 4),
  STRIPE_HUE_SHIFT_A: 85,
  STRIPE_HUE_SHIFT_B: 170,
});

export const FOOD = freeze({
  FALL_SPEED: 0.3,
  SPAWN_Y: 0,
  COLOR: freeze({ r: 255, g: 255, b: 0 }),
  EATEN_DISTANCE: 1,
  INTERVAL_MS: AQUARIUM.FOOD_INTERVAL_MS,
});

export const PLANTS = freeze({
  COUNT: AQUARIUM.NUM_PLANTS,
  BRANCH_COUNT: randomRange(10, 16),
  BRANCH_SIZE_BASE: 3,
  BRANCH_START_ANGLE_SCALE: 1000,
  PHASE_OFFSET: randomRange(0, 500),
  PHASE_OFFSET_DIVISOR: 100.0,
  NODE_COUNT: randomRange(4, 9),
  TARGET_DIRECTION_RADIANS: (3 * Math.PI) / 2,
  CURVATURE_FRACTION: 0.5,
  HUMIDITY_INPUT_MIN: 0,
  HUMIDITY_INPUT_MAX: 100,
  HUMIDITY_OUTPUT_MIN: 0,
  HUMIDITY_OUTPUT_MAX: 250,
  HUMIDITY_OUTPUT_DIVISOR: 100,
  SWAY_AMPLITUDE_PER_NODE: 0.8,
  SWAY_PERIOD_DIVISOR_MS: 10000.0,
  GLOW_GATE: 0.8,
  GLOW_SCALE: 1000,
  BASE_Y_OFFSET: 7,
});

export const WATER = freeze({
  ROWS_PER_UPDATE: 8,
  NOISE_SCALE: 20,
  SIMPLEX_SPEED: 0.002,
  TEMPERATURE_MIN_C: 10,
  TEMPERATURE_MAX_C: 35,
  RED_CAP_THRESHOLD_C: 34,
  PALETTE_CAP_BELOW_RED: 235,
  MIN_NOISE_FACTOR: 96,
  PALETTE: freeze([
    freeze({ r: 0, g: 28, b: 72 }),
    freeze({ r: 0, g: 32, b: 80 }),
    freeze({ r: 0, g: 40, b: 88 }),
    freeze({ r: 0, g: 52, b: 96 }),
    freeze({ r: 0, g: 64, b: 96 }),
    freeze({ r: 0, g: 84, b: 92 }),
    freeze({ r: 0, g: 96, b: 86 }),
    freeze({ r: 0, g: 100, b: 80 }),
    freeze({ r: 0, g: 100, b: 80 }),
    freeze({ r: 12, g: 96, b: 72 }),
    freeze({ r: 28, g: 88, b: 56 }),
    freeze({ r: 56, g: 76, b: 36 }),
    freeze({ r: 80, g: 60, b: 20 }),
    freeze({ r: 96, g: 36, b: 12 }),
    freeze({ r: 100, g: 16, b: 8 }),
    freeze({ r: 100, g: 0, b: 0 }),
  ]),
});

export const BOIDS = freeze({
  GROUPS: 2,
  NUM_BOIDS: randomRange(10, 20),
  MAX_SPEED: randomRange(4, 8),
  MAX_SPEED_UPCYCLED: randomRange(5, 10),
  MAX_FORCE: randomRange(1, 2),
  AVAILABLE_BOID_COUNT: 40,
  DEFAULT_MAX_SPEED: 1.5,
  DEFAULT_MAX_FORCE: 0.05,
  DEFAULT_DESIRED_SEPARATION: 4,
  DEFAULT_NEIGHBOR_DISTANCE: 8,
  DEFAULT_MASS: 1.0,
  SEPARATION_MULTIPLIER: 1.5,
  ALIGNMENT_MULTIPLIER: 1.0,
  COHESION_MULTIPLIER: 1.0,
  RENDER_COLOR: freeze({ r: 50, g: 200, b: 100 }),
  UNUSED_SETTINGS: freeze({
    FLOCK_MAX_FORCE: 0.8,
    SEPARATION_DISTANCE: 20,
    ALIGNMENT_DISTANCE: 30,
    COHESION_DISTANCE: 30,
    SEPARATION_WEIGHT: 0.3,
    ALIGNMENT_WEIGHT: 1.0,
    COHESION_WEIGHT: 0.2,
  }),
});

export const STATE_FIELDS = freeze({
  ROOT_FISHES: "fishes",
  AGE: "age",
  HEALTH: "health",
  BODY_TYPE: "bodyType",
  HEAD_TYPE: "headType",
  TAIL_TYPE: "tailType",
  FIN_TYPE: "finType",
  MOTION_TYPE: "motionType",
  COLORS: "colors",
  HUE: "h",
  SATURATION: "s",
  VALUE: "v",
});

export const ENGINE_UPDATE_ORDER = freeze([
  "handleTouchInput",
  "assignFood",
  "updateWater",
  "updateBoids",
  "renderBoids",
  "updateFish",
  "updateFood",
  "updatePlants",
]);

export const PRESENTATION_ORDER = freeze([
  "compositeLayers",
  "clearForeground",
  "presentToCanvas",
]);

export const UPDATE_ORDER = freeze([...ENGINE_UPDATE_ORDER, ...PRESENTATION_ORDER]);

export const SOURCE_ODDITIES = freeze({
  LEG_FIN_TYPE_MISSING: true,
  FISH_HEAD_DISPLAY_ARGUMENT_SHIFT: true,
  FISH_AGE_RESET_PREVENTS_DESTROY_RETURN: true,
  STRIPE_RANDOM_CASES_2_AND_3_DO_NOT_SHIFT: true,
  FOOD_FOLLOWING_APPLIES_NEXT_FRAME: true,
  BODY_SEGMENT_LOOP_CLAMPED_FOR_JS: true,
  FASTLED_RAINBOW_APPROXIMATION: true,
  FASTNOISE_MOTION_APPROXIMATION: true,
  MOTION_DUPLICATE_FOLLOW_FOOD_BRANCH: true,
});
