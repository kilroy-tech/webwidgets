import { createSeededRandom } from "../random.js";
import { asVector, fromAngle, getForeground, normalizeColor } from "./utils.js";

export class Tail {
  constructor({ type = "noTail" } = {}) {
    this.type = type;
  }

  display() {}
}

export class NoTail extends Tail {
  constructor() {
    super({ type: "noTail" });
  }

  display() {}
}

export class TriangleTail extends Tail {
  constructor() {
    super({ type: "TriangleTail" });
  }

  display({ framebuffer, position, angle, size, color }) {
    const foreground = getForeground(framebuffer);
    const pos = asVector(position);
    const drawColor = normalizeColor(color);
    const heading = fromAngle(angle);
    const pt1 = heading.clone().setMag(size).addSelf(pos);
    const pt2 = heading.clone().setMag(-size).addSelf(pos);
    heading.multiplySelf(3);

    let pt3 = fromAngle(angle + Math.PI / 2).setMag(size * 3).subtractSelf(heading).addSelf(pos);
    foreground.fillTriangle(pt1, pt2, pt3, drawColor);

    pt3 = fromAngle(angle + Math.PI / 2).setMag(-size * 3).subtractSelf(heading).addSelf(pos);
    foreground.fillTriangle(pt1, pt2, pt3, drawColor);
  }
}

export class CurvyTail extends Tail {
  constructor() {
    super({ type: "CurvyTail" });
  }

  display({ framebuffer, position, angle, size, color }) {
    const foreground = getForeground(framebuffer);
    const pos = asVector(position);
    foreground.drawCircleArray(pos.x, pos.y, size / 3, size * 3, angle + Math.PI / 2, normalizeColor(color));
  }
}

export class WavyTail extends Tail {
  constructor({ rng = createSeededRandom() } = {}) {
    super({ type: "WavyTail" });
    const numSegments = rng.int(5, 15);
    this.segmentPositions = Array.from({ length: numSegments }, () => ({ x: 0, y: 0 }));
  }

  drawSegment(index, input, color, framebuffer) {
    const foreground = getForeground(framebuffer);
    const vin = asVector(input);
    const current = asVector(this.segmentPositions[index]);
    const diff = vin.subtract(current);
    const segmentAngle = diff.heading();
    this.segmentPositions[index] = {
      x: vin.x - Math.cos(segmentAngle),
      y: vin.y - Math.sin(segmentAngle),
    };
    foreground.drawPixel(this.segmentPositions[index].x, this.segmentPositions[index].y, color);
  }

  display({ framebuffer, position, size, color }) {
    const drawColor = normalizeColor(color);
    const maxStart = this.segmentPositions.length - 2;
    const start = Math.min(maxStart, Math.max(0, Math.trunc(maxStart * size)));
    for (let index = start; index > -1; index -= 1) {
      this.drawSegment(index + 1, this.segmentPositions[index], drawColor, framebuffer);
    }
    this.drawSegment(0, position, drawColor, framebuffer);
  }
}

export const TAIL_TYPES = Object.freeze({
  noTail: NoTail,
  TriangleTail,
  CurvyTail,
  WavyTail,
});

export const createTail = (type = "noTail", options = {}) => {
  const TailType = TAIL_TYPES[type];
  if (!TailType) {
    throw new Error(`Unknown aquarium tail type: ${type}`);
  }
  return new TailType(options);
};

export default Tail;
