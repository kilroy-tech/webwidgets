import { BODY_TYPES, FISH_BODY } from "../constants.js";
import { createSeededRandom } from "../random.js";
import { Vector2 } from "../vector.js";
import { Body } from "./body.js";
import { ColorPalette } from "./color-palette.js";
import { asVector, getForeground } from "./utils.js";

const range = (rng, spec) => rng.int(spec.min, spec.maxExclusive);

export class FishBody extends Body {
  constructor({ rng = createSeededRandom(), head = null, tail = null, fin = null } = {}) {
    let numSegments = range(rng, FISH_BODY.NUM_SEGMENTS);
    numSegments = Math.max(numSegments, 2);

    const baseSize = FISH_BODY.MIN_SEGMENT_SIZE;
    const maxAddSize = range(rng, FISH_BODY.MAX_SEGMENT_SIZE);
    const segments = Array.from({ length: numSegments }, (_, index) =>
      Math.max(1, Math.trunc(baseSize + Math.sin((Math.PI * index) / (numSegments - 1)) * maxAddSize)),
    );

    super({
      type: BODY_TYPES.FISH,
      head,
      tail,
      fin,
      colorPalette: new ColorPalette(numSegments, { stripesEnabled: true, rng }),
    });

    this.gapBetweenSegments = range(rng, FISH_BODY.GAP_BETWEEN_SEGMENTS_PERCENT) / 100.0;
    this.segments = segments;
    this.segmentPositions = Array.from({ length: numSegments }, () => new Vector2());
  }

  display({ framebuffer }) {
    for (let index = this.segments.length - 2; index > -1; index -= 1) {
      this.drawSegment(index + 1, this.segmentPositions[index], this.colorPalette.colors[index], true, framebuffer);
    }

    this.drawSegment(0, this.pos, this.colorPalette.colors[0], false, framebuffer);

    const headSize = this.segments[0] * this.size;
    this.head?.display({
      framebuffer,
      position: this.pos,
      angle: this.angle,
      size: headSize,
      color: this.colorPalette.colors[0],
    });
  }

  drawSegment(index, input, color, drawExtras, framebuffer) {
    const foreground = getForeground(framebuffer);
    const vin = asVector(input);
    const current = asVector(this.segmentPositions[index]);
    const diff = vin.subtract(current);
    const segmentAngle = diff.heading();
    const currentSegmentSize = this.segments[index] * this.size;

    if (index === 0) {
      this.segmentPositions[index] = new Vector2(
        vin.x - Math.cos(segmentAngle) * currentSegmentSize,
        vin.y - Math.sin(segmentAngle) * currentSegmentSize,
      );
    } else {
      const previousSegmentSize = this.segments[index - 1] * this.size;
      const maxSegmentSize = Math.max(previousSegmentSize, currentSegmentSize) * this.gapBetweenSegments;
      this.segmentPositions[index] = new Vector2(
        vin.x - Math.cos(segmentAngle) * maxSegmentSize,
        vin.y - Math.sin(segmentAngle) * maxSegmentSize,
      );
    }

    if (drawExtras && (index === 1 || index === 3)) {
      this.fin?.display({
        framebuffer,
        position: this.segmentPositions[index],
        angle: segmentAngle,
        size: currentSegmentSize,
        color,
      });
    } else if (drawExtras && index === this.segments.length - 1) {
      this.tail?.display({
        framebuffer,
        position: this.segmentPositions[index],
        angle: segmentAngle,
        size: currentSegmentSize * 2,
        color,
      });
    } else {
      foreground.fillCircle(this.segmentPositions[index].x, this.segmentPositions[index].y, currentSegmentSize, color);
    }
  }
}

export default FishBody;
