import { AGE, COLOR_PALETTE } from "../constants.js";
import { createSeededRandom } from "../random.js";

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
const wrapHue = (hue) => ((Math.round(hue) % 256) + 256) % 256;

export const hsvToRgbRainbowApprox = ({ h = 0, s = 0, v = 0 }) => {
  const hue = (wrapHue(h) / 256) * 6;
  const saturation = clampByte(s) / 255;
  const value = clampByte(v) / 255;
  const sector = Math.floor(hue);
  const fraction = hue - sector;
  const p = value * (1 - saturation);
  const q = value * (1 - saturation * fraction);
  const t = value * (1 - saturation * (1 - fraction));

  const [r, g, b] =
    [
      [value, t, p],
      [q, value, p],
      [p, value, t],
      [p, q, value],
      [t, p, value],
      [value, p, q],
    ][sector % 6] ?? [value, p, q];

  return {
    r: clampByte(r * 255),
    g: clampByte(g * 255),
    b: clampByte(b * 255),
  };
};

export class ColorPalette {
  constructor(size, { stripesEnabled = false, rng = createSeededRandom() } = {}) {
    this.rng = rng;
    this.size = Math.max(1, Math.trunc(size));
    this.stripesEnabled = stripesEnabled;
    this.baseHue = this.rng.int(COLOR_PALETTE.BASE_HUE.min, COLOR_PALETTE.BASE_HUE.maxExclusive);
    this.hueStep = this.rng.int(COLOR_PALETTE.HUE_STEP.min, COLOR_PALETTE.HUE_STEP.maxExclusive);
    this.swapType = null;
    this.colorsHSV = Array.from({ length: this.size }, (_, index) => ({
      h: wrapHue(this.baseHue + index * this.hueStep),
      s: COLOR_PALETTE.INITIAL_SATURATION,
      v: COLOR_PALETTE.INITIAL_VALUE,
    }));

    if (this.stripesEnabled) {
      this.applyStripes();
    }

    this.updateRGB();
  }

  applyStripes() {
    this.swapType = this.rng.int(COLOR_PALETTE.STRIPE_SWAP_TYPE.min, COLOR_PALETTE.STRIPE_SWAP_TYPE.maxExclusive);
    let hueShift = 0;
    if (this.swapType === 0) {
      hueShift = COLOR_PALETTE.STRIPE_HUE_SHIFT_A;
    } else if (this.swapType === 1) {
      hueShift = COLOR_PALETTE.STRIPE_HUE_SHIFT_B;
    }

    if (hueShift === 0) return;

    for (let index = 1; index < this.colorsHSV.length; index += 2) {
      this.colorsHSV[index] = {
        ...this.colorsHSV[index],
        h: wrapHue(this.colorsHSV[index].h + hueShift),
      };
    }
  }

  updateRGB() {
    this.colors = this.colorsHSV.map((color) => hsvToRgbRainbowApprox(color));
    return this.colors;
  }

  adjustColorByAgeAndHealth(age, health) {
    let ageFactor = 1;
    if (age >= AGE.AGE_ADULT) {
      ageFactor = 1 - ((age - AGE.AGE_ADULT) / (AGE.AGE_DEAD - AGE.AGE_ADULT)) * 0.5;
    }

    const saturation = clampByte(COLOR_PALETTE.HEALTH_SATURATION_MULTIPLIER * health);
    const value = clampByte(COLOR_PALETTE.AGE_VALUE_MULTIPLIER * ageFactor);

    this.colorsHSV = this.colorsHSV.map((color) => ({
      ...color,
      s: saturation,
      v: value,
    }));

    this.updateRGB();
    return this.colors;
  }

  setColors(colorsHSV = []) {
    this.colorsHSV = colorsHSV.map((color) => ({
      h: wrapHue(color.h ?? color.hue ?? 0),
      s: clampByte(color.s ?? color.saturation ?? COLOR_PALETTE.INITIAL_SATURATION),
      v: clampByte(color.v ?? color.value ?? COLOR_PALETTE.INITIAL_VALUE),
    }));
    this.size = this.colorsHSV.length;
    this.updateRGB();
    return this;
  }

  getColorsHSV() {
    return this.colorsHSV.map((color) => ({ ...color }));
  }

  getColors() {
    return this.colors.map((color) => ({ ...color }));
  }

  getDebugSnapshot() {
    return {
      size: this.size,
      baseHue: this.baseHue,
      hueStep: this.hueStep,
      stripesEnabled: this.stripesEnabled,
      swapType: this.swapType,
      colorsHSV: this.getColorsHSV(),
    };
  }
}

export default ColorPalette;
