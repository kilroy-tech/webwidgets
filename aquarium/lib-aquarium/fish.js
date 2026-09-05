import {
  AGE,
  AQUARIUM,
  BODY_TYPES,
  BREEDING,
  CO2_THRESHOLDS,
  FISH_LIFECYCLE,
  FISH_TYPE_SELECTION,
  FOOD,
  HEALTH,
  MOTION_TYPES,
} from "./constants.js";
import { createBody } from "./body/index.js";
import { createMotionFromLogicalPanel } from "./motion/index.js";
import { createSeededRandom } from "./random.js";
import { Vector2 } from "./vector.js";

const cloneVector = (value) => (value instanceof Vector2 ? value.clone() : new Vector2(value?.x ?? 0, value?.y ?? 0));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const selectBodyMotionType = (rng) => {
  const roll = rng.next();
  let cursor = 0;
  for (const item of FISH_TYPE_SELECTION) {
    cursor += item.probability;
    if (roll <= cursor) {
      return item;
    }
  }
  return FISH_TYPE_SELECTION[FISH_TYPE_SELECTION.length - 1];
};

export class AquariumFish {
  constructor(options = {}) {
    this.rng = options.rng ?? createSeededRandom();
    this.panelWidth = options.width ?? 0;
    this.panelHeight = options.height ?? 0;
    this.physicsScale = options.physicsScale ?? AQUARIUM.PHYSICS_SCALE;
    this.offspringCount = options.offspringCount ?? 0;
    this.food = null;
    this.lastUpdateTime = options.now ?? null;
    this.agingRate = this.initializeAgingRate();

    if (options.definition) {
      this.initializeFromDefinition(options.definition, options);
    } else {
      this.initializeRandom(options);
    }
  }

  initializeRandom(options = {}) {
    const inputPosition = options.position ? cloneVector(options.position) : new Vector2();
    const hasPosition = inputPosition.x !== 0 || inputPosition.y !== 0;
    this.position = hasPosition
      ? inputPosition
      : new Vector2(this.rng.int(0, Math.max(1, this.panelWidth)), this.rng.int(0, Math.max(1, this.panelHeight)));
    this.age = options.age ?? 0;
    this.health = options.health ?? 1;

    const selected = options.bodyType && options.motionType ? options : selectBodyMotionType(this.rng);
    this.body = createBody(selected.bodyType, {
      rng: this.rng,
      headType: options.headType,
      tailType: options.tailType,
      finType: options.finType,
    });
    this.motion = createMotionFromLogicalPanel(selected.motionType, {
      position: this.position,
      width: this.panelWidth,
      height: this.panelHeight,
      physicsScale: this.physicsScale,
      rng: this.rng,
    });
    this.fishDefinition = this.createDefinition(selected.bodyType, selected.motionType);
  }

  initializeFromDefinition(definition, options = {}) {
    this.position = cloneVector(options.position ?? { x: 0, y: 0 });
    this.age = definition.age ?? AGE.AGE_CHILD;
    this.health = definition.health ?? 1;
    const bodyType = definition.bodyType ?? BODY_TYPES.FISH;
    const motionType = definition.motionType ?? MOTION_TYPES.FISH;

    this.body = createBody(bodyType, {
      rng: this.rng,
      headType: definition.headType,
      tailType: definition.tailType,
      finType: definition.finType,
    });

    if (definition.colors?.length) {
      this.body.setColorPaletteHSV(definition.colors);
    }

    this.motion = createMotionFromLogicalPanel(motionType, {
      position: this.position,
      width: this.panelWidth,
      height: this.panelHeight,
      physicsScale: this.physicsScale,
      rng: this.rng,
    });
    this.fishDefinition = this.createDefinition(bodyType, motionType);
  }

  initializeAgingRate() {
    const baseRate = 1.0 / (AGE.FISH_LIFESPAN_DAYS * 24 * 60 * 60 * 1000);
    const variation = AGE.FISH_LIFESPAN_VARIATION * (this.rng.int(0, 200) / 100.0 - 1.0);
    return baseRate * (1.0 + variation);
  }

  createDefinition(bodyType, motionType) {
    return {
      age: this.age,
      health: this.health,
      bodyType,
      headType: this.body.getHeadType(),
      tailType: this.body.getTailType(),
      finType: this.body.getFinType(),
      motionType,
      colors: this.body.getColorPaletteHSV(),
    };
  }

