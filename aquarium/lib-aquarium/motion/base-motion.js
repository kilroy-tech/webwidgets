import { AGE, AQUARIUM, CO2_THRESHOLDS, FORCES, MOTION_INITIAL_VELOCITY } from "../constants.js";
import { createSeededRandom } from "../random.js";
import { Vector2 } from "../vector.js";

const TWO_PI = Math.PI * 2;

const cloneVector = (value) => (value instanceof Vector2 ? value.clone() : new Vector2(value?.x ?? 0, value?.y ?? 0));
const mapFloat = (value, inMin, inMax, outMin, outMax) => ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const smoothStep = (value) => value * value * (3 - 2 * value);

const hash2 = (x, y, seed) => {
  let hash = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
};

export const motionNoiseApprox = (x, y, seed = 0) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smoothStep(x - xi);
  const yf = smoothStep(y - yi);
  const top = lerp(hash2(xi, yi, seed), hash2(xi + 1, yi, seed), xf);
  const bottom = lerp(hash2(xi, yi + 1, seed), hash2(xi + 1, yi + 1, seed), xf);
  return lerp(top, bottom, yf) * 2 - 1;
};

export const randomInitialVelocity = (rng = createSeededRandom()) => {
  let velocity;
  do {
    velocity = new Vector2(
      rng.int(MOTION_INITIAL_VELOCITY.COMPONENT.min, MOTION_INITIAL_VELOCITY.COMPONENT.maxExclusive),
      rng.int(MOTION_INITIAL_VELOCITY.COMPONENT.min, MOTION_INITIAL_VELOCITY.COMPONENT.maxExclusive),
    );
  } while (velocity.mag() < MOTION_INITIAL_VELOCITY.RETRY_WHILE_MAG_BELOW);

  return velocity;
};

export class Motion {
  constructor(position, xResolution, yResolution, { rng = createSeededRandom(), profile, type = "Motion" } = {}) {
    if (!profile) {
      throw new Error("Motion requires a motion profile");
    }

    this.type = type;
    this.rng = rng;
    this.pos = cloneVector(position);
    this.vel = randomInitialVelocity(rng);
    this.acc = new Vector2();
    this.angle = this.vel.heading();
    this.maxSpeed = profile.MAX_SPEED;
    this.minSpeed = profile.MIN_SPEED;
    this.maxforce = profile.MAX_FORCE;
    this.sinAmplitude = profile.SIN_AMPLITUDE;
    this.sinFrequency = profile.SIN_FREQUENCY;
    this.noiseAmplitude = profile.NOISE_AMPLITUDE;
    this.noiseFrequency = profile.NOISE_FREQUENCY;
    this.angleOffset = rng.float(0, TWO_PI);
    this.noiseSeed = rng.int(0, 2147483647);
    this.xResolution = xResolution;
    this.yResolution = yResolution;
    this.foodDirection = new Vector2();
    this.followingFood = false;
    this.outOfBoundary = false;
    this.co2 = CO2_THRESHOLDS.CO2_OK;
    this.lastMaxSpeedCO2 = this.maxSpeed;
  }

  getPosition() {
    return this.pos.clone();
  }

  getLogicalPosition(physicsScale = AQUARIUM.PHYSICS_SCALE) {
    return this.pos.divide(physicsScale);
  }

  getVelocity() {
    return this.vel.clone();
  }

  getAngle() {
    return this.angle;
  }

  doMotion() {
    throw new Error("Motion subclasses must implement doMotion()");
  }

