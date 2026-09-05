import { FISH_BODY } from "../constants.js";
import { createSeededRandom } from "../random.js";
import { asVector, fromAngle, getForeground, normalizeColor, offsetPosition, swappedColor } from "./utils.js";

export class Head {
  constructor({ type = "Head" } = {}) {
    this.type = type;
  }

  display() {}
}

export class TriangleHead extends Head {
  constructor() {
    super({ type: "TriangleHead" });
  }

  display({ framebuffer, position, angle, size, color, xOffset = 0, yOffset = 0 }) {
    const foreground = getForeground(framebuffer);
    const drawColor = normalizeColor(color);
    const shiftedPosition = offsetPosition(position, xOffset, yOffset).add(fromAngle(angle + Math.PI, size * 0.25));
    const pt1 = fromAngle(angle, size).addSelf(shiftedPosition);
    const pt2 = fromAngle(angle - Math.PI / 2, size / 2).addSelf(shiftedPosition);
    const pt3 = fromAngle(angle + Math.PI / 2, size / 2).addSelf(shiftedPosition);
    foreground.fillTriangle(pt1, pt2, pt3, drawColor);
  }
}

export class FrogHead extends Head {
  constructor() {
    super({ type: "FrogHead" });
  }

  display({ framebuffer, position, angle, size, color, xOffset = 0, yOffset = 0 }) {
    const foreground = getForeground(framebuffer);
    const base = offsetPosition(position, xOffset, yOffset);
    const drawColor = swappedColor(normalizeColor(color));
    const heading = fromAngle(angle, 0.5);
    const first = fromAngle(angle + Math.PI / 2, size).addSelf(heading).addSelf(base);
    const second = fromAngle(angle + Math.PI / 2, -size).addSelf(heading).addSelf(base);
    foreground.fillCircle(first.x, first.y, size / 2, drawColor);
    foreground.fillCircle(second.x, second.y, size / 2, drawColor);
  }
}

export class NeedleHead extends Head {
  constructor({ rng = createSeededRandom() } = {}) {
    super({ type: "NeedleHead" });
    this.noseLengthMultiplier = rng.int(
      FISH_BODY.NEEDLE_NOSE_LENGTH_MULTIPLIER.min,
      FISH_BODY.NEEDLE_NOSE_LENGTH_MULTIPLIER.maxExclusive,
    );
  }

  display({ framebuffer, position, angle, size, color, xOffset = 0, yOffset = 0 }) {
    const foreground = getForeground(framebuffer);
    const base = offsetPosition(position, xOffset, yOffset);
    const tip = fromAngle(angle, size * this.noseLengthMultiplier).addSelf(asVector(base));
    foreground.drawLine(tip.x, tip.y, base.x, base.y, normalizeColor(color));
  }
}

export const HEAD_TYPES = Object.freeze({
  TriangleHead,
  FrogHead,
  NeedleHead,
});

export const createHead = (type, options = {}) => {
  const HeadType = HEAD_TYPES[type];
  if (!HeadType) {
    throw new Error(`Unknown aquarium head type: ${type}`);
  }
  return new HeadType(options);
};

export default Head;