  update({ co2 = CO2_THRESHOLDS.CO2_OK, stayInside = false, now = 0 } = {}) {
    if (!this.motion) {
      this.motion = createMotionFromLogicalPanel(this.fishDefinition.motionType, {
        position: this.position,
        width: this.panelWidth,
        height: this.panelHeight,
        physicsScale: this.physicsScale,
        rng: this.rng,
      });
    }

    this.motion.update({ age: this.age, co2, stayInside, now });
    this.position = this.motion.getLogicalPosition(this.physicsScale);
    this.updateAge(co2, now);
    this.updateHealth(co2);
    this.body.update({
      position: this.position,
      velocity: this.motion.getVelocity(),
      angle: this.motion.getAngle(),
      age: this.age,
      health: this.health,
    });

    this.updateFoodTarget();
    this.fishDefinition.age = this.age;
    this.fishDefinition.health = this.health;
    this.fishDefinition.colors = this.body.getColorPaletteHSV();

    if (this.age > AGE.AGE_DEAD) {
      this.age = 0;
    }

    return this.age > AGE.AGE_DEAD;
  }

  updateFoodTarget() {
    if (!this.food) return;

    const foodDistance = this.food.getPosition().subtract(this.position);
    if (this.food.isOffScreen()) {
      this.food = null;
    } else if (foodDistance.mag() < FOOD.EATEN_DISTANCE) {
      this.food.eat();
      this.food = null;
    } else {
      this.motion.followFood(this.food.getPosition().multiply(this.physicsScale));
    }
  }

  updateAge(co2, now) {
    if (this.lastUpdateTime === null) {
      this.lastUpdateTime = now;
      return;
    }

    const timeDiff = Math.max(0, now - this.lastUpdateTime);
    if (co2 < CO2_THRESHOLDS.CO2_REALBAD) {
      this.age += timeDiff * this.agingRate;
    }
    this.lastUpdateTime = now;
  }

  updateHealth(co2) {
    if (co2 >= CO2_THRESHOLDS.CO2_REALBAD) {
      this.health -= HEALTH.HEALTH_REDUCTION_RATE_REALBAD;
    } else if (co2 >= CO2_THRESHOLDS.CO2_BAD) {
      this.health -= HEALTH.HEALTH_REDUCTION_RATE_BAD;
    } else if (co2 < CO2_THRESHOLDS.CO2_BAD) {
      this.health += HEALTH.HEALTH_INCREASE_RATE_GOOD;
    }
    this.health = clamp(this.health, 0, 1);
  }

  canReproduce() {
    return this.age > BREEDING.PARENT_MIN_AGE && this.age < BREEDING.PARENT_MAX_AGE;
  }

  registerOffspring() {
    this.offspringCount += 1;
  }

  display({ framebuffer, now = 0 } = {}) {
    if (this.age < AGE.AGE_EGG) {
      this.body.displayEgg({ framebuffer });
    } else {
      this.body.display({ framebuffer, now });
    }
  }

  setFood(food) {
    this.food = food;
  }

  getFood() {
    return this.food;
  }

  getPosition() {
    return this.position.clone();
  }

  getVelocity() {
    return this.motion.getVelocity();
  }

  getAge() {
    return this.age;
  }

  getHealth() {
    return this.health;
  }

  getBodyType() {
    return this.fishDefinition.bodyType;
  }

  getMotionType() {
    return this.fishDefinition.motionType;
  }

  getColorsHSV() {
    return this.body.getColorPaletteHSV();
  }

  toStateDefinition() {
    return {
      age: this.getAge(),
      health: this.getHealth(),
      bodyType: this.getBodyType(),
      headType: this.fishDefinition.headType,
      tailType: this.fishDefinition.tailType,
      finType: this.fishDefinition.finType,
      motionType: this.getMotionType(),
      colors: this.getColorsHSV(),
    };
  }

  getDebugSnapshot() {
    return {
      age: this.age,
      health: this.health,
      position: this.position.toJSON(),
      velocity: this.motion.getVelocity().toJSON(),
      bodyType: this.getBodyType(),
      motionType: this.getMotionType(),
      headType: this.fishDefinition.headType,
      tailType: this.fishDefinition.tailType,
      finType: this.fishDefinition.finType,
      hasFood: Boolean(this.food),
      offspringCount: this.offspringCount,
    };
  }
}

export class AquariumFishManager {
  constructor(options = {}) {
    this.rngSeed = options.rngSeed ?? 0x51f1f00d;
    this.rng = options.rng ?? createSeededRandom(this.rngSeed);
    this.width = Math.max(0, Math.floor(options.width ?? 0));
    this.height = Math.max(0, Math.floor(options.height ?? 0));
    this.physicsScale = options.physicsScale ?? AQUARIUM.PHYSICS_SCALE;
    this.idealCount = Math.max(1, options.idealCount ?? AQUARIUM.NUM_FISH_IDEAL);
    this.breedIntervalMs = Math.max(0, (options.breedIntervalMinutes ?? BREEDING.INTERVAL_MINUTES) * 60 * 1000);
    this.lastBreedTime = options.lastBreedTime ?? null;
    this.fish = [];
    if (Array.isArray(options.definitions)) {
      this.loadStateDefinitions(options.definitions, options.now);
    } else {
      this.initializeFish(options.initialCount ?? AQUARIUM.NUM_FISH_START);
    }
  }

