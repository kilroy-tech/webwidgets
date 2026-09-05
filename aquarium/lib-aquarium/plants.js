import { AQUARIUM, ENVIRONMENT, PLANTS } from "./constants.js";
import { createSeededRandom } from "./random.js";
import { Vector2 } from "./vector.js";

const TWO_PI = Math.PI * 2;
const BLACK = Object.freeze({ r: 0, g: 0, b: 0 });
const BRANCH_COLOR = Object.freeze({ r: 0, g: 0, b: 1 });

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mapValue = (value, inMin, inMax, outMin, outMax) =>
  ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;

const randomRangeInt = (rng, range) => rng.int(range.min, range.maxExclusive);

const normalizeAngleDiff = (diff) => {
  if (diff > Math.PI) return diff - TWO_PI;
  if (diff < -Math.PI) return diff + TWO_PI;
  return diff;
};

const plantSizeFactor = (humidityPercent = ENVIRONMENT.NORMAL_HUMIDITY_PERCENT) =>
  mapValue(
    clamp(humidityPercent, PLANTS.HUMIDITY_INPUT_MIN, PLANTS.HUMIDITY_INPUT_MAX),
    PLANTS.HUMIDITY_INPUT_MIN,
    PLANTS.HUMIDITY_INPUT_MAX,
    PLANTS.HUMIDITY_OUTPUT_MIN,
    PLANTS.HUMIDITY_OUTPUT_MAX,
  ) / PLANTS.HUMIDITY_OUTPUT_DIVISOR;

export class AquariumPlant {
  constructor({ x, y, rng = createSeededRandom() } = {}) {
    this.pos = new Vector2(x, y);
    this.rng = rng;
    this.branchSizeBase = PLANTS.BRANCH_SIZE_BASE;
    this.branches = [];
    this.phaseOffsets = [];
    this.lastSizeFactor = plantSizeFactor();
    this.lastGlowCount = 0;

    const numBranches = randomRangeInt(this.rng, PLANTS.BRANCH_COUNT);
    const minAngle = Math.trunc(Math.PI * PLANTS.BRANCH_START_ANGLE_SCALE);
    const maxAngle = Math.trunc(TWO_PI * PLANTS.BRANCH_START_ANGLE_SCALE);

    for (let index = 0; index < numBranches; index += 1) {
      const angle = this.rng.int(minAngle, maxAngle) / PLANTS.BRANCH_START_ANGLE_SCALE;
      const branchStart = Vector2.fromAngle(angle).multiplySelf(this.branchSizeBase);
      this.branches.push({
        startPos: branchStart,
        nodes: [branchStart.clone()],
      });
      this.phaseOffsets.push(randomRangeInt(this.rng, PLANTS.PHASE_OFFSET) / PLANTS.PHASE_OFFSET_DIVISOR);
    }

    this.setupNodes();
  }

  setupNodes() {
    for (const branch of this.branches) {
      const numNodes = randomRangeInt(this.rng, PLANTS.NODE_COUNT);
      for (let index = 1; index < numNodes; index += 1) {
        branch.nodes.push(this.buildNode(branch.nodes[index - 1]));
      }
    }
  }

  buildNode(startVec) {
    const theta = startVec.heading();
    const diff = normalizeAngleDiff(PLANTS.TARGET_DIRECTION_RADIANS - theta);
    return Vector2.fromAngle(theta + diff * PLANTS.CURVATURE_FRACTION)
      .multiplySelf(this.branchSizeBase)
      .addSelf(startVec);
  }

