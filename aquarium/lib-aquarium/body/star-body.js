import { BODY_TYPES, STAR_BODY } from "../constants.js";
import { createSeededRandom } from "../random.js";
import { Vector2 } from "../vector.js";
import { Body } from "./body.js";
import { ColorPalette } from "./color-palette.js";
import { getForeground } from "./utils.js";

export class StarBody extends Body {
  constructor({ rng = createSeededRandom(), head = null, tail = null, fin = null } = {}) {
    super({
      type: BODY_TYPES.STAR,
      head,
      tail,
      fin,
      colorPalette: new ColorPalette(3, { rng }),
    });
    this.length = rng.int(STAR_BODY.LENGTH.min, STAR_BODY.LENGTH.maxExclusive);
    this.rad = rng.int(STAR_BODY.RAD.min, STAR_BODY.RAD.maxExclusive);
    this.arms = rng.int(STAR_BODY.NUM_ARMS.min, STAR_BODY.NUM_ARMS.maxExclusive);
    this.rotationSpeed =
      rng.int(STAR_BODY.ROTATION_SPEED.min, STAR_BODY.ROTATION_SPEED.maxExclusive) / STAR_BODY.ROTATION_SPEED_DIVISOR;
    this.starAngle = rng.float(0, Math.PI * 2);
    this.nodes = rng.int(STAR_BODY.NODE_STYLE_RANGE.min, STAR_BODY.NODE_STYLE_RANGE.maxExclusive) === 1;
  }

  display({ framebuffer }) {
    const foreground = getForeground(framebuffer);
    const velocityMagnitude = Math.max(this.vel.mag(), 0.1);
    this.starAngle = (this.starAngle + velocityMagnitude * this.rotationSpeed) % (Math.PI * 2);
    const color = this.colorPalette.colors[0];
    const armColor = this.colorPalette.colors[1] ?? color;
    const nodeColor = this.colorPalette.colors[2] ?? color;
    const radToDraw = Math.max(1, this.rad * this.size);
    const lengthToDraw = Math.max(1, this.length * this.size);

    if (this.nodes) {
      for (let index = 0; index < this.arms; index += 1) {
        const angle = this.starAngle + (Math.PI * 2 * index) / this.arms;
        const tip = Vector2.fromAngle(angle).multiplySelf(lengthToDraw).addSelf(this.pos);
        foreground.drawLine(this.pos.x, this.pos.y, tip.x, tip.y, armColor);
        foreground.fillCircle(tip.x, tip.y, Math.max(1, radToDraw / 2), nodeColor);
      }
      foreground.fillCircle(this.pos.x, this.pos.y, radToDraw, color);
      return;
    }

    for (let index = 0; index < this.arms; index += 1) {
      const angle = this.starAngle + (Math.PI * 2 * index) / this.arms;
      const tip = Vector2.fromAngle(angle).multiplySelf(lengthToDraw).addSelf(this.pos);
      const sideA = Vector2.fromAngle(angle + Math.PI / 2).multiplySelf(radToDraw).addSelf(this.pos);
      const sideB = Vector2.fromAngle(angle - Math.PI / 2).multiplySelf(radToDraw).addSelf(this.pos);
      foreground.fillTriangle(tip, sideA, sideB, armColor);
    }

    foreground.fillCircle(this.pos.x, this.pos.y, radToDraw, color);
  }

  getDebugSnapshot() {
    return {
      ...super.getDebugSnapshot(),
      length: this.length,
      rad: this.rad,
      arms: this.arms,
      rotationSpeed: this.rotationSpeed,
      nodes: this.nodes,
    };
  }
}

export default StarBody;
