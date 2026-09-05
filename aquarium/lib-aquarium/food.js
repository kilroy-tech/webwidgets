import { FOOD } from "./constants.js";
import { createSeededRandom } from "./random.js";
import { Vector2 } from "./vector.js";

const YELLOW = Object.freeze({ r: 255, g: 255, b: 0 });

export class AquariumFood {
  constructor({ id, x, y = FOOD.SPAWN_Y } = {}) {
    this.id = id;
    this.position = new Vector2(x, y);
    this.eaten = false;
    this.offScreen = false;
  }

  update(height) {
    this.position.y += FOOD.FALL_SPEED;
    if (this.position.y >= height) {
      this.offScreen = true;
    }
  }

  display(framebuffer) {
    if (!this.eaten) {
      framebuffer.foreground.drawPixel(this.position.x, this.position.y, YELLOW);
    }
  }

  getPosition() {
    return this.position;
  }

  isOffScreen() {
    return this.offScreen;
  }

  eat() {
    this.eaten = true;
  }

  isEaten() {
    return this.eaten;
  }
}

export class AquariumFoodManager {
  constructor(options = {}) {
    this.rngSeed = options.rngSeed ?? 0xf00d123;
    this.rng = createSeededRandom(this.rngSeed);
    this.width = Math.max(0, Math.floor(options.width ?? 0));
    this.height = Math.max(0, Math.floor(options.height ?? 0));
    this.food = [];
    this.touchActive = false;
    this.lastFoodTime = 0;
    this.nextId = 1;
    this.lastTouchPoint = null;
    this.lastAddedFood = null;
    this.unassignedFood = [];
  }

  resize(width, height) {
    this.width = Math.max(0, Math.floor(width));
    this.height = Math.max(0, Math.floor(height));
    this.food = this.food.filter((piece) => piece.position.x < this.width && piece.position.y < this.height);
    this.unassignedFood = this.unassignedFood.filter((piece) => this.food.includes(piece));
    return this;
  }

  addFood() {
    const x = this.rng.float(0, this.width);
    const piece = new AquariumFood({
      id: this.nextId,
      x,
    });
    this.nextId += 1;
    this.food.push(piece);
    this.unassignedFood.push(piece);
    this.lastAddedFood = {
      id: piece.id,
      x: piece.position.x,
      y: piece.position.y,
    };
    return piece;
  }

  takeUnassignedFood() {
    const pieces = this.unassignedFood.filter((piece) => !piece.isOffScreen() && !piece.isEaten());
    this.unassignedFood = [];
    return pieces;
  }

  onTouchStarted({ point = null, now = 0 } = {}) {
    this.lastTouchPoint = point ? { x: point.x, y: point.y } : null;
    if (!this.touchActive) {
      this.touchActive = true;
      this.addFood();
      this.lastFoodTime = now;
    }
  }

  onTouchReleased() {
    this.touchActive = false;
  }

  handleTouchInput(now = 0) {
    if (!this.touchActive) return;
    if (now - this.lastFoodTime >= FOOD.INTERVAL_MS) {
      this.addFood();
      this.lastFoodTime = now;
    }
  }

  update({ framebuffer } = {}) {
    if (!framebuffer?.foreground) {
      throw new Error("AquariumFoodManager.update requires a framebuffer with a foreground layer");
    }

    const remaining = [];
    for (const piece of this.food) {
      piece.update(this.height);
      if (!piece.isOffScreen() && !piece.isEaten()) {
        piece.display(framebuffer);
        remaining.push(piece);
      }
    }
    this.food = remaining;
    return this.getDebugSnapshot();
  }

  getDebugSnapshot() {
    return {
      food: {
        count: this.food.length,
        touchActive: this.touchActive,
        intervalMs: FOOD.INTERVAL_MS,
        fallSpeed: FOOD.FALL_SPEED,
        lastTouchPoint: this.lastTouchPoint,
        lastAddedFood: this.lastAddedFood,
        positions: this.food.map((piece) => ({
          id: piece.id,
          x: piece.position.x,
          y: piece.position.y,
          eaten: piece.eaten,
          offScreen: piece.offScreen,
        })),
        unassignedCount: this.unassignedFood.length,
      },
    };
  }
}

export const createAquariumFoodManager = (options = {}) => new AquariumFoodManager(options);

export default AquariumFoodManager;