  initializeFish(count = AQUARIUM.NUM_FISH_START) {
    this.fish = [];
    for (let index = 0; index < count; index += 1) {
      this.fish.push(
        new AquariumFish({
          rng: this.rng,
          width: this.width,
          height: this.height,
          physicsScale: this.physicsScale,
          position: new Vector2(this.rng.int(0, Math.max(1, this.width)), this.rng.int(0, Math.max(1, this.height))),
          age: FISH_LIFECYCLE.INITIAL_RANDOM_AGE,
          health: 1,
        }),
      );
    }
  }

  loadStateDefinitions(definitions = [], now = null) {
    this.fish = definitions.map(
      (definition) =>
        new AquariumFish({
          rng: this.rng,
          width: this.width,
          height: this.height,
          physicsScale: this.physicsScale,
          // Positions aren't persisted, so scatter restored fish rather than
          // stacking them all at the origin.
          position: new Vector2(this.rng.int(0, Math.max(1, this.width)), this.rng.int(0, Math.max(1, this.height))),
          definition,
          now,
        }),
    );
  }

  getStateDefinitions() {
    return this.fish.map((fish) => fish.toStateDefinition());
  }

  resize(width, height) {
    this.width = Math.max(0, Math.floor(width));
    this.height = Math.max(0, Math.floor(height));
    for (const fish of this.fish) {
      fish.panelWidth = this.width;
      fish.panelHeight = this.height;
      fish.position.x = clamp(fish.position.x, 0, Math.max(0, this.width - 1));
      fish.position.y = clamp(fish.position.y, 0, Math.max(0, this.height - 1));
    }
  }

  assignFood(foodPieces = []) {
    for (const piece of foodPieces) {
      this.assignFoodToClosestFish(piece);
    }
  }

  assignFoodToClosestFish(piece) {
    let minDistance = Number.POSITIVE_INFINITY;
    let closestFish = null;

    for (const fish of this.fish) {
      if (fish.getFood() === null && fish.getAge() > AGE.AGE_EGG && fish.getAge() < AGE.AGE_SENIOR) {
        const distance = fish.getPosition().dist(piece.getPosition());
        if (distance < minDistance) {
          minDistance = distance;
          closestFish = fish;
        }
      }
    }

    if (closestFish) {
      closestFish.setFood(piece);
    }
  }

  update({ framebuffer, co2 = CO2_THRESHOLDS.CO2_OK, stayInside = false, now = 0 } = {}) {
    const survivors = [];
    for (const fish of this.fish) {
      const destroy = fish.update({ co2, stayInside, now });
      if (!destroy) {
        fish.display({ framebuffer, now });
        survivors.push(fish);
      }
    }
    this.fish = survivors;

    this.tryBreed(now);

    return this.getDebugSnapshot();
  }

  // Leaves lastBreedTime alone, so shortening the interval can allow an
  // immediate birth if enough time has already elapsed.
  setBreedIntervalMinutes(minutes) {
    this.breedIntervalMs = Math.max(0, (Number(minutes) || 0) * 60 * 1000);
    return this.breedIntervalMs;
  }

  tryBreed(now) {
    if (this.fish.length >= this.idealCount) return;

    if (this.lastBreedTime === null) {
      this.lastBreedTime = now;
      return;
    }
    if (now - this.lastBreedTime < this.breedIntervalMs) return;

    const parent = this.fish.find((fish) => fish.canReproduce());
    if (!parent) return;

    this.lastBreedTime = now;
    parent.registerOffspring();
    this.fish.push(
      new AquariumFish({
        rng: this.rng,
        width: this.width,
        height: this.height,
        physicsScale: this.physicsScale,
        position: parent.getPosition(),
        age: 0,
        health: 1,
        now,
      }),
    );
  }

  getDebugSnapshot() {
    return {
      fish: {
        count: this.fish.length,
        idealCount: this.idealCount,
        breedIntervalMs: this.breedIntervalMs,
        physicsScale: this.physicsScale,
        positions: this.fish.map((fish) => fish.getDebugSnapshot()),
      },
    };
  }
}

export const createAquariumFishManager = (options = {}) => new AquariumFishManager(options);

export default AquariumFishManager;
