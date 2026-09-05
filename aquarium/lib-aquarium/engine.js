import { DEFAULT_PANEL_MODE_ID, ENGINE_UPDATE_ORDER, PANEL_MODES } from "./constants.js";
import { createBoidManager } from "./boid-manager.js";
import { createFixedEnvironment, normalizeFixedEnvironment } from "./environment.js";
import { createAquariumFishManager } from "./fish.js";
import { createAquariumFoodManager } from "./food.js";
import { createAquariumPlants } from "./plants.js";
import { createAquariumStateManager } from "./state.js";
import { createAquariumWater } from "./water.js";

const getMode = (modeId = DEFAULT_PANEL_MODE_ID) => {
  const mode = PANEL_MODES[modeId];
  if (!mode) {
    throw new Error(`Unknown aquarium panel mode: ${modeId}`);
  }
  return mode;
};

const arraysEqual = (left = [], right = []) => left.length === right.length && left.every((item, index) => item === right[index]);

export class AquariumEngine {
  constructor(options = {}) {
    this.mode = options.mode ?? getMode(options.modeId);
    this.environment = normalizeFixedEnvironment(options.environment);
    this.water = createAquariumWater({
      width: this.mode.logicalWidth,
      height: this.mode.logicalHeight,
    });
    this.boidManager = createBoidManager({
      width: this.mode.logicalWidth,
      height: this.mode.logicalHeight,
    });
    this.food = createAquariumFoodManager({
      width: this.mode.logicalWidth,
      height: this.mode.logicalHeight,
    });
    this.stateManager = options.stateManager ?? createAquariumStateManager(options.state ?? {});
    const stateLoadAttempted = !options.disableStateLoad;
    const providedDefinitions = Array.isArray(options.fishDefinitions) ? options.fishDefinitions : null;
    const fishDefinitions = providedDefinitions ?? (stateLoadAttempted ? this.stateManager.loadFishDefinitions() : null);
    this.fish = createAquariumFishManager({
      width: this.mode.logicalWidth,
      height: this.mode.logicalHeight,
      definitions: fishDefinitions ?? undefined,
      initialCount: options.initialFishCount,
      idealCount: options.idealFishCount,
      breedIntervalMinutes: options.breedIntervalMinutes,
      lastBreedTime: options.lastBreedTime,
    });
    this.plants = createAquariumPlants({
      width: this.mode.logicalWidth,
      height: this.mode.logicalHeight,
    });
    this.frameCount = 0;
    this.lastUpdate = null;
    this.lastUpdateOrder = [];
    this.lastSaveTime = 0;
    this.startupDebug = {
      stateLoadAttempted,
      stateLoaded: Boolean(fishDefinitions),
      fallbackInitialized: !fishDefinitions,
      initialFishCount: this.fish.fish.length,
      plantCount: this.plants.plants.length,
      boidGroups: this.boidManager.boidGroups.length,
    };
  }

  resize({ mode = this.mode, environment = this.environment } = {}) {
    this.mode = mode;
    this.environment = normalizeFixedEnvironment(environment);
    this.water.resize(mode.logicalWidth, mode.logicalHeight);
    this.boidManager.resize(mode.logicalWidth, mode.logicalHeight);
    this.food.resize(mode.logicalWidth, mode.logicalHeight);
    this.fish.resize(mode.logicalWidth, mode.logicalHeight);
    this.plants.resize(mode.logicalWidth, mode.logicalHeight);
  }

  update({ now = 0, delta = 0, framebuffer, environment = this.environment } = {}) {
    const updateOrder = [];
    const record = (step) => updateOrder.push(step);

    this.environment = normalizeFixedEnvironment(environment);
    record("handleTouchInput");
    this.food.handleTouchInput(now);
    record("assignFood");
    this.fish.assignFood(this.food.takeUnassignedFood());
    record("updateWater");
    const waterSnapshot = this.water.update({
      framebuffer,
      temperatureC: this.environment.temperatureC,
      now,
    });
    record("updateBoids");
    const boidsSnapshot = this.boidManager.updateBoids(this.environment.co2Ppm);
    record("renderBoids");
    this.boidManager.renderBoids(framebuffer);
    record("updateFish");
    const fishSnapshot = this.fish.update({
      framebuffer,
      co2: this.environment.co2Ppm,
      now,
    });
    record("updateFood");
    const foodSnapshot = this.food.update({
      framebuffer,
    });
    record("updatePlants");
    const plantsSnapshot = this.plants.update({
      framebuffer,
      humidityPercent: this.environment.humidityPercent,
      now,
    });

    this.frameCount += 1;
    this.lastUpdateOrder = updateOrder;
    this.lastUpdate = {
      now,
      delta,
      frameCount: this.frameCount,
      startup: this.startupDebug,
      updateOrder: {
        engine: updateOrder,
        expectedEngine: [...ENGINE_UPDATE_ORDER],
        engineMatchesExpected: arraysEqual(updateOrder, ENGINE_UPDATE_ORDER),
      },
      ...waterSnapshot,
      ...boidsSnapshot,
      ...fishSnapshot,
      ...foodSnapshot,
      ...plantsSnapshot,
      ...this.stateManager.getDebugSnapshot(),
    };
  }

  setBreedIntervalMinutes(minutes) {
    return this.fish.setBreedIntervalMinutes(minutes);
  }

  getFishDefinitions() {
    return this.fish.getStateDefinitions();
  }

  getLastBreedTime() {
    return this.fish.lastBreedTime;
  }

  saveState() {
    return this.stateManager.saveState(this.fish);
  }

  loadState() {
    const definitions = this.stateManager.loadFishDefinitions();
    if (definitions) {
      this.fish.loadStateDefinitions(definitions);
    }
    return definitions;
  }

  onTouchStarted({ point = null, now = 0 } = {}) {
    this.food.onTouchStarted({ point, now });
  }

  onTouchReleased() {
    this.food.onTouchReleased();
  }

  display() {}

  getDebugSnapshot() {
    return {
      engineType: "AquariumEngine",
      frameCount: this.frameCount,
      environment: createFixedEnvironment(),
      startup: this.startupDebug,
      updateOrder: {
        engine: this.lastUpdateOrder,
        expectedEngine: [...ENGINE_UPDATE_ORDER],
        engineMatchesExpected: arraysEqual(this.lastUpdateOrder, ENGINE_UPDATE_ORDER),
      },
      ...(this.lastUpdate ?? this.water.getDebugSnapshot()),
      ...this.stateManager.getDebugSnapshot(),
    };
  }

  destroy() {}
}

export const createAquariumEngine = (options = {}) => new AquariumEngine(options);

export default AquariumEngine;
