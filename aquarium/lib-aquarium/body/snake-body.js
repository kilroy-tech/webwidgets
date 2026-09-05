import { BODY_TYPES, SNAKE_BODY } from "../constants.js";
import { createSeededRandom } from "../random.js";
import { Vector2 } from "../vector.js";
import { Body } from "./body.js";
import { ColorPalette } from "./color-palette.js";
import { asVector, getForeground } from "./utils.js";

export class SnakeBody extends Body {
  constructor({ rng = createSeededRandom(), head = null, tail = null, fin = null } = {}) {
    const numSegments = rng.int(SNAKE_BODY.NUM_SEGMENTS.min, SNAKE_BODY.NUM_SEGMENTS.maxExclusive);
    super({
      type: BODY_TYPES.SNAKE,
      head,
      tail,
      fin,
      colorPalette: new ColorPalette(numSegments, { rng }),
    });
    this.segments = Array.from({ length: numSegments }, () => 1);
    this.segmentPositions = Array.from({ length: numSegments }, () => new Vector2());
  }

  display({ framebuffer }) {
    const maxStart = this.segmentPositions.length - 2;
    const start = Math.min(maxStart, Math.max(0, Math.trunc(maxStart * this.size)));
    for (let index = start; index > -1; index -= 1) {
      this.drawSegment(index + 1, this.segmentPositions[index], this.colorPalette.colors[index], framebuffer);
    }
    this.drawSegment(0, this.pos, this.colorPalette.colors[0], framebuffer);
  }

  drawSegment(index, input, color, framebuffer) {
    const foreground = getForeground(framebuffer);
    const vin = asVector(input);
    const current = asVector(this.segmentPositions[index]);
    const diff = vin.subtract(current);
    const segmentAngle = diff.heading();
    this.segmentPositions[index] = new Vector2(vin.x - Math.cos(segmentAngle), vin.y - Math.sin(segmentAngle));
    foreground.drawPixel(this.segmentPositions[index].x, this.segmentPositions[index].y, color);
  }
}

export default SnakeBody;