  update({ framebuffer, humidityPercent = ENVIRONMENT.NORMAL_HUMIDITY_PERCENT, now = 0 } = {}) {
    if (!framebuffer?.foreground) {
      throw new Error("AquariumPlant.update requires a framebuffer with a foreground layer");
    }

    const foreground = framebuffer.foreground;
    const currentSizeFactor = plantSizeFactor(humidityPercent);
    const timePhase = now / PLANTS.SWAY_PERIOD_DIVISOR_MS;
    let glowCount = 0;

    for (let branchIndex = 0; branchIndex < this.branches.length; branchIndex += 1) {
      const branch = this.branches[branchIndex];
      const phase = this.phaseOffsets[branchIndex];
      const rootNode = branch.nodes[0];

      foreground.drawLine(
        rootNode.x * currentSizeFactor + this.pos.x,
        rootNode.y * currentSizeFactor + this.pos.y,
        this.pos.x,
        this.pos.y,
        BLACK,
      );

      for (let nodeIndex = 1; nodeIndex < branch.nodes.length; nodeIndex += 1) {
        const node = branch.nodes[nodeIndex];
        const prevNode = branch.nodes[nodeIndex - 1];
        const swayAmplitude = PLANTS.SWAY_AMPLITUDE_PER_NODE * nodeIndex;
        const sway = Math.sin(timePhase + phase) * swayAmplitude;

        foreground.drawLine(
          prevNode.x * currentSizeFactor + sway + this.pos.x,
          prevNode.y * currentSizeFactor + this.pos.y,
          node.x * currentSizeFactor + sway + this.pos.x,
          node.y * currentSizeFactor + this.pos.y,
          BRANCH_COLOR,
        );

        if (nodeIndex === branch.nodes.length - 1) {
          const glowFactor = Math.sin(timePhase + phase) - PLANTS.GLOW_GATE;
          if (glowFactor > 0) {
            const glowIntensity = Math.floor(glowFactor * PLANTS.GLOW_SCALE);
            foreground.fillCircle(
              node.x * currentSizeFactor + sway + this.pos.x,
              node.y * currentSizeFactor + this.pos.y,
              1,
              { r: glowIntensity, g: glowIntensity, b: 0 },
            );
            glowCount += 1;
          }
        }
      }
    }

    this.lastSizeFactor = currentSizeFactor;
    this.lastGlowCount = glowCount;
  }

  getDebugSnapshot() {
    return {
      x: this.pos.x,
      y: this.pos.y,
      branchCount: this.branches.length,
      nodeCounts: this.branches.map((branch) => branch.nodes.length),
      sizeFactor: this.lastSizeFactor,
      glowCount: this.lastGlowCount,
    };
  }
}

export class AquariumPlants {
  constructor(options = {}) {
    this.count = options.count ?? AQUARIUM.NUM_PLANTS;
    this.rngSeed = options.rngSeed ?? 0xa71a17;
    this.rng = createSeededRandom(this.rngSeed);
    this.width = 0;
    this.height = 0;
    this.plants = [];
    this.lastHumidityPercent = ENVIRONMENT.NORMAL_HUMIDITY_PERCENT;
    this.resize(options.width ?? 0, options.height ?? 0);
  }

  resize(width, height) {
    const nextWidth = Math.max(0, Math.floor(width));
    const nextHeight = Math.max(0, Math.floor(height));
    if (nextWidth === this.width && nextHeight === this.height && this.plants.length) return this;

    this.width = nextWidth;
    this.height = nextHeight;
    this.rng = createSeededRandom(this.rngSeed);
    this.plants = Array.from({ length: this.count }, (_, index) =>
      new AquariumPlant({
        x: (this.width * index) / this.count,
        y: this.height + PLANTS.BASE_Y_OFFSET,
        rng: this.rng,
      }),
    );
    return this;
  }

  update({ framebuffer, humidityPercent = ENVIRONMENT.NORMAL_HUMIDITY_PERCENT, now = 0 } = {}) {
    if (!framebuffer) {
      throw new Error("AquariumPlants.update requires a framebuffer");
    }

    this.resize(framebuffer.width, framebuffer.height);
    this.lastHumidityPercent = humidityPercent;

    for (const plant of this.plants) {
      plant.update({ framebuffer, humidityPercent, now });
    }

    return this.getDebugSnapshot();
  }

  getDebugSnapshot() {
    return {
      plants: {
        count: this.plants.length,
        humidityPercent: this.lastHumidityPercent,
        positions: this.plants.map((plant) => ({ x: plant.pos.x, y: plant.pos.y })),
        branchCounts: this.plants.map((plant) => plant.branches.length),
        nodeCounts: this.plants.map((plant) => plant.branches.map((branch) => branch.nodes.length)),
        sizeFactors: this.plants.map((plant) => plant.lastSizeFactor),
        glowCounts: this.plants.map((plant) => plant.lastGlowCount),
      },
    };
  }
}

export const createAquariumPlants = (options = {}) => new AquariumPlants(options);

export default AquariumPlants;