  update({ age = AGE.AGE_ADULT, co2 = CO2_THRESHOLDS.CO2_OK, stayInside = false, now = 0 } = {}) {
    this.co2 = co2;

    if (age < AGE.AGE_EGG) {
      this.vel = new Vector2();
      return this.getDebugSnapshot();
    }

    if (stayInside || co2 > CO2_THRESHOLDS.CO2_BAD) {
      this.boundaryCheck(FORCES.BOUNDARY_FORCE * 10);
    } else {
      this.boundaryCheck(FORCES.BOUNDARY_FORCE);
    }

    if (!this.followingFood && !this.outOfBoundary) {
      this.doMotion(now);
    } else if (this.followingFood) {
      const foodForce = this.foodDirection.subtract(this.pos);
      foodForce.setMag(FORCES.FOOD_FORCE);
      this.applyForce(foodForce);
    }

    const desiredVel = this.vel.clone().addSelf(this.acc);
    if (desiredVel.mag() < this.minSpeed) {
      desiredVel.setMag(this.minSpeed);
    }

    const maxSpeedCO2 = clamp(
      mapFloat(co2, CO2_THRESHOLDS.CO2_BAD, CO2_THRESHOLDS.CO2_REALBAD, this.maxSpeed, 0),
      0,
      this.maxSpeed,
    );
    desiredVel.limit(maxSpeedCO2);
    this.lastMaxSpeedCO2 = maxSpeedCO2;

    this.vel = desiredVel;
    this.pos.addSelf(this.vel);
    this.acc.multiplySelf(0);
    this.angle = this.vel.heading();
    this.followingFood = false;

    return this.getDebugSnapshot();
  }

  applyForce(force) {
    this.acc.addSelf(force);
  }

  boundaryCheck(boundaryForce = FORCES.BOUNDARY_FORCE) {
    this.outOfBoundary = false;
    if (this.pos.x < AQUARIUM.BORDER_BUFFER) {
      this.applyForce(new Vector2(boundaryForce, 0));
      this.outOfBoundary = true;
    }
    if (this.pos.y < AQUARIUM.BORDER_BUFFER) {
      this.applyForce(new Vector2(0, boundaryForce));
      this.outOfBoundary = true;
    }
    if (this.pos.x > this.xResolution - AQUARIUM.BORDER_BUFFER) {
      this.applyForce(new Vector2(-boundaryForce, 0));
      this.outOfBoundary = true;
    }
    if (this.pos.y > this.yResolution - AQUARIUM.BORDER_BUFFER) {
      this.applyForce(new Vector2(0, -boundaryForce));
      this.outOfBoundary = true;
    }
  }

  frontSineMotion(now = 0) {
    const theta = this.vel.heading();
    const angle = now * this.sinFrequency + this.angleOffset;
    const offset = Math.sin(angle) * this.sinAmplitude;
    this.applyForce(Vector2.fromAngle(theta).multiplySelf(offset));
  }

  sideSineMotion(now = 0) {
    const theta = this.vel.heading() + Math.PI / 2;
    const angle = now * this.sinFrequency + this.angleOffset;
    const offset = Math.sin(angle) * this.sinAmplitude;
    this.applyForce(Vector2.fromAngle(theta).multiplySelf(offset));
  }

  noiseMotion() {
    const noiseValue = motionNoiseApprox(this.pos.x * this.noiseFrequency, this.pos.y * this.noiseFrequency, this.noiseSeed);
    const noiseAngle = noiseValue * TWO_PI;
    const noiseForce = Vector2.fromAngle(noiseAngle).multiplySelf(this.noiseAmplitude * noiseValue);
    this.applyForce(noiseForce);
  }

  followFood(foodPos) {
    this.foodDirection = cloneVector(foodPos);
    this.followingFood = true;
  }

  getDebugSnapshot() {
    return {
      type: this.type,
      position: this.pos.toJSON(),
      velocity: this.vel.toJSON(),
      angle: this.angle,
      maxSpeed: this.maxSpeed,
      minSpeed: this.minSpeed,
      maxforce: this.maxforce,
      lastMaxSpeedCO2: this.lastMaxSpeedCO2,
      outOfBoundary: this.outOfBoundary,
      followingFood: this.followingFood,
      noiseApproximation: "deterministic-value-noise",
    };
  }
}

export default Motion;
