import { BODY_TYPES, OCTOPUS_BODY } from "../constants.js";
import { createSeededRandom } from "../random.js";
import { Vector2 } from "../vector.js";
import { Body } from "./body.js";
import { ColorPalette } from "./color-palette.js";
import { getForeground } from "./utils.js";

export class OctopusBody extends Body {
  constructor({ rng = createSeededRandom(), head = null, tail = null, fin = null } = {}) {
    super({
      type: BODY_TYPES.OCTOPUS,
      head,
      tail,
      fin,
      colorPalette: new ColorPalette(OCTOPUS_BODY.TENTACLE_SEGMENTS + 1, { rng }),
    });
    this.rad = rng.int(OCTOPUS_BODY.SIZE.min, OCTOPUS_BODY.SIZE.maxExclusive);
    this.numTentacles = rng.int(OCTOPUS_BODY.MIN_TENTACLES, OCTOPUS_BODY.MAX_TENTACLES + 1);
    this.tentacleLength = rng.int(OCTOPUS_BODY.TENTACLE_LENGTH.min, OCTOPUS_BODY.TENTACLE_LENGTH.maxExclusive);
  }

  display({ framebuffer, now = 0 } = {}) {
    const foreground = getForeground(framebuffer);
    const radToDraw = Math.max(1, (this.rad * this.size) / 4);
    const lengthToDraw = Math.max(1, (this.rad * this.size) / 2);

    foreground.drawCircleArray(
      this.pos.x,
      this.pos.y,
      radToDraw,
      lengthToDraw,
      this.angle,
      this.colorPalette.colors[0],
    );

    for (let index = 0; index < this.numTentacles; index += 1) {
      this.drawTentacle(index, framebuffer, now);
    }
  }

  drawTentacle(index, framebuffer, now) {
    const foreground = getForeground(framebuffer);
    const bodyBack = Vector2.fromAngle(this.angle + Math.PI).multiplySelf((this.rad * this.size) / 2).addSelf(this.pos);
    const spread = Math.PI * 2;
    const tentacleAngle =
      this.angle + Math.PI + (index - (this.numTentacles - 1) / 2) * (spread / (this.numTentacles - 1));
    const segmentLength = (this.tentacleLength * this.size) / OCTOPUS_BODY.TENTACLE_SEGMENTS;
    const time = now / 1000;
    const velocityFactor = Math.min(this.vel.mag() / 2, 1);
    let current = bodyBack;

    for (let segment = 0; segment < OCTOPUS_BODY.TENTACLE_SEGMENTS; segment += 1) {
      const movementAngle = Math.sin(time * 2 + index * 0.5 + segment * 0.3) * 0.2 * velocityFactor;
      const angle = tentacleAngle + movementAngle;
      const next = Vector2.fromAngle(angle).multiplySelf(segmentLength).addSelf(current);
      const color = this.colorPalette.colors[segment + 1] ?? this.colorPalette.colors[0];
      foreground.drawLine(current.x, current.y, next.x, next.y, color);
      current = next;
    }
  }

  getDebugSnapshot() {
    return {
      ...super.getDebugSnapshot(),
      rad: this.rad,
      numTentacles: this.numTentacles,
      tentacleLength: this.tentacleLength,
    };
  }
}

export default OctopusBody;
