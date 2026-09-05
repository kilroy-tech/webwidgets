import { BOIDS, CO2_THRESHOLDS, ENVIRONMENT } from "./constants.js";
import { Boid } from "./boid.js";
import { createSeededRandom } from "./random.js";
import { Vector2 } from "./vector.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mapValue = (value, inMin, inMax, outMin, outMax) => ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
const randomRangeInt = (rng, range) => rng.int(range.min, range.maxExclusive);

export class BoidManager {
  constructor(options = {}) {
    this.rngSeed = options.rngSeed ?? 0xb01d123;
    this.rng = createSeededRandom(this.rngSeed);
    this.width = 0;
    this.height = 0;
    this.limits = new Vector2(0, 0);
    this.boidGroups = [];
    this.lastSpeedMultiplier = 1;
    this.lastCO2 = ENVIRONMENT.NORMAL_CO2_PPM;
    this.resize(options.width ?? 0, options.height ?? 0);
  }

  resize(width, height) {
    const nextWidth = Math.max(0, Math.floor(width));
    const nextHeight = Math.max(0, Math.floor(height));
    if (nextWidth === this.width && nextHeight === this.height && this.boidGroups.length) return this;

    this.width = nextWidth;
    this.height = nextHeight;
    this.limits = new Vector2(this.width, this.height);
    this.initializeBoids();
    return this;
  }

  initializeBoids() {
    this.rng = createSeededRandom(this.rngSeed);
    this.boidGroups = Array.from({ length: BOIDS.GROUPS }, () => []);

    for (let groupIndex = 0; groupIndex < BOIDS.GROUPS; groupIndex += 1) {
      const numBoids = randomRangeInt(this.rng, BOIDS.NUM_BOIDS);
      for (let boidIndex = 0; boidIndex < numBoids; boidIndex += 1) {
        const boid = new Boid({
          x: this.rng.int(0, this.width),
          y: this.rng.int(0, this.height),
          limits: this.limits,
          rng: this.rng,
        });
        boid.maxspeed = randomRangeInt(this.rng, BOIDS.MAX_SPEED) / 10.0;
        boid.maxforce = randomRangeInt(this.rng, BOIDS.MAX_FORCE) / 10.0;
        this.boidGroups[groupIndex].push(boid);
      }
    }
  }

  updateBoids(co2 = ENVIRONMENT.NORMAL_CO2_PPM) {
    this.lastCO2 = co2;
    this.lastSpeedMultiplier = clamp(
      mapValue(co2, CO2_THRESHOLDS.CO2_BAD, CO2_THRESHOLDS.CO2_REALBAD, 100.0, 0.0),
      0.0,
      100.0,
    ) / 100.0;

    for (const group of this.boidGroups) {
      for (const boid of group) {
        boid.run(group, this.lastSpeedMultiplier);
        boid.avoidBorders();
      }
    }

    return this.getDebugSnapshot();
  }

  renderBoids(framebuffer) {
    if (!framebuffer?.foreground) {
      throw new Error("BoidManager.renderBoids requires a framebuffer with a foreground layer");
    }

    for (const group of this.boidGroups) {
      for (const boid of group) {
        const angle = Math.atan2(boid.velocity.y, boid.velocity.x);
        const x2 = boid.location.x + Math.cos(angle);
        const y2 = boid.location.y + Math.sin(angle);
        framebuffer.foreground.drawLine(boid.location.x, boid.location.y, x2, y2, BOIDS.RENDER_COLOR);
      }
    }
  }

  update({ framebuffer, co2 = ENVIRONMENT.NORMAL_CO2_PPM } = {}) {
    const snapshot = this.updateBoids(co2);
    this.renderBoids(framebuffer);
    return snapshot;
  }

  getDebugSnapshot() {
    const counts = this.boidGroups.map((group) => group.length);
    return {
      boids: {
        groups: this.boidGroups.length,
        counts,
        total: counts.reduce((sum, count) => sum + count, 0),
        speedMultiplier: this.lastSpeedMultiplier,
        co2: this.lastCO2,
        desiredSeparation: BOIDS.DEFAULT_DESIRED_SEPARATION,
        neighborDistance: BOIDS.DEFAULT_NEIGHBOR_DISTANCE,
        sample: this.boidGroups.map((group) => group.slice(0, 3).map((boid) => boid.getDebugSnapshot())),
      },
    };
  }
}

export const createBoidManager = (options = {}) => new BoidManager(options);

export default BoidManager;
