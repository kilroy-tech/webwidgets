import { ENVIRONMENT, WATER } from "./constants.js";
import { inoise8 } from "./fastled-noise.js";
import { packColor } from "./framebuffer.js";

const BYTE_MAX = 255;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;

export const temperatureToPaletteIndex = (temperatureC = ENVIRONMENT.NORMAL_TEMPERATURE_C) => {
  const limitedTemperature = clamp(
    Number(temperatureC) || ENVIRONMENT.NORMAL_TEMPERATURE_C,
    WATER.TEMPERATURE_MIN_C,
    WATER.TEMPERATURE_MAX_C,
  );
  const mapped =
    ((limitedTemperature - WATER.TEMPERATURE_MIN_C) * BYTE_MAX) /
    (WATER.TEMPERATURE_MAX_C - WATER.TEMPERATURE_MIN_C);

  if (limitedTemperature < WATER.RED_CAP_THRESHOLD_C) {
    return Math.min(WATER.PALETTE_CAP_BELOW_RED, Math.round(mapped));
  }

  return Math.round(mapped);
};

export const colorFromWaterPalette = (paletteIndex) => {
  const palette = WATER.PALETTE;
  const scaled = clamp(paletteIndex, 0, BYTE_MAX) * ((palette.length - 1) / BYTE_MAX);
  const startIndex = Math.floor(scaled);
  const endIndex = Math.min(palette.length - 1, startIndex + 1);
  const amount = scaled - startIndex;
  const start = palette[startIndex];
  const end = palette[endIndex];

  return {
    r: Math.round(lerp(start.r, end.r, amount)),
    g: Math.round(lerp(start.g, end.g, amount)),
    b: Math.round(lerp(start.b, end.b, amount)),
  };
};

export const scaleColorByNoise = (color, noiseFactor) => {
  const scale = clamp(noiseFactor, WATER.MIN_NOISE_FACTOR, BYTE_MAX) / BYTE_MAX;
  return {
    r: Math.round(color.r * scale),
    g: Math.round(color.g * scale),
    b: Math.round(color.b * scale),
  };
};

export class AquariumWater {
  constructor(options = {}) {
    this.rowsPerUpdate = options.rowsPerUpdate ?? WATER.ROWS_PER_UPDATE;
    this.scale = options.scale ?? WATER.NOISE_SCALE;
    this.simplexSpeed = options.simplexSpeed ?? WATER.SIMPLEX_SPEED;
    this.width = 0;
    this.height = 0;
    this.currentRow = 0;
    this.updateBuffer = new Uint32Array(0);
    this.lastBaseColor = { r: 0, g: 0, b: 0 };
    this.lastPaletteIndex = 0;
    this.lastRowsUpdated = 0;
    this.lastApplied = false;
    this.resize(options.width ?? 0, options.height ?? 0);
  }

  resize(width, height) {
    const nextWidth = Math.max(0, Math.floor(width));
    const nextHeight = Math.max(0, Math.floor(height));
    if (nextWidth === this.width && nextHeight === this.height) return this;

    this.width = nextWidth;
    this.height = nextHeight;
    this.currentRow = 0;
    this.updateBuffer = new Uint32Array(this.width * this.height);
    return this;
  }

  update({ framebuffer, temperatureC = ENVIRONMENT.NORMAL_TEMPERATURE_C, now = 0 } = {}) {
    if (!framebuffer?.background) {
      throw new Error("AquariumWater.update requires a framebuffer with a background layer");
    }

    this.resize(framebuffer.width, framebuffer.height);

    if (this.currentRow >= this.height) {
      framebuffer.background.pixels.set(this.updateBuffer);
      this.currentRow = 0;
      this.lastRowsUpdated = 0;
      this.lastApplied = true;
      return this.getDebugSnapshot();
    }

    const paletteIndex = temperatureToPaletteIndex(temperatureC);
    const baseColor = colorFromWaterPalette(paletteIndex);
    const startRow = this.currentRow;
    const endRow = Math.min(this.currentRow + this.rowsPerUpdate, this.height);
    const noiseZ = Math.trunc(now * this.simplexSpeed);

    for (let row = startRow; row < endRow; row += 1) {
      for (let col = 0; col < this.width; col += 1) {
        const noiseFactor = Math.max(WATER.MIN_NOISE_FACTOR, inoise8(col * this.scale, row * this.scale, noiseZ));
        this.updateBuffer[row * this.width + col] = packColor(scaleColorByNoise(baseColor, noiseFactor));
      }
    }

    this.currentRow = endRow;
    this.lastBaseColor = baseColor;
    this.lastPaletteIndex = paletteIndex;
    this.lastRowsUpdated = endRow - startRow;
    this.lastApplied = false;
    return this.getDebugSnapshot();
  }

  getDebugSnapshot() {
    return {
      water: {
        rowsPerUpdate: this.rowsPerUpdate,
        currentRow: this.currentRow,
        totalRows: this.height,
        lastRowsUpdated: this.lastRowsUpdated,
        appliedToBackground: this.lastApplied,
        paletteIndex: this.lastPaletteIndex,
        baseColor: this.lastBaseColor,
        noiseScale: this.scale,
        simplexSpeed: this.simplexSpeed,
        noiseApproximation: "fastled-inoise8-port",
      },
    };
  }
}

export const createAquariumWater = (options = {}) => new AquariumWater(options);

export default AquariumWater;
